const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const DISCONNECT_TIMEOUT_MS = 1000 * 30;
const ABALONE_COORDS = makeHexCoords(4);
const ABALONE_INDEX = new Map(ABALONE_COORDS.map((coord, index) => [coord.join(','), index]));
const ABALONE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const ABALONE_SETUP = {
  O: new Set(ABALONE_COORDS.map(([q, r], index) => ((r <= -3) || (r === -2 && q >= 0 && q <= 2) ? index : null)).filter((index) => index !== null)),
  X: new Set(ABALONE_COORDS.map(([q, r], index) => ((r >= 3) || (r === 2 && q <= 0 && q >= -2) ? index : null)).filter((index) => index !== null))
};
const XOX_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const GAME_META = {
  alti: { title: 'Altı', players: 2, pc: true, status: 'active' },
  xox: { title: 'XOX', players: 2, pc: true, status: 'active' },
  sos: { title: 'SOS', players: 2, pc: true, status: 'active' },
  'kutu-doldurmaca': { title: 'Kutu Doldurmaca', players: 2, pc: true, status: 'active' },
  'yilanlar-ve-merdivenler': { title: 'Yılanlar ve Merdivenler', players: 4, pc: true, status: 'active' },
  '9-tas': { title: '9 Taş', players: 2, pc: true, status: 'active' },
  '3-tas': { title: '3 Taş', players: 2, pc: true, status: 'active' },
  dama: { title: 'Dama', players: 2, pc: true, status: 'active' },
  'capraz-dama': { title: 'Çapraz Dama', players: 2, pc: true, status: 'active' },
  mangala: { title: 'Mangala', players: 2, pc: true, status: 'active' },
  abalone: { title: 'Abalone', players: 2, pc: true, status: 'active' },
  tavla: { title: 'Tavla', players: 2, pc: true, status: 'active' },
  koridor: { title: 'Koridor', players: 2, pc: true, status: 'active' },
  satranc: { title: 'Satranç', players: 2, pc: true, status: 'active' },
  domino: { title: 'Domino', players: 4, pc: true, status: 'active' },
  go: { title: 'Go', players: 2, pc: true, status: 'active' },
  'kizma-birader': { title: 'Kızma Birader', players: 4, pc: true, status: 'active' }
};

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) return res.status(401).json({ error: 'Yıllık hesabıyla giriş yapmalısın.' });
  return next();
}

function makePlayer(req) {
  return {
    id: String(req.currentUser.id),
    name: req.currentUser.name || req.currentUser.login_identifier || `Oyuncu ${req.currentUser.id}`
  };
}

function makeBot(mark) {
  return {
    id: `bot-${mark}`,
    name: `PC ${mark}`
  };
}

function isBotPlayer(player) {
  return player && String(player.id || '').startsWith('bot-');
}

function createCode() {
  let code = '';
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function getGame(type) {
  if (!GAME_META[type] || GAME_META[type].status !== 'active') return null;
  return type;
}

function createInitialState(type, options = {}) {
  if (type === 'alti') {
    return { size: 7, board: Array(49).fill(null), turn: 'X', winner: null, winPattern: null };
  }
  if (type === 'xox') {
    return { board: Array(9).fill(null), turn: 'X', scores: { X: 0, O: 0 }, winner: null };
  }
  if (type === 'sos') {
    return { size: 8, board: Array(64).fill(null), turn: 'X', scores: { X: 0, O: 0 }, winner: null };
  }
  if (type === 'kutu-doldurmaca') {
    const presetText = String(options.boardPreset || options.boardSize || '4x4').toLowerCase();
    const presetMatch = presetText.match(/^(\d{1,2})x(\d{1,2})$/);
    const cols = Math.max(2, Math.min(12, Number(presetMatch ? presetMatch[1] : 4) || 4));
    const rows = Math.max(2, Math.min(12, Number(presetMatch ? presetMatch[2] : 4) || 4));
    return {
      size: Math.max(rows, cols) + 1,
      rows,
      cols,
      lines: {},
      boxes: {},
      turn: 'X',
      scores: { X: 0, O: 0 },
      winner: null
    };
  }
  if (type === 'yilanlar-ve-merdivenler') {
    return {
      positions: { X: 0, O: 0, A: 0, B: 0 },
      turn: 'X',
      lastRoll: null,
      winner: null
    };
  }
  if (type === '9-tas' || type === '3-tas') {
    const piecesPerPlayer = type === '9-tas' ? 9 : 3;
    return {
      board: Array(24).fill(null),
      turn: 'X',
      phase: 'placing',
      placed: { X: 0, O: 0 },
      piecesPerPlayer,
      selected: null,
      winner: null
    };
  }
  if (type === 'dama' || type === 'capraz-dama') {
    const board = Array(64).fill(null);
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if ((row + col) % 2 === 1) board[row * 8 + col] = 'O';
      }
    }
    for (let row = 5; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if ((row + col) % 2 === 1) board[row * 8 + col] = 'X';
      }
    }
    return { board, turn: 'X', winner: null };
  }
  if (type === 'mangala') {
    return {
      pits: {
        X: [4, 4, 4, 4, 4, 4],
        O: [4, 4, 4, 4, 4, 4]
      },
      stores: { X: 0, O: 0 },
      castles: { X: null, O: null },
      lastMove: null,
      turn: 'X',
      winner: null
    };
  }
  if (type === 'abalone') {
    const board = Array(61).fill(null);
    ABALONE_SETUP.O.forEach((index) => { board[index] = 'O'; });
    ABALONE_SETUP.X.forEach((index) => { board[index] = 'X'; });
    return { board, turn: 'X', pushed: { X: 0, O: 0 }, winner: null };
  }
  if (type === 'tavla') {
    const points = Array(24).fill(null).map(() => ({ X: 0, O: 0 }));
    points[23].X = 2; points[12].X = 5; points[7].X = 3; points[5].X = 5;
    points[0].O = 2; points[11].O = 5; points[16].O = 3; points[18].O = 5;
    return {
      points,
      bar: { X: 0, O: 0 },
      borne: { X: 0, O: 0 },
      dice: [],
      turn: 'X',
      winner: null
    };
  }
  if (type === 'domino') {
    const tiles = [];
    for (let a = 0; a <= 6; a += 1) {
      for (let b = a; b <= 6; b += 1) tiles.push([a, b]);
    }
    const shuffled = tiles.sort(() => Math.random() - 0.5);
    return {
      hands: { X: shuffled.slice(0, 7), O: shuffled.slice(7, 14), A: shuffled.slice(14, 21), B: shuffled.slice(21, 28) },
      chain: [],
      turn: 'X',
      winner: null
    };
  }
  if (type === 'go') {
    return {
      size: 19,
      board: Array(19 * 19).fill(null),
      captures: { X: 0, O: 0 },
      passes: 0,
      koHash: null,
      finalScore: null,
      turn: 'X',
      winner: null
    };
  }
  if (type === 'koridor') {
    return {
      pawns: { X: 76, O: 4 },
      walls: { X: 10, O: 10 },
      placedWalls: [],
      turn: 'X',
      winner: null
    };
  }
  if (type === 'satranc') {
    return { board: createChessBoard(), turn: 'X', winner: null };
  }
  if (type === 'kizma-birader') {
    return {
      positions: { X: [-1, -1, -1, -1], O: [-1, -1, -1, -1], A: [-1, -1, -1, -1], B: [-1, -1, -1, -1] },
      finished: { X: 0, O: 0, A: 0, B: 0 },
      lastRoll: null,
      turn: 'X',
      winner: null
    };
  }
  return {};
}

function dotsDimensions(state) {
  const rows = Math.max(2, Number(state.rows || (state.size ? state.size - 1 : 4)) || 4);
  const cols = Math.max(2, Number(state.cols || (state.size ? state.size - 1 : 4)) || 4);
  return {
    rows,
    cols,
    dotRows: rows + 1,
    dotCols: cols + 1,
    totalBoxes: rows * cols
  };
}

function marksForRoom(room) {
  return ['X', 'O', 'A', 'B'].slice(0, GAME_META[room.type].players);
}

function playerMark(room, userId) {
  return Object.entries(room.players).find(([, player]) => player && player.id === userId)?.[0] || null;
}

function nextMark(room, mark) {
  const marks = marksForRoom(room).filter((item) => room.players[item]);
  const idx = marks.indexOf(mark);
  return marks[(idx + 1) % marks.length] || mark;
}

function humanMarks(room) {
  return marksForRoom(room).filter((mark) => room.players[mark] && !isBotPlayer(room.players[mark]));
}

function staleHumanMarks(room, now = Date.now()) {
  return humanMarks(room).filter((mark) => now - Number(room.lastSeen[mark] || 0) > DISCONNECT_TIMEOUT_MS);
}

function activeHumanMarks(room, now = Date.now()) {
  return humanMarks(room).filter((mark) => now - Number(room.lastSeen[mark] || 0) <= DISCONNECT_TIMEOUT_MS);
}

function maybeResumeRoom(room) {
  if (room.status !== 'paused') return;
  const now = Date.now();
  const humans = humanMarks(room);
  if (!humans.length) return;
  if (humans.some((mark) => !room.players[mark])) return;
  if (staleHumanMarks(room, now).length) return;
  room.status = marksForRoom(room).every((mark) => room.players[mark]) ? 'playing' : 'waiting';
  room.finishReason = '';
  room.pauseInfo = null;
}

function touch(room, userId) {
  const mark = playerMark(room, userId);
  if (mark) {
    room.lastSeen[mark] = Date.now();
    maybeResumeRoom(room);
  }
  room.updatedAt = Date.now();
  return mark;
}

function checkDisconnect(room) {
  if (room.status !== 'playing') return;
  const now = Date.now();
  const humans = humanMarks(room);
  const stale = staleHumanMarks(room, now);
  if (!stale.length) return;
  if (stale.length === humans.length) return;
  room.status = 'paused';
  room.pauseInfo = { stale, since: now };
  room.finishReason = `${stale.map((mark) => room.players[mark]?.name || mark).join(', ')} bağlantıdan düştü. Oyun geri bağlanma için beklemede.`;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeHexCoords(radius) {
  const coords = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) coords.push([q, r]);
  }
  return coords;
}

function xoxWinner(board) {
  for (const [a, b, c] of XOX_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

function countSosAt(board, size, row, col) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  let total = 0;
  const at = (r, c) => (r >= 0 && r < size && c >= 0 && c < size ? board[r * size + c] : null);
  dirs.forEach(([dr, dc]) => {
    for (let offset = -2; offset <= 0; offset += 1) {
      const cells = [0, 1, 2].map((step) => at(row + (offset + step) * dr, col + (offset + step) * dc));
      if (cells.join('') === 'SOS') total += 1;
    }
  });
  return total;
}

function altiNeighbors(size, index) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col],
    [row + 1, col],
    [row - 1, col + 1],
    [row + 1, col - 1]
  ]
    .filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)
    .map(([r, c]) => r * size + c);
}

const ALTI_LINE_DIRECTIONS = [[0, 1], [1, 0], [1, -1]];
const ALTI_ALL_DIRECTIONS = [[0, 1], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1]];
const ALTI_PYRAMID_EDGES = [
  [[0, 1], [1, 0]],
  [[1, 0], [1, -1]],
  [[1, -1], [0, -1]],
  [[0, -1], [-1, 0]],
  [[-1, 0], [-1, 1]],
  [[-1, 1], [0, 1]]
];
const altiPatternCache = new Map();

function altiIndex(size, row, col) {
  return row >= 0 && col >= 0 && row < size && col < size ? row * size + col : -1;
}

function altiPatternSet(indices, type, list, seen) {
  if (indices.some((index) => index < 0)) return;
  const key = indices.slice().sort((left, right) => left - right).join('-');
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ type, indices });
}

function getAltiPatterns(size) {
  if (altiPatternCache.has(size)) return altiPatternCache.get(size);
  const patterns = [];
  const seen = new Set();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      ALTI_LINE_DIRECTIONS.forEach(([dr, dc]) => {
        const indices = [];
        for (let step = 0; step < 6; step += 1) {
          indices.push(altiIndex(size, row + dr * step, col + dc * step));
        }
        altiPatternSet(indices, 'line', patterns, seen);
      });

      const center = altiIndex(size, row, col);
      const ring = ALTI_ALL_DIRECTIONS.map(([dr, dc]) => altiIndex(size, row + dr, col + dc));
      altiPatternSet(ring, 'ring', patterns, seen);

      ALTI_PYRAMID_EDGES.forEach(([[dr1, dc1], [dr2, dc2]]) => {
        const indices = [];
        for (let left = 0; left < 3; left += 1) {
          for (let right = 0; right < 3 - left; right += 1) {
            indices.push(altiIndex(size, row + dr1 * left + dr2 * right, col + dc1 * left + dc2 * right));
          }
        }
        altiPatternSet(indices, 'pyramid', patterns, seen);
      });
    }
  }

  altiPatternCache.set(size, patterns);
  return patterns;
}

