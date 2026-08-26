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
  <title>Altı</title>
  <link rel="stylesheet" href="/games/alti/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Altı</h1>
        <p>Altıgen hücrelere taş koy. Altılı çizgi, altılı piramit veya altılı halka yapan oyuncu raundu kazanır.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel mode-panel">
      <div>
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="alti">Altı</option>
          <option value="reversi">Reversi</option>
          <option value="go">Go</option>
          <option value="abalone">Abalone</option>
          <option value="koridor">Koridor</option>
          <option value="xox">XOX</option>
          <option value="sos">SOS</option>
          <option value="9-tas">9 Taş</option>
          <option value="3-tas">3 Taş</option>
          <option value="dama">Dama</option>
          <option value="capraz-dama">Çapraz Dama</option>
          <option value="mangala">Mangala</option>
          <option value="kuyulamac">Kuyulamaç</option>
          <option value="tavla">Tavla</option>
          <option value="satranc">Satranç</option>
          <option value="dortlu-birlestir">4'lü Birleştir</option>
          <option value="mastermind">Mastermind</option>
          <option value="domino">Domino</option>
          <option value="kutu-doldurmaca">Kutu Doldurmaca</option>
          <option value="yilanlar-ve-merdivenler">Yılanlar ve Merdivenler</option>
          <option value="kizma-birader">Kızma Birader</option>
        </select>
      </div>
      <div class="mode-actions">
        <button id="pc-room" class="primary" type="button">PC'ye Karşı</button>
        <button id="create-room" type="button">Online Oda Kur</button>
      </div>
      <form id="join-form" class="join-form">
        <input id="room-code" type="text" maxlength="6" placeholder="Oda kodu" autocomplete="off">
        <button type="submit">Katıl</button>
      </form>
      <div class="open-rooms">
        <div class="open-rooms-head">
          <strong>Açık Odalar</strong>
          <button id="refresh" class="mini" type="button">Yenile</button>
        </div>
        <div id="open-list" class="open-rooms-list">Yükleniyor...</div>
      </div>
    </section>

    <section class="game-layout">
      <aside class="panel status-panel">
        <p class="label">Durum</p>
        <h2 id="room-title">Henüz oda yok</h2>
        <p id="players"></p>
        <div class="turn-card"><p class="label">Sıra</p><strong id="turn"></strong></div>
        <p id="goal" class="room-info">Kazanma şekli: 6'lı çizgi, 6'lı piramit veya 6'lı halka</p>
        <p id="message" class="message">Oda kur veya açık odalardan birine katıl.</p>
      </aside>

      <section class="board-wrap">
        <div id="board" class="alti-board" aria-label="Altı tahtası"></div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kısa Kural</h2>
        <p>Boş bir altıgene taş koyarsın.</p>
        <p>Aynı renkten 6 taşla çizgi, piramit veya halka kuran kazanır.</p>
        <p>Halka, bir merkez taşın etrafındaki altı komşu altıgenin dolmasıdır.</p>
      </aside>
    </section>
  </main>
  <script>window.__ALTI_CONFIG__ = { type: 'alti' };</script>
  <script src="/games/alti/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.path === '/api/games') return res.json({ games: { alti: { title: 'Altı', players: 2, pc: true, status: 'active' } } });
  if (req.path === '/api/rooms' && req.method === 'GET') req.query = { ...req.query, type: 'alti' };
  if (req.path === '/api/rooms' && req.method === 'POST') req.body = { ...(req.body || {}), type: 'alti' };
  next();
});
app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});
app.use(boardGamesApp);

module.exports = app;
