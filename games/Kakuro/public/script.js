const PUZZLES = [
  {
    name: 'Kolay',
    grid: [
      ['#', '#', '#', '#', '#', '#'],
      ['#', { down: 4 }, { down: 7 }, '#', { down: 3 }, { down: 4 }],
      ['#', { right: 3 }, 'w', 'w', { right: 4 }, 'w'],
      ['#', { right: 8 }, 'w', 'w', { right: 3 }, 'w'],
      ['#', '#', { down: 4 }, { down: 3 }, '#', '#'],
      ['#', { right: 4 }, 'w', 'w', '#', '#']
    ],
    solution: [
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, 1, 2, null, 4],
      [null, null, 3, 5, null, 3],
      [null, null, null, null, null, null],
      [null, null, 4, 3, null, null]
    ]
  },
  {
    name: 'Orta',
    grid: [
      ['#', '#', '#', '#', '#', '#', '#'],
      ['#', { down: 7 }, { down: 16 }, '#', { down: 11 }, { down: 9 }, '#'],
      ['#', { right: 10 }, 'w', 'w', { right: 10 }, 'w', 'w'],
      ['#', { right: 13 }, 'w', 'w', { right: 10 }, 'w', 'w'],
      ['#', '#', { down: 11 }, { down: 7 }, '#', '#', '#'],
      ['#', { right: 9 }, 'w', 'w', '#', '#', '#'],
      ['#', { right: 9 }, 'w', 'w', '#', '#', '#']
    ],
    solution: [
      [null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [null, null, 1, 9, null, 2, 8],
      [null, null, 6, 7, null, 3, 7],
      [null, null, null, null, null, null, null],
      [null, null, 8, 1, null, null, null],
      [null, null, 3, 6, null, null, null]
    ]
  },
  {
    name: 'Zor',
    grid: [
      ['#', '#', '#', '#', '#', '#', '#'],
      ['#', { down: 16 }, { down: 17 }, '#', { down: 15 }, { down: 16 }, '#'],
      ['#', { right: 8 }, 'w', 'w', { right: 7 }, 'w', 'w'],
      ['#', { right: 25 }, 'w', 'w', { right: 17 }, 'w', 'w'],
      ['#', '#', { down: 8 }, { down: 10 }, '#', '#', '#'],
      ['#', { right: 11 }, 'w', 'w', '#', '#', '#'],
      ['#', { right: 7 }, 'w', 'w', '#', '#', '#']
    ],
    solution: [
      [null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [null, null, 1, 7, null, 2, 5],
      [null, null, 9, 16, null, 8, 9],
      [null, null, null, null, null, null, null],
      [null, null, 3, 8, null, null, null],
      [null, null, 5, 2, null, null, null]
    ]
  }
];

let puzzleIndex = 0;
let values = [];
let selected = { row: -1, col: -1 };

const els = {
  puzzleSelect: document.getElementById('puzzle-select'),
  restartBtn: document.getElementById('restart-btn'),
  clearBtn: document.getElementById('clear-btn'),
  checkBtn: document.getElementById('check-btn'),
  statusText: document.getElementById('status-text'),
  errorCount: document.getElementById('error-count'),
  board: document.getElementById('board'),
  numberPad: document.getElementById('number-pad')
};

function currentPuzzle() {
  return PUZZLES[puzzleIndex];
}

function resetValues() {
  values = currentPuzzle().grid.map((row) => row.map((cell) => (cell === 'w' ? 0 : null)));
  selected = { row: -1, col: -1 };
}

function isWhite(cell) {
  return cell === 'w';
}

function groupCells(row, col, direction) {
  const grid = currentPuzzle().grid;
  const cells = [];
  if (direction === 'right') {
    let c = col + 1;
    while (c < grid[row].length && isWhite(grid[row][c])) {
      cells.push([row, c]);
      c += 1;
    }
  } else {
    let r = row + 1;
    while (r < grid.length && isWhite(grid[r][col])) {
      cells.push([r, col]);
      r += 1;
    }
  }
  return cells;
}

function activeGroupsForCell(row, col) {
  const grid = currentPuzzle().grid;
  const result = [];
  for (let c = col - 1; c >= 0; c -= 1) {
    const cell = grid[row][c];
    if (cell === '#') break;
    if (cell && typeof cell === 'object' && cell.right) {
      result.push({ sum: cell.right, cells: groupCells(row, c, 'right') });
      break;
    }
  }
  for (let r = row - 1; r >= 0; r -= 1) {
    const cell = grid[r][col];
    if (cell === '#') break;
    if (cell && typeof cell === 'object' && cell.down) {
      result.push({ sum: cell.down, cells: groupCells(r, col, 'down') });
      break;
    }
  }
  return result;
}

function validateGroup(group) {
  const digits = group.cells.map(([r, c]) => values[r][c]).filter(Boolean);
  const duplicate = digits.some((value, index) => digits.indexOf(value) !== index);
  const total = digits.reduce((sum, value) => sum + value, 0);
  const filled = group.cells.every(([r, c]) => values[r][c] > 0);
  if (duplicate) return true;
  if (filled && total !== group.sum) return true;
  if (total > group.sum) return true;
  return false;
}

function conflictAt(row, col) {
  if (!values[row][col]) return false;
  return activeGroupsForCell(row, col).some((group) => validateGroup(group));
}

function countErrors() {
  let total = 0;
  const grid = currentPuzzle().grid;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (isWhite(grid[row][col]) && conflictAt(row, col)) total += 1;
    }
  }
  return total;
}

