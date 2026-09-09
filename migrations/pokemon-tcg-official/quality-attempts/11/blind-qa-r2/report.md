# Attempt 11 Revision 2 — Fresh Blind QA

Verdict: **REWORK / FAIL**. Evidence Fidelity: **FAIL**. Structural Fidelity: **FAIL**. Generative Proof: **PASS**.

`earliestFailureNode = brandInterpreter`; `failureOwnerRole = designTranslator`.

The earliest failure is a semantic omission, not the later implementation choice: frozen source CSS supplies the desktop 48/18/18px h2/body/CTA rules, but Interpreter only carries the 390 sizes and calls desktop child boxes unresolved. Direction never approves 56/20/20; the Demo renders those unsupported values. Separately, the Demo shifts every frozen 390 copy-stack child about 8.4px downward, omits the approved CTA inset frame, and changes the approved shadow.

Revision2's section manifest is also not fresh/provenance-safe: it binds mobile responsive evidence to `demo/captures` rather than `demo-revision2/captures`, records the wrong official source URL (missing `/championship-series/`), omits required 2x provenance, and calls a clipped aria-live node a visible changed property. The strict section gate passes because it checks field presence and file existence, not these semantics.

Verified passes include normal phone shell, rounded screen, fixed Home Indicator, reversible scrolling, preceding Hero/What's New/TCG Live/Pocket continuity, Championship/Play! Pokémon adjacency, transparent background ownership, official runtime asset hashes, CTA default/hover/focus/destination behavior, held-out visible focus with no `aria-pressed`, held-out state/reload restoration, and all four requested machine gates exiting 0.

Minimal rollback: preserve Goal and Evidence; reopen Interpreter only for the archived desktop typography/spacing semantics, refresh Direction where needed, then revise only the Championship calibration section/CTA and Revision2 manifest/captures. Preserve the preceding homepage implementation and held-out concept. A new Blind QA is required after the fix.

Key captures:

- [Desktop calibration vs Play! Pokémon](captures/desktop-championship-play-1440x900.png)
- [390 calibration](captures/mobile-championship-aligned-390x844.png)
- [Normal phone shell before scroll](captures/normal-phone-before-1200x900.png)
- [Normal phone shell at Championship](captures/normal-phone-scrolled-1200x900.png)
- [Held-out keyboard focus](captures/heldout-focus-390x844.png)
- [Held-out desktop](captures/heldout-desktop-1440x900.png)
