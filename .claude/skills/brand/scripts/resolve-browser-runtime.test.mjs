import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { resolveBrowserRuntime } from "./resolve-browser-runtime.mjs";

test("installed-style helper reuses real declared workspace runtime without launching", async () => {
  const isolatedSkill = fs.mkdtempSync(path.join(os.tmpdir(), "brand-browser-runtime-"));
  const result = await resolveBrowserRuntime({ runtimeRoot: process.cwd(), workspaceRoot: isolatedSkill, skillUrl: pathToFileURL(path.join(isolatedSkill, "scripts/runtime.mjs")).href });
  assert.equal(typeof result.chromium.launch, "function");
  assert.equal(result.provenance.anchor, path.join(process.cwd(), "package.json"));
  assert.ok(fs.existsSync(result.modulePath));
});

test("no dependency returns structured unavailability without npm or browser probing", async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "brand-no-browser-runtime-"));
  await assert.rejects(resolveBrowserRuntime({ runtimeRoot: "", workspaceRoot: empty, skillUrl: pathToFileURL(path.join(empty, "scripts/runtime.mjs")).href }), (error) => {
    assert.equal(error.code, "BROWSER_RUNTIME_UNAVAILABLE");
    assert.ok(error.failures.length > 0);
    return true;
  });
  assert.equal(fs.existsSync(path.join(empty, "node_modules")), false);
});

test("collector help has no dependency or browser side effects", () => {
  const result = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/run-rendered-evidence-collector.mjs"), "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.startsWith("Usage:"));
});
