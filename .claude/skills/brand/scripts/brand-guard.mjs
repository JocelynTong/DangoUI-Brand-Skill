#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const installedSkillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowContractFile = (root) => {
  const projectContract = path.join(root, "skills", "brand", "workflow-contract.json");
  return fs.existsSync(projectContract) ? projectContract : path.join(installedSkillRoot, "workflow-contract.json");
};

const args = process.argv.slice(2);
const command = args[0];

if (!command || ["-h", "--help", "help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

try {
  await runCommand();
} catch (error) {
  fail(error.message || String(error));
}

async function runCommand() {
  if (command === "checkpoint") checkpoint();
  else if (command === "rollback") rollback();
  else if (command === "tpp-test") tppTest();
  else if (command === "p0-acceptance") p0Acceptance();
  else if (command === "workflow-contract") printWorkflowContractCommand();
  else if (command === "detect-entry") detectEntryCommand();
  else if (command === "validate-intent") validateIntent();
  else if (command === "create-selector-map") createSelectorMap();
  else if (command === "cleanup-preview") cleanupPreview();
  else if (command === "scan-host-debt") scanHostDebt();
  else if (command === "scan-css") scanCss();
  else if (command === "coverage-gate") coverageGate();
  else if (command === "asset-usage-gate") assetUsageGate();
  else if (command === "visual-placement-gate") visualPlacementGate();
  else if (command === "evidence-visibility-gate") evidenceVisibilityGate();
  else if (command === "handoff-artifact-gate") handoffArtifactGate();
  else if (command === "external-goodcase-gate") externalGoodcaseGate();
  else if (command === "rule-candidate-gate") ruleCandidateGate();
  else if (command === "validate-role-replacements") validateRoleReplacements();
  else if (command === "resolve-demo") resolveDemo();
  else if (command === "draft-style-pack") draftStylePack();
  else if (command === "register-demo-preview") registerDemoPreview();
  else if (command === "demo-gate") demoGate();
  else if (command === "verify-dom") verifyDom();
  else if (command === "parse-dev-server") parseDevServer();
  else if (command === "validate-final") validateFinal();
  else if (command === "record-run") recordRun();
  else if (command === "tombstone-run") tombstoneRun();
  else if (command === "summarize-runs") summarizeRuns();
  else if (command === "issue-retro") issueRetro();
  else if (command === "collect-site-evidence") await collectSiteEvidence();
  else if (command === "score-action-evidence") scoreActionEvidence();
  else if (command === "collect-rendered-assets") collectRenderedAssets();
  else if (command === "import-dembrandt") importDembrandtEvidence();
  else if (command === "validate-tone") validateTone();
  else fail(`Unknown command: ${command}`);
}

function checkpoint() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "brand");
  const sourceCommand = opt("--command", "");
  const sourceUrl = opt("--source-url", extractUrl(sourceCommand));
  const createdAt = new Date().toISOString();

  if (!isGitRepo(root)) {
    const manifest = writeManifest(root, {
      type: "file-fallback",
      brand,
      createdAt,
      command: sourceCommand,
      sourceUrl,
      reason: "not a git repository",
      rollbackCommand: "/brand rollback",
    });
    ok({ type: "file-fallback", manifest, message: "No git repo detected; wrote fallback manifest only." });
    return;
  }

  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const beforeHead = git(root, ["rev-parse", "HEAD"]);
  const cleanedResidue = cleanRollbackResidue(root, brand);
  const dirty = git(root, ["status", "--porcelain=v1", "-uall"]) || "";
  const message = [
    `chore(brand): checkpoint before applying ${brand}`,
    "",
    `Created-At: ${createdAt}`,
    `Brand: ${brand}`,
    sourceUrl ? `Source-URL: ${sourceUrl}` : "",
    sourceCommand ? `Command: ${sourceCommand}` : "",
    `Branch: ${branch}`,
    `Before-Head: ${beforeHead}`,
  ].filter(Boolean).join("\n");

  if (String(dirty).trim()) {
    git(root, ["add", "-A"], { stdio: "inherit" });
    git(root, ["commit", "-m", message], { stdio: "inherit" });
  } else {
    git(root, ["commit", "--allow-empty", "-m", message], { stdio: "inherit" });
  }

  const checkpointCommit = git(root, ["rev-parse", "HEAD"]);
  const manifest = writeManifest(root, {
    type: "git-checkpoint",
    brand,
    createdAt,
    branch,
    beforeHead,
    checkpointCommit,
    cleanedResidue,
    hadUncommittedChanges: Boolean(String(dirty).trim()),
    command: sourceCommand,
    sourceUrl,
    rollbackCommand: "/brand rollback",
  });

  ok({ type: "git-checkpoint", branch, beforeHead, checkpointCommit, manifest });
}

