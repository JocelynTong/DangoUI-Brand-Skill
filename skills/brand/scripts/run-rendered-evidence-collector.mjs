#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { resolveBrowserRuntime } from "./resolve-browser-runtime.mjs";
import { classifyBrowserFailure } from "./source-capture-policy.mjs";
import { detectBlockedHtml } from "./source-block-page-policy.mjs";
import { inspectRenderedAsset } from "./rendered-asset-specs.mjs";
import { installRenderedSurfaceSampler } from "./rendered-surface-sampler.mjs";
import { createInlineSvgEvidenceArchive } from "./archive-inline-svg-evidence.mjs";
import {
  MAX_RENDERED_ASSET_BYTES,
  extensionForRenderedAsset,
  shouldArchiveRenderedResponse,
} from "./rendered-asset-archive-policy.mjs";

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

// Only an already-observed reject/decline cookie button may be requested.
// Never remove a banner, write cookies, or accept arbitrary dialogs via script.
export async function rejectObservedCookieBanner(page, { selector = '', outDir }) {
  if (!selector) return { status: 'not-requested' };
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible', timeout: 8000 });
  const label = (await button.innerText({ timeout: 5000 })).trim();
  if (!/^(reject all cookies|decline all cookies|reject all|decline all|拒绝所有 Cookie|拒绝所有cookies)$/i.test(label)) throw new Error('COOKIE_REJECTION_LABEL_MISMATCH');
  const before = path.join(outDir, 'cookie-before.png');
  const after = path.join(outDir, 'cookie-after.png');
  await page.screenshot({ path: before, type: 'png', timeout: 5000 });
  await button.click({ timeout: 5000 });
  await button.waitFor({ state: 'hidden', timeout: 5000 });
  await page.screenshot({ path: after, type: 'png', timeout: 5000 });
  return { status: 'rejected-via-visible-button', selector, label, capturedAt: new Date().toISOString(), before, after };
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

// Geometry/CSS visibility only. This does not certify arbitrary paint occlusion,
// masks, clip-paths, or keyboard navigation.
export function installEffectiveVisibility() {
  window.__brandEffectiveVisibility = (node) => {
    const rect = node.getBoundingClientRect();
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
    const reasons = [];
    if (rect.width <= 0 || rect.height <= 0) reasons.push("empty-bounds");
    if (right <= left || bottom <= top) reasons.push("outside-viewport");
    let opacity = 1;
    const rootStyle = getComputedStyle(document.documentElement);
    for (let current = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") reasons.push("hidden-by-css");
      opacity *= Number(style.opacity || 1);
      if (current === node) continue;
      // Root overflow is applied to the viewport, not the scrolled root's
      // document-coordinate box. In standards mode body overflow propagates
      // only when both root overflow axes are visible; ordinary nested scroll
      // containers still clip against their own client boxes below.
      const viewportOverflowOwner = current === document.documentElement ||
        current === document.scrollingElement ||
        (current === document.body && rootStyle.overflowX === "visible" && rootStyle.overflowY === "visible");
      if (viewportOverflowOwner) continue; // Already intersected 0..innerWidth/Height.
      const bounds = current.getBoundingClientRect();
      const clipX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX);
      const clipY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
      // client box coordinates are not transformed. Conservatively withhold
      // transformed clip contexts instead of comparing incompatible units.
      if ((clipX || clipY) && (style.transform !== "none" || (style.scale && style.scale !== "none") || (style.rotate && style.rotate !== "none") || style.perspective !== "none")) reasons.push("transformed-clip-ancestor-unresolved");
      if (clipX) { left = Math.max(left, bounds.left + current.clientLeft); right = Math.min(right, bounds.left + current.clientLeft + current.clientWidth); }
      if (clipY) { top = Math.max(top, bounds.top + current.clientTop); bottom = Math.min(bottom, bounds.top + current.clientTop + current.clientHeight); }
    }
    if (opacity <= 0.02) reasons.push("ancestor-opacity");
    if ((right <= left || bottom <= top) && !reasons.includes("outside-viewport") && !reasons.includes("empty-bounds")) reasons.push("clipped-by-overflow-ancestor");
    const effectiveRect = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    const visible = !reasons.length && effectiveRect.width > 0 && effectiveRect.height > 0;
    return { visible, reasons: reasons.length ? [...new Set(reasons)] : [effectiveRect.width < rect.width || effectiveRect.height < rect.height ? "partially-clipped" : "within-geometry-bounds"], effectiveRect, boundary: "conservative viewport/overflow/CSS only; transformed clips and arbitrary occlusion unverified; explicit child visibility overrides may be withheld" };
  };
}

