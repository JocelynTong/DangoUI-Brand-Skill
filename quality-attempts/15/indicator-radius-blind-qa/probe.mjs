import { chromium } from "playwright-core";

const executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const origin = "http://127.0.0.1:5177/";
const surfaces = [
  ["dango-style-color", "#/brand/dango/style/color"],
  ["pokemon-style-button", "#/brand/pokemon-tcg-official/style/button"],
  ["dango-navigation-bar", "#/brand/dango/components/navigation-bar"],
  ["pokemon-home", "#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home"],
  ["onepiece-home", "#/brand/onepiece-cardgame/pages/onepiece-cardgame-home"],
];
const viewports = [[1184, 933], [777, 848]];

const browser = await chromium.launch({ headless: true, executablePath });
const results = [];
for (const [width, height] of viewports) {
  const page = await browser.newPage({ viewport: { width, height } });
  for (const [name, hash] of surfaces) {
    await page.goto(origin + hash, { waitUntil: "networkidle" });
    await page.waitForSelector(".phone.template-phone");
    const sample = await page.evaluate(() => {
      const phone = document.querySelector(".phone.template-phone");
      const screen = phone?.querySelector(".phone-screen");
      const indicator = phone?.querySelector(":scope > .mock-home-indicator--outer");
      const tabbar = phone?.querySelector(".demo-bottom-tabbar");
      const rect = (el) => {
        const r = el?.getBoundingClientRect();
        return r && { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const css = (el) => el && getComputedStyle(el);
      const sc = css(screen);
      const ic = css(indicator);
      const tc = css(tabbar);
      const before = screen?.scrollTop ?? null;
      if (screen) screen.scrollTop = Math.min(120, Math.max(0, screen.scrollHeight - screen.clientHeight));
      const after = screen?.scrollTop ?? null;
      const indicatorAfterScroll = rect(indicator);
      if (screen) screen.scrollTop = before;
      return {
        classes: phone?.className,
        hasTabbar: Boolean(tabbar),
        phone: rect(phone), screen: rect(screen), indicator: rect(indicator), indicatorAfterScroll,
        screenRadius: { left: sc?.borderBottomLeftRadius, right: sc?.borderBottomRightRadius },
        indicatorRadius: { left: ic?.borderBottomLeftRadius, right: ic?.borderBottomRightRadius },
        indicatorDisplay: ic?.display,
        indicatorBackground: ic?.background,
        tabbarBackground: tc?.background,
        scroll: { before, after, restored: screen?.scrollTop ?? null, scrollHeight: screen?.scrollHeight, clientHeight: screen?.clientHeight },
      };
    });
    results.push({ name, viewport: { width, height }, url: page.url(), ...sample });
    if (name === "pokemon-style-button") {
      await page.locator(".phone.template-phone").screenshot({ path: new URL(`./pokemon-style-button-${width}x${height}.png`, import.meta.url).pathname });
    }
  }
  await page.close();
}

for (const proof of ["1", "desktop", "mobile"]) {
  const page = await browser.newPage({ viewport: { width: 1184, height: 933 } });
  const hash = "#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home";
  await page.goto(`${origin}?proof=${proof}${hash}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".phone.template-phone");
  const state = await page.evaluate(() => {
    const phone = document.querySelector(".phone.template-phone");
    const indicator = phone?.querySelector(":scope > .mock-home-indicator--outer");
    return { phoneClasses: phone?.className, present: Boolean(indicator), display: indicator && getComputedStyle(indicator).display };
  });
  results.push({ name: `pokemon-home-proof-${proof}`, viewport: { width: 1184, height: 933 }, url: page.url(), proof: state });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
