# ONE PIECE Home footer revision 3 — Blind QA / TPP

## Verdict

**PASS**

The two user-reported blockers are closed in the live Demo: the footer uses the official wave image asset instead of a gradient/poster background, and the six-state motion sequence is visibly present with the required finite/loop/pause semantics. No scroll regression or typography-role misuse was observed.

## Blind boundary

This assessment used only the requested source set and the live Demo:

- `footer-motion-evidence-v10.json`
- `home-live-dom-evidence.json`
- `brand-evidence.json`
- `brand-intent.json`
- `approved-visual-patterns.json`
- `visual-pattern-inventory.json`
- `demo-screenshot-manifest.json`
- official v10 footer captures under `output/visual-qa/onepiece-cardgame/evidence-v10/footer-organism/`
- `http://127.0.0.1:5177/#/brand/onepiece-cardgame/pages/onepiece-cardgame-home`

No implementation-agent messages, self-checks, handoff receipts, earlier QA reports or earlier QA verdicts were used. Goal/Evidence/Intent/Demo were not modified.

## Three-proof result

| Proof | Result | Independent observation |
|---|---|---|
| Evidence fidelity | PASS | The live wave layer resolves to `/assets/brand-assets/onepiece-cardgame/source/footer/background-wave.webp`; computed `backgroundImage` is a URL and contains no gradient. Luffy, finite composite, three distinct cards, catch and logo are all separate semantic layers with non-zero geometry. All five requested font-resource checks return true. |
| Structural fidelity | PASS | The live organism is a wide 2.313:1 composition, not a vertical poster. Normalized geometry preserves the official hierarchy: wave overscan ≈1.125×, Luffy left width ≈0.5469×, card01 is the largest far-right card, card02/card03 occupy center-right, catch is above the lower-right logo, and the navy structural footer follows below. Source-aligned settled/late/paused screenshots are visually close to the official v10 composition and crop. |
| Generative / interaction proof | PASS | The one-shot `fadein → is-in` reveal persists. At 120ms only the wave begins (background opacity ≈0.033, character/catch/logo 0); at 500ms the wave and Luffy are entering (≈0.462/≈0.733, catch/logo still 0). The finite bridge is exactly `0.6s, 0.8s` and reaches opacity 0. Card loops are exactly `5s, 8s, 8s`, infinite, and settled/late transforms differ. Pause changes only the three loops to `paused`; all three transforms remain byte-identical after 1200ms while background/character/catch/logo remain settled at opacity 1. |

## Six-state screenshot review

The in-app Browser exposed an actual 1164×655 surface despite requesting the official 1280×720 baseline. Demo captures were therefore resampled without crop to 1280×720 for a same-aspect normalized comparison. A second source-aligned run positioned the footer at the same normalized vertical stage used by the official 120ms/500ms captures.

| State | Official v10 | Live Demo observation | Result |
|---|---|---|---|
| default / pre-entry | Footer remains below the viewport | `fadein` only; all reveal layers opacity 0; preceding content visible | PASS |
| 120ms | Background begins; character/type absent | Wave faintly enters; character/catch/logo remain absent | PASS |
| 500ms | Luffy/yellow energy enters; catch/logo delayed | Luffy and wave visibly enter in the source-aligned frame; catch/logo remain 0 | PASS |
| settled | Full layered organism | Full wave/Luffy/three-card/catch/logo hierarchy; finite composite 0 | PASS |
| late | Same hierarchy with changed card poses | All three card transforms differ from settled; other layers stay settled | PASS |
| paused | Full organism; loop control paused | Three loops paused and frozen for 1200ms; reveal layers unaffected | PASS |

Comparison artifact: `comparisons/source-vs-demo-six-states.svg`

Individual comparisons: `comparisons/default-pre-entry.svg`, `comparisons/120ms.svg`, `comparisons/500ms.svg`, `comparisons/settled.svg`, `comparisons/late.svg`, `comparisons/paused.svg`.

## Required checks

### Official wave image, not gradient

- Node: `.footerIllustBg .showItem`
- Asset: `background-wave.webp`
- Computed size/position: `auto 100%`, `0% 100%`
- Computed `isGradient`: `false`
- Normalized wave width: `1.12499`; edge-spanning overscan is preserved.

### Position, crop, proportion and layer order

- Organism aspect: `269.56 / 116.52 = 2.3134`, wide banner form.
- Luffy normalized width: `0.54687`, left bleed `-0.02967`, full-height dominant mass.
- Wave normalized width: `1.12499` with only outer overscan crop.
- Card hierarchy: card01 largest/far right; card02 and card03 smaller across center-right.
- Catch normalized x ≈`0.774`, logo normalized x ≈`0.527`; catch remains above logo.
- Assets are independent layers; the organism is not flattened into a single raster or stretched into a vertical poster.

### Motion timing and control

- Background reveal: finite `2s`.
- Character reveal: finite `0.8s`.
- Catch/logo reveal: finite `0.5s` / `0.3s` with delayed visibility matching the official sequence.
- Composite: `opcg-footer-in-card, opcg-footer-in-item`, `0.6s, 0.8s`, `1,1`; terminal opacity `0`.
- Cards: `5s,8s,8s`, all `infinite`.
- Pause: class becomes `loops-paused`; card loop play states become `paused`; background/character/catch/logo remain opacity 1.

### Typography roles

- Display titles use `OPCG Alfa Slab One`, weight 400.
- Long article titles use `OPCG Poppins`, weight 700.
- Body/utility copy remains Poppins-family.
- `document.fonts.check` is true for Alfa Slab One 400, Poppins 400/700, Noto Serif 700 and Oswald 700.

### Scroll regression

- Inner phone scroll moved from max `2302.73` to `1402.73` and back to max.
- `scrollLeft` remained 0; outer document `scrollTop` remained 0.
- `is-in` persisted through the round trip.
- No console warnings or errors were recorded.

## Artifacts

- `browser-probes.json` — raw timing, geometry, assets, typography and scroll probes.
- `captures/` — source-aligned raw captures and 1280×720 normalized Demo captures.
- `comparisons/` — six individual source/Demo comparisons and one combined six-state comparison.
- `blind-qa-receipt-revision-3-agent3.json` — signed artifact inventory and hashes.
