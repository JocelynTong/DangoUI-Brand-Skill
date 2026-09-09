# Pokémon TCG Official Home Hero — Blind QA Attempt 04

Verdict: **REWORK**

Attempt 04 corrects the main mobile strategy: the default `390×844` view now uses the official mobile artwork, a tall art-directed crop, a separately rendered campaign mark and a readable card. That improvement is real, but the Hero cannot be approved because the visible interaction states and desktop proof surface are broken.

## What passed

- Default mobile composition uses `booster-art-1.jpg`, not a screenshot or the desktop raster.
- Mobile Hero height is approximately `1183px`, inside the sealed `900–1280px` range.
- Navigation, artwork, campaign mark, featured card, CTA and carousel controls exist in the default mobile state.
- The mobile CTA is approximately `56px` high.
- The phone screen has no horizontal scroll overflow.
- The following section begins directly after the Hero and is reachable.
- Phone scrolling changed `0 → 780 → 0`.
- The carousel active index changes `0 → 1 → 0`.
- No runtime console errors were observed.

## Blocking failures

1. **The mobile carousel's second state loses the campaign mark and featured card.** After activating “Show campaign 2”, the Hero contains only the site logo and background image; the separate campaign-title and card image nodes are absent. The active index changes, but the required visual state does not survive the interaction. A reversible index alone is not interaction truth.
2. **Mobile carousel controls are visibly broken.** The active control is a white `56×56` block whose text is transparent; the inactive control is a black block with transparent text. The official mobile source shows simple readable left/right arrows on the black stage. The current left control appears as an unexplained blank white rectangle.
3. **The CTA does not reproduce the official control language.** The source CTA is a rounded white button with a gold outline, dark italic label and arrow. The Demo CTA is a flat square white plate with no border or radius, and visually merges into the following white section. This is a high-salience control mismatch.
4. **Desktop regression fails in the actual product proof surface.** At a `1440×1000` browser viewport the Demo remains inside a roughly `347px` phone screen while desktop media-query styling activates. Navigation is clipped, campaign title/card/CTA overlap, controls become `42px` high, the active control is white-on-white, and the Hero reports `scrollWidth 506 > clientWidth 347`. The standalone desktop crop does not represent the page users actually review.

The earliest failing node is **Demo Implementation**. Evidence correctly describes the official mobile art direction and separate layers; the implementation fails to preserve those decisions across interaction states and the real desktop review surface.

## Required rework before another QA

- Keep campaign logo and authentic featured card present for every carousel state, or remove the unsupported second state until it has complete evidence-backed assets.
- Rebuild mobile controls as source-shaped left/right arrows with visible labels/icons and `≥44px` hit targets; no blank active block.
- Recreate the source CTA silhouette: gold outline, rounded corners, readable dark label and arrow, with black separation before the next section.
- Make responsive rules depend on the Hero/proof-surface width rather than only the outer application viewport, or expose a true independent desktop canvas for desktop QA.
- Re-run fresh mobile top/middle/bottom, changed/restored carousel and desktop proof-surface captures with a new Blind QA agent.

## Evidence reviewed

- Official source: `output/visual-qa/pokemon-tcg-official-home-hero/evidence/source/{desktop,mobile-390}/frames/*`
- Attempt implementation: `../demo/captures/*`
- Fresh browser measurements: `browser-probes.json`
- Machine-readable verdict: `visual-qa-assessment.json`

