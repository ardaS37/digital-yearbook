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

function createState() {
  return {
    pits: { X: [5, 5, 5, 5, 5], O: [5, 5, 5, 5, 5] },
    stores: { X: 0, O: 0 },
    round: 1,
    lastMove: null,
    turn: 'X',
    winner: null
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

function nextMark(mark) {
  return opponent(mark);
}

function buildRing(pitCount) {
  return [
    ...Array.from({ length: pitCount }, (_, index) => ['X', index]),
    ...Array.from({ length: pitCount }, (_, index) => ['O', pitCount - 1 - index])
  ];
}

function captureTwos(state, actionLog) {
  let capturedAny = false;
  for (const side of ['X', 'O']) {
    for (let pit = 0; pit < state.pits[side].length; pit += 1) {
      if (state.pits[side][pit] === 2) {
        state.pits[side][pit] = 0;
        state.stores[side] += 2;
        actionLog.push(`${side}${pit + 1} kuyusundaki 2 taş ${side} hazinesine gitti.`);
        capturedAny = true;
      }
    }
  }
  return capturedAny;
}

function seedPits(total, pitCount) {
  const pits = Array(pitCount).fill(0);
  let remaining = total;
  for (let index = 0; index < pitCount; index += 1) {
    if (remaining <= 0) break;
    if (index === pitCount - 1) pits[index] = remaining;
    else {
      pits[index] = Math.min(5, remaining);
      remaining -= pits[index];
    }
  }
  return pits;
}

function finishRound(room, actionLog) {
  const state = room.state;
  state.stores.X += state.pits.X.reduce((sum, value) => sum + value, 0);
  state.stores.O += state.pits.O.reduce((sum, value) => sum + value, 0);
  const totalX = state.stores.X;
  const totalO = state.stores.O;

  if (totalX === 0 || totalO === 0) {
    room.status = 'finished';
    state.winner = totalX === totalO ? 'draw' : totalX > totalO ? 'X' : 'O';
    actionLog.push(state.winner === 'draw' ? 'Tum taşlar toplandı, oyun berabere bitti.' : `Tum taşlar toplandı, ${state.winner} kazandı.`);
    return;
  }

  const pitCount = Math.max(1, Math.ceil(Math.min(totalX, totalO) / 5));
  state.pits.X = seedPits(totalX, pitCount);
  state.pits.O = seedPits(totalO, pitCount);
  state.stores.X = 0;
  state.stores.O = 0;
  state.round += 1;
  state.turn = 'X';
  actionLog.push(`${state.round}. tur ${pitCount} kuyu ile başladı.`);
}

function applyMangalaMove(room, mark, pit) {
  const state = room.state;
  const pitCount = state.pits[mark].length;
  if (!Number.isInteger(pit) || pit < 0 || pit >= pitCount) return { error: 'Geçersiz kuyu.' };
  if (state.pits[mark][pit] <= 0) return { error: 'Boş kuyu seçilemez.' };

  const actionLog = [];
  const ring = buildRing(pitCount);
  let pos = ring.findIndex(([side, index]) => side === mark && index === pit);
  let stones = state.pits[mark][pit];
  state.pits[mark][pit] = 0;
  let last = null;

  while (stones > 0) {
    pos = (pos + 1) % ring.length;
    const [side, index] = ring[pos];
    state.pits[side][index] += 1;
    last = [side, index];
    stones -= 1;

    const capturedTwos = captureTwos(state, actionLog);
    if (stones === 0) {
      if (capturedTwos && state.pits[side][index] === 0) break;
      const landedCount = state.pits[side][index];
      if (landedCount > 1) {
        stones = landedCount;
        state.pits[side][index] = 0;
        actionLog.push(`${side}${index + 1} kuyusundaki ${landedCount} taş alınıp dağıtım sürdü.`);
      } else if (landedCount === 1) {
        const oppositeIndex = pitCount - 1 - index;
        const oppositeSide = opponent(side);
        const oppositeCount = state.pits[oppositeSide][oppositeIndex] || 0;
        if (oppositeCount > 0) {
          state.pits[side][index] = 0;
          state.pits[oppositeSide][oppositeIndex] = 0;
          state.stores[mark] += oppositeCount + 1;
          actionLog.push(`Boş kuyu yakalandı, ${oppositeCount + 1} taş ${mark} hazinesine gitti.`);
        } else {
          actionLog.push(`Dağıtım ${side}${index + 1} boş kuyusunda durdu.`);
        }
      }
    }
  }

  const xEmpty = state.pits.X.every((n) => n === 0);
  const oEmpty = state.pits.O.every((n) => n === 0);
  if (xEmpty || oEmpty) finishRound(room, actionLog);
  else state.turn = nextMark(mark);

  state.lastMove = { mark, pit, last, action: actionLog.join(' ') || 'Hamle tamamlandı.', extraTurn: false };
  return {};
}
function legalMoves(room, mark) {
  return room.state.pits[mark]
    .map((stones, pit) => ({ stones, pit }))
    .filter(({ stones }) => stones > 0)
    .map(({ pit }) => pit);
}

function chooseBotMove(room, mark) {
  const moves = legalMoves(room, mark);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const pit of moves) {
    const copy = JSON.parse(JSON.stringify(room));
    const before = copy.state.stores[mark];
    applyMangalaMove(copy, mark, pit);
    const gained = copy.state.stores[mark] - before;
    if (gained > bestScore) {
      bestScore = gained;
      best = pit;
    }
  }
  return best;
}

function runBotTurn(room) {
  let safety = 0;
  while (room.status === 'playing' && isBot(room.players[room.state.turn]) && safety < 24) {
    const mark = room.state.turn;
    const pit = chooseBotMove(room, mark);
    if (pit === null) return;
    const result = applyMangalaMove(room, mark, pit);
    if (result && result.error) return;
    room.updatedAt = Date.now();
    safety += 1;
    if (!room.state.lastMove || !room.state.lastMove.extraTurn) break;
  }
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
  const result = applyMangalaMove(room, mark, Number(req.body.pit));
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
