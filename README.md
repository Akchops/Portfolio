# Aarav Chopra — portfolio

A one-page, scroll-driven portfolio with a case-study page (`/matchday`).
Three signature moments carry it:

1. **Floodlights** (hero). A night pitch lit only by four floodlights. Scroll
   moves the camera from a seat in the stand, over the advertising boards and
   down to the ball on the centre spot. Meanwhile the name thickens out of
   the glare, from a thin weight to a bold one. Desktop renders it live in
   Three.js. Phones scrub a pre-rendered frame sequence captured from the
   same scene.
2. **Kickoff to Final Whistle** (process). A pinned timeline. Scroll runs a
   match clock from 00:00 to 90:00 and lights Brief, Design, Build and
   Launch in turn.
3. **Pointer Pitch** (lab). An Ember lens follows the cursor or finger over a
   Matchday screenshot. It magnifies, smears along the direction of travel,
   splits colour when moving fast, and turns what it covers Ember.

The Lab also holds the Kessel Optics teardown (with a link to the live demo)
and two control experiments, Aperture and Focus. The Matchday case study
(`/matchday`) opens on the Matchday promo video and shows four app screens.
A second promo plays on the Matchday card in Work.

---

## Run and build

Requires Node 20+.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # static site in dist/
npm run preview    # serves dist/ at http://127.0.0.1:4173
npm run budget     # first-load gzip budget gate (must stay under 100 kB)
```

`dist/` is plain static files with relative URLs. It works at a domain root
or under a sub-path (for example GitHub Pages `/Portfolio/`) without changes.

### Rebuilding the generated assets

You only need these to change the 3D scene or a sourced asset. Their outputs
are committed.

```bash
python3 scripts/prepare-turf.py          # Poly Haven turf -> monochrome detail map
npm run assets                           # football.glb (meshopt + KTX2), turf.ktx2
npm run sequence                         # renders the phone frame sequences and the static frames
node scripts/check-sequence.mjs public/seq/floodlights-portrait    # memory/frame budgets
node scripts/check-sequence.mjs public/seq/floodlights-landscape
node scripts/make-placeholders.mjs       # regenerates the placeholder images
python3 -I scripts/process-videos.py <brag-vertical_1.mp4> <brag-vertical_2.mp4>
                                         # Matchday videos: redact, 720 x 1280, muted, < 3 MB, posters
```

The original Matchday videos are not in the repository: the first one's
original frames show an academy join code and under-14 players' names. Only
the redacted, compressed output in `public/media/` is committed; the
redaction boxes and how they were verified are in `scripts/process-videos.py`
and [`docs/qa/QA.md`](docs/qa/QA.md).

`npm run sequence` drives headless Chromium through `tools/capture.html`,
which mounts the same `src/hero/scene.js` the desktop runs live. The phone
frames, the static frames and the live scene therefore always match.

### QA

```bash
npm run build && npm run preview
node scripts/motion-qa.mjs http://127.0.0.1:4173/ --out qa-run    # 6 viewports x 9 depths + fallback passes
```

URL switches for testing (not linked anywhere):

| Switch | Effect |
|---|---|
| `?gl=force` | Accept a software WebGL renderer (GPU-less machines) |
| `?tier=2` | Force Pointer Pitch to its Canvas 2D tier |
| `?static` | Force every signature moment to its static tier |

---

## QA status

The full report, the motion-QA verdict and the evidence images are in
[`docs/qa/QA.md`](docs/qa/QA.md). In short:

- All three signature moments work at 320, 390, 768, 1280 and 1920 px, with
  no horizontal overflow.
- Reduced motion, no WebGL and no JS all pass: every piece of content is
  present on each path.
- First load is 15.0 kB gzip (limit 100 kB). The phone frame sequences are
  within the 60 MB memory ceiling.
- Throttled emulation holds about 60 fps (4× CPU, p95 59.9 fps, no frame
  over 32 ms). Real-device testing is still to do.
- Console and network are clean on every capture: 0 errors, 0 failed
  requests. The booking embed loads from `cal.com/aarav-orevjw`, which
  returns 200. The immersive-motion-qa verdict is **PASS**.
- Every in-page link, including "Book a call" from the case study, lands
  exactly on its section.

---

## Placeholders

Three things are placeholders or swappable. Each is replaced by swapping a
file. No code changes are needed. The Matchday videos and the Cal.com link
are supplied and final.

| # | Item | Where | How to replace |
|---|---|---|---|
| 1 | **Headshot** | `public/placeholders/headshot.svg` (neutral silhouette, 4:5) | Swap the file for the real portrait, keeping the file name and a 4:5 ratio. Then change its alt text in `index.html` from "Portrait of Aarav Chopra (placeholder)" to "Portrait of Aarav Chopra". |
| 2 | **Baxter visual** | `public/placeholders/baxter.png` (1600 × 1000, neutral) | Swap the file for a screenshot of the app with demo data only. No device names, network details, family members, phone numbers, account identifiers or home-automation details. Then update its two alt texts in `index.html`. |
| 3 | **Matchday screenshots** (replace only if the demo data changes) | `public/placeholders/matchday-1.png` (calendar), `-2` (matches list), `-3` (goalkeeper stats), `-4` (AI coach): supplied screenshots of the demo account "Alex" | Swap a file for a new screenshot of the same screen, demo account only. Never the Setup screen (date of birth) or an Academy screen (join code). If a new file's width or height differs, update that image's `width`/`height` attributes; for `matchday-1.png` also update `--pp-ar` on the Pointer Pitch stage in `index.html`. Its alt text describes what the screen shows, so update it if the content changes. |

---

## Decisions made

Defaults I chose where the brief left a gap. None changes client-facing copy,
prices, links or personal details. The copy I wrote myself is listed
separately below so it can be reviewed.

**Project and structure**

1. **Skill files.** The paths in the brief (`/mnt/skills/plugins/...`) don't
   exist in this environment. I read the same fifteen skills from where they
   are installed and followed them.
2. **One page plus one route.** Home, Work, Baxter, Process, Services,
   About, Lab and Book are sections of `index.html`, in sitemap order. I read
   "the Work page" as the Work section, since `#baxter` and `#book` are
   anchors. `/matchday` is the only separate page.
