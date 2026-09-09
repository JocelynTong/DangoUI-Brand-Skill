# Attempt 11 Revision 2 — Blind Visual QA

## Verdict

**FAIL**

Failure owner: **Demo implementation — Home mobile structural fidelity and interaction semantics**. The host-collapse blocker is closed, but multiple core Home regions remain simplified list/card accumulations rather than the frozen source structures.

This review used only the sealed Goal, attempt-11 mobile Evidence/checklist, interpreter mobile contract, approved patterns, current inventories/manifests, and a fresh live Demo browser session. No implementation receipt, self-check, or earlier QA verdict was read.

## Three-proof decision

| Proof | Result | Decision basis |
|---|---|---|
| Evidence fidelity | **FAIL** | The live Hero is a different Yellow Captain Kid campaign composition from the frozen mobile Hero evidence; Welcome omits the frozen supporting media/movie sequence; Products/Events and mid-page modules do not preserve several high-salience source structures. Asset authenticity alone cannot compensate. |
| Structural fidelity | **FAIL** | True narrow reflow exists, but Events is reduced to plain white rows under a black heading instead of the source's strong red framed pickup-event organism; Recommend is reduced to one generic row instead of the wanted-poster rail; Videos is reduced to one row; Welcome is substantially shortened; New Arrival has no actionable rail controls. These are structure/density failures, not merely content substitutions. |
| Generative proof | **PASS (narrow)** | The held-out `CAPTAIN'S FIELD NOTES` module is visibly independent content and reuses hard-black heading/taxonomy/editorial-row roles without one-to-one source-page text. This pass cannot compensate for either core proof failure. |

## Contract checks

### Host canvas and full-page behavior — PASS

- Fresh viewport: exactly **390×844 CSS px**.
- Preview, phone wrapper, phone screen and Home canvas: **390px usable width**.
- Document: **390px scrollWidth × 7271px scrollHeight**; no document-level horizontal overflow.
- All required regions produced visible live pixels and the page scrolls from top through legal content.
- This closes the earlier infrastructure symptom (10px preview / 0px canvas).

### Navigation / Hero — FAIL

- Geometry is real mobile layout: full-width masked Hero, 64px top navigation region, active media remains dominant, and carousel controls are 44×44.
- The rendered campaign hierarchy is not the frozen source campaign/composition. The Demo uses a full-bleed Kid portrait with duplicated description/product blocks and eight large controls; the frozen source shows a materially different compact campaign/news-led composition.
- The visible `MENU` affordance is not present in the semantic actionable inventory; it cannot be credited as a measured >=44px control.

### Welcome — FAIL

- Width/inset/heading hierarchy and 44px CTA pass basic reflow.
- The source's extended nautical story surface, media/movie content, and repeated invitation rhythm are collapsed to a short heading, paragraph and single button. This is structural deletion, not responsive translation.

### News / New Arrival — PARTIAL, overall FAIL

- News preserves five scan-friendly image/metadata/title rows and good text hierarchy.
- New Arrival preserves a bounded horizontal rail; body width stays 390px.
- However, no New Arrival previous/next control appears among the live actionable elements. The rail therefore fails the mobile contract's required rail-control semantics and touch verification.

### Products / Events / middle modules — FAIL

- Products does reflow into readable stacked image/text rows, but it substitutes a uniform generic row list for the source's product feature plus `WHAT YOU WANT` category composition.
- Events is a quantity-preserving list, but its defining source structure is lost: the source's red framed pickup-event cards and stronger image/text framing become ordinary white rows. This is the explicit core-region “quantity pile but structure unlike source” failure.
- Schedule is visible. Recommend and Videos are present but each is reduced to a single generic editorial row, losing the source wanted-poster rail and richer video module density/crop behavior.
- Unsupported reservation actions were not found.

### Footer illustration / navigation / legal — PARTIAL, overall FAIL

- The illustration and wave are distinct from the navy structural footer. At 0ms the illustration is intentionally faint; by 300–800ms the Luffy/wave composition enters and settles, so the mobile motion regression passes.
- Footer navigation and legal groups are readable and vertically stacked; no horizontal overflow occurs.
- Footer labels are rendered as text rather than links/buttons. The live page exposes only 11 actionable elements total, none in Footer, so >=44px footer link hit areas cannot be credited.

### Desktop phone shell regression — PASS WITH NOTE

- At 1440×900, the phone shell remains **390×821px** and its internal screen is **372×803px**, `overflow-y:auto`, with **4835px** scroll content while the host document stays 900px high.
- Internal scrolling reaches the Footer. The first bottom capture can show transient `asset missing` placeholders during motion/asset entry, while the 700ms settled capture restores the illustration and Footer assets. The settled regression passes; the transient placeholder is recorded.

## Touch and overflow probe

- 11 semantic actionables were found; every measured actionable is at least **44×44 CSS px**.
- This does **not** satisfy the whole-page touch contract because navigation Menu, New Arrival rail controls, product/event rows, and Footer navigation are absent from the semantic actionable set.
- `document.scrollWidth === viewport.width === 390`; masked Hero and Footer overscan remain section-bounded.

## Failure closure required

1. Rebuild Events as the source-like red framed pickup-event organism, not ordinary editorial rows.
2. Restore Welcome's supporting media/movie rhythm and the mid-page Recommend wanted-poster rail plus richer Videos structure.
3. Add semantic, >=44px controls for Menu, New Arrival rail, content rows where they are meant to be actionable, and Footer links.
4. Reconcile the Hero against the frozen mobile source composition or provide an allowed, frozen translation that preserves its campaign hierarchy rather than only substituting another official asset.

## Evidence index

- Live measurements: [`probes.json`](../blind-qa-r2/probes.json)
- Full mobile capture: [`captures/demo-mobile-full-390x844.png`](../blind-qa-r2/captures/demo-mobile-full-390x844.png)
- Desktop internal-scroll settled Footer: [`captures/demo-desktop-phone-shell-footer-700ms.png`](../blind-qa-r2/captures/demo-desktop-phone-shell-footer-700ms.png)
- Side-by-side comparisons: [`comparisons/`](../blind-qa-r2/comparisons/)

