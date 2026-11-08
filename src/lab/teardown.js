// Kessel Optics teardown.
//
// Layout and interaction pattern after the Orrin/Kessel concept (rebuilt from
// its description, no code reused): a sticky stage, one screen of scroll per
// stop, the stop's name and caption beside the stage (below it on phones), a
// small map of where the camera is, and a numbered part list that jumps to a
// part.
//
// The "camera" is a transform on the exploded-line still: between stops it
// flies along the line to the next part, holds, and the part's own close-up
// still fades in over the dimmed line. Stills and part positions are from the
// Kessel concept's own renders (public/kessel/, see CREDITS.md).
//
// Stops: 0 taken apart, 1-8 the parts front to back, 9 back together.
// Reduced motion and no JS keep the base layout: every still in a column with
// its caption. This module never runs for them.

import { reduceMotion, clamp, smooth } from '../util.js';
import { qa } from '../probe.js';

// Part centres in each exploded still, as fractions of the image (x, y).
// Measured from the renders (the concept's td-apart*.json).
const WIDE = {
  'front-element': [0.0896, 0.4575], 'glass-1': [0.1978, 0.4503], blades: [0.4095, 0.4147],
  'focus-ring': [0.4714, 0.4155], scale: [0.596, 0.3915], barrel: [0.6968, 0.3371],
  mount: [0.8436, 0.3716], signature: [0.9215, 0.4376],
};
const TALL = {
  'front-element': [0.2244, 0.2963], 'glass-1': [0.3005, 0.3402], blades: [0.4714, 0.4247],
  'focus-ring': [0.4953, 0.4419], scale: [0.6166, 0.5031], barrel: [0.7314, 0.5338],
  mount: [0.8442, 0.6305], signature: [0.8565, 0.6919],
};

