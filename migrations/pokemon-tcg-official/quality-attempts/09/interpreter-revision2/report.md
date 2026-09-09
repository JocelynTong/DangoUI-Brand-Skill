# Pokémon TCG Official — TCG Live Interpretation Revision 2

## Verdict

`PASS_WITH_MOTION_UNRESOLVED` for Design Director review.

This revision binds exclusively to `evidence-revision2`. It preserves the independently frozen 1440×900 and 390×844 section evidence, background hierarchy, five-asset composition, responsive reading order, pre-translation typography, and visible CTA. Entry motion is explicitly unresolved and is not released to implementation or QA as learned behavior.

No Demo source, Demo screenshot, implementation rationale, previous Interpreter output, or prior QA verdict was used as evidence.

## Approved visual language

The TCG Live module is not a red section. Its full-bleed background is one raster with a red/gold V-shaped top threshold and a pale-gray honeycomb body. A five-layer product scene provides recognition; a local black panel supplies explanation and action.

- Desktop: complete `1440×624` section; copy-left, assets-right.
- Mobile: complete `390×644.625` section; assets-first, full-width opaque-black copy panel second.
- Background: red/gold V seam, pale-gray honeycomb body, hard lower cut into the pale-blue Pocket section.
- Foreground: laptop rear plane, Pikachu lower-left, phone lower-right, and two avatars above, all as independent transparent assets.
- Copy: English H2, one paragraph, and one white `Learn More` CTA. No kicker.

## Typography authority

The stable screenshots were translated by Chrome, so they are geometry and composition evidence only. Typography and English copy bind to the pre-translation DOM/computed record:

- H2: Kanit 700, desktop `40/44`, mobile `28/30.8`.
- Body: PT Sans 400, `18/28.8` at both widths.
- CTA: PT Sans 700, desktop `20/24` and `56px` high; mobile `18/22.5` and expected `190.742×51.297`.

English wrapping must remain fluid. Chinese line breaks in translated captures cannot be copied or used to prescribe panel height.

## Motion correction

Entry motion is `unresolved/candidate-only`.

The source exposes classes and candidate initial computed values suggestive of pop/slide behavior. However, Evidence Revision 2 could not obtain a stable same-section before/intermediate/settled sequence: asynchronous reflow moved the target section out of frame. Therefore:

- no exact transform, duration, delay, stagger order, or trigger behavior is approved;
- motion may not be required in Design Direction;
- implementation may not claim source-faithful entry motion;
- QA may not use invalidated or unstable motion frames as acceptance proof;
- background motion must not be invented.

The safe downstream choice is to omit entry motion until new valid Evidence exists. Any optional motion experiment must be labelled non-source-faithful and cannot satisfy Evidence or Structural Fidelity.

## Section-local boundaries

- Red is not a global fill, primary action, or active-state token.
- Gold is not a global interaction token.
- The black copy panel is not a generic section, card, modal, or host surface.
- Honeycomb is not a global page texture.
- Kanit/PT Sans roles here do not authorize unrestricted global typography changes.
- No global or source-approved motion recipe is established.

## Design Director handoff

Direction may proceed only if it:

1. binds exclusively to `evidence-revision2`;
2. keeps real 1440×900 and 390×844 proof surfaces;
3. freezes the background and five foreground asset identities;
4. preserves desktop copy-left/assets-right and mobile assets-first/copy-second;
5. uses pre-translation English DOM/computed typography with fluid wrapping;
6. marks entry motion unresolved and excludes it from source-fidelity acceptance;
7. rejects solid-red fields, invented kickers, flattened screenshots, background animation, and global token expansion.

Machine-readable contracts are in `brand-intent.json` and `pattern-inventory.json`.
