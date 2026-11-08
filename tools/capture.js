import { createScene } from '../src/hero/scene.js';

const canvas = document.getElementById('c');
const q = new URLSearchParams(location.search);
const w = Number(q.get('w') || innerWidth), h = Number(q.get('h') || innerHeight);

createScene(canvas, { base: '/', dpr: 1, quality: 'high' }).then((s) => {
  s.setSize(w, h);
  window.renderAt = (u) => { s.setProgress(u); s.render(); return true; };
  window.sceneReady = true;
}).catch((e) => { window.sceneError = String(e && e.stack || e); });
