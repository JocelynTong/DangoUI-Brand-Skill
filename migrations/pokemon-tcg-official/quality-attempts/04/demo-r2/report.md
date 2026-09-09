# Attempt 04 revision 2 · Demo Implementation self-test

Scope: `pokemon-tcg-official-home / home-campaign-stage` only. This revision addresses the four blocking findings from Attempt 04 Blind QA; it does not implement card shine or change other pages.

## Changes

- Carousel variants without their own identity assets now reuse the approved campaign logo and featured-card layers, so state 2 cannot remove required nodes.
- Phone-width carousel controls are visible gold-ringed previous/next arrows. Both remain 56 × 56px and the active state remains readable.
- CTA now uses the source control language: white fill, 3px gold border, pill radius, dark italic label and right arrow. A 24px black gap separates it from the following white section.
- Hero responsiveness now uses a named inline-size container. The mobile art-directed rules therefore apply to the actual proof-surface width, including an outer 1440px window containing a 348px Hero.

## Browser self-test

Command: `node scripts/pokemon-home-attempt04-r2-probe.mjs http://127.0.0.1:5181`

| Proof surface | Carousel | Six layers in every state | Hero overflow | CTA | Controls | Result |
| --- | --- | --- | --- | --- | --- | --- |
| viewport 390 | 0 → 1 → 0 | yes / yes / yes | 348 ≤ 348 | 56px, 3px gold border, pill | 56 × 56px, visible arrows | PASS |
| outer 1440 + internal phone/Hero 348 | 0 → 1 → 0 | yes / yes / yes | 348 ≤ 348 | 56px, 3px gold border, pill | 56 × 56px, visible arrows | PASS |

No console errors were observed. Machine details are in `browser-probes.json`; state captures are under `captures/`. `npm run build` passed.

This is an implementation receipt and self-test only. It does not issue a visual fidelity verdict; a new Blind QA agent must review these outputs against frozen source evidence.
