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

function renderPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Şişeler</title>
  <link rel="stylesheet" href="/games/siseler/play/style.css?v=20260530b">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Tek Kisilik Bulmaca</p>
        <h1>Şişeler</h1>
        <p>Renkli şişeleri doğru sıralara ayır. Her sırada tek renk kalınca bölüm tamamlanır.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="control-panel">
      <div class="level-box">
        <span class="label">Bölüm</span>
        <select id="level-select"></select>
      </div>
      <div class="actions">
        <button id="restart-btn" type="button">Baştan</button>
        <button id="undo-btn" type="button">Geri Al</button>
        <button id="next-btn" class="primary" type="button">Sonraki Bölüm</button>
      </div>
      <div class="stats">
        <div><span>Hamle</span><strong id="move-count">0</strong></div>
        <div><span>Durum</span><strong id="status-text">Hazır</strong></div>
      </div>
    </section>

    <section class="board-wrap">
      <div id="board" class="board"></div>
    </section>

    <section class="hint-card">
      <p class="label">Kural</p>
      <p>Bir sıradaki en üst şişeyi, boş sıraya ya da aynı renkle biten sıradaki boş yere taşıyabilirsin. Tüm dolu sıralar tek renk olunca kazanırsın.</p>
    </section>
  </main>
  <script src="/games/siseler/play/script.js?v=20260530b"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
