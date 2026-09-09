# Attempt 10 — Demo Implementation report

Scope: `pokemon-tcg-official-home / home-editorial-grid` only. Hero, WHAT'S NEW, and Pokémon TCG Live were not edited.

## Implemented

- Replaced the generic Explore/Championship grid with the evidence-backed Pokémon TCG Pocket cross-site product callout.
- Desktop is a 1440×476.195 full-bleed band with equal 720px asset and copy fields.
- Mobile is a 390×743.023 vertical recomposition: 334.23px asset field first, then a 408.793px opaque-black copy panel.
- Uses independent source assets: desktop `background.jpg`, mobile-specific `header_bg-small.jpg`, and transparent `logo-cards.png`.
- Keeps one H2, one paragraph, and one external `Play Now` CTA. The CTA keeps a white background while its foreground changes black → gold on hover.
- The CTA href is the real `https://tcgpocket.pokemon.com/en-us` destination.
- Entry motion is omitted and explicitly exposed as `data-motion-fidelity="unresolved-unscored"`; no exact choreography is claimed.

## Implementation self-check

- Desktop equal split and section geometry: complete.
- Mobile asset-first order, dedicated background URL, and measured geometry: complete.
- Kanit italic H2 at 40/44 → 28/30.8: complete.
- PT Sans body at 18/28.8: complete.
- CTA 56px → 51.297px, hover foreground, and destination: complete.
- No extension overlay, screenshot runtime, carousel, kicker, secondary CTA, or invented motion: complete.
- Independent 1440/390 section captures and browser probes: complete.
- Hero / WHAT'S NEW / TCG Live regression probe: complete.

Implementation Agent does not assign the final visual verdict. The section is ready for a fresh Blind QA / TPP review.
