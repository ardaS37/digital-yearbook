const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');
const boardGamesApp = require(path.join(__dirname, '..', 'BoardGames', 'server'));

function renderPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Go</title>
  <link rel="stylesheet" href="/games/go/play/style.css?v=20260529b">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Go</h1>
        <p>9x9, 13x13 veya 19x19 tahtada tas koy, alan kur ve esir farkiyla ustunluk sagla.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="panel mode-panel">
      <div>
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="go">Go</option>
          <option value="domino">Domino</option>
          <option value="kizma-birader">Kizma Birader</option>
          <option value="koridor">Koridor</option>
          <option value="tavla">Tavla</option>
          <option value="9-tas">9 Tas</option>
          <option value="3-tas">3 Tas</option>
          <option value="dama">Dama</option>
          <option value="capraz-dama">Capraz Dama</option>
          <option value="mangala">Mangala</option>
          <option value="reversi">Reversi</option>
          <option value="xox">XOX</option>
          <option value="sos">SOS</option>
          <option value="kutu-doldurmaca">Kutu Doldurmaca</option>
          <option value="yilanlar-ve-merdivenler">Yilanlar ve Merdivenler</option>
          <option value="abalone">Abalone</option>
          <option value="satranc">Satranc</option>
          <option value="dortlu-birlestir">4lu Birlestir</option>
          <option value="mastermind">Mastermind</option>
        </select>
      </div>
      <div class="mode-actions">
        <button id="pc-room" class="primary" type="button">PC'ye Karsi</button>
        <button id="create-room" type="button">Online Oda Kur</button>
      </div>
      <form id="join-form" class="join-form">
        <input id="room-code" type="text" maxlength="6" placeholder="Oda kodu" autocomplete="off">
        <button type="submit">Katil</button>
      </form>
      <div class="open-rooms">
        <div class="open-rooms-head">
          <strong>Acik Odalar</strong>
          <button id="refresh" class="mini" type="button">Yenile</button>
        </div>
        <div id="open-list" class="open-rooms-list">Yukleniyor...</div>
      </div>
    </section>

    <section class="game-layout">
      <aside class="panel status-panel">
        <p class="label">Durum</p>
        <h2 id="room-title">Henuz oda yok</h2>
        <p id="players"></p>
        <div class="turn-card"><p class="label">Sira</p><strong id="turn"></strong></div>
        <p id="captures" class="room-info"></p>
        <p id="message" class="message">Oda kur veya acik odalardan birine katil.</p>
      </aside>

      <section class="board-wrap">
        <div class="tool-row">
          <button id="size-9" type="button">9x9</button>
          <button id="size-13" type="button">13x13</button>
          <button id="size-19" type="button">19x19</button>
          <button id="pass-btn" class="primary" type="button">Pas</button>
        </div>
        <div id="board" class="go-board" aria-label="Go tahtasi"></div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kisa Kural</h2>
        <p>Bos kesise tas koyarsin. Ozgurlugu kalmayan rakip gruplar tahtadan kalkar.</p>
        <p>Iki taraf da pas gecerse oyun biter.</p>
      </aside>
    </section>
  </main>
  <script>window.__GO_CONFIG__ = { type: 'go' };</script>
  <script src="/games/go/play/script.js?v=20260529b"></script>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.path === '/api/games') return res.json({ games: { go: { title: 'Go', players: 2, pc: true, status: 'active' } } });
  if (req.path === '/api/rooms' && req.method === 'GET') req.query = { ...req.query, type: 'go' };
  if (req.path === '/api/rooms' && req.method === 'POST') req.body = { ...(req.body || {}), type: 'go' };
  next();
});
app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});
app.use(boardGamesApp);
module.exports = app;
