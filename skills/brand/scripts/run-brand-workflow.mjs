#!/usr/bin/env node
import { validateHostExpression } from './validate-host-expression.mjs';
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
import { installComponentKits } from './install-component-kit.mjs';
import { componentHandoff } from './component-handoff.mjs';
import { componentTask } from './component-task.mjs';
import { prepareModuleTask } from './prepare-module-task.mjs';
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePublicStylePack, brandFromDemoUrl } from "./resolve-public-style-pack.mjs";
import { runCachedValidator } from "./validator-cache.mjs";
import { buildRenderedCollectorArgs } from "./source-capture-policy.mjs";
import { verifySkillIntegrity } from "./verify-brand-skill-integrity.mjs";
import { createSourceLearningGoal, validateSourceLearningGoal } from "./source-learning-goal.mjs";
import { evaluateSourceContinuation, evaluatePreviewContinuation, materializeHostContinuation, evaluateHostDelivery, evaluateLearningDispatch } from "./parent-delivery-gate.mjs";
import { recoverReference } from "./recover-reference.mjs";
import { freezeSelectedH5, validateLocalSelectedMaster } from "./selected-h5-handoff.mjs";
import { readCanonicalLearningProof } from "./learning-proof-contract.mjs";
import { installNativeSourceInput, readNativeSourceInput } from './native-source-input.mjs';

const skillScriptsDir = path.dirname(fileURLToPath(import.meta.url));
verifySkillIntegrity(path.dirname(skillScriptsDir), { allowMissing: true });
const skillScript = (name) => path.join(skillScriptsDir, name);
const resolveSkillScript = (script) => script.includes("skills/brand/scripts/")
  ? skillScript(path.basename(script))
  : script;

const originalArgs = process.argv.slice(2);
const normalized = normalizeEntryCommand(originalArgs);
let rawArgs = normalized.args;
const command = rawArgs[0];

