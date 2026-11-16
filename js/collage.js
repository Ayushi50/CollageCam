/* Kapi Web — original collage templates drawn on canvas + subject segmentation/painting */
(function () {
  const K = window.K;
  const TAU = Math.PI * 2;

  /* ---------- segmentation ---------- */
  K.seg = {
    L: 192,
    auto(src) {
      const sc = this.L / Math.max(src.width, src.height), w = Math.max(8, Math.round(src.width * sc)), h = Math.max(8, Math.round(src.height * sc));
      const t = K.canvas(w, h), tc = K.ctx(t, 1); tc.drawImage(src, 0, 0, w, h); const d = tc.getImageData(0, 0, w, h).data, n = w * h;
      // background samples from border ring → 3 centres (k-means)
      const ring = Math.max(2, Math.round(Math.min(w, h) * 0.07)), pts = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y < ring || ((x < ring || x >= w - ring) && y < h * 0.65)) { const i = (y * w + x) * 4; pts.push([d[i], d[i + 1], d[i + 2]]); }
      let cs = [pts[0], pts[(pts.length / 3) | 0], pts[((pts.length * 2) / 3) | 0]].map((p) => p.slice());
      const asg = new Int8Array(pts.length), sig = [30, 30, 30];
      for (let it = 0; it < 6; it++) {
        const sum = cs.map(() => [0, 0, 0, 0]);
        pts.forEach((p, i) => { let bi = 0, bd = 1e9; cs.forEach((c, j) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } }); asg[i] = bi; const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
        sum.forEach((s, j) => { if (s[3]) cs[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
      }
      const vs = cs.map(() => [0, 0]); pts.forEach((p, i) => { const c = cs[asg[i]]; vs[asg[i]][0] += (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; vs[asg[i]][1]++; });
      vs.forEach((v, j) => (sig[j] = Math.sqrt(v[0] / Math.max(1, v[1]) / 3) + 14));
      const score = new Float32Array(n); let hist = new Float32Array(64), mx = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, p = i * 4; let best = 1e9; cs.forEach((c, j) => { const dd = Math.sqrt(((d[p] - c[0]) ** 2 + (d[p + 1] - c[1]) ** 2 + (d[p + 2] - c[2]) ** 2) / 3) / sig[j]; if (dd < best) best = dd; });
        const nd = Math.hypot((x / w - 0.5) * 2, (y / h - 0.5) * 2) / 1.41; best *= 1.7 - 1.35 * nd; score[i] = best; hist[Math.min(63, (best * 8) | 0)]++;
      }
      // Otsu
      let tot = n, sumAll = 0; for (let i = 0; i < 64; i++) sumAll += i * hist[i]; let wB = 0, sB = 0, bestV = -1, th = 8;
      for (let i = 0; i < 64; i++) { wB += hist[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sumAll - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > bestV) { bestV = v; th = i; } }
      const thr = Math.max(1.0, Math.min((th + 1) / 8, 2.2));
      let m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = score[i] > thr ? 1 : 0;
      m = this.box(this.box(m, w, h, 2), w, h, 2); for (let i = 0; i < n; i++) m[i] = m[i] > 0.5 ? 1 : 0;
      // largest component near centre
      const lab = new Int32Array(n), comp = []; let nl = 0;
      for (let s = 0; s < n; s++) if (m[s] && !lab[s]) { nl++; let cnt = 0, sx = 0, sy = 0; const st = [s]; lab[s] = nl; while (st.length) { const q = st.pop(), qx = q % w, qy = (q / w) | 0; cnt++; sx += qx; sy += qy; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = qx + dx, ny = qy + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) { const ni = ny * w + nx; if (m[ni] && !lab[ni]) { lab[ni] = nl; st.push(ni); } } }); } comp[nl] = { cnt, cx: sx / cnt / w, cy: sy / cnt / h }; }
      let pick = 0, pv = 0; comp.forEach((c, i) => { if (!c) return; const v = c.cnt * (1.2 - Math.hypot(c.cx - 0.5, c.cy - 0.5)); if (v > pv) { pv = v; pick = i; } });
      for (let i = 0; i < n; i++) m[i] = lab[i] === pick && pick ? 1 : 0;
      // fill holes
      const bgm = new Uint8Array(n), st2 = []; for (let x = 0; x < w; x++) { st2.push(x, (h - 1) * w + x); } for (let y = 0; y < h; y++) { st2.push(y * w, y * w + w - 1); }
      st2.forEach((i) => { if (!m[i]) bgm[i] = 1; }); const stack = st2.filter((i) => bgm[i]);
      while (stack.length) { const q = stack.pop(), qx = q % w, qy = (q / w) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = qx + dx, ny = qy + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) { const ni = ny * w + nx; if (!m[ni] && !bgm[ni]) { bgm[ni] = 1; stack.push(ni); } } }); }
      let area = 0; for (let i = 0; i < n; i++) { if (!bgm[i]) { m[i] = 1; area++; } else m[i] = 0; }
      const cov = area / n; if (cov < 0.04 || cov > 0.9) return this.ellipse(w, h);
      m = this.box(m, w, h, 1); const coarse = this.toCanvas(m, w, h); try { return this.refine(src, coarse); } catch (e) { return coarse; }
    },

    km(d, idx, k) { // small k-means on RGB samples
      const pts = [], stp = Math.max(1, Math.floor(idx.length / 700)); for (let i = 0; i < idx.length; i += stp) pts.push(idx[i]);
      const cen = []; for (let j = 0; j < k; j++) { const p = pts[Math.floor((j * pts.length) / k)]; cen.push([d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]); }
      for (let it = 0; it < 5; it++) { const sm = cen.map(() => [0, 0, 0, 0]); pts.forEach((p) => { let b = 0, bd = 1e9; cen.forEach((c, j) => { const dd = (d[p * 4] - c[0]) ** 2 + (d[p * 4 + 1] - c[1]) ** 2 + (d[p * 4 + 2] - c[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); sm[b][0] += d[p * 4]; sm[b][1] += d[p * 4 + 1]; sm[b][2] += d[p * 4 + 2]; sm[b][3]++; }); sm.forEach((s, j) => { if (s[3]) cen[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; }); }
      return cen;
    },
    /* snap the coarse mask edge to real colour edges: re-classify a band around the boundary with fg/bg colour models */
    refine(src, mc) {
      const sc = Math.min(1, 400 / Math.max(src.width, src.height)), w = Math.max(8, Math.round(src.width * sc)), h = Math.max(8, Math.round(src.height * sc)), N = w * h;
      const t = K.canvas(w, h), tx = K.ctx(t, 1); tx.drawImage(src, 0, 0, w, h); const d = tx.getImageData(0, 0, w, h).data;
      const m = K.canvas(w, h), mx = K.ctx(m, 1); mx.imageSmoothingQuality = 'high'; mx.drawImage(mc, 0, 0, w, h); const md = mx.getImageData(0, 0, w, h).data;
      const b = new Float32Array(N); for (let i = 0; i < N; i++) b[i] = md[i * 4 + 3] > 127 ? 1 : 0;
      const sm = this.box(b, w, h, 5), fg = [], bg = []; for (let i = 0; i < N; i++) { if (sm[i] > 0.98) fg.push(i); else if (sm[i] < 0.02) bg.push(i); }
      if (fg.length < 80 || bg.length < 80) return mc;
      const F = this.km(d, fg, 3), B = this.km(d, bg, 3), out = new Float32Array(N);
      const dist = (i, cs) => { let best = 1e9; for (const c of cs) { const dd = (d[i * 4] - c[0]) ** 2 + (d[i * 4 + 1] - c[1]) ** 2 + (d[i * 4 + 2] - c[2]) ** 2; if (dd < best) best = dd; } return Math.sqrt(best); };
      for (let i = 0; i < N; i++) { if (sm[i] > 0.98) out[i] = 1; else if (sm[i] < 0.02) out[i] = 0; else out[i] = 1 / (1 + Math.exp(-((dist(i, B) - dist(i, F)) / 14 + (sm[i] - 0.5) * 5))); }
      let r = this.box(out, w, h, 2); for (let i = 0; i < N; i++) r[i] = r[i] > 0.5 ? 1 : 0; r = this.box(r, w, h, 1);
      return this.toCanvas(r, w, h);
    },
    ellipse(w, h) { const c = K.canvas(w, h), x = K.ctx(c); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.38, h * 0.42, 0, 0, TAU); x.fill(); return c; },
    full(w, h) { const c = K.canvas(w, h), x = K.ctx(c); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); return c; },
    box(a, w, h, r) { const o = new Float32Array(a.length), t = new Float32Array(a.length), k = 2 * r + 1; for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / k; s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } } for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / k; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } } return o; },
    toCanvas(m, w, h) { const c = K.canvas(w, h), x = K.ctx(c, 1), im = x.createImageData(w, h); for (let i = 0; i < m.length; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = m[i] * 255; } x.putImageData(im, 0, 0); return c; },
    coverage(mc) { const x = K.ctx(mc, 1), d = x.getImageData(0, 0, mc.width, mc.height).data; let a = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) a++; return a / (d.length / 4); },
    async model(src) {
      if (typeof window.__kapiSegmenter === 'function') { try { return await window.__kapiSegmenter(src); } catch (e) {} }
      if (!K.S.model || !navigator.onLine) return null;
      try {
        if (!this._seg) this._seg = (async () => {
          const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
          const v = await import(base + '/vision_bundle.mjs'), fs = await v.FilesetResolver.forVisionTasks(base + '/wasm');
          return v.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
        })();
        const seg = await Promise.race([this._seg, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000))]);
        const sc = 256 / Math.max(src.width, src.height), t = K.canvas(src.width * sc, src.height * sc); K.ctx(t).drawImage(src, 0, 0, t.width, t.height);
        const res = seg.segment(t), mk = res.confidenceMasks[0], arr = mk.getAsFloat32Array(), w = mk.width, h = mk.height; let ctr = 0, cn = 0, edge = 0, en = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = arr[y * w + x]; if (x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7) { ctr += v; cn++; } else if (x < 3 || y < 3 || x > w - 4 || y > h - 4) { edge += v; en++; } }
        const inv = ctr / cn < edge / en, m = new Float32Array(arr.length); for (let i = 0; i < m.length; i++) m[i] = inv ? 1 - arr[i] : arr[i];
        res.close && res.close(); const c = this.toCanvas(this.box(m, w, h, 1), w, h); const cov = this.coverage(c); return cov > 0.03 && cov < 0.92 ? c : null;
      } catch (e) { this._seg = null; this.failed = true; return null; }
    },
  };

  /* ---------- painterly (kuwahara) ---------- */
  K.kuwahara = function (src, r) {
    const W = src.width, H = src.height, ctx = K.ctx(src, 1), im = ctx.getImageData(0, 0, W, H), d = im.data, W1 = W + 1, N = W1 * (H + 1);
    const iR = new Float64Array(N), iG = new Float64Array(N), iB = new Float64Array(N), iL = new Float64Array(N), iQ = new Float64Array(N);
    for (let y = 0; y < H; y++) { let sr = 0, sg = 0, sb = 0, sl = 0, sq = 0; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2], L = 0.299 * R + 0.587 * G + 0.114 * B; sr += R; sg += G; sb += B; sl += L; sq += L * L; const j = (y + 1) * W1 + x + 1, u = y * W1 + x + 1; iR[j] = iR[u] + sr; iG[j] = iG[u] + sg; iB[j] = iB[u] + sb; iL[j] = iL[u] + sl; iQ[j] = iQ[u] + sq; } }
    const rect = (I, x0, y0, x1, y1) => I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
    const out = ctx.createImageData(W, H), o = out.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let bv = 1e18, br = 0, bg = 0, bb = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, x - (q & 1 ? 0 : r)), x1 = Math.min(W, x + (q & 1 ? r + 1 : 1)), y0 = Math.max(0, y - (q & 2 ? 0 : r)), y1 = Math.min(H, y + (q & 2 ? r + 1 : 1)), n = (x1 - x0) * (y1 - y0);
        const ml = rect(iL, x0, y0, x1, y1) / n, v = rect(iQ, x0, y0, x1, y1) / n - ml * ml;
        if (v < bv) { bv = v; br = rect(iR, x0, y0, x1, y1) / n; bg = rect(iG, x0, y0, x1, y1) / n; bb = rect(iB, x0, y0, x1, y1) / n; }
      }
      const i = (y * W + x) * 4; o[i] = br; o[i + 1] = bg; o[i + 2] = bb; o[i + 3] = d[i + 3];
    }
    ctx.putImageData(out, 0, 0); return src;
  };
  // ink edge pass: darken strong luminance gradients
  const inkEdges = (c, amt) => {
    const W = c.width, H = c.height, x = K.ctx(c, 1), im = x.getImageData(0, 0, W, H), d = im.data, L = new Float32Array(W * H);
    for (let i = 0; i < L.length; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (let y = 1; y < H - 1; y++) for (let px = 1; px < W - 1; px++) { const i = y * W + px, gx = L[i + 1] - L[i - 1], gy = L[i + W] - L[i - W], g = Math.min(1, Math.hypot(gx, gy) / 70); if (g > 0.25) { const a = (g - 0.25) * amt, j = i * 4; d[j] = d[j] * (1 - a) + 50 * a; d[j + 1] = d[j + 1] * (1 - a) + 40 * a; d[j + 2] = d[j + 2] * (1 - a) + 70 * a; } }
    x.putImageData(im, 0, 0);
  };
  K.paintCanvas = (c) => {
    const orig = K.canvas(c.width, c.height); K.ctx(orig).drawImage(c, 0, 0);
    const r = Math.max(2, Math.round(c.width / 150)); K.kuwahara(c, r);
    const x = K.ctx(c); x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.32; x.drawImage(orig, 0, 0); // keep fine detail
    x.globalAlpha = 0.14; x.fillStyle = '#fff6e0'; x.fillRect(0, 0, c.width, c.height); x.restore();
    inkEdges(c, 0.5);
    x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.18; x.fillStyle = x.createPattern(noiseTile(), 'repeat'); x.fillRect(0, 0, c.width, c.height); x.restore(); // paper grain
    return c;
  };
  /* ---------- drawing helpers ---------- */
  var noiseTile = (() => { let t; return () => { if (t) return t; t = K.canvas(256, 256); const x = K.ctx(t, 1), im = x.createImageData(256, 256), R = K.rng(11); for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (R() - 0.5) * 70; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return t; }; })();
  const paper = (ctx, W, H, E, base, o = {}) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    const R = K.rng(E.seed + 1); ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = o.noise == null ? 0.22 : o.noise; ctx.fillStyle = ctx.createPattern(noiseTile(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); for (let i = 0; i < (o.blots == null ? 5 : o.blots); i++) { const x = R() * W, y = R() * H, r = 150 + R() * 300, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R() > 0.5 ? '160,130,90' : '255,255,255'},${0.08 + R() * 0.08})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } ctx.restore();
    if (o.fibers !== false) { ctx.save(); ctx.strokeStyle = 'rgba(120,100,70,.12)'; ctx.lineWidth = 1; for (let i = 0; i < 90; i++) { const x = R() * W, y = R() * H, a = R() * TAU, l = 10 + R() * 26; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); } ctx.restore(); }
  };
  const gridPaper = (ctx, W, H, E, base, line) => {
    paper(ctx, W, H, E, base, { noise: 0.12, blots: 2, fibers: false }); ctx.save(); ctx.strokeStyle = line; ctx.lineWidth = 1.5; const s = 36;
    for (let x = s; x < W; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = s; y < H; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore();
  };
  const shadow = (ctx, E, blur, oy, a, fn) => { ctx.save(); ctx.shadowColor = `rgba(20,10,0,${a})`; ctx.shadowBlur = blur * E.sc; ctx.shadowOffsetY = oy * E.sc; fn(); ctx.restore(); };
  const rot = (ctx, cx, cy, a, fn) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); fn(); ctx.restore(); };
  const tape = (ctx, x, y, w, h, a, col = 'rgba(255,230,140,.7)') => rot(ctx, x, y, a, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 + (i % 2) * 5, -h / 2 + (h / 6) * i); ctx.lineTo(w / 2, h / 2); for (let i = 6; i >= 0; i--) ctx.lineTo(w / 2 - (i % 2) * 5, -h / 2 + (h / 6) * i); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke(); });
  const text = (ctx, s, x, y, size, font, col, align = 'left', a = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.font = `${size}px ${font}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, 0, 0); ctx.restore(); };
  const stroke = (ctx, x1, y1, x2, y2, w, col, R, a = 0.85) => { // dry-brush stroke with bristles
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len; ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = col;
    for (let i = 0; i < 14; i++) { const o = (i / 13 - 0.5) * w, wob = (R() - 0.5) * 6, tp = 0.1 + R() * 0.25; ctx.globalAlpha = a * (0.35 + R() * 0.6); ctx.lineWidth = w / 8 + R() * 3; ctx.beginPath(); ctx.moveTo(x1 + nx * o * 0.6, y1 + ny * o * 0.6); ctx.quadraticCurveTo((x1 + x2) / 2 + nx * (o + wob), (y1 + y2) / 2 + ny * (o + wob), x2 - dx * tp * R() + nx * o * 0.3, y2 - dy * tp * R() + ny * o * 0.3); ctx.stroke(); }
    ctx.restore();
  };
  const wash = (ctx, cx, cy, rx, ry, col, a, R) => { ctx.save(); for (let k = 0; k < 6; k++) { ctx.globalAlpha = a * (0.4 + R() * 0.4); ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i <= 28; i++) { const t = (i / 28) * TAU, j = 1 + (R() - 0.5) * 0.22; ctx.lineTo(cx + Math.cos(t) * rx * j * (0.9 + k * 0.03), cy + Math.sin(t) * ry * j * (0.9 + k * 0.03)); } ctx.closePath(); ctx.fill(); } ctx.globalAlpha = a * 0.5; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); };
  const star = (ctx, x, y, r, col, w = 3) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); ctx.restore(); };
  const heart = (ctx, x, y, s, col, fill) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, 0.35); ctx.bezierCurveTo(-1, -0.3, -0.5, -1, 0, -0.45); ctx.bezierCurveTo(0.5, -1, 1, -0.3, 0, 0.35); if (fill) { ctx.fillStyle = col; ctx.fill(); } else { ctx.lineWidth = 3 / s; ctx.strokeStyle = col; ctx.stroke(); } ctx.restore(); };
  const sun = (ctx, x, y, r, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); ctx.lineTo(x + Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 1.8); ctx.stroke(); } ctx.restore(); };
  const squiggle = (ctx, x, y, w, col, amp = 8) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); for (let i = 0; i <= w; i += 4) ctx.lineTo(x + i, y + Math.sin(i / 10) * amp); ctx.stroke(); ctx.restore(); };
  const arrow = (ctx, x1, y1, x2, y2, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2 + 30, (y1 + y2) / 2 - 30, x2, y2); ctx.stroke(); const a = Math.atan2(y2 - y1, x2 - x1) + 0.3; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.5) * 24, y2 - Math.sin(a - 0.5) * 24); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a + 0.5) * 24, y2 - Math.sin(a + 0.5) * 24); ctx.stroke(); ctx.restore(); };
  const flower = (ctx, x, y, r, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3.5; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, r * 0.5, a, 0, TAU); ctx.stroke(); } ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, TAU); ctx.stroke(); ctx.restore(); };
  const compass = (ctx, x, y, r, col) => { ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.stroke(); [0, 1, 2, 3].forEach((i) => { const a = (i * Math.PI) / 2 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); ctx.lineTo(x + Math.cos(a + 0.28) * r * 0.2, y + Math.sin(a + 0.28) * r * 0.2); ctx.lineTo(x + Math.cos(a - 0.28) * r * 0.2, y + Math.sin(a - 0.28) * r * 0.2); ctx.closePath(); ctx.fill(); }); ctx.restore(); };
  const plane = (ctx, x, y, s, col, a) => rot(ctx, x, y, a, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(30 * s, 0); ctx.lineTo(-20 * s, -9 * s); ctx.lineTo(-10 * s, 0); ctx.lineTo(-20 * s, 9 * s); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(4 * s, 0); ctx.lineTo(-14 * s, -28 * s); ctx.lineTo(-20 * s, -26 * s); ctx.lineTo(-8 * s, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(4 * s, 0); ctx.lineTo(-14 * s, 28 * s); ctx.lineTo(-20 * s, 26 * s); ctx.lineTo(-8 * s, 0); ctx.fill(); });
  const dashed = (ctx, pts, col, w = 4) => { ctx.save(); ctx.setLineDash([2, 14]); ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore(); };
  const arcText = (ctx, s, cx, cy, r, a0, size, col) => { ctx.save(); ctx.font = `700 ${size}px ${K.fonts.type}`; ctx.fillStyle = col; ctx.textAlign = 'center'; const step = (size * 0.78) / r; s.split('').forEach((ch, i) => { const a = a0 + (i - (s.length - 1) / 2) * step; ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); }); ctx.restore(); };
  const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const tornPath = (x, y, w, h, R, j = 7) => { const p = new Path2D(), n = 46; const pts = []; for (let i = 0; i < n; i++) pts.push([x + (w * i) / n, y + (R() - 0.5) * j]); for (let i = 0; i < n; i++) pts.push([x + w + (R() - 0.5) * j, y + (h * i) / n]); for (let i = n; i > 0; i--) pts.push([x + (w * i) / n, y + h + (R() - 0.5) * j]); for (let i = n; i > 0; i--) pts.push([x + (R() - 0.5) * j, y + (h * i) / n]); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };
  const palette = (cell) => { const t = K.canvas(6, 6), x = K.ctx(t, 1); x.drawImage(cell, 0, 0, 6, 6); const d = x.getImageData(0, 0, 6, 6).data, arr = []; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); arr.push({ c: [d[i], d[i + 1], d[i + 2]], s: mx - mn + (255 - Math.abs(mx - 128)) * 0.2 }); } arr.sort((a, b) => b.s - a.s); const out = []; for (const a of arr) { if (out.every((o) => Math.abs(o[0] - a.c[0]) + Math.abs(o[1] - a.c[1]) + Math.abs(o[2] - a.c[2]) > 90)) out.push(a.c); if (out.length === 3) break; } while (out.length < 3) out.push([[140, 190, 200], [230, 170, 150], [170, 200, 150]][out.length]); return out.map((c) => `rgb(${(c[0] * 0.8 + 50) | 0},${(c[1] * 0.8 + 50) | 0},${(c[2] * 0.8 + 50) | 0})`); };
  const drawContain = (ctx, cv, bx, by, bw, bh, align = 'bottom') => { const r = cv.width / cv.height; let w = bw, h = bw / r; if (h > bh) { h = bh; w = bh * r; } const x = bx + (bw - w) / 2, y = align === 'bottom' ? by + bh - h : by + (bh - h) / 2; ctx.drawImage(cv, x, y, w, h); return { x, y, w, h }; };
  const tint = (cv, col) => { const t = K.canvas(cv.width, cv.height), x = K.ctx(t); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height); return t; };
  const bwCell = (c) => { K.filterCanvas(c, Object.assign({}, K.preset('m1'), { id: 'bwx', c: 1.25, grain: 0.15 }), { seed: 4 }); return c; };

  /* ---------- templates ---------- */
  K.COLLAGES = [
    { id: 'travel', name: 'Travel Collage', vars: 3, text: 'loc', ph: 'Where to?', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R; paper(ctx, W, H, E, '#f2ead8', { noise: 0.28 });
      const main = E.cell(0, 200, 260), pal = palette(main), sub = E.subject(Math.round(W * 0.8 * E.sc)), box = [[90, H * 0.1, 900, H * 0.62], [250, H * 0.14, 760, H * 0.58], [40, H * 0.08, 1000, H * 0.66]][v];
      wash(ctx, box[0] + box[2] * 0.5, box[1] + box[3] * 0.62, box[2] * 0.55, box[3] * 0.4, pal[0], 0.22, R); wash(ctx, box[0] + box[2] * (v === 1 ? 0.3 : 0.7), box[1] + box[3] * 0.35, box[2] * 0.3, box[3] * 0.25, pal[1], 0.2, R); wash(ctx, W * 0.5, H * 0.8, W * 0.5, H * 0.1, pal[2], 0.15, R);
      ctx.save(); ctx.fillStyle = 'rgba(60,40,20,.18)'; ctx.filter = 'none'; ctx.beginPath(); ctx.ellipse(box[0] + box[2] / 2, box[1] + box[3] - 6, box[2] * 0.32, 18, 0, 0, TAU); ctx.fill(); ctx.restore();
      let r; shadow(ctx, E, 24, 14, 0.3, () => { r = drawContain(ctx, sub.canvas, box[0], box[1], box[2], box[3]); });
      for (let i = 0; i < 4; i++) stroke(ctx, 60 + R() * 300, H * (0.62 + R() * 0.12), 260 + R() * 600, H * (0.62 + R() * 0.14) + R() * 40, 18 + R() * 22, pal[i % 3], R, 0.5);
      stroke(ctx, W * 0.1, H * 0.06, W * 0.45, H * 0.065, 20, pal[1], R, 0.55);
      const ty = H * 0.8; text(ctx, E.c.loc || 'Somewhere nice', W / 2, ty, 120, K.fonts.hand, '#34304a', 'center', -0.02); squiggle(ctx, W * 0.3, ty + 24, W * 0.4, pal[0], 6);
      text(ctx, E.date, W / 2, ty + 90, 38, K.fonts.type, '#5a4e3c', 'center'); compass(ctx, W * 0.86, H * 0.9, 44, '#34304a'); dashed(ctx, [[W * 0.12, H * 0.93], [W * 0.3, H * 0.9], [W * 0.5, H * 0.945], [W * 0.68, H * 0.9]], '#8a7a62'); plane(ctx, W * 0.7, H * 0.895, 0.9, '#34304a', -0.5);
    } },
    { id: 'holiday', name: 'Holiday Journal', vars: 3, text: 'title', ph: 'Holiday Journal', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R, ink = ['#2f5fa8', '#c2455a', '#2e7d5b'][v]; gridPaper(ctx, W, H, E, ['#fbf8ee', '#fdf3ee', '#f3f8ee'][v], 'rgba(90,140,190,.22)');
      ctx.fillStyle = 'rgba(220,80,80,.35)'; ctx.fillRect(W * 0.1, 0, 3, H);
      const mx = v === 1 ? W * 0.34 : W * 0.07, mw = v === 1 ? W * 0.6 : W * 0.86, mh = H * 0.44;
      shadow(ctx, E, 18, 8, 0.3, () => rot(ctx, mx + mw / 2, H * 0.08 + mh / 2, v === 1 ? 0.025 : -0.02, () => { ctx.fillStyle = '#fff'; ctx.fillRect(-mw / 2 - 14, -mh / 2 - 14, mw + 28, mh + 28); ctx.drawImage(E.cell(0, mw, mh), -mw / 2, -mh / 2, mw, mh); }));
      tape(ctx, mx + 40, H * 0.08 - 6, 150, 44, -0.5); tape(ctx, mx + mw - 30, H * 0.08 + mh + 8, 150, 44, -0.4, 'rgba(255,150,170,.6)');
      const labels = E.c.labels || ['sunrise', 'snacks', 'new friends'], sw = v === 1 ? W * 0.26 : W * 0.27, sh = H * 0.17;
      const spots = v === 1 ? [[W * 0.04, H * 0.1], [W * 0.04, H * 0.3], [W * 0.04, H * 0.5]] : [[W * 0.07, H * 0.6], [W * 0.37, H * 0.62], [W * 0.67, H * 0.6]];
      spots.forEach(([x, y], i) => { const a = [-0.04, 0.03, -0.025][i]; shadow(ctx, E, 12, 6, 0.28, () => rot(ctx, x + sw / 2, y + sh / 2, a, () => { ctx.fillStyle = v === 2 ? '#fff' : '#fffdf6'; const p = v === 2 ? 14 : 8; ctx.fillRect(-sw / 2 - p, -sh / 2 - p, sw + 2 * p, sh + 2 * p + (v === 2 ? 30 : 0)); ctx.drawImage(E.cell(i + 1, sw, sh), -sw / 2, -sh / 2, sw, sh); })); text(ctx, labels[i], x + sw / 2, y + sh + (v === 2 ? 56 : 54), 46, K.fonts.hand, ink, 'center', a); if (i === 1) tape(ctx, x + sw / 2, y - 8, 110, 36, 0.1, 'rgba(130,200,255,.6)'); });
      const ty = v === 1 ? H * 0.7 : H * 0.575; text(ctx, E.c.title || 'Holiday Journal', v === 1 ? W * 0.36 : W * 0.08, v === 1 ? H * 0.74 : ty, 96, K.fonts.hand, ink); squiggle(ctx, v === 1 ? W * 0.36 : W * 0.08, (v === 1 ? H * 0.74 : ty) + 20, 480, '#f2a93b', 7);
      sun(ctx, W * 0.86, H * (v === 1 ? 0.78 : 0.56), 26, '#f2a93b'); star(ctx, W * 0.93, H * 0.9, 24, '#c2455a'); heart(ctx, W * 0.5, H * 0.9, 34, '#e0607a', true); flower(ctx, W * 0.15, H * 0.9, 16, '#2e7d5b'); arrow(ctx, W * 0.62, H * 0.87, W * 0.8, H * 0.81, ink);
      text(ctx, E.date, W * 0.92, H * 0.96, 36, K.fonts.type, '#555', 'right');
    } },
    { id: 'postmark', name: 'Vintage Postmark', vars: 3, text: 'loc', ph: 'City name', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R, card = '#f4ecd8'; paper(ctx, W, H, E, '#c9ab7e', { noise: 0.3 });
      shadow(ctx, E, 30, 14, 0.4, () => rot(ctx, W / 2, H / 2, -0.012, () => { ctx.fillStyle = card; ctx.fillRect(-W * 0.46, -H * 0.46, W * 0.92, H * 0.92); }));
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.012); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 14; ctx.setLineDash([46, 26]); ctx.strokeRect(-W * 0.44, -H * 0.44, W * 0.88, H * 0.88); ctx.strokeStyle = '#2d5aa8'; ctx.lineDashOffset = 36; ctx.strokeRect(-W * 0.44, -H * 0.44, W * 0.88, H * 0.88); ctx.restore();
      const sw = v === 2 ? W * 0.66 : W * 0.4, sh = v === 2 ? H * 0.46 : H * 0.3, sx = v === 0 ? W * 0.5 : v === 1 ? W * 0.1 : W * 0.17, sy = H * (v === 2 ? 0.1 : 0.13), step = 14;
      shadow(ctx, E, 14, 6, 0.3, () => rot(ctx, sx + sw / 2, sy + sh / 2, v === 1 ? -0.05 : 0.04, () => { ctx.fillStyle = '#fffdf7'; ctx.fillRect(-sw / 2, -sh / 2, sw, sh); ctx.drawImage(E.cell(0, sw - 40, sh - 40), -sw / 2 + 20, -sh / 2 + 20, sw - 40, sh - 40); ctx.fillStyle = card; for (let x = -sw / 2; x <= sw / 2; x += step * 1.5) { ctx.beginPath(); ctx.arc(x, -sh / 2, 6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x, sh / 2, 6, 0, TAU); ctx.fill(); } for (let y = -sh / 2; y <= sh / 2; y += step * 1.5) { ctx.beginPath(); ctx.arc(-sw / 2, y, 6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(sw / 2, y, 6, 0, TAU); ctx.fill(); } ctx.fillStyle = '#fff'; ctx.font = `700 26px ${K.fonts.type}`; ctx.fillText('KAPI POST', -sw / 2 + 30, sh / 2 - 26); }));
      const pcx = v === 1 ? W * 0.5 : sx - 20, pcy = sy + sh * 0.55; ctx.save(); ctx.strokeStyle = 'rgba(40,40,70,.7)'; ctx.fillStyle = 'rgba(40,40,70,.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(pcx, pcy, 108, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(pcx, pcy, 76, 0, TAU); ctx.stroke(); arcText(ctx, (E.c.loc || 'SOMEWHERE').toUpperCase().slice(0, 14), pcx, pcy, 88, -Math.PI / 2, 24, 'rgba(40,40,70,.75)'); text(ctx, E.date.slice(0, 11), pcx, pcy + 8, 22, K.fonts.type, 'rgba(40,40,70,.8)', 'center'); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(pcx + 110, pcy - 40 + i * 20); for (let x = 0; x < 260; x += 6) ctx.lineTo(pcx + 110 + x, pcy - 40 + i * 20 + Math.sin(x / 14) * 7); ctx.stroke(); } ctx.restore();
      const ly = v === 2 ? H * 0.62 : H * 0.5; text(ctx, 'Dear you,', W * 0.12, ly, 70, K.fonts.hand, '#2d3f78'); for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(45,63,120,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.12, ly + 56 + i * 52); ctx.lineTo(W * 0.86, ly + 56 + i * 52); ctx.stroke(); }
      text(ctx, 'wish you were here —', W * 0.14, ly + 100, 52, K.fonts.hand, '#2d3f78', 'left', -0.01); text(ctx, E.c.loc || 'Somewhere', W * 0.86, ly + 204, 56, K.fonts.hand, '#c0392b', 'right', -0.03);
      text(ctx, 'PAR AVION · AIR MAIL', W / 2, H * 0.905, 34, K.fonts.type, '#8a6b45', 'center');
    } },
    { id: 'sky', name: 'Sky Diary', vars: 3, text: 'title', ph: 'dear diary…', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R, sk = [['#2b1b5e', '#b4527a', '#ffb88a'], ['#7fa8f0', '#c7d6ff', '#ffe3ea'], ['#070b2a', '#1a2a6c', '#4a5fb0']][v];
      const g = ctx.createLinearGradient(0, 0, 0, H); sk.forEach((c, i) => g.addColorStop(i / 2, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.7})`; ctx.beginPath(); ctx.arc(R() * W, R() * H * 0.55, 1 + R() * 2.5, 0, TAU); ctx.fill(); }
      ctx.save(); ctx.fillStyle = v === 1 ? '#fff6c8' : '#fff1c4'; ctx.shadowColor = '#fff1c4'; ctx.shadowBlur = 50 * E.sc; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.08, 52, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.fillStyle = sk[0]; if (v !== 1) { ctx.beginPath(); ctx.arc(W * 0.82 + 22, H * 0.08 - 10, 46, 0, TAU); ctx.fill(); } ctx.restore();
      const ax = W * 0.14, aw = W * 0.72, ay = H * 0.13, ah = H * 0.55; shadow(ctx, E, 30, 10, 0.35, () => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ax - 14, ay + ah + 14); ctx.lineTo(ax - 14, ay + aw / 2); ctx.arc(ax + aw / 2, ay + aw / 2, aw / 2 + 14, Math.PI, 0); ctx.lineTo(ax + aw + 14, ay + ah + 14); ctx.closePath(); ctx.fill(); });
      ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay + ah); ctx.lineTo(ax, ay + aw / 2); ctx.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.closePath(); ctx.clip(); ctx.drawImage(E.cell(0, aw, ah), ax, ay, aw, ah); ctx.restore();
      const cloud = (cx, cy, s, a) => { ctx.fillStyle = `rgba(255,255,255,${a})`; [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.2, 0.75], [-0.4, -0.35, 0.7], [0.45, -0.3, 0.6]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(cx + x * s, cy + y * s, r * s * 0.8, 0, TAU); ctx.fill(); }); };
      cloud(W * 0.18, H * 0.7, 120, 0.92); cloud(W * 0.82, H * 0.68, 100, 0.88); cloud(W * 0.5, H * 0.74, 130, 0.95); cloud(W * 0.05, H * 0.1, 70, 0.4); cloud(W * 0.95, H * 0.3, 60, 0.35);
      text(ctx, E.c.title || 'dear diary…', W / 2, H * 0.84, 88, K.fonts.hand, '#fff', 'center', -0.02); text(ctx, E.date, W / 2, H * 0.89, 34, K.fonts.type, 'rgba(255,255,255,.85)', 'center'); text(ctx, '☁ today the sky felt close', W / 2, H * 0.935, 46, K.fonts.hand, 'rgba(255,255,255,.9)', 'center');
    } },
    { id: 'mini', name: 'Miniature World', vars: 3, text: 'loc', ph: 'Tiny town', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R, g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, ['#cfe8ff', '#ffe3cf', '#dff5d8'][v]); g.addColorStop(1, '#fff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const pw = W * 0.84, ph = H * 0.56, px = W * 0.08, py = H * 0.1, cell = E.cell(0, pw, ph), cw = cell.width, ch = cell.height;
      const bl = K.canvas(cw, ch), bx = K.ctx(bl); bx.imageSmoothingQuality = 'high'; const sm = K.canvas(Math.max(6, cw / 14), Math.max(6, ch / 14)); K.ctx(sm).drawImage(cell, 0, 0, sm.width, sm.height); bx.drawImage(sm, 0, 0, cw, ch);
      const sharp = K.canvas(cw, ch), sx = K.ctx(sharp); sx.drawImage(cell, 0, 0); sx.globalCompositeOperation = 'destination-in';
      if (v === 2) { const rg = sx.createRadialGradient(cw / 2, ch / 2, ch * 0.12, cw / 2, ch / 2, ch * 0.5); rg.addColorStop(0, '#000'); rg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = rg; } else { const lg = v === 0 ? sx.createLinearGradient(0, 0, 0, ch) : sx.createLinearGradient(0, 0, cw, ch); [[0, 0], [0.3, 0], [0.42, 1], [0.6, 1], [0.72, 0], [1, 0]].forEach(([o, a]) => lg.addColorStop(o, `rgba(0,0,0,${a})`)); sx.fillStyle = lg; } sx.fillRect(0, 0, cw, ch);
      bx.drawImage(sharp, 0, 0); K.filterCanvas(bl, Object.assign({}, K.preset('none'), { id: 'tilt', c: 1.15, s: 1.55, b: 0.02, vig: 0.1 }), { seed: 2 });
      shadow(ctx, E, 40, 30, 0.35, () => { ctx.fillStyle = '#e9dcc4'; rrect(ctx, px - 10, py + ph - 10, pw + 20, 76, 14); ctx.fill(); });
      ctx.fillStyle = '#d8c7a6'; rrect(ctx, px - 10, py + ph + 40, pw + 20, 30, 12); ctx.fill();
      shadow(ctx, E, 24, 12, 0.3, () => { ctx.save(); rrect(ctx, px, py, pw, ph, 16); ctx.clip(); ctx.drawImage(bl, px, py, pw, ph); ctx.restore(); }); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 6; rrect(ctx, px, py, pw, ph, 16); ctx.stroke();
      ctx.fillStyle = '#2d2a26'; rrect(ctx, W / 2 - 230, py + ph + 4, 460, 52, 8); ctx.fill(); text(ctx, (E.c.loc || 'MINIATURE WORLD').toUpperCase().slice(0, 26), W / 2, py + ph + 40, 30, K.fonts.type, '#f1e6c9', 'center'); text(ctx, E.date, W / 2, H * 0.86, 40, K.fonts.type, '#6a5d48', 'center'); text(ctx, 'scale 1:87 · handle with care', W / 2, H * 0.92, 50, K.fonts.hand, '#6a5d48', 'center', -0.01);
    } },
    { id: 'grunge', name: 'Grunge Print', vars: 3, text: 'title', ph: 'ROUGH CUT', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R, acc = ['#d6281e', '#1f5fd6', '#f2c500'][v]; paper(ctx, W, H, E, '#e6e1d4', { noise: 0.4, blots: 9 });
      const px = W * 0.08, py = H * 0.1, pw = W * 0.84, ph = H * 0.56, cell = bwCell(E.cell(0, pw, ph)), cx = K.ctx(cell); cx.globalCompositeOperation = 'multiply'; cx.fillStyle = v === 0 ? '#ffb4a8' : v === 1 ? '#a9c4ff' : '#fff0a0'; cx.fillRect(0, 0, cell.width, cell.height); cx.globalCompositeOperation = 'source-over';
      cx.fillStyle = 'rgba(0,0,0,.28)'; const ds = Math.max(3, cell.width / 90); for (let y = 0; y < cell.height; y += ds * 1.3) for (let x = ((y / ds / 1.3) % 2) * ds * 0.65; x < cell.width; x += ds * 1.3) { cx.beginPath(); cx.arc(x, y, ds * 0.3, 0, TAU); cx.fill(); }
      shadow(ctx, E, 20, 12, 0.4, () => { ctx.save(); const tp = tornPath(px, py, pw, ph, R, 14); ctx.fillStyle = '#fff'; ctx.fill(tp); ctx.clip(tp); ctx.drawImage(cell, px, py, pw, ph); ctx.restore(); });
      tape(ctx, px + 60, py + 4, 190, 50, -0.35, 'rgba(240,235,210,.75)'); tape(ctx, px + pw - 50, py + ph - 4, 190, 50, -0.3, 'rgba(240,235,210,.75)');
      const t = (E.c.title || 'ROUGH CUT').toUpperCase().slice(0, 12); let x = W * 0.08; const y = H * 0.74; t.split('').forEach((ch, i) => { if (ch === ' ') { x += 44; return; } const sz = 90 + R() * 30, w = sz * 0.72, dark = R() > 0.4; ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate((R() - 0.5) * 0.1); ctx.fillStyle = dark ? '#111' : i % 3 === 0 ? acc : '#fff'; ctx.fillRect(-w / 2 - 6, -sz * 0.8, w + 12, sz * 1.05); ctx.fillStyle = dark ? '#f2f2f2' : '#111'; ctx.font = `800 ${sz}px ${K.fonts.type}`; ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore(); x += w + 14; });
      ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.38, W * 0.34, H * 0.2, -0.1, 0.2, 5.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W * 0.74, H * 0.58); ctx.lineTo(W * 0.9, H * 0.64); ctx.moveTo(W * 0.9, H * 0.58); ctx.lineTo(W * 0.74, H * 0.65); ctx.stroke(); ctx.restore();
      text(ctx, E.date, W * 0.92, H * 0.88, 36, K.fonts.type, '#222', 'right'); text(ctx, 'xerox · cut · paste', W * 0.08, H * 0.88, 56, K.fonts.hand, acc, 'left', -0.03); ctx.fillStyle = '#111'; for (let i = 0; i < 24; i++) ctx.fillRect(W * 0.08 + i * 18, H * 0.93, 4 + (i % 3) * 4, 40);
    } },
    { id: 'grid', name: 'Photo Grid', vars: 3, text: null, draw(ctx, W, H, E) {
      const v = E.v % 3, bg = ['#f6f1e7', '#ffd9e6', '#16161a'][v]; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); const m = 54, gap = 18, top = 70, bot = 150, gw = W - 2 * m, gh = H - top - bot; const cells = [];
      if (v === 0) { const cw = (gw - gap) / 2, chh = (gh - gap) / 2; for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) cells.push([m + c * (cw + gap), top + r * (chh + gap), cw, chh]); }
      else if (v === 1) { const bh = gh * 0.58; cells.push([m, top, gw, bh]); const cw = (gw - gap) / 2, chh = gh - bh - gap; cells.push([m, top + bh + gap, cw, chh], [m + cw + gap, top + bh + gap, cw, chh]); }
      else { const cw = (gw - gap * 2) / 3, chh = (gh - gap * 2) / 3; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([m + c * (cw + gap), top + r * (chh + gap), cw, chh]); }
      cells.forEach(([x, y, w, h], i) => { shadow(ctx, E, 10, 4, v === 2 ? 0 : 0.22, () => { ctx.save(); rrect(ctx, x, y, w, h, 18); ctx.clip(); ctx.drawImage(E.cell(i, w, h), x, y, w, h); ctx.restore(); }); });
      text(ctx, E.date, m, H - 70, 38, K.fonts.type, v === 2 ? '#ddd' : '#555'); text(ctx, 'kapi · ' + cells.length + ' moments', W - m, H - 70, 52, K.fonts.hand, v === 1 ? '#c2455a' : v === 2 ? '#ffe926' : '#555', 'right');
    } },
    { id: 'pile', name: 'Polaroid Pile', vars: 3, text: 'title', ph: 'good times', draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R;
      if (v === 0) { const pl = ['#b9855a', '#a9744a', '#c4916a']; for (let y = 0, i = 0; y < H; y += H / 8, i++) { ctx.fillStyle = pl[i % 3]; ctx.fillRect(0, y, W, H / 8); ctx.fillStyle = 'rgba(70,40,20,.5)'; ctx.fillRect(0, y, W, 4); for (let k = 0; k < 14; k++) { ctx.strokeStyle = `rgba(80,45,20,${0.1 + R() * 0.15})`; ctx.lineWidth = 1 + R() * 2; ctx.beginPath(); const yy = y + R() * (H / 8); ctx.moveTo(0, yy); ctx.bezierCurveTo(W * 0.3, yy + R() * 14 - 7, W * 0.6, yy + R() * 14 - 7, W, yy + R() * 10 - 5); ctx.stroke(); } } }
      else if (v === 1) { paper(ctx, W, H, E, '#c79a62', { noise: 0.5, blots: 8, fibers: false }); ctx.fillStyle = 'rgba(90,55,25,.35)'; for (let i = 0; i < 900; i++) { ctx.beginPath(); ctx.arc(R() * W, R() * H, 1 + R() * 3.5, 0, TAU); ctx.fill(); } }
      else { ctx.fillStyle = '#d9d3c6'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(120,110,95,.18)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 7) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
      const pw = W * 0.5, ph = pw * 1.18, spots = [[0.3, 0.2, -0.12], [0.68, 0.3, 0.1], [0.34, 0.56, 0.07], [0.66, 0.72, -0.08]], caps = [E.c.title || 'good times', 'golden hour', 'us', 'more of this'];
      spots.forEach(([fx, fy, a], i) => { const cx = W * fx, cy = H * fy; shadow(ctx, E, 24, 12, 0.45, () => rot(ctx, cx, cy, a, () => { ctx.fillStyle = '#fbfaf5'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); })); rot(ctx, cx, cy, a, () => { ctx.drawImage(E.cell(i, pw - 56, ph - 128), -pw / 2 + 28, -ph / 2 + 28, pw - 56, ph - 128); ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(-pw / 2 + 28, -ph / 2 + 28, pw - 56, 6); text(ctx, caps[i], 0, ph / 2 - 30, 48, K.fonts.hand, '#333', 'center'); }); if (i === 1) tape(ctx, cx, cy - ph / 2 + 4, 140, 40, a + 0.3, 'rgba(255,240,150,.7)'); });
      text(ctx, E.date, W * 0.5, H * 0.97, 34, K.fonts.type, 'rgba(255,255,255,.85)', 'center');
    } },
    { id: 'film', name: 'Film Strip', vars: 3, text: null, draw(ctx, W, H, E) {
      const v = E.v % 3, R = E.R; ctx.fillStyle = '#17120e'; ctx.fillRect(0, 0, W, H); paper(ctx, W, H, E, '#1a1511', { noise: 0.5, blots: 3, fibers: false });
      const strip = (x, y, w, h, n, horiz, off) => { ctx.fillStyle = '#0b0907'; ctx.fillRect(x, y, w, h); const fw = horiz ? w / n : w, fh = horiz ? h : h / n, pad = 18, hole = 16;
        for (let i = 0; i < n; i++) { const fx = x + (horiz ? i * fw : 0), fy = y + (horiz ? 0 : i * fh); const ix = fx + (horiz ? pad * 0.6 : 52), iy = fy + (horiz ? 52 : pad * 0.6), iw = (horiz ? fw - pad * 1.2 : fw - 104), ih = (horiz ? fh - 104 : fh - pad * 1.2); ctx.drawImage(E.cell(i + off, iw, ih), ix, iy, iw, ih); ctx.fillStyle = '#ff9a2e'; ctx.font = `600 22px ${K.fonts.type}`; ctx.fillText(`${i + 1}A`, horiz ? ix : fx + 8, horiz ? fy + h - 14 : iy + 26); }
        ctx.fillStyle = '#efe6cd'; const cnt = Math.round((horiz ? w : h) / 40); for (let i = 0; i < cnt; i++) { const t = (i + 0.5) * ((horiz ? w : h) / cnt); [0, 1].forEach((s) => { ctx.beginPath(); if (horiz) ctx.roundRect(x + t - hole / 2, s ? y + h - 38 : y + 14, hole, 24, 4); else ctx.roundRect(s ? x + w - 38 : x + 14, y + t - hole / 2, 24, hole, 4); ctx.fill(); }); } };
      if (v === 0) strip(W * 0.2, 30, W * 0.6, H - 60, 4, false, 0);
      else if (v === 1) { strip(30, H * 0.1, W - 60, H * 0.36, 3, true, 0); strip(30, H * 0.54, W - 60, H * 0.36, 3, true, 3); }
      else { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.22); strip(-W * 0.3, -H * 0.62, W * 0.6, H * 1.24, 5, false, 0); ctx.restore(); }
      text(ctx, E.date, W - 40, H - 22, 30, K.fonts.type, '#ff9a2e', 'right');
    } },
    { id: 'booth', name: 'Photo Booth', vars: 3, text: null, draw(ctx, W, H, E) {
      const v = E.v % 3, bg = [['#8c1d2c', '#b92b3d'], ['#1f6f78', '#2f9aa5'], ['#f2b8d0', '#ffd6e6']][v];
      for (let x = 0; x < W; x += 60) { const g = ctx.createLinearGradient(x, 0, x + 60, 0); g.addColorStop(0, bg[0]); g.addColorStop(0.5, bg[1]); g.addColorStop(1, bg[0]); ctx.fillStyle = g; ctx.fillRect(x, 0, 60, H); }
      const cw = v === 2 ? W * 0.7 : W * 0.4, cx = (W - cw) / 2, cy = H * 0.04, chh = H * 0.92; shadow(ctx, E, 30, 14, 0.45, () => { ctx.fillStyle = '#fbfaf5'; ctx.fillRect(cx, cy, cw, chh); });
      const n = v === 2 ? 4 : 4, pad = cw * 0.07, gw = cw - pad * 2;
      if (v === 2) { const ww = (gw - 16) / 2, hh = ((chh - 190 - pad) - 16) / 2; for (let i = 0; i < 4; i++) { const x = cx + pad + (i % 2) * (ww + 16), y = cy + pad + ((i / 2) | 0) * (hh + 16); ctx.drawImage(E.cell(i, ww, hh), x, y, ww, hh); } }
      else { const hh = (chh - pad * 2 - 140 - (n - 1) * 14) / n; for (let i = 0; i < n; i++) { const c = E.cell(i, gw, hh); if (v === 0) bwCell(c); ctx.drawImage(c, cx + pad, cy + pad + i * (hh + 14), gw, hh); } }
      text(ctx, 'PHOTO BOOTH', W / 2, cy + chh - 76, 40, K.fonts.type, '#222', 'center'); text(ctx, E.date, W / 2, cy + chh - 34, 28, K.fonts.type, '#777', 'center'); text(ctx, 'smile!', cx + cw + 20, H * 0.2, 50, K.fonts.hand, 'rgba(255,255,255,.9)', 'left', 0.2);
    } },
  ];
  K.COLMAP = {}; K.COLLAGES.forEach((c) => (K.COLMAP[c.id] = c));
})();
