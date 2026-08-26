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
  <title>Otopark</title>
  <link rel="stylesheet" href="/games/otopark/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Tek Kisilik Bulmaca</p>
        <h1>Otopark</h1>
        <p>Renkli araclari dogru seritlere ayir. Her park seridinde tek renk kalinca bolum tamamlanir.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="control-panel">
      <div class="level-box">
        <span class="label">Bolum</span>
        <select id="level-select"></select>
      </div>
      <div class="actions">
        <button id="restart-btn" type="button">Bastan</button>
        <button id="undo-btn" type="button">Geri Al</button>
        <button id="next-btn" class="primary" type="button">Sonraki Bolum</button>
      </div>
      <div class="stats">
        <div><span>Hamle</span><strong id="move-count">0</strong></div>
        <div><span>Durum</span><strong id="status-text">Hazir</strong></div>
      </div>
    </section>

    <section class="board-wrap">
      <div id="board" class="board"></div>
    </section>

    <section class="hint-card">
      <p class="label">Kural</p>
      <p>Bir seritteki en ust araci, bos seride veya ayni renkle biten serideki bos yere tasiyabilirsin. Tum dolu seritler tek renk olunca kazanirsin.</p>
    </section>
  </main>
  <script src="/games/otopark/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
