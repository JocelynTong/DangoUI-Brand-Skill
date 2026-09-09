# Incident 13 Blind QA

Verdict: **FAIL**

This isolated review checked only the two incident-13 regressions. It did not read implementation rationale or a prior QA verdict.

## A. Unsupported Database orange — PASS

- The current formal evidence, intent, approved patterns, adapter, component mapping, DTCG style, Brand MOD, and public preview contain no claim that the Database has an orange action role.
- `site-evidence.json` retains `familyScores.orange = 5.8`, but that is only an aggregate extractor bucket. There is no rendered or computed orange role binding.
- `brand-mod.json` now records `action.primary.fill` as `unresolvedEvidenceRole`, with `value: null`, `target: null`, and `status: missing`.
- The adapter and component mapping explicitly keep Database actions on the DangoUI Button baseline.
- The current Pokémon Button showcase computes the primary button as `rgb(124, 102, 255)`, not the previous unsupported orange.

## B. Shared outer Home Indicator — partial PASS, overall FAIL

Normal routes pass on all four required surfaces:

- `style/button`
- `components/navigation-bar`
- Pokémon home
- ONE PIECE home

On every normal route, `.mock-home-indicator--outer` is a direct child of `.phone.template-phone`, uses `position:absolute`, `bottom:0px`, transparent background, and no background image. Its measured rect stayed unchanged through scrolling. Each real scroll container reached its maximum position, its content end became reachable, and scrolling restored to zero.

The proof-mode requirement fails. With `?proof=1`, the outer indicator is still present and visible on all four routes (`indicatorCount=1`, `visible=1`).

## Build

`npm run build` passed. The only output was the existing Vite large-chunk advisory.

## Blocking finding

`PROOF_MODE_HOME_INDICATOR_VISIBLE` → `demoImplementationAgent`

Proof mode must suppress the shared outer indicator across style, component, and both brand page surfaces before incident 13 can close.
