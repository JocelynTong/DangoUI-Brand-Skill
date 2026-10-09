import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Exercise the real skill runtime from an empty artifact directory, without
// network/browser work. CLI version output is intentionally not evidence.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-extractor-runtime-"));
try {
  const result = spawnSync(process.execPath, [
    path.resolve("skills/brand/scripts/run-dembrandt-extractor.mjs"),
    "--root", root, "--brand", "runtime-test", "--source-url", "--version",
  ], { encoding: "utf8", timeout: 15000 });
  assert.notEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.notEqual(payload.blockingCode, "EXTRACTOR_RUNTIME_UNAVAILABLE");
  assert.match(payload.message, /non-JSON/);
  assert.match(payload.stdout, /\d+\.\d+\.\d+/);
  assert.equal(fs.existsSync(path.join(root, "node_modules")), false);
  assert.equal(fs.existsSync(payload.outputFile), false);
  console.log("extractor skill-runtime isolation regression passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
