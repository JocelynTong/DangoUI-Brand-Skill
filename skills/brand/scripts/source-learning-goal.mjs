import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validInteractionEvidencePolicy } from './interaction-evidence-policy.mjs';

const fileHash = (file) => { try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; } };

// These are the fixed dimensions consumed by validate-brand-fidelity.mjs.
export const learningRubric = Object.freeze({ composition: 25, assetAuthenticity: 20, colorRoles: 15, informationDensity: 15, typographyGraphics: 10, motionSemantics: 10, brandRecognition: 5 });

export function createSourceLearningGoal({ root, brand, sourceUrl, profile, handoffFile, sourceScreenshot, visualAuthority, interactionEvidence, now = new Date() }) {
  const prefix = `migrations/${brand}/captures/demo`;
  const goal = {
    schema: "brand-goal/v2", goalId: `source-learning-${brand}-${now.getTime()}`, brand,
    mode: "learn-brand", executionProfile: profile, requestKind: "brand-learning", parentRequestKind: "host-concepts",
    goalType: "brand-learning-capability-test", sourceUrl, sealed: true, createdAt: now.toISOString(),
    goal: "Learn the supplied source's reusable visual language, calibrate its structure in an interactive Demo, and independently prove frozen rules on a source-independent held-out page before resuming the parent host concepts.",
    nonGoals: ["website-mirror", "host-apply", "branded-asset-template"],
    parentHandoff: handoffFile, parentHandoffSha256: fileHash(handoffFile),
    scope: { hostSourceReadOnly: true, independentQARequired: true, sourcePageOnly: true, completeBrandCertification: false },
    referencePages: [{ id: "source", url: sourceUrl, core: true, screenshot: sourceScreenshot }],
    demoPages: [
      { id: `${brand}-source-calibration`, mapsToSourcePageId: "source", proofRole: "source-calibration", screenshot: `${prefix}/source-calibration.png`, artifact: `migrations/${brand}/demo/source-calibration.html` },
      { id: `${brand}-held-out`, mapsToSourcePageId: null, proofRole: "generative-held-out", screenshot: `${prefix}/held-out.png`, artifact: `migrations/${brand}/demo/held-out.html` },
    ],
    implementationPolicy: { allowSourceScreenshotAsRuntimeAsset: false, requireIndependentRuntimeAssetsOrDomCssReconstruction: true, requireHighSalienceEvidenceTrace: true },
    evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["source"], requiredVisualDimensions: ["color", "typography", "radius", "spacing", "shadow", "action-color"], requiredPageStates: ["initial", "continuous-scroll", "settled-end"], requiredInteractionStates: ["default", "triggered", "settled", "restored"] },
    mustPreserve: [{ id: "source-structural-hierarchy", requiredOn: ["source"], dimensions: ["composition", "assetAuthenticity", "informationDensity"], description: "Preserve evidence-backed high-salience composition, asset hierarchy, reading order, density and responsive structure." }],
    mayTranslate: [{ id: "responsive-reflow", description: "Only source-backed hierarchy and geometry may reflow under the approved Design Direction." }],
    mustNotReplace: [
      { id: "no-screenshot-runtime", description: "Source screenshots remain evidence, never Demo runtime assets." },
      { id: "no-brand-cue-template", description: "Brand names, colors and official assets cannot substitute for structural rule reuse." },
      { id: "no-unproven-semantic-promotion", description: "Unobserved state or source color cannot become global semantic tokens." },
    ],
    learningProofContract: { evidenceFidelity: { required: true }, structuralFidelity: { required: true }, generativeProof: { required: true }, visibleLearningProof: { required: true }, compensationPolicy: "No proof can compensate for another." },
    rubric: { dimensions: { ...learningRubric }, ratingMin: 0, ratingMax: 4 },
    thresholds: { overall: 80, corePage: 70, dimensionMin: { composition: 3, assetAuthenticity: 3 }, maxAttempts: 1 },
    timeBudget: profile === "fast" ? { profile, targetMinutes: [15, 20], scope: "source-only-direction-validation" } : { profile, targetMinutes: [30, 45], stopOptionalExpansionAtMinutes: 60, blockAtMinutes: 75 },
  };
  if (visualAuthority) {
    goal.evidencePolicy.visualAuthority = visualAuthority;
    goal.evidencePolicy.fullPageRole = 'overview-only';
  }
  if (interactionEvidence !== undefined) {
    goal.evidencePolicy.interactionEvidence = structuredClone(interactionEvidence);
    goal.evidencePolicy.requiredInteractionIds = interactionEvidence?.required?.map(item => item.id);
  }
  const issues = validateSourceLearningGoal(goal, { root, brand, sourceUrl, handoffFile });
  if (issues.length) throw new Error(`SOURCE_LEARNING_GOAL_INCOMPLETE: ${issues.join(", ")}`);
  return goal;
}

