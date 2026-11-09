#!/usr/bin/env node
/**
 * make-placeholders.mjs — renders the placeholder images listed in the README
 * "Placeholders" section. Each one is replaced later by swapping the file.
 *
 *   public/placeholders/baxter.png                       1600 x 1000
 *
 * (It used to draw matchday-1..4.png as well. Those are now the supplied
 * screenshots, and the script no longer touches them.)
 *
 * The Matchday frames are deliberately abstract: neutral blocks where an app
 * screen would be, no names, no numbers, no match data, so nothing can be
 * mistaken for a real player's record. Each frame carries the label the
 * brief asks for.
 *
 * Run: node scripts/make-placeholders.mjs
 */
import { chromium } from './pw.mjs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const font = (f) => 'file://' + join(root, 'src/fonts', f);

const css = `
@font-face{font-family:Display;src:url(${font('bricolage-grotesque-latin-wght.woff2')}) format('woff2');font-weight:200 800}
@font-face{font-family:Body;src:url(${font('inter-latin-wght.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:Mono;src:url(${font('jetbrains-mono-latin-wght.woff2')}) format('woff2');font-weight:100 800}
*{box-sizing:border-box;margin:0}
html,body{width:100%;height:100%;background:#17191D;color:#EDE8DF;font-family:Body,sans-serif}
.frame{position:relative;width:100%;height:100%;overflow:hidden;padding:56px 22px 28px}
.bar{height:10px;border-radius:5px;background:#2A2D33}
.row{display:flex;gap:10px;align-items:center;margin-top:14px}
.chip{height:26px;border-radius:13px;background:#22252A;flex:0 0 auto}
.card{border:1px solid #2A2D33;border-radius:14px;padding:16px;margin-top:16px;background:#121417}
.ring{width:150px;height:150px;border-radius:50%;border:12px solid #2A2D33;border-top-color:#7A7F88;margin:6px auto 0}
.pitch{position:relative;height:190px;border:1.5px solid #3A3E45;border-radius:6px;margin-top:6px}
.pitch:before{content:'';position:absolute;left:0;right:0;top:50%;border-top:1.5px solid #3A3E45}
.pitch:after{content:'';position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border:1.5px solid #3A3E45;border-radius:50%}
.box{position:absolute;left:30%;right:30%;height:34px;border:1.5px solid #3A3E45}
.dot{position:absolute;width:12px;height:12px;border-radius:50%;background:#7A7F88}
.label{position:absolute;left:18px;right:18px;bottom:22px;padding:14px 16px;border:1px dashed #7A7F88;border-radius:10px;background:#0B0C0E;
  font:600 15px/1.35 Mono,monospace;letter-spacing:.01em;color:#EDE8DF;text-align:left}
.label small{display:block;margin-top:6px;font:500 12px/1.3 Mono,monospace;color:#9EA2AA;letter-spacing:.04em;text-transform:uppercase}
.notch{position:absolute;top:12px;left:50%;width:110px;height:26px;margin-left:-55px;border-radius:13px;background:#0B0C0E}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.tile{height:64px;border-radius:10px;background:#22252A}
`;

const screens = [
  // 1: match score view
  `<div class="row"><div class="bar" style="width:46%"></div><div class="chip" style="width:64px;margin-left:auto"></div></div>
   <div class="card"><div class="bar" style="width:38%"></div><div class="ring"></div>
   <div class="row" style="justify-content:center"><div class="bar" style="width:30%"></div></div></div>
   <div class="card"><div class="bar" style="width:52%"></div>
   <div class="row"><div class="bar" style="flex:1"></div><div class="bar" style="width:22%;background:#7A7F88"></div></div>
   <div class="row"><div class="bar" style="flex:1"></div><div class="bar" style="width:36%;background:#7A7F88"></div></div></div>`,
  // 2: position on the pitch
  `<div class="row"><div class="bar" style="width:40%"></div></div>
   <div class="row"><div class="chip" style="width:84px;background:#3A3E45"></div><div class="chip" style="width:84px"></div><div class="chip" style="width:84px"></div></div>
   <div class="card"><div class="pitch"><div class="box" style="top:0"></div><div class="box" style="bottom:0"></div>
   <div class="dot" style="left:24%;top:66%"></div></div></div>
   <div class="card"><div class="bar" style="width:60%"></div><div class="row"><div class="bar" style="width:80%"></div></div></div>`,
  // 3: calendar
  `<div class="row"><div class="bar" style="width:34%"></div><div class="chip" style="width:40px;margin-left:auto"></div></div>
   <div class="card"><div class="grid" style="grid-template-columns:repeat(7,1fr);gap:6px">${Array.from({ length: 28 }, (_, i) => `<div style="height:30px;border-radius:6px;background:${[3, 10, 17, 24].includes(i) ? '#3A3E45' : '#1E2125'}"></div>`).join('')}</div></div>
   <div class="card"><div class="bar" style="width:50%"></div><div class="row"><div class="bar" style="width:70%"></div></div></div>`,
  // 4: training log
  `<div class="row"><div class="bar" style="width:44%"></div></div>
   <div class="grid"><div class="tile"></div><div class="tile"></div><div class="tile"></div><div class="tile"></div></div>
   <div class="card"><div class="bar" style="width:46%"></div><div class="row"><div class="bar" style="flex:1"></div></div><div class="row"><div class="bar" style="width:64%"></div></div></div>`,
];

const dir = mkdtempSync(join(tmpdir(), 'ph-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

// The four Matchday screens are now the supplied screenshots of the demo
// account; this script must never overwrite them. Their stand-ins are kept
// above only as a record and are not rendered.
for (let i = 0; i < 0; i++) {
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>
    <div class="frame"><div class="notch"></div>${screens[i]}
    <p class="label">Matchday screenshot: replace with demo data<small>Placeholder ${i + 1} of 4</small></p></div>`;
  const f = join(dir, `m${i}.html`);
  writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, `public/placeholders/matchday-${i + 1}.png`) });
}

await page.setViewportSize({ width: 1600, height: 1000 });
const bax = `<!doctype html><meta charset="utf-8"><style>${css}
  .wrap{position:relative;width:100%;height:100%;display:grid;place-items:center;background:#17191D}
  .win{width:1180px;height:660px;border:1px solid #2A2D33;border-radius:18px;background:#121417;padding:28px;display:grid;grid-template-columns:260px 1fr;gap:28px}
  .side .bar{margin-top:18px}.main .card{margin-top:0;margin-bottom:18px}
  .b{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);width:auto;right:auto;font-size:20px;padding:18px 24px}
</style><div class="wrap"><div class="win"><div class="side">${'<div class="bar" style="width:70%"></div>'.repeat(6)}</div>
  <div class="main"><div class="card" style="height:220px"><div class="bar" style="width:30%"></div></div>
  <div class="card" style="height:120px"><div class="bar" style="width:50%"></div></div>
  <div class="card" style="height:120px"><div class="bar" style="width:40%"></div></div></div></div>
  <p class="label b">Baxter visual: replace with a screenshot using demo data<small>Placeholder</small></p></div>`;
writeFileSync(join(dir, 'b.html'), bax);
await page.goto('file://' + join(dir, 'b.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'public/placeholders/baxter.png') });

await browser.close();
console.log('placeholders written');
