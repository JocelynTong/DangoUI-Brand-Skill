# Source vs live Demo comparison matrix

| Region | Frozen source / contract | Live Demo | Result |
|---|---|---|---|
| Welcome | 390×679 warm full-section art, 11 card layers, heading/copy/CTA | Full-width warm field, many large card layers, centered readable CTA flow | PASS |
| New Arrival | Navy clipped rail, ~166px square items, 46.8px previous/next controls | Matching clipped two-up rail and visible arrows; clicks leave first item and rail geometry unchanged | FAIL |
| Events | Near-full-width red framed organism, black title, overlapping 104px thumbnails, official event art | Composition is close, but 4/6 row images are generated held-out SVGs | FAIL |
| Recommend | Distinct official campaign images in wanted-poster cards, 270px portraits, partial next cue | 270px poster rail exists, but all five repeat one 94×66 product icon; copy collides and poster bodies are largely blank | FAIL |
| Videos | Cropped multi-thumbnail 16:9 rail and channel action | Cropped multi-thumbnail rail and six semantic links; mobile autoplay hidden | PASS (specificity reservation) |
| Footer nav/legal | Illustration/banners before navy single-column navigation and compact legal row | Illustration precedes a true single-column navy footer; required anchors/buttons and legal text present | PASS |
| Global | 390px canvas, no document overflow, mobile reading order | `390 == scrollWidth == clientWidth`; correct vertical order; no desktop shell | PASS |

Primary live captures: `../captures/demo-full-390x844.png`, `../captures/demo-welcome-390x844.png`, `../captures/demo-new-arrival-390x844.png`, `../captures/demo-events-top-390x844.png`, `../captures/demo-recommend-390x844.png`, `../captures/demo-videos-390x844.png`, `../captures/demo-footer-art-390x844.png`, and `../captures/demo-footer-legal-390x844.png`.
