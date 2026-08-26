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
  <title>Lingo</title>
  <link rel="stylesheet" href="/games/lingo/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Kelime Oyunu</p>
        <h1>Lingo</h1>
        <p>4, 5, 6 veya 7 harfli gizli kelimeyi 6 denemede bul. Her tahminde doğru harf, doğru yer ve yanlış yer ipuçlarını gör.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="mode-panel">
      <p class="label">Kelime Uzunluğu</p>
      <div class="mode-switcher" id="length-switcher">
        <button type="button" data-length="4">4</button>
        <button type="button" data-length="5" class="active">5</button>
        <button type="button" data-length="6">6</button>
        <button type="button" data-length="7">7</button>
      </div>
    </section>

    <section class="board-panel">
      <div class="board-head">
        <div>
          <p class="label">Durum</p>
          <strong id="status-text">Kelime yükleniyor</strong>
        </div>
        <div class="board-actions">
          <button id="new-game-btn" type="button">Yeni Kelime</button>
        </div>
      </div>

      <div id="board" class="lingo-board" aria-live="polite"></div>

      <form id="guess-form" class="guess-row">
        <input id="guess-input" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Kelime yaz" />
        <button class="primary" type="submit">Tahmin Et</button>
      </form>
    </section>
  </main>

  <script src="/games/lingo/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  return res.type('html').send(renderPage());
});

module.exports = app;
