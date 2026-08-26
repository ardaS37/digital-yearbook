const BASE = window.location.pathname.startsWith('/games/kuyulamac/play') ? '/games/kuyulamac/play' : '';
const API = `${BASE}/api`;

let player = null;
let room = null;
let pollTimer = null;
let roomsTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  playerName: document.getElementById('player-name'),
  pcMode: document.getElementById('pc-mode'),
  createRoom: document.getElementById('create-room'),
  newPc: document.getElementById('new-pc'),
  refreshRooms: document.getElementById('refresh-rooms'),
  openRoomsList: document.getElementById('open-rooms-list'),
  joinForm: document.getElementById('join-form'),
  roomCodeInput: document.getElementById('room-code-input'),
  roomTitle: document.getElementById('room-title'),
  playerX: document.getElementById('player-x'),
  playerO: document.getElementById('player-o'),
  storeX: document.getElementById('store-x'),
  storeO: document.getElementById('store-o'),
  turnLabel: document.getElementById('turn-label'),
  message: document.getElementById('message'),
  board: document.getElementById('board')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markName(mark) {
  if (!room || !room.players || !room.players[mark]) return mark;
  return room.players[mark].name;
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

async function loadMe() {
  const response = await fetch(`${API}/me`);
  if (response.status === 401) {
    window.location.href = '/login';
    return;
  }
  const data = await response.json();
  player = data.player;
  els.playerName.textContent = player.name;
}

async function loadOpenRooms() {
  try {
    const response = await fetch(`${API}/rooms`);
    const data = await response.json();
    if (!response.ok) {
      els.openRoomsList.textContent = data.error || 'Oda listesi alınamadı.';
      return;
    }
    if (!data.rooms || !data.rooms.length) {
      els.openRoomsList.textContent = 'Bekleyen açık oda yok.';
      return;
    }
    els.openRoomsList.innerHTML = data.rooms.map((item) => `
      <div class="open-room-row">
        <span><strong>${item.code}</strong><br>${escapeHtml(item.hostName)}</span>
        <button type="button" data-join-room="${item.code}">Katıl</button>
      </div>
    `).join('');
    els.openRoomsList.querySelectorAll('[data-join-room]').forEach((button) => {
      button.addEventListener('click', () => joinRoom(button.getAttribute('data-join-room')));
    });
  } catch (error) {
    els.openRoomsList.textContent = 'Oda listesi yenilenemedi.';
  }
}

async function createRoom(bot = false) {
  const response = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Oda kurulamadı.', 'error');
  setRoom(data);
  await loadOpenRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Odaya katılamadın.', 'error');
  setRoom(data);
  await loadOpenRooms();
}

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.playerX.textContent = data.players.X ? data.players.X.name : 'Bekliyor';
  els.playerO.textContent = data.players.O ? data.players.O.name : 'Bekliyor';
  els.storeX.textContent = data.state.stores.X;
  els.storeO.textContent = data.state.stores.O;
  els.turnLabel.textContent = data.status === 'finished' ? '-' : markName(data.state.turn);

  if (data.status === 'waiting') {
    setMessage('Oda açık. Rakip bekleniyor.');
  } else if (data.status === 'finished') {
    setMessage(data.finishReason || (data.state.winner === 'draw' ? 'Oyun bitti: berabere.' : `Oyun bitti: ${markName(data.state.winner)} kazandı.`), 'success');
  } else if (data.state.lastMove && data.state.lastMove.action) {
    setMessage(data.state.turn === data.mark ? `${data.state.lastMove.action} Sıra sende.` : data.state.lastMove.action);
  } else {
    setMessage(data.state.turn === data.mark ? 'Sıra sende.' : 'Rakip bekleniyor.');
  }

  renderBoard();
  startPolling();
}

function startPolling() {
  if (!room) return;
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(async () => {
    const response = await fetch(`${API}/rooms/${room.code}`);
    if (!response.ok) return;
    setRoom(await response.json());
  }, 1400);
}

