import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:5179";
const root = process.cwd();
const out = path.resolve(root, "migrations/dango/demo-2");
const captures = path.resolve(root, "migrations/dango/captures/demo/demo-2");
const patternInventory = JSON.parse(fs.readFileSync(path.resolve(root, "migrations/dango/visual-pattern-inventory.json"), "utf8"));
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(captures, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const pages = [
  "dango-introduction-calibration",
  "dango-button-calibration",
  "dango-release-checklist-held-out",
];
const preservedPages = ["distribution", ...pages];
const route = (pageId, query = "") => `${base}/${query}#/brand/dango/pages/${pageId}`;
const screenshotEntries = [];
const pageResults = [];
const routeReachability = [];

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const rel = (file) => path.relative(root, file);
const capture = async (page, id, viewport, state, fullPage = false) => {
  const file = path.join(captures, `${id}.png`);
  await page.screenshot({ path: file, fullPage });
  screenshotEntries.push({ id, path: rel(file), sha256: sha256(file), viewport, state });
  return rel(file);
};

const inspect = () => {
  const phone = document.querySelector(".phone.template-phone");
  const screen = phone?.querySelector(".phone-screen");
  const indicator = phone?.querySelector(".mock-home-indicator--outer");
  const demo = screen?.querySelector(".source-schema-demo--dango");
  const header = demo?.querySelector(".dango-docs__utility-header");
  const rect = (element) => {
    if (!element) return null;
    const value = element.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
  };
  return {
    phone: rect(phone),
    screen: rect(screen),
    indicator: rect(indicator),
    indicatorDisplay: indicator ? getComputedStyle(indicator).display : "missing",
    demo: rect(demo),
    header: rect(header),
    sections: demo?.querySelectorAll(":scope > section").length || 0,
    technicalFlows: demo?.querySelectorAll(".dango-docs__technical-flow").length || 0,
    referenceModules: demo?.querySelectorAll(".dango-docs__reference-module").length || 0,
    apiTables: demo?.querySelectorAll(".dango-docs__reference-table").length || 0,
    unsupportedSections: demo?.querySelectorAll(".source-schema-demo__unsupported").length || 0,
    horizontalOverflow: Boolean(screen && screen.scrollWidth > screen.clientWidth + 1),
    scroll: screen ? { top: screen.scrollTop, clientHeight: screen.clientHeight, scrollHeight: screen.scrollHeight } : null,
  };
};

for (const pageId of preservedPages) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 940 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(route(pageId, "?qa=dango-demo-2-route-regression"), { waitUntil: "networkidle" });
  const state = await page.evaluate(() => ({
    phone: Boolean(document.querySelector(".phone.template-phone")),
    screen: Boolean(document.querySelector(".phone-screen")),
    unsupported: Boolean(document.querySelector(".source-schema-demo__unsupported")),
    textLength: document.querySelector(".phone-screen")?.textContent?.trim().length || 0,
  }));
  routeReachability.push({ pageId, url: page.url(), httpOk: Boolean(response?.ok()), ...state, consoleErrors: errors });
  await page.close();
}

for (const pageId of pages) {
  const viewport = { width: 1200, height: 940 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(route(pageId, "?qa=dango-demo-2"), { waitUntil: "networkidle" });
  await page.locator(".source-schema-demo--dango").waitFor({ state: "visible" });
  const before = await page.evaluate(inspect);
  await capture(page, `${pageId}-normal-initial`, viewport, "initial");
  await page.evaluate(() => { document.querySelector(".phone-screen").scrollTop = 240; });
  const scrolled = await page.evaluate(inspect);
  await capture(page, `${pageId}-normal-scrolled`, viewport, "scrolled");
  await page.evaluate(() => { document.querySelector(".phone-screen").scrollTop = 0; });
  const restored = await page.evaluate(inspect);
  const result = { pageId, url: page.url(), before, scrolled, restored, consoleErrors };

  if (pageId === "dango-button-calibration") {
    const button = page.locator(".dango-docs__primary").first();
    const buttonState = async () => button.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderRadius: style.borderRadius,
        transform: style.transform,
        boxShadow: style.boxShadow,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        focused: document.activeElement === element,
        actionState: element.dataset.actionState,
      };
    });
    result.primaryButton = { default: await buttonState() };
    await capture(page, "dango-button-primary-default", viewport, "default");
    await button.hover();
    result.primaryButton.hover = await buttonState();
    await capture(page, "dango-button-primary-hover", viewport, "hover");
    await button.focus();
    result.primaryButton.focus = await buttonState();
    await capture(page, "dango-button-primary-focus", viewport, "focus");
    await button.click();
    result.primaryButton.activated = await buttonState();
    await capture(page, "dango-button-primary-activated", viewport, "activated-settled");
    await button.evaluate((element) => element.blur());
    result.primaryButton.restored = await buttonState();
    await capture(page, "dango-button-primary-restored", viewport, "restored");
  }
  pageResults.push(result);
  await page.close();
}

