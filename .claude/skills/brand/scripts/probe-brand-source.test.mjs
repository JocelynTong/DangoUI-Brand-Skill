#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-light-probe-"));
fs.mkdirSync(path.join(root, "public", "brand-previews"), { recursive: true });
fs.mkdirSync(path.join(root, "migrations", "fixture"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "brand-previews", "registry.json"), JSON.stringify({ brands: [{ id: "fixture", status: "fidelity-pass", migrationRoot: "migrations/fixture", canonicalSources: ["https://example.com/"] }] }));
const fixtureFile = path.join(root, "fixture.json");
const run = (html, extra = []) => { fs.writeFileSync(fixtureFile, JSON.stringify({ "https://example.com/": { html } })); const result = spawnSync(process.execPath, [path.resolve("skills/brand/scripts/probe-brand-source.mjs"), "--brand", "fixture", "--root", root, "--fixture-manifest", fixtureFile, "--write", ...extra], { encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
assert.equal(run("<main><h1>A</h1><img src='/a.png'></main>", ["--bootstrap-approved"]).decision.route, "unchanged");
assert.equal(run("<main><h1>A</h1><img src='/a.png'></main>").decision.route, "unchanged");
assert.equal(run("<main><h1>B</h1><section></section><img src='/b.png'></main>").decision.route, "deep-fingerprint-required");
process.stdout.write("brand light source probe tests passed\n");
