import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const guard = path.resolve("skills/brand/scripts/brand-guard.mjs");

function fixture({ valid, withThirdParty = false, withDisposition = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-evidence-gate-"));
  const migration = path.join(root, "migrations", "fixture");
  const captureDir = path.join(root, "captures");
  fs.mkdirSync(migration, { recursive: true });
  fs.mkdirSync(captureDir, { recursive: true });
  fs.writeFileSync(path.join(captureDir, "before.png"), "before");
  fs.writeFileSync(path.join(captureDir, "after.png"), "after");
  fs.writeFileSync(path.join(migration, "brand-evidence.json"), JSON.stringify(valid ? {
    claims: [{
      id: "menu-open-color",
      status: "observed",
      salience: "high",
      kind: "interaction",
      capture: { path: "captures/after.png" },
      sourceRegion: [0.1, 0.1, 0.2, 0.1],
      visibleDom: { selector: ".menu.is-open", visible: true, boundingBox: { width: 120, height: 32 } },
      computed: { property: "color", value: "#fff507" },
    }],
    thirdPartySeedDispositions: withDisposition ? [{ seedRef: "dembrandt.colors.semantic.primary", status: "validated", evidenceRefs: ["menu-open-color"] }] : [],
  } : { palette: { primary: "#fff507" } }, null, 2));
  if (withThirdParty) fs.writeFileSync(path.join(migration, "third-party-evidence.dembrandt.json"), JSON.stringify({ provider: "dembrandt", candidateHints: { primaryColorSeed: { value: "#fff507" } } }, null, 2));
  fs.writeFileSync(path.join(migration, "action-evidence-v02.json"), JSON.stringify({
    entries: valid ? [{
      selector: ".menu.is-open",
      observedState: "menu-open",
      trigger: "click menu button",
      beforeCapture: "captures/before.png",
      afterCapture: "captures/after.png",
      computedProperty: "color",
      computedValue: "#fff507",
      sourceRule: ".menu.is-open { color: #fff507; }",
    }] : [{
      selector: ".menu.is-open",
      text: "active navigation",
      className: "menu is-open active",
      styles: { backgroundColor: "#fff507" },
    }],
  }, null, 2));
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [guard, "evidence-visibility-gate", "--root", root, "--brand", "fixture", "--strict"], { encoding: "utf8" });
}

function addSemanticIntent(root, semanticClaim) {
  fs.writeFileSync(path.join(root, "migrations", "fixture", "brand-intent.json"), JSON.stringify({
    schema: "brand-intent/vNext",
    semanticClaims: [semanticClaim],
  }, null, 2));
}

test("blocks code-first evidence and semantic state drift", () => {
  const root = fixture({ valid: false });
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.blocking.some((item) => item.id === "screenshot-first-claims"));
  assert.ok(report.blocking.some((item) => item.id === "action-semantic-drift-1"));
});

test("passes screenshot-first visible evidence with exact state and property", () => {
  const root = fixture({ valid: true });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
});

test('measured no-shadow is a CSS value, while missing and invalid none values still fail', () => {
  const root = fixture({ valid: true });
  const file = path.join(root, 'migrations/fixture/brand-evidence.json');
  const evidence = JSON.parse(fs.readFileSync(file));
  try {
    for (const [property, value, expected] of [['boxShadow', 'none', 0], ['box-shadow', 'none', 0], ['boxShadow', '', 2], ['boxShadow', null, 2], ['boxShadow', 'placeholder', 2], ['color', 'none', 2]]) {
      evidence.claims[0].computed = { property, value };
      fs.writeFileSync(file, JSON.stringify(evidence));
      assert.equal(run(root).status, expected, `${property}: ${value}`);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("blocks imported Dembrandt seeds without Evidence Agent disposition", () => {
  const root = fixture({ valid: true, withThirdParty: true });
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "third-party-seed-dispositions"));
});

test("passes imported Dembrandt seeds after observed-claim disposition", () => {
  const root = fixture({ valid: true, withThirdParty: true, withDisposition: true });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
});

test("blocks Pokémon-style orange promoted directly from a Dembrandt seed", () => {
  const root = fixture({ valid: true, withThirdParty: true, withDisposition: true });
  addSemanticIntent(root, {
    id: "database-orange-primary-action",
    kind: "color",
    status: "approved",
    role: "primary-action-fill",
    origin: "dembrandt-accent-seed",
    evidenceDisposition: "validated",
    evidenceRefs: [],
  });
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "semantic-rendered-chain-database-orange-primary-action"));
  assert.ok(report.blocking.some((item) => item.id === "semantic-candidate-source-database-orange-primary-action"));
});

