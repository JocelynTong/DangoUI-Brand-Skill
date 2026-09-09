# Incident 13 — fresh Blind QA r2

Date: 2026-09-04  
Verdict: **PASS**

This review was performed from the current formal mapping artifacts and independently rendered routes. No implementation notes, probes, or prior Blind QA verdicts were used as acceptance evidence.

## 1. Unsupported Database orange claim

**PASS.** The current Pokémon formal artifacts do not bind orange to the Database search action, a primary action, or a DangoUI token. `component-mapping.json` explicitly keeps the Database action on the DangoUI Button baseline because no rendered/computed source evidence authorizes a brand action color.

The normal Pokémon Button showcase independently computed its visible primary buttons as `rgb(124, 102, 255)` with matching borders. The old orange claim is therefore absent from both the formal mapping and the rendered Button surface. Generic color-family utilities and unrelated brands are not Pokémon Database evidence.

## 2. Normal-route Home Indicator contract

**PASS** for all four required routes:

- `#/brand/pokemon-tcg-official/style/button`
- `#/brand/pokemon-tcg-official/components/navigation-bar`
- `#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`
- `#/brand/onepiece-cardgame/pages/onepiece-cardgame-home`

On every route, `.mock-home-indicator--outer` is a direct child of `.phone`, is visible only in normal mode, computes to `position:absolute` and `bottom:0px`, and has a transparent background with `background-image:none`. The phone and indicator rectangles remain unchanged during actual scrolling.

The two showcase routes have no internal overflow (`scrollHeight === clientHeight`), so their end state is already reached at `scrollTop=0`. Pokémon Home reaches `scrollTop=3061.5` for a maximum of approximately `3061`; ONE PIECE Home reaches `scrollTop=5602` for a maximum of `5602`. Both long pages return to `scrollTop=0`, while the indicator remains fixed.

## 3. Proof-mode isolation

**PASS.** For the same four routes, the indicator is not visible under all three explicit proof modes:

- `?proof=1`
- `?proof=desktop`
- `?proof=mobile`

The element may remain in the DOM, but its rendered rectangle is `0 × 0`; it does not enter the proof image.

## 4. Build

**PASS.** `npm run build` completed successfully with Vite 8.0.16. The existing chunk-size advisory is non-blocking and unrelated to this incident.

## Blocking findings

None for the frozen Incident 13 scope.

## Scope verdict

The false Pokémon Database-orange fact has been withdrawn, and the shared normal/proof Home Indicator contract passes across style, component, Pokémon page, and ONE PIECE page surfaces. Incident 13 is ready for Design Director closure.
