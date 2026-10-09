#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function validateExpressiveGeometryLock(report, { root = process.cwd(), verifyFiles = true } = {}) {
  const errors = [];
  const fail = (code) => errors.push(code);
  if (report?.schema !== "expressive-geometry-lock/v1") fail("EXPRESSIVE_GEOMETRY_LOCK_SCHEMA_INVALID");
  for (const key of ["gapId", "directionId", "mutableAssetSelector", "fixedContainerSelector"]) if (!String(report?.[key] || "").trim()) fail("EXPRESSIVE_GEOMETRY_LOCK_IDENTITY_INCOMPLETE");
  const before = report?.before || {};
  const after = report?.after || {};
  const hashes = ["domOrderHash", "nonAssetStructureHash", "productiveBindingHash", "resultHierarchyHash", "typographyMetricsHash"];
  for (const key of hashes) {
    if (!isHash(before[key]) || !isHash(after[key])) fail("EXPRESSIVE_GEOMETRY_LOCK_HASH_INVALID");
    else if (before[key] !== after[key]) fail(`EXPRESSIVE_GEOMETRY_${key.replace(/Hash$/, "").toUpperCase()}_DRIFT`);
  }
  const tolerance = Number(report?.tolerancePx);
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 2) fail("EXPRESSIVE_GEOMETRY_TOLERANCE_INVALID");
  for (const key of ["x", "y", "width", "height"]) {
    const a = Number(before?.fixedContainerRect?.[key]);
    const b = Number(after?.fixedContainerRect?.[key]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) fail("EXPRESSIVE_GEOMETRY_RECT_INVALID");
    else if (Number.isFinite(tolerance) && Math.abs(a - b) > tolerance) fail("EXPRESSIVE_FIXED_CONTAINER_GEOMETRY_DRIFT");
  }
  const changed = Array.isArray(report?.changedSelectors) ? report.changedSelectors : [];
  if (changed.length !== 1 || changed[0] !== report?.mutableAssetSelector) fail("EXPRESSIVE_CHANGE_SCOPE_INVALID");
  if (report?.mutableAssetPixelsChanged !== true) fail("EXPRESSIVE_ASSET_CHANGE_NOT_PROVEN");
  for (const binding of [report?.beforeArtifact, report?.afterArtifact]) {
    if (!binding?.path || !isHash(binding.sha256)) { fail("EXPRESSIVE_GEOMETRY_ARTIFACT_BINDING_INVALID"); continue; }
    if (verifyFiles) verifyBinding(root, binding, errors);
  }
  if (verifyFiles && report?.beforeArtifact?.path && report?.afterArtifact?.path && report?.gapId) {
    const beforeSource = readBoundSource(root, report.beforeArtifact, errors);
    const afterSource = readBoundSource(root, report.afterArtifact, errors);
    if (beforeSource !== null && afterSource !== null) {
      const beforeRegion = splitMutableRegion(beforeSource, report.gapId);
      const afterRegion = splitMutableRegion(afterSource, report.gapId);
      if (!beforeRegion || !afterRegion) fail("EXPRESSIVE_MUTABLE_REGION_MARKERS_REQUIRED");
      else {
        if (beforeRegion.masked !== afterRegion.masked) fail("EXPRESSIVE_NON_ASSET_BYTES_DRIFT");
        if (beforeRegion.mutable === afterRegion.mutable) fail("EXPRESSIVE_MUTABLE_ASSET_BYTES_UNCHANGED");
        const fixedMarker = `data-expressive-fixed-container="${report.gapId}"`;
        const fixedMarkerSingle = `data-expressive-fixed-container='${report.gapId}'`;
        if (!beforeRegion.masked.includes(fixedMarker) && !beforeRegion.masked.includes(fixedMarkerSingle)) fail("EXPRESSIVE_FIXED_CONTAINER_MARKER_REQUIRED");
        const structuralHash = crypto.createHash("sha256").update(beforeRegion.masked).digest("hex");
        if (before.nonAssetStructureHash !== structuralHash || after.nonAssetStructureHash !== structuralHash) fail("EXPRESSIVE_NON_ASSET_STRUCTURE_HASH_MISMATCH");
      }
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function verifyBinding(root, binding, errors) {
  const base = path.resolve(root);
  const file = path.resolve(base, binding.path);
  if (file !== base && !file.startsWith(`${base}${path.sep}`)) { errors.push("EXPRESSIVE_GEOMETRY_ARTIFACT_PATH_ESCAPE"); return; }
  if (!fs.existsSync(file)) { errors.push("EXPRESSIVE_GEOMETRY_ARTIFACT_MISSING"); return; }
  const actual = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (actual !== binding.sha256) errors.push("EXPRESSIVE_GEOMETRY_ARTIFACT_HASH_MISMATCH");
}

function readBoundSource(root, binding, errors) {
  const base = path.resolve(root);
  const file = path.resolve(base, binding.path);
  if (file !== base && !file.startsWith(`${base}${path.sep}`)) return null;
  if (!fs.existsSync(file)) return null;
  try { return fs.readFileSync(file, "utf8"); }
  catch { errors.push("EXPRESSIVE_GEOMETRY_ARTIFACT_READ_FAILED"); return null; }
}

function splitMutableRegion(source, gapId) {
  const escaped = String(gapId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<!--\\s*expressive-asset:${escaped}:start\\s*-->([\\s\\S]*?)<!--\\s*expressive-asset:${escaped}:end\\s*-->`, "g");
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) return null;
  return { mutable: matches[0][1], masked: source.replace(pattern, `<!-- expressive-asset:${gapId}:start --><!-- MUTABLE_ASSET --><!-- expressive-asset:${gapId}:end -->`) };
}

function isHash(value) { return /^[a-f0-9]{64}$/i.test(String(value || "")); }

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const arg = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; };
  const file = arg("--file");
  const root = path.resolve(arg("--root") || process.cwd());
  if (!file || !fs.existsSync(file)) { console.error(JSON.stringify({ ok: false, errors: ["EXPRESSIVE_GEOMETRY_LOCK_FILE_REQUIRED"] }, null, 2)); process.exit(2); }
  let report;
  try { report = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { console.error(JSON.stringify({ ok: false, errors: ["EXPRESSIVE_GEOMETRY_LOCK_JSON_INVALID"] }, null, 2)); process.exit(2); }
  const result = validateExpressiveGeometryLock(report, { root });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}
