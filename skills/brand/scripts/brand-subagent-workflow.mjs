#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { freezeDesignKnowledge } from "./freeze-design-knowledge.mjs";
import { deriveHostStartupBaseline } from "./derive-host-startup-baseline.mjs";
import { validatePreviewGrant, normalizeHostRecommendation } from "./parent-delivery-gate.mjs";
import { validateTransferReview, installTransferReview } from "./source-transfer-input.mjs";
import { validateLocalSelectedMaster, captureSelectedH5OriginalSnapshot } from "./selected-h5-handoff.mjs";
import { selectedPosteditContext } from "./selected-h5-postedit-context.mjs";
import { hostPreviewSmokeContract, validateHostPreviewSmoke } from "./host-preview-smoke.mjs";
import { retryHostPreviewQa, validateHostPreviewQaRetries, assertFreshHostPreviewQaReviewer } from "./host-preview-qa-retry.mjs";
import { validateQaReview, isQaArtifact } from "./qa-review-contract.mjs";
import { validateQaDispatchRevocations } from "./revoke-undelivered-qa-dispatch.mjs";
import { readCanonicalLearningProof } from "./learning-proof-contract.mjs";
import { revalidateLearningFidelity } from "./revalidate-learning-fidelity.mjs";
import { readNativeSourceInput } from './native-source-input.mjs';
import { collectSystemReferenceCatalog, navigationShellCompletionContract, validateExpressiveGeneration } from "./finalize-h5-direction-stage.mjs";
import { resolveEvidenceReference } from "./evidence-file-references.mjs";
import { componentKitHandoff } from "./install-component-kit.mjs";
import { frozenRuntimeAssetInputs } from "./validate-brand-render-kit.mjs";

