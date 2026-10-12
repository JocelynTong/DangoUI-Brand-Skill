import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { evaluateHostDelivery } from './parent-delivery-gate.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-mechanical-retry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const brand = 'fixture', prefix = `migrations/${brand}/`;
  const save = (name, value) => {
    const file = path.join(root, prefix, name);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return {path: prefix + name, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
  };
  const goal = save('goal-contract.json', {sealed:true, mode:'design-host', requestKind:'host-concepts', executionProfile:'fast', thresholds:{maxAttempts:1}});
  const input = save('brand-mod.json', {frozen:true});
  const artifacts = ['a','b','c'].map(id => ({id, artifact:save(`h5-directions/${id}.html`, `<button>${id}</button>`)}));
  const route = save('design-host-route.json', {h5Directions:{directions:artifacts}});
  const dispatch = save('dispatch.json', {dispatchId:'dispatch', stageId:'h5DirectionGeneration-1', goalSha256:goal.sha256, requiredInputs:[input]});
  const outputs = [...artifacts.map(item=>item.artifact), route];
  const receipt = save('receipts/producer.json', {stageId:'h5DirectionGeneration-1', dispatchId:'dispatch', goalSha256:goal.sha256, verdict:'pass', inputs:[input], outputs});
  const producer = {id:'h5DirectionGeneration-1',stage:'h5DirectionGeneration',role:'brandApplicationDesigner',attempt:1,status:'complete',verdict:'pass',dispatchPath:dispatch.path,receiptPath:receipt.path,receiptSha256:receipt.sha256,outputHashes:outputs};
  const qa = {id:'designVisualQA-1',stage:'designVisualQA',role:'visualQA',status:'pending'};
  const manifest = {mode:'design-host',status:'running',goalSha256:goal.sha256,currentStageId:qa.id,stages:[producer,qa]};
  const report = {schema:'design-host-h5-mechanical-qa/v1',brand,verdict:'fail',route,directions:artifacts.map(item=>({directionId:item.id,artifact:item.artifact})),blockingFindings:[{directionId:'a',code:'FILTER_CONTROL_MISSING'}]};
  save('design-host-h5-mechanical-qa.json', report);
  const flush=()=>save('execution-manifest.json',manifest);
  flush();
  const call=(...args)=>spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),...args,'--root',root,'--brand',brand],{encoding:'utf8'});
  return {root,brand,save,manifest,report,producer,qa,flush,call};
}

