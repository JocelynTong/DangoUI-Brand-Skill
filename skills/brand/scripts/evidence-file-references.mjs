import fs from "node:fs";
import path from "node:path";

// Shared by the frozen-handoff closure check and apply-host preflight.
export function collectPngReferences(value, found) {
  if (typeof value === "string") {
    const clean = value.split("#")[0];
    if (/\.png$/i.test(clean)) found.add(clean);
    return;
  }
  if (Array.isArray(value)) return value.forEach(item => collectPngReferences(item, found));
  if (value && typeof value === "object") Object.values(value).forEach(item => collectPngReferences(item, found));
}

export function resolveEvidenceReference(root, migrationRoot, reference) {
  if (path.isAbsolute(reference)) return null;
  const normalized = reference.replaceAll("\\", "/");
  if (normalized.startsWith("migrations/")) return path.resolve(root, normalized);
  const rootCandidate = path.resolve(root, normalized);
  if (rootCandidate.startsWith(`${path.resolve(root)}${path.sep}`) && fs.existsSync(rootCandidate)) return rootCandidate;
  const migrationCandidate = path.resolve(migrationRoot, normalized);
  return migrationCandidate.startsWith(`${path.resolve(migrationRoot)}${path.sep}`) ? migrationCandidate : null;
}
