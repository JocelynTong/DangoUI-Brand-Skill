import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const lifecycle = ["reported-local", "reviewed-local", "submitted", "triaged", "project-candidate", "cross-case-candidate", "validated-common", "scheduled", "implemented", "regression-verified", "resolved"];
export const fingerprintFields = ["skillId", "workflow", "workflowNode", "category", "abstractMechanismCode", "frameworkClass", "platformClass"];
export const reportFields = [...fingerprintFields, "summary", "reproduction", "gate", "falsePositiveAssessment", "severity", "contractRef"];
export const defaultOutbox = () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skill-feedback");
export const sha = value => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
export const parseArgs = argv => Object.fromEntries(argv.flatMap((arg, index) => arg.startsWith("--") ? [[arg.slice(2), argv[index + 1]?.startsWith("--") ? true : argv[index + 1] ?? true]] : []));
export function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
export function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); }
export function fail(code, detail = "") { console.error(`${code}${detail ? `: ${detail}` : ""}`); process.exit(1); }
export function fingerprint(value) { return sha(fingerprintFields.map(key => `${key}=${value[key] || ""}`).join("\n")); }
export function ensureExternalOutbox(outbox, host = process.cwd()) {
  const relative = path.relative(path.resolve(host), path.resolve(outbox));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) fail("OUTBOX_INSIDE_HOST_REPOSITORY");
}

const forbiddenValues = [
  [/(?:^|[\s"'(])(?:\/(?:Users|home|private|var|opt|srv|Volumes)\/[^\s"')]+|[A-Za-z]:\\[^\s"')]+)/, "ABSOLUTE_PATH"],
  [/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?\b/i, "PRIVATE_URL"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, "EMAIL"],
  [/(?:\+?86[- ]?)?1[3-9]\d{9}\b/, "PHONE"],
  [/(?:console\.(?:log|error)|stack trace|at \w+ \([^)]*:\d+:\d+\)|function\s+\w+\s*\(|=>\s*\{|(?:const|let|var)\s+\w+\s*=)/i, "SOURCE_OR_LOG"],
  [/[\u4e00-\u9fff]{2,4}(?:先生|女士|同学|老师)/, "PERSON_NAME"]
];
export function validateReport(report) {
  const errors = [];
  const allowed = new Set(["schemaVersion", "caseId", ...reportFields, "fingerprint", "independenceHash", "lifecycle", "occurrenceCount", "createdAt"]);
  for (const key of Object.keys(report)) if (!allowed.has(key)) errors.push(`FORBIDDEN_FIELD:${key}`);
  for (const key of [...reportFields, "fingerprint", "independenceHash"]) if (!report[key]) errors.push(`MISSING_FIELD:${key}`);
  if (report.fingerprint !== fingerprint(report)) errors.push("FINGERPRINT_MISMATCH");
  if (!/^sha256:[a-f0-9]{64}$/.test(report.independenceHash || "")) errors.push("INVALID_INDEPENDENCE_HASH");
  if (report.lifecycle !== "reviewed-local") errors.push("INVALID_LOCAL_LIFECYCLE");
  const searchable = Object.entries(report).filter(([key]) => !["fingerprint", "independenceHash", "caseId"].includes(key));
  for (const [key, value] of searchable) for (const [pattern, code] of forbiddenValues) if (pattern.test(String(value))) errors.push(`${code}:${key}`);
  return [...new Set(errors)];
}

export function redactSelected(selected, sensitiveTerms = []) {
  const terms = sensitiveTerms.map(String).filter(term => term.trim().length >= 2).sort((a, b) => b.length - a.length);
  return Object.fromEntries(Object.entries(selected).map(([key, value]) => {
    if (typeof value !== "string") return [key, value];
    let clean = value;
    for (const term of terms) clean = clean.split(term).join("[redacted]");
    return [key, clean];
  }));
}

export function issueBody(report) {
  return [
    `<!-- brand-skill-fingerprint:${report.fingerprint} -->`,
    "# Brand Skill usage mechanism", "",
    `- Workflow: ${report.workflow} / ${report.workflowNode}`,
    `- Category: ${report.category}`,
    `- Mechanism: ${report.abstractMechanismCode}`,
    `- Environment class: ${report.frameworkClass} / ${report.platformClass}`,
    `- Severity: ${report.severity}`, "",
    "## Sanitized summary", "", report.summary, "",
    "## Stable reproduction", "", report.reproduction, "",
    "## Executable gate", "", report.gate, "",
    "## False-positive assessment", "", report.falsePositiveAssessment, "",
    `Occurrence count: ${report.occurrenceCount}`,
    "",
    "This issue contains an allowlisted, locally reviewed summary. It contains no project code, path, page content, logs, screenshot, or attachment."
  ].join("\n");
}