const args = process.argv.slice(2);
const command = args[0];
const root = path.resolve(opt("--root", process.cwd()));
const skillRoot = path.resolve(process.env.BRAND_SKILL_ROOT || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const brand = opt("--brand", "");
if (!command || !brand) fail("Usage: brand-subagent-workflow.mjs <prepare|declare-capability|next|record|approve-concepts|reject-concepts|approve-preview|status|resume-concepts|resume-evidence|resume-interpreter|resume-qa|resume-demo|finalize> --brand <brand>");

const migrationDir = path.join(root, "migrations", brand);
const goalFile = path.join(migrationDir, "goal-contract.json");
const manifestFile = path.join(migrationDir, "execution-manifest.json");
const contractFile = path.join(skillRoot, "workflow-contract.json");
const designHostRouteFile = path.join(migrationDir, "design-host-route.json");
const executionCapabilitiesFile = path.join(migrationDir, "execution-capabilities.json");
const hostStartupPageFile = path.join(migrationDir, "host-startup-page.json");
const hostStartupBaselineFile = path.join(migrationDir, "host-startup-baseline.json");
const hostStartupBaselineScaffoldFile = path.join(migrationDir, "scaffolds", "host-startup-baseline.template.json");
const fastHostBriefScaffoldFile = path.join(migrationDir, "scaffolds", "fast-host-brief.template.json");
const designKnowledgeBundleFile = path.join(migrationDir, "design-knowledge-bundle.json");
const conceptDirectionBriefsFile = path.join(migrationDir, "concept-direction-briefs.json");
const brandRenderKitFile = path.join(migrationDir, "brand-render-kit.json");
const conceptQaFile = path.join(migrationDir, "design-host-concept-qa.json");
const h5AuditFile = path.join(migrationDir, "design-host-h5-audit.json");
const h5MechanicalQaFile = path.join(migrationDir, "design-host-h5-mechanical-qa.json");
const expressiveGapFile = path.join(migrationDir, "design-host-expressive-gap.json");
const expressiveIntegrationQaFile = path.join(migrationDir, "design-host-expressive-integration-qa.json");
const sceneReconstructionFile = path.join(migrationDir, "scene-reconstruction.json");
const hostPageInventoryFile = path.join(migrationDir, "host-page-inventory.json");
const hostProductiveBaselineFile = path.join(migrationDir, "host-productive-baseline.json");
const hostStructuralTargetsFile = path.join(migrationDir, "structural-targets.json");
const hostPreeditBaselineBundleFile = path.join(migrationDir, "preedit-baseline-bundle.json");
const h5DirectionDirectory = path.join(migrationDir, "h5-directions");
const h5DirectionScaffoldFiles = ["direction-a.html", "direction-b.html", "direction-c.html"].map((name) => path.join(h5DirectionDirectory, name));

if (command === "prepare") prepare();
else if (command === "declare-capability") declareCapability();
else if (command === "next") next();
else if (command === "record") record();
else if (command === "approve-concepts") approveConcepts();
else if (command === "reject-concepts") rejectConcepts();
else if (command === "approve-preview") approvePreview();
else if (command === "status") status();
else if (command === "resume-concepts") resumeConcepts();
else if (command === "retry-h5") retryH5();
else if (command === "retry-host-strategy") retryHostStrategy();
else if (command === "retry-host-implementation") retryHostImplementation();
else if (command === "retry-host-preview-qa") retryHostPreviewQaStage();
else if (command === "resume-evidence") resumeEvidence();
else if (command === "resume-interpreter") resumeInterpreter();
else if (command === "resume-learning-closure") resumeLearningClosure();
else if (command === "resume-qa") resumeQa();
else if (command === "resume-demo") resumeDemo();
else if (command === "finalize") finalize();
else fail(`Unknown command: ${command}`);

function prepare() {
  if (fs.existsSync(manifestFile)) {
    const existing = readJsonRequired(manifestFile);
    fail(`EXECUTION_MANIFEST_ALREADY_EXISTS: execution-manifest.json already exists; prepare must not overwrite run history. Existing run ${existing.runId || "unknown"} is ${existing.status || "unknown"}. Resume or inspect it, or create a new versioned brand workspace.`);
  }
  const goal = readJsonRequired(goalFile);
  if (goal.sealed !== true) fail("goal-contract.json must be sealed before prepare.");
  const contract = readJsonRequired(contractFile);
  const mode = goal.mode || "learn-brand";
  const sourceContinuationFile = path.join(root, 'source-continuation.json');
  const sourceContinuation = fs.existsSync(sourceContinuationFile) ? readJsonRequired(sourceContinuationFile) : null;
  const previewContinuation = sourceContinuation?.continuationScope === 'macro-host-journey' ? { continuation: hashedPath('source-continuation.json'), readiness: sourceContinuation.previewReadiness } : null;
  if (previewContinuation && (mode !== 'design-host' || validatePreviewGrant(root, previewContinuation)?.error)) fail('HOST_PREVIEW_SCOPE_BINDING_INVALID');
  const executionProfile = goal.executionProfile || (["design-host", "apply-host"].includes(mode) ? "fast" : "full");
  const knowledgeScenarioId = goal.knowledgeScenarioId || null;
  if (knowledgeScenarioId) {
    const index = readJsonRequired(path.join(root, "public", "knowledge", "v0.1", "index.json"));
    if (mode !== "design-host" || !array(index.scenarios).some((item) => item.id === knowledgeScenarioId)) fail(`KNOWLEDGE_SCENARIO_UNKNOWN: ${knowledgeScenarioId}`);
  }
  if (mode === "design-host" && executionProfile === "fast" && [goal.thresholds?.minimumSelectableDirections, goal.thresholds?.maximumSelectableDirections].some((count) => count != null && Number(count) !== 3)) fail("DESIGN_HOST_THREE_DIRECTIONS_REQUIRED: fast design-host must produce three selectable interactive H5 directions before any optional ImageGen enhancement.");
  let deterministicStartupDiagnosis = null;
  if (mode === "design-host") {
    initializeDesignHostRoute();
    if (executionProfile === "fast") {
      initializeFastDesignHostScaffolds();
      deterministicStartupDiagnosis = deriveHostStartupBaseline({ root, brand });
      verifyHostStartupBaseline();
    }
  }
  if (mode === "apply-host") verifyDesignHostRoute("before-apply-host");
  const initialStage = initialStageForMode(mode, executionProfile);
  const createdAtMs = Date.now();
  const manifest = {
    schema: "brand-subagent-execution/v1",
    runId: crypto.randomUUID(),
    brand,
    mode,
    ...(previewContinuation ? { previewContinuation } : {}),
    executionProfile,
    knowledgeScenarioId,
    goalId: goal.goalId,
    goalPath: relative(goalFile),
    goalSha256: sha256File(goalFile),
    roleContractVersion: contract.roleContractVersion || null,
    status: "running",
    createdAt: new Date(createdAtMs).toISOString(),
    previewTargetAt: mode === "design-host" && executionProfile === "fast" ? new Date(createdAtMs + 300000).toISOString() : null,
    deadlineAt: mode === "design-host" && executionProfile === "fast" ? new Date(createdAtMs + 1200000).toISOString() : null,
    currentStageId: initialStage.id,
    stages: [initialStage],
    finalGates: {},
    telemetry: {
      dispatchCount: 0,
      inputFiles: 0,
      inputBytes: 0,
      uniqueInputFiles: 0,
      uniqueInputBytes: 0,
      duplicateInputFiles: 0,
      duplicateInputBytes: 0,
      outputFiles: 0,
      outputBytes: 0,
      additionalReadBytes: 0,
      imageGenerationCalls: 0,
      promptCharacters: 0,
      modelUsage: { reportedReceipts: 0, inputTokens: 0, outputTokens: 0 },
      stageDurationsMs: {},
      seenInputSha256: [],
    },
    deterministicStartupDiagnosis,
  };
  if (deterministicStartupDiagnosis) {
    manifest.telemetry.outputFiles += deterministicStartupDiagnosis.outputs.length;
    manifest.telemetry.outputBytes += deterministicStartupDiagnosis.outputs.reduce((sum, item) => sum + Number(item.bytes || 0), 0);
    manifest.telemetry.additionalReadBytes += Number(deterministicStartupDiagnosis.sourceBytes || 0);
    manifest.telemetry.stageDurationsMs.deterministicStartupDiagnosis = deterministicStartupDiagnosis.durationMs;
  }
  writeJson(manifestFile, manifest);
  const nextInstruction = `Run next to obtain the ${initialStage.stage} dispatch request.`;
  output({ ok: true, manifest: relative(manifestFile), runId: manifest.runId, next: nextInstruction });
}

function next() {
  const manifest = validateManifest();
  const resumedMechanical = args.includes("--resume-mechanical") ? resumePendingMechanicalQa(manifest) : false;
  enforceDesignHostDeadline(manifest);
  if (manifest.status !== "running") return output({ ok: false, status: manifest.status, message: "Workflow is not dispatchable." }, 2);
  const current = manifest.stages.find((item) => item.id === manifest.currentStageId);
  if (!current || current.status !== "pending") fail("Current stage is not pending; record its receipt or inspect status.");
  if (manifest.mode === "learn-brand" && current.role === "visualQA" && !current.qaReview && (current.qaReviewProtocol === "brand-qa-review-input/v2" || manifest.stages.some(item => item.qaReview && readJsonRequired(path.resolve(root,item.qaReview.path)).schema === "brand-qa-review-input/v2"))) fail("QA_REVIEW_PREPARATION_REQUIRED");
  if (manifest.mode === "learn-brand" && current.qaReviewHandoff) {
    verifyHashedPath(current.qaReviewHandoff);
    const handoff=readJsonRequired(path.resolve(root,current.qaReviewHandoff.path));
    if (handoff.reviewId !== current.reviewId || !["ready","waiting-capacity","reuse-original-qa"].includes(handoff.state)) fail("QA_REVIEW_HANDOFF_INVALID");
    if (handoff.capacityError) verifyHashedPath(handoff.capacityError);
    if (handoff.state === "waiting-capacity") return output({ok:false,status:"waiting-capacity",handoff:current.qaReviewHandoff,spawnAttempted:false,message:"Recorded capacity failure; no dispatch or repeated spawn. Prepare a separately authorized ready/reuse handoff when capacity is available."},2);
  }
  if (manifest.mode === "design-host" && current.stage === "h5DirectionGeneration") {
    verifyHostStartupBaseline();
    freezeDesignHostKnowledge();
    verifyDesignHostRoute("before-h5-direction-dispatch");
  }
  if (manifest.mode === "design-host" && current.stage === "designVisualQA" && !resumedMechanical) ensureDesignHostH5MechanicalQa(manifest);
  if (manifest.mode === "design-host" && current.stage === "expressiveAssetGeneration") {
    verifyConceptCapability(manifest, current);
    verifyDesignHostRoute("before-expressive-dispatch");
  }
  if (manifest.mode === "design-host" && current.stage === "expressiveVisualQA") verifyDesignHostRoute("before-expressive-qa");
  if (current.stage === "demo") {
    verifyDesignDirectionGate();
    if (manifest.mode==="learn-brand" && readJsonRequired(goalFile).goalType==="brand-learning-capability-test") verifyLearningModOutput([...manifest.stages].reverse().find(item=>item.role==="designTranslator" && item.status==="complete")?.outputHashes);
  }
  if (current.role === "hostImplementationAgent") {
    if (current.retryInput?.priorStageId) {
      for (const ref of array(current.retryInput.currentHostInputs)) verifyHashedPath(ref);
      const prior=manifest.stages.find(item=>item.id===current.retryInput.priorStageId);
      verifyHostPreeditGate("retry",readJsonRequired(path.resolve(root,prior.receiptPath)),prior.id);
    } else verifyHostPreeditGate("dispatch");
  }
  if (current.role === "hostImplementationAgent") ensureSelectedOriginalBinding(manifest);
  const contract = readJsonRequired(contractFile);
  const baseRoleContract = contract.roles?.[current.role];
  const roleContract = baseRoleContract && manifest.mode === "apply-host" && current.stage === "previewQA"
    ? { ...baseRoleContract, ...hostPreviewSmokeContract(current.id) }
    : baseRoleContract;
  if (!roleContract) fail(`Missing role contract for ${current.role}.`);
  const partialGrant = validatePreviewGrant(root, manifest.previewContinuation);
  if (partialGrant?.error) fail(partialGrant.error);
  const sourceTransfer = current.retryInput?.sourceTransfer || (current.stage !== "h5DirectionGeneration" ? [...manifest.stages].reverse().find((item) => item.stage === "h5DirectionGeneration" && item.status === "complete")?.retryInput?.sourceTransfer : null);
  const componentKits = ["h5DirectionGeneration", "designVisualQA"].includes(current.stage)
    ? componentKitHandoff({root, kits: readJsonRequired(path.join(migrationDir, "brand-mod.json")).componentKits || []}) : [];
  const sourceVisualEvidence = current.stage === "h5DirectionGeneration" ? h5ProducerSourceCaptures() : null;
  const inputs = latestInputsByPath([...dispatchInputs(manifest, current), ...componentKits.flatMap(kit => kit.files), ...(manifest.previewContinuation ? [manifest.previewContinuation.continuation, manifest.previewContinuation.readiness] : []), ...array(sourceTransfer?.inputs)]);
  const qaReview = manifest.mode === "learn-brand" && current.role === "visualQA" && current.qaReview ? readJsonRequired(path.resolve(root, current.qaReview.path)) : null;
  if (qaReview) { verifyHashedPath(current.qaReview); try { validateQaReview(root, qaReview); } catch (error) { fail(error.message); } }
  const reviewMode = manifest.mode === "learn-brand" && current.role === "visualQA" ? qaReview?.reviewMode || (manifest.stages.some(item => item.role === "visualQA" && item.receiptPath) ? "fresh-blind" : "initial-blind") : null;
  const fastOverride = fastDesignHostOverride(manifest, current);
  if (current.stage === "h5DirectionGeneration" && fastOverride) {
    fastOverride.mission = "Generate three genuinely different interactive H5 directions: ImageGen authors expressive imagery during design exploration; the frozen website design system supplies productive controls, typography and components. Preserve host business, not its old layout.";
    fastOverride.requirements = fastOverride.requirements.filter(item => item !== "do not call image_gen");
    fastOverride.failCriteria = fastOverride.failCriteria.filter(item => item !== "ImageGen or host-source mutation");
    const expressiveRequired = readJsonRequired(goalFile).expressiveProduction?.required === true;
    fastOverride.failCriteria.push("host-source mutation");
    if (expressiveRequired) fastOverride.failCriteria.push("missing generated expressive asset in any direction", "the same generated image reused as three directions");
    fastOverride.requirements.push(`${expressiveRequired ? "ImageGen expressive is required in every direction by the frozen user goal." : "The designer may use ImageGen expressive during initial design when appropriate; it is not restricted to post-QA repair."} Supply frozen source screenshots and assets as image inputs; keep business text and controls in HTML. Record exact prompt, reference hashes, tool call id and output hash per generated direction. No old-layout Hero veto. Do not infer global CTA semantics from a matching database module.`);
    fastOverride.hints.imageGenerationForbidden = false;
    fastOverride.hints.expressiveProduction = { required: expressiveRequired, metadataField: "expressiveGeneration", fields: ["toolCallId", "prompt", "inputImages:[{path,sha256}]", "asset:{path,sha256}", "visualDirection"], scope: "replaceable expressive raster layer; never productive text, controls or invented business records" };
    fastOverride.hints.universalSkinFormula.expressive = "ImageGen during initial art-direction exploration";
  }
  if (current.stage === "designVisualQA" && fastOverride) fastOverride.requirements.push("Check each direction's generated expressive asset and productive system together. not-required means no ADDITIONAL local asset repair, never permission to omit the initial ImageGen expressive requirement. Reject repeated imagery, same composition, or database-only generic utility variants.");
  if (current.stage === "designVisualQA" && fastOverride) {
    fastOverride.tasks.unshift("Compare each claimed mechanism with the supplied frozen brand scope and selected source captures; inspect source images as well as generated captures. Producer hypotheses are claims to test, not evidence of fidelity.");
    fastOverride.hints.sourceComparison = {
      brandInputs: inputs.filter(item => /\/(brand-evidence|brand-intent|brand-mod|approved-visual-patterns)\.json$/.test(item.path)),
      sourceCaptures: inputs.filter(item => /\.(png|jpe?g|webp)$/i.test(item.path) && !array(readJsonRequired(h5MechanicalQaFile).directions).some(direction => direction.capture?.path === item.path)),
      rule: "Use only the frozen source scope, not producer assertions. Structure-only permission does not authorize typography, framing or identity. If the selected sources cannot establish a claimed visible mechanism, report that gap; do not infer approval from valid IDs or direction diversity. Do not recapture the website.",
    };
  }
  if (fastOverride?.hints?.completionContract && current.stage === "h5DirectionGeneration") {
    const frozen = (name) => {
      const input = inputs.find((entry) => path.basename(entry.path) === name);
      if (!input) fail(`REQUIRED_INPUT_MISSING:${name}`);
      verifyHashedPath(input);
      return readJsonRequired(path.resolve(root, input.path));
    };
    const completion = fastOverride.hints.completionContract;
    completion.systemReferences = {
      rule: "refs are literal accepted brandMechanisms.systemRef values; source locates the frozen object, not an additional accepted ref. Existence is not approval or host-use authorization. Respect status, evidence, supported scope and pattern-binding gates. Choose by source meaning; never substitute a different semantic to pass validation. Unique suffix normalization remains available; ambiguous or unknown references fail.",
      entries: collectSystemReferenceCatalog(frozen("brand-intent.json"), frozen("brand-mod.json")),
    };
    completion.navigationShell = navigationShellCompletionContract(frozen("host-startup-baseline.json").navigationShellContract);
    completion.selectionControls = {
      implementation: "Use native select/checkbox/radio or real toggle buttons with aria-pressed synchronized with visual selection and reset. aria-selected belongs to an appropriate selection widget, not arbitrary buttons. Navigation tabs and opening a drawer do not prove filtering.",
      disclosure: "Collapsed filters use a button with synchronized aria-expanded and aria-controls pointing to the real panel, or native details/summary. Keep controls reachable and test opening then changing a selection before submission.",
      unavailableData: "Use only frozen real options or explicitly authorized labeled fixtures. Missing data must remain explicit loading/empty UI with unavailable controls disabled; never fabricate options or claim selection passed. A single-option select is not a verified filter. Report the limitation to the orchestrator rather than return a false complete result.",
      selfCheck: "Before finalizer, exercise search and a real selection in each direction, including disclosure and reset where present. Class-only changes, drawer visibility and loading messages cannot replace selection-state proof. The mechanical gate reports unavailable separately but does not approve it as working filtering.",
    };
  }
  if (fastOverride?.hints?.completionContract?.embeddedMetadata) fastOverride.hints.completionContract.embeddedMetadata.patternBindings = {
    location: "productionFormula.productive.patternBindings (and visualProgram.productionFormula when present)",
    fields: ["patternId: exact unique ID in the MOD-linked frozen approved-visual-patterns.json", "systemRef: optional exact MOD dotted path; if supplied its id or approvedPatternId must match", "regionSelector: actual HTML region", "consumedRequiredLayers", "omittedLayers: explicit reasons", "adaptation: actual host adaptation within source boundaries"],
    rule: "Do not guess aliases or copy source product fields into the host. Finalizer binds the dispatch-hashed catalog and preserves its constraints for independent QA; binding success does not approve visual fidelity or prohibited adaptations. A missing catalog or conflicting explicit reference is an error."
  };
  const request = {
    schema: "brand-subagent-dispatch/v1",
    dispatchId: crypto.randomUUID(),
    runId: manifest.runId,
    stageId: current.id,
    stage: current.stage,
    role: current.role,
    ...(reviewMode ? { reviewMode, reviewId: qaReview?.reviewId || crypto.randomUUID(), ...(qaReview ? { qaExecutionId: qaReview.qaExecutionId, priorReviewReceipt: qaReview.priorReviewReceipt, qaReviewInput: current.qaReview } : {}) } : {}),
    ...(roleContract.acceptanceScope ? { acceptanceScope: roleContract.acceptanceScope, acceptanceContractVersion: roleContract.acceptanceContractVersion, roleReference: roleContract.roleReference } : {}),
    ...(roleContract.reportFieldContract ? { reportFieldContract: roleContract.reportFieldContract } : {}),
    ...(current.stage === "hostStrategy" ? { completionTemplate: { productiveBaseline: { schema: "host-productive-baseline/v1", derivationSource: "host-scan", hostPageInventorySha256: "<exact inventory hash>", targetPageId: "<inventory page id>", pages: [{ id: "<each inventory page id exactly once>", sourceFile: "<source path>", primaryTask: "<task>", primaryAction: "<action>", pageType: "<type>", repeatFrequency: "rare | occasional | frequent", firstActionUrgency: "low | medium | high", expressiveCapacity: "low | medium | high", heroEligibility: { eligible: "<boolean>", reason: "<evidence-based reason>" }, productiveRequirements: { coreEntry: "<entry>", businessObjectsVisible: ["<real object>"], aboveFoldPriority: "<priority>", warmReturnState: "settled" } }] }, structuralTargets: { targets: [{ route: "<existing route>", sourceFile: "<absolute source path>", baselineFile: "<new isolated baseline path>" }] }, owner: "hostStrategist", note: "These are exact required enums/fields, not permission to invent judgments. The orchestrator captures preedit snapshots after the strategy receipt." } } : {}),
    ...(current.stage === "hostImplementation" && fs.existsSync(path.join(migrationDir, "approved-master.json")) && readJsonRequired(path.join(migrationDir, "approved-master.json")).permissionScope === "local-host-implementation-only" ? { ownedNextRequirement: { owner: "designDirectorOrchestrator", status: "required-before-host-edits", code: "SELECTED_H5_POSTEDIT_ORIGINAL_BINDING_REQUIRED", instruction: "Capture immutable original source/style snapshots and validate the explicit post-edit binding contract before editing. Current default gates still bind original live hashes; this dispatch does not claim that post-edit acceptance or native QA is ready." } } : {}),
    collaboration: ["design-host", "apply-host"].includes(manifest.mode) ? contract.hostCollaboration : null,
    attempt: current.attempt,
    retryInput: reviewMode && reviewMode !== "regression-review" ? null : interpreterCorrectiveDispatch(current) || current.retryInput || null,
    ...(sourceTransfer ? { sourceTransfer, sourceTransferApplicationTemplate: { ruleId: "<permittedRuleId>", ruleScope: "<exact rule.scope>", region: "<host region>", selector: "#existing-region-id", sourceReviewSha256: sourceTransfer.review.sha256, evidenceRefs: ["<rule evidenceRef>"], hostReason: "<why this fits the frozen host task>", usage: "candidate-trial | reference-only", assetRef: "<required for conditional illustration rule>" } } : {}),
    goalId: manifest.goalId,
    goalSha256: manifest.goalSha256,
    mission: fastOverride?.mission || roleContract.goal,
    roleContractVersion: manifest.roleContractVersion,
    executionProfile: manifest.executionProfile,
    timeBudget: manifest.mode === "design-host" && manifest.executionProfile === "fast"
      ? {
          scope: "prepare-to-reviewable-three-interactive-h5-directions-with-role-quality-preserved",
          previewTargetAt: manifest.previewTargetAt,
          deadlineAt: manifest.deadlineAt,
          remainingMs: Math.max(0, Date.parse(manifest.deadlineAt) - Date.now()),
          targetPolicy: "Five minutes is a progress/SLA target, not permission to skip or terminate required specialist roles.",
          stopCode: "DESIGN_HOST_FAST_SAFETY_LIMIT_EXCEEDED",
          stopAction: "Stop only at the twenty-minute safety limit with partial artifacts; do not skip host diagnosis, H5 generation or independent QA to hit the five-minute target.",
        }
      : null,
    profileContract: manifest.mode === "apply-host"
      ? contract.applyHostExecutionProfiles?.[manifest.executionProfile] || null
      : manifest.mode === "design-host"
        ? contract.designHostExecutionProfiles?.[manifest.executionProfile] || null
        : contract.executionProfiles?.[manifest.executionProfile] || null,
    requiredInputs: inputs,
    ...(sourceVisualEvidence ? { sourceVisualEvidence } : {}),
    ...(componentKits.length ? { componentKits, componentKitUsage: "These are available implementations, not new brand approval. Read the designGuide when present, then inspect entry/styles and usage/scope. Reuse compatible code; explicitly adapt incompatible runtimes. Trial/unspecified status remains unchanged. Guides explain existing evidence and cannot expand source permissions. Do not install dependencies or execute package code merely to inspect it." } : {}),
    allowedInputs: [...(roleContract.inputs?.allowed || []), ...(current.stage === "designVisualQA" ? ["listed frozen brand scope and selected source captures; producer hypotheses only as claims to verify, never desired verdicts"] : []), ...(reviewMode === "regression-review" ? ["hash-bound prior QA failure and affected/regressionScope only; not fresh blind review"] : []), ...(current.retryInput?.qaRepair ? ["current scoped corrective observations (source facts only; no QA verdict or implementation rationale)"] : [])],
    forbiddenInputs: (roleContract.inputs?.forbidden || []).filter(item => !(reviewMode === "regression-review" && /prior.*verdict|previous.*verdict/i.test(item)) && !(current.stage === "designVisualQA" && item === "translation claims absent from goal contract")).concat(current.stage === "designVisualQA" ? ["unbound translation claims or producer assertions treated as approved source facts"] : []),
    tasks: [...(sourceVisualEvidence ? ["Open the hash-bound sourceVisualEvidence captures relevant to the host task before composing directions; use claimIds to locate their evidence scope. Report missing relevant visual evidence instead of guessing paths or source facts. Screenshots are observation evidence only, never runtime assets or additional approval."] : []), ...(fastOverride?.tasks || roleContract.tasks || [])],
    requirements: [...(roleContract.requirements || []), ...(fastOverride?.requirements || []), ...(sourceTransfer ? ["The explicit additive sourceTransfer input permits only its independently reviewed candidate rules for this isolated attempt. Keep their candidate statuses and every exclusion; never promote them to reusable Patterns, global tokens, source-learning certification or apply-host permission. Use host/system fonts only. Each H5 metadata must declare transferRuleApplications with the supplied template; preserve mandatory original MOD mechanisms separately. Reference-only rules require usage=reference-only; conditional illustration requires a separately hash-verified runtime asset already allowed by the original grant. Independent H5 QA must check these applications against their declared scopes and exclusions."] : [])],
    scopeRules: [...dispatchScopeRules(manifest), ...(partialGrant ? ['This is a macro-host-journey trial with learningComplete:false; retain source-learning failure and every unresolved exclusion. Use only allowedUse.supportedIds and assets from the hash-bound preview-readiness grant; reject any mechanism outside that grant. Never modify host source or claim full source-learning certification.'] : [])],
    ...(partialGrant ? { partialBrandValidation: partialGrant } : {}),
    mustNot: roleContract.mustNot || [],
    expectedOutputs: fastOverride?.expectedOutputs || roleContract.outputs || [],
    passCriteria: fastOverride?.passCriteria || roleContract.passCriteria || [],
    failCriteria: fastOverride?.failCriteria || roleContract.failCriteria || [],
    contextPolicy: {
      strategy: "minimum-role-packet",
      readOnlyListedInputs: true,
      forbiddenBulkReads: [
        "skills/brand/workflow-contract.json",
        "skills/brand/references/dangoui-token-contract.json",
        "skills/brand/references/dangoui.tokens.dtcg.json",
        "skills/brand/references/dangoui.design-system.json",
      ],
      exception: "Read a targeted reference or query a specific JSON key only when the dispatch packet cannot answer a required decision; record that extra read in the receipt.",
      queryCommand: `node ${path.join(skillRoot, "scripts", "query-brand-context.mjs")} <get|search> --source <contract|tokens|runtime|workflow> ...`,
    },
    efficiencyBudget: designHostEfficiencyBudget(current),
    receiptRequirements: ["agentExecutionId from a real spawned subagent", "goalSha256 unchanged", "input and output file sha256 values", "pass/fail/needs-evidence verdict", "record immediately after the required outputs are complete; do not continue analysis or wait for orchestration commentary", "stageTargetSeconds is diagnostic, not a quality verdict; record evaluates elapsed time automatically. The frozen run deadline stops further work; never skip required checks to meet a target. Previously dispatched finite stageHardLimitSeconds remain binding.", "on fail, failureOwnerRole identifies brandResearcher, designTranslator, designDirectorOrchestrator, or demoImplementationAgent"],
    receiptContract: {
      path: `migrations/${brand}/receipts/${current.id}.json`,
      recordCommand: [process.execPath, path.join(skillRoot, "scripts", "brand-subagent-workflow.mjs"), "record", "--brand", brand, "--root", root, "--receipt", `migrations/${brand}/receipts/${current.id}.json`],
      completion: "The producing/reviewing role finishes all required checks, executes recordCommand, and returns its actual result before ending. A receipt file or finalizer success alone is not stage completion. The orchestrator waits for that result; it does not interrupt a still-working role or record an unconfirmed receipt on its behalf.",
      orchestratorContinueCommand: [process.execPath, path.join(skillRoot, "scripts", "run-brand-workflow.mjs"), "continue", "--artifact-root", root, "--brand", brand],
      requiredFields: ["dispatchId", "stageId", "role", "agentExecutionId", "goalSha256", "verdict", "inputs", "outputs"],
      inputs: "Copy requiredInputs unchanged; outputs are actual path/sha256 pairs.",
      failureFields: ["blockingFindings", "failureOwnerRole", "deltaScope"],
      deltaScopeFields: ["affectedSections", "inputPaths", "regressionSections"],
    },
    fastDesignHints: fastOverride?.hints || null,
    assetUsageContract: fastOverride?.assetUsageContract || null,
    viewportContract: fastOverride?.viewportContract || null,
    outputLocationContract: fastOverride?.outputLocationContract || null,
    ...(fastOverride?.userDelivery ? { userDelivery: fastOverride.userDelivery } : {}),
  };
  if (qaReview?.completionContract) {
    request.completionContract = qaReview.completionContract;
    request.requirements.push("Complete the supplied learning QA output contract before a PASS receipt. A scoped regression verdict does not close learning. The deterministic fidelity validator owns fidelity-report.json; use the report's canonical learningProof and retain the frozen certification limits.");
    request.receiptContract.fidelityCommand = [process.execPath, path.join(skillRoot, "scripts", "validate-brand-fidelity.mjs"), "--root", root, "--brand", brand, "--write"];
  }
  if (reviewMode === "regression-review") {
    request.reviewScope = { affected: qaReview.affected, regressionScope: qaReview.regressionScope };
    request.requirements.push("This is regression-review by the original independent QA, not fresh blind review. Previous QA failure is permitted; implementation rationale and main conversation remain forbidden. Create a new assessment and fresh browser captureEvidence with path/sha256/reviewId/capturedAt, and report both affected and regression scope. Never inherit the old PASS or old screenshots as new observations.");
    request.mustNot = request.mustNot.filter(item => !/prior.*verdict|previous.*verdict/i.test(item));
    request.receiptContract.requiredFields.push("reviewMode", "reviewId", "qaExecutionId");
  }
  const dispatchFile = path.join(migrationDir, "dispatch", `${current.id}.json`);
  if (current.stage === "h5DirectionGeneration" && request.fastDesignHints?.completionContract) {
    request.fastDesignHints.completionContract.finalizerCommand = [process.execPath, path.join(skillRoot, "scripts", "finalize-h5-direction-stage.mjs"), "--root", root, "--brand", brand, "--dispatch", relative(dispatchFile), "--producer-execution-id", "<actual-agent-execution-id>", "--receipt", request.receiptContract.path, ...["a", "b", "c"].flatMap(id => ["--html", `migrations/${brand}/h5-directions/direction-${id}.html`])];
    request.fastDesignHints.completionContract.embeddedMetadata.finalizer = "Use completionContract.finalizerCommand; replace only the actual agent execution id. Its compiled-not-recorded output is not completion. Finish rendered self-review, rerun after edits, then execute its recordCommandArgs and return the record result.";
  }
  if (current.stage === "designVisualQA" && request.fastDesignHints) {
    request.fastDesignHints.receipt.recordCommand = request.receiptContract.recordCommand;
    request.fastDesignHints.outputContract = {
      rule: "These are field names and passing values, not a prefilled verdict. Fill observations from the frozen captures; when checks fail submit fail/needs-evidence, never copy passing values to hide missing evidence. Hash every output before recording.",
      h5Audit: { file: "design-host-h5-audit.json", statusWhenPassed: "eligible-for-human-review" },
      visualQa: { file: "design-host-visual-qa.json", recommendedDirectionIds: "nonempty array of actual passing direction ids", recommendationReason: "nonempty evidence-backed string; not rationale" },
      routePatch: { file: "design-host-route.json", h5QA: { statusWhenPassed: "pass", reviewerExecutionId: "actual independent reviewer id", resultHierarchyGeometry: "copy frozen mechanical receipt resultHierarchyGeometry unchanged" }, expressiveGapDecision: "same object as design-host-expressive-gap.json; status required or not-required, with explicit gaps array" },
    };
  }
  if (current.stage === "hostImplementation" && manifest.selectedH5PosteditBinding) request.ownedNextRequirement={owner:"hostImplementationAgent",status:"originals-captured-runtime-proof-pending",code:"SELECTED_H5_POSTEDIT_ORIGINAL_BINDING_REQUIRED",binding:manifest.selectedH5PosteditBinding,instruction:"Original source/style snapshots are immutable and pinned by this dispatch. Receipt-only validation must preserve app config and pass fresh structural AST comparison; native/cascade/runtime QA remains required and is not supplied by these original-input snapshots."};
  writeJson(dispatchFile, request);
  current.dispatchId = request.dispatchId;
  current.dispatchPath = relative(dispatchFile);
  current.dispatchSha256 = sha256File(dispatchFile);
  current.status = "dispatched";
  current.startedAt = new Date().toISOString();
  addTelemetry(manifest, "dispatch", inputs);
  writeJson(manifestFile, manifest);
  output({ ok: true, dispatchRequest: request, dispatchFile: relative(dispatchFile), instruction: "The outer Orchestrator must now spawn a real subagent with exactly this packet." });
}

function declareCapability() {
  const imageGeneration = opt("--image-generation", "");
  if (!["available", "unavailable"].includes(imageGeneration)) fail("declare-capability requires --image-generation <available|unavailable>.");
  fs.mkdirSync(migrationDir, { recursive: true });
  const capability = {
    schema: "brand-execution-capabilities/v1",
    imageGeneration: imageGeneration === "available"
      ? { status: "available", tool: "image_gen", mode: "built-in-default" }
      : { status: "unavailable", requiredTool: "image_gen" },
    declaredAt: new Date().toISOString(),
  };
  writeJson(executionCapabilitiesFile, capability);
  if (fs.existsSync(designHostRouteFile)) {
    const route = readJsonRequired(designHostRouteFile);
    route.imageCapability = imageGeneration === "available"
      ? { ...capability.imageGeneration, capabilitySha256: sha256File(executionCapabilitiesFile) }
      : { status: "unavailable", requiredTool: "image_gen", fallbackRequiresExplicitUserApproval: true };
    writeJson(designHostRouteFile, route);
  }
  output({ ok: true, capability: relative(executionCapabilitiesFile), imageGeneration, nextAction: imageGeneration === "available" ? "Run next to dispatch default built-in image generation." : "Enable built-in image_gen or explicitly approve an external fallback before retrying." });
}

function fastDesignHostOverride(manifest, current) {
  if (manifest.mode !== "design-host" || manifest.executionProfile !== "fast") return null;
  if (current.stage === "h5DirectionGeneration") return {
    mission: "Generate exactly three structurally different interactive isolated H5 directions for the real startup page before any ImageGen call, using real frozen host content, the learned brand design system and the frozen design-knowledge bundle.",
    tasks: ["build one compact brand-render-kit.json from the frozen evidence", "derive three genuinely different H5 information/composition directions without changing host capabilities", "bind captured real records or explicit schema/loading states", "implement working search/filter/navigation interactions inside the isolated preview", "write brand-application-plan.json, design-direction-options.json and design-host-route.json"],
    requirements: ["do not call image_gen", "do not output raster concept boards", "do not modify, compile or inject host source", "do not read validator or test source to infer output formats; the completionContract below is authoritative", "replace the three deterministic H5 scaffold placeholders in place; do not choose output paths or rebuild contract boilerplate", "produce exactly three reachable H5 entries", "preserve host terminology, fields, records and primary task", "preserve the host product model, data and interaction—not its previous visual skin: classify first-viewport hardcoded visuals as business-semantic, structural-neutral or replaceable-theme residue; replace theme residue and justify every retained old visual", "every direction must keep hostStartupBaseline.informationDistributionContract.model, preview unit, scan order and comparison behavior; list-to-grid, list-to-quest, list-to-lesson or other product-model substitutions are forbidden", "every direction must bind hostStartupBaseline.resultHierarchyContract; without matching host evidence repeated results remain peer and may not become featured, ranked, recommended, selected or unequal in size", "every direction must declare one communicationHypothesis covering hierarchy, utility and style: hierarchy names the intended attention target and information gain, utility names the obvious main function and preserved convention, style names source-backed target attributes and a mechanism thesis", "the three mechanismThesis values must express genuinely different testable design hypotheses; color swaps, decoration names and effect labels are not distinct hypotheses", "Hierarchy/Utility are product-safety constraints: an expressive improvement may not reduce task clarity, readable information or conventional use", "Style is evaluated only after product safety passes, using first-impression attributes grounded in brand evidence rather than generic adjectives chosen after rendering", "before finalizer, render each direction at the frozen mobile viewport and reject any ordinary peer card whose text collapses vertically, whose empty space dominates its content, or whose height exceeds 1.5 times another peer card", "before finalizer, any direction with two or more first-page modules must prove document.scrollHeight exceeds document.clientHeight, scrolling changes scrollTop, and the original scrollTop is restored; a fixed-height stage that clips or scales the list to one viewport is forbidden", "before finalizer, mask the brand name and logo in every rendered direction; reject each individual direction that becomes a generic utility page or relies on one small isolated brand patch", "direction diversity must come from brand-backed hierarchy, framing, motion, feedback, material and entry rhythm inside the preserved host model, never from changing how users preview or compare business objects", "never invent names, counts, authors, prices, cards or other business data", "when captured records are absent, show explicit schema labels or loading/empty states", "apply at least three inspectable non-color brand mechanisms from the frozen evidence/design system in every direction; green accents, rounded corners and generic geometric blobs alone are a blocking generic-brand failure", "the mechanisms must materially shape the rendered first viewport and at least one must continue into the real search/filter/list task area in every direction; three small isolated details do not satisfy this requirement", "an evidence image may be used only for the visual role its Brand MOD declares; a diagram, editorial explainer or study image cannot be relabeled as an identity hero merely because its file name or alt text mentions the brand", "every direction must have a source-recognizable first impression after masking the brand name; otherwise the producer must fail rather than call a generic white utility page a complete direction", "when frozen official identity or motion assets are available and fit the host job, use them as bounded brand moments without turning the host into the source product mechanic", "cite only the frozen knowledge bundle and explain host-specific productive/expressive allocation", "directions must differ in hierarchy, spatial composition and interaction rhythm while keeping the same information-distribution model", "keep real business content as live HTML rather than rasterized text", "finish the producer pass within its stage target and leave the independent H5 QA budget intact", "if the time budget becomes tight, stop optional polish and complete all contract files plus three coherent H5 directions; never leave a partial direction set"],
    expectedOutputs: ["brand-render-kit.json", "brand-application-plan.json", "design-direction-options.json", "exactly three interactive isolated H5 directions", "design-host-route.json with h5Directions.status=ready"],
    passCriteria: ["three H5 directions are independently reachable and interactive", "all visible business content is hash-bound real content or an explicit schema/loading state", "brand design-system use includes at least three inspectable non-color mechanisms", "the three directions are perceptually distinct without changing the host information-distribution model", "no host source was changed"],
    failCriteria: ["invented business data", "three variants of one skeleton", "brand color/rounding substitution only", "generic white utility page with one small brand patch", "brand evidence image used outside its declared visual role", "generic geometric hero with no source-backed brand mechanism", "list/grid/feed model substitution", "rasterized host text or controls", "ImageGen or host-source mutation"],
    assetUsageContract: { sourceOfTruth: "DOM markers are rendered truth; matching metadata is preferred and is deterministically inferred only when one unique marker tuple exists", metadata: ["assetRef", "assetPlacement: identity-hero|identity-support|editorial-support|feedback-support|section-background|business-content", "assetSalience: primary|supporting"], domMarkers: ["data-brand-asset-ref", "data-brand-asset-placement", "data-brand-asset-salience"], invariant: "only Brand MOD identity, hero or environment roles may be primary or identity-hero; editorial, explanatory, study and motion assets stay supporting in their declared scope" },
    viewportContract: { coordinateSystem: "CSS pixels", width: 390, height: 844, harness: "/__brand_viewport__?path=<root-relative-html>&width=390&height=844", invariant: "producer and QA inspect the same unscaled same-origin iframe; DPR or physical-pixel equivalence is not a substitute for the frozen CSS viewport" },
    outputLocationContract: { h5Directory: "migrations/<brand>/h5-directions", exactH5Files: ["migrations/<brand>/h5-directions/direction-a.html", "migrations/<brand>/h5-directions/direction-b.html", "migrations/<brand>/h5-directions/direction-c.html"], contractDirectory: "migrations/<brand>", receiptDirectory: "migrations/<brand>/receipts", invariant: "all finalizer inputs and outputs stay inside the isolated artifact migration; public/, host source and arbitrary output directories are forbidden" },
    hints: { phase: "h5-first-style-trial", targetSeconds: 300, hardLimitSeconds: 600, directionCount: 3, medium: "interactive-isolated-h5", imageGenerationForbidden: true, qaReserveMs: 300000, evaluationFramework: { dimensions: ["hierarchy", "utility", "style"], order: ["product-safety-no-regression", "first-impression-uplift"], comparisonRule: "compare each hypothesis against the frozen host baseline and compare the three hypotheses with each other; do not collapse them into one aesthetic score" }, renderPath: { policy: "use the available browser-automation tool; do not probe for Chromium, Playwright, Puppeteer or unrelated local runtimes", staticServer: { scriptRelativeToSkillRoot: "scripts/serve-design-host-h5.mjs", arguments: ["--root", "<isolated-run-root>", "--port", "0"], open: "<baseUrl>/<relative-H5-path>" }, viewport: "use the frozen host mobile viewport from the dispatch inputs" }, completionContract: { artifactOrder: ["three complete H5 files", "brand-render-kit.json", "brand-application-plan.json", "design-direction-options.json", "design-host-route.json"], embeddedMetadata: { selector: "script[type=\"application/json\"][data-brand-direction]", requiredFields: ["id", "title", "brandMechanisms", "structuralSignature", "interactionRhythm", "communicationHypothesis", "knowledgeRefs", "resultHierarchyFit"], communicationHypothesis: { hierarchy: ["attentionTarget", "informationGain"], utility: ["mainFunction", "obviousAction", "preservedConvention"], style: ["targetAttributes", "sourceBasis", "mechanismThesis"] }, resultHierarchyMarkers: { container: "data-result-hierarchy equals the direction resultHierarchyFit.relationship; a page with an evidenced featuredDecks group and ordinary peer results uses source-evidenced-differentiated", repeatedResult: "every ordinary repeated result uses data-result-weight=peer; only the evidence-bound group may use differentiated weight" }, brandMechanismFields: ["id", "type", "evidenceRef", "sourcePageRef", "systemRef", "visibleEffect", "visibleApplication", "assetRef when type=asset"], brandMechanismTextMinimum: "visibleEffect and visibleApplication are each concrete auditable descriptions of at least 12 characters", acceptedShorthand: { mechanismType: "a descriptive non-color mechanism label is normalized to asset|typography|shape|material|spatial|motion", structuralSignature: "a unique descriptive string is accepted and normalized", interactionRhythm: "a descriptive string is accepted and normalized" }, finalizer: "node skills/brand/scripts/finalize-h5-direction-stage.mjs --root <artifact-root> --brand <brand> --dispatch <dispatch.json> --producer-execution-id <agentExecutionId> --html <a.html> --html <b.html> --html <c.html>" }, routePatch: { schema: "design-host-route/v3", sequence: "h5-design-system-first", h5Directions: { status: "ready", producerExecutionId: "current agent execution id", directions: [{ id: "stable unique id", artifact: { path: "root-relative path", sha256: "sha256 of final H5" }, realDataBinding: { inventedDataForbidden: true }, resultHierarchyFit: { relationship: "peer or source-evidenced-differentiated according to the groups actually rendered", preservesHostHierarchy: true, unsupportedDifferentiationForbidden: true, resultSpecificEmphasis: "none for peer; evidence-bound group id for differentiated", evidenceRefs: "empty for peer; exact hierarchy evidence ids for differentiated" }, brandDesignSystemSha256: "sha256 of frozen Brand MOD or design-system artifact", knowledgeBundleSha256: "copy design-host-route.knowledgeDecision.sha256" }] } }, receiptRule: "run the deterministic finalizer after the three H5 files are complete; it hashes final files, copies dispatch requiredInputs unchanged, and emits a workflow-recordable receipt covering all five contract groups", forbiddenReads: ["scripts/*validator*.mjs", "scripts/*.test.mjs"] }, universalSkinFormula: { productive: "frozen-brand-design-system", allocation: "expert-decision-knowledge", expressive: "defer-until-specific-gap" } },
  };
  if (current.stage === "conceptBrief") return {
    mission: "Before any ImageGen call, define and mechanically validate three genuinely different, source-evidenced art directions for the real startup page.",
    tasks: ["read the complete frozen brand design-system artifacts listed in requiredInputs", "translate their visible rules into three host-fit directions", "plan official identity integration without redrawing identity subjects", "write concept-direction-briefs.json", "run validate-concept-direction-briefs.mjs before recording"],
    requirements: ["do not call image_gen", "do not create H5 or modify host", "each direction must differ in scene graph, visual center, host-content entry and result presentation rather than effect name", "brand website evidence defines the visual language; design knowledge only decides allocation and tradeoffs", "productiveApplication must describe visible use of the learned design system, not merely cite artifact ids", "productiveApplication must distinguish protected host product structure from replaceable host-theme appearance; unexplained old-theme colors, type, radii, shadows or selected states are blocking residue, not preservation", "identityPlan may prefer direct-reference only when the reference role is explicit and modifications are tightly bounded; deterministic-composite is the mandatory fallback and must plan geometry, occlusion, contact shadow and environmental light", "hostContentIntegration must reference Host Strategist candidate ids rather than self-reporting source facts, then add planned readable size, fit, container reason and fallback; a generated empty slot is never proof of integration", "when hostContentContract has no ready candidate, keep real host content in productive-ui without asking the user", "resultContentPlan must consume the Host Strategist's readable field contract and forbid anonymous skeleton bars", "peakViewportRatio must not exceed the Host Strategist's frozen maximum"],
    expectedOutputs: ["concept-direction-briefs.json passing validate-concept-direction-briefs.mjs"],
    hints: { phase: "pre-image-art-direction-gate", targetSeconds: 60, validator: "scripts/validate-concept-direction-briefs.mjs", directionCount: 3, imageGenerationForbidden: true },
  };
  if (current.stage === "conceptGeneration") return {
    mission: "In one uninterrupted visual-probe turn, define three source-evidenced art worlds and immediately render them by combining ImageGen expressive authorship, the learned brand design system for productive UI, and explicit expert decision knowledge; do not create H5.",
    tasks: ["verify declared image capability and frozen official identity assets", "build concept-direction-briefs.json and brand-render-kit.json from the frozen evidence, host baseline and knowledge bundle before any ImageGen call", "mechanically validate both compact planning artifacts", "launch all three expressive scene-plate ImageGen calls concurrently", "render each productive state from the frozen host schema and brand design system, then deterministically compose it with the scene plate and unchanged official identity assets", "record scene-plate, productive-renderer and final-board provenance and hashes in design-host-route.json"],
    requirements: ["no H5 output", "preserve host business structure", "ImageGen owns the expressive scene plate; the deterministic host renderer owns search, filters, result fields, navigation, text and interaction geometry", "never ask ImageGen to invent or rasterize host business data", "every direction has a paired-state final board that visibly contains both peakFrame and settledFrame for the same composition", "peakFrame and settledFrame may reference the same final board artifact only when each records a distinct visible region", "the three-part productionFormula is mandatory and non-substitutable: ImageGen expressive authorship, frozen brand-design-system productive UI, and expert decision knowledge must all be present", "brand-render-kit expressive mechanisms must name their applicable sourcePageRef; one applicable source page is valid. Multiple source pages do not authorize mixing incompatible source systems or adding metadata-only mechanisms to satisfy a count", "directions must differ in contentEntry and resultPresentation geometry, not merely swap backgrounds", "when multiple official identity assets are available, use at least two different assets across the three directions", "generated scene plates cannot invent or approximate source-specific characters, logos or identity subjects", "compose hash-bound official identity assets unchanged; record asset ids, hashes, geometry, occlusion, contact shadow and environmental-light treatment", "each final direction must visibly use at least one supplied officialIdentityAsset unchanged; if no safe asset fits, return NEEDS_EVIDENCE", "productive UI must visibly apply the learned design system; citations and pattern ids alone do not count", "expert knowledge must cite only refs in the frozen design-knowledge-bundle, bind its sha256, and explain the host primary task, productive constraint and expressive constraint", "settledFrame keeps the primary action immediately usable, makes productive content dominant, exposes the core search/tool entry high in the viewport and shows readable result rows using resultContentContract; anonymous grey bars are forbidden", "peak expression must stay within the Host Strategist's declared viewport budget and never push the core entry below the fold", "warm return enters settledFrame", "call the built-in image-generation tool once for every scene plate and record its real tool-call id; HTML-only expressive scenes do not qualify", "start all three independent scene-plate calls concurrently in one orchestration batch; do not serialize them", "record productive renderer receipt and final-board hash separately from the ImageGen plate hash", "if concept dispatch begins with less than 180 seconds remaining, stop immediately and return a non-timeout capacity blocker instead of starting partial generation"],
    expectedOutputs: ["concept-direction-briefs.json passing validate-concept-direction-briefs.mjs", "brand-render-kit.json passing validate-brand-render-kit.mjs", "exactly three Demo direction groups, each with one pairedStateBoard plus visibly distinct peakFrame and settledFrame regions", "design-host-route.json with producer and imageToolCalls evidence"],
    passCriteria: ["all three directions are visually attributable to the learned brand before reading labels", "the three art worlds differ in scene graph, visual center, content entry and result presentation", "each paired board shows a strong cold-start peak and a materially calmer productive settled state", "official identity is naturally integrated rather than pasted on top", "the host's primary task and readable result content remain immediately understandable", "concept-direction-briefs.json and brand-render-kit.json both pass their deterministic validators"],
    failCriteria: ["generic utility UI with brand color accents", "directions differ mainly by list/grid layout, glow color or effect name", "peak and settled are nearly identical", "identity appears as an unintegrated white rectangle, sticker or floating card", "productive controls or readable results are starved by the expressive scene", "any H5 or host-source modification"],
    hints: { phase: "single-turn-visual-probe", medium: "paired-state-demo-boards", imageTool: "image_gen", directionCount: 3, framesPerDirection: 2, boardPerDirection: 1, preflightValidators: ["scripts/validate-concept-direction-briefs.mjs", "scripts/validate-brand-render-kit.mjs"], generationSchedule: { launchMode: "parallel", independentToolCalls: 3, latestSafeStartRemainingMs: 180000, qaReserveMs: 45000 }, universalSkinFormula: { required: true, nonSubstitutable: true, expressive: "image_gen", productive: "frozen-brand-design-system", allocation: "expert-decision-knowledge" }, identityPolicy: { generatedIdentitySubjectsForbidden: true, officialIdentityAssetsUnmodified: true, officialIdentityAssetRequiredPerDirection: true }, officialIdentityAssets: frozenOfficialIdentityAssets(), knowledgeInput: relative(designKnowledgeBundleFile), knowledgeUsage: "cite questionRef and knowledgeRefs from the frozen bundle; copy bundle sha256; write structured hostReasons" },
  };
  if (current.stage === "conceptVisualQA") return {
    mission: "Independently inspect all three peak/settled Demo pairs before any H5 reconstruction.",
    tasks: ["open both frames for every direction", "check expressive originality, productive design-system fidelity, expert-decision traceability, identity integrity, state continuity and host-task clarity", "record the independent review in design-host-route.json"],
    requirements: ["do not create or edit H5", "reviewer execution must differ from producer", "this is the only pre-selection QA pass; on failure stop with blocking findings instead of automatically dispatching another producer or reviewer", "reject AI approximations of source-specific characters, logos or identity subjects", "reject generic productive UI that is not traceable to the frozen brand system", "reject an allocation without cited decision knowledge and host-specific rationale", "record qualityVerdict=pass only when all fourteen paired-state criteria pass", "reject when peak and settled differ only by glow, shadow, copy or minor density", "reject any official identity asset that reads as a pasted white rectangle or sticker unless perspective, contact, occlusion and environmental light visibly integrate it", "reject directions that are mostly list/grid variations instead of distinct art worlds", "reject a permanent oversized hero or a settled frame that starves search/results", "overall pass requires at least one direction the reviewer would actively recommend for human continuation", "a pass pauses for explicit user direction confirmation"],
    expectedOutputs: ["design-host-concept-qa.json", "design-host-route.json"],
    passCriteria: ["firstGlanceImpact passes", "peakSettledPerceptualDelta passes", "identityIntegrationNaturalness passes", "crossDirectionArtWorldDistance passes", "all ten existing fidelity and usability criteria pass", "at least one direction is explicitly recommended for continuation"],
    failCriteria: ["compliance-only pass with no recommendable direction", "pasted identity treatment", "three variants of one layout", "weak or absent perceptual change between peak and settled", "generic non-brand first impression"],
    hints: { medium: "paired-state-demo-images", directionCount: 3, framesPerDirection: 2, requiredCriteriaCount: 14, humanRecommendationRequired: true },
  };
  if (current.stage === "startupPageStrategy") return {
    mission: "Inspect only the host's real startup page so the user can see the possible visual transformation quickly; defer full-project scanning until the H5 direction is explicitly approved.",
    tasks: ["read host-startup-page.json", "inspect the resolved startup page source and rendered startup state", "derive its primary task, first action, productive floor and bounded expressive opportunity", "derive whether repeated results are peers or have explicit featured/ranked/recommended/selected roles", "automatically inventory visual business objects and their intrinsic/current sizes without asking the user", "write host-startup-baseline.json and fast-host-brief.json"],
    requirements: ["do not ask the user for a Productive baseline, business-object list, result hierarchy, image dimensions, minimum readable size or integration plan", "do not scan or judge unrelated pages at this stage", "do not compile, build, start or repair the host runtime in this fast diagnosis stage", "use an already supplied render/measurement receipt when one exists; otherwise inspect source for at most 15 seconds, mark unmeasured visual candidates unresolved, and continue with host-schema/loading state", "do not read validator or test source to infer the supplied output schema", "bind the exact startup-page artifact hash", "use the host's startup page even when the user eventually intends to skin another page", "derive resultContentContract from the startup source: list the actual visible result fields and either capture real records or provide readable neutral schema labels; anonymous grey bars are forbidden", "derive resultHierarchyContract from explicit host source signals; when no featured, ranking, recommendation, selection or priority evidence exists, defaultRelationship must be peer and differentiationAllowed must be false", "derive hostContentContract from source references and rendered elements: inventory each visual business object, source locator, intrinsic size, current rendered size, business role, readiness and minimum readable size; unresolved objects cannot enter expressive scenes", "an empty visualCandidates list is valid and must force productive-ui rather than a user question or invented placeholder", "finish and record this diagnosis within 75 seconds of dispatch so H5 generation still has 180 seconds and QA has 45 seconds inside the five-minute target", "once baseline and brief are complete, write the receipt and call record immediately; do not spend the remaining budget narrating or rechecking optional details", "write the compatibility fields exactly as specified; extra explanatory fields are allowed but cannot replace them"],
    expectedOutputs: ["host-startup-baseline.json", "fast-host-brief.json"],
    hints: { phase: "style-trial", targetSeconds: 75, sourceInspectionBudgetSeconds: 15, runtimeBuildForbidden: true, immediateRecordAfterOutputs: true, unresolvedFallback: "host-schema/loading-state", fullProjectScan: "deferred-until-after-h5-user-confirmation", outputSchemas: { hostStartupBaseline: { schema: "host-startup-baseline/v1", requiredCompatibilityFields: { derivationSource: "startup-page-scan", hostStartupPageSha256: "sha256(host-startup-page.json)", primaryTask: "non-empty string", primaryAction: "non-empty string", pageType: "non-empty string", productiveFloor: { coreEntry: "non-empty string", businessObjectsVisible: ["one or more real business object types"], warmReturnState: "settled" }, resultContentContract: { mode: "captured-real or host-schema", fields: ["at least three visible field labels from startup source"], readableRowsRequired: true, anonymousSkeletonsForbidden: true }, resultHierarchyContract: { defaultRelationship: "peer unless source evidence proves a business distinction", differentiationAllowed: "boolean", evidence: ["source-bound hierarchy signals"], forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"] }, expressiveOpportunity: { heroEligible: "boolean", reason: "non-empty host-specific string", maxFirstViewportRatio: "number greater than 0 and at most 0.5" } } }, fastHostBrief: { hostOpportunity: "object", productiveFloor: "object", resultContentContract: "object", resultHierarchyContract: "object", expressiveOpportunity: "object" } }, receiptTemplate: { verdict: "pass", inputs: "copy every dispatch requiredInput unchanged", outputs: ["hashed host-startup-baseline.json", "hashed fast-host-brief.json"] } },
  };
  if (current.role === "visualQA" && current.stage === "designVisualQA") return {
    mission: "Independently inspect all three H5-first directions, verify real-data and design-system correctness, then make a binary evidence-backed expressive-gap decision before any ImageGen call.",
    tasks: ["read the frozen deterministic mechanical QA receipt instead of repeating geometry, image, scroll or interaction probes", "inspect its three hash-bound first-viewport captures for first impression", "judge Hierarchy, Utility and Style separately, then compare declared hypotheses with what is actually visible", "for each direction either record no expressive asset gap or specify the exact region and purpose of one", "write compact QA, H5 audit, expressive-gap JSON and route evidence"],
    requirements: ["record immediately after the required rendered checks", "do not edit H5 or call image_gen", "reviewer execution must differ from the H5 producer", "accept viewport, overflow, scrolling, visible-image loading, peer geometry and basic interaction proof only from the frozen design-host-h5-mechanical-qa.json; fail if that receipt is missing or not pass, and do not spend browser time repeating it", "inspect the actual hash-bound first-viewport capture for every H5 using the image-viewing capability; source code, alt text, CSS declarations and mechanism counts cannot substitute for rendered evidence", "do not start or attach a browser during this QA stage; interactive behavior is already frozen by the mechanical receipt and local-browser policy must not block first-impression review", "evaluate in order: first product-safety no-regression, then first-impression uplift; a style win cannot compensate for hierarchy or utility regression", "for every direction separately report hierarchy evidence (attention reaches the intended useful target and the screen remains informative), utility evidence (main function is obvious and the primary action works), and style evidence (source-backed target attributes are visibly communicated)", "compare the three declared mechanismThesis values against the renders; reject them as same-skeleton directions when the visible hierarchy, utility or style mechanism does not materially differ", "for every direction record the inspected capture path, viewport, observed first-glance brand subject, observed productive-task continuity, the largest generic region and the largest retained old-theme region; a pass without these observations is forbidden", "copy resultHierarchyGeometry from the frozen mechanical receipt into the H5 audit; do not remeasure it", "reject a direction when replaceable old-theme appearance still dominates or remains in high-salience selected states without a business-semantic retention reason; host structure preservation never authorizes host-skin preservation", "mask brand name/logo mentally and reject a direction whose first viewport becomes a generic white utility page with a small image patch, even when three source-backed mechanisms can be counted", "verify that every visible evidence asset performs its Brand MOD declared role; reject an editorial diagram or study image presented as an identity hero", "reject any direction that changes the frozen list/grid/feed/search comparison model merely to create visual difference", "reject any featured, ranked, recommended, selected or unequal-size repeated result when resultHierarchyContract does not contain matching host evidence", "reject green accents, rounded cards or generic geometric blobs as insufficient brand-system application unless at least three non-color source-backed mechanisms materially affect the rendered composition", "a gap is valid only with directionId, regionId, businessPurpose, targetSize, currentShortfall, expectedImprovement, noImageFallback, mutableAssetSelector and fixedContainerSelector", "generic desire for more impact is not a gap", "a whole-direction art-direction failure is not a local ImageGen gap and must return to Brand Application Designer", "any invented business record, broken primary interaction, missing H5 or same-skeleton directions is blocking", "when no complete gap exists set expressiveGapDecision.status=not-required", "when at least one complete local gap exists set status=required and keep the asset count minimal"],
    expectedOutputs: ["design-host-visual-qa.json", "design-host-h5-audit.json", "design-host-expressive-gap.json", "design-host-route.json"],
    userDelivery: { report: "design-host-visual-qa.json", requiredFields: ["recommendedDirectionIds", "recommendationReason"], rule: "Recommend at least one passing direction from rendered evidence and host-specific reasons; never select the first id by default. Recommendations belong in this independently hashed QA output, not a producer assertion. Show all three interactive directions equally in the unified comparison; recommendation is explanatory only, never hidden alternatives, reordering or default selection. A recommendation is not user approval and cannot freeze a Master or authorize host edits." },
    viewportContract: { coordinateSystem: "CSS pixels", width: 390, height: 844, harness: "/__brand_viewport__?path=<root-relative-html>&width=390&height=844", invariant: "inspect and measure the same-origin iframe document at exactly 390x844 CSS pixels; ignore outer browser viewport and DPR when deciding layout or scroll" },
    hints: { candidateCount: 3, medium: "interactive-isolated-h5-with-frozen-render-captures", imageGenerationForbidden: true, gapDecision: ["required", "not-required"], visualEvidence: { source: "design-host-h5-mechanical-qa.json directions[].capture", invariant: "capture hash, viewport measurement and interaction proof come from one deterministic headless render; visual QA reads them but cannot replace them" }, receipt: { requiredBeforeVerdict: true, recordCommand: "node skills/brand/scripts/brand-subagent-workflow.mjs record --brand <brand> --root <isolated-run-root> --receipt <root-relative-receipt-path>", instruction: "write and hash all QA outputs, write the receipt, then run recordCommand immediately before any final commentary" } },
  };
  if (current.stage === "expressiveAssetGeneration") return {
    mission: "Generate only the local expressive assets required by the frozen H5 gap contracts, once per gap, then backfill them as replaceable layers without changing host data, copy, controls or interaction.",
    tasks: ["read only the compact render kit, gap contracts and affected H5 directions", "freeze the pre-ImageGen DOM order, non-asset structure and affected container geometry", "launch independent local asset calls concurrently", "record every exact ImageGen input and tool-call id", "integrate each asset into only its declared mutable asset selector", "record the post-integration geometry comparison", "preserve a no-image fallback and write updated route evidence"],
    requirements: ["do not redesign the full page", "do not generate host text, data, controls or navigation", "automaticRetryCount must equal 0", "each gap receives at most one first-round image_gen call", "do not alter prompts to evade a refusal", "failed generation keeps the already valid no-image H5 and records the unresolved gap", "only pixels inside mutableAssetSelector may change; DOM order, result hierarchy, Productive data, typography metrics, controls and fixedContainerSelector geometry are immutable", "unrelated H5 regions and all host-source files are immutable"],
    expectedOutputs: ["one hash-bound local asset per successful gap", "updated isolated H5 artifacts", "design-host-route.json with localizedExpressiveAssets evidence"],
    hints: { targetSeconds: 240, generationSchedule: { launchMode: "parallel", automaticRetryCount: 0, maxCallsPerGap: 1 }, medium: "local-raster-assets-only", noImageFallbackRequired: true },
  };
  if (current.stage === "expressiveVisualQA") return {
    mission: "Independently verify that every local generated asset closes only its declared expressive gap while preserving the H5's real data, interaction and brand design-system integrity.",
    tasks: ["open every affected H5", "compare each asset with its frozen gap contract and no-image fallback", "check visual integration, readability, clipping and interaction regression", "write integration QA and route evidence"],
    requirements: ["do not edit H5 or generated assets", "reviewer execution must differ from the asset producer", "reject assets containing host text, data, controls or identity lookalikes", "reject pasted, framed or unrelated decoration", "compare frozen and integrated DOM order, result hierarchy, Productive bindings, typography metrics and fixed container rectangles; any drift outside the declared mutable asset selector is blocking", "a failed integration stops without automatic regeneration"],
    expectedOutputs: ["design-host-expressive-integration-qa.json", "design-host-route.json"],
    hints: { targetSeconds: 45, automaticRetryCount: 0, humanExpressiveApproval: "pending" },
  };
  if (current.role !== "brandApplicationDesigner") return null;
  const modFile = path.join(migrationDir, "brand-mod.json");
  const mod = fs.existsSync(modFile) ? readJsonRequired(modFile) : {};
  const assets = array(mod.assets).filter((asset) => asset?.id && asset?.sourceSha256 && asset?.status !== "rejected").map((asset) => {
    const localFile = asset.localPath ? path.resolve(root, asset.localPath) : null;
    return { id: asset.id, role: asset.role, sourceKind: asset.sourceKind, sourceSha256: asset.sourceSha256, sourceUrl: asset.sourceUrl || null, localPath: asset.localPath || null, localAvailable: Boolean(localFile && fs.existsSync(localFile)), targetScope: asset.targetScope, antiScopes: array(asset.antiScopes) };
  });
  return {
    mission: "Reconstruct the user-approved Demo direction as isolated H5 without redesigning it or flattening its scene into a background-plus-CSS approximation.",
    tasks: ["read the explicit concept selection and its exact ImageGen input", "derive a same-camera empty scene from the selected composition", "write and validate scene-reconstruction.json with host-object quads, surfaces, occlusion and lighting layers", "render the approved target-viewport H5 from that manifest", "write plan and options using frozen hashes", "run the scene and H5 validators"],
    requirements: ["do not spawn or emulate a separate Host Strategist in fast mode", "copy all baseline hashes from fastDesignHints.frozenInputHashes; never transcribe or recompute them manually", "preserve the selected concept as the visual target rather than a disposable mood board", "use four-corner mapping for perspective-bound dynamic objects; arbitrary rotate values or a shared fan are forbidden", "keep background, host-data objects, foreground occlusion, contact shadows and environment light independently inspectable", "recheck coordinates after empty-scene generation and stop if geometry drift makes the selected composition unrecoverable", "do not substitute a generic generated background plus CSS-arranged official assets", "use at least one supplied sourceBrandAsset in each option brandSystemClosure with role brand-identity, environment, campaign-scene or brand-texture", "never reference localPath when localAvailable is false; use its sourceUrl or choose another asset", "do not invent API-derived business records, names or counts; use a hash-bound captured state or clearly neutral schema placeholders", "keep primary search/filter/action controls fully inside normal-flow containers; never place them across an overflow:hidden boundary with negative positioning", "do not generate screenshots or extra state variants before independent QA", "finish and record by 225 seconds after workflow prepare, preserving 75 seconds for independent QA"],
    expectedOutputs: ["scene-reconstruction.json passing validate-scene-reconstruction.mjs", "brand-application-plan.json", "design-direction-options.json", "approved-direction H5 reconstruction", "design-host-route.json"],
    hints: { candidateProgramCount: 1, renderCount: 1, targetSeconds: 195, qaReserveSeconds: 75, frozenInputHashes: Object.fromEntries(dispatchInputs(manifest, current).map((item) => [item.path, item.sha256])), knowledgeScenarioId: manifest.knowledgeScenarioId, knowledgeQuery: "node skills/brand/scripts/query-design-knowledge.mjs question expressive-productive-allocation-question; if applicable, query its methodRef, caseRefs and hypothesisRefs; count independent cases, not alternatives; treat candidate hypotheses as test questions rather than approved recipes; query pattern <id> only when the host task fits; query method design-asset-adoption and relevant decision <id> before using source-specific brand assets; query policy primary-color-and-cta when assigning brand primary or CTA; query scenario <id> for machine binding; query each brandRecipeRefs id with recipe <id>; query component <name> only as needed", sourceBrandAssets: assets, identityClosureRoles: ["brand-identity", "environment", "campaign-scene", "brand-texture"], validatorOrder: ["validate-scene-reconstruction.mjs", "validate-brand-application-plan.mjs", "validate-design-host-expressive-h5.mjs"] },
  };
}

function record() {
  const receiptArg = opt("--receipt", "");
  if (!receiptArg) fail("record requires --receipt <file>.");
  const receiptFile = path.resolve(root, receiptArg);
  const receiptRelativeToMigration = path.relative(migrationDir, receiptFile);
  if (receiptRelativeToMigration.startsWith("..") || path.isAbsolute(receiptRelativeToMigration)) fail("RECEIPT_OUTSIDE_ARTIFACT_MIGRATION_FORBIDDEN");
  const receipt = readJsonRequired(receiptFile);
  const manifest = validateManifest();
  if (!["pass", "fail", "needs-evidence"].includes(receipt.verdict)) fail("Receipt verdict must be pass, fail or needs-evidence.");
  if (receipt.verdict !== "pass" && !array(receipt.blockingFindings).length) fail("Blocking receipts must include at least one blockingFinding; use STAGE_TARGET_EXCEEDED when stopping after the stage target.");
  const lateBlockingReceipt = manifest.status === "timed-out" && ["fail", "needs-evidence"].includes(receipt.verdict);
  if (!lateBlockingReceipt) enforceDesignHostDeadline(manifest);
  const currentStageId = manifest.currentStageId || (lateBlockingReceipt ? receipt.stageId : null);
  const current = manifest.stages.find((item) => item.id === currentStageId);
  if (!current || current.status !== "dispatched") fail("No dispatched current stage is waiting for a receipt.");
  if (current.role === "hostImplementationAgent") verifyHostPreeditGate("receipt",receipt);
  const dispatch = readJsonRequired(path.join(root, current.dispatchPath));
  if (receipt.dispatchId !== current.dispatchId || receipt.dispatchId !== dispatch.dispatchId) fail("Receipt dispatchId does not match the active dispatch packet.");
  if (receipt.stageId !== current.id || receipt.role !== current.role) fail("Receipt is out of order or belongs to another role.");
  if (!receipt.agentExecutionId || !String(receipt.agentExecutionId).startsWith("/root/") || receipt.agentExecutionId === "/root") fail("Receipt must identify a real spawned subagent execution.");
  if (receipt.goalSha256 !== manifest.goalSha256) fail("Receipt goal hash does not match the frozen goal.");
  if (containsRoleTimeoutClaim(receipt)) fail("ROLE_TIMEOUT_CLAIM_FORBIDDEN: only the workflow clock may emit DESIGN_HOST_FAST_SAFETY_LIMIT_EXCEEDED; discard this receipt and keep the stage pending.");
  const stageHardLimitMs = Number(dispatch.efficiencyBudget?.stageHardLimitSeconds || 0) * 1000;
  const observedStageDurationMs = current.startedAt ? Math.max(0, Date.now() - Date.parse(current.startedAt)) : 0;
  if (receipt.verdict === "pass" && stageHardLimitMs > 0 && observedStageDurationMs > stageHardLimitMs) {
    fail(`STAGE_HARD_LIMIT_PASS_FORBIDDEN: observed ${observedStageDurationMs}ms exceeds ${stageHardLimitMs}ms; keep completed diagnostics, stop optional work, and resubmit a fail or needs-evidence receipt with STAGE_HARD_LIMIT_EXCEEDED.`);
  }
  const receiptInputs = array(receipt.inputs);
  for (const required of array(dispatch.requiredInputs)) {
    const received = receiptInputs.find((item) => item.path === required.path);
    if (!received || received.sha256 !== required.sha256) fail(`Receipt is missing frozen dispatch input: ${required.path}`);
  }
  const receiptOutputs = array(receipt.outputs);
  if (manifest.mode === "design-host") {
    const hasImage = receiptOutputs.some((item) => /\.(?:png|jpe?g|webp|avif)$/i.test(item.path || ""));
    const hasH5 = receiptOutputs.some((item) => /\.(?:html?|css|jsx?|tsx?|vue)$/i.test(item.path || ""));
    if (!["expressiveAssetGeneration", "h5DirectionGeneration"].includes(current.stage) && hasImage) fail("IMAGE_OUTPUT_OUTSIDE_DESIGN_STAGE");
    if (["startupPageStrategy", "hostStrategy", "designVisualQA", "expressiveVisualQA"].includes(current.stage) && hasH5) fail("QA_OR_STRATEGY_MUST_NOT_EDIT_H5");
  }
  const overwrittenOutputPaths = new Set(receiptOutputs.map((item) => item.path));
  for (const item of receiptInputs) {
    // Retry dispatches intentionally freeze the previous implementation as input,
    // while the current stage overwrites the same path as its output. The frozen
    // hash is already checked against dispatch.requiredInputs above; only the new
    // output hash can match the file that now exists on disk.
    if (!overwrittenOutputPaths.has(item.path)) verifyHashedPath(item);
  }
  for (const item of receiptOutputs) verifyHashedPath(item);
  if (manifest.mode === "learn-brand" && current.role === "brandResearcher" && receipt.verdict === "pass") {
    verifyEvidenceVisibilityGate();
    verifyLearnBrandHandoff("evidence");
  }
  if (manifest.mode === "learn-brand" && current.role === "designTranslator" && receipt.verdict === "pass") {
    verifyLearnBrandHandoff("interpreter");
    if (readJsonRequired(goalFile).goalType === "brand-learning-capability-test") verifyLearningModOutput(receiptOutputs);
  }
  if (array(receipt.outputs).length === 0) fail("Receipt must include at least one hashed output.");
  if (manifest.mode === "design-host" && current.stage === "h5DirectionGeneration" && receipt.verdict === "pass") {
    verifyDesignHostRoute("before-h5-qa");
    if (readJsonRequired(goalFile).expressiveProduction?.required === true) {
      const route = readJsonRequired(designHostRouteFile);
      const directions = array(route.h5Directions?.directions).map(item => ({ metadata: { id: item.id, expressiveGeneration: item.expressiveGeneration }, file: path.resolve(root, item.artifact.path), source: fs.readFileSync(path.resolve(root, item.artifact.path), "utf8") }));
      const records = validateExpressiveGeneration(directions, { ...dispatch, fastDesignHints: { ...dispatch.fastDesignHints, expressiveProduction: { required: true } } }, root, migrationDir);
      for (const item of records) if (!array(receipt.toolCalls).some(call => call.id === item.toolCallId && /imagegen|image_gen|image-generation/i.test(call.tool || "")) || !receiptOutputs.some(ref => ref.path === item.asset.path && ref.sha256 === item.asset.sha256)) fail("EXPRESSIVE_PRODUCER_RECEIPT_REQUIRED");
    }
    const plan = path.join(migrationDir, "brand-application-plan.json");
    const options = path.join(migrationDir, "design-direction-options.json");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === plan) || !fs.existsSync(plan)) fail("DESIGN_HOST_PLAN_REQUIRED: H5-first designer receipt must hash the frozen plan.");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === options) || !fs.existsSync(options)) fail("DESIGN_HOST_OPTIONS_REQUIRED: H5-first designer receipt must hash all three directions.");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === brandRenderKitFile) || !fs.existsSync(brandRenderKitFile)) fail("BRAND_RENDER_KIT_RECEIPT_REQUIRED");
  }
  if (manifest.mode === "design-host" && current.stage === "startupPageStrategy" && receipt.verdict === "pass") {
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === hostStartupBaselineFile)) fail("HOST_STARTUP_BASELINE_RECEIPT_REQUIRED");
    verifyHostStartupBaseline();
  }
  if (manifest.mode === "design-host" && current.stage === "conceptBrief" && receipt.verdict === "pass") {
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === conceptDirectionBriefsFile)) fail("CONCEPT_DIRECTION_BRIEFS_RECEIPT_REQUIRED");
    verifyConceptDirectionBriefs();
  }
  if (manifest.mode === "design-host" && manifest.executionProfile === "fast" && current.stage === "conceptGeneration" && receipt.verdict === "pass") {
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === conceptDirectionBriefsFile)) fail("CONCEPT_DIRECTION_BRIEFS_RECEIPT_REQUIRED");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === brandRenderKitFile)) fail("BRAND_RENDER_KIT_RECEIPT_REQUIRED");
    verifyConceptDirectionBriefs();
    verifyBrandRenderKit();
  }
  if (manifest.mode === "apply-host" && current.stage === "hostStrategy" && receipt.verdict === "pass") {
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === hostProductiveBaselineFile)) fail("HOST_PRODUCTIVE_BASELINE_RECEIPT_REQUIRED");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === hostStructuralTargetsFile)) fail("HOST_STRUCTURAL_TARGETS_RECEIPT_REQUIRED");
    verifyHostProductiveBaseline();
    prepareHostPreeditBundle();
    ensureSelectedOriginalBinding(manifest);
  }
  if (manifest.mode === "design-host" && current.stage === "designVisualQA" && receipt.verdict === "pass") {
    const qaReportFile = path.join(migrationDir, "design-host-visual-qa.json");
    if (!receiptOutputs.some(item => path.resolve(root, item.path) === qaReportFile) || !fs.existsSync(qaReportFile)) fail("HOST_RECOMMENDATION_REPORT_REQUIRED");
    const recommendation = normalizeHostRecommendation(readJsonRequired(qaReportFile));
    const directionIds = new Set(array(readJsonRequired(designHostRouteFile).h5Directions?.directions).map(item => item.id));
    if (!recommendation || recommendation.ids.some(id => !directionIds.has(id))) fail("HOST_RECOMMENDATION_REQUIRED");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === h5AuditFile) || !fs.existsSync(h5AuditFile) || readJsonRequired(h5AuditFile).status !== "eligible-for-human-review") fail("DESIGN_HOST_H5_AUDIT_REQUIRED: QA receipt must hash a passing H5 audit.");
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === expressiveGapFile) || !fs.existsSync(expressiveGapFile)) fail("EXPRESSIVE_GAP_DECISION_REQUIRED");
    verifyDesignHostRoute("after-h5-qa");
  }
  if (manifest.mode === "design-host" && current.stage === "expressiveAssetGeneration" && receipt.verdict === "pass") {
    const route = readJsonRequired(designHostRouteFile);
    const toolCalls = array(receipt.toolCalls);
    if (Number(route.localizedExpressiveAssets?.automaticRetryCount) !== 0) fail("EXPRESSIVE_IMAGEGEN_AUTOMATIC_RETRY_FORBIDDEN");
    for (const id of array(route.localizedExpressiveAssets?.imageToolCalls)) if (!toolCalls.some((call) => call.id === id && /imagegen|image-generation|image_gen/i.test(call.tool || call.name || ""))) fail("EXPRESSIVE_IMAGE_TOOL_RECEIPT_REQUIRED");
    verifyDesignHostRoute("after-expressive-generation");
  }
  if (manifest.mode === "design-host" && current.stage === "expressiveVisualQA" && receipt.verdict === "pass") {
    if (!receiptOutputs.some((item) => path.resolve(root, item.path) === expressiveIntegrationQaFile) || !fs.existsSync(expressiveIntegrationQaFile)) fail("EXPRESSIVE_INTEGRATION_QA_REQUIRED");
    verifyDesignHostRoute("before-final-selection");
  }
  if (current.role === "visualQA") {
    if (manifest.mode === "learn-brand") {
      const priorQa = manifest.stages.filter(item => item.role === "visualQA" && item.receiptPath);
      if (dispatch.reviewMode !== "regression-review" && priorQa.some(item => item.agentExecutionId === receipt.agentExecutionId)) fail("QA_REVIEW_FRESH_AGENT_ALREADY_EXPOSED");
      if (current.qaReview) {
        verifyHashedPath(current.qaReview);
        const review = readJsonRequired(path.resolve(root, current.qaReview.path));
        if (receipt.reviewMode !== dispatch.reviewMode || receipt.reviewId !== dispatch.reviewId || receipt.agentExecutionId !== dispatch.qaExecutionId || receipt.qaExecutionId !== receipt.agentExecutionId) fail("QA_REVIEW_RECEIPT_IDENTITY");
        const assessmentOutput = receiptOutputs.find(item => /visual-qa-assessment\.json$/.test(item.path));
        if (!assessmentOutput) fail("QA_REVIEW_ASSESSMENT_REQUIRED");
        const assessment=readJsonRequired(path.resolve(root, assessmentOutput.path));
        try { validateQaReview(root, review, assessment, {receiptVerdict:receipt.verdict,receiptOutputs}); } catch(error) { fail(error.message); }
        for (const capture of array(assessment.captureEvidence)) if (!receiptOutputs.some(ref => ref.path === capture.path && ref.sha256 === capture.sha256)) fail("QA_REVIEW_CAPTURE_RECEIPT_OUTPUT_REQUIRED");
      }
      if (receipt.verdict === "pass" && readJsonRequired(goalFile).goalType === "brand-learning-capability-test") verifyLearningFidelityResult(receiptOutputs);
      current.reviewMode = dispatch.reviewMode || "initial-blind";
      current.reviewId = dispatch.reviewId || null;
      current.qaExecutionId = receipt.agentExecutionId;
    }
    if (manifest.mode === "apply-host" && current.stage === "previewQA") {
      try { assertFreshHostPreviewQaReviewer(manifest, current, receipt.agentExecutionId); } catch (error) { fail(error.message); }
    }
    const latestDemo = [...manifest.stages].reverse().find((item) => ["demoImplementationAgent", "implementationAgent", "hostImplementationAgent"].includes(item.role) && item.status === "complete");
    if (latestDemo?.agentExecutionId === receipt.agentExecutionId) fail("Visual QA must use a different subagent from Demo implementation.");
    if (manifest.mode === "apply-host" && current.stage === "previewQA" && receipt.verdict === "pass") {
      try { validateHostPreviewSmoke({ root, brand, receipt, manifest }); } catch (error) { fail(error.message); }
    }
    if (receipt.verdict !== "pass") validateDeltaScope(receipt.deltaScope);
  }
  current.status = receipt.verdict === "pass" ? "complete" : "failed";
  current.verdict = receipt.verdict;
  current.agentExecutionId = receipt.agentExecutionId;
  current.receiptPath = relative(receiptFile);
  current.receiptSha256 = sha256File(receiptFile);
  current.outputHashes = array(receipt.outputs);
  current.blockingFindings = array(receipt.blockingFindings);
  current.failureOwnerRole = receipt.failureOwnerRole || null;
  current.deltaScope = receipt.deltaScope || null;
  current.additionalReads = array(receipt.additionalReads).length ? array(receipt.additionalReads) : array(receipt.extraReads);
  current.endedAt = new Date().toISOString();
  current.durationMs = Math.max(0, Date.parse(current.endedAt) - Date.parse(current.startedAt));
  const efficiency = dispatch.efficiencyBudget;
  current.budgetResult = efficiency ? {
    targetMs: efficiency.stageTargetSeconds * 1000,
    actualMs: current.durationMs,
    status: current.durationMs <= efficiency.stageTargetSeconds * 1000 ? "within-target" : "target-exceeded",
  } : null;
  if (lateBlockingReceipt && manifest.timeout) {
    manifest.timeout.resolution = "blocking-receipt-recorded";
    manifest.timeout.receiptAcceptedAt = current.endedAt;
    manifest.timeout.receiptPath = relative(receiptFile);
  }
  advance(manifest, current);
  markDesignHostFirstPreview(manifest, current);
  manifest.updatedAt = current.endedAt;
  manifest.elapsedMs = manifest.stages.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
  addTelemetry(manifest, "receipt", receiptOutputs, current.additionalReads, receipt, current);
  writeTelemetry(manifest);
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, completedStage: current.id, durationMs: current.durationMs, elapsedMs: manifest.elapsedMs, nextStageId: manifest.currentStageId || null, blockingFindings: current.blockingFindings });
}

