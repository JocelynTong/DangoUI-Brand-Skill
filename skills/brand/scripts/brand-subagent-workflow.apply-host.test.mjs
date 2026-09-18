#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");

function createFixture(mode, brand, executionProfile = undefined) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `brand-${mode}-test-`));
  const migration = path.join(root, "migrations", brand);
  const skillDir = path.join(root, "skills", "brand");
  const scriptsDir = path.join(skillDir, "scripts");
  fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ sealed: true, mode, executionProfile, goalId: `${brand}-${mode}-goal`, thresholds: { maxAttempts: 2 } }));
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

  const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const run = (...command) => {
    const result = spawnSync(process.execPath, [script, ...command, "--brand", brand, "--root", root], { encoding: "utf8" });
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
      inputs: dispatch.requiredInputs,
      outputs: [output],
      blockingFindings: [],
    };
    const receiptPath = path.join(migration, "receipts", `${current.id}.json`);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    return run("record", "--receipt", `migrations/${brand}/receipts/${current.id}.json`);
  };
  const mutateOutput = (name, content) => fs.writeFileSync(path.join(migration, name), content);
  return { run, readManifest, writeOutput, recordCurrent, mutateOutput };
}

// Direction generation stops before runtime mutation or implementation dispatch.
{
  const fixture = createFixture("design-host", "design-fixture");
  const prepared = fixture.run("prepare");
  assert.match(prepared.next, /hostStrategy/);
  let manifest = fixture.readManifest();
  assert.equal(manifest.currentStageId, "hostStrategy-1");
  const strategyDispatch = fixture.run("next");
  assert.deepEqual(strategyDispatch.dispatchRequest.expectedOutputs, ["fast-host-brief.json"]);
  assert.equal(strategyDispatch.dispatchRequest.fastDesignHints.targetSeconds, 45);
  fixture.recordCurrent("/root/host-strategist", fixture.writeOutput("fast-host-brief.json"));
  const designerDispatch = fixture.run("next");
  assert.equal(designerDispatch.dispatchRequest.fastDesignHints.candidateProgramCount, 3);
  assert.equal(designerDispatch.dispatchRequest.fastDesignHints.renderCount, 2);
  assert.equal(designerDispatch.dispatchRequest.fastDesignHints.targetSeconds, 165);
  assert.equal(designerDispatch.dispatchRequest.fastDesignHints.qaReserveSeconds, 60);
  fixture.recordCurrent("/root/brand-application-designer", fixture.writeOutput("design-direction-options.json"));
  manifest = fixture.readManifest();
  assert.equal(manifest.currentStageId, "designVisualQA-1");
  const visualQaDispatch = fixture.run("next");
  assert.equal(visualQaDispatch.dispatchRequest.fastDesignHints.targetSeconds, 60);
  assert.equal(visualQaDispatch.dispatchRequest.fastDesignHints.candidateCount, 2);
  assert.equal(visualQaDispatch.dispatchRequest.fastDesignHints.deterministicRenderer.scriptRelativeToSkillRoot, "scripts/render-static-h5.mjs");
  fixture.recordCurrent("/root/design-visual-qa", fixture.writeOutput("design-host-visual-qa.json"));
  manifest = fixture.readManifest();
  assert.equal(manifest.status, "awaiting-user-direction");
  assert.equal(manifest.currentStageId, null);
  assert.equal(manifest.stages.some((item) => item.stage === "hostImplementation"), false);
  assert.match(fixture.run("status").nextAction, /explicit user selection/);
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
