#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export function prepareQdmpPreview({ host, appId, write = false, simulatorUrl = "", compiled = false, screenshotCaptured = false } = {}) {
  const requestedRoot = path.resolve(host || ".");
  const projectRoot = resolveFrontendRoot(requestedRoot);
  const sourceConfig = path.join(projectRoot, "project.config.json");
  if (!fs.existsSync(sourceConfig)) throw new Error(`QDMP_PROJECT_CONFIG_MISSING:${sourceConfig}`);
  const source = readJson(sourceConfig);
  const compileRoot = path.resolve(projectRoot, source.miniprogramRoot || "dist");
  const distConfig = path.join(compileRoot, "project.config.json");
  const resolvedAppId = appId || source.appid || discoverAppId(requestedRoot);
  if (!resolvedAppId) throw new Error("QDMP_APP_ID_MISSING");
  const configs = [sourceConfig, ...(fs.existsSync(distConfig) ? [distConfig] : [])];
  if (write) for (const file of configs) writeJson(file, { ...readJson(file), appid: resolvedAppId });
  const route = detectDefaultRoute(projectRoot);
  const buildFiles = ["app.json", `pages/${route?.replace(/^pages\//, "")}.wxml`, `pages/${route?.replace(/^pages\//, "")}.wxss`]
    .map((name) => path.join(compileRoot, name)).filter(fs.existsSync);
  const buildFingerprint = hash(buildFiles.map((file) => `${path.relative(compileRoot, file)}:${hash(fs.readFileSync(file))}`).join("\n"));
  const observed = simulatorUrl ? new URL(simulatorUrl) : null;
  const observedRoute = observed?.searchParams.get("page") || observed?.searchParams.get("entry") || null;
  const verification = {
    simulatorAppIdMatches: observed ? observed.searchParams.get("appId") === resolvedAppId : null,
    simulatorRouteMatches: observed ? observedRoute?.split("?")[0] === route : null,
    compiled: Boolean(compiled),
    screenshotCaptured: Boolean(screenshotCaptured),
  };
  const connected = Object.values(verification).every((value) => value === true);
  return {
    schema: "qdmp-preview-handshake/v1",
    status: connected ? "connected" : write ? "prepared" : "dry-run",
    appId: resolvedAppId,
    projectRoot,
    compileRoot,
    importDirectory: compileRoot,
    defaultRoute: route,
    buildFingerprint,
    observedSimulatorUrl: simulatorUrl || null,
    verification,
    configs: configs.map((file) => ({ file, appId: write ? readJson(file).appid : resolvedAppId })),
    checks: {
      sourceProjectConfig: true,
      compiledProjectConfig: fs.existsSync(distConfig),
      buildRequired: !fs.existsSync(distConfig),
    },
  };
}

function resolveFrontendRoot(root) {
  if (fs.existsSync(path.join(root, "project.config.json"))) return root;
  const nested = path.join(root, "frontend");
  if (fs.existsSync(path.join(nested, "project.config.json"))) return nested;
  throw new Error(`QDMP_FRONTEND_ROOT_UNRESOLVED:${root}`);
}

function discoverAppId(root) {
  const candidates = [
    path.join(root, "backend", "config", "qdmp_openapi.json"),
    path.join(path.dirname(root), "backend", "config", "qdmp_openapi.json"),
    path.join(root, "qdmp.json"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const value = readJson(file).appId;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function detectDefaultRoute(projectRoot) {
  const file = ["app.config.js", "app.config.ts"].map((name) => path.join(projectRoot, "src", name)).find(fs.existsSync);
  if (!file) return null;
  const pages = fs.readFileSync(file, "utf8").match(/\bpages\s*:\s*\[([\s\S]*?)\]/)?.[1];
  return pages?.match(/["']([^"']+)["']/)?.[1] || null;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function option(args, name, fallback = "") { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const result = prepareQdmpPreview({
      host: option(args, "--host", "."),
      appId: option(args, "--app-id"),
      write: args.includes("--write"),
      simulatorUrl: option(args, "--simulator-url"),
      compiled: args.includes("--compiled"),
      screenshotCaptured: args.includes("--screenshot-captured"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
