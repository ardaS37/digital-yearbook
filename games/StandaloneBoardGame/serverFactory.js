const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const express = backendRequire('express');

const boardGamesApp = require(path.join(__dirname, '..', 'BoardGames', 'server'));

function renderPage(config) {
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="standalone-board-game" data-game-title="${config.title}" style="--game-accent:${config.accent};--game-accent-strong:${config.accentStrong};--game-surface:${config.surface};--game-glow:${config.glow};">
  <main class="shell standalone-shell">
    <header class="hero standalone-hero">
      <div class="hero-copy">
        <p class="eyebrow">${config.eyebrow}</p>
        <h1 id="game-title" data-default-title="${config.title}">${config.title}</h1>
        <p class="standalone-subtitle">${config.description}</p>
      </div>
      <div class="hero-actions">
        <a class="hero-link" href="/games">Oyunlara don</a>
      </div>
    </header>

    <section class="panel controls standalone-controls">
      <select id="game-select" hidden></select>
      <button id="pc-room" type="button">PC'ye Karsi</button>
      <button id="create-room" type="button">Online Oda Kur</button>
      <form id="join-form">
        <input id="room-code" maxlength="6" placeholder="Oda kodu">
        <button type="submit">Katil</button>
      </form>
      <div class="open">
        <div class="open-head">
          <strong>Acik Odalar</strong>
          <button id="refresh" class="small" type="button">Yenile</button>
        </div>
        <div id="open-list">Yukleniyor...</div>
      </div>
    </section>

    <section class="layout">
      <aside class="panel status">
        <p class="eyebrow">${config.eyebrow}</p>
        <h2 id="room-title">Henuz oda yok</h2>
        <p id="players"></p>
        <p id="turn"></p>
        <p id="message"></p>
      </aside>
      <section class="panel board-panel">
        <div id="board"></div>
      </section>
    </section>
  </main>
  <script>window.__GAME_CONFIG__ = ${safeConfig};</script>
  <script src="script.js"></script>
</body>
</html>`;
}

function createStandaloneBoardGameApp(config) {
  const app = express();

  app.use(express.json({ limit: '50kb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use((req, res, next) => {
    if (req.path === '/api/games') {
      return res.json({
        games: {
          [config.slug]: {
            title: config.title,
            players: config.players,
            pc: true,
            status: 'active'
          }
        }
      });
    }

    if (req.path === '/api/rooms' && req.method === 'GET') {
      req.query = { ...req.query, type: config.slug };
    }

    if (req.path === '/api/rooms' && req.method === 'POST') {
      req.body = { ...(req.body || {}), type: config.slug };
    }

    return next();
  });

  app.get(/^\/(?!api)(?!.*\.).*/, (req, res) => {
    if (!req.currentUser) return res.redirect('/login');
    res.type('html').send(renderPage(config));
  });

  app.use(boardGamesApp);
  return app;
}

module.exports = { createStandaloneBoardGameApp };
