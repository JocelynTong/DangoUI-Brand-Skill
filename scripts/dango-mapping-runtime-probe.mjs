import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:5179";
const output = path.resolve("migrations/dango/mapping-runtime-probe.json");
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1200, height: 940 } });
const screenshotDir = path.resolve("migrations/dango/mapping-qa/runtime-repair");
fs.mkdirSync(screenshotDir, { recursive: true });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(`${base}/?qa=dango-mapping-runtime#/brand/dango/pages/dango-button-calibration`, { waitUntil: "networkidle" });

const buttonSelector = "button.du-button.du-button--normal.du-button--primary.dango-docs__primary";
await page.locator(buttonSelector).first().waitFor({ state: "visible" });
const nativeButtonInstanceCount = await page.locator(buttonSelector).count();

const readButton = () => page.locator(buttonSelector).first().evaluate((element) => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    tagName: element.tagName,
    classes: [...element.classList],
    text: element.textContent.trim(),
    actionState: element.dataset.actionState,
    focused: document.activeElement === element,
    computed: {
      width: rect.width,
      height: rect.height,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      color: style.color,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    },
    tokens: {
      primary: style.getPropertyValue("--du-primary-solid-bg").trim(),
      white: style.getPropertyValue("--du-primary-solid-color").trim(),
    },
  };
});

const before = await readButton();
await page.locator(buttonSelector).first().focus();
const focused = await readButton();
await page.locator(buttonSelector).first().click();
const activated = await readButton();
await page.locator(buttonSelector).first().evaluate((element) => element.blur());
const restored = await readButton();

const tokens = await page.evaluate(() => {
  const value = (selector, property) => getComputedStyle(document.querySelector(selector))[property];
  const custom = (selector, property) => getComputedStyle(document.querySelector(selector)).getPropertyValue(property).trim();
  return {
    rootCanvas: { selector: ".source-schema-demo--dango", token: custom(".source-schema-demo--dango", "--du-bg-2"), computed: value(".source-schema-demo--dango", "backgroundColor"), backgroundImage: value(".source-schema-demo--dango", "backgroundImage") },
    pageSurface: { selector: ".dango-docs", token: custom(".dango-docs", "--du-bg-2"), computed: value(".dango-docs", "backgroundColor") },
    cardSurface: { selector: ".dango-docs__example-table", token: custom(".dango-docs__example-table", "--du-bg-1"), computed: value(".dango-docs__example-table", "backgroundColor") },
    text: { selector: ".dango-docs__article", token: custom(".dango-docs__article", "--du-text-1"), computed: value(".dango-docs__article", "color") },
    border: { selector: ".dango-docs__title-rule", token: custom(".dango-docs__title-rule", "--du-border-1"), computed: value(".dango-docs__title-rule", "backgroundColor") },
  };
});
await page.screenshot({ path: path.join(screenshotDir, "dango-button-runtime.png"), fullPage: true });

await page.goto(`${base}/?qa=dango-mapping-runtime#/brand/dango/pages/dango-introduction-calibration`, { waitUntil: "networkidle" });
const navigation = await page.locator(".dango-docs__nav-group > span.is-current").evaluate((element) => ({
  token: getComputedStyle(element).getPropertyValue("--style-docs-navigation-current").trim(),
  color: getComputedStyle(element).color,
}));
const purpleConsumers = await page.evaluate(() => {
  const purple = "rgb(88, 84, 255)";
  const matches = [];
  for (const element of document.querySelectorAll(".source-schema-demo--dango *")) {
    const style = getComputedStyle(element);
    const properties = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "fill", "stroke"];
    const hit = properties.filter((property) => style[property] === purple);
    if (hit.length) matches.push({
      selector: element.matches(".dango-docs__nav-group > span.is-current") ? ".dango-docs__nav-group > span.is-current" : `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`,
      properties: hit,
      text: element.textContent.trim().slice(0, 80),
    });
  }
  return matches;
});
const scroll = await page.locator(".phone-screen").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, before: element.scrollTop }));
await page.locator(".phone-screen").evaluate((element) => { element.scrollTop = 240; });
scroll.after = await page.locator(".phone-screen").evaluate((element) => element.scrollTop);
await page.locator(".phone-screen").evaluate((element) => { element.scrollTop = 0; });
scroll.restored = await page.locator(".phone-screen").evaluate((element) => element.scrollTop);
await page.screenshot({ path: path.join(screenshotDir, "dango-introduction-runtime.png"), fullPage: true });

const checks = {
  nativeDuButton: before.classes.includes("du-button") && before.classes.includes("du-button--primary"),
  buttonGeometry: before.computed.height === 32 && before.computed.borderRadius === "4px",
  primaryToken: before.tokens.primary.toLowerCase() === "#7c66ff" && before.computed.backgroundColor === "rgb(124, 102, 255)",
  interactionLifecycle: focused.focused && activated.focused && activated.actionState === "activated-focus-retained" && !restored.focused && restored.actionState === "default",
  rootCanvasToken: tokens.rootCanvas.token.toLowerCase() === "#ffffff" && tokens.rootCanvas.computed === "rgb(255, 255, 255)" && tokens.rootCanvas.backgroundImage === "none",
  pageSurfaceToken: tokens.pageSurface.token.toLowerCase() === "#ffffff" && tokens.pageSurface.computed === "rgb(255, 255, 255)",
  cardSurfaceToken: tokens.cardSurface.token.toLowerCase() === "#ffffff" && tokens.cardSurface.computed === "rgb(255, 255, 255)",
  textToken: tokens.text.token.toLowerCase() === "#000000" && tokens.text.computed === "rgb(0, 0, 0)",
  borderToken: tokens.border.token.toLowerCase() === "#0000001f" && ["rgba(0, 0, 0, 0.12)", "rgba(0, 0, 0, 0.122)"].includes(tokens.border.computed),
  navigationRemainsStyleOnly: navigation.token.toLowerCase() === "#5854ff" && navigation.color === "rgb(88, 84, 255)",
  navigationPurpleHasNoRoleExpansion: purpleConsumers.length === 1 && purpleConsumers[0].selector === ".dango-docs__nav-group > span.is-current" && purpleConsumers[0].properties.includes("color"),
  scrollChangesAndRestores: scroll.scrollHeight > scroll.clientHeight && scroll.after > 0 && scroll.restored === 0,
  consoleClean: errors.length === 0,
};

await page.goto(`${base}/?qa=dango-mapping-runtime#/brand/dango/pages/dango-release-checklist-held-out`, { waitUntil: "networkidle" });
checks.heldOutRoute = await page.locator(".source-schema-demo--dango").isVisible();
await page.screenshot({ path: path.join(screenshotDir, "dango-release-held-out-runtime.png"), fullPage: true });

const report = { schema: "dango-mapping-runtime-probe/v0.2", generatedAt: new Date().toISOString(), verdict: Object.values(checks).every(Boolean) ? "pass" : "fail", summary: { nativeComponentTypesConsumed: 1, nativeButtonInstanceCount, mappedTokensConsumed: 5, styleOnlyTokensConsumed: 1 }, checks, button: { before, focused, activated, restored }, tokens, navigation, purpleConsumers, screenshots: ["migrations/dango/mapping-qa/runtime-repair/dango-button-runtime.png", "migrations/dango/mapping-qa/runtime-repair/dango-introduction-runtime.png", "migrations/dango/mapping-qa/runtime-repair/dango-release-held-out-runtime.png"], scroll, errors };
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({ verdict: report.verdict, checks }, null, 2));
if (report.verdict !== "pass") process.exitCode = 1;