function isSolved() {
  const target = currentPuzzle().solution;
  for (let row = 0; row < target.length; row += 1) {
    for (let col = 0; col < target[row].length; col += 1) {
      if (target[row][col] && values[row][col] !== target[row][col]) return false;
    }
  }
  return true;
}

function renderBoard() {
  const grid = currentPuzzle().grid;
  els.board.innerHTML = '';
  els.board.style.gridTemplateColumns = `repeat(${grid[0].length}, minmax(0, 1fr))`;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const cell = grid[row][col];
      const button = document.createElement('button');
      button.type = 'button';
      if (cell === '#') {
        button.className = 'cell block';
        button.disabled = true;
      } else if (cell && typeof cell === 'object') {
        button.className = 'cell clue';
        button.disabled = true;
        button.innerHTML = `
          ${cell.down ? `<span class="down">${cell.down}</span>` : ''}
          ${cell.right ? `<span class="right">${cell.right}</span>` : ''}
        `;
      } else {
        const active = selected.row === row && selected.col === col;
        const conflict = conflictAt(row, col);
        button.className = `cell input ${active ? 'active' : ''} ${conflict ? 'conflict' : ''}`;
        button.textContent = values[row][col] || '';
        button.addEventListener('click', () => {
          selected = { row, col };
          render();
        });
      }
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
    els.statusText.textContent = 'Toplam veya tekrar hatasi var';
    return;
  }
  if (isSolved()) {
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

function loadPuzzle(index) {
  puzzleIndex = index;
  els.puzzleSelect.value = String(index);
  resetValues();
  render();
}

function placeValue(value) {
  if (selected.row < 0 || selected.col < 0) return;
  values[selected.row][selected.col] = value;
  render();
}

function clearSelected() {
  if (selected.row < 0 || selected.col < 0) return;
  values[selected.row][selected.col] = 0;
  render();
}

PUZZLES.forEach((puzzle, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = puzzle.name;
  els.puzzleSelect.appendChild(option);
});

els.puzzleSelect.addEventListener('change', (event) => loadPuzzle(Number(event.target.value)));
els.restartBtn.addEventListener('click', () => loadPuzzle(puzzleIndex));
els.clearBtn.addEventListener('click', () => clearSelected());
els.checkBtn.addEventListener('click', () => render(true));

renderPad();
loadPuzzle(0);