function altiWinPattern(board, size, mark) {
  const patterns = getAltiPatterns(size);
  return patterns.find((pattern) => pattern.indices.every((index) => board[index] === mark)) || null;
}

function altiPatternProgress(board, size, mark, pattern) {
  let own = 0;
  let opp = 0;
  pattern.indices.forEach((index) => {
    if (board[index] === mark) own += 1;
    else if (board[index]) opp += 1;
  });
  if (opp) return -1000;
  const bonus = pattern.type === 'ring' ? 9 : pattern.type === 'pyramid' ? 7 : 5;
  return own * own * bonus;
}

function altiClusterSize(board, size, start, mark, visited) {
  if (board[start] !== mark || visited.has(start)) return 0;
  const stack = [start];
  visited.add(start);
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    count += 1;
    altiNeighbors(size, current).forEach((next) => {
      if (board[next] !== mark || visited.has(next)) return;
      visited.add(next);
      stack.push(next);
    });
  }
  return count;
}

function evaluateAltiState(state, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const mid = (state.size - 1) / 2;
  const ownSeen = new Set();
  const oppSeen = new Set();
  let score = 0;
  let ownLargest = 0;
  let oppLargest = 0;
  state.board.forEach((cell, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const center = state.size - (Math.abs(row - mid) + Math.abs(col - mid));
    if (cell === mark) {
      score += 22 + center * 3 + (mark === 'X' ? row : col) * 4;
      ownLargest = Math.max(ownLargest, altiClusterSize(state.board, state.size, index, mark, ownSeen));
    } else if (cell === opponent) {
      score -= 22 + center * 3 + (opponent === 'X' ? row : col) * 4;
      oppLargest = Math.max(oppLargest, altiClusterSize(state.board, state.size, index, opponent, oppSeen));
    }
  });
  const patterns = getAltiPatterns(state.size);
  let ownPattern = 0;
  let oppPattern = 0;
  patterns.forEach((pattern) => {
    ownPattern = Math.max(ownPattern, altiPatternProgress(state.board, state.size, mark, pattern));
    oppPattern = Math.max(oppPattern, altiPatternProgress(state.board, state.size, opponent, pattern));
  });
  return score + ownLargest * 18 - oppLargest * 16 + ownPattern - oppPattern;
}

function applyMove(room, mark, move) {
  const state = room.state;
  if (room.type === 'alti') {
    const index = Number(move.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.board.length || state.board[index]) return { error: 'Geçersiz hamle.' };
    state.board[index] = mark;
    const winningPattern = altiWinPattern(state.board, state.size, mark);
    if (winningPattern) {
      state.winner = mark;
      state.winPattern = winningPattern.type;
      room.status = 'finished';
    } else {
      state.turn = nextMark(room, mark);
    }
    return {};
  }
  if (room.type === 'xox') {
    const index = Number(move.index);
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.board[index]) return { error: 'Geçersiz hamle.' };
    state.board[index] = mark;
    const winner = xoxWinner(state.board);
    if (winner) {
      state.winner = winner;
      room.status = 'finished';
    } else {
      state.turn = nextMark(room, mark);
    }
    return {};
  }

  if (room.type === 'sos') {
    const index = Number(move.index);
    const letter = move.letter === 'O' ? 'O' : 'S';
    if (!Number.isInteger(index) || index < 0 || index >= state.board.length || state.board[index]) return { error: 'Geçersiz hamle.' };
    state.board[index] = letter;
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const gained = countSosAt(state.board, state.size, row, col);
    if (gained) state.scores[mark] += gained;
    if (state.board.every(Boolean)) {
      room.status = 'finished';
      state.winner = state.scores.X === state.scores.O ? 'draw' : state.scores.X > state.scores.O ? 'X' : 'O';
    } else if (!gained) {
      state.turn = nextMark(room, mark);
    }
    return {};
  }

  if (room.type === 'kutu-doldurmaca') {
    const line = String(move.line || '');
    if (!/^[hv]-\d+-\d+$/.test(line) || state.lines[line]) return { error: 'Geçersiz çizgi.' };
    state.lines[line] = mark;
    const gained = closeBoxes(state, line, mark);
    if (gained) state.scores[mark] += gained;
    const totalBoxes = dotsDimensions(state).totalBoxes;
    if (Object.keys(state.boxes).length >= totalBoxes) {
      room.status = 'finished';
      state.winner = state.scores.X === state.scores.O ? 'draw' : state.scores.X > state.scores.O ? 'X' : 'O';
    } else if (!gained) {
      state.turn = nextMark(room, mark);
    }
    return {};
  }

  if (room.type === 'yilanlar-ve-merdivenler') {
    const roll = Math.floor(Math.random() * 6) + 1;
    const jumps = { 3: 22, 5: 8, 11: 26, 20: 29, 27: 1, 21: 9, 17: 4, 19: 7 };
    let next = Math.min(30, Number(state.positions[mark] || 0) + roll);
    next = jumps[next] || next;
    state.positions[mark] = next;
    state.lastRoll = { mark, roll };
    if (next >= 30) {
      room.status = 'finished';
      state.winner = mark;
    } else {
      state.turn = nextMark(room, mark);
    }
    return {};
  }

  if (room.type === '9-tas' || room.type === '3-tas') {
    return applyMorrisMove(room, mark, move);
  }

  if (room.type === 'dama' || room.type === 'capraz-dama') {
    return applyCheckersMove(room, mark, move);
  }

  if (room.type === 'mangala') {
    return applyMangalaMove(room, mark, move);
  }

  if (room.type === 'abalone') {
    return applyAbaloneMove(room, mark, move);
  }

  if (room.type === 'tavla') {
    return applyBackgammonMove(room, mark, move);
  }

  if (room.type === 'domino') {
    return applyDominoMove(room, mark, move);
  }

  if (room.type === 'go') {
    return applyGoMove(room, mark, move);
  }

  if (room.type === 'koridor') {
    return applyCorridorMove(room, mark, move);
  }

  if (room.type === 'satranc') {
    return applyChessMove(room, mark, move);
  }

  if (room.type === 'kizma-birader') {
    return applyLudoMove(room, mark, move);
  }

  return { error: 'Bu oyun henüz hazır değil.' };
}

function createChessBoard() {
  const board = Array(64).fill(null);
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let col = 0; col < 8; col += 1) {
    board[col] = `O${back[col]}`;
    board[8 + col] = 'OP';
    board[48 + col] = 'XP';
    board[56 + col] = `X${back[col]}`;
  }
  return board;
}

function ensureBackgammonSetup(state) {
  if (state.points.some((point) => point.X || point.O)) return;
  state.points[23].X = 2; state.points[12].X = 5; state.points[7].X = 3; state.points[5].X = 5;
  state.points[0].O = 2; state.points[11].O = 5; state.points[16].O = 3; state.points[18].O = 5;
}

function rollDice() {
  const a = Math.floor(Math.random() * 6) + 1;
  const b = Math.floor(Math.random() * 6) + 1;
  return a === b ? [a, a, a, a] : [a, b];
}

function backgammonHomeRange(mark) {
  return mark === 'X' ? [0, 5] : [18, 23];
}

function allBackgammonCheckersHome(state, mark) {
  if ((state.bar?.[mark] || 0) > 0) return false;
  const [start, end] = backgammonHomeRange(mark);
  return state.points.every((point, index) => {
    if (index >= start && index <= end) return true;
    return !point[mark];
  });
}

function backgammonEntryPoint(mark, die) {
  return mark === 'X' ? 24 - die : die - 1;
}

function backgammonHasLegalMove(state, mark) {
  ensureBackgammonSetup(state);
  if (!state.dice.length) return false;
  const opponent = mark === 'X' ? 'O' : 'X';
  if ((state.bar?.[mark] || 0) > 0) {
    for (const die of state.dice) {
      const to = backgammonEntryPoint(mark, die);
      if (to >= 0 && to < 24 && state.points[to][opponent] <= 1) return true;
    }
    return false;
  }
  const dir = mark === 'X' ? -1 : 1;
  const [homeStart, homeEnd] = backgammonHomeRange(mark);
  const allHome = allBackgammonCheckersHome(state, mark);
  for (let from = 0; from < 24; from += 1) {
    if (state.points[from][mark] <= 0) continue;
    for (const die of state.dice) {
      const to = from + dir * die;
      if (to >= 0 && to < 24) {
        if (state.points[to][opponent] <= 1) return true;
      } else if (allHome && from >= homeStart && from <= homeEnd) {
        return true;
      }
    }
  }
  return false;
}

function backgammonPipCount(state, mark) {
  return state.points.reduce((total, point, index) => {
    if (!point[mark]) return total;
    const distance = mark === 'X' ? index + 1 : 24 - index;
    return total + (point[mark] * distance);
  }, 0);
}

function backgammonBlotCount(state, mark) {
  return state.points.reduce((total, point) => total + (point[mark] === 1 ? 1 : 0), 0);
}

function backgammonAnchorCount(state, mark) {
  return state.points.reduce((total, point) => total + (point[mark] >= 2 ? 1 : 0), 0);
}

function backgammonHomeBoardStrength(state, mark) {
  const [start, end] = backgammonHomeRange(mark);
  let covered = 0;
  let checkers = 0;
  for (let index = start; index <= end; index += 1) {
    if (state.points[index][mark] >= 2) covered += 1;
    checkers += state.points[index][mark];
  }
  return { covered, checkers };
}

function evaluateBackgammonState(state, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const ownHome = backgammonHomeBoardStrength(state, mark);
  const oppHome = backgammonHomeBoardStrength(state, opponent);
  return {
    pip: backgammonPipCount(state, mark),
    oppPip: backgammonPipCount(state, opponent),
    blots: backgammonBlotCount(state, mark),
    oppBlots: backgammonBlotCount(state, opponent),
    anchors: backgammonAnchorCount(state, mark),
    oppAnchors: backgammonAnchorCount(state, opponent),
    borne: state.borne[mark] || 0,
    oppBorne: state.borne[opponent] || 0,
    homeCovered: ownHome.covered,
    homeCheckers: ownHome.checkers,
    oppHomeCovered: oppHome.covered
  };
}

