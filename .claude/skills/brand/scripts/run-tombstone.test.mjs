#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("./brand-guard.mjs", import.meta.url).pathname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-run-tombstone-"));
const log = path.join(dir, "runs.jsonl");
const rows = [
  { runId: "pitch-1", createdAt: "2026-01-01T00:00:00.000Z", brand: "pokemon-tcg-pitch-black", sourceHost: "tcg.pokemon.com", coverageLevel: "complete-style-preview" },
  { runId: "rocom-1", createdAt: "2026-01-02T00:00:00.000Z", brand: "rocom", sourceHost: "rocom.qq.com", coverageLevel: "complete-style-preview" },
  { runId: "active-1", createdAt: "2026-01-03T00:00:00.000Z", brand: "onepiece-cardgame", sourceHost: "onepiece-cardgame.com", coverageLevel: "complete-style-preview" },
  { recordType: "run-tombstone", createdAt: "2026-02-01T00:00:00.000Z", brand: "pokemon-tcg-pitch-black", disposition: "invalidated", reason: "failed QA" },
  { recordType: "run-tombstone", createdAt: "2026-02-01T00:00:00.000Z", brand: "rocom", disposition: "retired", reason: "deleted" },
];
fs.writeFileSync(log, `${rows.map(JSON.stringify).join("\n")}\n`);
let result = spawnSync(process.execPath, [script, "summarize-runs", "--scope", "project", "--project-log", log], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr || result.stdout);
let body = JSON.parse(result.stdout);
assert.equal(body.totalRuns, 1);
assert.equal(body.tombstonedRuns, 2);
assert.deepEqual(body.byBrand, { "onepiece-cardgame": 1 });
result = spawnSync(process.execPath, [script, "issue-retro", "--scope", "project", "--project-log", log], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr || result.stdout);
body = JSON.parse(result.stdout);
assert.equal(body.totalRunsScanned, 1);
assert.equal(body.tombstonedRunsExcluded, 2);
assert.equal(body.latestRuns[0].brand, "onepiece-cardgame");

const commandLog = path.join(dir, "command-runs.jsonl");
result = spawnSync(process.execPath, [script, "tombstone-run", "--brand", "rocom", "--disposition", "superseded", "--reason", "relearned with the current workflow", "--scope", "project", "--project-log", commandLog], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr || result.stdout);
const appended = JSON.parse(fs.readFileSync(commandLog, "utf8").trim());
assert.equal(appended.recordType, "run-tombstone");
assert.equal(appended.disposition, "superseded");
assert.equal(appended.brand, "rocom");
fs.rmSync(dir, { recursive: true, force: true });
console.log("run tombstone tests passed");
