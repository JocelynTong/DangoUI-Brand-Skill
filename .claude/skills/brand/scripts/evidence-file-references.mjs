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

export function collectImageReferences(value, found, semanticIdentity = false, extension = /\.(?:png|jpe?g)$/i) {
  if (typeof value === "string") {
    // Composition identity is a semantic label, including lists of labels;
    // file-bearing children such as identity.path still use normal checking.
    if (semanticIdentity) return;
    const clean = value.split("#")[0];
    if (extension.test(clean)) found.add(clean);
    return;
  }
  if (Array.isArray(value)) return value.forEach(item => collectImageReferences(item, found, semanticIdentity, extension));
  if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => collectImageReferences(item, found, key === "identity", extension));
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
