#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const array = (value) => Array.isArray(value) ? value : [];

export function deriveHostStartupBaseline({ root, brand }) {
  const startedAt = Date.now();
  const migration = path.join(root, "migrations", brand);
  const startupFile = path.join(migration, "host-startup-page.json");
  if (!fs.existsSync(startupFile)) throw new Error("HOST_STARTUP_PAGE_REQUIRED");
  const startup = JSON.parse(fs.readFileSync(startupFile, "utf8"));
  const hostRoot = path.isAbsolute(startup.hostRoot || "") ? startup.hostRoot : path.resolve(root, startup.hostRoot || ".");
  const sourceFile = path.resolve(hostRoot, startup.sourceFile || "");
  if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) throw new Error("HOST_STARTUP_SOURCE_UNREADABLE");
  const source = fs.readFileSync(sourceFile, "utf8");
  if (sha256(source) !== startup.sourceSha256) throw new Error("HOST_STARTUP_SOURCE_HASH_MISMATCH");

  const template = extractTemplate(source);
  const visibleText = collectVisibleText(template);
  const controls = collectControls(template, visibleText);
  const objects = collectObjects(template, visibleText);
  const fields = collectFields(source, objects);
  const navigationShellContract = collectNavigationShell(template, startup);
  const model = inferDistributionModel(source, controls);
  const scanOrder = inferScanOrder(controls, visibleText, model);
  const resultHierarchyEvidence = inferResultHierarchyEvidence(template, source);
  const primaryObject = objects[0] || "content item";
  const primaryAction = controls.primaryAction || `browse ${primaryObject}`;
  const primaryTask = controls.search
    ? `search, filter and compare ${primaryObject}`
    : `browse and compare ${primaryObject}`;
  const heroSignal = /(?:showcase|featured|recommend|推荐|hero|banner|spotlight)/i.test(source);
  const startupSha256 = sha256(fs.readFileSync(startupFile));
  const facts = {
    schema: "host-startup-facts/v1",
    generatedBy: "deterministic-startup-source-analysis",
    startupPage: { path: path.relative(root, startupFile), sha256: startupSha256, route: startup.route, sourceFile: startup.sourceFile, sourceSha256: startup.sourceSha256 },
    sourceBytes: Buffer.byteLength(source),
    visibleText: visibleText.slice(0, 80),
    controls,
    businessObjects: objects,
    resultFields: fields,
    navigationShellContract,
    informationDistributionModel: model,
    resultHierarchyEvidence,
    expressiveSignals: heroSignal ? ["existing featured/showcase/hero region"] : [],
    limitations: ["source-only analysis", "no runtime measurement receipt", "visual candidates remain unresolved"],
  };
  const baseline = {
    schema: "host-startup-baseline/v1",
    derivationSource: "startup-page-scan",
    hostStartupPageSha256: startupSha256,
    primaryTask,
    primaryAction,
    pageType: `${model} startup page`,
    productiveFloor: { coreEntry: controls.coreEntry, businessObjectsVisible: objects, warmReturnState: "settled" },
    resultContentContract: { mode: "host-schema", fields, readableRowsRequired: true, anonymousSkeletonsForbidden: true },
    hostContentContract: { derivationSource: "startup-page-source-and-render", userInputRequired: false, noCandidateFallback: "productive-ui", visualCandidates: [] },
    informationDistributionContract: {
      model,
      previewUnit: { requiredDecisionFields: fields, openRequiredForBasicJudgment: false },
      scanOrder,
      comparisonBehavior: `compare multiple ${primaryObject} previews using the visible fields before opening details`,
      forbiddenMetaphorSubstitutions: forbiddenSubstitutions(model),
    },
    resultHierarchyContract: {
      derivationSource: "startup-page-source-analysis",
      defaultRelationship: "peer",
      differentiationAllowed: resultHierarchyEvidence.length > 0,
      evidence: resultHierarchyEvidence,
      forbiddenWithoutEvidence: ["featured-result", "ranking", "recommendation", "selected-result", "unequal-preview-scale"],
    },
    navigationShellContract,
    expressiveOpportunity: {
      heroEligible: heroSignal,
      reason: heroSignal ? "startup source already exposes a bounded featured/showcase region before repeated results" : "startup source exposes no proven dedicated expressive region; keep expression inside productive UI",
      maxFirstViewportRatio: heroSignal ? 0.36 : 0.2,
    },
    communicationIntent: {
      framework: "hierarchy-utility-style/v1",
      hierarchy: {
        primaryAttention: controls.coreEntry,
        informativeContent: [primaryObject, ...fields].slice(0, 5),
        efficiencyConstraint: "the primary task entry and comparable real results remain discoverable without decorative detours",
      },
      utility: {
        mainFunction: primaryTask,
        obviousAction: primaryAction,
        conventionConstraint: `preserve the observed ${model} interaction and comparison model`,
      },
      style: {
        sourceConstraint: "derive desired emotional and brand attributes from frozen brand evidence; do not infer them from generic color, rounding or a logo",
        evaluationMode: "first-impression-comparison-after-product-safety-pass",
      },
    },
    deterministicAnalysis: { factsPath: `migrations/${brand}/host-startup-facts.json`, factsSha256: null, runtimeMeasurement: "unavailable" },
  };
  writeJson(path.join(migration, "host-startup-facts.json"), facts);
  baseline.deterministicAnalysis.factsSha256 = sha256(fs.readFileSync(path.join(migration, "host-startup-facts.json")));
  const brief = {
    schema: "fast-host-brief/v1",
    generatedBy: "deterministic-startup-source-analysis",
    hostOpportunity: { primaryTask, pageType: baseline.pageType },
    productiveFloor: baseline.productiveFloor,
    resultContentContract: baseline.resultContentContract,
    expressiveOpportunity: baseline.expressiveOpportunity,
    informationDistributionContract: baseline.informationDistributionContract,
    resultHierarchyContract: baseline.resultHierarchyContract,
    navigationShellContract: baseline.navigationShellContract,
    hostContentContract: baseline.hostContentContract,
    communicationIntent: baseline.communicationIntent,
  };
  writeJson(path.join(migration, "host-startup-baseline.json"), baseline);
  writeJson(path.join(migration, "fast-host-brief.json"), brief);
  return {
    durationMs: Date.now() - startedAt,
    sourceBytes: Buffer.byteLength(source),
    outputs: ["host-startup-facts.json", "host-startup-baseline.json", "fast-host-brief.json"].map((name) => {
      const file = path.join(migration, name);
      return { path: path.relative(root, file), sha256: sha256(fs.readFileSync(file)), bytes: fs.statSync(file).size };
    }),
  };
}

