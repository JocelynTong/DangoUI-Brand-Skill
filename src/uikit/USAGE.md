# Catalog reference — local trial

This is the existing **Vue 3 Web DOM** catalog implementation, not an approved ONE PIECE brand pack, a Taro component, or a completed design system. Read `capabilities.json` before choosing it. Packaging does not change any earlier learning/QA verdict.

## Consume without the research workspace

```js
import Grid from '@dangoui/catalog-reference/grid';
import '@dangoui/catalog-reference/grid.css';
// <Grid :items="hostResults" appearance="onepiece" empty-text="No results" />
```

`items` accepts `{src, alt?, title?, category?, code?, release?, cta?}[]`. Supply your own permitted image URLs. The caller owns filtering, requests, navigation and data order. No minimum item count is required. No reference screenshots or official artwork are bundled.

Independent use requires `appearance="onepiece"` and the corresponding CSS import. The default `legacy` appearance requires caller-owned styles; importing the package alone does not provide that styling.

`./section` and `./section.css` add a **static** title/category shell. Category buttons are disabled and do not implement selection; the first category stays active (another item marked active can produce two active labels). Under `onepiece`, the description and label are rendered but hidden by CSS. CTA is text only, not a link or button. Do not replace functional host filters with this shell. Prefer `./grid` under an existing functional host shell.

A missing image URL produces a text placeholder. A failed image request has no built-in error fallback: the Demo's global image-error handler is not included in this package. Consumers own image loading and failure handling.

## What travels with the implementation

- Scoped CSS and generated DTCG snapshot (`./tokens`). The authoring source remains the existing Brand MOD; consumers do not need it at runtime.
- Capability limits and composition behavior (`./capabilities`), including two columns, fixed media height, content order and host responsibilities.
- No Storybook server, Demo app, migration archive, old screenshots, recording, or network lookup is required to import the code.

The current implementation does **not** reproduce the source site's desktop four-column / mobile two-column behavior. It does not supply official fonts or expressive composition. These are unresolved product capabilities, not issues npm packaging can solve.

Build/check the token snapshot in the authoring repository before packaging. This private prerelease is for local evaluation only; do not publish or treat its version as design approval.

## Verification scope

Run `npm run test:catalog-package` from the repository root for token consistency and isolated tarball/SSR checks. Existing component regressions remain in `npm run test:demo`; Storybook and research pages are not required for this package check.

The package test extracts a tarball in a temporary directory and reuses the locally installed Vue peer runtime. It verifies exports, packaged files and SSR output, not a fresh dependency installation, browser layout, image-network behavior or real-host integration.
