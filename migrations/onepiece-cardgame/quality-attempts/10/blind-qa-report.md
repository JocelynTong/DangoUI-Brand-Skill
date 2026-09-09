# ONE PIECE Home footer — Blind QA / TPP report

- Date: 2026-09-01
- Live target: `http://127.0.0.1:5177/#/brand/onepiece-cardgame/pages/onepiece-cardgame-home`
- Source viewport: 1280×720
- Demo capture viewport: 1164×655, phone viewport 243.87×528
- Verdict: **FAIL — blocked by responsive spatial composition**
- Earliest failing owner: **Home footer responsive geometry / spatial-composition owner**

## Screenshot-first verdict

The motion machinery is present and behaves correctly, but the visible phone composition does not close the source-to-demo spatial gap. In the settled source, Luffy, the wave, and three cards read as one wide foreground organism. In the Demo, the upper pale field dominates, the three cards are reduced to small decorations, and the character starts too low. The result reads as a tall pale poster rather than the same responsive organism.

Primary comparison: [`comparisons/footer-spatial.png`](comparisons/footer-spatial.png)

## Acceptance matrix

| Check | Verdict | Independent observation |
| --- | --- | --- |
| 1. No pale diagonal poster substitution | **FAIL** | The phone state has a dominant tall pale/diagonal field above a compressed foreground. The source foreground reads as a wide, continuous character/wave/card organism. |
| 2. Eight layers, normalized position, crop, hierarchy | **FAIL** | All eight semantic DOM layers exist and their broad left/right order is present, but foreground scale balance is not preserved. The card field is roughly 70% shorter relative to the organism; the character starts 22% down rather than spanning the organism height. |
| 3. pre-entry, 120ms, 500ms, settled, late, paused | **FAIL** | State coverage exists. Pre-entry and 120ms are credible; at 500ms the source visibly introduces Luffy/yellow energy at the lower edge, while the live phone capture still shows only the pale footer field. Settled/late/paused exist but inherit the blocking spatial mismatch. |
| 4. finite `inItem` 0.6s / 0.8s swap | **PASS** | Live 120ms: `opcg-footer-in-card, opcg-footer-in-item`, durations `0.6s, 0.8s`, iteration counts `1, 1`; settled opacity is `0`. |
| 5. card01 5s, card02/card03 8s | **PASS** | Live computed durations are `5s / 8s / 8s`, all infinite. Late transforms differ from settled. |
| 6. Pause only three loops; reveal remains settled | **PASS** | All three card transforms were byte-identical after 1200ms paused. Background/character/catch/logo stayed opacity `1`; `inItem` stayed opacity `0`; `is-in` persisted. |
| 7. Phone scroll, title fonts, existing-page regression | **PASS** | Phone scroll remained functional (`scrollHeight 3223`, `clientHeight 528`, top restored to `0`). `document.fonts.status` was `loaded`; Alfa Slab One, Noto Serif, Poppins, and Oswald checks returned true. No browser console warning/error was observed. |

## Blocking spatial evidence

Ratios below are normalized to the footer organism box, so the desktop/phone comparison is scale-independent.

| Layer | Official source | Live Demo | Difference |
| --- | ---: | ---: | --- |
| card01 height | 0.399 | 0.116 | −71% |
| card02 height | 0.201 | 0.060 | −70% |
| card03 height | 0.210 | 0.062 | −71% |
| character top | 0.000 | 0.220 | shifted down 22% |
| character height | 1.000 | 0.780 | −22% |
| catch width | 0.161 | 0.320 | +99% |
| logo width | 0.429 | 0.660 | +54% |

This is not a uniform responsive scale. It changes which layers dominate: cards become minor decoration while catch/logo are enlarged, and the visible character/wave mass arrives too late and too low.

## Temporal evidence

- Default/pre-entry: footer class has no `is-in`; background and character opacity are `0`.
- 120ms continuous capture: background opacity `0.0508`; character/catch/logo remain hidden; `inItem` remains visible and finite.
- 500ms continuous capture: background opacity `0.5137`, character opacity `0.8029`, but the character remains outside the visible phone slice because of its responsive vertical placement. This is the first visibly divergent time slice.
- Settled: background/character/catch/logo opacity `1`; `inItem` opacity `0`; show cards remain visible.
- Late: all three card transforms changed with the expected independent durations.
- Paused: only the three infinite transforms froze; reveal layers and the finite swap remained terminal.

## Executable difference for the owner

Keep the current animation names, delays, finite/infinite boundaries, and pause handler. Change the narrow-layout geometry only:

1. Scale the foreground family coherently instead of shrinking cards independently and enlarging type.
2. Raise/expand the character so its visible silhouette spans the organism and is already visible at the 500ms checkpoint.
3. Restore the three-card salience toward the source-normalized height ratios (~0.40 / 0.20 / 0.21), while preserving card01 > card02 ≈ card03.
4. Reduce the dominant empty pale field so the settled phone crop reads as the same wave/character/card closure, not a poster.
5. Re-capture the same continuous pre-entry → 120ms → 500ms sequence plus settled/late/paused after the geometry change.

Until those screenshots close visually, the footer is blocked and cannot receive PASS.

## Artifacts

- Spatial comparison: [`comparisons/footer-spatial.png`](comparisons/footer-spatial.png)
- Comparison HTML: [`comparisons/footer-spatial.html`](comparisons/footer-spatial.html)
- Full comparison HTML: [`comparisons/footer-source-live.html`](comparisons/footer-source-live.html)
- Live captures: [`captures/`](captures/)
- Machine-readable receipt: [`receipt.json`](receipt.json)

