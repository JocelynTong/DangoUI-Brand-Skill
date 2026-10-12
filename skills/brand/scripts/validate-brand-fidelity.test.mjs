import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createBrandTestDirectory} from './brand-test-directory.mjs';
import {readCanonicalLearningProof} from './learning-proof-contract.mjs';

const script=path.resolve('skills/brand/scripts/validate-brand-fidelity.mjs');
function fixture(t) {
  const temp=createBrandTestDirectory('fidelity-contract');t.after(()=>temp.cleanup());
  const root=temp.directory,dir=path.join(root,'migrations/example');fs.mkdirSync(dir,{recursive:true});
  const put=(name,value)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value));return {path:path.relative(root,file),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};};
  const goal=put('goal-contract.json',{schema:'brand-goal/v2',sealed:true,goalId:'frozen',referencePages:[{id:'home'}],mustPreserve:[],mustNotReplace:[]});
  const source=put('source.png','source'),demo=put('demo.png','demo');
  const inventory={schema:'brand-visual-pattern-inventory/v1',goalSha256:goal.sha256,attempt:1,pages:[{demoPageId:'home-demo',patterns:[]}]};
  const inventoryRef=put('visual-pattern-inventory.json',inventory);
  const manifest={schema:'brand-blind-qa-input/v1',goalSha256:goal.sha256,attempt:1,qaExecutionId:'qa',implementationExecutionId:'producer',forbiddenInputsAbsent:{implementationRationale:true,priorVerdict:true,buildPassAsVisualEvidence:true,mainConversation:true},allowedInputs:[{...inventoryRef,kind:'visual-pattern-inventory'}]};
  put('qa-input-manifest.json',manifest);
  const dimensions=Object.fromEntries(['composition','assetAuthenticity','colorRoles','informationDensity','typographyGraphics','motionSemantics','brandRecognition'].map(key=>[key,{rating:4,observations:[{sourceRegion:[0,0,1,1],demoRegion:[0,0,1,1],finding:'Observed matching layout'}]}]));
  const assessment={schema:'brand-visual-qa-assessment/v2',goalSha256:goal.sha256,attempt:1,qaExecutionId:'qa',reviewerRecommendation:'pass',pages:[{sourcePageId:'home',demoPageId:'home-demo',sourceScreenshot:source,demoScreenshot:demo,dimensions}]};
  put('visual-qa-assessment.json',assessment);
  const run=(args=[])=>{const result=spawnSync(process.execPath,[script,'--root',root,'--brand','example',...args],{encoding:'utf8'});return {...result,report:result.stdout?JSON.parse(result.stdout):null};};
  return {root,dir,put,run,assessment,inventory,manifest};
}
function learningFixture(t) {
  const f=fixture(t),goal=JSON.parse(fs.readFileSync(path.join(f.dir,'goal-contract.json')));
  Object.assign(goal,{goalType:'brand-learning-capability-test',nonGoals:['website-mirror','host-apply','branded-asset-template'],learningProofContract:{evidenceFidelity:{required:true},structuralFidelity:{required:true},generativeProof:{required:true}},implementationPolicy:{allowSourceScreenshotAsRuntimeAsset:false},mustPreserve:[{id:'frame',dimensions:['composition'],requiredOn:['home']}],mustNotReplace:[{id:'identity'}]});
  const binding=f.put('goal-contract.json',goal);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9oCBcAAAAASUVORK5CYII=','base64');
  const source=f.put('source.png',png),demo=f.put('demo.png',Buffer.concat([png,Buffer.from('demo')])),heldOut=f.put('held-out.png',Buffer.concat([png,Buffer.from('held-out')]));
  const asset=f.put('official.png',Buffer.concat([png,Buffer.from('official original asset')]));
  const layers=[{id:'frame',role:'frame',sourceRegion:[0,0,1,0.4],demoRegion:[0,0,1,0.4]},{id:'foreground',role:'foreground',sourceRegion:[0.1,0.5,0.8,0.3],demoRegion:[0.1,0.5,0.8,0.3]}];
  const identity={identity:'campaign',variant:'original'};
  f.put('approved-visual-patterns.json',{patterns:[{id:'approved-frame',compositionContract:{sourceAsset:identity,requiredLayers:layers}}]});
  f.inventory.goalSha256=binding.sha256;
  f.inventory.pages[0].patterns=[{id:'hero',salience:'high',approvedPatternId:'approved-frame',demoRegion:[0,0,1,1],evidenceRefs:[{evidenceId:'source-home',sourcePageId:'home',sourceRegion:[0,0,1,1]}],selfCheck:'pass',asset:asset.path,assetProvenance:{sourceUrl:'https://example.com/official.png',sourceSha256:asset.sha256,role:'campaign',sourceKind:'original-site-asset'},preserves:['frame'],compositionSupport:{sourceAsset:identity,demoAsset:identity,layers}}];
  Object.assign(f.assessment,{goalSha256:binding.sha256,generativeProofReview:{status:'pass',ruleChecks:[{recipeId:'framing',status:'reused',finding:'Framing persisted with new content'},{recipeId:'hierarchy',status:'reused',finding:'Foreground hierarchy persisted'}]}});
  Object.assign(f.assessment.pages[0],{sourceScreenshot:source,demoScreenshot:demo,mustPreserve:[{id:'frame',status:'pass'}],mustNotReplace:[{id:'identity',violated:false}],visualPatterns:[{id:'hero',status:'supported',sourceRegion:[0,0,1,1],demoRegion:[0,0,1,1],finding:'Matched official composition',compositionLayers:layers.map(layer=>({id:layer.id,status:'matched',finding:'Bounded structural layer matched'}))}]});
  const generative={schema:'brand-generative-proof/v1',goalSha256:binding.sha256,challenge:{id:'held-out',heldOut:true,sourceContentIndependent:true,contentChange:'New content replaces campaign text'},frozenRules:[{recipeId:'framing',frozenBeforeChallenge:true},{recipeId:'hierarchy',frozenBeforeChallenge:true}],output:{demoPageId:'held-out',screenshot:heldOut},checks:{brandCueSubstitution:false,structureRulesApplied:['framing','hierarchy']}};
  const proof=f.put('generative-proof.json',generative);
  const save=()=>{const inventory=f.put('visual-pattern-inventory.json',f.inventory);Object.assign(f.manifest,{goalSha256:binding.sha256,allowedInputs:[{...inventory,kind:'visual-pattern-inventory'},{...proof,kind:'generative-proof'},{...source,kind:'source-screenshot'}]});f.put('qa-input-manifest.json',f.manifest);f.put('visual-qa-assessment.json',f.assessment);};
  save();return {...f,save};
}
test('complete learning CLI passes all three frozen proofs; layer, observation and unknown recipe gaps block',t=>{
  const f=learningFixture(t),result=f.run();assert.equal(result.status,0,JSON.stringify(result.report));assert.equal(result.report.overallScore,100);assert.equal(result.report.thresholds.overall,80);assert.equal(readCanonicalLearningProof(result.report).threeProofsPassed,true);
  const original=structuredClone(f.assessment);
  f.assessment.pages[0].visualPatterns[0].compositionLayers.pop();f.save();assert.notEqual(f.run().status,0);
  Object.assign(f.assessment,structuredClone(original));f.assessment.pages[0].dimensions.composition.observations=[];f.save();assert.notEqual(f.run().status,0);
  Object.assign(f.assessment,structuredClone(original));f.assessment.generativeProofReview.ruleChecks[1].recipeId='unknown';f.save();const unknown=f.run();assert.notEqual(unknown.status,0);assert(unknown.report.protocolFailures.some(x=>x.code==='GENERATIVE_RULE_REVIEW_INCOMPLETE'));
});
test('composition asset arrays compare by exact structured content and preserve id, order, variant and hash',t=>{
  const f=learningFixture(t);
  const sourceAsset={identity:['inline-58','wordmark'],variant:[
    {id:'inline-58',path:'output/inline-58.svg',sha256:'a'.repeat(64),variant:'observed-frame'},
    {id:'wordmark',path:'output/wordmark.svg',sha256:'b'.repeat(64),variant:'observed-wordmark'},
  ]};
  const approved=JSON.parse(fs.readFileSync(path.join(f.dir,'approved-visual-patterns.json')));
  approved.patterns[0].compositionContract.sourceAsset=structuredClone(sourceAsset);f.put('approved-visual-patterns.json',approved);
  const support=f.inventory.pages[0].patterns[0].compositionSupport;
  support.sourceAsset=structuredClone(sourceAsset);support.demoAsset=structuredClone(sourceAsset);f.save();
  assert.equal(f.run().status,0,'separately parsed arrays with identical ordered content must match');
  support.demoAsset.variant[1].sha256='c'.repeat(64);f.save();
  const changedHash=f.run();assert.notEqual(changedHash.status,0);assert(changedHash.report.hardFailures.some(x=>x.code==='HERO_ASSET_VARIANT_MISMATCH'));
  support.demoAsset=structuredClone(sourceAsset);support.demoAsset.variant.reverse();f.save();
  const changedOrder=f.run();assert.notEqual(changedOrder.status,0);assert(changedOrder.report.hardFailures.some(x=>['HERO_ASSET_IDENTITY_UNVERIFIED','HERO_ASSET_VARIANT_MISMATCH'].includes(x.code)));
});
test('versioned report output rejects escape, symlink escape, existing bytes and canonical receipt targets',t=>{
  const f=fixture(t),outside=createBrandTestDirectory('fidelity-outside');t.after(()=>outside.cleanup());
  fs.symlinkSync(outside.directory,path.join(f.root,'escape'),'dir');
  fs.symlinkSync(f.dir,path.join(f.root,'alias'),'dir');
  const targets=[path.join(outside.directory,'report.json'),'escape/report.json','migrations/example/fidelity-report.json','migrations/example/receipts/new.json','migrations/example/visual-qa-assessment.json','alias/fidelity-report.json','alias/receipts/new.json'];
  const original=fs.readFileSync(path.join(f.dir,'visual-qa-assessment.json'));
  for(const target of targets) assert.equal(f.run(['--write','--output-file',target]).status,1,target);
  assert.deepEqual(fs.readFileSync(path.join(f.dir,'visual-qa-assessment.json')),original);assert(!fs.existsSync(path.join(outside.directory,'report.json')));
});
test('fidelity CLI checks attempt mismatch before status and exit',t=>{
  const f=fixture(t);assert.equal(f.run().status,0);
  f.inventory.attempt=2;const ref=f.put('visual-pattern-inventory.json',f.inventory);f.manifest.allowedInputs=[{...ref,kind:'visual-pattern-inventory'}];f.put('qa-input-manifest.json',f.manifest);
  const result=f.run();assert.equal(result.status,3);assert.equal(result.report.status,'protocol-blocked');assert(result.report.protocolFailures.some(x=>x.code==='PATTERN_ATTEMPT_MISMATCH'));
});
test('omitted inventory attempt keeps the first-quality default without rewriting frozen inputs',t=>{
  const f=fixture(t);
  const save=()=>{const ref=f.put('visual-pattern-inventory.json',f.inventory);f.manifest.allowedInputs=[{...ref,kind:'visual-pattern-inventory'}];f.put('qa-input-manifest.json',f.manifest);f.put('visual-qa-assessment.json',f.assessment);};
  delete f.inventory.attempt;save();
  const file=path.join(f.dir,'visual-pattern-inventory.json'),before=fs.readFileSync(file);
  const first=f.run();assert.equal(first.status,0,JSON.stringify(first.report));assert.equal(first.report.attempt,1);assert.deepEqual(fs.readFileSync(file),before);
  f.assessment.attempt=2;f.manifest.attempt=2;save();
  const retry=f.run();assert.equal(retry.status,3);assert(retry.report.protocolFailures.some(x=>x.code==='PATTERN_ATTEMPT_MISMATCH'));
  f.assessment.attempt=1;f.manifest.attempt=1;
  for(const invalid of [null,0,'']) {f.inventory.attempt=invalid;save();const result=f.run();assert.equal(result.status,3);assert(result.report.protocolFailures.some(x=>x.code==='PATTERN_ATTEMPT_MISMATCH'));}
});
test('missing mapping or dimensions means incomplete evidence, not a visual zero',t=>{
  const f=fixture(t);delete f.assessment.pages[0].sourcePageId;f.put('visual-qa-assessment.json',f.assessment);
  let result=f.run();assert.equal(result.status,3);assert.equal(result.report.overallScore,null);assert.equal(result.report.scoreStatus,'incomplete-evidence');assert(!result.report.hardFailures.some(x=>x.code==='OVERALL_BELOW_THRESHOLD'));
  f.assessment.pages[0].sourcePageId='home';delete f.assessment.pages[0].dimensions.composition;f.put('visual-qa-assessment.json',f.assessment);
  result=f.run();assert.equal(result.status,3);assert.equal(result.report.pageResults[0].score,null);assert(!result.report.hardFailures.some(x=>x.code==='CORE_COMPOSITION_BELOW_MIN'));
});
test('versioned CLI supplements bind their own hashes and preserve originals',t=>{
  const f=fixture(t),original=fs.readFileSync(path.join(f.dir,'visual-qa-assessment.json'));
  f.put('repair/assessment.json',f.assessment);
  const result=f.run(['--assessment-file','migrations/example/repair/assessment.json','--write','--output-file','migrations/example/repair/fidelity.json']);
  assert.equal(result.status,0);assert.equal(result.report.inputPaths.assessment,'migrations/example/repair/assessment.json');assert.deepEqual(fs.readFileSync(path.join(f.dir,'visual-qa-assessment.json')),original);assert(!fs.existsSync(path.join(f.dir,'fidelity-report.json')));
  assert.equal(f.run(['--assessment-file','migrations/example/repair/assessment.json','--write']).status,1);
  assert.equal(f.run(['--assessment-file','migrations/example/repair/assessment.json','--write','--output-file','migrations/example/repair/fidelity.json']).status,1);
});
test('supplemental inventory cannot validate bytes that the reviewer never consumed',t=>{
  const f=fixture(t);f.put('repair/inventory.json',f.inventory);
  const result=f.run(['--inventory-file','migrations/example/repair/inventory.json']);
  assert.equal(result.status,3);assert(result.report.protocolFailures.some(x=>x.code==='PATTERN_INPUT_BINDING_MISMATCH'));
});
test('learning CLI rejects incomplete canonical consumer fields before any ready verdict',t=>{
  const f=fixture(t),goal=JSON.parse(fs.readFileSync(path.join(f.dir,'goal-contract.json')));
  goal.goalType='brand-learning-capability-test';const binding=f.put('goal-contract.json',goal);
  f.manifest.goalSha256=binding.sha256;f.put('qa-input-manifest.json',f.manifest);
  f.assessment.goalSha256=binding.sha256;f.put('visual-qa-assessment.json',f.assessment);
  const result=f.run();assert.equal(result.status,3);assert(result.report.protocolFailures.some(x=>x.code==='LEARNING_QA_OUTPUT_INCOMPLETE'));assert.equal(readCanonicalLearningProof(result.report).threeProofsPassed,false);
});
test('canonical reader accepts three proofs and rejects scope, late failures and legacy override',()=>{
  const proofs={evidenceFidelity:'pass',structuralFidelity:'pass',generativeProof:'pass'};
  const report={status:'fidelity-pass',learningProof:{required:true,status:'learning-proof-pass',...proofs}};
  assert.equal(readCanonicalLearningProof(report).threeProofsPassed,true);
  assert.equal(readCanonicalLearningProof({...report,scope:{completeBrandCertification:false}}).threeProofsPassed,true);
  for(const delta of [{protocolFailures:[{code:'PATTERN_ATTEMPT_MISMATCH'}]},{completionScope:'scoped-regression'},{learningProof:{required:false,status:'not-required'},proofs},{learningProof:{required:true,status:'learning-proof-fail',...proofs,generativeProof:'fail'},proofs}]) assert.equal(readCanonicalLearningProof({...report,...delta}).threeProofsPassed,false);
  assert.equal(readCanonicalLearningProof({status:'fidelity-pass',proofStatus:proofs}).threeProofsPassed,true);
});
test('public plan consumes canonical learningProof and blocks stale PASS with protocol failures',t=>{
  const f=fixture(t),proofs={evidenceFidelity:'pass',structuralFidelity:'pass',generativeProof:'pass'};
  const report={status:'fidelity-pass',learningProof:{required:true,status:'learning-proof-pass',...proofs}};
  const plan=()=>{const r=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),'plan','--root',f.root,'--mode','learn-brand','--brand','example','--dembrandt-input',path.join(f.dir,'goal-contract.json')],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);return JSON.parse(r.stdout);};
  f.put('fidelity-report.json',report);assert.equal(plan().stepStatus['tpp-test'],'complete');
  report.protocolFailures=[{code:'PATTERN_ATTEMPT_MISMATCH'}];f.put('fidelity-report.json',report);assert.equal(plan().stepStatus['tpp-test'],'blocked');
  delete report.protocolFailures;report.completionScope='scoped-regression';f.put('fidelity-report.json',report);assert.equal(plan().stepStatus['tpp-test'],'blocked');
});
