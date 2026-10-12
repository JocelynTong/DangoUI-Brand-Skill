#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { collectImageReferences } from "../skills/brand/scripts/evidence-file-references.mjs";

const root = process.cwd();
const registryRoot = path.join(root, "public", "brand-registry", "v0.1");
const index = JSON.parse(fs.readFileSync(path.join(registryRoot, "index.json"), "utf8"));
const missing = [];
const selectedBrand = process.argv.includes('--brand') ? process.argv[process.argv.indexOf('--brand') + 1] : '';
if (process.argv.includes('--brand') && (!selectedBrand || !(index.brands || []).some(brand => brand.id === selectedBrand))) throw new Error('Unknown or missing --brand');
for (const brand of index.brands || []) {
  if (selectedBrand && brand.id !== selectedBrand) continue;
  const manifestFile = path.join(root, "public", brand.manifest.replace(/^\//, ""));
  if (!fs.existsSync(manifestFile)) { missing.push(brand.manifest); continue; }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  for (const publicPath of Object.values(manifest.artifacts || {})) verify(publicPath);
  const evidenceByInstallPath = new Map();
  for (const asset of manifest.evidenceAssets || []) {
    verify(asset.path, asset.sha256);
    if (!asset.installPath || !asset.sha256) missing.push(`evidence asset declaration incomplete: ${asset.path}`);
    else evidenceByInstallPath.set(asset.installPath, asset);
  }
  const references = new Set();
  for (const name of ["brand-evidence", "brand-intent"]) {
    const publicPath = manifest.artifacts?.[name];
    if (!publicPath) { missing.push(`${manifest.id}: missing artifact ${name}`); continue; }
    const file = path.join(root, "public", String(publicPath).replace(/^\//, ""));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      collectImageReferences(JSON.parse(fs.readFileSync(file, "utf8")), references);
    }
  }
  for (const reference of references) {
    if (/^https?:\/\//i.test(reference)) continue;
    const normalized = reference.replaceAll("\\", "/").replace(/^\.\//, "");
    const prefix = `migrations/${manifest.id}/`;
    const installPath = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
    if (!evidenceByInstallPath.has(installPath)) {
      missing.push(`${manifest.id}: referenced evidence not packaged: ${reference}`);
    }
  }
  const runtimeByInstallPath = new Map();
  for (const asset of manifest.runtimeAssets || []) {
    verify(asset.path, asset.sha256);
    if (!asset.installPath || !asset.sha256) missing.push(`runtime asset declaration incomplete: ${asset.id || asset.path || "unknown"}`);
    else runtimeByInstallPath.set(asset.installPath, asset);
  }
  const modPath = manifest.artifacts?.["brand-mod"];
  if (modPath && Array.isArray(manifest.runtimeAssets)) {
    const modFile = path.join(root, "public", String(modPath).replace(/^\//, ""));
    if (fs.existsSync(modFile)) {
      const mod = JSON.parse(fs.readFileSync(modFile, "utf8"));
      for (const asset of mod.assets || []) {
        if (!asset?.localPath) continue;
        const runtime = runtimeByInstallPath.get(asset.localPath);
        if (!runtime) missing.push(`brand-mod localPath not packaged as runtimeAsset: ${asset.localPath}`);
        else if (runtime.sha256 !== asset.sourceSha256) missing.push(`brand-mod/runtimeAsset hash mismatch: ${asset.localPath}`);
      }
    }
  }
}
if (missing.length) {
  process.stderr.write(`PUBLIC_REGISTRY_DECLARED_FILE_MISSING\n${missing.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`PUBLIC_REGISTRY_ASSETS_VALID ${index.brands?.length || 0} brands\n`);
function verify(publicPath, expectedSha256 = "") {
  const file = path.join(root, "public", String(publicPath).replace(/^\//, ""));
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) {
    missing.push(publicPath);
    return;
  }
  if (expectedSha256) {
    const actual = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (actual !== expectedSha256) missing.push(`sha256 mismatch: ${publicPath}`);
  }
}
