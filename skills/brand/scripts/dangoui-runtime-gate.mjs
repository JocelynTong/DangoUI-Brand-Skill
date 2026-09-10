#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  dangoui-runtime-gate.mjs prepare --root <host> --version <exact-semver> --platform h5 [--package-manager pnpm|npm|yarn|bun] [--install]
  dangoui-runtime-gate.mjs verify --root <host> --version <exact-semver> --platform h5 --components <names> --source <files> --style-entry <file> --evidence <json> --token-root <workspace> --token-closure <json> --gap-root <workspace> --capability-gaps <json>

prepare is read-only unless --install is explicitly supplied. verify never installs packages.`);
  process.exit(0);
}
const command = args[0] && !args[0].startsWith("--") ? args.shift() : "verify";
if (!new Set(["prepare", "verify"]).has(command)) {
  console.error(`Unknown command: ${command}`);
  process.exit(2);
}
const value = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const flag = name => args.includes(`--${name}`);
const root = path.resolve(value("root", process.cwd()));
const expectedVersion = value("version");
const platform = value("platform", "h5");
const components = value("components", "").split(",").map(item => item.trim()).filter(Boolean);
const sourceFiles = value("source", "").split(",").map(item => item.trim()).filter(Boolean);
const styleEntry = value("style-entry");
const evidenceFile = value("evidence");
const tokenClosureFile = value("token-closure");
const tokenRoot = path.resolve(value("token-root", root));
const capabilityGapsFile = value("capability-gaps");
const gapRoot = path.resolve(value("gap-root", tokenRoot));
const blockers = [];
const warnings = [];
const add = (code, message) => blockers.push({ code, message });
const read = file => fs.readFileSync(file, "utf8");
const readJson = file => JSON.parse(read(file));
const exists = file => fs.existsSync(file);
const packageFile = path.join(root, "package.json");

if (!exists(packageFile)) add("HOST_PACKAGE_JSON_MISSING", `Missing ${packageFile}`);
const pkg = exists(packageFile) ? readJson(packageFile) : {};
const declared = { ...pkg.devDependencies, ...pkg.dependencies }.dangoui;
const lockCandidates = [
  ["pnpm", "pnpm-lock.yaml"],
  ["npm", "package-lock.json"],
  ["yarn", "yarn.lock"],
  ["bun", "bun.lockb"],
].filter(([, file]) => exists(path.join(root, file)));
const packageManager = value("package-manager") || (lockCandidates.length === 1 ? lockCandidates[0][0] : "");

if (!expectedVersion || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expectedVersion)) {
  add("DANGOUI_EXACT_VERSION_REQUIRED", "Pass an exact semver with --version; ranges and tags are not accepted.");
}
if (lockCandidates.length > 1 && !value("package-manager")) {
  add("AMBIGUOUS_PACKAGE_MANAGER", `Multiple lockfiles found: ${lockCandidates.map(item => item[1]).join(", ")}`);
}
if (!packageManager) add("PACKAGE_MANAGER_UNRESOLVED", "A lockfile or explicit --package-manager is required.");
if (declared && /^(?:file:|link:|workspace:|\/|~)/.test(declared)) {
  add("LOCAL_PATH_DEPENDENCY_FORBIDDEN", "Public consumers must not depend on a machine-local DangoUI path.");
}

const installCommand = packageManager === "pnpm"
  ? `pnpm add dangoui@${expectedVersion} --save-exact`
  : packageManager === "yarn"
    ? `yarn add dangoui@${expectedVersion} --exact`
    : packageManager === "bun"
      ? `bun add dangoui@${expectedVersion} --exact`
      : `npm install dangoui@${expectedVersion} --save-exact`;

if (command === "prepare") {
  if (blockers.length) {
    console.log(JSON.stringify({ status: "BLOCKED", root, packageManager, blockers }, null, 2));
    process.exit(1);
  }
  if (flag("install")) {
    const [bin, ...installArgs] = installCommand.split(" ");
    const result = spawnSync(bin, installArgs, { cwd: root, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(JSON.stringify({ status: "READY", root, packageManager, registryPolicy: "use-host-config", installCommand }, null, 2));
  process.exit(0);
}

if (declared !== expectedVersion) {
  add("DANGOUI_DECLARATION_NOT_EXACT", `package.json must declare exactly ${expectedVersion}; found ${declared || "missing"}.`);
}
if (lockCandidates.length === 0) add("LOCKFILE_MISSING", "A committed lockfile is required.");
const lockFile = lockCandidates.find(item => item[0] === packageManager)?.[1];
if (lockFile) {
  const lockText = read(path.join(root, lockFile));
  let lockMatches = false;
  if (packageManager === "npm") {
    const lock = JSON.parse(lockText);
    lockMatches = lock.packages?.["node_modules/dangoui"]?.version === expectedVersion
      || lock.dependencies?.dangoui?.version === expectedVersion;
  } else if (packageManager === "pnpm") {
    const escaped = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    lockMatches = new RegExp(`(?:dangoui@${escaped}(?:\\(|:)|dangoui:[\\s\\S]{0,240}?version:\\s*${escaped}(?:\\s|$))`).test(lockText);
  } else if (packageManager === "yarn") {
    const escaped = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    lockMatches = new RegExp(`dangoui@[^\\n]+:[\\s\\S]{0,240}?version\\s+[\"']?${escaped}[\"']?`).test(lockText);
  } else {
    lockMatches = lockText.includes(`dangoui@${expectedVersion}`);
  }
  if (!lockMatches) add("DANGOUI_LOCK_VERSION_MISMATCH", `${lockFile} does not lock dangoui to ${expectedVersion}.`);
}

