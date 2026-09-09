#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0];
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand", "");
if (!command || !brand) fail("Usage: brand-subagent-workflow.mjs <prepare|next|record|status|finalize> --brand <brand>");

const migrationDir = path.join(root, "migrations", brand);
const goalFile = path.join(migrationDir, "goal-contract.json");
const manifestFile = path.join(migrationDir, "execution-manifest.json");
const contractFile = path.join(root, "skills", "brand", "workflow-contract.json");

if (command === "prepare") prepare();
else if (command === "next") next();
else if (command === "record") record();
else if (command === "status") status();
else if (command === "finalize") finalize();
else fail(`Unknown command: ${command}`);

function prepare() {
  const goal = readJsonRequired(goalFile);
  if (goal.sealed !== true) fail("goal-contract.json must be sealed before prepare.");
  const contract = readJsonRequired(contractFile);
  const manifest = {
    schema: "brand-subagent-execution/v1",
    runId: crypto.randomUUID(),
    brand,
    mode: goal.mode || "learn-brand",
    goalId: goal.goalId,
    goalPath: relative(goalFile),
    goalSha256: sha256File(goalFile),
    roleContractVersion: contract.roleContractVersion || null,
    status: "running",
    createdAt: new Date().toISOString(),
    currentStageId: "evidence-1",
    stages: [stage("evidence", "brandResearcher", 1)],
    finalGates: {},
  };
  writeJson(manifestFile, manifest);
  output({ ok: true, manifest: relative(manifestFile), runId: manifest.runId, next: "Run next to obtain the Evidence dispatch request." });
}

function next() {
  const manifest = validateManifest();
  if (manifest.status !== "running") return output({ ok: false, status: manifest.status, message: "Workflow is not dispatchable." }, 2);
  const current = manifest.stages.find((item) => item.id === manifest.currentStageId);
  if (!current || current.status !== "pending") fail("Current stage is not pending; record its receipt or inspect status.");
  if (current.stage === "demo") verifyDesignDirectionGate();
  if (current.role === "hostImplementationAgent") verifyHostPreeditGate("dispatch");
  const contract = readJsonRequired(contractFile);
  const roleContract = contract.roles?.[current.role];
  if (!roleContract) fail(`Missing role contract for ${current.role}.`);
  const inputs = dispatchInputs(manifest, current);
  const request = {
    schema: "brand-subagent-dispatch/v1",
    dispatchId: crypto.randomUUID(),
    runId: manifest.runId,
    stageId: current.id,
    stage: current.stage,
    role: current.role,
    attempt: current.attempt,
    goalId: manifest.goalId,
    goalSha256: manifest.goalSha256,
    mission: roleContract.goal,
    roleContractVersion: manifest.roleContractVersion,
    requiredInputs: inputs,
    allowedInputs: roleContract.inputs?.allowed || [],
    forbiddenInputs: roleContract.inputs?.forbidden || [],
    tasks: roleContract.tasks || [],
    requirements: roleContract.requirements || [],
    mustNot: roleContract.mustNot || [],
    expectedOutputs: roleContract.outputs || [],
    passCriteria: roleContract.passCriteria || [],
    failCriteria: roleContract.failCriteria || [],
    receiptRequirements: ["agentExecutionId from a real spawned subagent", "goalSha256 unchanged", "input and output file sha256 values", "pass/fail/needs-evidence verdict", "on fail, failureOwnerRole identifies brandResearcher, designTranslator, designDirectorOrchestrator, or demoImplementationAgent"],
  };
  const dispatchFile = path.join(migrationDir, "dispatch", `${current.id}.json`);
  writeJson(dispatchFile, request);
  current.dispatchId = request.dispatchId;
  current.dispatchPath = relative(dispatchFile);
  current.status = "dispatched";
  current.startedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  output({ ok: true, dispatchRequest: request, dispatchFile: relative(dispatchFile), instruction: "The outer Orchestrator must now spawn a real subagent with exactly this packet." });
}

