const path = require('path');
const { createRequire } = require('module');
const crypto = require('crypto');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();

const ROOM_TTL_MS = 1000 * 60 * 60 * 8;
const MARKS = ['X', 'A', 'O', 'B'];
const COLORS = ['red', 'yellow', 'green', 'blue'];
const COLOR_LABELS = { red: 'Kirmizi', yellow: 'Sari', green: 'Yesil', blue: 'Mavi' };
const COLOR_ICONS = { red: '●', yellow: '●', green: '●', blue: '●' };
const TYPE_ORDER = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 };
const rooms = new Map();

app.use(express.json({ limit: '80kb' }));
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
  <title>UNO</title>
  <link rel="stylesheet" href="/games/uno/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Kart Oyunu</p>
        <h1>UNO</h1>
        <p>Renk ve kart turu takipli klasik UNO. Ozel kartlar, renk secimi, PC modu ve oda kodu destegiyle oynanir.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="panel lobby-panel">
      <div class="game-picker">
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="uno">UNO</option>
          <option value="batak">Batak</option>
          <option value="okey">Okey</option>
          <option value="101-okey">101 Okey</option>
          <option value="nane-okey">Nane Okey</option>
          <option value="reversi">Reversi</option>
          <option value="mangala">Mangala</option>
          <option value="kuyulamac">Kuyulamac</option>
          <option value="alti">Alti</option>
          <option value="go">Go</option>
          <option value="abalone">Abalone</option>
          <option value="tavla">Tavla</option>
          <option value="koridor">Koridor</option>
          <option value="dama">Dama</option>
          <option value="capraz-dama">Capraz Dama</option>
          <option value="9-tas">9 Tas</option>
          <option value="3-tas">3 Tas</option>
          <option value="domino">Domino</option>
          <option value="kutu-doldurmaca">Kutu Doldurmaca</option>
          <option value="satranc">Satranc</option>
          <option value="xox">XOX</option>
          <option value="sos">SOS</option>
          <option value="dortlu-birlestir">4'lu Birlestir</option>
          <option value="mastermind">Mastermind</option>
          <option value="yilanlar-ve-merdivenler">Yilanlar ve Merdivenler</option>
          <option value="kizma-birader">Kizma Birader</option>
        </select>
      </div>
      <div class="lobby-actions">
        <button id="pc-room" class="primary" type="button">PC'ye Karsi</button>
        <button id="create-room" type="button">4 Kisilik Oda Kur</button>
      </div>
      <form id="join-form" class="join-form">
        <input id="room-code" type="text" maxlength="6" placeholder="Oda kodu" autocomplete="off">
        <button type="submit">Katil</button>
      </form>
      <div class="open-rooms">
        <div class="open-rooms-head">
          <strong>Acik Odalar</strong>
          <button id="refresh" class="mini" type="button">Yenile</button>
        </div>
        <div id="open-list" class="open-rooms-list">Yukleniyor...</div>
      </div>
    </section>

    <section class="game-layout">
      <aside class="panel side-panel">
        <p class="label">Durum</p>
        <h2 id="room-title">Henuz oda yok</h2>
        <p id="phase" class="phase-chip">Bekleme</p>
        <p id="players"></p>
        <div class="stat-grid">
          <div><span>Aktif Renk</span><strong id="current-color">-</strong></div>
          <div><span>Yon</span><strong id="direction">Saat yonu</strong></div>
          <div><span>Cekme Cezasi</span><strong id="pending-draw">0</strong></div>
          <div><span>Deste</span><strong id="draw-count">0</strong></div>
        </div>
        <div id="message" class="message">Oda kur veya acik odalara katil.</div>
      </aside>

      <section class="table-panel">
        <div class="table-head">
          <div id="turn-banner" class="turn-banner">Sira bekleniyor</div>
          <div class="table-actions">
            <button id="draw-btn" type="button">Kart Cek</button>
            <button id="end-turn-btn" type="button">Turu Bitir</button>
          </div>
        </div>

        <div class="color-panel" id="color-panel">
          <span class="label">Renk Sec</span>
          <div class="color-actions">
            <button data-color="red" type="button">Kirmizi</button>
            <button data-color="yellow" type="button">Sari</button>
            <button data-color="green" type="button">Yesil</button>
            <button data-color="blue" type="button">Mavi</button>
          </div>
        </div>

        <div class="table-seats">
          <div class="seat north"><h3>Kuzey</h3><div id="seat-o" class="seat-cards"></div><p id="seat-o-info" class="seat-info"></p></div>
          <div class="mid-row">
            <div class="seat west"><h3>Bati</h3><div id="seat-b" class="seat-cards vertical"></div><p id="seat-b-info" class="seat-info"></p></div>
            <div class="center-area">
              <div class="pile-panel">
                <div class="pile-box">
                  <p class="label">Cekme Destesi</p>
                  <div class="uno-card back large"></div>
                </div>
                <div class="pile-box">
                  <p class="label">Ortadaki Kart</p>
                  <div id="discard-top" class="pile-card"></div>
                </div>
              </div>
              <div class="history-panel">
                <p class="label">Son Olaylar</p>
                <div id="history-list" class="history-list"></div>
              </div>
              <div class="score-strip">
                <div><span>Sen</span><strong id="count-self">0</strong></div>
                <div><span>Dogu</span><strong id="count-right">0</strong></div>
                <div><span>Kuzey</span><strong id="count-top">0</strong></div>
                <div><span>Bati</span><strong id="count-left">0</strong></div>
              </div>
            </div>
            <div class="seat east"><h3>Dogu</h3><div id="seat-a" class="seat-cards vertical"></div><p id="seat-a-info" class="seat-info"></p></div>
          </div>
          <div class="seat south active">
            <div class="south-head">
              <h3>Sen</h3>
              <div class="selected-panel">
                <span id="selected-label">Kart secilmedi</span>
                <button id="play-btn" class="primary" type="button">Karti Oyna</button>
              </div>
            </div>
            <div id="hand" class="hand-rack"></div>
          </div>
        </div>
      </section>
    </section>
  </main>
  <script>window.__UNO_CONFIG__ = { type: 'uno' };</script>
  <script src="/games/uno/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  }
}

function createCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
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
  const deck = [];
  COLORS.forEach((color) => {
    deck.push({ id: tileId(), color, type: 'number', value: 0 });
    for (let value = 1; value <= 9; value += 1) {
      deck.push({ id: tileId(), color, type: 'number', value });
      deck.push({ id: tileId(), color, type: 'number', value });
    }
    ['skip', 'reverse', 'draw2'].forEach((type) => {
      deck.push({ id: tileId(), color, type });
      deck.push({ id: tileId(), color, type });
    });
  });
  for (let index = 0; index < 4; index += 1) {
    deck.push({ id: tileId(), color: null, type: 'wild' });
    deck.push({ id: tileId(), color: null, type: 'wild4' });
  }
  return shuffle(deck);
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

function nextMarkFrom(room, mark, steps = 1) {
  let index = MARKS.indexOf(mark);
  for (let count = 0; count < steps; count += 1) {
    index = (index + room.direction + MARKS.length) % MARKS.length;
  }
  return MARKS[index];
}

function markLabel(mark) {
  return { X: 'Guney', A: 'Dogu', O: 'Kuzey', B: 'Bati' }[mark] || mark;
}

function seatRelative(seat, target) {
  if (!target) return null;
  const seatIndex = MARKS.indexOf(seat);
  const targetIndex = MARKS.indexOf(target);
  const delta = (targetIndex - seatIndex + MARKS.length) % MARKS.length;
  if (delta === 0) return 'self';
  if (delta === 1) return 'right';
  if (delta === 2) return 'top';
  return 'left';
}

