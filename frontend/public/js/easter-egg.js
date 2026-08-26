(function () {
  var sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var position = 0;
  var active = false;
  var overlay = null;
  var spawnTimer = null;
  var stopTimer = null;
  var cleanupTimer = null;

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createOverlay() {
    if (overlay) {
      return overlay;
    }
    overlay = document.createElement('div');
    overlay.className = 'graduation-overlay';

    document.body.appendChild(overlay);
    return overlay;
  }

  function spawnParticle() {
    if (!overlay) {
      return;
    }

    var variants = [
      { className: 'cap', text: '🎓' },
      { className: 'star', text: '⭐' },
      { className: 'paper', text: '' },
      { className: 'confetti confetti-a', text: '' },
      { className: 'confetti confetti-b', text: '' },
      { className: 'confetti confetti-c', text: '' },
      { className: 'confetti confetti-d', text: '' },
      { className: 'confetti confetti-e', text: '' }
    ];
    var choice = variants[Math.floor(Math.random() * variants.length)];
    var particle = document.createElement('div');
    particle.className = 'graduation-particle ' + choice.className;
    if (choice.text) {
      particle.textContent = choice.text;
    }

    particle.style.left = randomBetween(0, 100) + 'vw';
    particle.style.animationDuration = randomBetween(4.4, 8.8) + 's';
    particle.style.setProperty('--drift', randomBetween(-120, 120).toFixed(0) + 'px');
    particle.style.setProperty('--spin', randomBetween(180, 900).toFixed(0) + 'deg');
    particle.style.opacity = String(randomBetween(0.75, 1));

    overlay.appendChild(particle);
    particle.addEventListener('animationend', function () {
      particle.remove();
    });
  }

  function stopGraduationMode() {
    window.clearInterval(spawnTimer);
    window.clearTimeout(stopTimer);
    window.clearTimeout(cleanupTimer);
    spawnTimer = null;
    stopTimer = null;
    cleanupTimer = null;
    document.body.classList.remove('graduation-mode');
    active = false;
    cleanupTimer = window.setTimeout(function () {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }, 1200);
  }

  function startGraduationMode() {
    if (active || !document.body) {
      return;
    }

    active = true;
    document.body.classList.add('graduation-mode');
    createOverlay();

    for (var i = 0; i < 36; i += 1) {
      window.setTimeout(spawnParticle, i * 55);
    }

    spawnTimer = window.setInterval(function () {
      var burst = Math.random() > 0.65 ? 3 : 2;
      for (var i = 0; i < burst; i += 1) {
        spawnParticle();
      }
    }, 160);

    stopTimer = window.setTimeout(stopGraduationMode, 10000);
  }

  function handleKeydown(event) {
    var key = String(event.key || '');
    var normalized = key.length === 1 ? key.toLowerCase() : key;

    if (normalized === sequence[position]) {
      position += 1;
      if (position === sequence.length) {
        position = 0;
        startGraduationMode();
      }
      return;
    }

    position = normalized === sequence[0] ? 1 : 0;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      document.addEventListener('keydown', handleKeydown);
    });
  } else {
    document.addEventListener('keydown', handleKeydown);
  }
})();
