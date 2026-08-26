const CONFIG = window.__LUDO_CONFIG__ || { type: 'kizma-birader' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  'kizma-birader': '/games/kizma-birader/play/',
  abalone: '/games/abalone/play/',
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
  tavla: '/games/tavla/play/',
  koridor: '/games/koridor/play/',
  satranc: '/games/satranc/play/',
  'dortlu-birlestir': '/games/dortlu-birlestir/play/',
  mastermind: '/games/mastermind/play/',
  domino: '/games/domino/play/',
  go: '/games/go/play/'
};

const PLAYER_META = {
  X: { label: 'Yeşil', accent: 'x', pathOffset: 0 },
  O: { label: 'Mor', accent: 'o', pathOffset: 10 },
  A: { label: 'Turuncu', accent: 'a', pathOffset: 20 },
  B: { label: 'Kırmızı', accent: 'b', pathOffset: 30 }
};
const HOME_COORDS = {
  X: [[1,1],[1,3],[3,1],[3,3]],
  O: [[1,8],[1,10],[3,8],[3,10]],
  A: [[8,8],[8,10],[10,8],[10,10]],
  B: [[8,1],[8,3],[10,1],[10,3]]
};
const FINISH_COORDS = {
  X: [[6,1],[6,2],[6,3],[6,4]],
  O: [[1,6],[2,6],[3,6],[4,6]],
  A: [[6,10],[6,9],[6,8],[6,7]],
  B: [[10,6],[9,6],[8,6],[7,6]]
};
const PATH = [
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],
  [1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],
  [6,9],[6,10],[6,11],[6,12],[7,12],[8,12],[8,11],[8,10],[8,9],[8,8],
  [8,7],[8,6],[9,6],[10,6],[11,6],[12,6],[12,5],[12,4],[11,4],[10,4]
];
const SAFE_STEPS = new Set([0, 10, 20, 30]);

