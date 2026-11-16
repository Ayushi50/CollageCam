/* Kapi Web — library, gallery, import picker, viewer */
(function () {
  const K = window.K;
  const WEEK = 7 * 24 * 3600 * 1000;
  /* ---------- library (in-memory mirror of IndexedDB) ---------- */
  let items = [], albums = [], loadCbs = [], loaded = false;
  K.lib = {
    items: () => items, albums: () => albums,
    add(it) { items.unshift(it); },
    onload(cb) { loaded ? cb() : loadCbs.push(cb); },
    async load() {
      items = (await K.db.all()) || []; albums = (await K.db.albums()) || [];
      const now = Date.now(); for (const it of items.filter((i) => i.deleted && now - i.deleted > WEEK)) await K.db.del(it.id); items = items.filter((i) => !(i.deleted && now - i.deleted > WEEK));
      items.sort((a, b) => b.created - a.created); loaded = true; loadCbs.forEach((f) => f()); loadCbs = [];
    },
    async save(it) { await K.db.put(it); },
    live: () => items.filter((i) => !i.deleted),
  };

  /* ---------- import ---------- */
  K.importFiles = async (files, quiet) => {
    const out = []; let np = 0, nv = 0;
    for (const f of files) {
      try {
        if (f.type.startsWith('image/')) {
          let c = await K.blobToCanvas(f); const m = Math.max(c.width, c.height); if (m > 4096) { const s = 4096 / m, t = K.canvas(c.width * s, c.height * s); K.ctx(t).drawImage(c, 0, 0, t.width, t.height); c = t; }
          const created = f.lastModified || Date.now(), id = K.uid(), ph = K.makePhoto(id, c, created), st = K.defaultEdit({ filter: 'none', dateOn: false });
          const it = { id, kind: 'photo', blob: f.type === 'image/jpeg' && f.size < 6e6 ? f : await K.toBlob(c, 'image/jpeg', 0.92), thumb: await K.toBlob(K.render(ph, st, { width: 360 }), 'image/jpeg', 0.8), created, album: null, fav: false, deleted: null, w: c.width, h: c.height, edit: null, imported: true };
          await K.db.put(it); K.lib.add(it); out.push(it); np++;
        } else if (f.type.startsWith('video/')) {
          const thumb = await videoThumb(f), it = { id: K.uid(), kind: 'video', blob: f, thumb, created: f.lastModified || Date.now(), album: null, fav: false, deleted: null, w: 0, h: 0, imported: true };
          await K.db.put(it); K.lib.add(it); out.push(it); nv++;
        }
      } catch (e) { console.warn('import failed', e); }
    }
    if (!quiet || out.length) K.toast(out.length ? `Imported ${[np && np + ' photo' + (np > 1 ? 's' : ''), nv && nv + ' video' + (nv > 1 ? 's' : '')].filter(Boolean).join(' & ')} ✓` : 'Nothing to import');
    if (K.cur === 'gal') render();
    return out;
  };
  function videoThumb(file) {
    return new Promise((res) => {
      const v = document.createElement('video'), u = URL.createObjectURL(file); v.muted = true; v.playsInline = true; v.src = u;
      const done = async (c) => { URL.revokeObjectURL(u); res(c ? await K.toBlob(c, 'image/jpeg', 0.8) : null); };
      v.onloadeddata = () => { v.currentTime = Math.min(0.2, (v.duration || 1) / 2); }; v.onseeked = () => { const c = K.canvas(240, (240 * (v.videoHeight || 3)) / (v.videoWidth || 4)); K.ctx(c).drawImage(v, 0, 0, c.width, c.height); done(c); }; v.onerror = () => done(null); setTimeout(() => done(null), 4000);
    });
  }

  /* ---------- gallery screen ---------- */
  const G = { tab: 'recent', view: null, select: false, sel: new Set() };
  const dur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function visible() {
    const v = G.view;
    if (v === 'deleted') return items.filter((i) => i.deleted);
    const l = items.filter((i) => !i.deleted);
    if (v === 'fav') return l.filter((i) => i.fav); if (v === 'video') return l.filter((i) => i.kind === 'video'); if (v && v.startsWith('a:')) return l.filter((i) => i.album === v.slice(2));
    return l;
  }
  function viewTitle() { const v = G.view; return v === 'deleted' ? 'Recently Deleted' : v === 'fav' ? 'Favourites' : v === 'video' ? 'Videos' : v && v.startsWith('a:') ? (albums.find((a) => 'a:' + a.id === v) || {}).name || 'Album' : 'Gallery'; }
  function render() {
    const root = K.$('#gal-body'), list = visible(); K.$('#gal-title').textContent = G.tab === 'albums' && !G.view ? 'Albums' : viewTitle();
    K.$$('#gal-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === G.tab)); K.$('#gal-tabs').style.display = G.view ? 'none' : '';
    K.$('#gal-back').style.display = G.view ? '' : 'none'; K.$('#gal-sel').textContent = G.select ? 'Cancel' : 'Select'; K.$('#gal-bar').classList.toggle('on', G.select);
    if (G.select) { K.$('#gal-count').textContent = `${G.sel.size} selected`; const del = G.view === 'deleted'; K.$('#gal-bar').classList.toggle('del', del); }
    root.innerHTML = '';
    if (G.tab === 'albums' && !G.view) return renderAlbums(root);
    if (G.view === 'deleted') root.appendChild(K.h('<p class="mut pad sm">Items stay here for 7 days, then are removed for good.</p>'));
    if (!list.length) {
      root.appendChild(K.h(G.view ? `<div class="empty"><div class="big">${G.view === 'deleted' ? '🗑' : '✦'}</div><p>${G.view === 'deleted' ? 'Nothing here.' : 'No items yet.'}</p></div>` : `<div class="empty"><div class="big">📷</div><h3>No photos yet</h3><p class="mut">Import from your device or take a shot with the camera.</p><div class="impcard"><button class="btn pri" id="e-imp">Import photos</button><button class="btn" id="e-cam">Open camera</button></div></div>`));
      K.$('#e-imp') && (K.$('#e-imp').onclick = () => K.$('#imp-file').click()); K.$('#e-cam') && (K.$('#e-cam').onclick = () => K.go('cam')); return;
    }
    const grid = K.h('<div class="ggrid"></div>');
    list.forEach((it) => {
      const u = K.thumbURL(it), c = K.h(`<button class="gc ${G.sel.has(it.id) ? 'sel' : ''}">${u ? `<img loading="lazy" src="${u}" alt="">` : '<div class="ph"></div>'}${it.kind === 'video' ? `<i class="vb">${it.live ? '◉ LIVE' : '▶ ' + dur(it.dur || 0)}</i>` : ''}${it.fav ? '<i class="hb">♥</i>' : ''}${G.select ? `<i class="ck">${G.sel.has(it.id) ? '✓' : ''}</i>` : ''}</button>`);
      let t, long = false; c.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; if (!G.select) { G.select = true; G.sel.add(it.id); K.haptic(25); render(); } }, 480); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => c.addEventListener(n, () => clearTimeout(t)));
      c.onclick = () => { if (long) return; if (G.select) { G.sel.has(it.id) ? G.sel.delete(it.id) : G.sel.add(it.id); render(); } else openItem(it, list); };
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }
  function renderAlbums(root) {
    const live = items.filter((i) => !i.deleted), card = (key, name, n, it) => { const u = it && K.thumbURL(it); const c = K.h(`<button class="ac"><div class="ai">${u ? `<img src="${u}" alt="">` : '<span>▦</span>'}</div><b>${K.esc(name)}</b><small>${n}</small></button>`); c.onclick = () => { G.view = key; G.select = false; G.sel.clear(); render(); }; return c; };
    const g = K.h('<div class="agrid"></div>');
    const allc = card(null, 'All photos', live.length, live[0]); allc.onclick = () => { G.tab = 'recent'; render(); }; g.appendChild(allc);
    g.appendChild(card('fav', 'Favourites', live.filter((i) => i.fav).length, live.find((i) => i.fav)));
    g.appendChild(card('video', 'Videos', live.filter((i) => i.kind === 'video').length, live.find((i) => i.kind === 'video')));
    albums.forEach((a) => g.appendChild(card('a:' + a.id, a.name, live.filter((i) => i.album === a.id).length, live.find((i) => i.album === a.id))));
    const nw = K.h('<button class="ac new"><div class="ai"><span>＋</span></div><b>New album</b><small>&nbsp;</small></button>'); nw.onclick = () => newAlbum(); g.appendChild(nw);
    const del = items.filter((i) => i.deleted); g.appendChild(card('deleted', 'Recently Deleted', del.length, del[0]));
    root.appendChild(g);
  }
  function newAlbum(then) {
    const s = K.sheet('<h3>New album</h3><input class="inp" id="alb-n" placeholder="Album name" maxlength="24"><div class="row gap" style="margin-top:12px"><button class="btn" data-n>Cancel</button><button class="btn pri" data-y>Create</button></div>'); const inp = K.$('#alb-n', s.el); setTimeout(() => inp.focus(), 250);
    K.$('[data-n]', s.el).onclick = () => s.close(); K.$('[data-y]', s.el).onclick = async () => { const n = inp.value.trim(); if (!n) return; const a = { id: K.uid(), name: n, created: Date.now() }; albums.push(a); await K.db.putAlbum(a); s.close(); then ? then(a) : render(); };
  }
  function openItem(it, list) {
    if (G.view === 'deleted') { const s = K.sheet(`<h3>Recently deleted</h3><p class="mut">Restore this item or delete it forever.</p><div class="row gap"><button class="btn pri" data-r>Restore</button><button class="btn danger" data-d>Delete forever</button></div>`); K.$('[data-r]', s.el).onclick = async () => { it.deleted = null; await K.db.put(it); s.close(); K.toast('Restored'); render(); }; K.$('[data-d]', s.el).onclick = async () => { s.close(); if (await K.confirm('Delete forever?', 'This cannot be undone.', 'Delete forever')) { await K.db.del(it.id); items = items.filter((x) => x !== it); render(); } }; return; }
    if (it.kind === 'video') return viewVideo(it);
    K.openEditor([it], 0, 'gal');
  }
  function viewVideo(it) {
    const url = URL.createObjectURL(it.blob), s = K.sheet(`<video class="vv" src="${url}" ${it.live ? 'loop muted' : 'controls'} autoplay playsinline></video><div class="row gap wrap"><button class="btn" data-fav>${it.fav ? '♥ Unfavourite' : '♡ Favourite'}</button><button class="btn" data-ex>Export WebM</button><button class="btn" data-sh>Share</button><button class="btn danger" data-del>Delete</button></div>`, { cls: 'tall', onclose: () => URL.revokeObjectURL(url) });
    const ext = (it.blob.type.includes('mp4') ? 'mp4' : 'webm');
    K.$('[data-fav]', s.el).onclick = async () => { it.fav = !it.fav; await K.db.put(it); s.close(); render(); }; K.$('[data-ex]', s.el).onclick = () => K.shareOrDownload(it.blob, `kapi-${it.id}.${ext}`, false); K.$('[data-sh]', s.el).onclick = () => K.shareOrDownload(it.blob, `kapi-${it.id}.${ext}`, true);
    K.$('[data-del]', s.el).onclick = async () => { s.close(); await softDelete([it]); };
  }
  async function softDelete(arr) { for (const it of arr) { it.deleted = Date.now(); await K.db.put(it); } K.toast(`${arr.length} moved to Recently Deleted`); G.sel.clear(); G.select = false; render(); }
  const selected = () => items.filter((i) => G.sel.has(i.id));

  K.initGallery = () => {
    K.$('#gal-set').onclick = () => K.go('set');
    K.$$('#gal-tabs button').forEach((b) => (b.onclick = () => { G.tab = b.dataset.t; G.view = null; G.select = false; G.sel.clear(); render(); }));
    K.$('#gal-back').onclick = () => { G.view = null; G.select = false; G.sel.clear(); render(); };
    K.$('#gal-sel').onclick = () => { G.select = !G.select; G.sel.clear(); render(); };
    K.$('#gal-imp').onclick = () => K.$('#imp-file').click();
    const inp = K.$('#imp-file'); inp.onchange = async () => { const f = [...inp.files]; inp.value = ''; if (f.length) { await K.importFiles(f); if (K.cur === 'cam') K.go('gal'); } };
    K.$('#b-fav').onclick = async () => { const a = selected(); if (!a.length) return; const all = a.every((i) => i.fav); for (const i of a) { i.fav = !all; await K.db.put(i); } K.toast(all ? 'Removed from favourites' : 'Added to favourites ♥'); G.select = false; G.sel.clear(); render(); };
    K.$('#b-move').onclick = () => { const a = selected(); if (!a.length) return; const s = K.sheet('<h3>Move to album</h3><div id="mv"></div>'); const box = K.$('#mv', s.el); const mv = async (id) => { for (const i of a) { i.album = id; await K.db.put(i); } s.close(); K.toast(id ? 'Moved to album ✓' : 'Removed from album'); G.select = false; G.sel.clear(); render(); }; albums.forEach((al) => { const b = K.h(`<button class="lr btn block">${K.esc(al.name)}</button>`); b.onclick = () => mv(al.id); box.appendChild(b); }); const nb = K.h('<button class="btn pri block">＋ New album</button>'); nb.onclick = () => { s.close(); newAlbum((al) => mv(al.id)); }; box.appendChild(nb); if (a.some((i) => i.album)) { const rb = K.h('<button class="btn block">Remove from album</button>'); rb.onclick = () => mv(null); box.appendChild(rb); } };
    K.$('#b-del').onclick = async () => { const a = selected(); if (!a.length) return; if (G.view === 'deleted') { if (await K.confirm(`Delete ${a.length} forever?`, 'This cannot be undone.', 'Delete forever')) { for (const i of a) await K.db.del(i.id); items = items.filter((x) => !G.sel.has(x.id)); G.sel.clear(); G.select = false; render(); } return; } if (await K.confirm(`Delete ${a.length} item${a.length > 1 ? 's' : ''}?`, 'They stay in Recently Deleted for 7 days, then are removed.', 'Delete')) softDelete(a); };
    K.$('#b-restore').onclick = async () => { const a = selected(); for (const i of a) { i.deleted = null; await K.db.put(i); } K.toast(`Restored ${a.length}`); G.select = false; G.sel.clear(); render(); };
  };
  K.screens.gal = { enter() { G.select = false; G.sel.clear(); render(); } };

  /* ---------- import picker ---------- */
  K.pickMedia = ({ photosOnly = false, title = 'Import' } = {}) => new Promise((resolve) => {
    let cat = 'photo'; const sel = new Set(); let done = false;
    const s = K.sheet(`<div class="cutbar"><button class="btn" data-x>Cancel</button><b>${K.esc(title)}</b><button class="btn pri" data-ok>Add</button></div><div class="seg" id="pk-tabs"><button data-c="fav">Favourites</button>${photosOnly ? '' : '<button data-c="video">Videos</button>'}<button data-c="photo" class="on">Photos</button></div><div class="row sp"><span class="mut sm" id="pk-cnt"></span><button class="chip" data-dev>From device…</button></div><div class="ggrid pk" id="pk-grid"></div>`, { cls: 'tall', modal: true, onclose: () => { if (!done) resolve(null); } });
    const paint = () => {
      const all = items.filter((i) => !i.deleted && (photosOnly ? i.kind === 'photo' : true)); const list = cat === 'fav' ? all.filter((i) => i.fav) : cat === 'video' ? all.filter((i) => i.kind === 'video') : all.filter((i) => i.kind === 'photo');
      const grid = K.$('#pk-grid', s.el); grid.innerHTML = ''; const n = list.filter((i) => sel.has(i.id)).length; K.$('#pk-cnt', s.el).textContent = `${n} of ${list.length} selected`;
      if (!list.length) grid.innerHTML = '<div class="empty"><p class="mut">Nothing in this category.</p></div>';
      list.forEach((it) => { const u = K.thumbURL(it), c = K.h(`<button class="gc ${sel.has(it.id) ? 'sel' : ''}">${u ? `<img src="${u}" alt="">` : ''}${it.kind === 'video' ? '<i class="vb">▶</i>' : ''}<i class="ck">${sel.has(it.id) ? '✓' : ''}</i></button>`); c.onclick = () => { sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); paint(); }; grid.appendChild(c); });
    };
    K.$$('#pk-tabs button', s.el).forEach((b) => (b.onclick = () => { cat = b.dataset.c; K.$$('#pk-tabs button', s.el).forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
    K.$('[data-dev]', s.el).onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = photosOnly ? 'image/*' : 'image/*,video/*'; f.multiple = true; f.onchange = async () => { const n = await K.importFiles([...f.files]); n.forEach((i) => sel.add(i.id)); paint(); }; f.click(); };
    K.$('[data-x]', s.el).onclick = () => s.close(); K.$('[data-ok]', s.el).onclick = () => { done = true; resolve(items.filter((i) => sel.has(i.id))); s.close(); };
    paint();
  });
})();
