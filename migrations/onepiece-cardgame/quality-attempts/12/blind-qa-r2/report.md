# Attempt 12 · Blind Visual QA Revision 2

Verdict: **FAIL**

This is a fresh 390×844 CSS-pixel review against the frozen Goal, attempt-12 source evidence, interpreter section contract, approved patterns, current inventory/manifest, and the live Demo. Item counts were treated as diagnostics only.

## Independent three-proof verdicts

| Proof | Verdict | Independent reason |
|---|---|---|
| Evidence fidelity | FAIL | Events does not consistently render official event artwork: four of six rows use `generated/heldout-event-*.svg`. Recommend repeats the same 94×66 `product-decks.png` thumbnail on all five posters, unlike the source rail's distinct official campaign/media art. |
| Structural fidelity | FAIL | New Arrival looks like a clipped horizontal rail and exposes semantic arrow buttons, but clicking Next/Previous produces no position, scroll, transform, or first-item change. Recommend preserves a horizontal poster rail but the poster media hierarchy is visibly broken: tiny repeated imagery, overlapping copy, and large blank parchment areas replace the source's distinct wanted-poster compositions. |
| Generative proof | FAIL / not demonstrated | No separate held-out page is present in the live Demo. Generated held-out event SVGs are mixed into the source-mapped Home Events organism, which does not establish a distinct source-independent held-out proof. |

All three proofs must pass independently, so the overall result is FAIL.

## Section dispositions

- Welcome — PASS for structure and reflow. It is full-width, approximately source-height, preserves the warm story field, layered cards, centered heading/copy/CTA, and an operable anchor. Visual decoration is materially present rather than reduced to a corner accent.
- New Arrival — FAIL. Navy surface, ~166px square linked cards, partial-neighbor clipping, and two visible controls are present. Both controls are enabled but inert in live operation.
- Events — FAIL. Black title bar, red enclosing field, stacked rows, thumbnail intrusion, title/date metadata, six row links, and View All are present. Asset authenticity fails because most artwork is generated held-out SVG material rather than real official Events artwork.
- Recommend — FAIL. The rail, portrait poster proportion, clipping, five anchors, and partial-next cue are present. The source's distinct official wanted-poster media is replaced by five copies of one tiny product icon; text visibly collides with poster headings and leaves large empty parchment fields.
- Videos — PASS with reservations. A clipped horizontal thumbnail rail, multiple visible 16:9 thumbnails, five actions, and channel link are present with no mobile autoplay control. All five thumbnails repeat one image, reducing media specificity, but the frozen structural contract does not require distinct video imagery.
- Footer nav/legal — PASS. Illustration precedes the navy footer; navigation truly reflows to one column; plus controls, Contact, Cookie Settings, home logo, Privacy, Global Entrance, and legal copy are semantic and visible. The footer animation pause action toggles to Resume.

## Regressions

- Canvas and overflow — PASS at a measured 390×844 CSS viewport: `scrollWidth == clientWidth == 390`, no document-level horizontal overflow, vertical scroll remains available.
- Reading order — PASS: Hero → Welcome → News → New Arrival → Products → Events → Schedule → Recommend → Videos → footer illustration → footer navigation/legal.
- True reflow — PASS at page level. Desktop shell is absent and content occupies the mobile canvas; Events and footer become vertical organisms while New Arrival/Recommend/Videos retain bounded horizontal rails.
- Hero — PASS. The seven-state hero advances automatically; Pause freezes the active variant and changes its accessible label to Play.
- News — PASS for regression coverage: retained between Welcome and New Arrival as a dense linked editorial stack with View All.
- Footer illustration wave/motion — PASS for operability and visible motion presence. Two live frames differ before pause; the control toggles from Pause to Resume. This finding does not compensate for the failing section proofs.
- Desktop shell — PASS: no inspector sidebar or desktop preview chrome remains inside the 390px page canvas.

## Blocking findings

1. `EVENTS_OFFICIAL_ASSET_AUTHENTICITY`: replace the generated held-out SVG artwork in source-mapped Home Events with real official event assets matching the frozen source organism.
2. `RECOMMEND_MEDIA_ORGANIZATION_REPLACED`: restore five distinct official campaign/media images and readable wanted-poster layouts; the repeated 94×66 product icon is not a valid substitute.
3. `NEW_ARRIVAL_CONTROLS_INERT`: make both visible rail controls change the presented rail state, then prove before/after state without inventing unsupported drag or active-slide semantics.
4. `HELD_OUT_PROOF_ABSENT`: demonstrate generative reuse on a separate held-out page; do not mix held-out fixtures into the source-mapped Home evidence.

Evidence files are in `captures/`, machine probes in `probes.json`, the independent assessment in `assessment.json`, and the source/demo comparison matrix in `comparisons/section-comparison.md`.
