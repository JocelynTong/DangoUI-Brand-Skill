# Pokémon TCG Official — WHAT’S NEW Brand Interpretation

## Verdict

`PASS_WITH_CONSTRAINTS` for Design Director review. The Evidence is sufficient to define the section’s composition, responsive reflow, asset treatment, CTA role, carousel controls, and user-triggered translate/fade/scale transition. It is not sufficient to define original-English line breaks, an exact entry-on-scroll animation, the full CTA hover background layer, or source-specific keyboard focus styling.

No Demo source, Demo screenshot, implementation rationale, or prior QA verdict was inspected.

## Interpreted visual intent

WHAT’S NEW is an open editorial stage, not a framed product grid or an inset application panel. A large italic heading establishes the section, independent 578:325 media does most of the recognition work, and compact black CTAs conclude each story. Carousel mechanics are deliberately placed at the content edges so the center remains focused on editorial imagery.

The defining responsive behavior is **recomposition**, not proportional shrinking:

- Desktop uses a left/right header row and two equal story cards per page.
- Mobile stacks and centers the header, then shows one edge-to-edge story per page.
- The six stories therefore become three desktop pages and six mobile pages.
- Images preserve their intrinsic 578:325 ratio without crop at both sizes.

## Approved implementation recipe

1. Render a viewport-wide white section with no rounded shell, inset panel, or decorative frame.
2. Keep the desktop title and archive link in one row; stack and center them at 390px.
3. Preserve the card’s image → centered headline → centered CTA reading order.
4. Use two cards with a 24px gutter at 1440px and one full-width card at 390px.
5. Preserve the independent news assets and their 578:325 ratio; a source screenshot crop is not a valid runtime asset.
6. On carousel navigation, change the visible image, headline, and CTA identity. The outgoing content translates and fades; incoming content fades and scales to 1 over the observed 0.4s opacity interval.
7. Keep black edge controls and centered pagination. Yellow is allowed only as the carousel’s localized current/available emphasis; it is not a global active or core-action color.
8. End the white field cleanly so the next contrasting section begins immediately below.

## Section-local rules, not global tokens

- The white section field does not establish a global page surface.
- Kanit 700 italic is approved for this section title, not every heading.
- PT Sans story typography is approved inside this news pattern, not as a new global body rule.
- The black CTA is a news-card action, not a universal primary button.
- The card shadow is not a global card elevation.
- Yellow carousel emphasis must not become a yellow section title, global active state, or primary CTA token.
- The translate/fade/scale swap belongs to this news carousel and does not prescribe Hero or entry-on-scroll motion.

## Motion boundary

The carousel transition is approved because before, intermediate, and settled states visibly prove it on desktop and mobile. A valid implementation must change story identity and expose a visible intermediate state; updating only an index, class, or dot is a blocking failure.

The section’s viewport-entry motion remains unresolved. Computed transitions and `vp-slide` / `vp-pop` states prove that a mechanism exists, but settled screenshots do not prove its start transform or trajectory. It may be omitted or retained as a candidate; it cannot be presented as an exact learned rule.

## Translation warning

Chrome translated the settled page into Chinese. The captures remain valid for geometry, asset identity, layout, and computed font families, but their Chinese line breaks are not evidence for English wrapping. Implementation must use fluid text layout and must not hard-code breaks copied from those screenshots.

## Handoff conditions

The Design Director may approve implementation if the direction preserves the section-local scope above. Demo handoff must include:

- desktop and 390px proof surfaces;
- six story assets with explicit source identity;
- two-up desktop and one-up mobile page models;
- before / ~120ms transition / settled carousel captures at both sizes;
- a check that image, headline, and CTA identity actually changed;
- no claim of exact entry-on-scroll fidelity without new Evidence.

The machine-readable rules are in `brand-intent.json`; the approved and unresolved pattern inventory is in `pattern-inventory.json`.
