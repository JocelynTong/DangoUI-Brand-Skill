#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fail, parseArgs, readJson, validateReport, writeJson } from "./skill-usage-case-lib.mjs";
const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output) fail("INPUT_AND_OUTPUT_REQUIRED");
const files = fs.statSync(args.input).isDirectory() ? fs.readdirSync(args.input).filter(name => name.endsWith(".json")).map(name => path.join(args.input, name)) : String(args.input).split(",");
const groups = new Map();
for (const file of files) {
  const report = readJson(path.resolve(file));
  const errors = validateReport(report);
  if (errors.length) fail("REPORT_REJECTED", `${file}:${errors.join(",")}`);
  const group = groups.get(report.fingerprint) || { fingerprint: report.fingerprint, abstractMechanismCode: report.abstractMechanismCode, cases: [], independenceHashes: new Set(), occurrenceCount: 0 };
  group.cases.push(report.caseId); group.independenceHashes.add(report.independenceHash); group.occurrenceCount += report.occurrenceCount; groups.set(report.fingerprint, group);
}
const mechanisms = [...groups.values()].map(group => ({ ...group, independenceHashes: [...group.independenceHashes], independentCaseCount: group.independenceHashes.size, lifecycle: group.independenceHashes.size >= 2 ? "cross-case-candidate" : "project-candidate" }));
writeJson(path.resolve(args.output), { schemaVersion: "1.0", generatedAt: new Date().toISOString(), mechanisms });
console.log(JSON.stringify({ status: "AGGREGATED_LOCAL_ONLY", mechanismCount: mechanisms.length, networkRequests: 0 }, null, 2));
