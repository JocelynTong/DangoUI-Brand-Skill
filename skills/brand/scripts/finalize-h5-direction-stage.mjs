#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBrandRenderKit, reusableIdentityAssets, frozenRuntimeAssetInputs } from "./validate-brand-render-kit.mjs";
import { validatePreviewGrant } from "./parent-delivery-gate.mjs";
import { validateTransferReview, validateTransferApplications } from "./source-transfer-input.mjs";

const NON_COLOR_MECHANISMS = new Set(["asset", "typography", "shape", "material", "spatial", "motion"]);
const COMPOSITION_ROLES = new Set(["navigation-shell", "identity-environment", "task-bridge", "featured-content", "business-stream"]);
const ASSET_PLACEMENTS = new Set(["identity-hero", "identity-support", "editorial-support", "feedback-support", "section-background", "business-content"]);
const PRIMARY_ASSET_ROLES = new Set(["brand-identity", "hero-background", "identity-environment", "campaign-scene", "environment"]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const fileSha256 = (file) => sha256(fs.readFileSync(file));
const array = (value) => Array.isArray(value) ? value : [];
const SHELL_MARKERS = { region: "data-composition-role", item: "data-host-shell-item", treatment: "data-navigation-shell-treatment", continuity: "data-scene-continuity" };
const SHELL_CONTINUITY = ["continuous", "explicit-boundary"];

export function validateExpressiveGeneration(directions, dispatch, workspace, migration) {
  const required = dispatch.fastDesignHints?.expressiveProduction?.required === true;
  const frozenInputs = [...array(dispatch.requiredInputs)];
  // A previously dispatched packet may bind the MOD but omit its runtime closure.
  // Verify that immutable MOD and its declared hashes rather than mutating dispatch.
  const modInput = frozenInputs.find(input => path.basename(input.path || "") === "brand-mod.json");
  if (modInput) {
    const file = insideExistingFile(migration, resolveFrom(workspace, modInput.path), "BRAND_MOD_OUTSIDE_MIGRATION");
    if (fileSha256(file) !== modInput.sha256) throw new Error("FROZEN_BRAND_MOD_HASH_MISMATCH");
    frozenInputs.push(...frozenRuntimeAssetInputs(readJson(file, "BRAND_MOD_INVALID"), { workspaceRoot: workspace, brand: path.basename(migration) }));
  }
  const records = [];
  for (const direction of directions) {
    const item = direction.metadata.expressiveGeneration;
    if (!item) { if (required) throw new Error(`IMAGEGEN_EXPRESSIVE_REQUIRED:${direction.metadata.id}`); continue; }
    if (!item.toolCallId || !item.prompt || !item.visualDirection || !array(item.inputImages).length) throw new Error("IMAGEGEN_INPUT_RECORD_INCOMPLETE");
    for (const input of item.inputImages) {
      const frozen = frozenInputs.find(ref => ref.path === input.path && ref.sha256 === input.sha256);
      if (!frozen || fileSha256(resolveFrom(workspace, input.path)) !== input.sha256) throw new Error("IMAGEGEN_REFERENCE_NOT_FROZEN");
    }
    const asset = item.asset;
    const file = insideExistingFile(migration, resolveFrom(workspace, asset?.path || ""), "EXPRESSIVE_ASSET_OUTSIDE_MIGRATION");
    if (!/\.(png|jpe?g|webp|avif)$/i.test(file) || fileSha256(file) !== asset.sha256) throw new Error("EXPRESSIVE_ASSET_HASH_MISMATCH");
    const references = [...direction.source.matchAll(/(?:src\s*=\s*["']([^"']+)["']|url\(\s*["']?([^\s)"']+))/gi)].map(match => match[1] || match[2]);
    if (!references.some(ref => path.resolve(path.dirname(direction.file), ref.split(/[?#]/)[0]) === file)) throw new Error("EXPRESSIVE_ASSET_NOT_USED_IN_H5");
    records.push({ directionId: direction.metadata.id, ...item });
  }
  if (required && (new Set(records.map(item => item.asset.sha256)).size !== directions.length || new Set(records.map(item => item.visualDirection)).size !== directions.length)) throw new Error("EXPRESSIVE_DIRECTIONS_MUST_DIFFER");
  return records;
}

export function navigationShellCompletionContract(contract) {
  return { mode: contract?.mode || "not-required", attributes: { ...SHELL_MARKERS }, regionValue: "navigation-shell", regionCount: 1, items: array(contract?.items).map(({ id, label, role, requiredInDesignPreview }) => ({ id, ...(label ? { label } : {}), ...(role ? { role } : {}), requiredInDesignPreview: requiredInDesignPreview === true })), allowedTreatments: array(contract?.allowedTreatments), allowedContinuity: [...SHELL_CONTINUITY] };
}

export function validateNavigationShellPreview(source, contract) {
  const errors = [];
  if (!contract || contract.mode !== "required") return errors;
  const markers = new Set([...String(source || "").matchAll(new RegExp(`${SHELL_MARKERS.item}=["']([^"']+)["']`, "gi"))].map((match) => match[1]));
  for (const item of array(contract.items).filter((entry) => entry?.requiredInDesignPreview === true)) {
    if (!markers.has(item.id)) errors.push(`HOST_NAVIGATION_SHELL_ITEM_MISSING:${item.id}`);
  }
  const shellTags = [...String(source || "").matchAll(new RegExp(`<[^>]+${SHELL_MARKERS.region}=["']navigation-shell["'][^>]*>`, "gi"))].map((match) => match[0]);
  if (shellTags.length !== 1) errors.push("HOST_NAVIGATION_SHELL_REGION_REQUIRED");
  else {
    const treatment = attribute(shellTags[0], SHELL_MARKERS.treatment);
    const continuity = attribute(shellTags[0], SHELL_MARKERS.continuity);
    if (!array(contract.allowedTreatments).includes(treatment)) errors.push("HOST_NAVIGATION_SHELL_TREATMENT_REQUIRED");
    if (!SHELL_CONTINUITY.includes(continuity)) errors.push("HOST_NAVIGATION_SCENE_CONTINUITY_REQUIRED");
  }
  return errors;
}

export function finalizeH5DirectionStage({ root, brand, dispatchFile, htmlFiles, producerExecutionId, receiptFile = "" }) {
  const workspace = path.resolve(root);
  const migration = path.resolve(workspace, "migrations", requiredText(brand, "BRAND_REQUIRED"));
  const dispatchPath = insideExistingFile(migration, resolveFrom(workspace, dispatchFile), "DISPATCH_OUTSIDE_ARTIFACT_MIGRATION");
  const dispatch = readJson(dispatchPath, "DISPATCH_JSON_INVALID");
  if (dispatch.stage !== "h5DirectionGeneration" || dispatch.role !== "brandApplicationDesigner") throw new Error("H5_DIRECTION_DISPATCH_REQUIRED");
  if (!String(producerExecutionId || "").startsWith("/root/") || producerExecutionId === "/root") throw new Error("PRODUCER_EXECUTION_ID_INVALID");

  const inputs = new Map();
  for (const input of array(dispatch.requiredInputs)) {
    const file = validateDirectionInputPath({ workspace, migration, dispatch, dispatchPath, input });
    // A repair's old H5 input is intentionally replaced by this stage's output,
    // just as record() permits. Brand, host and evidence inputs stay immutable.
    const replacedH5 = path.dirname(file) === path.join(migration, "h5-directions")
      && path.extname(file).toLowerCase() === ".html"
      && array(htmlFiles).some(item => resolveFrom(workspace, item) === file);
    if (!/^[a-f0-9]{64}$/i.test(input?.sha256 || "") || (!replacedH5 && fileSha256(file) !== input.sha256)) throw new Error(`FROZEN_INPUT_HASH_MISMATCH:${input?.path || "missing"}`);
    inputs.set(path.basename(file), { ...input, file });
  }
  const requiredInput = (name) => {
    const item = inputs.get(name);
    if (!item) throw new Error(`REQUIRED_INPUT_MISSING:${name}`);
    return item;
  };
  const evidenceInput = requiredInput("brand-evidence.json");
  const intentInput = requiredInput("brand-intent.json");
  const modInput = requiredInput("brand-mod.json");
  const startupInput = requiredInput("host-startup-page.json");
  const baselineInput = requiredInput("host-startup-baseline.json");
  const knowledgeInput = requiredInput("design-knowledge-bundle.json");
  const evidence = readJson(evidenceInput.file, "BRAND_EVIDENCE_INVALID");
  const intent = readJson(intentInput.file, "BRAND_INTENT_INVALID");
  const brandMod = readJson(modInput.file, "BRAND_MOD_INVALID");
  const patternFile = brandMod.verification?.patterns;
  const patternInput = typeof patternFile === "string" ? [...inputs.values()].find((entry) => path.resolve(entry.file) === path.resolve(path.dirname(modInput.file), patternFile)) : null;
  const approvedPatterns = patternInput ? readJson(patternInput.file, "APPROVED_PATTERNS_INVALID") : null;
  const startup = readJson(startupInput.file, "HOST_STARTUP_PAGE_INVALID");
  const baseline = readJson(baselineInput.file, "HOST_STARTUP_BASELINE_INVALID");
  const knowledge = readJson(knowledgeInput.file, "DESIGN_KNOWLEDGE_BUNDLE_INVALID");
  validateBaselineBinding(baseline, baselineInput.sha256, startup, startupInput.sha256, knowledge);
  const hostSource = verifyFrozenHostSource(workspace, startup);

  if (!Array.isArray(htmlFiles) || htmlFiles.length !== 3) throw new Error("EXACTLY_THREE_H5_FILES_REQUIRED");
  const expectedDirectionDirectory = path.join(migration, "h5-directions");
  const html = htmlFiles.map((item) => {
    const file = insideExistingFile(migration, resolveFrom(workspace, item), "H5_OUTSIDE_ARTIFACT_MIGRATION");
    if (path.dirname(file) !== expectedDirectionDirectory) throw new Error("H5_OUTSIDE_CANONICAL_DIRECTION_DIRECTORY");
    if (path.extname(file).toLowerCase() !== ".html") throw new Error("H5_FILE_EXTENSION_REQUIRED");
    const source = fs.readFileSync(file, "utf8");
    if (/__FILL(?:_[A-Z_]+)?__/.test(source)) throw new Error(`H5_SCAFFOLD_INCOMPLETE:${relative(workspace, file)}`);
    return { file, path: relative(workspace, file), source };
  });
  if (new Set(html.map((item) => item.file)).size !== 3) throw new Error("H5_FILE_PATHS_MUST_BE_UNIQUE");

  const evidenceClaims = new Map(array(evidence.claims).filter((item) => item?.id && item.status !== "rejected").map((item) => [item.id, item]));
  const systemRefs = collectSystemRefs(intent, brandMod);
  const knowledgeRefs = new Set(array(knowledge.entries).map((item) => item?.ref).filter(Boolean));
  const assets = reusableIdentityAssets(brandMod, { workspaceRoot: workspace, brand }).filter((item) => item?.id);
  const assetIds = new Set(assets.map((item) => item.id));
  const parsedDirections = html.map((item) => ({ ...item, metadata: readDirectionMetadata(item.source, item.path) }));
  const preflightErrors = parsedDirections.flatMap((item) => [
    ...array(item.metadata?.brandMechanisms).filter((mechanism) => !systemRefs.has(normalizeSystemRef(mechanism?.systemRef, systemRefs))).map((mechanism) => `BRAND_MECHANISM_SYSTEM_UNKNOWN:${item.metadata?.id}:${mechanism?.id}:${mechanism?.systemRef}`),
    ...validateNavigationShellPreview(item.source, baseline.navigationShellContract).map((code) => `${code}:${item.metadata?.id}`),
  ]);
  if (preflightErrors.length) throw Object.assign(new Error(preflightErrors.join("\n")), { errors: preflightErrors });
  const directions = parsedDirections.map((item) => validateDirection(item, { evidenceClaims, systemRefs, knowledgeRefs, assetIds, assets, baseline }));
  const expressiveRecords = validateExpressiveGeneration(directions, dispatch, workspace, migration);
  for (const direction of directions) adaptDeclaredDirectionContract(direction, { evidenceClaims, brandMod, approvedPatterns, patternInput, hostSource: fs.readFileSync(hostSource.file, "utf8"), supportedIds: dispatch.partialBrandValidation?.partialBrandValidation?.allowedUse?.supportedIds || null, hashes: { brandModSha256: modInput.sha256, brandIntentSha256: intentInput.sha256, hostBaselineSha256: baselineInput.sha256, knowledgeBundleSha256: knowledgeInput.sha256 } });
  if (dispatch.sourceTransfer) {
    const binding = dispatch.sourceTransfer.review;
    if (!array(dispatch.requiredInputs).some((item) => item.path === binding.path && item.sha256 === binding.sha256)) throw new Error("TRANSFER_REVIEW_DISPATCH_BINDING_REQUIRED");
    const { review } = validateTransferReview({ file: path.resolve(workspace, binding.path), sha256: binding.sha256, brand, producers: [producerExecutionId] });
    for (const direction of directions) validateTransferApplications({ metadata: direction.metadata, source: direction.source, review, reviewSha256: binding.sha256, producerExecutionId, assets });
  } else if (directions.some((item) => array(item.metadata.transferRuleApplications).length)) throw new Error("TRANSFER_REVIEW_INPUT_REQUIRED");
  if (new Set(directions.map((item) => item.metadata.id)).size !== 3) throw new Error("DIRECTION_IDS_MUST_BE_UNIQUE");
  if (new Set(directions.map((item) => stableJson(item.metadata.structuralSignature))).size !== 3) throw new Error("STRUCTURAL_SIGNATURES_MUST_BE_UNIQUE");
  if (new Set(directions.map((item) => item.metadata.communicationHypothesis.style.mechanismThesis)).size !== 3) throw new Error("COMMUNICATION_HYPOTHESES_MUST_BE_UNIQUE");

  const routeFile = path.join(migration, "design-host-route.json");
  const route = readJson(insideExistingFile(migration, routeFile, "DESIGN_HOST_ROUTE_REQUIRED"), "DESIGN_HOST_ROUTE_INVALID");
  if (route.schema !== "design-host-route/v3" || route.sequence !== "h5-design-system-first") throw new Error("DESIGN_HOST_H5_FIRST_ROUTE_REQUIRED");
  if (route.knowledgeDecision?.sha256 !== knowledgeInput.sha256) throw new Error("ROUTE_KNOWLEDGE_HASH_MISMATCH");

  const kit = buildRenderKit(directions, modInput.sha256);
  const kitResult = validateBrandRenderKit(kit, { evidence, brandIntent: intent, brandMod, brandModSha256: modInput.sha256, workspaceRoot: workspace, brand });
  if (!kitResult.ok) throw new Error(`COMPILED_RENDER_KIT_INVALID:${kitResult.errors.join(",")}`);
  const plan = buildPlan({ directions, baseline, baselineInput, startup, startupInput, modInput });
  const options = buildOptions({ directions, baseline, baselineInput, evidenceInput, modInput, brand });
  for (const output of [plan, options]) for (const option of array(output.options)) {
    const metadata = directions.find((item) => item.metadata.id === option.id)?.metadata;
    for (const key of ["productionFormula", "semanticColorApplications", "visualProgram", "compositionRoles", "compositionSequence", "contentEntryForm", "resultContainerForm", "officialIdentityAssetsUsed"]) if (metadata?.[key] !== undefined) option[key] = structuredClone(metadata[key]);
  }
  if (dispatch.sourceTransfer) for (const output of [plan, options]) for (const option of array(output.options)) {
    const direction = directions.find((item) => item.metadata.id === option.id);
    if (direction) { option.transferRuleApplications = direction.metadata.transferRuleApplications; option.sourceTransferReview = dispatch.sourceTransfer.review; }
  }

  const kitFile = path.join(migration, "brand-render-kit.json");
  const planFile = path.join(migration, "brand-application-plan.json");
  const optionsFile = path.join(migration, "design-direction-options.json");
  writeJson(kitFile, kit);
  writeJson(planFile, plan);
  writeJson(optionsFile, options);

  route.knowledgeDecision = {
    ...(route.knowledgeDecision || {}),
    status: "ready",
    path: knowledgeInput.path,
    sha256: knowledgeInput.sha256,
    hostStartupBaselineSha256: baselineInput.sha256,
  };
  route.h5Directions = {
    status: "ready",
    producerExecutionId,
    directions: directions.map((item) => ({
      id: item.metadata.id,
      title: item.metadata.title,
      artifact: { path: item.path, sha256: fileSha256(item.file) },
      structuralSignature: item.metadata.structuralSignature,
      interactionRhythm: item.metadata.interactionRhythm,
      communicationHypothesis: item.metadata.communicationHypothesis,
      ...(item.metadata.expressiveGeneration ? { expressiveGeneration: item.metadata.expressiveGeneration } : {}),
      ...(dispatch.sourceTransfer ? { transferRuleApplications: item.metadata.transferRuleApplications, sourceTransferReview: dispatch.sourceTransfer.review } : {}),
      realDataBinding: realDataBinding(baseline, baselineInput),
      resultHierarchyFit: item.metadata.resultHierarchyFit,
      brandDesignSystemSha256: modInput.sha256,
      knowledgeBundleSha256: knowledgeInput.sha256,
    })),
  };
  writeJson(routeFile, route);
  if (route.h5Directions.directions.some((item) => item.knowledgeBundleSha256 !== route.knowledgeDecision.sha256 || item.realDataBinding.inventedDataForbidden !== true)) throw new Error("COMPILED_ROUTE_INVALID");

  // Hash only after every contract artifact has reached its final bytes.
  const outputs = [...directions.map((item) => ({ path: item.path, sha256: fileSha256(item.file) })), ...expressiveRecords.map(item => item.asset), kitFile, planFile, optionsFile, routeFile]
    .map((item) => typeof item === "string" ? ({ path: relative(workspace, item), sha256: fileSha256(item) }) : item);
  const declaredReceipt = receiptFile || dispatch.receiptContract?.path;
  const receiptPath = insideOutput(migration, declaredReceipt ? resolveFrom(workspace, declaredReceipt) : path.join(migration, "receipts", `${dispatch.stageId}.producer.json`), "RECEIPT_OUTSIDE_ARTIFACT_MIGRATION");
  const receipt = {
    schema: "brand-subagent-receipt/v1",
    dispatchId: dispatch.dispatchId,
    stageId: dispatch.stageId,
    role: dispatch.role,
    agentExecutionId: producerExecutionId,
    goalSha256: dispatch.goalSha256,
    verdict: "pass",
    inputs: structuredClone(dispatch.requiredInputs),
    outputs,
    additionalReads: [],
    blockingFindings: [],
    toolCalls: expressiveRecords.map(item => ({ id: item.toolCallId, tool: "image_gen", prompt: item.prompt, inputImages: item.inputImages, output: item.asset })),
    producerPolicy: { imageGenerationCalls: expressiveRecords.length, hostFilesModified: false, hostSourceSha256: hostSource.sha256, compiler: "finalize-h5-direction-stage.mjs" },
  };
  if (fileSha256(hostSource.file) !== hostSource.sha256) throw new Error("HOST_SOURCE_CHANGED_DURING_FINALIZATION");
  writeJson(receiptPath, receipt);
  const suppliedRecordCommand = dispatch.receiptContract?.recordCommand;
  const recordCommandArgs = Array.isArray(suppliedRecordCommand) && suppliedRecordCommand.includes("--receipt")
    ? [...suppliedRecordCommand]
    : [process.execPath, fileURLToPath(new URL("./brand-subagent-workflow.mjs", import.meta.url)), "record", "--brand", brand, "--root", workspace, "--receipt", relative(workspace, receiptPath)];
  recordCommandArgs[recordCommandArgs.indexOf("--receipt") + 1] = relative(workspace, receiptPath);
  return {
    ok: true,
    status: "compiled-not-recorded",
    stageCompleted: false,
    instruction: "Compilation validates structure, not rendered quality or interactions. The producer must finish its required self-review; after any H5 edit rerun this finalizer, then execute recordCommandArgs. Report the record result before ending. The orchestrator must not interrupt a working producer or submit its receipt merely because this file exists.",
    receipt: relative(workspace, receiptPath),
    outputs,
    recordCommandArgs,
    recordCommand: recordCommandArgs.map(shellWord).join(" "),
  };
}

// The single root provenance receipt is permitted only when the state machine
// froze it and this exact dispatch consumes the separately frozen trial grant.
export function validateDirectionInputPath({ workspace, migration, dispatch, dispatchPath, input }) {
  // Registry runtime assets are frozen inputs, not producer output locations.
  const assetRoot = path.join(workspace, 'public', 'assets', 'brand-assets', path.basename(migration));
  const candidate = resolveFrom(workspace, input?.path);
  if (candidate.startsWith(`${assetRoot}${path.sep}`)) {
    // Check the workspace boundary as well: an asset-root symlink cannot grant
    // access to another run or brand. The caller still verifies the frozen hash.
    insideExistingFile(workspace, candidate, 'INPUT_OUTSIDE_ARTIFACT_MIGRATION');
    const realAssets = path.join(fs.realpathSync(workspace), 'public', 'assets', 'brand-assets', path.basename(migration));
    if (fs.realpathSync(assetRoot) !== realAssets) throw new Error('INPUT_OUTSIDE_ARTIFACT_MIGRATION');
    return insideExistingFile(assetRoot, candidate, 'INPUT_OUTSIDE_ARTIFACT_MIGRATION');
  }
  if (input?.path !== 'source-continuation.json') return insideExistingFile(migration, resolveFrom(workspace, input?.path), 'INPUT_OUTSIDE_ARTIFACT_MIGRATION');
  const file = path.join(workspace, 'source-continuation.json');
  const manifest = readJson(path.join(migration, 'execution-manifest.json'), 'PREVIEW_MANIFEST_INVALID');
  const binding = manifest.previewContinuation;
  const stage = array(manifest.stages).find((item) => item.id === dispatch.stageId && item.dispatchId === dispatch.dispatchId && path.resolve(workspace, item.dispatchPath || '') === path.resolve(dispatchPath));
  const grant = validatePreviewGrant(workspace, binding);
  if (!stage || stage.status !== 'dispatched' || grant?.continuationScope !== 'macro-host-journey' || grant.error || binding?.continuation?.path !== input.path || binding.continuation.sha256 !== input.sha256 || !array(dispatch.requiredInputs).some((ref) => ref.path === binding.readiness.path && ref.sha256 === binding.readiness.sha256) || fs.lstatSync(file).isSymbolicLink()) throw new Error('INPUT_OUTSIDE_ARTIFACT_MIGRATION');
  return insideExistingFile(workspace, file, 'INPUT_OUTSIDE_ARTIFACT_MIGRATION');
}

export function validateFinalizedH5Plan(plan, planFile) {
  const failures = [];
  const fail = (code, detail = "") => failures.push({ code, detail });
  const base = path.dirname(path.resolve(planFile));
  if (plan?.schema !== "brand-application-plan/v1" || plan?.generatedBy !== "finalize-h5-direction-stage.mjs" || plan?.contractSource !== "h5-embedded-direction-metadata") fail("FINALIZED_H5_PLAN_SCHEMA_INVALID");
  const boundFile = (bindingPath, expected, code) => {
    const file = bindingPath ? path.resolve(base, bindingPath) : "";
    if (!file || (file !== base && !file.startsWith(`${base}${path.sep}`)) || !fs.existsSync(file) || fileSha256(file) !== expected) { fail(code); return null; }
    return file;
  };
  boundFile(plan?.brandSystemBinding?.brandModPath, plan?.brandSystemBinding?.brandModSha256, "FINALIZED_H5_PLAN_BRAND_BINDING_INVALID");
  const baselineFile = boundFile(plan?.hostBinding?.baselinePath, plan?.hostBinding?.baselineSha256, "FINALIZED_H5_PLAN_BASELINE_BINDING_INVALID");
  const baseline = baselineFile ? readJson(baselineFile, "FINALIZED_H5_PLAN_BASELINE_INVALID") : null;
  const options = array(plan?.options);
  if (options.length !== 3 || new Set(options.map((item) => item?.id)).size !== 3) fail("FINALIZED_H5_PLAN_THREE_DIRECTIONS_REQUIRED");
  if (new Set(options.map((item) => stableJson(item?.structuralSignature))).size !== 3) fail("FINALIZED_H5_PLAN_STRUCTURAL_DISTANCE_REQUIRED");
  for (const option of options) {
    if (!option?.title || array(option?.brandMechanisms).length < 3 || array(option?.brandMechanisms).some((item) => !NON_COLOR_MECHANISMS.has(item?.type))) fail("FINALIZED_H5_PLAN_MECHANISMS_INVALID", option?.id);
    if (!array(option?.knowledgeRefs).length || !option?.interactionRhythm?.peak || !option?.interactionRhythm?.settled || !option?.interactionRhythm?.carryThrough) fail("FINALIZED_H5_PLAN_DECISION_TRACE_INVALID", option?.id);
    if (!validCommunicationHypothesis(option?.communicationHypothesis)) fail("FINALIZED_H5_PLAN_COMMUNICATION_HYPOTHESIS_INVALID", option?.id);
    if (baseline && (option?.informationDistributionFit?.model !== baseline.informationDistributionContract?.model || option?.informationDistributionFit?.preservesPreviewUnit !== true || option?.informationDistributionFit?.preservesScanOrder !== true || option?.informationDistributionFit?.preservesComparisonBehavior !== true || option?.informationDistributionFit?.inventedDataForbidden !== true)) fail("FINALIZED_H5_PLAN_REAL_DATA_BINDING_INVALID", option?.id);
    if (baseline && !resultHierarchyFitMatches(option?.resultHierarchyFit, baseline.resultHierarchyContract)) fail("FINALIZED_H5_PLAN_RESULT_HIERARCHY_INVALID", option?.id);
    const preview = option?.previewEvidence;
    const previewFile = preview?.path ? path.resolve(base, preview.path) : "";
    if (!previewFile || (previewFile !== base && !previewFile.startsWith(`${base}${path.sep}`)) || path.extname(previewFile).toLowerCase() !== ".html" || !fs.existsSync(previewFile) || fileSha256(previewFile) !== preview?.sha256) fail("FINALIZED_H5_PLAN_PREVIEW_INVALID", option?.id);
    else for (const code of validateNavigationShellPreview(fs.readFileSync(previewFile, "utf8"), baseline?.navigationShellContract)) fail(code, option?.id);
  }
  return { ok: failures.length === 0, optionCount: options.length, failures };
}

function readDirectionMetadata(source, label) {
  const matches = [...source.matchAll(/<script\b(?=[^>]*\btype=["']application\/json["'])(?=[^>]*\bdata-brand-direction(?:\s|=|>))[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if (matches.length !== 1) throw new Error(`ONE_DIRECTION_METADATA_BLOCK_REQUIRED:${label}`);
  try { return JSON.parse(matches[0][1]); }
  catch { throw new Error(`DIRECTION_METADATA_JSON_INVALID:${label}`); }
}

function validateDirection(item, context) {
  const metadata = item.metadata;
  for (const key of ["id", "title"]) requiredText(metadata?.[key], `DIRECTION_${key.toUpperCase()}_REQUIRED`);
  const mechanisms = array(metadata.brandMechanisms);
  if (mechanisms.length < 3) throw new Error(`THREE_NON_COLOR_BRAND_MECHANISMS_REQUIRED:${metadata.id}`);
  const mechanismIds = new Set();
  for (const mechanism of mechanisms) {
    mechanism.type = normalizeMechanismType(mechanism.type);
    if (!mechanism?.id || mechanismIds.has(mechanism.id) || !NON_COLOR_MECHANISMS.has(mechanism.type)) throw new Error(`BRAND_MECHANISM_INVALID:${metadata.id}`);
    mechanismIds.add(mechanism.id);
    if (!context.evidenceClaims.has(mechanism.evidenceRef)) throw new Error(`BRAND_MECHANISM_EVIDENCE_UNKNOWN:${metadata.id}:${mechanism.id}`);
    const claim = context.evidenceClaims.get(mechanism.evidenceRef);
    if (claim?.sourcePageId && mechanism.sourcePageRef !== claim.sourcePageId) throw new Error(`BRAND_MECHANISM_SOURCE_PAGE_MISMATCH:${metadata.id}:${mechanism.id}`);
    mechanism.systemRef = normalizeSystemRef(mechanism.systemRef, context.systemRefs);
    if (!context.systemRefs.has(mechanism.systemRef)) throw new Error(`BRAND_MECHANISM_SYSTEM_UNKNOWN:${metadata.id}:${mechanism.id}`);
    if (String(mechanism.visibleEffect || "").trim().length < 12 || String(mechanism.visibleApplication || "").trim().length < 12) throw new Error(`BRAND_MECHANISM_VISIBLE_DECISION_REQUIRED:${metadata.id}:${mechanism.id}`);
    if (mechanism.type === "asset" && !mechanism.assetRef) {
      const referenced = context.assets.filter((asset) => asset.localPath && (item.source.includes(asset.localPath) || item.source.includes(path.basename(asset.localPath))));
      if (referenced.length === 1) mechanism.assetRef = referenced[0].id;
    }
    if (mechanism.type === "asset" && (!mechanism.assetRef || !context.assetIds.has(mechanism.assetRef))) throw new Error(`BRAND_MECHANISM_ASSET_UNKNOWN:${metadata.id}:${mechanism.id}`);
    if (mechanism.type === "asset") validateAssetUsageMarker(item.source, metadata.id, mechanism, context.assets.find((asset) => asset.id === mechanism.assetRef));
  }
  const signature = metadata.structuralSignature = normalizeStructuralSignature(metadata.structuralSignature, metadata);
  const roles = array(signature?.compositionRoles);
  if (!signature || roles.length < 2 || !roles.includes("business-stream") || roles.some((role) => !COMPOSITION_ROLES.has(role)) || new Set(roles).size !== roles.length) throw new Error(`STRUCTURAL_SIGNATURE_INVALID:${metadata.id}`);
  for (const key of ["contentEntry", "resultContainer", "visualCenter", "primaryActionPlacement", "resultPresentation"]) requiredText(signature[key], `STRUCTURAL_SIGNATURE_${key.toUpperCase()}_REQUIRED:${metadata.id}`);
  if (!resultHierarchyFitMatches(metadata.resultHierarchyFit, context.baseline?.resultHierarchyContract)) throw new Error(`RESULT_HIERARCHY_FIT_INVALID:${metadata.id}`);
  const hierarchyMarkers = [...item.source.matchAll(/data-result-hierarchy=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (!hierarchyMarkers.length || hierarchyMarkers.some((value) => value !== metadata.resultHierarchyFit.relationship)) throw new Error(`RESULT_HIERARCHY_MARKER_INVALID:${metadata.id}`);
  if (metadata.resultHierarchyFit.relationship === "peer" && /data-result-weight=["'](?!peer["'])[^"']+["']/i.test(item.source)) throw new Error(`UNSUPPORTED_RESULT_WEIGHT_INVALID:${metadata.id}`);
  const rhythm = metadata.interactionRhythm = normalizeInteractionRhythm(metadata.interactionRhythm);
  for (const key of ["peak", "settled", "carryThrough"]) if (String(rhythm?.[key] || "").trim().length < 8) throw new Error(`INTERACTION_RHYTHM_${key.toUpperCase()}_REQUIRED:${metadata.id}`);
  if (!validCommunicationHypothesis(metadata.communicationHypothesis)) throw new Error(`COMMUNICATION_HYPOTHESIS_INVALID:${metadata.id}`);
  const styleEvidence = new Set(array(metadata.brandMechanisms).map((item) => item.evidenceRef));
  if (array(metadata.communicationHypothesis.style.brandEvidenceRefs).length && array(metadata.communicationHypothesis.style.brandEvidenceRefs).some((ref) => !styleEvidence.has(ref))) throw new Error(`COMMUNICATION_STYLE_EVIDENCE_UNKNOWN:${metadata.id}`);
  if (!array(metadata.knowledgeRefs).length || array(metadata.knowledgeRefs).some((ref) => !context.knowledgeRefs.has(ref))) throw new Error(`DIRECTION_KNOWLEDGE_REFS_INVALID:${metadata.id}`);
  const shellErrors = validateNavigationShellPreview(item.source, context.baseline?.navigationShellContract);
  if (shellErrors.length) throw new Error(`${shellErrors[0]}:${metadata.id}`);
  return item;
}

export function validateAssetUsageMarker(source, directionId, mechanism, asset) {
  const tags = [...String(source || "").matchAll(/<[^>]+>/g)].map((match) => match[0]).filter((tag) => new RegExp(`data-brand-asset-ref=["']${escapeRegExp(mechanism.assetRef)}["']`, "i").test(tag));
  const markerValues = tags.map((tag) => ({ placement: attribute(tag, "data-brand-asset-placement"), salience: attribute(tag, "data-brand-asset-salience") })).filter((item) => item.placement && item.salience);
  const uniqueMarkers = new Map(markerValues.map((item) => [`${item.placement}:${item.salience}`, item]));
  if (!mechanism.assetPlacement && uniqueMarkers.size === 1) mechanism.assetPlacement = [...uniqueMarkers.values()][0].placement;
  if (!mechanism.assetSalience && uniqueMarkers.size === 1) mechanism.assetSalience = [...uniqueMarkers.values()][0].salience;
  const placement = String(mechanism?.assetPlacement || "").trim();
  const salience = String(mechanism?.assetSalience || "").trim();
  if (!ASSET_PLACEMENTS.has(placement) || !["primary", "supporting"].includes(salience)) throw new Error(`BRAND_ASSET_PLACEMENT_DECLARATION_REQUIRED:${directionId}:${mechanism?.id || "asset"}`);
  if (!tags.length || !tags.some((tag) => new RegExp(`data-brand-asset-placement=["']${escapeRegExp(placement)}["']`, "i").test(tag) && new RegExp(`data-brand-asset-salience=["']${salience}["']`, "i").test(tag))) throw new Error(`BRAND_ASSET_PLACEMENT_MARKER_REQUIRED:${directionId}:${mechanism.id}`);
  const role = String(asset?.role || "").trim();
  const target = String(asset?.targetScope || "").toLowerCase();
  if ((placement === "identity-hero" || salience === "primary") && !PRIMARY_ASSET_ROLES.has(role)) throw new Error(`BRAND_ASSET_ROLE_SALIENCE_MISMATCH:${directionId}:${mechanism.id}:${role || "unknown"}`);
  if (role === "section-background" && !["section-background", "editorial-support"].includes(placement)) throw new Error(`BRAND_ASSET_ROLE_PLACEMENT_MISMATCH:${directionId}:${mechanism.id}`);
  if (/editorial|explanation|study|diagram/.test(target) && !["section-background", "editorial-support"].includes(placement)) throw new Error(`BRAND_ASSET_TARGET_SCOPE_MISMATCH:${directionId}:${mechanism.id}`);
  if (["character-motion", "feedback-motion"].includes(role) && (placement === "identity-hero" || salience === "primary")) throw new Error(`BRAND_MOTION_ASSET_PRIMARY_FORBIDDEN:${directionId}:${mechanism.id}`);
  return { ok: true, assetRef: mechanism.assetRef, placement, salience, sourceRole: role };
}

function normalizeMechanismType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (NON_COLOR_MECHANISMS.has(raw)) return raw;
  if (/motion|feedback|progress|response|animation/.test(raw)) return "motion";
  if (/asset|identity|character|official|illustration|art/.test(raw)) return "asset";
  if (/type|font|label|copy|headline/.test(raw)) return "typography";
  if (/material|tactile|raised|surface|edge|shadow|control/.test(raw)) return "material";
  if (/spatial|sequence|layout|entry|flow|rail|column/.test(raw)) return "spatial";
  if (/shape|geometry|geometric|frame|framing|spine|row|rhythm/.test(raw)) return "shape";
  return raw;
}

export function normalizeSystemRef(value, systemRefs) {
  const raw = String(value || "").trim();
  if (systemRefs?.has(raw)) return raw;
  const suffixMatches = [...(systemRefs || [])].filter((candidate) => candidate.endsWith(`.${raw}`));
  return suffixMatches.length === 1 ? suffixMatches[0] : raw;
}

export function bindProductionPattern(binding, { brandMod, approvedPatterns, patternInput, supportedIds = null }) {
  const fail = (reason) => { throw new Error(`H5_PRODUCTION_PATTERN_UNBOUND:${binding.patternId}:${reason}`); };
  if (!binding.patternId) fail("patternId-required");
  let bound = brandMod;
  for (const key of String(binding.systemRef || "").split(".")) bound = bound?.[key];
  if (binding.systemRef && bound?.id === binding.patternId && !bound.approvedPatternId) {
    if (bound.status === "rejected" || bound.status === "candidate" || (supportedIds && !supportedIds.includes(binding.systemRef))) fail("system-ref-not-approved");
    delete binding.patternSource;
    delete binding.sourceConstraints;
    return binding;
  }
  if (!patternInput?.sha256 || !approvedPatterns || !["APPROVED", "APPROVED_WITH_UNRESOLVED"].includes(approvedPatterns.status)) fail("frozen-approved-catalog-required");
  const matches = array(approvedPatterns.patterns).filter((entry) => entry.id === binding.patternId);
  if (matches.length !== 1) fail("pattern-id-missing-or-ambiguous");
  const pattern = matches[0];
  if (pattern.status && !["approved", "APPROVED", "composed"].includes(pattern.status)) fail("pattern-not-approved");
  if (binding.systemRef && (bound?.approvedPatternId !== binding.patternId || ["rejected", "candidate"].includes(bound?.status))) fail("system-ref-conflicts-with-pattern");
  const catalogRef = `approvedPatterns.patterns.${approvedPatterns.patterns.indexOf(pattern)}`;
  if (supportedIds && !supportedIds.includes(binding.systemRef) && !supportedIds.includes(catalogRef)) fail("outside-supported-scope");
  binding.patternSource = { path: patternInput.path, sha256: patternInput.sha256, ref: catalogRef };
  binding.sourceConstraints = structuredClone(pattern);
  return binding;
}

export function adaptDeclaredDirectionContract(item, { evidenceClaims, brandMod, approvedPatterns = null, patternInput = null, hostSource = "", supportedIds = null, hashes = {} }) {
  const metadata = item.metadata;
  for (const formula of [metadata.productionFormula, metadata.visualProgram?.productionFormula].filter(Boolean)) {
    for (const key of ["brandModSha256", "brandIntentSha256", "hostBaselineSha256"]) if (formula.productive?.[key] && formula.productive[key] !== hashes[key]) throw new Error(`H5_PRODUCTION_FORMULA_HASH_UNBOUND:${metadata.id}:${key}`);
    if (formula.expertDecision?.knowledgeBundleSha256 && formula.expertDecision.knowledgeBundleSha256 !== hashes.knowledgeBundleSha256) throw new Error(`H5_PRODUCTION_FORMULA_HASH_UNBOUND:${metadata.id}:knowledgeBundleSha256`);
    for (const binding of array(formula.productive?.patternBindings)) {
      try { bindProductionPattern(binding, { brandMod, approvedPatterns, patternInput, supportedIds }); }
      catch (error) { throw new Error(`H5_DIRECTION:${metadata.id}:${error.message}`); }
    }
  }
  const tags = [...item.source.matchAll(/<[^>]+>/g)].map((match) => ({ tag: match[0], index: match.index }));
  const sourceRefs = tags.map(({ tag }) => attribute(tag, "data-brand-source")).filter(Boolean);
  if (sourceRefs.some((ref) => !evidenceClaims.has(ref))) throw new Error(`H5_MOMENT_SOURCE_UNKNOWN:${metadata.id}`);
  const roleTags = tags.filter(({ tag }) => attribute(tag, "data-composition-role"));
  const actualRoles = roleTags.map(({ tag }) => attribute(tag, "data-composition-role"));
  const declaredRoles = metadata.compositionSequence || metadata.visualProgram?.compositionSequence;
  if (declaredRoles && JSON.stringify(declaredRoles) !== JSON.stringify(actualRoles)) throw new Error(`H5_DECLARED_COMPOSITION_ROLE_DRIFT:${metadata.id}`);
  if (metadata.visualProgram?.compositionSequence && JSON.stringify(metadata.visualProgram.compositionSequence) !== JSON.stringify(actualRoles)) throw new Error(`H5_DECLARED_COMPOSITION_ROLE_DRIFT:${metadata.id}`);
  if (declaredRoles) metadata.compositionRoles = roleTags.map(({ tag, index }, position) => ({ role: attribute(tag, "data-composition-role"), evidenceRefs: [...new Set(tags.filter((entry) => entry.index >= index && entry.index < (roleTags[position + 1]?.index ?? Infinity)).map((entry) => attribute(entry.tag, "data-brand-source")).filter(Boolean))] }));
  if (metadata.semanticColorApplications) metadata.semanticColorApplications = array(metadata.semanticColorApplications).map((application, index) => {
    const renderedValue = application.renderedValue || application.value || application.color;
    if (!/^#[a-f0-9]{3,8}$/i.test(renderedValue || "") || (application.value && application.color && application.value.toLowerCase() !== application.color.toLowerCase())) throw new Error(`H5_COLOR_DECLARATION_INVALID:${metadata.id}`);
    const source = String(application.source || "");
    const pointer = source.split(".");
    let bound = brandMod;
    for (const key of pointer) bound = bound?.[key];
    const value = typeof bound === "string" ? bound : bound?.value;
    const frozenToken = /^tokens\.(mapped|styleOnly)\./.test(source) && String(value || "").toLowerCase() === renderedValue.toLowerCase() && (!supportedIds || supportedIds.includes(source));
    const preservedNeutral = source === "preserved-host-neutral" && (/^#(?:000|000000|fff|ffffff)$/i.test(renderedValue) || hostSource.toLowerCase().includes(renderedValue.toLowerCase()));
    if (!frozenToken && !preservedNeutral) throw new Error(`H5_COLOR_SOURCE_UNBOUND:${metadata.id}:${source}`);
    if (frozenToken && brandMod?.manifest?.scope?.kind === "source-scoped-style-trial") validateScopedColorApplication(application, {brandMod,source,renderedValue,html:item.source,evidenceClaims,directionId:metadata.id});
    return { ...application, id: application.id || `${metadata.id}:color-${index}`, renderedValue };
  });
  return item;
}

function validateScopedColorApplication(application,{brandMod,source,renderedValue,html,evidenceClaims,directionId}) {
  const fail=reason=>{throw new Error(`H5_SCOPED_COLOR_${reason}:${directionId}:${source}`);};
  let tokens=[];
  const walk=node=>{if(!node||typeof node!=="object")return;if(Object.hasOwn(node,"$value")){tokens.push(node);return;}for(const [key,value] of Object.entries(node))if(!key.startsWith("$"))walk(value);};
  walk(brandMod.tokens?.dtcg);
  const target=source.replace(/^tokens\.styleOnly\./,"");
  const matches=tokens.filter(token=>token.$extensions?.["echo.brand.target"]===target);
  if(!source.startsWith("tokens.styleOnly.")||!target.startsWith("--style-")||matches.length!==1)fail("TOKEN_UNBOUND");
  const token=matches[0],ext=token.$extensions||{},scope=ext["echo.brand.scope"],roles=ext["echo.brand.allowedRoles"],recipeId=ext["echo.brand.recipeId"],refs=ext["echo.brand.evidenceRefs"];
  if(ext["echo.brand.channel"]!=="styleOnly"||String(token.$value||"").toLowerCase()!==renderedValue.toLowerCase())fail("TOKEN_UNBOUND");
  if(typeof scope!=="string"||!scope.trim()||/global|site[\s_-]*wide|entire|all[\s_-]*pages?|whole[\s_-]*(?:page|site)|page[\s_.-]*surface/i.test(scope))fail("SCOPE_INVALID");
  if(application.semanticRole==='surface.page'||(application.scope && /global|site[\s_-]*wide|entire|all[\s_-]*pages?|whole[\s_-]*(?:page|site)/i.test(application.scope)))fail("ROLE_FORBIDDEN");
  if(!Array.isArray(roles)||!roles.length||roles.some(role=>typeof role!=="string"||!role.trim())||!roles.includes(application.semanticRole))fail("ROLE_FORBIDDEN");
  if(!recipeId||application.recipeId!==recipeId||!array(brandMod.componentVariants).some(variant=>variant.id===recipeId&&variant.status!=="rejected"))fail("RECIPE_UNBOUND");
  if(!Array.isArray(refs)||!refs.length||refs.some(ref=>!evidenceClaims.has(ref))||!Array.isArray(application.evidenceRefs)||application.evidenceRefs.length!==refs.length||new Set(application.evidenceRefs).size!==refs.length||refs.some(ref=>!application.evidenceRefs.includes(ref)))fail("EVIDENCE_UNBOUND");
  const selector=application.selector;
  // Exact single-element selectors are mechanically resolvable here. Complex
  // selectors require rendering proof and cannot silently become a page rule.
  if(typeof selector!=="string"||!/^#[a-zA-Z_][\w-]*$/.test(selector)||/^#(?:app|root|page|site|document|viewport)$/i.test(selector))fail("SELECTOR_UNVERIFIED");
  const tags=[...html.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/gi)];
  const candidates=tags.filter(tag=>!/^<\//.test(tag[0])&&attribute(tag[0],"id")===selector.slice(1));
  if(candidates.length!==1||/^(?:html|body|main|head|style|script)$/i.test(candidates[0][1]))fail("SELECTOR_UNVERIFIED");
  const selected=candidates[0],name=selected[1].toLowerCase();let end=selected.index+selected[0].length,depth=1;
  if(!/^(?:input|img|br|hr|area|meta|link|source|embed|wbr)$/.test(name)){
    for(const tag of tags.filter(tag=>tag.index>selected.index))if(tag[1].toLowerCase()===name){depth+=/^<\//.test(tag[0])?-1:1;if(depth===0){end=tag.index+tag[0].length;break;}}
    if(depth!==0)fail("SELECTOR_UNVERIFIED");
  }
  const meaningful=tags.filter(tag=>!/^<\//.test(tag[0])&&!/^(?:html|body|head|style|script|meta|link|title)$/i.test(tag[1]));
  const nested=meaningful.filter(tag=>tag.index>selected.index&&tag.index<end);
  const stack=[];
  for(const tag of tags.filter(tag=>tag.index<selected.index)) {
    const name=tag[1].toLowerCase();
    if(/^<\//.test(tag[0])) {const at=stack.findLastIndex(open=>open[1].toLowerCase()===name);if(at>=0)stack.splice(at);}
    else if(!/^(?:input|img|br|hr|area|meta|link|source|embed|wbr)$/.test(name))stack.push(tag);
  }
  const ancestors=new Set(stack.map(tag=>tag.index));
  if(nested.length&&meaningful.every(tag=>ancestors.has(tag.index)||tag===selected||(tag.index>selected.index&&tag.index<end)))fail("SELECTOR_WHOLE_PAGE");
}

function normalizeStructuralSignature(value, metadata) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const description = requiredText(value, `STRUCTURAL_SIGNATURE_REQUIRED:${metadata.id}`);
  return {
    compositionRoles: ["navigation-shell", "task-bridge", "business-stream"],
    contentEntry: description,
    resultContainer: "preserved-search-filter-list",
    visualCenter: description,
    primaryActionPlacement: "declared-in-rendered-h5",
    resultPresentation: description,
  };
}

function normalizeInteractionRhythm(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const description = requiredText(value, "INTERACTION_RHYTHM_REQUIRED");
  return { peak: description, settled: description, carryThrough: description };
}

function buildRenderKit(directions, brandSystemSha256) {
  const expressive = [];
  const productive = [];
  const transitions = [];
  for (const { metadata } of directions) {
    for (const mechanism of metadata.brandMechanisms) {
      expressive.push({ id: `${metadata.id}:${mechanism.id}:expressive`, evidenceRef: mechanism.evidenceRef, sourcePageRef: mechanism.sourcePageRef || null, visibleEffect: mechanism.visibleEffect });
      productive.push({ id: `${metadata.id}:${mechanism.id}:productive`, systemRef: mechanism.systemRef, visibleApplication: mechanism.visibleApplication });
    }
    transitions.push({ id: `${metadata.id}:transition`, ...metadata.interactionRhythm });
  }
  return {
    schema: "brand-render-kit/v1",
    generatedBy: "finalize-h5-direction-stage.mjs",
    brandSystemSha256,
    expressive: { mechanisms: expressive },
    productive: { rules: productive },
    transition: { rules: transitions },
    directions: directions.map(({ metadata }) => ({
      id: metadata.id,
      visualWorld: `${metadata.title} — ${metadata.structuralSignature.visualCenter}`,
      expressiveMechanismRefs: metadata.brandMechanisms.map((item) => `${metadata.id}:${item.id}:expressive`),
      expressiveSourcePageRefs: [...new Set(metadata.brandMechanisms.map((item) => item.sourcePageRef).filter(Boolean))],
      productiveRuleRefs: metadata.brandMechanisms.map((item) => `${metadata.id}:${item.id}:productive`),
      transitionRuleRefs: [`${metadata.id}:transition`],
      identityAssetIds: [...new Set(metadata.brandMechanisms.map((item) => item.assetRef).filter(Boolean))],
    })),
  };
}

function buildPlan({ directions, baseline, baselineInput, startup, modInput }) {
  return {
    schema: "brand-application-plan/v1",
    generatedBy: "finalize-h5-direction-stage.mjs",
    contractSource: "h5-embedded-direction-metadata",
    hostClassification: Number(baseline.expressiveOpportunity?.maxFirstViewportRatio || 0) <= 0.2 ? "efficiency-first" : "balanced",
    brandSystemBinding: { brandModPath: path.basename(modInput.file), brandModSha256: modInput.sha256 },
    hostBinding: { targetRoute: startup.route || "/", viewport: startup.viewport || { width: 390, height: 844 }, baselinePath: path.basename(baselineInput.file), baselineSha256: baselineInput.sha256 },
    realDataContract: realDataBinding(baseline, baselineInput),
    options: directions.map(({ metadata, file }) => ({
      id: metadata.id,
      title: metadata.title,
      visualNarrative: `${metadata.title} uses the declared ${metadata.structuralSignature.visualCenter} composition.`,
      brandMechanisms: metadata.brandMechanisms,
      structuralSignature: metadata.structuralSignature,
      interactionRhythm: metadata.interactionRhythm,
      communicationHypothesis: metadata.communicationHypothesis,
      knowledgeRefs: metadata.knowledgeRefs,
      informationDistributionFit: distributionFit(baseline),
      resultHierarchyFit: metadata.resultHierarchyFit,
      previewEvidence: { path: relative(path.dirname(modInput.file), file), sha256: fileSha256(file) },
    })),
  };
}

function buildOptions({ directions, baseline, baselineInput, evidenceInput, modInput, brand }) {
  const shared = [baseline.informationDistributionContract?.model, ...array(baseline.resultContentContract?.fields)].filter(Boolean);
  return {
    schema: "wild-design-options/v1",
    workflow: "design-host",
    generatedBy: "finalize-h5-direction-stage.mjs",
    recommendation: { status: "pending-independent-h5-qa" },
    sourceBrand: brand,
    frozenBrandEvidenceSha256: evidenceInput.sha256,
    frozenBrandModSha256: modInput.sha256,
    sharedLayoutContract: shared,
    options: directions.map(({ metadata, file, path: artifactPath }) => ({
      id: metadata.id,
      name: metadata.title,
      recommended: false,
      sameBusinessScopeHash: baselineInput.sha256,
      brandEvidenceRefs: [...new Set(metadata.brandMechanisms.map((item) => item.evidenceRef))],
      previewEvidence: [{ path: relative(path.dirname(modInput.file), file), artifactPath, sha256: fileSha256(file), kind: "rendered-host-grounded-preview" }],
      differences: { informationDensity: metadata.structuralSignature.resultPresentation, visualAssets: metadata.brandMechanisms.map((item) => item.type).join("+"), pageStructure: stableJson(metadata.structuralSignature), motionIntensity: stableJson(metadata.interactionRhythm) },
      styleDirectionContract: { tokens: metadata.brandMechanisms.map((item) => item.systemRef), typography: mechanismsOf(metadata, "typography"), components: metadata.structuralSignature.compositionRoles, materials: mechanismsOf(metadata, "material"), motion: metadata.interactionRhythm },
      visualChoiceContract: { dominantColorRole: "frozen-brand-system-only", typographyCharacter: mechanismsOf(metadata, "typography"), assetStrategy: mechanismsOf(metadata, "asset"), materialLanguage: mechanismsOf(metadata, "material"), motionCharacter: metadata.interactionRhythm.carryThrough, imagePolicy: "no-imagegen-before-gap", forbiddenFallbacks: ["do not replace declared non-color mechanisms with color-only styling"] },
      designSystemConsumption: { mode: "host-grounded-preview", tokens: { status: "consumed", refs: metadata.brandMechanisms.map((item) => item.systemRef) }, components: { status: "consumed", refs: metadata.structuralSignature.compositionRoles }, assets: { status: "not-applicable", refs: ["imagegen-deferred-until-gap"] }, composition: { status: "consumed", refs: [metadata.structuralSignature.visualCenter] } },
      directionContract: { businessCapabilities: shared, layout: shared, structuralSignature: metadata.structuralSignature, interactionRhythm: metadata.interactionRhythm, knowledgeRefs: metadata.knowledgeRefs },
      communicationHypothesis: metadata.communicationHypothesis,
      realDataBinding: { ...distributionFit(baseline), baselinePath: path.basename(baselineInput.file), baselineSha256: baselineInput.sha256 },
      resultHierarchyFit: metadata.resultHierarchyFit,
    })),
  };
}

function realDataBinding(baseline, baselineInput) {
  return { inventedDataForbidden: true, baselinePath: path.basename(baselineInput.file), baselineSha256: baselineInput.sha256, resultContentMode: baseline.resultContentContract?.mode, fields: array(baseline.resultContentContract?.fields), informationDistributionContract: baseline.informationDistributionContract, resultHierarchyContract: baseline.resultHierarchyContract, communicationIntent: baseline.communicationIntent };
}

function distributionFit(baseline) {
  return { model: baseline.informationDistributionContract?.model, preservesPreviewUnit: true, preservesScanOrder: true, preservesComparisonBehavior: true, sourceMetaphorSubstitution: "none", inventedDataForbidden: true };
}

function validCommunicationHypothesis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const hierarchy = value.hierarchy || {};
  const utility = value.utility || {};
  const style = value.style || {};
  const hasText = (item, minimum) => [...String(item || "").trim()].length >= minimum;
  return hasText(hierarchy.attentionTarget, 2)
    && hasText(hierarchy.informationGain, 4)
    && hasText(utility.mainFunction, 4)
    && hasText(utility.obviousAction, 2)
    && hasText(utility.preservedConvention, 4)
    && hasText(style.sourceBasis, 4)
    && hasText(style.mechanismThesis, 8)
    && array(style.targetAttributes).length >= 2
    && array(style.targetAttributes).every((item) => String(item || "").trim().length >= 2);
}

function resultHierarchyFitMatches(fit, contract) {
  if (!fit || !contract || !["peer", "source-evidenced-differentiated"].includes(fit.relationship) || fit.preservesHostHierarchy !== true || fit.unsupportedDifferentiationForbidden !== true) return false;
  const refs = array(fit.evidenceRefs);
  const allowed = new Set(array(contract.evidence).map((item) => item?.id).filter(Boolean));
  if (refs.some((ref) => !allowed.has(ref))) return false;
  if (fit.relationship === "peer") return fit.resultSpecificEmphasis === "none" && refs.length === 0;
  return contract.differentiationAllowed === true && fit.resultSpecificEmphasis !== "none" && refs.length > 0;
}

function validateBaselineBinding(baseline, baselineSha, startup, startupSha, knowledge) {
  if (baseline.schema !== "host-startup-baseline/v1" || baseline.hostStartupPageSha256 !== startupSha) throw new Error("HOST_BASELINE_STARTUP_BINDING_INVALID");
  if (!baseline.resultContentContract?.mode || array(baseline.resultContentContract?.fields).length < 3 || baseline.resultContentContract?.anonymousSkeletonsForbidden !== true) throw new Error("HOST_BASELINE_REAL_DATA_CONTRACT_INVALID");
  if (!baseline.informationDistributionContract?.model || !array(baseline.informationDistributionContract?.scanOrder).length || !baseline.informationDistributionContract?.comparisonBehavior) throw new Error("HOST_BASELINE_INFORMATION_DISTRIBUTION_INVALID");
  if (!baseline.resultHierarchyContract?.defaultRelationship || typeof baseline.resultHierarchyContract?.differentiationAllowed !== "boolean") throw new Error("HOST_BASELINE_RESULT_HIERARCHY_INVALID");
  if (baseline.communicationIntent?.framework !== "hierarchy-utility-style/v1") throw new Error("HOST_BASELINE_COMMUNICATION_INTENT_INVALID");
  if (knowledge.hostContext?.baselineSha256 !== baselineSha) throw new Error("KNOWLEDGE_BASELINE_HASH_MISMATCH");
  if (!startup.sourceSha256) throw new Error("HOST_STARTUP_SOURCE_HASH_REQUIRED");
}

function verifyFrozenHostSource(workspace, startup) {
  const hostRoot = path.isAbsolute(startup.hostRoot || "") ? path.resolve(startup.hostRoot) : path.resolve(workspace, startup.hostRoot || ".");
  const file = path.resolve(hostRoot, startup.sourceFile || "");
  if (!startup.sourceFile || !fs.existsSync(file) || !fs.statSync(file).isFile() || fileSha256(file) !== startup.sourceSha256) throw new Error("FROZEN_HOST_SOURCE_HASH_MISMATCH");
  return { file, sha256: startup.sourceSha256 };
}

export function collectSystemRefs(intent, mod) {
  return new Set(collectSystemReferenceCatalog(intent, mod).flatMap((entry) => entry.refs));
}

// Exact accepted references, not an approval catalog. Keep selection semantics from
// the frozen object alongside aliases without copying large source objects.
export function collectSystemReferenceCatalog(intent, mod) {
  const entries = [];
  const add = (source, refs, value) => {
    if (!refs.length) return;
    const semantics = value && typeof value === "object" ? Object.fromEntries(["id", "approvedPatternId", "status", "name", "title", "role", "targetScope", "description", "purpose", "rule"].filter((key) => typeof value[key] === "string").map((key) => [key, value[key].slice(0, 180)])) : { value: String(value).slice(0, 180) };
    entries.push({ source, refs: [...new Set(refs)], ...semantics });
  };
  for (const group of ["patterns", "semanticClaims", "styleRecipeDetails"]) for (const [index, item] of array(intent[group]).entries()) if (item?.id) {
    add(`intent.${group}.${index}`, [item.id], item);
    if (group === "styleRecipeDetails") Object.assign(entries.at(-1), Object.fromEntries(["scope", "statesApproved", "statesBlocked", "evidenceRefs", "sourceMeasurements"].filter(key => item[key] !== undefined).map(key => [key, item[key]])));
  }
  for (const group of ["componentVariants", "slots", "assets"]) for (const [index, item] of array(mod[group]).entries()) {
    const refs = [];
    if (group !== "assets" && item?.id) refs.push(item.id);
    if (group === "componentVariants" && item?.approvedPatternId) refs.push(item.approvedPatternId);
    if (group !== "slots" && item?.id && item.status !== "rejected") refs.push(`${group}.${index}`);
    add(`mod.${group}.${index}`, refs, item);
  }
  for (const [key, value] of Object.entries(mod.semanticRoles || {})) add(`mod.semanticRoles.${key}`, [key], value);
  for (const [channel, values] of Object.entries(mod.tokens || {})) if (["mapped", "styleOnly"].includes(channel) && values && typeof values === "object") for (const key of Object.keys(values)) {
    const normalized = key.replace(/^--/, "");
    add(`mod.tokens.${channel}.${key}`, [key, normalized, `${channel}.${normalized}`, `tokens.${channel}.${normalized}`], values[key]);
  }
  for (const [key, value] of Object.entries(mod.layoutRules || {})) add(`mod.layoutRules.${key}`, [`layoutRules.${key}`], value);
  return entries;
}

function mechanismsOf(metadata, type) {
  return metadata.brandMechanisms.filter((item) => item.type === type).map((item) => item.id).join("+") || `declared-${type}-neutral`;
}
function attribute(tag, name) { return String(tag || "").match(new RegExp(`${escapeRegExp(name)}=["']([^"']+)["']`, "i"))?.[1] || ""; }
function escapeRegExp(value) { return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function stableJson(value) { return JSON.stringify(sortObject(value)); }
function sortObject(value) { if (Array.isArray(value)) return value.map(sortObject); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])])); }
function readJson(file, code) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error(code); } }
function requiredText(value, code) { const result = String(value || "").trim(); if (!result) throw new Error(code); return result; }
function resolveFrom(root, value) { return path.isAbsolute(String(value || "")) ? path.resolve(value) : path.resolve(root, String(value || "")); }
function relative(root, file) { return path.relative(root, file).split(path.sep).join("/"); }
function insideExistingFile(base, file, code) { const candidate = path.resolve(file); if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) throw new Error(code); if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) throw new Error(`${code}:MISSING`); const realBase = fs.realpathSync(base); const realCandidate = fs.realpathSync(candidate); if (realCandidate !== realBase && !realCandidate.startsWith(`${realBase}${path.sep}`)) throw new Error(code); return candidate; }
function insideOutput(base, file, code) { const candidate = path.resolve(file); if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) throw new Error(code); let ancestor = path.dirname(candidate); while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor); const realBase = fs.realpathSync(base); const realAncestor = fs.realpathSync(ancestor); if (realAncestor !== realBase && !realAncestor.startsWith(`${realBase}${path.sep}`)) throw new Error(code); return candidate; }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function shellWord(value) { return `'${String(value).replaceAll("'", "'\\''")}'`; }

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const values = (flag) => process.argv.flatMap((item, index) => item === flag && process.argv[index + 1] ? [process.argv[index + 1]] : []);
  const value = (flag, fallback = "") => values(flag)[0] || fallback;
  try {
    const result = finalizeH5DirectionStage({ root: value("--root", process.cwd()), brand: value("--brand"), dispatchFile: value("--dispatch"), htmlFiles: values("--html"), producerExecutionId: value("--producer-execution-id"), receiptFile: value("--receipt") });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error.message, ...(error.errors ? { errors: error.errors } : {}) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
