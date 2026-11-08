// Dev screenshots at chosen scroll depths.
//   node scripts/shot.mjs <url> <out-prefix> <w>x<h> <comma-separated scrollY values or pct%> [--mobile] [--reduce] [--nojs] [--gl]
import { chromium } from './pw.mjs';
const [url, out, size, ys, ...flags] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const mobile = flags.includes('--mobile');
const args = flags.includes('--gl') ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
const browser = await chromium.launch({ args });
const ctx = await browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
  reducedMotion: flags.includes('--reduce') ? 'reduce' : 'no-preference', javaScriptEnabled: !flags.includes('--nojs'),
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[requestfailed] ' + r.url() + ' ' + (r.failure()?.errorText || '')));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (const y of ys.split(',')) {
  // "#id@0.5" scrolls to 50% of the way through that section's scroll span.
  let top;
  if (y.startsWith('#')) {
    const [sel, f] = y.split('@');
    top = await page.evaluate(([sel, f]) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const start = scrollY + r.top;
      return Math.round(start + Math.max(0, el.offsetHeight - innerHeight) * Number(f));
    }, [sel, f]);
  } else top = y.endsWith('%') ? Math.round(total * parseFloat(y) / 100) : Number(y);
  await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), top);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}-${y.replace('%', 'pct').replace('#', '').replace('@', '_')}.png` });
}
const info = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth, innerW: innerWidth, h: document.documentElement.scrollHeight,
  heroTier: document.querySelector('.hero__canvas') ? 'canvas' : 'still',
  ppTier: document.querySelector('[data-pp]')?.dataset.tier || 'static',
}));
console.log(JSON.stringify(info));
console.log(logs.join('\n') || 'console/network clean');
await browser.close();