// Observe passive states only: never click, submit, navigate or type into forms.
// Each sample retains the actual source language, pseudo-state and raster hash.
export async function collectPassiveControlStates(page, outDir, root, options = {}) {
  const directory = path.join(outDir, "control-states");
  ensureDir(directory);
  const entries = [];
  const excludedControls = [];
  const query = options.selector || "button:not([disabled]),a[href],[role='button'],input:not([disabled])";
  const controls = page.locator(query);
  const total = Math.min(await controls.count(), 80);
  for (let index = 0; index < total && entries.length < (options.maxControls || 3); index += 1) {
    const node = controls.nth(index);
    const rect = await node.boundingBox();
    const visibility = await node.evaluate((element) => window.__brandEffectiveVisibility(element));
    const viewport = page.viewportSize();
    if (!visibility.visible || visibility.effectiveRect.width < 24 || visibility.effectiveRect.height < 24) { excludedControls.push({ index, visibility }); continue; }
    if (!rect || rect.width < 24 || rect.height < 24 || rect.x < 0 || rect.x + rect.width > viewport.width || rect.y < 0 || rect.y + rect.height > viewport.height) continue;
    const states = [];
    const snapshot = async (label) => {
      const fact = await node.evaluate((element) => {
        const rect = element.getBoundingClientRect(); const css = getComputedStyle(element);
        const properties = ["color", "background-color", "border-radius", "box-shadow", "font-family", "font-size", "padding", "transform", "opacity", "filter", "outline", "transition-duration"];
        const pseudo = (name) => { const style = getComputedStyle(element, name); return { content: style.content, display: style.display, ...Object.fromEntries(properties.map((key) => [key, style.getPropertyValue(key)])) }; };
        return { tag: element.tagName, text: (element.textContent || "").trim().slice(0, 160), id: element.id, className: String(element.className), page: location.href, documentLang: document.documentElement.lang, rect: [rect.x, rect.y, rect.width, rect.height], visibility: window.__brandEffectiveVisibility(element), hover: element.matches(":hover"), focus: element === document.activeElement, focusVisible: element.matches(":focus-visible"), activationPerformed: false, runningAnimationCount: element.getAnimations().filter((animation) => animation.playState === "running").length, computed: Object.fromEntries(properties.map((name) => [name, css.getPropertyValue(name)])), pseudoElements: { "::before": pseudo("::before"), "::after": pseudo("::after") } };
      });
      const file = path.join(directory, `${index}-${label}.png`);
      await page.screenshot({ path: file, type: "png" });
      states.push({ state: label, elapsedMs: Date.now() - startedAt, capture: { path: path.relative(root, file), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }, ...fact });
    };
    const startedAt = Date.now();
    try {
      await page.mouse.move(0, 0);
      await snapshot("default");
      await node.hover({ timeout: 2000 });
      await snapshot("hover-transition-sample");
      await page.waitForTimeout(350);
      await snapshot("hover-settled-sample");
      await page.mouse.move(-10, -10);
      await page.waitForTimeout(350);
      await node.focus({ timeout: 2000 });
      await snapshot("focus");
      await node.evaluate((element) => element.blur());
      await page.mouse.move(-10, -10);
      await page.waitForTimeout(350);
      await snapshot("restored");
      entries.push({ locator: { query, index }, trigger: ["mouse-move", "hover", "focus", "blur", "mouseleave"], activationPerformed: false, states, changedComputedProperties: Object.keys(states[0].computed).filter((key) => states.some((state) => state.computed[key] !== states[0].computed[key])) });
    } catch (error) {
      entries.push({ locator: { index }, status: "unresolved", reason: String(error.message), states });
    } finally {
      await node.evaluate((element) => element.blur()).catch(() => {});
      await page.mouse.move(0, 0);
    }
  }
  return { schema: "rendered-control-states/v1", sourceUrl: page.url(), entries, excludedControls, activationPerformed: false, boundary: "Samples prove only captured hover/programmatic-focus facts; not keyboard certification, arbitrary occlusion, animation completeness or click outcomes." };
}

