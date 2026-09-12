#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_REGISTRY_BASE = "https://jocelyntong.github.io/DangoUI-Brand-Skill/";

export function normalizeSourceUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url.toString();
}

function brandFromDemoUrl(value) {
  try {
    const url = new URL(value);
    return url.hash.match(/#\/brand\/([^/]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Registry request failed (${response.status}): ${url}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) throw new Error(`Registry returned non-JSON content: ${url}`);
  return response.json();
}

function remoteUrl(base, publicPath) {
  if (/^https?:\/\//.test(publicPath)) return publicPath;
  const baseUrl = new URL(base);
  if (/^\/(?:DangoUI-Brand-Skill|Dangoui-Design-System-Skill)\//.test(publicPath)) {
    return new URL(publicPath, baseUrl.origin).toString();
  }
  return new URL(publicPath.replace(/^\//, ""), baseUrl).toString();
}

export async function resolvePublicStylePack({
  sourceUrl,
  root = process.cwd(),
  registryBase = DEFAULT_REGISTRY_BASE,
  install = false,
} = {}) {
  if (!sourceUrl) return { matched: false, reason: "source-url-required" };

  const demoBrand = brandFromDemoUrl(sourceUrl);
  const normalizedSource = normalizeSourceUrl(sourceUrl);
  const migrationsRoot = path.join(root, "migrations");
  if (fs.existsSync(migrationsRoot)) {
    for (const entry of fs.readdirSync(migrationsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modFile = path.join(migrationsRoot, entry.name, "brand-mod.json");
      if (!fs.existsSync(modFile)) continue;
      const mod = readJson(modFile);
      const modSource = mod.manifest?.sourceUrl;
      const sourceMatches = modSource && normalizeSourceUrl(modSource) === normalizedSource;
      if (entry.name === demoBrand || sourceMatches) {
        return {
          matched: true,
          source: "host",
          normalizedSource,
          brand: mod.manifest?.brand || entry.name,
          displayName: mod.manifest?.displayName || entry.name,
          version: mod.manifest?.version || "local",
          manifest: mod.manifest || {},
          manifestUrl: "",
          stylePackRoot: path.relative(root, path.dirname(modFile)),
          modFile: path.relative(root, modFile),
          installedFiles: [],
          reusePolicy: mod.manifest?.reusePolicy || null,
        };
      }
    }
  }

  const localRegistryRoot = path.join(root, "public", "brand-registry", "v0.1");
  let index;
  let brandId;
  let source = "public";

  if (fs.existsSync(path.join(localRegistryRoot, "index.json"))) {
    index = readJson(path.join(localRegistryRoot, "index.json"));
    const bySource = readJson(path.join(localRegistryRoot, "by-source.json"));
    brandId = demoBrand || bySource.sources?.[normalizedSource] || "";
    source = "local";
  } else {
    const registryRoot = new URL("brand-registry/v0.1/", registryBase).toString();
    [index, brandId] = await Promise.all([
      fetchJson(new URL("index.json", registryRoot).toString()),
      demoBrand
        ? Promise.resolve(demoBrand)
        : fetchJson(new URL("by-source.json", registryRoot).toString())
            .then((value) => value.sources?.[normalizedSource] || ""),
    ]);
  }

  const entry = index.brands?.find((item) => item.id === brandId);
  if (!entry) return { matched: false, reason: "not-found", normalizedSource, registryBase };

  const manifest = source === "local"
    ? readJson(path.join(root, "public", entry.manifest.replace(/^\//, "")))
    : await fetchJson(remoteUrl(registryBase, entry.manifest));
  const targetRoot = path.join(root, "migrations", entry.id);
  const installedFiles = [];

  if (install) {
    fs.mkdirSync(targetRoot, { recursive: true });
    for (const [artifactName, artifactPath] of Object.entries(manifest.artifacts || {})) {
      const fileName = artifactPath.split("/").pop();
      const value = source === "local"
        ? readJson(path.join(root, "public", artifactPath.replace(/^\//, "")))
        : await fetchJson(remoteUrl(registryBase, artifactPath));
      const target = path.join(targetRoot, fileName);
      fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
      installedFiles.push(path.relative(root, target));
    }
  }

  return {
    matched: true,
    source,
    normalizedSource,
    brand: entry.id,
    displayName: entry.displayName,
    version: entry.version,
    manifest,
    manifestUrl: source === "local" ? entry.manifest : remoteUrl(registryBase, entry.manifest),
    stylePackRoot: path.relative(root, targetRoot),
    modFile: path.relative(root, path.join(targetRoot, "brand-mod.json")),
    installedFiles,
    reusePolicy: entry.reusePolicy,
  };
}

function opt(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    const result = await resolvePublicStylePack({
      sourceUrl: opt(args, "--source-url"),
      root: opt(args, "--root", process.cwd()),
      registryBase: opt(args, "--registry-base", DEFAULT_REGISTRY_BASE),
      install: args.includes("--install"),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    process.exit(result.matched ? 0 : 2);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  }
}
