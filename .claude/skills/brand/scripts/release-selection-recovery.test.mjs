import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { test, mock } from 'node:test';
import {prepareImageBatchHandoff} from './image-batch-handoff.mjs';
import {selectImageCode} from './selected-image-code.mjs';
import {frozenImageCall} from './image-call-evidence.mjs';
import { imageConceptDelivery, prepareImageConcepts, recordImagePreparation, recordImageConcept as checkpointActual, recordImageConcepts, compactImageConceptResult } from './full-image-concepts.mjs';

// Synthetic plumbing only. Mock the trusted-store locator in this test process;
// do not modify HOME/CODEX_HOME or write to the real session store.
const runtimeHome=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'brand-test-runtime-')));
fs.mkdirSync(path.join(runtimeHome,'sessions'));
const originalRealpath=fs.realpathSync;
const realStore=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions');
mock.method(fs,'realpathSync',(value,...args)=>String(value)===realStore?path.join(runtimeHome,'sessions'):originalRealpath(value,...args));
process.on('exit',()=>{mock.restoreAll();fs.rmSync(runtimeHome,{recursive:true,force:true});});
function recordImageConcept(opts) {
  if(!opts.inputFile || !opts.outputFile) return checkpointActual(opts);
  const args=JSON.parse(fs.readFileSync(opts.inputFile));
  const callLog=path.join(runtimeHome,'sessions',opts.autoEvidence?`rollout-test-${process.env.CODEX_THREAD_ID}.jsonl`:`${crypto.randomUUID()}.jsonl`);
  const event={type:'response_item',timestamp:'2026-10-17T12:00:00Z',payload:{type:'custom_tool_call',name:'exec',call_id:opts.toolCallId,input:`const r = await tools.image_gen__imagegen(${JSON.stringify(args)}); generatedImage(r);`}};
  const result={type:'response_item',timestamp:'2026-10-17T12:01:00Z',payload:{type:'custom_tool_call_output',call_id:opts.toolCallId,output:[{type:'input_image',image_url:`data:image/png;base64,${fs.readFileSync(opts.outputFile).toString('base64')}`}]}};
  fs.writeFileSync(callLog,(opts.autoEvidence?JSON.stringify({type:'session_meta',payload:{id:process.env.CODEX_THREAD_ID}})+'\n':'')+JSON.stringify(event)+'\n'+JSON.stringify(result)+'\n');
  if(opts.viaCli) {
    const result=spawnSync(process.execPath,[entry,'record-image-concept','--artifact-root',opts.root,'--brand',opts.brand,'--direction',opts.id,...(opts.autoEvidence?[]:['--call-log',callLog,'--call-id',opts.toolCallId,'--tool-call-id','ignored-display-id']),'--output',opts.outputFile,'--producer',opts.producer],{encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);return JSON.parse(result.stdout);
  }
  return checkpointActual({...opts,callLog,callId:opts.toolCallId});
}

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function fixture(t,{browserRaster=false}={}) {
  // Match brand-artifacts init, which returns a canonical build directory.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brand-full-image-test-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'run/build'), host = path.join(base, 'host'), brand = 'image-fixture';
  const dir = path.join(root, 'migrations', brand);
  const write = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); return p; };
  write(path.join(base, 'run/run.json'), { schema: 'brand-artifact-run/v1', id: 'fixture', host, status: 'active' });
  write(path.join(host, 'package.json'), { dependencies: { vue: '3' } });
  write(path.join(host, 'src/app.config.ts'), "export default { pages: ['pages/home/index'] };");
  const source = write(path.join(host, 'src/pages/home/index.vue'), '<template><view><text>Search collection</text><input placeholder="Search" /></view></template>');
  // Synthetic bytes test provenance plumbing only; these are never visual QA evidence.
  const raster = n => Buffer.concat([browserRaster?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'):Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(11000, n)]);
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

const completePrompt = prompt => `${prompt}\n<shared-design-brief>Host: search collection; navigation: home; action: Search; no captured records, show loading state. Viewport 1280x800. Brand rules: use bound typography and control shapes. Runtime state not observed.</shared-design-brief>`;
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
for(const count of [1,2]) test(`terminal partial batch with ${count} images records exact independent findings without completing the trio`,t=>{
  const f=fixture(t);
  f.write(path.join(f.dir,'dangoui-adapter.json'),{schema:'synthetic-adapter-for-selection-only'});
  prepareImageConcepts(f);
  const refusal=id=>f.write(path.join(f.dir,'image-concepts',`${id}-failure.json`),{schema:'brand-image-generation-failure/v1',direction:id,tool:'image_gen',code:'moderation_blocked',reason:'Synthetic refusal, unchanged'});
  const failures=[refusal('a')];
  const report=path.join(f.dir,'partial-review.json');
  assert.equal(imageConceptDelivery(f).reviewRequest,undefined);
  assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/All directions must be terminal/);
  f.checkpoint('b');
  assert.equal(imageConceptDelivery(f).reviewRequest,undefined);
  assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/All directions must be terminal/);
  if(count===1)failures.push(refusal('c'));else f.checkpoint('c');
  const ready=imageConceptDelivery(f),images=ready.reviewRequest.images;
  assert.equal(ready.status,'review-ready');assert.equal(ready.userGoalCompleted,false);
  assert.deepEqual(images.map(d=>d.id),count===1?['b']:['b','c']);
  assert.equal(ready.reviewRequest.generationFailures.length,3-count);
  const originals=[...failures,...images.map(d=>d.path),f.source],hashes=originals.map(sha);
  const compact=compactImageConceptResult(ready);
  assert.equal(compact.reviewDispatch.role,'independent-image-review');
  assert.deepEqual(JSON.parse(fs.readFileSync(compact.reviewRequestFile.path)).images,images);
  const findings=images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:false}));
  const fail={reviewer:'independent-partial',verdict:'fail',notes:'Synthetic fixture: missing core task; isolated correction required',directions:findings};
  for(const directions of [findings.slice(1),[...findings,{...findings[0],id:'a'}],[...findings.slice(1),{...findings[0],sha256:'0'.repeat(64)}]]) {
    f.write(report,{...fail,directions});assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/exactly the successful/);
  }
  f.write(report,{...fail,reviewer:'fixture-producer'});assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/Independent failure/);
  f.write(report,fail);const blocked=recordImageConcepts({...f,reviewFile:report});
  assert.equal(blocked.status,'blocked');assert.equal(blocked.previewStatus,'failed');assert.equal(blocked.userGoalCompleted,false);
  assert.equal(blocked.generationFailures.length,3-count);assert.equal(blocked.reviewRequest,undefined);
  assert.equal(blocked.failedReview.directions[0].hostTaskPreserved,false);
  const failedFile=path.join(f.dir,'image-concepts-failed-review.json'),failedHash=sha(failedFile);
  f.write(report,{...fail,notes:'changed fail'});assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/immutable/);
  const selected=selectImageCode({...f,direction:'b',selection:'Explicit synthetic selection for isolated correction only',confirmed:true});
  t.after(()=>fs.rmSync(path.dirname(selected.artifactRoot),{recursive:true,force:true}));
  const selectedState=JSON.parse(fs.readFileSync(path.join(selected.artifactRoot,'selected-image-code.json')));
  assert.equal(selectedState.parentImageReview,'failed-preserved');assert.equal(selectedState.conceptReviewNotes[0].verdict,'fail');
  assert.equal(selected.hostImplementationComplete,false);
  const pass={...fail,verdict:'pass',distinctCompositions:true,supersedesFailedReview:{path:failedFile,sha256:failedHash},reassessmentReason:'Synthetic reassessment fixture only'};
  f.write(report,pass);assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/bind and approve/);
  const approved={...pass,directions:findings.map(d=>({...d,hostTaskPreserved:true}))};
  f.write(report,{...approved,supersedesFailedReview:undefined});assert.throws(()=>recordImageConcepts({...f,reviewFile:report}),/explicit failed-review binding/);
  f.write(report,approved);const done=recordImageConcepts({...f,reviewFile:report});
  assert.equal(done.status,'awaiting-user-choice');assert.equal(done.previewStatus,'partial-approved');assert.equal(done.userGoalCompleted,false);
  assert.equal(done.reviewRequest,undefined);assert.equal(done.generationFailures.length,3-count);
  assert.equal(sha(failedFile),failedHash);assert.deepEqual(originals.map(sha),hashes);
  fs.appendFileSync(images[0].path,'changed');assert.throws(()=>imageConceptDelivery(f),/hash mismatch/);
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
  let html=await(await fetch(url)).text();assert.match(html,/data-review-status="partial-blocked"/);assert.match(html,/3000/);
  const refreshScript=html.match(/<script>(.*?)<\/script>/s)[1];
  let callback,visibilityCallback,reloads=0,delay;
  const document={visibilityState:'hidden',addEventListener:(event,fn,options)=>{assert.equal(event,'visibilitychange');assert.deepEqual({...options},{once:true});visibilityCallback=fn;}};
  vm.runInNewContext(refreshScript,{document,location:{reload:()=>reloads++},setTimeout:(fn,ms)=>{callback=fn;delay=ms;}});
  assert.equal(delay,3000);callback();assert.equal(reloads,0);
  document.visibilityState='visible';visibilityCallback();assert.equal(reloads,1);
  const afterB=f.checkpoint('b');assert.deepEqual(afterB.dispatchRequest.directions.map(d=>d.id),['c']);assert.equal(afterB.images.length,1);
  html=await(await fetch(url)).text();assert.match(html,/3000/);assert.match(html,/已保存 1\/3 张/);
  const done=f.checkpoint('c');assert.equal(done.dispatchRequest,undefined);assert.deepEqual(done.reviewRequest.images.map(d=>d.id),['b','c']);assert.equal(done.status,'review-ready');assert.equal(done.userGoalCompleted,false);
  assert.deepEqual(done.directionStates.map(d=>d.status),['blocked','saved','saved']);assert.equal(sha(failed),failureHash);
  html=await(await fetch(url)).text();assert.match(html,/setTimeout/);assert.match(html,/已有图待独立审核/);assert.equal((html.match(/<img /g)||[]).length,2);
  assert.match(html,/<section data-direction="a" data-generation-status="blocked">/);
  assert.match(html,/<code>moderation_blocked<\/code>/);
  assert.match(html,/Synthetic refusal/);
  assert.match(html,/仅供预览，暂不引导选图落地/);
  assert.match(html,/本轮暂无可选图/);
  assert.doesNotMatch(html,/本轮可选 B\/C|可选择已有图|说“选本轮/);
  assert.doesNotMatch(html,/选历史图/);
  assert.equal((html.match(/<section/g)||[]).length,3);
  f.write(path.join(f.dir,'image-concepts-observations.json'),{schema:'brand-image-observations/v1',directions:[
    {id:'b',sha256:done.images.find(d=>d.id==='b').sha256,notes:['bound-observation']},
    {id:'c',sha256:'0'.repeat(64),notes:['stale-observation']}
  ]});
  html=await(await fetch(url)).text();
  assert.match(html,/非审核通过.*bound-observation/);assert.doesNotMatch(html,/stale-observation/);
  assert.match(html,/本轮暂无可选图/);
  const reviewFile=f.write(path.join(f.dir,'partial-gallery-review.json'),{reviewer:'gallery-independent',verdict:'fail',notes:'Synthetic missing business task',directions:done.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:false}))});
  recordImageConcepts({...f,reviewFile});
  html=await(await fetch(url)).text();assert.match(html,/data-review-status="failed"/);assert.doesNotMatch(html,/setTimeout/);
  assert.match(html,/须修复业务问题/);assert.match(html,/moderation_blocked/);assert.match(html,/Synthetic missing business task/);
  assert.match(html,/本轮可选 B\/C/); // Explicit choice may enter correction, not a QA pass.
  const failedReview=path.join(f.dir,'image-concepts-failed-review.json');
  f.write(reviewFile,{reviewer:'gallery-reassessment',verdict:'pass',notes:'Synthetic reassessment only',distinctCompositions:true,supersedesFailedReview:{path:failedReview,sha256:sha(failedReview)},reassessmentReason:'Synthetic fixture',directions:done.reviewRequest.images.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:true}))});
  recordImageConcepts({...f,reviewFile});
  html=await(await fetch(url)).text();assert.match(html,/data-review-status="partial-approved"/);assert.match(html,/三图目标未完成/);
  assert.doesNotMatch(html,/setTimeout/);assert.match(html,/moderation_blocked/);assert.equal((html.match(/<img /g)||[]).length,2);
});