async function move(pit) {
  if (!room || room.status !== 'playing') return;
  if (room.state.turn !== room.mark) return setMessage('Sıra sende değil.', 'error');
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pit })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  setRoom(data);
}

function canPlay(side, stones) {
  return room && room.status === 'playing' && room.mark === side && room.state.turn === side && stones > 0;
}

function castleOwner(side, index) {
  const castles = room.state.castles || {};
  if (side === 'O' && castles.X === index) return 'X';
  if (side === 'X' && castles.O === index) return 'O';
  return '';
}

function stoneDots(count) {
  return Array.from({ length: Math.min(Number(count) || 0, 24) })
    .map((_, index) => `<i style="--i:${index}"></i>`)
    .join('');
}

function pitButton(side, index, stones) {
  const owner = castleOwner(side, index);
  const button = document.createElement('button');
  button.className = `pit ${side === room.mark ? 'mine' : ''} ${room.state.turn === side ? 'turn' : ''} ${owner ? `castle castle-${owner}` : ''}`;
  button.disabled = !canPlay(side, stones);
  button.innerHTML = `
    <span class="pit-name">${side}${index + 1}</span>
    ${owner ? `<span class="castle-flag">${owner} Kale</span>` : ''}
    <span class="stones">${stoneDots(stones)}</span>
    <strong>${stones}</strong>
  `;
  button.addEventListener('click', () => move(index));
  return button;
}

function storeBox(side, count) {
  const box = document.createElement('div');
  box.className = `store store-${side}`;
  box.innerHTML = `<span>${side} Hazine</span><strong>${count}</strong>`;
  return box;
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) {
    els.board.innerHTML = '<p class="empty-board">PC’ye karşı başla veya online oda kur.</p>';
    return;
  }
  els.board.appendChild(storeBox('O', room.state.stores.O));
  const center = document.createElement('div');
  center.className = 'mangala-center';
  const top = document.createElement('div');
  top.className = 'pit-row opponent';
  room.state.pits.O.slice().reverse().forEach((stones, reverseIndex) => {
    top.appendChild(pitButton('O', 5 - reverseIndex, stones));
  });
  const bottom = document.createElement('div');
  bottom.className = 'pit-row own';
  room.state.pits.X.forEach((stones, index) => {
    bottom.appendChild(pitButton('X', index, stones));
  });
  center.append(top, bottom);
  els.board.appendChild(center);
  els.board.appendChild(storeBox('X', room.state.stores.X));
}

async function init() {
  await loadMe();
  renderBoard();
  await loadOpenRooms();
  roomsTimer = window.setInterval(loadOpenRooms, 5000);
}

els.pcMode.addEventListener('click', () => createRoom(true));
els.newPc.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refreshRooms.addEventListener('click', loadOpenRooms);
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCodeInput.value.trim().toUpperCase();
  if (!code) return setMessage('Oda kodu gir.', 'error');
  joinRoom(code);
});
els.gameSelect.addEventListener('change', () => {
  const type = els.gameSelect.value;
  const routes = {
    kuyulamac: '/games/kuyulamac/play/',
    mangala: '/games/mangala/play/',
    reversi: '/games/reversi/play/',
    xox: '/games/xox/play/',
    sos: '/games/sos/play/',
    dama: '/games/dama/play/',
    'capraz-dama': '/games/capraz-dama/play/',
    tavla: '/games/tavla/play/',
    koridor: '/games/koridor/play/',
    satranc: '/games/satranc/play/',
    'dortlu-birlestir': '/games/dortlu-birlestir/play/',
    mastermind: '/games/mastermind/play/',
    domino: '/games/domino/play/',
    go: '/games/go/play/',
    'kizma-birader': '/games/kizma-birader/play/',
    abalone: '/games/abalone/play/',
    '9-tas': '/games/9-tas/play/',
    '3-tas': '/games/3-tas/play/'
  };
  const direct = routes[type];
  if (direct) {
    window.location.href = direct;
    return;
  }
  window.location.href = `/games/board/play/?game=${encodeURIComponent(type)}`;
});

els.gameSelect.value = 'kuyulamac';
init();
