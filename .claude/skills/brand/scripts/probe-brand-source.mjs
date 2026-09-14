#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand", "");
if (!brand) fail("Usage: probe-brand-source.mjs --brand <id> [--write] [--bootstrap-approved] [--fixture-manifest <json>]");
const registry = readJson(path.join(root, "public", "brand-previews", "registry.json"), { brands: [] });
const entry = registry.brands?.find((item) => item.id === brand);
if (!entry) fail(`Unknown Registry brand: ${brand}`);
const migrationRoot = path.resolve(root, entry.migrationRoot || `migrations/${brand}`);
const sourceManifest = readJson(path.join(migrationRoot, "source-manifest.json"), null);
const sources = (sourceManifest?.sources || entry.canonicalSources?.map((url) => ({ url })) || []).filter((item) => item.status !== "retired");
if (!sources.length) fail("No active sources to probe.");
const fixture = readJson(path.resolve(root, opt("--fixture-manifest", "")), {});
const pages = [];
for (const source of sources) pages.push(await probe(source));
const report = { schema: "brand-light-source-probe/v1", brand, pages, generatedAt: new Date().toISOString() };
const baselineFile = path.join(migrationRoot, "light-probe-baseline.json");
const previous = readJson(baselineFile, null);
report.decision = compare(previous, report);
if (args.includes("--bootstrap-approved") && !previous) {
  if (entry.status !== "fidelity-pass") fail("BOOTSTRAP_REQUIRES_FIDELITY_PASS");
  writeJson(baselineFile, { ...report, decision: undefined, sealedAt: new Date().toISOString() });
  report.decision = { route: "unchanged", changedPages: [], reason: "approved baseline established" };
}
if (args.includes("--write")) writeJson(path.join(migrationRoot, "light-probe.json"), report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

async function probe(source) {
  const url = normalizeUrl(source.url);
  const fixtureItem = fixture[url];
  let html; let status; let etag = null; let lastModified = null;
  if (fixtureItem) {
    html = String(fixtureItem.html || ""); status = Number(fixtureItem.status || 200); etag = fixtureItem.etag || null; lastModified = fixtureItem.lastModified || null;
  } else {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Number(opt("--timeout-ms", "10000")));
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { "user-agent": "DangoUI-Brand-Skill-Light-Probe/1.0" } });
      status = response.status; etag = response.headers.get("etag"); lastModified = response.headers.get("last-modified"); html = await response.text();
    } catch (error) { return { id: pageId(source, url), url, reachable: false, error: error.name || error.message }; }
    finally { clearTimeout(timer); }
  }
  const normalized = normalizeHtml(html);
  const assets = extractAssets(html, url);
  const structure = extractStructure(normalized);
  return { id: pageId(source, url), url, reachable: status >= 200 && status < 400, status, etag, lastModified, contentSha256: hash(normalized), structureSha256: hash(structure), assetUrlSha256: hash(assets), assetCount: assets.length };
}
function compare(previous, current) {
  if (!previous?.pages) return { route: "baseline-required", changedPages: current.pages.map((item) => item.id), reason: "no prior light-probe baseline" };
  const before = new Map(previous.pages.map((item) => [item.id, item]));
  const changed = current.pages.filter((item) => { const old = before.get(item.id); return !old || !item.reachable || ["contentSha256", "structureSha256", "assetUrlSha256"].some((key) => item[key] !== old[key]); }).map((item) => item.id);
  return changed.length ? { route: "deep-fingerprint-required", changedPages: changed, reason: "lightweight source signature changed" } : { route: "unchanged", changedPages: [], reason: "all lightweight signatures match" };
}
function normalizeHtml(html) { return String(html).replace(/<!--([\s\S]*?)-->/g, "").replace(/\s(?:nonce|data-reactroot|data-v-[\w-]+)=(['"])[\s\S]*?\1/gi, "").replace(/\s+/g, " ").trim(); }
function extractAssets(html, base) { const found = [...String(html).matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)].map((match) => { try { return new URL(match[1], base).toString(); } catch { return match[1]; } }); return [...new Set(found)].sort(); }
function extractStructure(html) { return [...html.matchAll(/<(header|nav|main|section|article|aside|footer|h[1-3]|form|button)\b/gi)].map((match) => match[1].toLowerCase()).join(">"); }
function pageId(source, url) { return source.pageIds?.[0] || source.pageId || new URL(url).pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home"; }
function normalizeUrl(value) { const url = new URL(value); url.hash = ""; return url.toString(); }
function hash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; }
function readJson(file, fallback) { if (!file) return fallback; try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
