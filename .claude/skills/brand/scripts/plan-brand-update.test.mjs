#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-update-plan-"));
const migration = path.join(root, "migrations", "fixture");
fs.mkdirSync(migration, { recursive: true });
const base = { schema: "brand-update-baseline/v1", brand: "fixture", rulesVersion: "1", pages: [
  { id: "home", contentSha256: "c1", renderSha256: "r1", assetSha256: "a1", interactionSha256: "i1" },
  { id: "learn", contentSha256: "c2", renderSha256: "r2", assetSha256: "a2", interactionSha256: "i2" }
] };
fs.writeFileSync(path.join(migration, "update-baseline.json"), JSON.stringify(base));
const script = path.resolve("skills/brand/scripts/plan-brand-update.mjs");
const run = (snapshot) => {
  fs.writeFileSync(path.join(migration, "source-fingerprint.json"), JSON.stringify(snapshot));
  const result = spawnSync(process.execPath, [script, "plan", "--brand", "fixture", "--root", root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

assert.equal(run(base).route, "reuse-no-op");
assert.equal(run({ ...base, rulesVersion: "2" }).route, "contract-migration-only");
const content = structuredClone(base); content.pages[0].contentSha256 = "c-new";
assert.equal(run(content).route, "targeted-content-refresh");
const visual = structuredClone(base); visual.pages[0].renderSha256 = "r-new";
assert.equal(run(visual).route, "targeted-visual-refresh");
const many = structuredClone(base); many.pages[0].renderSha256 = "r-new"; many.pages[1].assetSha256 = "a-new";
assert.equal(run(many).route, "targeted-visual-refresh");
const sourceSet = structuredClone(base); sourceSet.pages.push({ id: "new-page", contentSha256: "c3", renderSha256: "r3", assetSha256: "a3", interactionSha256: "i3" });
assert.equal(run(sourceSet).route, "full-relearn-existing-brand");
assert.equal(run(sourceSet).executionPolicy.createRegistryEntry, false);
process.stdout.write("brand incremental update planner tests passed\n");
