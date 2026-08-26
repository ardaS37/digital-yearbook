const isCapraz = window.location.pathname.includes('capraz-dama');
const BASE = isCapraz ? '/games/capraz-dama/play' : '/games/dama/play';
const API = `${BASE}/api`;
const GAME_LINKS = {
  dama: '/games/dama/play/',
  'capraz-dama': '/games/capraz-dama/play/',
  mangala: '/games/mangala/play/',
  reversi: '/games/reversi/play/',
  xox: '/games/xox/play/',
  sos: '/games/sos/play/',
  'kutu-doldurmaca': '/games/kutu-doldurmaca/play/',
  'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  '9-tas': '/games/9-tas/play/',
  '3-tas': '/games/3-tas/play/',
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

let player = null;
let room = null;
let selected = null;
let pollTimer = null;
let roomsTimer = null;

const els = {
  title: document.getElementById('game-title'),
  subtitle: document.getElementById('game-subtitle'),
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
  board: document.getElementById('board'),
  rules: document.getElementById('rules-text')
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

function pieceOwner(piece) {
  return piece ? piece[0] : '';
}

function pieceText(piece) {
  if (!piece) return '';
  if (piece === 'XK' || piece === 'OK') return 'D';
  return '';
}

function updateStaticText() {
  els.title.textContent = isCapraz ? 'Çapraz Dama' : 'Dama';
  document.title = els.title.textContent;
  els.select.value = isCapraz ? 'capraz-dama' : 'dama';
  els.subtitle.textContent = isCapraz
    ? 'Çapraz hamleli dama. Yıllık hesabınla PC’ye karşı veya online oyna.'
    : 'Türk dama düzeninde yatay/dikey hamlelerle PC’ye karşı veya online oyna.';
  els.rules.textContent = isCapraz
    ? 'Çapraz Dama’da taşlar çapraz ilerler ve çapraz atlayarak taş alır. Karşı uca ulaşan taş dama olur.'
    : 'Dama’da taşlar ileri veya yana gider, rakip taşı yatay/dikey atlayarak alır. Karşı uca ulaşan taş dama olur.';
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
    body: JSON.stringify({ bot, variant: isCapraz ? 'capraz' : 'turk' })
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
    if (pieceOwner(piece) === 'X') acc.X += 1;
    if (pieceOwner(piece) === 'O') acc.O += 1;
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
  if (data.status === 'waiting') {
    setMessage('Oda açık. Rakip bekleniyor.');
  } else if (data.status === 'finished') {
    setMessage(data.finishReason || `Oyun bitti: ${markName(data.state.winner)} kazandı.`, 'success');
  } else {
    setMessage(data.state.turn === data.mark ? 'Sıra sende.' : 'Rakip bekleniyor.');
  }
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
  if (piece && pieceOwner(piece) === room.mark) {
    selected = index;
    renderBoard();
    return;
  }
  if (selected === null || piece) return;
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
      token.className = `piece ${pieceOwner(piece).toLowerCase()} ${piece.endsWith('K') ? 'king' : ''}`;
      token.textContent = pieceText(piece);
      button.appendChild(token);
    }
    button.addEventListener('click', () => handleCell(index, piece));
    els.board.appendChild(button);
  });
}

async function init() {
  document.body.classList.add(isCapraz ? 'theme-capraz' : 'theme-dama');
  updateStaticText();
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
  const href = GAME_LINKS[els.select.value];
  if (href) window.location.href = href;
});

init();
