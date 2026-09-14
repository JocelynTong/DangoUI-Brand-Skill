#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const root = path.resolve(opt("--root", process.cwd()));
const registryFile = path.resolve(root, opt("--registry", "public/brand-previews/registry.json"));
const registry = readJson(registryFile);
if (!Array.isArray(registry?.brands)) fail("Registry must contain brands[].");
const fingerprintScript = path.join(root, "skills", "brand", "scripts", "generate-source-fingerprint.mjs");
const plannerScript = path.join(root, "skills", "brand", "scripts", "plan-brand-update.mjs");
const brands = [];

for (const entry of registry.brands) {
  const fingerprintArgs = [fingerprintScript, "--brand", entry.id, "--root", root, "--write"];
  if (args.includes("--bootstrap-approved")) fingerprintArgs.push("--bootstrap-approved");
  const fingerprint = spawnSync(process.execPath, fingerprintArgs, { encoding: "utf8" });
  if (fingerprint.status !== 0) {
    brands.push({ brand: entry.id, route: "fingerprint-unavailable", reason: firstLine(fingerprint.stderr), registryStatus: entry.status });
    continue;
  }
  const plan = spawnSync(process.execPath, [plannerScript, "plan", "--brand", entry.id, "--root", root, "--write"], { encoding: "utf8" });
  if (plan.status !== 0) {
    brands.push({ brand: entry.id, route: "baseline-required", reason: firstLine(plan.stderr), registryStatus: entry.status });
    continue;
  }
  const value = JSON.parse(plan.stdout);
  brands.push({ brand: entry.id, route: value.route, changedPages: value.changedPages, cacheHits: value.cacheHits.length, totalPages: value.totalPages, budgetClass: value.budgetClass });
}

const order = ["contract-migration-only", "targeted-content-refresh", "targeted-interaction-refresh", "targeted-visual-refresh", "full-relearn-existing-brand", "baseline-required", "fingerprint-unavailable", "reuse-no-op"];
const waves = order.map((route) => ({ route, brands: brands.filter((item) => item.route === route).map((item) => item.brand) })).filter((item) => item.brands.length);
const report = {
  schema: "brand-portfolio-update-plan/v1",
  totalBrands: brands.length,
  actionableBrands: brands.filter((item) => !["reuse-no-op", "fingerprint-unavailable"].includes(item.route)).length,
  noOpBrands: brands.filter((item) => item.route === "reuse-no-op").length,
  brands,
  waves,
  schedulingPolicy: {
    maximumConcurrentBrowsers: Number(opt("--browser-concurrency", "4")),
    runCheapRoutesFirst: true,
    fullRelearnRequiresQueueBudget: true,
    unchangedBrandsConsumeBrowserSlots: false,
    registryIdentityStable: true
  },
  generatedAt: new Date().toISOString()
};
if (args.includes("--write")) {
  const file = path.join(root, "migrations", "portfolio-update-plan.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }
function firstLine(value) { return String(value || "unknown").trim().split(/\r?\n/)[0]; }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
