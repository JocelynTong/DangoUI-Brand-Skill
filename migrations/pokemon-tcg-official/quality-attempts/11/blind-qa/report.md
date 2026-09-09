# Pokémon TCG Official · Attempt 11 · Blind QA / TPP

## Verdict

**FAIL / REWORK**

- Evidence Fidelity: **PASS**
- Structural Fidelity: **FAIL**
- Generative Proof: **FAIL**
- Earliest failure node: **Demo Implementation**
- Failure owner: **demoImplementationAgent**

The official section is recognizably and mostly accurately rendered at the two endpoint viewports, but three frozen invariants fail in the live page and the preview registry gate also fails. These blockers are not compensated by the passing build, geometry, asset or CTA checks.

## Blocking findings

### B11-01 · White canvas ownership is wrong

At both desktop and mobile proof routes, `.pokemon-championship` and its copy remain transparent, but `.pokemon-championship::before` is an absolute white fill covering the entire section. The parent page surface is computed black. The frozen rule requires white to belong to the page canvas and explicitly forbids a pseudo-element fill.

Reproduce at `?proof=desktop#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`:

```js
getComputedStyle(document.querySelector('.pokemon-championship'), '::before')
// content: ""; position: absolute; background: rgb(255,255,255); 1440px × 720px
```

Minimal rollback: only restore white ownership at the page-canvas layer and remove the section-owned pseudo fill; leave all previous sections untouched.

### B11-02 · Play! Pokémon is missing after Championship

The live Home order is Hero → What's New → TCG Live → Pocket → Championship, then the page ends. `document.querySelector('.pokemon-championship').nextElementSibling` is `null`. The source evidence and frozen direction require Championship to sit after Pocket and before Play! Pokémon.

The desktop capture shows the target ending into black rather than the source's following Play! Pokémon image region.

Minimal rollback: append/restore only the approved Play! Pokémon successor immediately after Championship; do not reorder or rewrite Hero, What's New, TCG Live or Pocket.

### B11-03 · Held-out CTA does not preserve the state machine

The fictional fixture is directly reachable and genuinely independent: it uses original CSS-native media, different copy and no official Championship image. Its 1440 split and 390 image-first stack are correct. However, keyboard focus reports `focus-visible=true` while computed `outline=none 0px` and `box-shadow=none`. Activation also toggles `aria-pressed=true`, introducing a pressed state the approved recipe forbids.

Minimal rollback: only revise the held-out CTA to reuse the official outlined focus state and remove the invented pressed/toggle semantics.

### B11-04 · Fresh preview gate fails

`npm run validate:brand-preview` exits 1 because the visible pages include `pokemon-tcg-official-championship-fixture` but `sourceNavigation.visiblePageIds` does not.

Minimal rollback: align the visibility declaration while preserving the fixture's direct route.

## Checks that passed

- Fresh `npm run build` passes.
- Design-direction validation passes.
- Normal Home retains a visible 390px phone chassis, 371px rounded screen and an absolute Home Indicator.
- Internal Home scrolling is real and reversible: `scrollHeight 3422 > clientHeight 802`, with `scrollTop 0 → 1560 → 0`; phone/screen/indicator rectangles do not move.
- Desktop target is exactly 1440×720, split 720/720, copy left and image right.
- Mobile target is 390×829.171875, with a 390×390 image first and a 439.171875px copy block after it.
- Official image `src`/`srcset` are correct. The archived and runtime files match the frozen hashes for both 1x and 2x candidates. The live DPR=1 browser selected the 1x candidate as `currentSrc`; that selection is recorded separately from the source's DPR-dependent 2x observation.
- Kanit is live for the heading; PT Sans is live for body and CTA.
- Official CTA: black default; gold `#E2BA65` pseudo-layer expands from its center with `scaleX(0) → scaleX(1)` on hover; keyboard focus stays black with `rgb(0,95,204) auto 1px` outline; activation opens `https://championships.pokemon.com/en-us/` with title “Pokémon Championship Series”.
- No horizontal overflow at 1440 or 390.
- Hero, What's New, TCG Live and Pocket remain present, have positive rectangles, and their principal images are loaded.

## Gate escape

The Attempt 11 strict section-fidelity validator reports PASS, but fresh live probes disprove its submitted canvas-ownership and successor-section claims. The manifest result is therefore treated as a gate escape, not visual proof.

## Evidence index

- Machine verdict: `verdict.json`
- Role assessment: `visual-qa-assessment.json`
- Browser measurements: `probes/browser-probes.json`
- Screenshot hashes/states: `probes/capture-manifest.json`
- Screenshots: `captures/`

