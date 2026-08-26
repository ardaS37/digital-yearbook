const LENGTHS = [4, 5, 6, 7];
const MAX_ATTEMPTS = 6;

let dictionary = [];
let dictionaryByLength = new Map();
let wordLength = 5;
let answer = '';
let attempts = [];
let gameState = 'loading';

const els = {
  statusText: document.getElementById('status-text'),
  board: document.getElementById('board'),
  guessForm: document.getElementById('guess-form'),
  guessInput: document.getElementById('guess-input'),
  newGameBtn: document.getElementById('new-game-btn'),
  lengthSwitcher: document.getElementById('length-switcher')
};

function normalizeWord(word) {
  return String(word || '').trim().toLocaleUpperCase('tr-TR');
}

function buildDictionaryByLength(words) {
  const map = new Map();
  LENGTHS.forEach((length) => map.set(length, []));
  words.forEach((word) => {
    const normalized = normalizeWord(word);
    if (!/^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$/i.test(normalized)) return;
    if (!map.has(normalized.length)) return;
    map.get(normalized.length).push(normalized);
  });
  return map;
}

function pickAnswer(length) {
  const pool = dictionaryByLength.get(length) || [];
  if (!pool.length) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

function resetGame() {
  attempts = [];
  answer = pickAnswer(wordLength);
  gameState = answer ? 'playing' : 'empty';
  els.board.style.setProperty('--word-length', String(wordLength));
  els.statusText.textContent = answer
    ? `${wordLength} harfli kelime hazır. 6 deneme hakkın var.`
    : 'Bu uzunluk için kelime bulunamadı.';
  els.guessInput.value = '';
  els.guessInput.maxLength = wordLength;
  els.guessInput.placeholder = `${wordLength} harfli tahmin yaz`;
  syncLengthButtons();
  render();
}

function syncLengthButtons() {
  Array.from(els.lengthSwitcher.querySelectorAll('button')).forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.length) === wordLength);
  });
}

function scoreGuess(guess) {
  const normalizedGuess = normalizeWord(guess);
  const answerLetters = answer.split('');
  const result = Array.from({ length: wordLength }, () => 'absent');
  const counts = {};

  for (let i = 0; i < wordLength; i += 1) {
    if (normalizedGuess[i] === answerLetters[i]) {
      result[i] = 'correct';
    } else {
      const letter = answerLetters[i];
      counts[letter] = (counts[letter] || 0) + 1;
    }
  }

  for (let i = 0; i < wordLength; i += 1) {
    if (result[i] === 'correct') continue;
    const letter = normalizedGuess[i];
    if (counts[letter] > 0) {
      result[i] = 'present';
      counts[letter] -= 1;
    }
  }

  return result;
}

function isValidGuess(guess) {
  const normalized = normalizeWord(guess);
  if (normalized.length !== wordLength) return false;
  return dictionaryByLength.get(wordLength).includes(normalized);
}

function submitGuess(guess) {
  if (gameState !== 'playing') return;
  const normalized = normalizeWord(guess);
  if (!normalized) {
    els.statusText.textContent = 'Kelime yaz.';
    return;
  }
  if (normalized.length !== wordLength) {
    els.statusText.textContent = `${wordLength} harfli bir kelime girmelisin.`;
    return;
  }
  if (!isValidGuess(normalized)) {
    els.statusText.textContent = 'Sözlükte olmayan kelime.';
    return;
  }

  attempts.push({
    guess: normalized,
    score: scoreGuess(normalized)
  });

  if (normalized === answer) {
    gameState = 'won';
    els.statusText.textContent = `Doğru: ${answer}`;
    render();
    return;
  }

  if (attempts.length >= MAX_ATTEMPTS) {
    gameState = 'lost';
    els.statusText.textContent = `Bitti. Doğru cevap: ${answer}`;
    render();
    return;
  }

  els.statusText.textContent = `${MAX_ATTEMPTS - attempts.length} deneme hakkın kaldı.`;
  render();
}

function renderRow(rowIndex) {
  const row = document.createElement('div');
  row.className = 'lingo-row';
  const attempt = attempts[rowIndex];

  for (let i = 0; i < wordLength; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'lingo-cell';
    if (attempt) {
      cell.classList.add(attempt.score[i]);
      cell.textContent = attempt.guess[i] || '';
    }
    row.appendChild(cell);
  }
  return row;
}

function render() {
  els.board.innerHTML = '';
  for (let rowIndex = 0; rowIndex < MAX_ATTEMPTS; rowIndex += 1) {
    els.board.appendChild(renderRow(rowIndex));
  }

  if (gameState === 'won' || gameState === 'lost') {
    els.guessInput.disabled = true;
    els.guessForm.querySelector('button[type="submit"]').disabled = true;
  } else {
    els.guessInput.disabled = false;
    els.guessForm.querySelector('button[type="submit"]').disabled = false;
  }
}

async function loadDictionary() {
  const response = await fetch('/games/scrabble/play/tr_words.txt');
  const text = await response.text();
  dictionary = text.split('\n').map((word) => normalizeWord(word)).filter(Boolean);
  dictionaryByLength = buildDictionaryByLength(dictionary);
  resetGame();
}

els.lengthSwitcher.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-length]');
  if (!button) return;
  wordLength = Number(button.dataset.length);
  resetGame();
  els.guessInput.focus();
});

els.newGameBtn.addEventListener('click', () => {
  resetGame();
  els.guessInput.focus();
});

els.guessForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const guess = els.guessInput.value;
  submitGuess(guess);
  if (gameState === 'playing') {
    els.guessInput.value = '';
    els.guessInput.focus();
  }
});

loadDictionary().catch(() => {
  els.statusText.textContent = 'Sözlük yüklenemedi.';
});
