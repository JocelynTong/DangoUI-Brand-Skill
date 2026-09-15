# Skill usage case reporting

Brand usage problems are collected outside the host repository. Preparing a report is local-only; submitting it requires an explicit user review and confirmation.

Lifecycle:

`reported-local → reviewed-local → submitted → triaged → project-candidate → cross-case-candidate → validated-common → scheduled → implemented → regression-verified → resolved`

Rules:

- Store pending reports under the Codex data directory, never under the host project.
- Use allowlisted fields and generalized environment values. Never include names, project names, absolute paths, private URLs, source, logs, page copy, screenshots, or attachments.
- Show one plain-language summary per skill run: `查看脱敏摘要 / 上报摘要 / 暂不上报`.
- `prepare` and local export perform zero network requests.
- Submission requires `--confirm-reviewed` and an explicitly configured feedback repository.
- One case is a candidate only. It cannot modify the skill or become a shared blocking rule.
- A normal issue needs two independent cases, stable reproduction, an executable gate, and false-positive review before common-rule promotion.
- Deterministic safety, data-loss, permission, or existing-contract defects may be expedited only with maintainer approval.

`prepare` accepts a local source Case. Only the fields defined by
`skill-usage-case.schema.json` enter `report.json`; the source Case remains in the
external `local.json`. `independenceValue` is converted to a salted one-way hash
for cross-Case counting and is never part of the mechanism fingerprint.
Callers should pass locally known names, project labels, hostnames, and business
phrases in `sensitiveTerms`; `prepare` replaces exact occurrences before validation.

Commands:

```bash
node skills/brand/scripts/prepare-skill-usage-case.mjs --case <local-case.json>
node skills/brand/scripts/prepare-skill-usage-case.mjs --decline --run-id <brand-run-id>
node skills/brand/scripts/validate-skill-usage-case.mjs --report <outbox-report.json>
node skills/brand/scripts/export-skill-usage-case-issue.mjs --report <outbox-report.json> --output <issue.md>
node skills/brand/scripts/submit-skill-usage-case.mjs --report <outbox-report.json> --repo <owner/feedback-repo> --confirm-reviewed
node skills/brand/scripts/submit-skill-usage-case.mjs --repo <owner/feedback-repo> --close-issue <number> --confirm-reviewed
node skills/brand/scripts/aggregate-skill-usage-cases.mjs --input <report-directory> --output <aggregate.json>
node skills/brand/scripts/promote-skill-usage-mechanism.mjs --aggregate <aggregate.json> --fingerprint <sha256:...> --output <decision.json> --stable-reproduction --executable-gate --false-positive-reviewed --maintainer-approved
```

The GitHub repository must be separate from the host business repository. The submit command creates only an Issue and a small receipt in the external Codex data directory.

Do not run submission from an automatic Skill hook. Present the generated prompt
at most once per Brand Skill run. If the user chooses `暂不上报`, record that
choice in the run's external local state and do not prompt again. Screenshot or
attachment upload is outside this mechanism and always requires a second,
separate authorization; the provided scripts never upload either.
