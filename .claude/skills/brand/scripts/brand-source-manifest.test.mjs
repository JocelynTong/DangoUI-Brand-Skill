#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-source-manifest-"));
fs.mkdirSync(path.join(root, "public/brand-previews"), { recursive: true });
fs.mkdirSync(path.join(root, "migrations/demo"), { recursive: true });
fs.writeFileSync(path.join(root, "public/brand-previews/registry.json"), JSON.stringify({ brands: [{ id: "demo", migrationRoot: "migrations/demo", sourceUrl: "https://example.com/", canonicalSources: ["https://example.com/"] }] }));
fs.writeFileSync(path.join(root, "migrations/demo/source-observation-manifest.json"), JSON.stringify({ sourceUrl: "https://example.com/", pages: [{ id: "home", url: "https://example.com/" }, { id: "news", url: "https://example.com/news/" }] }));

const script = new URL("./brand-source-manifest.mjs", import.meta.url).pathname;
let result = run("rebuild", "--brand", "demo", "--root", root);
assert.equal(result.status, 0, result.stdout + result.stderr);
let manifest = JSON.parse(fs.readFileSync(path.join(root, "migrations/demo/source-manifest.json"), "utf8"));
assert.deepEqual(manifest.sources.map((source) => source.url), ["https://example.com/", "https://example.com/news"]);
assert.deepEqual(manifest.sources[0].pageIds, ["home", "registry-canonical", "registry-root", "source-root"]);

result = run("merge", "--brand", "demo", "--root", root, "--source-url", "https://example.com/about/");
assert.equal(result.status, 0, result.stdout + result.stderr);
manifest = JSON.parse(fs.readFileSync(path.join(root, "migrations/demo/source-manifest.json"), "utf8"));
assert.equal(manifest.sources.length, 3);

manifest.sources = manifest.sources.filter((source) => !source.url.endsWith("/news"));
fs.writeFileSync(path.join(root, "migrations/demo/source-manifest.json"), JSON.stringify(manifest));
result = run("validate", "--brand", "demo", "--root", root);
assert.equal(result.status, 1);
assert.equal(JSON.parse(result.stdout).code, "LEARNED_SOURCE_DROPPED");
console.log("brand-source-manifest tests passed");

function run(...args) { return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" }); }
