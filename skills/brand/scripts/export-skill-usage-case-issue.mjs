#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fail, issueBody, parseArgs, readJson, validateReport } from "./skill-usage-case-lib.mjs";
const args = parseArgs(process.argv.slice(2));
if (!args.report || !args.output) fail("REPORT_AND_OUTPUT_REQUIRED");
const report = readJson(path.resolve(args.report));
const errors = validateReport(report);
if (errors.length) fail("REPORT_REJECTED", errors.join(","));
const output = path.resolve(args.output);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${issueBody(report)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: "EXPORTED_LOCAL_ONLY", output, networkRequests: 0 }, null, 2));
