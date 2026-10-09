#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBrandRenderKit } from "./validate-brand-render-kit.mjs";

const brandModRaw = `${JSON.stringify({
  tokens: { mapped: { "--surface-card": { value: "#fff" } } },
  assets: [{ id: "asset-a" }, { id: "asset-b" }],
})}\n`;
const brandModSha256 = crypto.createHash("sha256").update(brandModRaw).digest("hex");
const evidence = { claims: [1, 2, 3].map((n) => ({ id: `evidence:${n}`, sourcePageId: n === 1 ? "home" : "database" })) };
const brandIntent = { patterns: [1, 2, 3].map((n) => ({ id: `system:${n}` })) };
const brandMod = JSON.parse(brandModRaw);
const inputs = { evidence, brandIntent, brandMod, brandModSha256 };

const valid = () => ({
  schema: "brand-render-kit/v1",
  brandSystemSha256: brandModSha256,
  expressive: { mechanisms: [1, 2, 3].map((n) => ({ id: `e${n}`, evidenceRef: `evidence:${n}`, sourcePageRef: n === 1 ? "home" : "database", visibleEffect: `A distinct visible spatial mechanism number ${n}.` })) },
  productive: { rules: [1, 2, 3].map((n) => ({ id: `p${n}`, systemRef: `system:${n}`, visibleApplication: `A visible productive rule application number ${n}.` })) },
  transition: { rules: [1, 2].map((n) => ({ id: `t${n}`, peak: `peak ${n}`, settled: `settled ${n}`, carryThrough: `The visual identity remains continuous through state ${n}.` })) },
  directions: ["stage world", "diagonal portal", "orbit observatory"].map((name, index) => ({ id: String.fromCharCode(97 + index), visualWorld: `A fully distinct ${name} composition`, expressiveMechanismRefs: ["e1", `e${index + 1}`], expressiveSourcePageRefs: index === 0 ? ["home"] : ["database"], productiveRuleRefs: ["p1", `p${index + 1}`], transitionRuleRefs: [`t${index % 2 + 1}`], identityAssetIds: [index === 0 ? "asset-a" : "asset-b"] })),
});

assert.equal(validateBrandRenderKit(valid(), inputs).ok, true);
const duplicateWorld = valid(); duplicateWorld.directions[2].visualWorld = duplicateWorld.directions[0].visualWorld;
assert.ok(validateBrandRenderKit(duplicateWorld, inputs).errors.includes("BRAND_RENDER_KIT_ART_WORLD_DISTANCE_REQUIRED"));
const missingRefs = valid(); missingRefs.directions[0].expressiveMechanismRefs = ["unknown"];
assert.ok(validateBrandRenderKit(missingRefs, inputs).errors.includes("BRAND_RENDER_KIT_DIRECTION_EXPRESSIVE_REFS_INVALID"));
const unknownEvidence = valid(); unknownEvidence.expressive.mechanisms[0].evidenceRef = "unknown-evidence";
assert.ok(validateBrandRenderKit(unknownEvidence, inputs).errors.includes("BRAND_RENDER_KIT_EVIDENCE_REF_INVALID"));
const wrongEvidencePage = valid(); wrongEvidencePage.expressive.mechanisms[0].sourcePageRef = "database";
assert.ok(validateBrandRenderKit(wrongEvidencePage, inputs).errors.includes("BRAND_RENDER_KIT_EVIDENCE_PAGE_MISMATCH"));
const unknownSystem = valid(); unknownSystem.productive.rules[0].systemRef = "invented-system";
assert.ok(validateBrandRenderKit(unknownSystem, inputs).errors.includes("BRAND_RENDER_KIT_PRODUCTIVE_SYSTEM_REF_INVALID"));
const mappedTokenSystem = valid(); mappedTokenSystem.productive.rules[0].systemRef = "mapped.surface-card";
assert.equal(validateBrandRenderKit(mappedTokenSystem, inputs).ok, true);
const wrongHash = valid(); wrongHash.brandSystemSha256 = "a".repeat(64);
assert.ok(validateBrandRenderKit(wrongHash, inputs).errors.includes("BRAND_RENDER_KIT_BRAND_SYSTEM_HASH_MISMATCH"));
const unknownAsset = valid(); unknownAsset.directions[0].identityAssetIds = ["missing-asset"];
assert.ok(validateBrandRenderKit(unknownAsset, inputs).errors.includes("BRAND_RENDER_KIT_DIRECTION_IDENTITY_ASSETS_INVALID"));
assert.ok(validateBrandRenderKit(valid()).errors.includes("BRAND_RENDER_KIT_EVIDENCE_INPUT_REQUIRED"));
const sameSource = valid(); sameSource.directions.forEach((item) => { item.expressiveSourcePageRefs = ["home"]; });
assert.ok(validateBrandRenderKit(sameSource, inputs).errors.includes("BRAND_RENDER_KIT_SOURCE_WORLD_DIVERSITY_REQUIRED"));
const sameAsset = valid(); sameAsset.directions.forEach((item) => { item.identityAssetIds = ["asset-a"]; });
assert.equal(validateBrandRenderKit(sameAsset, inputs).ok, true, "available assets need not be consumed merely to meet a diversity count");
const noIdentityNeeded = valid(); noIdentityNeeded.directions.forEach((item) => { item.identityAssetIds = []; });
assert.equal(validateBrandRenderKit(noIdentityNeeded, inputs).ok, true);

const cliRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brand-render-kit-"));
try {
  const kitFile = path.join(cliRoot, "brand-render-kit.json");
  const evidenceFile = path.join(cliRoot, "brand-evidence.json");
  const intentFile = path.join(cliRoot, "brand-intent.json");
  const modFile = path.join(cliRoot, "brand-mod.json");
  fs.writeFileSync(kitFile, JSON.stringify(valid()));
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence));
  fs.writeFileSync(intentFile, JSON.stringify(brandIntent));
  fs.writeFileSync(modFile, brandModRaw);
  const script = fileURLToPath(new URL("./validate-brand-render-kit.mjs", import.meta.url));
  const run = () => spawnSync(process.execPath, [script, "--file", kitFile, "--evidence", evidenceFile, "--brand-mod", modFile], { encoding: "utf8" });
  const passing = run();
  assert.equal(passing.status, 0, passing.stdout || passing.stderr);
  fs.appendFileSync(modFile, " \n");
  const staleHash = run();
  assert.equal(staleHash.status, 1);
  assert.ok(JSON.parse(staleHash.stdout).errors.includes("BRAND_RENDER_KIT_BRAND_SYSTEM_HASH_MISMATCH"));
} finally {
  fs.rmSync(cliRoot, { recursive: true, force: true });
}
process.stdout.write("validate-brand-render-kit tests passed\n");
