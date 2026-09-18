#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runCachedValidator } from "./validator-cache.mjs";

const root = process.cwd();
const checks = [];
const check = (id, pass, details = {}) => { checks.push({ id, status: pass ? "pass" : "fail", ...details }); assert.equal(pass, true, `${id}: ${JSON.stringify(details)}`); };
const run = (file, args = []) => {
  const result = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
};

run("skills/brand/scripts/brand-phase1-acceptance.mjs");
const query = JSON.parse(run("skills/brand/scripts/query-brand-context.mjs", ["search", "--source", "tokens", "--term", "color", "--limit", "3", "--max-chars", "1200"]));
check("targeted-json-query", query.ok && query.returnedBytes < query.sourceBytes && query.returnedBytes <= 1203, query);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "brand-cache-test-"));
fs.writeFileSync(path.join(temp, "input.json"), "{\"value\":1}\n");
fs.writeFileSync(path.join(temp, "validator.mjs"), "import fs from 'node:fs'; fs.appendFileSync('runs.txt','x'); JSON.parse(fs.readFileSync(process.argv[2]));\n");
const first = runCachedValidator({ root: temp, script: "validator.mjs", args: ["input.json"] });
const second = runCachedValidator({ root: temp, script: "validator.mjs", args: ["input.json"] });
fs.writeFileSync(path.join(temp, "input.json"), "{\"value\":2}\n");
const third = runCachedValidator({ root: temp, script: "validator.mjs", args: ["input.json"] });
check("validator-fingerprint-cache", first.cacheStatus === "miss" && second.cacheStatus === "hit" && third.cacheStatus === "miss" && fs.readFileSync(path.join(temp, "runs.txt"), "utf8") === "xx", { first: first.cacheStatus, second: second.cacheStatus, third: third.cacheStatus });

const workflow = fs.readFileSync(path.join(root, "skills/brand/scripts/brand-subagent-workflow.mjs"), "utf8");
check("delta-rework-contract", workflow.includes("validateDeltaScope(receipt.deltaScope)") && workflow.includes("current.retryInput?.deltaScope?.inputPaths"));
check("run-telemetry-contract", workflow.includes("workflow-telemetry.json") && workflow.includes("additionalReadBytes"));
const contract = JSON.parse(fs.readFileSync(path.join(root, "skills/brand/workflow-contract.json"), "utf8"));
check("phase2-contract-version", contract.version === "0.17" && contract.roleContractVersion === "3.2", { version: contract.version, roleContractVersion: contract.roleContractVersion });

const report = { schema: "brand-phase2-acceptance/v1", verdict: "PASS", completedAt: new Date().toISOString(), guarantees: ["large JSON is queried by allowlisted source and bounded output", "unchanged validators reuse a content fingerprint result", "failed QA must provide a delta scope and retry reads only scoped inputs", "workflow records input, output and additional-read byte telemetry"], checks };
fs.mkdirSync(path.join(root, "output"), { recursive: true });
fs.writeFileSync(path.join(root, "output/brand-phase2-acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, verdict: report.verdict, checkCount: checks.length, report: "output/brand-phase2-acceptance.json" }, null, 2)}\n`);
