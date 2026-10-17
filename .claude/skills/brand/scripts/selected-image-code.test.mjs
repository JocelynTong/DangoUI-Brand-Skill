import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {nativeNavigationGeometry} from '../assets/taro-native-navigation/safe-area.mjs';
import {selectImageCode, selectedCodeStatus, compileSelectedTheme, recordSelectedCode, recordSelectedCodeReview, reviseSelectedCode, prepareSelectedCodeComparison, compactSelectedCodeResult} from './selected-image-code.mjs';

const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const binding = p => ({path:p,sha256:hash(p)});
test('compact public handoff retains exact full input and rejects packet tampering',t=>{
 const f=fixture(t),s=f.select(),result=compactSelectedCodeResult(s);
 assert.equal(result.dispatchRequest,undefined);
 assert.deepEqual(JSON.parse(fs.readFileSync(result.specialistPacket.path)),s.dispatchRequest);
 assert.equal(hash(result.specialistPacket.path),result.specialistPacket.sha256);
 assert.deepEqual(compactSelectedCodeResult(s),result);
 fs.appendFileSync(result.specialistPacket.path,'changed');
 assert.throws(()=>compactSelectedCodeResult(s),/unsafe|Changed/);
});
test('compact public status delivers recorded review without creating a new revision',t=>{
 const f=fixture(t),s=f.select();f.submission(s);
 recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)});
 const before=hash(path.join(s.artifactRoot,'implementation-review.json'));
 const cli=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),'continue','--compact','--artifact-root',s.artifactRoot],{encoding:'utf8'});
 assert.equal(cli.status,0,cli.stdout+cli.stderr);
 const result=JSON.parse(cli.stdout);assert.equal(result.status,'ready-for-user-review');
 assert.equal(result.wholeHostAuthorized,false);assert.equal(result.specialistPacket,undefined);
 assert.equal(hash(path.join(s.artifactRoot,'implementation-review.json')),before);
 assert.equal(fs.existsSync(path.join(s.artifactRoot,'revisions')),false);
});
test('default public handoff stays compact through pending review and record returns delivery',t=>{
 const f=fixture(t),s=f.select();
 const cli=(action,...args)=>spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),action,'--artifact-root',s.artifactRoot,...args],{encoding:'utf8'});
 const pending=f.submission(s);
 const handoff=cli('continue');assert.equal(handoff.status,0,handoff.stdout+handoff.stderr);
 const result=JSON.parse(handoff.stdout);
 assert.equal(result.status,'review-ready');assert.equal(result.reviewRequest,undefined);
 assert.equal(hash(result.specialistPacket.path),result.specialistPacket.sha256);
 assert.deepEqual(JSON.parse(fs.readFileSync(result.specialistPacket.path)),pending.reviewRequest);
 const incomplete=f.review(s,{checks:{visual:true,business:null,tokenRuntime:true,responsive:true,singlePageScope:true}});
 const blocked=cli('record-selected-code-review','--review',incomplete);
 assert.notEqual(blocked.status,0);assert.equal(selectedCodeStatus(s.artifactRoot).status,'review-ready');
 const recorded=cli('record-selected-code-review','--review',f.review(s));
 assert.equal(recorded.status,0,recorded.stdout+recorded.stderr);
 const delivered=JSON.parse(recorded.stdout);
 assert.equal(delivered.status,'ready-for-user-review');assert.equal(delivered.specialistPacket,undefined);
 assert.equal(delivered.comparisonFile,path.join(s.artifactRoot,'compare.html'));
 assert.equal(delivered.wholeHostAuthorized,false);assert.equal(delivered.userSinglePageConfirmed,false);
 assert.equal(fs.existsSync(path.join(s.artifactRoot,'revisions')),false);
 fs.appendFileSync(s.dispatchRequest.selectedImage.path,'tampered');
 assert.notEqual(cli('continue').status,0);
});
test('native safe area uses measured px and rejects synthetic/missing metrics',()=>{
  assert.deepEqual(nativeNavigationGeometry({windowWidth:390,statusBarHeight:47,capsule:{top:51,bottom:83,left:293,right:380}}),{statusBarHeight:47,safeTop:87,navigationHeight:40,capsuleLeft:293,rightInset:105});
  assert.throws(()=>nativeNavigationGeometry({windowWidth:390,statusBarHeight:47}),/capsule/);
  assert.throws(()=>nativeNavigationGeometry({windowWidth:390,statusBarHeight:47,capsule:{top:40,bottom:83,left:293,right:400}}),/capsule/);
  assert.throws(()=>nativeNavigationGeometry({windowWidth:390}),/Measured/);
});
test('Taro selection freezes native helper for implementation and QA without changing art',t=>{
  const f=fixture(t);f.write(path.join(f.host,'package.json'),{dependencies:{'@tarojs/taro':'4',vue:'3'}});
  const before=hash(f.image),s=f.select(),native=s.dispatchRequest.nativeRuntime;
  assert.equal(native.platform,'taro-native');
  for(const b of [native.helper,native.usage]) {
    assert.equal(b.sha256,hash(b.path));assert.ok(s.dispatchRequest.inputs.some(i=>i.path===b.path&&i.sha256===b.sha256));
  }
  assert.equal(hash(f.image),before);assert.equal(s.dispatchRequest.selectedImage.sha256,before);
  const pending=f.submission(s);assert.deepEqual(pending.reviewRequest.nativeRuntime,native);
  assert.equal(pending.reviewRequest.reviewShape.checks.nativeRuntime,null);
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)}),/nativeRuntime/);
  assert.equal(recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{checks:{visual:true,business:true,tokenRuntime:true,responsive:true,singlePageScope:true,nativeRuntime:true}})}).status,'ready-for-user-review');
  fs.appendFileSync(native.helper.path,'\n// drift');assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
});
test('non-Taro selection does not dispatch native assets',t=>{
  const f=fixture(t);
  for(const dependencies of [{react:'19'},{vue:'3'},{react:'19','react-native':'0.80'},{}]) {
    f.write(path.join(f.host,'package.json'),{dependencies});const s=f.select();
    assert.equal(s.dispatchRequest.nativeRuntime,undefined);
    assert.equal(fs.existsSync(path.join(s.artifactRoot,'native-runtime')),false);
    assert.equal(f.submission(s).reviewRequest.nativeRuntime,undefined);
  }
});
test('Taro compilation scopes roots before hashing and preserves all token declarations',t=>{
  const f=fixture(t);
  f.write(path.join(f.dangouiRoot,'theme.css'),':root {--du-primary:#000000}\n/* :root is a comment */\n:root[data-theme="dark"]{--du-primary:#ffffff}');
  f.write(path.join(f.dangouiRoot,'style.css'),'.du-button::before{content:":root";color:var(--du-primary)}');
  const web=f.select(),webTheme=compileSelectedTheme({root:web.artifactRoot,dangouiRoot:f.dangouiRoot});
  f.write(path.join(f.host,'package.json'),{dependencies:{'@tarojs/taro':'4'}});
  const native=f.select(),theme=compileSelectedTheme({root:native.artifactRoot,dangouiRoot:f.dangouiRoot});
  assert.equal(theme.integration.rootSelector,'.selected-brand-page');
  assert.equal(webTheme.integration.rootSelector,undefined);
  assert.equal(fs.readFileSync(theme.themeFile,'utf8').replaceAll('.selected-brand-page',':root'),fs.readFileSync(webTheme.themeFile,'utf8'));
  const css=fs.readFileSync(theme.runtimeStyleFile,'utf8');
  assert.match(css,/\.selected-brand-page\[data-theme="dark"\]/);assert.match(css,/content:":root"/);assert.match(css,/\/\* :root is a comment \*\//);
  for(const b of theme.bindings)assert.equal(hash(b.path),b.sha256);
  const proof=JSON.parse(fs.readFileSync(theme.proofFile));assert.equal(proof.outputs.theme.sha256,hash(theme.themeFile));assert.equal(proof.outputs.runtimeStyle.sha256,hash(theme.runtimeStyleFile));
  assert.equal(f.submission(native).status,'review-ready');
});
test('native root alias groups do not leak variables to page or theme aliases',t=>{
  const f=fixture(t);f.write(path.join(f.host,'package.json'),{dependencies:{'@tarojs/taro':'4'}});
  f.write(path.join(f.dangouiRoot,'theme.css'),':root,page,.du-theme-qd,.g-theme-qd,.du-theme-basic,.g-theme-basic{--du-primary:#123456}');
  const s=f.select(),theme=compileSelectedTheme({root:s.artifactRoot,dangouiRoot:f.dangouiRoot});
  const css=fs.readFileSync(theme.runtimeStyleFile,'utf8');
  assert.match(css,/\.selected-brand-page \{--du-primary:#123456\}/);assert.doesNotMatch(css,/:root|\.du-theme-qd|,page/);
  assert.match(css,/\.du-button\{color:var\(--du-primary\)\}/);
});
test('native comparison and submission carry real evidence without a fake H5 URL',t=>{
  const f=fixture(t);f.write(path.join(f.host,'package.json'),{dependencies:{'@tarojs/taro':'4'}});
  const s=f.select(),distPath=path.join(s.hostRoot,'dist'),screenshot=f.write(path.join(s.artifactRoot,'native.png'),'fixture screenshot bytes');
  f.write(path.join(distPath,'app.js'),'native compiled fixture');
  const nativePreview={distPath,route:'/',screenshot};
  const p=prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview});
  assert.equal(p.previewUrl,undefined);assert.match(fs.readFileSync(p.comparisonFile,'utf8'),/静态证据/);assert.doesNotMatch(fs.readFileSync(p.comparisonFile,'utf8'),/<iframe/);
  compileSelectedTheme({root:s.artifactRoot,dangouiRoot:f.dangouiRoot});
  const submission=f.json(path.join(f.dir,'native-submission.json'),{producer:'implementer',nativePreview:p.nativePreview,comparisonFile:p.comparisonFile,outputs:['host/src/App.jsx'],reused:[],adapted:[],limitations:[]});
  const pending=recordSelectedCode({root:s.artifactRoot,submissionFile:submission});assert.deepEqual(pending.reviewRequest.nativePreview,p.nativePreview);
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)}),/nativeRuntime/);
  const done=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{checks:{visual:true,business:true,tokenRuntime:true,responsive:true,singlePageScope:true,nativeRuntime:true}})});
  assert.deepEqual(done.nativePreview,p.nativePreview);assert.equal(done.previewUrl,undefined);
  f.write(path.join(distPath,'new.js'),'new native build');assert.equal(selectedCodeStatus(s.artifactRoot).status,'needs-revision');
});
test('native comparison rejects mixed media, route mismatch, escaping paths and changed dist',t=>{
  const f=fixture(t),web=f.select();
  assert.throws(()=>prepareSelectedCodeComparison({root:web.artifactRoot,nativePreview:{}}),/Taro/);
  f.write(path.join(f.host,'package.json'),{dependencies:{'@tarojs/taro':'4'}});const s=f.select();
  const distPath=path.join(s.hostRoot,'dist');f.write(path.join(distPath,'app.js'),'native');
  const screenshot=f.write(path.join(s.artifactRoot,'native.png'),'fixture'),nativePreview={distPath,route:'/',screenshot};
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview,previewUrl:'http://localhost:1234'}),/not both/);
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview:{...nativePreview,route:'other'}}),/route/);
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview:{...nativePreview,distPath:f.host}}),/isolated host/);
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview:{...nativePreview,screenshot:f.image}}),/isolated run/);
  const p=prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview});f.write(path.join(distPath,'app.js'),'changed');
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,nativePreview:p.nativePreview,outputDir:path.join(s.artifactRoot,'fresh')}),/dist changed/);
});
test('public native comparison returns a native submission descriptor and no H5 URL',t=>{
  const f=fixture(t);f.write(path.join(f.host,'package.json'),{dependencies:{'@tarojs/taro':'4'}});const s=f.select();
  const distPath=path.join(s.hostRoot,'dist');f.write(path.join(distPath,'app.js'),'native');
  const screenshot=f.write(path.join(s.artifactRoot,'native.png'),'fixture');
  const input=f.json(path.join(s.artifactRoot,'native-input.json'),{distPath,route:'/',screenshot});
  const cli=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),'prepare-selected-code-comparison','--artifact-root',s.artifactRoot,'--native-preview',input],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);const p=JSON.parse(cli.stdout);
  assert.equal(p.nativePreview.route,'/');assert.equal(p.previewUrl,undefined);assert.ok(fs.existsSync(p.nativePreviewFile));
});
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
  const startup=write(path.join(brand,'host-startup-page.json'),{hostRoot:host,sourceFile:'src/App.jsx',sourceSha256:hash(path.join(host,'src/App.jsx')),route:'/'});
  const dispatch=write(path.join(brand,'dispatch.json'),{inputs:[binding(mod),binding(adapter),binding(startup)],inputImages:[]});
  json(path.join(brand,'image-concepts.json'),{dispatch:binding(dispatch),hostTarget:host});
  json(path.join(brand,'image-concepts/a-generation.json'),{output:binding(image),arguments:binding(args)});
  const runs=[];
  t.after(()=>{fs.rmSync(dir,{recursive:true,force:true});for(const run of runs)fs.rmSync(path.dirname(run),{recursive:true,force:true});});
  function select(extra={}){const s=selectImageCode({root,brand:'dango',direction:'a',selection:'用户选择 A，仅隔离预览',confirmed:true,...extra});runs.push(s.artifactRoot);return s;}
  function submission(s){compileSelectedTheme({root:s.artifactRoot,dangouiRoot});const preview=write(path.join(s.artifactRoot,'compare.html'),'<html>runtime comparison</html>');const p=write(path.join(dir,'submission.json'),{producer:'implementer',previewUrl:'http://127.0.0.1:12345/',comparisonFile:preview,outputs:['host/src/App.jsx'],reused:[],adapted:['React view'],limitations:[]});return recordSelectedCode({root:s.artifactRoot,submissionFile:p});}
  function review(s,extra={}){const evidence=write(path.join(s.artifactRoot,'runtime-evidence.txt'),'test fixture, not an actual runtime proof');return write(path.join(dir,'review.json'),{reviewer:'independent-qa',verdict:'pass',submission:binding(path.join(s.artifactRoot,'implementation.json')),checks:{visual:true,business:true,tokenRuntime:true,responsive:true,singlePageScope:true},observations:['fixture observation'],evidence:[binding(evidence)],limitations:[],...extra});}
  return {dir,root,host,brand,mod,image,dangouiRoot,write,json,select,submission,review};
}

