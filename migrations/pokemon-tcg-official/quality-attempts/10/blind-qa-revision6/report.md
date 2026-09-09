# Attempt 10 Revision 6 — Fresh Blind QA / TPP

Verdict: **PASS**

Scope: only the revision6 presentation-shell / proof-surface incident closure defined by `../demo-revision6/qa-input-manifest.json`. No previous Blind QA verdict was read, and no implementation code was changed.

## Incident closure

- A — PASS. Normal Home, Pocket Fixture and Deck Lab held-out all visibly render a phone chassis. Computed frame values are `9.5px solid`, `41.4666px` radius and a visible `::before` shadow; each screen has `31.5936px` radius, clipping/`overflow-y:auto`, and reversible scroll (`0→700→0`, `0→452→0`, `0→520→0`).
- B — PASS. The Home direction is `source-calibration`, but its normal no-query route still renders the chassis. `proofRole` metadata does not activate no-shell CSS.
- C — PASS. Only explicit `?proof=mobile` removes the chassis. Browser and document viewport are exactly `390×844`; the full-bleed section is `x=0,width=390`; mobile order is `334.2266px` asset row followed by `408.7891px` full-width black copy row.
- D — PASS. Explicit `?proof=desktop` removes the chassis at `1440×900`; the section and background are `x=0,width=1440`; the black child is `720×356.5` and vertically inset `59.84375px`.
- E — PASS. Navigating from a proof query back to the same route without the query immediately restores the `9.5px` border, `41.4666px` chassis radius, shadow, `31.5936px` screen radius and independent scrolling.
- F — PASS. Hero flip, News next/previous, TCG Live assets/link/hover, source Pocket composition, Pocket CTA rest/hover/focus/href, Pocket fictional held-out CTA, and Deck Lab accordion all change state and restore. No image failures or console warnings/errors were observed.

## Three-proof and protocol verdicts

- Evidence Fidelity: **PASS**
- Structural Fidelity: **PASS**
- Generative Proof: **PASS**
- Blind QA protocol: **PASS**

There are no blocking findings. `earliestFailureNode=null`; `failureOwnerRole=null`.

## Machine verification

- Frozen Attempt 10 design direction gate: PASS (`1` section, `4` strategies, no failures).
- Frozen held-out section fidelity strict gate: PASS (`13` checks, no failures).
- `npm run build`: PASS (`25` modules transformed). The Vite chunk-size notice is advisory and unrelated to the incident.

Detailed measurements: `browser-probes.json`. Machine verdict: `verdict.json`. Canonical QA artifact: `visual-qa-assessment.json`. Capture hashes: `capture-manifest.json`.