function chooseBackgammonBotMove(room, mark, legal) {
  if (!room.state.dice.length) return { roll: true };
  const playable = legal.filter((move) => !move.roll && !move.pass);
  if (!playable.length) return { pass: true };
  const before = evaluateBackgammonState(room.state, mark);
  const opponent = mark === 'X' ? 'O' : 'X';
  const scored = playable.map((move) => {
    const copy = {
      ...room,
      players: cloneValue(room.players),
      lastSeen: cloneValue(room.lastSeen),
      state: cloneValue(room.state)
    };
    applyMove(copy, mark, cloneValue(move));
    const after = evaluateBackgammonState(copy.state, mark);
    const landing = mark === 'X' ? move.from - move.die : move.from + move.die;
    const isBearOff = landing < 0 || landing >= 24;
    const score = (
      ((after.borne - before.borne) * 260)
      + ((before.oppBlots - after.oppBlots) * 82)
      + ((before.pip - after.pip) * 7)
      + ((after.homeCovered - before.homeCovered) * 26)
      + ((after.anchors - before.anchors) * 12)
      + ((after.homeCheckers - before.homeCheckers) * 4)
      + ((after.oppPip - before.oppPip) * 2)
      - ((after.blots - before.blots) * 40)
      - ((after.oppAnchors - before.oppAnchors) * 4)
      - ((after.oppBorne - before.oppBorne) * 200)
      + (isBearOff ? 18 : 0)
      + ((room.state.points[move.from][mark] === 1 && !isBearOff) ? 8 : 0)
      + ((landing >= 0 && landing < 24 && room.state.points[landing][opponent] === 1) ? 52 : 0)
      + ((landing >= 0 && landing < 24 && copy.state.points[landing][mark] >= 2) ? 14 : 0)
      + (move.die * 0.35)
    );
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}

function applyBackgammonMove(room, mark, move) {
  const state = room.state;
  ensureBackgammonSetup(state);
  if (!state.dice.length || move.roll) {
    state.dice = rollDice();
    return {};
  }
  if (move.pass) {
    if (backgammonHasLegalMove(state, mark)) return { error: 'Oynanabilir hamlen varken pas gecemezsin.' };
    state.dice = [];
    state.turn = nextMark(room, mark);
    return {};
  }
  const from = Number(move.from);
  const die = Number(move.die);
  const isBarMove = from === -1;
  if ((!Number.isInteger(from) || (from < -1 || from >= 24)) || !state.dice.includes(die)) return { error: 'Geçersiz hamle.' };
  if ((state.bar?.[mark] || 0) > 0 && !isBarMove) return { error: 'Once bardaki pulunu oyuna sokmalisin.' };
  if (isBarMove) {
    if ((state.bar?.[mark] || 0) <= 0) return { error: 'Barda pulun yok.' };
  } else if (state.points[from][mark] <= 0) return { error: 'Seçilen noktada pulun yok.' };
  const dir = mark === 'X' ? -1 : 1;
  const to = isBarMove ? backgammonEntryPoint(mark, die) : from + dir * die;
  const opponent = mark === 'X' ? 'O' : 'X';
  const [homeStart, homeEnd] = backgammonHomeRange(mark);
  if (!isBarMove && (to < 0 || to >= 24) && (!allBackgammonCheckersHome(state, mark) || from < homeStart || from > homeEnd)) {
    return { error: 'Tum pullarin kendi evinde olmadan toplayamazsin.' };
  }
  if (to >= 0 && to < 24 && state.points[to][opponent] > 1) return { error: 'Kapalı noktaya gidemezsin.' };
  if (isBarMove) state.bar[mark] -= 1;
  else state.points[from][mark] -= 1;
  if (to < 0 || to >= 24) {
    state.borne[mark] += 1;
  } else {
    if (state.points[to][opponent] === 1) {
      state.points[to][opponent] = 0;
      state.bar[opponent] += 1;
    }
    state.points[to][mark] += 1;
  }
  state.dice.splice(state.dice.indexOf(die), 1);
  if (state.borne[mark] >= 15) {
    room.status = 'finished';
    state.winner = mark;
  } else if (!state.dice.length) {
    state.turn = nextMark(room, mark);
  }
  return {};
}

function applyDominoMove(room, mark, move) {
  const state = room.state;
  const hand = state.hands[mark] || [];
  if (move.pass) {
    state.turn = nextMark(room, mark);
    return {};
  }
  const index = Number(move.index);
  if (!Number.isInteger(index) || index < 0 || index >= hand.length) return { error: 'Geçersiz taş.' };
  let tile = hand[index];
  const side = move.side === 'right' ? 'right' : 'left';
  if (state.chain.length) {
    const left = state.chain[0][0];
    const right = state.chain[state.chain.length - 1][1];
    if (side === 'left') {
      if (tile[1] === left) state.chain.unshift(tile);
      else if (tile[0] === left) state.chain.unshift([tile[1], tile[0]]);
      else return { error: 'Sol uca uymuyor.' };
    } else if (tile[0] === right) state.chain.push(tile);
    else if (tile[1] === right) state.chain.push([tile[1], tile[0]]);
    else return { error: 'Sağ uca uymuyor.' };
  } else {
    state.chain.push(tile);
  }
  hand.splice(index, 1);
  if (!hand.length) {
    room.status = 'finished';
    state.winner = mark;
  } else {
    state.turn = nextMark(room, mark);
  }
  return {};
}

function goNeighbors(size, index) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
    .map(([r, c]) => r * size + c);
}

function goGroup(board, size, start) {
  const color = board[start];
  const seen = new Set([start]);
  const stack = [start];
  const stones = [];
  let liberties = 0;
  while (stack.length) {
    const item = stack.pop();
    stones.push(item);
    goNeighbors(size, item).forEach((next) => {
      if (!board[next]) liberties += 1;
      else if (board[next] === color && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    });
  }
  return { stones, liberties };
}

function goTerritoryScore(state) {
  const seen = new Set();
  const territory = { X: 0, O: 0, neutral: 0 };
  for (let index = 0; index < state.board.length; index += 1) {
    if (state.board[index] || seen.has(index)) continue;
    const queue = [index];
    const region = [];
    const borders = new Set();
    seen.add(index);
    while (queue.length) {
      const current = queue.pop();
      region.push(current);
      goNeighbors(state.size, current).forEach((next) => {
        const cell = state.board[next];
        if (!cell) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        } else {
          borders.add(cell);
        }
      });
    }
    if (borders.size === 1) {
      const owner = Array.from(borders)[0];
      territory[owner] += region.length;
    } else {
      territory.neutral += region.length;
    }
  }
  return territory;
}

function applyGoMove(room, mark, move) {
  const state = room.state;
  if ([9, 13, 19].includes(Number(move.size)) && state.board.every((cell) => !cell)) {
    state.size = Number(move.size);
    state.board = Array(state.size * state.size).fill(null);
    state.koHash = null;
    state.finalScore = null;
    return {};
  }
  if (move.pass) {
    state.passes += 1;
    state.koHash = null;
    if (state.passes >= 2) {
      const stones = {
        X: state.board.filter((cell) => cell === 'X').length,
        O: state.board.filter((cell) => cell === 'O').length
      };
      const territory = goTerritoryScore(state);
      const x = stones.X + territory.X + state.captures.X;
      const o = stones.O + territory.O + state.captures.O;
      state.finalScore = {
        stones,
        territory,
        captures: { ...state.captures },
        total: { X: x, O: o }
      };
      room.status = 'finished';
      state.winner = x === o ? 'draw' : x > o ? 'X' : 'O';
    } else {
      state.turn = nextMark(room, mark);
    }
    return {};
  }
  const index = Number(move.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length || state.board[index]) return { error: 'Geçersiz nokta.' };
  const beforeBoard = state.board.slice();
  const beforeCaptures = { ...state.captures };
  const beforeHash = state.board.join('|');
  state.board[index] = mark;
  state.passes = 0;
  const opponent = mark === 'X' ? 'O' : 'X';
  goNeighbors(state.size, index).forEach((next) => {
    if (state.board[next] === opponent) {
      const group = goGroup(state.board, state.size, next);
      if (group.liberties === 0) {
        group.stones.forEach((stone) => { state.board[stone] = null; });
        state.captures[mark] += group.stones.length;
      }
    }
  });
  const own = goGroup(state.board, state.size, index);
  if (own.liberties === 0) {
    state.board = beforeBoard;
    state.captures = beforeCaptures;
    return { error: 'İntihar hamlesi yapılamaz.' };
  }
  const afterHash = state.board.join('|');
  if (state.koHash && afterHash === state.koHash) {
    state.board = beforeBoard;
    state.captures = beforeCaptures;
    return { error: 'Ko kuralı gereği aynı konum hemen tekrar edilemez.' };
  }
  state.koHash = beforeHash;
  state.finalScore = null;
  state.turn = nextMark(room, mark);
  return {};
}

function sameAbaloneDir(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function oppositeAbaloneDir(dir) {
  return [-dir[0], -dir[1]];
}

function abaloneProjection(index, dir) {
  const [q, r] = ABALONE_COORDS[index];
  return q * dir[0] + r * dir[1];
}

function sortAbaloneSelection(selection, dir) {
  return selection.slice().sort((a, b) => abaloneProjection(a, dir) - abaloneProjection(b, dir));
}

function abaloneNext(index, dir) {
  const [q, r] = ABALONE_COORDS[index];
  return ABALONE_INDEX.get(`${q + dir[0]},${r + dir[1]}`);
}

function abaloneSelectionInfo(state, mark, selectionInput) {
  const selection = Array.from(new Set((selectionInput || []).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item < 61)));
  if (!selection.length || selection.length > 3) return null;
  if (!selection.every((index) => state.board[index] === mark)) return null;
  if (selection.length === 1) return { selection, lineDir: null };
  for (const dir of ABALONE_DIRS) {
    const ordered = sortAbaloneSelection(selection, dir);
    let ok = true;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (abaloneNext(ordered[i], dir) !== ordered[i + 1]) {
        ok = false;
        break;
      }
    }
    if (ok) return { selection: ordered, lineDir: dir };
  }
  return null;
}

function abaloneResolveMove(state, mark, move) {
  const selected = Array.isArray(move.selected) && move.selected.length ? move.selected : [Number(move.from)];
  let dir = null;
  if (typeof move.dir === 'string') {
    const parts = move.dir.split(',').map(Number);
    if (parts.length === 2 && ABALONE_DIRS.some((item) => sameAbaloneDir(item, parts))) dir = parts;
  }
  if (!dir && Number.isInteger(Number(move.to)) && Number.isInteger(Number(move.from))) {
    const fromCoord = ABALONE_COORDS[Number(move.from)];
    const toCoord = ABALONE_COORDS[Number(move.to)];
    if (fromCoord && toCoord) {
      const candidate = [toCoord[0] - fromCoord[0], toCoord[1] - fromCoord[1]];
      if (ABALONE_DIRS.some((item) => sameAbaloneDir(item, candidate))) dir = candidate;
    }
  }
  const info = abaloneSelectionInfo(state, mark, selected);
  if (!info || !dir) return null;
  return { selection: info.selection, lineDir: info.lineDir, dir };
}

function abaloneLegalMovesForSelection(state, mark, selectionInput) {
  const info = abaloneSelectionInfo(state, mark, selectionInput);
  if (!info) return [];
  const { selection, lineDir } = info;
  const opponent = mark === 'X' ? 'O' : 'X';
  const moves = [];

  ABALONE_DIRS.forEach((dir) => {
    const inline = selection.length === 1 || !lineDir || sameAbaloneDir(dir, lineDir) || sameAbaloneDir(dir, oppositeAbaloneDir(lineDir));
    if (inline) {
      const ordered = sortAbaloneSelection(selection, dir);
      const front = ordered[ordered.length - 1];
      const next = abaloneNext(front, dir);
      if (next === undefined) return;
      const target = state.board[next];
      if (!target) {
        moves.push({ selected: selection.slice(), dir: dir.join(','), targets: [next], inline: true });
        return;
      }
      if (target !== opponent) return;
      const chain = [];
      let cursor = next;
      while (cursor !== undefined && state.board[cursor] === opponent) {
        chain.push(cursor);
        cursor = abaloneNext(cursor, dir);
      }
      if (!chain.length || chain.length >= selection.length || (cursor !== undefined && state.board[cursor])) return;
      moves.push({ selected: selection.slice(), dir: dir.join(','), targets: chain.concat(cursor !== undefined ? [cursor] : []), inline: true });
      return;
    }

    const dests = selection.map((index) => abaloneNext(index, dir));
    if (dests.some((dest) => dest === undefined || state.board[dest])) return;
    moves.push({ selected: selection.slice(), dir: dir.join(','), targets: dests, inline: false });
  });

  return moves;
}

function applyAbaloneMove(room, mark, move) {
  const state = room.state;
  const resolved = abaloneResolveMove(state, mark, move);
  if (!resolved) return { error: 'Geçersiz seçim veya yön.' };
  const { selection, lineDir, dir } = resolved;
  const opponent = mark === 'X' ? 'O' : 'X';
  const inline = selection.length === 1 || !lineDir || sameAbaloneDir(dir, lineDir) || sameAbaloneDir(dir, oppositeAbaloneDir(lineDir));

  if (inline) {
    const ordered = sortAbaloneSelection(selection, dir);
    const front = ordered[ordered.length - 1];
    const next = abaloneNext(front, dir);
    if (next === undefined) return { error: 'Tahtanin disina cikamazsin.' };
    if (!state.board[next]) {
      for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const current = ordered[i];
        const dest = abaloneNext(current, dir);
        state.board[dest] = state.board[current];
        state.board[current] = null;
      }
    } else {
      if (state.board[next] !== opponent) return { error: 'Kendi bilyeni itemezsin.' };
      const chain = [];
      let cursor = next;
      while (cursor !== undefined && state.board[cursor] === opponent) {
        chain.push(cursor);
        cursor = abaloneNext(cursor, dir);
      }
      if (!chain.length || chain.length >= selection.length) return { error: 'Daha guclu bir itis gerekiyor.' };
      if (cursor !== undefined && state.board[cursor]) return { error: 'Rakibin arkasi dolu.' };

      if (cursor === undefined) {
        state.board[chain[chain.length - 1]] = null;
        state.pushed[mark] += 1;
        if (state.pushed[mark] >= 6) {
          room.status = 'finished';
          state.winner = mark;
        }
      } else {
        for (let i = chain.length - 1; i >= 0; i -= 1) {
          const current = chain[i];
          const dest = i === chain.length - 1 ? cursor : chain[i + 1];
          state.board[dest] = state.board[current];
          state.board[current] = null;
        }
      }

      for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const current = ordered[i];
        const dest = abaloneNext(current, dir);
        state.board[dest] = state.board[current];
        state.board[current] = null;
      }
    }
  } else {
    const dests = selection.map((index) => abaloneNext(index, dir));
    if (dests.some((dest) => dest === undefined || state.board[dest])) return { error: 'Yatay kaydirma icin hedefler bos olmali.' };
    selection.forEach((index) => { state.board[index] = null; });
    dests.forEach((dest) => { state.board[dest] = mark; });
  }
  if (room.status !== 'finished') state.turn = nextMark(room, mark);
  return {};
}

