import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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
assert.equal(payload.blockingCode, "APPLY_HOST_PREFLIGHT_BLOCKED");
assert.equal(payload.step, "apply-host-preflight");
assert.ok(payload.preflight.blocking.includes("HOST_TARGET_MISSING"));
assert.ok(payload.preflight.blocking.includes("FROZEN_PACK_FILE_MISSING:brand-mod.json"));
assert.equal(payload.preflight.frozenPack.reuseDecision, "blocked");
assert.doesNotMatch(result.stdout + result.stderr, /Usage: validate-wild-design-decision/);
fs.rmSync(path.resolve("migrations/__missing_wild_design_fixture__"), { recursive: true, force: true });

console.log("run-brand-workflow apply-host preflight-order test passed");
