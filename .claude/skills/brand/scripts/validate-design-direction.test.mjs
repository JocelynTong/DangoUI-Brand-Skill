#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-design-direction-"));
const validator = path.resolve("skills/brand/scripts/validate-design-direction.mjs");
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const binding = (name, body) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body);
  return { path: file, sha256: sha256(file) };
};
const run = (data, extraArgs = []) => {
  const file = path.join(dir, `${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [validator, "--file", file, ...extraArgs], { encoding: "utf8" });
};
const valid = {
  designObjective: "Keep the campaign recognizable and legible on both target viewports.",
  decisionStatus: "approved",
  inputBindings: {
    goal: binding("goal-contract.json", "goal"),
    evidence: binding("brand-evidence.json", "evidence"),
    intent: binding("brand-intent.json", "intent"),
    patterns: binding("approved-visual-patterns.json", "patterns")
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
assert.notEqual(run({ ...valid, inputBindings: { ...valid.inputBindings, evidence: { ...valid.inputBindings.evidence, sha256: "0".repeat(64) } } }).status, 0);
const formalFlag = ["--require-learning-proof"];
assert.notEqual(run(valid, formalFlag).status, 0, "source calibration alone must stop before formal Demo dispatch");
const learning = {
  ...valid,
  inputBindings: { ...valid.inputBindings, patterns: binding("learning-patterns.json", JSON.stringify({ patterns: [{ id: "entry", status: "approved", allowedTransformations: ["reflow action stack within entry task"] }] })) },
  generativePlan: { status: "approved", reviewer: "director", scope: "entry-task", variationKind: "structure", variedStructure: "Two observed action units reorganized within the same entry task.", proofArtifactPlan: "Source comparison, new live composition and independent region/state QA.", invariantPatternIds: ["entry"], allowedTransformationRefs: [{ patternId: "entry", transformation: "reflow action stack within entry task" }] }
};
assert.equal(run(learning, formalFlag).status, 0);
assert.notEqual(run({ ...learning, generativePlan: { ...learning.generativePlan, status: "pending" } }, formalFlag).status, 0);
assert.notEqual(run({ ...learning, generativePlan: { ...learning.generativePlan, variationKind: "copy-swap" } }, formalFlag).status, 0);
assert.notEqual(run({ ...learning, generativePlan: { ...learning.generativePlan, invariantPatternIds: ["invented"] } }, formalFlag).status, 0);
assert.notEqual(run({ ...learning, generativePlan: { ...learning.generativePlan, allowedTransformationRefs: [{ patternId: "entry", transformation: "invent a new page role" }] } }, formalFlag).status, 0);
console.log("validate-design-direction tests passed");
