# Attempt 10 — Blind QA / TPP

## Verdict

**NEEDS_EVIDENCE**

- Earliest failure node: **Evidence**
- Failure owner: **Brand Researcher**
- Blocking findings: **1**

## Blocking finding

### `POCKET_MOBILE_BACKGROUND_IDENTITY_UNVERIFIED`

The visual composition is close, but the frozen requirement is stronger than a matching filename. The Demo declares two responsive background assets:

- desktop: `pocket-background.jpg`
- mobile: `pocket-header-bg-small.jpg`

Independent hashing found both local files are the same 720×464 JPEG with the same SHA-256:

`4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`

Therefore the runtime switches URL names, but it has not proved that the phone uses the authentic official `header_bg-small.jpg` rather than a renamed copy of the desktop background. The Evidence package records distinct official URLs but does not freeze the fetched source hashes. Because “dedicated mobile background” is explicitly frozen by Goal and Design Direction, this is blocking.

Required return path:

1. Evidence fetches both official source assets and records URL, byte size, dimensions, MIME and SHA-256.
2. If the official files are genuinely identical, Evidence must state and prove that fact; the current semantic claim “not an arbitrary crop” should be rewritten accordingly.
3. If they differ, Demo must replace the mobile runtime file with the verified official bytes.
4. A new Blind QA must recheck file identity plus the 390px rendered endpoint.

## Passed checks

| Check | Source | Demo | Result |
|---|---:|---:|---|
| Desktop section | 1440×476.195 | 1440×476.188 | PASS |
| Desktop split | 720 / 720 | 720 / 720 | PASS |
| Desktop composite | 700×428.4 | 700×428.391 | PASS |
| Mobile section | 390×743.023 | 390×743.016 | PASS |
| Mobile asset/copy fields | 334.23 / 408.79 | 334.227 / 408.789 | PASS |
| Mobile composite | 370×226.44 | 370×226.438 | PASS |
| H2 | Kanit italic 40/44 → 28/30.8 | matched | PASS |
| Body | PT Sans 18/28.8 | matched | PASS |
| CTA | 56px → 51.297px | matched | PASS |
| CTA hover | black → gold, white bg retained | matched and restored | PASS |
| CTA destination | `https://tcgpocket.pokemon.com/en-us` | matched | PASS |
| Red extension overlay | contamination only | absent | PASS |
| Hero / NEWS / TCGL | previous geometry preserved | preserved | PASS |
| Horizontal overflow | none | none | PASS |

The visual region height was kept distinct from the actual logo/cards size: on mobile the background field is 390×334.23 while the visible transparent composite is 370×226.44 with 10px side insets. The implementation is not a flattened full-section screenshot.

## Motion disposition

`UNRESOLVED_UNSCORED`. Only hidden and settled source endpoints are supported. The Demo does not claim exact intermediate timing, easing, stagger, or trajectory, so this does not add a second blocker.

## Three proofs

- Evidence Fidelity: **NEEDS_EVIDENCE** — authentic responsive background byte identity is not proved.
- Structural Fidelity: **PASS** — geometry, hierarchy, order, typography, CTA and regression checks pass.
- Generative Proof: **PASS for this source-calibration slice** — responsive recomposition uses DOM/CSS and an independent transparent asset; it is not treated as a held-out page or as proof of exact motion.

Finalization is blocked until the background provenance gap is closed and a fresh Blind QA passes.
