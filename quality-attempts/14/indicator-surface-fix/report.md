# Attempt 14 — TabBar-aware Home Indicator surface

Owner: Demo Implementation Agent  
Verdict owner: independent Visual QA (not assigned here)

## Correction

The previous platform rule confused two different chassis states. A Home Indicator without bottom actions is a transparent system overlay. A Home Indicator directly below a TabBar is part of that bottom surface and must continue the TabBar background to the screen edge.

The phone now receives `template-phone--bottom-actions` from the existing `showDemoBottomActions` decision. Both the TabBar and its adjacent Indicator consume a shared `--mockup-tabbar-surface`. This is a structural rule, not a Pokémon exception.

## Implementation self-test

- Dango style/color, Pokémon style/button and Pokémon component/navigation-bar: TabBar present, opaque continuous surface, zero-pixel geometry seam.
- Pokémon Home and ONE PIECE Home: no TabBar, transparent absolute Indicator.
- CZN: dark bottom surface and light Indicator bar retained.
- HPMA and re1999: dark layered/texture surface and light Indicator bar retained.
- `proof=1`, `proof=desktop`, `proof=mobile`: Indicator hidden on style, component and brand-page samples.
- Dango style/color scroll container: `scrollTop 0 → 456 → 0`; Indicator rectangle unchanged.
- Production build: PASS; only the existing chunk-size advisory remains.

This report records implementation evidence only and intentionally does not issue a QA verdict.
