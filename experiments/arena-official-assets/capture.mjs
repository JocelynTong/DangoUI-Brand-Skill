import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: "/Users/jocelyn/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  headless: true,
});

for (const viewport of [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`file://${path.join(here, "index.html")}`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(here, "screenshots", `${viewport.name}.png`),
    fullPage: true,
  });
  await page.close();
}

await browser.close();
