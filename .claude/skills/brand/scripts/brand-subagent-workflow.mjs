#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0];
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand", "");
if (!command || !brand) fail("Usage: brand-subagent-workflow.mjs <prepare|next|record|approve-preview|status|resume-evidence|resume-qa|resume-demo|finalize> --brand <brand>");

const migrationDir = path.join(root, "migrations", brand);
const goalFile = path.join(migrationDir, "goal-contract.json");
const manifestFile = path.join(migrationDir, "execution-manifest.json");
const contractFile = path.join(root, "skills", "brand", "workflow-contract.json");

if (command === "prepare") prepare();
else if (command === "next") next();
else if (command === "record") record();
else if (command === "approve-preview") approvePreview();
else if (command === "status") status();
else if (command === "resume-evidence") resumeEvidence();
else if (command === "resume-qa") resumeQa();
else if (command === "resume-demo") resumeDemo();
else if (command === "finalize") finalize();
else fail(`Unknown command: ${command}`);

function prepare() {
  if (fs.existsSync(manifestFile)) {
    const existing = readJsonRequired(manifestFile);
    fail(`EXECUTION_MANIFEST_ALREADY_EXISTS: execution-manifest.json already exists; prepare must not overwrite run history. Existing run ${existing.runId || "unknown"} is ${existing.status || "unknown"}. Resume or inspect it, or create a new versioned brand workspace.`);
  }
  const goal = readJsonRequired(goalFile);
  if (goal.sealed !== true) fail("goal-contract.json must be sealed before prepare.");
  const contract = readJsonRequired(contractFile);
  const mode = goal.mode || "learn-brand";
  const executionProfile = goal.executionProfile || (["design-host", "apply-host"].includes(mode) ? "fast" : "full");
  const initialStage = initialStageForMode(mode);
  const manifest = {
    schema: "brand-subagent-execution/v1",
    runId: crypto.randomUUID(),
    brand,
    mode,
    executionProfile,
    goalId: goal.goalId,
    goalPath: relative(goalFile),
    goalSha256: sha256File(goalFile),
    roleContractVersion: contract.roleContractVersion || null,
    status: "running",
    createdAt: new Date().toISOString(),
    deadlineAt: mode === "design-host" && executionProfile === "fast" ? new Date(Date.now() + 300000).toISOString() : null,
    currentStageId: initialStage.id,
    stages: [initialStage],
    finalGates: {},
    telemetry: { dispatchCount: 0, inputFiles: 0, inputBytes: 0, outputFiles: 0, outputBytes: 0, additionalReadBytes: 0 },
  };
  writeJson(manifestFile, manifest);
  output({ ok: true, manifest: relative(manifestFile), runId: manifest.runId, next: `Run next to obtain the ${initialStage.stage} dispatch request.` });
}

function next() {
  const manifest = validateManifest();
  enforceDesignHostDeadline(manifest);
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
    executionProfile: manifest.executionProfile,
    profileContract: ["design-host", "apply-host"].includes(manifest.mode)
      ? contract.applyHostExecutionProfiles?.[manifest.executionProfile] || null
      : contract.executionProfiles?.[manifest.executionProfile] || null,
    requiredInputs: inputs,
    allowedInputs: roleContract.inputs?.allowed || [],
    forbiddenInputs: roleContract.inputs?.forbidden || [],
    tasks: roleContract.tasks || [],
    requirements: roleContract.requirements || [],
    scopeRules: dispatchScopeRules(manifest),
    mustNot: roleContract.mustNot || [],
    expectedOutputs: roleContract.outputs || [],
    passCriteria: roleContract.passCriteria || [],
    failCriteria: roleContract.failCriteria || [],
    contextPolicy: {
      strategy: "minimum-role-packet",
      readOnlyListedInputs: true,
      forbiddenBulkReads: [
        "skills/brand/workflow-contract.json",
        "skills/brand/references/legacy-full-guidance.md",
        "skills/brand/references/dangoui-token-contract.json",
        "skills/brand/references/dangoui.tokens.dtcg.json",
        "skills/brand/references/dangoui.design-system.json",
      ],
      exception: "Read a targeted reference or query a specific JSON key only when the dispatch packet cannot answer a required decision; record that extra read in the receipt.",
      queryCommand: "node skills/brand/scripts/query-brand-context.mjs <get|search> --source <contract|tokens|runtime|workflow> ...",
    },
    receiptRequirements: ["agentExecutionId from a real spawned subagent", "goalSha256 unchanged", "input and output file sha256 values", "pass/fail/needs-evidence verdict", "on fail, failureOwnerRole identifies brandResearcher, designTranslator, designDirectorOrchestrator, or demoImplementationAgent"],
  };
  const dispatchFile = path.join(migrationDir, "dispatch", `${current.id}.json`);
  writeJson(dispatchFile, request);
  current.dispatchId = request.dispatchId;
  current.dispatchPath = relative(dispatchFile);
  current.status = "dispatched";
  current.startedAt = new Date().toISOString();
  addTelemetry(manifest, "dispatch", inputs);
  writeJson(manifestFile, manifest);
  output({ ok: true, dispatchRequest: request, dispatchFile: relative(dispatchFile), instruction: "The outer Orchestrator must now spawn a real subagent with exactly this packet." });
}

