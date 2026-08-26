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
  <title>Kakuro</title>
  <link rel="stylesheet" href="/games/kakuro/play/style.css?v=20260530a">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Tek Kisilik Sayi Bulmacasi</p>
        <h1>Kakuro</h1>
        <p>Toplam ipuclarina gore kutulari doldur. Her yatay ve dikey grupta 1-9 arasi rakamlar tekrar etmeden kullanilir.</p>
      </div>
      <a class="ghost-link" href="/games">Oyunlara don</a>
    </header>

    <section class="control-panel">
      <div class="difficulty-box">
        <span class="label">Bulmaca</span>
        <select id="puzzle-select"></select>
      </div>
      <div class="actions">
        <button id="restart-btn" class="primary" type="button">Bastan</button>
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
        <p class="hint-text">Siyah kutular ipucu verir. Beyaz kutulara 1-9 arasinda rakam yazilir. Bir ipucu grubunda ayni rakam tekrar edemez.</p>
      </aside>
    </section>
  </main>
  <script src="/games/kakuro/play/script.js?v=20260530a"></script>
</body>
</html>`;
}

app.get('/', requireYearbookUser, (req, res) => {
  res.type('html').send(renderPage());
});

module.exports = app;
