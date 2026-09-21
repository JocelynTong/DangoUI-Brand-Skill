#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || fallback : fallback;
};
const root = path.resolve(value("--root", process.cwd()));
const baseline = value("--baseline", "1b34c29");
const reportFile = path.resolve(root, value("--report", "output/brand-phase1-acceptance.json"));
const startedAt = new Date().toISOString();
const checks = [];

function check(id, pass, details = {}) {
  checks.push({ id, status: pass ? "pass" : "fail", ...details });
  assert.equal(pass, true, `${id} failed: ${JSON.stringify(details)}`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8" });
  checks.push({
    id: `${command} ${commandArgs.join(" ")}`,
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    stdout: String(result.stdout || "").trim().split(/\r?\n/).slice(-4),
    stderr: String(result.stderr || "").trim().split(/\r?\n/).slice(-4),
  });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed\n${result.stderr || result.stdout}`);
  return result;
}

const skillFile = path.join(root, "skills", "brand", "SKILL.md");
const claudeSkillFile = path.join(root, ".claude", "skills", "brand", "SKILL.md");
const contractFile = path.join(root, "skills", "brand", "workflow-contract.json");
const currentBytes = fs.statSync(skillFile).size;
const baselineResult = run("git", ["show", `${baseline}:skills/brand/SKILL.md`]);
const baselineBytes = Buffer.byteLength(baselineResult.stdout);
const reductionRatio = 1 - currentBytes / baselineBytes;
const contract = JSON.parse(fs.readFileSync(contractFile, "utf8"));

check("skill-entry-under-10kb", currentBytes <= 10_000, { currentBytes, thresholdBytes: 10_000 });
check("skill-entry-reduction-at-least-80-percent", reductionRatio >= 0.8, { baseline, baselineBytes, currentBytes, reductionPercent: Number((reductionRatio * 100).toFixed(1)) });
check("claude-mirror-synced", fs.existsSync(claudeSkillFile) && fs.readFileSync(skillFile).equals(fs.readFileSync(claudeSkillFile)), { skillFile: path.relative(root, skillFile), mirrorFile: path.relative(root, claudeSkillFile) });
check("workflow-contract-version", Number(contract.version) >= 0.16 && Number(contract.roleContractVersion) >= 3.1, { version: contract.version, roleContractVersion: contract.roleContractVersion });

for (const test of [
  "skills/brand/scripts/brand-subagent-workflow.apply-host.test.mjs",
  "skills/brand/scripts/run-brand-workflow.apply-host.test.mjs",
  "skills/brand/scripts/validate-wild-design-decision.test.mjs",
  "skills/brand/scripts/validate-brand-application-plan.test.mjs",
  "skills/brand/scripts/validate-concept-asset-provenance.test.mjs",
  "skills/brand/scripts/brand-subagent-workflow.attempts.test.mjs",
  "skills/brand/scripts/brand-subagent-workflow.prepare.test.mjs",
]) run(process.execPath, [test]);

run("git", ["diff", "--check", "--", "skills/brand", ".claude/skills/brand"]);

const report = {
  schema: "brand-phase1-acceptance/v1",
  verdict: checks.every((item) => item.status === "pass") ? "PASS" : "FAIL",
  baseline,
  startedAt,
  completedAt: new Date().toISOString(),
  metrics: {
    baselineSkillBytes: baselineBytes,
    currentSkillBytes: currentBytes,
    entryReductionPercent: Number((reductionRatio * 100).toFixed(1)),
    targetEntryReductionPercent: 80,
  },
  guarantees: [
    "design-host fast defaults to static H5 and rejects raster/vector directions without an explicit user exception",
    "design-host stops before host implementation",
    "fast apply-host reuses Smoke QA only while frozen artifacts remain byte-identical",
    "changed artifacts and non-fast profiles dispatch independent post-approval Visual QA",
    "role dispatches carry minimum-role-packet context policy and forbid bulk reads",
  ],
  checks,
};

fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, report: path.relative(root, reportFile), verdict: report.verdict, metrics: report.metrics, checkCount: checks.length }, null, 2)}\n`);
