import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runApplyHostPreflight } from "./apply-host-preflight.mjs";
import { collectPngReferences } from "./evidence-file-references.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-apply-preflight-"));
const brand = "fixture";
const migration = path.join(root, "migrations", brand);
const host = path.join(root, "host");
fs.mkdirSync(migration, { recursive: true });
fs.mkdirSync(path.join(host, "src"), { recursive: true });
for (const name of ["brand-mod.json", "brand-evidence.json", "brand-intent.json"]) {
  fs.writeFileSync(path.join(migration, name), "{}\n");
}
fs.writeFileSync(path.join(host, "package.json"), JSON.stringify({ dependencies: { dangoui: "1.0.0" } }));
fs.writeFileSync(path.join(host, "src", "app.config.ts"), "export default { pages: ['pages/home/index', 'pages/other/index'] }\n");
fs.mkdirSync(path.join(host, "src", "pages", "home"), { recursive: true });
fs.mkdirSync(path.join(host, "src", "pages", "other"), { recursive: true });
fs.writeFileSync(path.join(host, "src", "pages", "home", "index.vue"), "<template><view>home</view></template>\n");
fs.writeFileSync(path.join(host, "src", "pages", "other", "index.vue"), "<template><view>other</view></template>\n");
const page = path.join(host, "src", "page.vue");
fs.writeFileSync(page, "<template><view><view>broken</view></template>\n");

let result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.verdict, "pass");
assert.equal(result.hostLayout.scannedFiles, 1);
assert.equal(result.hostLayout.issues.length, 0, "design preflight must not scan unrelated pages before style approval");

fs.writeFileSync(page, "<template><view><scroll-view scroll-y>ok</scroll-view></view></template>\n");
result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.verdict, "pass");
assert.equal(result.schema, "brand-design-host-preflight/v1");
assert.equal(result.lane, "design-host");
assert.equal(result.hostLayout.issues.length, 0);
assert.equal(result.hostLayout.qaContract.length, 3);
assert.equal(result.targetResolution.strategy, "default-home-first-route");
assert.equal(result.targetResolution.route, "pages/home/index");
assert.equal(result.hostSurface.formFactor, "responsive");
assert.equal(result.pageInventory, null);
assert.equal(result.startupPage.route, "pages/home/index");
assert.equal(result.startupPage.sourceFile, "src/pages/home/index.vue");

result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: true });
const startup = JSON.parse(fs.readFileSync(path.join(migration, "host-startup-page.json"), "utf8"));
assert.equal(startup.schema, "host-startup-page/v1");
assert.equal(startup.scope, "startup-page-only");
assert.equal(fs.existsSync(path.join(migration, "host-page-inventory.json")), false);
fs.unlinkSync(path.join(host, "src", "pages", "other", "index.vue"));
const unresolvedRoute = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(unresolvedRoute.verdict, "pass");
assert.equal(unresolvedRoute.blocking.some((item) => item.startsWith("HOST_DECLARED_ROUTE_SOURCE_UNRESOLVED")), false);
fs.writeFileSync(path.join(host, "src", "pages", "other", "index.vue"), "<template><view>other</view></template>\n");

const fileTarget = runApplyHostPreflight({ root, brand, hostTarget: "host/src/page.vue", phase: "design", write: false });
assert.equal(fileTarget.verdict, "pass");
assert.equal(fileTarget.hostTarget, "host");
assert.equal(fileTarget.targetResolution.strategy, "explicit-file");
assert.equal(fileTarget.targetResolution.route, "src/page.vue");
assert.equal(fileTarget.blocking.includes("HOST_PACKAGE_JSON_MISSING"), false);

fs.writeFileSync(path.join(host, "package.json"), JSON.stringify({ dependencies: { dangoui: "1.0.0", "@tarojs/taro": "4.2.0", "taro-plugin-qd": "1.0.2" }, scripts: { build: "taro build --type weapp", "build:h5": "taro build --type h5" } }));
result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.hostSurface.formFactor, "mobile");
assert.equal(result.hostSurface.platform, "qdmp-miniapp");
assert.deepEqual(result.hostSurface.compatibility, ["mobile-miniapp", "mobile-h5"]);

fs.writeFileSync(page, "<template><view><view class=\"ornament\" /></view></template>\n");
result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.hostLayout.issues.length, 0, "self-closing Taro view is balanced");

const evidence = path.join(migration, "captures", "source", "home", "full-page.png");
fs.mkdirSync(path.dirname(evidence), { recursive: true });
fs.writeFileSync(evidence, "png");
fs.writeFileSync(path.join(migration, "brand-evidence.json"), JSON.stringify({ capture: { path: "captures/source/home/full-page.png" } }));
result = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "fast", phase: "design", write: false });
assert.equal(result.frozenPack.reuseDecision, "reuse-without-relearning");
assert.equal(result.frozenPack.referencedEvidenceCount, 1);

