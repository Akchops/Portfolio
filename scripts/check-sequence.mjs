#!/usr/bin/env node
/**
 * check-sequence.mjs — validates a pre-rendered sequence against its manifest.
 *
 * Confirms every tier has the frame count it claims with no gaps in the
 * numbering, sums wire weight per tier, and computes peak resident decoded
 * memory (width x height x 4) against the mobile and desktop ceilings from
 * references/prerendered-pipeline.md.
 *
 *   node check-sequence.mjs public/seq/grinder-teardown
 *   node check-sequence.mjs public/seq/x --mobile-ceiling 60 --desktop-ceiling 150
 *
 * Exit: 0 clean, 1 a frame is missing or a ceiling is blown, 2 cannot read.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const dir = resolve(argv.find((a) => !a.startsWith('--')) ?? '.');
const num = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const MOBILE_CEILING = num('mobile-ceiling', 60);
const DESKTOP_CEILING = num('desktop-ceiling', 150);

const manifestPath = join(dir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`No manifest.json in ${dir}`);
  console.error('See references/prerendered-pipeline.md section 5 for the expected shape.');
  process.exit(2);
}

let m;
try {
  m = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`manifest.json is not valid JSON: ${e.message}`);
  process.exit(2);
}

const mb = (bytes) => bytes / 1e6;
const fmt = (n) => n.toFixed(1).padStart(7);
const problems = [];

/** Read a frame directory, returning indices found and total bytes on disk. */
function scanFrames(sub, format) {
  const d = join(dir, sub);
  if (!existsSync(d)) return null;
  const re = new RegExp(`^(\\d+)\\.${format}$`, 'i');
  const indices = [];
  let bytes = 0;
  for (const f of readdirSync(d)) {
    const hit = f.match(re);
    if (!hit) continue;
    indices.push(Number(hit[1]));
    bytes += statSync(join(d, f)).size;
  }
  indices.sort((a, b) => a - b);
  return { indices, bytes };
}

function checkLayer(label, spec) {
  const got = scanFrames(spec.dir, spec.format ?? 'jpg');
  if (!got) {
    problems.push(`${label}: directory "${spec.dir}" not found`);
    return null;
  }
  const { indices, bytes } = got;

  if (indices.length !== spec.frames) {
    problems.push(`${label}: manifest says ${spec.frames} frames, found ${indices.length}`);
  }
  // Gaps matter more than the count: a hole mid-sequence is a visible hitch,
  // and a count check alone misses it when a stray extra frame balances it out.
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] !== i) {
      problems.push(`${label}: numbering not contiguous from 0 — expected ${i}, found ${indices[i]}`);
      break;
    }
  }

  return { label, count: indices.length, bytes, perFrame: spec.width * spec.height * 4, spec };
}

console.log(`\n${m.name ?? '(unnamed)'} — ${m.master?.frames ?? '?'} master frames @ ${m.fps ?? '?'}fps\n`);

const ladder = m.ladder ? checkLayer('ladder', m.ladder) : null;
if (!m.ladder) {
  problems.push('no ladder declared — the sequence has no guaranteed floor, see prerendered-pipeline.md section 3');
}

const tiers = (m.tiers ?? [])
  .map((t) => {
    const L = checkLayer(`tier ${t.width}x${t.height}`, t);
    if (L) L.ceilingNote = (t.maxWidth ?? Infinity) < 768 ? 'mobile' : 'desktop';
    return L;
  })
  .filter(Boolean);

if (!tiers.length) problems.push('no tiers declared');

console.log('  LAYER                FRAMES     WIRE MB   MB/FRAME');
console.log('  ' + '-'.repeat(56));
for (const L of [ladder, ...tiers].filter(Boolean)) {
  console.log(`  ${L.label.padEnd(20)} ${String(L.count).padStart(6)}  ${fmt(mb(L.bytes))}   ${fmt(mb(L.perFrame))}`);
}

console.log('\n  PEAK RESIDENT DECODED MEMORY');
console.log('  ' + '-'.repeat(78));
const ladderResident = ladder ? ladder.perFrame * ladder.spec.frames : 0;
for (const t of tiers) {
  const windowFrames = 2 * (t.spec.window ?? 8) + 1;
  const windowBytes = t.perFrame * windowFrames;
  const peak = mb(windowBytes + ladderResident);
  const ceiling = t.ceilingNote === 'mobile' ? MOBILE_CEILING : DESKTOP_CEILING;
  const over = peak > ceiling;
  if (over) problems.push(`${t.label}: peak ${peak.toFixed(1)} MB exceeds the ${ceiling} MB ${t.ceilingNote} ceiling`);
  console.log(
    `  ${t.label.padEnd(20)} win +/-${String(t.spec.window ?? 8).padEnd(2)} (${String(windowFrames).padStart(2)} fr) ` +
    `${fmt(mb(windowBytes))} + ladder ${fmt(mb(ladderResident))} = ${fmt(peak)} MB / ${String(ceiling).padStart(3)} ${over ? 'OVER' : 'ok'}`
  );
}

// Tier alignment: a step-N tier must span exactly the master's frame range, or
// frame indices will not line up when the viewport crosses a breakpoint.
if (m.master?.frames) {
  for (const t of tiers) {
    const step = t.spec.step ?? 1;
    const covered = (t.spec.frames - 1) * step + 1;
    if (covered !== m.master.frames) {
      problems.push(
        `${t.label}: ${t.spec.frames} frames at step ${step} spans ${covered} master frames, ` +
        `but the master has ${m.master.frames}. Indices will not line up across breakpoints.`
      );
    }
  }
}

console.log('');
if (problems.length) {
  console.log('  PROBLEMS');
  problems.forEach((p) => console.log(`    ${p}`));
  console.log('');
  process.exit(1);
}
console.log('  PASS — frame counts contiguous, tiers aligned, all peaks within ceilings.\n');
console.log('  Still needs a human: scrub slowly for denoiser boiling and exposure pumping,');
console.log('  and check the first and last frames against the sections either side.\n');
