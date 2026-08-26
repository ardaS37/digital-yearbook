const BASE = '/games/dortlu-birlestir/play';
const API = `${BASE}/api`;
const ROWS = 6;
const COLS = 7;

let player = null;
let room = null;
let pollTimer = null;
let roomsTimer = null;

const els = {
  select: document.getElementById('game-select'),
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
  countX: document.getElementById('count-x'),
  countO: document.getElementById('count-o'),
  turnLabel: document.getElementById('turn-label'),
  message: document.getElementById('message'),
  board: document.getElementById('board')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function markName(mark) {
  return room && room.players[mark] ? room.players[mark].name : mark;
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
  els.countX.textContent = data.state.board.filter((cell) => cell === 'X').length;
  els.countO.textContent = data.state.board.filter((cell) => cell === 'O').length;
  els.turnLabel.textContent = data.status === 'finished' ? '-' : markName(data.state.turn);
  if (data.status === 'waiting') setMessage('Oda açık. Rakip bekleniyor.');
  else if (data.status === 'finished') {
    setMessage(data.finishReason || (data.state.winner === 'draw' ? 'Oyun bitti: berabere.' : `Oyun bitti: ${markName(data.state.winner)} kazandı.`), 'success');
  } else setMessage(data.state.turn === data.mark ? 'Sıra sende.' : 'Rakip bekleniyor.');
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

function canMove(col) {
  return room && room.status === 'playing' && room.state.turn === room.mark && room.legalMoves.includes(col);
}

async function move(col) {
  if (!canMove(col)) return;
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ col })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  setRoom(data);
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) {
    els.board.innerHTML = '<p class="empty-board">PC’ye karşı başla veya online oda kur.</p>';
    return;
  }
  const win = new Set(room.state.lastMove?.line || []);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const idx = row * COLS + col;
      const cell = room.state.board[idx];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `slot ${canMove(col) ? 'playable' : ''} ${win.has(idx) ? 'win' : ''}`;
      button.setAttribute('aria-label', `${col + 1}. sütun`);
      if (cell) {
        const disc = document.createElement('span');
        disc.className = `disc-piece ${cell.toLowerCase()}`;
        button.appendChild(disc);
      }
      button.addEventListener('click', () => move(col));
      els.board.appendChild(button);
    }
  }
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
els.select.addEventListener('change', () => {
  const type = els.select.value;
  if (type === 'dortlu-birlestir') return;
  if (type === 'satranc') window.location.href = '/games/satranc/play/';
  else if (type === 'dama') window.location.href = '/games/dama/play/';
  else if (type === 'capraz-dama') window.location.href = '/games/capraz-dama/play/';
  else if (type === 'mangala') window.location.href = '/games/mangala/play/';
  else if (type === 'reversi') window.location.href = '/games/reversi/play/';
  else window.location.href = `/games/board/play/?game=${encodeURIComponent(type)}`;
});

init();
