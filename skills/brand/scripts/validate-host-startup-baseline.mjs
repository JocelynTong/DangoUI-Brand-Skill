#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/i;

export function validateHostStartupBaseline(baseline, {
  root = "",
  startupPage = null,
  startupPageSha256 = "",
  verifyReceiptFiles = false,
} = {}) {
  const errors = [];
  const fail = (code, detail = "") => errors.push(detail ? `${code}:${detail}` : code);

  if (baseline?.schema !== "host-startup-baseline/v1" || baseline?.derivationSource !== "startup-page-scan") {
    fail("HOST_STARTUP_BASELINE_SCHEMA_INVALID");
  }
  if (startupPageSha256 && baseline?.hostStartupPageSha256 !== startupPageSha256) fail("HOST_STARTUP_BASELINE_HASH_MISMATCH");
  for (const key of ["primaryTask", "primaryAction", "pageType"]) {
    if (!String(baseline?.[key] || "").trim()) fail("HOST_STARTUP_PRODUCTIVE_JUDGMENT_INCOMPLETE", key);
  }
  if (!baseline?.productiveFloor?.coreEntry || !array(baseline?.productiveFloor?.businessObjectsVisible).length || baseline?.productiveFloor?.warmReturnState !== "settled") {
    fail("HOST_STARTUP_PRODUCTIVE_FLOOR_INCOMPLETE");
  }

  const resultContent = baseline?.resultContentContract || {};
  if (!["captured-real", "host-schema"].includes(resultContent.mode) || array(resultContent.fields).length < 3 || resultContent.readableRowsRequired !== true || resultContent.anonymousSkeletonsForbidden !== true) {
    fail("HOST_STARTUP_RESULT_CONTENT_CONTRACT_REQUIRED");
  }

  validateInformationDistribution(baseline?.informationDistributionContract, fail);
  validateResultHierarchy(baseline?.resultHierarchyContract, fail);
  validateNavigationShell(baseline?.navigationShellContract, fail);

  const hostContent = baseline?.hostContentContract || {};
  if (hostContent.derivationSource !== "startup-page-source-and-render" || hostContent.userInputRequired !== false || hostContent.noCandidateFallback !== "productive-ui") {
    fail("HOST_STARTUP_CONTENT_CONTRACT_REQUIRED");
  }
  const candidateIds = new Set();
  for (const candidate of array(hostContent.visualCandidates)) {
    validateCandidate(candidate, {
      fail,
      candidateIds,
      root,
      startupPage,
      baseline,
      verifyReceiptFiles,
    });
  }

  const maxFirstViewportRatio = Number(baseline?.expressiveOpportunity?.maxFirstViewportRatio);
  if (!baseline?.expressiveOpportunity || typeof baseline.expressiveOpportunity.heroEligible !== "boolean" || !String(baseline.expressiveOpportunity.reason || "").trim() || !positive(maxFirstViewportRatio) || maxFirstViewportRatio > 0.5) {
    fail("HOST_STARTUP_EXPRESSIVE_OPPORTUNITY_REQUIRED");
  }

  const communication = baseline?.communicationIntent || {};
  if (communication.framework !== "hierarchy-utility-style/v1"
    || !String(communication.hierarchy?.primaryAttention || "").trim()
    || !array(communication.hierarchy?.informativeContent).length
    || !String(communication.hierarchy?.efficiencyConstraint || "").trim()
    || !String(communication.utility?.mainFunction || "").trim()
    || !String(communication.utility?.obviousAction || "").trim()
    || !String(communication.utility?.conventionConstraint || "").trim()
    || !String(communication.style?.sourceConstraint || "").trim()
    || communication.style?.evaluationMode !== "first-impression-comparison-after-product-safety-pass") {
    fail("HOST_STARTUP_COMMUNICATION_INTENT_REQUIRED");
  }

  if (startupPage) validateStartupSource(startupPage, { root, fail });

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function validateNavigationShell(contract, fail) {
  if (!contract || contract.derivationSource !== "startup-page-source-analysis" || !["required", "absent"].includes(contract.mode) || !Array.isArray(contract.items) || !Array.isArray(contract.allowedTreatments) || !contract.allowedTreatments.includes("custom-immersive") || String(contract.continuityPolicy || "").trim().length < 24) {
    fail("HOST_NAVIGATION_SHELL_CONTRACT_REQUIRED");
    return;
  }
  const ids = new Set();
  for (const item of contract.items) {
    if (!item?.id || ids.has(item.id) || !["primary-tab", "account-entry", "brand-switcher", "navigation-entry"].includes(item.role) || !String(item.label || "").trim() || !String(item.sourceLocator || "").trim() || item.requiredInDesignPreview !== true) {
      fail("HOST_NAVIGATION_SHELL_ITEM_INVALID", item?.id || "missing");
    }
    if (item?.id) ids.add(item.id);
  }
  if ((contract.mode === "required") !== (contract.items.length > 0)) fail("HOST_NAVIGATION_SHELL_MODE_MISMATCH");
}

function validateCandidate(candidate, { fail, candidateIds, root, startupPage, baseline, verifyReceiptFiles }) {
  const id = candidate?.id || "unknown";
  if (!candidate?.id || candidateIds.has(candidate.id) || !candidate?.hostField || String(candidate?.businessRole || "").trim().length < 8 || !candidate?.sourceLocator || !["ready", "unresolved"].includes(candidate?.readiness)) {
    fail("HOST_STARTUP_CONTENT_CANDIDATE_INVALID", id);
    return;
  }
  candidateIds.add(candidate.id);
  if (!String(candidate.sourceFile || "").trim() || !SHA256.test(String(candidate.sourceSha256 || ""))) fail("HOST_CONTENT_SOURCE_HASH_REQUIRED", id);
  if (startupPage) validateCandidateSource(candidate, { root, startupPage, fail, verifyFile: verifyReceiptFiles });

  const measurement = candidate.measurement || {};
  if (!["measured", "unresolved"].includes(measurement.status) || String(measurement.source || "").trim().length < 8) {
    fail("HOST_CONTENT_MEASUREMENT_STATUS_REQUIRED", id);
  }
  if (candidate.readiness === "ready") {
    if (measurement.status !== "measured") fail("HOST_CONTENT_READY_WITHOUT_MEASUREMENT", id);
    const source = candidate.sourceSize || {};
    const current = candidate.currentCssSize || {};
    if (![source.width, source.height, current.width, current.height, candidate.minimumReadableCssPx].every(positive)) {
      fail("HOST_STARTUP_CONTENT_CANDIDATE_GEOMETRY_REQUIRED", id);
    }
    if (!measurement.receiptPath || !SHA256.test(String(measurement.receiptSha256 || "")) || !String(measurement.selector || "").trim()) {
      fail("HOST_CONTENT_MEASUREMENT_RECEIPT_REQUIRED", id);
    } else if (verifyReceiptFiles) {
      validateMeasurementReceipt(candidate, measurement, { root, baseline, fail });
    }
  } else if (measurement.status !== "unresolved" || String(measurement.reason || "").trim().length < 12) {
    fail("HOST_CONTENT_UNRESOLVED_REASON_REQUIRED", id);
  }
}

function validateMeasurementReceipt(candidate, measurement, { root, baseline, fail }) {
  const id = candidate.id;
  const rootPath = path.resolve(root || ".");
  const receiptFile = path.resolve(rootPath, measurement.receiptPath);
  if (receiptFile !== rootPath && !receiptFile.startsWith(`${rootPath}${path.sep}`)) {
    fail("HOST_CONTENT_MEASUREMENT_PATH_ESCAPE", id);
    return;
  }
  if (!fs.existsSync(receiptFile) || !fs.statSync(receiptFile).isFile()) {
    fail("HOST_CONTENT_MEASUREMENT_RECEIPT_MISSING", id);
    return;
  }
  if (sha256File(receiptFile) !== measurement.receiptSha256) {
    fail("HOST_CONTENT_MEASUREMENT_RECEIPT_HASH_MISMATCH", id);
    return;
  }
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8")); }
  catch { fail("HOST_CONTENT_MEASUREMENT_RECEIPT_INVALID", id); return; }
  if (receipt?.schema !== "host-startup-measurements/v1" || receipt?.status !== "measured" || receipt?.hostStartupPageSha256 !== baseline.hostStartupPageSha256 || !positive(receipt?.viewport?.width) || !positive(receipt?.viewport?.height) || !String(receipt?.state || "").trim()) {
    fail("HOST_CONTENT_MEASUREMENT_RECEIPT_INVALID", id);
    return;
  }
  const observed = array(receipt.candidates).find((item) => item?.id === id);
  if (!observed || observed.selector !== measurement.selector || observed.sourceFile !== candidate.sourceFile || observed.sourceLocator !== candidate.sourceLocator || observed.sourceSha256 !== candidate.sourceSha256) {
    fail("HOST_CONTENT_MEASUREMENT_BINDING_MISMATCH", id);
    return;
  }
  if (!sameSize(observed.sourceSize, candidate.sourceSize) || !sameSize(observed.currentCssSize, candidate.currentCssSize)) {
    fail("HOST_CONTENT_MEASUREMENT_GEOMETRY_MISMATCH", id);
  }
}

function validateCandidateSource(candidate, { root, startupPage, fail, verifyFile }) {
  const id = candidate.id;
  if (candidate.sourceFile === startupPage.sourceFile && candidate.sourceSha256 !== startupPage.sourceSha256) {
    fail("HOST_CONTENT_SOURCE_HASH_MISMATCH", id);
    return;
  }
  if (!verifyFile || !root) return;
  const hostRoot = path.isAbsolute(startupPage.hostRoot || "")
    ? startupPage.hostRoot
    : path.resolve(root, startupPage.hostRoot || ".");
  const sourceFile = path.resolve(hostRoot, candidate.sourceFile);
  if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) fail("HOST_CONTENT_SOURCE_FILE_UNREADABLE", id);
  else if (sha256File(sourceFile) !== candidate.sourceSha256) fail("HOST_CONTENT_SOURCE_HASH_MISMATCH", id);
}

