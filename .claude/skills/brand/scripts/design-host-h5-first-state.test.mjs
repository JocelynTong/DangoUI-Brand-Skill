#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { collectSystemReferenceCatalog, navigationShellCompletionContract } from "./finalize-h5-direction-stage.mjs";

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
  const sourceCapture = write("captures/source/database.png", "source capture fixture");
  write("brand-evidence.json", JSON.stringify({ claims: [
    { id: "database-shell", sourcePageId: "database", capture: sourceCapture },
    { id: "unrelated-campaign", sourcePageId: "home", capture: { path: "unused-missing-capture.png" } },
  ] }));
  const sourcePatterns = write("approved-visual-patterns.json", JSON.stringify({ patterns: [{ id: "database-only", notFor: ["campaign"] }] }));
  const frozenMod = { componentVariants: [{ id: "rounded-type", title: "Source rounded typography", status: "candidate" }], tokens: { mapped: { "--font-body": "sans-serif" } }, layoutRules: { expressiveBudget: "bounded task accent" } };
  const kitFiles = [write('kit/search.mjs', 'export const search = 1;'), write('kit/search.css', '.search { color: black; }'), write('kit/DESIGN.md', '# Source search\nReference implementation only.')];
  frozenMod.componentKits = [{id:'search',status:'local-component-trial',framework:'vue3',entry:kitFiles[0].path,stylesheet:kitFiles[1].path,designGuide:kitFiles[2].path,files:kitFiles,scope:'Search only'}];
  write("brand-mod.json", JSON.stringify(frozenMod));
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
  assert.deepEqual(h5Dispatch.componentKits[0].files,kitFiles);
  assert.equal(h5Dispatch.componentKits[0].status,'local-component-trial');
  for(const file of kitFiles) assert.deepEqual(h5Dispatch.requiredInputs.find(input=>input.path===file.path),file);
  assert.deepEqual(h5Dispatch.fastDesignHints.completionContract.artifactOrder, ["three complete H5 files", "brand-render-kit.json", "brand-application-plan.json", "design-direction-options.json", "design-host-route.json"]);
  assert.equal(h5Dispatch.fastDesignHints.completionContract.embeddedMetadata.selector, 'script[type="application/json"][data-brand-direction]');
  assert.deepEqual(h5Dispatch.fastDesignHints.completionContract.embeddedMetadata.requiredFields, ["id", "title", "brandMechanisms", "structuralSignature", "interactionRhythm", "communicationHypothesis", "knowledgeRefs", "resultHierarchyFit"]);
  const finalizerCommand = h5Dispatch.fastDesignHints.completionContract.finalizerCommand;
  assert.equal(finalizerCommand[1], path.join(skillRoot, "scripts/finalize-h5-direction-stage.mjs"));
  assert.equal(finalizerCommand[finalizerCommand.indexOf("--receipt") + 1], h5Dispatch.receiptContract.path);
  assert.equal(finalizerCommand[finalizerCommand.indexOf("--root") + 1], root);
  assert.equal(h5Dispatch.receiptContract.orchestratorContinueCommand[3], "--artifact-root");
  assert.deepEqual(h5Dispatch.fastDesignHints.completionContract.systemReferences.entries, collectSystemReferenceCatalog({}, frozenMod));
  assert.match(h5Dispatch.fastDesignHints.completionContract.systemReferences.rule, /Existence is not approval/);
  assert.deepEqual(h5Dispatch.fastDesignHints.completionContract.navigationShell, navigationShellCompletionContract(derivedBaseline.navigationShellContract));
  assert.match(h5Dispatch.fastDesignHints.completionContract.selectionControls.implementation, /aria-pressed/);
  assert.match(h5Dispatch.fastDesignHints.completionContract.selectionControls.disclosure, /aria-controls/);
  assert.match(h5Dispatch.fastDesignHints.completionContract.selectionControls.unavailableData, /never fabricate/);
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
  receipt("/root/h5", [...h5, write("brand-render-kit.json", JSON.stringify({ expressive: { mechanisms: [{ evidenceRef: "database-shell" }, { evidenceRef: "database-shell" }] } })), write("brand-application-plan.json"), write("design-direction-options.json"), { path: `migrations/${brand}/design-host-route.json`, sha256: sha(routeFile) }]);
  assert.equal(manifest().currentStageId, "designVisualQA-1");
  cli("next");
  const qaDispatch = JSON.parse(fs.readFileSync(path.join(root, manifest().stages.find((item) => item.id === manifest().currentStageId).dispatchPath), "utf8"));
  for(const file of kitFiles) assert.deepEqual(qaDispatch.requiredInputs.find(input=>input.path===file.path),file);
  assert.equal(qaDispatch.efficiencyBudget.stageTargetSeconds, 90);
  assert.equal(qaDispatch.efficiencyBudget.stageHardLimitSeconds, null);
  assert.equal(qaDispatch.fastDesignHints.hardLimitSeconds, undefined);
  assert.match(qaDispatch.fastDesignHints.visualEvidence.source, /directions\[\]\.capture/);
  assert.match(qaDispatch.scopeRules.join("\n"), /must not be replaced by another browser render/);
  assert.match(qaDispatch.viewportContract.invariant, /exactly 390x844 CSS pixels/);
  assert.deepEqual(qaDispatch.fastDesignHints.receipt.recordCommand, qaDispatch.receiptContract.recordCommand);
  assert.deepEqual(qaDispatch.userDelivery.requiredFields, ["recommendedDirectionIds", "recommendationReason"]);
  assert.equal(qaDispatch.fastDesignHints.outputContract.h5Audit.statusWhenPassed, "eligible-for-human-review");
  assert.equal(qaDispatch.fastDesignHints.outputContract.routePatch.h5QA.statusWhenPassed, "pass");
  assert.ok(qaDispatch.requiredInputs.some((item) => item.path.endsWith("design-host-h5-mechanical-qa.json")));
  assert.deepEqual(qaDispatch.fastDesignHints.sourceComparison.sourceCaptures, [sourceCapture]);
  assert.ok(qaDispatch.requiredInputs.some(item => item.path === sourcePatterns.path && item.sha256 === sourcePatterns.sha256));
  for (const name of ["brand-evidence.json", "brand-intent.json", "brand-mod.json"]) {
    assert.deepEqual(qaDispatch.requiredInputs.find(item => item.path.endsWith(`/${name}`)), h5Dispatch.requiredInputs.find(item => item.path.endsWith(`/${name}`)), "QA must receive the same frozen source bytes, not fresh or producer-rewritten claims");
  }
  const reviewed = JSON.parse(fs.readFileSync(routeFile, "utf8"));
  reviewed.h5QA = { status: "pass", reviewerExecutionId: "/root/h5-qa", resultHierarchyGeometry: { status: "pass", directions: ["a", "b", "c"].map((id) => ({ id, relationship: "peer", measuredItemCount: 3, maxWidthRatio: 1, maxHeightRatio: 1, computedProminenceEqual: true })) } };
  reviewed.expressiveGapDecision = gapRequired ? { status: "required", gaps: [{ id: "gap-a", directionId: "a", regionId: "hero", businessPurpose: "explain deck discovery", targetSize: "390x180", currentShortfall: "flat hierarchy", expectedImprovement: "stronger entry", noImageFallback: "keep passing H5", mutableAssetSelector: "#hero-art", fixedContainerSelector: "#hero" }] } : { status: "not-required", gaps: [] };
  fs.writeFileSync(routeFile, JSON.stringify(reviewed));
  // A complete QA result after the former 180-second cap is still judged on quality.
  const slowQaManifest = manifest();
  slowQaManifest.stages.find((item) => item.id === slowQaManifest.currentStageId).startedAt = new Date(Date.now() - 215000).toISOString();
  fs.writeFileSync(path.join(migration, "execution-manifest.json"), JSON.stringify(slowQaManifest));
  const qaOutputs = [write("design-host-h5-audit.json", JSON.stringify({ status: "eligible-for-human-review" })), write("design-host-expressive-gap.json", JSON.stringify(reviewed.expressiveGapDecision)), { path: `migrations/${brand}/design-host-route.json`, sha256: sha(routeFile) }];
  const unchangedManifest = fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8");
  for (const badReport of [null, { recommendation: { directionId: "b", rationale: "wrong field" } }, { recommendedDirectionIds: ["unknown"], recommendationReason: "not a real direction" }]) {
    const outputs = [...qaOutputs, ...(badReport ? [write("design-host-visual-qa.json", JSON.stringify(badReport))] : [])];
    const candidate = write("receipts/invalid-qa.json", JSON.stringify({ dispatchId: qaDispatch.dispatchId, stageId: qaDispatch.stageId, role: qaDispatch.role, agentExecutionId: "/root/h5-qa", goalSha256: manifest().goalSha256, verdict: "pass", inputs: qaDispatch.requiredInputs, outputs, blockingFindings: [] }));
    const rejected = spawnSync(process.execPath, [workflow, "record", "--brand", brand, "--root", root, "--receipt", candidate.path], { encoding: "utf8", env: { ...process.env, BRAND_SKILL_ROOT: skillRoot } });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr + rejected.stdout, /HOST_RECOMMENDATION/);
    assert.equal(fs.readFileSync(path.join(migration, "execution-manifest.json"), "utf8"), unchangedManifest, "a rejected QA handoff must not consume the stage or modify deadline");
  }
  receipt("/root/h5-qa", [write("design-host-visual-qa.json", JSON.stringify({ recommendedDirectionIds: ["b"], recommendationReason: "Visible task continuity and hierarchy are strongest in B." })), write("design-host-h5-audit.json", JSON.stringify({ status: "eligible-for-human-review" })), write("design-host-expressive-gap.json", JSON.stringify(reviewed.expressiveGapDecision)), { path: `migrations/${brand}/design-host-route.json`, sha256: sha(routeFile) }]);
  const qaResult = manifest().stages.find((item) => item.id === "designVisualQA-1");
  assert.equal(qaResult.verdict, "pass");
  assert.equal(qaResult.budgetResult.status, "target-exceeded");
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
