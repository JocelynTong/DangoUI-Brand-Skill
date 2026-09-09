# Host theme load-order contract

Apply-host must choose one deterministic CSS ownership strategy before implementation. Prefer `single-global-entry` for Vue, Taro and Vite hosts: one theme stylesheet, imported exactly once by an application-level entry (`app.js`, `main.ts`, or a global stylesheet). Lazy route/page/component files must never import it.

The contract file passed to `validate-host-theme-order.mjs` has this shape:

```json
{
  "version": 1,
  "strategy": "single-global-entry",
  "themeEntry": "src/styles/brand-host-theme.css",
  "globalImporters": ["src/app.js"],
  "scanRoots": ["src"],
  "allowedLateStyleInjectors": [],
  "maxSelectorSpecificity": [0, 4, 1]
}
```

Rules:

- `themeEntry` has exactly one static CSS import, owned by one declared `globalImporters` file.
- Files under route/page/component paths cannot import the theme entry. This prevents bundlers from injecting the shared theme after route-scoped CSS in navigation-dependent order.
- Do not dynamically append theme `<style>`/`<link>` nodes. Any intentional late injector must be named in `allowedLateStyleInjectors` and justified in the apply-host plan.
- Theme CSS cannot depend on `!important`, IDs, or selector weight beyond `maxSelectorSpecificity`. Fix ownership/order or introduce a stable semantic hook instead of escalating specificity.
- Keep route scoping on the theme root (for example `.host-theme-onepiece`) to prevent cross-page leakage; this does not replace deterministic loading.

After static validation, the implementation receipt must record `themeLoadOrderProof` from a cold load and a route navigation. Each observation lists the theme stylesheet once and proves no stylesheet injected later wins a themed probe. The ordinary cascade probes remain required; a build pass or source import alone is insufficient.

Use `layered-global-entry` only when the host already controls a global cascade-layer declaration. Declare the complete order once (for example `@layer reset, host, brandTheme, utilities, overrides;`), import every participating global stylesheet through that entry, and put theme rules in the declared `brandTheme` layer. Do not introduce layers locally to one lazy route: unlayered rules outrank layered rules and recreate the same ambiguity.
