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
  // Installed skill scripts cannot rely on this repository's module ancestry.
  // An explicitly declared runtime must work without a temporary ESM loader.
  const installed = path.join(root, "installed-skill", "scripts");
  fs.mkdirSync(installed, { recursive: true });
  for (const name of ["audit-design-host-h5-mechanics.mjs", "resolve-browser-runtime.mjs", "ensure-extractor-runtime.mjs"]) {
    fs.copyFileSync(path.join(path.dirname(script), name), path.join(installed, name));
  }
  const env = { ...process.env, BRAND_RUNTIME_ROOT: process.cwd() };
  delete env.NODE_OPTIONS;
  execFileSync(process.execPath, [path.join(installed, path.basename(script)), "--root", root, "--brand", brand], { cwd: root, env, stdio: "pipe", timeout: 60_000 });
  assert.equal(JSON.parse(fs.readFileSync(path.join(migration, "design-host-h5-mechanical-qa.json"), "utf8")).verdict, "pass");
  assert.equal(fs.existsSync(path.join(root, "installed-skill", "node_modules")), false);
  // Geometry must not choose a reset or unrelated navigation button before
  // the input's native submitter (including externally associated controls).
  const primaryCases = [
    '<form id="task" onsubmit="event.preventDefault();state.textContent=q.value"><input id="q"><button type="button" onclick="this.form.reset()">Reset</button><button type="reset">Clear</button><button id="go">Search</button></form>',
    '<form id="task" onsubmit="event.preventDefault();state.textContent=q.value"></form><input id="q" form="task"><button onclick="state.textContent=\'navigation\'">Elsewhere</button><button type="reset" form="task">Reset</button><input id="go" type="submit" form="task" value="Search">',
    '<form id="task" onsubmit="event.preventDefault()"><input id="q" oninput="state.textContent=\'typing\'"><button type="button" onclick="state.textContent=\'reset\'">Reset</button><button id="go" type="submit">Search</button></form><button onclick="state.textContent=\'navigation\'">Elsewhere</button>',
  ];
  primaryCases.forEach((markup, index) => {
    const file = path.join(root, directions[index].artifact.path);
    fs.writeFileSync(file, html(String(index))
      .replace('<input id="q" aria-label="search"><button id="go">Search</button>', markup)
      .replace('go.onclick=()=>state.textContent=q.value;', ''));
    directions[index].artifact.sha256 = sha256(file);
  });
  fs.writeFileSync(path.join(migration, "design-host-route.json"), JSON.stringify({ h5Directions: { directions } }));
  assert.throws(() => execFileSync(process.execPath, [script, "--root", root, "--brand", brand], { stdio: "pipe", timeout: 60_000 }), error => error.status === 2);
  const primaryReport = JSON.parse(fs.readFileSync(path.join(migration, "design-host-h5-mechanical-qa.json"), "utf8"));
  primaryReport.directions.forEach((direction, index) => {
    assert.equal(direction.interactionProbe.primary.attempted, true);
    assert.equal(direction.interactionProbe.primary.pass, index !== 2, JSON.stringify(direction.interactionProbe.primary));
    assert.equal(direction.checks.find(check => check.code === "PRIMARY_INTERACTION_WORKS").pass, index !== 2);
  });
  const legacyFile = path.join(root, directions[0].artifact.path);
  fs.writeFileSync(legacyFile, html("legacy")
    .replace('<input id="q" aria-label="search"><button id="go">Search</button>', '<form><input id="q"><button type="reset">Reset</button><div id="go" role="button" tabindex="0">Search</div></form>'));
  directions[0].artifact.sha256 = sha256(legacyFile);
  fs.writeFileSync(path.join(migration, "design-host-route.json"), JSON.stringify({ h5Directions: { directions } }));
  assert.throws(() => execFileSync(process.execPath, [script, "--root", root, "--brand", brand], { stdio: "pipe", timeout: 60_000 }), error => error.status === 2);
  const legacyReport = JSON.parse(fs.readFileSync(path.join(migration, "design-host-h5-mechanical-qa.json"), "utf8"));
  assert.equal(legacyReport.directions[0].interactionProbe.primary.pass, true);
  const runCases = (cases, expected, configure) => {
    cases.forEach((fixture, index) => {
      const file = path.join(root, directions[index].artifact.path);
      fs.writeFileSync(file, html(String(index)).replace('<button id="filter" aria-pressed="false">Filter</button>', fixture.markup).replace("filter.onclick=()=>filter.setAttribute('aria-pressed',filter.getAttribute('aria-pressed')!=='true')", fixture.script || ""));
    });
    directions.forEach(direction => { direction.artifact.sha256=sha256(path.join(root,direction.artifact.path)); });
    fs.writeFileSync(path.join(migration,"design-host-route.json"),JSON.stringify({h5Directions:{directions}}));
    configure?.();
    try { execFileSync(process.execPath, [script, "--root", root, "--brand", brand], { stdio: "pipe", timeout: 60_000 }); }
    catch (error) { assert.equal(error.status, 2); }
    const result = JSON.parse(fs.readFileSync(path.join(migration, "design-host-h5-mechanical-qa.json"), "utf8"));
    result.directions.forEach((direction, index) => {
      assert.equal(direction.interactionProbe.filter.status, expected[index], JSON.stringify(direction.interactionProbe.filter));
      assert.equal(direction.interactionProbe.filter.pass, expected[index] === "verified");
      assert.equal(direction.checks.find(item => item.code === "FILTER_INTERACTION_WORKS").pass, expected[index] === "verified");
    });
    return result;
  };
  const select = '<select aria-label="Category"><option value="all">All</option><option value="known">Known fixture</option></select>';
  const revealed = runCases([
    { markup: select },
    { markup: `<button id="open" aria-expanded="false" aria-controls="panel">Filters</button><div id="panel" hidden>${select}</div>`, script: "document.getElementById('open').onclick=()=>{panel.hidden=!panel.hidden;document.getElementById('open').setAttribute('aria-expanded',!panel.hidden)}" },
    { markup: `<details><summary>Filters</summary>${select}</details>` },
  ], ["verified", "verified", "verified"]);
  assert.equal(revealed.directions[1].measurements.semanticControls.filters, 0);
  assert.equal(revealed.directions[1].checks.find(item => item.code === "FILTER_CONTROLS_PRESENT").pass, true);
  const labeled = runCases([
    { markup: '<div style="display:flex"><input style="position:absolute;opacity:0" id="first" type="radio" name="dim"><label for="first">Category</label><input style="position:absolute;opacity:0" id="second" type="radio" name="dim"><label for="second">Environment</label></div>' },
    { markup: '<details><summary>Filters</summary><input hidden id="check" type="checkbox"><label for="check">Category</label></details>' },
    { markup: '<input id="first" checked type="radio" name="dim"><label for="first">Category</label><input id="second" type="radio" name="dim"><label for="second">Environment</label>' },
  ], ["verified", "verified", "verified"]);
  assert(labeled.directions.every(direction => direction.interactionProbe.filter.controls.every(control => control.status === "verified")));
  const partial = runCases([
    { markup: '<button aria-pressed="false" style="pointer-events:none">Broken</button><input type="checkbox">' },
    { markup: '<button aria-pressed="false">No state change</button><input type="checkbox">' },
    { markup: '<input hidden id="check" type="checkbox"><label for="check" style="pointer-events:none">Blocked label</label><input type="checkbox">' },
  ], ["failed", "failed", "failed"]);
  assert(partial.directions.every(direction => direction.interactionProbe.filter.controls.some(control => control.status === "verified")));
  assert.equal(partial.verdict, "fail");
  runCases([
    { markup: '<button id="filter">Filter</button>', script: "filter.onclick=()=>filter.classList.toggle('active')" },
    { markup: '<button id="filter" aria-pressed="false">Filter</button>', script: "filter.onclick=()=>filter.classList.toggle('loading')" },
    { markup: '<button id="filter" role="tab" aria-selected="false">Tab</button>', script: "filter.onclick=()=>filter.setAttribute('aria-selected','true')" },
  ], ["missing-semantics", "failed", "missing-semantics"]);
  const unavailable = runCases([
    { markup: '<select disabled aria-label="Loading"><option>Loading</option></select>' },
    { markup: '<select aria-label="Category"><option>All</option></select>' },
    { markup: `<button id="open" aria-expanded="false">Filters</button><div id="panel" hidden><select><option>All</option></select></div>`, script: "document.getElementById('open').onclick=()=>{panel.hidden=!panel.hidden;document.getElementById('open').setAttribute('aria-expanded',!panel.hidden)}" },
  ], ["unavailable", "unavailable", "unavailable"]);
  assert.ok(unavailable.directions.every(direction => direction.interactionProbe.filter.attempted === false));
  runCases([
    { markup: `<button aria-expanded="false" aria-controls="panel">Filters</button><div id="panel" hidden>${select}</div>` },
    { markup: `<button id="open" aria-expanded="false">Filters</button><div id="panel" hidden>${select}</div>`, script: "document.getElementById('open').onclick=()=>{panel.hidden=!panel.hidden;document.getElementById('open').setAttribute('aria-expanded',!panel.hidden)}" },
    { markup: `<select><option value="all">All</option><option disabled value="future">Unavailable</option></select>` },
  ], ["unreachable", "verified", "unavailable"]);
  runCases([
    { markup: '<button id="filter" aria-selected="false">Invalid role</button>', script: "filter.onclick=()=>filter.setAttribute('aria-selected','true')" },
    { markup: '<button id="filter" aria-pressed="false" value="idle">Filter</button>', script: "filter.onclick=()=>filter.value='loading'" },
    { markup: `<details><summary>Outer filters</summary><details><summary>Category</summary>${select}</details></details>` },
  ], ["missing-semantics", "failed", "verified"]);
  const sealSchema = (mode="host-schema", tamper=false) => {
    const save=(name,value)=>{const target=path.join(migration,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value));return {path:path.relative(root,target),sha256:sha256(target)};};
    const baseline=save("host-startup-baseline.json",{resultContentContract:{mode}}),goalSha256="a".repeat(64);
    const dispatch=save("dispatch/producer.json",{dispatchId:"dispatch",stageId:"h5DirectionGeneration-1",goalSha256,requiredInputs:[baseline]});
    const outputs=directions.map(direction=>direction.artifact);
    const receipt=save("receipts/producer.json",{stageId:"h5DirectionGeneration-1",dispatchId:"dispatch",goalSha256,inputs:[baseline],outputs});
    save("execution-manifest.json",{mode:"design-host",goalSha256,stages:[{id:"h5DirectionGeneration-1",stage:"h5DirectionGeneration",status:"complete",verdict:"pass",dispatchPath:dispatch.path,dispatchSha256:dispatch.sha256,receiptPath:receipt.path,receiptSha256:receipt.sha256,outputHashes:outputs}]});
    if(tamper)fs.appendFileSync(path.join(root,baseline.path)," ");
  };
  const states=[
    {markup:'<select disabled><option>Options unavailable</option></select>'},
    {markup:'<select><option>Options unavailable</option></select>'},
    {markup:'<button aria-pressed="false" aria-disabled="true">Unavailable</button>'},
  ];
  const schema=runCases(states,["unavailable","unavailable","unavailable"],()=>sealSchema());
  const checks=schema.directions.map(direction=>direction.checks.find(check=>check.code==="FILTER_INTERACTION_WORKS"));
  assert.equal(checks[0].pass,false);assert.equal(checks[0].blocking,false);assert.equal(schema.limitations.length,1);
  assert(schema.blockingFindings.every(finding=>finding.directionId!=="a"));
  assert(schema.blockingFindings.some(finding=>finding.directionId==="b"));assert(schema.blockingFindings.some(finding=>finding.directionId==="c"));
  for(const configure of [()=>sealSchema("real-records"),()=>sealSchema("host-schema",true)]) {
    const strict=runCases(states,["unavailable","unavailable","unavailable"],configure);
    assert.equal(strict.limitations.length,0);assert(strict.blockingFindings.some(finding=>finding.directionId==="a"));
  }
  const allDisabled=runCases(Array(3).fill(states[0]),Array(3).fill("unavailable"),()=>sealSchema());
  assert.equal(allDisabled.verdict,"pass");assert.equal(allDisabled.limitations.length,3);
  assert(allDisabled.directions.every(direction=>direction.verdict==="pass" && direction.interactionProbe.filter.pass===false && direction.interactionProbe.filter.status==="unavailable"));
  const hidden=runCases(Array(3).fill({markup:'<select disabled><option>Unavailable</option></select><div hidden><select disabled><option>Hidden</option></select></div>'}),Array(3).fill("unavailable"),()=>sealSchema());
  assert.equal(hidden.verdict,"fail");assert.equal(hidden.limitations.length,0);
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
