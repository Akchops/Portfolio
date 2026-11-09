// Pointer Pitch — signature moment 3.
//
// An Ember-tinted lens follows the pointer (or the finger) across a Matchday
// screenshot: it magnifies under the pointer, smears along the direction of
// travel, splits colour at its edge when moving fast, and remaps what it
// covers to an Ember duotone.
//
// Three tiers (webgl-shader-interaction-engineer Gate 2):
//   1. WebGL: raw WebGL, one triangle and a fragment shader (~2 kB, no Three.js)
//   2. Canvas 2D: the same lens, same damping and the same Ember remap,
//      without the per-pixel displacement or the colour split
//   3. the <img> already in the DOM (no JS, reduced motion, both tiers failed)
// Reduced motion resolves to tier 3 on purpose: a pointer-driven full-surface
// distortion is exactly the movement that setting asks to remove, and the
// still loses no information.

import { reduceMotion } from '../util.js';
import { probeWebGL, qa } from '../probe.js';

// Damping shared by both tiers so they feel identical in the hand.
const FOLLOW = 0.14;     // ~200 ms settle at 60 fps
const RADIUS = 0.17;     // lens radius, in units of the stage height

export async function mount(stage) {
  if (reduceMotion() || qa.static) return;
  const img = stage.querySelector('.pp__still');
  try { await img.decode(); } catch { return; }   // no image, nothing to distort

  // Check the WebGL tier before mounting, as the hero does: a software
  // rasteriser reports as tier 'low', and Canvas 2D is faster than emulated
  // WebGL, so it takes over (Gate 1).
  const caps = qa.tier2 ? null : probeWebGL({ allowSoftware: qa.glForce });
  const webgl = !!caps && caps.tier !== 'low';
  // The texture goes up as an ImageBitmap: decoded off the main thread and
  // uploaded without the GPU read-back that an <img> upload can force. Its
  // rows arrive top-first (UNPACK_FLIP_Y_WEBGL does not apply to bitmaps), so
  // the shader flips V when it samples; the <img> fallback is uploaded the
  // same way, unflipped, so both paths match.
  let source = img;
  if (webgl && 'createImageBitmap' in window) {
    try { source = await createImageBitmap(img); } catch { source = img; }
  }
  const tier = (webgl && mountGL(stage, source, img)) || mountCanvas(stage, img);
  if (tier) stage.dataset.tier = tier;
}

/* -------------------------------------------------------------------------- */
/* Pointer state, shared                                                        */
/* -------------------------------------------------------------------------- */
function pointer(stage, invalidate) {
  const m = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, speed: 0, tSpeed: 0, dx: 0, dy: 0, active: 0, tActive: 0 };
  const at = (e) => {
    const r = stage.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const move = (e) => {
    const [nx, ny] = at(e);
    const vx = nx - m.tx, vy = ny - m.ty;
    const len = Math.hypot(vx, vy);
    // Speed in stage units per event, normalised: 0.05 is a brisk flick.
    m.tSpeed = Math.min(1, len / 0.05);
    if (len > 0.0005) { m.dx = vx / len; m.dy = vy / len; }
    m.tx = nx; m.ty = ny;
    m.tActive = 1;
    invalidate();
  };
  stage.addEventListener('pointerenter', (e) => {
    // Arrive where the pointer is, not from the centre.
    const [nx, ny] = at(e);
    if (m.active < 0.01) { m.x = m.tx = nx; m.y = m.ty = ny; }
    m.tActive = 1; invalidate();
  });
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerdown', (e) => {
    // Touch: the finger lands, the lens jumps to it.
    const [nx, ny] = at(e);
    if (e.pointerType !== 'mouse') { m.x = m.tx = nx; m.y = m.ty = ny; }
    m.tActive = 1; invalidate();
  });
  const leave = () => { m.tActive = 0; m.tSpeed = 0; invalidate(); };
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointercancel', leave);
  stage.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') leave(); });

  // Advance the damped values one frame. Returns true while still settling.
  m.step = () => {
    m.x += (m.tx - m.x) * FOLLOW;
    m.y += (m.ty - m.y) * FOLLOW;
    // Speed rises fast and falls slower, then decays without new events, so
    // the smear snaps back when the pointer stops rather than drifting.
    m.speed += (m.tSpeed - m.speed) * (m.tSpeed > m.speed ? 0.3 : 0.1);
    m.tSpeed *= 0.86;
    m.active += (m.tActive - m.active) * 0.12;
    return Math.abs(m.tx - m.x) + Math.abs(m.ty - m.y) > 0.0005 || m.speed > 0.002 ||
      Math.abs(m.tActive - m.active) > 0.002;
  };
  return m;
}

