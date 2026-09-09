# Attempt 07 — Full-bleed proof surface Blind QA

## Verdict

**PASS**

`earliestFailureNode: null`

The 390×844 Pokémon TCG Official Home proof surface now matches the official mobile page's full-bleed viewport behavior. The black navigation bar, Hero and following page sections all begin at `x=0` and occupy the complete `390px` width. The previous outer showcase gutter and phone-chassis inset are absent.

## Evidence comparison

The official mobile reference `migrations/pokemon-tcg-official/captures/source/home/mobile-390/frames/000.png` shows a black navigation bar running from the left to right viewport edges while the logo and MENU content remain safely inset. The current Demo reproduces that relationship:

| Check | Measured result | Status |
| --- | --- | --- |
| Hero full bleed | `x=0`, `width=390`, `height=416` | PASS |
| Mobile nav full bleed | `x=0`, `width=390`, `height=56` | PASS |
| Proof region full bleed | `x=0`, `width=390`, `margin=0` | PASS |
| Phone shell removed from proof | `padding=0`, `border=0`; phone and screen both `x=0`, `width=390` | PASS |
| Logo safe inset | logo begins at `x=23` | PASS |
| MENU safe inset | control ends at `x=364`, leaving `26px` on the right | PASS |
| Next section exposure | next section begins at `y=416`, inside the first 844px viewport | PASS |
| Horizontal overflow | document/body/screen width all `390px` | PASS |

The correction therefore removes the presentation shell without incorrectly pushing the navigation's content to the viewport edges.

## Interaction regression

- **Menu — PASS:** the MENU control opens a visible panel containing EXPANSIONS, CARDS, HOW TO PLAY and NEWS; the close control restores the Hero.
- **Carousel — PASS:** Campaign 1 switches to a visibly distinct Campaign 2 and returns. Background, title/CTA, card asset, active control and Hero variant all change rather than only an internal index.
- **Card flip — PASS:** the featured card changes to the visible Pokémon card back and restores to the front.

No blocker was found within the requested Attempt 07 scope.
