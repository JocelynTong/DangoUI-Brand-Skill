# Attempt 09 — Demo Implementation report

Scope: `pokemon-tcg-official-home / home-product-bands` only. Hero and WHAT'S NEW were not edited.

## Implemented

- Replaced the generic three-card band with the source-backed TCG Live composition.
- Uses the official `tcgl-background.jpg` as a static full-bleed field and keeps laptop, Pikachu, phone, and both avatars as five independent transparent layers.
- Desktop keeps the copy-left / scene-right reading order. Mobile structurally reorders to scene-first / full-width black copy-second.
- Added viewport-entry staging: laptop pop, copy slide/fade, and staggered companions. Query-only `tcglState=before|mid|settled` proof states provide deterministic review captures; normal runtime still uses IntersectionObserver.
- CTA points to `https://tcg.pokemon.com/en-us/tcgl/`; localhost prevents the navigation only so automated review can verify the target and hover without leaving the Demo.
- Reduced motion settles all layers immediately.

## Implementation self-check

- Static background with red/gold seam and pale honeycomb body: complete.
- Five independent source assets and evidenced hierarchy: complete.
- Desktop 696px translucent copy panel and approximately 778x538 scene: complete.
- Mobile 390px full-width opaque panel and approximately 645px total section: complete.
- Typography, CTA geometry, black-to-gold foreground hover: complete.
- Before / intermediate / settled / hover captures on desktop and mobile: complete.
- No flattened source screenshot is used at runtime.

Implementation Agent does not assign the final visual verdict; this is ready for a fresh Blind QA / TPP review.