3. **Links between pages are relative** (`matchday/`, `../#book`) and the
   Vite base is relative, so the site can be hosted under any path.
4. **No framework.** Vanilla JS and CSS keep the eager script at 1.7 kB gzip.
   Three.js loads only on desktop's live hero tier. GSAP and ScrollTrigger load
   only for the Process section. Lenis is not used; scroll stays native.
5. **Fonts are self-hosted** from Fontsource: latin subset, weight axis only,
   two of them preloaded.
6. **Network access.** The sandbox's network policy blocked Poly Haven and the
   four external links. I added those hosts to the environment allowlist (you
   approved the change), so assets could be sourced and links tested.

**Floodlights (hero)**

7. **"No new 3D rendering. Source assets only."** I read this as: model
   nothing and use sourced assets. The ball (Poly Haven, CC0) and the turf
   texture (Poly Haven, CC0) are sourced. The pitch, line markings, stands,
   boards, goals and masts are layout geometry placed in code: planes,
   boxes and cylinders at stadium dimensions. The phone frame sequence and
   the static frame are captures of that same scene, not a separate render.
   If you meant something stricter, say so.
8. **What counts as "mobile".** Viewports under 1024 px, or any coarse
   pointer, get the frame sequence. Wider screens with a fine pointer get
   live Three.js, but only if the silent WebGL probe passes and the GPU is
   not a software renderer. Otherwise they get the static frame. Reduced
   motion always gets the static frame.
9. **The static frame is the first frame,** the view from the stand. It is
   the most legible view (pitch, stands and lights), and because it is
   identical to frame 0 of every tier, the hand-over is invisible.
10. **"The name resolves out of the glare"** is a scroll-scrubbed
    variable-font weight (260 → 720) with letter-spacing closing up, while
    the floodlight glare burns down. The name is never hidden or blurred; it
    is legible at its thinnest. Reduced motion and no-JS show the resolved
    weight.
11. **Glare and light shafts** are lighting inside the 3D scene. I applied
    the "no gradients, no neon glow" rule to the UI and CSS, which have
    neither.
12. **Lighting.** Each of the four lamp heads has one spotlight on the pitch
    and one on the stand beneath it. They are the only light sources.
    Shadow maps are off: at stadium scale they give a 22 cm ball about two
    texels. The ball gets four soft contact shadows instead, one thrown away
    from each tower.
13. **Turf is desaturated** to warm greys, so the scene sits inside the
    palette with no extra hue.
