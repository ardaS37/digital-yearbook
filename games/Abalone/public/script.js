const CONFIG = window.__ABALONE_CONFIG__ || { type: 'abalone' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
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
  go: '/games/go/play/',
  'kizma-birader': '/games/kizma-birader/play/'
};

const HEX_COORDS = makeHexCoords(4);
const HEX_INDEX = new Map(HEX_COORDS.map((coord, index) => [coord.join(','), index]));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const DIR_META = [
  { key: '-1,0', label: 'Sol' },
  { key: '-1,1', label: 'Üst Sol' },
  { key: '0,-1', label: 'Üst Sağ' },
  { key: '0,1', label: 'Alt Sol' },
  { key: '1,-1', label: 'Alt Sağ' },
  { key: '1,0', label: 'Sağ' }
];
const PLAYER_META = {
  X: { label: 'Siyah', accent: 'x' },
  O: { label: 'Beyaz', accent: 'o' }
};

let room = null;
let pollTimer = null;
let selected = [];

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  pushed: document.getElementById('pushed'),
  selection: document.getElementById('selection'),
  message: document.getElementById('message'),
  marbleBar: document.getElementById('marble-bar'),
  board: document.getElementById('board'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh'),
  clearSelection: document.getElementById('clear-selection'),
  dirPad: document.getElementById('dir-pad')
};

function makeHexCoords(radius) {
  const coords = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= radius) coords.push([q, r]);
    }
  }
  return coords;
}

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

function sameDir(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function oppositeDir(dir) {
  return [-dir[0], -dir[1]];
}

function nextIndex(from, dir) {
  const [q, r] = HEX_COORDS[from];
  return HEX_INDEX.get(`${q + dir[0]},${r + dir[1]}`);
}

function projection(index, dir) {
  const [q, r] = HEX_COORDS[index];
  return q * dir[0] + r * dir[1];
}

function sortedSelection(selection, dir) {
  return selection.slice().sort((a, b) => projection(a, dir) - projection(b, dir));
}

function selectionInfo(selection) {
  const unique = Array.from(new Set(selection)).filter((index) => Number.isInteger(index) && index >= 0 && index < HEX_COORDS.length);
  if (!unique.length || unique.length > 3) return null;
  if (!unique.every((index) => room?.state?.board[index] === room.mark)) return null;
  if (unique.length === 1) return { selection: unique, lineDir: null };
  for (const dir of DIRS) {
    const ordered = sortedSelection(unique, dir);
    let ok = true;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (nextIndex(ordered[i], dir) !== ordered[i + 1]) {
        ok = false;
        break;
      }
    }
    if (ok) return { selection: ordered, lineDir: dir };
  }
  return null;
}

function legalMovesForSelection(selection) {
  if (!room || !canMove()) return [];
  const info = selectionInfo(selection);
  if (!info) return [];
  const { selection: orderedSelection, lineDir } = info;
  const board = room.state.board;
  const opponent = room.mark === 'X' ? 'O' : 'X';
  const moves = [];
  DIRS.forEach((dir) => {
    const inline = orderedSelection.length === 1 || !lineDir || sameDir(dir, lineDir) || sameDir(dir, oppositeDir(lineDir));
    if (inline) {
      const ordered = sortedSelection(orderedSelection, dir);
      const front = ordered[ordered.length - 1];
      const next = nextIndex(front, dir);
      if (next === undefined) return;
      if (!board[next]) {
        moves.push({ dir: dir.join(','), targets: [next] });
        return;
      }
      if (board[next] !== opponent) return;
      const chain = [];
      let cursor = next;
      while (cursor !== undefined && board[cursor] === opponent) {
        chain.push(cursor);
        cursor = nextIndex(cursor, dir);
      }
      if (!chain.length || chain.length >= orderedSelection.length || (cursor !== undefined && board[cursor])) return;
      moves.push({ dir: dir.join(','), targets: chain.concat(cursor !== undefined ? [cursor] : []) });
      return;
    }
    const dests = orderedSelection.map((index) => nextIndex(index, dir));
    if (dests.some((dest) => dest === undefined || board[dest])) return;
    moves.push({ dir: dir.join(','), targets: dests });
  });
  return moves;
}

function moveMap() {
  const info = selectionInfo(selected);
  if (!info) return new Map();
  const map = new Map();
  legalMovesForSelection(info.selection).forEach((move) => map.set(move.dir, move));
  return map;
}

