#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { deriveHostStartupBaseline } from "./derive-host-startup-baseline.mjs";
import { validateHostStartupBaseline } from "./validate-host-startup-baseline.mjs";
import { validateNavigationShellPreview } from "./finalize-h5-direction-stage.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "derive-host-startup-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const host = path.join(root, "host");
const sourceFile = path.join(host, "src", "pages", "plaza.vue");
fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
fs.mkdirSync(migration, { recursive: true });
fs.writeFileSync(sourceFile, `<template>
  <main class="deck-plaza">
    <nav class="primary-tabs" @click="selectTab('deck')">牌组</nav>
    <button class="mine-entry" @click="openMine">我的</button>
    <section v-if="featuredDecks.length" class="featured-showcase">牌组推荐 {{ featuredDecks[0].title }}</section>
    <input placeholder="搜索牌组" />
    <button>分类</button><button>环境</button>
    <article v-for="item in shownDecks" class="deck-card">
      <img class="牌组封面" /><h2>牌组标题</h2><span>作者</span><span>收藏</span><span>浏览</span>
    </article>
  </main>
</template>`);
const sourceSha256 = sha(sourceFile);
const startupFile = path.join(migration, "host-startup-page.json");
fs.writeFileSync(startupFile, JSON.stringify({ schema: "host-startup-page/v1", hostRoot: "host", route: "/plaza", sourceFile: "src/pages/plaza.vue", sourceSha256, scope: "startup-page-only" }));

const result = deriveHostStartupBaseline({ root, brand });
assert.ok(result.durationMs < 1000, `deterministic analysis took ${result.durationMs}ms`);
assert.equal(result.outputs.length, 3);
const baseline = JSON.parse(fs.readFileSync(path.join(migration, "host-startup-baseline.json"), "utf8"));
assert.equal(baseline.informationDistributionContract.model, "search-filter-list");
assert.equal(baseline.expressiveOpportunity.heroEligible, true);
assert.equal(baseline.resultHierarchyContract.defaultRelationship, "peer");
assert.equal(baseline.resultHierarchyContract.differentiationAllowed, true);
assert.ok(baseline.resultHierarchyContract.evidence.some((item) => item.kind === "featured-result"));
assert.ok(!baseline.resultHierarchyContract.evidence.some((item) => item.kind === "selected-result"), "navigation active state must not become result hierarchy evidence");
assert.ok(baseline.resultContentContract.fields.length >= 3);
assert.ok(baseline.productiveFloor.businessObjectsVisible.includes("牌组"));
assert.equal(baseline.navigationShellContract.mode, "required");
assert.ok(baseline.navigationShellContract.items.some((item) => item.id === "primary-tab:selecttab-deck" && item.label === "牌组"));
assert.ok(baseline.navigationShellContract.items.some((item) => item.role === "account-entry" && item.label === "我的"));
const validation = validateHostStartupBaseline(baseline, { root, startupPage: JSON.parse(fs.readFileSync(startupFile, "utf8")), startupPageSha256: sha(startupFile), verifyReceiptFiles: true });
assert.equal(validation.ok, true, validation.errors.join("\n"));

