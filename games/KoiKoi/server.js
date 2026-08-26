const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

function requireYearbookUser(req, res, next) {
  if (!req.currentUser) {
    return res.redirect('/login');
  }
  return next();
}

function renderPage(req) {
  const userName = req.currentUser?.name || req.currentUser?.username || 'Yıllık hesabın';
  const mode = String(req.query.mode || 'pvp').toLowerCase() === 'pc' ? 'pc' : 'pvp';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Koi Koi</title>
  <link rel="stylesheet" href="/games/koi-koi/play/style.css?v=20260530c">
</head>
<body>
  <main class="app-shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Koi Koi</h1>
        <p class="hero-text">48 kartlık Hanafuda akışı. Eşleşmeleri topla, yaku kur, sonra Koi Koi riskini al ya da eli kapat.</p>
      </div>
      <div class="hero-actions">
        <a class="ghost-link" href="/games">Oyunlara dön</a>
        <div class="mode-pill" id="mode-pill">Mod: ${mode === 'pc' ? 'PC' : 'Yerel 2 Oyuncu'}</div>
      </div>
    </header>

    <section class="intro-strip">
      <div class="intro-chip active" data-mode="pvp">Yerel 2 Oyuncu</div>
      <div class="intro-chip" data-mode="pc">PC'ye Karşı</div>
      <div class="intro-chip">Hanafuda</div>
      <div class="intro-chip">Koi Koi</div>
    </section>

    <section class="board-grid">
      <aside class="side-card">
        <p class="eyebrow">Oyuncu 2</p>
        <div class="player-name" id="player-name-1">Rakip</div>
        <div class="player-sub" id="player-sub-1">Henüz kart yok</div>
        <div class="scoreline"><span>Puan</span><strong id="score-1">0</strong></div>
        <div class="scoreline"><span>El</span><strong id="hand-count-1">0</strong></div>
      </aside>

      <section class="table-card">
        <div class="table-ring"></div>
        <div class="toolbar">
          <button id="new-game-btn" class="primary-btn">Yeni Oyun</button>
          <button id="koikoi-btn" class="secondary-btn" disabled>Koi Koi</button>
          <button id="stop-btn" class="secondary-btn" disabled>Bitir</button>
        </div>

        <div class="status-card">
          <p class="eyebrow">Durum</p>
          <div id="status-text">Kart seç ve eşleşme başlat.</div>
        </div>

        <div class="field-wrap">
          <div class="field-head">
            <span>Ortak Masa</span>
            <span id="deck-count">Deste: 0</span>
          </div>
          <div id="field-grid" class="field-grid"></div>
        </div>

        <div class="capture-row">
          <div class="capture-box">
            <div class="capture-head">Oyuncu 1 Kazandıkları</div>
            <div id="capture-0" class="capture-cards"></div>
            <div id="yakus-0" class="yakus"></div>
          </div>
          <div class="capture-box">
            <div class="capture-head">Oyuncu 2 Kazandıkları</div>
            <div id="capture-1" class="capture-cards"></div>
            <div id="yakus-1" class="yakus"></div>
          </div>
        </div>

        <div class="deck-note">
          <strong>Yıllık hesabın:</strong> ${userName}
        </div>
      </section>

      <aside class="side-card">
        <p class="eyebrow">Oyuncu 1</p>
        <div class="player-name" id="player-name-0">${userName}</div>
        <div class="player-sub" id="player-sub-0">Başlangıç elini bekliyor</div>
        <div class="scoreline"><span>Puan</span><strong id="score-0">0</strong></div>
        <div class="scoreline"><span>El</span><strong id="hand-count-0">0</strong></div>
      </aside>
    </section>

    <section class="hands-grid">
      <div class="hand-card active" id="hand-card-0">
        <div class="hand-head">
          <span>${userName}</span>
          <span id="turn-pill-0">Sıra bekliyor</span>
        </div>
        <div id="hand-grid-0" class="hand-grid"></div>
      </div>
      <div class="hand-card" id="hand-card-1">
        <div class="hand-head">
          <span>Rakip</span>
          <span id="turn-pill-1">Sıra bekliyor</span>
        </div>
        <div id="hand-grid-1" class="hand-grid"></div>
      </div>
    </section>
  </main>

  <div id="choice-modal" class="modal hidden">
    <div class="modal-card">
      <h3 id="choice-title">Eşleşme seç</h3>
      <p id="choice-text">Bir kart seçin.</p>
      <div id="choice-options" class="choice-options"></div>
    </div>
  </div>

  <div id="round-modal" class="modal hidden">
    <div class="modal-card">
      <h3 id="round-title">Eli bitir</h3>
      <p id="round-text">Yaku tamamlandı.</p>
      <div class="choice-options">
        <button id="round-koikoi" class="primary-btn">Koi Koi</button>
        <button id="round-stop" class="secondary-btn">Bitir</button>
      </div>
    </div>
  </div>

  <script>
    window.KOI_KOI_USER = ${JSON.stringify(userName)};
    window.KOI_KOI_INITIAL_MODE = ${JSON.stringify(mode)};
  </script>
  <script src="/games/koi-koi/play/script.js?v=20260530c"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage(req));
});

module.exports = app;