function approvePreview() {
  const manifest = validateManifest();
  if (manifest.mode !== "apply-host" || manifest.status !== "awaiting-user" || manifest.previewDecision?.status !== "pending") {
    fail("PREVIEW_NOT_AWAITING_USER: approve-preview requires a passing apply-host preview awaiting user review.");
  }
  const decision = opt("--decision", "");
  if (!['approve', 'revise', 'certify'].includes(decision)) fail("approve-preview requires --decision <approve|revise|certify>.");
  manifest.previewDecision = { status: decision, decidedAt: new Date().toISOString(), source: "explicit-user" };
  if (decision === "revise") {
    const attempts = manifest.stages.filter((item) => item.stage === "hostImplementation").length + 1;
    const retry = uniqueStage(manifest, "hostImplementation", "hostImplementationAgent", attempts);
    manifest.stages.push(retry);
    manifest.currentStageId = retry.id;
    manifest.status = "running";
  } else if (decision === "approve" && manifest.executionProfile === "fast" && frozenPreviewArtifactsUnchanged(manifest)) {
    const previewQa = [...manifest.stages].reverse().find((item) => item.stage === "previewQA" && item.verdict === "pass");
    manifest.currentStageId = null;
    manifest.status = "passed";
    manifest.deliveryLevel = "fast-preview-approved";
    manifest.qaReuse = {
      status: "reused",
      sourceStageId: previewQa?.id || null,
      reason: "Explicit approval with unchanged frozen inputs, implementation outputs and Smoke QA outputs.",
      reusedAt: new Date().toISOString(),
    };
  } else {
    const qa = uniqueStage(manifest, "visualQA", "visualQA", 1);
    manifest.stages.push(qa);
    manifest.currentStageId = qa.id;
    manifest.status = "running";
    manifest.deliveryLevel = decision === "certify" ? "release-certification-requested" : "scoped-delivery";
  }
  manifest.updatedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, decision, nextStageId: manifest.currentStageId, qaReuse: manifest.qaReuse || null });
}

function frozenPreviewArtifactsUnchanged(manifest) {
  const stages = manifest.stages.filter((item) => ["hostImplementation", "previewQA"].includes(item.stage) && item.status === "complete");
  if (!stages.some((item) => item.stage === "hostImplementation") || !stages.some((item) => item.stage === "previewQA")) return false;
  const artifacts = [];
  for (const stageItem of stages) {
    artifacts.push(...array(stageItem.outputHashes));
    if (stageItem.dispatchPath) {
      const dispatchFile = path.join(root, stageItem.dispatchPath);
      if (!fs.existsSync(dispatchFile)) return false;
      artifacts.push(...array(readJsonRequired(dispatchFile).requiredInputs));
    }
  }
  return latestInputsByPath(artifacts).every((item) => {
    if (!item?.path || !item?.sha256) return false;
    const file = path.resolve(root, item.path);
    return fs.existsSync(file) && sha256File(file) === item.sha256;
  });
}

function status() {
  const before = fs.existsSync(manifestFile) ? sha256File(manifestFile) : null;
  const manifest = validateManifest();
  enforceDesignHostDeadline(manifest);
  const after = sha256File(manifestFile);
  const proofStatus = readProofStatus();
  output({ ok: true, readOnly: before === after, proofStatus, nextAction: nextAction(manifest, proofStatus), manifest });
}

