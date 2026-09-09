#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const validator = new URL("./validate-host-coverage-matrix.mjs", import.meta.url).pathname;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-host-matrix-"));
const write = (name, data) => { const file = path.join(root, name); fs.writeFileSync(file, JSON.stringify(data)); return file; };
const baseCell = { id: "entry-default-filter", route: "/pages/list", branch: "default", state: "default", componentFamily: "filter", viewport: "mobile", decision: "APPLY", selector: ".filter", visualEvidence: "entry.png", verdict: "PASS" };
const run = (matrix) => spawnSync(process.execPath, [validator, "--matrix", write(`${Math.random()}.json`, matrix)], { encoding: "utf8" });

assert.equal(run({ schema: "host-coverage-matrix/v1", defaultEntry: "/pages/list", cells: [baseCell], completionScope: { fullHost: "PASS", denominator: 1, covered: 1 } }).status, 0);
assert.notEqual(run({ schema: "host-coverage-matrix/v1", defaultEntry: "/pages/list", cells: [{ ...baseCell, interactive: true, interactionProbe: { targetSelector: ".filter", hitTestOwner: ".filter", width: 30, height: 44, stateBefore: "closed", stateAfter: "open", restored: true } }] }).status, 0);
assert.notEqual(run({ schema: "host-coverage-matrix/v1", defaultEntry: "/pages/list", cells: [{ ...baseCell, route: "/pages/detail", parentRoute: "/pages/list", launchedFrom: ".item" }] }).status, 0);
assert.notEqual(run({ schema: "host-coverage-matrix/v1", defaultEntry: "/pages/list", cells: [{ ...baseCell, typographyProbe: { script: "CJK", textSample: "中文", computedFontFamily: "Display Latin", computedFontWeight: 800, computedFontSize: "16px", computedLineHeight: "24px", computedLetterSpacing: "2px", latinDisplayOnly: true } }] }).status, 0);
assert.equal(run({ schema: "host-coverage-matrix/v1", defaultEntry: "/pages/list", cells: [baseCell], coverageSummary: { cells: { total: 1, inScope: 1, outOfScopeDeferred: 0, verdicts: { PASS: 1, REWORK: 0 } } } }).status, 0);
const staleSummary = run({ schema: "host-coverage-matrix/v1", defaultEntry: "/pages/list", cells: [baseCell], coverageSummary: { cells: { total: 2, inScope: 2, outOfScopeDeferred: 0, verdicts: { PASS: 1, REWORK: 1 } } } });
assert.notEqual(staleSummary.status, 0);
assert.match(staleSummary.stdout, /COVERAGE_SUMMARY_STALE/);
console.log("host coverage matrix fixtures: PASS");
