# Arena official-assets candidate

This test line answers one narrow question: can the repository's persisted official Pokémon TCG assets produce a denser, more social arena hero without relying on the generated empty arena or a lone Pikachu cutout?

Open `index.html` through a local HTTP server. The candidate is mobile-first at 390 × 844 and expands to desktop.

Design structure:

- The official `booster-art-1.jpg` is the shared character world: Pikachu, Mew, and Mewtwo already belong to one perspective and light system.
- The official Championships photograph is framed as an in-world broadcast ribbon, adding real competitors and a crowd-adjacent event signal without pretending it shares the foreground camera.
- Two authentic cards sit on the same lower stage plane as the CTA and battle-floor ellipse.
- CSS supplies only contextual layers—red/blue spotlights, crowd bokeh, ring lights, floor reflections, and broadcast HUD—not new Pokémon imagery.
- The Pokémon TCG mark stays visible in the highest navigation layer so the result cannot collapse into generic esports.

Review the rendered screenshots in `screenshots/` and the written verdict in `self-check.json`.

## B2

`index-b2.html` is the QA-driven reduction. The 700 px Hero keeps only the same-source ensemble, arena context, title, and one primary CTA. Tournament photography and cards start in the separate `battle-feed` organism after the Hero boundary; activity/online count is removed. Review `screenshots/mobile-390-b2.png` and `self-check-b2.json`.