test('scoped authorization limitation survives delivery without granting whole-host approval',t=>{
  const f=fixture(t),s=f.select();f.submission(s);
  const limitations=['Account authorization unavailable; outside selected core search journey, not certified.'];
  const result=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{limitations,observations:['Synthetic fixture: required search input, results and clear recovery observed; account unavailable.']})});
  assert.equal(result.status,'ready-for-user-review');
  assert.deepEqual(result.limitations,limitations);
  assert.equal(result.wholeHostAuthorized,false);
});

for(const business of [false,null])test(`authorization limitation cannot waive broken or unverified core search (${business})`,t=>{
  const f=fixture(t),s=f.select();f.submission(s);
  const reviewFile=f.review(s,{checks:{visual:true,business,tokenRuntime:true,responsive:true,singlePageScope:true},limitations:['Account authorization warning'],observations:['Required search is broken or lacks actual input evidence.']});
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile}),/scoped runtime checks/);
  assert.equal(selectedCodeStatus(s.artifactRoot).status,'review-ready');
});

test('selection requires explicit authorization and exact image hash',t=>{
  const f=fixture(t);assert.throws(()=>f.select({confirmed:false}),/authorization/);
  assert.throws(()=>f.select({selection:''}),/authorization/);
  assert.throws(()=>f.select({direction:'b'}),/ENOENT/);
  fs.appendFileSync(f.image,'changed');assert.throws(()=>f.select(),/Changed input/);
});

