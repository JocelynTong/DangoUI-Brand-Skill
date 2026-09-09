# Attempt 08 Blind QA / TPP

## Verdict

**REWORK** — earliest failure node: **Demo Implementation Agent**.

Evidence Fidelity passes, but Structural Fidelity and Generative Proof fail independently. Asset identity, responsive density and carousel motion cannot compensate for the blockers below.

## Blocking findings

1. **P0 — mobile carousel changes the reading position.** With WHAT'S NEW normally aligned at `.phone-screen.scrollTop = 352.5`, activating Next moves the inner viewport to `582`; Previous restores story 1 but leaves scrollTop at `582`. The section heading and archive link disappear from view. This violates the QA contract's explicit before/after/restored scroll check.
2. **P0 — approved section typography is not implemented.** The title has the correct 48/32 sizes but uses Oxanium rather than approved Kanit. “See More News” is Oxanium 12px instead of PT Sans 18px/800 italic, and CTA labels are Oxanium 12px instead of PT Sans 20px desktop / 18px mobile. The story headline is correctly PT Sans 20px/26px on mobile.
3. **P0 — the following Section seam is the wrong color.** The frozen goal and design direction require WHAT'S NEW to end directly into the source-supported red TCG Live boundary. The live Demo begins the following Section with `rgb(217, 239, 247)` light blue. Because the seam is explicitly inside `mustPreserve`, this is a current-scope blocker, not a future-section issue.
4. **P1 — reduced motion is not proven.** Neither the allowed Demo artifacts nor the live proof surface demonstrate the required instant reduced-motion settled state. The active browser preference is normal motion and no observable reduced-motion media rule was exposed, so Blind QA cannot pass this claim.
5. **P1 — the supplied Generative Proof is calibration-only.** It uses the same six official source stories and the same breakpoint regrouping as the source. No held-out content or changed structure demonstrates that the learned pattern can regenerate a different information payload.

## What passed

- White Section field is full bleed: `1440/1440` and `390/390`, with no phone chassis or showcase gutter.
- Desktop uses two 576px cards with 24px gap and three pages; mobile uses one 390px card and six pages.
- All six source assets were observed across the three desktop pages; each loaded at `578×325`.
- Images render at `576×323.875` and `390×219.289`, `object-fit: contain`, without crop.
- Reading order is image → headline → CTA.
- Previous/Next targets are `60×60`; every pagination target is `44×44`.
- Live carousel interaction changes image, headline and CTA identity. Immediate computed states contain directional translation, opacity interpolation and scale interpolation; settled and story restoration work.
- Mobile Hero remains `390×416`; no horizontal overflow was observed.
- Browser console had no errors or warnings.

## Three-proof assessment

| Proof | Verdict | Reason |
| --- | --- | --- |
| Evidence Fidelity | PASS | Required source geometry, assets, hierarchy and motion claims are traceable; unresolved source facts remain explicitly unresolved. |
| Structural Fidelity | FAIL | Typography roles, red following-section seam and interaction scroll stability diverge from the approved Pattern/direction. |
| Generative Proof | FAIL | The submission reproduces source content and source responsive behavior, but has no held-out generative change. |

## Required re-verification

After remediation, use a fresh Blind QA context and repeat both viewports. Mobile verification must record `.phone-screen.scrollTop` before Next, after settled, after Previous and after direct-dot/keyboard activation. Reduced-motion verification needs its own runtime capture/probe. Do not reuse this verdict.

Captures and measured probes are in `blind-qa/captures/` and `blind-qa/browser-probes.json`.
