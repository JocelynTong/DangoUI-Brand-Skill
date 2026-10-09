#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1] || fallback;
};
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand");
const selection = opt("--selection");
if (!brand || !selection) throw new Error("Usage: freeze-selected-h5-direction.mjs --root <artifact-root> --brand <brand> --selection <direction-id>");

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migration = path.join(root, "migrations", brand);
const optionsFile = path.join(migration, "design-direction-options.json");
const routeFile = path.join(migration, "design-host-route.json");
const baselineFile = path.join(migration, "host-startup-baseline.json");
const evidenceFile = path.join(migration, "brand-evidence.json");
const modFile = path.join(migration, "brand-mod.json");
const options = read(optionsFile);
const route = read(routeFile);
const baseline = read(baselineFile);
const selected = (options.options || []).find((item) => item.id === selection);
if (!selected) throw new Error("SELECTED_H5_DIRECTION_UNKNOWN");
if (route.userDirectionReview?.status !== "approved" || !route.userDirectionReview?.selectedOptionIds?.includes(selection)) throw new Error("EXPLICIT_USER_DIRECTION_APPROVAL_REQUIRED");

const businessScopeFile = path.join(migration, "business-scope.json");
write(businessScopeFile, {
  schema: "host-business-scope/v1",
  source: "frozen-host-startup-baseline",
  baseline: { path: relative(baselineFile), sha256: sha256File(baselineFile) },
  primaryTask: baseline.primaryTask,
  primaryAction: baseline.primaryAction,
  informationDistributionContract: baseline.informationDistributionContract,
  resultContentContract: baseline.resultContentContract,
  resultHierarchyContract: baseline.resultHierarchyContract,
  businessCapabilities: selected.directionContract?.businessCapabilities || selected.directionContract?.layout || [],
});

const decisionFile = path.join(migration, "design-direction-decision.json");
write(decisionFile, {
  schema: "wild-design-decision/v1",
  optionsSha256: sha256File(optionsFile),
  status: "selected",
  selectedOptionId: selection,
  selectedOptionIds: [selection],
  selectionSource: "explicit-user",
  humanExpressiveApproval: "approved",
  selectedAt: new Date().toISOString(),
});

const selectedContractSha256 = hashValue(selected.directionContract);
const selectedVisualChoiceSha256 = hashValue(selected.visualChoiceContract);
const routeDirection = (route.h5Directions?.directions || []).find((item) => item.id === selection);
const previewArtifact = routeDirection?.artifact || selected.previewEvidence?.[0] || null;
if (!previewArtifact?.path || !previewArtifact?.sha256) throw new Error("SELECTED_H5_ARTIFACT_REQUIRED");
const previewFile = path.join(root, previewArtifact.path);
if (!fs.existsSync(previewFile) || sha256File(previewFile) !== previewArtifact.sha256) throw new Error("SELECTED_H5_ARTIFACT_HASH_MISMATCH");
const qaRelative = route.h5QA?.visualQAPath || route.h5QA?.auditPath;
const qaFile = qaRelative ? path.join(root, qaRelative) : null;
if (route.h5QA?.status !== "pass" || !qaFile || !fs.existsSync(qaFile)) throw new Error("SELECTED_H5_PASSING_QA_REQUIRED");
const approvedMasterFile = path.join(migration, "approved-master.json");
write(approvedMasterFile, {
  schema: "brand-approved-master/v1",
  brand,
  status: "approved",
  approvalSource: "explicit-user",
  approvedAt: new Date().toISOString(),
  reason: "Explicit user selection from independently reviewed interactive H5 directions.",
  artifact: previewArtifact,
  qa: { path: relative(qaFile), sha256: sha256File(qaFile), verdict: "pass" },
  supersedes: null,
  implementationAuthority: "artifact-and-qa",
});
const directionFile = path.join(migration, "design-direction.json");
write(directionFile, {
  schema: "brand-design-direction/v1",
  brand,
  status: "frozen",
  source: "explicit-user-selected-interactive-h5",
  selectedOptionId: selection,
  selectedOptionName: selected.name,
  previewArtifact,
  approvedMaster: {
    path: relative(approvedMasterFile),
    artifactSha256: previewArtifact.sha256,
    qaSha256: sha256File(qaFile),
  },
  implementationAuthority: "approved-master-artifact",
  directionContract: selected.directionContract,
  visualChoiceContract: selected.visualChoiceContract,
  communicationHypothesis: selected.communicationHypothesis || null,
  realDataBinding: selected.realDataBinding || routeDirection?.realDataBinding || null,
  resultHierarchyFit: selected.resultHierarchyFit || routeDirection?.resultHierarchyFit || null,
  knowledgeRefs: selected.directionContract?.knowledgeRefs || [],
  wildDesignDecision: {
    sha256: sha256File(decisionFile),
    selectedOptionIds: [selection],
    selectedContractSha256,
    selectedVisualChoiceSha256,
  },
  frozenInputs: {
    options: { path: relative(optionsFile), sha256: sha256File(optionsFile) },
    businessScope: { path: relative(businessScopeFile), sha256: sha256File(businessScopeFile) },
    brandEvidence: { path: relative(evidenceFile), sha256: sha256File(evidenceFile) },
    brandMod: { path: relative(modFile), sha256: sha256File(modFile) },
  },
});

execFileSync(process.execPath, [
  path.join(skillRoot, "scripts", "validate-wild-design-decision.mjs"),
  "--options", optionsFile,
  "--decision", decisionFile,
  "--business-scope", businessScopeFile,
  "--brand-evidence", evidenceFile,
  "--brand-mod", modFile,
  "--design-direction", directionFile,
], { cwd: root, stdio: "pipe" });

process.stdout.write(`${JSON.stringify({ ok: true, selection, outputs: [businessScopeFile, decisionFile, approvedMasterFile, directionFile].map((file) => ({ path: relative(file), sha256: sha256File(file) })) }, null, 2)}\n`);

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function write(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}
function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function hashValue(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
