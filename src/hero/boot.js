// Floodlights — signature moment 1.
//
// Beat sheet (immersive-scroll Gate 2). The hero is a sticky stage inside a
// track 100svh + 3 beats tall; the extra height is declared in CSS
// (.js.motion .hero) so the page never shifts when this module arrives.
//   3 beats x 700px = 2100px desktop, 3 x 420px = 1260px phone.
//   beat 1: leave the seat rows, drop over the advertising boards
//   beat 2: cross the touchline and run in towards the centre circle
//   beat 3: settle low beside the ball; the glare burns down and the name
//           resolves to full weight
//   Reason for 3: three distinct places (stand, touchline, centre circle). A
//   fourth beat had nothing new to show; two made the descent read as a jump.
//
// Tiers, in order:
//   desktop  live Three.js (hero/live.js) if the silent probe passes,
//            otherwise the static frame
//   phone    pre-rendered frame sequence (hero/sequence.js), otherwise the
//            static frame
//   reduced motion, ?static, no JS: the static frame, name fully resolved.
// In every tier the name still resolves under scroll unless motion is reduced.

import { reduceMotion, isMobileTier, trackProgress, clamp, smooth } from '../util.js';
import { probeWebGL, qa } from '../probe.js';

export async function boot(hero) {
  const name = hero.querySelector('[data-hero-name]');
  const stage = hero.querySelector('.hero__stage');
  // Weight 260 -> 720 and tracking +0.01em -> -0.035em: the strokes thicken
  // and the letters close up, the way detail returns to an overexposed frame
  // as the exposure settles.
  // Quantised to 23 steps of 20 weight units (about 0.3px of stroke on a
  // phone). Every new weight is a fresh font instance to shape and rasterise,
  // and at one per frame that alone pushed a 4x-throttled phone over its
  // frame budget. The properties are written only when the step changes.
  const STEPS = 23;
  let lastStep = -1;
  const setName = (u) => {
    const step = Math.round(smooth(clamp((u - 0.06) / 0.8)) * STEPS);
    if (step === lastStep) return;
    lastStep = step;
    const t = step / STEPS;
    name.style.setProperty('--hero-wght', String(260 + 20 * step));
    name.style.setProperty('--hero-track', `${(0.01 - 0.045 * t).toFixed(4)}em`);
  };

  if (reduceMotion() || qa.static) { name.style.setProperty('--hero-wght', '700'); return; }

  let driver = null;
  const state = { target: 0, u: 0, drawn: -1, running: false };

  function frame() {
    state.target = trackProgress(hero);
    const d = state.target - state.u;
    // Exponential catch-up, ~200ms to settle at 60fps: absorbs the discrete
    // steps of a mouse wheel without feeling detached from the input.
    state.u = Math.abs(d) < 0.0004 ? state.target : state.u + d * 0.14;
    if (Math.abs(state.u - state.drawn) > 0.00005) {
      setName(state.u);
      driver?.render(state.u);
      state.drawn = state.u;
    }
    if (state.running) requestAnimationFrame(frame);
  }
  const start = () => { if (!state.running) { state.running = true; requestAnimationFrame(frame); } };
  const stop = () => { state.running = false; };

  // Run the loop only while the hero is on screen.
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
  setName(trackProgress(hero));
  start();

  const onFail = () => { driver = null; };
  try {
    if (isMobileTier()) {
      driver = await (await import('./sequence.js')).mount(stage, { onFail });
    } else {
      const caps = probeWebGL({ allowSoftware: qa.glForce });
      if (caps && caps.tier !== 'low') {
        driver = await (await import('./live.js')).mount(stage, caps, { onFail, watchdog: !qa.glForce });
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn(err);
    driver = null;
  }
  // Paint the current position immediately rather than waiting for scroll.
  if (driver) { state.drawn = -1; driver.render(state.u); state.drawn = state.u; }
}
