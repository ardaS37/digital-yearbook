const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const DISCONNECT_TIMEOUT_MS = 1000 * 30;
const MILLS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];
const NEIGHBORS = {
  0: [1, 3, 4],
  1: [0, 2, 3, 4, 5],
  2: [1, 4, 5],
  3: [0, 1, 4, 6, 7],
  4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [1, 2, 4, 7, 8],
  6: [3, 4, 7],
  7: [3, 4, 5, 6, 8],
  8: [4, 5, 7]
};

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) return res.status(401).json({ error: 'Yillik hesabi ile giris yapmalisin.' });
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

function createState() {
  return {
    board: Array(9).fill(null),
    placed: { X: 0, O: 0 },
    phase: 'placing',
    turn: 'X',
    winner: null
  };
}

function opponent(mark) {
  return mark === 'X' ? 'O' : 'X';
}

function formsMill(board, index, mark) {
  return MILLS.some((line) => line.includes(index) && line.every((pos) => board[pos] === mark));
}

function playerMark(room, userId) {
  if (room.players.X && room.players.X.id === userId) return 'X';
  if (room.players.O && room.players.O.id === userId) return 'O';
  return null;
}

function getRoom(req, res) {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Oda bulunamadi.' });
    return null;
  }
  return room;
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
      room.status = 'finished';
      room.state.winner = winner;
      room.finishReason = `${player.name} odadan dustu. ${room.players[winner].name} hukmen kazandi.`;
      return;
    }
  }
}

function hasMove(state, mark) {
  return state.board.some((cell, from) => cell === mark && NEIGHBORS[from].some((to) => !state.board[to]));
}

function applyMove(room, mark, move) {
  const state = room.state;
  const other = opponent(mark);
  const to = Number(move.to);
  const from = move.from === undefined || move.from === null || move.from === '' ? null : Number(move.from);

  if (!Number.isInteger(to) || to < 0 || to > 8) return { error: 'Gecersiz nokta.' };

  if (state.phase === 'placing') {
    if (state.board[to]) return { error: 'Bu nokta dolu.' };
    state.board[to] = mark;
    state.placed[mark] += 1;
    if (formsMill(state.board, to, mark)) {
      room.status = 'finished';
      state.winner = mark;
      room.finishReason = `${room.players[mark].name} cizgiyi tamamladi.`;
      return {};
    }
    if (state.placed.X >= 3 && state.placed.O >= 3) state.phase = 'moving';
    state.turn = other;
    return {};
  }

  if (!Number.isInteger(from) || from < 0 || from > 8) return { error: 'Hangi tasi oynatacagini secmelisin.' };
  if (state.board[from] !== mark) return { error: 'Kendi tasini secmelisin.' };
  if (state.board[to]) return { error: 'Hedef nokta dolu.' };
  if (!NEIGHBORS[from].includes(to)) return { error: 'Bu tas oraya gidemez.' };

  state.board[from] = null;
  state.board[to] = mark;

  if (formsMill(state.board, to, mark)) {
    room.status = 'finished';
    state.winner = mark;
    room.finishReason = `${room.players[mark].name} cizgiyi tamamladi.`;
    return {};
  }

  if (!hasMove(state, other)) {
    room.status = 'finished';
    state.winner = mark;
    room.finishReason = `${room.players[other].name} hamlesiz kaldi.`;
    return {};
  }

  state.turn = other;
  return {};
}

function publicState(room, userId) {
  checkDisconnect(room);
  return {
    code: room.code,
    status: room.status,
    players: room.players,
    mark: playerMark(room, userId),
    meta: { title: '3 Tas' },
    state: room.state,
    finishReason: room.finishReason || ''
  };
}

function legalMoves(room, mark) {
  const state = room.state;
  if (state.phase === 'placing') {
    return state.board.map((cell, to) => (cell ? null : { to })).filter(Boolean);
  }
  return state.board.flatMap((cell, from) => {
    if (cell !== mark) return [];
    return NEIGHBORS[from].filter((to) => !state.board[to]).map((to) => ({ from, to }));
  });
}

function chooseBotMove(room, mark) {
  const moves = legalMoves(room, mark);
  if (!moves.length) return null;
  for (const item of moves) {
    const preview = JSON.parse(JSON.stringify(room));
    applyMove(preview, mark, item);
    if (preview.state.winner === mark) return item;
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

function runBot(room) {
  if (room.status !== 'playing' || !isBot(room.players[room.state.turn])) return;
  const mark = room.state.turn;
  const move = chooseBotMove(room, mark);
  if (!move) {
    room.status = 'finished';
    room.state.winner = opponent(mark);
    room.finishReason = 'PC hamle bulamadi.';
    return;
  }
  applyMove(room, mark, move);
  room.updatedAt = Date.now();
}

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  });
}, 1000 * 60 * 15).unref();

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
  if (bot) runBot(room);
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
  if (room.status !== 'playing') return res.status(400).json({ error: 'Oyun baslamadi.' });
  if (!mark) return res.status(403).json({ error: 'Bu odanin oyuncusu degilsin.' });
  if (room.state.turn !== mark) return res.status(400).json({ error: 'Sira sende degil.' });
  const result = applyMove(room, mark, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  runBot(room);
  room.updatedAt = Date.now();
  res.json(publicState(room, userId));
});

app.get(/^\/(?!api).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
