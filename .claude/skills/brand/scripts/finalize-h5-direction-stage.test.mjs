#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { finalizeH5DirectionStage, normalizeSystemRef, collectSystemRefs, adaptDeclaredDirectionContract, validateAssetUsageMarker, validateDirectionInputPath } from "./finalize-h5-direction-stage.mjs";
import { validateBrandRenderKit } from "./validate-brand-render-kit.mjs";
import { validateDesignHostRoute } from "./validate-design-host-route.mjs";

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert.equal(normalizeSystemRef("expressiveBudget", new Set(["layoutRules.expressiveBudget"])), "layoutRules.expressiveBudget");
assert.equal(normalizeSystemRef("expressiveBudget", new Set(["layoutRules.expressiveBudget", "tokens.expressiveBudget"])), "expressiveBudget");
const pointerRefs = collectSystemRefs({}, { componentVariants: [{ id: "source-readable-rounded-type", status: "approved" }, { id: "excluded", status: "rejected" }], assets: [{ id: "source-hero-ensemble", status: "approved" }] });
assert.equal(normalizeSystemRef("componentVariants.0", pointerRefs), "componentVariants.0");
assert.equal(pointerRefs.has("componentVariants.0"), true);
assert.equal(pointerRefs.has("componentVariants.1"), false);
assert.equal(pointerRefs.has("componentVariants.99"), false);
assert.equal(pointerRefs.has("assets.0"), true);
const editorialAsset = { id: "shape-language", role: "section-background", targetScope: "editorial learning explanation" };
assert.equal(validateAssetUsageMarker('<img data-brand-asset-ref="shape-language" data-brand-asset-placement="editorial-support" data-brand-asset-salience="supporting">', "editorial", { id: "shape", assetRef: "shape-language", assetPlacement: "editorial-support", assetSalience: "supporting" }, editorialAsset).ok, true);
const inferredMechanism = { id: "shape-inferred", assetRef: "shape-language" };
assert.equal(validateAssetUsageMarker('<img data-brand-asset-ref="shape-language" data-brand-asset-placement="editorial-support" data-brand-asset-salience="supporting">', "editorial", inferredMechanism, editorialAsset).ok, true);
assert.equal(inferredMechanism.assetPlacement, "editorial-support");
assert.equal(inferredMechanism.assetSalience, "supporting");
assert.throws(() => validateAssetUsageMarker('<img data-brand-asset-ref="shape-language" data-brand-asset-placement="identity-hero" data-brand-asset-salience="primary">', "editorial", { id: "shape", assetRef: "shape-language", assetPlacement: "identity-hero", assetSalience: "primary" }, editorialAsset), /BRAND_ASSET_ROLE_SALIENCE_MISMATCH/);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "finalize-h5-direction-"));
{
  const tokenTarget='--style-primary-action',source=`tokens.styleOnly.${tokenTarget}`;
  const ext={'echo.brand.target':tokenTarget,'echo.brand.channel':'styleOnly','echo.brand.scope':'local primary action button','echo.brand.allowedRoles':['action.primary.background'],'echo.brand.recipeId':'source-primary-action','echo.brand.evidenceRefs':['action-default']};
  const mod={manifest:{scope:{kind:'source-scoped-style-trial'}},tokens:{mapped:{},styleOnly:{[tokenTarget]:'#58cc02'},dtcg:{action:{$type:'color',$value:'#58cc02',$extensions:ext}}},componentVariants:[{id:'source-primary-action',status:'approved'}]};
  const application={value:'#58cc02',source,semanticRole:'action.primary.background',recipeId:'source-primary-action',selector:'#local-action',evidenceRefs:['action-default']};
  const apply=(change={},modChange=mod,html='<html><body><h1>Search</h1><button id="local-action">Go</button><section>Results</section></body></html>')=>adaptDeclaredDirectionContract({source:html,metadata:{id:'scoped',semanticColorApplications:[{...application,...change}]}},{brandMod:modChange,evidenceClaims:new Map([['action-default',{}]])});
  assert.equal(apply().metadata.semanticColorApplications[0].recipeId,'source-primary-action');
  assert.throws(()=>apply({semanticRole:'surface.page',selector:'body'}),/H5_SCOPED_COLOR_ROLE_FORBIDDEN/);
  assert.throws(()=>apply({scope:'entire-host-page'}),/H5_SCOPED_COLOR_ROLE_FORBIDDEN/);
  const broadRole=structuredClone(mod);broadRole.tokens.dtcg.action.$extensions['echo.brand.allowedRoles'].push('surface.page');assert.throws(()=>apply({semanticRole:'surface.page'},broadRole),/H5_SCOPED_COLOR_ROLE_FORBIDDEN/);
  for(const selector of ['body','html',':root','*','#app','#missing']) assert.throws(()=>apply({selector}),/H5_SCOPED_COLOR_SELECTOR_UNVERIFIED/);
  assert.throws(()=>apply({recipeId:'other'}),/H5_SCOPED_COLOR_RECIPE_UNBOUND/);
  assert.throws(()=>apply({evidenceRefs:['unrelated']}),/H5_SCOPED_COLOR_EVIDENCE_UNBOUND/);
  for(const scope of ['global','entire-host-page','all-pages','sitewide']) {const invalid=structuredClone(mod);invalid.tokens.dtcg.action.$extensions['echo.brand.scope']=scope;assert.throws(()=>apply({},invalid),/H5_SCOPED_COLOR_SCOPE_INVALID/);}
  assert.throws(()=>apply({},mod,'<html><body><div id="local-action"><button>Go</button><section>Results</section></div></body></html>'),/H5_SCOPED_COLOR_SELECTOR_WHOLE_PAGE/);
  assert.throws(()=>apply({},mod,'<html><body><main><div id="local-action"><button>Go</button><section>Results</section></div></main></body></html>'),/H5_SCOPED_COLOR_SELECTOR_WHOLE_PAGE/);
  assert.throws(()=>apply({},mod,'<button id="local-action">One</button><button id="local-action">Two</button>'),/H5_SCOPED_COLOR_SELECTOR_UNVERIFIED/);
}
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
fs.mkdirSync(path.join(migration, "dispatch"), { recursive: true });
fs.mkdirSync(path.join(migration, "h5-directions"), { recursive: true });
fs.mkdirSync(path.join(root, "host"), { recursive: true });
const hostFile = path.join(root, "host", "home.vue");
fs.writeFileSync(hostFile, "<template><input placeholder='Search'><article v-for='item in items'>{{ item.title }}</article></template>\n");
const hostBefore = sha(hostFile);
const write = (name, value) => {
  const file = path.join(migration, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  return file;
};

try {
  const evidence = { claims: [1, 2, 3].map((n) => ({ id: `evidence:${n}`, sourcePageId: "home" })) };
  const intent = { patterns: [1, 2, 3].map((n) => ({ id: `system:${n}` })) };
  const mod = { tokens: { mapped: { text: "#123456" } }, semanticRoles: { "surface.page": { status: "mapped", value: "#fff" } }, componentVariants: [1, 2, 3].map((n) => ({ id: `system:${n}`, status: "approved" })), assets: [] };
  const evidenceFile = write("brand-evidence.json", evidence);
  const intentFile = write("brand-intent.json", intent);
  const modFile = write("brand-mod.json", mod);
  const goalFile = write("goal-contract.json", { sealed: true, mode: "design-host", executionProfile: "fast", goalId: "fixture" });
  const startupFile = write("host-startup-page.json", { schema: "host-startup-page/v1", scope: "startup-page-only", route: "/", sourceFile: "host/home.vue", sourceSha256: hostBefore });
  const startupSha = sha(startupFile);
  const baselineFile = write("host-startup-baseline.json", {
    schema: "host-startup-baseline/v1",
    hostStartupPageSha256: startupSha,
    primaryTask: "search and compare items",
    primaryAction: "search",
    resultContentContract: { mode: "host-schema", fields: ["title", "preview", "metadata"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
    informationDistributionContract: { model: "search-filter-list", previewUnit: { requiredDecisionFields: ["title"] }, scanOrder: ["search", "results"], comparisonBehavior: "compare visible result fields before opening details" },
    resultHierarchyContract: { derivationSource: "startup-page-source-analysis", defaultRelationship: "peer", differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"] },
    expressiveOpportunity: { maxFirstViewportRatio: 0.2 },
    communicationIntent: { framework: "hierarchy-utility-style/v1", hierarchy: { primaryAttention: "search", informativeContent: ["title", "preview", "metadata"], efficiencyConstraint: "search and results remain discoverable" }, utility: { mainFunction: "search and compare items", obviousAction: "search", conventionConstraint: "preserve search filter list" }, style: { sourceConstraint: "derive attributes from frozen brand evidence", evaluationMode: "first-impression-comparison-after-product-safety-pass" } },
  });
  const baselineSha = sha(baselineFile);
  const knowledgeRoot = path.join(root, "knowledge-root");
  fs.mkdirSync(knowledgeRoot);
  const bound = (name) => { const file = path.join(knowledgeRoot, name); fs.writeFileSync(file, `${name}\n`); return { path: name, sha256: sha(file) }; };
  const catalog = bound("catalog.json");
  const questionIds = ["expressive-productive-allocation-question", "host-generation-choice", "host-generation-brief", "host-reconstruction-risk", "host-content-scene-integration", "visual-authority"];
  const refs = [...questionIds.map((id) => `question:${id}`), "method:allocation"];
  const entries = refs.map((ref, index) => {
    const record = bound(`record-${index}.json`);
    const guide = bound(`guide-${index}.md`);
    const [kind, id] = ref.split(":");
    return { ref, kind, id, recordPath: record.path, recordSha256: record.sha256, guidePath: guide.path, guideSha256: guide.sha256 };
  });
  const knowledge = {
    schema: "design-knowledge-bundle/v1",
    stage: "design-host",
    generatedBy: "query-design-knowledge.mjs",
    hostContext: { baselineSha256: baselineSha, primaryTask: "search and compare items", primaryAction: "search", productiveFloor: { coreEntry: "search" }, resultHierarchyContract: { defaultRelationship: "peer", differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: ["featured-result"] }, hostContentContract: { userInputRequired: false }, expressiveOpportunity: { maxFirstViewportRatio: 0.2 } },
    questions: questionIds.map((id) => ({ id, items: ["fixture"] })),
    catalog: { path: catalog.path, sha256: catalog.sha256 },
    entries,
  };
  const knowledgeFile = write("design-knowledge-bundle.json", knowledge);
  const knowledgeSha = sha(knowledgeFile);
  const packetFile = write("source-transfer-inputs/attempt/evidence-packet.json", { producerExecutionId: "/root/source-producer", claims: [{ id: "observed-type", status: "observed" }] });
  const captureFile = write("source-transfer-inputs/attempt/capture.txt", "capture bytes");
  const transferReview = { schema: "source-system-transfer/v1", brand, status: "independently-reviewed-bounded-candidate", scope: "isolated host trial only", reviewer: { identity: "/root/source-reviewer", independentOfEvidenceProducer: true, independentOfH5Producer: true }, reviewInputs: [{ path: "evidence-packet.json", sha256: sha(packetFile) }, { path: "capture.txt", sha256: sha(captureFile) }], consumption: { automatic: false }, preservation: { fullCertificationGranted: false, hostImplementationApproved: false }, rules: [{ id: "transfer.type", status: "permitted-bounded-candidate", scope: "supporting task heading", evidenceRefs: ["observed-type"], notFor: ["global type tokens"] }], permittedRuleIds: ["transfer.type"], excludedRuleIds: [] };
  const transferFile = write("source-transfer-inputs/attempt/transfer-reviewed.json", transferReview);
  const sourceTransfer = { review: { path: path.relative(root, transferFile), sha256: sha(transferFile) } };
  write("design-host-route.json", {
    schema: "design-host-route/v3",
    sequence: "h5-design-system-first",
    knowledgeDecision: { status: "ready", path: `migrations/${brand}/design-knowledge-bundle.json`, sha256: knowledgeSha, hostStartupBaselineSha256: baselineSha },
    h5Directions: { status: "pending", directions: [] },
  });

  const mechanisms = ["bold-type-rhythm", "raised-tactile-control", "spatial-entry-flow"].map((type, index) => ({ id: `${type}-rule`, type, evidenceRef: `evidence:${index + 1}`, sourcePageRef: "home", systemRef: `componentVariants.${index}`, visibleEffect: `${type} visibly shapes the first viewport`, visibleApplication: `${type} continues through the productive result area` }));
  const signatures = [
    { compositionRoles: ["navigation-shell", "identity-environment", "business-stream"], contentEntry: "layered-entry", resultContainer: "stacked-results", visualCenter: "central-stage", primaryActionPlacement: "upper-inline", resultPresentation: "dense-list" },
    { compositionRoles: ["navigation-shell", "task-bridge", "business-stream"], contentEntry: "rail-entry", resultContainer: "framed-results", visualCenter: "diagonal-bridge", primaryActionPlacement: "side-anchor", resultPresentation: "split-list" },
    { compositionRoles: ["featured-content", "navigation-shell", "business-stream"], contentEntry: "direct-entry", resultContainer: "editorial-results", visualCenter: "orbit-field", primaryActionPlacement: "top-anchor", resultPresentation: "paced-list" },
  ];
  const htmlFiles = signatures.map((structuralSignature, index) => {
    const id = ["a", "b", "c"][index];
    const metadata = { id, title: `Direction ${id.toUpperCase()} world`, brandMechanisms: mechanisms.map((item) => ({ ...item, id: `${id}-${item.id}` })), structuralSignature: index === 0 ? `unique descriptive structure ${id}` : structuralSignature, interactionRhythm: index === 0 ? `unique descriptive rhythm ${id}` : { peak: `peak state ${id}`, settled: `settled state ${id}`, carryThrough: `continuous rhythm ${id}` }, communicationHypothesis: { hierarchy: { attentionTarget: index === 0 ? "搜索牌组" : `search and result target ${id}`, informationGain: index === 0 ? "可见筛选与比较字段" : `visible comparison fields ${id}` }, utility: { mainFunction: index === 0 ? "搜索、筛选并比较牌组" : `search and compare items ${id}`, obviousAction: index === 0 ? "搜索牌组" : `search action remains obvious ${id}`, preservedConvention: `search filter list convention ${id}` }, style: { targetAttributes: ["friendly", "energetic"], sourceBasis: `brand evidence mechanisms ${id}`, mechanismThesis: `distinct source-backed visual thesis ${id}` } }, knowledgeRefs: ["method:allocation"], resultHierarchyFit: { relationship: "peer", preservesHostHierarchy: true, unsupportedDifferentiationForbidden: true, resultSpecificEmphasis: "none", evidenceRefs: [] } };
    metadata.compositionSequence = structuralSignature.compositionRoles;
    metadata.visualProgram = { compositionSequence: structuralSignature.compositionRoles };
    metadata.semanticColorApplications = [{ value: "#123456", color: "#123456", source: "tokens.mapped.text" }];
    metadata.productionFormula = { productive: { brandModSha256: sha(modFile), patternBindings: [{ patternId: "system:1", systemRef: "componentVariants.0" }] } };
    const roles = structuralSignature.compositionRoles.map((role) => `<section data-composition-role="${role}" data-brand-moment="${role === "business-stream" ? "productive" : "expressive"}" data-host-job="search" data-brand-source="evidence:1" data-brand-mechanisms="typography"${role === "business-stream" ? ` data-content-entry="${structuralSignature.contentEntry}" data-result-container="${structuralSignature.resultContainer}" data-result-hierarchy="peer"` : ""}></section>`).join("");
    metadata.transferRuleApplications = [{ ruleId: "transfer.type", ruleScope: "supporting task heading", region: "task heading", selector: `#transfer-${id}`, sourceReviewSha256: sourceTransfer.review.sha256, evidenceRefs: ["observed-type"], hostReason: "Retain readable host task heading above real peer results" }];
    return write(`h5-directions/direction-${id}.html`, `<!doctype html><html><body><main id="transfer-${id}" data-result-hierarchy="peer">${roles}</main><script type="application/json" data-brand-direction>${JSON.stringify(metadata)}</script></body></html>\n`);
  });
  const requiredInputs = [goalFile, evidenceFile, intentFile, modFile, startupFile, baselineFile, knowledgeFile, transferFile, packetFile, captureFile].map((file) => ({ path: path.relative(root, file), sha256: sha(file) }));
  const dispatchFile = write("dispatch/h5DirectionGeneration-1.json", { schema: "brand-subagent-dispatch/v1", dispatchId: "dispatch-1", goalSha256: sha(goalFile), stageId: "h5DirectionGeneration-1", stage: "h5DirectionGeneration", role: "brandApplicationDesigner", requiredInputs, sourceTransfer });

  const result = finalizeH5DirectionStage({ root, brand, dispatchFile, htmlFiles, producerExecutionId: "/root/h5-producer" });
  assert.equal(result.ok, true);
  assert.match(result.recordCommand, /brand-subagent-workflow\.mjs record/);
  assert.equal(sha(hostFile), hostBefore, "the host source must remain byte-identical");
  const receipt = JSON.parse(fs.readFileSync(path.join(root, result.receipt), "utf8"));
  assert.deepEqual(receipt.inputs, requiredInputs);
  assert.equal(receipt.outputs.length, 7);
  assert.equal(receipt.producerPolicy.imageGenerationCalls, 0);
  for (const output of receipt.outputs) assert.equal(sha(path.join(root, output.path)), output.sha256);

  const kit = JSON.parse(fs.readFileSync(path.join(migration, "brand-render-kit.json"), "utf8"));
  assert.equal(validateBrandRenderKit(kit, { evidence, brandIntent: intent, brandMod: mod, brandModSha256: sha(modFile) }).ok, true);
  const route = JSON.parse(fs.readFileSync(path.join(migration, "design-host-route.json"), "utf8"));
  assert.equal(validateDesignHostRoute(route, "before-h5-qa", { bundle: knowledge, bundleSha256: knowledgeSha, knowledgeRoot }).ok, true);
  assert.equal(route.h5Directions.directions.length, 3);
  assert.equal(route.h5Directions.directions[0].realDataBinding.informationDistributionContract.model, "search-filter-list");
  const plan = JSON.parse(fs.readFileSync(path.join(migration, "brand-application-plan.json"), "utf8"));
  assert.equal(plan.options[0].semanticColorApplications[0].renderedValue, "#123456");
  assert.equal(plan.options[0].productionFormula.productive.brandModSha256, sha(modFile));
  assert.deepEqual(plan.options[0].visualProgram.compositionSequence, plan.options[0].compositionRoles.map((item) => item.role));
  const finalizedExpressive = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/validate-design-host-expressive-h5.mjs"), "--plan", path.join(migration, "brand-application-plan.json")], { encoding: "utf8" });
  assert.equal(finalizedExpressive.status, 0, finalizedExpressive.stdout || finalizedExpressive.stderr);
  const expressivePlan = { options: ["a", "b", "c"].map((id, index) => {
    const roles = index === 1 ? ["identity-environment", "business-stream"] : ["task-bridge", "business-stream"];
    const source = `<style>.task{color:#123456}</style>` + roles.map((role) => `<section data-composition-role="${role}" data-brand-moment="${role === "business-stream" ? "productive" : "expressive"}" data-host-job="search" data-brand-source="evidence:1" data-brand-mechanisms="typography" data-content-entry="entry-${id}" data-result-container="result-${id}"></section>`).join("");
    const metadata = { id, compositionSequence: roles, semanticColorApplications: [{ value: "#123456", color: "#123456", source: "tokens.mapped.text" }], visualProgram: { compositionSequence: roles } };
    adaptDeclaredDirectionContract({ source, metadata }, { evidenceClaims: new Map([["evidence:1", {}]]), brandMod: { tokens: { mapped: { text: "#123456" } } }, supportedIds: ["tokens.mapped.text"] });
    const file = write(`integration-${id}.html`, source);
    return { ...metadata, previewEvidence: { path: path.basename(file) } };
  }) };
  const integrationPlan = write("integration-plan.json", expressivePlan);
  const expressiveCheck = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/validate-design-host-expressive-h5.mjs"), "--plan", integrationPlan], { encoding: "utf8" });
  const expressiveFailures = JSON.parse(expressiveCheck.stdout).failures;
  assert.equal(expressiveCheck.status, 1);
  assert.ok(expressiveFailures.some((item) => item.code === "H5_DIRECTION_GRAMMAR_TOO_SIMILAR" && item.options.includes("a") && item.options.includes("c")));
  assert.ok(!expressiveFailures.some((item) => /SOURCE_UNBOUND|COLOR_PROVENANCE|ROLE_DRIFT/.test(item.code)));
  assert.throws(() => adaptDeclaredDirectionContract({ source: '<section data-brand-source="invented">', metadata: { id: "bad" } }, { evidenceClaims: new Map(), brandMod: {} }), /H5_MOMENT_SOURCE_UNKNOWN/);
  assert.throws(() => adaptDeclaredDirectionContract({ source: "", metadata: { id: "bad", semanticColorApplications: [{ value: "#123456", source: "tokens.mapped.invented" }] } }, { evidenceClaims: new Map(), brandMod: {} }), /H5_COLOR_SOURCE_UNBOUND/);
  assert.equal(plan.options[0].informationDistributionFit.model, "search-filter-list");
  assert.equal(plan.options[0].resultHierarchyFit.relationship, "peer");
  assert.equal(plan.options[0].communicationHypothesis.hierarchy.attentionTarget, "搜索牌组");
  const options = JSON.parse(fs.readFileSync(path.join(migration, "design-direction-options.json"), "utf8"));
  assert.equal(options.recommendation.status, "pending-independent-h5-qa");
  assert.ok(options.options.every((item) => item.recommended === false));
  const planValidation = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/validate-brand-application-plan.mjs"), "--plan", path.join(migration, "brand-application-plan.json")], { encoding: "utf8" });
  assert.equal(planValidation.status, 0, planValidation.stdout || planValidation.stderr);
  const optionsValidation = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/validate-wild-design-decision.mjs"), "--options", path.join(migration, "design-direction-options.json"), "--options-only", "--brand-evidence", evidenceFile, "--brand-mod", modFile], { encoding: "utf8" });
  assert.equal(optionsValidation.status, 0, optionsValidation.stdout || optionsValidation.stderr);

  assert.throws(() => finalizeH5DirectionStage({ root, brand, dispatchFile, htmlFiles: htmlFiles.slice(0, 2), producerExecutionId: "/root/h5-producer" }), /EXACTLY_THREE_H5_FILES_REQUIRED/);
  const outside = path.join(root, "outside.html");
  fs.writeFileSync(outside, "<script type='application/json' data-brand-direction>{}</script>");
  assert.throws(() => finalizeH5DirectionStage({ root, brand, dispatchFile, htmlFiles: [outside, htmlFiles[1], htmlFiles[2]], producerExecutionId: "/root/h5-producer" }), /H5_OUTSIDE_ARTIFACT_MIGRATION/);

  const duplicate = JSON.parse(fs.readFileSync(htmlFiles[2], "utf8").match(/data-brand-direction>([\s\S]*?)<\/script>/)[1]);
  duplicate.structuralSignature = "unique descriptive structure a";
  fs.writeFileSync(htmlFiles[2], fs.readFileSync(htmlFiles[2], "utf8").replace(/data-brand-direction>[\s\S]*?<\/script>/, `data-brand-direction>${JSON.stringify(duplicate)}</script>`));
  assert.throws(() => finalizeH5DirectionStage({ root, brand, dispatchFile, htmlFiles, producerExecutionId: "/root/h5-producer" }), /STRUCTURAL_SIGNATURES_MUST_BE_UNIQUE/);
  const parent = path.join(root, 'parent');
  fs.mkdirSync(parent);
  fs.writeFileSync(path.join(parent, 'handoff.json'), '{}');
  fs.writeFileSync(path.join(parent, 'manifest.json'), '{}');
  const ref = (base, file) => ({ path: path.relative(base, file), sha256: sha(file) });
  const readiness = { parentHandoff: ref(parent, path.join(parent, 'handoff.json')), learningManifest: ref(parent, path.join(parent, 'manifest.json')), inputs: [], allowedUse: { supportedIds: ['assets.0'] } };
  const readinessFile = write('preview-readiness.json', readiness);
  const continuationFile = path.join(root, 'source-continuation.json');
  fs.writeFileSync(continuationFile, JSON.stringify({ continuationScope: 'macro-host-journey', learningComplete: false, parentArtifactRoot: parent, previewReadiness: ref(root, readinessFile), partialBrandValidation: readiness, inputs: [ref(root, readinessFile)] }));
  const rootInput = ref(root, continuationFile);
  const scopeDispatch = { stageId: 'h5DirectionGeneration-1', dispatchId: 'frozen', requiredInputs: [rootInput, ref(root, readinessFile)] };
  write('execution-manifest.json', { previewContinuation: { continuation: rootInput, readiness: ref(root, readinessFile) }, stages: [{ id: scopeDispatch.stageId, dispatchId: scopeDispatch.dispatchId, dispatchPath: path.relative(root, dispatchFile), status: 'dispatched' }] });
  const check = (input = rootInput) => validateDirectionInputPath({ workspace: root, migration, dispatch: scopeDispatch, dispatchPath: dispatchFile, input });
  assert.equal(check(), continuationFile);
  const assetMod = { ...mod, assets: [{ id: 'permitted' }, { id: 'excluded' }] };
  const singleIdentityKit = structuredClone(kit);
  singleIdentityKit.directions.forEach((item) => { item.identityAssetIds = ['permitted']; });
  const kitContext = { evidence, brandIntent: intent, brandMod: assetMod, brandModSha256: kit.brandSystemSha256 };
  assert.equal(validateBrandRenderKit(singleIdentityKit, kitContext).ok, true);
  assert.equal(validateBrandRenderKit(singleIdentityKit, { ...kitContext, workspaceRoot: root, brand }).ok, true);
  const excludedIdentityKit = structuredClone(singleIdentityKit);
  excludedIdentityKit.directions[0].identityAssetIds = ['excluded'];
  assert.ok(validateBrandRenderKit(excludedIdentityKit, { ...kitContext, workspaceRoot: root, brand }).errors.includes('BRAND_RENDER_KIT_DIRECTION_IDENTITY_ASSETS_INVALID'));
  singleIdentityKit.expressive.mechanisms = singleIdentityKit.expressive.mechanisms.slice(0, 2);
  assert.ok(validateBrandRenderKit(singleIdentityKit, { ...kitContext, workspaceRoot: root, brand }).errors.includes('BRAND_RENDER_KIT_EXPRESSIVE_INCOMPLETE'));
  assert.throws(() => check({ ...rootInput, sha256: 'a'.repeat(64) }), /INPUT_OUTSIDE_ARTIFACT_MIGRATION/);
  assert.throws(() => check({ path: 'outside.html', sha256: sha(outside) }), /INPUT_OUTSIDE_ARTIFACT_MIGRATION/);
  fs.renameSync(continuationFile, path.join(root, 'continuation-real.json'));
  fs.symlinkSync(path.join(root, 'continuation-real.json'), continuationFile);
  assert.throws(() => check(), /INPUT_OUTSIDE_ARTIFACT_MIGRATION/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("finalize H5 direction stage tests passed\n");
