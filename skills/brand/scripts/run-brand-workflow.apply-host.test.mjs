import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const entry = path.resolve("skills/brand/scripts/run-brand-workflow.mjs");
const missingRequestKind = spawnSync(process.execPath, [entry, "run", "--mode", "learn-brand", "--brand", "wrong", "--source-url", "https://example.com/wrong"], { encoding: "utf8" });
assert.notEqual(missingRequestKind.status, 0);
assert.equal(JSON.parse(missingRequestKind.stdout).blockingCode, "REQUEST_KIND_REQUIRED");

const mismatchedRequestKind = spawnSync(process.execPath, [entry, "run", "--request-kind", "host-concepts", "--mode", "learn-brand", "--brand", "wrong", "--source-url", "https://example.com/wrong"], { encoding: "utf8" });
assert.notEqual(mismatchedRequestKind.status, 0);
assert.equal(JSON.parse(mismatchedRequestKind.stdout).blockingCode, "REQUEST_INTENT_MODE_MISMATCH");

const missingArtifactRoot = spawnSync(process.execPath, [entry, "run", "--request-kind", "host-concepts", "--mode", "design-host", "--brand", "wrong", "--host-target", "/tmp/host", "--mod-file", path.resolve("package.json")], { encoding: "utf8" });
assert.notEqual(missingArtifactRoot.status, 0);
assert.equal(JSON.parse(missingArtifactRoot.stdout).blockingCode, "ARTIFACT_ROOT_REQUIRED");

