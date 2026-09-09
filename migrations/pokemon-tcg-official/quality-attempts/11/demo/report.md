# Attempt 11 Demo Implementation

Implementation is ready for a fresh Blind QA. This report is an implementation receipt, not a QA verdict.

## Source calibration

- Added Pokémon Championship Series directly after the retained TCG Pocket section.
- Desktop proof renders a transparent 1440×720 section with 720px copy left and 720px official image right.
- Mobile proof renders the 390×390 official image first, followed by the 374×439.172 copy column.
- CTA states were exercised as black settled, center-expanding gold hover, and black keyboard focus with a visible blue outline. The href is the frozen Championship destination.
- The official 1x and 2x archived image files are runtime assets. No Evidence screenshot is used at runtime.

## Held-out fixture

The direct Championship Fixture route is explicitly fictional. It changes the subject, copy, internal square artwork and CTA behavior while preserving the learned split-to-stack, transparent canvas, type hierarchy and CTA-state rules. Its visual is CSS-native and contains no Pokémon imagery.

## Regression self-check

Normal Home retains the phone chassis, rounded clipped screen, overlay Home Indicator and internal scrolling. A real scroll changed `phone-screen.scrollTop` from 0 to 2500 while phone, screen and indicator rectangles remained fixed. Hero, What's New, TCG Live and Pocket remain in their previous order and were not edited.

Build completed successfully. Fresh Blind QA should consume `qa-input-manifest.json`.
