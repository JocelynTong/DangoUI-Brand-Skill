import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const entry = path.resolve("skills/brand/scripts/run-brand-workflow.mjs");
const result = spawnSync(process.execPath, [
  entry,
  "run",
  "--mode",
  "apply-host",
  "--brand",
  "__missing_wild_design_fixture__",
  "--host-target",
  "/tmp/host.vue",
  "--style-pack",
  path.resolve("package.json"),
  "--source-url",
  "https://example.com/brand/demo",
], { encoding: "utf8" });

assert.notEqual(result.status, 0);
const payload = JSON.parse(result.stdout);
assert.equal(payload.blockingCode, "WILD_DESIGN_ARTIFACT_SET_INCOMPLETE");
assert.deepEqual(payload.missingArtifacts, [
  "options",
  "decision",
  "businessScope",
  "designDirection",
  "brandEvidence",
]);
assert.doesNotMatch(result.stdout + result.stderr, /Usage: validate-wild-design-decision/);

console.log("run-brand-workflow apply-host missing-artifact test passed");
