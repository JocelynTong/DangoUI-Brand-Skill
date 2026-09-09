# Attempt 05 Independent Blind QA — Compact Interactive Hero

## Verdict

**REWORK**

The compact direction itself is viable: the Hero is approximately 416px tall, the next section is visible immediately, official campaign assets remain recognizable, and the card flip works with pointer and keyboard input. It reads as a purpose-designed compact Pokémon Hero rather than a uniformly shrunken desktop screenshot.

It cannot pass because the preserved Pokémon TCG logo overlaps the `EXPANSIONS` navigation item on both required proof surfaces. This is visible in the screenshots and confirmed by bounding-box intersection: approximately 269.7px² at 390×844 and 236.3px² in the 1440 outer viewport's narrow phone.

## Blocking finding

### `HERO_LOGO_NAV_OVERLAP`

- Acceptance violated: Logo, official card, CTA and carousel must not overlap.
- Earliest failure node: **Demo Implementation**.
- Failure owner: **Demo Implementation Agent**.
- Required correction: Allocate independent responsive regions for the TCG logo and navigation. Do not fix it by removing the logo or shrinking text below readable size.

## What passed

- Hero: 415.994px, within the 430px allowance.
- Next section: visible in the initial viewport.
- Official assets: background, campaign logo, TCG logo, card front and card back load.
- CTA: effectively 44px high within subpixel rendering tolerance.
- Card flip: pointer `front → back → front` passes.
- Keyboard: `Enter` and `Space` produce `front → back → front`.
- Mid-transition capture: card bounds remain stable; phone `scrollTop` remains 0; no Hero overflow or visual clipping observed.
- Carousel: `0 → 1 → 0` works and states remain nonblank.
- Responsive geometry: outer 1440 / internal narrow phone still uses the compact 416px Hero.
- No horizontal document/Hero overflow.
- No console warnings or errors observed.

## Evidence gap and warning

- `prefers-reduced-motion`: the loaded stylesheet contains reduction rules, but the browser reported `matchMedia(...).matches === false` and did not expose media emulation. Therefore actual reduce-mode runtime behavior is **NEEDS_EVIDENCE**, not independently passed.
- The second carousel state is functional but reuses the same campaign logo and featured card; it provides weak differentiation as a real second campaign state.

## Captures

- `captures/mobile-front-390x844.png`
- `captures/mobile-back-390x844.png`
- `captures/mobile-flip-mid-390x844.png`
- `captures/mobile-slide2-390x844.png`
- `captures/outer-1440-internal-phone.png`

The next implementation attempt should change only the earliest failing layout responsibility, then be evaluated by a new Blind QA context.
