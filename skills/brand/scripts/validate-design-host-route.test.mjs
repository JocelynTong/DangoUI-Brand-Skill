#!/usr/bin/env node
import assert from "node:assert/strict";
import { validateDesignHostRoute as validate } from "./validate-design-host-route.mjs";

const artifact = (path) => ({ path, sha256: "a".repeat(64) });
const complete = () => ({
  schema: "design-host-route/v2", sequence: "image-demo-first",
  imageCapability: { status: "available" },
  demoImages: { status: "ready", producer: { executionId: "/root/astra", model: "gpt-6-astra", forkTurns: "none", imageToolCalls: ["imagegen-1"] }, artifacts: [artifact("a.png"), artifact("b.png"), artifact("c.png")] },
  demoVisualReview: { status: "pass", reviewerExecutionId: "/root/image-qa" },
  userDirectionReview: { status: "approved", selectionSource: "explicit-user", selectedOptionIds: ["a"] },
  h5Reconstruction: { status: "ready", producerExecutionId: "/root/h5", artifacts: [artifact("a.html")] },
  h5QA: { status: "pass", reviewerExecutionId: "/root/h5-qa" },
  finalSelection: { status: "selected", selectionSource: "explicit-user", selectedOptionId: "a" },
});

assert.equal(validate({ ...complete(), imageCapability: { status: "required" } }, "before-concept-dispatch").ok, true);
assert.ok(validate({ ...complete(), imageCapability: { status: "unavailable" } }, "before-concept-dispatch").errors.includes("IMAGE_GENERATION_CAPABILITY_REQUIRED"));
const noTool = complete(); noTool.demoImages.producer.imageToolCalls = [];
assert.ok(validate(noTool, "after-concept-generation").errors.includes("DEMO_IMAGE_TOOL_EVIDENCE_REQUIRED"));
const wrongModel = complete(); wrongModel.demoImages.producer.model = "gpt-5.6-sol";
assert.ok(validate(wrongModel, "after-concept-generation").errors.includes("DEMO_IMAGE_PRODUCER_MODEL_REQUIRED"));
const noReview = complete(); noReview.demoVisualReview = { status: "pending" }; noReview.userDirectionReview = { status: "pending" };
assert.ok(validate(noReview, "before-h5-dispatch").errors.includes("DEMO_USER_DIRECTION_CONFIRMATION_REQUIRED"));
assert.equal(validate(complete(), "before-apply-host").ok, true);
const noFinal = complete(); noFinal.finalSelection = { status: "pending" };
assert.ok(validate(noFinal, "before-apply-host").errors.includes("FINAL_DIRECTION_SELECTION_REQUIRED"));
process.stdout.write("fixed image-demo-first design-host route regression passed\n");
