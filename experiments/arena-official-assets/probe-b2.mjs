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
await page.goto(`file://${path.join(here, "index-b2.html")}`, { waitUntil: "networkidle" });
const metrics = await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  hero: (() => {
    const box = document.querySelector(".arena-hero").getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, width: box.width, height: box.height };
  })(),
  heroImages: [...document.querySelectorAll(".arena-hero img")].map((image) => ({
    className: image.className,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  })),
  heroPrimaryActions: document.querySelectorAll(".arena-hero__actions .primary-action").length,
  heroForbiddenNodes: {
    cards: document.querySelectorAll(".arena-hero .battle-card").length,
    broadcast: document.querySelectorAll(".arena-hero__broadcast").length,
    activity: document.querySelectorAll(".arena-hero__activity").length,
  },
  postHero: {
    top: document.querySelector(".battle-feed").getBoundingClientRect().top,
    images: document.querySelectorAll(".battle-feed img").length,
    heading: document.querySelector(".battle-feed h2").innerText,
  },
  actionBottom: document.querySelector(".primary-action").getBoundingClientRect().bottom,
  allImagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
}));
console.log(JSON.stringify({ ...metrics, failures }, null, 2));
await browser.close();
