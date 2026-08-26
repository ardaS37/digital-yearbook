(function () {
  function initMobileNav() {
    var button = document.getElementById('nav-toggle');
    var nav = document.getElementById('primary-nav');
    if (!button || !nav) {
      return;
    }

    function isMobile() {
      return window.innerWidth <= 700;
    }

    function openAllMenus() {
      nav.querySelectorAll('details.nav-menu').forEach(function (d) {
        d.setAttribute('open', '');
      });
    }

    function closeAllMenus() {
      nav.querySelectorAll('details.nav-menu').forEach(function (d) {
        d.removeAttribute('open');
      });
    }

    function closeNav() {
      nav.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      closeAllMenus();
    }

    button.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen && isMobile()) {
        openAllMenus();
      } else if (!isOpen) {
        closeAllMenus();
      }
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    nav.querySelectorAll('details').forEach(function (details) {
      details.addEventListener('toggle', function () {
        // Mobilde toggle'ı engelle — hepsi açık kalmalı
        if (isMobile() && nav.classList.contains('is-open')) {
          if (!details.open) {
            details.setAttribute('open', '');
          }
          return;
        }
        if (!details.open) {
          return;
        }
        nav.querySelectorAll('details[open]').forEach(function (otherDetails) {
          if (otherDetails !== details) {
            otherDetails.removeAttribute('open');
          }
        });
      });
    });

    document.addEventListener('click', function (event) {
      if (nav.contains(event.target) || button.contains(event.target)) {
        return;
      }
      nav.querySelectorAll('details[open]').forEach(function (details) {
        details.removeAttribute('open');
      });
      if (!nav.classList.contains('is-open')) {
        return;
      }
      closeNav();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
