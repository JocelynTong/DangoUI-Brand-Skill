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
fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({ roleContractVersion: "test", roles: { designTranslator: { goal: "translate" }, brandResearcher: { goal: "observe" } } }));
fs.writeFileSync(path.join(skillDir, "scripts", "brand-guard.mjs"), "process.exit(0);\n");
// This fixture tests retry numbering; handoff coverage is exercised by its
// dedicated validator tests, so keep the gate dependency isolated here.
fs.writeFileSync(path.join(skillDir, "scripts", "validate-learn-brand-handoff.mjs"), "process.exit(0);\n");
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
const run = spawnSync(process.execPath, [script, "record", "--brand", brand, "--root", root, "--receipt", `migrations/${brand}/receipts/evidence-2.json`], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillDir } });
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
updated.status = "blocked";
updated.stages = [{ id: "evidence-2", stage: "evidence", role: "brandResearcher", attempt: 2, status: "failed", verdict: "needs-evidence", blockingFindings: [{ code: "MISSING_STATE" }] }];
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(updated));
const goalBefore = fs.readFileSync(goalFile, "utf8");
const resume = (extra = []) => spawnSync(process.execPath, [script, "resume-evidence", "--brand", brand, "--root", root, ...extra], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillDir } });
assert.notEqual(resume().status, 0);
assert.equal(resume(["--continue-existing"]).status, 0);
const continued = JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json")));
assert.equal(continued.stages.at(-1).attempt, 3);
assert.equal(continued.continuations.at(-1).additionalAttempts, 1);
assert.equal(continued.stages.at(-1).retryInput.blockingFindings[0].code, "MISSING_STATE");
assert.equal(continued.stages.at(-1).retryInput.failedAttemptArchive, undefined, "legacy receipt-free fixtures must not invent archives");
assert.equal(fs.readFileSync(goalFile, "utf8"), goalBefore);
continued.status = "blocked";
Object.assign(continued.stages.at(-1), { status: "failed", verdict: "needs-evidence" });
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(continued));
assert.notEqual(resume().status, 0, "a prior authorization cannot silently authorize another retry");
// A consumer can reject accepted Evidence without rewriting its historical PASS.
continued.stages = [
  { id: "evidence-2", stage: "evidence", role: "brandResearcher", attempt: 2, status: "complete", verdict: "pass", blockingFindings: [] },
  { id: "interpreter-1", stage: "interpreter", role: "designTranslator", attempt: 1, status: "failed", verdict: "needs-evidence", failureOwnerRole: "brandResearcher", blockingFindings: [{ code: "HERO_BINDING_MISSING" }], deltaScope: { affectedSections: ["hero"] } }
];
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(continued));
assert.notEqual(resume().status, 0, "consumer rejection does not reset exhausted Evidence budget");
assert.equal(resume(["--continue-existing"]).status, 0);
const consumerRetry = JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json")));
assert.equal(consumerRetry.stages[0].verdict, "pass");
assert.equal(consumerRetry.stages.at(-1).retryInput.rejectedByStageId, "interpreter-1");
assert.deepEqual(consumerRetry.stages.at(-1).retryInput.deltaScope, { affectedSections: ["hero"] });
assert.equal(consumerRetry.stages.at(-1).retryInput.blockingFindings[0].code, "HERO_BINDING_MISSING");
assert.equal(consumerRetry.continuations.at(-1).resumedFrom, "interpreter-1");
assert.equal(fs.readFileSync(goalFile, "utf8"), goalBefore);
const dispatchRun = spawnSync(process.execPath, [script, "next", "--brand", brand, "--root", root], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillDir } });
assert.equal(dispatchRun.status, 0, dispatchRun.stderr);
const packet = JSON.parse(dispatchRun.stdout).dispatchRequest;
assert.equal(packet.retryInput.rejectedByStageId, "interpreter-1");
assert.equal(packet.retryInput.blockingFindings[0].code, "HERO_BINDING_MISSING");
assert.deepEqual(packet.retryInput.deltaScope.affectedSections, ["hero"]);
assert.equal(packet.receiptContract.path, "migrations/fixture/receipts/evidence-3.json");
assert.deepEqual(packet.receiptContract.recordCommand.slice(-2), ["--receipt", packet.receiptContract.path]);
assert.ok(packet.receiptContract.requiredFields.includes("agentExecutionId"));
continued.stages.at(-1).failureOwnerRole = "designDirectorOrchestrator";
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(continued));
assert.notEqual(resume(["--continue-existing"]).status, 0, "director-only rejection cannot trigger Evidence recollection");
continued.stages = [
  { id: "evidence-2", stage: "evidence", role: "brandResearcher", attempt: 2, status: "complete", verdict: "pass" },
  { id: "demo-1", stage: "demo", role: "demoImplementationAgent", attempt: 1, status: "failed", verdict: "needs-evidence", failureOwnerRole: "designDirectorOrchestrator", blockingFindings: [{ code: "STRUCTURE_UNAPPROVED", owner: "designDirectorOrchestrator" }, { code: "FONT_BODY_MISSING", owner: "brandResearcher" }], deltaScope: { affectedSections: ["typography"] } }
];
fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(continued));
assert.notEqual(resume().status, 0, "mixed consumer finding does not erase exhausted budget");
assert.equal(resume(["--continue-existing"]).status, 0);
const mixedRetry = JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json")));
assert.deepEqual(mixedRetry.stages.at(-1).retryInput.blockingFindings.map(x => x.code), ["FONT_BODY_MISSING"]);
assert.deepEqual(mixedRetry.stages.at(-1).retryInput.deferredBlockingFindings.map(x => x.code), ["STRUCTURE_UNAPPROVED"]);
assert.equal(mixedRetry.stages.at(-1).retryInput.rejectedByStageId, "demo-1");
assert.equal(mixedRetry.stages[0].verdict, "pass");
assert.equal(fs.readFileSync(goalFile, "utf8"), goalBefore);
// Real recorded Evidence bytes survive both producer failure and consumer rejection.
const manifestPath = path.join(migration, "execution-manifest.json");
const nextDispatch = () => spawnSync(process.execPath, [script, "next", "--brand", brand, "--root", root], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillDir } });
for (const consumerRejected of [false, true]) {
  const id = consumerRejected ? "evidence-accepted" : "evidence-failed";
  const realReceiptFile = path.join(migration, "receipts", `${id}.json`);
  fs.writeFileSync(outputFile, `original Evidence ${id}\n`);
  fs.writeFileSync(realReceiptFile, JSON.stringify({ ...receipt, stageId: id, verdict: consumerRejected ? "pass" : "needs-evidence", outputs: [{ path: `migrations/${brand}/evidence.json`, sha256: sha(outputFile) }] }));
  const oldBytes = fs.readFileSync(outputFile);
  const oldReceiptBytes = fs.readFileSync(realReceiptFile);
  const realStage = {
    id, stage: "evidence", role: "brandResearcher", attempt: 2,
    status: consumerRejected ? "complete" : "failed", verdict: consumerRejected ? "pass" : "needs-evidence",
    blockingFindings: [{ code: "MISSING_STATE" }], dispatchPath: `migrations/${brand}/dispatch.json`,
    receiptPath: `migrations/${brand}/receipts/${id}.json`, receiptSha256: sha(realReceiptFile),
    outputHashes: [{ path: `migrations/${brand}/evidence.json`, sha256: sha(outputFile) }],
  };
  const realManifest = { ...updated, status: "blocked", stages: [realStage], evidenceRetries: [] };
  if (consumerRejected) realManifest.stages.push({ id: "consumer-rejection", stage: "interpreter", role: "designTranslator", attempt: 1, status: "failed", verdict: "needs-evidence", failureOwnerRole: "brandResearcher", blockingFindings: [{ code: "MISSING_STATE" }], deltaScope: { inputPaths: [] } });
  fs.writeFileSync(manifestPath, JSON.stringify(realManifest));
  assert.notEqual(resume().status, 0, "real receipt does not reset exhausted retry budget");
  assert.ok(!fs.existsSync(path.join(migration, "attempts", id)), "unauthorized retry must not archive");
  fs.writeFileSync(outputFile, "tampered before archive");
  assert.notEqual(resume(["--continue-existing"]).status, 0, "modified canonical Evidence must be refused before archival");
  fs.writeFileSync(outputFile, oldBytes);
  const result = resume(["--continue-existing"]);
  assert.equal(result.status, 0, result.stderr);
  const preserved = JSON.parse(fs.readFileSync(manifestPath));
  assert.deepEqual(preserved.stages.slice(0, realManifest.stages.length), realManifest.stages, "old stages remain unchanged");
  const retry = preserved.stages.at(-1);
  assert.equal(retry.attempt, 3);
  assert.equal(preserved.continuations.at(-1).additionalAttempts, 1);
  const archiveRef = retry.retryInput.failedAttemptArchive;
  const archivePath = path.join(root, archiveRef.path);
  assert.equal(sha(archivePath), archiveRef.sha256);
  const archiveBytes = fs.readFileSync(archivePath);
  const archive = JSON.parse(archiveBytes);
  assert.deepEqual(archive.stage, realStage);
  const archivedEvidence = path.join(root, archive.archivedOutputs.find(item => item.originalPath === realStage.outputHashes[0].path).path);
  const archivedReceipt = path.join(root, archive.archivedOutputs.find(item => item.originalPath === realStage.receiptPath).path);
  fs.writeFileSync(outputFile, "replacement Evidence\n");
  assert.deepEqual(fs.readFileSync(archivedEvidence), oldBytes);
  assert.deepEqual(fs.readFileSync(archivedReceipt), oldReceiptBytes);
  assert.deepEqual(fs.readFileSync(realReceiptFile), oldReceiptBytes);
  fs.writeFileSync(archivedEvidence, "tampered archive output");
  assert.notEqual(nextDispatch().status, 0, "archive output tampering blocks dispatch");
  fs.writeFileSync(archivedEvidence, oldBytes);
  fs.writeFileSync(archivePath, "tampered archive manifest");
  assert.notEqual(nextDispatch().status, 0, "archive manifest tampering blocks dispatch");
  fs.writeFileSync(archivePath, archiveBytes);
  const dispatch = nextDispatch();
  assert.equal(dispatch.status, 0, dispatch.stderr);
  assert.ok(JSON.parse(dispatch.stdout).dispatchRequest.requiredInputs.some(item => item.path === archiveRef.path && item.sha256 === archiveRef.sha256));
  assert.equal(fs.readFileSync(goalFile, "utf8"), goalBefore);
}
process.stdout.write("brand subagent role-local attempt regression passed\n");
