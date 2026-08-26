const PAGE_TITLE = document.body?.dataset?.gameTitle || document.getElementById('game-title')?.dataset?.defaultTitle || '';
const CONFIG = window.__GAME_CONFIG__ || {};
const BASE = window.location.pathname.replace(/\/$/, '');
const API = `${BASE}/api`;

let games = {};
let currentType = CONFIG.slug || 'xox';
let room = null;
let pollTimer = null;
let roomsTimer = null;
let selectedMorris = null;
let pendingMorrisCapture = null;
let selectedCheckers = null;
let selectedBackgammon = null;
let selectedAbalone = null;
let selectedChess = null;

const els = {
  title: document.getElementById('game-title'),
  select: document.getElementById('game-select'),
  pc: document.getElementById('pc-room'),
  create: document.getElementById('create-room'),
  joinForm: document.getElementById('join-form'),
  roomCode: document.getElementById('room-code'),
  refresh: document.getElementById('refresh'),
  openList: document.getElementById('open-list'),
  roomTitle: document.getElementById('room-title'),
  players: document.getElementById('players'),
  turn: document.getElementById('turn'),
  message: document.getElementById('message'),
  board: document.getElementById('board')
};

function markLabel(mark) {
  return { X: 'X', O: 'O', A: '3', B: '4', draw: 'Berabere' }[mark] || mark;
}

