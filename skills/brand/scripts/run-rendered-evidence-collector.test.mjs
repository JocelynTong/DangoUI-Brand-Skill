#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brand-rendered-collector-"));
const fixture = `<!doctype html>
<html><head><meta charset="utf-8"><title>Visual lifecycle fixture</title>
<style>
html,body,.swiper-container,.swiper-wrapper,.swiper-slide{width:100%;height:100%;margin:0;overflow:hidden}
#intro{position:fixed;inset:0;width:100%;height:100%;z-index:5;background:#2b211f}
.swiper-slide{position:absolute;inset:0;transform:translateY(110%);background:linear-gradient(135deg,#29221f,#967653);color:white;padding:80px;box-sizing:border-box}
.swiper-slide-active{transform:none}.card{width:60%;height:45%;background:rgba(255,255,255,.18)}
button{position:fixed;right:20px;top:20px;background:#58cc02;border-radius:12px;transition:background-color .1s;padding:15px}button:hover{background:#46a302;filter:brightness(1.1)}button:focus{outline:3px solid blue}
button::before{content:"";background:#123456;box-shadow:0 3px 0 #333}
</style></head><body data-activations="0">
<video id="intro-start" autoplay></video>
<main class="swiper-container" style="visibility:hidden"><div class="swiper-wrapper">
<section class="swiper-slide page page0 swiper-slide-active"><h1>Settled home</h1><p>Primary task, official brand content, navigation, download actions, current announcements, and supporting product information are now visibly available.</p><img src="/identity.svg" alt="Identity fixture"><div class="card"></div></section>
<section class="swiper-slide page page1-before"><h1>Story transition</h1><p>Intermediate full-screen narrative state.</p><div class="card"></div></section>
<section class="swiper-slide page page1"><h1>World</h1><p>Official world and character introduction.</p><div class="card"></div></section>
<section class="swiper-slide page page2"><h1>News</h1><p>Current releases and announcements.</p><div class="card"></div></section>
<section class="swiper-slide page page3"><h1>Community</h1><p>Creator work and official channels.</p><div class="card"></div></section>
<section class="swiper-slide page page4"><h1>Official channels</h1><p>Verified social and download channels.</p><div class="card"></div></section>
<section class="swiper-slide page page-footer"><h1>Footer</h1><p>Publisher identity and legal information.</p><div class="card"></div></section>
</div></main>
<button type="button">Passive test control</button>
<svg id="inline-source" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" style="position:fixed;left:700px;top:20px;width:40px;height:40px"><defs><clipPath id="source-clip"><rect width="40" height="40"/></clipPath></defs><path d="M0 0H40V40H0Z" fill="#58cc02" clip-path="url(#source-clip)"/></svg>
<div style="position:fixed;left:100px;top:500px;width:50px;height:50px;overflow:hidden"><button id="clipped-control" style="position:absolute;left:80px;top:0;width:100px;height:50px">Clipped control</button><img src="/identity.svg" alt="Clipped fixture" style="position:absolute;left:80px;top:0;width:64px;height:64px"></div>
<div style="position:fixed;left:200px;top:500px;width:50px;height:50px;overflow:hidden"><img src="/identity.svg" alt="Partial fixture" style="position:absolute;left:25px;top:0;width:64px;height:64px"></div>
<div style="opacity:0"><img src="/identity.svg" alt="Invisible ancestor fixture" style="position:fixed;left:400px;top:500px;width:64px;height:64px"></div>
<div style="position:fixed;left:500px;top:500px;width:100px;height:100px;overflow:hidden;transform:scale(.5)"><img src="/identity.svg" alt="Transformed clip fixture" style="width:64px;height:64px"></div>
<img src="/identity.svg" alt="Offscreen fixture" style="position:fixed;left:2000px;top:20px;width:64px;height:64px">
<script>
const intro=document.querySelector('#intro-start');
document.querySelector('button').addEventListener('click',()=>{document.body.dataset.activations=String(Number(document.body.dataset.activations)+1)});
setTimeout(()=>{intro.remove();document.querySelector('main').style.visibility='visible'},1300);
const slides=[...document.querySelectorAll('.swiper-slide')];let active=0;
function next(){active=Math.min(active+1,slides.length-1);slides.forEach((slide,index)=>slide.classList.toggle('swiper-slide-active',index===active))}
addEventListener('wheel',event=>{if(event.deltaY>0)next()},{passive:true});
addEventListener('keydown',event=>{if(event.key==='PageDown')next()});
</script></body></html>`;

