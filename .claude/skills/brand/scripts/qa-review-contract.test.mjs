import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {prepareQaReview,validateQaReview,isQaArtifact} from './qa-review-contract.mjs';
import {createBrandTestDirectory} from './brand-test-directory.mjs';
import {revokeUndeliveredQaDispatch,validateQaDispatchRevocations} from './revoke-undelivered-qa-dispatch.mjs';
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(t, goalOverrides = {}) {
  const temp=createBrandTestDirectory('qa-review'); t.after(()=>temp.cleanup()); const root=temp.directory, prefix='migrations/example/';
  const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9oCBcAAAAASUVORK5CYII=','base64');
  function put(name,value) {const target=path.join(root,prefix+name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)?value:name.endsWith('.png')&&typeof value==='string'?Buffer.concat([tinyPng,Buffer.from(value)]):typeof value==='string'?value:JSON.stringify(value));return {path:prefix+name,sha256:sha(target)};}
  const goal=put('goal-contract.json',{schema:'brand-goal/v2',sealed:true,...goalOverrides});
  const rule=put('approved-visual-patterns.json',{rules:['frozen']}), oldHtml=put('old-demo.html','old HTML'), oldShot=put('old-demo.png','old PNG'), inventory=put('visual-pattern-inventory.json',{schema:'brand-visual-pattern-inventory/v1',attempt:1,patterns:[]});
  const oldManifest=put('qa-input-manifest.json',{schema:'brand-blind-qa-input/v1',qaExecutionId:'/root/qa',implementationExecutionId:'/root/demo1',goalSha256:goal.sha256,allowedInputs:[goal,rule,oldHtml,oldShot,inventory]});
  const oldAssessment=put('visual-qa-assessment.json',{schema:'brand-visual-qa-assessment/v2',reviewerRecommendation:'fail'}), qaShot=put('qa-old.png','QA old image');
  const oldDemoReceipt=put('receipts/demo-1.json',{stageId:'demo-1',role:'demoImplementationAgent',agentExecutionId:'/root/demo1',goalSha256:goal.sha256,verdict:'pass',inputs:[goal,rule],outputs:[oldHtml,oldShot,oldManifest]});
  const dispatch=put('dispatch/visualQA-1.json',{dispatchId:'prior-dispatch',stageId:'visualQA-1',goalSha256:goal.sha256,requiredInputs:[goal,oldManifest,oldHtml,oldShot,inventory]});
  const oldReceipt=put('receipts/visualQA-1.json',{stageId:'visualQA-1',role:'visualQA',dispatchId:'prior-dispatch',agentExecutionId:'/root/qa',goalSha256:goal.sha256,verdict:'fail',inputs:[goal,oldManifest,oldHtml,oldShot,inventory],outputs:[oldAssessment,qaShot]});
  const html=put('current-demo.html','NEW HTML'), screenshot=put('current-demo.png','producer NEW PNG');
  const demoReceipt=put('receipts/demo-2.json',{stageId:'demo-2',role:'demoImplementationAgent',agentExecutionId:'/root/demo2',goalSha256:goal.sha256,verdict:'pass',inputs:[goal,rule],outputs:[html,screenshot,inventory]});
  const stages=[{id:'demo-1',stage:'demo',role:'demoImplementationAgent',status:'complete',agentExecutionId:'/root/demo1',receiptPath:oldDemoReceipt.path,receiptSha256:oldDemoReceipt.sha256,outputHashes:[oldHtml,oldShot,oldManifest]}, {id:'visualQA-1',role:'visualQA',stage:'visualQA',status:'failed',verdict:'fail',agentExecutionId:'/root/qa',receiptPath:oldReceipt.path,receiptSha256:oldReceipt.sha256,dispatchPath:dispatch.path,outputHashes:[oldAssessment,qaShot]}, {id:'demo-2',role:'demoImplementationAgent',stage:'demo',status:'complete',agentExecutionId:'/root/demo2',receiptPath:demoReceipt.path,receiptSha256:demoReceipt.sha256,outputHashes:[html,screenshot,inventory]}, {id:'visualQA-2',role:'visualQA',stage:'visualQA',status:'pending'}];
  const manifest={mode:'learn-brand',status:'running',goalPath:goal.path,goalSha256:goal.sha256,currentStageId:'visualQA-2',stages};
  put('execution-manifest.json',manifest);
  const options={root,brand:'example',reviewMode:'regression-review',qaExecutionId:'/root/qa',priorReceipt:oldReceipt.path,affected:['footer'],regressionScope:['header','held-out']};
  return {root,put,manifest,options,stages,rule,goal,oldReceipt,oldAssessment,oldManifest,qaShot,screenshot,save:()=>put('execution-manifest.json',manifest)};
}
function closureArchiveFixture(t) {
  const f=fixture(t),oldQa=f.stages[1],oldDemo=f.stages[0];
  const oldReceipt=JSON.parse(fs.readFileSync(path.join(f.root,oldQa.receiptPath)));oldReceipt.inputs.push(f.rule);
  const qaReceipt=f.put('receipts/visualQA-1.json',oldReceipt);oldQa.receiptSha256=qaReceipt.sha256;
  const refs=[...JSON.parse(fs.readFileSync(path.join(f.root,oldQa.receiptPath))).inputs,...JSON.parse(fs.readFileSync(path.join(f.root,oldQa.receiptPath))).outputs,...oldDemo.outputHashes];
  const unique=[...new Map(refs.map(ref=>[ref.path+'@'+ref.sha256,ref])).values()];
  const copies=unique.map(ref=>{
    const name=`closure-repairs/1/workspace/${ref.path}`,copy=f.put(name,fs.readFileSync(path.join(f.root,ref.path)));
    return {...copy,originalPath:ref.path};
  });
  const rejection={schema:'brand-learning-closure-rejection/v1',goalSha256:f.goal.sha256,stages:structuredClone([oldDemo,oldQa]),archivedOutputs:copies};
  const seal=()=>{const ref=f.put('closure-repairs/1/consumer-rejection.json',rejection);f.manifest.learningClosureRepairs=[{goalSha256:f.goal.sha256,rejection:ref}];f.save();return ref;};
  seal();
  // Interpreter's frozen rule and prior Demo paths now hold the newly approved
  // repair bytes. Their old hashes exist only in the shared closure archive.
  const rule=f.put('approved-visual-patterns.json',{rules:['new scoped rule']}),oldHtml=f.put('old-demo.html','new same-path demo');
  f.put('qa-input-manifest.json',{schema:'brand-blind-qa-input/v1',qaExecutionId:'/root/new',implementationExecutionId:'/root/demo2'});
  const currentReceipt=JSON.parse(fs.readFileSync(path.join(f.root,f.stages[2].receiptPath)));currentReceipt.inputs=[f.goal,rule];currentReceipt.outputs=[oldHtml,...f.stages[2].outputHashes];
  const receipt=f.put('receipts/demo-2.json',currentReceipt);Object.assign(f.stages[2],{receiptSha256:receipt.sha256,outputHashes:currentReceipt.outputs});f.save();
  const options={root:f.root,brand:'example',reviewMode:'fresh-blind',qaExecutionId:'/root/qa-fresh'};
  return {...f,rejection,copies,seal,options};
}
function producerPreservationFixture(t) {
  const f=fixture(t),oldDemo=f.stages[0],oldInventory=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/visual-pattern-inventory.json')));
  const oldInventoryRef={path:'migrations/example/visual-pattern-inventory.json',sha256:sha(path.join(f.root,'migrations/example/visual-pattern-inventory.json'))};
  const oldDemoReceipt=JSON.parse(fs.readFileSync(path.join(f.root,oldDemo.receiptPath)));oldDemoReceipt.outputs.push(oldInventoryRef);
  oldDemo.outputHashes=oldDemoReceipt.outputs;oldDemo.receiptSha256=f.put('receipts/demo-1.json',oldDemoReceipt).sha256;
  const copy=f.put('attempts/demo-1/workspace/migrations/example/visual-pattern-inventory.json',oldInventory);
  f.put('attempts/demo-1/producer-preservation-archive.json',{schema:'brand-failed-stage-archive/v1',stage:structuredClone(oldDemo),archivedOutputs:[{...copy,originalPath:oldInventoryRef.path,sha256:oldInventoryRef.sha256}]});
  const unrelated=f.put('unrelated-demo.json',{unrelated:true}),unrelatedReceipt=f.put('receipts/demo-1-retry-2.json',{stageId:'demo-1-retry-2',role:'demoImplementationAgent',agentExecutionId:'/root/unrelated',goalSha256:f.goal.sha256,verdict:'fail',inputs:[f.goal],outputs:[unrelated]});
  f.stages.splice(1,0,{id:'demo-1-retry-2',stage:'demo',role:'demoImplementationAgent',status:'failed',verdict:'fail',agentExecutionId:'/root/unrelated',receiptPath:unrelatedReceipt.path,receiptSha256:unrelatedReceipt.sha256,outputHashes:[unrelated]});
  const currentInventory=f.put('visual-pattern-inventory.json',{...oldInventory,attempt:2});
  const currentDemo=f.stages.find(stage=>stage.id==='demo-2'),currentReceipt=JSON.parse(fs.readFileSync(path.join(f.root,currentDemo.receiptPath)));
  currentReceipt.outputs=currentReceipt.outputs.map(ref=>ref.path===currentInventory.path?currentInventory:ref);currentDemo.outputHashes=currentReceipt.outputs;currentDemo.receiptSha256=f.put('receipts/demo-2.json',currentReceipt).sha256;
  f.save();
  return {...f,oldInventoryRef,copy,options:{root:f.root,brand:'example',reviewMode:'fresh-blind',qaExecutionId:'/root/qa-fresh'}};
}
function legacyPriorInputGapFixture(t) {
  const f=fixture(t),oldInventoryRef={path:'migrations/example/visual-pattern-inventory.json',sha256:sha(path.join(f.root,'migrations/example/visual-pattern-inventory.json'))};
  const currentInventory=f.put('visual-pattern-inventory.json',{schema:'brand-visual-pattern-inventory/v1',attempt:2,patterns:[]}),currentDemo=f.stages.find(stage=>stage.id==='demo-2'),receipt=JSON.parse(fs.readFileSync(path.join(f.root,currentDemo.receiptPath)));
  receipt.outputs=receipt.outputs.map(ref=>ref.path===currentInventory.path?currentInventory:ref);currentDemo.outputHashes=receipt.outputs;currentDemo.receiptSha256=f.put('receipts/demo-2.json',receipt).sha256;f.save();
  return {...f,oldInventoryRef,options:{root:f.root,brand:'example',reviewMode:'fresh-blind',qaExecutionId:'/root/qa-fresh'}};
}
test('fresh QA records an irrecoverable legacy prior input without exposing or consuming it',t=>{
  const f=legacyPriorInputGapFixture(t),{review}=prepareQaReview(f.options);validateQaReview(f.root,review);
  assert.deepEqual(review.unavailablePriorInputs,[{...f.oldInventoryRef,reason:'historical-bytes-not-preserved-before-same-path-producer-rewrite'}]);
  assert(![...review.allowedInputs,...review.frozenInputs].some(ref=>ref.path===f.oldInventoryRef.path&&ref.sha256===f.oldInventoryRef.sha256));
  assert(review.priorCapturePaths.includes(f.qaShot.path));
  const archive=JSON.parse(fs.readFileSync(path.join(f.root,review.priorArchive.path)));
  assert.deepEqual(archive.unavailablePriorInputs,review.unavailablePriorInputs);
  assert(archive.archivedOutputs.some(ref=>ref.originalPath===f.oldAssessment.path));
});
test('regression review still rejects the same irrecoverable prior input',t=>{
  const f=legacyPriorInputGapFixture(t);assert.throws(()=>prepareQaReview({...f.options,reviewMode:'regression-review',qaExecutionId:'/root/qa',priorReceipt:f.oldReceipt.path,affected:['footer'],regressionScope:['header','held-out']}),/QA_REVIEW_PRIOR_BYTES_UNAVAILABLE/);
});
test('fresh QA recovers an old input only from its exact producer Demo preservation archive',t=>{
  const f=producerPreservationFixture(t),{review}=prepareQaReview(f.options);validateQaReview(f.root,review);
  const archive=JSON.parse(fs.readFileSync(path.join(f.root,review.priorArchive.path))),copy=archive.archivedOutputs.find(ref=>ref.originalPath===f.oldInventoryRef.path&&ref.sha256===f.oldInventoryRef.sha256);
  assert.ok(copy);assert.deepEqual(fs.readFileSync(path.join(f.root,copy.path)),fs.readFileSync(path.join(f.root,f.copy.path)));
});
test('fresh QA does not hide a tampered QA archive behind a valid producer fallback',t=>{
  const f=producerPreservationFixture(t),qaCopy=f.put('attempts/visualQA-1/workspace/migrations/example/visual-pattern-inventory.json',fs.readFileSync(path.join(f.root,f.copy.path)));
  f.put('attempts/visualQA-1/producer-preservation-archive.json',{archivedOutputs:[{...qaCopy,originalPath:f.oldInventoryRef.path,sha256:f.oldInventoryRef.sha256}]});
  fs.appendFileSync(path.join(f.root,qaCopy.path),'tampered');
  assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_HASH_MISMATCH/);
});
test('fresh QA resolves same-path old producer inputs through the shared closure archive',t=>{
  const f=closureArchiveFixture(t),{review}=prepareQaReview(f.options);
  assert.equal(review.reviewMode,'fresh-blind');validateQaReview(f.root,review);
  const archive=JSON.parse(fs.readFileSync(path.join(f.root,review.priorArchive.path)));
  assert(archive.archivedOutputs.some(ref=>ref.originalPath===f.rule.path&&ref.sha256===f.rule.sha256));
  assert.equal(fs.existsSync(path.join(f.root,'migrations/example/attempts/visualQA-1/archive.json')),false);
});
test('fresh QA records a closure input whose exact old hash is unavailable rather than guessing bytes',t=>{
  const f=closureArchiveFixture(t);f.rejection.archivedOutputs=f.rejection.archivedOutputs.filter(ref=>ref.originalPath!==f.rule.path);f.seal();
  const {review}=prepareQaReview(f.options);assert(review.unavailablePriorInputs.some(ref=>ref.path===f.rule.path&&ref.sha256===f.rule.sha256));validateQaReview(f.root,review);
});
test('closure archive refuses tampered archived bytes',t=>{
  const f=closureArchiveFixture(t),copy=f.copies.find(ref=>ref.originalPath===f.rule.path);
  fs.appendFileSync(path.join(f.root,copy.path),' tamper');assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_HASH_MISMATCH/);
});
test('closure archive rejection hash and frozen Goal identity cannot be replaced silently',t=>{
  const f=closureArchiveFixture(t),ref=f.manifest.learningClosureRepairs[0].rejection;
  fs.appendFileSync(path.join(f.root,ref.path),' ');assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_HASH_MISMATCH/);
  f.rejection.goalSha256='0'.repeat(64);f.seal();assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_CLOSURE_GOAL_BINDING/);
});
test('closure archive requires an exact known prior stage and receipt association',t=>{
  const f=closureArchiveFixture(t);for(const stage of f.rejection.stages)stage.receiptSha256='0'.repeat(64);f.seal();
  assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_CLOSURE_STAGE_BINDING/);
});
test('regression archives authentic prior bytes and freezes identities/current output',t=>{
  const f=fixture(t), old=fs.readFileSync(path.join(f.root,f.oldAssessment.path)); const {review,handoff}=prepareQaReview(f.options);
  assert.equal(handoff.state,'reuse-original-qa');assert.equal(review.qaExecutionId,'/root/qa');assert.notEqual(review.reviewId,'/root/qa');assert.equal(review.priorReviewReceipt.sha256,f.oldReceipt.sha256);
  const archive=JSON.parse(fs.readFileSync(path.join(f.root,review.priorArchive.path)));
  const copy=archive.archivedOutputs.find(ref=>ref.originalPath===f.oldAssessment.path);assert.deepEqual(fs.readFileSync(path.join(f.root,copy.path)),old);
  assert.deepEqual(fs.readFileSync(path.join(f.root,f.oldAssessment.path)),old);validateQaReview(f.root,review);
  assert.throws(()=>prepareQaReview(f.options),/ALREADY_PREPARED/);
});
test('learning QA dispatch describes the consumer fields and rejects scoped PASS before record', t => {
  const f = fixture(t, {goalType:'brand-learning-capability-test',scope:{completeBrandCertification:false},referencePages:[{id:'source',core:true}],demoPages:[{id:'calibration',mapsToSourcePageId:'source'}],mustPreserve:[{id:'hierarchy'}],mustNotReplace:[{id:'no-screenshot'}]});
  const {review} = prepareQaReview(f.options);
  assert.equal(review.completionContract.sourcePages[0].sourcePageId,'source');
  assert.equal(review.completionContract.scope.completeBrandCertification,false);
  const capture=f.put('qa-new.png','fresh frame');
  const assessment={schema:'brand-visual-qa-assessment/v2',reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId,reviewerRecommendation:'pass',captureEvidence:[{...capture,reviewId:review.reviewId,capturedAt:new Date().toISOString()}],pages:[{demoPageId:'calibration',ratings:{composition:4},evidenceRefs:[capture.path]}]};
  assert.throws(()=>validateQaReview(f.root,review,assessment), error => error.code === 'LEARNING_QA_OUTPUT_INCOMPLETE' && error.missingFields.includes('pages[sourcePageId=source]'));
});
function initialLearningAttemptFixture(t, {inventoryAttempt, stageAttempt = 1, receiptAttempt, priorProducer = false, reviewMode = 'initial-blind'} = {}) {
  const f = fixture(t, {goalType:'brand-learning-capability-test',referencePages:[{id:'source',core:true}]});
  const demo = f.stages[2];
  const inventory = f.put('visual-pattern-inventory.json', {schema:'brand-visual-pattern-inventory/v1',patterns:[],...(inventoryAttempt !== undefined ? {attempt:inventoryAttempt} : {})});
  const receipt = JSON.parse(fs.readFileSync(path.join(f.root,demo.receiptPath)));
  receipt.outputs = receipt.outputs.map(ref => ref.path === inventory.path ? inventory : ref);
  if (receiptAttempt !== undefined) receipt.attempt = receiptAttempt;
  const receiptRef = f.put('receipts/demo-2.json',receipt);
  Object.assign(demo,{attempt:stageAttempt,receiptSha256:receiptRef.sha256,outputHashes:receipt.outputs});
  f.manifest.stages = [...(priorProducer ? [f.stages[0]] : []),demo,f.stages[3]];
  f.save();
  return {...f,demo,inventory,receiptRef,options:{root:f.root,brand:'example',reviewMode,qaExecutionId:'/root/newqa'}};
}
test('initial learning QA uses the declared quality default without rewriting frozen producer outputs',t=>{
  const f=initialLearningAttemptFixture(t,{receiptAttempt:1});
  const {review}=prepareQaReview(f.options);
  assert.equal(review.attempt,1);
  assert.deepEqual(review.attemptSource,{kind:'initial-quality-default',stageId:f.demo.id,producerAttempt:1,receipt:f.receiptRef});
  assert.equal(sha(path.join(f.root,f.inventory.path)),f.inventory.sha256);
  assert.equal(sha(path.join(f.root,f.receiptRef.path)),f.receiptRef.sha256);
  assert(!Object.hasOwn(JSON.parse(fs.readFileSync(path.join(f.root,f.inventory.path))),'attempt'));
  validateQaReview(f.root,review);
});
test('missing quality attempt never borrows later workflow attempts or an invalid/conflicting first receipt',t=>{
  for (const options of [{stageAttempt:2},{stageAttempt:'1'},{stageAttempt:null},{receiptAttempt:2},{receiptAttempt:null},{receiptAttempt:'1'},{priorProducer:true},{reviewMode:'fresh-blind'}]) {
    const f=initialLearningAttemptFixture(t,options);
    assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_PATTERN_ATTEMPT_(?:REQUIRED|CONFLICT)/,JSON.stringify(options));
  }
});
test('explicit invalid quality attempts cannot fall back; explicit quality counters retain their own meaning',t=>{
  for (const inventoryAttempt of [null,0,-1,'1',1.5]) {
    const f=initialLearningAttemptFixture(t,{inventoryAttempt});
    assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_PATTERN_ATTEMPT_REQUIRED/);
  }
  const f=initialLearningAttemptFixture(t,{inventoryAttempt:1,stageAttempt:2});
  const {review}=prepareQaReview(f.options);
  assert.equal(review.attempt,1); assert.deepEqual(review.attemptSource,{kind:'inventory'});
});
test('quality default still requires the hash-verified producer receipt',t=>{
  const f=initialLearningAttemptFixture(t);
  fs.appendFileSync(path.join(f.root,f.receiptRef.path),' ');
  assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_HASH_MISMATCH/);
});
test('new review assessment/capture identity required and old producer or QA captures refused',t=>{
  const f=fixture(t),{review}=prepareQaReview(f.options), base={reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId};
  assert.throws(()=>validateQaReview(f.root,review,base),/NEW_CAPTURE/);
  for(const ref of [f.qaShot,f.screenshot]) assert.throws(()=>validateQaReview(f.root,review,{...base,captureEvidence:[{...ref,reviewId:review.reviewId,capturedAt:new Date().toISOString()}]}),/INHERITED_CAPTURE/);
  const fresh=f.put('qa-new.png','ACTUAL NEW QA capture');validateQaReview(f.root,review,{...base,captureEvidence:[{...fresh,reviewId:review.reviewId,capturedAt:new Date().toISOString()}]});
  assert.throws(()=>validateQaReview(f.root,review,{...base,reviewId:'old',captureEvidence:[fresh]}),/IDENTITY/);
});
test('QA capture must contain image bytes, not a hash-bound text placeholder',t=>{
  const f=fixture(t),{review}=prepareQaReview(f.options),fake=f.put('qa-new.txt','screenshot placeholder');
  const assessment={reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId,captureEvidence:[{...fake,reviewId:review.reviewId,capturedAt:new Date().toISOString()}]};
  assert.throws(()=>validateQaReview(f.root,review,assessment),/CAPTURE_IMAGE_REQUIRED/);
});
test('PASS needs current page and regression evidence plus a bound interaction record',t=>{
  const f=fixture(t),{review}=prepareQaReview(f.options),capture=f.put('qa-new.png','fresh screenshot'),evidence={...capture,reviewId:review.reviewId,capturedAt:new Date().toISOString()};
  const record=f.put('qa-interaction.json',{reviewId:review.reviewId,qaExecutionId:review.qaExecutionId,newObservation:true,browser:{captureEvidence:[capture.path]}});
  const assessment={reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId,reviewerRecommendation:'pass',captureEvidence:[evidence],pages:[{demoPageId:'plaza',evidenceRefs:[capture.path]}],reviewScope:{affected:['footer'],regressionScope:['header','held-out']},regressionResults:[{section:'header',verdict:'pass',evidenceRefs:[capture.path]},{section:'held-out',verdict:'pass',evidenceRefs:[capture.path]}],actualInteractionEvidence:record};
  validateQaReview(f.root,review,assessment); // Pre-receipt fidelity validation cannot require receipt outputs.
  validateQaReview(f.root,review,assessment,{receiptVerdict:'pass',receiptOutputs:[record]});
  validateQaReview(f.root,review,{...assessment,regressionResults:[{...assessment.regressionResults[0],verdict:'pass-within-frozen-static-trial'},assessment.regressionResults[1]]},{receiptVerdict:'pass',receiptOutputs:[record]});
  assert.throws(()=>validateQaReview(f.root,review,{...assessment,pages:[{demoPageId:'plaza',evidenceRefs:[f.screenshot.path]}]},{receiptVerdict:'pass',receiptOutputs:[record]}),/PAGE_CURRENT_CAPTURE_REQUIRED/);
  assert.throws(()=>validateQaReview(f.root,review,{...assessment,regressionResults:assessment.regressionResults.slice(0,1)},{receiptVerdict:'pass',receiptOutputs:[record]}),/REGRESSION_RESULT_NOT_PASSING/);
  assert.throws(()=>validateQaReview(f.root,review,{...assessment,regressionResults:[{section:'header',verdict:'fail',evidenceRefs:[capture.path]},assessment.regressionResults[1]]},{receiptVerdict:'pass',receiptOutputs:[record]}),/REGRESSION_RESULT_NOT_PASSING/);
  assert.throws(()=>validateQaReview(f.root,review,{...assessment,regressionResults:[{section:'header',verdict:'needs-evidence',evidenceRefs:[capture.path]},assessment.regressionResults[1]]},{receiptVerdict:'pass',receiptOutputs:[record]}),/REGRESSION_RESULT_NOT_PASSING/);
  assert.throws(()=>validateQaReview(f.root,review,assessment,{receiptVerdict:'pass',receiptOutputs:[]}),/INTERACTION_RECEIPT_OUTPUT_REQUIRED/);
});
test('fidelity entrypoint validates a v2 pass assessment before receipt creation',t=>{
  const f=fixture(t),{review}=prepareQaReview(f.options),capture=f.put('qa-fresh.png','current frame'),interaction=f.put('qa-interaction.json',{reviewId:review.reviewId,qaExecutionId:review.qaExecutionId,newObservation:true,browser:{captureEvidence:[capture.path]}});
  f.put('visual-qa-assessment.json',{schema:'brand-visual-qa-assessment/v2',reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId,reviewerRecommendation:'pass',captureEvidence:[{...capture,reviewId:review.reviewId,capturedAt:new Date().toISOString()}],pages:[{demoPageId:'plaza',evidenceRefs:[capture.path]}],reviewScope:{affected:['footer'],regressionScope:['header','held-out']},regressionResults:[{section:'header',verdict:'pass',evidenceRefs:[capture.path]},{section:'held-out',verdict:'pass',evidenceRefs:[capture.path]}],actualInteractionEvidence:interaction});
  const result=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/validate-brand-fidelity.mjs'),'--brand','example','--root',f.root],{encoding:'utf8'});
  const report=JSON.parse(result.stdout);
  assert(!report.protocolFailures.some(item=>item.code==='QA_REVIEW_CONTRACT_VIOLATION'),JSON.stringify(report.protocolFailures));
});
test('real record rejects a failed required regression and accepts its verified repair',t=>{
  const f=fixture(t);Object.assign(f.manifest,{schema:'brand-subagent-execution/v1',runId:'run',goalId:'goal',brand:'example',finalGates:{}});f.save();
  const {review}=prepareQaReview(f.options),skill=path.join(f.root,'skill');fs.mkdirSync(skill,{recursive:true});fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{visualQA:{goal:'review'}}}));
  const script=path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),run=(command,extra=[])=>spawnSync(process.execPath,[script,command,'--brand','example','--root',f.root,...extra],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
  assert.equal(run('next').status,0);
  const dispatch=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/dispatch/visualQA-2.json'))),capture=f.put('qa-fresh.png','current browser frame'),interaction=f.put('qa-interaction.json',{reviewId:review.reviewId,qaExecutionId:review.qaExecutionId,newObservation:true,browser:{captureEvidence:[capture.path]}});
  const assessment={schema:'brand-visual-qa-assessment/v2',reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId,reviewerRecommendation:'pass',captureEvidence:[{...capture,reviewId:review.reviewId,capturedAt:new Date().toISOString()}],pages:[{demoPageId:'plaza',evidenceRefs:[capture.path]}],reviewScope:{affected:['footer'],regressionScope:['header','held-out']},regressionResults:[{section:'header',verdict:'fail',evidenceRefs:[capture.path]},{section:'held-out',verdict:'pass',evidenceRefs:[capture.path]}],actualInteractionEvidence:interaction};
  const record=()=>{const assessmentRef=f.put('visual-qa-assessment.json',assessment),receipt=f.put('receipts/visualQA-2.json',{dispatchId:dispatch.dispatchId,stageId:dispatch.stageId,role:'visualQA',agentExecutionId:'/root/qa',qaExecutionId:'/root/qa',goalSha256:f.goal.sha256,reviewMode:review.reviewMode,reviewId:review.reviewId,verdict:'pass',inputs:dispatch.requiredInputs,outputs:[assessmentRef,capture,interaction]});return run('record',['--receipt',receipt.path]);};
  const rejected=record();assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/REGRESSION_RESULT_NOT_PASSING/);
  assessment.regressionResults[0].verdict='pass';const accepted=record();assert.equal(accepted.status,0,accepted.stderr);assert.equal(JSON.parse(accepted.stdout).status,'passed');
});
for(const mutation of ['goal','rules','receipt','old-input','old-output']) test(`reject ${mutation} tamper before prepare`,t=>{
  const f=fixture(t), ref={goal:f.goal,rules:f.rule,receipt:f.oldReceipt,'old-input':f.oldManifest,'old-output':f.oldAssessment}[mutation];fs.appendFileSync(path.join(f.root,ref.path),' tamper');assert.throws(()=>prepareQaReview(f.options),/HASH_MISMATCH|PRIOR_BYTES_UNAVAILABLE/);
});
test('archive and frozen rule tamper rejected after preparation',t=>{
  const f=fixture(t),{review}=prepareQaReview(f.options);fs.appendFileSync(path.join(f.root,review.priorArchive.path),' ');assert.throws(()=>validateQaReview(f.root,review),/HASH_MISMATCH/);
});
test('producer self-review, non-original reviewer, prior pass and stale receipt blocked',t=>{
  const f=fixture(t);assert.throws(()=>prepareQaReview({...f.options,qaExecutionId:'/root/demo2'}),/SELF_REVIEW/);
  assert.throws(()=>prepareQaReview({...f.options,qaExecutionId:'/root/new'}),/ORIGINAL_AGENT/);
  assert.throws(()=>prepareQaReview({...f.options,priorReceipt:'stale.json'}),/LATEST_PRIOR/);
  f.stages[1].verdict='pass';f.stages[1].status='complete';f.save();assert.throws(()=>prepareQaReview(f.options),/PRIOR_FAILURE/);
});
for (const scenario of ['failure','protocol-failure','missing','pass','wrong-goal','wrong-assessment','empty-failures','tampered']) test(`visual recommendation PASS requires bound deterministic failure for regression: ${scenario}`,t=>{
  const f=fixture(t),assessment=f.put('visual-qa-assessment.json',{schema:'brand-visual-qa-assessment/v2',reviewerRecommendation:'pass'});
  const report={schema:'brand-visual-quality-result/v2',status:scenario==='protocol-failure'?'protocol-blocked':'fidelity-fail',goalSha256:f.goal.sha256,inputHashes:{assessment:assessment.sha256},hardFailures:scenario==='protocol-failure'?[]:[{code:'HERO_ASSET_VARIANT_MISMATCH'}],protocolFailures:scenario==='protocol-failure'?[{code:'PATTERN_ATTEMPT_MISMATCH'}]:[]};
  if(scenario==='pass')report.status='fidelity-pass';
  if(scenario==='wrong-goal')report.goalSha256='0'.repeat(64);
  if(scenario==='wrong-assessment')report.inputHashes.assessment='0'.repeat(64);
  if(scenario==='empty-failures')report.hardFailures=[];
  const fidelity=f.put('fidelity-report.json',report),outputs=[assessment,f.qaShot,...(scenario==='missing'?[]:[fidelity])];
  const receipt=JSON.parse(fs.readFileSync(path.join(f.root,f.oldReceipt.path)));receipt.outputs=outputs;
  f.stages[1].receiptSha256=f.put('receipts/visualQA-1.json',receipt).sha256;f.stages[1].outputHashes=outputs;f.save();
  if(scenario==='tampered')fs.appendFileSync(path.join(f.root,fidelity.path),' ');
  if(['failure','protocol-failure'].includes(scenario)) {const {review}=prepareQaReview(f.options);assert.equal(review.reviewMode,'regression-review');assert.equal(review.priorReviewReceipt.path,f.oldReceipt.path);}
  else assert.throws(()=>prepareQaReview(f.options),scenario==='tampered'?/HASH_MISMATCH|PRIOR_BYTES_UNAVAILABLE/:/OLD_PASS_FORBIDDEN/);
});
test('fresh cannot reuse exposed reviewer and initial cannot pretend no prior review',t=>{
  const f=fixture(t);assert.throws(()=>prepareQaReview({...f.options,reviewMode:'fresh-blind'}),/ALREADY_EXPOSED/);assert.throws(()=>prepareQaReview({...f.options,reviewMode:'initial-blind'}),/HAS_PRIOR/);
});
test('capacity handoff freezes actual error, no spawn and fresh review independent',t=>{
  const f=fixture(t),error=f.put('capacity-error.json',{tool:'spawn_agent',error:'agent thread limit reached'}),{review,handoff}=prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/new',capacityErrorFile:error.path});
  assert.equal(handoff.state,'waiting-capacity');assert.deepEqual(handoff.capacityError,error);assert.equal(handoff.spawnAttempted,false);assert.equal(review.priorReviewReceipt,null);assert.equal(review.forbiddenInputsAbsent.priorVerdict,true);
});
for (const mode of ['initial-blind','fresh-blind']) test(`${mode} reviews current output after an in-place repair, not its superseded input`,t=>{
  const f=fixture(t),stage=f.stages[2],receipt=JSON.parse(fs.readFileSync(path.join(f.root,stage.receiptPath)));
  const current=receipt.outputs.find(ref=>ref.path.endsWith('current-demo.html'));
  receipt.inputs.push({...current,sha256:crypto.createHash('sha256').update('before repair').digest('hex')});
  stage.receiptSha256=f.put('receipts/demo-2.json',receipt).sha256;
  if(mode==='initial-blind')f.manifest.stages=f.stages.slice(2);
  f.save();const {review}=prepareQaReview({...f.options,reviewMode:mode,qaExecutionId:'/root/fresh-repair-qa'});
  assert.deepEqual(review.allowedInputs.filter(ref=>ref.path===current.path),[current]);validateQaReview(f.root,review);
  fs.appendFileSync(path.join(f.root,current.path),' changed after review');
  assert.throws(()=>validateQaReview(f.root,review),/HASH_MISMATCH/);
});
test('fresh review cannot discard changed frozen rules as superseded outputs',t=>{
  const f=fixture(t),stage=f.stages[2],receipt=JSON.parse(fs.readFileSync(path.join(f.root,stage.receiptPath)));
  const changed=f.put('approved-visual-patterns.json',{rules:['changed']});receipt.outputs.push(changed);
  stage.outputHashes=receipt.outputs;stage.receiptSha256=f.put('receipts/demo-2.json',receipt).sha256;f.save();
  assert.throws(()=>prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/fresh-rule-qa'}),/HASH_MISMATCH/);
});
test('legacy v1 keeps blind compatibility',()=>assert.equal(validateQaReview('/unused',{schema:'brand-blind-qa-input/v1'}).reviewMode,'initial-blind'));
test('initial independent review has fresh identity, no prior verdict and immutable rule bindings',t=>{
  const f=fixture(t);f.manifest.stages=f.stages.slice(2);f.save();const {review,handoff}=prepareQaReview({...f.options,reviewMode:'initial-blind',qaExecutionId:'/root/first-qa'});
  assert.equal(handoff.state,'ready');assert.equal(review.priorReviewReceipt,null);assert.equal(review.forbiddenInputsAbsent.priorVerdict,true);assert.deepEqual(review.frozenInputs,[f.rule]);validateQaReview(f.root,review);
});
test('implementation rationale remains forbidden during regression',t=>{
  const f=fixture(t),{review}=prepareQaReview(f.options);review.allowedInputs.push({...f.goal,kind:'implementation-rationale'});assert.throws(()=>validateQaReview(f.root,review),/FORBIDDEN_INPUT/);
});
for (const mode of ['initial-blind','fresh-blind']) test(`${mode} retains current source facts without producer context`,t=>{
  const f=fixture(t),facts=['brand-evidence.json','source-observation-manifest.json','held-out-challenge.json'].map(name=>f.put(name,{observed:true})),bad=f.put('implementation-self-test.json',{expectedVerdict:'pass'});
  const stage=f.stages[2],receipt=JSON.parse(fs.readFileSync(path.join(f.root,stage.receiptPath)));
  receipt.inputs.push(...facts,bad);const ref=f.put('receipts/demo-2.json',receipt);stage.receiptSha256=ref.sha256;
  if (mode === 'initial-blind') f.manifest.stages=f.stages.slice(2);
  f.save();const {review}=prepareQaReview({...f.options,reviewMode:mode,qaExecutionId:'/root/fresh-source-qa'});
  for (const fact of facts) assert(review.allowedInputs.some(ref=>ref.path===fact.path && ref.sha256===fact.sha256),fact.path);
  assert(!review.allowedInputs.some(ref=>ref.path===bad.path));validateQaReview(f.root,review);
});
test('next/record mechanically propagate mode/id and reject inherited captures before record',t=>{
  const f=fixture(t);f.manifest.schema='brand-subagent-execution/v1';f.manifest.runId='run';f.manifest.goalId='goal';f.manifest.brand='example';f.manifest.finalGates={};f.save();
  const {review}=prepareQaReview(f.options),skill=path.join(f.root,'skill');fs.mkdirSync(skill,{recursive:true});
  fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{visualQA:{goal:'review',inputs:{allowed:['visual'],forbidden:['prior verdict','implementation rationale','main conversation']},mustNot:['read prior verdict','read implementation rationale']}}}));
  const script=path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),run=(command,extra=[])=>spawnSync(process.execPath,[script,command,'--brand','example','--root',f.root,...extra],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
  const next=run('next');assert.equal(next.status,0,next.stderr);
  const dispatch=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/dispatch/visualQA-2.json')));assert.equal(dispatch.reviewMode,'regression-review');assert.equal(dispatch.reviewId,review.reviewId);assert.equal(dispatch.qaExecutionId,'/root/qa');assert(!dispatch.forbiddenInputs.includes('prior verdict'));assert(dispatch.forbiddenInputs.includes('implementation rationale'));assert(dispatch.requiredInputs.some(ref=>ref.path===f.oldReceipt.path));
  const assessment=f.put('visual-qa-assessment.json',{reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:'/root/qa',captureEvidence:[{...f.qaShot,reviewId:review.reviewId,capturedAt:new Date().toISOString()}]});
  const receipt={dispatchId:dispatch.dispatchId,stageId:'visualQA-2',role:'visualQA',agentExecutionId:'/root/qa',qaExecutionId:'/root/qa',goalSha256:f.goal.sha256,reviewMode:review.reviewMode,reviewId:review.reviewId,verdict:'fail',blockingFindings:['footer'],failureOwnerRole:'demoImplementationAgent',deltaScope:{affectedSections:['footer'],regressionSections:['header'],inputPaths:['current-demo.html']},inputs:dispatch.requiredInputs,outputs:[assessment]};
  const ref=f.put('receipts/visualQA-2.json',receipt),record=run('record',['--receipt',ref.path]);assert.notEqual(record.status,0);assert.match(record.stderr,/INHERITED_CAPTURE/);
  const stored=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')));assert.equal(stored.stages.at(-1).status,'dispatched');
});
test('only rendering/fact inputs reach QA and Hero variant source refs are discovered mechanically',t=>{
  const f=fixture(t),producerRefs=['repair-3.cjs','self-test-3.cjs','implementation-self-test-3.json','demo-3-repair-binding.json','producer-preservation-archive.json'].map(name=>f.put(name,{secret:'old verdict and producer explanation'}));
  const frame=f.put('source/supplemental-inline-2/frame-000.png','SOURCE HERO'),manifest=f.put('source/supplemental-inline-2/inline-svg-evidence.json',{observed:'actual source'}),original=f.put('source/original.svg','<svg/>');
  const oldInventoryPath='migrations/example/visual-pattern-inventory.json',oldInventoryHash=sha(path.join(f.root,oldInventoryPath)),oldInventory=f.put('attempts/visualQA-1/old-visual-pattern-inventory.json',fs.readFileSync(path.join(f.root,oldInventoryPath),'utf8'));f.put('attempts/visualQA-1/archive.json',{archivedOutputs:[{...oldInventory,originalPath:oldInventoryPath,sha256:oldInventoryHash}]});
  const inventory=f.put('visual-pattern-inventory.json',{pages:[{patterns:[{variantStateBinding:{sourceFrame:frame,manifest,original},latestProducerRepair:producerRefs[3]}]}]});
  const screenshotManifest=f.put('demo-screenshot-manifest.json',{pages:[{states:[{sourceCapture:frame,screenshot:f.screenshot}]}],producerScript:producerRefs[1]});
  f.stages[2].outputHashes.push(...producerRefs,screenshotManifest);f.stages[2].outputHashes=f.stages[2].outputHashes.map(ref=>ref.path===inventory.path?inventory:ref);
  const receipt=JSON.parse(fs.readFileSync(path.join(f.root,f.stages[2].receiptPath)));receipt.outputs=f.stages[2].outputHashes;const newReceipt=f.put('receipts/demo-2.json',receipt);f.stages[2].receiptSha256=newReceipt.sha256;f.save();
  const {review}=prepareQaReview(f.options),paths=review.allowedInputs.map(ref=>ref.path);
  for(const bad of producerRefs) assert(!paths.includes(bad.path));for(const fact of [frame,manifest,original,screenshotManifest,inventory]) assert(paths.includes(fact.path),fact.path);
  assert(review.currentDemoOutputs.some(ref=>ref.path===producerRefs[0].path),'producer outputs retained internally for validation');validateQaReview(f.root,review);
});
test('explicit pending replacement preserves old input/handoff and assigns a new review id',t=>{
  const f=fixture(t),first=prepareQaReview(f.options),before=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'))),oldBinding=before.stages.at(-1).qaReview,oldBytes=fs.readFileSync(path.join(f.root,oldBinding.path));
  const second=prepareQaReview({...f.options,replacePrepared:true});assert.notEqual(first.review.reviewId,second.review.reviewId);assert.deepEqual(fs.readFileSync(path.join(f.root,oldBinding.path)),oldBytes);validateQaReview(f.root,second.review);
  const updated=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')));assert.equal(updated.stages.at(-1).qaReviewReplacements[0].priorReview.sha256,oldBinding.sha256);
  updated.stages.at(-1).status='dispatched';f.put('execution-manifest.json',updated);assert.throws(()=>prepareQaReview({...f.options,replacePrepared:true}),/PENDING_LEARN/);
});
test('pending replacement refuses tampered prepared input and capacity can recover by replacement',t=>{
  const f=fixture(t),error=f.put('capacity-error.json',{error:'agent thread limit reached'}),first=prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/new',capacityErrorFile:error.path});assert.equal(first.handoff.state,'waiting-capacity');
  const second=prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/new',replacePrepared:true});assert.equal(second.handoff.state,'ready');assert.notEqual(first.review.reviewId,second.review.reviewId);
  const stored=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')));fs.appendFileSync(path.join(f.root,stored.stages.at(-1).qaReview.path),' ');assert.throws(()=>prepareQaReview({...f.options,replacePrepared:true}),/HASH_MISMATCH/);
});
test('authentic obsolete polluted pending packet is revoked, not dispatched, and sanitized replacement retains invalid reason',t=>{
  const f=fixture(t),first=prepareQaReview(f.options),producer=f.put('demo/self-test-3.cjs','// producer rationale/old verdict, never QA context');
  const stored=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'))),current=stored.stages.at(-1),old=first.review;old.allowedInputs.push(producer);
  const bytes=JSON.stringify(old,null,2)+'\n';fs.writeFileSync(path.join(f.root,current.qaReview.path),bytes);current.qaReview.sha256=sha(path.join(f.root,current.qaReview.path));fs.writeFileSync(path.join(f.root,'migrations/example/qa-input-manifest.json'),bytes);f.put('execution-manifest.json',stored);
  assert.throws(()=>validateQaReview(f.root,old),/FORBIDDEN_INPUT/);
  const skill=path.join(f.root,'skill');fs.mkdirSync(skill,{recursive:true});fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{visualQA:{goal:'review'}}}));
  const run=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--root',f.root,'--brand','example'],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});assert.notEqual(run.status,0);assert.match(run.stderr,/FORBIDDEN_INPUT/);
  const second=prepareQaReview({...f.options,replacePrepared:true});assert.notEqual(second.review.reviewId,old.reviewId);assert(!second.review.allowedInputs.some(ref=>ref.path===producer.path));validateQaReview(f.root,second.review);
  assert.equal(fs.readFileSync(path.join(f.root,current.qaReview.path),'utf8'),bytes);
  const updated=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'))),ledger=updated.stages.at(-1).qaReviewReplacements[0];assert.equal(ledger.priorInvalidReason,'QA_REVIEW_FORBIDDEN_INPUT');assert.deepEqual(ledger.revokedInputViolations,[{...producer,code:'QA_REVIEW_FORBIDDEN_INPUT'}]);
});
test('exact required source/scope whitelist survives replacement without admitting producer context',t=>{
  const f=fixture(t),names=['source-observation-manifest.json','brand-evidence.json','frozen-approved-learning-trial.json','held-out-challenge.json'];
  const facts=names.map(name=>f.put(name,{schema:'fixture-source-fact',frozen:true}));
  for (const ref of facts) assert(isQaArtifact(ref.path),ref.path);
  for (const name of ['self-test-3.cjs','demo-3-repair-binding.json','implementation-self-test-3.json','producer-preservation-archive.json','held-out-challenge-repair.json','brand-evidence-self-test.json','attempts/demo-2/brand-evidence.json']) assert(!isQaArtifact(`migrations/example/${name}`),name);
  const old=JSON.parse(fs.readFileSync(path.join(f.root,f.oldManifest.path)));old.allowedInputs.push(...facts);const manifestRef=f.put('qa-input-manifest.json',old);
  for (const stageId of ['demo-1','visualQA-1']) {
    const stage=f.stages.find(item=>item.id===stageId),receipt=JSON.parse(fs.readFileSync(path.join(f.root,stage.receiptPath)));
    for (const field of ['inputs','outputs']) receipt[field]=receipt[field].map(ref=>ref.path===manifestRef.path?manifestRef:ref);
    const receiptRef=f.put(stage.receiptPath.replace('migrations/example/',''),receipt);stage.receiptSha256=receiptRef.sha256;stage.outputHashes=receipt.outputs;
  }
  const dispatch=JSON.parse(fs.readFileSync(path.join(f.root,f.stages[1].dispatchPath)));dispatch.requiredInputs=dispatch.requiredInputs.map(ref=>ref.path===manifestRef.path?manifestRef:ref);f.put('dispatch/visualQA-1.json',dispatch);f.save();
  const first=prepareQaReview(f.options);for(const fact of facts) assert(first.review.allowedInputs.some(ref=>ref.path===fact.path && ref.sha256===fact.sha256),fact.path);
  const second=prepareQaReview({...f.options,replacePrepared:true});for(const fact of facts) assert(second.review.allowedInputs.some(ref=>ref.path===fact.path),fact.path);validateQaReview(f.root,second.review);
});
test('same pixels can be freshly recaptured at a new path/time, but old screenshot/interaction paths cannot',t=>{
  const f=fixture(t),oldInteraction=f.put('qa-interaction-old.png','unchanged interaction pixels');
  const assessment=JSON.parse(fs.readFileSync(path.join(f.root,f.oldAssessment.path)));assessment.pages=[{demoScreenshot:f.qaShot,interactions:[{screenshot:oldInteraction}]}];
  const priorAssessment=f.put('visual-qa-assessment.json',assessment),priorReceipt=JSON.parse(fs.readFileSync(path.join(f.root,f.oldReceipt.path)));priorReceipt.outputs=priorReceipt.outputs.map(ref=>ref.path===priorAssessment.path?priorAssessment:ref);f.stages[1].outputHashes=priorReceipt.outputs;const receipt=f.put('receipts/visualQA-1.json',priorReceipt);f.stages[1].receiptSha256=receipt.sha256;f.save();
  const {review}=prepareQaReview(f.options),base={reviewId:review.reviewId,reviewMode:review.reviewMode,qaExecutionId:review.qaExecutionId},metadata={reviewId:review.reviewId,capturedAt:new Date().toISOString()};
  assert(review.priorCapturePaths.includes(f.qaShot.path));assert(review.priorCapturePaths.includes(oldInteraction.path));
  const newPath=f.put('qa-current/new-screenshot.png',fs.readFileSync(path.join(f.root,f.qaShot.path)));assert.equal(newPath.sha256,f.qaShot.sha256);validateQaReview(f.root,review,{...base,captureEvidence:[{...newPath,...metadata}]});
  for(const old of [f.qaShot,oldInteraction,f.screenshot]) assert.throws(()=>validateQaReview(f.root,review,{...base,captureEvidence:[{...old,...metadata}]}),/INHERITED_CAPTURE/);
  assert.throws(()=>validateQaReview(f.root,review,{...base,captureEvidence:[{...newPath,...metadata,capturedAt:'2000-01-01T00:00:00Z'}]}),/INHERITED_CAPTURE/);
  assert.throws(()=>validateQaReview(f.root,review,{...base,captureEvidence:[{...newPath,...metadata,reviewId:'old-review'}]}),/INHERITED_CAPTURE/);
});
test('consecutive regression review finds hash-bound v2 prior input and keeps QA identity while changing reviewId',t=>{
 const f=fixture(t),first=prepareQaReview(f.options),manifest=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'))),qa=manifest.stages.at(-1),input=qa.qaReview;
 const assessment=f.put('visual-qa-assessment.json',{schema:'brand-visual-qa-assessment/v2',qaExecutionId:'/root/qa',reviewId:first.review.reviewId,reviewMode:'regression-review',reviewerRecommendation:'fail'}),dispatch=f.put('dispatch/visualQA-2.json',{dispatchId:'qa2-dispatch',requiredInputs:[f.goal,input]});
 const receipt=f.put('receipts/visualQA-2.json',{stageId:qa.id,role:'visualQA',agentExecutionId:'/root/qa',dispatchId:'qa2-dispatch',goalSha256:f.goal.sha256,verdict:'fail',inputs:[f.goal,input],outputs:[assessment],deltaScope:{affectedSections:['footer'],regressionSections:['header','held-out']}});
 Object.assign(qa,{status:'failed',verdict:'fail',agentExecutionId:'/root/qa',receiptPath:receipt.path,receiptSha256:receipt.sha256,dispatchPath:dispatch.path,outputHashes:[assessment]});
 const html=f.put('next-demo.html','second repair HTML'),demoReceipt=f.put('receipts/demo-3.json',{stageId:'demo-3',verdict:'pass',goalSha256:f.goal.sha256,agentExecutionId:'/root/demo3',inputs:[f.goal,manifest.stages.find(stage=>stage.id==='demo-2').outputHashes[0]],outputs:[html]});manifest.stages.push({id:'demo-3',stage:'demo',role:'demoImplementationAgent',status:'complete',agentExecutionId:'/root/demo3',receiptPath:demoReceipt.path,receiptSha256:demoReceipt.sha256,outputHashes:[html]},{id:'visualQA-3',stage:'visualQA',role:'visualQA',status:'pending'});manifest.currentStageId='visualQA-3';f.put('execution-manifest.json',manifest);
 const second=prepareQaReview({...f.options,priorReceipt:receipt.path});assert.equal(second.review.qaExecutionId,'/root/qa');assert.notEqual(second.review.reviewId,first.review.reviewId);assert.deepEqual(second.review.priorReviewReceipt,receipt);validateQaReview(f.root,second.review);
});
function dispatchedFixture(t){const f=fixture(t),stage=f.stages.at(-1),dispatch=f.put('dispatch/visualQA-2.json',{dispatchId:'undelivered',stageId:stage.id,role:'visualQA',goalSha256:f.goal.sha256});Object.assign(stage,{status:'dispatched',dispatchId:'undelivered',dispatchPath:dispatch.path,startedAt:new Date().toISOString()});f.save();const attestation=f.put('director-revoke.json',{schema:'brand-qa-dispatch-revocation/v1',ownerRole:'designDirectorOrchestrator',attestedBy:'/root/director',stageId:stage.id,dispatchId:'undelivered',dispatchSha256:dispatch.sha256,delivered:false,executed:false,reason:'Orchestrator generated the wrong packet but never sent it to any agent.'});return {...f,dispatch,attestation,options:{root:f.root,brand:'example',attestation:attestation.path,attestationSha256:attestation.sha256}};}
test('Director-attested undelivered dispatch revocation preserves actual dispatch/manifest then supports regression prepare',t=>{
 const f=dispatchedFixture(t),before=fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')),packet=fs.readFileSync(path.join(f.root,f.dispatch.path)),result=revokeUndeliveredQaDispatch(f.options);assert.equal(result.status,'pending');assert.deepEqual(fs.readFileSync(path.join(f.root,f.dispatch.path)),packet);
 const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'))),ledger=manifest.qaDispatchRevocations[0];validateQaDispatchRevocations(f.root,manifest);assert.deepEqual(fs.readFileSync(path.join(f.root,ledger.archivedOutputs.find(ref=>ref.originalPath.endsWith('execution-manifest.json')).path)),before);
 const prepared=prepareQaReview({root:f.root,brand:'example',reviewMode:'regression-review',qaExecutionId:'/root/qa',priorReceipt:f.oldReceipt.path,affected:['footer'],regressionScope:['header','held-out']});assert.equal(prepared.review.reviewMode,'regression-review');
 fs.appendFileSync(path.join(f.root,ledger.archivedOutputs[0].path),' ');assert.throws(()=>validateQaDispatchRevocations(f.root,manifest),/HASH_MISMATCH/);
});
for(const mode of ['delivered','executed','stale','hash','agent','receipt'])test(`dispatch revocation rejects ${mode}`,t=>{
 const f=dispatchedFixture(t);if(['delivered','executed','stale'].includes(mode)){const approval=JSON.parse(fs.readFileSync(path.join(f.root,f.attestation.path)));if(mode==='stale')approval.dispatchId='old';else approval[mode]=true;const ref=f.put('director-revoke.json',approval);f.options.attestationSha256=ref.sha256;}
 if(mode==='hash')fs.appendFileSync(path.join(f.root,f.dispatch.path),' ');if(mode==='agent'){f.stages.at(-1).agentExecutionId='/root/already-delivered';f.save();}if(mode==='receipt')f.put('receipts/visualQA-2.json',{verdict:'fail'});
 const before=fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'));assert.throws(()=>revokeUndeliveredQaDispatch(f.options),/QA_REVOCATION|HASH_MISMATCH/);assert.deepEqual(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')),before);
});
test('new producer rule path requires fresh review even when old approved bytes remain unchanged',t=>{
 const f=fixture(t),alternative=f.put('alternative-approved-rules.json',{rules:['new materially different rules']}),stage=f.stages[2],receipt=JSON.parse(fs.readFileSync(path.join(f.root,stage.receiptPath)));receipt.inputs=[f.goal,alternative];const updated=f.put('receipts/demo-2.json',receipt);stage.receiptSha256=updated.sha256;f.save();assert.equal(sha(path.join(f.root,f.rule.path)),f.rule.sha256);assert.throws(()=>prepareQaReview(f.options),/CURRENT_PRODUCER_RULES_CHANGED_REQUIRES_FRESH/);
});
test('transitively consumed producer rule is compared with the prior approved rule',t=>{
 const f=fixture(t),other=f.put('other-approved-rules.json',{rules:['different approved decision']}),handoff=f.put('interpreter-mapping.json',{mapping:'bound'});
 const producerReceipt=f.put('receipts/interpreter-1.json',{stageId:'interpreter-1',role:'designTranslator',verdict:'pass',inputs:[f.goal,other],outputs:[handoff]});
 f.stages.splice(2,0,{id:'interpreter-1',stage:'interpreter',role:'designTranslator',status:'complete',receiptPath:producerReceipt.path,receiptSha256:producerReceipt.sha256,outputHashes:[handoff]});
 const demo=f.stages.find(stage=>stage.id==='demo-2'),receipt=JSON.parse(fs.readFileSync(path.join(f.root,demo.receiptPath)));receipt.inputs=[f.goal,handoff];demo.receiptSha256=f.put('receipts/demo-2.json',receipt).sha256;f.save();
  assert.throws(()=>prepareQaReview(f.options),/CURRENT_PRODUCER_RULES_CHANGED_REQUIRES_FRESH/);
});
function archivedProducerRuleFixture(t) {
 const f=fixture(t),producer=f.stages[0],current=f.stages[2],original=producer.outputHashes[0];
 const copy=f.put('attempts/demo-1/workspace/old-demo.html',fs.readFileSync(path.join(f.root,original.path)));
 const archive=f.put('attempts/demo-1/producer-preservation-archive.json',{schema:'brand-qa-triggered-demo-preservation/v1',stage:structuredClone(producer),archivedOutputs:[{...copy,originalPath:original.path}]});
 const receipt=JSON.parse(fs.readFileSync(path.join(f.root,current.receiptPath)));receipt.inputs=[f.goal,copy];
 current.receiptSha256=f.put('receipts/demo-2.json',receipt).sha256;current.retryInput={priorQaPreservation:archive};f.save();
 return {...f,copy,archive,current,receipt};
}
test('same-byte archived producer input retains its original frozen rule chain',t=>{
 const f=archivedProducerRuleFixture(t),{review}=prepareQaReview(f.options);
 assert.deepEqual(review.frozenInputs,[f.rule]);validateQaReview(f.root,review);
});
test('archived producer alias does not hide a genuinely changed current rule',t=>{
 const f=archivedProducerRuleFixture(t),changed=f.put('different-approved-rules.json',{rules:['new decision']});
 f.receipt.inputs.push(changed);f.current.receiptSha256=f.put('receipts/demo-2.json',f.receipt).sha256;f.save();
 assert.throws(()=>prepareQaReview(f.options),/CURRENT_PRODUCER_RULES_CHANGED_REQUIRES_FRESH/);
});
for(const target of ['archive','copy'])test('producer rule alias rejects tampered '+target,t=>{
 const f=archivedProducerRuleFixture(t);fs.appendFileSync(path.join(f.root,f[target].path),' ');
 assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_HASH_MISMATCH/);
});
test('unbound originalPath cannot invent a producer-rule alias',t=>{
 const f=archivedProducerRuleFixture(t),unknown=f.put('attempts/unknown/workspace/old-demo.html',fs.readFileSync(path.join(f.root,f.copy.path)));
 f.receipt.inputs=[f.goal,{...unknown,originalPath:f.stages[0].outputHashes[0].path}];
 f.current.receiptSha256=f.put('receipts/demo-2.json',f.receipt).sha256;f.save();
 assert.throws(()=>prepareQaReview(f.options),/QA_REVIEW_PRODUCER_ARCHIVE_ALIAS_UNKNOWN/);
});
test('fresh review binds the consumed interpreter rule, not the superseded input used to author it',t=>{
 const f=fixture(t),oldRule={...f.rule,sha256:crypto.createHash('sha256').update('previous rules').digest('hex')};
 const receipt=f.put('receipts/interpreter-2.json',{inputs:[oldRule],outputs:[f.rule]});
 f.stages.splice(2,0,{id:'interpreter-2',stage:'interpreter',role:'designTranslator',status:'complete',receiptPath:receipt.path,receiptSha256:receipt.sha256,outputHashes:[f.rule]});f.save();
 const {review}=prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/fresh-rules'});
 assert.deepEqual(review.frozenInputs,[f.rule]);validateQaReview(f.root,review);
});
test('fresh next does not leak previous findings through retryInput',t=>{
 const f=fixture(t);Object.assign(f.manifest,{schema:'brand-subagent-execution/v1',runId:'run',goalId:'goal',brand:'example',finalGates:{}});
 f.stages.at(-1).retryInput={blockingFindings:[{description:'PRIOR_VERDICT_SECRET'}],deltaScope:{affectedSections:['header']}};f.save();
 prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/fresh-packet'});
 const skill=path.join(f.root,'skill');fs.mkdirSync(skill,{recursive:true});fs.writeFileSync(path.join(skill,'workflow-contract.json'),JSON.stringify({roles:{visualQA:{goal:'review'}}}));
 const result=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--brand','example','--root',f.root],{encoding:'utf8',env:{...process.env,BRAND_SKILL_ROOT:skill}});
 assert.equal(result.status,0,result.stderr);assert(!result.stdout.includes('PRIOR_VERDICT_SECRET'));
 assert.equal(JSON.parse(result.stdout).dispatchRequest.retryInput,null);
 const saved=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')));
 assert.equal(saved.stages.at(-1).retryInput.blockingFindings[0].description,'PRIOR_VERDICT_SECRET');
});
test('direct current rule supersedes same-path rule inherited through an older page, retaining other inherited rules',t=>{
 const f=fixture(t),old=f.stages[0],oldReceipt=JSON.parse(fs.readFileSync(path.join(f.root,old.receiptPath)));
 const extra=f.put('other-approved-rules.json',{rules:['keep this additional constraint']});oldReceipt.inputs.push(extra);
 old.receiptSha256=f.put('receipts/demo-1.json',oldReceipt).sha256;
 const currentRule=f.put('approved-visual-patterns.json',{rules:['new approved rule']}),stage=f.stages[2],receipt=JSON.parse(fs.readFileSync(path.join(f.root,stage.receiptPath)));
 receipt.inputs=[f.goal,currentRule,old.outputHashes[0]];stage.receiptSha256=f.put('receipts/demo-2.json',receipt).sha256;f.save();
 const {review}=prepareQaReview({...f.options,reviewMode:'fresh-blind',qaExecutionId:'/root/fresh-combined'});
 assert.deepEqual(review.frozenInputs,[currentRule,extra]);validateQaReview(f.root,review);
 fs.appendFileSync(path.join(f.root,extra.path),' tamper');assert.throws(()=>validateQaReview(f.root,review),/HASH_MISMATCH/);
});
test('QA identity exposed through Evidence or Interpreter production cannot be reused for review',t=>{
 const f=fixture(t);for(const role of ['brandResearcher','designTranslator']){f.manifest.stages.unshift({id:role+'-production',stage:role==='brandResearcher'?'evidence':'interpreter',role,status:'complete',agentExecutionId:'/root/qa'});f.save();assert.throws(()=>prepareQaReview(f.options),/PRODUCER_SELF_REVIEW/);f.manifest.stages.shift();}
});
test('v2 run cannot silently dispatch legacy fresh QA after preparation failure',t=>{
 const f=fixture(t);prepareQaReview(f.options);const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')));manifest.stages.push({id:'visualQA-3',stage:'visualQA',role:'visualQA',status:'pending'});manifest.currentStageId='visualQA-3';f.put('execution-manifest.json',manifest);
 const before=fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')),dispatchPath=path.join(f.root,'migrations/example/dispatch/visualQA-3.json');
 const result=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--brand','example','--root',f.root],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/QA_REVIEW_PREPARATION_REQUIRED/);assert(!fs.existsSync(dispatchPath));assert.deepEqual(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')),before);assert.equal(JSON.parse(before).stages.at(-1).status,'pending');
});
test('the first failed v2 prepare attempt still blocks legacy next dispatch',t=>{
 const f=fixture(t);f.manifest.schema='brand-subagent-execution/v1';f.manifest.runId='run';f.manifest.goalId='goal';f.manifest.brand='example';f.manifest.finalGates={};f.save();
 assert.throws(()=>prepareQaReview({...f.options,qaExecutionId:'/root/demo2'}),/PRODUCER_SELF_REVIEW/);
 const before=fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json'));
 const result=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/brand-subagent-workflow.mjs'),'next','--brand','example','--root',f.root],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/QA_REVIEW_PREPARATION_REQUIRED/);assert.deepEqual(fs.readFileSync(path.join(f.root,'migrations/example/execution-manifest.json')),before);
 assert(!fs.existsSync(path.join(f.root,'migrations/example/dispatch/visualQA-2.json')));
});
