#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ""; };
const reportFile = path.resolve(value("report") || "");
const outputFile = path.resolve(value("output") || "");
if (!args.includes("--confirm-reviewed")) { console.error("BLOCKED_EXPORT_REVIEW_REQUIRED: pass --confirm-reviewed after reviewing the local report."); process.exit(1); }
if (!value("report") || !value("output")) { console.error("--report and --output are required."); process.exit(1); }
const validator = path.resolve(path.dirname(new URL(import.meta.url).pathname), "validate-dangoui-gaps.mjs");
const validation = spawnSync(process.execPath, [validator, "--report", reportFile], { encoding: "utf8" });
if (validation.status !== 0) { process.stdout.write(validation.stdout || validation.stderr); process.exit(1); }
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const gaps = report.items.filter(item => item.decision === "capability-gap");
const lines = [
  "# DangoUI capability-gap intake",
  "",
  `- Brand: ${report.source.brand}`,
  `- Platform: ${report.source.platform}`,
  `- DangoUI version: ${report.source.dangouiVersion}`,
  `- Capability gaps: ${gaps.length}`,
  "- Submission: manual review required; this file was generated without network access",
  "",
  ...gaps.flatMap(item => [
    `## ${item.requestedCapability}`,
    "",
    `- Component: ${item.component || "cross-component"}`,
    `- Limitation: ${item.currentLimitation}`,
    `- Workaround: ${item.workaround}`,
    `- Generality: ${item.generality}; frequency: ${item.frequency}; severity: ${item.severity}`,
    `- Proposed layer: ${item.proposedLayer}`,
    `- Rationale: ${item.rationale}`,
    `- Evidence: ${item.evidence.map(entry => `${entry.type}: ${entry.ref}`).join("; ")}`,
    "",
  ]),
];
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ status: "EXPORTED_LOCAL_ISSUE_DRAFT", output: outputFile, gapCount: gaps.length, networkRequests: 0 }, null, 2));
