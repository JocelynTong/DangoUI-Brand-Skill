#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateExpressiveGeometryLock } from "./validate-expressive-geometry-lock.mjs";
import { validateLocalSelectedMaster } from "./selected-h5-handoff.mjs";
import { selectedPosteditContext, selectedPosteditCliOptions } from "./selected-h5-postedit-context.mjs";

const orderedStages = ["initialization", "before-concept-dispatch", "after-concept-generation", "before-h5-dispatch", "before-h5-qa", "before-final-selection", "before-apply-host"];
const h5FirstStages = ["initialization", "before-h5-direction-dispatch", "before-h5-qa", "after-h5-qa", "before-expressive-dispatch", "after-expressive-generation", "before-expressive-qa", "before-final-selection", "before-apply-host"];

export function validateDesignHostRoute(route, stage = "before-concept-dispatch", knowledge = {}) {
  if (stage === "before-apply-host" && route?.localSelectedMaster) {
    const brand = route.localSelectedMaster.path?.match(/^migrations\/([\w-]+)\/approved-master\.json$/)?.[1];
    if (!brand || !knowledge.workspaceRoot || !validArtifact(route.localSelectedMaster, knowledge.workspaceRoot) || route.sourceLearningCertified !== false || route.publicDistributionAuthorized !== false) return { ok: false, errors: ["SELECTED_H5_ROUTE_BINDING_INVALID"], stage };
    let context; try { context=selectedPosteditContext(knowledge.workspaceRoot,brand,knowledge.selectedHostOptions); } catch(error) { return {ok:false,errors:[error.message]}; }
    const result = validateLocalSelectedMaster(knowledge.workspaceRoot, brand,context);
    return { ...result, errors: result.errors || [], stage, sequence: route.sequence };
  }
  if (route?.sequence === "h5-design-system-first") return validateH5FirstRoute(route, stage, knowledge);
  const errors = [];
  const fail = (code) => errors.push(code);
  const at = (name) => orderedStages.indexOf(stage) >= orderedStages.indexOf(name);
  if (!orderedStages.includes(stage)) fail("DESIGN_HOST_ROUTE_STAGE_INVALID");
  if (route?.schema !== "design-host-route/v2") fail("DESIGN_HOST_ROUTE_SCHEMA_INVALID");
  if (route?.sequence !== "image-demo-first") fail("DESIGN_HOST_SEQUENCE_INVALID");
  const capability = route?.imageCapability?.status;
  if (!["required", "available", "unavailable"].includes(capability)) fail("IMAGE_CAPABILITY_STATE_INVALID");
  if (capability === "unavailable") fail("IMAGE_GENERATION_CAPABILITY_REQUIRED");
  const images = route?.demoImages || {};
  const producer = images.producer || {};
  const imageReview = route?.demoVisualReview || {};
  const userReview = route?.userDirectionReview || {};
  const h5 = route?.h5Reconstruction || {};
  const h5Qa = route?.h5QA || {};
  const finalSelection = route?.finalSelection || {};
  const knowledgeBinding = route?.knowledgeDecision || {};
  const identityAssets = route?.brandIdentityAssets || {};
  const officialIdentityAssetIds = new Set(Array.isArray(identityAssets.assets) ? identityAssets.assets.map((item) => item?.id).filter(Boolean) : []);
  const bundle = knowledge.bundle || null;
  const bundleValidation = bundle ? validateKnowledgeBundle(bundle, knowledge) : { errors: ["DESIGN_KNOWLEDGE_BUNDLE_REQUIRED"], refs: new Set(), questionIds: new Set() };
  if (at("before-concept-dispatch")) {
    if (identityAssets.status !== "ready" || !identityAssets.brandModSha256 || officialIdentityAssetIds.size < 1) fail("BRAND_IDENTITY_ASSET_REQUIRED");
    if ((identityAssets.assets || []).some((asset) => !asset?.localPath || !/^[a-f0-9]{64}$/i.test(asset?.sha256 || ""))) fail("BRAND_IDENTITY_ASSET_BINDING_INVALID");
    if (knowledgeBinding.status !== "ready" || !knowledgeBinding.path || !knowledgeBinding.sha256 || !knowledgeBinding.hostStartupBaselineSha256) fail("DESIGN_KNOWLEDGE_BINDING_REQUIRED");
    if (!bundle) fail("DESIGN_KNOWLEDGE_BUNDLE_REQUIRED");
    else {
      for (const error of bundleValidation.errors) fail(error);
      if (knowledge.bundleSha256 !== knowledgeBinding.sha256) fail("DESIGN_KNOWLEDGE_BUNDLE_HASH_MISMATCH");
      if (bundle.hostContext?.baselineSha256 !== knowledgeBinding.hostStartupBaselineSha256) fail("DESIGN_KNOWLEDGE_HOST_BASELINE_MISMATCH");
      const boundQuestions = Array.isArray(knowledgeBinding.questionRefs) ? [...knowledgeBinding.questionRefs].sort() : [];
      const bundleQuestions = [...bundleValidation.questionIds].sort();
      if (JSON.stringify(boundQuestions) !== JSON.stringify(bundleQuestions)) fail("DESIGN_KNOWLEDGE_QUESTION_BINDING_MISMATCH");
    }
  }
  if (at("after-concept-generation")) {
    if (capability !== "available") fail("IMAGE_GENERATION_CAPABILITY_NOT_PROVEN");
    if (images.status !== "ready" || !Array.isArray(images.directions) || images.directions.length !== 3) fail("DEMO_DIRECTION_GROUPS_REQUIRED");
    else for (const direction of images.directions) {
      if (!direction?.id || !validArtifact(direction.pairedStateBoard) || !validArtifact(direction.peakFrame) || !validArtifact(direction.settledFrame)) fail("DEMO_PAIRED_STATES_REQUIRED");
      if (!direction.peakFrame?.region || !direction.settledFrame?.region || direction.peakFrame.region === direction.settledFrame.region) fail("DEMO_PAIRED_STATE_REGIONS_REQUIRED");
      const formula = direction.productionFormula || {};
      if (formula.expressive?.producer !== "image_gen" || formula.expressive?.role !== "generated-proposal" || !formula.expressive?.toolCallId) fail("EXPRESSIVE_IMAGEGEN_PROOF_REQUIRED");
      if (!formula.productive?.brandDesignSystemSha256 || !formula.productive?.hostStartupBaselineSha256) fail("PRODUCTIVE_BRAND_SYSTEM_BINDING_REQUIRED");
      else if (formula.productive.hostStartupBaselineSha256 !== bundle?.hostContext?.baselineSha256) fail("PRODUCTIVE_HOST_BASELINE_HASH_MISMATCH");
      const patternBindings = Array.isArray(formula.productive?.patternBindings) ? formula.productive.patternBindings : [];
      if (!patternBindings.length || patternBindings.some((binding) => !binding?.patternRef || !Array.isArray(binding?.requiredLayersUsed) || !binding.requiredLayersUsed.length || String(binding?.visibleMechanism || "").trim().length < 12)) fail("PRODUCTIVE_PATTERN_BINDING_REQUIRED");
      const expert = formula.expertDecision || {};
      if (!expert.questionRef || !expert.rationale || !Array.isArray(expert.knowledgeRefs) || !expert.knowledgeRefs.length) fail("EXPERT_DECISION_KNOWLEDGE_REQUIRED");
      else {
        if (expert.knowledgeBundleSha256 !== knowledgeBinding.sha256) fail("EXPERT_DECISION_BUNDLE_BINDING_REQUIRED");
        if (!bundleValidation.questionIds.has(expert.questionRef)) fail("EXPERT_DECISION_QUESTION_UNKNOWN");
        if (expert.knowledgeRefs.some((ref) => !bundleValidation.refs.has(ref))) fail("EXPERT_DECISION_REF_UNKNOWN");
        if (String(expert.rationale).trim().length < 24) fail("EXPERT_DECISION_RATIONALE_TOO_SHALLOW");
        const reasons = expert.hostReasons || {};
        if (reasons.primaryTask !== bundle?.hostContext?.primaryTask || reasons.primaryAction !== bundle?.hostContext?.primaryAction) fail("EXPERT_DECISION_HOST_REASON_MISMATCH");
        if (String(reasons.productiveConstraint || "").trim().length < 12 || String(reasons.expressiveConstraint || "").trim().length < 12) fail("EXPERT_DECISION_HOST_CONSTRAINTS_REQUIRED");
      }
      if (formula.identityPolicy?.generatedIdentitySubjectsForbidden !== true || formula.identityPolicy?.officialIdentityAssetsUnmodified !== true) fail("BRAND_IDENTITY_GENERATION_BOUNDARY_REQUIRED");
      if (!Array.isArray(direction.officialIdentityAssetsUsed) || !direction.officialIdentityAssetsUsed.length) fail("BRAND_RECOGNITION_ASSET_REQUIRED");
      else if (direction.officialIdentityAssetsUsed.some((id) => !officialIdentityAssetIds.has(id))) fail("BRAND_RECOGNITION_ASSET_UNKNOWN");
      const integration = direction.identityIntegration || {};
      if (!["direct-reference", "deterministic-composite"].includes(integration.mode)) fail("IDENTITY_INTEGRATION_PROOF_REQUIRED");
      if (Number(integration.referenceAttemptCount || 0) > 1) fail("IDENTITY_REFERENCE_RETRY_FORBIDDEN");
      if (integration.mode === "direct-reference") {
        const roles = Array.isArray(integration.inputRoles) ? integration.inputRoles : [];
        if (integration.referenceAttemptCount !== 1 || !roles.length || roles.some((item) => !officialIdentityAssetIds.has(item?.assetId) || String(item?.role || "").trim().length < 12)) fail("IDENTITY_REFERENCE_ROLE_PROOF_REQUIRED");
      }
      if (integration.mode === "deterministic-composite") {
        if (!validArtifact(direction.expressiveBaseBoard) || integration.officialAssetUnmodified !== true || !integration.geometry || !integration.occlusion || !integration.contactShadow || !integration.environmentLight) fail("IDENTITY_COMPOSITE_INTEGRATION_PROOF_REQUIRED");
      }
      const contract = direction.settledStateContract || {};
      if (contract.primaryActionAvailableFromFirstFrame !== true || contract.productiveContentDominant !== true || contract.coreToolEntryAboveFold !== true || contract.realResultsVisible !== true || contract.warmReturnStartsSettled !== true) fail("SETTLED_PRODUCTIVE_CONTRACT_REQUIRED");
    }
    if (!producer.executionId) fail("DEMO_IMAGE_PRODUCER_REQUIRED");
    if (!Array.isArray(producer.imageToolCalls) || new Set(producer.imageToolCalls).size < 3) fail("DEMO_IMAGE_TOOL_EVIDENCE_REQUIRED");
    else if (images.directions.some((direction) => !producer.imageToolCalls.includes(direction.productionFormula?.expressive?.toolCallId))) fail("DEMO_IMAGE_TOOL_DIRECTION_BINDING_REQUIRED");
  }
  if (at("before-h5-dispatch")) {
    if (imageReview.status !== "pass" || !imageReview.reviewerExecutionId) fail("DEMO_VISUAL_REVIEW_REQUIRED");
    if (imageReview.reviewerExecutionId === producer.executionId) fail("DEMO_VISUAL_REVIEW_NOT_INDEPENDENT");
    if (imageReview.qualityVerdict !== "pass") fail("DEMO_VISUAL_QUALITY_REQUIRED");
    if (["peakExpressiveQuality", "settledProductiveClarity", "stateContinuity", "brandFidelity", "visualFinish", "hostTaskClarity", "expressiveOriginality", "productiveDesignSystemFidelity", "expertDecisionTraceability", "identityIntegrity", "firstGlanceImpact", "peakSettledPerceptualDelta", "identityIntegrationNaturalness", "crossDirectionArtWorldDistance", "informationDistributionFit", "previewabilityAtTargetSize", "expressiveCompositionCoherence", "designReasonVisibility"].some((criterion) => imageReview.criteria?.[criterion] !== "pass")) fail("DEMO_VISUAL_QUALITY_CRITERIA_REQUIRED");
    if (!Array.isArray(imageReview.recommendedDirectionIds) || !imageReview.recommendedDirectionIds.length || imageReview.recommendedDirectionIds.some((id) => !images.directions.some((direction) => direction.id === id))) fail("DEMO_VISUAL_HUMAN_RECOMMENDATION_REQUIRED");
    const directionIds = images.directions.map((item) => item.id);
    if (Array.isArray(userReview.selectedOptionIds) && userReview.selectedOptionIds.some((id) => !directionIds.includes(id))) fail("DEMO_SELECTED_DIRECTION_UNKNOWN");
    if (userReview.status !== "approved" || userReview.selectionSource !== "explicit-user" || !Array.isArray(userReview.selectedOptionIds) || !userReview.selectedOptionIds.length) fail("DEMO_USER_DIRECTION_CONFIRMATION_REQUIRED");
  }
  if (at("before-h5-qa") && (h5.status !== "ready" || !Array.isArray(h5.artifacts) || !h5.artifacts.length)) fail("H5_RECONSTRUCTION_REQUIRED");
  if (at("before-final-selection")) {
    if (h5Qa.status !== "pass" || !h5Qa.reviewerExecutionId) fail("H5_QA_REQUIRED");
    if (h5Qa.reviewerExecutionId === h5.producerExecutionId) fail("H5_QA_NOT_INDEPENDENT");
  }
  if (stage === "before-apply-host" && (finalSelection.status !== "selected" || finalSelection.selectionSource !== "explicit-user" || !finalSelection.selectedOptionId)) fail("FINAL_DIRECTION_SELECTION_REQUIRED");
  return { ok: errors.length === 0, errors, stage, sequence: route?.sequence || "invalid" };
}