// Keep the startup extractor dependency-free: it is imported by public workflow
// entry points before optional host tooling is needed. This quote-aware source
// scanner does not evaluate JavaScript or resolve component implementations.
function templateNodes(source) {
  const roots = [];
  const stack = [];
  const tags = /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w:-]*(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  for (const match of source.matchAll(tags)) {
    if (match[0].startsWith("<!--")) continue;
    const tag = match[0].match(/^<\/?([\w:-]+)/)[1].toLowerCase();
    if (match[0].startsWith("</")) {
      const index = stack.findLastIndex((node) => node.tag === tag);
      if (index >= 0) {
        for (const node of stack.splice(index)) node.end = match.index;
      }
      continue;
    }
    const attributes = {};
    const raw = match[0].slice(match[0].match(/^<[\w:-]+/)[0].length, -1);
    for (const attribute of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
    }
    const parent = stack.at(-1);
    const node = { tag, attributes, raw, start: match.index, contentStart: match.index + match[0].length, end: source.length, children: [] };
    (parent ? parent.children : roots).push(node);
    if (!/\/\s*>$/.test(match[0]) && !/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)) stack.push(node);
  }
  return roots;
}

function extractTemplate(source) {
  const template = templateNodes(source).find((node) => node.tag === "template");
  return template ? source.slice(template.contentStart, template.end) : source;
}

