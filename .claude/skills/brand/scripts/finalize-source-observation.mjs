#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const root = path.resolve(opt("--root", process.cwd()));
const configFile = path.resolve(root, opt("--config"));
if (!opt("--config") || !fs.existsSync(configFile)) {
  console.error("finalize-source-observation requires --config <capture-plan.json>.");
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
const runRoot = path.resolve(root, config.runRoot || path.dirname(path.relative(root, configFile)));
const relative = (value) => path.relative(root, value);
const sha256 = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex");
const ref = (value) => ({ path: relative(value), sha256: sha256(value) });
const findFile = (dir, explicit, candidates) => {
  const values = [explicit, ...candidates].filter(Boolean);
  const found = values.map((value) => path.resolve(dir, value)).find((value) => fs.existsSync(value));
  if (!found) throw new Error(`Missing required capture in ${relative(dir)}: ${values.join(", ")}`);
  return found;
};
const expectedLanguageFromUrl = (url) => {
  const match = new URL(url).pathname.match(/\/([a-z]{2})-[a-z]{2}(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || "";
};

const pages = [];
for (const pageConfig of config.pages || []) {
  const pageId = pageConfig.id;
  const captureDir = path.resolve(runRoot, pageConfig.captureDir);
  const rawFile = findFile(captureDir, pageConfig.rawCapture, ["raw-capture.json"]);
  const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
  if (!Array.isArray(raw.frames) || raw.frames.length === 0) throw new Error(`${pageId} has no frames.`);

  const frames = raw.frames.map((frame, index) => {
    const captureFile = path.isAbsolute(frame.file) ? frame.file : path.resolve(captureDir, frame.file);
    if (!fs.existsSync(captureFile)) throw new Error(`${pageId} frame ${index} is missing: ${captureFile}`);
    return {
      index,
      timeMs: Number.isFinite(frame.elapsedMs) ? frame.elapsedMs : null,
      capturedAt: frame.capturedAt || null,
      timingStatus: Number.isFinite(frame.elapsedMs) ? "measured-session-elapsed" : "unavailable",
      label: index === 0 ? "stable-initial" : index === raw.frames.length - 1 ? "settled-end" : "settled-scroll",
      scrollTop: frame.scrollTop,
      scrollHeight: frame.scrollHeight,
      controllerState: frame.environment?.activeControllerSignals || [],
      visualMediaCount: Number(frame.visualMediaCount || 0),
      capture: ref(captureFile),
    };
  });
  const timeline = {
    schema: "brand-source-timeline/v3",
    pageId,
    meta: {
      url: pageConfig.url,
      viewport: { width: raw.frames[0].clientWidth, height: raw.frames[0].clientHeight },
      scrollHeight: raw.frames.at(-1).scrollHeight,
      captureMode: raw.captureMode || "viewport-settled",
      navigationMode: raw.captureEnvironment?.viewportControllerRequired === true ? "viewport-controller" : "document-scroll",
      viewportPageCount: Number(raw.captureEnvironment?.viewportPageCount || 0),
      lifecycle: raw.lifecycle || null,
      timing: raw.timing || { timebase: "unavailable", videoOffsetVerified: false },
    },
    frames,
  };
  const timelineFile = path.join(captureDir, "timeline.json");
  fs.writeFileSync(timelineFile, `${JSON.stringify(timeline, null, 2)}\n`);

  const expected = pageConfig.expectedSections || {};
  const expectedSections = Object.keys(expected);
  const visibleText = raw.frames.flatMap((frame) => frame.visibleTextSamples || []);
  const corpus = visibleText.map((sample) => sample.text).join("\n").toUpperCase();
  const verifiedSections = expectedSections.filter((section) => (expected[section] || []).some((needle) => corpus.includes(String(needle).toUpperCase())));
  const blankFrames = raw.frames.filter((frame) => (frame.visibleTextSamples || []).length === 0 && Number(frame.visibleImages) === 0 && Number(frame.visualMediaCount) === 0).map((frame) => frame.index);
  const fontsReady = raw.frames.every((frame) => frame.fontsReady === true);
  const imagesReady = raw.frames.every((frame) => frame.visibleLoadedImages == null
    ? Number(frame.loadedImages) === Number(frame.totalImages)
    : Number(frame.visibleLoadedImages) === Number(frame.visibleImages));
  const textSamples = raw.frames
    .flatMap((frame) => (frame.visibleTextSamples || []).map((sample) => ({ ...sample, frameIndex: frame.index })))
    .filter((sample) => sample.visible === true && sample.text && sample.selector && sample.boundingBox?.width > 0 && sample.boundingBox?.height > 0)
    .slice(0, Number(pageConfig.textSampleLimit || config.textSampleLimit || 24));

  const captureEnvironment = raw.captureEnvironment || raw.frames[0]?.environment || null;
  const expectedLanguage = String(pageConfig.expectedLanguage || expectedLanguageFromUrl(pageConfig.url)).toLowerCase();
  const allowedNativeInputs = new Set(["native-wheel", "native-touch", "native-keyboard"]);
  const environmentFailureCodes = [
    !captureEnvironment ? "CAPTURE_ENVIRONMENT_MISSING" : null,
    captureEnvironment?.autoTranslated === true ? "SOURCE_AUTO_TRANSLATED" : null,
    expectedLanguage && !String(captureEnvironment?.documentLang || "").toLowerCase().startsWith(expectedLanguage) ? "SOURCE_LANGUAGE_MISMATCH" : null,
    captureEnvironment?.viewportControllerRequired === true && captureEnvironment.viewportControllerInitialized !== true ? "VIEWPORT_CONTROLLER_NOT_INITIALIZED" : null,
    captureEnvironment?.viewportControllerRequired === true && !allowedNativeInputs.has(captureEnvironment.scrollInput) ? "VIEWPORT_TRIGGER_INPUT_NOT_NATIVE" : null,
    raw.lifecycle?.settleTimedOut === true ? "OPENING_MEDIA_NOT_SETTLED" : null,
  ].filter(Boolean);
  const contentPassed = fontsReady
    && imagesReady
    && blankFrames.length === 0
    && expectedSections.length > 0
    && verifiedSections.length === expectedSections.length
    && textSamples.length > 0
    && environmentFailureCodes.length === 0;

  const fullPageFile = findFile(captureDir, pageConfig.fullPageCapture, ["browser-full-page.png", "browser-full-page.jpg", "full-page.png", "full-page.jpg", "full-page.jpeg"]);
  const continuousFile = findFile(captureDir, pageConfig.continuousCapture, ["continuous-scroll.mp4", "continuous-scroll.webm", "continuous-scroll.gif"]);
  const componentInventoryFile = raw.componentInventory?.path
    ? path.resolve(raw.componentInventory.path)
    : path.join(captureDir, "component-inventory.json");
  pages.push({
    id: pageId,
    url: pageConfig.url,
    status: "covered",
    fullPageCapture: ref(fullPageFile),
    continuousCapture: ref(continuousFile),
    timeline: ref(timelineFile),
    componentInventory: fs.existsSync(componentInventoryFile) ? {
      ...ref(componentInventoryFile),
      familyCounts: raw.componentInventory?.familyCounts || {},
      itemCount: Number(raw.componentInventory?.itemCount || 0),
    } : null,
    contentVerification: {
      status: contentPassed ? "passed" : "failed",
      method: raw.captureMode || "viewport-settled",
      fontsReady,
      lazyContentSettled: imagesReady && blankFrames.length === 0,
      unexpectedBlankFrames: blankFrames.length,
      unexpectedBlankFrameIndexes: blankFrames,
      expectedSections,
      verifiedSections,
      textSamples,
      captureEnvironment,
      capturePersistenceProbe: raw.capturePersistenceProbe || null,
      lifecycle: raw.lifecycle || null,
      environmentFailureCodes,
    },
  });
}

const readyForInterpreter = pages.length > 0 && pages.every((page) => page.contentVerification.status === "passed");
const manifest = {
  schema: "brand-source-observation/v3",
  brand: config.brand,
  goalId: config.goalId,
  capturedAt: new Date().toISOString(),
  capturePlan: ref(configFile),
  pages,
  coverage: {
    readyForInterpreter,
    requiredPageIds: pages.map((page) => page.id),
    covered: pages.filter((page) => page.contentVerification.status === "passed").length,
  },
};
const outputFile = path.resolve(runRoot, config.output || "source-observation-manifest.json");
fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  manifest: relative(outputFile),
  readyForInterpreter,
  pages: pages.map((page) => ({
    id: page.id,
    status: page.contentVerification.status,
    blankFrames: page.contentVerification.unexpectedBlankFrameIndexes,
    missingSections: page.contentVerification.expectedSections.filter((section) => !page.contentVerification.verifiedSections.includes(section)),
    environmentFailureCodes: page.contentVerification.environmentFailureCodes,
  })),
}, null, 2));
process.exitCode = readyForInterpreter ? 0 : 2;
