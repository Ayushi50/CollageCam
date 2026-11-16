/* Kapi Web — core helpers, settings, sheets, toasts, IndexedDB */
(function () {
  const K = (window.K = {});
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  K.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  K.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  K.rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  K.hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  K.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  K.ctx = (c, ro) => c.getContext('2d', ro ? { willReadFrequently: true } : undefined);
  K.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  K.blobToCanvas = async (blob) => {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const c = K.canvas(img.naturalWidth, img.naturalHeight); K.ctx(c).drawImage(img, 0, 0); return c;
    } finally { URL.revokeObjectURL(url); }
  };
  K.toBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((res) => c.toBlob(res, type, q));
  K.fonts = { hand: '"Caveat","Segoe Script","Bradley Hand","Marker Felt",cursive', type: '"Special Elite","Courier New",Courier,monospace', ui: 'Inter,system-ui,sans-serif' };

  /* settings */
  const DEF = { filter: 'dv1', ratio: '3:4', dateOn: true, dateStyle: 'orange', saveOrig: true, haptics: true, editAfter: true, model: true, favs: [], hiddenCats: [], catOrder: null, introDone: false, newSeen: {} };
  let stored = {}; try { stored = JSON.parse(localStorage.getItem('kapi.s') || '{}'); } catch (e) {}
  K.S = Object.assign({}, DEF, stored);
  K.save = () => { try { localStorage.setItem('kapi.s', JSON.stringify(K.S)); } catch (e) {} };
  K.haptic = (n = 10) => { if (K.S.haptics && navigator.vibrate) try { navigator.vibrate(n); } catch (e) {} };

  /* toast */
  let toastT;
  K.toast = (msg, ms = 2200) => {
    const t = K.$('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
  };

  /* bottom sheet / modal */
  K.sheet = (html, opts = {}) => {
    const root = K.$('#overlays');
    const ov = K.h(`<div class="ov"><div class="sheet ${opts.cls || ''}"><div class="grab"></div>${html}</div></div>`);
    root.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));
    const api = { el: ov.firstChild, close() { ov.classList.remove('on'); setTimeout(() => ov.remove(), 220); opts.onclose && opts.onclose(); } };
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov && !opts.modal) api.close(); });
    return api;
  };
  K.confirm = (title, msg, ok = 'Delete', danger = true) => new Promise((res) => {
    const s = K.sheet(`<h3>${K.esc(title)}</h3><p class="mut">${K.esc(msg)}</p><div class="row gap"><button class="btn" data-n>Cancel</button><button class="btn ${danger ? 'danger' : 'pri'}" data-y>${K.esc(ok)}</button></div>`, { modal: true });
    K.$('[data-n]', s.el).onclick = () => { s.close(); res(false); };
    K.$('[data-y]', s.el).onclick = () => { s.close(); res(true); };
  });

  /* slider */
  K.slider = (o) => {
    const el = K.h(`<label class="sl"><span class="sl-l">${o.label}</span><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 0.01}" value="${o.value}"><span class="sl-v"></span></label>`);
    const inp = K.$('input', el), val = K.$('.sl-v', el);
    const fmt = o.fmt || ((v) => (o.pct ? Math.round(v * 100) : (+v).toFixed(2).replace(/\.?0+$/, '') || '0'));
    const show = () => { val.textContent = fmt(+inp.value); inp.style.setProperty('--p', ((inp.value - o.min) / (o.max - o.min)) * 100 + '%'); };
    inp.addEventListener('input', () => { show(); o.oninput && o.oninput(+inp.value); });
    inp.addEventListener('change', () => { o.onchange && o.onchange(+inp.value); });
    el.set = (v) => { inp.value = v; show(); };
    el.get = () => +inp.value;
    show();
    return el;
  };

  /* screens */
  K.screens = {};
  K.cur = null;
  K.go = (name, arg) => {
    const prev = K.cur;
    if (prev && K.screens[prev] && K.screens[prev].leave) K.screens[prev].leave(name);
    K.$$('.screen').forEach((s) => s.classList.toggle('on', s.id === name));
    K.cur = name;
    if (K.screens[name] && K.screens[name].enter) K.screens[name].enter(arg, prev);
  };

  /* IndexedDB */
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('kapi-web', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('items', { keyPath: 'id' }); d.createObjectStore('albums', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const rq = fn(s); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
  K.db = {
    put: (it) => tx('items', 'readwrite', (s) => s.put(it)),
    get: (id) => tx('items', 'readonly', (s) => s.get(id)),
    all: () => tx('items', 'readonly', (s) => s.getAll()),
    del: (id) => tx('items', 'readwrite', (s) => s.delete(id)),
    putAlbum: (a) => tx('albums', 'readwrite', (s) => s.put(a)),
    albums: () => tx('albums', 'readonly', (s) => s.getAll()),
    delAlbum: (id) => tx('albums', 'readwrite', (s) => s.delete(id)),
  };
  K.urls = new Map(); // blob object-URL cache for thumbnails
  K.thumbURL = (it) => { if (!it.thumb) return ''; let u = K.urls.get(it.id + (it.tv || 0)); if (!u) { u = URL.createObjectURL(it.thumb); K.urls.set(it.id + (it.tv || 0), u); } return u; };
})();
