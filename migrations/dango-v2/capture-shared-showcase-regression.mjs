import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const base = "http://127.0.0.1:5173/";
const outDir = path.resolve("migrations/dango-v2/captures/shared-showcase-regression");
await fs.mkdir(outDir, { recursive: true });
const hash = async (file) => crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
const cases = [
  ...["introduction", "button", "release-checklist"].flatMap((name) => [
    { id: `dango-v2-${name}-desktop`, brand: "dango-v2", pageId: `dango-v2-${name}`, viewport: { width: 1440, height: 900 }, query: "?proof=desktop" },
    { id: `dango-v2-${name}-mobile-389`, brand: "dango-v2", pageId: `dango-v2-${name}`, viewport: { width: 389, height: 844 }, query: "" },
  ]),
  { id: "dango-default", brand: "dango", pageId: "dango-introduction-calibration", viewport: { width: 1440, height: 1000 }, query: "" },
  { id: "czn-default", brand: "czn", pageId: "czn-home", viewport: { width: 1440, height: 1000 }, query: "" },
  { id: "onepiece-cardgame-default", brand: "onepiece-cardgame", pageId: "onepiece-cardgame-home", viewport: { width: 1440, height: 1000 }, query: "" },
  { id: "pokemon-tcg-official-default", brand: "pokemon-tcg-official", pageId: "pokemon-tcg-official-home", viewport: { width: 1440, height: 1000 }, query: "" },
];

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const observations = [];
for (const fixture of cases) {
  const page = await browser.newPage({ viewport: fixture.viewport, deviceScaleFactor: 1 });
  await page.goto(`${base}${fixture.query}#/brand/${fixture.brand}/pages/${fixture.pageId}`);
  await page.waitForSelector(`[data-page-id="${fixture.pageId}"]`, { state: "attached" });
  const screenshot = path.join(outDir, `${fixture.id}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const geometry = await page.evaluate(({ brand }) => {
    const selectors = [".workspace", ".demo-stage", ".component-showcase", ".template-preview", ".phone", ".phone-screen"];
    const rects = Object.fromEntries(selectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) return [selector, null];
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return [selector, { x: rect.x, width: rect.width, right: rect.right, height: rect.height, overflowX: style.overflowX, padding: style.padding }];
    }));
    const docs = brand === "dango-v2" ? document.querySelector(".dango-docs") : null;
    const article = brand === "dango-v2" ? document.querySelector(".dango-docs__article") : null;
    const bounds = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x, width: rect.width, right: rect.right, fullyVisible: rect.x >= 0 && rect.right <= innerWidth };
    };
    return {
      innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      rects,
      docs: bounds(docs),
      article: bounds(article),
      sidebarDisplay: brand === "dango-v2" ? getComputedStyle(document.querySelector(".dango-docs__sidebar")).display : null,
      outlineDisplay: brand === "dango-v2" ? getComputedStyle(document.querySelector(".dango-docs__outline")).display : null,
    };
  }, { brand: fixture.brand });
  const mobileDango = fixture.brand === "dango-v2" && fixture.viewport.width === 389;
  const visibleSurface = geometry.rects[".phone-screen"];
  const pass = Boolean(visibleSurface && visibleSurface.width > 0 && visibleSurface.height > 0)
    && (!mobileDango || (
      geometry.rects[".component-showcase"].x === 0
      && geometry.rects[".component-showcase"].right === 389
      && geometry.rects[".component-showcase"].overflowX === "visible"
      && geometry.docs?.fullyVisible
      && geometry.article?.fullyVisible
      && geometry.sidebarDisplay === "none"
      && geometry.outlineDisplay === "none"
      && geometry.documentScrollWidth <= geometry.innerWidth
    ));
  observations.push({ ...fixture, screenshot: path.relative(process.cwd(), screenshot), sha256: await hash(screenshot), geometry, pass });
  await page.close();
}
await browser.close();

const failures = observations.filter((item) => !item.pass).map((item) => item.id);
const report = {
  schema: "brand-shared-showcase-regression-matrix/v1",
  brand: "dango-v2",
  ownerRole: "demoImplementationAgent",
  repairRevision: 3,
  sharedSurface: ".workspace > .demo-stage > .component-showcase > .template-preview",
  verdict: failures.length ? "fail" : "pass",
  summary: { total: observations.length, passing: observations.length - failures.length, failures },
  observations,
};
await fs.writeFile("migrations/dango-v2/shared-showcase-regression-matrix.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary));
if (failures.length) process.exitCode = 1;
