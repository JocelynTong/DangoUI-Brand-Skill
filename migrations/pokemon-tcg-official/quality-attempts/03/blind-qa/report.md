# Pokémon TCG Official Home Hero — Blind QA Attempt 03

Verdict: **FAIL**

The proportional scaling mechanism is present and numerically correct, but the correction does not pass the sealed goal because the complete Hero is not visible at the required `390×844` browser viewport.

## What passed

- The logical canvas is `1440×716`.
- The computed transform is uniform: `matrix(0.24375, 0, 0, 0.24375, 0, 0)` at the phone-shell width.
- `transform-origin` is `0px 0px`.
- The wrapper measures `351.009×174.524`; the formula predicts `716 × (351.009 / 1440) = 174.529px`.
- The next Home section begins at the Hero bottom (measured gap approximately `0px`).
- The document has no horizontal scroll overflow.
- Phone-screen scrolling is reversible (`0 → 438.18 → 0`).
- Runtime assets are independent image/background assets; no source screenshot or QA capture is used as runtime content.
- No runtime console error was observed.

## Blocking failures

1. Required layers are clipped inside the correctly sized wrapper. On settled slide 1, the campaign title ends at `y=776.83` while the wrapper ends at `y=771.61`. The CTA begins at `y=781.70`, and carousel controls begin at `y=800.73`, leaving both with zero visible height. Navigation and logo also begin roughly `9.56px` and `7.12px` left of the clip, respectively.
2. At the requested browser viewport, the Hero itself is unreachable: its left edge is `x=598.49`, beyond the visible CSS viewport right edge `x=354`, while the document exposes no horizontal scroll range. The captured viewport therefore shows the inspector but not the Hero.

Both are implementation-stage failures (`failureOwnerRole=demoImplementationAgent`). A missing or clipped required layer is blocking under the correction contract, so the otherwise correct scale math cannot compensate.

## Evidence

- Original source desktop frame: `../../../captures/source/home/desktop/frames/000.png`
- Fresh desktop capture: `captures/demo-current-desktop-full.png`
- Fresh `390×844` capture: `captures/demo-phone-390x844-full.png`
- Measurements and interaction probes: `browser-probes.json`
- Machine-readable verdict: `visual-qa-assessment.json`

