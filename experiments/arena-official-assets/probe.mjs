import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: "/Users/jocelyn/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const failures = [];
page.on("console", (message) => {
  if (message.type() === "error") failures.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => failures.push({ type: "pageerror", text: error.message }));
await page.goto(`file://${path.join(here, "index.html")}`, { waitUntil: "networkidle" });
const result = await page.evaluate(() => ({
  viewport: [window.innerWidth, window.innerHeight],
  images: [...document.images].map((image) => ({
    src: image.getAttribute("src"),
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  })),
  hero: (() => {
    const box = document.querySelector(".arena-hero").getBoundingClientRect();
    return { width: box.width, height: box.height, top: box.top, bottom: box.bottom };
  })(),
  headline: document.querySelector("h1").innerText,
  actionBottom: document.querySelector(".primary-action").getBoundingClientRect().bottom,
}));
console.log(JSON.stringify({ ...result, failures }, null, 2));
await browser.close();