const installedPackageFile = path.join(root, "node_modules/dangoui/package.json");
let installed = null;
if (!exists(installedPackageFile)) add("DANGOUI_NOT_INSTALLED", "node_modules/dangoui/package.json is missing.");
else {
  installed = readJson(installedPackageFile);
  if (installed.version !== expectedVersion) add("DANGOUI_INSTALLED_VERSION_MISMATCH", `Installed ${installed.version}; expected ${expectedVersion}.`);
  const exportsMap = installed.exports || {};
  for (const styleExport of ["./style.css", "./theme.css"]) {
    if (!(styleExport in exportsMap)) add("DANGOUI_STYLE_EXPORT_MISSING", `Installed package does not export ${styleExport}.`);
  }
  const entryValues = value => typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(entryValues) : [];
  const entryCandidates = [...entryValues(exportsMap["."]), installed.module, installed.main]
    .filter(item => typeof item === "string").map(item => path.join(root, "node_modules/dangoui", item));
  const entry = entryCandidates.find(exists);
  const entryText = entry ? read(entry) : "";
  for (const component of components) {
    if (!entryText.includes(component)) add("DANGOUI_COMPONENT_EXPORT_MISSING", `${component} is not exported by the installed package entry.`);
  }
}

const combinedSource = sourceFiles.map(file => {
  const absolute = path.resolve(root, file);
  if (!exists(absolute)) add("DANGOUI_CONSUMER_SOURCE_MISSING", `Missing consumer source ${absolute}.`);
  return exists(absolute) ? read(absolute) : "";
}).join("\n");
if (components.length && !sourceFiles.length) add("DANGOUI_CONSUMER_SOURCE_REQUIRED", "Pass real consumer files with --source.");
for (const component of components) {
  if (!new RegExp(`(?:import|require)[\\s\\S]{0,240}\\b${component}\\b[\\s\\S]{0,120}[\"']dangoui[\"']`).test(combinedSource)) {
    add("DANGOUI_COMPONENT_NOT_CONSUMED", `${component} is not imported from dangoui by the declared consumer source.`);
  }
}
if (styleEntry) {
  const absolute = path.resolve(root, styleEntry);
  if (!exists(absolute)) add("DANGOUI_STYLE_ENTRY_MISSING", `Missing style entry ${absolute}.`);
  else {
    const styleText = read(absolute);
    const base = styleText.indexOf("dangoui/style.css");
    const theme = styleText.indexOf("dangoui/theme.css");
    if (base < 0 || theme < 0) add("DANGOUI_STYLES_NOT_CONSUMED", "Import both dangoui/style.css and dangoui/theme.css.");
    if (base >= 0 && theme >= 0 && base > theme) add("DANGOUI_STYLE_ORDER_INVALID", "Import dangoui/style.css before dangoui/theme.css.");
  }
} else if (components.length) add("DANGOUI_STYLE_ENTRY_REQUIRED", "Pass the global style entry with --style-entry.");

