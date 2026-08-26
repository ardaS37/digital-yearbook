const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const DISCONNECT_TIMEOUT_MS = 1000 * 30;
const CODE_LEN = 5;
const COLOR_COUNT = 8;
const MAX_GUESSES = 12;

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

function createSecret() {
  return Array.from({ length: CODE_LEN }, () => Math.floor(Math.random() * COLOR_COUNT));
}

function createState(bot = false) {
  return {
    secret: bot ? createSecret() : null,
    guesses: [],
    turn: 'X',
    phase: bot ? 'guessing' : 'setting',
    codemaker: 'X',
    guesser: bot ? 'X' : 'O',
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

function scoreGuess(secret, guess) {
  let exact = 0;
  const secretCounts = Array(COLOR_COUNT).fill(0);
  const guessCounts = Array(COLOR_COUNT).fill(0);
  for (let i = 0; i < CODE_LEN; i += 1) {
    if (secret[i] === guess[i]) exact += 1;
    else {
      secretCounts[secret[i]] += 1;
      guessCounts[guess[i]] += 1;
    }
  }
  let misplaced = 0;
  for (let i = 0; i < COLOR_COUNT; i += 1) misplaced += Math.min(secretCounts[i], guessCounts[i]);
  return { exact, misplaced };
}

function applySecret(room, mark, secret) {
  if (room.state.phase !== 'setting') return { error: 'Gizli kod zaten belirlendi.' };
  if (mark !== room.state.codemaker) return { error: 'Gizli kodu sadece kod kurucu belirler.' };
  if (!Array.isArray(secret) || secret.length !== CODE_LEN) return { error: '5 renk seçmelisin.' };
  const normalized = secret.map(Number);
  if (normalized.some((item) => !Number.isInteger(item) || item < 0 || item >= COLOR_COUNT)) return { error: 'Geçersiz renk.' };
  room.state.secret = normalized;
  room.state.phase = 'guessing';
  room.state.turn = room.state.guesser;
  room.state.lastMove = null;
  return {};
}

function applyGuess(room, mark, guess) {
  if (room.state.phase !== 'guessing') return { error: 'Önce gizli kod belirlenmeli.' };
  if (mark !== room.state.guesser) return { error: 'Tahmini sadece tahminci yapabilir.' };
  if (!Array.isArray(guess) || guess.length !== CODE_LEN) return { error: '5 renk seçmelisin.' };
  const normalized = guess.map(Number);
  if (normalized.some((item) => !Number.isInteger(item) || item < 0 || item >= COLOR_COUNT)) return { error: 'Geçersiz renk.' };
  const result = scoreGuess(room.state.secret, normalized);
  const entry = { mark, guess: normalized, ...result, number: room.state.guesses.length + 1 };
  room.state.guesses.push(entry);
  room.state.lastMove = entry;
  if (result.exact === CODE_LEN) {
    room.status = 'finished';
    room.state.winner = mark;
  } else if (room.state.guesses.length >= MAX_GUESSES) {
    room.status = 'finished';
    room.state.winner = room.state.codemaker;
    room.finishReason = 'Tahmin hakkı bitti. Kod kurucu kazandı.';
  } else {
    room.state.turn = room.state.guesser;
  }
  return {};
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
  const finished = room.status === 'finished';
  return {
    code: room.code,
    status: room.status,
    players: room.players,
    mark: playerMark(room, userId),
    colorCount: COLOR_COUNT,
    codeLength: CODE_LEN,
    maxGuesses: MAX_GUESSES,
    state: {
      guesses: room.state.guesses,
      turn: room.state.turn,
      phase: room.state.phase,
      codemaker: room.state.codemaker,
      guesser: room.state.guesser,
      winner: room.state.winner,
      lastMove: room.state.lastMove,
      secret: finished || playerMark(room, userId) === room.state.codemaker ? room.state.secret : null
    },
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
    state: createState(bot),
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
  const result = room.state.phase === 'setting'
    ? applySecret(room, mark, req.body.secret)
    : applyGuess(room, mark, req.body.guess);
  if (result.error) return res.status(400).json({ error: result.error });
  room.updatedAt = Date.now();
  res.json(publicState(room, userId));
});

app.get(/^\/(?!api).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
