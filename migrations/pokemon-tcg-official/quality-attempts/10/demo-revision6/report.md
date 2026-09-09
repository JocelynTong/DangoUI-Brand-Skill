# Attempt 10 · Demo revision 6 implementation report

The normal Pokémon Home and Pocket Fixture routes again render inside the configured phone chassis. Browser measurements show a 9px frame border, 41.4666px outer radius, pseudo-element shadow, 31.5936px clipped screen radius, and `overflow-y: auto`; Home’s screen moved from `scrollTop=0` to `240` in the executable scroll test.

No-shell calibration is now opt-in only: `proof=desktop` produces a 1440px surface and `proof=mobile` a 390×844 surface. Both Pocket sections begin at x=0 and equal the calibration viewport width. On the normal held-out route, `proofRole=generative-held-out-fictional` remains present while the phone chassis remains visible, proving metadata alone cannot remove it.

Brand sections, Pocket content, CTA behavior, and held-out content were not changed. This implementation report assigns no QA or visual verdict.
