# Attempt 10 Demo Revision 2 — Pocket provenance correction

## Outcome

Implementation handoff is complete with **no application-code, CSS, preview-schema, or runtime-asset changes**.

The corrected Evidence proves that the official desktop URL (`background.jpg`) and mobile URL (`header_bg-small.jpg`) currently publish byte-identical 720×464 JPEGs. The existing Demo already preserves the two observed URL roles in `<picture>` and both local files match the official SHA-256 `4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`. Creating a visual breakpoint difference would contradict the corrected evidence.

## Proof handling

Because the correction changes provenance semantics rather than rendered pixels, the settled and CTA-hover captures from `../demo/captures/` are reused with frozen hashes. `reuse-proof.json` binds those images to the unchanged App, CSS and preview-schema hashes. Revision 2 Evidence captures separately prove the desktop/mobile URL usage.

The corrected Pattern Inventory and Generative Proof now say that the URL role changes but the current artwork does not. They no longer claim art-directed visual asset substitution.

## Implementation gates

- Design Direction validator: PASS.
- Section Fidelity validator (`--strict`): PASS, 13/13 checks.
- Asset Usage gate: PASS, no blocking or warnings.
- Brand Preview Registry: PASS; existing naturalWidth reminders remain browser-verification warnings.
- `npm run build`: PASS.

## Code-change declaration

- `src/App.vue`: unchanged.
- `src/styles.css`: unchanged.
- `public/brand-previews/pokemon-tcg-official.json`: unchanged.
- Pocket background assets: unchanged.
- Added only Attempt 10 `demo-revision2` provenance, corrected manifests, reuse proof, gate record and receipt.

This implementation report does not make a QA or visual-fidelity verdict. A fresh independent Blind QA must consume the corrected evidence chain.
