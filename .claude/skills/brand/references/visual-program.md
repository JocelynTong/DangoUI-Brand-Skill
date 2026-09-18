# Visual Program

Use this reference in `design-host` after Host Strategist classifies the host and before candidate rendering. It converts industry principles into a small host-specific art-direction contract; it is not a page template.

## Industry-informed principles

- **Productive and expressive moments (IBM Carbon):** repeated task areas stay efficient and predictable; expressive treatment is reserved for moments that establish meaning, hierarchy or memory.
- **Contextual adaptation (Adobe Spectrum 2):** expression changes with product context, form factor and user need. Do not apply one visual intensity or geometry everywhere.
- **Multi-axis expression (Material 3 Expressive):** color alone is not art direction. Expression may combine type, shape, material, imagery and motion while component semantics remain stable.
- **Purposeful motion and hierarchy (Apple HIG):** motion, depth and full-bleed treatment must clarify state, hierarchy or continuity. Frequent operations remain brief and safe areas remain protected.

These are decision lenses, not imported component rules. DangoUI remains the behavior and semantic system; frozen brand evidence remains the source of brand truth.

## Required contract

Each candidate owns one compact `visualProgram` with:

- `hostClassification`: `efficiency-first`, `balanced` or `immersion-first`.
- `experienceZones`: productive, expressive or blended regions, each with a host job, viewport budget, interaction frequency and evidence-backed brand mechanisms.
- `focalHierarchy`: one primary visual center, secondary information and primary action.
- `sceneGraph`: sourced environment, subject, type, controls and business-content layers with explicit jobs.
- `contentTransition`: how brand atmosphere hands off to repeatable business work.
- `motionIntent`: mode, user-facing purpose and reduced-motion fallback.

## Rules

1. Expressive treatment needs a host purpose and attention budget; it cannot delay the primary task beyond the Host Strategist decision.
2. Productive regions may inherit brand tokens and bounded materials, but preserve scanability and repeat interaction speed.
3. Asset presence without a scene relationship is not composition.
4. Competing primary focal centers fail preselection review.
5. “More atmosphere” is not a sufficient motion purpose.
6. Alternatives differ in zone relationships or scene graph, not only labels, colors or asset swaps.
7. Keep this artifact compact: reference source ids and hashes instead of copying Brand MOD, evidence or host DOM.

## Internal candidate competition

Fast mode generates four compact programs and renders two; standard/certification may generate 6–9 and render 2–3. Run the deterministic preselector before rendering:

```bash
node skills/brand/scripts/rank-visual-programs.mjs --dir <visual-program-dir> --limit 3 --output <competition.json>
```

The preselector removes structural duplicates and high-risk programs, then maximizes strategy distance across zone structure, task transition, motion and lead brand asset. It is a render-priority tool, not an aesthetic verdict. Rendered candidates still require Brand Application Designer critique and fresh Visual QA; a high score cannot make a visually weak result pass.

## Failure codes

- `EXPRESSION_WITHOUT_HOST_PURPOSE`
- `PRODUCTIVE_FLOW_OBSCURED`
- `VISUAL_PROGRAM_FOCAL_CENTER_MISSING`
- `VISUAL_PROGRAM_SCENE_RELATIONSHIP_MISSING`
- `VISUAL_PROGRAM_TRANSITION_MISSING`
- `MOTION_WITHOUT_PURPOSE`
- `VISUAL_PROGRAM_SAME_STRATEGY`

## Primary references

- IBM Carbon, Productive and expressive type strategies: https://carbondesignsystem.com/elements/typography/style-strategies/
- IBM Carbon, Productive and expressive motion: https://carbondesignsystem.com/elements/motion/overview/
- Adobe Spectrum 2: https://s2.spectrum.adobe.com/
- Material Design 3 Expressive: https://m3.material.io/
- Apple Human Interface Guidelines, Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple Human Interface Guidelines, Layout: https://developer.apple.com/design/human-interface-guidelines/layout
