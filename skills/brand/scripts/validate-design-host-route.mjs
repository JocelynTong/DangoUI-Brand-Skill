#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const intents = new Set(["image-then-h5", "h5-only", "auto"]);
const techniques = new Set(["generated", "existing", "none"]);

export function validateDesignHostRoute(route, stage = "current") {
  const errors = [];
  const fail = (code) => errors.push(code);
  if (route?.schema !== "design-host-route/v1") fail("DESIGN_HOST_ROUTE_SCHEMA_INVALID");
  if (!intents.has(route?.intent)) fail("DESIGN_HOST_ROUTE_INTENT_INVALID");
  if (!['user', 'brandApplicationDesigner'].includes(route?.decisionOwner)) fail("DESIGN_HOST_MEDIUM_OWNER_INVALID");
  if (route?.intent === "auto" && route?.decisionOwner !== "brandApplicationDesigner") fail("DESIGN_HOST_MEDIUM_OWNER_DUPLICATED");
  if (route?.intent !== "auto" && route?.decisionOwner !== "user") fail("DESIGN_HOST_EXPLICIT_INTENT_OWNER_INVALID");
  if (route?.technique != null && !techniques.has(route.technique)) fail("DESIGN_HOST_TECHNIQUE_INVALID");
  if (route?.intent === "image-then-h5" && route?.technique !== "generated") fail("REQUESTED_IMAGE_SEQUENCE_REQUIRES_GENERATED");
  if (route?.intent === "h5-only" && route?.technique === "generated") fail("H5_ONLY_CANNOT_USE_GENERATED_ROUTE");

  const capability = route?.imageCapability?.status;
  if (route?.technique === "generated" && capability !== "available") fail("IMAGE_GENERATION_CAPABILITY_REQUIRED");
  if (route?.technique !== "generated" && capability === "required") fail("IMAGE_CAPABILITY_STATE_INVALID");

  const images = route?.demoImages || {};
  const imageReview = route?.demoVisualReview || {};
  const userReview = route?.userDirectionReview || {};
  const h5 = route?.h5Reconstruction || {};
  const h5Qa = route?.h5QA || {};
  const finalSelection = route?.finalSelection || {};
  const generated = route?.technique === "generated";

  if (generated && ["after-concept-generation", "before-concept-review", "before-h5-dispatch", "before-h5-qa", "before-final-selection", "before-apply-host"].includes(stage)) {
    if (images.status !== "ready" || !Array.isArray(images.artifacts) || images.artifacts.length < 3) fail("DEMO_IMAGES_REQUIRED");
  }
  if (generated && ["before-h5-dispatch", "before-h5-qa", "before-final-selection", "before-apply-host"].includes(stage)) {
    if (imageReview.status !== "pass" || !imageReview.reviewerExecutionId) fail("DEMO_VISUAL_REVIEW_REQUIRED");
    if (imageReview.reviewerExecutionId === images.producerExecutionId) fail("DEMO_VISUAL_REVIEW_NOT_INDEPENDENT");
    if (userReview.status !== "approved" || userReview.selectionSource !== "explicit-user" || !Array.isArray(userReview.selectedOptionIds) || !userReview.selectedOptionIds.length) fail("DEMO_USER_DIRECTION_CONFIRMATION_REQUIRED");
  }
  if (!generated && images.status !== "not-required") fail("DEMO_IMAGE_STAGE_MUST_BE_NOT_REQUIRED");

  if (["before-h5-qa", "before-final-selection", "before-apply-host"].includes(stage)) {
    if (h5.status !== "ready" || !Array.isArray(h5.artifacts) || !h5.artifacts.length) fail("H5_RECONSTRUCTION_REQUIRED");
  }
  if (["before-final-selection", "before-apply-host"].includes(stage)) {
    if (h5Qa.status !== "pass" || !h5Qa.reviewerExecutionId) fail("H5_QA_REQUIRED");
    if (h5Qa.reviewerExecutionId === h5.producerExecutionId) fail("H5_QA_NOT_INDEPENDENT");
  }
  if (stage === "before-apply-host") {
    if (finalSelection.status !== "selected" || finalSelection.selectionSource !== "explicit-user" || !finalSelection.selectedOptionId) fail("FINAL_DIRECTION_SELECTION_REQUIRED");
  }
  return { ok: errors.length === 0, errors, stage, route: route?.technique || "pending" };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const fileIndex = process.argv.indexOf("--file");
  const stageIndex = process.argv.indexOf("--stage");
  const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : "";
  const stage = stageIndex >= 0 ? process.argv[stageIndex + 1] : "current";
  if (!file || !fs.existsSync(file)) {
    console.error(JSON.stringify({ ok: false, errors: ["DESIGN_HOST_ROUTE_FILE_REQUIRED"] }, null, 2));
    process.exit(2);
  }
  let route;
  try { route = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch {
    console.error(JSON.stringify({ ok: false, errors: ["DESIGN_HOST_ROUTE_JSON_INVALID"] }, null, 2));
    process.exit(2);
  }
  const result = validateDesignHostRoute(route, stage);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}