let room = null;
let pollTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  lastRoll: document.getElementById('last-roll'),
  finished: document.getElementById('finished'),
  message: document.getElementById('message'),
  playerStrip: document.getElementById('player-strip'),
  board: document.getElementById('board'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh'),
  rollHome: document.getElementById('roll-home')
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

function globalStep(mark, localPos) {
  return (localPos + PLAYER_META[mark].pathOffset) % 40;
}

function pieceCoord(mark, pieceIndex, pos) {
  if (pos < 0) return HOME_COORDS[mark][pieceIndex];
  if (pos >= 44) return null;
  if (pos >= 40) return FINISH_COORDS[mark][Math.min(pos - 40, 3)];
  return PATH[globalStep(mark, pos)];
}

function pieceState(mark, pieceIndex) {
  return Number(room?.state?.positions?.[mark]?.[pieceIndex] ?? -1);
}

function renderPlayers() {
  if (!room) return '';
  return Object.entries(room.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
}

function finishedText() {
  if (!room) return '-';
  return ['X','O','A','B']
    .filter((mark) => room.players[mark])
    .map((mark) => `${markLabel(mark)} ${room.state.finished[mark]}`)
    .join(' • ');
}

function playerCardText(mark) {
  const positions = room.state.positions[mark] || [];
  const home = positions.filter((pos) => pos < 0).length;
  const track = positions.filter((pos) => pos >= 0 && pos < 40).length;
  const lane = positions.filter((pos) => pos >= 40 && pos < 44).length;
  const done = room.state.finished[mark] || 0;
  return { home, track, lane, done };
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

function renderPlayerStrip() {
  els.playerStrip.innerHTML = '';
  if (!room) return;
  ['X','O','A','B'].forEach((mark) => {
    const player = room.players[mark];
    if (!player) return;
    const state = playerCardText(mark);
    const active = room.status === 'playing' && room.state.turn === mark;
    const winner = room.status === 'finished' && room.state.winner === mark;
    const card = document.createElement('article');
    card.className = `player-card ${PLAYER_META[mark].accent} ${active ? 'active' : ''} ${winner ? 'winner' : ''}`;
    card.innerHTML = `
      <div class="player-card-top">
        <span class="player-chip ${PLAYER_META[mark].accent}"></span>
        <div>
          <strong>${escapeHtml(player.name)}</strong>
          <p>${markLabel(mark)}</p>
        </div>
      </div>
      <div class="player-stats">
        <span>Ev: ${state.home}</span>
        <span>Yolda: ${state.track}</span>
        <span>Koridor: ${state.lane}</span>
        <span>Biten: ${state.done}</span>
      </div>
    `;
    els.playerStrip.appendChild(card);
  });
}

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = renderPlayers();
  els.turn.textContent = data.status === 'finished' ? '-' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.lastRoll.textContent = data.state.lastRoll ? `${markLabel(data.state.lastRoll.mark)}: ${data.state.lastRoll.roll} (P${data.state.lastRoll.piece + 1})` : '-';
  els.finished.textContent = finishedText();

  if (data.status === 'waiting') {
    setMessage('Oda açık. Oyuncular bekleniyor.');
  } else if (data.status === 'finished') {
    setMessage(`${markLabel(data.state.winner)} kazandı.`, 'success');
  } else if (data.state.turn === data.mark) {
    setMessage('Bir piyon seç. Zar otomatik atılacak.');
  } else {
    setMessage('Rakiplerin hamlesi bekleniyor.');
  }

  renderPlayerStrip();
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

async function sendMove(piece) {
  if (!room) return;
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ piece })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
  setRoom(data);
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;

  for (let row = 0; row < 13; row += 1) {
    for (let col = 0; col < 13; col += 1) {
      const square = document.createElement('div');
      square.className = 'board-square';
      square.style.gridRow = String(row + 1);
      square.style.gridColumn = String(col + 1);
      els.board.appendChild(square);
    }
  }

  Object.entries(HOME_COORDS).forEach(([mark, cells]) => {
    cells.forEach(([row, col]) => {
      const spot = document.createElement('div');
      spot.className = `home-spot ${PLAYER_META[mark].accent}`;
      spot.style.gridRow = String(row + 1);
      spot.style.gridColumn = String(col + 1);
      els.board.appendChild(spot);
    });
  });

  Object.entries(FINISH_COORDS).forEach(([mark, cells]) => {
    cells.forEach(([row, col], idx) => {
      const spot = document.createElement('div');
      spot.className = `finish-spot ${PLAYER_META[mark].accent}`;
      spot.style.gridRow = String(row + 1);
      spot.style.gridColumn = String(col + 1);
      spot.textContent = String(idx + 1);
      els.board.appendChild(spot);
    });
  });

  PATH.forEach(([row, col], idx) => {
    const path = document.createElement('div');
    path.className = `path-spot ${SAFE_STEPS.has(idx) ? 'safe' : ''}`;
    path.style.gridRow = String(row + 1);
    path.style.gridColumn = String(col + 1);
    path.textContent = String(idx + 1);
    els.board.appendChild(path);
  });

  ['X','O','A','B'].forEach((mark) => {
    if (!room.players[mark]) return;
    const pieces = room.state.positions[mark] || [];
    pieces.forEach((pos, pieceIndex) => {
      const coord = pieceCoord(mark, pieceIndex, pos);
      if (!coord) return;
      const [row, col] = coord;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `piece ${PLAYER_META[mark].accent} ${canMove() && room.mark === mark ? 'playable' : ''}`;
      button.style.gridRow = String(row + 1);
      button.style.gridColumn = String(col + 1);
      button.textContent = String(pieceIndex + 1);
      button.disabled = !canMove();
      button.addEventListener('click', () => sendMove(pieceIndex));
      els.board.appendChild(button);
    });
  });

  els.rollHome.disabled = !canMove();
}

els.gameSelect.value = 'kizma-birader';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});
els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refresh.addEventListener('click', loadRooms);
els.rollHome.addEventListener('click', () => sendMove(0));
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});

loadRooms();
window.setInterval(loadRooms, 5000);
