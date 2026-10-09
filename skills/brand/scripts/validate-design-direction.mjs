#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const brand = value("--brand");
const input = value("--file") || (brand ? `migrations/${brand}/design-direction.json` : "");
if (!input) {
  console.error("Usage: validate-design-direction.mjs --brand <brand> [--file <design-direction.json>]");
  process.exit(2);
}

const file = path.resolve(input);
const failures = [];
const boundInputs = {};
const fail = (code, message, context = {}) => failures.push({ code, message, ...context });
let direction;
try {
  direction = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ ok: false, failures: [{ code: "DESIGN_DIRECTION_UNREADABLE", message: error.message }] }, null, 2));
  process.exit(1);
}

if (!direction.designObjective?.trim()) fail("DESIGN_OBJECTIVE_MISSING", "designObjective is required.");
if (direction.decisionStatus !== "approved") fail("DESIGN_DIRECTION_NOT_APPROVED", "decisionStatus must be approved before implementation.");
const bindings = direction.inputBindings || {};
for (const key of ["goal", "evidence", "intent", "patterns"]) {
  const binding = bindings[key];
  if (!binding?.path || !/^[a-f0-9]{64}$/i.test(binding?.sha256 || "")) {
    fail("DESIGN_INPUT_BINDING_MISSING", `inputBindings.${key} requires path and SHA-256.`, { input: key });
    continue;
  }
  const candidates = [path.resolve(binding.path), path.resolve(path.dirname(file), binding.path)];
  const bindingFile = candidates.find((candidate) => fs.existsSync(candidate));
  if (!bindingFile) {
    fail("DESIGN_INPUT_FILE_MISSING", `inputBindings.${key}.path does not exist.`, { input: key, path: binding.path });
    continue;
  }
  const actualSha256 = crypto.createHash("sha256").update(fs.readFileSync(bindingFile)).digest("hex");
  if (actualSha256 !== binding.sha256.toLowerCase()) {
    fail("DESIGN_INPUT_HASH_MISMATCH", `inputBindings.${key} is stale; the bound SHA-256 does not match the current file.`, {
      input: key,
      path: binding.path,
      expectedSha256: binding.sha256,
      actualSha256
    });
  } else {
    try { boundInputs[key] = JSON.parse(fs.readFileSync(bindingFile, "utf8")); } catch { /* Non-learning legacy inputs remain supported. */ }
  }
}
// A local source calibration may be useful, but is not permission to spend a
// formal learning implementation on a known-unavailable generative proof.
if (args.includes("--require-learning-proof")) {
  const plan = direction.generativePlan;
  const patterns = Array.isArray(boundInputs.patterns?.patterns) ? boundInputs.patterns.patterns : [];
  const byId = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  if (!plan || plan.status !== "approved" || !plan.reviewer || !plan.scope ||
      plan.variationKind !== "structure" || !String(plan.variedStructure || "").trim() ||
      !String(plan.proofArtifactPlan || "").trim()) {
    fail("LEARNING_GENERATIVE_SCOPE_UNRESOLVED", "Formal learning Demo requires a Director-approved structure variation plan, not only source calibration or state inspection.");
  }
  const ids = Array.isArray(plan?.invariantPatternIds) ? plan.invariantPatternIds : [];
  if (!ids.length || ids.some((id) => !byId.has(id) || byId.get(id).status !== "approved")) {
    fail("LEARNING_INVARIANT_PATTERN_UNPROVEN", "Generative invariants must reference current hash-bound approved Pattern IDs.");
  }
  const transforms = Array.isArray(plan?.allowedTransformationRefs) ? plan.allowedTransformationRefs : [];
  if (!transforms.length || transforms.some((item) => !ids.includes(item.patternId) ||
      !byId.get(item.patternId)?.allowedTransformations?.includes(item.transformation))) {
    fail("LEARNING_TRANSFORMATION_UNAPPROVED", "Planned variations must reference transformations actually allowed by the bound Patterns; do not invent permission in the direction document.");
  }
}
const priorities = direction.visualPriorityOrder;
if (!Array.isArray(priorities) || priorities.length < 4) fail("VISUAL_PRIORITY_ORDER_MISSING", "Declare at least four ordered visual priorities.");
else {
  const first = String(priorities[0]).toLowerCase();
  if (!/(visible|visibility|legib|可见|可读|contrast)/.test(first)) fail("VISIBILITY_NOT_FIRST_PRIORITY", "Visibility or legibility must be the first visual priority.");
}

const allowed = new Set(["uniform-scale", "art-directed-crop", "responsive-reflow", "independent-scale", "structural-substitution", "motion-degradation"]);
const sections = Array.isArray(direction.sections) ? direction.sections : [];
if (!sections.length) fail("DESIGN_SECTIONS_MISSING", "At least one design section is required.");
for (const section of sections) {
  const id = section.id || "unnamed";
  if (!section.firstImpressionGoal?.trim()) fail("FIRST_IMPRESSION_GOAL_MISSING", "Section needs firstImpressionGoal.", { section: id });
  for (const field of ["mustPreserve", "mayChange", "mustNotDo"]) {
    if (!Array.isArray(section[field]) || !section[field].length) fail(`DESIGN_${field.toUpperCase()}_MISSING`, `${field} must be non-empty.`, { section: id });
  }
}

const matrix = Array.isArray(direction.responsiveStrategyMatrix) ? direction.responsiveStrategyMatrix : [];
if (!matrix.length) fail("RESPONSIVE_STRATEGY_MATRIX_MISSING", "Declare element-level responsive strategies.");
const highSalience = Array.isArray(direction.highSalienceElements) ? direction.highSalienceElements : [];
if (!highSalience.length) fail("HIGH_SALIENCE_ELEMENTS_MISSING", "Declare all high-salience elements before choosing responsive strategies.");
const matrixElements = new Set(matrix.map((item) => item.element));
for (const element of highSalience) if (!matrixElements.has(element)) fail("HIGH_SALIENCE_STRATEGY_MISSING", "Every high-salience element needs a responsive strategy.", { element });
for (const item of matrix) {
  const element = item.element || "unnamed";
  if (!allowed.has(item.strategy)) fail("RESPONSIVE_STRATEGY_INVALID", `Unsupported strategy: ${item.strategy || "missing"}.`, { element });
  if (!Array.isArray(item.evidenceRefs) || !item.evidenceRefs.length) fail("RESPONSIVE_STRATEGY_EVIDENCE_MISSING", "Each strategy needs evidenceRefs.", { element });
  if (!Array.isArray(item.viewports) || !item.viewports.length) fail("RESPONSIVE_STRATEGY_VIEWPORT_MISSING", "Each strategy needs viewports.", { element });
  if (!Array.isArray(item.mustPreserve) || !item.mustPreserve.length) fail("RESPONSIVE_STRATEGY_INVARIANT_MISSING", "Each strategy needs mustPreserve.", { element });
  if (["text", "control"].includes(item.elementType) && !item.minimumReadableSize) fail("READABILITY_BOUNDARY_MISSING", "Text and controls need a minimumReadableSize.", { element });
}

const proof = direction.proofSurfacePlan;
if (!proof?.desktopCanvas || !proof?.mobileCanvas || !proof?.inspectorPolicy || !proof?.sourceComparison) {
  fail("PROOF_SURFACE_PLAN_INCOMPLETE", "proofSurfacePlan must separate desktopCanvas, mobileCanvas, inspectorPolicy and sourceComparison.");
}

console.log(JSON.stringify({ ok: failures.length === 0, file, sections: sections.length, strategies: matrix.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
