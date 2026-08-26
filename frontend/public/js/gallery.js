(function () {
  function postJson(url) {
    try {
      var csrfToken = document.body ? document.body.getAttribute('data-csrf-token') : '';
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'x-csrf-token': csrfToken || ''
        }
      }).catch(function () {});
    } catch (e) {
      // ignore
    }
  }

  function initGalleryModal() {
    var modal = document.getElementById('gallery-modal');
    if (!modal) {
      return;
    }

    var modalImage = document.getElementById('gallery-modal-image');
    var captionBox = document.getElementById('gallery-modal-caption');
    var downloadLink = document.getElementById('gallery-download-link');
    var commentsBox = document.getElementById('gallery-modal-comments');
    var modalPrev = document.getElementById('gallery-modal-prev');
    var modalNext = document.getElementById('gallery-modal-next');
    var previews = document.querySelectorAll('.gallery-preview');
    var activePreview = null;
    var activeCollagePreviews = [];
    var activeCollageIndex = 0;

    if (!modalImage || !captionBox || !downloadLink || !commentsBox || !previews.length) {
      return;
    }

    /* Modal'ı body'e taşı — main-content'in transform stacking context'inden çıkar */
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }

    function closeModal() {
      modal.hidden = true;
      modalImage.src = '';
      captionBox.textContent = '';
      captionBox.hidden = true;
      downloadLink.href = '#';
      commentsBox.innerHTML = '';
      activePreview = null;
      activeCollagePreviews = [];
      activeCollageIndex = 0;
      if (modalPrev) {
        modalPrev.hidden = true;
      }
      if (modalNext) {
        modalNext.hidden = true;
      }
    }

    function showToast(message, isError) {
      var toast = document.createElement('div');
      toast.className = 'floating-toast' + (isError ? ' error' : ' success');
      toast.textContent = message;
      document.body.appendChild(toast);
      window.setTimeout(function () {
        toast.classList.add('is-visible');
      }, 10);
      window.setTimeout(function () {
        toast.classList.remove('is-visible');
        window.setTimeout(function () {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 180);
      }, 2200);
    }

    function buildPreviewSelector(preview) {
      var groupId = preview.getAttribute('data-collage-group');
      if (groupId) {
        return '.gallery-preview[data-collage-group="' + groupId + '"][data-collage-index="' + (preview.getAttribute('data-collage-index') || '0') + '"]';
      }
      var photoId = preview.getAttribute('data-photo-id');
      return photoId ? '.gallery-preview[data-photo-id="' + photoId + '"]' : '';
    }

    function refreshModalState() {
      if (!activePreview) {
        return Promise.resolve();
      }

      var selector = buildPreviewSelector(activePreview);
      if (!selector) {
        return Promise.resolve();
      }

      return fetch(window.location.href, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (response) { return response.text(); })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var nextPreview = doc.querySelector(selector);
          var currentPreview = document.querySelector(selector);
          if (!nextPreview || !currentPreview) {
            return;
          }

          ['data-full-image', 'data-photo-id', 'data-comments-ref', 'data-caption', 'data-download-name', 'data-collage-group', 'data-collage-index'].forEach(function (attr) {
            var value = nextPreview.getAttribute(attr);
            if (value == null) {
              currentPreview.removeAttribute(attr);
            } else {
              currentPreview.setAttribute(attr, value);
            }
          });

          var commentsRef = currentPreview.getAttribute('data-comments-ref');
          if (commentsRef) {
            var nextTemplate = doc.getElementById('comments-' + commentsRef);
            var currentTemplate = document.getElementById('comments-' + commentsRef);
            if (nextTemplate && currentTemplate) {
              currentTemplate.innerHTML = nextTemplate.innerHTML;
            }
          }

          activePreview = currentPreview;
          openModalFromPreview(currentPreview, { skipViewCount: true });
        });
    }

    function syncModalNav() {
      var showNav = activeCollagePreviews.length > 1;
      if (modalPrev) {
        modalPrev.hidden = !showNav;
      }
      if (modalNext) {
        modalNext.hidden = !showNav;
      }
    }

    function openModalFromPreview(preview, options) {
      var settings = options || {};
      activePreview = preview;
      modalImage.src = preview.getAttribute('data-full-image') || preview.src;
      var caption = preview.getAttribute('data-caption');
      if (caption) {
        captionBox.textContent = caption;
        captionBox.hidden = false;
      } else {
        captionBox.textContent = '';
        captionBox.hidden = true;
      }
      downloadLink.href = modalImage.src;
      var downloadName = preview.getAttribute('data-download-name');
      if (downloadName) {
        downloadLink.setAttribute('download', downloadName);
      } else {
        downloadLink.removeAttribute('download');
      }
      var photoId = preview.getAttribute('data-photo-id');
      if (photoId && !settings.skipViewCount) {
        postJson('/media/photos/' + photoId + '/view');
      }
      var commentsRef = preview.getAttribute('data-comments-ref');
      if (commentsRef) {
        var template = document.getElementById('comments-' + commentsRef);
        commentsBox.innerHTML = template ? template.innerHTML : '<p class="subtle">Yorum bulunamadı.</p>';
      } else {
        commentsBox.innerHTML = '<p class="subtle">Yorum bulunamadı.</p>';
      }
      var collageGroup = preview.getAttribute('data-collage-group');
      if (collageGroup) {
        activeCollagePreviews = Array.prototype.slice.call(
          document.querySelectorAll('.gallery-preview[data-collage-group="' + collageGroup + '"]')
        ).sort(function (a, b) {
          return Number(a.getAttribute('data-collage-index') || 0) - Number(b.getAttribute('data-collage-index') || 0);
        });
        activeCollageIndex = activeCollagePreviews.findIndex(function (item) {
          return item === preview;
        });
      } else {
        activeCollagePreviews = [];
        activeCollageIndex = 0;
      }
      syncModalNav();
      modal.hidden = false;
    }

    function stepCollageModal(direction) {
      if (activeCollagePreviews.length < 2) {
        return;
      }
      activeCollageIndex += direction;
      if (activeCollageIndex < 0) {
        activeCollageIndex = activeCollagePreviews.length - 1;
      } else if (activeCollageIndex >= activeCollagePreviews.length) {
        activeCollageIndex = 0;
      }
      openModalFromPreview(activeCollagePreviews[activeCollageIndex]);
    }

    previews.forEach(function (img) {
      img.addEventListener('click', function () {
        openModalFromPreview(img);
      });
    });

    if (modalPrev) {
      modalPrev.addEventListener('click', function () {
        stepCollageModal(-1);
      });
    }

    if (modalNext) {
      modalNext.addEventListener('click', function () {
        stepCollageModal(1);
      });
    }

    modalImage.addEventListener('click', function () {
      stepCollageModal(1);
    });

    modal.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.getAttribute('data-close-modal') === 'yes') {
        closeModal();
      }
    });

    commentsBox.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || form.tagName !== 'FORM') {
        return;
      }
      event.preventDefault();

      var formData = new FormData(form);
      var params = new URLSearchParams();
      formData.forEach(function (value, key) {
        params.append(key, value);
      });
      var csrfToken = formData.get('_csrf') || (document.body ? document.body.getAttribute('data-csrf-token') : '');
      fetch(form.action, {
        method: String(form.method || 'POST').toUpperCase(),
        body: params,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'x-csrf-token': csrfToken || ''
        }
      })
        .then(function (response) {
          return response.json().catch(function () {
            return { ok: false, message: 'İşlem tamamlanamadı.' };
          }).then(function (payload) {
            return { ok: response.ok, status: response.status, payload: payload };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            if (result.payload && result.payload.redirectTo) {
              window.location.href = result.payload.redirectTo;
              return;
            }
            showToast((result.payload && result.payload.message) || 'İşlem tamamlanamadı.', true);
            return;
          }

          showToast(result.payload.message || 'Kaydedildi.', false);
          refreshModalState();
        })
        .catch(function () {
          showToast('İşlem tamamlanamadı.', true);
        });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) {
        closeModal();
        return;
      }
      if (modal.hidden) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        stepCollageModal(-1);
      } else if (event.key === 'ArrowRight') {
        stepCollageModal(1);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGalleryModal);
  } else {
    initGalleryModal();
  }
})();

