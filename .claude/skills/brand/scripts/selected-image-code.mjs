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
// Omit credential/config containers by name before hashing or reading bytes.
// Package-manager configs can hold inline tokens; the isolated install must use
// its own permitted authentication, never a copied host credential.
const sensitiveNames = new Set(['.npmrc','.yarnrc','.yarnrc.yml','.pnpmrc','.netrc','_netrc','.pypirc','.aws','.ssh','.azure','.gcloud','.kube','.docker']);
const ignored = name => sensitiveNames.has(name.toLowerCase())||['.git','node_modules','dist','build','output','.next','coverage','.vite','.vite-cache','playwright-report','test-results','.codex','.claude','.agents'].includes(name)||name.startsWith('.env');
function snapshot(root, dest, prefix='', result=[], skipped=[]) {
  for (const d of fs.readdirSync(path.join(root,prefix),{withFileTypes:true})) {
    const rel=path.join(prefix,d.name), src=path.join(root,rel);
    if(ignored(d.name)) continue;
    if(d.isSymbolicLink()){skipped.push(rel);continue;}
    if(d.isDirectory()){if(dest)fs.mkdirSync(path.join(dest,rel),{recursive:true});snapshot(root,dest,rel,result,skipped);}
    else if(d.isFile()){result.push({path:rel,sha256:sha(src)});if(dest)fs.copyFileSync(src,path.join(dest,rel));}
  }
  return {files:result,skippedSymlinks:skipped};
}
function assertOriginal(state) {
  const before=state.baseline.files, now=snapshot(state.hostOriginal);
  assert(JSON.stringify(now.files)===JSON.stringify(before),'Original host changed since selection; do not claim unchanged or overwrite it.');
}
function localBinding(root,b) { verify(b);assert(within(fs.realpathSync(root),fs.realpathSync(b.path)), 'Output must stay inside the isolated run.'); return b; }
function inputs(state){state.inputs.forEach(verify);verify(state.image);verify(state.selection);assertOriginal(state);}
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
  const host=fs.statSync(target).isDirectory()?target:fs.realpathSync(path.resolve(root,read(startupPath).hostRoot));
  assert(target===host||within(host,target),'Startup source is outside its host.');
  assert(fs.existsSync(path.join(host,'package.json')),'Host package.json required.');
  const run=manage('init',{host}), out=run.buildDirectory;
  const clone=path.join(out,'host');fs.mkdirSync(clone);
  const baseline=snapshot(host,clone);
  const brandRoot=path.join(out,'brand');fs.mkdirSync(brandRoot);
  const copied=[];
  function copySource(b){verify(b);if(!within(root,path.resolve(b.path))){assert(within(host,fs.realpathSync(b.path)),'Brand input outside frozen run.');return;}const rel=path.relative(root,b.path),to=path.join(brandRoot,rel);assert(within(root,fs.realpathSync(b.path)),'Brand symlink escape.');fs.mkdirSync(path.dirname(to),{recursive:true});if(!fs.existsSync(to))fs.copyFileSync(b.path,to);if(!copied.some(x=>x.path===to))copied.push(bind(to));}
  [...dispatch.inputs,...dispatch.inputImages].forEach(copySource);
  const modFile=path.join(brandRoot,'migrations',brand,'brand-mod.json');
  const mod=read(modFile);
  // Copy declared local assets, never rediscover/re-download the source website.
  function assets(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='localPath'&&typeof x==='string'){const p=path.resolve(root,x);assert(within(root,p)&&fs.existsSync(p),`Missing declared asset: ${x}`);copySource(bind(p));}else if(typeof x==='object')assets(x);}}
  assets(mod);
  const image=path.join(out,'selected-reference'+path.extname(generation.output.path));fs.copyFileSync(generation.output.path,image);
  const selectionFile=path.join(out,'selection.json');save(selectionFile,{statement:selection,direction,image:bind(image),scope:'isolated-code-preview-only',originalHostModificationAuthorized:false});
  const pkg=read(path.join(host,'package.json')),deps={...pkg.dependencies,...pkg.devDependencies};
  const framework=deps['@tarojs/taro']?'taro':deps.react?'react':deps.vue?'vue':'unknown';
  const reusableComponents=[];
  if(framework==='react'&&!deps['react-native']) {
    const dest=path.join(out,'reusable-components','react-web-button');fs.mkdirSync(dest,{recursive:true});
    const assets=['DangoButton.tsx','usage.md'].map(name=>{const to=path.join(dest,name);fs.copyFileSync(path.join(skillRoot,'assets','react-web-button',name),to);const b=bind(to);copied.push(b);return b;});
    reusableComponents.push({id:'dango-react-web-text-button',component:assets[0],usage:assets[1],sourceVersion:'dangoui 3.6.16',scope:'Optional React Web text-only adapter; verified large primary/secondary and documented states only. Read usage and confirm actual installed version/source compatibility. Requires real library CSS plus generated theme; no Taro/icons/other-component certification.'});
  }
  const parentFailed=fs.existsSync(path.join(root,'migrations',brand,'image-concepts-failed-review.json'));
  const state={schema:'selected-image-code/v1',brand,direction,hostOriginal:host,hostRoot:clone,brandRoot,modFile,adapterFile:path.join(brandRoot,'migrations',brand,'dangoui-adapter.json'),image:bind(image),selection:bind(selectionFile),inputs:copied,baseline,framework,reusableComponents,parentRun:root,parentImageReview:parentFailed?'failed-preserved':'not-promoted',createdAt:new Date().toISOString(),fullWorkflowPass:false};
  assert(fs.existsSync(state.adapterFile),'Frozen DangoUI adapter missing.');
  save(selectedCodeFile(out),state);
  return selectedCodeStatus(out);
}
export function selectedCodeStatus(root) {
  const state=read(selectedCodeFile(root));inputs(state);
  const base={ok:true,artifactRoot:root,hostRoot:state.hostRoot,scope:'selected-image-isolated-code-preview',originalHostModified:false,fullWorkflowPass:false,hostImplementationComplete:false};
  const implementation=path.join(root,'implementation.json'), review=path.join(root,'implementation-review.json');
  if(fs.existsSync(implementation)){
    const p=read(implementation);p.outputs.forEach(b=>localBinding(root,b));
    assert(JSON.stringify(snapshot(state.hostRoot).files)===JSON.stringify(p.sourceFiles),'Implementation source inventory changed; a fresh submission/review is required.');
    if(fs.existsSync(review)){
      const r=read(review);verify(r.submission);r.evidence.forEach(b=>localBinding(root,b));
      return {...base,status:r.verdict==='pass'?'ready-for-user-review':'needs-revision',previewReady:r.verdict==='pass',userGoalCompleted:r.verdict==='pass',previewUrl:p.previewUrl,comparisonFile:p.comparisonFile,limitations:r.limitations,reviewFile:review,nextAction:r.verdict==='pass'?'Show image-versus-runtime comparison and limitations. This authorizes no original host changes; wait for explicit application approval.':'Repair only the reported isolated implementation defects; retain this review and submit a new isolated attempt.'};
    }
    return {...base,status:'review-ready',reviewRequest:{role:'host-visual-qa',reusableComponents:state.reusableComponents||[],runtimeTools,producer:p.producer,selectedImage:state.image,hostRoot:state.hostRoot,inputs:state.inputs,themeCompilation:p.themeCompilation,submission:bind(implementation),previewUrl:p.previewUrl,comparisonFile:p.comparisonFile,instructions:'Independently render the actual isolated app, inspect the selected image at the same viewport, exercise original business navigation/save/return as applicable, and trace actual DTCG→adapter→library CSS/component→computed style. Perturb a mapped token and restore it. Check narrow-screen child clipping, not only document overflow. Report reused components vs CSS vs adapted/style-only accurately. Read any bound reusable component and usage guide; check its actual import/call sites, installed-version compatibility, required-state coverage and final host CSS overrides. Historical verification is not this-run proof. For each claimed component adaptation, compare the actual source component with the host adapter in the same theme and required states; check final CSS winners, geometry and event behavior. Token color mutation alone proves only token use, not component adaptation. Disclose uncovered components and intentional differences. File presence or producer screenshots alone cannot pass. Write review evidence outside hostRoot (inside artifactRoot) so frozen source stays unchanged. No original-host edits; no rewriting image QA.',reviewShape:{reviewer:'independent identity',verdict:'pass|fail',submission:bind(implementation),checks:{visual:null,business:null,tokenRuntime:null,responsive:null},observations:[],evidence:[{path:path.join(root,"<actual-runtime-evidence-file>"),sha256:"<SHA-256 of the actual file bytes>"}],limitations:[]},recordCommand:cmd('record-selected-code-review',root,'--review','<actual-review.json>')}};
  }
  return {...base,status:'implementation-dispatch-ready',dispatchRequest:{role:'host-implementation',reusableComponents:state.reusableComponents||[],runtimeTools,framework:state.framework,hostRoot:state.hostRoot,originalHostReadOnly:state.hostOriginal,selectedImage:state.image,selection:state.selection,inputs:state.inputs,modFile:state.modFile,adapterFile:state.adapterFile,skippedSymlinks:state.baseline.skippedSymlinks,instructions:'Implement ONLY the selected full-image screen in this isolated real host copy. Inspect the image and frozen brand files; preserve real business fields, events, navigation and persistence even if the image omitted them. Do not copy a previous trial page or brand business. Read bound reusableComponents and usage guides when supplied; for applicable text buttons reuse the candidate after confirming the actual installed source/version compatibility, and record host import/call sites and edits in adapted/reused/limitations. It is optional when the brand/task needs differ; disclose non-use and uncovered scope. Identify the actual framework and reuse compatible components; incompatible Vue/React/Taro requires explicit adaptation, never a false reuse claim. Use the bound DTCG and adapter via compile-selected-theme with an actual installed DangoUI package, then import only the returned entryFile once from the host global entry and follow its integration instructions and mappedVariables list. Remove or reconnect only stale brand declarations masking those variables; preserve business styles and intentional mode/state overrides and verify their branches. Never use !important to force root values. Do not infer layout from tokens: implement the selected composition. For claimed component adaptation, follow the actual installed component DOM/classes, size/state styling and event contract, not a hand-styled approximation. Reuse original CSS where compatible and compare the real source component with this same host adapter in required states. Scope to this task, not a new cross-framework library. Keep existing business logic; list any necessary changes. Install dependencies using the copied lockfile/environment; never run installs through symlinks into original node_modules. Do not copy credentials. Build and run the app, take same-viewport actual screenshots and create an image-versus-runtime comparison. This dispatch is not implementation success. Continue to independent review using returned commands. No new ABC or original host modification.',commands:{compileTheme:cmd('compile-selected-theme',root,'--dangoui-root','<actual-installed-dangoui-package>'),record:cmd('record-selected-code',root,'--submission','<implementation-submission.json>'),continue:cmd('continue',root)},submissionShape:{producer:'actual implementer',previewUrl:'http://127.0.0.1:<port>/',comparisonFile:'absolute comparison html in run',outputs:['host/src/changed-file','host/src/brand/theme.css','actual-screenshot.png'],reused:[],adapted:[],limitations:[]}}};
}
export function compileSelectedTheme({root,dangouiRoot}) {
  const state=read(selectedCodeFile(root));inputs(state);
  assert(!fs.existsSync(path.join(root,'implementation.json')),'Implementation already recorded.');
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
  assert(p.producer&&Array.isArray(p.outputs)&&p.outputs.length&&Array.isArray(p.reused)&&Array.isArray(p.adapted)&&Array.isArray(p.limitations),'Implementation submission incomplete.');
  const url=new URL(p.previewUrl);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&['http:','https:'].includes(url.protocol),'Local preview URL required.');
  const comparison=localBinding(root,bind(p.comparisonFile));
  const theme=read(path.join(root,'theme-build.json'));theme.bindings.forEach(b=>localBinding(root,b));
  const outputs=filesUnder(root,p.outputs);assert(outputs.some(b=>within(state.hostRoot,b.path)),'Actual host source outputs required.');
  // Freeze the complete current source copy so review cannot silently drift.
  const source=snapshot(state.hostRoot);const all=[...outputs,comparison,...source.files.map(f=>bind(path.join(state.hostRoot,f.path)))];
  save(path.join(root,'implementation.json'),{...p,themeCompilation:bind(theme.proofFile),sourceFiles:source.files,outputs:[...new Map([...all,...theme.bindings].map(b=>[b.path,b])).values()]});
  return selectedCodeStatus(root);
}
export function recordSelectedCodeReview({root,reviewFile}) {
  const status=selectedCodeStatus(root);assert(status.status==='review-ready','Independent review is not pending.');
  const p=read(path.join(root,'implementation.json')),r=read(reviewFile);
  assert(r.reviewer&&r.reviewer!==p.producer&&['pass','fail'].includes(r.verdict),'Independent reviewer required.');
  assert(r.submission?.path===path.join(root,'implementation.json'),'Review submission mismatch.');verify(r.submission);
  assert(Array.isArray(r.observations)&&r.observations.length&&Array.isArray(r.evidence)&&r.evidence.length&&Array.isArray(r.limitations),'Actual runtime observations, evidence and limitations required.');
  r.evidence.forEach((b,i)=>{
    assert(b && typeof b==='object' && typeof b.path==='string' && path.isAbsolute(b.path) && /^[a-f0-9]{64}$/.test(b.sha256||''), `Invalid evidence[${i}]: expected {path: absolute file inside artifactRoot, sha256: SHA-256 of actual file bytes}, not a string. Keep runtime evidence outside hostRoot; correct the review and resubmit.`);
    localBinding(root,b);
  });
  if(r.verdict==='pass')assert(['visual','business','tokenRuntime','responsive'].every(k=>r.checks?.[k]===true),'All scoped runtime checks must pass.');
  save(path.join(root,'implementation-review.json'),r);return selectedCodeStatus(root);
}
