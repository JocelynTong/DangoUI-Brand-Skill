# Pokémon TCG Official — WHAT’S NEW Evidence

## Verdict

`PASS_WITH_UNRESOLVED` for the isolated WHAT’S NEW implementation handoff. Section geometry, responsive structure, assets and carousel behavior are proved. Exact English line wrapping and a clean entry-on-scroll timeline are unresolved and must not be guessed.

## What the source actually does

- Desktop, 1440×900: the white section is full width and 748.59px tall in the captured state. A 48px italic Kanit title sits left while the 18px italic “See more News” link aligns right. The active carousel page contains two 576×511px cards separated by 24px.
- Mobile, 390×844: the section remains edge-to-edge. Title and secondary link stack and center. The carousel switches to one 390px-wide card per page; six source items become six pages.
- Images are independent 578×325 assets and render at the same 16:9-like ratio. No crop was observed (`object-fit: fill` with matching ratio).
- Card order is image → centered bold headline → centered black CTA. The card itself carries a modest `0 6px 10px rgba(0,0,0,.2)` shadow.
- Desktop advances a pair; mobile advances a single card. At 120ms, the outgoing item translates left and fades while the incoming item scales toward 1 and fades in. Settled change is visually and structurally real.
- The white section meets the next red TCG Live section directly. There is no rounded outer shell or inset section background.

## Captures

- Desktop settled: `captures/source-whats-new-desktop-1440x900-settled.png`
- Desktop carousel transition: `captures/source-whats-new-desktop-next-transition-120ms.png`
- Desktop slide 2: `captures/source-whats-new-desktop-slide2-settled.png`
- Desktop CTA hover: `captures/source-whats-new-desktop-card-cta-hover.png`
- Mobile settled: `captures/source-whats-new-mobile-390x844-settled.png`
- Mobile carousel transition: `captures/source-whats-new-mobile-next-transition-120ms.png`
- Mobile slide 2: `captures/source-whats-new-mobile-slide2-settled.png`

## Critical implementation constraints for Interpreter

1. Do not turn the section into an inset rounded card; its outer boundary is full-width white.
2. Do not preserve two columns on mobile. The official responsive rule is one item per page.
3. Do not crop the news images. Preserve their 578:325 ratio.
4. Do not treat dot/index changes as carousel proof. A card’s image, headline and CTA identity must visibly change with a 0.4s translate/fade/scale transition.
5. Preserve the responsive reading order rather than simply shrinking desktop.
6. Do not infer exact English line breaks from these screenshots: the connected Chrome profile translated visible English copy into Chinese. Computed type families and geometry remain valid.

## Unresolved

- Original-English text wrapping under an untranslated browser surface.
- Clean default → transition → settled frames for the initial viewport entry animation. Existing `vp-pop` / `vp-slide` nodes and staggered computed transitions prove a mechanism, not its exact trajectory.
- Keyboard focus appearance.
- The precise pseudo/background layer used during CTA hover inversion.

No local Demo files or prior QA verdicts were inspected.
