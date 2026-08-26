const CONFIG = window.__MORRIS_CONFIG__ || { type: '9-tas', title: '9 Tas' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const POSITIONS = [
  [8, 8], [50, 8], [92, 8], [22, 22], [50, 22], [78, 22], [36, 36], [50, 36], [64, 36],
  [8, 50], [22, 50], [36, 50], [64, 50], [78, 50], [92, 50], [36, 64], [50, 64], [64, 64],
  [22, 78], [50, 78], [78, 78], [8, 92], [50, 92], [92, 92]
];
const LINES = [
  [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8],
  [9, 10], [10, 11], [12, 13], [13, 14], [15, 16], [16, 17],
  [18, 19], [19, 20], [21, 22], [22, 23],
  [0, 9], [9, 21], [3, 10], [10, 18], [6, 11], [11, 15],
  [1, 4], [4, 7], [16, 19], [19, 22], [8, 12], [12, 17], [5, 13], [13, 20], [2, 14], [14, 23]
];
const MILLS = [
  [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
  [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
];
const NEIGHBORS = {
  0:[1,9],1:[0,2,4],2:[1,14],3:[4,10],4:[1,3,5,7],5:[4,13],6:[7,11],7:[4,6,8],8:[7,12],
  9:[0,10,21],10:[3,9,11,18],11:[6,10,15],12:[8,13,17],13:[5,12,14,20],14:[2,13,23],
  15:[11,16],16:[15,17,19],17:[12,16],18:[10,19],19:[16,18,20,22],20:[13,19],
  21:[9,22],22:[19,21,23],23:[14,22]
};

const GAME_LINKS = {
  '9-tas': '/games/9-tas/play/',
  '3-tas': '/games/3-tas/play/',
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
let pendingCapture = null;
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
  return { X: 'Acik', O: 'Koyu', draw: 'Berabere' }[mark] || mark;
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

function publicBoard() {
  return pendingCapture ? pendingCapture.previewBoard : room.state.board;
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
  pendingCapture = null;
  selectedFrom = null;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = Object.entries(data.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
  els.turn.textContent = data.status === 'finished' ? '' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.phase.textContent = data.state.phase === 'placing'
    ? `Yerlestirme: ${data.state.placed.X}/9 - ${data.state.placed.O}/9`
    : 'Hareket asamasi';
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
    if (pendingCapture || selectedFrom !== null) return;
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

function formsMill(board, index, mark) {
  return MILLS.some((line) => line.includes(index) && line.every((pos) => board[pos] === mark));
}

function removableTargets(board, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const opponentPieces = board.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell === opponent);
  const nonMillPieces = opponentPieces.filter(({ index }) => !formsMill(board, index, opponent));
  return (nonMillPieces.length ? nonMillPieces : opponentPieces).map(({ index }) => index);
}

function handlePoint(index) {
  if (!canMove()) return;
  const mark = room.mark;
  const board = publicBoard();

  if (pendingCapture) {
    if (!removableTargets(board, mark).includes(index)) {
      setMessage('Parlayan rakip taslardan birini secmelisin.', 'error');
      return;
    }
    const payload = { ...pendingCapture.move, remove: index };
    pendingCapture = null;
    selectedFrom = null;
    move(payload);
    return;
  }

  if (room.state.phase === 'placing') {
    if (board[index]) return;
    const preview = board.slice();
    preview[index] = mark;
    if (formsMill(preview, index, mark)) {
      pendingCapture = { move: { to: index }, previewBoard: preview };
      setMessage('Degirmen oldu. Simdi alinacak rakip tasi sec.', 'success');
      renderBoard();
      return;
    }
    move({ to: index, remove: null });
    return;
  }

  if (board[index] === mark) {
    selectedFrom = index;
    renderBoard();
    return;
  }

  if (selectedFrom === null || board[index]) return;
  const ownCount = room.state.board.filter((cell) => cell === room.mark).length;
  if (ownCount > 3 && !NEIGHBORS[selectedFrom].includes(index)) {
    setMessage('Bu tas sadece komsu noktaya gidebilir.', 'error');
    return;
  }
  const preview = board.slice();
  preview[selectedFrom] = null;
  preview[index] = mark;
  const from = selectedFrom;
  selectedFrom = null;
  if (formsMill(preview, index, mark)) {
    pendingCapture = { move: { from, to: index }, previewBoard: preview };
    setMessage('Degirmen oldu. Simdi alinacak rakip tasi sec.', 'success');
    renderBoard();
    return;
  }
  move({ from, to: index, remove: null });
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;

  const hint = document.createElement('div');
  hint.className = 'morris-hint';
  if (pendingCapture) {
    hint.innerHTML = '<p>Degirmen tamamlandi. Parlayan rakip tasi sec.</p>';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'mini';
    cancel.textContent = 'Iptal Et';
    cancel.addEventListener('click', () => {
      pendingCapture = null;
      selectedFrom = null;
      setMessage('Secim iptal edildi.');
      renderBoard();
    });
    hint.appendChild(cancel);
  } else {
    hint.innerHTML = room.state.phase === 'placing'
      ? '<p>Taslarini yerlestir. Degirmen kurunca rakip tastan birini alirsin.</p>'
      : '<p>Bir tas sec, sonra hedef noktaya tikla.</p>';
  }
  els.board.appendChild(hint);

  const wrap = document.createElement('div');
  wrap.className = 'morris-board';
  wrap.innerHTML = `
    <svg class="morris-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      ${LINES.map(([a, b]) => `<line class="morris-line" x1="${POSITIONS[a][0]}" y1="${POSITIONS[a][1]}" x2="${POSITIONS[b][0]}" y2="${POSITIONS[b][1]}"></line>`).join('')}
    </svg>
  `;

  const board = publicBoard();
  const captureTargets = pendingCapture ? removableTargets(board, room.mark) : [];
  POSITIONS.forEach(([left, top], index) => {
    const button = document.createElement('button');
    const cell = board[index];
    const ownCount = room.state.board.filter((item) => item === room.mark).length;
    const validMove = selectedFrom !== null && !cell && (ownCount <= 3 || NEIGHBORS[selectedFrom].includes(index));
    button.type = 'button';
    button.className = `morris-node ${selectedFrom === index ? 'selected' : ''} ${captureTargets.includes(index) ? 'capture-target' : ''} ${pendingCapture && cell && cell !== room.mark && !captureTargets.includes(index) ? 'capture-blocked' : ''} ${validMove ? 'valid-move' : ''}`;
    button.style.left = `${left}%`;
    button.style.top = `${top}%`;
    button.disabled = !canMove();
    button.innerHTML = `<span class="morris-index">${index + 1}</span>${cell ? `<span class="morris-piece ${cell}"></span>` : ''}`;
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

els.gameSelect.value = '9-tas';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});

loadRooms();
window.setInterval(loadRooms, 5000);
