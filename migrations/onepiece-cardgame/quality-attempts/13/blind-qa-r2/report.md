# Attempt 13 Revision 2 — Independent Blind QA

## Verdict

**PASS.** Evidence fidelity, structural fidelity, and generative proof all pass independently; no proof compensates for another.

## Fresh Browser findings

- Events has exactly six rendered media nodes. Every image is `103.9986 × 103.9986` CSS px (rounds to the required `104 × 104`), with `object-fit: cover` and `object-position: 50% 50%`.
- Event identity and order match the frozen manifest. The six positions yield exactly five SHA-256 identities; only Jakarta/Manila at positions 4/5 share `aac544…14a1`.
- The Events organism remains a red `rgb(189, 24, 33)` pickup-events frame with `bg_pikup-events.webp`; every thumbnail intrudes about `13.999px` left of its linked row.
- Recommend has five positionally correct, pairwise-distinct 640×360 assets. All are center-cover media in a clipped horizontal rail with a visible partial-next-card cue.
- New Arrival performs a real reversible transition: `1 / 10`, `translateX(0)` → `2 / 10`, `translateX(-181.998px)` → complete restoration of the initial transform and previous-button ARIA/tab/pointer/opacity state.
- The held-out fixture resolves directly at `onepiece-cardgame-editorial-held-out`, uses independent fictional SVG content, and renders the frozen black-white taxonomy, editorial rhythm and hard-black unboxed heading language. Home contains zero held-out sections and no held-out fixture text.
- At the responsive test override, document `scrollWidth === clientWidth` (354 CSS px in the browser surface), so there is no page-level horizontal overflow.
- Footer card organisms visibly changed transform/position across 2600ms. Pausing changed the control to `Resume footer card animation`, set all three card animations to `paused`, and produced zero movement across the next 700ms.

## Artifacts

- `probes.json` — raw normalized findings and exact hashes/computed values.
- `assessment.json` — three-proof gate.
- `captures/events-390x844.png`
- `captures/new-arrival-after-next-390x844.png`
- `captures/held-out-route-390x844.png`
- `captures/footer-motion-live-390x844.png`

No Goal, Evidence, Intent, Demo, implementation artifact, old verdict, or prior QA artifact was modified.
