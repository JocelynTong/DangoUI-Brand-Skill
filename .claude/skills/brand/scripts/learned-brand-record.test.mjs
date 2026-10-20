import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

test('accepted interpreter record compiles a version-bound learning handoff, without host execution',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'learned-record-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const brand='fixture',prefix='migrations/fixture/';
  const put=(name,value)=>{const file=path.join(root,prefix,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));return {path:prefix+name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};};
  const dimensions=['color','typography','radius','spacing','shadow','action-color'];
  const goal=put('goal-contract.json',{sealed:true,mode:'learn-brand',evidencePolicy:{requiredVisualDimensions:dimensions}});
  const evidence=put('brand-evidence.json',{claims:dimensions.map(id=>({id,status:'observed'})),dimensionCoverage:Object.fromEntries(dimensions.map(id=>[id,{status:'observed',claimIds:[id],sourceCount:1}]))});
  const intent=put('brand-intent.json',{status:'scoped',mappingCoverage:Object.fromEntries(dimensions.map(id=>[id,{status:'style-only',sourceCount:1,evidenceRefs:[id],styleRecipe:id,reason:'Synthetic source scope',priorityReason:'Fixture'}]))});
  const outputs=[intent,put('brand-mod.json',{manifest:{brand,version:'fixture-v1'},tokens:{dtcg:{surface:{$value:'#fff'}}}}),put('component-mapping.json',{mappings:[]}),put('dangoui-adapter.json',{tokenMappings:[]})];
  const dispatch=put('dispatch/interpreter.json',{dispatchId:'fixture-dispatch',requiredInputs:[goal,evidence]});
  put('execution-manifest.json',{schema:'brand-subagent-execution/v1',mode:'learn-brand',goalSha256:goal.sha256,status:'running',currentStageId:'interpreter-1',stages:[{id:'interpreter-1',stage:'interpreter',role:'designTranslator',status:'dispatched',dispatchId:'fixture-dispatch',dispatchPath:dispatch.path,startedAt:new Date().toISOString()}]});
  const receipt=put('receipts/interpreter.json',{dispatchId:'fixture-dispatch',stageId:'interpreter-1',role:'designTranslator',agentExecutionId:'/root/synthetic-test-only',goalSha256:goal.sha256,verdict:'pass',inputs:[goal,evidence],outputs});
  const run=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'record','--root',root,'--brand',brand,'--receipt',receipt.path],{encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,prefix,'execution-manifest.json')));
  const derived=manifest.stages[0].derivedLearningInput;
  assert.equal(derived.version,'fixture-v1');
  assert(fs.existsSync(path.join(root,derived.path)));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,derived.path))).learningStatus,'scoped');
  assert.equal(fs.existsSync(path.join(root,'host')),false);
});
