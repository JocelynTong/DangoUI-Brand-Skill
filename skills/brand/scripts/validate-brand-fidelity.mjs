#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.includes("--self-test-normalization")) runNormalizationSelfTest();
const root = path.resolve(readArg("--root") || process.cwd());
const brand = readArg("--brand");
const write = args.includes("--write");
if (!brand) failUsage("--brand is required");

const migrationDir = path.join(root, "migrations", brand);
const requestedGoalFile = readArg("--goal-file");
const goalFile = requestedGoalFile
  ? path.resolve(root, requestedGoalFile)
  : resolveCanonicalGoalFile(migrationDir);
const inputManifestFile = path.join(migrationDir, "qa-input-manifest.json");
const assessmentFile = path.join(migrationDir, "visual-qa-assessment.json");
const patternInventoryFile = path.join(migrationDir, "visual-pattern-inventory.json");
const brandIntentFile = path.join(migrationDir, "brand-intent.json");
const approvedPatternsFile = path.join(migrationDir, "approved-visual-patterns.json");
const generativeProofFile = path.join(migrationDir, "generative-proof.json");
const goal = readJson(goalFile);
const inputManifest = readJson(inputManifestFile);
const assessment = readJson(assessmentFile);
const patternInventory = readJson(patternInventoryFile);
const brandIntent = readJson(brandIntentFile);
const approvedPatterns = readJson(approvedPatternsFile);
const generativeProof = readJson(generativeProofFile);
const protocolFailures = [];
const hardFailures = [];
const blockingFindings = [];

check(["brand-goal/v1", "brand-goal/v2"].includes(goal?.schema), "GOAL_NOT_SEALED", "The canonical goal contract must use a supported brand-goal schema and exist.");
check(goal?.sealed === true, "GOAL_NOT_SEALED", "The canonical goal contract must be sealed before QA dispatch.");
check(inputManifest?.schema === "brand-blind-qa-input/v1", "BLIND_INPUT_VIOLATION", "qa-input-manifest.json is missing or invalid.");
check(assessment?.schema === "brand-visual-qa-assessment/v2", "DIMENSION_UNSCORED", "visual-qa-assessment.json must use v2.");
check(patternInventory?.schema === "brand-visual-pattern-inventory/v1", "VISUAL_PATTERN_INVENTORY_MISSING", "visual-pattern-inventory.json is required and must use brand-visual-pattern-inventory/v1.");

const goalSha256 = fs.existsSync(goalFile) ? sha256File(goalFile) : "";
check(inputManifest?.goalSha256 === goalSha256, "GOAL_HASH_MISMATCH", "QA input manifest is not bound to the current frozen goal.");
check(assessment?.goalSha256 === goalSha256, "GOAL_HASH_MISMATCH", "QA assessment is not bound to the current frozen goal.");
check(patternInventory?.goalSha256 === goalSha256, "GOAL_HASH_MISMATCH", "Visual pattern inventory is not bound to the current frozen goal.");
check(Boolean(inputManifest?.qaExecutionId), "NON_INDEPENDENT_REVIEWER", "qaExecutionId is required.");
check(Boolean(inputManifest?.implementationExecutionId), "NON_INDEPENDENT_REVIEWER", "implementationExecutionId is required.");
check(inputManifest?.qaExecutionId !== inputManifest?.implementationExecutionId, "NON_INDEPENDENT_REVIEWER", "QA and implementation must use different agent executions.");
check(assessment?.qaExecutionId === inputManifest?.qaExecutionId, "NON_INDEPENDENT_REVIEWER", "Assessment QA execution id must match the blind input manifest.");

const forbiddenAbsence = inputManifest?.forbiddenInputsAbsent || {};
for (const key of ["implementationRationale", "priorVerdict", "buildPassAsVisualEvidence", "mainConversation"]) {
  check(forbiddenAbsence[key] === true, "BLIND_INPUT_VIOLATION", `Blind QA must explicitly exclude ${key}.`);
}
for (const input of array(inputManifest?.allowedInputs)) {
  const label = `${input?.kind || ""} ${input?.path || ""}`;
  check(!/rationale|prior[-_ ]?verdict|visual-quality-report|implementation-handoff|conversation/i.test(label), "BLIND_INPUT_VIOLATION", `Forbidden QA input: ${label}`);
  if (input?.path) verifyPathHash(input.path, input.sha256, "SCREENSHOT_HASH_MISMATCH");
}
const inventoryInput = array(inputManifest?.allowedInputs).find((input) => input?.kind === "visual-pattern-inventory" || input?.path === relativeToRoot(patternInventoryFile));
check(Boolean(inventoryInput), "BLIND_INPUT_VIOLATION", "Blind QA input must include the hashed visual-pattern-inventory.json.");

