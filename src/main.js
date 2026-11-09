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
// Every lazily mounted module is registered here. Several of them change
// their section's height when they mount (the process and teardown switch to
// their scroll layouts), so an in-page jump must mount the ones above its
// target before it measures where to go. See "In-page links" below.
// `resizes` marks the modules that change their section's height on mount;
// only those are worth waiting for. The others draw into fixed-size stages.
const pending = [];
function whenNear(el, load, margin = '150% 0px', resizes = false) {
  if (!el) return;
  let started = null;
  const start = () => (started ??= Promise.resolve().then(load));
  pending.push({ el, start, resizes });
  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    start();
  }, { rootMargin: margin });
  io.observe(el);
}

/* ---------- In-page links ---------- */
// A plain anchor jump measures the target once, at the click. Modules that
// mount on the way change the height of the sections above it, and a GSAP
// ScrollTrigger refresh resets the scroll position, which cancels a smooth
// scroll. Either way "Book a call" landed thousands of pixels short of #book.
// So: mount everything above the target, let the layout settle, then scroll.
const frames = (n) => new Promise((r) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); });

async function settleAbove(target) {
  const above = pending.filter(({ el, resizes }) => resizes && el !== target && !el.contains(target) &&
    (el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING));
  // Capped: a module that is slow to boot must not hold the jump hostage.
  await Promise.race([Promise.allSettled(above.map(({ start }) => start())), new Promise((r) => setTimeout(r, 1500))]);
  // Two frames for the new layouts to apply and for process.js's debounced
  // ScrollTrigger refresh to run before the scroll starts.
  await frames(2);
  await new Promise((r) => setTimeout(r, 60));
}

// Resolves once the page has stopped moving for ~6 frames.
function scrollSettled() {
  return new Promise((resolve) => {
    let last = -1, still = 0;
    const tick = () => {
      still = Math.abs(scrollY - last) < 1 ? still + 1 : 0;
      last = scrollY;
      if (still >= 6) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function goTo(target, smooth) {
  await settleAbove(target);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // If the visitor takes over the scroll, leave them where they are.
  let interrupted = false;
  const stop = () => { interrupted = true; };
  const opts = { passive: true, once: true };
  ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, stop, opts));
  target.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' });
  await scrollSettled();
  ['wheel', 'touchstart', 'keydown'].forEach((t) => removeEventListener(t, stop, opts));
  // Safety net: if anything still moved the page mid-scroll, finish the job
  // in one step rather than stop short.
  const pad = (parseFloat(getComputedStyle(doc).scrollPaddingTop) || 0) +
    (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
  if (!interrupted && Math.abs(target.getBoundingClientRect().top - pad) > 2) {
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}

// Move keyboard focus to the target as a native anchor jump would, without
// a second scroll and without drawing a focus ring round a whole section.
function focusTarget(target) {
  if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  // Respect modified clicks and anything a module already handled (the
  // teardown's part list scrolls itself).
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = decodeURIComponent(a.getAttribute('href').slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  goTo(target, true).then(() => focusTarget(target));
});


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
whenNear(process, () => import('./process/process.js').then((m) => m.mount(process)).catch(quiet), '150% 0px', true);

// 3. Lab.
const pp = document.querySelector('[data-pp]');
whenNear(pp, () => import('./lab/pointer-pitch.js').then((m) => m.mount(pp)).catch(quiet), '100% 0px');
const td = document.querySelector('[data-teardown]');
whenNear(td, () => import('./lab/teardown.js').then((m) => m.mount(td)).catch(quiet), '150% 0px', true);
const ap = document.querySelector('[data-aperture]');
whenNear(ap, () => import('./lab/aperture.js').then((m) => m.mount(ap)).catch(quiet), '100% 0px');
const fo = document.querySelector('[data-focus]');
whenNear(fo, () => import('./lab/focus.js').then((m) => m.mount(fo)).catch(quiet), '100% 0px');

// 4. Booking embed.
if (book) whenNear(book, () => import('./book.js').then((m) => m.mount(book)).catch(quiet), '200% 0px');

// Arriving with a hash (for example "Book a call" on the case study, which
// links to ../#book): the browser has already jumped, before the modules
// above the target mounted. Settle them and re-align in one step. This runs
// last, once every module above has registered.
if (location.hash.length > 1) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) goTo(target, false);
}

doc.classList.add('is-booted');
