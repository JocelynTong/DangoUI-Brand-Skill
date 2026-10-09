#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { freezeDesignKnowledge } from "./freeze-design-knowledge.mjs";

const script = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const routeValidator = path.resolve("skills/brand/scripts/validate-design-host-route.mjs");
const conceptBriefValidator = path.resolve("skills/brand/scripts/validate-concept-direction-briefs.mjs");
const renderKitValidator = path.resolve("skills/brand/scripts/validate-brand-render-kit.mjs");
const imageToolCalls = ["imagegen-a", "imagegen-b", "imagegen-c"];
const artifact = (path) => ({ path, sha256: "a".repeat(64) });
const direction = (id, knowledge) => ({ id, officialIdentityAssetsUsed: ["official-card"], identityIntegration: { mode: "direct-reference", referenceAttemptCount: 1, inputRoles: [{ assetId: "official-card", role: "unchanged official identity subject" }] }, pairedStateBoard: artifact(`${id}-board.png`), peakFrame: { ...artifact(`${id}-board.png`), region: "left" }, settledFrame: { ...artifact(`${id}-board.png`), region: "right" }, productionFormula: { expressive: { producer: "image_gen", role: "generated-proposal", toolCallId: `imagegen-${id}` }, productive: { brandDesignSystemSha256: "b".repeat(64), hostStartupBaselineSha256: knowledge.bundle.hostContext.baselineSha256, patternBindings: [{ patternRef: "database-reversible-search-results", requiredLayersUsed: ["search", "results"], visibleMechanism: "Reversible search state with readable result rows." }] }, expertDecision: { questionRef: "expressive-productive-allocation-question", knowledgeRefs: ["method:expressive-productive-allocation"], knowledgeBundleSha256: knowledge.sha256, rationale: "Keep frequent search work dominant after the expressive cold-start entry.", hostReasons: { primaryTask: "search decks", primaryAction: "search", productiveConstraint: "Keep search and real deck results visible above the fold.", expressiveConstraint: "Limit expression to the bounded cold-start opportunity." } }, identityPolicy: { generatedIdentitySubjectsForbidden: true, officialIdentityAssetsUnmodified: true } }, settledStateContract: { primaryActionAvailableFromFirstFrame: true, productiveContentDominant: true, coreToolEntryAboveFold: true, realResultsVisible: true, warmReturnStartsSettled: true } });
const conceptBriefs = () => ({
  schema: "concept-direction-briefs/v1",
  directions: [
    ["a", "radiant-card-stage", "inline-search-ribbon", "stacked-readable-cards"],
    ["b", "electric-diagonal-gate", "floating-command-dock", "two-column-deck-ledger"],
    ["c", "psychic-orbit-field", "embedded-query-lens", "ranked-result-rail"],
  ].map(([id, visualCenter, contentEntry, resultPresentation]) => ({
    id, title: `Direction ${id.toUpperCase()}`,
    expressiveThesis: `A source-grounded ${visualCenter} composition creates a memorable branded opening while keeping the search task immediately available.`,
    sourceMechanisms: [1, 2, 3].map((index) => ({ evidenceRef: `brand-evidence-${index}`, visibleApplication: `Visible source mechanism ${index} is translated into layout, color, and depth.` })),
    compositionSignature: { visualCenter, contentEntry, resultPresentation },
    informationDistributionFit: { model: "vertical previewable deck list", preservesPreviewUnit: true, preservesScanOrder: true, preservesComparisonBehavior: true, sourceMetaphorSubstitution: "none" },
    productiveApplication: { systemRefs: ["brand-design-system"], visibleRules: ["Apply the documented brand color hierarchy.", "Apply the documented spacing and radius language.", "Apply the documented typography and control treatment."] },
    identityPlan: { assetIds: ["official-card"], preferredMode: "direct-reference", fallbackMode: "deterministic-composite", integrationGeometry: "Perspective-bound card plane inside the scene", integrationEffects: ["occlusion", "contact-shadow", "environment-light"] },
    hostContentIntegration: { mode: "scene-object", generatedPlaceholderIsProof: false, fallback: "productive-ui", bindings: [{ candidateId: "deck-cover", hostField: "cover", semanticRole: "featured deck identity", plannedCssSize: { width: 80, height: 110 }, fit: "projective", preserveAspectRatio: true, nestedFrameCount: 0, containerReason: "The host cover is a real scene object with a frozen plane and physical support." }] },
    resultContentPlan: { fields: ["name", "author", "views"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
    peakViewportRatio: 0.3,
  })),
});
const renderKit = () => ({ schema: "brand-render-kit/v1", brandSystemSha256: "a".repeat(64), expressive: { mechanisms: [1, 2, 3].map((n) => ({ id: `e${n}`, evidenceRef: `brand-evidence-${n}`, visibleEffect: `Distinct spatial and lighting mechanism ${n}.` })) }, productive: { rules: [1, 2, 3].map((n) => ({ id: `p${n}`, systemRef: `brand-system-${n}`, visibleApplication: `Visible control and content rule application ${n}.` })) }, transition: { rules: [1, 2].map((n) => ({ id: `t${n}`, peak: `peak ${n}`, settled: `settled ${n}`, carryThrough: `Continuous brand cue maintained through transition ${n}.` })) }, directions: ["radiant card stage", "electric diagonal portal", "psychic orbit observatory"].map((world, index) => ({ id: String.fromCharCode(97 + index), visualWorld: `A distinct ${world} visual composition`, expressiveMechanismRefs: ["e1", `e${index + 1}`], productiveRuleRefs: ["p1", `p${index + 1}`], transitionRuleRefs: [`t${index % 2 + 1}`], identityAssetIds: ["official-card"] })) });
const pairedCriteria = { peakExpressiveQuality: "pass", settledProductiveClarity: "pass", stateContinuity: "pass", brandFidelity: "pass", visualFinish: "pass", hostTaskClarity: "pass", expressiveOriginality: "pass", productiveDesignSystemFidelity: "pass", expertDecisionTraceability: "pass", identityIntegrity: "pass", firstGlanceImpact: "pass", peakSettledPerceptualDelta: "pass", identityIntegrationNaturalness: "pass", crossDirectionArtWorldDistance: "pass", informationDistributionFit: "pass", previewabilityAtTargetSize: "pass", expressiveCompositionCoherence: "pass", designReasonVisibility: "pass" };

function writeMeasuredHostBaseline({ root, migration, startupFile, sourceSha256 }) {
  const hostStartupPageSha256 = crypto.createHash("sha256").update(fs.readFileSync(startupFile)).digest("hex");
  const receiptFile = path.join(migration, "host-startup-measurements.json");
  const sourceLocator = "src/pages/home.vue#deck.cover";
  const selector = ".deck-card .cover";
  fs.writeFileSync(receiptFile, JSON.stringify({
    schema: "host-startup-measurements/v1",
    status: "measured",
    hostStartupPageSha256,
    viewport: { width: 375, height: 812 },
    state: "deck-results-loaded",
    candidates: [{ id: "deck-cover", selector, sourceFile: "src/pages/home.vue", sourceLocator, sourceSha256, sourceSize: { width: 160, height: 220 }, currentCssSize: { width: 80, height: 110 } }],
  }));
  const receiptSha256 = crypto.createHash("sha256").update(fs.readFileSync(receiptFile)).digest("hex");
  return {
    schema: "host-startup-baseline/v1",
    derivationSource: "startup-page-scan",
    hostStartupPageSha256,
    primaryTask: "search decks",
    primaryAction: "search",
    pageType: "utility-list",
    navigationShellContract: { derivationSource: "startup-page-source-analysis", mode: "absent", items: [], allowedTreatments: ["custom-immersive"], continuityPolicy: "This minimal fixture source has no navigation shell; do not invent navigation entries." },
    productiveFloor: { coreEntry: "search", businessObjectsVisible: ["deck results"], warmReturnState: "settled" },
    resultContentContract: { mode: "host-schema", fields: ["name", "author", "views"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
    hostContentContract: { derivationSource: "startup-page-source-and-render", userInputRequired: false, noCandidateFallback: "productive-ui", visualCandidates: [{ id: "deck-cover", hostField: "cover", businessRole: "searchable deck identity", sourceFile: "src/pages/home.vue", sourceLocator, sourceSha256, sourceSize: { width: 160, height: 220 }, currentCssSize: { width: 80, height: 110 }, minimumReadableCssPx: 72, readiness: "ready", measurement: { status: "measured", source: "rendered-startup-state", selector, receiptPath: path.relative(root, receiptFile), receiptSha256 } }] },
    informationDistributionContract: { model: "vertical previewable deck list", previewUnit: { requiredDecisionFields: ["name", "author", "views"], openRequiredForBasicJudgment: false }, scanOrder: ["search", "deck results"], comparisonBehavior: "compare visible deck metadata before opening an item", forbiddenMetaphorSubstitutions: ["lesson path"] },
    resultHierarchyContract: { derivationSource: "startup-page-source-analysis", defaultRelationship: "peer", differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"] },
    expressiveOpportunity: { heroEligible: true, reason: "bounded cold-start entry", maxFirstViewportRatio: 0.32 },
    communicationIntent: {
      framework: "hierarchy-utility-style/v1",
      hierarchy: { primaryAttention: "search", informativeContent: ["name", "author", "views"], efficiencyConstraint: "keep search and peer results visible" },
      utility: { mainFunction: "search and compare decks", obviousAction: "search", conventionConstraint: "preserve the searchable result list" },
      style: { sourceConstraint: "derive attributes from frozen brand evidence", evaluationMode: "first-impression-comparison-after-product-safety-pass" },
    },
  };
}

function createFixture(mode, brand, executionProfile = undefined) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `brand-${mode}-test-`));
  const migration = path.join(root, "migrations", brand);
  const skillDir = path.join(root, "skills", "brand");
  const scriptsDir = path.join(skillDir, "scripts");
  const referencesDir = path.join(skillDir, "references");
  fs.mkdirSync(path.join(migration, "receipts"), { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(referencesDir, { recursive: true });
  const hostSource = path.join(root, "host", "src", "pages", "home.vue");
  fs.mkdirSync(path.dirname(hostSource), { recursive: true });
  fs.writeFileSync(hostSource, "<template><img class=\"cover\"></template>\n");
  const hostSourceSha = crypto.createHash("sha256").update(fs.readFileSync(hostSource)).digest("hex");
  const startupFile = path.join(migration, "host-startup-page.json");
  fs.writeFileSync(startupFile, JSON.stringify({ schema: "host-startup-page/v1", hostRoot: "host", route: "/home", sourceFile: "src/pages/home.vue", sourceSha256: hostSourceSha, scope: "startup-page-only" }));
  fs.cpSync(path.resolve("knowledge"), path.join(root, "knowledge"), { recursive: true });
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.cpSync(path.resolve("public/knowledge"), path.join(root, "public", "knowledge"), { recursive: true });
  for (const name of ["query-design-knowledge.mjs", "validate-case-flywheel.mjs"]) fs.copyFileSync(path.resolve("skills/brand/scripts", name), path.join(scriptsDir, name));
  fs.copyFileSync(path.resolve("skills/brand/references/decision-reading-policy.json"), path.join(referencesDir, "decision-reading-policy.json"));
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({ sealed: true, mode, executionProfile, hostTarget: path.join(root, 'host'), goalId: `${brand}-${mode}-goal`, thresholds: { maxAttempts: 2 } }));
  if (mode === "design-host") {
    for (const name of ["brand-evidence.json", "brand-intent.json"]) fs.writeFileSync(path.join(migration, name), "{}\n");
    for (const name of ["approved-visual-patterns.json", "component-mapping.json", "dangoui-adapter.json"]) fs.writeFileSync(path.join(migration, name), "{}\n");
    const identityPath = `public/assets/brand-assets/${brand}/official-card.png`;
    const identityFile = path.join(root, identityPath);
    const identityBytes = Buffer.from("official-card");
    fs.mkdirSync(path.dirname(identityFile), { recursive: true });
    fs.writeFileSync(identityFile, identityBytes);
    fs.writeFileSync(path.join(migration, "brand-mod.json"), JSON.stringify({ assets: [{ id: "official-card", role: "brand-identity", sourceKind: "original-site-asset", status: "style-only", localPath: identityPath, sourceSha256: crypto.createHash("sha256").update(identityBytes).digest("hex") }] }));
    fs.writeFileSync(path.join(migration, "design-host-preflight.json"), JSON.stringify({ schema: "brand-design-host-preflight/v1", verdict: "pass" }));
  }
  if (mode === "apply-host") {
    fs.writeFileSync(path.join(migration, "host-startup-baseline.json"), JSON.stringify(writeMeasuredHostBaseline({ root, migration, startupFile, sourceSha256: hostSourceSha })));
    const knowledge = freezeDesignKnowledge({ skillRoot: skillDir, root, brand });
    fs.writeFileSync(path.join(migration, "design-host-route.json"), JSON.stringify({ schema: "design-host-route/v2", sequence: "image-demo-first", imageCapability: { status: "available", tool: "image_gen", mode: "built-in-default" }, brandIdentityAssets: { status: "ready", brandModSha256: "c".repeat(64), assets: [{ id: "official-card", localPath: "public/assets/official-card.png", sha256: "d".repeat(64) }] }, knowledgeDecision: { status: "ready", path: `migrations/${brand}/design-knowledge-bundle.json`, sha256: knowledge.sha256, hostStartupBaselineSha256: knowledge.bundle.hostContext.baselineSha256, questionRefs: knowledge.bundle.questions.map((item) => item.id) }, demoImages: { status: "ready", producer: { executionId: "/root/image-producer", imageToolCalls }, directions: [direction("a", knowledge), direction("b", knowledge), direction("c", knowledge)] }, demoVisualReview: { status: "pass", qualityVerdict: "pass", criteria: pairedCriteria, reviewerExecutionId: "/root/image-qa", recommendedDirectionIds: ["a"] }, userDirectionReview: { status: "approved", selectionSource: "explicit-user", selectedOptionIds: ["a"] }, h5Reconstruction: { status: "ready", producerExecutionId: "/root/h5", artifacts: [{ path: "direction.html" }] }, h5QA: { status: "pass", reviewerExecutionId: "/root/h5-qa" }, finalSelection: { status: "selected", selectionSource: "explicit-user", selectedOptionId: "a" } }));
    fs.writeFileSync(path.join(migration, "host-page-inventory.json"), JSON.stringify({ schema: "host-page-inventory/v1", defaultEntry: "/home", discovery: { complete: true }, pages: [{ id: "src/pages/home.vue", sourceFile: "src/pages/home.vue", sourceSha256: "a".repeat(64), inferredRoute: "/home" }] }));
    fs.writeFileSync(path.join(migration, "apply-host-preflight.json"), JSON.stringify({ schema: "brand-apply-host-preflight/v1", verdict: "pass" }));
  }
  fs.writeFileSync(path.join(skillDir, "workflow-contract.json"), JSON.stringify({
    roleContractVersion: "test",
    roles: {
      hostStrategist: { goal: "diagnose host", outputs: ["host-opportunity-map.json"] },
      brandApplicationDesigner: { goal: "compose static directions", outputs: ["design-direction-options.json"] },
      hostImplementationAgent: { goal: "implement frozen direction", outputs: ["host-rendered-proof.json"] },
      visualQA: { goal: "review host", tasks: ["score the fixed fidelity rubric"], requirements: ["Evidence Fidelity, Structural Fidelity, and Generative Proof each pass"], outputs: ["visual-qa-report.json"] },
    },
  }));
  fs.writeFileSync(path.join(scriptsDir, "validate-brand-application-plan.mjs"), "process.exit(0);\n");
  fs.writeFileSync(path.join(scriptsDir, "validate-wild-design-decision.mjs"), "process.exit(0);\n");
  fs.writeFileSync(path.join(scriptsDir, "validate-host-structural-diff.mjs"), "process.exit(0);\n");
  fs.copyFileSync(routeValidator, path.join(scriptsDir, "validate-design-host-route.mjs"));
  for (const name of ["selected-h5-handoff.mjs", "evidence-file-references.mjs", "selected-h5-postedit-context.mjs"]) fs.copyFileSync(path.resolve("skills/brand/scripts", name), path.join(scriptsDir, name));
  fs.copyFileSync(path.resolve("skills/brand/scripts/validate-expressive-geometry-lock.mjs"), path.join(scriptsDir, "validate-expressive-geometry-lock.mjs"));
  fs.copyFileSync(conceptBriefValidator, path.join(scriptsDir, "validate-concept-direction-briefs.mjs"));
  fs.copyFileSync(path.resolve("skills/brand/scripts/validate-host-startup-baseline.mjs"), path.join(scriptsDir, "validate-host-startup-baseline.mjs"));
  fs.copyFileSync(renderKitValidator, path.join(scriptsDir, "validate-brand-render-kit.mjs"));
  if (mode === "design-host") fs.writeFileSync(path.join(migration, "execution-capabilities.json"), JSON.stringify({ schema: "brand-execution-capabilities/v1", imageGeneration: { status: "available", tool: "image_gen", mode: "built-in-default" } }));

  const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const run = (...command) => {
    const result = spawnSync(process.execPath, [script, ...command, "--brand", brand, "--root", root], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillDir } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const readManifest = () => JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"));
  const writeOutput = (name, content = "{}") => {
    const file = path.join(migration, name);
    fs.writeFileSync(file, content);
    return { path: `migrations/${brand}/${name}`, sha256: sha(file) };
  };
  const recordCurrent = (agentExecutionId, output) => {
    const manifest = readManifest();
    const current = manifest.stages.find((item) => item.id === manifest.currentStageId);
    const dispatch = JSON.parse(fs.readFileSync(path.join(root, current.dispatchPath), "utf8"));
    if (current.stage === "previewQA") {
      const implementation = [...manifest.stages].reverse().find(stage => stage.stage === "hostImplementation" && stage.status === "complete");
      const observed = writeOutput("test-runtime-observation.json", JSON.stringify({ runtime: "browser", fixture: true, observed: "Synthetic runtime observation for state-machine tests, not production visual evidence" }));
      output = [writeOutput("preview-smoke-report.json", JSON.stringify({ schema: "host-preview-smoke/v1", acceptanceScope: "implementation-preview-only", reviewerExecutionId: agentExecutionId, goalSha256: manifest.goalSha256, verdict: "pass", wholeHostCertified: false, sourceLearningCertified: false, userApproval: "pending", implementationBindings: implementation.outputHashes, evidenceRefs: [observed], runtimeBindings: [{ path: 'src/pages/home.vue', sha256: sha(hostSource) }], limitations: ["synthetic routing fixture only"], observations: [{ id: "fixture-runtime", runtime: "browser", target: "synthetic fixture", method: "fixture", observed: "Synthetic runtime observation, not a real product PASS" }], checks: ["runtime-load", "selected-direction", "business-preservation", "state-restoration"].map(id => ({ id, status: "pass", observationIds: ["fixture-runtime"] })), blockingFindings: [] })), observed];
    }
    const receipt = {
      dispatchId: dispatch.dispatchId,
      stageId: current.id,
      role: current.role,
      agentExecutionId,
      goalSha256: manifest.goalSha256,
      verdict: "pass",
      toolCalls: current.stage === "conceptGeneration" ? imageToolCalls.map((id) => ({ id, tool: "imagegen" })) : [],
      inputs: dispatch.requiredInputs,
      outputs: Array.isArray(output) ? output : [output],
      blockingFindings: [],
    };
    const receiptPath = path.join(migration, "receipts", `${current.id}.json`);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    return run("record", "--receipt", `migrations/${brand}/receipts/${current.id}.json`);
  };
  const mutateOutput = (name, content) => fs.writeFileSync(path.join(migration, name), content);
  return { run, readManifest, writeOutput, recordCurrent, mutateOutput, migration };
}

function completeApplyHostScan(fixture) {
  assert.equal(fixture.readManifest().currentStageId, "hostStrategy-1");
  const dispatch = fixture.run("next");
  assert.equal(dispatch.dispatchRequest.stage, "hostStrategy");
  const inventoryFile = path.join(fixture.migration, "host-page-inventory.json");
  const baseline = {
    schema: "host-productive-baseline/v1", derivationSource: "host-scan",
    hostPageInventorySha256: crypto.createHash("sha256").update(fs.readFileSync(inventoryFile)).digest("hex"),
    targetPageId: "src/pages/home.vue",
    pages: [{ id: "src/pages/home.vue", sourceFile: "src/pages/home.vue", userFacing: true, primaryTask: "search decks", primaryAction: "search", pageType: "utility-list", repeatFrequency: "frequent", firstActionUrgency: "high", expressiveCapacity: "medium", heroEligibility: { eligible: true, reason: "bounded entry" }, productiveRequirements: { coreEntry: "search", businessObjectsVisible: ["deck results"], aboveFoldPriority: "search then results", warmReturnState: "settled" } }],
  };
  fixture.recordCurrent("/root/full-host-strategist", [fixture.writeOutput("host-productive-baseline.json", JSON.stringify(baseline)), fixture.writeOutput("host-opportunity-map.json"), fixture.writeOutput("structural-targets.json")]);
  assert.equal(fixture.readManifest().currentStageId, "hostImplementation-1");
}

// Direction generation stops before runtime mutation or implementation dispatch.
{
  const fixture = createFixture("design-host", "two-direction-goal");
  fixture.mutateOutput("goal-contract.json", JSON.stringify({ sealed: true, mode: "design-host", executionProfile: "fast", goalId: "invalid-two", thresholds: { minimumSelectableDirections: 2, maximumSelectableDirections: 2 } }));
  assert.throws(() => fixture.run("prepare"), /DESIGN_HOST_THREE_DIRECTIONS_REQUIRED/);
}
// H5-first design-host routing has its own focused state-machine regression;
// this file now stays scoped to apply-host behavior.

// Runtime application consumes a frozen design contract and cannot silently
// fall back to Host Strategy or Brand Application.
{
  const fixture = createFixture("apply-host", "apply-fixture");
  for (const name of [
    "brand-application-plan.json",
    "design-direction-options.json",
    "design-direction-decision.json",
    "business-scope.json",
    "design-direction.json",
    "brand-evidence.json",
    "brand-mod.json",
    "preedit-baseline-bundle.json",
    "structural-targets.json",
  ]) fixture.writeOutput(name);

  const prepared = fixture.run("prepare");
  assert.match(prepared.next, /hostStrategy/);
  let manifest = fixture.readManifest();
  assert.equal(manifest.mode, "apply-host");
  assert.equal(manifest.executionProfile, "fast");
  assert.equal(manifest.currentStageId, "hostStrategy-1");
  completeApplyHostScan(fixture);

  const implementationDispatch = fixture.run("next");
  assert.ok(implementationDispatch.dispatchRequest.scopeRules.some((item) => item.includes("frozen design direction")));
  assert.ok(implementationDispatch.dispatchRequest.requiredInputs.some((item) => item.path.endsWith("design-direction-decision.json")));
  assert.equal(implementationDispatch.dispatchRequest.contextPolicy.strategy, "minimum-role-packet");
  assert.ok(implementationDispatch.dispatchRequest.contextPolicy.forbiddenBulkReads.some((item) => item.endsWith("workflow-contract.json")));
  fixture.recordCurrent("/root/host-implementation", fixture.writeOutput("host-rendered-proof.json", "rendered host"));
  manifest = fixture.readManifest();
  assert.equal(manifest.currentStageId, "previewQA-1");

  const previewDispatch = fixture.run("next").dispatchRequest;
  assert.equal(previewDispatch.acceptanceScope, "implementation-preview-only");
  assert.equal(previewDispatch.acceptanceContractVersion, "host-preview-smoke/v1");
  assert.deepEqual(previewDispatch.expectedOutputs, ["preview-smoke-report.json"]);
  assert.equal(previewDispatch.tasks.includes("score the fixed fidelity rubric"), false);
  assert.equal(previewDispatch.requirements.includes("Evidence Fidelity, Structural Fidelity, and Generative Proof each pass"), false);
  fixture.recordCurrent("/root/host-preview-qa", fixture.writeOutput("preview-smoke-report.json", "preview qa"));
  manifest = fixture.readManifest();
  assert.equal(manifest.status, "awaiting-user");
  assert.equal(manifest.previewDecision.status, "pending");
  assert.ok(Number.isFinite(manifest.timeToFirstPreviewMs));

  const approved = fixture.run("approve-preview", "--decision", "approve");
  assert.equal(approved.nextStageId, null);
  assert.equal(approved.status, "passed");
  assert.equal(approved.qaReuse.status, "reused");
  manifest = fixture.readManifest();
  assert.equal(manifest.status, "passed");
  assert.equal(manifest.stages.filter((item) => item.role === "visualQA").length, 1);
  assert.equal(manifest.stages.some((item) => ["brandApplication", "evidence", "interpreter", "demo"].includes(item.stage)), false);
  assert.equal(manifest.stages.some((item) => item.stage === "hostStrategy"), true);

  const finalized = fixture.run("finalize");
  assert.equal(finalized.status, "complete");
  assert.equal(fixture.readManifest().status, "complete");
}

// A changed implementation/QA artifact invalidates fast QA reuse and routes to
// a fresh scoped Visual QA instead of trusting a stale receipt.
{
  const fixture = createFixture("apply-host", "changed-preview-fixture");
  for (const name of [
    "brand-application-plan.json",
    "design-direction-options.json",
    "design-direction-decision.json",
    "business-scope.json",
    "design-direction.json",
    "brand-evidence.json",
    "brand-mod.json",
    "preedit-baseline-bundle.json",
    "structural-targets.json",
  ]) fixture.writeOutput(name);

  fixture.run("prepare");
  completeApplyHostScan(fixture);
  fixture.run("next");
  fixture.recordCurrent("/root/changed-host-implementation", fixture.writeOutput("host-rendered-proof.json", "rendered host v1"));
  fixture.run("next");
  fixture.recordCurrent("/root/changed-host-preview-qa", fixture.writeOutput("preview-smoke-report.json", "preview qa v1"));
  fixture.mutateOutput("host-rendered-proof.json", "rendered host changed after smoke QA");

  const approved = fixture.run("approve-preview", "--decision", "approve");
  assert.equal(approved.qaReuse, null);
  assert.equal(approved.status, "running");
  assert.equal(approved.nextStageId, "visualQA-1");
  assert.equal(fixture.readManifest().stages.filter((item) => item.role === "visualQA").length, 2);
}

// Standard/certification profiles always retain independent post-approval QA,
// even when every frozen artifact is unchanged.
{
  const fixture = createFixture("apply-host", "standard-preview-fixture", "standard");
  for (const name of [
    "brand-application-plan.json",
    "design-direction-options.json",
    "design-direction-decision.json",
    "business-scope.json",
    "design-direction.json",
    "brand-evidence.json",
    "brand-mod.json",
    "preedit-baseline-bundle.json",
    "structural-targets.json",
  ]) fixture.writeOutput(name);
  fixture.run("prepare");
  completeApplyHostScan(fixture);
  fixture.run("next");
  fixture.recordCurrent("/root/standard-host-implementation", fixture.writeOutput("host-rendered-proof.json", "standard rendered host"));
  fixture.run("next");
  fixture.recordCurrent("/root/standard-host-preview-qa", fixture.writeOutput("preview-smoke-report.json", "standard preview qa"));
  const approved = fixture.run("approve-preview", "--decision", "approve");
  assert.equal(approved.qaReuse, null);
  assert.equal(approved.status, "running");
  assert.equal(approved.nextStageId, "visualQA-1");
  const certification = fixture.run("next").dispatchRequest;
  assert.ok(certification.tasks.includes("score the fixed fidelity rubric"));
  assert.ok(certification.requirements.includes("Evidence Fidelity, Structural Fidelity, and Generative Proof each pass"));
}

process.stdout.write("brand design-host/apply-host split routing regression passed\n");
