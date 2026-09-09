#!/usr/bin/env node
import fs from "node:fs";

const argv = process.argv.slice(2);
const value = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const matrixPath = value("--matrix");
if (!matrixPath) {
  console.error(JSON.stringify({ ok: false, failures: [{ code: "MATRIX_INPUT_MISSING", message: "Pass --matrix <host-coverage-matrix.json>." }] }, null, 2));
  process.exit(2);
}

let matrix;
try {
  matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ ok: false, failures: [{ code: "MATRIX_INPUT_UNREADABLE", message: error.message }] }, null, 2));
  process.exit(2);
}

const failures = [];
const fail = (code, message, details = {}) => failures.push({ code, message, ...details });
const cells = Array.isArray(matrix.cells) ? matrix.cells : [];
if (matrix.schema !== "host-coverage-matrix/v1") fail("MATRIX_SCHEMA_INVALID", "schema must be host-coverage-matrix/v1.");
if (!matrix.defaultEntry) fail("DEFAULT_ENTRY_UNCOVERED", "defaultEntry is required.");
if (!cells.length) fail("COVERAGE_CELL_MISSING", "cells must contain the frozen host scope.");

const required = ["id", "route", "branch", "state", "componentFamily", "viewport", "decision", "selector", "visualEvidence", "verdict"];
const ids = new Set();
for (const cell of cells) {
  for (const field of required) if (cell[field] === undefined || cell[field] === null || cell[field] === "") fail("COVERAGE_CELL_MISSING", `Cell ${cell.id || "<unknown>"} lacks ${field}.`, { cellId: cell.id || null, field });
  if (ids.has(cell.id)) fail("COVERAGE_CELL_DUPLICATE", `Cell id ${cell.id} is duplicated.`, { cellId: cell.id });
  ids.add(cell.id);
  if (!["APPLY", "KEEP", "DEFER"].includes(cell.decision)) fail("COVERAGE_DECISION_INVALID", `Cell ${cell.id} has invalid decision.`, { cellId: cell.id });
  if (cell.decision === "KEEP" && (!cell.rationale || !cell.acceptance)) fail("KEEP_WITHOUT_ACCEPTANCE", `KEEP cell ${cell.id} needs rationale and acceptance.`, { cellId: cell.id });
  if (cell.decision === "DEFER" && (!cell.rationale || !cell.scopeImpact || !cell.owner)) fail("DEFER_WITHOUT_SCOPE_IMPACT", `DEFER cell ${cell.id} needs rationale, scopeImpact and owner.`, { cellId: cell.id });
  if (cell.parentRoute && (!cell.launchedFrom || !cells.some((candidate) => candidate.route === cell.parentRoute))) fail("PARENT_ROUTE_SKIPPED", `Child cell ${cell.id} lacks a covered parent launch path.`, { cellId: cell.id, parentRoute: cell.parentRoute });
  if (cell.interactive) {
    const target = cell.interactionProbe || {};
    if (!target.targetSelector || !target.hitTestOwner || !target.stateBefore || !target.stateAfter || !target.restored) fail("INTERACTION_STATE_UNPROVEN", `Interactive cell ${cell.id} lacks a reversible real-target probe.`, { cellId: cell.id });
    if (Number(target.width) < 44 || Number(target.height) < 44) fail("TOUCH_TARGET_TOO_SMALL", `Interactive cell ${cell.id} is smaller than 44x44 CSS pixels.`, { cellId: cell.id, width: target.width, height: target.height });
  }
  if (cell.typographyProbe?.script === "CJK") {
    const type = cell.typographyProbe;
    if (!/[\u3400-\u9fff]/u.test(type.textSample || "") || !type.computedFontFamily || type.computedFontWeight === undefined || !type.computedFontSize || !type.computedLineHeight || type.computedLetterSpacing === undefined) fail("TYPOGRAPHY_SCRIPT_MISMATCH", `CJK cell ${cell.id} lacks a complete computed typography probe.`, { cellId: cell.id });
    if (type.latinDisplayOnly === true && !type.approvedException) fail("TYPOGRAPHY_SCRIPT_MISMATCH", `CJK cell ${cell.id} resolves only to a Latin display face.`, { cellId: cell.id });
  }
  if (cell.semanticColorProbe && (!cell.semanticColorProbe.businessSemantic || !Array.isArray(cell.semanticColorProbe.allowedRoles) || !Array.isArray(cell.semanticColorProbe.antiScopes))) fail("SEMANTIC_COLOR_ROLE_EXPANDED", `Semantic color cell ${cell.id} lacks business role boundaries.`, { cellId: cell.id });
}

const defaultCovered = cells.some((cell) => cell.route === matrix.defaultEntry && cell.verdict === "PASS");
if (matrix.defaultEntry && !defaultCovered) fail("DEFAULT_ENTRY_UNCOVERED", "At least one PASS cell must cover the default entry.", { defaultEntry: matrix.defaultEntry });

const summaryCells = matrix.coverageSummary?.cells;
if (summaryCells) {
  const actual = {
    total: cells.length,
    inScope: cells.filter((cell) => cell.inScope !== false).length,
    outOfScopeDeferred: cells.filter((cell) => cell.decision === "DEFER" && cell.inScope === false).length,
    pass: cells.filter((cell) => cell.verdict === "PASS").length,
    rework: cells.filter((cell) => cell.verdict === "REWORK").length,
  };
  const declared = {
    total: summaryCells.total,
    inScope: summaryCells.inScope,
    outOfScopeDeferred: summaryCells.outOfScopeDeferred,
    pass: summaryCells.verdicts?.PASS,
    rework: summaryCells.verdicts?.REWORK,
  };
  if (JSON.stringify(actual) !== JSON.stringify(declared)) fail("COVERAGE_SUMMARY_STALE", "coverageSummary.cells must exactly match recomputed matrix cell totals.", { declared, actual });
}

const scope = matrix.completionScope || {};
if (scope.fullHost === "PASS") {
  const incomplete = cells.filter((cell) => cell.verdict !== "PASS" || (cell.decision === "DEFER" && cell.inScope !== false));
  if (incomplete.length || !defaultCovered) fail("FULL_HOST_SCOPE_INCOMPLETE", "fullHost PASS requires every in-scope cell PASS and no in-scope DEFER.", { incompleteCellIds: incomplete.map((cell) => cell.id) });
  if (!Number.isInteger(scope.denominator) || scope.denominator !== cells.filter((cell) => cell.inScope !== false).length || scope.covered !== scope.denominator) fail("FULL_HOST_SCOPE_INCOMPLETE", "fullHost PASS requires exact denominator and covered counts.", { completionScope: scope });
}

const result = { ok: failures.length === 0, type: "host-coverage-matrix-gate", matrix: matrixPath, cellCount: cells.length, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
