# Pokémon TCG Official — Blind QA R2

Verdict: **REWORK / FAIL**. The frozen ≥80 rule is not met by Structural Fidelity or Visible Learning, and two strict protocol blockers prevent a valid final fidelity pass.

## Scores

| Proof | Score | Verdict |
|---|---:|---|
| Evidence Fidelity | 88 | PASS |
| Structural Fidelity | 76 | FAIL |
| Generative Proof | 86 | FAIL (content passes; protocol blocked) |
| Visible Learning | 74 | FAIL |

## Blocking findings

1. `SECTION_HORIZONTAL_OVERFLOW` — On the live Home route at an actual CSS 390×843 viewport, the phone shell spans x=43.99..431.45, so 41.45 px is clipped. Owner: `demoImplementationAgent`.
2. `MOBILE_ROUTE_PREVIEW_OBSTRUCTED` — All four live routes place the phone shell at about y=640.53. Only about 202 px of the preview is visible in the initial 390×843 viewport because inspector/navigation content occupies the upper screen. Owner: `demoImplementationAgent`.
3. `CANONICAL_GOAL_GATE_MISMATCH` — strict Evidence gate resolves `goal-contract.json` (v1) and fails on the superseded `cards` page even though the sealed v2 goal requires the reachable Card Database. Owner: `orchestrator`.
4. `VISUAL_PATTERN_INVENTORY_PROTOCOL_MISMATCH` — revision-1 inventory is not consumable by the current fidelity validator: it is flat (`patterns[]`), has no `pages[]` or `attempt`, uses selector-based `demoRegions[]`, string evidence ids, and omits required `preserves` / `compositionSupport`. Owner: `demoImplementationAgent`.

## What passed independently

- Desktop phone-shell presence, two-or-more section declarations, all four inner scroll containers, scroll change/end/restoration, and authentic asset loading.
- Card search: empty → `Pikachu` → results with `1/12` → empty reset.
- Advanced drawer: `Show/0` → `Hide/723.999≈724` → `Hide/1206.73` → `Show/0`.
- Generative content: goal SHA and output SHA match; Deck Lab is held-out, source-independent, selected after rules froze, reuses three named rules, and applies three structure checks.
- No invented Reduce Motion behavior and no old-brand runtime assets inside active Demo content.
- Strict section gate, preview registry validation, and build pass.

## Visual assessment

Home preserves the black campaign stage, authentic collectible hierarchy and editorial band concept. Card Database is the strongest mapping: density, charcoal task shell, orange action, reversible states and official result cards are all clear. Learn preserves painted section boundaries, oversized teaching hierarchy and authentic card/diagram pairings. Deck Lab demonstrates genuine rule transfer rather than a source mirror.

The remaining mobile route composition is not acceptable for the frozen full-profile threshold: the preview itself is partially pushed below the viewport on every route, and Home is horizontally clipped. Machine validation also cannot certify the canonical v2 run until goal selection and inventory schema are aligned.
