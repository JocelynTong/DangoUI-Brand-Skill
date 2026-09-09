# Pokémon TCG Official — Blind QA / TPP Attempt 01

Verdict: **FAIL / REWORK**. The live preview is recognizable and substantially learned, but required proofs are non-compensating. The advanced-filter state geometry is not faithful, the generative proof is not machine-verifiable under the active contract, and the canonical Home/Learn source screenshots are too incomplete for full screenshot-first evidence fidelity.

## Scores

| Proof | Score | Verdict |
| --- | ---: | --- |
| Evidence | 72 | FAIL |
| Structural | 66 | FAIL |
| Generative | 58 | FAIL |
| VisibleLearning | 74 | FAIL |
| Overall (unweighted) | 67.5 | FAIL |

The frozen overall threshold is 80, and each required proof must pass independently.

## Independent source ↔ demo findings

- Home: authentic official assets, black campaign stage, banded editorial/product sections, a retained phone shell, and reversible scrolling are visible. However, the canonical source full-page screenshot leaves large high-salience regions blank/lazy, and the standard desktop preview demonstrates only a phone-shell translation rather than the source desktop composition.
- Card Database: the charcoal search organism, responsive reading order, and real search flow are present. Empty → Pikachu → results (`SEARCH RESULTS`, `1/12`, four official card images) → Reset/empty passes. Advanced Search fails the frozen geometry trace: source `SHOW/0 → HIDE/724 → HIDE/1206.73 → SHOW/0`; Demo `SHOW/0 → HIDE/520 → HIDE/520 → SHOW/0`.
- Learn: the getting-started, yellow card-anatomy, and navy field-of-play organisms are visibly distinct. Exclusive accordions change and restore. No Reduce Motion state/control is invented. Canonical screenshot-first coverage remains weak because the source full-page capture contains extensive blank/lazy regions.
- Held-out: Deck Lab is visibly separate and uses a new information architecture. It applies bounded organisms, oversized instructional hierarchy, authentic objects, responsive order, and an exclusive accordion. Visually it is generative; protocol-wise it fails because `generative-proof.json` lacks the active validator's goal binding, held-out challenge object, named frozen rules, output screenshot hash, and applied-structure checks.

## Shell, responsive, provenance, and contamination checks

- All four pages retain `.phone` and `.phone-screen` at desktop host and requested 390 viewport.
- All pages have at least two sections, `scrollHeight > clientHeight`, no page-level horizontal overflow, and loaded images with non-zero natural size.
- Home and Learn scrolling changed and restored to zero in direct probes.
- Runtime official assets are independent files; no runtime asset hash equals a canonical source screenshot hash.
- No Pitch Black/Pokémon30 selector, class, asset URL, or recipe appears inside the Pokémon TCG Official demo subtree. The shared inspector lists those brands and the global stylesheet contains their separately scoped themes; neither is evidence of official-route inheritance, and computed official-route probes found no cross-theme reference.

## Required rework

1. Implement or document an approved responsive translation of the advanced drawer's two distinct open states. If the frozen numeric geometry is mandatory, the live Demo must expose `724px` on open and `1206.73px` settled before restoring to `0px`.
2. Regenerate `generative-proof.json` to the active machine contract, including goal SHA, held-out/source-independent challenge fields, at least two named rules frozen before the challenge, hashed output capture, `brandCueSubstitution: false`, and applied structure-rule checks.
3. Recapture canonical Home and Learn evidence so high-salience sections are visibly loaded through the continuous timeline; do not rely on manifest prose to fill blank screenshot regions.

Do not publish a user-facing PASS route recommendation until a fresh blind reviewer confirms all three blockers are closed.
