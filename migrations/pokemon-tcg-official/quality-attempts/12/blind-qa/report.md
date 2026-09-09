# Cross-brand Home Indicator Blind QA

Verdict: **PASS**

Fresh QA covered Pokémon TCG Official Home and ONE PIECE CARD GAME Home without reading an older QA verdict. The repaired behavior is cross-brand for the two requested Home demos, not a ONE PIECE-only exception.

## Visual and geometry findings

| Brand | Viewport | Indicator | Tail reserve | Last content → bar | Horizontal overflow | Scroll restore |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Pokémon TCG Official | 1184×933 | phone child; absolute; bottom 0; transparent; black bar | 23.70px | 3.71px | 0px | 0px |
| Pokémon TCG Official | 1280×720 | phone child; absolute; bottom 0; transparent; black bar | 19.00px | 3.22px | 0px | 0px |
| ONE PIECE CARD GAME | 1184×933 | phone child; absolute; bottom 0; transparent; black bar | 21.72px | 1.84px | 0px | 0px |
| ONE PIECE CARD GAME | 1280×720 | phone child; absolute; bottom 0; transparent; black bar | 17.41px | 1.45px | 0px | 0px |

The reserve is smaller than the indicator height at both normal viewports and is only sufficient to clear the black bar. There is no 110px legacy Home padding, opaque footer block, background image, or white translucent veil. At the explicit 390×844 `proof=mobile` no-shell route, the indicator is hidden and both brands have zero horizontal overflow.

The indicator rectangle did not move while each inner phone screen scrolled to its maximum position and back to `scrollTop = 0`.

## Machine validation

- `node --test scripts/brand-preview-layout-contract.test.mjs`: PASS (5/5)
- Pokémon full brand browser validator: PASS (6/6 pages)
- ONE PIECE Home browser validator: PASS (1/1 page)
- `npm run build`: PASS; only the existing non-blocking bundle-size warning remains

## Evidence

- `browser-probes.json`: computed geometry and style values
- `captures/pokemon-1184-top.png`
- `captures/pokemon-1184-bottom.png`
- `captures/pokemon-1280-top.png`
- `captures/pokemon-1280-bottom.png`
- `captures/pokemon-390-proof-mobile.png`
- `captures/onepiece-1184-top.png`
- `captures/onepiece-1184-bottom.png`
- `captures/onepiece-1280-top.png`
- `captures/onepiece-1280-bottom.png`
- `captures/onepiece-390-proof-mobile.png`

Earliest failing pipeline node: **none**.
