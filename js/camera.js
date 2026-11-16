/* Kapi Web — camera */
(function () {
  const K = window.K;
  const cam = (K.cam = { facing: 'environment', mode: 'photo', ratio: '3:4', timer: 0, grid: false, flash: false, zoom: 1, lens: false, dateOn: true,
    m: { exp: 0, wb: 0, iso: 0, blur: 0, beauty: 0, k: 1, temp: 0, tint: 0 }, filter: 'dv1', stream: null, rec: null, busy: false, raw: false });
  let video, cv, ctx, acc, actx, strip, raf = 0, lastT = 0, frameN = 0, stripT = 0, recStart = 0, recTick = 0, lastThumb = null;
  const RATIO = { '3:4': 4 / 3, '9:16': 16 / 9, '1:1': 1 };
  const pw = () => (cam.mode === 'photo' ? 400 : 480);

  function size() {
    const w = pw(), h = Math.round(w * RATIO[cam.ratio]);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; acc.width = w; acc.height = h; }
    K.$('#cam-view').style.aspectRatio = `${w} / ${h}`;
  }
  async function start() {
    stop(); K.$('#cam-denied').classList.remove('on');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return denied('Camera not supported in this browser.');
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cam.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = cam.stream; await video.play().catch(() => {});
      const t = cam.stream.getVideoTracks()[0], s = t.getSettings ? t.getSettings() : {}; if (s.facingMode) cam.facing = s.facingMode === 'user' ? 'user' : 'environment';
      loop();
    } catch (e) { denied(e && e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'No camera available.'); }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; if (cam.stream) { cam.stream.getTracks().forEach((t) => t.stop()); cam.stream = null; } }
  function denied(msg) { K.$('#cam-denied p').textContent = msg + ' You can still take a photo with your device camera or import one.'; K.$('#cam-denied').classList.add('on'); }
  const mirror = () => cam.facing === 'user';

  function srcRect(vw, vh, aspect, zoom) { let sw, sh; if (vw / vh > aspect) { sh = vh; sw = vh * aspect; } else { sw = vw; sh = vw / aspect; } sw /= zoom; sh /= zoom; return [(vw - sw) / 2, (vh - sh) / 2, sw, sh]; }
  function loop() { raf = requestAnimationFrame(loop); if (K.cur !== 'cam') return; const now = performance.now(); if (now - lastT < 38) return; lastT = now; if (video.readyState < 2 || !video.videoWidth) return; frame(now); }
  function frame(now) {
    size(); const W = cv.width, H = cv.height, [sx, sy, sw, sh] = srcRect(video.videoWidth, video.videoHeight, W / H, cam.zoom);
    actx.save(); if (mirror()) { actx.translate(W, 0); actx.scale(-1, 1); } actx.globalAlpha = 1 - cam.m.blur * 0.82; actx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H); actx.restore();
    ctx.drawImage(acc, 0, 0);
    if (!cam.raw) { if (cam.lens) K.fisheye(cv, 0.6); K.filterCanvas(cv, K.preset(cam.filter), { k: cam.m.k, temp: cam.m.temp, tint: cam.m.tint, exp: cam.m.exp, wb: cam.m.wb, iso: cam.m.iso, beauty: cam.m.beauty, seed: ++frameN & 255 }); if (cam.dateOn) K.watermark.draw(ctx, W, H, { on: true, style: K.S.dateStyle }, null, Date.now()); }
    if (now - stripT > 1400 && strip) { stripT = now; strip.refresh(acc); }
  }

  /* capture */
  function fullFrame() {
    const vw = video.videoWidth, vh = video.videoHeight, sc = Math.min(1, 2560 / Math.max(vw, vh)), c = K.canvas(vw * sc, vh * sc), x = K.ctx(c);
    if (mirror()) { x.translate(c.width, 0); x.scale(-1, 1); } x.drawImage(video, 0, 0, c.width, c.height); x.setTransform(1, 0, 0, 1, 0, 0);
    if (cam.m.blur > 0) { const [sx, sy, sw, sh] = srcRect(c.width, c.height, acc.width / acc.height, cam.zoom); x.globalAlpha = cam.m.blur * 0.5; x.drawImage(acc, 0, 0, acc.width, acc.height, sx, sy, sw, sh); x.globalAlpha = 1; }
    return c;
  }
  async function saveNewPhoto(canvas, edit) {
    const created = Date.now(), id = K.uid(), item = { id, kind: 'photo', created, album: null, fav: false, deleted: null, w: canvas.width, h: canvas.height };
    const ph = K.makePhoto(id, canvas, created), st = K.merge(K.defaultEdit(), edit || {});
    if (!K.S.saveOrig) { const flat = K.render(ph, st, { width: Math.min(2160, canvas.width) }); item.blob = await K.toBlob(flat, 'image/jpeg', 0.92); item.edit = null; item.w = flat.width; item.h = flat.height; ph.src = flat; ph.w = flat.width; ph.h = flat.height; item.thumb = await K.toBlob(K.render(ph, K.defaultEdit({ filter: 'none', dateOn: false }), { width: 360 }), 'image/jpeg', 0.8); }
    else { item.blob = await K.toBlob(canvas, 'image/jpeg', 0.92); item.edit = st; item.thumb = await K.toBlob(K.render(ph, st, { width: 360 }), 'image/jpeg', 0.8); }
    await K.db.put(item); K.lib.add(item); updateGalBtn(item); return item;
  }
  async function shootPhoto() {
    if (cam.busy) return; cam.busy = true;
    try {
      await countdown(); flashFx(); K.haptic(20);
      const c = fullFrame(), edit = { f: { id: cam.filter, k: cam.m.k, temp: cam.m.temp, tint: cam.m.tint, exp: cam.m.exp, wb: cam.m.wb, iso: cam.m.iso, beauty: cam.m.beauty, lens: cam.lens ? 0.6 : 0 }, crop: { ratio: cam.ratio, zoom: cam.zoom }, wm: { on: cam.dateOn, style: K.S.dateStyle } };
      const item = await saveNewPhoto(c, edit);
      if (K.S.editAfter) K.openEditor([item], 0, 'cam'); else K.toast('Saved to gallery ✓');
    } finally { cam.busy = false; }
  }
  function flashFx() {
    const f = K.$('#cam-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    if (cam.flash && cam.facing !== 'user' && cam.stream) { const t = cam.stream.getVideoTracks()[0]; try { t.applyConstraints({ advanced: [{ torch: true }] }).then(() => setTimeout(() => t.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {}), 300)).catch(() => {}); } catch (e) {} }
  }
  function countdown() {
    return new Promise((res) => {
      let n = cam.timer; if (!n) return res(); const el = K.$('#cam-count'); el.classList.add('on');
      const tick = () => { el.textContent = n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); K.haptic(10); if (n-- <= 0) { el.classList.remove('on'); res(); } else setTimeout(tick, 1000); }; tick();
    });
  }

  /* video / live */
  async function shootVideo(live) {
    if (cam.rec) return stopRec(); if (cam.busy) return; if (typeof MediaRecorder === 'undefined') return K.toast('Video recording not supported here');
    cam.busy = true; await countdown(); cam.busy = false;
    const stream = cv.captureStream(30);
    if (!live) { try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getAudioTracks().forEach((t) => stream.addTrack(t)); cam.mic = mic; } catch (e) { K.toast('Mic unavailable — recording without sound'); } }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const chunks = []; let rec; try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3e6 } : {}); } catch (e) { return K.toast('Could not start recorder'); }
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    rec.onstop = async () => { clearInterval(recTick); if (cam.mic) { cam.mic.getTracks().forEach((t) => t.stop()); cam.mic = null; } cam.rec = null; K.$('#cam-shutter').classList.remove('rec'); K.$('#cam-rectime').classList.remove('on'); const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' }); await saveVideo(blob, live, (Date.now() - recStart) / 1000); };
    cam.rec = rec; cam.live = live; recStart = Date.now(); rec.start(250); K.haptic(30); K.$('#cam-shutter').classList.add('rec'); const rt = K.$('#cam-rectime'); rt.classList.add('on');
    recTick = setInterval(() => { const s = (Date.now() - recStart) / 1000; rt.textContent = `● ${live ? s.toFixed(1) + ' / 2.5s' : String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0')}`; if (live && s >= 2.5) stopRec(); }, 100);
  }
  function stopRec() { if (cam.rec && cam.rec.state !== 'inactive') cam.rec.stop(); }
  async function saveVideo(blob, live, dur) {
    const t = K.canvas(240, Math.round(240 * (cv.height / cv.width))); K.ctx(t).drawImage(cv, 0, 0, t.width, t.height);
    const item = { id: K.uid(), kind: 'video', live, blob, thumb: await K.toBlob(t, 'image/jpeg', 0.8), created: Date.now(), dur, album: null, fav: false, deleted: null, w: cv.width, h: cv.height };
    await K.db.put(item); K.lib.add(item); updateGalBtn(item); K.toast(live ? 'Live clip saved ✓' : 'Video saved ✓');
  }
  function updateGalBtn(item) { lastThumb = item; const b = K.$('#cam-gal'); const u = K.thumbURL(item); b.style.backgroundImage = u ? `url(${u})` : ''; b.classList.toggle('has', !!u); }

  /* fallback capture via file input */
  async function onFallbackFile(files) { const items = await K.importFiles(files, true); if (items.length) K.openEditor(items.filter((i) => i.kind === 'photo'), 0, 'cam'); }

  /* ---------- UI ---------- */
  K.initCamera = () => {
    video = K.$('#cam-video'); cv = K.$('#cam-cv'); ctx = K.ctx(cv); acc = K.canvas(400, 533); actx = K.ctx(acc); cam.filter = K.S.filter; cam.ratio = K.S.ratio; cam.dateOn = K.S.dateOn;
    size();
    strip = K.filterStrip(K.$('#cam-filters'), { current: () => cam.filter, onpick: (id) => { cam.filter = id; } });
    const set = (id, txt) => (K.$(id).textContent = txt);
    K.$('#c-flash').onclick = (e) => { cam.flash = !cam.flash; e.currentTarget.classList.toggle('on', cam.flash); K.toast(cam.flash ? 'Flash on' : 'Flash off', 900); };
    K.$('#c-timer').onclick = () => { cam.timer = { 0: 3, 3: 5, 5: 10, 10: 0 }[cam.timer]; set('#c-timer span', cam.timer ? cam.timer + 's' : 'Off'); K.$('#c-timer').classList.toggle('on', !!cam.timer); };
    K.$('#c-grid').onclick = (e) => { cam.grid = !cam.grid; e.currentTarget.classList.toggle('on', cam.grid); K.$('#cam-grid').classList.toggle('on', cam.grid); };
    K.$('#c-ratio').onclick = () => { cam.ratio = { '3:4': '9:16', '9:16': '1:1', '1:1': '3:4' }[cam.ratio]; set('#c-ratio span', cam.ratio); size(); };
    K.$('#c-lens').onclick = (e) => { cam.lens = !cam.lens; e.currentTarget.classList.toggle('on', cam.lens); K.toast(cam.lens ? 'Fisheye lens on' : 'Fisheye off', 900); };
    K.$('#c-date').onclick = (e) => { cam.dateOn = !cam.dateOn; e.currentTarget.classList.toggle('on', cam.dateOn); };
    K.$('#c-set').onclick = () => K.go('set'); K.$('#cam-gal').onclick = () => K.go('gal'); K.$('#c-date').classList.toggle('on', cam.dateOn);
    K.$('#cam-flip').onclick = () => { cam.facing = cam.facing === 'user' ? 'environment' : 'user'; K.haptic(10); start(); };
    K.$$('#c-zoom button').forEach((b) => (b.onclick = () => setZoom(+b.dataset.z)));
    K.$$('#c-modes button').forEach((b) => (b.onclick = () => { if (cam.rec) return; cam.mode = b.dataset.m; K.$$('#c-modes button').forEach((x) => x.classList.toggle('on', x === b)); K.$('#cam-shutter').className = 'shutter ' + cam.mode; size(); K.haptic(8); }));
    K.$('#cam-shutter').onclick = () => { if (cam.mode === 'photo') shootPhoto(); else shootVideo(cam.mode === 'live'); };
    const cmp = K.$('#c-cmp'); const cm = (v) => (e) => { e.preventDefault(); cam.raw = v; }; cmp.addEventListener('pointerdown', cm(true)); ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => cmp.addEventListener(n, cm(false)));
    K.$('#c-ai').onclick = () => { const r = K.aiPick(acc, 3), a = r.stats; const s = K.sheet(`<h3>✦ AI pick</h3><p class="mut">${a.luma < 0.3 ? 'Dark' : a.luma > 0.62 ? 'Bright' : 'Balanced'} scene · ${a.cast > 0.04 ? 'warm' : a.cast < -0.04 ? 'cool' : 'neutral'} colour · ${a.contrast < 0.14 ? 'low' : a.contrast > 0.26 ? 'high' : 'medium'} contrast</p><div class="aipk"></div>`); const box = K.$('.aipk', s.el); r.picks.forEach((p, i) => { const b = K.h(`<button class="fc"><canvas width="54" height="72"></canvas><span>${i ? '' : '★ '}${p.name}</span></button>`); const c = K.$('canvas', b); K.ctx(c).drawImage(acc, 0, 0, 54, 72); K.filterCanvas(c, p, { seed: 3 }); b.onclick = () => { cam.filter = p.id; strip.set(p.id); s.close(); }; box.appendChild(b); }); };
    // manual sliders
    const man = K.$('#c-man'), defs = [['Exposure', 'exp', -1, 1], ['White balance', 'wb', -1, 1], ['ISO / grain', 'iso', 0, 1], ['Shutter blur', 'blur', 0, 1], ['Beauty', 'beauty', 0, 1], ['Intensity', 'k', 0, 1], ['Temperature', 'temp', -1, 1], ['Tint', 'tint', -1, 1]];
    defs.forEach(([l, k, a, b]) => man.appendChild(K.slider({ label: l, min: a, max: b, value: cam.m[k], fmt: (v) => Math.round(v * 100), oninput: (v) => (cam.m[k] = v) })));
    cam.focal = K.slider({ label: 'Focal length', min: 1, max: 4, step: 0.05, value: 1, fmt: (v) => v.toFixed(1) + 'x', oninput: (v) => setZoom(v, true) }); man.appendChild(cam.focal);
    const rs = K.h('<button class="chip">Reset</button>'); rs.onclick = () => { Object.assign(cam.m, { exp: 0, wb: 0, iso: 0, blur: 0, beauty: 0, k: 1, temp: 0, tint: 0 }); setZoom(1); man.innerHTML = ''; initMan(); }; man.appendChild(rs);
    function initMan() { man.innerHTML = ''; defs.forEach(([l, k, a, b]) => man.appendChild(K.slider({ label: l, min: a, max: b, value: cam.m[k], fmt: (v) => Math.round(v * 100), oninput: (v) => (cam.m[k] = v) }))); cam.focal = K.slider({ label: 'Focal length', min: 1, max: 4, step: 0.05, value: cam.zoom, fmt: (v) => v.toFixed(1) + 'x', oninput: (v) => setZoom(v, true) }); man.appendChild(cam.focal); man.appendChild(rs); }
    K.$('#c-manual').onclick = (e) => { man.classList.toggle('on'); e.currentTarget.classList.toggle('on'); };
    // pinch zoom on view
    const view = K.$('#cam-view'), pt = new Map(); let ld = 0;
    view.addEventListener('pointerdown', (e) => { pt.set(e.pointerId, [e.clientX, e.clientY]); ld = 0; }); view.addEventListener('pointermove', (e) => { if (!pt.has(e.pointerId)) return; pt.set(e.pointerId, [e.clientX, e.clientY]); if (pt.size === 2) { const [a, b] = [...pt.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (ld) setZoom(cam.zoom * (d / ld)); ld = d; } }); ['pointerup', 'pointercancel'].forEach((n) => view.addEventListener(n, (e) => pt.delete(e.pointerId)));
    // fallback
    const fi = K.$('#cam-file'); fi.onchange = () => { if (fi.files.length) onFallbackFile([...fi.files]); fi.value = ''; }; K.$('#cam-retry').onclick = start;
    K.$('#cam-import').onclick = () => K.$('#imp-file').click();
    K.lib.onload(() => { const it = K.lib.items().find((i) => !i.deleted); if (it) updateGalBtn(it); });
  };
  function setZoom(z, fromSlider) { cam.zoom = K.clamp(z, 1, 4); K.$$('#c-zoom button').forEach((b) => b.classList.toggle('on', Math.abs(+b.dataset.z - cam.zoom) < 0.05)); if (!fromSlider && cam.focal) cam.focal.set(cam.zoom); }
  K.cameraStart = start;
  K.screens.cam = {
    enter() { cam.filter = cam.filter || K.S.filter; strip && strip.set(cam.filter); size(); if (!cam.stream) start(); else if (!raf) loop(); K.$('#cam-gal').classList.toggle('has', !!lastThumb); },
    leave(to) { if (to !== 'cam') { stopRec(); stop(); } },
  };
})();
