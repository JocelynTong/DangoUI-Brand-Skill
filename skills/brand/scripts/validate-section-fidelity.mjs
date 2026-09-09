#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
};
const brand = value("--brand");
const strict = args.includes("--strict");
const root = process.cwd();
const input = value("--file") || (brand ? `migrations/${brand}/section-fidelity-manifest.json` : "");

if (!input) {
  console.error("Usage: validate-section-fidelity.mjs --brand <brand> [--file <manifest>] [--strict]");
  process.exit(2);
}

const manifestPath = path.resolve(root, input);
const failures = [];
const checks = [];
const add = (ok, code, section, message) => {
  checks.push({ ok, code, section, message });
  if (!ok) failures.push({ code, section, message });
};
const exists = (entry) => {
  const file = typeof entry === "string" ? entry : entry?.path;
  return Boolean(file && fs.existsSync(path.resolve(root, file)));
};

if (!fs.existsSync(manifestPath)) {
  add(false, "SECTION_MANIFEST_MISSING", "manifest", `${path.relative(root, manifestPath)} does not exist.`);
} else {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
  catch { add(false, "SECTION_MANIFEST_INVALID", "manifest", "Manifest is not valid JSON."); }
  const sections = Array.isArray(manifest?.sections) ? manifest.sections : [];
  add(sections.length > 0, "SECTION_MANIFEST_EMPTY", "manifest", "At least one high-salience section is required.");
  for (const section of sections) {
    const id = section?.id || "unnamed";
    add(Boolean(section?.pageId), "SECTION_PAGE_MISSING", id, "pageId is required.");
    add(exists(section?.sourceCapture) && exists(section?.demoCapture), "SECTION_CAPTURE_MISSING", id, "Readable source and Demo captures are required.");
    const sourceViewport = section?.sourceViewport;
    const demoViewport = section?.demoViewport;
    const sameViewport = sourceViewport?.width === demoViewport?.width && sourceViewport?.height === demoViewport?.height;
    add(Boolean(sameViewport || section?.approvedViewportTranslation), "SECTION_VIEWPORT_MISMATCH", id, "Source and Demo need the same viewport or an approved translation.");
    add(Boolean(section?.sourceRegion && section?.demoRegion), "SECTION_REGION_MISSING", id, "Normalized source and Demo regions are required.");
    const layers = Array.isArray(section?.requiredLayers) ? section.requiredLayers : [];
    add(layers.length > 0 && layers.every((layer) => layer?.id && layer?.sourceSelector && layer?.demoSelector && layer?.status === "pass"), "SECTION_LAYER_MISSING", id, "Every required layer needs visible source/demo selectors and pass status.");
    add(Array.isArray(section?.readingOrder) && section.readingOrder.length > 0, "SECTION_READING_ORDER_MISSING", id, "Reading order must be explicit.");
    add(section?.responsiveBehavior?.status === "pass", "SECTION_RESPONSIVE_MISSING", id, "Responsive behavior must be probed and pass.");
    add(section?.usesItemCountAsStructureProxy !== true, "SECTION_STRUCTURE_NOT_COUNT_PROXY", id, "Item count cannot stand in for structure.");
    const assets = Array.isArray(section?.assetRefs) ? section.assetRefs : [];
    add(assets.every((asset) => asset?.sourceUrl && asset?.sourceSha256 && asset?.status === "pass"), "SECTION_ASSET_PROVENANCE_MISSING", id, "Every declared asset needs URL, SHA and pass status.");
    const interactions = Array.isArray(section?.interactionChecks) ? section.interactionChecks : [];
    add(interactions.every((item) => item?.required !== true || item?.stateChanged === true && item?.restored === true && exists(item?.beforeCapture) && exists(item?.afterCapture)), "SECTION_INTERACTION_NO_STATE_CHANGE", id, "Required controls need captured state change and restoration.");
    add(section?.horizontalOverflow !== true, "SECTION_HORIZONTAL_OVERFLOW", id, "Section must not create page-level horizontal overflow.");
    add(section?.status === "pass", "SECTION_STATUS_NOT_PASS", id, "Section status must be pass before full-page QA.");
  }
}

const result = { ok: failures.length === 0, strict, manifest: path.relative(root, manifestPath), checks, failures };
console.log(JSON.stringify(result, null, 2));
process.exit(strict && failures.length ? 1 : 0);
