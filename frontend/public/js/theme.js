(function () {
  var STORAGE_KEY = 'themePreference';
  var OPTIONS = ['system', 'light', 'dark'];
  var LABELS = {
    system: 'Tema: Sistem',
    light: 'Tema: Açık',
    dark: 'Tema: Koyu'
  };
  var ICON_CLASSES = ['theme-icon-light', 'theme-icon-dark', 'theme-icon-system'];

  var mql = window.matchMedia('(prefers-color-scheme: dark)');

  function getPreference() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      if (OPTIONS.indexOf(value) !== -1) {
        return value;
      }
    } catch (e) {
      // ignore storage errors
    }
    return 'system';
  }

  function resolveTheme(preference) {
    if (preference === 'system') {
      return mql.matches ? 'dark' : 'light';
    }
    return preference;
  }

  function applyTheme(preference) {
    var resolved = resolveTheme(preference);
    document.documentElement.setAttribute('data-theme-preference', preference);
    document.documentElement.setAttribute('data-theme', resolved);
  }

  function savePreference(preference) {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch (e) {
      // ignore storage errors
    }
  }

  function updateButtonLabel(button, preference) {
    var label = LABELS[preference] || LABELS.system;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    /* SVG ikonları göster/gizle */
    ICON_CLASSES.forEach(function(cls) {
      var el = button.querySelector('.' + cls);
      if (el) el.style.display = 'none';
    });
    var activeClass = preference === 'light' ? 'theme-icon-light'
                    : preference === 'dark'  ? 'theme-icon-dark'
                    : 'theme-icon-system';
    var activeEl = button.querySelector('.' + activeClass);
    if (activeEl) activeEl.style.display = 'block';
  }

  function getNextPreference(current) {
    var idx = OPTIONS.indexOf(current);
    if (idx === -1) {
      return 'system';
    }
    return OPTIONS[(idx + 1) % OPTIONS.length];
  }

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('theme-toggle');
    if (!button) {
      return;
    }

    var preference = getPreference();
    applyTheme(preference);
    button.setAttribute('data-js-ready', '1');
    updateButtonLabel(button, preference);

    button.addEventListener('click', function () {
      var current = getPreference();
      var next = getNextPreference(current);
      savePreference(next);
      applyTheme(next);
      updateButtonLabel(button, next);
    });

    var onSystemThemeChange = function () {
      var current = getPreference();
      if (current === 'system') {
        applyTheme('system');
        updateButtonLabel(button, 'system');
      }
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onSystemThemeChange);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(onSystemThemeChange);
    }
  });
})();
