#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const entry = path.resolve("skills/brand/scripts/run-brand-workflow.mjs");
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-public-resume-demo-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const brand = "example";
  const migration = path.join(root, "migrations", brand);
  fs.mkdirSync(migration, { recursive: true });
  const goalFile = path.join(migration, "goal-contract.json");
  fs.writeFileSync(goalFile, JSON.stringify({ schema: "brand-goal/v2", sealed: true, mode: "learn-brand", goalId: "frozen", thresholds: { maxAttempts: 1 } }));
  const put=(name,value)=>{const file=path.join(migration,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==="string"?value:JSON.stringify(value));return {path:`migrations/${brand}/${name}`,sha256:sha256(file)};};
  const goal={path:`migrations/${brand}/goal-contract.json`,sha256:sha256(goalFile)},direction=put("design-direction.json",{approved:true}),demo=put("demo.html","old demo"),assessment=put("visual-qa-assessment.json",{reviewerRecommendation:"fail"});
  const demoReceipt=put("receipts/demo-1.json",{stageId:"demo-1",role:"demoImplementationAgent",goalSha256:goal.sha256,verdict:"pass",inputs:[goal,direction],outputs:[demo]});
  const qaDispatch=put("dispatch/visualQA-1.json",{dispatchId:"qa-dispatch",stageId:"visualQA-1",goalSha256:goal.sha256,requiredInputs:[goal,direction,demo]});
  const qaReceipt=put("receipts/visualQA-1.json",{dispatchId:"qa-dispatch",stageId:"visualQA-1",role:"visualQA",goalSha256:goal.sha256,verdict:"fail",inputs:[goal,direction,demo],outputs:[assessment]});
  fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify({
    schema: "brand-subagent-execution/v1",
    runId: "fixture",
    brand,
    mode: "learn-brand",
    goalId: "frozen",
    goalPath: `migrations/${brand}/goal-contract.json`,
    goalSha256: sha256(goalFile),
    status: "blocked",
    currentStageId: null,
    stages: [
      { id: "demo-1", stage: "demo", role: "demoImplementationAgent", attempt: 1, status: "complete", verdict: "pass", receiptPath:demoReceipt.path,receiptSha256:demoReceipt.sha256,outputHashes:[demo] },
      { id: "visualQA-1", stage: "visualQA", role: "visualQA", attempt: 1, status: "failed", verdict: "fail", dispatchPath:qaDispatch.path,receiptPath:qaReceipt.path,receiptSha256:qaReceipt.sha256,outputHashes:[assessment],blockingFindings: [{ code: "SECTION_FIDELITY_INCOMPLETE" }] },
    ],
  }));
  const call = (...args) => spawnSync(process.execPath, [entry, "resume-demo", ...args], { encoding: "utf8" });
  return { root, brand, migration, call };
}

test("public resume-demo rejects missing scope and relative roots before internal dispatch", (t) => {
  const f = fixture(t);
  let result = f.call("--brand", f.brand, "--continue-existing");
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).blockingCode, "DEMO_RESUME_ISOLATED_ROOT_REQUIRED");
  result = f.call("--artifact-root", "relative/build", "--brand", f.brand, "--continue-existing");
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).blockingCode, "DEMO_RESUME_ISOLATED_ROOT_REQUIRED");
  result = f.call("--artifact-root", f.root, "--continue-existing");
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).blockingCode, "DEMO_RESUME_ISOLATED_ROOT_REQUIRED");
});

test("public resume-demo requires continuation authorization and forwards only the bounded internal command", (t) => {
  const f = fixture(t);
  const unauthorized = f.call("--artifact-root", f.root, "--brand", f.brand);
  assert.equal(unauthorized.status, 1);
  assert.equal(JSON.parse(unauthorized.stdout).blockingCode, "DEMO_RESUME_CONTINUATION_AUTHORIZATION_REQUIRED");

  const resumed = f.call("--artifact-root", f.root, "--brand", f.brand, "--continue-existing", "--repair-input", "/tmp/must-not-forward.json");
  assert.equal(resumed.status, 0, resumed.stderr);
  const output = JSON.parse(resumed.stdout);
  assert.equal(output.resumedFrom, "visualQA-1");
  assert.equal(output.nextStageId, "demo-2");
  const manifest = JSON.parse(fs.readFileSync(path.join(f.migration, "execution-manifest.json"), "utf8"));
  assert.equal(manifest.stages.at(-1).retryInput.continuationAuthorization, "explicit-user-request-to-continue-existing-version");
  assert.equal(manifest.stages.at(-1).retryInput.repairInput, undefined);
  assert.equal(manifest.demoQaRetries.length,1);
  assert.deepEqual(manifest.stages.at(-1).retryInput.priorQaPreservation,manifest.demoQaRetries[0].archive);
  assert.equal(fs.existsSync(path.join(f.root,manifest.demoQaRetries[0].archive.path)),true);
});