function rollback() {
  const root = opt("--root", process.cwd());
  const execute = has("--execute");
  const force = has("--force");
  const manifestPath = opt("--manifest", path.join(root, "migrations", "_brand-rollbacks", "latest.json"));

  if (!fs.existsSync(manifestPath)) fail(`Rollback manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (manifest.type !== "git-checkpoint") {
    ok({
      type: manifest.type,
      manifest: manifestPath,
      message: "Non-git fallback manifest found. Restore files from the manifest manually.",
      files: manifest.files || [],
    });
    return;
  }

  if (!execute) {
    ok({
      dryRun: true,
      branch: manifest.branch,
      checkpointCommit: manifest.checkpointCommit,
      command: `node ${scriptPath()} rollback --execute --root ${JSON.stringify(root)}`,
      warning: "This will reset the working tree to the checkpoint commit.",
    });
    return;
  }

  const dirty = git(root, ["status", "--porcelain=v1", "-uall"]) || "";
  if (String(dirty).trim() && !force) {
    fail("Working tree has changes after branding. Re-run rollback with --force after confirming they can be discarded.");
  }
  git(root, ["reset", "--hard", manifest.checkpointCommit], { stdio: "inherit" });
  const cleanedResidue = cleanRollbackResidue(root, manifest.brand || inferBrandKey(manifest.sourceUrl) || "");
  ok({ rolledBackTo: manifest.checkpointCommit, manifest: manifestPath, cleanedResidue });
}

function detectEntryCommand() {
  const root = opt("--root", process.cwd());
  const entry = detectDefaultEntry(root);
  ok(entry);
}

function validateIntent() {
  const sourceUrl = opt("--source-url", "");
  const planFile = opt("--plan-file", "");
  const allowPreview = has("--allow-preview");
  const text = planFile ? fs.readFileSync(planFile, "utf8") : fs.readFileSync(0, "utf8");
  const structuredPlan = parseIntentPlan(text);
  const demo = parseDemoBrandUrl(sourceUrl);
  const brandKey = opt("--brand", demo?.brand || inferBrandKey(sourceUrl));
  const findings = [];

  if (brandKey) {
    const brandPattern = new RegExp(`\\b${escapeRegExp(brandKey)}\\b`, "i");
    const newRoutePattern = /新增.{0,16}(路由|route)|new.{0,16}route|router\.(ts|js)|app\.config|pages\.json/i;
    const newPagePattern = /新建.{0,16}(页面|Page|\.vue|\.tsx|\.jsx)|create.{0,16}(page|component)|HomePage\.vue|ShowcasePage/i;
    const brandPagePattern = brandKeyPattern(brandKey);
    const negatedNewTargetPattern = /不.{0,6}(新建|新增).{0,20}(品牌)?(路由|页面|route|page)|不会.{0,6}(新建|新增).{0,20}(品牌)?(路由|页面|route|page)|不要.{0,6}(新建|新增).{0,20}(品牌)?(路由|页面|route|page)|(?:do not|don't|will not|without|no)\s+(?:create|add|generate|new).{0,40}(?:brand\s*)?(?:route|page|component)/i;
    const preservePattern = /保留.{0,24}(原业务|原页面|业务内容|数据|文案|逻辑|组件结构)|不(改|动).{0,20}(业务内容|数据|文案|逻辑)|复用.{0,20}(已有|原有).{0,20}(页面|组件|路由)|(?:preserve|keep|reuse|do not change|without changing).{0,60}(?:business|content|data|copy|logic|component|structure|existing|original)/i;
    const targetPattern = /(默认首页|默认入口|已有路由|现有路由|HomePage|当前业务项目|宿主项目已有页面|targetScope|承接目标|target\s*(?:route|page|entry)|existing\s*(?:route|page|entry)|host\s*(?:route|page|project)|business\s*(?:route|page|project)|root\s*(?:route|entry)|default\s*(?:entry|home|page)|\/#?\/|pages\/)/i;
    const likelyReferenceCopy = /(穿梭暗网|Renoa|蕾诺娅|角色|剧情|栏目|CZN 风格文案|参考站文案|搬进|捏造)/i;
    const previewReasonPattern = /(无法安全改动|风险|preview|预览|对比|保留原版|apply|合并回|回写|原页面)/i;
    const isHostCoverageMatrix = structuredPlan?.schema === "host-coverage-matrix/v1"
      && structuredPlan?.mode === "apply-host"
      && Array.isArray(structuredPlan?.routeInventory);
    const hasHostTarget = Boolean(structuredPlan?.targetRoute || structuredPlan?.targetPage || structuredPlan?.targetEntry || structuredPlan?.hostTarget)
      || (isHostCoverageMatrix && structuredPlan.routeInventory.length > 0)
      || targetPattern.test(text);
    const matrixPreservesBusiness = isHostCoverageMatrix
      && Array.isArray(structuredPlan?.protectedSemantics)
      && structuredPlan.protectedSemantics.some((item) => /business|业务|data|数据|logic|逻辑|route|路由|navigation|交互/i.test(String(item)));
    const preservesBusiness = structuredPlan?.preserveBusinessContent === true || structuredPlan?.preserveBusiness === true || structuredPlan?.preserveExistingContent === true || matrixPreservesBusiness || preservePattern.test(text);
    const createsBrandRoute = structuredPlan?.createNewBrandRoute === true || structuredPlan?.createPreview === true || structuredPlan?.preview === true;
    const explicitlyNoBrandRoute = structuredPlan?.createNewBrandRoute === false || structuredPlan?.createPreview === false || structuredPlan?.preview === false || negatedNewTargetPattern.test(text);

    if (!hasHostTarget) {
      findings.push({
        type: "missing-host-target",
        message: "Demo URL is a style source; the plan must name an existing host page/route as the target.",
      });
    }
    if (!preservesBusiness) {
      findings.push({
        type: "missing-preserve-business-content",
        message: "The plan must explicitly preserve existing business content, data, logic, and component structure.",
      });
    }
    if (!allowPreview && !explicitlyNoBrandRoute && (createsBrandRoute || (newRoutePattern.test(text) && brandPattern.test(text)))) {
      findings.push({
        type: "new-brand-route-from-demo-url",
        message: "Do not create a brand route/page from a demo URL unless the user explicitly asked for a preview page.",
      });
    }
    if (!allowPreview && !explicitlyNoBrandRoute && (createsBrandRoute || newPagePattern.test(text) || brandPagePattern.test(text))) {
      findings.push({
        type: "new-brand-page-from-demo-url",
        message: "Do not create a brand route/page/component for style application; apply the style to existing host pages.",
      });
    }
    if (likelyReferenceCopy.test(text)) {
      findings.push({
        type: "reference-content-copy",
        message: "Do not copy reference-site content into the host project. Use the reference only for visual style.",
      });
    }
    if (allowPreview && !previewReasonPattern.test(text)) {
      findings.push({
        type: "missing-preview-lifecycle",
        message: "Preview mode requires a clear reason and an apply path back to the original page.",
      });
    }
  }

  const result = {
    ok: findings.length === 0,
    sourceType: demo ? "demo-style-source" : "unknown-or-non-demo",
    brand: brandKey || "",
    pageId: demo?.pageId || "",
    structuredPlan: structuredPlan || null,
    allowPreview,
    blocking: findings,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 2);
}

function createSelectorMap() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const fileOpt = opt("--files", "");
  if (!brand) fail("--brand is required");
  const defaultEntry = detectDefaultEntry(root);
  const files = fileOpt
    ? fileOpt.split(",").map((item) => path.resolve(root, item.trim())).filter(Boolean)
    : defaultEntry.files.map((item) => path.resolve(root, item)).filter(Boolean);
  if (!files.length) fail("--files is required, or default entry detection must find a page file");
  const outPath = opt("--out", path.join(root, "migrations", brand, "selector-map.json"));
  const entries = [];

  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    const relative = path.relative(root, file);
    const classNames = extractLiteralClassNames(text, file);
    for (const className of classNames) {
      entries.push({
        file: relative,
        hostClass: className,
        hostSelector: `.${className}`,
        themeSelector: `.theme-${brand} .${className}`,
        source: "host-dom",
        status: "needs-theme-rule",
        note: "Generated from host page DOM/classes. Theme CSS must target themeSelector and preserve host business content.",
      });
    }
  }

  const data = {
    brand,
    createdAt: new Date().toISOString(),
    mode: "in-place-default",
    files: files.map((file) => path.relative(root, file)),
    defaultEntry,
    targetRootCandidates: defaultEntry.framework === "taro"
      ? [".taro_page", "taro-view-core", "[class*=\"taro_page\"]"]
      : [`.theme-${brand}`],
    rules: [
      "Demo URL is only a style source.",
      "Apply brand styles to existing host pages by default.",
      "Do not create a brand route/page unless preview mode is explicitly requested.",
      "If preview mode is used, apply must merge these selectors back into original host pages.",
    ],
    selectors: entries,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
  ok({
    ok: true,
    out: path.relative(root, outPath),
    selectorCount: entries.length,
    sample: entries.slice(0, 12),
    message: "Full selector map was written to out. Do not paste the full table to operators unless they ask for technical details.",
  });
}

function cleanupPreview() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const execute = has("--execute");
  if (!brand) fail("--brand is required");

  const brandPascal = capitalize(brand);
  const candidates = listFiles(root, /\.(vue|tsx?|jsx?|css|scss|sass|less)$/)
    .filter((file) => {
      const relative = path.relative(root, file);
      if (/^migrations\//.test(relative) || /^public\/assets\//.test(relative) || /^skills\//.test(relative) || /^\.claude\//.test(relative)) return false;
      if (new RegExp(`theme[-_.]${escapeRegExp(brand)}\\.(css|scss|sass|less)$`, "i").test(relative)) return false;
      const base = path.basename(file);
      return new RegExp(`(^|[-_])${escapeRegExp(brand)}([-_]|\\.)`, "i").test(base)
        || new RegExp(`^${escapeRegExp(brandPascal)}[A-Za-z]*(Page|View|Route|Component)\\.(vue|tsx|jsx)$`).test(base)
        || new RegExp(`/(pages|views|routes|components)/${escapeRegExp(brand)}([/_-]|\\.)`, "i").test(relative);
    });

  const routeFiles = listFiles(root, /\.(ts|js|tsx|jsx|json)$/)
    .filter((file) => /(router|routes|app\.config|pages\.json|manifest)/i.test(path.basename(file)) || /\/router\//i.test(file));
  const routePatches = [];
  for (const file of routeFiles) {
    const text = safeRead(file);
    if (!text) continue;
    const next = removeBrandRoutes(text, brand);
    if (next !== text) {
      routePatches.push({
        file,
        before: text,
        after: next,
      });
    }
  }

  if (execute) {
    for (const file of candidates) {
      try {
        fs.rmSync(file, { force: true, recursive: true });
      } catch (error) {
        fail(`Failed to remove ${file}: ${error.message}`);
      }
    }
    for (const patch of routePatches) {
      fs.writeFileSync(patch.file, patch.after);
    }
  }

  ok({
    ok: true,
    execute,
    brand,
    removedFiles: candidates.map((file) => path.relative(root, file)),
    patchedRouteFiles: routePatches.map((patch) => path.relative(root, patch.file)),
    message: execute
      ? "Unrequested brand preview artifacts were removed. Re-run build and validate the default entry."
      : "Dry-run only. Re-run with --execute after checkpoint to remove unrequested brand preview artifacts.",
  });
}

function scanHostDebt() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const fileOpt = opt("--files", "");
  const defaultEntry = detectDefaultEntry(root);
  const files = fileOpt
    ? fileOpt.split(",").map((item) => path.resolve(root, item.trim())).filter(Boolean)
    : defaultEntry.files.length
      ? defaultEntry.files.map((item) => path.resolve(root, item))
      : listFiles(root, /\.(vue|css|scss|sass|less|tsx?|jsx?|html)$/);
  const allowedPrefixes = new Set(["du", "style", "layout"]);
  if (brand) allowedPrefixes.add(brand.toLowerCase());

  const autoFix = [];
  const needsReview = [];
  const blocking = [];
  const summary = [];
  const tokenizationPlan = [];

  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    const relative = path.relative(root, file);
    const cssVars = unique([...text.matchAll(/var\(--([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
    const declaredVars = unique([...text.matchAll(/--([a-zA-Z][\w-]*)\s*:/g)].map((match) => match[1]));
    const allVarPrefixes = unique([...cssVars, ...declaredVars].map((name) => name.split("-")[0]).filter(Boolean));
    const foreignThemePrefixes = allVarPrefixes.filter((prefix) => !allowedPrefixes.has(prefix.toLowerCase()));
    const hardcodedColorMatches = [
      ...text.matchAll(/(?<![\w-])#[0-9a-fA-F]{3,8}\b/g),
      ...text.matchAll(/\brgba?\([^)]+\)/gi),
      ...text.matchAll(/\bhsla?\([^)]+\)/gi),
      ...text.matchAll(/\blinear-gradient\([^)]+\)/gi),
    ].map((match) => ({ value: match[0], index: match.index || 0 }));
    const hardcodedColors = unique(hardcodedColorMatches.map((match) => match.value));
    const businessStateRisk = unique(hardcodedColorMatches
      .filter(({ index }) => {
        const nearby = text.slice(Math.max(0, index - 180), index + 180);
        return /(error|danger|fail|失败|错误|警告|warning|库存|stock|status|状态|price|价格|amount|金额|success|成功)/i.test(nearby);
      })
      .map((match) => match.value));
    const visualPropMatches = [...text.matchAll(/\b(color|background(?:-color|-image)?|border(?:-color)?|box-shadow|text-shadow|border-radius|font-family|font-size|font-weight|letter-spacing|animation|transition)\s*:\s*([^;}{]+)/gi)]
      .map((match) => ({
        prop: match[1],
        value: match[2].trim(),
        index: match.index || 0,
      }));
    const visualProps = unique(visualPropMatches.map((match) => `${match.prop}: ${match.value}`));
    const classNames = extractLiteralClassNames(text, file);
    const themeCoupledClasses = classNames.filter((name) => /^(ink|czn|hpma|re1999|apple|spotify|figma|notion|dango)[-_]/i.test(name));
    const tailwindVisualClasses = classNames.filter(isTailwindVisualClass);
    const tailwindHardcodedColors = unique(tailwindVisualClasses.flatMap(extractTailwindValues));
    const tailwindHighSpecificityClasses = classNames.filter((name) => /^(rounded-full|bg-\[|text-\[|border-\[|from-\[|via-\[|to-\[|shadow-\[|ring-\[)/.test(name));
    const inlineStyleBindings = extractInlineStyleBindings(text)
      .filter((item) => isVisualStyleExpression(item.value))
      .map((item) => classifyInlineStyleBinding({
        line: lineNumber(text, item.index),
        value: item.value.slice(0, 220),
      }));
    const inlineStyleAutoFixes = inlineStyleBindings.filter((item) => item.fixStrategy !== "preserve-semantic");
    const inlineStyleSemanticReviews = inlineStyleBindings.filter((item) => item.fixStrategy === "preserve-semantic");
    const semanticColorMaps = extractSemanticColorMaps(text);

    if (foreignThemePrefixes.length) {
      autoFix.push({
        type: "foreign-theme-vars",
        file: relative,
        prefixes: foreignThemePrefixes,
        action: "Convert old theme variables to --du-* / --style-* / --layout-* tokens, or remove declarations after equivalent new tokens are applied.",
      });
    }
    if (themeCoupledClasses.length) {
      autoFix.push({
        type: "theme-coupled-class",
        file: relative,
        classes: themeCoupledClasses,
        action: "Prefer neutral semantic classes. If class rename is risky, keep DOM and target these real classes from the new theme scope.",
      });
    }
    if (tailwindHighSpecificityClasses.length) {
      autoFix.push({
        type: "tailwind-high-specificity-visual-class",
        file: relative,
        classes: unique(tailwindHighSpecificityClasses),
        action: "Do not rely on a loose theme CSS override. Replace the source class/value with tokenized classes, inline token style, or a host selector that exactly matches the generated utility selector.",
      });
    }
    if (inlineStyleAutoFixes.length) {
      autoFix.push({
        type: "inline-style-visual-lock",
        file: relative,
        bindings: inlineStyleAutoFixes.slice(0, 20),
        action: "Inline style / Vue :style wins over theme CSS. Follow fixStrategy: tokenize simple/dynamic values, or extract complex gradient/border to a semantic class.",
      });
    }
    if (businessStateRisk.length) {
      needsReview.push({
        type: "business-state-color-risk",
        file: relative,
        colors: businessStateRisk,
        question: "These colors may represent business status such as error/warning/success/price/stock. Preserve semantics or map to semantic tokens before replacing.",
      });
    }
    if (semanticColorMaps.length) {
      needsReview.push({
        type: "business-semantic-color-map",
        file: relative,
        maps: semanticColorMaps.slice(0, 20),
        question: "These color maps likely encode product/game/status semantics. Try a brand-palette semantic mapping only if the user accepts that business meaning may be visually restyled; otherwise preserve them.",
      });
    }
    if (inlineStyleSemanticReviews.length) {
      needsReview.push({
        type: "business-semantic-inline-style",
        file: relative,
        bindings: inlineStyleSemanticReviews.slice(0, 20),
        question: "These inline style bindings appear to read business semantic color maps. Preserve them by default, or show an experimental brand-palette mapping and ask whether the meaning still reads correctly.",
      });
    }
    for (const match of hardcodedColorMatches) {
      tokenizationPlan.push({
        type: "hardcoded-visual-value",
        file: relative,
        line: lineNumber(text, match.index),
        value: match.value,
        suggestedToken: suggestTokenForContext(text, match.index, match.value),
        rewrite: "Replace source value with var(--du-*) / var(--style-*) token consumption; keep business conditionals intact.",
      });
    }
    for (const match of visualPropMatches) {
      tokenizationPlan.push({
        type: "css-visual-declaration",
        file: relative,
        line: lineNumber(text, match.index),
        property: match.prop,
        value: match.value.slice(0, 180),
        suggestedToken: suggestTokenForProperty(match.prop, match.value),
        rewrite: "Tokenize the declaration or move it under the verified brand scope selector.",
      });
    }
    for (const className of tailwindHighSpecificityClasses) {
      tokenizationPlan.push({
        type: "tailwind-source-tokenization",
        file: relative,
        className,
        suggestedToken: suggestTokenForTailwindClass(className),
        rewrite: "Replace the visual utility at the source with tokenized class/style. Do not rely on loose theme CSS overrides.",
      });
    }
    for (const binding of inlineStyleBindings) {
      tokenizationPlan.push({
        type: binding.fixStrategy === "preserve-semantic" ? "inline-style-semantic-review" : "inline-style-tokenization",
        file: relative,
        line: binding.line,
        value: binding.value,
        classification: binding.classification,
        fixStrategy: binding.fixStrategy,
        suggestedToken: suggestTokenForInlineStyle(binding.value),
        rewrite: binding.rewrite,
      });
    }
    if (hardcodedColors.length || visualProps.length || tailwindVisualClasses.length || inlineStyleBindings.length) {
      summary.push({
        file: relative,
        hardcodedColors: unique([...hardcodedColors, ...tailwindHardcodedColors]),
        visualProps: visualProps.slice(0, 40),
        tailwindVisualClasses,
        inlineStyleBindings: inlineStyleBindings.slice(0, 20),
        semanticColorMaps: semanticColorMaps.slice(0, 20),
      });
    }
  }

  const result = {
    ok: blocking.length === 0,
    brand,
    defaultEntry,
    files: files.map((file) => path.relative(root, file)),
    autoFix,
    needsReview,
    blocking,
    tokenizationPlanCount: tokenizationPlan.length,
    tokenizationPlan: tokenizationPlan.slice(0, 60),
    operatorAdjustmentGuide: buildOperatorAdjustmentGuide(tokenizationPlan, needsReview),
    visualDebt: summary,
    message: needsReview.length
      ? "Old theme residue can be auto-normalized, but some business-state colors need semantic review before replacement."
      : "No blocking old-theme residue found. Auto-normalize autoFix items and use visualDebt as the replacement checklist.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(blocking.length ? 2 : 0);
}

function scanCss() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const files = listFiles(root, /\.(css|scss|sass|less|vue|html|tsx?|jsx?)$/);
  const binaryImportPattern = /@import\s+(?:url\()?["']?([^"')\s]+\.(?:ttf|otf|woff2?|png|jpe?g|webp|gif|svg|mp4|webm|mov))(?:["']?\))?/gi;
  const remoteFontPattern = /https?:\/\/[^"')\s]+\.(?:ttf|otf|woff2?)(?:\?[^"')\s]*)?/gi;
  const findings = [];
  const warnings = [];

  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    const cssTexts = path.extname(file).toLowerCase() === ".vue"
      ? extractBlocks(text, "style")
      : [text];
    for (const cssText of cssTexts) {
      const lateImport = findLateCssImport(cssText);
      if (lateImport) {
        findings.push({
          type: "late-css-import",
          file: path.relative(root, file),
          line: lateImport.line,
          value: lateImport.value,
          fix: "Move @import statements before @tailwind, selectors, variables, and all other CSS statements.",
        });
      }
      if (brand && new RegExp(`\\.theme-${escapeRegExp(brand)}\\s*\\{[\\s\\S]*--du-`, "i").test(cssText) && !/:root\s*\{[\s\S]*--du-/i.test(cssText)) {
        warnings.push({
          type: "theme-scoped-du-vars",
          file: path.relative(root, file),
          fix: "Core --du-* token values should also be defined at :root or at the verified real app root. Do not assume .theme-{brand} exists in rendered Taro DOM.",
        });
      }
      for (const match of cssText.matchAll(/url\(["']?\/assets\/brand-assets\/[^"')]+(?:ttf|otf|woff2?)["']?\)/gi)) {
        warnings.push({
          type: "public-font-url-with-base-risk",
          file: path.relative(root, file),
          value: match[0],
          fix: "Vite/Taro base paths can break /assets font URLs. Prefer bundler-managed src/assets URLs or verified relative emitted assets.",
        });
      }
    }
    for (const match of text.matchAll(binaryImportPattern)) {
      findings.push({
        type: "binary-import",
        file: path.relative(root, file),
        value: match[0],
        fix: "Use @font-face for fonts, and url()/asset slots for images/videos. @import only loads CSS files.",
      });
    }
    for (const match of text.matchAll(remoteFontPattern)) {
      warnings.push({
        type: "remote-font",
        file: path.relative(root, file),
        value: match[0],
        fix: "Copy font locally or provide system fallback; remote-only fonts must not block preview.",
      });
    }
    if (isTaroProject(root, text)) {
      for (const match of text.matchAll(/@import\s+["'][^"']*(?:theme|brand|style)[^"']*\.css["'];?/gi)) {
        warnings.push({
          type: "taro-vite-theme-css-import-risk",
          file: path.relative(root, file),
          value: match[0],
          fix: "Taro/Vite dev server may resolve theme CSS imports differently from build. Prefer importing the theme CSS from the JS app entry, e.g. src/app.js or src/app.ts: import './styles/<brand>-theme.css'.",
        });
      }
    }
  }

  const result = { ok: findings.length === 0, blocking: findings, warnings };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 2);
}

function coverageGate() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const fileOpt = opt("--files", "");
  const evidenceFile = opt("--evidence-file", brand ? path.join(root, "migrations", brand, "site-evidence.json") : "");
  const files = fileOpt
    ? fileOpt.split(",").map((item) => path.resolve(root, item.trim())).filter(Boolean)
    : listFiles(root, /\.(css|scss|sass|less|vue|tsx?|jsx?|html)$/);
  const dimensions = {
    color: /--du-(?:bg|text|primary|border)|#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/i,
    font: /font-family|@font-face|--style-font|--du-font/i,
    radius: /border-radius|--style-(?:card|control)-radius|rounded-/i,
    border: /border(?:-[a-z]+)?\s*:|--style-frame-border|border-image/i,
    shadow: /box-shadow|--style-card-shadow|text-shadow/i,
    frameOrAsset: /url\(|mask|clip-path|border-image|background-image|::before|::after|asset|texture|frame|media|image/i,
    activeState: /active|selected|current|checked|hover|focus|tab|button|switch|--du-primary/i,
  };
  const hits = {};
  for (const [dimension, pattern] of Object.entries(dimensions)) hits[dimension] = [];
  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    for (const [dimension, pattern] of Object.entries(dimensions)) {
      if (pattern.test(text)) hits[dimension].push(path.relative(root, file));
    }
  }
  const covered = Object.entries(hits).filter(([, value]) => value.length).map(([key]) => key);
  const missing = Object.keys(dimensions).filter((key) => !covered.includes(key));
  const score = covered.length;
  const computedMismatches = evidenceFile && fs.existsSync(evidenceFile)
    ? findComputedToneMismatches(JSON.parse(fs.readFileSync(evidenceFile, "utf8")), root)
    : [];
  const previewGateFile = brand ? path.join(root, "migrations", brand, "preview-gate.json") : "";
  const assetRoleCoverage = previewGateFile && fs.existsSync(previewGateFile)
    ? readAssetRoleCoverage(previewGateFile)
    : null;
  const mismatchPenalty = computedMismatches.some((item) => item.severity === "high") ? 2 : computedMismatches.length ? 1 : 0;
  const assetPenalty = assetRoleCoverage?.missing?.length ? 1 : 0;
  const adjustedScore = Math.max(0, score - mismatchPenalty - assetPenalty);
  let level = adjustedScore >= 6
    ? "complete-style-preview"
    : adjustedScore >= 4
      ? "conservative-application"
      : adjustedScore >= 2
        ? "color-layer-application"
        : "insufficient";
  if (assetRoleCoverage?.missing?.length && level === "complete-style-preview") {
    level = "conservative-application";
  }
  const okResult = level !== "insufficient";
  ok({
    ok: okResult,
    brand,
    coverageLevel: level,
    score,
    adjustedScore,
    mismatchPenalty,
    covered,
    missing,
    assetRoleCoverage,
    computedMismatches,
    hits: Object.fromEntries(Object.entries(hits).map(([key, value]) => [key, unique(value).slice(0, 12)])),
    message: "Use coverageLevel in final wording. Do not claim a complete style migration unless font/radius/border/shadow/frame-or-asset/active-state and high-frequency asset roles are covered and visually verified.",
  });
  process.exit(okResult ? 0 : 2);
}

function readAssetRoleCoverage(file) {
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    const coverage = json?.coverageGate?.assetRoleCoverage || json?.assetRoleCoverage;
    if (!coverage) return null;
    return {
      status: coverage.status || "unknown",
      covered: Array.isArray(coverage.covered) ? coverage.covered : [],
      missing: Array.isArray(coverage.missing) ? coverage.missing : [],
      gate: coverage.gate || coverage.rule || "",
    };
  } catch {
    return null;
  }
}

function assetUsageGate() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const fileOpt = opt("--files", "");
  const inventoryFile = opt("--asset-inventory", brand ? path.join(root, "migrations", brand, "asset-inventory.json") : "");
  const files = fileOpt
    ? parseList(fileOpt).map((item) => path.resolve(root, item))
    : listFiles(root, /\.(css|scss|sass|less|vue|tsx?|jsx?|html)$/);
  const inventory = inventoryFile && fs.existsSync(inventoryFile)
    ? readJsonLoose(inventoryFile)
    : null;
  const assetRecords = normalizeAssetInventoryRecords(inventory);
  const warnings = [];
  const blocking = [];
  const checked = [];

  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    checked.push(path.relative(root, file));
    if (/\.(css|scss|sass|less)$/i.test(file)) {
      const result = scanAssetUsageCss(text, path.relative(root, file), assetRecords, brand);
      warnings.push(...result.warnings);
      blocking.push(...result.blocking);
    } else {
      const result = scanAssetUsageMarkup(text, path.relative(root, file));
      warnings.push(...result.warnings);
      blocking.push(...result.blocking);
    }
  }

  const result = {
    ok: blocking.length === 0,
    brand,
    checked: unique(checked),
    inventory: inventoryFile && fs.existsSync(inventoryFile) ? path.relative(root, inventoryFile) : "",
    blocking,
    warnings,
    message: blocking.length
      ? "Asset usage gate failed. Fix asset placement before calling this a usable demo/style pack."
      : "Asset usage gate passed. Review warnings before claiming a complete style preview.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 2);
}

function visualPlacementGate() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const planFile = opt("--plan-file", brand ? path.join(root, "migrations", brand, "intent-plan.json") : "");
  const strict = has("--strict");

  if (!planFile) fail("visual-placement-gate requires --plan-file or --brand.");
  const resolvedPlanFile = path.resolve(root, planFile);
  if (!fs.existsSync(resolvedPlanFile)) fail(`Plan file not found: ${resolvedPlanFile}`);

  const plan = readJsonLoose(resolvedPlanFile);
  if (!plan) fail(`Plan file is not valid JSON: ${resolvedPlanFile}`);

  const policy = plan.visualPlacementPolicy || {};
  const placements = Array.isArray(policy.pagePlacements) ? policy.pagePlacements : [];
  const atomicLayers = policy.atomicLayers || policy.layers || {};
  const layerNames = Object.keys(atomicLayers);
  const expectedLayers = ["atoms", "molecules", "organisms", "templates", "pages"];
  const legacyLayerMap = {
    ambient: "atoms",
    action: "molecules",
    asset: "assetSlots",
    showcase: "showcasePlacement",
  };
  const blocking = [];
  const warnings = [];
  const checks = [];
  const add = (id, status, message, fix = "") => {
    checks.push({ id, status, message, fix });
    if (status === "fail") blocking.push({ id, message, fix });
    if (status === "warn") warnings.push({ id, message, fix });
  };

  add(
    "policy-present",
    policy && Object.keys(policy).length ? "pass" : "fail",
    "Host apply should declare a visual placement policy before injecting strong brand visuals.",
    "Add visualPlacementPolicy with atomicLayers, pagePlacements, assetSlots, motionSlots and optional showcasePlacement.",
  );

  for (const name of expectedLayers) {
    add(
      `layer-${name}`,
      layerNames.includes(name) ? "pass" : "fail",
      `Layer ${name} must be declared so agents do not invent ad-hoc placement categories.`,
      `Add visualPlacementPolicy.atomicLayers.${name}.`,
    );
  }
  for (const legacyLayer of Object.keys(legacyLayerMap)) {
    if (layerNames.includes(legacyLayer)) {
      add(
        `legacy-layer-${legacyLayer}`,
        strict ? "fail" : "warn",
        `Layer ${legacyLayer} is legacy wording and should not remain in the placement policy.`,
        `Use ${legacyLayerMap[legacyLayer]} instead. Atomic layers are ${expectedLayers.join(", ")}; assets and showcase are placement capabilities, not layers.`,
      );
    }
  }

  add(
    "placements-present",
    placements.length ? "pass" : "warn",
    "At least one page placement should explain which brand layers are allowed on the target route.",
    "Add visualPlacementPolicy.pagePlacements[] with route, pageType, mode and allowedLayers.",
  );

  for (const placement of placements) {
    const route = String(placement.route || "<unknown>");
    const pageType = String(placement.pageType || "");
    const mode = String(placement.mode || "");
    const allowedLayers = Array.isArray(placement.allowedLayers) ? placement.allowedLayers.map(String) : [];
    const normalizedAllowedLayers = allowedLayers.map((layer) => legacyLayerMap[layer] || layer);
    const showcase = placement.showcasePlacement || null;
    const hasShowcase = allowedLayers.includes("showcase") || Boolean(showcase);
    const isEfficiencyPage = /(tool|list|form|editor|admin|dashboard)/i.test(pageType);

    add(
      `placement-route-${route}`,
      placement.route ? "pass" : "fail",
      "Each placement must name the host route it applies to.",
      "Set route to the real host route, for example /#/pages/plaza/index.",
    );
    add(
      `placement-page-type-${route}`,
      pageType ? "pass" : "fail",
      `Placement ${route} must declare pageType so strong visuals can be judged against business intent.`,
      "Set pageType such as tool, list, form, campaign, landing, or mixed-list-tool.",
    );
    add(
      `placement-mode-${route}`,
      /^(efficiency-first|mixed|showcase-first)$/i.test(mode) ? "pass" : "warn",
      `Placement ${route} should use mode efficiency-first, mixed, or showcase-first.`,
      "Use efficiency-first for tools, mixed for list pages with featured modules, showcase-first for campaign/display pages.",
    );

    for (const layer of allowedLayers) {
      if (legacyLayerMap[layer]) {
        add(
          `placement-legacy-layer-${route}-${layer}`,
          strict ? "fail" : "warn",
          `Placement ${route} uses legacy layer ${layer}.`,
          `Use ${legacyLayerMap[layer]} instead. Atomic layers belong in allowedLayers; brand assets and showcase moments belong in assetSlots, motionSlots or showcasePlacement.`,
        );
        continue;
      }
      add(
        `placement-layer-${route}-${layer}`,
        expectedLayers.includes(layer) ? "pass" : "fail",
        `Placement ${route} uses supported layer ${layer}.`,
        `Allowed layers are ${expectedLayers.join(", ")}.`,
      );
    }
    add(
      `placement-atomic-layer-present-${route}`,
      normalizedAllowedLayers.some((layer) => expectedLayers.includes(layer)) ? "pass" : "fail",
      `Placement ${route} should allow at least one Atomic Design layer.`,
      `Set allowedLayers to one or more of ${expectedLayers.join(", ")}.`,
    );

    if (hasShowcase) {
      const businessPurpose = String(showcase?.businessPurpose || "");
      add(
        `showcase-purpose-${route}`,
        businessPurpose.trim().length >= 24 ? "pass" : "fail",
        `Showcase visual on ${route} must have a concrete business purpose, not only visual decoration.`,
        "Add showcasePlacement.businessPurpose explaining the user task or business action it supports.",
      );
      add(
        `showcase-slot-${route}`,
        showcase?.slot ? "pass" : "warn",
        `Showcase visual on ${route} should declare the slot/component it occupies.`,
        "Add showcasePlacement.slot so reviewers can find the exact DOM/style target.",
      );
      if (isEfficiencyPage && !/^(mixed|showcase-first)$/i.test(mode)) {
        add(
          `showcase-on-efficiency-page-${route}`,
          strict ? "fail" : "warn",
          `Route ${route} is a ${pageType} page but allows showcase visuals without mixed/showcase-first intent.`,
          "Either change mode to mixed with a compact business purpose, or move showcase to campaign/detail/featured modules.",
        );
      }
      const ratio = Number(showcase?.maxFirstScreenRatio);
      if (Number.isFinite(ratio)) {
        const isViewerPage = /(viewer|lightbox|zoom|modal|detail-asset|card-inspection)/i.test(pageType);
        const isCampaignPage = /(campaign|showcase|event|landing|activity)/i.test(pageType);
        const maxRatio = isViewerPage ? 0.9 : isCampaignPage ? 0.7 : 0.5;
        add(
          `showcase-ratio-${route}`,
          ratio > 0 && ratio <= maxRatio ? "pass" : "warn",
          `Showcase visual on ${route} should keep first-screen occupation controlled.`,
          isViewerPage
            ? "Detail viewer/lightbox pages may use a larger focused preview, but keep maxFirstScreenRatio <= 0.9."
            : isCampaignPage
              ? "Campaign/showcase/event pages may use a larger hero, but keep maxFirstScreenRatio <= 0.7."
            : "Set showcasePlacement.maxFirstScreenRatio to a value <= 0.5 for efficiency or mixed pages.",
        );
      }
      const notFor = Array.isArray(showcase?.notFor) ? showcase.notFor : [];
      add(
        `showcase-not-for-${route}`,
        notFor.length ? "pass" : "warn",
        `Showcase visual on ${route} should declare what it must not take over.`,
        "Add showcasePlacement.notFor, for example: not replacing business structure, not decorative-only animation.",
      );
    }
  }

  const okResult = blocking.length === 0;
  ok({
    ok: okResult,
    brand,
    planFile: path.relative(root, resolvedPlanFile),
    policyMode: policy.defaultMode || "",
    checkedLayers: layerNames,
    placements: placements.map((item) => ({
      route: item.route || "",
      pageType: item.pageType || "",
      mode: item.mode || "",
      allowedLayers: item.allowedLayers || [],
      showcaseSlot: item.showcasePlacement?.slot || "",
      showcaseStatus: item.showcasePlacement?.status || "",
    })),
    checks,
    blocking,
    warnings,
    message: okResult
      ? "Visual placement gate passed. Strong visuals have declared page intent and business purpose."
      : "Visual placement gate failed. Fix placement policy before treating strong visuals as reusable host apply behavior.",
  });
}

function evidenceVisibilityGate() {
  const root = path.resolve(opt("--root", process.cwd()));
  const brand = opt("--brand", "");
  const strict = has("--strict");
  if (!brand) fail("evidence-visibility-gate requires --brand.");

  const migrationDir = path.join(root, "migrations", brand);
  const evidenceFile = path.resolve(root, opt("--evidence-file", path.join(migrationDir, "brand-evidence.json")));
  const actionFile = path.resolve(root, opt("--action-file", path.join(migrationDir, "action-evidence-v02.json")));
  const thirdPartyFile = path.resolve(root, opt("--third-party-file", path.join(migrationDir, "third-party-evidence.dembrandt.json")));
  const observationFile = path.resolve(root, opt("--observation-file", path.join(migrationDir, "source-observation-manifest.json")));
  const intentFile = path.resolve(root, opt("--intent-file", path.join(migrationDir, "brand-intent.json")));
  const evidence = readJsonLoose(evidenceFile);
  const actions = readJsonLoose(actionFile);
  const thirdParty = readJsonLoose(thirdPartyFile);
  const explicitGoalFile = opt("--goal-file", "");
  const goalCandidates = explicitGoalFile
    ? [path.resolve(root, explicitGoalFile)]
    : fs.readdirSync(migrationDir)
      .filter((name) => /^goal-contract(?:-[^.]+)?\.json$/.test(name))
      .map((name) => path.join(migrationDir, name));
  const matchingGoalFile = goalCandidates.find((candidate) => readJsonLoose(candidate)?.goalId === evidence?.goalId);
  const goalFile = matchingGoalFile || path.join(migrationDir, "goal-contract.json");
  const goal = readJsonLoose(goalFile);
  const observation = readJsonLoose(observationFile);
  const intent = readJsonLoose(intentFile);
  const checks = [];
  const blocking = [];
  const warnings = [];
  const add = (id, status, message, fix = "", extra = {}) => {
    const item = { id, status, message, fix, ...extra };
    checks.push(item);
    if (status === "fail") blocking.push(item);
    if (status === "warn") warnings.push(item);
  };
  const statusForMissing = strict ? "fail" : "warn";
  const capturePath = (value) => typeof value === "string" ? value : value?.path || value?.screenshot || "";
  const existingCapture = (value) => {
    const raw = capturePath(value);
    if (!raw) return false;
    const file = path.isAbsolute(raw) ? raw : path.resolve(root, raw);
    return fs.existsSync(file);
  };
  const captureHashMatches = (value) => {
    const raw = capturePath(value);
    if (!raw || !value?.sha256) return false;
    const file = path.isAbsolute(raw) ? raw : path.resolve(root, raw);
    return fs.existsSync(file) && crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") === value.sha256;
  };
  const regionValid = (region) => Array.isArray(region)
    && region.length === 4
    && region.every((value) => Number.isFinite(Number(value)))
    && Number(region[2]) > 0
    && Number(region[3]) > 0;
  const visibleDomValid = (value) => Boolean(value?.selector)
    && value.visible !== false
    && (!value.boundingBox || (Number(value.boundingBox.width) > 0 && Number(value.boundingBox.height) > 0));

  add("evidence-json", evidence ? "pass" : "fail", "brand-evidence.json must be valid JSON.", `Create ${path.relative(root, evidenceFile)} from rendered source captures.`);
  add("action-json", actions ? "pass" : statusForMissing, "Action evidence should be valid JSON when the source has interaction claims.", `Create ${path.relative(root, actionFile)} with before/after captures and exact computed properties.`);

  const evidencePolicy = goal?.evidencePolicy || {};
  const continuousRequired = evidencePolicy.continuousCaptureRequired === true;
  if (continuousRequired || observation) {
    add("source-observation-manifest", observation ? "pass" : "fail", "Continuous source evidence requires source-observation-manifest.json.", "Record each required page with full-page capture, continuous playback, lossless-frame timeline and coverage status.");
  }
  if (observation) {
    const observedPages = toArray(observation.pages);
    const observedClaims = toArray(evidence?.claims || evidence?.observations || evidence?.renderedClaims);
    const requiredPageIds = toArray(evidencePolicy.requiredPageIds).length
      ? toArray(evidencePolicy.requiredPageIds)
      : toArray(goal?.referencePages).filter((item) => item?.core !== false).map((item) => item.id);
    requiredPageIds.forEach((pageId) => {
      const page = observedPages.find((item) => item?.id === pageId);
      add(`observation-page-${pageId}`, page && ["covered", "unavailable"].includes(page.status) ? "pass" : "fail", `${pageId} must be covered or explicitly unavailable.`, "Capture the real source page or record unavailableReason.");
      if (!page || page.status !== "covered") {
        if (page?.status === "unavailable") add(`observation-unavailable-${pageId}`, hasMeaningfulValue(page.unavailableReason) ? "pass" : "fail", `${pageId} unavailable status requires a concrete reason.`, "Record the access or rendering blocker.");
        return;
      }
      const pageClaims = observedClaims.filter((claim) => claim?.sourcePageId === pageId && (claim.status || claim.evidenceStatus || "observed") === "observed");
      add(`observation-claim-coverage-${pageId}`, pageClaims.length > 0 ? "pass" : "fail", `${pageId} continuous evidence must be extracted into page-scoped screenshot/region/DOM/computed claims.`, "Review the page playback and frames, then add sourcePageId-scoped claims before Interpreter handoff.", { claimCount: pageClaims.length });
      for (const [kind, value] of [["full-page", page.fullPageCapture], ["continuous", page.continuousCapture], ["timeline", page.timeline]]) {
        add(`observation-${kind}-${pageId}`, existingCapture(value) && captureHashMatches(value) ? "pass" : "fail", `${pageId} ${kind} evidence must exist and match its frozen sha256.`, "Recapture the page and refresh the observation manifest hash.");
      }
      const timelinePath = capturePath(page.timeline);
      const timeline = timelinePath ? readJsonLoose(path.isAbsolute(timelinePath) ? timelinePath : path.resolve(root, timelinePath)) : null;
      const frames = toArray(timeline?.frames);
      const first = frames[0];
      const last = frames[frames.length - 1];
      const viewportHeight = Number(timeline?.meta?.viewport?.height || observation?.viewport?.height || 0);
      const scrollHeight = Number(last?.scrollHeight || timeline?.meta?.scrollHeight || page.timeline?.scrollHeight || 0);
      const reachesEnd = Number(first?.scrollTop) === 0 && Number(last?.scrollTop) >= Math.max(0, scrollHeight - viewportHeight - 8);
      add(`observation-scroll-coverage-${pageId}`, frames.length >= 3 && reachesEnd ? "pass" : "fail", `${pageId} timeline must begin at scrollTop 0 and reach the page end.`, "Record stable initial frames, continuous scroll steps and settled end frames.", { frameCount: frames.length, firstScrollTop: first?.scrollTop, lastScrollTop: last?.scrollTop, scrollHeight, viewportHeight });
    });
    add("observation-consumer-ready", observation?.coverage?.readyForInterpreter === true ? "pass" : "fail", "Evidence must explicitly mark the observation set ready only after page claims and consumer audit are complete.", "Keep readyForInterpreter=false while any required page still lacks extracted claims or a consumer rejection remains.");
    const observedInteractions = toArray(observation.interactions);
    toArray(evidencePolicy.requiredInteractionIds).forEach((interactionId) => {
      const interaction = observedInteractions.find((item) => item?.id === interactionId && item?.status === "covered");
      add(`observation-interaction-${interactionId}`, interaction ? "pass" : "fail", `${interactionId} needs continuous interaction evidence.`, "Record default, transition and settled states with a timeline.");
      if (!interaction) return;
      add(`observation-interaction-media-${interactionId}`, existingCapture(interaction.continuousCapture) && captureHashMatches(interaction.continuousCapture) && existingCapture(interaction.timeline) && captureHashMatches(interaction.timeline) ? "pass" : "fail", `${interactionId} media and timeline must exist and match frozen hashes.`, "Recapture the interaction and refresh both hashes.");
      const timelinePath = capturePath(interaction.timeline);
      const timeline = timelinePath ? readJsonLoose(path.isAbsolute(timelinePath) ? timelinePath : path.resolve(root, timelinePath)) : null;
      const labels = toArray(timeline?.frames).map((frame) => String(frame?.label || ""));
      const hasDefault = labels.some((label) => /default|initial/.test(label));
      const hasTransition = labels.some((label) => /transition|open/.test(label));
      add(`observation-interaction-states-${interactionId}`, hasDefault && hasTransition ? "pass" : "fail", `${interactionId} timeline must expose default and transition/open frames.`, "Do not replace continuous motion evidence with only an after screenshot.");
    });
  }

  const claims = toArray(evidence?.claims || evidence?.observations || evidence?.renderedClaims);
  add("screenshot-first-claims", claims.length ? "pass" : statusForMissing, "Evidence must expose reviewable screenshot-first claims; palette summaries and CSS scans are not rendered facts.", "Add claims/observations with status, capture, sourceRegion, visibleDom and computed evidence.", { claimCount: claims.length });

  const seedDispositions = toArray(evidence?.thirdPartySeedDispositions);
  const observedClaimIds = new Set(claims.filter((claim) => (claim?.status || claim?.evidenceStatus || "observed") === "observed").map((claim) => claim?.id).filter(Boolean));
  if (thirdParty) {
    add("third-party-seed-dispositions", seedDispositions.length ? "pass" : statusForMissing, "Imported Dembrandt/third-party seeds must be dispositioned by the Evidence Agent; extractor success is not evidence completion.", "Add brand-evidence.json.thirdPartySeedDispositions entries with seedRef, status and evidenceRefs or reason.", { dispositionCount: seedDispositions.length, thirdPartyFile: path.relative(root, thirdPartyFile) });
  }
  seedDispositions.forEach((item, index) => {
    const id = item?.id || item?.seedRef || `seed-${index + 1}`;
    const status = item?.status || "";
    add(`seed-disposition-status-${index + 1}`, ["validated", "rejected", "unresolved", "out-of-scope"].includes(status) ? "pass" : "fail", `${id} must use a supported seed disposition status.`, "Use validated, rejected, unresolved or out-of-scope.");
    if (status === "validated") {
      const evidenceRefs = toArray(item.evidenceRefs);
      const refsAreObserved = evidenceRefs.length > 0 && evidenceRefs.every((ref) => observedClaimIds.has(ref));
      add(`seed-disposition-evidence-${index + 1}`, refsAreObserved ? "pass" : "fail", `${id} is validated only when every evidenceRef resolves to an observed Claim.`, "Add evidenceRefs pointing to screenshot-first observed Claim ids.", { evidenceRefs });
    }
    if (["rejected", "unresolved", "out-of-scope"].includes(status)) add(`seed-disposition-reason-${index + 1}`, hasMeaningfulValue(item.reason) ? "pass" : "fail", `${id} needs a reviewable reason for ${status}.`, "Explain the visible contradiction, missing evidence, or why the seed is outside the frozen goal.");
  });

  claims.forEach((claim, index) => {
    if (!claim || typeof claim !== "object") return;
    const id = claim.id || `claim-${index + 1}`;
    const observed = (claim.status || claim.evidenceStatus || "observed") === "observed";
    const highSalience = claim.salience === "high" || claim.highSalience === true || claim.required === true;
    if (!observed || (!strict && !highSalience)) return;
    const capture = claim.capture || claim.screenshot;
    const region = claim.sourceRegion || claim.region || capture?.region;
    add(`claim-capture-${id}`, existingCapture(capture) ? "pass" : "fail", `${id} must begin with a readable rendered screenshot.`, "Capture the real rendered page before reading CSS or naming a brand rule.");
    add(`claim-region-${id}`, regionValid(region) ? "pass" : "fail", `${id} must point to a screenshot region with positive width and height.`, "Record the exact visible region that supports the claim.");
    add(`claim-visible-dom-${id}`, visibleDomValid(claim.visibleDom) ? "pass" : "fail", `${id} must map to a visible DOM node/state with a non-zero box.`, "Locate the element from the screenshot; hidden or zero-size nodes cannot prove a visible pattern.");
    const needsComputed = !["asset", "composition", "content-density"].includes(claim.kind || claim.type);
    const computed = claim.computed || {};
    if (needsComputed) add(`claim-computed-${id}`, Boolean(computed.property && hasMeaningfulValue(computed.value)) ? "pass" : "fail", `${id} must record the exact computed property and value.`, "Store property and value separately; never turn color into backgroundColor or infer semantics from a variable name.");
  });

  // brand-intent/vNext may declare explicit semanticClaims. These are the only
  // semantic declarations this gate treats as an authoritative machine
  // contract. Older intent shapes remain readable and receive warnings rather
  // than retroactive failures until they are migrated.
  const semanticClaims = toArray(intent?.semanticClaims);
  const observedClaimsById = new Map(claims
    .filter((claim) => (claim?.status || claim?.evidenceStatus || "observed") === "observed" && claim?.id)
    .map((claim) => [claim.id, claim]));
  const candidateOnlySource = (value) => /(?:aggregate(?:d)?[-_ ]?palette|palette[-_ ]?frequency|css[-_ ]?var(?:iable)?|dembrandt|third[-_ ]?party[-_ ]?seed|extractor[-_ ]?seed)/i.test(String(value || ""));
  const semanticKinds = /^(?:color|typography|font|shadow|motion|interaction|radius|border|gradient|layout|asset)$/i;

  if (intent && !semanticClaims.length) {
    const hasLegacySemanticRoles = toArray(intent.colorRoles).length
      || toArray(intent?.typography?.observed).length
      || Object.keys(intent.motionAndInteraction || {}).length
      || toArray(intent.styleRecipeDetails).length;
    if (hasLegacySemanticRoles) add(
      "semantic-claims-legacy-schema",
      "warn",
      "Legacy brand intent contains semantic roles but no semanticClaims evidence bindings; it remains readable but cannot prove the new semantic-role contract.",
      "Migrate promoted color/font/shadow/motion roles into semanticClaims with validated disposition, rendered sourceRegion, visible DOM selector, computed property/value, page and state.",
      { intentFile: path.relative(root, intentFile) },
    );
  }

  semanticClaims.forEach((semantic, index) => {
    if (!semantic || typeof semantic !== "object") return;
    const id = semantic.id || `semantic-${index + 1}`;
    const kind = semantic.kind || semantic.type || "";
    if (!semanticKinds.test(kind) || !/^(?:approved|promoted|semantic)$/i.test(String(semantic.status || "approved"))) return;
    const binding = semantic.evidenceBinding || semantic.support || {};
    const disposition = semantic.disposition || semantic.evidenceDisposition || binding.disposition || "";
    const refs = toArray(semantic.evidenceRefs || binding.evidenceRefs || binding.evidenceRef);
    const resolved = refs.map((ref) => observedClaimsById.get(typeof ref === "string" ? ref : ref?.evidenceId)).filter(Boolean);
    const renderedClaim = resolved.find((claim) => {
      const capture = claim.capture || claim.screenshot;
      const region = claim.sourceRegion || claim.region || capture?.region;
      const computed = claim.computed || {};
      return existingCapture(capture)
        && regionValid(region)
        && visibleDomValid(claim.visibleDom)
        && Boolean(computed.property && hasMeaningfulValue(computed.value))
        && hasMeaningfulValue(claim.sourcePageId || claim.page)
        && hasMeaningfulValue(claim.state || claim.observedState);
    });
    const directCapture = binding.capture || binding.screenshot;
    const directRegion = binding.sourceRegion || binding.region || directCapture?.region;
    const directDom = binding.visibleDom || (binding.selector ? { selector: binding.selector, visible: true } : null);
    const directComputed = binding.computed || {};
    const hasDirectRenderedChain = existingCapture(directCapture)
      && regionValid(directRegion)
      && visibleDomValid(directDom)
      && Boolean((directComputed.property || binding.computedProperty) && hasMeaningfulValue(directComputed.value ?? binding.computedValue))
      && hasMeaningfulValue(binding.sourcePageId || binding.page)
      && hasMeaningfulValue(binding.state || binding.observedState);
    const origin = semantic.origin || semantic.source || binding.origin || binding.sourceType || "";
    const candidateOnly = candidateOnlySource(origin);

    add(`semantic-disposition-${id}`, disposition === "validated" ? "pass" : "fail", `${id} is a promoted ${kind} role and requires evidenceDisposition/disposition=validated.`, "Keep aggregate palettes, CSS variable names and Dembrandt output as candidate-only until rendered evidence validates the role.", { kind, origin });
    add(`semantic-rendered-chain-${id}`, renderedClaim || hasDirectRenderedChain ? "pass" : "fail", `${id} must bind a visible screenshot region, DOM selector, computed property/value, page and state.`, "Reference an observed brand-evidence Claim containing the complete rendered chain, or provide that chain in evidenceBinding.", { evidenceRefs: refs });
    if (candidateOnly) add(`semantic-candidate-source-${id}`, renderedClaim || hasDirectRenderedChain ? "pass" : "fail", `${id} originates from candidate-only source ${origin}; that source cannot independently establish a brand semantic role.`, "Validate the candidate against a visible rendered node/state and bind that observed Claim before promotion.");
  });

  const entries = toArray(actions?.entries);
  if (actions) add("action-entries", entries.length ? "pass" : statusForMissing, "Interaction evidence should expose concrete state entries.", "Add one entry per visibly observed interaction state.", { entryCount: entries.length });
  entries.forEach((entry, index) => {
    const id = entry.id || entry.selector || `action-${index + 1}`;
    const before = entry.beforeCapture || entry.captures?.before;
    const after = entry.afterCapture || entry.captures?.after;
    add(`action-state-${index + 1}`, Boolean(entry.observedState && entry.trigger) ? "pass" : "fail", `${id} must preserve the actual observed state and reproducible trigger.`, "Record values such as is-open/open-menu; do not rewrite them as active/current.");
    add(`action-captures-${index + 1}`, existingCapture(before) && existingCapture(after) ? "pass" : "fail", `${id} needs readable before and after captures.`, "Trigger the interaction in the browser and capture both states.");
    add(`action-property-${index + 1}`, Boolean(entry.computedProperty && hasMeaningfulValue(entry.computedValue)) ? "pass" : "fail", `${id} needs the exact changed computed property and value.`, "Record color as color, background-color as backgroundColor, and retain the source rule.");
    const selectorHasOpen = /is-open|\[aria-expanded=["']?true/i.test(entry.selector || "");
    const claimedActive = /\bactive\b|\bcurrent\b/i.test(`${entry.observedState || ""} ${entry.text || ""} ${entry.className || ""}`);
    if (selectorHasOpen && claimedActive && !/open/i.test(entry.observedState || "")) {
      add(`action-semantic-drift-${index + 1}`, "fail", `${id} converts an open/expanded source state into active/current semantics.`, "Keep the narrow source state name and let Interpreter decide whether broader reuse is supported by additional screenshots.");
    }
  });

  const okResult = blocking.length === 0;
  process.stdout.write(`${JSON.stringify({
    ok: okResult,
    brand,
    gate: "screenshot-first-evidence",
    evidenceFile: path.relative(root, evidenceFile),
    actionFile: path.relative(root, actionFile),
    thirdPartyFile: thirdParty ? path.relative(root, thirdPartyFile) : null,
    observationFile: path.relative(root, observationFile),
    intentFile: intent ? path.relative(root, intentFile) : null,
    checks,
    blocking,
    warnings,
    message: okResult ? "Evidence visibility gate passed. Interpreter may consume these rendered facts." : "Evidence visibility gate failed. Stop before Interpreter; repair the earliest screenshot/DOM/state/property evidence defects.",
  }, null, 2)}\n`);
  process.exit(okResult ? 0 : 2);
}

function handoffArtifactGate() {
  const root = opt("--root", process.cwd());
  const mode = opt("--mode", "learn-brand");
  const brand = opt("--brand", "");
  const strict = has("--strict");
  if (!brand) fail("handoff-artifact-gate requires --brand.");

  const contractFile = workflowContractFile(root);
  const contract = readJsonLoose(contractFile);
  if (!contract?.workflows?.[mode]) fail(`Workflow contract missing for mode "${mode}": ${contractFile}`);

  const migrationDir = path.join(root, "migrations", brand);
  const artifactContracts = contract.artifactContracts || {};
  const goalContract = readJsonLoose(path.join(migrationDir, "goal-contract.json"));
  const usesFidelityProtocol = /^brand-goal\/v\d+$/.test(goalContract?.schema || "");
  const expectedArtifacts = usesFidelityProtocol
    ? mode === "apply-host"
      ? ["host-opportunity-map.json", "visual-qa-assessment.json", "fidelity-report.json", "retro-learnings.json"]
      : ["brand-evidence.json", "source-observation-manifest.json", "action-evidence-v02.json", "brand-intent.json", "visual-qa-assessment.json", "fidelity-report.json", "retro-learnings.json"]
    : mode === "apply-host"
    ? ["host-opportunity-map.json", "visual-qa-report.json", "retro-learnings.json"]
    : ["brand-evidence.json", "source-observation-manifest.json", "action-evidence-v02.json", "brand-intent.json", "visual-qa-report.json", "retro-learnings.json"];
  const alternatives = {
    "host-opportunity-map.json": ["host-opportunity-map.json", "intent-plan.json"],
    "intent-plan.json": ["intent-plan.json", "host-opportunity-map.json"],
    "visual-qa-report.json": ["visual-qa-report.json", "visual-quality-report.json"],
  };

  const checks = [];
  const blocking = [];
  const warnings = [];
  const add = (id, status, message, fix = "", extra = {}) => {
    const check = { id, status, message, fix, ...extra };
    checks.push(check);
    if (status === "fail") blocking.push(check);
    if (status === "warn") warnings.push(check);
  };

  add(
    "artifact-contract-present",
    Object.keys(artifactContracts).length ? "pass" : "fail",
    "Workflow contract should define minimal schemas for role handoff artifacts.",
    "Add artifactContracts to skills/brand/workflow-contract.json.",
  );

  for (const artifactName of expectedArtifacts) {
    const names = alternatives[artifactName] || [artifactName];
    const file = names.map((name) => path.join(migrationDir, name)).find((candidate) => fs.existsSync(candidate));
    const contractName = names.find((name) => artifactContracts[name]) || artifactName;
    const artifactContract = artifactContracts[contractName] || {};
    const label = names.join(" or ");

    if (!file) {
      add(
        `artifact-present-${artifactName}`,
        strict ? "fail" : "warn",
        `${label} is missing, so the ${artifactContract.owner || "role"} handoff is not auditable yet.`,
        `Create migrations/${brand}/${artifactName} with the required role handoff fields, or run without --strict only while the flow is still in progress.`,
        { artifact: artifactName },
      );
      continue;
    }

    const json = readJsonLoose(file);
    if (!json) {
      add(
        `artifact-json-${path.basename(file)}`,
        "fail",
        `${path.basename(file)} exists but is not valid JSON.`,
        "Fix the JSON before treating the role handoff as usable.",
        { artifact: artifactName, file: path.relative(root, file) },
      );
      continue;
    }

    add(
      `artifact-present-${artifactName}`,
      "pass",
      `${path.basename(file)} is present for ${artifactContract.owner || "role"} handoff.`,
      "",
      { artifact: artifactName, file: path.relative(root, file) },
    );
    validateArtifactContract({
      artifactName,
      file,
      root,
      json,
      contract: artifactContract,
      strict,
      add,
    });
  }

  const okResult = blocking.length === 0;
  const result = {
    ok: okResult,
    mode,
    brand,
    migrationDir: path.relative(root, migrationDir),
    externalGoodcaseAdoption: contract.externalGoodcaseAdoption || {},
    checks,
    blocking,
    warnings,
    message: okResult
      ? "Role handoff artifact gate passed. The workflow now has auditable role outputs, not only Markdown intent."
      : "Role handoff artifact gate failed. Fix missing or shallow role outputs before claiming this workflow is complete.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(okResult ? 0 : 2);
}

function externalGoodcaseGate() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const reportFile = opt("--report", brand ? path.join(root, "migrations", brand, "external-goodcase-adoption.json") : "");
  const strict = has("--strict");
  if (!reportFile) fail("external-goodcase-gate requires --report or --brand.");

  const resolvedReportFile = path.resolve(root, reportFile);
  if (!fs.existsSync(resolvedReportFile)) fail(`External goodcase adoption report not found: ${resolvedReportFile}`);

  const contractFile = workflowContractFile(root);
  const contract = readJsonLoose(contractFile);
  const policy = contract?.externalGoodcaseAdoption || {};
  const report = readJsonLoose(resolvedReportFile);
  if (!report) fail(`External goodcase adoption report is not valid JSON: ${resolvedReportFile}`);

  const allowedDecisions = ["retain", "iterate", "deprecate", "optionalHook"];
  const protectedGates = [
    "tpp",
    "computed-first",
    "dtcg",
    "selector-map",
    "coverage",
    "asset-usage",
    "visual-placement",
    "p0-acceptance",
    "record-run",
  ];
  const adoptions = normalizeExternalGoodcaseItems(report);
  const checks = [];
  const blocking = [];
  const warnings = [];
  const add = (id, status, message, fix = "", extra = {}) => {
    const check = { id, status, message, fix, ...extra };
    checks.push(check);
    if (status === "fail") blocking.push(check);
    if (status === "warn") warnings.push(check);
  };

  add(
    "policy-present",
    Object.keys(policy).length ? "pass" : "fail",
    "workflow-contract.json should define externalGoodcaseAdoption before external projects can affect Brand workflow.",
    "Add retain/iterate/deprecate/optionalHook policy to skills/brand/workflow-contract.json.",
  );
  add(
    "report-items-present",
    adoptions.length ? "pass" : "fail",
    "External goodcase adoption must list concrete overlap decisions.",
    "Add adoptions[] or decisions[] with source, capability, decision, reason, brandCapability and action.",
  );

  for (const [index, item] of adoptions.entries()) {
    const label = String(item.capability || item.name || item.source || `item-${index + 1}`);
    const decision = String(item.decision || "");
    const source = String(item.source || item.goodcase || report.source || "");
    const brandCapability = String(item.brandCapability || item.existingBrandCapability || item.mapsTo || "");
    const action = String(item.action || item.nextAction || item.landing || "");
    const reason = String(item.reason || item.rationale || "");
    const replacesBrandGate = item.replacesBrandGate === true
      || /replace|替代|接管|supplant/i.test(action)
      || /replace|替代|接管|supplant/i.test(reason);
    const protectedGateHits = protectedGates.filter((gate) => {
      const pattern = new RegExp(escapeRegExp(gate), "i");
      return pattern.test(brandCapability) || pattern.test(action) || pattern.test(reason);
    });

    add(
      `external-source-${index + 1}`,
      source ? "pass" : "fail",
      `External adoption item ${index + 1} (${label}) should name the external source.`,
      "Set source, for example gstack.",
    );
    add(
      `external-decision-${index + 1}`,
      allowedDecisions.includes(decision) ? "pass" : "fail",
      `External adoption item ${index + 1} (${label}) should use a supported decision.`,
      `Use one of ${allowedDecisions.join(", ")}.`,
      { decision },
    );
    add(
      `external-brand-capability-${index + 1}`,
      brandCapability ? "pass" : strict ? "fail" : "warn",
      `External adoption item ${index + 1} (${label}) should map to an existing or proposed Brand capability.`,
      "Set brandCapability so reviewers know whether to retain, iterate, deprecate, or optional-hook.",
    );
    add(
      `external-reason-${index + 1}`,
      reason.length >= 16 ? "pass" : strict ? "fail" : "warn",
      `External adoption item ${index + 1} (${label}) should explain why this decision is safe.`,
      "Add a concrete reason tied to Brand workflow, not a generic praise of the external project.",
    );
    add(
      `external-action-${index + 1}`,
      action.length >= 8 ? "pass" : strict ? "fail" : "warn",
      `External adoption item ${index + 1} (${label}) should declare the landing action.`,
      "Add action, for example keep Brand gate, improve report wording, or add optional review hook.",
    );

    if (decision === "deprecate") {
      add(
        `external-deprecate-scope-${index + 1}`,
        !protectedGateHits.length && !replacesBrandGate ? "pass" : "fail",
        `External adoption item ${index + 1} (${label}) must not deprecate protected Brand gates.`,
        "Only deprecate Markdown-only duplicates or outdated synonyms. Keep TPP, computed-first, DTCG, selector-map, coverage, asset-usage, visual-placement, P0 acceptance, and record-run gates.",
        { protectedGateHits },
      );
    }

    if (decision === "optionalHook") {
      add(
        `external-optional-nonblocking-${index + 1}`,
        item.blocking === true ? "fail" : "pass",
        `External optional hook ${index + 1} (${label}) must not become a required dependency for Brand Skill.`,
        "Keep external orchestrators advisory. Brand Skill must still run without the external project.",
      );
    }

    if (replacesBrandGate && protectedGateHits.length) {
      add(
        `external-no-gate-replacement-${index + 1}`,
        "fail",
        `External adoption item ${index + 1} (${label}) attempts to replace protected Brand domain gates.`,
        "Classify the external idea as iterate or optionalHook, and keep Brand hard gates as the source of truth.",
        { protectedGateHits },
      );
    }
  }

  const okResult = blocking.length === 0;
  ok({
    ok: okResult,
    brand,
    report: path.relative(root, resolvedReportFile),
    allowedDecisions,
    protectedGates,
    decisions: adoptions.map((item) => ({
      source: item.source || item.goodcase || report.source || "",
      capability: item.capability || item.name || "",
      decision: item.decision || "",
      brandCapability: item.brandCapability || item.existingBrandCapability || item.mapsTo || "",
      action: item.action || item.nextAction || item.landing || "",
    })),
    checks,
    blocking,
    warnings,
    message: okResult
      ? "External goodcase gate passed. External projects can advise orchestration, but Brand domain gates remain the authority."
      : "External goodcase gate failed. Fix adoption decisions before replacing or editing Brand workflow capabilities.",
  });
  process.exit(okResult ? 0 : 2);
}

function validateArtifactContract({ artifactName, file, root, json, contract, strict, add }) {
  const requiredAny = toArray(contract.requiredAny);
  const matchedTopFields = requiredAny.filter((field) => hasMeaningfulValue(json?.[field]));
  add(
    `artifact-shape-${path.basename(file)}`,
    requiredAny.length === 0 || matchedTopFields.length ? "pass" : "fail",
    `${path.basename(file)} should contain at least one meaningful top-level handoff field: ${requiredAny.join(", ")}.`,
    `Add one of ${requiredAny.join(", ")} with concrete role output, not a placeholder.`,
    { artifact: artifactName, file: path.relative(root, file), matchedTopFields },
  );

  const items = collectArtifactItems(json, requiredAny);
  add(
    `artifact-items-${path.basename(file)}`,
    items.length ? "pass" : strict ? "fail" : "warn",
    `${path.basename(file)} should expose reviewable items so the next role can see concrete decisions.`,
    "Add an array/object of visual patterns, page placements, QA findings, or retro learnings.",
    { artifact: artifactName, file: path.relative(root, file), itemCount: items.length },
  );

  const itemRequiredAny = toArray(contract.itemRequiredAny);
  const itemRecommended = toArray(contract.itemRecommended);
  const sampleItems = items.slice(0, 8);
  sampleItems.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const matchedRequired = itemRequiredAny.filter((field) => hasMeaningfulValue(item[field]));
    add(
      `artifact-item-required-${path.basename(file)}-${index + 1}`,
      itemRequiredAny.length === 0 || matchedRequired.length ? "pass" : "fail",
      `${path.basename(file)} item ${index + 1} should explain meaning, purpose, route, status, or resolution so the next role can use it.`,
      `Add one of ${itemRequiredAny.join(", ")} to this item.`,
      { artifact: artifactName, file: path.relative(root, file), matchedRequired },
    );

    const matchedRecommended = itemRecommended.filter((field) => hasMeaningfulValue(item[field]));
    add(
      `artifact-item-recommended-${path.basename(file)}-${index + 1}`,
      matchedRecommended.length ? "pass" : "warn",
      `${path.basename(file)} item ${index + 1} should include usage boundaries or evidence when possible.`,
      `Consider adding one of ${itemRecommended.join(", ")}.`,
      { artifact: artifactName, file: path.relative(root, file), matchedRecommended },
    );
  });
}

function collectArtifactItems(json, candidateFields = []) {
  if (Array.isArray(json?.visualPlacementPolicy?.pagePlacements)) {
    return json.visualPlacementPolicy.pagePlacements.filter((item) => hasMeaningfulValue(item));
  }
  if (Array.isArray(json?.pagePlacements)) {
    return json.pagePlacements.filter((item) => hasMeaningfulValue(item));
  }
  if (Array.isArray(json?.opportunities)) {
    return json.opportunities.filter((item) => hasMeaningfulValue(item));
  }
  const preferred = [
    ...candidateFields,
    "patterns",
    "visualPatterns",
    "styleRecipeDetails",
    "interactionRecipes",
    "pagePlacements",
    "opportunities",
    "findings",
    "checks",
    "checkedPages",
    "learnings",
    "decisions",
    "adoptions",
    "externalGoodcaseAdoption",
    "ruleCandidates",
  ];
  const collected = [];
  for (const field of unique(preferred)) {
    const value = json?.[field];
    if (Array.isArray(value)) collected.push(...value);
    else if (value && typeof value === "object") collected.push(...Object.values(value));
  }
  const policyPlacements = json?.visualPlacementPolicy?.pagePlacements;
  if (Array.isArray(policyPlacements)) collected.push(...policyPlacements);
  return collected.filter((item) => hasMeaningfulValue(item));
}

function normalizeExternalGoodcaseItems(report) {
  if (Array.isArray(report)) return report.filter((item) => item && typeof item === "object");
  const candidates = [
    report?.adoptions,
    report?.decisions,
    report?.externalGoodcaseAdoption,
    report?.items,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
    if (value && typeof value === "object") return Object.values(value).filter((item) => item && typeof item === "object");
  }
  return [];
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (value && typeof value === "object") return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
  if (typeof value === "string") {
    const text = value.trim();
    return text.length >= 2 && !/^(todo|tbd|placeholder|n\/a|null|none)$/i.test(text);
  }
  return value !== null && value !== undefined && value !== false;
}

function ruleCandidateGate() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const modFile = opt("--mod-file", brand ? path.join(root, "migrations", brand, "brand-mod.json") : "");
  if (!modFile) fail("Missing --brand or --mod-file.");
  if (!fs.existsSync(modFile)) fail(`Brand MOD not found: ${modFile}`);

  const mod = readJsonLoose(modFile);
  if (!mod) fail(`Brand MOD is not valid JSON: ${modFile}`);

  const modBrand = brand || mod?.manifest?.brand || inferBrandKey(mod?.manifest?.sourceUrl) || "";
  const candidates = Array.isArray(mod?.verification?.ruleCandidates)
    ? mod.verification.ruleCandidates
    : [];
  const warnings = [];
  const blocking = [];
  const checked = [];

  for (const candidate of candidates) {
    const id = String(candidate?.id || "");
    const level = String(candidate?.promotion?.level || "candidate-warning");
    const verifiedBrands = arrayFromMaybe(candidate?.promotion?.verifiedBrands).filter(Boolean);
    const base = {
      id,
      level,
      observedIn: arrayFromMaybe(candidate?.observedIn),
      verifiedBrands,
      appliesWhen: candidate?.appliesWhen || "",
      scriptCheck: candidate?.scriptCheck || "",
    };
    checked.push(base);

    if (!id || !candidate?.abstractMechanism || !candidate?.appliesWhen || !candidate?.evidenceRequired || !candidate?.scriptCheck) {
      blocking.push({
        ...base,
        type: "incomplete-rule-candidate",
        fix: "Each rule candidate must explain mechanism, appliesWhen, evidenceRequired, scriptCheck, and promotion before it can guide another project.",
      });
      continue;
    }

    if (level === "blocking" && verifiedBrands.length < 2 && !/inspector|rollback|checkpoint|overlay|bottom|fixed|safe-area/i.test(id)) {
      blocking.push({
        ...base,
        type: "blocking-rule-without-cross-brand-proof",
        fix: "Keep the rule as candidate-warning until it is verified by at least two brands, unless it is a platform-level guard.",
      });
    }

    const ruleResult = evaluateRuleCandidateAgainstMod(id, mod);
    if (ruleResult.level === "block") {
      blocking.push({ ...base, type: ruleResult.type, fix: ruleResult.fix });
    } else if (ruleResult.level === "warn") {
      warnings.push({ ...base, type: ruleResult.type, fix: ruleResult.fix });
    }

    if (level === "candidate-warning") {
      warnings.push({
        ...base,
        type: "candidate-rule-not-yet-global",
        fix: "Treat this as a learning checklist on the next brand. Do not interrupt operators unless a dedicated gate marks it blocking.",
      });
    }
  }

  const result = {
    ok: blocking.length === 0,
    brand: modBrand,
    modFile: path.relative(root, modFile),
    checked,
    blocking,
    warnings,
    message: blocking.length
      ? "Rule candidate gate failed. Fix blocking platform/common rules before using this MOD as a reusable sample."
      : "Rule candidate gate passed. Candidate warnings are learning prompts for the next brand, not hard blockers.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 2);
}

function evaluateRuleCandidateAgainstMod(id, mod) {
  const text = String(id || "");
  const layoutRules = mod?.layoutRules || {};
  const assets = Array.isArray(mod?.assets) ? mod.assets : [];
  const layers = Array.isArray(layoutRules?.sectionBackgroundChain?.layers)
    ? layoutRules.sectionBackgroundChain.layers
    : [];

  if (/inspector|overlay/i.test(text)) {
    if (layoutRules?.overlay?.inspectorTag?.mustNotAffectLayout !== true) {
      return {
        level: "block",
        type: "inspector-overlay-layout-contract-missing",
        fix: "Set layoutRules.overlay.inspectorTag.mustNotAffectLayout=true and implement tags/markers as absolute overlay, not layout-flow content.",
      };
    }
  }

  if (/bottom|fixed|safe-area|reserve/i.test(text)) {
    if (layoutRules?.bottomBarReserve?.required !== true || !layoutRules?.bottomBarReserve?.minPadding) {
      return {
        level: "block",
        type: "bottom-fixed-reserve-contract-missing",
        fix: "Set layoutRules.bottomBarReserve.required=true with a minPadding value so the last feed/card can scroll above fixed TabBar/BottomBar.",
      };
    }
  }

  if (/section-background|background-chain|torn|tear|edge/i.test(text)) {
    if (!layoutRules?.sectionBackgroundChain?.mode || !layers.length) {
      return {
        level: "warn",
        type: "section-background-chain-not-described",
        fix: "Describe page/section/module background layering in layoutRules.sectionBackgroundChain before applying this pattern to another brand.",
      };
    }
    const hasSectionLayer = layers.some((layer) => /section|edge|transition|background|module/i.test(`${layer.id || ""} ${layer.coverage || ""} ${layer.sourceSelector || ""}`));
    if (!hasSectionLayer) {
      return {
        level: "warn",
        type: "section-background-chain-lacks-section-layer",
        fix: "Add at least one layer that clearly represents section background or section transition coverage.",
      };
    }
  }

  if (/image-fit|content-image|ratio|media/i.test(text)) {
    const contentPolicy = String(layoutRules?.imageFit?.contentImage || "");
    const heroPolicy = String(layoutRules?.imageFit?.heroImage || "");
    if (!contentPolicy || !heroPolicy) {
      return {
        level: "warn",
        type: "image-fit-policy-missing",
        fix: "Record separate contentImage and heroImage fit policies; content images should not be stretched or turned into background unless evidence proves it.",
      };
    }
  }

  if (/rendered-asset|asset-inventory|pseudo|picture|source|sprite/i.test(text)) {
    const hasAssetRoles = assets.some((asset) => /background|image|font|frame|logo|sprite|texture|media|hero|section/i.test(`${asset.role || ""} ${asset.id || ""}`));
    if (!hasAssetRoles) {
      return {
        level: "warn",
        type: "rendered-asset-inventory-too-thin",
        fix: "Record DOM images, picture/source candidates, CSS url(), pseudo-element backgrounds, masks, frames, and fonts as assets.",
      };
    }
  }

  return { level: "ok" };
}

function scanAssetUsageCss(text, file, assetRecords, brand = "") {
  const warnings = [];
  const blocking = [];
  const blocks = extractCssBlocks(text);
  for (const block of blocks) {
    const selector = block.selector || "";
    const body = block.body || "";
    if (brand && !selectorTargetsBrand(selector, brand)) continue;
    const lower = `${selector} ${body}`.toLowerCase();
    const role = inferCssAssetUsageRole(selector, body, assetRecords);
    const isPseudo = /::(?:before|after)\b/.test(selector);
    const hasImageUrl = /url\(/i.test(body);
    const hasDecorativeCue = isPseudo || /url\(|mask|border-image|clip-path|content\s*:|pointer-events\s*:\s*none/i.test(body);
    const matchedAssetRecords = assetRecords.filter((record) => assetRecordMatchesCssBody(record, body));

    for (const record of matchedAssetRecords) {
      const placement = validateAssetPlacement(record, selector);
      if (placement.level === "block") {
        blocking.push({
          type: placement.type,
          file,
          selector,
          asset: record.id || record.name || record.sourceUrl || "",
          role: record.role || "",
          targetScope: record.targetScope || [],
          antiScopes: record.antiScopes || [],
          fix: placement.message,
        });
      } else if (placement.level === "warn") {
        warnings.push({
          type: placement.type,
          file,
          selector,
          asset: record.id || record.name || record.sourceUrl || "",
          role: record.role || "",
          targetScope: record.targetScope || [],
          fix: placement.message,
        });
      }
    }

    const sectionBackgroundMatches = matchedAssetRecords.filter((record) => /section-background/i.test(String(record?.role || "")));
    if (sectionBackgroundMatches.length && /phone-screen|page|root|shell/i.test(selector)) {
      const backgroundValues = cssPropertyValues(body, "background");
      const renderedBackgroundHasAsset = backgroundValues.some((value) => /url\(/i.test(value));
      const renderedBackgroundIsGradient = backgroundValues.some((value) => /linear-gradient|radial-gradient/i.test(value));
      if (renderedBackgroundIsGradient && !renderedBackgroundHasAsset) {
        warnings.push({
          type: "section-background-evidence-hidden-behind-fallback-gradient",
          file,
          selector,
          assets: sectionBackgroundMatches.map((record) => record.id || record.name || record.sourceUrl || "").filter(Boolean),
          fix: "A section-background asset is recorded on this selector, but the rendered background property is only a gradient. Move the asset into the actual background layer or a pseudo-element; keep the gradient as the last fallback only.",
        });
      }
    }

    const isAssetDecoration = isPseudo || hasImageUrl || /mask|border-image|clip-path/i.test(body);
    if (hasDecorativeCue && isAssetDecoration && /(?:card|list|grid|title|heading|tabs?|button|form|input|textarea|select|tag|summary)\b/i.test(selector) && !/hero|section|media|asset|frame|edge|poster|gallery|stage|banner/i.test(selector)) {
      warnings.push({
        type: "decorative-mounted-on-generic-component",
        file,
        selector,
        role,
        fix: "Do not mount cloud/torn/frame pseudo-elements on ordinary Card/List/Grid/Title/Control selectors unless evidence targetScope names that selector.",
      });
    }

    if (isPseudo && /background[^;]*url\(/i.test(body) && role === "section-edge" && /width\s*:\s*(?:min|max|clamp)\(/i.test(body)) {
      blocking.push({
        type: "section-edge-shrunk-to-card-decoration",
        file,
        selector,
        fix: "Section-edge / stage background assets should span the section or phone content width; do not use width:min(...) unless computed evidence proves an inset card decoration.",
      });
    }

    if (hasImageUrl && /background(?:-image)?\s*:[^;]*url\(/i.test(body) && /background(?:-size)?[^;]*(?:cover|\/\s*cover)/i.test(body) && !/object-fit\s*:\s*cover|computed crop|mask|overflow\s*:\s*hidden/i.test(body)) {
      warnings.push({
        type: "background-cover-needs-computed-crop-evidence",
        file,
        selector,
        fix: "Use contain/intrinsic image layout unless computed style proves this asset is intentionally cropped as a background.",
      });
    }

    if (/\.click-target\.selected|phone-screen--has-selection.*\.click-target\.selected/.test(selector) && /outline-offset\s*:\s*0|box-shadow\s*:\s*0\s+0\s+0/i.test(body)) {
      warnings.push({
        type: "inspector-highlight-can-look-like-image-border",
        file,
        selector,
        fix: "For Hero/Image/Swiper/Asset nodes, selected outline should be offset outward and should not add a border-like box-shadow on the image edge.",
      });
    }

    if (/phone-screen--has-selection/.test(selector) && /opacity\s*:\s*0\.[0-8]|filter\s*:\s*saturate/i.test(body)) {
      const hasExceptionNearby = /hero|image|swiper|asset|media|poster|gallery|stage/.test(selector);
      if (!hasExceptionNearby) {
        warnings.push({
          type: "selection-dims-all-targets",
          file,
          selector,
          fix: "Strong visual asset nodes need hover/selection exceptions so assets do not disappear while inspecting.",
        });
      }
    }

    if (/(?:hero|image|swiper|asset|media|poster|gallery|stage|banner)/i.test(selector) && /(?::hover|:active|\.selected)/i.test(selector)) {
      const hasScaleOrTransform = /(?:^|;|\s)(?:scale|transform)\s*:/i.test(body);
      const freezesScale = /scale\s*:\s*1\s*!important/i.test(body);
      const freezesTransform = /transform\s*:\s*none\s*!important/i.test(body);
      if (hasScaleOrTransform && (!freezesScale || !freezesTransform)) {
        blocking.push({
          type: "strong-visual-interaction-changes-geometry",
          file,
          selector,
          fix: "Hero/Image/Swiper/Asset nodes are source visual evidence. Hover/active/selected states must not scale, translate, or animate them; freeze with scale:1 and transform:none, then keep the inspector tag independent.",
        });
      }
    }
  }
  const backgroundStackIssue = validateBackgroundStack(blocks, assetRecords, brand);
  if (backgroundStackIssue) {
    blocking.push(backgroundStackIssue);
  }
  return { blocking, warnings };
}

function cssPropertyValues(body, property) {
  const escaped = String(property || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...String(body || "").matchAll(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+)`, "gi"))]
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean);
}

