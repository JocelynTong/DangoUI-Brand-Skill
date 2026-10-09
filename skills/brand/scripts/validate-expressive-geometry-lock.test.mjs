#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateExpressiveGeometryLock } from "./validate-expressive-geometry-lock.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "expressive-geometry-lock-"));
try {
  const beforeHtml = '<section id="hero" data-expressive-fixed-container="gap-hero"><!-- expressive-asset:gap-hero:start --><img id="hero-art" src="before.webp"><!-- expressive-asset:gap-hero:end --><h1>Real host task</h1></section>';
  const afterHtml = '<section id="hero" data-expressive-fixed-container="gap-hero"><!-- expressive-asset:gap-hero:start --><img id="hero-art" src="after.webp"><!-- expressive-asset:gap-hero:end --><h1>Real host task</h1></section>';
  fs.writeFileSync(path.join(root, "before.html"), beforeHtml);
  fs.writeFileSync(path.join(root, "after.html"), afterHtml);
  const sha = (name) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, name))).digest("hex");
  const stable = crypto.createHash("sha256").update("stable").digest("hex");
  const masked = beforeHtml.replace(/<!-- expressive-asset:gap-hero:start -->[\s\S]*?<!-- expressive-asset:gap-hero:end -->/, '<!-- expressive-asset:gap-hero:start --><!-- MUTABLE_ASSET --><!-- expressive-asset:gap-hero:end -->');
  const structureHash = crypto.createHash("sha256").update(masked).digest("hex");
  const snapshot = { domOrderHash: stable, nonAssetStructureHash: structureHash, productiveBindingHash: stable, resultHierarchyHash: stable, typographyMetricsHash: stable, fixedContainerRect: { x: 0, y: 10, width: 390, height: 180 } };
  const report = {
    schema: "expressive-geometry-lock/v1",
    gapId: "gap-hero", directionId: "a", mutableAssetSelector: "#hero-art", fixedContainerSelector: "#hero",
    tolerancePx: 1, before: snapshot, after: { ...snapshot, fixedContainerRect: { ...snapshot.fixedContainerRect, y: 10.5 } },
    changedSelectors: ["#hero-art"], mutableAssetPixelsChanged: true,
    beforeArtifact: { path: "before.html", sha256: sha("before.html") }, afterArtifact: { path: "after.html", sha256: sha("after.html") }
  };
  assert.equal(validateExpressiveGeometryLock(report, { root }).ok, true);
  const drift = structuredClone(report);
  drift.after.resultHierarchyHash = crypto.createHash("sha256").update("drift").digest("hex");
  assert.ok(validateExpressiveGeometryLock(drift, { root }).errors.includes("EXPRESSIVE_GEOMETRY_RESULTHIERARCHY_DRIFT"));
  const scope = structuredClone(report);
  scope.changedSelectors.push(".result-card");
  assert.ok(validateExpressiveGeometryLock(scope, { root }).errors.includes("EXPRESSIVE_CHANGE_SCOPE_INVALID"));
  fs.writeFileSync(path.join(root, "after.html"), afterHtml.replace("Real host task", "Changed host task"));
  report.afterArtifact.sha256 = sha("after.html");
  assert.ok(validateExpressiveGeometryLock(report, { root }).errors.includes("EXPRESSIVE_NON_ASSET_BYTES_DRIFT"));
  process.stdout.write("EXPRESSIVE_GEOMETRY_LOCK_TEST_PASS\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