function labelForTile(tile) {
  if (tile.type === 'number') return `${tile.value}`;
  if (tile.type === 'skip') return 'Pas';
  if (tile.type === 'reverse') return 'Yon';
  if (tile.type === 'draw2') return '+2';
  if (tile.type === 'wild') return 'Renk';
  return '+4';
}

function classForTile(tile, currentColor = null) {
  const color = tile.color || currentColor || 'wild';
  return `uno-card ${color} ${tile.type === 'wild' || tile.type === 'wild4' ? 'wild' : ''}`.trim();
}

function publicTile(tile, currentColor = null) {
  return {
    id: tile.id,
    color: tile.color,
    type: tile.type,
    value: tile.value ?? null,
    label: labelForTile(tile),
    className: classForTile(tile, currentColor)
  };
}

function drawOne(room) {
  if (!room.drawPile.length) {
    const top = room.discardPile.pop();
    room.drawPile = shuffle(room.discardPile.splice(0).map((tile) => ({ ...tile, chosenColor: null })));
    room.discardPile = [top];
  }
  return room.drawPile.pop() || null;
}

function countColors(hand) {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  hand.forEach((tile) => {
    if (tile.color && counts[tile.color] !== undefined) counts[tile.color] += 1;
  });
  return counts;
}

function bestColorForHand(hand) {
  const counts = countColors(hand);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function isPlayable(room, tile) {
  const top = room.discardPile[room.discardPile.length - 1];
  const currentColor = room.currentColor || top.color;
  if (room.pendingDraw > 0) return false;
  if (room.phase === 'choose-color') return false;
  if (!top) return true;
  if (tile.type === 'wild' || tile.type === 'wild4') return true;
  if (tile.color === currentColor) return true;
  if (top.type === tile.type && tile.type !== 'number') return true;
  if (tile.type === 'number' && top.type === 'number' && tile.value === top.value) return true;
  return false;
}

function legalTiles(room, mark) {
  return room.hands[mark].filter((tile) => isPlayable(room, tile));
}

function createRoundState() {
  const drawPile = createDeck();
  const hands = { X: [], A: [], O: [], B: [] };
  for (let round = 0; round < 7; round += 1) {
    MARKS.forEach((mark) => {
      hands[mark].push(drawPile.pop());
    });
  }
  MARKS.forEach((mark) => {
    hands[mark] = sortHand(hands[mark]);
  });
  let top = drawPile.pop();
  while (!top || top.type === 'wild4') {
    drawPile.unshift(top);
    top = drawPile.pop();
  }
  const startingMark = MARKS[Math.floor(Math.random() * MARKS.length)];
  const room = {
    drawPile,
    discardPile: [top],
    hands,
    phase: 'playing',
    status: 'playing',
    turn: startingMark,
    direction: 1,
    currentColor: top.color || COLORS[Math.floor(Math.random() * COLORS.length)],
    pendingDraw: 0,
    history: [],
    drawnThisTurn: false,
    winner: null,
    finishReason: '',
    lastAction: `${markLabel(startingMark)} basliyor.`
  };
  applyInitialTopCard(room, top);
  return room;
}

function sortHand(hand) {
  return hand.slice().sort((left, right) => {
    const leftColor = left.color || 'zz';
    const rightColor = right.color || 'zz';
    if (leftColor !== rightColor) return leftColor.localeCompare(rightColor);
    if ((TYPE_ORDER[left.type] || 99) !== (TYPE_ORDER[right.type] || 99)) {
      return (TYPE_ORDER[left.type] || 99) - (TYPE_ORDER[right.type] || 99);
    }
    return (left.value || 0) - (right.value || 0);
  });
}

function pushHistory(room, text) {
  room.history.push(text);
  room.history = room.history.slice(-14);
  room.lastAction = text;
}

function applyInitialTopCard(room, top) {
  if (top.type === 'skip') {
    pushHistory(room, `Acik kart PAS geldi. ${markLabel(room.turn)} atlandi.`);
    room.turn = nextMarkFrom(room, room.turn);
  } else if (top.type === 'reverse') {
    room.direction *= -1;
    pushHistory(room, 'Acik kart YON geldi. Oyun yonu degisti.');
  } else if (top.type === 'draw2') {
    const target = room.turn;
    for (let count = 0; count < 2; count += 1) {
      const tile = drawOne(room);
      if (tile) room.hands[target].push(tile);
    }
    room.hands[target] = sortHand(room.hands[target]);
    pushHistory(room, `Acik kart +2 geldi. ${markLabel(target)} iki kart cekti.`);
    room.turn = nextMarkFrom(room, room.turn);
  }
}

function createRoom(hostPlayer, withBots = false) {
  const players = { X: hostPlayer, A: null, O: null, B: null };
  if (withBots) {
    players.A = makeBot('A');
    players.O = makeBot('O');
    players.B = makeBot('B');
  }
  const room = {
    code: createCode(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players,
    ...createRoundState()
  };
  if (!withBots) {
    room.status = 'waiting';
    room.phase = 'waiting';
    room.turn = null;
    room.lastAction = 'Masa acildi. Diger oyuncular bekleniyor.';
  }
  return room;
}

function resetRound(room, message) {
  Object.assign(room, createRoundState());
  if (message) room.lastAction = message;
}

function chooseColor(room, mark, color) {
  if (room.phase !== 'choose-color') throw new Error('Su an renk secilmiyor.');
  if (room.turn !== mark) throw new Error('Renk secme sirasi sende degil.');
  if (!COLORS.includes(color)) throw new Error('Gecersiz renk.');
  room.currentColor = color;
  room.phase = 'playing';
  const top = room.discardPile[room.discardPile.length - 1];
  if (top.type === 'wild4') {
    room.pendingDraw = 4;
    room.turn = nextMarkFrom(room, mark);
    pushHistory(room, `${markLabel(mark)} rengi ${COLOR_LABELS[color]} secti. Sonraki oyuncu 4 kart cekiyor.`);
  } else {
    room.pendingDraw = 0;
    room.turn = nextMarkFrom(room, mark);
    pushHistory(room, `${markLabel(mark)} rengi ${COLOR_LABELS[color]} secti.`);
  }
}

function handlePendingDraw(room, mark) {
  const drawCount = room.pendingDraw;
  for (let count = 0; count < drawCount; count += 1) {
    const tile = drawOne(room);
    if (tile) room.hands[mark].push(tile);
  }
  room.hands[mark] = sortHand(room.hands[mark]);
  room.pendingDraw = 0;
  room.drawnThisTurn = false;
  pushHistory(room, `${markLabel(mark)} ${drawCount} kart cekti.`);
  room.turn = nextMarkFrom(room, mark);
}

function finishIfNeeded(room, mark) {
  if (room.hands[mark].length === 0) {
    room.status = 'finished';
    room.phase = 'finished';
    room.winner = mark;
    room.finishReason = `${markLabel(mark)} UNO'yu bitirdi.`;
    room.lastAction = room.finishReason;
    return true;
  }
  return false;
}

function playTile(room, mark, tileIdValue) {
  if (room.status !== 'playing') throw new Error('Oyun aktif degil.');
  if (room.phase === 'choose-color') throw new Error('Once renk secilmeli.');
  if (room.turn !== mark) throw new Error('Sira sende degil.');
  if (room.pendingDraw > 0) throw new Error('Once ceza kartini cekmen gerekiyor.');
  const hand = room.hands[mark];
  const index = hand.findIndex((tile) => tile.id === tileIdValue);
  if (index === -1) throw new Error('Kart bulunamadi.');
  const tile = hand[index];
  if (!isPlayable(room, tile)) throw new Error('Bu kart su an oynanamaz.');

  hand.splice(index, 1);
  room.discardPile.push({ ...tile });
  room.currentColor = tile.color || room.currentColor;
  room.drawnThisTurn = false;
  pushHistory(room, `${markLabel(mark)} ${labelForTile(tile)} oynadi.`);

  if (finishIfNeeded(room, mark)) return;

  if (tile.type === 'wild' || tile.type === 'wild4') {
    room.phase = 'choose-color';
    room.turn = mark;
    if (tile.type === 'wild4') room.pendingDraw = 4;
    return;
  }

  if (tile.type === 'skip') {
    room.turn = nextMarkFrom(room, mark, 2);
    pushHistory(room, `${markLabel(nextMarkFrom(room, mark))} atlandi.`);
    return;
  }

  if (tile.type === 'reverse') {
    room.direction *= -1;
    room.turn = nextMarkFrom(room, mark);
    pushHistory(room, 'Oyun yonu degisti.');
    return;
  }

  if (tile.type === 'draw2') {
    room.pendingDraw = 2;
    room.turn = nextMarkFrom(room, mark);
    pushHistory(room, `${markLabel(room.turn)} iki kart cekmek zorunda.`);
    return;
  }

  room.turn = nextMarkFrom(room, mark);
}

function drawForTurn(room, mark) {
  if (room.status !== 'playing') throw new Error('Oyun aktif degil.');
  if (room.turn !== mark) throw new Error('Sira sende degil.');
  if (room.phase === 'choose-color') throw new Error('Once renk secilmeli.');
  if (room.pendingDraw > 0) {
    handlePendingDraw(room, mark);
    return;
  }
  if (room.drawnThisTurn) throw new Error('Bu tur zaten kart cektin.');
  const tile = drawOne(room);
  if (!tile) throw new Error('Deste bos.');
  room.hands[mark].push(tile);
  room.hands[mark] = sortHand(room.hands[mark]);
  room.drawnThisTurn = true;
  pushHistory(room, `${markLabel(mark)} bir kart cekti.`);
}

function endTurn(room, mark) {
  if (room.status !== 'playing') throw new Error('Oyun aktif degil.');
  if (room.phase === 'choose-color') throw new Error('Once renk secilmeli.');
  if (room.turn !== mark) throw new Error('Sira sende degil.');
  if (room.pendingDraw > 0) throw new Error('Cekme cezasi duruyor.');
  if (!room.drawnThisTurn) throw new Error('Kart oynamadiysan once bir kart cekmelisin.');
  room.drawnThisTurn = false;
  room.turn = nextMarkFrom(room, mark);
  pushHistory(room, `${markLabel(mark)} turu bitirdi.`);
}

function chooseBotColor(room, mark) {
  return bestColorForHand(room.hands[mark]);
}

function botScoreTile(room, mark, tile) {
  let score = 0;
  if (tile.type === 'wild4') score += 90;
  else if (tile.type === 'wild') score += 70;
  else if (tile.type === 'draw2') score += 55;
  else if (tile.type === 'skip') score += 46;
  else if (tile.type === 'reverse') score += 38;
  else score += 10 + (9 - Math.abs(5 - tile.value));

  const hand = room.hands[mark];
  const remainingSameColor = hand.filter((entry) => entry.id !== tile.id && entry.color === tile.color).length;
  score += remainingSameColor * 6;
  if (hand.length <= 3) score += 20;
  return score;
}

function chooseBotTile(room, mark) {
  const legal = legalTiles(room, mark);
  if (!legal.length) return null;
  return legal.slice().sort((left, right) => botScoreTile(room, mark, right) - botScoreTile(room, mark, left))[0];
}

function runBots(room) {
  let guard = 0;
  while (guard < 80) {
    guard += 1;
    if (room.status !== 'playing') return;
    const current = room.turn ? room.players[room.turn] : null;
    if (!current || !current.bot) return;
    if (room.status === 'waiting') return;
    if (room.phase === 'choose-color') {
      chooseColor(room, current.mark, chooseBotColor(room, current.mark));
      continue;
    }
    if (room.pendingDraw > 0) {
      drawForTurn(room, current.mark);
      continue;
    }
    const tile = chooseBotTile(room, current.mark);
    if (!tile) {
      drawForTurn(room, current.mark);
      const retry = chooseBotTile(room, current.mark);
      if (retry) {
        playTile(room, current.mark, retry.id);
      } else {
        endTurn(room, current.mark);
      }
      continue;
    }
    playTile(room, current.mark, tile.id);
  }
}

function publicState(room, seat) {
  const visibleHands = {};
  const seatInfos = {};
  MARKS.forEach((mark) => {
    const relative = seatRelative(seat, mark);
    visibleHands[relative] = mark === seat ? room.hands[mark].map((tile) => publicTile(tile, room.currentColor)) : room.hands[mark].length;
    seatInfos[relative] = `${room.hands[mark].length} kart`;
  });
  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    turn: room.turn ? seatRelative(seat, room.turn) : null,
    seat,
    players: Object.fromEntries(MARKS.map((mark) => [seatRelative(seat, mark), room.players[mark]])),
    currentColor: room.currentColor,
    direction: room.direction,
    pendingDraw: room.pendingDraw,
    drawCount: room.drawPile.length,
    hand: room.hands[seat].map((tile) => publicTile(tile, room.currentColor)),
    legalTileIds: room.turn === seat && room.phase === 'playing' ? legalTiles(room, seat).map((tile) => tile.id) : [],
    drawnThisTurn: room.turn === seat ? room.drawnThisTurn : false,
    visibleHands,
    seatInfos,
    discardTop: room.discardPile.length ? publicTile(room.discardPile[room.discardPile.length - 1], room.currentColor) : null,
    history: room.history.slice(-12),
    finishReason: room.finishReason,
    lastAction: room.lastAction,
    winner: room.winner ? seatRelative(seat, room.winner) : null
  };
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

app.get('/api/rooms', requireYearbookUser, (req, res) => {
  cleanupRooms();
  const openRooms = Array.from(rooms.values())
    .filter((room) => room.status !== 'finished' && MARKS.some((mark) => !room.players[mark]))
    .map((room) => ({
      code: room.code,
      seats: MARKS.filter((mark) => room.players[mark]).length,
      phase: room.phase
    }));
  res.json({ rooms: openRooms });
});

app.post('/api/rooms', requireYearbookUser, (req, res) => {
  cleanupRooms();
  const room = createRoom(makePlayer(req, 'X'), !!req.body.bot);
  rooms.set(room.code, room);
  runBots(room);
  res.status(201).json(publicState(room, 'X'));
});

app.post('/api/rooms/:code/join', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const existing = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (existing) {
    runBots(room);
    return res.json(publicState(room, existing));
  }
  const emptySeat = MARKS.find((mark) => !room.players[mark]);
  if (!emptySeat) return res.status(400).json({ error: 'Oda dolu.' });
  room.players[emptySeat] = makePlayer(req, emptySeat);
  if (MARKS.every((mark) => room.players[mark])) {
    resetRound(room, 'Masa doldu. UNO basliyor.');
  }
  room.updatedAt = Date.now();
  runBots(room);
  return res.json(publicState(room, emptySeat));
});

app.get('/api/rooms/:code', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  room.updatedAt = Date.now();
  runBots(room);
  return res.json(publicState(room, seat));
});

app.post('/api/rooms/:code/play', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    playTile(room, seat, String(req.body.tileId || ''));
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/rooms/:code/draw', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    drawForTurn(room, seat);
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/rooms/:code/end-turn', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    endTurn(room, seat);
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/rooms/:code/choose-color', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    chooseColor(room, seat, String(req.body.color || ''));
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = app;