function record() {
  const receiptArg = opt("--receipt", "");
  if (!receiptArg) fail("record requires --receipt <file>.");
  const receiptFile = path.resolve(root, receiptArg);
  const receipt = readJsonRequired(receiptFile);
  const manifest = validateManifest();
  enforceDesignHostDeadline(manifest);
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
    if (receipt.verdict !== "pass") validateDeltaScope(receipt.deltaScope);
  }
  current.status = receipt.verdict === "pass" ? "complete" : "failed";
  current.verdict = receipt.verdict;
  current.agentExecutionId = receipt.agentExecutionId;
  current.receiptPath = relative(receiptFile);
  current.receiptSha256 = sha256File(receiptFile);
  current.outputHashes = array(receipt.outputs);
  current.blockingFindings = array(receipt.blockingFindings);
  current.failureOwnerRole = receipt.failureOwnerRole || null;
  current.deltaScope = receipt.deltaScope || null;
  current.additionalReads = array(receipt.additionalReads);
  current.endedAt = new Date().toISOString();
  current.durationMs = Math.max(0, Date.parse(current.endedAt) - Date.parse(current.startedAt));
  advance(manifest, current);
  manifest.updatedAt = current.endedAt;
  manifest.elapsedMs = manifest.stages.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
  addTelemetry(manifest, "receipt", receiptOutputs, current.additionalReads);
  writeTelemetry(manifest);
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, completedStage: current.id, durationMs: current.durationMs, elapsedMs: manifest.elapsedMs, nextStageId: manifest.currentStageId || null, blockingFindings: current.blockingFindings });
}

function approvePreview() {
  const manifest = validateManifest();
  if (manifest.mode !== "apply-host" || manifest.status !== "awaiting-user" || manifest.previewDecision?.status !== "pending") {
    fail("PREVIEW_NOT_AWAITING_USER: approve-preview requires a passing apply-host preview awaiting user review.");
  }
  const decision = opt("--decision", "");
  if (!['approve', 'revise', 'certify'].includes(decision)) fail("approve-preview requires --decision <approve|revise|certify>.");
  manifest.previewDecision = { status: decision, decidedAt: new Date().toISOString(), source: "explicit-user" };
  if (decision === "revise") {
    const attempts = manifest.stages.filter((item) => item.stage === "hostImplementation").length + 1;
    const retry = uniqueStage(manifest, "hostImplementation", "hostImplementationAgent", attempts);
    manifest.stages.push(retry);
    manifest.currentStageId = retry.id;
    manifest.status = "running";
  } else if (decision === "approve" && manifest.executionProfile === "fast" && frozenPreviewArtifactsUnchanged(manifest)) {
    const previewQa = [...manifest.stages].reverse().find((item) => item.stage === "previewQA" && item.verdict === "pass");
    manifest.currentStageId = null;
    manifest.status = "passed";
    manifest.deliveryLevel = "fast-preview-approved";
    manifest.qaReuse = {
      status: "reused",
      sourceStageId: previewQa?.id || null,
      reason: "Explicit approval with unchanged frozen inputs, implementation outputs and Smoke QA outputs.",
      reusedAt: new Date().toISOString(),
    };
  } else {
    const qa = uniqueStage(manifest, "visualQA", "visualQA", 1);
    manifest.stages.push(qa);
    manifest.currentStageId = qa.id;
    manifest.status = "running";
    manifest.deliveryLevel = decision === "certify" ? "release-certification-requested" : "scoped-delivery";
  }
  manifest.updatedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, decision, nextStageId: manifest.currentStageId, qaReuse: manifest.qaReuse || null });
}

