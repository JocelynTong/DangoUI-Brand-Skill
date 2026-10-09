import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { installNativeSourceInput, readNativeSourceInput } from './native-source-input.mjs';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-source-test-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const inputDir = path.join(root,'input'); fs.mkdirSync(inputDir);
  const bytes = Buffer.from([255,216,255,0]);
  fs.writeFileSync(path.join(inputDir,'full.jpg'),bytes);
  fs.writeFileSync(path.join(inputDir,'observation.json'),'{}');
  const input = {schema:'brand-native-source-input/v1',brand:'example',sourceUrl:'https://example.com/products',status:'raw-unreviewed',collector:'test-fixture',capturedAt:new Date().toISOString(),limitations:['Synthetic test fixture, not visual evidence'],files:[{path:'full.jpg',sha256:sha(bytes),role:'full-page-screenshot'},{path:'observation.json',sha256:sha('{}'),role:'browser-observation'}]};
  const file=path.join(inputDir,'input.json');
  const save=()=>fs.writeFileSync(file,JSON.stringify(input));save();
  return {root,file,input,save,options:{root:path.join(root,'build'),file,brand:input.brand,sourceUrl:input.sourceUrl}};
}
test('native input preserves raw limitations, bytes and all hashes; refuses overwrite and tampering',t=>{
  const f=fixture(t),r=installNativeSourceInput(f.options);
  assert.equal(r.bindings.length,3);assert.deepEqual(r.limitations,f.input.limitations);
  assert.equal(fs.readFileSync(path.join(f.options.root,r.bindings[0].path),'utf8'),fs.readFileSync(f.file,'utf8'));
  assert.throws(()=>installNativeSourceInput(f.options),/ALREADY_FROZEN/);
  fs.appendFileSync(path.join(f.options.root,r.sourceScreenshot),'changed');
  assert.throws(()=>readNativeSourceInput(f.options),/HASH_MISMATCH/);
});
test('invalid source, traversal, missing files and hash mismatch cannot import',t=>{
  for(const mutate of [x=>x.sourceUrl+='wrong',x=>x.files[0].path='../full.jpg',x=>x.files.push({...x.files[0],path:'./full.jpg'}),x=>x.files.pop(),x=>x.files[0].sha256='0'.repeat(64),x=>x.status='PASS']){
    const f=fixture(t);mutate(f.input);f.save();assert.throws(()=>installNativeSourceInput(f.options));assert.equal(fs.existsSync(f.options.root),false);
  }
});
test('viewport policy requires a real viewport input and selects it instead of the overview', t => {
  const f = fixture(t);
  f.input.visualAuthority = 'viewport-sequence/v1'; f.save();
  assert.throws(() => installNativeSourceInput(f.options), /VIEWPORT_REQUIRED/);
  fs.copyFileSync(path.join(path.dirname(f.file), 'full.jpg'), path.join(path.dirname(f.file), 'viewport.jpg'));
  f.input.files.push({ ...f.input.files[0], path: 'viewport.jpg', role: 'viewport-screenshot' }); f.save();
  const r = installNativeSourceInput(f.options);
  assert.equal(r.visualAuthority, 'viewport-sequence/v1');
  assert.ok(r.sourceScreenshot.endsWith('viewport.jpg'));
});
test('interaction policy rejects unknown proof, duplicate IDs and absent viewport authority before writes', t => {
  for (const mutate of [x => { delete x.visualAuthority; }, x => { x.interactionEvidence.required[0].proof = 'skip'; }, x => { x.interactionEvidence.required.push({...x.interactionEvidence.required[0]}); }, x => { x.interactionEvidence.scopeReason = ''; }]) {
    const f = fixture(t);
    f.input.visualAuthority = 'viewport-sequence/v1';
    f.input.interactionEvidence = {schema:'interaction-evidence/v1',scopeReason:'Static switch',required:[{id:'switch',proof:'states',reason:'Preserve state changes'}]};
    mutate(f.input); f.save();
    assert.throws(() => installNativeSourceInput(f.options), /INTERACTION_POLICY_INVALID/);
    assert.equal(fs.existsSync(f.options.root), false);
  }
});
for (const viewportPolicy of [false, true]) test(`public continue dispatches Evidence without host completion (viewport policy=${viewportPolicy})`,t=>{
  const f=fixture(t);fs.mkdirSync(f.options.root);const host=path.join(f.root,'host');fs.mkdirSync(host);
  if (viewportPolicy) {
    fs.copyFileSync(path.join(path.dirname(f.file), 'full.jpg'), path.join(path.dirname(f.file), 'viewport.jpg'));
    f.input.visualAuthority = 'viewport-sequence/v1';
    f.input.interactionEvidence = { schema: 'interaction-evidence/v1', scopeReason: 'Static catalog only; preserve host interactions.', required: [] };
    f.input.files.push({ ...f.input.files[0], path: 'viewport.jpg', role: 'viewport-screenshot' }); f.save();
  }
  fs.writeFileSync(path.join(f.root,'run.json'),JSON.stringify({schema:'brand-artifact-run/v1',id:'native-input-test',host,status:'active'}));
  fs.writeFileSync(path.join(f.options.root,'source-prerequisite.json'),JSON.stringify({schema:'brand-source-prerequisite/v1',parentRequestKind:'host-concepts',artifactRoot:f.options.root,hostTarget:host,brand:f.input.brand,sourceUrl:f.input.sourceUrl,requestedProfile:'fast'}));
  const entry=path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
  const r=spawnSync(process.execPath,[entry,'continue','--artifact-root',f.options.root,'--browser-capture',f.file],{encoding:'utf8'});
  assert.equal(r.status,0,r.stdout+r.stderr);const out=JSON.parse(r.stdout);
  assert.equal(out.status,'dispatch-ready');assert.equal(out.fullWorkflowPass,false);assert.equal(out.hostFilesModified,false);
  const dispatch=out.dispatch.dispatchRequest;
  assert.equal(dispatch.role,'brandResearcher');assert.equal(dispatch.requiredInputs.length,viewportPolicy ? 5 : 4);
  assert.ok(dispatch.requiredInputs.some(x=>x.path.endsWith('observation.json')));
  const goal=fs.readFileSync(path.join(f.options.root,'migrations/example/goal-contract.json'));
  if (viewportPolicy) {
    assert.equal(JSON.parse(goal).evidencePolicy.visualAuthority, 'viewport-sequence/v1');
    assert.equal(JSON.parse(goal).evidencePolicy.fullPageRole, 'overview-only');
    assert.deepEqual(JSON.parse(goal).evidencePolicy.interactionEvidence, f.input.interactionEvidence);
    assert.deepEqual(JSON.parse(goal).evidencePolicy.requiredInteractionIds, []);
    assert.ok(JSON.parse(goal).referencePages[0].screenshot.endsWith('viewport.jpg'));
  } else assert.equal(JSON.parse(goal).evidencePolicy.visualAuthority, undefined);
  const repeat=spawnSync(process.execPath,[entry,'continue','--artifact-root',f.options.root,'--browser-capture',f.file],{encoding:'utf8'});
  assert.equal(repeat.status,1);assert.equal(JSON.parse(repeat.stdout).blockingCode,'NATIVE_SOURCE_GOAL_ALREADY_FROZEN');
  assert.deepEqual(fs.readFileSync(path.join(f.options.root,'migrations/example/goal-contract.json')),goal);
});