function resumeInterpreter() {
  const manifest = validateManifest();
  if (manifest.mode === "learn-brand" && manifest.status === "blocked" && !opt("--rejection", "")) return resumeInterpreterAfterQa(manifest);
  if (manifest.mode !== "learn-brand" || !["running", "blocked"].includes(manifest.status)) fail("INTERPRETER_REJECTION_INVALID_STATE");
  const latest = [...manifest.stages].reverse().find((item) => item.role === "designTranslator");
  if (!latest || latest.status !== "complete" || latest.verdict !== "pass" || !latest.receiptPath || !latest.receiptSha256) fail("INTERPRETER_ACCEPTED_RECEIPT_REQUIRED");
  const active = manifest.stages.find((item) => item.id === manifest.currentStageId);
  if (active && (active.status !== "pending" || active.stage !== "demo")) fail("INTERPRETER_REJECTION_ACTIVE_CONSUMER: stop/finish the active consumer through its normal receipt before resuming.");
  const priorRejections = array(manifest.consumerRejections).filter((item) => item.ownerRole === "brandInterpreter");
  // A single Director consumer-repair is distinct from producer self-retries.
  // Never mutate the sealed Goal to buy an unlimited retry budget.
  if (priorRejections.length >= 1) fail("INTERPRETER_CONSUMER_RETRY_EXHAUSTED");
  const rejectionPath = opt("--rejection", "");
  if (!rejectionPath) fail("INTERPRETER_REJECTION_REQUIRED: provide --rejection <hash-bound rejection.json>");
  const rejectionFile = path.resolve(root, rejectionPath);
  if (!rejectionFile.startsWith(`${path.resolve(migrationDir)}${path.sep}`) || !fs.realpathSync(rejectionFile).startsWith(`${fs.realpathSync(migrationDir)}${path.sep}`)) fail("INTERPRETER_REJECTION_PATH_OUTSIDE_RUN");
  const rejection = readJsonRequired(rejectionFile);
  if (rejection.schema !== "brand-consumer-rejection/v1" || rejection.ownerRole !== "brandInterpreter" || rejection.consumerRole !== "designDirectorOrchestrator" || rejection.verdict !== "needs-evidence" || !String(rejection.reason || "").trim() || !array(rejection.blockingFindings).length) fail("INTERPRETER_REJECTION_INVALID_CONTRACT");
  if (rejection.goalSha256 !== manifest.goalSha256 || rejection.rejectedStageId !== latest.id) fail("INTERPRETER_REJECTION_STALE_GOAL_OR_STAGE");
  if (rejection.rejectedReceipt?.path !== latest.receiptPath || rejection.rejectedReceipt?.sha256 !== latest.receiptSha256) fail("INTERPRETER_REJECTION_STALE_RECEIPT");
  verifyHashedPath(rejection.rejectedReceipt);
  const receipt = readJsonRequired(path.resolve(root, latest.receiptPath));
  if (receipt.stageId !== latest.id || receipt.role !== "designTranslator" || receipt.verdict !== "pass" || receipt.goalSha256 !== manifest.goalSha256) fail("INTERPRETER_REJECTION_RECEIPT_BINDING_INVALID");
  const required = latestInputsByPath([...array(receipt.inputs), ...array(receipt.outputs), hashedPath(relative(goalFile))]);
  for (const item of required) {
    const bound = array(rejection.inputs).find((entry) => entry.path === item.path && entry.sha256 === item.sha256);
    if (!bound) fail(`INTERPRETER_REJECTION_INPUT_UNBOUND: ${item.path}`);
  }
  for (const item of array(rejection.inputs)) {
    const resolved = path.resolve(root, item.path || "");
    if (!resolved.startsWith(`${root}${path.sep}`) || !fs.realpathSync(resolved).startsWith(`${fs.realpathSync(root)}${path.sep}`)) fail("INTERPRETER_REJECTION_INPUT_OUTSIDE_RUN");
    verifyHashedPath(item);
  }
  validateDeltaScope(rejection.deltaScope);
  for (const inputPath of rejection.deltaScope.inputPaths) if (!array(rejection.inputs).some((item) => item.path === inputPath)) fail("INTERPRETER_REJECTION_DELTA_INPUT_UNBOUND");
  const priorOutputArchive = latest.dispatchPath && array(latest.outputHashes).length ? hashedPath(relative(archiveFailedStage(latest))) : null;
  const retry = uniqueStage(manifest, "interpreter", "designTranslator", Number(latest.attempt || 1) + 1);
  const archivedPath = relative(path.join(migrationDir, "consumer-rejections", `${latest.id}-${sha256File(rejectionFile)}.json`));
  const archivedFile = path.resolve(root, archivedPath);
  if (fs.existsSync(archivedFile) && sha256File(archivedFile) !== sha256File(rejectionFile)) fail("INTERPRETER_REJECTION_ARCHIVE_CONFLICT");
  if (!fs.existsSync(archivedFile)) { fs.mkdirSync(path.dirname(archivedFile), { recursive: true }); fs.copyFileSync(rejectionFile, archivedFile); }
  const rejectionBinding = hashedPath(archivedPath);
  retry.retryInput = { goalSha256: manifest.goalSha256, priorStageId: latest.id, rejectedReceipt: rejection.rejectedReceipt, consumerRejection: rejectionBinding, blockingFindings: rejection.blockingFindings, deltaScope: rejection.deltaScope, requirement: "Repair only the rejected Interpreter coverage; preserve accepted Evidence, then rerun Demo and independent QA." };
  if (priorOutputArchive) retry.retryInput.failedAttemptArchive = priorOutputArchive;
  manifest.consumerRejections ||= [];
  manifest.consumerRejections.push({ ownerRole: "brandInterpreter", consumerRole: rejection.consumerRole, supersededStageId: latest.id, supersededReceipt: rejection.rejectedReceipt, replacementStageId: retry.id, rejection: rejectionBinding, goalSha256: manifest.goalSha256, recordedAt: new Date().toISOString(), downstreamPendingStageId: active?.id || null, ...(priorOutputArchive ? { priorStageId: latest.id, archive: priorOutputArchive } : {}) });
  // Historical PASS stages and receipts remain byte-for-byte historical facts.
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  manifest.finalGates = {};
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "running", resumedFrom: latest.id, nextStageId: retry.id, rejection: rejectionBinding, evidenceRetained: true, consumerRetryLimit: 1 });
}

function verifyLearningModOutput(outputs) {
  const modFile=path.join(migrationDir,"brand-mod.json");
  if (!array(outputs).some(ref=>path.resolve(root,ref.path)===modFile) || !fs.existsSync(modFile)) fail("INTERPRETER_BRAND_MOD_OUTPUT_REQUIRED");
  const validated=spawnSync(process.execPath,[path.join(skillRoot,"scripts","validate-brand-mod.mjs"),modFile],{cwd:root,encoding:"utf8"});
  if (validated.status!==0) fail(`INTERPRETER_BRAND_MOD_INVALID: ${validated.stderr||validated.stdout}`);
}

function resumeLearningClosure() {
  if (!args.includes("--continue-existing") || !opt("--reason","").trim()) fail("LEARNING_CLOSURE_CONTINUATION_AUTHORIZATION_REQUIRED");
  const manifest=validateManifest(),goal=readJsonRequired(goalFile);
  if (manifest.mode!=="learn-brand" || !["passed","complete","blocked"].includes(manifest.status) || manifest.currentStageId || goal.goalType!=="brand-learning-capability-test") fail("LEARNING_CLOSURE_INVALID_STATE");
  if (array(manifest.learningClosureRepairs).length) fail("LEARNING_CLOSURE_RETRY_EXHAUSTED");
  const interpreter=[...manifest.stages].reverse().find(item=>item.role==="designTranslator" && item.status==="complete" && item.verdict==="pass");
  const qa=[...manifest.stages].reverse().find(item=>item.role==="visualQA");
  if (!interpreter || qa?.status!=="complete" || qa.verdict!=="pass") fail("LEARNING_CLOSURE_PASS_LEDGER_REQUIRED");
  const fidelityRef=array(qa.outputHashes).find(ref=>/fidelity-report\.json$/.test(ref.path));
  if (fidelityRef) verifyHashedPath(fidelityRef);
  const fidelity=fidelityRef?readJsonRequired(path.resolve(root,fidelityRef.path)):null;
  const validation=revalidateLearningFidelity({root,brand,goalFile,recordedReport:fidelity});
  const modFile=path.join(migrationDir,"brand-mod.json");
  const modValidation=fs.existsSync(modFile)?spawnSync(process.execPath,[path.join(skillRoot,"scripts","validate-brand-mod.mjs"),modFile],{cwd:root,encoding:"utf8"}):null;
  const modRejected=!modValidation || modValidation.status!==0 || !array(interpreter.outputHashes).some(ref=>path.resolve(root,ref.path)===modFile && ref.sha256===sha256File(modFile));
  if (validation.ok && !modRejected) fail("LEARNING_CLOSURE_NO_CONSUMER_REJECTION");
  // Start at the earliest responsible accepted producer. Never rewrite a QA
  // PASS as FAIL to unlock recovery or send its verdict/report to Interpreter.
  const owner=modRejected?interpreter:[...manifest.stages].reverse().find(item=>item.role==="demoImplementationAgent");
  if (!owner || owner.status!=="complete" || owner.verdict!=="pass") fail("LEARNING_CLOSURE_ACCEPTED_OWNER_REQUIRED");
  const preservedRules=array(interpreter.outputHashes).filter(ref=>/(?:^|\/)(?:brand-intent|approved-visual-patterns)\.json$/.test(ref.path));
  const sourceInputs=latestInputsByPath([hashedPath(relative(goalFile)),...manifest.stages.filter(item=>item.role==="brandResearcher" && item.status==="complete" && item.verdict==="pass").flatMap(item=>array(item.outputHashes)),...preservedRules]);
  for (const ref of sourceInputs) verifyHashedPath(ref);
  const archived=[];
  const archiveDir=path.join(migrationDir,"closure-repairs","1");
  if (fs.existsSync(archiveDir)) fail("LEARNING_CLOSURE_ARCHIVE_EXISTS");
  const affected=manifest.stages.filter(item=>item===interpreter || item===qa || item===[...manifest.stages].reverse().find(stage=>stage.role==="demoImplementationAgent"));
  const refs=latestInputsByPath(affected.flatMap(item=>[...array(item.outputHashes),{path:item.receiptPath,sha256:item.receiptSha256}]));
  for (const ref of refs) {
    verifyHashedPath(ref);
    const source=path.resolve(root,ref.path);
    if (!source.startsWith(`${migrationDir}${path.sep}`) || !fs.realpathSync(source).startsWith(`${fs.realpathSync(migrationDir)}${path.sep}`)) fail("LEARNING_CLOSURE_ARCHIVE_OUTSIDE_RUN");
  }
  if (args.includes("--dry-run")) return output({ok:true,status:"recovery-ready",readOnly:true,ownerRole:owner.role,goalSha256:manifest.goalSha256,finalConsumerErrors:validation.errors,modRejected,archiveFiles:refs.length,nextCommand:["resume-learning-closure","--artifact-root",root,"--brand",brand,"--continue-existing","--reason",opt("--reason","")]});
  for (const ref of refs) {
    const target=path.join(archiveDir,"workspace",ref.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.resolve(root,ref.path),target,fs.constants.COPYFILE_EXCL);
    archived.push({originalPath:ref.path,path:relative(target),sha256:ref.sha256});
  }
  const retry=uniqueStage(manifest,owner.stage,owner.role,Number(owner.attempt||1)+1);
  const rejectionFile=path.join(archiveDir,"consumer-rejection.json");
  const findings=[...(modRejected?[{code:modValidation?"INTERPRETER_BRAND_MOD_INVALID":"INTERPRETER_BRAND_MOD_MISSING",ownerRole:"designTranslator",finding:"Produce a valid evidence-backed source-only Brand MOD; retain approved semantic scope and do not invent global mapped tokens."}]:[]),{code:"LEARNING_FINAL_CONSUMER_REJECTED",ownerRole:owner.role,finding:"Final consumer rejected incomplete learning proof inputs. Review approved composition identities, bounded layers and capture bindings; unverified claims remain unresolved."}];
  writeJson(rejectionFile,{schema:"brand-learning-closure-rejection/v1",goalSha256:manifest.goalSha256,rejectedStageId:qa.id,rejectedReceipt:{path:qa.receiptPath,sha256:qa.receiptSha256},consumerRole:"deterministic-finalizer",ownerRole:owner.role,validation,modValidation:modValidation?{exitCode:modValidation.status,stderr:modValidation.stderr}:null,archivedOutputs:archived,stages:affected,authorization:{kind:"explicit-user-request-to-continue-existing-version",reason:opt("--reason",""),additionalAttempts:1},createdAt:new Date().toISOString()});
  const rejection=hashedPath(relative(rejectionFile));
  retry.retryInput={goalSha256:manifest.goalSha256,closureRepair:{rejection,sourceInputs},blockingFindings:findings,continuationAuthorization:"explicit-user-request-to-continue-existing-version",requirement:"Repair only final-consumer gaps within the frozen learning trial. Preserve Evidence and all approved style-only semantics. Re-run Demo then fresh independent QA; this is not source certification or new host exploration."};
  manifest.learningClosureRepairs=[{replacementStageId:retry.id,rejection,ownerRole:owner.role,goalSha256:manifest.goalSha256,authorization:"explicit-user-request-to-continue-existing-version",additionalAttempts:1}];
  manifest.stages.push(retry);manifest.currentStageId=retry.id;manifest.status="running";manifest.finalGates={};writeJson(manifestFile,manifest);
  output({ok:true,status:"running",ownerRole:owner.role,nextStageId:retry.id,rejection,goalUnchanged:true,oldReceiptsPreserved:true,nextCommand:["next","--root",root,"--brand",brand]});
}

function interpreterOwner(owner) { return ["designTranslator", "interpreter", "brandInterpreter"].includes(owner); }

function resumeInterpreterAfterQa(manifest) {
  const latestQa = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  const latestCompleted = [...manifest.stages].reverse().find((item) => ["complete", "failed"].includes(item.status));
  const latest = [...manifest.stages].reverse().find((item) => item.role === "designTranslator");
  if (manifest.currentStageId || latestCompleted?.id !== latestQa?.id || latestQa?.status !== "failed" || !["fail", "needs-evidence"].includes(latestQa.verdict) || !interpreterOwner(latestQa.failureOwnerRole)) fail("INTERPRETER_QA_REPAIR_INVALID_STATE_OR_OWNER");
  if (!latest || latest.status !== "complete" || latest.verdict !== "pass") fail("INTERPRETER_ACCEPTED_RECEIPT_REQUIRED");
  const qaBinding = { path: latestQa.receiptPath, sha256: latestQa.receiptSha256 };
  verifyHashedPath(qaBinding);
  const receipt = readJsonRequired(path.resolve(root, qaBinding.path));
  if (receipt.stageId !== latestQa.id || receipt.role !== "visualQA" || receipt.verdict !== latestQa.verdict || receipt.goalSha256 !== manifest.goalSha256 || receipt.failureOwnerRole !== latestQa.failureOwnerRole) fail("INTERPRETER_QA_RECEIPT_BINDING_INVALID");
  if (array(manifest.interpreterQaRepairs).some((item) => item.qaStageId === latestQa.id || (item.qaReceipt?.path === qaBinding.path && item.qaReceipt?.sha256 === qaBinding.sha256))) fail("INTERPRETER_QA_RECEIPT_ALREADY_CONSUMED");
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  const completedQaAttempts = manifest.stages.filter((item) => item.role === "visualQA" && ["complete", "failed"].includes(item.status)).length;
  const continueExisting = args.includes("--continue-existing");
  if ((Number(latest.attempt || 1) >= maxAttempts || completedQaAttempts >= maxAttempts) && !continueExisting) fail("Interpreter/QA retry budget is exhausted. An explicit user instruction to continue the same case is required; then rerun with --continue-existing.");
  const acceptedEvidence = manifest.stages.filter((item) => item.role === "brandResearcher" && item.status === "complete" && item.verdict === "pass");
  // Later Evidence repairs may publish only a narrow delta. Keep the accepted
  // base facts and let the latest Evidence producer own each canonical path.
  const evidenceFacts = latestInputsByPath(acceptedEvidence.flatMap((item) => array(item.outputHashes)));
  if (!evidenceFacts.length) fail("INTERPRETER_QA_SOURCE_FACTS_REQUIRED");
  const interpreterBinding = { path: latest.receiptPath, sha256: latest.receiptSha256 };
  verifyHashedPath(interpreterBinding);
  const interpreterReceipt = readJsonRequired(path.resolve(root, interpreterBinding.path));
  if (interpreterReceipt.stageId !== latest.id || interpreterReceipt.role !== "designTranslator" || interpreterReceipt.verdict !== "pass" || interpreterReceipt.goalSha256 !== manifest.goalSha256) fail("INTERPRETER_QA_PRIOR_RECEIPT_BINDING_INVALID");
  // A producer may consume its prior canonical artifact and replace that path
  // in the same receipt. The consumed hash remains history; the output hash
  // owns current bytes. Never apply this dedup across QA or unrelated stages:
  // their current bindings must still agree independently.
  const interpreterOutputPaths = new Set(array(interpreterReceipt.outputs).map((item) => item.path));
  const interpreterCurrentInputs = array(interpreterReceipt.inputs).filter((item) => !interpreterOutputPaths.has(item.path));
  const frozenInputs = [...array(receipt.inputs), ...array(receipt.outputs), ...interpreterCurrentInputs, ...array(interpreterReceipt.outputs), ...evidenceFacts, hashedPath(relative(goalFile))];
  for (const item of frozenInputs) {
    const resolved = path.resolve(root, item.path || "");
    if (!resolved.startsWith(`${root}${path.sep}`) || !fs.realpathSync(resolved).startsWith(`${fs.realpathSync(root)}${path.sep}`)) fail("INTERPRETER_QA_INPUT_OUTSIDE_RUN");
    verifyHashedPath(item);
  }
  validateDeltaScope(receipt.deltaScope);
  for (const inputPath of receipt.deltaScope.inputPaths) if (!frozenInputs.some((item) => item.path === inputPath)) fail("INTERPRETER_QA_DELTA_INPUT_UNBOUND");
  const owned = array(receipt.blockingFindings).filter((finding) => interpreterOwner(finding.ownerRole || finding.failureOwnerRole || finding.owner || receipt.failureOwnerRole));
  if (!owned.length) fail("INTERPRETER_QA_OWNED_FINDINGS_REQUIRED");
  // Only observation fields cross the corrective boundary, never raw QA reports,
  // prior verdicts, implementation code, or implementation rationale.
  const observations = owned.map((finding) => ({ status: "unresolved-corrective-question", ...Object.fromEntries(["code", "scope", "section", "finding", "message", "observation", "sourceObservation"].filter((key) => finding[key] != null).map((key) => [key, finding[key]])) }));
  const sourceInputs = latestInputsByPath([hashedPath(relative(goalFile)), ...evidenceFacts]);
  const sourcePaths = new Set(sourceInputs.map((item) => item.path));
  const correctiveScope = { ...receipt.deltaScope, inputPaths: receipt.deltaScope.inputPaths.filter((item) => sourcePaths.has(item)) };
  const retry = uniqueStage(manifest, "interpreter", "designTranslator", Number(latest.attempt || 1) + 1);
  retry.retryInput = { goalSha256: manifest.goalSha256, qaRepair: { qaReceipt: qaBinding, priorInterpreterReceipt: interpreterBinding, frozenInputs, sourceInputs }, blockingFindings: observations, deferredBlockingFindings: array(receipt.blockingFindings).filter((finding) => !owned.includes(finding)), deltaScope: correctiveScope, continuationAuthorization: continueExisting ? "explicit-user-request-to-continue-existing-version" : null, requirement: "Review current scoped corrective questions against frozen source facts; leave conflicts unresolved or route source gaps to Evidence. Repair only supported Interpreter gaps, preserve Goal and accepted Evidence, then rerun Demo and fresh independent QA." };
  manifest.interpreterQaRepairs ||= [];
  manifest.interpreterQaRepairs.push({ qaStageId: latestQa.id, qaReceipt: qaBinding, supersededStageId: latest.id, replacementStageId: retry.id, goalSha256: manifest.goalSha256, recordedAt: new Date().toISOString() });
  if (continueExisting) {
    manifest.continuations ||= [];
    manifest.continuations.push({ stageId: retry.id, resumedFrom: latestQa.id, goalSha256: manifest.goalSha256, authorizedAt: new Date().toISOString(), authorization: retry.retryInput.continuationAuthorization, additionalAttempts: 1 });
  }
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  manifest.finalGates = {};
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "running", resumedFrom: latestQa.id, nextStageId: retry.id, evidenceRetained: true, qaReceiptRepairLimit: 1 });
}

function interpreterCorrectiveDispatch(current) {
  if (!current.retryInput?.qaRepair && !current.retryInput?.closureRepair) return null;
  const { goalSha256, blockingFindings, deltaScope, requirement } = current.retryInput;
  return { goalSha256, blockingFindings, deltaScope, requirement, contextBoundary: "Current corrective observations are permitted; prior QA verdict, QA reports and implementation rationale remain forbidden." };
}

function resumeEvidence() {
  const manifest = validateManifest();
  if (manifest.mode === "apply-host") fail("resume-evidence is only valid for learn-brand workflows.");
  const latestEvidence = [...manifest.stages].reverse().find((item) => item.role === "brandResearcher");
  const latestCompleted = [...manifest.stages].reverse().find((item) => ["complete", "failed"].includes(item.status));
  const ownedEvidenceFindings = array(latestCompleted?.blockingFindings).filter((finding) =>
    (finding.ownerRole || finding.failureOwnerRole || finding.owner) === "brandResearcher");
  const consumerRejection = ["designTranslator", "demoImplementationAgent", "visualQA"].includes(latestCompleted?.role)
    && latestCompleted.verdict === "needs-evidence"
    && (latestCompleted.failureOwnerRole === "brandResearcher" || ownedEvidenceFindings.length > 0);
  const rejection = consumerRejection ? latestCompleted : latestEvidence;
  if (manifest.status !== "blocked" || !latestEvidence || rejection?.verdict !== "needs-evidence" || (!consumerRejection && latestCompleted?.id !== latestEvidence.id)) {
    fail("resume-evidence requires a blocked Evidence failure or a current consumer rejection explicitly owned by brandResearcher.");
  }
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  const authorizedContinuation = args.includes("--continue-existing");
  if (latestEvidence.attempt >= maxAttempts && !authorizedContinuation) fail("Evidence retry budget is exhausted. An explicit user instruction to continue the same case is required; then rerun with --continue-existing.");
  // Historical fixtures without a receipt have no authenticated bytes to archive.
  // Recorded attempts must preserve their canonical outputs before a retry writes them.
  const archiveFile = latestEvidence.receiptPath && latestEvidence.receiptSha256
    && latestEvidence.dispatchPath && array(latestEvidence.outputHashes).length
    ? archiveFailedStage(latestEvidence) : null;
  const retry = uniqueStage(manifest, "evidence", "brandResearcher", latestEvidence.attempt + 1);
  retry.retryInput = {
    goalSha256: manifest.goalSha256,
    blockingFindings: consumerRejection && rejection.failureOwnerRole !== "brandResearcher"
      ? ownedEvidenceFindings : array(rejection.blockingFindings),
    deferredBlockingFindings: consumerRejection && rejection.failureOwnerRole !== "brandResearcher"
      ? array(rejection.blockingFindings).filter((finding) => !ownedEvidenceFindings.includes(finding)) : [],
    rejectedByStageId: consumerRejection ? rejection.id : null,
    deltaScope: rejection.deltaScope || null,
    continuationAuthorization: authorizedContinuation ? "explicit-user-request-to-continue-existing-version" : null,
  };
  if (archiveFile) {
    retry.retryInput.priorStageId = latestEvidence.id;
    retry.retryInput.failedAttemptArchive = hashedPath(relative(archiveFile));
    manifest.evidenceRetries ||= [];
    manifest.evidenceRetries.push({ priorStageId: latestEvidence.id, replacementStageId: retry.id, archive: retry.retryInput.failedAttemptArchive });
  }
  if (authorizedContinuation) {
    manifest.continuations ||= [];
    manifest.continuations.push({ stageId: retry.id, resumedFrom: rejection.id, goalSha256: manifest.goalSha256, authorizedAt: new Date().toISOString(), authorization: retry.retryInput.continuationAuthorization, additionalAttempts: 1 });
  }
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, resumedFrom: rejection.id, nextStageId: retry.id, blockingFindings: retry.retryInput.blockingFindings });
}

function resumeQa() {
  const manifest = validateManifest();
  const latestQa = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  const continueExisting = args.includes("--continue-existing");
  if (manifest.mode === "apply-host" && latestQa?.stage === "previewQA") {
    return retryHostPreviewQaStage();
  }
  if (continueExisting && manifest.mode === "design-host" && ["timed-out", "running"].includes(manifest.status) && latestQa?.status === "dispatched") {
    const now = Date.now();
    latestQa.status = "failed";
    latestQa.verdict = "needs-evidence";
    latestQa.endedAt = new Date(now).toISOString();
    latestQa.blockingFindings = [{ code: "STALE_QA_DISPATCH_REPLACED", message: "The prior QA packet lacked the current frozen evidence contract; explicit user continuation starts a fresh QA packet." }];
    const retry = uniqueStage(manifest, "designVisualQA", "visualQA", Number(latestQa.attempt || 1) + 1);
    retry.retryInput = {
      goalSha256: manifest.goalSha256,
      blockingFindings: latestQa.blockingFindings,
      deterministicMechanicalQaRequired: true,
      continuationAuthorization: "explicit-user-request-to-continue-existing-version",
    };
    manifest.stages.push(retry);
    manifest.status = "running";
    manifest.currentStageId = retry.id;
    manifest.previewTargetAt = new Date(now + 300000).toISOString();
    manifest.deadlineAt = new Date(now + 1200000).toISOString();
    manifest.continuations ||= [];
    manifest.continuations.push({
      kind: "explicit-user-request-to-continue-existing-visual-qa-stage",
      abandonedStageId: latestQa.id,
      stageId: retry.id,
      continuedAt: new Date(now).toISOString(),
      priorTimeout: manifest.timeout || null,
    });
    manifest.timeout = null;
    writeJson(manifestFile, manifest);
    output({ ok: true, status: "running", resumedFrom: latestQa.id, nextStageId: retry.id, continuation: "fresh-qa-dispatch-after-timeout", deadlineAt: manifest.deadlineAt });
    return;
  }
  if (manifest.status !== "blocked" || latestQa?.verdict !== "needs-evidence") {
    fail("resume-qa requires a blocked workflow whose latest Visual QA verdict is needs-evidence, or --continue-existing after an explicit user request when the current dispatched QA stage timed out.");
  }
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  const completedQaAttempts = manifest.stages.filter((item) => item.role === "visualQA" && ["complete", "failed"].includes(item.status)).length;
  const environmentBlocker = array(latestQa.blockingFindings).some((item) => /(?:BROWSER|TOOL|CAPABILITY|RUNTIME).*UNAVAILABLE|UNAVAILABLE.*(?:BROWSER|TOOL|CAPABILITY|RUNTIME)/i.test(`${item?.code || ""} ${item?.message || ""}`));
  const allowedAttempts = maxAttempts + (environmentBlocker ? 1 : 0);
  if (completedQaAttempts >= allowedAttempts && !continueExisting) fail("Visual QA retry budget is exhausted. An explicit user instruction to continue the same version is required; then rerun with --continue-existing.");
  const assessmentFile = path.join(migrationDir, "visual-qa-assessment.json");
  const assessment = fs.existsSync(assessmentFile) ? readJsonRequired(assessmentFile) : {};
  const qaStage = manifest.mode === "design-host" ? "designVisualQA" : "visualQA";
  const retry = uniqueStage(manifest, qaStage, "visualQA", completedQaAttempts + 1);
  retry.retryInput = {
    goalSha256: manifest.goalSha256,
    blockingFindings: array(latestQa.blockingFindings).length
      ? array(latestQa.blockingFindings)
      : array(assessment.blockingFindings),
    deltaScope: latestQa.deltaScope || assessment.deltaScope || null,
    environmentRetry: environmentBlocker,
    continuationAuthorization: continueExisting ? "explicit-user-request-to-continue-existing-version" : null,
  };
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, resumedFrom: latestQa.id, nextStageId: retry.id, blockingFindings: retry.retryInput.blockingFindings });
}

function retryHostPreviewQaStage() {
  const manifest = validateManifest();
  try {
    const result = retryHostPreviewQa({ root, brand, manifest, continueExisting: args.includes("--continue-existing"), reason: opt("--reason", ""), verifyFrozenBindings: ({ implementation }) => {
      const receipt = readJsonRequired(path.resolve(root, implementation.receiptPath));
      verifyHostPreeditGate("receipt", receipt, undefined, implementation.id);
      return true;
    } });
    writeJson(manifestFile, result.manifest);
    output({ ok: true, status: "running", resumedFrom: result.stage.retryInput.priorStageId, nextStageId: result.stage.id, archive: result.archive, fullWorkflowPass: false, maximumAttempts: result.maximumAttempts });
  } catch (error) { fail(error.message); }
}

