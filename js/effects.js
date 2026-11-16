/* Kapi Web — light & shadow layers, effects, borders, watermarks */
(function () {
  const K = window.K;
  const soft = (W, H, div, fn) => { const c = K.canvas(W / div, H / div), x = K.ctx(c); x.imageSmoothingQuality = 'high'; fn(x, c.width, c.height); return c; };
  const blit = (ctx, c, W, H, op, a) => { ctx.save(); ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, 0, 0, W, H); ctx.restore(); };
  const radial = (x, cx, cy, r, stops) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

  K.LIGHTS = [
    { id: 'sunbeam', name: 'Sunbeam' }, { id: 'blinds', name: 'Blinds' }, { id: 'leaf', name: 'Leaf Shade' }, { id: 'leak', name: 'Light Leak' },
    { id: 'prism', name: 'Prism' }, { id: 'flare', name: 'Lens Flare' }, { id: 'golden', name: 'Golden Hour' }, { id: 'bokeh', name: 'Bokeh' },
  ];
  K.light = {
    draw(ctx, W, H, id, k, seed = 7) {
      if (!id) return; const R = K.rng(seed + K.hash(id));
      if (id === 'sunbeam') {
        const l = soft(W, H, 3, (x, w, h) => {
          x.translate(w * 1.05, -h * 0.05); x.rotate(0.62);
          for (let i = 0; i < 7; i++) { const off = (i - 3) * w * 0.17 + R() * 20, bw = w * (0.05 + R() * 0.09); const g = x.createLinearGradient(0, 0, 0, h * 1.6); g.addColorStop(0, 'rgba(255,244,210,.85)'); g.addColorStop(1, 'rgba(255,244,210,0)'); x.fillStyle = g; x.fillRect(off, 0, bw, h * 1.6); }
          x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = radial(x, w, 0, w * 0.9, [[0, 'rgba(255,240,200,.9)'], [1, 'rgba(255,240,200,0)']]); x.fillRect(0, 0, w, h);
        }); blit(ctx, l, W, H, 'screen', k * 0.85);
      } else if (id === 'blinds') {
        const l = soft(W, H, 4, (x, w, h) => { x.fillStyle = '#000'; x.translate(w / 2, h / 2); x.rotate(-0.38); const n = 9, step = (h * 1.8) / n; for (let i = -n; i < n; i++) x.fillRect(-w * 1.2, i * step, w * 2.4, step * 0.52); });
        blit(ctx, l, W, H, 'multiply', k * 0.8);
        const wl = soft(W, H, 4, (x, w, h) => { x.fillStyle = 'rgba(255,236,190,.55)'; x.translate(w / 2, h / 2); x.rotate(-0.38); const n = 9, step = (h * 1.8) / n; for (let i = -n; i < n; i++) x.fillRect(-w * 1.2, i * step + step * 0.52, w * 2.4, step * 0.2); });
        blit(ctx, wl, W, H, 'screen', k * 0.6);
      } else if (id === 'leaf') {
        const l = soft(W, H, 5, (x, w, h) => { x.fillStyle = '#000'; for (let i = 0; i < 60; i++) { const px = R() * w * 1.1, py = R() * h * 0.75 * (0.4 + R()), s = (0.03 + R() * 0.07) * w; x.save(); x.translate(px, py); x.rotate(R() * 6); x.globalAlpha = 0.35 + R() * 0.5; x.beginPath(); x.ellipse(0, 0, s, s * 0.45, 0, 0, 7); x.fill(); x.restore(); } });
        blit(ctx, l, W, H, 'multiply', k * 0.85); blit(ctx, soft(W, H, 6, (x, w, h) => { x.fillStyle = radial(x, w * 0.8, 0, w, [[0, 'rgba(255,230,150,.7)'], [1, 'rgba(255,230,150,0)']]); x.fillRect(0, 0, w, h); }), W, H, 'screen', k * 0.5);
      } else if (id === 'leak') {
        const l = soft(W, H, 6, (x, w, h) => { x.fillStyle = radial(x, 0, h * 0.3, w * 0.9, [[0, 'rgba(255,90,30,.95)'], [0.5, 'rgba(255,40,120,.5)'], [1, 'rgba(255,40,120,0)']]); x.fillRect(0, 0, w, h); x.fillStyle = radial(x, w, h * 0.9, w * 0.7, [[0, 'rgba(255,200,60,.8)'], [1, 'rgba(255,200,60,0)']]); x.fillRect(0, 0, w, h); });
        blit(ctx, l, W, H, 'screen', k * 0.95);
      } else if (id === 'prism') {
        const l = soft(W, H, 4, (x, w, h) => { x.translate(w / 2, h / 2); x.rotate(0.5); const g = x.createLinearGradient(-w * 0.6, 0, w * 0.6, 0); ['#ff3b6b', '#ffb03b', '#fff23b', '#4bff7a', '#3bc8ff', '#8b5bff'].forEach((c, i, a) => { g.addColorStop(i / (a.length - 1), c); }); x.fillStyle = g; x.globalAlpha = 0.7; x.fillRect(-w * 0.6, -h * 0.9, w * 1.2, h * 0.34); x.globalAlpha = 0.4; x.fillRect(-w * 0.6, h * 0.12, w * 1.2, h * 0.14); });
        blit(ctx, l, W, H, 'screen', k * 0.8);
      } else if (id === 'flare') {
        const l = soft(W, H, 2, (x, w, h) => { const sx = w * 0.15, sy = h * 0.15, ex = w * 0.85, ey = h * 0.85; x.fillStyle = radial(x, sx, sy, w * 0.35, [[0, 'rgba(255,255,230,1)'], [0.2, 'rgba(255,220,150,.6)'], [1, 'rgba(255,200,100,0)']]); x.fillRect(0, 0, w, h);
          [[0.3, 0.05, '255,120,80'], [0.45, 0.09, '120,255,180'], [0.6, 0.04, '120,160,255'], [0.75, 0.12, '255,200,90'], [0.9, 0.06, '255,100,200']].forEach(([t, r, c]) => { const px = sx + (ex - sx) * t, py = sy + (ey - sy) * t; x.fillStyle = radial(x, px, py, r * w, [[0, `rgba(${c},.0)`], [0.7, `rgba(${c},.35)`], [1, `rgba(${c},0)`]]); x.beginPath(); x.arc(px, py, r * w, 0, 7); x.fill(); });
          const g = x.createLinearGradient(0, sy, w, sy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.15, 'rgba(255,240,220,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, sy - 2, w, 4); });
        blit(ctx, l, W, H, 'screen', k * 0.9);
      } else if (id === 'golden') {
        const l = soft(W, H, 6, (x, w, h) => { const g = x.createLinearGradient(w, 0, 0, h); g.addColorStop(0, 'rgba(255,150,40,.95)'); g.addColorStop(0.55, 'rgba(255,170,90,.35)'); g.addColorStop(1, 'rgba(255,120,60,.1)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
        blit(ctx, l, W, H, 'overlay', k); blit(ctx, l, W, H, 'soft-light', k * 0.8);
        blit(ctx, soft(W, H, 6, (x, w, h) => { x.fillStyle = radial(x, w, 0, w * 0.8, [[0, 'rgba(255,200,100,.8)'], [1, 'rgba(255,200,100,0)']]); x.fillRect(0, 0, w, h); }), W, H, 'screen', k * 0.55);
      } else if (id === 'bokeh') {
        const l = soft(W, H, 3, (x, w, h) => { for (let i = 0; i < 26; i++) { const px = R() * w, py = R() * h, r = (0.025 + R() * 0.07) * w, hue = 30 + R() * 40, a = 0.15 + R() * 0.35; x.fillStyle = radial(x, px, py, r, [[0, `hsla(${hue},100%,80%,${a * 0.5})`], [0.85, `hsla(${hue},100%,75%,${a})`], [1, `hsla(${hue},100%,75%,0)`]]); x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } });
        blit(ctx, l, W, H, 'screen', k);
      }
    },
  };

  K.EFFECTS = [{ id: 'glitch', name: 'Glitch' }, { id: 'vhs', name: 'VHS' }, { id: 'dust', name: 'Dust' }, { id: 'glow', name: 'Glow' }, { id: 'prism', name: 'Prism' }, { id: 'ghost', name: 'Ghost' }, { id: 'pixel', name: 'Pixel' }, { id: 'grain', name: 'Grain' }, { id: 'fisheye', name: 'Fisheye' }];
  const shiftChan = (c, dr, db) => {
    const W = c.width, H = c.height, x = K.ctx(c, 1), im = x.getImageData(0, 0, W, H), d = im.data, s = new Uint8ClampedArray(d);
    for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) { const i = (y * W + px) * 4; d[i] = s[(y * W + Math.min(W - 1, Math.max(0, px + dr))) * 4]; d[i + 2] = s[(y * W + Math.min(W - 1, Math.max(0, px + db))) * 4 + 2]; }
    x.putImageData(im, 0, 0);
  };
  K.effects = {
    apply(c, id, k, seed = 5) {
      if (!id) return c; const W = c.width, H = c.height, x = K.ctx(c), R = K.rng(seed + K.hash(id));
      if (id === 'glitch') {
        const cp = K.canvas(W, H); K.ctx(cp).drawImage(c, 0, 0);
        const n = 4 + Math.round(k * 12); for (let i = 0; i < n; i++) { const y = R() * H, h = (0.01 + R() * 0.06) * H, dx = (R() - 0.5) * W * 0.18 * k; x.drawImage(cp, 0, y, W, h, dx, y, W, h); }
        shiftChan(c, Math.round(W * 0.012 * k), -Math.round(W * 0.012 * k));
      } else if (id === 'vhs') {
        const cp = K.canvas(W, H); K.ctx(cp).drawImage(c, 0, 0); const step = Math.max(2, Math.round(H / 240));
        for (let y = 0; y < H; y += step) { const off = Math.sin(y * 0.03 + seed) * W * 0.004 * k + (y > H * 0.86 ? (R() - 0.5) * W * 0.04 * k : 0); x.drawImage(cp, 0, y, W, step, off, y, W, step); }
        shiftChan(c, Math.round(W * 0.006 * k + 1), -Math.round(W * 0.006 * k + 1));
        x.fillStyle = `rgba(0,0,0,${0.28 * k})`; for (let y = 0; y < H; y += step * 2) x.fillRect(0, y, W, step);
        x.fillStyle = `rgba(255,255,255,${0.12 * k})`; x.fillRect(0, H * (0.88 + R() * 0.05), W, H * 0.012);
        x.fillStyle = `rgba(80,60,160,${0.1 * k})`; x.fillRect(0, 0, W, H);
      } else if (id === 'dust') {
        x.save(); const n = Math.round((60 + 220 * k) * (W / 540));
        for (let i = 0; i < n; i++) { const px = R() * W, py = R() * H, r = (0.4 + R() * 1.8) * (W / 540); x.fillStyle = R() > 0.3 ? `rgba(255,255,245,${0.25 + R() * 0.5})` : `rgba(20,15,10,${0.2 + R() * 0.4})`; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
        x.strokeStyle = `rgba(255,255,255,${0.35 * k})`; x.lineWidth = Math.max(1, W / 540);
        for (let i = 0; i < 4 + k * 8; i++) { x.beginPath(); let px = R() * W, py = R() * H; x.moveTo(px, py); for (let j = 0; j < 5; j++) { px += (R() - 0.5) * 30 * (W / 540); py += (R() - 0.3) * 24 * (W / 540); x.lineTo(px, py); } x.stroke(); }
        x.restore();
      } else if (id === 'glow') { K.bloom(c, 0.5 + k * 0.9); x.save(); x.globalCompositeOperation = 'soft-light'; x.globalAlpha = k * 0.5; x.fillStyle = 'rgba(255,200,170,1)'; x.fillRect(0, 0, W, H); x.restore(); }
      else if (id === 'prism') {
        shiftChan(c, Math.round(W * 0.018 * k), -Math.round(W * 0.018 * k));
        const g = x.createLinearGradient(0, 0, W, H); ['#ff2d95', '#ffd02d', '#2dffb4', '#2d6bff'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col)); x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.25 * k; x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
      } else if (id === 'ghost') {
        const cp = K.canvas(W, H); K.ctx(cp).drawImage(c, 0, 0); x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.4 * k;
        x.drawImage(cp, -W * 0.02, -H * 0.02, W * 1.05, H * 1.05); x.globalAlpha = 0.25 * k; x.drawImage(cp, W * 0.03, H * 0.01, W * 0.96, H * 0.98); x.restore();
      } else if (id === 'pixel') {
        const f = Math.max(2, Math.round(W / (160 - k * 110))), t = K.canvas(Math.ceil(W / f), Math.ceil(H / f)); K.ctx(t).drawImage(c, 0, 0, t.width, t.height); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, W, H); x.imageSmoothingEnabled = true;
      } else if (id === 'grain') {
        const im = x.getImageData(0, 0, W, H), d = im.data, a = 70 * k; for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
      } else if (id === 'fisheye') K.fisheye(c, k);
      return c;
    },
  };

  /* borders: return {canvas, inner} */
  K.BORDERS = [{ id: 'thin', name: 'Thin' }, { id: 'thick', name: 'Thick' }, { id: 'polaroid', name: 'Polaroid' }, { id: 'film', name: 'Film strip' }, { id: 'stamp', name: 'Stamp' }, { id: 'rounded', name: 'Rounded' }, { id: 'torn', name: 'Torn' }, { id: 'y2k', name: 'Y2K' }, { id: 'line', name: 'Line' }];
  K.borders = {
    apply(src, id, k = 0.5, dark = false, seed = 3) {
      const W = src.width, H = src.height, full = { x: 0, y: 0, w: W, h: H };
      if (!id) return { canvas: src, inner: full };
      const out = K.canvas(W, H), x = K.ctx(out), m = 0.5 + k, R = K.rng(seed), S = W / 1080; let inner = full;
      const paper = dark ? '#111' : '#fbfaf6';
      const place = (ix, iy, iw, ih) => { x.imageSmoothingQuality = 'high'; x.drawImage(src, ix, iy, iw, ih); inner = { x: ix, y: iy, w: iw, h: ih }; };
      if (id === 'thin' || id === 'thick') { const mg = Math.round(W * (id === 'thin' ? 0.022 : 0.07) * m); x.fillStyle = paper; x.fillRect(0, 0, W, H); place(mg, mg, W - 2 * mg, H - 2 * mg); }
      else if (id === 'polaroid') {
        x.fillStyle = dark ? '#222' : '#ece8df'; x.fillRect(0, 0, W, H); const mg = Math.round(W * 0.06 * m), bt = Math.round(H * 0.17 * m); x.fillStyle = paper; x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 20 * S; x.fillRect(mg * 0.4, mg * 0.4, W - mg * 0.8, H - mg * 0.8); x.shadowColor = 'transparent';
        place(mg, mg, W - 2 * mg, H - mg - bt);
      } else if (id === 'film') {
        x.fillStyle = '#0c0b0a'; x.fillRect(0, 0, W, H); const mg = Math.round(H * 0.085 * m); place(Math.round(W * 0.03), mg, W - Math.round(W * 0.06), H - 2 * mg);
        x.fillStyle = '#f2e9d0'; const hw = mg * 0.36, hh = mg * 0.5, n = Math.round(W / (hw * 2.2)); for (let i = 0; i < n; i++) { const hx = (i + 0.5) * (W / n) - hw / 2; [mg * 0.25, H - mg * 0.25 - hh].forEach((hy) => { x.beginPath(); x.roundRect(hx, hy, hw, hh, hw * 0.2); x.fill(); }); }
        x.fillStyle = '#ff9a2e'; x.font = `600 ${mg * 0.3}px ${K.fonts.type}`; x.fillText('KAPI 400  ▸ 12', W * 0.05, H - mg * 0.62 + mg * 0.3); x.fillText('12A', W * 0.84, H - mg * 0.62 + mg * 0.3);
      } else if (id === 'stamp') {
        x.fillStyle = dark ? '#2a2a2a' : '#d9cfbd'; x.fillRect(0, 0, W, H); const mg = Math.round(W * 0.07 * m), r = W * 0.012 * m + 4; x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 14 * S; x.fillStyle = '#fff'; x.fillRect(mg, mg, W - 2 * mg, H - 2 * mg); x.restore();
        x.fillStyle = dark ? '#2a2a2a' : '#d9cfbd'; const sp = r * 2.6; for (let px = mg; px <= W - mg; px += sp) { x.beginPath(); x.arc(px, mg, r, 0, 7); x.fill(); x.beginPath(); x.arc(px, H - mg, r, 0, 7); x.fill(); } for (let py = mg; py <= H - mg; py += sp) { x.beginPath(); x.arc(mg, py, r, 0, 7); x.fill(); x.beginPath(); x.arc(W - mg, py, r, 0, 7); x.fill(); }
        const pm = mg + W * 0.035; place(pm, pm, W - 2 * pm, H - 2 * pm);
      } else if (id === 'rounded') {
        x.fillStyle = dark ? '#000' : '#f4f1ea'; x.fillRect(0, 0, W, H); const mg = Math.round(W * 0.05 * m); x.save(); x.beginPath(); x.roundRect(mg, mg, W - 2 * mg, H - 2 * mg, W * 0.07); x.clip(); place(mg, mg, W - 2 * mg, H - 2 * mg); x.restore();
      } else if (id === 'torn') {
        x.fillStyle = dark ? '#1b1814' : '#e9e1d0'; x.fillRect(0, 0, W, H); const mg = Math.round(W * 0.06 * m), jit = W * 0.012; const pts = []; const edge = (x0, y0, x1, y1) => { const n = 40; for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + (R() - 0.5) * jit * 2, y0 + (y1 - y0) * t + (R() - 0.5) * jit * 2]); } };
        edge(mg, mg, W - mg, mg); edge(W - mg, mg, W - mg, H - mg); edge(W - mg, H - mg, mg, H - mg); edge(mg, H - mg, mg, mg);
        const path = new Path2D(); pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1]))); path.closePath();
        x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 16 * S; x.fillStyle = '#fff'; x.fill(path); x.restore();
        x.save(); const off = new Path2D(); pts.forEach((p, i) => { const qx = p[0] + (p[0] < W / 2 ? 1 : -1) * jit * 0.9, qy = p[1] + (p[1] < H / 2 ? 1 : -1) * jit * 0.9; i ? off.lineTo(qx, qy) : off.moveTo(qx, qy); }); off.closePath(); x.clip(off); place(mg, mg, W - 2 * mg, H - 2 * mg); x.restore();
      } else if (id === 'y2k') {
        const g = x.createLinearGradient(0, 0, W, H); ['#ff9ad5', '#b9a7ff', '#8fe9ff', '#fff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); x.fillStyle = g; x.fillRect(0, 0, W, H);
        const mg = Math.round(W * 0.06 * m); x.save(); x.beginPath(); x.roundRect(mg, mg, W - 2 * mg, H - 2 * mg, W * 0.035); x.clip(); place(mg, mg, W - 2 * mg, H - 2 * mg); x.restore();
        x.strokeStyle = '#fff'; x.lineWidth = 6 * S; x.beginPath(); x.roundRect(mg, mg, W - 2 * mg, H - 2 * mg, W * 0.035); x.stroke(); x.strokeStyle = 'rgba(80,60,160,.6)'; x.lineWidth = 2 * S; x.beginPath(); x.roundRect(mg - 8 * S, mg - 8 * S, W - 2 * mg + 16 * S, H - 2 * mg + 16 * S, W * 0.04); x.stroke();
        const star = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.25 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
        star(mg * 0.5, mg * 0.5, mg * 0.45, '#fff'); star(W - mg * 0.5, H - mg * 0.5, mg * 0.45, '#fff'); star(W - mg * 0.45, mg * 0.5, mg * 0.28, '#fff7a8'); star(mg * 0.45, H - mg * 0.5, mg * 0.28, '#fff7a8');
      } else if (id === 'line') {
        x.drawImage(src, 0, 0); const mg = W * 0.035 * m; x.strokeStyle = dark ? '#ffe926' : '#fff'; x.lineWidth = Math.max(2, 3 * S); x.strokeRect(mg, mg, W - 2 * mg, H - 2 * mg); x.lineWidth = Math.max(1, 1.5 * S); x.strokeRect(mg + 10 * S, mg + 10 * S, W - 2 * mg - 20 * S, H - 2 * mg - 20 * S); inner = { x: mg, y: mg, w: W - 2 * mg, h: H - 2 * mg };
      }
      return { canvas: out, inner };
    },
  };

  /* watermark / date stamps */
  K.WM_STYLES = [{ id: 'orange', name: 'Orange digital' }, { id: 'white', name: 'White retro' }, { id: 'hand', name: 'Handwritten' }, { id: 'type', name: 'Typewriter' }, { id: 'rec', name: 'REC overlay' }];
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const seg7 = (x, ch, px, py, w, h, lw) => {
    const m = lw / 2, hx = { a: [px + m, py + m, px + w - m, py + m], g: [px + m, py + h / 2, px + w - m, py + h / 2], d: [px + m, py + h - m, px + w - m, py + h - m], f: [px + m, py + m, px + m, py + h / 2], b: [px + w - m, py + m, px + w - m, py + h / 2], e: [px + m, py + h / 2, px + m, py + h - m], c: [px + w - m, py + h / 2, px + w - m, py + h - m] };
    (SEG[ch] || '').split('').forEach((s) => { const q = hx[s]; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[2], q[3]); x.stroke(); });
  };
  K.fmtDate = (d, style) => {
    const p = (n) => String(n).padStart(2, '0'), M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    if (style === 'orange') return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
    if (style === 'white') return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
    if (style === 'hand') return `${M[d.getMonth()][0]}${M[d.getMonth()].slice(1).toLowerCase()} ${d.getDate()}, ${d.getFullYear()}`;
    if (style === 'type') return `${p(d.getDate())} ${M[d.getMonth()]} ${d.getFullYear()}`;
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  K.watermark = {
    draw(ctx, W, H, wm, inner, fallbackDate) {
      if (!wm || !wm.on) return; inner = inner || { x: 0, y: 0, w: W, h: H };
      const d = wm.date ? new Date(wm.date) : fallbackDate ? new Date(fallbackDate) : new Date(), st = wm.style || 'orange', txt = K.fmtDate(d, st), S = inner.w / 1080, rx = inner.x + inner.w - 54 * S, by = inner.y + inner.h - 50 * S;
      ctx.save(); ctx.textBaseline = 'alphabetic';
      if (st === 'orange') {
        const h = 54 * S, w = h * 0.56, lw = h * 0.13, gap = w * 0.42; ctx.lineCap = 'round'; ctx.lineWidth = lw;
        let total = 0; for (const ch of txt) total += ch === ' ' ? w * 0.8 : ch === "'" ? gap * 1.1 : w + gap;
        let px = rx - total, py = by - h; ctx.shadowColor = 'rgba(255,120,0,.9)'; ctx.shadowBlur = 10 * S; ctx.strokeStyle = '#ff8a1e';
        for (const ch of txt) { if (ch === ' ') px += w * 0.8; else if (ch === "'") { ctx.beginPath(); ctx.moveTo(px + 2 * S, py); ctx.lineTo(px - 2 * S, py + h * 0.2); ctx.stroke(); px += gap * 1.1; } else { seg7(ctx, ch, px, py, w, h, lw); px += w + gap; } }
        if (wm.text) { ctx.shadowBlur = 8 * S; ctx.fillStyle = '#ff8a1e'; ctx.textAlign = 'right'; ctx.font = `700 ${34 * S}px ${K.fonts.type}`; ctx.fillText(wm.text, rx, py - 14 * S); }
      } else if (st === 'white') {
        ctx.font = `600 ${40 * S}px ${K.fonts.type}`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 6 * S; ctx.shadowOffsetY = 2 * S; ctx.fillText(txt, rx, by); if (wm.text) { ctx.font = `500 ${30 * S}px ${K.fonts.type}`; ctx.fillText(wm.text, rx, by - 50 * S); }
      } else if (st === 'hand') {
        ctx.font = `${68 * S}px ${K.fonts.hand}`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8 * S; ctx.save(); ctx.translate(rx, by); ctx.rotate(-0.04); ctx.fillText(txt, 0, 0); if (wm.text) ctx.fillText(wm.text, 0, -66 * S); ctx.restore();
      } else if (st === 'type') {
        ctx.font = `${38 * S}px ${K.fonts.type}`; ctx.textAlign = 'right'; const lines = [txt, wm.text].filter(Boolean); lines.forEach((l, i) => { const ly = by - (lines.length - 1 - i) * 52 * S, w = ctx.measureText(l).width; ctx.fillStyle = 'rgba(245,240,225,.9)'; ctx.fillRect(rx - w - 12 * S, ly - 36 * S, w + 24 * S, 48 * S); ctx.fillStyle = '#222'; ctx.fillText(l, rx, ly); });
      } else { // rec
        const ix = inner.x, iy = inner.y, m = 44 * S, L = 54 * S; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * S; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4 * S;
        [[ix + m, iy + m, 1, 1], [ix + inner.w - m, iy + m, -1, 1], [ix + m, iy + inner.h - m, 1, -1], [ix + inner.w - m, iy + inner.h - m, -1, -1]].forEach(([cx, cy, sx, sy]) => { ctx.beginPath(); ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); ctx.stroke(); });
        ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(ix + m + 14 * S + 16 * S, iy + m + 44 * S, 16 * S, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `700 ${46 * S}px ${K.fonts.type}`; ctx.textAlign = 'left'; ctx.fillText('REC', ix + m + 58 * S, iy + m + 60 * S);
        ctx.textAlign = 'right'; ctx.font = `600 ${36 * S}px ${K.fonts.type}`; ctx.fillText(txt, ix + inner.w - m - 6 * S, iy + inner.h - m - 14 * S); if (wm.text) ctx.fillText(wm.text, ix + inner.w - m - 6 * S, iy + inner.h - m - 58 * S);
      }
      ctx.restore();
    },
  };
})();
