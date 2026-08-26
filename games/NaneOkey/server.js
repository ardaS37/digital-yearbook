const path = require('path');
const { createRequire } = require('module');
const crypto = require('crypto');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();

const ROOM_TTL_MS = 1000 * 60 * 60 * 8;
const MARKS = ['X', 'A', 'O', 'B'];
const COLORS = ['red', 'blue', 'black', 'yellow'];
const COLOR_ORDER = { red: 0, blue: 1, black: 2, yellow: 3 };
const OPEN_THRESHOLD = 30;
const rooms = new Map();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Giris yapman gerekiyor.' });
    return res.redirect('/login');
  }
  return next();
}

function renderPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nane Okey</title>
  <link rel="stylesheet" href="/games/nane-okey/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Nane Okey</h1>
        <p>Rummikub tarzı seri kurma oyunu. İlk açılış en az 30 puan olmalı; sonra serileri büyütüp elini tamamen bitirirsin.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel lobby-panel">
      <div class="game-picker">
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="nane-okey">Nane Okey</option>
          <option value="okey">Okey</option>
          <option value="101-okey">101 Okey</option>
          <option value="reversi">Reversi</option>
          <option value="mangala">Mangala</option>
          <option value="kuyulamac">Kuyulamaç</option>
          <option value="alti">Altı</option>
          <option value="go">Go</option>
          <option value="abalone">Abalone</option>
          <option value="tavla">Tavla</option>
          <option value="koridor">Koridor</option>
          <option value="dama">Dama</option>
          <option value="capraz-dama">Çapraz Dama</option>
          <option value="9-tas">9 Taş</option>
          <option value="3-tas">3 Taş</option>
          <option value="domino">Domino</option>
          <option value="kutu-doldurmaca">Kutu Doldurmaca</option>
          <option value="satranc">Satranç</option>
          <option value="xox">XOX</option>
          <option value="sos">SOS</option>
          <option value="dortlu-birlestir">4'lü Birleştir</option>
          <option value="mastermind">Mastermind</option>
          <option value="yilanlar-ve-merdivenler">Yılanlar ve Merdivenler</option>
          <option value="kizma-birader">Kızma Birader</option>
        </select>
      </div>
      <div class="lobby-actions">
        <button id="pc-room" class="primary" type="button">PC'ye Karşı</button>
        <button id="create-room" type="button">4 Kişilik Oda Kur</button>
      </div>
      <form id="join-form" class="join-form">
        <input id="room-code" type="text" maxlength="6" placeholder="Oda kodu" autocomplete="off">
        <button type="submit">Katıl</button>
      </form>
      <div class="open-rooms">
        <div class="open-rooms-head">
          <strong>Açık Odalar</strong>
          <button id="refresh" class="mini" type="button">Yenile</button>
        </div>
        <div id="open-list" class="open-rooms-list">Yükleniyor...</div>
      </div>
    </section>

    <section class="game-layout">
      <aside class="panel side-panel">
        <p class="label">Durum</p>
        <h2 id="room-title">Henüz oda yok</h2>
        <p id="players"></p>
        <div class="stat-grid">
          <div><span>Kalan Taş</span><strong id="wall-count">0</strong></div>
          <div><span>Açılış Eşiği</span><strong>30</strong></div>
          <div><span>İlk Açılış</span><strong id="opened-state">Kapalı</strong></div>
          <div><span>Joker</span><strong>Yok</strong></div>
        </div>
        <div id="message" class="message">Oda kur veya açık odalara katıl.</div>
      </aside>

      <section class="table-panel">
        <div class="table-head">
          <div id="turn-banner" class="turn-banner">Sıra bekleniyor</div>
          <div class="table-actions">
            <button id="draw-wall" type="button">Taş Çek</button>
            <button id="sort-color" type="button">Renge Diz</button>
            <button id="sort-value" type="button">Sayıya Diz</button>
          </div>
        </div>

        <div class="table-seats">
          <div class="seat north"><h3>Kuzey</h3><div id="seat-o" class="seat-cards"></div></div>
          <div class="mid-row">
            <div class="seat west"><h3>Batı</h3><div id="seat-b" class="seat-cards vertical"></div></div>
            <div class="center-area">
              <div class="discard-history">
                <p class="label">Masadaki Seriler</p>
                <div id="table-melds" class="meld-grid"></div>
              </div>
              <div class="controls-note">Seçtiğin taşlarla seri kurarsın. İlk açılış toplamı 30 olmalı. Turunda seri bırakabilir veya hiç oynayamıyorsan taş çekebilirsin.</div>
            </div>
            <div class="seat east"><h3>Doğu</h3><div id="seat-a" class="seat-cards vertical"></div></div>
          </div>
          <div class="seat south active">
            <div class="south-head">
              <h3>Sen</h3>
              <div class="selected-panel">
                <span id="selected-label">Taş seçilmedi</span>
                <button id="play-btn" type="button">Seri Koy</button>
                <button id="finish-btn" class="primary" type="button">Bitir</button>
                <button id="end-turn-btn" type="button">Turu Bitir</button>
              </div>
            </div>
            <div id="hand" class="hand-rack"></div>
          </div>
        </div>
      </section>
    </section>
  </main>
  <script>window.__NANE_OKEY_CONFIG__ = { type: 'nane-okey' };</script>
  <script src="/games/nane-okey/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

function createCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makePlayer(req, mark) {
  const user = req.currentUser || {};
  return {
    id: String(user.id),
    name: user.display_name || user.name || user.username || `Oyuncu ${mark}`,
    mark,
    bot: false
  };
}

function makeBot(mark) {
  return { id: `bot-${mark}`, name: `Bot ${mark}`, mark, bot: true };
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  }
}

function shuffle(items) {
  const list = items.slice();
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

function tileId() {
  return crypto.randomBytes(6).toString('hex');
}

function createDeck() {
  const tiles = [];
  COLORS.forEach((color) => {
    for (let value = 1; value <= 13; value += 1) {
      tiles.push({ id: tileId(), color, value });
      tiles.push({ id: tileId(), color, value });
    }
  });
  return shuffle(tiles);
}

function cloneTile(tile) {
  return JSON.parse(JSON.stringify(tile));
}

function tileLabel(tile) {
  return `${tile.color[0].toUpperCase()}${tile.value}`;
}

function sortHand(hand, mode = 'color') {
  const list = hand.slice();
  list.sort((left, right) => {
    if (mode === 'value') {
      if (left.value !== right.value) return left.value - right.value;
      return (COLOR_ORDER[left.color] || 99) - (COLOR_ORDER[right.color] || 99);
    }
    if ((COLOR_ORDER[left.color] || 99) !== (COLOR_ORDER[right.color] || 99)) {
      return (COLOR_ORDER[left.color] || 99) - (COLOR_ORDER[right.color] || 99);
    }
    if (left.value !== right.value) return left.value - right.value;
    return String(left.id).localeCompare(String(right.id));
  });
  return list;
}

function seatName(mark) {
  return { X: 'Güney', A: 'Doğu', O: 'Kuzey', B: 'Batı' }[mark] || mark;
}

function createInitialState() {
  const state = {
    wall: createDeck(),
    hands: { X: [], A: [], O: [], B: [] },
    turn: 'X',
    winner: null,
    opened: { X: false, A: false, O: false, B: false },
    tableMelds: [],
    sortModes: { X: 'color', A: 'color', O: 'color', B: 'color' },
    turnPlayed: false,
    lastAction: 'Dağıtıldı'
  };
  MARKS.forEach((mark) => {
    state.hands[mark] = sortHand(state.wall.splice(0, 14), 'color');
  });
  return state;
}

function chooseOneByValue(tiles, color, value) {
  return tiles.find((tile) => tile.color === color && tile.value === value);
}

function uniqueColorsForValue(tiles, value) {
  return Array.from(new Set(
    tiles
      .filter((tile) => tile.value === value)
      .map((tile) => tile.color)
  ));
}

function combinations(values, pick, start = 0, prefix = [], output = []) {
  if (prefix.length === pick) {
    output.push(prefix.slice());
    return output;
  }
  for (let index = start; index < values.length; index += 1) {
    prefix.push(values[index]);
    combinations(values, pick, index + 1, prefix, output);
    prefix.pop();
  }
  return output;
}

function generateMeldOptions(tiles) {
  const anchor = tiles[0];
  if (!anchor) return [];
  const options = [];
  const value = anchor.value;
  const sameValueColors = uniqueColorsForValue(tiles, value);
  const otherColors = sameValueColors.filter((color) => color !== anchor.color);

  [3, 4].forEach((groupSize) => {
    if (sameValueColors.length < groupSize) return;
    combinations(otherColors, groupSize - 1).forEach((extraColors) => {
      const meldTiles = [anchor];
      extraColors.forEach((color) => {
        const tile = chooseOneByValue(tiles, color, value);
        if (tile) meldTiles.push(tile);
      });
      if (meldTiles.length === groupSize) {
        options.push({
          type: 'set',
          ids: meldTiles.map((tile) => tile.id),
          score: value * groupSize,
          display: meldTiles.map((tile) => ({ ...cloneTile(tile), label: tileLabel(tile) }))
        });
      }
    });
  });

  for (let start = Math.max(1, anchor.value - 12); start <= anchor.value; start += 1) {
    for (let end = anchor.value; end <= 14; end += 1) {
      if (end === 14 && start < 12) continue;
      const length = end - start + 1;
      if (length < 3) continue;
      const meldTiles = [];
      let valid = true;
      for (let current = start; current <= end; current += 1) {
        const actualValue = current === 14 ? 1 : current;
        const tile = chooseOneByValue(tiles, anchor.color, actualValue);
        if (!tile) {
          valid = false;
          break;
        }
        meldTiles.push(tile);
      }
      if (valid) {
        options.push({
          type: 'run',
          ids: meldTiles.map((tile) => tile.id),
          score: meldTiles.reduce((sum, tile) => sum + tile.value, 0),
          display: meldTiles.map((tile) => ({ ...cloneTile(tile), label: tileLabel(tile) }))
        });
      }
    }
  }

  return options.filter((option, index, list) => list.findIndex((entry) => entry.ids.slice().sort().join('|') === option.ids.slice().sort().join('|')) === index);
}

function removeIdsFromTiles(tiles, ids) {
  const idSet = new Set(ids);
  const next = [];
  let removed = 0;
  tiles.forEach((tile) => {
    if (idSet.has(tile.id)) {
      idSet.delete(tile.id);
      removed += 1;
    } else {
      next.push(tile);
    }
  });
  return removed === ids.length ? next : null;
}

function partitionMelds(tiles, memo = new Map()) {
  const key = tiles.map((tile) => tile.id).sort().join('|');
  if (memo.has(key)) return memo.get(key);
  if (!tiles.length) {
    memo.set(key, []);
    return [];
  }
  const options = generateMeldOptions(tiles);
  for (const option of options) {
    const remaining = removeIdsFromTiles(tiles, option.ids);
    if (!remaining) continue;
    const rest = partitionMelds(remaining, memo);
    if (rest) {
      const result = [option, ...rest];
      memo.set(key, result);
      return result;
    }
  }
  memo.set(key, null);
  return null;
}

function totalScore(melds) {
  return melds.reduce((sum, meld) => sum + meld.score, 0);
}

function playSelected(room, mark, ids, finishing = false) {
  const state = room.state;
  const idSet = new Set((ids || []).map(String));
  if (!idSet.size) return { error: 'Masaya koyacağın taşları seçmelisin.' };
  const selected = state.hands[mark].filter((tile) => idSet.has(String(tile.id)));
  if (selected.length !== idSet.size) return { error: 'Seçili taşlardan bazıları elinde yok.' };
  const melds = partitionMelds(selected);
  if (!melds) return { error: 'Seçtiğin taşlar geçerli seri oluşturmuyor.' };
  const score = totalScore(melds);
  if (!state.opened[mark] && score < OPEN_THRESHOLD) {
    return { error: `İlk açılış en az ${OPEN_THRESHOLD} puan olmalı.` };
  }
  let remaining = state.hands[mark].slice();
  melds.forEach((meld) => {
    remaining = removeIdsFromTiles(remaining, meld.ids);
  });
  if (!remaining) return { error: 'Kalan el hesaplanamadı.' };
  if (!finishing && remaining.length === 0) return { error: 'Bitirmek için Bitir düğmesini kullan.' };
  state.hands[mark] = sortHand(remaining, state.sortModes[mark] || 'color');
  state.opened[mark] = true;
  state.turnPlayed = true;
  melds.forEach((meld) => {
    state.tableMelds.push({
      owner: mark,
      type: meld.type,
      score: meld.score,
      display: meld.display
    });
  });
  state.lastAction = `${seatName(mark)} ${melds.length} seri koydu`;
  return { score, melds };
}

function finishTurn(room, mark, ids) {
  const result = playSelected(room, mark, ids, true);
  if (result.error) return result;
  if (room.state.hands[mark].length !== 0) {
    return { error: 'Bitirmek için tüm taşlarını seri olarak bırakmalısın.' };
  }
  room.status = 'finished';
  room.state.winner = mark;
  room.finishReason = `${room.players[mark].name} tüm taşlarını bitirdi.`;
  room.state.lastAction = `${room.players[mark].name} bitirdi`;
  return {};
}

function advanceTurn(room) {
  const currentIndex = MARKS.indexOf(room.state.turn);
  room.state.turn = MARKS[(currentIndex + 1) % MARKS.length];
  room.state.turnPlayed = false;
}

function drawTile(room, mark) {
  const state = room.state;
  if (state.turnPlayed) return { error: 'Bu tur zaten seri koydun, turu bitirmelisin.' };
  if (!state.wall.length) {
    room.status = 'finished';
    state.winner = 'draw';
    room.finishReason = 'Yerde taş kalmadı. Oyun berabere bitti.';
    return { error: 'Yerde taş kalmadı.' };
  }
  const tile = state.wall.shift();
  state.hands[mark].push(tile);
  state.hands[mark] = sortHand(state.hands[mark], state.sortModes[mark] || 'color');
  state.lastAction = `${seatName(mark)} bir taş çekti`;
  advanceTurn(room);
  return { tile };
}

function endTurn(room, mark) {
  if (!room.state.turnPlayed) return { error: 'Hamle yapmadıysan taş çekmelisin.' };
  room.state.lastAction = `${seatName(mark)} turunu bitirdi`;
  advanceTurn(room);
  return {};
}

function bestOpenSelection(hand, opened) {
  const limit = Math.min(hand.length, 8);
  let best = null;
  const indexes = Array.from({ length: hand.length }, (_, index) => index);
  for (let size = 3; size <= limit; size += 1) {
    const groups = combinations(indexes, size);
    for (const group of groups) {
      const ids = group.map((index) => hand[index].id);
      const selected = hand.filter((tile) => ids.includes(tile.id));
      const melds = partitionMelds(selected);
      if (!melds) continue;
      const score = totalScore(melds);
      if (!opened && score < OPEN_THRESHOLD) continue;
      if (!best || score > best.score || (score === best.score && ids.length > best.ids.length)) {
        best = { ids, score };
      }
    }
  }
  return best;
}

function chooseBotFlow(room, mark) {
  const hand = room.state.hands[mark];
  const option = bestOpenSelection(hand, room.state.opened[mark]);
  if (option && option.ids.length === hand.length) return { type: 'finish', ids: option.ids };
  if (option) return { type: 'play', ids: option.ids };
  return { type: 'draw' };
}

function runBotTurns(room) {
  let guard = 0;
  while (room.status === 'playing' && guard < 40) {
    const mark = room.state.turn;
    const player = room.players[mark];
    if (!player || !player.bot) break;
    let result;
    const move = chooseBotFlow(room, mark);
    if (move.type === 'finish') {
      result = finishTurn(room, mark, move.ids);
    } else if (move.type === 'play') {
      result = playSelected(room, mark, move.ids, false);
      if (!result.error) result = endTurn(room, mark);
    } else {
      result = drawTile(room, mark);
    }
    if (result && result.error) {
      room.status = 'finished';
      room.state.winner = 'draw';
      room.finishReason = `Bot akışı durdu: ${result.error}`;
      break;
    }
    guard += 1;
  }
}

function seatForUser(room, userId) {
  return MARKS.find((mark) => room.players[mark] && String(room.players[mark].id) === String(userId)) || null;
}

function publicState(room, userId) {
  const seat = seatForUser(room, userId);
  const hand = seat ? room.state.hands[seat].map((tile) => ({
    ...cloneTile(tile),
    effective: cloneTile(tile),
    wildcard: false,
    label: tileLabel(tile)
  })) : [];
  const visibleHands = {};
  MARKS.forEach((mark) => {
    visibleHands[mark] = room.status === 'finished'
      ? room.state.hands[mark].map((tile) => ({
          ...cloneTile(tile),
          effective: cloneTile(tile),
          wildcard: false,
          label: tileLabel(tile)
        }))
      : room.state.hands[mark].length;
  });
  return {
    code: room.code,
    status: room.status,
    seat,
    players: room.players,
    turn: room.state.turn,
    winner: room.state.winner,
    finishReason: room.finishReason || '',
    opened: seat ? room.state.opened[seat] : false,
    openedBy: room.state.opened,
    wallCount: room.state.wall.length,
    hand,
    visibleHands,
    tableMelds: room.state.tableMelds,
    turnPlayed: room.state.turnPlayed,
    lastAction: room.state.lastAction || ''
  };
}

function getRoom(req, res) {
  cleanupRooms();
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Oda bulunamadı.' });
    return null;
  }
  return room;
}

