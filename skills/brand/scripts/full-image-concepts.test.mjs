import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {prepareImageBatchHandoff} from './image-batch-handoff.mjs';
import { imageConceptDelivery, prepareImageConcepts, regenerateImageConcepts, recordImagePreparation, recordImageConcept, recordImageConcepts, compactImageConceptResult } from './full-image-concepts.mjs';

test('identity policy survives preparation without turning business exclusions into character bans',t=>{
 const f=fixture(t),policy={scope:'full-image-concept',instruction:'Preserve original IP; allow new illustrations. Host search remains Search.'};
 f.write(path.join(f.dir,'brand-intent.json'),{imageIdentityPolicy:policy});
 const prepared=prepareImageConcepts({...f,preparationRequired:true});
 const dispatch=JSON.parse(fs.readFileSync(prepared.dispatch.path));
 assert.deepEqual(dispatch.imageIdentityPolicy,policy);
 for(const d of dispatch.directions)assert(d.prompt.includes(policy.instruction));
 const briefFile=f.write(path.join(f.root,'brief.md'),'Host: Search. No source-site game statuses.');
 const promptFile=f.write(path.join(f.root,'prompt.txt'),'Do not copy source fields, recognizable characters, logos into host.');
 const args={...f,briefFile,promptFile,scene:'search',observer:'test',notObserved:'source-only fixture'};
 assert.throws(()=>recordImagePreparation(args),/contradicts the bound brand identity policy/);
 f.write(promptFile,'Host: Search. Do not copy source-site game statuses. '+policy.instruction);
 recordImagePreparation(args);
 const packet=JSON.parse(fs.readFileSync(path.join(f.dir,'host-preparation/producer-dispatch.json')));
 assert.deepEqual(packet.imageIdentityPolicy,policy);
 assert.deepEqual(packet.inputImages,dispatch.inputImages);
 assert.equal(fs.readFileSync(packet.sharedBrief.prepared.promptText.path,'utf8'),fs.readFileSync(promptFile,'utf8'));
});

