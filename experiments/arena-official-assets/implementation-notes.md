# Host landing notes

The candidate is intentionally isolated from `card-plugin2.0`. To apply it later, move the Hero as six explicit visual layers rather than exporting the whole screen as one bitmap:

1. **World layer** — `booster-art-1.jpg`, darkened and cropped around the existing Pikachu/Mew/Mewtwo ensemble.
2. **Arena context** — CSS-only red/blue light cones, overhead light ring, crowd bokeh, and elliptical floor.
3. **Broadcast layer** — `championships.jpg` inside an angled, labeled screen. This framing is important: without it, the daylight/event photo conflicts with the ensemble camera.
4. **Collectible layer** — `SV06_EN_33.png` and `2M6P_EN_23.png` anchored to the same lower stage baseline with a shared shadow direction.
5. **Information layer** — live/round score strip, headline, short value proposition, and one action.
6. **Brand/navigation layer** — the official TCG logo and existing “我的牌组” entry.

Do not transplant these regressions:

- Do not reuse `pokemon-hero-pikachu.png` as a separate hero object; the ensemble raster already supplies Pikachu in context.
- Do not use the generated empty `pokemon-arena-hero.png` behind the ensemble. It creates two incompatible perspective systems and recreates the “character pasted onto background” problem.
- Do not add more cards above the fold. Two cards are enough to connect the arena story to deck-building without turning the Hero into a product shelf.
- Do not remove the broadcast frame or `ARENA FEED` label. The frame is what makes the second photograph an in-world display instead of a lighting collision.

Recommended mobile crop: `object-position: 51% 42%` at 390 × 700. Recommended Hero height: 700 px. Keep the CTA above the 700 px boundary; the following search/environment organism starts on the warm paper surface.