/** Render on demand: a frame loop that runs only while something is settling. */
function loop(drawFrame) {
  let raf = 0;
  const tick = () => { raf = 0; if (drawFrame()) raf = requestAnimationFrame(tick); };
  return () => { if (!raf) raf = requestAnimationFrame(tick); };
}

/* -------------------------------------------------------------------------- */
/* Tier 1 — raw WebGL                                                           */
/* -------------------------------------------------------------------------- */
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  // One triangle spanning -1..3 overshoots the viewport on two sides, so its
  // UVs are exactly 0..1 across the visible area, with no diagonal seam.
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_ES
precision highp float;   // mediump bands visibly across the lens falloff on phones
#endif
varying vec2 vUv;

uniform sampler2D uTex;  // the screenshot, uploaded with Y flipped
uniform vec2  uMouse;    // pointer in UV space (0..1, y up), damped in JS
uniform float uAspect;   // canvas width / height
uniform float uRadius;   // lens radius in units of the canvas height
uniform float uSpeed;    // 0..1 damped pointer speed
uniform vec2  uDir;      // damped unit direction of travel, UV space, y up
uniform float uActive;   // 0..1, eases in when the pointer arrives, out when it leaves
uniform vec3  uEmber;    // #FF4D1C as 0..1 rgb

// The texture is stored top row first (uploaded unflipped, see mount()), while
// vUv runs bottom to top. Flipping V here is what keeps the screenshot upright,
// whichever source the upload used.
vec4 tex(vec2 uv) { return texture2D(uTex, vec2(uv.x, 1.0 - uv.y)); }

