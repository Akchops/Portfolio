# QA report

Run against the production build (`npm run build && npm run preview`) in a
GPU-less Linux container with headless Chromium, on 9 November 2026, after
the Matchday videos, the four Matchday screenshots and the Kessel live-demo
links went in. Evidence images are in this folder.

## Gates

| Gate | Result | Evidence |
|---|---|---|
| 320 / 390 / 768 / 1280 / 1920 px, no horizontal scroll | **Pass.** `scrollWidth` equals the viewport width at all five widths, on the home page and on `/matchday/`. All three signature moments work at every width: 320–768 use the hero frame sequence; 1280 and 1920 run the live Three.js scene (SwiftShader, `?gl=force`). Pointer Pitch runs WebGL at every width, with touch below 1024 px and the mouse above. | `signatures-5-widths.jpg` (per row: hero start, hero end, process mid-scrub, Pointer Pitch under the pointer) |
| Console and network clean | **Pass, with one reported warning.** 0 console errors, 0 page errors and 0 failed requests across all 54 matrix captures and the three fallback passes. The same holds on `/matchday/` at all five widths. The only warning is Cal.com's own: `Error with Permissions-Policy header: Unrecognized feature: 'bluetooth'.` It comes from the header on the booking iframe Cal.com serves. It is not ours, it is not an error, and it appears only once the embed has loaded (5 of the 6 matrix viewports, plus the reduced-motion and no-WebGL passes). | `motion-qa.mjs` report: 54/54 captured, exit 0 |
| Reduced motion | **Pass.** Home: the static stand frame with the name fully resolved; the process as a vertical list; the teardown as a column of stills with every caption; Pointer Pitch as the still image; the Work card video stays on its poster. Case study: the hero video does not autoplay; it shows its poster with native controls. No content lost. | `fallbacks-reduced-motion-no-webgl.jpg` (top row) |
| No WebGL | **Pass.** Phones keep the frame sequence, which needs no WebGL. Desktop shows the static frame. Pointer Pitch drops to Canvas 2D. The probe logs nothing. | same file, bottom row |
| No JS | **Pass.** Every heading, paragraph, image, table and link is present on both pages; nothing is blank. Home: 4,776 characters of visible text. Case study: all four gallery captions are present, and so is the live link. The case-study hero still plays, muted and looping, from its `autoplay` attribute. Without script nothing can read the reduced-motion setting, so it plays for everyone on this path. The Work card video, which script starts, stays on its poster. Chromium shows native video controls when scripting is off. | `fallback-no-js-fullpage.jpg` |
| External links | **Pass.** All four return **200**: `prayatnonline.org`, `akchops.github.io/football-app/`, `akchops.github.io/orrin/` and `cal.com/aarav-orevjw`. Its embed `app.cal.com/aarav-orevjw/embed` also returns 200, and in the browser the inline embed reports ready in 4–5 s at 1280 and 390 px, after which "Email to book" steps aside. Every external `<a>` in the built HTML has `target="_blank"` and `rel="noopener noreferrer"`. In the browser, both "View the live demo" links (Kessel card and teardown) open Orrin in a new tab with `window.opener` null, and the card's own link to `#kessel` is not triggered. | — |
| Anchor routes | **Pass.** Each lands with the target's top at exactly **64 px** (directly under the masthead), stays there 3 s later, and moves focus to the target: masthead "Book a call" (1280), hero "Book a call" (1280), the phone sticky CTA (390; on phones it is the hero CTA, pinned), nav Lab (1920), nav Process, Services, About (1280), the Work cards' Baxter and Kessel links (1280; Kessel at 390 too), a Services "Enquire for a quote" (1280), footer Book (1280 and 390), footer Work (1280), the case study's "Book a call" to `../#book` (1280 and 390), and the masthead CTA with reduced motion. 0 page errors. | `main.js` in-page links |
| WebGL context loss | **Pass.** Forced with `WEBGL_lose_context`. Hero: the live canvas is removed and the static frame stays visible. Pointer Pitch: drops to Canvas 2D, one canvas, no errors, at 1280 (mouse) and 390 (touch). | — |
| 60 fps | **Emulated pass, 4× CPU throttle. Not measured on a phone.** Scrolling at a steady 1.5 px/ms with GPU compositing (SwiftShader), p95 frame rate: hero 59.5–59.9, process 59.5–59.9, teardown 59.5 fps, at 320, 390 and 1280 px. 0 frames over 32 ms except one in one teardown run. Nine repeat runs of the phone hero all held p95 ≥ 59.5 fps. See the note below. | perf runs, below |
| Phone frame memory | **Pass.** Peak decoded frame memory is 46.5 MB on phones (540 × 960 tier, ±8 window, plus the ladder) and 51.8 MB on tablets (720 × 1280, ±5). Both are under 60 MB. The hero canvas adds 1.7 MB on a 390 px phone. `check-sequence.mjs`: PASS for both orientations. | `scripts/check-sequence.mjs` |
| First load | **15.5 kB gzip** (limit 100 kB): HTML 6.8, CSS 6.2, JS 2.5. Three.js (193 kB gzip) and GSAP + ScrollTrigger (45 kB) are code-split and lazy; the videos load only when needed (the card's `preload="none"`). | `npm run budget` |
| Contrast | Bone/Ink 16.0, Bone/Ash 14.4, Smoke/Ink 4.86, Ember/Ink 5.9, Ink/Ember 5.9. Smoke on Ash (4.37) is not used for text. Hero line, on its Ink plate: 16.0:1. Hero name over the scene (worst 95th-percentile pixel behind the glyphs): phone sequence 5.06:1, desktop static 4.55:1, desktop live 3.51:1. It is large text and needs 3:1. | measured from renders |
| Matchday media | **Pass.** `matchday-brag-1.mp4` 2.82 MB and `matchday-brag-2.mp4` 2.83 MB: both under 3 MB, H.264, 720 × 1280, no audio track, `muted playsinline`, with a poster. Work card: plays when 60% in view and pauses when scrolled away. Case-study hero: autoplays, muted and looping. Gallery: the four screenshots in phone frames, captions exactly as briefed. | `matchday-media.jpg` |
| Video 2 poster | **Pass.** The KEEPERS wordmark was checked at 1.8, 2.1, 2.4, 2.7, 3.0, 3.4 and 4.0 s. It is still drawing at 2.1 s, fully drawn from 2.4 to 3.0 s, and gone by 3.4 s. The poster is 2.7 s, mid-hold. | `video2-poster-check.jpg` |
| Video 1 redaction | **Pass.** See below. | — |

### Video 1 redaction

The original video shows an Academy join code, other players' names, coaches'
handles and the Setup screen (which carries a date of birth). Those regions
are blurred (Gaussian, sigma 24 at 1080p) for exactly the time each is on
screen. The boxes and timings are in `scripts/process-videos.py`. No sensitive
value is written down here or anywhere else in the repository.

- **OCR, every frame of the sensitive span.** Tesseract over all 342 frames
  from 7.4 to 18.8 s, at source resolution, against a list of the sensitive
  strings: 0 matches.
- **OCR, whole video.** Every 0.1 s across the full length: 0 matches in
  video 1 apart from false positives, each checked by eye (for example
  "Matches", the tab label). Video 2: 0 matches.
- **Sharpness.** For each of 2,604 word boxes located in the original frames,
  the edge energy left in the published frame: median 2.7%, maximum 8.2%. No
  letterform is readable at that level.
- **By eye.** Every transition frame (screens sliding in and out, the phone
  springing to rest) was reviewed. Four leaks found this way were fixed
  before publishing: a name in the late frames of the team-selection list, the join code during the
  phone's spring overshoot, the top line of a join request, and a coach
  handle at the far left of the Setup screen as it slid out.
- The consent card about the demo account is restored over the blur while it
  is fully drawn.

### Note on the 60 fps gate

This container renders without a GPU. With Chromium's default software
compositing, a 2D canvas is copied on the main thread every frame (about
11 ms at 4× throttle), which a phone's GPU compositor does not do. So the
gate is measured with GPU compositing emulated by SwiftShader. Under software
compositing the phone hero still reaches p95 59.9 fps on some runs, but it is
noisy on this machine.

Two changes made during this pass took main-thread work out of the phone
hero:

- The canvas is sized to the frame's own resolution, not the screen's.
- The name's weight moves in 23 steps, not a new value every frame.

Both are recorded in the README (decisions 10 and 15). An A/B test against
the previous commit showed the old build was slower on this machine. So this
container is slower than the one the earlier report ran on; the code had not
regressed.

```
4x CPU throttle, GPU compositing (SwiftShader), 1.5 px/ms
390x844  hero      p95 59.5 fps   max 16.8 ms   0 over 32 ms
390x844  process   p95 59.9 fps   max 16.8 ms   0 over 32 ms
390x844  teardown  p95 59.5 fps   max 33.3 ms   1 over 32 ms
320x568  hero      p95 59.9 fps   max 16.8 ms   0 over 32 ms
320x568  process   p95 59.5 fps   max 16.8 ms   0 over 32 ms
320x568  teardown  p95 59.5 fps   max 16.8 ms   0 over 32 ms
1280x800 hero      p95 59.9 fps   max 16.8 ms   0 over 32 ms
1280x800 process   p95 59.9 fps   max 16.8 ms   0 over 32 ms
1280x800 teardown  p95 59.5 fps   max 16.8 ms   0 over 32 ms
```

## immersive-motion-qa verdict

```
VERDICT: PASS
SIGNATURE: 1 — camera travel through a night stadium, from a seat in the stand over the advertising boards to the ball on the centre spot — Floodlights, #top (live Three.js from 1024 px; on phones and tablets the same move as category 4, a 49-frame sequence scrubbed by scroll; plus category 3, Pointer Pitch, a raw-WebGL shader lens over the Matchday calendar screenshot under the pointer or finger, #lab) — signatures-5-widths.jpg: hero start vs end at all five widths, Pointer Pitch in the last column; check-sequence.mjs PASS
MATRIX: 54/54 captured, console clean, network clean
REDUCED MOTION: static stand frame with the name fully resolved, the process as a vertical list of all four stages, the teardown as a column of captioned stills, Pointer Pitch as its still image, both videos held on their posters; every fact present (fallbacks-reduced-motion-no-webgl.jpg, top row)
NO WEBGL: phones keep the frame sequence (it needs no WebGL), desktop shows the tier-3 static frame, Pointer Pitch renders tier 2 (Canvas 2D); console clean (same file, bottom row)
NO JS: every heading, paragraph, image, table and link present; 4,776 characters of visible text (fallback-no-js-fullpage.jpg)
320px: the hero sequence scrubs from the stand to the ball, the process track slides one stage per beat, and Pointer Pitch follows a touch drag on WebGL; captured at 320 x 568 (signatures-5-widths.jpg, row 320)
```

The one console warning on the matrix is Cal.com's iframe `Permissions-Policy`
header (above). The 60 fps result is emulated at 4× CPU throttle, not
measured on a device.

## Delivery reports

### immersive-scroll-engineer

```
SCENES
  Floodlights — 3 beats x 700 = 2100px desktop, x 420 = 1260px phone, sticky stage.
    Reason: three places (stand, touchline, centre circle); a fourth beat had nothing new.
  Kickoff to Final Whistle — 4 beats x 700 = 2800px / x 420 = 1680px. Reason: one beat per stage.
  Kessel teardown — one screen of scroll per stop (10 stops: apart, 8 parts, back together), sticky stage.
BOUNDARIES
  Hero -> Work: the stage stays sticky to the end of its track and the scene keeps moving
    as Work scrolls over it (camera continuous through the hand-over).
  Process: both states inside the pin (all four stages on screen while the clock runs).
  Other section boundaries are ordinary document flow: not every boundary is a continuous transformation.
REDUCED MOTION
  Static frame + resolved name; process as a vertical list; teardown as a column of
  captioned stills; Pointer Pitch still; videos on their posters. Every fact survives
  (fallbacks-reduced-motion-no-webgl.jpg).
NO-JS
  Same content as reduced motion; verified by motion-qa no-js pass (fallback-no-js-fullpage.jpg).
320px
  Verified: hero sequence, process track (slides one stage per beat), teardown (stage above,
  caption below), Pointer Pitch (touch). No document overflow.
REAL-TIME VS PRE-RENDERED
  Floodlights: live on desktop (brief); phones pre-rendered, because scroll position alone
  decides the frame. Pointer Pitch: real time (responds to the pointer).
SEQUENCE BUDGETS
  portrait  ladder 180x320 x49 (11.3 MB); tier-540 540x960 +/-8 -> 46.5 MB; tier-720 720x1280 +/-5 -> 51.8 MB
  landscape ladder 320x180 x49 (11.3 MB); tier-960 960x540 +/-8 -> 46.5 MB; tier-1280 1280x720 +/-5 -> 51.8 MB
  All under 60 MB. check-sequence.mjs: PASS. Canvas backing store: the visible crop at frame
  resolution (444 x 960 on a 390 px phone, 1.7 MB).
UNVERIFIED
  Real hardware (mid-range Android, iOS Safari memory behaviour, real GPU frame times on the
  live desktop scene). Emulated throttled runs only.
```

### webgl-shader-interaction-engineer

```
EFFECT        An Ember lens follows the pointer or finger over the Matchday calendar screenshot
              (matchday-1.png): it magnifies, smears along the direction of travel and turns what
              it covers Ember.
TIER 1        Raw WebGL, one triangle + src/lab/pointer-pitch.js FRAG. Uniforms: uTex, uMouse,
              uAspect, uRadius, uSpeed, uDir, uActive, uEmber. The probe's tier is checked before
              anything mounts; the texture is uploaded from an ImageBitmap (no pixel read-back),
              and V is flipped in the shader because UNPACK_FLIP_Y does not apply to bitmaps.
TIER 2        Canvas 2D: the same lens radius and damping, clipped magnified redraw, smear offset,
              Ember remap via the 'color' blend. The pointer still drives it.
TIER 3        <img class="pp__still"> in the HTML unconditionally; reduced motion stays here.
PROBE         src/probe.js: constructor check, try/catch, failIfMajorPerformanceCaveat, context
              released, software renderers tiered 'low'. Silent on no-WebGL (motion-qa no-webgl pass:
              no probe errors).
BUDGET        15.5 kB gzip first load, limit 100 kB (scripts/first-load-budget.mjs).
GLSL          pointer-pitch.js FRAG, scene.js glare / beam / contact-shadow shaders: every term commented.
TRAPS         Flat-top falloff avoided (compact x^3 kernels everywhere); banding dithered in the
              glare; no procedural noise; no clamp near a normal.
CONTEXT LOSS  Force-tested with WEBGL_lose_context: Pointer Pitch drops to Canvas 2D (one canvas, no
              errors) at 1280 and 390; the hero's live canvas is removed and the static frame shows.
              No console errors.
320px         Verified with touch.
```
