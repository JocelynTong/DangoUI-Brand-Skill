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
  if(framework==='react'&&!deps['react-native']) {
    const dest=path.join(out,'reusable-components','react-web-button');fs.mkdirSync(dest,{recursive:true});
    const assets=['DangoButton.tsx','usage.md'].map(name=>{const to=path.join(dest,name);fs.copyFileSync(path.join(skillRoot,'assets','react-web-button',name),to);const b=bind(to);copied.push(b);return b;});
    reusableComponents.push({id:'dango-react-web-text-button',component:assets[0],usage:assets[1],sourceVersion:'dangoui 3.6.16',scope:'Optional React Web text-only adapter; verified large primary/secondary and documented states only. Read usage and confirm actual installed version/source compatibility. Requires real library CSS plus generated theme; no Taro/icons/other-component certification.'});
  }
  const parentFailed=Boolean(failed&&!superseded);
  const state={schema:'selected-image-code/v1',brand,direction,hostOriginal:host,hostRoot:clone,brandRoot,modFile,adapterFile:path.join(brandRoot,'migrations',brand,'dangoui-adapter.json'),image:bind(image),selection:bind(selectionFile),inputs:copied,baseline,baselinePolicy,framework,reusableComponents,parentRun:root,parentImageReview:parentFailed?'failed-preserved':'not-promoted',createdAt:new Date().toISOString(),fullWorkflowPass:false};
  assert(fs.existsSync(state.adapterFile),'Frozen DangoUI adapter missing.');
  state.targetPage=targetPage;
  state.conceptReviewNotes=conceptReviewNotes;
  state.historicalConceptReviews=historicalConceptReviews;
  save(selectedCodeFile(out),state);
  return selectedCodeStatus(out);
}
export function selectedCodeStatus(root) {
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
    return {...base,status:'review-ready',reviewRequest:{role:'host-visual-qa',selectedArtwork,targetPage:state.targetPage||null,conceptReviewNotes:state.conceptReviewNotes||[],changedFiles:p.changedFiles||[],scope:'single-page',reusableComponents:state.reusableComponents||[],runtimeTools,producer:p.producer,selectedImage:state.image,hostRoot:state.hostRoot,inputs:state.inputs,themeCompilation:p.themeCompilation,submission:bind(implementation),previewUrl:p.previewUrl,comparisonFile:p.comparisonFile,instructions:'Independently verify only the frozen target page and its necessary shared dependencies, not every route. Check changedFiles for unauthorized unrelated-page work; shared theme/import edits are allowed for this page, but their effects on untested pages are limitations, not whole-site certification. Read conceptReviewNotes for unresolved findings, without redoing image QA. Use real host options for any unconfirmed image labels. Independently render the actual isolated app, inspect the selected image at the same viewport, exercise original business navigation/save/return as applicable, and trace actual DTCG→adapter→library CSS/component→computed style. Perturb a mapped token and restore it. Check narrow-screen child clipping, not only document overflow. Report reused components vs CSS vs adapted/style-only accurately. Read any bound reusable component and usage guide; check its actual import/call sites, installed-version compatibility, required-state coverage and final host CSS overrides. Historical verification is not this-run proof. For each claimed component adaptation, compare the actual source component with the host adapter in the same theme and required states; check final CSS winners, geometry and event behavior. Token color mutation alone proves only token use, not component adaptation. Disclose uncovered components and intentional differences. File presence or producer screenshots alone cannot pass. Write review evidence outside hostRoot (inside artifactRoot) so frozen source stays unchanged. No original-host edits; no rewriting image QA.',reviewShape:{reviewer:'independent identity',verdict:'pass|fail',submission:bind(implementation),checks:{visual:null,business:null,tokenRuntime:null,responsive:null,...(state.targetPage?{singlePageScope:null}:{})},observations:[],evidence:[{path:path.join(root,"<actual-runtime-evidence-file>"),sha256:"<SHA-256 of the actual file bytes>"}],limitations:[]},recordCommand:cmd('record-selected-code-review',root,'--review','<actual-review.json>')}};
  }
  return {...base,status:'implementation-dispatch-ready',dispatchRequest:{role:'host-implementation',recovery,selectedArtwork,targetPage:state.targetPage||null,conceptReviewNotes:state.conceptReviewNotes||[],scope:'single-page',reusableComponents:state.reusableComponents||[],runtimeTools,framework:state.framework,hostRoot:state.hostRoot,originalHostReadOnly:state.hostOriginal,selectedImage:state.image,selection:state.selection,inputs:state.inputs,modFile:state.modFile,adapterFile:state.adapterFile,skippedSymlinks:state.baseline.skippedSymlinks,instructions:'Implement ONLY targetPage in this isolated real host copy. Shared theme imports and direct dependencies may change as necessary; do not reskin other pages, add routes, or scan the whole application. Read conceptReviewNotes for unresolved findings. Unconfirmed labels in the image are not business requirements: use host-supported options. Stop after independent runtime QA and present this page for user confirmation; no whole-host rollout. Inspect the image and frozen brand files; preserve real business fields, events, navigation and persistence even if the image omitted them. Do not copy a previous trial page or brand business. Read bound reusableComponents and usage guides when supplied; for applicable text buttons reuse the candidate after confirming the actual installed source/version compatibility, and record host import/call sites and edits in adapted/reused/limitations. It is optional when the brand/task needs differ; disclose non-use and uncovered scope. Identify the actual framework and reuse compatible components; incompatible Vue/React/Taro requires explicit adaptation, never a false reuse claim. Use the bound DTCG and adapter via compile-selected-theme with an actual installed DangoUI package, then import only the returned entryFile once from the host global entry and follow its integration instructions and mappedVariables list. Remove or reconnect only stale brand declarations masking those variables; preserve business styles and intentional mode/state overrides and verify their branches. Never use !important to force root values. Do not infer layout from tokens: implement the selected composition. For claimed component adaptation, follow the actual installed component DOM/classes, size/state styling and event contract, not a hand-styled approximation. Reuse original CSS where compatible and compare the real source component with this same host adapter in required states. Scope to this task, not a new cross-framework library. Keep existing business logic; list any necessary changes. Install dependencies using the copied lockfile/environment; never run installs through symlinks into original node_modules. Do not copy credentials. Build and run the app, take same-viewport actual screenshots and create an image-versus-runtime comparison. This dispatch is not implementation success. Continue to independent review using returned commands. No new ABC or original host modification.',commands:{compileTheme:cmd('compile-selected-theme',root,'--dangoui-root','<actual-installed-dangoui-package>'),record:cmd('record-selected-code',root,'--submission','<implementation-submission.json>'),continue:cmd('continue',root)},submissionShape:{producer:'actual implementer',previewUrl:'http://127.0.0.1:<port>/',comparisonFile:'absolute comparison html in run',outputs:['host/src/changed-file','host/src/brand/theme.css','actual-screenshot.png'],reused:[],adapted:[],limitations:[]}}};
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
  const result=compileHostTheme({modFile:state.modFile,adapterFile:state.adapterFile,dangouiRoot,outputDir});
  const record={...result,bindings:[result.themeFile,result.runtimeStyleFile,result.entryFile,result.proofFile].map(bind)};
  fs.writeFileSync(path.join(root,'theme-build.json'),JSON.stringify(record,null,2)+'\n');return record;
}
export function recordSelectedCode({root,submissionFile}) {
  const state=read(selectedCodeFile(root));inputs(state);const p=read(submissionFile);
  assert(!p.scope||p.scope==='single-page','Selection authorizes only one page, not whole-host implementation.');
  assert(p.producer&&Array.isArray(p.outputs)&&p.outputs.length&&Array.isArray(p.reused)&&Array.isArray(p.adapted)&&Array.isArray(p.limitations),'Implementation submission incomplete.');
  const url=new URL(p.previewUrl);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&['http:','https:'].includes(url.protocol),'Local preview URL required.');
  const comparison=localBinding(root,bind(p.comparisonFile));
  const theme=read(path.join(root,'theme-build.json'));theme.bindings.forEach(b=>localBinding(root,b));
  const outputs=filesUnder(root,p.outputs);assert(outputs.some(b=>within(state.hostRoot,b.path)),'Actual host source outputs required.');
  // Freeze the complete current source copy so review cannot silently drift.
  const source=snapshot(state.hostRoot);const all=[...outputs,comparison,...source.files.map(f=>bind(path.join(state.hostRoot,f.path)))];
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
  if(r.verdict==='pass'&&read(selectedCodeFile(root)).targetPage)assert(r.checks?.singlePageScope===true,'Independent single-page scope check required; no whole-host approval.');
  save(review,r);return selectedCodeStatus(root);
}
