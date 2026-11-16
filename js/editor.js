/* Kapi Web — editor */
(function () {
  const K = window.K;
  const ed = (K.ed = { list: [], cur: 0, tab: 'filter', from: 'gal', cmp: false, cmpPos: 0.5 });
  const C = () => ed.list[ed.cur];
  K.merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') K.merge(a[k], b[k]); else a[k] = b[k]; } return a; };
  const stage = () => K.$('#ed-stage');

  /* ---------- load / save ---------- */
  async function loadEntry(item) {
    const src = await K.blobToCanvas(item.blob), ph = K.makePhoto(item.id, src, item.created), st = K.merge(K.defaultEdit(), item.edit ? K.clone(item.edit) : {});
    if (st.col.mask) { try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = st.col.mask; }); const c = K.canvas(img.width, img.height); K.ctx(c).drawImage(img, 0, 0); ph.masks.set(st.col.mv, c); } catch (e) { st.col.mv = 0; } }
    return { item, ph, st, hist: { stack: [JSON.stringify(st)], idx: 0 }, dirty: false };
  }
  async function persist(e) {
    if (!e.dirty) return; const st = K.clone(e.st);
    st.col.mask = st.col.mv > 0 && e.ph.masks.get(st.col.mv) ? e.ph.masks.get(st.col.mv).toDataURL('image/png') : null;
    e.item.edit = st;
    const t = K.render(e.ph, e.st, { width: 360, others: others(e) }); e.item.thumb = await K.toBlob(t, 'image/jpeg', 0.8); e.item.tv = (e.item.tv || 0) + 1;
    await K.db.put(e.item); e.dirty = false;
  }
  const others = (e) => ed.list.filter((x) => x !== e).map((x) => x.ph);
  K.persistEditor = async () => { for (const e of ed.list) await persist(e); };

  /* ---------- history ---------- */
  function commit() { const e = C(); e.dirty = true; const h = e.hist, s = JSON.stringify(e.st); if (h.stack[h.idx] === s) return updHist(); h.stack = h.stack.slice(0, h.idx + 1); h.stack.push(s); if (h.stack.length > 60) h.stack.shift(); h.idx = h.stack.length - 1; updHist(); }
  function updHist() { const h = C().hist; K.$('#ed-undo').disabled = h.idx <= 0; K.$('#ed-redo').disabled = h.idx >= h.stack.length - 1; }
  function jump(d) { const e = C(), h = e.hist, i = h.idx + d; if (i < 0 || i >= h.stack.length) return; h.idx = i; e.st = JSON.parse(h.stack[i]); e.dirty = true; updHist(); draw(); buildPanel(true); K.haptic(6); }

  /* ---------- rendering ---------- */
  let pending = null, rafId = 0, last = null;
  function draw(q = 'final') { pending = q === 'draft' && pending === 'final' ? 'final' : q; if (!rafId) rafId = requestAnimationFrame(doDraw); }
  function doDraw() {
    rafId = 0; const e = C(); if (!e) return; const q = pending; pending = null; const w = q === 'draft' ? 360 : 720, cv = stage();
    const show = (c) => { if (cv.width !== c.width || cv.height !== c.height) { cv.width = c.width; cv.height = c.height; } K.ctx(cv).drawImage(c, 0, 0); };
    let out;
    if (ed.hold) out = K.render(e.ph, e.st, { width: w, raw: true });
    else out = K.render(e.ph, e.st, { width: w, others: others(e) });
    last = out;
    if (ed.stack && !ed.hold) { const W2 = out.width, oh = Math.round((W2 * e.ph.h) / e.ph.w), o2 = K.canvas(W2, oh + out.height + 12), x2 = K.ctx(o2); x2.fillStyle = '#0b0b0d'; x2.fillRect(0, 0, o2.width, o2.height); x2.imageSmoothingQuality = 'high'; x2.drawImage(e.ph.src, 0, 0, W2, oh); x2.drawImage(out, 0, oh + 12); out = o2; }
    if (ed.cmp && !ed.hold && !ed.stack) {
      const raw = K.render(e.ph, e.st, { width: w, raw: true }); const o = K.canvas(out.width, out.height), x = K.ctx(o), px = out.width * ed.cmpPos;
      x.drawImage(raw, 0, 0); x.save(); x.beginPath(); x.rect(px, 0, out.width - px, out.height); x.clip(); x.drawImage(out, 0, 0); x.restore();
      x.fillStyle = '#ffe926'; x.fillRect(px - 2, 0, 4, out.height); x.beginPath(); x.arc(px, out.height / 2, 22, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '700 22px Inter,sans-serif'; x.textAlign = 'center'; x.fillText('◂▸', px, out.height / 2 + 8);
      x.font = '600 20px Inter,sans-serif'; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(10, 10, 74, 28); x.fillRect(out.width - 84, 10, 74, 28); x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('BEFORE', 47, 30); x.fillText('AFTER', out.width - 47, 30); out = o;
    }
    show(out); if (q === 'draft') { clearTimeout(doDraw.t); doDraw.t = setTimeout(() => draw('final'), 140); }
    updateStrip(ed.cur);
  }
  const fitRect = () => { const cv = stage(), r = cv.getBoundingClientRect(), ar = cv.width / cv.height, w = Math.min(r.width, r.height * ar); return { w, h: w / ar, r }; };

  function setStack(v) { ed.stack = v; K.$('#ed-stackbtn').classList.toggle('on', v); if (v) { ed.cmp = false; K.$('#ed-cmpbtn').classList.remove('on'); } }

  /* ---------- open ---------- */
  K.openEditor = async (items, idx = 0, from = 'gal') => {
    K.go('ed'); ed.from = from; ed.list = []; ed.cur = idx; ed.cmp = false; ed.hold = false; ed.stack = false; K.$('#ed-cmpbtn').classList.remove('on'); K.$('#ed-stackbtn').classList.remove('on'); K.toast('Loading…', 800);
    for (const it of items) ed.list.push(await loadEntry(it));
    ed.cur = Math.min(idx, ed.list.length - 1); buildStrip(); updHist(); syncCrop(); draw(); buildPanel();
  };
  async function addItems(items) { for (const it of items) { if (it.kind !== 'photo' || ed.list.some((e) => e.item.id === it.id)) continue; ed.list.push(await loadEntry(it)); } buildStrip(); draw(); }

  /* ---------- strip ---------- */
  function buildStrip() {
    const s = K.$('#ed-strip'); s.innerHTML = '';
    const add = K.h('<button class="th add" aria-label="Add photos">+</button>'); add.onclick = async () => { const its = await K.pickMedia({ photosOnly: true, title: 'Add to edit' }); if (its && its.length) addItems(its); }; s.appendChild(add);
    ed.list.forEach((e, i) => { const t = K.h(`<button class="th ${i === ed.cur ? 'on' : ''}"><canvas width="48" height="64"></canvas></button>`); t.onclick = () => { ed.cur = i; K.$$('.th', s).forEach((x, j) => x.classList.toggle('on', j === i + 1)); updHist(); syncCrop(); draw(); buildPanel(); }; s.appendChild(t); });
    ed.list.forEach((e, i) => updateStrip(i));
    const all = K.h('<button class="chip all">Apply to all</button>'); all.onclick = applyAll; s.appendChild(all);
  }
  function updateStrip(i) { const e = ed.list[i], b = K.$$('#ed-strip .th')[i + 1]; if (!e || !b) return; const cv = K.$('canvas', b), x = K.ctx(cv); const c = K.photoCell(e.ph, e.st, 48, 64, { main: true }); x.drawImage(c, 0, 0, 48, 64); }
  function applyAll() {
    if (ed.list.length < 2) return K.toast('Add more photos with +');
    const src = C().st; ed.list.forEach((e) => { if (e === C()) return; ['f', 'light', 'fx', 'border', 'wm'].forEach((k) => (e.st[k] = K.clone(src[k]))); e.st.col = Object.assign(e.st.col, { id: src.col.id, v: src.col.v, loc: src.col.loc, title: src.col.title }); commitFor(e); });
    K.toast(`Applied to ${ed.list.length} photos`); K.haptic(20); draw();
  }
  function commitFor(e) { const keep = ed.cur; ed.cur = ed.list.indexOf(e); commit(); ed.cur = keep; updHist(); }

  /* ---------- mutate helper ---------- */
  function mut(fn, o = {}) { const e = C(); fn(e.st); if (o.draft) draw('draft'); else draw(); if (o.commit !== false && !o.draft) commit(); }
  const sliderMut = (label, get, set, o = {}) => K.slider({ label, min: o.min == null ? 0 : o.min, max: o.max == null ? 1 : o.max, step: o.step || 0.01, value: get(), pct: o.pct !== false, fmt: o.fmt, oninput: (v) => { set(C().st, v); draw('draft'); }, onchange: () => { commit(); draw(); } });

  /* ---------- tabs / panels ---------- */
  const TABS = [['filter', 'Filter'], ['light', 'Light Shadow'], ['col', 'Collage'], ['border', 'Border'], ['fx', 'Effect'], ['wm', 'Watermark']];
  let gen = 0;
  function buildTabs() {
    const t = K.$('#ed-tabs'); t.innerHTML = '';
    TABS.forEach(([id, name]) => { const b = K.h(`<button class="tab ${id === ed.tab ? 'on' : ''}" data-t="${id}">${name}</button>`); b.onclick = () => { ed.tab = id; K.$$('.tab', t).forEach((x) => x.classList.toggle('on', x === b)); buildPanel(); }; t.appendChild(b); });
  }
  const paintTabs = () => {};
  function buildPanel(rebuild) {
    const e = C(); if (!e) return; const p = K.$('#ed-cards'), ctl = K.$('#ed-ctrl'); gen++; const g = gen; p.innerHTML = ''; ctl.innerHTML = ''; K.$$('#ed-tabs .tab').forEach((x) => x.classList.toggle('on', x.dataset.t === ed.tab)); 
    const queue = []; const pump = () => { if (g !== gen || !queue.length) return; queue.shift()(); setTimeout(pump, 0); };
    const cards = (items, cur, onPick, patch, o = {}) => {
      const row = K.h('<div class="cardrow"></div>');
      items.forEach((it) => {
        const card = K.h(`<div class="cd ${it.id === cur ? 'on' : ''}"><canvas width="72" height="96"></canvas><span>${it.name}</span>${o.badge && o.badge(it) ? `<i class="badge new">${o.badge(it)}</i>` : ''}</div>`);
        queue.push(() => { const t = K.clone(e.st); t.crop = { ratio: '3:4', rot: e.st.crop.rot, flip: e.st.crop.flip, zoom: 1, px: 0, py: 0 }; patch(t, it.id); const c = K.render(e.ph, t, { width: 144, others: others(e) }); K.ctx(card.firstChild).drawImage(c, 0, 0, 72, 96); });
        card.onclick = () => { onPick(it.id, card); K.haptic(8); }; row.appendChild(card);
      });
      setTimeout(pump, 0); return row;
    };
    const wrap = (...els) => els.forEach((x) => ctl.appendChild(x));
    if (ed.tab === 'filter') {
      const host = K.h('<div class="fstrip"></div>'); p.appendChild(host);
      const fs = K.filterStrip(host, { current: () => C().st.f.id, onpick: (id) => { mut((s) => { s.f.id = id; }); }, });
      const refresh = () => fs.refresh(K.photoCell(e.ph, e.st, 108, 144, { main: true, raw: true })); refresh();
      ed.fs = fs;
      const row = K.h('<div class="row gap wrap sp"></div>');
      const ai = K.h('<button class="chip acc">✦ AI pick</button>'); ai.onclick = () => aiPick(fs);
      const lens = K.h(`<button class="chip ${e.st.f.lens > 0 ? 'on' : ''}">◎ Fisheye</button>`); lens.onclick = () => { mut((s) => { s.f.lens = s.f.lens > 0 ? 0 : 0.6; }); lens.classList.toggle('on', C().st.f.lens > 0); };
      row.append(ai, lens); p.appendChild(row);
      wrap(sliderMut('Intensity', () => e.st.f.k, (s, v) => (s.f.k = v), { min: 0, max: 1 }), sliderMut('Temperature', () => e.st.f.temp, (s, v) => (s.f.temp = v), { min: -1, max: 1, fmt: (v) => Math.round(v * 100) }), sliderMut('Tint', () => e.st.f.tint, (s, v) => (s.f.tint = v), { min: -1, max: 1, fmt: (v) => Math.round(v * 100) }), sliderMut('Beauty', () => e.st.f.beauty, (s, v) => (s.f.beauty = v)));
    } else if (ed.tab === 'light') {
      p.appendChild(cards([{ id: null, name: 'None' }, ...K.LIGHTS], e.st.light.id, (id, card) => { mut((s) => { s.light.id = id; }); sel(card); }, (t, id) => { t.light = { id, k: e.st.light.k }; }));
      wrap(sliderMut('Intensity', () => e.st.light.k, (s, v) => (s.light.k = v)));
    } else if (ed.tab === 'fx') {
      p.appendChild(cards([{ id: null, name: 'None' }, ...K.EFFECTS], e.st.fx.id, (id, card) => { mut((s) => { s.fx.id = id; }); sel(card); }, (t, id) => { t.fx = { id, k: e.st.fx.k }; }));
      wrap(sliderMut('Intensity', () => e.st.fx.k, (s, v) => (s.fx.k = v)));
    } else if (ed.tab === 'border') {
      p.appendChild(cards([{ id: null, name: 'None' }, ...K.BORDERS], e.st.border.id, (id, card) => { mut((s) => { s.border.id = id; }); sel(card); }, (t, id) => { t.border = { id, k: e.st.border.k, dark: e.st.border.dark }; }));
      const dk = K.h(`<button class="chip ${e.st.border.dark ? 'on' : ''}">Dark frame</button>`); dk.onclick = () => { mut((s) => { s.border.dark = !s.border.dark; }); dk.classList.toggle('on', C().st.border.dark); };
      wrap(sliderMut('Thickness', () => e.st.border.k, (s, v) => (s.border.k = v)), dk);
    } else if (ed.tab === 'col') {
      const items = [{ id: null, name: 'None' }, ...K.COLLAGES]; const row = cards(items, e.st.col.id, (id, card) => {
        const s = C().st; const same = id === s.col.id && id; mut((t) => { if (same) t.col.v = (t.col.v + 1) % K.COLMAP[id].vars; else { t.col.id = id; t.col.v = 0; } });
        buildPanel(); if (id === 'travel' && !same) openCutout({ guide: true }); else if (id && !same && K.S.model) modelMask();
      }, (t, id) => { t.col.id = id; t.col.v = id === e.st.col.id ? e.st.col.v : 0; }, { badge: (it) => (it.id && it.id === e.st.col.id ? `${e.st.col.v + 1}/${it.vars}` : '') });
      p.appendChild(row);
      const tpl = K.COLMAP[e.st.col.id];
      if (tpl) {
        p.appendChild(K.h('<p class="mut sm">Tap the selected template again to cycle styles.' + (tpl.id === 'travel' ? ' Cut-out off? Tap “Edit cut-out”, choose Box and drag around your subject.' : '') + '</p>'));
        if (tpl.text) { const key = tpl.text, inp = K.h(`<input class="inp" placeholder="${K.esc(tpl.ph || '')}" value="${K.esc(e.st.col[key] || '')}" maxlength="28">`); inp.oninput = () => { C().st.col[key] = inp.value; draw('draft'); }; inp.onchange = () => { commit(); draw(); }; p.appendChild(K.h(`<label class="fl">${key === 'loc' ? 'Location caption' : 'Title'}</label>`)); p.appendChild(inp); }
        if (tpl.id === 'holiday') { const l = e.st.col.labels || ['sunrise', 'snacks', 'new friends']; const r = K.h('<div class="row gap"></div>'); l.forEach((v, i) => { const inp = K.h(`<input class="inp" value="${K.esc(v)}" maxlength="14">`); inp.oninput = () => { const s = C().st; s.col.labels = (s.col.labels || l).slice(); s.col.labels[i] = inp.value; draw('draft'); }; inp.onchange = () => { commit(); draw(); }; r.appendChild(inp); }); p.appendChild(K.h('<label class="fl">Photo labels</label>')); p.appendChild(r); }
        if (['travel'].includes(tpl.id)) { const r = K.h('<div class="row gap"><button class="btn" data-cut>✂ Edit cut-out</button><button class="btn" data-auto>Auto cut-out</button></div>'); K.$('[data-cut]', r).onclick = openCutout; K.$('[data-auto]', r).onclick = () => autoCut(); p.appendChild(r); }
      }
    } else if (ed.tab === 'wm') {
      if (e.st.col.id) p.appendChild(K.h('<p class="mut sm">Collage templates print their own date, so the stamp is hidden while a collage is on.</p>'));
      const on = K.h(`<div class="row gap sp"><b>Date stamp</b><button class="chip ${e.st.wm.on ? 'on' : ''}">${e.st.wm.on ? 'On' : 'Off'}</button></div>`);
      K.$('button', on).onclick = (ev) => { mut((s) => { s.wm.on = !s.wm.on; }); ev.target.classList.toggle('on', C().st.wm.on); ev.target.textContent = C().st.wm.on ? 'On' : 'Off'; };
      p.appendChild(on);
      p.appendChild(cards(K.WM_STYLES, e.st.wm.style, (id, card) => { mut((s) => { s.wm.style = id; s.wm.on = true; }); sel(card); }, (t, id) => { t.wm.style = id; t.wm.on = true; }));
      const d = new Date(e.st.wm.date || e.ph.created), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const di = K.h(`<input class="inp" type="date" value="${iso}">`); di.onchange = () => { if (!di.value) return; mut((s) => { s.wm.date = new Date(di.value + 'T12:00:00').toISOString(); s.wm.on = true; }); };
      const ti = K.h(`<input class="inp" placeholder="Custom text (optional)" maxlength="28" value="${K.esc(e.st.wm.text || '')}">`); ti.oninput = () => { C().st.wm.text = ti.value; C().st.wm.on = true; draw('draft'); }; ti.onchange = () => { commit(); draw(); };
      p.appendChild(K.h('<label class="fl">Date</label>')); p.appendChild(di); p.appendChild(K.h('<label class="fl">Text</label>')); p.appendChild(ti);
    }
    function sel(card) { K.$$('.cd', card.parentNode).forEach((x) => x.classList.toggle('on', x === card)); }
  }

  /* AI pick */
  function aiPick(fs) {
    const e = C(), src = K.photoCell(e.ph, e.st, 96, 128, { main: true, raw: true }), r = K.aiPick(src, 3), a = r.stats;
    const desc = `${a.luma < 0.3 ? 'dark' : a.luma > 0.62 ? 'bright' : 'balanced'} scene · ${a.cast > 0.04 ? 'warm cast' : a.cast < -0.04 ? 'cool cast' : 'neutral colour'} · ${a.contrast < 0.14 ? 'low' : a.contrast > 0.26 ? 'high' : 'medium'} contrast`;
    const s = K.sheet(`<h3>✦ AI pick</h3><p class="mut">${desc}</p><div class="aipk"></div>`); const box = K.$('.aipk', s.el);
    r.picks.forEach((p, i) => { const b = K.h(`<button class="fc"><canvas width="54" height="72"></canvas><span>${i === 0 ? '★ ' : ''}${p.name}</span></button>`); const cv = K.$('canvas', b); K.ctx(cv).drawImage(src, 0, 0, 54, 72); K.filterCanvas(cv, p, { seed: 3 }); b.onclick = () => { mut((st) => { st.f.id = p.id; }); fs.set(p.id); s.close(); K.toast(`Applied ${p.name}`); }; box.appendChild(b); });
  }

  /* subject cut-out */
  async function modelMask() { const e = C(), mv0 = e.st.col.mv, ph = e.ph; const m = await K.seg.model(ph.src); if (m && C() === e && e.st.col.mv === mv0 && e.st.col.id) { const nv = Math.max(...ph.masks.keys(), 0) + 1; ph.masks.set(nv, m); mut((s) => { s.col.mv = nv; }); K.toast('Cut-out refined with on-device model'); } }
  async function autoCut() { const e = C(); K.toast('Finding subject…', 900); await new Promise((r) => setTimeout(r, 30)); let m = await K.seg.model(e.ph.src); if (!m) m = K.seg.auto(e.ph.src); const nv = Math.max(...e.ph.masks.keys(), 0) + 1; e.ph.masks.set(nv, m); mut((s) => { s.col.mv = nv; }); }
  function openCutout(o = {}) {
    const e = C(), ph = e.ph; const gw = ph.w >= ph.h ? 256 : Math.max(8, Math.round((256 * ph.w) / ph.h)), gh = ph.w >= ph.h ? Math.max(8, Math.round((256 * ph.h) / ph.w)) : 256;
    const base = o.guide ? K.seg.full(gw, gh) : K.getMask(ph, e.st); let mk = K.canvas(base.width, base.height); K.ctx(mk).drawImage(base, 0, 0);
    const s = K.sheet(`<div class="cutbar"><button class="btn" data-x>Cancel</button><b>${o.guide ? "Select subject" : "Cut-out"}</b><button class="btn pri" data-ok>${o.guide ? "Create" : "Done"}</button></div>${o.guide ? `<p class="mut sm guide">Drag a box around the area you want painted, then tap Create. You can refine with Add / Erase.</p><input class="inp" id="gloc" maxlength="28" placeholder="Location caption (optional) e.g. Electronic City Phase I" value="${K.esc(e.st.col.loc || "")}">` : ""}<div class="cutwrap"><canvas id="cutcv"></canvas></div><div class="row gap wrap sp"><button class="chip ${o.guide ? "" : "on"}" data-m="add">＋ Add</button><button class="chip" data-m="erase">－ Erase</button><button class="chip ${o.guide ? "on" : ""}" data-m="box">▭ Box</button><button class="chip on" data-smart>✦ Smart</button><button class="chip" data-a>Auto</button><button class="chip" data-all>Select all</button></div><div id="cutsl"></div>`, { cls: 'tall', modal: true });
    const cv = K.$('#cutcv', s.el), aspect = ph.w / ph.h; const vw = Math.min(480, Math.round(window.innerWidth - 40), Math.round((window.innerHeight * 0.5) * aspect)); cv.width = vw; cv.height = Math.round(vw / aspect); cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    let mode = o.guide ? 'box' : 'add', size = 26, smart = true; const fgS = K.canvas(base.width, base.height), bgS = K.canvas(base.width, base.height), ov = K.canvas(base.width, base.height); const clearSeeds = () => [fgS, bgS, ov].forEach((q) => K.ctx(q).clearRect(0, 0, q.width, q.height)); const paint = () => { const x = K.ctx(cv); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(ph.src, 0, 0, cv.width, cv.height); const t = K.canvas(cv.width, cv.height), tx = K.ctx(t); tx.fillStyle = '#10101a'; tx.fillRect(0, 0, t.width, t.height); tx.globalCompositeOperation = 'destination-out'; tx.drawImage(mk, 0, 0, t.width, t.height); x.globalAlpha = 0.72; x.drawImage(t, 0, 0); x.globalAlpha = 0.65; x.drawImage(ov, 0, 0, cv.width, cv.height); x.globalAlpha = 1; if (boxR) { x.strokeStyle = '#ffe926'; x.lineWidth = 3; x.setLineDash([8, 6]); x.strokeRect(boxR[0] * cv.width, boxR[1] * cv.height, (boxR[2] - boxR[0]) * cv.width, (boxR[3] - boxR[1]) * cv.height); x.setLineDash([]); } }; let boxR = null, boxS = null; paint();
    K.$$('[data-m]', s.el).forEach((b) => (b.onclick = () => { mode = b.dataset.m; K.$$('[data-m]', s.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    K.$('#cutsl', s.el).appendChild(K.slider({ label: 'Brush', min: 6, max: 70, step: 1, value: size, fmt: (v) => v, oninput: (v) => (size = v) }));
    let down = false, lp = null;
    const pt = (ev) => { const r = cv.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * mk.width, ((ev.clientY - r.top) / r.height) * mk.height]; };
    const seed = (cvs, col, a, b) => { const q = K.ctx(cvs); q.save(); q.lineCap = 'round'; q.lineJoin = 'round'; q.lineWidth = (size / cv.width) * mk.width * 0.8; q.strokeStyle = col; q.fillStyle = col; q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); q.beginPath(); q.arc(b[0], b[1], q.lineWidth / 2, 0, 7); q.fill(); q.restore(); };
    const stroke = (a, b) => { s.drew = true; if (smart && (mode === 'add' || mode === 'erase')) { seed(mode === 'add' ? fgS : bgS, '#fff', a, b); seed(ov, mode === 'add' ? '#3ddc78' : '#ff465a', a, b); }  const x = K.ctx(mk); x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = (size / cv.width) * mk.width; x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.globalCompositeOperation = mode === 'add' ? 'source-over' : 'destination-out'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); x.beginPath(); x.arc(b[0], b[1], x.lineWidth / 2, 0, 7); x.fill(); x.restore(); };
    const nrm = (ev) => { const r = cv.getBoundingClientRect(); return [K.clamp((ev.clientX - r.left) / r.width, 0, 1), K.clamp((ev.clientY - r.top) / r.height, 0, 1)]; };
    cv.addEventListener('pointerdown', (ev) => { down = true; cv.setPointerCapture(ev.pointerId); if (mode === 'box') { boxS = nrm(ev); boxR = [...boxS, ...boxS]; paint(); return; } lp = pt(ev); stroke(lp, lp); paint(); });
    cv.addEventListener('pointermove', (ev) => { if (!down) return; if (mode === 'box') { const q = nrm(ev); boxR = [Math.min(boxS[0], q[0]), Math.min(boxS[1], q[1]), Math.max(boxS[0], q[0]), Math.max(boxS[1], q[1])]; paint(); return; } const p = pt(ev); stroke(lp, p); lp = p; paint(); });
    const endBox = async () => {
      if (!down) return; down = false;
      if (mode === 'add' || mode === 'erase') { if (smart && s.drew) { K.toast('Refining…', 600); await new Promise((r) => setTimeout(r, 20)); const m = K.seg.fromSeeds(ph.src, fgS, bgS, mk); mk = K.canvas(base.width, base.height); K.ctx(mk).drawImage(m, 0, 0, mk.width, mk.height); paint(); } return; }
      if (mode !== 'box' || !boxR) return; const [x0, y0, x1, y1] = boxR;
      if (x1 - x0 < 0.08 || y1 - y0 < 0.08) { boxR = null; paint(); return; }
      K.toast('Cutting out…', 900); await new Promise((r) => setTimeout(r, 30)); clearSeeds();
      const rect = { x0, y0, x1, y1 }; let m = null, usedAI = false;
      if (K.S.model) { m = await K.seg.model(ph.src); if (m) { usedAI = true; const cc = K.canvas(m.width, m.height), cx = K.ctx(cc); cx.drawImage(m, 0, 0); cx.globalCompositeOperation = 'destination-in'; cx.fillStyle = '#000'; cx.fillRect(x0 * cc.width, y0 * cc.height, (x1 - x0) * cc.width, (y1 - y0) * cc.height); m = cc; } }
      if (!m) m = K.seg.auto(ph.src, rect); s.drew = true; s.usedAI = usedAI; mk = K.canvas(base.width, base.height); K.ctx(mk).drawImage(m, 0, 0, mk.width, mk.height); boxR = null; paint();
      mode = 'add'; K.$$('[data-m]', s.el).forEach((x) => x.classList.toggle('on', x.dataset.m === 'add')); K.toast(usedAI ? 'AI cut-out ✓ · refine with Add / Erase' : 'Colour cut-out · paint green on the subject and red on the background to fix it', 3200);
    };
    ['pointerup', 'pointercancel'].forEach((n) => cv.addEventListener(n, endBox));
    K.$('[data-a]', s.el).onclick = async () => { K.toast('Finding subject…', 900); await new Promise((r) => setTimeout(r, 20)); const m = (await K.seg.model(ph.src)) || K.seg.auto(ph.src); mk = K.canvas(base.width, base.height); K.ctx(mk).drawImage(m, 0, 0, mk.width, mk.height); paint(); };
    K.$('[data-smart]', s.el).onclick = (ev) => { smart = !smart; ev.currentTarget.classList.toggle('on', smart); K.toast(smart ? 'Smart: strokes teach the app the subject / background colours' : 'Smart off: strokes edit the mask directly', 2200); };
    K.$('[data-all]', s.el).onclick = () => { clearSeeds(); mk = K.seg.full(base.width, base.height); s.drew = true; paint(); };
    K.$('[data-x]', s.el).onclick = () => s.close();
    K.$('[data-ok]', s.el).onclick = async () => {
      if (o.guide && !s.drew) { K.toast('Finding subject…', 900); await new Promise((r) => setTimeout(r, 30)); const m = (await K.seg.model(ph.src)) || K.seg.auto(ph.src); mk = K.canvas(base.width, base.height); K.ctx(mk).drawImage(m, 0, 0, mk.width, mk.height); }
      const nv = Math.max(...ph.masks.keys(), 0) + 1; ph.masks.set(nv, mk); const loc = o.guide ? K.$('#gloc', s.el).value.trim() : null; mut((st) => { st.col.mv = nv; if (loc !== null) st.col.loc = loc; }); s.close(); if (o.guide) buildPanel();
      if (o.guide) { setStack(true); draw(); K.toast('Original on top, collage below · tap Stack to switch', 2600); }
    };
  }

  /* ---------- crop toolbar ---------- */
  function syncCrop() { const e = C(); if (!e) return; K.$$('#ed-crop [data-r]').forEach((b) => b.classList.toggle('on', b.dataset.r === e.st.crop.ratio)); }
  function clampPan(e) { const mp = K.maxPan(e.ph, e.st, 1080, K.heightD(e.ph, e.st)), c = e.st.crop; c.px = K.clamp(c.px, -mp.x, mp.x); c.py = K.clamp(c.py, -mp.y, mp.y); }

  /* ---------- export ---------- */
  async function exportSheet() {
    await K.persistEditor(); const e = C();
    const s = K.sheet(`<h3>Export</h3><p class="mut">Full-resolution render of the current photo.</p><div class="row gap"><button class="btn pri" data-f="png">PNG</button><button class="btn pri" data-f="jpg">JPG</button></div>${e.st.col.id ? '<button class="btn pri block" data-f="stack">Original + collage (stacked PNG)</button>' : ""}<div class="row gap" style="margin-top:10px"><button class="btn" data-share>Share…</button><button class="btn" data-done>Done</button></div><p class="mut sm" id="exst"></p>`);
    const exp = async (fmt, share) => {
      K.$('#exst', s.el).textContent = 'Rendering…'; await new Promise((r) => setTimeout(r, 40));
      const long = Math.max(e.ph.w, e.ph.h), W = K.clamp(Math.round(e.st.crop.rot % 2 ? e.ph.h : e.ph.w), 1080, 3240); void long;
      let c = K.render(e.ph, e.st, { width: W, others: others(e) });
      if (fmt === 'stack') { const oh = Math.round((W * e.ph.h) / e.ph.w), gap = Math.round(W * 0.012), o2 = K.canvas(W, oh + gap + c.height), x2 = K.ctx(o2); x2.fillStyle = '#0b0b0d'; x2.fillRect(0, 0, o2.width, o2.height); x2.imageSmoothingQuality = 'high'; x2.drawImage(e.ph.src, 0, 0, W, oh); x2.drawImage(c, 0, oh + gap); c = o2; fmt = 'png'; }
      const type = fmt === 'png' ? 'image/png' : 'image/jpeg', blob = await K.toBlob(c, type, 0.93), name = `kapi-${Date.now()}.${fmt === 'png' ? 'png' : 'jpg'}`;
      K.$('#exst', s.el).textContent = `${c.width}×${c.height} · ${(blob.size / 1048576).toFixed(1)} MB`;
      K.shareOrDownload(blob, name, share);
    };
    K.$$('[data-f]', s.el).forEach((b) => (b.onclick = () => exp(b.dataset.f, false))); K.$('[data-share]', s.el).onclick = () => exp('jpg', true); K.$('[data-done]', s.el).onclick = () => { s.close(); leave(); };
  }
  K.shareOrDownload = async (blob, name, share) => {
    const file = new File([blob], name, { type: blob.type });
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Kapi' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); K.toast(share ? 'Sharing unavailable — downloaded instead' : 'Saved to downloads');
  };
  async function leave() { await K.persistEditor(); ed.list = []; K.clearRenderCache(); K.go(ed.from === 'cam' ? 'cam' : 'gal'); }

  /* ---------- wiring ---------- */
  K.screens.ed = {
    enter() { if (!K.$('#ed-tabs').children.length) buildTabs(); },
    leave() {},
  };
  K.initEditor = () => {
    buildTabs();
    K.$('#ed-back').onclick = leave; K.$('#ed-undo').onclick = () => jump(-1); K.$('#ed-redo').onclick = () => jump(1); K.$('#ed-ok').onclick = exportSheet;
    const hold = K.$('#ed-hold'); const hd = (v) => (ev) => { ev.preventDefault(); ed.hold = v; doDraw(); }; hold.addEventListener('pointerdown', hd(true)); ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => hold.addEventListener(n, hd(false)));
    const cb = K.$('#ed-cmpbtn'); cb.onclick = () => { ed.cmp = !ed.cmp; if (ed.cmp) setStack(false); cb.classList.toggle('on', ed.cmp); draw(); };
    K.$('#ed-stackbtn').onclick = () => { setStack(!ed.stack); draw(); };
    K.$$('#ed-crop [data-r]').forEach((b) => (b.onclick = () => { mut((s) => { s.crop.ratio = b.dataset.r; s.crop.px = s.crop.py = 0; s.crop.zoom = 1; }); syncCrop(); }));
    K.$('#ed-rot').onclick = () => { mut((s) => { s.crop.rot = (s.crop.rot + 1) % 4; s.crop.px = s.crop.py = 0; }); }; K.$('#ed-flip').onclick = () => mut((s) => { s.crop.flip = !s.crop.flip; });
    K.$('#ed-reset').onclick = () => mut((s) => { s.crop.zoom = 1; s.crop.px = s.crop.py = 0; });
    // gestures: pan / pinch / compare divider
    const cv = stage(), ptrs = new Map(); let lastD = 0, moved = false;
    cv.addEventListener('pointerdown', (ev) => { cv.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); lastD = 0; moved = false; if (ed.cmp) { const f = fitRect(); ed.cmpPos = K.clamp((ev.clientX - f.r.left - (f.r.width - f.w) / 2) / f.w, 0.02, 0.98); draw('draft'); } });
    cv.addEventListener('pointermove', (ev) => {
      if (!ptrs.has(ev.pointerId)) return; const prev = ptrs.get(ev.pointerId), e = C(); if (!e) return; const f = fitRect();
      if (ed.cmp) { ed.cmpPos = K.clamp((ev.clientX - f.r.left - (f.r.width - f.w) / 2) / f.w, 0.02, 0.98); draw('draft'); ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); return; }
      ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (ptrs.size === 1) { e.st.crop.px += (ev.clientX - prev[0]) / f.w; e.st.crop.py += (ev.clientY - prev[1]) / f.h; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (lastD) e.st.crop.zoom = K.clamp(e.st.crop.zoom * (d / lastD), 1, 4); lastD = d; }
      clampPan(e); moved = true; draw('draft');
    });
    const up = (ev) => { ptrs.delete(ev.pointerId); lastD = 0; if (moved && !ptrs.size) { commit(); draw(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (ev) => { ev.preventDefault(); const e = C(); e.st.crop.zoom = K.clamp(e.st.crop.zoom * (ev.deltaY < 0 ? 1.08 : 0.93), 1, 4); clampPan(e); draw('draft'); clearTimeout(cv._w); cv._w = setTimeout(commit, 300); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && K.cur === 'ed') K.persistEditor(); });
  };
})();
