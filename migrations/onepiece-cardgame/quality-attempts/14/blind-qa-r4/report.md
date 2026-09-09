# ONE PIECE Home Indicator — Blind QA R4

Verdict: **PASS** for the targeted revision-4 indicator/footer contract.

This was a fresh, read-only QA pass. No older Blind QA report or implementation rationale was used. It does not replace the whole-brand Evidence / Structure / Generative verdict.

## 1280×720 normal mockup

- Indicator is a direct child of `.phone`, `position:absolute`, `bottom:0px`.
- Indicator container is fully transparent: `rgba(0, 0, 0, 0)` and `background-image:none`.
- The only visible system mark is the black bar: `106.05×3.95px`, `rgb(17,17,17)`.
- Phone screen is `298px` wide; `scrollWidth === clientWidth === 298px`.
- Reversible scroll probe: `0 → 2600 → 5602 → 0` over `scrollHeight 6246px` / `clientHeight 644px`.
- Indicator and black-bar rectangles are identical at top, middle, bottom, and restored states.
- At the bottom, footer navy ends at `680.50px`; black bar starts at `681.95px`: `1.45px` positive surface clearance.
- Last visible footer content ends at `638.50px`: `43.45px` clear of the black bar.
- Footer, nav, legal, and every visible footer descendant remain inside screen bounds `721.17–1018.83px`.
- No horizontal unreachable area and no full-height blank band were observed.

## 390×844 no-shell

- Mockup chrome is visually removed and the indicator computes to `display:none`.
- The document scrolls reversibly `0 → 7134 → 0` with `scrollHeight 7978px`.
- `document.scrollWidth === clientWidth === 390px`; no horizontal overflow.
- Footer, nav, legal, and all visible footer descendants stay inside `0–390px`.

## Machine checks

- `node --test scripts/brand-preview-layout-contract.test.mjs`: PASS, 5/5.
- `npm run build`: PASS; only the existing non-blocking chunk-size warning.
- `npm run validate:brand-preview`: PASS, 5 previews; warnings concern unrelated remote-asset format-only checks.
- `npm run validate:brand-preview:browser -- --base-url http://127.0.0.1:5177 --brand onepiece-cardgame`: PASS, all 5 ONE PIECE pages.

## Routing

No blocker. `earliestFailureNode = null`; `failureOwnerRole = null`.

