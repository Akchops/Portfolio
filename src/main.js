// Entry: the only script that loads eagerly, so it counts against the
// first-load budget. It wires the page chrome and then lazy-loads each
// signature moment as it approaches the viewport. Three.js and GSAP are only
// reachable through the dynamic imports below.

const doc = document.documentElement;

/* ---------- Menu (phones) ---------- */
const masthead = document.querySelector('[data-masthead]');
const menuBtn = document.querySelector('[data-menu]');
if (masthead && menuBtn) {
  const setOpen = (open) => {
    masthead.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.addEventListener('click', () => setOpen(!masthead.classList.contains('is-open')));
  masthead.querySelectorAll('.masthead__list a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && masthead.classList.contains('is-open')) { setOpen(false); menuBtn.focus(); }
  });
}

/* ---------- Sticky CTA tucks away at #book ---------- */
const hero = document.querySelector('[data-hero]');
const book = document.querySelector('#book');
const stickyCta = document.querySelector('[data-sticky-cta]');
if ('IntersectionObserver' in window) {
  if (book && stickyCta) {
    // The booking section has its own controls; the floating CTA would only
    // cover them.
    new IntersectionObserver(([e]) => stickyCta.classList.toggle('is-tucked', e.isIntersecting), {
      threshold: 0.15,
    }).observe(book);
  }
}

/* ---------- Lazy boot ---------- */
function whenNear(el, load, margin = '150% 0px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { load(); return; }
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    load();
  }, { rootMargin: margin });
  io.observe(el);
}

// Fails silently by design: every module's content is already in the DOM, so
// a failed boot leaves the static, readable version standing. Logged only in
// development.
const quiet = (err) => { if (import.meta.env.DEV) console.warn(err); };

// 1. Floodlights: boots at once, the hero is the first thing on screen.
if (hero) import('./hero/boot.js').then((m) => m.boot(hero)).catch((err) => {
  quiet(err);
  hero.querySelector('[data-hero-name]')?.style.setProperty('--hero-wght', '700');
});

// 2. Kickoff to Final Whistle.
const process = document.querySelector('[data-process]');
whenNear(process, () => import('./process/process.js').then((m) => m.mount(process)).catch(quiet));

// 3. Lab.
const pp = document.querySelector('[data-pp]');
whenNear(pp, () => import('./lab/pointer-pitch.js').then((m) => m.mount(pp)).catch(quiet), '100% 0px');
const td = document.querySelector('[data-teardown]');
whenNear(td, () => import('./lab/teardown.js').then((m) => m.mount(td)).catch(quiet));
const ap = document.querySelector('[data-aperture]');
whenNear(ap, () => import('./lab/aperture.js').then((m) => m.mount(ap)).catch(quiet), '100% 0px');
const fo = document.querySelector('[data-focus]');
whenNear(fo, () => import('./lab/focus.js').then((m) => m.mount(fo)).catch(quiet), '100% 0px');

// 4. Booking embed.
if (book) whenNear(book, () => import('./book.js').then((m) => m.mount(book)).catch(quiet), '200% 0px');

doc.classList.add('is-booted');
