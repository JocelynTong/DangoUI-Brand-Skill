# Attempt 10 Demo Revision 3 — Pocket layering and held-out fixture

## Implementation outcome

The Pocket source-calibration section now uses the evidenced parent/child layering. Its responsive `<picture>` is the first full-article layer instead of a child confined to the left asset field.

- Desktop: 1440×476.188 light background; transparent 720×476.188 asset child; black 720×356.5 copy child at y=59.844, leaving approximately 59.84px light background above and below.
- Mobile: 390×743.016 full background; transparent 390×334.219 asset row; opaque black 390×408.781 lower row with no gap.
- Desktop/mobile URL aliases remain different while their verified current bytes remain identical.
- Existing Pocket type, external CTA, hover state and composite identity remain intact.
- Hero, News and TCG Live measured regression surfaces remain intact.

## Independent generative surface

Added the directly reachable page `pokemon-tcg-official-pocket-fixture`, labelled `GENERATIVE FIXTURE · FICTIONAL · NOT AN OFFICIAL PRODUCT`.

It is not the source responsive reflow. It changes the content and desktop internal arrangement: the bounded black copy panel moves to the left; the official Pocket composite is replaced by an original DOM/CSS concept tile on the right. It retains the full campaign field, bounded black child, Kanit/PT Sans roles, white CTA with local gold hover, and asset-first/copy-second mobile hierarchy. It contains no source screenshot and makes no official-product claim.

## Self-check

Browser probes pass full-background extent, inset copy geometry, mobile occlusion, URL roles, CTA states, direct held-out routing, fictional disclosure, changed arrangement, preserved invariants, overflow, prior-section regression and clean console checks.

This report does not assign Evidence Fidelity, Structural Fidelity, Generative Proof or final QA verdicts. Those remain reserved for a fresh independent Blind QA.
