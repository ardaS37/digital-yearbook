const path = require('path');
const { createRequire } = require('module');
const crypto = require('crypto');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();

const ROOM_TTL_MS = 1000 * 60 * 60 * 8;
const MARKS = ['X', 'A', 'O', 'B'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_ORDER = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const SUIT_LABELS = {
  spades: { name: 'Maça', icon: '♠' },
  hearts: { name: 'Kupa', icon: '♥' },
  diamonds: { name: 'Karo', icon: '♦' },
  clubs: { name: 'Sinek', icon: '♣' }
};
const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
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
  <title>Batak</title>
  <link rel="stylesheet" href="/games/batak/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Kagit Oyunu</p>
        <h1>Ihaleli Batak</h1>
        <p>Dort kisilik klasik ihale, koz secimi ve el alma akisi. PC'ye karsi veya oda koduyla oynanir.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="panel lobby-panel">
      <div class="game-picker">
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="batak">Batak</option>
          <option value="okey">Okey</option>
          <option value="101-okey">101 Okey</option>
          <option value="nane-okey">Nane Okey</option>
          <option value="reversi">Reversi</option>
          <option value="mangala">Mangala</option>
          <option value="kuyulamac">Kuyulamach</option>
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
        <p class="label">Masa</p>
        <h2 id="room-title">Henuz oda yok</h2>
        <p id="phase" class="phase-chip">Bekleme</p>
        <p id="players"></p>
        <div class="stat-grid">
          <div><span>Son Ihale</span><strong id="current-bid">-</strong></div>
          <div><span>Koz</span><strong id="trump-label">-</strong></div>
          <div><span>Eli Alan</span><strong id="highest-bidder">-</strong></div>
          <div><span>Kalan El</span><strong id="remaining-tricks">13</strong></div>
        </div>
        <div id="message" class="message">Oda kur veya acik odalara katil.</div>
      </aside>

      <section class="table-panel">
        <div class="table-head">
          <div id="turn-banner" class="turn-banner">Sira bekleniyor</div>
          <div class="table-actions">
            <button id="pass-btn" type="button">Pas</button>
            <button id="bid-8" type="button">8</button>
            <button id="bid-9" type="button">9</button>
            <button id="bid-10" type="button">10</button>
            <button id="bid-11" type="button">11</button>
            <button id="bid-12" type="button">12</button>
            <button id="bid-13" type="button">13</button>
          </div>
        </div>

        <div class="trump-panel" id="trump-panel">
          <span class="label">Koz Sec</span>
          <div class="trump-actions">
            <button data-trump="spades" type="button">♠ Maca</button>
            <button data-trump="hearts" type="button">♥ Kupa</button>
            <button data-trump="diamonds" type="button">♦ Karo</button>
            <button data-trump="clubs" type="button">♣ Sinek</button>
          </div>
        </div>

        <div class="table-seats">
          <div class="seat north"><h3>Kuzey</h3><div id="seat-o" class="seat-cards"></div><p id="seat-o-info" class="seat-info"></p></div>
          <div class="mid-row">
            <div class="seat west"><h3>Bati</h3><div id="seat-b" class="seat-cards vertical"></div><p id="seat-b-info" class="seat-info"></p></div>
            <div class="center-area">
              <div class="current-trick">
                <p class="label">Ortadaki El</p>
                <div id="trick-board" class="trick-board"></div>
              </div>
              <div class="bid-history">
                <p class="label">Ihale Akisi</p>
                <div id="bid-history" class="history-list"></div>
              </div>
              <div class="score-strip">
                <div><span>Guney</span><strong id="score-x">0</strong></div>
                <div><span>Dogu</span><strong id="score-a">0</strong></div>
                <div><span>Kuzey</span><strong id="score-o">0</strong></div>
                <div><span>Bati</span><strong id="score-b">0</strong></div>
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
  <script>window.__BATAK_CONFIG__ = { type: 'batak' };</script>
  <script src="/games/batak/play/script.js?v=20260530a"></script>
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

function cardId() {
  return crypto.randomBytes(6).toString('hex');
}

function createDeck() {
  const deck = [];
  SUITS.forEach((suit) => {
    for (let rank = 2; rank <= 14; rank += 1) {
      deck.push({ id: cardId(), suit, rank });
    }
  });
  return shuffle(deck);
}

function cardRankLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

function cardLabel(card) {
  return `${cardRankLabel(card.rank)}${SUIT_LABELS[card.suit].icon}`;
}

function cardClass(card) {
  return `card ${card.suit}`;
}

function cloneCard(card) {
  return { ...card };
}

function sortHand(hand) {
  return hand.slice().sort((left, right) => {
    if (SUIT_ORDER[left.suit] !== SUIT_ORDER[right.suit]) return SUIT_ORDER[left.suit] - SUIT_ORDER[right.suit];
    return left.rank - right.rank;
  });
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

function nextMark(mark) {
  return MARKS[(MARKS.indexOf(mark) + 1) % MARKS.length];
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

function createRoundState() {
  const deck = createDeck();
  const hands = { X: [], A: [], O: [], B: [] };
  for (let round = 0; round < 13; round += 1) {
    MARKS.forEach((mark) => {
      hands[mark].push(deck.pop());
    });
  }
  MARKS.forEach((mark) => {
    hands[mark] = sortHand(hands[mark]);
  });
  const dealerIndex = Math.floor(Math.random() * MARKS.length);
  const startingMark = MARKS[(dealerIndex + 1) % MARKS.length];
  return {
    dealerIndex,
    hands,
    phase: 'bidding',
    turn: startingMark,
    currentBid: 0,
    highestBidder: null,
    bidHistory: [],
    bids: { X: null, A: null, O: null, B: null },
    trump: null,
    trickCount: { X: 0, A: 0, O: 0, B: 0 },
    completedTricks: 0,
    currentTrick: [],
    status: 'playing',
    winner: null,
    scoreBreakdown: null,
    finishReason: '',
    lastAction: `${markLabel(startingMark)} ihale aciyor.`
  };
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
  const round = createRoundState();
  Object.assign(room, round);
  if (message) room.lastAction = message;
}

function bestSuitForHand(hand) {
  const summary = SUITS.map((suit) => {
    const cards = hand.filter((card) => card.suit === suit);
    const high = cards.reduce((total, card) => total + Math.max(0, card.rank - 10), 0);
    return {
      suit,
      count: cards.length,
      high,
      score: cards.length * 2 + high
    };
  }).sort((left, right) => right.score - left.score || right.count - left.count);
  return summary[0];
}

function chooseBotBid(room, mark) {
  const bestSuit = bestSuitForHand(room.hands[mark]);
  const bidCeiling = Math.max(7, Math.min(13, 7 + Math.floor(bestSuit.score / 3)));
  if (bidCeiling <= Math.max(room.currentBid, 7)) return null;
  return Math.max(8, room.currentBid + 1);
}

function resolveBid(room, mark, rawBid) {
  if (room.phase !== 'bidding') throw new Error('Ihale kapandi.');
  if (room.turn !== mark) throw new Error('Sira sende degil.');

  const bid = rawBid === null ? null : Number(rawBid);
  if (bid !== null && (!Number.isInteger(bid) || bid < 8 || bid > 13)) {
    throw new Error('Ihale 8 ile 13 arasinda olmali.');
  }
  if (bid !== null && bid <= room.currentBid) {
    throw new Error('Teklif mevcut ihalenin ustunde olmali.');
  }

  if (bid === null) {
    room.bidHistory.push({ mark, bid: null });
    room.bids[mark] = room.bids[mark] || 'pass';
    room.lastAction = `${markLabel(mark)} pas gecti.`;
    if (!room.highestBidder) {
      if (room.bidHistory.length >= MARKS.length) {
        resetRound(room, 'Herkes pas gecti. Kartlar yeniden dagitildi.');
        return;
      }
      room.turn = nextMark(mark);
      return;
    }

    let passCount = 0;
    for (let index = room.bidHistory.length - 1; index >= 0; index -= 1) {
      if (room.bidHistory[index].bid !== null) break;
      passCount += 1;
    }
    if (passCount >= 3) {
      room.phase = 'trump';
      room.turn = room.highestBidder;
      room.lastAction = `${markLabel(room.highestBidder)} kozu seciyor.`;
      return;
    }
    room.turn = nextMark(mark);
    return;
  }

  room.currentBid = bid;
  room.highestBidder = mark;
  room.bids[mark] = bid;
  room.bidHistory.push({ mark, bid });
  room.lastAction = `${markLabel(mark)} ${bid} dedi.`;
  if (bid >= 13) {
    room.phase = 'trump';
    room.turn = mark;
    room.lastAction = `${markLabel(mark)} 13 dedi ve kozu seciyor.`;
    return;
  }
  room.turn = nextMark(mark);
}

function chooseBotTrump(room, mark) {
  return bestSuitForHand(room.hands[mark]).suit;
}

function resolveTrump(room, mark, suit) {
  if (room.phase !== 'trump') throw new Error('Su an koz secilmiyor.');
  if (room.turn !== mark || room.highestBidder !== mark) throw new Error('Koz secme sirasi sende degil.');
  if (!SUITS.includes(suit)) throw new Error('Gecersiz koz.');
  room.trump = suit;
  room.phase = 'playing';
  room.turn = room.highestBidder;
  room.lastAction = `${markLabel(mark)} kozu ${SUIT_LABELS[suit].name} secti.`;
}

function legalCards(room, mark) {
  const hand = room.hands[mark];
  if (!room.currentTrick.length) return hand.slice();
  const leadSuit = room.currentTrick[0].card.suit;
  const follow = hand.filter((card) => card.suit === leadSuit);
  return follow.length ? follow : hand.slice();
}

function compareTrickCards(left, right, leadSuit, trump) {
  const leftTrump = left.suit === trump;
  const rightTrump = right.suit === trump;
  if (leftTrump !== rightTrump) return leftTrump ? 1 : -1;
  const leftLead = left.suit === leadSuit;
  const rightLead = right.suit === leadSuit;
  if (leftLead !== rightLead) return leftLead ? 1 : -1;
  return left.rank === right.rank ? 0 : left.rank > right.rank ? 1 : -1;
}

function trickWinner(trick, trump) {
  const leadSuit = trick[0].card.suit;
  return trick.reduce((best, item) => (
    compareTrickCards(item.card, best.card, leadSuit, trump) > 0 ? item : best
  )).mark;
}

function finishRound(room) {
  const contract = room.currentBid;
  const bidder = room.highestBidder;
  const bidderTricks = room.trickCount[bidder] || 0;
  const made = bidderTricks >= contract;
  const scoreBreakdown = {};
  MARKS.forEach((mark) => {
    if (mark === bidder) scoreBreakdown[mark] = made ? contract : -contract;
    else scoreBreakdown[mark] = room.trickCount[mark] || 0;
  });
  room.status = 'finished';
  room.phase = 'finished';
  room.scoreBreakdown = scoreBreakdown;
  room.winner = made ? bidder : MARKS.filter((mark) => mark !== bidder).sort((a, b) => room.trickCount[b] - room.trickCount[a])[0];
  room.finishReason = made
    ? `${markLabel(bidder)} ${contract} ihalesini yapti.`
    : `${markLabel(bidder)} ${contract} ihalesinde batti.`;
  room.lastAction = room.finishReason;
}

function resolvePlay(room, mark, cardIdValue) {
  if (room.phase !== 'playing') throw new Error('Su an kart oynanmiyor.');
  if (room.turn !== mark) throw new Error('Sira sende degil.');
  const hand = room.hands[mark];
  const index = hand.findIndex((card) => card.id === cardIdValue);
  if (index === -1) throw new Error('Kart bulunamadi.');
  const card = hand[index];
  const legal = legalCards(room, mark);
  if (!legal.some((item) => item.id === card.id)) throw new Error('Bu karta izin yok, yer acilan rengi takip et.');

  hand.splice(index, 1);
  room.currentTrick.push({ mark, card });
  room.lastAction = `${markLabel(mark)} ${cardLabel(card)} oynadi.`;

  if (room.currentTrick.length < 4) {
    room.turn = nextMark(mark);
    return;
  }

  const winner = trickWinner(room.currentTrick, room.trump);
  room.trickCount[winner] += 1;
  room.completedTricks += 1;
  room.lastAction = `${markLabel(winner)} eli aldi.`;
  room.currentTrick = [];
  if (room.completedTricks >= 13) {
    finishRound(room);
    return;
  }
  room.turn = winner;
}

function wouldWinWithCard(room, card) {
  if (!room.currentTrick.length) return true;
  const leadSuit = room.currentTrick[0].card.suit;
  const currentWinnerCard = room.currentTrick.reduce((best, item) => (
    compareTrickCards(item.card, best.card, leadSuit, room.trump) > 0 ? item : best
  )).card;
  return compareTrickCards(card, currentWinnerCard, leadSuit, room.trump) > 0;
}

function chooseBotCard(room, mark) {
  const legal = legalCards(room, mark);
  const contractOwner = room.highestBidder === mark;
  const sorted = legal.slice().sort((left, right) => left.rank - right.rank);
  const winning = sorted.filter((card) => wouldWinWithCard(room, card));

  if (!room.currentTrick.length) {
    const leadSuit = bestSuitForHand(room.hands[mark]).suit;
    const sameSuit = sorted.filter((card) => card.suit === leadSuit);
    return (sameSuit[0] || sorted[0]).id;
  }

  if (winning.length) {
    const nonTrumpWinning = winning.filter((card) => card.suit !== room.trump);
    const pool = nonTrumpWinning.length ? nonTrumpWinning : winning;
    return pool[0].id;
  }

  if (contractOwner) {
    const lowNonTrump = sorted.find((card) => card.suit !== room.trump);
    return (lowNonTrump || sorted[0]).id;
  }

  return sorted[0].id;
}

function runBots(room) {
  let guard = 0;
  while (guard < 48) {
    guard += 1;
    if (room.status !== 'playing') return;
    const current = room.players[room.turn];
    if (!current || !current.bot) return;
    if (room.phase === 'bidding') {
      resolveBid(room, current.mark, chooseBotBid(room, current.mark));
    } else if (room.phase === 'trump') {
      resolveTrump(room, current.mark, chooseBotTrump(room, current.mark));
    } else if (room.phase === 'playing') {
      resolvePlay(room, current.mark, chooseBotCard(room, current.mark));
    } else {
      return;
    }
  }
}

function publicCard(card) {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    label: cardLabel(card),
    className: cardClass(card)
  };
}

function publicState(room, seat) {
  const visibleHands = {};
  const seatInfos = {};
  MARKS.forEach((mark) => {
    const relative = seatRelative(seat, mark);
    visibleHands[relative] = mark === seat ? room.hands[mark].map(publicCard) : room.hands[mark].length;
    const bidValue = room.bids[mark];
    const bidText = bidValue === null ? '-' : bidValue === 'pass' ? 'Pas' : String(bidValue);
    seatInfos[relative] = `${room.trickCount[mark]} el | Ihale: ${bidText}`;
  });
  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    turn: room.turn ? seatRelative(seat, room.turn) : null,
    seat,
    players: Object.fromEntries(MARKS.map((mark) => [seatRelative(seat, mark), room.players[mark]])),
    currentBid: room.currentBid || null,
    highestBidder: room.highestBidder ? seatRelative(seat, room.highestBidder) : null,
    trump: room.trump,
    remainingTricks: 13 - room.completedTricks,
    hand: room.hands[seat].map(publicCard),
    legalCardIds: room.phase === 'playing' && room.turn === seat ? legalCards(room, seat).map((card) => card.id) : [],
    visibleHands,
    seatInfos,
    currentTrick: room.currentTrick.map((item) => ({
      seat: seatRelative(seat, item.mark),
      player: room.players[item.mark] ? room.players[item.mark].name : markLabel(item.mark),
      card: publicCard(item.card)
    })),
    bidHistory: room.bidHistory.slice(-12).map((item) => ({
      seat: seatRelative(seat, item.mark),
      player: room.players[item.mark] ? room.players[item.mark].name : markLabel(item.mark),
      bid: item.bid
    })),
    trickCount: {
      self: room.trickCount[seat],
      right: room.trickCount[MARKS[(MARKS.indexOf(seat) + 1) % 4]],
      top: room.trickCount[MARKS[(MARKS.indexOf(seat) + 2) % 4]],
      left: room.trickCount[MARKS[(MARKS.indexOf(seat) + 3) % 4]]
    },
    scoreBreakdown: room.scoreBreakdown ? {
      self: room.scoreBreakdown[seat],
      right: room.scoreBreakdown[MARKS[(MARKS.indexOf(seat) + 1) % 4]],
      top: room.scoreBreakdown[MARKS[(MARKS.indexOf(seat) + 2) % 4]],
      left: room.scoreBreakdown[MARKS[(MARKS.indexOf(seat) + 3) % 4]]
    } : null,
    finishReason: room.finishReason,
    lastAction: room.lastAction
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
    resetRound(room, 'Masa doldu. Ihale basliyor.');
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

app.post('/api/rooms/:code/bid', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    resolveBid(room, seat, req.body.bid === 'pass' ? null : req.body.bid);
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/rooms/:code/trump', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    resolveTrump(room, seat, req.body.suit);
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/rooms/:code/play', requireYearbookUser, (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Oda bulunamadi.' });
  const seat = MARKS.find((mark) => room.players[mark] && room.players[mark].id === String(req.currentUser.id));
  if (!seat) return res.status(403).json({ error: 'Bu odada degilsin.' });
  try {
    resolvePlay(room, seat, String(req.body.cardId || ''));
    room.updatedAt = Date.now();
    runBots(room);
    return res.json(publicState(room, seat));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = app;