// Conditions are resolved only from literals or source-bound startup context.
// Nested templates must not truncate later navigation entries.
fs.writeFileSync(sourceFile, `<template>
  <main>
    <template v-if="outer">
      <button class="nav" v-if="inner" @tap="openNested">Nested</button>
      <button class="nav" v-show="unknown" @tap="openUnknown">Unknown</button>
    </template>
    <button class="nav" v-if="false" @tap="openFalse">False</button>
    <button class="nav" v-if="true" @tap="openTrue">True</button>
    <button class="nav" v-if="count > 0" @tap="openExpression">Expression</button>
    <template v-if="branch"><button class="nav" @tap="openBranch">First</button></template>
    <template v-else-if="other"><button class="nav" @tap="openBranch">Second</button></template>
    <template v-else><button class="nav" @tap="openBranch">Last</button></template>
    <button class="mine-entry" @tap="openMine">After nested template</button>
  </main>
</template>`);
function deriveWith(values, sourceHash = sha(sourceFile)) {
  fs.writeFileSync(startupFile, JSON.stringify({ schema: "host-startup-page/v1", hostRoot: "host", route: "/plaza", sourceFile: "src/pages/plaza.vue", sourceSha256: sha(sourceFile), scope: "startup-page-only", ...(values === undefined ? {} : { navigationContext: { sourceSha256: sourceHash, conditionValues: values } }) }));
  deriveHostStartupBaseline({ root, brand });
  return JSON.parse(fs.readFileSync(path.join(migration, "host-startup-baseline.json"), "utf8"));
}
let conditional = deriveWith({ outer: true, inner: false, branch: false, other: true, "count > 0": true });
let shell = conditional.navigationShellContract;
assert.ok(shell.excludedItems.some((item) => item.handler === "openNested"));
assert.ok(shell.excludedItems.some((item) => item.handler === "openFalse"));
assert.ok(shell.items.some((item) => item.handler === "openTrue" && item.visibility === "visible"));
assert.ok(shell.items.some((item) => item.handler === "openExpression" && item.visibility === "visible"));
const unknown = shell.items.find((item) => item.handler === "openUnknown");
assert.equal(unknown.visibility, "unresolved");
assert.equal(unknown.requiredInDesignPreview, true);
assert.deepEqual(unknown.conditions.map((item) => item.expression), ["outer", "unknown"]);
assert.equal(shell.items.find((item) => item.handler === "openBranch").label, "Second");
assert.equal(shell.excludedItems.filter((item) => item.handler === "openBranch").length, 2);
assert.ok(shell.items.some((item) => item.handler === "openMine"));
assert.equal(shell.conditionResolution, "unresolved");
assert.ok(shell.items.every((item) => item.requiredInDesignPreview === true));
assert.ok(validateNavigationShellPreview("", shell).includes(`HOST_NAVIGATION_SHELL_ITEM_MISSING:${unknown.id}`), "unresolved conditions must not bypass the existing preview gate");
assert.ok(!validateNavigationShellPreview("", shell).some((error) => shell.excludedItems.some((item) => error === `HOST_NAVIGATION_SHELL_ITEM_MISSING:${item.id}`)), "proven hidden entries are not required in this startup preview");
assert.equal(validateHostStartupBaseline(conditional, { root, startupPage: JSON.parse(fs.readFileSync(startupFile)), startupPageSha256: sha(startupFile), verifyReceiptFiles: true }).ok, true);
shell = deriveWith({ outer: false, inner: true }).navigationShellContract;
assert.ok(shell.excludedItems.some((item) => item.handler === "openUnknown"), "false ancestor excludes even an unknown child");
shell = deriveWith({ outer: true, inner: true }).navigationShellContract;
assert.equal(shell.items.find((item) => item.handler === "openNested").visibility, "visible");
shell = deriveWith(undefined).navigationShellContract;
assert.equal(shell.items.find((item) => item.handler === "openNested").visibility, "unresolved");
assert.equal(shell.items.filter((item) => item.handler === "openBranch").length, 3, "unknown branches must all survive deduplication");
assert.equal(shell.items.find((item) => item.handler === "openExpression").visibility, "unresolved", "arbitrary JS is not evaluated");
assert.equal(deriveWith({ outer: "false" }).navigationShellContract.items.find((item) => item.handler === "openNested").visibility, "unresolved", "strings are not boolean evidence");
assert.throws(() => deriveWith({ outer: false }, "0".repeat(64)), /HOST_NAVIGATION_CONTEXT_INVALID/);
// Published workflow commands import this module even without host tooling.
// Copy only this file: no sibling modules or node_modules are available.
const isolated = path.join(root, "dependency-free");
fs.mkdirSync(isolated);
const isolatedModule = path.join(isolated, "derive.mjs");
fs.copyFileSync(new URL("./derive-host-startup-baseline.mjs", import.meta.url), isolatedModule);
const imported = spawnSync(process.execPath, ["--input-type=module", "-e", "const m = await import('./derive.mjs'); if (typeof m.deriveHostStartupBaseline !== 'function') process.exit(1)"], { cwd: isolated, encoding: "utf8", env: { ...process.env, NODE_PATH: "" } });
assert.equal(imported.status, 0, `dependency-free import failed: ${imported.stderr}`);
fs.rmSync(root, { recursive: true, force: true });
process.stdout.write("deterministic host startup baseline test passed\n");

function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
