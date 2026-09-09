# Attempt 14 Revision 2 — Home Indicator

Implementation self-check only; final verdict belongs to a new Blind QA.

- Removed the unsupported white translucent gradient.
- The indicator container is fully transparent; only the black bar is visible.
- Anchored the overlay to the chassis bottom rather than lifting it by the screen-frame inset.
- Reduced content padding from about 45.6px to about 15.8px.
- At the footer endpoint, visible content clears the bar by about 37.8px without creating a separate blank strip.
- Normal phone scrolling is reversible; the true 390px no-shell layout hides the indicator.
- Production build and the updated layout-contract test pass.