function retryH5() {
  if (!args.includes("--continue-existing")) fail("H5_RETRY_EXPLICIT_CONTINUATION_REQUIRED: use --continue-existing only after an explicit user request to continue this failed preview.");
  const manifest = validateManifest();
  const pendingQa = manifest.stages.at(-1);
  const visualRepair = manifest.mode === "design-host" && manifest.status === "blocked" && !manifest.currentStageId && pendingQa?.stage === "designVisualQA" && pendingQa.status === "failed" && pendingQa.verdict === "fail" && ["brandApplicationDesigner", "designTranslator"].includes(pendingQa.failureOwnerRole);
  const mechanical = manifest.mode === "design-host" && ["running", "blocked", "timed-out"].includes(manifest.status) && pendingQa?.stage === "designVisualQA" && pendingQa.status === "pending" && !pendingQa.dispatchPath && manifest.currentStageId === pendingQa.id ? validateMechanicalFailure(manifest) : null;
  const latest = mechanical ? manifest.stages.at(-2) : manifest.stages.at(-1);
  if (!mechanical && !visualRepair && (manifest.mode !== "design-host" || !["blocked", "timed-out"].includes(manifest.status) || manifest.currentStageId || latest?.stage !== "h5DirectionGeneration" || latest.status !== "failed" || !["fail", "needs-evidence"].includes(latest.verdict))) fail("H5_RETRY_FAILED_STAGE_REQUIRED: retry only a receipt-backed failed H5 producer or its bound QA rejection.");
  if (visualRepair && array(manifest.h5Retries).some(item => item.kind === "visual-qa-repair")) fail("H5_VISUAL_RETRY_BUDGET_EXHAUSTED");
  // Explicit continuation grants one bounded repair beyond the frozen automatic
  // attempt budget (fast goals commonly allow only the original attempt).
  if (mechanical && array(manifest.h5Retries).some(item => item.kind === "pre-qa-mechanical-repair")) fail("H5_MECHANICAL_RETRY_BUDGET_EXHAUSTED");
  const grant = validatePreviewGrant(root, manifest.previewContinuation);
  if (grant?.error) fail(grant.error);
  if (fs.existsSync(path.join(migrationDir, "approved-master.json"))) fail("H5_RETRY_APPROVED_MASTER_FORBIDDEN");
  const receiptBinding = { path: latest.receiptPath, sha256: latest.receiptSha256 };
  verifyHashedPath(receiptBinding);
  const receipt = readJsonRequired(path.resolve(root, receiptBinding.path));
  if (receipt.stageId !== latest.id || receipt.verdict !== latest.verdict || JSON.stringify(array(receipt.outputs)) !== JSON.stringify(array(latest.outputHashes))) fail("H5_RETRY_FAILED_RECEIPT_MISMATCH");
  if (visualRepair) {
    verifyHashedPath({path: latest.dispatchPath, sha256: latest.dispatchSha256});
    const dispatch = readJsonRequired(path.resolve(root, latest.dispatchPath));
    // QA may legitimately update the route; its receipt output supersedes that input.
    for (const binding of latestInputsByPath([...array(dispatch.requiredInputs), ...array(receipt.inputs), ...array(receipt.outputs)])) verifyHashedPath(binding);
  }
  const transferFile = opt("--transfer-review", "");
  const transferSha = opt("--transfer-review-sha256", "");
  const producers = manifest.stages.map((item) => item.agentExecutionId).filter(Boolean);
  if (transferFile || transferSha) {
    if (!manifest.previewContinuation || !grant) fail("TRANSFER_MACRO_PREVIEW_GRANT_REQUIRED");
    try { validateTransferReview({ file: transferFile, sha256: transferSha, brand, producers }); } catch (error) { fail(error.message); }
  }
  const archiveFile = archiveFailedStage(latest, mechanical ? [hashedPath(relative(h5MechanicalQaFile))] : []);
  const now = Date.now();
  const retry = uniqueStage(manifest, "h5DirectionGeneration", "brandApplicationDesigner", Number(latest.attempt || 1) + 1);
  retry.retryInput = { priorStageId: latest.id, failedAttemptArchive: hashedPath(relative(archiveFile)), blockingFindings: array(latest.blockingFindings), continuationAuthorization: "explicit-user-request-to-continue-existing-preview", requirement: "Repair the failed H5 generation within the unchanged frozen host, brand and preview grant. Preserve archived outputs and the frozen expressive production requirement; complete producer rendering and independent H5 QA before delivery. No host edits." };
  if (visualRepair) {
    retry.retryInput.deltaScope = latest.deltaScope;
    retry.retryInput.requirement = "Repair only the failed directions and scoped findings from the archived independent QA. Preserve passing directions, host content and interactions. Re-run mechanical and fresh independent visual QA; do not change source permissions or approve new brand semantics.";
  }
  if (mechanical) {
    retry.retryInput.blockingFindings = mechanical.blockingFindings;
    retry.retryInput.requirement = "Repair only the bound mechanical findings in existing H5 directions; preserve design, frozen host and brand inputs. The prior producer PASS remains historical, not a visual QA approval. Re-run mechanical and independent visual QA.";
    pendingQa.status = "cancelled";
    pendingQa.cancelledReason = "pre-QA mechanical rejection; no reviewer was dispatched";
    pendingQa.replacementProducerStageId = retry.id;
    manifest.mechanicalFailure = null;
  }
  if (transferFile) retry.retryInput.sourceTransfer = installTransferReview({ file: transferFile, sha256: transferSha, root, brand, stageId: retry.id, producers });
  manifest.h5Retries ||= [];
  manifest.h5Retries.push({ ...(mechanical ? { kind: "pre-qa-mechanical-repair" } : visualRepair ? {kind:"visual-qa-repair"} : {}), priorStageId: latest.id, replacementStageId: retry.id, archive: retry.retryInput.failedAttemptArchive, authorizedAt: new Date(now).toISOString(), authorization: retry.retryInput.continuationAuthorization, additionalAttempts: 1, priorStatus: manifest.status, priorTimeout: manifest.timeout ? structuredClone(manifest.timeout) : null, priorDeadlineAt: manifest.deadlineAt });
  manifest.stages.push(retry);
  manifest.status = "running";
  manifest.currentStageId = retry.id;
  manifest.previewTargetAt = new Date(now + 300000).toISOString();
  manifest.deadlineAt = new Date(now + 1200000).toISOString();
  manifest.timeout = null;
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "running", resumedFrom: latest.id, nextStageId: retry.id, archive: retry.retryInput.failedAttemptArchive, deadlineAt: manifest.deadlineAt, nextAction: "Run next and execute the new H5 producer dispatch; independent QA and the original preview grant remain required." });
}

function archiveFailedStage(latest, extraBindings = [], consumerRejection = null) {
  const receiptBinding = { path: latest.receiptPath, sha256: latest.receiptSha256 };
  const dispatchBinding = hashedPath(latest.dispatchPath);
  const bindings = latestInputsByPath([...array(latest.outputHashes), receiptBinding, dispatchBinding, ...extraBindings]);
  if (fs.lstatSync(root).isSymbolicLink()) fail("H5_RETRY_OUTPUT_SYMLINK_FORBIDDEN");
  for (const binding of bindings) {
    const source = path.resolve(root, binding.path);
    const hostInputDir = path.join(root, "host-input");
    const inside = (directory) => source.startsWith(`${directory}${path.sep}`);
    if ((!inside(migrationDir) && !inside(hostInputDir)) || !fs.lstatSync(source).isFile()) fail("H5_RETRY_OUTPUT_OUTSIDE_MIGRATION");
    for (let current = source; current !== root; current = path.dirname(current)) {
      if (fs.lstatSync(current).isSymbolicLink()) fail("H5_RETRY_OUTPUT_SYMLINK_FORBIDDEN");
    }
    verifyHashedPath(binding);
  }
  const archiveDir = path.join(migrationDir, "attempts", latest.id);
  if (fs.existsSync(archiveDir)) fail("H5_RETRY_ARCHIVE_ALREADY_EXISTS");
  const archivedOutputs = bindings.map((binding) => {
    const source = path.resolve(root, binding.path);
    const target = path.join(archiveDir, "workspace", path.relative(root, source));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    return { originalPath: binding.path, path: relative(target), sha256: binding.sha256 };
  });
  const archiveFile = path.join(archiveDir, "archive.json");
  fs.writeFileSync(archiveFile, `${JSON.stringify({ schema: latest.stage === "h5DirectionGeneration" ? "brand-h5-attempt-archive/v1" : "brand-failed-stage-archive/v1", stage: latest, archivedOutputs, ...(consumerRejection ? {consumerRejection} : {}) }, null, 2)}\n`, { flag: "wx" });
  return archiveFile;
}

function retryHostStrategy() {
  if (!args.includes("--continue-existing") || !opt("--reason", "").trim()) fail("HOST_STRATEGY_RETRY_AUTHORIZATION_REQUIRED");
  const manifest = validateManifest(), latest = manifest.stages.at(-1);
  if (manifest.mode !== "apply-host" || manifest.status !== "blocked" || manifest.currentStageId || latest?.stage !== "hostStrategy" || latest.status !== "failed" || !["fail", "needs-evidence"].includes(latest.verdict)) fail("HOST_STRATEGY_RETRY_INVALID_STATE");
  const limit = Math.min(2, Number(readJsonRequired(goalFile).thresholds?.maxAttempts || 2));
  if (Number(latest.attempt || 1) >= limit) fail("HOST_STRATEGY_RETRY_BUDGET_EXHAUSTED");
  verifyHashedPath({path:latest.receiptPath,sha256:latest.receiptSha256});
  const receipt=readJsonRequired(path.resolve(root,latest.receiptPath));
  if (receipt.stageId !== latest.id || receipt.role !== "hostStrategist" || receipt.verdict !== latest.verdict || receipt.goalSha256 !== manifest.goalSha256 || JSON.stringify(array(receipt.outputs)) !== JSON.stringify(array(latest.outputHashes))) fail("HOST_STRATEGY_RETRY_RECEIPT_MISMATCH");
  verifyFrozenDesignGate();
  const archiveFile=archiveFailedStage(latest), retry=uniqueStage(manifest,"hostStrategy","hostStrategist",Number(latest.attempt||1)+1);
  retry.retryInput={priorStageId:latest.id,failedAttemptArchive:hashedPath(relative(archiveFile)),reason:opt("--reason", ""),requirement:"Repair only the Host Strategy output contract within the unchanged approved local target. No host edits, new brand permissions, or source-learning certification. Post-edit binding remains required before edits."};
  manifest.hostStrategyRetries ||= [];
  manifest.hostStrategyRetries.push({priorStageId:latest.id,replacementStageId:retry.id,archive:retry.retryInput.failedAttemptArchive,authorizedAt:new Date().toISOString(),authorization:"explicit-continue-existing",additionalAttempts:1});
  manifest.stages.push(retry);
  manifest.status = "running";
  manifest.currentStageId = retry.id;
  writeJson(manifestFile, manifest);
  output({ok:true,status:"running",nextStageId:retry.id,archive:retry.retryInput.failedAttemptArchive,maximumAttempts:limit,fullWorkflowPass:false});
}

function retryHostImplementation() {
  if (!args.includes("--continue-existing") || !opt("--reason","").trim()) fail("HOST_IMPLEMENTATION_RETRY_AUTHORIZATION_REQUIRED");
  const manifest=validateManifest(), latest=manifest.stages.at(-1);
  if (manifest.mode!=="apply-host" || manifest.status!=="blocked" || manifest.currentStageId || latest?.stage!=="hostImplementation" || latest.status!=="failed" || !["fail","needs-evidence"].includes(latest.verdict) || !manifest.selectedH5PosteditBinding) fail("HOST_IMPLEMENTATION_RETRY_INVALID_STATE");
  const limit=Math.min(2,Number(readJsonRequired(goalFile).thresholds?.maxAttempts||2));
  if (Number(latest.attempt||1)>=limit) fail("HOST_IMPLEMENTATION_RETRY_BUDGET_EXHAUSTED");
  verifyHashedPath({path:latest.receiptPath,sha256:latest.receiptSha256});
  const receipt=readJsonRequired(path.resolve(root,latest.receiptPath));
  if (receipt.stageId!==latest.id || receipt.role!==latest.role || receipt.verdict!==latest.verdict || receipt.goalSha256!==manifest.goalSha256 || JSON.stringify(array(receipt.outputs))!==JSON.stringify(array(latest.outputHashes))) fail("HOST_IMPLEMENTATION_RETRY_RECEIPT_MISMATCH");
  verifyHostPreeditGate("retry",receipt,latest.id);
  const valid=validateLocalSelectedMaster(root,brand,{phase:"postedit",...manifest.selectedH5PosteditBinding,priorStageId:latest.id});
  if (!valid.ok) fail(valid.errors.join(";"));
  const currentHostInputs=[valid.review.host.source,valid.review.host.styles].filter(Boolean).map(name=>hashedPath(path.join(valid.review.host.root,name)));
  const archiveFile=archiveFailedStage(latest),retry=uniqueStage(manifest,"hostImplementation","hostImplementationAgent",Number(latest.attempt||1)+1);
  retry.maxAttempts=limit;
  retry.retryInput={priorStageId:latest.id,failedAttemptArchive:hashedPath(relative(archiveFile)),currentHostInputs,reason:opt("--reason",""),requirement:"Continue only this approved local implementation. Preserve original snapshots and scope; fresh structural, native runtime and independent QA remain mandatory."};
  manifest.hostImplementationRetries ||= [];
  manifest.hostImplementationRetries.push({priorStageId:latest.id,replacementStageId:retry.id,archive:retry.retryInput.failedAttemptArchive,authorizedAt:new Date().toISOString(),authorization:"explicit-continue-existing",additionalAttempts:1});
  manifest.stages.push(retry);manifest.status="running";manifest.currentStageId=retry.id;writeJson(manifestFile,manifest);
  output({ok:true,status:"running",nextStageId:retry.id,maximumAttempts:limit,archive:retry.retryInput.failedAttemptArchive,fullWorkflowPass:false});
}

function resumeConcepts() {
  const manifest = validateManifest();
  const current = manifest.stages.at(-1);
  if (args.includes("--continue-existing") && manifest.mode === "design-host" && manifest.executionProfile === "fast" && ["running", "timed-out"].includes(manifest.status) && current?.stage === "h5DirectionGeneration" && current.status === "dispatched") {
    if (array(manifest.continuations).some(item => item.stageId === current.id)) fail("H5_CONTINUATION_ALREADY_GRANTED");
    if (manifest.status === "running" && manifest.currentStageId !== current.id) fail("H5_CONTINUATION_NOT_CURRENT");
    verifyHashedPath({path:current.dispatchPath,sha256:current.dispatchSha256});
    const dispatch = readJsonRequired(path.resolve(root,current.dispatchPath));
    for (const input of array(dispatch.requiredInputs)) verifyHashedPath(input);
    const now = Date.now();
    manifest.continuations ||= [];
    manifest.continuations.push({kind:"explicit-user-request-to-continue-existing-h5-stage",stageId:current.id,continuedAt:new Date(now).toISOString(),priorDeadlineAt:manifest.deadlineAt,priorTimeout:manifest.timeout || null});
    manifest.status = "running";
    manifest.currentStageId = current.id;
    manifest.previewTargetAt = new Date(now + 300000).toISOString();
    manifest.deadlineAt = new Date(now + 1200000).toISOString();
    manifest.timeout = null;
    writeJson(manifestFile,manifest);
    return output({ok:true,status:"running",resumedFrom:current.id,nextStageId:current.id,continuation:"existing-dispatch",deadlineAt:manifest.deadlineAt});
  }
  const latest = [...manifest.stages].reverse().find((item) => item.stage === "conceptGeneration");
  const continueExisting = args.includes("--continue-existing");
  if (continueExisting && manifest.mode === "design-host" && manifest.status === "timed-out" && latest?.status === "dispatched") {
    const now = Date.now();
    manifest.status = "running";
    manifest.currentStageId = latest.id;
    manifest.previewTargetAt = new Date(now + 300000).toISOString();
    manifest.deadlineAt = new Date(now + 1200000).toISOString();
    manifest.continuations ||= [];
    manifest.continuations.push({
      kind: "explicit-user-request-to-continue-existing-concept-stage",
      stageId: latest.id,
      continuedAt: new Date(now).toISOString(),
      priorTimeout: manifest.timeout || null,
    });
    manifest.timeout = null;
    writeJson(manifestFile, manifest);
    output({ ok: true, status: "running", resumedFrom: latest.id, nextStageId: latest.id, continuation: "existing-dispatch", deadlineAt: manifest.deadlineAt });
    return;
  }
  if (manifest.mode !== "design-host" || manifest.status !== "blocked" || latest?.verdict !== "needs-evidence") {
    fail("resume-concepts requires a blocked design-host whose latest conceptGeneration verdict is needs-evidence, or --continue-existing after an explicit user request when the current dispatched concept stage timed out.");
  }
  const attempts = manifest.stages.filter((item) => item.stage === "conceptGeneration" && ["complete", "failed"].includes(item.status)).length;
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  if (attempts >= maxAttempts) fail("Concept generation retry budget is exhausted.");
  const route = readJsonRequired(designHostRouteFile);
  route.imageCapability = { status: "required" };
  route.demoImages = { status: "pending" };
  route.demoVisualReview = { status: "pending" };
  route.userDirectionReview = { status: "pending" };
  writeJson(designHostRouteFile, route);
  const retry = uniqueStage(manifest, "conceptGeneration", "brandApplicationDesigner", attempts + 1);
  retry.retryInput = { priorStageId: latest.id, blockingFindings: array(latest.blockingFindings), requirement: "Resume only in an execution environment exposing the required image-generation tool." };
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "running", resumedFrom: latest.id, nextStageId: retry.id });
}

function resumeDemo() {
  const manifest = validateManifest();
  if (manifest.mode === "apply-host") fail("resume-demo is only valid for learn-brand workflows.");
  const latestQa = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  const latestDemo = [...manifest.stages].reverse().find((item) => item.role === "demoImplementationAgent");
  const latestCompleted = [...manifest.stages].reverse().find((item) => ["complete", "failed"].includes(item.status));
  if (manifest.mode === "learn-brand" && manifest.status === "running" && manifest.currentStageId === latestQa?.id && latestQa?.status === "pending" && latestCompleted?.id === latestDemo?.id && latestDemo?.status === "complete" && latestDemo.verdict === "pass") {
    if (latestQa.dispatchPath || latestQa.receiptPath || latestQa.qaReview || opt("--repair-input", "")) fail("DEMO_CONSUMER_REPAIR_QA_ALREADY_PREPARED");
    if (array(manifest.demoProducerRetries).some(item => item.consumerRejection)) fail("DEMO_CONSUMER_REPAIR_BUDGET_EXHAUSTED");
    if (readJsonRequired(goalFile).goalType !== "brand-learning-capability-test") fail("DEMO_CONSUMER_REPAIR_LEARNING_GOAL_REQUIRED");
    const ref = array(latestDemo.outputHashes).find(item => /visual-pattern-inventory\.json$/.test(item.path));
    if (!ref) fail("DEMO_CONSUMER_REPAIR_INVENTORY_REQUIRED");
    verifyHashedPath(ref);
    const inventory = readJsonRequired(path.resolve(root, ref.path));
    const explicit = Object.hasOwn(inventory, "attempt");
    const firstProducer = manifest.stages.filter(item => item.stage === "demo").length === 1 && latestDemo.attempt === 1;
    if (inventory.schema !== "brand-visual-pattern-inventory/v1" || (explicit ? Number.isInteger(inventory.attempt) && inventory.attempt > 0 : firstProducer)) fail("DEMO_CONSUMER_REPAIR_NO_REJECTION");
    return resumeFailedDemo(manifest, latestDemo, {code:"QA_REVIEW_PATTERN_ATTEMPT_REQUIRED", inventory:ref, pendingQa:structuredClone(latestQa)});
  }
  if (manifest.mode === "learn-brand" && manifest.status === "blocked" && manifest.stages.at(-1)?.id === latestDemo?.id && latestCompleted?.id === latestDemo?.id && latestDemo?.status === "failed" && ["fail", "needs-evidence"].includes(latestDemo.verdict)) return resumeFailedDemo(manifest, latestDemo);
  if (opt("--repair-input", "")) fail("DEMO_REPAIR_REQUIRES_CURRENT_PRODUCER_FAILURE");
  if (manifest.status !== "blocked" || !["fail", "needs-evidence"].includes(latestQa?.verdict)) {
    fail("resume-demo requires a blocked workflow whose latest Visual QA verdict is fail or needs-evidence.");
  }
  const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
  const nextAttempt = manifest.stages.filter((item) => item.role === "demoImplementationAgent" && ["complete", "failed"].includes(item.status)).length + 1;
  const authorizedContinuation = args.includes("--continue-existing");
  if (nextAttempt > maxAttempts && !authorizedContinuation) fail("Demo retry budget is exhausted. An explicit user instruction to continue the same version is required; then rerun with --continue-existing.");
  const preservation = preserveQaTriggeredDemo(manifest, latestQa, latestDemo);
  const assessmentFile = path.join(migrationDir, "visual-qa-assessment.json");
  const assessment = fs.existsSync(assessmentFile) ? readJsonRequired(assessmentFile) : {};
  const retry = uniqueStage(manifest, "demo", "demoImplementationAgent", nextAttempt);
  retry.retryInput = {
    goalSha256: manifest.goalSha256,
    blockingFindings: array(latestQa.blockingFindings).length
      ? array(latestQa.blockingFindings)
      : array(assessment.blockingFindings),
    deltaScope: latestQa.deltaScope || assessment.deltaScope || null,
    priorQaPreservation: preservation,
    continuationAuthorization: authorizedContinuation ? "explicit-user-request-to-continue-existing-version" : null,
  };
  manifest.demoQaRetries ||= [];
  manifest.demoQaRetries.push({ priorQaStageId: latestQa.id, priorDemoStageId: latestDemo.id, replacementStageId: retry.id, archive: preservation, authorization: retry.retryInput.continuationAuthorization, additionalAttempts: 1 });
  manifest.stages.push(retry);
  manifest.currentStageId = retry.id;
  manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: manifest.status, resumedFrom: latestQa.id, nextStageId: retry.id, archive: preservation, blockingFindings: retry.retryInput.blockingFindings });
}

function preserveQaTriggeredDemo(manifest, qa, demo) {
  if (!qa?.receiptPath || !qa?.receiptSha256 || !qa?.dispatchPath || !demo?.receiptPath || !demo?.receiptSha256) fail("DEMO_QA_PRESERVATION_BINDING_REQUIRED");
  verifyHashedPath({path:qa.receiptPath,sha256:qa.receiptSha256});
  verifyHashedPath({path:demo.receiptPath,sha256:demo.receiptSha256});
  if (qa.dispatchSha256) verifyHashedPath({path:qa.dispatchPath,sha256:qa.dispatchSha256});
  const qaReceipt=readJsonRequired(path.resolve(root,qa.receiptPath)), demoReceipt=readJsonRequired(path.resolve(root,demo.receiptPath));
  const qaDispatch=readJsonRequired(path.resolve(root,qa.dispatchPath));
  if (qaReceipt.stageId!==qa.id || qaReceipt.role!=="visualQA" || qaReceipt.goalSha256!==manifest.goalSha256 || qaReceipt.verdict!==qa.verdict || qaReceipt.dispatchId!==qaDispatch.dispatchId || qaDispatch.stageId!==qa.id || qaDispatch.goalSha256!==manifest.goalSha256 || JSON.stringify(array(qaReceipt.outputs))!==JSON.stringify(array(qa.outputHashes))) fail("DEMO_QA_PRESERVATION_QA_BINDING_INVALID");
  for (const ref of array(qaDispatch.requiredInputs)) if (!array(qaReceipt.inputs).some(item=>item.path===ref.path&&item.sha256===ref.sha256)) fail("DEMO_QA_PRESERVATION_QA_INPUT_INVALID");
  if (demoReceipt.stageId!==demo.id || demoReceipt.role!=="demoImplementationAgent" || demoReceipt.goalSha256!==manifest.goalSha256 || demoReceipt.verdict!=="pass" || JSON.stringify(array(demoReceipt.outputs))!==JSON.stringify(array(demo.outputHashes))) fail("DEMO_QA_PRESERVATION_DEMO_BINDING_INVALID");
  const refs=[...new Map([...array(demoReceipt.inputs),...array(demoReceipt.outputs),...array(qaReceipt.inputs)].map(ref=>[`${ref.path}@${ref.sha256}`,ref])).values()];
  const realRoot=fs.realpathSync(root);
  for (const ref of refs) {
    verifyHashedPath(ref);
    const source=path.resolve(root,ref.path);
    if (!source.startsWith(`${root}${path.sep}`) || !fs.lstatSync(source).isFile() || !fs.realpathSync(source).startsWith(`${realRoot}${path.sep}`)) fail("DEMO_QA_PRESERVATION_OUTSIDE_RUN");
  }
  const archiveDir=path.join(migrationDir,"attempts",demo.id),archiveFile=path.join(archiveDir,"producer-preservation-archive.json");
  if (fs.existsSync(archiveFile)) {
    const archive=readJsonRequired(archiveFile);
    if (archive.schema!=="brand-qa-triggered-demo-preservation/v1" || JSON.stringify(archive.stage)!==JSON.stringify(demo) || JSON.stringify(archive.qaStage)!==JSON.stringify(qa)) fail("DEMO_QA_PRESERVATION_ARCHIVE_BINDING_INVALID");
    for (const copy of array(archive.archivedOutputs)) verifyHashedPath(copy);
    for (const ref of refs) if (!array(archive.archivedOutputs).some(copy=>copy.originalPath===ref.path&&copy.sha256===ref.sha256)) fail("DEMO_QA_PRESERVATION_ARCHIVE_INCOMPLETE");
    return hashedPath(relative(archiveFile));
  }
  if (fs.existsSync(archiveDir)) fail("DEMO_QA_PRESERVATION_ARCHIVE_CONFLICT");
  const archivedOutputs=refs.map(ref=>{
    const source=path.resolve(root,ref.path),target=path.join(archiveDir,"producer-preservation-workspace",ref.sha256,ref.path);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
    return {originalPath:ref.path,path:relative(target),sha256:ref.sha256};
  });
  fs.writeFileSync(archiveFile,`${JSON.stringify({schema:"brand-qa-triggered-demo-preservation/v1",stage:structuredClone(demo),qaStage:structuredClone(qa),archivedOutputs,preservedAt:new Date().toISOString(),reason:"preserve hash-bound Demo and QA-consumed inputs before a QA-triggered same-path producer retry"},null,2)}\n`,{flag:"wx"});
  return hashedPath(relative(archiveFile));
}

function resumeFailedDemo(manifest, latest, consumerRejection = null) {
  if (!args.includes("--continue-existing")) fail("DEMO_PRODUCER_CONTINUATION_REQUIRES_EXPLICIT_AUTHORIZATION");
  if (array(manifest.demoProducerRetries).some(item => item.priorStageId === latest.id)) fail("DEMO_PRODUCER_FAILURE_ALREADY_CONSUMED");
  if (!latest.receiptPath || !latest.receiptSha256 || !latest.dispatchPath || !array(latest.outputHashes).length) fail("DEMO_PRODUCER_RECORDED_FAILURE_REQUIRED");
  verifyHashedPath({ path: latest.receiptPath, sha256: latest.receiptSha256 });
  const receipt = readJsonRequired(path.resolve(root, latest.receiptPath));
  const dispatch = readJsonRequired(path.resolve(root, latest.dispatchPath));
  if (receipt.stageId !== latest.id || receipt.role !== latest.role || receipt.verdict !== latest.verdict || receipt.goalSha256 !== manifest.goalSha256
    || receipt.dispatchId !== dispatch.dispatchId || dispatch.stageId !== latest.id || dispatch.goalSha256 !== manifest.goalSha256) fail("DEMO_PRODUCER_FAILURE_BINDING_INVALID");
  if (JSON.stringify(array(receipt.outputs)) !== JSON.stringify(array(latest.outputHashes))) fail("DEMO_PRODUCER_OUTPUT_BINDING_INVALID");
  for (const input of array(dispatch.requiredInputs)) {
    if (!array(receipt.inputs).some(item => item.path === input.path && item.sha256 === input.sha256)) fail("DEMO_PRODUCER_DISPATCH_INPUT_BINDING_INVALID");
  }
  const frozenInputs = latestInputsByPath([...array(dispatch.requiredInputs), ...array(receipt.inputs)]).map(input => {
    // An in-place producer may have consumed the preceding output at the same
    // path. Recover those exact historical bytes, never rebind them to new bytes.
    const superseded = consumerRejection && array(latest.outputHashes).some(output => output.path === input.path && output.sha256 !== input.sha256);
    if (!superseded || /goal-contract|brand-intent|brand-mod|approved|design-direction|frozen.*rule|learning-trial/i.test(input.path)) return input;
    const preservation = latest.retryInput?.priorQaPreservation || latest.retryInput?.failedAttemptArchive;
    if (!preservation) return input;
    verifyHashedPath(preservation);
    const copy = array(readJsonRequired(path.resolve(root, preservation.path)).archivedOutputs).find(item => item.originalPath === input.path && item.sha256 === input.sha256);
    if (!copy) return input;
    verifyHashedPath(copy);
    return {path:copy.path,sha256:copy.sha256};
  });
  for (const input of frozenInputs) verifyHashedPath(input);
  let repairInput = null;
  const repairPath = opt("--repair-input", "");
  if (repairPath) {
    const repairFile = path.resolve(root, repairPath);
    if (!repairFile.startsWith(`${migrationDir}${path.sep}`) || !fs.realpathSync(repairFile).startsWith(`${fs.realpathSync(migrationDir)}${path.sep}`)) fail("DEMO_REPAIR_INPUT_OUTSIDE_RUN");
    const repair = readJsonRequired(repairFile);
    if (repair.schema !== "brand-demo-director-repair/v1" || repair.ownerRole !== "designDirectorOrchestrator" || repair.goalSha256 !== manifest.goalSha256
      || repair.rejectedStageId !== latest.id || repair.rejectedReceipt?.path !== latest.receiptPath || repair.rejectedReceipt?.sha256 !== latest.receiptSha256) fail("DEMO_REPAIR_INPUT_BINDING_INVALID");
    for (const input of array(repair.inputs)) { verifyHashedPath(input); frozenInputs.push(input); }
    repairInput = hashedPath(relative(repairFile));
  }
  const archive = hashedPath(relative(archiveFailedStage(latest, [], consumerRejection)));
  const attempt = manifest.stages.filter(item => item.role === latest.role && ["complete", "failed"].includes(item.status)).length + 1;
  const retry = uniqueStage(manifest, "demo", latest.role, attempt);
  retry.retryInput = { goalSha256: manifest.goalSha256, priorStageId: latest.id, failedAttemptArchive: archive, producerRepair: true, frozenInputs, repairInput, blockingFindings: array(latest.blockingFindings), deltaScope: latest.deltaScope || null, continuationAuthorization: "explicit-user-request-to-continue-existing-version" };
  if (consumerRejection) {
    retry.retryInput.blockingFindings = [{code:consumerRejection.code,ownerRole:latest.role,finding:"Declare the accurate quality attempt in the pattern inventory; workflow retry count is not the quality counter. Preserve runtime bytes and all frozen rules."}];
    const pending = manifest.stages.find(item => item.id === consumerRejection.pendingQa.id);
    pending.status = "cancelled";pending.cancelledReason = "producer output rejected before QA preparation";pending.replacementProducerStageId = retry.id;
  }
  manifest.demoProducerRetries ||= [];
  manifest.demoProducerRetries.push({ priorStageId: latest.id, replacementStageId: retry.id, archive, repairInput, ...(consumerRejection ? {consumerRejection} : {}), authorization: retry.retryInput.continuationAuthorization, additionalAttempts: 1 });
  manifest.stages.push(retry); manifest.currentStageId = retry.id; manifest.status = "running";
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "running", resumedFrom: latest.id, nextStageId: retry.id, archive, repairInput });
}