function navigationConditions(nodes, values, ancestors = []) {
  const result = [];
  let branch = null;
  for (const node of nodes) {
    const attrs = node.attributes;
    const own = [];
    const condition = (directive, expression, negated = false) => {
      const literal = expression === "true" ? true : expression === "false" ? false : undefined;
      const value = literal ?? (Object.hasOwn(values, expression) && typeof values[expression] === "boolean" ? values[expression] : undefined);
      return { directive, expression, negated, sourceLocator: `template-offset:${node.start}`, value: value === undefined ? null : negated ? !value : value };
    };
    if (Object.hasOwn(attrs, "v-if")) {
      const expression = attrs["v-if"].trim();
      own.push(condition("v-if", expression));
      branch = [expression];
    } else if (Object.hasOwn(attrs, "v-else-if") || Object.hasOwn(attrs, "v-else")) {
      if (branch) own.push(...branch.map((expression) => condition("preceding-branch-not-selected", expression, true)));
      else own.push(condition("unresolved-branch-chain", ""));
      if (Object.hasOwn(attrs, "v-else-if")) {
        const expression = attrs["v-else-if"].trim();
        own.push(condition("v-else-if", expression));
        if (branch) branch.push(expression);
      } else branch = null;
    } else branch = null;
    if (Object.hasOwn(attrs, "v-show")) own.push(condition("v-show", attrs["v-show"].trim()));
    const conditions = [...ancestors, ...own];
    result.push({ node, conditions });
    result.push(...navigationConditions(node.children, values, conditions));
  }
  return result;
}

