#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-usage-reporting-"));
const host = path.join(root, "host");
const outbox = path.join(root, "outbox");
const scripts = path.resolve("skills/brand/scripts");
fs.mkdirSync(host);
fs.writeFileSync(path.join(host, "business.txt"), "unchanged\n");
const snapshot = () => fs.readdirSync(host).map(name => [name, fs.statSync(path.join(host, name)).size]);
const before = snapshot();
const run = (script, args = [], env = {}) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: "utf8", cwd: host, env: { ...process.env, ...env } });
const write = (name, value) => { const file = path.join(root, name); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); return file; };
const base = {
  skillId: "brand", workflow: "apply-host", workflowNode: "fast-qa", category: "quality",
  abstractMechanismCode: "QA_SCOPE_SMALLER_THAN_THEME_SCOPE", frameworkClass: "react", platformClass: "web",
  summary: "Theme changes can affect more surfaces than the fast visual review covers.",
  reproduction: "Apply a global theme and compare every affected surface against the declared review scope.",
  gate: "Fail when the affected-surface manifest is not closed by the visual review manifest.",
  falsePositiveAssessment: "Exclude isolated component previews whose theme is explicitly scoped to the component.",
  severity: "high", contractRef: "workflow-contract.json#executionProfiles", independenceValue: "private-project-a",
  sensitiveTerms: ["方旌", "公司新人流程项目"]
};
const sourceA = write("case-a.json", base);
const preparedA = run("prepare-skill-usage-case.mjs", ["--case", sourceA, "--outbox", outbox, "--host", host]);
assert.equal(preparedA.status, 0, preparedA.stderr);
const preparedResult = JSON.parse(preparedA.stdout);
assert.equal(preparedResult.networkRequests, 0);
assert.deepEqual(snapshot(), before, "business project files and size must remain unchanged");
const reportA = preparedResult.report;
assert.equal(run("validate-skill-usage-case.mjs", ["--report", reportA]).status, 0);
const issue = path.join(outbox, "issue.md");
assert.equal(run("export-skill-usage-case-issue.mjs", ["--report", reportA, "--output", issue]).status, 0);
assert.doesNotMatch(fs.readFileSync(issue, "utf8"), /private-project-a/);
const sensitive = write("sensitive.json", { ...base, summary: "方旌在公司新人流程项目观察到主题影响范围扩大。", independenceValue: "private-project-sensitive" });
const redactedResult = run("prepare-skill-usage-case.mjs", ["--case", sensitive, "--outbox", outbox, "--host", host]);
assert.equal(redactedResult.status, 0, redactedResult.stderr);
assert.doesNotMatch(fs.readFileSync(JSON.parse(redactedResult.stdout).report, "utf8"), /方旌|公司新人流程项目/);

const declineOutbox = path.join(root, "decline");
assert.equal(run("prepare-skill-usage-case.mjs", ["--decline", "--run-id", "run-1", "--outbox", declineOutbox, "--host", host]).status, 0);
const suppressed = run("prepare-skill-usage-case.mjs", ["--case", sourceA, "--run-id", "run-1", "--outbox", declineOutbox, "--host", host]);
assert.equal(JSON.parse(suppressed.stdout).status, "PROMPT_SUPPRESSED");

for (const [name, unsafe] of [
  ["path", "/Users/alice/secret/project.ts"], ["private-url", "http://localhost:3000/admin"],
  ["email", "alice@example.com"], ["phone", "13800138000"], ["source", "const secret = () => { return 1; }"]
]) {
  const report = JSON.parse(fs.readFileSync(reportA)); report.summary = `Unsafe ${unsafe}`;
  const file = write(`unsafe-${name}.json`, report);
  assert.notEqual(run("validate-skill-usage-case.mjs", ["--report", file]).status, 0, name);
}