test("passes ONE PIECE-style local color role bound to rendered state evidence", () => {
  const root = fixture({ valid: true, withThirdParty: true, withDisposition: true });
  const evidenceFile = path.join(root, "migrations", "fixture", "brand-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
  evidence.claims[0].sourcePageId = "home";
  evidence.claims[0].state = "menu-open";
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  addSemanticIntent(root, {
    id: "top-header-menu-open-indicator",
    kind: "color",
    status: "approved",
    role: "top-menu-open-label",
    origin: "rendered-observation",
    evidenceDisposition: "validated",
    evidenceRefs: ["menu-open-color"],
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) => item.id === "semantic-rendered-chain-top-header-menu-open-indicator" && item.status === "pass"));
});

test("blocks required continuous evidence when the source observation manifest is missing", () => {
  const root = fixture({ valid: true });
  const migration = path.join(root, "migrations", "fixture");
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({
    referencePages: [{ id: "home", core: true }],
    evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["home"] },
  }));
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "source-observation-manifest"));
});

function continuousFixture() {
  const root = fixture({ valid: true });
  const migration = path.join(root, "migrations", "fixture");
  const evidencePath = path.join(migration, "brand-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  evidence.claims[0].sourcePageId = "home";
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({
    referencePages: [{ id: "home", core: true }],
    evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["home"] },
  }));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  fs.writeFileSync(path.join(root, "captures", "full.png"), png);
  fs.writeFileSync(path.join(root, "captures", "frame-0.png"), png);
  fs.writeFileSync(path.join(root, "captures", "frame-1.png"), png);
  fs.writeFileSync(path.join(root, "captures", "frame-2.png"), png);
  fs.writeFileSync(path.join(root, "captures", "playback.gif"), "playback");
  const hashed = (name) => ({
    path: `captures/${name}`,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "captures", name))).digest("hex"),
  });
  fs.writeFileSync(path.join(root, "captures", "timeline.json"), JSON.stringify({
    meta: { viewport: { height: 100 }, scrollHeight: 300 },
    frames: [
      { scrollTop: 0, capture: hashed("frame-0.png") },
      { scrollTop: 100, capture: hashed("frame-1.png") },
      { scrollTop: 200, scrollHeight: 300, capture: hashed("frame-2.png") },
    ],
  }));
  fs.writeFileSync(path.join(migration, "source-observation-manifest.json"), JSON.stringify({
    viewport: { width: 200, height: 100 },
    coverage: { readyForInterpreter: true },
    pages: [{
      id: "home",
      status: "covered",
      fullPageCapture: hashed("full.png"),
      continuousCapture: hashed("playback.gif"),
      timeline: hashed("timeline.json"),
      contentVerification: {
        status: "passed",
        fontsReady: true,
        lazyContentSettled: true,
        unexpectedBlankFrames: 0,
        expectedSections: ["hero"],
        verifiedSections: ["hero"],
        textSamples: [{ text: "Example", selector: "h1", visible: true, boundingBox: { width: 80, height: 20 }, frameIndex: 0 }],
      },
    }],
  }));
  return { root, migration, hashed };
}