function validateInformationDistribution(contract, fail) {
  if (!contract || String(contract.model || "").trim().length < 8) {
    fail("HOST_INFORMATION_DISTRIBUTION_MODEL_REQUIRED");
    return;
  }
  const preview = contract.previewUnit || {};
  if (!array(preview.requiredDecisionFields).length || typeof preview.openRequiredForBasicJudgment !== "boolean") {
    fail("HOST_INFORMATION_DISTRIBUTION_PREVIEW_REQUIRED");
  }
  if (array(contract.scanOrder).length < 2 || String(contract.comparisonBehavior || "").trim().length < 12) {
    fail("HOST_INFORMATION_DISTRIBUTION_BEHAVIOR_REQUIRED");
  }
  if (!array(contract.forbiddenMetaphorSubstitutions).length || contract.forbiddenMetaphorSubstitutions.some((item) => String(item || "").trim().length < 3)) {
    fail("HOST_INFORMATION_DISTRIBUTION_FORBIDS_REQUIRED");
  }
}

function validateResultHierarchy(contract, fail) {
  if (!contract || contract.derivationSource !== "startup-page-source-analysis" || contract.defaultRelationship !== "peer" || typeof contract.differentiationAllowed !== "boolean") {
    fail("HOST_RESULT_HIERARCHY_CONTRACT_REQUIRED");
    return;
  }
  const evidence = array(contract.evidence);
  const ids = new Set();
  for (const item of evidence) {
    if (!item?.id || ids.has(item.id) || !["featured-result", "ranking", "selected-result"].includes(item.kind) || !String(item.signal || "").trim() || item.source !== "startup-page-source" || !String(item.groupId || "").trim() || item.locator !== `collection:${item.groupId}` || !Number.isInteger(item.sourceRange?.line) || item.sourceRange.line < 1) fail("HOST_RESULT_HIERARCHY_EVIDENCE_INVALID");
    if (item?.id) ids.add(item.id);
  }
  if (contract.differentiationAllowed !== (evidence.length > 0)) {
    fail("HOST_RESULT_HIERARCHY_EVIDENCE_MISMATCH");
  }
  const forbidden = array(contract.forbiddenWithoutEvidence);
  if (!forbidden.includes("featured-result") || !forbidden.includes("ranking") || !forbidden.includes("recommendation") || !forbidden.includes("unequal-preview-scale")) {
    fail("HOST_RESULT_HIERARCHY_FORBIDS_REQUIRED");
  }
}

