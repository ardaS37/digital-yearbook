const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const DISCONNECT_TIMEOUT_MS = 1000 * 30;

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) return res.status(401).json({ error: 'Yıllık hesabıyla giriş yapmalısın.' });
  return next();
}

function makePlayer(req) {
  return {
    id: String(req.currentUser.id),
    name: req.currentUser.name || req.currentUser.login_identifier || `Oyuncu ${req.currentUser.id}`
  };
}

function makeBot() {
  return { id: 'bot-O', name: 'PC' };
}

function isBot(player) {
  return player && String(player.id || '').startsWith('bot-');
}

function variantFromReq(req) {
  const base = `${req.baseUrl || ''}${req.originalUrl || ''}`;
  return base.includes('capraz-dama') || req.body?.variant === 'capraz' || req.query?.variant === 'capraz' ? 'capraz' : 'turk';
}

function variantTitle(variant) {
  return variant === 'capraz' ? 'Çapraz Dama' : 'Dama';
}

function createCode() {
  let code = '';
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function createBoard() {
  const board = Array(64).fill(null);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if ((row + col) % 2 === 1) board[row * 8 + col] = 'O';
    }
  }
  for (let row = 5; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if ((row + col) % 2 === 1) board[row * 8 + col] = 'X';
    }
  }
  return board;
}

function createRoomState() {
  return { board: createBoard(), turn: 'X', winner: null, lastMove: null };
}

function opponent(mark) {
  return mark === 'X' ? 'O' : 'X';
}

function rcToIndex(row, col) {
  return row * 8 + col;
}

function indexToRc(index) {
  return [Math.floor(index / 8), index % 8];
}

function owner(piece) {
  return piece ? piece[0] : null;
}

function isKing(piece) {
  return piece === 'XK' || piece === 'OK';
}

function playerMark(room, userId) {
  if (room.players.X && room.players.X.id === userId) return 'X';
  if (room.players.O && room.players.O.id === userId) return 'O';
  return null;
}

function pathClear(board, from, to) {
  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(to);
  const stepR = Math.sign(tr - fr);
  const stepC = Math.sign(tc - fc);
  let row = fr + stepR;
  let col = fc + stepC;
  let occupied = [];
  while (row !== tr || col !== tc) {
    const idx = rcToIndex(row, col);
    if (board[idx]) occupied.push(idx);
    row += stepR;
    col += stepC;
  }
  return occupied;
}

function validateMove(room, mark, from, to) {
  const { board } = room.state;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 64 || to < 0 || to >= 64) return { error: 'Geçersiz kare.' };
  const piece = board[from];
  if (!piece || owner(piece) !== mark) return { error: 'Kendi taşını seçmelisin.' };
  if (board[to]) return { error: 'Hedef kare dolu.' };
  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(to);
  const dr = tr - fr;
  const dc = tc - fc;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  const forward = mark === 'X' ? -1 : 1;
  const diagonal = room.variant === 'capraz';

  if (isKing(piece)) {
    const validLine = diagonal ? absR === absC : absR === 0 || absC === 0;
    if (!validLine) return { error: 'Dama taşı bu yönde gidemez.' };
    const occupied = pathClear(board, from, to);
    if (occupied.length > 1) return { error: 'Yolda birden fazla taş var.' };
    if (occupied.length === 1 && owner(board[occupied[0]]) === mark) return { error: 'Kendi taşının üstünden geçemezsin.' };
    return { captured: occupied.length ? occupied[0] : null };
  }

  const validStep = diagonal
    ? absR === 1 && absC === 1 && dr === forward
    : ((absR === 1 && absC === 0 && dr === forward) || (absR === 0 && absC === 1));
  const validCapture = diagonal ? absR === 2 && absC === 2 : ((absR === 2 && absC === 0) || (absR === 0 && absC === 2));
  if (validCapture) {
    const mid = rcToIndex(fr + dr / 2, fc + dc / 2);
    if (!board[mid] || owner(board[mid]) === mark) return { error: 'Arada rakip taş yok.' };
    return { captured: mid };
  }
  if (!validStep) return { error: 'Geçersiz hamle.' };
  return { captured: null };
}

function applyMove(room, mark, from, to) {
  const result = validateMove(room, mark, from, to);
  if (result.error) return result;
  const board = room.state.board;
  const piece = board[from];
  board[to] = piece;
  board[from] = null;
  if (result.captured !== null) board[result.captured] = null;
  const [row] = indexToRc(to);
  if (piece === 'X' && row === 0) board[to] = 'XK';
  if (piece === 'O' && row === 7) board[to] = 'OK';
  const other = opponent(mark);
  if (!board.some((cell) => owner(cell) === other) || !legalMoves(room, other).length) {
    room.status = 'finished';
    room.state.winner = mark;
  } else {
    room.state.turn = other;
  }
  room.state.lastMove = { mark, from, to, captured: result.captured };
  return {};
}

