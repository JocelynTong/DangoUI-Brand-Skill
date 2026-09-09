# ONE PIECE Home attempt 11 — Blind Visual QA

Audited independently from the frozen Goal, attempt-11 mobile evidence, mobile interpreter contract, approved patterns, visual-pattern inventory, demo screenshot manifest, and a fresh live-browser session. Implementation notes, receipts, self-checks, and earlier verdicts were not consulted.

## Verdict

| Proof | Verdict | Reason |
|---|---|---|
| Evidence fidelity | **FAIL** | The live 390×844 Demo is now auditable, but several high-salience source structures are replaced by materially different, lower-density compositions. |
| Structural fidelity | **FAIL** | True host reflow works, yet the Home content does not preserve source hierarchy/density in Hero, News/New Arrival, Products/Events, and Footer. |
| Generative proof | **PASS** | The held-out editorial module is visible, source-independent, and visibly reuses the frozen editorial rhythm, hard-black unboxed heading, compact metadata, and black/white taxonomy roles. |

Overall: **FAIL**. The compensation rule applies: the Generative PASS cannot compensate for Evidence or Structural failures.

Earliest failing owner: **Demo implementation owner — Home responsive content**, beginning at `navigation-hero`. The host/preview integration owner is no longer the earliest blocker because the fresh 390×844 run exposes a non-zero full-width canvas and full-page scrolling.

## Same-viewport findings (actual 390×844 CSS px)

### Host preview / canvas — PASS

- `.template-preview` and Home canvas are visible and full-width; prior 10px/0px collapse does not reproduce.
- Document `scrollWidth` equals viewport width and the full Home document scrolls vertically.
- No document-level horizontal scrollbar was observed. Bounded Hero/Event overscan is clipped by its owning section.

### Navigation / Hero — FAIL

- Demo does reflow to a mobile canvas and preserves a dominant campaign image, compact menu, product image, copy, and 44px carousel controls.
- Source mobile Hero is approximately 955px tall and includes a materially richer official masthead/campaign hierarchy. Demo Hero is about 600px tall and compresses the campaign into a much shallower composition.
- The carousel control rail begins off-canvas (first controls partially/fully clipped). Although bounded rail crop is allowed, visible action availability and source control placement are not faithfully preserved.

### Welcome — PASS with fidelity reservations

- Narrative, body, and CTA form a readable vertical flow; CTA is 44px high and copy is not clipped.
- Serif editorial heading and sans utility/body roles remain distinct. The Demo is shorter and plainer than source, but its defining onboarding hierarchy survives.

### News / New Arrival — FAIL

- News rows are readable mobile rows and the main CTA is 44px high.
- Source evidence shows a much denser repeated news organism and a masked multi-item New Arrival rail with controls/sequence. Demo has only two simplified news rows and a single arrival item without comparable rail controls or browsing density.
- This is not merely responsive translation; it removes the defining density pattern.

### Products / Events / other middle modules — FAIL

- Products, Events, Schedule, Recommend, and Videos are all visible and vertically ordered; no section is hidden to shorten the page.
- Demo Products is two generic editorial cards, while source preserves merchandise-first category browsing and repeated product rows.
- Demo Events is one large fictional feature card; source evidence shows a dense multi-row event listing with metadata and continuing schedule/recommend structure. The Demo does not preserve the source event-card browsing rhythm or information density.
- Schedule/Recommend/Videos visibility passes, but their simplified single-card treatment does not close the structural mismatch.

### Footer — FAIL

- Illustration, cards, character, catch/logo layers, pause control, and the bounded navy closing surface are visible.
- The source mobile Footer includes a long stacked structural navigation/legal organism after the illustration. Demo ends in a short navy promotional heading and omits the comparable navigation/legal density.
- Decorative wave/card animation remains active on desktop, but motion cannot substitute for missing footer structure.

## Accessibility and overflow probes

- Visible primary controls measured at or above the provisional 44×44 CSS px floor: campaign controls, Welcome CTA, View All News, and Footer pause.
- The first Hero rail controls are clipped outside the viewport; this is recorded as a control-availability defect even though the rail itself is bounded.
- Hidden host controls reported 0×0 because the narrow host intentionally removes those panels; they are not counted as brand-content touch failures.
- Document horizontal overflow: none. Full-page vertical scrolling: passes.

## Desktop regression

- Desktop phone shell is retained.
- `.phone-screen--home` measured `clientHeight≈802`, `scrollHeight≈3199`, `overflow-y:auto`; browser-driven scrolling reached its internal maximum (`scrollTop≈2396`, max≈2397).
- Desktop document remains locked to the 900px viewport while the phone screen owns internal scrolling, as intended.
- Footer wave/entrance/card motion is present. Card layers report 5s/8s named animations and non-static transforms; footer background, character, catch, and logo entrance animations are also registered.

## Artifacts

- `captures/mobile-full-exact390x844.png`
- `captures/mobile-segment-1-y0-390x844.png` through `mobile-segment-7-y4321-390x844.png`
- `captures/desktop-phone-shell-1432x900.png`
- `captures/desktop-phone-shell-footer-scrolled.png`
- `comparisons/*.svg`
- `browser-probes.json`
- `receipt.json`

