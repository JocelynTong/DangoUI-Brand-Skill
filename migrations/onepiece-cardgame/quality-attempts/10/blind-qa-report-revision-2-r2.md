# ONE PIECE Home footer revision 2 — Blind QA / TPP

Verdict: **REWORK**  
Earliest failure node: **Demo Implementation Agent**  
Failure owner: **demoImplementationAgent**

## Outcome

Revision 2 does not close the user's footer incident. The animation primitives are now present, but the visible composition is still a pale vertical poster rather than the official horizontal footer organism. Live `.footerIllustBg` has no loaded image source and computes to a generic pale `linear-gradient + repeating-linear-gradient + radial-gradient` stack, so the official edge-spanning blue wave is actually absent. Therefore `wrongBackgroundClosed=false` and `missingMotionClosed=false` under the user's rule that both must be genuinely closed before PASS.

Three independent proof verdicts:

- Evidence Fidelity: **FAIL**
- Structural Fidelity: **FAIL**
- Generative Proof: **PASS** (does not compensate for either failure)

## Blocking findings

1. `FOOTER_BACKGROUND_WAVE_SUBSTITUTED`

   The official v10 background is an edge-spanning blue wave behind every foreground layer. Live revision 2 does not load a wave image for `.footerIllustBg`; computed style is a generic pale three-gradient stack. This directly reproduces the user-reported wrong-background failure.

2. `FOOTER_SPATIAL_HIERARCHY_POSTER_REGRESSION`

   Official v10 is an edge-spanning horizontal organism: Luffy is the dominant left mass, the wave spans the field, three cards occupy center-right/far-right, and catch/logo anchor the lower right. Live revision 2 remains a narrow poster in which Luffy and the cards fill and occlude the phone.

   The mismatch is measurable in the same normalized viewport basis:

   | Layer | Official width | Live width | Official x | Live x |
   |---|---:|---:|---:|---:|
   | Luffy | 0.5469 | 2.2300 | -0.0297 | -0.5800 |
   | Card 01 | 0.1594 | 0.6925 | 0.7870 | 0.4702 |
   | Card 02 | 0.0870 | 0.3815 | 0.5792 | 0.4546 |
   | Card 03 | 0.0849 | 0.3627 | 0.4490 | 0.1783 |
   | Catch | 0.1615 | 0.1615 | 0.7740 | 0.7885 |
   | Logo | 0.4292 | 0.4292 | 0.5271 | 0.5408 |

   Catch/logo and background width remain close to the contract while only character/cards are enlarged roughly fourfold. This is not an allowed uniform responsive scale and is the direct cause of the poster appearance.

3. `FOOTER_INTERMEDIATE_STATE_FIDELITY_MISMATCH`

   At official 120ms only a faint background field enters; the character and cards are absent. At live 120ms the oversized three-card composite already occupies the lower-right phone edge. At official 500ms only the top of Luffy enters and catch/logo remain delayed; live 500ms already stages the card composite over Luffy. The CSS duration strings are correct, but the visible sequence is not.

4. `HOME_DISPLAY_FONT_ROLE_EXPANSION`

   All four required fonts load and pass `document.fonts.check`. However, live Home applies `OPCG Alfa Slab One` at weight 700 to long article titles such as “Starter Deck -Green Roronoa Zoro- arrives soon”. The frozen pattern limits Alfa Slab One to short oversized English section labels at weight 400 and explicitly lists long titles under `notFor`.

## Verified passes

- Default/pre-entry class state exists.
- Finite card composite uses `0.6s` and `0.8s`, one iteration each.
- Settled card loops use `5s / 8s / 8s`, run infinitely, and all three transforms change in the late frame.
- Pause freezes only the three loops; transforms stay identical after 1200ms and reveal layers remain settled.
- Home phone page scrolls and restores: `scrollHeight=3129`, `clientHeight=583`, `scrollTop 0→480→0`.
- Four required font resources are loaded.
- Held-out Field Notes renders five sections and five loaded independent images, and scroll restores `0→104.09→0`; Generative Proof passes independently.

## Evidence artifacts

- Six-state source/demo comparison: `blind-qa-r2-comparisons/footer-source-vs-demo-six-states.png`
- Live state captures: `blind-qa-r2-captures/`
- Browser telemetry: `blind-qa-r2-browser-probes.json`
- Machine assessment: `visual-qa-assessment-revision-2-blind-r2.json`

No Goal, Evidence, Intent, Demo, implementation code, or prior QA artifact was modified.
