#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("../../..", import.meta.url).pathname);
const validator = path.join(root, "skills/brand/scripts/validate-host-structural-diff.mjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "brand-preedit-"));
const source = path.join(temp, "source.vue");
const baseline = path.join(temp, "baseline.json");
const targets = path.join(temp, "targets.json");
const bundle = path.join(temp, "bundle.json");
fs.copyFileSync(path.join(root, "skills/brand/scripts/fixtures/preedit/source.vue"), source);
fs.writeFileSync(targets, JSON.stringify({ targets: [{ route: "/fixture/page", sourceFile: source, baselineFile: baseline }] }));

const run = (...args) => spawnSync(process.execPath, [validator, ...args], { cwd: root, encoding: "utf8" });
const prepared = run("prepare-bundle", "--targets", targets, "--out", bundle);
assert.equal(prepared.status, 0, prepared.stderr);
const positive = run("verify-preedit", "--bundle", bundle, "--targets", targets, "--phase", "dispatch");
assert.equal(positive.status, 0, positive.stdout + positive.stderr);

fs.appendFileSync(source, "\n<!-- edited before dispatch -->\n");
const edited = run("verify-preedit", "--bundle", bundle, "--targets", targets, "--phase", "dispatch");
assert.equal(edited.status, 2);
assert.match(edited.stdout, /SOURCE_EDITED_BEFORE_DISPATCH/);

const receipt = run("verify-preedit", "--bundle", bundle, "--targets", targets, "--phase", "receipt");
assert.equal(receipt.status, 0, receipt.stdout + receipt.stderr);

const producer = run("verify-preedit", "--bundle", path.join(root, "skills/brand/scripts/fixtures/preedit/negative-producer-bundle.json"), "--targets", targets, "--phase", "dispatch");
assert.equal(producer.status, 2);
assert.match(producer.stdout, /PREEDIT_BASELINE_OWNER_INVALID/);
console.log(JSON.stringify({ ok: true, gate: "host-preedit-baseline-tests", cases: ["orchestrator-prepared-pass", "edited-before-dispatch-blocked", "original-baseline-valid-at-receipt", "producer-self-baseline-blocked"] }, null, 2));
