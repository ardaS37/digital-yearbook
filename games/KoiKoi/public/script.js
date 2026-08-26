(() => {
  const USER_NAME = window.KOI_KOI_USER || 'Yıllık hesabın';
  const INITIAL_MODE = window.KOI_KOI_INITIAL_MODE === 'pc' ? 'pc' : 'pvp';

  const $ = (id) => document.getElementById(id);
  const choiceModal = $('choice-modal');
  const roundModal = $('round-modal');
  const choiceTitle = $('choice-title');
  const choiceText = $('choice-text');
  const choiceOptions = $('choice-options');
  const roundText = $('round-text');
  const roundTitle = $('round-title');

  const MONTHS = [
    { month: 1, name: 'Ocak', theme: 'Çam', emoji: '🌲', cards: [
      { type: 'bright', label: 'Kran', emoji: '🕊️', kind: 'Parlak' },
      { type: 'ribbon', ribbon: 'red', label: 'Kırmızı Şiir', emoji: '🎴', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 2, name: 'Şubat', theme: 'Erik', emoji: '🌸', cards: [
      { type: 'animal', label: 'Bülbül', emoji: '🐦', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'red', label: 'Kırmızı Şiir', emoji: '🎴', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 3, name: 'Mart', theme: 'Kiraz', emoji: '🌸', cards: [
      { type: 'bright', label: 'Perde', emoji: '✨', kind: 'Parlak' },
      { type: 'ribbon', ribbon: 'red', label: 'Kırmızı Şiir', emoji: '🎴', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 4, name: 'Nisan', theme: 'Wisteria', emoji: '💜', cards: [
      { type: 'animal', label: 'Kukumav', emoji: '🦉', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'purple', label: 'Mor Şerit', emoji: '🎀', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 5, name: 'Mayıs', theme: 'Süsen', emoji: '💙', cards: [
      { type: 'animal', label: 'Köprü', emoji: '🌉', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'blue', label: 'Mavi Şerit', emoji: '🎀', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 6, name: 'Haziran', theme: 'Şakayık', emoji: '🦋', cards: [
      { type: 'animal', label: 'Kelebek', emoji: '🦋', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'blue', label: 'Mavi Şerit', emoji: '🎀', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 7, name: 'Temmuz', theme: 'Kabak', emoji: '🦌', cards: [
      { type: 'animal', label: 'Yaban Domuzu', emoji: '🐗', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'red', label: 'Kırmızı Şerit', emoji: '🎴', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 8, name: 'Ağustos', theme: 'Otlar', emoji: '🌙', cards: [
      { type: 'bright', label: 'Dolunay', emoji: '🌕', kind: 'Parlak' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 9, name: 'Eylül', theme: 'Krizantem', emoji: '💙', cards: [
      { type: 'animal', label: 'Sake Kupası', emoji: '🍶', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'blue', label: 'Mavi Şerit', emoji: '🎀', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 10, name: 'Ekim', theme: 'Akçaağaç', emoji: '🍁', cards: [
      { type: 'animal', label: 'Geyik', emoji: '🦌', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'blue', label: 'Mavi Şerit', emoji: '🎀', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 11, name: 'Kasım', theme: 'Söğüt', emoji: '🌧️', cards: [
      { type: 'bright', label: 'Yağmur Adamı', emoji: '☔', kind: 'Parlak' },
      { type: 'animal', label: 'Kırlangıç', emoji: '🐦', kind: 'Hayvan' },
      { type: 'ribbon', ribbon: 'red', label: 'Kırmızı Şerit', emoji: '🎴', kind: 'Şerit' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
    { month: 12, name: 'Aralık', theme: 'Paulownia', emoji: '🦚', cards: [
      { type: 'bright', label: 'Anka', emoji: '🦚', kind: 'Parlak' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
      { type: 'plain', label: 'Düz', emoji: '•', kind: 'Düz' },
    ]},
  ];

  const BRIGHT_MONTHS = new Set([1, 3, 8, 11, 12]);
  const state = {
    mode: INITIAL_MODE,
    currentPlayer: 0,
    deck: [],
    field: [],
    hands: [[], []],
    captures: [[], []],
    score: [0, 0],
    selectedHandIndex: null,
    pendingChoice: null,
    awaitingDecision: false,
    decisionPlayer: null,
    roundEnded: false,
    pendingTimer: null,
    status: 'Kart seç ve oyna.',
    lastWinner: null,
  };

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function createDeck() {
    const cards = [];
    MONTHS.forEach((monthDef) => {
      monthDef.cards.forEach((cardDef, index) => {
        cards.push({
          id: `${monthDef.month}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          month: monthDef.month,
          monthName: monthDef.name,
          monthTheme: monthDef.theme,
          monthEmoji: monthDef.emoji,
          type: cardDef.type,
          label: cardDef.label,
          emoji: cardDef.emoji,
          kind: cardDef.kind,
          ribbon: cardDef.ribbon || null,
        });
      });
    });
    return shuffle(cards);
  }

  function cloneCard(card) {
    return { ...card };
  }

  function getPlayerName(index) {
    if (index === 0) return USER_NAME;
    return state.mode === 'pc' ? 'Bilgisayar' : 'Rakip';
  }

  function isHumanTurn(playerIndex) {
    return state.mode === 'pvp' || playerIndex === 0;
  }

  function scoreWeight(card) {
    if (card.type === 'bright') return 10;
    if (card.type === 'animal') return 4;
    if (card.type === 'ribbon') return 3;
    return 1;
  }

  function calculateYaku(cards) {
    const counts = { bright: 0, animal: 0, ribbon: 0, plain: 0 };
    const cardSet = new Set();
    cards.forEach((card) => {
      counts[card.type] += 1;
      cardSet.add(`${card.month}-${card.type}-${card.ribbon || ''}`);
    });

    const hasMonthType = (month, type, ribbon = null) => cards.some((card) => card.month === month && card.type === type && (ribbon ? card.ribbon === ribbon : true));
    const months = new Set(cards.map((card) => card.month));
    const yakus = [];

    if (counts.bright >= 5) yakus.push({ name: 'Beş Parlak', points: 10 });
    else if (counts.bright === 4) yakus.push({ name: 'Dört Parlak', points: 8 });
    else if (counts.bright === 3) yakus.push({ name: 'Üç Parlak', points: 6 });

    if ([6, 7, 10].every((month) => months.has(month))) {
      yakus.push({ name: 'Boar-Deer-Butterfly', points: 5 });
    }

    if (hasMonthType(1, 'ribbon', 'red') && hasMonthType(2, 'ribbon', 'red') && hasMonthType(3, 'ribbon', 'red')) {
      yakus.push({ name: 'Kırmızı Şiir Şeritleri', points: 5 });
    }

    if (hasMonthType(5, 'ribbon', 'blue') && hasMonthType(9, 'ribbon', 'blue') && hasMonthType(10, 'ribbon', 'blue')) {
      yakus.push({ name: 'Mavi Şeritler', points: 5 });
    }

    if (counts.animal >= 5) {
      yakus.push({ name: 'Hayvanlar', points: 1 + (counts.animal - 5) });
    }

    if (counts.ribbon >= 5) {
      yakus.push({ name: 'Şeritler', points: 1 + (counts.ribbon - 5) });
    }

    if (counts.plain >= 10) {
      yakus.push({ name: 'Kasuku', points: 1 + (counts.plain - 10) });
    }

    return {
      total: yakus.reduce((sum, entry) => sum + entry.points, 0),
      yakus
    };
  }

  function calculateScore(playerIndex) {
    return calculateYaku(state.captures[playerIndex]);
  }

  function availableMatches(card) {
    return state.field
      .map((fieldCard, index) => ({ fieldCard, index }))
      .filter(({ fieldCard }) => fieldCard.month === card.month);
  }

  function removeHandCard(playerIndex, handIndex) {
    return state.hands[playerIndex].splice(handIndex, 1)[0];
  }

  function removeFieldCard(fieldIndex) {
    return state.field.splice(fieldIndex, 1)[0];
  }

  function addCapture(playerIndex, cards) {
    state.captures[playerIndex].push(...cards.map(cloneCard));
  }

  function setStatus(text) {
    state.status = text;
  }

  function clearSelection() {
    state.selectedHandIndex = null;
    state.pendingChoice = null;
  }

  function openChoiceModal(title, text, options, onPick) {
    state.pendingChoice = { onPick };
    choiceTitle.textContent = title;
    choiceText.textContent = text;
    choiceOptions.innerHTML = options.map((option, index) => `
      <button class="choice-card" data-choice-index="${index}">
        <strong>${option.title}</strong>
        <span>${option.description}</span>
      </button>
    `).join('');
    choiceModal.classList.remove('hidden');
  }

  function closeChoiceModal() {
    state.pendingChoice = null;
    choiceOptions.innerHTML = '';
    choiceModal.classList.add('hidden');
  }

  function openRoundModal(playerIndex, scoreInfo) {
    state.awaitingDecision = true;
    state.decisionPlayer = playerIndex;
    roundTitle.textContent = `${getPlayerName(playerIndex)} için karar`;
    roundText.innerHTML = `
      <strong>Mevcut puan:</strong> ${scoreInfo.total}<br>
      <strong>Yaku:</strong> ${scoreInfo.yakus.length ? scoreInfo.yakus.map((entry) => `${entry.name} (${entry.points})`).join(', ') : 'Yaku yok'}
    `;
    $('round-koikoi').disabled = false;
    $('round-stop').disabled = false;
    roundModal.classList.remove('hidden');
  }

  function closeRoundModal() {
    roundModal.classList.add('hidden');
  }

  function drawCardFromDeck() {
    return state.deck.pop() || null;
  }

  function setPhaseMessage(message) {
    setStatus(message);
    render();
  }

  function resolveCardPlay(playerIndex, card, source, fieldIndex = null) {
    const capturePair = fieldIndex === null ? [] : [card, removeFieldCard(fieldIndex)];

    if (capturePair.length) {
      addCapture(playerIndex, capturePair);
      setStatus(`${getPlayerName(playerIndex)} ${capturePair[1].monthName} eşleşmesini topladı.`);
    } else {
      state.field.push(cloneCard(card));
      setStatus(`${getPlayerName(playerIndex)} kartı masaya bıraktı.`);
    }

    const currentScoreAfter = calculateScore(playerIndex);
    state.score[playerIndex] = currentScoreAfter.total;
    render();

    if (state.roundEnded) return;

    if (source === 'hand') {
      if (state.deck.length > 0) {
        drawPhase(playerIndex);
      } else if (state.hands[0].length === 0 && state.hands[1].length === 0) {
        finishRound(`Kartlar bitti. ${getPlayerName(playerIndex)} son hamleyi yaptı.`);
      } else {
        const endScore = calculateScore(playerIndex);
        if (endScore.total > 0) {
          openRoundModal(playerIndex, endScore);
        } else {
          endTurn(playerIndex);
        }
      }
      return;
    }

    if (state.hands[0].length === 0 && state.hands[1].length === 0 && state.deck.length === 0) {
      finishRound(`Kartlar bitti. ${getPlayerName(playerIndex)} son hamleyi yaptı.`);
      return;
    }

    if (currentScoreAfter.total > 0) {
      openRoundModal(playerIndex, currentScoreAfter);
      render();
      return;
    }

    endTurn(playerIndex);
  }

  function handleMatchSelection(choiceIndex) {
    if (!state.pendingChoice) return;
    const { onPick } = state.pendingChoice;
    closeChoiceModal();
    onPick(choiceIndex);
    render();
  }

  function playHandCard(playerIndex, handIndex) {
    if (state.roundEnded || state.awaitingDecision || state.pendingChoice || state.currentPlayer !== playerIndex) return;
    const card = state.hands[playerIndex][handIndex];
    if (!card) return;

    state.selectedHandIndex = handIndex;
    const matches = availableMatches(card);
    removeHandCard(playerIndex, handIndex);
    state.selectedHandIndex = null;

    if (matches.length === 0) {
      resolveCardPlay(playerIndex, card, 'hand', null);
      return;
    }

    if (matches.length === 1 || (state.mode === 'pc' && playerIndex === 1)) {
      const fieldIndex = chooseBestMatch(playerIndex, card, matches).index;
      resolveCardPlay(playerIndex, card, 'hand', fieldIndex);
      return;
    }

    openChoiceModal(
      'Eşleşme seç',
      `${card.monthName} kartı için bir masa kartı seçin.`,
      matches.map(({ fieldCard }) => ({
        title: `${fieldCard.monthName} kartı`,
        description: `${fieldCard.kind} · ${fieldCard.emoji}`
      })),
      (choiceIndex) => {
        const selected = matches[choiceIndex];
        resolveCardPlay(playerIndex, card, 'hand', selected.index);
      }
    );
    render();
  }

  function chooseBestMatch(playerIndex, card, matches) {
    const currentScore = calculateScore(playerIndex).total;
    let best = matches[0];
    let bestScore = -Infinity;

    matches.forEach((match) => {
      const simulated = state.captures[playerIndex].concat([card, match.fieldCard]);
      const simulatedScore = calculateYaku(simulated).total;
      const value = (simulatedScore - currentScore) * 20 + scoreWeight(card) + scoreWeight(match.fieldCard);
      if (value > bestScore) {
        bestScore = value;
        best = match;
      }
    });

    return best;
  }

  function drawPhase(playerIndex) {
    if (state.roundEnded) return;
    const drawCard = drawCardFromDeck();
    if (!drawCard) {
      endTurn(playerIndex);
      return;
    }

    const matches = availableMatches(drawCard);
    if (matches.length === 0) {
      state.field.push(drawCard);
      setStatus(`${getPlayerName(playerIndex)} deste kartını masaya bıraktı.`);
      render();
      endTurn(playerIndex);
      return;
    }

    if (matches.length === 1 || (state.mode === 'pc' && playerIndex === 1)) {
      const best = chooseBestMatch(playerIndex, drawCard, matches);
      resolveCardPlay(playerIndex, drawCard, 'draw', best.index);
      return;
    }

    openChoiceModal(
      'Deste kartı eşleşti',
      `${drawCard.monthName} kartı masa ile eşleşti. Bir seçim yapın.`,
      matches.map(({ fieldCard }) => ({
        title: `${fieldCard.monthName} kartı`,
        description: `${fieldCard.kind} · ${fieldCard.emoji}`
      })),
      (choiceIndex) => {
        const selected = matches[choiceIndex];
        resolveCardPlay(playerIndex, drawCard, 'draw', selected.index);
      }
    );
    render();
  }

  function finishRound(reason) {
    window.clearTimeout(state.pendingTimer);
    state.roundEnded = true;
    const score0 = calculateScore(0);
    const score1 = calculateScore(1);
    state.score[0] = score0.total;
    state.score[1] = score1.total;
    const winner =
      score0.total > score1.total ? 0 :
      score1.total > score0.total ? 1 :
      null;
    state.lastWinner = winner;

    if (winner === null) {
      setStatus(`Berabere. ${reason}`);
    } else {
      setStatus(`${getPlayerName(winner)} kazandı. ${reason}`);
    }
    closeRoundModal();
    closeChoiceModal();
    render();
  }

  function endTurn(playerIndex) {
    if (state.roundEnded) return;
    const scoreInfo = calculateScore(playerIndex);
    state.score[playerIndex] = scoreInfo.total;
    const remainingCards = state.deck.length + state.hands[0].length + state.hands[1].length;

    if (remainingCards === 0) {
      finishRound('Kartlar tamamen bitti.');
      return;
    }

    if (scoreInfo.total > 0) {
      openRoundModal(playerIndex, scoreInfo);
      render();
      if (state.mode === 'pc' && playerIndex === 1) {
        window.clearTimeout(state.pendingTimer);
        state.pendingTimer = window.setTimeout(() => {
          if (!state.awaitingDecision || state.decisionPlayer !== 1 || state.roundEnded) return;
          const aiScore = calculateScore(1);
          const opponentScore = calculateScore(0).total;
          if (aiScore.total >= 7 || aiScore.total >= opponentScore) {
            stopRound();
          } else {
            continueRound();
          }
        }, 650);
      }
      return;
    }

    switchTurn();
  }

  function switchTurn() {
    window.clearTimeout(state.pendingTimer);
    clearSelection();
    closeRoundModal();
    state.awaitingDecision = false;
    state.decisionPlayer = null;
    state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
    setStatus(`${getPlayerName(state.currentPlayer)} sırası.`);
    render();
    if (state.mode === 'pc' && state.currentPlayer === 1 && !state.roundEnded) {
      window.clearTimeout(state.pendingTimer);
      state.pendingTimer = window.setTimeout(aiTurn, 680);
    }
  }

  function continueRound() {
    window.clearTimeout(state.pendingTimer);
    closeRoundModal();
    state.awaitingDecision = false;
    state.decisionPlayer = null;
    state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
    setStatus(`${getPlayerName(state.currentPlayer)} sırası.`);
    render();
    if (state.mode === 'pc' && state.currentPlayer === 1 && !state.roundEnded) {
      window.clearTimeout(state.pendingTimer);
      state.pendingTimer = window.setTimeout(aiTurn, 680);
    }
  }

  function stopRound() {
    window.clearTimeout(state.pendingTimer);
    if (state.decisionPlayer === null) return;
    finishRound(`${getPlayerName(state.decisionPlayer)} eli kapattı.`);
  }

  function chooseAiMove() {
    const playerIndex = 1;
    const cards = state.hands[playerIndex];
    if (!cards.length) return null;

    const currentScore = calculateScore(playerIndex).total;
    const candidateMoves = [];

    cards.forEach((card, handIndex) => {
      const matches = availableMatches(card);
      if (!matches.length) {
        const risk = state.field.filter((fieldCard) => fieldCard.month === card.month).length;
        candidateMoves.push({
          type: 'discard',
          handIndex,
          value: -risk * 2 + scoreWeight(card),
        });
        return;
      }

      matches.forEach((match) => {
        const simulated = state.captures[playerIndex].concat([card, match.fieldCard]);
        const simulatedScore = calculateYaku(simulated).total;
        candidateMoves.push({
          type: 'capture',
          handIndex,
          fieldIndex: match.index,
          value: (simulatedScore - currentScore) * 40 + scoreWeight(card) + scoreWeight(match.fieldCard),
        });
      });
    });

    candidateMoves.sort((a, b) => b.value - a.value);
    return candidateMoves[0] || null;
  }

  function aiTurn() {
    if (state.roundEnded || state.awaitingDecision || state.pendingChoice || state.currentPlayer !== 1) return;
    const move = chooseAiMove();
    if (!move) return;
    const card = state.hands[1][move.handIndex];
    if (!card) return;
    removeHandCard(1, move.handIndex);
    if (move.type === 'discard') {
      state.field.push(cloneCard(card));
      setStatus('Bilgisayar kartı masaya bıraktı.');
      render();
      drawPhase(1);
      return;
    }

    resolveCardPlay(1, card, 'hand', move.fieldIndex);
  }

  function dealInitialHands() {
    state.deck = createDeck();
    state.field = [];
    state.hands = [[], []];
    state.captures = [[], []];
    state.score = [0, 0];
    state.selectedHandIndex = null;
    state.pendingChoice = null;
    state.awaitingDecision = false;
    state.decisionPlayer = null;
    state.roundEnded = false;
    state.lastWinner = null;

    for (let i = 0; i < 8; i += 1) {
      state.hands[0].push(state.deck.pop());
      state.hands[1].push(state.deck.pop());
    }

    for (let i = 0; i < 8; i += 1) {
      state.field.push(state.deck.pop());
    }

    setStatus('Yeni el hazır. Oyuncu 1 başlıyor.');
  }

  function startGame() {
    window.clearTimeout(state.pendingTimer);
    dealInitialHands();
    state.currentPlayer = 0;
    closeChoiceModal();
    closeRoundModal();
    render();
    if (state.mode === 'pc') {
      setStatus('PC moduna geçildi. Sıra sizde.');
    }
  }

  function switchMode(nextMode) {
    state.mode = nextMode === 'pc' ? 'pc' : 'pvp';
    $('mode-pill').textContent = `Mod: ${state.mode === 'pc' ? 'PC' : 'Yerel 2 Oyuncu'}`;
    document.querySelectorAll('.intro-chip[data-mode]').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.mode === state.mode);
    });
    startGame();
  }

  function cardHtml(card, { faceDown = false, selectable = false, selected = false, compact = false, fieldIndex = null, playerIndex = null } = {}) {
    if (faceDown) {
      return `
        <div class="card-back card-mini ${compact ? 'card-mini' : ''}">
          <div class="card-month">Kapalı</div>
          <div class="card-emoji">🂠</div>
          <div class="card-label">Rakip kartı</div>
        </div>
      `;
    }

    const classes = ['card-button'];
    if (compact) classes.push('card-mini');
    if (selected) classes.push('selected');

    const attrs = [];
    if (selectable) {
      attrs.push(`data-hand-index="${fieldIndex}"`);
      attrs.push(`data-player-index="${playerIndex}"`);
    }

    return `
      <button class="${classes.join(' ')}" data-type="${card.type}" ${attrs.join(' ')}>
        <div class="card-month">${card.monthName}</div>
        <div class="card-emoji">${card.emoji}</div>
        <div class="card-label">${card.label}</div>
      </button>
    `;
  }

  function renderHands() {
    [0, 1].forEach((playerIndex) => {
      const handGrid = $(`hand-grid-${playerIndex}`);
      const handCount = $(`hand-count-${playerIndex}`);
      const playerSub = $(`player-sub-${playerIndex}`);
      const turnPill = $(`turn-pill-${playerIndex}`);
      const handCard = $(`hand-card-${playerIndex}`);
      const isActive = state.currentPlayer === playerIndex && !state.roundEnded;
      const visible = state.mode === 'pvp' || playerIndex === 0;
      const scoreInfo = calculateScore(playerIndex);

      handCount.textContent = `${state.hands[playerIndex].length}`;
      $('score-' + playerIndex).textContent = `${scoreInfo.total}`;
      turnPill.textContent = isActive ? 'Sıra sende' : 'Beklemede';
      handCard.classList.toggle('active', isActive);

      if (state.roundEnded) {
        playerSub.textContent = state.lastWinner === playerIndex
          ? 'El kazandı'
          : 'El kapandı';
      } else if (state.awaitingDecision && state.decisionPlayer === playerIndex) {
        playerSub.textContent = 'Koi Koi kararı bekleniyor';
      } else if (isActive) {
        playerSub.textContent = 'Hamle yap';
      } else {
        playerSub.textContent = visible ? 'Sıra bekliyor' : 'Kartlar kapalı';
      }

      if (visible || playerIndex === 0) {
        handGrid.innerHTML = state.hands[playerIndex].map((card, handIndex) => cardHtml(card, {
          selectable: isActive && isHumanTurn(playerIndex),
          selected: state.selectedHandIndex === handIndex && playerIndex === state.currentPlayer,
          compact: false,
          fieldIndex: handIndex,
          playerIndex
        })).join('');
      } else {
        handGrid.innerHTML = state.hands[playerIndex].map(() => cardHtml(null, { faceDown: true, compact: false })).join('');
      }
    });
  }

  function renderField() {
    const fieldGrid = $('field-grid');
    $('deck-count').textContent = `Deste: ${state.deck.length}`;
    if (!state.field.length) {
      fieldGrid.innerHTML = `
        <div class="field-card card-mini" style="opacity:0.6; grid-column: 1 / -1; text-align:center;">
          Masa boş
        </div>
      `;
      return;
    }

    fieldGrid.innerHTML = state.field.map((card, index) => {
      const highlighted = state.pendingChoice && state.pendingChoice.onPick && state.pendingChoice.options && state.pendingChoice.options?.includes(index);
      return `
        <button class="field-card card-mini ${highlighted ? 'highlight' : ''}" data-field-index="${index}">
          <div class="card-month">${card.monthName}</div>
          <div class="card-emoji">${card.emoji}</div>
          <div class="card-label">${card.label}</div>
        </button>
      `;
    }).join('');
  }

  function renderCaptures() {
    [0, 1].forEach((playerIndex) => {
      const captureEl = $(`capture-${playerIndex}`);
      const yakusEl = $(`yakus-${playerIndex}`);
      const captures = state.captures[playerIndex];
      const scoreInfo = calculateScore(playerIndex);

      captureEl.innerHTML = captures.length
        ? captures.map((card) => `
          <div class="field-card card-mini">
            <div class="card-month">${card.monthName}</div>
            <div class="card-emoji">${card.emoji}</div>
            <div class="card-label">${card.label}</div>
          </div>
        `).join('')
        : '<div class="field-card card-mini" style="opacity:0.55;">Henüz kart yok</div>';

      yakusEl.innerHTML = scoreInfo.yakus.length
        ? scoreInfo.yakus.map((entry) => `<span class="yaku-chip">${entry.name} +${entry.points}</span>`).join('')
        : '<span class="yaku-chip">Yaku yok</span>';
    });
  }

  function renderStatus() {
    $('status-text').innerHTML = state.roundEnded
      ? `<strong>El tamamlandı.</strong> ${state.status}`
      : state.status;
  }

  function render() {
    renderField();
    renderHands();
    renderCaptures();
    renderStatus();

    const koikoiBtn = $('koikoi-btn');
    const stopBtn = $('stop-btn');
    const canDecide = state.awaitingDecision && state.decisionPlayer === state.currentPlayer && !state.roundEnded;
    koikoiBtn.disabled = !canDecide;
    stopBtn.disabled = !canDecide;

    document.querySelectorAll('.intro-chip[data-mode]').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.mode === state.mode);
    });
  }

  function bindEvents() {
    $('new-game-btn').addEventListener('click', startGame);
    $('koikoi-btn').addEventListener('click', continueRound);
    $('stop-btn').addEventListener('click', stopRound);

    document.querySelectorAll('.intro-chip[data-mode]').forEach((chip) => {
      chip.addEventListener('click', () => switchMode(chip.dataset.mode));
    });

    $('round-koikoi').addEventListener('click', continueRound);
    $('round-stop').addEventListener('click', stopRound);

    $('choice-options').addEventListener('click', (event) => {
      const button = event.target.closest('[data-choice-index]');
      if (!button || !state.pendingChoice) return;
      const choiceIndex = Number(button.dataset.choiceIndex);
      const handler = state.pendingChoice.onPick;
      closeChoiceModal();
      handler(choiceIndex);
    });

    $('field-grid').addEventListener('click', (event) => {
      if (state.roundEnded || state.awaitingDecision || state.pendingChoice) return;
      const cardButton = event.target.closest('[data-field-index]');
      if (!cardButton) return;
      if (!state.pendingChoice) return;
      const fieldIndex = Number(cardButton.dataset.fieldIndex);
      state.pendingChoice.onPick(fieldIndex);
    });

    ['hand-grid-0', 'hand-grid-1'].forEach((gridId) => {
      const grid = $(gridId);
      grid.addEventListener('click', (event) => {
        if (state.roundEnded || state.awaitingDecision || state.pendingChoice) return;
        const button = event.target.closest('[data-hand-index]');
        if (!button) return;
        const playerIndex = Number(button.dataset.playerIndex);
        const handIndex = Number(button.dataset.handIndex);
        if (playerIndex !== state.currentPlayer) return;
        if (!isHumanTurn(playerIndex)) return;
        playHandCard(playerIndex, handIndex);
      });
    });
  }

  function boot() {
    bindEvents();
    startGame();
    if (state.mode === 'pc') {
      $('mode-pill').textContent = 'Mod: PC';
    }
  }

  boot();
})();
