const BASE = '/games/satranc/play';
const API = `${BASE}/api`;

let player = null;
let room = null;
let selected = null;
let pollTimer = null;
let roomsTimer = null;

const PIECES = {
  XK: '♔', XQ: '♕', XR: '♖', XB: '♗', XN: '♘', XP: '♙',
  OK: '♚', OQ: '♛', OR: '♜', OB: '♝', ON: '♞', OP: '♟'
};

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

function owner(piece) {
  return piece ? piece[0] : '';
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

function pieceCounts(board) {
  return board.reduce((acc, piece) => {
    if (owner(piece) === 'X') acc.X += 1;
    if (owner(piece) === 'O') acc.O += 1;
    return acc;
  }, { X: 0, O: 0 });
}

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.playerX.textContent = data.players.X ? data.players.X.name : 'Bekliyor';
  els.playerO.textContent = data.players.O ? data.players.O.name : 'Bekliyor';
  const counts = pieceCounts(data.state.board);
  els.countX.textContent = counts.X;
  els.countO.textContent = counts.O;
  els.turnLabel.textContent = data.status === 'finished' ? '-' : markName(data.state.turn);
  if (data.status === 'waiting') setMessage('Oda açık. Rakip bekleniyor.');
  else if (data.status === 'finished') setMessage(data.finishReason || `Oyun bitti: ${markName(data.state.winner)} kazandı.`, 'success');
  else setMessage(data.state.turn === data.mark ? 'Sıra sende.' : 'Rakip bekleniyor.');
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

function canMove() {
  return room && room.status === 'playing' && room.state.turn === room.mark;
}

function legalSet() {
  return new Set((room?.legalMoves || []).map((move) => `${move.from}-${move.to}`));
}

async function move(from, to) {
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  selected = null;
  setRoom(data);
}

function handleCell(index, piece) {
  if (!canMove()) return;
  if (piece && owner(piece) === room.mark) {
    selected = index;
    renderBoard();
    return;
  }
  if (selected === null || (piece && owner(piece) === room.mark)) return;
  move(selected, index);
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) {
    els.board.innerHTML = '<p class="empty-board">PC’ye karşı başla veya online oda kur.</p>';
    return;
  }
  const legal = legalSet();
  room.state.board.forEach((piece, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cell ${(row + col) % 2 ? 'dark' : 'light'} ${selected === index ? 'selected' : ''} ${selected !== null && legal.has(`${selected}-${index}`) ? 'target' : ''}`;
    if (piece) {
      const token = document.createElement('span');
      token.className = `piece ${owner(piece).toLowerCase()}`;
      token.textContent = PIECES[piece] || piece;
      button.appendChild(token);
    }
    button.addEventListener('click', () => handleCell(index, piece));
    els.board.appendChild(button);
  });
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
  if (type === 'satranc') return;
  if (type === 'dortlu-birlestir') window.location.href = '/games/dortlu-birlestir/play/';
  else if (type === 'mastermind') window.location.href = '/games/mastermind/play/';
  else if (type === 'dama') window.location.href = '/games/dama/play/';
  else if (type === 'capraz-dama') window.location.href = '/games/capraz-dama/play/';
  else if (type === 'mangala') window.location.href = '/games/mangala/play/';
  else if (type === 'reversi') window.location.href = '/games/reversi/play/';
  else window.location.href = `/games/board/play/?game=${encodeURIComponent(type)}`;
});

init();
