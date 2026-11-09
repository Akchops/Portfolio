// Case-study page: the menu, and the hero video's playback.
const masthead = document.querySelector('[data-masthead]');
const menuBtn = document.querySelector('[data-menu]');
if (masthead && menuBtn) {
  const setOpen = (open) => {
    masthead.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.addEventListener('click', () => setOpen(!masthead.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && masthead.classList.contains('is-open')) { setOpen(false); menuBtn.focus(); }
  });
}

// Hero video: it autoplays muted and loops (the brief asks for that here),
// but only while it is on screen, so it costs nothing once scrolled past.
// Reduced motion was already handled inline: no autoplay, poster, controls.
const hero = document.querySelector('[data-hero-video]');
if (hero && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) hero.play().catch(() => {});
    else hero.pause();
  }).observe(hero);
}
