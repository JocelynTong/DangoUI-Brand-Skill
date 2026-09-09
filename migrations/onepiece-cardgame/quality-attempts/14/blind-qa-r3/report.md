# ONE PIECE Home Indicator — Blind QA r3

Verdict: **FAIL / REWORK**

Earliest failure node: `Demo Implementation`  
Failure owner: `demoImplementationAgent`

## What passed

- Indicator is a direct child of `.phone`, `position:absolute`, `bottom:0`.
- Indicator container is fully transparent (`rgba(0, 0, 0, 0)`, no background image); only the black bar remains visible.
- No full indicator-height opaque/blank platform was introduced.
- The final visible footer content clears the black bar by `32.765625px`.
- Phone, screen, and indicator rects remain unchanged at top, mid (`scrollTop=2770`), bottom (`scrollTop=5582`), and restored top (`scrollTop=0`).
- At 390px, phone chrome and indicator are hidden, document width equals viewport width (`390px`), and the page reaches its bottom.
- Layout contract tests pass 5/5; build passes; preview registry validation passes with unrelated legacy/remote-asset warnings.

## Blocking finding

At the normal `1280x720` QA viewport, footer navigation and legal rows are wider than their parent footer content box:

- phone-screen right edge: `1018.828125px`
- footer nav/legal right edge: `1087.765625px`
- overflow clipped by phone-screen: `68.9375px`

The screenshot shows the copyright line cut at the right edge. This violates the explicit revision-3 requirement that footer/nav/legal remain wholly inside the phone screen.

Evidence: `captures/normal-bottom.png` and `browser-probes.json`.

## Three-proof verdict

- Evidence Fidelity: **PASS**
- Structural Fidelity: **FAIL**
- Generative Proof: **PASS**

Because the three proofs are non-compensating, revision 3 cannot be accepted.

## Reroute

Return only the responsive footer containment defect to `demoImplementationAgent`. Preserve the transparent chassis indicator behavior and do not reintroduce a white gradient or full-height footer platform. After correction, use a new independent Blind QA context.