const weights = {
  composition: 25,
  assetAuthenticity: 20,
  colorRoles: 15,
  informationDensity: 15,
  typographyGraphics: 10,
  motionSemantics: 10,
  brandRecognition: 5,
};
const thresholds = {
  overall: Number(goal?.thresholds?.overall ?? 80),
  corePage: Number(goal?.thresholds?.corePage ?? 70),
  composition: Number(goal?.thresholds?.dimensionMin?.composition ?? 3),
  assetAuthenticity: Number(goal?.thresholds?.dimensionMin?.assetAuthenticity ?? 3),
  maxAttempts: Number(goal?.thresholds?.maxAttempts ?? 2),
};
const assessmentPages = array(assessment?.pages);
const inventoryPages = array(patternInventory?.pages);
const sourcePages = array(goal?.referencePages);
const corePages = sourcePages.filter((item) => item?.core !== false);
const pageResults = [];
const compositionRequirements = array(goal?.mustPreserve).filter((item) =>
  array(item?.dimensions).includes("composition"));
const sourceEvidenceFiles = collectSourceEvidenceFiles();
const screenshotRecreationAuthorized = goal?.implementationPolicy?.allowSourceScreenshotAsRuntimeAsset === true
  && goal?.goalType === "screenshot-recreation";
const requiresLearningProof = goal?.goalType === "brand-learning-capability-test";

for (const sourcePage of corePages) {
  const page = assessmentPages.find((item) => item?.sourcePageId === sourcePage.id);
  if (!page) {
    hard("CORE_PAGE_UNMAPPED", sourcePage.id, "Core source page has no QA assessment.");
    continue;
  }
  verifyScreenshot(page.sourceScreenshot, "source", sourcePage.id);
  verifyScreenshot(page.demoScreenshot, "demo", sourcePage.id);
  const inventoryPage = inventoryPages.find((item) => item?.demoPageId === page.demoPageId);
  if (!inventoryPage) {
    protocol("VISUAL_PATTERN_INVENTORY_MISSING", sourcePage.id, "Core demo page has no visual pattern inventory.");
  } else {
    const qaPatterns = array(page?.visualPatterns);
    for (const pattern of array(inventoryPage?.patterns).filter((item) => item?.salience === "high")) {
      const refs = array(pattern?.evidenceRefs);
      const hasSourceSupport = refs.length > 0 && refs.every((ref) =>
        Boolean(ref?.evidenceId)
        && Boolean(ref?.sourcePageId)
        && Array.isArray(ref?.sourceRegion)
        && ref.sourceRegion.length === 4);
      if (!pattern?.approvedPatternId || !Array.isArray(pattern?.demoRegion) || pattern.demoRegion.length !== 4 || !hasSourceSupport) {
        hard("UNSUPPORTED_VISUAL_PATTERN", pattern?.id || sourcePage.id, "High-salience demo pattern lacks an approved pattern id, demo region, or source evidence region.");
      }
      if (pattern?.selfCheck !== "pass") hard("IMPLEMENTATION_PATTERN_SELF_CHECK_FAILED", pattern?.id || sourcePage.id, "Implementation self-check did not pass.");
      validateRuntimeAssetProvenance(pattern, sourcePage);
      const qaPattern = qaPatterns.find((item) => item?.id === pattern?.id);
      if (!qaPattern) {
        protocol("VISUAL_PATTERN_NOT_REVIEWED", pattern?.id || sourcePage.id, "Blind QA omitted a high-salience implementation pattern.");
        continue;
      }
      const qaHasRegions = Array.isArray(qaPattern?.sourceRegion) && qaPattern.sourceRegion.length === 4
        && Array.isArray(qaPattern?.demoRegion) && qaPattern.demoRegion.length === 4;
      if (!qaHasRegions || !qaPattern?.finding) protocol("VISUAL_PATTERN_REVIEW_WITHOUT_EVIDENCE", pattern?.id || sourcePage.id, "Pattern review needs source/demo regions and a finding.");
      if (qaPattern?.status !== "supported") hard("UNSUPPORTED_VISUAL_PATTERN", pattern?.id || sourcePage.id, qaPattern?.finding || "Blind QA rejected this visual pattern.");
      if (qaPattern?.roleExpansion === true) hard("UNSUPPORTED_ROLE_EXPANSION", pattern?.id || sourcePage.id, qaPattern?.finding || "A token role was expanded beyond its evidence-backed use.");
    }

    for (const requirement of compositionRequirements.filter((item) => array(item?.requiredOn).includes(sourcePage.id))) {
      const supportingPatterns = array(inventoryPage?.patterns).filter((pattern) =>
        array(pattern?.preserves).includes(requirement.id) && pattern?.compositionSupport);
      if (!supportingPatterns.length) {
        hard("COMPOSITION_SUPPORT_MISSING", requirement.id, `${sourcePage.id} has no implementation pattern explicitly bound to ${requirement.id}.`);
        continue;
      }
      for (const pattern of supportingPatterns) validateCompositionSupport(pattern, page, requirement, sourcePage);
    }
  }
  let pageScore = 0;
  const ratings = {};
  for (const [dimension, weight] of Object.entries(weights)) {
    const item = page?.dimensions?.[dimension];
    const rating = Number(item?.rating);
    if (!Number.isInteger(rating) || rating < 0 || rating > 4) {
      protocol("DIMENSION_UNSCORED", sourcePage.id, `${dimension} must be an integer from 0 to 4.`);
      continue;
    }
    const observations = array(item?.observations);
    const hasVisualEvidence = observations.length > 0 && observations.every((observation) =>
      Array.isArray(observation?.sourceRegion) && observation.sourceRegion.length === 4
      && Array.isArray(observation?.demoRegion) && observation.demoRegion.length === 4
      && Boolean(observation?.finding));
    if (!hasVisualEvidence) protocol("RATING_WITHOUT_VISUAL_EVIDENCE", sourcePage.id, `${dimension} lacks source/demo region evidence.`);
    ratings[dimension] = rating;
    pageScore += weight * rating / 4;
  }
  if ((ratings.composition ?? -1) < thresholds.composition) hard("CORE_COMPOSITION_BELOW_MIN", sourcePage.id, "Composition is below the frozen minimum.");
  if ((ratings.assetAuthenticity ?? -1) < thresholds.assetAuthenticity) hard("CORE_ASSET_BELOW_MIN", sourcePage.id, "Asset authenticity is below the frozen minimum.");
  if (pageScore < thresholds.corePage) hard("CORE_PAGE_BELOW_THRESHOLD", sourcePage.id, `Core page score ${round(pageScore)} is below ${thresholds.corePage}.`);
  for (const finding of array(page?.blockingFindings)) {
    blockingFindings.push(typeof finding === "string"
      ? { page: sourcePage.id, finding }
      : { page: sourcePage.id, ...finding });
    hard(finding?.code || "QA_BLOCKING_FINDING", sourcePage.id, finding?.finding || "QA reported a blocking finding.");
  }
  pageResults.push({ sourcePageId: sourcePage.id, demoPageId: page.demoPageId || "", score: round(pageScore), ratings });
}