app.get('/api/rooms', requireYearbookUser, (req, res) => {
  cleanupRooms();
  const list = Array.from(rooms.values())
    .filter((room) => room.status === 'waiting')
    .map((room) => ({
      code: room.code,
      hostName: room.players.X ? room.players.X.name : 'Kurucu',
      seats: MARKS.filter((mark) => room.players[mark]).length
    }));
  res.json({ rooms: list });
});

app.post('/api/rooms', requireYearbookUser, (req, res) => {
  const room = {
    code: createCode(),
    status: req.body && req.body.bot ? 'playing' : 'waiting',
    players: { X: makePlayer(req, 'X'), A: null, O: null, B: null },
    state: createInitialState(),
    finishReason: '',
    updatedAt: Date.now()
  };
  if (req.body && req.body.bot) {
    room.players.A = makeBot('A');
    room.players.O = makeBot('O');
    room.players.B = makeBot('B');
  }
  rooms.set(room.code, room);
  runBotTurns(room);
  res.json(publicState(room, req.currentUser.id));
});

app.post('/api/rooms/:code/join', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const existing = seatForUser(room, req.currentUser.id);
  if (existing) return res.json(publicState(room, req.currentUser.id));
  const freeSeat = MARKS.find((mark) => !room.players[mark]);
  if (!freeSeat) return res.status(409).json({ error: 'Oda dolu.' });
  room.players[freeSeat] = makePlayer(req, freeSeat);
  room.updatedAt = Date.now();
  if (MARKS.every((mark) => room.players[mark])) room.status = 'playing';
  res.json(publicState(room, req.currentUser.id));
});

