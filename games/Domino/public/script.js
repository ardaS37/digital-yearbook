const CONFIG = window.__DOMINO_CONFIG__ || { type: 'domino' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = { domino:'/games/domino/play/', go:'/games/go/play/', 'kizma-birader':'/games/kizma-birader/play/', koridor:'/games/koridor/play/', tavla:'/games/tavla/play/', '9-tas':'/games/9-tas/play/', '3-tas':'/games/3-tas/play/', dama:'/games/dama/play/', 'capraz-dama':'/games/capraz-dama/play/', mangala:'/games/mangala/play/', reversi:'/games/reversi/play/', xox:'/games/xox/play/', sos:'/games/sos/play/', 'kutu-doldurmaca':'/games/kutu-doldurmaca/play/', 'yilanlar-ve-merdivenler':'/games/yilanlar-ve-merdivenler/play/', abalone:'/games/abalone/play/', satranc:'/games/satranc/play/', 'dortlu-birlestir':'/games/dortlu-birlestir/play/', mastermind:'/games/mastermind/play/' };
let room = null;
let pollTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  message: document.getElementById('message'),
  chain: document.getElementById('chain'),
  hand: document.getElementById('hand'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh'),
  passBtn: document.getElementById('pass-btn')
};

function markLabel(mark) {
  return { X: '1', O: '2', A: '3', B: '4', draw: 'Berabere' }[mark] || mark;
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function canMove() {
  return room && room.status === 'playing' && room.state.turn === room.mark;
}

function chainEnds() {
  const chain = room?.state?.chain || [];
  if (!chain.length) return null;
  return { left: chain[0][0], right: chain[chain.length - 1][1] };
}

function orientationHint(tile) {
  const ends = chainEnds();
  if (!ends) return { left: true, right: true };
  const [a, b] = tile;
  return {
    left: a === ends.left || b === ends.left,
    right: a === ends.right || b === ends.right
  };
}

async function loadRooms() {
  const response = await fetch(`${API}/rooms?type=${encodeURIComponent(CONFIG.type)}`);
  const data = await response.json();
  if (!response.ok) {
    els.openList.textContent = data.error || 'Odalar alinamadi.';
    return;
  }
  if (!data.rooms.length) {
    els.openList.textContent = 'Acik oda yok.';
    return;
  }
  els.openList.innerHTML = data.rooms.map((item) => `
    <div class="open-room-row">
      <span><strong>${item.code}</strong><br>${escapeHtml(item.hostName)}</span>
      <button data-join="${item.code}" type="button">Katil</button>
    </div>
  `).join('');
  els.openList.querySelectorAll('[data-join]').forEach((button) => {
    button.addEventListener('click', () => joinRoom(button.getAttribute('data-join')));
  });
}

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = Object.entries(data.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
  els.turn.textContent = data.status === 'finished' ? '' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  if (data.status === 'waiting') setMessage('Oda acik. Rakip bekleniyor.');
  else if (data.status === 'finished') setMessage(data.finishReason || `${markLabel(data.state.winner)} kazandi.`, 'success');
  else if (data.state.turn === data.mark) setMessage('Uygun tasi sec, sola ya da saga birak.', 'success');
  else setMessage('Rakip oynuyor. Zincir ucunu takip et.');
  renderChain();
  renderHand();
  startPolling();
}

function startPolling() {
  if (!room) return;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const response = await fetch(`${API}/rooms/${room.code}`);
    if (!response.ok) return;
    setRoom(await response.json());
  }, 1400);
}

async function createRoom(bot) {
  const response = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: CONFIG.type, bot })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Oda kurulamadi.', 'error');
  setRoom(data);
  await loadRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Odaya katilamadin.', 'error');
  setRoom(data);
  await loadRooms();
}

async function sendMove(payload) {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapilamadi.', 'error');
  setRoom(data);
}

function pipPositions(value) {
  const layouts = {
    0: [],
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  return layouts[value] || [];
}

function pipGrid(value) {
  const slots = Array.from({ length: 9 }, (_, index) => (
    pipPositions(value).includes(index) ? '<span class="pip"></span>' : '<span></span>'
  ));
  return `<div class="pip-grid">${slots.join('')}</div>`;
}

function tileMarkup(tile, classes = '') {
  return `
    <div class="domino-tile ${classes}">
      <div class="half">${pipGrid(tile[0])}<span class="half-value">${tile[0]}</span></div>
      <div class="half">${pipGrid(tile[1])}<span class="half-value">${tile[1]}</span></div>
    </div>
  `;
}

function renderChain() {
  els.chain.innerHTML = '';
  const chain = room?.state?.chain || [];
  if (!chain.length) {
    els.chain.innerHTML = '<div class="empty-chain">Acilis tasi seni bekliyor.</div>';
    return;
  }
  const ends = chainEnds();
  const leftBadge = document.createElement('div');
  leftBadge.className = 'chain-end left';
  leftBadge.textContent = `Sol ${ends.left}`;
  els.chain.appendChild(leftBadge);
  chain.forEach((tile) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = tileMarkup(tile, 'chain-tile');
    els.chain.appendChild(wrap.firstElementChild);
  });
  const rightBadge = document.createElement('div');
  rightBadge.className = 'chain-end right';
  rightBadge.textContent = `Sag ${ends.right}`;
  els.chain.appendChild(rightBadge);
}

function renderHand() {
  els.hand.innerHTML = '';
  if (!room) return;
  const hand = (room.state.hands && room.state.hands[room.mark]) || [];
  const active = canMove();
  hand.forEach((tile, index) => {
    const playable = orientationHint(tile);
    const card = document.createElement('article');
    card.className = `domino-card${(playable.left || playable.right) ? ' playable' : ' blocked'}`;
    card.innerHTML = `
      ${tileMarkup(tile)}
      <div class="play-hints">
        <span class="hint ${playable.left ? 'on' : ''}">Sol</span>
        <span class="hint ${playable.right ? 'on' : ''}">Sag</span>
      </div>
      <div class="domino-actions">
        <button type="button" data-side="left">Sola</button>
        <button type="button" data-side="right">Saga</button>
      </div>
    `;
    card.querySelectorAll('[data-side]').forEach((button) => {
      const side = button.getAttribute('data-side');
      const enabled = side === 'left' ? playable.left : playable.right;
      button.disabled = !active || !enabled;
      button.addEventListener('click', () => sendMove({ index, side }));
    });
    els.hand.appendChild(card);
  });
  if (!hand.length) {
    els.hand.innerHTML = '<div class="empty-chain">Elinde tas kalmadi.</div>';
  }
  els.passBtn.disabled = !active;
}

els.gameSelect.value = 'domino';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});
els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refresh.addEventListener('click', loadRooms);
els.passBtn.addEventListener('click', () => sendMove({ pass: true }));
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});
loadRooms();
window.setInterval(loadRooms, 5000);
