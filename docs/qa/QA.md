# QA report

Run against the production build (`npm run build && npm run preview`) in a
GPU-less Linux container with headless Chromium. Evidence images are in this
folder.

## Gates

| Gate | Result | Evidence |
|---|---|---|
| Signature moments at 320, 390, 768, 1280, 1920 px | **Verified.** Hero, Process and Pointer Pitch work at every width. 320–768 use the frame sequence; 1280 and 1920 run the live Three.js scene (SwiftShader, `?gl=force`). Pointer Pitch runs WebGL at every width, tested with touch below 1024 px and mouse above. No horizontal overflow at any width (`scrollWidth` equals the viewport width). | `signatures-5-widths.jpg` (per row: hero start, hero end, process mid-scrub, Pointer Pitch under the pointer) |
| Console and network clean | **Not met, for one external reason.** Zero page errors. Every console error and failed request is the same: `app.cal.com/aaravchopra/embed…` returns 404, because `cal.com/aaravchopra` does not exist on Cal.com yet. The only warning is Cal.com's own `Permissions-Policy` header. Nothing else errors. | `motion-qa.mjs` report: 54/54 captured, 8 console errors, 8 failed requests, all that one URL |
| Reduced motion | **Pass.** The static stand frame with the name fully resolved; the process as a vertical list; the teardown as a column of stills with every caption; Pointer Pitch as the still image. No content lost. | `fallbacks-reduced-motion-no-webgl.jpg` (top row) |
| No WebGL | **Pass.** Phones keep the frame sequence, which needs no WebGL. Desktop shows the static frame. Pointer Pitch drops to Canvas 2D. No console errors from the probe. | same file, bottom row |
| No JS | **Pass.** Every heading, paragraph, image, table and link is present; nothing is blank. Visible text is 4,696 characters, against 4,684 with JS. | `fallback-no-js-fullpage.jpg` |
| External links | prayatnonline.org **200**. akchops.github.io/football-app **200**. akchops.github.io/orrin **200** (tested; the site does not link to it, see the open questions in the README). cal.com/aaravchopra **404**. In the browser, the Prayatn visible link and the card body both open prayatnonline.org in a new tab with no `window.opener`. The football-app link opens in a new tab with `noopener noreferrer`. | — |
| First-load budget | **14.2 kB gzip** (limit 100 kB): HTML 6.4, CSS 6.1, JS 1.7. Three.js (193 kB gzip) and GSAP + ScrollTrigger (45 kB) are code-split and lazy. | `npm run budget` |
| 60 fps, mid-range Android | **Emulated pass, real hardware not tested.** At 4× CPU throttling, 390 and 320 px phone emulation, scrolling at 1.5 px/ms: hero, process and teardown all hold p95 59.9 fps, with no frame over 32 ms. This measures main-thread frame production; it is not a substitute for a real device. | `perf` run, below |
| glTF / textures | Ball: meshopt (`EXT_meshopt_compression`) + KTX2 (`KHR_texture_basisu`). Turf: KTX2. | `scripts/build-assets.mjs` |
| Contrast | Bone/Ink 16.0, Bone/Ash 14.4, Smoke/Ink 4.86, Ember/Ink 5.9, Ink/Ember 5.9. Smoke on Ash (4.37) is not used for text. Hero name over the scene: worst 3.51:1 (large text, needs 3:1). Hero line: on an Ink plate, 16:1. | measured from renders |

## immersive-motion-qa verdict

```
VERDICT: FAIL
SIGNATURE: none
REASON: The matrix is not clean. 8 console errors and 8 failed requests across the 54 captures and fallback passes, every one of them https://app.cal.com/aaravchopra/embed (HTTP 404): the Cal.com username in the brief does not exist. The signature checks themselves are met: category 1, camera travel from the stand to the centre circle (Floodlights, #top); category 4, a scroll-scrubbed 49-frame sequence on phones (#top, 320 to 768 px); category 3, a shader pointer distortion (Pointer Pitch, #lab), verified at 320 px.
EVIDENCE: qa-run/report.json from motion-qa.mjs on the production build: 54/54 captured, 0 page errors; failedRequests and consoleErrors contain only the Cal.com 404. signatures-5-widths.jpg.
REQUIRED TO PASS: A Cal.com booking page that exists at cal.com/aaravchopra (or the correct username in src/book.js), then a re-run of scripts/motion-qa.mjs.
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
BUDGET        14.2 kB gzip first load, limit 100 kB (scripts/first-load-budget.mjs).
GLSL          pointer-pitch.js FRAG, scene.js glare / beam / contact-shadow shaders: every term commented.
TRAPS         Flat-top falloff avoided (compact x^3 kernels everywhere); banding dithered in the
              glare; no procedural noise; no clamp near a normal.
CONTEXT LOSS  Force-tested with WEBGL_lose_context: Pointer Pitch drops to Canvas 2D (one canvas, no
              errors); the hero's live canvas is removed and the static frame shows. No console errors.
320px         Verified with touch.
```
