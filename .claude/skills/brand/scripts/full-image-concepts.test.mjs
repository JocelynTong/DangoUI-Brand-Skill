import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { imageConceptDelivery, prepareImageConcepts, regenerateImageConcepts, recordImageConcept, recordImageConcepts } from './full-image-concepts.mjs';

const entry = path.resolve('skills/brand/scripts/run-brand-workflow.mjs');

test('generation failure preserves images and full-image goal without automatic medium fallback',t=>{
  const f=fixture(t);prepareImageConcepts(f);const a=f.checkpoint('a');
  const file=f.write(path.join(f.dir,'image-concepts','b-failure.json'),{schema:'brand-image-generation-failure/v1',direction:'b',tool:'image_gen',code:'moderation_blocked',reason:'Synthetic tool refusal; cause unspecified'});
  const failureHash=sha(file),saved=a.completedImages[0];
  const result=imageConceptDelivery(f);
  assert.equal(result.status,'blocked');assert.equal(result.userGoalCompleted,false);
  assert.equal(result.failureGuidance.requestedMedium,'full-image');
  assert.equal(result.failureGuidance.defaultMediumFallback,null);
  assert.equal(result.failureGuidance.automaticRetry,false);
  assert.equal(result.failureGuidance.completedCount,1);assert.equal(result.failureGuidance.requiredCount,3);
  assert.deepEqual(result.completedImages,[saved]);assert.equal(sha(file),failureHash);
  assert.equal(result.dispatchRequest,undefined);assert.equal(result.reviewRequest,undefined);
  assert.equal(fs.existsSync(path.join(f.dir,'h5-directions')),false);
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
  const inputFile=f.write(path.join(opts.root,'args.json'),{prompt:d.prompt,referenced_image_paths:d.referenced_image_paths});
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
  const opts = { root, brand, hostTarget: host };
  const checkpoint = id => {
    const dispatch = imageConceptDelivery(opts).dispatchRequest;
    const inputFile = write(path.join(dir, `args-${id}.json`), { prompt: dispatch.directions.find(d => d.id === id).prompt, referenced_image_paths: refs });
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
  assert.deepEqual(output.dispatchRequest.directions.map(d => d.id), ['a', 'b', 'c']);
  assert.equal(output.userGoalCompleted, false);
  assert.equal(fs.existsSync(path.join(f.dir, 'execution-manifest.json')), false);
  assert.equal(sha(f.source), before);
  const resumed = spawnSync(process.execPath, [entry, 'continue', '--artifact-root', f.root, '--brand', f.brand], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr);
  assert.deepEqual(JSON.parse(resumed.stdout).dispatchRequest.directions.map(d => d.id), ['a', 'b', 'c']);
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

test('standard gallery exposes pending and failed honestly, then approved at same URL; incomplete/corrupt remain blocked', async t=>{
  const f=fixture(t);prepareImageConcepts(f);f.checkpoint('a');f.checkpoint('b');
  const server=spawn(process.execPath,[path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'),'--root',f.root,'--port','0']);t.after(()=>server.kill());
  const base=await new Promise((resolve,reject)=>{let text='';server.stdout.on('data',b=>{text+=b;const m=text.match(/http:\/\/[^\s]+/);if(m)resolve(m[0]);});server.on('error',reject);});
  const url=new URL('/__brand_comparison__?brand='+f.brand,base);
  assert.equal((await fetch(url)).status,409);
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
  const inputFile=f.write(path.join(next.artifactRoot,'args.json'),{prompt:args.prompt,referenced_image_paths:args.referenced_image_paths});
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
