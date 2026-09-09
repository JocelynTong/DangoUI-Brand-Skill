# Attempt 10 Pokémon TCG Pocket — Fresh Blind QA R2

## Verdict

**REWORK.** The responsive URL correction is valid, but the desktop visual composition still has a high-salience background-layer mismatch. The supplied “generative proof” also only repeats the source responsive behavior and is not a held-out generation.

| Proof | Verdict | Reason |
| --- | --- | --- |
| Evidence Fidelity | FAIL | Revision 2 correctly proves different responsive URL roles with identical bytes, but it does not freeze the desktop background's full-section layer extent. |
| Structural Fidelity | FAIL | Mobile matches closely; desktop replaces the pale artwork exposed around the right inset panel with solid black. |
| Generative Proof | FAIL | Desktop-to-mobile reflow is source-observed reproduction, not an independent content/structure variation. |

## Primary blocker: desktop background stacking

At 1440px the official structure is:

1. one `1440 × 476.195` background-image layer spanning the entire Pocket section;
2. a logical `720 / 720` content row;
3. an inset black copy panel inside the right half, leaving the background visible above and below it.

The Demo keeps the `720 / 720` row but places the background image only inside the left asset field and gives the whole section a black base. Therefore the right-side top and bottom margins are black. This is directly visible by comparing `../evidence-revision2/captures/desktop-1440-background-use.png` with `../demo/captures/desktop-1440-settled.png`.

- Earliest failure node: `Evidence`
- Failure owner: `Brand Researcher`
- Why downstream followed it: Interpreter and Direction froze column identity and asset identity but never froze the background as an independent full-section structural layer.
- Required return path: Evidence → Interpreter → Direction → Demo → new Blind QA.

## Secondary blocker: generative proof

`demo-revision2/generative-proof.json` lists the official desktop-to-mobile reflow as its intentional variation. That proves source calibration only. It does not demonstrate that the learned Pocket rules can generate a different bounded content or structure.

- Earliest failure node: frozen Goal / Design Direction
- Failure owner: `Design Director / Orchestrator`
- Required rework: define one small held-out Pocket callout variation, then let Demo implement it separately from the source-calibration surface.

## What passed

- Responsive asset semantics: desktop and mobile URL names differ, but both official files and both local files are `720 × 464` and share SHA-256 `4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`. No visible swap was required or rewarded.
- Mobile composition: source `334.234 + 408.789 = 743.023px`; Demo `334.227 + 408.789 = 743.016px`, with asset-first and black copy second.
- Authentic composite: `logo-cards.png` loads at `500 × 306`; local SHA-256 `27f2453e0eea3b4af7e63c134a891ea15817580f62fcffe3818be5e592638009`.
- Type: Kanit italic 700 H2 at `40/44` desktop and `28/30.8` mobile; PT Sans body at `18/28.8`.
- CTA: real `https://tcgpocket.pokemon.com/en-us` destination; foreground changes black → `rgb(226,186,101)` on hover and restores on both viewport classes.
- Scrolling: mobile `.phone-screen` measured `scrollHeight=2547`, `clientHeight=821`, and `scrollTop 0 → 1725.5 → 0`.
- Regression: Hero changed `variant-1 → variant-2 → variant-1`; News changed pages and restored; all five TCG Live foreground assets loaded with non-zero natural sizes.
- Pocket motion intermediates remain **UNRESOLVED / UNSCORED**, as required.

## Machine checks

- Design Direction validator: PASS.
- Section Fidelity strict validator: PASS, but it trusted the manifest's declared layer status and did not detect the rendered background extent mismatch.
- Brand Preview validator: PASS with the existing remote-asset `naturalWidth` reminders.
- `npm run build`: PASS (`25 modules transformed`).

These protocol/build passes do not override the rendered blocker.