test("passes complete native evidence and blocks an explicitly auto-translated capture", () => {
  const { root, migration, hashed } = continuousFixture();
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);

  const manifestPath = path.join(migration, "source-observation-manifest.json");
  const viewportTimelinePath = path.join(root, "captures", "timeline.json");
  const viewportTimeline = JSON.parse(fs.readFileSync(viewportTimelinePath, "utf8"));
  viewportTimeline.meta = { viewport: { height: 100 }, scrollHeight: 100, navigationMode: "viewport-controller", viewportPageCount: 3 };
  viewportTimeline.frames = viewportTimeline.frames.map((frame, index) => ({ ...frame, scrollTop: 0, scrollHeight: 100, controllerState: [{ className: `swiper-slide page-${index} swiper-slide-active` }] }));
  fs.writeFileSync(viewportTimelinePath, JSON.stringify(viewportTimeline));
  const viewportManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  viewportManifest.pages[0].timeline = hashed("timeline.json");
  fs.writeFileSync(manifestPath, JSON.stringify(viewportManifest));
  const viewportResult = run(root);
  assert.equal(viewportResult.status, 0, viewportResult.stdout || viewportResult.stderr);

  const translated = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  translated.pages[0].contentVerification.captureEnvironment = {
    documentLang: "zh-CN",
    autoTranslated: true,
    scrollInput: "native-wheel",
    viewportControllerRequired: true,
    viewportControllerInitialized: true,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(translated));
  const rejected = run(root);
  assert.equal(rejected.status, 2);
  const rejectedReport = JSON.parse(rejected.stdout);
  const completeness = rejectedReport.blocking.find((item) => item.id === "observation-content-completeness-home");
  assert.ok(completeness);
  assert.deepEqual(completeness.environmentFailureCodes, ["SOURCE_AUTO_TRANSLATED"]);

  translated.pages[0].contentVerification.captureEnvironment.autoTranslated = false;
  translated.pages[0].contentVerification.lifecycle = { settleTimedOut: true };
  fs.writeFileSync(manifestPath, JSON.stringify(translated));
  const unsettled = run(root);
  assert.equal(unsettled.status, 2);
  const unsettledReport = JSON.parse(unsettled.stdout);
  const unsettledCompleteness = unsettledReport.blocking.find((item) => item.id === "observation-content-completeness-home");
  assert.ok(unsettledCompleteness.environmentFailureCodes.includes("OPENING_MEDIA_NOT_SETTLED"));
});

