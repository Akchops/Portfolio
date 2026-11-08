#!/usr/bin/env node
/**
 * render-sequence.mjs — captures the Floodlights frames from the live scene.
 *
 * Renders src/hero/scene.js through tools/capture.html in headless Chromium
 * (SwiftShader, so no GPU is needed) and writes:
 *
 *   assets-src/seq/portrait/0000.png … 0048.png    720 x 1280 master
 *   assets-src/seq/landscape/0000.png … 0048.png   1280 x 720 master
 *   public/seq/floodlights/still-1600.jpg          the static frame, landscape
 *   public/seq/floodlights/still-portrait.jpg      the static frame, portrait
 *
 * Then run scripts/encode-sequence.py to build the tiers and manifests, and
 * scripts/check-sequence.mjs to verify the budgets.
 *
 * 49 master frames: an odd count, so a step-2 tier would still contain the
 * first and last frames (prerendered-pipeline.md section 2). Over 1260px of
 * phone scroll that is ~26px per frame, fine-grained enough that a slow scroll
 * reads as continuous movement.
 *
 * Run: npm run sequence
 */
import { chromium } from './pw.mjs';
import { startDev } from './serve-dev.mjs';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FRAMES = 49;
const sets = [
  { name: 'portrait', w: 720, h: 1280 },
  { name: 'landscape', w: 1280, h: 720 },
];

const dev = await startDev();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`${dev.url}/tools/capture.html?w=${w}&h=${h}`);
  await page.waitForFunction(() => window.sceneReady || window.sceneError, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.sceneError);
  if (err) throw new Error(err);
  return page;
}

for (const set of sets) {
  const dir = `assets-src/seq/${set.name}`;
  mkdirSync(dir, { recursive: true });
  const page = await open(set.w, set.h);
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate((u) => window.renderAt(u), i / (FRAMES - 1));
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.png` });
    if (i % 8 === 0) console.log(set.name, i);
  }
  await page.close();
}

// The static frame: u = 0, the view from the stand. It is the most legible
// viewpoint on the path (the whole pitch, the stands and the lights), and it
// is identical to the first frame of every tier, so the hand-over from still
// to live or sequence is invisible.
mkdirSync('public/seq/floodlights', { recursive: true });
const still = await open(1600, 900);
await still.evaluate(() => window.renderAt(0));
await still.screenshot({ path: 'assets-src/seq/still-1600.png' });
await still.close();

await browser.close();
await dev.close();

execFileSync('python3', ['-I', 'scripts/encode-sequence.py'], { stdio: 'inherit' });
