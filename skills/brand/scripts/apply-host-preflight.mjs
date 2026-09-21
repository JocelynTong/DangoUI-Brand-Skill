#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function runApplyHostPreflight({ root = process.cwd(), brand, hostTarget, profile = "fast", phase = "implementation", write = true } = {}) {
  const startedAt = new Date();
  const rootPath = path.resolve(root);
  const migrationRoot = path.join(rootPath, "migrations", brand || "");
  const requestedHostRoot = path.resolve(rootPath, hostTarget || ".");
  const hostRoot = resolveProjectRoot(requestedHostRoot);
  const blocking = [];
  const warnings = [];
  const required = ["brand-mod.json", "brand-evidence.json", "brand-intent.json"];
  if (["standard", "certification"].includes(profile)) required.push("component-mapping.json");

  if (!brand) blocking.push("BRAND_REQUIRED");
  if (!fs.existsSync(requestedHostRoot)) blocking.push("HOST_TARGET_MISSING");
  const files = {};
  for (const name of required) {
    const file = path.join(migrationRoot, name);
    files[name] = file;
    if (!fs.existsSync(file)) blocking.push(`FROZEN_PACK_FILE_MISSING:${name}`);
  }
  const frozenDesignFiles = ["brand-application-plan.json", "design-direction-options.json", "design-direction-decision.json", "business-scope.json", "design-direction.json", "preedit-baseline-bundle.json", "structural-targets.json"];
  if (phase === "implementation") {
    for (const name of frozenDesignFiles) {
      const file = path.join(migrationRoot, name);
      files[name] = file;
      if (!fs.existsSync(file)) blocking.push(`FROZEN_DESIGN_FILE_MISSING:${name}`);
    }
  } else if (phase !== "design") {
    blocking.push(`UNKNOWN_PREFLIGHT_PHASE:${phase}`);
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

  const layoutChecks = inspectHostLayout(hostRoot);
  const targetResolution = resolveHostTarget(hostRoot);
  for (const issue of layoutChecks.issues) blocking.push(`${issue.code}:${issue.file}`);
  for (const issue of layoutChecks.warnings) warnings.push(`${issue.code}:${issue.file}`);

  const dependencies = { ...(hostPackage?.dependencies || {}), ...(hostPackage?.devDependencies || {}) };
  const hostSurface = classifyHostSurface({ hostPackage, dependencies });
  const dangouiDeclared = Boolean(dependencies.dangoui);
  if (!dangouiDeclared) {
    if (profile === "certification") blocking.push("DANGOUI_RUNTIME_NOT_DECLARED");
    else warnings.push("DANGOUI_RUNTIME_NOT_DECLARED:PARTIAL_STYLE_ONLY");
  }

  const cacheInputs = [...Object.values(files), packageFile].filter((file) => file && fs.existsSync(file));
  const cacheKey = sha256(cacheInputs.map((file) => `${path.relative(rootPath, file)}:${sha256File(file)}`).join("\n"));
  const endedAt = new Date();
  const lane = phase === "design" ? "design-host" : "apply-host";
  const result = {
    schema: `brand-${lane}-preflight/v1`,
    lane,
    brand,
    profile,
    phase,
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
    frozenDesign: {
      required: phase === "implementation",
      requiredFiles: frozenDesignFiles,
      reuseDecision: phase === "design" ? "not-yet-required" : blocking.some((item) => item.startsWith("FROZEN_DESIGN_")) ? "return-to-design-host" : "consume-without-redesign",
    },
    runtime: {
      dangouiDeclared,
      declaredVersion: dependencies.dangoui || null,
      maximumClaim: dangouiDeclared ? "runtime-verification-required" : "PARTIAL_STYLE_ONLY",
    },
    hostSurface,
    hostLayout: layoutChecks,
    targetResolution,
    blocking,
    warnings,
  };
  if (write && brand) {
    fs.mkdirSync(migrationRoot, { recursive: true });
    fs.writeFileSync(path.join(migrationRoot, `${lane}-preflight.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

function classifyHostSurface({ hostPackage, dependencies }) {
  const scripts = hostPackage?.scripts || {};
  const isTaro = Boolean(dependencies["@tarojs/taro"] || dependencies["@tarojs/cli"]);
  const isQdmp = Boolean(dependencies["taro-plugin-qd"] || Object.values(scripts).some((script) => /\bqdmp\b/i.test(script)));
  const hasMiniBuild = Object.values(scripts).some((script) => /taro\s+build[^\n]*(?:weapp|mini)|\bqdmp\s+build/i.test(script));
  const hasH5Build = Object.values(scripts).some((script) => /taro\s+build[^\n]*h5/i.test(script));
  if (isTaro && (isQdmp || hasMiniBuild)) return {
    formFactor: "mobile",
    platform: isQdmp ? "qdmp-miniapp" : "taro-miniapp",
    compatibility: hasH5Build ? ["mobile-miniapp", "mobile-h5"] : ["mobile-miniapp"],
    defaultPreviewViewport: "375x812",
    forbiddenPreviewPatterns: ["persistent-desktop-sidebar", "desktop-control-panel-compressed-into-mobile", "primary-content-column-below-72-percent"],
  };
  if (hasH5Build) return { formFactor: "responsive", platform: "web-h5", compatibility: ["mobile-h5", "desktop-web"], defaultPreviewViewport: "375x812" };
  return { formFactor: "responsive", platform: "web", compatibility: ["desktop-web", "mobile-web"], defaultPreviewViewport: "1440x900" };
}

function resolveHostTarget(hostRoot) {
  if (!fs.existsSync(hostRoot)) return { strategy: "unresolved", route: null };
  if (fs.statSync(hostRoot).isFile()) return { strategy: "explicit-file", route: path.basename(hostRoot) };
  const candidates = collectFiles(hostRoot, (file) => /(?:app\.config|router|routes)\.(?:js|ts|json)$/i.test(file), 30);
  for (const file of candidates) {
    const source = fs.readFileSync(file, "utf8");
    const pages = source.match(/\bpages\s*:\s*\[([\s\S]*?)\]/)?.[1];
    const route = pages?.match(/["']([^"']+)["']/)?.[1];
    if (route) return { strategy: "default-home-first-route", route, source: path.relative(hostRoot, file) };
  }
  return { strategy: "host-root-fallback", route: null, warning: "DEFAULT_HOME_ROUTE_NOT_DETECTED" };
}

function inspectHostLayout(hostRoot) {
  const files = collectFiles(hostRoot, (file) => /\.(?:vue|tsx?|jsx?)$/i.test(file), 400);
  const issues = [];
  const warnings = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (/\.vue$/i.test(file)) {
      const templateStart = source.search(/<template(?:\s[^>]*)?>/i);
      const templateEnd = source.lastIndexOf("</template>");
      const template = templateStart >= 0 && templateEnd > templateStart
        ? source.slice(source.indexOf(">", templateStart) + 1, templateEnd)
        : "";
      const opened = (template.match(/<view(?=[\s>])[^>]*>/gi) || []).filter((tag) => !/\/\s*>$/.test(tag)).length;
      const closed = (template.match(/<\/view\s*>/gi) || []).length;
      if (opened !== closed) issues.push({
        code: "TEMPLATE_VIEW_TAG_UNBALANCED",
        file: path.relative(hostRoot, file),
        opened,
        closed,
      });
    }
    if (/<scroll-view\b[^>]*\bscroll-x(?:\s*=\s*["']?(?:true|\{\{\s*true\s*\}\})["']?)?/i.test(source)) warnings.push({
      code: "HORIZONTAL_SCROLL_REQUIRES_VIEWPORT_QA",
      file: path.relative(hostRoot, file),
    });
  }
  return {
    scannedFiles: files.length,
    issues,
    warnings,
    qaContract: [
      "target page width equals viewport width",
      "primary vertical scroll container has no unintended horizontal range",
      "first-level content blocks remain inside viewport after brand shadow and border styles",
    ],
  };
}

function resolveProjectRoot(target) {
  if (!fs.existsSync(target) || fs.statSync(target).isFile() || fs.existsSync(path.join(target, "package.json"))) return target;
  const packages = collectFiles(target, (file) => path.basename(file) === "package.json", 40)
    .map((file) => path.dirname(file))
    .filter((dir) => fs.existsSync(path.join(dir, "src")));
  const withAppConfig = packages.find((dir) => collectFiles(path.join(dir, "src"), (file) => /app\.config\.(?:js|ts|json)$/i.test(file), 1).length);
  return withAppConfig || packages[0] || target;
}

function collectFiles(root, accept, limit) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return accept(root) ? [root] : [];
  const found = [];
  const visit = (dir) => {
    if (found.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (accept(file)) found.push(file);
      if (found.length >= limit) return;
    }
  };
  visit(root);
  return found;
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
    phase: option(args, "--phase", "implementation"),
    write: !args.includes("--no-write"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.verdict === "pass" ? 0 : 1);
}
