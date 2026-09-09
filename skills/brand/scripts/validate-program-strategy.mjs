#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const value = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : "";
};
const read = (name) => {
  const file = value(name);
  if (!file) throw new Error(`${name} is required`);
  return { file: path.resolve(file), json: JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) };
};

const failures = [];
const fail = (code, message, location) => failures.push({ code, message, location });
let goalTree;
let hostMap;

try {
  goalTree = read("--goal-tree");
  hostMap = read("--host-map");
} catch (error) {
  console.error(JSON.stringify({ ok: false, gate: "program-strategy/v1", failures: [{ code: "INPUT_UNREADABLE", message: error.message }] }, null, 2));
  process.exit(2);
}

const branches = goalTree.json.pipelines || goalTree.json.branches || {};
for (const id of ["learn-brand", "design-host", "held-out-reuse"]) {
  const branch = branches[id];
  if (!branch) {
    fail("PROGRAM_GOAL_BRANCH_MISSING", `Missing separate ${id} branch.`, `pipelines.${id}`);
    continue;
  }
  for (const field of ["status", "evidence", "remainingGap", "nextAction"]) {
    if (branch[field] === undefined || branch[field] === null || branch[field] === "") {
      fail("PROGRAM_GOAL_BRANCH_MISSING", `${id} must declare ${field}.`, `pipelines.${id}.${field}`);
    }
  }
}

if (goalTree.json.overallPercent !== undefined || goalTree.json.totalPercent !== undefined) {
  fail("PROGRAM_PROGRESS_PROXY", "Do not collapse the two-pipeline program into one overall percentage.", "program-goal-tree.json");
}
const progressBasis = JSON.stringify(goalTree.json.progressBasis || "").toLowerCase();
if (progressBasis.includes("coverage") && !progressBasis.includes("design-host")) {
  fail("PROGRAM_PROGRESS_PROXY", "Coverage can support design-host scope only; label that scope explicitly.", "progressBasis");
}

const pages = hostMap.json.pagePlacements || hostMap.json.opportunities || hostMap.json.pages || [];
if (!Array.isArray(pages) || pages.length === 0) {
  fail("HOST_PAGE_MAPPING_LAYER_MISSING", "Host opportunity map needs at least one page entry.", "host-opportunity-map.json");
} else {
  pages.forEach((page, index) => {
    const location = `pages[${index}]${page.route ? `(${page.route})` : ""}`;
    if (!page.route || !page.businessPurpose) fail("HOST_PAGE_MAPPING_LAYER_MISSING", "Every page needs route and businessPurpose.", location);
    for (const layer of ["token", "component", "composition", "asset"]) {
      const decision = page.mapping?.[layer];
      if (!decision || (typeof decision === "object" && !Object.keys(decision).length)) {
        fail("HOST_PAGE_MAPPING_LAYER_MISSING", `Missing ${layer} mapping decision.`, `${location}.mapping.${layer}`);
      }
    }
    const hero = page.heroEligibility;
    if (!hero || typeof hero.eligible !== "boolean" || typeof hero.businessReason !== "string" || !hero.businessReason.trim()) {
      fail("HERO_ELIGIBILITY_UNJUSTIFIED", "Hero eligibility needs eligible:boolean and a non-empty businessReason.", `${location}.heroEligibility`);
    }
  });
}

const recognition = hostMap.json.recognitionPolicy;
if (!recognition?.designSystemStructuralRecognition || !recognition?.explicitIpRecognition) {
  fail("RECOGNITION_TRACKS_CONFLATED", "Recognition policy must separate design-system structural recognition and explicit-IP recognition.", "recognitionPolicy");
} else {
  for (const track of ["designSystemStructuralRecognition", "explicitIpRecognition"]) {
    const item = recognition[track];
    if (!item.mode || !["blocking", "diagnostic"].includes(item.mode)) {
      fail("RECOGNITION_TRACKS_CONFLATED", `${track} must declare mode=blocking|diagnostic.`, `recognitionPolicy.${track}.mode`);
    }
  }
  if (recognition.changedAfterFreeze === true && !recognition.supersessionRecord) {
    fail("QUALITY_GATE_SILENTLY_DOWNGRADED", "A post-freeze recognition policy change requires a supersessionRecord.", "recognitionPolicy.supersessionRecord");
  }
}

const result = {
  ok: failures.length === 0,
  gate: "program-strategy/v1",
  inputs: { goalTree: goalTree.file, hostMap: hostMap.file },
  checkedPages: Array.isArray(pages) ? pages.length : 0,
  failures,
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 2);
