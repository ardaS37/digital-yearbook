/* Background MIDI player — SF2 instrument (SpessaSynth Sequencer) / oscillator */
(function (global) {
  'use strict';

  var BGM = {
    /* ── ortak durum ─────────────────────────────── */
    _mode: 'instrument',   // 'instrument' | 'oscillator'
    _pool: [],
    _playing: false,
    _loopId: null,

    /* ── SF2 modu (SpessaSynth) ──────────────────── */
    _synth: null,
    _synthCtx: null,
    _synthReady: false,
    _initPromise: null,
    _seq: null,          // SpessaSynth Sequencer
    _midiBuffer: null,   // raw ArrayBuffer (Sequencer için saklanır)

    /* ── Osilatör modu (WebAudio) ────────────────── */
    _actx: null,
    _master: null,
    _oscNodes: [],
    _timers: [],

    /* ── Ortak MIDI verisi ───────────────────────── */
    _noteEvents: null,   // osilatör için + yüklendi bayrağı
    _duration: 0,        // ms cinsinden toplam süre

    /* ─────────────────────────────────────────────── */

    init: function (cb) { if (cb) cb(true); },

    /* İlk SF2 yüklemesi için bilgi toastı — yalnızca SF2 daha önce hiç indirilmemişse */
    _showLoading: function () {
      /* SF2 zaten cachelenmişse veya müzik kapalıysa gösterme */
      var alreadyCached = false;
      try { alreadyCached = !!localStorage.getItem('bgmSF2Cached'); } catch (e) {}
      if (alreadyCached) return;
      if (BGM._mode !== 'instrument') return;
      if (document.getElementById('bgm-toast')) return;
      var d = document.createElement('div');
      d.id = 'bgm-toast';
      d.innerHTML = '🎹 Müzik ilk kez yükleniyor, biraz sürebilir…';
      d.style.cssText = [
        'position:fixed', 'bottom:1.2rem', 'right:1.2rem',
        'padding:0.55rem 1rem', 'border-radius:12px',
        'background:var(--surface,#fff)', 'border:1px solid var(--line,#ccc)',
        'font-size:0.82rem', 'color:var(--ink,#222)',
        'box-shadow:0 4px 18px rgba(0,0,0,.14)',
        'z-index:9999', 'opacity:0', 'transition:opacity .3s'
      ].join(';');
      document.body.appendChild(d);
      requestAnimationFrame(function () { d.style.opacity = '1'; });
    },
    _hideLoading: function () {
      var d = document.getElementById('bgm-toast');
      if (!d) return;
      d.style.opacity = '0';
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 350);
    },

    /* SF2 sentezleyicisini async başlat (bir kez) */
    initSynth: function () {
      if (BGM._mode !== 'instrument') return Promise.resolve();
      if (BGM._synthReady) return Promise.resolve();
      if (BGM._initPromise) return BGM._initPromise;

      BGM._initPromise = (async function () {
        BGM._showLoading();
        try {
          console.log('[BGM] SpessaSynth başlatılıyor…');

          /* footer <script type="module"> önceden yüklemiş olabilir */
          var mod = window._SpessaSynthModule;
          if (!mod) {
            console.log('[BGM] import() deneniyor…');
            mod = await import('/public/js/spessasynth/index.js');
            window._SpessaSynthModule = mod;
            window._SpessaSynthClass = mod.WorkletSynthesizer;
          }
          var WorkletSynthesizer = mod.WorkletSynthesizer;
          var Sequencer = mod.Sequencer;

          console.log('[BGM] AudioContext oluşturuluyor…');
          var ctx = new (window.AudioContext || window.webkitAudioContext)();
          console.log('[BGM] AudioContext state:', ctx.state);
          await ctx.audioWorklet.addModule('/public/js/spessasynth/processor.min.js');
          console.log('[BGM] AudioWorklet yüklendi…');

          var synth = new WorkletSynthesizer(ctx);
          synth.connect(ctx.destination);

          /* Worklet'in SF3 decoder'ı hazır olana kadar bekle (maks 10s) */
          console.log('[BGM] Worklet hazır bekleniyor…');
          var workletReady = await Promise.race([
            synth.isReady.then(function () { return true; }),
            new Promise(function (res) { setTimeout(function () { res(false); }, 10000); })
          ]);
          if (!workletReady) throw new Error('SpessaSynth worklet zaman aşımı (isReady)');
          console.log('[BGM] Worklet hazır!');

          console.log('[BGM] SF2 yükleniyor…');
          var sfRes = await fetch('/public/audio/sf.sf2');
          console.log('[BGM] SF2 yanıtı:', sfRes.status);
          var sfBuf = await sfRes.arrayBuffer();
          console.log('[BGM] SF2 alındı:', sfBuf.byteLength, 'byte');

          /* Soundbank yükle (maks 20s) */
          var bankLoaded = await Promise.race([
            synth.soundBankManager.addSoundBank(sfBuf, 'main').then(function () { return true; }),
            new Promise(function (res) { setTimeout(function () { res(false); }, 20000); })
          ]);
          if (!bankLoaded) throw new Error('SpessaSynth addSoundBank zaman aşımı');
          console.log('[BGM] addSoundBank bitti…');

          /* Sequencer oluştur */
          var seq = new Sequencer(synth);
          seq.eventHandler.addEvent('songEnded', 'bgm', function () {
            if (BGM._playing) BGM._playNext();
          });

          BGM._synth = synth;
          BGM._synthCtx = ctx;
          BGM._seq = seq;
          BGM._synthReady = true;
          try { localStorage.setItem('bgmSF2Cached', '1'); } catch (e) {}
          BGM._hideLoading();
          console.log('[BGM] SpessaSynth + Sequencer hazır!');
        } catch (e) {
          BGM._hideLoading();
          console.error('[BGM] SpessaSynth init hatası, osilatöre düşülüyor:', e);
          BGM._initPromise = null;
          BGM._mode = 'oscillator';
        }
      })();

      return BGM._initPromise;
    },

    /* MIDI dosyasını yükle ve parse et */
    load: function (url, cb) {
      if (BGM._midiBuffer || BGM._noteEvents) { if (cb) cb(true); return; }
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error('not_found');
        return r.arrayBuffer();
      }).then(function (buf) {
        BGM._midiBuffer = buf;
        /* Parser'ı osilatör + süre hesabı için çalıştır */
        BGM._prepare(BGM._parseMidi(buf));
        if (cb) cb(true);
      }).catch(function () { if (cb) cb(false); });
    },

    _parseMidi: function (buffer) {
      var dv = new DataView(buffer), pos = 0;
      function rn(n) { var v = 0; for (var i = 0; i < n; i++) v = (v << 8) | dv.getUint8(pos++); return v; }
      function vl() { var v = 0, b; do { b = dv.getUint8(pos++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; }

      rn(4); rn(4); rn(2);
      var ntracks = rn(2), tpb = rn(2);
      var tracks = [];
      for (var t = 0; t < ntracks; t++) {
        rn(4); var tlen = rn(4), tend = pos + tlen;
        var evs = [], tick = 0, status = 0;
        while (pos < tend) {
          try {
            var dt = vl(); tick += dt;
            var b = dv.getUint8(pos);
            if (b & 0x80) { status = b; pos++; }
            var hi = status & 0xf0;
            if (status === 0xff) {
              var mt = dv.getUint8(pos++), ml = vl();
              if (mt === 0x51 && ml === 3) {
                var tp = (dv.getUint8(pos) << 16) | (dv.getUint8(pos + 1) << 8) | dv.getUint8(pos + 2);
                evs.push({ tick: tick, tempo: tp });
              }
              pos += ml;
            } else if (status === 0xf0 || status === 0xf7) {
              pos += vl();
            } else if (hi === 0x80 || hi === 0x90 || hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
              evs.push({ tick: tick, msg: [status, dv.getUint8(pos++), dv.getUint8(pos++)] });
            } else if (hi === 0xc0 || hi === 0xd0) {
              evs.push({ tick: tick, msg: [status, dv.getUint8(pos++)] });
            } else { pos++; }
          } catch (e) { break; }
        }
        tracks.push(evs);
        pos = tend;
      }
      return { tpb: tpb, tracks: tracks };
    },

    _prepare: function (midi) {
      var all = [];
      midi.tracks.forEach(function (tr) { tr.forEach(function (ev) { all.push(ev); }); });
      all.sort(function (a, b) { return a.tick - b.tick; });

      var tempo = 500000, tpb = midi.tpb, prevTick = 0, ms = 0;
      for (var i = 0; i < all.length; i++) {
        var ev = all[i];
        ms += ((ev.tick - prevTick) / tpb) * (tempo / 1000);
        prevTick = ev.tick;
        if (ev.tempo !== undefined) tempo = ev.tempo;
        ev._ms = ms;
      }
      BGM._duration = ms;

      /* note-on ↔ note-off eşleştir (osilatör modu için) */
      var active = {}, notes = [];
      for (var i = 0; i < all.length; i++) {
        var ev = all[i];
        if (!ev.msg) continue;
        var hi = ev.msg[0] & 0xf0, ch = ev.msg[0] & 0x0f, note = ev.msg[1];
        var key = ch + '_' + note;
        if (hi === 0x90 && ev.msg[2] > 0) {
          active[key] = { atMs: ev._ms, vel: ev.msg[2], ch: ch, note: note };
        } else if (hi === 0x80 || (hi === 0x90 && ev.msg[2] === 0)) {
          if (active[key]) {
            notes.push({ atMs: active[key].atMs, durMs: Math.max(ev._ms - active[key].atMs, 40), note: note, vel: active[key].vel, ch: ch });
            delete active[key];
          }
        }
      }
      Object.keys(active).forEach(function (k) {
        var n = active[k];
        notes.push({ atMs: n.atMs, durMs: 500, note: n.note, vel: n.vel, ch: n.ch });
      });
      BGM._noteEvents = notes;
    },

    /* ── Çalma ───────────────────────────────────── */

    startAt: function (offsetMs) {
      if (!BGM._midiBuffer && !BGM._noteEvents) return;
      if (BGM._mode === 'instrument') {
        BGM.initSynth().then(function () { BGM._startSF2(offsetMs); });
      } else {
        BGM._startOsc(offsetMs);
      }
    },

    start: function () { BGM.startAt(0); },

    /* Havuzdan rastgele (şuankinden farklı) yeni parça seç ve çal */
    _playNext: function () {
      var pool = BGM._pool;
      /* havuz boşsa aynı parçayı tekrar çal */
      if (!pool || pool.length === 0) {
        if (BGM._mode === 'instrument' && BGM._seq && BGM._midiBuffer) {
          try {
            sessionStorage.setItem('bgmSongStart', Date.now().toString());
          } catch (e) {}
          BGM._seq.loadNewSongList([BGM._midiBuffer.slice(0)]);
          BGM._seq.play();
        } else {
          BGM._startOsc(0);
        }
        return;
      }
      var current;
      try { current = sessionStorage.getItem('bgmFile'); } catch (e) {}
      var choices = pool.length > 1 ? pool.filter(function (f) { return f !== current; }) : pool;
      var next = choices[Math.floor(Math.random() * choices.length)];
      try {
        sessionStorage.setItem('bgmFile', next);
        sessionStorage.setItem('bgmSongStart', Date.now().toString());
      } catch (e) {}
      BGM._midiBuffer = null;
      BGM._noteEvents = null;
      BGM._duration = 0;
      BGM.load('/public/audio/midi/' + next, function (loaded) {
        if (loaded && BGM._playing) BGM.startAt(0);
      });
    },

    /* ── SF2 modu — SpessaSynth Sequencer ───────── */
    _startSF2: function (offsetMs) {
      if (!BGM._synth || !BGM._seq || !BGM._midiBuffer) {
        BGM._startOsc(offsetMs);
        return;
      }

      BGM.stop();
      BGM._playing = true;

      if (BGM._synthCtx.state === 'suspended') BGM._synthCtx.resume();

      var seekSec = (offsetMs > 0 && BGM._duration > 0)
        ? (offsetMs % BGM._duration) / 1000
        : 0;

      /* Sequencer song yüklenince seek + play */
      BGM._seq.eventHandler.addEvent('songChange', 'bgm_start', function () {
        BGM._seq.eventHandler.removeEvent('songChange', 'bgm_start');
        if (!BGM._playing) return;
        if (seekSec > 0) {
          try { BGM._seq.currentTime = seekSec; } catch (e) {}
        }
        BGM._seq.play();
      });

      /* Worker { binary, fileName } formatı bekliyor */
      var fname;
      try { fname = sessionStorage.getItem('bgmFile') || 'song.mid'; } catch (e) { fname = 'song.mid'; }
      BGM._seq.loadNewSongList([{ binary: BGM._midiBuffer.slice(0), fileName: fname }]);
    },

    /* ── Osilatör modu ───────────────────────────── */
    _getActx: function () {
      if (!BGM._actx) {
        try {
          BGM._actx = new (window.AudioContext || window.webkitAudioContext)();
          BGM._master = BGM._actx.createGain();
          BGM._master.gain.value = 0.55;
          BGM._master.connect(BGM._actx.destination);
        } catch (e) {}
      }
      return BGM._actx;
    },

    _startOsc: function (offsetMs) {
      var ctx = BGM._getActx();
      if (!ctx || !BGM._noteEvents) return;
      BGM.stop();
      BGM._playing = true;
      BGM._oscNodes = [];

      if (ctx.state === 'suspended') ctx.resume();

      var now = ctx.currentTime;
      var base = now - offsetMs / 1000;
      var master = BGM._master;
      var evs = BGM._noteEvents;

      for (var i = 0; i < evs.length; i++) {
        var ev = evs[i];
        var when = base + ev.atMs / 1000;
        var whenEnd = when + ev.durMs / 1000;
        if (whenEnd < now - 0.01) continue;

        var startN = Math.max(when, now);
        var endT = Math.max(whenEnd, startN + 0.04);
        var noteDur = endT - startN;
        var atkDur = Math.min(0.012, noteDur * 0.25);
        var relDur = Math.min(0.12, noteDur * 0.35);
        var susEnd = Math.max(endT - relDur, startN + atkDur);
        var v = (ev.vel / 127) * 0.18;

        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(master);

        osc.type = ev.ch === 9 ? 'square' : 'triangle';
        osc.frequency.value = 440 * Math.pow(2, (ev.note - 69) / 12);

        gain.gain.setValueAtTime(0, startN);
        gain.gain.linearRampToValueAtTime(v, startN + atkDur);
        if (susEnd > startN + atkDur) gain.gain.setValueAtTime(v, susEnd);
        gain.gain.exponentialRampToValueAtTime(0.0001, endT + 0.04);
        osc.start(startN);
        osc.stop(endT + 0.06);
        BGM._oscNodes.push(osc);
      }

      var remaining = BGM._duration - offsetMs;
      BGM._loopId = setTimeout(function () {
        if (!BGM._playing) return;
        BGM._playNext();
      }, remaining + 300);
    },

    stop: function () {
      BGM._playing = false;
      BGM._timers.forEach(clearTimeout);
      BGM._timers = [];
      if (BGM._loopId) { clearTimeout(BGM._loopId); BGM._loopId = null; }
      /* SF2 */
      if (BGM._seq) {
        try {
          BGM._seq.eventHandler.removeEvent('songChange', 'bgm_start');
          BGM._seq.pause();
        } catch (e) {}
      }
      /* Osilatörler */
      var ctx = BGM._actx;
      if (ctx) BGM._oscNodes.forEach(function (o) { try { o.stop(ctx.currentTime); } catch (e) {} });
      BGM._oscNodes = [];
    }
  };

  global.BGM = BGM;
})(window);
