#!/usr/bin/env node
import path from "node:path";
import { fail, parseArgs, readJson, validateReport } from "./skill-usage-case-lib.mjs";
const args = parseArgs(process.argv.slice(2));
if (!args.report) fail("REPORT_FILE_REQUIRED");
const errors = validateReport(readJson(path.resolve(args.report)));
if (errors.length) fail("REPORT_REJECTED", errors.join(","));
console.log(JSON.stringify({ status: "VALID", networkRequests: 0 }, null, 2));
