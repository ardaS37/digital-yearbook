const SIZE = 9;
const BOX = 3;
const REMOVALS = { easy: 36, medium: 45, hard: 54 };

let solution = [];
let puzzle = [];
let board = [];
let selected = { row: -1, col: -1 };

const els = {
  difficulty: document.getElementById('difficulty-select'),
  newBtn: document.getElementById('new-btn'),
  clearBtn: document.getElementById('clear-btn'),
  checkBtn: document.getElementById('check-btn'),
  statusText: document.getElementById('status-text'),
  errorCount: document.getElementById('error-count'),
  board: document.getElementById('board'),
  numberPad: document.getElementById('number-pad')
};

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
}

function shuffle(items) {
  const list = items.slice();
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

function canPlace(grid, row, col, value) {
  for (let index = 0; index < SIZE; index += 1) {
    if (grid[row][index] === value || grid[index][col] === value) return false;
  }
  const sr = Math.floor(row / BOX) * BOX;
  const sc = Math.floor(col / BOX) * BOX;
  for (let r = sr; r < sr + BOX; r += 1) {
    for (let c = sc; c < sc + BOX; c += 1) {
      if (grid[r][c] === value) return false;
    }
  }
  return true;
}

function solve(grid) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] !== 0) continue;
      for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!canPlace(grid, row, col, value)) continue;
        grid[row][col] = value;
        if (solve(grid)) return true;
        grid[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function generatePuzzle(difficulty) {
  const solved = emptyGrid();
  solve(solved);
  const puzzleGrid = cloneGrid(solved);
  let removals = REMOVALS[difficulty] || REMOVALS.medium;
  while (removals > 0) {
    const row = Math.floor(Math.random() * SIZE);
    const col = Math.floor(Math.random() * SIZE);
    if (puzzleGrid[row][col] === 0) continue;
    puzzleGrid[row][col] = 0;
    removals -= 1;
  }
  return { solved, puzzle: puzzleGrid };
}

function sameBox(aRow, aCol, bRow, bCol) {
  return Math.floor(aRow / BOX) === Math.floor(bRow / BOX) && Math.floor(aCol / BOX) === Math.floor(bCol / BOX);
}

function conflictAt(row, col) {
  const value = board[row][col];
  if (!value) return false;
  for (let index = 0; index < SIZE; index += 1) {
    if (index !== col && board[row][index] === value) return true;
    if (index !== row && board[index][col] === value) return true;
  }
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r !== row || c !== col) && sameBox(row, col, r, c) && board[r][c] === value) return true;
    }
  }
  return false;
}

function countErrors() {
  let total = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (conflictAt(row, col)) total += 1;
    }
  }
  return total;
}

function completeAndCorrect() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] !== solution[row][col]) return false;
    }
  }
  return true;
}

function renderBoard() {
  els.board.innerHTML = '';
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      const fixed = puzzle[row][col] !== 0;
      const active = selected.row === row && selected.col === col;
      const conflict = conflictAt(row, col);
      button.className = `cell ${fixed ? 'fixed' : 'editable'} ${active ? 'active' : ''} ${conflict ? 'conflict' : ''}`;
      if ((col + 1) % 3 === 0 && col !== SIZE - 1) button.classList.add('box-right');
      if ((row + 1) % 3 === 0 && row !== SIZE - 1) button.classList.add('box-bottom');
      button.textContent = board[row][col] || '';
      button.addEventListener('click', () => {
        selected = { row, col };
        render();
      });
      els.board.appendChild(button);
    }
  }
}

function renderPad() {
  els.numberPad.innerHTML = '';
  for (let value = 1; value <= 9; value += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pad-btn';
    button.textContent = String(value);
    button.addEventListener('click', () => placeValue(value));
    els.numberPad.appendChild(button);
  }
}

function updateStatus(forceCheck = false) {
  const errors = countErrors();
  els.errorCount.textContent = String(errors);
  if (errors) {
    els.statusText.textContent = 'Tekrar eden sayilar var';
    return;
  }
  if (completeAndCorrect()) {
    els.statusText.textContent = 'Tamamlandi';
    return;
  }
  if (forceCheck) {
    els.statusText.textContent = 'Simdilik temiz';
    return;
  }
  els.statusText.textContent = 'Devam ediyor';
}

function render(forceCheck = false) {
  renderBoard();
  updateStatus(forceCheck);
}

function newGame() {
  const data = generatePuzzle(els.difficulty.value);
  solution = data.solved;
  puzzle = data.puzzle;
  board = cloneGrid(puzzle);
  selected = { row: -1, col: -1 };
  render();
}

function placeValue(value) {
  if (selected.row < 0 || selected.col < 0) return;
  if (puzzle[selected.row][selected.col] !== 0) return;
  board[selected.row][selected.col] = value;
  render();
}

function clearSelected() {
  if (selected.row < 0 || selected.col < 0) return;
  if (puzzle[selected.row][selected.col] !== 0) return;
  board[selected.row][selected.col] = 0;
  render();
}

els.newBtn.addEventListener('click', () => newGame());
els.clearBtn.addEventListener('click', () => clearSelected());
els.checkBtn.addEventListener('click', () => render(true));
els.difficulty.addEventListener('change', () => newGame());

renderPad();
newGame();