function legalMoves(room, mark) {
  const moves = [];
  room.state.board.forEach((piece, from) => {
    if (!piece || owner(piece) !== mark) return;
    for (let to = 0; to < 64; to += 1) {
      if (!validateMove(room, mark, from, to).error) moves.push({ from, to });
    }
  });
  return moves;
}

function chooseBotMove(room, mark) {
  const moves = legalMoves(room, mark);
  if (!moves.length) return null;
  const captures = moves.filter((move) => validateMove(room, mark, move.from, move.to).captured !== null);
  const pool = captures.length ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

function runBotTurn(room) {
  if (room.status !== 'playing' || !isBot(room.players[room.state.turn])) return;
  const mark = room.state.turn;
  const move = chooseBotMove(room, mark);
  if (!move) return;
  applyMove(room, mark, move.from, move.to);
  room.updatedAt = Date.now();
}

function touch(room, userId) {
  const mark = playerMark(room, userId);
  if (mark) room.lastSeen[mark] = Date.now();
  room.updatedAt = Date.now();
  return mark;
}

function checkDisconnect(room) {
  if (room.status !== 'playing') return;
  const now = Date.now();
  for (const mark of ['X', 'O']) {
    const player = room.players[mark];
    if (!player || isBot(player)) continue;
    if (now - Number(room.lastSeen[mark] || 0) > DISCONNECT_TIMEOUT_MS) {
      const winner = opponent(mark);
      if (room.players[winner]) {
        room.status = 'finished';
        room.state.winner = winner;
        room.finishReason = `${player.name} odadan düştü. ${room.players[winner].name} hükmen kazandı.`;
      }
    }
  }
}

function publicState(room, userId) {
  checkDisconnect(room);
  const mark = playerMark(room, userId);
  return {
    code: room.code,
    variant: room.variant,
    title: variantTitle(room.variant),
    status: room.status,
    players: room.players,
    mark,
    legalMoves: mark ? legalMoves(room, mark) : [],
    state: room.state,
    finishReason: room.finishReason || ''
  };
}

function getRoom(req, res) {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Oda bulunamadı.' });
    return null;
  }
  return room;
}

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  });
}, 1000 * 60 * 15).unref();

app.get('/api/me', requireYearbookUser, (req, res) => {
  res.json({ player: makePlayer(req), variant: variantFromReq(req), title: variantTitle(variantFromReq(req)) });
});

app.get('/api/rooms', requireYearbookUser, (req, res) => {
  const variant = variantFromReq(req);
  const now = Date.now();
  const list = Array.from(rooms.values())
    .filter((room) => room.variant === variant && room.status === 'waiting' && now - room.updatedAt <= ROOM_TTL_MS)
    .map((room) => ({ code: room.code, hostName: room.players.X.name, createdAt: room.createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
  res.json({ rooms: list });
});

app.post('/api/rooms', requireYearbookUser, (req, res) => {
  const player = makePlayer(req);
  const now = Date.now();
  const bot = req.body && req.body.bot === true;
  const room = {
    code: createCode(),
    variant: variantFromReq(req),
    status: bot ? 'playing' : 'waiting',
    players: { X: player, O: bot ? makeBot() : null },
    lastSeen: { X: now, O: bot ? now : null },
    state: createRoomState(),
    finishReason: '',
    createdAt: now,
    updatedAt: now
  };
  rooms.set(room.code, room);
  res.json(publicState(room, player.id));
});

app.post('/api/rooms/:code/join', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const player = makePlayer(req);
  const existing = playerMark(room, player.id);
  if (existing) {
    touch(room, player.id);
    return res.json(publicState(room, player.id));
  }
  if (room.players.O) return res.status(409).json({ error: 'Bu oda dolu.' });
  room.players.O = player;
  room.lastSeen.O = Date.now();
  room.status = 'playing';
  room.updatedAt = Date.now();
  res.json(publicState(room, player.id));
});

app.get('/api/rooms/:code', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  touch(room, String(req.currentUser.id));
  res.json(publicState(room, String(req.currentUser.id)));
});

app.post('/api/rooms/:code/move', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const userId = String(req.currentUser.id);
  const mark = touch(room, userId);
  checkDisconnect(room);
  if (room.status !== 'playing') return res.status(400).json({ error: 'Oyun başlamadı.' });
  if (!mark) return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  if (room.state.turn !== mark) return res.status(400).json({ error: 'Sıra sende değil.' });
  const result = applyMove(room, mark, Number(req.body.from), Number(req.body.to));
  if (result.error) return res.status(400).json({ error: result.error });
  runBotTurn(room);
  room.updatedAt = Date.now();
  res.json(publicState(room, userId));
});

app.get(/^\/(?!api).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
