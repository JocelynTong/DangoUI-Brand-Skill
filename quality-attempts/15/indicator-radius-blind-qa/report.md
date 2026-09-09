# Home Indicator radius — isolated Blind QA

Verdict: **PASS**. No blocker found in the frozen scope.

## Runtime findings

- At `1184×933`, the screen and indicator are both `372px` wide, share `x=636` and `bottom=868.21875`, and both computed bottom radii are `31.5936px`.
- At `777×848`, the screen and indicator are both `245px` wide, share `x=477.296875` and `bottom=688.65625`, and both computed bottom radii are `20.8192px`.
- These values were identical on Dango Style/Color, Pokémon Style/Button, Dango NavigationBar, Pokémon Home, and ONE PIECE Home.
- TabBar pages use the same computed surface on TabBar and Indicator. Home pages without TabBar keep the Indicator surface transparent.
- On both long Home pages, scrolling to `scrollTop=120` did not move the Indicator rect, and scroll position restored to `0`.
- `proof=1`, `proof=desktop`, and `proof=mobile` all compute the Indicator as `display:none`.

## Visual check

The two captured Pokémon Style/Button phone screenshots show the bottom surface following the inner screen corners at both viewport sizes; it no longer follows the larger outer frame radius.

## Build

`npm run build` passed. The existing bundle-size warning is non-blocking and unrelated to this scope.

Artifacts: `probes.json`, `verdict.json`, `pokemon-style-button-1184x933.png`, and `pokemon-style-button-777x848.png`.
