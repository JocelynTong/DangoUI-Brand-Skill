#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, "..");
const contract = JSON.parse(fs.readFileSync(path.join(skillRoot, "workflow-contract.json"), "utf8"));
const researcher = contract.roles?.brandResearcher;

assert.ok(researcher, "workflow contract must define brandResearcher");
assert.ok(
  researcher.tasks.some((item) => item.includes("persist one real viewport screenshot")),
  "Evidence dispatch must run a persistence probe before full-site collection",
);
assert.ok(
  researcher.requirements.includes("a capture persistence probe passes before full-site evidence collection begins"),
  "Evidence requirements must block full-site collection until the probe passes",
);
assert.ok(
  researcher.failCriteria.some((item) => item.startsWith("EVIDENCE_CAPTURE_NOT_PERSISTABLE:")),
  "Evidence failure routing must expose a stable blocker code",
);

process.stdout.write("evidence capture persistence preflight contract passed\n");