test('viewport authority binds real frames and rejects gaps, overview claims, wrong pages and tampering', () => {
  const { root, migration, hashed } = continuousFixture();
  // Synthetic raster headers exercise the metadata gate, not visual decoding.
  for (let i = 0; i < 3; i++) {
    const file = path.join(root, `captures/frame-${i}.png`);
    const bytes = fs.readFileSync(file); bytes.writeUInt32BE(200, 16); bytes.writeUInt32BE(100, 20);
    fs.writeFileSync(file, Buffer.concat([bytes, Buffer.from([i])]));
  }
  const initialTimelinePath = path.join(root, 'captures/timeline.json');
  const initialTimeline = JSON.parse(fs.readFileSync(initialTimelinePath));
  initialTimeline.frames.forEach((frame, i) => { frame.capture = hashed(`frame-${i}.png`); });
  fs.writeFileSync(initialTimelinePath, JSON.stringify(initialTimeline));
  const initialManifestPath = path.join(migration, 'source-observation-manifest.json');
  const initialManifest = JSON.parse(fs.readFileSync(initialManifestPath));
  initialManifest.pages[0].timeline = hashed('timeline.json');
  fs.writeFileSync(initialManifestPath, JSON.stringify(initialManifest));
  const goalPath = path.join(migration, 'goal-contract.json');
  const goal = JSON.parse(fs.readFileSync(goalPath));
  goal.evidencePolicy.visualAuthority = 'viewport-sequence/v1';
  goal.evidencePolicy.fullPageRole = 'overview-only';
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  const evidencePath = path.join(migration, 'brand-evidence.json');
  const evidence = JSON.parse(fs.readFileSync(evidencePath));
  evidence.claims[0].capture = hashed('frame-0.png');
  const saveEvidence = () => fs.writeFileSync(evidencePath, JSON.stringify(evidence));
  saveEvidence();
  let result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const expectBlock = id => {
    result = run(root);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(JSON.parse(result.stdout).blocking.some(item => item.id === id), result.stdout);
  };
  evidence.claims[0].capture = hashed('full.png'); saveEvidence();
  expectBlock('claim-viewport-authority-menu-open-color');
  evidence.claims[0].capture = hashed('frame-0.png');
  evidence.claims[0].sourcePageId = 'other'; saveEvidence();
  expectBlock('claim-viewport-authority-menu-open-color');
  evidence.claims[0].sourcePageId = 'home'; saveEvidence();
  const timelinePath = path.join(root, 'captures/timeline.json');
  const timeline = JSON.parse(fs.readFileSync(timelinePath));
  const manifestPath = path.join(migration, 'source-observation-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const saveTimeline = () => {
    fs.writeFileSync(timelinePath, JSON.stringify(timeline));
    manifest.pages[0].timeline = hashed('timeline.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  };
  const originalFrame = timeline.frames[1].capture;
  timeline.frames[1].capture = timeline.frames[0].capture; saveTimeline();
  expectBlock('observation-viewport-rasters-home');
  timeline.frames[1].capture = hashed('full.png'); saveTimeline();
  expectBlock('observation-viewport-rasters-home');
  timeline.frames[1].capture = originalFrame; saveTimeline();
  manifest.interactions = [{ id: 'unverified', sourcePageId: 'home', status: 'covered', timeline: hashed('timeline.json') }];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  expectBlock('observation-interaction-authority-unverified');
  const interactionTimeline = { frames: [{ label: 'default-triggered-settled-restored', capture: hashed('frame-0.png') }] };
  fs.writeFileSync(path.join(root, 'captures/interaction.json'), JSON.stringify(interactionTimeline));
  manifest.interactions[0].timeline = hashed('interaction.json');
  manifest.interactions[0].continuousCapture = hashed('playback.gif');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  expectBlock('observation-interaction-authority-unverified');
  interactionTimeline.frames = ['default', 'triggered', 'settled', 'restored'].map(state => ({ state, capture: hashed('frame-0.png') }));
  fs.writeFileSync(path.join(root, 'captures/interaction.json'), JSON.stringify(interactionTimeline));
  manifest.interactions[0].timeline = hashed('interaction.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.equal(run(root).status, 0, 'Distinct indexed states are accepted; their actual visual correctness remains independent review.');
  // New scoped goals distinguish state proof from motion; legacy remains strict.
  goal.evidencePolicy.interactionEvidence = { schema: 'interaction-evidence/v1', scopeReason: 'Catalog state switching; no motion transfer.', required: [{ id: 'unverified', proof: 'states', reason: 'Preserve toggle and restoration.' }] };
  goal.evidencePolicy.requiredInteractionIds = ['unverified'];
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  delete manifest.interactions[0].continuousCapture;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.equal(run(root).status, 0, 'Scoped state proof does not require a recording.');
  interactionTimeline.frames.pop();
  fs.writeFileSync(path.join(root, 'captures/interaction.json'), JSON.stringify(interactionTimeline));
  manifest.interactions[0].timeline = hashed('interaction.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  expectBlock('observation-interaction-states-unverified');
  interactionTimeline.frames.push({ state: 'restored', capture: hashed('frame-0.png') });
  fs.writeFileSync(path.join(root, 'captures/interaction.json'), JSON.stringify(interactionTimeline));
  manifest.interactions[0].timeline = hashed('interaction.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  goal.evidencePolicy.interactionEvidence.required[0].proof = 'motion';
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  expectBlock('observation-interaction-media-unverified');
  manifest.interactions[0].continuousCapture = hashed('playback.gif');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.equal(run(root).status, 0, 'Motion proof accepts ordered state fields plus recording.');
  delete manifest.interactions[0].continuousCapture;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  goal.evidencePolicy.interactionEvidence.required[0].proof = 'states';
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  const evidenceFile = path.join(migration, 'brand-evidence.json');
  const evidenceBefore = fs.readFileSync(evidenceFile);
  const motionEvidence = JSON.parse(evidenceBefore);
  motionEvidence.claims[0].kind = 'motion';
  motionEvidence.claims[0].interactionId = 'unverified';
  fs.writeFileSync(evidenceFile, JSON.stringify(motionEvidence));
  expectBlock(`claim-motion-authority-${motionEvidence.claims[0].id}`);
  fs.writeFileSync(evidenceFile, evidenceBefore);
  const intentFile = path.join(migration, 'brand-intent.json');
  const intentBefore = fs.existsSync(intentFile) ? fs.readFileSync(intentFile) : null;
  const motionIntent = intentBefore ? JSON.parse(intentBefore) : {};
  motionIntent.semanticClaims = [{ id: 'motion-upgrade', kind: 'Motion', disposition: 'validated', evidenceRefs: [motionEvidence.claims[0].id] }];
  fs.writeFileSync(intentFile, JSON.stringify(motionIntent));
  expectBlock('semantic-motion-authority-motion-upgrade');
  if (intentBefore) fs.writeFileSync(intentFile, intentBefore);
  else fs.unlinkSync(intentFile);
  const supplementUrl = 'https://example.com/source';
  goal.sourceUrl = supplementUrl;
  goal.referencePages[0].url = supplementUrl;
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  const measurement = { url: supplementUrl, viewport: {width:200,height:100}, capturedAt:'2026-10-08T00:00:00Z' };
  fs.writeFileSync(path.join(root,'captures/measured.json'),JSON.stringify(measurement));
  const supplement = {schema:'source-local-observation/v1',sourcePageId:'home',url:supplementUrl,meta:{viewport:measurement.viewport},frames:[{capture:hashed('frame-0.png'),observation:hashed('measured.json')}]};
  const saveSupplement = () => { fs.writeFileSync(path.join(root,'captures/supplement.json'),JSON.stringify(supplement)); manifest.pages[0].supplementalTimelines=[hashed('supplement.json')]; fs.writeFileSync(manifestPath,JSON.stringify(manifest)); };
  saveSupplement();
  assert.equal(run(root).status,0,'Local observations can supplement but not replace the page sweep.');
  supplement.sourcePageId='wrong'; saveSupplement(); expectBlock('observation-supplement-home-0');
  supplement.sourcePageId='home'; supplement.frames[0].observation.sha256='0'.repeat(64); saveSupplement(); expectBlock('observation-supplement-home-0');
  delete manifest.pages[0].supplementalTimelines;
  delete goal.evidencePolicy.interactionEvidence;
  delete goal.evidencePolicy.requiredInteractionIds;
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  expectBlock('observation-interaction-authority-unverified');
  delete manifest.interactions; saveTimeline();
  const originalTimeline = structuredClone(timeline);
  timeline.meta.navigationMode = 'viewport-controller'; timeline.meta.viewportPageCount = 3;
  timeline.frames.forEach((frame, i) => { frame.controllerState = [{ active: i }]; frame.capture = hashed('frame-0.png'); });
  saveTimeline(); expectBlock('observation-viewport-rasters-home');
  Object.assign(timeline, originalTimeline); saveTimeline();
  timeline.meta.scrollHeight = 500;
  timeline.frames[1].scrollTop = 200;
  timeline.frames[2].scrollTop = 400;
  timeline.frames[2].scrollHeight = 500;
  fs.writeFileSync(timelinePath, JSON.stringify(timeline));
  manifest.pages[0].timeline = hashed('timeline.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  expectBlock('observation-viewport-authority-home');
  // Legacy behavior stays unchanged, including old sealed contracts.
  delete goal.evidencePolicy.visualAuthority; delete goal.evidencePolicy.fullPageRole;
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  assert.equal(run(root).status, 0);
  goal.evidencePolicy.visualAuthority = 'viewport-sequence/v1';
  fs.writeFileSync(goalPath, JSON.stringify(goal));
  fs.appendFileSync(path.join(root, 'captures/frame-0.png'), 'tampered');
  expectBlock('claim-viewport-authority-menu-open-color');
  expectBlock('observation-lossless-frames-home');
});

test("blocks height-complete captures when rendered content completeness is unproved", () => {
  const root = fixture({ valid: true });
  const migration = path.join(root, "migrations", "fixture");
  const evidence = JSON.parse(fs.readFileSync(path.join(migration, "brand-evidence.json"), "utf8"));
  evidence.claims[0].sourcePageId = "home";
  fs.writeFileSync(path.join(migration, "brand-evidence.json"), JSON.stringify(evidence));
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({
    referencePages: [{ id: "home", core: true }],
    evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["home"] },
  }));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  for (const name of ["full.png", "frame-0.png", "frame-1.png", "frame-2.png"]) fs.writeFileSync(path.join(root, "captures", name), png);
  fs.writeFileSync(path.join(root, "captures", "playback.gif"), "playback");
  const hashed = (name) => ({ path: `captures/${name}`, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "captures", name))).digest("hex") });
  fs.writeFileSync(path.join(root, "captures", "timeline.json"), JSON.stringify({
    meta: { viewport: { height: 100 }, scrollHeight: 300 },
    frames: [
      { scrollTop: 0, capture: hashed("frame-0.png") },
      { scrollTop: 100, capture: hashed("frame-1.png") },
      { scrollTop: 200, scrollHeight: 300, capture: hashed("frame-2.png") },
    ],
  }));
  fs.writeFileSync(path.join(migration, "source-observation-manifest.json"), JSON.stringify({
    viewport: { width: 200, height: 100 }, coverage: { readyForInterpreter: true },
    pages: [{ id: "home", status: "covered", fullPageCapture: hashed("full.png"), continuousCapture: hashed("playback.gif"), timeline: hashed("timeline.json") }],
  }));
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "observation-content-completeness-home"));
});