if (platform !== "h5") add("DANGOUI_PLATFORM_UNVERIFIED", `${platform} is not proven by the public H5 runtime contract; provide a separately validated platform gate before claiming support.`);
if (!evidenceFile) add("DANGOUI_RUNTIME_EVIDENCE_REQUIRED", "Pass fresh rendered/bundle evidence with --evidence.");
else {
  const absolute = path.resolve(root, evidenceFile);
  if (!exists(absolute)) add("DANGOUI_RUNTIME_EVIDENCE_MISSING", `Missing evidence file ${absolute}.`);
  else {
    const evidence = readJson(absolute);
    const normalizedPlatform = String(evidence.platform || "").toLowerCase().replace(/_only$/, "");
    const renderedConsumer = evidence.renderedConsumer || evidence.verdicts?.runtimeConsumer || (String(evidence.checks?.renderedInstances || "").startsWith("PASS") ? "PASS" : "");
    const bundleContainsDangoui = evidence.bundleContainsDangoui || (String(evidence.checks?.bundleConsumer || "").startsWith("PASS") ? "PASS" : "");
    const businessParity = evidence.businessParity || evidence.verdicts?.businessSafety || (String(evidence.checks?.businessDiff || "").startsWith("PASS") ? "PASS" : "");
    if (normalizedPlatform !== platform.toLowerCase() || renderedConsumer !== "PASS" || bundleContainsDangoui !== "PASS" || businessParity !== "PASS") {
      add("DANGOUI_RUNTIME_EVIDENCE_FAILED", "Evidence must match the platform and PASS renderedConsumer, bundleContainsDangoui, and businessParity.");
    }
    if (components.some((component) => component === "DuInput" || component === "DuTextarea")) {
      const visualOwnership = evidence.visualOwnership
        || (String(evidence.checks?.visualOwnership || evidence.checks?.fieldOwnership || "").startsWith("PASS") ? "PASS" : "");
      if (visualOwnership !== "PASS") {
        add("DANGOUI_CONTROL_OWNERSHIP_FAILED", "DuInput and DuTextarea evidence must PASS visualOwnership: exactly one control boundary and one focus-ring owner, with nested native fields visually reset.");
      }
    }
  }
}

if (components.length && !tokenClosureFile) {
  add("DANGOUI_TOKEN_CLOSURE_REQUIRED", "Real component verification requires a strict token-closure contract.");
} else if (tokenClosureFile) {
  const tokenGate = path.resolve(path.dirname(new URL(import.meta.url).pathname), "validate-host-token-closure.mjs");
  const tokenResult = spawnSync(process.execPath, [tokenGate, "--root", tokenRoot, "--contract", tokenClosureFile, "--strict"], { encoding: "utf8" });
  if (tokenResult.status !== 0) {
    add("DANGOUI_TOKEN_CLOSURE_FAILED", `Strict token closure failed: ${(tokenResult.stdout || tokenResult.stderr || "no output").trim()}`);
  }
}

if (components.length && !capabilityGapsFile) {
  add("DANGOUI_CAPABILITY_GAPS_REQUIRED", "Real component verification requires a classified local capability-gap report.");
} else if (capabilityGapsFile) {
  const gapGate = path.resolve(path.dirname(new URL(import.meta.url).pathname), "validate-dangoui-gaps.mjs");
  const gapResult = spawnSync(process.execPath, [gapGate, "--report", path.resolve(gapRoot, capabilityGapsFile)], { encoding: "utf8" });
  if (gapResult.status !== 0) add("DANGOUI_CAPABILITY_GAPS_FAILED", `Capability-gap validation failed: ${(gapResult.stdout || gapResult.stderr || "no output").trim()}`);
}

const status = blockers.length ? "BLOCKED" : "PASS_REAL_COMPONENT_CONSUMER_H5_ONLY";
console.log(JSON.stringify({ status, root, packageManager, expectedVersion, declaredVersion: declared || null, installedVersion: installed?.version || null, platform, components, installCommand, blockers, warnings }, null, 2));
if (blockers.length) process.exit(1);
