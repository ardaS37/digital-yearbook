const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  uno: '/games/uno/play/',
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
const COLOR_LABELS = { red: 'Kırmızı', yellow: 'Sarı', green: 'Yeşil', blue: 'Mavi' };

let room = null;
let pollTimer = null;
let selectedTileId = '';

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  phase: document.getElementById('phase'),
  players: document.getElementById('players'),
  currentColor: document.getElementById('current-color'),
  direction: document.getElementById('direction'),
  pendingDraw: document.getElementById('pending-draw'),
  drawCount: document.getElementById('draw-count'),
  message: document.getElementById('message'),
  turnBanner: document.getElementById('turn-banner'),
  hand: document.getElementById('hand'),
  discardTop: document.getElementById('discard-top'),
  historyList: document.getElementById('history-list'),
  seatA: document.getElementById('seat-a'),
  seatO: document.getElementById('seat-o'),
  seatB: document.getElementById('seat-b'),
  seatAInfo: document.getElementById('seat-a-info'),
  seatOInfo: document.getElementById('seat-o-info'),
  seatBInfo: document.getElementById('seat-b-info'),
  selectedLabel: document.getElementById('selected-label'),
  playBtn: document.getElementById('play-btn'),
  drawBtn: document.getElementById('draw-btn'),
  endTurnBtn: document.getElementById('end-turn-btn'),
  colorPanel: document.getElementById('color-panel'),
  pcRoom: document.getElementById('pc-room'),
  createRoom: document.getElementById('create-room'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  refresh: document.getElementById('refresh'),
  openList: document.getElementById('open-list'),
  countSelf: document.getElementById('count-self'),
  countRight: document.getElementById('count-right'),
  countTop: document.getElementById('count-top'),
  countLeft: document.getElementById('count-left')
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

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function cardHtml(tile, selected = false, legal = false) {
  return `
    <button type="button" class="${escapeHtml(tile.className)} hand-card ${selected ? 'selected' : ''} ${legal ? 'legal' : ''}">
      <span>${escapeHtml(tile.label)}</span>
    </button>
  `;
}

function backCards(count) {
  return Array.from({ length: Number(count || 0) }, () => '<div class="uno-card back mini"></div>').join('');
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
  room.hand.forEach((tile) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = cardHtml(tile, selectedTileId === tile.id, room.legalTileIds.includes(tile.id));
    const button = wrapper.firstElementChild;
    button.disabled = !(room.phase === 'playing' && isMyTurn());
    button.addEventListener('click', () => {
      selectedTileId = selectedTileId === tile.id ? '' : tile.id;
      updateControls();
      renderHand();
    });
    els.hand.appendChild(button);
  });
}

function renderHistory() {
  if (!room || !room.history.length) {
    els.historyList.innerHTML = '<div class="history-empty">Henüz hareket yok.</div>';
    return;
  }
  els.historyList.innerHTML = room.history.map((entry) => `<div class="history-row">${escapeHtml(entry)}</div>`).join('');
}

function updateControls() {
  const selectedTile = room && room.hand.find((tile) => tile.id === selectedTileId);
  if (!selectedTile) selectedTileId = '';
  els.selectedLabel.textContent = selectedTile ? `${selectedTile.label} seçili` : 'Kart seçilmedi';
  els.playBtn.disabled = !(selectedTile && room && room.phase === 'playing' && isMyTurn() && room.legalTileIds.includes(selectedTile.id));
  els.drawBtn.disabled = !(room && room.status === 'playing' && room.phase === 'playing' && isMyTurn());
  els.endTurnBtn.disabled = !(room && room.status === 'playing' && room.phase === 'playing' && isMyTurn() && room.drawnThisTurn && room.pendingDraw === 0);
  els.colorPanel.classList.toggle('active', !!(room && room.phase === 'choose-color' && isMyTurn()));
  if (!room) return;
  els.phase.textContent = room.status === 'finished'
    ? 'Bitti'
    : room.status === 'waiting'
      ? 'Bekleme'
      : room.phase === 'choose-color'
        ? 'Renk'
        : 'Kart';
  els.phase.className = `phase-chip ${room.phase}`;
}

