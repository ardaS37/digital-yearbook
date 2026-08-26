const BOARD_SIZE = 15;
const CENTER = Math.floor(BOARD_SIZE / 2);
const LETTER_BAG = [
  ['A', 1, 12], ['B', 3, 2], ['C', 4, 2], ['Ç', 4, 2], ['D', 3, 2],
  ['E', 1, 8], ['F', 7, 1], ['G', 5, 1], ['Ğ', 10, 1], ['H', 5, 1],
  ['I', 2, 4], ['İ', 1, 7], ['J', 10, 1], ['K', 1, 7], ['L', 1, 7],
  ['M', 2, 4], ['N', 1, 5], ['O', 2, 3], ['Ö', 7, 1], ['P', 5, 1],
  ['R', 1, 6], ['S', 2, 3], ['Ş', 4, 2], ['T', 1, 5], ['U', 2, 3],
  ['Ü', 3, 2], ['V', 7, 1], ['Y', 3, 2], ['Z', 4, 2]
];

const BOARD_BONUSES = (() => {
  const map = new Map();
  const set = (row, col, type) => map.set(`${row}:${col}`, type);
  const addSymmetric = (coords, type) => {
    coords.forEach(([row, col]) => {
      const pairs = [
        [row, col],
        [row, BOARD_SIZE - 1 - col],
        [BOARD_SIZE - 1 - row, col],
        [BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col]
      ];
      pairs.forEach(([r, c]) => set(r, c, type));
    });
  };

  addSymmetric([[0, 0], [0, 7], [7, 0]], 'tw');
  addSymmetric([[1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [1, 13], [2, 12], [3, 11], [4, 10]], 'dw');
  addSymmetric([[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]], 'dl');
  addSymmetric([[0, 3], [2, 6], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8]], 'tl');
  set(CENTER, CENTER, 'dw');
  return map;
})();

let dictionary = null;
let board = [];
let bag = [];
let players = [];
let currentPlayer = 0;
let selectedRackIndex = -1;
let pendingTiles = new Map();
let lastWords = [];
let turnOpen = false;

const els = {
  player0Score: document.getElementById('player-0-score'),
  player1Score: document.getElementById('player-1-score'),
  player0Card: document.getElementById('player-0-card'),
  player1Card: document.getElementById('player-1-card'),
  statusText: document.getElementById('status-text'),
  turnText: document.getElementById('turn-text'),
  bagCount: document.getElementById('bag-count'),
  board: document.getElementById('board'),
  rack: document.getElementById('rack'),
  selectedText: document.getElementById('selected-text'),
  lastWords: document.getElementById('last-words'),
  shuffleBtn: document.getElementById('shuffle-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
  passBtn: document.getElementById('pass-btn'),
  submitBtn: document.getElementById('submit-btn'),
  overlay: document.getElementById('turn-overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayText: document.getElementById('overlay-text'),
  startTurnBtn: document.getElementById('start-turn-btn')
};

function makeBag() {
  const out = [];
  LETTER_BAG.forEach(([letter, value, count]) => {
    for (let index = 0; index < count; index += 1) {
      out.push({ id: `${letter}-${value}-${index}-${Math.random().toString(16).slice(2, 8)}`, letter, value });
    }
  });
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

function normalizeWord(word) {
  return String(word || '').toLocaleLowerCase('tr-TR');
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function drawTiles(playerIndex, count) {
  while (players[playerIndex].rack.length < count && bag.length) {
    players[playerIndex].rack.push(bag.pop());
  }
}

function resetGame() {
  board = createEmptyBoard();
  bag = makeBag();
  players = [
    { name: 'Oyuncu 1', score: 0, rack: [] },
    { name: 'Oyuncu 2', score: 0, rack: [] }
  ];
  drawTiles(0, 7);
  drawTiles(1, 7);
  currentPlayer = 0;
  selectedRackIndex = -1;
  pendingTiles = new Map();
  lastWords = [];
  openTurnOverlay('Oyuncu 1 hazirsa basla', 'Ekrani sadece siradaki oyuncu gorsun.');
  render();
}

function openTurnOverlay(title, text) {
  turnOpen = false;
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.overlay.classList.add('active');
}

function closeTurnOverlay() {
  turnOpen = true;
  els.overlay.classList.remove('active');
  render();
}

function currentRack() {
  return players[currentPlayer].rack;
}

function boardKey(row, col) {
  return `${row}:${col}`;
}

function getPending(row, col) {
  return pendingTiles.get(boardKey(row, col)) || null;
}

function removePendingTile(row, col) {
  const key = boardKey(row, col);
  const pending = pendingTiles.get(key);
  if (!pending) return;
  currentRack().push(pending.tile);
  pendingTiles.delete(key);
  selectedRackIndex = -1;
}

function handleCellClick(row, col) {
  if (!turnOpen) return;
  const existing = board[row][col];
  const pending = getPending(row, col);
  if (pending) {
    removePendingTile(row, col);
    render();
    return;
  }
  if (existing || selectedRackIndex < 0) return;
  const rack = currentRack();
  const tile = rack.splice(selectedRackIndex, 1)[0];
  pendingTiles.set(boardKey(row, col), { row, col, tile });
  selectedRackIndex = -1;
  render();
}

function handleRackClick(index) {
  if (!turnOpen) return;
  selectedRackIndex = selectedRackIndex === index ? -1 : index;
  render();
}

function collectPlaced() {
  return [...pendingTiles.values()].sort((a, b) => (a.row - b.row) || (a.col - b.col));
}

function hasAdjacentExisting(row, col) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
    const nr = row + dr;
    const nc = col + dc;
    return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && !!board[nr][nc];
  });
}

function allTilesOnOneLine(placed) {
  const sameRow = placed.every((item) => item.row === placed[0].row);
  const sameCol = placed.every((item) => item.col === placed[0].col);
  return sameRow || sameCol;
}

function contiguousOnLine(placed) {
  const sameRow = placed.every((item) => item.row === placed[0].row);
  if (sameRow) {
    const row = placed[0].row;
    const cols = placed.map((item) => item.col).sort((a, b) => a - b);
    for (let col = cols[0]; col <= cols[cols.length - 1]; col += 1) {
      if (!board[row][col] && !getPending(row, col)) return false;
    }
    return true;
  }
  const col = placed[0].col;
  const rows = placed.map((item) => item.row).sort((a, b) => a - b);
  for (let row = rows[0]; row <= rows[rows.length - 1]; row += 1) {
    if (!board[row][col] && !getPending(row, col)) return false;
  }
  return true;
}

function buildWord(row, col, dr, dc) {
  let sr = row;
  let sc = col;
  while (sr - dr >= 0 && sr - dr < BOARD_SIZE && sc - dc >= 0 && sc - dc < BOARD_SIZE) {
    const previous = getPending(sr - dr, sc - dc) || board[sr - dr][sc - dc];
    if (!previous) break;
    sr -= dr;
    sc -= dc;
  }
  const cells = [];
  let r = sr;
  let c = sc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    const pending = getPending(r, c);
    const existing = board[r][c];
    const payload = pending ? pending.tile : existing;
    if (!payload) break;
    cells.push({ row: r, col: c, tile: payload, pending: !!pending });
    r += dr;
    c += dc;
  }
  return cells;
}

