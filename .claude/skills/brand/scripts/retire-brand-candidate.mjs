import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildSkillIntegrity,verifySkillIntegrity} from './verify-brand-skill-integrity.mjs';

// Explicit retirement, never automatic installation or silent candidate selection.
export function retireCandidate(candidate, installed) {
  const root=fs.realpathSync(candidate),target=fs.realpathSync(installed);
  const temps=[os.tmpdir(),'/tmp'].filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p));
  if(root===target || !temps.some(temp=>root.startsWith(temp+path.sep))) throw Error('Only an explicit temporary candidate may be retired.');
  verifySkillIntegrity(target);
  const entry=path.join(root,'scripts/run-brand-workflow.mjs');
  const record=path.join(root,'.retired-candidate.json');
  if(fs.existsSync(record))throw Error('Candidate already retired; inspect its existing record.');
  verifySkillIntegrity(root);
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'brand-retired-backup-'));
  for(const name of ['scripts/run-brand-workflow.mjs','SKILL.md','.brand-skill-integrity.json']) {
    const dst=path.join(backup,name);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,name),dst);
  }
  const wrapper=`#!/usr/bin/env node\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport {spawnSync} from 'node:child_process';\nimport {pathToFileURL} from 'node:url';\nconst target=${JSON.stringify(target)};\ntry {\nconst {verifySkillIntegrity}=await import(pathToFileURL(path.join(target,'scripts/verify-brand-skill-integrity.mjs')));\nverifySkillIntegrity(target);\nif(fs.existsSync(path.join(target,'.retired-candidate.json')))throw Error('Retirement target must be active');\nprocess.stderr.write('Brand: retired candidate → current installed skill\\n');\nconst child=spawnSync(process.execPath,[path.join(target,'scripts/run-brand-workflow.mjs'),...process.argv.slice(2)],{stdio:'inherit'});\nif(child.error)throw child.error;process.exit(child.status??1);\n} catch(error){console.error('BRAND_ACTIVE_ENTRY_UNAVAILABLE: '+error.message);process.exit(1);}\n`;
  fs.writeFileSync(entry,wrapper);
  const old=fs.readFileSync(path.join(root,'SKILL.md'),'utf8');
  const front=old.match(/^---\n[\s\S]*?\n---\n/);
  if(!front)throw Error('Missing skill frontmatter');
  fs.writeFileSync(path.join(root,'SKILL.md'),front[0]+`\n# Retired candidate\n\nThis temporary candidate is retired. Read the current installed skill at ${target}/SKILL.md. Existing artifact roots and approvals remain unchanged. This directory's public entry forwards to that verified installation; it does not regenerate, install or edit artifacts by itself. Do not use internal scripts from this candidate.\n`);
  fs.writeFileSync(record,JSON.stringify({target,backup,retiredAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(root,'.brand-skill-integrity.json'),JSON.stringify(buildSkillIntegrity(root),null,2)+'\n');
  return {candidate:root,target,backup,artifactsModified:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const [candidate,installed]=process.argv.slice(2);
  if(!candidate||!installed)throw Error('Usage: retire-brand-candidate.mjs <explicit temporary candidate> <installed brand>');
  console.log(JSON.stringify(retireCandidate(candidate,installed),null,2));
}
