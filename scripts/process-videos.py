#!/usr/bin/env python3
"""process-videos.py — prepares the two Matchday brag videos for the site.

    python3 -I scripts/process-videos.py <brag-vertical_1.mp4> <brag-vertical_2.mp4>

Writes public/media/matchday-brag-1.mp4, matchday-brag-2.mp4 and their
posters (.jpg). Each video is 720 x 1280, H.264, muted (audio removed),
under 3 MB, with +faststart so it can begin playing before it has fully
loaded.

The source files are NOT kept in the repository: video 1's original frames
show an academy join code and the names of under-14 players. Only the
blurred output is published.

Video 1 redaction (brief: no Academy join code, no player data beyond the
demo account "Alex"). Boxes are in source pixels (1080 x 1920) and seconds,
measured frame by frame (see docs/qa/QA.md). Each box is padded beyond the
text it hides, and transitions get a box covering the whole path of the
moving phone, so a fast frame cannot slip a name past a box.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'media')

# (x, y, w, h, t_start, t_end): regions blurred in video 1.
REDACT_1 = [
    # Academy screen slides up from the bottom: the join code travels through
    # this band, and the phone overshoots ~45 px upwards as it springs to rest
    # (8.1-8.3 s), so the band reaches well above the code's resting place.
    (345, 1095, 395, 825, 7.70, 8.45),
    # Academy screen at rest: the join code panel (label, code, Copy, New code).
    (345, 1120, 395, 230, 8.40, 10.40),
    # Swipe to Players, then the Players screen: the join request naming a
    # player (its first line sits right at the card's top edge, y ~840), the
    # coaches' handles and the "Everyone" list.
    (345, 812, 395, 695, 10.35, 11.80),
    # The phone shrinks to the right while the Setup screen slides in from
    # the left: cover both paths.
    (0, 640, 925, 875, 11.70, 12.10),
    # Two phones: "The family" (Setup screen, coach handle) and "The academy"
    # (player list).
    (155, 675, 250, 525, 12.05, 14.70),
    (670, 675, 245, 525, 12.05, 14.70),
    # The academy phone returns to the centre while the family phone (the
    # Setup screen, with a coach's handle) slides out past the left edge:
    # cover the full width, from x 0.
    (0, 640, 925, 875, 14.68, 15.30),
    # Stats: the ranked list, and the card of the top three that pops out.
    (345, 755, 390, 730, 15.25, 17.40),
    (320, 735, 695, 315, 15.75, 17.35),
    # Team selection: the picked list, from its first row ("1. ..." sits at
    # y ~970, just under the "PICKED" label), until the league table covers it.
    (345, 700, 390, 800, 17.25, 17.50),
    (345, 955, 390, 470, 17.45, 18.40),
]

# The consent card ("I'm 13 or over, or I'm Alex's parent or guardian")
# floats over the family phone. It is about the demo account and is restored
# on top of the blur while it is fully drawn.
RESTORE_1 = [(42, 910, 546, 108, 12.40, 13.24)]

BLUR = 'gblur=sigma=24:steps=3'   # at 1080p this leaves no letterform readable


def run(cmd):
    print(' '.join(cmd[:8]), '...')
    subprocess.run(cmd, check=True)


def redact_filter(boxes, restores):
    n = len(boxes) + len(restores)
    parts = [f'[0:v]split={n + 1}[base]' + ''.join(f'[s{i}]' for i in range(n))]
    for i, (x, y, w, h, *_rest) in enumerate(boxes):
        parts.append(f'[s{i}]crop={w}:{h}:{x}:{y},{BLUR}[b{i}]')
    for j, (x, y, w, h, *_rest) in enumerate(restores):
        k = len(boxes) + j
        parts.append(f'[s{k}]crop={w}:{h}:{x}:{y}[b{k}]')
    prev = 'base'
    for i, (x, y, w, h, t0, t1) in enumerate(boxes + restores):
        parts.append(f"[{prev}][b{i}]overlay={x}:{y}:enable='between(t,{t0},{t1})'[v{i}]")
        prev = f'v{i}'
    parts.append(f'[{prev}]scale=720:1280:flags=lanczos,format=yuv420p[out]')
    return ';'.join(parts)


def encode(src, dst, vf_complex=None):
    # Two-pass at ~880 kb/s: ~25 s comes out near 2.7 MB, under the 3 MB cap,
    # and two passes spend the bits where the motion is.
    common = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.0',
              '-b:v', '880k', '-maxrate', '1400k', '-bufsize', '2800k',
              '-g', '60', '-pix_fmt', 'yuv420p', '-an']
    filt = (['-filter_complex', vf_complex, '-map', '[out]'] if vf_complex
            else ['-vf', 'scale=720:1280:flags=lanczos,format=yuv420p'])
    log = dst + '.log'
    run(['ffmpeg', '-v', 'error', '-y', '-i', src, *filt, *common, '-pass', '1', '-passlogfile', log, '-f', 'mp4', os.devnull])
    run(['ffmpeg', '-v', 'error', '-y', '-i', src, *filt, *common, '-pass', '2', '-passlogfile', log,
         '-movflags', '+faststart', dst])
    for f in os.listdir(os.path.dirname(dst)):
        if f.startswith(os.path.basename(log)):
            os.remove(os.path.join(os.path.dirname(dst), f))


def poster(video, t, dst):
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', video, '-frames:v', '1', '-q:v', '3', dst])


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src1, src2 = sys.argv[1], sys.argv[2]
    os.makedirs(OUT, exist_ok=True)
    v1 = os.path.join(OUT, 'matchday-brag-1.mp4')
    v2 = os.path.join(OUT, 'matchday-brag-2.mp4')
    encode(src1, v1, redact_filter(REDACT_1, RESTORE_1))
    encode(src2, v2)
    # Posters come from the published (already redacted) encodes.
    poster(v1, POSTER_1, os.path.join(OUT, 'matchday-brag-1.jpg'))
    poster(v2, POSTER_2, os.path.join(OUT, 'matchday-brag-2.jpg'))
    for f in (v1, v2):
        print(os.path.basename(f), f'{os.path.getsize(f) / 1e6:.2f} MB')


# Poster frames (seconds), chosen by inspection:
#   video 1: "EVERY MATCH, RATED FOR YOUR POSITION." with the rating screen
#   video 2: "KEEPERS DON'T SCORE." with the wordmark fully drawn
POSTER_1 = 6.2
POSTER_2 = 2.7

if __name__ == '__main__':
    main()
