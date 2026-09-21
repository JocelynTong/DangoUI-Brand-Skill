import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeSourceUrl, resolvePublicStylePack } from "./resolve-public-style-pack.mjs";

assert.equal(normalizeSourceUrl("https://TCG.POKEMON.com/en-us/?x=1#cards"), "https://tcg.pokemon.com/en-us");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brand-registry-test-"));
const registryRoot = path.join(fixtureRoot, "public", "brand-registry", "v0.1");
const artifactRoot = path.join(registryRoot, "brands", "demo", "1.0.0");
fs.mkdirSync(artifactRoot, { recursive: true });
fs.writeFileSync(path.join(registryRoot, "index.json"), JSON.stringify({ brands: [{ id: "demo", displayName: "Demo", version: "1.0.0", canonicalSources: ["https://example.com/"], manifest: "/brand-registry/v0.1/brands/demo/1.0.0/manifest.json", reusePolicy: { metadataAndRules: "public" } }] }));
fs.writeFileSync(path.join(registryRoot, "by-source.json"), JSON.stringify({ sources: { "https://example.com/": "demo" } }));
fs.writeFileSync(path.join(artifactRoot, "brand-mod.json"), JSON.stringify({ schema: "brand-mod.v0.1" }));
fs.writeFileSync(path.join(artifactRoot, "approved-visual-patterns.json"), JSON.stringify({ schema: "approved-visual-patterns/v2", patterns: [{ id: "scene" }] }));
fs.mkdirSync(path.join(artifactRoot, "evidence", "captures", "source", "home"), { recursive: true });
fs.writeFileSync(path.join(artifactRoot, "evidence", "captures", "source", "home", "full-page.png"), Buffer.from("png-evidence"));
fs.writeFileSync(path.join(artifactRoot, "manifest.json"), JSON.stringify({
  artifacts: { "brand-mod": "/brand-registry/v0.1/brands/demo/1.0.0/brand-mod.json", "approved-visual-patterns": "/brand-registry/v0.1/brands/demo/1.0.0/approved-visual-patterns.json" },
  evidenceAssets: [{
    path: "/brand-registry/v0.1/brands/demo/1.0.0/evidence/captures/source/home/full-page.png",
    installPath: "captures/source/home/full-page.png",
  }],
}));

const result = await resolvePublicStylePack({ sourceUrl: "https://example.com", root: fixtureRoot, install: true });
assert.equal(result.matched, true);
assert.equal(result.brand, "demo");
assert.equal(result.modFile, "migrations/demo/brand-mod.json");
assert.equal(JSON.parse(fs.readFileSync(path.join(fixtureRoot, result.modFile))).schema, "brand-mod.v0.1");
assert.equal(JSON.parse(fs.readFileSync(path.join(fixtureRoot, "migrations/demo/approved-visual-patterns.json"))).patterns[0].id, "scene");
assert.ok(result.installedFiles.includes("migrations/demo/approved-visual-patterns.json"));
assert.equal(fs.readFileSync(path.join(fixtureRoot, "migrations/demo/captures/source/home/full-page.png"), "utf8"), "png-evidence");
assert.ok(result.installedFiles.includes("migrations/demo/captures/source/home/full-page.png"));

const deepLink = await resolvePublicStylePack({ sourceUrl: "https://demo.example/#/brand/demo/pages/home", root: fixtureRoot });
assert.equal(deepLink.matched, true);
assert.equal(deepLink.brand, "demo");

const missing = await resolvePublicStylePack({ sourceUrl: "https://not-listed.example/", root: fixtureRoot });
assert.equal(missing.matched, false);
assert.equal(missing.reason, "not-found");

console.log("PUBLIC_STYLE_PACK_RESOLVER_TEST_PASS");