function finalize() {
  const manifest = validateManifest();
  if (manifest.mode === "design-host") {
    if (manifest.status !== "awaiting-user-direction") return output({ ok: false, status: "blocked", workflowStatus: manifest.status, message: "Design-host must finish Host Strategy and Brand Application before direction approval." }, 2);
    const decision = readJsonRequired(path.join(migrationDir, "design-direction-decision.json"));
    const selectedOptionId = decision.selectedOptionId || decision.optionId || decision.selection?.optionId;
    if (!selectedOptionId) fail("FINAL_DIRECTION_SELECTION_REQUIRED: design-direction-decision.json must contain an explicit selected option.");
    const route = readJsonRequired(designHostRouteFile);
    route.finalSelection = { status: "selected", selectionSource: "explicit-user", selectedOptionId, selectedAt: new Date().toISOString() };
    writeJson(designHostRouteFile, route);
    verifyFrozenDesignGate();
    manifest.status = "complete";
    manifest.currentStageId = null;
    manifest.completedAt = new Date().toISOString();
    manifest.finalGates = { protocol: "pass", frozenDirection: "pass", finalizedAt: manifest.completedAt };
    writeJson(manifestFile, manifest);
    return output({ ok: true, status: "complete", finalGates: manifest.finalGates });
  }
  if (manifest.mode === "apply-host") {
    const qaStage = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
    if (manifest.status !== "passed" || qaStage?.verdict !== "pass") {
      return output({ ok: false, status: "blocked", workflowStatus: manifest.status, message: "Apply-host requires a passing independent Visual QA receipt before finalization." }, 2);
    }
    manifest.status = "complete";
    manifest.currentStageId = null;
    manifest.completedAt = new Date().toISOString();
    manifest.elapsedMs = manifest.stages.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
    manifest.finalGates = { protocol: "pass", hostVisualQA: "pass", finalizedAt: manifest.completedAt };
    writeJson(manifestFile, manifest);
    return output({ ok: true, status: "complete", finalGates: manifest.finalGates });
  }
  const fidelityFile = path.join(migrationDir, "fidelity-report.json");
  const fidelity = readJsonRequired(fidelityFile);
  const qaStage = [...manifest.stages].reverse().find((item) => item.role === "visualQA");
  if (readJsonRequired(goalFile).goalType === "brand-learning-capability-test") {
    verifyLearningModOutput([...manifest.stages].reverse().find(item=>item.role==="designTranslator" && item.status==="complete")?.outputHashes);
    verifyLearningFidelityResult(qaStage?.outputHashes);
  }
  const proofStatus = proofStatusFromFidelity(fidelity);
  if (manifest.status !== "passed" || qaStage?.verdict !== "pass" || fidelity.status !== "fidelity-pass" || !allProofsPass(proofStatus)) {
    return output({ ok: false, status: "blocked", workflowStatus: manifest.status, fidelityStatus: fidelity.status, proofStatus, message: "Protocol plus Evidence Fidelity, Structural Fidelity, and Generative Proof must all pass independently." }, 2);
  }
  manifest.status = "complete";
  manifest.finalGates = { protocol: "pass", evidenceFidelity: "pass", structuralFidelity: "pass", generativeProof: "pass", fidelity: "pass", finalizedAt: new Date().toISOString() };
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "complete", finalGates: manifest.finalGates });
}

function advance(manifest, current) {
  if (current.verdict === "needs-evidence") {
    manifest.status = "blocked";
    manifest.currentStageId = null;
    return;
  }
  const order = stageOrderForMode(manifest.mode, manifest.executionProfile);
  if (current.verdict === "pass") {
    if (manifest.mode === "design-host" && current.stage === "designVisualQA") {
      const gapStatus = readJsonRequired(designHostRouteFile).expressiveGapDecision?.status;
      if (gapStatus === "required") {
        const nextStage = uniqueStage(manifest, "expressiveAssetGeneration", "brandApplicationDesigner", 1);
        manifest.stages.push(nextStage);
        manifest.currentStageId = nextStage.id;
        return;
      }
      manifest.status = "awaiting-concept-direction";
      manifest.currentStageId = null;
      return;
    }
    if (manifest.mode === "design-host" && current.stage === "expressiveVisualQA") {
      manifest.status = "awaiting-concept-direction";
      manifest.currentStageId = null;
      return;
    }
    if (manifest.mode === "apply-host" && current.stage === "previewQA") {
      manifest.status = "awaiting-user";
      manifest.currentStageId = null;
      manifest.firstPreviewAt = current.endedAt;
      manifest.timeToFirstPreviewMs = manifest.stages.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
      manifest.previewSla = { targetMs: 300000, status: manifest.timeToFirstPreviewMs <= 300000 ? "pass" : "miss" };
      manifest.previewDecision = { status: "pending" };
      return;
    }
    const index = order.indexOf(current.stage);
    if (index === order.length - 1) {
      manifest.status = "passed";
      manifest.currentStageId = null;
      return;
    }
    const nextStageName = order[index + 1];
    const nextRole = roleForStage(nextStageName);
    // Attempts are local to each role. An upstream retry must not consume the
    // next role's budget, while a return to a previously completed role must
    // advance that role's own attempt number.
    const nextRoleAttempts = manifest.stages.filter((item) => item.role === nextRole && ["complete", "failed"].includes(item.status)).length;
    const nextStage = uniqueStage(manifest, nextStageName, nextRole, nextRoleAttempts + 1);
    manifest.stages.push(nextStage);
    manifest.currentStageId = nextStage.id;
    return;
  }
  if (current.stage === "visualQA") {
    const maxAttempts = Number(readJsonRequired(goalFile)?.thresholds?.maxAttempts || 2);
    const completedQaAttempts = manifest.stages.filter((item) => item.role === "visualQA" && ["complete", "failed"].includes(item.status)).length;
    if (completedQaAttempts >= maxAttempts) {
      manifest.status = "blocked";
      manifest.currentStageId = null;
      return;
    }
    if (["designDirector", "designDirectorOrchestrator"].includes(current.failureOwnerRole)) {
      manifest.status = "blocked";
      manifest.currentStageId = null;
      manifest.orchestratorAction = "Revise and revalidate design-direction.json, then prepare a scoped rerun from Demo.";
      return;
    }
    const routed = failureRouteForMode(manifest.mode, current.failureOwnerRole);
    const routedAttempts = manifest.stages.filter((item) => item.role === routed[1] && ["complete", "failed"].includes(item.status)).length;
    const retry = uniqueStage(manifest, routed[0], routed[1], routedAttempts + 1);
    retry.retryInput = { goalSha256: manifest.goalSha256, blockingFindings: current.blockingFindings, deltaScope: current.deltaScope };
    manifest.stages.push(retry);
    manifest.currentStageId = retry.id;
    return;
  }
  manifest.status = "blocked";
  manifest.currentStageId = null;
}

function dispatchInputs(manifest, current) {
  const goalInput = hashedPath(relative(goalFile));
  if (current.retryInput?.closureRepair) {
    verifyHashedPath(current.retryInput.closureRepair.rejection);
    for (const ref of current.retryInput.closureRepair.sourceInputs) verifyHashedPath(ref);
    return latestInputsByPath([goalInput,...current.retryInput.closureRepair.sourceInputs]);
  }
  if (manifest.mode === "learn-brand" && current.role === "visualQA" && current.qaReview) {
    verifyHashedPath(current.qaReview);
    const review = readJsonRequired(path.resolve(root,current.qaReview.path));
    try { validateQaReview(root,review); } catch(error) { fail(error.message); }
    return latestInputsByPath([goalInput,current.qaReview,...array(review.allowedInputs),...array(review.frozenInputs).filter(ref=>isQaArtifact(ref.path)),...(review.priorReviewReceipt ? [review.priorReviewReceipt] : [])]);
  }
  if (manifest.mode === "apply-host" && current.stage === "previewQA" && current.retryInput?.frozenInputs) {
    for (const ref of current.retryInput.frozenInputs) verifyHashedPath(ref);
    return latestInputsByPath([goalInput, ...current.retryInput.frozenInputs]);
  }
  if (current.stage === "interpreter" && current.retryInput?.qaRepair) {
    const repair = current.retryInput.qaRepair;
    for (const item of [repair.qaReceipt, repair.priorInterpreterReceipt, ...array(repair.frozenInputs)]) verifyHashedPath(item);
    return latestInputsByPath([goalInput, ...array(repair.sourceInputs)]);
  }
  if (current.stage === "interpreter" && current.retryInput?.consumerRejection) {
    verifyHashedPath(current.retryInput.consumerRejection);
    const rejection = readJsonRequired(path.resolve(root, current.retryInput.consumerRejection.path));
    for (const item of array(rejection.inputs)) verifyHashedPath(item);
    return latestInputsByPath([goalInput, current.retryInput.consumerRejection, ...array(rejection.inputs), ...(current.retryInput?.failedAttemptArchive ? [current.retryInput.failedAttemptArchive] : [])]);
  }
  const scopedPaths = array(current.retryInput?.deltaScope?.inputPaths);
  if (current.stage === "demo" && current.retryInput?.producerRepair) {
    const bindings = [...array(current.retryInput.frozenInputs), current.retryInput.failedAttemptArchive, ...(current.retryInput.repairInput ? [current.retryInput.repairInput] : [])];
    for (const binding of bindings) verifyHashedPath(binding);
    return latestInputsByPath([goalInput, ...bindings]);
  }
  if (current.stage === "evidence") return latestInputsByPath([
    goalInput, ...scopedPaths.map(hashedPath),
    ...(readNativeSourceInput({ root, brand, sourceUrl: readJsonRequired(goalFile).sourceUrl })?.bindings || []),
    ...(current.retryInput?.failedAttemptArchive ? [current.retryInput.failedAttemptArchive] : []),
  ]);
  if (scopedPaths.length && !["designVisualQA", "h5DirectionGeneration"].includes(current.stage)) return latestInputsByPath([goalInput, ...scopedPaths.map(hashedPath)]);
  if (current.role === "hostImplementationAgent") {
    return latestInputsByPath([
      goalInput,
      hashedPath(`migrations/${brand}/brand-application-plan.json`),
      hashedPath(`migrations/${brand}/design-direction-decision.json`),
      hashedPath(`migrations/${brand}/design-direction.json`),
      hashedPath(`migrations/${brand}/preedit-baseline-bundle.json`),
      hashedPath(relative(hostProductiveBaselineFile)),
      ...(manifest.selectedH5PosteditBinding ? [manifest.selectedH5PosteditBinding.originalSnapshot] : []),
      ...(current.retryInput?.failedAttemptArchive ? [current.retryInput.failedAttemptArchive] : []),
    ]);
  }
  if (current.stage === "startupPageStrategy") {
    return latestInputsByPath([
      goalInput,
      hashedPath(relative(hostStartupPageFile)),
      hashedPath(`migrations/${brand}/design-host-preflight.json`),
      hashedPath(relative(hostStartupBaselineScaffoldFile)),
      hashedPath(relative(fastHostBriefScaffoldFile)),
    ]);
  }
  if (current.stage === "hostStrategy") {
    return latestInputsByPath([
      goalInput,
      ...(current.retryInput?.failedAttemptArchive ? [current.retryInput.failedAttemptArchive] : []),
      hashedPath(relative(hostPageInventoryFile)),
      hashedPath(`migrations/${brand}/apply-host-preflight.json`),
      hashedPath(`migrations/${brand}/design-direction.json`),
    ]);
  }
  if (current.stage === "conceptBrief") {
    const required = [
      `migrations/${brand}/brand-evidence.json`,
      `migrations/${brand}/brand-intent.json`,
      `migrations/${brand}/brand-mod.json`,
      relative(hostStartupPageFile),
      relative(hostStartupBaselineFile),
      relative(designKnowledgeBundleFile),
      `migrations/${brand}/fast-host-brief.json`,
      `migrations/${brand}/approved-visual-patterns.json`,
      `migrations/${brand}/component-mapping.json`,
      `migrations/${brand}/dangoui-adapter.json`,
    ].map(hashedPath);
    const officialAssets = frozenOfficialIdentityAssets().map((asset) => hashedPath(asset.localPath));
    return latestInputsByPath([goalInput, ...required, ...officialAssets]);
  }
  if (current.stage === "conceptGeneration") {
    const required = [
      `migrations/${brand}/brand-evidence.json`,
      `migrations/${brand}/brand-intent.json`,
      `migrations/${brand}/brand-mod.json`,
      relative(hostStartupPageFile),
      relative(hostStartupBaselineFile),
      relative(designKnowledgeBundleFile),
      `migrations/${brand}/fast-host-brief.json`,
      ...(manifest.executionProfile === "fast" ? [] : [relative(conceptDirectionBriefsFile)]),
    ].map(hashedPath);
    const optional = ["approved-visual-patterns.json", "component-mapping.json", "dangoui-adapter.json"]
      .map((name) => `migrations/${brand}/${name}`)
      .filter((item) => fs.existsSync(path.resolve(root, item)))
      .map(hashedPath);
    const officialAssets = frozenOfficialIdentityAssets().map((asset) => hashedPath(asset.localPath));
    return latestInputsByPath([goalInput, ...required, ...optional, ...officialAssets]);
  }
  if (current.stage === "h5DirectionGeneration") {
    const required = [
      `migrations/${brand}/brand-evidence.json`,
      `migrations/${brand}/brand-intent.json`,
      `migrations/${brand}/brand-mod.json`,
      relative(hostStartupPageFile),
      relative(hostStartupBaselineFile),
      relative(designKnowledgeBundleFile),
      `migrations/${brand}/fast-host-brief.json`,
    ].map(hashedPath);
    const designSystem = ["approved-visual-patterns.json", "component-mapping.json", "dangoui-adapter.json"]
      .map((name) => `migrations/${brand}/${name}`)
      .filter((item) => fs.existsSync(path.resolve(root, item)))
      .map(hashedPath);
    const runtimeAssets = frozenRuntimeAssetInputs(readJsonRequired(path.join(migrationDir, "brand-mod.json")), { workspaceRoot: root, brand });
    return latestInputsByPath([goalInput, ...required, ...designSystem, ...runtimeAssets, ...h5ProducerSourceCaptures().captures.map(({path, sha256}) => ({path, sha256})), ...scopedPaths.map(hashedPath), ...(current.retryInput?.failedAttemptArchive ? [current.retryInput.failedAttemptArchive] : []), ...array(current.retryInput?.sourceTransfer?.inputs)]);
  }
  if (current.stage === "designVisualQA") {
    const required = [relative(designHostRouteFile), relative(h5MechanicalQaFile), `migrations/${brand}/brand-application-plan.json`, `migrations/${brand}/design-direction-options.json`]
      .map(hashedPath);
    const mechanicalCaptures = fs.existsSync(h5MechanicalQaFile)
      ? array(readJsonRequired(h5MechanicalQaFile).directions).map((item) => item?.capture?.path).filter(Boolean).map(hashedPath)
      : [];
    const h5 = array(readJsonRequired(designHostRouteFile).h5Directions?.directions).map((item) => item?.artifact?.path).filter(Boolean).map(hashedPath);
    return latestInputsByPath([goalInput, ...required, ...mechanicalCaptures, ...h5, ...frozenH5QaSourceInputs(manifest)]);
  }
  if (current.stage === "expressiveAssetGeneration") {
    const route = readJsonRequired(designHostRouteFile);
    const affected = new Set(array(route.expressiveGapDecision?.gaps).map((item) => item.directionId));
    const h5 = array(route.h5Directions?.directions).filter((item) => affected.has(item.id)).map((item) => item?.artifact?.path).filter(Boolean).map(hashedPath);
    const required = [relative(designHostRouteFile), relative(expressiveGapFile), relative(brandRenderKitFile), `migrations/${brand}/brand-mod.json`].map(hashedPath);
    const officialAssets = frozenOfficialIdentityAssets().map((asset) => hashedPath(asset.localPath));
    return latestInputsByPath([goalInput, ...required, ...h5, ...officialAssets]);
  }
  if (current.stage === "expressiveVisualQA") {
    const route = readJsonRequired(designHostRouteFile);
    const h5 = array(route.h5Directions?.directions).map((item) => item?.integratedArtifact?.path || item?.artifact?.path).filter(Boolean).map(hashedPath);
    const assets = array(route.localizedExpressiveAssets?.assets).map((item) => item?.artifact?.path).filter(Boolean).map(hashedPath);
    return latestInputsByPath([goalInput, hashedPath(relative(designHostRouteFile)), hashedPath(relative(expressiveGapFile)), ...h5, ...assets]);
  }
  if (current.stage === "demo") {
    // A retry may follow an Orchestrator-owned protocol normalization. Freeze
    // the bytes that actually exist at dispatch time, not stale producer hashes
    // retained only as history in an earlier receipt.
    const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes)).map((item) => hashedPath(item.path));
    const preservation=current.retryInput?.priorQaPreservation?[current.retryInput.priorQaPreservation]:[];
    for (const ref of preservation) verifyHashedPath(ref);
    return latestInputsByPath([goalInput, ...previousOutputs, ...preservation, hashedPath(`migrations/${brand}/design-direction.json`)]);
  }
  if (current.stage === "visualQA") {
    if (manifest.mode === "apply-host") {
      const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
      return latestInputsByPath([goalInput, ...previousOutputs]);
    }
    const goal = readJsonRequired(goalFile);
    const sourceScreenshots = array(goal.referencePages).map((item) => item?.screenshot).filter(Boolean).map(hashedPath);
    const demoScreenshots = array(goal.demoPages).map((item) => item?.screenshot).filter(Boolean).map(hashedPath);
    // The Orchestrator seals the blind-input boundary before dispatch. QA consumes
    // this manifest as a frozen input and must never author or refresh it itself.
    return [goalInput, ...sourceScreenshots, ...demoScreenshots, hashedPath(`migrations/${brand}/visual-pattern-inventory.json`), hashedPath(`migrations/${brand}/generative-proof.json`), hashedPath(`migrations/${brand}/qa-input-manifest.json`)];
  }
  const previousOutputs = manifest.stages.filter((item) => item.status === "complete").flatMap((item) => array(item.outputHashes));
  const designKnowledge = manifest.mode === "design-host" && fs.existsSync(designKnowledgeBundleFile) ? [hashedPath(relative(designKnowledgeBundleFile))] : [];
  return latestInputsByPath([goalInput, ...designKnowledge, ...previousOutputs, ...(current.retryInput?.failedAttemptArchive ? [current.retryInput.failedAttemptArchive] : [])]);
}

function validateDeltaScope(scope) {
  if (!scope || !array(scope.affectedSections).length || !array(scope.inputPaths).length || !array(scope.regressionSections).length) {
    fail("Failed Visual QA receipts require deltaScope with affectedSections, inputPaths and regressionSections.");
  }
  for (const item of scope.inputPaths) hashedPath(item);
}

function addTelemetry(manifest, kind, files, additionalReads = [], receipt = null, stage = null) {
  manifest.telemetry ||= {};
  const telemetry = manifest.telemetry;
  telemetry.dispatchCount ||= 0;
  telemetry.inputFiles ||= 0;
  telemetry.inputBytes ||= 0;
  telemetry.uniqueInputFiles ||= 0;
  telemetry.uniqueInputBytes ||= 0;
  telemetry.duplicateInputFiles ||= 0;
  telemetry.duplicateInputBytes ||= 0;
  telemetry.outputFiles ||= 0;
  telemetry.outputBytes ||= 0;
  telemetry.additionalReadBytes ||= 0;
  telemetry.imageGenerationCalls ||= 0;
  telemetry.promptCharacters ||= 0;
  telemetry.modelUsage ||= { reportedReceipts: 0, inputTokens: 0, outputTokens: 0 };
  telemetry.stageDurationsMs ||= {};
  telemetry.seenInputSha256 ||= [];
  const bytes = (items) => array(items).reduce((sum, item) => {
    const file = path.resolve(root, typeof item === "string" ? item : item.path || "");
    return sum + (fs.existsSync(file) && fs.statSync(file).isFile() ? fs.statSync(file).size : Number(item?.bytes || 0));
  }, 0);
  if (kind === "dispatch") {
    telemetry.dispatchCount += 1;
    telemetry.inputFiles += array(files).length;
    telemetry.inputBytes += bytes(files);
    const seen = new Set(telemetry.seenInputSha256);
    for (const item of array(files)) {
      const itemBytes = bytes([item]);
      const identity = item?.sha256 || `${item?.path || String(item)}:${itemBytes}`;
      if (seen.has(identity)) {
        telemetry.duplicateInputFiles += 1;
        telemetry.duplicateInputBytes += itemBytes;
      } else {
        seen.add(identity);
        telemetry.uniqueInputFiles += 1;
        telemetry.uniqueInputBytes += itemBytes;
      }
    }
    telemetry.seenInputSha256 = [...seen];
  } else {
    telemetry.outputFiles += array(files).length;
    telemetry.outputBytes += bytes(files);
    telemetry.additionalReadBytes += bytes(additionalReads);
    const toolCalls = array(receipt?.toolCalls);
    telemetry.imageGenerationCalls += toolCalls.filter((call) => /imagegen|image-generation|image_gen/i.test(call?.tool || call?.name || "")).length;
    telemetry.promptCharacters += toolCalls.reduce((sum, call) => sum + promptCharacterCount(call), 0);
    const usage = receipt?.usage || receipt?.modelUsage || null;
    const inputTokens = usage?.inputTokens ?? usage?.actualInputTokens;
    const outputTokens = usage?.outputTokens ?? usage?.actualOutputTokens;
    if (usage && (Number.isFinite(Number(inputTokens)) || Number.isFinite(Number(outputTokens)))) {
      telemetry.modelUsage.reportedReceipts += 1;
      telemetry.modelUsage.inputTokens += Number(inputTokens || 0);
      telemetry.modelUsage.outputTokens += Number(outputTokens || 0);
    }
    if (stage?.stage) telemetry.stageDurationsMs[stage.stage] = Number(telemetry.stageDurationsMs[stage.stage] || 0) + Number(stage.durationMs || 0);
  }
}

function writeTelemetry(manifest) {
  const telemetry = { ...manifest.telemetry };
  delete telemetry.seenInputSha256;
  telemetry.tokenAccounting = telemetry.modelUsage?.reportedReceipts > 0 ? "reported" : "unavailable-use-unique-input-bytes-as-context-proxy";
  writeJson(path.join(migrationDir, "workflow-telemetry.json"), { schema: "brand-workflow-telemetry/v2", runId: manifest.runId, updatedAt: new Date().toISOString(), ...telemetry });
}

function promptCharacterCount(value, seen = new Set()) {
  if (value == null || typeof value === "number" || typeof value === "boolean") return 0;
  if (typeof value === "string") return 0;
  if (seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + promptCharacterCount(item, seen), 0);
  return Object.entries(value).reduce((sum, [key, item]) => {
    if (typeof item === "string" && /prompt|instruction|input/i.test(key)) return sum + item.length;
    return sum + promptCharacterCount(item, seen);
  }, 0);
}

function markDesignHostFirstPreview(manifest, current) {
  if (manifest.mode !== "design-host" || current.stage !== "designVisualQA" || manifest.firstPreviewAt) return;
  manifest.firstPreviewAt = current.endedAt;
  manifest.timeToFirstPreviewMs = Math.max(0, Date.parse(current.endedAt) - Date.parse(manifest.createdAt));
  manifest.previewSla = {
    targetMs: 300000,
    status: manifest.timeToFirstPreviewMs <= 300000 ? "pass" : "miss",
    policy: "progress-target-not-a-quality-skip",
    slowestStage: [...manifest.stages]
      .filter((item) => Number.isFinite(Number(item.durationMs)))
      .sort((a, b) => Number(b.durationMs) - Number(a.durationMs))[0]?.stage || null,
  };
}

function verifyHostPreeditGate(phase,receipt,priorStageId,completedStageId) {
  verifyFrozenDesignGate(phase,priorStageId,completedStageId);
  const validator = path.join(skillRoot, "scripts", "validate-host-structural-diff.mjs");
  const bundle = path.join(migrationDir, "preedit-baseline-bundle.json");
  const targets = path.join(migrationDir, "structural-targets.json");
  if (!fs.existsSync(bundle)) fail(`Host Implementation ${phase} is blocked: missing orchestrator-authored ${relative(bundle)}.`);
  if (!fs.existsSync(targets)) fail(`Host Implementation ${phase} is blocked: missing approved ${relative(targets)}.`);
  try {
    execFileSync(process.execPath, [validator, "verify-preedit", "--bundle", bundle, "--targets", targets, "--phase", phase==="retry" ? "receipt" : phase], { cwd: root, stdio: "pipe" });
    if (["receipt","retry"].includes(phase) && readJsonRequired(manifestFile).selectedH5PosteditBinding) {
      const structuralManifest=path.join(migrationDir,"host-structural-manifest.json");
      const output=array(receipt?.outputs).find(item=>path.resolve(root,item.path)===structuralManifest);
      if (!output) throw new Error("SELECTED_H5_STRUCTURAL_MANIFEST_RECEIPT_REQUIRED");
      verifyHashedPath(output);
      for (const entry of array(readJsonRequired(bundle).entries)) execFileSync(process.execPath,[validator,"validate","--baseline",entry.baselineFile,"--current",entry.sourceFile,"--manifest",structuralManifest,"--bundle",bundle],{cwd:root,stdio:"pipe"});
    }
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`Host Implementation ${phase} pre-edit baseline gate failed.${details ? `\n${details}` : ""}`);
  }
}

function prepareHostPreeditBundle() {
  const validator = path.join(skillRoot, "scripts", "validate-host-structural-diff.mjs");
  if (!fs.existsSync(hostStructuralTargetsFile)) fail(`HOST_STRUCTURAL_TARGETS_REQUIRED: missing ${relative(hostStructuralTargetsFile)}.`);
  try {
    execFileSync(process.execPath, [validator, "prepare-bundle", "--targets", hostStructuralTargetsFile, "--out", hostPreeditBaselineBundleFile], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [validator, "verify-preedit", "--bundle", hostPreeditBaselineBundleFile, "--targets", hostStructuralTargetsFile, "--phase", "dispatch"], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`HOST_PREEDIT_BASELINE_FREEZE_FAILED: Host Strategy passed, but the orchestrator could not freeze an immutable pre-edit bundle.${details ? `\n${details}` : ""}`);
  }
}

function ensureSelectedOriginalBinding(manifest) {
  const file=path.join(migrationDir,"approved-master.json");
  if (!fs.existsSync(file) || readJsonRequired(file).permissionScope!=="local-host-implementation-only") return;
  const bundle=hashedPath(relative(hostPreeditBaselineBundleFile));
  if (manifest.selectedH5PosteditBinding) {verifyHashedPath(manifest.selectedH5PosteditBinding.originalSnapshot);verifyHashedPath(manifest.selectedH5PosteditBinding.preeditBundle);return;}
  manifest.selectedH5PosteditBinding={originalSnapshot:captureSelectedH5OriginalSnapshot({root,brand,preeditBundle:bundle}),preeditBundle:bundle};
}
function selectedReceiptFlags(phase,priorStageId,completedStageId) {
  const manifest=readJsonRequired(manifestFile);
  if (!["receipt","retry"].includes(phase) || !manifest.selectedH5PosteditBinding) return [];
  const binding=manifest.selectedH5PosteditBinding;
  selectedPosteditContext(root,brand,{phase:"postedit",...binding,...(priorStageId?{priorStageId}:{}),...(completedStageId?{completedStageId}:{})});
  return ["--validation-phase","postedit","--original-snapshot",binding.originalSnapshot.path,"--original-snapshot-sha256",binding.originalSnapshot.sha256,"--preedit-bundle",binding.preeditBundle.path,"--preedit-bundle-sha256",binding.preeditBundle.sha256,...(priorStageId?["--prior-stage-id",priorStageId]:[]),...(completedStageId?["--completed-stage-id",completedStageId]:[])];
}
function verifyFrozenDesignGate(phase,priorStageId,completedStageId) {
  const phaseFlags=selectedReceiptFlags(phase,priorStageId,completedStageId);
  verifyDesignHostRoute("before-apply-host",phaseFlags);
  const required = ["brand-application-plan.json", "design-direction-options.json", "design-direction-decision.json", "business-scope.json", "design-direction.json"];
  for (const name of required) {
    const file = path.join(migrationDir, name);
    if (!fs.existsSync(file)) fail(`FROZEN_DESIGN_REQUIRED: missing ${relative(file)}; return to design-host instead of designing inside apply-host.`);
  }
  try {
    const masterFile = path.join(migrationDir, "approved-master.json");
    const selectedLocal = fs.existsSync(masterFile) && readJsonRequired(masterFile).permissionScope === "local-host-implementation-only";
    if (selectedLocal) {
      const valid = validateLocalSelectedMaster(root, brand,phaseFlags.length ? {phase:"postedit",...readJsonRequired(manifestFile).selectedH5PosteditBinding,...(priorStageId?{priorStageId}:{}),...(completedStageId?{completedStageId}:{})} : {});
      if (!valid.ok) throw new Error(valid.errors.join(";"));
      execFileSync(process.execPath, [path.join(skillRoot, "scripts", "apply-host-preflight.mjs"), "--frozen-master-only", "--root", root, "--brand", brand, "--host-target", valid.master.navigationShellContract.currentSourceBaseline.hostRoot,...phaseFlags], { cwd: root, stdio: "pipe" });
    } else execFileSync(process.execPath, [path.join(skillRoot, "scripts", "validate-brand-application-plan.mjs"), "--plan", path.join(migrationDir, "brand-application-plan.json")], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [path.join(skillRoot, "scripts", "validate-wild-design-decision.mjs"), "--options", path.join(migrationDir, "design-direction-options.json"), "--decision", path.join(migrationDir, "design-direction-decision.json"), "--business-scope", path.join(migrationDir, "business-scope.json"), "--brand-evidence", path.join(migrationDir, "brand-evidence.json"), "--brand-mod", path.join(migrationDir, "brand-mod.json"), "--design-direction", path.join(migrationDir, "design-direction.json"),...phaseFlags], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`FROZEN_DESIGN_INVALID: apply-host cannot redesign or repair direction artifacts.${details ? `\n${details}` : ""}`);
  }
}

function initializeDesignHostRoute() {
  const route = {
    schema: "design-host-route/v3",
    sequence: "h5-design-system-first",
    imageCapability: { status: "deferred-until-verified-gap" },
    brandIdentityAssets: { status: "optional-pending", assets: [] },
    knowledgeDecision: { status: "pending" },
    h5Directions: { status: "pending", directions: [] },
    h5QA: { status: "pending" },
    expressiveGapDecision: { status: "pending", gaps: [] },
    localizedExpressiveAssets: { status: "not-assessed", automaticRetryCount: 0, assets: [] },
    expressiveIntegrationQA: { status: "not-assessed" },
    userDirectionReview: { status: "pending" },
    finalSelection: { status: "pending" },
  };
  writeJson(designHostRouteFile, route);
  verifyDesignHostRoute("initialization");
}