14. **Scrub distance** is 3 beats: 2100 px desktop, 1260 px phone. The
    reasons are in `src/hero/boot.js`. The height is reserved in CSS, so
    the page never shifts when the scene loads.
15. **Sequence budget.** 49 frames per orientation (portrait 720 × 1280,
    landscape 1280 × 720), two tiers each, plus a small always-resident
    ladder. Peak decoded memory is 46.5–51.8 MB, under the 60 MB mobile
    ceiling. Verified by `scripts/check-sequence.mjs`.
16. **The positioning line sits on a solid Ink plate,** like a broadcast
    lower third. Over the brightest frames the bare text measured 2.8:1.
    On the plate it is 16:1.
17. **The masthead is a solid Ink bar** over the hero too. Floodlight glare
    passes behind it in some frames and would wash out the navigation.

**Process**

18. **The clock shows match time,** mm:ss from 00:00 to 90:00. It is
    decorative (`aria-hidden`). Stages light at 0', 22:30, 45' and 67:30. I
    show no minute labels, so nothing reads as a project duration. Stages
    are numbered 01–04.
19. **On phones the horizontal track slides one stage per beat;** on wide
    screens all four stages fit. Scrub distance is 4 beats.

**Work, Services, About**

20. **Card lines.** The Matchday card keeps the line it had, taken from
    the case-study title: "A football tracker built around the player's
    position." The brief gives no line for the Kessel card; it carries the
    "Concept demo · fictional brand" label and the "View the live demo"
    link.
21. **The Prayatn card has no image.** None was supplied, and I didn't
    screenshot a charity site that may show real people, including children.
    The visible link `prayatnonline.org` is the real link (new tab,
    `noopener noreferrer`), and it also covers the whole card.
22. **The mobile sticky CTA is the hero's "Book a call" itself,** fixed to
    the bottom as a centred pill. A full-width bar put Ember over 5% of a
    390 px screen. It tucks away while the Book section is on screen.
23. **Smoke is never used for text on Ash** (4.37:1, under AA). Labels on Ash
    cards use Bone. Smoke text appears only on Ink (4.86:1).

**Lab**

24. **Kessel content** (name, lens names, specifications, dates, contact
    details) comes from the Kessel concept in your Akchops/orrin repository.
    It is labelled throughout as sample content for a fictional brand. The
    part captions are that concept's own short captions. The stills are its
    renders, kept in their original colour as that brand's art direction. No
    code was copied: the teardown, aperture and focus interactions are
    rebuilt from the pattern.
25. **The Kessel contact details are plain text,** not links, and are
    labelled as not real.
26. **The teardown** follows Orrin's pattern: a sticky stage, one screen of
    scroll per stop, the caption beside the stage (below it on phones), a
    "where the camera is" map, and numbered part buttons that scroll to a
    part. The camera flies along the exploded still and holds at each part
    while its close-up fades in.
27. **The Aperture and Focus scenes are my own illustrations.** The Focus
    subjects are football-themed (ball 1.2 m, goal 5 m, floodlight ∞). Their
    blur follows real defocus maths for a 50 mm lens at T2.1.
28. **Pointer Pitch under reduced motion shows the still image.** A
    pointer-driven surface distortion is the kind of movement that setting
    asks to remove. On touch the stage takes the finger directly
    (`touch-action: none`) and is capped at 62% of the screen height, so
    there is room to scroll beside it.
29. **Pointer Pitch uploads `matchday-1.png` as an `ImageBitmap`,** decoded
    off the main thread, with no pixel read-back. A bitmap ignores WebGL's
    flip-on-upload flag, so the texture goes up unflipped on every path
    (bitmap or the `<img>` fallback) and the shader flips V when it samples.
    The WebGL tier is checked before mounting, as in the hero; a software
    renderer gets the Canvas 2D tier.
30. **"View the live demo"** (`akchops.github.io/orrin`, new tab) sits under
    the teardown's heading and on the Kessel card. On the card it is lifted
    above the card's own link, so it opens the demo instead of scrolling to
    the teardown. "Concept demo · fictional brand" stays visible in both
    places.

**Matchday media**

31. **Video 1 is redacted, as you chose.** Its original frames show an
    Academy screen with its join code (about 8–10 s), and under-14 players'
    names with ratings (about 10–18 s). The published file keeps all 24.5 s
    and blurs the join code, every player name, the coaches' handles and the
    Setup screen whenever they are on screen. The demo account and the
    consent card about it stay sharp, as do team names. The blur boxes are
    in `scripts/process-videos.py`. How they were verified is in
    `docs/qa/QA.md`: OCR on every frame, a sharpness measure on every located
    name, and a by-eye review of every transition. Neither the code nor any
    name appears anywhere in the repository.
