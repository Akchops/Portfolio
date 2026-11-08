#!/usr/bin/env python3
"""prepare-turf.py — turns Poly Haven's grass_ground diffuse (CC0) into the
monochrome turf detail map used on the pitch.

Luminance only (the pitch is tinted in the scene, in the site palette), and
contrast lowered to 0.42: a mown pitch is far more even than field grass, and
low contrast is what stops the ~4.4 m tile repeat reading as a pattern.

Then `npm run assets` encodes it to public/textures/turf.ktx2.
"""
from PIL import Image, ImageOps, ImageEnhance

im = Image.open('assets-src/polyhaven/grass_ground_diff_1k.jpg').convert('L')
im = ImageOps.autocontrast(im, cutoff=1)
im = ImageEnhance.Contrast(im).enhance(0.42)
im.convert('RGB').resize((512, 512), Image.LANCZOS).save('assets-src/turf-mono-512.png')
print('wrote assets-src/turf-mono-512.png')
