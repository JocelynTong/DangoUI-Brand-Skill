# Pokémon TCG Official — TCG Live Brand Interpretation

## Verdict

`PASS_WITH_CONSTRAINTS` for Design Director review. Evidence is sufficient to define this section's background hierarchy, desktop/mobile composition, five-layer asset scene, typography, CTA states, destination, and viewport-entry choreography.

No Demo source, Demo screenshot, implementation rationale, or prior QA verdict was inspected.

## Interpreted visual intent

This is not a red campaign block. It is a product-world callout whose background moves visually from a red/gold V-shaped threshold into a restrained pale-gray honeycomb field. The product is explained twice: first through the layered laptop, character, phone, and avatars; then through a compact black copy-and-action panel.

The defining responsive behavior is recomposition:

- Desktop uses copy on the left and the five-layer product scene on the right.
- Mobile presents the asset scene first, then uses a full-width opaque-black copy panel.
- The mobile scene is approximately proportionally scaled, but the section itself is not a miniature desktop row.
- The lower boundary remains hard and exposes the following pale-blue section directly.

## Approved section-local recipe

1. Use the actual TCG Live background raster as a full-bleed field. Preserve both the red/gold top seam and the pale-gray honeycomb body.
2. Preserve the five independent transparent foreground assets. Laptop is the rear plane; Pikachu and phone overlap its lower edges; two avatars float above it.
3. Desktop: left translucent-black copy panel and right asset scene. Mobile: asset scene first and full-width opaque-black copy panel second.
4. Keep the copy hierarchy to one centered H2, one centered paragraph, and one centered CTA. Do not add a kicker.
5. Use Kanit for the H2 and PT Sans for body and CTA at the evidence-backed desktop/mobile sizes.
6. Keep the CTA white. Its hover changes only foreground text/icon from black to gold, and activation must navigate rather than behave as an inert visual control.
7. On viewport entry, visibly pop the laptop from scale `.5` while sliding/fading the copy and staggering companion assets. Keep the background static.

## Asset composition contract

The five foreground assets are not interchangeable decoration:

- Laptop: primary device and large rear plane.
- Pikachu: foreground character overlapping the lower-left laptop edge.
- Phone: secondary device overlapping the lower-right laptop edge.
- Avatar 1 and Avatar 2: floating player-identity layers above the laptop.

A flattened screenshot, a composite crop, or unrelated official Pokémon art is not an acceptable replacement. The complete group may scale to fit a narrow screen, but its layer identities and overlap relationships must remain legible.

## Typography and translation boundary

- Desktop H2: Kanit 700, `40/44`, `1.25px` tracking.
- Mobile H2: Kanit 700, `28/30.8`, approximately `1px` tracking.
- Body: PT Sans 400, `18/28.8` at both observed widths.
- CTA: PT Sans 700, `20/24` desktop and `18/22.5` mobile.

Chrome translated a stable proof capture. That screenshot remains valid for composition, asset overlap, background, and responsive order, but its Chinese wrapping is not evidence for English line breaks. Implementation must use the recorded English DOM/computed values and fluid wrapping; it must not hard-code breaks copied from the translated image.

## Scope boundaries

Every approved rule is local to the homepage TCG Live callout:

- Red is not a global section fill, primary action, or active-state color.
- Gold is not a global interaction token; it is proved here only in the seam asset and CTA hover foreground.
- The black panel is not a generic site panel, modal, card, or host-project surface.
- The honeycomb texture is not a global page background.
- The typography stack is not permission to restyle every heading, paragraph, or button.
- The entry choreography is not a universal motion preset and does not authorize parallax or background animation.

## Motion acceptance

The entry motion is approved because Evidence includes before, intermediate, and settled states plus computed transforms. A valid implementation must visibly demonstrate:

- laptop `opacity 0 + scale(.5)` to settled;
- heading/body/CTA opacity and downward-translation recovery with stagger;
- companion assets joining the stagger while preserving final overlap;
- a static background throughout.

Class names or a settled screenshot alone are not sufficient proof.

## Design Director handoff

The Design Director may approve implementation when the direction freezes:

- 1440px and 390px proof surfaces;
- the actual background asset and all five independent foreground asset identities;
- desktop copy-left/assets-right and mobile assets-first/copy-second ordering;
- before/intermediate/settled viewport-entry proof;
- an active CTA destination plus black-to-gold foreground hover;
- explicit rejection of a solid-red section, invented kicker, flattened screenshot, translated hard breaks, generic black-panel/token promotion, and background animation.

Machine-readable details are in `brand-intent.json` and `pattern-inventory.json`.
