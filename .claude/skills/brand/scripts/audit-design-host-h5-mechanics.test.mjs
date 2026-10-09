#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-h5-mechanical-test-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const h5Dir = path.join(migration, "h5-directions");
fs.mkdirSync(h5Dir, { recursive: true });
const directions = ["a", "b", "c"].map((id) => {
  const file = path.join(h5Dir, `direction-${id}.html`);
  fs.writeFileSync(file, html(id));
  return { id, artifact: { path: path.relative(root, file).split(path.sep).join("/"), sha256: sha256(file) } };
});
fs.writeFileSync(path.join(migration, "design-host-route.json"), `${JSON.stringify({ h5Directions: { directions } }, null, 2)}\n`);

try {
  const script = path.resolve("skills/brand/scripts/audit-design-host-h5-mechanics.mjs");
  execFileSync(process.execPath, [script, "--root", root, "--brand", brand], { stdio: "pipe", timeout: 60_000 });
  const report = JSON.parse(fs.readFileSync(path.join(migration, "design-host-h5-mechanical-qa.json"), "utf8"));
  assert.equal(report.verdict, "pass");
  assert.equal(report.directions.length, 3);
  assert.ok(report.directions.every((item) => item.checks.every((check) => check.pass)));
  assert.ok(report.directions.every((item) => item.measurements.resultHierarchy.peerCount === 3));
  console.log("audit-design-host-h5-mechanics test passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

function html(id) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0}main{min-height:1200px;padding:16px}img{width:60px;height:60px}.peer{width:100%;height:120px;margin:12px 0;border:1px solid #ddd}</style></head><body><main><section><img alt="fixture" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='green'/%3E%3C/svg%3E"><input id="q" aria-label="search"><button id="go">Search</button><button id="filter" aria-pressed="false">Filter</button></section><section><article class="peer" data-result-weight="peer">${id} one</article><article class="peer" data-result-weight="peer">${id} two</article><article class="peer" data-result-weight="peer">${id} three</article></section></main><p id="state"></p><script>go.onclick=()=>state.textContent=q.value;filter.onclick=()=>filter.setAttribute('aria-pressed',filter.getAttribute('aria-pressed')!=='true')</script></body></html>`;
}
function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
