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
  <title>Kutu Doldurmaca</title>
  <link rel="stylesheet" href="/games/kutu-doldurmaca/play/style.css?v=20260529b">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Online Masa Oyunu</p>
        <h1>Kutu Doldurmaca</h1>
        <p class="hero-text">Çizgileri sırayla kapat, kutuları topla, zincir hamlelerle oyunu çevir. PC'ye karşı ya da online odada oynanır.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara dön</a>
    </header>

    <section class="panel mode-panel">
      <div>
        <p class="label">Oyun</p>
        <select id="game-select">
          <option value="kutu-doldurmaca">Kutu Doldurmaca</option>
          <option value="kizma-birader">Kızma Birader</option>
          <option value="abalone">Abalone</option>
          <option value="yilanlar-ve-merdivenler">Yılanlar ve Merdivenler</option>
          <option value="xox">XOX</option>
          <option value="sos">SOS</option>
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
      <div>
        <p class="label">Tahta</p>
        <select id="board-preset">
          <option value="4x4">4x4</option>
          <option value="8x4">8x4</option>
          <option value="12x12">12x12</option>
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
          <span class="label">Skor</span>
          <strong id="scores">-</strong>
        </div>
        <div class="info-card">
          <span class="label">Kapanan Kutu</span>
          <strong id="closed-boxes">0 / 16</strong>
        </div>
        <p id="message" class="message">Oda kur veya açık odalardan birine katıl.</p>
      </aside>

      <section class="board-column">
        <div class="score-strip" id="score-strip"></div>
        <div class="board-wrap">
          <div class="board-topline">
            <div class="board-legend">
              <span><i class="legend x"></i> Mavi</span>
              <span><i class="legend o"></i> Turuncu</span>
            </div>
            <div class="goal-chip" id="goal-chip">16 kutudan çoğunu al</div>
          </div>
          <div id="board" class="dots-board" aria-label="Kutu Doldurmaca tahtası"></div>
        </div>
      </section>

      <aside class="panel rules-panel">
        <h2>Kısa Kural</h2>
        <p>Boş bir çizgi seçersin. O çizgi bir veya daha çok kutuyu kapatırsa kutular sana yazılır ve sıra sende kalır.</p>
        <p>Tahta dolunca en çok kutu alan kazanır.</p>
      </aside>
    </section>
  </main>
  <script>window.__DOTS_CONFIG__ = { type: 'kutu-doldurmaca' };</script>
  <script src="/games/kutu-doldurmaca/play/script.js?v=20260529b"></script>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.path === '/api/games') {
    return res.json({ games: { 'kutu-doldurmaca': { title: 'Kutu Doldurmaca', players: 2, pc: true, status: 'active' } } });
  }
  if (req.path === '/api/rooms' && req.method === 'GET') req.query = { ...req.query, type: 'kutu-doldurmaca' };
  if (req.path === '/api/rooms' && req.method === 'POST') req.body = { ...(req.body || {}), type: 'kutu-doldurmaca' };
  next();
});
app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  res.type('html').send(renderPage());
});
app.use(boardGamesApp);

module.exports = app;