for (const pageId of pages) {
  for (const proof of ["desktop", "mobile"]) {
    const viewport = proof === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 };
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(route(pageId, `?qa=dango-demo-2&proof=${proof}`), { waitUntil: "networkidle" });
    await page.locator(".source-schema-demo--dango").waitFor({ state: "visible" });
    const state = await page.evaluate(inspect);
    await capture(page, `${pageId}-proof-${proof}`, viewport, `proof-${proof}`);
    if (pageId === "dango-button-calibration" && proof === "desktop") {
      await capture(page, "dango-button-calibration-proof-desktop-full-page", viewport, "proof-desktop-full-page", true);
    }
    pageResults.push({ pageId, proof, url: page.url(), state, consoleErrors });
    await page.close();
  }
}

const normal = pageResults.filter((entry) => !entry.proof);
const proof = pageResults.filter((entry) => entry.proof);
const approx = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const button = normal.find((entry) => entry.pageId === "dango-button-calibration")?.primaryButton;
const allPatterns = patternInventory.pages.flatMap((entry) => entry.patterns || []);
const responsivePatterns = allPatterns.filter((entry) => entry.approvedPatternId === "responsive-documentation-shell");
const buttonReferencePattern = allPatterns.find((entry) => entry.id === "button-multi-module-reference");
const isWholeRegion = (region) => Array.isArray(region) && region.length === 4 && region.every((value) => value >= 0 && value <= 1) && region[2] >= 0.9 && region[3] >= 0.9;
const regionAspect = (region) => region[2] / region[3];
const buttonSourceRegion = buttonReferencePattern?.evidenceRefs?.[0]?.sourceRegion;
const buttonDemoRegion = buttonReferencePattern?.demoRegion;
const buttonAspectDelta = buttonSourceRegion && buttonDemoRegion
  ? Math.max(regionAspect(buttonSourceRegion), regionAspect(buttonDemoRegion)) / Math.min(regionAspect(buttonSourceRegion), regionAspect(buttonDemoRegion))
  : Infinity;