// Validate before prepare/next, including legacy sealed goals. Never repair a
// sealed contract in place: its bytes may already bind evidence and receipts.
export function validateSourceLearningGoal(goal, { root, brand, sourceUrl, handoffFile }) {
  const issues = [];
  const require = (condition, field) => { if (!condition) issues.push(field); };
  const list = (value) => Array.isArray(value) ? value : [];
  if (goal?.evidencePolicy?.visualAuthority) require(goal.evidencePolicy.visualAuthority === 'viewport-sequence/v1' && goal.evidencePolicy.fullPageRole === 'overview-only', 'visualAuthority');
  if (goal?.evidencePolicy?.interactionEvidence !== undefined) {
    const policy = goal.evidencePolicy.interactionEvidence;
    require(goal.evidencePolicy.visualAuthority === 'viewport-sequence/v1' && validInteractionEvidencePolicy(policy)
      && JSON.stringify(goal.evidencePolicy.requiredInteractionIds) === JSON.stringify(policy?.required?.map(item => item.id)), 'interactionEvidence');
  }
  const local = (value) => typeof value === "string" && value.length > 0 && path.resolve(root, value).startsWith(`${path.resolve(root)}${path.sep}`);
  require(goal?.schema === "brand-goal/v2" && goal.sealed === true && Boolean(goal.goalId), "sealedGoal");
  require(goal?.brand === brand && goal.mode === "learn-brand" && goal.sourceUrl === sourceUrl, "sourceIdentity");
  require(goal?.requestKind === "brand-learning" && goal.parentRequestKind === "host-concepts" && goal.parentHandoff === handoffFile, "parentHandoff");
  require(/^[a-f0-9]{64}$/.test(goal?.parentHandoffSha256 || '') && goal.parentHandoffSha256 === fileHash(handoffFile), "parentHandoffHash");
  require(["fast", "full"].includes(goal?.executionProfile), "executionProfile");
  require(goal?.goalType === "brand-learning-capability-test", "goalType");
  require(goal?.scope?.hostSourceReadOnly === true && goal?.scope?.independentQARequired === true, "independentLearningScope");
  const pages = list(goal?.referencePages);
  require(pages.length > 0 && pages.some((page) => page.url === sourceUrl && page.core === true), "referencePages");
  require(pages.every((page) => page.id && local(page.screenshot) && fs.existsSync(path.resolve(root, page.screenshot))), "sourceScreenshots");
  const demos = list(goal?.demoPages);
  require(pages.filter((page) => page.core !== false).every((page) => demos.some((demo) => demo.mapsToSourcePageId === page.id && local(demo.screenshot))), "demoCalibrationPages");
  require(demos.some((demo) => demo.proofRole === "generative-held-out" && demo.mapsToSourcePageId === null && local(demo.screenshot)), "heldOutDemoPage");
  require(new Set(demos.map((demo) => demo.id)).size === demos.length && demos.every((demo) => demo.id), "demoPageIds");
  require(["website-mirror", "host-apply", "branded-asset-template"].every((value) => list(goal?.nonGoals).includes(value)), "nonGoals");
  require(goal?.implementationPolicy?.allowSourceScreenshotAsRuntimeAsset === false && goal?.implementationPolicy?.requireIndependentRuntimeAssetsOrDomCssReconstruction === true && goal?.implementationPolicy?.requireHighSalienceEvidenceTrace === true, "implementationPolicy");
  require(goal?.evidencePolicy?.continuousCaptureRequired === true && pages.every((page) => list(goal?.evidencePolicy?.requiredPageIds).includes(page.id)), "evidencePolicy");
  require(["color", "typography", "radius", "spacing", "shadow", "action-color"].every((value) => list(goal?.evidencePolicy?.requiredVisualDimensions).includes(value)), "visualDimensions");
  require(pages.filter((page) => page.core !== false).every((page) => list(goal?.mustPreserve).some((item) => list(item.requiredOn).includes(page.id) && list(item.dimensions).includes("composition"))), "mustPreserve");
  require(list(goal?.mustNotReplace).length > 0, "mustNotReplace");
  require(["evidenceFidelity", "structuralFidelity", "generativeProof", "visibleLearningProof"].every((name) => goal?.learningProofContract?.[name]?.required === true), "learningProofContract");
  require(Object.entries(learningRubric).every(([name, weight]) => goal?.rubric?.dimensions?.[name] === weight) && goal?.rubric?.ratingMin === 0 && goal?.rubric?.ratingMax === 4, "fixedRubric");
  require(Number(goal?.thresholds?.overall) >= 80 && Number(goal?.thresholds?.corePage) >= 70 && Number(goal?.thresholds?.dimensionMin?.composition) >= 3 && Number(goal?.thresholds?.dimensionMin?.assetAuthenticity) >= 3 && goal?.thresholds?.maxAttempts === 1, "qualityThresholds");
  return issues;
}
