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

function createCode() {
  let code = '';
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function createBoard() {
  const board = Array(64).fill(null);
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let col = 0; col < 8; col += 1) {
    board[col] = `O${back[col]}`;
    board[8 + col] = 'OP';
    board[48 + col] = 'XP';
    board[56 + col] = `X${back[col]}`;
  }
  return board;
}

function createState() {
  return {
    board: createBoard(),
    turn: 'X',
    winner: null,
    lastMove: null,
    enPassant: null,
    castling: {
      X: { king: true, queen: true },
      O: { king: true, queen: true }
    }
  };
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

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
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
  while (row !== tr || col !== tc) {
    if (board[rcToIndex(row, col)]) return false;
    row += stepR;
    col += stepC;
  }
  return true;
}

function kingSquare(board, mark) {
  return board.findIndex((piece) => piece === `${mark}K`);
}

function attacksSquare(board, attacker, from, target, state) {
  const piece = board[from];
  if (!piece || owner(piece) !== attacker) return false;
  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(target);
  const dr = tr - fr;
  const dc = tc - fc;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  const kind = piece[1];
  const forward = attacker === 'X' ? -1 : 1;
  if (kind === 'P') return absC === 1 && dr === forward;
  if (kind === 'N') return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
  if (kind === 'B') return absR === absC && pathClear(board, from, target);
  if (kind === 'R') return (absR === 0 || absC === 0) && pathClear(board, from, target);
  if (kind === 'Q') return (absR === absC || absR === 0 || absC === 0) && pathClear(board, from, target);
  if (kind === 'K') return absR <= 1 && absC <= 1;
  return false;
}

function isInCheck(state, mark) {
  const square = kingSquare(state.board, mark);
  if (square < 0) return true;
  const enemy = opponent(mark);
  return state.board.some((piece, index) => owner(piece) === enemy && attacksSquare(state.board, enemy, index, square, state));
}

function buildMoveState(state, mark, from, to) {
  const board = state.board;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 64 || to < 0 || to >= 64) return { error: 'Geçersiz kare.' };
  const piece = board[from];
  const target = board[to];
  if (!piece || owner(piece) !== mark) return { error: 'Kendi taşını seçmelisin.' };
  if (target && owner(target) === mark) return { error: 'Kendi taşını alamazsın.' };

  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(to);
  const dr = tr - fr;
  const dc = tc - fc;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  const kind = piece[1];
  const forward = mark === 'X' ? -1 : 1;
  const startRow = mark === 'X' ? 6 : 1;
  const next = cloneState(state);
  next.lastMove = null;
  let valid = false;
  let captured = target || null;
  let special = null;
  if (kind === 'P') {
    valid = (!target && dc === 0 && dr === forward)
      || (!target && dc === 0 && fr === startRow && dr === forward * 2 && !board[rcToIndex(fr + forward, fc)])
      || (target && absC === 1 && dr === forward)
      || (!target && absC === 1 && dr === forward && state.enPassant === to);
    if (valid && !target && absC === 1 && state.enPassant === to) {
      const capturedIndex = rcToIndex(fr, tc);
      captured = board[capturedIndex];
      if (captured !== `${opponent(mark)}P`) return { error: 'Geçersiz en passant.' };
      next.board[capturedIndex] = null;
      special = 'en-passant';
    }
  }
  if (kind === 'N') valid = (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
  if (kind === 'B') valid = absR === absC;
  if (kind === 'R') valid = absR === 0 || absC === 0;
  if (kind === 'Q') valid = absR === absC || absR === 0 || absC === 0;
  if (kind === 'K') {
    valid = absR <= 1 && absC <= 1;
    if (!valid && fr === tr && absC === 2) {
      const side = dc > 0 ? 'king' : 'queen';
      const rookFrom = dc > 0 ? rcToIndex(fr, 7) : rcToIndex(fr, 0);
      const rookTo = dc > 0 ? rcToIndex(fr, 5) : rcToIndex(fr, 3);
      const between = dc > 0 ? [rcToIndex(fr, 5), rcToIndex(fr, 6)] : [rcToIndex(fr, 1), rcToIndex(fr, 2), rcToIndex(fr, 3)];
      const transit = dc > 0 ? [from, rcToIndex(fr, 5), to] : [from, rcToIndex(fr, 3), to];
      if (
        state.castling?.[mark]?.[side]
        && board[rookFrom] === `${mark}R`
        && between.every((index) => !board[index])
        && transit.every((index) => !state.board.some((enemyPiece, enemyIndex) => owner(enemyPiece) === opponent(mark) && attacksSquare(state.board, opponent(mark), enemyIndex, index, state)))
      ) {
        valid = true;
        next.board[rookTo] = next.board[rookFrom];
        next.board[rookFrom] = null;
        special = `castle-${side}`;
      }
    }
  }
  if (!valid) return { error: 'Bu taş böyle gidemez.' };
  if (['B', 'R', 'Q'].includes(kind) && !pathClear(board, from, to)) return { error: 'Yol kapalı.' };
  next.board[to] = piece;
  next.board[from] = null;
  if (piece === 'XP' && Math.floor(to / 8) === 0) next.board[to] = 'XQ';
  if (piece === 'OP' && Math.floor(to / 8) === 7) next.board[to] = 'OQ';
  next.enPassant = kind === 'P' && Math.abs(dr) === 2 ? rcToIndex(fr + forward, fc) : null;
  if (kind === 'K') {
    next.castling[mark].king = false;
    next.castling[mark].queen = false;
  }
  if (kind === 'R') {
    if (from === rcToIndex(mark === 'X' ? 7 : 0, 0)) next.castling[mark].queen = false;
    if (from === rcToIndex(mark === 'X' ? 7 : 0, 7)) next.castling[mark].king = false;
  }
  if (captured && captured[1] === 'R') {
    const enemy = opponent(mark);
    if (to === rcToIndex(enemy === 'X' ? 7 : 0, 0)) next.castling[enemy].queen = false;
    if (to === rcToIndex(enemy === 'X' ? 7 : 0, 7)) next.castling[enemy].king = false;
  }
  if (isInCheck(next, mark)) return { error: 'Şahını açıkta bırakamazsın.' };
  return { captured, nextState: next, special };
}