function getBonus(row, col) {
  return BOARD_BONUSES.get(boardKey(row, col)) || null;
}

function scoreCells(cells) {
  return cells.reduce((total, cell) => {
    const bonus = cell.pending ? getBonus(cell.row, cell.col) : null;
    const letterScore = cell.tile.value * (bonus === 'dl' ? 2 : bonus === 'tl' ? 3 : 1);
    const wordMultiplier = bonus === 'dw' ? 2 : bonus === 'tw' ? 3 : 1;
    return total + letterScore * wordMultiplier;
  }, 0);
}

function validateMove() {
  const placed = collectPlaced();
  if (!placed.length) return { ok: false, message: 'En az bir harf yerleştirmelisin.' };
  if (!allTilesOnOneLine(placed)) return { ok: false, message: 'Bu tur tüm harfler aynı satırda veya sütunda olmalı.' };
  if (!contiguousOnLine(placed)) return { ok: false, message: 'Yerleştirilen harfler arada boşluk bırakmamalı.' };

  const sameRow = placed.every((item) => item.row === placed[0].row);
  const direction = sameRow ? [0, 1] : [1, 0];
  const main = buildWord(placed[0].row, placed[0].col, direction[0], direction[1]);
  const boardEmpty = board.every((row) => row.every((cell) => !cell));

  if (boardEmpty) {
    const coversCenter = placed.some((item) => item.row === CENTER && item.col === CENTER);
    if (!coversCenter) return { ok: false, message: 'İlk kelime merkez kareden geçmeli.' };
  } else {
    const connected = placed.some((item) => hasAdjacentExisting(item.row, item.col));
    if (!connected) return { ok: false, message: 'Yeni kelime mevcut harflerden birine bağlanmalı.' };
  }

  if (main.length < 2) return { ok: false, message: 'Kelime en az 2 harfli olmalı.' };
  const mainWord = main.map((item) => item.tile.letter).join('');
  const words = [{ word: mainWord, cells: main }];

  for (const item of placed) {
    const cross = buildWord(item.row, item.col, sameRow ? 1 : 0, sameRow ? 0 : 1);
    if (cross.length > 1) {
      words.push({ word: cross.map((cell) => cell.tile.letter).join(''), cells: cross });
    }
  }

  const uniqueWords = [];
  const seen = new Set();
  for (const entry of words) {
    const key = `${entry.word}:${entry.cells[0].row}:${entry.cells[0].col}:${entry.cells.length}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueWords.push(entry);
    }
  }

  for (const entry of uniqueWords) {
    if (!dictionary.has(normalizeWord(entry.word))) {
      return { ok: false, message: `Gecersiz kelime: ${entry.word}` };
    }
  }

  const score = uniqueWords.reduce((total, entry) => total + scoreCells(entry.cells), 0);
  return { ok: true, words: uniqueWords.map((entry) => entry.word), score };
}

function commitMove() {
  const result = validateMove();
  if (!result.ok) {
    els.statusText.textContent = result.message;
    return;
  }

  for (const pending of collectPlaced()) {
    board[pending.row][pending.col] = pending.tile;
  }
  pendingTiles.clear();
  players[currentPlayer].score += result.score;
  lastWords = result.words;
  drawTiles(currentPlayer, 7);

  const finished = !currentRack().length && !bag.length;
  if (finished) {
    render();
    const winner = players[0].score === players[1].score
      ? 'Berabere'
      : players[0].score > players[1].score
        ? 'Oyuncu 1 kazandi'
        : 'Oyuncu 2 kazandi';
    openTurnOverlay('Oyun bitti', `${winner}. Son kelimeler: ${lastWords.join(', ')}`);
    return;
  }

  currentPlayer = currentPlayer === 0 ? 1 : 0;
  selectedRackIndex = -1;
  openTurnOverlay(`${players[currentPlayer].name} hazirsa basla`, `Son hamle: ${lastWords.join(', ')} | +${result.score} puan`);
  render();
}

function cancelMove() {
  const placed = collectPlaced().reverse();
  placed.forEach((item) => {
    currentRack().push(item.tile);
  });
  pendingTiles.clear();
  selectedRackIndex = -1;
  render();
}

function passTurn() {
  if (pendingTiles.size) {
    els.statusText.textContent = 'Pas gecmeden once yerlestirdigin harfleri geri toplamalısın.';
    return;
  }
  currentPlayer = currentPlayer === 0 ? 1 : 0;
  selectedRackIndex = -1;
  lastWords = [];
  openTurnOverlay(`${players[currentPlayer].name} hazirsa basla`, 'Tur pas gecildi.');
  render();
}

function shuffleRack() {
  const rack = currentRack();
  for (let index = rack.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [rack[index], rack[swap]] = [rack[swap], rack[index]];
  }
  selectedRackIndex = -1;
  render();
}

function renderBoard() {
  els.board.innerHTML = '';
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      const existing = board[row][col];
      const pending = getPending(row, col);
      const bonus = getBonus(row, col);
      cell.className = `cell ${bonus ? `bonus bonus-${bonus}` : ''} ${row === CENTER && col === CENTER ? 'center' : ''} ${pending ? 'pending' : ''}`;
      if (existing || pending) {
        const tile = pending ? pending.tile : existing;
        cell.innerHTML = `<div class="tile"><span class="letter">${tile.letter}</span><span class="value">${tile.value}</span></div>`;
      } else if (row === CENTER && col === CENTER) {
        cell.textContent = '★';
      } else if (bonus) {
        cell.textContent = bonus.toUpperCase();
      }
      cell.addEventListener('click', () => handleCellClick(row, col));
      els.board.appendChild(cell);
    }
  }
}

function renderRack() {
  els.rack.innerHTML = '';
  currentRack().forEach((tile, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rack-tile ${selectedRackIndex === index ? 'selected' : ''}`;
    button.innerHTML = `<span class="letter">${tile.letter}</span><span class="value">${tile.value}</span>`;
    button.addEventListener('click', () => handleRackClick(index));
    els.rack.appendChild(button);
  });
}

