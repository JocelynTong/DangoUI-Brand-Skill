#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand", "");
const migrationRoot = resolveMigrationRoot();
const manifestFile = path.join(migrationRoot, "source-manifest.json");

if (!command || !brand || !["rebuild", "merge", "validate"].includes(command)) {
  fail("Usage: brand-source-manifest.mjs <rebuild|merge|validate> --brand <id> [--source-url <url>] [--root <repo>]");
}

const discovered = discoverSources();
const previous = readJson(manifestFile, null);
const previousSources = Array.isArray(previous?.sources) ? previous.sources : [];

if (command === "validate") {
  if (!previous) block("SOURCE_MANIFEST_MISSING", `Missing ${relative(manifestFile)}. Rebuild it before updating this existing demo.`);
  const missing = discovered.filter((source) => !hasUrl(previousSources, source.url));
  if (missing.length) block("LEARNED_SOURCE_DROPPED", "The source manifest does not remember every previously learned website page.", { missing });
  output({ ok: true, command, brand, manifest: relative(manifestFile), sourceCount: previousSources.length, sources: previousSources });
}

const requestedUrl = opt("--source-url", "");
const requested = requestedUrl ? [{ url: normalizeUrl(requestedUrl), pageIds: ["update-input"], roles: ["update-input"], status: "active", provenance: ["workflow --source-url"] }] : [];
if (requestedUrl && !requested[0].url) block("SOURCE_URL_INVALID", `Invalid public HTTP(S) source URL: ${requestedUrl}`);

const sources = mergeSources(previousSources, discovered, requested);
if (previousSources.some((source) => !hasUrl(sources, source.url))) {
  block("LEARNED_SOURCE_DROPPED", "An existing learned source would be removed. Retire it explicitly instead of deleting it.");
}

const manifest = {
  schema: "brand-source-manifest/v1",
  brand,
  policy: {
    updateMode: "inherit-and-append",
    removal: "explicit-retirement-only",
    blockingCode: "LEARNED_SOURCE_DROPPED"
  },
  sources
};
fs.mkdirSync(migrationRoot, { recursive: true });
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
output({ ok: true, command, brand, manifest: relative(manifestFile), sourceCount: sources.length, added: sources.filter((source) => !hasUrl(previousSources, source.url)).map((source) => source.url), sources });

function discoverSources() {
  const found = [];
  const observationFile = path.join(migrationRoot, "source-observation-manifest.json");
  const observation = readJson(observationFile, null);
  add(observation?.sourceUrl, "source-root", "primary", relative(observationFile));
  for (const page of observation?.pages || []) add(page?.url, page?.id || "observed-page", "observed-page", relative(observationFile));

  const evidenceFile = path.join(migrationRoot, "brand-evidence.json");
  const evidence = readJson(evidenceFile, null);
  add(evidence?.sourceUrl, "evidence-root", "primary", relative(evidenceFile));

  const previewFile = path.join(root, "public", "brand-previews", `${brand}.json`);
  const preview = readJson(previewFile, null);
  add(preview?.sourceUrl, "preview-root", "primary", relative(previewFile));

  const registryFile = path.join(root, "public", "brand-previews", "registry.json");
  const registry = readJson(registryFile, null);
  const entry = registry?.brands?.find((item) => item.id === brand);
  add(entry?.sourceUrl, "registry-root", "primary", relative(registryFile));
  for (const url of entry?.canonicalSources || []) add(url, "registry-canonical", "canonical", relative(registryFile));
  return mergeSources(found);

  function add(value, pageId, role, provenance) {
    const url = normalizeUrl(value);
    if (!url) return;
    found.push({ url, pageIds: [pageId], roles: [role], status: "active", provenance: [provenance] });
  }
}

function mergeSources(...groups) {
  const byUrl = new Map();
  for (const source of groups.flat()) {
    const url = normalizeUrl(source?.url);
    if (!url) continue;
    const current = byUrl.get(url);
    if (!current) {
      byUrl.set(url, {
        url,
        pageIds: unique(source.pageIds || [source.pageId || "unknown"]),
        roles: unique(source.roles || [source.role || "observed-page"]),
        status: source.status || "active",
        provenance: unique(source.provenance || [])
      });
      continue;
    }
    current.provenance = unique([...(current.provenance || []), ...(source.provenance || [])]);
    current.pageIds = unique([...(current.pageIds || []), ...(source.pageIds || [source.pageId].filter(Boolean))]);
    current.roles = unique([...(current.roles || []), ...(source.roles || [source.role].filter(Boolean))]);
    if (source.status === "retired") current.status = "retired";
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function resolveMigrationRoot() {
  const registry = readJson(path.join(root, "public", "brand-previews", "registry.json"), null);
  const entry = registry?.brands?.find((item) => item.id === brand);
  return path.resolve(root, entry?.migrationRoot || `migrations/${brand}`);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch { return ""; }
}

function hasUrl(sources, url) { return sources.some((source) => normalizeUrl(source.url) === normalizeUrl(url)); }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function relative(file) { return path.relative(root, file); }
function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; }
function output(payload) { process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`); process.exit(0); }
function block(code, message, extra = {}) { process.stdout.write(`${JSON.stringify({ ok: false, code, brand, message, ...extra }, null, 2)}\n`); process.exit(1); }
function fail(message) { console.error(message); process.exit(1); }