function record() {
  const receiptArg = opt("--receipt", "");
  if (!receiptArg) fail("record requires --receipt <file>.");
  const receiptFile = path.resolve(root, receiptArg);
  const receipt = readJsonRequired(receiptFile);
  const manifest = validateManifest();
  const current = manifest.stages.find((item) => item.id === manifest.currentStageId);
  if (!current || current.status !== "dispatched") fail("No dispatched current stage is waiting for a receipt.");
  if (current.role === "hostImplementationAgent") verifyHostPreeditGate("receipt");
  const dispatch = readJsonRequired(path.join(root, current.dispatchPath));
  if (receipt.dispatchId !== current.dispatchId || receipt.dispatchId !== dispatch.dispatchId) fail("Receipt dispatchId does not match the active dispatch packet.");
  if (receipt.stageId !== current.id || receipt.role !== current.role) fail("Receipt is out of order or belongs to another role.");
  if (!receipt.agentExecutionId || !String(receipt.agentExecutionId).startsWith("/root/") || receipt.agentExecutionId === "/root") fail("Receipt must identify a real spawned subagent execution.");
  if (receipt.goalSha256 !== manifest.goalSha256) fail("Receipt goal hash does not match the frozen goal.");
  if (!['pass', 'fail', 'needs-evidence'].includes(receipt.verdict)) fail("Receipt verdict must be pass, fail or needs-evidence.");
  const receiptInputs = array(receipt.inputs);
  for (const required of array(dispatch.requiredInputs)) {
    const received = receiptInputs.find((item) => item.path === required.path);
    if (!received || received.sha256 !== required.sha256) fail(`Receipt is missing frozen dispatch input: ${required.path}`);
  }
  const receiptOutputs = array(receipt.outputs);
  const overwrittenOutputPaths = new Set(receiptOutputs.map((item) => item.path));
  for (const item of receiptInputs) {
    // Retry dispatches intentionally freeze the previous implementation as input,
    // while the current stage overwrites the same path as its output. The frozen
    // hash is already checked against dispatch.requiredInputs above; only the new
    // output hash can match the file that now exists on disk.
    if (!overwrittenOutputPaths.has(item.path)) verifyHashedPath(item);
  }
  for (const item of receiptOutputs) verifyHashedPath(item);
  if (current.role === "brandResearcher" && receipt.verdict === "pass") verifyEvidenceVisibilityGate();
  if (array(receipt.outputs).length === 0) fail("Receipt must include at least one hashed output.");
  if (current.role === "visualQA") {
    const latestDemo = [...manifest.stages].reverse().find((item) => ["demoImplementationAgent", "implementationAgent"].includes(item.role) && item.status === "complete");
    if (latestDemo?.agentExecutionId === receipt.agentExecutionId) fail("Visual QA must use a different subagent from Demo implementation.");
  }
  current.status = receipt.verdict === "pass" ? "complete" : "failed";
  current.verdict = receipt.verdict;
  current.agentExecutionId = receipt.agentExecutionId;
  current.receiptPath = relative(receiptFile);
  current.receiptSha256 = sha256File(receiptFile);
  current.outputHashes = array(receipt.outputs);
  current.blockingFindings = array(receipt.blockingFindings);
  current.failureOwnerRole = receipt.failureOwnerRole || null;
  current.endedAt = new Date().toISOString();
  advance(manifest, current);
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, completedStage: current.id, nextStageId: manifest.currentStageId || null, blockingFindings: current.blockingFindings });
}

function status() {
  const before = fs.existsSync(manifestFile) ? sha256File(manifestFile) : null;
  const manifest = validateManifest();
  const after = sha256File(manifestFile);
  const proofStatus = readProofStatus();
  output({ ok: true, readOnly: before === after, proofStatus, nextAction: nextAction(manifest, proofStatus), manifest });
}

function finalize() {
  const manifest = validateManifest();
  const fidelityFile = path.join(migrationDir, "fidelity-report.json");
  const fidelity = readJsonRequired(fidelityFile);
  const qaStage = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  const proofStatus = proofStatusFromFidelity(fidelity);
  if (manifest.status !== "passed" || qaStage?.verdict !== "pass" || fidelity.status !== "fidelity-pass" || !allProofsPass(proofStatus)) {
    return output({ ok: false, status: "blocked", workflowStatus: manifest.status, fidelityStatus: fidelity.status, proofStatus, message: "Protocol plus Evidence Fidelity, Structural Fidelity, and Generative Proof must all pass independently." }, 2);
  }
  manifest.status = "complete";
  manifest.finalGates = { protocol: "pass", evidenceFidelity: "pass", structuralFidelity: "pass", generativeProof: "pass", fidelity: "pass", finalizedAt: new Date().toISOString() };
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "complete", finalGates: manifest.finalGates });
}

