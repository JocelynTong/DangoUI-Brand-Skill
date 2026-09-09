#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const input = option("--input");
const root = path.resolve(option("--root") || process.cwd());
if (!input) fail("Usage: validate-live-dom-evidence.mjs --input <evidence.json> [--root <repo>]");

const inputPath = path.resolve(root, input);
if (!fs.existsSync(inputPath)) fail(`Evidence file not found: ${inputPath}`);
const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const findings = [];

for (const [index, claim] of (data.claims || []).entries()) {
  const id = claim.id || `claim-${index + 1}`;
  if (claim.status === "unavailable") {
    check(id, "unavailableReason", meaningful(claim.unavailableReason));
    check(id, "invalidatedCaptures", Array.isArray(claim.invalidatedCaptures) && claim.invalidatedCaptures.length > 0 && claim.invalidatedCaptures.every((item) => meaningful(item.path) && meaningful(item.reason)));
    continue;
  }
  check(id, "capture", Boolean(claim.capture?.path && fs.existsSync(path.resolve(root, claim.capture.path))));
  check(id, "sourceRegion", positiveRegion(claim.sourceRegion));
  check(id, "visibleDom.selector", Boolean(claim.visibleDom?.selector));
  check(id, "visibleDom.visible", claim.visibleDom?.visible === true);
  check(id, "visibleDom.boundingBox", positiveBox(claim.visibleDom?.boundingBox));
  check(id, "computed", Boolean(claim.computed?.property && meaningful(claim.computed?.value)));
  check(id, "sourceRule", Boolean(claim.sourceRule?.selector && claim.sourceRule?.property && meaningful(claim.sourceRule?.value)));
  check(id, "conclusion", meaningful(claim.conclusion));
  if (claim.kind === "motion") {
    for (const state of ["default", "transition", "settled"]) {
      const sample = claim.states?.[state];
      check(id, `states.${state}.capture`, Boolean(sample?.capture && fs.existsSync(path.resolve(root, sample.capture))));
      check(id, `states.${state}.timestampMs`, Number.isFinite(sample?.timestampMs));
      check(id, `states.${state}.transform`, meaningful(sample?.transform));
    }
    check(id, "states.transition.isIntermediate", claim.states?.transition?.transform !== claim.states?.default?.transform && claim.states?.transition?.transform !== claim.states?.settled?.transform);
    check(id, "states.settled.differsFromDefault", claim.states?.settled?.transform !== claim.states?.default?.transform);
  }
  if (claim.kind === "carousel-cycle") {
    const slides = claim.cycle?.observedSlides || [];
    const uniqueSlides = new Set(slides);
    check(id, "cycle.sevenUniqueSlides", uniqueSlides.size === 7);
    check(id, "cycle.closed", claim.cycle?.cycleClosed === true && slides[0] === slides.at(-1));
    check(id, "cycle.foregroundBackgroundSynchronized", claim.cycle?.foregroundBackgroundSynchronized === true);
    check(id, "cycle.frames", Array.isArray(claim.cycle?.frames) && claim.cycle.frames.length >= 8 && claim.cycle.frames.every((frame) => frame.capture && fs.existsSync(path.resolve(root, frame.capture)) && Number(frame.opacity) >= 0.99));
    check(id, "cycle.settledCaptureDelay", Number(claim.cycle?.stabilityDelayMs) >= 500);
    check(id, "cycle.intervals", Array.isArray(claim.cycle?.transitionIntervalsMs) && claim.cycle.transitionIntervalsMs.length === 7 && claim.cycle.transitionIntervalsMs.every((ms) => ms >= 4000 && ms <= 6000));
    check(id, "playPause.paused", claim.playPause?.paused?.slideBefore === claim.playPause?.paused?.slideAfter6500ms && fs.existsSync(path.resolve(root, claim.playPause?.paused?.capture || "")));
    check(id, "playPause.resumed", claim.playPause?.resumed?.slideBefore !== claim.playPause?.resumed?.slideAfter5600ms && fs.existsSync(path.resolve(root, claim.playPause?.resumed?.capture || "")));
  }
  if (claim.kind === "font-resource") {
    check(id, "fontLoad.fontSetStatus", claim.fontLoad?.fontSetStatus === "loaded");
    check(id, "fontLoad.documentFontsCheck", claim.fontLoad?.documentFontsCheck === true);
    check(id, "fontLoad.sourceStylesheet", /^https:\/\//.test(claim.fontLoad?.sourceStylesheet || ""));
    check(id, "fontLoad.importUrl", /^https:\/\/fonts\.googleapis\.com\//.test(claim.fontLoad?.importUrl || ""));
    check(id, "fontLoad.fontFileDisposition", /^(https:\/\/|unavailable-)/.test(claim.fontLoad?.fontFileUrl || ""));
    check(id, "fontLoad.notComputedFamilyOnly", claim.computed?.property === "fontFamily" && Boolean(claim.fontLoad?.checkExpression));
  }
  if (claim.kind === "illustration-organism") {
    const assetUrls = (claim.layers || []).flatMap((layer) => [layer.asset, ...(layer.assets || [])]).filter(Boolean);
    const requiredNames = ["footer_illust_chara.webp", "footer_illust_txt.webp", "footer_illust_logo.webp", "footer_illust_card.webp", "footer_illust_card01.png", "footer_illust_card02.png", "footer_illust_card03.png"];
    check(id, "illustration.layers", Array.isArray(claim.layers) && claim.layers.length >= 6);
    check(id, "illustration.requiredAssets", requiredNames.every((name) => assetUrls.some((url) => url.endsWith(name))));
    check(id, "illustration.notAssetCountOnly", Boolean(claim.organismEvidence?.default?.capture && claim.organismEvidence?.transition?.capture && claim.organismEvidence?.settled?.capture && claim.organismEvidence?.late?.capture));
    check(id, "illustration.directlyVisibleStates", ["default", "transition", "settled", "late"].every((state) => claim.organismEvidence?.[state]?.directlyVisible === true && fs.existsSync(path.resolve(root, claim.organismEvidence?.[state]?.capture || ""))));
    check(id, "illustration.spatialComposition", meaningful(claim.organismEvidence?.spatialComposition));
    check(id, "illustration.layerTelemetry", Array.isArray(claim.organismEvidence?.layerSelectors) && claim.organismEvidence.layerSelectors.length >= 8 && meaningful(claim.organismEvidence?.telemetryPath) && fs.existsSync(path.resolve(root, claim.organismEvidence.telemetryPath)));
    check(id, "illustration.motionClassification", ["oneShotReveal", "ongoingLoop", "stateSwap"].every((field) => meaningful(claim.organismEvidence?.motionClassification?.[field])));
    check(id, "illustration.transitionCapture", fs.existsSync(path.resolve(root, claim.capture?.path || "")));
    check(id, "illustration.lateCapture", fs.existsSync(path.resolve(root, claim.capture?.lateFrame || "")));
    check(id, "illustration.motionState", meaningful(claim.motion?.settledFrame?.animationPlayState) && meaningful(claim.motion?.lateFrame?.animationName));
    check(id, "illustration.playPauseDisposition", typeof claim.motion?.playPauseControlObserved === "boolean");
    check(id, "illustration.reducedMotionDisposition", ["observed", "unavailable"].includes(claim.motion?.reducedMotion?.status) && meaningful(claim.motion?.reducedMotion?.reason));
  }
}

if (!(data.claims || []).length) findings.push({ id: "package", field: "claims", status: "fail" });
const ok = findings.every((finding) => finding.status === "pass");
process.stdout.write(`${JSON.stringify({ ok, input, claimCount: (data.claims || []).length, findings }, null, 2)}\n`);
process.exit(ok ? 0 : 1);

function check(id, field, pass) {
  findings.push({ id, field, status: pass ? "pass" : "fail" });
}
function positiveRegion(value) {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[2] > 0 && value[3] > 0;
}
function positiveBox(value) {
  return value && Number(value.width) > 0 && Number(value.height) > 0;
}
function meaningful(value) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
