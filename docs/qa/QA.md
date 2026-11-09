# QA report

Run against the production build (`npm run build && npm run preview`) in a
GPU-less Linux container with headless Chromium. Evidence images are in this
folder.

## Gates

| Gate | Result | Evidence |
|---|---|---|
| Signature moments at 320, 390, 768, 1280, 1920 px | **Verified.** Hero, Process and Pointer Pitch work at every width. 320–768 use the frame sequence; 1280 and 1920 run the live Three.js scene (SwiftShader, `?gl=force`). Pointer Pitch runs WebGL at every width, tested with touch below 1024 px and mouse above. No horizontal overflow at any width (`scrollWidth` equals the viewport width). | `signatures-5-widths.jpg` (per row: hero start, hero end, process mid-scrub, Pointer Pitch under the pointer) |
| Console and network clean | **Pass.** 0 console errors, 0 page errors, 0 failed requests across all 54 captures and the three fallback passes. The only warning is Cal.com's own `Permissions-Policy` header ("Unrecognized feature: 'bluetooth'"), sent from inside its booking iframe. It is not ours and not an error. | `motion-qa.mjs` report: 54/54 captured, exit 0 |
| Reduced motion | **Pass.** The static stand frame with the name fully resolved; the process as a vertical list; the teardown as a column of stills with every caption; Pointer Pitch as the still image. No content lost. | `fallbacks-reduced-motion-no-webgl.jpg` (top row) |
| No WebGL | **Pass.** Phones keep the frame sequence, which needs no WebGL. Desktop shows the static frame. Pointer Pitch drops to Canvas 2D. No console errors from the probe. | same file, bottom row |
| No JS | **Pass.** Every heading, paragraph, image, table and link is present; nothing is blank. Visible text is 4,696 characters, against 4,684 with JS. | `fallback-no-js-fullpage.jpg` |
| External links | cal.com/aarav-orevjw **200**: it redirects to its 30-minute event, the embed URL `app.cal.com/aarav-orevjw/embed` returns 200 too, and in the browser the inline embed reports ready in ~5 s at 1280 and 390 px, after which the "Email to book" fallback steps aside. prayatnonline.org **200**. akchops.github.io/football-app **200**. akchops.github.io/orrin **200** (tested; the site does not link to it, see the open question in the README). In the browser, the Prayatn visible link and the card body both open prayatnonline.org in a new tab with no `window.opener`. The football-app link opens in a new tab with `noopener noreferrer`. | — |
| In-page navigation | **Pass.** "Book a call" (masthead, hero, phone sticky CTA), the nav and footer links, the Work cards and the case study's cross-page "Book a call" (`../#book`) all land exactly on their section under the masthead, at 1280, 1920 and 390 px and with reduced motion. Scrolling starts ~0.2 s after the click. Focus moves to the target. | `main.js` in-page links |
| First-load budget | **15.0 kB gzip** (limit 100 kB): HTML 6.4, CSS 6.2, JS 2.4. Three.js (193 kB gzip) and GSAP + ScrollTrigger (45 kB) are code-split and lazy. | `npm run budget` |
| 60 fps, mid-range Android | **Emulated pass, real hardware not tested.** At 4× CPU throttling, 390 and 320 px phone emulation, scrolling at 1.5 px/ms: hero, process and teardown all hold p95 59.9 fps, with no frame over 32 ms. This measures main-thread frame production; it is not a substitute for a real device. | `perf` run, below |
| glTF / textures | Ball: meshopt (`EXT_meshopt_compression`) + KTX2 (`KHR_texture_basisu`). Turf: KTX2. | `scripts/build-assets.mjs` |
| Contrast | Bone/Ink 16.0, Bone/Ash 14.4, Smoke/Ink 4.86, Ember/Ink 5.9, Ink/Ember 5.9. Smoke on Ash (4.37) is not used for text. Hero name over the scene: worst 3.51:1 (large text, needs 3:1). Hero line: on an Ink plate, 16:1. | measured from renders |

## immersive-motion-qa verdict

```
VERDICT: PASS
SIGNATURE: 1 — camera travel through a night stadium, from a seat in the stand over the advertising boards to the ball on the centre spot — Floodlights, #top (live Three.js from 1024 px; on phones and tablets the same move as category 4, a 49-frame sequence scrubbed by scroll; plus category 3, Pointer Pitch, a raw-WebGL shader lens under the pointer or finger, #lab) — signatures-5-widths.jpg: hero start vs end at all five widths, Pointer Pitch in the last column; check-sequence.mjs PASS
MATRIX: 54/54 captured, console clean, network clean
REDUCED MOTION: static stand frame with the name fully resolved, the process as a vertical list of all four stages, the teardown as a column of captioned stills, Pointer Pitch as its still image; every fact present (fallbacks-reduced-motion-no-webgl.jpg, top row)
NO WEBGL: phones keep the frame sequence (it needs no WebGL), desktop shows the tier-3 static frame, Pointer Pitch renders tier 2 (Canvas 2D); console clean (same file, bottom row)
NO JS: every heading, paragraph, image, table and link present; 4,696 characters of visible text (fallback-no-js-fullpage.jpg)
320px: the hero sequence scrubs from the stand to the ball, the process track slides one stage per beat, and Pointer Pitch follows a touch drag on WebGL; captured at 320 x 568 (signatures-5-widths.jpg, row 320)
```

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
  captioned stills; Pointer Pitch still. Every fact survives (fallbacks-reduced-motion-no-webgl.jpg).
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
  All under 60 MB. check-sequence.mjs: PASS.
UNVERIFIED
  Real hardware (mid-range Android, iOS Safari memory behaviour, real GPU frame times on the
  live desktop scene). Emulated throttled runs only.
```

### webgl-shader-interaction-engineer

```
EFFECT        An Ember lens follows the pointer or finger over a Matchday screenshot: it magnifies,
              smears along the direction of travel and turns what it covers Ember.
TIER 1        Raw WebGL, one triangle + src/lab/pointer-pitch.js FRAG. Uniforms: uTex, uMouse,
              uAspect, uRadius, uSpeed, uDir, uActive, uEmber.
TIER 2        Canvas 2D: the same lens radius and damping, clipped magnified redraw, smear offset,
              Ember remap via the 'color' blend. The pointer still drives it.
TIER 3        <img class="pp__still"> in the HTML unconditionally; reduced motion stays here.
PROBE         src/probe.js: constructor check, try/catch, failIfMajorPerformanceCaveat, context
              released, software renderers tiered 'low'. Silent on no-WebGL (motion-qa no-webgl pass:
              no probe errors).
BUDGET        15.0 kB gzip first load, limit 100 kB (scripts/first-load-budget.mjs).
GLSL          pointer-pitch.js FRAG, scene.js glare / beam / contact-shadow shaders: every term commented.
TRAPS         Flat-top falloff avoided (compact x^3 kernels everywhere); banding dithered in the
              glare; no procedural noise; no clamp near a normal.
CONTEXT LOSS  Force-tested with WEBGL_lose_context: Pointer Pitch drops to Canvas 2D (one canvas, no
              errors); the hero's live canvas is removed and the static frame shows. No console errors.
320px         Verified with touch.
```
