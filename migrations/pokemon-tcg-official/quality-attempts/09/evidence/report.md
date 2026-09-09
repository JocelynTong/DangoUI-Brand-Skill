# Pokémon TCG Live section — screenshot-first Evidence report

## Verdict

**PASS_WITH_WARNINGS.** The section is sufficiently evidenced for Interpreter handoff. No required structural, asset, responsive, CTA, or entry-motion claim is unresolved.

The most important correction is that this is **not a solid-red section**. The red area is only the top chevron embedded in the `tcgl-background` raster. The dominant field is a pale gray honeycomb texture; the text sits on a black panel.

## What is actually visible

- Desktop 1440: full-bleed `1440 × 624`; left `696 × 316.5` translucent-black copy panel; right `778 × 538` layered device/character composition.
- Mobile 390: full-bleed `390 × 644.625`; device composition comes first, followed by a full-width opaque-black copy panel.
- Visible copy structure: H2 + one paragraph + one CTA. **No kicker.**
- Five separate assets: laptop, Pikachu, phone, avatar 1, avatar 2. Preserve their identities and overlap; do not flatten them into one screenshot.
- The gray honeycomb, red/gold top seam, and section field are one background image family: `tcgl-background.jpg` / `tcgl-background-2x.jpg`.
- Lower boundary is a hard transition into the pale-blue Pokémon TCG Pocket section.

## Type and control geometry

| Element | Desktop | Mobile 390 |
|---|---:|---:|
| H2 | Kanit 700, `40/44`, letter-spacing `1.25px` | Kanit 700, `28/30.8`, letter-spacing `~1px` |
| Body | PT Sans 400, `18/28.8` | PT Sans 400, `18/28.8` |
| CTA | PT Sans 700, `20/24`, `56px` high | PT Sans 700, `18/22.5`, `51.297px` high |
| Copy panel | rgba black `.7`, padding `50px 72px` | opaque black, padding `30px` |

CTA hover was observed: text/icon `rgb(0,0,0)` → gold `rgb(226,186,101)` while the white background remains white. Click navigates to `/en-us/tcgl/`.

## Motion

Viewport entry is a staggered child reveal:

- laptop: `opacity 0 + scale(.5)` → `opacity 1 + scale(1)`;
- heading: `opacity 0 + translateY(15.398px)` → settled;
- paragraph and CTA: the same slide family with delayed classes;
- Pikachu, phone, and avatars carry `vp-delay-2/4/5/6` stagger classes.

Directly jumping to the section can miss the viewport-controller initialization. Evidence was therefore collected by incremental scrolling. No background movement was observed.

## Visual proof

- Desktop stable structure: `captures/tcg-live-desktop-1440x1000-stable.png`
- Mobile full section: `captures/tcg-live-mobile-390x844-stable.png`
- Before entry: `captures/tcg-live-mobile-motion-before.png`
- Transition: `captures/tcg-live-mobile-motion-transition-250ms.png`
- Settled: `captures/tcg-live-mobile-motion-settled.png`

## Warning about translated captures

Chrome automatically translated the stable screenshot copy after the English page had loaded. Therefore:

- screenshots are authoritative for composition, asset overlap, background, seams, and responsive ordering;
- the recorded pre-translation English DOM/computed snapshot is authoritative for English text and geometry;
- translated wrapping must not be copied into the Demo.

## Interpreter handoff constraints

1. Do not interpret the top red chevron as a red section background or a generic red action color.
2. Do not add a kicker.
3. Do not substitute a single composite screenshot for the five assets.
4. Preserve mobile reordering: assets first, copy panel second.
5. Preserve the viewport-entry motion family, but do not claim background motion.
