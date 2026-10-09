#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDesignHostRoute as validate } from "./validate-design-host-route.mjs";
import { freezeDesignKnowledge } from "./freeze-design-knowledge.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-route-h5-first-"));
const brand = "test-brand";
const migration = path.join(root, "migrations", brand);
fs.mkdirSync(migration, { recursive: true });
fs.mkdirSync(path.join(root, "src"), { recursive: true });
fs.writeFileSync(path.join(root, "src", "App.vue"), "<template><input aria-label='search'><article>deck result</article></template>");
const sourceSha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "src", "App.vue"))).digest("hex");
const startupFile = path.join(migration, "host-startup-page.json");
fs.writeFileSync(startupFile, JSON.stringify({ schema: "host-startup-page/v1", scope: "startup-page-only", route: "/", sourceFile: "src/App.vue", sourceSha256 }));
const startupSha256 = crypto.createHash("sha256").update(fs.readFileSync(startupFile)).digest("hex");
fs.writeFileSync(path.join(migration, "host-startup-baseline.json"), JSON.stringify({
  schema: "host-startup-baseline/v1", derivationSource: "startup-page-scan", hostStartupPageSha256: startupSha256,
  primaryTask: "search decks", primaryAction: "search", pageType: "utility-list",
  productiveFloor: { coreEntry: "search", businessObjectsVisible: ["deck results"], warmReturnState: "settled" },
  resultContentContract: { mode: "host-schema", fields: ["name", "author", "views"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
  hostContentContract: { derivationSource: "startup-page-source-and-render", userInputRequired: false, noCandidateFallback: "productive-ui", visualCandidates: [] },
  informationDistributionContract: { model: "previewable result list", previewUnit: { requiredDecisionFields: ["name", "author", "views"], openRequiredForBasicJudgment: false }, scanOrder: ["search", "results"], comparisonBehavior: "compare visible result metadata", forbiddenMetaphorSubstitutions: ["lesson path"] },
  resultHierarchyContract: { derivationSource: "startup-page-source-analysis", defaultRelationship: "peer", differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"] },
  navigationShellContract: { derivationSource: "startup-page-source-analysis", mode: "absent", items: [], allowedTreatments: ["native-preserved", "custom-contained", "custom-immersive"], continuityPolicy: "Any full-width navigation surface requires explicit design-host approval." },
  expressiveOpportunity: { heroEligible: true, reason: "bounded cold-start entry", maxFirstViewportRatio: 0.32 },
  communicationIntent: { framework: "hierarchy-utility-style/v1", hierarchy: { primaryAttention: "search", informativeContent: ["name", "author", "views"], efficiencyConstraint: "keep search and results visible" }, utility: { mainFunction: "search decks", obviousAction: "search", conventionConstraint: "preserve search-result-list" }, style: { sourceConstraint: "use frozen brand evidence", evaluationMode: "first-impression-comparison-after-product-safety-pass" } },
}));
const frozen = freezeDesignKnowledge({ skillRoot: path.resolve("skills/brand"), root, brand });
const knowledge = { bundle: frozen.bundle, bundleSha256: frozen.sha256, knowledgeRoot: frozen.knowledgeRoot };
const artifact = (name) => ({ path: name, sha256: "a".repeat(64) });
const direction = (id) => ({ id, artifact: artifact(`${id}.html`), realDataBinding: { inventedDataForbidden: true }, resultHierarchyFit: { relationship: "peer", preservesHostHierarchy: true, unsupportedDifferentiationForbidden: true, resultSpecificEmphasis: "none", evidenceRefs: [] }, brandDesignSystemSha256: "b".repeat(64), knowledgeBundleSha256: frozen.sha256 });
const complete = (gapStatus = "not-required") => ({
  schema: "design-host-route/v3", sequence: "h5-design-system-first",
  imageCapability: gapStatus === "required" ? { status: "available" } : { status: "deferred-until-verified-gap" },
  knowledgeDecision: { status: "ready", path: `migrations/${brand}/design-knowledge-bundle.json`, sha256: frozen.sha256, hostStartupBaselineSha256: frozen.bundle.hostContext.baselineSha256 },
  h5Directions: { status: "ready", producerExecutionId: "/root/h5-producer", directions: [direction("a"), direction("b"), direction("c")] },
  h5QA: { status: "pass", reviewerExecutionId: "/root/h5-qa", resultHierarchyGeometry: { status: "pass", directions: ["a", "b", "c"].map((id) => ({ id, relationship: "peer", measuredItemCount: 3, maxWidthRatio: 1, maxHeightRatio: 1, computedProminenceEqual: true })) } },
  expressiveGapDecision: gapStatus === "required" ? { status: "required", gaps: [{ id: "gap-a", directionId: "a", regionId: "hero", businessPurpose: "clarify deck discovery entry", targetSize: "390x180", currentShortfall: "brand atmosphere is too flat", expectedImprovement: "stronger first-glance hierarchy", noImageFallback: "retain the passing CSS-only H5", mutableAssetSelector: "#hero-art", fixedContainerSelector: "#hero" }] } : { status: "not-required", gaps: [] },
  localizedExpressiveAssets: gapStatus === "required" ? { status: "ready", automaticRetryCount: 0, producerExecutionId: "/root/asset-producer", assets: [{ gapId: "gap-a", toolCallId: "imagegen-a", artifact: artifact("hero.webp"), geometryLock: artifact("geometry-lock.json") }] } : { status: "not-assessed", automaticRetryCount: 0, assets: [] },
  expressiveIntegrationQA: gapStatus === "required" ? { status: "pass", reviewerExecutionId: "/root/integration-qa", geometryPreservation: "pass", geometryLocks: [{ gapId: "gap-a", status: "pass", report: artifact("geometry-lock.json") }] } : { status: "not-required" },
  finalSelection: { status: "selected", selectionSource: "explicit-user", selectedOptionId: "a" },
});

assert.equal(validate(complete(), "before-h5-direction-dispatch", knowledge).ok, true);
assert.equal(validate(complete(), "before-h5-qa", knowledge).ok, true);
assert.equal(validate(complete(), "after-h5-qa", knowledge).ok, true);
assert.equal(validate(complete(), "before-final-selection", knowledge).ok, true);
assert.equal(validate(complete("required"), "before-expressive-dispatch", knowledge).ok, true);
assert.equal(validate(complete("required"), "after-expressive-generation", knowledge).ok, true);
assert.equal(validate(complete("required"), "before-final-selection", knowledge).ok, true);
const earlyImage = complete("required"); earlyImage.imageCapability = { status: "deferred-until-verified-gap" };
assert.ok(validate(earlyImage, "before-expressive-dispatch", knowledge).errors.includes("IMAGE_GENERATION_CAPABILITY_REQUIRED"));
const retry = complete("required"); retry.localizedExpressiveAssets.automaticRetryCount = 1;
assert.ok(validate(retry, "after-expressive-generation", knowledge).errors.includes("LOCAL_EXPRESSIVE_ASSETS_REQUIRED"));
const invented = complete(); invented.h5Directions.directions[0].realDataBinding.inventedDataForbidden = false;
assert.ok(validate(invented, "before-h5-qa", knowledge).errors.includes("H5_DIRECTION_BINDING_INVALID"));
assert.equal(validate(complete(), "before-apply-host", knowledge).ok, true);

fs.rmSync(root, { recursive: true, force: true });
process.stdout.write("h5-first design-host route regression passed\n");
