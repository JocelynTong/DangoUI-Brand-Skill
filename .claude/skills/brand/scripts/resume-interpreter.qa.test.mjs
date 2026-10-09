import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createBrandTestDirectory } from "./brand-test-directory.mjs";

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
function fixture(t, maxAttempts = 1) {
  const temp = createBrandTestDirectory("interpreter-qa");
  t.after(() => temp.cleanup());
  const root = temp.directory;
  const migration = path.join(root, "migrations/fixture");
  fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(migration, name), JSON.stringify(value));
  const bound = (name) => ({ path: `migrations/fixture/${name}`, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(migration, name))).digest("hex") });
  write("goal-contract.json", { sealed: true, mode: "learn-brand", thresholds: { maxAttempts } });
  write("evidence.json", { sourceFacts: ["observed region"] });
  write("patterns.json", { patterns: ["scoped candidate"] });
  write("demo.html", "implementation-private");
  write("assessment.json", { verdict: "fail", implementationRationale: "private-rationale" });
  const goalSha256 = bound("goal-contract.json").sha256;
  const interpreterReceipt = { stageId: "interpreter-1", role: "designTranslator", verdict: "pass", goalSha256, inputs: [bound("goal-contract.json"), bound("evidence.json")], outputs: [bound("patterns.json")] };
  write("receipts/interpreter-1.json", interpreterReceipt);
  const qaReceipt = { stageId: "visualQA-1", role: "visualQA", verdict: "fail", goalSha256, failureOwnerRole: "designTranslator", inputs: [bound("goal-contract.json"), bound("demo.html")], outputs: [bound("assessment.json")], blockingFindings: [
    { code: "SOURCE_ROLE_UNRESOLVED", scope: "content", observation: "Source region needs role review", failureOwnerRole: "designTranslator", verdict: "fail", implementationRationale: "private-rationale" },
    { code: "IMPLEMENTATION_PRIVATE", scope: "content", finding: "implementation-private", failureOwnerRole: "demoImplementationAgent" },
  ], deltaScope: { affectedSections: ["content"], inputPaths: [bound("evidence.json").path, bound("demo.html").path], regressionSections: ["hero"] } };
  write("receipts/visualQA-1.json", qaReceipt);
  const manifest = { mode: "learn-brand", brand: "fixture", goalId: "fixture", runId: "fixture", goalSha256, status: "blocked", currentStageId: null, stages: [
    { id: "evidence-1", stage: "evidence", role: "brandResearcher", attempt: 1, status: "complete", verdict: "pass", outputHashes: [bound("evidence.json")] },
    { id: "interpreter-1", stage: "interpreter", role: "designTranslator", attempt: 1, status: "complete", verdict: "pass", receiptPath: bound("receipts/interpreter-1.json").path, receiptSha256: bound("receipts/interpreter-1.json").sha256, outputHashes: interpreterReceipt.outputs },
    { id: "demo-1", stage: "demo", role: "demoImplementationAgent", attempt: 1, status: "complete", verdict: "pass", outputHashes: [bound("demo.html")] },
    { id: "visualQA-1", stage: "visualQA", role: "visualQA", attempt: 1, status: "failed", verdict: "fail", failureOwnerRole: "designTranslator", receiptPath: bound("receipts/visualQA-1.json").path, receiptSha256: bound("receipts/visualQA-1.json").sha256, blockingFindings: qaReceipt.blockingFindings, deltaScope: qaReceipt.deltaScope },
  ] };
  write("execution-manifest.json", manifest);
  const run = (command = "resume-interpreter", authorize = true) => spawnSync(process.execPath, [script, command, "--brand", "fixture", "--root", root, ...(command === "resume-interpreter" && authorize ? ["--continue-existing"] : [])], { encoding: "utf8" });
  const read = (name) => JSON.parse(fs.readFileSync(path.join(migration, name)));
  return { root, migration, write, bound, manifest, qaReceipt, run, read };
}

