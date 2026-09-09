import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const guard = path.resolve("skills/brand/scripts/brand-guard.mjs");

function fixture({ valid, withThirdParty = false, withDisposition = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-evidence-gate-"));
  const migration = path.join(root, "migrations", "fixture");
  const captureDir = path.join(root, "captures");
  fs.mkdirSync(migration, { recursive: true });
  fs.mkdirSync(captureDir, { recursive: true });
  fs.writeFileSync(path.join(captureDir, "before.png"), "before");
  fs.writeFileSync(path.join(captureDir, "after.png"), "after");
  fs.writeFileSync(path.join(migration, "brand-evidence.json"), JSON.stringify(valid ? {
    claims: [{
      id: "menu-open-color",
      status: "observed",
      salience: "high",
      kind: "interaction",
      capture: { path: "captures/after.png" },
      sourceRegion: [0.1, 0.1, 0.2, 0.1],
      visibleDom: { selector: ".menu.is-open", visible: true, boundingBox: { width: 120, height: 32 } },
      computed: { property: "color", value: "#fff507" },
    }],
    thirdPartySeedDispositions: withDisposition ? [{ seedRef: "dembrandt.colors.semantic.primary", status: "validated", evidenceRefs: ["menu-open-color"] }] : [],
  } : { palette: { primary: "#fff507" } }, null, 2));
  if (withThirdParty) fs.writeFileSync(path.join(migration, "third-party-evidence.dembrandt.json"), JSON.stringify({ provider: "dembrandt", candidateHints: { primaryColorSeed: { value: "#fff507" } } }, null, 2));
  fs.writeFileSync(path.join(migration, "action-evidence-v02.json"), JSON.stringify({
    entries: valid ? [{
      selector: ".menu.is-open",
      observedState: "menu-open",
      trigger: "click menu button",
      beforeCapture: "captures/before.png",
      afterCapture: "captures/after.png",
      computedProperty: "color",
      computedValue: "#fff507",
      sourceRule: ".menu.is-open { color: #fff507; }",
    }] : [{
      selector: ".menu.is-open",
      text: "active navigation",
      className: "menu is-open active",
      styles: { backgroundColor: "#fff507" },
    }],
  }, null, 2));
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [guard, "evidence-visibility-gate", "--root", root, "--brand", "fixture", "--strict"], { encoding: "utf8" });
}

function addSemanticIntent(root, semanticClaim) {
  fs.writeFileSync(path.join(root, "migrations", "fixture", "brand-intent.json"), JSON.stringify({
    schema: "brand-intent/vNext",
    semanticClaims: [semanticClaim],
  }, null, 2));
}

test("blocks code-first evidence and semantic state drift", () => {
  const root = fixture({ valid: false });
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.blocking.some((item) => item.id === "screenshot-first-claims"));
  assert.ok(report.blocking.some((item) => item.id === "action-semantic-drift-1"));
});

test("passes screenshot-first visible evidence with exact state and property", () => {
  const root = fixture({ valid: true });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
});

test("blocks imported Dembrandt seeds without Evidence Agent disposition", () => {
  const root = fixture({ valid: true, withThirdParty: true });
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "third-party-seed-dispositions"));
});

test("passes imported Dembrandt seeds after observed-claim disposition", () => {
  const root = fixture({ valid: true, withThirdParty: true, withDisposition: true });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
});

test("blocks Pokémon-style orange promoted directly from a Dembrandt seed", () => {
  const root = fixture({ valid: true, withThirdParty: true, withDisposition: true });
  addSemanticIntent(root, {
    id: "database-orange-primary-action",
    kind: "color",
    status: "approved",
    role: "primary-action-fill",
    origin: "dembrandt-accent-seed",
    evidenceDisposition: "validated",
    evidenceRefs: [],
  });
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "semantic-rendered-chain-database-orange-primary-action"));
  assert.ok(report.blocking.some((item) => item.id === "semantic-candidate-source-database-orange-primary-action"));
});

test("passes ONE PIECE-style local color role bound to rendered state evidence", () => {
  const root = fixture({ valid: true, withThirdParty: true, withDisposition: true });
  const evidenceFile = path.join(root, "migrations", "fixture", "brand-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
  evidence.claims[0].sourcePageId = "home";
  evidence.claims[0].state = "menu-open";
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  addSemanticIntent(root, {
    id: "top-header-menu-open-indicator",
    kind: "color",
    status: "approved",
    role: "top-menu-open-label",
    origin: "rendered-observation",
    evidenceDisposition: "validated",
    evidenceRefs: ["menu-open-color"],
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.checks.some((item) => item.id === "semantic-rendered-chain-top-header-menu-open-indicator" && item.status === "pass"));
});

test("blocks required continuous evidence when the source observation manifest is missing", () => {
  const root = fixture({ valid: true });
  const migration = path.join(root, "migrations", "fixture");
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({
    referencePages: [{ id: "home", core: true }],
    evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["home"] },
  }));
  const result = run(root);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.ok(report.blocking.some((item) => item.id === "source-observation-manifest"));
});

test("passes frozen full-page, playback and end-to-end timeline coverage", () => {
  const root = fixture({ valid: true });
  const migration = path.join(root, "migrations", "fixture");
  const evidencePath = path.join(migration, "brand-evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  evidence.claims[0].sourcePageId = "home";
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(migration, "goal-contract.json"), JSON.stringify({
    referencePages: [{ id: "home", core: true }],
    evidencePolicy: { continuousCaptureRequired: true, requiredPageIds: ["home"] },
  }));
  fs.writeFileSync(path.join(root, "captures", "full.png"), "full");
  fs.writeFileSync(path.join(root, "captures", "playback.gif"), "playback");
  fs.writeFileSync(path.join(root, "captures", "timeline.json"), JSON.stringify({
    meta: { viewport: { height: 100 }, scrollHeight: 300 },
    frames: [{ scrollTop: 0 }, { scrollTop: 100 }, { scrollTop: 200, scrollHeight: 300 }],
  }));
  const hashed = (name) => ({
    path: `captures/${name}`,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "captures", name))).digest("hex"),
  });
  fs.writeFileSync(path.join(migration, "source-observation-manifest.json"), JSON.stringify({
    viewport: { width: 200, height: 100 },
    coverage: { readyForInterpreter: true },
    pages: [{ id: "home", status: "covered", fullPageCapture: hashed("full.png"), continuousCapture: hashed("playback.gif"), timeline: hashed("timeline.json") }],
  }));
  const result = run(root);
  assert.equal(result.status, 0, result.stdout || result.stderr);
});
