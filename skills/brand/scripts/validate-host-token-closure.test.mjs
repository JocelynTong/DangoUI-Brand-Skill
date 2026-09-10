#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const gate = path.resolve("skills/brand/scripts/validate-host-token-closure.mjs");
const fixture = ({ bridge = true, tracksPass = true, stale = false } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "host-token-closure-"));
  fs.mkdirSync(path.join(root, "host"));
  fs.writeFileSync(path.join(root, "brand-mod.json"), "{}\n");
  const sourceModSha256 = crypto.createHash("sha256").update("{}\n").digest("hex");
  fs.writeFileSync(path.join(root, "host/theme.scss"), `${stale ? "/* PARTIAL_STYLE_ONLY */" : ""}\n${bridge ? ".theme { --du-primary-color: #fff507; } .du-c-primary-bt { --du-bt-color: var(--du-primary-color); }" : ".theme {}"}`);
  fs.writeFileSync(path.join(root, "contract.json"), JSON.stringify({
    schema: "brand-host-token-closure/v1", host: "host", sourceMod: "brand-mod.json", sourceModSha256,
    themeFile: "theme.scss", status: tracksPass ? "PASS" : "READY_FOR_RUNTIME_QA",
    tracks: { source: "PASS", rendered: tracksPass ? "PASS" : "PENDING" },
    requiredMappings: [{ role: "active", source: "action.active", target: "--du-primary-color", value: "#FFF507", status: "mapped" }],
    runtimeComponentTokens: { DuButton: ["--du-bt-color"] }, componentAliasSelectors: [".du-c-primary-bt"],
    exceptions: [{ id: "recipe", kind: "style-only", owner: "Design", reason: "bounded recipe" }]
  }));
  return root;
};
const run = (root, strict = true) => spawnSync(process.execPath, [gate, "--root", root, "--contract", "contract.json", ...(strict ? ["--strict"] : [])], { encoding: "utf8" });

assert.equal(run(fixture()).status, 0);
assert.notEqual(run(fixture({ bridge: false })).status, 0);
assert.match(run(fixture({ bridge: false })).stdout, /TOKEN_TARGET_NOT_BRIDGED/);
assert.notEqual(run(fixture({ tracksPass: false })).status, 0);
assert.match(run(fixture({ tracksPass: false })).stdout, /TOKEN_TRACK_INCOMPLETE/);
assert.notEqual(run(fixture({ stale: true })).status, 0);
assert.match(run(fixture({ stale: true })).stdout, /TOKEN_STALE_RUNTIME_CLAIM/);
console.log("host token closure tests passed");
