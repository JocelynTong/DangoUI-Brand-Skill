#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const routeValidator = path.resolve("skills/brand/scripts/validate-design-host-route.mjs");

function createFixture(mode, brand, executionProfile = undefined) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `brand-${mode}-test-`));
  const migration = path.join(root, "migrations", brand);
  const skillDir = path.join(root, "skills", "brand");
  const scriptsDir = path.join(skillDir, "scripts");
  fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ sealed: true, mode, executionProfile, goalId: `${brand}-${mode}-goal`, thresholds: { maxAttempts: 2 } }));
  if (mode === "apply-host") fs.writeFileSync(path.join(migration, "design-host-route.json"), JSON.stringify({ schema: "design-host-route/v2", sequence: "image-demo-first", imageCapability: { status: "available", tool: "image_gen", mode: "built-in-default" }, demoImages: { status: "ready", producer: { executionId: "/root/image-producer", imageToolCalls: ["imagegen-1"] }, artifacts: [{ path: "a.png" }, { path: "b.png" }, { path: "c.png" }] }, demoVisualReview: { status: "pass", qualityVerdict: "pass", criteria: { composition: "pass", brandFidelity: "pass", visualFinish: "pass", hostTaskClarity: "pass" }, reviewerExecutionId: "/root/image-qa" }, userDirectionReview: { status: "approved", selectionSource: "explicit-user", selectedOptionIds: ["a"] }, h5Reconstruction: { status: "ready", producerExecutionId: "/root/h5", artifacts: [{ path: "direction.html" }] }, h5QA: { status: "pass", reviewerExecutionId: "/root/h5-qa" }, finalSelection: { status: "selected", selectionSource: "explicit-user", selectedOptionId: "a" } }));
  fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({
    roleContractVersion: "test",
    roles: {
      hostStrategist: { goal: "diagnose host", outputs: ["host-opportunity-map.json"] },
      brandApplicationDesigner: { goal: "compose static directions", outputs: ["design-direction-options.json"] },
      hostImplementationAgent: { goal: "implement frozen direction", outputs: ["host-rendered-proof.json"] },
      visualQA: { goal: "review host", outputs: ["visual-qa-report.json"] },
    },
  }));
  fs.writeFileSync(path.join(scriptsDir, "validate-brand-application-plan.mjs"), "process.exit(0);\n");
  fs.writeFileSync(path.join(scriptsDir, "validate-wild-design-decision.mjs"), "process.exit(0);\n");
  fs.writeFileSync(path.join(scriptsDir, "validate-host-structural-diff.mjs"), "process.exit(0);\n");
  fs.copyFileSync(routeValidator, path.join(scriptsDir, "validate-design-host-route.mjs"));
  if (mode === "design-host") fs.writeFileSync(path.join(migration, "execution-capabilities.json"), JSON.stringify({ schema: "brand-execution-capabilities/v1", imageGeneration: { status: "available", tool: "image_gen", mode: "built-in-default" } }));

  const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const run = (...command) => {
    const result = spawnSync(process.execPath, [script, ...command, "--brand", brand, "--root", root], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillDir } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const readManifest = () => JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"));
  const writeOutput = (name, content = "{}") => {
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
      toolCalls: current.stage === "conceptGeneration" ? [{ id: "imagegen-1", tool: "imagegen" }] : [],
      inputs: dispatch.requiredInputs,
      outputs: Array.isArray(output) ? output : [output],
      blockingFindings: [],
    };
    const receiptPath = path.join(migration, "receipts", `${current.id}.json`);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    return run("record", "--receipt", `migrations/${brand}/receipts/${current.id}.json`);
  };
  const mutateOutput = (name, content) => fs.writeFileSync(path.join(migration, name), content);
  return { run, readManifest, writeOutput, recordCurrent, mutateOutput, migration };
}

