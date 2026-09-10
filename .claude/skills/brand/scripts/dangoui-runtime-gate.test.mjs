#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const gate = path.resolve("skills/brand/scripts/dangoui-runtime-gate.mjs");
const fixture = ({ declared = "3.6.16", installed = "3.6.16", platform = "h5", local = false, twoLocks = false, evidence = true, visualOwnership = "PASS" } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dangoui-runtime-gate-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/dangoui/dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { dangoui: local ? "file:/Users/example/dangoui" : declared } }));
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), `lockfileVersion: '9.0'\npackages:\n  dangoui@${declared}: {}`);
  if (twoLocks) fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 }));
  fs.writeFileSync(path.join(root, "node_modules/dangoui/package.json"), JSON.stringify({ version: installed, module: "dist/index.mjs", exports: { ".": { import: "./dist/index.mjs" }, "./style.css": "./style.css", "./theme.css": "./theme.css" } }));
  fs.writeFileSync(path.join(root, "node_modules/dangoui/dist/index.mjs"), "export { DuInput, DuButton };");
  fs.writeFileSync(path.join(root, "src/page.tsx"), `import { DuInput, DuButton } from "dangoui";`);
  fs.writeFileSync(path.join(root, "src/app.ts"), `import "dangoui/style.css";\nimport "dangoui/theme.css";`);
  fs.writeFileSync(path.join(root, "source-mod.json"), "{}");
  fs.writeFileSync(path.join(root, "src/theme.css"), ":root { --du-bg-1: #fff; --du-bt-color: #000; } .du-c-primary-bt {}");
  fs.writeFileSync(path.join(root, "state-evidence.json"), JSON.stringify({ schema: "brand-host-token-state-evidence/v1", platform: "h5", build: { status: "PASS" }, liveReport: { status: "PASS" }, liveBrowserChecks: { default: "PASS" } }));
  const sourceHash = crypto.createHash("sha256").update("{}").digest("hex");
  fs.writeFileSync(path.join(root, "token-closure.json"), JSON.stringify({
    schema: "brand-host-token-closure/v1", platform: "h5", sourceMod: "source-mod.json", sourceModSha256: sourceHash,
    host: ".", themeFile: "src/theme.css", status: "PASS",
    tracks: { sourceTokenInventory: "PASS", semanticMapping: "PASS", runtimeConsumption: "PASS", renderedStateVerification: "PASS", businessVisualQa: "PASS" },
    requiredMappings: [{ role: "surface", source: "surface", target: "--du-bg-1", value: "#fff", status: "mapped" }],
    runtimeComponentTokens: { DuButton: ["--du-bt-color"] }, componentAliasSelectors: [".du-c-primary-bt"], requiredStates: ["default"], stateEvidence: "state-evidence.json", exceptions: []
  }));
  if (evidence) fs.writeFileSync(path.join(root, "evidence.json"), JSON.stringify({ platform, renderedConsumer: "PASS", bundleContainsDangoui: "PASS", businessParity: "PASS", visualOwnership }));
  return root;
};
const run = (root, extra = []) => spawnSync(process.execPath, [gate, "verify", "--root", root, "--version", "3.6.16", "--platform", "h5", "--components", "DuInput,DuButton", "--source", "src/page.tsx", "--style-entry", "src/app.ts", "--evidence", "evidence.json", "--token-root", root, "--token-closure", "token-closure.json", ...extra], { encoding: "utf8" });

assert.equal(run(fixture()).status, 0);
assert.match(run(fixture()).stdout, /PASS_REAL_COMPONENT_CONSUMER_H5_ONLY/);
assert.notEqual(run(fixture({ local: true })).status, 0);
assert.match(run(fixture({ local: true })).stdout, /LOCAL_PATH_DEPENDENCY_FORBIDDEN/);
assert.notEqual(run(fixture({ declared: "^3.6.16" })).status, 0);
assert.notEqual(run(fixture({ installed: "3.6.15" })).status, 0);
assert.notEqual(run(fixture({ twoLocks: true })).status, 0);
assert.notEqual(run(fixture({ platform: "weapp" }), ["--platform", "weapp"]).status, 0);
assert.notEqual(run(fixture({ evidence: false })).status, 0);
assert.notEqual(run(fixture({ visualOwnership: "FAIL" })).status, 0);
assert.match(run(fixture({ visualOwnership: "FAIL" })).stdout, /DANGOUI_CONTROL_OWNERSHIP_FAILED/);
const missingTokenRoot = fixture();
fs.unlinkSync(path.join(missingTokenRoot, "token-closure.json"));
assert.notEqual(run(missingTokenRoot).status, 0);
assert.match(run(missingTokenRoot).stdout, /DANGOUI_TOKEN_CLOSURE_FAILED/);
console.log("dangoui-runtime-gate tests passed");
