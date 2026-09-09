# Attempt 05 Revision 2 — Demo Implementation Report

Scope: `pokemon-tcg-official-home / home-campaign-stage` only. This revision addresses only the two findings in Attempt 05 independent Blind QA. It does not change other pages, expand carousel state 2, or assign a visual-fidelity verdict.

## Corrections

- Removed all four desktop navigation labels from compact-container layout and hit testing (`display: none`, measured `0 × 0`) and restored the compact `MENU ☰` treatment. The TCG logo remains 70 × 25px and the measured Logo/navigation-item overlap is 0px² at both required proof surfaces.
- Added an executable Chromium reduced-motion probe using `reducedMotion: reduce` plus `emulateMedia`. Runtime evidence is `matchMedia=true`, computed transition duration `0s`, `aria-pressed=true`, and the back-face `matrix3d` applied immediately after activation.

## Regression probes

- 390×844 and outer-1440/internal-phone: Hero 416px, next section begins at the Hero boundary and is visible in the initial phone viewport, CTA 44px, no document or Hero horizontal overflow.
- Pointer: `front → back → front`; the 150ms midpoint retains stable card geometry and `scrollTop=0`.
- Keyboard: `Enter → back`, `Space → front`.
- Carousel: `0 → 1 → 0`, without changing the approved second-state scope.
- Console: no errors or warnings.
- `npm run build`: pass.

Machine evidence: `browser-probes.json`. Visual surfaces are under `captures/`.

## Handoff

Implementation checks pass. A new independent Blind QA context must decide visual fidelity; this report does not self-approve the revision.
