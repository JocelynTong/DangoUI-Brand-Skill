#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const validator = path.resolve("skills/brand/scripts/validate-host-theme-order.mjs");
const fixture = ({ app = `import "./styles/theme.css";`, page = "export default {};", css = ".theme .card { color: red; }" } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-theme-order-"));
  fs.mkdirSync(path.join(root, "src/pages/home"), { recursive: true }); fs.mkdirSync(path.join(root, "src/styles"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/app.js"), app); fs.writeFileSync(path.join(root, "src/pages/home/index.js"), page); fs.writeFileSync(path.join(root, "src/styles/theme.css"), css);
  const contract = { version: 1, strategy: "single-global-entry", themeEntry: "src/styles/theme.css", globalImporters: ["src/app.js"], scanRoots: ["src"], allowedLateStyleInjectors: [], maxSelectorSpecificity: [0, 4, 1] };
  fs.writeFileSync(path.join(root, "contract.json"), JSON.stringify(contract)); return root;
};
const run = root => spawnSync(process.execPath, [validator, "--root", root, "--contract", path.join(root, "contract.json")], { encoding: "utf8" });
assert.equal(run(fixture()).status, 0);
assert.notEqual(run(fixture({ page: `import "../../styles/theme.css";` })).status, 0);
assert.notEqual(run(fixture({ app: "", page: `import "../../styles/theme.css";` })).status, 0);
assert.notEqual(run(fixture({ css: ".theme .a .b .c .d { color:red !important; }" })).status, 0);
assert.notEqual(run(fixture({ page: `const s=document.createElement("style"); document.head.appendChild(s);` })).status, 0);
console.log("validate-host-theme-order tests passed");