test('public revision retains selected art, current code and old receipts but requires fresh independent review',t=>{
  const f=fixture(t),s=f.select();f.submission(s);
  const failed=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{verdict:'fail',observations:['filter clipped']})});
  const oldSubmission=path.join(s.artifactRoot,'implementation.json'),oldReview=path.join(s.artifactRoot,'implementation-review.json');
  const oldHashes=[hash(oldSubmission),hash(oldReview)], art=hash(s.dispatchRequest.selectedImage.path);
  fs.appendFileSync(path.join(s.hostRoot,'src/App.jsx'),'\n// corrected isolated layout');
  const recovery=selectedCodeStatus(s.artifactRoot);
  const args=recovery.revisionCommand.slice(1);args[args.length-1]='filter clipping';
  const cli=spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);
  const resumed=JSON.parse(cli.stdout);
  assert.equal(resumed.status,'implementation-dispatch-ready');assert.equal(resumed.hostRoot,s.hostRoot);
  assert.equal(hash(s.dispatchRequest.selectedImage.path),art);
  assert.deepEqual([hash(oldSubmission),hash(oldReview)],oldHashes);
  assert.equal(reviseSelectedCode({root:s.artifactRoot,reason:'filter clipping'}).status,'implementation-dispatch-ready');
  const pending=f.submission(s);
  assert.equal(pending.status,'review-ready');
  assert.notEqual(pending.reviewRequest.submission.path,oldSubmission);
  assert.equal(pending.reviewRequest.regression.mode,'impact-scoped');
  assert.deepEqual(pending.reviewRequest.regression.changedSinceReview,['src/App.jsx']);
  assert.equal(pending.reviewRequest.regression.previousReview.sha256,oldHashes[1]);
  assert.equal(pending.reviewRequest.regression.automaticPass,false);
  assert.ok(pending.reviewRequest.regression.evidence.length>0);
  const priorEvidence=pending.reviewRequest.regression.evidence[0].path;
  const priorBytes=fs.readFileSync(priorEvidence);
  fs.appendFileSync(priorEvidence,'tampered');
  assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed|hash|mismatch/i);
  fs.writeFileSync(priorEvidence,priorBytes);
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)}),/submission mismatch/);
  const done=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{submission:pending.reviewRequest.submission})});
  assert.equal(done.status,'ready-for-user-review');assert.equal(done.wholeHostAuthorized,false);
  assert.deepEqual([hash(oldSubmission),hash(oldReview)],oldHashes);
  fs.appendFileSync(s.dispatchRequest.selectedImage.path,'tampered');
  assert.throws(()=>reviseSelectedCode({root:s.artifactRoot,reason:'cannot bypass frozen input'}),/Changed input/);
});
test('public selection can use a saved image while another direction failed',t=>{
  const f=fixture(t);const failure=f.json(path.join(f.brand,'image-concepts/c-failure.json'),{code:'moderation_blocked',direction:'c'});
  const before=hash(failure),imageBefore=hash(f.image);
  const cli=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),'select-image-code','--artifact-root',f.root,'--brand','dango','--direction','a','--selection','测试：已有 A，请仅准备隔离单页','--confirm-isolated-preview'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);const result=JSON.parse(cli.stdout);
  t.after(()=>fs.rmSync(path.dirname(result.artifactRoot),{recursive:true,force:true}));
  assert.equal(result.status,'implementation-dispatch-ready');assert.equal(result.wholeHostAuthorized,false);
  assert.equal(result.dispatchRequest,undefined);
  assert.equal(hash(result.specialistPacket.path),result.specialistPacket.sha256);
  assert.equal(JSON.parse(fs.readFileSync(result.specialistPacket.path)).scope,'single-page');assert.equal(hash(failure),before);assert.equal(hash(f.image),imageBefore);
  assert.throws(()=>f.select({direction:'c'}),/ENOENT/);
});