function validateH5FirstRoute(route, stage, knowledge) {
  const errors = [];
  const fail = (code) => errors.push(code);
  const at = (name) => h5FirstStages.indexOf(stage) >= h5FirstStages.indexOf(name);
  if (!h5FirstStages.includes(stage)) fail("DESIGN_HOST_ROUTE_STAGE_INVALID");
  if (route?.schema !== "design-host-route/v3") fail("DESIGN_HOST_ROUTE_SCHEMA_INVALID");
  if (route?.sequence !== "h5-design-system-first") fail("DESIGN_HOST_SEQUENCE_INVALID");
  const knowledgeBinding = route?.knowledgeDecision || {};
  const bundle = knowledge.bundle || null;
  const bundleValidation = bundle ? validateKnowledgeBundle(bundle, { ...knowledge, verifySourceFiles: stage === "before-h5-direction-dispatch" }) : { errors: ["DESIGN_KNOWLEDGE_BUNDLE_REQUIRED"], refs: new Set(), questionIds: new Set() };
  if (at("before-h5-direction-dispatch")) {
    if (knowledgeBinding.status !== "ready" || !knowledgeBinding.path || !knowledgeBinding.sha256 || !knowledgeBinding.hostStartupBaselineSha256) fail("DESIGN_KNOWLEDGE_BINDING_REQUIRED");
    if (!bundle) fail("DESIGN_KNOWLEDGE_BUNDLE_REQUIRED");
    else {
      for (const error of bundleValidation.errors) fail(error);
      if (knowledge.bundleSha256 !== knowledgeBinding.sha256) fail("DESIGN_KNOWLEDGE_BUNDLE_HASH_MISMATCH");
      if (bundle.hostContext?.baselineSha256 !== knowledgeBinding.hostStartupBaselineSha256) fail("DESIGN_KNOWLEDGE_HOST_BASELINE_MISMATCH");
    }
  }
  const h5 = route?.h5Directions || {};
  if (at("before-h5-qa")) {
    if (h5.status !== "ready" || !h5.producerExecutionId || !Array.isArray(h5.directions) || h5.directions.length !== 3) fail("THREE_H5_DIRECTIONS_REQUIRED");
    else for (const direction of h5.directions) {
      if (!direction?.id || !validArtifact(direction.artifact, knowledge.workspaceRoot) || direction.realDataBinding?.inventedDataForbidden !== true || !direction.brandDesignSystemSha256 || direction.knowledgeBundleSha256 !== knowledgeBinding.sha256) fail("H5_DIRECTION_BINDING_INVALID");
      const hierarchy = bundle?.hostContext?.resultHierarchyContract;
      const fit = direction?.resultHierarchyFit;
      const refs = Array.isArray(fit?.evidenceRefs) ? fit.evidenceRefs : [];
      const allowed = new Set((hierarchy?.evidence || []).map((item) => item.id));
      if (!hierarchy || !["peer", "source-evidenced-differentiated"].includes(fit?.relationship) || fit?.preservesHostHierarchy !== true || fit?.unsupportedDifferentiationForbidden !== true || refs.some((ref) => !allowed.has(ref)) || (fit?.relationship === "peer" && (fit?.resultSpecificEmphasis !== "none" || refs.length)) || (fit?.relationship === "source-evidenced-differentiated" && (hierarchy.differentiationAllowed !== true || fit?.resultSpecificEmphasis === "none" || !refs.length))) fail("H5_DIRECTION_RESULT_HIERARCHY_INVALID");
    }
  }
  const qa = route?.h5QA || {};
  const gap = route?.expressiveGapDecision || {};
  if (at("after-h5-qa")) {
    if (qa.status !== "pass" || !qa.reviewerExecutionId || qa.reviewerExecutionId === h5.producerExecutionId) fail("INDEPENDENT_H5_QA_REQUIRED");
    const hierarchyMeasurements = qa?.resultHierarchyGeometry;
    const measured = Array.isArray(hierarchyMeasurements?.directions) ? hierarchyMeasurements.directions : [];
    const peerDirectionIds = new Set((h5.directions || []).filter((item) => item?.resultHierarchyFit?.relationship === "peer").map((item) => item.id));
    if (hierarchyMeasurements?.status !== "pass" || measured.length !== peerDirectionIds.size || measured.some((item) => !peerDirectionIds.has(item?.id) || item?.relationship !== "peer" || Number(item?.measuredItemCount) < 2 || Number(item?.maxWidthRatio) > 1.08 || Number(item?.maxHeightRatio) > 1.08 || item?.computedProminenceEqual !== true)) fail("H5_RESULT_HIERARCHY_GEOMETRY_REQUIRED");
    if (!["required", "not-required"].includes(gap.status)) fail("EXPRESSIVE_GAP_DECISION_REQUIRED");
    if (gap.status === "required") {
      if (!Array.isArray(gap.gaps) || !gap.gaps.length) fail("EXPRESSIVE_GAP_LIST_REQUIRED");
      else for (const item of gap.gaps) if (!item?.id || !item?.directionId || !item?.regionId || !item?.businessPurpose || !item?.targetSize || !item?.currentShortfall || !item?.expectedImprovement || !item?.noImageFallback || !item?.mutableAssetSelector || !item?.fixedContainerSelector) fail("EXPRESSIVE_GAP_CONTRACT_INCOMPLETE");
    }
  }
  if (at("before-expressive-dispatch") && gap.status === "required" && route?.imageCapability?.status !== "available") fail("IMAGE_GENERATION_CAPABILITY_REQUIRED");
  const generated = route?.localizedExpressiveAssets || {};
  if (at("after-expressive-generation") && gap.status === "required") {
    if (generated.status !== "ready" || generated.automaticRetryCount !== 0 || !generated.producerExecutionId || !Array.isArray(generated.assets) || !generated.assets.length) fail("LOCAL_EXPRESSIVE_ASSETS_REQUIRED");
    else for (const item of generated.assets) {
      if (!item?.gapId || !item?.toolCallId || !validArtifact(item.artifact, knowledge.workspaceRoot) || !validArtifact(item.geometryLock, knowledge.workspaceRoot)) { fail("LOCAL_EXPRESSIVE_ASSET_BINDING_INVALID"); continue; }
      const lockFile = resolveArtifactFile(knowledge.workspaceRoot, item.geometryLock);
      if (lockFile) {
        try {
          const report = JSON.parse(fs.readFileSync(lockFile, "utf8"));
          const result = validateExpressiveGeometryLock(report, { root: knowledge.workspaceRoot, verifyFiles: true });
          if (!result.ok || report.gapId !== item.gapId) fail("EXPRESSIVE_GEOMETRY_LOCK_INVALID");
        } catch { fail("EXPRESSIVE_GEOMETRY_LOCK_INVALID"); }
      }
    }
  }
  if (at("before-final-selection") && gap.status === "required") {
    const integration = route?.expressiveIntegrationQA || {};
    if (integration.status !== "pass" || !integration.reviewerExecutionId || integration.reviewerExecutionId === generated.producerExecutionId) fail("INDEPENDENT_EXPRESSIVE_INTEGRATION_QA_REQUIRED");
    const locks = Array.isArray(integration.geometryLocks) ? integration.geometryLocks : [];
    const gapIds = new Set((gap.gaps || []).map((item) => item.id));
    if (integration.geometryPreservation !== "pass" || locks.length !== gapIds.size || locks.some((item) => !gapIds.has(item?.gapId) || item?.status !== "pass" || !validArtifact(item?.report, knowledge.workspaceRoot))) fail("EXPRESSIVE_GEOMETRY_PRESERVATION_REQUIRED");
  }
  if (stage === "before-apply-host") {
    const selection = route?.finalSelection || {};
    if (selection.status !== "selected" || selection.selectionSource !== "explicit-user" || !selection.selectedOptionId) fail("FINAL_DIRECTION_SELECTION_REQUIRED");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], stage, sequence: route?.sequence || "invalid" };
}

