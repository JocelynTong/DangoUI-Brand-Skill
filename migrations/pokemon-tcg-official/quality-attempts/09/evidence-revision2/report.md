# TCG Live Evidence revision 2

## Verdict

**PASS_WITH_MOTION_UNRESOLVED.** Desktop and mobile structure, geometry, background, assets, copy hierarchy and responsive reordering are now independently frozen. Entry motion is deliberately downgraded and cannot be required by Interpreter or Direction.

## Authoritative captures

- `source-tcgl-desktop-1440x900-settled.png`: real `1440 × 900` content viewport; complete `1440 × 624` target section is visible.
- `source-tcgl-mobile-390x844-settled.png`: real `390 × 844` content viewport; complete `390 × 644.625` target section, top V seam, laptop composition and copy panel are visible together.

Desktop is copy-left/assets-right. Mobile is assets-first/copy-second. The background is a red/gold V seam plus pale-gray honeycomb raster—not a solid-red section.

## English copy authority

Chrome translated the stable proof screenshots. They are authoritative only for geometry and composition. The pre-translation English visible DOM/computed record is authoritative for copy:

- H2 `POKÉMON TCG LIVE`: Kanit 700; desktop `40/44`, mobile `28/30.8`.
- Body: PT Sans 400, `18/28.8` at both viewports.
- CTA `Learn More`: PT Sans 700; desktop `20/24`, 56px; mobile `18/22.5`, 51.297px.
- No kicker exists.

## Motion disposition

The source exposes `vp-pop`, `vp-slide`, and stagger classes plus initial hidden transforms. However, it did not provide a reliable reset/retrigger path. In repeated 390px attempts asynchronous reflow moved the target section out of the viewport between the nominal 0ms and 120ms frames. Those frames and all revision-1 motion captures are rejected.

Therefore entry motion is **unresolved/candidate-only**. It must not be handed to implementation as observed behavior.

## Required downstream rebind

Interpreter and Design Direction must bind only to `evidence-revision2/brand-evidence.json` and `evidence-revision2/section-fidelity-source.json`. Revision-1 motion claims are invalid.