if (rawArgs.includes('--module-task')) {
  if (command !== 'run' || opt(rawArgs, '--request-kind', '') !== 'host-concepts' || opt(rawArgs, '--mode', '') !== 'design-host') block('MODULE_PREP_ROUTE_INVALID', 'Use host-concepts design-host run.');
  const allowed = new Set(['--module-task', '--module-id', '--module-target', '--brand-root', '--mod-file', '--host-target', '--artifact-root', '--trial-authorization', '--recipes', '--build-target', '--request-kind', '--mode']);
  if (rawArgs.slice(1).some(arg => arg.startsWith('--') && !allowed.has(arg))) block('MODULE_PREP_MIXED_SCOPE', 'Module trial cannot mix whole-page or approved component inputs.');
  try {
    const result = prepareModuleTask({ task: opt(rawArgs, '--module-task', ''), moduleId: opt(rawArgs, '--module-id', ''), target: opt(rawArgs, '--module-target', ''), brandRoot: opt(rawArgs, '--brand-root', ''), modFile: opt(rawArgs, '--mod-file', ''), hostRoot: opt(rawArgs, '--host-target', ''), artifactRoot: opt(rawArgs, '--artifact-root', ''), authorization: opt(rawArgs, '--trial-authorization', ''), recipes: opt(rawArgs, '--recipes', ''), buildTarget: opt(rawArgs, '--build-target', 'weapp') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exit(0);
  } catch (error) { block('MODULE_PREP_BLOCKED', error.message); }
}

if (rawArgs.includes('--component-task')) {
  if (command !== 'run' || opt(rawArgs, '--request-kind', '') !== 'host-concepts' || opt(rawArgs, '--mode', '') !== 'design-host') block('MODULE_TASK_ROUTE_INVALID', 'Use explicit host-concepts design-host run for isolated module selection/adaptation.');
  const allowed = new Set(['--component-task', '--request-kind', '--mode']);
  if (rawArgs.slice(1).some(arg => arg.startsWith('--') && !allowed.has(arg))) block('MODULE_TASK_MIXED_SCOPE', 'Candidate trials cannot be combined with approved handoff or whole-page workflow arguments.');
  try {
    process.stdout.write(`${JSON.stringify(componentTask({ manifestPath: opt(rawArgs, '--component-task', '') }), null, 2)}\n`);
    process.exit(0);
  } catch (error) { block('MODULE_TASK_BLOCKED', error.message); }
}

if (rawArgs.includes('--component-handoff')) {
  const isRun = command === 'run' && opt(rawArgs, '--request-kind', '') === 'host-implementation' && opt(rawArgs, '--mode', '') === 'apply-host';
  if (!isRun && command !== 'status') block('MODULE_HANDOFF_ROUTE_INVALID', 'Use explicit apply-host host-implementation run or status.');
  const allowed = new Set(['--component-handoff', '--request-kind', '--mode', '--dry-run']);
  if (rawArgs.slice(1).some(arg => arg.startsWith('--') && !allowed.has(arg))) block('MODULE_HANDOFF_MIXED_SCOPE', 'Module handoff cannot be combined with whole-page workflow arguments.');
  try {
    const result = componentHandoff({ manifestPath: opt(rawArgs, '--component-handoff', ''), command, dryRun: rawArgs.includes('--dry-run') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 1);
  } catch (error) { block('MODULE_HANDOFF_BLOCKED', error.message); }
}

if (["resume-evidence", "resume-interpreter"].includes(command)) {
  const repairRoot = opt(rawArgs, "--artifact-root", "");
  const repairBrand = resolveBrand(rawArgs.slice(1));
  if (!repairRoot || !path.isAbsolute(repairRoot) || !repairBrand) block("LEARNING_REPAIR_ROOT_REQUIRED", "Use the existing absolute learning artifact root and brand.");
  // These internal operations mutate the ledger and have no dry-run mode.
  if (rawArgs.includes("--dry-run")) block("LEARNING_REPAIR_DRY_RUN_UNSUPPORTED", "This repair command has no dry-run mode; no changes were made.");
  const rejection = opt(rawArgs, "--rejection", "");
  if (command === "resume-evidence" && rejection) block("LEARNING_REPAIR_REJECTION_SCOPE_INVALID", "Evidence repair consumes its recorded consumer rejection, not an Interpreter rejection file.");
  const result = spawnSync(process.execPath, [skillScript("brand-subagent-workflow.mjs"), command, "--root", repairRoot, "--brand", repairBrand,
    ...(rawArgs.includes("--continue-existing") ? ["--continue-existing"] : []),
    ...(rejection ? ["--rejection", rejection] : []),
  ], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "resume-learning-closure") {
  const closureRoot=opt(rawArgs,"--artifact-root",""),closureBrand=resolveBrand(rawArgs.slice(1));
  if (!closureRoot || !path.isAbsolute(closureRoot) || !closureBrand) block("LEARNING_CLOSURE_ISOLATED_ROOT_REQUIRED","Use the existing absolute learning artifact root and brand.");
  const result=spawnSync(process.execPath,[skillScript("brand-subagent-workflow.mjs"),command,"--root",closureRoot,"--brand",closureBrand,...(rawArgs.includes("--continue-existing")?["--continue-existing"]:[]),...(rawArgs.includes("--dry-run")?["--dry-run"]:[]),"--reason",opt(rawArgs,"--reason","")],{stdio:"inherit"});
  process.exit(result.status??1);
}

if (command === "resume-demo") {
  const demoRoot = opt(rawArgs, "--artifact-root", "");
  const demoBrand = resolveBrand(rawArgs.slice(1));
  if (!demoRoot || !path.isAbsolute(demoRoot) || !demoBrand) block("DEMO_RESUME_ISOLATED_ROOT_REQUIRED", "Use the existing absolute learning artifact root and brand.");
  if (!rawArgs.includes("--continue-existing")) block("DEMO_RESUME_CONTINUATION_AUTHORIZATION_REQUIRED", "An explicit user instruction to continue the same learning case is required.");
  const result = spawnSync(process.execPath, [skillScript("brand-subagent-workflow.mjs"), "resume-demo", "--root", demoRoot, "--brand", demoBrand, "--continue-existing"], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "init") {
  const result = spawnSync(process.execPath, [skillScript("initialize-brand.mjs"), ...rawArgs.slice(1)], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "artifacts") {
  const result = spawnSync(process.execPath, [skillScript("brand-artifacts.mjs"), ...rawArgs.slice(1)], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "freeze-selected-h5") {
  if (rawArgs.some(arg => ["--publish", "--deploy", "--public", "--public-distribution"].includes(arg))) block("SELECTED_H5_LOCAL_SCOPE_ONLY", "Selected H5 approval authorizes local host implementation only.");
  const handoffRoot = opt(rawArgs, "--artifact-root", "");
  const handoffBrand = resolveBrand(rawArgs.slice(1));
  const goal = readJsonIfExists(path.join(handoffRoot, "migrations", handoffBrand, "goal-contract.json"));
  const hostTarget = opt(rawArgs, "--host-target", "");
  validateArtifactIsolation({ command: "run", requestKind: "host-concepts", root: handoffRoot, artifactRoot: handoffRoot, args: ["--host-target", hostTarget] });
  if (path.resolve(goal?.hostTarget || "") !== path.resolve(hostTarget)) block("SELECTED_H5_HOST_MISMATCH", "Use the original host bound to this selected H5.");
  try {
    const binding = (flag) => ({ path: opt(rawArgs, flag, ""), sha256: opt(rawArgs, `${flag}-sha256`, "") });
    const result = freezeSelectedH5({ root: handoffRoot, brand: handoffBrand, artifact: binding("--artifact"), approval: binding("--approval"), qa: binding("--qa"), hostTarget });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exit(0);
  } catch (error) { fail(error.message); }
}

if (command === "recover-reference") {
  const recoveryRoot = opt(rawArgs, "--artifact-root", "");
  const recoveryBrand = resolveBrand(rawArgs.slice(1));
  const recoveryGoal = readJsonIfExists(path.join(recoveryRoot, "migrations", recoveryBrand, "goal-contract.json"));
  validateArtifactIsolation({ command: "run", requestKind: "host-concepts", root: recoveryRoot, artifactRoot: recoveryRoot, args: ["--host-target", recoveryGoal?.hostTarget || ""] });
  try {
    const result = recoverReference({ root: recoveryRoot, brand: recoveryBrand, sourceRoot: opt(rawArgs, "--source-root", ""), sourceMaster: opt(rawArgs, "--source-master", ""), sourceMasterSha256: opt(rawArgs, "--source-master-sha256", ""), reason: opt(rawArgs, "--reason", ""), confirmed: rawArgs.includes("--confirm-reference-only") });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(0);
  } catch (error) { fail(error.message); }
}

if (["retry-h5", "retry-host-strategy","retry-host-implementation", "retry-host-preview-qa"].includes(command)) {
  const retryRoot = opt(rawArgs, "--artifact-root", "");
  if (!retryRoot || !path.isAbsolute(retryRoot)) block("H5_RETRY_ISOLATED_ROOT_REQUIRED", "Retry requires the existing absolute isolated artifact root.");
  const retryBrand = resolveBrand(rawArgs.slice(1));
  const retryGoal = readJsonIfExists(path.join(retryRoot, "migrations", retryBrand, "goal-contract.json"));
  validateArtifactIsolation({ command: "run", requestKind: "host-concepts", root: retryRoot, artifactRoot: retryRoot, args: ["--host-target", retryGoal?.hostTarget || ""] });
  const transferFlags = ["--transfer-review", "--transfer-review-sha256"].flatMap((flag) => opt(rawArgs, flag, "") ? [flag, opt(rawArgs, flag, "")] : []);
  if (command !== "retry-h5" && (retryGoal?.mode !== "apply-host" || transferFlags.length)) block("APPLY_HOST_RETRY_SCOPE_INVALID", "Retry only the blocked apply-host owner; additive brand rules are not accepted.");
  const reasonFlags = command !== "retry-h5" && opt(rawArgs,"--reason","") ? ["--reason",opt(rawArgs,"--reason","")] : [];
  const result = spawnSync(process.execPath, [skillScript("brand-subagent-workflow.mjs"), command, "--root", retryRoot, "--brand", retryBrand, ...(rawArgs.includes("--continue-existing") ? ["--continue-existing"] : []), ...transferFlags, ...reasonFlags], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

// Keep specialist execution in the existing state machine, with one public
// continuation point that cannot mistake child learning for user delivery.
if (["continue", "delivery"].includes(command)) {
  const continuationRoot = path.resolve(opt(rawArgs, "--artifact-root", "") || opt(rawArgs, "--root", process.cwd()));
  const handoff = readJsonIfExists(path.join(continuationRoot, "source-prerequisite.json"));
  if (command === "delivery") {
    const delivery = handoff
      ? evaluateSourceContinuation({ root: continuationRoot })
      : evaluateHostDelivery({ root: continuationRoot, brand: resolveBrand(rawArgs.slice(1)) });
    process.stdout.write(`${JSON.stringify(delivery, null, 2)}\n`);
    process.exit(delivery.status === "blocked" ? 1 : 0);
  }
  const nativeInput = opt(rawArgs, '--browser-capture', '');
  if (nativeInput) {
    if (handoff?.schema !== 'brand-source-prerequisite/v1' || handoff.parentRequestKind !== 'host-concepts' || handoff.artifactRoot !== continuationRoot) block('SOURCE_PREREQUISITE_INVALID', 'Browser input requires the original isolated host-concepts handoff.');
    validateArtifactIsolation({ command: 'run', requestKind: 'host-concepts', root: continuationRoot, artifactRoot: continuationRoot, args: ['--host-target', handoff.hostTarget] });
    if (fs.existsSync(path.join(continuationRoot, 'migrations', handoff.brand, 'goal-contract.json'))) block('NATIVE_SOURCE_GOAL_ALREADY_FROZEN', 'Do not replace source inputs after learning has started.');
    try { installNativeSourceInput({ file: path.resolve(nativeInput), root: continuationRoot, brand: handoff.brand, sourceUrl: handoff.sourceUrl }); }
    catch (error) { block('NATIVE_SOURCE_IMPORT_FAILED', error.message); }
  }
  if (handoff && !fs.existsSync(path.join(continuationRoot, 'migrations', handoff.brand, 'execution-manifest.json'))) {
    let native;
    try { native = readNativeSourceInput({ root: continuationRoot, brand: handoff.brand, sourceUrl: handoff.sourceUrl }); }
    catch (error) { block('NATIVE_SOURCE_IMPORT_FAILED', error.message); }
    if (native) dispatchSourceLearning({ root: continuationRoot, brand: handoff.brand, sourceUrl: handoff.sourceUrl, executed: [{ step: 'import-native-browser-input', status: 'raw-unreviewed', limitations: native.limitations }], sourceScreenshot: native.sourceScreenshot, visualAuthority: native.visualAuthority, interactionEvidence: native.interactionEvidence, learningProfile: handoff.requestedProfile === 'fast' ? 'fast' : 'full' });
  }
  const continuationOptions = { root: continuationRoot, continuationScope: opt(rawArgs, '--continuation-scope', null), previewReadinessSha256: opt(rawArgs, '--preview-readiness-sha256', null) };
  if (continuationOptions.previewReadinessSha256 && !continuationOptions.continuationScope) block('PREVIEW_SCOPE_REQUIRED', 'A preview readiness receipt requires an explicit continuation scope.');
  const evaluated = continuationOptions.continuationScope ? evaluatePreviewContinuation(continuationOptions) : evaluateSourceContinuation(continuationOptions);
  if (evaluated.status === "blocked") {
    process.stdout.write(`${JSON.stringify(evaluated, null, 2)}\n`);
    process.exit(1);
  }
  if (evaluated.status === "pending") {
    const learningManifest = path.join(continuationRoot, "migrations", handoff.brand, "execution-manifest.json");
    const next = fs.existsSync(learningManifest)
      ? spawnSync(process.execPath, [skillScript("brand-subagent-workflow.mjs"), "next", "--brand", handoff.brand, "--root", continuationRoot], { cwd: continuationRoot, encoding: "utf8" })
      : spawnSync(process.execPath, [fileURLToPath(import.meta.url), "run", "--request-kind", "brand-learning", "--mode", "learn-brand", "--profile", handoff.requestedProfile === "fast" ? "fast" : "full", "--brand", handoff.brand, "--source-url", handoff.sourceUrl, "--root", continuationRoot, "--source-prerequisite"], { cwd: continuationRoot, encoding: "utf8" });
    const outcome = evaluateLearningDispatch(evaluated, { exitCode: next.status, dispatch: safeParseJson(next.stdout), stderr: next.stderr || "" });
    process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
    process.exit(outcome.status === "blocked" ? 1 : 0);
  }
  validateArtifactIsolation({ command: "run", requestKind: "host-concepts", root: continuationRoot, artifactRoot: continuationRoot, args: handoff.parentArgs?.slice(1) || ["--host-target", handoff.hostTarget] });
  const installed = materializeHostContinuation(continuationOptions);
  if (installed.status !== "resume-ready") {
    process.stdout.write(`${JSON.stringify(installed, null, 2)}\n`);
    process.exit(1);
  }
  const resumed = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...installed.resume.args], { cwd: installed.resume.artifactRoot, encoding: "utf8" });
  const publicInstalled = installed.previewReadiness ? { ...installed, requiredRuntimeAssets: { count: installed.requiredRuntimeAssets.length, boundBy: installed.previewReadiness }, partialBrandValidation: { scope: installed.partialBrandValidation.scope, allowedUse: installed.partialBrandValidation.allowedUse, unresolvedExclusions: installed.partialBrandValidation.unresolvedExclusions, reviewerExecutionId: installed.partialBrandValidation.reviewerExecutionId } } : installed;
  process.stdout.write(`${JSON.stringify({ ...publicInstalled, status: resumed.status === 0 ? "host-resumed" : "blocked", ok: resumed.status === 0, dispatch: safeParseJson(resumed.stdout), stderr: resumed.stderr || "", fullWorkflowPass: false, userGoalCompleted: false, nextAction: "Continue the host specialist workflow in resume.artifactRoot. Show only a real-host H5 that passes the public delivery gate; source learning is not user completion." }, null, 2)}\n`);
  process.exit(resumed.status || 0);
}

if (!command || ["-h", "--help", "help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

if (!["run", "plan", "status", "tpp", "detect"].includes(command)) {
  fail(`Unknown command: ${command}`);
}

const requestKind = resolveRequestKind(rawArgs.slice(1));
if (command === "run" && !requestKind) {
  block("REQUEST_KIND_REQUIRED", "A real run must declare the current-turn outcome with --request-kind brand-learning|host-concepts|host-implementation. Do not infer it from history or available files.");
}
const mode = resolveWorkflowMode(rawArgs.slice(1), requestKind);
validateRequestKindMode(requestKind, mode);
const profile = opt(rawArgs, "--profile", ["design-host", "apply-host"].includes(mode) ? "fast" : "full");
const forceRelearn = rawArgs.includes("--force-relearn");
const updateExisting = rawArgs.includes("--update-existing");
const allowNewBrandId = rawArgs.includes("--allow-new-brand-id");
// A trusted library link selects a package, never the showcase as a source website.
const selectedLibraryBrand = brandFromDemoUrl(opt(rawArgs, "--source-url", ""), opt(rawArgs, "--registry-base", undefined));
if (selectedLibraryBrand && (forceRelearn || updateExisting || rawArgs.includes('--source-prerequisite'))) block('LIBRARY_LINK_NOT_LEARNING_SOURCE', 'Use the original brand website for learning or maintenance, not a brand library page.');
const reuseStylePack = rawArgs.includes("--reuse-style-pack") || Boolean(selectedLibraryBrand && ["design-host", "apply-host"].includes(mode));
if (forceRelearn && mode !== "learn-brand") {
  fail("--force-relearn is only valid for learn-brand maintenance runs.");
}
if (mode === "learn-brand" && !["fast", "full"].includes(profile)) {
  fail(`Unknown learn-brand profile: ${profile}. Use fast or full.`);
}
if (["design-host", "apply-host"].includes(mode) && !["fast", "standard", "certification"].includes(profile)) {
  fail(`Unknown ${mode} profile: ${profile}. Use fast, standard or certification.`);
}
const artifactRoot = opt(rawArgs, "--artifact-root", "");
const root = path.resolve(artifactRoot || opt(rawArgs, "--root", process.cwd()));
const artifactIsolation = validateArtifactIsolation({ command, requestKind, root, artifactRoot, args: rawArgs.slice(1) });
let brand = resolveBrand(rawArgs.slice(1));
if (selectedLibraryBrand && reuseStylePack && opt(rawArgs, '--brand', '') && brand !== selectedLibraryBrand) block('STYLE_PACK_SELECTION_CONFLICT', 'The selected library page and --brand name different packages.');
let registryResolution = null;
const requestedSourceUrl = opt(rawArgs, "--source-url", "");
const needsReusablePack = requestedSourceUrl && !opt(rawArgs, "--style-pack", "") && !opt(rawArgs, "--mod-file", "");

// A URL is a complete user reference, not a missing internal package.
// Keep host-concepts as the parent intent; hand the existing learning pipeline
// a prerequisite, then resume only after its evidence/package QA gates.
if (command === "run" && mode === "design-host" && needsReusablePack && !reuseStylePack) {
  const hostTarget = opt(rawArgs, "--host-target", "") || opt(rawArgs, "--host-target-or-plan", "");
  let source;
  try { source = new URL(requestedSourceUrl); } catch { block("BRAND_SOURCE_URL_INVALID", "Provide a valid brand reference URL."); }
  if (!["https:", "http:"].includes(source.protocol)) block("BRAND_SOURCE_URL_INVALID", "Brand references must use HTTP(S).");
  const learningArgs = ["run", "--request-kind", "brand-learning", "--mode", "learn-brand", "--profile", profile === "fast" ? "fast" : "full", "--brand", brand, "--source-url", requestedSourceUrl, "--root", root, "--source-prerequisite"];
  const handoff = {
    schema: "brand-source-prerequisite/v1", status: "learning-required", parentRequestKind: requestKind,
    sourceUrl: requestedSourceUrl, brand, hostTarget, artifactRoot: root, parentArgs: [...rawArgs],
    requestedProfile: profile, hostMutationAllowed: false, fullWorkflowPass: false,
    learning: { entry: skillScript("run-brand-workflow.mjs"), args: learningArgs },
    resume: { requestKind, mode, profile, hostTarget, artifactRoot: root, requires: ["learn-brand evidence and independent QA", "validated Brand MOD and hash-bound runtime assets"], modFile: null },
  };
  const handoffFile = path.join(root, "source-prerequisite.json");
  const existingHandoff = readJsonIfExists(handoffFile);
  if (existingHandoff && (existingHandoff.sourceUrl !== requestedSourceUrl || existingHandoff.hostTarget !== hostTarget || existingHandoff.brand !== brand || (existingHandoff.parentArgs && JSON.stringify(existingHandoff.parentArgs) !== JSON.stringify(rawArgs)))) block("SOURCE_PREREQUISITE_CONFLICT", "The original host request is immutable; continue its handoff or start a separate isolated run.");
  if (!existingHandoff) fs.writeFileSync(handoffFile, `${JSON.stringify(handoff, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ ...(existingHandoff || handoff), ok: true, command, workflow: mode, requestKind, status: "prerequisite-dispatch-ready", step: "brand-source-learning", handoffFile, userGoalCompleted: false, continueCommand: [fileURLToPath(import.meta.url), "continue", "--artifact-root", root], nextAction: "Orchestrator uses the public continue command without asking the user for a package. It drives the learning dispatch, validates independent QA and resumes preserved host-concepts; this handoff is not learning or H5 success." }, null, 2)}\n`);
  process.exit(0);
}

if (needsReusablePack && ["run", "plan", "detect"].includes(command)) {
  try {
    registryResolution = await resolvePublicStylePack({
      sourceUrl: requestedSourceUrl,
      root,
      registryBase: opt(rawArgs, "--registry-base", undefined),
      install: ["design-host", "apply-host"].includes(mode) && command === "run" && reuseStylePack,
    });
  } catch (error) {
    registryResolution = { matched: false, reason: "registry-unavailable", error: error.message };
  }

  if (registryResolution.reason === "registry-unavailable") {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      command,
      workflow: mode,
      brand,
      root,
      registryResolution,
      blockingCode: "PUBLIC_REGISTRY_UNAVAILABLE",
      nextAction: "Restore Registry access or provide an explicit local --style-pack/--mod-file; do not assume the source is unlisted.",
      message: "Public Registry could not be checked, so the workflow stopped before duplicate learning or host apply.",
    }, null, 2)}\n`);
    process.exit(1);
  }

  if (selectedLibraryBrand && !registryResolution.matched) block('SELECTED_STYLE_PACK_NOT_FOUND', 'The selected library package is unavailable; do not learn the library UI as a brand website.');
  if (registryResolution.matched) {
    if (forceRelearn && brand !== registryResolution.brand && !allowNewBrandId) {
      fail(`EXISTING_BRAND_ID_REQUIRED: ${registryResolution.brand} already owns this source. Revalidate it as an internal revision; creating ${brand} requires explicit --allow-new-brand-id authorization.`);
    }
    if (!forceRelearn) brand = registryResolution.brand;
    if (mode === "learn-brand" && command === "run" && !forceRelearn && !updateExisting && !rawArgs.includes("--source-prerequisite")) {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        command,
        workflow: "reuse-existing-style-pack",
        requestedWorkflow: mode,
        brand,
        root,
        registryResolution,
        nextAction: "Use the existing public Brand MOD; do not repeat source extraction.",
        message: "Public Registry matched this source. Reusing the reviewed style pack instead of relearning the brand.",
      }, null, 2)}\n`);
      process.exit(0);
    }

    if (["design-host", "apply-host"].includes(mode) && !reuseStylePack) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        command,
        workflow: mode,
        requestKind,
        brand: registryResolution.brand,
        root,
        registryResolution: { ...registryResolution, installedFiles: [] },
        blockingCode: "STYLE_PACK_REUSE_APPROVAL_REQUIRED",
        nextAction: "Either run brand-learning for the supplied source, provide an explicit local --style-pack/--mod-file, or explicitly authorize the reviewed Registry pack with --reuse-style-pack.",
        message: "A Registry match is only a discovery result. It cannot silently replace current brand learning or become the visual input for host concepts.",
      }, null, 2)}\n`);
      process.exit(1);
    }

    if (["design-host", "apply-host"].includes(mode)) {
      rawArgs = withoutOption(rawArgs, "--source-url");
      rawArgs = withoutOption(rawArgs, "--registry-base");
      if (!opt(rawArgs, "--brand", "")) rawArgs.push("--brand", brand);
      rawArgs.push("--mod-file", path.resolve(root, registryResolution.modFile));
    }
  }
}

const passthroughArgs = rawArgs.slice(1);
const frozenRun = resolveReadOnlyFrozenRun({ command, root, brand, mode, requestKind, args: passthroughArgs });
const intake = resolveWorkflowIntake({
  mode,
  brand,
  root,
  args: passthroughArgs,
  frozenRun,
});

if (!intake.ok) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    blockingCode: intake.blockingCode || "WORKFLOW_INTAKE_BLOCKED",
    command,
    workflow: mode,
    requestKind,
    profile,
    brand,
    root,
    intake,
    message: intake.message,
  }, null, 2)}\n`);
  process.exit(1);
}

if (command === "run" && ["design-host", "apply-host"].includes(mode)) {
  installExplicitLocalStylePack({ root, brand, modFile: opt(rawArgs, "--mod-file", "") });
}

if (command === "run" && mode === "design-host") {
  const routeFile = path.join(root, "migrations", brand, "design-host-route.json");
  if (mode === "design-host" && !fs.existsSync(routeFile)) {
    fs.mkdirSync(path.dirname(routeFile), { recursive: true });
    fs.writeFileSync(routeFile, `${JSON.stringify({
      schema: "design-host-route/v3", sequence: "h5-design-system-first",
      imageCapability: { status: "deferred-until-verified-gap" },
      brandIdentityAssets: { status: "optional-pending", assets: [] },
      knowledgeDecision: { status: "pending" },
      h5Directions: { status: "pending", directions: [] },
      h5QA: { status: "pending" },
      expressiveGapDecision: { status: "pending", gaps: [] },
      localizedExpressiveAssets: { status: "not-assessed", automaticRetryCount: 0, assets: [] },
      expressiveIntegrationQA: { status: "not-assessed" },
      userDirectionReview: { status: "pending" },
      finalSelection: { status: "pending" },
    }, null, 2)}\n`);
  }
  const routeStage = "initialization";
  const routeGate = spawnSync(process.execPath, [skillScript("validate-design-host-route.mjs"), ...designHostRouteValidationArgs(root, brand, routeStage)], { cwd: root, encoding: "utf8" });
  if (routeGate.status !== 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "design-host-route", blockingCode: "DESIGN_HOST_ROUTE_ORDER_FAILED", routeGate: safeParseJson(routeGate.stdout), message: "The requested medium sequence is not executable; no H5 or host edit was started." }, null, 2)}\n`);
    process.exit(routeGate.status || 1);
  }
}

const contract = runBrandGuard(root, ["workflow-contract", "--mode", mode], { allowFailure: false });
const workflowContractPayload = safeParseJson(contract.stdout);
const workflowDefinition = workflowContractPayload?.workflowContract || null;
const workflowContractSummary = {
  command: workflowContractPayload?.command || "/brand",
  mode,
  version: workflowDefinition?.version || workflowContractPayload?.version || null,
  goal: workflowDefinition?.goal || null,
};
const workflowDefinitionSummary = {
  mode,
  goal: workflowDefinition?.goal || null,
  requiredStageIds: (workflowDefinition?.steps || []).filter((step) => step.required).map((step) => step.id),
};
const guardCommands = buildGuardCommands(mode, passthroughArgs);
const executed = [];

if (updateExisting) {
  if (mode !== "learn-brand" || !brand) fail("update requires an existing --brand and uses the learn-brand pipeline.");
  const sourceArgs = [command === "run" ? "merge" : "validate", "--brand", brand, "--root", root];
  if (command === "run" && requestedSourceUrl) sourceArgs.push("--source-url", requestedSourceUrl);
  const sourceResult = spawnSync("node", ["skills/brand/scripts/brand-source-manifest.mjs", ...sourceArgs], { cwd: root, encoding: "utf8" });
  executed.push({ step: "inherit-learned-sources", command: `node skills/brand/scripts/brand-source-manifest.mjs ${sourceArgs.join(" ")}`, exitCode: sourceResult.status, stdout: sourceResult.stdout, stderr: sourceResult.stderr });
  if (sourceResult.status !== 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, workflow: "update-existing-brand", brand, blockingCode: safeParseJson(sourceResult.stdout)?.code || "SOURCE_MANIFEST_INVALID", blockingResult: safeParseJson(sourceResult.stdout), message: "Existing-demo update stopped before extraction because its learned source history is incomplete." }, null, 2)}\n`);
    process.exit(sourceResult.status || 1);
  }
}