const server = http.createServer((request, response) => {
  if (request.url === "/identity.svg") {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#f6c344"/></svg>');
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(fixture);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const sourceUrl = `http://127.0.0.1:${port}/`;
const collector = path.join(root, "skills/brand/scripts/run-rendered-evidence-collector.mjs");

try {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [collector,
      "--root", root,
      "--brand", "visual-lifecycle-fixture",
      "--source-url", sourceUrl,
      "--force-browser",
      "--out-dir", outputRoot,
    ], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "manifest.json"), "utf8"));
  const capture = JSON.parse(fs.readFileSync(path.join(outputRoot, "raw-capture.json"), "utf8"));
  assert.equal(manifest.captureMethod, "browser-fallback");
  assert.equal(manifest.browserProof.settleTimedOut, false);
  assert.ok(fs.existsSync(path.join(outputRoot, "browser-opening.png")));
  assert.deepEqual([...fs.readFileSync(path.join(outputRoot, "browser-opening.png")).subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  const states = JSON.parse(fs.readFileSync(path.join(outputRoot, "control-state-evidence.json")));
  assert.equal(states.activationPerformed, false);
  const control = states.entries.find((entry) => entry.states?.some((state) => state.text === "Passive test control"));
  assert.ok(control);
  assert.equal(control.states.find((state) => state.state === "focus").focus, true);
  assert.equal(control.states.find((state) => state.state === "focus").hover, false);
  assert.equal(typeof control.states.find((state) => state.state === "focus").focusVisible, "boolean");
  assert.equal(control.states.find((state) => state.state === "focus").activationPerformed, false);
  assert.equal(control.states.find((state) => state.state === "focus").computed.filter, "none");
  const restored = control.states.find((state) => state.state === "restored");
  assert.ok(restored);
  assert.equal(restored.focus, false);
  assert.equal(restored.hover, false);
  assert.equal(restored.activationPerformed, false);
  assert.equal(restored.computed.filter, control.states[0].computed.filter);
  assert.equal(control.states.find((state) => state.state === "hover-settled-sample").computed.filter, "brightness(1.1)");
  assert.ok(control.changedComputedProperties.includes("filter"));
  assert.equal(typeof control.states[0].pseudoElements["::before"].filter, "string");
  assert.ok(states.excludedControls.some((item) => item.visibility.reasons.includes("clipped-by-overflow-ancestor")));
  assert.equal(states.entries.some((entry) => entry.states?.some((state) => state.id === "clipped-control")), false);
  assert.equal(control.states.find((state) => state.state === "hover-settled-sample").hover, true);
  assert.ok(control.changedComputedProperties.includes("background-color"));
  assert.equal(control.states[0].pseudoElements["::before"]["background-color"], "rgb(18, 52, 86)");
  for (const state of control.states) assert.equal(fs.existsSync(path.resolve(root, state.capture.path)), true);
  assert.ok(fs.existsSync(path.join(outputRoot, "continuous-scroll.webm")));
  const archived = JSON.parse(fs.readFileSync(path.join(outputRoot, "browser-assets.json"), "utf8"));
  assert.equal(archived.schema, "rendered-visual-assets/v1");
  assert.equal(archived.uniqueAssetCount, 1);
  assert.equal(manifest.browserProof.archivedUniqueAssetCount, 1);
  assert.deepEqual(archived.assets[0].specs.intrinsicSize, { width: 64, height: 64 });
  assert.equal(archived.assets[0].usageStatus, "visible-dom-bound");
  assert.ok(archived.assets[0].visiblePlacements.length > 0);
  assert.equal(archived.assets[0].visiblePlacements.some((placement) => placement.alt === "Offscreen fixture"), false);
  assert.equal(archived.assets[0].visiblePlacements.some((placement) => placement.alt === "Clipped fixture"), false);
  assert.equal(archived.assets[0].visiblePlacements.some((placement) => placement.alt === "Invisible ancestor fixture"), false);
  assert.equal(archived.assets[0].visiblePlacements.some((placement) => placement.alt === "Transformed clip fixture"), false);
  const partial = archived.assets[0].visiblePlacements.find((placement) => placement.alt === "Partial fixture");
  assert.ok(partial);
  assert.equal(partial.visibility.effectiveRect.width, 25);
  assert.ok(partial.visibility.reasons.includes("partially-clipped"));
  assert.match(fs.readFileSync(path.join(outputRoot, "rendered.html"), "utf8"), /data-activations="0"/);
  assert.ok(fs.existsSync(path.resolve(root, archived.assets[0].localPath)));
  assert.ok(capture.frames.length >= 3, "full-screen controller should produce multiple frames");
  assert.equal(capture.timing.timebase, "page-session-wall-clock");
  assert.equal(capture.capturePersistenceProbe.status, "passed");
  assert.equal(capture.capturePersistenceProbe.beforeFullCollection, true);
  assert.deepEqual(capture.capturePersistenceProbe.intrinsicSize, { width: 1440, height: 900 });
  assert.ok(Date.parse(capture.capturePersistenceProbe.checkedAt) <= Date.parse(capture.frames[0].capturedAt));
  assert.equal(capture.timing.videoOffsetVerified, false);
  assert.ok(capture.frames.every((frame) => Number.isFinite(frame.elapsedMs) && !Number.isNaN(Date.parse(frame.capturedAt))));
  assert.ok(capture.frames.every((frame, index) => index === 0 || frame.elapsedMs >= capture.frames[index - 1].elapsedMs));
  const inline = JSON.parse(fs.readFileSync(path.join(outputRoot, 'inline-svg-evidence.json'), 'utf8'));
  assert.equal(inline.assetCount, 1, 'normal automatic collection archives a visible SVG once across frames');
  assert.match(fs.readFileSync(inline.assets[0].originalPath, 'utf8'), /source-clip/);
  assert.equal(inline.assets[0].approvedRuntimeAsset, false);
  assert.equal(capture.frames[0].inlineSvgEvidence.placements.length, 1);
  assert.ok(fs.existsSync(path.resolve(root, manifest.browserProof.inlineArchivePath)));
  const supplementDir = path.join(outputRoot, 'inline-supplement');
  const supplemental = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [collector, '--root', outputRoot, '--brand', 'visual-lifecycle-fixture', '--source-url', sourceUrl, '--inline-only', '--prior-capture', 'raw-capture.json', '--out-dir', 'inline-supplement'], { cwd: root });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
  assert.equal(supplemental.code, 0, supplemental.stderr);
  const supplementaryFacts = JSON.parse(fs.readFileSync(path.join(supplementDir, 'inline-svg-evidence.json'), 'utf8'));
  assert.equal(supplementaryFacts.fullSourceCapture, false);
  assert.equal(supplementaryFacts.assetCount, 1);
  assert.equal(supplementaryFacts.frames.length, capture.frames.length);
  assert.ok(supplementaryFacts.frames.every(frame => frame.screenshotSha256?.length === 64));
  assert.equal(fs.existsSync(path.join(supplementDir, 'browser-full-page.png')), false);
  const activeSignals = new Set(capture.frames.flatMap((frame) => frame.environment.activeControllerSignals || []).map((item) => item.text));
  const activeClasses = new Set(capture.frames.flatMap((frame) => frame.environment.activeControllerSignals || []).map((item) => item.className));
  assert.equal(capture.captureEnvironment.viewportPageCount, 7);
  assert.ok(activeClasses.size >= 7, `expected all seven full-screen states, got ${activeClasses.size}`);
  assert.ok([...activeSignals].some((text) => text.includes("Settled home")));
  assert.ok([...activeSignals].some((text) => text.includes("News") || text.includes("Community")));
  const capturePlanPath = path.join(outputRoot, "capture-plan.json");
  fs.writeFileSync(capturePlanPath, JSON.stringify({
    brand: "visual-lifecycle-fixture",
    goalId: "visual-lifecycle-fixture-goal",
    runRoot: outputRoot,
    pages: [{
      id: "source",
      url: sourceUrl,
      captureDir: ".",
      rawCapture: "raw-capture.json",
      fullPageCapture: "browser-full-page.png",
      continuousCapture: "continuous-scroll.webm",
      expectedSections: { home: ["Settled home"], news: ["News"], community: ["Community"] },
    }],
    output: "source-observation-manifest.json",
  }));
  const finalizer = path.join(root, "skills/brand/scripts/finalize-source-observation.mjs");
  const finalized = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [finalizer, "--root", root, "--config", capturePlanPath], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  assert.equal(finalized.code, 0, finalized.stderr || finalized.stdout);
  const observation = JSON.parse(fs.readFileSync(path.join(outputRoot, "source-observation-manifest.json"), "utf8"));
  assert.equal(observation.coverage.readyForInterpreter, true);
  assert.equal(observation.pages[0].contentVerification.environmentFailureCodes.length, 0);
  assert.deepEqual(observation.pages[0].contentVerification.capturePersistenceProbe, capture.capturePersistenceProbe);
  const timeline = JSON.parse(fs.readFileSync(path.join(outputRoot, "timeline.json"), "utf8"));
  assert.equal(timeline.frames[0].timeMs, capture.frames[0].elapsedMs);
  assert.equal(timeline.frames[0].timingStatus, "measured-session-elapsed");
  // Legacy files without clocks cannot be mapped to invented fixed intervals.
  for (const frame of capture.frames) { delete frame.elapsedMs; delete frame.capturedAt; }
  fs.writeFileSync(path.join(outputRoot, "raw-capture.json"), JSON.stringify(capture));
  const legacyFinalize = spawnSync(process.execPath, [finalizer, "--root", root, "--config", capturePlanPath], { encoding: "utf8" });
  assert.equal(legacyFinalize.status, 0, legacyFinalize.stderr);
  const legacyTimeline = JSON.parse(fs.readFileSync(path.join(outputRoot, "timeline.json"), "utf8"));
  assert.equal(legacyTimeline.frames[0].timeMs, null);
  assert.equal(legacyTimeline.frames[0].timingStatus, "unavailable");
  console.log("run-rendered-evidence-collector lifecycle test passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(outputRoot, { recursive: true, force: true });
}
