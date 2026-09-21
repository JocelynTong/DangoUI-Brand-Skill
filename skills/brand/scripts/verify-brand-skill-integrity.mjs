#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function buildSkillIntegrity(skillDir) {
  const files = [];
  walk(skillDir, (file) => {
    const rel = path.relative(skillDir, file).replaceAll(path.sep, "/");
    if (rel === ".brand-skill-integrity.json" || rel === ".DS_Store") return;
    files.push({ path: rel, sha256: sha(file) });
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { schema: "brand-skill-integrity/v1", files, treeSha256: digest(JSON.stringify(files)) };
}

export function verifySkillIntegrity(skillDir, { allowMissing = false } = {}) {
  const manifestFile = path.join(skillDir, ".brand-skill-integrity.json");
  if (!fs.existsSync(manifestFile)) {
    if (allowMissing) return { status: "missing" };
    throw new Error("BRAND_SKILL_INTEGRITY_MANIFEST_MISSING");
  }
  const expected = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const actual = buildSkillIntegrity(skillDir);
  if (expected.treeSha256 !== actual.treeSha256) throw new Error(`BRAND_SKILL_MIXED_VERSION: expected ${expected.treeSha256}, got ${actual.treeSha256}`);
  return { status: "pass", treeSha256: actual.treeSha256, fileCount: actual.files.length };
}
function walk(dir, visit) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); entry.isDirectory() ? walk(file, visit) : entry.isFile() && visit(file); } }
function digest(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha(file) { return digest(fs.readFileSync(file)); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = path.resolve(process.argv[2] || path.join(process.cwd(), "skills/brand"));
  const result = verifySkillIntegrity(dir);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
