#!/usr/bin/env node
import assert from "node:assert/strict";
import { validateDesignHostRoute as validate } from "./validate-design-host-route.mjs";

const artifact = (path) => ({ path, sha256: "a".repeat(64) });
const generated = () => ({
  schema: "design-host-route/v1",
  intent: "image-then-h5",
  decisionOwner: "user",
  technique: "generated",
  imageCapability: { status: "available", checkedBy: "intake" },
  demoImages: { status: "ready", producerExecutionId: "/root/astra", artifacts: [artifact("a.png"), artifact("b.png"), artifact("c.png")] },
  demoVisualReview: { status: "pass", reviewerExecutionId: "/root/image-qa" },
  userDirectionReview: { status: "approved", selectionSource: "explicit-user", selectedOptionIds: ["a"] },
  h5Reconstruction: { status: "ready", producerExecutionId: "/root/h5", artifacts: [artifact("a.html")] },
  h5QA: { status: "pass", reviewerExecutionId: "/root/h5-qa" },
  finalSelection: { status: "selected", selectionSource: "explicit-user", selectedOptionId: "a" },
});

const noTool = generated();
noTool.imageCapability.status = "unavailable";
assert.deepEqual(validate(noTool, "before-concept-dispatch").errors, ["IMAGE_GENERATION_CAPABILITY_REQUIRED"]);

const beforeReview = generated();
beforeReview.demoVisualReview = { status: "pending" };
beforeReview.userDirectionReview = { status: "pending" };
assert.ok(validate(beforeReview, "before-h5-dispatch").errors.includes("DEMO_VISUAL_REVIEW_REQUIRED"));
assert.ok(validate(beforeReview, "before-h5-dispatch").errors.includes("DEMO_USER_DIRECTION_CONFIRMATION_REQUIRED"));

assert.equal(validate(generated(), "before-apply-host").ok, true);

const h5Only = generated();
Object.assign(h5Only, { intent: "h5-only", technique: "existing", imageCapability: { status: "not-required" }, demoImages: { status: "not-required" }, demoVisualReview: { status: "not-required" }, userDirectionReview: { status: "not-required" } });
assert.equal(validate(h5Only, "before-h5-qa").ok, true);

const auto = structuredClone(h5Only);
Object.assign(auto, { intent: "auto", decisionOwner: "brandApplicationDesigner", technique: "none" });
assert.equal(validate(auto, "before-h5-dispatch").ok, true);

const sameQa = generated();
sameQa.h5QA.reviewerExecutionId = sameQa.h5Reconstruction.producerExecutionId;
assert.ok(validate(sameQa, "before-apply-host").errors.includes("H5_QA_NOT_INDEPENDENT"));

const noFinal = generated();
noFinal.finalSelection = { status: "pending" };
assert.ok(validate(noFinal, "before-apply-host").errors.includes("FINAL_DIRECTION_SELECTION_REQUIRED"));

process.stdout.write("design-host route-order validator regression passed\n");
