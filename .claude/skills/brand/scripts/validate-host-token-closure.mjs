#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
};
const strict = args.includes("--strict");
const root = path.resolve(value("--root") || ".");
const contractFile = path.resolve(root, value("--contract"));
const blockers = [];
const add = (code, message) => blockers.push({ code, message });
const exists = (file) => fs.existsSync(file);
const read = (file) => fs.readFileSync(file, "utf8");
const readJson = (file) => JSON.parse(read(file));
const hash = (file) => crypto.createHash("sha256").update(read(file)).digest("hex");

if (!value("--contract") || !exists(contractFile)) {
  add("TOKEN_CLOSURE_CONTRACT_MISSING", "Pass an existing --contract file.");
} else {
  const contract = JSON.parse(read(contractFile));
  if (contract.schema !== "brand-host-token-closure/v1") add("TOKEN_CLOSURE_SCHEMA_INVALID", "Expected brand-host-token-closure/v1.");
  const sourceMod = path.resolve(root, contract.sourceMod || "");
  const hostRoot = path.resolve(root, contract.host || "");
  const themeFile = path.resolve(hostRoot, contract.themeFile || "");
  if (!exists(sourceMod)) add("TOKEN_SOURCE_MOD_MISSING", `Missing source MOD ${sourceMod}.`);
  else if (hash(sourceMod) !== contract.sourceModSha256) add("TOKEN_SOURCE_MOD_DRIFT", "Frozen source MOD hash no longer matches the token closure contract.");
  if (!exists(themeFile)) add("TOKEN_THEME_FILE_MISSING", `Missing host theme ${themeFile}.`);
  else {
    const theme = read(themeFile);
    for (const mapping of contract.requiredMappings || []) {
      if (!mapping.role || !mapping.source || !mapping.target || !mapping.value || !mapping.status) {
        add("TOKEN_MAPPING_INCOMPLETE", `Incomplete mapping entry ${JSON.stringify(mapping)}.`);
        continue;
      }
      if (!mapping.target.startsWith("--du-")) add("TOKEN_TARGET_NOT_DANGOUI", `${mapping.target} is not a DangoUI token.`);
      if (!new RegExp(`${mapping.target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(theme)) {
        add("TOKEN_TARGET_NOT_BRIDGED", `${mapping.target} is not declared in the host theme.`);
      }
    }
    for (const [component, tokens] of Object.entries(contract.runtimeComponentTokens || {})) {
      for (const token of tokens) {
        if (!new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(theme)) {
          add("TOKEN_COMPONENT_CHAIN_MISSING", `${component} requires ${token}, but the host theme has no bridge or alias declaration.`);
        }
      }
    }
    for (const selector of contract.componentAliasSelectors || []) {
      if (!theme.includes(selector)) add("TOKEN_COMPONENT_ALIAS_MISSING", `Missing component palette alias ${selector}.`);
    }
    if (/PARTIAL_STYLE_ONLY|has no dangoui dependency/.test(theme)) add("TOKEN_STALE_RUNTIME_CLAIM", "Theme still contains a stale style-only/no-dependency claim.");
  }
  if (!(contract.exceptions || []).every((item) => item.id && item.kind && item.owner && item.reason)) {
    add("TOKEN_EXCEPTION_UNOWNED", "Every token exception needs id, kind, owner, and reason.");
  }
  if (strict) {
    for (const [track, status] of Object.entries(contract.tracks || {})) {
      if (status !== "PASS") add("TOKEN_TRACK_INCOMPLETE", `${track} is ${status || "MISSING"}.`);
    }
    if (contract.status !== "PASS") add("TOKEN_CLOSURE_NOT_PASS", `Contract status is ${contract.status || "MISSING"}.`);
    const stateEvidence = path.resolve(root, contract.stateEvidence || "");
    if (!contract.stateEvidence || !exists(stateEvidence)) {
      add("TOKEN_STATE_EVIDENCE_MISSING", "Strict closure requires an existing stateEvidence receipt.");
    } else {
      const evidence = readJson(stateEvidence);
      if (evidence.schema !== "brand-host-token-state-evidence/v1" || evidence.platform !== contract.platform) {
        add("TOKEN_STATE_EVIDENCE_INVALID", "State evidence schema and platform must match the closure contract.");
      }
      for (const state of contract.requiredStates || []) {
        if (evidence.liveBrowserChecks?.[state] !== "PASS") add("TOKEN_RENDERED_STATE_INCOMPLETE", `${state} lacks live browser PASS evidence.`);
      }
      if (evidence.liveReport?.status !== "PASS" || evidence.build?.status !== "PASS") {
        add("TOKEN_STATE_EVIDENCE_FAILED", "Live report and themed production build must both PASS.");
      }
    }
  }
}

console.log(JSON.stringify({ status: blockers.length ? "BLOCKED_TOKEN_CLOSURE" : "PASS_TOKEN_CLOSURE", contract: contractFile, strict, blockers }, null, 2));
if (blockers.length) process.exit(1);
