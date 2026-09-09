# Attempt 11 mobile evidence

Source and Demo were rendered through the live browser. The source viewport is 390×844 CSS px. The Demo browser was calibrated to an actual 387×800 CSS px viewport because the browser chrome subtracts 39×80 px from the requested override; this 3 px width difference is recorded rather than normalized away.

`source-home-full-390x844.png` and `source-home-full-actual387x800.jpg` are complete source-page captures. `demo-home-full-actual390x844.jpg` is the live Demo at the corresponding narrow browser viewport. The Demo shell collapses `.template-preview` to 10 px and the Home canvas to 0 px, so there is no honest visible per-section crop to save at that viewport. `demo-home-full-390x844.png` and `demo-viewport-*.jpg` are supplemental captures from the app's desktop shell showing its internal phone mockup; they are not treated as same-viewport PASS evidence.

The `source-section-*.jpg` files are crops of the same full-page source capture, preserving the mobile rendering coordinates reported in `mobile-responsive-checklist.json`.