function initializeFastDesignHostScaffolds() {
  const startupSha256 = fs.existsSync(hostStartupPageFile) ? sha256File(hostStartupPageFile) : "__COPY_HOST_STARTUP_PAGE_SHA256__";
  writeJson(hostStartupBaselineScaffoldFile, {
    schema: "host-startup-baseline/v1",
    derivationSource: "startup-page-scan",
    hostStartupPageSha256: startupSha256,
    primaryTask: "__FILL_FROM_STARTUP_SOURCE__",
    primaryAction: "__FILL_FROM_STARTUP_SOURCE__",
    pageType: "__FILL_FROM_STARTUP_SOURCE__",
    productiveFloor: { coreEntry: "__FILL_FROM_STARTUP_SOURCE__", businessObjectsVisible: ["__FILL_REAL_OBJECT_TYPE__"], warmReturnState: "settled" },
    resultContentContract: { mode: "host-schema", fields: ["__FIELD_1__", "__FIELD_2__", "__FIELD_3__"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
    hostContentContract: { derivationSource: "startup-page-source-and-render", userInputRequired: false, noCandidateFallback: "productive-ui", visualCandidates: [] },
    informationDistributionContract: { model: "__OBSERVED_LIST_GRID_FEED_SEARCH_OR_OTHER__", previewUnit: { requiredDecisionFields: ["__VISIBLE_DECISION_FIELD__"], openRequiredForBasicJudgment: false }, scanOrder: ["__FIRST__", "__SECOND__"], comparisonBehavior: "__HOW_USERS_COMPARE_VISIBLE_ITEMS__", forbiddenMetaphorSubstitutions: ["__SOURCE_PRODUCT_MECHANIC_NOT_SUPPORTED_BY_HOST__"] },
    expressiveOpportunity: { heroEligible: false, reason: "__HOST_SPECIFIC_REASON__", maxFirstViewportRatio: 0.3 },
    communicationIntent: { framework: "hierarchy-utility-style/v1", hierarchy: { primaryAttention: "__HOST_PRIMARY_ATTENTION__", informativeContent: ["__VISIBLE_INFORMATION__"], efficiencyConstraint: "__NO_REGRESSION_CONSTRAINT__" }, utility: { mainFunction: "__HOST_MAIN_FUNCTION__", obviousAction: "__HOST_OBVIOUS_ACTION__", conventionConstraint: "__PRESERVED_INTERACTION_CONVENTION__" }, style: { sourceConstraint: "derive desired emotional and brand attributes from frozen brand evidence", evaluationMode: "first-impression-comparison-after-product-safety-pass" } },
  });
  writeJson(fastHostBriefScaffoldFile, {
    schema: "fast-host-brief/v1",
    hostOpportunity: { primaryTask: "__COPY_BASELINE_PRIMARY_TASK__", pageType: "__COPY_BASELINE_PAGE_TYPE__" },
    productiveFloor: "__COPY_BASELINE_PRODUCTIVE_FLOOR_OBJECT__",
    resultContentContract: "__COPY_BASELINE_RESULT_CONTENT_CONTRACT_OBJECT__",
    expressiveOpportunity: "__COPY_BASELINE_EXPRESSIVE_OPPORTUNITY_OBJECT__",
    informationDistributionContract: "__COPY_BASELINE_INFORMATION_DISTRIBUTION_CONTRACT_OBJECT__",
    hostContentContract: "__COPY_BASELINE_HOST_CONTENT_CONTRACT_OBJECT__",
    communicationIntent: "__COPY_BASELINE_COMMUNICATION_INTENT_OBJECT__",
  });
  fs.mkdirSync(h5DirectionDirectory, { recursive: true });
  for (const [index, file] of h5DirectionScaffoldFiles.entries()) {
    const id = ["a", "b", "c"][index];
    fs.writeFileSync(file, `<!doctype html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direction ${id.toUpperCase()}</title></head>\n<body>\n<!-- Replace this deterministic scaffold in place. Do not move it. -->\n<main data-result-hierarchy="__FILL_FROM_BASELINE__">__FILL_INTERACTIVE_H5__</main>\n<script type="application/json" data-brand-direction>{"id":"${id}","title":"__FILL__","brandMechanisms":[],"structuralSignature":"__FILL__","interactionRhythm":"__FILL__","communicationHypothesis":{"hierarchy":{"attentionTarget":"__FILL__","informationGain":"__FILL__"},"utility":{"mainFunction":"__FILL__","obviousAction":"__FILL__","preservedConvention":"__FILL__"},"style":{"targetAttributes":["__FILL__","__FILL__"],"sourceBasis":"__FILL__","mechanismThesis":"__FILL_DISTINCT_HYPOTHESIS__"}},"knowledgeRefs":[],"resultHierarchyFit":{}}</script>\n</body>\n</html>\n`);
  }
}

function verifyDesignHostRoute(stageName,phaseFlags=[]) {
  if (!fs.existsSync(designHostRouteFile)) fail("DESIGN_HOST_ROUTE_REQUIRED");
  try {
    const validatorArgs = [path.join(skillRoot, "scripts", "validate-design-host-route.mjs"), "--file", designHostRouteFile, "--stage", stageName, "--workspace-root", root,...phaseFlags];
    if (fs.existsSync(designKnowledgeBundleFile)) validatorArgs.push("--knowledge-bundle", designKnowledgeBundleFile, "--knowledge-root", resolveKnowledgeRoot());
    execFileSync(process.execPath, validatorArgs, { cwd: root, stdio: "pipe" });
  } catch (error) {
    fail(`DESIGN_HOST_ROUTE_ORDER_FAILED: ${String(error.stdout || "").trim()} ${String(error.stderr || "").trim()} ${error.message}`.trim());
  }
}

function validateH5FirstRoute(route, stageName) {
  const errors = [];
  const failRoute = (code) => errors.push(code);
  const artifact = (value) => Boolean(value?.path && /^[a-f0-9]{64}$/i.test(value?.sha256 || ""));
  if (route.schema !== "design-host-route/v3" || route.sequence !== "h5-design-system-first") failRoute("DESIGN_HOST_H5_FIRST_ROUTE_INVALID");
  if (stageName === "initialization") return errors;
  if (route.knowledgeDecision?.status !== "ready" || !route.knowledgeDecision?.sha256 || !route.knowledgeDecision?.hostStartupBaselineSha256) failRoute("DESIGN_KNOWLEDGE_BINDING_REQUIRED");
  if (["before-h5-qa", "after-h5-qa", "before-expressive-dispatch", "after-expressive-generation", "before-expressive-qa", "before-final-selection", "before-apply-host"].includes(stageName)) {
    const h5 = route.h5Directions || {};
    if (h5.status !== "ready" || !h5.producerExecutionId || array(h5.directions).length !== 3) failRoute("THREE_H5_DIRECTIONS_REQUIRED");
    for (const direction of array(h5.directions)) {
      if (!direction?.id || !artifact(direction.artifact) || direction.realDataBinding?.inventedDataForbidden !== true || !direction.brandDesignSystemSha256 || !direction.knowledgeBundleSha256) failRoute("H5_DIRECTION_BINDING_INVALID");
    }
  }
  if (["after-h5-qa", "before-expressive-dispatch", "after-expressive-generation", "before-expressive-qa", "before-final-selection", "before-apply-host"].includes(stageName)) {
    if (route.h5QA?.status !== "pass" || !route.h5QA?.reviewerExecutionId || route.h5QA.reviewerExecutionId === route.h5Directions?.producerExecutionId) failRoute("INDEPENDENT_H5_QA_REQUIRED");
    const gap = route.expressiveGapDecision || {};
    if (!['required', 'not-required'].includes(gap.status)) failRoute("EXPRESSIVE_GAP_DECISION_REQUIRED");
    if (gap.status === 'required') for (const item of array(gap.gaps)) {
      if (!item?.id || !item?.directionId || !item?.regionId || !item?.businessPurpose || !item?.targetSize || !item?.currentShortfall || !item?.expectedImprovement || !item?.noImageFallback) failRoute("EXPRESSIVE_GAP_CONTRACT_INCOMPLETE");
    }
    if (gap.status === 'required' && !array(gap.gaps).length) failRoute("EXPRESSIVE_GAP_LIST_REQUIRED");
  }
  if (["before-expressive-dispatch", "after-expressive-generation", "before-expressive-qa"].includes(stageName) && route.imageCapability?.status !== "available") failRoute("IMAGE_GENERATION_CAPABILITY_REQUIRED");
  if (["after-expressive-generation", "before-expressive-qa", "before-final-selection", "before-apply-host"].includes(stageName) && route.expressiveGapDecision?.status === "required") {
    const generated = route.localizedExpressiveAssets || {};
    if (generated.status !== "ready" || generated.automaticRetryCount !== 0 || !generated.producerExecutionId || !array(generated.assets).length) failRoute("LOCAL_EXPRESSIVE_ASSETS_REQUIRED");
    if (array(generated.assets).some((item) => !item?.gapId || !item?.toolCallId || !artifact(item.artifact))) failRoute("LOCAL_EXPRESSIVE_ASSET_BINDING_INVALID");
  }
  if (["before-final-selection", "before-apply-host"].includes(stageName) && route.expressiveGapDecision?.status === "required") {
    if (route.expressiveIntegrationQA?.status !== "pass" || !route.expressiveIntegrationQA?.reviewerExecutionId || route.expressiveIntegrationQA.reviewerExecutionId === route.localizedExpressiveAssets?.producerExecutionId) failRoute("INDEPENDENT_EXPRESSIVE_INTEGRATION_QA_REQUIRED");
  }
  if (stageName === "before-apply-host" && (route.finalSelection?.status !== "selected" || route.finalSelection?.selectionSource !== "explicit-user" || !route.finalSelection?.selectedOptionId)) failRoute("FINAL_DIRECTION_SELECTION_REQUIRED");
  return [...new Set(errors)];
}

function frozenOfficialIdentityAssets() {
  const modFile = path.join(migrationDir, "brand-mod.json");
  if (!fs.existsSync(modFile)) return [];
  const mod = readJsonRequired(modFile);
  return array(mod.assets).flatMap((asset) => {
    if (!asset?.id || !asset?.localPath || !asset?.sourceSha256 || asset.status === "rejected") return [];
    const file = path.resolve(root, asset.localPath);
    const insideRoot = file.startsWith(`${path.resolve(root)}${path.sep}`);
    if (!insideRoot || !fs.existsSync(file) || !fs.statSync(file).isFile()) return [];
    if (sha256File(file) !== asset.sourceSha256) return [];
    return [{
      id: asset.id,
      role: asset.role || null,
      sourceKind: asset.sourceKind || null,
      localPath: asset.localPath,
      sha256: asset.sourceSha256,
      targetScope: asset.targetScope || null,
      antiScopes: array(asset.antiScopes),
      usage: "unmodified-reference-and-visible-identity-only",
    }];
  });
}

function verifyBrandIdentityAssets() {
  const modFile = path.join(migrationDir, "brand-mod.json");
  const mod = readJsonRequired(modFile);
  const declared = array(mod.assets).filter((asset) => asset?.localPath && asset?.sourceSha256 && asset.status !== "rejected");
  const available = frozenOfficialIdentityAssets();
  const route = readJsonRequired(designHostRouteFile);
  route.brandIdentityAssets = available.length
    ? { status: "ready", assets: available, brandModSha256: sha256File(modFile) }
    : { status: "missing", assets: [], brandModSha256: sha256File(modFile), declaredAssetIds: declared.map((asset) => asset.id) };
  writeJson(designHostRouteFile, route);
  if (!available.length) {
    fail(`BRAND_IDENTITY_ASSET_REQUIRED: ${declared.length ? "Brand MOD declares official local assets, but none are present with matching hashes in the isolated run." : "Brand MOD has no hash-bound official local asset for concept generation."} Stop before ImageGen and repair brand learning/packaging.`);
  }
}

function freezeDesignHostKnowledge() {
  let result;
  try {
    result = freezeDesignKnowledge({ skillRoot, root, brand });
  } catch (error) {
    fail(`DESIGN_KNOWLEDGE_QUERY_FAILED: ${error.message}`);
  }
  const route = readJsonRequired(designHostRouteFile);
  route.knowledgeDecision = {
    status: "ready",
    path: relative(result.file),
    sha256: result.sha256,
    hostStartupBaselineSha256: result.bundle.hostContext.baselineSha256,
    questionRefs: result.bundle.questions.map((item) => item.id),
  };
  writeJson(designHostRouteFile, route);
}

function resolveKnowledgeRoot() {
  const bundled = path.join(skillRoot, "knowledge-runtime");
  if (fs.existsSync(path.join(bundled, "knowledge", "v0.1", "index.json"))) return bundled;
  const repositoryRoot = path.resolve(skillRoot, "../..");
  return fs.existsSync(path.join(repositoryRoot, "knowledge", "v0.1", "index.json")) ? repositoryRoot : root;
}

function verifyConceptCapability(manifest, current) {
  if (!fs.existsSync(executionCapabilitiesFile)) {
    fail("IMAGE_GENERATION_CAPABILITY_UNDECLARED: inspect the current task tools, then declare available when built-in image_gen is exposed, otherwise declare unavailable. The workflow remains retryable.");
  }
  const capability = readJsonRequired(executionCapabilitiesFile);
  const image = capability?.imageGeneration || {};
  if (capability?.schema === "brand-execution-capabilities/v1" && image.status === "available" && image.tool === "image_gen" && image.mode === "built-in-default") {
    const route = readJsonRequired(designHostRouteFile);
    route.imageCapability = { ...image, capabilitySha256: sha256File(executionCapabilitiesFile) };
    writeJson(designHostRouteFile, route);
    return;
  }
  const route = readJsonRequired(designHostRouteFile);
  route.imageCapability = { status: "unavailable", requiredTool: "image_gen", fallbackRequiresExplicitUserApproval: true };
  writeJson(designHostRouteFile, route);
  current.status = "failed";
  current.verdict = "needs-evidence";
  current.blockingFindings = [{ code: "IMAGE_GENERATION_CAPABILITY_REQUIRED", message: "The current task does not expose built-in image_gen; concept generation was not dispatched." }];
  current.endedAt = new Date().toISOString();
  manifest.status = "blocked";
  manifest.currentStageId = null;
  manifest.capabilityPreflight = { status: "blocked", checkedAt: current.endedAt, file: relative(executionCapabilitiesFile) };
  writeJson(manifestFile, manifest);
  fail("IMAGE_GENERATION_CAPABILITY_REQUIRED: built-in image_gen is not available; concept agent was not dispatched and external fallback requires explicit user approval.");
}

function approveConcepts() {
  const manifest = validateManifest();
  if (manifest.mode !== "design-host" || manifest.status !== "awaiting-concept-direction") fail("CONCEPTS_NOT_AWAITING_USER");
  const selected = opt("--selection", "");
  if (!selected) fail("approve-concepts requires --selection <option-id>.");
  const route = readJsonRequired(designHostRouteFile);
  const directionIds = array(route.h5Directions?.directions).map((item) => item.id).filter(Boolean);
  if (!directionIds.includes(selected)) fail("H5_DIRECTION_SELECTION_UNKNOWN");
  route.userDirectionReview = { status: "approved", selectionSource: "explicit-user", selectedOptionIds: [selected], approvedAt: new Date().toISOString() };
  writeJson(designHostRouteFile, route);
  verifyDesignHostRoute("before-final-selection");
  manifest.currentStageId = null;
  manifest.status = "awaiting-user-direction";
  manifest.directionDecision = { status: "pending", selectedOptionId: selected, humanExpressiveApproval: "pending", requiredOutputs: ["design-direction-decision.json", "design-direction.json"] };
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "awaiting-user-direction", selectedOptionId: selected, nextStage: null });
}

function rejectConcepts() {
  const manifest = validateManifest();
  if (manifest.mode !== "design-host" || manifest.status !== "awaiting-concept-direction") fail("CONCEPTS_NOT_AWAITING_USER");
  const reason = opt("--reason", "").trim();
  if (!reason) fail("reject-concepts requires --reason <text>.");
  const route = readJsonRequired(designHostRouteFile);
  const directionIds = array(route.h5Directions?.directions).map((item) => item.id).filter(Boolean);
  const rejection = {
    schema: "concept-rejection/v1",
    runId: manifest.runId,
    status: "rejected-all",
    source: "explicit-user",
    reason,
    directionIds,
    priorVisualReview: route.h5QA || { status: "missing" },
    rejectedAt: new Date().toISOString(),
  };
  const rejectionFile = path.join(migrationDir, "concept-rejection.json");
  writeJson(rejectionFile, rejection);
  route.userDirectionReview = { status: "rejected-all", selectionSource: "explicit-user", reason, directionIds, rejectedAt: rejection.rejectedAt };
  route.h5QA = { ...(route.h5QA || {}), humanOverride: "rejected-all", humanOverrideReason: reason };
  writeJson(designHostRouteFile, route);
  manifest.status = "blocked";
  manifest.currentStageId = null;
  manifest.conceptDecision = { status: "rejected-all", source: "explicit-user", reason, rejectionPath: relative(rejectionFile), rejectionSha256: sha256File(rejectionFile) };
  writeJson(manifestFile, manifest);
  output({ ok: true, status: "blocked", decision: "rejected-all", directionIds, rejection: relative(rejectionFile), h5Authorized: false });
}

function latestInputsByPath(items) {
  const latest = new Map();
  for (const item of items) latest.set(item.path, item);
  return [...latest.values()];
}

function validateManifest() {
  const manifest = readJsonRequired(manifestFile);
  if (manifest.goalSha256 !== sha256File(goalFile)) fail("Frozen goal changed after prepare.");
  for (const repair of array(manifest.learningClosureRepairs)) {
    verifyHashedPath(repair.rejection);
    const rejection=readJsonRequired(path.resolve(root,repair.rejection.path));
    const replacement=manifest.stages.find(item=>item.id===repair.replacementStageId);
    if (rejection.goalSha256!==manifest.goalSha256 || rejection.authorization?.additionalAttempts!==1 || repair.additionalAttempts!==1 || repair.authorization!==rejection.authorization?.kind || replacement?.retryInput?.continuationAuthorization!==repair.authorization || JSON.stringify(replacement?.retryInput?.closureRepair?.rejection)!==JSON.stringify(repair.rejection)) fail("LEARNING_CLOSURE_BINDING_CHANGED");
    for (const ref of array(rejection.archivedOutputs)) verifyHashedPath(ref);
    for (const stage of array(rejection.stages)) if (JSON.stringify(manifest.stages.find(item=>item.id===stage.id))!==JSON.stringify(stage)) fail("LEARNING_CLOSURE_HISTORY_CHANGED");
  }
  try { validateQaDispatchRevocations(root,manifest); } catch(error) { fail(error.message); }
  for (const item of manifest.stages.filter(stage => stage.qaReview)) {
    verifyHashedPath(item.qaReview);
    const review = readJsonRequired(path.resolve(root,item.qaReview.path));
    if (review.reviewId !== item.reviewId || review.reviewMode !== item.reviewMode || review.qaExecutionId !== item.qaExecutionId || review.stageId !== item.id) fail("QA_REVIEW_STAGE_BINDING_CHANGED");
    verifyHashedPath(review.priorArchive);
    for (const ref of array(readJsonRequired(path.resolve(root,review.priorArchive.path)).archivedOutputs)) verifyHashedPath(ref);
  }
  for (const retry of array(manifest.demoQaRetries)) {
    verifyHashedPath(retry.archive);
    const priorQa=manifest.stages.find(item=>item.id===retry.priorQaStageId),priorDemo=manifest.stages.find(item=>item.id===retry.priorDemoStageId),replacement=manifest.stages.find(item=>item.id===retry.replacementStageId);
    if (!priorQa || !priorDemo || !replacement || replacement.retryInput?.priorQaPreservation?.path!==retry.archive.path || replacement.retryInput?.priorQaPreservation?.sha256!==retry.archive.sha256 || replacement.retryInput?.continuationAuthorization!==retry.authorization || retry.additionalAttempts!==1) fail("DEMO_QA_RETRY_BINDING_CHANGED");
    const archive=readJsonRequired(path.resolve(root,retry.archive.path));
    if (archive.schema!=="brand-qa-triggered-demo-preservation/v1" || JSON.stringify(archive.stage)!==JSON.stringify(priorDemo) || JSON.stringify(archive.qaStage)!==JSON.stringify(priorQa)) fail("DEMO_QA_PRESERVATION_HISTORY_CHANGED");
    for (const copy of array(archive.archivedOutputs)) verifyHashedPath(copy);
    verifyHashedPath({path:priorDemo.receiptPath,sha256:priorDemo.receiptSha256});verifyHashedPath({path:priorQa.receiptPath,sha256:priorQa.receiptSha256});
    const demoReceipt=readJsonRequired(path.resolve(root,priorDemo.receiptPath)),qaReceipt=readJsonRequired(path.resolve(root,priorQa.receiptPath));
    const refs=[...new Map([...array(demoReceipt.inputs),...array(demoReceipt.outputs),...array(qaReceipt.inputs)].map(ref=>[`${ref.path}@${ref.sha256}`,ref])).values()];
    for (const ref of refs) if (!array(archive.archivedOutputs).some(copy=>copy.originalPath===ref.path&&copy.sha256===ref.sha256)) fail("DEMO_QA_PRESERVATION_ARCHIVE_INCOMPLETE");
  }
  try { validateHostPreviewQaRetries(root, manifest); } catch (error) { fail(error.message); }
  for (const retry of [...array(manifest.h5Retries), ...array(manifest.hostStrategyRetries),...array(manifest.hostImplementationRetries), ...array(manifest.evidenceRetries), ...array(manifest.demoProducerRetries), ...array(manifest.consumerRejections).filter(item => item.archive)]) {
    verifyHashedPath(retry.archive);
    if (array(manifest.demoProducerRetries).includes(retry)) {
      const replacement = manifest.stages.find(item => item.id === retry.replacementStageId);
      if (replacement?.retryInput?.priorStageId !== retry.priorStageId || JSON.stringify(replacement?.retryInput?.failedAttemptArchive) !== JSON.stringify(retry.archive) || JSON.stringify(replacement?.retryInput?.repairInput) !== JSON.stringify(retry.repairInput)) fail("DEMO_PRODUCER_RETRY_BINDING_CHANGED");
      if (retry.repairInput) verifyHashedPath(retry.repairInput);
    }
    if (array(manifest.evidenceRetries).includes(retry)) {
      const replacement = manifest.stages.find((item) => item.id === retry.replacementStageId);
      if (replacement?.retryInput?.priorStageId !== retry.priorStageId
        || JSON.stringify(replacement?.retryInput?.failedAttemptArchive) !== JSON.stringify(retry.archive)) fail("EVIDENCE_RETRY_ARCHIVE_BINDING_CHANGED");
    }
    const archive = readJsonRequired(path.resolve(root, retry.archive.path));
    if (retry.consumerRejection) {
      if (JSON.stringify(archive.consumerRejection) !== JSON.stringify(retry.consumerRejection)) fail("DEMO_CONSUMER_REJECTION_BINDING_CHANGED");
      const pending = manifest.stages.find(item => item.id === retry.consumerRejection.pendingQa.id);
      const expected = {...retry.consumerRejection.pendingQa,status:"cancelled",cancelledReason:"producer output rejected before QA preparation",replacementProducerStageId:retry.replacementStageId};
      if (JSON.stringify(pending) !== JSON.stringify(expected)) fail("DEMO_CONSUMER_REJECTION_QA_CHANGED");
    }
    const prior = manifest.stages.find((item) => item.id === retry.priorStageId);
    if (JSON.stringify(archive.stage) !== JSON.stringify(prior)) fail("H5_RETRY_FAILED_HISTORY_CHANGED");
    for (const binding of array(archive.archivedOutputs)) verifyHashedPath(binding);
    for (const binding of [...array(prior.outputHashes), { path: prior.receiptPath, sha256: prior.receiptSha256 }]) {
      if (!archive.archivedOutputs.some((item) => item.originalPath === binding.path && item.sha256 === binding.sha256)) fail("H5_RETRY_ARCHIVE_BINDING_MISSING");
      if (path.resolve(root, binding.path).startsWith(`${path.join(root, "host-input")}${path.sep}`)) verifyHashedPath(binding);
    }
  }
  for (const recovery of array(manifest.mechanicalQaRecoveries)) {
    verifyHashedPath(recovery.archive);verifyHashedPath(recovery.currentReport);
    const archive=readJsonRequired(path.resolve(root,recovery.archive.path));
    const producer=manifest.stages.find(stage=>stage.id===recovery.producerStageId);
    if (JSON.stringify(archive.stage)!==JSON.stringify(producer)
        || JSON.stringify(archive.consumerRejection?.priorFailure)!==JSON.stringify(recovery.priorFailure)
        || archive.consumerRejection?.priorReportBytesUnavailable!==recovery.priorReportBytesUnavailable) fail("H5_MECHANICAL_RECOVERY_BINDING_CHANGED");
    for (const ref of array(archive.archivedOutputs)) verifyHashedPath(ref);
  }
  for (const item of manifest.stages) for (const binding of array(item.retryInput?.sourceTransfer?.inputs)) verifyHashedPath(binding);
  return manifest;
}
function readProofStatus() {
  const file = path.join(migrationDir, "fidelity-report.json");
  if (!fs.existsSync(file)) return { evidenceFidelity: "pending", structuralFidelity: "pending", generativeProof: "pending" };
  return proofStatusFromFidelity(readJsonRequired(file));
}
function proofStatusFromFidelity(fidelity) {
  const result = readCanonicalLearningProof(fidelity);
  return result.threeProofsPassed ? result.proofStatus : Object.fromEntries(Object.entries(result.proofStatus).map(([key, value]) => [key, value === "pass" ? "pending" : value]));
}
function verifyLearningFidelityResult(receiptOutputs) {
  const reportFile = path.join(migrationDir, "fidelity-report.json");
  const ref = array(receiptOutputs).find(item => path.resolve(root, item.path) === reportFile);
  if (!ref) fail("LEARNING_FIDELITY_RECEIPT_REQUIRED");
  verifyHashedPath(ref);
  const recorded = readJsonRequired(reportFile);
  const validation = revalidateLearningFidelity({ root, brand, goalFile, recordedReport: recorded });
  if (!validation.ok) fail(`LEARNING_FIDELITY_RESULT_BINDING_INVALID: ${validation.errors.join(", ")}`);
}
function allProofsPass(proofs) { return Object.values(proofs).every((value) => value === "pass"); }
function nextAction(manifest, proofs) {
  if (manifest.mode === "design-host") {
    if (manifest.status === "awaiting-concept-direction") return "Check the public delivery gate, open its comparisonPreview path on the static H5 server to show all three interactive host H5 directions equally, and wait for explicit user selection or feedback in conversation; the QA recommendation does not select or reorder directions. Do not scan or modify the host.";
    if (manifest.status === "awaiting-user-direction") return "Freeze design-direction-decision.json and design-direction.json from the explicitly selected H5, then finalize design-host.";
    if (manifest.status === "complete") return "Design-host is complete; start a separate apply-host run using the frozen direction artifacts.";
    return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}.` : "Inspect the blocked design-host stage.";
  }
  if (manifest.mode === "apply-host") {
    if (manifest.status === "awaiting-user") return "Show the runnable first preview, then record approve, revise or certify with approve-preview; do not start full QA yet.";
    if (manifest.status === "passed") return "Run finalize to close the apply-host manifest after its passing independent Visual QA receipt.";
    if (manifest.status === "complete") return "Host application is complete and has a passing independent Visual QA receipt.";
    return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}.` : "Inspect the blocked host stage and preserve the frozen apply-host goal.";
  }
  const failed = Object.entries(proofs).filter(([, value]) => value === "fail").map(([key]) => key);
  if (failed.length) return `Rework failed independent proof(s): ${failed.join(", ")}; then recapture and dispatch a fresh Visual QA.`;
  const pending = Object.entries(proofs).filter(([, value]) => value !== "pass").map(([key]) => key);
  if (manifest.status === "passed" && pending.length) return `Produce and validate pending independent proof(s): ${pending.join(", ")}.`;
  if (manifest.status === "complete") return "Brand learning capability test is complete. If source-prerequisite.json exists, run the public continue command to resume the original host-concepts target; learning pages are not the parent user deliverable. Otherwise deliver only the declared learning outcome.";
  return manifest.currentStageId ? `Dispatch or complete ${manifest.currentStageId}; three-proof status remains independently visible.` : "Inspect the blocked stage and preserve the frozen learning goal.";
}
function stage(name, role, attempt) { return { id: `${name}-${attempt}`, stage: name, role, attempt, maxAttempts: ["evidence", "demo", "visualQA"].includes(name) ? 2 : 1, status: "pending" }; }
function initialStageForMode(mode, executionProfile = "full") {
  if (mode === "learn-brand") return stage("evidence", "brandResearcher", 1);
  if (mode === "design-host" && executionProfile === "fast") return stage("h5DirectionGeneration", "brandApplicationDesigner", 1);
  if (mode === "design-host") return stage("startupPageStrategy", "hostStrategist", 1);
  if (mode === "apply-host") return stage("hostStrategy", "hostStrategist", 1);
  fail(`Unsupported goal mode: ${mode}`);
}
function stageOrderForMode(mode, executionProfile = "full") {
  if (mode === "design-host") return ["startupPageStrategy", "h5DirectionGeneration", "designVisualQA", "expressiveAssetGeneration", "expressiveVisualQA"];
  if (mode === "apply-host") return ["hostStrategy", "hostImplementation", "previewQA", "visualQA"];
  return ["evidence", "interpreter", "demo", "visualQA"];
}

