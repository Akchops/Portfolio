// Focus — a standalone control experiment (Kessel Optics, sample figures).
//
// Turn the distance scale and three subjects at different distances come
// sharp in turn: a ball at 1.2 m, a goal at 5 m, a floodlight at infinity.
// Blur follows real defocus: the blur circle is proportional to the
// difference in dioptres (1 / distance) between a subject and the focus
// distance, for a 50 mm lens at T2.1.

// Slider 0..100 to focus distance. Dioptres fall with the square of the
// travel, which spreads the near distances across the scale the way an
// engraved focus ring does: 0.45 m at 0, 1 m at 33, 2 m at 53, 5 m at 70,
// infinity at 100.
const D_MAX = 1 / 0.45;   // close focus 0.45 m (Parvati, sample figure)
const dioptresAt = (v) => D_MAX * Math.pow(1 - v / 100, 2);
const valueFor = (dist) => (dist === Infinity ? 100 : 100 * (1 - Math.sqrt((1 / dist) / D_MAX)));

const SUBJECTS = [
  { key: 'light', dist: Infinity, draw: drawLight },
  { key: 'goal', dist: 5, draw: drawGoal },
  { key: 'ball', dist: 1.2, draw: drawBall },
];

export function mount(root) {
  const range = root.querySelector('[data-fo-range]');
  const out = root.querySelector('[data-fo-out]');
  const scene = root.querySelector('[data-fo-scene]');
  const picks = [...root.querySelectorAll('[data-fo-pick]')];

  // Place the scale's ticks where their distances really fall.
  const ticks = root.querySelector('.ctl__ticks--fo');
  if (ticks) {
    ticks.style.position = 'relative';
    ticks.style.height = '1em';
    [0.45, 1, 2, 5, Infinity].forEach((d, i) => {
      const el = ticks.children[i];
      if (!el) return;
      el.style.position = 'absolute';
      el.style.left = `${valueFor(d)}%`;
      el.style.transform = i === 0 ? 'none' : i === 4 ? 'translateX(-100%)' : 'translateX(-50%)';
    });
  }

  // One canvas per depth layer, drawn once; focus only changes their blur.
  const layers = SUBJECTS.map((s) => {
    const c = document.createElement('canvas');
    c.className = 'fo__layer';
    scene.appendChild(c);
    return { ...s, canvas: c };
  });

  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(scene.clientWidth * dpr), H = Math.round(scene.clientHeight * dpr);
    layers.forEach((l, i) => {
      l.canvas.width = W; l.canvas.height = H;
      const g = l.canvas.getContext('2d');
      if (i === 0) { g.fillStyle = '#0B0C0E'; g.fillRect(0, 0, W, H); }
      l.draw(g, W, H);
    });
    update();
  }

  function update() {
    const v = Number(range.value);
    const D = dioptresAt(v);
    const dist = D < 1e-6 ? Infinity : 1 / D;
    const label = dist === Infinity ? '∞' : `${dist.toFixed(dist < 1 ? 2 : 1)} m`;
    out.textContent = label;
    range.setAttribute('aria-valuetext', dist === Infinity ? 'infinity' : `${dist.toFixed(dist < 1 ? 2 : 1)} metres`);

    // Blur circle on a 36 mm frame for 50 mm at T2.1: (f^2 / N) x dD = 1.19 mm
    // per dioptre, about 3.3% of the frame width. Halved for a blur radius.
    const perDioptre = scene.clientWidth * 0.033 * 0.5;
    layers.forEach((l) => {
      const dS = l.dist === Infinity ? 0 : 1 / l.dist;
      const blur = Math.abs(dS - D) * perDioptre;
      l.canvas.style.filter = blur < 0.3 ? 'none' : `blur(${blur.toFixed(1)}px)`;
    });
    picks.forEach((b) => {
      const d = b.dataset.foPick === 'Infinity' ? Infinity : Number(b.dataset.foPick);
      b.setAttribute('aria-pressed', String(Math.abs(valueFor(d) - v) < 1.5));
    });
  }

  range.addEventListener('input', update);
  picks.forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.foPick === 'Infinity' ? Infinity : Number(b.dataset.foPick);
    range.value = String(Math.round(valueFor(d)));
    update();
  }));
  new ResizeObserver(paint).observe(scene);
  range.value = String(Math.round(valueFor(5)));
  paint();
}

/* Subjects, drawn in the site palette. ----------------------------------- */
function drawLight(g, W, H) {
  // A floodlight mast on the horizon with its lamp bank.
  g.fillStyle = '#17191D';
  g.fillRect(0, H * 0.62, W, H * 0.38);
  g.fillStyle = '#2A2D33';
  g.fillRect(W * 0.78, H * 0.16, W * 0.012, H * 0.48);
  g.fillStyle = '#EDE8DF';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    g.fillRect(W * (0.745 + c * 0.017), H * (0.1 + r * 0.035), W * 0.013, H * 0.026);
  }
}

function drawGoal(g, W, H) {
  const x = W * 0.3, w = W * 0.4, h = H * 0.24, y = H * 0.64 - h, p = Math.max(2, W * 0.007);
  g.fillStyle = '#EDE8DF';
  g.fillRect(x, y, p, h);
  g.fillRect(x + w - p, y, p, h);
  g.fillRect(x, y, w, p);
  g.fillStyle = '#7A7F88';
  g.fillRect(W * 0.08, H * 0.64, W * 0.84, Math.max(1, H * 0.006));   // goal line
}

function drawBall(g, W, H) {
  const cx = W * 0.2, cy = H * 0.84, r = H * 0.11;
  g.fillStyle = '#EDE8DF';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // Panels: a pentagon and its neighbours' edges.
  g.fillStyle = '#17191D';
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const px = cx + Math.cos(a) * r * 0.32, py = cy + Math.sin(a) * r * 0.32;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
  g.strokeStyle = '#17191D';
  g.lineWidth = Math.max(1, r * 0.06);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32);
    g.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98);
    g.stroke();
  }
}
