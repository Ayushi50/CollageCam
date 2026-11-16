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
    if (!m) { m = K.seg.autoArt(ph.src); ph.masks.set(st.col.mv, m); }
    return m;
  };
  const tintC = (cv, col) => { const t = K.canvas(cv.width, cv.height), x = K.ctx(t); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height); return t; };

  /* auto-levels + lift so dim photos become light, airy watercolour */
  const levelsLift = (c) => {
    const x = K.ctx(c, 1), im = x.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Uint32Array(256); let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { hist[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++; n++; }
    let lo = 0, hi = 255, a = 0; for (let i = 0; i < 256; i++) { a += hist[i]; if (a > n * 0.02) { lo = i; break; } } a = 0; for (let i = 255; i >= 0; i--) { a += hist[i]; if (a > n * 0.015) { hi = i; break; } }
    const span = Math.max(60, hi - lo);
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { let v = (d[i + k] - lo) / span; v = Math.min(1, Math.max(0, v)); v = Math.pow(v, 0.72); v = v * 0.86 + 0.14 * 0.96; d[i + k] = v * 255; }
    x.putImageData(im, 0, 0);
  };

  /* darker warm pigment pooling along the edge, like wet watercolour */
  const wetEdge = (c) => {
    const W = c.width, H = c.height, x = K.ctx(c, 1), im = x.getImageData(0, 0, W, H), d = im.data;
    const sm = K.canvas(Math.max(4, W >> 2), Math.max(4, H >> 2)); K.ctx(sm).drawImage(c, 0, 0, sm.width, sm.height);
    const bl = K.canvas(W, H), bx = K.ctx(bl, 1); bx.imageSmoothingQuality = 'high'; bx.drawImage(sm, 0, 0, W, H); const b = bx.getImageData(0, 0, W, H).data;
    for (let i = 0; i < d.length; i += 4) { const al = d[i + 3] / 255, rim = Math.min(1, Math.max(0, (al - b[i + 3] / 255) * 1.7)) * al; if (rim > 0.02) { const k = 0.34 * rim; d[i] = d[i] * (1 - k) + 128 * k; d[i + 1] = d[i + 1] * (1 - k) + 84 * k; d[i + 2] = d[i + 2] * (1 - k) + 62 * k; } }
    x.putImageData(im, 0, 0);
  };

  /* painted subject cutout: crop to the mask box, filter, paint, then apply the mask (original Kapi Web pipeline) */
  const subject = (ph, st, pxW, pxH) => {
    const M = K.getMask(ph, st), bb = K.maskBox(M), kx = ph.w / M.width, ky = ph.h / M.height, sx = bb.x * kx, sy = bb.y * ky, sw = bb.w * kx, sh = bb.h * ky;
    const k = Math.min(pxW / sw, (pxH || pxW) / sh, 1.2), tw = Math.max(8, Math.round(sw * k)), th = Math.max(8, Math.round(sh * k));
    return lru(subjCache, [ph.id, ph.ver, st.col.mv, tw, th, fkey(st.f)].join('|'), () => {
      const c = K.canvas(tw, th), g = K.ctx(c, 1); g.drawImage(ph.src, sx, sy, sw, sh, 0, 0, tw, th);
      K.filterCanvas(c, K.preset(st.f.id), { k: st.f.k, temp: st.f.temp, tint: st.f.tint, exp: st.f.exp, wb: st.f.wb, iso: st.f.iso, beauty: st.f.beauty, seed: K.hash(ph.id) % 997 });
      K.paintify(c);
      g.globalCompositeOperation = 'destination-in'; g.imageSmoothingQuality = 'high'; g.drawImage(M, bb.x, bb.y, bb.w, bb.h, 0, 0, tw, th);
      return { canvas: c };
    }, 16);
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
        sc, seed, R: K.rng(seed + 31), v: st.col.v, c: st.col, date: K.fmtDate(new Date(st.wm.date || date), 'type'), dateDot: (() => { const q = new Date(st.wm.date || date); return `${q.getFullYear()}.${String(q.getMonth() + 1).padStart(2, '0')}.${String(q.getDate()).padStart(2, '0')}`; })(),
        cell(i, w, h) {
          const p = i === 0 ? ph : others[(i - 1) % others.length], same = p === ph; let crop;
          if (i > 0 && same) crop = { zoom: 1 + 0.18 * i, px: ((i % 2) * 2 - 1) * 0.05 * i, py: 0.04 * i };
          return K.photoCell(p, st, w * sc, h * sc, { main: i === 0, crop });
        },
        subject(pxw, pxh) { return subject(ph, st, pxw, pxh); },
      };
      ctx.save(); ctx.scale(sc, sc); tpl.draw(ctx, 1080, Hd, E); ctx.restore();
    } else ctx.drawImage(K.photoCell(ph, st, W, H, { main: true }), 0, 0);
    if (st.light.id) K.light.draw(ctx, W, H, st.light.id, st.light.k, seed);
    if (st.fx.id) K.effects.apply(out, st.fx.id, st.fx.k, seed);
    let final = out, inner = { x: 0, y: 0, w: W, h: H };
    if (st.border.id) { const b = K.borders.apply(out, st.border.id, st.border.k, st.border.dark, seed); final = b.canvas; inner = b.inner; }
    if (st.wm.on && !st.col.id) K.watermark.draw(K.ctx(final), W, H, st.wm, inner, date);
    return final;
  };
})();
