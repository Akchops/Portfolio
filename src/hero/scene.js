// Floodlights — the night pitch.
//
// One scene, used three ways:
//   1. live on desktop (hero/live.js),
//   2. by scripts/render-sequence.mjs to capture the phone frame sequence,
//   3. by the same script to capture the static frame every fallback shows.
// So all three tiers show exactly the same pitch.
//
// Sourced assets (see CREDITS.md): the ball and the turf texture, both CC0 from
// Poly Haven, compressed to meshopt glTF and KTX2 by scripts/build-assets.mjs.
// Everything else is layout geometry generated here (a plane, boxes and
// cylinders placed to stadium dimensions); nothing is modelled or downloaded.
// The four floodlights are the only light sources in the scene.

import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, Mesh, Group, Object3D, Vector3,
  PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, InstancedMesh,
  SpotLight, CanvasTexture, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping,
  NormalBlending, AdditiveBlending, DoubleSide, CatmullRomCurve3, MathUtils,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Pitch to FIFA dimensions, metres. x runs goal to goal, z touchline to
// touchline, y is up; the centre spot is the origin.
const L = 105, W = 68, MARGIN = 4;
const TOWERS = [[-56, -60], [56, -60], [-56, 60], [56, 60]];
const MAST_H = 44;
const LAMP_COLOR = new Color('#FFF6EC');   // warm white, the scene's only light

// Camera path: from high in the main stand (z > 0) down onto the pitch and to
// the edge of the centre circle (radius 9.15 m). Two curves — where the camera
// is and what it looks at — so the move reads as directed, not as a rail.
const PATH = [
  [-13, 9.0, 52.5], [-10, 6.8, 39], [-6, 2.6, 28], [-1.8, 1.3, 9.5], [-1.45, 0.58, 2.2],
];
const AIM = [
  [6, -1.5, -10], [4, 0.2, -22], [1.5, 0.6, -10], [0.8, 1.2, -14], [4.0, 1.7, -40],
];
// Portrait frames are narrow, so the ending swings further towards the ball
// to keep it in shot, and pitches down so it sits clear of the copy.
const AIM_PORTRAIT = [
  [6, -1.5, -10], [4, 0.2, -22], [2.5, 0.4, -10], [6, 0.2, -14], [22.3, -4.3, -40],
];

