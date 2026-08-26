const CONFIG = window.__DOTS_CONFIG__ || { type: 'kutu-doldurmaca' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  'kutu-doldurmaca': '/games/kutu-doldurmaca/play/',
  'kizma-birader': '/games/kizma-birader/play/',
  abalone: '/games/abalone/play/',
  'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  xox: '/games/xox/play/',
  sos: '/games/sos/play/',
  '9-tas': '/games/9-tas/play/',
  '3-tas': '/games/3-tas/play/',
  dama: '/games/dama/play/',
  'capraz-dama': '/games/capraz-dama/play/',
  mangala: '/games/mangala/play/',
  kuyulamac: '/games/kuyulamac/play/',
  tavla: '/games/tavla/play/',
  koridor: '/games/koridor/play/',
  satranc: '/games/satranc/play/',
  'dortlu-birlestir': '/games/dortlu-birlestir/play/',
  mastermind: '/games/mastermind/play/',
  domino: '/games/domino/play/',
  go: '/games/go/play/'
};
const PLAYER_META = {
  X: { label: 'Mavi', accent: 'x' },
  O: { label: 'Turuncu', accent: 'o' }
};

let room = null;
let pollTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  boardPreset: document.getElementById('board-preset'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  scores: document.getElementById('scores'),
  closedBoxes: document.getElementById('closed-boxes'),
  message: document.getElementById('message'),
  scoreStrip: document.getElementById('score-strip'),
  board: document.getElementById('board'),
  goalChip: document.getElementById('goal-chip'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh')
};

function markLabel(mark) {
  return PLAYER_META[mark]?.label || (mark === 'draw' ? 'Berabere' : mark);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setMessage(text, type = '') {
  els.message.className = `message ${type}`.trim();
  els.message.textContent = text || '';
}

function canMove() {
  return room && room.status === 'playing' && room.state.turn === room.mark;
}

function linesCount() {
  return Object.keys(room?.state?.lines || {}).length;
}

function boxesCount() {
  return Object.keys(room?.state?.boxes || {}).length;
}

function boardDims(state) {
  const rows = Number(state?.rows || ((state?.size || 5) - 1) || 4);
  const cols = Number(state?.cols || ((state?.size || 5) - 1) || 4);
  return {
    rows,
    cols,
    dotRows: rows + 1,
    dotCols: cols + 1,
    totalBoxes: rows * cols
  };
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

function renderPlayers() {
  if (!room) return '';
  return Object.entries(room.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
}

function renderScoreStrip() {
  els.scoreStrip.innerHTML = '';
  if (!room) return;
  ['X', 'O'].forEach((mark) => {
    const player = room.players[mark];
    if (!player) return;
    const active = room.status === 'playing' && room.state.turn === mark;
    const winner = room.status === 'finished' && room.state.winner === mark;
    const card = document.createElement('article');
    card.className = `score-card ${PLAYER_META[mark].accent} ${active ? 'active' : ''} ${winner ? 'winner' : ''}`;
    card.innerHTML = `
      <div class="score-card-head">
        <span class="player-chip ${PLAYER_META[mark].accent}"></span>
        <div>
          <strong>${escapeHtml(player.name)}</strong>
          <p>${markLabel(mark)}</p>
        </div>
      </div>
      <div class="score-card-meta">
        <span>Kutu</span>
        <strong>${room.state.scores[mark]}</strong>
      </div>
    `;
    els.scoreStrip.appendChild(card);
  });
}

function setRoom(data) {
  room = data;
  const dims = boardDims(data.state);
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = renderPlayers();
  els.turn.textContent = data.status === 'finished' ? '-' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.scores.textContent = `Mavi ${data.state.scores.X} • Turuncu ${data.state.scores.O}`;
  els.closedBoxes.textContent = `${boxesCount()} / ${dims.totalBoxes}`;
  if (els.goalChip) els.goalChip.textContent = `${dims.totalBoxes} kutudan çoğunu al`;
  if (els.boardPreset) els.boardPreset.value = `${dims.cols}x${dims.rows}`;

  if (data.status === 'waiting') {
    setMessage('Oda açık. Rakip bekleniyor.');
  } else if (data.status === 'finished') {
    setMessage(data.state.winner === 'draw' ? 'Oyun berabere bitti.' : `${markLabel(data.state.winner)} kazandı.`, 'success');
  } else if (data.state.turn === data.mark) {
    setMessage('Boş bir çizgi seç.');
  } else {
    setMessage('Rakibin hamlesi bekleniyor.');
  }

  renderScoreStrip();
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
  const boardPreset = els.boardPreset?.value || '4x4';
  const response = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: CONFIG.type, bot, boardPreset })
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

async function sendMove(line) {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  setRoom(data);
}

function createLineButton(line, orientation) {
  const owner = room.state.lines[line] || '';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `line ${orientation} ${owner ? owner.toLowerCase() : 'empty'} ${!owner && canMove() ? 'playable' : ''}`;
  button.disabled = Boolean(owner) || !canMove();
  button.addEventListener('click', () => sendMove(line));
  return button;
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;
  const dims = boardDims(room.state);
  els.board.style.gridTemplateColumns = `repeat(${dims.dotCols * 2 - 1}, minmax(18px, 1fr))`;
  els.board.style.gridTemplateRows = `repeat(${dims.dotRows * 2 - 1}, minmax(18px, 1fr))`;

  for (let r = 0; r < dims.dotRows * 2 - 1; r += 1) {
    for (let c = 0; c < dims.dotCols * 2 - 1; c += 1) {
      const cell = document.createElement('div');
      cell.style.gridRow = String(r + 1);
      cell.style.gridColumn = String(c + 1);

      if (r % 2 === 0 && c % 2 === 0) {
        cell.className = 'dot';
      } else if (r % 2 === 0 && c % 2 === 1) {
        const line = `h-${r / 2}-${(c - 1) / 2}`;
        const button = createLineButton(line, 'h');
        button.style.gridRow = String(r + 1);
        button.style.gridColumn = String(c + 1);
        els.board.appendChild(button);
        continue;
      } else if (r % 2 === 1 && c % 2 === 0) {
        const line = `v-${(r - 1) / 2}-${c / 2}`;
        const button = createLineButton(line, 'v');
        button.style.gridRow = String(r + 1);
        button.style.gridColumn = String(c + 1);
        els.board.appendChild(button);
        continue;
      } else {
        const key = `${(r - 1) / 2}-${(c - 1) / 2}`;
        const owner = room.state.boxes[key] || '';
        cell.className = `box ${owner ? owner.toLowerCase() : 'empty'}`;
        cell.textContent = owner ? markLabel(owner).charAt(0) : '';
      }

      els.board.appendChild(cell);
    }
  }
}

els.gameSelect.value = 'kutu-doldurmaca';
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
