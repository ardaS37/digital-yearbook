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
    pits: { X: [4, 4, 4, 4, 4, 4], O: [4, 4, 4, 4, 4, 4] },
    stores: { X: 0, O: 0 },
    castles: { X: null, O: null },
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

function castleOwnerForPit(state, side, pit) {
  const owner = Object.entries(state.castles || {}).find(([mark, castlePit]) => {
    return castlePit === pit && side === opponent(mark);
  });
  return owner ? owner[0] : null;
}

function applyMangalaMove(room, mark, pit) {
  const state = room.state;
  if (!Number.isInteger(pit) || pit < 0 || pit > 5) return { error: 'Geçersiz kuyu.' };
  if (state.pits[mark][pit] <= 0) return { error: 'Boş kuyu seçilemez.' };

  const other = opponent(mark);
  const ring = [
    ['X', 0], ['X', 1], ['X', 2], ['X', 3], ['X', 4], ['X', 5], ['XS', 0],
    ['O', 5], ['O', 4], ['O', 3], ['O', 2], ['O', 1], ['O', 0], ['OS', 0]
  ];
  let stones = state.pits[mark][pit];
  let pos = ring.findIndex(([side, index]) => side === mark && index === pit);
  let last = null;
  let action = 'Dağıtıldı.';

  state.pits[mark][pit] = 0;
  if (stones > 1) {
    state.pits[mark][pit] = 1;
    stones -= 1;
  }

  while (stones > 0) {
    pos = (pos + 1) % ring.length;
    const [targetSide, targetPit] = ring[pos];
    if (targetSide === `${other}S`) continue;

    if (targetSide === `${mark}S`) {
      state.stores[mark] += 1;
      last = [targetSide, targetPit];
      stones -= 1;
      continue;
    }

    const castleOwner = castleOwnerForPit(state, targetSide, targetPit);
    if (castleOwner) {
      state.stores[castleOwner] += 1;
      action = `${castleOwner} kalesine taş düştü.`;
    } else {
      state.pits[targetSide][targetPit] += 1;
    }
    last = [targetSide, targetPit];
    stones -= 1;
  }

  const extraTurn = Boolean(last && last[0] === `${mark}S`);

  if (!extraTurn && last && last[0] === other && state.pits[other][last[1]] > 0 && state.pits[other][last[1]] % 2 === 0) {
    const won = state.pits[other][last[1]];
    state.stores[mark] += won;
    state.pits[other][last[1]] = 0;
    action = `Rakip kuyuda çift oldu, ${won} taş alındı.`;
  } else if (!extraTurn && last && last[0] === mark && state.pits[mark][last[1]] === 1) {
    const opposite = 5 - last[1];
    const captured = state.pits[other][opposite];
    if (captured > 0) {
      state.pits[other][opposite] = 0;
      state.pits[mark][last[1]] = 0;
      state.stores[mark] += captured + 1;
      action = `Boş kuyu yakaladı, ${captured + 1} taş alındı.`;
    }
  } else if (!extraTurn && last && last[0] === other && state.pits[other][last[1]] === 3 && state.castles[mark] === null) {
    state.castles[mark] = last[1];
    state.stores[mark] += 3;
    state.pits[other][last[1]] = 0;
    action = `${mark} kale kurdu.`;
  } else if (extraTurn) {
    action = 'Son taş hazineye geldi, tekrar oynama hakkı.';
  }

  const xEmpty = state.pits.X.every((n) => n === 0);
  const oEmpty = state.pits.O.every((n) => n === 0);
  if (xEmpty || oEmpty) {
    if (xEmpty) state.stores.X += state.pits.O.reduce((a, b) => a + b, 0);
    if (oEmpty) state.stores.O += state.pits.X.reduce((a, b) => a + b, 0);
    state.pits.X = [0, 0, 0, 0, 0, 0];
    state.pits.O = [0, 0, 0, 0, 0, 0];
    room.status = 'finished';
    state.winner = state.stores.X === state.stores.O ? 'draw' : state.stores.X > state.stores.O ? 'X' : 'O';
    action = `Oyun bitti. ${state.winner === 'draw' ? 'Berabere.' : `${state.winner} kazandı.`}`;
  } else if (!extraTurn) {
    state.turn = nextMark(mark);
  }

  state.lastMove = { mark, pit, last, action, extraTurn };
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
