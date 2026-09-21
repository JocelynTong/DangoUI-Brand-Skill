#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-prepare-test-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const skillDir = path.join(root, "skills", "brand");
fs.mkdirSync(migration, { recursive: true });
fs.mkdirSync(skillDir, { recursive: true });
fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ sealed: true, mode: "learn-brand", goalId: "fixture-goal" }));
fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({ roleContractVersion: "test" }));

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const first = spawnSync(process.execPath, [script, "prepare", "--brand", brand, "--root", root], { encoding: "utf8" });
assert.equal(first.status, 0, first.stderr);
const original = fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8");

const second = spawnSync(process.execPath, [script, "prepare", "--brand", brand, "--root", root], { encoding: "utf8" });
assert.notEqual(second.status, 0, "second prepare must fail closed");
assert.match(second.stderr, /EXECUTION_MANIFEST_ALREADY_EXISTS/);
assert.equal(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"), original, "existing run history must remain byte-identical");

process.stdout.write("brand subagent prepare overwrite regression passed\n");
