/* Kapi Web — per-pixel filter engine, presets, AI pick */
(function () {
  const K = window.K;
  const P = (id, name, cat, o) => Object.assign({ id, name, cat, b: 0, c: 1, s: 1, t: [1, 1, 1], sh: [0, 0, 0], hi: [0, 0, 0], fade: 0, vig: 0, glow: 0, flash: 0, grain: 0, scan: 0, pix: 0, ca: 0, bw: 0, post: 0 }, o);
  K.CATS = ['DV', 'CCD', 'Film', 'Disposable', 'VHS', 'Y2K', 'Night', 'Mono'];
  K.PRESETS = [
    P('none', 'Original', 'DV', {}),
    P('dv1', 'DV Classic', 'DV', { b: 0.02, c: 1.1, s: 0.85, t: [1.02, 1, 0.96], fade: 0.1, vig: 0.25, grain: 0.25, scan: 0.2, ca: 1 }),
    P('dv2', 'Cam 98', 'DV', { c: 1.2, s: 0.9, t: [1, 1.03, 0.95], hi: [0.03, 0.02, 0], grain: 0.3, vig: 0.35, scan: 0.3 }),
    P('dv3', 'Handycam', 'DV', { b: 0.03, c: 1.05, s: 1.05, t: [0.97, 1.05, 0.95], fade: 0.12, grain: 0.35, scan: 0.35, ca: 1.5, vig: 0.2 }),
    P('dv4', 'Tape Diary', 'DV', { c: 1.1, s: 0.75, t: [1.06, 1, 0.9], fade: 0.2, grain: 0.35, vig: 0.3, scan: 0.15 }),
    P('dv5', 'DV Night', 'DV', { b: 0.08, c: 1.2, s: 0.8, t: [0.9, 1.0, 1.12], sh: [0, 0.02, 0.06], grain: 0.5, scan: 0.25, vig: 0.3 }),
    P('ccd1', 'CCD Flash', 'CCD', { c: 1.25, s: 1.2, t: [1.05, 1, 0.95], hi: [0.04, 0.03, 0.01], flash: 0.5, glow: 0.25, grain: 0.15, ca: 1 }),
    P('ccd2', 'SONY', 'CCD', { c: 1.12, s: 1.05, t: [0.94, 1, 1.1], sh: [0, 0.02, 0.06], glow: 0.2, vig: 0.15, ca: 1.5, grain: 0.12 }),
    P('ccd3', 'Digicam 03', 'CCD', { b: 0.05, s: 1.15, fade: 0.15, glow: 0.3, t: [1, 0.98, 0.95], grain: 0.15, vig: 0.15 }),
    P('ccd4', 'Cyber-shot', 'CCD', { c: 1.2, s: 1.25, t: [0.97, 1.02, 1.08], glow: 0.25, ca: 2, vig: 0.2 }),
    P('ccd5', 'Pocket CCD', 'CCD', { b: 0.03, c: 1.3, s: 1.1, t: [1.04, 1, 0.97], flash: 0.35, grain: 0.3, vig: 0.25, n: 1 }),
    P('film1', 'Gold 200', 'Film', { c: 1.08, s: 1.1, t: [1.08, 1.02, 0.88], sh: [0.05, 0.02, 0], hi: [0.04, 0.02, -0.02], fade: 0.12, grain: 0.35, vig: 0.3 }),
    P('film2', 'FUJI-X', 'Film', { b: -0.04, c: 1.15, s: 0.9, t: [0.92, 1.04, 1.03], sh: [0, 0.03, 0.04], hi: [0, 0.02, 0], fade: 0.08, grain: 0.3, vig: 0.35 }),
    P('film3', 'Portra', 'Film', { b: 0.03, c: 0.98, s: 0.92, t: [1.04, 1.01, 0.96], sh: [0.02, 0.01, 0.02], fade: 0.1, grain: 0.22, vig: 0.12 }),
    P('film4', 'Cinema', 'Film', { c: 1.2, s: 0.95, sh: [-0.02, 0.03, 0.07], hi: [0.07, 0.02, -0.04], vig: 0.45, grain: 0.2 }),
    P('film5', 'Faded', 'Film', { c: 0.9, s: 0.8, fade: 0.38, grain: 0.25, vig: 0.15 }),
    P('film6', 'Sepia', 'Film', { c: 1.05, s: 0.1, t: [1.22, 1, 0.72], fade: 0.15, grain: 0.25, vig: 0.3 }),
    P('disp1', 'Disposable', 'Disposable', { c: 1.3, s: 1.15, t: [1.05, 1, 0.92], flash: 0.6, glow: 0.15, grain: 0.45, vig: 0.35 }),
    P('disp2', 'Flash 27', 'Disposable', { b: -0.05, c: 1.35, s: 1.1, t: [1.02, 1, 0.95], flash: 0.85, grain: 0.4, vig: 0.4 }),
    P('disp3', 'LOMO', 'Disposable', { c: 1.25, s: 1.45, t: [1.04, 1, 1.02], vig: 0.8, grain: 0.25, sh: [0, 0, 0.03] }),
    P('disp4', 'Funsaver', 'Disposable', { c: 1.1, s: 1.05, t: [0.98, 1.05, 0.9], fade: 0.18, flash: 0.35, grain: 0.4, vig: 0.3, n: 1 }),
    P('vhs1', 'VHS Tape', 'VHS', { s: 1.1, c: 1.1, t: [1, 1, 1.05], fade: 0.12, scan: 0.5, ca: 2.5, grain: 0.4 }),
    P('vhs2', 'Camcorder', 'VHS', { b: 0.02, s: 0.9, t: [1.04, 1, 0.94], fade: 0.15, scan: 0.35, ca: 1.8, grain: 0.3, vig: 0.3 }),
    P('vhs3', 'Rewind', 'VHS', { c: 1.2, s: 1.3, t: [1.05, 0.95, 1.1], scan: 0.6, ca: 3.5, grain: 0.5, glow: 0.2, n: 1 }),
    P('y2k1', 'Nokia', 'Y2K', { pix: 150, s: 0.85, c: 1.15, t: [0.95, 1.05, 0.92], grain: 0.15, post: 28 }),
    P('y2k2', 'Pixel Y2K', 'Y2K', { pix: 240, s: 1.3, c: 1.2, grain: 0.1 }),
    P('y2k3', 'Chrome', 'Y2K', { c: 1.3, s: 1.2, t: [0.95, 1, 1.1], hi: [0, 0.02, 0.07], glow: 0.35, ca: 1, n: 1 }),
    P('y2k4', 'Bubblegum', 'Y2K', { b: 0.04, s: 1.3, sh: [0.04, 0, 0.06], hi: [0.06, 0.02, 0.04], glow: 0.3, fade: 0.1 }),
    P('y2k5', 'Pastel', 'Y2K', { b: 0.08, c: 0.85, s: 0.85, t: [1.03, 1.01, 1.04], fade: 0.25, glow: 0.2 }),
    P('n1', 'XT30', 'Night', { b: 0.02, c: 1.25, s: 1.2, t: [0.95, 1.02, 1.1], sh: [-0.01, 0.03, 0.07], hi: [0.07, 0.02, -0.03], glow: 0.35, grain: 0.35, vig: 0.4 }),
    P('n2', 'Neon Rain', 'Night', { b: -0.03, c: 1.3, s: 1.5, t: [1.05, 0.95, 1.12], sh: [0.04, 0, 0.08], glow: 0.45, grain: 0.3, vig: 0.4 }),
    P('n3', 'Moonlit', 'Night', { b: 0.04, c: 1.1, s: 0.7, t: [0.85, 0.98, 1.2], sh: [0, 0.02, 0.07], grain: 0.35, vig: 0.4, n: 1 }),
    P('m1', 'Mono', 'Mono', { bw: 1, c: 1.2 }),
    P('m2', 'Noir', 'Mono', { bw: 1, c: 1.5, b: -0.05, vig: 0.5, grain: 0.35 }),
    P('m3', 'Manga', 'Mono', { bw: 1, c: 2.1, b: 0.04, post: 4, grain: 0.1, scan: 0.12 }),
    P('m4', 'Silver Grain', 'Mono', { bw: 1, c: 1.05, fade: 0.2, grain: 0.6, vig: 0.25, n: 1 }),
  ];
  K.PMAP = {}; K.PRESETS.forEach((p) => (K.PMAP[p.id] = p));
  K.preset = (id) => K.PMAP[id] || K.PMAP.none;

  /* pixel-level core. c: canvas modified in place. o: {k,temp,tint,exp,wb,iso,beauty,seed} */
  K.filterCanvas = function (c, p, o = {}) {
    const W = c.width, H = c.height, ctx = K.ctx(c, 1);
    const k = o.k == null ? 1 : o.k;
    const temp = (o.temp || 0) + (o.wb || 0), tintK = o.tint || 0, expo = o.exp || 0, iso = o.iso || 0, beauty = o.beauty || 0;
    const neutral = p.id === 'none' && !temp && !tintK && !expo && !iso && !beauty;
    if (neutral) return c;
    if (p.pix && k > 0) { // low-res: downscale then nearest upscale
      const pw = Math.max(16, Math.round(p.pix * (W < 300 ? 0.6 : 1))), ph = Math.max(12, Math.round((pw * H) / W));
      const t = K.canvas(pw, ph); const tc = K.ctx(t); tc.imageSmoothingQuality = 'high'; tc.drawImage(c, 0, 0, pw, ph);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
    }
    let blurD = null;
    if (beauty > 0) { // light bilateral approximation: edge-aware blend with blurred copy
      const sm = K.canvas(Math.max(8, W / 3), Math.max(8, H / 3)); const sc = K.ctx(sm); sc.imageSmoothingQuality = 'high'; sc.drawImage(c, 0, 0, sm.width, sm.height);
      const bg = K.canvas(W, H); const bc = K.ctx(bg, 1); bc.imageSmoothingQuality = 'high'; bc.drawImage(sm, 0, 0, W, H);
      blurD = bc.getImageData(0, 0, W, H).data;
    }
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const src = p.ca > 0 || o.fresh ? new Uint8ClampedArray(d) : null;
    const caPx = Math.round(p.ca * (W / 540)); // chroma shift in px
    const seed = (o.seed || 1) | 0;
    const t0 = p.t[0] * (1 + temp * 0.22), t1 = p.t[1] * (1 - tintK * 0.15), t2 = p.t[2] * (1 - temp * 0.22);
    const tr = 1 + Math.max(0, tintK) * 0.07, tb = 1 + Math.max(0, tintK) * 0.07;
    const ex = Math.pow(2, expo * 1.2), cn = p.c, br = p.b, sat = p.s, fade = p.fade * 0.25;
    const grain = Math.min(1, p.grain + iso * 0.9) * 0.34, scan = p.scan * 0.38, vig = p.vig, fl = p.flash;
    const cx = W / 2, cy = H / 2, inv = 1 / Math.hypot(cx, cy), bw = p.bw, post = p.post;
    const sh0 = p.sh[0], sh1 = p.sh[1], sh2 = p.sh[2], hi0 = p.hi[0], hi1 = p.hi[1], hi2 = p.hi[2];
    const lineH = Math.max(2, Math.round(W / 220));
    for (let y = 0, i = 0; y < H; y++) {
      const dy = (y - cy) * (y - cy);
      const sl = scan && Math.floor(y / lineH) % 2 === 0 ? 1 - scan : 1;
      for (let x = 0; x < W; x++, i += 4) {
        let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const r0 = r, g0 = g, b0 = b;
        if (caPx) { const xr = Math.min(W - 1, x + caPx), xb = Math.max(0, x - caPx); r = src[(y * W + xr) * 4] / 255; b = src[(y * W + xb) * 4 + 2] / 255; }
        if (blurD) { // blend with blur where local difference small (skin-ish smoothing)
          const dl = Math.abs(r - blurD[i] / 255) + Math.abs(g - blurD[i + 1] / 255) + Math.abs(b - blurD[i + 2] / 255);
          const w = beauty * Math.exp(-dl * dl * 40) * 0.85;
          r += (blurD[i] / 255 - r) * w; g += (blurD[i + 1] / 255 - g) * w; b += (blurD[i + 2] / 255 - b) * w;
        }
        r *= t0 * ex * tr; g *= t1 * ex; b *= t2 * ex * tb;
        r = (r - 0.5) * cn + 0.5 + br; g = (g - 0.5) * cn + 0.5 + br; b = (b - 0.5) * cn + 0.5 + br;
        let l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (bw) { r = g = b = l; } else if (sat !== 1) { r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
        if (sh0 || sh1 || sh2 || hi0 || hi1 || hi2) {
          const lc = l < 0 ? 0 : l > 1 ? 1 : l, ws = (1 - lc) * (1 - lc), wh = lc * lc;
          r += sh0 * ws + hi0 * wh; g += sh1 * ws + hi1 * wh; b += sh2 * ws + hi2 * wh;
        }
        if (fade) { r = r * (1 - fade) + fade; g = g * (1 - fade) + fade; b = b * (1 - fade) + fade; }
        if (vig || fl) {
          const dd = Math.sqrt((x - cx) * (x - cx) + dy) * inv; // 0 center → 1 corner
          if (vig) { const v = 1 - vig * Math.max(0, (dd - 0.3) / 0.7) * Math.max(0, (dd - 0.3) / 0.7) * 1.3; r *= v; g *= v; b *= v; }
          if (fl) { const f = fl * 0.32 * Math.max(0, 1 - dd * 1.25) * Math.max(0, 1 - dd * 1.25); r += f * 1.0; g += f * 0.96; b += f * 0.85; }
        }
        if (grain) {
          let hh = Math.imul(x * 374761393 + y * 668265263 + seed * 1274126177, 1103515245); hh ^= hh >>> 13; hh = Math.imul(hh, 1274126177); hh ^= hh >>> 16;
          const n = ((hh & 1023) / 1023 - 0.5) * grain; r += n; g += n; b += n;
        }
        if (post) {
          if (bw) { l = r; const q = Math.round(l * (post - 1)) / (post - 1); r = g = b = q; }
          else { const q = post; r = Math.round(r * q) / q; g = Math.round(g * q) / q; b = Math.round(b * q) / q; }
        }
        if (sl !== 1) { r *= sl; g *= sl; b *= sl; }
        if (k !== 1) { r = r0 + (r - r0) * k; g = g0 + (g - g0) * k; b = b0 + (b - b0) * k; }
        d[i] = r < 0 ? 0 : r > 1 ? 255 : r * 255; d[i + 1] = g < 0 ? 0 : g > 1 ? 255 : g * 255; d[i + 2] = b < 0 ? 0 : b > 1 ? 255 : b * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (p.glow && k > 0) K.bloom(c, p.glow * k);
    return c;
  };

  /* bloom: blur highlights via downscale, screen back */
  K.bloom = function (c, amt) {
    const W = c.width, H = c.height, s = K.canvas(Math.max(8, W / 7), Math.max(8, H / 7)), sc = K.ctx(s);
    sc.imageSmoothingQuality = 'high'; sc.drawImage(c, 0, 0, s.width, s.height);
    sc.globalCompositeOperation = 'multiply'; sc.drawImage(s, 0, 0); // emphasise highlights
    const ctx = K.ctx(c); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(1, amt * 0.9); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s, 0, 0, W, H); ctx.restore();
  };

  /* fisheye / barrel lens (bilinear remap) */
  K.fisheye = function (c, amt) {
    if (amt <= 0) return c;
    const W = c.width, H = c.height, ctx = K.ctx(c, 1), src = ctx.getImageData(0, 0, W, H), out = ctx.createImageData(W, H), sd = src.data, od = out.data;
    const kk = 0.9 * amt, norm = 1 + kk * 2;
    for (let y = 0; y < H; y++) {
      const ny = (y / (H - 1)) * 2 - 1;
      for (let x = 0; x < W; x++) {
        const nx = (x / (W - 1)) * 2 - 1, f = (1 + kk * (nx * nx + ny * ny)) / norm;
        const sx = ((nx * f + 1) / 2) * (W - 1), sy = ((ny * f + 1) / 2) * (H - 1);
        const x0 = sx | 0, y0 = sy | 0, x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
        const a = (y0 * W + x0) * 4, b = (y0 * W + x1) * 4, c2 = (y1 * W + x0) * 4, d2 = (y1 * W + x1) * 4, o = (y * W + x) * 4;
        for (let ch = 0; ch < 3; ch++) od[o + ch] = (sd[a + ch] * (1 - fx) + sd[b + ch] * fx) * (1 - fy) + (sd[c2 + ch] * (1 - fx) + sd[d2 + ch] * fx) * fy;
        od[o + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0); return c;
  };

  /* scene analysis + AI pick */
  K.analyze = function (src) {
    const t = K.canvas(48, 64), tc = K.ctx(t, 1); tc.drawImage(src, 0, 0, 48, 64);
    const d = tc.getImageData(0, 0, 48, 64).data, n = 48 * 64; let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, ss = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, l = 0.299 * r + 0.587 * g + 0.114 * b; sr += r; sg += g; sb += b; sl += l; sl2 += l * l; ss += Math.max(r, g, b) - Math.min(r, g, b); }
    const ml = sl / n;
    return { luma: ml, contrast: Math.sqrt(Math.max(0, sl2 / n - ml * ml)), cast: (sr - sb) / n, green: (sg - (sr + sb) / 2) / n, sat: ss / n };
  };
  K.aiPick = function (src, count = 3) {
    const a = K.analyze(src);
    const scored = K.PRESETS.filter((p) => p.id !== 'none').map((p) => {
      let sc = 0;
      const outL = a.luma + p.b * 0.9 + (p.flash * 0.08); sc -= Math.abs(outL - 0.46) * 3;
      const outC = a.contrast * p.c; sc -= Math.abs(outC - 0.24) * 3.5;
      const warm = (p.t[0] - p.t[2]) + (p.hi[0] - p.hi[2]) * 2; sc -= Math.abs(a.cast + warm * 0.5) * 2.2; // neutralise cast
      const outS = a.sat * p.s; sc -= Math.abs(outS - 0.32) * 1.5;
      if (a.luma < 0.25 && p.cat === 'Night') sc += 0.7;
      if (a.luma < 0.3 && p.flash) sc += 0.5;
      if (a.luma > 0.65 && (p.cat === 'Y2K' || p.id === 'film5' || p.id === 'film3')) sc += 0.4;
      if (a.contrast < 0.12 && p.bw) sc += 0.3;
      sc -= p.vig * 0.1 + p.grain * 0.05;
      return { p, sc };
    }).sort((x, y) => y.sc - x.sc);
    return { stats: a, picks: scored.slice(0, count).map((s) => s.p) };
  };

  /* filter strip UI (carousel with categories, favourites, new badge) */
  K.catList = () => {
    const base = ['★', ...K.CATS]; let order = K.S.catOrder;
    if (order) order = order.filter((c) => base.includes(c)).concat(base.filter((c) => !order.includes(c))); else order = base;
    return order;
  };
  K.filterStrip = function (host, o) {
    host.innerHTML = '<div class="cats"></div><div class="fcar"></div>';
    const catsEl = K.$('.cats', host), car = K.$('.fcar', host); let cat = 'All', cards = {}, src = null, cur = o.current();
    const tw = 54, th = 72;
    const visibleCats = () => ['All', ...K.catList().filter((c) => !K.S.hiddenCats.includes(c))];
    const list = () => cat === 'All' ? K.PRESETS.filter((p) => !K.S.hiddenCats.includes(p.cat) || K.S.favs.includes(p.id)) : cat === '★' ? K.PRESETS.filter((p) => K.S.favs.includes(p.id)) : K.PRESETS.filter((p) => p.cat === cat);
    function drawCats() {
      catsEl.innerHTML = '';
      visibleCats().forEach((c) => { const b = K.h(`<button class="chip ${c === cat ? 'on' : ''}">${c}</button>`); b.onclick = () => { cat = c; drawCats(); drawCards(); }; catsEl.appendChild(b); });
      const m = K.h('<button class="chip" title="Manage categories">⋯</button>'); m.onclick = manage; catsEl.appendChild(m);
    }
    function drawCards() {
      car.innerHTML = ''; cards = {};
      const l = list(); if (!l.length) car.innerHTML = '<div class="mut pad">Long-press a filter to pin it here ★</div>';
      l.forEach((p) => {
        const card = K.h(`<div class="fc ${p.id === cur ? 'on' : ''}"><canvas width="${tw}" height="${th}"></canvas><span>${p.name}</span></div>`);
        if (p.n && !K.S.newSeen[p.id]) card.appendChild(K.h('<i class="badge new">NEW</i>'));
        if (K.S.favs.includes(p.id)) card.appendChild(K.h('<i class="badge fav">★</i>'));
        let timer, long = false;
        card.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; const f = K.S.favs; const i = f.indexOf(p.id); if (i < 0) f.push(p.id); else f.splice(i, 1); K.save(); K.haptic(25); K.toast(i < 0 ? `★ Pinned ${p.name}` : `Unpinned ${p.name}`); drawCards(); }, 520); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => card.addEventListener(ev, () => clearTimeout(timer)));
        card.addEventListener('click', () => { if (long) return; K.S.newSeen[p.id] = 1; K.save(); cur = p.id; K.$$('.fc', car).forEach((e) => e.classList.remove('on')); card.classList.add('on'); K.$('.badge.new', card)?.remove(); K.haptic(8); o.onpick(p.id); });
        car.appendChild(card); cards[p.id] = card;
      });
      if (src) paint();
    }
    function paint() { Object.keys(cards).forEach((id) => { const cv = K.$('canvas', cards[id]), cx = K.ctx(cv, 1); const sw = src.width, sh = src.height, sr = tw / th; let w = sw, h = sw / sr; if (h > sh) { h = sh; w = sh * sr; } cx.drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, tw, th); K.filterCanvas(cv, K.preset(id), { seed: 3 }); }); }
    function manage() {
      const s = K.sheet('<h3>Filter categories</h3><p class="mut">Reorder or hide categories.</p><div id="catm"></div><button class="btn pri block" data-ok>Done</button>');
      const box = K.$('#catm', s.el);
      const draw = () => { box.innerHTML = ''; K.catList().forEach((c, i, arr) => { const hid = K.S.hiddenCats.includes(c); const r = K.h(`<div class="lr"><b>${c === '★' ? '★ Favourites' : c}</b><span><button class="ib" data-u>↑</button><button class="ib" data-d>↓</button><button class="chip ${hid ? '' : 'on'}" data-h>${hid ? 'Hidden' : 'Shown'}</button></span></div>`); K.$('[data-u]', r).onclick = () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; K.S.catOrder = arr; K.save(); draw(); } }; K.$('[data-d]', r).onclick = () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; K.S.catOrder = arr; K.save(); draw(); } }; K.$('[data-h]', r).onclick = () => { const h = K.S.hiddenCats; const j = h.indexOf(c); if (j < 0) h.push(c); else h.splice(j, 1); K.save(); draw(); }; box.appendChild(r); }); };
      draw(); K.$('[data-ok]', s.el).onclick = () => { s.close(); cat = 'All'; drawCats(); drawCards(); };
    }
    drawCats(); drawCards();
    return { refresh(s) { src = s; paint(); }, set(id) { cur = id; K.$$('.fc', car).forEach((e) => e.classList.remove('on')); cards[id]?.classList.add('on'); cards[id]?.scrollIntoView?.({ inline: 'center', block: 'nearest' }); }, rebuild() { drawCats(); drawCards(); } };
  };
})();
