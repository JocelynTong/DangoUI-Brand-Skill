import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import { installEffectiveVisibility } from "./run-rendered-evidence-collector.mjs";
import { installRenderedSurfaceSampler } from "./rendered-surface-sampler.mjs";

test("frame surfaces bind actual SVG, image and text to visible section geometry and computed styles", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.route("https://example.test/**", route => route.abort());
    await page.setContent(`<style>body{margin:0}section{background:rgb(12,34,56);padding:20px}h2{font-size:32px;color:rgb(78,90,12)}svg,img{width:100px;height:80px}.off{position:absolute;left:1600px}</style>
      <section id="content"><h2>Actual heading</h2><p>Visible text</p><svg viewBox="0 0 120 90" aria-label="animation"><image href="https://example.test/raw.png" width="100" height="80"/><rect width="30" height="30"/></svg><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='80'/%3E"></section>
      <section class="off"><h2>Offscreen</h2><svg width="100" height="80"></svg></section><svg style="display:none" width="100" height="80"></svg>`);
    await page.evaluate(installEffectiveVisibility);
    await page.evaluate(installRenderedSurfaceSampler);
    const result = await page.evaluate(() => window.__brandRenderedSurface());
    const section = result.visibleSectionSamples.find(item => item.selector === "section#content");
    assert.equal(section.computedStyle.backgroundColor, "rgb(12, 34, 56)");
    const heading = result.visibleTextSamples.find(item => item.text === "Actual heading");
    assert.equal(heading.sectionSelector, section.selector);
    assert.equal(heading.computedStyle.fontSize, "32px");
    assert.equal(heading.computedStyle.color, "rgb(78, 90, 12)");
    assert.equal(result.visibleMediaSamples.length, 2);
    const svg = result.visibleMediaSamples.find(item => item.tagName === "svg");
    assert.equal(svg.sectionSelector, section.selector);
    assert.equal(svg.boundingBox.width, 100);
    assert.equal(svg.provenance.viewBox, "0 0 120 90");
    assert.deepEqual(svg.provenance.sources, [{ kind: "image", url: "https://example.test/raw.png" }]);
    assert.equal(svg.provenance.inlineSvg, true);
    assert.equal("role" in svg, false);
    assert.equal("runtimeAsset" in svg.provenance, false);
    for (const item of [...result.visibleSectionSamples, ...result.visibleMediaSamples, ...result.visibleTextSamples]) {
      assert.equal(await page.locator(item.selector).count(), 1, "frame selectors locate exact rendered nodes");
    }
    await page.setContent(`<style>body{margin:0}svg{width:30px;height:30px}</style><section>${"<svg></svg>".repeat(60)}</section>`);
    const bounded = await page.evaluate(() => window.__brandRenderedSurface());
    assert.equal(bounded.visibleMediaSamples.length, 48);
    assert.equal(bounded.surfaceSampling.mediaTruncated, true);
  } finally { await browser.close(); }
});

test("visible text sampling includes footer and generic nodes without counting hidden/offscreen text", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<style>body{margin:0}footer{font-size:10px}.off{position:absolute;left:1500px}.clip{height:10px;overflow:hidden}.clip span{position:relative;top:100px}</style>
      <main><h1>Heading</h1><div>Generic visible copy</div></main>
      <footer><small>Publisher copyright and legal details</small></footer>
      <div style="opacity:0">Invisible ancestor</div><div class="off">Offscreen copy</div>
      <div class="clip"><span>Clipped copy</span></div><p style="color:transparent">Transparent copy</p>
      <script>window.hiddenScriptText='Not rendered';</script>`);
    await page.evaluate(installEffectiveVisibility);
    await page.evaluate(installRenderedSurfaceSampler);
    const result = await page.evaluate(() => window.__brandRenderedSurface());
    assert.deepEqual(result.visibleTextSamples.map((item) => item.text), ["Heading", "Generic visible copy", "Publisher copyright and legal details"]);
    assert.equal(result.visualMediaCount, 0);
    await page.setContent(`<style>html,body{width:100%;height:100%;margin:0}body{background-image:linear-gradient(red,blue)}</style>`);
    const background = await page.evaluate(() => window.__brandRenderedSurface());
    assert.equal(background.visibleTextSamples.length, 0);
    assert.equal(background.visualMediaCount, 1, "body CSS background is a visible surface, not invented text");
    await page.setContent(`<style>body{background:white}</style><div style="display:none;background-image:linear-gradient(red,blue);height:100px">Hidden</div>`);
    const blank = await page.evaluate(() => window.__brandRenderedSurface());
    assert.equal(blank.visibleTextSamples.length, 0);
    assert.equal(blank.visualMediaCount, 0, "plain or hidden surfaces must remain empty");
    await page.setContent(`<main>${Array.from({ length: 120 }, (_, i) => `<span>word-${i}</span>`).join(" ")}</main>`);
    const bounded = await page.evaluate(() => window.__brandRenderedSurface());
    assert.equal(bounded.visibleTextSamples.length, 96);
    assert.equal(bounded.textSampling.truncated, true);
  } finally { await browser.close(); }
});

test("long-page root viewport clipping survives native scroll while nested clips remain enforced", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<style>html{overflow:auto}body{margin:0}main{height:1800px}footer{height:300px}
      .clip{position:relative;width:100px;height:25px;overflow:auto}.clip span{position:absolute;left:160px;top:0}
      .image{width:100px;height:60px;background-image:linear-gradient(red,blue)}</style>
      <main>Initial copy</main><footer><h2>Scrolled footer heading</h2><small>Visible legal text</small>
      <div class="image"></div><div class="clip"><span>Nested clipped text</span></div></footer>`);
    await page.evaluate(installEffectiveVisibility);
    await page.evaluate(installRenderedSurfaceSampler);
    await page.evaluate(() => scrollTo(0, 1800));
    const result = await page.evaluate(() => ({ y: scrollY, rootTop: document.documentElement.getBoundingClientRect().top,
      ...window.__brandRenderedSurface(), nested: window.__brandEffectiveVisibility(document.querySelector(".clip span")) }));
    assert.ok(result.y > 1000 && result.rootTop < -1000);
    assert.ok(result.visibleTextSamples.some((item) => item.text === "Scrolled footer heading"));
    assert.ok(result.visibleTextSamples.some((item) => item.text === "Visible legal text"));
    assert.equal(result.visibleTextSamples.some((item) => item.text === "Initial copy"), false);
    assert.equal(result.visibleTextSamples.some((item) => item.text === "Nested clipped text"), false);
    assert.equal(result.nested.visible, false);
    assert.ok(result.nested.reasons.includes("clipped-by-overflow-ancestor"));
    assert.equal(result.visualMediaCount, 1);
    // With root overflow visible, body overflow is propagated to viewport.
    await page.addStyleTag({ content: "html{overflow:visible}body{overflow:auto}" });
    const bodyOwner = await page.evaluate(() => window.__brandRenderedSurface());
    assert.ok(bodyOwner.visibleTextSamples.some((item) => item.text === "Visible legal text"));
  } finally { await browser.close(); }
});
