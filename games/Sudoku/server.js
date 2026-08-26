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
  <title>Sudoku</title>
  <link rel="stylesheet" href="/games/sudoku/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Tek Kisilik Mantik Oyunu</p>
        <h1>Sudoku</h1>
        <p>Satir, sutun ve 3x3 kutulari tekrar etmeden doldur. Zorluk sec, tahtayi cozmeye basla.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="control-panel">
      <div class="difficulty-box">
        <span class="label">Zorluk</span>
        <select id="difficulty-select">
          <option value="easy">Kolay</option>
          <option value="medium">Orta</option>
          <option value="hard">Zor</option>
        </select>
      </div>
      <div class="actions">
        <button id="new-btn" class="primary" type="button">Yeni Oyun</button>
        <button id="clear-btn" type="button">Secileni Temizle</button>
        <button id="check-btn" type="button">Kontrol Et</button>
      </div>
      <div class="stats">
        <div><span>Durum</span><strong id="status-text">Hazir</strong></div>
        <div><span>Hata</span><strong id="error-count">0</strong></div>
      </div>
    </section>

    <section class="layout">
      <section class="board-card">
        <div id="board" class="board"></div>
      </section>
      <aside class="pad-card">
        <p class="label">Rakamlar</p>
        <div id="number-pad" class="number-pad"></div>
        <p class="hint-text">Bir kare secip sayiya bas. Ayni satir, sutun veya kutuda tekrar varsa hata sayilir.</p>
      </aside>
    </section>
  </main>
  <script src="/games/sudoku/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
