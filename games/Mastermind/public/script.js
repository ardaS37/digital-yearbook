const BASE = '/games/mastermind/play';
const API = `${BASE}/api`;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'black'];

let player = null;
let room = null;
let pollTimer = null;
let roomsTimer = null;
let currentGuess = [null, null, null, null, null];
let selectedSlot = 0;

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
  turnLabel: document.getElementById('turn-label'),
  message: document.getElementById('message'),
  secret: document.getElementById('secret'),
  currentGuess: document.getElementById('current-guess'),
  submit: document.getElementById('submit-guess'),
  palette: document.getElementById('palette'),
  history: document.getElementById('history')
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
  resetGuess();
  setRoom(data);
  await loadOpenRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Odaya katılamadın.', 'error');
  resetGuess();
  setRoom(data);
  await loadOpenRooms();
}

function setRoom(data) {
  room = data;
  els.roomTitle.textContent = `Oda ${data.code}`;
  els.turnLabel.textContent = data.status === 'finished' ? '-' : markName(data.state.turn);
  if (data.status === 'waiting') setMessage('Oda açık. Rakip bekleniyor.');
  else if (data.status === 'finished') {
    const winnerText = `${markName(data.state.winner)} kazandı.`;
    setMessage(data.finishReason || `Oyun bitti: ${winnerText}`, 'success');
  } else if (data.state.phase === 'setting') {
    if (data.mark === data.state.codemaker) setMessage('Gizli kodu belirleyip kilitle.', 'success');
    else setMessage('Kod kurucunun gizli kodu belirlemesi bekleniyor.');
  } else if (data.state.turn === data.mark) {
    setMessage('Tahmin sırası sende.', 'success');
  } else {
    setMessage('Tahminci oynuyor, bekliyorsun.');
  }
  renderAll();
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

function resetGuess() {
  currentGuess = [null, null, null, null, null];
  selectedSlot = 0;
}

function canMove() {
  return room && room.status === 'playing' && (
    (room.state.phase === 'setting' && room.mark === room.state.codemaker) ||
    (room.state.phase === 'guessing' && room.state.turn === room.mark && room.mark === room.state.guesser)
  );
}

async function submitGuess() {
  if (!canMove()) return setMessage(room?.state?.phase === 'setting' ? 'Kod kurma sırası sende değil.' : 'Sıra sende değil.', 'error');
  if (currentGuess.some((item) => item === null)) return setMessage('5 renk seçmelisin.', 'error');
  const response = await fetch(`${API}/rooms/${room.code}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(room.state.phase === 'setting' ? { secret: currentGuess } : { guess: currentGuess })
  });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Tahmin gönderilemedi.', 'error');
  resetGuess();
  setRoom(data);
}

function peg(colorIndex, extra = '') {
  const cls = colorIndex === null || colorIndex === undefined ? 'empty' : COLORS[colorIndex];
  return `<span class="peg ${cls} ${extra}"></span>`;
}

function renderSecret() {
  const secret = room?.state?.secret;
  els.secret.innerHTML = secret
    ? `<span>Gizli Kod</span><div>${secret.map((color) => peg(color)).join('')}</div>`
    : `<span>Gizli Kod</span><div>${Array.from({ length: 5 }, () => peg(null, 'locked')).join('')}</div>`;
}

function renderCurrentGuess() {
  els.currentGuess.innerHTML = currentGuess.map((color, index) => `
    <button type="button" class="guess-slot ${selectedSlot === index ? 'selected' : ''}" data-slot="${index}">
      ${peg(color)}
    </button>
  `).join('');
  els.currentGuess.querySelectorAll('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedSlot = Number(button.getAttribute('data-slot'));
      renderCurrentGuess();
    });
  });
}

function renderPalette() {
  els.palette.innerHTML = COLORS.map((color, index) => `<button type="button" class="color ${color}" data-color="${index}" aria-label="Renk ${index + 1}" ${canMove() ? '' : 'disabled'}></button>`).join('');
  els.palette.querySelectorAll('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!canMove()) return;
      currentGuess[selectedSlot] = Number(button.getAttribute('data-color'));
      selectedSlot = Math.min(selectedSlot + 1, currentGuess.length - 1);
      renderCurrentGuess();
    });
  });
}

function renderHistory() {
  const guesses = room?.state?.guesses || [];
  if (!guesses.length) {
    els.history.innerHTML = '<p class="empty-history">Henüz tahmin yok.</p>';
    return;
  }
  els.history.innerHTML = guesses.slice().reverse().map((entry) => `
    <div class="history-row">
      <strong>#${entry.number} ${escapeHtml(markName(entry.mark))}</strong>
      <div class="guess-pegs">${entry.guess.map((color) => peg(color)).join('')}</div>
      <div class="feedback" title="Siyah: doğru yer, Beyaz: yanlış yer">
        ${Array.from({ length: entry.exact }, () => '<i class="black"></i>').join('')}
        ${Array.from({ length: entry.misplaced }, () => '<i class="white"></i>').join('')}
        ${Array.from({ length: room.codeLength - entry.exact - entry.misplaced }, () => '<i class="empty"></i>').join('')}
      </div>
    </div>
  `).join('');
}

function renderAll() {
  renderSecret();
  renderCurrentGuess();
  renderPalette();
  renderHistory();
  els.submit.textContent = room?.state?.phase === 'setting' ? 'Gizli Kodu Kilitle' : 'Tahmini Gönder';
  els.submit.disabled = !canMove();
}

async function init() {
  await loadMe();
  renderAll();
  await loadOpenRooms();
  roomsTimer = window.setInterval(loadOpenRooms, 5000);
}

els.pcMode.addEventListener('click', () => createRoom(true));
els.newPc.addEventListener('click', () => createRoom(true));
els.createRoom.addEventListener('click', () => createRoom(false));
els.refreshRooms.addEventListener('click', loadOpenRooms);
els.submit.addEventListener('click', submitGuess);
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCodeInput.value.trim().toUpperCase();
  if (!code) return setMessage('Oda kodu gir.', 'error');
  joinRoom(code);
});
els.select.addEventListener('change', () => {
  const type = els.select.value;
  if (type === 'mastermind') return;
  if (type === 'dortlu-birlestir') window.location.href = '/games/dortlu-birlestir/play/';
  else if (type === 'satranc') window.location.href = '/games/satranc/play/';
  else if (type === 'dama') window.location.href = '/games/dama/play/';
  else if (type === 'capraz-dama') window.location.href = '/games/capraz-dama/play/';
  else if (type === 'mangala') window.location.href = '/games/mangala/play/';
  else if (type === 'reversi') window.location.href = '/games/reversi/play/';
  else window.location.href = `/games/board/play/?game=${encodeURIComponent(type)}`;
});

init();