function corridorWallKey(type, row, col) {
  return `${type}-${row}-${col}`;
}

function corridorBlocksEdge(state, from, to) {
  const placed = new Set(state.placedWalls || []);
  const fr = Math.floor(from / 9);
  const fc = from % 9;
  const tr = Math.floor(to / 9);
  const tc = to % 9;
  if (fc === tc && Math.abs(fr - tr) === 1) {
    const row = Math.min(fr, tr);
    return placed.has(corridorWallKey('h', row, fc)) || (fc > 0 && placed.has(corridorWallKey('h', row, fc - 1)));
  }
  if (fr === tr && Math.abs(fc - tc) === 1) {
    const col = Math.min(fc, tc);
    return placed.has(corridorWallKey('v', fr, col)) || (fr > 0 && placed.has(corridorWallKey('v', fr - 1, col)));
  }
  return false;
}

function corridorBlocked(state, from, to) {
  return corridorBlocksEdge(state, from, to);
}

function corridorHasPath(state, mark) {
  const start = state.pawns[mark];
  const goalRow = mark === 'X' ? 0 : 8;
  const queue = [start];
  const seen = new Set([start]);
  while (queue.length) {
    const pos = queue.shift();
    const row = Math.floor(pos / 9);
    const col = pos % 9;
    if (row === goalRow) return true;
    [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].forEach(([r, c]) => {
      if (r < 0 || r > 8 || c < 0 || c > 8) return;
      const next = r * 9 + c;
      if (seen.has(next)) return;
      if (corridorBlocked(state, pos, next)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return false;
}

function corridorWallConflicts(state, type, row, col) {
  const placed = new Set(state.placedWalls || []);
  const key = corridorWallKey(type, row, col);
  if (placed.has(key)) return 'Bu duvar zaten var.';
  if (type === 'h' && placed.has(corridorWallKey('v', row, col))) return 'Duvarlar burada capraz kesişemez.';
  if (type === 'v' && placed.has(corridorWallKey('h', row, col))) return 'Duvarlar burada capraz kesişemez.';
  return null;
}

function applyCorridorMove(room, mark, move) {
  const state = room.state;
  if (move.wall) {
    const row = Number(move.row);
    const col = Number(move.col);
    const type = move.wall === 'v' ? 'v' : 'h';
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) return { error: 'Geçersiz duvar.' };
    if (state.walls[mark] <= 0) return { error: 'Duvarın kalmadı.' };
    const conflict = corridorWallConflicts(state, type, row, col);
    if (conflict) return { error: conflict };
    const key = corridorWallKey(type, row, col);
    state.placedWalls.push(key);
    if (!corridorHasPath(state, 'X') || !corridorHasPath(state, 'O')) {
      state.placedWalls.pop();
      return { error: 'Bu duvar bir oyuncunun yolunu tamamen kapatiyor.' };
    }
    state.walls[mark] -= 1;
    state.turn = nextMark(room, mark);
    return {};
  }
  const to = Number(move.to);
  const from = state.pawns[mark];
  if (!Number.isInteger(to) || to < 0 || to >= 81) return { error: 'Geçersiz kare.' };
  const fr = Math.floor(from / 9);
  const fc = from % 9;
  const tr = Math.floor(to / 9);
  const tc = to % 9;
  if (Math.abs(fr - tr) + Math.abs(fc - tc) !== 1) return { error: 'Piyon bir kare gider.' };
  if (Object.values(state.pawns).includes(to)) return { error: 'Bu kare dolu.' };
  if (corridorBlocked(state, from, to)) return { error: 'Duvar yolu kapatıyor.' };
  state.pawns[mark] = to;
  if ((mark === 'X' && tr === 0) || (mark === 'O' && tr === 8)) {
    room.status = 'finished';
    state.winner = mark;
  } else {
    state.turn = nextMark(room, mark);
  }
  return {};
}

function applyChessMove(room, mark, move) {
  const state = room.state;
  const from = Number(move.from);
  const to = Number(move.to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 64 || to < 0 || to >= 64) return { error: 'Geçersiz kare.' };
  const piece = state.board[from];
  const target = state.board[to];
  if (!piece || piece[0] !== mark) return { error: 'Kendi taşını seçmelisin.' };
  if (target && target[0] === mark) return { error: 'Kendi taşını alamazsın.' };
  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(to);
  const dr = tr - fr;
  const dc = tc - fc;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  const kind = piece[1];
  const forward = mark === 'X' ? -1 : 1;
  const startRow = mark === 'X' ? 6 : 1;
  let valid = false;
  if (kind === 'P') {
    valid = (!target && dc === 0 && dr === forward)
      || (!target && dc === 0 && fr === startRow && dr === forward * 2 && !state.board[rcToIndex(fr + forward, fc)])
      || (target && absC === 1 && dr === forward);
  }
  if (kind === 'N') valid = (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
  if (kind === 'B') valid = absR === absC;
  if (kind === 'R') valid = (absR === 0 || absC === 0);
  if (kind === 'Q') valid = (absR === absC) || absR === 0 || absC === 0;
  if (kind === 'K') valid = absR <= 1 && absC <= 1;
  if (!valid) return { error: 'Bu taş böyle gidemez.' };
  if (['B', 'R', 'Q'].includes(kind) && !chessPathClear(state.board, from, to)) return { error: 'Yol kapalı.' };
  if (target && target[1] === 'K') {
    room.status = 'finished';
    state.winner = mark;
  }
  state.board[to] = piece;
  state.board[from] = null;
  if (piece === 'XP' && tr === 0) state.board[to] = 'XQ';
  if (piece === 'OP' && tr === 7) state.board[to] = 'OQ';
  if (room.status !== 'finished') state.turn = nextMark(room, mark);
  return {};
}

function chessPathClear(board, from, to) {
  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(to);
  const stepR = Math.sign(tr - fr);
  const stepC = Math.sign(tc - fc);
  let row = fr + stepR;
  let col = fc + stepC;
  while (row !== tr || col !== tc) {
    if (board[rcToIndex(row, col)]) return false;
    row += stepR;
    col += stepC;
  }
  return true;
}

function applyLudoMove(room, mark, move) {
  const state = room.state;
  const piece = Number(move.piece);
  if (!Number.isInteger(piece) || piece < 0 || piece > 3) return { error: 'Geçersiz piyon.' };
  const roll = Math.floor(Math.random() * 6) + 1;
  state.lastRoll = { mark, roll, piece };
  const current = state.positions[mark][piece];
  const startByMark = { X: 0, O: 10, A: 20, B: 30 };
  const safeSquares = new Set([0, 10, 20, 30]);
  const targetPos = current < 0 ? (roll === 6 ? 0 : null) : current + roll;
  if (current >= 44) return { error: 'Bu piyon zaten bitişte.' };
  if (current < 0 && roll !== 6) {
    state.turn = nextMark(room, mark);
    return {};
  }
  if (targetPos === null || targetPos > 44) return { error: 'Tam sayı ile bitişe girmelisin.' };
  if (state.positions[mark].some((pos, idx) => idx !== piece && pos === targetPos && targetPos < 44)) {
    return { error: 'Kendi piyonunun olduğu kareye gidemezsin.' };
  }
  if (targetPos === 44) {
    state.positions[mark][piece] = 44;
    state.finished[mark] += 1;
  } else {
    if (targetPos < 40) {
      const globalTarget = (targetPos + startByMark[mark]) % 40;
      const capturable = [];
      let safeEnemy = false;
      Object.entries(state.positions).forEach(([other, pieces]) => {
        if (other === mark) return;
        const enemyStart = startByMark[other];
        pieces.forEach((pos, idx) => {
          if (pos < 0 || pos >= 40) return;
          const enemyGlobal = (pos + enemyStart) % 40;
          if (enemyGlobal === globalTarget) {
            if (safeSquares.has(globalTarget)) safeEnemy = true;
            else capturable.push([other, idx]);
          }
        });
      });
      if (safeEnemy) return { error: 'Güvenli karedeki rakibi yemezsin.' };
      capturable.forEach(([other, idx]) => { state.positions[other][idx] = -1; });
    }
    state.positions[mark][piece] = targetPos;
  }
  if (state.finished[mark] >= 4) {
    room.status = 'finished';
    state.winner = mark;
  } else if (roll !== 6) {
    state.turn = nextMark(room, mark);
  }
  return {};
}

function indexToRc(index) {
  return [Math.floor(index / 8), index % 8];
}

function rcToIndex(row, col) {
  return row * 8 + col;
}

function isKing(piece) {
  return piece === 'XK' || piece === 'OK';
}

function ownerOf(piece) {
  return piece && piece[0];
}

function applyCheckersMove(room, mark, move) {
  const state = room.state;
  const from = Number(move.from);
  const to = Number(move.to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 64 || to < 0 || to >= 64) {
    return { error: 'Geçersiz kare.' };
  }
  const piece = state.board[from];
  if (!piece || ownerOf(piece) !== mark) return { error: 'Kendi taşını seçmelisin.' };
  if (state.board[to]) return { error: 'Hedef kare dolu.' };
  const [fr, fc] = indexToRc(from);
  const [tr, tc] = indexToRc(to);
  const dr = tr - fr;
  const dc = tc - fc;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  const forward = mark === 'X' ? -1 : 1;
  const diagonal = room.type === 'capraz-dama';
  const validStep = diagonal
    ? absR === 1 && absC === 1 && (isKing(piece) || dr === forward)
    : ((absR === 1 && absC === 0) || (absR === 0 && absC === 1)) && (isKing(piece) || dr === forward || absR === 0);
  const validCapture = diagonal ? absR === 2 && absC === 2 : ((absR === 2 && absC === 0) || (absR === 0 && absC === 2));
  let captured = null;

  if (validCapture) {
    const mid = rcToIndex(fr + dr / 2, fc + dc / 2);
    const midPiece = state.board[mid];
    if (!midPiece || ownerOf(midPiece) === mark) return { error: 'Arada rakip taş yok.' };
    captured = mid;
  } else if (!validStep) {
    return { error: 'Geçersiz hamle.' };
  }

  state.board[to] = piece;
  state.board[from] = null;
  if (captured !== null) state.board[captured] = null;
  const [newRow] = indexToRc(to);
  if (mark === 'X' && newRow === 0 && piece === 'X') state.board[to] = 'XK';
  if (mark === 'O' && newRow === 7 && piece === 'O') state.board[to] = 'OK';
  if (!state.board.some((cell) => ownerOf(cell) === (mark === 'X' ? 'O' : 'X'))) {
    room.status = 'finished';
    state.winner = mark;
  } else {
    state.turn = nextMark(room, mark);
  }
  return {};
}

function applyMangalaMove(room, mark, move) {
  const state = room.state;
  const pit = Number(move.pit);
  if (!Number.isInteger(pit) || pit < 0 || pit > 5) return { error: 'Geçersiz kuyu.' };
  if (state.pits[mark][pit] <= 0) return { error: 'Boş kuyu seçilemez.' };
  const opponent = mark === 'X' ? 'O' : 'X';
  const ring = [
    ['X', 0], ['X', 1], ['X', 2], ['X', 3], ['X', 4], ['X', 5], ['XS', 0],
    ['O', 5], ['O', 4], ['O', 3], ['O', 2], ['O', 1], ['O', 0], ['OS', 0]
  ];
  let stones = state.pits[mark][pit];
  let pos = ring.findIndex(([side, idx]) => side === mark && idx === pit);
  state.pits[mark][pit] = 0;
  if (stones > 1) {
    state.pits[mark][pit] = 1;
    stones -= 1;
  }
  let last = null;
  while (stones > 0) {
    pos = (pos + 1) % ring.length;
    const [targetSide, targetIdx] = ring[pos];
    if (targetSide === `${opponent}S`) continue;

    if (targetSide === `${mark}S`) {
      state.stores[mark] += 1;
      last = [targetSide, targetIdx];
      stones -= 1;
      continue;
    }

    const castleOwner = castleOwnerForPit(state, targetSide, targetIdx);
    if (castleOwner) {
      state.stores[castleOwner] += 1;
    } else {
      state.pits[targetSide][targetIdx] += 1;
    }
    last = [targetSide, targetIdx];
    stones -= 1;
  }

  const extraTurn = Boolean(last && last[0] === `${mark}S`);

  if (!extraTurn && last && last[0] === opponent && state.pits[opponent][last[1]] > 0 && state.pits[opponent][last[1]] % 2 === 0) {
    state.stores[mark] += state.pits[opponent][last[1]];
    state.pits[opponent][last[1]] = 0;
  } else if (!extraTurn && last && last[0] === mark && state.pits[mark][last[1]] === 1) {
    const opposite = 5 - last[1];
    const captured = state.pits[opponent][opposite];
    if (captured > 0) {
      state.pits[opponent][opposite] = 0;
      state.pits[mark][last[1]] = 0;
      state.stores[mark] += captured + 1;
    }
  } else if (!extraTurn && last && last[0] === opponent && state.pits[opponent][last[1]] === 3 && state.castles[mark] === null) {
    state.castles[mark] = last[1];
    state.stores[mark] += state.pits[opponent][last[1]];
    state.pits[opponent][last[1]] = 0;
  }

  const xEmpty = state.pits.X.every((n) => n === 0);
  const oEmpty = state.pits.O.every((n) => n === 0);
  if (xEmpty || oEmpty) {
    if (xEmpty) state.stores.X += state.pits.O.reduce((a, b) => a + b, 0);
    if (oEmpty) state.stores.O += state.pits.X.reduce((a, b) => a + b, 0);
    state.pits.X = [0, 0, 0, 0, 0, 0];
    state.pits.O = [0, 0, 0, 0, 0, 0];
    room.status = 'finished';
    state.winner = state.stores.X === state.stores.O ? 'draw' : state.stores.X > state.stores.O ? 'X' : 'O';
  } else if (!extraTurn) {
    state.turn = nextMark(room, mark);
  }
  state.lastMove = { mark, pit, last, extraTurn };
  return {};
}
function castleOwnerForPit(state, side, pit) {
  const owner = Object.entries(state.castles || {}).find(([mark, castlePit]) => {
    const opponent = mark === 'X' ? 'O' : 'X';
    return castlePit === pit && side === opponent;
  });
  if (!owner) return null;
  const [mark] = owner;
  return mark;
}

const MORRIS_MILLS = [
  [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
  [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
];
const MORRIS_NEIGHBORS = {
  0:[1,9],1:[0,2,4],2:[1,14],3:[4,10],4:[1,3,5,7],5:[4,13],6:[7,11],7:[4,6,8],8:[7,12],
  9:[0,10,21],10:[3,9,11,18],11:[6,10,15],12:[8,13,17],13:[5,12,14,20],14:[2,13,23],
  15:[11,16],16:[15,17,19],17:[12,16],18:[10,19],19:[16,18,20,22],20:[13,19],
  21:[9,22],22:[19,21,23],23:[14,22]
};

function formsMill(board, index, mark) {
  return MORRIS_MILLS.some((mill) => mill.includes(index) && mill.every((pos) => board[pos] === mark));
}

function movableMorrisPieces(state, mark) {
  const count = state.board.filter((cell) => cell === mark).length;
  return state.board
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell, index }) => cell === mark && (count <= 3 || MORRIS_NEIGHBORS[index].some((to) => !state.board[to])));
}

function removeOpponentPiece(state, mark, removeIndex) {
  const opponent = mark === 'X' ? 'O' : 'X';
  if (!Number.isInteger(removeIndex) || state.board[removeIndex] !== opponent) return 'Rakip taşı seçmelisin.';
  const opponentPieces = state.board.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell === opponent);
  const nonMillPieces = opponentPieces.filter(({ index }) => !formsMill(state.board, index, opponent));
  if (nonMillPieces.length && formsMill(state.board, removeIndex, opponent)) {
    return 'Önce değirmen dışında kalan rakip taşlarından birini almalısın.';
  }
  state.board[removeIndex] = null;
  return '';
}

function applyMorrisMove(room, mark, move) {
  const state = room.state;
  const opponent = mark === 'X' ? 'O' : 'X';
  const to = Number(move.to);
  const from = move.from === undefined || move.from === null || move.from === '' ? null : Number(move.from);
  const remove = move.remove === undefined || move.remove === null || move.remove === '' ? null : Number(move.remove);

  if (!Number.isInteger(to) || to < 0 || to >= 24) return { error: 'Geçersiz nokta.' };

  if (state.phase === 'placing') {
    if (state.board[to]) return { error: 'Bu nokta dolu.' };
    state.board[to] = mark;
    state.placed[mark] += 1;
    if (formsMill(state.board, to, mark)) {
      const removeError = removeOpponentPiece(state, mark, remove);
      if (removeError) {
        state.board[to] = null;
        state.placed[mark] -= 1;
        return { error: `Değirmen yaptın. ${removeError}` };
      }
    }
    if (state.placed.X >= state.piecesPerPlayer && state.placed.O >= state.piecesPerPlayer) state.phase = 'moving';
    state.turn = nextMark(room, mark);
  } else {
    if (!Number.isInteger(from) || state.board[from] !== mark) return { error: 'Kendi taşını seçmelisin.' };
    if (state.board[to]) return { error: 'Gideceğin nokta dolu.' };
    const ownCount = state.board.filter((cell) => cell === mark).length;
    if (ownCount > 3 && !MORRIS_NEIGHBORS[from].includes(to)) return { error: 'Bu taş sadece komşu noktaya gidebilir.' };
    state.board[from] = null;
    state.board[to] = mark;
    if (formsMill(state.board, to, mark)) {
      const removeError = removeOpponentPiece(state, mark, remove);
      if (removeError) {
        state.board[to] = null;
        state.board[from] = mark;
        return { error: `Değirmen yaptın. ${removeError}` };
      }
    }
    if (state.board.filter((cell) => cell === opponent).length < 3 || !movableMorrisPieces(state, opponent).length) {
      room.status = 'finished';
      state.winner = mark;
    } else {
      state.turn = nextMark(room, mark);
    }
  }
  return {};
}

function closeBoxes(state, line, mark) {
  const [dir, rowText, colText] = line.split('-');
  const row = Number(rowText);
  const col = Number(colText);
  const candidates = [];
  if (dir === 'h') {
    candidates.push([row - 1, col], [row, col]);
  } else {
    candidates.push([row, col - 1], [row, col]);
  }
  let gained = 0;
  candidates.forEach(([r, c]) => {
    if (r < 0 || c < 0 || r >= state.size - 1 || c >= state.size - 1) return;
    const key = `${r}-${c}`;
    if (state.boxes[key]) return;
    const needed = [`h-${r}-${c}`, `h-${r + 1}-${c}`, `v-${r}-${c}`, `v-${r}-${c + 1}`];
    if (needed.every((item) => state.lines[item])) {
      state.boxes[key] = mark;
      gained += 1;
    }
  });
  return gained;
}

function testMove(room, mark, move) {
  const copy = {
    ...room,
    players: cloneValue(room.players),
    lastSeen: cloneValue(room.lastSeen),
    state: cloneValue(room.state)
  };
  return !applyMove(copy, mark, cloneValue(move || {})).error;
}

function simulateMove(room, mark, move) {
  const copy = {
    ...room,
    players: cloneValue(room.players),
    lastSeen: cloneValue(room.lastSeen),
    state: cloneValue(room.state)
  };
  const result = applyMove(copy, mark, cloneValue(move || {}));
  return result.error ? null : copy;
}

function firstRemovableMorris(state, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const pieces = state.board.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell === opponent);
  const nonMill = pieces.find(({ index }) => !formsMill(state.board, index, opponent));
  return nonMill ? nonMill.index : pieces[0] ? pieces[0].index : null;
}

function xoxWinningMoves(board, mark) {
  return XOX_LINES
    .map((line) => {
      const marks = line.map((index) => board[index]);
      const ownCount = marks.filter((cell) => cell === mark).length;
      const empties = line.filter((index) => !board[index]);
      return ownCount === 2 && empties.length === 1 ? empties[0] : null;
    })
    .filter((index) => index !== null);
}

function xoxForkCount(board, mark) {
  const wins = xoxWinningMoves(board, mark);
  return new Set(wins).size;
}

function chooseXoxBotMove(room, mark, legal) {
  const board = room.state.board.slice();
  const opponent = mark === 'X' ? 'O' : 'X';

  const win = legal.find((move) => xoxWinner(stateAfterXox(board, move.index, mark)) === mark);
  if (win) return win;

  const blockIndex = xoxWinningMoves(board, opponent)[0];
  if (blockIndex !== undefined) {
    const block = legal.find((move) => move.index === blockIndex);
    if (block) return block;
  }

  const ownFork = legal.find((move) => xoxForkCount(stateAfterXox(board, move.index, mark), mark) >= 2);
  if (ownFork) return ownFork;

  const opponentForkMoves = legal.filter((move) => xoxForkCount(stateAfterXox(board, move.index, opponent), opponent) >= 2);
  if (opponentForkMoves.length) {
    const defensive = legal.find((move) => {
      const nextBoard = stateAfterXox(board, move.index, mark);
      return legal
        .filter((candidate) => candidate.index !== move.index && !nextBoard[candidate.index])
        .every((candidate) => xoxForkCount(stateAfterXox(nextBoard, candidate.index, opponent), opponent) < 2);
    });
    if (defensive) return defensive;
  }

  if (!board[4]) return { index: 4 };

  const corners = [0, 2, 6, 8];
  const oppositeCorners = [[0, 8], [2, 6], [6, 2], [8, 0]];
  const opposite = oppositeCorners.find(([corner, reply]) => board[corner] === opponent && !board[reply]);
  if (opposite) return { index: opposite[1] };

  const emptyCorner = corners.find((index) => !board[index]);
  if (emptyCorner !== undefined) return { index: emptyCorner };

  const side = [1, 3, 5, 7].find((index) => !board[index]);
  if (side !== undefined) return { index: side };

  return legal[Math.floor(Math.random() * legal.length)];
}

function evaluateGoState(state, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const seen = new Set();
  let ownStones = 0;
  let oppStones = 0;
  let ownGroups = 0;
  let oppGroups = 0;
  let ownLiberties = 0;
  let oppLiberties = 0;
  let centerBias = 0;
  const mid = (state.size - 1) / 2;

  state.board.forEach((cell, index) => {
    if (!cell) return;
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const centerScore = state.size - (Math.abs(row - mid) + Math.abs(col - mid));
    if (cell === mark) {
      ownStones += 1;
      centerBias += centerScore;
    } else if (cell === opponent) {
      oppStones += 1;
      centerBias -= centerScore;
    }
    if (seen.has(index)) return;
    const group = goGroup(state.board, state.size, index);
    group.stones.forEach((stone) => seen.add(stone));
    if (cell === mark) {
      ownGroups += 1;
      ownLiberties += group.liberties;
    } else {
      oppGroups += 1;
      oppLiberties += group.liberties;
    }
  });

  return (
    ((ownStones - oppStones) * 18)
    + ((state.captures[mark] - state.captures[opponent]) * 24)
    + ((ownLiberties - oppLiberties) * 3)
    - ((ownGroups - oppGroups) * 5)
    + (centerBias * 0.7)
  );
}

function chooseGoBotMove(room, mark, legal) {
  const playable = legal.filter((move) => !move.pass);
  if (!playable.length) return { pass: true };
  const opponent = mark === 'X' ? 'O' : 'X';
  const beforeScore = evaluateGoState(room.state, mark);
  const ordered = playable.map((move) => {
    const nextRoom = simulateMove(room, mark, move);
    if (!nextRoom) return null;
    const afterScore = evaluateGoState(nextRoom.state, mark);
    const group = goGroup(nextRoom.state.board, nextRoom.state.size, Number(move.index));
    const beforeCaptures = room.state.captures[mark];
    const afterCaptures = nextRoom.state.captures[mark];
    const row = Math.floor(Number(move.index) / room.state.size);
    const col = Number(move.index) % room.state.size;
    const edgeDistance = Math.min(row, col, room.state.size - 1 - row, room.state.size - 1 - col);
    const base = (
      (afterScore - beforeScore)
      + ((afterCaptures - beforeCaptures) * 60)
      + (group.liberties * 8)
      + (edgeDistance * 3)
      - (group.liberties <= 1 ? 90 : 0)
    );
    return { move, nextRoom, score: base };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const candidates = ordered.slice(0, Math.min(10, ordered.length));
  const scored = candidates.map(({ move, nextRoom, score }) => {
    const replies = legalBotMoves(nextRoom, opponent).filter((reply) => !reply.pass);
    let replyPenalty = 0;
    if (replies.length) {
      let bestReply = -Infinity;
      replies.slice(0, 12).forEach((reply) => {
        const replyRoom = simulateMove(nextRoom, opponent, reply);
        if (!replyRoom) return;
        const replyScore = evaluateGoState(replyRoom.state, mark);
        if (replyScore > bestReply) bestReply = replyScore;
      });
      if (bestReply !== -Infinity) replyPenalty = bestReply - evaluateGoState(nextRoom.state, mark);
    }
    return { move, score: score - (replyPenalty * 0.8) };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.move || playable[0];
}

const CHESS_PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

function evaluateChessBoard(board, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  let score = 0;
  board.forEach((piece, index) => {
    if (!piece) return;
    const owner = piece[0];
    const kind = piece[1];
    const [row, col] = indexToRc(index);
    const center = 3.5 - (Math.abs(row - 3.5) + Math.abs(col - 3.5)) / 2;
    const advance = owner === 'X' ? 7 - row : row;
    const pieceScore = CHESS_PIECE_VALUES[kind] + (center * 8) + (kind === 'P' ? advance * 6 : 0);
    score += owner === mark ? pieceScore : -pieceScore;
  });

  const ownMoves = pseudoChessMobility(board, mark);
  const oppMoves = pseudoChessMobility(board, opponent);
  return score + ((ownMoves - oppMoves) * 3);
}

function pseudoChessMobility(board, mark) {
  let moves = 0;
  board.forEach((piece, from) => {
    if (!piece || piece[0] !== mark) return;
    const kind = piece[1];
    const [fr, fc] = indexToRc(from);
    const addStep = (row, col) => {
      if (row < 0 || row > 7 || col < 0 || col > 7) return false;
      const target = board[rcToIndex(row, col)];
      if (target && target[0] === mark) return false;
      moves += 1;
      return !target;
    };
    if (kind === 'P') {
      const forward = mark === 'X' ? -1 : 1;
      addStep(fr + forward, fc);
      if (fc > 0) addStep(fr + forward, fc - 1);
      if (fc < 7) addStep(fr + forward, fc + 1);
      return;
    }
    if (kind === 'N') {
      [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]].forEach(([dr, dc]) => addStep(fr + dr, fc + dc));
      return;
    }
    if (kind === 'K') {
      [-1, 0, 1].forEach((dr) => [-1, 0, 1].forEach((dc) => { if (dr || dc) addStep(fr + dr, fc + dc); }));
      return;
    }
    const dirs = [];
    if (kind === 'B' || kind === 'Q') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    if (kind === 'R' || kind === 'Q') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    dirs.forEach(([dr, dc]) => {
      let row = fr + dr;
      let col = fc + dc;
      while (addStep(row, col)) {
        row += dr;
        col += dc;
      }
    });
  });
  return moves;
}

function chooseChessBotMove(room, mark, legal) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const base = evaluateChessBoard(room.state.board, mark);
  const preliminary = legal.map((move) => {
    const nextRoom = simulateMove(room, mark, move);
    if (!nextRoom) return null;
    if (nextRoom.status === 'finished' && nextRoom.state.winner === mark) return { move, nextRoom, score: 1e9 };
    const target = room.state.board[Number(move.to)];
    const promotion = room.state.board[Number(move.from)]?.[1] === 'P' && (Math.floor(Number(move.to) / 8) === (mark === 'X' ? 0 : 7));
    const score = (
      (evaluateChessBoard(nextRoom.state.board, mark) - base)
      + (target ? CHESS_PIECE_VALUES[target[1]] * 1.1 : 0)
      + (promotion ? 500 : 0)
    );
    return { move, nextRoom, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const candidates = preliminary.slice(0, Math.min(14, preliminary.length));
  const evaluated = candidates.map(({ move, nextRoom, score }) => {
    const replies = legalBotMoves(nextRoom, opponent);
    if (!replies.length) return { move, score };
    let worst = Infinity;
    replies.slice(0, Math.min(18, replies.length)).forEach((reply) => {
      const replyRoom = simulateMove(nextRoom, opponent, reply);
      if (!replyRoom) return;
      let replyScore;
      if (replyRoom.status === 'finished' && replyRoom.state.winner === opponent) replyScore = -1e9;
      else replyScore = evaluateChessBoard(replyRoom.state.board, mark);
      if (replyScore < worst) worst = replyScore;
    });
    return { move, score: worst === Infinity ? score : (score * 0.4) + (worst * 0.6) };
  }).sort((a, b) => b.score - a.score);

  return evaluated[0]?.move || legal[Math.floor(Math.random() * legal.length)];
}

function chooseLudoBotMove(room, mark, legal) {
  const state = room.state;
  const startByMark = { X: 0, O: 10, A: 20, B: 30 };
  const safeSquares = new Set([0, 10, 20, 30]);
  const scored = legal.map((move) => {
    const current = state.positions[mark][move.piece];
    const nextRoom = simulateMove(room, mark, move);
    if (!nextRoom) return null;
    const next = nextRoom.state.positions[mark][move.piece];
    const globalTarget = next >= 0 && next < 40 ? (next + startByMark[mark]) % 40 : null;
    const beforeEnemyHome = Object.values(state.positions).flat().filter((pos) => pos < 0).length;
    const afterEnemyHome = Object.values(nextRoom.state.positions).flat().filter((pos) => pos < 0).length;
    const homeLaneGain = Math.max(0, Math.min(next, 43) - Math.max(current, 39));
    const score = (
      ((nextRoom.state.finished[mark] - state.finished[mark]) * 400)
      + ((afterEnemyHome - beforeEnemyHome) * 120)
      + (current < 0 && next === 0 ? 90 : 0)
      + (next > current ? next * 3 : 0)
      + (homeLaneGain * 28)
      + (globalTarget !== null && safeSquares.has(globalTarget) ? 24 : 0)
      + (next >= 40 && next < 44 ? 80 : 0)
      + (next === 44 ? 220 : 0)
      - (globalTarget !== null && !safeSquares.has(globalTarget) && next < 40 ? 12 : 0)
    );
    return { move, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return scored[0]?.move || legal[Math.floor(Math.random() * legal.length)];
}

function simulateSosPlacement(board, size, index, letter) {
  const nextBoard = board.slice();
  nextBoard[index] = letter;
  const row = Math.floor(index / size);
  const col = index % size;
  return {
    board: nextBoard,
    gained: countSosAt(nextBoard, size, row, col)
  };
}

function bestImmediateSosGain(board, size) {
  let best = 0;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index]) continue;
    for (const letter of ['S', 'O']) {
      const { gained } = simulateSosPlacement(board, size, index, letter);
      if (gained > best) best = gained;
    }
  }
  return best;
}

function sosCentrality(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const center = (size - 1) / 2;
  return -Math.abs(row - center) - Math.abs(col - center);
}

function chooseSosBotMove(room, mark, legal) {
  const { board, size } = room.state;
  const scored = legal.map((move) => {
    const simulated = simulateSosPlacement(board, size, move.index, move.letter);
    const ownNext = bestImmediateSosGain(simulated.board, size);
    const opponentNext = simulated.gained > 0 ? 0 : bestImmediateSosGain(simulated.board, size);
    const score =
      simulated.gained * 1000 +
      ownNext * 40 -
      opponentNext * 120 +
      (move.letter === 'S' ? 4 : 0) +
      sosCentrality(move.index, size);
    return { move, score, gained: simulated.gained, opponentNext };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.gained !== a.gained) return b.gained - a.gained;
    if (a.opponentNext !== b.opponentNext) return a.opponentNext - b.opponentNext;
    return 0;
  });
  return scored[0]?.move || legal[Math.floor(Math.random() * legal.length)];
}

function simulateRoomMove(room, mark, move) {
  const copy = {
    ...room,
    players: cloneValue(room.players),
    lastSeen: cloneValue(room.lastSeen),
    state: cloneValue(room.state)
  };
  const result = applyMove(copy, mark, cloneValue(move));
  return result.error ? null : copy;
}

function firstEmptyMillPoint(board, mark) {
  for (const mill of MORRIS_MILLS) {
    const ownCount = mill.filter((index) => board[index] === mark).length;
    const empties = mill.filter((index) => !board[index]);
    if (ownCount === 2 && empties.length === 1) return empties[0];
  }
  return null;
}

function countMorrisThreats(board, mark) {
  let total = 0;
  for (const mill of MORRIS_MILLS) {
    const ownCount = mill.filter((index) => board[index] === mark).length;
    const empties = mill.filter((index) => !board[index]).length;
    if (ownCount === 2 && empties === 1) total += 1;
  }
  return total;
}

function morrisRemovableTargets(board, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const pieces = board.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell === opponent);
  const nonMill = pieces.filter(({ index }) => !formsMill(board, index, opponent));
  return (nonMill.length ? nonMill : pieces).map(({ index }) => index);
}

function morrisBlockedPieces(board, mark) {
  const count = board.filter((cell) => cell === mark).length;
  if (count <= 3) return 0;
  return board.reduce((total, cell, index) => {
    if (cell !== mark) return total;
    const canMove = MORRIS_NEIGHBORS[index].some((to) => !board[to]);
    return total + (canMove ? 0 : 1);
  }, 0);
}

function chooseMorrisBotMove(room, mark, legal) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const beforeBoard = room.state.board;
  const ownBeforeThreats = countMorrisThreats(beforeBoard, mark);
  const oppBeforeThreats = countMorrisThreats(beforeBoard, opponent);

  const scored = legal.map((move) => {
    const simulated = simulateRoomMove(room, mark, move);
    if (!simulated) return null;
    const afterBoard = simulated.state.board;
    const beforeOppCount = beforeBoard.filter((cell) => cell === opponent).length;
    const afterOppCount = afterBoard.filter((cell) => cell === opponent).length;
    const capture = beforeOppCount - afterOppCount;
    const formedMill = capture > 0;
    const ownThreats = countMorrisThreats(afterBoard, mark);
    const oppThreats = countMorrisThreats(afterBoard, opponent);
    const blockedOpponent = morrisBlockedPieces(afterBoard, opponent);
    const blockedSelf = morrisBlockedPieces(afterBoard, mark);
    const winsNow = simulated.status === 'finished' && simulated.state.winner === mark;
    const blockedThreat = oppBeforeThreats > 0 && oppThreats < oppBeforeThreats;
    const targetCritical = room.state.phase === 'placing' ? firstEmptyMillPoint(beforeBoard, opponent) : null;
    const centrality = room.state.phase === 'placing' ? [4, 10, 13, 19].includes(move.to) ? 8 : [1,7,16,22].includes(move.to) ? 4 : 0 : 0;
    const mobility = movableMorrisPieces(simulated.state, mark).length;
    const score =
      (winsNow ? 100000 : 0) +
      capture * 800 +
      (formedMill ? 450 : 0) +
      (blockedThreat ? 260 : 0) +
      (ownThreats - ownBeforeThreats) * 120 +
      (oppBeforeThreats - oppThreats) * 140 +
      blockedOpponent * 55 -
      blockedSelf * 35 +
      mobility * 8 +
      centrality +
      (targetCritical !== null && move.to === targetCritical ? 90 : 0);
    return { move, score, capture, formedMill, blockedThreat, ownThreats, oppThreats };
  }).filter(Boolean);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.capture !== a.capture) return b.capture - a.capture;
    if (Number(b.formedMill) !== Number(a.formedMill)) return Number(b.formedMill) - Number(a.formedMill);
    if (Number(b.blockedThreat) !== Number(a.blockedThreat)) return Number(b.blockedThreat) - Number(a.blockedThreat);
    return 0;
  });

  return scored[0]?.move || legal[Math.floor(Math.random() * legal.length)];
}

