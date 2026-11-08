// Floodlights, desktop tier: the live Three.js scene.
// Lazily imported by boot.js only after the silent probe has passed, so
// Three.js never touches the first-load budget.

import { createScene } from './scene.js';

export async function mount(stage, caps, { onFail = () => {}, watchdog = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__canvas';
  canvas.setAttribute('aria-hidden', 'true');   // decorative; the h1 and the still carry meaning

  // Public assets resolve against the page, so the build works under any base path.
  const base = new URL('./', document.baseURI).href;
  // 3x DPR costs 2.25x the fill of 2x for no visible gain; medium-tier
  // machines get 1.5.
  let dpr = Math.min(window.devicePixelRatio || 1, caps.tier === 'high' ? 2 : 1.5);
  const scene = await createScene(canvas, { base, dpr, quality: caps.tier });

  let u = 0;
  let alive = true;
  const size = () => {
    const r = stage.getBoundingClientRect();
    scene.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
  };
  size();
  scene.setProgress(0);
  scene.render();
  // Appended only once it holds a frame, so the still underneath is never
  // replaced by an empty canvas.
  stage.appendChild(canvas);

  const draw = () => { if (alive) { scene.setProgress(u); scene.render(); } };

  const ro = new ResizeObserver(() => { size(); draw(); });
  ro.observe(stage);

  function fail() {
    if (!alive) return;
    alive = false;
    ro.disconnect();
    canvas.remove();          // the static frame beneath is already painted
    try { scene.dispose(); } catch { /* context may already be gone */ }
    onFail();
  }

  // Context loss is normal (GPU reset, tab backgrounded). Without
  // preventDefault the context can never return; we do not try to rebuild,
  // we fall back to the static frame, which loses no content.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); }, false);

  // Watchdog: judge only frames drawn while scrolling. Sustained frames over
  // 34 ms (two missed vsyncs) first drop the resolution to 1x, then drop to
  // the static frame. A single long frame during boot is ignored.
  let last = 0, slow = 0, stepped = false;
  function judge(now) {
    if (!watchdog || !last) { last = now; return; }
    const dt = now - last;
    last = now;
    if (dt > 120) return;               // a pause in scrolling, not a slow frame
    slow = dt > 34 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 45) {
      slow = 0;
      if (!stepped && dpr > 1) { stepped = true; dpr = 1; scene.renderer.setPixelRatio(1); size(); }
      else fail();
    }
  }

  return {
    render(next) {
      if (!alive) return;
      u = next;
      draw();
      judge(performance.now());
    },
    destroy: fail,
  };
}
