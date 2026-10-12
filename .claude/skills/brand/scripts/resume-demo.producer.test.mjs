import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {createBrandTestDirectory} from './brand-test-directory.mjs';
const script=path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs');
function fixture(t){
  const temp=createBrandTestDirectory('demo-producer');t.after(()=>temp.cleanup());const root=temp.directory,dir=path.join(root,'migrations/fixture'),skill=path.join(root,'skills/brand');fs.mkdirSync(path.join(dir,'receipts'),{recursive:true});fs.mkdirSync(path.join(skill,'scripts'),{recursive:true});
  const write=(n,j)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(j));const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));const bound=n=>({path:'migrations/fixture/'+n,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')});
  write('goal-contract.json',{sealed:true,mode:'learn-brand',thresholds:{maxAttempts:1}});write('direction.json',{approved:true});write('demo.html','original bytes');
  const goalSha256=bound('goal-contract.json').sha256;write('dispatch.json',{dispatchId:'real-dispatch',stageId:'demo-1',goalSha256,requiredInputs:[bound('goal-contract.json'),bound('direction.json')]});
  const findings=[{code:'ASSET_SCOPE',ownerRole:'designDirectorOrchestrator'}],scope={affectedSections:['header'],inputPaths:['migrations/fixture/direction.json'],regressionSections:['held-out']};
  write('receipts/demo-1.json',{dispatchId:'real-dispatch',stageId:'demo-1',role:'demoImplementationAgent',goalSha256,verdict:'needs-evidence',inputs:[bound('goal-contract.json'),bound('direction.json')],outputs:[bound('demo.html')],blockingFindings:findings,deltaScope:scope});
  const stage={id:'demo-1',stage:'demo',role:'demoImplementationAgent',attempt:1,status:'failed',verdict:'needs-evidence',dispatchPath:bound('dispatch.json').path,receiptPath:bound('receipts/demo-1.json').path,receiptSha256:bound('receipts/demo-1.json').sha256,outputHashes:[bound('demo.html')],blockingFindings:findings,deltaScope:scope};
  const manifest={mode:'learn-brand',brand:'fixture',runId:'fixture',goalSha256,status:'blocked',currentStageId:null,stages:[stage]};write('execution-manifest.json',manifest);
  const repair={schema:'brand-demo-director-repair/v1',ownerRole:'designDirectorOrchestrator',goalSha256,rejectedStageId:stage.id,rejectedReceipt:bound('receipts/demo-1.json'),inputs:[bound('direction.json')],decision:'scoped local correction'};write('repair.json',repair);
  fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{demoImplementationAgent:{goal:'implement'}}}));fs.writeFileSync(path.join(skill,'scripts/validate-design-direction.mjs'),'process.exit(0)');
  const run=(extra=[],command='resume-demo')=>spawnSync(process.execPath,[script,command,'--brand','fixture','--root',root,...extra],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
  return{root,dir,write,read,bound,manifest,repair,run};
}
test('authorized producer repair archives authentic bytes, freezes supplement and preserves history',t=>{
 const f=fixture(t),before=new Map(['goal-contract.json','receipts/demo-1.json','dispatch.json','demo.html'].map(n=>[n,fs.readFileSync(path.join(f.dir,n))]));
 assert.notEqual(f.run().status,0);assert.equal(fs.existsSync(path.join(f.dir,'attempts')),false);
 const r=f.run(['--continue-existing','--repair-input','migrations/fixture/repair.json']);assert.equal(r.status,0,r.stderr);const updated=f.read('execution-manifest.json');assert.deepEqual(updated.stages[0],f.manifest.stages[0]);assert.equal(updated.stages.at(-1).attempt,2);assert.deepEqual(updated.stages.at(-1).retryInput.deltaScope,f.manifest.stages[0].deltaScope);assert.equal(updated.demoProducerRetries[0].additionalAttempts,1);assert.notEqual(f.run(['--continue-existing']).status,0);
 const archive=JSON.parse(fs.readFileSync(path.join(f.root,updated.demoProducerRetries[0].archive.path)));for(const [n,bytes]of before){assert.deepEqual(fs.readFileSync(path.join(f.dir,n)),bytes);if(n!=='goal-contract.json'){const copy=archive.archivedOutputs.find(b=>b.originalPath==='migrations/fixture/'+n);assert.ok(copy);assert.deepEqual(fs.readFileSync(path.join(f.root,copy.path)),bytes)}}
 const next=f.run([],'next');assert.equal(next.status,0,next.stderr);const inputs=JSON.parse(next.stdout).dispatchRequest.requiredInputs;assert.ok(inputs.some(b=>b.path===updated.demoProducerRetries[0].archive.path));assert.ok(inputs.some(b=>b.path===f.bound('repair.json').path&&b.sha256===f.bound('repair.json').sha256));f.write('demo.html','replacement');assert.equal(f.run([],'status').status,0);const copy=archive.archivedOutputs.find(b=>b.originalPath.endsWith('/demo.html'));assert.deepEqual(fs.readFileSync(path.join(f.root,copy.path)),before.get('demo.html'));
 fs.writeFileSync(path.join(f.root,copy.path),'tamper');assert.notEqual(f.run([],'status').status,0);
});
for(const [name,mutate]of[
 ['receipt tamper',f=>f.write('receipts/demo-1.json',{changed:true})],['output tamper',f=>f.write('demo.html','changed')],['goal tamper',f=>f.write('goal-contract.json',{changed:true})],['stale repair',f=>{f.repair.rejectedStageId='old';f.write('repair.json',f.repair)}],['pass stage',f=>{f.manifest.stages[0].verdict='pass';f.write('execution-manifest.json',f.manifest)}],['nonlatest stage',f=>{f.manifest.stages.push({id:'interpreter-2',role:'designTranslator',status:'failed',verdict:'needs-evidence'});f.write('execution-manifest.json',f.manifest)}],['consumed failure',f=>{f.manifest.demoProducerRetries=[{priorStageId:'demo-1'}];f.write('execution-manifest.json',f.manifest)}]
])test('reject '+name,t=>{const f=fixture(t);mutate(f);const before=fs.readFileSync(path.join(f.dir,'execution-manifest.json'));assert.notEqual(f.run(['--continue-existing','--repair-input','migrations/fixture/repair.json']).status,0);assert.deepEqual(fs.readFileSync(path.join(f.dir,'execution-manifest.json')),before)});
test('repair supplement tampering blocks later dispatch',t=>{const f=fixture(t);assert.equal(f.run(['--continue-existing','--repair-input','migrations/fixture/repair.json']).status,0);f.write('repair.json',{changed:true});assert.notEqual(f.run([],'next').status,0)});
function consumerFixture(t) {
 const f=fixture(t),goal=f.read('goal-contract.json');goal.goalType='brand-learning-capability-test';f.write('goal-contract.json',goal);f.manifest.goalSha256=f.bound('goal-contract.json').sha256;
 f.write('visual-pattern-inventory.json',{schema:'brand-visual-pattern-inventory/v1',pages:[]});
 const dispatch=f.read('dispatch.json');dispatch.goalSha256=f.manifest.goalSha256;dispatch.requiredInputs=[f.bound('goal-contract.json'),f.bound('direction.json')];f.write('dispatch.json',dispatch);
 const receipt=f.read('receipts/demo-1.json');Object.assign(receipt,{goalSha256:f.manifest.goalSha256,verdict:'pass',inputs:dispatch.requiredInputs,outputs:[f.bound('demo.html'),f.bound('visual-pattern-inventory.json')]});f.write('receipts/demo-1.json',receipt);
 Object.assign(f.manifest.stages[0],{attempt:2,status:'complete',verdict:'pass',receiptSha256:f.bound('receipts/demo-1.json').sha256,outputHashes:receipt.outputs});
 f.manifest.stages.push({id:'visualQA-2',stage:'visualQA',role:'visualQA',status:'pending'});Object.assign(f.manifest,{status:'running',currentStageId:'visualQA-2'});f.write('execution-manifest.json',f.manifest);return f;
}
test('accepted producer can repair a real pre-QA contract rejection without inventing a QA failure',t=>{
 const f=consumerFixture(t),original=structuredClone(f.manifest.stages[0]),receipt=fs.readFileSync(path.join(f.dir,'receipts/demo-1.json'));
 assert.notEqual(f.run().status,0);assert(!fs.existsSync(path.join(f.dir,'attempts')));
 const result=f.run(['--continue-existing']);assert.equal(result.status,0,result.stderr);
 const state=f.read('execution-manifest.json');assert.deepEqual(state.stages[0],original);assert.equal(state.stages[1].status,'cancelled');assert.equal(state.stages[1].verdict,undefined);assert.equal(state.stages.at(-1).retryInput.blockingFindings[0].code,'QA_REVIEW_PATTERN_ATTEMPT_REQUIRED');assert.deepEqual(fs.readFileSync(path.join(f.dir,'receipts/demo-1.json')),receipt);
 assert(state.stages.at(-1).retryInput.frozenInputs.some(ref=>ref.path.endsWith('/direction.json')));f.write('demo.html','repaired');const status=f.run([],'status');assert.equal(status.status,0,status.stderr);
 const archive=JSON.parse(fs.readFileSync(path.join(f.root,state.demoProducerRetries[0].archive.path)));assert.equal(archive.consumerRejection.pendingQa.status,'pending');
 state.stages[1].verdict='fail';f.write('execution-manifest.json',state);assert.notEqual(f.run([],'status').status,0);
});
for(const [name,mutate]of[
 ['prepared QA',f=>{f.manifest.stages[1].dispatchPath='dispatch/qa.json';}],
 ['first producer default',f=>{f.manifest.stages[0].attempt=1;}],
 ['valid inventory',f=>{f.write('visual-pattern-inventory.json',{schema:'brand-visual-pattern-inventory/v1',attempt:1});f.manifest.stages[0].outputHashes[1]=f.bound('visual-pattern-inventory.json');}],
 ['inventory tamper',f=>{f.write('visual-pattern-inventory.json',{tampered:true});}]
])test('consumer repair rejects '+name,t=>{const f=consumerFixture(t);mutate(f);f.write('execution-manifest.json',f.manifest);const before=fs.readFileSync(path.join(f.dir,'execution-manifest.json'));assert.notEqual(f.run(['--continue-existing']).status,0);assert.deepEqual(fs.readFileSync(path.join(f.dir,'execution-manifest.json')),before);assert(!fs.existsSync(path.join(f.dir,'attempts')))});
for(const tamper of [false,true])test(`consumer repair resolves only authentic archived same-path producer input (tamper=${tamper})`,t=>{
 const f=consumerFixture(t);f.write('old-inventory.json',{schema:'brand-visual-pattern-inventory/v1',old:true});
 const originalPath='migrations/fixture/visual-pattern-inventory.json',copy={...f.bound('old-inventory.json'),originalPath},oldInput={path:originalPath,sha256:copy.sha256};
 f.write('preservation.json',{archivedOutputs:[copy]});f.manifest.stages[0].retryInput={priorQaPreservation:f.bound('preservation.json')};
 const dispatch=f.read('dispatch.json');dispatch.requiredInputs.push(oldInput);f.write('dispatch.json',dispatch);
 const receipt=f.read('receipts/demo-1.json');receipt.inputs.push(oldInput);f.write('receipts/demo-1.json',receipt);f.manifest.stages[0].receiptSha256=f.bound('receipts/demo-1.json').sha256;f.write('execution-manifest.json',f.manifest);
 if(tamper)f.write('old-inventory.json',{tampered:true});
 const result=f.run(['--continue-existing']);
 if(tamper){assert.notEqual(result.status,0);assert(!fs.existsSync(path.join(f.dir,'attempts')));}
 else {assert.equal(result.status,0,result.stderr);const inputs=f.read('execution-manifest.json').stages.at(-1).retryInput.frozenInputs;assert(inputs.some(ref=>ref.path===copy.path&&ref.sha256===copy.sha256));assert(!inputs.some(ref=>ref.path===oldInput.path));}
});
test('QA-triggered retry preserves bound Demo and QA-consumed bytes before the next producer can overwrite them',t=>{
 const f=fixture(t),demoReceipt=f.read('receipts/demo-1.json');f.write('design-direction.json',{approved:true});demoReceipt.verdict='pass';f.write('receipts/demo-1.json',demoReceipt);Object.assign(f.manifest.stages[0],{status:'complete',verdict:'pass',receiptSha256:f.bound('receipts/demo-1.json').sha256});
 f.write('qa-assessment.json',{reviewerRecommendation:'fail'});f.write('qa-dispatch.json',{dispatchId:'qa-dispatch',stageId:'qa-1',goalSha256:f.manifest.goalSha256,requiredInputs:[f.bound('goal-contract.json'),f.bound('direction.json'),f.bound('demo.html')]});
 f.write('receipts/qa-1.json',{dispatchId:'qa-dispatch',stageId:'qa-1',role:'visualQA',goalSha256:f.manifest.goalSha256,verdict:'fail',inputs:[f.bound('goal-contract.json'),f.bound('direction.json'),f.bound('demo.html')],outputs:[f.bound('qa-assessment.json')]});
 f.manifest.stages.push({id:'qa-1',stage:'visualQA',role:'visualQA',status:'failed',verdict:'fail',dispatchPath:f.bound('qa-dispatch.json').path,receiptPath:f.bound('receipts/qa-1.json').path,receiptSha256:f.bound('receipts/qa-1.json').sha256,outputHashes:[f.bound('qa-assessment.json')],blockingFindings:[{code:'QA_FIX'}]});f.write('execution-manifest.json',f.manifest);
 assert.notEqual(f.run().status,0);const resumed=f.run(['--continue-existing']);assert.equal(resumed.status,0,resumed.stderr);
 const updated=f.read('execution-manifest.json'),ledger=updated.demoQaRetries[0],archive=JSON.parse(fs.readFileSync(path.join(f.root,ledger.archive.path)));assert.equal(updated.stages.at(-1).retryInput.blockingFindings[0].code,'QA_FIX');assert.equal(updated.demoProducerRetries,undefined);assert.equal(ledger.priorQaStageId,'qa-1');assert.equal(ledger.priorDemoStageId,'demo-1');
 for(const ref of [...demoReceipt.inputs,...demoReceipt.outputs,...f.read('receipts/qa-1.json').inputs])assert(archive.archivedOutputs.some(copy=>copy.originalPath===ref.path&&copy.sha256===ref.sha256),ref.path);
 const next=f.run([],'next');assert.equal(next.status,0,next.stderr);assert(JSON.parse(next.stdout).dispatchRequest.requiredInputs.some(ref=>ref.path===ledger.archive.path&&ref.sha256===ledger.archive.sha256));
 const boundManifest=fs.readFileSync(path.join(f.dir,'execution-manifest.json')),tampered=JSON.parse(boundManifest);tampered.demoQaRetries[0].priorDemoStageId='other-demo';f.write('execution-manifest.json',tampered);assert.notEqual(f.run([],'status').status,0);fs.writeFileSync(path.join(f.dir,'execution-manifest.json'),boundManifest);
 const oldCopy=archive.archivedOutputs.find(copy=>copy.originalPath.endsWith('/demo.html'));f.write('demo.html','replacement');assert.equal(f.run([],'status').status,0);assert.equal(fs.readFileSync(path.join(f.root,oldCopy.path),'utf8'),JSON.stringify('original bytes'));
 fs.writeFileSync(path.join(f.root,oldCopy.path),'tamper');assert.notEqual(f.run([],'status').status,0);
});
