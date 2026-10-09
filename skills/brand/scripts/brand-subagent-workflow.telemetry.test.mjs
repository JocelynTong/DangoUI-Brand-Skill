#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-telemetry-test-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const skillDir = path.join(root, "skills", "brand");
fs.mkdirSync(migration, { recursive: true });
fs.mkdirSync(skillDir, { recursive: true });
fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ sealed: true, mode: "learn-brand", goalId: "fixture-goal" }));
fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({
  roleContractVersion: "test",
  roles: {
    brandResearcher: {
      goal: "fixture",
      inputs: { allowed: [], forbidden: [] },
      tasks: [],
      requirements: [],
      outputs: [],
      passCriteria: [],
      failCriteria: [],
    },
  },
}));

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const env = { ...process.env, BRAND_SKILL_ROOT: skillDir };
run(["prepare", "--brand", brand, "--root", root]);
const dispatched = run(["next", "--brand", brand, "--root", root]);
const request = JSON.parse(dispatched.stdout).dispatchRequest;

const artifact = path.join(migration, "failed-evidence.json");
fs.writeFileSync(artifact, JSON.stringify({ status: "failed" }));
const receipt = {
  dispatchId: request.dispatchId,
  stageId: request.stageId,
  role: request.role,
  agentExecutionId: "/root/telemetry-fixture",
  goalSha256: request.goalSha256,
  verdict: "fail",
  inputs: request.requiredInputs,
  outputs: [{ path: path.relative(root, artifact), sha256: sha256(artifact) }],
  blockingFindings: [{ code: "FIXTURE_FAILURE", message: "Telemetry fixture intentionally records a blocking receipt." }],
  failureOwnerRole: "brandResearcher",
  toolCalls: [{ id: "image-1", tool: "image_gen", arguments: { prompt: "short fixture prompt" } }],
  extraReads: [{ path: path.relative(root, artifact), sha256: sha256(artifact), bytes: fs.statSync(artifact).size }],
  usage: { actualInputTokens: 120, actualOutputTokens: 30 },
};
const receiptFile = path.join(migration, "evidence-1-receipt.json");
fs.writeFileSync(receiptFile, JSON.stringify(receipt));
run(["record", "--brand", brand, "--root", root, "--receipt", path.relative(root, receiptFile)]);

const telemetry = JSON.parse(fs.readFileSync(path.join(migration, "workflow-telemetry.json"), "utf8"));
assert.equal(telemetry.schema, "brand-workflow-telemetry/v2");
assert.equal(telemetry.imageGenerationCalls, 1);
assert.equal(telemetry.promptCharacters, "short fixture prompt".length);
assert.deepEqual(telemetry.modelUsage, { reportedReceipts: 1, inputTokens: 120, outputTokens: 30 });
assert.ok(telemetry.additionalReadBytes > 0);
assert.equal(telemetry.tokenAccounting, "reported");
assert.ok(telemetry.uniqueInputFiles >= 1);
assert.ok(telemetry.uniqueInputBytes > 0);
assert.ok(Number.isFinite(telemetry.stageDurationsMs.evidence));
assert.equal("seenInputSha256" in telemetry, false, "internal de-duplication hashes must not leak into the public telemetry artifact");

process.stdout.write("brand workflow telemetry regression passed\n");

function run(argv) {
  const result = spawnSync(process.execPath, [script, ...argv], { encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
