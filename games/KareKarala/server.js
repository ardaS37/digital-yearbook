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
  <title>Kare Karala</title>
  <link rel="stylesheet" href="/games/kare-karala/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Tek Kisilik Mantik Bulmacasi</p>
        <h1>Kare Karala</h1>
        <p>Satir ve sutun ipuclarina gore dogru kareleri boya. Resim tamamen cikinca bolum tamamlanir.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="control-panel">
      <div class="puzzle-box">
        <span class="label">Bulmaca</span>
        <select id="puzzle-select"></select>
      </div>
      <div class="actions">
        <button id="paint-mode-btn" class="primary" type="button">Boyama Modu</button>
        <button id="mark-mode-btn" type="button">X Modu</button>
        <button id="restart-btn" type="button">Bastan</button>
        <button id="check-btn" type="button">Kontrol Et</button>
      </div>
      <div class="stats">
        <div><span>Durum</span><strong id="status-text">Hazir</strong></div>
        <div><span>Hata</span><strong id="error-count">0</strong></div>
      </div>
    </section>

    <section class="board-card">
      <div id="board-wrap" class="board-wrap"></div>
    </section>
  </main>
  <script src="/games/kare-karala/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
