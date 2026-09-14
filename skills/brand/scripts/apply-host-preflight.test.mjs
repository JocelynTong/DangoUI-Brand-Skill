#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runApplyHostPreflight } from "./apply-host-preflight.mjs";

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "brand-apply-preflight-"));
const migration = path.join(fixture, "migrations/demo");
const host = path.join(fixture, "frontend");
fs.mkdirSync(path.join(migration, "captures/source/home"), { recursive: true });
fs.mkdirSync(path.join(host, "src"), { recursive: true });
fs.writeFileSync(path.join(host, "package.json"), JSON.stringify({ dependencies: {} }));
fs.writeFileSync(path.join(migration, "brand-mod.json"), "{}");
fs.writeFileSync(path.join(migration, "brand-evidence.json"), JSON.stringify({ capture: { path: "captures/source/home/full-page.png" } }));
fs.writeFileSync(path.join(migration, "brand-intent.json"), "{}");
fs.writeFileSync(path.join(migration, "captures/source/home/full-page.png"), "png");

const fast = runApplyHostPreflight({ root: fixture, brand: "demo", hostTarget: "frontend", profile: "fast" });
assert.equal(fast.verdict, "pass");
assert.equal(fast.frozenPack.reuseDecision, "reuse-without-relearning");
assert.equal(fast.frozenPack.referencedEvidenceCount, 1);
assert.equal(fast.runtime.maximumClaim, "PARTIAL_STYLE_ONLY");

const certification = runApplyHostPreflight({ root: fixture, brand: "demo", hostTarget: "frontend", profile: "certification", write: false });
assert.equal(certification.verdict, "blocked");
assert.ok(certification.blocking.includes("FROZEN_PACK_FILE_MISSING:component-mapping.json"));
assert.ok(certification.blocking.includes("DANGOUI_RUNTIME_NOT_DECLARED"));

fs.unlinkSync(path.join(migration, "captures/source/home/full-page.png"));
const missingEvidence = runApplyHostPreflight({ root: fixture, brand: "demo", hostTarget: "frontend", profile: "fast", write: false });
assert.equal(missingEvidence.verdict, "blocked");
assert.ok(missingEvidence.blocking.some((item) => item.startsWith("FROZEN_EVIDENCE_MISSING:")));
console.log("APPLY_HOST_PREFLIGHT_TEST_PASS");