test("post-QA Interpreter repair retains history and dispatches only source facts and scoped questions", (t) => {
  const f = fixture(t);
  const preserved = ["goal-contract.json", "evidence.json", "receipts/interpreter-1.json", "receipts/visualQA-1.json"].map((name) => [name, fs.readFileSync(path.join(f.migration, name))]);
  const resumed = f.run();
  assert.equal(resumed.status, 0, resumed.stderr);
  const updated = f.read("execution-manifest.json");
  assert.deepEqual(updated.stages.slice(0, 4), f.manifest.stages);
  assert.equal(updated.currentStageId, "interpreter-2");
  assert.equal(updated.continuations[0].additionalAttempts, 1);
  assert.equal(updated.stages[4].retryInput.deferredBlockingFindings[0].code, "IMPLEMENTATION_PRIVATE");
  for (const [name, bytes] of preserved) assert.deepEqual(fs.readFileSync(path.join(f.migration, name)), bytes);
  const next = f.run("next");
  assert.equal(next.status, 0, next.stderr);
  const dispatch = JSON.parse(next.stdout).dispatchRequest;
  assert.deepEqual(dispatch.requiredInputs.map((item) => item.path), [f.bound("goal-contract.json").path, f.bound("evidence.json").path]);
  assert.equal(dispatch.retryInput.blockingFindings[0].status, "unresolved-corrective-question");
  const packet = JSON.stringify(dispatch);
  for (const privateValue of ["IMPLEMENTATION_PRIVATE", "private-rationale", "assessment.json", "visualQA-1", "demo.html", "qaReceipt", '"verdict":"fail"']) assert.ok(!packet.includes(privateValue), privateValue);
});

test("in-budget post-QA repair does not require continuation", (t) => {
  const f = fixture(t, 2);
  const result = f.run("resume-interpreter", false);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read("execution-manifest.json").continuations, undefined);
});

test("post-QA repair accepts the explicit Interpreter owner alias", (t) => {
  const f = fixture(t);
  f.qaReceipt.failureOwnerRole = "interpreter";
  f.qaReceipt.blockingFindings[0].failureOwnerRole = "interpreter";
  f.write("receipts/visualQA-1.json", f.qaReceipt);
  f.manifest.stages[3].failureOwnerRole = "interpreter";
  f.manifest.stages[3].receiptSha256 = f.bound("receipts/visualQA-1.json").sha256;
  f.write("execution-manifest.json", f.manifest);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
});

function sequentialOverwrite(f) {
  f.write("patterns.json", { patterns: ["consumed old interpretation"] });
  const oldBinding = f.bound("patterns.json");
  const receipt = f.read("receipts/interpreter-1.json");
  receipt.inputs.push(oldBinding);
  f.write("patterns.json", { patterns: ["produced current interpretation"] });
  receipt.outputs = [f.bound("patterns.json")];
  f.write("receipts/interpreter-1.json", receipt);
  f.manifest.stages[1].receiptSha256 = f.bound("receipts/interpreter-1.json").sha256;
  f.manifest.stages[1].outputHashes = receipt.outputs;
  f.write("execution-manifest.json", f.manifest);
  return oldBinding;
}

test("same-receipt sequential overwrite verifies current output and preserves consumed historical input", (t) => {
  const f = fixture(t);
  const oldBinding = sequentialOverwrite(f);
  const historical = fs.readFileSync(path.join(f.migration, "receipts/interpreter-1.json"));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "receipts/interpreter-1.json")), historical);
  assert.equal(f.read("receipts/interpreter-1.json").inputs.at(-1).sha256, oldBinding.sha256);
  const frozen = f.read("execution-manifest.json").stages[4].retryInput.qaRepair.frozenInputs.filter((item) => item.path === oldBinding.path);
  assert.deepEqual(frozen, [f.bound("patterns.json")]);
  assert.equal(f.run("next").status, 0);
});

test("same-receipt overwrite cannot hide current output drift", (t) => {
  const f = fixture(t); sequentialOverwrite(f);
  f.write("patterns.json", { patterns: ["unreceipted drift"] });
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
});

test("same-receipt overwrite cannot hide a stale latest QA input", (t) => {
  const f = fixture(t);
  const oldBinding = sequentialOverwrite(f);
  f.qaReceipt.inputs.push(oldBinding);
  f.write("receipts/visualQA-1.json", f.qaReceipt);
  f.manifest.stages[3].receiptSha256 = f.bound("receipts/visualQA-1.json").sha256;
  f.write("execution-manifest.json", f.manifest);
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
});

