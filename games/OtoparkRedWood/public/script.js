const BOARD_SIZE = 6;

const LEVELS = [
  {
    name: '1',
    blocks: [
      { id: 'red', row: 2, col: 1, len: 2, dir: 'h', label: 'Kirmizi' },
      { id: 'a', row: 0, col: 0, len: 3, dir: 'v', label: 'Mavi Kamyon' },
      { id: 'b', row: 0, col: 3, len: 2, dir: 'v', label: 'Yesil Jeep' },
      { id: 'c', row: 0, col: 4, len: 2, dir: 'h', label: 'Sari Araba' },
      { id: 'd', row: 1, col: 1, len: 2, dir: 'h', label: 'Turuncu Araba' },
      { id: 'e', row: 1, col: 5, len: 3, dir: 'v', label: 'Mor Kamyon' },
      { id: 'f', row: 3, col: 0, len: 2, dir: 'h', label: 'Beyaz Araba' },
      { id: 'g', row: 3, col: 2, len: 3, dir: 'v', label: 'Lacivert Kamyon' },
      { id: 'h', row: 4, col: 3, len: 2, dir: 'h', label: 'Krem Araba' }
    ]
  },
  {
    name: '2',
    blocks: [
      { id: 'red', row: 2, col: 0, len: 2, dir: 'h', label: 'Kirmizi' },
      { id: 'a', row: 0, col: 0, len: 2, dir: 'v', label: 'Mavi Araba' },
      { id: 'b', row: 0, col: 2, len: 3, dir: 'v', label: 'Turuncu Kamyon' },
      { id: 'c', row: 0, col: 3, len: 2, dir: 'h', label: 'Sari Araba' },
      { id: 'd', row: 0, col: 5, len: 3, dir: 'v', label: 'Yesil Kamyon' },
      { id: 'e', row: 1, col: 3, len: 2, dir: 'v', label: 'Mor Araba' },
      { id: 'f', row: 3, col: 0, len: 3, dir: 'v', label: 'Beyaz Kamyon' },
      { id: 'g', row: 3, col: 1, len: 2, dir: 'h', label: 'Kahve Araba' },
      { id: 'h', row: 3, col: 4, len: 2, dir: 'v', label: 'Deniz Araba' },
      { id: 'i', row: 4, col: 2, len: 2, dir: 'h', label: 'Gri Araba' }
    ]
  },
  {
    name: '3',
    blocks: [
      { id: 'red', row: 2, col: 1, len: 2, dir: 'h', label: 'Kirmizi' },
      { id: 'a', row: 0, col: 0, len: 3, dir: 'v', label: 'Mavi Kamyon' },
      { id: 'b', row: 0, col: 2, len: 2, dir: 'h', label: 'Sari Araba' },
      { id: 'c', row: 0, col: 4, len: 2, dir: 'v', label: 'Mor Araba' },
      { id: 'd', row: 1, col: 1, len: 2, dir: 'v', label: 'Turuncu Araba' },
      { id: 'e', row: 1, col: 3, len: 3, dir: 'v', label: 'Yesil Kamyon' },
      { id: 'f', row: 2, col: 5, len: 3, dir: 'v', label: 'Beyaz Kamyon' },
      { id: 'g', row: 3, col: 0, len: 2, dir: 'h', label: 'Lacivert Araba' },
      { id: 'h', row: 4, col: 1, len: 2, dir: 'h', label: 'Krem Araba' },
      { id: 'i', row: 4, col: 4, len: 2, dir: 'h', label: 'Gri Araba' },
      { id: 'j', row: 5, col: 2, len: 2, dir: 'h', label: 'Pembe Araba' }
    ]
  },
  {
    name: '4',
    blocks: [
      { id: 'red', row: 2, col: 2, len: 2, dir: 'h', label: 'Kirmizi' },
      { id: 'a', row: 0, col: 0, len: 2, dir: 'h', label: 'Sari Araba' },
      { id: 'b', row: 0, col: 2, len: 3, dir: 'v', label: 'Mavi Kamyon' },
      { id: 'c', row: 0, col: 3, len: 2, dir: 'v', label: 'Mor Araba' },
      { id: 'd', row: 0, col: 4, len: 2, dir: 'h', label: 'Krem Araba' },
      { id: 'e', row: 1, col: 0, len: 2, dir: 'v', label: 'Turuncu Araba' },
      { id: 'f', row: 1, col: 1, len: 2, dir: 'v', label: 'Beyaz Araba' },
      { id: 'g', row: 1, col: 5, len: 3, dir: 'v', label: 'Yesil Kamyon' },
      { id: 'h', row: 3, col: 2, len: 2, dir: 'h', label: 'Lacivert Araba' },
      { id: 'i', row: 3, col: 4, len: 2, dir: 'v', label: 'Gri Araba' },
      { id: 'j', row: 4, col: 0, len: 3, dir: 'h', label: 'Pembe Kamyon' },
      { id: 'k', row: 5, col: 3, len: 2, dir: 'h', label: 'Kahve Araba' }
    ]
  }
];

