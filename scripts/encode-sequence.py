#!/usr/bin/env python3
"""encode-sequence.py — builds the Floodlights tiers, ladders and manifests
from the master PNGs written by render-sequence.mjs.

Budgets (decoded bytes = w x h x 4; ceilings 60 MB mobile, 150 MB desktop):

  portrait   ladder 180x320 x49 = 11.3 MB resident
             tier-540  540x960  window +/-8 (17 fr) = 35.3 MB  -> peak 46.5 MB
             tier-720  720x1280 window +/-5 (11 fr) = 40.6 MB  -> peak 51.9 MB
  landscape  ladder 320x180 x49 = 11.3 MB resident
             tier-960  960x540  window +/-8 (17 fr) = 35.3 MB  -> peak 46.5 MB
             tier-1280 1280x720 window +/-5 (11 fr) = 40.6 MB  -> peak 51.9 MB

Every peak sits under the 60 MB mobile ceiling, since the sequence only ever
runs on phones and tablets. JPEG q76: decode speed matters more than bytes
when frames are decoded on a deadline (frame-sequences.md).
"""
import json
import os
from PIL import Image

FRAMES = 49
SETS = {
    'portrait': {
        'master': (720, 1280),
        'ladder': (180, 320),
        'tiers': [
            {'maxWidth': 599, 'size': (540, 960), 'window': 8, 'dir': 'tier-540'},
            {'maxWidth': None, 'size': (720, 1280), 'window': 5, 'dir': 'tier-720'},
        ],
    },
    'landscape': {
        'master': (1280, 720),
        'ladder': (320, 180),
        'tiers': [
            {'maxWidth': 899, 'size': (960, 540), 'window': 8, 'dir': 'tier-960'},
            {'maxWidth': None, 'size': (1280, 720), 'window': 5, 'dir': 'tier-1280'},
        ],
    },
}


def save(im, path, size, q):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = im if im.size == size else im.resize(size, Image.LANCZOS)
    out.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=False)


for name, spec in SETS.items():
    src = f'assets-src/seq/{name}'
    dst = f'public/seq/floodlights-{name}'
    for i in range(FRAMES):
        im = Image.open(f'{src}/{i:04d}.png')
        save(im, f'{dst}/ladder/{i:04d}.jpg', spec['ladder'], 70)
        for t in spec['tiers']:
            save(im, f"{dst}/{t['dir']}/{i:04d}.jpg", t['size'], 76)
    w, h = spec['master']
    lw, lh = spec['ladder']
    manifest = {
        'name': f'floodlights-{name}',
        'fps': 30,
        'master': {'width': w, 'height': h, 'frames': FRAMES},
        'ladder': {'width': lw, 'height': lh, 'frames': FRAMES, 'format': 'jpg', 'dir': 'ladder'},
        'tiers': [
            {'maxWidth': t['maxWidth'], 'width': t['size'][0], 'height': t['size'][1], 'frames': FRAMES,
             'step': 1, 'window': t['window'], 'format': 'jpg', 'dir': t['dir']}
            for t in spec['tiers']
        ],
    }
    with open(f'{dst}/manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    print('wrote', dst)

# Static frames: the first frame of each orientation.
os.makedirs('public/seq/floodlights', exist_ok=True)
save(Image.open('assets-src/seq/still-1600.png'), 'public/seq/floodlights/still-1600.jpg', (1600, 900), 80)
save(Image.open('assets-src/seq/portrait/0000.png'), 'public/seq/floodlights/still-portrait.jpg', (720, 1280), 80)
print('wrote stills')
