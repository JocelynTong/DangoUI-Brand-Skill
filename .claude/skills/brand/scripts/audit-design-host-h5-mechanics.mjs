#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveBrowserRuntime } from "./resolve-browser-runtime.mjs";

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
const schemaPreviewPolicy = frozenSchemaPreviewPolicy();
const { chromium } = await resolveBrowserRuntime({ artifactRoot: root });
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

const blockingFindings = reports.flatMap((report) => report.checks.filter((check) => !check.pass && check.blocking !== false).map((check) => ({
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
  limitations: reports.flatMap(report => report.checks.filter(check => !check.pass && check.blocking === false).map(check => ({directionId:report.directionId,code:check.code,message:check.message,evidence:check.evidence}))),
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
    const captureFile = path.join(captureDir, `${safeName(direction.id || "direction")}-first-viewport.png`);
    // First-impression review must see the initial page, not the probe's query
    // text or a tab/filter state left behind by interaction checks.
    await page.screenshot({ path: captureFile, fullPage: false });
    const interactionProbe = await probeInteractions(page);
    const checks = buildChecks(before, scrollProbe, interactionProbe, consoleErrors, pageErrors);
    return {
      directionId: direction.id,
      artifact: { path: relative(artifactPath), sha256: sha256File(artifactPath) },
      capture: { path: relative(captureFile), sha256: sha256File(captureFile) },
      measurements: before,
      interactionProbe,
      scrollProbe,
      checks,
      verdict: checks.every((check) => check.pass || check.blocking === false) ? "pass" : "fail",
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
  let primary = { attempted: false, pass: false, reason: "no visible text input and action pair" };
  if (await input.count() && await action.count()) {
    const index = await action.evaluateAll((buttons, field) => {
      const owner = field.form;
      // Native form ownership also covers controls associated via form="id".
      // A real submitter wins over closer reset/auxiliary controls; do not try
      // another button merely because the submitter fails to change state.
      const submit = buttons.findIndex(button => owner && button.form === owner && button.type === "submit");
      if (submit >= 0) return submit;
      const inputBox = field.getBoundingClientRect();
      const candidates = buttons.map((button, index) => ({ button, index })).filter(({ button }) =>
        ("form" in button ? button.form : button.closest("form")) === owner && button.type !== "reset" &&
        !button.matches('[aria-pressed],[aria-expanded],[aria-selected],[role="tab"],[data-composition-role="navigation-shell"] *')
      ).map(({ button, index }) => {
        const box = button.getBoundingClientRect();
        return { index, distance: Math.abs(box.y - inputBox.y) + Math.max(0, box.x - inputBox.x) * 0.05 };
      });
      candidates.sort((a, b) => a.distance - b.distance);
      return candidates[0]?.index ?? -1;
    }, await input.elementHandle());
    if (index >= 0) {
      const button = action.nth(index);
      await input.fill("mechanical-qa");
      const beforeSignature = await page.locator("body").evaluate((body) => `${body.innerText}|${body.className}|${body.getAttribute("data-state") || ""}`);
      await button.click();
      await page.waitForTimeout(120);
      const afterSignature = await page.locator("body").evaluate((body) => `${body.innerText}|${body.className}|${body.getAttribute("data-state") || ""}`);
      primary = { attempted: true, pass: afterSignature !== beforeSignature, reason: afterSignature !== beforeSignature ? "visible DOM state changed" : "action produced no observable DOM state change" };
    }
  }
  // Search can change the current route/results. Exercise filters from their
  // initial state, not whatever the preceding probe happened to leave behind.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
  const filterResult = await probeFilters(page);
  return { primary, filter: filterResult };
}

async function probeFilters(page) {
  const selector = ':is(select,button[aria-pressed],[role="button"][aria-pressed],[role="option"][aria-selected],[role="treeitem"][aria-selected],[role="row"][aria-selected],[role="gridcell"][aria-selected],input[type="checkbox"],input[type="radio"]):not([data-composition-role="navigation-shell"] *)';
  const filters = page.locator(selector);
  const disclosures = [];
  // ARIA disclosure and native details, not arbitrary buttons or label guesses.
  // Legacy disclosure buttons without aria-controls remain discoverable by the
  // actual newly visible selection controls; opening alone never passes.
  const disclosureSelector = 'button[aria-expanded="false"],[role="button"][aria-expanded="false"],details:not([open]) > summary';
  const triggers = await page.locator(disclosureSelector).elementHandles();
  for (const trigger of triggers.slice(0, 4)) {
    if (!await trigger.isVisible() || !await trigger.isEnabled()) continue;
    try {
      const before = (await reachableFilterControls(filters)).length;
      const nestedBefore = await page.locator(disclosureSelector).filter({ visible: true }).count();
      await trigger.click({ timeout: 1500 });
      await page.waitForTimeout(80);
      const after = (await reachableFilterControls(filters)).length;
      const nestedAfter = await page.locator(disclosureSelector).filter({ visible: true }).count();
      disclosures.push({ revealedControls: Math.max(0, after - before) });
      // The opened trigger leaves the collapsed selector. A replacement visible
      // trigger can therefore represent a newly reachable nested disclosure.
      if (after <= before && nestedAfter < nestedBefore) await trigger.click({ timeout: 1500 });
    } catch (error) {
      disclosures.push({ error: error.message.split("\n")[0] });
    }
  }
  const reachable = await reachableFilterControls(filters);
  // Probe unchecked siblings first so an initially checked radio can actually
  // change state when its turn arrives. Clicking a checked radio is a no-op.
  reachable.sort((a, b) => Number(a.checkedRadio) - Number(b.checkedRadio));
  const presentCount = reachable.length;
  const result = { attempted: false, pass: false, presentCount, totalCount: await filters.count(), disclosures, controls: [] };
  for (const { control, target } of reachable.slice(0, 16)) {
    const state = () => control.evaluate(node => JSON.stringify(node.tagName === "SELECT" ? { values: [...node.selectedOptions].map(option => option.value) } : node.tagName === "INPUT" ? { checked: node.checked } : node.hasAttribute("aria-pressed") ? { pressed: node.getAttribute("aria-pressed") } : { selected: node.getAttribute("aria-selected") }));
    const unavailable = !await control.isEnabled();
    const options = await control.evaluate(node => node.tagName === "SELECT" ? [...node.options].filter(option => !option.disabled && !option.closest('optgroup[disabled]')).map(option => option.value) : null);
    const current = await control.evaluate(node => node.value);
    const alternate = options?.find(value => value !== current);
    if (unavailable || (options && alternate === undefined)) {
      result.controls.push({ status: "unavailable", nativeDisabled: await control.evaluate(node => node.matches(':disabled')), reason: unavailable ? "disabled control" : "no alternative enabled option; data readiness is not established" });
      continue;
    }
    try {
      const before = await state();
      result.attempted = true;
      if (options) await control.selectOption(alternate, { timeout: 1500 });
      else await target.click({ timeout: 1500 });
      await page.waitForTimeout(80);
      const after = await state();
      const changed = before !== after;
      result.controls.push({ status: changed ? "verified" : "unchanged", before: JSON.parse(before), after: JSON.parse(after) });
    } catch (error) {
      result.controls.push({ status: "action-failed", reason: error.message.split("\n")[0] });
    }
  }
  result.pass = result.controls.some(control => control.status === "verified")
    && !result.controls.some(control => ["action-failed", "unchanged"].includes(control.status))
    && !disclosures.some(disclosure => disclosure.error)
    && result.controls.length === presentCount;
  result.status = result.pass ? "verified" : !presentCount ? (result.totalCount ? "unreachable" : "missing-semantics") : !result.attempted ? "unavailable" : "failed";
  result.reason = result.pass ? "selection state changed; disclosure alone is not selection proof" : result.status === "unavailable" ? "selection unverified: controls are disabled or have no alternative option; do not invent data to pass" : result.status === "unreachable" ? "selection controls exist but disclosure did not make them reachable" : result.status === "missing-semantics" ? "no semantic selection control found; class-only custom controls cannot be verified" : "selection action failed or semantic state did not change";
  return result;
}

async function reachableFilterControls(filters) {
  const reachable = [];
  for (const control of await filters.elementHandles()) {
    // Native inputs may intentionally be transparent/hidden behind their label.
    // Exercise the associated visible label, never force-click or mutate state.
    const labels = await control.evaluateHandle(node => [...(node.labels || [])]);
    let target;
    for (const property of (await labels.getProperties()).values()) {
      const label = property.asElement();
      if (label && await label.isVisible()) { target = label; break; }
    }
    await labels.dispose();
    if (!target && await control.isVisible()) target = control;
    if (target) reachable.push({ control, target, checkedRadio: await control.evaluate(node => node.matches('input[type="radio"]') && node.checked) });
  }
  return reachable;
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
  add("FILTER_CONTROLS_PRESENT", interactions.filter.presentCount >= 1, "Selection controls must be reachable directly or after disclosure.", interactions.filter);
  add("PEER_RESULTS_PRESENT", measurements.resultHierarchy.peerCount >= 2, "At least two ordinary peer results are required for scan/comparison QA.", measurements.resultHierarchy);
  add("PEER_GEOMETRY_STABLE", measurements.resultHierarchy.peerHeightRatio <= 1.5 && measurements.resultHierarchy.peerWidthRatio <= 1.08, "Ordinary peer results must keep comparable geometry.", measurements.resultHierarchy);
  add("PRIMARY_INTERACTION_WORKS", interactions.primary.pass, "The primary action must produce an observable DOM state change.", interactions.primary);
  add("FILTER_INTERACTION_WORKS", interactions.filter.pass, interactions.filter.reason, interactions.filter);
  const filter = interactions.filter;
  if (schemaPreviewPolicy && filter.status === "unavailable" && !filter.attempted && filter.presentCount > 0
      && filter.presentCount === filter.totalCount && filter.controls.length === filter.presentCount
      && filter.controls.every(control => control.status === "unavailable" && control.nativeDisabled === true)
      && filter.disclosures.every(disclosure => !disclosure.error)) {
    Object.assign(checks.at(-1), {blocking:false,message:"Frozen host-schema preview: all filters are natively disabled; real business filtering remains unverified.",scopeBinding:schemaPreviewPolicy});
  }
  add("NO_RUNTIME_ERRORS", !consoleErrors.length && !pageErrors.length, "The isolated H5 must not emit runtime errors during the mechanical probe.", { consoleErrors, pageErrors });
  return checks;
}

function frozenSchemaPreviewPolicy() {
  // No inferred schema exception: require this producer's exact frozen input,
  // receipt/dispatch and unchanged H5 output bindings. Missing facts stay strict.
  const manifestFile = path.join(migrationDir, "execution-manifest.json");
  if (!fs.existsSync(manifestFile)) return null;
  const bound = ref => {
    const target = path.resolve(root, ref?.path || "");
    if (!ref?.sha256 || !target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target)
        || !fs.realpathSync(target).startsWith(`${fs.realpathSync(root)}${path.sep}`) || sha256File(target) !== ref.sha256) throw new Error("SCHEMA_POLICY_BINDING_INVALID");
    return readJson(target);
  };
  try {
    const manifest = readJson(manifestFile);
    const producer = [...(manifest.stages || [])].reverse().find(stage => stage.stage === "h5DirectionGeneration");
    if (manifest.mode !== "design-host" || producer?.status !== "complete" || producer.verdict !== "pass") return null;
    const receipt = bound({path:producer.receiptPath,sha256:producer.receiptSha256});
    const dispatch = bound({path:producer.dispatchPath,sha256:producer.dispatchSha256});
    if (receipt.stageId !== producer.id || receipt.dispatchId !== dispatch.dispatchId || dispatch.stageId !== producer.id
        || receipt.goalSha256 !== manifest.goalSha256 || dispatch.goalSha256 !== manifest.goalSha256
        || JSON.stringify(receipt.outputs) !== JSON.stringify(producer.outputHashes)) return null;
    const baseline = dispatch.requiredInputs?.find(ref => ref.path === `migrations/${brand}/host-startup-baseline.json`);
    if (!baseline || !receipt.inputs?.some(ref => ref.path === baseline.path && ref.sha256 === baseline.sha256)) return null;
    for (const direction of directions) {
      if (!receipt.outputs.some(ref => ref.path === direction.artifact.path && ref.sha256 === direction.artifact.sha256)) return null;
      const target = path.resolve(root,direction.artifact.path);
      if (sha256File(target) !== direction.artifact.sha256) return null;
    }
    if (bound(baseline).resultContentContract?.mode !== "host-schema") return null;
    return {mode:"host-schema",baseline,producerReceipt:{path:producer.receiptPath,sha256:producer.receiptSha256}};
  } catch { return null; }
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