void main() {
  // Offset from the pointer in aspect-corrected units (x scaled by the aspect)
  // so the lens is a circle, not an ellipse stretched by the canvas shape.
  vec2 p = (vUv - uMouse) * vec2(uAspect, 1.0);
  float d = length(p);

  // Compact smooth falloff: 1 at the pointer, 0 at uRadius, with value, slope
  // and curvature all reaching zero at the boundary. No plateau and no visible
  // ring where the lens ends (known-traps #2). Scaled by uActive so the lens
  // grows in and shrinks out instead of popping.
  float x = clamp(1.0 - (d * d) / (uRadius * uRadius), 0.0, 1.0);
  float fall = x * x * x * uActive;

  // Magnify: sample closer to the pointer than this pixel really is. 0.3 at
  // the centre is a 1.43x lens; it tapers to 1x at the rim with the falloff.
  vec2 lens = p * fall * 0.3;

  // Smear: pull samples back along the direction of travel, so the content
  // trails behind a moving pointer. Zero when the pointer is still.
  vec2 smear = uDir * vec2(uAspect, 1.0) * fall * uSpeed * 0.07;

  // Back to plain UV space (undo the aspect correction on x).
  vec2 uv = vUv - (lens + smear) / vec2(uAspect, 1.0);

  // Chromatic split along the radial direction, only where the surface is
  // moving: a small fixed amount while the lens is active plus a speed term.
  // Above ~0.008 UV it stops reading as speed and reads as a broken display.
  vec2 dir = d > 0.0001 ? (p / d) / vec2(uAspect, 1.0) : vec2(0.0);   // guarded: no NaN at the centre
  float ca = fall * (0.0015 + uSpeed * 0.006);
  vec3 col = vec3(
    tex(uv + dir * ca).r,
    tex(uv).g,
    tex(uv - dir * ca).b
  );

  // Ember duotone inside the lens: luminance (Rec. 709 weights) remapped from
  // a dark ember to full ember, so light UI strokes turn Ember and dark
  // surfaces turn a deep ember-black. A remap, not an added glow.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 duo = uEmber * (0.18 + 0.95 * lum);
  // Tint follows the falloff, a little stronger while moving.
  float tint = fall * (0.55 + 0.35 * uSpeed);
  gl_FragColor = vec4(mix(col, duo, clamp(tint, 0.0, 1.0)), 1.0);
}`;

function mountGL(stage, source, img) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pp__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false }); }
  catch { return null; }
  if (!gl) return null;

  const program = link(gl, VERT, FRAG);
  if (!program) return null;
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // CLAMP_TO_EDGE + LINEAR, no mipmaps: the only legal combination for a
  // non-power-of-two image in WebGL1. Anything else renders black, silently.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // Unflipped on purpose: an ImageBitmap ignores this flag, so the <img>
  // fallback must match it. The shader's tex() does the flip.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); }
  catch { return null; }

  const loc = {};
  for (const n of ['uTex', 'uMouse', 'uAspect', 'uRadius', 'uSpeed', 'uDir', 'uActive', 'uEmber']) {
    loc[n] = gl.getUniformLocation(program, n);   // looked up once, not per frame
  }
  gl.uniform1i(loc.uTex, 0);
  gl.uniform1f(loc.uRadius, RADIUS);
  gl.uniform3f(loc.uEmber, 1.0, 0x4d / 255, 0x1c / 255);

  let alive = true;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };

  const m = pointer(stage, () => invalidate());
  const draw = () => {
    if (!alive) return false;
    const settling = m.step();
    resize();
    gl.uniform2f(loc.uMouse, m.x, 1 - m.y);          // page y is down, UV y is up
    gl.uniform1f(loc.uAspect, canvas.width / canvas.height);
    gl.uniform1f(loc.uSpeed, m.speed);
    gl.uniform2f(loc.uDir, m.dx, -m.dy);
    gl.uniform1f(loc.uActive, m.active);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return settling;
  };
  const invalidate = loop(draw);

  // Context loss: drop to tier 2 at once rather than leave a black box.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    alive = false;
    canvas.remove();
    mountCanvas(stage, img);
    stage.dataset.tier = 'canvas2d';
  }, false);

  new ResizeObserver(() => invalidate()).observe(stage);
  draw();
  stage.appendChild(canvas);
  return 'webgl';
}

function link(gl, vs, fs) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      // Development only. In production a compile failure drops silently to
      // tier 2, keeping the console clean (Gate 1).
      if (import.meta.env.DEV) console.warn(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  gl.deleteShader(v); gl.deleteShader(f);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/* -------------------------------------------------------------------------- */
/* Tier 2 — Canvas 2D: same lens, same damping, same Ember remap                */
/* -------------------------------------------------------------------------- */
function mountCanvas(stage, img) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pp__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };

  const m = pointer(stage, () => invalidate());
  const draw = () => {
    const settling = m.step();
    resize();
    const W = canvas.width, H = canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(img, 0, 0, W, H);
    if (m.active > 0.01) {
      const R = RADIUS * H * 0.8 * m.active;      // visible radius of the lens
      const cx = m.x * W, cy = m.y * H;
      const zoom = 1.3;                           // matches the shader's centre magnification
      // Smear: the magnified content trails behind the pointer's travel.
      const sx = -m.dx * m.speed * R * 0.35, sy = -m.dy * m.speed * R * 0.35;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(cx + sx, cy + sy);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -cx, -cy, W, H);
      ctx.restore();
      // Ember remap: 'color' keeps the lens's luminance and takes Ember's hue
      // and saturation, the 2D equivalent of the shader's duotone.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#FF4D1C';
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }
    return settling;
  };
  const invalidate = loop(draw);
  new ResizeObserver(() => invalidate()).observe(stage);
  draw();
  stage.appendChild(canvas);
  return 'canvas2d';
}
