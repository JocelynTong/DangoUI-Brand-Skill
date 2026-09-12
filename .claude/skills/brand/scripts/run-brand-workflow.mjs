#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const originalArgs = process.argv.slice(2);
const normalized = normalizeEntryCommand(originalArgs);
const rawArgs = normalized.args;
const command = rawArgs[0];

if (!command || ["-h", "--help", "help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

if (!["run", "plan", "status", "tpp", "detect"].includes(command)) {
  fail(`Unknown command: ${command}`);
}

const mode = resolveWorkflowMode(rawArgs.slice(1));
const profile = opt(rawArgs, "--profile", "full");
if (mode === "learn-brand" && !["fast", "full"].includes(profile)) {
  fail(`Unknown learn-brand profile: ${profile}. Use fast or full.`);
}
const root = opt(rawArgs, "--root", process.cwd());
const brand = resolveBrand(rawArgs.slice(1));
const passthroughArgs = rawArgs.slice(1);
const intake = resolveWorkflowIntake({
  mode,
  brand,
  root,
  args: passthroughArgs,
});

if (!intake.ok) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    command,
    workflow: mode,
    profile,
    brand,
    root,
    intake,
    message: intake.message,
  }, null, 2)}\n`);
  process.exit(1);
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

if (command === "detect") {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    command,
    workflow: mode,
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
    },
    progress: buildProgressSummary({ mode, outputAudit, executed: [] }),
    stepStatus: outputAudit.stepStatus,
    outputStatus: outputAudit.outputStatus,
    completedStages: outputAudit.completedStages,
    missingOutputs: outputAudit.missingOutputs,
    nextAction: outputAudit.nextAction,
    previewArtifacts: outputAudit.previewArtifacts,
    howToTest: buildHowToTest({ root, mode, brand }),
    message: "Workflow plan generated. This command only shows the resolved flow and current missing outputs.",
  }, null, 2)}\n`);
  process.exit(0);
}

