#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const command = args[0];
const root = path.resolve(opt("--root", process.cwd()));
const aliases = {
  contract: "skills/brand/references/dangoui-token-contract.json",
  tokens: "skills/brand/references/dangoui.tokens.dtcg.json",
  runtime: "skills/brand/references/dangoui.design-system.json",
  workflow: "skills/brand/workflow-contract.json",
};
const source = opt("--source", "");
if (!aliases[source]) fail(`Unknown --source. Use: ${Object.keys(aliases).join(", ")}`);
const file = path.join(root, aliases[source]);
const raw = fs.readFileSync(file, "utf8");
const data = JSON.parse(raw);
const maxChars = Math.min(12000, Math.max(200, Number(opt("--max-chars", "6000"))));
let result;
if (command === "get") {
  result = pointer(data, opt("--pointer", ""));
  if (result === undefined) fail("JSON pointer was not found.");
} else if (command === "search") {
  const term = opt("--term", "").toLowerCase();
  if (!term) fail("search requires --term.");
  const limit = Math.min(50, Math.max(1, Number(opt("--limit", "20"))));
  result = [];
  walk(data, "", (value, keyPath) => {
    if (result.length < limit && `${keyPath} ${typeof value === "string" ? value : ""}`.toLowerCase().includes(term)) result.push({ path: keyPath || "/", value });
  });
} else fail("Usage: query-brand-context.mjs <get|search> --source <contract|tokens|runtime|workflow> ...");
let rendered = JSON.stringify(result, null, 2);
const truncated = rendered.length > maxChars;
if (truncated) rendered = `${rendered.slice(0, maxChars)}\n…`;
process.stdout.write(`${JSON.stringify({ ok: true, source, sourcePath: aliases[source], sourceBytes: Buffer.byteLength(raw), returnedBytes: Buffer.byteLength(rendered), truncated, result: rendered }, null, 2)}\n`);

function pointer(value, input) {
  if (input === "" || input === "/") return value;
  return input.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~")).reduce((node, key) => node?.[key], value);
}
function walk(value, keyPath, visit) {
  if (!value || typeof value !== "object") return visit(value, keyPath);
  for (const [key, child] of Object.entries(value)) walk(child, `${keyPath}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`, visit);
}
function opt(name, fallback) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
