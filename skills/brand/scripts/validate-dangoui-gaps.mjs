#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const at = args.indexOf("--report");
const reportFile = at >= 0 ? path.resolve(args[at + 1] || "") : "";
const blockers = [];
const add = (code, message, itemId) => blockers.push({ code, message, ...(itemId ? { itemId } : {}) });
const decisions = new Set(["capability-gap", "correct-boundary"]);
const severities = new Set(["blocker", "major", "minor", "info", "none"]);
const layers = new Set(["component", "prop", "slot", "token", "recipe", "documentation", "integration-contract", "correct-boundary"]);

if (!reportFile || !fs.existsSync(reportFile)) add("DANGOUI_GAP_REPORT_MISSING", "Pass an existing --report file.");
else {
  const raw = fs.readFileSync(reportFile, "utf8");
  let report;
  try { report = JSON.parse(raw); } catch (error) { add("DANGOUI_GAP_REPORT_INVALID_JSON", error.message); }
  if (report) {
    if (report.schema !== "dangoui-capability-gaps/v1") add("DANGOUI_GAP_SCHEMA_INVALID", "Expected dangoui-capability-gaps/v1.");
    if (report.privacy?.networkSubmission !== "disabled") add("DANGOUI_GAP_IMPLICIT_TELEMETRY", "MVP reports must keep networkSubmission disabled.");
    const unsafePatterns = [/file:\/\//i, /\/Users\//, /[A-Za-z]:\\Users\\/, /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/i];
    for (const pattern of unsafePatterns) if (pattern.test(raw)) add("DANGOUI_GAP_SENSITIVE_REFERENCE", `Report contains a blocked local/private reference matching ${pattern}.`);
    const items = Array.isArray(report.items) ? report.items : [];
    if (!Array.isArray(report.items)) add("DANGOUI_GAP_ITEMS_INVALID", "items must be an array.");
    const fingerprints = new Set();
    for (const item of items) {
      for (const field of ["id", "fingerprint", "origin", "requestedCapability", "currentLimitation", "workaround", "rationale", "generality", "severity", "proposedLayer", "owner", "lifecycle"]) if (item[field] === undefined || item[field] === "") add("DANGOUI_GAP_FIELD_MISSING", `${field} is required.`, item.id);
      if (!decisions.has(item.decision)) add("DANGOUI_GAP_UNCLASSIFIED", `decision must be capability-gap or correct-boundary; found ${item.decision}.`, item.id);
      if (!severities.has(item.severity)) add("DANGOUI_GAP_SEVERITY_INVALID", `Unsupported severity ${item.severity}.`, item.id);
      if (!layers.has(item.proposedLayer)) add("DANGOUI_GAP_LAYER_INVALID", `Unsupported proposedLayer ${item.proposedLayer}.`, item.id);
      if (!Number.isInteger(item.frequency) || item.frequency < 1) add("DANGOUI_GAP_FREQUENCY_INVALID", "frequency must be a positive integer.", item.id);
      if (!Array.isArray(item.evidence) || !item.evidence.length || item.evidence.some(entry => !entry.type || !entry.ref)) add("DANGOUI_GAP_EVIDENCE_MISSING", "At least one typed evidence reference is required.", item.id);
      if (fingerprints.has(item.fingerprint)) add("DANGOUI_GAP_DUPLICATE", `Duplicate fingerprint ${item.fingerprint}.`, item.id); else fingerprints.add(item.fingerprint);
    }
    const count = decision => items.filter(item => item.decision === decision).length;
    const expected = { total: items.length, capabilityGaps: count("capability-gap"), correctBoundaries: count("correct-boundary"), unclassified: items.filter(item => !decisions.has(item.decision)).length };
    for (const [key, actual] of Object.entries(expected)) if (report.summary?.[key] !== actual) add("DANGOUI_GAP_SUMMARY_DRIFT", `${key} must be ${actual}; found ${report.summary?.[key]}.`);
    if (report.discovery?.total !== items.length) add("DANGOUI_GAP_DISCOVERY_DRIFT", "discovery.total must equal items.length.");
    const sourceTotal = [report.discovery?.componentMappingCandidates, report.discovery?.tokenClosureExceptions, report.discovery?.runtimeSeeds].reduce((sum, value) => sum + (Number.isInteger(value) ? value : 0), 0);
    if (sourceTotal !== items.length) add("DANGOUI_GAP_DISCOVERY_DRIFT", `Discovery source counts total ${sourceTotal}; expected ${items.length}.`);
    if ((report.discovery?.unusedDecisionIds || []).length) add("DANGOUI_GAP_ORPHAN_DECISION", `Unused decisions: ${report.discovery.unusedDecisionIds.join(", ")}.`);
  }
}
console.log(JSON.stringify({ status: blockers.length ? "BLOCKED_DANGOUI_GAPS" : "PASS_DANGOUI_GAPS", report: reportFile, blockers }, null, 2));
if (blockers.length) process.exit(1);