function frozenPreviewArtifactsUnchanged(manifest) {
  const stages = manifest.stages.filter((item) => ["hostImplementation", "previewQA"].includes(item.stage) && item.status === "complete");
  if (!stages.some((item) => item.stage === "hostImplementation") || !stages.some((item) => item.stage === "previewQA")) return false;
  const artifacts = [];
  for (const stageItem of stages) {
    artifacts.push(...array(stageItem.outputHashes));
    if (stageItem.dispatchPath) {
      const dispatchFile = path.join(root, stageItem.dispatchPath);
      if (!fs.existsSync(dispatchFile)) return false;
      artifacts.push(...array(readJsonRequired(dispatchFile).requiredInputs));
    }
  }
  return latestInputsByPath(artifacts).every((item) => {
    if (!item?.path || !item?.sha256) return false;
    const file = path.resolve(root, item.path);
    return fs.existsSync(file) && sha256File(file) === item.sha256;
  });
}

function status() {
  const before = fs.existsSync(manifestFile) ? sha256File(manifestFile) : null;
  const manifest = validateManifest();
  const after = sha256File(manifestFile);
  const proofStatus = readProofStatus();
  output({ ok: true, readOnly: before === after, proofStatus, nextAction: nextAction(manifest, proofStatus), manifest });
}

function resumeEvidence() {
  const manifest = validateManifest();
  if (manifest.mode === "apply-host") fail("resume-evidence is only valid for learn-brand workflows.");
  const latestEvidence = [...manifest.stages].reverse().find((item) => item.role === "brandResearcher");
  if (manifest.status !== "blocked" || latestEvidence?.verdict !== "needs-evidence") {
    fail("resume-evidence requires a blocked workflow whose latest Evidence verdict is needs-evidence.");
  }
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  if (latestEvidence.attempt >= maxAttempts) fail("Evidence retry budget is exhausted.");
  const retry = uniqueStage(manifest, "evidence", "brandResearcher", latestEvidence.attempt + 1);
  retry.retryInput = {
    goalSha256: manifest.goalSha256,
    blockingFindings: array(latestEvidence.blockingFindings),
  };
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, resumedFrom: latestEvidence.id, nextStageId: retry.id, blockingFindings: retry.retryInput.blockingFindings });
}

function resumeQa() {
  const manifest = validateManifest();
  const latestQa = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  if (manifest.status !== "blocked" || latestQa?.verdict !== "needs-evidence") {
    fail("resume-qa requires a blocked workflow whose latest Visual QA verdict is needs-evidence.");
  }
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  const completedQaAttempts = manifest.stages.filter((item) => item.role === "visualQA" && ["complete", "failed"].includes(item.status)).length;
  if (completedQaAttempts >= maxAttempts) fail("Visual QA retry budget is exhausted.");
  const assessmentFile = path.join(migrationDir, "visual-qa-assessment.json");
  const assessment = fs.existsSync(assessmentFile) ? readJsonRequired(assessmentFile) : {};
  const retry = uniqueStage(manifest, "visualQA", "visualQA", completedQaAttempts + 1);
  retry.retryInput = {
    goalSha256: manifest.goalSha256,
    blockingFindings: array(latestQa.blockingFindings).length
      ? array(latestQa.blockingFindings)
      : array(assessment.blockingFindings),
    deltaScope: latestQa.deltaScope || assessment.deltaScope || null,
  };
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, resumedFrom: latestQa.id, nextStageId: retry.id, blockingFindings: retry.retryInput.blockingFindings });
}