function validateBackgroundStack(blocks, assetRecords, brand = "") {
  const records = assetRecords || [];
  const hasPageBackgroundEvidence = records.some((record) => /background|hero-kv/i.test(`${record.role || ""} ${arrayFromMaybe(record.targetScope).join(" ")}`));
  const hasSectionEdgeEvidence = records.some((record) => /section-edge|tear|torn|撕纸|edge/i.test(`${record.role || ""} ${record.id || ""} ${arrayFromMaybe(record.targetScope).join(" ")}`));
  const sectionBackgroundRecords = records.filter((record) => /section-background/i.test(`${record.role || ""}`));
  const hasModuleDecorEvidence = records.some((record) => /decorative-layer|asset-frame|texture|module|stage|monthly/i.test(`${record.role || ""} ${record.id || ""} ${arrayFromMaybe(record.targetScope).join(" ")}`));
  if (!(hasPageBackgroundEvidence && (hasSectionEdgeEvidence || hasModuleDecorEvidence))) return null;

  const relevantBlocks = blocks.filter((block) => !brand || selectorTargetsBrand(block.selector || "", brand));
  const hasPageLayer = relevantBlocks.some((block) => /phone-screen|page|root|shell/i.test(block.selector || "") && /background\s*:/i.test(block.body || ""));
  const hasSectionLayer = relevantBlocks.some((block) => /::(?:before|after)|edge|hero|contents/i.test(block.selector || "") && /background\s*:/i.test(block.body || "") && /transparent|radial-gradient|linear-gradient|url\(/i.test(block.body || ""));
  const hasModuleLayer = relevantBlocks.some((block) => /asset|stage|media|gallery|reward|calendar|benefit|poster/i.test(block.selector || "") && /background\s*:[^{};]*(?:url\(|radial-gradient|linear-gradient)/i.test(block.body || ""));
  const sectionEdgeScopes = new Set(
    relevantBlocks
      .filter((block) => /::(?:before|after)|edge/i.test(block.selector || "") && /background\s*:/i.test(block.body || ""))
      .flatMap((block) => String(block.selector || "").split(","))
      .map((selector) => selector.trim())
      .filter((selector) => /gallery|reward|calendar|news|file|media|benefit|poster|stage|contents|section/i.test(selector))
      .map((selector) => selector.replace(/::(?:before|after).*/, "").replace(/\.theme-[\w-]+\s+/, "").trim())
  );
  const sectionBackgroundScopes = new Set(
    relevantBlocks
      .filter((block) => /background\s*:[\s\S]*url\(/i.test(block.body || ""))
      .filter((block) => sectionBackgroundRecords.some((record) => assetRecordMatchesCssBody(record, block.body || "")))
      .flatMap((block) => String(block.selector || "").split(","))
      .map((selector) => selector.trim())
      .filter((selector) => /benefit|calendar|news|media|pet|section|phone-screen/i.test(selector))
  );

  if (!hasPageLayer || !hasSectionLayer || (hasModuleDecorEvidence && !hasModuleLayer)) {
    return {
      type: "background-stack-incomplete",
      brand,
      expected: ["page background layer", "section transition / torn edge layer", "module decorative / asset layer"],
      found: {
        pageLayer: hasPageLayer,
        sectionLayer: hasSectionLayer,
        moduleLayer: hasModuleLayer,
      },
      fix: "Strong visual sites need a page/section/module background stack. Do not claim the background language is learned if only one card or one asset block carries the decorative background.",
    };
  }
  if (hasSectionEdgeEvidence && sectionEdgeScopes.size < 2 && sectionBackgroundScopes.size < 2) {
    return {
      type: "section-edge-too-sparse",
      brand,
      expected: "section-edge / torn-paper treatment appears on multiple real sections, not only one card or one rendered asset block",
      found: {
        sectionEdges: Array.from(sectionEdgeScopes),
        sectionBackgrounds: Array.from(sectionBackgroundScopes),
      },
      fix: "When the source site uses repeated torn-paper section transitions, apply the edge treatment through real section backgrounds or section-edge layers on at least two real sections before marking the style as learned.",
    };
  }
  return null;
}

function assetRecordMatchesCssBody(record, body) {
  if (!body) return false;
  const sources = assetRecordUrls(record);
  if (!sources.length) return false;
  const candidates = new Set();
  for (const source of sources) {
    candidates.add(source);
    if (source.startsWith("https://")) candidates.add(source.replace(/^https:/, ""));
    if (source.startsWith("http://")) candidates.add(source.replace(/^http:/, ""));
    if (source.startsWith("//")) {
      candidates.add(`https:${source}`);
      candidates.add(`http:${source}`);
    }
  }
  return [...candidates].some((candidate) => body.includes(candidate));
}

function assetRecordUrls(record) {
  return [record?.sourceUrl, record?.resolvedUrl, record?.rawSrc]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function validateAssetPlacement(record, selector) {
  const selectorText = String(selector || "").toLowerCase();
  const roleText = String(record?.role || "").toLowerCase();
  const targetScopes = arrayFromMaybe(record?.targetScope).map((item) => String(item));
  const antiScopes = arrayFromMaybe(record?.antiScopes).map((item) => String(item));

  const antiMatch = antiScopes.find((scope) => scopeMatchesSelector(scope, selectorText));
  if (antiMatch) {
    return {
      level: "block",
      type: "asset-used-in-anti-scope",
      message: `Asset inventory marks "${antiMatch}" as an anti-scope. Move this asset to its recorded targetScope or use a tokenized fallback.`,
    };
  }

  const isGlobalShell = /\.(?:phone-screen|template-contents|contents|workspace|demo-stage|shell)\b/.test(selectorText)
    && !/hero|media|stage|asset|gallery|reward|benefit|calendar|news|pet|publish|navigation|tab|button|card|frame|edge/.test(selectorText);
  const allowsGlobal = /page|global|background|canvas|body|wallpaper|theme/.test(`${roleText} ${targetScopes.join(" ")}`.toLowerCase());
  if (isGlobalShell && !allowsGlobal) {
    return {
      level: "block",
      type: "asset-mounted-on-global-shell",
      message: "This asset is scoped to a module/section, not the whole phone or page shell. Mount it on the matching section selector instead.",
    };
  }

  if (targetScopes.length && !targetScopes.some((scope) => scopeMatchesSelector(scope, selectorText))) {
    return {
      level: "warn",
      type: "asset-target-scope-not-evident",
      message: "Selector does not clearly match the asset targetScope. Verify computed evidence or narrow the selector before claiming the style is correct.",
    };
  }

  return { level: "ok" };
}

function arrayFromMaybe(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return parseList(value);
  return [];
}

function scopeMatchesSelector(scope, selectorText) {
  const text = `${scope}`.toLowerCase();
  const selector = `${selectorText}`.toLowerCase();
  const tokens = [
    [/heroheader|hero|kv|homepage top|top visual/, "hero|kv|home"],
    [/navigationbar|navigation|nav/, "navigation|nav"],
    [/tabs?/, "tabs?|tab-bar"],
    [/button|cta|action|download/, "button|cta|action|download"],
    [/reward|lottery/, "reward|lottery|benefit"],
    [/calendar|event/, "calendar|event"],
    [/media|gallery|image grid/, "media|gallery"],
    [/image|picture|banner|poster/, "image|picture|banner|poster|media|gallery|hero|benefit|calendar"],
    [/pet|detail panel/, "pet|detail"],
    [/stage|decorative|monthly|character/, "stage|asset|decorative|monthly|character|media"],
    [/section transition|section-edge|edge/, "edge|hero|section"],
    [/publish form|form/, "publish|form|input|textarea|select"],
    [/generic button/, "button"],
    [/generic image card|ordinary border|card border/, "card|image"],
    [/baseline component docs|neutral evidence panel/, "style|evidence|component|docs"],
  ];
  return tokens.some(([scopePattern, selectorPattern]) => scopePattern.test(text) && new RegExp(selectorPattern).test(selector));
}

function selectorTargetsBrand(selector, brand) {
  const text = String(selector || "").toLowerCase();
  const key = String(brand || "").toLowerCase();
  if (!key) return true;
  return text.includes(`theme-${key}`)
    || text.includes(`${key}-`)
    || text.includes(`-${key}`)
    || text.includes(`[data-brand="${key}"]`);
}

function scanAssetUsageMarkup(text, file) {
  const warnings = [];
  const blocking = [];
  const imageSrcs = [];
  for (const match of text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    imageSrcs.push({ src: match[1], tag: match[0], index: match.index || 0 });
  }
  const counts = {};
  for (const item of imageSrcs) counts[item.src] = (counts[item.src] || 0) + 1;
  for (const [src, count] of Object.entries(counts)) {
    const positions = imageSrcs.filter((item) => item.src === src).map((item) => item.index).sort((a, b) => a - b);
    const closeRepeats = positions.some((value, index) => {
      if (index < 2) return false;
      return value - positions[index - 2] < 1400;
    });
    if (count >= 3 && closeRepeats && /lottery|reward|slide|banner|card|picture|bg|part/i.test(src)) {
      warnings.push({
        type: "repeated-same-asset-may-be-fake-list",
        file,
        src,
        count,
        fix: "Do not repeat the same rich asset to fake a list/strip. Use one complete asset plus content copy, or collect multiple distinct examples.",
      });
    }
  }
  for (const item of imageSrcs) {
    if (/style\s*=\s*["'][^"']*(height\s*:|object-fit\s*:\s*cover|overflow\s*:\s*hidden)/i.test(item.tag)) {
      warnings.push({
        type: "inline-image-crop-needs-evidence",
        file,
        src: item.src,
        fix: "DOM/currentSrc images should preserve intrinsic ratio unless computed evidence proves crop/mask.",
      });
    }
  }
  return { blocking, warnings };
}

function inferCssAssetUsageRole(selector, body, assetRecords) {
  const text = `${selector} ${body}`.toLowerCase();
  if (/section-edge|tear|torn|撕纸|paper-edge/.test(text)) return "section-edge";
  if (/border-image|mask|frame|cloud-edge|ornate/.test(text)) return "asset-frame";
  if (/hero|kv|banner|poster/.test(text)) return "hero-kv";
  if (/stage|asset|decorative|::before|::after/.test(text)) return "decorative-layer";
  for (const record of assetRecords) {
    if (assetRecordUrls(record).some((url) => body.includes(url))) return record.role || record.roleGuess || "asset";
  }
  return "asset";
}

function normalizeAssetInventoryRecords(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.assets)) return json.assets;
  if (Array.isArray(json.inventory)) return json.inventory;
  if (Array.isArray(json.items)) return json.items;
  return [];
}

function readJsonLoose(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function tppTest() {
  const root = opt("--root", process.cwd());
  const workflow = resolveTppWorkflow();
  const mode = workflow.mode;
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl));
  const planFile = opt("--plan-file", "");
  const hostTarget = opt("--host-target", "");
  const explicitMode = opt("--mode", "").trim();

  if (!brand) fail("TPP test requires --brand or a source URL that can infer the brand key.");

  const migrationRoot = path.join(root, "migrations", brand);
  const evidenceFile = path.join(migrationRoot, "brand-evidence.json");
  const modFile = path.join(migrationRoot, "brand-mod.json");
  const adapterFile = path.join(migrationRoot, "dangoui-adapter.json");
  const actionFile = firstExistingFile([
    path.join(migrationRoot, "action-evidence-score.skills.json"),
    path.join(migrationRoot, "action-evidence-score.json"),
  ]);
  const dembrandtFile = path.join(migrationRoot, "third-party-evidence.dembrandt.json");
  const previewFile = path.join(root, "public", "brand-previews", `${brand}.json`);
  const previewRegistryFile = path.join(root, "public", "brand-previews", "registry.json");

  const evidence = readJsonLoose(evidenceFile);
  const mod = readJsonLoose(modFile);
  const adapter = readJsonLoose(adapterFile);
  const actionScore = actionFile ? readJsonLoose(actionFile) : null;
  const dembrandt = readJsonLoose(dembrandtFile);
  const workflowContract = getWorkflowContract(root, mode);
  const entryGate = {
    ok: process.env.BRAND_WORKFLOW_ENTRY === "run-brand-workflow",
    source: process.env.BRAND_WORKFLOW_ENTRY || null,
    workflowMode: process.env.BRAND_WORKFLOW_MODE || null,
  };

  const blocking = [];
  const warnings = [];
  const hasPreviewOutput = fs.existsSync(previewFile) && registryHasBrand(previewRegistryFile, brand);

  if (!entryGate.ok) {
    blocking.push(tppFailure(
      "missing-total-entry",
      "没有经过 /brand 总入口",
      "当前 TPP test 不是由 run-brand-workflow.mjs 触发的，说明这次流程可能绕过了 /brand 的统一工作流。",
      "先走 `node skills/brand/scripts/run-brand-workflow.mjs run ...`，或用 `npm run brand:learn` / `npm run brand:apply` 再进入后续检查。",
    ));
  }

  if (!evidence) {
    blocking.push(tppFailure(
      "source-evidence-required",
      "品牌证据缺失",
      "缺少 brand-evidence.json，说明我们还没有把官网视觉语言沉淀成可检查证据。",
      `先补齐 ${path.relative(root, evidenceFile)}。`,
    ));
  }

  if (!mod) {
    blocking.push(tppFailure(
      "brand-mod-required",
      "品牌包缺失",
      "缺少 brand-mod.json，说明视觉语言还没有变成可消费的结构化包。",
      `先补齐 ${path.relative(root, modFile)}。`,
    ));
  }

  if (mode === "learn-brand" && !adapter) {
    blocking.push(tppFailure(
      "dangoui-adapter-required",
      "缺少 dangoui 映射层",
      "学习网站模式下，brand-mod 还不等于可用 MOD。缺少 dangoui-adapter.json 说明视觉语言还没有真正映射到我们自己的组件语义层。",
      `先补齐 ${path.relative(root, adapterFile)}，把 token / componentVariants / slots / assets 的可消费映射写完整。`,
    ));
  }

  if (mode === "learn-brand" && !hasPreviewOutput) {
    blocking.push(tppFailure(
      "demo-preview-required",
      "缺少 demo 预览产物",
      "学习网站模式下不能只停在证据和映射层，必须产出已注册的 demo preview，才能证明这套视觉语言真的能落到 DangoUI。",
      `先生成 ${path.relative(root, previewFile)}，并把品牌注册到 ${path.relative(root, previewRegistryFile)}。`,
    ));
  }

  if (mode === "learn-brand" && !dembrandt) {
    blocking.push(tppFailure(
      "dembrandt-required",
      "缺少第三方抽取首轮结果",
      "学习网站模式下，必须先经过 dembrandt 这类抽取器拿到一版基础结构，再进入我们自己的证据归纳。",
      `先生成 ${path.relative(root, dembrandtFile)}，不要直接跳过抽取阶段。`,
    ));
  }

  if (mode === "apply-host" && !planFile && !hostTarget) {
    blocking.push(tppFailure(
      "host-target-required",
      "缺少宿主落点",
      "换肤落宿主时，必须明确要落到哪个页面或哪份计划，不然 AI 容易把学习网站和改宿主混成一条流程。",
      "传入 --host-target 或 --plan-file。",
    ));
  }

  if (explicitMode === "learn-brand" && (planFile || hostTarget)) {
    blocking.push(tppFailure(
      "mixed-workflow-inputs",
      "品牌学习流里混入了宿主换肤输入",
      "当前显式指定了 learn-brand，但同时又传入了宿主目标或计划文件。按照 /brand 的双流程约定，这说明这次其实已经进入 apply-host 语义，不能继续按纯品牌学习执行。",
      "去掉 --mode learn-brand，或移除 --host-target / --plan-file，先把当前任务归到单一流程。",
    ));
  }

  if (mod && !mod.tokens?.dtcg) {
    blocking.push(tppFailure(
      "dtcg-contract-required",
      "缺少 DTCG token 契约",
      "Brand MOD 里没有 DTCG token 层，后面就很难把抽取结果稳定映射到 demo 和宿主项目。",
      "在 brand-mod.json 里补齐 tokens.dtcg。",
    ));
  }

  const primaryHex = normalizeHex(mod?.tokens?.mapped?.["--du-primary-color"]?.value);
  const backgroundHex = normalizeHex(mod?.tokens?.mapped?.["--du-bg-2"]?.value);
  const primaryStatus = String(mod?.tokens?.mapped?.["--du-primary-color"]?.status || "");
  const categoryPalette = mod?.tokens?.styleOnly?.["--style-category-palette"]?.value || evidence?.cssEvidence?.categoryPalette || {};
  const categoryHexes = unique(Object.values(categoryPalette).map(normalizeHex).filter(Boolean));

  const dembrandtPrimaryHex = normalizeHex(dembrandt?.computedEvidence?.semanticColors?.primary?.hex);
  const actionPrimaryHex = normalizeHex(firstColorCandidate(actionScore?.candidates?.primaryActionFill));
  const actionActiveHex = normalizeHex(firstColorCandidate(actionScore?.candidates?.activeStateFill));
  const actionNeutralHex = normalizeHex(firstColorCandidate(actionScore?.candidates?.neutralActionSurface));

  if (mod && !actionScore) {
    blocking.push(tppFailure(
      "action-evidence-required",
      "缺少行动色证据",
      "Brand MOD 已经在定义主色，但没有 action evidence 采样结果，无法判断 CTA / active / neutral action 到底该怎么分工。",
      `先补齐 ${path.relative(root, path.join(migrationRoot, "action-evidence-score.skills.json"))}。`,
    ));
  }

  if (primaryHex && dembrandtPrimaryHex && primaryHex === dembrandtPrimaryHex && !actionPrimaryHex && !actionActiveHex) {
    blocking.push(tppFailure(
      "seed-primary-cannot-ship",
      "主色仍停留在 seed 层",
      "当前主色和 dembrandt 的 semantic primary 完全一致，但没有更强的 CTA / active 证据承接，说明它还只是 seed，不该直接出包。",
      "先跑 action evidence，再决定这个颜色是背景、CTA 还是强调色。",
    ));
  }

  if (primaryHex && categoryHexes.includes(primaryHex) && ![actionPrimaryHex, actionActiveHex].includes(primaryHex)) {
    blocking.push(tppFailure(
      "category-color-collapsed-to-primary",
      "分类色被误提升成主色",
      "现有证据说明分类色是语义色，不能因为它显眼就直接当成全站 primary。",
      "保留分类色语义角色，只有拿到 CTA / active 的客观证据后才能提升为主色。",
    ));
  }

  if (primaryHex && (actionPrimaryHex || actionActiveHex) && ![actionPrimaryHex, actionActiveHex].includes(primaryHex)) {
    blocking.push(tppFailure(
      "primary-not-backed-by-action-evidence",
      "主色没有被 action evidence 证明",
      `当前主色是 ${primaryHex}，但 action evidence 里真正采到的 CTA / active 颜色是 ${[actionPrimaryHex, actionActiveHex].filter(Boolean).join(" / ")}。这说明现在的主色结论还停留在猜测或人工校准层，不能继续出包。`,
      "先把主色改回真实 CTA / active 证据，或把它降级成 category / accent / background 角色，不要继续当成 dangoui primary。",
    ));
  }

  if (actionPrimaryHex && actionActiveHex && actionPrimaryHex !== actionActiveHex) {
    warnings.push(tppWarning(
      "split-action-color",
      "CTA 色和 active 色不是同一个颜色",
      `当前 action evidence 里 CTA 填充是 ${actionPrimaryHex}，active 填充是 ${actionActiveHex}。这不是坏事，但说明不能把“最显眼颜色”粗暴折叠成一个 primary。`,
      "建议拆成 primary-action 与 active-state 两个角色，再决定哪个映射到 dangoui primary。",
    ));
  }

  if (primaryStatus === "operator-calibrated" && primaryHex && !actionPrimaryHex && !actionActiveHex) {
    blocking.push(tppFailure(
      "operator-primary-without-hard-proof",
      "人工校准主色还没有硬证据",
      "当前主色标记成了 operator-calibrated，但 action evidence 里还没有真实 CTA / active 颜色来承接它，这种结论不能直接继续走 demo 或宿主应用。",
      "先补真实 action 节点的 computed style，再决定这个颜色是 CTA、active 还是仅仅是视觉强调。",
    ));
  }

  if (primaryStatus === "operator-calibrated" && primaryHex && (actionPrimaryHex || actionActiveHex) && [actionPrimaryHex, actionActiveHex].includes(primaryHex)) {
    warnings.push(tppWarning(
      "operator-primary-needs-hard-proof",
      "当前主色仍依赖人工校准",
      "现在的主色虽然已经和 action evidence 对齐，但它仍然来自 operator-calibrated 结论，后续应用到宿主项目前仍然建议补更完整的 computed style 采样链。",
      "优先补真实 CTA / submit / download / filter active 的 computed style 链路。",
    ));
  }

  const evidenceText = JSON.stringify({
    notes: evidence?.computedFirstNotes,
    quality: evidence?.qualityNotes,
    readable: evidence?.operatorReadableConclusion,
  });
  if (/hero ratio|比例/i.test(evidenceText)
    && !mod?.tokens?.styleOnly?.["--style-hero-ratio-pc"]
    && !mod?.tokens?.styleOnly?.["--style-hero-ratio-sp"]) {
    blocking.push(tppFailure(
      "hero-ratio-rule-missing",
      "Hero 比例规则缺失",
      "证据已经明确提到 hero 需要保比例，但 brand-mod 里没有把这个约束沉淀下来。",
      "在 styleOnly 或 layoutRules 中补齐 hero ratio 规则。",
    ));
  }

  if (/should stay Image\/picture slots|stay Image\/picture slots|不要转换成 background-image|do not convert/i.test(evidenceText)
    && !assetInventoryMentionsContentImage(mod)) {
    warnings.push(tppWarning(
      "content-image-role-not-persisted",
      "内容图保留原则还没结构化落盘",
      "证据已经写明内容图要继续走 Image/picture，但 Brand MOD 里还没有足够清晰的资产角色约束。",
      "在 assets / slots / layoutRules 中补齐“content image cannot become generic background”规则。",
    ));
  }

  if (backgroundHex && actionNeutralHex && backgroundHex === actionNeutralHex) {
    warnings.push(tppWarning(
      "background-equals-neutral-action",
      "页面底色和 neutral action 太接近",
      "如果页面底色直接等于 neutral action，会让 demo 的按钮、输入框、表面层看起来没分层。",
      "确认 neutral surface 是否应映射到卡片层，而不是整页底色。",
    ));
  }

  const workflowSteps = inferWorkflowStepStatus({
    mode,
    root,
    brand,
    workflowContract,
    evidence,
    mod,
    actionScore,
    dembrandt,
    hostTarget,
    planFile,
    blocking,
  });
  const missingWorkflowSteps = workflowSteps
    .filter((step) => step.required && step.status !== "complete")
    .map((step) => ({
      id: step.id,
      label: step.label,
      status: step.status,
      blocking: step.blocking,
    }));

  const acceptanceChecklist = buildTppAcceptanceChecklist({
    mode,
    entryGate,
    workflow,
    evidence,
    mod,
    adapter,
    actionScore,
    dembrandt,
    hasPreviewOutput,
    hostTarget,
    planFile,
    workflowSteps,
    blocking,
    warnings,
  });
  const workflowModeContract = buildWorkflowModeContract({
    mode,
    workflow,
    workflowContract,
    sourceUrl,
    hostTarget,
    planFile,
    evidence,
    mod,
    adapter,
    actionScore,
    dembrandt,
    hasPreviewOutput,
    blocking,
  });

  const workflowAudit = buildTppWorkflowAudit({
    mode,
    workflow,
    workflowContract,
    workflowSteps,
    blocking,
    warnings,
    missingWorkflowSteps,
  });

  const result = {
    ok: blocking.length === 0,
    brand,
    mode,
    workflow,
    entryGate,
    workflowModeContract,
    workflowContract: {
      version: workflowContract.version,
      mode,
      goal: workflowContract.goal,
      requiredStageIds: (workflowContract.steps || []).filter((step) => step.required).map((step) => step.id),
    },
    acceptanceChecklist,
    workflowAudit,
    workflowSteps,
    missingWorkflowSteps,
    files: {
      evidence: fs.existsSync(evidenceFile) ? path.relative(root, evidenceFile) : null,
      mod: fs.existsSync(modFile) ? path.relative(root, modFile) : null,
      dangouiAdapter: fs.existsSync(adapterFile) ? path.relative(root, adapterFile) : null,
      actionEvidence: actionFile ? path.relative(root, actionFile) : null,
      dembrandt: fs.existsSync(dembrandtFile) ? path.relative(root, dembrandtFile) : null,
      demoPreview: fs.existsSync(previewFile) ? path.relative(root, previewFile) : null,
      previewRegistry: fs.existsSync(previewRegistryFile) ? path.relative(root, previewRegistryFile) : null,
    },
    evidenceSummary: {
      background: backgroundHex || null,
      primary: primaryHex || null,
      dembrandtPrimary: dembrandtPrimaryHex || null,
      actionPrimary: actionPrimaryHex || null,
      actionActive: actionActiveHex || null,
      categoryPalette: categoryHexes,
    },
    blocking,
    warnings,
    next: blocking.length
      ? [
          "先修 blocking 项，再继续 /brand 后续步骤。",
          "AI 只有在 tpp-test 通过后，才算真正满足当前视觉语言原则。",
        ]
      : [
          "TPP test 已通过，可以继续走 demo 映射、preview 或宿主应用。",
        ],
  };

  ok(result);
  process.exitCode = blocking.length ? 2 : 0;
}

function buildWorkflowModeContract({
  mode,
  workflow,
  workflowContract,
  sourceUrl,
  hostTarget,
  planFile,
  evidence,
  mod,
  adapter,
  actionScore,
  dembrandt,
  hasPreviewOutput,
  blocking,
}) {
  const hasBlocking = (principle) => blocking.some((item) => item.principle === principle);
  const chain = mode === "learn-brand"
    ? [
        {
          id: "seed-extractor",
          label: "第三方抽取 seed",
          expected: "dembrandt 先给一版基础抽取，不直接当最终真相。",
          status: dembrandt ? "complete" : "missing",
          evidence: dembrandt ? "third-party-evidence.dembrandt.json" : null,
        },
        {
          id: "dtcg-layer",
          label: "DTCG 规范层",
          expected: "抽取结果先归一到 DTCG token / role，再往下游走。",
          status: mod?.tokens?.dtcg ? "complete" : "missing",
          evidence: mod?.tokens?.dtcg ? "brand-mod.tokens.dtcg" : null,
        },
        {
          id: "our-evidence",
          label: "我们自己的证据层",
          expected: "computed / asset / action evidence 必须补齐，不能只信第三方抽取。",
          status: evidence && actionScore ? "complete" : "missing",
          evidence: evidence && actionScore ? "brand-evidence + action-evidence" : null,
        },
        {
          id: "dangoui-mapping",
          label: "映射到 dangoui",
          expected: "视觉语言要翻译成 dangoui 可消费的 token / 角色 / 组件语义。",
          status: adapter ? "complete" : "missing",
          evidence: adapter ? "dangoui-adapter.json" : null,
        },
        {
          id: "demo-preview",
          label: "输出 demo 预览",
          expected: "最终必须能在 demo 里验证，不是只停在 JSON。",
          status: hasPreviewOutput ? "complete" : "missing",
          evidence: hasPreviewOutput ? "preview file + registry" : null,
        },
      ]
    : [
        {
          id: "load-mod",
          label: "加载既有 MOD",
          expected: "apply-host 先消费已有品牌包，不直接在宿主里猜颜色。",
          status: mod ? "complete" : "missing",
          evidence: mod ? "brand-mod.json" : null,
        },
        {
          id: "host-target",
          label: "明确宿主落点",
          expected: "必须知道要落在哪个宿主页面或计划里。",
          status: hostTarget || planFile ? "complete" : "missing",
          evidence: hostTarget || planFile || null,
        },
        {
          id: "host-diagnosis",
          label: "宿主诊断",
          expected: "先看路由、选择器、视觉债务，再决定怎么换肤。",
          status: hostTarget || planFile ? "complete" : "missing",
          evidence: hostTarget || planFile ? "host target / plan resolved" : null,
        },
        {
          id: "dangoui-mapping",
          label: "映射到 dangoui",
          expected: "把学习好的视觉语言翻译成宿主可消费的组件语义层。",
          status: adapter ? "complete" : "missing",
          evidence: adapter ? "dangoui-adapter.json" : null,
        },
        {
          id: "host-preview",
          label: "宿主预览验证",
          expected: "最后必须回到宿主预览，而不是停在 demo URL。",
          status: hasPreviewOutput ? "complete" : "pending",
          evidence: hasPreviewOutput ? "preview / verification artifacts" : null,
        },
      ];

  const boundaryChecks = (workflowContract?.boundaries || []).map((boundary) => {
    let status = "complete";
    let reason = "当前没有发现违反这条边界的输入。";

    if (/host business project by default/i.test(boundary) && (hostTarget || planFile)) {
      status = mode === "learn-brand" ? "blocked" : "complete";
      reason = mode === "learn-brand"
        ? "品牌学习流里出现了宿主输入，说明两条流程被混用了。"
        : "当前是宿主换肤流，这条边界不再适用。";
    } else if (/Brand key is a style identifier/i.test(boundary)) {
      status = hasBlocking("mixed-workflow-inputs") ? "warning" : "complete";
      reason = "当前只做输入层检查；真正的 route/page 污染还要继续靠后续 host 诊断脚本兜住。";
    } else if (/Third-party extraction is seed evidence only/i.test(boundary)) {
      status = hasBlocking("seed-primary-cannot-ship") ? "blocked" : "complete";
      reason = hasBlocking("seed-primary-cannot-ship")
        ? "当前主色仍停留在第三方 seed 层，没有被后续 action evidence 承接。"
        : "没有发现把第三方抽取直接当最终映射真相的硬冲突。";
    } else if (/Preserve host route, business content, and component API/i.test(boundary)) {
      status = mode === "apply-host" ? "complete" : "not-applicable";
      reason = mode === "apply-host"
        ? "宿主换肤流会继续由 host 诊断和 apply gate 检查这条边界。"
        : "当前不是宿主换肤流。";
    } else if (/Do not create a new brand route by default/i.test(boundary)) {
      status = mode === "apply-host" ? "warning" : "not-applicable";
      reason = mode === "apply-host"
        ? "当前还只能在 contract 层提示；后面要继续补 route diff 的硬校验。"
        : "当前不是宿主换肤流。";
    } else if (/Final preview URL must be the host project URL/i.test(boundary)) {
      status = mode === "apply-host" ? "warning" : "not-applicable";
      reason = mode === "apply-host"
        ? "当前会在 apply-preview 阶段继续验证预览出口。"
        : "当前不是宿主换肤流。";
    }

    return {
      boundary,
      status,
      reason,
    };
  });

  return {
    mode,
    decidedBy: workflow.decidedBy,
    summary: workflow.summary,
    goal: workflowContract?.goal || "",
    inputs: {
      sourceUrl: Boolean(sourceUrl),
      hostTarget: Boolean(hostTarget),
      planFile: Boolean(planFile),
    },
    requiredInputs: workflowContract?.inputs || {},
    chain,
    boundaryChecks,
    verdict: blocking.length === 0 ? "pass" : "blocked",
  };
}

function buildTppAcceptanceChecklist({
  mode,
  entryGate,
  workflow,
  evidence,
  mod,
  adapter,
  actionScore,
  dembrandt,
  hasPreviewOutput,
  hostTarget,
  planFile,
  workflowSteps,
  blocking,
  warnings,
}) {
  const stepById = Object.fromEntries(workflowSteps.map((step) => [step.id, step]));
  const stepState = (id) => stepById[id]?.status || "missing";
  const hasBlocking = (principle) => blocking.some((item) => item.principle === principle);
  const hasWarning = (principle) => warnings.some((item) => item.principle === principle);
  const firstFix = (principle) => {
    const item = blocking.find((entry) => entry.principle === principle)
      || warnings.find((entry) => entry.principle === principle);
    return item?.fix || null;
  };

  const checklist = [
    {
      id: "total-entry",
      label: "必须先经过 /brand 总入口",
      required: true,
      status: entryGate.ok ? "complete" : "missing",
      why: "避免 AI 直接绕过统一流程，只执行某个局部脚本。",
      evidence: entryGate.source || "missing",
      fix: entryGate.ok ? null : "统一从 run-brand-workflow.mjs 进入，再跑后续步骤。",
    },
    {
      id: "workflow-mode",
      label: mode === "learn-brand" ? "当前应是品牌学习流" : "当前应是宿主换肤流",
      required: true,
      status: hasBlocking("mixed-workflow-inputs") ? "missing" : "complete",
      why: "先把“学习品牌”和“落到宿主”分清，后面的产物和门禁才有意义。",
      evidence: workflow.summary,
      fix: firstFix("mixed-workflow-inputs"),
    },
    {
      id: "brand-evidence",
      label: "必须沉淀官网/品牌证据",
      required: true,
      status: evidence ? "complete" : "missing",
      why: "没有 brand-evidence.json，就没有后续规则判断的基础。",
      evidence: evidence ? "brand-evidence.json" : null,
      fix: firstFix("source-evidence-required"),
    },
    {
      id: "brand-mod",
      label: "必须生成结构化 MOD",
      required: true,
      status: mod ? "complete" : "missing",
      why: "只有结构化包，后续 demo 和宿主消费才可复用。",
      evidence: mod ? "brand-mod.json" : null,
      fix: firstFix("brand-mod-required"),
    },
    {
      id: "dtcg-layer",
      label: "必须带 DTCG token 契约",
      required: true,
      status: mod?.tokens?.dtcg ? "complete" : "missing",
      why: "DTCG 是抽取层和组件层之间的稳定接口。",
      evidence: mod?.tokens?.dtcg ? "tokens.dtcg present" : null,
      fix: firstFix("dtcg-contract-required"),
    },
  ];

  if (mode === "learn-brand") {
    checklist.push(
      {
        id: "dembrandt-seed",
        label: "品牌学习流必须先有 dembrandt 首轮抽取",
        required: true,
        status: dembrandt ? "complete" : "missing",
        why: "第三方抽取是 seed evidence，不是最终真相，但它是流程起点。",
        evidence: dembrandt ? "third-party-evidence.dembrandt.json" : null,
        fix: firstFix("dembrandt-required"),
      },
      {
        id: "action-evidence",
        label: "主行动色必须有 action evidence 承接",
        required: true,
        status: actionScore ? (hasBlocking("primary-not-backed-by-action-evidence") ? "missing" : "complete") : "missing",
        why: "不能靠肉眼或全站频次直接决定 CTA / active 主色。",
        evidence: actionScore ? "action-evidence-score.skills.json" : null,
        fix: firstFix("action-evidence-required")
          || firstFix("primary-not-backed-by-action-evidence")
          || firstFix("operator-primary-without-hard-proof"),
      },
      {
        id: "dangoui-adapter",
        label: "必须映射到 dangoui 语义层",
        required: true,
        status: adapter ? "complete" : "missing",
        why: "brand-mod 还不是最终可消费层，adapter 才是跟 DangoUI 对齐的那一层。",
        evidence: adapter ? "dangoui-adapter.json" : null,
        fix: firstFix("dangoui-adapter-required"),
      },
      {
        id: "demo-preview",
        label: "必须产出已注册 demo 预览",
        required: true,
        status: hasPreviewOutput ? "complete" : "missing",
        why: "品牌学习流不能只停在 token，必须证明它真的能落到 demo。",
        evidence: hasPreviewOutput ? "preview file + registry" : null,
        fix: firstFix("demo-preview-required"),
      },
    );
  } else {
    checklist.push(
      {
        id: "host-target",
        label: "宿主换肤流必须明确落点",
        required: true,
        status: hostTarget || planFile ? "complete" : "missing",
        why: "否则 AI 容易把 demo 学习和宿主改造混成一件事。",
        evidence: hostTarget || planFile || null,
        fix: firstFix("host-target-required"),
      },
      {
        id: "existing-mod",
        label: "宿主换肤前必须先加载既有 MOD",
        required: true,
        status: stepState("load-existing-mod") === "complete" ? "complete" : "missing",
        why: "apply-host 不应该跳过品牌包，直接在宿主里猜颜色。",
        evidence: stepById["load-existing-mod"]?.hint || null,
        fix: stepById["load-existing-mod"]?.hint || null,
      },
      {
        id: "host-diagnosis",
        label: "宿主换肤前必须先诊断宿主",
        required: true,
        status: stepState("diagnose-host") === "complete" ? "complete" : "missing",
        why: "要先看路由、选择器、视觉债务，再决定怎么落。",
        evidence: stepById["diagnose-host"]?.hint || null,
        fix: stepById["diagnose-host"]?.hint || null,
      },
    );
  }

  checklist.push({
    id: "tpp-gate",
    label: "TPP gate 必须在继续前通过",
    required: true,
    status: blocking.length === 0 ? (warnings.length ? "warning" : "complete") : "missing",
    why: "只要还有 blocking 项，AI 就不该继续往下跑。",
    evidence: blocking.length
      ? `${blocking.length} blocking`
      : warnings.length
        ? `${warnings.length} warnings`
        : "all clear",
    fix: blocking.length ? "先修完所有 blocking 项，再继续后续映射或预览。" : null,
  });

  return checklist;
}

function buildTppWorkflowAudit({
  mode,
  workflow,
  workflowContract,
  workflowSteps,
  blocking,
  warnings,
  missingWorkflowSteps,
}) {
  const requiredStages = (workflowContract?.steps || []).map((step) => ({
    id: step.id,
    label: step.label,
    required: Boolean(step.required),
    blocking: Boolean(step.blocking),
    status: workflowSteps.find((item) => item.id === step.id)?.status || "missing",
  }));

  return {
    expectedMode: mode,
    resolvedMode: workflow.mode,
    decidedBy: workflow.decidedBy,
    summary: workflow.summary,
    requiredStages,
    missingRequiredStages: missingWorkflowSteps,
    blockedByPrinciples: blocking.map((item) => ({
      principle: item.principle,
      title: item.title,
      fix: item.fix,
    })),
    warningPrinciples: warnings.map((item) => ({
      principle: item.principle,
      title: item.title,
      fix: item.fix,
    })),
    verdict: blocking.length === 0
      ? "workflow-pass"
      : "workflow-blocked",
  };
}

function resolveTppWorkflow() {
  const explicit = opt("--mode", "").trim();
  const hostTarget = opt("--host-target", "");
  const planFile = opt("--plan-file", "");
  const sourceUrl = opt("--source-url", "");

  if (["learn-brand", "design-host", "apply-host"].includes(explicit)) {
    return {
      mode: explicit,
      decidedBy: "explicit-mode",
      evidence: {
        sourceUrl: Boolean(sourceUrl),
        hostTarget: Boolean(hostTarget),
        planFile: Boolean(planFile),
      },
      summary: explicit === "learn-brand"
        ? "显式指定为品牌学习流。"
        : explicit === "design-host"
          ? "显式指定为宿主设计流。"
          : "显式指定为宿主实施流。",
    };
  }

  if (hostTarget || planFile) {
    return {
      mode: "design-host",
      decidedBy: "host-input",
      evidence: {
        sourceUrl: Boolean(sourceUrl),
        hostTarget: Boolean(hostTarget),
        planFile: Boolean(planFile),
      },
      summary: "检测到宿主目标或计划文件，自动归类为宿主设计流；只有冻结方向后才进入 apply-host。",
    };
  }

  return {
    mode: "learn-brand",
    decidedBy: "default-learn-brand",
    evidence: {
      sourceUrl: Boolean(sourceUrl),
      hostTarget: false,
      planFile: false,
    },
    summary: "没有宿主目标输入，默认按品牌学习流执行。",
  };
}

function printWorkflowContractCommand() {
  const root = opt("--root", process.cwd());
  const workflow = resolveTppWorkflow();
  const contract = getWorkflowContract(root, workflow.mode);
  ok({
    command: "/brand",
    mode: workflow.mode,
    workflow,
    workflowContract: contract,
  });
}

function getWorkflowContract(root, mode) {
  const contractFile = workflowContractFile(root);
  const contract = readJsonLoose(contractFile);
  if (!contract?.workflows?.[mode]) {
    fail(`Workflow contract missing for mode "${mode}": ${contractFile}`);
  }
  return {
    version: contract.version || null,
    mode,
    orchestration: contract.orchestration || {},
    externalGoodcaseAdoption: contract.externalGoodcaseAdoption || {},
    roles: contract.roles || {},
    handoffArtifacts: contract.handoffArtifacts || {},
    artifactContracts: contract.artifactContracts || {},
    goal: contract.workflows[mode].goal || "",
    inputs: contract.workflows[mode].inputs || {},
    steps: toArray(contract.workflows[mode].steps),
    outputs: toArray(contract.workflows[mode].outputs),
    boundaries: toArray(contract.workflows[mode].boundaries),
  };
}

function inferWorkflowStepStatus({
  mode,
  root,
  brand,
  workflowContract,
  evidence,
  mod,
  actionScore,
  dembrandt,
  hostTarget,
  planFile,
  blocking,
}) {
  const hasMappedTokens = Boolean(mod?.tokens?.mapped && Object.keys(mod.tokens.mapped).length);
  const hasDtcg = Boolean(mod?.tokens?.dtcg);
  const hasAdapter = Boolean(brand && fs.existsSync(path.join(root, "migrations", brand, "dangoui-adapter.json")));
  const hasEvidence = Boolean(evidence);
  const hasActionEvidence = Boolean(actionScore);
  const hasDembrandt = Boolean(dembrandt);
  const hasHostIntent = Boolean(hostTarget || planFile);
  const hasBlocking = blocking.length > 0;
  const hasPreviewFile = Boolean(brand && fs.existsSync(path.join(root, "public", "brand-previews", `${brand}.json`)));
  const hasPreviewRegistry = Boolean(brand && registryHasBrand(path.join(root, "public", "brand-previews", "registry.json"), brand));
  const hasPreviewGate = Boolean(brand && fs.existsSync(path.join(root, "migrations", brand, "preview-gate.json")));
  const hasComputedEvidence = Boolean(brand && fs.existsSync(path.join(root, "migrations", brand, "computed-evidence.json")));
  const hasVisualQuality = Boolean(brand && fs.existsSync(path.join(root, "migrations", brand, "visual-quality-report.json")));
  const fidelityReport = brand
    ? readJsonLoose(path.join(root, "migrations", brand, "fidelity-report.json"))
    : null;
  const fidelityPassed = fidelityReport?.status === "fidelity-pass";
  const fidelityFailed = Boolean(fidelityReport) && !fidelityPassed;
  const hasBrandIntent = Boolean(brand && fs.existsSync(path.join(root, "migrations", brand, "brand-intent.json")));
  const hasHostOpportunity = Boolean(brand && (
    fs.existsSync(path.join(root, "migrations", brand, "host-opportunity-map.json"))
    || fs.existsSync(path.join(root, "migrations", brand, "intent-plan.json"))
  ));
  const hasVisualQaArtifact = Boolean(brand && (
    fs.existsSync(path.join(root, "migrations", brand, "visual-qa-report.json"))
    || hasVisualQuality
  ));
  const hasVisualQa = hasVisualQaArtifact && fidelityPassed;
  const hasPreviewOutput = hasPreviewFile && hasPreviewRegistry;
  const hasApplyVerification = hasPreviewGate || hasComputedEvidence || hasVisualQuality;

  const statusByStep = {
    "route-intake": "complete",
    "extract-third-party": hasDembrandt ? "complete" : "pending",
    "normalize-dtcg": hasDtcg ? "complete" : "pending",
    "collect-brand-evidence": hasEvidence && hasActionEvidence ? "complete" : "pending",
    "translate-brand-intent": hasBrandIntent ? "complete" : "pending",
    "tpp-test": hasBlocking || fidelityFailed ? "blocked" : fidelityPassed ? "complete" : "pending",
    "map-to-dangoui": hasAdapter ? "complete" : "pending",
    "emit-demo-preview": hasPreviewOutput ? "complete" : "pending",
    "visual-qa": hasVisualQa ? "complete" : fidelityFailed ? "blocked" : "pending",
    "record-retro": "pending",
    "load-existing-mod": hasDembrandt || hasEvidence || hasBrandIntent || Boolean(mod) ? "complete" : "pending",
    "diagnose-host": hasHostIntent ? "complete" : "pending",
    "assess-host-visual-capacity": hasHostOpportunity ? "complete" : "pending",
    "apply-preview": hasPreviewOutput && hasApplyVerification ? "complete" : "pending",
  };

  return workflowContract.steps.map((step) => {
    const status = statusByStep[step.id] || "pending";
    const hints = [];
    if (mode === "learn-brand" && step.id === "collect-brand-evidence" && !hasActionEvidence) {
      hints.push("还缺 action evidence，暂时不能确认 CTA / active / neutral action 角色。");
    }
    if (mode === "apply-host" && step.id === "diagnose-host" && !hasHostIntent) {
      hints.push("需要明确宿主页面或计划文件，才能证明这次真的是换肤落宿主。");
    }
    if (step.id === "map-to-dangoui" && !hasAdapter) {
      hints.push("还没有形成可消费的 dangoui 映射层。");
    }
    if (step.id === "translate-brand-intent" && !hasBrandIntent) {
      hints.push("还缺 brand-intent.json，说明 evidence 还没有被翻译成适用场景、禁用场景和动效目的。");
    }
    if (step.id === "assess-host-visual-capacity" && !hasHostOpportunity) {
      hints.push("还缺 host-opportunity-map.json 或 intent-plan.json，不能证明强视觉落点符合业务目标。");
    }
    if (step.id === "visual-qa" && !hasVisualQa) {
      hints.push(fidelityFailed
        ? "盲审 fidelity gate 已失败；必须按 rework-request 重做并由新的 QA subagent 复审。"
        : "还缺独立盲审与 fidelity-report.json，不能只用 build/preview 代替设计验收。");
    }
    if (step.id === "emit-demo-preview" || step.id === "apply-preview") {
      if (status === "complete") {
        hints.push("已经找到了真实 preview / verification 产物，不再是纯规则放行。");
      } else {
        hints.push("只有前面的 blocking gate 通过后，这一步才应该继续。");
      }
    }
    return {
      id: step.id,
      label: step.label,
      required: Boolean(step.required),
      blocking: Boolean(step.blocking),
      status,
      hints,
    };
  });
}

function firstExistingFile(files) {
  return files.find((file) => fs.existsSync(file)) || "";
}

function normalizeHex(value) {
  const rgb = parseColor(value);
  return rgb ? rgbToHex(rgb) : "";
}

function firstColorCandidate(values) {
  const first = toArray(values)[0];
  if (!first) return "";
  return first.hex || first.value || "";
}

function assetInventoryMentionsContentImage(mod) {
  const text = JSON.stringify({
    assets: mod?.assets,
    slots: mod?.slots,
    layoutRules: mod?.layoutRules,
    platformOverrides: mod?.platformOverrides,
  });
  return /content image|image slot|picture slot|image\/currentsrc|object-fit|content-image|image-role/i.test(text);
}

function tppFailure(principle, title, message, fix) {
  return {
    principle,
    title,
    message,
    fix,
  };
}

function tppWarning(principle, title, message, fix) {
  return {
    principle,
    title,
    message,
    fix,
  };
}

function validateRoleReplacements() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const fileOpt = opt("--files", "");
  const cssFileOpt = opt("--css-files", "");
  const jsonFiles = fileOpt
    ? parseList(fileOpt).map((item) => path.resolve(root, item))
    : collectRoleReplacementJsonFiles(root, brand);
  const cssFiles = cssFileOpt
    ? parseList(cssFileOpt).map((item) => path.resolve(root, item))
    : collectRoleReplacementCssFiles(root, brand);
  const blocking = [];
  const warnings = [];
  const checked = [];

  for (const file of jsonFiles) {
    const text = safeRead(file);
    if (!text) continue;
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      warnings.push({
        type: "invalid-json-skipped",
        file: path.relative(root, file),
        message: "File was selected for role replacement validation but is not valid JSON.",
      });
      continue;
    }
    checked.push(path.relative(root, file));
    walkRoleObjects(json, (object, pointer) => {
      const record = classifyReplacementRecord(object);
      if (!record) return;
      const base = {
        file: path.relative(root, file),
        pointer,
        selector: object.selector || object.targetSelector || object.targetScope || "",
        property: object.property || object.prop || object.cssProperty || "",
        computedValue: object.computedValue || object.value || "",
      };
      if (!record.role) {
        blocking.push({
          type: "missing-ui-role",
          ...base,
          message: "Replacement records must declare UI role before mapping to dangoui token or style recipe.",
        });
      }
      if (!record.replacement) {
        blocking.push({
          type: "missing-replacement-target",
          ...base,
          role: record.role,
          message: "Replacement records must declare the target token / style recipe / semantic token.",
        });
      }
      if (!record.antiScopes.length) {
        blocking.push({
          type: "missing-anti-scopes",
          ...base,
          role: record.role,
          replacement: record.replacement,
          message: "Replacement records must declare antiScopes so control/content/doc roles do not leak into each other.",
        });
      }
      const leak = detectRoleLeak(record);
      if (leak) {
        blocking.push({
          type: leak.type,
          ...base,
          role: record.role,
          replacement: record.replacement,
          antiScopes: record.antiScopes,
          message: leak.message,
        });
      }
    });
  }

  for (const file of cssFiles) {
    const text = safeRead(file);
    if (!text) continue;
    checked.push(path.relative(root, file));
    const cssFindings = scanCssRoleReplacementLeaks(text, path.relative(root, file));
    blocking.push(...cssFindings.blocking);
    warnings.push(...cssFindings.warnings);
  }

  const result = {
    ok: blocking.length === 0,
    brand,
    checked: unique(checked),
    blocking,
    warnings,
    message: blocking.length
      ? "Role replacement guard failed. Add computed value -> source -> UI role -> replacement target -> antiScopes, or narrow CSS selectors before applying style."
      : "Role replacement guard passed. Replacement records and obvious CSS role leaks look safe.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 2);
}

function resolveDemo() {
  const root = opt("--root", process.cwd());
  const config = readBrandSkillConfig();
  const demoRoot = opt("--demo-root", config.demoRoot || process.env.BRAND_DEMO_ROOT || "");
  const demoUrl = opt("--demo-url", config.demoUrl || process.env.BRAND_DEMO_URL || "");
  const registryUrl = opt("--registry-url", config.registryUrl || process.env.BRAND_REGISTRY_URL || "");
  const localDemoOk = Boolean(demoRoot && fs.existsSync(path.resolve(root, demoRoot)) || demoRoot && fs.existsSync(demoRoot));
  const resolvedDemoRoot = demoRoot
    ? path.resolve(root, demoRoot)
    : "";
  ok({
    ok: Boolean(localDemoOk || demoUrl || registryUrl),
    source: localDemoOk ? "local-demo-root" : demoUrl ? "online-demo-url" : registryUrl ? "registry-url" : "missing",
    demoRoot: localDemoOk ? resolvedDemoRoot : "",
    demoUrl,
    registryUrl,
    configPath: brandSkillConfigPath(),
    message: localDemoOk
      ? "Use the local standard demo root for style capability preview."
      : demoUrl || registryUrl
        ? "Use the configured online demo/registry for standard demo preview. Do not create business preview routes unless explicitly allowed."
        : "No standard demo root/url is configured. Generate a temporary style-pack draft and mark business preview as non-standard unless the user explicitly allows project experiment.",
  });
}

function draftStylePack() {
  const root = opt("--root", process.cwd());
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl) || "brand");
  const outPath = opt("--out", path.join(root, "migrations", brand, "style-pack-draft.json"));
  const source = parseSource(sourceUrl);
  const data = {
    schema: "brand-style-pack-draft/v1",
    brand,
    sourceUrl,
    sourceHost: source.host,
    createdAt: new Date().toISOString(),
    status: "draft-not-standard-demo",
    demoGate: {
      passed: false,
      reason: "No maintained style pack or standard demo preview has been generated yet.",
    },
    requiredStandardDemo: {
      shell: "standard inspector shell",
      navigation: "brand/style/components/pages",
      preview: "phone mockup",
      pages: ["home", "news-or-feed", "media-or-archive", "publish"],
      dimensions: ["color", "font", "radius", "border", "shadow", "frame-or-asset", "active-state"],
    },
    notes: [
      "This draft can be used to collect evidence, but it is not a standard demo preview.",
      "Business project preview routes are allowed only when the user explicitly asks to experiment inside that project.",
    ],
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
  ok({
    ok: true,
    out: path.relative(root, outPath),
    brand,
    status: data.status,
    message: "Temporary style pack draft written. It does not pass demo-gate until standard demo/registry preview exists.",
  });
}

