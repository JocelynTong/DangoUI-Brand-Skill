#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rawArgs = process.argv.slice(2);

if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
  printHelp();
  process.exit(0);
}

const root = opt(rawArgs, "--root", process.cwd());
const brand = opt(rawArgs, "--brand", "");
const sourceUrl = opt(rawArgs, "--source-url", "");

if (!brand || !sourceUrl) {
  printHelp();
  process.exit(1);
}

const outputFile = path.join(root, "output", "extractor-benchmark", brand, "dembrandt", "result.json");
fs.mkdirSync(path.dirname(outputFile), { recursive: true });

const dembrandtArgs = [
  sourceUrl,
  "--json-only",
  ...collectFlag(rawArgs, "--mobile"),
  ...collectFlag(rawArgs, "--slow"),
  ...collectFlag(rawArgs, "--sitemap"),
  ...collectFlag(rawArgs, "--dark-mode"),
  ...collectFlag(rawArgs, "--raw-colors"),
  ...collectFlag(rawArgs, "--ai"),
  ...collectOption(rawArgs, "--crawl"),
  ...collectOption(rawArgs, "--browser"),
];

const binary = path.join(root, "node_modules", ".bin", "dembrandt");
const result = spawnSync(binary, dembrandtArgs, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.status !== 0) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    brand,
    sourceUrl,
    outputFile,
    command: `${binary} ${dembrandtArgs.join(" ")}`,
    exitCode: result.status,
    stderr: result.stderr || "",
    stdout: result.stdout || "",
    message: inferFailureMessage(result.stderr || result.stdout || ""),
  }, null, 2)}\n`);
  process.exit(result.status || 1);
}

const parsed = safeParseJson(result.stdout);
if (!parsed) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    brand,
    sourceUrl,
    outputFile,
    command: `${binary} ${dembrandtArgs.join(" ")}`,
    exitCode: 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    message: "Dembrandt returned non-JSON output, so the learn-brand workflow cannot continue.",
  }, null, 2)}\n`);
  process.exit(1);
}

fs.writeFileSync(outputFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({
  ok: true,
  brand,
  sourceUrl,
  outputFile,
  command: `${binary} ${dembrandtArgs.join(" ")}`,
  message: "Dembrandt seed extraction completed.",
}, null, 2)}\n`);

function collectFlag(args, name) {
  return args.includes(name) ? [name] : [];
}

function collectOption(args, name) {
  const value = opt(args, name, "");
  return value ? [name, value] : [];
}

function opt(args, name, fallback = "") {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function safeParseJson(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
}

function inferFailureMessage(text) {
  if (/install-browser/i.test(text) || /browser/i.test(text) && /not found|missing|install/i.test(text)) {
    return "Dembrandt browser runtime is missing. Run dembrandt install-browser before learn-brand continues.";
  }
  return "Dembrandt extraction failed before the learn-brand flow could import third-party evidence.";
}

function printHelp() {
  process.stdout.write(`Usage:
  node skills/brand/scripts/run-dembrandt-extractor.mjs --root <repo> --brand <brand> --source-url <url> [--mobile] [--crawl <n>] [--sitemap] [--slow] [--dark-mode] [--browser <type>] [--raw-colors] [--ai]
`);
}
