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
const OPEN_THRESHOLD = 101;
const rooms = new Map();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Giris yapman gerekiyor.' });
    }
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
  <title>101 Okey</title>
  <link rel="stylesheet" href="/games/101-okey/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>101 Okey</h1>
        <p>Dort kisilik 101 Okey. Ilk acilis en az 101 puan olmali; sonra masaya seri acip elde kalan tasi atarsin.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel lobby-panel">
      <div class="game-picker">
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="101-okey">101 Okey</option>
          <option value="okey">Okey</option>
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
        <p id="phase" class="phase-chip">Bekleme</p>
        <p id="players"></p>
        <div class="stat-grid">
          <div><span>Gösterge</span><div id="indicator"></div></div>
          <div><span>Okey</span><div id="joker"></div></div>
          <div><span>Yerde</span><div id="discard-top"></div></div>
          <div><span>Kalan Taş</span><strong id="wall-count">0</strong></div>
          <div><span>Açtın mı?</span><strong id="opened-state">Hayır</strong></div>
          <div><span>Açılış Eşiği</span><strong>101</strong></div>
        </div>
        <div id="message" class="message">Oda kur veya açık odalara katıl.</div>
      </aside>

      <section class="table-panel">
        <div class="table-head">
          <div id="turn-banner" class="turn-banner">Sıra bekleniyor</div>
          <div class="table-actions">
            <button id="draw-wall" type="button">Yerden Çek</button>
            <button id="take-discard" type="button">Yerdekini Al</button>
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
              <div class="discard-history">
                <p class="label">Son Atılanlar</p>
                <div id="discard-history" class="history-tiles"></div>
              </div>
              <div class="controls-note">Seçtiğin taşlarla seri aç. İlk açılış en az 101 puan olmalı. Açtıktan sonra yeni seri bırakıp elde kalan taşı atarsın.</div>
            </div>
            <div class="seat east"><h3>Doğu</h3><div id="seat-a" class="seat-cards vertical"></div></div>
          </div>
          <div class="seat south active">
            <div class="south-head">
              <h3>Sen</h3>
              <div class="selected-panel">
                <span id="selected-label">Taş seçilmedi</span>
                <button id="open-btn" type="button">Seri Aç</button>
                <button id="discard-btn" type="button">Taşı At</button>
                <button id="finish-btn" class="primary" type="button">Bitir</button>
              </div>
            </div>
            <div id="hand" class="hand-rack"></div>
          </div>
        </div>
      </section>
    </section>
  </main>
  <script>window.__OKEY101_CONFIG__ = { type: '101-okey' };</script>
  <script src="/games/101-okey/play/script.js?v=20260530a"></script>
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
      tiles.push({ id: tileId(), kind: 'normal', color, value });
      tiles.push({ id: tileId(), kind: 'normal', color, value });
    }
  });
  tiles.push({ id: tileId(), kind: 'fake' });
  tiles.push({ id: tileId(), kind: 'fake' });
  return shuffle(tiles);
}

function nextOkeyTile(tile) {
  return { color: tile.color, value: tile.value === 13 ? 1 : tile.value + 1 };
}

function cloneTile(tile) {
  return JSON.parse(JSON.stringify(tile));
}

function effectiveTile(tile, state) {
  if (tile.kind === 'fake') {
    return { color: state.indicator.color, value: state.indicator.value, fake: true };
  }
  return { color: tile.color, value: tile.value };
}

function isWildcard(tile, state) {
  return tile.kind === 'normal' && tile.color === state.joker.color && tile.value === state.joker.value;
}

function tileLabel(tile, state) {
  const effective = effectiveTile(tile, state);
  if (tile.kind === 'fake') return `Sahte (${effective.color[0].toUpperCase()}${effective.value})`;
  if (isWildcard(tile, state)) return 'Okey';
  return `${effective.color[0].toUpperCase()}${effective.value}`;
}

