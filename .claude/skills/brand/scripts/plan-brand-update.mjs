#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const command = args[0];
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand", "");
if (!brand || !["plan", "seal-baseline"].includes(command)) {
  fail("Usage: plan-brand-update.mjs <plan|seal-baseline> --brand <id> [--snapshot <file>] [--baseline <file>] [--write]");
}

const migrationRoot = resolveMigrationRoot();
const baselineFile = path.resolve(root, opt("--baseline", path.join(migrationRoot, "update-baseline.json")));
const snapshotArg = opt("--snapshot", "");
const snapshotFile = snapshotArg ? path.resolve(root, snapshotArg) : path.join(migrationRoot, "source-fingerprint.json");

if (command === "seal-baseline") {
  const snapshot = readJsonRequired(snapshotFile);
  validateSnapshot(snapshot, "snapshot");
  const baseline = { ...snapshot, schema: "brand-update-baseline/v1", brand, sealedAt: new Date().toISOString() };
  writeJson(baselineFile, baseline);
  output({ ok: true, action: "baseline-sealed", brand, baseline: rel(baselineFile), pageCount: baseline.pages.length });
}

const baseline = readJsonRequired(baselineFile);
const snapshot = readJsonRequired(snapshotFile);
validateSnapshot(baseline, "baseline");
validateSnapshot(snapshot, "snapshot");
const plan = buildPlan(baseline, snapshot);
if (args.includes("--write")) writeJson(path.join(migrationRoot, "update-plan.json"), plan);
output(plan);

function buildPlan(previous, current) {
  const before = new Map(previous.pages.map((item) => [item.id, item]));
  const after = new Map(current.pages.map((item) => [item.id, item]));
  const pageIds = [...new Set([...before.keys(), ...after.keys()])].sort();
  const pages = pageIds.map((id) => classifyPage(id, before.get(id), after.get(id)));
  const changed = pages.filter((item) => item.change !== "unchanged");
  const ruleChanged = String(previous.rulesVersion || "") !== String(current.rulesVersion || "");
  const sourceSetChanged = pages.some((item) => ["added", "removed"].includes(item.change));
  const highDrift = changed.some((item) => item.change === "visual-structure-or-assets" || item.change === "added" || item.change === "removed");
  let route = "reuse-no-op";
  let affectedStages = [];
  if (!changed.length && ruleChanged) {
    route = "contract-migration-only";
    affectedStages = ["machine-contract-migration", "artifact-validation"];
  } else if (sourceSetChanged || changed.length > Math.max(3, Math.ceil(pages.length * 0.5))) {
    route = "full-relearn-existing-brand";
    affectedStages = ["evidence", "interpreter", "mapping", "demo", "visualQA"];
  } else if (highDrift) {
    route = "targeted-visual-refresh";
    affectedStages = ["affected-page-evidence", "affected-intent-and-mapping", "affected-demo", "affected-page-qa", "smoke-regression"];
  } else if (changed.some((item) => item.change === "interaction")) {
    route = "targeted-interaction-refresh";
    affectedStages = ["affected-interaction-evidence", "affected-demo", "affected-page-qa", "smoke-regression"];
  } else if (changed.length) {
    route = "targeted-content-refresh";
    affectedStages = ["affected-demo", "affected-page-qa", "smoke-regression"];
  }
  return {
    schema: "brand-incremental-update-plan/v1",
    brand,
    route,
    rulesVersionChanged: ruleChanged,
    sourceSetChanged,
    totalPages: pages.length,
    changedPages: changed.map((item) => item.id),
    cacheHits: pages.filter((item) => item.change === "unchanged").map((item) => item.id),
    pages,
    affectedStages,
    executionPolicy: {
      preserveBrandId: true,
      revisionRoot: `migrations/${brand}/revisions/<run-id>`,
      reuseUnchangedEvidence: true,
      recaptureOnlyChangedPages: true,
      qaScope: route === "full-relearn-existing-brand" ? "all-core-pages" : changed.length ? "changed-pages-plus-smoke" : "none",
      createRegistryEntry: false
    },
    budgetClass: route === "reuse-no-op" ? "under-1-minute" : route === "contract-migration-only" ? "1-5-minutes" : route === "targeted-content-refresh" ? "3-8-minutes" : route.startsWith("targeted-") ? "10-20-minutes" : "30-45-minutes",
    generatedAt: new Date().toISOString()
  };
}

function classifyPage(id, before, after) {
  if (!before) return { id, change: "added", changedDimensions: ["source-set"] };
  if (!after) return { id, change: "removed", changedDimensions: ["source-set"] };
  const dimensions = ["contentSha256", "renderSha256", "assetSha256", "interactionSha256"];
  const changedDimensions = dimensions.filter((key) => String(before[key] || "") !== String(after[key] || ""));
  if (!changedDimensions.length) return { id, change: "unchanged", changedDimensions: [] };
  if (changedDimensions.some((key) => ["renderSha256", "assetSha256"].includes(key))) return { id, change: "visual-structure-or-assets", changedDimensions };
  if (changedDimensions.includes("interactionSha256")) return { id, change: "interaction", changedDimensions };
  return { id, change: "content", changedDimensions };
}

function validateSnapshot(value, label) {
  if (!value || !Array.isArray(value.pages) || !value.pages.length) fail(`${label} must contain pages[].`);
  if (value.brand && value.brand !== brand) fail(`${label} brand does not match ${brand}.`);
  for (const page of value.pages) if (!page?.id) fail(`${label} pages require id.`);
}

function resolveMigrationRoot() {
  const registry = readJson(path.join(root, "public", "brand-previews", "registry.json"), null);
  const entry = registry?.brands?.find((item) => item.id === brand);
  return path.resolve(root, entry?.migrationRoot || `migrations/${brand}`);
}
function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function readJsonRequired(file) { const value = readJson(file, null); if (!value) fail(`Missing or invalid JSON: ${rel(file)}`); return value; }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function rel(file) { return path.relative(root, file); }
function output(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); process.exit(0); }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
