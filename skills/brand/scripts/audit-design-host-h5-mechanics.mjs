#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1] || fallback;
};
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand");
const width = Number(opt("--width", "390"));
const height = Number(opt("--height", "844"));
if (!brand || !Number.isInteger(width) || !Number.isInteger(height)) {
  throw new Error("Usage: audit-design-host-h5-mechanics.mjs --root <artifact-root> --brand <brand> [--width 390 --height 844]");
}

const migrationDir = path.join(root, "migrations", brand);
const routeFile = path.join(migrationDir, "design-host-route.json");
const outputFile = path.join(migrationDir, "design-host-h5-mechanical-qa.json");
const captureDir = path.join(migrationDir, "mechanical-qa");
const route = readJson(routeFile);
const directions = Array.isArray(route?.h5Directions?.directions) ? route.h5Directions.directions : [];
if (directions.length !== 3) throw new Error("H5_MECHANICAL_QA_REQUIRES_THREE_DIRECTIONS");
fs.mkdirSync(captureDir, { recursive: true });

const executablePath = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ["--disable-gpu", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
});

const reports = [];
try {
  for (const direction of directions) reports.push(await auditDirection(direction));
} finally {
  await browser.close();
}

const blockingFindings = reports.flatMap((report) => report.checks.filter((check) => !check.pass).map((check) => ({
  directionId: report.directionId,
  code: check.code,
  message: check.message,
  evidence: check.evidence,
})));
const output = {
  schema: "design-host-h5-mechanical-qa/v1",
  brand,
  generatedAt: new Date().toISOString(),
  viewport: { width, height, coordinateSystem: "CSS pixels" },
  purpose: "Deterministic product-safety gate before independent Hierarchy / Utility / Style visual judgment.",
  verdict: blockingFindings.length ? "fail" : "pass",
  route: { path: relative(routeFile), sha256: sha256File(routeFile) },
  directions: reports,
  blockingFindings,
};
writeJson(outputFile, output);
process.stdout.write(`${JSON.stringify({ ok: !blockingFindings.length, verdict: output.verdict, output: relative(outputFile), directionCount: reports.length, blockingFindings }, null, 2)}\n`);
if (blockingFindings.length) process.exitCode = 2;

async function auditDirection(direction) {
  const artifactPath = path.resolve(root, String(direction?.artifact?.path || ""));
  if (!artifactPath.startsWith(`${root}${path.sep}`) || !fs.existsSync(artifactPath)) throw new Error(`H5_DIRECTION_MISSING:${direction?.id || "unknown"}`);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "zh-CN" });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page.goto(new URL(`file://${artifactPath}`).href, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.evaluate(async () => { try { await document.fonts?.ready; } catch {} });
    await page.waitForTimeout(350);
    const before = await page.evaluate(measurePage);
    const scrollProbe = await page.evaluate(() => {
      const start = document.scrollingElement?.scrollTop || 0;
      const target = Math.min(320, Math.max(1, (document.scrollingElement?.scrollHeight || 0) - innerHeight));
      document.scrollingElement?.scrollTo(0, target);
      const changed = document.scrollingElement?.scrollTop || 0;
      document.scrollingElement?.scrollTo(0, start);
      const restored = document.scrollingElement?.scrollTop || 0;
      return { start, target, changed, restored };
    });
    const interactionProbe = await probeInteractions(page);
    const captureFile = path.join(captureDir, `${safeName(direction.id || "direction")}-first-viewport.png`);
    await page.screenshot({ path: captureFile, fullPage: false });
    const checks = buildChecks(before, scrollProbe, interactionProbe, consoleErrors, pageErrors);
    return {
      directionId: direction.id,
      artifact: { path: relative(artifactPath), sha256: sha256File(artifactPath) },
      capture: { path: relative(captureFile), sha256: sha256File(captureFile) },
      measurements: before,
      interactionProbe,
      scrollProbe,
      checks,
      verdict: checks.every((check) => check.pass) ? "pass" : "fail",
    };
  } finally {
    await context.close();
  }
}

function measurePage() {
  const visible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.02;
  };
  const rectOf = (node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
  };
  const peers = [...document.querySelectorAll('[data-result-weight="peer"]')].filter(visible);
  const peerRects = peers.map(rectOf);
  const peerHeights = peerRects.map((rect) => rect.height).filter(Boolean);
  const peerWidths = peerRects.map((rect) => rect.width).filter(Boolean);
  const images = [...document.images].filter(visible).map((image) => ({
    src: image.currentSrc || image.src,
    alt: image.alt || "",
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    rect: rectOf(image),
  }));
  const modules = [...document.querySelectorAll("main > section, main > header, [data-composition-role]")].filter(visible).length;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      moduleCount: modules,
    },
    semanticControls: {
      textInputs: [...document.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],textarea')].filter(visible).length,
      primaryActions: [...document.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).length,
      filters: [...document.querySelectorAll('select,[aria-pressed],[aria-selected],input[type="checkbox"],input[type="radio"]')].filter(visible).length,
    },
    resultHierarchy: {
      peerCount: peers.length,
      differentiatedCount: [...document.querySelectorAll('[data-result-weight="differentiated"]')].filter(visible).length,
      peerRects,
      peerHeightRatio: peerHeights.length > 1 ? Math.max(...peerHeights) / Math.min(...peerHeights) : 1,
      peerWidthRatio: peerWidths.length > 1 ? Math.max(...peerWidths) / Math.min(...peerWidths) : 1,
    },
    images,
  };
}

