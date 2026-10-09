import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createBrandTestDirectory} from './brand-test-directory.mjs';
const entry=path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),internal=path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs');
function fixture(t){
 const temp=createBrandTestDirectory('learning-closure');t.after(()=>temp.cleanup());const root=temp.directory,brand='example',prefix=`migrations/${brand}/`;
 const save=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));return {path:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};};
 const goal=save(`${prefix}goal-contract.json`,{schema:'brand-goal/v2',sealed:true,goalId:'frozen',mode:'learn-brand',goalType:'brand-learning-capability-test',thresholds:{overall:80,maxAttempts:1},referencePages:[{id:'source'}]});
 const dims=['color','typography','radius','spacing','shadow','action-color'];
 const evidence=save(`${prefix}brand-evidence.json`,{claims:dims.map(id=>({id,status:'observed',salience:'high'})),dimensionCoverage:Object.fromEntries(dims.map(id=>[id,{status:'observed',claimIds:[id],sourceCount:1}]))});
 const intent=save(`${prefix}brand-intent.json`,{mappingCoverage:Object.fromEntries(dims.map(id=>[id,{status:'style-only',evidenceRefs:[id],sourceCount:1,styleRecipe:`scoped-${id}`,reason:'Observed scoped role',priorityReason:'Frozen source-only trial'}]))});
 const demo=save(`${prefix}demo.json`,{}),fidelity=save(`${prefix}fidelity-report.json`,{status:'scoped-pass',completionScope:'scoped-regression'});
 const manifest={schema:'brand-subagent-execution/v1',runId:'trial',mode:'learn-brand',goalSha256:goal.sha256,status:'passed',currentStageId:null,stages:[]};
 for(const [name,role,outputs,inputs] of [['evidence','brandResearcher',[evidence],[goal]],['interpreter','designTranslator',[intent],[goal,evidence]],['demo','demoImplementationAgent',[demo],[goal,intent]],['visualQA','visualQA',[fidelity],[goal,demo]]]){
  const stage={id:`${name}-1`,stage:name,role,status:'complete',verdict:'pass',attempt:1,agentExecutionId:`/root/${name}`,outputHashes:outputs};
  const receipt=save(`${prefix}receipts/${name}-1.json`,{stageId:stage.id,role,verdict:'pass',goalSha256:goal.sha256,agentExecutionId:stage.agentExecutionId,inputs,outputs});Object.assign(stage,{receiptPath:receipt.path,receiptSha256:receipt.sha256});manifest.stages.push(stage);
 }
 save(`${prefix}execution-manifest.json`,manifest);
 const run=(command,args=[])=>spawnSync(process.execPath,[internal,command,'--root',root,'--brand',brand,...args],{encoding:'utf8'});
 return {root,brand,prefix,save,goal,manifest,run};
}
test('public closure recovery freezes consumer refusal, routes missing MOD to Interpreter and preserves prior PASS bytes',t=>{
 const f=fixture(t),files=[`${f.prefix}goal-contract.json`,`${f.prefix}fidelity-report.json`,...f.manifest.stages.map(stage=>stage.receiptPath)],before=files.map(name=>fs.readFileSync(path.join(f.root,name)));
 const result=spawnSync(process.execPath,[entry,'resume-learning-closure','--artifact-root',f.root,'--brand',f.brand,'--continue-existing','--reason','User authorized continuation of the same frozen trial'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const recovered=JSON.parse(result.stdout);assert.equal(recovered.ownerRole,'designTranslator');assert.equal(recovered.nextStageId,'interpreter-2');
 files.forEach((name,i)=>assert.deepEqual(fs.readFileSync(path.join(f.root,name)),before[i]));
 const next=f.run('next');assert.equal(next.status,0,next.stderr);const packet=JSON.parse(next.stdout).dispatchRequest;assert(packet.expectedOutputs.includes('brand-mod.json'));assert.equal(packet.retryInput.closureRepair,undefined);assert(!packet.requiredInputs.some(ref=>/fidelity-report|visual-qa-assessment|consumer-rejection|receipts\//.test(ref.path)));assert(packet.requiredInputs.some(ref=>/brand-evidence/.test(ref.path)));
 const current=JSON.parse(fs.readFileSync(path.join(f.root,f.prefix,'execution-manifest.json')));assert.deepEqual(current.stages.slice(0,4),f.manifest.stages);
 const receipt=f.save(`${f.prefix}receipts/interpreter-2.json`,{dispatchId:packet.dispatchId,stageId:packet.stageId,role:'designTranslator',agentExecutionId:'/root/interpreter-repair',goalSha256:f.goal.sha256,verdict:'pass',inputs:packet.requiredInputs,outputs:[f.save(`${f.prefix}brand-intent.json`,JSON.parse(fs.readFileSync(path.join(f.root,f.prefix,'brand-intent.json'))))]});
 const record=f.run('record',['--receipt',receipt.path]);assert.notEqual(record.status,0);assert.match(record.stderr,/INTERPRETER_BRAND_MOD_OUTPUT_REQUIRED/);
 assert.notEqual(f.run('resume-learning-closure',['--continue-existing','--reason','again']).status,0);
});
test('closure recovery requires authorization and protects its frozen archive',t=>{
 const f=fixture(t);assert.notEqual(f.run('resume-learning-closure').status,0);
 const result=f.run('resume-learning-closure',['--continue-existing','--reason','authorized']);assert.equal(result.status,0,result.stderr);const repair=JSON.parse(result.stdout);
 fs.appendFileSync(path.join(f.root,repair.rejection.path),' ');const next=f.run('next');assert.notEqual(next.status,0);assert.match(next.stderr,/hash mismatch/);
});
