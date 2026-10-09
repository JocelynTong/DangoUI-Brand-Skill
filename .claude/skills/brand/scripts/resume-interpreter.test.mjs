import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-interpreter-rejection-"));
  const migration = path.join(root, "migrations", "fixture");
  fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(migration, name), JSON.stringify(value));
  write("goal-contract.json", { sealed: true, mode: "learn-brand", goalId: "fixture", thresholds: { maxAttempts: 1 } });
  write("evidence.json", { sections: ["hero", "content"] });
  write("patterns.json", { patterns: ["hero-only"] });
  write("interpreter-dispatch.json", { dispatchId: "old-interpreter-dispatch", stageId: "interpreter-1", role: "designTranslator" });
  const bound = (name) => ({ path: `migrations/fixture/${name}`, sha256: sha(path.join(migration, name)) });
  const receipt = { stageId: "interpreter-1", role: "designTranslator", verdict: "pass", goalSha256: bound("goal-contract.json").sha256, inputs: [bound("evidence.json")], outputs: [bound("patterns.json")] };
  write("receipts/interpreter-1.json", receipt);
  const manifest = { mode: "learn-brand", brand: "fixture", runId: "fixture", goalId: "fixture", goalSha256: receipt.goalSha256, status: "running", currentStageId: "demo-1", stages: [
    { id: "evidence-2", stage: "evidence", role: "brandResearcher", status: "complete", verdict: "pass", outputHashes: [bound("evidence.json")] },
    { id: "interpreter-1", stage: "interpreter", role: "designTranslator", attempt: 1, status: "complete", verdict: "pass", dispatchPath: bound("interpreter-dispatch.json").path, receiptPath: bound("receipts/interpreter-1.json").path, receiptSha256: bound("receipts/interpreter-1.json").sha256, outputHashes: receipt.outputs },
    { id: "demo-1", stage: "demo", role: "demoImplementationAgent", attempt: 1, status: "pending" }
  ] };
  write("execution-manifest.json", manifest);
  const rejection = { schema: "brand-consumer-rejection/v1", ownerRole: "brandInterpreter", consumerRole: "designDirectorOrchestrator", verdict: "needs-evidence", reason: "Hero-only patterns cannot support the frozen held-out structure.", rejectedStageId: "interpreter-1", rejectedReceipt: bound("receipts/interpreter-1.json"), goalSha256: receipt.goalSha256, inputs: [...receipt.inputs, ...receipt.outputs, bound("goal-contract.json")], blockingFindings: [{ code: "PATTERN_COVERAGE_INCOMPLETE" }], deltaScope: { affectedSections: ["content"], inputPaths: [bound("evidence.json").path, bound("patterns.json").path], regressionSections: ["hero"] } };
  write("rejection.json", rejection);
  const run = (command = "resume-interpreter") => spawnSync(process.execPath, [script, command, "--brand", "fixture", "--root", root, ...(command === "resume-interpreter" ? ["--rejection", "migrations/fixture/rejection.json"] : [])], { encoding: "utf8" });
  return { root, migration, manifest, rejection, write, run };
}

test("consumer rejection preserves accepted history and dispatches scoped Interpreter, not Evidence", () => {
  const f = fixture();
  const goalBefore = fs.readFileSync(path.join(f.migration, "goal-contract.json"));
  const receiptBefore = fs.readFileSync(path.join(f.migration, "receipts/interpreter-1.json"));
  const evidenceBefore = fs.readFileSync(path.join(f.migration, "evidence.json"));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(fs.readFileSync(path.join(f.migration, "execution-manifest.json")));
  assert.equal(updated.currentStageId, "interpreter-2");
  assert.deepEqual(updated.stages.slice(0, 3), f.manifest.stages);
  assert.equal(updated.consumerRejections[0].supersededStageId, "interpreter-1");
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "goal-contract.json")), goalBefore);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "receipts/interpreter-1.json")), receiptBefore);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "evidence.json")), evidenceBefore);
  const next = f.run("next");
  assert.equal(next.status, 0, next.stderr);
  const dispatch = JSON.parse(next.stdout).dispatchRequest;
  assert.equal(dispatch.role, "designTranslator");
  assert.equal(dispatch.stageId, "interpreter-2");
  assert.ok(dispatch.requiredInputs.some((item) => item.path.includes("consumer-rejections/")));
  assert.ok(dispatch.requiredInputs.some((item) => item.path.endsWith("evidence.json")));
});

