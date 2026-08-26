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
  <title>Kızma Birader</title>
  <link rel="stylesheet" href="/games/kizma-birader/play/style.css?v=20260529a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Kızma Birader</h1>
        <p class="hero-text">Piyonunu evden çıkar, turu tamamla ve bitişe sok. PC'ye karşı ya da 4 kişilik odada oynanır.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel mode-panel">
      <div>
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="kizma-birader">Kızma Birader</option>
          <option value="abalone">Abalone</option>
          <option value="yilanlar-ve-merdivenler">Yılanlar ve Merdivenler</option>
          <option value="xox">XOX</option>
          <option value="sos">SOS</option>
          <option value="kutu-doldurmaca">Kutu Doldurmaca</option>
          <option value="9-tas">9 Taş</option>
          <option value="3-tas">3 Taş</option>
          <option value="dama">Dama</option>
          <option value="capraz-dama">Çapraz Dama</option>
          <option value="mangala">Mangala</option>
          <option value="kuyulamac">Kuyulamaç</option>
          <option value="tavla">Tavla</option>
          <option value="koridor">Koridor</option>
          <option value="satranc">Satranç</option>
          <option value="dortlu-birlestir">4'lü Birleştir</option>
          <option value="mastermind">Mastermind</option>
          <option value="domino">Domino</option>
          <option value="go">Go</option>
        </select>
      </div>
      <div class="mode-actions">
        <button id="pc-room" class="primary" type="button">PC Masası</button>
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
        <p id="players" class="players"></p>
        <div class="info-card">
          <span class="label">Sıra</span>
          <strong id="turn">-</strong>
        </div>
        <div class="info-card">
          <span class="label">Son Zar</span>
          <strong id="last-roll">-</strong>
        </div>
        <div class="info-card">
          <span class="label">Bitişler</span>
          <strong id="finished">-</strong>
        </div>
        <p id="message" class="message">Oda kur veya açık odalardan birine katıl.</p>
        <button id="roll-home" class="wide soft" type="button">Evdeki Piyonu Oyna</button>
      </aside>

      <section class="board-column">
        <div class="player-strip" id="player-strip"></div>
        <div class="board-wrap">
          <div class="board-topline">
            <div class="board-legend">
              <span><i class="legend x"></i> Yeşil</span>
              <span><i class="legend o"></i> Mor</span>
              <span><i class="legend a"></i> Turuncu</span>
              <span><i class="legend b"></i> Kırmızı</span>
            </div>
            <div class="goal-chip">Hedef: 4 piyon bitir</div>
          </div>
          <div id="board" class="ludo-board" aria-label="Kızma Birader tahtası"></div>
        </div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kısa Kural</h2>
        <p>Bu sürümde hangi piyonu oynayacağını sen seçersin, zar ise seçtiğin anda otomatik atılır.</p>
        <p>6 gelmeden evden çıkılmaz. 6 gelirse sıra sende kalır. Rakibin üstüne inersen onu eve gönderirsin.</p>
      </aside>
    </section>
  </main>
  <script>window.__LUDO_CONFIG__ = { type: 'kizma-birader' };</script>
  <script src="/games/kizma-birader/play/script.js?v=20260529a"></script>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.path === '/api/games') {
    return res.json({ games: { 'kizma-birader': { title: 'Kızma Birader', players: 4, pc: true, status: 'active' } } });
  }
  if (req.path === '/api/rooms' && req.method === 'GET') req.query = { ...req.query, type: 'kizma-birader' };
  if (req.path === '/api/rooms' && req.method === 'POST') req.body = { ...(req.body || {}), type: 'kizma-birader' };
  next();
});
app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});
app.use(boardGamesApp);

module.exports = app;
