# Attempt 14 · Home Indicator Blind QA

Verdict: **PASS**

Scope: fresh, independent closure of the reported Home phone-mockup indicator mismatch at `http://127.0.0.1:5177/#/brand/onepiece-cardgame/pages/onepiece-cardgame-home`.

Input discipline: only `userFeedback`, `observedMismatch`, and `requiredClosure` were read from the incident retro. The prior attempt report, prior browser probes, implementation rationale, and old verdict were not used. No implementation was modified.

## Required checks

1. **Normal phone mockup/frame/radius — PASS.** At 1440×1000 the phone is 390×821.4609 px with a 9.5 px frame, 41.4666 px chassis radius, and 31.5936 px clipped screen radius.
2. **Chassis absolute overlay — PASS.** `.mock-home-indicator--outer` is a direct child of `.phone.template-phone`, outside `.phone-screen`, with `position:absolute`, `z-index:30`, and `pointer-events:none`. Its rect is fully inside the screen/chassis boundary.
3. **No opaque document footer — PASS.** Computed `background-color` is transparent. The overlay uses `linear-gradient(to top, rgba(247,244,233,.88), rgba(247,244,233,.5) 58%, transparent)`, visibly fading upward instead of forming a solid document-flow strip.
4. **Bar visible — PASS.** The bar is 132.297×4.92969 px, `rgb(17,17,17)`, opacity `.72`, and is visible in all normal-state captures.
5. **Scrollable and recoverable — PASS.** `.phone-screen` reports 6206 px scroll height / 802 px client height. Scroll sequence is `0 → 1900 → 5404 → 0`. The indicator rect is exactly unchanged at top, mid, bottom, and restored states: `x=774.3672, y=857.7969, w=351.2656, h=33.5625`.
6. **Footer complete and unobscured — PASS.** At `scrollTop=5404`, the full footer—including CONTACT, COOKIE SETTINGS, PRIVACY POLICY, GLOBAL ENTRANCE, and the copyright line—is visible and reachable. No visible footer descendant overlaps the indicator. Footer bottom is 855.6484 px; indicator top is 857.7969 px (2.1484 px clearance).
7. **True 390 px viewport — PASS.** The page becomes a 390 px wide, 7978 px tall no-shell document. Phone border/radius/shadow are zero/none, screen clipping is removed, and the indicator has `display:none` with a 0×0 rect.
8. **No horizontal overflow — PASS.** Normal document `1440/1440`, normal screen `371/371`, narrow document `390/390`, narrow screen `390/390` (`scrollWidth/clientWidth`).
9. **Machine gates — PASS.** `npm run build` exited 0. `node --test scripts/brand-preview-layout-contract.test.mjs` exited 0 with 5/5 tests passing.

## Fresh captures

- `captures/normal-top-1440x1000.jpg`
- `captures/normal-phone-top.jpg`
- `captures/normal-phone-mid.jpg`
- `captures/normal-phone-bottom.jpg`
- `captures/normal-phone-restored.jpg`
- `captures/narrow-390-top.jpg`
- `captures/narrow-390-bottom.jpg`
- `captures/narrow-390-fullpage.jpg`

Machine-readable evidence is in `browser-probes.json`, `gate-results.json`, `visual-qa-assessment.json`, and `verdict.json`.

`earliestFailureNode = null`; `failureOwnerRole = null`; `minimumFixScope = null`.