function validateMove(room, mark, from, to) {
  return buildMoveState(room.state, mark, from, to);
}

function applyMove(room, mark, from, to) {
  const result = buildMoveState(room.state, mark, from, to);
  if (result.error) return result;
  room.state = result.nextState;
  const target = result.captured;
  if (target && target[1] === 'K') {
    room.status = 'finished';
    room.state.winner = mark;
  } else {
    const other = opponent(mark);
    const otherMoves = legalMoves(room, other);
    if (!room.state.board.some((cell) => cell === `${other}K`)) {
      room.status = 'finished';
      room.state.winner = mark;
      room.finishReason = `${room.players[mark]?.name || mark} rakip şahı aldı.`;
    } else if (!otherMoves.length) {
      room.status = 'finished';
      if (isInCheck(room.state, other)) {
        room.state.winner = mark;
        room.finishReason = `${room.players[mark]?.name || mark} şah mat yaptı.`;
      } else {
        room.state.winner = 'draw';
        room.finishReason = 'Pat oluştu.';
      }
    } else {
      room.state.turn = other;
    }
  }
  room.state.lastMove = { mark, from, to, captured: target || null, special: result.special || null };
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

function pieceValue(piece) {
  if (!piece) return 0;
  return { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 }[piece[1]] || 0;
}

function chooseBotMove(room, mark) {
  const moves = legalMoves(room, mark);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const target = room.state.board[move.to];
    const score = pieceValue(target) + Math.random() * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
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
  res.json({ player: makePlayer(req) });
});

app.get('/api/rooms', requireYearbookUser, (req, res) => {
  const now = Date.now();
  const list = Array.from(rooms.values())
    .filter((room) => room.status === 'waiting' && now - room.updatedAt <= ROOM_TTL_MS)
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
    status: bot ? 'playing' : 'waiting',
    players: { X: player, O: bot ? makeBot() : null },
    lastSeen: { X: now, O: bot ? now : null },
    state: createState(),
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
