import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const entry = path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-public-learning-repair-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir = path.join(root,'migrations','example'); fs.mkdirSync(dir,{recursive:true});
  const goal = JSON.stringify({schema:'brand-goal/v2',sealed:true,mode:'learn-brand',goalId:'frozen',thresholds:{maxAttempts:1}});
  fs.writeFileSync(path.join(dir,'goal-contract.json'),goal);
  const manifest = {schema:'brand-subagent-execution/v1',runId:'fixture',brand:'example',mode:'learn-brand',goalId:'frozen',goalPath:'migrations/example/goal-contract.json',goalSha256:crypto.createHash('sha256').update(goal).digest('hex'),status:'blocked',currentStageId:null,stages:[{id:'evidence-1',stage:'evidence',role:'brandResearcher',attempt:1,status:'failed',verdict:'needs-evidence',blockingFindings:[{code:'MISSING_CONTROL_STATE',scope:'products'}]}]};
  const file=path.join(dir,'execution-manifest.json');fs.writeFileSync(file,JSON.stringify(manifest));
  return {root,file,read:()=>JSON.parse(fs.readFileSync(file)),call:(command,...args)=>spawnSync(process.execPath,[entry,command,'--artifact-root',root,'--brand','example',...args],{encoding:'utf8'})};
}
test('public Evidence repair preserves retry authorization, original failure and Goal',t=>{
  const f=fixture(t),before=f.read();
  const denied=f.call('resume-evidence');assert.equal(denied.status,1);assert.match(denied.stderr,/retry budget is exhausted/);assert.deepEqual(f.read(),before);
  const resumed=f.call('resume-evidence','--continue-existing');assert.equal(resumed.status,0,resumed.stderr);
  const after=f.read();assert.equal(after.goalSha256,before.goalSha256);assert.deepEqual(after.stages[0],before.stages[0]);assert.equal(after.currentStageId,'evidence-2');assert.equal(after.stages[1].retryInput.blockingFindings[0].scope,'products');
});
test('unsupported dry-run cannot silently perform a repair',t=>{
  const f=fixture(t),before=f.read();for(const command of ['resume-evidence','resume-interpreter']){const r=f.call(command,'--continue-existing','--dry-run');assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).blockingCode,'LEARNING_REPAIR_DRY_RUN_UNSUPPORTED');assert.deepEqual(f.read(),before);}
});
test('Interpreter route still rejects a failure owned by Evidence',t=>{
  const f=fixture(t),before=f.read(),r=f.call('resume-interpreter','--continue-existing');assert.equal(r.status,1);assert.match(r.stderr,/INTERPRETER_QA_REPAIR_INVALID_STATE_OR_OWNER/);assert.deepEqual(f.read(),before);
});
test('repair requires absolute root and brand before dispatch',()=>{
  for(const command of ['resume-evidence','resume-interpreter']){const r=spawnSync(process.execPath,[entry,command,'--artifact-root','relative','--brand','example'],{encoding:'utf8'});assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).blockingCode,'LEARNING_REPAIR_ROOT_REQUIRED');}
});