function advance(manifest, current) {
  if (current.verdict === "needs-evidence") {
    manifest.status = "blocked";
    manifest.currentStageId = null;
    return;
  }
  const order = ["evidence", "interpreter", "demo", "visualQA"];
  if (current.verdict === "pass") {
    const index = order.indexOf(current.stage);
    if (index === order.length - 1) {
      manifest.status = "passed";
      manifest.currentStageId = null;
      return;
    }
    const nextStageName = order[index + 1];
    const nextRole = { evidence: "brandResearcher", interpreter: "designTranslator", demo: "demoImplementationAgent", visualQA: "visualQA" }[nextStageName];
    const nextStage = stage(nextStageName, nextRole, current.attempt);
    manifest.stages.push(nextStage);
    manifest.currentStageId = nextStage.id;
    return;
  }
  if (current.stage === "visualQA") {
    const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
    if (current.attempt >= maxAttempts) {
      manifest.status = "blocked";
      manifest.currentStageId = null;
      return;
    }
    if (["designDirector", "designDirectorOrchestrator"].includes(current.failureOwnerRole)) {
      manifest.status = "blocked";
      manifest.currentStageId = null;
      manifest.orchestratorAction = "Revise and revalidate design-direction.json, then prepare a scoped rerun from Demo.";
      return;
    }
    const routed = {
      brandResearcher: ["evidence", "brandResearcher"],
      designTranslator: ["interpreter", "designTranslator"],
      demoImplementationAgent: ["demo", "demoImplementationAgent"],
      implementationAgent: ["demo", "demoImplementationAgent"],
    }[current.failureOwnerRole] || ["demo", "demoImplementationAgent"];
    const retry = stage(routed[0], routed[1], current.attempt + 1);
    retry.retryInput = { goalSha256: manifest.goalSha256, blockingFindings: current.blockingFindings };
    manifest.stages.push(retry);
    manifest.currentStageId = retry.id;
    return;
  }
  manifest.status = "blocked";
  manifest.currentStageId = null;
}

function dispatchInputs(manifest, current) {
  const goalInput = hashedPath(relative(goalFile));
  if (current.role === "hostImplementationAgent") {
    const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
    return latestInputsByPath([goalInput, ...previousOutputs, hashedPath(`migrations/${brand}/preedit-baseline-bundle.json`)]);
  }
  if (current.stage === "evidence") return [goalInput];
  if (current.stage === "demo") {
    const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
    return latestInputsByPath([goalInput, ...previousOutputs, hashedPath(`migrations/${brand}/design-direction.json`)]);
  }
  if (current.stage === "visualQA") {
    const goal = readJsonRequired(goalFile);
    const sourceScreenshots = array(goal.referencePages).map((item) => item?.screenshot).filter(Boolean).map(hashedPath);
    const demoScreenshots = array(goal.demoPages).map((item) => item?.screenshot).filter(Boolean).map(hashedPath);
    // qa-input-manifest.json is authored/refreshed by Visual QA for this run. Treating
    // it as a frozen input makes a valid receipt impossible because the same path
    // would need to retain its old hash and report its new output hash simultaneously.
    return [goalInput, ...sourceScreenshots, ...demoScreenshots, hashedPath(`migrations/${brand}/visual-pattern-inventory.json`), hashedPath(`migrations/${brand}/generative-proof.json`)];
  }
  const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
  return latestInputsByPath([goalInput, ...previousOutputs]);
}