function sortHand(hand, state, mode = 'color') {
  const list = hand.slice();
  list.sort((left, right) => {
    const leftWild = isWildcard(left, state) ? 1 : 0;
    const rightWild = isWildcard(right, state) ? 1 : 0;
    if (leftWild !== rightWild) return leftWild - rightWild;
    const leftTile = effectiveTile(left, state);
    const rightTile = effectiveTile(right, state);
    if (mode === 'value') {
      if (leftTile.value !== rightTile.value) return leftTile.value - rightTile.value;
      if ((COLOR_ORDER[leftTile.color] || 99) !== (COLOR_ORDER[rightTile.color] || 99)) {
        return (COLOR_ORDER[leftTile.color] || 99) - (COLOR_ORDER[rightTile.color] || 99);
      }
    } else {
      if ((COLOR_ORDER[leftTile.color] || 99) !== (COLOR_ORDER[rightTile.color] || 99)) {
        return (COLOR_ORDER[leftTile.color] || 99) - (COLOR_ORDER[rightTile.color] || 99);
      }
      if (leftTile.value !== rightTile.value) return leftTile.value - rightTile.value;
    }
    return String(left.id).localeCompare(String(right.id));
  });
  return list;
}

function seatName(mark) {
  return { X: 'Güney', A: 'Doğu', O: 'Kuzey', B: 'Batı' }[mark] || mark;
}

function createInitialState() {
  const deck = createDeck();
  const indicator = deck.find((tile) => tile.kind === 'normal');
  const wall = deck.filter((tile) => tile.id !== indicator.id).map(cloneTile);
  const state = {
    indicator: cloneTile(indicator),
    joker: nextOkeyTile(indicator),
    wall,
    discardPile: [],
    hands: { X: [], A: [], O: [], B: [] },
    turn: 'X',
    phase: 'discard',
    winner: null,
    opened: { X: false, A: false, O: false, B: false },
    tableMelds: [],
    sortModes: { X: 'color', A: 'color', O: 'color', B: 'color' },
    lastAction: 'Dağıtıldı'
  };

  MARKS.forEach((mark, index) => {
    const tileCount = index === 0 ? 15 : 14;
    state.hands[mark] = sortHand(state.wall.splice(0, tileCount), state, 'color');
  });
  return state;
}

function chooseOneByValue(tiles, color, value) {
  return tiles.find((tile) => tile.kind === 'normal' && tile.color === color && tile.value === value);
}

