#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-apply-host-test-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const skillDir = path.join(root, "skills", "brand");
const scriptsDir = path.join(skillDir, "scripts");
fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
fs.mkdirSync(scriptsDir, { recursive: true });

const goalFile = path.join(migration, "goal-contract.json");
fs.writeFileSync(goalFile, JSON.stringify({ sealed: true, mode: "apply-host", goalId: "fixture-host-goal", thresholds: { maxAttempts: 2 } }));
fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({
  roleContractVersion: "test",
  roles: {
    hostStrategist: { goal: "diagnose host", outputs: ["host-opportunity-map.json"] },
    hostImplementationAgent: { goal: "apply theme", outputs: ["host-rendered-proof.json"] },
    visualQA: { goal: "review host", outputs: ["visual-qa-report.json"] },
  },
}));
fs.writeFileSync(path.join(scriptsDir, "validate-host-structural-diff.mjs"), "process.exit(0);\n");

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const run = (...command) => {
  const result = spawnSync(process.execPath, [script, ...command, "--brand", brand, "--root", root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
};
const readManifest = () => JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"));
const writeOutput = (name, content) => {
  const file = path.join(migration, name);
  fs.writeFileSync(file, content);
  return { path: `migrations/${brand}/${name}`, sha256: sha(file) };
};
const recordCurrent = (agentExecutionId, output) => {
  const manifest = readManifest();
  const current = manifest.stages.find((item) => item.id === manifest.currentStageId);
  const dispatch = JSON.parse(fs.readFileSync(path.join(root, current.dispatchPath), "utf8"));
  const receipt = {
    dispatchId: dispatch.dispatchId,
    stageId: current.id,
    role: current.role,
    agentExecutionId,
    goalSha256: manifest.goalSha256,
    verdict: "pass",
    inputs: dispatch.requiredInputs,
    outputs: [output],
    blockingFindings: [],
  };
  const receiptPath = path.join(migration, "receipts", `${current.id}.json`);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  return run("record", "--receipt", `migrations/${brand}/receipts/${current.id}.json`);
};

const prepared = run("prepare");
assert.match(prepared.next, /hostStrategy/);
let manifest = readManifest();
assert.equal(manifest.mode, "apply-host");
assert.equal(manifest.executionProfile, "fast");
assert.equal(manifest.currentStageId, "hostStrategy-1");
assert.deepEqual(manifest.stages.map(({ stage, role }) => [stage, role]), [["hostStrategy", "hostStrategist"]]);

const strategyDispatch = run("next");
assert.equal(strategyDispatch.dispatchRequest.executionProfile, "fast");
assert.ok(strategyDispatch.dispatchRequest.scopeRules.some((item) => item.includes("full-host coverage matrix")));
recordCurrent("/root/host-strategist", writeOutput("host-opportunity-map.json", "host strategy"));
manifest = readManifest();
assert.equal(manifest.currentStageId, "hostImplementation-1");

writeOutput("preedit-baseline-bundle.json", "{}");
writeOutput("structural-targets.json", "{}");
run("next");
recordCurrent("/root/host-implementation", writeOutput("host-rendered-proof.json", "rendered host"));
manifest = readManifest();
assert.equal(manifest.currentStageId, "previewQA-1");

run("next");
recordCurrent("/root/host-preview-qa", writeOutput("preview-smoke-report.json", "preview qa"));
manifest = readManifest();
assert.equal(manifest.status, "awaiting-user");
assert.equal(manifest.currentStageId, null);
assert.equal(manifest.previewDecision.status, "pending");
assert.ok(Number.isFinite(manifest.timeToFirstPreviewMs));
const previewStatus = run("status");
assert.match(previewStatus.nextAction, /approve, revise or certify/);

const approved = run("approve-preview", "--decision", "approve");
assert.equal(approved.nextStageId, "visualQA-1");
run("next");
recordCurrent("/root/host-visual-qa", writeOutput("visual-qa-report.json", "host qa"));
manifest = readManifest();
assert.equal(manifest.status, "passed");
assert.equal(manifest.currentStageId, null);
assert.equal(manifest.stages.some((item) => ["evidence", "interpreter", "demo"].includes(item.stage)), false);
const statusBeforeFinalize = run("status");
assert.match(statusBeforeFinalize.nextAction, /Run finalize/);

const finalized = run("finalize");
assert.equal(finalized.status, "complete");
manifest = readManifest();
assert.equal(manifest.status, "complete");
assert.equal(manifest.currentStageId, null);
assert.equal(fs.existsSync(path.join(migration, "fidelity-report.json")), false, "apply-host must not require learn-brand fidelity-report.json");

process.stdout.write("brand subagent apply-host routing regression passed\n");
