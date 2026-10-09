#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateHostStartupBaseline } from "./validate-host-startup-baseline.mjs";

const REQUIRED_DESIGN_HOST_QUESTIONS = [
  "expressive-productive-allocation-question",
  "host-generation-choice",
  "host-generation-brief",
  "host-reconstruction-risk",
  "host-content-scene-integration",
  "visual-authority",
];

export function freezeDesignKnowledge({ skillRoot, root, brand }) {
  const migrationDir = path.join(root, "migrations", brand);
  const baselineFile = path.join(migrationDir, "host-startup-baseline.json");
  const startupPageFile = path.join(migrationDir, "host-startup-page.json");
  const outputFile = path.join(migrationDir, "design-knowledge-bundle.json");
  const queryScript = path.join(skillRoot, "scripts", "query-design-knowledge.mjs");
  if (!fs.existsSync(baselineFile)) throw new Error("DESIGN_KNOWLEDGE_HOST_BASELINE_REQUIRED");
  if (!fs.existsSync(startupPageFile)) throw new Error("DESIGN_KNOWLEDGE_HOST_STARTUP_PAGE_REQUIRED");
  if (!fs.existsSync(queryScript)) throw new Error("DESIGN_KNOWLEDGE_QUERY_SCRIPT_REQUIRED");

  const baseline = readJson(baselineFile);
  const startupPage = readJson(startupPageFile);
  const baselineValidation = validateHostStartupBaseline(baseline, {
    root,
    startupPage,
    startupPageSha256: sha256File(startupPageFile),
    verifyReceiptFiles: true,
  });
  if (!baselineValidation.ok) throw new Error(`DESIGN_KNOWLEDGE_HOST_BASELINE_INVALID: ${baselineValidation.errors.join(", ")}`);
  const stageQuestions = query(queryScript, ["stage", "design-host"]);
  const available = new Map(stageQuestions.map((item) => [item.id, item]));
  const missing = REQUIRED_DESIGN_HOST_QUESTIONS.filter((id) => !available.has(id));
  if (missing.length) throw new Error(`DESIGN_KNOWLEDGE_REQUIRED_QUESTIONS_MISSING: ${missing.join(", ")}`);

  const questions = REQUIRED_DESIGN_HOST_QUESTIONS.map((id) => {
    const basis = query(queryScript, ["basis", id, "--context=whole-design"]);
    return {
      id,
      title: available.get(id).title,
      status: available.get(id).status,
      basisStatus: basis.status,
      items: basis.items,
      sourceRefs: basis.sourceRefs,
      caseNotes: basis.caseNotes || [],
      fullSourceRefs: (basis.fullSources || []).map((entry) => refForRecord(entry)).filter(Boolean),
      fullCaseRefs: (basis.fullCases || []).map((entry) => `case:${entry.id}`),
    };
  });
  const allowedRefs = new Set();
  for (const question of questions) {
    allowedRefs.add(`question:${question.id}`);
    for (const ref of question.sourceRefs || []) allowedRefs.add(`${ref.kind}:${ref.id}`);
    for (const note of question.caseNotes || []) allowedRefs.add(`case:${note.caseId}`);
    for (const ref of question.fullSourceRefs || []) allowedRefs.add(ref);
    for (const ref of question.fullCaseRefs || []) allowedRefs.add(ref);
  }

  const knowledgeRoot = resolveKnowledgeRoot(skillRoot);
  const catalogFile = path.join(knowledgeRoot, "knowledge", "v0.1", "index.json");
  const catalog = readJson(catalogFile);
  const entries = [...allowedRefs].sort().map((ref) => resolveEntry(catalog, knowledgeRoot, ref));
  const bundle = {
    schema: "design-knowledge-bundle/v1",
    stage: "design-host",
    brand,
    generatedBy: "query-design-knowledge.mjs",
    queryPlan: {
      stage: "design-host",
      context: "whole-design",
      questionIds: REQUIRED_DESIGN_HOST_QUESTIONS,
    },
    catalog: { path: relativeWithin(knowledgeRoot, catalogFile), sha256: sha256File(catalogFile) },
    hostContext: {
      baselinePath: path.relative(root, baselineFile),
      baselineSha256: sha256File(baselineFile),
      primaryTask: baseline.primaryTask,
      primaryAction: baseline.primaryAction,
      pageType: baseline.pageType,
      productiveFloor: baseline.productiveFloor,
      informationDistributionContract: baseline.informationDistributionContract,
      resultHierarchyContract: baseline.resultHierarchyContract,
      hostContentContract: baseline.hostContentContract,
      expressiveOpportunity: baseline.expressiveOpportunity,
      communicationIntent: baseline.communicationIntent,
    },
    questions,
    entries,
  };
  fs.writeFileSync(outputFile, `${JSON.stringify(bundle, null, 2)}\n`);
  return { file: outputFile, bundle, sha256: sha256File(outputFile), knowledgeRoot };
}

function query(script, args) {
  const stdout = execFileSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return JSON.parse(stdout);
}

function refForRecord(record) {
  if (!record?.id) return null;
  const kind = record.kind || record.type || inferKind(record);
  return kind ? `${kind}:${record.id}` : null;
}

function inferKind(record) {
  if (record.decisionSequence) return "policy";
  if (record.decisionTrace) return "case";
  if (record.ownerRole) return "method";
  if (record.originCaseIds) return "rule";
  return null;
}

function resolveEntry(catalog, knowledgeRoot, ref) {
  const split = ref.indexOf(":");
  if (split < 1) throw new Error(`DESIGN_KNOWLEDGE_REF_INVALID: ${ref}`);
  const kind = ref.slice(0, split);
  const id = ref.slice(split + 1);
  const collection = ({ question: "questions", method: "methods", rule: "rules", policy: "policies", pattern: "patterns", decision: "decisions", case: "cases" })[kind];
  const record = collection && (catalog[collection] || []).find((item) => item.id === id);
  if (!record) throw new Error(`DESIGN_KNOWLEDGE_REF_UNKNOWN: ${ref}`);
  const recordFile = path.join(knowledgeRoot, record.path);
  const guideFile = path.join(knowledgeRoot, record.guide);
  if (!fs.existsSync(recordFile) || !fs.existsSync(guideFile)) throw new Error(`DESIGN_KNOWLEDGE_REF_SOURCE_MISSING: ${ref}`);
  return {
    ref,
    kind,
    id,
    recordPath: relativeWithin(knowledgeRoot, recordFile),
    recordSha256: sha256File(recordFile),
    guidePath: relativeWithin(knowledgeRoot, guideFile),
    guideSha256: sha256File(guideFile),
  };
}

function resolveKnowledgeRoot(skillRoot) {
  const bundled = path.join(skillRoot, "knowledge-runtime");
  return fs.existsSync(path.join(bundled, "knowledge", "v0.1", "index.json"))
    ? bundled
    : path.resolve(skillRoot, "../..");
}

function relativeWithin(root, file) {
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("DESIGN_KNOWLEDGE_PATH_ESCAPE");
  return relative.replaceAll(path.sep, "/");
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = process.argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; };
  const skillRoot = path.resolve(option("--skill-root") || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
  const root = path.resolve(option("--root") || process.cwd());
  const brand = option("--brand");
  if (!brand) { console.error("Usage: freeze-design-knowledge.mjs --root <host> --brand <brand> [--skill-root <skill>]"); process.exit(2); }
  try {
    const result = freezeDesignKnowledge({ skillRoot, root, brand });
    process.stdout.write(`${JSON.stringify({ ok: true, file: path.relative(root, result.file), sha256: result.sha256, questionIds: result.bundle.queryPlan.questionIds }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