function collectNavigationShell(template, startup) {
  // Optional context is embedded in the hash-bound host-startup-page.json.
  // It records observed expression values, not arbitrary executable code.
  const context = startup.navigationContext;
  if (context && (context.sourceSha256 !== startup.sourceSha256 || !context.conditionValues || typeof context.conditionValues !== "object" || Array.isArray(context.conditionValues))) throw new Error("HOST_NAVIGATION_CONTEXT_INVALID");
  const values = context?.conditionValues || {};
  const items = [];
  const excludedItems = [];
  const seen = new Set();
  for (const { node, conditions } of navigationConditions(templateNodes(template), values)) {
    const attributes = node.raw;
    const handler = node.attributes["@tap"] ?? node.attributes["@click"];
    if (handler === undefined) continue;
    const classValue = attributes.match(/class\s*=\s*["']([^"']+)["']/i)?.[1] || attributes.match(/:class\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    if (!/(?:\bnav\b|tabs?|mine-entry|brand-row|selectTab|openMine|chooseBrand|brandMenu)/i.test(`${classValue} ${handler}`)) continue;
    if (/brand-(?:option|menu|check|mask)/i.test(attributes) && !/brand-row/i.test(attributes)) continue;
    const tail = template.slice(node.contentStart, node.end);
    const directLabels = [tail.match(/^([^<>{}\n]+)/)?.[1], ...[...tail.matchAll(/>([^<>{}\n][^<>{}]*)</g)].map((item) => item[1])].map(cleanShellLabel).filter(Boolean);
    const quotedLabels = [...tail.matchAll(/["'`]([^"'`\n]*[㐀-鿿][^"'`\n]*)["'`]/g)].map((item) => cleanShellLabel(item[1])).filter(Boolean);
    const label = [...directLabels, ...quotedLabels].find((item) => !/^(?:on|open|active|true|false)$/.test(item)) || humanizeIdentifier(handler) || humanizeIdentifier(classValue) || "navigation entry";
    const role = /selectTab|\btab\b|\bpt\b/i.test(`${handler} ${classValue}`) ? "primary-tab"
      : /mine/i.test(`${handler} ${classValue}`) ? "account-entry"
        : /brand/i.test(`${handler} ${classValue}`) ? "brand-switcher"
          : "navigation-entry";
    const base = String(handler || classValue.split(/\s+/)[0] || role).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    let id = `${role}:${base}`;
    // Repeated handlers can belong to different conditional branches. Preserve
    // their distinct source nodes instead of silently dropping a sibling.
    if (seen.has(id)) id += `:offset-${node.start}`;
    seen.add(id);
    const visibility = conditions.some((item) => item.value === false) ? "excluded" : conditions.some((item) => item.value === null) ? "unresolved" : "visible";
    const item = { id, role, label, handler, sourceLocator: `template-offset:${node.start}`, conditions, visibility, requiredInDesignPreview: true };
    if (visibility === "excluded") excludedItems.push({ ...item, requiredInDesignPreview: false, reason: "A source literal or hash-bound startup condition proves this branch is not visible in the frozen startup state." });
    else items.push(item);
  }
  return {
    derivationSource: "startup-page-source-analysis",
    mode: items.length ? "required" : "absent",
    items,
    excludedItems,
    conditionResolution: items.some((item) => item.visibility === "unresolved") ? "unresolved" : "resolved",
    contextBinding: context ? { source: "host-startup-page.json#/navigationContext", sourceSha256: startup.sourceSha256 } : null,
    allowedTreatments: ["native-preserved", "custom-contained", "custom-immersive"],
    continuityPolicy: "Any full-width navigation surface that interrupts an approved continuous scene requires explicit design-host approval in the H5.",
  };
}

function cleanShellLabel(value) {
  const cleaned = String(value || "").replace(/\{\{[\s\S]*?\}\}/g, " ").replace(/\s+/g, " ").trim();
  return cleaned && cleaned.length <= 32 ? cleaned : "";
}

function collectVisibleText(template) {
  const values = [];
  for (const match of template.matchAll(/>([^<>{}\n][^<>{}]*)</g)) pushText(values, match[1]);
  for (const match of template.matchAll(/(?:placeholder|aria-label|title)\s*=\s*["']([^"']+)["']/gi)) pushText(values, match[1]);
  for (const match of template.matchAll(/["'`]([^"'`\n]{2,48})["'`]/g)) {
    if (/[㐀-鿿]/.test(match[1])) pushText(values, match[1]);
  }
  return [...new Set(values)].filter((item) => !/^(?:true|false|null|undefined)$/.test(item));
}

function pushText(values, raw) {
  const value = String(raw || "").replace(/\s+/g, " ").replace(/^[·|｜\s]+|[·|｜\s]+$/g, "").trim();
  if (value.length >= 1 && value.length <= 80) values.push(value);
}

function collectControls(template, text) {
  const placeholders = [...template.matchAll(/placeholder\s*=\s*["']([^"']+)["']/gi)].map((item) => item[1]);
  const search = placeholders.find((item) => /搜索|search|查找|find/i.test(item)) || text.find((item) => /搜索|search|查找|find/i.test(item)) || null;
  const filters = text.filter((item) => /分类|环境|标签|筛选|filter|category|sort/i.test(item)).slice(0, 8);
  const primaryAction = search || text.find((item) => /浏览|打开|查看|browse|open|discover/i.test(item)) || "browse startup content";
  return { search, filters, primaryAction, coreEntry: [search, ...filters].filter(Boolean).join(" + ") || primaryAction };
}

function collectObjects(template, text) {
  const values = [];
  const lexicon = ["牌组", "卡组", "商品", "帖子", "文章", "赛事", "活动", "任务", "订单", "用户", "课程", "视频", "图片"];
  for (const word of lexicon) if (text.some((item) => item.includes(word)) || template.includes(word)) values.push(word === "卡组" ? "牌组" : word);
  for (const match of template.matchAll(/v-for\s*=\s*["'][^"']+\s+in\s+([A-Za-z_$][\w$]*)["']/g)) values.push(humanizeIdentifier(match[1]));
  for (const match of template.matchAll(/<([A-Z][A-Za-z0-9]*(?:Card|Row|Item|Tile|Result|Showcase))\b/g)) values.push(humanizeIdentifier(match[1]));
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].slice(0, 8).length
    ? [...new Set(values.map((item) => item.trim()).filter(Boolean))].slice(0, 8)
    : ["content item"];
}

function collectFields(source, objects) {
  const lexicon = ["牌组封面", "牌组标题", "分类", "环境", "标签", "作者", "收藏数", "浏览数", "赛事标识", "封面", "标题", "名称", "价格", "状态", "时间", "描述", "头像", "统计"];
  const fields = lexicon.filter((item) => source.includes(item.replace(/数$/, "")) || source.includes(item));
  const propertyHints = [...source.matchAll(/\.(title|name|author|avatar|cover|price|status|views|favs|count|date|time|description)\b/gi)].map((item) => humanizeIdentifier(item[1]));
  const merged = [...new Set([...fields, ...propertyHints])];
  const object = objects[0] || "item";
  for (const fallback of [`${object} title`, `${object} preview`, `${object} metadata`]) if (merged.length < 3) merged.push(fallback);
  return merged.slice(0, 10);
}

function inferDistributionModel(source, controls) {
  const hasRepeat = /v-for|\.map\s*\(|forEach\s*\(/.test(source);
  const hasGrid = /grid-template-columns|display\s*:\s*grid|\bgrid\b/i.test(source);
  const hasTable = /<table\b|<thead\b|<tbody\b/i.test(source);
  if (hasTable) return controls.search ? "search-filter-table" : "table";
  if (hasGrid) return controls.search ? "search-filter-grid" : "grid";
  if (hasRepeat) return controls.search ? "search-filter-list" : "previewable-list";
  return controls.search ? "search-results" : "content-detail";
}

function inferScanOrder(controls, text, model) {
  const order = [];
  if (controls.search) order.push("search");
  if (controls.filters.length) order.push("filters");
  if (text.some((item) => /推荐|featured|recommend/i.test(item))) order.push("featured previews");
  order.push(model.includes("list") ? "repeated result previews" : model.includes("grid") ? "grid previews" : "primary content");
  if (order.length < 2) order.unshift("page entry");
  return [...new Set(order)].slice(0, 5);
}

function inferResultHierarchyEvidence(template, source) {
  const evidence = [];
  const add = (collection, kind, signal) => {
    const id = `source-${kind}-${collection}`;
    const offset = source.indexOf(collection);
    const line = offset < 0 ? null : source.slice(0, offset).split("\n").length;
    if (!evidence.some((item) => item.id === id)) evidence.push({ id, kind, signal, source: "startup-page-source", groupId: collection, locator: `collection:${collection}`, sourceRange: line ? { line } : null });
  };
  const identifiers = [...new Set([...source.matchAll(/\b[A-Za-z_$][\w$]*\b/g)].map((match) => match[0]))];
  for (const collection of identifiers) {
    const escaped = collection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isRepeatedBusinessGroup = new RegExp(`(?:v-for=["'][^"']+\\b(?:in|of)\\s+${escaped}\\b|\\b${escaped}\\s*\\[|\\b${escaped}\\.(?:map|slice|filter)\\s*\\()`).test(template);
    if (!isRepeatedBusinessGroup) continue;
    if (/featured|recommend|curated|spotlight|精选|推荐|主推/i.test(collection)) add(collection, "featured-result", `collection ${collection} explicitly names a featured or recommended result group`);
    else if (/ranking|ranked|leaderboard|topResults?|排行|榜单/i.test(collection)) add(collection, "ranking", `collection ${collection} explicitly names a ranked result group`);
    else if (/selected(?:Results?|Items?|Decks?)|current(?:Results?|Items?|Decks?)|pinned(?:Results?|Items?)/i.test(collection)) add(collection, "selected-result", `collection ${collection} explicitly names a selected or pinned result group`);
  }
  return evidence;
}

function forbiddenSubstitutions(model) {
  const alternatives = ["lesson path", "quest board", "mission flow", "dashboard", "carousel-only browsing", "grid substitution"];
  if (model.includes("grid")) return alternatives.filter((item) => item !== "grid substitution").concat("list substitution");
  return alternatives;
}

function humanizeIdentifier(value) {
  return String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_$-]+/g, " ").replace(/\b(items?|results?|list|shown)\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const option = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; };
  try {
    const root = path.resolve(option("--root") || process.cwd());
    const brand = option("--brand");
    if (!brand) throw new Error("--brand is required");
    process.stdout.write(`${JSON.stringify({ ok: true, ...deriveHostStartupBaseline({ root, brand }) }, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  }
}
