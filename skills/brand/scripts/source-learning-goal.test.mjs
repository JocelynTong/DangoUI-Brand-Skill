import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { createSourceLearningGoal, validateSourceLearningGoal } from "./source-learning-goal.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-learning-goal-"));
try {
  const brand = "fixture";
  const sourceUrl = "https://example.com/brand";
  const handoffFile = path.join(root, "source-prerequisite.json");
  fs.writeFileSync(handoffFile, JSON.stringify({ schema: "brand-source-prerequisite/v1", parentRequestKind: "host-concepts", artifactRoot: root, sourceUrl }));
  const options = { root, brand, sourceUrl, handoffFile };
  const sourceScreenshot = "captures/source.png";
  fs.mkdirSync(path.join(root, "captures"));
  fs.writeFileSync(path.join(root, sourceScreenshot), "captured-source-fixture");
  for (const profile of ["fast", "full"]) {
    const goal = createSourceLearningGoal({ ...options, profile, sourceScreenshot, now: new Date("2026-10-03T00:00:00Z") });
    assert.deepEqual(validateSourceLearningGoal(goal, options), []);
    assert.equal(goal.goalType, "brand-learning-capability-test");
    assert.equal(goal.thresholds.overall, 80);
    assert.equal(goal.thresholds.corePage, 70);
    assert.equal(goal.learningProofContract.generativeProof.required, true);
    assert.ok(goal.demoPages.some((demo) => demo.mapsToSourcePageId === null && demo.proofRole === "generative-held-out"));
    assert.equal(fs.existsSync(path.resolve(root, goal.demoPages[0].screenshot)), false, "Factory must not manufacture Demo captures");
    const migration = path.join(root, "migrations", brand);
    fs.mkdirSync(migration, { recursive: true });
    const goalFile = path.join(migration, "goal-contract.json");
    fs.writeFileSync(goalFile, JSON.stringify(goal));
    const prepare = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs"), "prepare", "--brand", brand, "--root", root], { encoding: "utf8" });
    assert.equal(prepare.status, 0, prepare.stderr);
    const dispatch = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs"), "next", "--brand", brand, "--root", root], { encoding: "utf8" });
    assert.equal(dispatch.status, 0, dispatch.stderr);
    assert.equal(JSON.parse(dispatch.stdout).dispatchRequest.stage, "evidence");
    fs.rmSync(path.join(migration, "execution-manifest.json"));
    assert.ok(JSON.parse(dispatch.stdout).dispatchRequest.goalSha256);
    for (const field of ["referencePages", "demoPages", "goalType", "rubric", "learningProofContract", "mustPreserve", "nonGoals", "evidencePolicy", "implementationPolicy"]) {
      const changed = structuredClone(goal);
      delete changed[field];
      assert.ok(validateSourceLearningGoal(changed, options).length > 0, field);
    }
    const weakened = structuredClone(goal);
    weakened.thresholds.overall = 79;
    assert.ok(validateSourceLearningGoal(weakened, options).includes("qualityThresholds"));
  }
  const legacy = { schema: "brand-goal/v2", goalId: "legacy", brand, mode: "learn-brand", sourceUrl, sealed: true };
  const legacyFile = path.join(root, "legacy-goal.json");
  fs.writeFileSync(legacyFile, JSON.stringify(legacy));
  const before = fs.readFileSync(legacyFile);
  assert.ok(validateSourceLearningGoal(legacy, options).includes("goalType"));
  assert.deepEqual(fs.readFileSync(legacyFile), before, "Validation must preserve sealed Goal bytes");
  // Exercise the actual public-entry boundary without running source network
  // collection. A sealed incomplete Goal must fail before prepare or next.
  const entrySource = fs.readFileSync(path.resolve("skills/brand/scripts/run-brand-workflow.mjs"), "utf8");
  const dispatchFunction = entrySource.slice(entrySource.indexOf("function dispatchSourceLearning("), entrySource.indexOf("function collectRenderedEvidence("));
  const migration = path.join(root, "migrations", brand);
  const goalFile = path.join(migration, "goal-contract.json");
  fs.writeFileSync(goalFile, JSON.stringify(legacy));
  fs.writeFileSync(handoffFile, JSON.stringify({ schema: "brand-source-prerequisite/v1", parentRequestKind: "host-concepts", artifactRoot: root, sourceUrl }));
  const entryBefore = fs.readFileSync(goalFile);
  const context = { fs, path, validateSourceLearningGoal, createSourceLearningGoal, profile: "fast", readJsonIfExists: (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null, block: (code) => { throw new Error(code); }, spawnSync: () => { assert.fail("Invalid sealed Goal must never reach dispatch"); } };
  vm.runInNewContext(`${dispatchFunction}\nthis.dispatchSourceLearning = dispatchSourceLearning;`, context);
  assert.throws(() => context.dispatchSourceLearning({ ...options, executed: [] }), /SOURCE_LEARNING_GOAL_INCOMPLETE/);
  assert.deepEqual(fs.readFileSync(goalFile), entryBefore);
  assert.throws(() => createSourceLearningGoal({ ...options, profile: "fast", sourceScreenshot: "missing.png" }), /sourceScreenshots/);
  assert.throws(() => createSourceLearningGoal({ ...options, profile: "fast", sourceScreenshot: "../outside.png" }), /sourceScreenshots/);
  console.log("source learning Goal factory, dispatch and immutable legacy validation passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
