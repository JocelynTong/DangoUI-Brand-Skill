# Attempt 08 · Demo Implementation handoff

## Scope

Only `pokemon-tcg-official-home / home-news-grid` was replaced. Hero and later sections were not edited.

## Implemented

- Full-width white WHAT'S NEW field without a phone/showcase gutter on the source-calibration proof surfaces.
- Desktop: 48px italic Kanit title, same-row archive action, two 576px stories with a 24px gap, three pages.
- Mobile: 32px centered title, archive action on the next line, one 390px story per page, six pages.
- Six independent source assets at their intrinsic 578:325 ratio using `object-fit: contain`.
- Image → centered headline → black CTA order.
- Previous/next and dots change the actual story group and restore to page zero.
- Directional translate + fade + scale; captured before, visible intermediate, settled and restored states.
- Edge arrows are 60x60. Dot buttons have at least 44px height; yellow remains restricted to the active carousel dot.
- Reduced-motion path skips the staged state and settles immediately.

## Self-check result

Machine/DOM implementation checks pass. Build passes. No browser console error or warning was observed. This document intentionally does **not** assign the final visual-fidelity verdict; a fresh Blind QA agent must compare the captures to source evidence.

## Known evidence boundaries

- English copy wraps fluidly; no line breaks were copied from translated captures.
- Exact entry-on-scroll animation is omitted.
- CTA hover only uses a conservative inversion; it is not claimed as the source's exact animated layer.
- The existing following section remains outside this implementation scope, so its pre-existing light-blue field was not changed to the source capture's red section.
