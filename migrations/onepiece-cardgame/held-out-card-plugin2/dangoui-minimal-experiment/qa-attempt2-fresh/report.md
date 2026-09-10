# Fresh DangoUI QA — Attempt 2

Verdict: `PASS_REAL_COMPONENT_CONSUMER_H5_ONLY`

- `workflowCompletion`: PASS
- `businessSafety`: PASS
- `visualQuality`: PASS
- `runtimeConsumer`: PASS
- `weapp`: `UNSUPPORTED_UNVERIFIED`

The first QA failure is closed. At 1280×720 the stabilized sheet spans y=42.406..720, while environment, input, textarea and actions end at y=414, 522, 656 and 710 respectively. At 390×844 and 536×864 all four targets are also fully contained. Input and textarea expose one visible DangoUI-root boundary; both native primitives have `0px none` borders.

Exact boundary probes pass: name 15 stays 15 and 16 truncates to 15; description 1000 stays 1000 and 1001 truncates to 1000. Placeholder, filled, focus and textarea internal scrolling states were exercised at all three viewports.

The approved independent harness activated the real rendered `DuButton` by pointer, Enter and Space. Each path invoked the original save outcome once, wrote `ptcg` exactly once, closed the sheet, restored browser storage exactly, and made zero external writes. Isolated real-component disabled/loading states suppressed the click and exposed their DangoUI visual classes; each browser context was discarded.

The mobile keyboard check is explicitly an automated `visualViewport` proxy: the real textarea retained focus and remained visible at a 520px proxy viewport. Real-device soft-keyboard behavior is N/A/unverified and is not claimed.

Production H5 build passes with 668 transformed modules. All six configured routes render without horizontal overflow. Plaza/build/detail still emit opaque Taro `Object` pageerrors with no message or stack; because the static delta is restricted to the approved Build-sheet consumers/adapters and all routes render, these are recorded as non-blocking pre-existing runtime noise rather than attributed to the experiment.
