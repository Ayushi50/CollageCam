/* Kapi Web — non-destructive render pipeline (1080-wide design coordinates) */
(function () {
  const K = window.K;
  K.RATIOS = { '9:16': 1920, '3:4': 1440, '4:5': 1350, '1:1': 1080 };
  K.defaultEdit = (o = {}) => ({
    f: { id: o.filter || K.S.filter, k: 1, temp: 0, tint: 0, exp: 0, wb: 0, iso: 0, beauty: 0, lens: 0 },
    crop: { ratio: o.ratio || K.S.ratio, rot: 0, flip: false, zoom: 1, px: 0, py: 0 },
    light: { id: null, k: 0.7 }, fx: { id: null, k: 0.6 }, border: { id: null, k: 0.5, dark: false },
    wm: { on: o.dateOn == null ? K.S.dateOn : o.dateOn, style: K.S.dateStyle, date: null, text: '' },
    col: { id: null, v: 0, mv: 0, loc: '', title: '', labels: null },
  });
  K.clone = (o) => JSON.parse(JSON.stringify(o));

  /* photo model: {id, src(canvas), w, h, ver, masks:Map, created} */
  K.makePhoto = (id, src, created) => ({ id, src, w: src.width, h: src.height, ver: 0, masks: new Map(), created: created || Date.now() });

  const cellCache = new Map(), subjCache = new Map();
  K.clearRenderCache = () => { cellCache.clear(); subjCache.clear(); };
  const lru = (m, key, make, max) => { if (m.has(key)) { const v = m.get(key); m.delete(key); m.set(key, v); return v; } const v = make(); m.set(key, v); if (m.size > max) m.delete(m.keys().next().value); return v; };

  const heightD = (ph, st) => { const r = st.crop.ratio; if (K.RATIOS[r]) return K.RATIOS[r]; const sw = st.crop.rot % 2 ? ph.h / ph.w : ph.w / ph.h; return 1080 / sw; };
  K.heightD = heightD;
  const drawXform = (ctx, drawable, dw, dh, wpx, hpx, cr) => {
    const rt = ((cr.rot % 4) + 4) % 4, iw = rt % 2 ? dh : dw, ih = rt % 2 ? dw : dh, s = Math.max(wpx / iw, hpx / ih) * cr.zoom;
    ctx.save(); ctx.translate(wpx / 2 + cr.px * wpx, hpx / 2 + cr.py * hpx); ctx.rotate((rt * Math.PI) / 2); ctx.scale(cr.flip ? -1 : 1, 1); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(drawable, (-dw * s) / 2, (-dh * s) / 2, dw * s, dh * s); ctx.restore();
  };
  K.maxPan = (ph, st, wD, hD) => { const cr = st.crop, rt = cr.rot % 2, iw = rt ? ph.h : ph.w, ih = rt ? ph.w : ph.h, s = Math.max(wD / iw, hD / ih) * cr.zoom; return { x: Math.max(0, (iw * s - wD) / 2 / wD), y: Math.max(0, (ih * s - hD) / 2 / hD) }; };

  const fkey = (f) => [f.id, f.k, f.temp, f.tint, f.exp, f.wb, f.iso, f.beauty, f.lens].join(',');
  /* filtered cover-cropped cell. pan/zoom applies only when main */
  K.photoCell = (ph, st, wpx, hpx, o = {}) => {
    wpx = Math.max(1, Math.round(wpx)); hpx = Math.max(1, Math.round(hpx));
    const cr = o.main ? st.crop : Object.assign({ rot: 0, flip: false, zoom: 1, px: 0, py: 0 }, o.crop || {});
    const key = [ph.id, ph.ver, wpx, hpx, o.main ? 1 : 0, o.raw ? 'raw' : fkey(st.f), cr.rot, cr.flip, cr.zoom.toFixed(3), cr.px.toFixed(3), cr.py.toFixed(3)].join('|');
    return lru(cellCache, key, () => {
      const c = K.canvas(wpx, hpx), x = K.ctx(c); drawXform(x, ph.src, ph.w, ph.h, wpx, hpx, cr);
      if (!o.raw) { if (st.f.lens > 0) K.fisheye(c, st.f.lens); K.filterCanvas(c, K.preset(st.f.id), { k: st.f.k, temp: st.f.temp, tint: st.f.tint, exp: st.f.exp, wb: st.f.wb, iso: st.f.iso, beauty: st.f.beauty, seed: K.hash(ph.id) % 997 }); }
      return c;
    }, 40);
  };

  K.getMask = (ph, st) => {
    let m = ph.masks.get(st.col.mv);
    if (!m) { m = K.seg.auto(ph.src); ph.masks.set(st.col.mv, m); }
    return m;
  };
  const tintC = (cv, col) => { const t = K.canvas(cv.width, cv.height), x = K.ctx(t); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height); return t; };

  /* painted subject cutout */
  const subject = (ph, st, pxW) => {
    const mk = K.getMask(ph, st), res = K.clamp(Math.round(pxW / 8) * 8, 96, 720);
    return lru(subjCache, [ph.id, ph.ver, st.col.mv, fkey(st.f), res, st.crop.rot, st.crop.flip, mk.width].join('|'), () => {
      const asp = st.crop.rot % 2 ? ph.h / ph.w : ph.w / ph.h, w = asp >= 1 ? res : Math.round(res * asp), h = asp >= 1 ? Math.round(res / asp) : res;
      const cell = K.photoCell(ph, st, w, h, { main: false, crop: { rot: st.crop.rot, flip: st.crop.flip } }), c = K.canvas(w, h), x = K.ctx(c); x.drawImage(cell, 0, 0);
      const mc = K.canvas(w, h), mx = K.ctx(mc); drawXform(mx, mk, mk.width, mk.height, w, h, { rot: st.crop.rot, flip: st.crop.flip, zoom: 1, px: 0, py: 0 });
      const mctx = K.ctx(mc, 1), mi = mctx.getImageData(0, 0, w, h), md = mi.data; for (let i = 3; i < md.length; i += 4) md[i] = Math.max(0, Math.min(255, (md[i] - 128) * 3 + 128)); mctx.putImageData(mi, 0, 0);
      const cov = K.seg.coverage(mc);
      x.globalCompositeOperation = 'destination-in';
      if (cov < 0.02) { const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.55); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
      else x.drawImage(mc, 0, 0);
      x.globalCompositeOperation = 'source-over';
      const d = K.ctx(c, 1).getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
      const pad = Math.round(res * 0.02), bx = Math.max(0, x0 - pad), by = Math.max(0, y0 - pad), bw = Math.min(w - bx, x1 - x0 + 2 * pad), bh = Math.min(h - by, y1 - y0 + 2 * pad), out = K.canvas(bw, bh);
      K.ctx(out).drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
      K.paintCanvas(out);
      const ol = K.canvas(bw + 12, bh + 12), ox = K.ctx(ol), ink = tintC(out, 'rgba(45,36,70,.85)'), t = Math.max(1.5, res / 150);
      for (let a = 0; a < 8; a++) ox.drawImage(ink, 6 + Math.cos((a * Math.PI) / 4) * t, 6 + Math.sin((a * Math.PI) / 4) * t);
      ox.drawImage(out, 6, 6);
      return { canvas: ol };
    }, 6);
  };

  /* main render. o: {width, others:[photos], raw:bool(no edits)} → canvas */
  K.render = function (ph, st, o = {}) {
    const W = Math.round(o.width || 720), sc = W / 1080, Hd = heightD(ph, st), H = Math.round(Hd * sc);
    const out = K.canvas(W, H), ctx = K.ctx(out);
    if (o.raw) { ctx.drawImage(K.photoCell(ph, st, W, H, { main: true, raw: true }), 0, 0); return out; }
    const others = o.others && o.others.length ? o.others : [ph];
    const seed = K.hash(ph.id) % 997, date = ph.created;
    if (st.col.id) {
      const tpl = K.COLMAP[st.col.id];
      const E = {
        sc, seed, R: K.rng(seed + 31), v: st.col.v, c: st.col, date: st.wm.on ? '' : K.fmtDate(new Date(st.wm.date || date), 'type'),
        cell(i, w, h) {
          const p = i === 0 ? ph : others[(i - 1) % others.length], same = p === ph; let crop;
          if (i > 0 && same) crop = { zoom: 1 + 0.18 * i, px: ((i % 2) * 2 - 1) * 0.05 * i, py: 0.04 * i };
          return K.photoCell(p, st, w * sc, h * sc, { main: i === 0, crop });
        },
        subject(pxw) { return subject(ph, st, pxw); },
      };
      ctx.save(); ctx.scale(sc, sc); tpl.draw(ctx, 1080, Hd, E); ctx.restore();
    } else ctx.drawImage(K.photoCell(ph, st, W, H, { main: true }), 0, 0);
    if (st.light.id) K.light.draw(ctx, W, H, st.light.id, st.light.k, seed);
    if (st.fx.id) K.effects.apply(out, st.fx.id, st.fx.k, seed);
    let final = out, inner = { x: 0, y: 0, w: W, h: H };
    if (st.border.id) { const b = K.borders.apply(out, st.border.id, st.border.k, st.border.dark, seed); final = b.canvas; inner = b.inner; }
    if (st.wm.on) K.watermark.draw(K.ctx(final), W, H, st.wm, inner, date);
    return final;
  };
})();
