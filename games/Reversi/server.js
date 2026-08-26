const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const DISCONNECT_TIMEOUT_MS = 1000 * 30;
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Yıllık hesabıyla giriş yapmalısın.' });
  }
  return next();
}

function makePlayer(req) {
  return {
    id: String(req.currentUser.id),
    name: req.currentUser.name || req.currentUser.login_identifier || `Oyuncu ${req.currentUser.id}`
  };
}

function createBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[3][3] = 'W';
  board[3][4] = 'B';
  board[4][3] = 'B';
  board[4][4] = 'W';
  return board;
}

function isOnBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function opponent(color) {
  return color === 'B' ? 'W' : 'B';
}

function getFlips(board, row, col, color) {
  if (!isOnBoard(row, col) || board[row][col]) return [];
  const other = opponent(color);
  const flips = [];

  DIRECTIONS.forEach(([dr, dc]) => {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (isOnBoard(r, c) && board[r][c] === other) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length && isOnBoard(r, c) && board[r][c] === color) {
      flips.push(...line);
    }
  });

  return flips;
}

function getValidMoves(board, color) {
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const flips = getFlips(board, row, col, color);
      if (flips.length) moves.push({ row, col, flips: flips.length });
    }
  }
  return moves;
}

function countPieces(board) {
  return board.flat().reduce(
    (acc, cell) => {
      if (cell === 'B') acc.black += 1;
      if (cell === 'W') acc.white += 1;
      return acc;
    },
    { black: 0, white: 0 }
  );
}

function updateRoomStatus(room) {
  const blackMoves = getValidMoves(room.board, 'B');
  const whiteMoves = getValidMoves(room.board, 'W');
  if (!blackMoves.length && !whiteMoves.length) {
    const score = countPieces(room.board);
    room.status = 'finished';
    room.winner = score.black === score.white ? 'draw' : score.black > score.white ? 'B' : 'W';
    return;
  }
  if (!getValidMoves(room.board, room.turn).length) {
    room.turn = opponent(room.turn);
  }
}

function applyMove(board, row, col, color) {
  const flips = getFlips(board, row, col, color);
  if (!flips.length) return false;
  board[row][col] = color;
  flips.forEach(([r, c]) => {
    board[r][c] = color;
  });
  return true;
}

function createRoomCode() {
  let code = '';
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function publicRoomState(room, userId) {
  checkDisconnect(room);
  const score = countPieces(room.board);
  const color = room.players.B && room.players.B.id === userId ? 'B' : room.players.W && room.players.W.id === userId ? 'W' : null;
  return {
    code: room.code,
    board: room.board,
    turn: room.turn,
    status: room.status,
    winner: room.winner,
    finishReason: room.finishReason || '',
    score,
    color,
    players: room.players,
    validMoves: color ? getValidMoves(room.board, color).map(({ row, col }) => ({ row, col })) : [],
    turnMoves: getValidMoves(room.board, room.turn).map(({ row, col }) => ({ row, col }))
  };
}

function getRoom(req, res) {
  const code = String(req.params.code || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: 'Oda bulunamadı.' });
    return null;
  }
  room.updatedAt = Date.now();
  return room;
}

function playerColor(room, userId) {
  if (room.players.B && room.players.B.id === userId) return 'B';
  if (room.players.W && room.players.W.id === userId) return 'W';
  return null;
}

function touchPlayer(room, userId) {
  const color = playerColor(room, userId);
  if (color) room.lastSeen[color] = Date.now();
  room.updatedAt = Date.now();
  return color;
}

function checkDisconnect(room) {
  if (room.status !== 'playing' || !room.players.B || !room.players.W) return;
  const now = Date.now();
  const blackStale = now - Number(room.lastSeen.B || 0) > DISCONNECT_TIMEOUT_MS;
  const whiteStale = now - Number(room.lastSeen.W || 0) > DISCONNECT_TIMEOUT_MS;
  if (blackStale && !whiteStale) {
    room.status = 'finished';
    room.winner = 'W';
    room.finishReason = `${room.players.B.name} odadan düştü. Beyaz hükmen kazandı.`;
  } else if (whiteStale && !blackStale) {
    room.status = 'finished';
    room.winner = 'B';
    room.finishReason = `${room.players.W.name} odadan düştü. Siyah hükmen kazandı.`;
  }
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
  const openRooms = Array.from(rooms.values())
    .filter((room) => room.status === 'waiting' && now - room.updatedAt <= ROOM_TTL_MS)
    .map((room) => ({
      code: room.code,
      hostName: room.players.B ? room.players.B.name : 'Bilinmiyor',
      createdAt: room.createdAt
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
  res.json({ rooms: openRooms });
});

app.post('/api/rooms', requireYearbookUser, (req, res) => {
  const player = makePlayer(req);
  const now = Date.now();
  const code = createRoomCode();
  const room = {
    code,
    board: createBoard(),
    turn: 'B',
    status: 'waiting',
    winner: null,
    finishReason: '',
    players: { B: player, W: null },
    lastSeen: { B: now, W: null },
    createdAt: now,
    updatedAt: now
  };
  rooms.set(code, room);
  res.json(publicRoomState(room, player.id));
});

app.post('/api/rooms/:code/join', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const player = makePlayer(req);

  if (room.players.B && room.players.B.id === player.id) {
    touchPlayer(room, player.id);
    return res.json(publicRoomState(room, player.id));
  }
  if (room.players.W && room.players.W.id !== player.id) {
    return res.status(409).json({ error: 'Bu oda dolu.' });
  }
  room.players.W = player;
  room.lastSeen.W = Date.now();
  room.status = 'playing';
  room.updatedAt = Date.now();
  return res.json(publicRoomState(room, player.id));
});

app.get('/api/rooms/:code', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  touchPlayer(room, String(req.currentUser.id));
  res.json(publicRoomState(room, String(req.currentUser.id)));
});

app.post('/api/rooms/:code/move', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  touchPlayer(room, String(req.currentUser.id));
  checkDisconnect(room);
  if (room.status !== 'playing') return res.status(400).json({ error: 'Oyun henüz başlamadı.' });

  const userId = String(req.currentUser.id);
  const color = room.players.B && room.players.B.id === userId ? 'B' : room.players.W && room.players.W.id === userId ? 'W' : null;
  if (!color) return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  if (room.turn !== color) return res.status(400).json({ error: 'Sıra sende değil.' });

  const row = Number(req.body.row);
  const col = Number(req.body.col);
  if (!Number.isInteger(row) || !Number.isInteger(col) || !applyMove(room.board, row, col, color)) {
    return res.status(400).json({ error: 'Geçersiz hamle.' });
  }

  room.turn = opponent(color);
  room.updatedAt = Date.now();
  room.finishReason = '';
  updateRoomStatus(room);
  return res.json(publicRoomState(room, userId));
});

app.post('/api/rooms/:code/reset', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const userId = String(req.currentUser.id);
  if (![room.players.B && room.players.B.id, room.players.W && room.players.W.id].includes(userId)) {
    return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  }
  room.board = createBoard();
  room.turn = 'B';
  room.status = room.players.W ? 'playing' : 'waiting';
  room.winner = null;
  room.finishReason = '';
  room.lastSeen = { B: Date.now(), W: room.players.W ? Date.now() : null };
  room.updatedAt = Date.now();
  return res.json(publicRoomState(room, userId));
});

app.get(/^\/(?!api).*/, (req, res) => {
  if (!req.currentUser) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