function registerDemoPreview() {
  const root = opt("--root", process.cwd());
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl) || "brand");
  const label = opt("--label", displayLabelFromBrand(brand));
  const force = has("--force");
  const styleReference = opt("--style-reference", "golden");
  const registryPath = path.join(root, "public", "brand-previews", "registry.json");
  const previewPath = path.join(root, "public", "brand-previews", `${brand}.json`);
  const migrationDir = path.join(root, "migrations", brand);
  const migrationDraftPath = path.join(migrationDir, "style-pack-draft.json");

  if (!sourceUrl) fail("--source-url is required");
  if (!force && (fs.existsSync(previewPath) || fs.existsSync(migrationDir))) {
    ok({
      ok: false,
      exists: true,
      brand,
      preview: path.relative(root, previewPath),
      migration: path.relative(root, migrationDir),
      message: `Brand "${brand}" already exists. Do not generate duplicates; inspect the existing preview or re-run with --force after confirming replacement.`,
    });
    process.exit(2);
  }

  const source = parseSource(sourceUrl);
  const preview = createStandardDemoPreview({ brand, label, sourceUrl, sourceHost: source.host, styleReference });
  const draft = {
    schema: "brand-style-pack-draft/v1",
    brand,
    label,
    sourceUrl,
    sourceHost: source.host,
    createdAt: preview.createdAt,
    status: "standard-demo-preview-draft",
    demoGate: {
      passed: true,
      reason: "Registered into the maintained demo preview data. Human review is still required before promoting to a maintained style pack.",
    },
    standardDemoPreview: {
      brand,
      registry: path.relative(root, registryPath),
      preview: path.relative(root, previewPath),
      route: `/#/brand/${brand}/pages/${brand}-home`,
      shell: "reference/style/components/pages inspector + phone mockup",
    },
    coverage: preview.coverage,
    componentCoverage: preview.componentCoverage,
    promoteWhenReady: [
      "Replace placeholder tokens with sampled evidence.",
      "Replace generic style recipe rows with verified brand values.",
      "Add asset evidence and computed diff before business apply.",
    ],
  };

  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.mkdirSync(migrationDir, { recursive: true });
  fs.writeFileSync(previewPath, `${JSON.stringify(preview, null, 2)}\n`);
  fs.writeFileSync(migrationDraftPath, `${JSON.stringify(draft, null, 2)}\n`);
  upsertDemoRegistry(registryPath, {
    id: brand,
    displayName: label,
    path: `/brand-previews/${brand}.json`,
    migrationRoot: `migrations/${brand}`,
    demoPurpose: preview.demoPurpose,
    status: preview.status,
    standardDemo: preview.standardDemo,
    businessApply: preview.businessApply,
    sourceUrl,
    sourceHost: source.host,
  });

  ok({
    ok: true,
    brand,
    label,
    preview: path.relative(root, previewPath),
    registry: path.relative(root, registryPath),
    migration: path.relative(root, migrationDraftPath),
    route: `/#/brand/${brand}/pages/${brand}-home`,
    message: "Standard demo preview registered locally. This is a demo-gate preview, not a business-project preview route.",
  });
}