test('new receipt cannot bypass actual checkpoints on an old dispatch',t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');const ready=f.checkpoint('c');
  const dirs=['a','b','c'].map(id=>JSON.parse(fs.readFileSync(path.join(f.dir,'image-concepts',`${id}-generation.json`))));
  const receipt={producer:'fixture-producer',directions:dirs.map(d=>({...d,prompt:d.prompt+' not actually sent'})),independentReview:{...ready.reviewRequest.reviewShape,reviewer:'independent',verdict:'pass',distinctCompositions:true,notes:'Synthetic',directions:ready.reviewRequest.reviewShape.directions.map(d=>({...d,completeScreen:true,brandFaithful:true,hostTaskPreserved:true}))}};
  const receiptFile=f.write(path.join(f.dir,'forged-receipt.json'),receipt);
  assert.throws(()=>recordImageConcepts({...f,receiptFile}),/Receipt must match verified/);
});

test('identical whitespace recovery preserves failure evidence and selection rejects replaced evidence',t=>{
  const f=fixture(t);
  f.write(path.join(f.dir,'dangoui-adapter.json'),{tokenMappings:[]});
  const dispatch=prepareImageConcepts(f).dispatchRequest;
  const args={prompt:dispatch.directions[0].prompt,referenced_image_paths:f.refs};
  const planned=f.write(path.join(f.dir,'planned.json'),args);
  const outputFile=f.write(path.join(f.dir,'original.png'),fs.readFileSync(f.refs[0]));
  const callId='whitespace-original',source=frozenImageCall(planned,sha(planned),'unused-fixture-worker')+'\n';
  const event={type:'response_item',payload:{type:'custom_tool_call',name:'exec',call_id:callId,input:source}};
  const callLog=f.write(path.join(runtimeHome,'sessions',crypto.randomUUID()+'.jsonl'),[
    event,{type:'response_item',payload:{type:'custom_tool_call_output',call_id:callId,output:[{image_url:'data:image/png;base64,'+fs.readFileSync(outputFile).toString('base64')}]}}
  ].map(JSON.stringify).join('\n')+'\n');
  const receipt=path.join(f.dir,'image-concepts/a-unverified-preview.json');
  f.write(receipt,{id:'a',producer:'fixture',output:{path:outputFile,sha256:sha(outputFile)},provenance:{logPath:callLog,callId,eventSha256:crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex')},rawCall:source,argumentError:'Historical whitespace rejection',argumentsStatus:'unverified'});
  const original=fs.readFileSync(receipt);
  const result=checkpointActual({...f,id:'a',producer:'fixture',outputFile,callLog,callId});
  assert.equal(result.images[0].sha256,sha(outputFile));assert(fs.readFileSync(receipt).equals(original));
  const selected=selectImageCode({...f,direction:'a',selection:'Select A, isolated single-page correction',confirmed:true});
  t.after(()=>fs.rmSync(path.dirname(selected.artifactRoot),{recursive:true,force:true}));
  assert.equal(selected.dispatchRequest.selectedImage.sha256,sha(outputFile));
  const generation=path.join(f.dir,'image-concepts/a-generation.json'),saved=JSON.parse(fs.readFileSync(generation));
  for(const field of ['callId','eventSha256']) {
    f.write(generation,{...saved,provenance:{...saved.provenance,[field]:'replaced'}});
    assert.throws(()=>selectImageCode({...f,direction:'a',selection:'Select A',confirmed:true}),/Recovered preview differs/);
  }
  f.write(generation,saved);assert(fs.readFileSync(receipt).equals(original));
  assert.throws(()=>checkpointActual({...f,id:'a',producer:'fixture',outputFile,callLog,callId:'replacement'}),/uniquely/);
});