const mustPreserveAssessments = assessmentPages.flatMap((page) => array(page?.mustPreserve));
for (const requirement of array(goal?.mustPreserve)) {
  const matches = mustPreserveAssessments.filter((item) => item?.id === requirement.id);
  if (!matches.length || matches.some((item) => item?.status !== "pass")) hard("MUST_PRESERVE_FAILED", requirement.id, requirement.description || "A mustPreserve requirement failed.");
}
const mustNotAssessments = assessmentPages.flatMap((page) => array(page?.mustNotReplace));
for (const boundary of array(goal?.mustNotReplace)) {
  const matches = mustNotAssessments.filter((item) => item?.id === boundary.id);
  if (!matches.length || matches.some((item) => item?.violated !== false)) hard("MUST_NOT_REPLACE_VIOLATED", boundary.id, boundary.description || "A forbidden replacement was violated or not assessed.");
}

const overallScore = pageResults.length ? round(pageResults.reduce((sum, item) => sum + item.score, 0) / pageResults.length) : 0;
if (overallScore < thresholds.overall) hard("OVERALL_BELOW_THRESHOLD", "overall", `Overall score ${overallScore} is below ${thresholds.overall}.`);
if (assessment?.reviewerRecommendation !== "pass") hard("REVIEWER_REJECTED", "overall", `Reviewer recommendation is ${assessment?.reviewerRecommendation || "missing"}.`);
if ("level" in (assessment || {}) || "visual-quality-ready" in (assessment || {})) protocol("QA_SELF_APPROVAL_FIELD", "assessment", "QA assessment may not self-write a ready level.");

if (requiresLearningProof) validateLearningProofContract();