function setMessage(text, type = '') {
  els.message.className = type;
  els.message.textContent = text || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateHeader() {
  const meta = games[currentType];
  els.title.textContent = meta ? meta.title : (CONFIG.title || PAGE_TITLE || 'Klasik Oyun');
  document.title = els.title.textContent;
}

async function loadGames() {
  games = {
    [currentType]: {
      title: CONFIG.title || PAGE_TITLE || 'Klasik Oyun',
      players: CONFIG.players || 2,
      pc: true,
      status: 'active'
    }
  };
  els.select.innerHTML = Object.entries(games)
    .map(([key, item]) => `<option value="${key}" ${key === currentType ? 'selected' : ''}>${item.title}</option>`)
    .join('');
  updateHeader();
}

async function loadRooms() {
  const response = await fetch(`${API}/rooms?type=${encodeURIComponent(currentType)}`);
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
    <div class="room-row">
      <span><strong>${item.code}</strong><br>${escapeHtml(item.hostName)}</span>
      <button data-join="${item.code}" type="button">Katıl</button>
    </div>
  `).join('');
  els.openList.querySelectorAll('[data-join]').forEach((button) => {
    button.addEventListener('click', () => joinRoom(button.getAttribute('data-join')));
  });
}

async function createRoom() {
  return createGameRoom(false);
}

async function createPcRoom() {
  return createGameRoom(true);
}

async function createGameRoom(bot) {
  const response = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: currentType, bot })
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
  currentType = data.type;
  els.select.value = currentType;
  updateHeader();
  setRoom(data);
  await loadRooms();
}

function setRoom(data) {
  room = data;
  pendingMorrisCapture = null;
  els.roomTitle.textContent = `Oda ${data.code} - ${data.meta.title}`;
  els.players.innerHTML = Object.entries(data.players)
    .filter(([, player]) => player)
    .map(([mark, player]) => `${markLabel(mark)}: <strong>${escapeHtml(player.name)}</strong>`)
    .join('<br>');
  if (data.status === 'waiting') {
    setMessage('Oda açık. Rakip bekleniyor.');
  } else if (data.status === 'finished') {
    setMessage(data.finishReason || `Oyun bitti: ${markLabel(data.state.winner)}`, 'success');
  } else {
    setMessage(data.state.turn === data.mark ? 'Sıra sende.' : 'Rakip bekleniyor.');
  }
  els.turn.textContent = data.status === 'finished' ? '' : `Sıra: ${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`;
  renderBoard();
  startPolling();
}

function startPolling() {
  if (!room) return;
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(async () => {
    if (pendingMorrisCapture) return;
    const response = await fetch(`${API}/rooms/${room.code}`);
    if (!response.ok) return;
    setRoom(await response.json());
  }, 1400);
}

async function move(payload) {
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

function canMove() {
  return room && room.status === 'playing' && room.state.turn === room.mark;
}

function renderBoard() {
  els.board.innerHTML = '';
  if (!room) return;
  if (room.type === 'xox') return renderGrid(3, room.state.board, (i) => move({ index: i }));
  if (room.type === 'sos') return renderSos();
  if (room.type === 'kutu-doldurmaca') return renderDots();
  if (room.type === 'yilanlar-ve-merdivenler') return renderSnakes();
  if (room.type === '9-tas' || room.type === '3-tas') return renderMorris();
  if (room.type === 'dama' || room.type === 'capraz-dama') return renderCheckers();
  if (room.type === 'mangala') return renderMangala();
  if (room.type === 'abalone') return renderAbalone();
  if (room.type === 'tavla') return renderBackgammon();
  if (room.type === 'domino') return renderDomino();
  if (room.type === 'go') return renderGo();
  if (room.type === 'koridor') return renderCorridor();
  if (room.type === 'satranc') return renderChess();
  if (room.type === 'kizma-birader') return renderLudo();
}

function renderGrid(size, board, click) {
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  board.forEach((cell, index) => {
    const button = document.createElement('button');
    button.className = 'cell';
    button.textContent = cell || '';
    button.disabled = Boolean(cell) || !canMove();
    button.addEventListener('click', () => click(index));
    grid.appendChild(button);
  });
  els.board.appendChild(grid);
}

function renderSos() {
  const choice = document.createElement('div');
  choice.innerHTML = '<p>Hamle için harf seç: <select id="sos-letter"><option>S</option><option>O</option></select></p>';
  els.board.appendChild(choice);
  renderGrid(room.state.size, room.state.board, (index) => {
    const letter = document.getElementById('sos-letter').value;
    move({ index, letter });
  });
}

function renderDots() {
  const size = room.state.size;
  const grid = document.createElement('div');
  grid.className = 'dots';
  grid.style.gridTemplateColumns = `repeat(${size * 2 - 1}, minmax(10px, 1fr))`;
  for (let r = 0; r < size * 2 - 1; r += 1) {
    for (let c = 0; c < size * 2 - 1; c += 1) {
      const el = document.createElement('button');
      if (r % 2 === 0 && c % 2 === 0) {
        el.className = 'dot';
        el.disabled = true;
      } else if (r % 2 === 0) {
        const line = `h-${r / 2}-${Math.floor(c / 2)}`;
        el.className = `line ${room.state.lines[line] ? 'on' : ''}`;
        el.disabled = Boolean(room.state.lines[line]) || !canMove();
        el.addEventListener('click', () => move({ line }));
      } else if (c % 2 === 0) {
        const line = `v-${Math.floor(r / 2)}-${c / 2}`;
        el.className = `line ${room.state.lines[line] ? 'on' : ''}`;
        el.disabled = Boolean(room.state.lines[line]) || !canMove();
        el.addEventListener('click', () => move({ line }));
      } else {
        const key = `${Math.floor(r / 2)}-${Math.floor(c / 2)}`;
        el.className = 'box';
        el.textContent = room.state.boxes[key] || '';
        el.disabled = true;
      }
      grid.appendChild(el);
    }
  }
  els.board.appendChild(grid);
}

function renderSnakes() {
  const button = document.createElement('button');
  button.textContent = canMove() ? 'Zar At' : 'Sıra bekleniyor';
  button.disabled = !canMove();
  button.addEventListener('click', () => move({ roll: true }));
  els.board.appendChild(button);
  const track = document.createElement('div');
  track.className = 'snake-track';
  for (let i = 30; i >= 1; i -= 1) {
    const cell = document.createElement('div');
    cell.className = 'snake-cell';
    cell.innerHTML = `${i}<br>${Object.entries(room.state.positions)
      .filter(([, pos]) => Number(pos) === i)
      .map(([mark]) => `<span class="pawn">${markLabel(mark)}</span>`)
      .join('')}`;
    track.appendChild(cell);
  }
  els.board.appendChild(track);
}

const MORRIS_POSITIONS = [
  [0,0],[0,3],[0,6],[1,1],[1,3],[1,5],[2,2],[2,3],[2,4],[3,0],[3,1],[3,2],
  [3,4],[3,5],[3,6],[4,2],[4,3],[4,4],[5,1],[5,3],[5,5],[6,0],[6,3],[6,6]
];

function renderMorris() {
  const displayBoard = pendingMorrisCapture ? pendingMorrisCapture.previewBoard : room.state.board;
  const hint = document.createElement('div');
  hint.className = 'morris-hint-panel';

  if (pendingMorrisCapture) {
    const text = document.createElement('p');
    text.textContent = 'Degirmen oldu. Parlayan rakip taslardan birini sec.';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'small';
    cancel.textContent = 'Hamleyi Iptal Et';
    cancel.addEventListener('click', () => {
      pendingMorrisCapture = null;
      selectedMorris = null;
      setMessage('Hamle secimi iptal edildi.');
      renderBoard();
    });
    hint.append(text, cancel);
  } else {
    hint.innerHTML = room.state.phase === 'placing'
      ? `<p>Tas koyma asamasi: ${room.state.placed.X}/${room.state.piecesPerPlayer} - ${room.state.placed.O}/${room.state.piecesPerPlayer}</p>`
      : '<p>Tas oynatma asamasi. Once kendi tasini, sonra hedef noktayi sec.</p>';
  }
  els.board.appendChild(hint);

  const board = document.createElement('div');
  board.className = 'morris';
  for (let i = 0; i < 49; i += 1) {
    const pointIndex = MORRIS_POSITIONS.findIndex(([r, c]) => r * 7 + c === i);
    const cell = document.createElement('button');
    cell.type = 'button';
    if (pointIndex === -1) {
      cell.className = 'morris-empty';
      cell.disabled = true;
    } else {
      const value = displayBoard[pointIndex];
      const captureTarget = pendingMorrisCapture && canRemoveMorrisPiece(pointIndex, displayBoard, room.mark);
      const captureBlocked = pendingMorrisCapture && value && value !== room.mark && !captureTarget;
      cell.className = `morris-point ${selectedMorris === pointIndex ? 'selected' : ''} ${captureTarget ? 'capture-target' : ''} ${captureBlocked ? 'capture-blocked' : ''}`;
      cell.innerHTML = `<span class="morris-index">${pointIndex + 1}</span><span class="morris-piece">${value || ''}</span>`;
      cell.disabled = !canMove();
      cell.addEventListener('click', () => handleMorrisPoint(pointIndex));
    }
    board.appendChild(cell);
  }
  els.board.appendChild(board);
}

function renderCheckers() {
  const grid = document.createElement('div');
  grid.className = 'checkers';
  room.state.board.forEach((piece, index) => {
    const button = document.createElement('button');
    const row = Math.floor(index / 8);
    const col = index % 8;
    button.className = `check-cell ${(row + col) % 2 ? 'dark' : 'light'} ${selectedCheckers === index ? 'selected' : ''}`;
    button.textContent = piece ? piece.replace('K', '♛') : '';
    button.disabled = !canMove();
    button.addEventListener('click', () => handleCheckers(index));
    grid.appendChild(button);
  });
  els.board.appendChild(grid);
}

function handleCheckers(index) {
  const piece = room.state.board[index];
  if (piece && piece[0] === room.mark) {
    selectedCheckers = index;
    renderBoard();
    return;
  }
  if (selectedCheckers === null || piece) return;
  const from = selectedCheckers;
  selectedCheckers = null;
  move({ from, to: index });
}

function renderMangala() {
  const turnName = room.players[room.state.turn] ? room.players[room.state.turn].name : markLabel(room.state.turn);
  const header = document.createElement('div');
  header.className = 'mangala-header';
  header.innerHTML = `
    <div>
      <span class="mangala-label">Sıra</span>
      <strong>${escapeHtml(turnName)}</strong>
    </div>
    <div class="mangala-score">
      <span>X Hazine <strong>${room.state.stores.X}</strong></span>
      <span>O Hazine <strong>${room.state.stores.O}</strong></span>
    </div>
  `;
  els.board.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'mangala';
  const oStore = makeStore('O', room.state.stores.O);
  wrap.appendChild(oStore);

  const center = document.createElement('div');
  center.className = 'mangala-center';
  const top = document.createElement('div');
  top.className = 'pit-row opponent';
  room.state.pits.O.slice().reverse().forEach((stones, reverseIndex) => {
    top.appendChild(makePit('O', 5 - reverseIndex, stones));
  });
  center.appendChild(top);

  const bottom = document.createElement('div');
  bottom.className = 'pit-row own';
  room.state.pits.X.forEach((stones, index) => {
    bottom.appendChild(makePit('X', index, stones));
  });
  center.appendChild(bottom);
  wrap.appendChild(center);

  const xStore = makeStore('X', room.state.stores.X);
  wrap.appendChild(xStore);
  els.board.appendChild(wrap);
}

function makePit(mark, index, stones) {
  const button = document.createElement('button');
  const playable = canMove() && room.mark === mark && stones > 0;
  const castleOwner = mangalaCastleOwner(mark, index);
  button.className = `pit ${mark === room.mark ? 'mine' : ''} ${room.state.turn === mark ? 'turn' : ''} ${castleOwner ? `castle castle-${castleOwner}` : ''}`;
  button.innerHTML = `
    <span class="pit-name">${mark}${index + 1}</span>
    ${castleOwner ? `<span class="castle-flag">${castleOwner} Kale</span>` : ''}
    <span class="stones">${renderStones(stones)}</span>
    <strong>${stones}</strong>
  `;
  button.disabled = !canMove() || room.mark !== mark || stones <= 0;
  if (playable) button.setAttribute('aria-label', `${mark}${index + 1} kuyusunu oyna`);
  button.addEventListener('click', () => move({ pit: index }));
  return button;
}

function mangalaCastleOwner(side, index) {
  const castles = room.state.castles || {};
  if (side === 'O' && castles.X === index) return 'X';
  if (side === 'X' && castles.O === index) return 'O';
  return '';
}

function makeStore(mark, count) {
  const store = document.createElement('div');
  store.className = `store store-${mark}`;
  store.innerHTML = `<span>${mark} Hazine</span><strong>${count}</strong>`;
  return store;
}

function renderStones(count) {
  return Array.from({ length: Math.min(Number(count) || 0, 18) })
    .map((_, index) => `<i style="--i:${index}"></i>`)
    .join('');
}

function renderAbalone() {
  const info = document.createElement('p');
  info.textContent = 'Basit sürüm: kendi bilyeni seç, boş komşu noktaya taşı.';
  els.board.appendChild(info);
  const grid = document.createElement('div');
  grid.className = 'abalone';
  room.state.board.forEach((cell, index) => {
    const button = document.createElement('button');
    button.className = `abalone-cell ${selectedAbalone === index ? 'selected' : ''} ${cell ? `stone-${cell}` : ''}`;
    button.textContent = cell || '';
    button.disabled = !canMove();
    button.addEventListener('click', () => handleAbalone(index, cell));
    grid.appendChild(button);
  });
  els.board.appendChild(grid);
}

function handleAbalone(index, cell) {
  if (cell === room.mark) {
    selectedAbalone = index;
    renderBoard();
    return;
  }
  if (selectedAbalone === null || cell) return;
  const from = selectedAbalone;
  selectedAbalone = null;
  move({ from, to: index });
}

function renderBackgammon() {
  const tools = document.createElement('div');
  tools.className = 'game-tools';
  tools.innerHTML = `<strong>Zarlar:</strong> ${room.state.dice.length ? room.state.dice.join(', ') : 'Atılmadı'} · <strong>Toplanan:</strong> X ${room.state.borne.X}, O ${room.state.borne.O}`;
  const roll = document.createElement('button');
  roll.type = 'button';
  roll.textContent = 'Zar At';
  roll.disabled = !canMove() || room.state.dice.length > 0;
  roll.addEventListener('click', () => move({ roll: true }));
  const pass = document.createElement('button');
  pass.type = 'button';
  pass.textContent = 'Sıra Geç';
  pass.disabled = !canMove() || !room.state.dice.length;
  pass.addEventListener('click', () => move({ pass: true }));
  tools.appendChild(roll);
  tools.appendChild(pass);
  els.board.appendChild(tools);

  const board = document.createElement('div');
  board.className = 'backgammon';
  room.state.points.forEach((point, index) => {
    const button = document.createElement('button');
    const owner = point.X ? 'X' : point.O ? 'O' : '';
    const count = owner ? point[owner] : 0;
    button.className = `bg-point ${selectedBackgammon === index ? 'selected' : ''}`;
    button.innerHTML = `<span>${index + 1}</span><strong>${owner ? `${owner} × ${count}` : ''}</strong>`;
    button.disabled = !canMove();
    button.addEventListener('click', () => handleBackgammon(index, owner));
    board.appendChild(button);
  });
  els.board.appendChild(board);
}

function handleBackgammon(index, owner) {
  if (!canMove()) return;
  if (owner === room.mark) {
    selectedBackgammon = index;
    renderBoard();
    return;
  }
  if (selectedBackgammon === null) return;
  const die = Number(prompt(`Kullanılacak zar (${room.state.dice.join(', ')}):`));
  const from = selectedBackgammon;
  selectedBackgammon = null;
  if (Number.isInteger(die)) move({ from, die });
}

function renderDomino() {
  const state = room.state;
  const chain = document.createElement('div');
  chain.className = 'domino-chain';
  chain.innerHTML = state.chain.length
    ? state.chain.map((tile) => `<span class="domino-tile">${tile[0]}|${tile[1]}</span>`).join('')
    : '<em>İlk taşı sen koyabilirsin.</em>';
  els.board.appendChild(chain);

  const hand = document.createElement('div');
  hand.className = 'domino-hand';
  const myHand = state.hands[room.mark] || [];
  const pass = document.createElement('button');
  pass.type = 'button';
  pass.textContent = 'Pas';
  pass.disabled = !canMove();
  pass.addEventListener('click', () => move({ pass: true }));
  hand.appendChild(pass);
  myHand.forEach((tile, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'domino-card';
    wrap.innerHTML = `<strong>${tile[0]}|${tile[1]}</strong>`;
    const left = document.createElement('button');
    left.type = 'button';
    left.textContent = 'Sola';
    left.disabled = !canMove();
    left.addEventListener('click', () => move({ index, side: 'left' }));
    const right = document.createElement('button');
    right.type = 'button';
    right.textContent = 'Sağa';
    right.disabled = !canMove();
    right.addEventListener('click', () => move({ index, side: 'right' }));
    wrap.append(left, right);
    hand.appendChild(wrap);
  });
  els.board.appendChild(hand);
}

function renderGo() {
  const state = room.state;
  const tools = document.createElement('div');
  tools.className = 'game-tools';
  tools.innerHTML = `<strong>Tahta:</strong> ${state.size}×${state.size} · <strong>Esir:</strong> X ${state.captures.X}, O ${state.captures.O}`;
  [9, 13, 19].forEach((size) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${size}×${size}`;
    button.disabled = !canMove() || state.board.some(Boolean) || state.size === size;
    button.addEventListener('click', () => move({ size }));
    tools.appendChild(button);
  });
  const pass = document.createElement('button');
  pass.type = 'button';
  pass.textContent = 'Pas';
  pass.disabled = !canMove();
  pass.addEventListener('click', () => move({ pass: true }));
  tools.appendChild(pass);
  els.board.appendChild(tools);

  const grid = document.createElement('div');
  grid.className = 'go-board';
  grid.style.gridTemplateColumns = `repeat(${state.size}, minmax(18px, 1fr))`;
  state.board.forEach((cell, index) => {
    const button = document.createElement('button');
    button.className = `go-point ${cell ? `stone-${cell}` : ''}`;
    button.textContent = cell || '';
    button.disabled = Boolean(cell) || !canMove();
    button.addEventListener('click', () => move({ index }));
    grid.appendChild(button);
  });
  els.board.appendChild(grid);
}

