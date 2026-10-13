import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { imageConceptDelivery, prepareImageConcepts, regenerateImageConcepts, recordImageConcept, recordImageConcepts } from './full-image-concepts.mjs';

const entry = path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
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
  assert.throws(()=>imageConceptDelivery(f),/bind and approve|same images/);
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
