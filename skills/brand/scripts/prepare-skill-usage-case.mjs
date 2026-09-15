#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultOutbox, ensureExternalOutbox, fail, fingerprint, parseArgs, readJson, redactSelected, reportFields, sha, validateReport, writeJson } from "./skill-usage-case-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const outbox = path.resolve(String(args.outbox || defaultOutbox()));
ensureExternalOutbox(outbox, args.host || process.cwd());
const promptState = args["run-id"] ? path.join(outbox, "runs", `${String(args["run-id"]).replace(/[^a-zA-Z0-9._-]/g, "_")}.json`) : "";
if (args.decline) {
  if (!promptState) fail("RUN_ID_REQUIRED_FOR_DECLINE");
  writeJson(promptState, { runId: args["run-id"], decision: "declined", decidedAt: new Date().toISOString() });
  console.log(JSON.stringify({ status: "DECLINED_LOCAL_ONLY", uploadAttempted: false, promptAgain: false }, null, 2));
  process.exit(0);
}
if (!args.case) fail("CASE_FILE_REQUIRED");
if (promptState && fs.existsSync(promptState)) {
  console.log(JSON.stringify({ status: "PROMPT_SUPPRESSED", uploadAttempted: false, promptAgain: false }, null, 2));
  process.exit(0);
}
const input = readJson(path.resolve(args.case));
for (const field of reportFields) if (input[field] === undefined) fail("MISSING_INPUT_FIELD", field);
if (!input.independenceValue) fail("MISSING_INPUT_FIELD", "independenceValue");
fs.mkdirSync(outbox, { recursive: true, mode: 0o700 });
const saltFile = path.join(outbox, ".independence-salt");
if (!fs.existsSync(saltFile)) fs.writeFileSync(saltFile, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
const salt = fs.readFileSync(saltFile, "utf8").trim();
const selected = redactSelected(Object.fromEntries(reportFields.map(field => [field, input[field]])), input.sensitiveTerms || []);
const fp = fingerprint(selected);
const caseId = `case_${sha(`${fp}\n${input.independenceValue}`).slice(7, 23)}`;
const report = { schemaVersion: "1.0", caseId, ...selected, fingerprint: fp, independenceHash: sha(`${salt}\n${input.independenceValue}`), lifecycle: "reviewed-local", occurrenceCount: Number(input.occurrenceCount || 1), createdAt: input.createdAt || new Date().toISOString() };
const errors = validateReport(report);
if (errors.length) fail("REPORT_REJECTED", errors.join(","));
const caseDir = path.join(outbox, "cases", caseId);
writeJson(path.join(caseDir, "local.json"), { ...input, lifecycle: "reported-local", caseId });
writeJson(path.join(caseDir, "report.json"), report);
if (promptState) writeJson(promptState, { runId: args["run-id"], decision: "prompted", promptedAt: new Date().toISOString(), caseIds: [caseId] });
console.log(JSON.stringify({ status: "PREPARED_LOCAL_ONLY", report: path.join(caseDir, "report.json"), fingerprint: fp, networkRequests: 0, prompt: "本次发现 1 个可能与 Brand Skill 有关的问题。是否向维护方发送脱敏摘要？不会上传项目代码、路径、页面内容或截图，也不会修改当前项目或自动修改 Skill。", actions: ["查看脱敏摘要", "上报摘要", "暂不上报"] }, null, 2));
