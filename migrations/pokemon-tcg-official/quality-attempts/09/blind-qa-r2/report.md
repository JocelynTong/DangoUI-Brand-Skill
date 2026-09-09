# Attempt 09 Revision 2 — Fresh Blind QA / TPP

## Verdict

**PASS** — no blocking finding. `earliestFailureNode: null`.

This review used only the frozen goal, revision-2 Evidence and Interpreter outputs, approved Design Direction, revision-2 settled captures/probes/section manifest, and the live Demo. It did not use implementation rationale or the previous QA verdict.

## Settled source-to-demo comparison

| Check | Source authority | Demo result | Verdict |
| --- | --- | --- | --- |
| Desktop proof surface | Independent 1440×900 content viewport; section x=0, width=1440, height=624 | x=0, width=1440, height=624 | PASS |
| Desktop composition | Copy-left, assets-right | Copy x=12/w=696; scene x=612/w=778 | PASS |
| Mobile proof surface | Independent 390×844 content viewport; complete section 390×644.625 | x=0, width=390, height=644.625 | PASS |
| Mobile composition | V seam + honeycomb, assets-first, opaque full-width copy second | Scene 374×258.625 first; copy 390×314.1875 second | PASS |
| Background | Full-bleed raster with red/gold V seam and pale honeycomb body | Correct source asset SHA and visible hierarchy | PASS |
| Asset scene | Five independent assets with laptop rear, Pikachu/phone foreground, avatars above | Five separate DOM assets, matching SHA identities and z-order 1/3/4/5/6 | PASS |
| Typography | H2 Kanit 40/44 → 28/30.8; body PT Sans 18/28.8; CTA 20/24 → 18/22.5 | Computed values match both breakpoints | PASS |
| Copy structure | H2, paragraph, CTA; no kicker | Matches | PASS |
| CTA | White; foreground black → gold on hover; `/en-us/tcgl/` | White; `rgb(0,0,0)` → `rgb(226,186,101)`; correct absolute target | PASS |
| Overflow | No horizontal overflow | None at section or document level | PASS |
| Regression | Hero and WHAT'S NEW remain intact | Desktop 1440-wide and mobile 390-wide; expected heights retained | PASS |

The stable source screenshots were browser-translated and were therefore used only for geometry and composition. English copy and typography were judged from the pre-translation DOM/computed evidence, as required.

## Motion disposition

Viewport-entry motion is **UNRESOLVED / UNSCORED**. The old invalid frames and revision-2 reflow-invalidated frames were not used. This QA makes no source-exact claim about motion and does not fail the settled implementation for omitting an exact trajectory, timing, or stagger.

## Three independent proofs

- **Evidence Fidelity: PASS.** Every scored high-salience decision traces to settled visual evidence and/or pre-translation computed evidence.
- **Structural Fidelity: PASS.** Full-bleed background, responsive reading order, local copy panel, and all five independent asset layers are preserved.
- **Generative Proof: PASS.** Existing Hero and WHAT'S NEW held-out proof remains intact; the TCG Live source-calibration section is correctly treated as calibration rather than falsely labeled as generative output.

## Captures

- `captures/source-desktop-1440x900-settled.png`
- `captures/demo-desktop-1440x900-settled.png`
- `captures/demo-desktop-1440x900-hover.png`
- `captures/source-mobile-390x844-settled.png`
- `captures/demo-mobile-390x844-settled.png`

Machine-readable detail is in `probes.json` and `visual-qa-assessment.json`.