function setRoom(data) {
  room = data;
  if (!room.hand.some((tile) => tile.id === selectedTileId)) selectedTileId = '';
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.currentColor.textContent = data.currentColor ? COLOR_LABELS[data.currentColor] : '-';
  els.direction.textContent = data.direction === 1 ? 'Saat yonu' : 'Ters yon';
  els.pendingDraw.textContent = String(data.pendingDraw);
  els.drawCount.textContent = String(data.drawCount);
  els.turnBanner.textContent = data.status === 'finished'
    ? (data.finishReason || 'Oyun bitti')
    : data.status === 'waiting'
      ? 'Masa acik | Oyuncular bekleniyor'
      : data.phase === 'choose-color'
        ? `Sira: ${SEAT_LABELS[data.turn]} | Renk secimi`
        : `Sira: ${SEAT_LABELS[data.turn]} | UNO`;
  renderPlayerList();
  els.seatA.innerHTML = Array.isArray(data.visibleHands.right) ? '' : backCards(data.visibleHands.right);
  els.seatO.innerHTML = Array.isArray(data.visibleHands.top) ? '' : backCards(data.visibleHands.top);
  els.seatB.innerHTML = Array.isArray(data.visibleHands.left) ? '' : backCards(data.visibleHands.left);
  els.seatAInfo.textContent = data.seatInfos.right;
  els.seatOInfo.textContent = data.seatInfos.top;
  els.seatBInfo.textContent = data.seatInfos.left;
  els.countSelf.textContent = String(room.hand.length);
  els.countRight.textContent = String(typeof data.visibleHands.right === 'number' ? data.visibleHands.right : data.visibleHands.right.length);
  els.countTop.textContent = String(typeof data.visibleHands.top === 'number' ? data.visibleHands.top : data.visibleHands.top.length);
  els.countLeft.textContent = String(typeof data.visibleHands.left === 'number' ? data.visibleHands.left : data.visibleHands.left.length);
  els.discardTop.innerHTML = data.discardTop ? `<div class="${escapeHtml(data.discardTop.className)} large"><span>${escapeHtml(data.discardTop.label)}</span></div>` : '<div class="uno-card wild large"></div>';
  if (data.status === 'finished') setMessage(data.finishReason || data.lastAction || 'Oyun bitti.', 'success');
  else if (data.status === 'waiting') setMessage(data.lastAction || 'Masa acik. Diger oyuncular bekleniyor.');
  else if (isMyTurn()) {
    if (data.phase === 'choose-color') setMessage('Renk sec.', 'success');
    else if (data.pendingDraw > 0) setMessage(`Cekme cezasi var: ${data.pendingDraw} kart.`, 'error');
    else setMessage('Sira sende. Kart oyna ya da kart cek.', 'success');
  } else {
    setMessage(data.lastAction || 'Diger oyuncular bekleniyor.');
  }
  renderHand();
  renderHistory();
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

async function drawCard() {
  const response = await fetch(`${API}/rooms/${room.code}/draw`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Kart cekilemedi.', 'error');
  setRoom(data);
}

async function playSelectedTile() {
  if (!room || !selectedTileId) return;
  const response = await fetch(`${API}/rooms/${room.code}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tileId: selectedTileId })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Kart oynanamadı.', 'error');
  selectedTileId = '';
  setRoom(data);
}

async function endTurn() {
  const response = await fetch(`${API}/rooms/${room.code}/end-turn`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Tur bitirilemedi.', 'error');
  setRoom(data);
}

async function chooseColor(color) {
  const response = await fetch(`${API}/rooms/${room.code}/choose-color`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Renk secilemedi.', 'error');
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
els.drawBtn.addEventListener('click', () => drawCard());
els.playBtn.addEventListener('click', () => playSelectedTile());
els.endTurnBtn.addEventListener('click', () => endTurn());
els.colorPanel.querySelectorAll('[data-color]').forEach((button) => {
  button.addEventListener('click', () => chooseColor(button.dataset.color));
});

loadRooms().catch(() => setMessage('Acik odalar alinamadi.', 'error'));
