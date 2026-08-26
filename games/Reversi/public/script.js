const BASE = window.location.pathname.startsWith('/games/reversi/play') ? '/games/reversi/play' : '';
const API = `${BASE}/api`;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

let mode = 'ai';
let player = null;
let online = null;
let pollTimer = null;
let roomsTimer = null;
let state = {
  board: createBoard(),
  turn: 'B',
  status: 'playing',
  winner: null,
  color: 'B'
};

const els = {
  gameSelect: document.getElementById('game-select'),
  playerName: document.getElementById('player-name'),
  modeTitle: document.getElementById('mode-title'),
  board: document.getElementById('board'),
  blackScore: document.getElementById('black-score'),
  whiteScore: document.getElementById('white-score'),
  turnLabel: document.getElementById('turn-label'),
  roomInfo: document.getElementById('room-info'),
  message: document.getElementById('message'),
  aiMode: document.getElementById('ai-mode'),
  createRoom: document.getElementById('create-room'),
  refreshRooms: document.getElementById('refresh-rooms'),
  openRoomsList: document.getElementById('open-rooms-list'),
  resetGame: document.getElementById('reset-game'),
  joinForm: document.getElementById('join-form'),
  roomCodeInput: document.getElementById('room-code-input')
};

function createBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[3][3] = 'W';
  board[3][4] = 'B';
  board[4][3] = 'B';
  board[4][4] = 'W';
  return board;
}

function other(color) {
  return color === 'B' ? 'W' : 'B';
}

function onBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function flipsFor(board, row, col, color) {
  if (!onBoard(row, col) || board[row][col]) return [];
  const flips = [];
  DIRS.forEach(([dr, dc]) => {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (onBoard(r, c) && board[r][c] === other(color)) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length && onBoard(r, c) && board[r][c] === color) flips.push(...line);
  });
  return flips;
}

function movesFor(board, color) {
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const flips = flipsFor(board, row, col, color);
      if (flips.length) moves.push({ row, col, flips: flips.length });
    }
  }
  return moves;
}

function score(board) {
  return board.flat().reduce((acc, cell) => {
    if (cell === 'B') acc.black += 1;
    if (cell === 'W') acc.white += 1;
    return acc;
  }, { black: 0, white: 0 });
}

function applyMoveLocal(row, col, color) {
  const flips = flipsFor(state.board, row, col, color);
  if (!flips.length) return false;
  state.board[row][col] = color;
  flips.forEach(([r, c]) => {
    state.board[r][c] = color;
  });
  state.turn = other(color);
  updateLocalStatus();
  return true;
}

function updateLocalStatus() {
  const black = movesFor(state.board, 'B');
  const white = movesFor(state.board, 'W');
  if (!black.length && !white.length) {
    const s = score(state.board);
    state.status = 'finished';
    state.winner = s.black === s.white ? 'draw' : s.black > s.white ? 'B' : 'W';
    return;
  }
  if (!movesFor(state.board, state.turn).length) {
    state.turn = other(state.turn);
  }
}

function setMessage(text, type = '') {
  els.message.textContent = text;
  els.message.className = `message ${type}`.trim();
}

function colorLabel(color) {
  return color === 'B' ? 'Siyah' : 'Beyaz';
}

function validMoveSet() {
  const allowed = mode === 'online' ? state.turnMoves || [] : movesFor(state.board, state.turn);
  return new Set(allowed.map(move => `${move.row}-${move.col}`));
}

function render() {
  const s = score(state.board);
  els.blackScore.textContent = s.black;
  els.whiteScore.textContent = s.white;
  els.turnLabel.textContent = state.status === 'finished'
    ? state.winner === 'draw' ? 'Berabere' : `${colorLabel(state.winner)} kazandı`
    : colorLabel(state.turn);

  els.board.innerHTML = '';
  const valid = validMoveSet();
  state.board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cell ${valid.has(`${rowIndex}-${colIndex}`) ? 'valid' : ''}`;
      button.setAttribute('aria-label', `${rowIndex + 1}-${colIndex + 1}`);
      if (cell) {
        const piece = document.createElement('span');
        piece.className = `piece ${cell}`;
        button.appendChild(piece);
      }
      button.addEventListener('click', () => handleCell(rowIndex, colIndex));
      els.board.appendChild(button);
    });
  });
}

function aiMove() {
  if (state.status !== 'playing' || state.turn !== 'W') return;
  const moves = movesFor(state.board, 'W');
  if (!moves.length) {
    state.turn = 'B';
    render();
    return;
  }
  const corners = moves.filter(move => (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7));
  const choicePool = corners.length ? corners : moves;
  const best = choicePool.sort((a, b) => b.flips - a.flips)[0];
  window.setTimeout(() => {
    applyMoveLocal(best.row, best.col, 'W');
    render();
    if (state.status === 'finished') showEndMessage();
  }, 450);
}

function showEndMessage(reason = '') {
  if (reason) return setMessage(reason, 'success');
  if (state.winner === 'draw') return setMessage('Oyun bitti: berabere.', 'success');
  setMessage(`Oyun bitti: ${colorLabel(state.winner)} kazandı.`, 'success');
}

async function handleCell(row, col) {
  if (state.status === 'finished') return;

  if (mode === 'online') {
    if (!online || state.color !== state.turn) return setMessage('Online oyunda sıra sende değil.', 'error');
    const response = await fetch(`${API}/rooms/${online.code}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, col })
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Hamle yapılamadı.', 'error');
    setOnlineState(data);
    return;
  }

  if (state.turn !== 'B') return;
  if (!applyMoveLocal(row, col, 'B')) return setMessage('Geçersiz hamle.', 'error');
  render();
  if (state.status === 'finished') return showEndMessage();
  aiMove();
}