app.get('/api/rooms/:code', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  res.json(publicState(room, req.currentUser.id));
});

app.post('/api/rooms/:code/sort', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const seat = seatForUser(room, req.currentUser.id);
  if (!seat) return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  const mode = req.body && req.body.mode === 'value' ? 'value' : 'color';
  room.state.sortModes[seat] = mode;
  room.state.hands[seat] = sortHand(room.state.hands[seat], mode);
  room.updatedAt = Date.now();
  res.json(publicState(room, req.currentUser.id));
});

app.post('/api/rooms/:code/action', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  if (room.status !== 'playing') return res.status(400).json({ error: 'Oyun başlamadı.' });
  const seat = seatForUser(room, req.currentUser.id);
  if (!seat) return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  if (room.state.turn !== seat) return res.status(400).json({ error: 'Sıra sende değil.' });

  const action = String((req.body && req.body.type) || '');
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(String) : [];
  let result;
  if (action === 'draw') result = drawTile(room, seat);
  else if (action === 'play') result = playSelected(room, seat, ids, false);
  else if (action === 'finish') result = finishTurn(room, seat, ids);
  else if (action === 'endTurn') result = endTurn(room, seat);
  else result = { error: 'Geçersiz hamle.' };
  if (result && result.error) return res.status(400).json({ error: result.error });
  room.updatedAt = Date.now();
  runBotTurns(room);
  res.json(publicState(room, req.currentUser.id));
});

app.get(/^\/(?!api)(?!.*\.).*/, requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