export function mount(root) {
  if (reduceMotion() || qa.static) return;
  const td = root.querySelector('.td');
  const frame = root.querySelector('.td__frame');
  const line = root.querySelector('[data-td-line]');
  const close = root.querySelector('[data-td-close]');
  const map = root.querySelector('[data-td-map]');
  const view = root.querySelector('[data-td-view]');
  const stops = [...root.querySelectorAll('.td__stop')];
  const links = [...root.querySelectorAll('[data-goto]')];
  const narrow = matchMedia('(max-width: 899px)');

  // Close-ups: one per stop, taken from each stop's own figure so the src
  // lives in one place (the HTML).
  const closeups = stops.map((li, i) => {
    if (i === 0) return null;
    const src = li.querySelector('.td__fig img');
    const img = document.createElement('img');
    img.src = src.currentSrc || src.src;
    img.alt = '';
    img.decoding = 'async';
    close.appendChild(img);
    return img;
  });

  td.classList.add('is-scrub');
  // The part list joins the map under the stage, so both stay in view for
  // the whole sequence. Without JS it is not shown: the column of stills
  // already lists every part in order.
  const nav = root.querySelector('[data-td-parts]');
  const hud = root.querySelector('.td__hud');
  if (nav && hud) hud.appendChild(nav);

  // Camera pose per stop: the point of the still at the frame centre, and zoom.
  const poses = () => {
    const pts = narrow.matches ? TALL : WIDE;
    const Z = narrow.matches ? 2.6 : 3.4;
    return stops.map((li) => {
      const key = li.dataset.part;
      if (pts[key]) return { x: pts[key][0], y: pts[key][1], z: Z };
      return { x: 0.5, y: 0.5, z: 1 };   // the whole line, and the lens back together
    });
  };
  let P = poses();
  narrow.addEventListener?.('change', () => { P = poses(); dirty = true; });

  // Where the still's content sits inside the frame (object-fit: contain).
  function contentBox() {
    const W = frame.clientWidth, H = frame.clientHeight;
    const A = narrow.matches ? 900 / 1600 : 1600 / 1000;
    const cw = Math.min(W, H * A), ch = cw / A;
    return { W, H, cw, ch, ox: (W - cw) / 2, oy: (H - ch) / 2 };
  }

  // Continuous stop position from the stop captions: s = k when caption k is
  // centred on the reading line (mid-frame on desktop, under the stage on phones).
  function stopPosition() {
    const readLine = narrow.matches ? window.innerHeight * 0.74 : window.innerHeight * 0.5;
    const centres = stops.map((li) => { const r = li.getBoundingClientRect(); return r.top + r.height / 2; });
    if (readLine <= centres[0]) return 0;
    for (let k = 0; k < centres.length - 1; k++) {
      if (readLine <= centres[k + 1]) return k + (readLine - centres[k]) / (centres[k + 1] - centres[k]);
    }
    return centres.length - 1;
  }

  let dirty = true, running = false, lastS = -1, active = -1;

  function frameTick() {
    if (!running) return;
    const s = clamp(stopPosition(), 0, stops.length - 1);
    if (dirty || Math.abs(s - lastS) > 0.0005) {
      dirty = false;
      lastS = s;
      apply(s);
    }
    requestAnimationFrame(frameTick);
  }

  function apply(s) {
    const k = Math.min(stops.length - 2, Math.floor(s));
    const f = s - k;
    // Hold at each stop for the first and last 20% of the travel between
    // stops, and move in between: "each screen of scroll stops the camera".
    const e = smooth(clamp((f - 0.2) / 0.6));
    const a = P[k], b = P[k + 1];
    // Interpolate zoom in log space so the move reads as a constant-rate
    // dolly rather than slowing as it closes in.
    const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e);
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e;

    const { W, H, cw, ch, ox, oy } = contentBox();
    const px = ox + x * cw, py = oy + y * ch;
    line.style.transform = `translate3d(${(W / 2 - px * z).toFixed(2)}px, ${(H / 2 - py * z).toFixed(2)}px, 0) scale(${z.toFixed(4)})`;

    // Near a stop (within 0.18 of it), that stop's close-up is shown and the
    // line behind it is dimmed and drawn back.
    const near = Math.round(s);
    const closeness = 1 - smooth(clamp((Math.abs(s - near) - 0.1) / 0.18));
    const hasClose = near > 0;
    line.style.opacity = hasClose ? String(1 - 0.78 * closeness) : '1';
    closeups.forEach((img, i) => img?.classList.toggle('is-on', hasClose && i === near && closeness > 0.5));

    // Map: the frame's visible region, in still coordinates.
    const hw = W / (2 * z * cw), hh = H / (2 * z * ch);
    const mw = map.clientWidth, mh = map.clientHeight;
    const l = clamp(x - hw), t = clamp(y - hh), r = clamp(x + hw), bt = clamp(y + hh);
    view.style.width = `${((r - l) * mw).toFixed(1)}px`;
    view.style.height = `${((bt - t) * mh).toFixed(1)}px`;
    view.style.transform = `translate(${(l * mw).toFixed(1)}px, ${(t * mh).toFixed(1)}px)`;

    if (near !== active) {
      active = near;
      stops.forEach((li, i) => li.classList.toggle('is-active', i === near));
      links.forEach((a) => {
        if (Number(a.dataset.goto) === near) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      });
    }
  }

  // The part list scrolls to that part's caption. It moves the page; it never
  // drives the camera directly, so scroll stays the single source of truth.
  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const li = stops[Number(a.dataset.goto)];
    const r = li.getBoundingClientRect();
    const readLine = narrow.matches ? window.innerHeight * 0.74 : window.innerHeight * 0.5;
    window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - readLine, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }));

  new ResizeObserver(() => { dirty = true; }).observe(frame);
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !running) { running = true; dirty = true; requestAnimationFrame(frameTick); }
    else if (!en.isIntersecting) running = false;
  }).observe(td);
}