const BLOCK_COLORS = {
  red: 'block-red',
  a: 'block-blue',
  b: 'block-yellow',
  c: 'block-green',
  d: 'block-orange',
  e: 'block-purple',
  f: 'block-white',
  g: 'block-navy',
  h: 'block-cream',
  i: 'block-gray',
  j: 'block-pink',
  k: 'block-brown'
};

let levelIndex = 0;
let blocks = [];
let selectedBlockId = null;
let moveCount = 0;
let history = [];

const els = {
  levelSelect: document.getElementById('level-select'),
  restartBtn: document.getElementById('restart-btn'),
  undoBtn: document.getElementById('undo-btn'),
  nextBtn: document.getElementById('next-btn'),
  moveCount: document.getElementById('move-count'),
  statusText: document.getElementById('status-text'),
  board: document.getElementById('board')
};

function cloneBlocks(source) {
  return source.map((block) => ({ ...block }));
}

function getBlockMap(currentBlocks = blocks) {
  const map = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  currentBlocks.forEach((block) => {
    for (let offset = 0; offset < block.len; offset += 1) {
      const row = block.dir === 'h' ? block.row : block.row + offset;
      const col = block.dir === 'h' ? block.col + offset : block.col;
      map[row][col] = block.id;
    }
  });
  return map;
}

function getBlockById(blockId) {
  return blocks.find((block) => block.id === blockId) || null;
}

function isSolved() {
  const red = getBlockById('red');
  return Boolean(red && red.row === 2 && red.col + red.len - 1 === BOARD_SIZE - 1);
}

function availableMoves(blockId) {
  const block = getBlockById(blockId);
  if (!block) return [];
  const board = getBlockMap();
  const moves = [];

  if (block.dir === 'h') {
    let nextCol = block.col - 1;
    while (nextCol >= 0 && !board[block.row][nextCol]) {
      moves.push({ row: block.row, col: nextCol, axis: 'h' });
      nextCol -= 1;
    }
    nextCol = block.col + block.len;
    while (nextCol < BOARD_SIZE && !board[block.row][nextCol]) {
      moves.push({ row: block.row, col: nextCol - block.len + 1, axis: 'h' });
      nextCol += 1;
    }
  } else {
    let nextRow = block.row - 1;
    while (nextRow >= 0 && !board[nextRow][block.col]) {
      moves.push({ row: nextRow, col: block.col, axis: 'v' });
      nextRow -= 1;
    }
    nextRow = block.row + block.len;
    while (nextRow < BOARD_SIZE && !board[nextRow][block.col]) {
      moves.push({ row: nextRow - block.len + 1, col: block.col, axis: 'v' });
      nextRow += 1;
    }
  }

  return moves;
}

function pushHistory() {
  history.push({
    blocks: cloneBlocks(blocks),
    moveCount
  });
  history = history.slice(-80);
}

function loadLevel(index) {
  levelIndex = index;
  blocks = cloneBlocks(LEVELS[index].blocks);
  selectedBlockId = null;
  moveCount = 0;
  history = [];
  els.levelSelect.value = String(index);
  render();
}