32. **Both videos are 720 × 1280 H.264, audio removed,** two-pass at about
    880 kb/s (2.8 MB each), with fast start so playback can begin early.
    Posters: video 1 at 6.2 s ("Every match, rated for your position."),
    video 2 at 2.7 s. The KEEPERS wordmark is fully drawn from 2.2 s to
    3.1 s; 2.7 s is the middle of that hold.
33. **The Work card video plays when the card is in view** (60% visible),
    pauses when it leaves, rests on its end card when it finishes, and
    replays the next time the card comes into view. It never loops on its
    own, keeping to "no decorative looping". Reduced motion keeps the poster.
    Nothing downloads until it first plays.
34. **The case-study hero autoplays, muted and looping,** as the brief asks,
    and pauses while scrolled off screen. Its `autoplay` attribute is in the
    HTML, so it also plays without JavaScript. For reduced motion, a short
    inline script right after the element removes autoplay before playback
    can start and shows controls over the still poster.
35. **One phone frame for all Matchday media:** an Ink bezel with an Ash
    outline, so it reads on an Ash card and on the Ink page. Matchday's own
    colours stay inside the screen.
36. **Every in-page link lands 64 px from the top,** directly under the
    masthead. The Baxter and Kessel sections had extra scroll margins from
    the first build; I removed them so every route matches.

**Booking**

37. **Cal.com is an inline embed** (dark theme, Ember brand colour), loaded
    only as the Book section approaches. "Email to book" is visible until
    Cal.com reports the page ready. If the page fails, or isn't ready within
    8 s, the embed is removed and the email button stays.
38. **In-page links settle before they scroll.** The process and teardown
    sections grow when they lazily mount, and a GSAP ScrollTrigger refresh
    cancels a smooth scroll. So an in-page link (or a load arriving with a
    hash, like the case study's `../#book`) first mounts those modules
    above its target, then scrolls, and re-aligns once if anything moved.
    Focus moves to the target.
39. **`og:image` is a relative path.** Set it to an absolute URL once the
    domain is known.

### Copy I wrote (please review)

Everything below is mine, not from the brief:

- Page titles "Aarav Chopra · Digital services" and "Matchday · Aarav Chopra".
  The meta descriptions reuse the brief's lines.
- Navigation and UI: "Menu", "Skip to content", the nav labels (Work,
  Process, Services, About, Lab), and section eyebrows "01 Work" to "06 Book".
- Section titles "Work", "Services", "About" and "Lab".
- Lab labels: "Shader experiment", "Control experiment", the hint "Move across
  the screenshot. On a phone, drag a finger over it.", control labels "Iris"
  and "Focus distance", and the chips "Ball 1.2 m", "Goal 5.0 m" and
  "Floodlight ∞".
- Kessel framing: "Kessel Optics is a fictional brand. Every name, figure,
  date and contact detail below is sample content for the concept.", headings
  "The three lenses", "Dates" and "Contact", and the sample notes under each.
- Matchday page headings "What each position scores", "Screens", "Features",
  "The build" and "Status", plus the table header "Scored on". The video
  descriptions read by screen readers (`aria-label` on both videos). The build facts are split
  into tiles that keep the brief's qualifiers ("About 10 weeks of build",
  "Roughly 27,000 lines of TypeScript").
- All alt text.

---

## Accessibility

- All content is in the DOM and readable without JavaScript. Hiding is only
  ever applied under the `.js` / `.motion` classes set in `<head>`.
- Keyboard: a skip link, native controls (range inputs, buttons, links), and
  an Ember focus ring on everything (`:focus-visible`).
- Decorative canvases and the 3D scene are `aria-hidden`. Every image has
  alt text.
- Contrast: Bone on Ink 16.0:1, Bone on Ash 14.4:1, Smoke on Ink 4.86:1,
  Ember on Ink 5.9:1, Ink on Ember 5.9:1. Smoke on Ash (4.37:1) and Bone
  on Ember (2.72:1) are never used for text.
- `prefers-reduced-motion`: all content stays. The hero shows the static
  frame, the process becomes a vertical list, the teardown becomes a column
  of stills with captions, Pointer Pitch shows the still, and colour
  feedback remains.
