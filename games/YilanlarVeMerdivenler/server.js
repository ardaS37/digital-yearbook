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
  <title>Yılanlar ve Merdivenler</title>
  <link rel="stylesheet" href="/games/yilanlar-ve-merdivenler/play/style.css?v=20260529b">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Yılanlar ve Merdivenler</h1>
        <p class="hero-text">Zarı at, sıranı takip et, merdivenle tırman ve yılandan kaç. PC'ye karşı ya da 4 kişilik odada oynanır.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel mode-panel">
      <div class="mode-select">
        <p class="label">Oyun</p>
        <select id="game-select">
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
          <option value="abalone">Abalone</option>
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
        <div class="turn-card">
          <p class="label">Sıra</p>
          <strong id="turn">-</strong>
        </div>
        <div class="dice-card">
          <span class="label">Son Zar</span>
          <strong id="last-roll">-</strong>
        </div>
        <div class="dice-card">
          <span class="label">Lider</span>
          <strong id="leader">-</strong>
        </div>
        <p id="message" class="message">Oda kur veya açık odalardan birine katıl.</p>
        <button id="roll-btn" class="wide" type="button">Zar At</button>
      </aside>

      <section class="board-column">
        <div class="player-strip" id="player-strip"></div>
        <div class="board-wrap">
          <div class="board-topline">
            <div class="board-legend">
              <span><i class="legend ladder"></i> Merdiven</span>
              <span><i class="legend snake"></i> Yılan</span>
            </div>
            <div class="finish-chip">Bitiş: 30</div>
          </div>
          <div class="board-frame">
            <div id="start-bay" class="start-bay" aria-label="Başlangıç alanı"></div>
            <div id="board" class="snake-board" aria-label="Yılanlar ve Merdivenler tahtası"></div>
          </div>
        </div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kısa Kural</h2>
        <p>Her tur yalnızca bir kez zar atılır. Piyon yeni kareye gider, sonra o karede merdiven veya yılan varsa otomatik taşınır.</p>
        <p>30. kareye ilk ulaşan oyuncu kazanır. PC masasında eksik yerler botlarla dolar.</p>
      </aside>
    </section>
  </main>
  <script>window.__SNAKES_CONFIG__ = { type: 'yilanlar-ve-merdivenler' };</script>
  <script src="/games/yilanlar-ve-merdivenler/play/script.js?v=20260529b"></script>
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
        'yilanlar-ve-merdivenler': { title: 'Yılanlar ve Merdivenler', players: 4, pc: true, status: 'active' }
      }
    });
  }
  if (req.path === '/api/rooms' && req.method === 'GET') req.query = { ...req.query, type: 'yilanlar-ve-merdivenler' };
  if (req.path === '/api/rooms' && req.method === 'POST') req.body = { ...(req.body || {}), type: 'yilanlar-ve-merdivenler' };
  next();
});
app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});
app.use(boardGamesApp);

module.exports = app;
