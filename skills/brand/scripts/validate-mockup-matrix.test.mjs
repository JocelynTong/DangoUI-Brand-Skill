#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("./validate-mockup-matrix.mjs", import.meta.url).pathname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-mockup-matrix-"));
const file = path.join(dir, "matrix.json");
const pageTypes = ["brand", "style", "component"];
const bottoms = ["tabbar", "no-tabbar"];
const modes = ["normal", "proof=1", "proof=desktop", "proof=mobile"];
const observations = [];
for (const pageType of pageTypes) for (const bottomChrome of bottoms) for (const mode of modes) {
  observations.push({
    pageType, bottomChrome, mode, viewport: { width: 390, height: 844 },
    indicator: mode === "normal"
      ? { hidden: false, parentRole: "phone", position: "absolute", backgroundSemantics: bottomChrome === "tabbar" ? "matches-tabbar" : "transparent" }
      : { hidden: true },
    geometry: { screenWidthAligned: true, screenRadiusAligned: true, bottomChromeRadiusAligned: true },
    scroll: { scrollHeight: 1600, clientHeight: 760, beforeScrollTop: 0, afterScrollTop: 200, restoredScrollTop: 0, indicatorRectDeltaPx: 0 },
  });
}
fs.writeFileSync(file, JSON.stringify({ observations }));
let result = spawnSync(process.execPath, [script, "--file", file, "--strict"], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr || result.stdout);
assert.equal(JSON.parse(result.stdout).expectedCases, 24);

observations.find((item) => item.pageType === "style" && item.bottomChrome === "tabbar" && item.mode === "normal").geometry.bottomChromeRadiusAligned = false;
fs.writeFileSync(file, JSON.stringify({ observations }));
result = spawnSync(process.execPath, [script, "--file", file, "--strict"], { encoding: "utf8" });
assert.equal(result.status, 2);
assert.ok(JSON.parse(result.stdout).blocking.some((item) => item.code === "MOCKUP_BOTTOM_RADIUS_MISALIGNED"));
fs.rmSync(dir, { recursive: true, force: true });
console.log("validate-mockup-matrix tests passed");
