import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const root = new URL("./captures/demo/", import.meta.url);
await fs.mkdir(new URL("desktop/", root), { recursive: true });
await fs.mkdir(new URL("mobile/", root), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const pages = ["introduction", "button", "release-checklist"];
const entries = [];
const probes = {};
const hash = async (url) => crypto.createHash("sha256").update(await fs.readFile(url)).digest("hex");

for (const id of pages) {
  const pageId = `dango-v2-${id}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:5173/?proof=desktop#/brand/dango-v2/pages/${pageId}`);
  await page.waitForSelector(`[data-page-id="${pageId}"]`, { state: "attached" });
  const desktop = new URL(`desktop/${id}.png`, root);
  await page.screenshot({ path: desktop.pathname, fullPage: true });
  entries.push({ id: `${pageId}-desktop`, path: `migrations/dango-v2/captures/demo/desktop/${id}.png`, sha256: await hash(desktop), viewport: { width: 1440, height: 900 }, state: "initial-proof" });
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await mobile.goto(`http://127.0.0.1:5173/#/brand/dango-v2/pages/${pageId}`);
  await mobile.waitForSelector(`[data-page-id="${pageId}"]`, { state: "attached" });
  const phone = mobile.locator(".template-phone");
  const mobilePath = new URL(`mobile/${id}.png`, root);
  await phone.screenshot({ path: mobilePath.pathname });
  entries.push({ id: `${pageId}-mobile-phone`, path: `migrations/dango-v2/captures/demo/mobile/${id}.png`, sha256: await hash(mobilePath), viewport: { width: 1440, height: 1000 }, contentCanvas: { width: 390, height: 844 }, state: "initial-normal-route" });
  const screen = phone.locator(".phone-screen");
  const scroll = await screen.evaluate((node) => { const before=node.scrollTop; node.scrollTop=160; const after=node.scrollTop; node.scrollTop=before; return {before,after,restored:node.scrollTop,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth}; });
  const phoneStyle = await phone.evaluate((node) => { const s=getComputedStyle(node); return {borderWidth:s.borderWidth,borderRadius:s.borderRadius}; });
  const indicator = phone.locator(".mock-home-indicator--outer");
  const indicatorBefore = await indicator.boundingBox();
  await screen.evaluate((node) => node.scrollTop=120);
  const indicatorAfter = await indicator.boundingBox();
  await screen.evaluate((node) => node.scrollTop=0);
  probes[id] = { scroll, phoneStyle, phoneShell: parseFloat(phoneStyle.borderWidth)>0 && parseFloat(phoneStyle.borderRadius)>0, indicatorFixed: JSON.stringify(indicatorBefore)===JSON.stringify(indicatorAfter), sectionCount: await mobile.locator(`[data-page-id="${pageId}"] > section`).count() };
  if (id !== "introduction") {
    const button = mobile.locator("button.dango-docs__primary").last();
    const before = await button.getAttribute("data-action-state");
    await button.evaluate((node) => { node.scrollIntoView({block:"center"}); node.click(); });
    const after = await button.getAttribute("data-action-state");
    const afterPath = new URL(`mobile/${id}-after.png`, root);
    await phone.screenshot({ path: afterPath.pathname });
    entries.push({ id: `${pageId}-mobile-after`, path: `migrations/dango-v2/captures/demo/mobile/${id}-after.png`, sha256: await hash(afterPath), viewport: { width: 1440, height: 1000 }, contentCanvas: { width: 390, height: 844 }, state: "activated-focus-retained" });
    await button.evaluate((node) => { node.dispatchEvent(new FocusEvent("blur", { bubbles: true })); });
    await mobile.waitForTimeout(0);
    const restored = await button.getAttribute("data-action-state");
    const restoredPath = new URL(`mobile/${id}-restored.png`, root);
    await phone.screenshot({ path: restoredPath.pathname });
    entries.push({ id: `${pageId}-mobile-restored`, path: `migrations/dango-v2/captures/demo/mobile/${id}-restored.png`, sha256: await hash(restoredPath), viewport: { width: 1440, height: 1000 }, contentCanvas: { width: 390, height: 844 }, state: "restored-default" });
    probes[id].interaction = { before, after, restored, changed: before !== after, restoredOk: before === restored };
    const computed = await button.evaluate((node) => { const s=getComputedStyle(node); return {height:s.height,borderRadius:s.borderRadius,backgroundColor:s.backgroundColor}; });
    await button.focus();
    const focus = await button.evaluate((node) => getComputedStyle(node).outlineStyle);
    probes[id].primary = {...computed, focus};
  }
  await mobile.close();

  // Exercise the approved responsive rule against the real browser viewport,
  // not only against the 390px phone nested in the desktop inspector.
  const narrow = await browser.newPage({ viewport: { width: 389, height: 844 }, deviceScaleFactor: 1 });
  await narrow.goto(`http://127.0.0.1:5173/#/brand/dango-v2/pages/${pageId}`);
  await narrow.waitForSelector(`[data-page-id="${pageId}"]`, { state: "attached" });
  const narrowPath = new URL(`mobile/${id}-browser-389.png`, root);
  await narrow.screenshot({ path: narrowPath.pathname, fullPage: false });
  entries.push({ id: `${pageId}-mobile-browser-389`, path: `migrations/dango-v2/captures/demo/mobile/${id}-browser-389.png`, sha256: await hash(narrowPath), viewport: { width: 389, height: 844 }, state: "initial-normal-route-narrow-browser" });
  probes[id].narrowViewport = await narrow.evaluate(() => {
    const article = document.querySelector(".dango-docs__article");
    const sidebar = document.querySelector(".dango-docs__sidebar");
    const outline = document.querySelector(".dango-docs__outline");
    const rect = article.getBoundingClientRect();
    const ancestorBounds = [".workspace", ".demo-stage", ".component-showcase", ".template-preview"].map((selector) => {
      const node = document.querySelector(selector);
      const bounds = node.getBoundingClientRect();
      return { selector, x: bounds.x, width: bounds.width, right: bounds.right, overflowX: getComputedStyle(node).overflowX };
    });
    return {
      innerWidth: window.innerWidth,
      article: { x: rect.x, width: rect.width, right: rect.right },
      sidebarDisplay: getComputedStyle(sidebar).display,
      outlineDisplay: getComputedStyle(outline).display,
      documentScrollWidth: document.documentElement.scrollWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      articleWithinViewport: rect.x >= 0 && rect.right <= window.innerWidth,
      ancestorBounds,
      showcaseDoesNotClip: ancestorBounds.every((item) => item.x <= rect.x && item.right >= rect.right && item.overflowX !== "hidden"),
    };
  });
  await narrow.close();
}
await fs.writeFile(new URL("browser-probes.json", root), `${JSON.stringify({ capturedAt: new Date().toISOString(), probes }, null, 2)}\n`);
await fs.writeFile(new URL("../../demo-screenshot-manifest.json", root), `${JSON.stringify({ schema:"brand-demo-screenshot-manifest/v1", brand:"dango-v2", stage:"demo-shared-showcase-repair", generatedAt:new Date().toISOString(), entries, browserProbes:probes }, null, 2)}\n`);
await browser.close();
