#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export const DEFAULT_REGISTRY_BASE = "https://jocelyntong.github.io/DangoUI-Brand-Skill/";
export const DEFAULT_REGISTRY_REQUEST_TIMEOUT_MS = 8_000;
export const DEFAULT_REGISTRY_NETWORK_TIMEOUT_MS = 15_000;

export function normalizeSourceUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url.toString();
}

export function brandFromDemoUrl(value, registryBase = DEFAULT_REGISTRY_BASE) {
  try {
    const url = new URL(value);
    const base = new URL(registryBase);
    if (url.origin !== base.origin || url.pathname.replace(/\/$/, '') !== base.pathname.replace(/\/$/, '')) return "";
    return url.hash.match(/^#\/brand\/([a-z0-9][a-z0-9-]*)(?:\/|$)/)?.[1] || "";
  } catch {
    return "";
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function registryNetwork({ requestTimeoutMs, networkTimeoutMs }) {
  for (const [name, value] of Object.entries({ requestTimeoutMs, networkTimeoutMs })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  }
  // One shared deadline bounds the whole remote resolution, including bodies
  // and sequential asset downloads, rather than allowing N full timeouts.
  const deadline = performance.now() + networkTimeoutMs;
  return async function request(url, json = false) {
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) throw Object.assign(new Error(`Registry network deadline exceeded: ${url}`), { code: "REGISTRY_NETWORK_TIMEOUT" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(requestTimeoutMs, remaining));
    try {
      const response = await fetch(url, { signal: controller.signal, ...(json ? { headers: { accept: "application/json" } } : {}) });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new Error(`Registry request failed (${response.status}): ${url}`);
      }
      if (json && !(response.headers.get("content-type") || "").includes("json")) {
        void response.body?.cancel().catch(() => {});
        throw new Error(`Registry returned non-JSON content: ${url}`);
      }
      return json ? await response.json() : Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (controller.signal.aborted) throw Object.assign(new Error(`Registry network timeout: ${url}`), { code: "REGISTRY_NETWORK_TIMEOUT", cause: error });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
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
  requestTimeoutMs = DEFAULT_REGISTRY_REQUEST_TIMEOUT_MS,
  networkTimeoutMs = DEFAULT_REGISTRY_NETWORK_TIMEOUT_MS,
} = {}) {
  if (!sourceUrl) return { matched: false, reason: "source-url-required" };
  const request = registryNetwork({ requestTimeoutMs, networkTimeoutMs });
  const fetchJson = (url) => request(url, true);
  const fetchBytes = (url) => request(url);

  const demoBrand = brandFromDemoUrl(sourceUrl, registryBase);
  const normalizedSource = normalizeSourceUrl(sourceUrl);
  const localRegistryRoot = path.join(root, "public", "brand-registry", "v0.1");
  const localIndexFile = path.join(localRegistryRoot, "index.json");
  const localSourceFile = path.join(localRegistryRoot, "by-source.json");
  const localPublishedBrand = fs.existsSync(localIndexFile) && fs.existsSync(localSourceFile)
    ? demoBrand || readJson(localSourceFile).sources?.[normalizedSource] || ""
    : "";
  const migrationsRoot = path.join(root, "migrations");
  // A library selection names a published package, not a same-named trial.
  if (!demoBrand && fs.existsSync(migrationsRoot)) {
    for (const entry of fs.readdirSync(migrationsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modFile = path.join(migrationsRoot, entry.name, "brand-mod.json");
      if (!fs.existsSync(modFile)) continue;
      const mod = readJson(modFile);
      const modSource = mod.manifest?.sourceUrl;
      const sourceMatches = modSource && normalizeSourceUrl(modSource) === normalizedSource;
      if (entry.name === demoBrand || sourceMatches) {
        // A generated local Registry entry is the publication authority. A
        // historical migration may keep an older manifest for audit, but must
        // not shadow the promoted Registry version during /brand resolution.
        if (localPublishedBrand) continue;
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
    const downloads = [];
    for (const [artifactName, artifactPath] of Object.entries(manifest.artifacts || {})) {
      downloads.push(async () => {
      const fileName = artifactPath.split("/").pop();
      const value = source === "local"
        ? readJson(path.join(root, "public", artifactPath.replace(/^\//, "")))
        : await fetchJson(remoteUrl(registryBase, artifactPath));
      const target = path.join(targetRoot, fileName);
      fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
      installedFiles.push(path.relative(root, target));
      });
    }
    for (const evidenceAsset of manifest.evidenceAssets || []) {
      if (!evidenceAsset?.path || !evidenceAsset?.installPath) continue;
      downloads.push(async () => {
      const target = path.resolve(targetRoot, evidenceAsset.installPath);
      if (!target.startsWith(`${path.resolve(targetRoot)}${path.sep}`)) {
        throw new Error(`Registry evidence install path escapes brand root: ${evidenceAsset.installPath}`);
      }
      const value = source === "local"
        ? fs.readFileSync(path.join(root, "public", evidenceAsset.path.replace(/^\//, "")))
        : await fetchBytes(remoteUrl(registryBase, evidenceAsset.path));
      verifyDeclaredHash(value, evidenceAsset.sha256, `Registry evidence hash mismatch: ${evidenceAsset.path}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, value);
      installedFiles.push(path.relative(root, target));
      });
    }
    for (const runtimeAsset of manifest.runtimeAssets || []) {
      downloads.push(async () => {
      if (!runtimeAsset?.path || !runtimeAsset?.installPath || !runtimeAsset?.sha256) {
        throw new Error("Registry runtime assets require path, installPath and sha256.");
      }
      const target = path.resolve(root, runtimeAsset.installPath);
      if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) {
        throw new Error(`Registry runtime asset install path escapes artifact root: ${runtimeAsset.installPath}`);
      }
      const value = source === "local"
        ? fs.readFileSync(path.join(root, "public", runtimeAsset.path.replace(/^\//, "")))
        : await fetchBytes(remoteUrl(registryBase, runtimeAsset.path));
      verifyDeclaredHash(value, runtimeAsset.sha256, `Registry runtime asset hash mismatch: ${runtimeAsset.path}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, value);
      installedFiles.push(path.relative(root, target));
      });
    }
    // Share the existing deadline, but do not pay an RTT for every file serially.
    let next = 0, failure;
    await Promise.all(Array.from({ length: Math.min(8, downloads.length) }, async () => {
      while (!failure && next < downloads.length) {
        const job = downloads[next++];
        try { await job(); } catch (error) { failure ||= error; }
      }
    }));
    if (failure) throw failure;
    installedFiles.sort();
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

function verifyDeclaredHash(value, expected, message) {
  if (!expected) return;
  const actual = crypto.createHash("sha256").update(value).digest("hex");
  if (actual !== expected) throw new Error(`${message}; expected ${expected}, got ${actual}`);
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
      requestTimeoutMs: Number(opt(args, "--request-timeout-ms", DEFAULT_REGISTRY_REQUEST_TIMEOUT_MS)),
      networkTimeoutMs: Number(opt(args, "--network-timeout-ms", DEFAULT_REGISTRY_NETWORK_TIMEOUT_MS)),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    process.exit(result.matched ? 0 : 2);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, null, 2)}\n`);
    process.exit(1);
  }
}
