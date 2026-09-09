# Pokémon TCG Official — Demo revision 2

This revision changes only Demo implementation and implementation-owned proof bookkeeping in response to the five blocking findings in `visual-qa-assessment.json`.

- Standard Demo pages: Home, Card Database, Learn to Play, Deck Lab.
- Removed from the current learning surface: Pocket Fixture, Championship Fixture.
- Card Database phone layout: one keyword column, one Energy column.
- Grass filter: reversible `aria-pressed=false → true → false` with visible selected styling.
- Section manifest: fresh section captures and measured non-placeholder geometry.
- Pattern inventory: calibrated patterns are restricted to approved sections; Deck Lab transfer is separately identified.

The browser probe found all four formal pages scrollable and restorable with no broken images. The strict section gate and production build pass. This is an implementation handoff, not a QA or fidelity verdict.
