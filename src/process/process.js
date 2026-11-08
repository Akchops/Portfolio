// Kickoff to Final Whistle — signature moment 2.
//
// A pinned scene: scroll scrubs a match clock from 00:00 to 90:00 and lights
// the four stages in order. Nothing here runs on a timer; every value is a
// function of scroll position.
//
// Beat sheet (immersive-scroll Gate 2):
//   4 beats x 700px = 2800px desktop, 4 x 420px = 1680px phone.
//   beat 1: kickoff, Brief lights, the clock runs to 22:30
//   beat 2: Design lights, clock to 45:00
//   beat 3: Build lights, clock to 67:30
//   beat 4: Launch lights, clock to the final whistle at 90:00
//   Reason for 4: one beat per stage, so each stage holds the screen for one
//   readable state. On phones the track also slides one stage per beat.
//
// The base markup is a plain vertical list (no JS, reduced motion, GSAP failed
// to load). This module only upgrades it, inside gsap.matchMedia so that the
// upgrade is reverted automatically if reduced motion is switched on.

import { beatPx } from '../util.js';

export async function mount(section) {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);

  const BEATS = 4;
  const clock = section.querySelector('[data-clock]');
  const fill = section.querySelector('[data-rail-fill]');
  const track = section.querySelector('[data-track]');
  const stages = [...section.querySelectorAll('[data-stage]')];
  const viewport = track.parentElement;

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const setHeight = () => section.style.setProperty('--process-scroll', `${BEATS * beatPx()}px`);
    setHeight();
    section.classList.add('is-scrub');

    // How far the track must slide so the last stage ends flush with the
    // viewport. Zero on wide screens, where all four stages fit.
    const travel = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    const setX = gsap.quickSetter(track, 'x', 'px');
    const setFill = gsap.quickSetter(fill, 'scaleX');
    let lastMinute = -1;
    let lit = -1;

    const update = (p) => {
      // Clock: 90 match minutes across the whole pin. Shown as mm:ss of match
      // time; seconds are what make the scrub visible at slow scroll.
      const t = p * 90 * 60;
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      const key = m * 60 + s;
      if (key !== lastMinute) {
        lastMinute = key;
        clock.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
      setFill(p);
      // Stage k lights when the clock passes its kickoff: 0', 22.5', 45', 67.5'.
      const now = Math.min(stages.length - 1, Math.floor(p * stages.length + 0.0001));
      if (now !== lit) {
        lit = now;
        stages.forEach((el, i) => el.classList.toggle('is-lit', i <= now));
      }
      // On narrow screens the track slides so the lit stage is in view.
      // Smoothstep inside each beat holds each stage still for most of its
      // beat and moves between them, instead of a constant drift.
      const seg = p * (stages.length - 1);
      const k = Math.floor(seg), f = seg - k;
      const eased = (k + f * f * (3 - 2 * f)) / (stages.length - 1);
      setX(-travel() * Math.min(1, eased));
    };

    // A proxy tween carries the scrub: ScrollTrigger only smooths progress for
    // an attached animation, not for a bare trigger.
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1,
      ease: 'none',       // the primary movement tracks scroll exactly
      onUpdate: () => update(proxy.p),
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        // The section is 100svh + 4 beats tall (set above); the pin is CSS
        // sticky, so the scrub runs exactly over those 4 beats.
        end: 'bottom bottom',
        scrub: 0.6,       // brief catch-up: smooths wheel steps, still tracks the thumb
        invalidateOnRefresh: true,
        onRefreshInit: setHeight,
      },
    });
    update(proxy.p);

    // Sections above change height as they upgrade (the teardown, lazy
    // images). Re-measure when the document does, debounced.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    ro.observe(document.body);

    return () => {
      ro.disconnect();
      tween.scrollTrigger?.kill();
      tween.kill();
      section.classList.remove('is-scrub');
      section.style.removeProperty('--process-scroll');
      stages.forEach((el) => el.classList.remove('is-lit'));
      gsap.set(track, { clearProps: 'transform' });
    };
  });
}
