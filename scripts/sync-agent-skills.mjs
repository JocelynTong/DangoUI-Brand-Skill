import fs from "node:fs";
import path from "node:path";
import { buildSkillIntegrity } from "../skills/brand/scripts/verify-brand-skill-integrity.mjs";

const root = process.cwd();
const skillsRoot = path.join(root, "skills");
const claudeSkillsRoot = path.join(root, ".claude", "skills");
const codexSkillsRoot = path.join(process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"), "skills");
const ignoredEntries = new Set([".DS_Store"]);

if (!fs.existsSync(skillsRoot)) {
  console.error("Missing skills directory");
  process.exit(1);
}

for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const source = path.join(skillsRoot, entry.name);
  const claudeTarget = path.join(claudeSkillsRoot, entry.name);
  const codexTarget = path.join(codexSkillsRoot, entry.name);

  if (!fs.existsSync(path.join(source, "SKILL.md"))) continue;

  syncDirectory(source, claudeTarget);
  writeIntegrity(claudeTarget, entry.name);
  console.log(`Synced ${path.relative(root, source)} -> ${path.relative(root, claudeTarget)}`);

  if (codexSkillsRoot && fs.existsSync(path.dirname(codexTarget))) {
    syncDirectory(source, codexTarget);
    writeIntegrity(codexTarget, entry.name);
    console.log(`Synced ${path.relative(root, source)} -> ${codexTarget}`);
  }
}

function writeIntegrity(target, skillName) {
  if (skillName !== "brand") return;
  const manifest = buildSkillIntegrity(target);
  fs.writeFileSync(path.join(target, ".brand-skill-integrity.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function syncDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  removeExtraneousFiles(from, to);

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (ignoredEntries.has(entry.name)) continue;

    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      syncDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function removeExtraneousFiles(from, to) {
  for (const entry of fs.readdirSync(to, { withFileTypes: true })) {
    if (ignoredEntries.has(entry.name)) continue;

    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (!fs.existsSync(sourcePath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  }
}
