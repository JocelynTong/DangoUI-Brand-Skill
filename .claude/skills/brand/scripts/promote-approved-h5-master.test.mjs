#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "approved-master-test-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const trial = path.join(migration, "trials", "v2");
fs.mkdirSync(trial, { recursive: true });
fs.writeFileSync(path.join(trial, "index.html"), "<!doctype html><title>approved</title><nav data-composition-role=\"navigation-shell\" data-navigation-shell-treatment=\"custom-immersive\" data-scene-continuity=\"continuous\"><button data-host-shell-item=\"primary-tab:selecttab-deck\">牌组</button></nav>\n");
fs.writeFileSync(path.join(trial, "qa.json"), `${JSON.stringify({ verdict: "PASS" })}\n`);
fs.writeFileSync(path.join(migration, "host-startup-baseline.json"), `${JSON.stringify({ navigationShellContract: { mode: "required", allowedTreatments: ["native-preserved", "custom-contained", "custom-immersive"], items: [{ id: "primary-tab:selecttab-deck", requiredInDesignPreview: true }] } })}\n`);
fs.writeFileSync(path.join(migration, "design-direction.json"), `${JSON.stringify({
  schema: "brand-design-direction/v1",
  brand,
  status: "frozen",
  selectedOptionId: "a",
  previewArtifact: { path: `migrations/${brand}/h5-directions/direction-a.html`, sha256: "a".repeat(64) },
})}\n`);

const script = path.resolve("skills/brand/scripts/promote-approved-h5-master.mjs");
execFileSync(process.execPath, [script, "--root", root, "--brand", brand, "--artifact", `migrations/${brand}/trials/v2/index.html`]);

const master = JSON.parse(fs.readFileSync(path.join(migration, "approved-master.json")));
const direction = JSON.parse(fs.readFileSync(path.join(migration, "design-direction.json")));
const expected = crypto.createHash("sha256").update(fs.readFileSync(path.join(trial, "index.html"))).digest("hex");
assert.equal(master.status, "approved");
assert.equal(master.artifact.sha256, expected);
assert.equal(direction.previewArtifact.sha256, expected);
assert.equal(direction.implementationAuthority, "approved-master-artifact");
assert.equal(direction.previousSelection.selectedOptionId, "a");
assert.equal(master.navigationShellContract.treatment, "custom-immersive");
assert.deepEqual(master.navigationShellContract.itemIds, ["primary-tab:selecttab-deck"]);

fs.writeFileSync(path.join(trial, "qa.json"), `${JSON.stringify({ verdict: "FAIL" })}\n`);
const failed = spawnSync(process.execPath, [script, "--root", root, "--brand", brand, "--artifact", `migrations/${brand}/trials/v2/index.html`], { encoding: "utf8" });
assert.notEqual(failed.status, 0);
assert.match(failed.stderr, /APPROVED_MASTER_PASSING_QA_REQUIRED/);

fs.writeFileSync(path.join(trial, "qa.json"), `${JSON.stringify({ verdict: "PASS" })}\n`);
fs.writeFileSync(path.join(trial, "index.html"), "<!doctype html><title>missing shell</title>\n");
const missingShell = spawnSync(process.execPath, [script, "--root", root, "--brand", brand, "--artifact", `migrations/${brand}/trials/v2/index.html`], { encoding: "utf8" });
assert.notEqual(missingShell.status, 0);
assert.match(missingShell.stderr, /APPROVED_MASTER_HOST_NAVIGATION_SHELL_ITEM_MISSING/);

console.log("promote-approved-h5-master tests passed");
