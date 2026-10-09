import assert from "node:assert/strict";
import { validateConceptDirectionBriefs as validate } from "./validate-concept-direction-briefs.mjs";

const baseline = {
  schema: "host-startup-baseline/v1",
  derivationSource: "startup-page-scan",
  hostStartupPageSha256: "f".repeat(64),
  primaryTask: "search decks",
  primaryAction: "search",
  pageType: "utility-list",
  productiveFloor: { coreEntry: "search", businessObjectsVisible: ["deck results"], warmReturnState: "settled" },
  expressiveOpportunity: { maxFirstViewportRatio: 0.32 },
  resultContentContract: { mode: "host-schema", fields: ["name", "tags", "author", "favorites", "views"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
  informationDistributionContract: { model: "vertical previewable deck list", previewUnit: { requiredDecisionFields: ["name", "tags", "author"], openRequiredForBasicJudgment: false }, scanOrder: ["search", "deck results"], comparisonBehavior: "compare visible decks before opening an item", forbiddenMetaphorSubstitutions: ["lesson path", "mission board"] },
  resultHierarchyContract: { derivationSource: "startup-page-source-analysis", defaultRelationship: "peer", differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"] },
  navigationShellContract: { derivationSource: "startup-page-source-analysis", mode: "absent", items: [], allowedTreatments: ["native-preserved", "custom-contained", "custom-immersive"], continuityPolicy: "Any full-width navigation surface requires explicit design-host approval." },
  hostContentContract: { derivationSource: "startup-page-source-and-render", userInputRequired: false, noCandidateFallback: "productive-ui", visualCandidates: [{ id: "deck-cover", hostField: "cover", businessRole: "searchable deck identity", sourceFile: "src/data/decks.ts", sourceLocator: "src/data/decks.ts#cover", sourceSha256: "a".repeat(64), sourceSize: { width: 160, height: 220 }, currentCssSize: { width: 80, height: 110 }, minimumReadableCssPx: 72, readiness: "ready", measurement: { status: "measured", source: "rendered-startup-state", selector: ".deck-cover", receiptPath: "measurements.json", receiptSha256: "b".repeat(64) } }] },
  communicationIntent: { framework: "hierarchy-utility-style/v1", hierarchy: { primaryAttention: "search", informativeContent: ["name", "tags", "author"], efficiencyConstraint: "keep search and comparable results visible" }, utility: { mainFunction: "search decks", obviousAction: "search", conventionConstraint: "preserve the previewable deck list" }, style: { sourceConstraint: "use frozen brand evidence rather than generic styling", evaluationMode: "first-impression-comparison-after-product-safety-pass" } },
};
baseline.expressiveOpportunity = { heroEligible: true, reason: "bounded cold-start discovery entry", maxFirstViewportRatio: 0.32 };
const brandMod = { assets: [{ id: "official-card", status: "style-only" }] };
const direction = (id, center, entry, results) => ({
  id,
  title: `Direction ${id}`,
  expressiveThesis: "Use source-backed spatial tension and material contrast to make the first entry memorable without hiding the task.",
  sourceMechanisms: [
    { evidenceRef: "evidence:one", visibleApplication: "Layered dark stage around the first task entry." },
    { evidenceRef: "evidence:two", visibleApplication: "Bright bounded plate frames important controls." },
    { evidenceRef: "evidence:three", visibleApplication: "Card-scale depth continues into result containers." },
  ],
  compositionSignature: { visualCenter: center, contentEntry: entry, resultPresentation: results },
  informationDistributionFit: { model: baseline.informationDistributionContract.model, preservesPreviewUnit: true, preservesScanOrder: true, preservesComparisonBehavior: true, sourceMetaphorSubstitution: "none" },
  resultHierarchyFit: { relationship: "peer", preservesHostHierarchy: true, unsupportedDifferentiationForbidden: true, resultSpecificEmphasis: "none", evidenceRefs: [] },
  productiveApplication: { systemRefs: ["brand-mod", "brand-intent"], visibleRules: ["Dark-to-light layer transition remains visible.", "Search controls use the learned bounded plate hierarchy.", "Result cards continue the source-backed depth rhythm."] },
  identityPlan: { assetIds: ["official-card"], preferredMode: "deterministic-composite", fallbackMode: "deterministic-composite", integrationGeometry: { slot: "hero-card" }, integrationEffects: ["occlusion", "contact-shadow", "environment-light"] },
  hostContentIntegration: { mode: "scene-object", generatedPlaceholderIsProof: false, fallback: "productive-ui", bindings: [{ candidateId: "deck-cover", hostField: "cover", semanticRole: "featured deck identity", plannedCssSize: { width: 80, height: 110 }, fit: "contain", preserveAspectRatio: true, nestedFrameCount: 0, containerReason: "The real deck cover is the scene subject, not evidence pasted into an empty slot." }] },
  resultContentPlan: { fields: ["name", "tags", "author", "favorites", "views"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
  peakViewportRatio: 0.3,
});
const valid = { schema: "concept-direction-briefs/v1", directions: [direction("a", "card-stage", "search-bridge", "vertical-list"), direction("b", "collection-vault", "filter-rail", "mosaic-grid"), direction("c", "battle-table", "command-deck", "stacked-cards")] };
assert.equal(validate(valid, baseline, brandMod).ok, true);
const same = structuredClone(valid); same.directions[2].compositionSignature = same.directions[0].compositionSignature;
assert.ok(validate(same, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_SAME_COMPOSITION")));
const oversized = structuredClone(valid); oversized.directions[0].peakViewportRatio = 0.6;
assert.ok(validate(oversized, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_PEAK_BUDGET_EXCEEDED")));
const grey = structuredClone(valid); grey.directions[0].resultContentPlan.anonymousSkeletonsForbidden = false;
assert.ok(validate(grey, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_RESULT_CONTENT_INVALID")));
const placeholder = structuredClone(valid); placeholder.directions[0].hostContentIntegration.generatedPlaceholderIsProof = true;
assert.ok(validate(placeholder, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_HOST_CONTENT_PLACEHOLDER_PROOF_FORBIDDEN")));
const nested = structuredClone(valid); nested.directions[0].hostContentIntegration.bindings[0].nestedFrameCount = 2;
assert.ok(validate(nested, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_HOST_CONTENT_NESTED_FRAME")));
const unreadable = structuredClone(valid); unreadable.directions[0].hostContentIntegration.bindings[0].plannedCssSize.width = 36;
assert.ok(validate(unreadable, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_HOST_CONTENT_UNREADABLE")));
const invented = structuredClone(valid); invented.directions[0].hostContentIntegration.bindings[0].candidateId = "invented-cover";
assert.ok(validate(invented, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_HOST_CONTENT_CANDIDATE_UNRESOLVED")));
const drift = structuredClone(valid); drift.directions[0].hostContentIntegration.bindings[0].sourceSize = { width: 300, height: 300 };
assert.ok(validate(drift, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_HOST_CONTENT_SOURCE_DRIFT")));
const ratioDrift = structuredClone(valid); ratioDrift.directions[0].hostContentIntegration.bindings[0].plannedCssSize = { width: 100, height: 100 };
assert.ok(validate(ratioDrift, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_HOST_CONTENT_ASPECT_RATIO_DRIFT")));
const forbiddenMetaphor = structuredClone(valid); forbiddenMetaphor.directions[0].id = "lesson-path";
assert.ok(validate(forbiddenMetaphor, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_FORBIDDEN_METAPHOR_SUBSTITUTION")));
const missingDistributionFit = structuredClone(valid); delete missingDistributionFit.directions[0].informationDistributionFit;
assert.ok(validate(missingDistributionFit, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_INFORMATION_DISTRIBUTION_FIT_REQUIRED")));
const inventedFeatured = structuredClone(valid); inventedFeatured.directions[0].resultHierarchyFit.resultSpecificEmphasis = "featured-first";
assert.ok(validate(inventedFeatured, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_UNSUPPORTED_RESULT_DIFFERENTIATION")));
const missingHierarchyFit = structuredClone(valid); delete missingHierarchyFit.directions[0].resultHierarchyFit;
assert.ok(validate(missingHierarchyFit, baseline, brandMod).errors.some((item) => item.startsWith("CONCEPT_BRIEF_RESULT_HIERARCHY_FIT_REQUIRED")));
const missingContract = structuredClone(baseline); delete missingContract.hostContentContract;
assert.ok(validate(valid, missingContract, brandMod).errors.includes("HOST_CONTENT_CONTRACT_REQUIRED"));
const noCandidateBaseline = structuredClone(baseline); noCandidateBaseline.hostContentContract.visualCandidates = [];
const productiveOnly = structuredClone(valid);
for (const item of productiveOnly.directions) item.hostContentIntegration = { mode: "productive-ui", generatedPlaceholderIsProof: false, fallback: "productive-ui", bindings: [], noSceneContentReason: "No verified visual business object exists, so real content remains in the productive result UI." };
assert.equal(validate(productiveOnly, noCandidateBaseline, brandMod).ok, true);
console.log("CONCEPT_DIRECTION_BRIEFS_TEST_PASS");
