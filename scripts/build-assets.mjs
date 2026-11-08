#!/usr/bin/env node
/**
 * build-assets.mjs — turns the sourced Poly Haven files in assets-src/ into the
 * compressed runtime assets in public/.
 *
 *   football (Poly Haven, CC0)  -> public/models/football.glb
 *       deflated variant removed, geometry meshopt-compressed
 *       (EXT_meshopt_compression), textures resized and encoded to KTX2
 *       (KHR_texture_basisu).
 *   grass_ground (Poly Haven, CC0) -> public/textures/turf.ktx2
 *       desaturated to luminance first (assets-src/turf-mono-512.png, made by
 *       the PIL step documented in README), then KTX2 with mipmaps.
 *
 * Run: npm run assets
 */
import { readFile, writeFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, resample, reorder, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

/** Decode JPEG or PNG bytes to raw RGBA, which is what the basis encoder takes. */
async function imageDecoder(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const isPng = u8[0] === 0x89 && u8[1] === 0x50;
  if (isPng) {
    const png = PNG.sync.read(Buffer.from(u8));
    return { data: new Uint8Array(png.data), width: png.width, height: png.height };
  }
  const img = jpeg.decode(Buffer.from(u8), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return { data: new Uint8Array(img.data), width: img.width, height: img.height };
}

/** Halve a JPEG/PNG texture inside the document until it is at most `max` px. */
async function shrinkTextures(doc, max) {
  for (const tex of doc.getRoot().listTextures()) {
    const { data, width, height } = await imageDecoder(tex.getImage());
    if (width <= max && height <= max) continue;
    const s = Math.max(width, height) / max;
    const w = Math.round(width / s), h = Math.round(height / s);
    // Box filter: the source is a power of two and so is the target, so each
    // output pixel averages an exact s x s block. No resampling artefacts.
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
        const o = ((y * s + j) * width + (x * s + i)) * 4;
        for (let c = 0; c < 4; c++) acc[c] += data[o + c];
      }
      for (let c = 0; c < 4; c++) out[(y * w + x) * 4 + c] = acc[c] / (s * s);
    }
    const png = new PNG({ width: w, height: h });
    png.data = Buffer.from(out);
    tex.setImage(new Uint8Array(PNG.sync.write(png))).setMimeType('image/png');
  }
}

async function football() {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read('assets-src/polyhaven/football/football_1k.gltf');

  // The Poly Haven file ships a deflated and an inflated ball side by side.
  // Only the inflated one belongs on a centre spot.
  for (const node of doc.getRoot().listNodes()) {
    if (/deflated/i.test(node.getName())) node.dispose();
  }
  await doc.transform(prune(), dedup(), weld(), resample(), reorder({ encoder: MeshoptEncoder }), quantize());
  // The ball is never larger than a few hundred px on screen: 512 textures.
  await shrinkTextures(doc, 512);
  await doc.transform(ktx2({ isUASTC: false, generateMipmap: true, imageDecoder, qualityLevel: 160 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });
  await io.write('public/models/football.glb', doc);
  const { size } = await import('node:fs').then((fs) => fs.statSync('public/models/football.glb'));
  console.log('football.glb', (size / 1024).toFixed(1), 'kB');
}

async function turf() {
  const src = new Uint8Array(await readFile('assets-src/turf-mono-512.png'));
  const out = await encodeToKTX2(src, {
    isUASTC: false,
    generateMipmap: true,   // the pitch recedes to the horizon; mips stop it shimmering
    qualityLevel: 180,
    imageDecoder,
  });
  await writeFile('public/textures/turf.ktx2', out);
  console.log('turf.ktx2', (out.byteLength / 1024).toFixed(1), 'kB');
}

await football();
await turf();