for (const [name, mutate] of [
  ["wrong owner", (f) => { f.rejection.ownerRole = "brandResearcher"; f.write("rejection.json", f.rejection); }],
  ["stale goal", (f) => { f.rejection.goalSha256 = "stale"; f.write("rejection.json", f.rejection); }],
  ["stale receipt", (f) => { f.rejection.rejectedReceipt.sha256 = "stale"; f.write("rejection.json", f.rejection); }],
  ["unbound current output", (f) => { f.rejection.inputs = f.rejection.inputs.filter((item) => !item.path.endsWith("patterns.json")); f.write("rejection.json", f.rejection); }],
  ["mutated accepted Evidence", (f) => f.write("evidence.json", { changed: true })],
  ["active consumer", (f) => { f.manifest.stages[2].status = "dispatched"; f.write("execution-manifest.json", f.manifest); }],
  ["unbounded second repair", (f) => { f.manifest.consumerRejections = [{ ownerRole: "brandInterpreter" }]; f.write("execution-manifest.json", f.manifest); }],
]) test(`reject ${name} before writing execution history`, () => {
  const f = fixture(); mutate(f);
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
  assert.equal(fs.existsSync(path.join(f.migration, "consumer-rejections")), false);
});

test("changed input after rejection cannot be silently frozen into the retry packet", () => {
  const f = fixture();
  assert.equal(f.run().status, 0);
  f.write("evidence.json", { changedAfterRejection: true });
  const before = fs.readFileSync(path.join(f.migration, "execution-manifest.json"));
  assert.notEqual(f.run("next").status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.migration, "execution-manifest.json")), before);
});

test("consumer repair archives genuine Interpreter PASS bytes and refuses archive tampering", () => {
  const f = fixture();
  const originals = new Map(["patterns.json", "receipts/interpreter-1.json", "interpreter-dispatch.json"].map(name => [`migrations/fixture/${name}`, fs.readFileSync(path.join(f.migration, name))]));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(fs.readFileSync(path.join(f.migration, "execution-manifest.json")));
  const binding = updated.stages.at(-1).retryInput.failedAttemptArchive;
  assert.deepEqual(updated.consumerRejections[0].archive, binding);
  assert.equal(updated.consumerRejections[0].priorStageId, "interpreter-1");
  const archivePath = path.join(f.root, binding.path);
  assert.equal(sha(archivePath), binding.sha256);
  const archiveBytes = fs.readFileSync(archivePath);
  const archive = JSON.parse(archiveBytes);
  assert.deepEqual(archive.stage, f.manifest.stages[1]);
  for (const [originalPath, bytes] of originals) {
    const copy = archive.archivedOutputs.find(item => item.originalPath === originalPath);
    assert.ok(copy, `archived ${originalPath}`);
    assert.deepEqual(fs.readFileSync(path.join(f.root, copy.path)), bytes);
    assert.equal(sha(path.join(f.root, copy.path)), copy.sha256);
    assert.deepEqual(fs.readFileSync(path.join(f.root, originalPath)), bytes);
  }
  const outputCopy = path.join(f.root, archive.archivedOutputs.find(item => item.originalPath.endsWith("patterns.json")).path);
  fs.writeFileSync(outputCopy, "tampered archive output");
  assert.notEqual(f.run("next").status, 0);
  fs.writeFileSync(outputCopy, originals.get("migrations/fixture/patterns.json"));
  fs.writeFileSync(archivePath, "tampered archive manifest");
  assert.notEqual(f.run("next").status, 0);
  fs.writeFileSync(archivePath, archiveBytes);
  const next = f.run("next");
  assert.equal(next.status, 0, next.stderr);
  assert.ok(JSON.parse(next.stdout).dispatchRequest.requiredInputs.some(item => item.path === binding.path && item.sha256 === binding.sha256));
  f.write("patterns.json", { patterns: ["replacement"] });
  assert.deepEqual(fs.readFileSync(outputCopy), originals.get("migrations/fixture/patterns.json"), "canonical replacement preserves archived PASS output");
  for (const originalPath of ["migrations/fixture/receipts/interpreter-1.json", "migrations/fixture/interpreter-dispatch.json"]) assert.deepEqual(fs.readFileSync(path.join(f.root, originalPath)), originals.get(originalPath));
});

test("historical Interpreter fixture without dispatch does not invent an output archive", () => {
  const f = fixture();
  delete f.manifest.stages[1].dispatchPath;
  f.write("execution-manifest.json", f.manifest);
  assert.equal(f.run().status, 0);
  const updated = JSON.parse(fs.readFileSync(path.join(f.migration, "execution-manifest.json")));
  assert.equal(updated.stages.at(-1).retryInput.failedAttemptArchive, undefined);
  assert.equal(updated.consumerRejections[0].archive, undefined);
});
