const CAPACITY = 4;
const LEVELS = [
  {
    name: '1',
    lanes: [
      ['red', 'blue', 'yellow', 'green'],
      ['green', 'yellow', 'red', 'blue'],
      ['blue', 'green', 'yellow', 'red'],
      ['yellow', 'red', 'green', 'blue'],
      [],
      []
    ]
  },
  {
    name: '2',
    lanes: [
      ['blue', 'red', 'green', 'yellow'],
      ['yellow', 'green', 'red', 'blue'],
      ['red', 'yellow', 'blue', 'green'],
      ['green', 'blue', 'yellow', 'red'],
      ['purple', 'orange', 'purple', 'orange'],
      ['orange', 'purple', 'orange', 'purple'],
      [],
      []
    ]
  },
  {
    name: '3',
    lanes: [
      ['blue', 'orange', 'green', 'red'],
      ['red', 'blue', 'purple', 'yellow'],
      ['yellow', 'green', 'orange', 'purple'],
      ['purple', 'yellow', 'red', 'blue'],
      ['green', 'orange', 'blue', 'green'],
      ['orange', 'purple', 'yellow', 'red'],
      [],
      []
    ]
  },
  {
    name: '4',
    lanes: [
      ['purple', 'orange', 'blue', 'green'],
      ['green', 'purple', 'red', 'yellow'],
      ['yellow', 'red', 'orange', 'blue'],
      ['blue', 'green', 'yellow', 'purple'],
      ['orange', 'blue', 'green', 'red'],
      ['red', 'yellow', 'purple', 'orange'],
      [],
      []
    ]
  }
];

const COLOR_LABELS = {
  red: 'Kırmızı',
  blue: 'Mavi',
  green: 'Yeşil',
  yellow: 'Sarı',
  purple: 'Mor',
  orange: 'Turuncu'
};

let levelIndex = 0;
let lanes = [];
let selectedLane = -1;
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

function cloneLanes(source) {
  return source.map((lane) => lane.slice());
}

function loadLevel(index) {
  levelIndex = index;
  lanes = cloneLanes(LEVELS[index].lanes);
  selectedLane = -1;
  moveCount = 0;
  history = [];
  els.levelSelect.value = String(index);
  render();
}

function topColor(lane) {
  return lane.length ? lane[lane.length - 1] : null;
}

function laneSolved(lane) {
  return !lane.length || (lane.length === CAPACITY && lane.every((color) => color === lane[0]));
}

function checkWin() {
  return lanes.every((lane) => laneSolved(lane));
}

function canMove(from, to) {
  if (from === to) return false;
  const source = lanes[from];
  const target = lanes[to];
  if (!source.length || target.length >= CAPACITY) return false;
  const color = topColor(source);
  const targetColor = topColor(target);
  return !target.length || targetColor === color;
}

function pushHistory() {
  history.push({
    lanes: cloneLanes(lanes),
    moveCount
  });
  history = history.slice(-40);
}

function performMove(from, to) {
  if (!canMove(from, to)) return false;
  pushHistory();
  const color = lanes[from].pop();
  lanes[to].push(color);
  moveCount += 1;
  selectedLane = -1;
  render();
  return true;
}

function undoMove() {
  const last = history.pop();
  if (!last) return;
  lanes = cloneLanes(last.lanes);
  moveCount = last.moveCount;
  selectedLane = -1;
  render();
}

function statusMessage() {
  if (checkWin()) return 'Tamamlandi';
  if (selectedLane >= 0) return `${selectedLane + 1}. serit secili`;
  return 'Hazir';
}

function renderLane(lane, laneIndex) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `lane ${selectedLane === laneIndex ? 'selected' : ''} ${laneSolved(lane) ? 'solved' : ''}`;
  button.addEventListener('click', () => {
    if (selectedLane === -1) {
      if (lane.length) {
        selectedLane = laneIndex;
        render();
      }
      return;
    }
    if (selectedLane === laneIndex) {
      selectedLane = -1;
      render();
      return;
    }
    if (!performMove(selectedLane, laneIndex)) {
      selectedLane = lane.length ? laneIndex : -1;
      render();
    }
  });

  const stack = document.createElement('div');
  stack.className = 'lane-stack';
  for (let slot = CAPACITY - 1; slot >= 0; slot -= 1) {
    const car = document.createElement('div');
    const color = lane[slot];
    car.className = `car-slot ${color ? `car ${color}` : 'empty'}`;
    car.innerHTML = color ? `<span>${COLOR_LABELS[color]}</span>` : '';
    stack.appendChild(car);
  }
  const badge = document.createElement('div');
  badge.className = 'lane-badge';
  badge.textContent = `Serit ${laneIndex + 1}`;
  button.append(stack, badge);
  return button;
}

function render() {
  els.board.innerHTML = '';
  lanes.forEach((lane, laneIndex) => {
    els.board.appendChild(renderLane(lane, laneIndex));
  });
  els.moveCount.textContent = String(moveCount);
  els.statusText.textContent = statusMessage();
  els.undoBtn.disabled = !history.length;
  els.nextBtn.disabled = !checkWin() || levelIndex >= LEVELS.length - 1;
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