const checks = {
  preservedDistributionAndProofRoutes: routeReachability.length === preservedPages.length && routeReachability.every((entry) => entry.httpOk && entry.phone && entry.screen && !entry.unsupported && entry.textLength > 0 && entry.consoleErrors.length === 0),
  mobileCompositionLayersBounded: responsivePatterns.every((entry) => {
    const layers = entry.compositionSupport?.layers || [];
    const header = layers.find((layer) => layer.id === "mobile utility header");
    const article = layers.find((layer) => layer.id === "mobile inset reading column");
    return Boolean(header && article && !isWholeRegion(header.sourceRegion) && !isWholeRegion(header.demoRegion) && !isWholeRegion(article.sourceRegion) && !isWholeRegion(article.demoRegion));
  }),
  buttonCompositionVariantStable: buttonReferencePattern?.compositionSupport?.sourceAsset?.variant === "multi-module-preview-code-api-theme" && buttonReferencePattern?.compositionSupport?.demoAsset?.variant === "multi-module-preview-code-api-theme",
  buttonComparisonSameAspect: buttonAspectDelta <= 1.01 && buttonReferencePattern?.compositionSupport?.comparison?.aspectTranslation === "none" && buttonReferencePattern?.compositionSupport?.comparison?.retainedFocalPoints?.length >= 2 && buttonReferencePattern?.compositionSupport?.comparison?.readingOrderRetention?.length >= 3,
  allPagesRender: normal.length === pages.length && normal.every((entry) => entry.before.demo && entry.before.unsupportedSections === 0),
  normalPhoneShellPreserved: normal.every((entry) => entry.before.phone && entry.before.indicator && entry.before.indicatorDisplay !== "none"),
  multiModulePages: normal.every((entry) => entry.before.sections >= 2),
  introductionTechnicalFlow: normal.find((entry) => entry.pageId === "dango-introduction-calibration")?.before.technicalFlows === 1,
  buttonReferenceDensity: normal.find((entry) => entry.pageId === "dango-button-calibration")?.before.referenceModules >= 3 && normal.find((entry) => entry.pageId === "dango-button-calibration")?.before.apiTables >= 3,
  scrollChangesAndRestores: normal.every((entry) => entry.scrolled.scroll.top > 0 && entry.restored.scroll.top === 0),
  noHorizontalOverflow: pageResults.every((entry) => !(entry.before || entry.state).horizontalOverflow),
  proofViewportExact: proof.every((entry) => entry.state.screen && approx(entry.state.screen.width, entry.proof === "desktop" ? 1440 : 390)),
  proofIndicatorHidden: proof.every((entry) => entry.state.indicatorDisplay === "none"),
  headerFullBleed: proof.every((entry) => entry.state.header && entry.state.screen && approx(entry.state.header.x, entry.state.screen.x) && approx(entry.state.header.width, entry.state.screen.width)),
  primaryGeometry: Boolean(button && approx(button.default.height, 32, 0.25) && approx(button.default.width, 77.15625, 1) && button.default.borderRadius === "4px"),
  primaryRoleColor: Boolean(button && button.default.backgroundColor === "rgb(124, 102, 255)" && button.default.color === "rgb(255, 255, 255)"),
  primaryHoverStable: Boolean(button && button.hover.backgroundColor === button.default.backgroundColor && button.hover.transform === "none" && button.hover.boxShadow === "none"),
  primaryFocusVisible: Boolean(button && button.focus.focused && button.focus.outlineStyle !== "none" && button.focus.outlineWidth === "1px"),
  primaryActivationAndRestore: Boolean(button && button.activated.focused && button.activated.actionState === "activated-focus-retained" && !button.restored.focused && button.restored.actionState === "default"),
  primaryStateScreenshotsComplete: ["default", "hover", "focus", "activated", "restored"].every((state) =>
    screenshotEntries.some((entry) => entry.id === `dango-button-primary-${state}`)),
  consoleClean: pageResults.every((entry) => entry.consoleErrors.length === 0),
};

const implementationPass = Object.values(checks).every(Boolean);
const manifest = {
  schema: "brand-demo-screenshot-manifest/v1",
  brand: "dango",
  stage: "demo-2",
  generatedAt: new Date().toISOString(),
  entries: screenshotEntries,
};
const selfTest = {
  schema: "brand-demo-implementation-self-test/v1",
  brand: "dango",
  stage: "demo-2",
  verdict: implementationPass ? "pass" : "rework",
  visualVerdict: "not-assigned-by-implementation-agent",
  artifacts: {
    screenshotManifest: "migrations/dango/demo-2/demo-screenshot-manifest.json",
    implementationSectionManifest: "migrations/dango/demo-2/section-fidelity-implementation-manifest.json",
    sourceEvidenceSectionManifest: "migrations/dango/section-fidelity-manifest.json",
    mappingRuntimeProbe: "migrations/dango/mapping-runtime-probe.json"
  },
  checks,
  routeReachability,
  pageResults,
};
fs.writeFileSync(path.join(out, "demo-screenshot-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(out, "implementation-self-test.json"), `${JSON.stringify(selfTest, null, 2)}\n`);
console.log(JSON.stringify({ implementationPass, checks, screenshotCount: screenshotEntries.length }, null, 2));
await Promise.race([browser.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1500))]);
process.exit(implementationPass ? 0 : 1);