test('selected illustration bytes and reuse policy reach implementation and independent QA unchanged',t=>{
  const f=fixture(t),s=f.select(),art=s.dispatchRequest.selectedArtwork;
  assert.equal(art.role,'generated-proposal');
  assert.equal(art.preferredUse,'reuse-selected-illustration');
  assert.deepEqual(art.source,s.dispatchRequest.selectedImage);
  assert.equal(hash(art.source.path),hash(f.image));
  assert.ok(art.source.path.startsWith(s.artifactRoot+path.sep));
  assert.deepEqual(f.submission(s).reviewRequest.selectedArtwork,art);
  fs.appendFileSync(art.source.path,'changed');
  assert.throws(()=>selectedCodeStatus(s.artifactRoot),/Changed input/);
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
test('snapshot skips root build artifacts but preserves nested business routes named build',t=>{
  const f=fixture(t);
  f.write(path.join(f.host,'build/generated.js'),'compiled artifact');
  f.write(path.join(f.host,'src/pages/build/index.vue'),'<template><view>real build journey</view></template>');
  const s=f.select();
  assert.equal(fs.existsSync(path.join(s.hostRoot,'build/generated.js')),false);
  assert.equal(fs.readFileSync(path.join(s.hostRoot,'src/pages/build/index.vue'),'utf8'),'<template><view>real build journey</view></template>');
  const state=JSON.parse(fs.readFileSync(path.join(s.artifactRoot,'selected-image-code.json'),'utf8'));
  assert.ok(state.baseline.files.some(file=>file.path==='src/pages/build/index.vue'));
});
test('a pre-fix run keeps its frozen legacy snapshot policy after the copier is upgraded',t=>{
  const f=fixture(t);
  f.write(path.join(f.host,'src/pages/build/index.vue'),'<template><view>real build journey</view></template>');
  const s=f.select(), stateFile=path.join(s.artifactRoot,'selected-image-code.json');
  const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  delete state.baselinePolicy;
  state.baseline.files=state.baseline.files.filter(file=>!file.path.startsWith('src/pages/build/'));
  fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
  assert.equal(selectedCodeStatus(s.artifactRoot).status,'implementation-dispatch-ready');
});
test('file hostTarget resolves the actual project through frozen startup context',t=>{
  const f=fixture(t),dispatchFile=path.join(f.brand,'dispatch.json');
  const dispatch=JSON.parse(fs.readFileSync(dispatchFile,'utf8'));
  f.json(dispatchFile,dispatch);
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
  assert.equal(selectedCodeStatus(s.artifactRoot).status,'needs-revision');
  assert.equal(selectedCodeStatus(s.artifactRoot).previewReady,false);
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
  assert.equal(selectedCodeStatus(s.artifactRoot).status,'needs-revision');
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

test('unreviewed image selects only a frozen page and preserves unresolved review notes',t=>{
  const f=fixture(t);
  f.json(path.join(f.brand,'image-concepts-failed-review.json'),{verdict:'fail',limitations:['A filter options remain unconfirmed']});
  const s=f.select();
  assert.equal(s.dispatchRequest.targetPage.relativePath,'src/App.jsx');
  assert.equal(s.dispatchRequest.targetPage.source.sha256,hash(path.join(f.host,'src/App.jsx')));
  assert.equal(s.wholeHostAuthorized,false);
  const notes=s.dispatchRequest.conceptReviewNotes;
  assert.equal(notes.length,1);
  assert.deepEqual(notes[0].limitations,['A filter options remain unconfirmed']);
  assert.deepEqual(JSON.parse(fs.readFileSync(notes[0].source.path)).limitations,notes[0].limitations);
  assert.deepEqual(f.submission(s).reviewRequest.conceptReviewNotes,notes);
  assert.equal(JSON.parse(fs.readFileSync(path.join(s.artifactRoot,'selected-image-code.json'))).parentImageReview,'failed-preserved');
});

test('superseded image FAIL is historical and only corrected findings reach implementation',t=>{
  const f=fixture(t),failed=f.json(path.join(f.brand,'image-concepts-failed-review.json'),{verdict:'fail',limitations:['New illustration forbidden']});
  f.json(path.join(f.brand,'image-concepts-receipt.json'),{independentReview:{verdict:'pass',supersedesFailedReview:binding(failed),limitations:['A filter words unconfirmed'],presentationRequirements:['Mark A filters pending']}});
  const s=f.select(),notes=s.dispatchRequest.conceptReviewNotes;
  assert.equal(notes.length,1);assert.equal(notes[0].verdict,'pass');
  assert.deepEqual(notes[0].limitations,['A filter words unconfirmed']);
  assert.deepEqual(notes[0].presentationRequirements,['Mark A filters pending']);
  assert.equal(s.dispatchRequest.inputs.some(b=>/image-concepts-(failed-review|review|receipt)\.json$/.test(b.path)),false);
  const state=JSON.parse(fs.readFileSync(path.join(s.artifactRoot,'selected-image-code.json')));
  assert.equal(state.historicalConceptReviews[0].role,'historical-not-current-do-not-reapply');
  assert.notEqual(state.parentImageReview,'failed-preserved');
  assert.deepEqual(f.submission(s).reviewRequest.conceptReviewNotes,notes);
});

test('runtime pass is not user confirmation or whole-host authority and requires scoped review',t=>{
  const f=fixture(t),s=f.select();f.submission(s);
  assert.throws(()=>recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{checks:{visual:true,business:true,tokenRuntime:true,responsive:true}})}),/single-page scope/);
  const done=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)});
  assert.equal(done.confirmationStatus,'awaiting-user-single-page-confirmation');
  assert.equal(done.userSinglePageConfirmed,false);
  assert.equal(done.wholeHostAuthorized,false);
  assert.equal(done.fullWorkflowPass,false);
});

