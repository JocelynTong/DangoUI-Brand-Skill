# Attempt 10 · Demo revision 7 implementation report

The source-schema home indicator is now an absolute system overlay anchored to the phone chassis instead of a relative block after `phone-screen`. Its backing is a translucent bottom gradient rather than an opaque white footer, while the system bar remains visible.

Home, Pocket Fixture, and Deck Lab were each tested through `scrollTop 0 → 240 → 0 → maximum`. Phone, screen, and indicator rectangles remained fixed; each screen remained independently scrollable. A 45.5682px bottom safe inset leaves the final content 2.2–3.0px above the overlay at maximum scroll.

In both explicit desktop and mobile proof modes the indicator computes to `display:none`, and the no-shell surfaces remain full width. No brand section, content, CTA, or held-out behavior was changed. This report assigns no QA or visual verdict.