if (command === "detect") {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command,
    workflow: mode,
    requestKind,
    profile,
    brand,
    root,
    intake,
    resolvedInputs: {
      sourceUrl: opt(rawArgs, "--source-url", ""),
      hostTarget: opt(rawArgs, "--host-target", "") || opt(rawArgs, "--host-target-or-plan", ""),
      planFile: opt(rawArgs, "--plan-file", ""),
      dembrandtInput: opt(rawArgs, "--dembrandt-input", ""),
      stylePack: opt(rawArgs, "--style-pack", ""),
      modFile: opt(rawArgs, "--mod-file", ""),
      registryResolution,
    },
    message: "Workflow intake resolved. Use this to confirm /brand selected the correct path before running.",
  }, null, 2)}\n`);
  process.exit(0);
}

if (command === "plan") {
  const outputAudit = auditWorkflowOutputs({ root, mode, brand, args: passthroughArgs });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command,
    workflow: mode,
    requestKind,
    profile,
    brand,
    root,
    workflowContract: workflowContractSummary,
    workflowDefinition: workflowDefinitionSummary,
    intake,
    resolvedInputs: {
      sourceUrl: opt(rawArgs, "--source-url", ""),
      hostTarget: opt(rawArgs, "--host-target", "") || opt(rawArgs, "--host-target-or-plan", ""),
      planFile: opt(rawArgs, "--plan-file", ""),
      registryResolution,
    },
    progress: buildProgressSummary({ mode, outputAudit, executed: [] }),
    stepStatus: outputAudit.stepStatus,
    outputStatus: outputAudit.outputStatus,
    completedStages: outputAudit.completedStages,
    missingOutputs: outputAudit.missingOutputs,
    userDelivery: outputAudit.userDelivery || null,
    nextAction: outputAudit.nextAction,
    previewArtifacts: outputAudit.previewArtifacts,
    howToTest: buildHowToTest({ root, mode, brand }),
    message: "Workflow plan generated. This command only shows the resolved flow and current missing outputs.",
  }, null, 2)}\n`);
  process.exit(0);
}

if (command === "run") {
  if (["design-host", "apply-host"].includes(mode)) {
    const hostTarget = opt(passthroughArgs, "--host-target", "") || opt(passthroughArgs, "--host-target-or-plan", "");
    const preflight = spawnSync("node", [
      skillScript("apply-host-preflight.mjs"),
      "--root", root,
      "--brand", brand,
      "--host-target", hostTarget,
      "--profile", profile,
      "--phase", mode === "design-host" ? "design" : "implementation",
    ], { cwd: root, encoding: "utf8" });
    executed.push({
      step: `${mode}-preflight`,
      command: `node skills/brand/scripts/apply-host-preflight.mjs --root ${root} --brand ${brand} --host-target ${hostTarget} --profile ${profile} --phase ${mode === "design-host" ? "design" : "implementation"}`,
      exitCode: preflight.status,
      stdout: preflight.stdout,
      stderr: preflight.stderr,
    });
    if (preflight.status !== 0) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
    workflow: mode,
    requestKind,
    profile,
        brand,
        step: `${mode}-preflight`,
        blockingCode: `${mode.toUpperCase().replaceAll('-', '_')}_PREFLIGHT_BLOCKED`,
        preflight: safeParseJson(preflight.stdout),
        message: `${mode} stopped before dispatch because its bounded preflight failed.`,
      }, null, 2)}\n`);
      process.exit(preflight.status || 1);
    }
  }
  executeWorkflow({
    root,
    mode,
    profile,
    brand,
    args: passthroughArgs,
    executed,
  });
}

for (const args of guardCommands) {
  const result = runBrandGuard(root, args, { allowFailure: true });
  executed.push({
    command: `node skills/brand/scripts/brand-guard.mjs ${args.join(" ")}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.status !== 0) {
    const payload = safeParseJson(result.stdout);
    const blockingSummary = summarizeBlockingResult(payload);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: mode,
      root,
      workflowContract: workflowContractSummary,
      intake,
      failedCommand: executed[executed.length - 1].command,
      blockingResult: payload || null,
      blockingSummary,
      acceptanceReport: {
        entry: "run-brand-workflow",
        mode,
        verdict: blockingSummary.verdict,
        summary: blockingSummary.reason,
        workflowModeContract: blockingSummary.workflowModeContract || null,
        checklist: blockingSummary.missingChecklist,
        blockingPrinciples: blockingSummary.blockingPrinciples,
        nextFixes: blockingSummary.nextFixes,
      },
      stderr: result.stderr || "",
      executed,
      message: "Brand workflow stopped by TPP gate. Fix the blocking items before continuing.",
    }, null, 2)}\n`);
    process.exit(result.status || 1);
  }
}

const previewValidation = command === "tpp"
  ? runTppPreviewChecks({ root, mode, brand, args: passthroughArgs, executed })
  : null;

if (previewValidation?.blockingPrinciples?.length) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    command,
    workflow: mode,
    brand,
    root,
    workflowContract: workflowContractSummary,
    workflowDefinition: workflowDefinitionSummary,
    intake,
    previewValidation,
    executed,
    verdict: "blocked",
    acceptanceReport: {
      entry: "run-brand-workflow",
      mode,
      verdict: "blocked",
      summary: previewValidation.summary,
      checklist: previewValidation.checklist,
      blockingPrinciples: previewValidation.blockingPrinciples,
      nextFixes: previewValidation.nextFixes,
    },
    message: "TPP gate stopped because the standard Brand Demo preview did not satisfy the rendered preview contract.",
  }, null, 2)}\n`);
  process.exit(1);
}

if (command === "tpp") {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command,
    workflow: mode,
    brand,
    root,
    workflowContract: workflowContractSummary,
    workflowDefinition: workflowDefinitionSummary,
    intake,
    previewValidation,
    executed,
    verdict: previewValidation?.browser?.status === "skipped" ? "passed-static" : "passed",
    acceptanceReport: {
      entry: "run-brand-workflow",
      mode,
      verdict: previewValidation?.browser?.status === "skipped" ? "passed-static" : "passed",
      summary: previewValidation?.summary || "TPP gate passed through the /brand total-entry workflow.",
      checklist: previewValidation?.checklist || [],
      blockingPrinciples: [],
      nextFixes: previewValidation?.nextFixes || [],
    },
    message: "TPP gate passed through the /brand total-entry workflow.",
  }, null, 2)}\n`);
  process.exit(0);
}

const outputAudit = auditWorkflowOutputs({ root, mode, brand, args: passthroughArgs });
const learnBrandHandoff = mode === "learn-brand" ? inspectLearnBrandHandoff({ root, brand }) : null;
const userDelivery = outputAudit.userDelivery || (["design-host", "apply-host"].includes(mode) ? evaluateHostDelivery({ root, brand }) : null);
const completed = outputAudit.missingOutputs.length === 0 && (!learnBrandHandoff || learnBrandHandoff.status === "PASS") && (!userDelivery || userDelivery.userGoalCompleted === true);
const progress = buildProgressSummary({ mode, outputAudit, executed });

process.stdout.write(`${JSON.stringify({
  ok: completed,
  command,
  workflow: mode,
  requestKind,
  profile,
  brand,
  root,
  workflowContract: workflowContractSummary,
  workflowDefinition: workflowDefinitionSummary,
  intake,
  executed,
  completed,
  userDelivery,
  userGoalCompleted: mode === "learn-brand" && fs.existsSync(path.join(root, "source-prerequisite.json")) ? false : completed,
  learnBrandHandoff,
  progress,
  stepStatus: outputAudit.stepStatus,
  outputStatus: outputAudit.outputStatus,
  completedStages: outputAudit.completedStages,
  missingOutputs: outputAudit.missingOutputs,
  nextAction: outputAudit.nextAction,
  previewArtifacts: outputAudit.previewArtifacts,
  howToTest: buildHowToTest({ root, mode, brand }),
  message: learnBrandHandoff?.status === "BLOCKED"
    ? "Learn-brand role handoff is blocked. Repair Evidence or Interpreter before claiming completion."
    : completed
      ? "Brand workflow outputs and role handoffs are complete."
      : "Collection or downstream work remains pending; no complete brand-learning verdict has been issued.",
}, null, 2)}\n`);
if (learnBrandHandoff?.status === "BLOCKED") process.exitCode = 1;

function inspectLearnBrandHandoff({ root, brand }) {
  const migration = path.join(root, "migrations", brand);
  const evidenceFile = path.join(migration, "brand-evidence.json");
  const intentFile = path.join(migration, "brand-intent.json");
  if (!fs.existsSync(evidenceFile)) return { status: "PENDING", stage: "evidence", reason: "brand-evidence.json is not present" };
  for (const stage of ["evidence", "interpreter"]) {
    if (stage === "interpreter" && !fs.existsSync(intentFile)) return { status: "PENDING", stage, reason: "brand-intent.json is not present" };
    const result = spawnSync(process.execPath, [skillScript("validate-learn-brand-handoff.mjs"), "--root", root, "--brand", brand, "--stage", stage], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) return { status: "BLOCKED", stage, report: safeParseJson(result.stdout), error: result.stderr || null };
  }
  return { status: "PASS" };
}

function buildGuardCommands(modeName, passthroughArgs) {
  const filtered = stripCommandOnlyArgs(passthroughArgs);
  const commands = [];

  if (["design-host", "apply-host"].includes(modeName) && opt(filtered, "--plan-file", "")) {
    commands.push(["validate-intent", ...filtered]);
  }

  commands.push(["tpp-test", "--mode", modeName, ...filtered]);
  return commands;
}

function runTppPreviewChecks({ root, mode, brand, args, executed }) {
  if (mode !== "learn-brand") {
    return {
      status: "not-applicable",
      summary: "Preview validation is skipped for apply-host; host apply has its own target-page verification.",
      checklist: [],
      blockingPrinciples: [],
      nextFixes: [],
    };
  }

  const checklist = [];
  const blockingPrinciples = [];
  const nextFixes = [];
  const registryScript = path.join(root, "scripts", "validate-brand-preview-registry.mjs");
  const browserScript = path.join(root, "scripts", "validate-brand-preview-browser.mjs");
  const visualQualityScript = path.join(root, "scripts", "validate-brand-visual-quality.mjs");
  const baseUrl = opt(args, "--base-url", "");
  const page = opt(args, "--page", "");
  const requireBrowser = args.includes("--require-browser");

  const staticResult = runNodeCheck({
    root,
    script: "scripts/validate-brand-preview-registry.mjs",
    label: "standard-demo-registry",
    enabled: fs.existsSync(registryScript),
    executed,
  });

  checklist.push({
    id: "standard-demo-registry",
    label: "Standard demo registry, schema, shell and architecture gate",
    status: staticResult.status === "passed" ? "complete" : "blocked",
    why: "The learn-brand flow must produce a standard demo preview, not only Markdown rules or a brand-specific App.vue branch.",
    fix: "Run or fix scripts/validate-brand-preview-registry.mjs until the registry, schema and architecture gates pass.",
  });

  if (staticResult.status !== "passed") {
    blockingPrinciples.push({
      id: "standard-demo-registry-failed",
      title: "Standard demo registry gate failed",
      reason: staticResult.status === "missing"
        ? "The registry validator script is missing."
        : "The static preview/schema/architecture validator returned a failure.",
      fix: "Fix the standard demo preview schema and architecture before claiming the brand was learned.",
      stdout: staticResult.stdout,
      stderr: staticResult.stderr,
    });
    nextFixes.push("Fix scripts/validate-brand-preview-registry.mjs failures.");
  }

  let browserResult = {
    status: "skipped",
    reason: "Pass --base-url http://127.0.0.1:<port> to run real browser DOM, image, scroll and interaction checks.",
  };

  if (baseUrl) {
    const browserArgs = ["--base-url", baseUrl];
    if (brand) browserArgs.push("--brand", brand);
    if (page) browserArgs.push("--page", page);
    browserResult = runNodeCheck({
      root,
      script: "scripts/validate-brand-preview-browser.mjs",
      label: "standard-demo-browser",
      enabled: fs.existsSync(browserScript),
      scriptArgs: browserArgs,
      executed,
    });
  }

  checklist.push({
    id: "standard-demo-browser",
    label: "Rendered demo DOM, image loading, scroll and interaction gate",
    status: browserResult.status === "passed"
      ? "complete"
      : browserResult.status === "skipped" && !requireBrowser
        ? "partial"
        : "blocked",
    why: "The gate must verify what the browser really renders, otherwise MD rules can pass while the demo is still wrong.",
    fix: `Start the demo server and run TPP with --base-url, for example: node skills/brand/scripts/run-brand-workflow.mjs tpp --mode learn-brand --brand ${brand || "<brand>"} --base-url http://127.0.0.1:5173 --require-browser`,
  });

  if (browserResult.status !== "passed" && (baseUrl || requireBrowser)) {
    blockingPrinciples.push({
      id: baseUrl ? "standard-demo-browser-failed" : "standard-demo-browser-required",
      title: baseUrl ? "Rendered browser demo gate failed" : "Rendered browser demo gate is required",
      reason: baseUrl
        ? "The browser validator could not prove the rendered demo matches the schema and loads its assets."
        : "This TPP run was marked --require-browser but no --base-url was provided.",
      fix: baseUrl
        ? "Fix the rendered demo errors reported by scripts/validate-brand-preview-browser.mjs."
        : "Start the demo server, pass --base-url, and rerun the total TPP gate.",
      stdout: browserResult.stdout,
      stderr: browserResult.stderr,
    });
    nextFixes.push(baseUrl
      ? "Fix rendered browser validation failures."
      : "Rerun with --base-url after starting the demo server.");
  }

  const visualQualityResult = brand
    ? runNodeCheck({
      root,
      script: "scripts/validate-brand-visual-quality.mjs",
      label: "standard-demo-visual-quality",
      enabled: fs.existsSync(visualQualityScript),
      scriptArgs: ["--write", "--brand", brand],
      executed,
    })
    : {
      status: "skipped",
      command: "node scripts/validate-brand-visual-quality.mjs --write --brand <brand>",
      stdout: "",
      stderr: "No --brand was provided.",
    };
  const visualQualityLevel = extractVisualQualityLevel(visualQualityResult, brand);
  const visualQualityReady = visualQualityResult.status === "passed" && ["visual-quality-ready", "learning-proof-ready"].includes(visualQualityLevel);

  checklist.push({
    id: "standard-demo-visual-quality",
    label: "Source/demo visual comparison and authentic core asset gate",
    status: visualQualityReady ? "complete" : "blocked",
    why: "Schema and browser checks can pass while the demo still fails to express the source site's visual language.",
    fix: "Add visual-comparison-report.json with source screenshots, replace placeholder assets with source-localized assets, and rerun visual quality.",
  });

  if (!visualQualityReady) {
    blockingPrinciples.push({
      id: "standard-demo-visual-quality-not-ready",
      title: "Standard demo visual learning is not ready",
      reason: visualQualityLevel
        ? `Visual quality level is ${visualQualityLevel}, not visual-quality-ready or learning-proof-ready.`
        : "Visual quality gate did not produce an accepted ready level.",
      fix: "Capture source screenshots/crops, compare them against demo pages, and remove or mark placeholder assets before treating the brand as learned.",
      stdout: visualQualityResult.stdout,
      stderr: visualQualityResult.stderr,
    });
    nextFixes.push("Fix visual comparison and source asset authenticity before treating this brand as learned.");
  }

  const summary = blockingPrinciples.length
    ? "TPP found blocking standard demo preview issues."
    : browserResult.status === "passed"
      ? "TPP passed static and rendered standard demo preview gates."
      : "TPP passed static standard demo gates; rendered browser gate was not requested.";

  return {
    status: blockingPrinciples.length ? "blocked" : "passed",
    summary,
    static: staticResult,
    browser: browserResult,
    checklist,
    blockingPrinciples,
    nextFixes: dedupe(nextFixes),
  };
}