const result = spawnSync(process.execPath, [
  entry,
  "run",
  "--request-kind",
  "host-implementation",
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
  const artifactRoot = path.join(fixtureRoot, "build");
  const skillTarget = path.resolve("skills/brand");
  fs.mkdirSync(path.join(artifactRoot, "skills"), { recursive: true });
  fs.symlinkSync(skillTarget, path.join(artifactRoot, "skills/brand"), "dir");

  const brand = "fresh-host-fixture";
  const migration = path.join(artifactRoot, "migrations", brand);
  const host = path.join(fixtureRoot, "host");
  writeJson(path.join(fixtureRoot, "run.json"), { schema: "brand-artifact-run/v1", id: "fixture", host, status: "active" });
  fs.mkdirSync(migration, { recursive: true });
  fs.mkdirSync(path.join(host, "src", "pages", "home"), { recursive: true });
  writeJson(path.join(migration, "brand-mod.json"), { schema: "fixture/v1", tokens: ["token:surface", "token:action", "token:text"], assets: ["asset:a", "asset:b", "asset:c"], layoutRules: ["pattern:a", "pattern:b", "pattern:c"] });
  writeJson(path.join(migration, "brand-evidence.json"), { schema: "fixture/v1", evidence: ["evidence:a", "evidence:b", "evidence:c", "token:surface", "token:action", "token:text", "asset:a", "asset:b", "asset:c", "pattern:a", "pattern:b", "pattern:c"] });
  writeJson(path.join(migration, "brand-intent.json"), { schema: "fixture/v1", intent: [] });
  writeJson(path.join(host, "package.json"), { name: "fresh-host", dependencies: {} });
  fs.writeFileSync(path.join(host, "src", "app.config.ts"), "export default { pages: ['pages/home/index'] };\n");
  fs.writeFileSync(path.join(host, "src", "pages", "home", "index.vue"), "<template><view>untouched</view></template>\n");

  const missingBrand = runFixture([
    "run", "--request-kind", "host-concepts", "--artifact-root", artifactRoot, "--mode", "design-host", "--profile", "fast",
    "--host-target", host,
  ]);
  assert.notEqual(missingBrand.status, 0);
  const missingBrandPayload = JSON.parse(missingBrand.stdout);
  assert.equal(missingBrandPayload.blockingCode, "BRAND_REFERENCE_REQUIRED");
  assert.match(missingBrandPayload.intake.question, /品牌官网|style pack/);

  const beforePreparing = treeHash(host);
  // The seed user's exact library URL selects a package, never its catalog UI.
  const libraryRoot = path.join(fixtureRoot, 'library', 'build');
  const registryRoot = path.join(libraryRoot, 'public/brand-registry/v0.1');
  const selectedBrand = 'pokemon-tcg-official';
  const packRelative = `/brand-registry/v0.1/brands/${selectedBrand}/1.0.0`;
  writeJson(path.join(fixtureRoot,'library/run.json'), {schema:'brand-artifact-run/v1',id:'library',host,status:'active'});
  writeJson(path.join(registryRoot,'index.json'), {brands:[{id:selectedBrand,version:'1.0.0',manifest:`${packRelative}/manifest.json`}]});
  writeJson(path.join(registryRoot,'by-source.json'), {sources:{}});
  const artifacts={};
  for(const name of ['brand-mod','brand-evidence','brand-intent']) {
    artifacts[name]=`${packRelative}/${name}.json`;
    writeJson(path.join(libraryRoot,'public',artifacts[name]),JSON.parse(fs.readFileSync(path.join(migration,`${name}.json`))));
  }
  writeJson(path.join(libraryRoot,'public',packRelative,'manifest.json'), {artifacts});
  const libraryArgs=['run','--request-kind','host-concepts','--mode','design-host','--profile','fast','--artifact-root',libraryRoot,'--host-target',host,'--source-url','https://jocelyntong.github.io/DangoUI-Brand-Skill/#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home'];
  const selected=runFixture(libraryArgs);
  assert.equal(selected.status,0,selected.stdout+selected.stderr);
  const selectedOutput=JSON.parse(selected.stdout);
  assert.equal(selectedOutput.step,'h5-direction-generation');
  assert.equal(selectedOutput.dispatchRequest.stage,'h5DirectionGeneration');
  assert.equal(selectedOutput.learnBrandDispatched,false);
  assert.equal(fs.existsSync(path.join(libraryRoot,'source-prerequisite.json')),false);
  assert.equal(fs.existsSync(path.join(libraryRoot,'output/extractor-benchmark')),false);
  assert.equal(treeHash(host),beforePreparing);
  const conflict=runFixture([...libraryArgs,'--brand','another-brand']);
  assert.equal(JSON.parse(conflict.stdout).blockingCode,'STYLE_PACK_SELECTION_CONFLICT');
  const absent=runFixture(libraryArgs.map(value=>value.includes('#/brand/pokemon-')?value.replaceAll('pokemon-tcg-official','absent-brand'):value));
  assert.equal(JSON.parse(absent.stdout).blockingCode,'SELECTED_STYLE_PACK_NOT_FOUND');
  // A normal website reference must discover its published pack before any
  // prerequisite extraction. Discovery is not permission to silently reuse it.
  writeJson(path.join(registryRoot,'by-source.json'), {sources:{'https://tcg.pokemon.com/en-us':selectedBrand}});
  const discovery = runFixture(libraryArgs.map(value => value.includes('#/brand/pokemon-') ? 'https://tcg.pokemon.com/en-us/' : value));
  assert.equal(JSON.parse(discovery.stdout).blockingCode, 'STYLE_PACK_REUSE_APPROVAL_REQUIRED');
  const websiteArgs = libraryArgs.map(value => value.includes('#/brand/pokemon-') ? 'https://tcg.pokemon.com/en-us/' : value);
  const learning = runFixture([...websiteArgs, '--learn-source']);
  assert.equal(learning.status, 0, learning.stdout + learning.stderr);
  assert.equal(JSON.parse(learning.stdout).status, 'prerequisite-dispatch-ready');
  const learningHandoff = JSON.parse(fs.readFileSync(path.join(libraryRoot,'source-prerequisite.json'),'utf8'));
  assert.equal(learningHandoff.parentRequestKind, 'host-concepts');
  assert.equal(learningHandoff.hostTarget, host);
  assert.equal(learningHandoff.brand, selectedBrand);
  assert.equal(learningHandoff.learning.args[learningHandoff.learning.args.indexOf('--brand') + 1], selectedBrand);
  assert.ok(learningHandoff.parentArgs.includes('--learn-source'));
  assert.equal(learningHandoff.parentArgs[learningHandoff.parentArgs.indexOf('--source-url') + 1], learningHandoff.sourceUrl);
  assert.equal(learningHandoff.parentArgs[learningHandoff.parentArgs.indexOf('--brand') + 1], learningHandoff.brand);
  assert.equal(learningHandoff.parentArgs.includes('--mod-file'), false);
  fs.unlinkSync(path.join(libraryRoot,'source-prerequisite.json'));
  assert.equal(JSON.parse(runFixture([...websiteArgs,'--learn-source','--reuse-style-pack']).stdout).blockingCode,'SOURCE_SELECTION_CONFLICT');
  assert.equal(JSON.parse(runFixture([...libraryArgs,'--learn-source']).stdout).blockingCode,'LIBRARY_LINK_NOT_LEARNING_SOURCE');
  assert.equal(fs.existsSync(path.join(libraryRoot,'source-prerequisite.json')),false);
  assert.equal(fs.existsSync(path.join(libraryRoot,'output/extractor-benchmark')),false);
  for (const profile of ["fast", "standard", "certification"]) {
    const profileRoot = path.join(fixtureRoot, profile, "build");
    fs.mkdirSync(profileRoot, { recursive: true });
    writeJson(path.join(fixtureRoot, profile, "run.json"), { schema: "brand-artifact-run/v1", id: profile, host, status: "active" });
    writeJson(path.join(profileRoot,'public/brand-registry/v0.1/index.json'), {brands:[]});
    writeJson(path.join(profileRoot,'public/brand-registry/v0.1/by-source.json'), {sources:{}});
    const sourceOnly = runFixture([
      "run", "--request-kind", "host-concepts", "--artifact-root", profileRoot,
      "--profile", profile, "--brand", brand, "--host-target", host,
      "--source-url", "https://www.duolingo.com/",
    ]);
    assert.equal(sourceOnly.status, 0, sourceOnly.stderr);
    const dispatch = JSON.parse(sourceOnly.stdout);
    assert.equal(dispatch.status, "prerequisite-dispatch-ready");
    assert.equal(dispatch.requestKind, "host-concepts");
    assert.equal(dispatch.fullWorkflowPass, false);
    assert.equal(dispatch.userGoalCompleted, false);
    assert.ok(dispatch.continueCommand.includes("continue"));
    assert.equal(dispatch.hostMutationAllowed, false);
    assert.equal(dispatch.resume.hostTarget, host);
    assert.equal(dispatch.resume.profile, profile);
    assert.equal(dispatch.learning.args[dispatch.learning.args.indexOf("--profile") + 1], profile === "fast" ? "fast" : "full");
    assert.ok(dispatch.learning.args.includes("--source-prerequisite"));
    assert.equal(JSON.parse(fs.readFileSync(dispatch.handoffFile)).status, "learning-required");
    assert.equal(treeHash(host), beforePreparing);
  }
  const invalidSource = runFixture([
    "run", "--request-kind", "host-concepts", "--artifact-root", artifactRoot,
    "--brand", brand, "--host-target", host, "--source-url", "file:///tmp/brand",
  ]);
  assert.notEqual(invalidSource.status, 0);
  assert.equal(JSON.parse(invalidSource.stdout).blockingCode, "BRAND_SOURCE_URL_INVALID");
  const preparing = runFixture([
    "run", "--request-kind", "host-concepts", "--artifact-root", artifactRoot, "--mode", "design-host", "--profile", "fast",
    "--brand", brand, "--host-target", host, "--mod-file", path.join(migration, "brand-mod.json"),
  ]);
  assert.equal(preparing.status, 0, preparing.stderr);
  const preparingPayload = JSON.parse(preparing.stdout);
  assert.equal(preparingPayload.status, "dispatch-ready");
  assert.equal(preparingPayload.step, "h5-direction-generation");
  assert.equal(preparingPayload.dispatchRequest.stage, "h5DirectionGeneration");
  assert.ok(preparingPayload.manifest.endsWith("execution-manifest.json"));
  assert.equal(preparingPayload.learnBrandDispatched, false);
  assert.equal(preparingPayload.hostFilesModified, false);
  assert.equal(treeHash(host), beforePreparing);

  // Status and plan must follow the active specialist run, including pending
  // implementation and failed bindings, without rewriting any frozen artifacts.
  const manifestFile = path.join(migration, "execution-manifest.json");
  const originalManifest = fs.readFileSync(manifestFile);
  const modFile = path.join(migration, "brand-mod.json");
  const originalMod = fs.readFileSync(modFile);
  writeJson(modFile, { ...JSON.parse(originalMod), tokens: { dtcg: {} } });
  writeJson(path.join(migration, "action-evidence-score.skills.json"), { candidates: {} });
  const implementationGoal = path.join(migration, "implementation-status-goal.json");
  const masterFile = path.join(migration, "implementation-status-master.json");
  writeJson(masterFile, { frozen: true });
  writeJson(implementationGoal, {
    mode: "apply-host", requestKind: "host-implementation", sealed: true,
    brand, hostTarget: host,
    approvedMaster: { path: path.relative(artifactRoot, masterFile), sha256: fileHash(masterFile) },
  });
  const implementationManifest = {
    brand,
    mode: "apply-host", status: "running", currentStageId: "hostImplementation-1",
    goalPath: path.relative(artifactRoot, implementationGoal), goalSha256: fileHash(implementationGoal),
    stages: [{ id: "hostImplementation-1", stage: "hostImplementation", status: "running" }],
  };
  const auditExisting = (mode, expectedStatus, expectedAction, expectedError) => {
    const frozenBefore = treeHash(migration);
    for (const command of ["status", "plan"]) {
      const audit = runFixture([command, "--mode", mode, "--artifact-root", artifactRoot,
        "--brand", brand, "--host-target", host, "--mod-file", path.join(migration, "brand-mod.json")]);
      assert.equal(audit.status, 0, audit.stderr || audit.stdout);
      const report = JSON.parse(audit.stdout);
      assert.equal(report.userDelivery.status, expectedStatus);
      if (expectedAction) assert.equal(report.nextAction, expectedAction);
      if (expectedError) assert.ok(report.userDelivery.errors.includes(expectedError));
      assert.equal(report.userDelivery.userGoalCompleted, false);
      if (command === "status") {
        assert.equal(report.completed, false);
        assert.equal(report.userGoalCompleted, false);
      }
      assert.equal(report.completedStages.length, 0);
      assert.equal(report.progress.completedStepCount, 0);
      assert.ok(report.missingOutputs.length > 0);
      assert.ok(!report.missingOutputs.includes("wild-design-selection"));
      assert.ok(!Object.hasOwn(report.stepStatus, "wild-design-selection"));
      assert.equal(report.outputStatus[0].status, expectedStatus);
      assert.equal(treeHash(migration), frozenBefore);
      assert.equal(treeHash(host), beforePreparing);
    }
  };
  writeJson(manifestFile, implementationManifest);
  auditExisting("apply-host", "pending", "continue-implementation-preview-qa");
  // A query addresses this frozen run without choosing or consuming a pack.
  const queryArgs = ["--mode", "apply-host", "--request-kind", "host-implementation",
    "--artifact-root", artifactRoot, "--brand", brand, "--host-target", host];
  const frozenQueryBefore = treeHash(migration);
  for (const command of ["status", "plan"]) {
    const query = runFixture([command, ...queryArgs]);
    assert.equal(query.status, 0, query.stdout || query.stderr);
    const report = JSON.parse(query.stdout);
    assert.equal(report.userDelivery.status, "pending");
    assert.equal(report.nextAction, "continue-implementation-preview-qa");
    assert.equal(report.intake.signals.modFile, false);
    assert.equal(report.intake.signals.stylePack, false);
    assert.equal(report.intake.frozenRun.goalSha256, implementationManifest.goalSha256);
    assert.equal(treeHash(migration), frozenQueryBefore);
    assert.equal(treeHash(host), beforePreparing);
    const wrongHost = [...queryArgs];
    wrongHost[wrongHost.indexOf("--host-target") + 1] = path.join(fixtureRoot, "other-host");
    const mismatch = runFixture([command, ...wrongHost]);
    assert.equal(JSON.parse(mismatch.stdout).blockingCode, "FROZEN_RUN_QUERY_MISMATCH");
    const wrongMode = [...queryArgs];
    wrongMode[wrongMode.indexOf("--mode") + 1] = "design-host";
    wrongMode[wrongMode.indexOf("--request-kind") + 1] = "host-concepts";
    assert.equal(JSON.parse(runFixture([command, ...wrongMode]).stdout).blockingCode, "FROZEN_RUN_QUERY_MISMATCH");
    const explicit = JSON.parse(runFixture([command, ...queryArgs, "--mod-file", modFile]).stdout);
    assert.equal(explicit.intake.signals.modFile, true);
    assert.equal(explicit.intake.frozenRun, undefined);
  }
  for (const command of ["run", "detect"]) {
    const query = runFixture([command, ...queryArgs]);
    assert.equal(JSON.parse(query.stdout).blockingCode, "APPLY_HOST_INPUT_REQUIRED");
  }
  fs.appendFileSync(implementationGoal, "\n");
  for (const command of ["status", "plan"]) {
    assert.equal(JSON.parse(runFixture([command, ...queryArgs]).stdout).blockingCode, "FROZEN_RUN_QUERY_MISMATCH");
  }
  fs.writeFileSync(implementationGoal, fs.readFileSync(implementationGoal, "utf8").slice(0, -1));
  auditExisting("design-host", "blocked", null, "HOST_WORKFLOW_MODE_MISMATCH");
  // A completed QA label and files alone cannot become a passing delivery.
  writeJson(manifestFile, { ...implementationManifest, stages: [...implementationManifest.stages,
    { id: "previewQA-1", stage: "previewQA", status: "complete", verdict: "pass" }] });
  auditExisting("apply-host", "blocked", null, "PASSING_STAGE_RECEIPT_REQUIRED");
  writeJson(manifestFile, { ...implementationManifest, status: "blocked" });
  auditExisting("apply-host", "blocked", "report-blocker-and-stop", "HOST_IMPLEMENTATION_PREVIEW_BLOCKED");
  writeJson(manifestFile, implementationManifest);
  writeJson(masterFile, { frozen: "changed" });
  auditExisting("apply-host", "blocked", null, "HOST_IMPLEMENTATION_MASTER_CHANGED");
  writeJson(implementationGoal, { mode: "apply-host", sealed: false });
  auditExisting("apply-host", "blocked", null, "HOST_IMPLEMENTATION_GOAL_INVALID");
  fs.writeFileSync(manifestFile, originalManifest);
  auditExisting("design-host", "pending", "continue-host-preview");
  for (const command of ["status", "plan"]) {
    const frozenBefore = treeHash(migration);
    const query = runFixture([command, "--mode", "design-host", "--request-kind", "host-concepts",
      "--artifact-root", artifactRoot, "--brand", brand, "--host-target", host]);
    assert.equal(query.status, 0, query.stdout || query.stderr);
    assert.equal(JSON.parse(query.stdout).userDelivery.status, "pending");
    assert.equal(JSON.parse(query.stdout).intake.frozenRun.mode, "design-host");
    assert.equal(treeHash(migration), frozenBefore);
  }
  auditExisting("apply-host", "blocked", null, "HOST_WORKFLOW_MODE_MISMATCH");
  fs.unlinkSync(manifestFile);
  for (const command of ["status", "plan"]) {
    const noManifest = runFixture([command, ...queryArgs]);
    assert.equal(JSON.parse(noManifest.stdout).blockingCode, "APPLY_HOST_INPUT_REQUIRED");
    const legacy = runFixture([command, "--mode", "apply-host", "--artifact-root", artifactRoot,
      "--brand", brand, "--host-target", host, "--mod-file", modFile]);
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.ok(JSON.parse(legacy.stdout).missingOutputs.includes("wild-design-selection"));
  }
  fs.writeFileSync(manifestFile, originalManifest);
  fs.writeFileSync(modFile, originalMod);
  console.log("run-brand-workflow modern status/plan delivery and legacy fallback tests passed");

  const options = path.join(migration, "design-direction-options.json");
  const scope = path.join(migration, "business-scope.json");
  writeJson(scope, { schema: "business-scope/v1", target: "home" });
  const evidenceHash = fileHash(path.join(migration, "brand-evidence.json"));
  const scopeHash = fileHash(scope);
  const previewA = path.join(migration, "option-a.html");
  const previewB = path.join(migration, "option-b.html");
  const previewC = path.join(migration, "option-c.html");
  fs.writeFileSync(previewA, '<main id="a">Static host direction A</main>');
  fs.writeFileSync(previewB, '<main id="b">Static host direction B</main>');
  fs.writeFileSync(previewC, '<main id="c">Static host direction C</main>');
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
    firstViewportVisualProof: { visualNarrative: `${id}-narrative`, visibleDimensions: ["asset", "composition", "material"], atmosphereLayers: ["environment", "lighting", "depth"], compositionSignature: id === "a" ? { visualCenter: "full-scene", primaryActionPlacement: "bottom-overlay", contentEntry: "bottom-sheet", resultPresentation: "vertical-list" } : id === "b" ? { visualCenter: "asymmetric-stage", primaryActionPlacement: "side-panel", contentEntry: "horizontal-rail", resultPresentation: "mosaic-grid" } : { visualCenter: "task-led-command", primaryActionPlacement: "top-inline", contentEntry: "direct-results", resultPresentation: "editorial-rail" }, dominantMedia: [{ assetRef: `asset:${id}`, evidenceRef: `evidence:${id}`, renderedSelector: `#${id}`, role: "hero-scene", sourceKind: "official-independent-asset", firstViewportAreaRatio: 0.4 }] },
    responsiveProof: { targetFormFactor: "mobile", pageType: "browse-list", viewportWidth: 375, persistentSideRail: false, primaryContentWidthRatio: 0.9, touchTargetMinPx: 44, horizontalOverflow: false, heroHeightRatio: 0.5, firstBusinessContentTopRatio: 0.68, contentContainerFlow: "document-flow", hostFirstImpression: { taskPriority: "efficiency-first", informationDensity: "high", contentFlow: "continuous-flow", returnFrequency: "frequent", firstActionUrgency: "immediate", existingMediaSlots: [], evidence: "Host page source and route show a continuous home flow." }, heroDecision: { mode: "compact", rationale: "Keep the primary host task visible in the first viewport." } },
    directionContract: { businessCapabilities: ["home"], layout: [`${id}-hero`, `${id}-content`] },
  });
  writeJson(options, { schema: "wild-design-options/v2", workflow: "design-host", sourceBrand: brand, frozenBrandEvidenceSha256: evidenceHash, frozenBrandModSha256: fileHash(path.join(migration, "brand-mod.json")), sharedLayoutContract: ["home"], options: [visualOption("a", true, previewA), visualOption("b", false, previewB), visualOption("c", false, previewC)] });
  const beforeChoice = treeHash(host);
  const awaitingChoice = runFixture([
    "run", "--request-kind", "host-concepts", "--artifact-root", artifactRoot, "--mode", "design-host", "--profile", "fast",
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
  // These fixtures exercise the explicitly requested interactive-H5 route.
  return spawnSync(process.execPath, [entry, ...args, '--concept-medium', 'interactive-h5'], { encoding: "utf8" });
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