function resumeDemo() {
  const manifest = validateManifest();
  if (manifest.mode === "apply-host") fail("resume-demo is only valid for learn-brand workflows.");
  const latestQa = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  const latestDemo = [...manifest.stages].reverse().find((item) => item.role === "demoImplementationAgent");
  if (manifest.status !== "blocked" || !["fail", "needs-evidence"].includes(latestQa?.verdict)) {
    fail("resume-demo requires a blocked workflow whose latest Visual QA verdict is fail or needs-evidence.");
  }
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  const nextAttempt = manifest.stages.filter((item) => item.role === "demoImplementationAgent" && ["complete", "failed"].includes(item.status)).length + 1;
  const authorizedContinuation = args.includes("--continue-existing");
  if (nextAttempt > maxAttempts && !authorizedContinuation) fail("Demo retry budget is exhausted. An explicit user instruction to continue the same version is required; then rerun with --continue-existing.");
  const assessmentFile = path.join(migrationDir, "visual-qa-assessment.json");
  const assessment = fs.existsSync(assessmentFile) ? readJsonRequired(assessmentFile) : {};
  const retry = uniqueStage(manifest, "demo", "demoImplementationAgent", nextAttempt);
  retry.retryInput = {
    goalSha256: manifest.goalSha256,
    blockingFindings: array(latestQa.blockingFindings).length
      ? array(latestQa.blockingFindings)
      : array(assessment.blockingFindings),
    deltaScope: latestQa.deltaScope || assessment.deltaScope || null,
    continuationAuthorization: authorizedContinuation ? "explicit-user-request-to-continue-existing-version" : null,
  };
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, resumedFrom: latestQa.id, nextStageId: retry.id, blockingFindings: retry.retryInput.blockingFindings });
}

function finalize() {
  const manifest = validateManifest();
  if (manifest.mode === "design-host") {
    if (manifest.status !== "awaiting-user-direction") return output({ ok: false, status: "blocked", workflowStatus: manifest.status, message: "Design-host must finish Host Strategy and Brand Application before direction approval." }, 2);
    verifyFrozenDesignGate();
    manifest.status = "complete";
    manifest.currentStageId = null;
    manifest.completedAt = new Date().toISOString();
    manifest.finalGates = { protocol: "pass", frozenDirection: "pass", finalizedAt: manifest.completedAt };
    writeJson(manifestFile, manifest);
    return output({ ok: true, status: "complete", finalGates: manifest.finalGates });
  }
  if (manifest.mode === "apply-host") {
    const qaStage = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
    if (manifest.status !== "passed" || qaStage?.verdict !== "pass") {
      return output({ ok: false, status: "blocked", workflowStatus: manifest.status, message: "Apply-host requires a passing independent Visual QA receipt before finalization." }, 2);
    }
    manifest.status = "complete";
    manifest.currentStageId = null;
    manifest.completedAt = new Date().toISOString();
    manifest.elapsedMs = manifest.stages.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
    manifest.finalGates = { protocol: "pass", hostVisualQA: "pass", finalizedAt: manifest.completedAt };
    writeJson(manifestFile, manifest);
    return output({ ok: true, status: "complete", finalGates: manifest.finalGates });
  }
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
  const order = stageOrderForMode(manifest.mode);
  if (current.verdict === "pass") {
    if (manifest.mode === "design-host" && current.stage === "designVisualQA") {
      manifest.status = "awaiting-user-direction";
      manifest.currentStageId = null;
      manifest.directionDecision = { status: "pending", requiredOutputs: ["design-direction-decision.json", "design-direction.json"] };
      return;
    }
    if (manifest.mode === "apply-host" && current.stage === "previewQA") {
      manifest.status = "awaiting-user";
      manifest.currentStageId = null;
      manifest.firstPreviewAt = current.endedAt;
      manifest.timeToFirstPreviewMs = manifest.stages.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
      manifest.previewSla = { targetMs: 300000, status: manifest.timeToFirstPreviewMs <= 300000 ? "pass" : "miss" };
      manifest.previewDecision = { status: "pending" };
      return;
    }
    const index = order.indexOf(current.stage);
    if (index === order.length - 1) {
      manifest.status = "passed";
      manifest.currentStageId = null;
      return;
    }
    const nextStageName = order[index + 1];
    const nextRole = roleForStage(nextStageName);
    // Attempts are local to each role. An upstream retry must not consume the
    // next role's budget, while a return to a previously completed role must
    // advance that role's own attempt number.
    const nextRoleAttempts = manifest.stages.filter((item) => item.role === nextRole && ["complete", "failed"].includes(item.status)).length;
    const nextStage = uniqueStage(manifest, nextStageName, nextRole, nextRoleAttempts + 1);
    manifest.stages.push(nextStage);
    manifest.currentStageId = nextStage.id;
    return;
  }
  if (current.stage === "visualQA") {
    const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
    const completedQaAttempts = manifest.stages.filter((item) => item.role === "visualQA" && ["complete", "failed"].includes(item.status)).length;
    if (completedQaAttempts >= maxAttempts) {
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
    const routed = failureRouteForMode(manifest.mode, current.failureOwnerRole);
    const routedAttempts = manifest.stages.filter((item) => item.role === routed[1] && ["complete", "failed"].includes(item.status)).length;
    const retry = uniqueStage(manifest, routed[0], routed[1], routedAttempts + 1);
    retry.retryInput = { goalSha256: manifest.goalSha256, blockingFindings: current.blockingFindings, deltaScope: current.deltaScope };
    manifest.stages.push(retry);
    manifest.currentStageId = retry.id;
    return;
  }
  manifest.status = "blocked";
  manifest.currentStageId = null;
}

function dispatchInputs(manifest, current) {
  const goalInput = hashedPath(relative(goalFile));
  const scopedPaths = array(current.retryInput?.deltaScope?.inputPaths);
  if (scopedPaths.length) return latestInputsByPath([goalInput, ...scopedPaths.map(hashedPath)]);
  if (current.role === "hostImplementationAgent") {
    return latestInputsByPath([
      goalInput,
      hashedPath(`migrations/${brand}/brand-application-plan.json`),
      hashedPath(`migrations/${brand}/design-direction-decision.json`),
      hashedPath(`migrations/${brand}/design-direction.json`),
      hashedPath(`migrations/${brand}/preedit-baseline-bundle.json`),
    ]);
  }
  if (current.stage === "evidence") return [goalInput];
  if (current.stage === "demo") {
    // A retry may follow an Orchestrator-owned protocol normalization. Freeze
    // the bytes that actually exist at dispatch time, not stale producer hashes
    // retained only as history in an earlier receipt.
    const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes)).map((item) => hashedPath(item.path));
    return latestInputsByPath([goalInput, ...previousOutputs, hashedPath(`migrations/${brand}/design-direction.json`)]);
  }
  if (current.stage === "visualQA") {
    if (manifest.mode === "apply-host") {
      const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
      return latestInputsByPath([goalInput, ...previousOutputs]);
    }
    const goal = readJsonRequired(goalFile);
    const sourceScreenshots = array(goal.referencePages).map((item) => item?.screenshot).filter(Boolean).map(hashedPath);
    const demoScreenshots = array(goal.demoPages).map((item) => item?.screenshot).filter(Boolean).map(hashedPath);
    // The Orchestrator seals the blind-input boundary before dispatch. QA consumes
    // this manifest as a frozen input and must never author or refresh it itself.
    return [goalInput, ...sourceScreenshots, ...demoScreenshots, hashedPath(`migrations/${brand}/visual-pattern-inventory.json`), hashedPath(`migrations/${brand}/generative-proof.json`), hashedPath(`migrations/${brand}/qa-input-manifest.json`)];
  }
  const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
  return latestInputsByPath([goalInput, ...previousOutputs]);
}