function runNodeCheck({ root, script, label, enabled, scriptArgs = [], executed }) {
  const executableScript = resolveSkillScript(script);
  if (!enabled && !fs.existsSync(executableScript)) {
    return {
      status: "missing",
      command: `node ${script}${formatExtraArgs(scriptArgs)}`,
      stdout: "",
      stderr: `${script} does not exist.`,
    };
  }

  const result = spawnSync("node", [executableScript, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = {
    step: label,
    command: `node ${script}${formatExtraArgs(scriptArgs)}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
  executed.push(record);

  return {
    status: (result.status ?? result.exitCode) === 0 ? "passed" : "failed",
    command: record.command,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runSilentNodeCheck({ root, script, scriptArgs = [] }) {
  const scriptFile = path.resolve(root, resolveSkillScript(script));
  if (!fs.existsSync(scriptFile)) {
    return {
      status: "missing",
      command: `node ${script}${formatExtraArgs(scriptArgs)}`,
      stdout: "",
      stderr: `${script} does not exist.`,
    };
  }

  const optionsIndex = scriptArgs.indexOf("--options");
  const liveSelectedMaster = optionsIndex >= 0 && readJsonIfExists(path.resolve(root, scriptArgs[optionsIndex + 1]))?.schema === "selected-h5-local-options/v1";
  const result = scriptArgs.includes("--write") || liveSelectedMaster
    ? spawnSync("node", [scriptFile, ...scriptArgs], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    : runCachedValidator({ root, script: scriptFile, args: scriptArgs });
  return {
    status: (result.status ?? result.exitCode) === 0 ? "passed" : "failed",
    command: `node ${script}${formatExtraArgs(scriptArgs)}`,
    exitCode: result.status ?? result.exitCode,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    cacheStatus: result.cacheStatus || "bypass",
    cacheKey: result.cacheKey || null,
  };
}

function summarizeSilentCheck(result) {
  if (!result) return null;
  const text = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
  return {
    status: result.status,
    command: result.command,
    exitCode: result.exitCode ?? null,
    cacheStatus: result.cacheStatus || "bypass",
    summary: text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 12),
  };
}

function extractVisualQualityLevel(result, brand) {
  if (!result) return "";
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const escapedBrand = String(brand || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brandPattern = escapedBrand ? new RegExp(`brand-quality\\s+${escapedBrand}:\\s*([^\\s]+)`) : null;
  const match = brandPattern ? text.match(brandPattern) : text.match(/brand-quality\s+[^:]+:\s*([^\s]+)/);
  return match?.[1] || "";
}

function executeWorkflow({ root, mode, profile, brand, args, executed }) {
  if(mode === 'apply-host' || (mode === 'design-host' && opt(args, '--application-plan', ''))) {
    const explicitExpressionPlan = opt(args, '--expression-plan', '');
    const expressionFile = path.resolve(root, explicitExpressionPlan || path.join('migrations',brand,'host-expression-plan.json'));
    // H5-first apply-host begins with Host Strategy. Older image-first runs may
    // carry a host-expression-plan, but it is not a prerequisite for scanning
    // the host or producing the strategy artifacts. Validate it when supplied
    // or present; do not turn a legacy optional artifact into a circular gate.
    if (explicitExpressionPlan || fs.existsSync(expressionFile)) {
      const gate=validateHostExpression(root,expressionFile);
      if(!gate.ok){process.stdout.write(JSON.stringify({ok:false,step:'host-expression',...gate,nextAction:'Complete region decisions; generated regions require concept + dynamic H5 + bound runtime and visual review evidence.'},null,2)+'\n');process.exit(1);}
    }
  }

  if (mode === "learn-brand") {
    runLearnBrand({
      root,
      brand,
      args,
      executed,
    });
    return;
  }

  if (mode === "apply-host") {
    const routeFile = path.join(root, "migrations", brand, "design-host-route.json");
    if (!fs.existsSync(routeFile)) {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "design-host-route", blockingCode: "DESIGN_HOST_ROUTE_REQUIRED", message: "Apply-host stopped before editing because the frozen route-order artifact is missing." }, null, 2)}\n`);
      process.exit(1);
    }
    const routeGate = runNodeCheck({ root, script: "skills/brand/scripts/validate-design-host-route.mjs", label: "design-host-route", enabled: true, scriptArgs: designHostRouteValidationArgs(root, brand, "before-apply-host"), executed });
    if (routeGate.status !== "passed") {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "design-host-route", blockingCode: "DESIGN_HOST_ROUTE_ORDER_FAILED", routeGate, message: "Apply-host stopped before editing because the frozen design sequence is incomplete." }, null, 2)}\n`);
      process.exit(1);
    }
    const wild = resolveWildDesignSet({ root, brand, args });
    const required = { plan: opt(args, "--application-plan", path.join("migrations", brand, "brand-application-plan.json")), options: wild.options, decision: wild.decision, scope: wild.scope, direction: wild.direction, brandEvidence: wild.brandEvidence, brandMod: wild.brandMod };
    const missing = Object.entries(required).filter(([, file]) => !file || !fs.existsSync(path.resolve(root, file))).map(([key]) => key);
    if (missing.length) {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "verify-frozen-design", blockingCode: "FROZEN_DESIGN_REQUIRED", missingArtifacts: missing, learnBrandDispatched: false, nextAction: "Return to design-host, complete direction selection and freeze all design artifacts before implementation.", message: "Apply-host stopped before editing because its approved design input is incomplete." }, null, 2)}\n`);
      process.exit(1);
    }
    const planGate = runNodeCheck({ root, script: "skills/brand/scripts/apply-host-preflight.mjs", label: "approved-host-master", enabled: true, scriptArgs: ["--frozen-master-only", "--root", root, "--brand", brand, "--host-target", opt(args, "--host-target", ".")], executed });
    const directionGate = runNodeCheck({ root, script: "skills/brand/scripts/validate-wild-design-decision.mjs", label: "frozen-design-direction", enabled: true, scriptArgs: wild.args, executed });
    if (planGate.status !== "passed" || directionGate.status !== "passed") {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "verify-frozen-design", blockingCode: "FROZEN_DESIGN_INVALID", planGate, directionGate, nextAction: "Repair and reapprove the direction in design-host; apply-host may not redesign it." }, null, 2)}\n`);
      process.exit(1);
    }
    if (opt(args, "--plan-file", "")) runOrThrow({ root, commandArgs: ["validate-intent", ...stripCommandOnlyArgs(args)], executed, step: "validate-intent", failureMessage: "Host-apply intent validation failed." });
    return;
  }

  const applicationPlanArg = opt(args, "--application-plan", "");
  if (mode === "design-host" && applicationPlanArg) {
    const applicationPlanFile = path.resolve(root, applicationPlanArg);
    if (!fs.existsSync(applicationPlanFile)) {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "brand-application-plan", blockingCode: "BRAND_APPLICATION_PLAN_MISSING", path: applicationPlanArg }, null, 2)}\n`);
      process.exit(1);
    }
    const planGate = runNodeCheck({ root, script: "skills/brand/scripts/validate-brand-application-plan.mjs", label: "brand-application-plan", enabled: true, scriptArgs: ["--plan", applicationPlanFile], executed });
    if (planGate.status !== "passed") {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "brand-application-plan", blockingCode: "BRAND_APPLICATION_PLAN_INVALID", gate: planGate }, null, 2)}\n`);
      process.exit(1);
    }
    const plan = readJsonIfExists(applicationPlanFile);
    const options = (Array.isArray(plan?.options) ? plan.options : [])
      .filter((item) => item?.disposition !== "rejected")
      .map((item, index) => ({
        id: item.id,
        name: item.name || item.id,
        recommended: item.recommended === true || index === 0,
        visualNarrative: item.visualNarrative,
        preview: path.resolve(path.dirname(applicationPlanFile), item.previewEvidence.path),
        previewSha256: item.previewEvidence.sha256,
        compositionRoles: (item.compositionRoles || []).map((role) => role.role),
        assetRoles: (item.assetArtDirection?.assetAssignments || []).map((asset) => asset.role),
      }));
    const rejectedDirections = (Array.isArray(plan?.options) ? plan.options : [])
      .filter((item) => item?.disposition === "rejected")
      .map((item) => ({ id: item.id, reason: item.rejectionReason, codes: item.rejectionCodes || [] }));
    process.stdout.write(`${JSON.stringify({
      ok: true,
      workflow: mode,
      profile,
      status: "awaiting-user",
      step: "direction-selection",
      pauseReason: "style-choice",
      hostTarget: opt(args, "--host-target", ""),
      hostFilesModified: false,
      applicationPlan: applicationPlanFile,
      hostBinding: plan.hostBinding,
      styleOptions: options,
      rejectedDirections,
      allowedNextActions: ["select", "none-fit"],
      nextAction: "Show the validated static H5 directions and wait for an explicit selection. Do not edit the host yet or generate separate direction images by default.",
      message: "Validated design-host directions are ready for user selection; rejected directions remain visible only as audit evidence.",
    }, null, 2)}\n`);
    process.exit(0);
  }

  // A fresh fast preview starts the real specialist state machine. It must not
  // stop at a legacy "prepare options elsewhere" status that forces the outer
  // agent to invent and manually stitch a second workflow.
  const explicitOptions = opt(args, "--wild-design-options", "");
  if (profile === "fast" && !explicitOptions) {
    bootstrapDesignHostProbe({ root, brand, profile, args });
  }

  const wild = resolveWildDesignSet({ root, brand, args });
  const requiredChoiceArtifacts = {
    options: wild.options,
    businessScope: wild.scope,
    brandEvidence: wild.brandEvidence && fs.existsSync(wild.brandEvidence) ? wild.brandEvidence : "",
    brandMod: wild.brandMod && fs.existsSync(wild.brandMod) ? wild.brandMod : "",
  };
  const missingChoiceArtifacts = Object.entries(requiredChoiceArtifacts)
    .filter(([, file]) => !file || !fs.existsSync(path.resolve(root, file)))
    .map(([key]) => key);
  if (missingChoiceArtifacts.length) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: mode,
      step: "wild-design-selection",
      blockingCode: "WILD_DESIGN_ARTIFACT_SET_INCOMPLETE",
      missingArtifacts: missingChoiceArtifacts,
      message: "Style choice is blocked until this host run has rendered options, frozen business scope, and brand evidence.",
    }, null, 2)}\n`);
    process.exit(1);
  }

  const decisionPayload = wild.decision ? readJsonIfExists(path.resolve(root, wild.decision)) : null;
  if (!decisionPayload || decisionPayload.status === "awaiting-user") {
    const optionGateArgs = [
      "--options-only",
      "--options", wild.options,
      "--business-scope", wild.scope,
      "--brand-evidence", wild.brandEvidence,
      "--brand-mod", wild.brandMod,
    ];
    if (wild.history) optionGateArgs.push("--history", wild.history);
    const optionGate = runNodeCheck({
      root,
      script: "skills/brand/scripts/validate-wild-design-decision.mjs",
      label: "wild-design-options",
      enabled: fs.existsSync(path.join(root, "skills/brand/scripts/validate-wild-design-decision.mjs")),
      scriptArgs: optionGateArgs,
      executed,
    });
    if (optionGate.status !== "passed") {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        workflow: mode,
        profile,
        status: "rework-style-options",
        step: "wild-design-selection",
        blockingCode: "WILD_DESIGN_OPTIONS_GATE_BLOCKED",
        learnBrandDispatched: false,
        hostFilesModified: false,
        gate: optionGate,
        nextAction: "Regenerate the rendered directions with dominant source-backed brand media and distinct visual narratives before showing them to the user.",
        message: "Style options were rejected before user review because they do not yet carry enough visible brand expression.",
      }, null, 2)}\n`);
      process.exit(1);
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      workflow: mode,
      profile,
      status: "awaiting-user",
      step: "wild-design-selection",
      pauseReason: "style-choice",
      learnBrandDispatched: false,
      hostFilesModified: false,
      styleOptions: wild.options,
      allowedNextActions: ["select", "none-fit"],
      nextAction: "Show the rendered options and wait for the user's explicit selection. Do not edit the host yet.",
      message: "Style options are ready. Apply preview paused normally for the user's choice.",
    }, null, 2)}\n`);
    process.exit(0);
  }

  const missingSelectedArtifacts = {
    decision: wild.decision,
    designDirection: wild.direction,
  };
  const missingAfterSelection = Object.entries(missingSelectedArtifacts)
    .filter(([, file]) => !file || !fs.existsSync(path.resolve(root, file)))
    .map(([key]) => key);
  if (missingAfterSelection.length) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: mode,
      step: "wild-design-selection",
      blockingCode: "WILD_DESIGN_SELECTED_CONTRACT_INCOMPLETE",
      missingArtifacts: missingAfterSelection,
      message: "The selected option cannot enter implementation until its bound decision and final design direction are complete.",
    }, null, 2)}\n`);
    process.exit(1);
  }
  const wildResult = runNodeCheck({
    root,
    script: "skills/brand/scripts/validate-wild-design-decision.mjs",
    label: "wild-design-selection",
    enabled: fs.existsSync(path.join(root, "skills/brand/scripts/validate-wild-design-decision.mjs")),
    scriptArgs: wild.args,
    executed,
  });
  if (wildResult.status !== "passed") {
    process.stdout.write(`${JSON.stringify({ ok: false, workflow: mode, step: "wild-design-selection", blockingCode: "WILD_DESIGN_GATE_BLOCKED", gate: wildResult, message: "Host implementation is blocked until a user-bound Wild Design decision passes." }, null, 2)}\n`);
    process.exit(1);
  }

  if (opt(args, "--plan-file", "")) {
    runOrThrow({
      root,
      commandArgs: ["validate-intent", ...stripCommandOnlyArgs(args)],
      executed,
      step: "validate-intent",
      failureMessage: "Host-apply intent validation failed.",
    });
  }
}

function bootstrapDesignHostProbe({ root, brand, profile, args }) {
  const migration = path.join(root, "migrations", brand);
  const goalFile = path.join(migration, "goal-contract.json");
  const manifestFile = path.join(migration, "execution-manifest.json");
  if (fs.existsSync(manifestFile)) {
    const manifest = readJsonIfExists(manifestFile);
    const delivery = evaluateHostDelivery({ root, brand });
    process.stdout.write(`${JSON.stringify({
      ok: true,
      workflow: "design-host",
      profile,
      status: manifest?.status || "unknown",
      step: "visual-probe-workflow",
      runId: manifest?.runId || null,
      currentStageId: manifest?.currentStageId || null,
      manifest: path.relative(root, manifestFile),
      userDelivery: delivery,
      userGoalCompleted: delivery.userGoalCompleted === true,
      hostFilesModified: false,
      nextAction: manifest?.currentStageId ? `Continue the existing specialist workflow at ${manifest.currentStageId}; do not create another run.` : "Inspect the existing visual-probe decision or blocker.",
      message: "The isolated visual-probe workflow already exists; the public entry will not overwrite its history.",
    }, null, 2)}\n`);
    process.exit(0);
  }
  fs.mkdirSync(migration, { recursive: true });
  fs.writeFileSync(goalFile, `${JSON.stringify({
      schema: "brand-goal/v2",
      goalId: `design-host-probe-${brand}-${Date.now()}`,
      brand,
      mode: "design-host",
      executionProfile: profile,
      requestKind: "host-concepts",
      hostTarget: opt(args, "--host-target", ""),
      sealed: true,
      thresholds: { minimumSelectableDirections: 3, maximumSelectableDirections: 3, maxAttempts: 1 },
      scope: { startupPageOnly: true, hostSourceReadOnly: true, h5BeforeUserSelection: true, fullProjectScanBeforeH5Approval: false },
    }, null, 2)}\n`);
  const workflowScript = skillScript("brand-subagent-workflow.mjs");
  const prepare = spawnSync(process.execPath, [workflowScript, "prepare", "--brand", brand, "--root", root], { cwd: root, encoding: "utf8" });
  if (prepare.status !== 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, workflow: "design-host", step: "visual-probe-prepare", blockingCode: "VISUAL_PROBE_PREPARE_FAILED", stderr: prepare.stderr, result: safeParseJson(prepare.stdout) }, null, 2)}\n`);
    process.exit(prepare.status || 1);
  }
  const firstDispatch = spawnSync(process.execPath, [workflowScript, "next", "--brand", brand, "--root", root], { cwd: root, encoding: "utf8" });
  if (firstDispatch.status !== 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, workflow: "design-host", step: "visual-probe-first-dispatch", blockingCode: "VISUAL_PROBE_FIRST_DISPATCH_FAILED", stderr: firstDispatch.stderr, result: safeParseJson(firstDispatch.stdout) }, null, 2)}\n`);
    process.exit(firstDispatch.status || 1);
  }
  const prepared = safeParseJson(prepare.stdout);
  const dispatched = safeParseJson(firstDispatch.stdout);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    workflow: "design-host",
    profile,
    status: "dispatch-ready",
    step: "h5-direction-generation",
    runId: prepared?.runId || null,
    manifest: prepared?.manifest || path.relative(root, manifestFile),
    dispatchFile: dispatched?.dispatchFile || null,
    dispatchRequest: dispatched?.dispatchRequest || null,
    learnBrandDispatched: false,
    userGoalCompleted: false,
    hostFilesModified: false,
    nextAction: "Spawn the Brand Application Designer with exactly this dispatch packet. Startup-page facts, baseline and brief were derived deterministically during prepare; do not dispatch a separate Host Strategist or create a parallel workflow.",
    message: "The public entry derived the startup-page contract deterministically and produced the three-H5 designer dispatch.",
  }, null, 2)}\n`);
  process.exit(0);
}

