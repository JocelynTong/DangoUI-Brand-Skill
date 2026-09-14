#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function runApplyHostPreflight({ root = process.cwd(), brand, hostTarget, profile = "fast", write = true } = {}) {
  const startedAt = new Date();
  const rootPath = path.resolve(root);
  const migrationRoot = path.join(rootPath, "migrations", brand || "");
  const hostRoot = path.resolve(rootPath, hostTarget || ".");
  const blocking = [];
  const warnings = [];
  const required = ["brand-mod.json", "brand-evidence.json", "brand-intent.json"];
  if (["standard", "certification"].includes(profile)) required.push("component-mapping.json");

  if (!brand) blocking.push("BRAND_REQUIRED");
  if (!fs.existsSync(hostRoot)) blocking.push("HOST_TARGET_MISSING");
  const files = {};
  for (const name of required) {
    const file = path.join(migrationRoot, name);
    files[name] = file;
    if (!fs.existsSync(file)) blocking.push(`FROZEN_PACK_FILE_MISSING:${name}`);
  }

  const referencedEvidence = new Set();
  for (const name of ["brand-evidence.json", "brand-intent.json"]) {
    const file = files[name];
    if (!file || !fs.existsSync(file)) continue;
    collectPngReferences(readJson(file), referencedEvidence);
  }
  for (const reference of referencedEvidence) {
    const file = resolveEvidenceReference(rootPath, migrationRoot, reference);
    if (!file || !fs.existsSync(file)) blocking.push(`FROZEN_EVIDENCE_MISSING:${reference}`);
  }

  let hostPackage = null;
  const packageFile = path.join(hostRoot, "package.json");
  if (!fs.existsSync(packageFile)) blocking.push("HOST_PACKAGE_JSON_MISSING");
  else hostPackage = readJson(packageFile);
  if (!fs.existsSync(path.join(hostRoot, "src"))) warnings.push("HOST_SRC_DIRECTORY_MISSING");

  const dependencies = { ...(hostPackage?.dependencies || {}), ...(hostPackage?.devDependencies || {}) };
  const dangouiDeclared = Boolean(dependencies.dangoui);
  if (!dangouiDeclared) {
    if (profile === "certification") blocking.push("DANGOUI_RUNTIME_NOT_DECLARED");
    else warnings.push("DANGOUI_RUNTIME_NOT_DECLARED:PARTIAL_STYLE_ONLY");
  }

  const cacheInputs = [...Object.values(files), packageFile].filter((file) => file && fs.existsSync(file));
  const cacheKey = sha256(cacheInputs.map((file) => `${path.relative(rootPath, file)}:${sha256File(file)}`).join("\n"));
  const endedAt = new Date();
  const result = {
    schema: "brand-apply-host-preflight/v1",
    brand,
    profile,
    hostTarget: path.relative(rootPath, hostRoot) || ".",
    startedAt: startedAt.toISOString(),
    completedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    verdict: blocking.length ? "blocked" : "pass",
    frozenPack: {
      trusted: blocking.every((item) => !item.startsWith("FROZEN_")),
      requiredFiles: required,
      referencedEvidenceCount: referencedEvidence.size,
      cacheKey,
      reuseDecision: blocking.some((item) => item.startsWith("FROZEN_")) ? "blocked" : "reuse-without-relearning",
    },
    runtime: {
      dangouiDeclared,
      declaredVersion: dependencies.dangoui || null,
      maximumClaim: dangouiDeclared ? "runtime-verification-required" : "PARTIAL_STYLE_ONLY",
    },
    blocking,
    warnings,
  };
  if (write && brand) {
    fs.mkdirSync(migrationRoot, { recursive: true });
    fs.writeFileSync(path.join(migrationRoot, "apply-host-preflight.json"), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

function collectPngReferences(value, found) {
  if (typeof value === "string") {
    const clean = value.split("#")[0];
    if (/\.png$/i.test(clean)) found.add(clean);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item) => collectPngReferences(item, found));
  if (value && typeof value === "object") Object.values(value).forEach((item) => collectPngReferences(item, found));
}

function resolveEvidenceReference(root, migrationRoot, reference) {
  if (path.isAbsolute(reference)) return null;
  const normalized = reference.replaceAll("\\", "/");
  if (normalized.startsWith("migrations/")) return path.resolve(root, normalized);
  const resolved = path.resolve(migrationRoot, normalized);
  return resolved.startsWith(`${path.resolve(migrationRoot)}${path.sep}`) ? resolved : null;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function option(args, name, fallback = "") { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const result = runApplyHostPreflight({
    root: option(args, "--root", process.cwd()),
    brand: option(args, "--brand"),
    hostTarget: option(args, "--host-target", "."),
    profile: option(args, "--profile", "fast"),
    write: !args.includes("--no-write"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.verdict === "pass" ? 0 : 1);
}
