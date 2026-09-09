# Pokémon TCG Official — Attempt 18 Blind Visual QA

Visual result: **PASS**. Workflow result: **PROTOCOL_BLOCKED**.

The three required proofs independently pass: Evidence Fidelity, Structural Fidelity, and Generative Proof. No score or proof was used to compensate for another.

## Card Database

- Search normal, hover, and focus computed foreground/background are `rgb(34, 34, 34)` on `rgb(228, 107, 41)`.
- WCAG contrast is `4.874435255231589:1`, passing the required `4.5:1` ordinary-text threshold in all three states.
- Empty submit preserves “Enter a card name to search the official card database.”
- At 390px outer viewport and 371px internal phone screen, Pikachu search returns four card results and Reset restores empty input, zero results, and the empty-state copy.
- Both widths have `scrollWidth == clientWidth`; there is no internal horizontal overflow.

## Regression

- Home: five sections, all images loaded, campaign 1→2→1 and scroll 0→500→0 are reversible.
- Learn: four sections, all images loaded, Name and Type→Hit Points→Name and Type is reversible, scroll restores to 0.
- Held-out: two purpose-separated sections, all images loaded, lead→support→lead accordion is reversible, scroll restores to 0.
- Normal mockup: phone 390px, screen 371px, indicator is an absolute child of phone and has zero rect delta while content scrolls.
- Proof mobile: indicator is hidden.

## Warning

`Search` matches `:focus-visible`, but its computed outline is `none` and box-shadow is `none`. This is a usability/accessibility warning. It is not a frozen-goal blocker here: `goal-contract-v2.json` freezes the database organism's `interactionSemantics`, `no-fake-controls`, and the three-proof contract, while this run's explicit hard threshold is ordinary-text contrast ≥4.5:1. Contrast and reversible semantics pass.

## Machine gates

- Evidence strict: PASS, with one legacy semantic-claims schema warning.
- Design direction: PASS.
- Section fidelity strict: PASS.
- Mockup strict: PASS.
- Build: PASS (Vite chunk-size warning only).
- Handoff strict: FAIL because canonical QA/fidelity handoff files are shallow and `retro-learnings.json` is absent.
- Fidelity `--write`: executed only in the authorized isolated report sandbox; protocol-blocked because the current root dispatch lacks `qa-input-manifest.json` and the current pattern inventory lacks validator-required `pages/attempt` shape. Formal artifacts were not modified.

## Final routing

Visual QA has no implementation rework blocker. The earliest workflow failure is QA dispatch/handoff, owned by the Design Director / Orchestrator. It must publish a current hashed QA input manifest and canonical structured handoff artifacts before workflow completion can be declared.
