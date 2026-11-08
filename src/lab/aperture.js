// Aperture — a standalone control experiment (Kessel Optics, sample figures).
//
// A native range input steps the iris through the T-stops. The face-on iris
// closes blade by blade; in the scene beside it the out-of-focus lights shrink
// and turn from round discs into eleven-sided ones, because a bokeh disc takes
// the shape of the opening. Every value is a function of the control; nothing
// moves on its own.

const STOPS = [2.1, 2.8, 4, 5.6, 8, 11, 16];
const BLADES = 11;
const WELL = 84;          // radius of the dark iris well in the SVG, viewBox units

export function mount(root) {
  const range = root.querySelector('[data-ap-range]');
  const out = root.querySelector('[data-ap-out]');
  const open = root.querySelector('[data-ap-open]');
  const blades = root.querySelector('[data-ap-blades]');
  const sceneEl = root.querySelector('[data-ap-scene]');
  const NS = 'http://www.w3.org/2000/svg';

  const lines = Array.from({ length: BLADES }, () => {
    const p = document.createElementNS(NS, 'path');
    blades.appendChild(p);
    return p;
  });

  const canvas = document.createElement('canvas');
  sceneEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Out-of-focus lights: fixed positions (fractions of the scene) so the
  // composition is the same on every visit.
  const LIGHTS = [
    [0.08, 0.22], [0.2, 0.3], [0.31, 0.18], [0.44, 0.27], [0.57, 0.16], [0.7, 0.26], [0.83, 0.2], [0.94, 0.3],
    [0.14, 0.46], [0.36, 0.42], [0.63, 0.44], [0.88, 0.48],
  ];

  // Opening radius: aperture diameter is focal length / N, so the opening
  // scales as 1/N. At T2.1 it nearly fills the well.
  const radiusAt = (t) => 80 * (2.1 / t);
  // The blades rotate as they close, as a real iris ring does.
  const rotationAt = (t) => (1 - 2.1 / t) * 0.65;

  function polygon(r, rot) {
    return Array.from({ length: BLADES }, (_, i) => {
      const a = rot + (i / BLADES) * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  }

  function drawIris(t) {
    const r = radiusAt(t), rot = rotationAt(t);
    const v = polygon(r, rot);
    open.setAttribute('d', 'M' + v.map((p) => p.map((n) => n.toFixed(2)).join(' ')).join('L') + 'Z');
    // Each blade edge: from one vertex along the edge to the next, carried on
    // until it meets the well. That family of lines is what reads as blades.
    v.forEach((p, i) => {
      const q = v[(i + 1) % BLADES];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // Solve |p + s u| = WELL for s > 0.
      const b = p[0] * ux + p[1] * uy;
      const c = p[0] * p[0] + p[1] * p[1] - WELL * WELL;
      const s = -b + Math.sqrt(Math.max(0, b * b - c));
      lines[i].setAttribute('d', `M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${(p[0] + ux * s).toFixed(2)} ${(p[1] + uy * s).toFixed(2)}`);
    });
  }

  function drawScene(t) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(sceneEl.clientWidth * dpr), H = Math.round(sceneEl.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.fillStyle = '#0B0C0E';
    ctx.fillRect(0, 0, W, H);

    // Disc size follows 1/N, like the opening. Brightness per disc rises as it
    // shrinks so the same light is spread over less area.
    const k = 2.1 / t;
    const base = Math.min(W, H) * 0.11;
    const R = Math.max(1.5 * dpr, base * k);
    // Roundness: wide open the blades curve into a circle; from about T4 the
    // eleven straight edges show in every disc.
    const poly = clamp01((t - 2.6) / 2.6);
    const rot = rotationAt(t);
    ctx.globalCompositeOperation = 'lighter';
    for (const [fx, fy] of LIGHTS) {
      const cx = fx * W, cy = fy * H;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        // Distance to the edge of a regular 11-gon at angle a, relative to its
        // circumradius; blended with 1 (a circle) by `poly`.
        const seg = (Math.PI * 2) / BLADES;
        const local = ((a - rot) % seg + seg) % seg - seg / 2;
        const ngon = Math.cos(Math.PI / BLADES) / Math.cos(local);
        const rr = R * (1 + (ngon - 1) * poly);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(237,232,223,${Math.min(0.85, 0.22 / (k * k) * 0.35 + 0.18).toFixed(3)})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // The subject, in focus at every stop: a goal frame drawn sharp in bone
    // in front of the lights, on a strip of pitch.
    ctx.fillStyle = '#17191D';
    ctx.fillRect(0, H * 0.74, W, H * 0.26);
    ctx.fillStyle = '#EDE8DF';
    const gx = W * 0.2, gw = W * 0.6, gh = H * 0.3, gy = H * 0.74 - gh, post = Math.max(2, W * 0.009);
    ctx.fillRect(gx, gy, post, gh);
    ctx.fillRect(gx + gw - post, gy, post, gh);
    ctx.fillRect(gx, gy, gw, post);
    ctx.fillStyle = '#7A7F88';
    ctx.fillRect(0, H * 0.74, W, Math.max(1, dpr));
  }

  function update() {
    const t = STOPS[Number(range.value)];
    const label = `T${t}`;
    out.textContent = label;
    range.setAttribute('aria-valuetext', label);
    drawIris(t);
    drawScene(t);
  }

  range.addEventListener('input', update);
  new ResizeObserver(update).observe(sceneEl);
  update();
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
