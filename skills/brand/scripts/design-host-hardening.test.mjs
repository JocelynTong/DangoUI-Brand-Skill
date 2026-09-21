#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildSkillIntegrity, verifySkillIntegrity } from "./verify-brand-skill-integrity.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "brand-hardening-"));
const installed = path.join(temp, "installed");
fs.mkdirSync(installed);
fs.writeFileSync(path.join(installed, "SKILL.md"), "clean\n");
fs.writeFileSync(path.join(installed, ".brand-skill-integrity.json"), JSON.stringify(buildSkillIntegrity(installed)));
assert.equal(verifySkillIntegrity(installed).status, "pass");
fs.writeFileSync(path.join(installed, "SKILL.md"), "mixed\n");
assert.throws(() => verifySkillIntegrity(installed), /BRAND_SKILL_MIXED_VERSION/);

const root = path.join(temp, "workflow");
const brand = "timeout-fixture";
const migration = path.join(root, "migrations", brand);
fs.mkdirSync(path.join(root, "skills", "brand"), { recursive: true });
fs.mkdirSync(path.join(root, "skills", "brand", "scripts"), { recursive: true });
fs.mkdirSync(migration, { recursive: true });
fs.writeFileSync(path.join(root, "skills", "brand", "workflow-contract.json"), JSON.stringify({ roleContractVersion: "test", roles: { hostStrategist: { goal: "test" }, brandApplicationDesigner: { goal: "test" } } }));
fs.copyFileSync(path.resolve("skills/brand/scripts/validate-design-host-route.mjs"), path.join(root, "skills", "brand", "scripts", "validate-design-host-route.mjs"));
fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ sealed: true, mode: "design-host", executionProfile: "fast", goalId: "timeout", thresholds: { maxAttempts: 2 }, designHostRoute: { intent: "h5-only", technique: "existing", imageCapability: { status: "not-required" } } }));
const workflow = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const run = (...args) => spawnSync(process.execPath, [workflow, ...args, "--brand", brand, "--root", root], { encoding: "utf8" });
assert.equal(run("prepare").status, 0);
const manifestFile = path.join(migration, "execution-manifest.json");
let manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
assert.equal(run("next").status, 0);
manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const dispatch = JSON.parse(fs.readFileSync(path.join(root, manifest.stages[0].dispatchPath), "utf8"));
const outputFile = path.join(migration, "strategy.json");
fs.writeFileSync(outputFile, "{}\n");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const fakeTimeout = { dispatchId: dispatch.dispatchId, stageId: dispatch.stageId, role: dispatch.role, agentExecutionId: "/root/brand-application-designer", goalSha256: manifest.goalSha256, verdict: "fail", inputs: dispatch.requiredInputs, outputs: [{ path: `migrations/${brand}/strategy.json`, sha256: sha(outputFile) }], blockingFindings: [{ code: "TIME_BUDGET_EXCEEDED", stopObservedAt: new Date(Date.now() + 300000).toISOString() }] };
const fakeReceipt = path.join(migration, "fake-timeout.json");
fs.writeFileSync(fakeReceipt, JSON.stringify(fakeTimeout));
const rejected = run("record", "--receipt", `migrations/${brand}/fake-timeout.json`);
assert.notEqual(rejected.status, 0);
assert.match(rejected.stderr, /ROLE_TIMEOUT_CLAIM_FORBIDDEN/);
assert.equal(JSON.parse(fs.readFileSync(manifestFile, "utf8")).stages[0].status, "dispatched");

manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
manifest.deadlineAt = new Date(Date.now() - 1000).toISOString();
fs.writeFileSync(manifestFile, JSON.stringify(manifest));
const timedOut = run("next");
assert.notEqual(timedOut.status, 0);
assert.match(timedOut.stderr, /DESIGN_HOST_FAST_BUDGET_EXCEEDED/);
assert.equal(JSON.parse(fs.readFileSync(manifestFile, "utf8")).status, "timed-out");

assert.ok(sha(manifestFile));
console.log("design-host hardening tests passed");
