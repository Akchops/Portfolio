// Case-study page: only the menu. Nothing here animates.
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

// Matchday screen recording (README, Placeholders). Empty until supplied.
// When set, the still becomes the poster of a video that plays on a click:
// motion only on a clear action, never a decorative loop.
const fig = document.querySelector('[data-recording]');
const rec = fig?.dataset.recording?.trim();
if (fig && rec) {
  const still = fig.querySelector('img');
  const v = document.createElement('video');
  v.src = new URL(rec, document.baseURI).href;
  v.poster = still.currentSrc || still.src;
  v.controls = true;
  v.playsInline = true;
  v.preload = 'none';
  v.width = 390; v.height = 844;
  v.setAttribute('aria-label', 'Matchday screen recording');
  v.className = 'cs__video';
  still.replaceWith(v);
}
