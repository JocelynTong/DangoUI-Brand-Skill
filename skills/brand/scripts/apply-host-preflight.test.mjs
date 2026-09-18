import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runApplyHostPreflight } from "./apply-host-preflight.mjs";

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
const page = path.join(host, "src", "page.vue");
fs.writeFileSync(page, "<template><view><view>broken</view></template>\n");

let result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.verdict, "blocked");
assert.ok(result.blocking.includes("TEMPLATE_VIEW_TAG_UNBALANCED:src/page.vue"));
assert.equal(result.hostLayout.issues[0].opened, 2);
assert.equal(result.hostLayout.issues[0].closed, 1);

fs.writeFileSync(page, "<template><view><scroll-view scroll-y>ok</scroll-view></view></template>\n");
result = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(result.verdict, "pass");
assert.equal(result.hostLayout.issues.length, 0);
assert.equal(result.hostLayout.qaContract.length, 3);
assert.equal(result.targetResolution.strategy, "default-home-first-route");
assert.equal(result.targetResolution.route, "pages/home/index");
assert.equal(result.hostSurface.formFactor, "responsive");

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

const implementationWithoutDesign = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "fast", phase: "implementation", write: false });
assert.equal(implementationWithoutDesign.verdict, "blocked");
assert.ok(implementationWithoutDesign.blocking.includes("FROZEN_DESIGN_FILE_MISSING:design-direction.json"));
assert.equal(implementationWithoutDesign.frozenDesign.reuseDecision, "return-to-design-host");

for (const name of ["brand-application-plan.json", "design-direction-options.json", "design-direction-decision.json", "business-scope.json", "design-direction.json", "preedit-baseline-bundle.json", "structural-targets.json"]) {
  fs.writeFileSync(path.join(migration, name), "{}\n");
}
const implementationWithDesign = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "fast", phase: "implementation", write: false });
assert.equal(implementationWithDesign.verdict, "pass");
assert.equal(implementationWithDesign.frozenDesign.reuseDecision, "consume-without-redesign");

const certification = runApplyHostPreflight({ root, brand, hostTarget: "host", profile: "certification", phase: "implementation", write: false });
assert.equal(certification.verdict, "blocked");
assert.ok(certification.blocking.includes("FROZEN_PACK_FILE_MISSING:component-mapping.json"));

fs.unlinkSync(evidence);
const missingEvidence = runApplyHostPreflight({ root, brand, hostTarget: "host", phase: "design", write: false });
assert.equal(missingEvidence.verdict, "blocked");
assert.ok(missingEvidence.blocking.some((item) => item.startsWith("FROZEN_EVIDENCE_MISSING:")));

fs.rmSync(root, { recursive: true, force: true });
console.log("apply-host layout preflight regression passed");
