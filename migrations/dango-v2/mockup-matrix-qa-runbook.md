# Dango v2 mockup matrix QA runbook

This runbook reproduces the implementation-side browser evidence. It does not modify the QA-owned `mockup-state-matrix.json`, the frozen goal, Evidence, Intent, Registry, or the execution manifest.

## Run

From the repository root, start the local Demo:

```sh
npm run dev
```

In a second terminal, run the self-contained Playwright probe. Headless Chrome may require sandbox escalation:

```sh
node migrations/dango-v2/capture-mockup-matrix-implementation.mjs
```

Validate all 24 cases strictly:

```sh
node skills/brand/scripts/validate-mockup-matrix.mjs --file migrations/dango-v2/mockup-state-matrix-implementation.json --strict
```

Expected result: `expectedCases: 24`, `observedCases: 24`, zero blocking findings and zero warnings. Screenshots are written to `migrations/dango-v2/captures/mockup-matrix-implementation/`.

The browser-only tabbar and scroll fixtures exercise shared mockup geometry without editing application source. Normal cases record the indicator owner, position, background semantics, aligned screen geometry, scroll change/restoration and indicator drift. Proof modes must report the indicator as hidden.