function runLearnBrand({ root, brand, args, executed }) {
  if (!brand) {
    fail("learn-brand requires --brand or a parsable --source-url.");
  }

  const sourceUrl = opt(args, "--source-url", "");
  let dembrandtInput = resolveDembrandtInput({ root, brand, args });

  if (!dembrandtInput && sourceUrl) {
    const extractorResult = spawnSync("node", [
      skillScript("run-dembrandt-extractor.mjs"),
      "--root",
      root,
      "--brand",
      brand,
      "--source-url",
      sourceUrl,
      ...collectExtractorArgs(args),
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    executed.push({
      step: "extract-third-party",
      command: `node skills/brand/scripts/run-dembrandt-extractor.mjs --root ${root} --brand ${brand} --source-url ${sourceUrl}${formatExtraArgs(collectExtractorArgs(args))}`,
      exitCode: extractorResult.status,
      stdout: extractorResult.stdout,
      stderr: extractorResult.stderr,
    });

    if (extractorResult.status !== 0) {
      const payload = safeParseJson(extractorResult.stdout);
      process.stdout.write(`${JSON.stringify({
        ok: false,
        workflow: "learn-brand",
        brand,
        root,
        step: "extract-third-party",
        failedCommand: executed[executed.length - 1].command,
        blockingResult: payload || null,
        stderr: extractorResult.stderr || "",
        executed,
        message: "Running dembrandt extractor failed before the learn-brand workflow could continue.",
      }, null, 2)}\n`);
      process.exit(extractorResult.status || 1);
    }

    dembrandtInput = resolveDembrandtInput({ root, brand, args });
  }

  if (!dembrandtInput) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: "learn-brand",
      brand,
      root,
      blockingResult: {
        verdict: "blocked",
        code: "dembrandt-input-required",
        message: "Missing dembrandt extractor result. Learn-brand stops before evidence mapping until seed extraction is imported.",
        expectedInput: `output/extractor-benchmark/${brand}/dembrandt/result.json`,
      },
      acceptanceReport: {
        entry: "run-brand-workflow",
        mode: "learn-brand",
        verdict: "blocked",
        summary: "The learn-brand total entry now requires a dembrandt result before it continues.",
        checklist: [
          {
            id: "dembrandt-seed",
            label: "Provide dembrandt raw extraction result",
            why: "Without third-party raw computed evidence, the learn-brand flow cannot claim it learned the site.",
            fix: `Run the extractor first, then pass --dembrandt-input <result.json> or place it at output/extractor-benchmark/${brand}/dembrandt/result.json`,
          },
        ],
        blockingPrinciples: [
          {
            id: "dembrandt-required",
            title: "Third-party extraction is mandatory in learn-brand",
            reason: "The workflow contract says learn-brand starts with extractor seed evidence.",
            fix: `Import dembrandt using --dembrandt-input <result.json> for ${brand}.`,
          },
        ],
        nextFixes: [
          `Generate output/extractor-benchmark/${brand}/dembrandt/result.json`,
          `Re-run: node skills/brand/scripts/run-brand-workflow.mjs run --mode learn-brand --brand ${brand}${sourceUrl ? ` --source-url "${sourceUrl}"` : ""} --dembrandt-input <result.json>`,
        ],
      },
      executed,
      message: "Learn-brand stopped before evidence collection because dembrandt seed input is missing.",
    }, null, 2)}\n`);
    process.exit(1);
  }

  const filtered = stripCommandOnlyArgs(args);
  runOrThrow({
    root,
    commandArgs: ["import-dembrandt", "--brand", brand, "--input", dembrandtInput, ...appendSourceUrl([], sourceUrl)],
    executed,
    step: "import-dembrandt",
    failureMessage: "Importing dembrandt evidence failed.",
  });

  if (sourceUrl) {
    const currentObservation = validatedBrowserObservation(root, brand, sourceUrl);
    if (currentObservation) {
      executed.push({
        step: "reuse-validated-browser-observation",
        command: null,
        exitCode: 0,
        evidence: {
          manifest: path.relative(root, currentObservation.manifestFile),
          brandEvidence: path.relative(root, currentObservation.evidenceFile),
          pageCount: currentObservation.pageCount,
        },
        reason: "A current browser-native observation already passed source completeness and Evidence handoff; lower-priority HTTP collection must not overwrite it.",
      });
    } else {
      runOrThrow({
        root,
        commandArgs: ["collect-site-evidence", "--brand", brand, "--source-url", sourceUrl],
        executed,
        step: "collect-site-evidence",
        failureMessage: "Collecting site evidence failed.",
      });

      const renderedEvidence = collectRenderedEvidence({ root, brand, sourceUrl, args, executed });
      runOrThrow({
        root,
        commandArgs: [
          "collect-rendered-assets",
          "--brand",
          brand,
          "--source-url",
          sourceUrl,
          "--html-file",
          renderedEvidence.htmlFile,
          "--css-files",
          renderedEvidence.cssFiles.join(","),
          "--network-file",
          renderedEvidence.networkFile,
          ...(args.includes("--update-existing") ? ["--merge-existing"] : []),
        ],
        executed,
        step: "collect-rendered-assets",
        failureMessage: "Collecting rendered assets failed.",
      });
    }

    // Evidence collection must not make an unfinished brand visible in the
    // public preview registry. Demo registration belongs after Evidence,
    // Interpreter, Design Direction and Demo gates have produced an
    // independently reviewable preview contract.
  }

  const scoredInput = resolveActionEvidenceInput({ root, brand, args });
  if (scoredInput) {
    runOrThrow({
      root,
      commandArgs: ["score-action-evidence", "--brand", brand, "--file", scoredInput],
      executed,
      step: "score-action-evidence",
      failureMessage: "Scoring action evidence failed.",
    });
  }

  const planFile = opt(filtered, "--plan-file", "");
  if (planFile) {
    runOrThrow({
      root,
      commandArgs: ["validate-intent", ...filtered],
      executed,
      step: "validate-intent",
      failureMessage: "Learn-brand should not carry host-apply intent data in this run.",
    });
  }
  if (args.includes("--source-prerequisite")) dispatchSourceLearning({ root, brand, sourceUrl, executed });
}

function dispatchSourceLearning({ root, brand, sourceUrl, executed, sourceScreenshot = null, visualAuthority, interactionEvidence, learningProfile = profile }) {
  const handoffFile = path.join(root, "source-prerequisite.json");
  const handoff = readJsonIfExists(handoffFile);
  if (handoff?.schema !== "brand-source-prerequisite/v1" || handoff.parentRequestKind !== "host-concepts" || handoff.artifactRoot !== root || handoff.sourceUrl !== sourceUrl) {
    block("SOURCE_PREREQUISITE_INVALID", "Source learning must retain its isolated parent host-concepts handoff.");
  }
  const migration = path.join(root, "migrations", brand);
  const goalFile = path.join(migration, "goal-contract.json");
  const manifestFile = path.join(migration, "execution-manifest.json");
  fs.mkdirSync(migration, { recursive: true });
  if (!fs.existsSync(goalFile)) {
    const capture = readJsonIfExists(path.join(root, "output", "extractor-benchmark", brand, "rendered", "manifest.json"));
    if (!sourceScreenshot && (capture?.sourceUrl !== sourceUrl || !capture?.browserProof?.fullPagePath)) block("SOURCE_LEARNING_CAPTURE_MISSING", "A frozen learning goal requires this run's native rendered source screenshot.");
    let goal;
    try {
      goal = createSourceLearningGoal({ root, brand, sourceUrl, profile: learningProfile, handoffFile, visualAuthority, interactionEvidence, sourceScreenshot: sourceScreenshot || capture.browserProof.fullPagePath });
    } catch (error) {
      block("SOURCE_LEARNING_GOAL_INCOMPLETE", error.message);
    }
    fs.writeFileSync(goalFile, `${JSON.stringify(goal, null, 2)}\n`);
  }
  const goal = readJsonIfExists(goalFile);
  if (goal?.mode !== "learn-brand" || goal.sourceUrl !== sourceUrl || goal.sealed !== true) block("SOURCE_LEARNING_GOAL_MISMATCH", "Do not overwrite an unrelated goal; inspect or create a new isolated run.");
  const goalIssues = validateSourceLearningGoal(goal, { root, brand, sourceUrl, handoffFile });
  if (goalIssues.length) block("SOURCE_LEARNING_GOAL_INCOMPLETE", "The existing sealed learning goal lacks required QA targets or boundaries. Preserve its history and create a new isolated run; do not patch sealed bytes.", { goalFile, missingOrInvalid: goalIssues });
  const script = skillScript("brand-subagent-workflow.mjs");
  const commands = fs.existsSync(manifestFile) ? ["next"] : ["prepare", "next"];
  let dispatch = null;
  for (const action of commands) {
    const result = spawnSync(process.execPath, [script, action, "--brand", brand, "--root", root], { cwd: root, encoding: "utf8" });
    dispatch = safeParseJson(result.stdout);
    executed.push({ step: `source-learning-${action}`, exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
    if (result.status !== 0) {
      process.stdout.write(`${JSON.stringify({ ok: false, workflow: "learn-brand", step: `source-learning-${action}`, blockingCode: "SOURCE_LEARNING_DISPATCH_FAILED", result: dispatch, stderr: result.stderr, executed }, null, 2)}\n`);
      process.exit(result.status || 1);
    }
  }
  process.stdout.write(`${JSON.stringify({ ok: true, workflow: "learn-brand", parentRequestKind: "host-concepts", status: "dispatch-ready", step: "brand-evidence-role", manifest: manifestFile, handoffFile, dispatch, fullWorkflowPass: false, hostFilesModified: false, executed, nextAction: "Execute the existing specialist dispatch with a real subagent; record its receipt and continue independent QA. Final TPP and host resume remain required; raw collection alone is not learning success." }, null, 2)}\n`);
  process.exit(0);
}

function collectRenderedEvidence({ root, brand, sourceUrl, args, executed }) {
  const updateRun = args.includes("--update-existing");
  const sourceKey = sourceCaptureKey(sourceUrl);
  const relativeOutDir = updateRun
    ? path.join("output", "extractor-benchmark", brand, "rendered-sources", sourceKey)
    : path.join("output", "extractor-benchmark", brand, "rendered");
  const manifestPath = path.join(root, relativeOutDir, "manifest.json");
  const collectorArgs = [
    ...collectRenderedCollectorArgs(args),
    "--out-dir",
    relativeOutDir,
  ];
  const result = spawnSync("node", [
    skillScript("run-rendered-evidence-collector.mjs"),
    "--root",
    root,
    "--brand",
    brand,
    "--source-url",
    sourceUrl,
    ...collectorArgs,
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  executed.push({
    step: "collect-rendered-evidence",
    command: `node skills/brand/scripts/run-rendered-evidence-collector.mjs --root ${root} --brand ${brand} --source-url ${sourceUrl}${formatExtraArgs(collectorArgs)}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });

  if (result.status !== 0) {
    const payload = safeParseJson(result.stdout) || safeParseJson(result.stderr);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: "learn-brand",
      brand,
      root,
      step: "collect-rendered-evidence",
      failedCommand: executed[executed.length - 1].command,
      blockingResult: payload || null,
      blockingCode: payload?.blockingCode || "BROWSER_RENDERED_EVIDENCE_FAILED",
      stderr: result.stderr || "",
      executed,
      message: "Collecting rendered evidence files failed before collect-rendered-assets could run.",
    }, null, 2)}\n`);
    process.exit(result.status || 1);
  }

  const manifest = readJsonIfExists(manifestPath);
  if (!manifest?.htmlFile || !Array.isArray(manifest?.cssFiles) || !manifest?.cssFiles.length || !manifest?.networkFile) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: "learn-brand",
      brand,
      root,
      step: "collect-rendered-evidence",
      blockingResult: {
        verdict: "blocked",
        code: "rendered-evidence-manifest-incomplete",
        message: "Rendered evidence manifest is missing html/css/network outputs required by collect-rendered-assets.",
        expectedManifest: path.relative(root, manifestPath),
      },
      executed,
      message: "Rendered evidence collector ran, but did not produce a complete manifest.",
    }, null, 2)}\n`);
    process.exit(1);
  }

  return manifest;
}