test('compact output preserves originals, failure state and review while omitting repeated prompt payload',t=>{
  const f=fixture(t);const full=prepareImageConcepts(f),before=sha(full.dispatch.path);
  const compact=compactImageConceptResult(full);
  assert.equal(compact.dispatchRequest,undefined);
  assert.deepEqual(compact.pendingDirectionIds,['a','b','c']);
  assert.equal(compact.dispatchFile,full.dispatch.path);
  assert.deepEqual(compact.failureRecording,full.dispatchRequest.failureRecording);
  assert.equal(compact.failureRecording.template.schema,'brand-image-generation-failure/v1');
  assert.equal(compact.failureRecording.files.a,path.join(f.dir,'image-concepts','a-failure.json'));
  assert.equal(sha(full.dispatch.path),before);
  assert.deepEqual(JSON.parse(fs.readFileSync(compact.dispatchFile)).inputImages,full.dispatchRequest.inputImages);
  f.checkpoint('a');
  f.write(path.join(f.dir,'image-concepts','c-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'c',tool:'image_gen',code:'moderation_blocked',reason:'Synthetic failure'});
  const result=spawnSync(process.execPath,[entry,'delivery','--artifact-root',f.root,'--brand',f.brand,'--compact'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const got=JSON.parse(result.stdout);assert.equal(got.images.length,1);assert.deepEqual(got.pendingDirectionIds,['b']);assert.equal(got.generationFailures.length,1);
  assert.equal(got.dispatchRequest,undefined);assert.equal(got.userGoalCompleted,false);
  const reviewed={status:'blocked',reviewRequest:{images:['actual-image']},failedReview:{notes:'real issue'}};
  assert.deepEqual(compactImageConceptResult(reviewed),reviewed);
});

const entry = path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
test('batch handoff transfers whole execution responsibility and preserves three existing originals',t=>{
 const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');
 assert.throws(()=>prepareImageBatchHandoff({...f,verifyExisting:true}),/three saved/);
 f.checkpoint('b');f.checkpoint('c');
 const prior=imageConceptDelivery(f);const result=prepareImageBatchHandoff({...f,verifyExisting:true});
 t.after(()=>fs.rmSync(path.dirname(result.packet.path),{recursive:true,force:true}));
 const packet=JSON.parse(fs.readFileSync(result.packet.path));
 assert.equal(result.launch.fork_turns,'none');assert.equal(packet.allowGeneration,false);
 assert.equal(packet.allowHostEdits,false);assert.deepEqual(packet.reviewInputs.images,prior.images);
 assert.deepEqual(packet.reviewInputs.inputs,prior.reviewRequest.inputs);
 assert.deepEqual(packet.reviewInputs.inputImages,prior.reviewRequest.inputImages);
 assert.deepEqual(packet.reviewInputs.sharedBrief,prior.reviewRequest.sharedBrief);
 assert.deepEqual(imageConceptDelivery(f).images,prior.images);
});
const completePrompt = prompt => `${prompt}\n<shared-design-brief>Host: search collection; navigation: home; action: Search; no captured records, show loading state. Viewport 1280x800. Brand rules: use bound typography and control shapes. Runtime state not observed.</shared-design-brief>`;

test('normal dispatch shares concrete section-state guidance with producer and review',t=>{
  const f=fixture(t);prepareImageConcepts(f);
  const dispatch=JSON.parse(fs.readFileSync(path.join(f.dir,'image-concepts-dispatch.json'),'utf8'));
  assert.match(dispatch.conceptScope.business,/actual visible labels/);
  assert.match(dispatch.conceptScope.business,/collapsed/);
  assert.match(dispatch.conceptScope.business,/leaving composition and imagery free/);
});

test('host observations remain separate from brand references and the actual shared brief reaches QA',t=>{
  const f=fixture(t);
  const startupFile=path.join(f.dir,'host-startup-page.json');
  const startup=JSON.parse(fs.readFileSync(startupFile));
  const capture=f.write(path.join(f.root,'captures/host-home.png'),fs.readFileSync(f.refs[0]));
  f.write(startupFile,{...startup,visualEvidence:{screenshot:path.relative(f.root,capture)}});
  const result=prepareImageConcepts(f),dispatch=result.dispatchRequest;
  assert.equal(dispatch.sharedBrief.hostVisualEvidence.status,'available');
  assert.equal(dispatch.sharedBrief.hostVisualEvidence.images[0].path,capture);
  assert.equal(dispatch.inputImages.some(x=>x.path===capture),false);
  assert.equal(dispatch.sharedBrief.brandVisual.inputs.some(x=>x.path===f.source),false);
  f.checkpoint('a');f.checkpoint('b');f.checkpoint('c');
  const qa=imageConceptDelivery(f).reviewRequest;
  assert.deepEqual(qa.sharedBrief,dispatch.sharedBrief);
  assert.equal(qa.sharedDesignBrief.status,'observed');
  assert.equal(qa.sharedDesignBrief.text,completePrompt('').split('<shared-design-brief>')[1].split('</shared-design-brief>')[0]);
  fs.appendFileSync(capture,'changed');
  assert.throws(()=>imageConceptDelivery(f),/hash mismatch/);
});

test('missing or differing briefs preserve successful images and expose the difference to QA',t=>{
  const f=fixture(t),dispatch=prepareImageConcepts(f).dispatchRequest;
  assert.equal(dispatch.sharedBrief.hostVisualEvidence.status,'not-observed');
  f.checkpoint('a');
  const inputFile=f.write(path.join(f.dir,'changed-args.json'),{prompt:completePrompt(dispatch.directions[1].prompt).replace('action: Search','action: Purchase'),referenced_image_paths:f.refs});
  const outputFile=f.write(path.join(f.dir,'changed-output.png'),fs.readFileSync(f.refs[0]));
  const saved=recordImageConcept({...f,id:'b',inputFile,outputFile,producer:'fixture-producer',toolCallId:'synthetic'});
  assert.equal(saved.images.length,2);
  assert.equal(saved.dispatchRequest.sharedDesignBrief.status,'inconsistent');
  const missing=f.write(path.join(f.dir,'missing-args.json'),{prompt:dispatch.directions[2].prompt,referenced_image_paths:f.refs});
  const third=f.write(path.join(f.dir,'third.png'),Buffer.concat([fs.readFileSync(f.refs[0]),Buffer.from('third')]));
  const ready=recordImageConcept({...f,id:'c',inputFile:missing,outputFile:third,producer:'fixture-producer',toolCallId:'synthetic-c'});
  assert.equal(ready.status,'review-ready');
  assert.equal(ready.images.length,3);
  assert.equal(ready.reviewRequest.sharedDesignBrief.status,'inconsistent');
  assert.deepEqual(ready.reviewRequest.sharedDesignBrief.differingDirectionIds,['b']);
  assert.deepEqual(ready.reviewRequest.sharedDesignBrief.missingDirectionIds,['c']);
  assert.match(ready.reviewRequest.sharedDesignBrief.directions[1].text,/Purchase/);
});

test('absent brief delimiters are recorded as missing without blocking a successful checkpoint',t=>{
  const f=fixture(t),dispatch=prepareImageConcepts(f).dispatchRequest;
  const inputFile=f.write(path.join(f.dir,'plain-args.json'),{prompt:dispatch.directions[0].prompt,referenced_image_paths:f.refs});
  const outputFile=f.write(path.join(f.dir,'plain.png'),fs.readFileSync(f.refs[0]));
  const saved=recordImageConcept({...f,id:'a',inputFile,outputFile,producer:'fixture-producer',toolCallId:'synthetic'});
  assert.equal(saved.images.length,1);
  assert.equal(saved.dispatchRequest.sharedDesignBrief.status,'missing');
});

test('host capture retains historical scene provenance and verifies its declared hash',t=>{
  const f=fixture(t),startupFile=path.join(f.dir,'host-startup-page.json');
  const startup=JSON.parse(fs.readFileSync(startupFile));
  const capture=f.write(path.join(f.root,'captures/host.png'),fs.readFileSync(f.refs[0]));
  const visualEvidence={capturedAt:'2026-10-15T10:00:00Z',scene:'first visit, 0/5',source:'local browser observation',images:[{path:path.relative(f.root,capture),sha256:sha(capture)}]};
  f.write(startupFile,{...startup,visualEvidence});
  const observation=prepareImageConcepts(f).dispatchRequest.sharedBrief.hostVisualEvidence;
  assert.equal(observation.images[0].capturedAt,visualEvidence.capturedAt);
  assert.equal(observation.images[0].scene,visualEvidence.scene);
  assert.equal(observation.images[0].source,visualEvidence.source);
  assert.equal(observation.images[0].currency,'not-revalidated');
  assert.equal(observation.images[0].observationScope,'historical-observation');
  assert.match(observation.limitations[0],/dependencies, runtime state/);
});

for(const problem of ['changed','missing'])test(`declared ${problem} host capture is an input error, not silently re-endorsed or omitted`,t=>{
  const f=fixture(t),startupFile=path.join(f.dir,'host-startup-page.json');
  const startup=JSON.parse(fs.readFileSync(startupFile));
  const capture=path.join(f.root,'captures/host.png');
  if(problem==='changed') f.write(capture,fs.readFileSync(f.refs[0]));
  f.write(startupFile,{...startup,visualEvidence:{path:path.relative(f.root,capture),sha256:'0'.repeat(64)}});
  assert.throws(()=>prepareImageConcepts(f),problem==='changed'?/host observation hash mismatch/:/host observation is missing/);
  assert.equal(fs.existsSync(path.join(f.dir,'image-concepts.json')),false);
});

for(const count of [0,1,2]) test(`continue starts three NEW directions from ${count}-image blocked batch without losing history`,t=>{
  const f=fixture(t);prepareImageConcepts(f);
  for(const id of ['a','b'].slice(0,count))f.checkpoint(id);
  const failed=f.write(path.join(f.dir,'image-concepts','c-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'c',tool:'image_gen',code:'moderation_blocked',reason:'Synthetic refusal, not permission to retry'});
  const old=imageConceptDelivery(f),failureHash=sha(failed);
  assert.deepEqual(old.userChoices.continueGeneration.requiredFlags,['--confirm-new-batch','--feedback']);
  const argv=[entry,'regenerate-image-concepts','--artifact-root',f.root,'--brand',f.brand,'--feedback','Three genuinely new compliant concepts'];
  assert.notEqual(spawnSync(process.execPath,argv,{encoding:'utf8'}).status,0);
  const cli=spawnSync(process.execPath,[...argv,'--confirm-new-batch'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);const next=JSON.parse(cli.stdout);
  t.after(()=>fs.rmSync(path.dirname(next.artifactRoot),{recursive:true,force:true}));
  assert.deepEqual(next.dispatchRequest.directions.map(d=>d.id),['a','b','c']);
  assert.equal(next.completedImages.length,0);assert.equal(next.images.length,0);
  assert.equal(next.history[0].completedCount,count);
  assert.deepEqual(next.history[0].images,old.images);
  assert.equal(sha(failed),failureHash);assert.equal(imageConceptDelivery(f).status,count<2?'dispatch-ready':'awaiting-user-choice');
  assert.match(next.dispatchRequest.producerInstructions,/never reword refused content/);
  const opts={root:next.artifactRoot,brand:f.brand},d=next.dispatchRequest.directions[0];
  const inputFile=f.write(path.join(opts.root,'a-args.json'),{prompt:completePrompt(d.prompt),referenced_image_paths:d.referenced_image_paths});
  const outputFile=path.join(opts.root,'a.png');fs.copyFileSync(f.refs[0],outputFile);fs.appendFileSync(outputFile,'new-a');
  const partial=recordImageConcept({...opts,id:'a',inputFile,outputFile,toolCallId:'synthetic-new-a',producer:'new-producer'});
  assert.equal(partial.previewAvailable,true);assert.equal(partial.images.length,1);
  assert.deepEqual(partial.directionStates.map(d=>d.status),['saved','pending','pending']);
  if(count){fs.copyFileSync(old.images[0].path,outputFile);assert.throws(()=>recordImageConcept({...opts,id:'b',inputFile,outputFile,toolCallId:'copy',producer:'new-producer'}),/Prior output/);}
  else {fs.appendFileSync(failed,'changed');assert.throws(()=>imageConceptDelivery(opts),/hash mismatch/);}
});

test('one gallery serves only hash-bound history and keeps its images outside current count',async t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');
  f.write(path.join(f.dir,'image-concepts','c-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'c',tool:'image_gen',code:'blocked',reason:'Synthetic failure'});
  const next=regenerateImageConcepts({...f,confirmed:true,feedback:'Three new concepts'});
  t.after(()=>fs.rmSync(path.dirname(next.artifactRoot),{recursive:true,force:true}));
  const server=spawn(process.execPath,[path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'),'--root',next.artifactRoot,'--port','0']);t.after(()=>server.kill());
  const base=await new Promise((resolve,reject)=>{let output='';server.stdout.on('data',b=>{output+=b;const m=output.match(/http:\/\/[^\s]+/);if(m)resolve(m[0]);});server.on('error',reject);server.on('exit',code=>reject(Error(`Gallery exited ${code}`)));});
  const current=new URL('/__brand_comparison__?brand='+f.brand,base);
  let response=await fetch(current),html=await response.text();assert.equal(response.status,200);
  assert.equal((html.match(/<img /g)||[]).length,0);assert.match(html,/已保存 0\/3 张/);assert.match(html,/可选 A/);assert.match(html,/不计入本轮/);
  assert.match(html,/aria-label="下一步选择"/);assert.match(html,/再来三个新方向/);
  assert.match(html,/本轮暂无可选图/);assert.match(html,/选历史图/);assert.match(html,/暂停/);
  const history=new URL(current);history.searchParams.set('history','1');
  response=await fetch(history);html=await response.text();assert.equal(response.status,200);assert.match(html,/生成受阻/);assert.match(html,/方案 B：待生成/);assert.equal((html.match(/<img /g)||[]).length,1);
  const imageUrl=new URL('/__brand_history_image__?brand='+f.brand+'&history=1&direction=a',base);
  response=await fetch(imageUrl);assert.equal(response.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),next.history[0].images[0].sha256);
  for(const value of ['../','/etc/passwd','999']) {history.searchParams.set('history',value);assert.equal((await fetch(history)).status,409);}
  assert.equal((await fetch(new URL('/__brand_history_image__?brand='+f.brand+'&history=1&direction=../../etc/passwd',base))).status,400);
  assert.equal((await fetch(new URL('/__brand_history_image__?brand='+f.brand+'&history=1&direction=b',base))).status,404);
  fs.appendFileSync(next.history[0].images[0].path,'corrupt');
  assert.equal((await fetch(imageUrl)).status,409);assert.equal((await fetch(current)).status,409);
});

test('all blocked with historical B/C still exposes real choices without changing original images',async t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('b');f.checkpoint('c');
  const next=regenerateImageConcepts({...f,confirmed:true,feedback:'New independent directions'});
  t.after(()=>fs.rmSync(path.dirname(next.artifactRoot),{recursive:true,force:true}));
  const opts={root:next.artifactRoot,brand:f.brand};
  for(const id of ['a','b','c'])f.write(path.join(opts.root,'migrations',f.brand,'image-concepts',`${id}-failure.json`),{schema:'brand-image-generation-failure/v1',direction:id,tool:'image_gen',code:'moderation_blocked',reason:'Synthetic refusal'});
  const result=imageConceptDelivery(opts);
  assert.equal(result.status,'awaiting-user-choice');assert.equal(result.images.length,0);assert.equal(result.selectionAvailable,true);
  assert.deepEqual(result.userChoices.selectableDirections,[]);assert.deepEqual(result.history[0].images.map(i=>i.id),['b','c']);
  const server=spawn(process.execPath,[path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'),'--root',opts.root,'--port','0']);t.after(()=>server.kill());
  const base=await new Promise((resolve,reject)=>{let text='';server.stdout.on('data',b=>{text+=b;const m=text.match(/http:\/\/[^\s]+/);if(m)resolve(m[0]);});server.on('error',reject);server.on('exit',code=>reject(Error(`Gallery exited ${code}`)));});
  const response=await fetch(new URL('/__brand_comparison__?brand='+f.brand,base)),html=await response.text();
  assert.equal(response.status,200);assert.match(html,/已保存 0\/3 张/);assert.match(html,/可选 B\/C/);assert.match(html,/再来三个新方向/);assert.match(html,/选历史图/);assert.match(html,/暂停/);assert.doesNotMatch(html,/setTimeout/);
  for(const image of next.history[0].images)assert.equal(sha(image.path),image.sha256);
});

test('new concepts cannot reuse images from an older ancestor through an empty intermediate batch',t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');
  const second=regenerateImageConcepts({...f,confirmed:true,feedback:'New three'});
  const third=regenerateImageConcepts({root:second.artifactRoot,brand:f.brand,confirmed:true,feedback:'Another new three'});
  for(const run of [second,third])t.after(()=>fs.rmSync(path.dirname(run.artifactRoot),{recursive:true,force:true}));
  assert.deepEqual(third.history.map(h=>h.completedCount),[0,1]);
  const d=third.dispatchRequest.directions[0],inputFile=f.write(path.join(third.artifactRoot,'args.json'),{prompt:completePrompt(d.prompt),referenced_image_paths:d.referenced_image_paths});
  const outputFile=path.join(third.artifactRoot,'a.png');fs.copyFileSync(third.history[1].images[0].path,outputFile);
  assert.throws(()=>recordImageConcept({root:third.artifactRoot,brand:f.brand,id:'a',inputFile,outputFile,producer:'new-producer',toolCallId:'synthetic-copy'}),/Prior output/);
});

for(const count of [0,1,2]) test(`public recovery preserves ${count} successful images and dispatches only missing directions`,t=>{
  const f=fixture(t);prepareImageConcepts({...f,sampleData:true});
  for(const id of ['a','b'].slice(0,count))f.checkpoint(id);
  // Synthetic historical calls: keep their original older template verbatim.
  if(count===2)for(const id of ['a','b']) {
    const file=path.join(f.dir,'image-concepts',`${id}-generation.json`);
    const record=JSON.parse(fs.readFileSync(file,'utf8'));
    const args=JSON.parse(fs.readFileSync(record.arguments.path,'utf8'));
    record.prompt=args.prompt=args.prompt.replace('无需识别或命名角色，直接依据所给参考图和素材的可见内容生成','依据参考素材保持原 IP 特征，允许新的构图和插画');
    f.write(record.arguments.path,args);record.arguments.sha256=sha(record.arguments.path);f.write(file,record);
  }
  const fail=f.write(path.join(f.dir,'image-concepts','c-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'c',tool:'image_gen',code:'moderation_blocked',reason:'Synthetic refusal'});
  const before=sha(fail),old=imageConceptDelivery(f);
  assert.equal(old.previewAvailable,true);assert.equal(old.images.length,count);
  assert.equal(old.selectionAvailable,count>0);
  const args=[entry,'regenerate-image-concepts','--artifact-root',f.root,'--brand',f.brand,'--missing-only','--feedback','A genuinely different compliant direction','--recovery-kind','new-design'];
  assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);
  assert.throws(()=>regenerateImageConcepts({...f,missingOnly:true,confirmed:true,feedback:'retry',recoveryKind:'technical-correction'}),/Safety refusal/);
  const cli=spawnSync(process.execPath,[...args,'--confirm-new-batch'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);const next=JSON.parse(cli.stdout);
  t.after(()=>fs.rmSync(path.dirname(next.artifactRoot),{recursive:true,force:true}));
  assert.deepEqual(next.dispatchRequest.directions.map(d=>d.id),['a','b','c'].slice(count));
  assert.deepEqual(next.completedImages.map(d=>d.sha256),old.completedImages.map(d=>d.sha256));
  assert.equal(sha(fail),before);assert.equal(imageConceptDelivery(f).status,count<2?'dispatch-ready':'awaiting-user-choice');
  const opts={root:next.artifactRoot,brand:f.brand};
  for(const d of next.dispatchRequest.directions){
    const inputFile=f.write(path.join(opts.root,`${d.id}-args.json`),{prompt:completePrompt(d.prompt),referenced_image_paths:d.referenced_image_paths});
    const outputFile=path.join(opts.root,`${d.id}.png`);fs.copyFileSync(f.refs[0],outputFile);fs.appendFileSync(outputFile,d.id);
    recordImageConcept({...opts,id:d.id,producer:'new-producer',toolCallId:'synthetic-'+d.id,inputFile,outputFile});
  }
  const ready=imageConceptDelivery(opts);assert.equal(ready.status,'review-ready');
  assert.equal(ready.sampleData,true);assert.equal(ready.reviewRequest.sampleData,true);
  const reviewFile=f.write(path.join(opts.root,'review.json'),{...ready.reviewRequest.reviewShape,reviewer:'independent-fixture',verdict:'pass',distinctCompositions:true,notes:'synthetic contract only',directions:ready.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:true}))});
  assert.equal(recordImageConcepts({...opts,reviewFile}).userGoalCompleted,true);
  if(count){fs.appendFileSync(next.completedImages[0].path,'changed');assert.throws(()=>imageConceptDelivery(opts),/hash mismatch|changed/);}
});

test('generation failure preserves images and full-image goal without automatic medium fallback',t=>{
  const f=fixture(t);prepareImageConcepts(f);const a=f.checkpoint('a');
  const file=f.write(path.join(f.dir,'image-concepts','b-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'b',tool:'image_gen',code:'moderation_blocked',reason:'Synthetic tool refusal; cause unspecified'});
  const failureHash=sha(file),saved=a.completedImages[0];
  const result=imageConceptDelivery(f);
  assert.equal(result.status,'dispatch-ready');assert.equal(result.userGoalCompleted,false);
  assert.equal(result.failureGuidance.requestedMedium,'full-image');
  assert.equal(result.failureGuidance.defaultMediumFallback,null);
  assert.equal(result.failureGuidance.automaticRetry,false);
  assert.equal(result.failureGuidance.completedCount,1);assert.equal(result.failureGuidance.requiredCount,3);
  assert.deepEqual(result.completedImages,[saved]);assert.equal(sha(file),failureHash);
  assert.deepEqual(result.dispatchRequest.directions.map(d=>d.id),['c']);assert.equal(result.reviewRequest,undefined);
  assert.equal(fs.existsSync(path.join(f.dir,'h5-directions')),false);
});

test('a terminal failure keeps other authorized directions dispatchable and gallery refreshing until no pending work',async t=>{
  const f=fixture(t);prepareImageConcepts(f);
  const failed=f.write(path.join(f.dir,'image-concepts','a-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'a',tool:'image_gen',code:'moderation_blocked',reason:'Synthetic refusal'});
  const failureHash=sha(failed),pending=imageConceptDelivery(f);
  assert.deepEqual(pending.dispatchRequest.directions.map(d=>d.id),['b','c']);
  assert.equal(pending.previewStatus,'partial-blocked');assert.equal(pending.status,'dispatch-ready');
  assert.throws(()=>recordImageConcept({...f,id:'a',producer:'producer',toolCallId:'retry'}),/recorded generation failure/);
  const server=spawn(process.execPath,[path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'),'--root',f.root,'--port','0']);t.after(()=>server.kill());
  const base=await new Promise((resolve,reject)=>{let text='';server.stdout.on('data',b=>{text+=b;const m=text.match(/http:\/\/[^\s]+/);if(m)resolve(m[0]);});server.on('error',reject);server.on('exit',code=>reject(Error(`Gallery exited ${code}`)));});
  const url=new URL('/__brand_comparison__?brand='+f.brand,base);
  let html=await(await fetch(url)).text();assert.match(html,/data-review-status="partial-blocked"/);assert.match(html,/15000/);
  const afterB=f.checkpoint('b');assert.deepEqual(afterB.dispatchRequest.directions.map(d=>d.id),['c']);assert.equal(afterB.images.length,1);
  html=await(await fetch(url)).text();assert.match(html,/15000/);assert.match(html,/已保存 1\/3 张/);
  const done=f.checkpoint('c');assert.equal(done.dispatchRequest,undefined);assert.equal(done.reviewRequest,undefined);assert.equal(done.status,'awaiting-user-choice');assert.equal(done.userGoalCompleted,false);
  assert.deepEqual(done.directionStates.map(d=>d.status),['blocked','saved','saved']);assert.equal(sha(failed),failureHash);
  html=await(await fetch(url)).text();assert.doesNotMatch(html,/setTimeout/);assert.equal((html.match(/<img /g)||[]).length,2);
  assert.match(html,/<section data-direction="a" data-generation-status="blocked">/);
  assert.match(html,/<code>moderation_blocked<\/code>/);
  assert.match(html,/Synthetic refusal/);
  assert.match(html,/本轮可选 B\/C/);assert.match(html,/落地隔离单页/);
  assert.doesNotMatch(html,/选历史图/);
  assert.equal((html.match(/<section/g)||[]).length,3);
});

test('failed-only freezes passed bytes, reviews only changed image, and retains business gates', t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const parentImages=ready.reviewRequest.images;
  const failed={reviewer:'independent',verdict:'fail',notes:'C has wrong business state',limitations:['Keep original limitation'],directions:parentImages.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:d.id!=='c'}))};
  const reviewFile=f.write(path.join(f.dir,'fail.json'),failed);recordImageConcepts({...f,reviewFile});
  const parentHash=sha(path.join(f.dir,'image-concepts-failed-review.json'));
  const cli=spawnSync(process.execPath,[entry,'regenerate-image-concepts','--artifact-root',f.root,'--brand',f.brand,'--feedback','Fix C business state only','--confirm-new-batch','--failed-only'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);
  const next=JSON.parse(cli.stdout);
  t.after(()=>fs.rmSync(path.dirname(next.artifactRoot),{recursive:true,force:true}));
  const opts={root:next.artifactRoot,brand:f.brand};
  assert.deepEqual(next.dispatchRequest.directions.map(d=>d.id),['c']);
  assert.deepEqual(next.completedImages.map(d=>d.sha256),parentImages.slice(0,2).map(d=>d.sha256));
  assert.throws(()=>recordImageConcept({...opts,id:'a',producer:'producer',toolCallId:'bad'}),/frozen/);
  const d=next.dispatchRequest.directions[0];
  const inputFile=f.write(path.join(opts.root,'args.json'),{prompt:completePrompt(d.prompt),referenced_image_paths:d.referenced_image_paths});
  const outputFile=path.join(opts.root,'c.png');fs.copyFileSync(parentImages[2].path,outputFile);fs.appendFileSync(outputFile,'corrected');
  const reviewed=recordImageConcept({...opts,id:'c',producer:'new-producer',toolCallId:'new-c',inputFile,outputFile});
  assert.deepEqual(reviewed.reviewRequest.images.map(d=>d.id),['c']);
  assert.deepEqual(reviewed.reviewRequest.frozenImages.map(d=>d.id),['a','b']);
  const partial={...reviewed.reviewRequest.reviewShape,reviewer:'independent2',verdict:'pass',distinctCompositions:true,notes:'Corrected state; final trio distinct',directions:reviewed.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:false}))};
  const rr=f.write(path.join(opts.root,'review.json'),partial);
  assert.throws(()=>recordImageConcepts({...opts,reviewFile:rr}),/bind and approve/);
  partial.directions[0].hostTaskPreserved=true;
  f.write(rr,{...partial,directions:[...partial.directions,failed.directions[0]]});
  assert.throws(()=>recordImageConcepts({...opts,reviewFile:rr}),/Review only changed/);
  f.write(rr,{...partial,distinctCompositions:false});
  assert.throws(()=>recordImageConcepts({...opts,reviewFile:rr}));
  f.write(rr,partial);
  const delivered=recordImageConcepts({...opts,reviewFile:rr});
  assert.equal(delivered.status,'ready-for-user-review');
  assert.deepEqual(delivered.limitations,['Keep original limitation']);
  assert.equal(sha(path.join(f.dir,'image-concepts-failed-review.json')),parentHash);
  assert.equal(imageConceptDelivery(f).status,'blocked');
  assert.throws(()=>regenerateImageConcepts({...opts,confirmed:true,feedback:'retry',failedOnly:true}),/One bounded/);
  fs.appendFileSync(next.completedImages[0].path,'tamper');
  assert.throws(()=>imageConceptDelivery(opts),/hash mismatch|Frozen output/);
});

test('failed-only rejects missing boolean findings rather than guessing passing images',t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const reviewFile=f.write(path.join(f.dir,'fail.json'),{reviewer:'independent',verdict:'fail',notes:'incomplete findings',directions:ready.reviewRequest.images});
  recordImageConcepts({...f,reviewFile});
  assert.throws(()=>regenerateImageConcepts({...f,feedback:'repair',confirmed:true,failedOnly:true}),/Explicit hash-bound/);
});
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-full-image-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'run/build'), host = path.join(base, 'host'), brand = 'image-fixture';
  const dir = path.join(root, 'migrations', brand);
  const write = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); return p; };
  write(path.join(base, 'run/run.json'), { schema: 'brand-artifact-run/v1', id: 'fixture', host, status: 'active' });
  write(path.join(host, 'package.json'), { dependencies: { vue: '3' } });
  write(path.join(host, 'src/app.config.ts'), "export default { pages: ['pages/home/index'] };");
  const source = write(path.join(host, 'src/pages/home/index.vue'), '<template><view><text>Search collection</text><input placeholder="Search" /></view></template>');
  // Synthetic bytes test provenance plumbing only; these are never visual QA evidence.
  const raster = n => Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(11000, n)]);
  const refs = ['captures/home.png', 'captures/editorial.png', 'assets/hero.png'].map((p, i) => write(path.join(root, p), raster(i)));
  write(path.join(dir, 'brand-mod.json'), { schema: 'fixture/v1', tokens: [], assets: refs.map(p => path.relative(root, p)) });
  write(path.join(dir, 'brand-evidence.json'), { screenshots: refs.slice(0, 2).map(p => path.relative(root, p)) });
  write(path.join(dir, 'brand-intent.json'), {});
  write(path.join(dir, 'host-startup-page.json'), { hostRoot: host, sourceFile: 'src/pages/home/index.vue', sourceSha256: sha(source) });
  // Legacy fixtures exercise existing immutable runs; new public runs below
  // exercise the required observation/brief preparation handoff.
  const opts = { root, brand, hostTarget: host, preparationRequired:false };
  const checkpoint = id => {
    const dispatch = imageConceptDelivery(opts).dispatchRequest;
    const inputFile = write(path.join(dir, `args-${id}.json`), { prompt: completePrompt(dispatch.directions.find(d => d.id === id).prompt), referenced_image_paths: refs });
    const outputFile = write(path.join(dir, `output-${id}.png`), raster(id.charCodeAt(0)));
    return recordImageConcept({ ...opts, id, inputFile, outputFile, toolCallId: `fixture-${id}`, producer: 'fixture-producer' });
  };
  return { ...opts, dir, source, refs, write, checkpoint };
}

test('new public host-concepts defaults to full-image and keeps host unchanged', t => {
  const f = fixture(t), before = sha(f.source);
  const result = spawnSync(process.execPath, [entry, 'run', '--request-kind', 'host-concepts', '--mode', 'design-host', '--brand', f.brand, '--artifact-root', f.root, '--host-target', f.hostTarget, '--mod-file', path.join(f.dir, 'brand-mod.json')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.medium, 'full-image');
  assert.equal(output.status,'preparation-required');
  assert.equal(output.dispatchRequest,undefined);
  assert.equal(output.preparationRequest.role,'image-concept-input-preparation');
  assert.equal(output.userGoalCompleted, false);
  assert.equal(fs.existsSync(path.join(f.dir, 'execution-manifest.json')), false);
  assert.equal(sha(f.source), before);
  const resumed = spawnSync(process.execPath, [entry, 'continue', '--artifact-root', f.root, '--brand', f.brand], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).status,'preparation-required');
  const brief=f.write(path.join(f.root,'draft.md'),'Host: search collection. Search action. Unknown runtime state. Viewport 1280x800. Brand controls follow tokens; original expressive imagery remains a proposal.');
  const recorded=spawnSync(process.execPath,[entry,'record-image-preparation','--artifact-root',f.root,'--brand',f.brand,'--brief',brief,'--scene','source-only first visit','--observer','fixture-agent','--not-observed','No runtime browser in this fixture','--compact'],{encoding:'utf8'});
  assert.equal(recorded.status,0,recorded.stdout+recorded.stderr);
  const compact=JSON.parse(recorded.stdout);
  assert.deepEqual(compact.pendingDirectionIds, ['a', 'b', 'c']);
  assert.equal(compact.dispatchRequest, undefined);
  assert.deepEqual(JSON.parse(fs.readFileSync(compact.dispatchFile)).directions.map(d=>d.id), ['a','b','c']);
  assert.equal(compact.coordinationCommands.preview.includes('--root'),true);
  const prepared=JSON.parse(fs.readFileSync(compact.dispatchFile));
  assert.equal(prepared.sharedBrief.prepared.observation.status,'not-observed');
  assert.deepEqual(prepared.sharedBrief.hostVisualEvidence.limitations,['No runtime browser in this fixture']);
  assert.equal(prepared.sharedBrief.prepared.observation.capturedAt,null);
  assert.equal(prepared.sharedBrief.prepared.promptTextStatus,'not-prepared');
  assert.ok(prepared.directions.every(d=>!d.prompt.includes(fs.readFileSync(brief,'utf8'))));
  const expanded=spawnSync(process.execPath,[entry,'continue','--artifact-root',f.root,'--brand',f.brand,'--full'],{encoding:'utf8'});
  assert.equal(expanded.status,0,expanded.stdout+expanded.stderr);
  assert.deepEqual(JSON.parse(expanded.stdout).dispatchRequest.directions,JSON.parse(fs.readFileSync(compact.dispatchFile)).directions);
});

test('prepared scene, common brief and dependency originals reach producer and independent QA unchanged',t=>{
  const f=fixture(t);
  const initial=prepareImageConcepts({...f,preparationRequired:true});
  assert.equal(initial.status,'preparation-required');
  const brief=f.write(path.join(f.root,'draft.md'),'Local provenance: http://localhost:4175/ and src/data.ts. Maintenance scope only. Collection product; first visit; Search collection and Search action; no real records. 1280x800. Controls follow brand; original landscape is a proposed visual treatment.');
  const promptFile=f.write(path.join(f.root,'prompt.txt'),'Collection product. Search collection and Search action. First visit; no real records. 1280x800. Original landscape is a proposed visual treatment; controls follow brand.');
  const dependency=f.write(path.join(f.hostTarget,'src/data.ts'),'export const labels = ["Search collection"];');
  const screenshot=f.write(path.join(f.root,'host-shot.png'),fs.readFileSync(f.refs[0]));
  const params={...f,briefFile:brief,promptFile,screenshotFile:screenshot,sourceUrl:'http://localhost:4175/',scene:'first visit',observer:'fixture-browser-agent',capturedAt:'2026-10-16T12:00:00Z',sourceFiles:[dependency]};
  const prepared=recordImagePreparation(params);
  assert.equal(prepared.status,'dispatch-ready');
  const d=prepared.dispatchRequest;
  assert.equal(prepared.preparationReviewRequest.status,'pending-no-images');
  assert.equal(prepared.preparationReviewRequest.reviewed,false);
  assert.deepEqual(prepared.preparationReviewRequest.inputs,d.inputs);
  assert.deepEqual(prepared.preparationReviewRequest.sharedBrief,d.sharedBrief);
  assert.equal(d.sharedBrief.hostVisualEvidence.status,'observed');
  assert.deepEqual(d.sharedBrief.hostVisualEvidence.limitations,[d.sharedBrief.prepared.observation.scope]);
  assert.doesNotMatch(d.sharedBrief.hostVisualEvidence.limitations.join(' '),/No host screenshot|not been observed/);
  assert.ok(d.directions.every(direction=>direction.prompt.includes(fs.readFileSync(promptFile,'utf8'))&&!direction.prompt.includes('localhost')&&!direction.prompt.includes('src/data.ts')));
  assert.equal(d.inputImages.some(i=>i.path===screenshot),false);
  assert.equal(d.sharedBrief.prepared.observation.capturedAt,params.capturedAt);
  assert.ok(d.inputs.some(i=>i.path===dependency&&i.sha256===sha(dependency)));
  assert.deepEqual(recordImagePreparation(params).dispatchRequest,d);
  // The tool output and draft are mutable work files; frozen copies survive.
  fs.appendFileSync(screenshot,'work-file changed');fs.appendFileSync(brief,'draft changed');
  for(const direction of d.directions) {
    const inputFile=f.write(path.join(f.root,`${direction.id}-prepared-args.json`),{prompt:direction.prompt,referenced_image_paths:direction.referenced_image_paths});
    const outputFile=f.write(path.join(f.root,`${direction.id}-prepared-output.png`),Buffer.concat([fs.readFileSync(f.refs[0]),Buffer.from(direction.id)]));
    recordImageConcept({...f,id:direction.id,inputFile,outputFile,toolCallId:'synthetic-'+direction.id,producer:'fixture-producer'});
  }
  const qa=imageConceptDelivery(f).reviewRequest;
  assert.deepEqual(qa.sharedBrief,d.sharedBrief);
  assert.deepEqual(qa.inputs,d.inputs);
  assert.deepEqual(qa.preparedInput,d.preparedInput);
  assert.equal(qa.sharedDesignBrief.status,'observed');
  fs.appendFileSync(dependency,'changed');
  assert.throws(()=>imageConceptDelivery(f),/hash mismatch/);
});

test('checkpoint resume, independent review, image gallery and hash rejection stay bound', async t => {
  const f = fixture(t);
  prepareImageConcepts(f);
  assert.deepEqual(f.checkpoint('a').dispatchRequest.directions.map(d => d.id), ['b', 'c']);
  f.checkpoint('b');
  const ready = f.checkpoint('c');
  assert.equal(ready.status, 'review-ready');
  assert.deepEqual(ready.reviewRequest.conceptScope,JSON.parse(fs.readFileSync(path.join(f.dir,'image-concepts-dispatch.json'))).conceptScope);
  const review = { ...ready.reviewRequest.reviewShape, reviewer: 'fixture-producer', verdict: 'pass', distinctCompositions: true, notes: 'Synthetic plumbing test, not actual visual approval', directions: ready.reviewRequest.reviewShape.directions.map(d => ({ ...d, completeScreen: true, brandFaithful: true, hostTaskPreserved: true })) };
  const reviewFile = f.write(path.join(f.dir, 'review.json'), review);
  assert.throws(() => recordImageConcepts({ ...f, reviewFile }), /Independent visual reviewer/);
  f.write(reviewFile, { ...review, reviewer: 'fixture-independent' });
  const delivered = recordImageConcepts({ ...f, reviewFile });
  assert.equal(delivered.userGoalCompleted, true);
  assert.equal(delivered.interactive, false);
  assert.equal(delivered.hostImplementationComplete, false);
  const server = spawn(process.execPath, [path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'), '--root', f.root, '--port', '0']);
  t.after(() => server.kill());
  const url = await new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', bytes => { output += bytes; const match = output.match(/http:\/\/[^\s]+/); if (match) resolve(match[0]); });
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Gallery exited ${code}`)));
  });
  const response = await fetch(new URL(delivered.comparisonPreview.path, url));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/<img /g) || []).length, 3);
  assert.match(html, /不可交互/);
  fs.appendFileSync(f.refs[0], 'changed');
  assert.throws(() => imageConceptDelivery(f), /hash mismatch/);
  assert.equal((await fetch(new URL(delivered.comparisonPreview.path, url))).status, 409);
});

test('existing H5 history cannot be overwritten by image preparation', t => {
  const f = fixture(t);
  f.write(path.join(f.dir, 'execution-manifest.json'), { mode: 'design-host' });
  assert.throws(() => prepareImageConcepts(f), /Existing H5 history is immutable/);
});

for (const mode of ['design-host', 'learn-brand']) test(`public new image request cannot inherit historical ${mode} medium`, t => {
  const f=fixture(t);
  const manifest=f.write(path.join(f.dir,'execution-manifest.json'),{mode});
  const old=f.write(path.join(f.dir,'h5-directions/a.html'),'<p>old A, not selected</p>');
  const before=[sha(manifest),sha(old),sha(f.source),sha(path.join(f.dir,'brand-mod.json'))];
  const args=[entry,'run','--request-kind','host-concepts','--mode','design-host','--brand',f.brand,'--artifact-root',f.root,'--host-target',f.hostTarget,'--mod-file',path.join(f.dir,'brand-mod.json')];
  for(const flags of [[],['--concept-medium','full-image']]) {
    const r=spawnSync(process.execPath,[...args,...flags],{encoding:'utf8'});
    assert.equal(r.status,1,r.stdout+r.stderr);
    assert.equal(JSON.parse(r.stdout).blockingCode,'IMAGE_CONCEPTS_FRESH_RUN_REQUIRED');
    assert.deepEqual([sha(manifest),sha(old),sha(f.source),sha(path.join(f.dir,'brand-mod.json'))],before);
    assert.equal(fs.existsSync(path.join(f.dir,'design-host-route.json')),false);
    assert.equal(fs.existsSync(path.join(f.dir,'image-concepts.json')),false);
  }
});

test('standard gallery exposes pending and failed honestly, then approved at same URL; incomplete/corrupt remain blocked', async t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');
  const server=spawn(process.execPath,[path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'),'--root',f.root,'--port','0']);t.after(()=>server.kill());
  const base=await new Promise((resolve,reject)=>{let text='';server.stdout.on('data',b=>{text+=b;const m=text.match(/http:\/\/[^\s]+/);if(m)resolve(m[0]);});server.on('error',reject);});
  const url=new URL('/__brand_comparison__?brand='+f.brand,base);
  const partial=await fetch(url);assert.equal(partial.status,200);assert.match(await partial.text(),/已保存 2\/3 张/);
  const ready=f.checkpoint('c');assert.equal(ready.userGoalCompleted,false);assert.equal(ready.status,'review-ready');assert.equal(ready.previewAvailable,true);
  let res=await fetch(url);assert.equal(res.status,200);let html=await res.text();assert.match(html,/data-review-status="pending"/);assert.match(html,/15000/);assert.equal((html.match(/<img /g)||[]).length,3);
  const failFile=f.write(path.join(f.dir,'failed-status.json'),{reviewer:'independent',verdict:'fail',notes:'Essential navigation missing',directions:ready.reviewRequest.images});
  assert.equal(recordImageConcepts({...f,reviewFile:failFile}).userGoalCompleted,false);
  html=await(await fetch(url)).text();assert.match(html,/data-review-status="failed"/);assert.match(html,/Essential navigation missing/);assert.doesNotMatch(html,/setTimeout/);
  const failed=path.join(f.dir,'image-concepts-failed-review.json');
  const pass=f.write(path.join(f.dir,'recheck.json'),{reviewer:'another-independent',verdict:'pass',notes:'Synthetic test reassessment',reassessmentReason:'Synthetic fixture correction',supersedesFailedReview:{path:failed,sha256:sha(failed)},distinctCompositions:true,directions:ready.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:true}))});
  assert.equal(recordImageConcepts({...f,reviewFile:pass}).userGoalCompleted,true);
  html=await(await fetch(url)).text();assert.match(html,/data-review-status="approved"/);assert.doesNotMatch(html,/setTimeout/);
  fs.appendFileSync(ready.reviewRequest.images[0].path,'corrupt');assert.equal((await fetch(url)).status,409);
  assert.equal((await fetch(new URL('/__brand_comparison__?brand=unprepared-h5',base))).status,409);
});

test('explicit new batch forks verified inputs, keeps failed parent immutable and resumes independently', t=>{
  const f=fixture(t);
  f.write(path.join(f.dir,'host-startup-page.json'),{hostRoot:path.relative(f.root,f.hostTarget),sourceFile:'src/pages/home/index.vue',sourceSha256:sha(f.source)});
  prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const reviewFile=f.write(path.join(f.dir,'failed.json'),{reviewer:'other',verdict:'fail',notes:'fixture fail',directions:ready.reviewRequest.images});
  recordImageConcepts({...f,reviewFile});
  const old=fs.readdirSync(f.dir).filter(x=>fs.statSync(path.join(f.dir,x)).isFile()).map(x=>[x,sha(path.join(f.dir,x))]);
  assert.throws(()=>regenerateImageConcepts({...f,feedback:'again'}),/Explicit/);
  const next=regenerateImageConcepts({...f,feedback:'再来三个更有表现力的',confirmed:true});
  t.after(()=>fs.rmSync(path.dirname(next.artifactRoot),{recursive:true,force:true}));
  assert.notEqual(next.artifactRoot,f.root);assert.equal(next.status,'dispatch-ready');
  assert.equal(next.dispatchRequest.regeneration.feedback,'再来三个更有表现力的');
  assert.equal(next.dispatchRequest.regeneration.priorDirections.length,3);
  assert.equal(JSON.parse(fs.readFileSync(path.join(next.artifactRoot,'migrations',f.brand,'host-startup-page.json'))).hostRoot,fs.realpathSync(f.hostTarget));
  assert.deepEqual(next.completedImages,[]);
  assert.equal(fs.existsSync(path.join(next.artifactRoot,'migrations',f.brand,'image-concepts-failed-review.json')),false);
  assert.equal(fs.existsSync(path.join(next.artifactRoot,'migrations',f.brand,'image-concepts-receipt.json')),false);
  assert.deepEqual(old,old.map(([x])=>[x,sha(path.join(f.dir,x))]));
  assert.equal(imageConceptDelivery(f).status,'blocked');
  const args=next.dispatchRequest.directions[0];
  const inputFile=f.write(path.join(next.artifactRoot,'args.json'),{prompt:completePrompt(args.prompt),referenced_image_paths:args.referenced_image_paths});
  const prior=ready.reviewRequest.images[0];
  const outputFile=path.join(next.artifactRoot,'old.png');fs.copyFileSync(prior.path,outputFile);
  assert.throws(()=>recordImageConcept({root:next.artifactRoot,brand:f.brand,id:'a',inputFile,outputFile,toolCallId:'new',producer:'new'}),/Prior output/);
  fs.appendFileSync(f.source,'changed');
  assert.throws(()=>regenerateImageConcepts({...f,feedback:'again',confirmed:true}),/hash mismatch|source changed/);
});

test('new batch rejects absolute parent-local JSON references before copying stale paths', t=>{
  const f=fixture(t);
  const mod=path.join(f.dir,'brand-mod.json');f.write(mod,{assets:f.refs.map(x=>fs.realpathSync(x))});
  prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');f.checkpoint('c');
  assert.throws(()=>regenerateImageConcepts({...f,feedback:'again',confirmed:true}),/portable brand input/);
});

test('independent concept pass may disclose localized visual deviations without runtime certification', t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const review={reviewer:'independent',verdict:'pass',distinctCompositions:true,notes:'Synthetic plumbing: recognizable brand and correct business; small visual deviation disclosed.',limitations:['Local progress color role needs implementation correction; does not impair reading or direction selection.'],directions:ready.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:true}))};
  const reviewFile=f.write(path.join(f.dir,'limited-pass.json'),review);
  const delivery=recordImageConcepts({...f,reviewFile});
  assert.equal(delivery.userGoalCompleted,true);assert.equal(delivery.fullWorkflowPass,false);assert.equal(delivery.hostImplementationComplete,false);
  assert.deepEqual(delivery.limitations,review.limitations);
});

test('same-image independent reassessment requires exact failed binding and reason; old FAIL remains', t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const failed={reviewer:'original-independent',verdict:'fail',notes:'Synthetic initial visual interpretation',directions:ready.reviewRequest.images};
  const reviewFile=f.write(path.join(f.dir,'initial-review.json'),failed);
  assert.equal(recordImageConcepts({...f,reviewFile}).status,'blocked');
  const failedFile=path.join(f.dir,'image-concepts-failed-review.json'),original=sha(failedFile);
  const review={reviewer:'reassessment-independent',verdict:'pass',distinctCompositions:true,notes:'Reassessed same outputs at concept-selection scope.',limitations:['Small color role deviation remains; correct in implementation.'],directions:ready.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:true}))};
  const next=f.write(path.join(f.dir,'reassessment.json'),review);
  assert.throws(()=>recordImageConcepts({...f,reviewFile:next}),/explicit failed-review binding/);
  assert.equal(imageConceptDelivery(f).status,'blocked');
  f.write(next,{...review,supersedesFailedReview:{path:failedFile,sha256:'0'.repeat(64)},reassessmentReason:'Correct overly strict concept-stage interpretation.'});
  assert.throws(()=>recordImageConcepts({...f,reviewFile:next}),/hash mismatch/);
  f.write(next,{...review,supersedesFailedReview:{path:reviewFile,sha256:sha(reviewFile)},reassessmentReason:'Correct overly strict concept-stage interpretation.'});
  assert.throws(()=>recordImageConcepts({...f,reviewFile:next}),/this run/);
  f.write(next,{...review,supersedesFailedReview:{path:failedFile,sha256:original}});
  assert.throws(()=>recordImageConcepts({...f,reviewFile:next}),/reassessmentReason/);
  f.write(next,{...review,supersedesFailedReview:{path:failedFile,sha256:original},reassessmentReason:'Correct overly strict concept-stage interpretation; observed localized deviation does not affect brand recognition, business or readability.'});
  assert.equal(recordImageConcepts({...f,reviewFile:next}).userGoalCompleted,true);
  assert.equal(sha(failedFile),original);
  fs.appendFileSync(ready.reviewRequest.images[0].path,'changed');
  assert.throws(()=>imageConceptDelivery(f),/hash mismatch|bind and approve|same images/);
});

test('material business failure stays blocked and cannot be superseded by a nonpassing review', t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const reviewFile=f.write(path.join(f.dir,'material-fail.json'),{reviewer:'independent',verdict:'fail',notes:'Synthetic fixture: core navigation missing.',directions:ready.reviewRequest.images});
  assert.equal(recordImageConcepts({...f,reviewFile}).status,'blocked');
  const fail=path.join(f.dir,'image-concepts-failed-review.json');
  const originalFail=sha(fail);
  assert.equal(recordImageConcepts({...f,reviewFile}).status,'blocked');
  const repeated=f.write(path.join(f.dir,'second-fail.json'),{reviewer:'second-independent',verdict:'fail',notes:'Failure confirmed on reassessment.',directions:ready.reviewRequest.images});
  assert.throws(()=>recordImageConcepts({...f,reviewFile:repeated}),/failed review is immutable/);
  assert.equal(sha(fail),originalFail);assert.equal(fs.existsSync(repeated),true);
  const next=f.write(path.join(f.dir,'bad-pass.json'),{reviewer:'other-independent',verdict:'pass',distinctCompositions:true,notes:'Core navigation still absent',supersedesFailedReview:{path:fail,sha256:sha(fail)},reassessmentReason:'Recheck',directions:ready.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:false}))});
  assert.throws(()=>recordImageConcepts({...f,reviewFile:next}),/bind and approve/);
  assert.equal(imageConceptDelivery(f).status,'blocked');
});
