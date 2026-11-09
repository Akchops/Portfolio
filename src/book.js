// Booking: Cal.com inline embed for cal.com/aarav-orevjw, loaded only as the
// section approaches. The "Email to book" button is in the HTML from the
// start (it is what no-JS visitors get) and stays until the embed reports that
// the booking page is ready. If the page fails to load, or nothing is ready
// within 8 s, the embed is removed and the button remains.

const CAL_LINK = 'aarav-orevjw';
const ORIGIN = 'https://cal.com';
const EMBED_JS = 'https://app.cal.com/embed/embed.js';

export function mount(section) {
  const host = section.querySelector('[data-cal-embed]');
  const fallback = section.querySelector('[data-cal-fallback]');
  if (!host) return;
  host.classList.add('is-loading');

  let settled = false;
  const fail = () => {
    if (settled) return;
    settled = true;
    host.classList.remove('is-loading', 'is-ready');
    host.replaceChildren();          // never leave an error page or a blank frame up
    fallback?.classList.remove('is-hidden');
  };
  const ready = () => {
    if (settled) return;
    settled = true;
    host.classList.remove('is-loading');
    host.classList.add('is-ready');
    fallback?.classList.add('is-hidden');
  };

  // Cal.com's documented loader: queues calls until embed.js has loaded.
  (function (C, A, L) {
    const p = (a, ar) => { a.q.push(ar); };
    const d = C.document;
    C.Cal = C.Cal || function () {
      const cal = C.Cal;
      const ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        const s = d.createElement('script');
        s.src = A;
        s.async = true;
        s.onerror = fail;
        d.head.appendChild(s);
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function () { p(api, arguments); };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === 'string') {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ['initNamespace', namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, EMBED_JS, 'init');

  const Cal = window.Cal;
  Cal('init', 'book', { origin: ORIGIN });
  Cal.ns.book('inline', {
    elementOrSelector: '#cal-inline',
    calLink: CAL_LINK,
    config: { layout: 'month_view', theme: 'dark' },
  });
  Cal.ns.book('ui', {
    theme: 'dark',
    cssVarsPerTheme: { dark: { 'cal-brand': '#FF4D1C' } },
    layout: 'month_view',
  });
  Cal.ns.book('on', { action: 'linkReady', callback: ready });
  Cal.ns.book('on', { action: 'linkFailed', callback: fail });
  setTimeout(fail, 8000);
}