function sourceCaptureKey(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.replace(/^www\./, "");
    const pathKey = url.pathname.split("/").filter(Boolean).join("-") || "home";
    return sanitizeBrandKey(`${host}-${pathKey}`).slice(0, 96) || "source";
  } catch {
    return sanitizeBrandKey(sourceUrl).slice(0, 96) || "source";
  }
}

function runOrThrow({ root, commandArgs, executed, step, failureMessage }) {
  const result = runBrandGuard(root, commandArgs, { allowFailure: true });
  executed.push({
    step,
    command: `node skills/brand/scripts/brand-guard.mjs ${commandArgs.join(" ")}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.status !== 0) {
    const payload = safeParseJson(result.stdout);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: mode,
      step,
      root,
      failedCommand: executed[executed.length - 1].command,
      blockingResult: payload || null,
      stderr: result.stderr || "",
      executed,
      message: failureMessage,
    }, null, 2)}\n`);
    process.exit(result.status || 1);
  }
}

function resolveDembrandtInput({ root, brand, args }) {
  const explicit = opt(args, "--dembrandt-input", "");
  if (explicit) return explicit;
  const benchmark = path.join(root, "output", "extractor-benchmark", brand, "dembrandt", "result.json");
  return fs.existsSync(benchmark) ? benchmark : "";
}

function resolveActionEvidenceInput({ root, brand, args }) {
  const explicit = opt(args, "--action-evidence-input", "");
  if (explicit) return explicit;
  const candidates = [
    path.join(root, "migrations", brand, "action-evidence-v02.json"),
    path.join(root, "migrations", brand, "action-evidence.json"),
  ];
  return candidates.find((file) => fs.existsSync(file)) || "";
}

function appendSourceUrl(parts, sourceUrl) {
  if (!sourceUrl) return parts;
  return [...parts, "--source-url", sourceUrl];
}

function collectExtractorArgs(args) {
  const flags = ["--mobile", "--slow", "--sitemap", "--dark-mode", "--raw-colors", "--ai"];
  const options = ["--crawl", "--browser"];
  const output = [];

  for (const flag of flags) {
    if (args.includes(flag)) output.push(flag);
  }

  for (const option of options) {
    const value = opt(args, option, "");
    if (value) output.push(option, value);
  }

  return output;
}

function collectRenderedCollectorArgs(args) {
  return buildRenderedCollectorArgs(args);
}

function formatExtraArgs(args) {
  if (!args.length) return "";
  return ` ${args.join(" ")}`;
}

function stripCommandOnlyArgs(args) {
  const names = new Set(["--root", "--artifact-root", "--request-kind", "--mode", "--profile", "--base-url", "--page", "--registry-base"]);
  const flags = new Set(["--require-browser", "--force-relearn", "--update-existing", "--allow-new-brand-id"]);
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (flags.has(token)) {
      continue;
    }
    if (names.has(token)) {
      index += 1;
      continue;
    }
    output.push(token);
  }
  return output;
}

function withoutOption(args, name) {
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name) {
      index += 1;
      continue;
    }
    output.push(args[index]);
  }
  return output;
}

function normalizeEntryCommand(args) {
  const [command, ...rest] = args;
  if (command === "learn") {
    return {
      args: ["run", "--request-kind", "brand-learning", "--mode", "learn-brand", ...rest],
    };
  }
  if (command === "apply") {
    return {
      args: ["run", "--request-kind", "host-implementation", "--mode", "apply-host", ...rest],
    };
  }
  if (command === "design") {
    return { args: ["run", "--request-kind", "host-concepts", "--mode", "design-host", ...rest] };
  }
  if (command === "update") {
    return {
      args: ["run", "--request-kind", "brand-learning", "--mode", "learn-brand", "--update-existing", ...rest],
    };
  }
  return { args };
}

function resolveRequestKind(args) {
  const value = opt(args, "--request-kind", "");
  if (value && !["brand-learning", "host-concepts", "host-implementation"].includes(value)) {
    fail(`Unsupported request kind: ${value}`);
  }
  return value;
}

function resolveWorkflowMode(args, requestKind = "") {
  const explicit = opt(args, "--mode", "");
  if (explicit) {
    if (!["learn-brand", "design-host", "apply-host"].includes(explicit)) {
      fail(`Unsupported workflow mode: ${explicit}`);
    }
    return explicit;
  }

  if (requestKind === "brand-learning") return "learn-brand";
  if (requestKind === "host-concepts") return "design-host";
  if (requestKind === "host-implementation") return "apply-host";

  const hostTarget = opt(args, "--host-target", "") || opt(args, "--host-target-or-plan", "");
  const planFile = opt(args, "--plan-file", "");
  if (hostTarget || planFile) return opt(args, "--design-direction", "") || opt(args, "--application-plan", "") ? "apply-host" : "design-host";
  return "learn-brand";
}

function validateRequestKindMode(requestKind, mode) {
  if (!requestKind) return;
  const expected = {
    "brand-learning": "learn-brand",
    "host-concepts": "design-host",
    "host-implementation": "apply-host",
  }[requestKind];
  if (mode !== expected) {
    block("REQUEST_INTENT_MODE_MISMATCH", `Current-turn request kind ${requestKind} requires ${expected}; refusing ${mode}. A host concept request must never fall through to brand learning.`);
  }
}

function validateArtifactIsolation({ command, requestKind, root, artifactRoot, args }) {
  if (command !== "run" || requestKind !== "host-concepts") return { required: false, status: "not-applicable" };
  if (!artifactRoot) {
    block("ARTIFACT_ROOT_REQUIRED", "Host concept trials must use --artifact-root from brand-artifacts.mjs init; do not write migrations, output, temp registry files or skill links into the host repository.");
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    block("ARTIFACT_ROOT_INVALID", `Artifact root does not exist or is not a directory: ${root}`);
  }
  const runFile = path.join(path.dirname(root), "run.json");
  const run = readJsonIfExists(runFile);
  if (!run || run.schema !== "brand-artifact-run/v1" || run.status !== "active") {
    block("ARTIFACT_RUN_NOT_ACTIVE", `Artifact root must be the active buildDirectory returned by brand-artifacts.mjs init; missing active manifest at ${runFile}.`);
  }
  const hostTarget = opt(args, "--host-target", "") || opt(args, "--host-target-or-plan", "");
  if (!hostTarget || !path.isAbsolute(hostTarget)) {
    block("ABSOLUTE_HOST_TARGET_REQUIRED", "Host concept trials require an absolute --host-target so the isolated artifact root cannot be mistaken for the host.");
  }
  const hostPath = path.resolve(hostTarget);
  const declaredHost = path.resolve(run.host || "");
  if (!isSameOrInside(declaredHost, hostPath)) {
    block("ARTIFACT_HOST_MISMATCH", `Artifact run belongs to ${declaredHost}, not ${hostPath}.`);
  }
  if (isSameOrInside(declaredHost, root)) {
    block("HOST_ARTIFACT_ISOLATION_FAILED", "Artifact root is inside the host repository; create a new brand-artifacts run in the system temporary directory.");
  }
  return { required: true, status: "pass", artifactRoot: root, runId: run.id, host: declaredHost };
}

function installExplicitLocalStylePack({ root, brand, modFile }) {
  if (!modFile) return;
  const sourceMod = path.resolve(modFile);
  if (!fs.existsSync(sourceMod) || !fs.statSync(sourceMod).isFile()) {
    block("LOCAL_STYLE_PACK_MOD_MISSING", `The explicit Brand MOD does not exist: ${sourceMod}`);
  }
  const sourceMigration = path.dirname(sourceMod);
  const sourceRoot = path.resolve(sourceMigration, "..", "..");
  const destinationMigration = path.join(root, "migrations", brand);
  fs.mkdirSync(destinationMigration, { recursive: true });
  try {
    installComponentKits({ sourceRoot, destinationRoot: root, kits: readJsonIfExists(sourceMod)?.componentKits || [] });
  } catch (error) {
    block('LOCAL_COMPONENT_KIT_INVALID', error.message);
  }
  const packNames = [
    "brand-mod.json",
    "brand-evidence.json",
    "brand-intent.json",
    "approved-visual-patterns.json",
    "component-mapping.json",
    "dangoui-adapter.json",
  ];
  const copiedJson = [];
  for (const name of packNames) {
    const source = name === "brand-mod.json" ? sourceMod : path.join(sourceMigration, name);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    const destination = path.join(destinationMigration, name);
    if (path.resolve(source) !== path.resolve(destination)) fs.copyFileSync(source, destination);
    copiedJson.push(destination);
  }
  const references = new Set();
  for (const file of copiedJson) collectLocalPackReferences(readJsonIfExists(file), references);
  for (const reference of references) {
    if (path.isAbsolute(reference)) continue;
    const normalized = reference.replaceAll("\\", "/").replace(/^\.\//, "");
    const candidates = [
      { source: path.resolve(sourceRoot, normalized), destination: path.resolve(root, normalized), boundary: sourceRoot },
      { source: path.resolve(sourceMigration, normalized), destination: path.resolve(destinationMigration, normalized), boundary: sourceMigration },
    ];
    const match = candidates.find((item) => isSameOrInside(item.boundary, item.source) && fs.existsSync(item.source) && fs.statSync(item.source).isFile());
    if (!match || path.resolve(match.source) === path.resolve(match.destination)) continue;
    fs.mkdirSync(path.dirname(match.destination), { recursive: true });
    fs.copyFileSync(match.source, match.destination);
  }
}

function collectLocalPackReferences(value, found) {
  if (typeof value === "string") {
    const clean = value.split("#")[0];
    if (/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(clean)) found.add(clean);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item) => collectLocalPackReferences(item, found));
  if (value && typeof value === "object") Object.values(value).forEach((item) => collectLocalPackReferences(item, found));
}

function isSameOrInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveBrand(args) {
  return opt(args, "--brand", "") || inferBrandFromSource(opt(args, "--source-url", ""));
}

function resolveReadOnlyFrozenRun({ command, root, brand, mode, requestKind, args }) {
  // Inspect only the explicitly addressed run. This is an identity check for a
  // read-only query, not selection or installation of an existing brand pack.
  if (!["status", "plan"].includes(command) || !["design-host", "apply-host"].includes(mode)
      || !brand || opt(args, "--mod-file", "") || opt(args, "--style-pack", "")) return null;
  const migration = path.join(root, "migrations", brand);
  const manifest = readJsonIfExists(path.join(migration, "execution-manifest.json"));
  if (!manifest) return null;
  const invalid = (detail) => block("FROZEN_RUN_QUERY_MISMATCH", `Cannot inspect the requested frozen run: ${detail}. No brand pack was selected.`);
  if (manifest.mode !== mode) invalid("workflow mode differs");
  const goalFile = path.resolve(root, manifest.goalPath || "");
  let goal;
  try {
    if (!isSameOrInside(fs.realpathSync(root), fs.realpathSync(goalFile))) invalid("goal is outside this artifact root");
    const bytes = fs.readFileSync(goalFile);
    if (crypto.createHash("sha256").update(bytes).digest("hex") !== manifest.goalSha256) invalid("goal hash differs");
    goal = JSON.parse(bytes);
  } catch { invalid("frozen goal is missing or invalid"); }
  const expectedRequest = mode === "apply-host" ? "host-implementation" : "host-concepts";
  const hostTarget = opt(args, "--host-target", "") || opt(args, "--host-target-or-plan", "");
  if (manifest.brand !== brand || goal?.brand !== brand || goal?.mode !== mode || goal?.sealed !== true
      || goal?.requestKind !== expectedRequest || (requestKind && requestKind !== goal.requestKind)
      || !hostTarget || !goal.hostTarget || path.resolve(hostTarget) !== path.resolve(goal.hostTarget)) invalid("brand, intent or host differs");
  return { goalPath: manifest.goalPath, goalSha256: manifest.goalSha256, brand, mode, hostTarget: goal.hostTarget };
}

function resolveWorkflowIntake({ mode, brand, root, args, frozenRun = null }) {
  const sourceUrl = opt(args, "--source-url", "");
  const hostTarget = opt(args, "--host-target", "") || opt(args, "--host-target-or-plan", "");
  const planFile = opt(args, "--plan-file", "");
  const explicitDembrandtInput = opt(args, "--dembrandt-input", "");
  const resolvedDembrandtInput = resolveDembrandtInput({ root, brand, args }) || "";
  const stylePack = opt(args, "--style-pack", "");
  const modFile = opt(args, "--mod-file", "");

  const signals = {
    sourceUrl: Boolean(sourceUrl),
    hostTarget: Boolean(hostTarget),
    planFile: Boolean(planFile),
    dembrandtInput: Boolean(explicitDembrandtInput),
    extractorOutputAvailable: Boolean(resolvedDembrandtInput),
    stylePack: Boolean(stylePack),
    modFile: Boolean(modFile),
  };

  if (mode === "learn-brand") {
    const missing = [];
    const mixed = [];
    if (!brand) missing.push("--brand or parsable --source-url");
    if (!signals.sourceUrl && !signals.extractorOutputAvailable) {
      missing.push("--source-url or existing dembrandt extractor output");
    }
    if (signals.hostTarget) mixed.push("--host-target");
    if (signals.planFile) mixed.push("--plan-file");
    if (signals.stylePack) mixed.push("--style-pack");
    if (signals.modFile) mixed.push("--mod-file");

    if (missing.length || mixed.length) {
      const reasons = [];
      if (missing.length) reasons.push(`missing learn-brand inputs: ${missing.join(", ")}`);
      if (mixed.length) reasons.push(`host-apply only inputs present: ${mixed.join(", ")}`);
      return {
        ok: false,
        mode,
        signals,
        reasons,
        message: "This input set does not match learn-brand. Learning a brand should only consume brand-source evidence, not host-apply targets.",
      };
    }
  }

  if (["design-host", "apply-host"].includes(mode)) {
    const missing = [];
    if (!brand) missing.push("--brand");
    if (!signals.hostTarget && !signals.planFile) {
      missing.push("--host-target or --plan-file");
    }
    if (!signals.stylePack && !signals.modFile && !frozenRun) {
      missing.push("--style-pack or --mod-file");
    }
    if (signals.dembrandtInput) {
      return {
        ok: false,
        mode,
        signals,
        reasons: [`${mode} cannot consume raw extractor output`],
        message: `This input set mixes ${mode} with website extraction. Host work may retain a source URL as provenance, but it must consume an existing MOD/style-pack instead of raw extractor output.`,
      };
    }
    if (missing.length) {
      const brandReferenceMissing = mode === "design-host" && !brand && !signals.sourceUrl && !signals.stylePack && !signals.modFile;
      return {
        ok: false,
        mode,
        signals,
        blockingCode: brandReferenceMissing ? "BRAND_REFERENCE_REQUIRED" : `${mode.toUpperCase().replaceAll("-", "_")}_INPUT_REQUIRED`,
        reasons: [`missing ${mode} inputs: ${missing.join(", ")}`],
        question: brandReferenceMissing ? "请提供本轮要参考的品牌官网、截图、设计文件，或明确指定一个已学习的 style pack。" : null,
        message: brandReferenceMissing
          ? "Brand reference is missing for this host concept trial. Stop and ask the one focused question; do not select a historical or sample brand and do not start learn-brand."
          : `This input set does not match ${mode}. Host design or implementation needs both a host target and an existing learned style pack or MOD.`,
      };
    }
  }

  return {
    ok: true,
    mode,
    signals,
    reasons: [],
    ...(frozenRun ? { frozenRun } : {}),
    message: "Workflow intake passed. Inputs match the selected /brand path.",
  };
}

