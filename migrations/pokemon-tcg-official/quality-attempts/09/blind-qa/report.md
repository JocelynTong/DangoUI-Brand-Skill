# Attempt 09 Blind QA / TPP

## Verdict

**REWORK**

- Evidence Fidelity: **NEEDS_EVIDENCE**
- Structural Fidelity: **REWORK**
- Generative Proof: **NEEDS_EVIDENCE**
- Earliest failure node: **Evidence**
- Failure owner: **Brand Researcher**

The TCG Live implementation already contains several correct mechanisms, but the submitted evidence package is not sufficient to sign off the section. The first broken handoff is the motion evidence: the claimed source before/mid/settled captures do not visibly show TCG Live in those states. Static Evidence remains useful and does not need to be repeated.

## What passed

- The real mobile Demo contains the static honeycomb background and its red/gold threshold is visible as the section enters.
- Five independent image layers exist and preserve the expected order: laptop rear plane, Pikachu lower-left, phone lower-right, and two floating avatars.
- Mobile reading order is assets-first, then a full-width black copy panel.
- Independent live probing observed a genuine animation: laptop starts at opacity `0`, scale `.5`; an immediate entry sample showed opacity `0.2825`, scale `0.7967`; copy and companions were still staggered while the background stayed static.
- CTA target, 51px mobile height, white background, and black-to-gold hover behavior are correct.
- Mobile horizontal overflow is absent. Hero and WHAT'S NEW show no obvious mobile regression.

## Blocking findings

### P0 — Source motion evidence is invalid

The source motion `before` capture is essentially blank, while the submitted transition/settled frames show earlier homepage sections rather than a clearly identifiable TCG Live before/mid/settled sequence. The computed claims may be plausible, but screenshots do not independently establish them.

Return only this item to Evidence: capture the source target section in one continuous 390×844 viewport at before, true intermediate, and settled states. Keep the section seam or another stable target landmark visible in every frame.

### P0 — Demo mobile motion captures do not show the target

`mobile-390x844-before.png` shows preceding page content, and `mobile-390x844-mid.png` shows Hero/WHAT'S NEW. Neither can prove TCG Live entry. This is especially important because direct browser probing demonstrated that a valid intermediate state actually exists; the capture procedure, not necessarily the animation mechanism, failed.

### P0 — “Desktop” proof is a 390px phone surface

At an actual 1440×900 browser viewport, the target section measures only `390px` wide at `x=755` inside the showcase phone shell. The stored desktop screenshot likewise contains inspector/showcase chrome and a narrow phone surface. It does not prove the required 1440px full-bleed, copy-left/assets-right composition.

### P0 — Mobile typography is materially wrong

The live heading computes to `Oxanium` rather than the evidenced `Kanit`. More visibly, the paragraph computes to `12px / 18.6px`, versus the source evidence of `18px / 28.8px`. This makes the copy significantly smaller and denser than the official section.

### P1 — Settled proof omits the V seam

The stored mobile settled image begins in the honeycomb field, so the red/gold V threshold is outside the frame. The actual page does contain the seam, but the submitted settled capture does not prove it. Reframe the settled capture so the threshold, five-layer scene, and copy-panel boundary are all attributable to the same section.

### P1 — Reduced motion is not independently proven

The only reduced-motion evidence is a boolean in implementation-authored probe data. Blind QA did not receive a browser-emulated capture or another independent visual state proving immediate settlement.

## Required rerun boundary

1. Evidence recaptures only the TCG Live motion trio.
2. Demo fixes typography and exposes a genuine 1440px content proof surface.
3. Demo recaptures desktop and mobile target-section before/mid/settled states using one real content viewport per breakpoint.
4. A fresh Blind QA rechecks the revised package, including reduced motion.

The machine-readable findings and live measurements are in `visual-qa-assessment.json` and `probes.json`.
