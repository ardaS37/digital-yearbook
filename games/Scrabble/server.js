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
  <title>Scrabble</title>
  <link rel="stylesheet" href="/games/scrabble/play/style.css?v=20260530b">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Iki Kisilik Kelime Oyunu</p>
        <h1>Scrabble</h1>
        <p>Turkce kelime listesiyle ayni cihazda sirayla oynanan iki kisilik Scrabble. Harflerini diz, kelimeni yerlestir, puani topla.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="top-panel">
      <div class="player-card" id="player-0-card">
        <p class="label">Oyuncu 1</p>
        <h2 id="player-0-score">0</h2>
      </div>
      <div class="status-card">
        <p class="label">Durum</p>
        <h2 id="status-text">Sozluk yukleniyor</h2>
        <p id="turn-text">-</p>
      </div>
      <div class="player-card" id="player-1-card">
        <p class="label">Oyuncu 2</p>
        <h2 id="player-1-score">0</h2>
      </div>
    </section>

    <section class="layout">
      <section class="board-panel">
        <div class="board-head">
          <div>
            <p class="label">Tahta</p>
            <strong id="bag-count">Torba: 0</strong>
          </div>
          <div class="board-actions">
            <button id="shuffle-btn" type="button">Diz</button>
            <button id="cancel-btn" type="button">Geri Topla</button>
            <button id="pass-btn" type="button">Pas</button>
            <button id="submit-btn" class="primary" type="button">Hamleyi Onayla</button>
          </div>
        </div>
        <div id="board" class="board"></div>
      </section>

      <aside class="side-panel">
        <div class="rack-panel">
          <p class="label">Harflerin</p>
          <div id="rack" class="rack"></div>
          <p id="selected-text" class="selected-text">Harf secilmedi</p>
        </div>
        <div class="info-panel">
          <p class="label">Son Hamle</p>
          <div id="last-words" class="word-list">Henuz kelime yok.</div>
        </div>
      </aside>
    </section>
  </main>

  <div id="turn-overlay" class="turn-overlay active">
    <div class="overlay-card">
      <p class="label">Sira Gecisi</p>
      <h2 id="overlay-title">Oyuncu 1 hazirsa basla</h2>
      <p id="overlay-text">Ekrani sadece siradaki oyuncu gorsun.</p>
      <button id="start-turn-btn" class="primary" type="button">Sirayi Ac</button>
    </div>
  </div>

  <script src="/games/scrabble/play/script.js?v=20260530b"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
