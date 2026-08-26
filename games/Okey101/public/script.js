const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  '101-okey': '/games/101-okey/play/',
  okey: '/games/okey/play/',
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

let room = null;
let pollTimer = null;
let selectedIds = new Set();

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  phase: document.getElementById('phase'),
  players: document.getElementById('players'),
  indicator: document.getElementById('indicator'),
  joker: document.getElementById('joker'),
  discardTop: document.getElementById('discard-top'),
  wallCount: document.getElementById('wall-count'),
  message: document.getElementById('message'),
  turnBanner: document.getElementById('turn-banner'),
  openedState: document.getElementById('opened-state'),
  hand: document.getElementById('hand'),
  tableMelds: document.getElementById('table-melds'),
  discardHistory: document.getElementById('discard-history'),
  seatA: document.getElementById('seat-a'),
  seatO: document.getElementById('seat-o'),
  seatB: document.getElementById('seat-b'),
  drawWall: document.getElementById('draw-wall'),
  takeDiscard: document.getElementById('take-discard'),
  sortColor: document.getElementById('sort-color'),
  sortValue: document.getElementById('sort-value'),
  selectedLabel: document.getElementById('selected-label'),
  openBtn: document.getElementById('open-btn'),
  discardBtn: document.getElementById('discard-btn'),
  finishBtn: document.getElementById('finish-btn'),
  pcRoom: document.getElementById('pc-room'),
  createRoom: document.getElementById('create-room'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  refresh: document.getElementById('refresh'),
  openList: document.getElementById('open-list')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markLabel(mark) {
  return { X: 'Güney', A: 'Doğu', O: 'Kuzey', B: 'Batı', draw: 'Berabere' }[mark] || mark;
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function canAct() {
  return room && room.status === 'playing' && room.turn === room.seat;
}

function tileClass(tile) {
  const color = tile.effective && tile.effective.color ? tile.effective.color : 'neutral';
  return `tile ${color} ${tile.wildcard ? 'wildcard' : ''} ${tile.kind === 'fake' ? 'fake' : ''}`.trim();
}

function tileHtml(tile) {
  return `<div class="${tileClass(tile)}"><span>${escapeHtml(tile.label)}</span></div>`;
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

function renderSeat(target, value) {
  if (Array.isArray(value)) {
    target.innerHTML = value.map((tile) => tileHtml(tile)).join('');
  } else {
    target.innerHTML = Array.from({ length: Number(value || 0) }, () => '<div class="tile back"><span>🂠</span></div>').join('');
  }
}

function renderHand() {
  els.hand.innerHTML = '';
  if (!room) return;
  room.hand.forEach((tile) => {
    const button = document.createElement('button');
    button.type = 'button';
    const selected = selectedIds.has(String(tile.id));
    button.className = `${tileClass(tile)} hand-tile ${selected ? 'selected' : ''}`;
    button.innerHTML = `<span>${escapeHtml(tile.label)}</span>`;
    button.disabled = !canAct() || room.phase !== 'discard';
    button.addEventListener('click', () => {
      const key = String(tile.id);
      if (selectedIds.has(key)) selectedIds.delete(key);
      else selectedIds.add(key);
      renderHand();
      updateSelectionState();
    });
    els.hand.appendChild(button);
  });
}

function renderTableMelds() {
  if (!room || !room.tableMelds.length) {
    els.tableMelds.innerHTML = '<div class="history-empty">Henüz masaya açılan seri yok.</div>';
    return;
  }
  els.tableMelds.innerHTML = room.tableMelds.map((meld) => `
    <div class="meld-card">
      <div class="meld-meta">${escapeHtml(markLabel(meld.owner))} · ${meld.score} puan</div>
      <div class="meld-tiles">${meld.display.map((tile) => tileHtml(tile)).join('')}</div>
    </div>
  `).join('');
}

function renderDiscardHistory() {
  els.discardHistory.innerHTML = room && room.discardHistory.length
    ? room.discardHistory.map((tile) => tileHtml(tile)).join('')
    : '<div class="history-empty">Henüz atılan taş yok.</div>';
}

function updateSelectionState() {
  const selectedCount = selectedIds.size;
  const selectedTiles = room ? room.hand.filter((tile) => selectedIds.has(String(tile.id))) : [];
  els.selectedLabel.textContent = selectedCount
    ? `${selectedCount} taş seçili`
    : 'Taş seçilmedi';
  const singleSelected = selectedTiles.length === 1 ? selectedTiles[0] : null;
  els.openBtn.disabled = !(canAct() && room.phase === 'discard' && selectedCount >= 3);
  els.discardBtn.disabled = !(canAct() && room.phase === 'discard' && !!singleSelected);
  els.finishBtn.disabled = !(canAct() && room.phase === 'discard' && selectedCount >= 3);
  els.drawWall.disabled = !(canAct() && room.phase === 'draw');
  els.takeDiscard.disabled = !(canAct() && room.phase === 'draw' && room.discardTop);
}

function setRoom(data) {
  const previous = new Set(selectedIds);
  room = data;
  selectedIds = new Set(room.hand.filter((tile) => previous.has(String(tile.id))).map((tile) => String(tile.id)));
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.phase.textContent = data.status === 'finished'
    ? 'Bitti'
    : data.phase === 'draw'
      ? 'Çekme'
      : 'Atma';
  els.phase.className = `phase-chip ${data.phase}`;
  els.players.innerHTML = ['X', 'A', 'O', 'B']
    .map((mark) => `${markLabel(mark)}: <strong>${escapeHtml(data.players[mark] ? data.players[mark].name : 'Bekliyor')}</strong>`)
    .join('<br>');
  els.indicator.innerHTML = tileHtml(data.indicator);
  els.joker.innerHTML = `<div class="tile ${data.joker.color} special"><span>${data.joker.color[0].toUpperCase()}${data.joker.value}</span></div>`;
  els.discardTop.innerHTML = data.discardTop ? tileHtml(data.discardTop) : '<div class="tile neutral empty"><span>Boş</span></div>';
  els.wallCount.textContent = String(data.wallCount);
  els.openedState.textContent = data.opened ? 'Evet' : 'Hayır';
  els.turnBanner.textContent = data.status === 'finished'
    ? (data.finishReason || `${markLabel(data.winner)} kazandı`)
    : `Sıra: ${markLabel(data.turn)} | Aşama: ${data.phase === 'draw' ? 'Taş çek' : 'Seri aç / taş at'}`;

  if (data.status === 'waiting') setMessage('Oda açık. 4 oyuncuya tamamlanınca başlar.');
  else if (data.status === 'finished') setMessage(data.finishReason || 'Oyun bitti.', 'success');
  else if (canAct()) setMessage(data.phase === 'draw' ? 'Yerden çek veya yerdekini al.' : 'Seri açabilir, bitirebilir ya da taş atabilirsin.', 'success');
  else setMessage(data.lastAction || 'Rakipleri bekliyorsun.');

  renderSeat(els.seatA, data.visibleHands.A);
  renderSeat(els.seatO, data.visibleHands.O);
  renderSeat(els.seatB, data.visibleHands.B);
  renderHand();
  renderTableMelds();
  renderDiscardHistory();
  updateSelectionState();
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

async function callAction(type, payload = {}) {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  setRoom(data);
}

async function sortHand(mode) {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}/sort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'El dizilemedi.', 'error');
  setRoom(data);
}

function startPolling() {
  if (!room) return;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const response = await fetch(`${API}/rooms/${room.code}`);
    if (!response.ok) return;
    setRoom(await response.json());
  }, 1600);
}

els.gameSelect.value = '101-okey';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});
els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refresh.addEventListener('click', loadRooms);
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});
els.drawWall.addEventListener('click', () => callAction('drawWall'));
els.takeDiscard.addEventListener('click', () => callAction('takeDiscard'));
els.sortColor.addEventListener('click', () => sortHand('color'));
els.sortValue.addEventListener('click', () => sortHand('value'));
els.openBtn.addEventListener('click', () => callAction('open', { ids: Array.from(selectedIds) }));
els.discardBtn.addEventListener('click', () => {
  if (selectedIds.size !== 1) {
    setMessage('Taş atmak için tek taş seçmelisin.', 'error');
    return;
  }
  callAction('discard', { id: Array.from(selectedIds)[0] });
});
els.finishBtn.addEventListener('click', () => callAction('finish', { ids: Array.from(selectedIds) }));

loadRooms();
window.setInterval(loadRooms, 5000);
