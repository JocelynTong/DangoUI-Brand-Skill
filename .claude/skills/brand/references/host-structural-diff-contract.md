# Host structural diff contract

Before editing each Vue SFC, capture a baseline. After implementation, validate the current SFC against that immutable snapshot and a reviewed manifest:

```bash
node skills/brand/scripts/validate-host-structural-diff.mjs snapshot --file <page.vue> --out <migration>/structural-baselines/<page>.json
node skills/brand/scripts/validate-host-structural-diff.mjs validate --baseline <baseline.json> --current <page.vue> --manifest <manifest.json>
```

The validator parses Vue SFC, Vue template AST, and JavaScript/TypeScript AST. It permits semantic class/style hooks and approved stylesheet imports. Non-style script AST changes are blocking, covering route, request/API, handler, state/data and component API mutations. Template event, `v-if`/`v-show`, `v-for` source, bindings, static attributes, removals and unapproved tag/component substitutions are blocking.

Manifest schema is `brand-host-structural-manifest/v1`. `allowedStyleImports` lists exact new style import specifiers. A new decorative node must be listed in `decorativeNodes` with `currentNodeId`, `interactive: false`, `reason`, and `evidenceRef`. A primitive/component substitution must be listed in `primitiveSubstitutions` with `baselineNodeId`, exact `from`/`to`, `approved: true`, `reason`, and `approvalRef`. Approval is an explicit product/design decision; adding an entry after the implementation is not self-approval.

### Approved accessibility augmentation

An apply-host pass may make an existing control keyboard- and assistive-technology-readable without changing its business outcome. This is the only exception to the default ban on attribute and event additions. It uses `accessibilityAugmentations`, and every entry must contain `baselineNodeId`, `approved: true`, a non-empty `reason`, and an external `approvalRef` frozen by the Design Director before implementation.

```json
{
  "accessibilityAugmentations": [
    {
      "baselineNodeId": "n12",
      "approved": true,
      "reason": "Expose the existing tap control to keyboard and assistive technology",
      "approvalRef": "design-direction#a11y-filter-tab",
      "addedAttributes": {
        "role": "tab",
        "tabindex": "0",
        "aria-label": "技能"
      },
      "addedBindings": {
        "aria-selected": "activeTab === 'skill'"
      },
      "keydownDelegation": {
        "sameOutcomeAs": "tap",
        "keys": ["Enter", "Space"]
      }
    }
  ]
}
```

The validator enforces all of these invariants:

- The baseline node was already intrinsically interactive or already had `@tap`. The manifest cannot turn decorative content into a new control.
- Additions are additive only. Existing attributes, bindings, event handlers, conditions, loops, interpolation/static content, and business script must remain byte-semantically unchanged.
- Static additions are restricted to `role`, `tabindex`, and a bounded ARIA semantic allowlist. Dynamic additions use the same bounded ARIA allowlist; arbitrary attributes and component props remain blocked.
- Keyboard delegation is optional, but when present it must implement exactly Enter and Space. Each handler expression must equal the unchanged baseline `@tap` expression. Only the key modifier and optional `prevent` are accepted; arbitrary keys, handlers, or modifiers remain blocked.
- The manifest declares the exact added attribute/binding values. Undeclared additions and declaration/template mismatches fail.

This channel does not authorize navigation, request, state, API, content, condition, loop, or outcome changes. If keyboard support requires a new handler function or a different outcome, that is host product work outside style-only `apply-host` and must follow its own approved development workflow.

Store baseline, manifest, and validator JSON output with the apply-host receipt. Create the baseline before production edits; a snapshot of already-modified code is invalid evidence.