const identityIntent = { compositionContract: { sourceAsset: { identity: "laptop-2x.png + pikachu-2x.png + phone-2x.png" } }, nested: [{ identity: ["semantic-a.png", "semantic-b.png"] }] };
fs.writeFileSync(path.join(migration, "brand-intent.json"), JSON.stringify(identityIntent));
result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.verdict, "pass");
assert.equal(result.frozenPack.referencedEvidenceCount, 1);
const mixedRefs = new Set();
collectPngReferences({ identity: ["label.png", { localPath: "actual.png" }], rows: [{ identity: "description.png", screenshot: "screen.png#viewport" }], legacy: ["legacy.png"], path: "path.png" }, mixedRefs);
assert.deepEqual([...mixedRefs].sort(), ["actual.png", "legacy.png", "path.png", "screen.png"]);
for (const key of ["path", "localPath", "screenshot", "legacy"]) {
  fs.writeFileSync(path.join(migration, "brand-intent.json"), JSON.stringify({ ...identityIntent, nested: [{ identity: ["semantic.png", { [key]: "missing-real.png" }] }] }));
  const missing = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
  assert.equal(missing.verdict, "blocked");
  assert(missing.blocking.includes("FROZEN_EVIDENCE_MISSING:missing-real.png"));
}
fs.writeFileSync(path.join(migration, "brand-intent.json"), JSON.stringify(identityIntent));

const implementationWithoutDesign = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "fast", phase: "implementation", write: false });
assert.equal(implementationWithoutDesign.verdict, "blocked");
assert.ok(implementationWithoutDesign.blocking.includes("FROZEN_DESIGN_FILE_MISSING:design-direction.json"));
assert.equal(implementationWithoutDesign.frozenDesign.reuseDecision, "return-to-design-host");

for (const name of ["brand-application-plan.json", "design-direction-options.json", "design-direction-decision.json", "business-scope.json"]) {
  fs.writeFileSync(path.join(migration, name), "{}\n");
}
const approvedH5 = path.join(migration, "approved.html");
fs.writeFileSync(approvedH5, "<!doctype html><title>approved</title>\n");
const approvedHash = crypto.createHash("sha256").update(fs.readFileSync(approvedH5)).digest("hex");
const approvedArtifact = { path: `migrations/${brand}/approved.html`, sha256: approvedHash };
fs.writeFileSync(path.join(migration, "approved-master.json"), `${JSON.stringify({ schema: "brand-approved-master/v1", status: "approved", approvalSource: "explicit-user", artifact: approvedArtifact, navigationShellContract: { baseline: { path: `migrations/${brand}/host-startup-baseline.json`, sha256: "b".repeat(64) }, itemIds: ["primary-tab:selecttab-deck"], treatment: "custom-immersive", sceneContinuity: "continuous" } })}\n`);
fs.writeFileSync(path.join(migration, "design-direction.json"), `${JSON.stringify({ implementationAuthority: "approved-master-artifact", previewArtifact: approvedArtifact })}\n`);
const implementationWithDesign = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "fast", phase: "implementation", write: true });
assert.equal(implementationWithDesign.verdict, "pass");
assert.equal(implementationWithDesign.schema, "brand-apply-host-preflight/v1");
assert.equal(implementationWithDesign.frozenDesign.reuseDecision, "consume-without-redesign");
assert.deepEqual(implementationWithDesign.frozenDesign.generatedAfterHostStrategy, ["structural-targets.json", "preedit-baseline-bundle.json"]);
assert.equal(implementationWithDesign.pageInventory.pageCount, 3);
const inventory = JSON.parse(fs.readFileSync(path.join(migration, "host-page-inventory.json"), "utf8"));
assert.equal(inventory.schema, "host-page-inventory/v1");
assert.deepEqual(inventory.discovery.unresolvedDeclaredRoutes, []);

const certification = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "certification", phase: "implementation", write: false });
assert.equal(certification.verdict, "blocked");
assert.ok(certification.blocking.includes("FROZEN_PACK_FILE_MISSING:component-mapping.json"));

fs.unlinkSync(evidence);
const missingEvidence = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(missingEvidence.verdict, "blocked");
assert.ok(missingEvidence.blocking.some((item) => item.startsWith("FROZEN_EVIDENCE_MISSING:")));

fs.rmSync(root, { recursive: true, force: true });
console.log("apply-host layout preflight regression passed");