function validateStartupSource(startupPage, { root, fail }) {
  if (startupPage.schema !== "host-startup-page/v1" || startupPage.scope !== "startup-page-only" || !startupPage.sourceFile || !SHA256.test(String(startupPage.sourceSha256 || ""))) {
    fail("HOST_STARTUP_PAGE_INCOMPLETE");
    return;
  }
  if (!root) return;
  const hostRoot = path.isAbsolute(startupPage.hostRoot || "")
    ? startupPage.hostRoot
    : path.resolve(root, startupPage.hostRoot || ".");
  const sourceFile = path.resolve(hostRoot, startupPage.sourceFile);
  if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) fail("HOST_STARTUP_SOURCE_UNREADABLE");
  else if (sha256File(sourceFile) !== startupPage.sourceSha256) fail("HOST_STARTUP_SOURCE_HASH_MISMATCH");
}

function sameSize(a, b) {
  return positive(a?.width) && positive(a?.height) && Number(a.width) === Number(b?.width) && Number(a.height) === Number(b?.height);
}

function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function array(value) { return Array.isArray(value) ? value : []; }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const option = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; };
  try {
    const file = option("--file");
    const startupFile = option("--startup-page");
    const root = path.resolve(option("--root") || process.cwd());
    if (!file || !fs.existsSync(file)) throw new Error("HOST_STARTUP_BASELINE_FILE_REQUIRED");
    const startupPage = startupFile && fs.existsSync(startupFile) ? JSON.parse(fs.readFileSync(startupFile, "utf8")) : null;
    const result = validateHostStartupBaseline(JSON.parse(fs.readFileSync(file, "utf8")), {
      root,
      startupPage,
      startupPageSha256: startupFile ? sha256File(startupFile) : "",
      verifyReceiptFiles: true,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, errors: [error.message] }, null, 2)}\n`);
    process.exit(1);
  }
}
