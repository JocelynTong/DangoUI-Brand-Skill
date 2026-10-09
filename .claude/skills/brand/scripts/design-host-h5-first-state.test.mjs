#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workflow = path.resolve("skills/brand/scripts/brand-subagent-workflow.mjs");
const skillRoot = path.resolve("skills/brand");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function runCase(gapRequired) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `h5-first-state-${gapRequired ? "gap" : "plain"}-`));
  const brand = "fixture";
  const migration = path.join(root, "migrations", brand);
  fs.mkdirSync(migration, { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "App.vue"), "<template><input aria-label='search'><article>deck result</article></template>");
  const write = (name, body = "{}") => { const file = path.join(migration, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); return { path: `migrations/${brand}/${name}`, sha256: sha(file) }; };
  write("goal-contract.json", JSON.stringify({ sealed: true, mode: "design-host", executionProfile: "fast", goalId: `h5-first-${gapRequired}` }));
  for (const name of ["brand-evidence.json", "brand-intent.json", "brand-mod.json"]) write(name);
  write("design-host-preflight.json", JSON.stringify({ schema: "brand-design-host-preflight/v1", verdict: "pass" }));
  const startup = write("host-startup-page.json", JSON.stringify({ schema: "host-startup-page/v1", scope: "startup-page-only", route: "/", sourceFile: "src/App.vue", sourceSha256: sha(path.join(root, "src", "App.vue")) }));
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [workflow, ...args, "--brand", brand, "--root", root], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillRoot } });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const manifest = () => JSON.parse(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"));
  const receipt = (agent, outputs) => {
    const current = manifest().stages.find((item) => item.id === manifest().currentStageId);
    const dispatch = JSON.parse(fs.readFileSync(path.join(root, current.dispatchPath), "utf8"));
    const file = write(`receipts/${current.id}.json`, JSON.stringify({ dispatchId: dispatch.dispatchId, stageId: current.id, role: current.role, agentExecutionId: agent, goalSha256: manifest().goalSha256, verdict: "pass", inputs: dispatch.requiredInputs, outputs, blockingFindings: [] }));
    return cli("record", "--receipt", file.path);
  };

  cli("prepare");
  assert.equal(manifest().currentStageId, "h5DirectionGeneration-1");
  const baselineScaffold = JSON.parse(fs.readFileSync(path.join(migration, "scaffolds", "host-startup-baseline.template.json"), "utf8"));
  assert.equal(baselineScaffold.schema, "host-startup-baseline/v1");
  assert.equal(baselineScaffold.hostContentContract.noCandidateFallback, "productive-ui");
  assert.equal(baselineScaffold.informationDistributionContract.previewUnit.openRequiredForBasicJudgment, false);
  const derivedBaseline = JSON.parse(fs.readFileSync(path.join(migration, "host-startup-baseline.json"), "utf8"));
  assert.equal(derivedBaseline.derivationSource, "startup-page-scan");
  assert.equal(derivedBaseline.hostStartupPageSha256, startup.sha256);
  assert.equal(derivedBaseline.communicationIntent.framework, "hierarchy-utility-style/v1");
  for (const file of ["direction-a.html", "direction-b.html", "direction-c.html"]) assert.ok(fs.existsSync(path.join(migration, "h5-directions", file)));
  assert.ok(manifest().deterministicStartupDiagnosis.durationMs >= 0);
  cli("next");
  const h5Dispatch = JSON.parse(fs.readFileSync(path.join(root, manifest().stages.find((item) => item.id === manifest().currentStageId).dispatchPath), "utf8"));
  assert.deepEqual(h5Dispatch.fastDesignHints.completionContract.artifactOrder, ["three complete H5 files", "brand-render-kit.json", "brand-application-plan.json", "design-direction-options.json", "design-host-route.json"]);
  assert.equal(h5Dispatch.fastDesignHints.completionContract.embeddedMetadata.selector, 'script[type="application/json"][data-brand-direction]');
  assert.deepEqual(h5Dispatch.fastDesignHints.completionContract.embeddedMetadata.requiredFields, ["id", "title", "brandMechanisms", "structuralSignature", "interactionRhythm", "communicationHypothesis", "knowledgeRefs", "resultHierarchyFit"]);
  assert.match(h5Dispatch.fastDesignHints.completionContract.embeddedMetadata.finalizer, /finalize-h5-direction-stage\.mjs/);
  assert.equal(h5Dispatch.fastDesignHints.completionContract.routePatch.h5Directions.directions[0].realDataBinding.inventedDataForbidden, true);
  assert.equal(h5Dispatch.fastDesignHints.completionContract.routePatch.h5Directions.directions[0].resultHierarchyFit.unsupportedDifferentiationForbidden, true);
  assert.match(h5Dispatch.requirements.join("\n"), /do not read validator or test source/);
  assert.match(h5Dispatch.requirements.join("\n"), /list-to-grid/);
  assert.match(h5Dispatch.requirements.join("\n"), /at least three inspectable non-color brand mechanisms/);
  assert.match(h5Dispatch.requirements.join("\n"), /mask the brand name and logo in every rendered direction/);
  assert.match(h5Dispatch.requirements.join("\n"), /every direction must have a source-recognizable first impression/);
  assert.match(h5Dispatch.requirements.join("\n"), /document\.scrollHeight exceeds document\.clientHeight/);
  assert.match(h5Dispatch.assetUsageContract.invariant, /editorial, explanatory, study and motion assets stay supporting/);
  assert.equal(h5Dispatch.viewportContract.coordinateSystem, "CSS pixels");
  assert.equal(h5Dispatch.viewportContract.width, 390);
  assert.equal(h5Dispatch.viewportContract.height, 844);
  assert.equal(h5Dispatch.outputLocationContract.h5Directory, "migrations/<brand>/h5-directions");
  assert.equal(h5Dispatch.outputLocationContract.exactH5Files.length, 3);
  assert.deepEqual(h5Dispatch.fastDesignHints.evaluationFramework.dimensions, ["hierarchy", "utility", "style"]);
  assert.match(h5Dispatch.outputLocationContract.invariant, /public\//);
  const routeFile = path.join(migration, "design-host-route.json");
  const route = JSON.parse(fs.readFileSync(routeFile, "utf8"));
  const h5 = ["a", "b", "c"].map((id) => write(`output/${id}.html`, validMechanicalH5(id)));
  route.h5Directions = { status: "ready", producerExecutionId: "/root/h5", directions: h5.map((artifact, index) => ({ id: ["a", "b", "c"][index], artifact, realDataBinding: { inventedDataForbidden: true }, resultHierarchyFit: { relationship: "peer", preservesHostHierarchy: true, unsupportedDifferentiationForbidden: true, resultSpecificEmphasis: "none", evidenceRefs: [] }, brandDesignSystemSha256: "b".repeat(64), knowledgeBundleSha256: route.knowledgeDecision.sha256 })) };
  fs.writeFileSync(routeFile, JSON.stringify(route));
  receipt("/root/h5", [...h5, write("brand-render-kit.json"), write("brand-application-plan.json"), write("design-direction-options.json"), { path: `migrations/${brand}/design-host-route.json`, sha256: sha(routeFile) }]);
  assert.equal(manifest().currentStageId, "designVisualQA-1");
  cli("next");
  const qaDispatch = JSON.parse(fs.readFileSync(path.join(root, manifest().stages.find((item) => item.id === manifest().currentStageId).dispatchPath), "utf8"));
  assert.equal(qaDispatch.efficiencyBudget.stageTargetSeconds, 90);
  assert.equal(qaDispatch.efficiencyBudget.stageHardLimitSeconds, 180);
  assert.equal(qaDispatch.fastDesignHints.hardLimitSeconds, 180);
  assert.match(qaDispatch.fastDesignHints.visualEvidence.source, /directions\[\]\.capture/);
  assert.match(qaDispatch.scopeRules.join("\n"), /must not be replaced by another browser render/);
  assert.match(qaDispatch.viewportContract.invariant, /exactly 390x844 CSS pixels/);
  assert.match(qaDispatch.fastDesignHints.receipt.recordCommand, /brand-subagent-workflow\.mjs record/);
  assert.ok(qaDispatch.requiredInputs.some((item) => item.path.endsWith("design-host-h5-mechanical-qa.json")));
  const reviewed = JSON.parse(fs.readFileSync(routeFile, "utf8"));
  reviewed.h5QA = { status: "pass", reviewerExecutionId: "/root/h5-qa", resultHierarchyGeometry: { status: "pass", directions: ["a", "b", "c"].map((id) => ({ id, relationship: "peer", measuredItemCount: 3, maxWidthRatio: 1, maxHeightRatio: 1, computedProminenceEqual: true })) } };
  reviewed.expressiveGapDecision = gapRequired ? { status: "required", gaps: [{ id: "gap-a", directionId: "a", regionId: "hero", businessPurpose: "explain deck discovery", targetSize: "390x180", currentShortfall: "flat hierarchy", expectedImprovement: "stronger entry", noImageFallback: "keep passing H5", mutableAssetSelector: "#hero-art", fixedContainerSelector: "#hero" }] } : { status: "not-required", gaps: [] };
  fs.writeFileSync(routeFile, JSON.stringify(reviewed));
  receipt("/root/h5-qa", [write("design-host-h5-audit.json", JSON.stringify({ status: "eligible-for-human-review" })), write("design-host-expressive-gap.json", JSON.stringify(reviewed.expressiveGapDecision)), { path: `migrations/${brand}/design-host-route.json`, sha256: sha(routeFile) }]);
  if (gapRequired) assert.equal(manifest().currentStageId, "expressiveAssetGeneration-1");
  else assert.equal(manifest().status, "awaiting-concept-direction");
  fs.rmSync(root, { recursive: true, force: true });
}

runCase(false);
runCase(true);
process.stdout.write("design-host H5-first conditional state regression passed\n");

function validMechanicalH5(id) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0}main{min-height:1200px;padding:16px}.peer{height:120px;width:100%;margin:12px 0}</style></head><body><main><section><input id="q"><button id="go">Search</button><button id="filter" aria-pressed="false">Filter</button></section><section><article class="peer" data-result-weight="peer">${id}-1</article><article class="peer" data-result-weight="peer">${id}-2</article><article class="peer" data-result-weight="peer">${id}-3</article></section></main><output id="state"></output><script>go.onclick=()=>state.textContent=q.value;filter.onclick=()=>filter.setAttribute('aria-pressed',filter.getAttribute('aria-pressed')!=='true')</script></body></html>`;
}
