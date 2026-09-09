# Pokémon TCG Official Home Hero — Blind QA Attempt 04 R2

Verdict: **PASS**

This was a fresh independent browser review of `attempt04/demo-r2`. I compared the visible Demo against the frozen official desktop/mobile source captures and then exercised the real localhost page. I did not use implementation rationale as acceptance evidence.

## Regression result

All four blocking findings from the previous QA are resolved:

1. Carousel `0 → 1 → 0` keeps the separate campaign logo and authentic featured card visible in every state, both at the mobile proof surface and inside the wide outer application window.
2. Mobile left/right controls are visibly rendered as arrows, remain readable in the active state, and measure about `56 × 56px`.
3. The CTA is a white pill with a gold border, dark italic label and right arrow. A black gap visibly separates it from the following white section.
4. At an outer `1440×1000` window the approximately `347–371px` internal phone surface continues using the mobile art-directed layout. Navigation is not clipped, layers do not overlap, `scrollWidth === clientWidth`, and controls remain above `44px`.

## Full slice acceptance

- The mobile Hero is approximately `1183px` tall, inside the frozen `900–1280px` range.
- All six layers are present: navigation, campaign art, campaign logo, featured card, CTA and carousel controls.
- The source mobile `booster-art-1.jpg` asset and vertical focal crop preserve Pikachu, Mew and Mewtwo as the primary composition.
- Phone scrolling was exercised through `0 → middle → following content → bottom → 0`; the next Home section is reachable and restoration succeeds.
- No horizontal overflow was measured at the mobile or outer-1440/internal-phone surfaces.
- No runtime console errors were observed.

## Source comparison judgment

The visible mobile result is now materially source-shaped rather than a desktop canvas shrunk into a phone. Its black cap, campaign-art focus, campaign mark, foreground card, side controls and gold-outlined action reproduce the official Hero's reading sequence and control language closely enough for this sealed Hero-slice goal.

The official 1440 source remains a horizontal desktop composition. This app route intentionally shows a phone mockup, so `desktopRegression: PASS` means the actual wide-window review surface no longer triggers destructive desktop rules inside that narrow phone; it does not claim the phone mockup is a reproduction of the official desktop page.

## Non-blocking notes

- Demo arrows include small slide numerals while the source controls are visually plainer. This does not obscure the arrow affordance or active state.
- State 2 reuses the frozen logo/card identity. That is valid for the current interaction-stability test, but it cannot become evidence for a distinct official campaign until Evidence supplies a complete second identity set.

Earliest failure node: **none**  
Failure owner: **none**

Evidence Fidelity: **PASS**  
Structural Fidelity: **PASS**  
Generative Proof: **not assessed; outside this Hero regression scope**
