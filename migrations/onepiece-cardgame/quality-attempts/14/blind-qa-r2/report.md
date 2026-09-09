# ONE PIECE Attempt 14 Revision 2 — Fresh Blind QA

Verdict: **FAIL / REWORK**

The white translucent footer treatment is gone. On the normal Home route the indicator is a direct child of the phone, is absolutely positioned with `bottom: 0`, has a fully transparent container and no background image, and leaves only the black bar visible. Phone frame/radii remain intact. Top, mid, bottom and restored scrolling keep the phone, screen and indicator rects unchanged.

The revision still has two blocking rendered-layout defects at the bottom of Home:

1. The footer bottom is `685.1015625px` while the black bar starts at `681.9453125px`, so footer content enters the bar zone by `3.15625px`.
2. The phone screen ends at `1018.828125px`, while footer navigation and copyright extend to `1087.765625px`. Because horizontal overflow is hidden, the right side is clipped and not reachable.

At 390px the shell and indicator are hidden, and document width equals viewport width. Build, preview-registry validation, and all five updated layout-contract tests pass. Those machine passes do not compensate for the browser-visible bottom overlap and clipping.

Earliest failure node: `demoImplementationAgent`.

Evidence: `captures/home-top.png`, `captures/home-mid.png`, `captures/home-bottom.png`, `captures/home-restored.png`, `captures/home-390.png`, and JSON records under `probes/` and `gates/`.
