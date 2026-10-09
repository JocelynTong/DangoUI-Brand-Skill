#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateNavigationShellPreview } from "./finalize-h5-direction-stage.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1] || fallback;
};

const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand");
const artifactArg = opt("--artifact");
const qaArg = opt("--qa");
const reason = opt("--reason", "Explicit user approval of the rendered interactive H5.");

if (!brand || !artifactArg) {
  throw new Error("Usage: promote-approved-h5-master.mjs --root <artifact-root> --brand <brand> --artifact <relative-h5> [--qa <relative-json>] [--reason <text>]");
}

const migration = path.join(root, "migrations", brand);
const artifactFile = resolveInside(root, artifactArg);
const qaFile = qaArg
  ? resolveInside(root, qaArg)
  : path.join(path.dirname(artifactFile), "qa.json");

assertFileInside(artifactFile, migration, "APPROVED_MASTER_ARTIFACT_OUTSIDE_MIGRATION");
assertFileInside(qaFile, migration, "APPROVED_MASTER_QA_OUTSIDE_MIGRATION");
if (path.extname(artifactFile).toLowerCase() !== ".html") throw new Error("APPROVED_MASTER_H5_REQUIRED");

const baselineFile = path.join(migration, "host-startup-baseline.json");
if (!fs.existsSync(baselineFile)) throw new Error("APPROVED_MASTER_HOST_BASELINE_REQUIRED");
const baseline = read(baselineFile);
if (!baseline.navigationShellContract) throw new Error("APPROVED_MASTER_NAVIGATION_CONTRACT_REQUIRED");
const artifactSource = fs.readFileSync(artifactFile, "utf8");
const shellErrors = validateNavigationShellPreview(artifactSource, baseline.navigationShellContract);
if (shellErrors.length) throw new Error(`APPROVED_MASTER_${shellErrors[0]}`);

const qa = read(qaFile);
const qaVerdict = String(qa.verdict || qa.status || "").toLowerCase();
if (!['pass', 'approved'].includes(qaVerdict)) throw new Error("APPROVED_MASTER_PASSING_QA_REQUIRED");

const directionFile = path.join(migration, "design-direction.json");
const direction = read(directionFile);
const previousMasterFile = path.join(migration, "approved-master.json");
const previousMaster = fs.existsSync(previousMasterFile) ? read(previousMasterFile) : null;
const artifact = { path: relative(artifactFile), sha256: sha256File(artifactFile) };
const qaArtifact = { path: relative(qaFile), sha256: sha256File(qaFile), verdict: qaVerdict };

const master = {
  schema: "brand-approved-master/v1",
  brand,
  status: "approved",
  approvalSource: "explicit-user",
  approvedAt: new Date().toISOString(),
  reason,
  artifact,
  qa: qaArtifact,
  supersedes: previousMaster?.artifact || direction.previewArtifact || null,
  implementationAuthority: "artifact-and-qa",
  navigationShellContract: {
    baseline: { path: relative(baselineFile), sha256: sha256File(baselineFile) },
    treatment: readAttribute(artifactSource, "data-navigation-shell-treatment"),
    sceneContinuity: readAttribute(artifactSource, "data-scene-continuity"),
    itemIds: baseline.navigationShellContract.items.map((item) => item.id),
  },
};
write(previousMasterFile, master);

write(directionFile, {
  ...direction,
  status: "frozen",
  source: "explicit-user-approved-h5-master",
  previewArtifact: artifact,
  approvedMaster: {
    path: relative(previousMasterFile),
    artifactSha256: artifact.sha256,
    qaSha256: qaArtifact.sha256,
  },
  implementationAuthority: "approved-master-artifact",
  previousSelection: {
    selectedOptionId: direction.selectedOptionId || null,
    previewArtifact: direction.previewArtifact || null,
  },
});

const applicationPlanFile = path.join(migration, "brand-application-plan.json");
if (fs.existsSync(applicationPlanFile)) {
  const applicationPlan = read(applicationPlanFile);
  write(applicationPlanFile, {
    ...applicationPlan,
    approvedMaster: artifact,
    implementationAuthority: "approved-master-artifact",
    supersededDirectionOption: direction.selectedOptionId || null,
  });
}

const routeFile = path.join(migration, "design-host-route.json");
if (fs.existsSync(routeFile)) {
  const route = read(routeFile);
  write(routeFile, {
    ...route,
    approvedMaster: {
      status: "approved",
      approvalSource: "explicit-user",
      artifact,
      qa: qaArtifact,
      supersedesOptionId: direction.selectedOptionId || null,
    },
  });
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  brand,
  approvedMaster: { path: relative(previousMasterFile), sha256: sha256File(previousMasterFile) },
  artifact,
  qa: qaArtifact,
  direction: { path: relative(directionFile), sha256: sha256File(directionFile) },
}, null, 2)}\n`);

function resolveInside(base, value) {
  const resolved = path.resolve(base, value);
  const boundary = path.resolve(base);
  if (resolved !== boundary && !resolved.startsWith(`${boundary}${path.sep}`)) throw new Error("APPROVED_MASTER_PATH_ESCAPE");
  return resolved;
}

function assertFileInside(file, boundary, code) {
  const resolvedBoundary = path.resolve(boundary);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error("APPROVED_MASTER_INPUT_MISSING");
  if (!file.startsWith(`${resolvedBoundary}${path.sep}`)) throw new Error(code);
}

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
function readAttribute(source, name) {
  return String(source || "").match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "";
}