function startAi() {
  stopPolling();
  mode = 'ai';
  online = null;
  state = { board: createBoard(), turn: 'B', status: 'playing', winner: null, color: 'B' };
  els.modeTitle.textContent = 'PC’ye Karşı';
  els.roomInfo.textContent = '';
  setMessage('Siyah sensin. Geçerli kareler işaretli.');
  render();
}

function setOnlineState(data) {
  mode = 'online';
  online = { code: data.code };
  state = data;
  els.modeTitle.textContent = 'Online Oda';
  const black = data.players.B ? data.players.B.name : 'Bekliyor';
  const white = data.players.W ? data.players.W.name : 'Bekliyor';
  els.roomInfo.innerHTML = `Oda: <strong>${data.code}</strong><br>Siyah: ${black}<br>Beyaz: ${white}<br>Sen: ${data.color ? colorLabel(data.color) : 'İzleyici'}`;
  if (data.status === 'waiting') setMessage('Oda kuruldu. Kodu arkadaşına gönder.');
  else if (data.status === 'finished') showEndMessage(data.finishReason);
  else setMessage(data.turn === data.color ? 'Sıra sende.' : 'Rakip hamlesi bekleniyor.');
  render();
}

async function createRoom() {
  const response = await fetch(`${API}/rooms`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Oda kurulamadı.', 'error');
  setOnlineState(data);
  startPolling(data.code);
  loadOpenRooms();
}

async function joinRoom(code) {
  const response = await fetch(`${API}/rooms/${code}/join`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) return setMessage(data.error || 'Odaya katılamadın.', 'error');
  setOnlineState(data);
  startPolling(data.code);
  loadOpenRooms();
}

async function loadOpenRooms() {
  try {
    const response = await fetch(`${API}/rooms`);
    const data = await response.json();
    if (!response.ok) {
      els.openRoomsList.textContent = data.error || 'Odalar alınamadı.';
      return;
    }
    if (!data.rooms || !data.rooms.length) {
      els.openRoomsList.textContent = 'Bekleyen açık oda yok.';
      return;
    }
    els.openRoomsList.innerHTML = data.rooms.map(room => `
      <div class="open-room-row">
        <span><strong>${room.code}</strong><br>${escapeHtml(room.hostName)}</span>
        <button type="button" data-join-room="${room.code}">Katıl</button>
      </div>
    `).join('');
    els.openRoomsList.querySelectorAll('[data-join-room]').forEach((button) => {
      button.addEventListener('click', () => joinRoom(button.getAttribute('data-join-room')));
    });
  } catch (error) {
    els.openRoomsList.textContent = 'Oda listesi yenilenemedi.';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function startPolling(code) {
  stopPolling();
  pollTimer = window.setInterval(async () => {
    const response = await fetch(`${API}/rooms/${code}`);
    if (!response.ok) return;
    setOnlineState(await response.json());
  }, 1400);
}

function stopPolling() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = null;
}

async function resetGame() {
  if (mode === 'online' && online) {
    const response = await fetch(`${API}/rooms/${online.code}/reset`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Oyun sıfırlanamadı.', 'error');
    setOnlineState(data);
    return;
  }
  startAi();
}

async function init() {
  const response = await fetch(`${API}/me`);
  if (response.status === 401) {
    window.location.href = '/login';
    return;
  }
  const data = await response.json();
  player = data.player;
  els.playerName.textContent = player.name;
  startAi();
  await loadOpenRooms();
  roomsTimer = window.setInterval(loadOpenRooms, 5000);
}

els.aiMode.addEventListener('click', startAi);
els.createRoom.addEventListener('click', createRoom);
els.refreshRooms.addEventListener('click', loadOpenRooms);
els.resetGame.addEventListener('click', resetGame);
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCodeInput.value.trim().toUpperCase();
  if (!code) return setMessage('Oda kodu gir.', 'error');
  joinRoom(code);
});
els.gameSelect.addEventListener('change', () => {
  const type = els.gameSelect.value;
  if (type === 'reversi') return;
  if (type === 'mangala') {
    window.location.href = '/games/mangala/play/';
    return;
  }
  if (type === 'dama') {
    window.location.href = '/games/dama/play/';
    return;
  }
  if (type === 'capraz-dama') {
    window.location.href = '/games/capraz-dama/play/';
    return;
  }
  if (type === 'satranc') {
    window.location.href = '/games/satranc/play/';
    return;
  }
  if (type === 'dortlu-birlestir') {
    window.location.href = '/games/dortlu-birlestir/play/';
    return;
  }
  if (type === 'mastermind') {
    window.location.href = '/games/mastermind/play/';
    return;
  }
  window.location.href = `/games/board/play?game=${encodeURIComponent(type)}`;
});

init();