function renderCorridor() {
  const tools = document.createElement('div');
  tools.className = 'game-tools';
  tools.innerHTML = `<strong>Duvar:</strong> X ${room.state.walls.X}, O ${room.state.walls.O}`;
  const wallH = document.createElement('button');
  wallH.type = 'button';
  wallH.textContent = 'Yatay Duvar';
  wallH.disabled = !canMove();
  wallH.addEventListener('click', () => {
    const row = Number(prompt('Duvar satırı (1-8):')) - 1;
    const col = Number(prompt('Duvar sütunu (1-8):')) - 1;
    move({ wall: 'h', row, col });
  });
  const wallV = document.createElement('button');
  wallV.type = 'button';
  wallV.textContent = 'Dikey Duvar';
  wallV.disabled = !canMove();
  wallV.addEventListener('click', () => {
    const row = Number(prompt('Duvar satırı (1-8):')) - 1;
    const col = Number(prompt('Duvar sütunu (1-8):')) - 1;
    move({ wall: 'v', row, col });
  });
  tools.append(wallH, wallV);
  els.board.appendChild(tools);

  const grid = document.createElement('div');
  grid.className = 'corridor';
  for (let i = 0; i < 81; i += 1) {
    const button = document.createElement('button');
    const occupant = Object.entries(room.state.pawns).find(([, pos]) => pos === i)?.[0] || '';
    button.className = 'corridor-cell';
    button.textContent = occupant;
    button.disabled = !canMove();
    button.addEventListener('click', () => move({ to: i }));
    grid.appendChild(button);
  }
  els.board.appendChild(grid);
  const walls = document.createElement('p');
  walls.className = 'wall-list';
  walls.textContent = room.state.placedWalls.length ? `Duvarlar: ${room.state.placedWalls.join(', ')}` : 'Duvar yok.';
  els.board.appendChild(walls);
}