// Direction generation stops before runtime mutation or implementation dispatch.
{
  const fixture = createFixture("design-host", "two-direction-goal");
  fixture.mutateOutput("goal-contract.json", JSON.stringify({ sealed: true, mode: "design-host", executionProfile: "fast", goalId: "invalid-two", thresholds: { minimumSelectableDirections: 2, maximumSelectableDirections: 2 } }));
  assert.throws(() => fixture.run("prepare"), /DESIGN_HOST_THREE_DIRECTIONS_REQUIRED/);
}
// Design-host is image-first and cannot dispatch H5 before independent
// visual review plus an explicit user concept selection.
{
  const fixture = createFixture("design-host", "generated-route");
  fixture.run("prepare");
  assert.equal(fixture.readManifest().currentStageId, "conceptGeneration-1");
  const conceptDispatch = fixture.run("next");
  assert.equal(conceptDispatch.dispatchRequest.fastDesignHints.medium, "demo-images");
  assert.equal(conceptDispatch.dispatchRequest.fastDesignHints.imageTool, "image_gen");
  assert.equal(conceptDispatch.dispatchRequest.fastDesignHints.candidateCount, 3);
  const conceptRoute = JSON.parse(fs.readFileSync(path.join(fixture.migration, "design-host-route.json"), "utf8"));
  const images = ["a.png", "b.png", "c.png"].map((name) => fixture.writeOutput(name, name));
  conceptRoute.imageCapability = { status: "available" };
  conceptRoute.demoImages = { status: "ready", producer: { executionId: "/root/concept-producer", imageToolCalls: ["imagegen-1"] }, artifacts: images };
  fs.writeFileSync(path.join(fixture.migration, "design-host-route.json"), JSON.stringify(conceptRoute));
  fixture.recordCurrent("/root/concept-producer", [...images, fixture.writeOutput("design-host-route.json", JSON.stringify(conceptRoute))]);
  assert.equal(fixture.readManifest().currentStageId, "conceptVisualQA-1");
  fixture.run("next");
  const reviewedRoute = JSON.parse(fs.readFileSync(path.join(fixture.migration, "design-host-route.json"), "utf8"));
  reviewedRoute.demoVisualReview = { status: "pass", qualityVerdict: "pass", criteria: { composition: "pass", brandFidelity: "pass", visualFinish: "pass", hostTaskClarity: "pass" }, reviewerExecutionId: "/root/concept-reviewer" };
  fs.writeFileSync(path.join(fixture.migration, "design-host-route.json"), JSON.stringify(reviewedRoute));
  fixture.recordCurrent("/root/concept-reviewer", [fixture.writeOutput("design-host-concept-qa.json"), fixture.writeOutput("design-host-route.json", JSON.stringify(reviewedRoute))]);
  assert.equal(fixture.readManifest().status, "awaiting-concept-direction");
  assert.throws(() => fixture.run("next"), /not dispatchable/);
  fixture.run("approve-concepts", "--selection", "a");
  assert.equal(fixture.readManifest().currentStageId, "h5Reconstruction-1");
}

