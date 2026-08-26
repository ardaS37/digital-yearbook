const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  batak: '/games/batak/play/',
  okey: '/games/okey/play/',
  '101-okey': '/games/101-okey/play/',
  'nane-okey': '/games/nane-okey/play/',
  reversi: '/games/reversi/play/',
  mangala: '/games/mangala/play/',
  kuyulamac: '/games/kuyulamac/play/',
  alti: '/games/alti/play/',
  go: '/games/go/play/',
  abalone: '/games/abalone/play/',
  tavla: '/games/tavla/play/',
  koridor: '/games/koridor/play/',
  dama: '/games/dama/play/',
  'capraz-dama': '/games/capraz-dama/play/',
  '9-tas': '/games/9-tas/play/',
  '3-tas': '/games/3-tas/play/',
  domino: '/games/domino/play/',
  'kutu-doldurmaca': '/games/kutu-doldurmaca/play/',
  satranc: '/games/satranc/play/',
  xox: '/games/xox/play/',
  sos: '/games/sos/play/',
  'dortlu-birlestir': '/games/dortlu-birlestir/play/',
  mastermind: '/games/mastermind/play/',
  'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  'kizma-birader': '/games/kizma-birader/play/'
};

const SEAT_LABELS = { self: 'Sen', right: 'Doğu', top: 'Kuzey', left: 'Batı' };
const SUIT_LABELS = {
  spades: '♠ Maça',
  hearts: '♥ Kupa',
  diamonds: '♦ Karo',
  clubs: '♣ Sinek'
};

