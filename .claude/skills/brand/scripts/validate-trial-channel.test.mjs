import assert from "node:assert/strict";
import { createTrialRecord, validateTrialRecord } from "./validate-trial-channel.mjs";

const internal = createTrialRecord({ channel: "internal", id: "internal-1" });
assert.equal(validateTrialRecord(internal).ok, true);
assert.equal(internal.feedbackDestination, "internal-only");
assert.equal(internal.networkSubmission, "disabled");

const publicRecord = createTrialRecord({ channel: "public", id: "public-1" });
assert.equal(validateTrialRecord(publicRecord).ok, true);

const publicLeak = structuredClone(publicRecord);
publicLeak.sourceVisibility = "private";
publicLeak.sensitiveContent.containsInternalUrl = true;
assert.deepEqual(validateTrialRecord(publicLeak).errors, [
  "PUBLIC_SOURCE_REQUIRED",
  "SENSITIVE_FLAG_NOT_CLEARED:containsInternalUrl",
]);

const publicTextLeak = structuredClone(publicRecord);
publicTextLeak.notes = "See /Users/example/private-project and http://service.internal/path";
assert.deepEqual(validateTrialRecord(publicTextLeak).errors, [
  "PUBLIC_CONTENT_PATTERN:LOCAL_PATH",
  "PUBLIC_CONTENT_PATTERN:LOCAL_OR_INTERNAL_HOST",
]);

const invalidPromotion = structuredClone(internal);
invalidPromotion.publicPromotion.requested = true;
assert.deepEqual(validateTrialRecord(invalidPromotion).errors, [
  "PUBLIC_PROMOTION_GATE_MISSING:sanitized",
  "PUBLIC_PROMOTION_GATE_MISSING:reviewed",
  "PUBLIC_PROMOTION_GATE_MISSING:authorized",
]);

const approvedPromotion = structuredClone(internal);
approvedPromotion.publicPromotion = { requested: true, sanitized: true, reviewed: true, authorized: true };
assert.equal(validateTrialRecord(approvedPromotion).ok, true);

console.log("TRIAL_CHANNEL_VALIDATOR_TEST_PASS");