function validateDeltaScope(scope) {
  if (!scope || !array(scope.affectedSections).length || !array(scope.inputPaths).length || !array(scope.regressionSections).length) {
    fail("Failed Visual QA receipts require deltaScope with affectedSections, inputPaths and regressionSections.");
  }
  for (const item of scope.inputPaths) hashedPath(item);
}

function addTelemetry(manifest, kind, files, additionalReads = []) {
  manifest.telemetry ||= { dispatchCount: 0, inputFiles: 0, inputBytes: 0, outputFiles: 0, outputBytes: 0, additionalReadBytes: 0 };
  const bytes = (items) => array(items).reduce((sum, item) => {
    const file = path.resolve(root, typeof item === "string" ? item : item.path || "");
    return sum + (fs.existsSync(file) && fs.statSync(file).isFile() ? fs.statSync(file).size : Number(item?.bytes || 0));
  }, 0);
  if (kind === "dispatch") {
    manifest.telemetry.dispatchCount += 1;
    manifest.telemetry.inputFiles += array(files).length;
    manifest.telemetry.inputBytes += bytes(files);
  } else {
    manifest.telemetry.outputFiles += array(files).length;
    manifest.telemetry.outputBytes += bytes(files);
    manifest.telemetry.additionalReadBytes += bytes(additionalReads);
  }
}

