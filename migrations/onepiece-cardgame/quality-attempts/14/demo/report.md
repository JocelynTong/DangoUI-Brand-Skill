# Attempt 14 Demo revision — Home Indicator

Implementation self-check only; this is not the final QA verdict.

- The normal ONE PIECE phone mockup still owns an independently scrollable `phone-screen`.
- The indicator is an absolute child of the phone chassis, inset by the scaled frame border.
- Its background now fades upward to transparent instead of drawing a solid full-width footer strip.
- The content safe inset is larger than the indicator height and the final footer remains reachable.
- At a true 390px no-shell viewport the indicator is absent.
- The shared layout contract now blocks an opaque, document-owned indicator footer.
- Layout-contract tests and the production build pass.

Status: ready for fresh independent Blind QA.