function demoGate() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const demoRoot = opt("--demo-root", "");
  const url = opt("--url", "");
  const htmlFile = opt("--html", "");
  const stylePack = opt("--style-pack", brand ? path.join(root, "migrations", brand, "style-pack-draft.json") : "");
  const checks = [];

  if (demoRoot) {
    const full = path.resolve(root, demoRoot);
    checks.push({ name: "demo-root-exists", ok: fs.existsSync(full), detail: full });
    checks.push({ name: "standard-demo-source", ok: fs.existsSync(path.join(full, "src")) && fs.existsSync(path.join(full, "migrations")), detail: "local demo root should look like the maintained demo project" });
    if (brand) {
      checks.push({ name: "brand-migration", ok: fs.existsSync(path.join(full, "migrations", brand)), detail: `migrations/${brand}` });
      const localPreviewPath = path.join(full, "public", "brand-previews", `${brand}.json`);
      const localRegistryPath = path.join(full, "public", "brand-previews", "registry.json");
      const localPreview = fs.existsSync(localPreviewPath) ? JSON.parse(safeRead(localPreviewPath) || "{}") : {};
      checks.push({ name: "standard-demo-preview", ok: fs.existsSync(localPreviewPath), detail: path.relative(full, localPreviewPath) });
      checks.push({ name: "standard-demo-registry", ok: registryHasBrand(localRegistryPath, brand), detail: path.relative(full, localRegistryPath) });
      checks.push({ name: "style-components-pages-data", ok: hasPreviewShellData(localPreview), detail: "preset + styleRecipeDetails + pages + componentCoverage" });
    }
  } else if (url) {
    checks.push({ name: "demo-url", ok: /^https?:\/\//.test(url), detail: url });
  } else {
    checks.push({ name: "standard-demo-target", ok: false, detail: "No demo root or online demo URL provided." });
  }

  if (htmlFile) {
    const htmlPath = path.resolve(root, htmlFile);
    const html = safeRead(htmlPath);
    checks.push({ name: "inspector-tabs", ok: /(style|风格)[\s\S]{0,80}(components|组件)[\s\S]{0,80}(pages|页面)|brand\/[^/]+\/style|brand\/[^/]+\/components|brand\/[^/]+\/pages/i.test(html), detail: htmlFile });
    checks.push({ name: "phone-mockup", ok: /phone-screen|mock-statusbar|mock-home-indicator|phone mockup/i.test(html), detail: htmlFile });
    checks.push({ name: "page-template-list", ok: /page template|页面模板|首页|资讯|影像|发布/i.test(html), detail: htmlFile });
  }

  if (stylePack && fs.existsSync(stylePack)) {
    const draft = JSON.parse(safeRead(stylePack) || "{}");
    checks.push({ name: "style-pack-status", ok: draft.status !== "draft-not-standard-demo", detail: draft.status || "unknown" });
  }

  const failed = checks.filter((check) => !check.ok);
  ok({
    ok: failed.length === 0,
    brand,
    checks,
    failed,
    message: failed.length
      ? "Standard demo gate failed. Do not claim complete migration; do not apply to business project unless user explicitly allows project experiment."
      : "Standard demo gate passed. It is safe to use this as style capability preview before business apply.",
  });
  process.exit(failed.length ? 2 : 0);
}

function verifyDom() {
  const root = opt("--root", process.cwd());
  const htmlFile = opt("--html", "");
  const selector = opt("--selector", "");
  const brand = opt("--brand", "");
  if (!htmlFile) fail("--html is required. Save browser DOM/HTML snapshot and pass it here.");
  const htmlPath = path.resolve(root, htmlFile);
  const html = fs.readFileSync(htmlPath, "utf8");
  const selectors = selector
    ? [selector]
    : brand
      ? [`.theme-${brand}`, `.taro_page.theme-${brand}`, `.taro_page .theme-${brand}`, `[class*="theme-${brand}"]`]
      : [];
  if (!selectors.length) fail("--selector or --brand is required");

  const results = selectors.map((item) => ({
    selector: item,
    likelyMatched: likelySelectorInHtml(html, item),
  }));
  const okResult = results.some((item) => item.likelyMatched);
  ok({
    ok: okResult,
    html: path.relative(root, htmlPath),
    results,
    message: okResult
      ? "At least one selector appears in the rendered DOM snapshot."
      : "No selector appears in the rendered DOM snapshot. For Taro H5, target .taro_page/taro-view-core wrappers or the actual rendered class.",
  });
  process.exit(okResult ? 0 : 2);
}

function parseDevServer() {
  const logPath = opt("--log", "-");
  const fallbackHost = opt("--fallback-host", "127.0.0.1");
  const text = logPath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(logPath, "utf8");
  const urls = [...text.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[a-zA-Z0-9.-]+):\d+\/?[^\s]*/g)].map((m) => m[0]);
  const lastUrl = urls.at(-1) || "";
  const parsed = lastUrl ? new URL(lastUrl) : null;
  const dnsBlocked = /ENOTFOUND|EAI_AGAIN|getaddrinfo|Could not resolve|Name or service not known|local\.qiandao\.com/i.test(text);
  const portConflict = /Port \d+ is in use|trying another|already in use/i.test(text);
  const port = parsed?.port || "";
  const host = parsed?.hostname || "";
  const actualUrl = parsed ? `http://${host === "0.0.0.0" ? fallbackHost : host}:${port}${parsed.pathname || "/"}` : "";

  ok({
    actualUrl,
    host,
    port,
    dnsBlocked,
    portConflict,
    fallbackCommand: dnsBlocked ? `npm run dev -- --host 0.0.0.0` : "",
    message: actualUrl ? "Use actualUrl in final output." : "No local dev URL detected; keep polling server output.",
  });
}

function validateFinal() {
  const file = opt("--file", "");
  const brandLabel = opt("--brand-label", "");
  const sourceUrl = opt("--source-url", "");
  const coverageLevel = opt("--coverage-level", "");
  const text = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  const urls = [...text.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+\/?[^\s，。)）]*/gi)].map((match) => match[0]);
  const urlOk = urls.length > 0;
  const sourceDemo = parseDemoBrandUrl(sourceUrl);
  const brandKey = opt("--brand", sourceDemo?.brand || inferBrandKey(sourceUrl) || brandLabel);
  const outputUsesSourceDemoPath = sourceDemo && urls.some((url) => {
    const demo = parseDemoBrandUrl(url);
    return demo && demo.brand === sourceDemo.brand && demo.pageId === sourceDemo.pageId;
  });
  const outputMentionsNewBrandRoute = brandKey
    ? new RegExp(`(新建|保留|新增|创建|留下).{0,24}(/#?/?${escapeRegExp(brandKey)}\\b|/${escapeRegExp(brandKey)}\\b|${capitalize(brandKey)}[A-Za-z]*(Page|View|Route|Component)|preview route|预览路由|预览页)`, "i").test(text)
    : false;
  const styleOk = brandLabel
    ? text.includes(brandLabel)
    : /风格方向|这次换成|风格是|感觉|风格/i.test(text);
  const defaultEntryOk = /默认入口|默认首页|首屏|TabBar/i.test(text);
  const overClaimsComplete = /完整(?:套用|迁移|应用|还原)|全面(?:套用|迁移|应用|还原)|已(?:完整|全面).{0,8}(?:套用|迁移|应用|还原)/i.test(text);
  const coverageOk = !coverageLevel
    || !/(color-layer|conservative|insufficient)/i.test(coverageLevel)
    || (!overClaimsComplete && text.includes(coverageLevel));
  const checks = [
    { name: "business preview URL", ok: urlOk, severity: "hard" },
    { name: "not source demo URL", ok: !outputUsesSourceDemoPath, severity: "hard" },
    { name: "no unrequested brand preview route", ok: !outputMentionsNewBrandRoute, severity: "hard" },
    { name: brandLabel ? `style label: ${brandLabel}` : "style direction", ok: styleOk, severity: "fix-output" },
    { name: "default entry verification", ok: defaultEntryOk, severity: "fix-output" },
    { name: coverageLevel ? `coverage wording: ${coverageLevel}` : "coverage wording", ok: coverageOk, severity: "fix-output" },
  ];
  const missing = checks.filter((item) => !item.ok).map((item) => item.name);
  const hardMissing = checks.filter((item) => !item.ok && item.severity === "hard").map((item) => item.name);
  const result = {
    ok: missing.length === 0,
    canShowPreviewUrl: urlOk,
    missing,
    hardMissing,
    fixOutputMissing: checks.filter((item) => !item.ok && item.severity === "fix-output").map((item) => item.name),
    urls,
    coverageLevel,
    message: urlOk
      ? "Preview URL is present. Fix missing output fields before final answer; do not hide the URL from the user."
      : "Business preview URL is missing; keep running/inspecting the host project before final answer.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : hardMissing.length ? 2 : 3);
}

function recordRun() {
  const root = opt("--root", process.cwd());
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl) || "brand");
  const status = opt("--status", "completed");
  const coverageLevel = opt("--coverage-level", "");
  const targetRoute = opt("--target-route", "");
  const previewUrl = opt("--preview-url", "");
  const defaultUrl = opt("--default-url", "");
  const stylePack = parseBool(opt("--style-pack", ""));
  const generatedPreview = parseBool(opt("--generated-preview", ""));
  const missingDimensions = parseList(opt("--missing", ""));
  const runId = `${new Date().toISOString()}-${crypto.randomBytes(4).toString("hex")}`;
  const source = parseSource(sourceUrl);
  const project = {
    name: path.basename(root),
    hash: hashText(path.resolve(root)).slice(0, 12),
  };
  const detailed = {
    runId,
    createdAt: new Date().toISOString(),
    sourceUrl,
    sourceHost: source.host,
    brand,
    status,
    coverageLevel,
    missingDimensions,
    targetRoute,
    previewUrl,
    defaultUrl,
    stylePack,
    generatedPreview,
    project,
  };
  const projectLog = path.join(root, "migrations", "_brand-runs", "runs.jsonl");
  appendJsonl(projectLog, detailed);

  let globalLog = "";
  if (!has("--no-global")) {
    globalLog = opt("--global-log", path.join(homeDir(), ".codex", "brand-skill", "runs.jsonl"));
    appendJsonl(globalLog, {
      runId,
      createdAt: detailed.createdAt,
      sourceHost: source.host,
      sourceProtocol: source.protocol,
      brand,
      status,
      coverageLevel,
      missingDimensions,
      stylePack,
      generatedPreview,
      projectName: project.name,
      projectHash: project.hash,
    });
  }

  ok({
    ok: true,
    runId,
    projectLog,
    globalLog,
    privacy: "Project log keeps full URL and route. Global log keeps source host, project basename/hash, coverage and missing dimensions only.",
  });
}

function tombstoneRun() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const runId = opt("--run-id", "");
  const disposition = opt("--disposition", "retired");
  const reason = opt("--reason", "").trim();
  const scope = opt("--scope", "project");
  if (!brand && !runId) fail("tombstone-run requires --brand or --run-id.");
  if (!["retired", "invalidated", "superseded"].includes(disposition)) fail("--disposition must be retired, invalidated, or superseded.");
  if (!reason) fail("tombstone-run requires a non-empty --reason audit note.");
  if (!["project", "global", "all"].includes(scope)) fail("--scope must be project, global, or all.");
  const projectLog = opt("--project-log", path.join(root, "migrations", "_brand-runs", "runs.jsonl"));
  const globalLog = opt("--global-log", path.join(homeDir(), ".codex", "brand-skill", "runs.jsonl"));
  const event = { recordType: "run-tombstone", tombstoneId: `${new Date().toISOString()}-${crypto.randomBytes(4).toString("hex")}`, createdAt: new Date().toISOString(), disposition, brand, runId, reason };
  const files = scope === "project" ? [projectLog] : scope === "global" ? [globalLog] : [projectLog, globalLog];
  for (const file of files) appendJsonl(file, event);
  ok({ ok: true, event, files, message: "Run history was retained; matching runs are excluded from active summaries and issue retro." });
}

function p0Acceptance() {
  const root = opt("--root", process.cwd());
  const mode = opt("--mode", "apply-host");
  const brand = opt("--brand", inferBrandKey(opt("--source-url", "")));
  const sourceUrl = opt("--source-url", "");
  const hostTarget = opt("--host-target", "");
  const planFileOpt = opt("--plan-file", "");
  const previewUrl = opt("--preview-url", "");
  const fileOpt = opt("--files", "");
  const allowDemoSource = has("--allow-demo-source");
  const requireDevPreview = has("--require-dev-preview");

  if (!brand) fail("p0-acceptance requires --brand or a source URL that can infer the brand key.");
  if (!["learn-brand", "apply-host"].includes(mode)) fail("--mode must be learn-brand or apply-host.");

  const migrationRoot = path.join(root, "migrations", brand);
  const hostMigrationRoot = findHostMigrationRoot(root, brand, planFileOpt, hostTarget);
  const planFile = firstExistingFile([
    planFileOpt ? path.resolve(root, planFileOpt) : "",
    hostMigrationRoot ? path.join(hostMigrationRoot, "intent-plan.json") : "",
    path.join(migrationRoot, "intent-plan.json"),
  ].filter(Boolean));
  const plan = readJsonLoose(planFile);
  const runLog = firstExistingFile([
    hostMigrationRoot ? path.join(path.dirname(hostMigrationRoot), "_brand-runs", "runs.jsonl") : "",
    path.join(root, "migrations", "_brand-runs", "runs.jsonl"),
  ].filter(Boolean));
  const latestRun = readLatestRunForBrand(runLog, brand);
  const sourceRole = String(plan?.sourceRole || latestRun?.sourceRole || "");
  const effectiveSourceUrl = sourceUrl || plan?.sourceUrl || latestRun?.sourceUrl || "";
  const effectivePreviewUrl = previewUrl || latestRun?.previewUrl || plan?.previewUrl || "";
  const hostFiles = resolveAcceptanceFiles({ root, plan, planFile, fileOpt, hostTarget });
  const existingModFile = firstExistingFile([
    path.join(migrationRoot, "brand-mod.json"),
    hostMigrationRoot ? path.join(hostMigrationRoot, "brand-mod.json") : "",
  ].filter(Boolean));
  const existingAdapterFile = firstExistingFile([
    path.join(migrationRoot, "dangoui-adapter.json"),
    hostMigrationRoot ? path.join(hostMigrationRoot, "dangoui-adapter.json") : "",
  ].filter(Boolean));
  const existingEvidenceFile = firstExistingFile([
    path.join(migrationRoot, "brand-evidence.json"),
    hostMigrationRoot ? path.join(hostMigrationRoot, "brand-evidence.json") : "",
  ].filter(Boolean));
  const standardPreviewFile = path.join(root, "public", "brand-previews", `${brand}.json`);
  const registryFile = path.join(root, "public", "brand-previews", "registry.json");

  const blocking = [];
  const warnings = [];
  const checks = [];
  const addCheck = (id, status, message, fix = "") => {
    checks.push({ id, status, message, fix });
    if (status === "fail") blocking.push({ id, message, fix });
    if (status === "partial") warnings.push({ id, message, fix });
  };

  if (mode === "learn-brand") {
    addCheck(
      "standard-learning-artifacts",
      existingModFile && existingAdapterFile && existingEvidenceFile && fs.existsSync(standardPreviewFile) && registryHasBrand(registryFile, brand)
        ? "pass"
        : "fail",
      "品牌学习必须产出 brand-mod、evidence、dangoui adapter 和已注册 demo preview。",
      `补齐 ${path.relative(root, migrationRoot)} 下的标准学习产物，并注册 public/brand-previews/${brand}.json。`,
    );
  } else {
    addCheck(
      "existing-mod-consumed",
      existingModFile || existingEvidenceFile ? "pass" : "fail",
      "宿主换肤必须先消费既有 MOD / style pack / evidence，不能直接在宿主项目里猜样式。",
      "先从标准 demo/registry 或 migrations/{brand} 加载品牌包，再 apply-host。",
    );
    addCheck(
      "host-target-declared",
      hostTarget || plan?.targetRoute || plan?.targetFiles?.length ? "pass" : "fail",
      "宿主换肤必须有明确宿主页面或计划文件。",
      "在 intent-plan.json 里声明 targetRoute/targetFiles，或传 --host-target。",
    );
    addCheck(
      "host-files-exist",
      hostFiles.length && hostFiles.every((file) => fs.existsSync(file)) ? "pass" : "fail",
      "宿主目标文件必须真实存在，P0 不能只生成报告文本。",
      "检查 --files、--host-target 或 intent-plan.targetFiles。",
    );
    addCheck(
      "demo-source-not-final",
      sourceRole === "demo-style-source" || parseDemoBrandUrl(effectiveSourceUrl)
        ? allowDemoSource ? "partial" : "fail"
        : "pass",
      "P0 端到端不能把 demo 页面当最终来源；demo 只能用于定位既有 style pack，不能证明官网学习链路。",
      "改为记录原始官网 sourceUrl，或传入 --style-pack/--mod-file 并把 demo URL 仅作为 lookup 线索。",
    );
    addCheck(
      "host-preview-url",
      effectivePreviewUrl && !parseDemoBrandUrl(effectivePreviewUrl) ? "pass" : "fail",
      "宿主换肤的最终预览必须是宿主项目地址，不是标准 demo 地址。",
      "生成并验证宿主项目自己的 previewUrl/defaultUrl。",
    );
    addCheck(
      "preview-tier-truthful",
      classifyPreviewUrl(effectivePreviewUrl) === "dev-server" || !requireDevPreview
        ? classifyPreviewUrl(effectivePreviewUrl) === "static-file" ? "partial" : "pass"
        : "fail",
      "只有静态 HTML 时不能宣称完整 dev/build 验收。",
      "正式跑通宿主 dev/build，或把覆盖等级降为 static-host-preview / conservative-application。",
    );
  }

  const coverage = scoreAcceptanceCoverage(root, brand, hostFiles, existingEvidenceFile);
  addCheck(
    "style-dimensions-covered",
    coverage.covered.length >= 6 ? "pass" : coverage.covered.length >= 4 ? "partial" : "fail",
    `视觉维度覆盖 ${coverage.covered.length}/7：${coverage.covered.join(", ") || "none"}。`,
    "至少覆盖 color、font、radius、border、shadow、frame-or-asset、active-state，并补真实 DOM 验证。",
  );

  const assetWarnings = findAcceptanceAssetWarnings(root, brand, hostFiles);
  if (assetWarnings.length) {
    addCheck(
      "asset-role-usage",
      "partial",
      `发现 ${assetWarnings.length} 个资产/装饰层使用风险，不能直接宣称 complete。`,
      "把装饰层限制到有 evidence targetScope 的 section/selector，或降级覆盖等级。",
    );
  } else {
    addCheck("asset-role-usage", "pass", "没有发现明显的资产/装饰层误挂风险。");
  }

  const latestCoverage = String(latestRun?.coverageLevel || "");
  if (/complete-style-preview/i.test(latestCoverage)) {
    const completeIsOverstated = checks.some((check) => check.status !== "pass")
      || classifyPreviewUrl(effectivePreviewUrl) !== "dev-server";
    addCheck(
      "coverage-claim-truthful",
      completeIsOverstated ? "partial" : "pass",
      completeIsOverstated
        ? `最新 run log 声称 ${latestCoverage}，但当前验收仍有 partial/fail 项。`
        : `最新 run log 的 ${latestCoverage} 与当前验收一致。`,
      "record-run 前先运行 p0-acceptance，并用 acceptance verdict 决定 coverageLevel。",
    );
  }

  const failCount = checks.filter((check) => check.status === "fail").length;
  const partialCount = checks.filter((check) => check.status === "partial").length;
  const verdict = failCount ? "FAIL" : partialCount ? "PARTIAL" : "PASS";
  const p0Complete = verdict === "PASS";
  const recommendedCoverageLevel = p0Complete
    ? "complete-style-preview"
    : verdict === "PARTIAL"
      ? "conservative-application"
      : "insufficient";

  ok({
    ok: p0Complete,
    verdict,
    p0Complete,
    mode,
    brand,
    sourceUrl: effectiveSourceUrl,
    sourceRole: sourceRole || null,
    previewUrl: effectivePreviewUrl || null,
    previewTier: classifyPreviewUrl(effectivePreviewUrl),
    recommendedCoverageLevel,
    files: {
      planFile: planFile ? path.relative(root, planFile) : null,
      runLog: runLog ? path.relative(root, runLog) : null,
      brandMod: existingModFile ? path.relative(root, existingModFile) : null,
      evidence: existingEvidenceFile ? path.relative(root, existingEvidenceFile) : null,
      dangouiAdapter: existingAdapterFile ? path.relative(root, existingAdapterFile) : null,
      hostFiles: hostFiles.map((file) => path.relative(root, file)),
    },
    coverage,
    checks,
    blocking,
    warnings: [
      ...warnings,
      ...assetWarnings,
    ],
    next: p0Complete
      ? ["P0 acceptance passed. This run can be used as an accepted baseline."]
      : [
          "Do not claim P0 complete yet.",
          "Fix FAIL items first; PARTIAL items must downgrade final wording and run log coverage.",
        ],
  });
  process.exit(p0Complete ? 0 : failCount ? 2 : 3);
}

function findHostMigrationRoot(root, brand, planFileOpt, hostTarget) {
  const candidates = [];
  if (planFileOpt) {
    const absolutePlan = path.resolve(root, planFileOpt);
    candidates.push(path.dirname(absolutePlan));
  }
  if (hostTarget) {
    const absoluteTarget = path.resolve(root, hostTarget);
    const parts = absoluteTarget.split(path.sep);
    for (let index = parts.length; index > 0; index -= 1) {
      const dir = parts.slice(0, index).join(path.sep) || path.sep;
      candidates.push(path.join(dir, "migrations", brand));
    }
  }
  candidates.push(path.join(root, "migrations", brand));
  return candidates.find((dir) => dir && fs.existsSync(dir)) || "";
}

function readLatestRunForBrand(runLog, brand) {
  if (!runLog || !fs.existsSync(runLog)) return null;
  const lines = fs.readFileSync(runLog, "utf8").split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const item = readJsonLine(lines[index]);
    if (item?.brand === brand) return item;
  }
  return null;
}

function readJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function resolveAcceptanceFiles({ root, plan, planFile, fileOpt, hostTarget }) {
  const values = [];
  if (fileOpt) values.push(...parseList(fileOpt));
  if (hostTarget) values.push(hostTarget);
  if (Array.isArray(plan?.targetFiles)) values.push(...plan.targetFiles);
  const hostRoot = inferHostRootFromPlanFile(planFile) || root;
  return unique(values)
    .map((file) => {
      const text = String(file || "");
      if (path.isAbsolute(text)) return text;
      if (fs.existsSync(path.resolve(root, text))) return path.resolve(root, text);
      return path.resolve(hostRoot, text);
    })
    .filter(Boolean)
    .filter((file, index, list) => list.indexOf(file) === index);
}

function inferHostRootFromPlanFile(planFile) {
  if (!planFile) return "";
  const parts = path.resolve(planFile).split(path.sep);
  const migrationsIndex = parts.lastIndexOf("migrations");
  if (migrationsIndex <= 0) return "";
  return parts.slice(0, migrationsIndex).join(path.sep) || path.sep;
}

