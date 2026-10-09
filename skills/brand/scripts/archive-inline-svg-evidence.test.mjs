import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import test from "node:test";
import { chromium } from "playwright-core";
import { installEffectiveVisibility } from "./run-rendered-evidence-collector.mjs";
import { createInlineSvgEvidenceArchive, INLINE_SVG_LIMITS } from "./archive-inline-svg-evidence.mjs";

test("visible original SVG compositions retain paths/defs, computed observations and unresolved references with immutable frame bindings", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-inline-svg-test-"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.route("https://example.test/**", route => route.abort());
    await page.setContent(`<style>body{margin:0}.source-fill{fill:rgb(12,34,56)}section{width:800px}.off{position:absolute;left:1600px}</style>
      <svg style="display:none"><defs><filter id="page-def"><feGaussianBlur stdDeviation="2"/></filter></defs></svg>
      <section id="scope"><h2>Source section</h2>
      <svg id="source" width="100" height="80" viewBox="0 0 100 80"><defs><clipPath id="local"><path d="M0 0 L100 0 L100 80 Z"/></clipPath></defs><g clip-path="url(#local)"><path class="source-fill" d="M1 2 L30 40 Z"/><svg width="30" height="30"><path d="M2 3 L8 9"/></svg></g></svg>
      <svg id="external" width="100" height="80"><image href="https://example.test/raw.svg" width="100" height="80"/></svg>
      <svg id="page-local" width="100" height="80"><path filter="url(#page-def)" d="M1 1 L50 50"/></svg>
      <svg id="missing" width="100" height="80"><use href="#absent"/></svg>
      <svg id="offscreen" class="off" width="100" height="80"></svg></section>`);
    await page.evaluate(installEffectiveVisibility);
    const recorder = createInlineSvgEvidenceArchive({ outputDir: root });
    const { placements } = await recorder.capture(page, { frameIndex: 7, screenshotPath: "/evidence/frame-7.png" });
    assert.equal(placements.length, 4, "hidden, offscreen and nested SVG are not separate assets");
    const source = placements.find(item => item.selector === "svg#source");
    const original = fs.readFileSync(source.originalPath, "utf8"), observed = fs.readFileSync(source.observationPath, "utf8");
    assert.match(original, /d="M1 2 L30 40 Z"/);
    assert.match(original, /<defs>.*clipPath/s);
    assert.match(original, /clip-path="url\(#local\)"/);
    assert.equal(original.includes("rgb(12, 34, 56)"), false, "source original was not restyled");
    assert.ok(observed.includes("fill: rgb(12, 34, 56)"), "current computed fill exists only in named derivative");
    assert.equal(source.sectionSelector, "section#scope");
    assert.equal(source.viewBox, "0 0 100 80");
    assert.equal(source.boundingBox.width, 100);
    assert.equal(source.frameIndex, 7);
    assert.equal(source.completeAnimation, false);
    assert.equal(source.approvedRuntimeAsset, false);
    assert.equal(source.specs.maxSafeDisplaySize, null);
    assert.equal(source.specs.transparency, "unknown");
    assert.equal(source.sourceSha256, crypto.createHash("sha256").update(original).digest("hex"));
    assert.equal(source.bindingSha256, crypto.createHash("sha256").update(fs.readFileSync(source.metadataPath)).digest("hex"));
    const repeated = await recorder.capture(page, { frameIndex: 8 });
    assert.equal(repeated.placements.length, 0);
    assert.equal(repeated.previouslyCapturedCount, 4);
    assert.equal(recorder.summary().assetCount, 4, "repeated animation frame does not consume later section budget");
    await page.evaluate(() => document.querySelector("#scope").insertAdjacentHTML("beforeend", '<svg id="later-section" width="100" height="80"><path d="M1 1 L40 40"/></svg>'));
    const later = await recorder.capture(page, { frameIndex: 9 });
    assert.equal(later.placements.length, 1);
    assert.equal(later.placements[0].selector, "svg#later-section");
    assert.equal(later.placements[0].frameIndex, 9);
    assert.equal(recorder.summary().firstFramePerSelectorOnly, true);
    assert.ok(source.dependencies.some(dep => dep.fragmentId === "local" && dep.status === "contained"));
    assert.equal(source.selfContained, false, "bounded computed styles do not claim full CSS closure");
    assert.ok(placements.find(item => item.selector === "svg#external").unresolvedReasons.includes("EXTERNAL_DEPENDENCY_UNBOUND"));
    assert.ok(placements.find(item => item.selector === "svg#page-local").unresolvedReasons.includes("PAGE_LOCAL_DEFS_NOT_CONTAINED"));
    assert.ok(placements.find(item => item.selector === "svg#missing").unresolvedReasons.includes("MISSING_LOCAL_REFERENCE"));
    const tiny = createInlineSvgEvidenceArchive({ outputDir: root, limits: { maxAssetBytes: 100 } });
    await tiny.capture(page);
    assert.equal(tiny.summary().assetCount, 0);
    assert.ok(tiny.summary().skipped.some(item => item.reason === "SVG_ASSET_BYTE_LIMIT"));
    const total = createInlineSvgEvidenceArchive({ outputDir: root, limits: { maxTotalBytes: source.bytes - 1 } });
    await total.capture(page);
    assert.ok(total.summary().skipped.some(item => item.reason === "SVG_TOTAL_BYTE_LIMIT"));
    assert.ok(total.summary().totalBytes <= source.bytes - 1);
    assert.notEqual(tiny.directory, recorder.directory, "new archive never overwrites source originals");
    await page.setContent(`<style>body{margin:0}svg{width:40px;height:40px}</style>${"<svg><path d='M1 1 L30 30'/></svg>".repeat(20)}`);
    const bounded = createInlineSvgEvidenceArchive({ outputDir: root, limits: { maxAssets: 99, maxTotalBytes: Infinity } });
    await bounded.capture(page);
    await bounded.capture(page);
    assert.equal(bounded.summary().assetCount, 16);
    assert.equal(bounded.summary().limits.maxAssets, INLINE_SVG_LIMITS.maxAssets);
    assert.ok(bounded.summary().totalBytes <= INLINE_SVG_LIMITS.maxTotalBytes);
    assert.equal(fs.readFileSync(source.originalPath, "utf8"), original);
    await page.setContent('<svg id="duplicate" width="100" height="80"></svg><svg id="duplicate" width="100" height="80"></svg>');
    const duplicates = createInlineSvgEvidenceArchive({ outputDir: root });
    const dup = await duplicates.capture(page);
    assert.equal(dup.placements.length, 2);
    for (const placement of dup.placements) assert.equal(await page.locator(placement.selector).count(), 1);
    await page.setContent(`<svg id="dense-source" width="300" height="200" viewBox="0 0 300 200"><defs><clipPath id="dense-clip"><rect width="300" height="200"/></clipPath></defs><g clip-path="url(#dense-clip)">${'<path d="M1 2 L3 4 Z"/>'.repeat(12057)}</g></svg>`);
    const denseRecorder = createInlineSvgEvidenceArchive({ outputDir: root });
    const dense = (await denseRecorder.capture(page)).placements[0];
    assert.ok(dense.nodeCount > 12000);
    assert.ok(fs.statSync(dense.originalPath).size < INLINE_SVG_LIMITS.maxAssetBytes);
    assert.equal(dense.observationPath, null);
    assert.equal(dense.observationSha256, null);
    assert.equal(dense.observationOmittedReason, "COMPUTED_OBSERVATION_NODE_BUDGET");
    assert.match(fs.readFileSync(dense.originalPath, "utf8"), /<defs>.*dense-clip/s);
    assert.equal((fs.readFileSync(dense.originalPath, "utf8").match(/<path /g) || []).length, 12057);
    assert.equal(dense.selfContained, false);
    assert.equal(dense.status, "unresolved");
  } finally { await browser.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