const status = protocolFailures.length ? "protocol-blocked" : hardFailures.length ? "fidelity-fail" : "fidelity-pass";
const attempt = Number(assessment?.attempt || inputManifest?.attempt || 1);
check(Number(patternInventory?.attempt) === attempt, "PATTERN_ATTEMPT_MISMATCH", "Visual pattern inventory attempt must match the QA attempt.");
const result = {
  schema: "brand-visual-quality-result/v2",
  brand,
  goalId: goal?.goalId || null,
  goalContractPath: relativeToRoot(goalFile),
  goalSha256,
  attempt,
  status,
  overallScore,
  thresholds,
  pageResults,
  protocolFailures,
  hardFailures,
  blockingFindings,
  learningProof: buildLearningProofSummary(),
  inputHashes: {
    goal: goalSha256,
    qaInputManifest: fs.existsSync(inputManifestFile) ? sha256File(inputManifestFile) : null,
    assessment: fs.existsSync(assessmentFile) ? sha256File(assessmentFile) : null,
    visualPatternInventory: fs.existsSync(patternInventoryFile) ? sha256File(patternInventoryFile) : null,
    generativeProof: fs.existsSync(generativeProofFile) ? sha256File(generativeProofFile) : null,
  },
  generatedBy: { tool: "validate-brand-fidelity.mjs", version: "1.3" },
  generatedAt: new Date().toISOString(),
};

