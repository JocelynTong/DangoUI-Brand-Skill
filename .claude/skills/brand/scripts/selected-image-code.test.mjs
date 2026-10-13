import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {selectImageCode, selectedCodeStatus, compileSelectedTheme, recordSelectedCode, recordSelectedCodeReview} from './selected-image-code.mjs';

const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const binding = p => ({path:p,sha256:hash(p)});
function fixture(t) {
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'selected-code-test-'))), root=path.join(dir,'input'), host=path.join(dir,'original');
  const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v));return p;};
  const json=(p,v)=>write(p,JSON.stringify(v));
  write(path.join(host,'package.json'),{dependencies:{react:'19.0.0'}});
  write(path.join(host,'src/App.jsx'),'export default function App(){return null;}');
  for(const p of ['.env','.env.local','.git/config','node_modules/test/index.js'])write(path.join(host,p),'private');
  fs.symlinkSync(path.join(host,'.env'),path.join(host,'symlink-secret'));
  const brand=path.join(root,'migrations/dango');
  const mod=write(path.join(brand,'brand-mod.json'),{tokens:{dtcg:{accent:{$type:'color',$value:'#7755ff'}}}});
  const adapter=write(path.join(brand,'dangoui-adapter.json'),{tokenMappings:[{sourceToken:'accent',sourceValue:'#7755ff',targetToken:'--du-primary',mappingType:'mapped',targetExists:true}]});
  const dangouiRoot=path.join(dir,'synthetic-dangoui');
  write(path.join(dangouiRoot,'package.json'),{name:'dangoui',version:'0.0.0-test',exports:{'./theme.css':'./theme.css','./style.css':'./style.css'}});
  write(path.join(dangouiRoot,'theme.css'),':root{--du-primary:#000000}');write(path.join(dangouiRoot,'style.css'),'.du-button{color:var(--du-primary)}');
  const image=write(path.join(brand,'image-concepts/a.png'),'fake-image-test-bytes');
  const args=write(path.join(brand,'image-concepts/a-input.json'),{});
  const dispatch=write(path.join(brand,'dispatch.json'),{inputs:[binding(mod),binding(adapter)],inputImages:[]});
  json(path.join(brand,'image-concepts.json'),{dispatch:binding(dispatch),hostTarget:host});
  json(path.join(brand,'image-concepts/a-generation.json'),{output:binding(image),arguments:binding(args)});
  const runs=[];
  t.after(()=>{fs.rmSync(dir,{recursive:true,force:true});for(const run of runs)fs.rmSync(path.dirname(run),{recursive:true,force:true});});
  function select(extra={}){const s=selectImageCode({root,brand:'dango',direction:'a',selection:'用户选择 A，仅隔离预览',confirmed:true,...extra});runs.push(s.artifactRoot);return s;}
  function submission(s){compileSelectedTheme({root:s.artifactRoot,dangouiRoot});const preview=write(path.join(s.artifactRoot,'compare.html'),'<html>runtime comparison</html>');const p=write(path.join(dir,'submission.json'),{producer:'implementer',previewUrl:'http://127.0.0.1:12345/',comparisonFile:preview,outputs:['host/src/App.jsx'],reused:[],adapted:['React view'],limitations:[]});return recordSelectedCode({root:s.artifactRoot,submissionFile:p});}
  function review(s,extra={}){const evidence=write(path.join(s.artifactRoot,'runtime-evidence.txt'),'test fixture, not an actual runtime proof');return write(path.join(dir,'review.json'),{reviewer:'independent-qa',verdict:'pass',submission:binding(path.join(s.artifactRoot,'implementation.json')),checks:{visual:true,business:true,tokenRuntime:true,responsive:true},observations:['fixture observation'],evidence:[binding(evidence)],limitations:[],...extra});}
  return {dir,root,host,brand,mod,image,dangouiRoot,write,json,select,submission,review};
}

