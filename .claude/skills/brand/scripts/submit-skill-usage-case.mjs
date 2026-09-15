#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { defaultOutbox, fail, issueBody, parseArgs, readJson, validateReport, writeJson } from "./skill-usage-case-lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args["confirm-reviewed"]) fail("SUBMISSION_REVIEW_REQUIRED", "pass --confirm-reviewed only after the user approves the displayed summary");
if (!/^[\w.-]+\/[\w.-]+$/.test(String(args.repo || ""))) fail("FEEDBACK_REPO_REQUIRED");
const gh = process.env.SKILL_USAGE_GH_BIN || "gh";
const run = ghArgs => spawnSync(gh, ghArgs, { encoding: "utf8", timeout: Number(args["timeout-ms"] || 30000), env: { ...process.env, SKILL_USAGE_TEST_SCENARIO: String(args["test-scenario"] || "") } });
if (args["close-issue"]) {
  const closed = run(["api", "--method", "PATCH", `repos/${args.repo}/issues/${args["close-issue"]}`, "-f", "state=closed"]);
  if (closed.status !== 0) fail("GITHUB_CLOSE_FAILED", "no local lifecycle change was made");
  console.log(JSON.stringify({ status: "CLOSED", issueNumber: Number(args["close-issue"]) }, null, 2));
  process.exit(0);
}
if (!args.report) fail("REPORT_FILE_REQUIRED");
const report = readJson(path.resolve(args.report));
const errors = validateReport(report);
if (errors.length) fail("REPORT_REJECTED", errors.join(","));
const outbox = path.resolve(String(args.outbox || defaultOutbox()));
const receiptFile = path.join(outbox, "receipts", `${report.fingerprint.slice(7)}.json`);
if (fs.existsSync(receiptFile)) {
  console.log(JSON.stringify({ status: "ALREADY_SUBMITTED", ...readJson(receiptFile) }, null, 2));
  process.exit(0);
}
const marker = `brand-skill-fingerprint:${report.fingerprint}`;
const search = run(["api", `repos/${args.repo}/issues`, "-f", "state=all", "-f", "per_page=100"]);
if (search.status === 0) {
  let issues = [];
  try { issues = JSON.parse(search.stdout); } catch { fail("GITHUB_RESPONSE_INVALID", "issue lookup was not valid JSON; kept local pending"); }
  const existing = issues.find(issue => String(issue.body || "").includes(marker));
  if (existing) {
    const receipt = { fingerprint: report.fingerprint, issueNumber: existing.number, issueUrl: existing.html_url, submittedAt: new Date().toISOString(), deduplicated: true };
    writeJson(receiptFile, receipt);
    console.log(JSON.stringify({ status: "MERGED_EXISTING_ISSUE", ...receipt }, null, 2));
    process.exit(0);
  }
} else {
  const detail = `${search.stderr || search.stdout}`;
  if (/429|rate limit/i.test(detail)) fail("GITHUB_RATE_LIMITED", "kept local pending");
  if (/5\d\d|server error/i.test(detail)) fail("GITHUB_SERVER_ERROR", "kept local pending");
  fail("GITHUB_LOOKUP_UNCERTAIN", "kept local pending; retry is safe");
}
const created = run(["api", `repos/${args.repo}/issues`, "-f", `title=[Brand Skill] ${report.abstractMechanismCode}`, "-f", `body=${issueBody(report)}`]);
if (created.status !== 0) {
  const detail = `${created.stderr || created.stdout}`;
  if (/429|rate limit/i.test(detail)) fail("GITHUB_RATE_LIMITED", "kept local pending");
  if (/5\d\d|server error/i.test(detail)) fail("GITHUB_SERVER_ERROR", "kept local pending; retry will search by fingerprint first");
  if (created.signal || created.error || created.status === null) fail("GITHUB_RESPONSE_UNCERTAIN", "kept local pending; retry will search by fingerprint first");
  fail("GITHUB_SUBMISSION_FAILED", "kept local pending");
}
let issue;
try { issue = JSON.parse(created.stdout); } catch { fail("GITHUB_RESPONSE_UNCERTAIN", "create may have succeeded; retry will search by fingerprint first"); }
const receipt = { fingerprint: report.fingerprint, issueNumber: issue.number, issueUrl: issue.html_url, submittedAt: new Date().toISOString(), deduplicated: false };
writeJson(receiptFile, receipt);
console.log(JSON.stringify({ status: "SUBMITTED", ...receipt }, null, 2));