const CHESS_LABELS = {
  XK: '♔', XQ: '♕', XR: '♖', XB: '♗', XN: '♘', XP: '♙',
  OK: '♚', OQ: '♛', OR: '♜', OB: '♝', ON: '♞', OP: '♟'
};

function renderChess() {
  const grid = document.createElement('div');
  grid.className = 'chess';
  room.state.board.forEach((piece, index) => {
    const button = document.createElement('button');
    const row = Math.floor(index / 8);
    const col = index % 8;
    button.className = `chess-cell ${(row + col) % 2 ? 'dark' : 'light'} ${selectedChess === index ? 'selected' : ''}`;
    button.textContent = piece ? (CHESS_LABELS[piece] || piece) : '';
    button.disabled = !canMove();
    button.addEventListener('click', () => handleChess(index, piece));
    grid.appendChild(button);
  });
  els.board.appendChild(grid);
}

function handleChess(index, piece) {
  if (piece && piece[0] === room.mark) {
    selectedChess = index;
    renderBoard();
    return;
  }
  if (selectedChess === null || (piece && piece[0] === room.mark)) return;
  const from = selectedChess;
  selectedChess = null;
  move({ from, to: index });
}

function renderLudo() {
  const tools = document.createElement('div');
  tools.className = 'game-tools';
  tools.innerHTML = `<strong>Son zar:</strong> ${room.state.lastRoll ? `${markLabel(room.state.lastRoll.mark)} ${room.state.lastRoll.roll}` : 'Yok'}`;
  els.board.appendChild(tools);
  const track = document.createElement('div');
  track.className = 'ludo-track';
  for (let i = 0; i < 40; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'ludo-cell';
    const pawns = Object.entries(room.state.positions).flatMap(([mark, pieces]) => (
      pieces.map((pos, piece) => ({ mark, piece, pos })).filter((item) => item.pos === i)
    ));
    cell.innerHTML = `<small>${i + 1}</small>${pawns.map((item) => `<span class="pawn">${markLabel(item.mark)}${item.piece + 1}</span>`).join('')}`;
    track.appendChild(cell);
  }
  els.board.appendChild(track);
  const home = document.createElement('div');
  home.className = 'ludo-home';
  (room.state.positions[room.mark] || []).forEach((pos, piece) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Piyon ${piece + 1}: ${pos < 0 ? 'Evde' : pos >= 40 ? 'Bitti' : pos + 1}`;
    button.disabled = !canMove() || pos >= 40;
    button.addEventListener('click', () => move({ piece }));
    home.appendChild(button);
  });
  els.board.appendChild(home);
}

function wouldMorrisNeedRemove(index, mark, board) {
  const mills = [
    [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
    [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
  ];
  return mills.some((mill) => mill.includes(index) && mill.every((pos) => board[pos] === mark));
}

function getMorrisRemovableTargets(board, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const opponentPieces = board
    .map((cell, pointIndex) => ({ cell, pointIndex }))
    .filter(({ cell }) => cell === opponent);
  const nonMillPieces = opponentPieces.filter(({ pointIndex }) => !wouldMorrisNeedRemove(pointIndex, opponent, board));
  return (nonMillPieces.length ? nonMillPieces : opponentPieces).map(({ pointIndex }) => pointIndex);
}

function canRemoveMorrisPiece(index, board, mark) {
  return getMorrisRemovableTargets(board, mark).includes(index);
}

async function handleMorrisPoint(index) {
  if (!canMove()) return;
  const mark = room.mark;
  const board = pendingMorrisCapture ? pendingMorrisCapture.previewBoard : room.state.board;

  if (pendingMorrisCapture) {
    if (!canRemoveMorrisPiece(index, board, mark)) {
      setMessage('Degirmen yaptin. Gecerli rakip taslardan birini secmelisin.', 'error');
      return;
    }
    const payload = { ...pendingMorrisCapture.move, remove: index };
    pendingMorrisCapture = null;
    selectedMorris = null;
    return move(payload);
  }

  if (room.state.phase === 'placing') {
    if (board[index]) return;
    const simulated = board.slice();
    simulated[index] = mark;
    if (wouldMorrisNeedRemove(index, mark, simulated)) {
      pendingMorrisCapture = { move: { to: index }, previewBoard: simulated };
      setMessage('Degirmen oldu. Simdi alinacak rakip tasi sec.', 'success');
      renderBoard();
      return;
    }
    return move({ to: index, remove: null });
  }

  if (board[index] === mark) {
    selectedMorris = index;
    renderBoard();
    return;
  }

  if (selectedMorris === null || board[index]) return;
  const simulated = board.slice();
  simulated[selectedMorris] = null;
  simulated[index] = mark;
  const from = selectedMorris;
  selectedMorris = null;
  if (wouldMorrisNeedRemove(index, mark, simulated)) {
    pendingMorrisCapture = { move: { from, to: index }, previewBoard: simulated };
    setMessage('Degirmen oldu. Simdi alinacak rakip tasi sec.', 'success');
    renderBoard();
    return;
  }
  return move({ from, to: index, remove: null });
}

els.create.addEventListener('click', createRoom);
els.pc.addEventListener('click', createPcRoom);
els.refresh.addEventListener('click', loadRooms);
els.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = els.roomCode.value.trim().toUpperCase();
  if (code) joinRoom(code);
});

loadGames().then(loadRooms);
roomsTimer = window.setInterval(loadRooms, 5000);