test('post-producer mechanical FAIL is blocked, not pending/continue',t=>{
  const f=fixture(t), result=evaluateHostDelivery(f);
  assert.equal(result.status,'blocked');
  assert.equal(result.nextAction,'repair-mechanical-audit-or-retry-h5');
  assert.deepEqual(result.errors,['H5_MECHANICAL_QA_FAILED']);
  f.save('h5-directions/a.html','changed after audit');
  assert.deepEqual(evaluateHostDelivery(f).errors,['H5_MECHANICAL_QA_BINDING_INVALID']);
});
test('bound mechanical failure permits one local producer retry, preserving PASS and report',t=>{
  const f=fixture(t), prior=structuredClone(f.producer);
  assert.match(f.call('retry-h5').stderr,/EXPLICIT_CONTINUATION_REQUIRED/);
  const result=f.call('retry-h5','--continue-existing');
  assert.equal(result.status,0,result.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/fixture/execution-manifest.json')));
  assert.deepEqual(manifest.stages[0],prior);
  assert.equal(manifest.stages[1].status,'cancelled');
  assert.equal(manifest.stages[2].attempt,2);
  assert.equal(manifest.stages[2].retryInput.blockingFindings[0].code,'FILTER_CONTROL_MISSING');
  const archive=JSON.parse(fs.readFileSync(path.join(f.root,JSON.parse(result.stdout).archive.path)));
  assert.ok(archive.archivedOutputs.some(item=>item.originalPath.endsWith('design-host-h5-mechanical-qa.json')));
});
test('mechanical retry rejects changed H5 and frozen brand input',t=>{
  const f=fixture(t);
  f.save('h5-directions/a.html','changed');
  assert.match(f.call('retry-h5','--continue-existing').stderr,/hash mismatch/);
  f.save('h5-directions/a.html','<button>a</button>');
  f.save('brand-mod.json',{frozen:false});
  assert.match(f.call('retry-h5','--continue-existing').stderr,/hash mismatch/);
});
test('mechanical retry refuses already-dispatched QA',t=>{
  const f=fixture(t);f.qa.status='dispatched';f.qa.dispatchPath='qa.json';f.flush();
  assert.match(f.call('retry-h5','--continue-existing').stderr,/FAILED_STAGE_REQUIRED/);
});
test('fast maxAttempts=1 allows explicit repair once, not repeated mechanical continuations',t=>{
  const f=fixture(t), goalFile=path.join(f.root,'migrations/fixture/goal-contract.json'), originalGoal=fs.readFileSync(goalFile);
  assert.equal(f.call('retry-h5','--continue-existing').status,0);
  assert.deepEqual(fs.readFileSync(goalFile),originalGoal);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/fixture/execution-manifest.json')));
  assert.equal(manifest.h5Retries[0].kind,'pre-qa-mechanical-repair');
  assert.equal(manifest.h5Retries[0].additionalAttempts,1);
  const producer=manifest.stages.at(-1);
  const input={path:'migrations/fixture/brand-mod.json',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(f.root,'migrations/fixture/brand-mod.json'))).digest('hex')};
  const dispatch=f.save('dispatch-2.json',{stageId:producer.id,dispatchId:'dispatch2',goalSha256:manifest.goalSha256,requiredInputs:[input]});
  const receipt=f.save('receipts/producer-2.json',{stageId:producer.id,dispatchId:'dispatch2',goalSha256:manifest.goalSha256,verdict:'pass',inputs:[input],outputs:f.producer.outputHashes});
  Object.assign(producer,{status:'complete',verdict:'pass',dispatchPath:dispatch.path,receiptPath:receipt.path,receiptSha256:receipt.sha256,outputHashes:f.producer.outputHashes});
  manifest.stages.push({...f.qa,id:'designVisualQA-2'});
  manifest.currentStageId='designVisualQA-2';
  f.save('execution-manifest.json',manifest);
  assert.match(f.call('retry-h5','--continue-existing').stderr,/BUDGET_EXHAUSTED/);
});
test('mechanical retry rejects successful, foreign and duplicate-direction reports',t=>{
  const f=fixture(t);
  for (const change of [{verdict:'pass'},{brand:'other'},{directions:[f.report.directions[0],f.report.directions[0],f.report.directions[2]]}]) {
    f.save('design-host-h5-mechanical-qa.json',{...f.report,...change});
    assert.match(f.call('retry-h5','--continue-existing').stderr,/MECHANICAL_RETRY_(REPORT|ARTIFACT_BINDING)_INVALID/);
  }
});
test('next records mechanical blockage without rewriting producer PASS or dispatching QA',t=>{
  const f=fixture(t), skill=path.join(f.root,'skill');
  fs.mkdirSync(path.join(skill,'scripts'),{recursive:true});
  fs.writeFileSync(path.join(skill,'scripts/audit-design-host-h5-mechanics.mjs'),'process.exit(2);');
  const run=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--root',f.root,'--brand',f.brand],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
  assert.match(run.stderr,/H5_MECHANICAL_QA_FAILED/);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/fixture/execution-manifest.json')));
  assert.equal(manifest.status,'blocked');
  assert.deepEqual(manifest.stages[0],f.producer);
  assert.equal(manifest.stages[1].status,'pending');
  assert.equal(manifest.stages[1].dispatchPath,undefined);
  assert.ok(manifest.mechanicalFailure.report.sha256);
  assert.equal(f.call('retry-h5','--continue-existing').status,0);
});
function recoveryFixture(t,{overwritten=false}={}) {
 const f=fixture(t),reportFile=path.join(f.root,'migrations/fixture/design-host-h5-mechanical-qa.json');
 const failure={code:'H5_MECHANICAL_QA_FAILED',producerStageId:f.producer.id,qaStageId:f.qa.id,report:{path:'migrations/fixture/design-host-h5-mechanical-qa.json',sha256:crypto.createHash('sha256').update(fs.readFileSync(reportFile)).digest('hex')},recordedAt:'2026-01-01T00:00:00Z'};
 Object.assign(f.manifest,{status:'blocked',mechanicalFailure:failure,deadlineAt:'2026-01-01T00:20:00Z'});f.flush();
 const passed={...f.report,verdict:'pass',blockingFindings:[]};if(overwritten)f.save('design-host-h5-mechanical-qa.json',passed);
 const skill=path.join(f.root,'recovery-skill');fs.mkdirSync(path.join(skill,'scripts'),{recursive:true});
 fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{visualQA:{}}}));
 fs.writeFileSync(path.join(skill,'scripts/audit-design-host-h5-mechanics.mjs'),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(reportFile)},${JSON.stringify(JSON.stringify(passed))});`);
 const recover=(flags=['--continue-existing'])=>spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--root',f.root,'--brand',f.brand,'--resume-mechanical',...flags],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
 return {...f,failure,recover};
}
for(const overwritten of [false,true])test('current QA recovery preserves history and records missing prior report bytes='+overwritten,t=>{
 const f=recoveryFixture(t,{overwritten}),before=structuredClone(f.producer);f.recover();
 const state=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/fixture/execution-manifest.json'))),recovery=state.mechanicalQaRecoveries[0];
 assert.equal(state.status,'running');assert.deepEqual(state.stages[0],before);assert.deepEqual(state.mechanicalFailure,f.failure);
 assert.equal(recovery.priorReportBytesUnavailable,overwritten);assert.equal(recovery.priorDeadlineAt,'2026-01-01T00:20:00Z');assert.equal(recovery.scope,'current-pending-qa-only-no-new-production');
 assert.equal(state.stages.length,2);assert(Date.parse(state.deadlineAt)>Date.now());
 const archive=JSON.parse(fs.readFileSync(path.join(f.root,recovery.archive.path)));assert.deepEqual(archive.consumerRejection.priorFailure,f.failure);assert(archive.archivedOutputs.some(ref=>ref.originalPath.endsWith('design-host-h5-mechanical-qa.json')));
 assert.match(f.recover().stderr,/NOT_ALLOWED|not pending/);
});
for(const kind of ['no-authority','changed-input','changed-h5','dispatched','garbage-report'])test('current QA recovery rejects '+kind,t=>{
 const f=recoveryFixture(t);
 if(kind==='changed-input')f.save('brand-mod.json',{changed:true});
 if(kind==='changed-h5')f.save('h5-directions/a.html','changed');
 if(kind==='dispatched'){f.qa.dispatchPath='already.json';f.flush();}
 if(kind==='garbage-report')f.save('design-host-h5-mechanical-qa.json',{...f.report,verdict:'unknown',blockingFindings:[]});
 const before=fs.readFileSync(path.join(f.root,'migrations/fixture/execution-manifest.json'));
 const run=f.recover(kind==='no-authority'?[]:undefined);assert.notEqual(run.status,0);assert.deepEqual(fs.readFileSync(path.join(f.root,'migrations/fixture/execution-manifest.json')),before);
 assert.equal(fs.existsSync(path.join(f.root,'migrations/fixture/attempts')),false);
});

for (const change of [null, 'capture', 'route', 'report', 'dispatch', 'html', 'brand']) test('visual QA continuation reuses frozen proof; mutation='+change,t=>{
  const f=fixture(t);
  const captures=f.report.directions.map((d,i)=>f.save(`capture-${i}.png`,'frozen pixels '+i));
  const report=f.save('design-host-h5-mechanical-qa.json', {...f.report,verdict:'pass',blockingFindings:[],directions:f.report.directions.map((d,i)=>({...d,capture:captures[i]}))});
  const brandInput=f.save('brand-mod.json',{frozen:true});
  const dispatch=f.save('qa-dispatch.json',{stageId:f.qa.id,goalSha256:f.manifest.goalSha256,requiredInputs:[report,brandInput,...captures]});
  Object.assign(f.qa,{status:'failed',dispatchPath:dispatch.path,dispatchSha256:dispatch.sha256});
  f.manifest.stages.push({...f.qa,id:'designVisualQA-2',status:'pending',dispatchPath:undefined,dispatchSha256:undefined});
  f.manifest.currentStageId='designVisualQA-2';
  f.manifest.continuations=[{kind:'explicit-user-request-to-continue-existing-visual-qa-stage',stageId:'designVisualQA-2',abandonedStageId:f.qa.id}];
  f.flush();
  const skill=path.join(f.root,'no-browser');fs.mkdirSync(path.join(skill,'scripts'),{recursive:true});
  // A later contract error is intentional: reaching it proves no browser launch.
  fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{}}));
  const marker=path.join(f.root,'browser-was-started');
  fs.writeFileSync(path.join(skill,'scripts/audit-design-host-h5-mechanics.mjs'),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'bad');process.exit(2);`);
  if(change==='capture')f.save('capture-0.png','changed');
  if(change==='route')f.save('design-host-route.json',{changed:true});
  if(change==='report')f.save('design-host-h5-mechanical-qa.json',{changed:true});
  if(change==='dispatch')f.save('qa-dispatch.json',{changed:true});
  if(change==='html')f.save('h5-directions/a.html','changed');
  if(change==='brand')f.save('brand-mod.json',{changed:true});
  const run=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--root',f.root,'--brand',f.brand],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
  assert.match(run.stderr,change?/hash mismatch/:/Missing role contract/);
  assert.equal(fs.existsSync(marker),false);
});
