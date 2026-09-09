# Blind QA R2 — FAIL

The proportional scaling formula passes, but the complete-composition clipping and interaction requirements fail.

- Whole browser: 390×844 px; CSS viewport: 354×767 px at DPR 1.100000.
- Hero available width: 346.917603 px.
- Logical canvas: 1440×716 px.
- Expected scale: 0.240914; computed transform: `matrix(0.240907, 0, 0, 0.240907, 0, 0)` with origin `0 0`.
- Expected height: 172.493474 px; actual: 172.488113 px.
- Clip rect: x=3.813920, width=346.917603 px.
- Canvas rect: x=-8.181818, width=346.906219 px.
- Left crop: 11.995738 px; unused right space: 12.007121 px.
- Background, navigation row, and carousel control row are therefore not fully within the clip.
- Following-section gap: 0.000002 px (passes ≤8 px).
- Document and `.phone-screen` horizontal overflow: 0 px.
- Phone screen scroll: 3891/802 px; demonstrated 0 → 480 → 0.
- Carousel buttons change campaign state and can restore campaign 1, but focus scrolls the `overflow:hidden` Hero wrapper to 75.909088 px. The canvas moves to y=-66.363632 and only 96.579027 px of its 172.488113 px height remains intersecting the clip.
- Runtime console errors: 0.

Blocking owner: `demoImplementationAgent` (`demoImplementation`).

Evidence: `captures/demo-phone-browser-390x844-viewport.png`, `captures/demo-phone-browser-390x844-slide2.png`, and desktop captures in the same directory.
