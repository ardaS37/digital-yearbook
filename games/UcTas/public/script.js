const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const POSITIONS = [
  [10, 10], [50, 10], [90, 10],
  [10, 50], [50, 50], [90, 50],
  [10, 90], [50, 90], [90, 90]
];
const LINES = [
  [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8],
  [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8],
  [0, 4], [4, 8], [2, 4], [4, 6]
];
const NEIGHBORS = {
  0: [1, 3, 4],
  1: [0, 2, 3, 4, 5],
  2: [1, 4, 5],
  3: [0, 1, 4, 6, 7],
  4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [1, 2, 4, 7, 8],
  6: [3, 4, 7],
  7: [3, 4, 5, 6, 8],
  8: [4, 5, 7]
};

const GAME_LINKS = {
  '3-tas': '/games/3-tas/play/',
  '9-tas': '/games/9-tas/play/',
  dama: '/games/dama/play/',
  'capraz-dama': '/games/capraz-dama/play/',
  mangala: '/games/mangala/play/',
  reversi: '/games/reversi/play/',
  xox: '/games/xox/play/',
  sos: '/games/sos/play/',
  'kutu-doldurmaca': '/games/kutu-doldurmaca/play/',
  'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  abalone: '/games/abalone/play/',
  tavla: '/games/tavla/play/',
  koridor: '/games/koridor/play/',
  satranc: '/games/satranc/play/',
  'dortlu-birlestir': '/games/dortlu-birlestir/play/',
  mastermind: '/games/mastermind/play/',
  domino: '/games/domino/play/',
  go: '/games/go/play/',
  'kizma-birader': '/games/kizma-birader/play/'
};

let room = null;
let pollTimer = null;
let selectedFrom = null;

const els = {
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  phase: document.getElementById('phase'),
  message: document.getElementById('message'),
  board: document.getElementById('board'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh'),
  gameSelect: document.getElementById('game-select')
};

function markLabel(mark) {
  return { X: 'Altin', O: 'Mor', draw: 'Berabere' }[mark] || mark;
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function canMove() {
  return room && room.status === 'playing' && room.state.turn === room.mark;
}

async function loadRooms() {
  const response = await fetch(`${API}/rooms`);
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
  selectedFrom = null;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = Object.entries(data.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
  els.turn.textContent = data.status === 'finished' ? '' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.phase.textContent = data.state.phase === 'placing'
    ? `Yerlestirme: ${data.state.placed.X}/3 - ${data.state.placed.O}/3`
    : 'Kaydirma asamasi';
  if (data.status === 'waiting') setMessage('Oda acik. Rakip bekleniyor.');
  else if (data.status === 'finished') setMessage(data.finishReason || `${markLabel(data.state.winner)} kazandi.`, 'success');
  else setMessage(data.state.turn === data.mark ? 'Sira sende.' : 'Rakip bekleniyor.');
  renderBoard();
  startPolling();
}

function startPolling() {
  if (!room) return;
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(async () => {
    if (selectedFrom !== null) return;
    const response = await fetch(`${API}/rooms/${room.code}`);
    if (!response.ok) return;
    setRoom(await response.json());
  }, 1400);
}

async function createRoom(bot) {
  const response = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot })
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

async function move(payload) {
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

function handlePoint(index) {
  if (!canMove()) return;
  const board = room.state.board;
  if (room.state.phase === 'placing') {
    if (board[index]) return;
    move({ to: index });
    return;
  }
  if (board[index] === room.mark) {
    selectedFrom = index;
    renderBoard();
    return;
  }
  if (selectedFrom === null || board[index]) return;
  if (!NEIGHBORS[selectedFrom].includes(index)) {
    setMessage('Sadece bagli komsu noktaya gidebilirsin.', 'error');
    return;
  }
  const from = selectedFrom;
  selectedFrom = null;
  move({ from, to: index });
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;
  const wrap = document.createElement('div');
  wrap.className = 'three-board';
  wrap.innerHTML = `
    <svg class="three-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      ${LINES.map(([a, b]) => `<line class="three-line" x1="${POSITIONS[a][0]}" y1="${POSITIONS[a][1]}" x2="${POSITIONS[b][0]}" y2="${POSITIONS[b][1]}"></line>`).join('')}
    </svg>
  `;
  POSITIONS.forEach(([left, top], index) => {
    const button = document.createElement('button');
    const cell = room.state.board[index];
    const validMove = selectedFrom !== null && !cell && NEIGHBORS[selectedFrom].includes(index);
    button.type = 'button';
    button.className = `three-node ${selectedFrom === index ? 'selected' : ''} ${validMove ? 'valid-move' : ''}`;
    button.style.left = `${left}%`;
    button.style.top = `${top}%`;
    button.disabled = !canMove();
    button.innerHTML = `<span class="three-index">${index + 1}</span>${cell ? `<span class="three-piece ${cell}"></span>` : ''}`;
    button.addEventListener('click', () => handlePoint(index));
    wrap.appendChild(button);
  });
  els.board.appendChild(wrap);
}

els.createRoom.addEventListener('click', () => createRoom(false));
els.pcRoom.addEventListener('click', () => createRoom(true));
els.refresh.addEventListener('click', loadRooms);
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});

els.gameSelect.value = '3-tas';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});

loadRooms();
window.setInterval(loadRooms, 5000);
