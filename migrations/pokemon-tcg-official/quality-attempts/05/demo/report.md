# Attempt 05 — Compact interactive Pokémon Home Hero

## Outcome

Implemented a host-transferable compact Hero for the Pokémon TCG Official Home demo. This is a generative host adaptation and does not replace the recorded full-height official mobile source truth.

## What changed

- Replaced the 1183px mobile study geometry with a 416px compact composition on narrow internal proof surfaces.
- Kept the official mobile campaign background as an art-directed cover crop.
- Kept the official campaign logo, TCG logo, CTA, featured card and live carousel controls in the compact area.
- Made the featured card the primary interaction: official front and official back, reversible with pointer, Enter and Space, rendered with CSS `rotateY`.
- Added a reduced-motion path that removes the visible transition duration.
- Converted the carousel affordance to compact functional dots.
- Corrected the next Home section's inherited foreground so its title is visibly readable in the initial viewport.

## Self-check result

Implementation probes pass: Hero height, next-section visibility, CTA target size, front/back asset identity, pointer and keyboard reversibility, 3D transform, reduced-motion rule, carousel restore, internal-container response, horizontal overflow and console state.

This report does **not** assign final visual fidelity PASS. Independent Blind QA must inspect the captures and live page.
