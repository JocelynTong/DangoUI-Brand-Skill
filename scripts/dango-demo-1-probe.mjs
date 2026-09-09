import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:5179";
const root = process.cwd();
const out = path.resolve(root, "migrations/dango/demo-1");
const captures = path.resolve(root, "migrations/dango/captures/demo/demo-1");
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
const route = (pageId, query = "") => `${base}/${query}#/brand/dango/pages/${pageId}`;
const screenshotEntries = [];
const pageResults = [];

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
    unsupportedSections: demo?.querySelectorAll(".source-schema-demo__unsupported").length || 0,
    horizontalOverflow: Boolean(screen && screen.scrollWidth > screen.clientWidth + 1),
    scroll: screen ? { top: screen.scrollTop, clientHeight: screen.clientHeight, scrollHeight: screen.scrollHeight } : null,
  };
};

for (const pageId of pages) {
  const viewport = { width: 1200, height: 940 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(route(pageId, "?qa=dango-demo-1"), { waitUntil: "networkidle" });
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
    await page.goto(route(pageId, `?qa=dango-demo-1&proof=${proof}`), { waitUntil: "networkidle" });
    await page.locator(".source-schema-demo--dango").waitFor({ state: "visible" });
    const state = await page.evaluate(inspect);
    await capture(page, `${pageId}-proof-${proof}`, viewport, `proof-${proof}`);
    pageResults.push({ pageId, proof, url: page.url(), state, consoleErrors });
    await page.close();
  }
}

await browser.close();

const normal = pageResults.filter((entry) => !entry.proof);
const proof = pageResults.filter((entry) => entry.proof);
const approx = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const button = normal.find((entry) => entry.pageId === "dango-button-calibration")?.primaryButton;
const checks = {
  allPagesRender: normal.length === pages.length && normal.every((entry) => entry.before.demo && entry.before.unsupportedSections === 0),
  normalPhoneShellPreserved: normal.every((entry) => entry.before.phone && entry.before.indicator && entry.before.indicatorDisplay !== "none"),
  multiModulePages: normal.every((entry) => entry.before.sections >= 2),
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
  consoleClean: pageResults.every((entry) => entry.consoleErrors.length === 0),
};

const implementationPass = Object.values(checks).every(Boolean);
const manifest = {
  schema: "brand-demo-screenshot-manifest/v1",
  brand: "dango",
  stage: "demo-1",
  generatedAt: new Date().toISOString(),
  entries: screenshotEntries,
};
const selfTest = {
  schema: "brand-demo-implementation-self-test/v1",
  brand: "dango",
  stage: "demo-1",
  verdict: implementationPass ? "pass" : "rework",
  visualVerdict: "not-assigned-by-implementation-agent",
  checks,
  pageResults,
};
fs.writeFileSync(path.join(out, "demo-screenshot-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(out, "implementation-self-test.json"), `${JSON.stringify(selfTest, null, 2)}\n`);
console.log(JSON.stringify({ implementationPass, checks, screenshotCount: screenshotEntries.length }, null, 2));
if (!implementationPass) process.exitCode = 1;