function verifyHostStartupBaseline() {
  const startup = readJsonRequired(hostStartupPageFile);
  const baseline = readJsonRequired(hostStartupBaselineFile);
  if (startup.schema !== "host-startup-page/v1" || startup.scope !== "startup-page-only" || !startup.sourceFile || !startup.sourceSha256) fail("HOST_STARTUP_PAGE_INCOMPLETE");
  if (baseline.schema !== "host-startup-baseline/v1" || baseline.derivationSource !== "startup-page-scan") fail("HOST_STARTUP_BASELINE_SCHEMA_INVALID");
  if (baseline.hostStartupPageSha256 !== sha256File(hostStartupPageFile)) fail("HOST_STARTUP_BASELINE_HASH_MISMATCH");
  for (const key of ["primaryTask", "primaryAction", "pageType"]) if (!String(baseline[key] || "").trim()) fail("HOST_STARTUP_PRODUCTIVE_JUDGMENT_INCOMPLETE");
  if (!baseline.productiveFloor?.coreEntry || !array(baseline.productiveFloor?.businessObjectsVisible).length || baseline.productiveFloor?.warmReturnState !== "settled") fail("HOST_STARTUP_PRODUCTIVE_FLOOR_INCOMPLETE");
  const content = baseline.resultContentContract || {};
  if (!["captured-real", "host-schema"].includes(content.mode) || array(content.fields).length < 3 || content.readableRowsRequired !== true || content.anonymousSkeletonsForbidden !== true) fail("HOST_STARTUP_RESULT_CONTENT_CONTRACT_REQUIRED");
  const hostContent = baseline.hostContentContract || {};
  const visualCandidates = array(hostContent.visualCandidates);
  if (hostContent.derivationSource !== "startup-page-source-and-render" || hostContent.userInputRequired !== false || hostContent.noCandidateFallback !== "productive-ui") fail("HOST_STARTUP_CONTENT_CONTRACT_REQUIRED");
  const candidateIds = new Set();
  for (const candidate of visualCandidates) {
    const source = candidate?.sourceSize || {};
    const current = candidate?.currentCssSize || {};
    if (!candidate?.id || candidateIds.has(candidate.id) || !candidate?.hostField || String(candidate?.businessRole || '').trim().length < 8 || !candidate?.sourceLocator || !['ready', 'unresolved'].includes(candidate?.readiness)) fail("HOST_STARTUP_CONTENT_CANDIDATE_INVALID");
    candidateIds.add(candidate.id);
    if (candidate.readiness === 'ready' && ![source.width, source.height, current.width, current.height, candidate.minimumReadableCssPx].every((value) => Number.isFinite(Number(value)) && Number(value) > 0)) fail("HOST_STARTUP_CONTENT_CANDIDATE_GEOMETRY_REQUIRED");
  }
  const maxFirstViewportRatio = Number(baseline.expressiveOpportunity?.maxFirstViewportRatio);
  if (!baseline.expressiveOpportunity || typeof baseline.expressiveOpportunity.heroEligible !== "boolean" || !baseline.expressiveOpportunity.reason || !Number.isFinite(maxFirstViewportRatio) || maxFirstViewportRatio <= 0 || maxFirstViewportRatio > 0.5) fail("HOST_STARTUP_EXPRESSIVE_OPPORTUNITY_REQUIRED");
}

function verifyConceptDirectionBriefs() {
  if (!fs.existsSync(conceptDirectionBriefsFile)) fail("CONCEPT_DIRECTION_BRIEFS_REQUIRED: complete the pre-image art-direction gate before ImageGen.");
  try {
    execFileSync(process.execPath, [
      path.join(skillRoot, "scripts", "validate-concept-direction-briefs.mjs"),
      "--file", conceptDirectionBriefsFile,
      "--baseline", hostStartupBaselineFile,
      "--brand-mod", path.join(migrationDir, "brand-mod.json"),
    ], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`CONCEPT_DIRECTION_BRIEFS_INVALID: ${details}`);
  }
}

function verifyBrandRenderKit() {
  if (!fs.existsSync(brandRenderKitFile)) fail("BRAND_RENDER_KIT_REQUIRED: create the compact expressive/productive/transition render kit before ImageGen.");
  try {
    execFileSync(process.execPath, [path.join(skillRoot, "scripts", "validate-brand-render-kit.mjs"), "--file", brandRenderKitFile, "--evidence", path.join(migrationDir, "brand-evidence.json"), "--brand-mod", path.join(migrationDir, "brand-mod.json")], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const details = String(error.stdout || error.stderr || error.message || "").trim();
    fail(`BRAND_RENDER_KIT_INVALID: ${details}`);
  }
}

function verifyVisualProbeQaReport(route) {
  const report = readJsonRequired(conceptQaFile);
  if (report.schema !== "visual-probe-qa/v1" || report.status !== "eligible-for-human-review") fail("VISUAL_PROBE_QA_REPORT_SCHEMA_INVALID");
  const directions = array(report.directions);
  const routeIds = array(route.demoImages?.directions).map((item) => item.id).sort();
  const reportIds = directions.map((item) => item.id).sort();
  if (directions.length !== 3 || JSON.stringify(routeIds) !== JSON.stringify(reportIds)) fail("VISUAL_PROBE_QA_DIRECTION_COVERAGE_REQUIRED");
  for (const direction of directions) {
    if (!['recommend', 'show-with-warning', 'reject'].includes(direction.verdict)) fail("VISUAL_PROBE_QA_DIRECTION_VERDICT_INVALID");
    if (array(direction.visibleEvidence).length < 4 || array(direction.visibleEvidence).some((item) => String(item || "").trim().length < 12)) fail("VISUAL_PROBE_QA_VISIBLE_EVIDENCE_REQUIRED");
  }
  const recommended = array(report.recommendedDirectionIds).sort();
  if (!recommended.length || recommended.some((id) => !routeIds.includes(id))) fail("VISUAL_PROBE_QA_RECOMMENDATION_REQUIRED");
  if (JSON.stringify(recommended) !== JSON.stringify(array(route.demoVisualReview?.recommendedDirectionIds).sort())) fail("VISUAL_PROBE_QA_ROUTE_MISMATCH");
}

function verifyHostProductiveBaseline() {
  const inventory = readJsonRequired(hostPageInventoryFile);
  const baseline = readJsonRequired(hostProductiveBaselineFile);
  if (inventory.schema !== "host-page-inventory/v1" || inventory.discovery?.complete !== true || !array(inventory.pages).length) fail("HOST_PAGE_INVENTORY_INCOMPLETE");
  if (baseline.schema !== "host-productive-baseline/v1" || baseline.derivationSource !== "host-scan") fail("HOST_PRODUCTIVE_BASELINE_SCHEMA_INVALID");
  if (baseline.hostPageInventorySha256 !== sha256File(hostPageInventoryFile)) fail("HOST_PRODUCTIVE_BASELINE_INVENTORY_HASH_MISMATCH");
  const inventoryIds = array(inventory.pages).map((item) => item.id).sort();
  const judgments = array(baseline.pages);
  const judgmentIds = judgments.map((item) => item.id).sort();
  if (new Set(judgmentIds).size !== judgmentIds.length || JSON.stringify(inventoryIds) !== JSON.stringify(judgmentIds)) fail("HOST_PRODUCTIVE_BASELINE_PAGE_COVERAGE_INCOMPLETE");
  for (const page of judgments) {
    if (page.userFacing === false) {
      if (!page.exclusionReason) fail("HOST_PAGE_EXCLUSION_REASON_REQUIRED");
      continue;
    }
    const requiredStrings = ["sourceFile", "primaryTask", "primaryAction", "pageType"];
    if (requiredStrings.some((key) => !String(page[key] || "").trim())) fail("HOST_PAGE_PRODUCTIVE_JUDGMENT_INCOMPLETE");
    if (!["rare", "occasional", "frequent"].includes(page.repeatFrequency)) fail("HOST_PAGE_REPEAT_FREQUENCY_INVALID");
    if (!["low", "medium", "high"].includes(page.firstActionUrgency)) fail("HOST_PAGE_FIRST_ACTION_URGENCY_INVALID");
    if (!["low", "medium", "high"].includes(page.expressiveCapacity)) fail("HOST_PAGE_EXPRESSIVE_CAPACITY_INVALID");
    if (typeof page.heroEligibility?.eligible !== "boolean" || !page.heroEligibility?.reason) fail("HOST_PAGE_HERO_JUDGMENT_REQUIRED");
    const productive = page.productiveRequirements || {};
    if (!productive.coreEntry || !array(productive.businessObjectsVisible).length || !productive.aboveFoldPriority || productive.warmReturnState !== "settled") fail("HOST_PAGE_PRODUCTIVE_REQUIREMENTS_INCOMPLETE");
  }
  if (!baseline.targetPageId || !judgmentIds.includes(baseline.targetPageId)) fail("HOST_TARGET_PAGE_NOT_IN_INVENTORY");
}
function roleForStage(name) {
  return {
    evidence: "brandResearcher",
    interpreter: "designTranslator",
    demo: "demoImplementationAgent",
    startupPageStrategy: "hostStrategist",
    h5DirectionGeneration: "brandApplicationDesigner",
    conceptBrief: "brandApplicationDesigner",
    hostStrategy: "hostStrategist",
    brandApplication: "brandApplicationDesigner",
    conceptGeneration: "brandApplicationDesigner",
    conceptVisualQA: "visualQA",
    h5Reconstruction: "brandApplicationDesigner",
    designVisualQA: "visualQA",
    expressiveAssetGeneration: "brandApplicationDesigner",
    expressiveVisualQA: "visualQA",
    hostImplementation: "hostImplementationAgent",
    previewQA: "visualQA",
    visualQA: "visualQA",
  }[name];
}
function enforceDesignHostDeadline(manifest) {
  if (manifest.status !== "running" || manifest.mode !== "design-host" || manifest.executionProfile !== "fast" || !manifest.deadlineAt || Date.now() <= Date.parse(manifest.deadlineAt)) return;
  manifest.status = "timed-out";
  manifest.currentStageId = null;
  manifest.timeout = { code: "DESIGN_HOST_FAST_SAFETY_LIMIT_EXCEEDED", budgetMs: 1200000, previewTargetMs: 300000, deadlineAt: manifest.deadlineAt, observedAt: new Date().toISOString() };
  writeJson(manifestFile, manifest);
  fail("DESIGN_HOST_FAST_SAFETY_LIMIT_EXCEEDED: stop at the twenty-minute safety limit; the five-minute preview target must not remove required specialist roles.");
}
function containsRoleTimeoutClaim(receipt) {
  const visit = (value) => {
    if (typeof value === "string") return /(?:DESIGN_HOST_FAST_(?:BUDGET|SAFETY_LIMIT)_EXCEEDED|TIME_BUDGET_EXCEEDED)/i.test(value);
    if (Array.isArray(value)) return value.some(visit);
    if (value && typeof value === "object") return Object.entries(value).some(([key, child]) => /stopObservedAt|deadlineAt/i.test(key) || visit(child));
    return false;
  };
  return visit(receipt);
}
function dispatchScopeRules(manifest) {
  if (manifest.mode === "design-host" && manifest.currentStageId?.startsWith("designVisualQA-")) return [
    "Treat design-host-h5-mechanical-qa.json as the frozen proof for viewport, overflow, scrolling, image loading, peer geometry and basic interactions; do not repeat those checks with browser automation. Preserve its limitations: an overall pass does not verify a check marked pass:false/blocking:false; host-schema unavailable filtering remains unverified and must be reported as such.",
    "Use the hash-bound first-viewport captures named by design-host-h5-mechanical-qa.json for independent first-impression judgment; they come from the exact same headless render as the measurements and must not be replaced by another browser render.",
    "Judge Hierarchy and Utility as product-safety gates first, then judge Style uplift; report all three separately and never let Style compensate for a Hierarchy or Utility regression.",
    "Reject generic enterprise styling, repeated lead assets, weak brand visual mass, and candidates that differ only by list/grid arrangement.",
    "Remain independent: do not edit the H5, host source, Brand MOD or direction plan; return blocking findings to Brand Application Designer.",
  ];
  if (manifest.mode === "design-host") return [
    "Do not modify, compile or inject host source while generating directions.",
    "Use the frozen host baseline and existing Brand MOD; do not relearn the brand.",
    "Produce static target-viewport directions and stop for explicit user selection.",
  ];
  if (manifest.mode !== "apply-host") return [];
  if (manifest.executionProfile === "certification") {
    return ["Run the complete declared host coverage matrix and all release-blocking platform/runtime gates."];
  }
  if (manifest.executionProfile === "standard") {
    return ["Cover changed routes, affected component states and required parent launch paths; do not expand into unrequested platform certification."];
  }
  return [
    "Reuse the frozen Registry Evidence, Intent and Mapping; do not dispatch or simulate Brand Researcher or Design Translator.",
    "Use the full host scan to disposition every page, then apply the frozen direction to every APPLY page while preserving KEEP and reporting DEFER.",
    "Consume the one frozen design direction; do not generate, compare or reinterpret style options inside apply-host.",
    "Run representative Smoke QA after the full scoped application; certification remains separate from implementation coverage.",
    "Do not claim full-host certification without capability-gap and platform proof; report PARTIAL_STYLE_ONLY when runtime proof is absent.",
  ];
}

function validateMechanicalFailure(manifest, expectedVerdict = "fail") {
  if (!["pass","fail"].includes(expectedVerdict)) fail("H5_MECHANICAL_RETRY_REPORT_INVALID");
  const qa = manifest.stages.at(-1), producer = manifest.stages.at(-2);
  if (manifest.mode !== "design-host" || qa?.stage !== "designVisualQA" || qa.status !== "pending" || qa.dispatchPath || qa.agentExecutionId || manifest.currentStageId !== qa.id || producer?.stage !== "h5DirectionGeneration" || producer.status !== "complete" || producer.verdict !== "pass") fail("H5_MECHANICAL_RETRY_STATE_INVALID");
  const report = readJsonRequired(h5MechanicalQaFile);
  if (report.schema !== "design-host-h5-mechanical-qa/v1" || report.brand !== brand || report.verdict !== expectedVerdict || array(report.directions).length !== 3 || (expectedVerdict === "fail" ? !array(report.blockingFindings).length : array(report.blockingFindings).length > 0) || report.route?.path !== relative(designHostRouteFile)) fail("H5_MECHANICAL_RETRY_REPORT_INVALID");
  verifyHashedPath(report.route);
  const route = readJsonRequired(designHostRouteFile);
  const directions = array(route.h5Directions?.directions);
  if (directions.length !== 3 || new Set(report.directions.map(item => item.directionId)).size !== 3) fail("H5_MECHANICAL_RETRY_ARTIFACT_BINDING_INVALID");
  for (const item of report.directions) {
    const expected = directions.find(direction => direction.id === item.directionId)?.artifact;
    if (!expected || item.artifact?.path !== expected.path || item.artifact?.sha256 !== expected.sha256 || !array(producer.outputHashes).some(ref => ref.path === expected.path && ref.sha256 === expected.sha256)) fail("H5_MECHANICAL_RETRY_ARTIFACT_BINDING_INVALID");
    verifyHashedPath(item.artifact);
  }
  verifyHashedPath({path: producer.receiptPath, sha256: producer.receiptSha256});
  const receipt = readJsonRequired(path.resolve(root, producer.receiptPath));
  const dispatch = readJsonRequired(path.resolve(root, producer.dispatchPath));
  if (receipt.stageId !== producer.id || receipt.verdict !== "pass" || receipt.goalSha256 !== manifest.goalSha256 || receipt.dispatchId !== dispatch.dispatchId || dispatch.stageId !== producer.id || dispatch.goalSha256 !== manifest.goalSha256 || JSON.stringify(receipt.outputs) !== JSON.stringify(producer.outputHashes)) fail("H5_MECHANICAL_RETRY_RECEIPT_BINDING_INVALID");
  for (const input of array(dispatch.requiredInputs)) {
    if (!array(receipt.inputs).some(ref => ref.path === input.path && ref.sha256 === input.sha256)) fail("H5_MECHANICAL_RETRY_INPUT_BINDING_INVALID");
    verifyHashedPath(input);
  }
  return report;
}

function resumePendingMechanicalQa(manifest) {
  const qa=manifest.stages.at(-1),producer=manifest.stages.at(-2),failure=manifest.mechanicalFailure;
  if (!args.includes("--continue-existing") || manifest.status!=="blocked" || failure?.code!=="H5_MECHANICAL_QA_FAILED"
      || failure.qaStageId!==qa?.id || failure.producerStageId!==producer?.id || array(manifest.mechanicalQaRecoveries).length) fail("H5_MECHANICAL_RESUME_NOT_ALLOWED");
  if (qa.dispatchPath || qa.receiptPath || qa.agentExecutionId) fail("H5_MECHANICAL_RESUME_ALREADY_DISPATCHED");
  const priorReport=readJsonRequired(h5MechanicalQaFile);
  validateMechanicalFailure(manifest,priorReport.verdict);
  if (producer.dispatchSha256) verifyHashedPath({path:producer.dispatchPath,sha256:producer.dispatchSha256});
  const priorReportBytesUnavailable=hashedPath(relative(h5MechanicalQaFile)).sha256!==failure.report?.sha256;
  const archive=hashedPath(relative(archiveFailedStage(producer,[hashedPath(relative(h5MechanicalQaFile))],{kind:"pending-mechanical-qa-recovery",priorFailure:structuredClone(failure),priorReportBytesUnavailable})));
  const startedAt=new Date().toISOString(),priorDeadlineAt=manifest.deadlineAt;
  ensureDesignHostH5MechanicalQa(manifest);
  validateMechanicalFailure(manifest,"pass");
  const now=Date.now();
  manifest.mechanicalQaRecoveries=[{stageId:qa.id,producerStageId:producer.id,archive,priorFailure:structuredClone(failure),priorReportBytesUnavailable,
    currentReport:hashedPath(relative(h5MechanicalQaFile)),priorDeadlineAt,engineeringWaitStartedAt:failure.recordedAt||null,revalidationStartedAt:startedAt,recoveredAt:new Date(now).toISOString(),authorization:"explicit-continue-existing",scope:"current-pending-qa-only-no-new-production"}];
  manifest.status="running";
  if (manifest.deadlineAt && now>Date.parse(manifest.deadlineAt)) manifest.deadlineAt=new Date(now+1200000).toISOString();
  writeJson(manifestFile,manifest);
  return true;
}

function ensureDesignHostH5MechanicalQa(manifest) {
  // A resumed visual review consumes the same frozen mechanical proof. It must
  // not rerun the browser and overwrite the evidence from the abandoned review.
  const continuation = array(manifest.continuations).findLast(item =>
    item.kind === "explicit-user-request-to-continue-existing-visual-qa-stage"
    && item.stageId === manifest.currentStageId);
  if (continuation) {
    const prior = manifest.stages.find(item => item.id === continuation.abandonedStageId);
    if (!prior?.dispatchPath || !prior.dispatchSha256) fail("QA_RESUME_FROZEN_DISPATCH_MISSING");
    verifyHashedPath({path: prior.dispatchPath, sha256: prior.dispatchSha256});
    const dispatch = readJsonRequired(path.resolve(root, prior.dispatchPath));
    if (dispatch.stageId !== prior.id || dispatch.goalSha256 !== manifest.goalSha256) fail("QA_RESUME_FROZEN_DISPATCH_INVALID");
    for (const input of array(dispatch.requiredInputs)) verifyHashedPath(input);
    if (!array(dispatch.requiredInputs).some(input => input.path === relative(h5MechanicalQaFile))) fail("QA_RESUME_MECHANICAL_PROOF_MISSING");
    const report = readJsonRequired(h5MechanicalQaFile);
    if (report.schema !== "design-host-h5-mechanical-qa/v1" || report.brand !== brand || report.verdict !== "pass" || array(report.directions).length !== 3 || array(report.blockingFindings).length) fail("QA_RESUME_MECHANICAL_PROOF_INVALID");
    verifyHashedPath(report.route);
    for (const direction of report.directions) {
      verifyHashedPath(direction.artifact);
      verifyHashedPath(direction.capture);
    }
    return;
  }
  const script = path.join(skillRoot, "scripts", "audit-design-host-h5-mechanics.mjs");
  try {
    execFileSync(process.execPath, [script, "--root", root, "--brand", brand, "--width", "390", "--height", "844"], { stdio: "pipe", timeout: 90_000 });
  } catch (error) {
    const stdout = String(error?.stdout || "").trim();
    const stderr = String(error?.stderr || "").trim();
    if (fs.existsSync(h5MechanicalQaFile)) {
      validateMechanicalFailure(manifest);
      manifest.status = "blocked";
      manifest.mechanicalFailure = { code: "H5_MECHANICAL_QA_FAILED", report: hashedPath(relative(h5MechanicalQaFile)), producerStageId: manifest.stages.at(-2).id, qaStageId: manifest.currentStageId, nextAction: "repair-mechanical-audit-or-retry-h5", recordedAt: new Date().toISOString() };
      writeJson(manifestFile, manifest);
    }
    fail(`H5_MECHANICAL_QA_FAILED: producer rework is required before independent visual QA.${stdout ? `\n${stdout}` : ""}${stderr ? `\n${stderr}` : ""}`);
  }
  const report = readJsonRequired(h5MechanicalQaFile);
  if (report.verdict !== "pass" || array(report.directions).length !== 3) fail("H5_MECHANICAL_QA_INVALID");
}
function designHostEfficiencyBudget(current) {
  const targets = { startupPageStrategy: 75, h5DirectionGeneration: 300, designVisualQA: 90, expressiveAssetGeneration: 240, expressiveVisualQA: 45 };
  const uniqueInputSoftBytes = { startupPageStrategy: 40000, h5DirectionGeneration: 90000, designVisualQA: 50000, expressiveAssetGeneration: 70000, expressiveVisualQA: 50000 };
  if (!(current.stage in targets)) return null;
  return {
    stageTargetSeconds: targets[current.stage],
    stageHardLimitSeconds: null,
    fastRunTextTokenSoftRange: [40000, 60000],
    fastRunTextTokenHardLimit: 80000,
    tokenLimitPolicy: "enforce only when the model runtime reports actual input/output tokens; otherwise report unavailable and use uniqueInputBytes as a diagnostic proxy, never as a fake token count",
    uniqueInputSoftBytes: uniqueInputSoftBytes[current.stage],
    duplicateInputRatioWarning: 0.2,
    contextPolicy: "reuse hashed stage outputs; do not reread full contract, token catalogs, prior runs or unrelated host pages",
    additionalReadPolicy: "query only the exact missing key or knowledge record and report its bytes in the receipt",
    firstReviewableTargetMs: 300000,
    safetyLimitMs: 1200000,
    qualityRule: "stage targets are diagnostic; the frozen run deadline stops runaway work. Quality and elapsed time are recorded separately; neither permits invented data, skipped independent QA or host-source mutation",
  };
}
function failureRouteForMode(mode, failureOwnerRole) {
  if (mode === "apply-host") {
    return ["hostImplementation", "hostImplementationAgent"];
  }
  if (mode === "design-host") {
    return failureOwnerRole === "hostStrategist" ? ["hostStrategy", "hostStrategist"] : ["brandApplication", "brandApplicationDesigner"];
  }
  return {
    brandResearcher: ["evidence", "brandResearcher"],
    designTranslator: ["interpreter", "designTranslator"],
    demoImplementationAgent: ["demo", "demoImplementationAgent"],
    implementationAgent: ["demo", "demoImplementationAgent"],
  }[failureOwnerRole] || ["demo", "demoImplementationAgent"];
}
function uniqueStage(manifest, name, role, attempt) {
  const item = stage(name, role, attempt);
  const used = new Set(array(manifest?.stages).map((entry) => entry.id));
  if (!used.has(item.id)) return item;
  let suffix = 2;
  while (used.has(`${item.id}-retry-${suffix}`)) suffix += 1;
  item.id = `${item.id}-retry-${suffix}`;
  return item;
}
function h5ProducerSourceCaptures() {
  const evidence = readJsonRequired(path.join(migrationDir, "brand-evidence.json"));
  const captures = new Map();
  const missing = [];
  for (const claim of array(evidence.claims)) {
    const references = Array.isArray(claim.capture?.frames) && claim.capture.frames.length
      ? claim.capture.frames : [typeof claim.capture === "string" ? { path: claim.capture } : claim.capture];
    for (const capture of references) {
    const reference = capture?.path;
    if (!reference) { missing.push({claimId: claim.id, reason: "capture-not-declared"}); continue; }
    if (typeof reference !== "string") fail(`H5_SOURCE_CAPTURE_INVALID:${claim.id}`);
    const file = resolveEvidenceReference(root, migrationDir, reference);
    if (!file || !file.startsWith(`${path.resolve(root)}${path.sep}`)) fail(`H5_SOURCE_CAPTURE_INVALID:${claim.id}`);
    // Check the nearest existing ancestor too: a missing child of an escaping
    // symlink is not a harmless missing reference.
    let ancestor = file;
    while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) ancestor = path.dirname(ancestor);
    const realRoot = fs.realpathSync(root);
    const realAncestor = fs.realpathSync(ancestor);
    if (realAncestor !== realRoot && !realAncestor.startsWith(`${realRoot}${path.sep}`)) fail(`H5_SOURCE_CAPTURE_INVALID:${claim.id}`);
    if (!fs.existsSync(file)) { missing.push({claimId: claim.id, reference, reason: "capture-file-missing"}); continue; }
    if (!fs.statSync(file).isFile() || !/\.(png|jpe?g|webp|gif|avif)$/i.test(file)) fail(`H5_SOURCE_CAPTURE_INVALID:${claim.id}`);
    const bound = hashedPath(relative(file));
    if (capture.sha256 !== undefined && capture.sha256 !== bound.sha256) fail(`H5_SOURCE_CAPTURE_HASH_MISMATCH:${claim.id}`);
    const existing = captures.get(bound.path);
    if (existing) existing.claimIds.push(claim.id);
    else captures.set(bound.path, {...bound, claimIds: [claim.id]});
    }
  }
  return { captures: [...captures.values()], missing, usage: "Evidence-only. Inspect task-relevant captures within each claim's existing scope; missing references do not establish visual facts. Never embed source screenshots in runtime or infer additional approval." };
}

function frozenH5QaSourceInputs(manifest) {
  const producer = [...manifest.stages].reverse().find(item => item.stage === "h5DirectionGeneration" && item.status === "complete");
  if (!producer?.receiptPath) fail("H5_QA_SOURCE_PRODUCER_REQUIRED");
  verifyHashedPath({ path: producer.receiptPath, sha256: producer.receiptSha256 });
  const receipt = readJsonRequired(path.resolve(root, producer.receiptPath));
  const names = new Set(["brand-evidence.json", "brand-intent.json", "brand-mod.json", "approved-visual-patterns.json"]);
  const sources = array(receipt.inputs).filter(item => names.has(path.basename(item.path)));
  for (const source of sources) verifyHashedPath(source);
  const evidenceInput = sources.find(item => path.basename(item.path) === "brand-evidence.json");
  if (!evidenceInput || !sources.some(item => path.basename(item.path) === "brand-mod.json") || !sources.some(item => path.basename(item.path) === "brand-intent.json")) fail("H5_QA_FROZEN_BRAND_INPUTS_REQUIRED");
  const kitInput = array(receipt.outputs).find(item => path.resolve(root, item.path) === brandRenderKitFile);
  if (!kitInput) fail("H5_QA_RENDER_KIT_REQUIRED");
  verifyHashedPath(kitInput);
  const evidence = readJsonRequired(path.resolve(root, evidenceInput.path));
  const refs = new Set(array(readJsonRequired(brandRenderKitFile).expressive?.mechanisms).map(item => item.evidenceRef));
  const captures = [];
  for (const claim of array(evidence.claims).filter(item => refs.has(item.id))) {
    const capture = claim.capture;
    const reference = typeof capture === "string" ? capture : capture?.path;
    if (!reference) continue; // Missing visual evidence remains a QA finding, not fabricated input.
    const file = resolveEvidenceReference(root, migrationDir, reference);
    if (!file || !fs.existsSync(file) || !fs.realpathSync(file).startsWith(`${fs.realpathSync(root)}${path.sep}`)) fail(`H5_QA_SOURCE_CAPTURE_INVALID:${claim.id}`);
    const bound = hashedPath(relative(file));
    if (capture?.sha256 && capture.sha256 !== bound.sha256) fail(`H5_QA_SOURCE_CAPTURE_HASH_MISMATCH:${claim.id}`);
    const producerBound = array(receipt.inputs).find(item => item.path === bound.path);
    if (producerBound) verifyHashedPath(producerBound);
    captures.push(producerBound || bound); // Legacy receipts retain their existing source-binding rule.
  }
  return latestInputsByPath([...sources, kitInput, ...captures]);
}

function hashedPath(relativePath) { const file = path.resolve(root, relativePath); if (!fs.existsSync(file)) fail(`Required input missing: ${relativePath}`); return { path: relativePath, sha256: sha256File(file) }; }
function verifyHashedPath(item) { if (!item?.path || !item?.sha256) fail("Receipt input/output must contain path and sha256."); const current = hashedPath(item.path); if (current.sha256 !== item.sha256) fail(`Receipt hash mismatch: ${item.path}`); }
function verifyEvidenceVisibilityGate() {
  const guard = path.join(skillRoot, "scripts", "brand-guard.mjs");
  try {
    execFileSync(process.execPath, [guard, "evidence-visibility-gate", "--root", root, "--brand", brand, "--action-file", path.join(migrationDir, "action-evidence.json"), "--strict"], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const output = String(error?.stdout || error?.stderr || "").trim();
    fail(`Evidence receipt cannot pass before screenshot-first visibility gate passes.${output ? `\n${output}` : ""}`);
  }
}
function verifyLearnBrandHandoff(stage) {
  const validator = path.join(skillRoot, "scripts", "validate-learn-brand-handoff.mjs");
  try {
    execFileSync(process.execPath, [validator, "--root", root, "--brand", brand, "--goal-file", goalFile, "--stage", stage], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const report = String(error?.stdout || error?.stderr || "").trim();
    fail(`LEARN_BRAND_${stage.toUpperCase()}_HANDOFF_BLOCKED: ${report}`);
  }
}
function verifyDesignDirectionGate() {
  const validator = path.join(skillRoot, "scripts", "validate-design-direction.mjs");
  try {
    execFileSync(process.execPath, [validator, "--brand", brand, "--require-learning-proof"], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const output = String(error?.stdout || error?.stderr || "").trim();
    fail(`Demo cannot be dispatched before the top-level Design Director direction gate passes.${output ? `\n${output}` : ""}`);
  }
}
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function readJsonRequired(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { fail(`Missing or invalid JSON: ${relative(file)}`); } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function relative(file) { return path.relative(root, file); }
function array(value) { return Array.isArray(value) ? value : []; }
function opt(name, fallback) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] || fallback : fallback; }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
function output(value, exitCode = 0) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); process.exit(exitCode); }
