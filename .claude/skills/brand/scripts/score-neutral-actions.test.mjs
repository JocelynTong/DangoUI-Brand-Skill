import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "brand-guard.mjs");

test("cross-page neutral actions are evidence, not an approved primary token", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-neutral-actions-"));
  try {
    const file = path.join(root, "review.json");
    fs.writeFileSync(file, JSON.stringify({
      schema: "brand-primary-role-frequency-review/v1",
      status: "candidate-not-approved",
      sources: [
        { pageId: "home", url: "https://example.com/", styles: [{ role: "content discovery", count: 6, background: "rgb(0, 0, 0)", foreground: "rgb(255, 255, 255)" }] },
        { pageId: "learn", url: "https://example.com/learn", styles: [{ role: "tutorial discovery", count: 7, background: "rgb(0, 0, 0)", foreground: "rgb(255, 255, 255)" }] },
        { pageId: "product", url: "https://example.com/product", styles: [{ role: "product discovery", count: 7, background: "rgb(0, 0, 0)", foreground: "rgb(255, 255, 255)" }] },
      ],
    }));
    const run = spawnSync(process.execPath, [script, "score-action-evidence", "--brand", "example", "--root", root, "--file", "review.json", "--out", "score.json"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const scored = JSON.parse(fs.readFileSync(path.join(root, "score.json"), "utf8"));
    assert.equal(scored.gate.ok, true);
    assert.equal(scored.candidates.neutralActionSurface[0].hex, "#000000");
    assert.equal(scored.candidates.neutralActionSurface[0].score, 24);
    assert.deepEqual(scored.candidates.primaryActionFill, []);
    assert.equal(scored.promotionStatus, "candidate-not-approved");
    assert.equal(scored.evidenceScope, "sampled-content-actions-only");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function genericReview() {
  const evidenceRef = { path: "capture.json", sha256: "a".repeat(64) };
  const region = { x: 5, y: 20, width: 180, height: 40 };
  const groups = ["signup-action", "language-action"].map((role, index) => ({
    role, treatment: "solid", background: "rgb(88, 204, 2)", foreground: "rgb(255, 255, 255)", count: 1,
    observations: [{ id: `control-${index}`, selector: `#control-${index}`, paintSelector: `#control-${index}::before`, textSelector: `#control-${index} span`, state: "default", region, evidenceRef }],
  }));
  return {
    schema: "brand-primary-role-frequency-review/v2", brand: "duolingo", status: "candidate-not-approved", producer: "interpreter",
    policyRef: "primary-color-and-cta", methodRef: "cross-page-token-promotion",
    sources: [{ pageId: "entry", url: "https://example.com/", sourcePriority: "identity", evidenceRef,
      census: { observedControls: 2, countedControls: 2, aggregateOnlyControls: 0, exclusions: [], unknowns: [] }, styles: groups }],
    frequencyTotals: { observedControls: 2, countedControls: 2, aggregateOnlyControls: 0, excludedControls: 0, unknownControls: 0,
      byRoleAndTreatment: groups.map(({ observations, ...style }) => style) },
    sampling: { unit: "visible semantic controls", paintLayerMethod: "painted child separate from text", scope: "homepage default-state only" },
    identityObservation: { role: "green owl identity; not CTA statistics" },
    interpreterDecision: { brandIdentityDecision: "identity green observed", primaryActionDecision: "signup local candidate", interfacePaletteDecision: "green and white locally", exceptions: [], mappingCandidates: [],
      approvalBoundary: { currentScope: "local candidate", notApproved: ["global token"], missingInThisCase: ["cross-page states and fresh QA"] } },
    unresolved: ["global action mapping not approved"],
  };
}

test("v2 scorer validates census and preserves actual paint/text selectors and semantic roles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-generic-actions-"));
  try {
    fs.writeFileSync(path.join(root, "review.json"), JSON.stringify(genericReview()));
    const run = spawnSync(process.execPath, [script, "score-action-evidence", "--root", root, "--file", "review.json", "--out", "score.json"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const score = JSON.parse(fs.readFileSync(path.join(root, "score.json"), "utf8"));
    assert.equal(score.evidenceScope, "role-scoped-counted-controls");
    assert.equal(score.promotionStatus, "not-approved-by-scoring");
    assert.equal(score.sourceReviewStatus, "candidate-not-approved");
    assert.equal(score.candidates.primaryActionFill.length, 2, "same green must not merge different semantic roles");
    assert.deepEqual(score.candidates.primaryActionFill.map((item) => item.sourceRole).sort(), ["language-action", "signup-action"]);
    const action = score.candidates.primaryActionFill.find((item) => item.sourceRole === "signup-action");
    assert.equal(action.sourceScope, "homepage default-state only");
    assert.equal(action.examples[0].selector, "#control-0::before");
    assert.equal(action.examples[0].sourceUrl, "https://example.com/");
    assert.equal(action.examples[0].observations[0].selector, "#control-0");
    assert.equal(action.examples[0].aggregateOnlyControls, 0);
    const text = score.candidates.actionTextBorder.find((item) => item.sourceRole === "signup-action");
    assert.equal(text.examples[0].selector, "#control-0 span");
    assert.ok(!JSON.stringify(score).includes(".button__bg"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("v2 scorer rejects invalid counts before writing a scoring artifact", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-invalid-actions-"));
  try {
    const review = genericReview(); review.sources[0].styles[0].count = 20;
    fs.writeFileSync(path.join(root, "review.json"), JSON.stringify(review));
    const run = spawnSync(process.execPath, [script, "score-action-evidence", "--root", root, "--file", "review.json", "--out", "score.json"], { encoding: "utf8" });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, /Invalid role frequency review.*PAGE_COUNT_MISMATCH/);
    assert.equal(fs.existsSync(path.join(root, "score.json")), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