function dotsBoxLines(state, row, col) {
  return [`h-${row}-${col}`, `h-${row + 1}-${col}`, `v-${row}-${col}`, `v-${row}-${col + 1}`];
}

function dotsCandidateBoxes(state, line) {
  const [dir, rowText, colText] = String(line).split('-');
  const row = Number(rowText);
  const col = Number(colText);
  const boxes = [];
  if (dir === 'h') boxes.push([row - 1, col], [row, col]);
  else boxes.push([row, col - 1], [row, col]);
  const { rows, cols } = dotsDimensions(state);
  return boxes.filter(([r, c]) => r >= 0 && c >= 0 && r < rows && c < cols);
}

function dotsBoxEdgeCount(state, row, col) {
  return dotsBoxLines(state, row, col).reduce((total, item) => total + (state.lines[item] ? 1 : 0), 0);
}

function dotsThreeEdgeBoxesAfterMove(state, line) {
  return dotsCandidateBoxes(state, line).reduce((count, [row, col]) => {
    const key = `${row}-${col}`;
    if (state.boxes[key]) return count;
    const before = dotsBoxEdgeCount(state, row, col);
    const after = before + (state.lines[line] ? 0 : 1);
    return count + (before < 3 && after === 3 ? 1 : 0);
  }, 0);
}

