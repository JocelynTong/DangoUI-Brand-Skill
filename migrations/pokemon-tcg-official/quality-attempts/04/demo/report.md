# Attempt 04 · Pokémon TCG Official Home Hero implementation self-test

## Scope

Only `pokemon-tcg-official-home / home-campaign-stage` was changed. No other page or section was redesigned.

## Implemented direction

- Removed the Attempt 03 `1440 × 716` fixed canvas and uniform transform path from this Hero.
- The Hero now renders its campaign background through a responsive `<picture>` layer and uses the local original-site `booster-art-1.jpg` asset at phone width.
- At the 390 viewport the Hero is an art-directed 1183px vertical composition: compact black navigation, vertically cropped campaign art, independent campaign mark, authentic full featured card, 56px CTA, and 56px side carousel controls.
- Desktop rules retain a horizontal campaign-stage composition without changing downstream Home sections.
- Removed leaked generic Hero pseudo-decoration and card entrance animation from this section. No card sheen was added.
- Disabled unrequested automatic cycling for this section; explicit controls still change and restore carousel state.

## Browser self-test

`node scripts/pokemon-home-attempt04-probe.mjs http://127.0.0.1:5178`

| Check | Result |
| --- | --- |
| 390 Hero height between 900–1280px | 1183px |
| Six required layers rendered | yes |
| CTA target at least 44px | 56px |
| Document horizontal overflow | none |
| Next section follows Hero | 0px gap; reachable by phone-screen scroll |
| Carousel change and restore | verified |
| Console/page errors | none |
| Desktop viewport regression | probe passed; note the product UI still presents the demo inside its 348px phone proof surface |
| Production build | passed |

Machine details: `browser-probes.json`. Captures are under `captures/`.

## Handoff

Implementation self-test only. This report does not issue a fidelity verdict. Independent Blind QA must compare the captures with the frozen source evidence and may reject composition or crop quality.