let room = null;
let pollTimer = null;
let selectedCardId = '';

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  phase: document.getElementById('phase'),
  players: document.getElementById('players'),
  currentBid: document.getElementById('current-bid'),
  trumpLabel: document.getElementById('trump-label'),
  highestBidder: document.getElementById('highest-bidder'),
  remainingTricks: document.getElementById('remaining-tricks'),
  message: document.getElementById('message'),
  turnBanner: document.getElementById('turn-banner'),
  hand: document.getElementById('hand'),
  trickBoard: document.getElementById('trick-board'),
  bidHistory: document.getElementById('bid-history'),
  seatA: document.getElementById('seat-a'),
  seatO: document.getElementById('seat-o'),
  seatB: document.getElementById('seat-b'),
  seatAInfo: document.getElementById('seat-a-info'),
  seatOInfo: document.getElementById('seat-o-info'),
  seatBInfo: document.getElementById('seat-b-info'),
  selectedLabel: document.getElementById('selected-label'),
  playBtn: document.getElementById('play-btn'),
  passBtn: document.getElementById('pass-btn'),
  bid8: document.getElementById('bid-8'),
  bid9: document.getElementById('bid-9'),
  bid10: document.getElementById('bid-10'),
  bid11: document.getElementById('bid-11'),
  bid12: document.getElementById('bid-12'),
  bid13: document.getElementById('bid-13'),
  trumpPanel: document.getElementById('trump-panel'),
  pcRoom: document.getElementById('pc-room'),
  createRoom: document.getElementById('create-room'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  refresh: document.getElementById('refresh'),
  openList: document.getElementById('open-list'),
  scoreSelf: document.getElementById('score-x'),
  scoreRight: document.getElementById('score-a'),
  scoreTop: document.getElementById('score-o'),
  scoreLeft: document.getElementById('score-b')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isMyTurn() {
  return room && room.status === 'playing' && room.turn === 'self';
}

function canBid(value) {
  return room && room.phase === 'bidding' && isMyTurn() && value > Number(room.currentBid || 0);
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function cardHtml(card, selected = false, legal = false) {
  return `
    <button type="button" class="${escapeHtml(card.className)} hand-card ${selected ? 'selected' : ''} ${legal ? 'legal' : ''}">
      <span class="rank">${escapeHtml(card.label)}</span>
    </button>
  `;
}

function backCards(count) {
  return Array.from({ length: Number(count || 0) }, () => '<div class="card back"></div>').join('');
}

async function loadRooms() {
  const response = await fetch(`${API}/rooms`);
  const data = await response.json();
  if (!response.ok) {
    els.openList.textContent = data.error || 'Odalar alınamadı.';
    return;
  }
  if (!data.rooms.length) {
    els.openList.textContent = 'Açık oda yok.';
    return;
  }
  els.openList.innerHTML = data.rooms.map((item) => `
    <div class="open-room-row">
      <span><strong>${item.code}</strong><br>${item.seats}/4 oyuncu</span>
      <button data-join="${item.code}" type="button">Katıl</button>
    </div>
  `).join('');
  els.openList.querySelectorAll('[data-join]').forEach((button) => {
    button.addEventListener('click', () => joinRoom(button.dataset.join));
  });
}

function renderPlayerList() {
  els.players.innerHTML = ['self', 'right', 'top', 'left']
    .map((seat) => `${SEAT_LABELS[seat]}: <strong>${escapeHtml(room.players[seat] ? room.players[seat].name : 'Bekliyor')}</strong>`)
    .join('<br>');
}

function renderHand() {
  els.hand.innerHTML = '';
  if (!room) return;
  room.hand.forEach((card) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = cardHtml(card, selectedCardId === card.id, room.legalCardIds.includes(card.id));
    const button = wrapper.firstElementChild;
    button.disabled = !(room.phase === 'playing' && isMyTurn());
    button.addEventListener('click', () => {
      selectedCardId = selectedCardId === card.id ? '' : card.id;
      updateControls();
      renderHand();
    });
    els.hand.appendChild(button);
  });
}

function renderTrick() {
  const slots = {
    top: '<div class="trick-slot empty">Kuzey</div>',
    left: '<div class="trick-slot empty">Batı</div>',
    right: '<div class="trick-slot empty">Doğu</div>',
    self: '<div class="trick-slot empty">Sen</div>'
  };
  if (room) {
    room.currentTrick.forEach((item) => {
      slots[item.seat] = `
        <div class="trick-slot">
          <div class="${escapeHtml(item.card.className)} trick-card"><span>${escapeHtml(item.card.label)}</span></div>
          <small>${escapeHtml(item.player)}</small>
        </div>
      `;
    });
  }
  els.trickBoard.innerHTML = `
    <div class="trick-top">${slots.top}</div>
    <div class="trick-middle">
      ${slots.left}
      <div class="trick-center">${room && room.trump ? escapeHtml(SUIT_LABELS[room.trump]) : 'Koz yok'}</div>
      ${slots.right}
    </div>
    <div class="trick-bottom">${slots.self}</div>
  `;
}

function renderBids() {
  if (!room || !room.bidHistory.length) {
    els.bidHistory.innerHTML = '<div class="history-empty">Henüz ihale yok.</div>';
    return;
  }
  els.bidHistory.innerHTML = room.bidHistory.map((entry) => `
    <div class="history-row">
      <strong>${escapeHtml(entry.player)}</strong>
      <span>${entry.bid === null ? 'Pas' : `${entry.bid}`}</span>
    </div>
  `).join('');
}

function updateControls() {
  const selectedCard = room && room.hand.find((card) => card.id === selectedCardId);
  if (!selectedCard) selectedCardId = '';
  els.selectedLabel.textContent = selectedCard ? `${selectedCard.label} seçili` : 'Kart seçilmedi';
  els.playBtn.disabled = !(selectedCard && room && room.phase === 'playing' && isMyTurn() && room.legalCardIds.includes(selectedCard.id));
  els.passBtn.disabled = !(room && room.phase === 'bidding' && isMyTurn());
  [8, 9, 10, 11, 12, 13].forEach((value) => {
    els[`bid${value}`].disabled = !canBid(value);
  });
  els.trumpPanel.classList.toggle('active', !!(room && room.phase === 'trump' && isMyTurn()));
  if (!room) return;
  els.phase.textContent = room.status === 'finished'
    ? 'Bitti'
    : room.status === 'waiting'
      ? 'Bekleme'
    : room.phase === 'bidding'
      ? 'İhale'
      : room.phase === 'trump'
        ? 'Koz'
        : 'Kart';
  els.phase.className = `phase-chip ${room.phase}`;
}

function setRoom(data) {
  room = data;
  if (!room.hand.some((card) => card.id === selectedCardId)) selectedCardId = '';
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.currentBid.textContent = data.currentBid || '-';
  els.highestBidder.textContent = data.highestBidder ? SEAT_LABELS[data.highestBidder] : '-';
  els.trumpLabel.textContent = data.trump ? SUIT_LABELS[data.trump] : '-';
  els.remainingTricks.textContent = String(data.remainingTricks);
  els.turnBanner.textContent = data.status === 'finished'
    ? (data.finishReason || 'El bitti')
    : data.status === 'waiting'
      ? 'Masa açık | Oyuncular bekleniyor'
    : data.phase === 'bidding'
      ? `Sıra: ${SEAT_LABELS[data.turn]} | İhale`
      : data.phase === 'trump'
        ? `Sıra: ${SEAT_LABELS[data.turn]} | Koz seçimi`
        : `Sıra: ${SEAT_LABELS[data.turn]} | Kart oynama`;
  renderPlayerList();
  els.seatA.innerHTML = Array.isArray(data.visibleHands.right) ? '' : backCards(data.visibleHands.right);
  els.seatO.innerHTML = Array.isArray(data.visibleHands.top) ? '' : backCards(data.visibleHands.top);
  els.seatB.innerHTML = Array.isArray(data.visibleHands.left) ? '' : backCards(data.visibleHands.left);
  els.seatAInfo.textContent = data.seatInfos.right;
  els.seatOInfo.textContent = data.seatInfos.top;
  els.seatBInfo.textContent = data.seatInfos.left;
  els.scoreSelf.textContent = String((data.scoreBreakdown && data.scoreBreakdown.self) ?? data.trickCount.self);
  els.scoreRight.textContent = String((data.scoreBreakdown && data.scoreBreakdown.right) ?? data.trickCount.right);
  els.scoreTop.textContent = String((data.scoreBreakdown && data.scoreBreakdown.top) ?? data.trickCount.top);
  els.scoreLeft.textContent = String((data.scoreBreakdown && data.scoreBreakdown.left) ?? data.trickCount.left);
  if (data.status === 'finished') setMessage(data.finishReason || data.lastAction || 'El bitti.', 'success');
  else if (data.status === 'waiting') setMessage(data.lastAction || 'Masa açık. Diğer oyuncular bekleniyor.');
  else if (isMyTurn()) {
    if (data.phase === 'bidding') setMessage('İhale ver veya pas geç.', 'success');
    else if (data.phase === 'trump') setMessage('Kozu seç.', 'success');
    else setMessage('Sıra sende. Uygun kartı oyna.', 'success');
  } else {
    setMessage(data.lastAction || 'Diğer oyuncular bekleniyor.');
  }
  renderHand();
  renderTrick();
  renderBids();
  updateControls();
  startPolling();
}

async function createRoom(bot) {
  const response = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Oda kurulamadı.', 'error');
  setRoom(data);
  await loadRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Odaya katılamadın.', 'error');
  setRoom(data);
  await loadRooms();
}

async function refreshRoom() {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}`);
  const data = await response.json();
  if (!response.ok) return stopPolling();
  setRoom(data);
}

function startPolling() {
  stopPolling();
  pollTimer = window.setTimeout(refreshRoom, room && room.status === 'finished' ? 4500 : 1800);
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function sendBid(bid) {
  const response = await fetch(`${API}/rooms/${room.code}/bid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bid })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'İhale gönderilemedi.', 'error');
  setRoom(data);
}

async function chooseTrump(suit) {
  const response = await fetch(`${API}/rooms/${room.code}/trump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suit })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Koz seçilemedi.', 'error');
  setRoom(data);
}

async function playSelectedCard() {
  if (!room || !selectedCardId) return;
  const response = await fetch(`${API}/rooms/${room.code}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId: selectedCardId })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Kart oynanamadı.', 'error');
  selectedCardId = '';
  setRoom(data);
}

els.gameSelect.addEventListener('change', (event) => {
  const next = GAME_LINKS[event.target.value];
  if (next) window.location.href = next;
});

els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});
els.refresh.addEventListener('click', () => loadRooms());
els.passBtn.addEventListener('click', () => sendBid('pass'));
[8, 9, 10, 11, 12, 13].forEach((value) => {
  els[`bid${value}`].addEventListener('click', () => sendBid(value));
});
els.playBtn.addEventListener('click', () => playSelectedCard());
els.trumpPanel.querySelectorAll('[data-trump]').forEach((button) => {
  button.addEventListener('click', () => chooseTrump(button.dataset.trump));
});

loadRooms().catch(() => setMessage('Açık odalar alınamadı.', 'error'));
