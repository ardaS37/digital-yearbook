const CONFIG = window.__ALTI_CONFIG__ || { type: 'alti' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  alti: '/games/alti/play/',
  reversi: '/games/reversi/play/',
  go: '/games/go/play/',
  abalone: '/games/abalone/play/',
  koridor: '/games/koridor/play/',
  xox: '/games/xox/play/',
  sos: '/games/sos/play/',
  '9-tas': '/games/9-tas/play/',
  '3-tas': '/games/3-tas/play/',
  dama: '/games/dama/play/',
  'capraz-dama': '/games/capraz-dama/play/',
  mangala: '/games/mangala/play/',
  kuyulamac: '/games/kuyulamac/play/',
  tavla: '/games/tavla/play/',
  satranc: '/games/satranc/play/',
  'dortlu-birlestir': '/games/dortlu-birlestir/play/',
  mastermind: '/games/mastermind/play/',
  domino: '/games/domino/play/',
  'kutu-doldurmaca': '/games/kutu-doldurmaca/play/',
  'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  'kizma-birader': '/games/kizma-birader/play/'
};

let room = null;
let pollTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  goal: document.getElementById('goal'),
  message: document.getElementById('message'),
  board: document.getElementById('board'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh')
};

function markLabel(mark) {
  return { X: 'Açık', O: 'Koyu', draw: 'Berabere' }[mark] || mark || '';
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

function hexPosition(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const gapX = 68;
  const gapY = 58;
  const offset = row * 34;
  return {
    x: col * gapX + offset + 34,
    y: row * gapY + 34
  };
}

function buildBoardFrame(size) {
  const corners = [
    hexPosition(0, size),
    hexPosition(size - 1, size),
    hexPosition(size * (size - 1), size),
    hexPosition(size * size - 1, size)
  ];
  const width = corners[3].x + 44;
  const height = corners[2].y + 44;
  els.board.style.setProperty('--board-width', `${width}px`);
  els.board.style.setProperty('--board-height', `${height}px`);
}

function winPatternLabel(value) {
  return {
    line: "6'lı çizgi",
    pyramid: "6'lı piramit",
    ring: "6'lı halka"
  }[value] || 'kazanan şekil';
}

async function loadRooms() {
  const response = await fetch(`${API}/rooms?type=${encodeURIComponent(CONFIG.type)}`);
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
      <span><strong>${item.code}</strong><br>${escapeHtml(item.hostName)}</span>
      <button data-join="${item.code}" type="button">Katıl</button>
    </div>
  `).join('');
  els.openList.querySelectorAll('[data-join]').forEach((button) => {
    button.addEventListener('click', () => joinRoom(button.getAttribute('data-join')));
  });
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;
  const size = Number(room.state.size || 7);
  buildBoardFrame(size);

  for (let index = 0; index < size * size; index += 1) {
    const cell = room.state.board[index];
    const pos = hexPosition(index, size);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hex-cell ${cell ? `occupied ${cell.toLowerCase()}` : 'empty'} ${!cell && canMove() ? 'playable' : ''}`;
    button.style.left = `${pos.x}px`;
    button.style.top = `${pos.y}px`;
    button.disabled = !!cell || !canMove();

    const stone = document.createElement('span');
    stone.className = 'stone';
    if (!cell) {
      const label = document.createElement('span');
      label.className = 'coord-label';
      label.textContent = `${String.fromCharCode(65 + (index % size))}${Math.floor(index / size) + 1}`;
      button.appendChild(label);
    }
    button.appendChild(stone);
    button.addEventListener('click', () => sendMove({ index }));
    els.board.appendChild(button);
  }
}

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = Object.entries(data.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
  els.turn.textContent = data.status === 'finished' ? '' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.goal.textContent = "Kazanma şekli: 6'lı çizgi, 6'lı piramit veya 6'lı halka";
  if (data.status === 'waiting') setMessage('Oda açık. Rakip bekleniyor.');
  else if (data.status === 'finished') {
    const shape = data.state && data.state.winPattern ? ` (${winPatternLabel(data.state.winPattern)})` : '';
    setMessage(data.finishReason || `${markLabel(data.state.winner)} kazandı${shape}.`, 'success');
  }
  else if (data.state.turn === data.mark) setMessage('Boş bir altıgene taş koy.', 'success');
  else setMessage('Rakibin hamlesini bekliyorsun.', '');
  renderBoard();
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
  if (!response.ok) {
    setMessage(data.error || 'Oda kurulamadı.', 'error');
    return;
  }
  setRoom(data);
  await loadRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error || 'Odaya katılamadın.', 'error');
    return;
  }
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
  if (!response.ok) {
    setMessage(data.error || 'Hamle yapılamadı.', 'error');
    return;
  }
  setRoom(data);
}

els.gameSelect.value = 'alti';
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

loadRooms();
window.setInterval(loadRooms, 5000);
