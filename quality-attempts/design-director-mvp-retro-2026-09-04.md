# Design Director MVP Retro — 2026-09-04

## Executive verdict

The organizational direction is correct, but the prototype is not yet a finished autonomous Brand Skill. The strongest progress is that failures now have owners, fresh QA and executable gates. The remaining weakness is that QA still needed user feedback to discover several shared-platform defects before the regression scope was widened.

## What tonight proved

1. Screenshot-first Evidence corrected code-first false semantics such as unsupported yellow emphasis.
2. Section slices are the right debugging unit; rerunning a whole site hides which node failed and wastes time.
3. Blind QA works only when its acceptance contract names the user-visible risk. Generic “looks stable” checks missed unsupported buttons, gradients, blank tails and icon cropping.
4. A local brand fix is not a platform fix. Home Indicator passed ONE PIECE while Pokémon retained the same defect because the validator helper was not wired into the real browser gate.
5. Empty space must be traced through the ownership chain. The Pokémon bottom problem was both an indicator gradient and a legacy 110px demo-root padding.
6. Inspector chrome is part of the product. Brand icons and labels need explicit geometry contracts just like Demo sections.
7. Failed learning cases can contaminate future work through duplicate source URLs, registry selection and asset references. Retirement requires dependency migration, not blind deletion.

## Incidents converted into capability

- `HOME_INDICATOR_OPAQUE_FOOTER`: shared chassis ownership, transparent container and sub-indicator safe inset; real browser validator integration.
- Footer containment regression: border-box/width containment and cross-viewport checks.
- `BRAND_ICON_CROPPED`: equal-height icons with intrinsic-ratio width and no generic rounded crop.
- `BRAND_LABEL_WRAPPED`: one-line rail titles, ellipsis and complete hover title.
- Registry hygiene: rejected Pitch Black, Pokémon 30th and Pokémon TCG Home Hero were retired; the one runtime dependency was migrated to Pokémon TCG Official.

## Current completion estimate

These percentages describe evidence-backed readiness, not effort spent.

| Scope | Completion | Current state |
| --- | ---: | --- |
| Role/JD and handoff contracts | 90% | Core roles, boundaries, receipts and failure routing exist; needs one clean end-to-end case without ad-hoc intervention. |
| Evidence self-test pipeline | 78% | Screenshot/video-first and code backtrace are defined and exercised; time-boxed repeatability still needs measurement on a fresh site. |
| Interpreter discipline | 68% | Evidence-bound roles and anti-expansion rules exist; needs a new cold-start case to prove unsupported semantics are rejected before Demo. |
| Demo implementation self-check | 72% | Section gates, mockup, scroll and shared platform rules improved; full-page visual fidelity is not yet consistently user-independent. |
| Blind QA / TPP | 80% | Fresh contexts and machine blockers work; visual ownership tracing and regression selection were only just added. |
| Learn-brand MVP as a whole | 74% | Architecture is usable, but no fresh brand has yet completed the refined pipeline without the user acting as primary QA. |
| Design-host/apply-host pipeline | 35% | Role model exists, but the design-director-to-host-strategy-to-implementation loop has not been validated end to end. |
| Full two-pipeline product | 55% | Learn-brand is ahead; host adaptation and repeatability/cost evidence remain substantial gaps. |

## Next plan

### P0 — Close learn-brand MVP with one clean cold-start case

Goal: the user does not discover the first P0 visual defect.

1. Pick one new brand with one representative Home slice; freeze source URL, desktop/mobile viewport, must-preserve and time profile.
2. Evidence Agent submits video/screenshots plus DOM/computed backtrace and explicit unresolved items.
3. Interpreter produces only evidence-supported composition, color, type, asset and motion roles.
4. Design Director approves one design direction and an element-level responsive matrix.
5. Demo Agent implements the Home slice and self-checks platform chrome separately from brand content.
6. Fresh Blind QA compares source/demo and runs the cross-brand platform regression matrix.
7. Only after the slice passes, expand to News or one structurally different page for Generative Proof.

Exit criteria: no user-found P0/P1 issue in the first review, all three proofs pass, and elapsed time plus retry cost are recorded.

### P1 — Measure repeatability and speed

Run the same pipeline on a second unrelated brand using cached tooling. Target: fast profile 15–20 minutes for direction, full profile 30–45 minutes. Record time per node and stop any node consuming over half the budget without a valid deliverable.

### P1 — Start design-host with a bounded host slice

After learn-brand is stable, choose one real business page and let Design Director produce `host-opportunity-map.json`: classify showcase, organisms, molecules and atoms; cap Hero to business-appropriate height; preserve data density and task efficiency. Implement only one approved slice, then host QA.

### Not next

- Do not add more parallel subagents yet.
- Do not learn another full site before the Home slice closes.
- Do not treat current ONE PIECE or Pokémon pages as proof that the refined pipeline is autonomous; they were debugging cases with heavy user QA.
