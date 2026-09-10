#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const value = (name, fallback = "") => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const required = name => { const result = value(name); if (!result) throw new Error(`--${name} is required.`); return result; };
const readJson = file => JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const slug = input => String(input).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fingerprint = item => crypto.createHash("sha256").update([item.origin, item.component || "composition", item.requestedCapability, item.currentLimitation].join("\n")).digest("hex").slice(0, 16);

try {
  const mappingFile = required("mapping");
  const closureFile = required("token-closure");
  const outputFile = path.resolve(required("output"));
  const mapping = readJson(mappingFile);
  const closure = readJson(closureFile);
  const seedsFile = required("seeds");
  const seeds = readJson(seedsFile);
  const decisions = value("decisions") ? readJson(value("decisions")).decisions || {} : {};
  const candidates = [];

  for (const entry of mapping.mappings || []) {
    if (/native.*runtime.*consumed/i.test(entry.status || "")) continue;
    candidates.push({
      id: `mapping-${slug(entry.sourcePattern)}`,
      origin: "component-mapping",
      component: entry.compositionCandidates?.join("+") || null,
      requestedCapability: entry.sourcePattern,
      currentLimitation: entry.boundary || `Mapping status is ${entry.status || "unknown"}.`,
      evidence: [{ type: "mapping", ref: `${path.basename(mappingFile)}#${entry.sourcePattern}` }],
      workaround: "Host composition or style recipe",
    });
  }
  for (const entry of closure.exceptions || []) {
    candidates.push({
      id: `closure-${slug(entry.id)}`,
      origin: "token-closure-exception",
      component: null,
      requestedCapability: entry.id,
      currentLimitation: entry.reason,
      evidence: [{ type: "closure", ref: `${path.basename(closureFile)}#${entry.id}` }],
      workaround: entry.kind,
    });
  }
  for (const seed of seeds.items || []) candidates.push({ ...seed, id: seed.id || `runtime-${slug(seed.requestedCapability)}`, origin: seed.origin || "runtime-qa" });

  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const unusedDecisionIds = Object.keys(decisions).filter(id => !candidateIds.has(id));

  const items = candidates.map(candidate => {
    const decision = decisions[candidate.id] || {};
    const merged = {
      ...candidate,
      decision: decision.decision || candidate.decision || "unclassified",
      rationale: decision.rationale || candidate.rationale || "",
      generality: decision.generality || candidate.generality || "unknown",
      frequency: Number(decision.frequency ?? candidate.frequency ?? 1),
      severity: decision.severity || candidate.severity || "minor",
      proposedLayer: decision.proposedLayer || candidate.proposedLayer || "needs-triage",
      owner: decision.owner || candidate.owner || "Dangoui Mapper",
      lifecycle: decision.lifecycle || candidate.lifecycle || "candidate",
    };
    return { ...merged, fingerprint: fingerprint(merged) };
  });
  const count = decision => items.filter(item => item.decision === decision).length;
  const report = {
    schema: "dangoui-capability-gaps/v1",
    generatedAt: new Date().toISOString(),
    source: { brand: value("brand", closure.brand || "unknown"), host: value("host", closure.host || "unknown"), platform: closure.platform || "unknown", dangouiVersion: value("version", "unknown") },
    privacy: { networkSubmission: "disabled", reviewedForExport: false, containsAbsolutePaths: false, containsPrivateUrls: false },
    discovery: { componentMappingCandidates: (mapping.mappings || []).filter(entry => !/native.*runtime.*consumed/i.test(entry.status || "")).length, tokenClosureExceptions: (closure.exceptions || []).length, runtimeSeeds: (seeds.items || []).length, total: items.length, unusedDecisionIds },
    summary: { total: items.length, capabilityGaps: count("capability-gap"), correctBoundaries: count("correct-boundary"), unclassified: count("unclassified") },
    items,
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: "COLLECTED", output: outputFile, summary: report.summary }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "BLOCKED", error: error.message }, null, 2));
  process.exit(1);
}
