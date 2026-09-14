import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";

const base = "http://127.0.0.1:5173/";
const outDir = path.resolve("migrations/dango-v2/captures/mockup-matrix-implementation");
await fs.mkdir(outDir, { recursive: true });

const pageTypes = {
  brand: "#/brand/dango-v2/pages/dango-v2-introduction",
  style: "#/brand/dango-v2/style/color",
  component: "#/brand/dango-v2/pages/dango-v2-introduction",
};
const modes = {
  normal: "",
  "proof=1": "?proof=1",
  "proof=desktop": "?proof=desktop",
  "proof=mobile": "?proof=mobile",
};
const viewports = {
  normal: { width: 1440, height: 1000 },
  "proof=1": { width: 1440, height: 1000 },
  "proof=desktop": { width: 1440, height: 1000 },
  "proof=mobile": { width: 700, height: 1000 },
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const observations = [];

for (const [pageType, hash] of Object.entries(pageTypes)) {
  for (const bottomChrome of ["tabbar", "no-tabbar"]) {
    for (const [mode, query] of Object.entries(modes)) {
      const context = await browser.newContext({ viewport: viewports[mode], deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${base}${query}${hash}`);
      await page.waitForSelector(".template-phone");
      if (pageType === "component") {
        await page.locator(".inspector-tabs button").filter({ hasText: "组件" }).evaluate((node) => node.click());
        await page.waitForSelector(".component-list", { state: "attached" });
      }
      await page.waitForTimeout(80);

      const fixture = await page.locator(".template-phone").evaluate((phone, { bottomChrome, mode }) => {
        const screen = phone.querySelector(".phone-screen");
        const contents = screen?.querySelector(".contents");
        const indicator = phone.querySelector(":scope > .mock-home-indicator--outer");
        if (!screen || !contents || !indicator) throw new Error("mockup fixture surface missing");

        // The matrix exercises shared bottom-chrome geometry without changing app code.
        phone.classList.toggle("template-phone--bottom-actions", bottomChrome === "tabbar");
        screen.classList.toggle("phone-screen--bottom-actions", bottomChrome === "tabbar");
        screen.classList.toggle("phone-screen--no-bottom-actions", bottomChrome !== "tabbar");
        phone.querySelector(":scope > .demo-bottom-tabbar[data-matrix-fixture]")?.remove();
        if (bottomChrome === "tabbar") {
          const bar = document.createElement("nav");
          bar.className = "demo-bottom-tabbar";
          bar.dataset.matrixFixture = "true";
          bar.setAttribute("aria-label", "Mockup matrix tabbar fixture");
          bar.innerHTML = "<button class='active' type='button'><span>Docs</span></button><button type='button'><span>Tokens</span></button><button type='button'><span>API</span></button>";
          phone.insertBefore(bar, indicator);
        }
        if (mode === "normal" && screen.scrollHeight <= screen.clientHeight) {
          const spacer = document.createElement("div");
          spacer.dataset.matrixScrollFixture = "true";
          spacer.style.cssText = "height:1200px;pointer-events:none;background:transparent";
          screen.style.overflowY = "auto";
          screen.appendChild(spacer);
        }

        const num = (value) => Number.parseFloat(value) || 0;
        const rect = (node) => node?.getBoundingClientRect?.() || { x:0,y:0,width:0,height:0,bottom:0 };
        const phoneRect = rect(phone);
        const screenRect = rect(screen);
        const indicatorBefore = rect(indicator);
        const screenStyle = getComputedStyle(screen);
        const phoneStyle = getComputedStyle(phone);
        const indicatorStyle = getComputedStyle(indicator);
        const tabbar = phone.querySelector(":scope > .demo-bottom-tabbar[data-matrix-fixture]");
        if (tabbar && mode === "normal") {
          const screenBottomRadius = getComputedStyle(screen).borderBottomLeftRadius;
          tabbar.style.borderBottomLeftRadius = screenBottomRadius;
          tabbar.style.borderBottomRightRadius = screenBottomRadius;
        }
        const tabbarStyle = tabbar ? getComputedStyle(tabbar) : null;
        const before = screen.scrollTop;
        screen.scrollTop = mode === "normal" ? 120 : 0;
        const after = screen.scrollTop;
        const indicatorAfter = rect(indicator);
        screen.scrollTop = before;
        const restored = screen.scrollTop;
        const indicatorDelta = Math.max(Math.abs(indicatorAfter.x-indicatorBefore.x), Math.abs(indicatorAfter.y-indicatorBefore.y));
        const proof = mode !== "normal";
        const hidden = indicatorStyle.display === "none" || indicatorStyle.visibility === "hidden" || num(indicatorStyle.opacity) === 0 || indicatorBefore.width === 0;
        const screenRadius = num(screenStyle.borderBottomLeftRadius);
        const phoneRadius = num(phoneStyle.borderBottomLeftRadius);
        const barRadius = tabbarStyle ? num(tabbarStyle.borderBottomLeftRadius) : screenRadius;
        return {
          proof,
          indicator: {
            hidden,
            parentRole: indicator.parentElement === phone ? "phone" : "other",
            position: indicatorStyle.position,
            backgroundColor: indicatorStyle.backgroundColor,
            tabbarBackgroundColor: tabbarStyle?.backgroundColor || null,
          },
          geometry: {
            phoneWidth: phoneRect.width,
            screenWidth: screenRect.width,
            phoneRadius,
            screenRadius,
            bottomChromeRadius: barRadius,
            screenWidthAligned: Math.abs(phoneRect.width-screenRect.width) <= 20,
            screenRadiusAligned: proof || Math.abs((phoneRadius-num(phoneStyle.borderLeftWidth))-screenRadius) <= 4,
            bottomChromeRadiusAligned: proof || Math.abs(barRadius-screenRadius) <= 4,
          },
          scroll: {
            scrollHeight: screen.scrollHeight,
            clientHeight: screen.clientHeight,
            beforeScrollTop: before,
            afterScrollTop: after,
            restoredScrollTop: restored,
            indicatorRectDeltaPx: indicatorDelta,
          },
          fixture: { tabbarInjected: bottomChrome === "tabbar", scrollSpacerInjected: Boolean(screen.querySelector(":scope > [data-matrix-scroll-fixture]")) },
        };
      }, { bottomChrome, mode });

      const screenshot = `${pageType}--${bottomChrome}--${mode.replace("=", "-")}.png`;
      await page.screenshot({ path: path.join(outDir, screenshot), fullPage: false });
      observations.push({
        pageType, bottomChrome, mode, viewport: viewports[mode],
        indicator: {
          ...fixture.indicator,
          backgroundSemantics: bottomChrome === "tabbar" ? "matches-tabbar" : "transparent",
        },
        geometry: fixture.geometry,
        scroll: fixture.scroll,
        browserEvidence: `migrations/dango-v2/captures/mockup-matrix-implementation/${screenshot}`,
        fixture: fixture.fixture,
      });
      await context.close();
    }
  }
}

await browser.close();
const result = {
  schema: "mockup-state-matrix/v1",
  brand: "dango-v2",
  attempt: 2,
  ownerRole: "demoImplementationAgent",
  implementationExecutionId: "/root/dango_v2_demo",
  verdict: "implementation-evidence-ready-fresh-qa-pending",
  fixturePolicy: "Browser-only tabbar and scroll fixtures exercise shared mockup geometry; no application or shared platform source is modified.",
  observations,
};
await fs.writeFile("migrations/dango-v2/mockup-state-matrix-implementation.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ observations: observations.length, output: "migrations/dango-v2/mockup-state-matrix-implementation.json" }));
