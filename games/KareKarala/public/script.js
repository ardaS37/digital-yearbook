const PUZZLES = [
  {
    name: 'Kalp 10x10',
    grid: [
      [0,0,1,1,0,0,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0]
    ]
  },
  {
    name: 'Yildiz 10x10',
    grid: [
      [0,0,0,0,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [1,0,0,1,1,1,1,0,0,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,0,1,1,1,1,0,1,1],
      [0,0,0,1,0,0,1,0,0,0],
      [0,0,1,0,0,0,0,1,0,0]
    ]
  },
  {
    name: 'Gulen Yuz 10x10',
    grid: [
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,0,0,0,0,1,1,0],
      [1,1,0,1,0,0,1,0,1,1],
      [1,1,0,0,0,0,0,0,1,1],
      [1,1,0,1,0,0,1,0,1,1],
      [1,1,0,0,1,1,0,0,1,1],
      [0,1,1,0,0,0,0,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0]
    ]
  }
];

let puzzleIndex = 0;
let playerGrid = [];
let mode = 'paint';

const els = {
  puzzleSelect: document.getElementById('puzzle-select'),
  paintModeBtn: document.getElementById('paint-mode-btn'),
  markModeBtn: document.getElementById('mark-mode-btn'),
  restartBtn: document.getElementById('restart-btn'),
  checkBtn: document.getElementById('check-btn'),
  statusText: document.getElementById('status-text'),
  errorCount: document.getElementById('error-count'),
  boardWrap: document.getElementById('board-wrap')
};

function currentPuzzle() {
  return PUZZLES[puzzleIndex];
}

function cluesForLine(line) {
  const clues = [];
  let count = 0;
  line.forEach((value) => {
    if (value) count += 1;
    else if (count) {
      clues.push(count);
      count = 0;
    }
  });
  if (count) clues.push(count);
  return clues.length ? clues : [0];
}

function rowClues() {
  return currentPuzzle().grid.map((row) => cluesForLine(row));
}

function colClues() {
  const size = currentPuzzle().grid[0].length;
  return Array.from({ length: size }, (_, col) => cluesForLine(currentPuzzle().grid.map((row) => row[col])));
}

function resetGrid() {
  playerGrid = currentPuzzle().grid.map((row) => row.map(() => 0));
}

function mismatchCount() {
  let total = 0;
  const target = currentPuzzle().grid;
  for (let row = 0; row < target.length; row += 1) {
    for (let col = 0; col < target[row].length; col += 1) {
      if (playerGrid[row][col] === 1 && target[row][col] !== 1) total += 1;
    }
  }
  return total;
}

function solved() {
  const target = currentPuzzle().grid;
  for (let row = 0; row < target.length; row += 1) {
    for (let col = 0; col < target[row].length; col += 1) {
      if ((playerGrid[row][col] === 1 ? 1 : 0) !== target[row][col]) return false;
    }
  }
  return true;
}

function renderStatus(forceCheck = false) {
  const errors = mismatchCount();
  els.errorCount.textContent = String(errors);
  if (errors) {
    els.statusText.textContent = 'Yanlis boyanan kare var';
    return;
  }
  if (solved()) {
    els.statusText.textContent = 'Tamamlandi';
    return;
  }
  if (forceCheck) {
    els.statusText.textContent = 'Simdilik temiz';
    return;
  }
  els.statusText.textContent = 'Devam ediyor';
}

function cellClass(value) {
  if (value === 1) return 'painted';
  if (value === 2) return 'marked';
  return '';
}

function toggleCell(row, col) {
  if (mode === 'paint') {
    playerGrid[row][col] = playerGrid[row][col] === 1 ? 0 : 1;
  } else {
    playerGrid[row][col] = playerGrid[row][col] === 2 ? 0 : 2;
  }
  render();
}

function renderBoard(forceCheck = false) {
  const puzzle = currentPuzzle();
  const rows = rowClues();
  const cols = colClues();
  const topDepth = Math.max(...cols.map((entry) => entry.length));
  const leftWidth = Math.max(...rows.map((entry) => entry.length));

  els.boardWrap.innerHTML = '';
  const table = document.createElement('div');
  table.className = 'nonogram';
  table.style.gridTemplateColumns = `repeat(${leftWidth}, 34px) repeat(${puzzle.grid[0].length}, 34px)`;
  table.style.gridTemplateRows = `repeat(${topDepth}, 34px) repeat(${puzzle.grid.length}, 34px)`;

  for (let r = 0; r < topDepth; r += 1) {
    for (let c = 0; c < leftWidth; c += 1) {
      const blank = document.createElement('div');
      blank.className = 'hint-cell blank';
      table.appendChild(blank);
    }
    for (let c = 0; c < cols.length; c += 1) {
      const clue = document.createElement('div');
      clue.className = 'hint-cell';
      const list = cols[c];
      clue.textContent = list[list.length - topDepth + r] || '';
      table.appendChild(clue);
    }
  }

  for (let row = 0; row < puzzle.grid.length; row += 1) {
    for (let c = 0; c < leftWidth; c += 1) {
      const clue = document.createElement('div');
      clue.className = 'hint-cell';
      const list = rows[row];
      clue.textContent = list[list.length - leftWidth + c] || '';
      table.appendChild(clue);
    }
    for (let col = 0; col < puzzle.grid[row].length; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `grid-cell ${cellClass(playerGrid[row][col])}`;
      if ((col + 1) % 5 === 0 && col !== puzzle.grid[row].length - 1) cell.classList.add('box-right');
      if ((row + 1) % 5 === 0 && row !== puzzle.grid.length - 1) cell.classList.add('box-bottom');
      if (playerGrid[row][col] === 2) cell.textContent = '×';
      cell.addEventListener('click', () => toggleCell(row, col));
      table.appendChild(cell);
    }
  }

  els.boardWrap.appendChild(table);
  els.paintModeBtn.classList.toggle('primary', mode === 'paint');
  els.markModeBtn.classList.toggle('primary', mode === 'mark');
  renderStatus(forceCheck);
}

function loadPuzzle(index) {
  puzzleIndex = index;
  els.puzzleSelect.value = String(index);
  resetGrid();
  render();
}

PUZZLES.forEach((puzzle, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = puzzle.name;
  els.puzzleSelect.appendChild(option);
});

els.puzzleSelect.addEventListener('change', (event) => loadPuzzle(Number(event.target.value)));
els.paintModeBtn.addEventListener('click', () => {
  mode = 'paint';
  render();
});
els.markModeBtn.addEventListener('click', () => {
  mode = 'mark';
  render();
});
els.restartBtn.addEventListener('click', () => loadPuzzle(puzzleIndex));
els.checkBtn.addEventListener('click', () => renderBoard(true));

function render(forceCheck = false) {
  renderBoard(forceCheck);
}

loadPuzzle(0);
