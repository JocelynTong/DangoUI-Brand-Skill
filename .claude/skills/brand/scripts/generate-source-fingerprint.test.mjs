#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-fingerprint-"));
const migration = path.join(root, "migrations", "fixture");
fs.mkdirSync(path.join(root, "public", "brand-previews"), { recursive: true });
fs.mkdirSync(path.join(root, "skills", "brand"), { recursive: true });
fs.mkdirSync(migration, { recursive: true });
fs.writeFileSync(path.join(root, "public", "brand-previews", "registry.json"), JSON.stringify({ brands: [{ id: "fixture", status: "fidelity-pass", migrationRoot: "migrations/fixture" }] }));
fs.writeFileSync(path.join(root, "skills", "brand", "workflow-contract.json"), JSON.stringify({ roleContractVersion: "3" }));
fs.writeFileSync(path.join(migration, "source-observation-manifest.json"), JSON.stringify({ pages: [{ id: "home", url: "https://example.com/", title: "Home", fullPageCapture: { path: "home.png", sha256: "render-1" } }] }));
fs.writeFileSync(path.join(migration, "rendered-asset-inventory.json"), JSON.stringify({ assets: [{ id: "home-logo", sourceUrl: "https://example.com/logo.png", sourceSha256: "asset-1", role: "home identity" }] }));
fs.writeFileSync(path.join(migration, "action-evidence.json"), JSON.stringify({ entries: [{ id: "home-menu", sourcePageId: "home", states: ["closed", "open", "closed"] }] }));
const script = path.resolve("skills/brand/scripts/generate-source-fingerprint.mjs");
const result = spawnSync(process.execPath, [script, "--brand", "fixture", "--root", root, "--write", "--bootstrap-approved"], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr);
const payload = JSON.parse(result.stdout);
assert.equal(payload.fingerprint.pages.length, 1);
assert.equal(payload.fingerprint.pages[0].evidenceCompleteness.renderHashes, 1);
assert.equal(payload.fingerprint.pages[0].evidenceCompleteness.assets, 1);
assert.equal(payload.fingerprint.pages[0].evidenceCompleteness.interactions, 1);
assert.ok(fs.existsSync(path.join(migration, "source-fingerprint.json")));
assert.ok(fs.existsSync(path.join(migration, "update-baseline.json")));
process.stdout.write("brand source fingerprint tests passed\n");