test("blocks Git LFS pointer text masquerading as a full-page image", () => {
  const root = fixture({ valid: true });
  const migration = path.join(root, "migrations", "fixture");
  const evidence = JSON.parse(fs.readFileSync(path.join(migration, "brand-evidence.json"), "utf8"));
  evidence.claims[0].sourcePageId = "home";
  fs.writeFileSync(path.join(migration, "brand-evidence.json"), JSON.stringify(evidence));
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ referencePages: [{ id: "home", core: true }], evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["home"] } }));
  const pointer = "version https://git-lfs.github.com/spec/v1\noid sha256:deadbeef\nsize 12345\n";
  fs.writeFileSync(path.join(root, "captures", "full.png"), pointer);
  fs.writeFileSync(path.join(root, "captures", "playback.gif"), "playback");
  fs.writeFileSync(path.join(root, "captures", "timeline.json"), JSON.stringify({ meta: { viewport: { height: 100 }, scrollHeight: 300 }, frames: [{ scrollTop: 0 }, { scrollTop: 100 }, { scrollTop: 200, scrollHeight: 300 }] }));
  const hashed = (name) => ({ path: `captures/${name}`, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "captures", name))).digest("hex") });
  fs.writeFileSync(path.join(migration, "source-observation-manifest.json"), JSON.stringify({ viewport: { height: 100 }, coverage: { readyForInterpreter: true }, pages: [{ id: "home", status: "covered", fullPageCapture: hashed("full.png"), continuousCapture: hashed("playback.gif"), timeline: hashed("timeline.json") }] }));
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "observation-full-page-raster-home"));
});
