(function () {
  var storageKey = 'yearbook:scroll-restore';
  var maxAgeMs = 15000;

  function currentPath() {
    return window.location.pathname + window.location.search;
  }

  function currentPathname() {
    return window.location.pathname;
  }

  function saveScrollPosition() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        path: currentPath(),
        pathname: currentPathname(),
        x: window.scrollX || 0,
        y: window.scrollY || 0,
        createdAt: Date.now()
      }));
    } catch (error) {
      // Session storage may be blocked; in that case the page keeps normal browser behavior.
    }
  }

  function restoreScrollPosition() {
    var payload;
    try {
      payload = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch (error) {
      payload = null;
    }

    if (!payload) {
      return;
    }

    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {}

    var samePage = payload.path === currentPath() || payload.pathname === currentPathname();
    if (!samePage || Date.now() - Number(payload.createdAt || 0) > maxAgeMs) {
      return;
    }

    window.requestAnimationFrame(function () {
      window.scrollTo(Number(payload.x || 0), Number(payload.y || 0));
    });
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || !form.matches || !form.matches('form')) {
      return;
    }
    if (form.hasAttribute('data-no-scroll-restore')) {
      return;
    }
    saveScrollPosition();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreScrollPosition);
  } else {
    restoreScrollPosition();
  }
})();
