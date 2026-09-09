# Attempt 09 — Demo Revision 2

Scope: `pokemon-tcg-official-home / home-product-bands` only.

## Corrected proof surfaces

- Desktop is now measured on the independent `?proof=desktop` content surface. Both `.phone-screen` and TCG Live section are 1440px wide; the section is 1440×624, with the 696px copy panel at x=12 and the 778×538 scene at x=612.
- Mobile is measured on an independent 390×844 content viewport. The complete 390×644.625 section is captured, including the red/gold V seam, honeycomb field, 374×258.625 scene, and full-width copy panel.
- Old before/mid frames are not reused. Settled captures are authoritative.

## Confirmed implementation

- Five independent source assets preserve laptop rear plane, Pikachu lower-left, phone lower-right, and both upper avatars.
- Computed desktop typography: Kanit 700 40/44; PT Sans 400 18/28.8; PT Sans CTA 700 20/24.
- Computed mobile typography: Kanit 700 28/30.8; PT Sans 400 18/28.8; PT Sans CTA 700 18/22.5.
- CTA resolves to `https://tcg.pokemon.com/en-us/tcgl/` and retains the requested black-to-gold foreground hover.
- Entry motion is omitted from the implementation. `PAT-TCGL-R2-07` remains an unresolved Evidence candidate and is not scored.
- Hero remains 450px desktop / 416px mobile; WHAT'S NEW remains present and functional.

Implementation checks pass. Final visual PASS/FAIL remains reserved for a fresh Blind QA.