function classifyPreviewUrl(value) {
  const text = String(value || "");
  if (!text) return "missing";
  if (text.startsWith("file://")) return "static-file";
  try {
    const url = new URL(text);
    if (/\/preview\/[^/]+\.html$/i.test(url.pathname)) return "static-file";
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return "dev-server";
    return "remote";
  } catch {
    if (/\.html(?:$|[?#])/i.test(text)) return "static-file";
  }
  return "unknown";
}

function scoreAcceptanceCoverage(root, brand, files, evidenceFile) {
  const dimensions = {
    color: /--du-(?:bg|text|primary|border)|#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/i,
    font: /font-family|@font-face|--style-font|--du-font/i,
    radius: /border-radius|--style-(?:card|control)-radius|rounded-/i,
    border: /border(?:-[a-z]+)?\s*:|--style-frame-border|border-image/i,
    shadow: /box-shadow|--style-card-shadow|text-shadow/i,
    frameOrAsset: /url\(|mask|clip-path|border-image|background-image|::before|::after|asset|texture|frame|media|image/i,
    activeState: /active|selected|current|checked|hover|focus|tab|button|switch|--du-primary/i,
  };
  const hits = Object.fromEntries(Object.keys(dimensions).map((key) => [key, []]));
  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    for (const [dimension, pattern] of Object.entries(dimensions)) {
      if (pattern.test(text)) hits[dimension].push(path.relative(root, file));
    }
  }
  const covered = Object.entries(hits).filter(([, value]) => value.length).map(([key]) => key);
  const missing = Object.keys(dimensions).filter((key) => !covered.includes(key));
  const computedMismatches = evidenceFile && fs.existsSync(evidenceFile)
    ? findComputedToneMismatches(JSON.parse(fs.readFileSync(evidenceFile, "utf8")), root)
    : [];
  const previewGateFile = brand ? path.join(root, "migrations", brand, "preview-gate.json") : "";
  const assetRoleCoverage = previewGateFile && fs.existsSync(previewGateFile)
    ? readAssetRoleCoverage(previewGateFile)
    : null;
  return {
    covered,
    missing,
    computedMismatches,
    assetRoleCoverage,
    hits: Object.fromEntries(Object.entries(hits).map(([key, value]) => [key, unique(value).slice(0, 8)])),
  };
}

function findAcceptanceAssetWarnings(root, brand, files) {
  const warnings = [];
  const inventoryFile = path.join(root, "migrations", brand, "asset-inventory.json");
  const inventory = fs.existsSync(inventoryFile) ? readJsonLoose(inventoryFile) : null;
  const assetRecords = normalizeAssetInventoryRecords(inventory);
  for (const file of files) {
    const text = safeRead(file);
    if (!text) continue;
    const cssTexts = path.extname(file).toLowerCase() === ".vue" ? extractBlocks(text, "style") : [text];
    for (const cssText of cssTexts) {
      const cssRules = extractCssRules(cssText);
      for (const rule of cssRules) {
        if (!/url\(|::before|::after|mask|clip-path|border-image/i.test(rule.body)) continue;
        const role = inferCssAssetUsageRole(rule.selector, rule.body, assetRecords);
        if (role === "decorative-layer" && /tabs-row|filter-panel|deck-card|event-row|card|list|grid/i.test(rule.selector)) {
          warnings.push({
            id: "decorative-mounted-on-generic-component",
            file: path.relative(root, file),
            selector: rule.selector,
            role,
            message: "装饰层挂到了通用组件或业务列表上，容易把品牌视觉误套到不该承接的宿主结构。",
            fix: "只有 evidence targetScope 命中的 section/selector 才能挂装饰层；否则降级为 conservative-application。",
          });
        }
      }
    }
  }
  return warnings.filter((item, index, list) => {
    const key = `${item.id}|${item.file}|${item.selector}`;
    return list.findIndex((entry) => `${entry.id}|${entry.file}|${entry.selector}` === key) === index;
  });
}

function extractCssRules(cssText) {
  const rules = [];
  const text = String(cssText || "").replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(text))) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (!selector || !body) continue;
    rules.push({ selector, body });
  }
  return rules;
}

function summarizeRuns() {
  const root = opt("--root", process.cwd());
  const scope = opt("--scope", "global");
  const projectLog = opt("--project-log", path.join(root, "migrations", "_brand-runs", "runs.jsonl"));
  const globalLog = opt("--global-log", path.join(homeDir(), ".codex", "brand-skill", "runs.jsonl"));
  const files = scope === "project"
    ? [projectLog]
    : scope === "all"
      ? [globalLog, projectLog]
      : [globalLog];
  const resolved = applyRunTombstones(files.flatMap((file) => readJsonl(file)).filter(Boolean));
  const runs = resolved.activeRuns;
  const byHost = countBy(runs, (run) => run.sourceHost || parseSource(run.sourceUrl).host || "unknown");
  const byCoverage = countBy(runs, (run) => run.coverageLevel || "unknown");
  const byBrand = countBy(runs, (run) => run.brand || "unknown");
  const missing = {};
  for (const run of runs) {
    for (const dim of run.missingDimensions || []) {
      missing[dim] = (missing[dim] || 0) + 1;
    }
  }
  const candidates = Object.entries(byHost)
    .filter(([, count]) => count >= Number(opt("--min-count", "2")))
    .sort((a, b) => b[1] - a[1])
    .map(([host, count]) => ({ host, count }));
  ok({
    ok: true,
    scope,
    files,
    totalRuns: runs.length,
    totalRunRecords: resolved.totalRunRecords,
    tombstonedRuns: resolved.tombstonedRuns.length,
    tombstonesByDisposition: sortCountMap(countBy(resolved.tombstonedRuns, (item) => item.tombstone.disposition)),
    byHost: sortCountMap(byHost),
    byBrand: sortCountMap(byBrand),
    byCoverage: sortCountMap(byCoverage),
    missingDimensions: sortCountMap(missing),
    stylePackCandidates: candidates,
    message: "Use this summary to decide which websites deserve maintained style packs and which dimensions fail most often.",
  });
}

function issueRetro() {
  const root = opt("--root", process.cwd());
  const scope = opt("--scope", "all");
  const limit = Number(opt("--limit", "12"));
  const projectLog = opt("--project-log", path.join(root, "migrations", "_brand-runs", "runs.jsonl"));
  const globalLog = opt("--global-log", path.join(homeDir(), ".codex", "brand-skill", "runs.jsonl"));
  const files = scope === "project"
    ? [projectLog]
    : scope === "global"
      ? [globalLog]
      : [globalLog, projectLog];
  const records = files
    .flatMap((file) => readJsonl(file).map((run) => ({ ...run, logFile: file })))
    .filter(Boolean);
  const resolved = applyRunTombstones(records);
  const runs = resolved.activeRuns
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const latestRuns = runs.slice(0, limit);
  const missing = {};
  const coverage = {};
  const hosts = {};
  for (const run of latestRuns) {
    coverage[run.coverageLevel || "unknown"] = (coverage[run.coverageLevel || "unknown"] || 0) + 1;
    const host = run.sourceHost || parseSource(run.sourceUrl).host || "unknown";
    hosts[host] = (hosts[host] || 0) + 1;
    for (const dim of run.missingDimensions || []) {
      missing[dim] = (missing[dim] || 0) + 1;
    }
  }
  const recurringIssues = inferRetroIssues(latestRuns, missing);
  ok({
    ok: true,
    type: "brand-issue-retro",
    status: "needs-human-confirmation",
    scope,
    files,
    totalRunsScanned: runs.length,
    totalRunRecords: resolved.totalRunRecords,
    tombstonedRunsExcluded: resolved.tombstonedRuns.length,
    latestRuns: latestRuns.map((run) => ({
      createdAt: run.createdAt,
      brand: run.brand,
      sourceHost: run.sourceHost || parseSource(run.sourceUrl).host || "unknown",
      coverageLevel: run.coverageLevel || "unknown",
      missingDimensions: run.missingDimensions || [],
      stylePack: run.stylePack,
      generatedPreview: run.generatedPreview,
      projectName: run.projectName || run.project?.name || "",
      targetRoute: run.targetRoute || "",
      previewUrl: run.previewUrl || "",
    })),
    summarySignals: {
      byHost: sortCountMap(hosts),
      byCoverage: sortCountMap(coverage),
      missingDimensions: sortCountMap(missing),
    },
    recurringIssues,
    requiredAssistantProtocol: [
      "把脚本输出和当前对话/浏览器反馈合并成：最新问题、复盘原因、解决方案、落地点。",
      "先问用户“这些复盘和落地方向 OK 吗？”",
      "用户确认前不要改规则、脚本、demo 或宿主项目。",
      "确认后优先把可自动化问题落到 guard/extractor/validator；只有无法脚本化的判断才写 SKILL.md 或 references。",
    ],
    suggestedLandingOrder: [
      "scripts/brand-guard.mjs 或 extractor/validator：能检查、能阻断、能自动汇总的问题",
      "skills/brand/SKILL.md：执行顺序、触发词、确认协议",
      "skills/brand/references/*.md：设计判断、映射口径、人工复盘模板",
      "migrations/{brand}/：单个品牌证据、style pack、demo 修正",
    ],
    message: "This is a pending retro report. Ask the user to confirm before landing fixes.",
  });
}

function applyRunTombstones(records) {
  const tombstones = records.filter((item) => item?.recordType === "run-tombstone");
  const runs = records.filter((item) => item && item.recordType !== "run-tombstone");
  const tombstonedRuns = [];
  const activeRuns = [];
  for (const run of runs) {
    const matching = tombstones
      .filter((item) => (!item.runId || item.runId === run.runId) && (!item.brand || item.brand === run.brand))
      .filter((item) => !item.createdAt || !run.createdAt || String(item.createdAt) >= String(run.createdAt))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
    if (matching) tombstonedRuns.push({ run, tombstone: matching });
    else activeRuns.push(run);
  }
  return { activeRuns, tombstonedRuns, tombstones, totalRunRecords: runs.length };
}

function inferRetroIssues(runs, missing) {
  const issues = [];
  const add = (id, title, cause, solution, landing) => {
    issues.push({ id, title, cause, solution, landing });
  };
  const hasMissing = (name) => Number(missing[name] || 0) > 0;
  const weakCoverage = runs.some((run) => {
    const level = run.coverageLevel || "";
    return /draft|color-layer|conservative|unknown|partial/i.test(level);
  });
  if (hasMissing("asset") || hasMissing("frame") || hasMissing("frame-or-asset")) {
    add(
      "asset-frame-underfit",
      "资产、背景、frame 还原不足",
      "学习链路可能只记录了资产，未验证资产是否进入 Hero/Image/Frame/Background 等真实页面角色。",
      "用 rendered asset inventory 和 asset-usage gate 校验资源是否被页面消费，并在未消费时降级或阻断。",
      "scripts/brand-guard.mjs asset-usage-gate / collect-rendered-assets"
    );
  }
  if (hasMissing("cta") || hasMissing("active-state") || hasMissing("action")) {
    add(
      "action-color-weak-evidence",
      "CTA / active 主色证据不足",
      "主色可能来自全站颜色频次或人工校准，没有从按钮、链接、下载入口、表单提交等 action 节点的 computed style 加权得出。",
      "强制跑 action evidence，把可点击、首屏、CTA 文案和面积纳入权重；没有客观证据不能写入 --du-primary-color。",
      "score-action-evidence / tpp-test / validate-tone"
    );
  }
  if (hasMissing("font") || hasMissing("typography")) {
    add(
      "font-computed-gap",
      "字体证据不足",
      "可能只看了 CSS 文件或品牌印象，没有从 rendered computed font-family 反查 @font-face 和实际资源。",
      "所有字体判断先读 computed font-family，再记录来源 rule、字体文件和 fallback。",
      "collect-site-evidence --computed-file / validate-tone --require-computed"
    );
  }
  if (weakCoverage) {
    add(
      "final-claim-overstates",
      "最终说法可能过度宣称",
      "coverageLevel 低时仍容易说成“已完整套用”，运营会误以为已经达到完整迁移。",
      "最终话术必须按 coverageLevel 分级：草稿、保守应用、颜色层应用、完整风格预览。",
      "validate-final / SKILL.md 最终输出口径"
    );
  }
  if (runs.some((run) => run.generatedPreview === false || run.stylePack === false)) {
    add(
      "style-pack-or-preview-missing",
      "style pack 或标准 demo 预览缺失",
      "无现成 style pack 时可能直接在业务项目里临时拼页面，绕过标准 demo gate。",
      "学习网站先生成标准 demo/style pack 草稿，通过 demo gate 后再考虑业务 apply。",
      "run-brand-workflow.mjs / demo-gate / SKILL.md 两路径分流"
    );
  }
  if (!issues.length) {
    add(
      "manual-review-needed",
      "日志没有暴露明确高频问题",
      "现有 run log 只记录结果维度，不包含全部对话反馈和截图批注。",
      "把当前对话中的具体失败点补充为本轮 retro，再决定是否新增结构化日志字段。",
      "SKILL.md retro protocol / record-run 字段扩展"
    );
  }
  return issues;
}

async function collectSiteEvidence() {
  const root = opt("--root", process.cwd());
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl));
  if (!brand) fail("--brand is required or inferable from --source-url");
  const outPath = opt("--out", path.join(root, "migrations", brand, "site-evidence.json"));
  const htmlFile = opt("--html-file", "");
  const cssFiles = opt("--css-files", "");
  const computedFile = opt("--computed-file", "");
  const scope = opt("--scope", brand);
  const maxCss = Number(opt("--max-css", "12"));
  const minConfidence = Number(opt("--min-confidence", "0.65"));
  const documents = [];
  const warnings = [];

  if (htmlFile) {
    const text = safeRead(path.resolve(root, htmlFile));
    if (text) documents.push({ type: "html-file", url: htmlFile, text });
    else warnings.push(`html-file not readable: ${htmlFile}`);
  }

  if (sourceUrl) {
    try {
      const text = await fetchText(sourceUrl);
      documents.push({ type: "html", url: sourceUrl, text });
      const cssUrls = extractStylesheetUrls(text, sourceUrl).slice(0, maxCss);
      for (const cssUrl of cssUrls) {
        try {
          const css = await fetchText(cssUrl);
          documents.push({ type: "css-url", url: cssUrl, text: css });
        } catch (error) {
          warnings.push(`css fetch failed: ${cssUrl} (${error.message})`);
        }
      }
    } catch (error) {
      warnings.push(`source fetch failed: ${sourceUrl} (${error.message})`);
    }
  }

  if (cssFiles) {
    for (const item of cssFiles.split(",").map((part) => part.trim()).filter(Boolean)) {
      const full = path.resolve(root, item);
      const text = safeRead(full);
      if (text) documents.push({ type: "css-file", url: item, text });
      else warnings.push(`css-file not readable: ${item}`);
    }
  }

  if (computedFile) {
    const full = path.resolve(root, computedFile);
    const text = safeRead(full);
    if (text) documents.push({ type: "computed-file", url: computedFile, text });
    else warnings.push(`computed-file not readable: ${computedFile}`);
  }

  if (!documents.length) fail("No evidence documents collected. Provide --source-url, --html-file, or --css-files.");

  const samples = [];
  for (const doc of documents) {
    if (doc.type.startsWith("css")) samples.push(...collectCssColorSamples(doc, { scope: doc.type === "css-file" ? scope : "" }));
    else if (doc.type === "computed-file") samples.push(...collectComputedColorSamples(doc));
    else samples.push(...collectHtmlColorSamples(doc));
  }

  const normalized = samples.map((sample) => normalizeColorSample(sample)).filter(Boolean);
  const familyScores = {};
  const colorScores = {};
  const roleEvidence = {};
  for (const sample of normalized) {
    familyScores[sample.family] = (familyScores[sample.family] || 0) + sample.weight;
    colorScores[sample.hex] = (colorScores[sample.hex] || 0) + sample.weight;
    roleEvidence[sample.role] ||= [];
    if (roleEvidence[sample.role].length < 16) {
      roleEvidence[sample.role].push({
        color: sample.hex,
        family: sample.family,
        weight: sample.weight,
        source: sample.source,
        context: sample.context,
      });
    }
  }

  const tone = decideDominantTone(familyScores, normalized, minConfidence);
  const data = {
    schema: "brand-site-evidence/v1",
    brand,
    sourceUrl,
    createdAt: new Date().toISOString(),
    collection: {
      documents: documents.map((doc) => ({ type: doc.type, url: doc.url, bytes: Buffer.byteLength(doc.text || "", "utf8") })),
      sampleCount: normalized.length,
      warningCount: warnings.length,
      scope,
      warnings,
    },
    dominantToneDecision: tone,
    familyScores: Object.fromEntries(Object.entries(familyScores).sort((a, b) => b[1] - a[1]).map(([key, value]) => [key, round(value)])),
    topColors: Object.entries(colorScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([color, score]) => ({ color, score: round(score), family: classifyColor(hexToRgb(color)).family })),
    roleEvidence,
    gate: {
      ok: Boolean(tone.result) && tone.confidence >= minConfidence,
      minConfidence,
      message: tone.confidence >= minConfidence
        ? "Tone evidence is strong enough to seed adapter/demo tokens."
        : "Tone evidence is weak. Keep as draft and ask for screenshot/design confirmation before changing adapter/demo tokens.",
    },
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
  ok({
    ok: data.gate.ok,
    out: path.relative(root, outPath),
    dominantToneDecision: data.dominantToneDecision,
    familyScores: data.familyScores,
    topColors: data.topColors.slice(0, 8),
    warnings,
  });
}

function collectRenderedAssets() {
  const root = opt("--root", process.cwd());
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl));
  if (!brand) fail("--brand is required or inferable from --source-url");
  const outPath = opt("--out", path.join(root, "migrations", brand, "rendered-asset-inventory.json"));
  const htmlFiles = splitList(opt("--html-file", ""));
  const cssFiles = splitList(opt("--css-files", ""));
  const computedFiles = splitList(opt("--computed-file", ""));
  const networkFiles = splitList(opt("--network-file", ""));
  const documents = [];
  const warnings = [];

  for (const file of htmlFiles) {
    const full = path.resolve(root, file);
    const text = safeRead(full);
    if (text) documents.push({ type: "html-file", url: file, text });
    else warnings.push(`html-file not readable: ${file}`);
  }
  for (const file of cssFiles) {
    const full = path.resolve(root, file);
    const text = safeRead(full);
    if (text) documents.push({ type: "css-file", url: file, text });
    else warnings.push(`css-file not readable: ${file}`);
  }
  for (const file of computedFiles) {
    const full = path.resolve(root, file);
    const text = safeRead(full);
    if (text) documents.push({ type: "computed-file", url: file, text });
    else warnings.push(`computed-file not readable: ${file}`);
  }
  for (const file of networkFiles) {
    const full = path.resolve(root, file);
    const text = safeRead(full);
    if (text) documents.push({ type: "network-file", url: file, text });
    else warnings.push(`network-file not readable: ${file}`);
  }
  if (!documents.length) fail("No rendered asset documents collected. Provide --html-file, --css-files, --computed-file, or --network-file.");

  const assets = [];
  for (const doc of documents) {
    if (doc.type === "html-file") assets.push(...collectHtmlRenderedAssets(doc, sourceUrl));
    else if (doc.type === "css-file") assets.push(...collectCssRenderedAssets(doc, sourceUrl));
    else if (doc.type === "computed-file") assets.push(...collectComputedRenderedAssets(doc, sourceUrl));
    else if (doc.type === "network-file") assets.push(...collectNetworkRenderedAssets(doc, sourceUrl));
  }

  const deduped = dedupeRenderedAssets(assets);
  const roleCoverage = summarizeRenderedAssetRoles(deduped);
  const sectionBackgroundChain = summarizeSectionBackgroundChain(deduped);
  const data = {
    schema: "brand-rendered-asset-inventory/v1",
    brand,
    sourceUrl,
    createdAt: new Date().toISOString(),
    collection: {
      documents: documents.map((doc) => ({ type: doc.type, url: doc.url, bytes: Buffer.byteLength(doc.text || "", "utf8") })),
      warningCount: warnings.length,
      warnings,
    },
    assets: deduped,
    roleCoverage,
    sectionBackgroundChain,
    rule: "Rendered assets are collected from DOM currentSrc/srcset/poster, CSS background/mask/border-image, pseudo-elements, computed style and network resources before mapping to Image, Frame, texture or style-only recipe.",
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
  ok({
    ok: true,
    out: path.relative(root, outPath),
    assetCount: deduped.length,
    roleCoverage,
    sectionBackgroundChain,
    samples: deduped.slice(0, 8).map((asset) => ({
      role: asset.roleGuess,
      sourceType: asset.sourceType,
      selector: asset.selector,
      pseudo: asset.pseudo,
      property: asset.property,
      url: asset.resolvedUrl,
    })),
    warnings,
  });
}

function importDembrandtEvidence() {
  const root = opt("--root", process.cwd());
  const input = opt("--input", "");
  const sourceUrl = opt("--source-url", "");
  const brand = opt("--brand", inferBrandKey(sourceUrl));
  if (!brand) fail("--brand is required or inferable from --source-url");
  if (!input) fail("--input is required");
  const inputPath = path.resolve(root, input);
  if (!fs.existsSync(inputPath)) fail(`Dembrandt result not found: ${input}`);

  const raw = readJsonLoose(inputPath);
  const outPath = opt("--out", path.join(root, "migrations", brand, "third-party-evidence.dembrandt.json"));
  const palette = toArray(raw?.colors?.palette).map(normalizeDembrandtPaletteItem).filter(Boolean);
  const buttons = toArray(raw?.components?.buttons).map(normalizeDembrandtButton).filter(Boolean);
  const radii = toArray(raw?.borderRadius || raw?.radii).map(normalizeDembrandtMetric).filter(Boolean);
  const shadows = toArray(raw?.shadows).map(normalizeDembrandtShadow).filter(Boolean);
  const semanticColors = normalizeDembrandtSemanticColors(raw?.colors?.semantic || {});
  const typography = normalizeDembrandtTypography(raw?.typography);
  const candidateHints = inferDembrandtCandidateHints({ semanticColors, palette, buttons, radii, shadows });

  const data = {
    schema: "brand-third-party-computed-evidence/v1",
    provider: "dembrandt",
    brand,
    sourceUrl: sourceUrl || raw?.url || "",
    input: path.relative(root, inputPath),
    createdAt: new Date().toISOString(),
    counts: {
      semanticColors: Object.keys(semanticColors).length,
      palette: palette.length,
      buttonVariants: buttons.length,
      radii: radii.length,
      shadows: shadows.length,
      typography: typography.length,
    },
    computedEvidence: {
      semanticColors,
      palette,
      buttonVariants: buttons,
      radii,
      shadows,
      typography,
    },
    candidateHints,
    requiredBrandGuards: [
      "score-action-evidence",
      "collect-rendered-assets",
      "asset-usage-gate",
      "create-selector-map",
      "coverage-gate",
      "demo-gate",
    ],
    mappingBoundary: {
      canSeed: [
        "raw palette evidence",
        "button computed styles",
        "radius/shadow/typography hints",
      ],
      mustNotOverwriteDirectly: [
        "--du-* tokens",
        "componentVariants",
        "slots",
        "assets",
        "layoutRules",
        "platformOverrides",
        "businessApply",
      ],
      decisionRule: "Use third-party extraction only as raw computed evidence; rerun Brand action/asset/selector/coverage gates before changing style.json, demo presets, or business pages.",
    },
    limitations: [
      "Global color frequency can over-rank decorative, text, or manifest colors.",
      "CTA color requires action-node scoring from real clickable/download/submit elements.",
      "Assets, pseudo-elements, masks, section background stacking, and DOM selector mapping still require Brand rendered asset guards.",
      "This import does not mutate style.json or generated demo files.",
    ],
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
  ok({
    ok: true,
    out: path.relative(root, outPath),
    provider: data.provider,
    counts: {
      semanticColors: Object.keys(semanticColors).length,
      palette: palette.length,
      buttonVariants: buttons.length,
      radii: radii.length,
      shadows: shadows.length,
    },
    candidateHints,
    next: [
      `node .claude/skills/brand/scripts/brand-guard.mjs score-action-evidence --brand ${brand} --file migrations/${brand}/action-evidence-v02.json --out migrations/${brand}/action-evidence-score.skills.json`,
      `node .claude/skills/brand/scripts/brand-guard.mjs collect-rendered-assets --brand ${brand} --source-url "${data.sourceUrl}" --html-file <rendered.html> --css-files <page.css> --computed-file <computed.json>`,
      `node .claude/skills/brand/scripts/brand-guard.mjs coverage-gate --brand ${brand} --files <demo/theme files> --evidence-file migrations/${brand}/site-evidence.json`,
    ],
  });
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (Array.isArray(value.values)) return value.values;
  return [value];
}

function normalizeDembrandtColorValue(value) {
  if (!value) return null;
  const text = String(value).trim();
  const color = text.startsWith("#") || /^rgba?\(/i.test(text) ? text : extractColorValues(text)[0];
  const rgb = parseColor(color);
  if (!rgb) return null;
  const hex = rgbToHex(rgb);
  const classified = classifyColor(rgb);
  return {
    value: text,
    hex,
    family: classified.family,
    hue: round(classified.hue),
    saturation: round(classified.saturation),
    lightness: round(classified.lightness),
  };
}

function normalizeDembrandtPaletteItem(item) {
  if (!item) return null;
  if (typeof item === "string") return normalizeDembrandtColorValue(item);
  const normalized = normalizeDembrandtColorValue(item.normalized || item.hex || item.color || item.value);
  if (!normalized) return null;
  return {
    ...normalized,
    role: item.role || "",
    count: Number(item.count || 0),
    confidence: item.confidence || "",
    sources: toArray(item.sources).map(String).slice(0, 8),
    onColor: item.onColor || "",
    hover: item.hover || "",
  };
}

function normalizeDembrandtSemanticColors(semantic) {
  const out = {};
  if (!semantic || typeof semantic !== "object") return out;
  for (const [key, value] of Object.entries(semantic)) {
    const normalized = normalizeDembrandtColorValue(value);
    if (normalized) out[key] = normalized;
  }
  return out;
}

function normalizeDembrandtButton(button) {
  if (!button || typeof button !== "object") return null;
  const styles = button.states?.default || button.default || button.style || button.styles || {};
  const backgroundColor = normalizeDembrandtColorValue(styles.backgroundColor || styles.background || button.backgroundColor);
  const color = normalizeDembrandtColorValue(styles.color || button.color);
  const borderValue = styles.border || styles.borderColor || button.border || "";
  const borderColors = extractColorValues(borderValue).map(normalizeDembrandtColorValue).filter(Boolean);
  const text = String(button.text || button.label || "").trim();
  return {
    text,
    role: inferRole(text || "button", "button"),
    confidence: button.confidence || "",
    backgroundColor,
    color,
    border: borderValue,
    borderColors,
    borderRadius: styles.borderRadius || button.borderRadius || "",
    padding: styles.padding || button.padding || "",
    fontSize: styles.fontSize || button.fontSize || "",
    fontWeight: styles.fontWeight || button.fontWeight || "",
    boxShadow: styles.boxShadow || button.boxShadow || "",
  };
}

function normalizeDembrandtMetric(item) {
  if (item == null) return null;
  if (typeof item === "string" || typeof item === "number") return { value: String(item) };
  const value = item.value || item.radius || item.borderRadius || item.size || item.shadow || item.token || "";
  if (!value) return null;
  return {
    value: String(value),
    count: Number(item.count || 0),
    confidence: item.confidence || "",
    elements: toArray(item.elements).map(String).slice(0, 8),
    numericValue: Number.isFinite(Number(item.numericValue)) ? Number(item.numericValue) : undefined,
  };
}

function normalizeDembrandtShadow(item) {
  const metric = normalizeDembrandtMetric(item);
  if (!metric) return null;
  return {
    ...metric,
    colors: extractColorValues(metric.value).map(normalizeDembrandtColorValue).filter(Boolean),
  };
}

function normalizeDembrandtTypography(typography) {
  if (!typography || typeof typography !== "object") return {};
  const styles = toArray(typography.styles).slice(0, 20).map((item) => {
    if (!item || typeof item !== "object") return { value: String(item) };
    return {
      fontFamily: item.fontFamily || item.family || "",
      fontSize: item.fontSize || item.size || "",
      fontWeight: item.fontWeight || item.weight || "",
      lineHeight: item.lineHeight || "",
      count: Number(item.count || 0),
      confidence: item.confidence || "",
      selectors: toArray(item.selectors).map(String).slice(0, 5),
    };
  });
  return {
    styles,
    sources: toArray(typography.sources).map(String).slice(0, 20),
  };
}

function inferDembrandtCandidateHints({ semanticColors, palette, buttons, radii, shadows }) {
  const nonNeutralPalette = palette.find((item) => item.hex && !isNeutralActionColor(item.hex, item.family));
  const primaryAction = buttons.find((item) => item.backgroundColor && !isNeutralActionColor(item.backgroundColor.hex, item.backgroundColor.family));
  const activeAction = buttons.find((item) => item.backgroundColor && /active|selected|current|すべて|全部|选中/i.test(item.text || ""));
  const controlRadius = radii.find((item) => /%|60px|999px|pill/i.test(item.value)) || radii[0];
  const cardRadius = radii.find((item) => !/%|60px|999px/i.test(item.value)) || radii[0];
  return {
    primaryColorSeed: {
      value: semanticColors.primary?.hex || nonNeutralPalette?.hex || "",
      source: semanticColors.primary ? "dembrandt.colors.semantic.primary" : "dembrandt.colors.palette first non-neutral",
      confidence: "seed-only",
    },
    accentColorSeed: {
      value: semanticColors.accent?.hex || "",
      source: semanticColors.accent ? "dembrandt.colors.semantic.accent" : "",
      confidence: "seed-only",
    },
    primaryActionFillSeed: primaryAction ? {
      value: primaryAction.backgroundColor.hex,
      text: primaryAction.text,
      source: "dembrandt.components.buttons computed backgroundColor",
      confidence: "seed-only; rerun score-action-evidence before mapping --du-primary-color",
    } : null,
    activeStateFillSeed: activeAction?.backgroundColor ? {
      value: activeAction.backgroundColor.hex,
      text: activeAction.text,
      source: "dembrandt.components.buttons active-like text/backgroundColor",
      confidence: "seed-only; rerun score-action-evidence before mapping active-state tokens",
    } : null,
    cardRadiusSeed: cardRadius ? { value: cardRadius.value, source: "dembrandt.borderRadius", confidence: "seed-only" } : null,
    controlRadiusSeed: controlRadius ? { value: controlRadius.value, source: "dembrandt.borderRadius", confidence: "seed-only" } : null,
    shadowSeed: shadows[0] ? { value: shadows[0].value, source: "dembrandt.shadows highest count", confidence: "seed-only" } : null,
  };
}

function scoreActionEvidence() {
  const root = opt("--root", process.cwd());
  const file = opt("--file", "");
  const brand = opt("--brand", "");
  const outPath = opt("--out", "");
  if (!file) fail("--file is required");
  const full = path.resolve(root, file);
  const parsed = readJsonLoose(full);
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
  if (!entries.length) fail(`No action evidence entries found in ${file}`);

  const buckets = {
    primaryActionFill: [],
    activeStateFill: [],
    neutralActionSurface: [],
    actionTextBorder: [],
    actionShadow: [],
  };

  for (const entry of entries) {
    const styles = entry.styles || entry.computed || {};
    const role = String(entry.role || "");
    const text = `${entry.text || ""} ${entry.selector || ""} ${entry.className || ""}`.toLowerCase();
    const score = Number(entry.actionScore || entry.score || 1);
    const isCta = role === "cta" || /cta|button|download|reserve|submit|领取|下载|提交|报名|応募|ニュースまとめ/.test(text);
    const isActive = /active|selected|current|is-active|选中|当前|すべて/.test(text);
    if (!isCta && !isActive) continue;

    addActionColor(buckets.primaryActionFill, entry, styles.backgroundColor, "backgroundColor", score, {
      allowNeutral: false,
      multiplier: isCta ? 2 : 0.8,
    });
    addActionColor(buckets.activeStateFill, entry, styles.backgroundColor, "backgroundColor", score, {
      allowNeutral: false,
      multiplier: isActive ? 2 : 0.25,
    });
    addActionColor(buckets.neutralActionSurface, entry, styles.backgroundColor, "backgroundColor", score, {
      allowNeutral: true,
      onlyNeutral: true,
      multiplier: isCta ? 1.2 : 0.4,
    });
    for (const field of ["color", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "borderColor"]) {
      addActionColor(buckets.actionTextBorder, entry, styles[field], field, score, {
        allowNeutral: true,
        multiplier: field === "color" ? 0.9 : 0.6,
      });
    }
    addActionColor(buckets.actionShadow, entry, styles.boxShadow, "boxShadow", score, {
      allowNeutral: true,
      multiplier: 0.15,
    });
  }

  const result = {
    schema: "brand-action-evidence-score/v1",
    brand,
    source: file,
    createdAt: new Date().toISOString(),
    candidates: Object.fromEntries(Object.entries(buckets).map(([key, values]) => [key, rankActionColors(values)])),
    gate: {
      ok: Boolean(rankActionColors(buckets.primaryActionFill)[0] || rankActionColors(buckets.activeStateFill)[0]),
      message: "Use primaryActionFill for CTA token candidates, activeStateFill for selected/active tokens, neutralActionSurface for white/off-white controls, and actionTextBorder for label/border colors.",
    },
  };

  if (outPath) {
    const resolvedOut = path.resolve(root, outPath);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, `${JSON.stringify(result, null, 2)}\n`);
  }

  ok({
    ok: result.gate.ok,
    out: outPath ? path.relative(root, path.resolve(root, outPath)) : "",
    primaryActionFill: result.candidates.primaryActionFill.slice(0, 5),
    activeStateFill: result.candidates.activeStateFill.slice(0, 5),
    neutralActionSurface: result.candidates.neutralActionSurface.slice(0, 5),
    actionTextBorder: result.candidates.actionTextBorder.slice(0, 5),
  });
}

function addActionColor(bucket, entry, value, field, score, options = {}) {
  if (!value || value === "none" || value === "rgba(0, 0, 0, 0)") return;
  const colors = extractColorValues(value);
  for (const color of colors) {
    const rgb = parseColor(color);
    if (!rgb) continue;
    const hex = rgbToHex(rgb);
    const family = classifyColor(rgb).family;
    const neutral = isNeutralActionColor(hex, family);
    if (!options.allowNeutral && neutral) continue;
    if (options.onlyNeutral && !neutral) continue;
    bucket.push({
      hex,
      family,
      score: score * (options.multiplier || 1),
      field,
      value,
      selector: entry.selector || "",
      text: entry.text || "",
      role: entry.role || "",
    });
  }
}

function isNeutralActionColor(hex, family) {
  const rgb = hexToRgb(hex);
  const { saturation, lightness } = classifyColor(rgb);
  return family === "white" || family === "black" || family === "neutral" || saturation <= 0.12 || lightness >= 0.92 || lightness <= 0.14;
}

function rankActionColors(items) {
  const grouped = new Map();
  for (const item of items) {
    const current = grouped.get(item.hex) || { hex: item.hex, family: item.family, score: 0, count: 0, examples: [] };
    current.score += item.score;
    current.count += 1;
    if (current.examples.length < 4) {
      current.examples.push({
        selector: item.selector,
        text: item.text,
        field: item.field,
        value: item.value,
        role: item.role,
        score: round(item.score),
      });
    }
    grouped.set(item.hex, current);
  }
  return [...grouped.values()]
    .sort((a, b) => b.score - a.score)
    .map((item) => ({ ...item, score: round(item.score) }));
}

function collectHtmlRenderedAssets(doc, baseUrl) {
  const text = String(doc.text || "");
  const assets = [];
  for (const match of text.matchAll(/<\s*(img|source|video|image)\b[^>]*>/gi)) {
    const tag = match[1].toLowerCase();
    const tagText = match[0];
    const attrs = parseHtmlAttributes(tagText);
    const selector = selectorFromHtmlTag(tag, attrs);
    for (const property of ["currentSrc", "src", "poster", "href", "xlink:href"]) {
      const raw = attrs[property.toLowerCase()] || attrs[property];
      if (!raw) continue;
      assets.push(renderedAssetRecord({
        rawUrl: raw,
        baseUrl,
        sourceType: "dom-image",
        source: doc.url,
        selector,
        tag,
        property,
        alt: attrs.alt || "",
        className: attrs.class || "",
        id: attrs.id || "",
      }));
    }
    if (attrs.srcset) {
      for (const raw of parseSrcset(attrs.srcset)) {
        assets.push(renderedAssetRecord({
          rawUrl: raw,
          baseUrl,
          sourceType: "dom-srcset",
          source: doc.url,
          selector,
          tag,
          property: "srcset",
          alt: attrs.alt || "",
          className: attrs.class || "",
          id: attrs.id || "",
        }));
      }
    }
    if (attrs.style) {
      assets.push(...collectUrlAssetsFromDeclaration(attrs.style, {
        baseUrl,
        sourceType: "inline-style",
        source: doc.url,
        selector,
        tag,
        className: attrs.class || "",
        id: attrs.id || "",
      }));
    }
  }
  for (const styleText of extractBlocks(text, "style")) {
    assets.push(...collectCssRenderedAssets({ type: "embedded-style", url: `${doc.url}#style`, text: styleText }, baseUrl));
  }
  return assets.filter(Boolean);
}

function collectCssRenderedAssets(doc, baseUrl) {
  const text = String(doc.text || "");
  const assets = [];
  for (const block of extractCssBlocks(text)) {
    assets.push(...collectUrlAssetsFromDeclaration(block.body, {
      baseUrl,
      sourceType: "css-rule",
      source: doc.url,
      selector: block.selector,
      pseudo: inferPseudo(block.selector),
      declaration: block.body,
    }));
  }
  for (const match of text.matchAll(/@font-face\s*\{([^{}]+)\}/gi)) {
    assets.push(...collectUrlAssetsFromDeclaration(match[1], {
      baseUrl,
      sourceType: "font-face",
      source: doc.url,
      selector: "@font-face",
      declaration: match[1],
      roleOverride: "font",
    }));
  }
  return assets.filter(Boolean);
}

function collectComputedRenderedAssets(doc, baseUrl) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(doc.text || ""));
  } catch {
    return [];
  }
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
  const assets = [];
  for (const entry of entries) {
    const styles = entry.styles || entry.computed || entry;
    const selector = entry.selector || entry.label || "";
    const pseudo = entry.pseudo || inferPseudo(selector);
    if (entry.currentSrc || entry.src || entry.poster) {
      for (const property of ["currentSrc", "src", "poster"]) {
        if (!entry[property]) continue;
        assets.push(renderedAssetRecord({
          rawUrl: entry[property],
          baseUrl,
          sourceType: "computed-dom",
          source: doc.url,
          selector,
          pseudo,
          property,
          tag: entry.tag || "",
          className: entry.className || "",
          id: entry.id || "",
        }));
      }
    }
    for (const field of [
      "background",
      "backgroundImage",
      "mask",
      "maskImage",
      "webkitMaskImage",
      "-webkit-mask-image",
      "borderImage",
      "borderImageSource",
      "content",
      "filter",
      "clipPath",
      "fontFamily",
    ]) {
      const value = styles?.[field];
      if (!value || value === "none") continue;
      assets.push(...collectUrlAssetsFromDeclaration(`${field}: ${value};`, {
        baseUrl,
        sourceType: "computed-style",
        source: doc.url,
        selector,
        pseudo,
        declaration: JSON.stringify(pickComputedAssetGeometry(styles)),
      }));
    }
  }
  return assets.filter(Boolean);
}

function collectNetworkRenderedAssets(doc, baseUrl) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(doc.text || ""));
  } catch {
    return [];
  }
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
  return entries
    .map((entry) => typeof entry === "string" ? { name: entry } : entry)
    .filter((entry) => entry?.name || entry?.url)
    .map((entry) => renderedAssetRecord({
      rawUrl: entry.name || entry.url,
      baseUrl,
      sourceType: "network-resource",
      source: doc.url,
      selector: "",
      property: entry.initiatorType || entry.type || "network",
    }))
    .filter(Boolean);
}

function collectUrlAssetsFromDeclaration(declaration, context) {
  const assets = [];
  const text = String(declaration || "");
  for (const item of extractCssUrlItems(text)) {
    assets.push(renderedAssetRecord({
      rawUrl: item.url,
      baseUrl: context.baseUrl,
      sourceType: context.sourceType,
      source: context.source,
      selector: context.selector || "",
      pseudo: context.pseudo || "",
      tag: context.tag || "",
      property: item.property || inferAssetProperty(text),
      declaration: context.declaration || text,
      className: context.className || "",
      id: context.id || "",
      roleOverride: context.roleOverride || "",
    }));
  }
  return assets;
}

function renderedAssetRecord(input) {
  const resolvedUrl = normalizeAssetUrl(input.rawUrl, input.baseUrl);
  if (!resolvedUrl || !isAssetLikeUrl(resolvedUrl)) return null;
  const geometry = extractDeclarationGeometry(input.declaration || "");
  const roleGuess = input.roleOverride || inferRenderedAssetRole({ ...input, resolvedUrl, geometry });
  return {
    rawSrc: input.rawUrl,
    resolvedUrl,
    sourceType: input.sourceType,
    source: input.source || "",
    selector: input.selector || "",
    pseudo: input.pseudo || "",
    tag: input.tag || "",
    property: input.property || "",
    id: input.id || "",
    className: input.className || "",
    alt: input.alt || "",
    format: inferAssetFormat(resolvedUrl),
    roleGuess,
    implementationHint: renderedAssetImplementation(roleGuess, input),
    geometry,
    shouldMigrate: shouldMigrateRenderedAsset(roleGuess),
  };
}