function updateDirPad() {
  const map = moveMap();
  els.dirPad.querySelectorAll('[data-dir]').forEach((button) => {
    const enabled = canMove() && map.has(button.getAttribute('data-dir'));
    button.disabled = !enabled;
    button.classList.toggle('active', enabled);
  });
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

function renderMarbleBar() {
  els.marbleBar.innerHTML = '';
  if (!room) return;
  ['X', 'O'].forEach((mark) => {
    const card = document.createElement('article');
    const pushed = Number(room.state.pushed?.[mark] || 0);
    const mine = room.mark === mark;
    const active = room.status === 'playing' && room.state.turn === mark;
    card.className = `marble-card ${PLAYER_META[mark].accent} ${active ? 'active' : ''} ${mine ? 'mine' : ''}`;
    card.innerHTML = `
      <div class="marble-card-head">
        <span class="player-chip ${PLAYER_META[mark].accent}"></span>
        <div>
          <strong>${markLabel(mark)}</strong>
          <p>${mine ? 'Sen' : 'Rakip'}</p>
        </div>
      </div>
      <div class="marble-score">
        <span>Düşürdüğü</span>
        <strong>${pushed} / 6</strong>
      </div>
    `;
    els.marbleBar.appendChild(card);
  });
}

function clearSelection(keepMessage = false) {
  selected = [];
  els.selection.textContent = 'Taş seç';
  if (!keepMessage && room && room.status === 'playing') {
    setMessage(room.state.turn === room.mark ? '1, 2 veya 3 bilye seçip yön tuşuyla kaydır.' : 'Rakibin hamlesi bekleniyor.');
  }
  updateDirPad();
  renderBoard();
}

function setRoom(data) {
  room = data;
  if (!Array.isArray(selected)) selected = [];
  selected = selected.filter((index) => room?.state?.board[index] === room.mark);
  if (!selectionInfo(selected)) selected = [];
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = renderPlayers();
  els.turn.textContent = data.status === 'finished' ? '-' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  els.pushed.textContent = `Siyah ${data.state.pushed.X} • Beyaz ${data.state.pushed.O}`;
  els.selection.textContent = selected.length ? `${selected.length} taş seçildi` : 'Taş seç';

  if (data.status === 'waiting') {
    setMessage('Oda açık. Rakip bekleniyor.');
  } else if (data.status === 'paused') {
    setMessage(data.finishReason || 'Oyun bir oyuncunun geri bağlanmasını bekliyor.', 'error');
  } else if (data.status === 'finished') {
    setMessage(`${markLabel(data.state.winner)} kazandı.`, 'success');
  } else if (data.state.turn === data.mark) {
    setMessage('1, 2 veya 3 bilye seçip yön tuşuyla kaydır.');
  } else {
    setMessage('Rakibin hamlesi bekleniyor.');
  }

  renderMarbleBar();
  updateDirPad();
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
  selected = [];
  setRoom(data);
  await loadRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Odaya katılamadın.', 'error');
  selected = [];
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
  selected = [];
  els.selection.textContent = 'Taş seç';
  setRoom(data);
}

function sendDirection(dirKey) {
  const info = selectionInfo(selected);
  if (!info) return setMessage('Önce geçerli bir 1-2-3 taş grubu seç.', 'error');
  const map = moveMap();
  const move = map.get(dirKey);
  if (!move) return setMessage('Bu yönde geçerli kaydırma yok.', 'error');
  sendMove({ selected: info.selection, dir: dirKey });
}

function handleCellClick(index) {
  if (!room || !canMove()) return;
  const board = room.state.board;
  if (board[index] !== room.mark) return;
  if (selected.includes(index)) {
    selected = selected.filter((item) => item !== index);
  } else {
    const nextSelection = selected.concat(index);
    if (selectionInfo(nextSelection)) selected = nextSelection;
    else return setMessage('Seçim bitişik ve aynı hizada en fazla 3 taş olmalı.', 'error');
  }
  els.selection.textContent = selected.length ? `${selected.length} taş seçildi` : 'Taş seç';
  if (selected.length) setMessage('Yön tuşlarından biriyle kaydır.');
  updateDirPad();
  renderBoard();
}

function boardPosition(index) {
  const [q, r] = HEX_COORDS[index];
  const x = q + r * 0.5;
  const y = r * 0.866;
  const xs = HEX_COORDS.map(([qq, rr]) => qq + rr * 0.5);
  const ys = HEX_COORDS.map(([, rr]) => rr * 0.866);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    left: 8 + ((x - minX) / (maxX - minX)) * 84,
    top: 9 + ((y - minY) / (maxY - minY)) * 82
  };
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;
  const targetSet = new Set();
  moveMap().forEach((move) => move.targets.forEach((index) => targetSet.add(index)));

  HEX_COORDS.forEach(([q, r], index) => {
    const cell = document.createElement('button');
    const occupant = room.state.board[index];
    const pos = boardPosition(index);
    cell.type = 'button';
    cell.className = `hex-cell ${occupant ? occupant.toLowerCase() : 'empty'} ${selected.includes(index) ? 'selected' : ''} ${targetSet.has(index) ? 'target' : ''}`;
    cell.style.left = `${pos.left}%`;
    cell.style.top = `${pos.top}%`;
    cell.disabled = !canMove();
    cell.addEventListener('click', () => handleCellClick(index));

    const indexTag = document.createElement('span');
    indexTag.className = 'slot-id';
    indexTag.textContent = String(index + 1);
    cell.appendChild(indexTag);

    if (occupant) {
      const marble = document.createElement('span');
      marble.className = `marble ${occupant.toLowerCase()}`;
      marble.textContent = '';
      cell.appendChild(marble);
    }

    els.board.appendChild(cell);
  });
}

els.gameSelect.value = 'abalone';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});
els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refresh.addEventListener('click', loadRooms);
els.clearSelection.addEventListener('click', () => clearSelection());
els.dirPad.querySelectorAll('[data-dir]').forEach((button) => {
  button.addEventListener('click', () => sendDirection(button.getAttribute('data-dir')));
});
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});

loadRooms();
window.setInterval(loadRooms, 5000);