test('legacy selected-page submissions remain reviewable without inventing user approval',t=>{
  const f=fixture(t),s=f.select(),file=path.join(s.artifactRoot,'selected-image-code.json');
  const state=JSON.parse(fs.readFileSync(file));delete state.targetPage;f.json(file,state);
  f.submission(s);
  const done=recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s,{checks:{visual:true,business:true,tokenRuntime:true,responsive:true}})});
  assert.equal(done.status,'ready-for-user-review');
  assert.equal(done.wholeHostAuthorized,false);
  assert.equal(done.userSinglePageConfirmed,false);
});

test('selection rejects directory-only ambiguity and whole-host submission',t=>{
  const f=fixture(t),s=f.select();
  const p=f.json(path.join(f.dir,'wide.json'),{scope:'whole-host'});
  assert.throws(()=>recordSelectedCode({root:s.artifactRoot,submissionFile:p}),/only one page/);
  const d=path.join(f.brand,'dispatch.json'),packet=JSON.parse(fs.readFileSync(d));
  packet.inputs=packet.inputs.filter(b=>!b.path.endsWith('host-startup-page.json'));f.json(d,packet);
  f.json(path.join(f.brand,'image-concepts.json'),{dispatch:binding(d),hostTarget:f.host});
  assert.throws(()=>f.select(),/concrete single-page/);
});

