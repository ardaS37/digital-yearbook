const CONFIG = window.__GO_CONFIG__ || { type: 'go' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = { go:'/games/go/play/', domino:'/games/domino/play/', 'kizma-birader':'/games/kizma-birader/play/', koridor:'/games/koridor/play/', tavla:'/games/tavla/play/', '9-tas':'/games/9-tas/play/', '3-tas':'/games/3-tas/play/', dama:'/games/dama/play/', 'capraz-dama':'/games/capraz-dama/play/', mangala:'/games/mangala/play/', reversi:'/games/reversi/play/', xox:'/games/xox/play/', sos:'/games/sos/play/', 'kutu-doldurmaca':'/games/kutu-doldurmaca/play/', 'yilanlar-ve-merdivenler':'/games/yilanlar-ve-merdivenler/play/', abalone:'/games/abalone/play/', satranc:'/games/satranc/play/', 'dortlu-birlestir':'/games/dortlu-birlestir/play/', mastermind:'/games/mastermind/play/' };
let room = null;
let pollTimer = null;

const els = {
  gameSelect: document.getElementById('game-select'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  captures: document.getElementById('captures'),
  message: document.getElementById('message'),
  board: document.getElementById('board'),
  openList: document.getElementById('open-list'),
  roomCode: document.getElementById('room-code'),
  joinForm: document.getElementById('join-form'),
  createRoom: document.getElementById('create-room'),
  pcRoom: document.getElementById('pc-room'),
  refresh: document.getElementById('refresh'),
  passBtn: document.getElementById('pass-btn'),
  size9: document.getElementById('size-9'),
  size13: document.getElementById('size-13'),
  size19: document.getElementById('size-19')
};

function markLabel(mark) {
  return { X: 'Acik', O: 'Koyu', draw: 'Berabere' }[mark] || mark;
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
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.players.innerHTML = Object.entries(data.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
  els.turn.textContent = data.status === 'finished' ? '' : `${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  if (data.state.finalScore) {
    const fs = data.state.finalScore;
    els.captures.textContent = `Toplam: Acik ${fs.total.X} | Koyu ${fs.total.O} | Alan ${fs.territory.X}-${fs.territory.O} | Esir ${fs.captures.X}-${fs.captures.O}`;
  } else {
    els.captures.textContent = `Esir: Acik ${data.state.captures.X} | Koyu ${data.state.captures.O}`;
  }
  highlightSizeButtons(data.state.size, data.status !== 'playing' || data.state.board.every((cell) => !cell));
  if (data.status === 'waiting') setMessage('Oda acik. Rakip bekleniyor.');
  else if (data.status === 'finished') {
    const fs = data.state.finalScore;
    const summary = fs ? ` Skor ${fs.total.X}-${fs.total.O}.` : '';
    setMessage(data.finishReason || `${markLabel(data.state.winner)} kazandi.${summary}`, 'success');
  }
  else if (data.state.turn === data.mark) setMessage('Bos kesisime tas koy veya pas gec.', 'success');
  else setMessage('Rakibin hamlesini bekliyorsun. Tahtayi oku.');
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

async function sendMove(payload) {
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

function starPoints(size) {
  if (size === 9) return new Set([20, 24, 28, 56, 60, 64, 36, 40, 44]);
  if (size === 13) return new Set([42, 45, 48, 81, 84, 87, 120, 123, 126]);
  return new Set([60, 66, 72, 174, 180, 186, 288, 294, 300]);
}

function highlightSizeButtons(size, editable) {
  [els.size9, els.size13, els.size19].forEach((button) => {
    button.classList.toggle('active', button.textContent.startsWith(String(size)));
    button.disabled = !editable;
  });
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;
  const size = room.state.size;
  const stars = starPoints(size);
  els.board.style.gridTemplateColumns = `repeat(${size}, minmax(16px, 1fr))`;
  els.board.style.gridTemplateRows = `repeat(${size}, minmax(16px, 1fr))`;
  els.board.dataset.size = String(size);
  const boardWidth = size >= 19 ? 'min(92vw, 980px)' : size >= 13 ? 'min(86vw, 860px)' : 'min(76vw, 700px)';
  const stoneSize = size >= 19 ? 'clamp(26px, 90%, 44px)' : size >= 13 ? 'clamp(30px, 92%, 52px)' : 'clamp(34px, 94%, 60px)';
  els.board.style.setProperty('--board-width', boardWidth);
  els.board.style.setProperty('--stone-size', stoneSize);
  room.state.board.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `go-point ${!cell && canMove() ? 'valid' : ''}`;
    if (stars.has(index)) button.classList.add('star');
    button.disabled = !!cell || !canMove();
    if (cell) {
      const stone = document.createElement('span');
      stone.className = `stone ${cell.toLowerCase()}`;
      button.appendChild(stone);
    } else if (stars.has(index)) {
      const dot = document.createElement('span');
      dot.className = 'hoshi';
      button.appendChild(dot);
    }
    button.addEventListener('click', () => sendMove({ index }));
    els.board.appendChild(button);
  });
}

els.gameSelect.value = 'go';
els.gameSelect.addEventListener('change', () => {
  const href = GAME_LINKS[els.gameSelect.value];
  if (href) window.location.href = href;
});
els.pcRoom.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refresh.addEventListener('click', loadRooms);
els.passBtn.addEventListener('click', () => sendMove({ pass: true }));
els.size9.addEventListener('click', () => sendMove({ size: 9 }));
els.size13.addEventListener('click', () => sendMove({ size: 13 }));
els.size19.addEventListener('click', () => sendMove({ size: 19 }));
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});
loadRooms();
window.setInterval(loadRooms, 5000);
