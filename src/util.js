// Shared helpers for the lazily loaded modules.

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// One beat = one readable state change under scroll (immersive-scroll Gate 2).
// 700px on desktop; 420px on phones, where a thumb fling covers far more
// document px per gesture. Capped at 90% of the viewport so a beat never needs
// more than one screen of travel. Re-read on every resize.
export const beatPx = () =>
  Math.round(Math.min(window.innerWidth < 768 ? 420 : 700, window.innerHeight * 0.9));

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// C1 smoothstep: no velocity jump at either end of a segment.
export const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Scroll progress of a tall "track" element whose sticky child is the stage:
 * 0 when the track's top reaches the viewport top, 1 when its bottom reaches
 * the viewport bottom.
 */
export function trackProgress(track) {
  const r = track.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? clamp(-r.top / span) : 0;
}

/** True when the phone path should be used: small screens or touch-first. */
export const isMobileTier = () =>
  window.innerWidth < 1024 || matchMedia('(pointer: coarse)').matches;