async function collectWithBrowser(sourceUrl, outDir, options = {}) {
  const { chromium } = await resolveBrowserRuntime({ artifactRoot: options.root });
  const framesDir = path.join(outDir, "browser-frames");
  const videoDir = path.join(outDir, "browser-video");
  const assetsDir = path.join(outDir, "browser-assets");
  ensureDir(framesDir);
  ensureDir(videoDir);
  ensureDir(assetsDir);
  const cssByUrl = new Map();
  const networkEntries = [];
  const pendingResponses = [];
  const archivedAssets = [];
  const archivedHashes = new Map();
  const inlineArchive = createInlineSvgEvidenceArchive({ outputDir: outDir });
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const viewport = { width: Number(options.width || 1440), height: Number(options.height || 900) };
    const context = await browser.newContext({ viewport, locale: "en-US", colorScheme: "light", recordVideo: { dir: videoDir } });
    await context.addInitScript(installEffectiveVisibility);
    await context.addInitScript(installRenderedSurfaceSampler);
    const page = await context.newPage();
    const pageSessionStartedAt = Date.now();
    page.on("response", (response) => {
      const type = response.request().resourceType();
      networkEntries.push({ url: response.url(), type });
      const headers = response.headers();
      const contentType = headers["content-type"] || "";
      const contentLength = Number(headers["content-length"] || 0);
      if (type === "stylesheet" || /text\/css/i.test(contentType)) {
        pendingResponses.push(response.text().then((text) => cssByUrl.set(response.url(), text)).catch(() => {}));
      }
      if (shouldArchiveRenderedResponse({ resourceType: type, contentType, contentLength, status: response.status() })) {
        pendingResponses.push(response.body().then((body) => {
          if (!body.length || body.length > MAX_RENDERED_ASSET_BYTES) return;
          const sha256 = crypto.createHash("sha256").update(body).digest("hex");
          const existingPath = archivedHashes.get(sha256);
          const localPath = existingPath || path.join(assetsDir, `${sha256.slice(0, 20)}${extensionForRenderedAsset(response.url(), contentType)}`);
          if (!existingPath) {
            fs.writeFileSync(localPath, body);
            archivedHashes.set(sha256, localPath);
          }
          archivedAssets.push({
            url: response.url(),
            resourceType: type,
            contentType: contentType.split(";")[0],
            bytes: body.length,
            sha256,
            localPath: path.relative(options.root || process.cwd(), localPath),
            duplicateOf: existingPath ? path.relative(options.root || process.cwd(), existingPath) : null,
          });
        }).catch(() => {}));
      }
    });
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1_200);
    await page.evaluate(async () => { try { await document.fonts?.ready; } catch {} });
    const openingFramePath = path.join(outDir, "browser-opening.png");
    await page.screenshot({ path: openingFramePath, type: "png" });
    const probeSpecs = await inspectRenderedAsset(openingFramePath, "image/png");
    if (probeSpecs.inspection.status !== "inspected" || !(probeSpecs.intrinsicSize?.width > 0 && probeSpecs.intrinsicSize?.height > 0)) {
      throw new Error("EVIDENCE_CAPTURE_NOT_PERSISTABLE: opening raster could not be re-read and decoded.");
    }
    const capturePersistenceProbe = {
      status: "passed", checkedAt: new Date().toISOString(), beforeFullCollection: true,
      capture: { path: path.relative(options.root || process.cwd(), openingFramePath), sha256: crypto.createHash("sha256").update(fs.readFileSync(openingFramePath)).digest("hex") },
      intrinsicSize: probeSpecs.intrinsicSize, inspection: probeSpecs.inspection,
    };
    // Image-led campaign/game sites often keep a cinematic loader on screen
    // after DOMContentLoaded and expose little or no semantic text.  Give the
    // visual surface a bounded settling window instead of treating the loader
    // as the final page or using text volume as the only readiness signal.
    let lastSettleSignature = "";
    let stableSettleCount = 0;
    let settleState = null;
    let settleTimedOut = true;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      settleState = await page.evaluate(() => {
        const visible = (node) => {
          const rect = node.getBoundingClientRect();
          const visibility = window.__brandEffectiveVisibility(node);
          return visibility.visible && visibility.effectiveRect.width >= 24 && visibility.effectiveRect.height >= 24;
        };
        const visualNodes = [...document.querySelectorAll("img,video,canvas,svg")].filter(visible);
        const backgroundNodes = [...document.querySelectorAll("body *")]
          .filter((node) => visible(node) && getComputedStyle(node).backgroundImage !== "none")
          .slice(0, 40);
        const blockingAutoplayVideos = [...document.querySelectorAll("video[autoplay]")]
          .filter((video) => visible(video) && !video.loop && !video.ended && video.readyState >= 2);
        const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
        return {
          readyState: document.readyState,
          scrollHeight: Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight || 0),
          textLength: text.length,
          visualMediaCount: visualNodes.length + backgroundNodes.length,
          blockingAutoplayVideoCount: blockingAutoplayVideos.length,
          blockingAutoplayVideos: blockingAutoplayVideos.map((video) => ({
            id: video.id || "",
            className: video.className || "",
            currentTime: Number(video.currentTime || 0),
            duration: Number.isFinite(video.duration) ? Number(video.duration) : null,
          })),
        };
      });
      const signature = `${settleState.readyState}:${settleState.scrollHeight}:${settleState.textLength}:${settleState.visualMediaCount}:${settleState.blockingAutoplayVideoCount}`;
      stableSettleCount = signature === lastSettleSignature ? stableSettleCount + 1 : 0;
      lastSettleSignature = signature;
      const hasMeaningfulSurface = settleState.textLength >= 80 || settleState.visualMediaCount >= 2;
      const openingMediaFinished = settleState.blockingAutoplayVideoCount === 0;
      if (attempt >= 3 && stableSettleCount >= 2 && hasMeaningfulSurface && openingMediaFinished) {
        settleTimedOut = false;
        break;
      }
      await page.waitForTimeout(1_000);
    }
    const consentAction = await rejectObservedCookieBanner(page, { selector: options.cookieRejectSelector, outDir });
    const interactionEvidence = await collectPassiveControlStates(page, outDir, options.root || process.cwd());
    const interactionEvidencePath = path.join(outDir, "control-state-evidence.json");
    fs.writeFileSync(interactionEvidencePath, `${JSON.stringify(interactionEvidence, null, 2)}\n`);
    const frames = [];
    let previousY = -1;
    let previousControllerSignature = "";
    let unchangedControllerCount = 0;
    for (let index = 0; index < 36; index += 1) {
      const state = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        lang: document.documentElement.lang || "",
        readyState: document.readyState,
        scrollY: window.scrollY,
        scrollHeight: Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight || 0),
        viewportHeight: window.innerHeight,
        fontsReady: document.fonts?.status === "loaded",
        totalImages: document.images.length,
        loadedImages: [...document.images].filter((image) => image.complete).length,
        visibleImagePlacements: [...document.images].flatMap((image) => {
          const rect = image.getBoundingClientRect(); const visibility = window.__brandEffectiveVisibility(image);
          if (!image.currentSrc || !visibility.visible) return [];
          return [{ url: image.currentSrc, tag: "img", alt: image.alt || "", id: image.id || "", rect: [rect.x, rect.y, rect.width, rect.height], visibility, intrinsicSize: { width: image.naturalWidth, height: image.naturalHeight }, page: location.href, documentLang: document.documentElement.lang }];
        }),
        visibleImages: [...document.images].filter((image) => window.__brandEffectiveVisibility(image).visible).length,
        visibleLoadedImages: [...document.images].filter((image) => window.__brandEffectiveVisibility(image).visible && image.complete && image.naturalWidth > 0).length,
        environment: (() => {
          const controllerNodes = [...document.querySelectorAll(".vp-slide,.swiper-container,.swiper-slide,[data-fullpage],.fullpage-wrapper,#fullpage")];
          const visibleControllers = controllerNodes.filter((node) => { const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); return Number(style.opacity || 1) > 0 && rect.width >= innerWidth * .6 && rect.height >= innerHeight * .6; });
          const primaryActiveSlides = [...document.querySelectorAll(".swiper-container > .swiper-wrapper > .swiper-slide.swiper-slide-active,[data-fullpage] > [aria-current='true'],#fullpage > .active,.fullpage-wrapper > .active")]
            .filter((node) => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return rect.width >= innerWidth * .5 && rect.height >= innerHeight * .5 && style.display !== "none" && style.visibility !== "hidden"; });
          const fallbackActiveSlides = [...document.querySelectorAll(".swiper-slide-active,[aria-current='true'],.page.active,.page.current,.page.on")]
            .filter((node) => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return rect.width >= innerWidth * .5 && rect.height >= innerHeight * .5 && style.display !== "none" && style.visibility !== "hidden"; });
          const activeSlides = primaryActiveSlides.length ? primaryActiveSlides : fallbackActiveSlides;
          const viewportPages = [...document.querySelectorAll(".swiper-container > .swiper-wrapper > .swiper-slide,[data-fullpage] > *,#fullpage > *,.fullpage-wrapper > *")]
            .filter((node) => { const rect = node.getBoundingClientRect(); return rect.width >= innerWidth * .5 && rect.height >= innerHeight * .5; });
          return {
            autoTranslated: document.documentElement.classList.contains("translated-ltr") || document.documentElement.classList.contains("translated-rtl") || Boolean(document.querySelector(".goog-te-banner-frame")),
            documentLang: document.documentElement.lang || "",
            htmlClass: document.documentElement.className || "",
            scrollInput: "native-wheel",
            viewportControllerRequired: visibleControllers.length > 0,
            viewportControllerInitialized: visibleControllers.length > 0,
            viewportTriggeredCount: visibleControllers.length,
            viewportPageCount: viewportPages.length,
            activeControllerSignals: activeSlides.map((node) => ({
              className: String(node.className || ""),
              ariaCurrent: node.getAttribute("aria-current") || "",
              text: (node.innerText || "").replace(/\s+/g, " ").trim().slice(0, 120),
            })).slice(0, 8),
          };
        })(),
        ...window.__brandRenderedSurface(),
      }));
      const framePath = path.join(framesDir, `${String(index).padStart(3, "0")}.png`);
      await page.screenshot({ path: framePath, type: "png" });
      state.inlineSvgEvidence = await inlineArchive.capture(page, { frameIndex: index, screenshotPath: framePath });
      frames.push({ ...state, path: framePath, capturedAt: new Date().toISOString(), elapsedMs: Date.now() - pageSessionStartedAt });
      const atEnd = state.scrollY + state.viewportHeight >= state.scrollHeight - 4;
      const viewportControlled = state.environment?.viewportControllerRequired === true;
      const controllerSignature = JSON.stringify(state.environment?.activeControllerSignals || []);
      unchangedControllerCount = viewportControlled && controllerSignature === previousControllerSignature
        ? unchangedControllerCount + 1
        : 0;
      previousControllerSignature = controllerSignature;
      if ((!viewportControlled && atEnd) || (!viewportControlled && state.scrollY === previousY)) break;
      if (viewportControlled && index >= 11) break;
      previousY = state.scrollY;
      await page.mouse.wheel(0, Math.max(540, Math.round(state.viewportHeight * 0.82)));
      if (viewportControlled && unchangedControllerCount >= 2) await page.keyboard.press("PageDown");
      await page.waitForTimeout(450);
    }
    await page.evaluate(async () => { await Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); setTimeout(resolve, 2500); }))); });
    const componentInventory = await page.evaluate(() => {
      const selectorFor = (node) => {
        if (node.id) return `${node.tagName.toLowerCase()}#${CSS.escape(node.id)}`;
        const testId = node.getAttribute("data-testid");
        if (testId) return `${node.tagName.toLowerCase()}[data-testid="${CSS.escape(testId)}"]`;
        const classes = [...node.classList].slice(0, 3).map((name) => `.${CSS.escape(name)}`).join("");
        return `${node.tagName.toLowerCase()}${classes}`;
      };
      const familyFor = (node) => {
        const tag = node.tagName.toLowerCase();
        const role = node.getAttribute("role") || "";
        const type = String(node.getAttribute("type") || "").toLowerCase();
        if (role === "tab") return "tab";
        if (["checkbox", "radio", "switch"].includes(role) || ["checkbox", "radio"].includes(type)) return "selection-control";
        if (["combobox", "listbox", "option"].includes(role) || tag === "select") return "select";
        if (["textbox", "searchbox"].includes(role) || ["input", "textarea"].includes(tag)) return type === "search" || role === "searchbox" ? "search-input" : "text-input";
        if (tag === "button" || role === "button") return "button";
        if (tag === "a") return "link-action";
        if (tag === "article") return "content-card";
        return "interactive-container";
      };
      const styleSnapshot = (style) => ({
        display: style.display,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderTop: style.borderTop,
        borderRight: style.borderRight,
        borderBottom: style.borderBottom,
        borderLeft: style.borderLeft,
        borderRadius: style.borderRadius,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        rowGap: style.rowGap,
        columnGap: style.columnGap,
        boxShadow: style.boxShadow,
        filter: style.filter,
        minHeight: style.minHeight,
        content: style.content,
      });
      const parentSnapshot = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          selector: selectorFor(node),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          computed: styleSnapshot(getComputedStyle(node)),
          before: styleSnapshot(getComputedStyle(node, "::before")),
          after: styleSnapshot(getComputedStyle(node, "::after")),
        };
      };
      const nodes = [...document.querySelectorAll([
        "input", "select", "textarea", "button", "a", "article",
        "[role=button]", "[role=tab]", "[role=checkbox]", "[role=radio]", "[role=switch]",
        "[role=combobox]", "[role=listbox]", "[role=option]", "[role=searchbox]", "[role=textbox]"
      ].join(","))];
      const items = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const visibility = window.__brandEffectiveVisibility(node);
        if (!visibility.visible) return null;
        return {
          family: familyFor(node),
          selector: selectorFor(node),
          tag: node.tagName.toLowerCase(),
          role: node.getAttribute("role") || null,
          type: node.getAttribute("type") || null,
          text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
          placeholder: node.getAttribute("placeholder") || null,
          ariaLabel: node.getAttribute("aria-label") || null,
          state: {
            disabled: Boolean(node.disabled || node.getAttribute("aria-disabled") === "true"),
            checked: typeof node.checked === "boolean" ? node.checked : null,
            expanded: node.getAttribute("aria-expanded"),
            selected: node.getAttribute("aria-selected"),
          },
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          visibility,
          computed: styleSnapshot(style),
          before: styleSnapshot(getComputedStyle(node, "::before")),
          after: styleSnapshot(getComputedStyle(node, "::after")),
          ancestors: [parentSnapshot(node.parentElement), parentSnapshot(node.parentElement?.parentElement)].filter(Boolean),
        };
      }).filter(Boolean).slice(0, 400);
      const familyCounts = items.reduce((counts, item) => {
        counts[item.family] = (counts[item.family] || 0) + 1;
        return counts;
      }, {});
      return { schema: "brand-component-inventory/v1", capturedAt: new Date().toISOString(), familyCounts, items };
    });
    const componentInventoryPath = path.join(outDir, "component-inventory.json");
    fs.writeFileSync(componentInventoryPath, `${JSON.stringify(componentInventory, null, 2)}\n`);
    const html = await page.content();
    const fullPagePath = path.join(outDir, "browser-full-page.png");
    await page.screenshot({ path: fullPagePath, type: "png", fullPage: true });
    await Promise.allSettled(pendingResponses);
    for (const asset of archivedAssets) {
      asset.specs = await inspectRenderedAsset(path.resolve(options.root || process.cwd(), asset.localPath), asset.contentType);
      asset.visiblePlacements = frames.flatMap((frame, frameIndex) => (frame.visibleImagePlacements || []).filter((item) => item.url === asset.url).map((item) => ({ ...item, frameIndex })));
      asset.usageStatus = asset.visiblePlacements.length ? "visible-dom-bound" : "unresolved";
    }
    const archivedAssetsPath = path.join(outDir, "browser-assets.json");
    fs.writeFileSync(archivedAssetsPath, `${JSON.stringify({
      schema: "rendered-visual-assets/v1",
      sourceUrl,
      capturedAt: new Date().toISOString(),
      maxAssetBytes: MAX_RENDERED_ASSET_BYTES,
      assetCount: archivedAssets.length,
      uniqueAssetCount: archivedHashes.size,
      assets: archivedAssets,
    }, null, 2)}\n`);
    const finalState = frames.at(-1) || {};
    const textSampleCount = new Set(frames.flatMap((frame) => frame.visibleTextSamples || []).map((sample) => sample.text)).size;
    const maxVisualMediaCount = Math.max(0, ...frames.map((frame) => Number(frame.visualMediaCount || 0)));
    const imageRequestCount = networkEntries.filter((entry) => entry.type === "image" || entry.type === "media").length;
    if (detectBlockedHtml(html)) throw new Error("Browser reached an anti-bot interstitial instead of brand content.");
    if (imageRequestCount > 0 && archivedHashes.size === 0) {
      throw new Error("VISUAL_ASSET_ARCHIVE_EMPTY: browser loaded image/media requests but persisted no reusable response bodies.");
    }
    if (html.length < 1000 || (textSampleCount < 3 && maxVisualMediaCount < 1 && imageRequestCount < 5)) {
      throw new Error("Browser rendered too little visual or textual content to qualify as source evidence.");
    }
    const rawCapturePath = path.join(outDir, "raw-capture.json");
    const inlineArchivePath = path.join(outDir, "inline-svg-evidence.json");
    fs.writeFileSync(inlineArchivePath, `${JSON.stringify(inlineArchive.summary(), null, 2)}\n`, { flag: "wx" });
    const captureEnvironment = frames.at(-1)?.environment || frames[0]?.environment || null;
    const rawCapture = {
      pageId: options.pageId || "source",
      url: sourceUrl,
      capturedAt: new Date().toISOString(),
      captureMode: "native-wheel-viewport-settled",
      capturePersistenceProbe,
      consentAction,
      timing: { timebase: "page-session-wall-clock", startedAt: new Date(pageSessionStartedAt).toISOString(), videoOffsetVerified: false },
      lifecycle: {
        openingFrame: openingFramePath,
        settleTimedOut,
        settledState: settleState,
      },
      captureEnvironment,
      componentInventory: {
        path: componentInventoryPath,
        familyCounts: componentInventory.familyCounts,
        itemCount: componentInventory.items.length,
      },
      frames: frames.map((frame, index) => ({
        clientHeight: viewport.height,
        clientWidth: viewport.width,
        environment: frame.environment,
        elapsedMs: frame.elapsedMs,
        capturedAt: frame.capturedAt,
        file: path.join(framesDir, `${String(index).padStart(3, "0")}.png`),
        visibleImagePlacements: frame.visibleImagePlacements,
        fontsReady: frame.fontsReady,
        index,
        loadedImages: frame.loadedImages,
        scrollHeight: frame.scrollHeight,
        scrollTop: frame.scrollY,
        totalImages: frame.totalImages,
        visibleImages: frame.visibleImages,
        visibleLoadedImages: frame.visibleLoadedImages,
        visualMediaCount: frame.visualMediaCount,
        visibleTextSamples: frame.visibleTextSamples,
        textSampling: frame.textSampling,
        visibleSectionSamples: frame.visibleSectionSamples,
        visibleMediaSamples: frame.visibleMediaSamples,
        surfaceSampling: frame.surfaceSampling,
        inlineSvgEvidence: frame.inlineSvgEvidence,
      })),
    };
    fs.writeFileSync(rawCapturePath, `${JSON.stringify(rawCapture, null, 2)}\n`);
    const continuousPath = path.join(outDir, "continuous-scroll.webm");
    const pageVideo = page.video();
    await page.close();
    if (pageVideo) await pageVideo.saveAs(continuousPath);
    await context.close();
    return {
      html,
      renderedUrl: page.url(),
      cssByUrl,
      networkEntries,
      proof: {
        method: "browser-native-wheel",
        documentLang: finalState.lang || "",
        readyState: finalState.readyState || "",
        frameCount: frames.length,
        textSampleCount,
        maxVisualMediaCount,
        imageRequestCount,
        archivedAssetCount: archivedAssets.length,
        archivedUniqueAssetCount: archivedHashes.size,
        archivedAssetsPath,
        inlineArchivePath,
        componentInventoryPath,
        interactionEvidencePath,
        componentFamilyCounts: componentInventory.familyCounts,
        componentItemCount: componentInventory.items.length,
        openingFramePath,
        settleTimedOut,
        settledState: settleState,
        reachedDocumentEnd: Number(finalState.scrollY || 0) + Number(finalState.viewportHeight || 0) >= Number(finalState.scrollHeight || 0) - 4,
        fullPagePath,
        rawCapturePath,
        continuousPath,
      },
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write("Usage: run-rendered-evidence-collector.mjs --source-url <url> --brand <brand> --root <output-root> [--force-browser] [--check-runtime]\nSupplements: --out-dir <new-directory> --controls-only, or --inline-only --prior-capture <hash-bound raw-capture.json>. Supplements do not certify source learning.\nRuntime: reuse installed skill/workspace dependencies or initialize the locked runtime inside isolated output. No browser download; BRAND_RUNTIME_ROOT may explicitly declare an existing dependency workspace.\n");
    return;
  }
  if (process.argv.includes("--check-runtime")) {
    try {
      const runtime = await resolveBrowserRuntime({ artifactRoot: readArg("--root", process.cwd()) });
      ok({ status: "runtime-loadable", modulePath: runtime.modulePath, provenance: runtime.provenance, browserLaunched: false });
    } catch (error) {
      fail(error.message, { blockingCode: error.code, attempts: error.failures });
    }
    return;
  }
  const root = readArg("--root", process.cwd());
  const sourceUrl = readArg("--source-url", "");
  const brand = readArg("--brand", inferBrandKey(sourceUrl));
  const forceBrowser = process.argv.includes("--force-browser");
  const viewportWidth = Number(readArg("--width", "1440"));
  const viewportHeight = Number(readArg("--height", "900"));
  const pageId = readArg("--page-id", "source");
  if (!sourceUrl) fail("--source-url is required");
  if (!brand) fail("--brand is required or inferable from --source-url");

  const requestedOutDir = readArg("--out-dir", "");
  const outDir = requestedOutDir ? path.resolve(root, requestedOutDir) : path.join(root, "output", "extractor-benchmark", brand, "rendered");
  if (process.argv.includes("--inline-only")) {
    const relative = path.relative(path.resolve(root), outDir);
    if (!requestedOutDir || !relative || relative.startsWith('..') || path.isAbsolute(relative) || fs.existsSync(outDir)) fail('Inline supplement requires a new isolated --out-dir');
    const priorFile = path.resolve(root, readArg('--prior-capture', ''));
    const priorRelative = path.relative(path.resolve(root), priorFile);
    if (!priorRelative || priorRelative.startsWith('..') || path.isAbsolute(priorRelative) || !fs.existsSync(priorFile)) fail('Inline supplement requires --prior-capture inside isolated root');
    const prior = JSON.parse(fs.readFileSync(priorFile, 'utf8'));
    if (prior.url !== sourceUrl || !Array.isArray(prior.frames) || !prior.frames.length || prior.frames.length > 36) fail('Inline supplement source/frame mismatch');
    const first = prior.frames[0];
    const viewport = { width: first.clientWidth, height: first.clientHeight };
    if (![viewport.width, viewport.height].every(n => Number.isFinite(n) && n > 0 && n <= 4096)) fail('Inline supplement invalid frozen viewport');
    const { chromium } = await resolveBrowserRuntime({ artifactRoot: root });
    const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    try {
      const context = await browser.newContext({ viewport, locale: 'en-US', colorScheme: 'light' });
      await context.addInitScript(installEffectiveVisibility);
      const page = await context.newPage();
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      await page.evaluate(async () => { await document.fonts.ready; });
      const archive = createInlineSvgEvidenceArchive({ outputDir: outDir });
      const frames = [];
      for (let index = 0; index < prior.frames.length; index++) {
        const target = prior.frames[index].scrollTop;
        if (!Number.isFinite(target) || target < 0) fail('Inline supplement invalid frozen scroll position');
        const before = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, target - before);
        await page.waitForTimeout(450);
        const actual = await page.evaluate(() => ({ scrollTop: scrollY, url: location.href, capturedAt: new Date().toISOString() }));
        if (Math.abs(actual.scrollTop - target) > 8 || actual.url !== sourceUrl) throw new Error('INLINE_SUPPLEMENT_SOURCE_GEOMETRY_CHANGED');
        const screenshotPath = path.join(outDir, `frame-${String(index).padStart(3, '0')}.png`);
        await page.screenshot({ path: screenshotPath, type: 'png' });
        const evidence = await archive.capture(page, { frameIndex: index, screenshotPath });
        frames.push({ ...actual, index, target, screenshotPath, screenshotSha256: crypto.createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex'), evidence });
      }
      const file = path.join(outDir, 'inline-svg-evidence.json');
      fs.writeFileSync(file, `${JSON.stringify({ ...archive.summary(), sourceUrl, viewport, supplemental: true, priorCapture: { path: priorRelative, sha256: crypto.createHash('sha256').update(fs.readFileSync(priorFile)).digest('hex') }, frames, fullSourceCapture: false }, null, 2)}\n`, { flag: 'wx' });
      ok({ status: 'supplemental-inline-source-captured', output: path.relative(root, file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), frameCount: frames.length, assetCount: archive.summary().assetCount, fullSourceCapture: false });
    } finally { await browser.close(); }
    return;
  }
  if (process.argv.includes("--controls-only")) {
    // A bounded supplemental capture, not a replacement source manifest or
    // proof that click/navigation outcomes were observed. Preserve old bytes.
    const relative = path.relative(path.resolve(root), outDir);
    if (!requestedOutDir || !relative || relative.startsWith('..') || path.isAbsolute(relative) || fs.existsSync(outDir)) fail('Controls supplement requires a new isolated --out-dir');
    const { chromium } = await resolveBrowserRuntime({ artifactRoot: root });
    const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
    try {
      const context = await browser.newContext({ viewport: { width: viewportWidth, height: viewportHeight }, locale: 'en-US', colorScheme: 'light' });
      await context.addInitScript(installEffectiveVisibility);
      const page = await context.newPage();
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      await page.evaluate(async () => { await document.fonts.ready; });
      const supplemental = await collectPassiveControlStates(page, outDir, root);
      const file = path.join(outDir, 'control-state-evidence.json');
      fs.writeFileSync(file, `${JSON.stringify({ ...supplemental, supplemental: true, capturedAt: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx' });
      ok({ status: 'supplemental-passive-controls-captured', output: path.relative(root, file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), controlCount: supplemental.entries.length, activationPerformed: false, fullSourceCapture: false });
    } finally { await browser.close(); }
    return;
  }
  // Never modify a previous capture before discovering a late wx collision.
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) fail('Capture output already contains evidence. Resume the existing dispatch; an explicitly required recapture must use a new isolated --out-dir.', { blockingCode: 'CAPTURE_OUTPUT_EXISTS', outDir });
  const cssDir = path.join(outDir, "css");
  ensureDir(cssDir);

  let html = "";
  let renderedUrl = sourceUrl;
  let browserCapture = null;
  let httpFailure = forceBrowser ? "forced-browser" : "";
  if (!forceBrowser) {
    try {
      html = await fetchText(sourceUrl);
      const metaRefreshUrl = extractMetaRefreshUrl(html, sourceUrl);
      if (metaRefreshUrl) {
        renderedUrl = metaRefreshUrl;
        html = await fetchText(metaRefreshUrl);
      }
    } catch (error) {
      httpFailure = String(error?.message || error);
    }
  }

  const blockedCode = detectBlockedHtml(html);
  if (httpFailure || blockedCode) {
    try {
      browserCapture = await collectWithBrowser(sourceUrl, outDir, { width: viewportWidth, height: viewportHeight, pageId, root, cookieRejectSelector: readArg('--cookie-reject-selector', '') });
      html = browserCapture.html;
      renderedUrl = browserCapture.renderedUrl;
    } catch (error) {
      const browserFailure = String(error?.message || error);
      fail("Both HTTP and real-browser collection failed.", {
        brand,
        sourceUrl,
        blockingCode: ["BROWSER_RUNTIME_UNAVAILABLE", "EXTRACTOR_RUNTIME_BOOTSTRAP_FAILED"].includes(error?.code) ? error.code : classifyBrowserFailure(browserFailure),
        runtimeDetails: error?.details,
        httpFailure: httpFailure || blockedCode,
        browserFailure,
      });
    }
  }

  const htmlPath = path.join(outDir, "rendered.html");
  fs.writeFileSync(htmlPath, html);

  const styleSheetUrls = extractStyleSheetUrls(html, renderedUrl);
  const inlineStyleBlocks = extractInlineStyleBlocks(html);
  const cssFiles = [];
  const cssWarnings = [];
  const networkEntries = [{ url: renderedUrl, type: "document" }, ...(browserCapture?.networkEntries || [])];

  for (const styleSheetUrl of styleSheetUrls) {
    try {
      const cssText = browserCapture?.cssByUrl.get(styleSheetUrl) || await fetchText(styleSheetUrl);
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
    captureMethod: browserCapture ? "browser-fallback" : "http",
    browserProof: browserCapture ? {
      ...browserCapture.proof,
      openingFramePath: path.relative(root, browserCapture.proof.openingFramePath),
      fullPagePath: path.relative(root, browserCapture.proof.fullPagePath),
      rawCapturePath: path.relative(root, browserCapture.proof.rawCapturePath),
      continuousPath: path.relative(root, browserCapture.proof.continuousPath),
      archivedAssetsPath: path.relative(root, browserCapture.proof.archivedAssetsPath),
      inlineArchivePath: path.relative(root, browserCapture.proof.inlineArchivePath),
      componentInventoryPath: path.relative(root, browserCapture.proof.componentInventoryPath),
      interactionEvidencePath: path.relative(root, browserCapture.proof.interactionEvidencePath),
    } : null,
    warnings: cssWarnings,
  }, null, 2)}\n`);

  ok({
    brand,
    sourceUrl,
    htmlFile: path.relative(root, htmlPath),
    cssFiles,
    networkFile: path.relative(root, networkPath),
    captureMethod: browserCapture ? "browser-fallback" : "http",
    browserProof: browserCapture ? {
      ...browserCapture.proof,
      openingFramePath: path.relative(root, browserCapture.proof.openingFramePath),
      fullPagePath: path.relative(root, browserCapture.proof.fullPagePath),
      rawCapturePath: path.relative(root, browserCapture.proof.rawCapturePath),
      continuousPath: path.relative(root, browserCapture.proof.continuousPath),
      archivedAssetsPath: path.relative(root, browserCapture.proof.archivedAssetsPath),
      inlineArchivePath: path.relative(root, browserCapture.proof.inlineArchivePath),
      componentInventoryPath: path.relative(root, browserCapture.proof.componentInventoryPath),
      interactionEvidencePath: path.relative(root, browserCapture.proof.interactionEvidencePath),
    } : null,
    warnings: cssWarnings,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main().catch((error) => fail("Rendered evidence collector crashed", { error: String(error?.message || error) }));
