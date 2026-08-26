const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const DISCONNECT_TIMEOUT_MS = 1000 * 30;
const ROWS = 6;
const COLS = 7;

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

function createState() {
  return {
    board: Array(ROWS * COLS).fill(null),
    turn: 'X',
    winner: null,
    lastMove: null
  };
}

function opponent(mark) {
  return mark === 'X' ? 'O' : 'X';
}

function playerMark(room, userId) {
  if (room.players.X && room.players.X.id === userId) return 'X';
  if (room.players.O && room.players.O.id === userId) return 'O';
  return null;
}

function index(row, col) {
  return row * COLS + col;
}

function dropRow(board, col) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[index(row, col)]) return row;
  }
  return -1;
}

function winningLine(board, row, col, mark) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line = [[row, col]];
    for (const dir of [-1, 1]) {
      let r = row + dr * dir;
      let c = col + dc * dir;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[index(r, c)] === mark) {
        line.push([r, c]);
        r += dr * dir;
        c += dc * dir;
      }
    }
    if (line.length >= 4) return line.map(([r, c]) => index(r, c));
  }
  return [];
}

function applyMove(room, mark, col) {
  const state = room.state;
  const row = dropRow(state.board, Number(col));
  if (row < 0) return { error: 'Bu sütun dolu veya geçersiz.' };
  const placed = index(row, Number(col));
  state.board[placed] = mark;
  const line = winningLine(state.board, row, Number(col), mark);
  state.lastMove = { mark, row, col: Number(col), index: placed, line };
  if (line.length) {
    room.status = 'finished';
    state.winner = mark;
  } else if (state.board.every(Boolean)) {
    room.status = 'finished';
    state.winner = 'draw';
  } else {
    state.turn = opponent(mark);
  }
  return {};
}

function legalMoves(room) {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) => dropRow(room.state.board, col) >= 0);
}

function wouldWin(room, mark, col) {
  const copy = room.state.board.slice();
  const row = dropRow(copy, col);
  if (row < 0) return false;
  copy[index(row, col)] = mark;
  return winningLine(copy, row, col, mark).length > 0;
}

function simulateBoard(board, mark, col) {
  const copy = board.slice();
  const row = dropRow(copy, col);
  if (row < 0) return null;
  copy[index(row, col)] = mark;
  return { board: copy, row };
}

function evaluateWindow(window, mark) {
  const other = opponent(mark);
  const own = window.filter((cell) => cell === mark).length;
  const opp = window.filter((cell) => cell === other).length;
  const empty = window.filter((cell) => !cell).length;
  if (own && opp) return 0;
  if (own === 4) return 100000;
  if (own === 3 && empty === 1) return 160;
  if (own === 2 && empty === 2) return 26;
  if (opp === 3 && empty === 1) return -180;
  if (opp === 2 && empty === 2) return -18;
  return 0;
}

function evaluateBoard(board, mark) {
  let score = 0;
  const centerCol = 3;
  for (let row = 0; row < ROWS; row += 1) {
    if (board[index(row, centerCol)] === mark) score += 14;
    else if (board[index(row, centerCol)] === opponent(mark)) score -= 12;
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      score += evaluateWindow([0, 1, 2, 3].map((offset) => board[index(row, col + offset)]), mark);
    }
  }
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      score += evaluateWindow([0, 1, 2, 3].map((offset) => board[index(row + offset, col)]), mark);
    }
  }
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      score += evaluateWindow([0, 1, 2, 3].map((offset) => board[index(row + offset, col + offset)]), mark);
    }
  }
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 3; col < COLS; col += 1) {
      score += evaluateWindow([0, 1, 2, 3].map((offset) => board[index(row + offset, col - offset)]), mark);
    }
  }
  return score;
}

function countImmediateWins(board, mark) {
  let total = 0;
  for (let col = 0; col < COLS; col += 1) {
    const next = simulateBoard(board, mark, col);
    if (!next) continue;
    if (winningLine(next.board, next.row, col, mark).length > 0) total += 1;
  }
  return total;
}

function chooseBotMove(room, mark) {
  const moves = legalMoves(room);
  if (!moves.length) return null;
  const other = opponent(mark);
  const winNow = moves.find((col) => wouldWin(room, mark, col));
  if (winNow !== undefined) return winNow;

  const blockNow = moves.find((col) => wouldWin(room, other, col));
  if (blockNow !== undefined) return blockNow;

  const scored = moves.map((col) => {
    const simulated = simulateBoard(room.state.board, mark, col);
    if (!simulated) return null;
    const ownThreats = countImmediateWins(simulated.board, mark);
    const oppThreats = countImmediateWins(simulated.board, other);
    const score =
      evaluateBoard(simulated.board, mark) +
      ownThreats * 320 -
      oppThreats * 280 -
      Math.abs(3 - col) * 8;
    return { col, score, ownThreats, oppThreats };
  }).filter(Boolean);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.ownThreats !== a.ownThreats) return b.ownThreats - a.ownThreats;
    if (a.oppThreats !== b.oppThreats) return a.oppThreats - b.oppThreats;
    return Math.abs(3 - a.col) - Math.abs(3 - b.col);
  });
  return scored[0]?.col ?? (moves.includes(3) ? 3 : moves[Math.floor(Math.random() * moves.length)]);
}

function runBotTurn(room) {
  if (room.status !== 'playing' || !isBot(room.players[room.state.turn])) return;
  const mark = room.state.turn;
  const col = chooseBotMove(room, mark);
  if (col === null) return;
  applyMove(room, mark, col);
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
  return {
    code: room.code,
    status: room.status,
    players: room.players,
    mark: playerMark(room, userId),
    legalMoves: legalMoves(room),
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
  const result = applyMove(room, mark, Number(req.body.col));
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