function writeTelemetry(manifest) {
  writeJson(path.join(migrationDir, "workflow-telemetry.json"), { schema: "brand-workflow-telemetry/v1", runId: manifest.runId, updatedAt: new Date().toISOString(), ...manifest.telemetry });
}

function verifyHostPreeditGate(phase) {
  verifyFrozenDesignGate();
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

function verifyFrozenDesignGate() {
  const required = ["brand-application-plan.json", "design-direction-options.json", "design-direction-decision.json", "business-scope.json", "design-direction.json"];
  for (const name of required) {
    const file = path.join(migrationDir, name);
    if (!fs.existsSync(file)) fail(`FROZEN_DESIGN_REQUIRED: missing ${relative(file)}; return to design-host instead of designing inside apply-host.`);
  }
  try {
    execFileSync(process.execPath, [path.join(root, "skills", "brand", "scripts", "validate-brand-application-plan.mjs"), "--plan", path.join(migrationDir, "brand-application-plan.json")], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [path.join(root, "skills", "brand", "scripts", "validate-wild-design-decision.mjs"), "--options", path.join(migrationDir, "design-direction-options.json"), "--decision", path.join(migrationDir, "design-direction-decision.json"), "--business-scope", path.join(migrationDir, "business-scope.json"), "--brand-evidence", path.join(migrationDir, "brand-evidence.json"), "--brand-mod", path.join(migrationDir, "brand-mod.json"), "--design-direction", path.join(migrationDir, "design-direction.json")], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`FROZEN_DESIGN_INVALID: apply-host cannot redesign or repair direction artifacts.${details ? `\n${details}` : ""}`);
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
  const learningProof = fidelity?.learningProof || {};
  const proofs = fidelity?.proofs || fidelity?.proofStatus || learningProof;
  const value = (key) => typeof proofs[key] === "string" ? proofs[key] : proofs[key]?.status || "pending";
  return { evidenceFidelity: value("evidenceFidelity"), structuralFidelity: value("structuralFidelity"), generativeProof: value("generativeProof") };
}
function allProofsPass(proofs) { return Object.values(proofs).every((value) => value === "pass"); }
function nextAction(manifest, proofs) {
  if (manifest.mode === "design-host") {
    if (manifest.status === "awaiting-user-direction") return "Show the static directions and wait for an explicit user selection; freeze design-direction-decision.json and design-direction.json, then finalize design-host.";
    if (manifest.status === "complete") return "Design-host is complete; start a separate apply-host run using the frozen direction artifacts.";
    return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}.` : "Inspect the blocked design-host stage.";
  }
  if (manifest.mode === "apply-host") {
    if (manifest.status === "awaiting-user") return "Show the runnable first preview, then record approve, revise or certify with approve-preview; do not start full QA yet.";
    if (manifest.status === "passed") return "Run finalize to close the apply-host manifest after its passing independent Visual QA receipt.";
    if (manifest.status === "complete") return "Host application is complete and has a passing independent Visual QA receipt.";
    return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}.` : "Inspect the blocked host stage and preserve the frozen apply-host goal.";
  }
  const failed = Object.entries(proofs).filter(([, value]) => value === "fail").map(([key]) => key);
  if (failed.length) return `Rework failed independent proof(s): ${failed.join(", ")}; then recapture and dispatch a fresh Visual QA.`;
  const pending = Object.entries(proofs).filter(([, value]) => value !== "pass").map(([key]) => key);
  if (manifest.status === "passed" && pending.length) return `Produce and validate pending independent proof(s): ${pending.join(", ")}.`;
  if (manifest.status === "complete") return "Brand learning capability test is complete; the learned MOD may now enter apply-host as a separate workflow.";
  return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}; three-proof status remains independently visible.` : "Inspect the blocked stage and preserve the frozen learning goal.";
}
function stage(name, role, attempt) { return { id: `${name}-${attempt}`, stage: name, role, attempt, maxAttempts: ["evidence", "demo", "visualQA"].includes(name) ? 2 : 1, status: "pending" }; }
function initialStageForMode(mode) {
  if (mode === "learn-brand") return stage("evidence", "brandResearcher", 1);
  if (mode === "design-host") return stage("hostStrategy", "hostStrategist", 1);
  if (mode === "apply-host") return stage("hostImplementation", "hostImplementationAgent", 1);
  fail(`Unsupported goal mode: ${mode}`);
}
function stageOrderForMode(mode) {
  if (mode === "design-host") return ["hostStrategy", "brandApplication", "designVisualQA"];
  if (mode === "apply-host") return ["hostImplementation", "previewQA", "visualQA"];
  return ["evidence", "interpreter", "demo", "visualQA"];
}
function roleForStage(name) {
  return {
    evidence: "brandResearcher",
    interpreter: "designTranslator",
    demo: "demoImplementationAgent",
    hostStrategy: "hostStrategist",
    brandApplication: "brandApplicationDesigner",
    designVisualQA: "visualQA",
    hostImplementation: "hostImplementationAgent",
    previewQA: "visualQA",
    visualQA: "visualQA",
  }[name];
}
function enforceDesignHostDeadline(manifest) {
  if (manifest.mode !== "design-host" || manifest.executionProfile !== "fast" || !manifest.deadlineAt || Date.now() <= Date.parse(manifest.deadlineAt)) return;
  manifest.status = "timed-out";
  manifest.currentStageId = null;
  manifest.timeout = { code: "DESIGN_HOST_FAST_BUDGET_EXCEEDED", budgetMs: 300000, deadlineAt: manifest.deadlineAt, observedAt: new Date().toISOString() };
  writeJson(manifestFile, manifest);
  fail("DESIGN_HOST_FAST_BUDGET_EXCEEDED: stop instead of silently exceeding the five-minute preview budget.");
}
function dispatchScopeRules(manifest) {
  if (manifest.mode === "design-host" && manifest.currentStageId?.startsWith("designVisualQA-")) return [
    "Render every shortlisted static H5 at the frozen target viewport; do not accept JSON fields or producer self-review as visual proof.",
    "Reject generic enterprise styling, repeated lead assets, weak brand visual mass, and candidates that differ only by list/grid arrangement.",
    "Remain independent: do not edit the H5, host source, Brand MOD or direction plan; return blocking findings to Brand Application Designer.",
  ];
  if (manifest.mode === "design-host") return [
    "Do not modify, compile or inject host source while generating directions.",
    "Use the frozen host baseline and existing Brand MOD; do not relearn the brand.",
    "Produce static target-viewport directions and stop for explicit user selection.",
  ];
  if (manifest.mode !== "apply-host") return [];
  if (manifest.executionProfile === "certification") {
    return ["Run the complete declared host coverage matrix and all release-blocking platform/runtime gates."];
  }
  if (manifest.executionProfile === "standard") {
    return ["Cover changed routes, affected component states and required parent launch paths; do not expand into unrequested platform certification."];
  }
  return [
    "Reuse the frozen Registry Evidence, Intent and Mapping; do not dispatch or simulate Brand Researcher or Design Translator.",
    "Default to the host home route unless the user explicitly names another page; limit the first preview to that route's first viewport.",
    "Consume the one frozen design direction; do not generate, compare or reinterpret style options inside apply-host.",
    "Stop after first-viewport implementation and Smoke QA with status awaiting-user; do not start scoped full QA until approve-preview records an explicit decision.",
    "Do not run or block on a full-host coverage matrix, capability-gap certification or unrequested platform proof; report PARTIAL_STYLE_ONLY when runtime proof is absent.",
  ];
}
function failureRouteForMode(mode, failureOwnerRole) {
  if (mode === "apply-host") {
    return ["hostImplementation", "hostImplementationAgent"];
  }
  if (mode === "design-host") {
    return failureOwnerRole === "hostStrategist" ? ["hostStrategy", "hostStrategist"] : ["brandApplication", "brandApplicationDesigner"];
  }
  return {
    brandResearcher: ["evidence", "brandResearcher"],
    designTranslator: ["interpreter", "designTranslator"],
    demoImplementationAgent: ["demo", "demoImplementationAgent"],
    implementationAgent: ["demo", "demoImplementationAgent"],
  }[failureOwnerRole] || ["demo", "demoImplementationAgent"];
}
function uniqueStage(manifest, name, role, attempt) {
  const item = stage(name, role, attempt);
  const used = new Set(array(manifest?.stages).map((entry) => entry.id));
  if (!used.has(item.id)) return item;
  let suffix = 2;
  while (used.has(`${item.id}-retry-${suffix}`)) suffix += 1;
  item.id = `${item.id}-retry-${suffix}`;
  return item;
}
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