export async function createScene(canvas, { base = './', dpr = 1.5, quality = 'high', onProgress } = {}) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality === 'high',
    powerPreference: 'high-performance',
    alpha: false,
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // No shadow maps: at stadium scale a 1024 map gives the 22 cm ball about
  // two texels of shadow. The ball gets four authored contact shadows instead
  // (see ballShadows below), which is the floodlit look and costs one quad each.
  renderer.shadowMap.enabled = false;

  const scene = new Scene();
  scene.background = new Color('#0B0C0E');
  // Exponential fog in the background colour: the far stand and the sky fall
  // off into the same ink rather than ending at a hard horizon.
  scene.fog = new FogExp2('#0B0C0E', 0.0052);

  const camera = new PerspectiveCamera(52, 16 / 9, 0.1, 400);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---------------- Ground and pitch ---------------- */
  const ground = new Mesh(
    new PlaneGeometry(260, 220),
    new MeshStandardMaterial({ color: '#141518', roughness: 0.96, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const turfMat = new MeshStandardMaterial({ color: '#5E6158', roughness: 0.92, metalness: 0 });
  const turf = new Mesh(new PlaneGeometry(L + MARGIN * 2, W + MARGIN * 2), turfMat);
  turf.rotation.x = -Math.PI / 2;
  scene.add(turf);

  // Mowing stripes and line markings on one transparent overlay, lit by the
  // same lights as the turf below it.
  const markings = new CanvasTexture(drawMarkings());
  markings.colorSpace = SRGBColorSpace;
  markings.anisotropy = maxAniso;   // the lines are seen at grazing angles
  const overlay = new Mesh(
    new PlaneGeometry(L + MARGIN * 2, W + MARGIN * 2),
    new MeshStandardMaterial({
      map: markings, transparent: true, roughness: 0.9, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false,
    }),
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.005;
  overlay.renderOrder = 1;   // markings first, then the ball's contact shadows over them
  scene.add(overlay);

  /* ---------------- Stands ---------------- */
  const standMat = new MeshStandardMaterial({ color: '#1C1E22', roughness: 0.9 });
  const seatMat = new MeshStandardMaterial({ color: '#4A4E56', roughness: 0.7 });
  // [centre x, centre z, length, facing (+1 = rows climb towards +z)]
  const stands = [
    [0, W / 2 + 7, 116, 1], [0, -(W / 2 + 7), 116, -1],
  ];
  const ends = [
    [L / 2 + 8, 0, 74, 1], [-(L / 2 + 8), 0, 74, -1],
  ];
  const ROWS = 16, ROW_D = 0.85, ROW_H = 0.5;
  const step = new BoxGeometry(1, 1, 1);
  const seat = new BoxGeometry(0.46, 0.42, 0.08);
  const standSteps = new InstancedMesh(step, standMat, (stands.length + ends.length) * ROWS);
  const seatCount = stands.length * ROWS * Math.floor(116 / 0.55) + ends.length * ROWS * Math.floor(74 / 0.55);
  const seats = new InstancedMesh(seat, seatMat, seatCount);
  const o = new Object3D();
  let si = 0, ki = 0;
  const addStand = (cx, cz, len, dir, alongX) => {
    for (let r = 0; r < ROWS; r++) {
      const depth = 1.4 + r * ROW_D;
      const h = 1.1 + r * ROW_H;
      // Each row is a step: a box from the ground to its tread height.
      if (alongX) { o.position.set(cx, h / 2, cz + dir * depth); o.scale.set(len, h, ROW_D); }
      else { o.position.set(cx + dir * depth, h / 2, cz); o.scale.set(ROW_D, h, len); }
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      standSteps.setMatrixAt(si++, o.matrix);
      const n = Math.floor(len / 0.55);
      for (let s = 0; s < n; s++) {
        const t = -len / 2 + 0.275 + s * 0.55;
        o.scale.set(1, 1, 1);
        if (alongX) { o.position.set(cx + t, h + 0.21, cz + dir * (depth + ROW_D * 0.3)); o.rotation.set(0, 0, 0); }
        else { o.position.set(cx + dir * (depth + ROW_D * 0.3), h + 0.21, cz + t); o.rotation.set(0, Math.PI / 2, 0); }
        o.updateMatrix();
        seats.setMatrixAt(ki++, o.matrix);
      }
    }
  };
  stands.forEach(([x, z, len, dir]) => addStand(x, z, len, dir, true));
  ends.forEach(([x, z, len, dir]) => addStand(x, z, len, dir, false));
  standSteps.count = si; seats.count = ki;
  scene.add(standSteps, seats);

  // Advertising-board line round the pitch: a dark band the light catches on top.
  const boardMat = new MeshStandardMaterial({ color: '#202327', roughness: 0.6 });
  const boards = new Group();
  [[0, W / 2 + 2.2, L + 10, 0], [0, -(W / 2 + 2.2), L + 10, 0], [L / 2 + 3.4, 0, W + 2, 1], [-(L / 2 + 3.4), 0, W + 2, 1]]
    .forEach(([x, z, len, rot]) => {
      const b = new Mesh(new BoxGeometry(len, 0.9, 0.12), boardMat);
      b.position.set(x, 0.45, z);
      b.rotation.y = rot ? Math.PI / 2 : 0;
      boards.add(b);
    });
  scene.add(boards);

  /* ---------------- Goals ---------------- */
  const postMat = new MeshStandardMaterial({ color: '#E9E6E0', roughness: 0.4, metalness: 0.1 });
  const post = new CylinderGeometry(0.06, 0.06, 2.44, 12);
  const bar = new CylinderGeometry(0.06, 0.06, 7.32 + 0.12, 12);
  for (const side of [-1, 1]) {
    const g = new Group();
    for (const z of [-3.66, 3.66]) {
      const p = new Mesh(post, postMat);
      p.position.set(0, 1.22, z);
      g.add(p);
    }
    const cb = new Mesh(bar, postMat);
    cb.rotation.x = Math.PI / 2;
    cb.position.set(0, 2.44, 0);
    g.add(cb);
    g.position.x = side * (L / 2);
    scene.add(g);
  }

  /* ---------------- Floodlights ---------------- */
  const mastMat = new MeshStandardMaterial({ color: '#2B2E33', roughness: 0.7, metalness: 0.4 });
  const headMat = new MeshStandardMaterial({ color: '#202226', roughness: 0.6, metalness: 0.3 });
  // Lamp faces are unlit and outside tone mapping: they are the source, so
  // they render at full brightness whatever the exposure.
  const lampMat = new MeshBasicMaterial({ color: LAMP_COLOR, toneMapped: false });
  const lampGeo = new BoxGeometry(1.25, 1.0, 0.2);
  const LAMP_COLS = 6, LAMP_ROWS = 3;
  const lamps = new InstancedMesh(lampGeo, lampMat, TOWERS.length * LAMP_COLS * LAMP_ROWS);
  let li = 0;

  const glares = [];
  const spots = [];
  const beams = [];
  const glareGeo = new PlaneGeometry(1, 1);
  const beamGeo = new ConeGeometry(1, 1, 48, 1, true);
  beamGeo.translate(0, -0.5, 0);    // apex at the origin, opening downwards along -y

  for (const [tx, tz] of TOWERS) {
    const mast = new Mesh(new CylinderGeometry(0.45, 0.9, MAST_H, 16), mastMat);
    mast.position.set(tx, MAST_H / 2, tz);
    scene.add(mast);

    // The head faces a point just past the centre spot, tilted down.
    const head = new Group();
    head.position.set(tx, MAST_H + 2, tz);
    const aim = new Vector3(-tx * 0.12, 0, -tz * 0.12);
    head.lookAt(aim);
    scene.add(head);
    const frame = new Mesh(new BoxGeometry(9.4, 4.2, 0.5), headMat);
    frame.position.z = -0.3;
    head.add(frame);
    head.updateMatrixWorld(true);
    for (let r = 0; r < LAMP_ROWS; r++) {
      for (let c = 0; c < LAMP_COLS; c++) {
        o.position.set(-3.75 + c * 1.5, -1.25 + r * 1.25, 0.05);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        o.matrix.premultiply(head.matrixWorld);
        lamps.setMatrixAt(li++, o.matrix);
      }
    }

    // One spot per tower. Physically based falloff (decay 2), so intensity is
    // in candela-like units: E = I / d^2 at ~90 m wants I in the tens of
    // thousands for a lit pitch at exposure 1.
    const spot = new SpotLight(LAMP_COLOR, 24000, 240, 0.74, 0.9, 2);
    spot.position.copy(head.position);
    spot.target.position.copy(new Vector3(-tx * 0.18, 0, -tz * 0.18));
    scene.add(spot, spot.target);
    spots.push(spot);

    // Stand fill: real lamp banks keep a few lamps on the stand below them.
    // Same source, aimed at the seats on this tower's side, so the stands read
    // as tiers of seats rather than a black band.
    const fill = new SpotLight(LAMP_COLOR, 5200, 120, 0.55, 1, 2);
    fill.position.copy(head.position);
    fill.target.position.set(tx * 0.35, 3, Math.sign(tz) * (W / 2 + 14));
    scene.add(fill, fill.target);

    // Light shaft: an open cone from the head towards the pitch, drawn
    // additively and faded along its length and at its silhouette.
    const dir = spot.target.position.clone().sub(spot.position);
    const len = dir.length() * 0.95;
    const beam = new Mesh(beamGeo, beamMaterial());
    beam.position.copy(spot.position);
    beam.scale.set(len * Math.tan(0.42), len, len * Math.tan(0.42));
    beam.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), dir.normalize());
    beam.renderOrder = 2;
    scene.add(beam);
    beams.push(beam);

    // Glare: a camera-facing quad at the lamp bank.
    const glare = new Mesh(glareGeo, glareMaterial());
    glare.position.copy(head.position).add(dir.clone().multiplyScalar(0.8));
    glare.userData.aim = dir.clone();   // unit vector the lamps face
    glare.renderOrder = 3;
    glare.frustumCulled = false;
    scene.add(glare);
    glares.push(glare);
  }
  lamps.count = li;
  scene.add(lamps);

  /* ---------------- Ball (Poly Haven, CC0) ---------------- */
  // No transcoder path: KTX2Loader resolves its own Basis transcoder through
  // import.meta.url, so the bundler ships one hashed copy alongside this chunk.
  const ktx2 = new KTX2Loader().detectSupport(renderer);
  const gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  let ball = null;
  const loads = [
    gltf.loadAsync(base + 'models/football.glb').then((g) => {
      ball = g.scene;
      // Sit it on the centre spot. The model's origin is at its base.
      ball.position.set(0, 0, 0);
      ball.rotation.y = 0.6;
      scene.add(ball);
      scene.add(ballShadows());
    }),
    ktx2.loadAsync(base + 'textures/turf.ktx2').then((tex) => {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      // ~4.4 m per tile: fine enough to read as turf from the stands without
      // the repeat becoming visible from the centre circle.
      tex.repeat.set((L + MARGIN * 2) / 4.4, (W + MARGIN * 2) / 4.4);
      tex.anisotropy = maxAniso;
      tex.colorSpace = SRGBColorSpace;
      turfMat.map = tex;
      turfMat.color.set('#73756E');
      turfMat.needsUpdate = true;
    }),
  ];
  let done = 0;
  loads.forEach((p) => p.then(() => onProgress?.(++done / loads.length)));
  await Promise.all(loads);
  ktx2.dispose();

  /* ---------------- Camera path ---------------- */
  const path = new CatmullRomCurve3(PATH.map((p) => new Vector3(...p)), false, 'catmullrom', 0.5);
  const aimL = new CatmullRomCurve3(AIM.map((p) => new Vector3(...p)), false, 'catmullrom', 0.5);
  const aimP = new CatmullRomCurve3(AIM_PORTRAIT.map((p) => new Vector3(...p)), false, 'catmullrom', 0.5);
  const tmp = new Vector3();
  const toCam = new Vector3();

  let width = 1, height = 1, portrait = false;

  function setSize(w, h) {
    width = w; height = h;
    portrait = h > w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }

  function setProgress(u) {
    // getPointAt is arc-length parameterised: equal steps in u travel equal
    // distance, so the camera does not race the straights and crawl the bends.
    camera.position.copy(path.getPointAt(u));
    camera.lookAt((portrait ? aimP : aimL).getPointAt(u));
    // The view widens as the camera drops to pitch level so the far towers
    // stay in frame. Portrait frames need a taller field to hold the same
    // width of pitch.
    // Wide in the stand (so the seat rows in front are in shot), tightest
    // crossing the touchline, then opening again at the centre circle.
    const fov = u < 0.4 ? MathUtils.lerp(60, 50, u / 0.4) : MathUtils.lerp(50, 54, (u - 0.4) / 0.6);
    camera.fov = portrait ? fov + 22 : fov;
    camera.updateProjectionMatrix();

    // Glare: brightest when the camera sits inside a lamp bank's beam, and it
    // burns down as the camera reaches the centre circle, which is when the
    // name has resolved.
    const burn = 1 - 0.4 * u * u * (3 - 2 * u);
    for (const g of glares) {
      g.quaternion.copy(camera.quaternion);
      const dist = tmp.copy(g.position).sub(camera.position).length();
      g.scale.setScalar(dist * 0.62);   // roughly constant size on screen
      // 1 when the camera sits on the axis the lamps face, 0 side-on or behind.
      toCam.copy(camera.position).sub(g.position).normalize();
      const align = Math.max(0, toCam.dot(g.userData.aim));
      g.material.uniforms.uIntensity.value = burn * (0.38 + 0.62 * Math.pow(align, 1.5));
    }
    for (const b of beams) b.material.uniforms.uStrength.value = 0.17 * (0.6 + 0.4 * burn);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse((m) => {
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => {
        Object.values(mat).forEach((v) => v?.isTexture && v.dispose());
        mat.dispose();
      });
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { renderer, scene, camera, setSize, setProgress, render, dispose };
}

/* ======================================================================== */

// Four soft shadows under the ball, one cast away from each tower: the
// signature of a floodlit match. Each is a quad on the turf with an elongated
// smooth falloff, darkest at the ball and fading along the throw.
function ballShadows() {
  const g = new Group();
  const geo = new PlaneGeometry(1, 1);
  for (const [tx, tz] of TOWERS) {
    const m = new Mesh(geo, new ShaderMaterial({
      uniforms: { uDark: { value: 0.55 } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform float uDark;   // peak opacity at the contact point
        void main() {
          // x runs along the throw (0 at the ball, 1 at the tip); y across it.
          vec2 p = vec2(vUv.x, (vUv.y - 0.5) * 2.0);
          // Width tapers along the throw: the shadow of a sphere from a high
          // light is an ellipse that is widest near the contact point.
          float w = mix(1.0, 0.55, p.x);
          // Compact smooth kernels in both directions (no plateau, no ring).
          float across = clamp(1.0 - (p.y * p.y) / (w * w), 0.0, 1.0);
          float along = clamp(1.0 - p.x * p.x, 0.0, 1.0);
          float a = across * across * along * along * uDark;
          gl_FragColor = vec4(0.043, 0.047, 0.055, a);   // ink, in linear-ish terms
        }`,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    // Shadow length from the light's elevation: a 0.22 m ball under a lamp
    // ~46 m up and ~80 m away throws roughly 0.4 m of shadow.
    const away = new Vector3(-tx, 0, -tz).normalize();
    const len = 0.5;
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(-away.z, away.x);
    m.scale.set(len, 0.2, 1);
    m.position.set(away.x * len * 0.5, 0.012, away.z * len * 0.5);
    m.renderOrder = 2;
    g.add(m);
  }
  return g;
}

// Line markings and mowing stripes, drawn to the Laws of the Game.
function drawMarkings() {
  const PX = 20;                                  // px per metre: 113 m -> 2260 px
  const cw = Math.round((L + MARGIN * 2) * PX);
  const ch = Math.round((W + MARGIN * 2) * PX);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.clearRect(0, 0, cw, ch);

  // Stripes: 18 bands goal to goal, every other one slightly darker. Drawn
  // as translucent ink so the turf texture shows through both.
  const bands = 18;
  for (let i = 0; i < bands; i++) {
    if (i % 2) continue;
    g.fillStyle = 'rgba(11,12,14,0.22)';
    g.fillRect((MARGIN + (L / bands) * i) * PX, MARGIN * PX, (L / bands) * PX, W * PX);
  }

  // Lines: 12 cm wide, off-white, not pure white, so they sit in the bone
  // palette under the warm lamps.
  const X = (x) => (MARGIN + L / 2 + x) * PX;    // pitch metres -> canvas px
  const Y = (z) => (MARGIN + W / 2 + z) * PX;
  g.strokeStyle = 'rgba(237,232,223,0.92)';
  g.fillStyle = 'rgba(237,232,223,0.92)';
  g.lineWidth = 0.12 * PX;
  const rect = (x0, z0, x1, z1) => g.strokeRect(X(x0), Y(z0), X(x1) - X(x0), Y(z1) - Y(z0));
  const arc = (x, z, r, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.arc(X(x), Y(z), r * PX, a0, a1); g.stroke(); };
  const dot = (x, z, r) => { g.beginPath(); g.arc(X(x), Y(z), r * PX, 0, Math.PI * 2); g.fill(); };

  rect(-L / 2, -W / 2, L / 2, W / 2);                  // touchlines and goal lines
  g.beginPath(); g.moveTo(X(0), Y(-W / 2)); g.lineTo(X(0), Y(W / 2)); g.stroke();   // halfway line
  arc(0, 0, 9.15);                                      // centre circle
  dot(0, 0, 0.22);                                      // centre spot
  for (const s of [-1, 1]) {
    const gx = s * L / 2;
    rect(Math.min(gx, gx - s * 16.5), -20.16, Math.max(gx, gx - s * 16.5), 20.16);   // penalty area
    rect(Math.min(gx, gx - s * 5.5), -9.16, Math.max(gx, gx - s * 5.5), 9.16);       // goal area
    dot(gx - s * 11, 0, 0.2);                                                        // penalty mark
    // Penalty arc: the part of a 9.15 m circle round the mark outside the box.
    const a = Math.acos(5.5 / 9.15);
    if (s > 0) arc(gx - 11, 0, 9.15, Math.PI - a, Math.PI + a);
    else arc(gx + 11, 0, 9.15, -a, a);
  }
  for (const [cx, cz, a0] of [[-L / 2, -W / 2, 0], [L / 2, -W / 2, Math.PI / 2], [L / 2, W / 2, Math.PI], [-L / 2, W / 2, -Math.PI / 2]]) {
    arc(cx, cz, 1, a0, a0 + Math.PI / 2);                // corner arcs
  }
  return c;
}

// Glare at a lamp bank. Additive, so the fragment's rgb is light added to the
// frame; nothing here darkens anything.
function glareMaterial() {
  return new ShaderMaterial({
    uniforms: { uIntensity: { value: 1 }, uColor: { value: LAMP_COLOR.clone() } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform float uIntensity;   // 0..1, set per frame from beam alignment and scroll
      uniform vec3 uColor;        // lamp colour, warm white

      void main() {
        // Quad-local position, -1..1 on both axes, centre on the lamp bank.
        vec2 p = vUv * 2.0 - 1.0;
        float d2 = dot(p, p);

        // Halo. Compact smooth kernel: x is 1 at the centre and 0 at the
        // quad edge; cubing it takes value, slope and curvature to zero at the
        // boundary, so the quad's square edge never shows and there is no
        // plateau to read as a disc (known-traps #2).
        float x = clamp(1.0 - d2, 0.0, 1.0);
        float halo = x * x * x;

        // Hot core: a tight Gaussian, infinitely smooth, where the lamps
        // themselves burn out the sensor.
        float core = exp(-d2 * 70.0);

        // Anamorphic streak: long across, very thin vertically. The horizontal
        // term uses the same compact kernel so the streak dies before the quad
        // edge; the vertical term is a narrow Gaussian.
        float sx = clamp(1.0 - p.x * p.x, 0.0, 1.0);
        float streak = sx * sx * sx * exp(-p.y * p.y * 1400.0);

        float a = (halo * 0.32 + core * 1.1 + streak * 0.5) * uIntensity;

        // Sub-step dither: +/- half an 8-bit step breaks the quantisation
        // rings a smooth additive falloff produces over a dark sky.
        a += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

        gl_FragColor = vec4(uColor * max(a, 0.0), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
}

// Light shaft through the night air under each lamp bank.
function beamMaterial() {
  return new ShaderMaterial({
    uniforms: { uStrength: { value: 0.05 }, uColor: { value: LAMP_COLOR.clone() } },
    vertexShader: /* glsl */`
      varying float vAlong;   // 0 at the lamp, 1 at the far end of the cone
      varying float vEdge;    // how face-on this part of the cone is to the camera
      void main() {
        vAlong = -position.y;   // geometry runs from y = 0 (apex) to y = -1
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 v = normalize(-mv.xyz);
        // |n.v| is 1 where the cone faces the camera (looking through the
        // middle of the shaft) and 0 at its silhouette.
        vEdge = abs(dot(n, v));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vAlong;
      varying float vEdge;
      uniform float uStrength;
      uniform vec3 uColor;
      void main() {
        // Fade along the shaft: (1 - t)^2 dims smoothly to nothing at the far
        // end, so the cone has no visible base.
        float along = (1.0 - vAlong) * (1.0 - vAlong);
        // Fade at the silhouette: squaring vEdge removes the bright outline an
        // additive cone otherwise draws along its sides.
        float edge = vEdge * vEdge;
        gl_FragColor = vec4(uColor * along * edge * uStrength, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    fog: false,
  });
}