test('selection requires explicit authorization and exact image hash',t=>{
  const f=fixture(t);assert.throws(()=>f.select({confirmed:false}),/authorization/);
  assert.throws(()=>f.select({selection:''}),/authorization/);
  fs.appendFileSync(f.image,'changed');assert.throws(()=>f.select(),/Changed input/);
});
test('React Web Button asset is frozen unchanged and handed to implementation and QA',t=>{
  const f=fixture(t),s=f.select(),asset=s.dispatchRequest.reusableComponents[0];
  assert.equal(asset.sourceVersion,'dangoui 3.6.16');
  assert.equal(asset.component.sha256,hash(new URL('../assets/react-web-button/DangoButton.tsx',import.meta.url)));
  for(const b of [asset.component,asset.usage]) {
    assert.ok(b.path.startsWith(s.artifactRoot+path.sep));
    assert.ok(!b.path.startsWith(s.hostRoot+path.sep));
    assert.equal(b.sha256,hash(b.path));
    assert.ok(s.dispatchRequest.inputs.some(i=>i.path===b.path&&i.sha256===b.sha256));
  }
  assert.deepEqual(f.submission(s).reviewRequest.reusableComponents,[asset]);
  fs.appendFileSync(asset.component.path,'changed');
  assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
});
test('Web Button candidate is not offered to Taro, Vue, React Native or unknown hosts',t=>{
  const f=fixture(t);
  for(const dependencies of [{react:'19','@tarojs/taro':'4'},{vue:'3'},{react:'19','react-native':'0.80'},{}]) {
    f.write(path.join(f.host,'package.json'),{dependencies});
    const s=f.select();
    assert.deepEqual(s.dispatchRequest.reusableComponents,[]);
    assert.equal(fs.existsSync(path.join(s.artifactRoot,'reusable-components')),false);
  }
});
test('snapshot isolates actual host, omits secrets and symlinks, continuation is stable',t=>{
  const f=fixture(t),s=f.select();
  assert.notEqual(s.hostRoot,f.host);assert.equal(fs.readFileSync(path.join(s.hostRoot,'src/App.jsx'),'utf8'),fs.readFileSync(path.join(f.host,'src/App.jsx'),'utf8'));
  for(const p of ['.env','.env.local','.git','node_modules','symlink-secret'])assert.equal(fs.existsSync(path.join(s.hostRoot,p)),false,p);
  assert.deepEqual(s.dispatchRequest.skippedSymlinks,['symlink-secret']);
  assert.deepEqual(selectedCodeStatus(s.artifactRoot),s);
  assert.equal(s.fullWorkflowPass,false);assert.equal(s.status,'implementation-dispatch-ready');
});
test('file hostTarget resolves the actual project through frozen startup context',t=>{
  const f=fixture(t),dispatchFile=path.join(f.brand,'dispatch.json');
  const dispatch=JSON.parse(fs.readFileSync(dispatchFile,'utf8'));
  const startup=f.json(path.join(f.brand,'host-startup-page.json'),{hostRoot:f.host});
  dispatch.inputs.push(binding(startup));f.json(dispatchFile,dispatch);
  f.json(path.join(f.brand,'image-concepts.json'),{dispatch:binding(dispatchFile),hostTarget:path.join(f.host,'src/App.jsx')});
  const s=f.select();assert.equal(s.dispatchRequest.originalHostReadOnly,f.host);
  assert.ok(fs.existsSync(path.join(s.hostRoot,'package.json')));
  assert.ok(fs.existsSync(path.join(s.hostRoot,'src/App.jsx')));
});
test('host credential containers and package-manager auth configs are never read or copied',t=>{
  const f=fixture(t);
  const secrets=['.npmrc','.yarnrc.yml','.yarnrc','.pnpmrc','.netrc','_netrc','.pypirc','.aws/credentials','.ssh/id_ed25519','.azure/token.json','.gcloud/credentials.json','.kube/config','.docker/config.json','packages/nested/.npmrc','packages/nested/.aws/credentials'];
  for(const rel of secrets) {
    const p=f.write(path.join(f.host,rel),'SYNTHETIC_TEST_SECRET_DO_NOT_COPY');
    fs.chmodSync(p,0o000);
    t.after(()=>{if(fs.existsSync(p))fs.chmodSync(p,0o600);});
  }
  f.write(path.join(f.host,'package-lock.json'),{lockfileVersion:3});
  const s=f.select(),state=JSON.parse(fs.readFileSync(path.join(s.artifactRoot,'selected-image-code.json'),'utf8'));
  for(const rel of secrets) {
    assert.equal(fs.existsSync(path.join(s.hostRoot,rel)),false,rel);
    assert.equal(state.baseline.files.some(f=>f.path===rel),false,rel);
  }
  assert.equal(fs.existsSync(path.join(s.hostRoot,'package-lock.json')),true);
  assert.equal(selectedCodeStatus(s.artifactRoot).status,'implementation-dispatch-ready');
});
test('compiler rejects symlink output directory escaping isolated run',t=>{
  const f=fixture(t),s=f.select(),outside=path.join(f.dir,'outside-theme');fs.mkdirSync(outside);
  fs.symlinkSync(outside,path.join(s.hostRoot,'src/brand'));
  assert.throws(()=>compileSelectedTheme({root:s.artifactRoot,dangouiRoot:f.dangouiRoot}),/Theme output escapes/);
  assert.deepEqual(fs.readdirSync(outside),[]);
});
test('single theme entry cannot write through an output symlink',t=>{
  const f=fixture(t),s=f.select(),outside=f.write(path.join(f.dir,'outside-entry.css'),'untouched');
  fs.mkdirSync(path.join(s.hostRoot,'src/brand'));
  fs.symlinkSync(outside,path.join(s.hostRoot,'src/brand/brand-entry.css'));
  assert.throws(()=>compileSelectedTheme({root:s.artifactRoot,dangouiRoot:f.dangouiRoot}),/cannot be a symlink/);
  assert.equal(fs.readFileSync(outside,'utf8'),'untouched');
  assert.equal(fs.existsSync(path.join(s.hostRoot,'src/brand/brand-theme.css')),false);
});
test('single theme entry is bound and checked before recording implementation',t=>{
  const f=fixture(t),s=f.select();
  const compiled=compileSelectedTheme({root:s.artifactRoot,dangouiRoot:f.dangouiRoot});
  assert.ok(compiled.bindings.some(b=>b.path===compiled.entryFile&&b.sha256===hash(compiled.entryFile)));
  assert.deepEqual(compiled.integration.mappedVariables,['--du-primary']);
  fs.appendFileSync(compiled.entryFile,'\n:root{--du-primary:red}');
  const comparisonFile=f.write(path.join(s.artifactRoot,'comparison.html'),'<html></html>');
  const submissionFile=f.write(path.join(f.dir,'entry-submission.json'),{producer:'implementer',previewUrl:'http://localhost:12345/',comparisonFile,outputs:['host/src/App.jsx'],reused:[],adapted:[],limitations:[]});
  assert.throws(()=>recordSelectedCode({root:s.artifactRoot,submissionFile}),/Changed input\/output/);
  assert.equal(fs.existsSync(path.join(s.artifactRoot,'implementation.json')),false);
});
test('original host modification and frozen input drift are rejected',t=>{
  const f=fixture(t),s=f.select();
  const source=path.join(f.host,'src/App.jsx'),original=fs.readFileSync(source);
  fs.appendFileSync(source,'changed');assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Original host changed/);fs.writeFileSync(source,original);
  fs.appendFileSync(s.dispatchRequest.modFile,' ');assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
});
test('review rejects producer self-approval and missing runtime checks; pass remains scoped',t=>{
  const f=fixture(t),s=f.select();assert.equal(f.submission(s).status,'review-ready');
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{reviewer:'implementer'})}),/Independent reviewer/);
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{checks:{visual:true}})}),/All scoped runtime/);
  const done=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)});
  assert.equal(done.status,'ready-for-user-review');assert.equal(done.fullWorkflowPass,false);assert.equal(done.hostImplementationComplete,false);
});
test('recorded host source and review evidence cannot silently mutate',t=>{
  const f=fixture(t),s=f.select();f.submission(s);fs.appendFileSync(path.join(s.hostRoot,'src/App.jsx'),'changed');
  assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
});
test('review dispatch describes evidence bindings and malformed evidence can be corrected without losing runtime',t=>{
  const f=fixture(t),s=f.select(),pending=f.submission(s);
  const example=pending.reviewRequest.reviewShape.evidence[0];
  assert.ok(path.isAbsolute(example.path));assert.ok(example.sha256);
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{evidence:['screenshot.png']})}),/Invalid evidence\[0\].*sha256/);
  assert.equal(selectedCodeStatus(s.artifactRoot).status,'review-ready');
  assert.equal(recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)}).status,'ready-for-user-review');
});
test('new source files after submission invalidate recorded source inventory',t=>{
  const f=fixture(t),s=f.select();f.submission(s);
  f.write(path.join(s.hostRoot,'src/new-page.jsx'),'export default()=>null;');
  assert.throws(()=>selectedCodeStatus(s.artifactRoot),/source|inventory|changed/i);
});
test('selected reference and selection statement stay frozen',t=>{
  const f=fixture(t),s=f.select();
  const selection=s.dispatchRequest.selection.path,original=fs.readFileSync(selection);
  fs.appendFileSync(selection,' ');assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);fs.writeFileSync(selection,original);
  fs.appendFileSync(s.dispatchRequest.selectedImage.path,'changed');assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
});
test('review evidence is frozen after independent verdict',t=>{
  const f=fixture(t),s=f.select();f.submission(s);recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)});
  fs.appendFileSync(path.join(s.artifactRoot,'runtime-evidence.txt'),'changed');assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
});
test('path escape in submission outputs is rejected even when target exists',t=>{
  const f=fixture(t),s=f.select();const outside=f.write(path.join(f.dir,'outside.txt'),'outside');
  const file=f.write(path.join(f.dir,'bad-submission.json'),{producer:'p',previewUrl:'http://localhost:1234/',comparisonFile:outside,outputs:['host/src/App.jsx'],reused:[],adapted:[],limitations:[]});
  assert.throws(()=>recordSelectedCode({root:s.artifactRoot,submissionFile:file}),/inside the isolated run/);
});
