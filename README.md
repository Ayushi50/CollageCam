# Kapi Web

Mobile-first retro Y2K / CCD / DV camera + photo editor with journal-style collage templates.
Plain HTML + CSS + vanilla JS — no framework, no build step.

```
python3 -m http.server 8000   # then open http://localhost:8000 (camera needs https or localhost)
```

* `js/core.js` – helpers, settings, sheets, IndexedDB
* `js/filters.js` – 35 per-pixel presets (no `ctx.filter`), beauty smoothing, fisheye, AI pick, filter carousel
* `js/effects.js` – light & shadow layers, effects, borders, date-stamp watermarks
* `js/collage.js` – 10 original canvas-drawn collage templates, colour-based subject segmentation (optional on-device model first), Kuwahara painterly pass
* `js/render.js` – non-destructive pipeline rendered in 1080-wide design coordinates (preview 720, draft 360 while dragging, full-size export)
* `js/editor.js`, `js/camera.js`, `js/gallery.js`, `js/app.js` – UI

All art is original and procedurally drawn. Photos/videos are stored locally in IndexedDB; originals are never modified, edits are stored as JSON.