function runBrandGuard(root, guardArgs, options = {}) {
  const result = spawnSync("node", [skillScript("brand-guard.mjs"), ...guardArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BRAND_WORKFLOW_ENTRY: "run-brand-workflow",
      BRAND_WORKFLOW_MODE: mode,
    },
  });
  if (!options.allowFailure && result.status !== 0) {
    fail(result.stderr || result.stdout || `brand-guard failed: ${guardArgs.join(" ")}`);
  }
  return result;
}

function safeParseJson(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
}

function readJsonIfExists(file) {
  if (!file || !fs.existsSync(file)) return null;
  return safeParseJson(fs.readFileSync(file, "utf8"));
}

function hasStructuredActionEvidence(evidence) {
  const coverage = evidence?.dimensionCoverage?.["action-color"];
  if (coverage?.status !== "observed" || !Array.isArray(coverage.claimIds) || !coverage.claimIds.length) return false;
  const observed = new Map((evidence?.claims || []).filter((claim) => claim?.id && claim.status === "observed").map((claim) => [claim.id, claim]));
  const claims = coverage.claimIds.map((id) => observed.get(id));
  return coverage.sourceCount === claims.length && claims.every((claim) => {
    const proof = claim?.sourceProof;
    return claim?.kind === "action-color"
      && Boolean(claim.semanticRole)
      && Boolean(claim.capture?.path || claim.capture)
      && /color/i.test(String(claim.computed?.property || ""))
      && Boolean(claim.computed?.value)
      && Boolean(proof?.selector)
      && Array.isArray(proof?.visibleRect)
      && proof.visibleRect.length === 4
      && proof.visibleRect[2] > 0
      && proof.visibleRect[3] > 0
      && Boolean(proof?.paintedBackground)
      && Boolean(proof?.paintedForeground)
      && Boolean(proof?.state);
  });
}

function validatedBrowserObservation(root, brand, requestedSourceUrl = "") {
  const migration = path.join(root, "migrations", brand);
  const manifestFile = path.join(migration, "source-observation-manifest.json");
  const evidenceFile = path.join(migration, "brand-evidence.json");
  const manifest = readJsonIfExists(manifestFile);
  const evidence = readJsonIfExists(evidenceFile);
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : [];
  const requestedUrl = normalizeSourceUrl(requestedSourceUrl);
  const requestedPage = requestedUrl
    ? pages.find((page) => normalizeSourceUrl(page?.url) === requestedUrl)
    : null;
  const pagesReady = pages.length > 0 && pages.every((page) => ["pass", "covered"].includes(page?.status) || page?.readyForInterpreter === true);
  const requestedPageReady = !requestedUrl || Boolean(
    requestedPage
      && (["pass", "covered"].includes(requestedPage?.status) || requestedPage?.readyForInterpreter === true)
  );
  const observationReady = (manifest?.readyForInterpreter === true || manifest?.coverage?.readyForInterpreter === true) && pagesReady;
  const evidenceReady = evidence?.consumerDecision?.readyForInterpreter === true && evidence?.consumerDecision?.status === "PASS";
  return observationReady && evidenceReady && requestedPageReady
    ? { manifestFile, evidenceFile, pageCount: pages.length }
    : null;
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function summarizeBlockingResult(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      verdict: "blocked",
      reason: "TPP gate returned a non-JSON result.",
      blockingPrinciples: [],
      missingChecklist: [],
      nextFixes: [],
    };
  }

  const checklist = Array.isArray(payload.acceptanceChecklist) ? payload.acceptanceChecklist : [];
  const workflowAudit = payload.workflowAudit && typeof payload.workflowAudit === "object"
    ? payload.workflowAudit
    : {};
  const blockingPrinciples = Array.isArray(payload.blockingPrinciples)
    ? payload.blockingPrinciples
    : Array.isArray(payload.blocking)
      ? payload.blocking
      : [];

  const missingChecklist = checklist
    .filter((item) => item?.required && item?.status !== "complete")
    .map((item) => ({
      id: item.id,
      label: item.label,
      why: item.why || "",
      fix: item.fix || "",
    }));

  const nextFixes = dedupe(
    [
      ...missingChecklist.map((item) => item.fix).filter(Boolean),
      ...blockingPrinciples.map((item) => item?.fix).filter(Boolean),
    ],
  );

  return {
    verdict: workflowAudit.verdict || payload.verdict || "blocked",
    reason: payload.message || workflowAudit.summary || "TPP gate blocked the workflow.",
    mode: workflowAudit.resolvedMode || payload.workflow || "",
    workflowModeContract: payload.workflowModeContract || null,
    blockingPrinciples: blockingPrinciples.map((item) => ({
      id: item?.id || item?.principle || "",
      title: item?.title || "",
      reason: item?.reason || "",
      message: item?.message || "",
      fix: item?.fix || "",
    })),
    missingChecklist,
    nextFixes,
  };
}

function dedupe(items) {
  return [...new Set(items)];
}

function buildProgressSummary({ mode, outputAudit, executed }) {
  const stepStatus = outputAudit?.stepStatus || {};
  const entries = Object.entries(stepStatus);
  const completedSteps = entries
    .filter(([, status]) => status === "complete")
    .map(([step]) => step);
  const remainingSteps = entries
    .filter(([, status]) => status !== "complete")
    .map(([step]) => step);

  return {
    mode,
    totalStepCount: entries.length,
    completedStepCount: completedSteps.length,
    remainingStepCount: remainingSteps.length,
    completedSteps,
    remainingSteps,
    lastExecutedGuards: Array.isArray(executed) ? executed.map((item) => item.command) : [],
  };
}

function buildHowToTest({ root, mode, brand }) {
  const brandArgs = brand ? ` --brand ${brand}` : "";
  const wild = resolveWildDesignSet({ root, brand });
  const options = wild.options || `migrations/${brand}/design-direction-options.json`;
  const decision = wild.decision || `migrations/${brand}/design-direction-decision.json`;
  const scope = wild.scope || `migrations/${brand}/business-scope.json`;
  const direction = wild.direction || `migrations/${brand}/design-direction.json`;
  const brandEvidence = wild.brandEvidence || `migrations/${brand}/brand-evidence.json`;
  const brandMod = wild.brandMod || `migrations/${brand}/brand-mod.json`;
  const wildDesign = brand ? `node skills/brand/scripts/validate-wild-design-decision.mjs --options ${options} --decision ${decision} --business-scope ${scope} --brand-evidence ${brandEvidence} --brand-mod ${brandMod} --design-direction ${direction}` : "";
  return {
    plan: `node skills/brand/scripts/run-brand-workflow.mjs plan --mode ${mode}${brandArgs}`,
    tpp: `node skills/brand/scripts/run-brand-workflow.mjs tpp --mode ${mode}${brandArgs}`,
    handoffArtifacts: `node skills/brand/scripts/brand-guard.mjs handoff-artifact-gate --mode ${mode}${brandArgs} --strict`,
    ...(["design-host", "apply-host"].includes(mode) ? { wildDesign } : {}),
    p0Acceptance: `node skills/brand/scripts/brand-guard.mjs p0-acceptance --mode ${mode}${brandArgs}`,
    status: `node skills/brand/scripts/run-brand-workflow.mjs status --mode ${mode}${brandArgs}`,
    run: `node skills/brand/scripts/run-brand-workflow.mjs run --mode ${mode}${brandArgs}`,
  };
}

function findNestedArtifact(root, basename) {
  if (!root || !fs.existsSync(root)) return "";
  const direct = path.join(root, basename);
  if (fs.existsSync(direct)) return direct;
  const matches = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === basename) matches.push(full);
    }
  };
  walk(root);
  return matches.length === 1 ? matches[0] : "";
}

