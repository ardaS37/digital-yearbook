const CONFIG = window.__SNAKES_CONFIG__ || { type: 'yilanlar-ve-merdivenler' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  xox: '/games/xox/play/',
  sos: '/games/sos/play/',
  'kutu-doldurmaca': '/games/kutu-doldurmaca/play/',
  '9-tas': '/games/9-tas/play/',
  '3-tas': '/games/3-tas/play/',
  dama: '/games/dama/play/',
  'capraz-dama': '/games/capraz-dama/play/',
  mangala: '/games/mangala/play/',
  kuyulamac: '/games/kuyulamac/play/',
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
const JUMPS = { 3: 22, 5: 8, 11: 26, 20: 29, 27: 1, 21: 9, 17: 4, 19: 7 };
const PLAYER_META = {
  X: { label: 'Yeşil', accent: 'x' },
  O: { label: 'Mor', accent: 'o' },
  A: { label: 'Turuncu', accent: 'a' },
  B: { label: 'Kırmızı', accent: 'b' }
};

let room = null;
let pollTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  lastRoll: document.getElementById('last-roll'),
  leader: document.getElementById('leader'),
  message: document.getElementById('message'),
  board: document.getElementById('board'),
  playerStrip: document.getElementById('player-strip'),
  startBay: document.getElementById('start-bay'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh'),
  rollBtn: document.getElementById('roll-btn')
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

function isBotPlayer(player) {
  return player && /bot/i.test(String(player.name || ''));
}

function currentPositions() {
  return room?.state?.positions || {};
}

function getLeader() {
  const positions = currentPositions();
  const entries = Object.entries(positions);
  if (!entries.length) return '-';
  const best = entries.reduce((max, entry) => (entry[1] > max[1] ? entry : max), entries[0]);
  return `${markLabel(best[0])} (${best[1]})`;
}

function boardCellOrder() {
  const cells = [];
  for (let row = 0; row < 5; row += 1) {
    const base = row * 6;
    const numbers = Array.from({ length: 6 }, (_, index) => base + index + 1);
    cells.push(...(row % 2 === 0 ? numbers : numbers.reverse()));
  }
  return cells.reverse();
}

function cellCenter(number) {
  const order = boardCellOrder();
  const index = order.indexOf(number);
  const row = Math.floor(index / 6);
  const col = index % 6;
  return [col * 100 + 50, row * 100 + 50];
}

function jumpType(from, to) {
  return Number(to) > Number(from) ? 'ladder' : 'snake';
}

function describeJump(position) {
  const next = JUMPS[position];
  if (!next) return '';
  return jumpType(position, next) === 'ladder' ? `Merdiven ${next}` : `Yılan ${next}`;
}

function playerSummaryHtml() {
  if (!room) return '';
  return Object.entries(room.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => {
      const pos = Number(currentPositions()[mark] || 0);
      return `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong> (${pos === 0 ? 'Başlangıç' : pos})`;
    })
    .join('<br>');
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

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = playerSummaryHtml();
  els.turn.textContent = data.status === 'finished' ? '-' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.lastRoll.textContent = data.state.lastRoll ? `${markLabel(data.state.lastRoll.mark)}: ${data.state.lastRoll.roll}` : '-';
  els.leader.textContent = getLeader();

  if (data.status === 'waiting') {
    setMessage('Oda açık. Tüm oyuncular bekleniyor.');
  } else if (data.status === 'finished') {
    setMessage(data.state.winner === 'draw' ? 'Oyun berabere bitti.' : `${markLabel(data.state.winner)} kazandı.`, 'success');
  } else if (data.state.turn === data.mark) {
    setMessage('Sıra sende. Zar at ve kareye ilerle.');
  } else {
    setMessage('Diğer oyuncuların hamlesi bekleniyor.');
  }

  renderPlayerStrip();
  renderStartBay();
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

async function sendMove(payload) {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  setRoom(data);
}

function renderPlayerStrip() {
  els.playerStrip.innerHTML = '';
  if (!room) return;
  Object.entries(room.players).forEach(([mark, player]) => {
    if (!player) return;
    const card = document.createElement('article');
    const meta = PLAYER_META[mark] || { label: mark, accent: '' };
    const position = Number(currentPositions()[mark] || 0);
    const active = room.status === 'playing' && room.state.turn === mark;
    const winner = room.status === 'finished' && room.state.winner === mark;
    card.className = `player-card ${meta.accent} ${active ? 'active' : ''} ${winner ? 'winner' : ''}`;
    card.innerHTML = `
      <div class="player-card-top">
        <span class="player-chip ${meta.accent}">${mark}</span>
        <div>
          <strong>${escapeHtml(player.name)}</strong>
          <p>${meta.label}${isBotPlayer(player) ? ' • Bot' : ''}</p>
        </div>
      </div>
      <div class="player-progress">
        <span>${position === 0 ? 'Başlangıç' : `${position}. kare`}</span>
        <span>${winner ? 'Kazandı' : active ? 'Sırada' : 'Bekliyor'}</span>
      </div>
    `;
    els.playerStrip.appendChild(card);
  });
}

function renderStartBay() {
  els.startBay.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'start-bay-title';
  title.textContent = 'Başlangıç';
  els.startBay.appendChild(title);

  if (!room) {
    const empty = document.createElement('div');
    empty.className = 'start-empty';
    empty.textContent = 'Oyuncular burada başlar.';
    els.startBay.appendChild(empty);
    return;
  }

  const waitingMarks = Object.entries(currentPositions()).filter(([, position]) => Number(position || 0) === 0).map(([mark]) => mark);
  if (!waitingMarks.length) {
    const empty = document.createElement('div');
    empty.className = 'start-empty';
    empty.textContent = 'Tüm piyonlar tahtada.';
    els.startBay.appendChild(empty);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'start-token-grid';
  waitingMarks.forEach((mark) => stack.appendChild(createToken(mark, true)));
  els.startBay.appendChild(stack);
}

function createToken(mark, large = false) {
  const token = document.createElement('span');
  token.className = `token ${PLAYER_META[mark]?.accent || ''} ${large ? 'large' : ''}`;
  token.textContent = mark;
  return token;
}

function renderBoard() {
  els.board.innerHTML = '';
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('class', 'jump-overlay');
  overlay.setAttribute('viewBox', '0 0 600 500');

  Object.entries(JUMPS).forEach(([from, to]) => {
    const [sx, sy] = cellCenter(Number(from));
    const [ex, ey] = cellCenter(Number(to));
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const type = jumpType(from, to);
    const controlY = type === 'ladder' ? Math.min(sy, ey) - 42 : Math.max(sy, ey) + 26;
    path.setAttribute('class', type);
    path.setAttribute('d', `M ${sx} ${sy} Q ${(sx + ex) / 2} ${controlY} ${ex} ${ey}`);
    overlay.appendChild(path);
  });

  const order = boardCellOrder();
  order.forEach((number) => {
    const cell = document.createElement('div');
    const jump = describeJump(number);
    cell.className = `snake-cell ${jump ? jumpType(number, JUMPS[number]) : ''}`;
    cell.innerHTML = `
      <div class="cell-head">
        <span class="cell-number">${number}</span>
        ${jump ? `<span class="cell-jump ${jumpType(number, JUMPS[number])}">${jump}</span>` : ''}
      </div>
    `;
    const stack = document.createElement('div');
    stack.className = 'token-stack';
    if (room) {
      Object.entries(currentPositions()).forEach(([mark, position]) => {
        if (Number(position) === number) stack.appendChild(createToken(mark));
      });
    }
    cell.appendChild(stack);
    els.board.appendChild(cell);
  });

  els.board.appendChild(overlay);
  els.rollBtn.disabled = !canMove();
}

els.gameSelect.value = 'yilanlar-ve-merdivenler';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});
els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refresh.addEventListener('click', loadRooms);
els.rollBtn.addEventListener('click', () => sendMove({ roll: true }));
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});

loadRooms();
window.setInterval(loadRooms, 5000);
