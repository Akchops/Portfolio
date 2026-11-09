// Floodlights, phone tier: the pre-rendered frame sequence.
//
// Frames are captured from the same scene the desktop runs live
// (scripts/render-sequence.mjs), so the two tiers show the same shot. Scroll
// addresses a frame; nothing is rendered on the phone.
//
// Memory (immersive-scroll frame-sequences.md): a decoded frame costs
// w x h x 4 bytes whatever its file size, and mobile Safari discards tabs
// above ~60 MB of resident pixels without an error. So the whole sequence is
// kept resident only at ladder size (180x320), with a sliding window of
// full-resolution frames around the playhead. Budgets are in each manifest
// and verified by scripts/check-sequence.mjs.

export async function mount(stage, { onFail = () => {} } = {}) {
  const portrait = window.innerHeight >= window.innerWidth;
  const root = new URL(`seq/floodlights-${portrait ? 'portrait' : 'landscape'}/`, document.baseURI);
  const manifest = await (await fetch(new URL('manifest.json', root))).json();

  // Tier by viewport width, read from the manifest so the budgets and the code
  // cannot drift apart.
  const vw = window.innerWidth;
  const tier = manifest.tiers.find((t) => t.maxWidth == null || vw <= t.maxWidth) ?? manifest.tiers.at(-1);
  const COUNT = tier.frames;
  const WINDOW = tier.window;
  const pad = (i) => String(i).padStart(4, '0');
  const hiSrc = (i) => new URL(`${tier.dir}/${pad(i)}.jpg`, root);
  const loSrc = (i) => new URL(`${manifest.ladder.dir}/${pad(i * (tier.step ?? 1))}.jpg`, root);

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { onFail(); return null; }

  const lo = new Array(COUNT).fill(null);   // always resident
  const hi = new Array(COUNT).fill(null);   // sliding window only
  const inflight = new Set();
  let alive = true;

  // srcOf is called only for a frame that is actually fetched: paint() asks
  // for the whole window on each new index, and most of it is already
  // resident.
  async function decode(i, srcOf, into, key) {
    if (into[i] || inflight.has(key) || !alive) return;
    inflight.add(key);
    try {
      const res = await fetch(srcOf(i));
      if (!res.ok) throw new Error(String(res.status));
      // createImageBitmap decodes off the main thread: the scroll handler
      // never pays for a JPEG decode.
      const bmp = await createImageBitmap(await res.blob());
      if (alive) into[i] = bmp; else bmp.close();
    } catch { /* leave empty; draw() falls back to the ladder */ }
    finally { inflight.delete(key); }
  }

  function evict(center) {
    for (let i = 0; i < COUNT; i++) {
      if (hi[i] && Math.abs(i - center) > WINDOW) {
        hi[i].close();   // free now; waiting for GC lets the peak hit the ceiling
        hi[i] = null;
      }
    }
  }

  // The backing store is the visible (object-fit: cover) crop of a frame at
  // the tier's native resolution, never more than the screen's own pixels.
  // A full-resolution frame is then a 1:1 blit, and the compositor scales the
  // canvas to the stage. Sizing it to the screen instead (780 x 1688 on a
  // 390px phone at dpr 2) upscaled every 540 x 960 frame on the main thread,
  // which added cost but no detail.
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    const sw = Math.max(1, r.width), sh = Math.max(1, r.height);
    const fit = Math.min(tier.width / sw, tier.height / sh, dpr);
    canvas.width = Math.max(1, Math.round(sw * fit));
    canvas.height = Math.max(1, Math.round(sh * fit));
    state.drawn = -1;
  }

  // object-fit: cover, matching the still underneath exactly.
  function draw(i) {
    const f = hi[i] || lo[i];
    if (!f) return false;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / f.width, ch / f.height);
    const w = cw / s, h = ch / s;
    ctx.drawImage(f, (f.width - w) / 2, (f.height - h) / 2, w, h, 0, 0, cw, ch);
    return true;
  }

  const state = { i: 0, drawn: -1, shownHi: false, issued: -1 };

  function paint() {
    if (!alive) return;
    const i = state.i;
    const sharp = !!hi[i];
    if (i !== state.drawn || (sharp && !state.shownHi)) {
      if (draw(i)) {
        state.drawn = i;
        state.shownHi = sharp;
        if (!canvas.isConnected) stage.appendChild(canvas);
      }
    }
    // Decode work is issued here, never awaited: current frame first, then
    // outwards in both directions. Only when the playhead reaches a new frame;
    // the catch-up loop calls paint() every animation frame while it settles.
    if (i === state.issued) return;
    state.issued = i;
    decode(i, hiSrc, hi, 'h' + i).then(() => { if (state.i === i && hi[i] && !state.shownHi) paint(); });
    for (let d = 1; d <= WINDOW; d++) {
      if (i + d < COUNT) decode(i + d, hiSrc, hi, 'h' + (i + d));
      if (i - d >= 0) decode(i - d, hiSrc, hi, 'h' + (i - d));
    }
    evict(i);
  }

  // Ladder, coarse to fine: every 8th frame first so scrubbing already works,
  // then the rest in idle time.
  async function warm() {
    for (let i = 0; i < COUNT; i += 8) await decode(i, loSrc, lo, 'l' + i);
    await decode(COUNT - 1, loSrc, lo, 'l' + (COUNT - 1));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 16));
    for (let i = 0; i < COUNT; i++) {
      if (!lo[i]) await new Promise((r) => idle(r, { timeout: 200 })).then(() => decode(i, loSrc, lo, 'l' + i));
    }
  }

  size();
  await decode(0, hiSrc, hi, 'h0');
  await decode(0, loSrc, lo, 'l0');
  if (!hi[0] && !lo[0]) { alive = false; onFail(); return null; }
  warm();

  const ro = new ResizeObserver(() => { size(); paint(); });
  ro.observe(stage);

  return {
    render(u) {
      state.i = Math.min(COUNT - 1, Math.max(0, Math.round(u * (COUNT - 1))));
      paint();
    },
    destroy() {
      alive = false;
      ro.disconnect();
      canvas.remove();
      [...lo, ...hi].forEach((b) => b?.close());
    },
  };
}
