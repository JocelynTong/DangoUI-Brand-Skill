#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const orderedStages = ["before-concept-dispatch", "after-concept-generation", "before-h5-dispatch", "before-h5-qa", "before-final-selection", "before-apply-host"];

export function validateDesignHostRoute(route, stage = "before-concept-dispatch") {
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
  if (at("after-concept-generation")) {
    if (capability !== "available") fail("IMAGE_GENERATION_CAPABILITY_NOT_PROVEN");
    if (images.status !== "ready" || !Array.isArray(images.artifacts) || images.artifacts.length < 3) fail("DEMO_IMAGES_REQUIRED");
    if (!producer.executionId) fail("DEMO_IMAGE_PRODUCER_REQUIRED");
    if (!Array.isArray(producer.imageToolCalls) || !producer.imageToolCalls.length) fail("DEMO_IMAGE_TOOL_EVIDENCE_REQUIRED");
  }
  if (at("before-h5-dispatch")) {
    if (imageReview.status !== "pass" || !imageReview.reviewerExecutionId) fail("DEMO_VISUAL_REVIEW_REQUIRED");
    if (imageReview.reviewerExecutionId === producer.executionId) fail("DEMO_VISUAL_REVIEW_NOT_INDEPENDENT");
    if (imageReview.qualityVerdict !== "pass") fail("DEMO_VISUAL_QUALITY_REQUIRED");
    if (["composition", "brandFidelity", "visualFinish", "hostTaskClarity"].some((criterion) => imageReview.criteria?.[criterion] !== "pass")) fail("DEMO_VISUAL_QUALITY_CRITERIA_REQUIRED");
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

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const fileIndex = process.argv.indexOf("--file");
  const stageIndex = process.argv.indexOf("--stage");
  const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : "";
  const stage = stageIndex >= 0 ? process.argv[stageIndex + 1] : "before-concept-dispatch";
  if (!file || !fs.existsSync(file)) { console.error(JSON.stringify({ ok: false, errors: ["DESIGN_HOST_ROUTE_FILE_REQUIRED"] }, null, 2)); process.exit(2); }
  let route;
  try { route = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { console.error(JSON.stringify({ ok: false, errors: ["DESIGN_HOST_ROUTE_JSON_INVALID"] }, null, 2)); process.exit(2); }
  const result = validateDesignHostRoute(route, stage);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}
