import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-section-gate-"));
fs.writeFileSync(path.join(root, "source.png"), "source");
fs.writeFileSync(path.join(root, "demo.png"), "demo");
const manifest = {
  sections: [{
    id: "events", pageId: "home", status: "pass",
    sourceCapture: "source.png", demoCapture: "demo.png",
    sourceViewport: { width: 390, height: 844 }, demoViewport: { width: 390, height: 844 },
    sourceRegion: { x: 0, y: 0, width: 1, height: 0.2 }, demoRegion: { x: 0, y: 0, width: 1, height: 0.2 },
    requiredLayers: [{ id: "frame", sourceSelector: ".source", demoSelector: ".demo", status: "pass" }],
    readingOrder: ["title", "items"], responsiveBehavior: { status: "pass" },
    assetRefs: [{ sourceUrl: "https://example.com/frame.webp", sourceSha256: "abc", status: "pass" }],
    interactionChecks: [], horizontalOverflow: false, usesItemCountAsStructureProxy: false
  }]
};
fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest));
const script = path.resolve("skills/brand/scripts/validate-section-fidelity.mjs");
const pass = spawnSync(process.execPath, [script, "--file", "manifest.json", "--strict"], { cwd: root, encoding: "utf8" });
assert.equal(pass.status, 0, pass.stdout + pass.stderr);
manifest.sections[0].usesItemCountAsStructureProxy = true;
fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest));
const fail = spawnSync(process.execPath, [script, "--file", "manifest.json", "--strict"], { cwd: root, encoding: "utf8" });
assert.equal(fail.status, 1);
assert.match(fail.stdout, /SECTION_STRUCTURE_NOT_COUNT_PROXY/);
console.log("validate-section-fidelity tests passed");
