# Pokémon TCG Official · Attempt 06 Blind QA

## Verdict

**PASS** — no blocking finding. `earliestFailureNode: null`.

This review used only the frozen direction, source captures/evidence, permitted Demo proof artifacts and the operable local Demo. It did not use implementation rationale or an older verdict.

## Independent findings

### 1. Official default state — PASS

- At 390×844 the Hero uses the observed 30th Celebration background, `Logo-30th.png`, `2M6P_EN_23.png` card and the official campaign CTA.
- The 56px black navigation cap has a left logo, `MENU`, and three separate visual lines.
- The source has only one evidenced official campaign. Nothing in the Demo calls the second state official.

### 2. Real carousel state change — PASS

The second selector causes high-salience, user-visible changes rather than only an index/class change:

| Property | Default | Held-out settled |
| --- | --- | --- |
| Background | `booster-art-1.jpg` | `championships.jpg` |
| Title | `Logo-30th.png` | `BUILD YOUR NEXT DECK` |
| Featured card | `2M6P_EN_23.png` | `SV06_EN_33.png` |
| CTA | `Discover the celebration` | `Explore the Deck Lab` |
| Disclosure | none | `GENERATIVE DEMO · NOT AN OFFICIAL CAMPAIGN` |

- `before → transition → settled → restored` was operated directly.
- Transition layers expose `pokemon-campaign-swap-in` at `0.36s`.
- Returning to selector 1 restores the default screenshot exactly (same SHA-256).
- Reduced-motion supplied probe/capture settles state two with `animation-name:none` and `0s` duration.

### 3. Navigation and controls — PASS

- Menu target: 92×44; `aria-expanded` changes `false → true → false`.
- Open menu visibly exposes EXPANSIONS, CARDS, HOW TO PLAY and NEWS.
- Both carousel selectors are 44×44 at 351, 390 and 430 widths while retaining the short-bar appearance.

### 4. Responsive, card and scroll regression — PASS

- Hero is 416px high at 351/390/430 and the next section is visible in the first viewport.
- No horizontal overflow was observed at any tested width.
- The card flips by pointer, exposes the reversed accessible state, and restores by Enter.
- The phone surface is scrollable (`4141 > 802`); direct scroll changed `0 → 1036 → 0`.

### 5. Build — PASS

`npm run build` exited 0. The chunk-size notice is non-blocking and unrelated to this visual acceptance.

## Three-proof verdict

- Evidence Fidelity: **PASS**
- Structural Fidelity: **PASS**
- Generative Proof: **PASS**

The three verdicts were evaluated independently; none relies on a compensating aggregate score.
