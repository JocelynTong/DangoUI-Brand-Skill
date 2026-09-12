import { chromium } from "playwright-core";
import fs from "node:fs/promises";

const root = new URL("./captures/demo-2/", import.meta.url);
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const ids = ["home", "news", "character-gallery", "held-out"];
const probes = [];
for (const id of ids) {
  await page.goto(`http://127.0.0.1:5173/#/brand/re1999-v2/pages/re1999-v2-${id}`);
  await page.waitForSelector(`[data-page-id="re1999-v2-${id}"]`);
  await page.locator(".phone").screenshot({ path: new URL(`${id}-phone.png`, root).pathname });
  const probe = await page.locator(".phone-screen").evaluate((screen) => {
    const before = screen.scrollTop; screen.scrollTop = 220; const after = screen.scrollTop; screen.scrollTop = before;
    return { clientHeight: screen.clientHeight, scrollHeight: screen.scrollHeight, scrollWidth: screen.scrollWidth, clientWidth: screen.clientWidth, before, after, restored: screen.scrollTop };
  });
  probes.push({ pageId: `re1999-v2-${id}`, viewport: { width: 1440, height: 1000 }, contentViewport: { width: 390, height: 844 }, screenshot: `migrations/re1999-v2/captures/demo-2/${id}-phone.png`, sections: await page.locator(".r99v2 > section, .r99v2 > div").count(), horizontalOverflow: probe.scrollWidth > probe.clientWidth, scroll: probe });
  if (id === "news") {
    const before = await page.locator(".r99v2-state").innerText();
    await page.locator(".phone").screenshot({ path: new URL("news-filter-before.png", root).pathname });
    await page.getByRole("button", { name: "公告", exact: true }).click();
    const changed = await page.locator(".r99v2-state").innerText();
    await page.locator(".phone").screenshot({ path: new URL("news-filter-after.png", root).pathname });
    await page.getByRole("button", { name: "最新", exact: true }).click();
    const restored = await page.locator(".r99v2-state").innerText();
    await page.locator(".phone").screenshot({ path: new URL("news-filter-restored.png", root).pathname });
    probes.at(-1).interaction = { id: "news-filter", before, changed, restored, pass: before !== changed && before === restored };
  }
}
await fs.writeFile(new URL("browser-probes.json", root), `${JSON.stringify({ capturedAt: new Date().toISOString(), probes }, null, 2)}\n`);
await browser.close();
