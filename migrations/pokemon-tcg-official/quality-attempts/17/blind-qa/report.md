# Attempt 17 Blind Visual QA

Verdict: **REWORK**.

The three proofs were judged independently: Evidence Fidelity **PASS**, Structural Fidelity **FAIL**, Generative Proof **PASS**. No proof offsets the Structural Fidelity blocker.

Two computed contrast failures occur in Card Database at both narrow hosts: the 12px bold Search label is white on `rgb(228,107,41)` at **3.26:1**, and the 12px empty-state guidance is `rgb(119,119,119)` on `rgb(246,246,244)` at **4.14:1**. Both require 4.5:1. These are visible implementation defects; earliest failure node is Demo Implementation and owner is `demoImplementationAgent`.

Home, Card Database, Learn and held-out were exercised at 390×844 and 371×844. Every page retains a visible phone/screen shell, is multi-section, has no document or relevant-descendant horizontal overflow, and has an internally scrollable screen whose `scrollTop` changed from 0 to 620 and restored to 0. At 371, the screen is 353px wide; the normal home indicator is an absolute z-index 30 system layer and proof modes hide it. The pages are no-tabbar surfaces. The strict mockup matrix passed.

Reversible interactions passed: Home campaign slide 1→2→1; Card Database empty→Pikachu results→Reset; Advanced collapsed/expanded round trips; Learn accordion Name and Type↔Hit Points and restored.

High-salience inventory bindings were checked against approved patterns and Evidence refs. Official runtime assets are independently sourced and hashed; no screenshot-as-implementation was found. Held-out Deck Lab is a distinct two-organism content/structure variation applying frozen Learn rules rather than mirroring a source page.

Machine gates: evidence visibility strict PASS; design direction PASS; section fidelity strict PASS; mockup matrix strict PASS; `npm run build` PASS. `validate-brand-fidelity --write` exited 3 and strict handoff exited 2, so protocol completion also remains blocked. The strict handoff failure includes workflow-root QA/fidelity shape and missing retro artifacts, which this isolated QA was forbidden to edit.
