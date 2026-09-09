#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-design-direction-"));
const validator = path.resolve("skills/brand/scripts/validate-design-direction.mjs");
const run = (data) => {
  const file = path.join(dir, `${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [validator, "--file", file], { encoding: "utf8" });
};
const valid = {
  designObjective: "Keep the campaign recognizable and legible on both target viewports.",
  decisionStatus: "approved",
  inputBindings: {
    goal: { path: "goal-contract.json", sha256: "a".repeat(64) },
    evidence: { path: "brand-evidence.json", sha256: "b".repeat(64) },
    intent: { path: "brand-intent.json", sha256: "c".repeat(64) },
    patterns: { path: "approved-visual-patterns.json", sha256: "d".repeat(64) }
  },
  visualPriorityOrder: ["content visibility and legibility", "background and assets", "composition", "interaction", "geometry", "protocol"],
  sections: [{ id: "hero", firstImpressionGoal: "Campaign identity is immediate.", mustPreserve: ["identity"], mayChange: ["crop"], mustNotDo: ["hide copy"] }],
  highSalienceElements: ["hero background", "hero copy"],
  responsiveStrategyMatrix: [
    { element: "hero background", elementType: "media", strategy: "art-directed-crop", evidenceRefs: ["hero-source"], viewports: ["desktop", "mobile"], mustPreserve: ["focal subject"] },
    { element: "hero copy", elementType: "text", strategy: "responsive-reflow", evidenceRefs: ["hero-copy"], viewports: ["desktop", "mobile"], mustPreserve: ["hierarchy"], minimumReadableSize: "16px" }
  ],
  proofSurfacePlan: { desktopCanvas: "independent", mobileCanvas: "390x844", inspectorPolicy: "outside capture", sourceComparison: "same viewport" }
};
assert.equal(run(valid).status, 0);
assert.notEqual(run({ ...valid, visualPriorityOrder: ["protocol", "visibility", "assets", "composition"] }).status, 0);
assert.notEqual(run({ ...valid, responsiveStrategyMatrix: [{ ...valid.responsiveStrategyMatrix[0], strategy: "responsive" }] }).status, 0);
assert.notEqual(run({ ...valid, proofSurfacePlan: {} }).status, 0);
assert.notEqual(run({ ...valid, highSalienceElements: [...valid.highSalienceElements, "cta"] }).status, 0);
assert.notEqual(run({ ...valid, inputBindings: {} }).status, 0);
console.log("validate-design-direction tests passed");