if (command === "run") {
  executeWorkflow({
    root,
    mode,
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
const completed = outputAudit.missingOutputs.length === 0;
const progress = buildProgressSummary({ mode, outputAudit, executed });

process.stdout.write(`${JSON.stringify({
  ok: true,
  command,
  workflow: mode,
  profile,
  brand,
  root,
  workflowContract: workflowContractSummary,
  workflowDefinition: workflowDefinitionSummary,
  intake,
  executed,
  completed,
  progress,
  stepStatus: outputAudit.stepStatus,
  outputStatus: outputAudit.outputStatus,
  completedStages: outputAudit.completedStages,
  missingOutputs: outputAudit.missingOutputs,
  nextAction: outputAudit.nextAction,
  previewArtifacts: outputAudit.previewArtifacts,
  howToTest: buildHowToTest({ root, mode, brand }),
  message: completed
    ? "Brand workflow gate passed and the expected outputs are present."
    : "Brand workflow gate passed, but the expected outputs are still incomplete. Keep going until the missing outputs are generated.",
}, null, 2)}\n`);

function buildGuardCommands(modeName, passthroughArgs) {
  const filtered = stripCommandOnlyArgs(passthroughArgs);
  const commands = [];

  if (modeName === "apply-host" && opt(filtered, "--plan-file", "")) {
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
  if (!enabled) {
    return {
      status: "missing",
      command: `node ${script}${formatExtraArgs(scriptArgs)}`,
      stdout: "",
      stderr: `${script} does not exist.`,
    };
  }

  const result = spawnSync("node", [script, ...scriptArgs], {
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
    status: result.status === 0 ? "passed" : "failed",
    command: record.command,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runSilentNodeCheck({ root, script, scriptArgs = [] }) {
  const scriptFile = path.join(root, script);
  if (!fs.existsSync(scriptFile)) {
    return {
      status: "missing",
      command: `node ${script}${formatExtraArgs(scriptArgs)}`,
      stdout: "",
      stderr: `${script} does not exist.`,
    };
  }

  const result = spawnSync("node", [script, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status === 0 ? "passed" : "failed",
    command: `node ${script}${formatExtraArgs(scriptArgs)}`,
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function summarizeSilentCheck(result) {
  if (!result) return null;
  const text = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
  return {
    status: result.status,
    command: result.command,
    exitCode: result.exitCode ?? null,
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

function executeWorkflow({ root, mode, brand, args, executed }) {
  if (mode === "learn-brand") {
    runLearnBrand({
      root,
      brand,
      args,
      executed,
    });
    return;
  }

  const wild = resolveWildDesignSet({ root, brand, args });
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

function runLearnBrand({ root, brand, args, executed }) {
  if (!brand) {
    fail("learn-brand requires --brand or a parsable --source-url.");
  }

  const sourceUrl = opt(args, "--source-url", "");
  let dembrandtInput = resolveDembrandtInput({ root, brand, args });

  if (!dembrandtInput && sourceUrl) {
    const extractorResult = spawnSync("node", [
      "skills/brand/scripts/run-dembrandt-extractor.mjs",
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
      ],
      executed,
      step: "collect-rendered-assets",
      failureMessage: "Collecting rendered assets failed.",
    });

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
}

function collectRenderedEvidence({ root, brand, sourceUrl, args, executed }) {
  const manifestPath = path.join(root, "output", "extractor-benchmark", brand, "rendered", "manifest.json");
  const result = spawnSync("node", [
    "skills/brand/scripts/run-rendered-evidence-collector.mjs",
    "--root",
    root,
    "--brand",
    brand,
    "--source-url",
    sourceUrl,
    ...collectRenderedCollectorArgs(args),
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  executed.push({
    step: "collect-rendered-evidence",
    command: `node skills/brand/scripts/run-rendered-evidence-collector.mjs --root ${root} --brand ${brand} --source-url ${sourceUrl}${formatExtraArgs(collectRenderedCollectorArgs(args))}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });

  if (result.status !== 0) {
    const payload = safeParseJson(result.stdout);
    process.stdout.write(`${JSON.stringify({
      ok: false,
      workflow: "learn-brand",
      brand,
      root,
      step: "collect-rendered-evidence",
      failedCommand: executed[executed.length - 1].command,
      blockingResult: payload || null,
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
  const passthrough = [];
  if (args.includes("--slow")) passthrough.push("--slow");
  if (args.includes("--dark-mode")) passthrough.push("--dark-mode");
  return passthrough;
}

function formatExtraArgs(args) {
  if (!args.length) return "";
  return ` ${args.join(" ")}`;
}

function stripCommandOnlyArgs(args) {
  const names = new Set(["--root", "--mode", "--profile", "--base-url", "--page"]);
  const flags = new Set(["--require-browser"]);
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

function normalizeEntryCommand(args) {
  const [command, ...rest] = args;
  if (command === "learn") {
    return {
      args: ["run", "--mode", "learn-brand", ...rest],
    };
  }
  if (command === "apply") {
    return {
      args: ["run", "--mode", "apply-host", ...rest],
    };
  }
  return { args };
}

function resolveWorkflowMode(args) {
  const explicit = opt(args, "--mode", "");
  if (explicit) {
    if (!["learn-brand", "apply-host"].includes(explicit)) {
      fail(`Unsupported workflow mode: ${explicit}`);
    }
    return explicit;
  }

  const hostTarget = opt(args, "--host-target", "") || opt(args, "--host-target-or-plan", "");
  const planFile = opt(args, "--plan-file", "");
  return hostTarget || planFile ? "apply-host" : "learn-brand";
}

function resolveBrand(args) {
  return opt(args, "--brand", "") || inferBrandFromSource(opt(args, "--source-url", ""));
}

function resolveWorkflowIntake({ mode, brand, root, args }) {
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

  if (mode === "apply-host") {
    const missing = [];
    if (!brand) missing.push("--brand");
    if (!signals.hostTarget && !signals.planFile) {
      missing.push("--host-target or --plan-file");
    }
    if (!signals.stylePack && !signals.modFile) {
      missing.push("--style-pack or --mod-file");
    }
    if (signals.sourceUrl || signals.dembrandtInput) {
      return {
        ok: false,
        mode,
        signals,
        reasons: ["apply-host should consume an existing learned style, not raw website extraction inputs"],
        message: "This input set mixes host apply with website learning. Apply-host must start from an existing MOD/style-pack, then target a host page.",
      };
    }
    if (missing.length) {
      return {
        ok: false,
        mode,
        signals,
        reasons: [`missing apply-host inputs: ${missing.join(", ")}`],
        message: "This input set does not match apply-host. Applying to a host project needs both a host target and an existing learned style pack or MOD.",
      };
    }
  }

  return {
    ok: true,
    mode,
    signals,
    reasons: [],
    message: "Workflow intake passed. Inputs match the selected /brand path.",
  };
}

function runBrandGuard(root, guardArgs, options = {}) {
  const result = spawnSync("node", ["skills/brand/scripts/brand-guard.mjs", ...guardArgs], {
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
  const wildDesign = brand ? `node skills/brand/scripts/validate-wild-design-decision.mjs --options ${options} --decision ${decision} --business-scope ${scope} --brand-evidence ${brandEvidence} --design-direction ${direction}` : "";
  return {
    plan: `node skills/brand/scripts/run-brand-workflow.mjs plan --mode ${mode}${brandArgs}`,
    tpp: `node skills/brand/scripts/run-brand-workflow.mjs tpp --mode ${mode}${brandArgs}`,
    handoffArtifacts: `node skills/brand/scripts/brand-guard.mjs handoff-artifact-gate --mode ${mode}${brandArgs} --strict`,
    ...(mode === "apply-host" ? { wildDesign } : {}),
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
  const direction = opt(args, "--design-direction", nearby("design-direction.json"));
  const brandEvidence = opt(args, "--brand-evidence", path.join(migrationDir, "brand-evidence.json"));
  const cliArgs = [];
  if (options) cliArgs.push("--options", options);
  if (decision) cliArgs.push("--decision", decision);
  if (scope) cliArgs.push("--business-scope", scope);
  if (direction) cliArgs.push("--design-direction", direction);
  if (brandEvidence && fs.existsSync(brandEvidence)) cliArgs.push("--brand-evidence", brandEvidence);
  return { options, decision, scope, direction, brandEvidence, args: cliArgs };
}

function auditWorkflowOutputs({ root, mode, brand, args = [] }) {
  const migrationDir = brand ? path.join(root, "migrations", brand) : "";
  const wild = mode === "apply-host" ? resolveWildDesignSet({ root, brand, args }) : null;
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
  const wildDesignGate = mode === "apply-host" && exists.wildOptions && exists.wildDecision && exists.wildScope && exists.designDirection
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
  const proofValue = (key) => {
    const value = fidelityReport?.proofs?.[key] ?? fidelityReport?.proofStatus?.[key];
    return typeof value === "string" ? value : value?.status || "pending";
  };
  const proofStatus = {
    evidenceFidelity: proofValue("evidenceFidelity"),
    structuralFidelity: proofValue("structuralFidelity"),
    generativeProof: proofValue("generativeProof"),
  };
  const threeProofsPassed = Object.values(proofStatus).every((value) => value === "pass");
  const failedProofs = Object.entries(proofStatus).filter(([, value]) => value === "fail").map(([key]) => key);

  if (mode === "learn-brand") {
    const outputStatus = [
      {
        key: "brand-mod.json",
        status: exists.brandMod ? "complete" : "missing",
        file: rel(root, files.brandMod),
      },
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
        "tpp-test": fidelityPassed && threeProofsPassed ? "complete" : fidelityFailed || failedProofs.length ? "blocked" : "pending",
        "map-to-dangoui": exists.dangouiAdapter ? "complete" : "pending",
        "emit-demo-preview": exists.previewFile && registryHasBrand && staticPreviewPassed ? "complete" : "pending",
        "visual-qa": (exists.visualQa || exists.visualQuality) && visualQualityReady && fidelityPassed && threeProofsPassed
          ? "complete"
          : fidelityFailed || failedProofs.length
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

function printHelp() {
  const cwd = process.cwd();
  const script = path.relative(cwd, new URL(import.meta.url).pathname);
  const contractPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "workflow-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const workflows = Object.keys(contract.workflows).join(", ");
  console.log(`run-brand-workflow

Usage:
  node ${script} learn --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} learn --profile fast --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} apply --brand pokemon30 --host-target src/pages/home/index.vue --style-pack migrations/pokemon30/style-pack.json
  node ${script} run --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} run --mode apply-host --brand pokemon30 --host-target src/pages/home/index.vue --style-pack migrations/pokemon30/style-pack.json
  node ${script} status --mode learn-brand --brand pokemon30
  node ${script} detect --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} tpp --mode learn-brand --brand pokemon30 --source-url "https://pokemon30th.com/"
  node ${script} plan --mode learn-brand --brand pokemon30 --source-url "https://pokemon30th.com/"

Behavior:
  - explicit aliases: \`learn\` => learn-brand, \`apply\` => apply-host
  - learn-brand defaults to \`--profile full\`; use \`--profile fast\` for a bounded direction-validation run
  - \`detect\` only resolves the workflow intake and shows whether inputs belong to learning or host apply
  - if you mix the two flows, intake fails before any downstream step runs
  - raw \`run\` still resolves workflow mode automatically (${workflows})
  - \`plan\` only shows the resolved workflow and current missing outputs
  - \`tpp\` only verifies the blocking gate through total-entry
  - \`run\` verifies the gate and audits expected workflow outputs
  - \`status\` reuses the audit output so you can quickly see how many steps are left
  - any real execution must go through this total-entry wrapper
`);
}