function validArtifact(value, workspaceRoot = "") {
  if (!value?.path || !/^[a-f0-9]{64}$/i.test(value?.sha256 || "")) return false;
  if (!workspaceRoot) return true;
  const file = resolveArtifactFile(workspaceRoot, value);
  return Boolean(file && sha256File(file) === value.sha256);
}

function resolveArtifactFile(workspaceRoot, value) {
  if (!workspaceRoot || !value?.path) return null;
  const base = path.resolve(workspaceRoot);
  const file = path.resolve(base, value.path);
  if (file !== base && !file.startsWith(`${base}${path.sep}`)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const fileIndex = process.argv.indexOf("--file");
  const stageIndex = process.argv.indexOf("--stage");
  const bundleIndex = process.argv.indexOf("--knowledge-bundle");
  const rootIndex = process.argv.indexOf("--knowledge-root");
  const workspaceIndex = process.argv.indexOf("--workspace-root");
  const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : "";
  const stage = stageIndex >= 0 ? process.argv[stageIndex + 1] : "before-concept-dispatch";
  if (!file || !fs.existsSync(file)) { console.error(JSON.stringify({ ok: false, errors: ["DESIGN_HOST_ROUTE_FILE_REQUIRED"] }, null, 2)); process.exit(2); }
  let route;
  try { route = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { console.error(JSON.stringify({ ok: false, errors: ["DESIGN_HOST_ROUTE_JSON_INVALID"] }, null, 2)); process.exit(2); }
  const bundleFile = bundleIndex >= 0 ? process.argv[bundleIndex + 1] : "";
  const knowledgeRoot = rootIndex >= 0 ? process.argv[rootIndex + 1] : "";
  const workspaceRoot = workspaceIndex >= 0 ? process.argv[workspaceIndex + 1] : "";
  let knowledge = {};
  if (bundleFile && fs.existsSync(bundleFile)) {
    try { knowledge = { bundle: JSON.parse(fs.readFileSync(bundleFile, "utf8")), bundleSha256: sha256File(bundleFile), knowledgeRoot: path.resolve(knowledgeRoot || "."), workspaceRoot: path.resolve(workspaceRoot || path.dirname(file)) }; }
    catch { knowledge = { loadError: "DESIGN_KNOWLEDGE_BUNDLE_INVALID" }; }
  }
  if (!knowledge.workspaceRoot && workspaceRoot) knowledge.workspaceRoot = path.resolve(workspaceRoot);
  knowledge.selectedHostOptions=selectedPosteditCliOptions(process.argv.slice(2));
  const result = validateDesignHostRoute(route, stage, knowledge);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}

function validateKnowledgeBundle(bundle, knowledge) {
  const errors = [];
  const refs = new Set();
  const questionIds = new Set();
  if (bundle?.schema !== "design-knowledge-bundle/v1" || bundle?.stage !== "design-host" || bundle?.generatedBy !== "query-design-knowledge.mjs") errors.push("DESIGN_KNOWLEDGE_BUNDLE_SCHEMA_INVALID");
  if (!bundle?.hostContext?.baselineSha256 || !bundle?.hostContext?.primaryTask || !bundle?.hostContext?.primaryAction || !bundle?.hostContext?.productiveFloor || bundle?.hostContext?.hostContentContract?.userInputRequired !== false || !bundle?.hostContext?.expressiveOpportunity) errors.push("DESIGN_KNOWLEDGE_HOST_CONTEXT_INCOMPLETE");
  const hierarchy = bundle?.hostContext?.resultHierarchyContract;
  if (!hierarchy || !hierarchy.defaultRelationship || typeof hierarchy.differentiationAllowed !== "boolean" || !Array.isArray(hierarchy.evidence) || !Array.isArray(hierarchy.forbiddenWithoutEvidence)) errors.push("DESIGN_KNOWLEDGE_RESULT_HIERARCHY_CONTEXT_INCOMPLETE");
  for (const question of Array.isArray(bundle?.questions) ? bundle.questions : []) {
    if (question?.id) questionIds.add(question.id);
    if (!Array.isArray(question?.items) || !question.items.length) errors.push("DESIGN_KNOWLEDGE_BASIS_EMPTY");
  }
  const required = ["expressive-productive-allocation-question", "host-generation-choice", "host-generation-brief", "host-reconstruction-risk", "host-content-scene-integration", "visual-authority"];
  if (required.some((id) => !questionIds.has(id))) errors.push("DESIGN_KNOWLEDGE_REQUIRED_QUESTIONS_MISSING");
  const verifySourceFiles = knowledge.verifySourceFiles !== false;
  const root = knowledge.knowledgeRoot ? path.resolve(knowledge.knowledgeRoot) : null;
  if (verifySourceFiles && (!root || !fs.existsSync(root))) errors.push("DESIGN_KNOWLEDGE_ROOT_REQUIRED");
  if (verifySourceFiles && root && bundle?.catalog?.path) verifyBoundFile(root, bundle.catalog.path, bundle.catalog.sha256, "DESIGN_KNOWLEDGE_CATALOG", errors);
  const seen = new Set();
  for (const entry of Array.isArray(bundle?.entries) ? bundle.entries : []) {
    if (!entry?.ref || seen.has(entry.ref)) { errors.push("DESIGN_KNOWLEDGE_ENTRY_INVALID"); continue; }
    seen.add(entry.ref);
    refs.add(entry.ref);
    if (`${entry.kind}:${entry.id}` !== entry.ref) errors.push("DESIGN_KNOWLEDGE_ENTRY_REF_MISMATCH");
    if (verifySourceFiles && root) {
      verifyBoundFile(root, entry.recordPath, entry.recordSha256, "DESIGN_KNOWLEDGE_RECORD", errors);
      verifyBoundFile(root, entry.guidePath, entry.guideSha256, "DESIGN_KNOWLEDGE_GUIDE", errors);
    }
  }
  for (const id of questionIds) if (!refs.has(`question:${id}`)) errors.push("DESIGN_KNOWLEDGE_QUESTION_ENTRY_MISSING");
  return { errors: [...new Set(errors)], refs, questionIds };
}

function verifyBoundFile(root, relative, expectedSha, label, errors) {
  if (!relative || !expectedSha) { errors.push(`${label}_BINDING_REQUIRED`); return; }
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) { errors.push(`${label}_PATH_ESCAPE`); return; }
  if (!fs.existsSync(file)) { errors.push(`${label}_MISSING`); return; }
  if (sha256File(file) !== expectedSha) errors.push(`${label}_HASH_MISMATCH`);
}

function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