test('changed-file inventory includes shared dependency edits for scoped QA',t=>{
  const f=fixture(t),s=f.select();
  f.write(path.join(s.hostRoot,'src/shared.css'),'.page{color:red}');
  const pending=f.submission(s);
  assert.ok(pending.reviewRequest.changedFiles.includes('src/shared.css'));
  assert.ok(pending.reviewRequest.changedFiles.includes('src/brand/brand-entry.css'));
  assert.equal(pending.reviewRequest.scope,'single-page');
});

test('public entry cannot reuse selected-page run as whole-host approval',t=>{
  const f=fixture(t),s=f.select();
  for(const action of ['run','approve']) {
    const r=spawnSync(process.execPath,[new URL('./run-brand-workflow.mjs',import.meta.url).pathname,action,'--artifact-root',s.artifactRoot,'--request-kind','host-implementation','--mode','apply-host'],{encoding:'utf8'});
    assert.match(r.stdout+r.stderr,/SINGLE_PAGE_CONFIRMATION_REQUIRED/);
  }
});

test('standard comparison uses immutable exact image, escaped loopback URL and existing static server',t=>{
  const f=fixture(t),s=f.select();
  const source=s.dispatchRequest.selectedImage.path, before=hash(source);
  const result=prepareSelectedCodeComparison({root:s.artifactRoot,previewUrl:'http://127.0.0.1:4317/?a=1&b="/><script>alert(1)</script>#/page'});
  assert.equal(result.selectedImage.sha256,before);assert.equal(hash(source),before);
  const html=fs.readFileSync(result.comparisonFile,'utf8');
  assert.match(html,/&amp;b=/);assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html,/iframe/);assert.match(html,/320 × 740/);
  assert.ok(result.preview.command.includes(path.resolve('skills/brand/scripts/serve-design-host-h5.mjs')));
  const saved=hash(result.comparisonFile);
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,previewUrl:'http://localhost:1234/'}),/already exists/);
  assert.equal(hash(result.comparisonFile),saved);
  assert.ok(s.dispatchRequest.commands.prepareComparison.includes('prepare-selected-code-comparison'));
});

