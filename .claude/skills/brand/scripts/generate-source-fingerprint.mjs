#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand", "");
if (!brand) fail("Usage: generate-source-fingerprint.mjs --brand <id> [--write] [--bootstrap-approved] [--root <repo>]");
const registry = readJson(path.join(root, "public", "brand-previews", "registry.json"), { brands: [] });
const entry = registry.brands?.find((item) => item.id === brand);
const migrationRoot = path.resolve(root, entry?.migrationRoot || `migrations/${brand}`);
const observationFile = path.join(migrationRoot, "source-observation-manifest.json");
const assetFile = path.join(migrationRoot, "rendered-asset-inventory.json");
const actionFile = firstExisting([path.join(migrationRoot, "action-evidence.json"), path.join(migrationRoot, "action-evidence-v02.json")]);
const contractFile = path.join(root, "skills", "brand", "workflow-contract.json");
const observation = readJsonRequired(observationFile);
const assets = readJson(assetFile, {});
const actions = readJson(actionFile, {});
const contract = readJson(contractFile, {});
const pages = array(observation.pages).map((page) => fingerprintPage(page));
if (!pages.length) fail(`No observed pages in ${rel(observationFile)}.`);

const fingerprint = {
  schema: "brand-source-fingerprint/v1",
  brand,
  rulesVersion: String(contract.roleContractVersion || hashValue(contract).slice(0, 12)),
  sourceManifestSha256: hashIfExists(path.join(migrationRoot, "source-manifest.json")),
  inputs: compact([
    inputRecord("source-observation-manifest", observationFile),
    inputRecord("rendered-asset-inventory", assetFile),
    inputRecord("action-evidence", actionFile)
  ]),
  pages,
  generatedAt: new Date().toISOString(),
  generationPolicy: {
    content: "stable semantic observation fields plus computed evidence file hashes",
    render: "all declared screenshot and continuous-capture hashes for the page",
    assets: "page-scoped assets plus global assets when scope cannot be proven",
    interaction: "page-scoped action evidence and declared page interaction traces"
  }
};
const outputFile = path.join(migrationRoot, "source-fingerprint.json");
if (args.includes("--write")) writeJson(outputFile, fingerprint);
let baseline = null;
if (args.includes("--bootstrap-approved")) {
  if (entry?.status !== "fidelity-pass") fail("BOOTSTRAP_REQUIRES_FIDELITY_PASS: only reviewed brands may establish a cache baseline without fresh browsing.");
  const baselineFile = path.join(migrationRoot, "update-baseline.json");
  if (!fs.existsSync(baselineFile)) {
    writeJson(baselineFile, { ...fingerprint, schema: "brand-update-baseline/v1", sealedAt: new Date().toISOString(), bootstrapReason: "existing fidelity-pass artifacts" });
    baseline = rel(baselineFile);
  }
}
process.stdout.write(`${JSON.stringify({ ok: true, brand, output: args.includes("--write") ? rel(outputFile) : null, baseline, fingerprint }, null, 2)}\n`);

function fingerprintPage(page) {
  const id = page.id || page.sourcePageId;
  const pageText = JSON.stringify(page);
  const semantic = removeVolatile(page);
  const computedFiles = collectPathStrings(page).filter((value) => /computed|visible|dom/i.test(value));
  const renderHashes = collectDeclaredHashes(page, /capture|screenshot|timeline|frame|video|continuous|restored/i);
  const scopedAssets = array(assets.assets || assets.items || assets.renderedAssets).filter((item) => belongsToPage(item, id, page.url));
  const allAssets = array(assets.assets || assets.items || assets.renderedAssets);
  const assetScope = scopedAssets.length ? scopedAssets : allAssets.filter((item) => !detectPageScope(item));
  const actionItems = array(actions.entries || actions.actions || actions.interactions).filter((item) => belongsToPage(item, id, page.url));
  const embeddedInteractions = [page.interaction, page.interactions, page.timeline].filter(Boolean);
  return {
    id,
    url: page.url || null,
    contentSha256: hashValue({ semantic, computedFiles: computedFiles.map(fileHashRecord) }),
    renderSha256: hashValue(renderHashes.length ? renderHashes : { declaredPage: pageText }),
    assetSha256: hashValue(assetScope.map(stableAssetRecord)),
    interactionSha256: hashValue({ actions: actionItems, embedded: embeddedInteractions }),
    evidenceCompleteness: {
      renderHashes: renderHashes.length,
      assets: assetScope.length,
      interactions: actionItems.length + embeddedInteractions.length
    }
  };
}
function removeVolatile(value) {
  if (Array.isArray(value)) return value.map(removeVolatile);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (/sha256|capturedAt|generatedAt|startedAt|endedAt|path|file|capture|screenshot|timeline|frame|video|continuous|restored/i.test(key)) continue;
    result[key] = removeVolatile(value[key]);
  }
  return result;
}
function collectDeclaredHashes(value, keyPattern, key = "") {
  if (Array.isArray(value)) return value.flatMap((item) => collectDeclaredHashes(item, keyPattern, key));
  if (!value || typeof value !== "object") return [];
  const output = [];
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === "sha256" && keyPattern.test(key) && typeof child === "string") output.push(child);
    else output.push(...collectDeclaredHashes(child, keyPattern, childKey));
  }
  return [...new Set(output)].sort();
}
function collectPathStrings(value) {
  if (Array.isArray(value)) return value.flatMap(collectPathStrings);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => /path|file/i.test(key) && typeof child === "string" ? [child] : collectPathStrings(child));
}
function fileHashRecord(value) { const file = path.resolve(root, value); return { path: value, sha256: hashIfExists(file) }; }
function belongsToPage(value, id, url) { const text = JSON.stringify(value).toLowerCase(); return Boolean(id && text.includes(String(id).toLowerCase())) || Boolean(url && text.includes(String(url).toLowerCase())); }
function detectPageScope(value) { const text = JSON.stringify(value).toLowerCase(); return /home|learn|database|button|introduction|product|character|gameplay/.test(text); }
function stableAssetRecord(item) { return { id: item.id || null, sourceUrl: item.sourceUrl || null, sourceSha256: item.sourceSha256 || item.sha256 || null, role: item.role || null, dimensions: item.dimensions || null }; }
function inputRecord(kind, file) { return file && fs.existsSync(file) ? { kind, path: rel(file), sha256: hashFile(file) } : null; }
function firstExisting(files) { return files.find((file) => fs.existsSync(file)) || ""; }
function hashIfExists(file) { return file && fs.existsSync(file) ? hashFile(file) : null; }
function hashFile(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function hashValue(value) { return crypto.createHash("sha256").update(JSON.stringify(sortValue(value))).digest("hex"); }
function sortValue(value) { if (Array.isArray(value)) return value.map(sortValue); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])])); }
function array(value) { return Array.isArray(value) ? value : []; }
function compact(value) { return value.filter(Boolean); }
function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; }
function rel(file) { return file ? path.relative(root, file) : ""; }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function readJsonRequired(file) { const value = readJson(file, null); if (!value) fail(`Missing or invalid JSON: ${rel(file)}`); return value; }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
