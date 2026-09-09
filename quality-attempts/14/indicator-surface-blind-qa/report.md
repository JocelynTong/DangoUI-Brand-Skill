# Attempt 14 — Home Indicator surface Blind QA

## Verdict

**PASS — 0 blocking findings.**

This was an isolated runtime QA. No prior QA report, implementation report, or agent rationale was used, and no implementation file was changed.

## Tested contract

### With TabBar

- Dango `style/color`, Pokémon `style/button`, and Pokémon `components/navigation-bar` all render the indicator as a direct `.phone` child with `position: absolute` and `bottom: 0px`.
- The indicator surface and TabBar surface have identical computed background color and background image.
- The measured vertical seam is exactly `0px` on every tested page.
- CZN, HPMA, and 1999 theme samples retain their theme-specific surfaces. HPMA/1999 retain the same computed texture on both layers; CZN retains the same dark translucent surface on both layers.

### Without TabBar

- Pokémon Home and ONE PIECE Home render no TabBar.
- Their indicator container is transparent (`rgba(0, 0, 0, 0)`) with no background image.
- Scrolling each `.phone-screen` to its maximum leaves the indicator viewport rectangle unchanged (`0px` delta).
- Both pages reached their actual content end: Pokémon at `scrollTop 3061.5`, ONE PIECE at `scrollTop 5602`.

### Proof modes

For `proof=1`, `proof=desktop`, and `proof=mobile`, the indicator has `display: none` and a zero-size rectangle.

### Build

`npm run build` passed. Vite emitted only its existing advisory about a chunk larger than 500 kB.

## Notes

- The valid component route is plural: `/components/navigation-bar`.
- Full raw values are recorded in `probes.json`; the machine-readable decision is in `verdict.json`.