function inferRenderedAssetRole(input) {
  const text = `${input.selector || ""} ${input.pseudo || ""} ${input.property || ""} ${input.tag || ""} ${input.alt || ""} ${input.resolvedUrl || ""} ${input.declaration || ""}`.toLowerCase();
  const isPseudoDecoration = input.pseudo && /content\s*:\s*["']{0,2}["']{0,2}|pointer-events\s*:\s*none|position\s*:\s*absolute/.test(String(input.declaration || ""));
  if (/\.(woff2?|ttf|otf|eot)(?:[?#].*)?$/i.test(input.resolvedUrl || "")) return "font";
  if (/tear|torn|paper|撕纸|section-edge/.test(text)) return "section-edge";
  if (/download|qrcode|qr|gift|cta|button|login|进入官网|下载|扫码|注册福利|点击即玩|平台/.test(text)) return "hero-cta-cluster";
  if (/border-image|mask|frame|边框|cloud-edge|edge|ornate/.test(text)) return "asset-frame";
  if (isPseudoDecoration && /background|bg|part|section|module|con|area/.test(text)) return "decorative-layer";
  if (/hero|kv|banner|首屏|home|part-1|mainvisual|main-visual/.test(text)) return "hero-kv";
  if (/bonus|reward|lottery|campaign|福利|奖励|活动|礼包|slide/.test(text)) return "campaign-asset";
  if (/calendar|日历|notice|news|公告/.test(text)) return "content-image";
  if (/role|character|pet|sprite|girl|boy|npc|精灵|角色|月刊|picture-inner|illustration/.test(text)) return "illustration";
  if (/logo|brand|mark/.test(text)) return "brand-mark";
  if (/icon|svg/.test(text)) return "icon";
  if (/background|bg|texture|radial-gradient|linear-gradient/.test(text)) return "background";
  if (/img|image|srcset|currentSrc/i.test(`${input.tag || ""} ${input.property || ""}`)) return "content-image";
  return "asset";
}

function renderedAssetImplementation(role, input) {
  if (role === "font") return "@font-face + computed font-family verification";
  if (role === "asset-frame") return "border-image / mask / parent frame layer";
  if (role === "section-edge") return "section transition pseudo-element / mask / decorative edge layer";
  if (role === "hero-cta-cluster") return "HeroHeader CTA cluster: Image assets plus grouped Button slots";
  if (role === "decorative-layer") return "style-only pseudo-element or background layer";
  if (role === "hero-kv") return "HeroHeader Image layer with intrinsic ratio unless computed crop proves otherwise";
  if (role === "campaign-asset" || role === "illustration" || role === "content-image") return "Image slot/img currentSrc; preserve intrinsic ratio unless computed object-fit/crop proves otherwise";
  if (role === "background") return "page/panel CSS background with computed size/position";
  if (role === "icon") return "DangoUI Icon if mapped, otherwise image/mask asset";
  return "ReviewQueue";
}

function shouldMigrateRenderedAsset(role) {
  return !["asset"].includes(role);
}

function parseHtmlAttributes(tagText) {
  const attrs = {};
  for (const match of String(tagText || "").matchAll(/([:@\w-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return attrs;
}

function selectorFromHtmlTag(tag, attrs) {
  if (attrs.id) return `#${attrs.id}${attrs.class ? `.${String(attrs.class).trim().split(/\s+/).join(".")}` : ""}`;
  if (attrs.class) return `${tag}.${String(attrs.class).trim().split(/\s+/).join(".")}`;
  return tag;
}

function parseSrcset(srcset) {
  return String(srcset || "")
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractCssUrls(text) {
  const urls = [];
  for (const match of String(text || "").matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (match[2]) urls.push(match[2]);
  }
  return urls;
}

function extractCssUrlItems(text) {
  const source = String(text || "");
  const items = [];
  const declarationPattern = /(^|[;{]\s*)([-\w]+)\s*:\s*([^;{}]*url\([^;{}]+)(?=;|$)/gi;
  for (const match of source.matchAll(declarationPattern)) {
    for (const url of extractCssUrls(match[3])) {
      items.push({ property: match[2], url });
    }
  }
  if (items.length) return items;
  return extractCssUrls(source).map((url) => ({ property: inferAssetProperty(source), url }));
}

function normalizeAssetUrl(raw, baseUrl) {
  const text = String(raw || "").trim();
  if (!text || /^data:/i.test(text)) return "";
  if (/^\/\//.test(text)) return `https:${text}`;
  try {
    return new URL(text, baseUrl || "https://example.invalid/").toString();
  } catch {
    return text;
  }
}

function isAssetLikeUrl(url) {
  return /\.(png|jpe?g|webp|gif|svg|avif|woff2?|ttf|otf|eot|mp4|webm|json|lottie)(?:[?#].*)?$/i.test(String(url || ""));
}

function inferAssetFormat(url) {
  const match = String(url || "").match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match ? match[1].toLowerCase() : "";
}

function inferPseudo(selector) {
  return String(selector || "").match(/::?(before|after)/i)?.[0] || "";
}

function inferAssetProperty(text) {
  const match = String(text || "").match(/(^|[;{]\s*)([-\w]+)\s*:/);
  return match ? match[2] : "url";
}

function extractDeclarationGeometry(declaration) {
  const text = String(declaration || "");
  const fields = ["width", "height", "position", "top", "right", "bottom", "left", "z-index", "pointer-events", "background-size", "background-position", "object-fit", "border-radius"];
  const geometry = {};
  for (const field of fields) {
    const pattern = new RegExp(`${escapeRegExp(field)}\\s*:\\s*([^;]+)`, "i");
    const value = text.match(pattern)?.[1]?.trim();
    if (value) geometry[field] = value;
  }
  return geometry;
}

function pickComputedAssetGeometry(styles) {
  const out = {};
  for (const field of ["width", "height", "position", "top", "right", "bottom", "left", "zIndex", "pointerEvents", "backgroundSize", "backgroundPosition", "objectFit", "borderRadius"]) {
    if (styles?.[field]) out[field] = styles[field];
  }
  return out;
}

function dedupeRenderedAssets(assets) {
  const seen = new Map();
  for (const asset of assets.filter(Boolean)) {
    const key = `${asset.resolvedUrl}|${asset.selector}|${asset.pseudo}|${asset.property}|${asset.sourceType}`;
    if (!seen.has(key)) {
      seen.set(key, asset);
      continue;
    }
    const existing = seen.get(key);
    existing.sources ||= [existing.source].filter(Boolean);
    if (asset.source && !existing.sources.includes(asset.source)) existing.sources.push(asset.source);
  }
  return [...seen.values()].sort((a, b) => `${a.roleGuess}${a.resolvedUrl}`.localeCompare(`${b.roleGuess}${b.resolvedUrl}`));
}

function summarizeRenderedAssetRoles(assets) {
  const required = ["hero-kv", "campaign-asset", "content-image", "illustration", "background", "decorative-layer", "asset-frame", "font", "icon", "brand-mark"];
  const byRole = {};
  for (const asset of assets) byRole[asset.roleGuess] = (byRole[asset.roleGuess] || 0) + 1;
  return {
    byRole: Object.fromEntries(Object.entries(byRole).sort((a, b) => b[1] - a[1])),
    missingCoreRoles: required.filter((role) => !byRole[role]),
    completeEnoughForDemoGate: Boolean(byRole["hero-kv"] || byRole["background"]) && Boolean(byRole["content-image"] || byRole["campaign-asset"] || byRole.illustration),
  };
}

function summarizeSectionBackgroundChain(assets) {
  const chain = [];
  const byPart = new Map();
  for (const asset of assets || []) {
    const selector = String(asset.selector || "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const url = String(asset.resolvedUrl || "");
    const text = `${selector} ${url}`;
    const partMatch = text.match(/part[-/](\d+)/i) || text.match(/part(\d+)/i);
    if (!partMatch) continue;
    const part = Number(partMatch[1]);
    if (!part || part > 20) continue;
    const isHeroCover = part === 1 && /\/part1\/.*\/bg\.(?:avif|webp|jpe?g|png)$/i.test(url);
    const isExactSectionPseudo = new RegExp(`^\\.part-${part}::(?:before|after)$`, "i").test(selector) && /background/i.test(asset.property || "");
    const isSectionBgUrl = new RegExp(`/part${part}/.*?/bg\\.(?:avif|webp|jpe?g|png)$`, "i").test(url);
    if (!isHeroCover && !isExactSectionPseudo && !isSectionBgUrl) continue;
    const current = byPart.get(part);
    const priority = isHeroCover ? 0 : isExactSectionPseudo ? 1 : 2;
    const record = {
      part,
      selector: selector || (isHeroCover ? ".part-1-cover source/img" : ""),
      pseudo: asset.pseudo || "",
      property: asset.property || "",
      url,
      sourceType: asset.sourceType,
      role: part === 1 ? "hero-cover" : "section-background",
      geometry: asset.geometry || {},
      implementationHint: part === 1
        ? "Render as the top HeroHeader media layer; content starts below status/navigation safe area."
        : "Render as full-width section background / pseudo-element layer; do not replace with gradient-only fallback.",
      priority,
    };
    if (!current || priority < current.priority) byPart.set(part, record);
  }
  for (const item of [...byPart.values()].sort((a, b) => a.part - b.part)) {
    const { priority, ...rest } = item;
    chain.push(rest);
  }
  return {
    rule: "Use this ordered chain to reconstruct page backgrounds: hero cover first, then section pseudo-element backgrounds with recorded geometry. A gradient-only demo fails when a chain item has a URL.",
    items: chain,
  };
}

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function validateTone() {
  const root = opt("--root", process.cwd());
  const brand = opt("--brand", "");
  const minConfidence = Number(opt("--min-confidence", "0.65"));
  const requireComputed = has("--require-computed");
  const file = opt("--file", brand ? path.join(root, "migrations", brand, "site-evidence.json") : "");
  if (!file) fail("--brand or --file is required");
  if (!fs.existsSync(file)) fail(`site evidence not found: ${file}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const decision = data.dominantToneDecision || {};
  const findings = [];
  if (!decision.result) findings.push({ type: "missing-dominant-tone", message: "dominantToneDecision.result is required before writing adapter/demo tokens." });
  if (Number(decision.confidence || 0) < minConfidence) findings.push({ type: "low-confidence", message: `confidence ${decision.confidence || 0} is below ${minConfidence}.` });
  if (requireComputed && !(data.collection?.documents || []).some((doc) => doc.type === "computed-file")) {
    findings.push({ type: "missing-computed-evidence", message: "computed-file evidence is required for this tone gate." });
  }
  const okResult = findings.length === 0;
  ok({
    ok: okResult,
    file: path.relative(root, file),
    dominantToneDecision: decision,
    blocking: findings,
    message: okResult
      ? "Tone gate passed. Adapter/demo token changes may use this evidence."
      : "Tone gate failed. Do not overwrite adapter/demo token conclusions yet.",
  });
  process.exit(okResult ? 0 : 2);
}

function findComputedToneMismatches(siteEvidence, root = process.cwd()) {
  const decision = siteEvidence?.dominantToneDecision || {};
  const dominant = decision.result || "";
  if (!dominant) return [];
  const allowed = allowedFamiliesForTone(dominant);
  const riskyRoles = new Set(["cta-active", "navigation", "hero", "surface", "frame"]);
  const out = [];
  const computedDocs = (siteEvidence?.collection?.documents || []).filter((doc) => doc.type === "computed-file");
  for (const doc of computedDocs) {
    const file = doc.url || "";
    const text = safeRead(path.resolve(root, file));
    if (!text) continue;
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed.entries) ? parsed.entries : [];
    for (const entry of entries) {
      const role = entry.role || inferRole(`${entry.selector || ""} ${entry.className || ""}`, "computed");
      const styles = entry.styles || entry.computed || entry;
      const colors = [];
      for (const field of ["backgroundColor", "backgroundImage", "color", "borderColor", "boxShadow"]) {
        for (const color of extractColorValues(styles?.[field] || "")) {
          const rgb = parseColor(color);
          if (!rgb) continue;
          const family = classifyColor(rgb).family;
          colors.push({ field, color: rgbToHex(rgb), family });
        }
      }
      const mismatched = colors.filter((item) => !allowed.has(item.family) && !isLowSignalFamily(item.family));
      if (!mismatched.length) continue;
      const risky = riskyRoles.has(role);
      out.push({
        severity: risky ? "high" : "medium",
        role,
        selector: entry.selector || "",
        colors: mismatched.slice(0, 8),
        message: risky
          ? "Core UI role contains colors outside the dominant tone. Check whether this component still uses baseline/default styling."
          : "Non-core role contains colors outside the dominant tone. Review if this is asset/semantic color.",
      });
    }
  }
  return out.slice(0, 20);
}

function allowedFamiliesForTone(tone) {
  const map = {
    "black-gold": ["black", "black-brown", "brown-gold", "yellow-gold", "brown-orange", "orange", "white", "neutral"],
    "blue-sky": ["blue", "cyan", "white", "neutral"],
    green: ["green", "yellow-gold", "white", "neutral", "black"],
    purple: ["purple", "pink", "blue", "white", "neutral", "black"],
  };
  return new Set(map[tone] || []);
}

function isLowSignalFamily(family) {
  return family === "white" || family === "neutral" || family === "black";
}

function collectRoleReplacementJsonFiles(root, brand = "") {
  const candidates = [];
  if (brand) {
    candidates.push(
      path.join(root, "migrations", brand, "dangoui-adapter.json"),
      path.join(root, "migrations", brand, "style-pack-draft.json"),
      path.join(root, "migrations", brand, "site-evidence.json"),
      path.join(root, "migrations", brand, "brand-evidence.json"),
      path.join(root, "migrations", brand, "echo-mapping.json"),
      path.join(root, "migrations", brand, "component-mapping.json"),
      path.join(root, "public", "brand-previews", `${brand}.json`),
    );
  }
  return unique(candidates.filter((file) => fs.existsSync(file)));
}

function collectRoleReplacementCssFiles(root, brand = "") {
  const files = listFiles(root, /\.(css|scss|sass|less|vue)$/);
  if (!brand) return files;
  const brandPattern = new RegExp(escapeRegExp(brand), "i");
  return files.filter((file) => {
    const relative = path.relative(root, file);
    if (/node_modules|dist|\.git/.test(relative)) return false;
    if (brandPattern.test(relative)) return true;
    const text = safeRead(file);
    return text && new RegExp(`theme-${escapeRegExp(brand)}|--${escapeRegExp(brand)}-|${escapeRegExp(brand)}-`, "i").test(text);
  });
}

function walkRoleObjects(value, visit, pointer = "$") {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value)) visit(value, pointer);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkRoleObjects(item, visit, `${pointer}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    walkRoleObjects(child, visit, `${pointer}.${key}`);
  }
}

function classifyReplacementRecord(object) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return null;
  const keys = Object.keys(object);
  const hasComputed = keys.some((key) => /computed|matched|sourceRule|currentSrc|loadedFont/i.test(key));
  const hasVisualProperty = keys.some((key) => /property|prop|cssProperty|radius|shadow|border|color|background|font|motion|asset/i.test(key));
  const replacement = object.replacement
    || object.replacementToken
    || object.targetToken
    || object.token
    || object.recipe
    || object.styleRecipe
    || object.targetRecipe
    || object.suggestedToken
    || object.mappedTo
    || object.target;
  const hasTarget = Boolean(replacement);
  const isRecord = hasComputed && (hasTarget || hasVisualProperty)
    || Boolean(object.enforceRoleReplacement && object.role && (hasTarget || object.selector || object.targetScope))
    || Boolean(object.computedValue && object.source && (hasTarget || object.property));
  if (!isRecord) return null;
  return {
    role: object.role || object.uiRole || object.targetRole || "",
    replacement: replacement || "",
    antiScopes: Array.isArray(object.antiScopes)
      ? object.antiScopes
      : Array.isArray(object.antiScope)
        ? object.antiScope
        : typeof object.antiScopes === "string"
          ? parseList(object.antiScopes)
          : [],
    property: object.property || object.prop || object.cssProperty || "",
  };
}

function detectRoleLeak(record) {
  const role = String(record.role || "");
  const replacement = String(record.replacement || "");
  const property = String(record.property || "");
  const antiScopes = record.antiScopes.map((item) => String(item));
  const target = `${replacement} ${property}`;
  if (/doc-surface|content-surface|media-surface/.test(role) && /control-radius|--style-control-radius|controlRadius/i.test(target)) {
    return {
      type: "control-radius-leaked-to-surface",
      message: "Control radius can only style controls; doc/content/media surfaces need their own card/media/doc radius.",
    };
  }
  if (/control/.test(role) && /card-radius|media-radius|doc-card-radius/i.test(target)) {
    return {
      type: "surface-radius-used-for-control",
      message: "Control components must not inherit card/media/doc radius without explicit computed evidence.",
    };
  }
  if (/text-on-dark/.test(role) && /text-2|text-3|muted|default-6/i.test(replacement)) {
    return {
      type: "low-contrast-token-on-dark",
      message: "Dark/complex backgrounds need high-contrast text token or local text variable, not muted/body token.",
    };
  }
  if (/text-on-light/.test(role) && /primary|accent|color-main/i.test(replacement) && !antiScopes.some((item) => /text-on-dark|control/.test(item))) {
    return {
      type: "brand-accent-used-as-body-text",
      message: "Light-surface body text should not blindly use brand accent. Preserve readable body token and scope accent to emphasis/control.",
    };
  }
  return null;
}

function scanCssRoleReplacementLeaks(text, file) {
  const blocking = [];
  const warnings = [];
  const blocks = extractCssBlocks(text);
  for (const block of blocks) {
    const selector = block.selector;
    const body = block.body;
    const normalizedSelector = selector.replace(/\s+/g, " ");
    const isDocSurface = /(?:^|[\s>,])(?:code|pre)\b|\.style-button-demo-group\b|\.style-(?:icon|button)-usage\s+code\b|\.component-doc-section\b|\.component-editable-controls\s+label\b|\.component-schema-preview\b|\.style-capability-note\b|\.computed-evidence-chain\b|\.style-inventory-row\b|\.style-mockup-preview\b|\.recipe-placeholder\b/.test(normalizedSelector);
    if (isDocSurface && /--style-control-radius(?:-base)?|--layout-control-radius/.test(body)) {
      blocking.push({
        type: "css-control-radius-leaked-to-doc-surface",
        file,
        selector,
        message: "Doc/code/example selectors must not use control radius. Use doc/card radius instead.",
      });
    }
    if (/\.phone\b/.test(normalizedSelector) && /(?:\bspan\b|\bp\b|\bsmall\b)/.test(normalizedSelector) && /\bcolor\s*:/.test(body)) {
      warnings.push({
        type: "broad-phone-text-color",
        file,
        selector,
        message: "Broad .phone text color overrides often break text-on-dark/text-on-light roles. Prefer role-scoped selectors.",
      });
    }
    if (isDocSurface && /background\s*:\s*linear-gradient\([^;]+rgba?\([^;]+0\.[3-9]/i.test(body) && /theme-|phone/.test(normalizedSelector)) {
      warnings.push({
        type: "doc-surface-heavy-overlay",
        file,
        selector,
        message: "Doc surfaces should not gain heavy readability overlays unless source computed evidence has a similar container.",
      });
    }
  }
  return { blocking, warnings };
}

function extractCssBlocks(text) {
  const blocks = [];
  const pattern = /([^{}@][^{}]*?)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  for (const match of text.matchAll(pattern)) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (!selector || !body) continue;
    if (/^(from|to|\d+%|if|for|while|switch)\b/.test(selector)) continue;
    blocks.push({ selector, body });
  }
  return blocks;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 brand-guard site-evidence collector",
      accept: "text/html,text/css,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

function extractStylesheetUrls(html, baseUrl) {
  const urls = [];
  for (const match of String(html || "").matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)) {
    const href = match[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      urls.push(new URL(href, baseUrl).toString());
    } catch {}
  }
  return unique(urls);
}

function collectCssColorSamples(doc, options = {}) {
  const text = String(doc.text || "");
  const scope = options.scope || "";
  const samples = [];
  const varPattern = /(--[\w-]*(?:color|bg|background|text|border|shadow|fill|surface|primary|default|white|black|neutral|yellow|orange|blue|green|red|purple|gold)[\w-]*)\s*:\s*([^;{}]+)/gi;
  if (!scope) {
    for (const match of text.matchAll(varPattern)) {
      for (const color of extractColorValues(match[2])) {
        const role = inferRole(`${match[1]} ${match[2]}`, "token");
        samples.push({
          color,
          role,
          weight: roleWeight(role) + 1,
          source: doc.url,
          context: match[1],
        });
      }
    }
  }

  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;
  for (const match of text.matchAll(rulePattern)) {
    const selector = match[1].trim().replace(/\s+/g, " ").slice(0, 180);
    const body = match[2];
    if (scope && !cssRuleMatchesScope(selector, body, scope)) continue;
    const colors = extractColorValues(body);
    if (!colors.length) continue;
    const role = inferRole(`${selector} ${body}`, "css");
    const propertyBoost = inferPropertyBoost(body);
    for (const color of colors) {
      samples.push({
        color,
        role,
        weight: roleWeight(role) + propertyBoost,
        source: doc.url,
        context: selector,
      });
    }
  }
  return samples;
}

function cssRuleMatchesScope(selector, body, scope) {
  const escaped = escapeRegExp(scope);
  return new RegExp(`(theme-${escaped}|\\b${escaped}[-_]|\\.${escaped}\\b)`, "i").test(`${selector} ${body}`);
}

function collectHtmlColorSamples(doc) {
  const text = String(doc.text || "");
  const samples = [];
  for (const match of text.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1];
    const attrs = match[2] || "";
    const style = attrs.match(/\bstyle=["']([^"']+)["']/i)?.[1] || "";
    const className = attrs.match(/\bclass=["']([^"']+)["']/i)?.[1] || "";
    const colors = extractColorValues(`${style} ${className}`);
    if (!colors.length) continue;
    const role = inferRole(`${tag} ${className} ${style}`, "html");
    for (const color of colors) {
      samples.push({
        color,
        role,
        weight: roleWeight(role) + inferPropertyBoost(style),
        source: doc.url,
        context: `${tag}${className ? `.${className.split(/\s+/).slice(0, 3).join(".")}` : ""}`.slice(0, 180),
      });
    }
  }
  return samples;
}

function collectComputedColorSamples(doc) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(doc.text || ""));
  } catch {
    return [];
  }
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
  const samples = [];
  for (const entry of entries) {
    const role = entry.role || inferRole(`${entry.selector || ""} ${entry.label || ""} ${entry.className || ""}`, "computed");
    const styles = entry.styles || entry.computed || entry;
    const fields = [
      "color",
      "backgroundColor",
      "borderColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "outlineColor",
      "boxShadow",
      "textShadow",
      "backgroundImage",
    ];
    for (const field of fields) {
      const value = styles?.[field];
      if (!value || value === "none" || value === "rgba(0, 0, 0, 0)") continue;
      for (const color of extractColorValues(value)) {
        samples.push({
          color,
          role,
          weight: roleWeight(role) + computedFieldBoost(field),
          source: doc.url,
          context: `${entry.selector || entry.label || "computed"} ${field}`.slice(0, 180),
        });
      }
    }
  }
  return samples;
}

function extractColorValues(text) {
  const out = [];
  const raw = String(text || "");
  for (const match of raw.matchAll(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi)) out.push(match[0]);
  for (const match of raw.matchAll(/rgba?\(\s*([^)]+)\)/gi)) out.push(`rgb(${match[1]})`);
  return out;
}

function computedFieldBoost(field) {
  return {
    backgroundColor: 1.2,
    backgroundImage: 0.8,
    color: 0.8,
    borderColor: 0.6,
    borderTopColor: 0.6,
    borderRightColor: 0.6,
    borderBottomColor: 0.6,
    borderLeftColor: 0.6,
    outlineColor: 0.5,
    boxShadow: 0.4,
    textShadow: 0.3,
  }[field] || 0;
}

function normalizeColorSample(sample) {
  const rgb = parseColor(sample.color);
  if (!rgb) return null;
  const hex = rgbToHex(rgb);
  const classified = classifyColor(rgb);
  return {
    ...sample,
    hex,
    rgb,
    family: classified.family,
    hue: round(classified.hue),
    saturation: round(classified.saturation),
    lightness: round(classified.lightness),
  };
}

function parseColor(value) {
  const text = String(value || "").trim();
  if (text.startsWith("#")) return parseHexColor(text);
  const rgbMatch = text.match(/rgba?\(\s*([^)]+)\)/i);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3).map((part) => {
    if (part.endsWith("%")) return Math.round(Number(part.slice(0, -1)) * 2.55);
    return Number(part);
  });
  if (parts.length < 3 || parts.some((item) => !Number.isFinite(item))) return null;
  return { r: clamp(Math.round(parts[0]), 0, 255), g: clamp(Math.round(parts[1]), 0, 255), b: clamp(Math.round(parts[2]), 0, 255) };
}

function parseHexColor(value) {
  let hex = String(value || "").replace(/^#/, "").trim();
  if (hex.length === 3 || hex.length === 4) hex = hex.split("").slice(0, 3).map((part) => part + part).join("");
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((item) => clamp(item, 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToRgb(hex) {
  return parseHexColor(hex) || { r: 0, g: 0, b: 0 };
}

function classifyColor(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  let family = "neutral";
  if (l <= 0.14) family = h >= 20 && h <= 65 && s >= 0.12 ? "black-brown" : "black";
  else if (l >= 0.92 && s <= 0.18) family = "white";
  else if (s <= 0.1) family = "neutral";
  else if (h < 12 || h >= 345) family = "red";
  else if (h < 32) family = l < 0.48 ? "brown-orange" : "orange";
  else if (h < 65) family = l < 0.5 && s < 0.65 ? "brown-gold" : "yellow-gold";
  else if (h < 155) family = "green";
  else if (h < 195) family = "cyan";
  else if (h < 255) family = "blue";
  else if (h < 300) family = "purple";
  else family = "pink";
  return { family, hue: h, saturation: s, lightness: l };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function inferRole(text, fallback = "unknown") {
  const value = String(text || "").toLowerCase();
  if (/(button|btn|cta|primary|action|active|selected|download|play|reserve|预约|下载|领取|按钮|选中)/i.test(value)) return "cta-active";
  if (/(nav|header|topbar|menu|tabbar|navigation|导航|菜单)/i.test(value)) return "navigation";
  if (/(hero|banner|jumbotron|mainvisual|kv|首屏|主视觉)/i.test(value)) return "hero";
  if (/(card|panel|surface|sheet|modal|popup|container|box|卡片|面板|容器)/i.test(value)) return "surface";
  if (/(title|heading|headline|text|copy|font|label|标题|正文|文字)/i.test(value)) return "text";
  if (/(border|divider|line|outline|frame|shadow|分割|边框|描边|阴影)/i.test(value)) return "frame";
  if (/(img|image|asset|background-image|url\(|picture|media|插画|图片|素材)/i.test(value)) return "asset";
  if (fallback === "token") return "token";
  return "unknown";
}

function roleWeight(role) {
  return {
    "cta-active": 5,
    navigation: 4,
    hero: 4,
    surface: 3,
    text: 3,
    frame: 2,
    token: 2,
    asset: 1,
    unknown: 1,
  }[role] || 1;
}

function inferPropertyBoost(text) {
  const value = String(text || "").toLowerCase();
  let boost = 0;
  if (/background|background-color|fill/.test(value)) boost += 0.8;
  if (/color\s*:|border-color|box-shadow|text-shadow/.test(value)) boost += 0.4;
  if (/url\(|background-image|mask|image/.test(value)) boost -= 0.4;
  return boost;
}

function decideDominantTone(familyScores, samples, minConfidence) {
  const total = Object.values(familyScores).reduce((sum, value) => sum + value, 0) || 1;
  const family = (name) => familyScores[name] || 0;
  const blackGold = family("black-brown") + family("black") * 0.72 + family("brown-gold") + family("yellow-gold") + family("brown-orange") * 0.8 + family("orange") * 0.55;
  const blueSky = family("blue") + family("cyan") + family("white") * 0.35;
  const green = family("green");
  const purple = family("purple") + family("pink") * 0.45;
  const candidates = [
    { result: "black-gold", score: blackGold },
    { result: "blue-sky", score: blueSky },
    { result: "green", score: green },
    { result: "purple", score: purple },
  ].sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const second = candidates[1] || { score: 0, result: "" };
  const confidence = round(Math.min(0.98, Math.max(0, (top.score / total) * 0.7 + ((top.score - second.score) / total) * 0.5)));
  const topFamilies = Object.entries(familyScores).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, score]) => ({ family: key, score: round(score) }));
  const roleCounts = countBy(samples, (sample) => sample.role);
  return {
    result: top.score > 0 ? top.result : "",
    confidence,
    minConfidence,
    topFamilies,
    competingTone: second.result,
    competingScore: round(second.score),
    reason: buildToneReasons(top.result, topFamilies, roleCounts),
    assetCaveat: "Image/asset colors are intentionally down-weighted. They prove media atmosphere, not UI token dominance.",
  };
}

function buildToneReasons(result, topFamilies, roleCounts) {
  const reasons = [];
  if (result === "black-gold") reasons.push("Dark/brown canvas plus yellow/gold action colors outscore blue/cyan evidence.");
  if (result === "blue-sky") reasons.push("Blue/cyan and white evidence dominate UI roles.");
  if (result === "green") reasons.push("Green evidence dominates action/surface roles.");
  if (result === "purple") reasons.push("Purple/pink evidence dominates action/surface roles.");
  const importantRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([role]) => role);
  if (importantRoles.length) reasons.push(`Evidence came mainly from ${importantRoles.join(", ")} roles.`);
  if (topFamilies.length) reasons.push(`Top color families: ${topFamilies.map((item) => `${item.family} ${item.score}`).join(", ")}.`);
  return reasons;
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function writeManifest(root, data) {
  const dir = path.join(root, "migrations", "_brand-rollbacks");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = data.createdAt.replace(/[:.]/g, "-");
  const historical = path.join(dir, `${stamp}.json`);
  const latest = path.join(dir, "latest.json");
  fs.writeFileSync(historical, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(latest, `${JSON.stringify(data, null, 2)}\n`);
  return latest;
}

function cleanRollbackResidue(root, brand = "") {
  if (!isGitRepo(root)) return [];
  const untracked = (git(root, ["ls-files", "--others", "--exclude-standard"]) || "")
    .split(/\r?\n/)
    .filter(Boolean);
  const removable = untracked.filter((item) => isRollbackResiduePath(item, brand));
  const topLevel = unique(removable.map((item) => normalizeResidueRoot(item, brand)));
  const removed = [];
  for (const item of topLevel) {
    const full = path.join(root, item);
    if (!fs.existsSync(full)) continue;
    fs.rmSync(full, { force: true, recursive: true });
    removed.push(item);
  }
  return removed;
}

function isRollbackResiduePath(item, brand = "") {
  if (item === ".agents" || item.startsWith(".agents/") || item.startsWith("migrations/_brand-rollbacks/")) return true;
  if (!brand) return false;
  const escaped = escapeRegExp(brand);
  return new RegExp(`^migrations/${escaped}(?:/|$)`, "i").test(item)
    || new RegExp(`^src/styles/.*${escaped}.*\\.(css|scss|sass|less|ts|js)$`, "i").test(item)
    || new RegExp(`^src/pages/.*${escaped}.*(?:/|\\.(vue|tsx?|jsx?|css|scss|sass|less)$)`, "i").test(item)
    || new RegExp(`^src/(views|routes|components)/.*${escaped}.*`, "i").test(item)
    || new RegExp(`^(pages|views|routes|components)/.*${escaped}.*`, "i").test(item);
}

function normalizeResidueRoot(item, brand = "") {
  if (item === ".agents" || item.startsWith(".agents/")) return ".agents";
  if (brand && new RegExp(`^migrations/${escapeRegExp(brand)}(?:/|$)`, "i").test(item)) return `migrations/${brand}`;
  const pageMatch = item.match(/^(src\/pages\/[^/]+).*$/);
  if (pageMatch && brand && new RegExp(escapeRegExp(brand), "i").test(pageMatch[1])) return pageMatch[1];
  return item;
}

function parseIntentPlan(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1]);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {}
  }
  return null;
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`);
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return safeRead(file)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function readBrandSkillConfig() {
  const file = brandSkillConfigPath();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function brandSkillConfigPath() {
  return opt("--config", path.join(homeDir(), ".codex", "brand-skill", "config.json"));
}

function parseSource(value) {
  try {
    const url = new URL(value);
    return { host: url.hostname, protocol: url.protocol.replace(/:$/, "") };
  } catch {
    return { host: "", protocol: "" };
  }
}

function createStandardDemoPreview({ brand, label, sourceUrl, sourceHost, styleReference }) {
  const createdAt = new Date().toISOString();
  const primary = "#7c66ff";
  const bg2 = "#f7f7f9";
  const bg1 = "#ffffff";
  const text1 = "#000000e0";
  const text3 = "#00000066";
  const border = "#0000001f";
  return {
    schema: "brand-standard-demo-preview/v1",
    brand,
    sourceUrl,
    sourceHost,
    createdAt,
    status: "draft-needs-evidence",
    styleReference,
    preset: {
      id: brand,
      label,
      icon: "/favicon.svg",
      source: sourceHost ? `${sourceHost} / website evidence draft` : sourceUrl,
      hero: label,
      notice: `${label} 官网风格能力预览：先用标准 demo 壳检查颜色、字体、圆角、边框、阴影、资产、动效和状态是否形成完整视觉语言。`,
      evidenceNote: "这是自动生成的标准 demo 草稿，不等同最终 style pack；需要继续补官网 CSS、截图、资产和 computed diff 后才能推广到业务项目。",
      sectionTitle: `${label} Preview`,
      tabs: ["首页", "资讯", "展示"],
      cards: [
        { title: "标准 demo 预览", copy: "先在 demo 站里看风格能力，不在业务项目里临时造 preview route。" },
        { title: "业务应用前置", copy: "demo gate 通过后，再把同一套 token / recipe / selector-map 应用到业务项目默认入口。" },
      ],
      tokens: [
        { name: "--du-bg-2", value: bg2 },
        { name: "--du-bg-1", value: bg1 },
        { name: "--du-text-1", value: text1 },
        { name: "--du-text-3", value: text3 },
        { name: "--du-border-1", value: border },
        { name: "--du-primary-color", value: primary },
        { name: "--du-primary-border", value: primary },
        { name: "--du-primary-outline-color", value: primary },
        { name: "--du-primary-soft-bg", value: "#f2f0ff" },
        { name: "--du-primary-solid-bg", value: primary },
      ],
      style: {
        cardRadius: "12px",
        controlRadius: "999px",
        pageSpacing: "16px",
        cardShadow: "none",
        media: `linear-gradient(135deg, ${bg2}, ${bg1} 52%, ${primary})`,
      },
      signals: [
        { raw: sourceHost || sourceUrl, count: 1, percent: "source", target: "brand evidence", value: "等待采集 CSS / 截图 / 资产后替换为真实证据。" },
        { raw: "styleReference", count: 1, percent: "template", target: String(styleReference), value: "表达模板来自 demo 站 golden / styleReference 站点。" },
      ],
    },
    pages: defaultStandardDemoPages(brand),
    styleRecipeDetails: defaultStandardStyleRecipes(label),
    componentCoverage: {
      actualUsed: unique(defaultStandardDemoPages(brand).flatMap((page) => page.components)),
      inheritedBaseline: ["NavigationBar", "Search", "Tabs", "Button", "Tag", "Image", "Avatar", "Popup", "Input", "Textarea", "Select", "Switch", "Upload", "BottomBar"],
      missingOrNeedsUpdate: ["HeroHeader", "Grid", "List", "Feed", "SPU", "FAB", "TabBar", "BottomBar"],
      note: "组件 tab 默认看实际用到的组件；其他未显性使用的组件继承 DangoUI baseline，并在缺口里说明。",
    },
    coverage: {
      dimensions: ["color", "font", "radius", "border", "shadow", "frame-or-asset", "active-state"],
      level: "standard-demo-draft",
      gate: "structure-ready-evidence-pending",
    },
  };
}

function defaultStandardDemoPages(brand) {
  return [
    { id: `${brand}-home`, side: "distribution", tab: "首页", name: "首页", kind: "数据输出", description: "官网/品牌首页预览：检查首屏、分发入口、搜索/导航、主行动和内容流。", components: ["NavigationBar", "Search", "HeroHeader", "Grid", "Tabs", "Feed", "Button"] },
    { id: `${brand}-news`, side: "distribution", tab: "资讯公告", name: "资讯公告", kind: "数据输出", description: "资讯/活动列表预览：检查 Swiper、Tabs、Card、Tag、Button 和列表节奏。", components: ["NavigationBar", "Swiper", "Tabs", "Card", "Tag", "Button"] },
    { id: `${brand}-media`, side: "display", tab: "影像资料", name: "影像资料", kind: "数据输出", description: "媒体展示预览：检查 Image、Swiper、资产层、边框/frame 和展示容器。", components: ["NavigationBar", "Image", "Swiper", "Card", "Tag"] },
    { id: `${brand}-detail`, side: "display", tab: "详情页", name: "详情页", kind: "数据输出", description: "对象详情预览：检查图片、头像、指标、列表和底部操作。", components: ["NavigationBar", "Image", "Avatar", "List", "PriceStatistic", "BottomBar"] },
    { id: `${brand}-publish`, side: "publish", tab: "发布侧", name: "发布侧", kind: "数据输入", description: "发布表单预览：检查 Input、Textarea、Upload、Select、Switch、Button 和 BottomBar 的风格继承。", components: ["NavigationBar", "Input", "Textarea", "Upload", "Select", "Switch", "Button", "BottomBar"] },
  ];
}

function defaultStandardStyleRecipes(label) {
  return {
    color: [
      { title: "主色", kind: "token", operatorLabel: "主行动色：用于按钮、选中态和高优先级入口", value: "待采样", usage: "Button / Tabs active / Tag primary", anti: "不要只换一个按钮色就声称完成风格化。", note: "从官网高频 CTA、选中态、链接和强调色采样后覆盖。", affiliation: `${label} token 覆盖 · 待采样` },
      { title: "页面底色", kind: "token", operatorLabel: "页面底色：决定整体明暗和品牌气质", value: "待采样", usage: "页面 bg-2 / 大面积底色", anti: "不要让业务项目旧背景残留。", note: "从官网首屏、内容区和弹层底色采样后覆盖。", affiliation: `${label} token 覆盖 · 待采样` },
    ],
    typography: [
      { title: "标题字体", kind: "token", operatorLabel: "标题字体：决定页面第一眼像不像这个品牌", value: "system fallback", usage: "Hero / section title / Card title", anti: "不要远程字体不可用就阻塞预览。", note: "先降级系统字体，后续补本地字体资产。", affiliation: `${label} 字体 · 待采样` },
    ],
    radius: [
      { title: "容器圆角", kind: "token", operatorLabel: "容器圆角：卡片和内容块要统一", value: "12px draft", usage: "Card / Group / media", anti: "不要被按钮胶囊圆角反向污染容器。", note: "后续根据官网卡片/媒体/控件分别替换。", affiliation: `${label} radius · 待采样` },
    ],
    shadow: [
      { title: "层级阴影", kind: "token", operatorLabel: "阴影：只在品牌确实有层级时使用", value: "none draft", usage: "Card / Popup / FAB", anti: "不要为了显眼自动加厚阴影。", note: "没有证据时先保持 none。", affiliation: `${label} shadow · 待采样` },
    ],
    divider: [
      { title: "普通边界", kind: "token", operatorLabel: "普通边界：列表、卡片、信息组的分隔线", value: "1px draft", usage: "Divider / Card boundary / List row", anti: "不要把装饰框和普通分割线混为一谈。", note: "后续区分普通 border、选中线、frame 和图片边框。", affiliation: `${label} divider · 待采样` },
      { title: "风格化 Frame", kind: "style", operatorLabel: "风格化边框：给需要强调的父容器，不是所有卡片都加", value: "待采样", usage: "Hero media / campaign panel / detail panel", anti: "不要全站所有框都套特殊边框。", note: "从官网 frame、角线、mask、边框资产提取。", affiliation: `${label} style-only Frame · 待采样` },
    ],
    asset: [
      { title: "主视觉资产", kind: "style", operatorLabel: "主视觉资产：让页面第一眼有品牌气质", value: "待采集", usage: "Hero / media / page background", anti: "不要搬官方业务内容；可以抽象纹理、frame、背景层。", note: "等待官网截图/资产采集后接入。", affiliation: `${label} asset · 待采集` },
    ],
    motion: [
      { title: "点击反馈", kind: "token", operatorLabel: "点了要有轻反馈：让用户知道操作生效", value: "120-180ms draft", usage: "Button / Card / List item", anti: "不要用大幅位移或厚阴影模拟反馈。", note: "先继承 DangoUI baseline，后续按官网动效证据调整。", affiliation: `${label} motion · baseline` },
      { title: "品牌氛围动效", kind: "style", operatorLabel: "氛围动效：只给背景/光效/素材层，不让内容乱动", value: "待采样", usage: "Hero / background / asset layer", anti: "不要给表单和列表加装饰动效。", note: "需要源站动效证据。", affiliation: `${label} style-only motion · 待采样` },
    ],
    button: [
      { title: "主按钮", kind: "token", operatorLabel: "主按钮：承接品牌主色和行动语气", value: "primary draft", usage: "提交、查看、购买、报名", anti: "不要用图片按钮替代可访问的 Button，除非源站有明确资产证据。", note: "先用 DuButton，后续补状态和资产。", affiliation: `${label} Button · baseline + token` },
    ],
    layout: [
      { title: "标准页面壳", kind: "token", operatorLabel: "页面布局：先用通栏/卡片/双列/发布表单检查节奏", value: "5 pages draft", usage: "首页、资讯、影像、详情、发布侧", anti: "不要在业务项目里临时造非标准 preview route。", note: "标准 demo 通过后再做业务 apply。", affiliation: `${label} Layout · standard demo` },
    ],
  };
}

function upsertDemoRegistry(registryPath, entry) {
  const registry = fs.existsSync(registryPath)
    ? JSON.parse(safeRead(registryPath) || "{}")
    : { schema: "brand-preview-registry.v0.2", access: { read: "public", authentication: "none", write: "curated-pull-request" }, brands: [] };
  const brands = Array.isArray(registry.brands) ? registry.brands.filter((item) => item.id !== entry.id) : [];
  brands.push({
    version: "0.0.0-draft",
    publicationStatus: "draft",
    canonicalSources: entry.sourceUrl ? [entry.sourceUrl] : [],
    artifactFiles: [],
    platformSupport: {
      web: "unverified",
      taroH5: "planned",
      weapp: "unverified",
      ios: "unverified",
      android: "unverified",
      flutter: "unverified",
      harmonyos: "unverified",
    },
    reusePolicy: { metadataAndRules: "review-required", runtimeAssets: "review-required" },
    ...entry,
    updatedAt: new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify({
    ...registry,
    schema: "brand-preview-registry.v0.2",
    access: registry.access || { read: "public", authentication: "none", write: "curated-pull-request" },
    brands,
  }, null, 2)}\n`);
}

function registryHasBrand(registryPath, brand) {
  if (!fs.existsSync(registryPath)) return false;
  const registry = JSON.parse(safeRead(registryPath) || "{}");
  return Array.isArray(registry.brands) && registry.brands.some((item) => item.id === brand);
}

function hasPreviewShellData(preview) {
  return Boolean(preview?.preset?.id)
    && Array.isArray(preview.pages)
    && preview.pages.length >= 3
    && preview.styleRecipeDetails
    && Object.keys(preview.styleRecipeDetails).length >= 7
    && preview.componentCoverage
    && Array.isArray(preview.componentCoverage.actualUsed);
}

function displayLabelFromBrand(brand) {
  return String(brand || "Brand")
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

function parseBool(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value == null || value === "") return false;
  return /^(1|true|yes|y)$/i.test(String(value));
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function countBy(values, getKey) {
  const out = {};
  for (const value of values) {
    const key = getKey(value);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function sortCountMap(map) {
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1]));
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || process.cwd();
}

function listFiles(root, pattern) {
  const ignored = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", "coverage"]);
  const out = [];
  walk(root);
  return out;

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(full)) out.push(full);
    }
  }
}

function detectDefaultEntry(root) {
  const configCandidates = [
    "src/app.config.ts",
    "src/app.config.js",
    "app.config.ts",
    "app.config.js",
    "src/pages.json",
    "pages.json",
    "src/app.json",
    "app.json",
  ].map((item) => path.join(root, item));

  for (const configPath of configCandidates) {
    if (!fs.existsSync(configPath)) continue;
    const text = safeRead(configPath);
    const pages = extractPagesArray(text);
    if (pages.length) {
      const page = pages[0];
      const files = resolvePageFiles(root, page);
      return {
        ok: files.length > 0,
        framework: isTaroProject(root, text) ? "taro" : "unknown",
        config: path.relative(root, configPath),
        route: page,
        files: files.map((file) => path.relative(root, file)),
        source: "pages[0]",
        message: files.length
          ? "Default entry resolved from pages[0]. Use these files for scan-host-debt and selector-map."
          : "pages[0] found, but no matching source file was located.",
      };
    }
  }

  const fallbackFiles = [
    "src/pages/index/index.vue",
    "src/pages/index/index.tsx",
    "src/pages/index/index.jsx",
    "src/pages/index/index.js",
    "src/pages/HomePage.vue",
    "src/App.vue",
  ].map((item) => path.join(root, item)).filter((file) => fs.existsSync(file));

  return {
    ok: fallbackFiles.length > 0,
    framework: isTaroProject(root, "") ? "taro" : "unknown",
    config: "",
    route: fallbackFiles.length ? path.relative(root, fallbackFiles[0]).replace(/^src\//, "").replace(/\.(vue|tsx|jsx|js|ts)$/, "") : "",
    files: fallbackFiles.slice(0, 1).map((file) => path.relative(root, file)),
    source: fallbackFiles.length ? "fallback" : "not-found",
    message: fallbackFiles.length
      ? "No app pages config found; fallback entry was used."
      : "No default entry found. Pass --files explicitly.",
  };
}

function extractPagesArray(text) {
  const json = tryParseJsonLike(text);
  if (Array.isArray(json?.pages)) return json.pages;
  const match = text.match(/pages\s*:\s*\[([\s\S]*?)\]/m) || text.match(/"pages"\s*:\s*\[([\s\S]*?)\]/m);
  if (!match) return [];
  return [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((item) => item[1]);
}

function tryParseJsonLike(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const assignment = text.match(/(?:window\.__taroAppConfig\s*=\s*|export\s+default\s+)(\{[\s\S]*\})/m);
  if (!assignment) return null;
  const raw = assignment[1]
    .replace(/defineAppConfig\(/g, "")
    .replace(/\)\s*;?\s*$/g, "");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolvePageFiles(root, page) {
  const bases = [
    page,
    `src/${page}`,
  ];
  const suffixes = [".vue", ".tsx", ".jsx", ".ts", ".js", "/index.vue", "/index.tsx", "/index.jsx", "/index.ts", "/index.js"];
  const files = [];
  for (const base of bases) {
    for (const suffix of suffixes) {
      const candidate = path.join(root, `${base}${suffix}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) files.push(candidate);
    }
  }
  return unique(files);
}

function isTaroProject(root, configText = "") {
  if (/taro/i.test(configText)) return true;
  const packagePath = path.join(root, "package.json");
  const pkg = safeRead(packagePath);
  return /@tarojs|taro/i.test(pkg);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy(values, getKey) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = getKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function isTailwindVisualClass(name) {
  return /^(bg|text|border|from|via|to|ring|shadow|rounded|decoration|outline|fill|stroke)-/.test(name)
    && (/\[[^\]]+\]/.test(name)
      || /^(bg|text|border|from|via|to|ring|decoration|outline|fill|stroke)-(white|black|transparent|current|red|orange|yellow|green|blue|purple|pink|slate|gray|zinc|neutral|stone)-?/.test(name));
}

function extractTailwindValues(name) {
  const arbitrary = [...name.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].replace(/_/g, " "));
  const colors = [...name.matchAll(/#(?:[0-9a-fA-F]{3,8})\b/g)].map((match) => match[0]);
  const named = name.match(/^(bg|text|border|from|via|to|ring|decoration|outline|fill|stroke)-(white|black|transparent|current|red|orange|yellow|green|blue|purple|pink|slate|gray|zinc|neutral|stone)(?:-\d+)?$/);
  return unique([...arbitrary, ...colors, named ? name : ""]);
}

function extractInlineStyleBindings(text) {
  return [...text.matchAll(/\b(?::style|v-bind:style|style)\s*=\s*(["'`])([\s\S]*?)\1/g)]
    .map((match) => ({ value: match[2], index: match.index || 0 }));
}

function classifyInlineStyleBinding(binding) {
  const value = binding.value;
  const semantic = /(TYPE_HEX|TYPE_COLOR|STATUS_COLOR|COLOR_MAP|ColorMap|ColourMap|typeColor|typeHex|statusColor|statusColorMap|colorMap|colors?\s*\[|colours?\s*\[|_HEX\s*\[)/.test(value);
  const complex = /linear-gradient|radial-gradient|border\s*:|borderColor|boxShadow|box-shadow|backgroundImage|mask|clipPath|filter/i.test(value);
  const dynamic = /[?:]|\bif\b|\belse\b|=>|\$\{|computed|\.map\(|\.reduce\(|\[[^\]]+\]/.test(value);
  const uiState = /(active|selected|current|checked|disabled|hover|focus|tab|filter|sort|toggle|switch|show|open|expanded|visible|选中|筛选|切换|属性|形态|培养|经理|S2)/i.test(value);
  const staticVisual = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\(|hsla?\(|\bbackground\s*:|\bcolor\s*:|\bborder-radius\s*:|\bfont-family\s*:/.test(value);
  if (semantic) {
    return {
      ...binding,
      classification: "business-semantic-inline-style",
      fixStrategy: "preserve-semantic",
      rewrite: "Preserve business semantic colors by default. Optionally generate a brand-palette semantic mapping and ask the operator if the meaning still reads correctly.",
    };
  }
  if (complex) {
    return {
      ...binding,
      classification: "complex-inline-visual",
      fixStrategy: "extract-class",
      rewrite: "Add or reuse a semantic class, move gradient/border/shadow/mask to CSS or --style-* recipe, and keep the DOM/content logic unchanged.",
    };
  }
  if (dynamic) {
    return {
      ...binding,
      classification: uiState ? "ui-state-inline-style" : "dynamic-inline-visual",
      fixStrategy: "tokenize-dynamic",
      rewrite: uiState
        ? "Treat as UI state such as tab/filter/selected/disabled. Preserve the interaction condition, but replace active/inactive visual literals with component state tokens such as var(--du-primary-color), var(--du-bg-1), var(--du-text-2), or semantic state tokens."
        : "Preserve conditional/data logic, but replace each visual literal with var(--du-*) / var(--style-*) token expressions.",
    };
  }
  return {
    ...binding,
    classification: staticVisual ? "static-inline-visual" : "inline-visual",
    fixStrategy: "tokenize-inline",
    rewrite: "Replace static inline visual values with var(--du-*) / var(--style-*) token expressions.",
  };
}

function extractSemanticColorMaps(text) {
  const patterns = [
    /\b([A-Z][A-Z0-9_]*(?:HEX|COLOR|COLOUR|COLORS|COLOURS|MAP))\b\s*=\s*(\{[\s\S]{0,1200}?\})/g,
    /\b([a-zA-Z_$][\w$]*(?:Color|Colors|Colour|Colours|ColorMap|ColourMap|TypeHex|TypeColor|StatusColor|statusColor|typeColor|typeHex)[\w$]*)\b\s*[:=]\s*(\{[\s\S]{0,1200}?\})/g,
  ];
  const maps = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const body = match[2] || "";
      if (!/#(?:[0-9a-fA-F]{3,8})\b|rgba?\(|hsla?\(/.test(body)) continue;
      maps.push({
        name: match[1],
        line: lineNumber(text, match.index || 0),
        sample: body.replace(/\s+/g, " ").slice(0, 220),
      });
    }
  }
  return uniqueBy(maps, (item) => `${item.name}:${item.line}`);
}

function buildOperatorAdjustmentGuide(tokenizationPlan, needsReview) {
  const autoApplied = summarizeGuideItems(tokenizationPlan, (item) => {
    if (item.classification === "ui-state-inline-style") {
      return {
        category: "交互状态",
        whatChanged: "按钮、Tab、筛选、开关、选中/禁用等状态视觉已跟随品牌换掉。",
        userWords: "如果不喜欢，可以说：这个选中态不够明显，帮我改回更醒目的状态色，或者更贴近品牌主色。",
      };
    }
    if (item.fixStrategy === "tokenize-dynamic") {
      return {
        category: "动态视觉",
        whatChanged: "带条件判断的颜色、背景或边框已保留原逻辑，只把视觉值换成 token。",
        userWords: "如果不喜欢，可以说：这里的动态颜色逻辑保留，但视觉再轻一点/重一点/更贴近品牌。",
      };
    }
    if (item.fixStrategy === "tokenize-inline") {
      return {
        category: "内联视觉",
        whatChanged: "写在元素 style 上的颜色、背景、圆角或文字样式已改成 token。",
        userWords: "如果不喜欢，可以说：这个元素的颜色/圆角/文字感觉不对，帮我调到更像参考站。",
      };
    }
    if (item.fixStrategy === "extract-class") {
      return {
        category: "复杂装饰",
        whatChanged: "复杂背景、边框、阴影、渐变或遮罩会抽成语义 class 和 style recipe。",
        userWords: "如果不喜欢，可以说：这个装饰太重/太轻，保留结构但换成参考站那种边框或背景。",
      };
    }
    if (item.type === "tailwind-source-tokenization") {
      return {
        category: "工具类视觉",
        whatChanged: "Tailwind / utility 写死的颜色、圆角或阴影已改成 token 化表达。",
        userWords: "如果不喜欢，可以说：这个工具类样式不要直接套品牌色，按当前模块语气再调一下。",
      };
    }
    if (item.type === "css-visual-declaration") {
      return {
        category: "CSS 视觉声明",
        whatChanged: "CSS 里的颜色、背景、边框、圆角、阴影、字体或动效已改成品牌 token/recipe。",
        userWords: "如果不喜欢，可以说：这个区域的背景/边框/阴影不像参考站，请按 demo 站风格原子再调。",
      };
    }
    if (item.type === "hardcoded-visual-value") {
      return {
        category: "写死视觉值",
        whatChanged: "页面里写死的色值、阴影或渐变已改成可换肤的 token。",
        userWords: "如果不喜欢，可以说：这个模块不用这么强的品牌色，保留换肤但降低存在感。",
      };
    }
    return null;
  });

  const needsOperatorDecision = summarizeGuideItems(needsReview, (item) => {
    if (/semantic|business-state/i.test(item.type)) {
      return {
        category: "业务含义色",
        whatChanged: "这些颜色可能代表属性、状态、价格、库存、成功、失败或警告，不应静默覆盖。",
        userWords: "如果不合适，可以说：这里是业务含义色，请保留原来的红/蓝/绿属性色，只换外层 UI 风格。",
      };
    }
    return null;
  });

  return {
    autoApplied,
    needsOperatorDecision,
    finalReplyHint: "Mention autoApplied as adjustable visual changes in plain language. Do not pause for autoApplied. Pause or ask only for needsOperatorDecision.",
  };
}

function summarizeGuideItems(items, classify) {
  const byCategory = new Map();
  for (const item of items) {
    const guide = classify(item);
    if (!guide) continue;
    const current = byCategory.get(guide.category) || {
      ...guide,
      count: 0,
      examples: [],
    };
    current.count += 1;
    if (current.examples.length < 3) {
      current.examples.push({
        file: item.file,
        line: item.line,
        value: item.value || item.property || item.className || item.type,
      });
    }
    byCategory.set(guide.category, current);
  }
  return [...byCategory.values()];
}

function suggestTokenForContext(text, index, value = "") {
  const nearby = text.slice(Math.max(0, index - 120), index + 120);
  if (/linear-gradient|background|bg-|backgroundColor/i.test(nearby) || /gradient/i.test(value)) return "var(--du-bg-1) / var(--du-bg-2) or a --style-* background recipe";
  if (/border/i.test(nearby)) return "var(--du-border-1) or var(--style-frame-border)";
  if (/shadow/i.test(nearby)) return "var(--style-card-shadow)";
  if (/radius|rounded/i.test(nearby)) return "var(--style-card-radius) or var(--style-control-radius)";
  if (/font/i.test(nearby)) return "var(--style-font-family) or brand @font-face fallback";
  if (/color|text/i.test(nearby)) return "var(--du-text-1) / var(--du-text-2) / var(--du-primary-color)";
  return "nearest --du-* / --style-* token based on component role";
}

function suggestTokenForProperty(prop, value = "") {
  const name = String(prop).toLowerCase();
  if (name.includes("background")) return /gradient/i.test(value) ? "brand --style-* background recipe" : "var(--du-bg-1) / var(--du-bg-2)";
  if (name === "color") return "var(--du-text-1) / var(--du-text-2) / semantic token";
  if (name.includes("border-radius")) return "var(--style-card-radius) / var(--style-control-radius)";
  if (name.includes("border")) return "var(--du-border-1) / var(--style-frame-border)";
  if (name.includes("shadow")) return "var(--style-card-shadow)";
  if (name.includes("font")) return "brand font token / @font-face fallback";
  if (name.includes("transition") || name.includes("animation")) return "brand motion recipe";
  return "nearest --du-* / --style-* token";
}

function suggestTokenForTailwindClass(className) {
  if (/^bg-/.test(className)) return "var(--du-bg-1) / var(--du-bg-2) or background recipe";
  if (/^text-/.test(className)) return "var(--du-text-*) / semantic text token";
  if (/^border-/.test(className)) return "var(--du-border-1) / var(--style-frame-border)";
  if (/^rounded-full/.test(className)) return "var(--style-control-radius) only for controls; otherwise var(--style-card-radius)";
  if (/^shadow-/.test(className)) return "var(--style-card-shadow)";
  if (/^(from|via|to)-/.test(className)) return "brand gradient recipe";
  return "nearest --du-* / --style-* token";
}

function suggestTokenForInlineStyle(value) {
  if (/background|linear-gradient|backgroundColor/i.test(value)) return "tokenize background values to --du-bg-* or --style-* recipe";
  if (/border/i.test(value)) return "tokenize border values to --du-border-* or --style-frame-border";
  if (/radius|rounded/i.test(value)) return "tokenize radius to --style-card-radius / --style-control-radius";
  if (/shadow/i.test(value)) return "tokenize shadow to --style-card-shadow";
  if (/font/i.test(value)) return "tokenize font to brand font variables";
  if (/color/i.test(value)) return "tokenize colors to --du-text-* / --du-primary-color / semantic token";
  return "tokenize visual literals while preserving expression logic";
}

function isVisualStyleExpression(value) {
  return /#(?:[0-9a-fA-F]{3,8})\b|rgba?\(|hsla?\(|linear-gradient|background|color|border|radius|shadow|font|opacity|transform|transition|animation/i.test(value);
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function findLateCssImport(cssText) {
  const lines = cssText.split(/\r?\n/);
  let seenCssStatement = false;
  let inBlockComment = false;
  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index].trim();
    if (!line) continue;
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlockComment = true;
      continue;
    }
    if (line.startsWith("//")) continue;
    if (line.startsWith("@charset")) continue;
    if (line.startsWith("@import")) {
      if (seenCssStatement) return { line: index + 1, value: line };
      continue;
    }
    seenCssStatement = true;
  }
  return null;
}

function likelySelectorInHtml(html, selector) {
  const classMatches = [...selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
  if (classMatches.length) {
    return classMatches.every((className) => new RegExp(`class=["'][^"']*\\b${escapeRegExp(className)}\\b`, "i").test(html));
  }
  const attrClassMatch = selector.match(/\[class\*=["']([^"']+)["']\]/);
  if (attrClassMatch) return html.includes(attrClassMatch[1]);
  if (/^[a-z][\w-]*$/i.test(selector)) return new RegExp(`<${escapeRegExp(selector)}\\b`, "i").test(html);
  return html.includes(selector.replace(/^[.#]/, ""));
}

function extractClassNames(text, file = "") {
  const ext = path.extname(file).toLowerCase();
  const templateText = ext === ".vue"
    ? extractBlocks(text, "template").join("\n")
    : text;
  const styleText = ext === ".vue"
    ? extractBlocks(text, "style").join("\n")
    : /\.(css|scss|sass|less)$/i.test(file)
      ? text
      : "";
  const literalClasses = [...templateText.matchAll(/\bclass(?:Name)?=["'`]([^"'`]+)["'`]/g)]
    .flatMap((match) => match[1].split(/\s+/).filter(Boolean));
  const cssClasses = [...styleText.matchAll(/(?:^|[{}\s,>+~])\.([_a-zA-Z][\w-]*)/gm)]
    .map((match) => match[1]);
  return unique([...literalClasses, ...cssClasses])
    .filter((name) => /^[A-Za-z_-][\w-]*$/.test(name))
    .filter((name) => !["vue", "css", "scss", "js", "ts", "html", "svg"].includes(name))
    .sort();
}

function extractLiteralClassNames(text, file = "") {
  const ext = path.extname(file).toLowerCase();
  const sourceText = ext === ".vue"
    ? extractBlocks(text, "template").join("\n")
    : text;
  const staticClasses = [...sourceText.matchAll(/(?:^|[\s<])class(?:Name)?=["'`]([^"'`]+)["'`]/g)]
    .flatMap((match) => match[1].split(/\s+/).filter(Boolean));
  const dynamicClasses = extractDynamicClassBindings(sourceText)
    .flatMap((value) => extractClassLiteralsFromExpression(value));
  return unique([...staticClasses, ...dynamicClasses])
    .map((name) => name.trim())
    .filter(isValidClassName)
    .sort();
}

function extractDynamicClassBindings(text) {
  const pattern = /(?:^|[\s<])(?::class|v-bind:class|:className|v-bind:className)=("([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;
  return [...String(text || "").matchAll(pattern)]
    .map((match) => match[2] ?? match[3] ?? match[4] ?? "")
    .map((value) => value.replace(/\\"/g, "\"").replace(/\\'/g, "'").replace(/\\`/g, "`"));
}

function extractClassLiteralsFromExpression(expression) {
  const out = [];
  for (const match of String(expression || "").matchAll(/["'`]([^"'`]+)["'`]/g)) {
    out.push(...match[1].split(/\s+/).filter(Boolean));
  }
  for (const match of String(expression || "").matchAll(/(?:^|[,{]\s*)([_a-zA-Z][\w-]*)\s*:/g)) {
    out.push(match[1]);
  }
  return out;
}

function isValidClassName(name) {
  if (!/^[A-Za-z_-][\w:-]*$/.test(name)) return false;
  if (/^(true|false|null|undefined|return|if|else|class|style|activeTab|selectedTab|currentTab|index|item|key|value)$/.test(name)) return false;
  if (/[?=()[\]{}.,]/.test(name)) return false;
  return true;
}

function removeBrandRoutes(text, brand) {
  const escaped = escapeRegExp(brand);
  let next = text;
  const objectRoutePatterns = [
    new RegExp(`\\n?\\s*\\{[^{}]*(?:path|url|route)\\s*:\\s*["'\`](/#?)?/${escaped}\\b[^{}]*\\}\\s*,?`, "gis"),
    new RegExp(`\\n?\\s*\\{[^{}]*component\\s*:\\s*${capitalize(escaped)}[A-Za-z]*Page[^{}]*\\}\\s*,?`, "gis"),
  ];
  for (const pattern of objectRoutePatterns) {
    next = next.replace(pattern, "");
  }
  const stringRoutePattern = new RegExp(`\\n?\\s*["'\`](/#?)?/${escaped}\\b[^"'\`]*["'\`]\\s*,?`, "gi");
  next = next.replace(stringRoutePattern, "");
  return next;
}

function extractBlocks(text, tag) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function isGitRepo(root) {
  try {
    return git(root, ["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

function git(root, gitArgs, options = {}) {
  const result = execFileSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
  });
  return typeof result === "string" ? result.trim() : "";
}

function opt(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function has(name) {
  return args.includes(name);
}

function ok(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function extractUrl(text) {
  const match = String(text || "").match(/https?:\/\/\S+/);
  return match ? match[0] : "";
}

function parseDemoBrandUrl(value) {
  if (!value) return null;
  let hash = "";
  try {
    hash = new URL(value).hash || "";
  } catch {
    hash = String(value);
  }
  const match = hash.match(/#?\/brand\/([^/]+)\/pages\/([^/?#]+)/i)
    || String(value).match(/\/brand\/([^/]+)\/pages\/([^/?#]+)/i);
  if (!match) return null;
  return { brand: match[1], pageId: match[2] };
}

function inferBrandKey(value) {
  const text = String(value || "");
  const demo = parseDemoBrandUrl(text);
  if (demo?.brand) return demo.brand;
  try {
    const url = new URL(text);
    const lastPath = url.pathname.split("/").filter(Boolean).at(-1);
    if (lastPath && /^[a-z0-9-]{2,32}$/i.test(lastPath)) {
      return lastPath.toLowerCase();
    }
    const hostPart = url.hostname.split(".").filter((part) => !["www", "com", "cn", "net", "org", "localhost", "127"].includes(part))[0];
    if (hostPart && /^[a-z0-9-]{2,32}$/i.test(hostPart)) return hostPart.toLowerCase();
  } catch {}
  return "";
}

function brandKeyPattern(brand) {
  const escaped = escapeRegExp(brand);
  return new RegExp(`(/${escaped}\\b|${capitalize(brand)}[A-Za-z]*(Page|View|Route|Component)\\b|\\b${escaped}[-_](home|page|route|view|component)\\b)`, "i");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

function scriptPath() {
  return path.relative(process.cwd(), new URL(import.meta.url).pathname);
}

function printHelp() {
  console.log(`brand-guard

Usage:
  node skills/brand/scripts/run-brand-workflow.mjs tpp --mode learn-brand --brand pokemon30 --source-url "https://pokemon30th.com/"
  node skills/brand/scripts/run-brand-workflow.mjs tpp --mode apply-host --brand pokemon30 --source-url "https://pokemon30th.com/" --host-target src/pages/home/index.vue --plan-file plan.json
  node skills/brand/scripts/brand-guard.mjs p0-acceptance --mode apply-host --brand pokemon30 --host-target src/pages/home/index.vue --plan-file migrations/pokemon30/intent-plan.json --preview-url http://127.0.0.1:5173/
  node skills/brand/scripts/brand-guard.mjs checkpoint --brand re1999 --command "/brand <url>"
  node skills/brand/scripts/brand-guard.mjs rollback [--execute] [--force]
  node skills/brand/scripts/brand-guard.mjs workflow-contract --mode learn-brand --source-url "https://pokemon30th.com/"
  node skills/brand/scripts/brand-guard.mjs detect-entry
  node skills/brand/scripts/brand-guard.mjs validate-intent --source-url "<demo-url>" --plan-file plan.txt
  node skills/brand/scripts/brand-guard.mjs create-selector-map --brand re1999 --files src/pages/HomePage.vue
  node skills/brand/scripts/brand-guard.mjs cleanup-preview --brand spotify [--execute]
  node skills/brand/scripts/brand-guard.mjs scan-host-debt --brand hpma --files src/pages/HomePage.vue
  node skills/brand/scripts/brand-guard.mjs scan-css --root .
  node skills/brand/scripts/brand-guard.mjs validate-role-replacements --brand rocom --css-files src/styles.css
  node skills/brand/scripts/brand-guard.mjs coverage-gate --brand rocom --files src/styles/rocom-theme.css,src/pages/index/index.vue --evidence-file migrations/rocom/site-evidence.json
  node skills/brand/scripts/brand-guard.mjs asset-usage-gate --brand rocom --files src/App.vue,src/styles.css
  node skills/brand/scripts/brand-guard.mjs visual-placement-gate --brand rocom --plan-file migrations/rocom/intent-plan.json
  node skills/brand/scripts/brand-guard.mjs evidence-visibility-gate --brand onepiece-cardgame --strict
  node skills/brand/scripts/brand-guard.mjs handoff-artifact-gate --mode learn-brand --brand rocom --strict
  node skills/brand/scripts/brand-guard.mjs external-goodcase-gate --brand rocom --report migrations/rocom/external-goodcase-adoption.json --strict
  node skills/brand/scripts/brand-guard.mjs rule-candidate-gate --brand rocom
  node skills/brand/scripts/brand-guard.mjs resolve-demo
  node skills/brand/scripts/brand-guard.mjs collect-site-evidence --brand rocom --source-url "https://rocom.qq.com/"
  node skills/brand/scripts/brand-guard.mjs collect-rendered-assets --brand rocom --source-url "https://rocom.qq.com/" --html-file rendered.html --css-files page.css
  node skills/brand/scripts/brand-guard.mjs import-dembrandt --brand pokemon30 --input output/extractor-benchmark/pokemon30/dembrandt/result.json
  node skills/brand/scripts/brand-guard.mjs validate-tone --brand rocom
  node skills/brand/scripts/brand-guard.mjs draft-style-pack --brand rocom --source-url "https://rocom.qq.com/"
  node skills/brand/scripts/brand-guard.mjs register-demo-preview --brand rocom --source-url "https://rocom.qq.com/"
  node skills/brand/scripts/brand-guard.mjs demo-gate --brand rocom --demo-root /path/to/DangoUI-Brand-Skill
  node skills/brand/scripts/brand-guard.mjs verify-dom --brand re1999 --html rendered.html
  node skills/brand/scripts/brand-guard.mjs parse-dev-server --log dev.log
  node skills/brand/scripts/brand-guard.mjs validate-final --file final.txt --brand-label "1999" --source-url "<demo-url>" --coverage-level conservative-application
  node skills/brand/scripts/brand-guard.mjs record-run --brand rocom --source-url "https://rocom.qq.com/" --coverage-level complete-style-preview --missing font,asset
  node skills/brand/scripts/brand-guard.mjs tombstone-run --brand rocom --disposition retired --reason "Deleted for clean relearning" --scope project
  node skills/brand/scripts/brand-guard.mjs tombstone-run --run-id <run-id> --disposition invalidated --reason "QA verdict invalidated this run" --scope all
  node skills/brand/scripts/brand-guard.mjs summarize-runs --scope global
  node skills/brand/scripts/brand-guard.mjs issue-retro --scope all --limit 12
  node skills/brand/scripts/brand-guard.mjs score-action-evidence --brand pokemon30 --file migrations/pokemon30/action-evidence-v02.json

Notes:
  - TPP 默认走总入口 run-brand-workflow.mjs；它会先补齐 workflow contract，再串联 TPP gate。
  - 直接运行 brand-guard.mjs tpp-test 只用于脚本调试；如果不是从总入口进来，会被 missing-total-entry 拦下。
`);
}