function resolveWildDesignSet({ root, brand, args = [] }) {
  const migrationDir = brand ? path.join(root, "migrations", brand) : "";
  const options = opt(args, "--wild-design-options", findNestedArtifact(migrationDir, "design-direction-options.json"));
  const cohortDir = options ? path.dirname(path.resolve(root, options)) : migrationDir;
  const nearby = (basename) => {
    let cursor = cohortDir;
    while (cursor && cursor.startsWith(path.resolve(migrationDir))) {
      const candidate = path.join(cursor, basename);
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    return findNestedArtifact(migrationDir, basename);
  };
  const decision = opt(args, "--wild-design-decision", nearby("design-direction-decision.json"));
  const scope = opt(args, "--wild-design-business-scope", nearby("business-scope.json"));
  const directionCandidate = opt(args, "--design-direction", nearby("design-direction.json"));
  const directionPayload = directionCandidate ? readJsonIfExists(path.resolve(root, directionCandidate)) : null;
  const localSelected = directionCandidate && path.resolve(root, directionCandidate) === path.join(migrationDir, "design-direction.json") ? validateLocalSelectedMaster(root, brand) : { ok: false };
  const boundLocalDirection = localSelected.ok && directionPayload?.implementationAuthority === "approved-master-artifact" && directionPayload.previewArtifact?.path === localSelected.master.artifact.path && directionPayload.previewArtifact?.sha256 === localSelected.master.artifact.sha256 && directionPayload.approvedMaster?.qaSha256 === localSelected.master.qa.sha256;
  const direction = directionPayload?.wildDesignDecision || boundLocalDirection ? directionCandidate : "";
  const brandEvidence = opt(args, "--brand-evidence", path.join(migrationDir, "brand-evidence.json"));
  const brandMod = opt(args, "--brand-mod", path.join(migrationDir, "brand-mod.json"));
  const history = opt(args, "--wild-design-history", path.join(migrationDir, "style-option-history.json"));
  const cliArgs = [];
  if (options) cliArgs.push("--options", options);
  if (decision) cliArgs.push("--decision", decision);
  if (scope) cliArgs.push("--business-scope", scope);
  if (direction) cliArgs.push("--design-direction", direction);
  if (brandEvidence && fs.existsSync(brandEvidence)) cliArgs.push("--brand-evidence", brandEvidence);
  if (brandMod && fs.existsSync(brandMod)) cliArgs.push("--brand-mod", brandMod);
  if (history && fs.existsSync(history)) cliArgs.push("--history", history);
  return { options, decision, scope, direction, brandEvidence, brandMod, history: fs.existsSync(history) ? history : "", args: cliArgs };
}

function auditWorkflowOutputs({ root, mode, brand, args = [] }) {
  const migrationDir = brand ? path.join(root, "migrations", brand) : "";
  const manifestFile = migrationDir ? path.join(migrationDir, "execution-manifest.json") : "";
  const manifest = manifestFile ? readJsonIfExists(manifestFile) : null;
  if (["design-host", "apply-host"].includes(mode) && ["design-host", "apply-host"].includes(manifest?.mode)) {
    // An existing specialist run uses the same validated delivery gate as the
    // public delivery command. Legacy option files cannot restart its selection.
    const userDelivery = manifest.mode === mode ? evaluateHostDelivery({ root, brand }) : {
      schema: "brand-parent-delivery/v1", ok: false, status: "blocked",
      userGoalCompleted: false, hostMutationAllowed: false,
      errors: ["HOST_WORKFLOW_MODE_MISMATCH"],
      nextAction: `Inspect the existing ${manifest.mode} run with its matching mode before requesting ${mode}.`,
    };
    const key = manifest.mode === "apply-host" ? "host-implementation-preview" : "host-concepts-preview";
    const status = userDelivery.status === "blocked" ? "blocked"
      : userDelivery.userGoalCompleted === true || userDelivery.previewReady === true ? "complete" : "pending";
    const outputStatus = [{ key, status, file: rel(root, manifestFile), currentStageId: manifest.currentStageId || null, gate: userDelivery }];
    return {
      userDelivery,
      stepStatus: { [key]: status },
      outputStatus,
      completedStages: status === "complete" ? [key] : [],
      missingOutputs: status === "complete" ? [] : [key],
      nextAction: userDelivery.nextAction || "Resolve the current host delivery gate errors in the existing specialist run.",
      previewArtifacts: userDelivery.previewArtifacts || (userDelivery.previewReport ? { previewReport: userDelivery.previewReport } : {}),
    };
  }
  const wild = ["design-host", "apply-host"].includes(mode) ? resolveWildDesignSet({ root, brand, args }) : null;
  const previewFile = brand ? path.join(root, "public", "brand-previews", `${brand}.json`) : "";
  const previewRegistry = path.join(root, "public", "brand-previews", "registry.json");
  const files = {
    brandMod: migrationDir ? path.join(migrationDir, "brand-mod.json") : "",
    brandEvidence: migrationDir ? path.join(migrationDir, "brand-evidence.json") : "",
    brandIntent: migrationDir ? path.join(migrationDir, "brand-intent.json") : "",
    renderedAssets: migrationDir ? path.join(migrationDir, "rendered-asset-inventory.json") : "",
    actionEvidence: migrationDir ? path.join(migrationDir, "action-evidence-score.skills.json") : "",
    dembrandt: migrationDir ? path.join(migrationDir, "third-party-evidence.dembrandt.json") : "",
    dangouiAdapter: migrationDir ? path.join(migrationDir, "dangoui-adapter.json") : "",
    hostOpportunity: migrationDir ? path.join(migrationDir, "host-opportunity-map.json") : "",
    intentPlan: migrationDir ? path.join(migrationDir, "intent-plan.json") : "",
    previewGate: migrationDir ? path.join(migrationDir, "preview-gate.json") : "",
    computedEvidence: migrationDir ? path.join(migrationDir, "computed-evidence.json") : "",
    visualQuality: migrationDir ? path.join(migrationDir, "visual-quality-report.json") : "",
    visualQa: migrationDir ? path.join(migrationDir, "visual-qa-report.json") : "",
    fidelity: migrationDir ? path.join(migrationDir, "fidelity-report.json") : "",
    generativeProof: migrationDir ? path.join(migrationDir, "generative-proof.json") : "",
    retroLearnings: migrationDir ? path.join(migrationDir, "retro-learnings.json") : "",
    componentMapping: migrationDir ? path.join(migrationDir, "component-mapping.json") : "",
    wildOptions: wild?.options || "",
    wildDecision: wild?.decision || "",
    wildScope: wild?.scope || "",
    designDirection: wild?.direction || "",
    structuralTargets: migrationDir ? findNestedArtifact(migrationDir, "structural-targets.json") : "",
    preeditBaselineBundle: migrationDir ? findNestedArtifact(migrationDir, "preedit-baseline-bundle.json") : "",
    previewFile,
  };
  const exists = Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, Boolean(value) && fs.existsSync(value)]),
  );
  if (!exists.actionEvidence && exists.brandEvidence && hasStructuredActionEvidence(readJsonIfExists(files.brandEvidence))) {
    files.actionEvidence = files.brandEvidence;
    exists.actionEvidence = true;
  }
  const wildDesignGate = ["design-host", "apply-host"].includes(mode) && exists.wildOptions && exists.wildDecision && exists.wildScope && exists.designDirection
    ? runSilentNodeCheck({
      root,
      script: "skills/brand/scripts/validate-wild-design-decision.mjs",
      scriptArgs: wild.args,
    })
    : null;
  const wildDesignPassed = wildDesignGate?.status === "passed";
  const registryHasBrand = brand ? previewRegistryIncludes(previewRegistry, brand) : false;
  const staticPreviewGate = mode === "learn-brand" && brand
    ? runSilentNodeCheck({
      root,
      script: "scripts/validate-brand-preview-registry.mjs",
      scriptArgs: [],
    })
    : null;
  const visualQualityGate = mode === "learn-brand" && brand
    ? runSilentNodeCheck({
      root,
      script: "scripts/validate-brand-visual-quality.mjs",
      scriptArgs: ["--brand", brand],
    })
    : null;
  const staticPreviewPassed = staticPreviewGate?.status === "passed";
  const visualQualityLevel = extractVisualQualityLevel(visualQualityGate, brand);
  const visualQualityReady = visualQualityGate?.status === "passed" && ["visual-quality-ready", "learning-proof-ready"].includes(visualQualityLevel);
  const fidelityReport = exists.fidelity ? readJsonIfExists(files.fidelity) : null;
  const fidelityPassed = fidelityReport?.status === "fidelity-pass";
  const fidelityFailed = Boolean(fidelityReport) && !fidelityPassed;
  const { proofStatus, threeProofsPassed, status: learningProofStatus } = readCanonicalLearningProof(fidelityReport);
  const proofBlocked = ["protocol-blocked", "learning-proof-fail"].includes(learningProofStatus);
  const failedProofs = Object.entries(proofStatus).filter(([, value]) => value === "fail").map(([key]) => key);

  if (mode === "learn-brand") {
    const outputStatus = [
      {
        key: "brand-evidence.json",
        status: exists.brandEvidence ? "complete" : "missing",
        file: rel(root, files.brandEvidence),
      },
      {
        key: "brand-intent.json",
        status: exists.brandIntent ? "complete" : "missing",
        file: rel(root, files.brandIntent),
      },
      {
        key: "brand-mod.json",
        status: exists.brandMod ? "complete" : "missing",
        file: rel(root, files.brandMod),
      },
      {
        key: "dangoui-adapter.json",
        status: exists.dangouiAdapter ? "complete" : "missing",
        file: rel(root, files.dangouiAdapter),
      },
      {
        key: "demo-preview",
        status: exists.previewFile && registryHasBrand && staticPreviewPassed
          ? "complete"
          : exists.previewFile && registryHasBrand
            ? "blocked"
            : "missing",
        file: rel(root, files.previewFile),
        gate: summarizeSilentCheck(staticPreviewGate),
      },
      {
        key: "generative-proof.json",
        status: exists.generativeProof && proofStatus.generativeProof === "pass" ? "complete" : exists.generativeProof ? "blocked" : "missing",
        file: rel(root, files.generativeProof),
        proof: proofStatus.generativeProof,
      },
      {
        key: "visual-qa-report.json",
        status: (exists.visualQa || exists.visualQuality) && visualQualityReady && fidelityPassed && threeProofsPassed
          ? "complete"
          : exists.visualQa || exists.visualQuality
            ? "blocked"
            : "missing",
        file: rel(root, exists.visualQa ? files.visualQa : files.visualQuality),
        level: visualQualityLevel || null,
        gate: summarizeSilentCheck(visualQualityGate),
      },
    ];
    const missingOutputs = outputStatus.filter((item) => item.status !== "complete").map((item) => item.key);
    return {
      stepStatus: {
        "route-intake": "complete",
        "extract-third-party": exists.dembrandt ? "complete" : "pending",
        "normalize-dtcg": exists.brandMod ? "complete" : "pending",
        "collect-brand-evidence": exists.brandEvidence && (exists.actionEvidence || exists.renderedAssets) ? "complete" : "pending",
        "translate-brand-intent": exists.brandIntent ? "complete" : "pending",
        "tpp-test": fidelityPassed && threeProofsPassed ? "complete" : fidelityFailed || proofBlocked || failedProofs.length ? "blocked" : "pending",
        "map-to-dangoui": exists.dangouiAdapter ? "complete" : "pending",
        "emit-demo-preview": exists.previewFile && registryHasBrand && staticPreviewPassed ? "complete" : "pending",
        "visual-qa": (exists.visualQa || exists.visualQuality) && visualQualityReady && fidelityPassed && threeProofsPassed
          ? "complete"
          : fidelityFailed || proofBlocked || failedProofs.length
            ? "blocked"
            : "pending",
        "record-retro": exists.retroLearnings ? "complete" : "pending",
      },
      outputStatus,
      completedStages: outputStatus.filter((item) => item.status === "complete").map((item) => item.key),
      missingOutputs,
      proofStatus,
      nextAction: failedProofs.length
        ? `Rework failed independent proof(s): ${failedProofs.join(", ")}; recapture affected pages and dispatch a fresh blind QA. Proofs cannot compensate for one another.`
        : fidelityFailed && Number(fidelityReport.attempt || 1) >= Number(fidelityReport.thresholds?.maxAttempts || 2)
        ? "Fidelity retry budget is exhausted. Keep the workflow blocked and escalate the frozen goal or implementation strategy for explicit review."
        : fidelityFailed
          ? `Apply ${rel(root, path.join(migrationDir, "quality-attempts", String(fidelityReport.attempt || 1), "rework-request.json"))}, recapture the demo, then dispatch a fresh blind QA subagent.`
        : missingOutputs[0]
        ? `Generate ${missingOutputs[0]} before treating this brand as learned.`
        : "Ready to use this learned brand in demo preview or host apply.",
      previewArtifacts: {
        previewFile: rel(root, files.previewFile),
        registry: rel(root, previewRegistry),
        staticPreviewGate: summarizeSilentCheck(staticPreviewGate),
        visualQualityGate: summarizeSilentCheck(visualQualityGate),
        visualQualityLevel: visualQualityLevel || null,
      },
    };
  }

  const outputStatus = [
    {
      key: "wild-design-selection",
      status: wildDesignPassed ? "complete" : exists.wildOptions || exists.wildDecision ? "blocked" : "missing",
      file: rel(root, files.wildDecision),
      gate: summarizeSilentCheck(wildDesignGate),
    },
    {
      key: "host-opportunity-map-or-intent-plan",
      status: exists.hostOpportunity || exists.intentPlan ? "complete" : "missing",
      file: rel(root, exists.hostOpportunity ? files.hostOpportunity : files.intentPlan),
    },
    {
      key: "coverage-level",
      status: exists.previewGate ? "complete" : "missing",
      file: rel(root, files.previewGate),
    },
    {
      key: "computed-verification-result",
      status: exists.computedEvidence || exists.visualQuality ? "complete" : "missing",
      file: rel(root, exists.computedEvidence ? files.computedEvidence : files.visualQuality),
    },
    {
      key: "host-project-preview-url",
      status: exists.previewFile && registryHasBrand ? "complete" : "missing",
      file: rel(root, files.previewFile),
    },
    {
      key: "visual-qa-report.json",
      status: exists.visualQa || exists.visualQuality ? "complete" : "missing",
      file: rel(root, exists.visualQa ? files.visualQa : files.visualQuality),
    },
  ];
  const missingOutputs = outputStatus.filter((item) => item.status !== "complete").map((item) => item.key);
  return {
    stepStatus: {
      "route-intake": "complete",
      "load-existing-mod": exists.brandMod || exists.brandEvidence || exists.brandIntent ? "complete" : "pending",
      "diagnose-host": "complete",
      "assess-host-visual-capacity": exists.hostOpportunity || exists.intentPlan ? "complete" : "pending",
      "wild-design-selection": wildDesignPassed ? "complete" : exists.wildOptions || exists.wildDecision ? "blocked" : "pending",
      "freeze-host-structural-baselines": exists.structuralTargets && exists.preeditBaselineBundle ? "complete" : "pending",
      "tpp-test": "complete",
      "map-to-dangoui": exists.dangouiAdapter || exists.componentMapping ? "complete" : "pending",
      "apply-preview": wildDesignPassed && exists.previewGate && (exists.computedEvidence || exists.visualQuality) ? "complete" : "pending",
      "visual-qa": exists.visualQa || exists.visualQuality ? "complete" : "pending",
      "record-retro": exists.retroLearnings ? "complete" : "pending",
    },
    outputStatus,
    completedStages: outputStatus.filter((item) => item.status === "complete").map((item) => item.key),
    missingOutputs,
    nextAction: missingOutputs[0]
      ? `Complete ${missingOutputs[0]} before calling the host-apply flow finished.`
      : "Host apply preview is ready for review.",
    previewArtifacts: {
      previewFile: rel(root, files.previewFile),
      previewGate: rel(root, files.previewGate),
      computedEvidence: rel(root, files.computedEvidence),
    },
  };
}

function previewRegistryIncludes(registryFile, brand) {
  if (!brand || !fs.existsSync(registryFile)) return false;
  try {
    const json = JSON.parse(fs.readFileSync(registryFile, "utf8"));
    const items = Array.isArray(json)
      ? json
      : Array.isArray(json?.brands)
        ? json.brands
        : Array.isArray(json?.items)
          ? json.items
          : [];
    return items.some((item) => item?.id === brand);
  } catch {
    return false;
  }
}

function inferBrandFromSource(sourceUrl) {
  if (!sourceUrl) return "";
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.replace(/^www\./, "");
    const lastPath = url.pathname.split("/").filter(Boolean).at(-1) || "";
    return sanitizeBrandKey(lastPath || host.split(".")[0] || "");
  } catch {
    return "";
  }
}

function sanitizeBrandKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function designHostRouteValidationArgs(root, brand, stage) {
  const routeFile = path.join(root, "migrations", brand, "design-host-route.json");
  const bundleFile = path.join(root, "migrations", brand, "design-knowledge-bundle.json");
  const skillRoot = path.dirname(skillScriptsDir);
  const bundledKnowledge = path.join(skillRoot, "knowledge-runtime");
  const knowledgeRoot = fs.existsSync(path.join(bundledKnowledge, "knowledge", "v0.1", "index.json"))
    ? bundledKnowledge
    : path.resolve(skillRoot, "../..");
  const result = ["--file", routeFile, "--stage", stage, "--workspace-root", root];
  if (fs.existsSync(bundleFile)) result.push("--knowledge-bundle", bundleFile, "--knowledge-root", knowledgeRoot);
  return result;
}

function rel(root, file) {
  return file ? path.relative(root, file) : "";
}

function opt(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function block(blockingCode, message, extra = {}) {
  process.stdout.write(`${JSON.stringify({ ok: false, blockingCode, message, ...extra }, null, 2)}\n`);
  process.exit(1);
}

function printHelp() {
  const cwd = process.cwd();
  const script = path.relative(cwd, new URL(import.meta.url).pathname);
  const contractPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "workflow-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const workflows = Object.keys(contract.workflows).join(", ");
  console.log(`run-brand-workflow

Usage:
  run --request-kind host-concepts --mode design-host --brand-root <package-directory> --host-target <host-directory> --module-task <single-module-task> --module-id <id> --module-target <relative.vue>
    Lists existing source recipes for the executing agent. Repeat with --recipes <ids> --trial-authorization <actual-user-scope> --artifact-root <new-isolated-directory> to prepare inputs and dispatch; no user-written manifest required.
  node ${script} learn --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} learn --profile fast --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} learn --force-relearn --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} update --brand pokemon30 --source-url "https://pokemon30th.com/learn/"
  node ${script} artifacts init --host /absolute/path/to/host
  node ${script} continue --artifact-root /absolute/path/to/isolated/build
  node ${script} delivery --artifact-root /absolute/path/to/isolated/build --brand pokemon30
  node ${script} resume-demo --artifact-root /absolute/path/to/isolated/build --brand pokemon30 --continue-existing
  node ${script} retry-h5 --artifact-root /absolute/path/to/isolated/build --brand pokemon30 --continue-existing
  node ${script} recover-reference --artifact-root /absolute/path/to/isolated/build --brand pokemon30 --source-root /absolute/path/to/history --source-master migrations/pokemon30/approved-master.json --source-master-sha256 <SHA256> --reason "User confirmed historical visual reference" --confirm-reference-only
  node ${script} design --artifact-root /tmp/brand-workflow-artifacts/runs/<id>/build --brand pokemon30 --host-target /absolute/path/to/host/src/pages/home/index.vue --style-pack /absolute/path/to/style-pack.json
  node ${script} apply --brand pokemon30 --host-target src/pages/home/index.vue --style-pack migrations/pokemon30/style-pack.json
  node ${script} run --request-kind brand-learning --mode learn-brand --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} run --request-kind host-concepts --mode design-host --artifact-root /tmp/brand-workflow-artifacts/runs/<id>/build --brand pokemon30 --host-target /absolute/path/to/host/src/pages/home/index.vue --style-pack /absolute/path/to/style-pack.json
  node ${script} run --request-kind host-implementation --mode apply-host --brand pokemon30 --host-target src/pages/home/index.vue --style-pack migrations/pokemon30/style-pack.json
  node ${script} status --mode learn-brand --brand pokemon30
  node ${script} detect --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} tpp --mode learn-brand --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} plan --mode learn-brand --brand pokemon30 --source-url "https://pokemon30th.com/"

Behavior:
  - every raw \`run\` declares the current-turn outcome with \`--request-kind\`; a mismatch with \`--mode\` is rejected before Registry lookup or file writes
  - \`continue\` keeps the parent host-concepts target, validates learning and resumes in an isolated child build; it never delivers the learning page as the host result
  - \`delivery\` checks exact H5 and independent QA hashes plus a review-backed recommendation; dispatch, learning completion and recommendation are not host-edit permission
  - host-concepts requires an active isolated build directory returned by \`artifacts init\` and an absolute host target; trial outputs never enter the host repository
  - explicit aliases: \`learn\` => new learn-brand, \`update\` => existing learn-brand with inherited source history, \`design\` => design-host, \`apply\` => apply-host
  - \`update\` validates migrations/<brand>/source-manifest.json before extraction and only appends sources; a missing historical source blocks with LEARNED_SOURCE_DROPPED
  - learn-brand defaults to \`--profile full\`; use \`--profile fast\` for a bounded direction-validation run
  - \`--force-relearn\` revalidates an existing brand id and stores run history as internal revisions; it does not create a second Registry project
  - a parallel brand id requires explicit user intent and the maintainer-only \`--allow-new-brand-id\` flag
  - \`detect\` resolves whether the intake belongs to brand learning, host direction design or frozen-direction implementation
  - design-host must stop for an explicit user direction decision; apply-host cannot generate or repair design directions
  - if you mix the flows, intake fails before any downstream step runs
  - raw \`run\` still resolves workflow mode automatically (${workflows})
  - \`plan\` only shows the resolved workflow and current missing outputs
  - \`tpp\` only verifies the blocking gate through total-entry
  - \`run\` verifies the gate and audits expected workflow outputs
  - \`status\` reuses the audit output so you can quickly see how many steps are left
  - any real execution must go through this total-entry wrapper
`);
}
