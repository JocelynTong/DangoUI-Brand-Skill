# Attempt 08 Revision 2 — Fresh Blind QA / TPP

## Verdict

**PASS**

- `earliestFailureNode`: `null`
- `failureOwnerRole`: `null`
- Blocking findings: none

This review did not read the implementation report, receipt, source rationale, or the previous QA verdict. It used the frozen goal, Evidence, Interpreter, approved design direction, Revision 2 proof artifacts, exact source/Demo captures, and direct Demo interaction.

## Independent three-proof result

| Proof | Verdict | Independent evidence |
| --- | --- | --- |
| Evidence Fidelity | PASS | Exact source/Demo captures preserve the white full-bleed field, typography roles, official media, carousel hierarchy and 24px red seam. Live computed values match Kanit/PT Sans requirements. Unresolved source facts were not promoted. |
| Structural Fidelity | PASS | Desktop is 2 stories / 3 pages; mobile is 1 story / 6 pages. Six 578:325 assets render uncropped. Next, previous, dots and Enter change visible story identity without moving the aligned scroll position. Directional translate/fade/scale is present. |
| Generative Proof | PASS | A separate Deck Lab fixture uses independent SVG artwork and different content while preserving image → headline → decisive black CTA. It is visibly labeled non-official and remains outside the official six-story carousel. |

## Mobile 390×844 live checks

- At the aligned `WHAT'S NEW!` position, `scrollTop` remained exactly `352` after Next, Previous, direct dot, Enter, and restoration.
- Title: `Kanit Official`, `32px`, `700`, italic.
- More: `PT Sans Official`, `18px`, `800`, italic.
- CTA: `PT Sans Official`, `18px`, `700`, italic.
- Section and media are full bleed at `x=0`, `width=390`; `scrollWidth === clientWidth === 390`.
- Image renders at `390 × 219.289`, ratio `1.778474`, with `object-fit: contain`.
- Previous/Next targets are `60 × 60`; all six dots are `44 × 44`.
- The settled story changed from “Get Ready to Celebrate…” to “Discover the Artists…” and restored correctly.
- The live transition exposed outgoing `pokemon-news-out-forward` and incoming `pokemon-news-in-forward`, both `0.4s`, with real translate, fade and scale values.

## Reduced-motion runtime

The first interaction replaced the visible story immediately. Runtime state showed:

- no outgoing layer;
- a single settled page;
- `animation-name: none`;
- `animation-duration: 0s`;
- `transition-duration: 0s`;
- identity already changed when sampled.

## Desktop 1440×900 review

The exact Revision 2 `1440×900` capture/probe pair was independently compared with the exact `1440×900` source capture:

- white section reaches both viewport edges;
- two equal media-first stories are visible;
- three dots represent three pair pages;
- title is 48px Kanit 700 italic;
- More is 18px PT Sans;
- CTA is 20px PT Sans;
- media remains 578:325 without crop;
- the 1440px-wide, 24px-tall red seam closes the section.

The connected external browser's desktop inspector view embeds the Demo in a 390px phone, so it was excluded as desktop fidelity evidence rather than being misreported as a 1440px proof surface.

## Scope boundary

Only the red seam is claimed as source evidence for the following section. The pale-blue modules below it remain outside Attempt 08 and were not counted as restored official content.

## Machine gate

`validate-section-fidelity --strict` returned PASS with zero failures for the Revision 2 manifest.

## Captures

- `captures/mobile-before.png`
- `captures/mobile-next-transition-120ms.png`
- `captures/mobile-next-settled.png`
- `captures/mobile-restored.png`
- `captures/reduced-motion-runtime-surface.png` (runtime-only browser surface; exact 390×844 visual input remains `../revision2/captures/mobile-reduced-motion-settled.png`)
- `captures/mobile-heldout-generative-proof.png`

`captures/excluded-desktop-inspector-surface.png` is retained only to document why the connected desktop inspector was rejected as fidelity evidence; it is not part of the PASS basis.
