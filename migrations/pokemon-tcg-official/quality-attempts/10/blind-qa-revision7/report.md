# Attempt 10 · Demo revision 7 · Fresh Blind QA

## Verdict

**PASS.** `HOME_INDICATOR_LAYOUT_LEAK` is closed on the required evaluation boundary. No blocking finding remains, so `earliestFailureNode` and `failureOwnerRole` are both `null`.

This assessment used the revision 7 QA input manifest and a fresh live render at `http://127.0.0.1:5177/`. It did not reuse a prior QA verdict or accept build/implementation claims as visual evidence.

## Home Indicator incident closure

All three normal routes keep the same visible phone shell: 390×821.461px chassis, 9.5px border, 41.4666px radius, independently scrollable 371×802.461px screen, and a visible 351.266×33.563px indicator system layer.

| Route | Scroll sequence | Stable phone/screen/indicator rects | Final content clearance | Result |
| --- | --- | --- | ---: | --- |
| Home | 0 → 700 → 1790 max → 0 | yes | 2.20px | PASS |
| Pocket Fixture | 0 → 249 → 497.5 max → 0 | yes | 2.02px | PASS |
| Deck Lab | 0 → 399 → 798.5 max → 0 | yes | 2.30px | PASS |

The indicator computes to `position:absolute`, `z-index:30`, and transparent backing on each normal route. It stays fixed to the chassis while only `.phone-screen.scrollTop` changes. At maximum scroll, the last real section stops above the indicator; the reserved content inset is about 45.57px. Visual captures show the system bar, no detached white footer, and no covered final control or text.

Key captures:

- [Home before](captures/home-before.png), [middle](captures/home-middle.png), [max](captures/home-max.png), [restored](captures/home-restored.png)
- [Pocket Fixture before](captures/pocket-fixture-before.png), [middle](captures/pocket-fixture-middle.png), [max](captures/pocket-fixture-max.png), [restored](captures/pocket-fixture-restored.png)
- [Deck Lab before](captures/deck-lab-before.png), [middle](captures/deck-lab-middle.png), [max](captures/deck-lab-max.png), [restored](captures/deck-lab-restored.png)

## Proof-mode isolation

- `?proof=desktop`: 1440px no-shell content canvas, phone border/radius both 0, indicator `display:none` — PASS.
- `?proof=mobile`: 390×844 no-shell content canvas, phone border/radius both 0, indicator `display:none` — PASS.

Captures: [desktop proof](captures/proof-desktop.png), [mobile proof](captures/proof-mobile.png).

## Regression sample

- Hero: featured card changes from front request to back request (`aria-pressed=false → true`) — PASS.
- News: active page changes 1 → 2 and headline updates — PASS.
- TCG Live: five composition assets load with non-zero natural size; content and external link remain intact — PASS.
- Pocket: official composite loads; mobile asset-first/black-panel stack remains intact; CTA stays white and changes black → gold on hover; external destination is unchanged — PASS.
- Held-out: Pocket Fixture stays explicitly fictional; Deck Lab remains visually distinct and its accordion changes expanded item without moving the phone or indicator — PASS.
- Browser console: no errors or warnings observed during the QA run.

Regression captures: [Hero flip](captures/regression-hero-flipped.png), [News next](captures/regression-news-next.png), [TCG Live](captures/regression-tcgl.png), [Pocket hover](captures/regression-pocket-hover.png), [Deck Lab accordion](captures/regression-deck-lab-accordion.png).

## Three independent proofs

- Evidence Fidelity — **PASS**. The seven canonical input hashes match the manifest. The source-backed Pocket layer roles, official asset identity, typography and CTA behavior remain visible after the system-layer correction.
- Structural Fidelity — **PASS**. Normal routes preserve shell + clipped internal scroller + chassis-fixed indicator; only explicit proof routes remove the shell. Hero, News, TCG Live and Pocket ordering/composition show no regression.
- Generative Proof — **PASS**. Pocket Fixture and Deck Lab change message, asset construction and internal arrangement while preserving approved bounded-section hierarchy, type roles and shell/system-layer behavior.

These verdicts are independent and none is used to compensate for another.

## Machine verification

- `validate-design-direction`: PASS
- `validate-section-fidelity --strict`: PASS, no failures
- `asset-usage-gate --strict`: PASS, no blockers or warnings
- `validate-brand-preview-registry`: PASS with pre-existing repository warnings; fresh browser checks confirmed the Pokémon TCG Official assets have non-zero natural dimensions
- `npm run build`: PASS, 25 modules transformed; the bundle-size notice is non-blocking

Detailed measurements are in [probes.json](probes.json), gate results in [gate-results.json](gate-results.json), capture hashes in [capture-manifest.json](capture-manifest.json), and the formal assessment in [visual-qa-assessment.json](visual-qa-assessment.json).
