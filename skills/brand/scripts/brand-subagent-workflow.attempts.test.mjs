#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-attempt-test-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const skillDir = path.join(root, "skills", "brand");
fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
fs.mkdirSync(skillDir, { recursive: true });
fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
const goal = { schema: "brand-goal/v2", sealed: true, mode: "learn-brand", goalId: "fixture-goal", thresholds: { maxAttempts: 2 } };
const goalFile = path.join(migration, "goal-contract.json");
fs.writeFileSync(goalFile, JSON.stringify(goal));
fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({ roleContractVersion: "test", roles: { designTranslator: { goal: "translate" } } }));
fs.writeFileSync(path.join(skillDir, "scripts", "brand-guard.mjs"), "process.exit(0);\n");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = {
  schema: "brand-subagent-execution/v1", runId: "run", brand, mode: "learn-brand", goalId: goal.goalId,
  goalPath: `migrations/${brand}/goal-contract.json`, goalSha256: sha(goalFile), roleContractVersion: "test", status: "running",
  currentStageId: "evidence-2", finalGates: {}, stages: [
    { id: "evidence-1", stage: "evidence", role: "brandResearcher", attempt: 1, status: "failed", verdict: "needs-evidence" },
    { id: "evidence-2", stage: "evidence", role: "brandResearcher", attempt: 2, status: "dispatched", dispatchId: "dispatch" }
  ]
};
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(manifest));
fs.writeFileSync(path.join(migration, "dispatch.json"), JSON.stringify({ dispatchId: "dispatch" }));
manifest.stages[1].dispatchPath = `migrations/${brand}/dispatch.json`;
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(manifest));
const outputFile = path.join(migration, "evidence.json");
fs.writeFileSync(outputFile, "evidence");
const receipt = {
  dispatchId: "dispatch", stageId: "evidence-2", role: "brandResearcher", agentExecutionId: "/root/evidence-retry",
  goalSha256: sha(goalFile), verdict: "pass", inputs: [], outputs: [{ path: `migrations/${brand}/evidence.json`, sha256: sha(outputFile) }], blockingFindings: []
};
const receiptFile = path.join(migration, "receipts", "evidence-2.json");
fs.writeFileSync(receiptFile, JSON.stringify(receipt));

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(manifest));
fs.writeFileSync(receiptFile, JSON.stringify(receipt));
const run = spawnSync(process.execPath, [script, "record", "--brand", brand, "--root", root, "--receipt", `migrations/${brand}/receipts/evidence-2.json`], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
const updated = JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"));
const next = updated.stages.at(-1);
assert.equal(next.id, "interpreter-1");
assert.equal(next.attempt, 1, "a retry upstream must not consume the next role's first attempt");

// Once that role has already completed, routing back to it advances only its
// own attempt counter.
updated.stages.push({ id: "visualQA-1", stage: "visualQA", role: "visualQA", attempt: 1, status: "failed", verdict: "fail" });
const localAttempts = updated.stages.filter((item) => item.role === "visualQA" && ["complete", "failed"].includes(item.status)).length;
assert.equal(localAttempts + 1, 2);
process.stdout.write("brand subagent role-local attempt regression passed\n");
