#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateNavigationShellPreview } from "./finalize-h5-direction-stage.mjs";
import { validateLocalSelectedMaster } from "./selected-h5-handoff.mjs";
import { collectPngReferences, resolveEvidenceReference } from "./evidence-file-references.mjs";
import { selectedPosteditContext, selectedPosteditCliOptions } from "./selected-h5-postedit-context.mjs";

// Implementation consumes the selected master, not all historical candidates.
export function validateFrozenHostMaster({ root, brand, hostTarget, selectedHostOptions = {} } = {}) {
  const base = path.resolve(root);
  const migration = path.join(base, "migrations", brand);
  const failures = [];
  const fail = (code) => failures.push(code);
  const load = (name) => { try { return readJson(path.join(migration, name)); } catch { fail(`FROZEN_DESIGN_FILE_INVALID:${name}`); return {}; } };
  const bind = (ref, code, boundary = base) => {
    const file = ref?.path ? path.resolve(boundary, ref.path) : "";
    if (!file || !file.startsWith(`${boundary}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile() || sha256File(file) !== ref?.sha256) { fail(code); return null; }
    return file;
  };
  const master = load("approved-master.json"), direction = load("design-direction.json"), plan = load("brand-application-plan.json");
  if (master.permissionScope === "local-host-implementation-only") {
    let context; try { context=selectedPosteditContext(base,brand,selectedHostOptions); } catch(error) { failures.push(error.message); context={}; }
    const local = validateLocalSelectedMaster(base, brand,context);
    if (!local.ok) failures.push(...local.errors);
  }
  const trial = master.approvalScope === "trial-implementation-only";
  if (master.status !== "approved" || master.approvalSource !== "explicit-user" || !["trial-implementation-only", "approved-implementation"].includes(master.approvalScope) || master.aestheticApproval !== (trial ? "pending" : "approved")) fail("FROZEN_DESIGN_APPROVED_MASTER_INVALID");
  const html = bind(master.artifact, "FROZEN_DESIGN_APPROVED_MASTER_ARTIFACT_MISMATCH");
  const qaFile = bind(master.qa, "FROZEN_DESIGN_QA_HASH_MISMATCH");
  const qa = qaFile ? readJson(qaFile) : {};
  const verdict = String(qa.verdict || qa.status || "").toLowerCase();
  const ready = trial && (verdict === "partial_local_trial_ready_for_user_aesthetic_review" || qa.schemaVersion === "brand-local-trial-input-qa/v1" && qa.trialReadiness === "READY_AS_SCOPED_VISUAL_INPUT_WITH_HOST_ADAPTATION_BOUNDARIES" && qa.aestheticApproval === "pending" && qa.fullWorkflowPass === false);
  const candidateSha256 = qa.schema === "selected-h5-implementation-input-qa/v1" && master.permissionScope === "local-host-implementation-only" ? qa.candidate?.sha256 : qa.candidateSha256;
  if (!(verdict === "pass" || ready) || candidateSha256 !== master.artifact?.sha256 || array(qa.blockingFindingsInFinalReviewedScope).length || array(qa.blockingFindings).length || array(qa.blocking).length) fail("FROZEN_DESIGN_QA_NOT_READY");
  const provenance = qa.provenance || (qa.schemaVersion === "brand-local-trial-input-qa/v1" ? {producerId:qa.producerAgent,reviewerId:qa.reviewerAgent,independent:true} : null);
  if (!provenance?.producerId || !provenance?.reviewerId || provenance.producerId === provenance.reviewerId || provenance.independent !== true) fail("FROZEN_DESIGN_INDEPENDENT_QA_REQUIRED");
  if (master.asset) bind(master.asset, "FROZEN_DESIGN_ASSET_HASH_MISMATCH");
  if (master.asset && direction.asset?.sha256 !== master.asset.sha256) fail("FROZEN_DESIGN_ASSET_DIRECTION_MISMATCH");
  if (master.asset && qa.assetSha256 !== master.asset.sha256) fail("FROZEN_DESIGN_QA_ASSET_MISMATCH");
  if (direction.implementationAuthority !== "approved-master-artifact" || direction.previewArtifact?.path !== master.artifact?.path || direction.previewArtifact?.sha256 !== master.artifact?.sha256 || plan.approvedMaster?.sha256 !== master.artifact?.sha256 || direction.approvedMaster?.qaSha256 !== master.qa?.sha256) fail("FROZEN_DESIGN_MASTER_DIRECTION_MISMATCH");
  const boundInputs = {};
  for (const name of ["brandMod", "brandEvidence", "businessScope"]) boundInputs[name] = bind(direction.frozenInputs?.[name], `FROZEN_DESIGN_INPUT_HASH_MISMATCH:${name}`);
  const business = boundInputs.businessScope ? readJson(boundInputs.businessScope) : {};
  if (!business.primaryTask?.trim() || !business.informationDistributionContract?.model?.trim() || !array(business.informationDistributionContract?.scanOrder).length || !array(business.informationDistributionContract?.previewUnit?.requiredDecisionFields).length) fail("FROZEN_DESIGN_BUSINESS_CONTRACT_REQUIRED");
  const shell = master.navigationShellContract;
  const baselineFile = bind(shell?.baseline, "FROZEN_DESIGN_NAVIGATION_BASELINE_MISMATCH");
  const baseline = baselineFile ? readJson(baselineFile) : {};
  if (!["native-preserved", "custom-contained", "custom-immersive"].includes(shell?.treatment) || !["continuous", "explicit-boundary"].includes(shell?.sceneContinuity)) fail("FROZEN_DESIGN_NAVIGATION_SHELL_UNRESOLVED");
  const ids = array(baseline.navigationShellContract?.items).map(item => item.id).sort();
  if (!ids.length || JSON.stringify(ids) !== JSON.stringify(array(shell?.itemIds).slice().sort())) fail("FROZEN_DESIGN_NAVIGATION_ITEMS_MISMATCH");
  if (html) failures.push(...validateNavigationShellPreview(fs.readFileSync(html, "utf8"), baseline.navigationShellContract));
  if (html && (!fs.readFileSync(html, "utf8").includes(`data-navigation-shell-treatment="${shell?.treatment}"`) || !fs.readFileSync(html, "utf8").includes(`data-scene-continuity="${shell?.sceneContinuity}"`))) fail("FROZEN_DESIGN_NAVIGATION_TREATMENT_MISMATCH");
  const source = shell?.currentSourceBaseline;
  const host = resolveProjectRoot(path.resolve(base, hostTarget || "."));
  if (!source || path.resolve(source.hostRoot || ".") !== host || !source.route) fail("FROZEN_DESIGN_CURRENT_HOST_BINDING_REQUIRED");
  else {
    if (!(master.permissionScope === "local-host-implementation-only" && selectedHostOptions.phase === "postedit" && failures.length===0)) bind({ path: source.source, sha256: source.sha256 }, "FROZEN_DESIGN_CURRENT_SOURCE_MISMATCH", host);
    if (source.appConfigSha256) {
      const config = ["src/app.config.js", "src/app.config.ts"].find(name => fs.existsSync(path.join(host, name)));
      bind({path: config, sha256: source.appConfigSha256}, "FROZEN_DESIGN_CURRENT_ROUTE_MISMATCH", host);
    }
  }
  const authority = master.trialAuthority || master.implementationScope;
  const scope = authority?.implementationScope || authority;
  if (!scope || !array(scope.apply).length || !array(scope.keep).length || JSON.stringify(scope) !== JSON.stringify(plan.activeRevisionScope) || trial && direction.approvalScope !== "trial-implementation-only") fail("FROZEN_DESIGN_IMPLEMENTATION_SCOPE_REQUIRED");
  if (trial && JSON.stringify(direction.trialAuthority?.implementationScope) !== JSON.stringify(scope)) fail("FROZEN_DESIGN_DIRECTION_SCOPE_MISMATCH");
  const protectedSemantics = authority?.protectedSemantics || master.protectedSemantics;
  if (!protectedSemantics || !Object.values(protectedSemantics).some(value => (typeof value === "string" && value.trim().length) || (master.permissionScope === "local-host-implementation-only" && Array.isArray(value) && value.length && value.every(item => typeof item === "string" && item.trim())))) fail("FROZEN_DESIGN_PROTECTED_SEMANTICS_REQUIRED");
  if (trial || authority?.handoff) {
    const handoffFile = bind(authority?.handoff, "FROZEN_DESIGN_HANDOFF_HASH_MISMATCH");
    const handoff = handoffFile ? readJson(handoffFile) : {};
    if (JSON.stringify(handoff.protectedSemantics) !== JSON.stringify(protectedSemantics) || JSON.stringify(handoff.scope) !== JSON.stringify(scope) || handoff.hostRoot !== host || handoff.targetSource !== source?.source) fail("FROZEN_DESIGN_HANDOFF_SCOPE_MISMATCH");
  }
  return { ok: failures.length === 0, verdict: failures.length ? "blocked" : "pass", failures, approvalScope: master.approvalScope, aestheticApproval: master.aestheticApproval, completionAuthority: trial ? "trial-only" : "runtime-qa-required" };
}

export function runApplyHostPreflight({ root = process.cwd(), brand, hostTarget, profile = "fast", phase = "implementation", write = true } = {}) {
  const startedAt = new Date();
  const rootPath = path.resolve(root);
  const migrationRoot = path.join(rootPath, "migrations", brand || "");
  const requestedHostRoot = path.resolve(rootPath, hostTarget || ".");
  const hostRoot = resolveProjectRoot(requestedHostRoot);
  const blocking = [];
  const warnings = [];
  const required = ["brand-mod.json", "brand-evidence.json", "brand-intent.json"];
  if (["standard", "certification"].includes(profile)) required.push("component-mapping.json");

  if (!brand) blocking.push("BRAND_REQUIRED");
  if (!fs.existsSync(requestedHostRoot)) blocking.push("HOST_TARGET_MISSING");
  const files = {};
  for (const name of required) {
    const file = path.join(migrationRoot, name);
    files[name] = file;
    if (!fs.existsSync(file)) blocking.push(`FROZEN_PACK_FILE_MISSING:${name}`);
  }
  // Apply-host starts with Host Strategy. The strategy pass owns the full host
  // inventory and approved structural targets; the orchestrator can only freeze
  // the pre-edit bundle after those targets exist. Requiring those two generated
  // artifacts here creates a circular gate that blocks Host Strategy itself.
  const frozenDesignFiles = ["brand-application-plan.json", "design-direction-options.json", "design-direction-decision.json", "business-scope.json", "approved-master.json", "design-direction.json"];
  const hostStrategyGeneratedFiles = ["structural-targets.json", "preedit-baseline-bundle.json"];
  if (phase === "implementation") {
    for (const name of frozenDesignFiles) {
      const file = path.join(migrationRoot, name);
      files[name] = file;
      if (!fs.existsSync(file)) blocking.push(`FROZEN_DESIGN_FILE_MISSING:${name}`);
    }
    const masterFile = files["approved-master.json"];
    const directionFile = files["design-direction.json"];
    if (masterFile && directionFile && fs.existsSync(masterFile) && fs.existsSync(directionFile)) {
      const master = readJson(masterFile);
      const direction = readJson(directionFile);
      const artifactPath = master?.artifact?.path ? path.resolve(rootPath, master.artifact.path) : "";
      if (master?.status !== "approved" || master?.approvalSource !== "explicit-user") blocking.push("FROZEN_DESIGN_APPROVED_MASTER_INVALID");
      if (!artifactPath || !fs.existsSync(artifactPath) || sha256File(artifactPath) !== master?.artifact?.sha256) blocking.push("FROZEN_DESIGN_APPROVED_MASTER_ARTIFACT_MISMATCH");
      if (!master?.navigationShellContract?.baseline?.sha256 || !Array.isArray(master?.navigationShellContract?.itemIds) || !master.navigationShellContract.itemIds.length || !["native-preserved", "custom-contained", "custom-immersive"].includes(master.navigationShellContract.treatment) || !["continuous", "explicit-boundary"].includes(master.navigationShellContract.sceneContinuity)) blocking.push("FROZEN_DESIGN_NAVIGATION_SHELL_UNRESOLVED");
      if (direction?.implementationAuthority !== "approved-master-artifact" || direction?.previewArtifact?.path !== master?.artifact?.path || direction?.previewArtifact?.sha256 !== master?.artifact?.sha256) blocking.push("FROZEN_DESIGN_MASTER_DIRECTION_MISMATCH");
    }
  } else if (phase !== "design") {
    blocking.push(`UNKNOWN_PREFLIGHT_PHASE:${phase}`);
  }

  const referencedEvidence = new Set();
  for (const name of ["brand-evidence.json", "brand-intent.json"]) {
    const file = files[name];
    if (!file || !fs.existsSync(file)) continue;
    collectPngReferences(readJson(file), referencedEvidence);
  }
  for (const reference of referencedEvidence) {
    const file = resolveEvidenceReference(rootPath, migrationRoot, reference);
    if (!file || !fs.existsSync(file)) blocking.push(`FROZEN_EVIDENCE_MISSING:${reference}`);
  }

  let hostPackage = null;
  const packageFile = path.join(hostRoot, "package.json");
  if (!fs.existsSync(packageFile)) blocking.push("HOST_PACKAGE_JSON_MISSING");
  else hostPackage = readJson(packageFile);
  if (!fs.existsSync(path.join(hostRoot, "src"))) warnings.push("HOST_SRC_DIRECTORY_MISSING");

  const targetResolution = resolveHostTarget(hostRoot, requestedHostRoot);
  const startupPage = phase === "design" ? buildHostStartupPage(rootPath, hostRoot, requestedHostRoot, targetResolution) : null;
  const layoutChecks = inspectHostLayout(hostRoot, startupPage?.sourceFile ? [path.join(hostRoot, startupPage.sourceFile)] : null);
  const pageInventory = phase === "implementation" ? buildHostPageInventory(rootPath, hostRoot, targetResolution) : null;
  if (phase === "design" && !startupPage?.sourceFile) blocking.push("HOST_STARTUP_PAGE_SOURCE_UNRESOLVED");
  if (phase === "implementation" && !pageInventory.pages.length) blocking.push("HOST_PAGE_INVENTORY_EMPTY");
  if (phase === "implementation") for (const route of pageInventory.discovery.unresolvedDeclaredRoutes) blocking.push(`HOST_DECLARED_ROUTE_SOURCE_UNRESOLVED:${route}`);
  for (const issue of layoutChecks.issues) blocking.push(`${issue.code}:${issue.file}`);
  for (const issue of layoutChecks.warnings) warnings.push(`${issue.code}:${issue.file}`);

  const dependencies = { ...(hostPackage?.dependencies || {}), ...(hostPackage?.devDependencies || {}) };
  const hostSurface = classifyHostSurface({ hostPackage, dependencies });
  const dangouiDeclared = Boolean(dependencies.dangoui);
  if (!dangouiDeclared) {
    if (profile === "certification") blocking.push("DANGOUI_RUNTIME_NOT_DECLARED");
    else warnings.push("DANGOUI_RUNTIME_NOT_DECLARED:PARTIAL_STYLE_ONLY");
  }

  const cacheInputs = [...Object.values(files), packageFile].filter((file) => file && fs.existsSync(file));
  const cacheKey = sha256(cacheInputs.map((file) => `${path.relative(rootPath, file)}:${sha256File(file)}`).join("\n"));
  const endedAt = new Date();
  const lane = phase === "design" ? "design-host" : "apply-host";
  const result = {
    schema: `brand-${lane}-preflight/v1`,
    lane,
    brand,
    profile,
    phase,
    hostTarget: path.relative(rootPath, hostRoot) || ".",
    startedAt: startedAt.toISOString(),
    completedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    verdict: blocking.length ? "blocked" : "pass",
    frozenPack: {
      trusted: blocking.every((item) => !item.startsWith("FROZEN_")),
      requiredFiles: required,
      referencedEvidenceCount: referencedEvidence.size,
      cacheKey,
      reuseDecision: blocking.some((item) => item.startsWith("FROZEN_")) ? "blocked" : "reuse-without-relearning",
    },
    frozenDesign: {
      required: phase === "implementation",
      requiredFiles: frozenDesignFiles,
      generatedAfterHostStrategy: hostStrategyGeneratedFiles,
      reuseDecision: phase === "design" ? "not-yet-required" : blocking.some((item) => item.startsWith("FROZEN_DESIGN_")) ? "return-to-design-host" : "consume-without-redesign",
    },
    runtime: {
      dangouiDeclared,
      declaredVersion: dependencies.dangoui || null,
      maximumClaim: dangouiDeclared ? "runtime-verification-required" : "PARTIAL_STYLE_ONLY",
    },
    hostSurface,
    hostLayout: layoutChecks,
    targetResolution,
    startupPage: startupPage ? {
      path: `migrations/${brand}/host-startup-page.json`,
      route: startupPage.route,
      sourceFile: startupPage.sourceFile,
    } : null,
    pageInventory: pageInventory ? {
      path: `migrations/${brand}/host-page-inventory.json`,
      pageCount: pageInventory.pages.length,
      defaultEntry: pageInventory.defaultEntry,
      discoveryComplete: pageInventory.discovery.complete,
    } : null,
    blocking,
    warnings,
  };
  if (write && brand) {
    fs.mkdirSync(migrationRoot, { recursive: true });
    if (startupPage) {
      const file=path.join(migrationRoot, "host-startup-page.json");
      // Preserve declared observation evidence only for the exact same target.
      // Preflight does not capture or claim to have viewed the running host.
      const prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):null;
      if(prior?.sourceSha256===startupPage.sourceSha256&&prior?.sourceFile===startupPage.sourceFile&&prior?.route===startupPage.route&&path.resolve(rootPath,prior.hostRoot)===path.resolve(rootPath,startupPage.hostRoot)&&prior.visualEvidence) startupPage.visualEvidence=prior.visualEvidence;
      fs.writeFileSync(file, `${JSON.stringify(startupPage, null, 2)}\n`);
    }
    if (pageInventory) fs.writeFileSync(path.join(migrationRoot, "host-page-inventory.json"), `${JSON.stringify(pageInventory, null, 2)}\n`);
    fs.writeFileSync(path.join(migrationRoot, `${lane}-preflight.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

function buildHostStartupPage(rootPath, hostRoot, requestedHostRoot, targetResolution) {
  const explicitFile = fs.existsSync(requestedHostRoot) && fs.statSync(requestedHostRoot).isFile() ? requestedHostRoot : null;
  const route = targetResolution?.route || null;
  const clean = String(route || "").replace(/^\//, "").replace(/\.(?:vue|tsx?|jsx?)$/i, "");
  const resolvedEntry = targetResolution?.sourceFile ? path.join(hostRoot, targetResolution.sourceFile) : null;
  const bases = explicitFile ? [explicitFile] : resolvedEntry ? [resolvedEntry] : [
    path.join(hostRoot, clean), path.join(hostRoot, "src", clean),
    path.join(hostRoot, "src", "pages", clean), path.join(hostRoot, "src", "views", clean),
  ];
  const candidates = explicitFile ? bases : bases.flatMap((base) => [base, `${base}.vue`, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, path.join(base, "index.vue"), path.join(base, "index.tsx"), path.join(base, "index.jsx")]);
  const source = candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
  return {
    schema: "host-startup-page/v1",
    generatedBy: "brand-design-preflight",
    hostRoot: path.relative(rootPath, hostRoot) || ".",
    selectionReason: explicitFile ? "explicit-file" : "host-startup-default-entry",
    route,
    sourceFile: source ? path.relative(hostRoot, source).replaceAll("\\", "/") : null,
    sourceSha256: source ? sha256File(source) : null,
    scope: "startup-page-only",
    fullProjectScanDeferredUntil: "after-h5-user-confirmation",
  };
}

function buildHostPageInventory(rootPath, hostRoot, targetResolution) {
  const routeConfigs = collectFiles(hostRoot, (file) => /(?:app\.config|router|routes|pages)\.(?:js|ts|json|tsx?|jsx?)$/i.test(file), 200);
  const allSources = collectFiles(hostRoot, (file) => /\.(?:vue|tsx?|jsx?)$/i.test(file), 5000);
  const pageFiles = allSources.filter((file) => {
    const rel = path.relative(hostRoot, file).replaceAll("\\", "/");
    if (/(?:^|\/)(?:__tests__|test|tests|stories)(?:\/|$)|\.(?:test|spec|stories)\./i.test(rel)) return false;
    return /(?:^|\/)(?:pages?|views?|screens?|routes?|app)\//i.test(rel) || /(?:^|\/)(?:page|index)\.(?:vue|tsx?|jsx?)$/i.test(rel);
  });
  const declaredRoutes = [];
  for (const file of routeConfigs) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bpages\s*:\s*\[([\s\S]*?)\]/g)) {
      for (const page of match[1].matchAll(/["']([^"']+)["']/g)) declaredRoutes.push({ route: page[1], source: path.relative(hostRoot, file).replaceAll("\\", "/") });
    }
    for (const match of source.matchAll(/\bpath\s*:\s*["']([^"']+)["']/g)) declaredRoutes.push({ route: match[1], source: path.relative(hostRoot, file).replaceAll("\\", "/") });
    if (/\.json$/i.test(file)) {
      try {
        const json = JSON.parse(source);
        for (const item of array(json.pages)) {
          const route = typeof item === "string" ? item : item?.path;
          if (route) declaredRoutes.push({ route, source: path.relative(hostRoot, file).replaceAll("\\", "/") });
        }
      } catch {}
    }
  }
  const normalizedRoutes = [...new Map(declaredRoutes.map((item) => [item.route, item])).values()];
  const pages = pageFiles.map((file) => {
    const sourceFile = path.relative(hostRoot, file).replaceAll("\\", "/");
    const rawStem = sourceFile.replace(/\.(?:vue|tsx?|jsx?)$/i, "");
    const stem = rawStem.replace(/\/(?:index|page)$/i, "");
    const routeRefs = normalizedRoutes.filter((item) => {
      const route = item.route.replace(/^\//, "").replace(/\.(?:vue|tsx?|jsx?)$/i, "");
      const sourceStem = rawStem.replace(/^src\//, "");
      return sourceStem === route || sourceStem.endsWith(`/${route}`) || route.endsWith(sourceStem);
    }).map((item) => item.route);
    return {
      id: sourceFile,
      sourceFile,
      sourceSha256: sha256File(file),
      bytes: fs.statSync(file).size,
      declaredRoutes: routeRefs,
      inferredRoute: routeRefs[0] || inferFileRoute(sourceFile),
    };
  });
  const resolvedRoutes = new Set(pages.flatMap((item) => item.declaredRoutes));
  const unresolvedDeclaredRoutes = normalizedRoutes.map((item) => item.route).filter((route) => !resolvedRoutes.has(route));
  for (const route of unresolvedDeclaredRoutes) pages.push({
    id: `route:${route}`,
    sourceFile: null,
    sourceSha256: null,
    bytes: 0,
    declaredRoutes: [route],
    inferredRoute: route,
    unresolvedSource: true,
  });
  return {
    schema: "host-page-inventory/v1",
    generatedBy: "brand-design-preflight",
    hostRoot: path.relative(rootPath, hostRoot) || ".",
    defaultEntry: targetResolution?.route || normalizedRoutes[0]?.route || pages[0]?.inferredRoute || null,
    discovery: {
      complete: pageFiles.length < 5000 && routeConfigs.length < 200,
      routeConfigFiles: routeConfigs.map((file) => path.relative(hostRoot, file).replaceAll("\\", "/")),
      declaredRoutes: normalizedRoutes,
      unresolvedDeclaredRoutes,
      scannedSourceFileCount: allSources.length,
      pageFileCount: pages.length,
      excludedDirectories: ["node_modules", "dist", ".git"],
    },
    pages,
  };
}

function inferFileRoute(sourceFile) {
  return "/" + sourceFile.replace(/^src\//, "").replace(/\.(?:vue|tsx?|jsx?)$/i, "").replace(/\/(?:index|page)$/i, "").replace(/^app\//, "");
}

function classifyHostSurface({ hostPackage, dependencies }) {
  const scripts = hostPackage?.scripts || {};
  const isTaro = Boolean(dependencies["@tarojs/taro"] || dependencies["@tarojs/cli"]);
  const isQdmp = Boolean(dependencies["taro-plugin-qd"] || Object.values(scripts).some((script) => /\bqdmp\b/i.test(script)));
  const hasMiniBuild = Object.values(scripts).some((script) => /taro\s+build[^\n]*(?:weapp|mini)|\bqdmp\s+build/i.test(script));
  const hasH5Build = Object.values(scripts).some((script) => /taro\s+build[^\n]*h5/i.test(script));
  if (isTaro && (isQdmp || hasMiniBuild)) return {
    formFactor: "mobile",
    platform: isQdmp ? "qdmp-miniapp" : "taro-miniapp",
    compatibility: hasH5Build ? ["mobile-miniapp", "mobile-h5"] : ["mobile-miniapp"],
    defaultPreviewViewport: "375x812",
    forbiddenPreviewPatterns: ["persistent-desktop-sidebar", "desktop-control-panel-compressed-into-mobile", "primary-content-column-below-72-percent"],
  };
  if (hasH5Build) return { formFactor: "responsive", platform: "web-h5", compatibility: ["mobile-h5", "desktop-web"], defaultPreviewViewport: "375x812" };
  return { formFactor: "responsive", platform: "web", compatibility: ["desktop-web", "mobile-web"], defaultPreviewViewport: "1440x900" };
}

function resolveHostTarget(hostRoot, requestedTarget = hostRoot) {
  if (fs.existsSync(requestedTarget) && fs.statSync(requestedTarget).isFile()) return { strategy: "explicit-file", route: path.relative(hostRoot, requestedTarget) };
  if (!fs.existsSync(hostRoot)) return { strategy: "unresolved", route: null };
  const candidates = collectFiles(hostRoot, (file) => /(?:app\.config|router|routes)\.(?:js|ts|json)$/i.test(file), 30);
  for (const file of candidates) {
    const source = fs.readFileSync(file, "utf8");
    const pages = source.match(/\bpages\s*:\s*\[([\s\S]*?)\]/)?.[1];
    const route = pages?.match(/["']([^"']+)["']/)?.[1];
    if (route) return { strategy: "default-home-first-route", route, source: path.relative(hostRoot, file) };
  }
  const webEntry = resolveReactWebEntry(hostRoot);
  if (webEntry) return webEntry;
  return { strategy: "host-root-fallback", route: null, warning: "DEFAULT_HOME_ROUTE_NOT_DETECTED" };
}

// Follow a local HTML module entry to its single rendered local component.
// Do not guess App.tsx by filename or choose a branch of a router.
function resolveReactWebEntry(hostRoot) {
  const inside = (file) => file.startsWith(`${fs.realpathSync(hostRoot)}${path.sep}`);
  const localFile = (base) => {
    const found = [base, ...['.tsx','.jsx','.ts','.js'].map(ext => base + ext)]
      .filter(file => fs.existsSync(file) && fs.statSync(file).isFile() && inside(fs.realpathSync(file)));
    return found.length === 1 ? found[0] : null;
  };
  const html = path.join(hostRoot, 'index.html');
  if (!fs.existsSync(html)) return null;
  const tags = fs.readFileSync(html, 'utf8').match(/<script\b[^>]*>/gi) || [];
  const modules = tags.filter(tag => /\btype\s*=\s*["']module["']/.test(tag))
    .map(tag => tag.match(/\bsrc\s*=\s*["']([^"']+)["']/)?.[1]).filter(Boolean);
  if (modules.length !== 1 || /^(?:\w+:|\/\/)/.test(modules[0])) return null;
  const entry = localFile(path.resolve(hostRoot, modules[0].replace(/^\//, '')));
  if (!entry) return null;
  const source = fs.readFileSync(entry, 'utf8');
  const rendered = source.match(/\.render\s*\(([\s\S]*)\)\s*;?\s*$/)?.[1];
  if (!rendered) return null;
  const imports = [...source.matchAll(/import\s+(\w+|\{[^}]+\})\s+from\s+["'](\.[^"']+)["']/g)];
  const roots = [];
  for (const [, binding, specifier] of imports) {
    const names = binding.replace(/[{}]/g, '').split(',').map(item => item.trim().split(/\s+as\s+/).at(-1));
    if (!names.some(name => /^[A-Z]\w*$/.test(name) && new RegExp(`<${name}(?:\\s|/|>)`).test(rendered))) continue;
    const file = localFile(path.resolve(path.dirname(entry), specifier));
    if (!file) return null;
    roots.push(file);
  }
  if (roots.length !== 1) return null;
  const component = fs.readFileSync(roots[0], 'utf8');
  if (/\b(?:RouterProvider|BrowserRouter|HashRouter|Routes|useRoutes|createBrowserRouter)\b/.test(source + component)) return null;
  return { strategy: 'html-react-render-entry', route: '/', source: path.relative(hostRoot, entry), sourceFile: path.relative(hostRoot, roots[0]), runtimeState: 'unverified-read-startup-conditions-before-freezing-business' };
}

function inspectHostLayout(hostRoot, scopedFiles = null) {
  const files = scopedFiles || collectFiles(hostRoot, (file) => /\.(?:vue|tsx?|jsx?)$/i.test(file), 400);
  const issues = [];
  const warnings = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (/\.vue$/i.test(file)) {
      const templateStart = source.search(/<template(?:\s[^>]*)?>/i);
      const templateEnd = source.lastIndexOf("</template>");
      const template = templateStart >= 0 && templateEnd > templateStart
        ? source.slice(source.indexOf(">", templateStart) + 1, templateEnd)
        : "";
      const opened = (template.match(/<view(?=[\s>])[^>]*>/gi) || []).filter((tag) => !/\/\s*>$/.test(tag)).length;
      const closed = (template.match(/<\/view\s*>/gi) || []).length;
      if (opened !== closed) issues.push({
        code: "TEMPLATE_VIEW_TAG_UNBALANCED",
        file: path.relative(hostRoot, file),
        opened,
        closed,
      });
    }
    if (/<scroll-view\b[^>]*\bscroll-x(?:\s*=\s*["']?(?:true|\{\{\s*true\s*\}\})["']?)?/i.test(source)) warnings.push({
      code: "HORIZONTAL_SCROLL_REQUIRES_VIEWPORT_QA",
      file: path.relative(hostRoot, file),
    });
  }
  return {
    scannedFiles: files.length,
    issues,
    warnings,
    qaContract: [
      "target page width equals viewport width",
      "primary vertical scroll container has no unintended horizontal range",
      "first-level content blocks remain inside viewport after brand shadow and border styles",
    ],
  };
}

function resolveProjectRoot(target) {
  if (!fs.existsSync(target)) return target;
  let candidate = fs.statSync(target).isFile() ? path.dirname(target) : target;
  while (true) {
    if (fs.existsSync(path.join(candidate, "package.json")) && fs.existsSync(path.join(candidate, "src"))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  if (fs.statSync(target).isFile()) return path.dirname(target);
  if (fs.existsSync(path.join(target, "package.json"))) return target;
  const packages = collectFiles(target, (file) => path.basename(file) === "package.json", 40)
    .map((file) => path.dirname(file))
    .filter((dir) => fs.existsSync(path.join(dir, "src")));
  const withAppConfig = packages.find((dir) => collectFiles(path.join(dir, "src"), (file) => /app\.config\.(?:js|ts|json)$/i.test(file), 1).length);
  return withAppConfig || packages[0] || target;
}

function collectFiles(root, accept, limit) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return accept(root) ? [root] : [];
  const found = [];
  const visit = (dir) => {
    if (found.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (accept(file)) found.push(file);
      if (found.length >= limit) return;
    }
  };
  visit(root);
  return found;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function array(value) { return Array.isArray(value) ? value : []; }
function option(args, name, fallback = "") { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const result = (args.includes("--frozen-master-only") ? validateFrozenHostMaster : runApplyHostPreflight)({
    root: option(args, "--root", process.cwd()),
    brand: option(args, "--brand"),
    hostTarget: option(args, "--host-target", "."),
    profile: option(args, "--profile", "fast"),
    phase: option(args, "--phase", "implementation"),
    write: !args.includes("--no-write"),
    selectedHostOptions:selectedPosteditCliOptions(args),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.verdict === "pass" ? 0 : 1);
}
