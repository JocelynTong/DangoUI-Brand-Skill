# Attempt 11 · Revision 3 · Fresh Blind QA

**Verdict: PASS.** `earliestFailureNode=null`; no blocking finding and no implementation change was made.

## Independent visual result

- Evidence Fidelity: **PASS** — official 696²/1392² assets match the frozen SHA-256 values, and runtime `src`/`srcset`/`currentSrc` are coherent at the observed DPR.
- Structural Fidelity: **PASS** — 1440 preserves the 720px 50/50 copy-left/image-right surface; 390 preserves the 390px image-first stack and exact local heading/body/CTA geometry. All section children remain transparent over the white page canvas, with the preceding home content and following Play! Pokémon section intact.
- Generative Proof: **PASS** — the isolated fixture changes copy, asset construction and action purpose, uses no official event image, and retains the approved section-local hierarchy and responsive relationship.

## Required measurements

- Desktop typography: heading/body/CTA = `48/18/18px`.
- Mobile local Y: heading `414`, paragraph `519.5`, CTA `737.078125`.
- Source CTA: black/white default, complete gold hover reveal, black/white blue-outline keyboard focus, verified Championships destination, 2px black inset frame, exact `0 16px 24px -16px rgba(0,0,0,.35)` shadow.
- Normal route phone: visible chassis, `scrollHeight 3842 > clientHeight 802`, `scrollTop 0 → 1380 → 0`; phone, screen and outer home-indicator rectangles remain unchanged during scroll.
- Held-out control: local `button[type=button]`, no `href`, no `aria-pressed`; keyboard focus is visible, and `aria-live=polite` changes from “ready” to “noted locally.”

## Protocol gates

`npm run build`, design-direction validation, and strict section-fidelity validation all exited 0. The Revision 3 QA manifest has seven resolvable current entries, with empty old-demo and prior-verdict arrays.

Machine-readable detail is in `visual-qa-assessment.json`, `probes.json`, `gates.json`, and `verdict.json`; fresh screenshots are under `captures/`.