function moveBlock(blockId, row, col) {
  const block = getBlockById(blockId);
  if (!block) return false;
  const valid = availableMoves(blockId).some((move) => move.row === row && move.col === col);
  if (!valid) return false;
  pushHistory();
  block.row = row;
  block.col = col;
  moveCount += 1;
  selectedBlockId = null;
  render();
  return true;
}

function undoMove() {
  const last = history.pop();
  if (!last) return;
  blocks = cloneBlocks(last.blocks);
  moveCount = last.moveCount;
  selectedBlockId = null;
  render();
}

function statusMessage() {
  if (isSolved()) return 'Cikis acildi';
  if (selectedBlockId) {
    const selected = getBlockById(selectedBlockId);
    const moves = availableMoves(selectedBlockId).length;
    return `${selected.label} secili · ${moves} hamle`;
  }
  return 'Kirmizi blok cikisa gitmeli';
}

function renderHints() {
  if (!selectedBlockId) return;
  availableMoves(selectedBlockId).forEach((move) => {
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = `move-hint ${move.axis === 'h' ? 'horizontal' : 'vertical'}`;
    hint.style.gridColumn = `${move.col + 1} / span 1`;
    hint.style.gridRow = `${move.row + 1} / span 1`;
    hint.title = 'Buraya kaydir';
    hint.addEventListener('click', (event) => {
      event.stopPropagation();
      moveBlock(selectedBlockId, move.row, move.col);
    });
    els.board.appendChild(hint);
  });
}

function renderExit() {
  const exit = document.createElement('div');
  exit.className = 'exit-slot';
  exit.style.gridColumn = '7';
  exit.style.gridRow = '3 / span 1';
  els.board.appendChild(exit);
}

function renderBlock(block) {
  const blockEl = document.createElement('button');
  blockEl.type = 'button';
  blockEl.className = `block ${BLOCK_COLORS[block.id] || 'block-gray'} ${selectedBlockId === block.id ? 'selected' : ''}`;
  if (block.id === 'red') blockEl.classList.add('goal-block');
  blockEl.style.gridColumn = `${block.col + 1} / span ${block.dir === 'h' ? block.len : 1}`;
  blockEl.style.gridRow = `${block.row + 1} / span ${block.dir === 'v' ? block.len : 1}`;
  blockEl.dataset.direction = block.dir;
  blockEl.innerHTML = `
    <span class="block-label">${block.label}</span>
    <span class="block-mark">${block.id === 'red' ? 'EXIT' : block.dir === 'h' ? 'H' : 'V'}</span>
  `;
  blockEl.addEventListener('click', () => {
    if (isSolved()) return;
    if (selectedBlockId === block.id) {
      selectedBlockId = null;
    } else {
      selectedBlockId = block.id;
    }
    render();
  });
  els.board.appendChild(blockEl);
}

function renderBoard() {
  els.board.innerHTML = '';
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      cell.style.gridColumn = `${col + 1}`;
      cell.style.gridRow = `${row + 1}`;
      els.board.appendChild(cell);
    }
  }
  renderExit();
  renderHints();
  blocks.forEach(renderBlock);
}

function render() {
  renderBoard();
  els.moveCount.textContent = String(moveCount);
  els.statusText.textContent = statusMessage();
  els.undoBtn.disabled = !history.length;
  els.nextBtn.disabled = !isSolved() || levelIndex >= LEVELS.length - 1;
  els.board.classList.toggle('won', isSolved());
}

LEVELS.forEach((level, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `Bolum ${level.name}`;
  els.levelSelect.appendChild(option);
});

els.levelSelect.addEventListener('change', (event) => loadLevel(Number(event.target.value)));
els.restartBtn.addEventListener('click', () => loadLevel(levelIndex));
els.undoBtn.addEventListener('click', () => undoMove());
els.nextBtn.addEventListener('click', () => {
  if (levelIndex < LEVELS.length - 1) loadLevel(levelIndex + 1);
});

loadLevel(0);