(function () {
  function initCollageCarousel() {
    var collageCards = document.querySelectorAll('.collage-card');
    if (!collageCards.length) {
      return;
    }

    function setActiveImage(card, nextIndex) {
      var images = card.querySelectorAll('.collage-image');
      if (!images.length) {
        return;
      }

      var max = images.length - 1;
      var index = nextIndex;
      if (index < 0) {
        index = max;
      } else if (index > max) {
        index = 0;
      }

      images.forEach(function (img, idx) {
        if (idx === index) {
          img.classList.add('is-active');
        } else {
          img.classList.remove('is-active');
        }
      });
    }

    collageCards.forEach(function (card) {
      var prev = card.querySelector('[data-collage-prev]');
      var next = card.querySelector('[data-collage-next]');
      var images = card.querySelectorAll('.collage-image');

      function getCurrentIndex() {
        var active = card.querySelector('.collage-image.is-active');
        if (!active) {
          return 0;
        }
        return Number(active.getAttribute('data-collage-index') || 0);
      }

      if (prev) {
        prev.addEventListener('click', function () {
          setActiveImage(card, getCurrentIndex() - 1);
        });
      }

      if (next) {
        next.addEventListener('click', function () {
          setActiveImage(card, getCurrentIndex() + 1);
        });
      }

      images.forEach(function (image) {
        image.addEventListener('click', function () {
          setActiveImage(card, getCurrentIndex() + 1);
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollageCarousel);
  } else {
    initCollageCarousel();
  }
})();

(function () {
  function initTabs() {
    var buttons = document.querySelectorAll('[data-tab-target]');
    if (!buttons.length) {
      return;
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var target = button.getAttribute('data-tab-target');
        document.querySelectorAll('[data-tab-target]').forEach(function (item) {
          item.classList.toggle('is-active', item === button);
        });
        document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
          panel.classList.toggle('is-active', panel.getAttribute('data-tab-panel') === target);
        });
      });
    });
  }

  function initLiveSearch() {
    var input = document.querySelector('[data-live-search-input="students"]');
    var results = document.querySelector('[data-live-search-results]');
    if (!input || !results) {
      return;
    }

    var lastQuery = '';
    input.addEventListener('input', function () {
      var query = input.value.trim();
      if (query.length < 2) {
        results.innerHTML = '';
        return;
      }
      lastQuery = query;
      fetch('/search/suggestions?q=' + encodeURIComponent(query), { credentials: 'same-origin' })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (lastQuery !== query) {
            return;
          }
          var suggestions = data && data.suggestions ? data.suggestions : [];
          if (!suggestions.length) {
            results.innerHTML = '<p class="subtle">Canli oneride sonuc yok.</p>';
            return;
          }
          results.innerHTML = suggestions.map(function (item) {
            var subtitle = [item.studentNumber, item.classBranch, item.role].filter(Boolean).join(' - ');
            return '<a class="suggestion-card" href="/profiles/' + item.id + '"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(subtitle) + '</span></a>';
          }).join('');
        })
        .catch(function () {
          results.innerHTML = '';
        });
    });
  }

  function initSortableList() {
    var list = document.querySelector('[data-sortable-list]');
    var hiddenInput = document.getElementById('album-photo-order');
    var form = document.getElementById('album-order-form');
    if (!list || !hiddenInput || !form) {
      return;
    }

    var draggedItem = null;

    function updateOrder() {
      var ids = Array.prototype.map.call(list.querySelectorAll('[data-photo-id]'), function (item) {
        return item.getAttribute('data-photo-id');
      });
      hiddenInput.value = ids.join(',');
    }

    list.querySelectorAll('.sortable-item').forEach(function (item) {
      item.addEventListener('dragstart', function () {
        draggedItem = item;
        item.classList.add('is-dragging');
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('is-dragging');
        updateOrder();
      });
      item.addEventListener('dragover', function (event) {
        event.preventDefault();
        if (!draggedItem || draggedItem === item) {
          return;
        }
        var rect = item.getBoundingClientRect();
        var before = event.clientY < rect.top + rect.height / 2;
        if (before) {
          list.insertBefore(draggedItem, item);
        } else {
          list.insertBefore(draggedItem, item.nextSibling);
        }
      });
    });

    form.addEventListener('submit', updateOrder);
    updateOrder();
  }

  function initPhotoSelectionForms() {
    var selectionInputs = document.querySelectorAll('[data-select-photo="yes"]');
    var collageInputs = document.querySelectorAll('[data-select-collage="yes"]');
    if (!selectionInputs.length && !collageInputs.length) {
      return;
    }

    var docks = document.querySelectorAll('[data-selection-dock]');

    function updateDockState() {
      var checked = Array.prototype.filter.call(selectionInputs, function (input) {
        return input.checked;
      });
      var checkedCollages = Array.prototype.filter.call(collageInputs, function (input) {
        return input.checked;
      });
      var total = checked.length + checkedCollages.length;
      docks.forEach(function (dock) {
        dock.hidden = total === 0;
        dock.querySelectorAll('[data-selection-count]').forEach(function (node) {
          node.textContent = String(total);
        });
      });
      return {
        checked: checked,
        checkedCollages: checkedCollages
      };
    }

    Array.prototype.forEach.call(selectionInputs, function (input) {
      input.addEventListener('change', updateDockState);
    });
    Array.prototype.forEach.call(collageInputs, function (input) {
      input.addEventListener('change', updateDockState);
    });

    ['album-assign-form', 'collage-selection-form'].forEach(function (formId) {
      var form = document.getElementById(formId);
      if (!form) {
        return;
      }
      form.addEventListener('submit', function (event) {
        var container = form.querySelector('[data-selected-photo-container]');
        if (!container) {
          return;
        }
        container.innerHTML = '';
        var state = updateDockState();
        var checked = state.checked;
        var checkedCollages = state.checkedCollages;
        if (!checked.length && !checkedCollages.length) {
          event.preventDefault();
          window.alert('Lutfen en az bir fotograf secin.');
          return;
        }
        checked.forEach(function (input) {
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'photo_ids';
          hidden.value = input.value;
          container.appendChild(hidden);
        });
        checkedCollages.forEach(function (input) {
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'group_ids';
          hidden.value = input.value;
          container.appendChild(hidden);
        });
      });
    });

    updateDockState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initTabs();
      initLiveSearch();
      initSortableList();
      initPhotoSelectionForms();
    });
  } else {
    initTabs();
    initLiveSearch();
    initSortableList();
    initPhotoSelectionForms();
  }
})();
    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