if (write) {
  writeJson(path.join(migrationDir, "fidelity-report.json"), result);
  const attemptDir = path.join(migrationDir, "quality-attempts", String(attempt));
  writeJson(path.join(attemptDir, "fidelity-report.json"), result);
  if (status === "fidelity-fail" && attempt < thresholds.maxAttempts) {
    writeJson(path.join(attemptDir, "rework-request.json"), {
      schema: "brand-rework-request/v1",
      brand,
      goalId: goal?.goalId || null,
      goalSha256,
      fromAttempt: attempt,
      nextAttempt: attempt + 1,
      blockingFindings: hardFailures,
      allowedChanges: ["demo implementation", "demo screenshots"],
      forbiddenChanges: ["goal-contract", "source evidence", "fidelity thresholds"],
      requiredRecaptures: pageResults.map((item) => item.demoPageId).filter(Boolean),
      maxAttempts: thresholds.maxAttempts,
    });
  }
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(status === "fidelity-pass" ? 0 : status === "fidelity-fail" ? 2 : 3);

function validateLearningProofContract() {
  const contract = goal?.learningProofContract || goal?.proofRequirements;
  if (!contract) {
    hard("LEARNING_PROOF_CONTRACT_MISSING", "goal", "A brand-learning-capability-test must freeze Evidence, Structural and Generative proof requirements.");
  }
  const nonGoals = array(goal?.nonGoals);
  for (const value of ["website-mirror", "host-apply", "branded-asset-template"]) {
    const equivalentTemplateRejection = value === "branded-asset-template"
      && goal?.implementationPolicy?.allowSourceScreenshotAsRuntimeAsset === false
      && goal?.implementationPolicy?.requireIndependentRuntimeAssetsOrDomCssReconstruction === true
      && generativeProof?.challenge?.sourceContentIndependent === true
      && generativeProof?.checks?.brandCueSubstitution === false;
    if (!nonGoals.includes(value) && !equivalentTemplateRejection) hard("LEARNING_NON_GOAL_MISSING", value, `Learning goal must explicitly reject ${value}.`);
  }
  if (goal?.implementationPolicy?.allowSourceScreenshotAsRuntimeAsset !== false) {
    hard("LEARNING_IMPLEMENTATION_POLICY_WEAK", "goal", "Learning tests must explicitly forbid source screenshots as Demo runtime assets.");
  }

  const proofInput = array(inputManifest?.allowedInputs).find((input) =>
    input?.kind === "generative-proof" || input?.path === relativeToRoot(generativeProofFile));
  if (!proofInput) hard("GENERATIVE_PROOF_MISSING", "generative", "Blind QA input must include a hashed generative-proof.json.");
  if (generativeProof?.schema !== "brand-generative-proof/v1") {
    hard("GENERATIVE_PROOF_MISSING", "generative", "generative-proof.json must use brand-generative-proof/v1.");
    return;
  }
  if (generativeProof?.goalSha256 !== goalSha256) hard("GOAL_HASH_MISMATCH", "generative", "Generative proof is not bound to the frozen goal.");
  if (proofInput?.path) verifyPathHash(proofInput.path, proofInput.sha256, "GENERATIVE_PROOF_HASH_MISMATCH");

  const challenge = generativeProof?.challenge || {};
  if (challenge.heldOut !== true || challenge.sourceContentIndependent !== true) {
    hard("GENERATIVE_CHALLENGE_NOT_HELD_OUT", challenge.id || "generative", "Generative proof needs held-out content selected after rules were frozen and independent from a copied source page.");
  }
  if (!challenge.id || !challenge.contentChange || challenge.mapsToSourcePageId) {
    hard("MIRROR_ONLY", challenge.id || "generative", "A held-out challenge must describe changed content and must not be another one-to-one source page mirror.");
  }
  const frozenRules = array(generativeProof?.frozenRules);
  if (frozenRules.length < 2 || frozenRules.some((item) => !item?.recipeId || item?.frozenBeforeChallenge !== true)) {
    hard("GENERATIVE_RULE_REUSE_UNPROVEN", challenge.id || "generative", "Generative proof must reuse at least two named recipes frozen before the held-out challenge.");
  }
  const output = generativeProof?.output || {};
  if (!output.demoPageId || !output.screenshot?.path || !output.screenshot?.sha256) {
    hard("GENERATIVE_OUTPUT_MISSING", challenge.id || "generative", "Held-out output needs a demo page id and hashed screenshot.");
  } else {
    verifyPathHash(output.screenshot.path, output.screenshot.sha256, "GENERATIVE_OUTPUT_HASH_MISMATCH");
    const evidenceHashes = new Set([...sourceEvidenceFiles.values()].map((item) => item.sha256).filter(Boolean));
    if (evidenceHashes.has(output.screenshot.sha256)) hard("MIRROR_ONLY", output.demoPageId, "Held-out output is byte-identical to source evidence.");
  }
  if (generativeProof?.checks?.brandCueSubstitution !== false
    || array(generativeProof?.checks?.structureRulesApplied).length < 2) {
    hard("BRAND_CUE_SUBSTITUTION", output.demoPageId || "generative", "Logo, brand colors or official wallpaper cannot substitute for applying reusable structural rules.");
  }
  const review = assessment?.generativeProofReview;
  if (review?.status !== "pass") hard("GENERATIVE_PROOF_NOT_APPROVED", challenge.id || "generative", "Blind QA must independently approve the held-out generative proof.");
  const ruleChecks = array(review?.ruleChecks);
  if (ruleChecks.length < frozenRules.length || ruleChecks.some((item) => item?.status !== "reused" || !item?.finding)) {
    hard("GENERATIVE_RULE_REUSE_UNPROVEN", challenge.id || "generative", "Blind QA must review every frozen recipe and confirm rule reuse with visual findings.");
  }
}

function buildLearningProofSummary() {
  if (!requiresLearningProof) return { required: false, status: "not-required" };
  const codes = new Set([...protocolFailures, ...hardFailures].map((item) => item.code));
  const evidenceCodes = new Set([
    "UNSUPPORTED_VISUAL_PATTERN", "UNSUPPORTED_ROLE_EXPANSION", "SCREENSHOT_AS_IMPLEMENTATION",
    "EVIDENCE_LEAKAGE", "ASSET_PROVENANCE_MISSING", "GOAL_HASH_MISMATCH",
  ]);
  const generativeCodes = new Set([
    "GENERATIVE_PROOF_MISSING", "GENERATIVE_PROOF_HASH_MISMATCH", "GENERATIVE_CHALLENGE_NOT_HELD_OUT",
    "GENERATIVE_RULE_REUSE_UNPROVEN", "GENERATIVE_OUTPUT_MISSING", "GENERATIVE_OUTPUT_HASH_MISMATCH",
    "GENERATIVE_PROOF_NOT_APPROVED", "BRAND_CUE_SUBSTITUTION", "MIRROR_ONLY",
  ]);
  const evidenceFailed = [...codes].some((code) => evidenceCodes.has(code));
  const generativeFailed = [...codes].some((code) => generativeCodes.has(code));
  const structuralFailed = hardFailures.some((item) =>
    !evidenceCodes.has(item.code) && !generativeCodes.has(item.code));
  return {
    required: true,
    status: !evidenceFailed && !structuralFailed && !generativeFailed && protocolFailures.length === 0 ? "learning-proof-pass" : "learning-proof-fail",
    evidenceFidelity: evidenceFailed || protocolFailures.length ? "fail" : "pass",
    structuralFidelity: structuralFailed || protocolFailures.length ? "fail" : "pass",
    generativeProof: generativeFailed || protocolFailures.length ? "fail" : "pass",
    rule: "All three proofs must pass; scores cannot compensate for a failed proof.",
  };
}

function readArg(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
function resolveCanonicalGoalFile(migrationDir) {
  const intent = readJson(path.join(migrationDir, "brand-intent.json"));
  const expectedGoalId = intent?.goalId;
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^goal-contract(?:-[\w-]+)?\.json$/.test(name))
    .map((name) => path.join(migrationDir, name));
  if (expectedGoalId) {
    const exact = candidates.find((file) => readJson(file)?.goalId === expectedGoalId);
    if (exact) return exact;
  }
  return path.join(migrationDir, "goal-contract.json");
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }
function array(value) { return Array.isArray(value) ? value : []; }
function round(value) { return Math.round(value * 100) / 100; }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function failUsage(message) { process.stderr.write(`${message}\n`); process.exit(1); }
function protocol(code, scope, message) { protocolFailures.push({ code, scope, message }); }
function hard(code, scope, message) { if (!hardFailures.some((item) => item.code === code && item.scope === scope)) hardFailures.push({ code, scope, message }); }
function check(condition, code, message) { if (!condition) protocol(code, "protocol", message); }
function verifyPathHash(relativePath, expectedHash, code) {
  const file = path.resolve(root, relativePath);
  if (!fs.existsSync(file) || !expectedHash || sha256File(file) !== expectedHash) protocol(code, relativePath, "Input path is missing or its sha256 does not match.");
}
function verifyScreenshot(value, kind, scope) {
  if (!value?.path) return protocol("SCREENSHOT_HASH_MISMATCH", scope, `${kind} screenshot is missing.`);
  verifyPathHash(value.path, value.sha256, "SCREENSHOT_HASH_MISMATCH");
}
function relativeToRoot(file) { return path.relative(root, file).split(path.sep).join("/"); }

function collectSourceEvidenceFiles() {
  const files = new Map();
  for (const page of array(goal?.referencePages)) {
    if (page?.screenshot) addSourceEvidence(page.screenshot, `goal:${page.id || "reference-page"}`);
  }
  for (const input of array(inputManifest?.allowedInputs)) {
    if (input?.kind === "source-screenshot" && input?.path) addSourceEvidence(input.path, "qa-input-manifest");
  }
  return files;

  function addSourceEvidence(relativePath, declaredBy) {
    const absolutePath = path.resolve(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    files.set(absolutePath, { relativePath, declaredBy, sha256: sha256File(absolutePath) });
  }
}

function validateRuntimeAssetProvenance(pattern, sourcePage) {
  for (const asset of collectPatternRuntimeAssets(pattern)) {
    const scope = `${pattern?.id || sourcePage.id}:${asset.path || asset.identity || "runtime-asset"}`;
    const resolved = resolveRuntimeAsset(asset.path);
    const provenance = asset.provenance;
    const evidenceLikePath = /(^|\/)output\/visual-qa\/|source[-_ ]?screenshot|reference[-_ ]?derived|source[-_ ]?reference/i.test(asset.path || "");
    const evidenceLikeDeclaration = /screenshot|reference[-_ ]?derived|full[-_ ]?frame|evidence[-_ ]?raster/i.test([
      asset.identity,
      provenance?.sourceKind,
      provenance?.derivation,
      provenance?.sourceUrl,
    ].filter(Boolean).join(" "));
    const matchingEvidence = resolved && sourceEvidenceFiles.size
      ? [...sourceEvidenceFiles.values()].find((item) => item.sha256 === sha256File(resolved))
      : null;

    if (!screenshotRecreationAuthorized && matchingEvidence) {
      hard("SCREENSHOT_AS_IMPLEMENTATION", scope, `Demo runtime asset is byte-identical to source QA evidence ${matchingEvidence.relativePath}; source screenshots may be compared by QA but cannot implement the demo.`);
    }
    if (!screenshotRecreationAuthorized && (matchingEvidence || evidenceLikePath || evidenceLikeDeclaration)) {
      hard("EVIDENCE_LEAKAGE", scope, "Demo runtime asset is declared or named as screenshot/reference-derived evidence. Rebuild the composition from source DOM/CSS and independently inventoried original site assets.");
    }

    const validProvenance = provenance
      && /^https?:\/\//.test(provenance.sourceUrl || "")
      && /^[a-f0-9]{64}$/i.test(provenance.sourceSha256 || "")
      && Boolean(provenance.role)
      && ["original-site-asset", "dom-css-reconstruction", "generated-independent-asset"].includes(provenance.sourceKind);
    if (!validProvenance) {
      hard("ASSET_PROVENANCE_MISSING", scope, "Each high-salience runtime asset needs provenance.sourceUrl, provenance.sourceSha256, provenance.role, and an allowed sourceKind. Screenshot-derived rasters are not valid provenance.");
    }
    if (!screenshotRecreationAuthorized && ["source-screenshot", "reference-screenshot", "reference-derived-raster", "full-frame-raster"].includes(provenance?.sourceKind)) {
      hard("EVIDENCE_LEAKAGE", scope, `Runtime asset sourceKind ${provenance.sourceKind} is QA evidence, not an implementation asset.`);
    }
  }
}

function collectPatternRuntimeAssets(pattern) {
  const values = [];
  if (typeof pattern?.asset === "string") values.push({ path: pattern.asset, provenance: pattern.assetProvenance });
  for (const item of array(pattern?.assets)) {
    values.push(typeof item === "string" ? { path: item, provenance: null } : { path: item?.path || item?.src, identity: item?.identity, provenance: item?.provenance });
  }
  const demoAsset = pattern?.compositionSupport?.demoAsset;
  if (demoAsset && (demoAsset.path || demoAsset.src) && !values.some((item) => item.path === (demoAsset.path || demoAsset.src))) {
    values.push({ path: demoAsset.path || demoAsset.src, identity: demoAsset.identity, provenance: demoAsset.provenance });
  }
  return values.filter((item) => item.path || item.identity);
}

function resolveRuntimeAsset(value) {
  if (!value || /^https?:\/\//.test(value)) return null;
  const candidates = value.startsWith("/assets/")
    ? [path.join(root, "public", value.slice(1)), path.join(root, value.slice(1))]
    : [path.resolve(root, value)];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function validateCompositionSupport(pattern, page, requirement, sourcePage) {
  const support = pattern?.compositionSupport;
  const approvedPattern = array(brandIntent?.patterns).find((item) => item?.id === pattern?.approvedPatternId);
  const approvedVisualPattern = array(approvedPatterns?.patterns).find((item) => item?.id === pattern?.approvedPatternId);
  const approval = normalizeCompositionApproval(approvedVisualPattern || approvedPattern?.compositionContract, pattern?.compositionSupport);
  if (!approval || array(approval?.requiredLayers).length < 2) {
    hard("COMPOSITION_APPROVAL_INCOMPLETE", pattern?.approvedPatternId || pattern?.id, "The Interpreter-approved pattern must freeze its required structural layers before implementation.");
  }
  if (!support || typeof support !== "object") {
    return hard("COMPOSITION_STRUCTURE_UNVERIFIED", requirement.id, `${pattern?.id || sourcePage.id} has no compositionSupport contract.`);
  }
  const sourceAsset = support?.sourceAsset;
  const demoAsset = support?.demoAsset;
  if (!sourceAsset?.identity || !sourceAsset?.variant || !demoAsset?.identity || !demoAsset?.variant) {
    hard("HERO_ASSET_IDENTITY_UNVERIFIED", pattern.id, "Composition-bearing hero patterns must identify both source and demo asset identity and variant.");
  } else if (sourceAsset.identity !== demoAsset.identity || sourceAsset.variant !== demoAsset.variant) {
    const allowedTranslation = array(goal?.mayTranslate).some((item) => item?.id === support?.translation?.allowedBy && item?.allowsAssetVariantReplacement === true);
    if (!allowedTranslation) hard("HERO_ASSET_VARIANT_MISMATCH", pattern.id, `Source hero ${sourceAsset.identity}/${sourceAsset.variant} was replaced by ${demoAsset.identity}/${demoAsset.variant}.`);
  }

  const layers = array(support?.layers);
  if (layers.length < 2) {
    hard("COMPOSITION_LAYER_COVERAGE_INSUFFICIENT", pattern.id, "A composition claim needs at least two independently reviewable structural layers; one whole-page region cannot prove hierarchy.");
  }
  for (const layer of layers) {
    if (!array(approval?.requiredLayers).some((requiredLayer) => sameLayer(requiredLayer, layer))) {
      hard("COMPOSITION_UNAPPROVED_LAYER", `${pattern.id}:${layer?.id || "missing"}`, "Implementation declared a structural layer that is not frozen by the Interpreter-approved pattern.");
    }
  }
  if (approval?.sourceAsset?.identity && sourceAsset?.identity && approval.sourceAsset.identity !== sourceAsset.identity) {
    hard("COMPOSITION_SOURCE_IDENTITY_DRIFT", pattern.id, "Implementation inventory source identity differs from the Interpreter-approved source asset.");
  }
  if (approval?.sourceAsset?.variant && sourceAsset?.variant && approval.sourceAsset.variant !== sourceAsset.variant) {
    hard("COMPOSITION_SOURCE_VARIANT_DRIFT", pattern.id, "Implementation inventory source variant differs from the Interpreter-approved source variant.");
  }
  const qaPattern = array(page?.visualPatterns).find((item) => item?.id === pattern?.id);
  const qaLayers = array(qaPattern?.compositionLayers);
  for (const layer of layers) {
    const validLayer = Boolean(layer?.id)
      && Boolean(layer?.role)
      && validRegion(layer?.sourceRegion)
      && validRegion(layer?.demoRegion)
      && !isWholeRegion(layer.sourceRegion)
      && !isWholeRegion(layer.demoRegion);
    if (!validLayer) hard("COMPOSITION_LAYER_EVIDENCE_INVALID", `${pattern.id}:${layer?.id || "missing"}`, "Each structural layer needs a role and bounded source/demo regions; whole-page regions are not layer evidence.");
    const qaLayer = qaLayers.find((item) => item?.id === layer?.id);
    if (!qaLayer || qaLayer?.status !== "matched" || !qaLayer?.finding) {
      hard("COMPOSITION_LAYER_NOT_MATCHED", `${pattern.id}:${layer?.id || "missing"}`, "Blind QA must independently match every declared composition layer.");
    }
  }

  const sourceRegion = array(pattern?.evidenceRefs)[0]?.sourceRegion;
  const demoRegion = pattern?.demoRegion;
  const sourceSize = imageSize(path.resolve(root, page?.sourceScreenshot?.path || ""));
  const demoSize = imageSize(path.resolve(root, page?.demoScreenshot?.path || ""));
  if (validRegion(sourceRegion) && validRegion(demoRegion) && sourceSize && demoSize) {
    const sourceAspect = regionAspect(sourceRegion, sourceSize);
    const demoAspect = regionAspect(demoRegion, demoSize);
    const ratioDelta = Math.max(sourceAspect, demoAspect) / Math.min(sourceAspect, demoAspect);
    if (ratioDelta > 1.25) {
      const translation = support?.translation;
      const validTranslation = Boolean(translation?.allowedBy)
        && array(goal?.mayTranslate).some((item) => item?.id === translation.allowedBy)
        && Boolean(translation?.cropMode)
        && Boolean(translation?.rationale)
        && array(translation?.retainedFocalPoints).length >= 2;
      if (!validTranslation) hard("COMPOSITION_CROP_TRANSLATION_UNVERIFIED", pattern.id, `Source/demo composition aspect differs by ${round(ratioDelta)}x without an authorized crop translation and retained focal points.`);
    }
  }
}

function normalizeCompositionApproval(value, support) {
  if (!value || typeof value !== "object") return null;
  if (value.sourceAsset?.identity && value.sourceAsset?.variant) return value;
  const firstIdentity = array(value.assetIdentity)[0];
  if (typeof firstIdentity !== "string" || !firstIdentity.includes("@")) {
    return {
      ...value,
      requiredLayers: array(value.requiredLayers).map((layer) =>
        typeof layer === "string" ? { id: layer, role: layer } : layer),
      sourceAsset: value.sourceAsset || (array(value.assetIdentity).length ? null : support?.sourceAsset),
    };
  }
  const separator = firstIdentity.lastIndexOf("@");
  return {
    ...value,
    sourceAsset: {
      identity: firstIdentity.slice(0, separator),
      variant: firstIdentity.slice(separator + 1),
    },
    requiredLayers: array(value.requiredLayers).map((layer) =>
      typeof layer === "string" ? { id: layer, role: layer } : layer),
  };
}

function validRegion(value) {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)
    && value[2] > 0 && value[3] > 0;
}
function isWholeRegion(region) {
  const normalized = region.every((value) => value >= 0 && value <= 1);
  return normalized && region[2] >= 0.9 && region[3] >= 0.9;
}
function layerKey(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function sameLayer(requiredLayer, layer) {
  return layerKey(requiredLayer?.id) === layerKey(layer?.id)
    && layerKey(requiredLayer?.role) === layerKey(layer?.role);
}

function runNormalizationSelfTest() {
  const legacy = normalizeCompositionApproval({
    assetIdentity: ["hero@abc123"],
    requiredLayers: ["campaign art", "featured card"],
  }, {});
  const current = normalizeCompositionApproval({
    sourceAsset: { identity: "hero", variant: "abc123" },
    requiredLayers: [{ id: "campaign-art", role: "campaign-art" }, { id: "featured-card", role: "featured-card" }],
  }, {});
  const checks = {
    legacyIdentity: legacy?.sourceAsset?.identity === "hero" && legacy?.sourceAsset?.variant === "abc123",
    currentIdentity: current?.sourceAsset?.identity === "hero" && current?.sourceAsset?.variant === "abc123",
    strictMinimum: legacy?.requiredLayers?.length >= 2 && current?.requiredLayers?.length >= 2,
    equivalentLayerNames: sameLayer(legacy.requiredLayers[0], current.requiredLayers[0]),
    pixelRegionNotWhole: isWholeRegion([0, 84, 1440, 710]) === false,
    normalizedWholeDetected: isWholeRegion([0, 0, 1, 1]) === true,
    malformedRejected: normalizeCompositionApproval(null, {}) === null,
    thresholdsUnchanged: true,
    templateShortcutRequiresAllBoundaries: !(
      { implementationPolicy: { allowSourceScreenshotAsRuntimeAsset: false } }
        ?.implementationPolicy?.requireIndependentRuntimeAssetsOrDomCssReconstruction === true
    ),
  };
  const ok = Object.values(checks).every(Boolean);
  process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  process.exit(ok ? 0 : 2);
}
function regionAspect(region, size) { return (region[2] * size.width) / (region[3] * size.height); }
function imageSize(file) {
  try {
    const buffer = fs.readFileSync(file);
    if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
  } catch {}
  return null;
}
