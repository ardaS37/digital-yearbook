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
  <title>Abalone</title>
  <link rel="stylesheet" href="/games/abalone/play/style.css?v=20260530b">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Abalone</h1>
        <p class="hero-text">Bilyeni seç, komşu yuvaya akıcı şekilde kaydır, rakibi kenardan dışarı it. PC'ye karşı ya da online odada oynanır.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel mode-panel">
      <div>
        <p class="label">Oyun</p>
        <select id="game-select">
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
          <option value="kizma-birader">Kızma Birader</option>
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
          <span class="label">Düşen Taşlar</span>
          <strong id="pushed">-</strong>
        </div>
        <div class="info-card">
          <span class="label">Seçim</span>
          <strong id="selection">Taş seç</strong>
        </div>
        <div class="dir-pad" id="dir-pad">
          <button type="button" data-dir="-1,0">Sol</button>
          <button type="button" data-dir="-1,1">Üst Sol</button>
          <button type="button" data-dir="0,-1">Üst Sağ</button>
          <button type="button" data-dir="0,1">Alt Sol</button>
          <button type="button" data-dir="1,-1">Alt Sağ</button>
          <button type="button" data-dir="1,0">Sağ</button>
        </div>
        <p id="message" class="message">Oda kur veya açık odalardan birine katıl.</p>
        <button id="clear-selection" class="wide soft" type="button">Seçimi Temizle</button>
      </aside>

      <section class="board-column">
        <div class="marble-bar" id="marble-bar"></div>
        <div class="board-wrap">
          <div class="board-topline">
            <div class="board-legend">
              <span><i class="legend x"></i> Senin tarafın</span>
              <span><i class="legend o"></i> Rakip taraf</span>
            </div>
            <div class="edge-goal">Hedef: 6 taş düşür</div>
          </div>
          <div id="board" class="abalone-board" aria-label="Abalone tahtası"></div>
        </div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kısa Kural</h2>
        <p>1, 2 veya 3 bilyeyi aynı hizada seçip yön tuşuyla kaydır.</p>
        <p>Güçlü grup rakip bilyeleri iter. Dışarı düşen 6 rakip bilye oyunu bitirir.</p>
      </aside>
    </section>
  </main>
  <script>window.__ABALONE_CONFIG__ = { type: 'abalone' };</script>
  <script src="/games/abalone/play/script.js?v=20260530b"></script>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.path === '/api/games') {
    return res.json({ games: { abalone: { title: 'Abalone', players: 2, pc: true, status: 'active' } } });
  }
  if (req.path === '/api/rooms' && req.method === 'GET') req.query = { ...req.query, type: 'abalone' };
  if (req.path === '/api/rooms' && req.method === 'POST') req.body = { ...(req.body || {}), type: 'abalone' };
  next();
});
app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});
app.use(boardGamesApp);

module.exports = app;
