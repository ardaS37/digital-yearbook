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
  <title>9 Tas</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>9 Tas</h1>
        <p>Degirmen kur, rakibin taslarini azalt ve tahtada alan kontrolunu ele gecir.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="panel mode-panel">
      <div>
        <p class="label">Oyun</p>
        <select id="game-select">
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
          <option value="tavla">Tavla</option>
          <option value="koridor">Koridor</option>
          <option value="satranc">Satranc</option>
          <option value="dortlu-birlestir">4lu Birlestir</option>
          <option value="mastermind">Mastermind</option>
          <option value="domino">Domino</option>
          <option value="go">Go</option>
          <option value="kizma-birader">Kizma Birader</option>
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
        <div class="turn-card">
          <p class="label">Sira</p>
          <strong id="turn"></strong>
        </div>
        <p id="phase" class="room-info"></p>
        <p id="message" class="message">Oda kur veya acik odalardan birine katil.</p>
      </aside>

      <section class="board-wrap">
        <div id="board" aria-label="9 tas tahtasi"></div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kisa Kural</h2>
        <p>Once dokuz tasini yerlestir. Sonra komsu noktalara kayarak degirmenler kur.</p>
        <p>Degirmen tamamlayinca parlayan rakip taslardan birini alirsin. Rakibini iki tasa ya da hamlesiz hale dusuren kazanir.</p>
      </aside>
    </section>
  </main>
  <script>window.__MORRIS_CONFIG__ = { type: '9-tas', title: '9 Tas' };</script>
  <script src="script.js"></script>
</body>
</html>`;
}

const app = express();

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  if (req.path === '/api/games') {
    return res.json({
      games: {
        '9-tas': { title: '9 Tas', players: 2, pc: true, status: 'active' }
      }
    });
  }

  if (req.path === '/api/rooms' && req.method === 'GET') {
    req.query = { ...req.query, type: '9-tas' };
  }

  if (req.path === '/api/rooms' && req.method === 'POST') {
    req.body = { ...(req.body || {}), type: '9-tas' };
  }

  next();
});

app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});

app.use(boardGamesApp);

module.exports = app;