// Runtime application consumes a frozen design contract and cannot silently
// fall back to Host Strategy or Brand Application.
{
  const fixture = createFixture("apply-host", "apply-fixture");
  for (const name of [
    "brand-application-plan.json",
    "design-direction-options.json",
    "design-direction-decision.json",
    "business-scope.json",
    "design-direction.json",
    "brand-evidence.json",
    "brand-mod.json",
    "preedit-baseline-bundle.json",
    "structural-targets.json",
  ]) fixture.writeOutput(name);

  const prepared = fixture.run("prepare");
  assert.match(prepared.next, /hostImplementation/);
  let manifest = fixture.readManifest();
  assert.equal(manifest.mode, "apply-host");
  assert.equal(manifest.executionProfile, "fast");
  assert.equal(manifest.currentStageId, "hostImplementation-1");
  assert.deepEqual(manifest.stages.map(({ stage, role }) => [stage, role]), [["hostImplementation", "hostImplementationAgent"]]);

  const implementationDispatch = fixture.run("next");
  assert.ok(implementationDispatch.dispatchRequest.scopeRules.some((item) => item.includes("frozen design direction")));
  assert.ok(implementationDispatch.dispatchRequest.requiredInputs.some((item) => item.path.endsWith("design-direction-decision.json")));
  assert.equal(implementationDispatch.dispatchRequest.contextPolicy.strategy, "minimum-role-packet");
  assert.ok(implementationDispatch.dispatchRequest.contextPolicy.forbiddenBulkReads.some((item) => item.endsWith("workflow-contract.json")));
  fixture.recordCurrent("/root/host-implementation", fixture.writeOutput("host-rendered-proof.json", "rendered host"));
  manifest = fixture.readManifest();
  assert.equal(manifest.currentStageId, "previewQA-1");

  fixture.run("next");
  fixture.recordCurrent("/root/host-preview-qa", fixture.writeOutput("preview-smoke-report.json", "preview qa"));
  manifest = fixture.readManifest();
  assert.equal(manifest.status, "awaiting-user");
  assert.equal(manifest.previewDecision.status, "pending");
  assert.ok(Number.isFinite(manifest.timeToFirstPreviewMs));

  const approved = fixture.run("approve-preview", "--decision", "approve");
  assert.equal(approved.nextStageId, null);
  assert.equal(approved.status, "passed");
  assert.equal(approved.qaReuse.status, "reused");
  manifest = fixture.readManifest();
  assert.equal(manifest.status, "passed");
  assert.equal(manifest.stages.filter((item) => item.role === "visualQA").length, 1);
  assert.equal(manifest.stages.some((item) => ["hostStrategy", "brandApplication", "evidence", "interpreter", "demo"].includes(item.stage)), false);

  const finalized = fixture.run("finalize");
  assert.equal(finalized.status, "complete");
  assert.equal(fixture.readManifest().status, "complete");
}

// A changed implementation/QA artifact invalidates fast QA reuse and routes to
// a fresh scoped Visual QA instead of trusting a stale receipt.
{
  const fixture = createFixture("apply-host", "changed-preview-fixture");
  for (const name of [
    "brand-application-plan.json",
    "design-direction-options.json",
    "design-direction-decision.json",
    "business-scope.json",
    "design-direction.json",
    "brand-evidence.json",
    "brand-mod.json",
    "preedit-baseline-bundle.json",
    "structural-targets.json",
  ]) fixture.writeOutput(name);

  fixture.run("prepare");
  fixture.run("next");
  fixture.recordCurrent("/root/changed-host-implementation", fixture.writeOutput("host-rendered-proof.json", "rendered host v1"));
  fixture.run("next");
  fixture.recordCurrent("/root/changed-host-preview-qa", fixture.writeOutput("preview-smoke-report.json", "preview qa v1"));
  fixture.mutateOutput("host-rendered-proof.json", "rendered host changed after smoke QA");

  const approved = fixture.run("approve-preview", "--decision", "approve");
  assert.equal(approved.qaReuse, null);
  assert.equal(approved.status, "running");
  assert.equal(approved.nextStageId, "visualQA-1");
  assert.equal(fixture.readManifest().stages.filter((item) => item.role === "visualQA").length, 2);
}

// Standard/certification profiles always retain independent post-approval QA,
// even when every frozen artifact is unchanged.
{
  const fixture = createFixture("apply-host", "standard-preview-fixture", "standard");
  for (const name of [
    "brand-application-plan.json",
    "design-direction-options.json",
    "design-direction-decision.json",
    "business-scope.json",
    "design-direction.json",
    "brand-evidence.json",
    "brand-mod.json",
    "preedit-baseline-bundle.json",
    "structural-targets.json",
  ]) fixture.writeOutput(name);
  fixture.run("prepare");
  fixture.run("next");
  fixture.recordCurrent("/root/standard-host-implementation", fixture.writeOutput("host-rendered-proof.json", "standard rendered host"));
  fixture.run("next");
  fixture.recordCurrent("/root/standard-host-preview-qa", fixture.writeOutput("preview-smoke-report.json", "standard preview qa"));
  const approved = fixture.run("approve-preview", "--decision", "approve");
  assert.equal(approved.qaReuse, null);
  assert.equal(approved.status, "running");
  assert.equal(approved.nextStageId, "visualQA-1");
}

process.stdout.write("brand design-host/apply-host split routing regression passed\n");