const reportAgain = JSON.parse(fs.readFileSync(reportA));
const preparedAgain = run("prepare-skill-usage-case.mjs", ["--case", sourceA, "--outbox", outbox, "--host", host]);
assert.equal(JSON.parse(preparedAgain.stdout).fingerprint, reportAgain.fingerprint, "fingerprint must be deterministic");
const sourceB = write("case-b.json", { ...base, independenceValue: "private-project-b" });
const preparedB = run("prepare-skill-usage-case.mjs", ["--case", sourceB, "--outbox", outbox, "--host", host]);
const reportB = JSON.parse(preparedB.stdout).report;
const oneDir = path.join(root, "one"); fs.mkdirSync(oneDir); fs.copyFileSync(reportA, path.join(oneDir, "a.json"));
const aggOne = path.join(root, "agg-one.json");
assert.equal(run("aggregate-skill-usage-cases.mjs", ["--input", oneDir, "--output", aggOne]).status, 0);
assert.notEqual(run("promote-skill-usage-mechanism.mjs", ["--aggregate", aggOne, "--fingerprint", reportAgain.fingerprint, "--output", path.join(root, "no.json"), "--stable-reproduction", "--executable-gate", "--false-positive-reviewed", "--maintainer-approved"]).status, 0);
const twoDir = path.join(root, "two"); fs.mkdirSync(twoDir); fs.copyFileSync(reportA, path.join(twoDir, "a.json")); fs.copyFileSync(reportB, path.join(twoDir, "b.json"));
const aggTwo = path.join(root, "agg-two.json");
assert.equal(run("aggregate-skill-usage-cases.mjs", ["--input", twoDir, "--output", aggTwo]).status, 0);
assert.equal(JSON.parse(fs.readFileSync(aggTwo)).mechanisms[0].lifecycle, "cross-case-candidate");
assert.equal(run("promote-skill-usage-mechanism.mjs", ["--aggregate", aggTwo, "--fingerprint", reportAgain.fingerprint, "--output", path.join(root, "yes.json"), "--stable-reproduction", "--executable-gate", "--false-positive-reviewed", "--maintainer-approved"]).status, 0);

const fakeGh = path.join(scripts, "skill-usage-reporting.fake-gh.mjs");
const submitArgs = ["--report", reportA, "--repo", "owner/feedback", "--outbox", path.join(root, "submit")];
assert.notEqual(run("submit-skill-usage-case.mjs", submitArgs, { SKILL_USAGE_GH_BIN: fakeGh }).status, 0, "confirmation is mandatory");
for (const scenario of ["429", "500", "uncertain"]) assert.notEqual(run("submit-skill-usage-case.mjs", [...submitArgs, "--confirm-reviewed", "--test-scenario", scenario], { SKILL_USAGE_GH_BIN: fakeGh }).status, 0, scenario);
const submitted = run("submit-skill-usage-case.mjs", [...submitArgs, "--confirm-reviewed"], { SKILL_USAGE_GH_BIN: fakeGh });
assert.equal(submitted.status, 0, submitted.stderr);
assert.equal(JSON.parse(submitted.stdout).status, "SUBMITTED");
const duplicate = run("submit-skill-usage-case.mjs", [...submitArgs, "--confirm-reviewed"], { SKILL_USAGE_GH_BIN: fakeGh });
assert.equal(JSON.parse(duplicate.stdout).status, "ALREADY_SUBMITTED");
const mergedOutbox = path.join(root, "merged");
const marker = `brand-skill-fingerprint:${reportAgain.fingerprint}`;
const merged = run("submit-skill-usage-case.mjs", ["--report", reportA, "--repo", "owner/feedback", "--outbox", mergedOutbox, "--confirm-reviewed", "--test-scenario", "existing"], { SKILL_USAGE_GH_BIN: fakeGh, SKILL_USAGE_EXISTING_MARKER: marker });
assert.equal(JSON.parse(merged.stdout).status, "MERGED_EXISTING_ISSUE");
const closed = run("submit-skill-usage-case.mjs", ["--repo", "owner/feedback", "--close-issue", "8", "--confirm-reviewed"], { SKILL_USAGE_GH_BIN: fakeGh });
assert.equal(JSON.parse(closed.stdout).status, "CLOSED");

for (const script of ["prepare-skill-usage-case.mjs", "validate-skill-usage-case.mjs", "export-skill-usage-case-issue.mjs", "aggregate-skill-usage-cases.mjs", "promote-skill-usage-mechanism.mjs"]) {
  assert.doesNotMatch(fs.readFileSync(path.join(scripts, script), "utf8"), /node:https|node:http|\bfetch\s*\(/, `${script} must be offline`);
}
console.log("skill usage reporting tests passed");
