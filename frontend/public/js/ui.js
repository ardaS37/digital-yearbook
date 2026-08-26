(function () {
  'use strict';

  /* ── Flash mesaj otomatik kapanma ── */
  function initFlashDismiss() {
    var flash = document.querySelector('.floating-flash');
    if (!flash) return;
    var delay = 4000;
    var timer = setTimeout(function () {
      flash.classList.add('flash-hiding');
      flash.addEventListener('animationend', function () {
        flash.style.display = 'none';
      }, { once: true });
    }, delay);
    flash.addEventListener('click', function () {
      clearTimeout(timer);
      flash.classList.add('flash-hiding');
      flash.addEventListener('animationend', function () {
        flash.style.display = 'none';
      }, { once: true });
    });
    flash.title = 'Kapatmak için tıkla';
    flash.style.cursor = 'pointer';
  }

  /* ── Scroll to top butonu ── */
  function initScrollTop() {
    var btn = document.getElementById('scroll-top-btn');
    if (!btn) return;
    var threshold = 320;
    function onScroll() {
      if (window.scrollY > threshold) {
        btn.classList.add('is-visible');
      } else {
        btn.classList.remove('is-visible');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    onScroll();
  }

  /* ── Avatar baş harfleri placeholder ── */
  var PALETTE = [
    '#1a7a6e', '#2e5fa3', '#7b3fa0', '#c0392b',
    '#d68910', '#117a65', '#1f618d', '#884ea0',
    '#b03a2e', '#1e8449', '#6e2fa0', '#2471a3'
  ];

  function nameToColor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  function getInitials(name) {
    var parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }

  function replaceWithInitials(img) {
    var name = img.getAttribute('alt') || '';
    var initials = getInitials(name);
    var color = nameToColor(name);
    var size = img.offsetWidth || img.width || 48;
    var fontSize = Math.round(size * 0.38);
    var div = document.createElement('div');
    div.className = 'avatar-initials ' + (img.className || '');
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    div.style.fontSize = fontSize + 'px';
    div.style.background = color;
    div.setAttribute('aria-label', name);
    div.textContent = initials;
    if (img.parentNode) {
      img.parentNode.replaceChild(div, img);
    }
  }

  function initAvatarInitials() {
    document.querySelectorAll('img[src*="default-avatar"]').forEach(function (img) {
      if (img.complete) {
        replaceWithInitials(img);
      } else {
        img.addEventListener('load', function () { replaceWithInitials(img); }, { once: true });
        img.addEventListener('error', function () { replaceWithInitials(img); }, { once: true });
      }
    });
    document.querySelectorAll('img.profile-photo, img.message-author-photo').forEach(function (img) {
      img.addEventListener('error', function () { replaceWithInitials(img); }, { once: true });
    });
  }

  /* ── Admin sekme geçişi ── */
  function initAdminTabs() {
    document.querySelectorAll('.admin-tab-nav').forEach(function (nav) {
      var buttons = nav.querySelectorAll('.admin-tab-btn');
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tabId = btn.getAttribute('data-tab');
          buttons.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          var container = nav.closest('.admin-tabs');
          if (!container) return;
          container.querySelectorAll('.admin-tab-panel').forEach(function (panel) {
            panel.hidden = panel.id !== 'admin-tab-' + tabId;
          });
        });
      });
    });
  }

  /* ── Init ── */
  function init() {
    initFlashDismiss();
    initScrollTop();
    initAvatarInitials();
    initAdminTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
