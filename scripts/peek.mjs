// Quick look: render the scene at a few u values to PNGs.
//   node scripts/peek.mjs out-dir 1600x900 0,0.5,1
import { chromium } from './pw.mjs';
import { startDev } from './serve-dev.mjs';
import { mkdirSync } from 'node:fs';
const [out = 'peek', size = '1600x900', us = '0,0.5,1'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
mkdirSync(out, { recursive: true });
const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${dev.url}/tools/capture.html?w=${w}&h=${h}`);
await page.waitForFunction(() => window.sceneReady || window.sceneError, null, { timeout: 120000 });
const err = await page.evaluate(() => window.sceneError);
if (err) { console.log(err); process.exit(1); }
for (const u of us.split(',').map(Number)) {
  const t = Date.now();
  await page.evaluate((u) => window.renderAt(u), u);
  await page.screenshot({ path: `${out}/u${u.toFixed(3)}.png` });
  console.log('u', u, Date.now() - t, 'ms');
}
await browser.close(); await dev.close();
