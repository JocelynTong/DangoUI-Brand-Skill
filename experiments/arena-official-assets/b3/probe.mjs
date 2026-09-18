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
const metrics = await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  hero: (() => {
    const box = document.querySelector(".arena-hero").getBoundingClientRect();
    return { width: box.width, height: box.height, bottom: box.bottom };
  })(),
  heroPrimaryActions: document.querySelectorAll(".arena-hero__actions .primary-action").length,
  heroForbiddenNodes: {
    cards: document.querySelectorAll(".arena-hero .battle-card, .arena-hero .battle-feed__cards").length,
    photos: document.querySelectorAll(".arena-hero .arena-hero__broadcast, .arena-hero .battle-feed__media").length,
    activity: document.querySelectorAll(".arena-hero__activity").length,
  },
  heroImages: [...document.querySelectorAll(".arena-hero img")].map((image) => ({
    className: image.className,
    src: image.getAttribute("src"),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  })),
  crowdFigures: document.querySelectorAll(".foreground-crowd i").length,
  postHeroTop: document.querySelector(".battle-feed").getBoundingClientRect().top,
  allImagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
}));
console.log(JSON.stringify({ ...metrics, failures }, null, 2));
await browser.close();