test('comparison rejects non-loopback, credential URLs, host destinations and symlink collisions without writes',t=>{
  const f=fixture(t),s=f.select(),out=path.join(f.dir,'fresh-comparison');
  for(const previewUrl of ['https://example.com/','javascript:alert(1)','http://localhost.evil.test/','http://user:secret@localhost:80/']) {
    assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,previewUrl,outputDir:out}),/loopback/);
    assert.equal(fs.existsSync(out),false);
  }
  for(const host of [s.hostRoot,f.host]) assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,previewUrl:'http://localhost:1234/',outputDir:path.join(host,'comparison')}),/outside host/);
  fs.symlinkSync(f.host,out);
  assert.throws(()=>prepareSelectedCodeComparison({root:s.artifactRoot,previewUrl:'http://localhost:1234/',outputDir:out}),/already exists/);
  assert.equal(fs.existsSync(path.join(f.host,'index.html')),false);
});

test('public comparison command writes only new output and keeps reviewed receipts intact',t=>{
  const f=fixture(t),s=f.select();f.submission(s);recordSelectedCodeReview({root:s.artifactRoot,reviewFile:f.review(s)});
  const receipt=path.join(s.artifactRoot,'implementation-review.json'),before=hash(receipt),out=path.join(f.dir,'new-validation');
  const cli=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),'prepare-selected-code-comparison','--artifact-root',s.artifactRoot,'--preview-url','http://[::1]:4317/#/page','--output-dir',out],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);
  assert.equal(JSON.parse(cli.stdout).comparisonFile,path.join(out,'index.html'));
  assert.equal(hash(receipt),before);assert.equal(selectedCodeStatus(s.artifactRoot).status,'ready-for-user-review');
});

