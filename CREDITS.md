# Credits

Every third-party asset, font and library shipped in this site, with its licence.

## 3D and texture assets (Floodlights hero)

| Asset | Source | Author | Licence | Used as |
|---|---|---|---|---|
| Football | [polyhaven.com/a/football](https://polyhaven.com/a/football) | Amal Kumar | CC0 1.0 | The ball on the centre spot. Inflated variant only; geometry meshopt-compressed, textures KTX2 (`public/models/football.glb`, built by `scripts/build-assets.mjs`). |
| Grass Ground | [polyhaven.com/a/grass_ground](https://polyhaven.com/a/grass_ground) | Charlotte Baglioni | CC0 1.0 | Turf detail map: desaturated and contrast-reduced (`scripts/prepare-turf.py`), then KTX2 (`public/textures/turf.ktx2`). |

Poly Haven assets are CC0: no attribution is required. It is given here anyway.

Everything else in the scene (pitch plane, line markings drawn to the Laws of
the Game, stands, advertising boards, goals, floodlight masts and lamp banks)
is layout geometry generated in code in `src/hero/scene.js`. No model was
authored or downloaded for it. The phone frame sequence and the static frame
in `public/seq/` are captured from that same scene by
`scripts/render-sequence.mjs`.

No Sketchfab assets are used.

## Kessel Optics stills

`public/kessel/*.webp` are renders from the Kessel Optics concept in the
author's own repository, [Akchops/orrin](https://github.com/Akchops/orrin)
(`kessel/stills/`). They are reused as images only. No code from that
repository is used: the teardown, aperture and focus interactions here are
rebuilt from a description of its layout and interaction patterns. Kessel
Optics is a fictional brand and is labelled as one on the page.

## Matchday media

| Asset | Source | Used as |
|---|---|---|
| `public/media/matchday-brag-1.mp4` and `.jpg` poster | Matchday promo video supplied by Aarav Chopra | Case-study hero. Re-encoded to 720 × 1280 with audio removed; the Academy join code, players' names, coaches' handles and the Setup screen are blurred (`scripts/process-videos.py`). |
| `public/media/matchday-brag-2.mp4` and `.jpg` poster | Matchday promo video supplied by Aarav Chopra | Work card. Re-encoded to 720 × 1280 with audio removed. |
| `public/placeholders/matchday-1.png` to `-4.png` | Matchday screenshots of the demo account, supplied by Aarav Chopra | Case-study gallery; screenshot 1 is also the Pointer Pitch surface. |

## Fonts

All three are self-hosted from [Fontsource](https://fontsource.org) packages
(latin subset, weight axis only), under the SIL Open Font License 1.1.

| Font | Designer | Licence |
|---|---|---|
| Bricolage Grotesque | Mathieu Triay (The Bricolage Grotesque Project Authors) | OFL 1.1 |
| Inter | Rasmus Andersson | OFL 1.1 |
| JetBrains Mono | JetBrains | OFL 1.1 |

## Libraries

| Library | Licence | Loaded |
|---|---|---|
| [three.js](https://threejs.org) r187, incl. GLTFLoader, KTX2Loader | MIT | Lazily, desktop live tier only |
| meshoptimizer decoder (bundled with three.js) | MIT | With three.js |
| Basis Universal transcoder (bundled with three.js) | Apache 2.0 | With three.js |
| [GSAP](https://gsap.com) 3.15 + ScrollTrigger | GSAP Standard License (no-charge) | Lazily, when the Process section approaches |
| [Cal.com embed](https://cal.com/docs/embed) | Cal.com terms | Lazily, when the Book section approaches |

Build-only tools (not shipped): Vite (MIT), glTF Transform (MIT),
meshoptimizer (MIT), ktx2-encoder (MIT, Basis Universal Apache 2.0),
jpeg-js (BSD-3-Clause), pngjs (MIT), Pillow, Playwright (Apache 2.0).
