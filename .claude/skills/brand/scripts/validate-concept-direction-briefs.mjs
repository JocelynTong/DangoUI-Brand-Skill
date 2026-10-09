#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHostStartupBaseline } from "./validate-host-startup-baseline.mjs";

export function validateConceptDirectionBriefs(briefs, baseline, brandMod) {
  const errors = [];
  const fail = (code, detail = "") => errors.push(detail ? `${code}:${detail}` : code);
  for (const error of validateHostStartupBaseline(baseline).errors) fail(error);
  if (briefs?.schema !== "concept-direction-briefs/v1") fail("CONCEPT_BRIEF_SCHEMA_INVALID");
  const directions = Array.isArray(briefs?.directions) ? briefs.directions : [];
  if (directions.length !== 3) fail("CONCEPT_BRIEF_THREE_DIRECTIONS_REQUIRED");
  const allowedAssets = new Set((Array.isArray(brandMod?.assets) ? brandMod.assets : []).filter((asset) => asset?.id && asset?.status !== "rejected").map((asset) => asset.id));
  const expectedFields = new Set(Array.isArray(baseline?.resultContentContract?.fields) ? baseline.resultContentContract.fields : []);
  const hostContentContract = baseline?.hostContentContract || {};
  const hostCandidates = new Map((Array.isArray(hostContentContract.visualCandidates) ? hostContentContract.visualCandidates : []).filter((item) => item?.id).map((item) => [item.id, item]));
  if (hostContentContract.derivationSource !== "startup-page-source-and-render" || hostContentContract.userInputRequired !== false || hostContentContract.noCandidateFallback !== "productive-ui") fail("HOST_CONTENT_CONTRACT_REQUIRED");
  const maxRatio = Number(baseline?.expressiveOpportunity?.maxFirstViewportRatio);
  const informationDistribution = baseline?.informationDistributionContract || {};
  const hierarchyContract = baseline?.resultHierarchyContract || {};
  const hierarchyEvidenceIds = new Set((Array.isArray(hierarchyContract.evidence) ? hierarchyContract.evidence : []).map((item) => item?.id).filter(Boolean));
  const forbiddenMetaphors = Array.isArray(informationDistribution.forbiddenMetaphorSubstitutions) ? informationDistribution.forbiddenMetaphorSubstitutions : [];
  if (!Number.isFinite(maxRatio) || maxRatio <= 0 || maxRatio > 0.5) fail("HOST_EXPRESSIVE_VIEWPORT_BUDGET_REQUIRED");
  const signatures = new Set();
  for (const direction of directions) {
    const id = direction?.id || "unknown";
    if (!direction?.id || String(direction?.title || "").trim().length < 3) fail("CONCEPT_BRIEF_IDENTITY_REQUIRED", id);
    if (String(direction?.expressiveThesis || "").trim().length < 40) fail("CONCEPT_BRIEF_EXPRESSIVE_THESIS_SHALLOW", id);
    const mechanisms = Array.isArray(direction?.sourceMechanisms) ? direction.sourceMechanisms : [];
    if (mechanisms.length < 3 || mechanisms.some((item) => !item?.evidenceRef || String(item?.visibleApplication || "").trim().length < 12)) fail("CONCEPT_BRIEF_SOURCE_MECHANISMS_REQUIRED", id);
    const signature = direction?.compositionSignature || {};
    if (![signature.visualCenter, signature.contentEntry, signature.resultPresentation].every((value) => String(value || "").trim())) fail("CONCEPT_BRIEF_COMPOSITION_SIGNATURE_REQUIRED", id);
    else {
      const key = JSON.stringify([signature.visualCenter, signature.contentEntry, signature.resultPresentation]);
      if (signatures.has(key)) fail("CONCEPT_BRIEF_SAME_COMPOSITION", id);
      signatures.add(key);
    }
    const distributionFit = direction?.informationDistributionFit || {};
    if (distributionFit.model !== informationDistribution.model || distributionFit.preservesPreviewUnit !== true || distributionFit.preservesScanOrder !== true || distributionFit.preservesComparisonBehavior !== true || distributionFit.sourceMetaphorSubstitution !== "none") fail("CONCEPT_BRIEF_INFORMATION_DISTRIBUTION_FIT_REQUIRED", id);
    const hierarchyFit = direction?.resultHierarchyFit || {};
    const hierarchyRefs = Array.isArray(hierarchyFit.evidenceRefs) ? hierarchyFit.evidenceRefs : [];
    if (!["peer", "source-evidenced-differentiated"].includes(hierarchyFit.relationship) || hierarchyFit.preservesHostHierarchy !== true || hierarchyFit.unsupportedDifferentiationForbidden !== true || hierarchyRefs.some((ref) => !hierarchyEvidenceIds.has(ref))) fail("CONCEPT_BRIEF_RESULT_HIERARCHY_FIT_REQUIRED", id);
    if (hierarchyFit.relationship === "peer" && (hierarchyFit.resultSpecificEmphasis !== "none" || hierarchyRefs.length !== 0)) fail("CONCEPT_BRIEF_UNSUPPORTED_RESULT_DIFFERENTIATION", id);
    if (hierarchyFit.relationship === "source-evidenced-differentiated" && (hierarchyContract.differentiationAllowed !== true || hierarchyFit.resultSpecificEmphasis === "none" || hierarchyRefs.length === 0)) fail("CONCEPT_BRIEF_RESULT_DIFFERENTIATION_EVIDENCE_REQUIRED", id);
    const signatureText = [direction?.id, direction?.title, signature.visualCenter, signature.contentEntry, signature.resultPresentation].map(normalize).join(" ");
    for (const forbidden of forbiddenMetaphors) {
      const normalized = normalize(forbidden);
      if (normalized && signatureText.includes(normalized)) fail("CONCEPT_BRIEF_FORBIDDEN_METAPHOR_SUBSTITUTION", `${id}:${forbidden}`);
    }
    const productive = direction?.productiveApplication || {};
    if (!Array.isArray(productive.systemRefs) || !productive.systemRefs.length || !Array.isArray(productive.visibleRules) || productive.visibleRules.length < 3 || productive.visibleRules.some((item) => String(item || "").trim().length < 12)) fail("CONCEPT_BRIEF_PRODUCTIVE_APPLICATION_REQUIRED", id);
    const identity = direction?.identityPlan || {};
    if (!Array.isArray(identity.assetIds) || !identity.assetIds.length || identity.assetIds.some((assetId) => !allowedAssets.has(assetId))) fail("CONCEPT_BRIEF_IDENTITY_ASSET_INVALID", id);
    if (!['direct-reference', 'deterministic-composite'].includes(identity.preferredMode) || identity.fallbackMode !== 'deterministic-composite') fail("CONCEPT_BRIEF_IDENTITY_MODE_INVALID", id);
    if (!identity.integrationGeometry || !Array.isArray(identity.integrationEffects) || !['occlusion', 'contact-shadow', 'environment-light'].every((effect) => identity.integrationEffects.includes(effect))) fail("CONCEPT_BRIEF_IDENTITY_INTEGRATION_INCOMPLETE", id);
    const hostContent = direction?.hostContentIntegration || {};
    const bindings = Array.isArray(hostContent.bindings) ? hostContent.bindings : [];
    if (!['scene-object', 'productive-ui', 'hybrid'].includes(hostContent.mode) || !['productive-ui', 'reselect-direction'].includes(hostContent.fallback) || (!bindings.length && !(hostContent.mode === 'productive-ui' && String(hostContent.noSceneContentReason || '').trim().length >= 12))) fail("CONCEPT_BRIEF_HOST_CONTENT_PLAN_REQUIRED", id);
    if (hostContent.generatedPlaceholderIsProof !== false) fail("CONCEPT_BRIEF_HOST_CONTENT_PLACEHOLDER_PROOF_FORBIDDEN", id);
    for (const binding of bindings) {
      const candidate = hostCandidates.get(binding?.candidateId);
      const source = candidate?.sourceSize || {};
      const planned = binding?.plannedCssSize || {};
      const sourceWidth = Number(source.width);
      const sourceHeight = Number(source.height);
      const plannedWidth = Number(planned.width);
      const plannedHeight = Number(planned.height);
      const shortestPlannedEdge = Math.min(plannedWidth, plannedHeight);
      if (!candidate || candidate.readiness !== 'ready' || candidate.hostField !== binding?.hostField) fail("CONCEPT_BRIEF_HOST_CONTENT_CANDIDATE_UNRESOLVED", `${id}:${binding?.candidateId || 'unknown'}`);
      if (binding?.sourceSize && (Number(binding.sourceSize.width) !== sourceWidth || Number(binding.sourceSize.height) !== sourceHeight)) fail("CONCEPT_BRIEF_HOST_CONTENT_SOURCE_DRIFT", `${id}:${binding?.candidateId || 'unknown'}`);
      if (String(binding?.hostField || '').trim().length < 2 || String(binding?.semanticRole || '').trim().length < 8 || !Number.isFinite(sourceWidth) || sourceWidth <= 0 || !Number.isFinite(sourceHeight) || sourceHeight <= 0 || !Number.isFinite(plannedWidth) || plannedWidth <= 0 || !Number.isFinite(plannedHeight) || plannedHeight <= 0 || !['contain', 'native', 'projective'].includes(binding?.fit) || binding?.preserveAspectRatio !== true || String(binding?.containerReason || '').trim().length < 12) fail("CONCEPT_BRIEF_HOST_CONTENT_BINDING_INVALID", `${id}:${binding?.hostField || 'unknown'}`);
      if ([sourceWidth, sourceHeight, plannedWidth, plannedHeight].every((value) => Number.isFinite(value) && value > 0)) {
        const sourceRatio = sourceWidth / sourceHeight;
        const plannedRatio = plannedWidth / plannedHeight;
        if (Math.abs(sourceRatio - plannedRatio) / sourceRatio > 0.015) fail("CONCEPT_BRIEF_HOST_CONTENT_ASPECT_RATIO_DRIFT", `${id}:${binding?.hostField || 'unknown'}`);
      }
      if (!Number.isFinite(Number(candidate?.minimumReadableCssPx)) || shortestPlannedEdge < Number(candidate.minimumReadableCssPx)) fail("CONCEPT_BRIEF_HOST_CONTENT_UNREADABLE", `${id}:${binding?.hostField || 'unknown'}`);
      if (!Number.isInteger(binding?.nestedFrameCount) || binding.nestedFrameCount < 0 || binding.nestedFrameCount > 1) fail("CONCEPT_BRIEF_HOST_CONTENT_NESTED_FRAME", `${id}:${binding?.hostField || 'unknown'}`);
    }
    const content = direction?.resultContentPlan || {};
    const fields = new Set(Array.isArray(content.fields) ? content.fields : []);
    if (expectedFields.size < 3 || [...expectedFields].some((field) => !fields.has(field)) || content.readableRowsRequired !== true || content.anonymousSkeletonsForbidden !== true) fail("CONCEPT_BRIEF_RESULT_CONTENT_INVALID", id);
    if (!Number.isFinite(Number(direction?.peakViewportRatio)) || Number(direction.peakViewportRatio) <= 0 || Number(direction.peakViewportRatio) > maxRatio) fail("CONCEPT_BRIEF_PEAK_BUDGET_EXCEEDED", id);
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], directionCount: directions.length };
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const opt = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; };
  try {
    const file = opt("--file");
    const baselineFile = opt("--baseline");
    const brandModFile = opt("--brand-mod");
    if (![file, baselineFile, brandModFile].every((item) => item && fs.existsSync(item))) throw new Error("CONCEPT_BRIEF_INPUT_REQUIRED");
    const result = validateConceptDirectionBriefs(JSON.parse(fs.readFileSync(file, "utf8")), JSON.parse(fs.readFileSync(baselineFile, "utf8")), JSON.parse(fs.readFileSync(brandModFile, "utf8")));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exit(1);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, errors: [error.message] }, null, 2)}\n`);
    process.exit(1);
  }
}
