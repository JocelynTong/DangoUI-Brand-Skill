import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: "/Users/jocelyn/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`file://${path.join(here, "index.html")}`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(here, "screenshots", "mobile-390-b3.png"), fullPage: false });
await browser.close();