function evidenceDelta(f) {
  const base = f.bound("evidence.json");
  f.write("source-manifest.json", { capturedPages: ["source page"] });
  f.manifest.stages[0].outputHashes.push(f.bound("source-manifest.json"));
  f.write("asset-delta.json", { sourceAssets: ["narrow additional asset"] });
  f.write("evidence.json", { sourceFacts: ["updated observed region"] });
  const updated = f.bound("evidence.json");
  f.manifest.stages.splice(1, 0, { id: "evidence-2", stage: "evidence", role: "brandResearcher", attempt: 2, status: "complete", verdict: "pass", outputHashes: [updated, f.bound("asset-delta.json")] });
  const interpreter = f.read("receipts/interpreter-1.json");
  interpreter.inputs = interpreter.inputs.map((item) => item.path === base.path ? updated : item);
  f.write("receipts/interpreter-1.json", interpreter);
  f.manifest.stages[2].receiptSha256 = f.bound("receipts/interpreter-1.json").sha256;
  f.write("execution-manifest.json", f.manifest);
}

test("narrow accepted Evidence delta retains base facts and latest source bindings", (t) => {
  const f = fixture(t); evidenceDelta(f);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const next = f.run("next");
  assert.equal(next.status, 0, next.stderr);
  const inputs = JSON.parse(next.stdout).dispatchRequest.requiredInputs;
  assert.deepEqual(inputs.map((item) => item.path), ["goal-contract.json", "evidence.json", "source-manifest.json", "asset-delta.json"].map((name) => f.bound(name).path));
  assert.deepEqual(inputs.find((item) => item.path.endsWith("evidence.json")), f.bound("evidence.json"));
  assert.ok(!inputs.some((item) => item.path.endsWith("patterns.json")));
});

test("narrow Evidence delta cannot hide drift in retained base source facts", (t) => {
  const f = fixture(t); evidenceDelta(f);
  f.write("source-manifest.json", { driftedBase: true });
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
});

for (const [name, mutate, authorize] of [
  ["wrong owner", (f) => { f.manifest.stages[3].failureOwnerRole = "demoImplementationAgent"; f.write("execution-manifest.json", f.manifest); }, true],
  ["stale receipt", (f) => { f.qaReceipt.goalSha256 = "stale"; f.write("receipts/visualQA-1.json", f.qaReceipt); f.manifest.stages[3].receiptSha256 = f.bound("receipts/visualQA-1.json").sha256; f.write("execution-manifest.json", f.manifest); }, true],
  ["receipt bytes changed", (f) => f.write("receipts/visualQA-1.json", { ...f.qaReceipt, changed: true }), true],
  ["current source drift", (f) => f.write("evidence.json", { changed: true }), true],
  ["current QA input drift", (f) => f.write("demo.html", "changed"), true],
  ["frozen Goal drift", (f) => f.write("goal-contract.json", { sealed: true, thresholds: { maxAttempts: 99 } }), true],
  ["unbound scope input", (f) => { f.write("extra.json", {}); f.qaReceipt.deltaScope.inputPaths.push(f.bound("extra.json").path); f.write("receipts/visualQA-1.json", f.qaReceipt); f.manifest.stages[3].receiptSha256 = f.bound("receipts/visualQA-1.json").sha256; f.write("execution-manifest.json", f.manifest); }, true],
  ["same QA receipt already consumed", (f) => { f.manifest.interpreterQaRepairs = [{ qaStageId: "visualQA-1", qaReceipt: f.bound("receipts/visualQA-1.json") }]; f.write("execution-manifest.json", f.manifest); }, true],
  ["exhausted without authorization", () => {}, false],
  ["newer completed consumer", (f) => { f.manifest.stages.push({ id: "demo-2", role: "demoImplementationAgent", status: "complete" }); f.write("execution-manifest.json", f.manifest); }, true],
]) test(`post-QA repair rejects ${name} without mutation`, (t) => {
  const f = fixture(t); mutate(f);
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run("resume-interpreter", authorize).status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
});

test("post-QA dispatch rejects drift after continuation without dispatching", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.write("demo.html", "changed-after-authorization");
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run("next").status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
});
