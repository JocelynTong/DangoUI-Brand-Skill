# DangoUI capability-gap intake

- Brand: onepiece-cardgame
- Platform: h5
- DangoUI version: 3.6.16
- Capability gaps: 4
- Submission: manual review required; this file was generated without network access

## black-white-taxonomy-control

- Component: Tabs
- Limitation: Current filters are plain buttons. Their rectangular black/white taxonomy is not a verified DuTabs instance.
- Workaround: Host composition or style recipe
- Generality: cross-brand; frequency: 2; severity: major
- Proposed layer: component
- Rationale: Taxonomy tabs are a repeatable interaction family, but the current Tabs variants cannot express this rectangular treatment without replacement markup.
- Evidence: mapping: component-mapping.json#black-white-taxonomy-control

## environment-selector-composite

- Component: cross-component
- Limitation: DuSelect would nest a second bottom popup inside the existing publish sheet.
- Workaround: host-component
- Generality: cross-product; frequency: 1; severity: major
- Proposed layer: prop
- Rationale: A reusable selector needs an inline or caller-owned popup container mode to avoid nested bottom sheets.
- Evidence: closure: token-closure.json#environment-selector-composite

## single visual boundary ownership

- Component: DuInput+DuTextarea
- Limitation: Host-wide native input rules can draw a second border and focus ring inside the DangoUI wrapper.
- Workaround: Scoped reset of inner native border, outline, shadow and background
- Generality: cross-product; frequency: 2; severity: major
- Proposed layer: integration-contract
- Rationale: Composite inputs need a documented and testable contract for which layer owns border and focus presentation.
- Evidence: runtime-qa: token-state-evidence.json#inputOwnership

## predictable host theme scope precedence

- Component: DangoUI theme aliases
- Limitation: A theme token declared on the document root can be shadowed by a host theme token declared on a nearer page root.
- Workaround: Repeat the semantic bridge on the host theme root with explicit scope
- Generality: cross-product; frequency: 1; severity: major
- Proposed layer: token
- Rationale: Theme aliases need a supported scoping strategy that remains predictable inside an existing host theme root.
- Evidence: runtime-qa: token-state-evidence.json#loading