test('producer verified runtime paths and versions reach QA without being treated as independent proof',t=>{
  const f=fixture(t),s=f.select();compileSelectedTheme({root:s.artifactRoot,dangouiRoot:f.dangouiRoot});
  const comparison=prepareSelectedCodeComparison({root:s.artifactRoot,previewUrl:'http://localhost:1234/'});
  const verifiedRuntimeTools=[{name:'node test runtime',version:process.version,path:process.execPath,verified:true}];
  const submission={producer:'implementer',previewUrl:comparison.previewUrl,comparisonFile:comparison.comparisonFile,outputs:['host/src/App.jsx'],reused:[],adapted:[],limitations:[],verifiedRuntimeTools};
  const file=f.json(path.join(f.dir,'tool-submission.json'),{...submission,verifiedRuntimeTools:[{...verifiedRuntimeTools[0],version:''}]});
  assert.throws(()=>recordSelectedCode({root:s.artifactRoot,submissionFile:file}),/verified runtime tool/);
  assert.equal(fs.existsSync(path.join(s.artifactRoot,'implementation.json')),false);
  f.json(file,submission);const result=recordSelectedCode({root:s.artifactRoot,submissionFile:file});
  assert.deepEqual(result.reviewRequest.verifiedRuntimeTools,verifiedRuntimeTools);
  assert.match(result.reviewRequest.runtimeToolProvenance,/not independent QA proof/);
  assert.equal(result.status,'review-ready');
});

test('selected-code public stdout flushes a dispatch larger than a pipe buffer',t=>{
  const f=fixture(t),s=f.select(),file=path.join(s.artifactRoot,'selected-image-code.json');
  const state=JSON.parse(fs.readFileSync(file,'utf8'));
  state.inputs=Array.from({length:800},()=>state.inputs[0]);f.json(file,state);
  const cli=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/run-brand-workflow.mjs'),'continue','--full','--artifact-root',s.artifactRoot],{encoding:'utf8',maxBuffer:2*1024*1024});
  assert.equal(cli.status,0,cli.stdout+cli.stderr);assert.ok(Buffer.byteLength(cli.stdout)>65536);
  assert.equal(JSON.parse(cli.stdout).dispatchRequest.inputs.length,800);
});
