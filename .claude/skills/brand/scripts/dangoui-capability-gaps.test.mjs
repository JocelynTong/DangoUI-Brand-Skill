#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "dangoui-gaps-"));
const scripts = path.resolve("skills/brand/scripts");
const write = (name, value) => { const file = path.join(root, name); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); return file; };
const mapping = write("component-mapping.json", { mappings: [{ sourcePattern: "taxonomy-tabs", status: "composition-candidate-pending-runtime", compositionCandidates: ["Tabs"], boundary: "Current Tabs cannot express the required variant." }] });
const closure = write("token-closure.json", { brand: "fixture", host: "host", platform: "h5", exceptions: [{ id: "business-card", kind: "business-semantic", owner: "Host", reason: "Business data remains host-owned." }] });
const seeds = write("seeds.json", { items: [{ id: "runtime-field-owner", component: "DuInput", requestedCapability: "single boundary", currentLimitation: "Nested native border is visible.", evidence: [{ type: "qa", ref: "evidence.json#field" }], workaround: "Scoped reset" }] });
const decisions = write("decisions.json", { decisions: {
  "mapping-taxonomy-tabs": { decision: "capability-gap", rationale: "Reusable control family.", generality: "cross-product", frequency: 2, severity: "major", proposedLayer: "component", owner: "DangoUI", lifecycle: "proposed" },
  "closure-business-card": { decision: "correct-boundary", rationale: "Business semantics stay local.", generality: "business-specific", frequency: 1, severity: "none", proposedLayer: "correct-boundary", owner: "Host", lifecycle: "accepted" },
  "runtime-field-owner": { decision: "capability-gap", rationale: "Integration contract is reusable.", generality: "cross-product", frequency: 1, severity: "major", proposedLayer: "integration-contract", owner: "DangoUI", lifecycle: "proposed" }
} });
const report = path.join(root, "report.json");
const issue = path.join(root, "issue.md");
const run = (script, args) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: "utf8" });

assert.equal(run("collect-dangoui-gaps.mjs", ["--mapping", mapping, "--token-closure", closure, "--seeds", seeds, "--decisions", decisions, "--version", "3.6.16", "--output", report]).status, 0);
assert.equal(run("validate-dangoui-gaps.mjs", ["--report", report]).status, 0);
const collected = JSON.parse(fs.readFileSync(report));
assert.deepEqual(collected.summary, { total: 3, capabilityGaps: 2, correctBoundaries: 1, unclassified: 0 });
assert.notEqual(run("export-dangoui-gap-issue.mjs", ["--report", report, "--output", issue]).status, 0);
assert.equal(run("export-dangoui-gap-issue.mjs", ["--report", report, "--output", issue, "--confirm-reviewed"]).status, 0);
assert.match(fs.readFileSync(issue, "utf8"), /Capability gaps: 2/);
const unsafe = { ...collected, items: collected.items.map((item, index) => index ? item : { ...item, workaround: "/Users/private/project.css" }) };
write("unsafe.json", unsafe);
assert.notEqual(run("validate-dangoui-gaps.mjs", ["--report", path.join(root, "unsafe.json")]).status, 0);
const unclassifiedReport = path.join(root, "unclassified.json");
assert.equal(run("collect-dangoui-gaps.mjs", ["--mapping", mapping, "--token-closure", closure, "--seeds", seeds, "--output", unclassifiedReport]).status, 0);
assert.notEqual(run("validate-dangoui-gaps.mjs", ["--report", unclassifiedReport]).status, 0);
for (const script of ["collect-dangoui-gaps.mjs", "validate-dangoui-gaps.mjs", "export-dangoui-gap-issue.mjs"]) {
  const source = fs.readFileSync(path.join(scripts, script), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|https?\.request|createConnection|node:https|node:http/);
}
console.log("dangoui capability-gap MVP tests passed");
