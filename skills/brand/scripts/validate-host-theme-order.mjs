#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const root = path.resolve(value("--root") || ".");
const contractPath = value("--contract");
const failures = [];
const fail = (code, message, context = {}) => failures.push({ code, message, ...context });
if (!contractPath) fail("THEME_ORDER_CONTRACT_MISSING", "--contract is required.");
let contract;
try { if (contractPath) contract = JSON.parse(fs.readFileSync(path.resolve(contractPath), "utf8")); }
catch (error) { fail("THEME_ORDER_CONTRACT_UNREADABLE", error.message); }

const posix = file => file.split(path.sep).join("/");
const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (["node_modules", ".git", "dist", "build"].includes(entry.name)) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
}) : [];
const sourceExt = /\.(?:css|scss|sass|less|vue|[cm]?[jt]sx?)$/i;
const scanRoots = contract?.scanRoots?.length ? contract.scanRoots : ["src"];
const files = scanRoots.flatMap(p => walk(path.resolve(root, p))).filter(f => sourceExt.test(f));
const themeEntry = contract?.themeEntry && posix(contract.themeEntry).replace(/^\.\//, "");
const globalImporters = new Set((contract?.globalImporters || []).map(p => posix(p).replace(/^\.\//, "")));
const allowedInjectors = new Set((contract?.allowedLateStyleInjectors || []).map(p => posix(p).replace(/^\.\//, "")));
if (!contract || contract.version !== 1 || !["single-global-entry", "layered-global-entry"].includes(contract.strategy)) fail("THEME_ORDER_STRATEGY_INVALID", "version=1 and a supported strategy are required.");
if (!themeEntry) fail("THEME_ENTRY_MISSING", "themeEntry is required.");
if (!globalImporters.size) fail("GLOBAL_IMPORTER_MISSING", "At least one globalImporter is required.");

const importers = [];
for (const file of files) {
  const rel = posix(path.relative(root, file));
  const text = fs.readFileSync(file, "utf8");
  const imports = [...text.matchAll(/(?:@import\s+(?:url\()?|\bimport\s+)["']([^"']+\.s?css)["']/g)].map(m => m[1]);
  for (const spec of imports) {
    const resolved = spec.startsWith("@/") ? `src/${spec.slice(2)}` : posix(path.relative(root, path.resolve(path.dirname(file), spec)));
    if (resolved === themeEntry) importers.push(rel);
  }
  if (!allowedInjectors.has(rel) && /(?:createElement\s*\(\s*["'](?:style|link)["']|appendChild\s*\([^)]*(?:style|link)|insertRule\s*\()/i.test(text)) {
    fail("UNKNOWN_LATE_STYLE_INJECTOR", "Potential runtime stylesheet injection is not declared.", { file: rel });
  }
}
if (importers.length !== 1) fail("THEME_IMPORT_COUNT_INVALID", "Theme entry must be imported exactly once.", { importers });
for (const importer of importers) {
  if (!globalImporters.has(importer)) fail("THEME_IMPORT_NOT_GLOBAL", "Theme entry import is owned by a lazy or undeclared file.", { file: importer });
  if (/(^|\/)(pages?|routes?|components?)\//i.test(importer)) fail("LAZY_PAGE_THEME_IMPORT", "Page, route and component files cannot own the shared theme import.", { file: importer });
}

if (themeEntry && fs.existsSync(path.resolve(root, themeEntry))) {
  const css = fs.readFileSync(path.resolve(root, themeEntry), "utf8");
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/!important\b/i.test(css)) fail("THEME_IMPORTANT_FORBIDDEN", "Theme CSS cannot depend on !important.");
  const max = contract.maxSelectorSpecificity || [0, 4, 1];
  for (const raw of cssWithoutComments.split("{")) {
    const selector = raw.slice(raw.lastIndexOf("}" ) + 1).trim();
    if (!selector || selector.startsWith("@") || selector.includes(":" + "root")) continue;
    for (const part of selector.split(",")) {
      const clean = part.replace(/:where\([^)]*\)/g, "");
      const specificity = [(clean.match(/#[\w-]+/g) || []).length, (clean.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length, (clean.match(/(^|[\s>+~])(?:[a-z][\w-]*)/gi) || []).length];
      if (specificity[0] || specificity.some((n, i) => n > max[i])) fail("THEME_SELECTOR_WEIGHT_EXCESSIVE", "Theme selector exceeds the declared specificity ceiling.", { selector: part.trim(), specificity, max });
    }
  }
  if (contract.strategy === "layered-global-entry" && !/@layer\s+[\w-]+(?:\s*,[^;]+)?\s*;/.test(css)) fail("CASCADE_LAYER_ORDER_MISSING", "Layered strategy needs one explicit global layer-order declaration in the theme entry.");
} else if (themeEntry) fail("THEME_ENTRY_UNREADABLE", "themeEntry does not exist.", { themeEntry });

console.log(JSON.stringify({ ok: failures.length === 0, gate: "host-theme-order/v1", strategy: contract?.strategy, importers, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
