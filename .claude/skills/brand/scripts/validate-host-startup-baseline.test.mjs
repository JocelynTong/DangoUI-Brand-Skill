#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateHostStartupBaseline as validate } from "./validate-host-startup-baseline.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "host-startup-baseline-"));
const hostRoot = path.join(root, "host");
const migration = path.join(root, "migrations", "brand");
fs.mkdirSync(path.join(hostRoot, "src", "pages"), { recursive: true });
fs.mkdirSync(migration, { recursive: true });
const sourceFile = path.join(hostRoot, "src", "pages", "home.vue");
fs.writeFileSync(sourceFile, "<template><img class=\"cover\"></template>\n");
const sourceSha256 = sha(sourceFile);
const startupPageFile = path.join(migration, "host-startup-page.json");
const startupPage = { schema: "host-startup-page/v1", hostRoot: "host", route: "/home", sourceFile: "src/pages/home.vue", sourceSha256, scope: "startup-page-only" };
fs.writeFileSync(startupPageFile, JSON.stringify(startupPage));
const hostStartupPageSha256 = sha(startupPageFile);
const receiptFile = path.join(migration, "host-startup-measurements.json");
const receipt = {
  schema: "host-startup-measurements/v1",
  status: "measured",
  hostStartupPageSha256,
  viewport: { width: 375, height: 812 },
  state: "deck-results-loaded",
  candidates: [{
    id: "deck-cover",
    selector: ".deck-card .cover",
    sourceFile: "src/pages/home.vue",
    sourceLocator: "src/pages/home.vue#deck.cover",
    sourceSha256,
    sourceSize: { width: 160, height: 220 },
    currentCssSize: { width: 48, height: 67 },
  }],
};
fs.writeFileSync(receiptFile, JSON.stringify(receipt));
const candidate = {
  id: "deck-cover",
  hostField: "deckCover",
  businessRole: "searchable deck identity",
  sourceFile: "src/pages/home.vue",
  sourceLocator: "src/pages/home.vue#deck.cover",
  sourceSha256,
  sourceSize: { width: 160, height: 220 },
  currentCssSize: { width: 48, height: 67 },
  minimumReadableCssPx: 48,
  readiness: "ready",
  measurement: {
    status: "measured",
    source: "rendered-startup-state",
    selector: ".deck-card .cover",
    receiptPath: path.relative(root, receiptFile),
    receiptSha256: sha(receiptFile),
  },
};
const baseline = {
  schema: "host-startup-baseline/v1",
  derivationSource: "startup-page-scan",
  hostStartupPageSha256,
  primaryTask: "search decks",
  primaryAction: "submit search",
  pageType: "utility-list",
  navigationShellContract: {
    derivationSource: "startup-page-source-analysis",
    mode: "absent",
    items: [],
    allowedTreatments: ["native-preserved", "custom-contained", "custom-immersive"],
    continuityPolicy: "This fixture has no navigation controls; do not invent a navigation shell.",
  },
  productiveFloor: { coreEntry: "search", businessObjectsVisible: ["deck results"], warmReturnState: "settled" },
  resultContentContract: { mode: "host-schema", fields: ["name", "author", "views"], readableRowsRequired: true, anonymousSkeletonsForbidden: true },
  hostContentContract: { derivationSource: "startup-page-source-and-render", userInputRequired: false, noCandidateFallback: "productive-ui", visualCandidates: [candidate] },
  informationDistributionContract: {
    model: "vertical previewable deck list",
    previewUnit: { requiredDecisionFields: ["name", "author", "views"], openRequiredForBasicJudgment: false },
    scanOrder: ["search", "deck results"],
    comparisonBehavior: "compare visible deck identity and statistics before opening",
    forbiddenMetaphorSubstitutions: ["lesson path"],
  },
  resultHierarchyContract: { derivationSource: "startup-page-source-analysis", defaultRelationship: "peer", differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"] },
  expressiveOpportunity: { heroEligible: true, reason: "bounded cold-start discovery entry", maxFirstViewportRatio: 0.32 },
  communicationIntent: {
    framework: "hierarchy-utility-style/v1",
    hierarchy: { primaryAttention: "search", informativeContent: ["deck", "name", "views"], efficiencyConstraint: "search and comparable results remain immediately discoverable" },
    utility: { mainFunction: "search and compare decks", obviousAction: "submit search", conventionConstraint: "preserve the vertical searchable deck list" },
    style: { sourceConstraint: "derive desired attributes from frozen brand evidence", evaluationMode: "first-impression-comparison-after-product-safety-pass" },
  },
};
const options = { root, startupPage, startupPageSha256: hostStartupPageSha256, verifyReceiptFiles: true };

assert.equal(validate(baseline, options).ok, true);

const guessed = structuredClone(baseline);
delete guessed.hostContentContract.visualCandidates[0].measurement;
assert.ok(validate(guessed, options).errors.some((item) => item.startsWith("HOST_CONTENT_MEASUREMENT_STATUS_REQUIRED")));
assert.ok(validate(guessed, options).errors.some((item) => item.startsWith("HOST_CONTENT_MEASUREMENT_RECEIPT_REQUIRED")));

const forgedSource = structuredClone(baseline);
forgedSource.hostContentContract.visualCandidates[0].sourceSha256 = "f".repeat(64);
assert.ok(validate(forgedSource, options).errors.some((item) => item.startsWith("HOST_CONTENT_SOURCE_HASH_MISMATCH")));

const unresolved = structuredClone(baseline);
unresolved.hostContentContract.visualCandidates = [{
  id: "unknown-cover",
  hostField: "deckCover",
  businessRole: "searchable deck identity",
  sourceFile: "src/pages/home.vue",
  sourceLocator: "src/pages/home.vue#deck.cover",
  sourceSha256,
  readiness: "unresolved",
  measurement: { status: "unresolved", source: "rendered-startup-state", reason: "image did not expose intrinsic dimensions" },
}];
assert.equal(validate(unresolved, options).ok, true);

const falseReady = structuredClone(unresolved);
falseReady.hostContentContract.visualCandidates[0].readiness = "ready";
assert.ok(validate(falseReady, options).errors.some((item) => item.startsWith("HOST_CONTENT_READY_WITHOUT_MEASUREMENT")));

const noDistribution = structuredClone(baseline);
delete noDistribution.informationDistributionContract;
assert.ok(validate(noDistribution, options).errors.includes("HOST_INFORMATION_DISTRIBUTION_MODEL_REQUIRED"));

const noHierarchy = structuredClone(baseline);
delete noHierarchy.resultHierarchyContract;
assert.ok(validate(noHierarchy, options).errors.includes("HOST_RESULT_HIERARCHY_CONTRACT_REQUIRED"));

const inventedHierarchy = structuredClone(baseline);
inventedHierarchy.resultHierarchyContract.differentiationAllowed = true;
assert.ok(validate(inventedHierarchy, options).errors.includes("HOST_RESULT_HIERARCHY_EVIDENCE_MISMATCH"));

const driftedStartup = structuredClone(startupPage);
driftedStartup.sourceSha256 = "e".repeat(64);
assert.ok(validate(baseline, { ...options, startupPage: driftedStartup }).errors.includes("HOST_STARTUP_SOURCE_HASH_MISMATCH"));

console.log("HOST_STARTUP_BASELINE_TEST_PASS");

function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
