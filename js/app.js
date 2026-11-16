/* Kapi Web — onboarding, settings, bootstrap */
(function () {
  const K = window.K;

  /* original procedural sample scene (used for intro demos / empty states) */
  K.sampleScene = () => {
    const W = 480, H = 640, c = K.canvas(W, H), x = K.ctx(c), R = K.rng(9);
    const sky = x.createLinearGradient(0, 0, 0, H * 0.6); sky.addColorStop(0, '#7db8e8'); sky.addColorStop(1, '#f6dcb0'); x.fillStyle = sky; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff6c9'; x.beginPath(); x.arc(W * 0.78, H * 0.2, 46, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.85)';
    [[90, 110, 40], [150, 100, 32], [330, 170, 36], [380, 160, 28]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.arc(cx + r * 0.9, cy + 6, r * 0.75, 0, 7); x.arc(cx - r * 0.8, cy + 8, r * 0.7, 0, 7); x.fill(); });
    x.fillStyle = '#6fa56a'; x.beginPath(); x.moveTo(0, H * 0.55); x.quadraticCurveTo(W * 0.3, H * 0.42, W * 0.6, H * 0.52); x.quadraticCurveTo(W * 0.85, H * 0.58, W, H * 0.5); x.lineTo(W, H); x.lineTo(0, H); x.fill();
    x.fillStyle = '#4f8b58'; x.beginPath(); x.moveTo(0, H * 0.68); x.quadraticCurveTo(W * 0.5, H * 0.56, W, H * 0.7); x.lineTo(W, H); x.lineTo(0, H); x.fill();
    [[60, 0.6, '#e8665a'], [170, 0.64, '#f2c14e'], [380, 0.62, '#5aa0d8']].forEach(([hx, hy, col]) => { x.fillStyle = col; x.fillRect(hx, H * hy, 70, 54); x.fillStyle = '#8a4b38'; x.beginPath(); x.moveTo(hx - 8, H * hy); x.lineTo(hx + 35, H * hy - 36); x.lineTo(hx + 78, H * hy); x.fill(); x.fillStyle = '#fff3c4'; x.fillRect(hx + 12, H * hy + 14, 14, 14); x.fillRect(hx + 42, H * hy + 14, 14, 14); });
    x.fillStyle = '#2b2a4a'; x.beginPath(); x.arc(W * 0.5, H * 0.66, 30, 0, 7); x.fill(); x.fillStyle = '#e9577b'; x.beginPath(); x.roundRect(W * 0.5 - 46, H * 0.66 + 26, 92, 140, 30); x.fill(); x.fillStyle = '#ffd7b8'; x.beginPath(); x.arc(W * 0.5, H * 0.66 + 4, 22, 0, 7); x.fill();
    for (let i = 0; i < 40; i++) { x.fillStyle = `hsla(${R() * 60 + 300},80%,70%,.8)`; x.beginPath(); x.arc(R() * W, H * 0.8 + R() * H * 0.2, 3 + R() * 3, 0, 7); x.fill(); }
    return c;
  };

  /* before / after slider */
  K.baSlider = (host, preset) => {
    const src = K.sampleScene(), fl = K.canvas(src.width, src.height); K.ctx(fl).drawImage(src, 0, 0); K.filterCanvas(fl, preset, { seed: 5 });
    const cv = K.h('<canvas class="ba"></canvas>'); cv.width = 360; cv.height = 480; host.appendChild(cv); let pos = 0.5; const x = K.ctx(cv);
    const paint = () => { const px = cv.width * pos; x.drawImage(src, 0, 0, cv.width, cv.height); x.save(); x.beginPath(); x.rect(px, 0, cv.width - px, cv.height); x.clip(); x.drawImage(fl, 0, 0, cv.width, cv.height); x.restore(); x.fillStyle = '#ffe926'; x.fillRect(px - 2, 0, 4, cv.height); x.beginPath(); x.arc(px, cv.height / 2, 20, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '700 18px Inter'; x.textAlign = 'center'; x.fillText('◂▸', px, cv.height / 2 + 6); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(8, 8, 62, 24); x.fillRect(cv.width - 70, 8, 62, 24); x.fillStyle = '#fff'; x.font = '600 13px Inter'; x.fillText('BEFORE', 39, 25); x.fillText('AFTER', cv.width - 39, 25); };
    const mv = (e) => { const r = cv.getBoundingClientRect(); pos = K.clamp((e.clientX - r.left) / r.width, 0.03, 0.97); paint(); }; let d = false;
    cv.addEventListener('pointerdown', (e) => { d = true; cv.setPointerCapture(e.pointerId); mv(e); }); cv.addEventListener('pointermove', (e) => d && mv(e)); ['pointerup', 'pointercancel'].forEach((n) => cv.addEventListener(n, () => (d = false)));
    paint(); return cv;
  };

  /* ---------- onboarding ---------- */
  const slides = [['dv1', 'DV Classic', '30+ vintage filters', 'DV, CCD, film, disposable, VHS, Y2K and more — every one computed per pixel, live.'], ['film1', 'Gold 200', 'Warm film, real grain', 'Seeded grain, fade, vignette and flash glow on every preset.'], ['n1', 'XT30', 'Night street & beyond', 'Drag the slider to compare before and after.']];
  function intro() {
    K.go('intro'); const box = K.$('#intro-slides'); box.innerHTML = ''; let i = 0;
    slides.forEach(([id, name, t, d], n) => { const s = K.h(`<div class="slide"><h2>${t}</h2><p class="mut">${d}</p><div class="bah"></div><span class="chip acc">${name}</span></div>`); K.baSlider(K.$('.bah', s), K.preset(id)); box.appendChild(s); });
    const dots = K.$('#intro-dots'); dots.innerHTML = slides.map(() => '<i></i>').join(''); const go = (n) => { i = n; box.style.transform = `translateX(-${n * 100}%)`; K.$$('i', dots).forEach((d, j) => d.classList.toggle('on', j === n)); K.$('#intro-next').textContent = n === slides.length - 1 ? 'Start shooting' : 'Next'; }; go(0);
    K.$('#intro-next').onclick = () => (i < slides.length - 1 ? go(i + 1) : finish()); K.$('#intro-skip').onclick = finish;
    function finish() { K.S.introDone = true; K.save(); K.go('cam'); }
  }
  function permission() {
    K.go('perm');
    K.$('#perm-allow').onclick = async () => { try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); } catch (e) {} intro(); };
    K.$('#perm-skip').onclick = intro;
  }

  /* ---------- settings ---------- */
  function buildSettings() {
    const box = K.$('#set-body'); box.innerHTML = '';
    const row = (label, el, sub) => { const r = K.h(`<div class="sr"><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`); r.appendChild(el); box.appendChild(r); };
    const sel = (opts, cur, cb) => { const s = K.h(`<select class="inp sm">${opts.map(([v, n]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${n}</option>`).join('')}</select>`); s.onchange = () => cb(s.value); return s; };
    const tg = (key, cb) => { const t = K.h(`<label class="tg"><input type="checkbox" ${K.S[key] ? 'checked' : ''}><i></i></label>`); K.$('input', t).onchange = (e) => { K.S[key] = e.target.checked; K.save(); cb && cb(); }; return t; };
    row('Default filter', sel(K.PRESETS.map((p) => [p.id, `${p.name} (${p.cat})`]), K.S.filter, (v) => { K.S.filter = v; K.save(); K.cam.filter = v; }));
    row('Default ratio', sel(['3:4', '9:16', '4:5', '1:1'].map((r) => [r, r]), K.S.ratio, (v) => { K.S.ratio = v; K.save(); if (K.cam.ratios !== false && ['3:4', '9:16', '1:1'].includes(v)) K.cam.ratio = v; }));
    row('Date stamp', tg('dateOn', () => { K.cam.dateOn = K.S.dateOn; K.$('#c-date').classList.toggle('on', K.cam.dateOn); }), 'Add to new photos');
    row('Date stamp style', sel(K.WM_STYLES.map((s) => [s.id, s.name]), K.S.dateStyle, (v) => { K.S.dateStyle = v; K.save(); }));
    row('Save originals', tg('saveOrig'), 'Keep untouched originals; edits stay non-destructive');
    row('Open editor after capture', tg('editAfter'));
    row('Haptics', tg('haptics'));
    row('On-device cut-out model', tg('model'), 'Uses a segmentation model when available, colour-based fallback otherwise');
    const clr = K.h('<button class="btn">Clear cache</button>'); clr.onclick = async () => { K.clearRenderCache(); K.urls.forEach((u) => URL.revokeObjectURL(u)); K.urls.clear(); K.S.newSeen = {}; K.save(); try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) {} K.toast('Cache cleared ✓'); showStorage(); }; row('Clear cache', clr, 'Frees thumbnails & render caches (your photos are kept)');
    const ab = K.h('<button class="btn">About</button>'); ab.onclick = () => K.sheet('<h3>Kapi Web</h3><p class="mut">A retro Y2K · CCD · DV camera and journal-style collage editor. Everything runs on your device — photos live in this browser\'s storage and never leave it.</p><p class="mut sm">v1.0 · All filters, collage art and templates are original and drawn procedurally on canvas.</p>'); row('About', ab);
    box.appendChild(K.h('<p class="mut sm pad" id="storage"></p>')); showStorage();
  }
  async function showStorage() { try { const e = await navigator.storage.estimate(); K.$('#storage').textContent = `Storage used: ${(e.usage / 1048576).toFixed(1)} MB of ${(e.quota / 1048576 / 1024).toFixed(1)} GB`; } catch (e) {} }
  K.screens.set = { enter(_, prev) { K.setFrom = prev && prev !== 'set' ? prev : K.setFrom || 'cam'; buildSettings(); } };

  /* ---------- boot ---------- */
  window.addEventListener('DOMContentLoaded', async () => {
    K.$('#set-back').onclick = () => K.go(K.setFrom || 'cam');
    K.initCamera(); K.initEditor(); K.initGallery();
    document.fonts && ['40px Caveat', '40px "Special Elite"'].forEach((f) => document.fonts.load(f).catch(() => {}));
    try { await K.lib.load(); } catch (e) { console.warn('db', e); K.toast('Storage unavailable — gallery disabled'); }
    setTimeout(() => { if (!K.S.introDone) permission(); else K.go('cam'); }, 1300);
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