function uniqueColorsForValue(tiles, value) {
  return Array.from(new Set(
    tiles
      .filter((tile) => tile.kind === 'normal' && tile.value === value)
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

function generateMeldOptions(tiles, state) {
  const wilds = tiles.filter((tile) => isWildcard(tile, state));
  const normals = tiles.filter((tile) => !isWildcard(tile, state));
  const anchor = normals[0];
  if (!anchor) return [];
  const options = [];
  const value = anchor.value;
  const sameValueColors = uniqueColorsForValue(normals, value);
  const otherColors = sameValueColors.filter((color) => color !== anchor.color);

  [3, 4].forEach((groupSize) => {
    for (let colorTake = Math.max(0, groupSize - 1 - wilds.length); colorTake <= otherColors.length; colorTake += 1) {
      const jokerUse = groupSize - 1 - colorTake;
      if (jokerUse < 0 || jokerUse > wilds.length) continue;
      combinations(otherColors, colorTake).forEach((extraColors) => {
        const meldTiles = [anchor];
        extraColors.forEach((color) => {
          const tile = chooseOneByValue(normals, color, value);
          if (tile) meldTiles.push(tile);
        });
        meldTiles.push(...wilds.slice(0, jokerUse));
        if (meldTiles.length === groupSize) {
          options.push({
            type: 'set',
            ids: meldTiles.map((tile) => tile.id),
            score: value * groupSize,
            display: meldTiles.map((tile) => ({
              ...cloneTile(tile),
              effective: tile.kind === 'fake' || isWildcard(tile, state) ? { color: anchor.color, value } : effectiveTile(tile, state),
              wildcard: isWildcard(tile, state),
              label: tile.kind === 'fake' || isWildcard(tile, state) ? `J${value}` : tileLabel(tile, state)
            }))
          });
        }
      });
    }
  });

  for (let start = Math.max(1, value - 12); start <= value; start += 1) {
    for (let end = value; end <= 13; end += 1) {
      const length = end - start + 1;
      if (length < 3) continue;
      const meldTiles = [];
      const display = [];
      let missing = 0;
      let wildIndex = 0;
      let valid = true;
      for (let current = start; current <= end; current += 1) {
        const tile = chooseOneByValue(normals, anchor.color, current);
        if (tile) {
          meldTiles.push(tile);
          display.push({
            ...cloneTile(tile),
            effective: effectiveTile(tile, state),
            wildcard: false,
            label: tileLabel(tile, state)
          });
        } else {
          if (wildIndex >= wilds.length) {
            valid = false;
            break;
          }
          meldTiles.push(wilds[wildIndex]);
          display.push({
            ...cloneTile(wilds[wildIndex]),
            effective: { color: anchor.color, value: current },
            wildcard: true,
            label: `J${current}`
          });
          wildIndex += 1;
          missing += 1;
        }
      }
      if (!valid) continue;
      options.push({
        type: 'run',
        ids: meldTiles.map((tile) => tile.id),
        score: display.reduce((sum, tile) => sum + Number(tile.effective.value || 0), 0),
        display
      });
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

function partitionMelds(tiles, state, memo = new Map()) {
  const key = tiles.map((tile) => tile.id).sort().join('|');
  if (memo.has(key)) return memo.get(key);
  if (!tiles.length) {
    const result = [];
    memo.set(key, result);
    return result;
  }
  const options = generateMeldOptions(tiles, state);
  for (const option of options) {
    const remaining = removeIdsFromTiles(tiles, option.ids);
    if (!remaining) continue;
    const rest = partitionMelds(remaining, state, memo);
    if (rest) {
      const result = [option, ...rest];
      memo.set(key, result);
      return result;
    }
  }
  memo.set(key, null);
  return null;
}

function totalOpenScore(melds) {
  return melds.reduce((sum, meld) => sum + meld.score, 0);
}

function drawTile(room, mark) {
  const state = room.state;
  if (!state.wall.length) {
    room.status = 'finished';
    state.winner = 'draw';
    room.finishReason = 'Yerde çekilecek taş kalmadı. Oyun berabere bitti.';
    return { error: 'Yerde taş kalmadı.' };
  }
  const tile = state.wall.shift();
  state.hands[mark].push(tile);
  state.hands[mark] = sortHand(state.hands[mark], state, state.sortModes[mark] || 'color');
  state.phase = 'discard';
  state.lastAction = `${seatName(mark)} yerden taş çekti`;
  return { tile };
}

function takeDiscard(room, mark) {
  const state = room.state;
  if (!state.discardPile.length) return { error: 'Yerde alınacak taş yok.' };
  const tile = state.discardPile.pop();
  state.hands[mark].push(tile);
  state.hands[mark] = sortHand(state.hands[mark], state, state.sortModes[mark] || 'color');
  state.phase = 'discard';
  state.lastAction = `${seatName(mark)} yerdeki taşı aldı`;
  return { tile };
}

function openSelected(room, mark, ids, finishing = false) {
  const state = room.state;
  const idSet = new Set((ids || []).map(String));
  if (!idSet.size) return { error: 'Açılacak taşları seçmelisin.' };
  const selected = state.hands[mark].filter((tile) => idSet.has(String(tile.id)));
  if (selected.length !== idSet.size) return { error: 'Seçili taşlardan bazıları elinde yok.' };
  if (!finishing && selected.length === state.hands[mark].length) {
    return { error: 'Bitirmeden tüm elini masaya açamazsın.' };
  }
  const melds = partitionMelds(selected, state);
  if (!melds) return { error: 'Seçtiğin taşlar geçerli seri oluşturmuyor.' };
  const openScore = totalOpenScore(melds);
  if (!state.opened[mark] && openScore < OPEN_THRESHOLD) {
    return { error: `İlk açılış en az ${OPEN_THRESHOLD} puan olmalı.` };
  }
  let remaining = state.hands[mark].slice();
  melds.forEach((meld) => {
    remaining = removeIdsFromTiles(remaining, meld.ids);
  });
  if (!remaining) return { error: 'Kalan el hesaplanamadı.' };
  state.hands[mark] = sortHand(remaining, state, state.sortModes[mark] || 'color');
  state.opened[mark] = true;
  melds.forEach((meld) => {
    state.tableMelds.push({
      owner: mark,
      type: meld.type,
      score: meld.score,
      display: meld.display
    });
  });
  state.lastAction = `${seatName(mark)} ${melds.length} seri açtı`;
  return { openedScore: openScore, melds };
}

function advanceTurn(room) {
  const currentIndex = MARKS.indexOf(room.state.turn);
  room.state.turn = MARKS[(currentIndex + 1) % MARKS.length];
  room.state.phase = 'draw';
}

function discardTile(room, mark, id) {
  const state = room.state;
  const index = state.hands[mark].findIndex((tile) => String(tile.id) === String(id));
  if (index === -1) return { error: 'Atılacak taşı seçmelisin.' };
  const [tile] = state.hands[mark].splice(index, 1);
  state.discardPile.push(tile);
  state.hands[mark] = sortHand(state.hands[mark], state, state.sortModes[mark] || 'color');
  state.lastAction = `${seatName(mark)} bir taş attı`;
  if (!state.hands[mark].length && state.opened[mark]) {
    room.status = 'finished';
    state.winner = mark;
    room.finishReason = `${room.players[mark].name} elini bitirdi.`;
    return {};
  }
  if (!state.wall.length) {
    room.status = 'finished';
    state.winner = 'draw';
    room.finishReason = 'Son taşlar oynandı, yerde yeni taş kalmadı.';
    return {};
  }
  advanceTurn(room);
  return {};
}

function finishTurn(room, mark, selectedIds) {
  const state = room.state;
  const selectedSet = new Set((selectedIds || []).map(String));
  const remaining = state.hands[mark].filter((tile) => !selectedSet.has(String(tile.id)));
  if (remaining.length !== 1) {
    return { error: 'Bitirmek için elde yalnızca bir atış taşı kalmalı.' };
  }
  const opened = openSelected(room, mark, selectedIds, true);
  if (opened.error) return opened;
  return discardTile(room, mark, remaining[0].id);
}

function countUsefulLinks(hand, state, tile) {
  const effective = effectiveTile(tile, state);
  let score = 0;
  hand.forEach((other) => {
    if (other.id === tile.id) return;
    const next = effectiveTile(other, state);
    if (next.value === effective.value && next.color !== effective.color) score += 3;
    if (next.color === effective.color && Math.abs(next.value - effective.value) <= 2) score += 2;
  });
  if (tile.kind === 'fake') score += 3;
  if (isWildcard(tile, state)) score += 18;
  return score;
}

function bestOpenSelection(hand, state, opened) {
  const limit = Math.min(hand.length, 8);
  let best = null;
  for (let size = 3; size <= limit; size += 1) {
    const indexes = Array.from({ length: hand.length }, (_, index) => index);
    const groups = combinations(indexes, size);
    for (const group of groups) {
      const ids = group.map((index) => hand[index].id);
      const selected = hand.filter((tile) => ids.includes(tile.id));
      const melds = partitionMelds(selected, state);
      if (!melds) continue;
      const score = totalOpenScore(melds);
      if (!opened && score < OPEN_THRESHOLD) continue;
      if (!best || score > best.score || (score === best.score && group.length > best.ids.length)) {
        best = { ids, score };
      }
    }
  }
  return best;
}

function chooseBotDiscard(room, mark) {
  const hand = room.state.hands[mark];
  let bestId = hand[0] ? hand[0].id : null;
  let bestScore = Number.POSITIVE_INFINITY;
  hand.forEach((tile) => {
    const score = countUsefulLinks(hand, room.state, tile);
    if (score < bestScore) {
      bestScore = score;
      bestId = tile.id;
    }
  });
  return bestId;
}

function chooseBotDraw(room, mark) {
  const top = room.state.discardPile[room.state.discardPile.length - 1];
  if (!top) return 'drawWall';
  const hand = room.state.hands[mark];
  const score = countUsefulLinks(hand.concat([top]), room.state, top);
  return score >= 6 ? 'takeDiscard' : 'drawWall';
}

function runBotTurns(room) {
  let guard = 0;
  while (room.status === 'playing' && guard < 40) {
    const mark = room.state.turn;
    const player = room.players[mark];
    if (!player || !player.bot) break;
    let result;
    if (room.state.phase === 'draw') {
      result = chooseBotDraw(room, mark) === 'takeDiscard' ? takeDiscard(room, mark) : drawTile(room, mark);
    } else {
      const opening = bestOpenSelection(room.state.hands[mark], room.state, room.state.opened[mark]);
      if (opening && room.state.hands[mark].length - opening.ids.length === 1) {
        result = finishTurn(room, mark, opening.ids);
      } else {
        if (opening) {
          result = openSelected(room, mark, opening.ids, false);
          if (result.error) {
            result = { error: result.error };
          }
        }
        if (!result || !result.error) {
          result = discardTile(room, mark, chooseBotDiscard(room, mark));
        }
      }
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

function publicMeld(meld) {
  return {
    owner: meld.owner,
    type: meld.type,
    score: meld.score,
    display: meld.display.map((tile) => ({
      ...cloneTile(tile),
      label: tile.label,
      effective: tile.effective,
      wildcard: tile.wildcard
    }))
  };
}

function publicState(room, userId) {
  const seat = seatForUser(room, userId);
  const hand = seat ? room.state.hands[seat].map((tile) => ({
    ...cloneTile(tile),
    effective: effectiveTile(tile, room.state),
    wildcard: isWildcard(tile, room.state),
    label: tileLabel(tile, room.state)
  })) : [];
  const visibleHands = {};
  MARKS.forEach((mark) => {
    visibleHands[mark] = room.status === 'finished'
      ? room.state.hands[mark].map((tile) => ({
          ...cloneTile(tile),
          effective: effectiveTile(tile, room.state),
          wildcard: isWildcard(tile, room.state),
          label: tileLabel(tile, room.state)
        }))
      : room.state.hands[mark].length;
  });
  return {
    code: room.code,
    status: room.status,
    seat,
    players: room.players,
    turn: room.state.turn,
    phase: room.state.phase,
    winner: room.state.winner,
    finishReason: room.finishReason || '',
    opened: seat ? room.state.opened[seat] : false,
    openedBy: room.state.opened,
    indicator: {
      ...cloneTile(room.state.indicator),
      effective: effectiveTile(room.state.indicator, room.state),
      label: tileLabel(room.state.indicator, room.state)
    },
    joker: room.state.joker,
    discardTop: room.state.discardPile.length ? {
      ...cloneTile(room.state.discardPile[room.state.discardPile.length - 1]),
      effective: effectiveTile(room.state.discardPile[room.state.discardPile.length - 1], room.state),
      wildcard: isWildcard(room.state.discardPile[room.state.discardPile.length - 1], room.state),
      label: tileLabel(room.state.discardPile[room.state.discardPile.length - 1], room.state)
    } : null,
    discardHistory: room.state.discardPile.slice(-12).map((tile) => ({
      ...cloneTile(tile),
      effective: effectiveTile(tile, room.state),
      wildcard: isWildcard(tile, room.state),
      label: tileLabel(tile, room.state)
    })),
    wallCount: room.state.wall.length,
    hand,
    visibleHands,
    tableMelds: room.state.tableMelds.map(publicMeld),
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
  room.state.hands[seat] = sortHand(room.state.hands[seat], room.state, mode);
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
  let result = null;
  if (room.state.phase === 'draw') {
    if (action === 'drawWall') result = drawTile(room, seat);
    else if (action === 'takeDiscard') result = takeDiscard(room, seat);
    else result = { error: 'Önce taş çekmelisin.' };
  } else {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(String) : [];
    if (action === 'open') result = openSelected(room, seat, ids, false);
    else if (action === 'discard') result = discardTile(room, seat, String(req.body.id || ''));
    else if (action === 'finish') result = finishTurn(room, seat, ids);
    else result = { error: 'Geçersiz hamle.' };
  }
  if (result && result.error) return res.status(400).json({ error: result.error });
  room.updatedAt = Date.now();
  runBotTurns(room);
  res.json(publicState(room, req.currentUser.id));
});

app.get(/^\/(?!api)(?!.*\.).*/, requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
