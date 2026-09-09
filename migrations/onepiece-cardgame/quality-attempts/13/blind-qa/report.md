# Attempt 13 — Independent Blind Visual QA / TPP

Overall verdict: **FAIL**.

The four acceptance surfaces are non-compensating. Recommend, New Arrival and the held-out boundary pass, and the attempt-12 mobile/desktop/motion regression remains intact. Events has one blocking visual-contract defect: the six correct official thumbnails render in approximately `104×126` boxes, while the frozen contract requires `104×104`.

## Independent evidence basis

- Frozen Goal and attempt-13 interpreter contract.
- Attempt-13 source Evidence, asset manifest, rail probes and strict gate.
- Approved patterns, current inventory/manifest and generative proof.
- A fresh live Browser session with requested viewport `390×844`; fresh captures and read-only DOM/computed-style probes were produced under `blind-qa/`.
- Implementation messages, self-checks, receipts and prior verdicts were not used.

## Atomic verdicts

### 1. Home Events — FAIL

Asset identity and provenance pass: the six positions match the frozen SHA order, unique SHA count is exactly five, only Jakarta/Manila share, all intrinsic dimensions are `300×300`, and generated source-item count is zero. The red-frame organism is visibly and computationally present (`rgb(159,16,24)` field and dark-red border).

The live image rectangles are all approximately `104×126`, not `104×104`. The source evidence shows square media boxes. This is a visible geometry distortion and triggers `EVENT_ASSET_IDENTITY_MISMATCH` under the item-level render contract.

Evidence: `captures/events-live-initial.png`, source `../evidence/captures/events-390.png`, `probes.json#events`.

### 2. Home Recommend — PASS

Five linked cards retain the five distinct official SHA-256 identities in source order. Each image is intrinsically `640×360`, computed `object-fit: cover` at center, and renders approximately `244.9×137.3`. The rail is clipped (`clientWidth 323`, `scrollWidth 1414`, `overflow-x: hidden`) and visibly exposes the next poster.

Evidence: `captures/recommend-live-initial.png`, source `../evidence/captures/recommend-390.png`, `probes.json#recommend`.

### 3. Home New Arrival — PASS

Initial: `1 / 10`, transform `0`, Previous disabled with `aria-disabled=true`, `tabindex=-1`, `pointer-events:none`, opacity `0.35`.

After one real Next click: `2 / 10`, transform `-181.998px`, Previous fully enabled and visual/computed/ARIA states agree.

After one real Previous click: complete restoration to the initial state. The before/after/restored screenshots independently confirm the visual movement.

Evidence: `captures/new-arrival-live-initial.png`, `captures/new-arrival-live-after-next.png`, `captures/new-arrival-live-after-previous.png`, `probes.json#newArrival`.

### 4. Held-out boundary — PASS

Home contains zero `held-out-*` sections, zero `FIELD NOTES` text and zero held-out generated images. Direct navigation to `#/brand/onepiece-cardgame/pages/onepiece-cardgame-editorial-held-out` resolves as a separate page; the page registry has `mapsToSourcePageId: null`. It visibly presents the independent `FIELD NOTES` briefing, black/white taxonomy, asymmetric editorial board and generated independent fixtures in its own screenshot.

Evidence: `captures/held-out-route-live-390x844.png`, `probes.json#heldOut`, current preview registry and `generative-proof.json`.

## Regression

PASS: all eleven Home sections remain present, full-page scrolling completes, document horizontal overflow is false, Hero campaign state changes, Footer reveal/loop state changes, and the desktop view retains a phone-like preview shell without horizontal overflow.

## Required rework

Restore the Home Events media box to the frozen square geometry (`104×104` at the observed mobile viewport) without changing the verified item identities, source order, sole Jakarta/Manila sharing, cover crop, or red-frame organism. Then rerun a fresh independent browser capture and computed-rectangle probe for all six rows.