async function probeInteractions(page) {
  const input = page.locator('input:not([type]),input[type="text"],input[type="search"],textarea').filter({ visible: true }).first();
  const action = page.locator('button,input[type="submit"],[role="button"]').filter({ visible: true });
  const filters = page.locator('[aria-pressed],[aria-selected],select,input[type="checkbox"],input[type="radio"]').filter({ visible: true });
  const beforeSignature = await page.locator("body").evaluate((body) => `${body.innerText}|${body.className}|${body.getAttribute("data-state") || ""}`);
  let primary = { attempted: false, pass: false, reason: "no visible text input and action pair" };
  if (await input.count() && await action.count()) {
    const candidateButtons = page.locator('button,input[type="submit"],[role="button"]').filter({ visible: true });
    let button = candidateButtons.first();
    const inputBox = await input.boundingBox();
    if (inputBox) {
      const candidates = [];
      for (let index = 0; index < await candidateButtons.count(); index += 1) {
        const box = await candidateButtons.nth(index).boundingBox();
        if (box) candidates.push({ index, distance: Math.abs(box.y - inputBox.y) + Math.max(0, box.x - inputBox.x) * 0.05 });
      }
      candidates.sort((a, b) => a.distance - b.distance);
      if (candidates[0]) button = candidateButtons.nth(candidates[0].index);
    }
    await input.fill("mechanical-qa");
    await button.click();
    await page.waitForTimeout(120);
    const afterSignature = await page.locator("body").evaluate((body) => `${body.innerText}|${body.className}|${body.getAttribute("data-state") || ""}`);
    primary = { attempted: true, pass: afterSignature !== beforeSignature, reason: afterSignature !== beforeSignature ? "visible DOM state changed" : "action produced no observable DOM state change" };
  }
  let filterResult = { attempted: false, pass: false, reason: "no visible filter control" };
  if (await filters.count()) {
    for (let index = 0; index < await filters.count(); index += 1) {
      const filter = filters.nth(index);
      const before = await filter.evaluate((node) => `${node.getAttribute("aria-pressed")}|${node.getAttribute("aria-selected")}|${node.value}|${node.checked}|${node.className}`);
      if (await filter.evaluate((node) => node.tagName === "SELECT")) {
        const values = await filter.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value));
        if (values.length > 1) await filter.selectOption(values.find((value) => String(value) !== String(before).split("|")[2]) || values[1]);
      } else await filter.click();
      await page.waitForTimeout(80);
      const after = await filter.evaluate((node) => `${node.getAttribute("aria-pressed")}|${node.getAttribute("aria-selected")}|${node.value}|${node.checked}|${node.className}`);
      if (before !== after) {
        filterResult = { attempted: true, pass: true, reason: "control state changed", testedIndex: index };
        break;
      }
      filterResult = { attempted: true, pass: false, reason: "no inspected filter control changed state" };
    }
  }
  return { primary, filter: filterResult };
}

function buildChecks(measurements, scrollProbe, interactions, consoleErrors, pageErrors) {
  const checks = [];
  const add = (code, pass, message, evidence) => checks.push({ code, pass: Boolean(pass), message, evidence });
  add("VIEWPORT_EXACT", measurements.viewport.width === width && measurements.viewport.height === height, "Rendered CSS viewport must match the frozen host viewport.", measurements.viewport);
  add("NO_HORIZONTAL_OVERFLOW", measurements.document.scrollWidth <= measurements.document.clientWidth + 2, "The page must not overflow horizontally.", measurements.document);
  const needsScroll = measurements.document.moduleCount >= 2;
  add("DOCUMENT_SCROLLABLE", !needsScroll || measurements.document.scrollHeight > measurements.document.clientHeight, "A multi-module page must remain vertically scrollable instead of clipping or scaling the list into one viewport.", measurements.document);
  add("SCROLL_CHANGES_AND_RESTORES", !needsScroll || (scrollProbe.changed > scrollProbe.start && scrollProbe.restored === scrollProbe.start), "Scrolling must change and restore document scrollTop.", scrollProbe);
  add("IMAGE_LOADS", measurements.images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), "Every visible image must load with intrinsic dimensions.", measurements.images);
  add("HOST_TASK_CONTROLS_PRESENT", measurements.semanticControls.textInputs >= 1 && measurements.semanticControls.primaryActions >= 1, "The startup task needs a visible input and action.", measurements.semanticControls);
  add("FILTER_CONTROLS_PRESENT", measurements.semanticControls.filters >= 1, "The productive state needs at least one inspectable filter/selection control.", measurements.semanticControls);
  add("PEER_RESULTS_PRESENT", measurements.resultHierarchy.peerCount >= 2, "At least two ordinary peer results are required for scan/comparison QA.", measurements.resultHierarchy);
  add("PEER_GEOMETRY_STABLE", measurements.resultHierarchy.peerHeightRatio <= 1.5 && measurements.resultHierarchy.peerWidthRatio <= 1.08, "Ordinary peer results must keep comparable geometry.", measurements.resultHierarchy);
  add("PRIMARY_INTERACTION_WORKS", interactions.primary.pass, "The primary action must produce an observable DOM state change.", interactions.primary);
  add("FILTER_INTERACTION_WORKS", interactions.filter.pass, "A filter or selection control must change state.", interactions.filter);
  add("NO_RUNTIME_ERRORS", !consoleErrors.length && !pageErrors.length, "The isolated H5 must not emit runtime errors during the mechanical probe.", { consoleErrors, pageErrors });
  return checks;
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`MISSING_REQUIRED_FILE:${relative(file)}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}
function safeName(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "direction";
}