function verifyHostPreeditGate(phase) {
  const validator = path.join(root, "skills", "brand", "scripts", "validate-host-structural-diff.mjs");
  const bundle = path.join(migrationDir, "preedit-baseline-bundle.json");
  const targets = path.join(migrationDir, "structural-targets.json");
  if (!fs.existsSync(bundle)) fail(`Host Implementation ${phase} is blocked: missing orchestrator-authored ${relative(bundle)}.`);
  if (!fs.existsSync(targets)) fail(`Host Implementation ${phase} is blocked: missing approved ${relative(targets)}.`);
  try {
    execFileSync(process.execPath, [validator, "verify-preedit", "--bundle", bundle, "--targets", targets, "--phase", phase], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`Host Implementation ${phase} pre-edit baseline gate failed.${details ? `\n${details}` : ""}`);
  }
}

function latestInputsByPath(items) {
  const latest = new Map();
  for (const item of items) latest.set(item.path, item);
  return [...latest.values()];
}

function validateManifest() {
  const manifest = readJsonRequired(manifestFile);
  if (manifest.goalSha256 !== sha256File(goalFile)) fail("Frozen goal changed after prepare.");
  return manifest;
}
function readProofStatus() {
  const file = path.join(migrationDir, "fidelity-report.json");
  if (!fs.existsSync(file)) return { evidenceFidelity: "pending", structuralFidelity: "pending", generativeProof: "pending" };
  return proofStatusFromFidelity(readJsonRequired(file));
}
function proofStatusFromFidelity(fidelity) {
  const proofs = fidelity?.proofs || fidelity?.proofStatus || {};
  const value = (key) => typeof proofs[key] === "string" ? proofs[key] : proofs[key]?.status || "pending";
  return { evidenceFidelity: value("evidenceFidelity"), structuralFidelity: value("structuralFidelity"), generativeProof: value("generativeProof") };
}
function allProofsPass(proofs) { return Object.values(proofs).every((value) => value === "pass"); }
function nextAction(manifest, proofs) {
  const failed = Object.entries(proofs).filter(([, value]) => value === "fail").map(([key]) => key);
  if (failed.length) return `Rework failed independent proof(s): ${failed.join(", ")}; then recapture and dispatch a fresh Visual QA.`;
  const pending = Object.entries(proofs).filter(([, value]) => value !== "pass").map(([key]) => key);
  if (manifest.status === "passed" && pending.length) return `Produce and validate pending independent proof(s): ${pending.join(", ")}.`;
  if (manifest.status === "complete") return "Brand learning capability test is complete; the learned MOD may now enter apply-host as a separate workflow.";
  return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}; three-proof status remains independently visible.` : "Inspect the blocked stage and preserve the frozen learning goal.";
}
function stage(name, role, attempt) { return { id: `${name}-${attempt}`, stage: name, role, attempt, maxAttempts: name === "demo" || name === "visualQA" ? 2 : 1, status: "pending" }; }
function hashedPath(relativePath) { const file = path.resolve(root, relativePath); if (!fs.existsSync(file)) fail(`Required input missing: ${relativePath}`); return { path: relativePath, sha256: sha256File(file) }; }
function verifyHashedPath(item) { if (!item?.path || !item?.sha256) fail("Receipt input/output must contain path and sha256."); const current = hashedPath(item.path); if (current.sha256 !== item.sha256) fail(`Receipt hash mismatch: ${item.path}`); }
function verifyEvidenceVisibilityGate() {
  const guard = path.join(root, "skills", "brand", "scripts", "brand-guard.mjs");
  try {
    execFileSync(process.execPath, [guard, "evidence-visibility-gate", "--root", root, "--brand", brand, "--strict"], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const output = String(error?.stdout || error?.stderr || "").trim();
    fail(`Evidence receipt cannot pass before screenshot-first visibility gate passes.${output ? `\n${output}` : ""}`);
  }
}
function verifyDesignDirectionGate() {
  const validator = path.join(root, "skills", "brand", "scripts", "validate-design-direction.mjs");
  try {
    execFileSync(process.execPath, [validator, "--brand", brand], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const output = String(error?.stdout || error?.stderr || "").trim();
    fail(`Demo cannot be dispatched before the top-level Design Director direction gate passes.${output ? `\n${output}` : ""}`);
  }
}
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function readJsonRequired(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { fail(`Missing or invalid JSON: ${relative(file)}`); } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function relative(file) { return path.relative(root, file); }
function array(value) { return Array.isArray(value) ? value : []; }
function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] || fallback : fallback; }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
function output(value, exitCode = 0) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); process.exit(exitCode); }
