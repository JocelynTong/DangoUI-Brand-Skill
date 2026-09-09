#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function fail(message, extra = {}) {
  process.stderr.write(`${JSON.stringify({ ok: false, message, ...extra }, null, 2)}\n`);
  process.exit(1);
}

function ok(payload) {
  process.stdout.write(`${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`);
}

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function inferBrandKey(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    return url.hostname
      .replace(/^www\./, "")
      .replace(/\.[a-z]+$/i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeName(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || fallback;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function extractStyleSheetUrls(html, baseUrl) {
  const urls = [];
  const regex = /<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(regex)) {
    try {
      urls.push(new URL(match[1], baseUrl).toString());
    } catch {}
  }
  return unique(urls);
}

function extractInlineStyleBlocks(html) {
  const blocks = [];
  const regex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const match of html.matchAll(regex)) {
    const text = String(match[1] || "").trim();
    if (text) blocks.push(text);
  }
  return blocks;
}

function extractMetaRefreshUrl(html, baseUrl) {
  const match = String(html || "").match(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url\s*=\s*([^"';>]+)[^"']*["'][^>]*>/i);
  if (!match?.[1]) return "";
  try {
    return new URL(match[1].trim(), baseUrl).toString();
  } catch {
    return "";
  }
}

function detectBlockedHtml(html) {
  const text = String(html || "");
  if (!text) return null;
  const rules = [
    { code: "incapsula-block", pattern: /incapsula|_Incapsula_Resource|Request unsuccessful\. Incapsula incident ID/i },
    { code: "cloudflare-block", pattern: /attention required|cf-browser-verification|cloudflare/i },
    { code: "akamai-block", pattern: /akamai|reference #\d+\.[\w.]+/i },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.code;
  }
  return null;
}

function extractAssetUrls(text, baseUrl) {
  const urls = [];
  const cssUrlRegex = /url\((['"]?)(.*?)\1\)/gi;
  for (const match of text.matchAll(cssUrlRegex)) {
    const raw = (match[2] || "").trim();
    if (!raw || /^data:|^blob:/.test(raw)) continue;
    try {
      urls.push(new URL(raw, baseUrl).toString());
    } catch {}
  }

  const srcLikeRegex = /\b(?:src|href|poster|srcset)=["']([^"']+)["']/gi;
  for (const match of text.matchAll(srcLikeRegex)) {
    const raw = (match[1] || "").trim();
    if (!raw || /^data:|^blob:/.test(raw)) continue;
    const firstSrcset = raw.split(",")[0]?.trim().split(/\s+/)[0];
    try {
      urls.push(new URL(firstSrcset, baseUrl).toString());
    } catch {}
  }
  return unique(urls);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (BrandRenderedEvidenceCollector)",
      accept: "text/html, text/css, */*;q=0.8",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const root = readArg("--root", process.cwd());
  const sourceUrl = readArg("--source-url", "");
  const brand = readArg("--brand", inferBrandKey(sourceUrl));
  if (!sourceUrl) fail("--source-url is required");
  if (!brand) fail("--brand is required or inferable from --source-url");

  const outDir = path.join(root, "output", "extractor-benchmark", brand, "rendered");
  const cssDir = path.join(outDir, "css");
  ensureDir(cssDir);

  let html = "";
  let renderedUrl = sourceUrl;
  try {
    html = await fetchText(sourceUrl);
    const metaRefreshUrl = extractMetaRefreshUrl(html, sourceUrl);
    if (metaRefreshUrl) {
      renderedUrl = metaRefreshUrl;
      html = await fetchText(metaRefreshUrl);
    }
  } catch (error) {
    fail("Failed to fetch source HTML", { sourceUrl, error: String(error?.message || error) });
  }

  const blockedCode = detectBlockedHtml(html);
  if (blockedCode) {
    fail("Fetched HTML looks like an anti-bot interstitial instead of the real page.", {
      brand,
      sourceUrl,
      code: blockedCode,
      hint: "Use a real browser session / rendered snapshot as input, or switch the learn-brand flow to a browser-driven collector for this site.",
    });
  }

  const htmlPath = path.join(outDir, "rendered.html");
  fs.writeFileSync(htmlPath, html);

  const styleSheetUrls = extractStyleSheetUrls(html, renderedUrl);
  const inlineStyleBlocks = extractInlineStyleBlocks(html);
  const cssFiles = [];
  const cssWarnings = [];
  const networkEntries = [{ url: renderedUrl, type: "document" }];

  for (const styleSheetUrl of styleSheetUrls) {
    try {
      const cssText = await fetchText(styleSheetUrl);
      const filename = `${String(cssFiles.length + 1).padStart(2, "0")}-${sanitizeName(path.basename(new URL(styleSheetUrl).pathname), "style")}.css`;
      const cssPath = path.join(cssDir, filename);
      fs.writeFileSync(cssPath, cssText);
      cssFiles.push(path.relative(root, cssPath));
      networkEntries.push({ url: styleSheetUrl, type: "stylesheet" });
      for (const assetUrl of extractAssetUrls(cssText, styleSheetUrl)) {
        networkEntries.push({ url: assetUrl, type: "asset" });
      }
    } catch (error) {
      cssWarnings.push({ url: styleSheetUrl, error: String(error?.message || error) });
    }
  }

  for (const styleText of inlineStyleBlocks) {
    const filename = `${String(cssFiles.length + 1).padStart(2, "0")}-inline-style.css`;
    const cssPath = path.join(cssDir, filename);
    fs.writeFileSync(cssPath, styleText);
    cssFiles.push(path.relative(root, cssPath));
    for (const assetUrl of extractAssetUrls(styleText, renderedUrl)) {
      networkEntries.push({ url: assetUrl, type: "asset" });
    }
  }

  for (const assetUrl of extractAssetUrls(html, renderedUrl)) {
    networkEntries.push({ url: assetUrl, type: "asset" });
  }

  const networkPath = path.join(outDir, "network.json");
  fs.writeFileSync(networkPath, `${JSON.stringify({ entries: unique(networkEntries.map((entry) => `${entry.type}::${entry.url}`)).map((value) => {
    const [type, url] = value.split("::");
    return { type, url };
  }) }, null, 2)}\n`);

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    brand,
    sourceUrl,
    createdAt: new Date().toISOString(),
    htmlFile: path.relative(root, htmlPath),
    cssFiles,
    networkFile: path.relative(root, networkPath),
    warnings: cssWarnings,
  }, null, 2)}\n`);

  ok({
    brand,
    sourceUrl,
    htmlFile: path.relative(root, htmlPath),
    cssFiles,
    networkFile: path.relative(root, networkPath),
    warnings: cssWarnings,
  });
}

main().catch((error) => fail("Rendered evidence collector crashed", { error: String(error?.message || error) }));
