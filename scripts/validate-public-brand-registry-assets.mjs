#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryRoot = path.join(root, "public", "brand-registry", "v0.1");
const index = JSON.parse(fs.readFileSync(path.join(registryRoot, "index.json"), "utf8"));
const missing = [];
for (const brand of index.brands || []) {
  const manifestFile = path.join(root, "public", brand.manifest.replace(/^\//, ""));
  if (!fs.existsSync(manifestFile)) { missing.push(brand.manifest); continue; }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  for (const publicPath of Object.values(manifest.artifacts || {})) verify(publicPath);
  for (const asset of manifest.evidenceAssets || []) verify(asset.path);
}
if (missing.length) {
  process.stderr.write(`PUBLIC_REGISTRY_DECLARED_FILE_MISSING\n${missing.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`PUBLIC_REGISTRY_ASSETS_VALID ${index.brands?.length || 0} brands\n`);
function verify(publicPath) {
  const file = path.join(root, "public", String(publicPath).replace(/^\//, ""));
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) missing.push(publicPath);
}
