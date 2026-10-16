import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { manage } from './brand-artifacts.mjs';
import { compileHostTheme } from './compile-host-theme.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeTools = 'At stage start, confirm and record available local runtime-test tools, including already installed Playwright where available. Built-in browser failure does not automatically waive QA: use an available permitted local test tool, or report the actual blocker. Never bypass browser/network access policy, header restrictions or sandbox permissions.';
const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run-brand-workflow.mjs');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const bind = file => ({path: path.resolve(file), sha256: sha(file)});
const assert = (ok, reason) => { if (!ok) throw Error(reason); };
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2)+'\n', {flag:'wx'});
const within = (root, file) => { const p=path.relative(root,file); return p!==''&&!p.startsWith('..'+path.sep)&&p!=='..'&&!path.isAbsolute(p); };
const verify = b => { assert(b?.path && /^[a-f0-9]{64}$/.test(b.sha256||'') && sha(b.path)===b.sha256, `Changed input/output: ${b?.path}`); return b.path; };
export const selectedCodeFile = root => path.join(root,'selected-image-code.json');
const cmd = (action, root, ...args) => [process.execPath,entry,action,'--artifact-root',root,...args];
function localPreview(value) {
  const url = new URL(value);
  assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname) && ['http:','https:'].includes(url.protocol) && !url.username && !url.password, 'Credential-free loopback preview URL required.');
  return url.href;
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function verifiedTools(value = []) {
  assert(Array.isArray(value), 'verifiedRuntimeTools must be an array.');
  return value.map(tool => {
    assert(tool && typeof tool.name==='string' && tool.name.trim() && typeof tool.version==='string' && tool.version.trim() && typeof tool.path==='string' && path.isAbsolute(tool.path) && fs.existsSync(tool.path) && tool.verified===true, 'Each verified runtime tool requires name, version, existing absolute path and verified:true (producer observation).');
    return {name:tool.name,version:tool.version,path:tool.path,verified:true};
  });
}
function validateNativePreview(root,state,value) {
  assert(state.nativeRuntime||state.framework==='taro','nativePreview requires a Taro host.');
  assert(value&&typeof value.distPath==='string'&&path.isAbsolute(value.distPath),'nativePreview requires absolute distPath.');
  const distPath=fs.realpathSync(value.distPath);
  assert(within(fs.realpathSync(state.hostRoot),distPath)&&fs.statSync(distPath).isDirectory(),'Native dist must be inside isolated host.');
  assert(value.route===state.targetPage?.route&&typeof value.route==='string','Native route must match frozen targetPage.');
  const screenshot=typeof value.screenshot==='string'?bind(value.screenshot):value.screenshot;
  localBinding(root,screenshot);
  assert(!within(state.hostRoot,fs.realpathSync(screenshot.path))&&/\.(png|jpe?g|webp)$/i.test(screenshot.path),'Native screenshot must be raster evidence outside host source.');
  const inventory=snapshot(distPath);
  assert(inventory.files.length&&!inventory.skippedSymlinks.length,'Native dist must contain files and no symlinks.');
  if(value.distFiles)assert(JSON.stringify(value.distFiles)===JSON.stringify(inventory.files),'Native dist changed since comparison; prepare fresh evidence.');
  return {mode:'native',distPath,route:value.route,screenshot,distFiles:inventory.files,interactionEntry:'Open distPath in native developer tools or device; comparison is static evidence, not an interactive H5 runtime.'};
}
export function prepareSelectedCodeComparison({root,previewUrl,outputDir,nativePreview}) {
  root=fs.realpathSync(root);
  const state=read(selectedCodeFile(root));inputs(state);
  assert(!(nativePreview&&previewUrl),'Choose nativePreview or H5 previewUrl, not both.');
  const native=nativePreview?validateNativePreview(root,state,nativePreview):null;
  const runtime=native?null:localPreview(previewUrl);
  const dir=path.resolve(outputDir || path.join(activeAttempt(root).dir,'selected-code-comparison'));
  const parent=fs.realpathSync(path.dirname(dir));
  const destination=path.join(parent,path.basename(dir));
  for(const host of [state.hostRoot,state.hostOriginal]) {
    const realHost=fs.realpathSync(host);
    assert(destination!==realHost&&!within(realHost,destination),'Comparison must stay outside host source.');
  }
  assert(!fs.lstatSync(dir,{throwIfNoEntry:false}), 'Comparison output directory already exists; choose a new directory. Existing comparisons and reviews are immutable.');
  const ext=path.extname(state.image.path).toLowerCase();
  assert(['.png','.jpg','.jpeg','.webp','.gif'].includes(ext), 'Selected comparison image must be a raster file.');
  const imageName='selected-reference'+ext;
  if(native) {
    const actualName='native-runtime'+path.extname(native.screenshot.path).toLowerCase();
    const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>选图与原生截图</title><style>body{font:16px/1.6 system-ui;margin:24px}main{display:flex;gap:24px;flex-wrap:wrap}img{width:390px;max-width:100%;height:auto}section{max-width:390px}</style><h1>方向 ${escapeHtml(state.direction.toUpperCase())} · 原生单页静态证据</h1><p>这是选图与实际原生截图的比较，不是可交互 H5。实际操作请在开发工具或真机中打开下方 dist 和路由；截图不证明交互、窄屏或 QA 通过。</p><p>dist: <code>${escapeHtml(native.distPath)}</code><br>路由: <code>${escapeHtml(native.route)}</code></p><main><section><h2>选中效果图</h2><img src="${imageName}" alt="选中效果图原件"></section><section><h2>原生运行截图</h2><img src="${actualName}" alt="实际原生运行截图"></section></main></html>`;
    fs.mkdirSync(dir);fs.copyFileSync(state.image.path,path.join(dir,imageName),fs.constants.COPYFILE_EXCL);fs.copyFileSync(native.screenshot.path,path.join(dir,actualName),fs.constants.COPYFILE_EXCL);
    const comparisonFile=path.join(dir,'index.html');fs.writeFileSync(comparisonFile,html,{flag:'wx'});
    const normalized={...native,screenshot:bind(path.join(dir,actualName))};
    const nativePreviewFile=path.join(dir,'native-preview.json');save(nativePreviewFile,normalized);
    return {ok:true,comparisonFile,nativePreview:normalized,nativePreviewFile,selectedImage:bind(path.join(dir,imageName)),comparison:bind(comparisonFile),preview:{command:[process.execPath,path.join(skillRoot,'scripts','serve-design-host-h5.mjs'),'--root',dir,'--port','0'],path:'/index.html',instructions:'Static evidence comparison only. Open nativePreview.distPath and route in native developer tools for actual interaction. Include nativePreview and comparisonFile in submission; omit previewUrl.'}};
  }
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>选图与实际单页</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#edf0f2;color:#17191c;font:15px/1.6 system-ui,sans-serif}header,footer{max-width:840px;margin:0 auto 24px}h1{font-size:24px}h2{font-size:17px}main{display:flex;gap:24px;justify-content:center;flex-wrap:wrap}.frame{display:block;width:390px;height:844px;border:0;background:white}img.frame{object-fit:contain;object-position:top}p{max-width:390px}select{font:inherit;padding:6px}footer{margin-top:24px}a{color:inherit}</style></head><body><header><h1>选中方向 ${escapeHtml(state.direction.toUpperCase())} · 图片与真实单页</h1><label>同一 CSS 视口 <select id="viewport"><option value="390">390 × 844</option><option value="320">320 × 740</option></select></label> · <a href="${escapeHtml(runtime)}" target="_blank" rel="noopener noreferrer">单独打开实际页面</a></header><main><section><h2>选中的完整效果图 · 静态</h2><img class="frame" src="${imageName}" alt="选中效果图原件"></section><section><h2>真实单页 · 可操作</h2><iframe class="frame" title="隔离宿主实际单页" src="${escapeHtml(runtime)}" referrerpolicy="no-referrer"></iframe></section></main><footer>图片不证明交互。运行数据及加载状态以实际宿主为准；范围仅限隔离单页。此比较页不表示 QA 通过、用户确认或整体换肤授权。实际业务、设计系统消费、窄屏与返回路径仍须独立检查。</footer><script>document.getElementById('viewport').addEventListener('change',function(){const width=this.value==='320'?320:390;document.querySelectorAll('.frame').forEach(function(frame){frame.style.width=width+'px';frame.style.height=(width===320?740:844)+'px'})})</script></body></html>`;
  fs.mkdirSync(dir);
  fs.copyFileSync(state.image.path,path.join(dir,imageName),fs.constants.COPYFILE_EXCL);
  const comparisonFile=path.join(dir,'index.html');fs.writeFileSync(comparisonFile,html,{flag:'wx'});
  return {ok:true,comparisonFile,previewUrl:runtime,selectedImage:bind(path.join(dir,imageName)),comparison:bind(comparisonFile),preview:{command:[process.execPath,path.join(skillRoot,'scripts','serve-design-host-h5.mjs'),'--root',dir,'--port','0'],path:'/index.html',instructions:'Use the returned server baseUrl + path. Keep the actual host runtime running separately. Include comparisonFile in the normal implementation submission; this generator performs no runtime QA.'}};
}
function activeAttempt(root) {
  let dir=root, revision=0, recovery=null;
  while(fs.existsSync(path.join(root,'revisions',String(revision+1),'revision.json'))) {
    dir=path.join(root,'revisions',String(++revision));
    assert(within(fs.realpathSync(root),fs.realpathSync(dir)),'Revision escapes isolated run.');
    recovery=read(path.join(dir,'revision.json'));
    localBinding(root,recovery.previousSubmission);
    if(recovery.previousReview)localBinding(root,recovery.previousReview);
  }
  return {dir,revision,recovery,implementation:path.join(dir,'implementation.json'),review:path.join(dir,'implementation-review.json')};
}
export function reviseSelectedCode({root,reason}) {
  const state=read(selectedCodeFile(root));inputs(state);
  assert(reason?.trim(),'A concrete local correction reason is required.');
  const current=activeAttempt(root);
  if(current.recovery&&!fs.existsSync(current.implementation)) return selectedCodeStatus(root);
  assert(fs.existsSync(current.implementation),'No recorded implementation to revise; continue the current implementation.');
  // Keep immutable receipts. Runtime files remain editable, but no previous
  // verdict is valid for this new submission, even if the old verdict passed.
  const dir=path.join(root,'revisions',String(current.revision+1));
  fs.mkdirSync(dir,{recursive:true});
  assert(within(fs.realpathSync(root),fs.realpathSync(dir)),'Revision escapes isolated run.');
  save(path.join(dir,'revision.json'),{reason,previousSubmission:bind(current.implementation),previousReview:fs.existsSync(current.review)?bind(current.review):null,createdAt:new Date().toISOString()});
  return selectedCodeStatus(root);
}
// Omit credential/config containers by name before hashing or reading bytes.
// Package-manager configs can hold inline tokens; the isolated install must use
// its own permitted authentication, never a copied host credential.
const sensitiveNames = new Set(['.npmrc','.yarnrc','.yarnrc.yml','.pnpmrc','.netrc','_netrc','.pypirc','.aws','.ssh','.azure','.gcloud','.kube','.docker']);
const ignoredAtAnyDepth = new Set(['.git','node_modules','.codex','.claude','.agents']);
const generatedRootNames = new Set(['dist','build','output','.next','coverage','.vite','.vite-cache','playwright-report','test-results']);
const ignored = (name, prefix, policy) => sensitiveNames.has(name.toLowerCase())
  || ignoredAtAnyDepth.has(name)
  || ((policy === 'legacy-any-depth-generated-v1' || prefix === '') && generatedRootNames.has(name))
  || name.startsWith('.env');
function snapshot(root, dest, prefix='', result=[], skipped=[], policy='root-generated-only-v2') {
  for (const d of fs.readdirSync(path.join(root,prefix),{withFileTypes:true})) {
    const rel=path.join(prefix,d.name), src=path.join(root,rel);
    if(ignored(d.name,prefix,policy)) continue;
    if(d.isSymbolicLink()){skipped.push(rel);continue;}
    if(d.isDirectory()){if(dest)fs.mkdirSync(path.join(dest,rel),{recursive:true});snapshot(root,dest,rel,result,skipped,policy);}
    else if(d.isFile()){result.push({path:rel,sha256:sha(src)});if(dest)fs.copyFileSync(src,path.join(dest,rel));}
  }
  return {files:result,skippedSymlinks:skipped};
}
function assertOriginal(state) {
  const before=state.baseline.files, now=snapshot(state.hostOriginal,null,'',[],[],state.baselinePolicy||'legacy-any-depth-generated-v1');
  assert(JSON.stringify(now.files)===JSON.stringify(before),'Original host changed since selection; do not claim unchanged or overwrite it.');
}
function localBinding(root,b) { verify(b);assert(within(fs.realpathSync(root),fs.realpathSync(b.path)), 'Output must stay inside the isolated run.'); return b; }
function inputs(state){state.inputs.forEach(verify);(state.conceptReviewNotes||[]).forEach(n=>verify(n.source));verify(state.image);verify(state.selection);assertOriginal(state);}
function filesUnder(root,files){return files.map(f=>localBinding(root,bind(path.resolve(root,f))));}
export function selectImageCode({root,brand,direction,selection,confirmed=false}) {
  assert(confirmed && selection?.trim(),'Explicit user selection and isolated-code authorization required.');
  assert(/^[a-z0-9][a-z0-9-]*$/.test(brand||'')&&['a','b','c'].includes(direction),'Invalid brand/direction.');
  root=fs.realpathSync(root);
  const parent=read(path.join(root,'migrations',brand,'image-concepts.json'));
  verify(parent.dispatch);const dispatch=read(parent.dispatch.path);
  dispatch.inputs.forEach(verify);dispatch.inputImages.forEach(verify);
  const generation=read(path.join(root,'migrations',brand,'image-concepts',`${direction}-generation.json`));
  verify(generation.output);verify(generation.arguments);
  assert(within(root,fs.realpathSync(generation.output.path)),'Selected image outside run.');
  const target=fs.realpathSync(parent.hostTarget);
  const startupPath=dispatch.inputs.find(b=>path.basename(b.path)==='host-startup-page.json')?.path;
  const startup=startupPath?read(startupPath):null;
  const host=fs.statSync(target).isDirectory()?target:fs.realpathSync(path.resolve(root,startup.hostRoot));
  assert(target===host||within(host,target),'Startup source is outside its host.');
  assert(fs.existsSync(path.join(host,'package.json')),'Host package.json required.');
  const source=startup?.sourceFile?fs.realpathSync(path.resolve(host,startup.sourceFile)):target;
  assert(within(host,source)&&fs.statSync(source).isFile(),'A concrete single-page startup source is required; do not infer whole-host authorization.');
  if(startup?.sourceSha256)assert(sha(source)===startup.sourceSha256,'Selected startup source changed.');
  const targetPage={source:bind(source),relativePath:path.relative(host,source),route:startup?.route||null};
  const run=manage('init',{host}), out=run.buildDirectory;
  const clone=path.join(out,'host');fs.mkdirSync(clone);
  const baselinePolicy='root-generated-only-v2', baseline=snapshot(host,clone,'',[],[],baselinePolicy);
  const brandRoot=path.join(out,'brand');fs.mkdirSync(brandRoot);
  const copied=[];
  function copySource(b){verify(b);if(!within(root,path.resolve(b.path))){assert(within(host,fs.realpathSync(b.path)),'Brand input outside frozen run.');return;}const rel=path.relative(root,b.path),to=path.join(brandRoot,rel);assert(within(root,fs.realpathSync(b.path)),'Brand symlink escape.');fs.mkdirSync(path.dirname(to),{recursive:true});if(!fs.existsSync(to))fs.copyFileSync(b.path,to);if(!copied.some(x=>x.path===to))copied.push(bind(to));}
  [...dispatch.inputs,...dispatch.inputImages].forEach(copySource);
  const reviewFiles=new Map();
  for(const name of ['image-concepts-failed-review.json','image-concepts-review.json','image-concepts-receipt.json']) {
    const p=path.join(root,'migrations',brand,name);
    if(fs.existsSync(p)){copySource(bind(p));reviewFiles.set(name,{original:bind(p),copy:bind(path.join(brandRoot,path.relative(root,p))),value:read(p)});}
  }
  const failed=reviewFiles.get('image-concepts-failed-review.json'),receipt=reviewFiles.get('image-concepts-receipt.json');
  const reassessment=receipt?.value.independentReview?.supersedesFailedReview;
  const superseded=Boolean(failed&&reassessment?.path===failed.original.path&&reassessment?.sha256===failed.original.sha256);
  const currentReview=failed&&!superseded?failed:receipt;
  const currentFindings=currentReview===receipt?receipt?.value.independentReview:currentReview?.value;
  const conceptReviewNotes=currentReview?[{source:currentReview.copy,role:'current-findings-only',verdict:currentFindings?.verdict||'unknown',notes:currentFindings?.notes||'',limitations:currentFindings?.limitations||[],presentationRequirements:currentFindings?.presentationRequirements||[]}]:[];
  const historicalConceptReviews=[...reviewFiles.values()].filter(v=>v!==currentReview).map(v=>({...v.copy,role:'historical-not-current-do-not-reapply'}));
  // Keep historical reports out of executable input lists. Consumers receive
  // the effective compact findings, not three contradictory full reports.
  const reviewPaths=new Set([...reviewFiles.values()].map(v=>v.copy.path));
  for(let i=copied.length-1;i>=0;i--)if(reviewPaths.has(copied[i].path))copied.splice(i,1);
  const modFile=path.join(brandRoot,'migrations',brand,'brand-mod.json');
  const mod=read(modFile);
  // Copy declared local assets, never rediscover/re-download the source website.
  function assets(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='localPath'&&typeof x==='string'){const p=path.resolve(root,x);assert(within(root,p)&&fs.existsSync(p),`Missing declared asset: ${x}`);copySource(bind(p));}else if(typeof x==='object')assets(x);}}
  assets(mod);
  const image=path.join(out,'selected-reference'+path.extname(generation.output.path));fs.copyFileSync(generation.output.path,image);
  const selectionFile=path.join(out,'selection.json');save(selectionFile,{statement:selection,direction,image:bind(image),targetPage,scope:'single-page-isolated-preview',originalHostModificationAuthorized:false,wholeHostAuthorized:false});
  const pkg=read(path.join(host,'package.json')),deps={...pkg.dependencies,...pkg.devDependencies};
  const framework=deps['@tarojs/taro']?'taro':deps.react?'react':deps.vue?'vue':'unknown';
  const reusableComponents=[];
  let nativeRuntime;
  if(framework==='taro') {
    const dest=path.join(out,'native-runtime');fs.mkdirSync(dest);
    const assets=['safe-area.mjs','usage.md'].map(name=>{const to=path.join(dest,name);fs.copyFileSync(path.join(skillRoot,'assets','taro-native-navigation',name),to);const b=bind(to);copied.push(b);return b;});
    nativeRuntime={platform:'taro-native',helper:assets[0],usage:assets[1],requiredCheck:'nativeRuntime',instructions:'Read the frozen helper and usage. Inspect existing navStyle, inline geometry, capsule and status-bar ownership before integrating the selected header. Native runtime evidence is required; H5/proxy/build success cannot replace it. Preserve selected art and single-page scope.'};
  }
  if(framework==='react'&&!deps['react-native']) {
    const dest=path.join(out,'reusable-components','react-web-button');fs.mkdirSync(dest,{recursive:true});
    const assets=['DangoButton.tsx','usage.md'].map(name=>{const to=path.join(dest,name);fs.copyFileSync(path.join(skillRoot,'assets','react-web-button',name),to);const b=bind(to);copied.push(b);return b;});
    reusableComponents.push({id:'dango-react-web-text-button',component:assets[0],usage:assets[1],sourceVersion:'dangoui 3.6.16',scope:'Optional React Web text-only adapter; verified large primary/secondary and documented states only. Read usage and confirm actual installed version/source compatibility. Requires real library CSS plus generated theme; no Taro/icons/other-component certification.'});
  }
  const parentFailed=Boolean(failed&&!superseded);
  const state={schema:'selected-image-code/v1',brand,direction,hostOriginal:host,hostRoot:clone,brandRoot,modFile,adapterFile:path.join(brandRoot,'migrations',brand,'dangoui-adapter.json'),image:bind(image),selection:bind(selectionFile),inputs:copied,baseline,baselinePolicy,framework,reusableComponents,parentRun:root,parentImageReview:parentFailed?'failed-preserved':'not-promoted',createdAt:new Date().toISOString(),fullWorkflowPass:false};
  assert(fs.existsSync(state.adapterFile),'Frozen DangoUI adapter missing.');
  state.targetPage=targetPage;
  if(nativeRuntime)state.nativeRuntime=nativeRuntime;
  state.conceptReviewNotes=conceptReviewNotes;
  state.historicalConceptReviews=historicalConceptReviews;
  save(selectedCodeFile(out),state);
  return selectedCodeStatus(out);
}
export function selectedCodeStatus(root) {
  const result=selectedCodeStatusBase(root),state=read(selectedCodeFile(root));
  if(state.nativeRuntime) {
    verify(state.nativeRuntime.helper);verify(state.nativeRuntime.usage);
    const packet=result.dispatchRequest||result.reviewRequest;
    if(packet)packet.nativeRuntime={...state.nativeRuntime,themeScope:'.selected-brand-page',themeIntegration:'Bind class selected-brand-page to the target page root, including loading state. compile-selected-theme scopes native root variables before freezing; do not edit generated CSS after compilation.'};
    if(result.reviewRequest)result.reviewRequest.reviewShape.checks.nativeRuntime=null;
    if(result.dispatchRequest) {
      result.dispatchRequest.commands.prepareNativeComparison=cmd('prepare-selected-code-comparison',root,'--native-preview','<native-preview-input.json>');
      result.dispatchRequest.nativePreviewShape={distPath:path.join(state.hostRoot,'dist'),route:state.targetPage?.route,screenshot:path.join(root,'<actual-native-screenshot.png>')};
      result.dispatchRequest.nativeDelivery='For native delivery use prepareNativeComparison with nativePreviewShape, then submit its returned nativePreview and comparisonFile without previewUrl. Static screenshots are not interaction proof; QA must operate native developer tools/device.';
    }
  }
  const implementation=activeAttempt(root).implementation;
  if(fs.existsSync(implementation)) {
    const p=read(implementation);
    if(p.nativePreview) {
      try {validateNativePreview(root,state,p.nativePreview);} catch(error) {return {...result,status:'needs-revision',previewReady:false,userGoalCompleted:false,reason:error.message};}
      result.nativePreview=p.nativePreview;
      if(result.reviewRequest)result.reviewRequest.nativePreview=p.nativePreview;
    }
  }
  return result;
}
function selectedCodeStatusBase(root) {
  const state=read(selectedCodeFile(root));inputs(state);
  const selectedArtwork={source:state.image,role:'generated-proposal',preferredUse:'reuse-selected-illustration',instructions:'Reuse suitable illustration regions from the selected image as generated-proposal runtime artwork, not official brand evidence. Prefer existing image bytes with responsive CSS framing over regenerating, redrawing subjects with CSS, or deleting IP. Inspect actual dimensions and choose framing per image, not a fixed brand crop. Keep subjects visible and exclude rasterized navigation, search, filters and records from the visible region. Build functional controls and live content in code using the frozen design system. Disclose baked-in decorative text. If no suitable region can be separated by layout, disclose the limitation and ask before new generation or changing expression; do not retry rejected edits. Record source hash, runtime asset, visible region and consumer in existing reused/adapted/limitations. QA verifies the same asset at target and narrow viewports, retained subjects, no fake/duplicate controls, and actual DTCG/component consumption.'};
  const base={ok:true,artifactRoot:root,hostRoot:state.hostRoot,scope:'selected-image-isolated-code-preview',targetPage:state.targetPage||null,wholeHostAuthorized:false,userSinglePageConfirmed:false,originalHostModified:false,fullWorkflowPass:false,hostImplementationComplete:false};
  const {implementation,review,recovery}=activeAttempt(root);
  base.recovery=recovery;
  base.revisionCommand=cmd('revise-selected-code',root,'--reason','<specific isolated correction>');
  if(fs.existsSync(implementation)){
    const p=read(implementation);
    try {
      p.outputs.forEach(b=>localBinding(root,b));
      assert(JSON.stringify(snapshot(state.hostRoot).files)===JSON.stringify(p.sourceFiles),'Implementation source inventory changed; a fresh submission/review is required.');
    } catch(error) {
      return {...base,status:'needs-revision',previewReady:false,userGoalCompleted:false,reason:error.message,nextAction:'Run revisionCommand with the actual local correction reason. Keep current isolated code and selected artwork; rebuild and submit current evidence for independent QA. Do not overwrite receipts or restart image selection.'};
    }
    if(fs.existsSync(review)){
      const r=read(review);verify(r.submission);r.evidence.forEach(b=>localBinding(root,b));
      if(r.verdict==='fail') return {...base,status:'needs-revision',confirmationStatus:'not-ready',previewReady:false,userGoalCompleted:false,previewUrl:p.previewUrl,comparisonFile:p.comparisonFile,limitations:r.limitations,reviewFile:review,nextAction:'Use revisionCommand with the reported defect before editing. Keep current isolated implementation and selected art. Submit fresh runtime evidence and independent QA in this same run; do not restart selection or overwrite old receipts.'};
      return {...base,status:r.verdict==='pass'?'ready-for-user-review':'needs-revision',confirmationStatus:r.verdict==='pass'?'awaiting-user-single-page-confirmation':'not-ready',previewReady:r.verdict==='pass',userGoalCompleted:r.verdict==='pass',previewUrl:p.previewUrl,comparisonFile:p.comparisonFile,limitations:r.limitations,reviewFile:review,nextAction:r.verdict==='pass'?'Show selected image versus this actual single page and limitations. Stop for user confirmation of this exact page. QA PASS and image selection are not user confirmation or whole-host authorization. Only after the user accepts this runtime page and explicitly requests broader reskin may a separate scoped implementation proceed.':'Repair only the reported isolated implementation defects; retain this review and submit a new isolated attempt.'};
    }
    return {...base,status:'review-ready',reviewRequest:{role:'host-visual-qa',selectedArtwork,targetPage:state.targetPage||null,conceptReviewNotes:state.conceptReviewNotes||[],changedFiles:p.changedFiles||[],scope:'single-page',reusableComponents:state.reusableComponents||[],runtimeTools,verifiedRuntimeTools:p.verifiedRuntimeTools||[],runtimeToolProvenance:'Producer-reported verified paths and versions, not independent QA proof. Recheck availability; do not execute arbitrary submitted code.',producer:p.producer,selectedImage:state.image,hostRoot:state.hostRoot,inputs:state.inputs,themeCompilation:p.themeCompilation,submission:bind(implementation),previewUrl:p.previewUrl,comparisonFile:p.comparisonFile,instructions:'Independently verify only the frozen target page and its necessary shared dependencies, not every route. Check changedFiles for unauthorized unrelated-page work; shared theme/import edits are allowed for this page, but their effects on untested pages are limitations, not whole-site certification. Read conceptReviewNotes for unresolved findings, without redoing image QA. Use real host options for any unconfirmed image labels. Independently render the actual isolated app, inspect the selected image at the same viewport, exercise original business navigation/save/return as applicable, and trace actual DTCG→adapter→library CSS/component→computed style. Perturb a mapped token and restore it. Check narrow-screen child clipping, not only document overflow. Report reused components vs CSS vs adapted/style-only accurately. Read any bound reusable component and usage guide; check its actual import/call sites, installed-version compatibility, required-state coverage and final host CSS overrides. Historical verification is not this-run proof. For each claimed component adaptation, compare the actual source component with the host adapter in the same theme and required states; check final CSS winners, geometry and event behavior. Token color mutation alone proves only token use, not component adaptation. Disclose uncovered components and intentional differences. File presence or producer screenshots alone cannot pass. Write review evidence outside hostRoot (inside artifactRoot) so frozen source stays unchanged. No original-host edits; no rewriting image QA.',reviewShape:{reviewer:'independent identity',verdict:'pass|fail',submission:bind(implementation),checks:{visual:null,business:null,tokenRuntime:null,responsive:null,...(state.targetPage?{singlePageScope:null}:{})},observations:[],evidence:[{path:path.join(root,"<actual-runtime-evidence-file>"),sha256:"<SHA-256 of the actual file bytes>"}],limitations:[]},recordCommand:cmd('record-selected-code-review',root,'--review','<actual-review.json>')}};
  }
  return {...base,status:'implementation-dispatch-ready',dispatchRequest:{role:'host-implementation',recovery,selectedArtwork,targetPage:state.targetPage||null,conceptReviewNotes:state.conceptReviewNotes||[],scope:'single-page',reusableComponents:state.reusableComponents||[],runtimeTools,framework:state.framework,hostRoot:state.hostRoot,originalHostReadOnly:state.hostOriginal,selectedImage:state.image,selection:state.selection,inputs:state.inputs,modFile:state.modFile,adapterFile:state.adapterFile,skippedSymlinks:state.baseline.skippedSymlinks,instructions:'Implement ONLY targetPage in this isolated real host copy. Shared theme imports and direct dependencies may change as necessary; do not reskin other pages, add routes, or scan the whole application. Read conceptReviewNotes for unresolved findings. Unconfirmed labels in the image are not business requirements: use host-supported options. Stop after independent runtime QA and present this page for user confirmation; no whole-host rollout. Inspect the image and frozen brand files; preserve real business fields, events, navigation and persistence even if the image omitted them. Do not copy a previous trial page or brand business. Read bound reusableComponents and usage guides when supplied; for applicable text buttons reuse the candidate after confirming the actual installed source/version compatibility, and record host import/call sites and edits in adapted/reused/limitations. It is optional when the brand/task needs differ; disclose non-use and uncovered scope. Identify the actual framework and reuse compatible components; incompatible Vue/React/Taro requires explicit adaptation, never a false reuse claim. Use the bound DTCG and adapter via compile-selected-theme with an actual installed DangoUI package, then import only the returned entryFile once from the host global entry and follow its integration instructions and mappedVariables list. Remove or reconnect only stale brand declarations masking those variables; preserve business styles and intentional mode/state overrides and verify their branches. Never use !important to force root values. Do not infer layout from tokens: implement the selected composition. For claimed component adaptation, follow the actual installed component DOM/classes, size/state styling and event contract, not a hand-styled approximation. Reuse original CSS where compatible and compare the real source component with this same host adapter in required states. Scope to this task, not a new cross-framework library. Keep existing business logic; list any necessary changes. Install dependencies using the copied lockfile/environment; never run installs through symlinks into original node_modules. Do not copy credentials. Build and run the app, take same-viewport actual screenshots, then execute commands.prepareComparison with the running loopback URL to generate the standard image-versus-runtime comparison. Supply verifiedRuntimeTools only for tools actually exercised; omit it or use [] when none were verified. Paths are discovery context, not permission to bypass access policy. This dispatch is not implementation success. Continue to independent review using returned commands. No new ABC or original host modification.',commands:{prepareComparison:cmd('prepare-selected-code-comparison',root,'--preview-url','<running-loopback-host-url>'),compileTheme:cmd('compile-selected-theme',root,'--dangoui-root','<actual-installed-dangoui-package>'),record:cmd('record-selected-code',root,'--submission','<implementation-submission.json>'),continue:cmd('continue',root)},submissionShape:{producer:'actual implementer',previewUrl:'http://127.0.0.1:<port>/',comparisonFile:'comparisonFile returned by prepare-selected-code-comparison',verifiedRuntimeTools:[{name:'actual runtime test tool',version:'observed version',path:'/absolute/existing/module-or-executable',verified:true}],outputs:['host/src/changed-file','host/src/brand/theme.css','actual-screenshot.png'],reused:[],adapted:[],limitations:[]}}};
}
export function compileSelectedTheme({root,dangouiRoot}) {
  const state=read(selectedCodeFile(root));inputs(state);
  assert(!fs.existsSync(activeAttempt(root).implementation),'Implementation already recorded. Use revise-selected-code --reason before local correction.');
  const outputDir=path.join(state.hostRoot,'src','brand');
  let parent=outputDir;while(!fs.existsSync(parent))parent=path.dirname(parent);
  assert(within(fs.realpathSync(root),fs.realpathSync(parent)),'Theme output escapes isolated run.');
  for(const name of ['brand-theme.css','dangoui-runtime.css','brand-entry.css','theme-compilation.json']) {
    assert(!fs.lstatSync(path.join(outputDir,name),{throwIfNoEntry:false})?.isSymbolicLink(),'Theme output file cannot be a symlink.');
  }
  const result=compileHostTheme({modFile:state.modFile,adapterFile:state.adapterFile,dangouiRoot,outputDir,...(state.nativeRuntime||state.framework==='taro'?{rootSelector:'.selected-brand-page'}:{})});
  const record={...result,bindings:[result.themeFile,result.runtimeStyleFile,result.entryFile,result.proofFile].map(bind)};
  fs.writeFileSync(path.join(root,'theme-build.json'),JSON.stringify(record,null,2)+'\n');return record;
}
export function recordSelectedCode({root,submissionFile}) {
  const state=read(selectedCodeFile(root));inputs(state);const p=read(submissionFile);
  assert(!p.scope||p.scope==='single-page','Selection authorizes only one page, not whole-host implementation.');
  assert(p.producer&&Array.isArray(p.outputs)&&p.outputs.length&&Array.isArray(p.reused)&&Array.isArray(p.adapted)&&Array.isArray(p.limitations),'Implementation submission incomplete.');
  assert(!(p.nativePreview&&p.previewUrl),'Choose nativePreview or H5 previewUrl, not both.');
  if(p.nativePreview) {
    assert(p.nativePreview.distFiles&&p.nativePreview.screenshot?.sha256,'Use nativePreview returned by prepare-selected-code-comparison.');
    p.nativePreview=validateNativePreview(root,state,p.nativePreview);
  } else localPreview(p.previewUrl);
  p.verifiedRuntimeTools=verifiedTools(p.verifiedRuntimeTools);
  const comparison=localBinding(root,bind(p.comparisonFile));
  const theme=read(path.join(root,'theme-build.json'));theme.bindings.forEach(b=>localBinding(root,b));
  const outputs=filesUnder(root,p.outputs);assert(outputs.some(b=>within(state.hostRoot,b.path)),'Actual host source outputs required.');
  // Freeze the complete current source copy so review cannot silently drift.
  const source=snapshot(state.hostRoot);const all=[...outputs,comparison,...source.files.map(f=>bind(path.join(state.hostRoot,f.path)))];
  if(p.nativePreview)all.push(p.nativePreview.screenshot,...p.nativePreview.distFiles.map(f=>bind(path.join(p.nativePreview.distPath,f.path))));
  const before=new Map(state.baseline.files.map(f=>[f.path,f.sha256])),after=new Map(source.files.map(f=>[f.path,f.sha256]));
  const changedFiles=[...new Set([...before.keys(),...after.keys()])].filter(f=>before.get(f)!==after.get(f));
  save(activeAttempt(root).implementation,{...p,scope:'single-page',changedFiles,themeCompilation:bind(theme.proofFile),sourceFiles:source.files,outputs:[...new Map([...all,...theme.bindings].map(b=>[b.path,b])).values()]});
  return selectedCodeStatus(root);
}
export function recordSelectedCodeReview({root,reviewFile}) {
  const status=selectedCodeStatus(root);assert(status.status==='review-ready','Independent review is not pending.');
  const {implementation,review}=activeAttempt(root);
  const p=read(implementation),r=read(reviewFile);
  assert(r.reviewer&&r.reviewer!==p.producer&&['pass','fail'].includes(r.verdict),'Independent reviewer required.');
  assert(r.submission?.path===implementation,'Review submission mismatch.');verify(r.submission);
  assert(Array.isArray(r.observations)&&r.observations.length&&Array.isArray(r.evidence)&&r.evidence.length&&Array.isArray(r.limitations),'Actual runtime observations, evidence and limitations required.');
  r.evidence.forEach((b,i)=>{
    assert(b && typeof b==='object' && typeof b.path==='string' && path.isAbsolute(b.path) && /^[a-f0-9]{64}$/.test(b.sha256||''), `Invalid evidence[${i}]: expected {path: absolute file inside artifactRoot, sha256: SHA-256 of actual file bytes}, not a string. Keep runtime evidence outside hostRoot; correct the review and resubmit.`);
    localBinding(root,b);
  });
  if(r.verdict==='pass')assert(['visual','business','tokenRuntime','responsive'].every(k=>r.checks?.[k]===true),'All scoped runtime checks must pass.');
  if(r.verdict==='pass'&&read(selectedCodeFile(root)).nativeRuntime)assert(r.checks?.nativeRuntime===true,'Independent nativeRuntime check required; H5/proxy cannot replace native verification.');
  if(r.verdict==='pass'&&read(selectedCodeFile(root)).targetPage)assert(r.checks?.singlePageScope===true,'Independent single-page scope check required; no whole-host approval.');
  save(review,r);return selectedCodeStatus(root);
}