function renderLastWords() {
  els.lastWords.textContent = lastWords.length ? lastWords.join(', ') : 'Henuz kelime yok.';
}

function render() {
  els.player0Score.textContent = String(players[0]?.score || 0);
  els.player1Score.textContent = String(players[1]?.score || 0);
  els.player0Card.classList.toggle('active', currentPlayer === 0);
  els.player1Card.classList.toggle('active', currentPlayer === 1);
  els.statusText.textContent = dictionary ? (turnOpen ? 'Hamle bekleniyor' : 'Sira gizlendi') : 'Sozluk yukleniyor';
  els.turnText.textContent = `Sira: ${players[currentPlayer]?.name || '-'}`;
  els.bagCount.textContent = `Torba: ${bag.length}`;
  els.selectedText.textContent = selectedRackIndex >= 0 ? `${currentRack()[selectedRackIndex].letter} secili` : 'Harf secilmedi';
  els.submitBtn.disabled = !turnOpen || !dictionary;
  els.cancelBtn.disabled = !turnOpen || !pendingTiles.size;
  els.passBtn.disabled = !turnOpen || !dictionary;
  els.shuffleBtn.disabled = !turnOpen || !dictionary;
  renderBoard();
  renderRack();
  renderLastWords();
}

async function loadDictionary() {
  const response = await fetch('/games/scrabble/play/tr_words.txt');
  const text = await response.text();
  dictionary = new Set(text.split('\n').map((word) => normalizeWord(word.trim())).filter(Boolean));
  resetGame();
}

els.startTurnBtn.addEventListener('click', () => closeTurnOverlay());
els.submitBtn.addEventListener('click', () => commitMove());
els.cancelBtn.addEventListener('click', () => cancelMove());
els.passBtn.addEventListener('click', () => passTurn());
els.shuffleBtn.addEventListener('click', () => shuffleRack());

loadDictionary().catch(() => {
  els.statusText.textContent = 'Sozluk yuklenemedi';
});
