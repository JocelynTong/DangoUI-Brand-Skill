import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const entry = path.resolve("skills/brand/scripts/run-brand-workflow.mjs");
const result = spawnSync(process.execPath, [
  entry,
  "run",
  "--mode",
  "apply-host",
  "--brand",
  "__missing_wild_design_fixture__",
  "--host-target",
  "/tmp/host.vue",
  "--style-pack",
  path.resolve("package.json"),
  "--source-url",
  "https://example.com/brand/demo",
], { encoding: "utf8" });

assert.notEqual(result.status, 0);
const payload = JSON.parse(result.stdout);
assert.equal(payload.blockingCode, "APPLY_HOST_PREFLIGHT_BLOCKED");
assert.equal(payload.step, "apply-host-preflight");
assert.ok(payload.preflight.blocking.includes("HOST_TARGET_MISSING"));
assert.ok(payload.preflight.blocking.includes("FROZEN_PACK_FILE_MISSING:brand-mod.json"));
assert.equal(payload.preflight.frozenPack.reuseDecision, "blocked");
assert.doesNotMatch(result.stdout + result.stderr, /Usage: validate-wild-design-decision/);
fs.rmSync(path.resolve("migrations/__missing_wild_design_fixture__"), { recursive: true, force: true });

console.log("run-brand-workflow apply-host preflight-order test passed");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brand-apply-host-routing-"));
try {
  const skillTarget = path.resolve("skills/brand");
  fs.mkdirSync(path.join(fixtureRoot, "skills"), { recursive: true });
  fs.symlinkSync(skillTarget, path.join(fixtureRoot, "skills/brand"), "dir");

  const brand = "fresh-host-fixture";
  const migration = path.join(fixtureRoot, "migrations", brand);
  const host = path.join(fixtureRoot, "host");
  fs.mkdirSync(migration, { recursive: true });
  fs.mkdirSync(path.join(host, "src", "pages", "home"), { recursive: true });
  writeJson(path.join(migration, "brand-mod.json"), { schema: "fixture/v1", tokens: ["token:surface", "token:action", "token:text"], assets: ["asset:a", "asset:b"], layoutRules: ["pattern:a", "pattern:b"] });
  writeJson(path.join(migration, "brand-evidence.json"), { schema: "fixture/v1", evidence: ["evidence:a", "evidence:b", "token:surface", "token:action", "token:text", "asset:a", "asset:b", "pattern:a", "pattern:b"] });
  writeJson(path.join(migration, "brand-intent.json"), { schema: "fixture/v1", intent: [] });
  writeJson(path.join(host, "package.json"), { name: "fresh-host", dependencies: {} });
  fs.writeFileSync(path.join(host, "src", "app.config.ts"), "export default { pages: ['pages/home/index'] };\n");
  fs.writeFileSync(path.join(host, "src", "pages", "home", "index.vue"), "<template><view>untouched</view></template>\n");

  const beforePreparing = treeHash(host);
  const preparing = runFixture([
    "run", "--root", fixtureRoot, "--mode", "design-host", "--profile", "fast",
    "--brand", brand, "--host-target", host, "--mod-file", path.join(migration, "brand-mod.json"),
  ]);
  assert.equal(preparing.status, 0, preparing.stderr);
  const preparingPayload = JSON.parse(preparing.stdout);
  assert.equal(preparingPayload.status, "preparing-style-options");
  assert.equal(preparingPayload.pauseReason, "style-options-required");
  assert.equal(preparingPayload.learnBrandDispatched, false);
  assert.equal(preparingPayload.hostFilesModified, false);
  assert.equal(treeHash(host), beforePreparing);

  const options = path.join(migration, "design-direction-options.json");
  const scope = path.join(migration, "business-scope.json");
  writeJson(scope, { schema: "business-scope/v1", target: "home" });
  const evidenceHash = fileHash(path.join(migration, "brand-evidence.json"));
  const scopeHash = fileHash(scope);
  const previewA = path.join(migration, "option-a.svg");
  const previewB = path.join(migration, "option-b.svg");
  fs.writeFileSync(previewA, '<svg><g id="a"/></svg>');
  fs.writeFileSync(previewB, '<svg><g id="b"/></svg>');
  const hostPage = path.join(host, "src", "pages", "home", "index.vue");
  const visualOption = (id, recommended, preview) => ({
    id,
    name: id,
    recommended,
    sameBusinessScopeHash: scopeHash,
    brandEvidenceRefs: [`evidence:${id}`],
    previewEvidence: [{ path: path.basename(preview), sha256: fileHash(preview), kind: "rendered-host-grounded-preview", previewOrigin: "host-baseline-derived", presentationMode: "host-surface-only", proposalChromeAbsent: true, hostSurfaceRegions: ["navigation", "primary-task", "business-switch", "business-content"], hostRoute: "pages/home/index", viewport: "375x812", sourceVisualSignals: [{ evidenceRef: `evidence:${id}`, patternRef: `pattern:${id}`, visibleApplication: "dominant hero scene" }, { evidenceRef: `evidence:${id}`, patternRef: `material:${id}`, visibleApplication: "brand material field" }], designSystemMappings: { tokens: ["color.surface.brand"], components: ["Image", "Card"] } }],
    designSystemConsumption: { mode: "host-grounded-preview", mappingPolicy: { visualTarget: "preserve-selected-option", componentRole: "behavior-and-api", styleOnlyFallback: true, defaultAppearanceAllowed: false }, hostBinding: { previewOrigin: "host-baseline-derived", targetRoute: "pages/home/index", businessDataSource: "captured-host-state", baselineArtifacts: [{ path: path.relative(migration, hostPage), sha256: fileHash(hostPage) }] }, generationIsolation: { hostFilesModified: false, hostSourceBeforeSha256: fileHash(hostPage), hostSourceAfterSha256: fileHash(hostPage) }, tokens: { status: "consumed", refs: [`token:${id}`] }, components: { status: "consumed", refs: ["Image"] }, assets: { status: "consumed", refs: [`asset:${id}`] }, composition: { status: "consumed", refs: [`composition:${id}`] } },
    differences: { informationDensity: id, visualAssets: id, pageStructure: id, motionIntensity: id },
    styleDirectionContract: { tokens: id, typography: id, components: id, materials: id, motion: id },
    visualChoiceContract: { dominantColorRole: `${id}-color`, typographyCharacter: `${id}-type`, assetStrategy: `${id}-asset`, materialLanguage: `${id}-material`, motionCharacter: `${id}-motion`, imagePolicy: `${id}-image`, forbiddenFallbacks: ["keep dominant visual"] },
    brandSystemClosure: { tokenApplications: [{ tokenRef: "token:surface", evidenceRef: `evidence:${id}`, renderedSelector: `#${id}`, cssProperty: "background-color", renderedValue: "#102040" }, { tokenRef: "token:action", evidenceRef: `evidence:${id}`, renderedSelector: `#${id} button`, cssProperty: "background-color", renderedValue: "#ffcc00" }, { tokenRef: "token:text", evidenceRef: `evidence:${id}`, renderedSelector: `#${id} h1`, cssProperty: "color", renderedValue: "#ffffff" }], assetApplications: [{ assetRef: `asset:${id}`, evidenceRef: `evidence:${id}`, sourceSha256: "a".repeat(64), sourceKind: "official-independent-asset", renderedSelector: `#${id} .hero`, role: "campaign-scene", firstViewportAreaRatio: 0.4 }], compositionApplications: [{ patternRef: `pattern:${id}`, evidenceRef: `evidence:${id}`, renderedRegion: `#${id} .hero`, assetRefs: [`asset:${id}`] }], coPresence: { previewEvidencePath: path.basename(preview), tokenRefs: ["token:surface", "token:action", "token:text"], assetRefs: [`asset:${id}`], patternRefs: [`pattern:${id}`] } },
    firstViewportVisualProof: { visualNarrative: `${id}-narrative`, visibleDimensions: ["asset", "composition", "material"], atmosphereLayers: ["environment", "lighting", "depth"], compositionSignature: id === "a" ? { visualCenter: "full-scene", primaryActionPlacement: "bottom-overlay", contentEntry: "bottom-sheet", resultPresentation: "vertical-list" } : { visualCenter: "asymmetric-stage", primaryActionPlacement: "side-panel", contentEntry: "horizontal-rail", resultPresentation: "mosaic-grid" }, dominantMedia: [{ assetRef: `asset:${id}`, evidenceRef: `evidence:${id}`, renderedSelector: `#${id}`, role: "hero-scene", sourceKind: "official-independent-asset", firstViewportAreaRatio: 0.4 }] },
    responsiveProof: { targetFormFactor: "mobile", pageType: "browse-list", viewportWidth: 375, persistentSideRail: false, primaryContentWidthRatio: 0.9, touchTargetMinPx: 44, horizontalOverflow: false, heroHeightRatio: 0.5, firstBusinessContentTopRatio: 0.68, contentContainerFlow: "document-flow", hostFirstImpression: { taskPriority: "efficiency-first", informationDensity: "high", contentFlow: "continuous-flow", returnFrequency: "frequent", firstActionUrgency: "immediate", existingMediaSlots: [], evidence: "Host page source and route show a continuous home flow." }, heroDecision: { mode: "compact", rationale: "Keep the primary host task visible in the first viewport." } },
    directionContract: { businessCapabilities: ["home"], layout: [`${id}-hero`, `${id}-content`] },
  });
  writeJson(options, { schema: "wild-design-options/v2", workflow: "design-host", sourceBrand: brand, frozenBrandEvidenceSha256: evidenceHash, frozenBrandModSha256: fileHash(path.join(migration, "brand-mod.json")), sharedLayoutContract: ["home"], options: [visualOption("a", true, previewA), visualOption("b", false, previewB)] });
  const beforeChoice = treeHash(host);
  const awaitingChoice = runFixture([
    "run", "--root", fixtureRoot, "--mode", "design-host", "--profile", "fast",
    "--brand", brand, "--host-target", host, "--mod-file", path.join(migration, "brand-mod.json"),
    "--wild-design-options", options, "--wild-design-business-scope", scope,
  ]);
  assert.equal(awaitingChoice.status, 0, awaitingChoice.stderr);
  const choicePayload = JSON.parse(awaitingChoice.stdout);
  assert.equal(choicePayload.status, "awaiting-user");
  assert.equal(choicePayload.pauseReason, "style-choice");
  assert.equal(choicePayload.learnBrandDispatched, false);
  assert.equal(choicePayload.hostFilesModified, false);
  assert.deepEqual(choicePayload.allowedNextActions, ["select", "none-fit"]);
  assert.equal(treeHash(host), beforeChoice);

  console.log("run-brand-workflow design-host pre-implementation state tests passed");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function runFixture(args) {
  return spawnSync(process.execPath, [entry, ...args], { encoding: "utf8" });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function treeHash(root) {
  const hash = crypto.createHash("sha256");
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, item.name);
      const relative = path.relative(root, file);
      hash.update(relative);
      if (item.isDirectory()) visit(file);
      else hash.update(fs.readFileSync(file));
    }
  };
  visit(root);
  return hash.digest("hex");
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
