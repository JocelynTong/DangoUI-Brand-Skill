# PAGE_SCROLL_NOT_RESTORED minimal fix

## Root cause

All preview pages reuse the same `.phone-screen` scroll container. Replacing the
page/template content does not replace that DOM node, so its previous `scrollTop`
survived a page or brand switch.

## Fix boundary

- Watch only `selectedStyleId` and `selectedTemplateId`.
- After Vue renders the new selection, reset the shared screen to `{ top: 0, left: 0 }`.
- Do not react to scrolling, component selection, inspector changes, or content state.
- Do not change page layout, home indicator, Evidence, Intent, Mapper, or visual design.

## Verification

Run against the local preview server:

```bash
node migrations/pokemon-tcg-official/quality-attempts/12/scroll-restore-fix/scroll-restore-probe.mjs http://127.0.0.1:5177
```

The probe performs the required round trip: page A scrolls away from zero, page B
opens at zero, page B scrolls away from zero, and page A opens again at zero. It
writes the measured values to `probe-result.json` and exits non-zero on failure.

