#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildRenderedCollectorArgs, classifyBrowserFailure } from "./source-capture-policy.mjs";

const defaultArgs = buildRenderedCollectorArgs([]);
assert.deepEqual(defaultArgs, ["--force-browser"]);

const explicitArgs = buildRenderedCollectorArgs([
  "--force-browser",
  "--dark-mode",
  "--width", "390",
  "--height", "844",
  "--page-id", "home-mobile",
]);
assert.equal(explicitArgs.filter((value) => value === "--force-browser").length, 1);
assert.deepEqual(explicitArgs, [
  "--force-browser",
  "--dark-mode",
  "--width", "390",
  "--height", "844",
  "--page-id", "home-mobile",
]);
assert.equal(classifyBrowserFailure("Browser use blocked by site-safety policy"), "ACCESS_POLICY_BLOCKED");
assert.equal(classifyBrowserFailure("navigation timeout"), "BROWSER_RENDERED_EVIDENCE_FAILED");

console.log("source-capture-policy test passed");