function dotsChainPressure(state) {
  const { rows, cols } = dotsDimensions(state);
  let total = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${row}-${col}`;
      if (state.boxes[key]) continue;
      const edges = dotsBoxEdgeCount(state, row, col);
      if (edges === 3) total += 1;
      else if (edges === 2) total += 0.35;
    }
  }
  return total;
}

function chooseDotsBotMove(room, mark, legal) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const beforeOwn = room.state.scores[mark];
  const beforeOpp = room.state.scores[opponent];

  const scored = legal.map((move) => {
    const simulated = simulateRoomMove(room, mark, move);
    if (!simulated) return null;
    const ownGain = simulated.state.scores[mark] - beforeOwn;
    const oppGain = simulated.state.scores[opponent] - beforeOpp;
    const keepsTurn = simulated.state.turn === mark && simulated.status !== 'finished';
    const createdThrees = dotsThreeEdgeBoxesAfterMove(room.state, move.line);
    const beforePressure = dotsChainPressure(room.state);
    const afterPressure = dotsChainPressure(simulated.state);
    const pressureDelta = afterPressure - beforePressure;
    const winsNow = simulated.status === 'finished' && simulated.state.winner === mark;
    const score =
      (winsNow ? 100000 : 0) +
      ownGain * 2500 +
      (keepsTurn ? 500 : 0) -
      oppGain * 1800 -
      createdThrees * 260 -
      pressureDelta * 140;
    return { move, score, ownGain, keepsTurn, createdThrees, pressureDelta };
  }).filter(Boolean);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.ownGain !== a.ownGain) return b.ownGain - a.ownGain;
    if (Number(b.keepsTurn) !== Number(a.keepsTurn)) return Number(b.keepsTurn) - Number(a.keepsTurn);
    if (a.createdThrees !== b.createdThrees) return a.createdThrees - b.createdThrees;
    return a.pressureDelta - b.pressureDelta;
  });

  return scored[0]?.move || legal[Math.floor(Math.random() * legal.length)];
}

function checkersPieceCounts(board, mark) {
  return board.reduce((total, piece) => {
    if (!piece || ownerOf(piece) !== mark) return total;
    return total + 1;
  }, 0);
}

function listCheckersLegalMoves(room, mark) {
  const moves = [];
  room.state.board.forEach((piece, from) => {
    if (!piece || ownerOf(piece) !== mark) return;
    for (let to = 0; to < 64; to += 1) {
      const move = { from, to };
      if (testMove(room, mark, move)) moves.push(move);
    }
  });
  return moves;
}

function chooseCheckersBotMove(room, mark, legal) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const beforeBoard = room.state.board;
  const beforeOwn = checkersPieceCounts(beforeBoard, mark);
  const beforeOpp = checkersPieceCounts(beforeBoard, opponent);

  const scored = legal.map((move) => {
    const simulated = simulateRoomMove(room, mark, move);
    if (!simulated) return null;
    const afterBoard = simulated.state.board;
    const ownAfter = checkersPieceCounts(afterBoard, mark);
    const oppAfter = checkersPieceCounts(afterBoard, opponent);
    const capture = beforeOpp - oppAfter;
    const selfLoss = beforeOwn - ownAfter;
    const pieceBefore = beforeBoard[move.from];
    const pieceAfter = afterBoard[move.to];
    const becameKing = !isKing(pieceBefore) && isKing(pieceAfter);
    const winsNow = simulated.status === 'finished' && simulated.state.winner === mark;

    const opponentMoves = listCheckersLegalMoves(simulated, opponent);
    let threatenedSquares = 0;
    let recaptureRisk = 0;
    opponentMoves.forEach((reply) => {
      const replyState = simulateRoomMove(simulated, opponent, reply);
      if (!replyState) return;
      const replyOwnAfter = checkersPieceCounts(replyState.state.board, mark);
      if (replyOwnAfter < ownAfter) {
        threatenedSquares += 1;
        if (!replyState.state.board[move.to] || ownerOf(replyState.state.board[move.to]) !== mark) recaptureRisk += 1;
      }
    });

    const ownMovesNext = listCheckersLegalMoves(simulated, mark).length;
    const oppMovesNext = opponentMoves.length;
    const advance = (() => {
      const [fr] = indexToRc(move.from);
      const [tr] = indexToRc(move.to);
      return mark === 'X' ? fr - tr : tr - fr;
    })();

    const score =
      (winsNow ? 100000 : 0) +
      capture * 1800 -
      selfLoss * 1200 +
      (becameKing ? 700 : 0) -
      recaptureRisk * 420 -
      threatenedSquares * 80 +
      ownMovesNext * 10 -
      oppMovesNext * 8 +
      advance * (isKing(pieceBefore) ? 4 : 18);

    return { move, score, capture, becameKing, recaptureRisk, threatenedSquares };
  }).filter(Boolean);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.capture !== a.capture) return b.capture - a.capture;
    if (Number(b.becameKing) !== Number(a.becameKing)) return Number(b.becameKing) - Number(a.becameKing);
    if (a.recaptureRisk !== b.recaptureRisk) return a.recaptureRisk - b.recaptureRisk;
    return a.threatenedSquares - b.threatenedSquares;
  });

  return scored[0]?.move || legal[Math.floor(Math.random() * legal.length)];
}

function abaloneSelectionKeys(state, mark) {
  const keys = new Map();
  state.board.forEach((cell, index) => {
    if (cell !== mark) return;
    keys.set(String(index), [index]);
    ABALONE_DIRS.forEach((dir) => {
      let current = index;
      const selection = [index];
      for (let len = 2; len <= 3; len += 1) {
        current = abaloneNext(current, dir);
        if (current === undefined || state.board[current] !== mark) break;
        selection.push(current);
        const info = abaloneSelectionInfo(state, mark, selection);
        if (info) keys.set(info.selection.slice().sort((a, b) => a - b).join(','), info.selection.slice());
      }
    });
  });
  return Array.from(keys.values());
}

function abaloneCenterScore(board, mark) {
  return board.reduce((total, cell, index) => {
    if (cell !== mark) return total;
    const [q, r] = ABALONE_COORDS[index];
    return total - (Math.abs(q) + Math.abs(r) + Math.abs(-q - r));
  }, 0);
}

function chooseAbaloneBotMove(room, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const beforePush = room.state.pushed[mark];
  const beforeOppPush = room.state.pushed[opponent];
  const beforeCenter = abaloneCenterScore(room.state.board, mark);
  const candidates = [];

  abaloneSelectionKeys(room.state, mark).forEach((selection) => {
    abaloneLegalMovesForSelection(room.state, mark, selection).forEach((move) => {
      const simulated = simulateRoomMove(room, mark, move);
      if (!simulated) return;
      const pushGain = simulated.state.pushed[mark] - beforePush;
      const oppGain = simulated.state.pushed[opponent] - beforeOppPush;
      const centerDelta = abaloneCenterScore(simulated.state.board, mark) - beforeCenter;
      const ownCount = simulated.state.board.filter((cell) => cell === mark).length;
      const oppCount = simulated.state.board.filter((cell) => cell === opponent).length;
      const oppReply = chooseAbaloneBotMoveShallow(simulated, opponent);
      const score =
        (simulated.status === 'finished' && simulated.state.winner === mark ? 100000 : 0) +
        pushGain * 4000 -
        oppGain * 2500 +
        (room.state.board.filter((cell) => cell === opponent).length - oppCount) * 1500 +
        (ownCount - room.state.board.filter((cell) => cell === mark).length) * -1800 +
        centerDelta * 14 +
        selection.length * 18 -
        oppReply * 0.55;
      candidates.push({ move, score, pushGain, centerDelta, selectionSize: selection.length, oppReply });
    });
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.pushGain !== a.pushGain) return b.pushGain - a.pushGain;
    if (b.selectionSize !== a.selectionSize) return b.selectionSize - a.selectionSize;
    return b.centerDelta - a.centerDelta;
  });
  return candidates[0]?.move || null;
}

function chooseAbaloneBotMoveShallow(room, mark) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const beforePush = room.state.pushed[mark];
  const beforeCenter = abaloneCenterScore(room.state.board, mark);
  let best = -Infinity;
  abaloneSelectionKeys(room.state, mark).forEach((selection) => {
    abaloneLegalMovesForSelection(room.state, mark, selection).forEach((move) => {
      const simulated = simulateRoomMove(room, mark, move);
      if (!simulated) return;
      const pushGain = simulated.state.pushed[mark] - beforePush;
      const centerDelta = abaloneCenterScore(simulated.state.board, mark) - beforeCenter;
      const ownCount = simulated.state.board.filter((cell) => cell === mark).length;
      const oppCount = simulated.state.board.filter((cell) => cell === opponent).length;
      const score =
        (simulated.status === 'finished' && simulated.state.winner === mark ? 100000 : 0) +
        pushGain * 3200 +
        (room.state.board.filter((cell) => cell === opponent).length - oppCount) * 1200 +
        (ownCount - room.state.board.filter((cell) => cell === mark).length) * -1600 +
        centerDelta * 10 +
        selection.length * 12;
      if (score > best) best = score;
    });
  });
  return best === -Infinity ? 0 : best;
}

function corridorShortestPath(state, mark) {
  const start = state.pawns[mark];
  const goalRow = mark === 'X' ? 0 : 8;
  const queue = [{ pos: start, dist: 0 }];
  const seen = new Set([start]);
  while (queue.length) {
    const { pos, dist } = queue.shift();
    const row = Math.floor(pos / 9);
    const col = pos % 9;
    if (row === goalRow) return dist;
    [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].forEach(([r, c]) => {
      if (r < 0 || r > 8 || c < 0 || c > 8) return;
      const next = r * 9 + c;
      if (seen.has(next)) return;
      if (corridorBlocked(state, pos, next)) return;
      if (Object.values(state.pawns).includes(next) && next !== state.pawns[mark]) return;
      seen.add(next);
      queue.push({ pos: next, dist: dist + 1 });
    });
  }
  return 99;
}

function listCorridorWallMoves(state, mark) {
  if (state.walls[mark] <= 0) return [];
  const moves = [];
  for (let row = 0; row <= 7; row += 1) {
    for (let col = 0; col <= 7; col += 1) {
      moves.push({ wall: 'h', row, col });
      moves.push({ wall: 'v', row, col });
    }
  }
  return moves;
}

function chooseCorridorBotMove(room, mark, legal) {
  const opponent = mark === 'X' ? 'O' : 'X';
  const pawnMoves = legal.filter((move) => Object.prototype.hasOwnProperty.call(move, 'to'));
  const wallMoves = legal.filter((move) => Object.prototype.hasOwnProperty.call(move, 'wall'));

  const scoredPawn = pawnMoves.map((move) => {
    const simulated = simulateRoomMove(room, mark, move);
    if (!simulated) return null;
    const ownPath = corridorShortestPath(simulated.state, mark);
    const oppPath = corridorShortestPath(simulated.state, opponent);
    const row = Math.floor(simulated.state.pawns[mark] / 9);
    const progress = mark === 'X' ? 8 - row : row;
    const score = ((simulated.status === 'finished' && simulated.state.winner === mark) ? 100000 : 0) + oppPath * 26 - ownPath * 32 + progress * 20;
    return { move, score };
  }).filter(Boolean);

  const scoredWall = wallMoves.map((move) => {
    const simulated = simulateRoomMove(room, mark, move);
    if (!simulated) return null;
    const ownBefore = corridorShortestPath(room.state, mark);
    const oppBefore = corridorShortestPath(room.state, opponent);
    const ownAfter = corridorShortestPath(simulated.state, mark);
    const oppAfter = corridorShortestPath(simulated.state, opponent);
    const score = (oppAfter - oppBefore) * 180 - (ownAfter - ownBefore) * 120 - (10 - room.state.walls[mark]) * 6;
    return { move, score };
  }).filter(Boolean);

  const bestPawn = scoredPawn.sort((a, b) => b.score - a.score)[0] || null;
  const bestWall = scoredWall.sort((a, b) => b.score - a.score)[0] || null;
  if (bestWall && bestWall.score > (bestPawn ? bestPawn.score + 24 : 40)) return bestWall.move;
  return bestPawn ? bestPawn.move : (bestWall ? bestWall.move : legal[Math.floor(Math.random() * legal.length)]);
}

function chooseAltiBotMove(room, mark, legal) {
  const opponent = mark === 'X' ? 'O' : 'X';
  for (const move of legal) {
    const nextRoom = simulateMove(room, mark, move);
    if (nextRoom && nextRoom.status === 'finished' && nextRoom.state.winner === mark) return move;
  }
  for (const move of legal) {
    const testRoom = {
      ...room,
      players: cloneValue(room.players),
      lastSeen: cloneValue(room.lastSeen),
      state: cloneValue(room.state)
    };
    testRoom.state.turn = opponent;
    const result = applyMove(testRoom, opponent, move);
    if (!result.error && testRoom.status === 'finished' && testRoom.state.winner === opponent) return move;
  }
  return legal
    .map((move) => {
      const nextRoom = simulateMove(room, mark, move);
      if (!nextRoom) return null;
      return { move, score: evaluateAltiState(nextRoom.state, mark) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0]?.move || legal[0];
}

function legalBotMoves(room, mark) {
  const state = room.state;
  const moves = [];
  if (room.type === 'alti') {
    state.board.forEach((cell, index) => { if (!cell) moves.push({ index }); });
  } else if (room.type === 'xox') {
    state.board.forEach((cell, index) => { if (!cell) moves.push({ index }); });
  } else if (room.type === 'sos') {
    state.board.forEach((cell, index) => {
      if (!cell) {
        moves.push({ index, letter: 'S' });
        moves.push({ index, letter: 'O' });
      }
    });
  } else if (room.type === 'kutu-doldurmaca') {
    const { rows, cols, dotRows, dotCols } = dotsDimensions(state);
    for (let r = 0; r < dotRows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const line = `h-${r}-${c}`;
        if (!state.lines[line]) moves.push({ line });
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < dotCols; c += 1) {
        const line = `v-${r}-${c}`;
        if (!state.lines[line]) moves.push({ line });
      }
    }
  } else if (room.type === 'yilanlar-ve-merdivenler') {
    moves.push({ roll: true });
  } else if (room.type === '9-tas' || room.type === '3-tas') {
    const remove = firstRemovableMorris(state, mark);
    if (state.phase === 'placing') {
      state.board.forEach((cell, to) => {
        if (!cell) moves.push({ to, remove });
      });
    } else {
      state.board.forEach((cell, from) => {
        if (cell !== mark) return;
        state.board.forEach((target, to) => {
          if (!target) moves.push({ from, to, remove });
        });
      });
    }
  } else if (room.type === 'mangala') {
    (state.pits[mark] || []).forEach((stones, pit) => { if (stones > 0) moves.push({ pit }); });
  } else if (room.type === 'abalone') {
    abaloneSelectionKeys(state, mark).forEach((selection) => {
      abaloneLegalMovesForSelection(state, mark, selection).forEach((move) => moves.push(move));
    });
  } else if (room.type === 'tavla') {
    if (!state.dice.length) moves.push({ roll: true });
    else moves.push({ pass: true });
    if (state.dice.length) {
      if ((state.bar?.[mark] || 0) > 0) {
        state.dice.forEach((die) => moves.push({ from: -1, die }));
      } else {
        state.points.forEach((point, from) => {
          if (point[mark] > 0) state.dice.forEach((die) => moves.push({ from, die }));
        });
      }
    }
  } else if (room.type === 'domino') {
    (state.hands[mark] || []).forEach((tile, index) => {
      moves.push({ index, side: 'left' });
      moves.push({ index, side: 'right' });
    });
    moves.push({ pass: true });
  } else if (room.type === 'go') {
    state.board.forEach((cell, index) => { if (!cell) moves.push({ index }); });
    moves.push({ pass: true });
  } else if (room.type === 'koridor') {
    const from = state.pawns[mark];
    const row = Math.floor(from / 9);
    const col = from % 9;
    [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].forEach(([r, c]) => {
      if (r >= 0 && r < 9 && c >= 0 && c < 9) moves.push({ to: r * 9 + c });
    });
    listCorridorWallMoves(state, mark).forEach((move) => moves.push(move));
  } else if (room.type === 'satranc') {
    state.board.forEach((piece, from) => {
      if (!piece || piece[0] !== mark) return;
      for (let to = 0; to < 64; to += 1) moves.push({ from, to });
    });
  } else if (room.type === 'dama' || room.type === 'capraz-dama') {
    state.board.forEach((piece, from) => {
      if (!piece || piece[0] !== mark) return;
      for (let to = 0; to < 64; to += 1) moves.push({ from, to });
    });
  } else if (room.type === 'kizma-birader') {
    for (let piece = 0; piece < 4; piece += 1) moves.push({ piece });
  }
  return moves.filter((move) => testMove(room, mark, move));
}

function chooseBotMove(room, mark) {
  const legal = legalBotMoves(room, mark);
  if (!legal.length) {
    if (room.type === 'go') return { pass: true };
    return null;
  }
  if (room.type === 'alti') {
    return chooseAltiBotMove(room, mark, legal);
  }
  if (room.type === 'xox') {
    return chooseXoxBotMove(room, mark, legal);
  }
  if (room.type === 'sos') {
    return chooseSosBotMove(room, mark, legal);
  }
  if (room.type === 'kutu-doldurmaca') {
    return chooseDotsBotMove(room, mark, legal);
  }
  if (room.type === 'abalone') {
    return chooseAbaloneBotMove(room, mark) || legal[Math.floor(Math.random() * legal.length)];
  }
  if (room.type === 'koridor') {
    return chooseCorridorBotMove(room, mark, legal);
  }
  if (room.type === 'dama' || room.type === 'capraz-dama') {
    return chooseCheckersBotMove(room, mark, legal);
  }
  if (room.type === '9-tas' || room.type === '3-tas') {
    return chooseMorrisBotMove(room, mark, legal);
  }
  if (room.type === 'tavla') {
    return chooseBackgammonBotMove(room, mark, legal);
  }
  if (room.type === 'go') {
    return chooseGoBotMove(room, mark, legal);
  }
  if (room.type === 'satranc') {
    return chooseChessBotMove(room, mark, legal);
  }
  if (room.type === 'kizma-birader') {
    return chooseLudoBotMove(room, mark, legal);
  }
  return legal[Math.floor(Math.random() * legal.length)];
}

function stateAfterXox(board, index, mark) {
  const next = board.slice();
  next[index] = mark;
  return next;
}

function runBotTurns(room) {
  let guard = 0;
  while (room.status === 'playing' && guard < 16) {
    const mark = room.state.turn;
    const player = room.players[mark];
    if (!isBotPlayer(player)) break;
    room.lastSeen[mark] = Date.now();
    const move = chooseBotMove(room, mark);
    if (!move) {
      room.finishReason = `${player.name} geçerli hamle bulamadı.`;
      room.state.turn = nextMark(room, mark);
      break;
    }
    const result = applyMove(room, mark, move);
    if (result.error) {
      room.finishReason = `${player.name} hamle yapamadı: ${result.error}`;
      room.state.turn = nextMark(room, mark);
      break;
    }
    guard += 1;
  }
  room.updatedAt = Date.now();
}

function publicState(room, userId) {
  checkDisconnect(room);
  const now = Date.now();
  return {
    code: room.code,
    type: room.type,
    meta: GAME_META[room.type],
    status: room.status,
    players: room.players,
    mark: playerMark(room, userId),
    state: room.state,
    finishReason: room.finishReason || '',
    presence: {
      humans: humanMarks(room),
      stale: staleHumanMarks(room, now),
      active: activeHumanMarks(room, now),
      pauseInfo: room.pauseInfo || null
    }
  };
}

function getRoom(req, res) {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Oda bulunamadı.' });
    return null;
  }
  return room;
}

app.get('/api/games', requireYearbookUser, (req, res) => {
  res.json({
    games: Object.fromEntries(Object.entries(GAME_META).filter(([, meta]) => meta.status === 'active'))
  });
});

app.get('/api/rooms', requireYearbookUser, (req, res) => {
  const type = getGame(String(req.query.type || ''));
  if (!type) return res.status(400).json({ error: 'Geçersiz oyun.' });
  const now = Date.now();
  const list = Array.from(rooms.values())
    .filter((room) => room.type === type && room.status === 'waiting' && now - room.updatedAt < ROOM_TTL_MS)
    .map((room) => ({ code: room.code, hostName: room.players.X.name, createdAt: room.createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
  res.json({ rooms: list });
});

app.post('/api/rooms', requireYearbookUser, (req, res) => {
  const type = getGame(String(req.body.type || ''));
  if (!type) return res.status(400).json({ error: 'Geçersiz oyun.' });
  const player = makePlayer(req);
  const withBots = req.body && req.body.bot === true;
  const now = Date.now();
  const code = createCode();
  const room = {
    code,
    type,
    status: withBots ? 'playing' : 'waiting',
    players: { X: player, O: null, A: null, B: null },
    lastSeen: { X: now, O: null, A: null, B: null },
    state: createInitialState(type, req.body || {}),
    finishReason: '',
    pauseInfo: null,
    createdAt: now,
    updatedAt: now
  };
  if (withBots) {
    marksForRoom(room).forEach((mark) => {
      if (mark !== 'X') {
        room.players[mark] = makeBot(mark);
        room.lastSeen[mark] = now;
      }
    });
  }
  rooms.set(code, room);
  res.json(publicState(room, player.id));
});

app.post('/api/rooms/:code/join', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const player = makePlayer(req);
  const existing = playerMark(room, player.id);
  if (existing) {
    touch(room, player.id);
    return res.json(publicState(room, player.id));
  }
  const freeMark = marksForRoom(room).find((mark) => !room.players[mark]);
  if (!freeMark) return res.status(409).json({ error: 'Bu oda dolu.' });
  room.players[freeMark] = player;
  room.lastSeen[freeMark] = Date.now();
  room.status = marksForRoom(room).every((mark) => room.players[mark]) ? 'playing' : 'waiting';
  room.finishReason = '';
  room.pauseInfo = null;
  room.updatedAt = Date.now();
  res.json(publicState(room, player.id));
});

app.post('/api/rooms/:code/leave', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const userId = String(req.currentUser.id);
  const mark = playerMark(room, userId);
  if (!mark) return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  if (isBotPlayer(room.players[mark])) return res.status(400).json({ error: 'Bot odadan ayrılamaz.' });
  room.players[mark] = null;
  room.lastSeen[mark] = null;
  room.updatedAt = Date.now();
  room.pauseInfo = null;
  const humansLeft = humanMarks(room);
  if (!humansLeft.length) {
    rooms.delete(room.code);
    return res.json({ ok: true, deleted: true });
  }
  if (room.status === 'waiting' || room.status === 'paused') {
    room.status = 'waiting';
    room.finishReason = '';
    return res.json({ ok: true, room: publicState(room, userId) });
  }
  const activeHumans = humanMarks(room);
  if (activeHumans.length === 1) {
    room.status = 'finished';
    room.state.winner = activeHumans[0];
    room.finishReason = `${room.players[activeHumans[0]].name} odada tek kaldı ve kazandı.`;
    return res.json({ ok: true, room: publicState(room, userId) });
  }
  room.status = 'waiting';
  room.finishReason = 'Bir oyuncu ayrıldı. Oyun yeni oyuncu veya geri bağlantı bekliyor.';
  res.json({ ok: true, room: publicState(room, userId) });
});

app.get('/api/rooms/:code', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  touch(room, String(req.currentUser.id));
  res.json(publicState(room, String(req.currentUser.id)));
});

app.post('/api/rooms/:code/move', requireYearbookUser, (req, res) => {
  const room = getRoom(req, res);
  if (!room) return;
  const userId = String(req.currentUser.id);
  const mark = touch(room, userId);
  checkDisconnect(room);
  if (room.status !== 'playing') return res.status(400).json({ error: room.status === 'paused' ? 'Oyun bir oyuncunun geri bağlanmasını bekliyor.' : 'Oyun başlamadı.' });
  if (!mark) return res.status(403).json({ error: 'Bu odanın oyuncusu değilsin.' });
  if (room.state.turn !== mark) return res.status(400).json({ error: 'Sıra sende değil.' });
  const result = applyMove(room, mark, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  runBotTurns(room);
  room.updatedAt = Date.now();
  res.json(publicState(room, userId));
});

app.get(/^\/(?!api).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
