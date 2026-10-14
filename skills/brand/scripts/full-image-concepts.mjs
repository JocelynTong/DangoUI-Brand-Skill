import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { manage } from './brand-artifacts.mjs';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {flag:'wx'});
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const binding = file => ({path:path.resolve(file), sha256:hash(file)});
export const imageConceptFile = (root, brand) => path.join(root,'migrations',brand,'image-concepts.json');
const conceptScope = {
  expressive:'Original task-appropriate Expressive subjects, imagery and depth are permitted proposals, not claims of official source assets. A plain documentation reference is not a brand-wide ban on illustration or depth. Distinguish actual source prohibitions from absence in one screenshot.',
  productive:'Keep applicable source typography, controls, semantic roles and readable task surfaces. Evaluate deviations at concept-selection impact, not runtime or pixel certification; disclose harmless localized departures.',
  business:'Use current bound host source and necessary imports/data plus explicit user facts. Verify labels, navigation, actions, actual availability conditions and internally consistent counts/states. Do not infer sequential locks, ranking or new abilities from a visual metaphor or old review. Unknown facts remain unknown.'
};

function references(value, found = new Set()) {
  if (typeof value === 'string' && /\.(png|jpe?g|webp)$/i.test(value)) found.add(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(v => references(v, found));
  return [...found];
}

export function prepareImageConcepts({root, brand, hostTarget, sampleData=false, regeneration}) {
  const file=imageConceptFile(root,brand), dir=path.dirname(file);
  if (fs.existsSync(file)) return imageConceptDelivery({root,brand});
  assert(!fs.existsSync(path.join(dir,'execution-manifest.json')), 'Existing H5 history is immutable; create a fresh isolated run for image concepts.');
  const inputNames=['brand-mod.json','brand-evidence.json','brand-intent.json','component-mapping.json','dangoui-adapter.json','host-startup-page.json'];
  const inputs=inputNames.map(name=>path.join(dir,name)).filter(fs.existsSync).map(binding);
  for (const name of ['brand-mod.json','brand-evidence.json','brand-intent.json','host-startup-page.json']) assert(inputs.some(x=>path.basename(x.path)===name), `Missing required input ${name}`);
  const startup=read(path.join(dir,'host-startup-page.json'));
  const source=path.resolve(root,startup.hostRoot,startup.sourceFile);
  assert(fs.existsSync(source)&&hash(source)===startup.sourceSha256,'Host startup source changed or is unavailable.');
  inputs.push(binding(source));
  const mod=read(path.join(dir,'brand-mod.json'));
  // Embedded DTCG is already part of the bound MOD. Bind actual declared kit
  // source files too, rather than leaving the consumer with paths in prose.
  for(const kit of mod.componentKits||[]) for(const declared of kit.files||[]) {
    const p=path.resolve(root,declared.path);
    assert(fs.existsSync(p)&&(!declared.sha256||hash(p)===declared.sha256),`Missing/changed component kit original: ${p}`);
    if(!inputs.some(x=>x.path===p)) inputs.push(binding(p));
  }
  const candidates=[...new Set(inputs.filter(x=>x.path.endsWith('.json')).flatMap(x=>references(read(x.path))))]
    .map(p=>path.resolve(root,p)).filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  const screens=candidates.filter(p=>/frames|screenshots|captures/i.test(p));
  // General pages anchor site language; functional database similarity is not brand authority.
  screens.sort((a,b)=>Number(!/home|landing|editorial/i.test(a))-Number(!/home|landing|editorial/i.test(b)));
  const assets=candidates.filter(p=>!screens.includes(p));
  const first=screens[0];
  const complementary=screens.filter(p=>p!==first&&!/card-database|database/i.test(p)).sort((a,b)=>Number(!/editorial|scroll-[1-9]/i.test(a))-Number(!/editorial|scroll-[1-9]/i.test(b)))[0]||screens[1];
  // Built-in ImageGen accepts at most five reference images. Prefer a campaign
  // and a complementary editorial frame, not adjacent opening-animation frames.
  assets.sort((a,b)=>Number(/logo|icon|badge/i.test(a))-Number(/logo|icon|badge/i.test(b))||Number(!/art|hero|character/i.test(a))-Number(!/art|hero|character/i.test(b)));
  const selectedScreens=[first,complementary].filter(Boolean);
  const inputImages=[...selectedScreens.map(p=>({...binding(p),role:'official-page-design-language'})),...assets.slice(0,3).map(p=>({...binding(p),role:'official-asset-reference'}))];
  assert(screens.length>=2,'Complete image concepts require at least two official page screenshots; repair missing package originals, do not silently use one database image.');
  const commonPrompt='Create ONE complete cohesive high-fidelity application screen, no device frame, using the same explicitly stated viewport as the other two concepts. Design the entire finished screen together. This is an IMAGE mockup, not a background awaiting HTML panels. 无需识别或命名角色，直接依据所给参考图和素材的可见内容生成。 Official screenshots supply typography, color roles, spacing, shapes and visual composition vocabulary ONLY. Do not copy their product names, navigation, business fields, utility controls or status indicators into the host. Include only host-supported controls. The target business and visible copy must be stated explicitly in the final prompt; image generation cannot read source files. Preserve business facts, not the existing page order or DOM layout. '+(sampleData?'Clearly mark illustrative records as 示例数据.':'Do not invent live business records; use schema/loading states where no records are supplied.');
  const directions=['a','b','c'].map(id=>({id,visualDirection:`Develop direction ${id.toUpperCase()} from the host experience and brand evidence. Give it a memorable visual idea, not merely a different layout; differentiate its focal subject, composition and expressive treatment from the other directions without inventing business meaning.`,prompt:`${commonPrompt}\nKeep Productive typography, control shapes, color roles and readability grounded in the brand system. Expressive imagery and composition may be original task-appropriate proposals, clearly distinguished from observed source rules. A documentation screenshot is not a blanket aesthetic ceiling. Preserve actual brand prohibitions, but do not invent universal bans on imagery, depth or visual effects simply because they are absent from a reference.`,referenced_image_paths:inputImages.map(x=>x.path),outputPath:path.join(dir,'image-concepts',`${id}.png`)}));
  fs.mkdirSync(path.join(dir,'image-concepts'),{recursive:true});
  const dispatch={schema:'brand-full-image-dispatch/v1',medium:'full-image',brand,hostTarget,inputs,inputImages,directions,sampleData,producerInstructions:'Read the bound host and brand inputs, inspect reference images, and enrich each prompt with concrete official language and the SAME real host task. Call built-in image_gen once per direction using the actual bound image references. Save original tool arguments/results; do not generate H5 or modify the host. Independent reviewer must view all three full output images before receipt.',receiptShape:{producer:'actual producer identity',directions:[{id:'a|b|c',path:'absolute actual raster path',tool:'image_gen',toolCallId:'actual call ID',prompt:'exact actual tool prompt',inputImages:[{path:'absolute input path',sha256:'actual hash'}]}],independentReview:{reviewer:'different actual identity',verdict:'pass',directions:[{id:'a|b|c',sha256:'reviewed output hash',completeScreen:true,brandFaithful:true,hostTaskPreserved:true}],distinctCompositions:true,notes:'actual observed visual findings'}}};
  dispatch.producerInstructions='Direction prompts are scaffolds, NOT tool-ready prompts. Read the bound host source and relevant startup components/data; include the actual labels and states of any journey/list nodes you render, rather than inventing them from an aggregate count. In each actual image_gen prompt include: (1) identical concrete host purpose, role/state, navigation, facts, labels/actions and sample data; (2) applicable Productive typography, control shapes, color roles and spacing distilled from bound design inputs; (3) the same explicit viewport chosen from user request or host context; (4) a task-appropriate Expressive visual idea, its first-look focal subject and its relationship to the real task. Separate observed brand constraints from original design proposals. Three directions must explore different visual ideas/treatments and compositions, not only alternate reading paths. Do not extrapolate a plain documentation page into an unsupported brand-wide prohibition; equally, do not add arbitrary spectacle or discard genuine brand restrictions. Inspect reference coverage: desktop/mobile of one page are not complementary expressive evidence; use what is actually supplied and disclose that limit, never pretend additional imagery is official. Same business does NOT mean same layout: reorganize without inventing capabilities, statuses or ranking. Exclude source-site utility controls and business fields absent from the host. Attach frozen official images, never earlier candidate outputs. Preserve the reference-fidelity sentence. Save exact arguments and checkpoint each real output. Static images do not demonstrate animation; any motion idea remains unvalidated until a later authorized interactive stage. No H5 or host edits.';
  const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
  dispatch.commands={record:[process.execPath,entry,'record-image-concepts','--artifact-root',root,'--brand',brand,'--receipt',path.join(dir,'image-concepts-submission.json')],delivery:[process.execPath,entry,'delivery','--artifact-root',root,'--brand',brand],continue:[process.execPath,entry,'continue','--artifact-root',root,'--brand',brand]};
  dispatch.designSystemInputs={dtcg:{path:path.join(dir,'brand-mod.json'),jsonPointer:'/tokens/dtcg'},mapping:inputs.filter(x=>/component-mapping|dangoui-adapter/.test(x.path)),componentSources:inputs.filter(x=>/\.(vue|css|mjs|md)$/.test(x.path)&&x.path!==source),note:'Read the embedded DTCG and actual declared component sources. This image phase visualizes those constraints; it does not claim runtime component reuse.'};
  if(regeneration) {
    dispatch.regeneration=regeneration;
    dispatch.producerInstructions+=' This is an explicitly requested NEW batch. Apply regeneration.feedback and inspect priorDirections only to avoid repeating rejected visual ideas, never as official image references. Preserve the same host facts and brand constraints. Generate three new complete images, do not copy prior outputs. Preserve all prior failures; this batch requires its own independent review.';
  }
  dispatch.conceptScope=conceptScope;
  const dispatchFile=path.join(dir,'image-concepts-dispatch.json');write(dispatchFile,dispatch);
  write(file,{schema:'brand-full-image-concepts/v1',brand,hostTarget,medium:'full-image',dispatch:binding(dispatchFile),status:'dispatch-ready',userGoalCompleted:false,hostFilesModified:false,...(regeneration?{parentRun:regeneration.parentRun,feedback:regeneration.feedback}: {})});
  return imageConceptDelivery({root,brand});
}

// Fork inputs, not workflow state. A new user request is distinct from resuming
// missing images or retrying a failed checkpoint in the old immutable batch.
export function regenerateImageConcepts({root,brand,feedback,confirmed=false,failedOnly=false}) {
  assert(confirmed&&typeof feedback==='string'&&feedback.trim(),'Explicit new-batch request and user feedback required.');
  assert(/^[a-z0-9][a-z0-9-]*$/.test(brand||''),'Invalid brand.');
  root=fs.realpathSync(root);
  const parentFile=imageConceptFile(root,brand),state=read(parentFile);
  verifyBinding(state.dispatch);
  const dispatch=read(state.dispatch.path);
  [...dispatch.inputs,...dispatch.inputImages].forEach(verifyBinding);
  const prior=checkpoints(root,brand);
  assert(prior.length===3,'New batch requires three existing images; continue the current batch to generate missing directions.');
  let repair;
  if(failedOnly) {
    assert(!dispatch.regeneration?.repair,'One bounded correction only; preserve this failed correction.');
    const reviewBinding=binding(path.join(path.dirname(parentFile),'image-concepts-failed-review.json'));
    const review=read(reviewBinding.path);
    assert(review.verdict==='fail'&&review.reviewer&&!prior.some(d=>d.producer===review.reviewer),'Independent failed review required.');
    assert(review.directions?.length===3&&new Set(review.directions.map(q=>q.id)).size===3,'Complete per-direction failure findings required.');
    for(const d of prior) assert(review.directions.some(q=>q.id===d.id&&q.sha256===d.output.sha256&&['completeScreen','brandFaithful','hostTaskPreserved'].every(k=>typeof q[k]==='boolean')),'Explicit hash-bound pass/fail fields required.');
    const frozen=review.directions.filter(q=>q.completeScreen&&q.brandFaithful&&q.hostTaskPreserved);
    assert(frozen.length<3,'Group-only failure needs explicit direction findings; do not guess which image to redo.');
    repair={review:reviewBinding,frozenIds:frozen.map(q=>q.id)};
  }
  const startup=read(dispatch.inputs.find(x=>path.basename(x.path)==='host-startup-page.json').path);
  const source=path.resolve(root,startup.hostRoot,startup.sourceFile);
  assert(hash(source)===startup.sourceSha256,'Host startup source changed; refresh host inputs explicitly before a new batch.');
  const host=path.resolve(root,startup.hostRoot);
  const sources=new Map([...dispatch.inputs,...dispatch.inputImages].map(x=>[x.path,x]));
  // Include declared source originals required by later consumers, never old
  // generated images, checkpoints, receipts or QA state.
  const mod=read(dispatch.inputs.find(x=>path.basename(x.path)==='brand-mod.json').path);
  const collect=v=>{if(!v||typeof v!=='object')return; if(typeof v.localPath==='string') {const p=path.resolve(root,v.localPath);const b=binding(p);if(v.sha256)assert(b.sha256===v.sha256,`Changed declared asset: ${p}`);sources.set(p,b);}Object.values(v).filter(x=>x&&typeof x==='object').forEach(collect);};collect(mod);
  const local=[];
  for(const b of sources.values()) {
    verifyBinding(b);
    assert(!fs.lstatSync(b.path).isSymbolicLink(),'Frozen input symlink must be resolved before starting a new batch.');
    const rel=path.relative(root,fs.realpathSync(b.path));
    if(rel.startsWith('..'+path.sep)||path.isAbsolute(rel)) continue;
    assert(fs.realpathSync(b.path).startsWith(root+path.sep),'Frozen input symlink escapes parent run.');
    assert(!/image-concepts(?:\/|-|\.json)/.test(rel),'Generated outputs cannot be reused as source inputs.');
    if(b.path.endsWith('.json')&&path.basename(b.path)!=='host-startup-page.json') {
      const absoluteRefs=v=>typeof v==='string'?(path.isAbsolute(v)&&v.startsWith(root+path.sep)) : v&&typeof v==='object'&&Object.values(v).some(absoluteRefs);
      assert(!absoluteRefs(read(b.path)),'Absolute parent-local references require a portable brand input before a new batch.');
    }
    local.push({b,rel});
  }
  const run=manage('init',{host}),out=run.buildDirectory;
  for(const {b,rel} of local){const target=path.join(out,rel);fs.mkdirSync(path.dirname(target),{recursive:true});if(path.basename(b.path)==='host-startup-page.json')write(target,{...startup,hostRoot:host});else {fs.copyFileSync(b.path,target);assert(hash(target)===b.sha256,'Copied input hash mismatch.');}}
  const regeneration={parentRun:root,parentDispatch:state.dispatch,parentState:binding(parentFile),feedback:feedback.trim(),priorDirections:prior.map(d=>({id:d.id,output:d.output,prompt:d.prompt,role:'previous-proposal-not-brand-evidence'}))};
  if(repair) {
    regeneration.repair=repair;
    for(const d of prior.filter(d=>repair.frozenIds.includes(d.id))) {
      const dir=path.join(out,'migrations',brand,'image-concepts');fs.mkdirSync(dir,{recursive:true});
      const output=path.join(dir,`${d.id}.png`),args=path.join(dir,`${d.id}-frozen-args.json`);
      fs.copyFileSync(d.output.path,output);fs.copyFileSync(d.arguments.path,args);
      write(path.join(dir,`${d.id}-generation.json`),{...d,path:output,output:binding(output),arguments:binding(args)});
    }
  }
  return {artifactRoot:out,...prepareImageConcepts({root:out,brand,hostTarget:state.hostTarget,sampleData:dispatch.sampleData,regeneration})};
}

// Reuse only hash-bound approvals. New images still pass the unchanged full gate.
function frozenReviews(dispatch) {
  const r=dispatch.regeneration?.repair;if(!r)return [];
  verifyBinding(r.review);verifyBinding(dispatch.regeneration.parentDispatch);
  const parent=read(dispatch.regeneration.parentDispatch.path);
  [...parent.inputs,...parent.inputImages].forEach(verifyBinding);
  const review=read(r.review.path);
  return r.frozenIds.map(id=>{
    const q=review.directions.find(q=>q.id===id),old=dispatch.regeneration.priorDirections.find(d=>d.id===id);
    verifyBinding(old.output);
    assert(q?.sha256===old.output.sha256&&q.completeScreen===true&&q.brandFaithful===true&&q.hostTaskPreserved===true,'Frozen approval changed.');
    return q;
  });
}

function mergeRepairReview(review,dispatch) {
  const frozen=frozenReviews(dispatch);if(!dispatch.regeneration?.repair)return review;
  const changed=dispatch.directions.filter(d=>!frozen.some(q=>q.id===d.id));
  assert(review.directions?.length===changed.length&&changed.every(d=>review.directions.filter(q=>q.id===d.id).length===1),'Review only changed directions; frozen approvals cannot be replaced.');
  const prior=read(dispatch.regeneration.repair.review.path);
  return {...review,directions:[...review.directions,...frozen],reusedReview:dispatch.regeneration.repair.review,
    limitations:[...(prior.limitations||[]),...(review.limitations||[])],presentationRequirements:[...(prior.presentationRequirements||[]),...(review.presentationRequirements||[])]};
}

function verifyBinding(item) { assert(item&&fs.existsSync(item.path)&&hash(item.path)===item.sha256,`Input/output hash mismatch: ${item?.path}`); }
function checkpoints(root, brand) {
  return ['a','b','c'].map(id=>path.join(root,'migrations',brand,'image-concepts',`${id}-generation.json`))
    .filter(fs.existsSync).map(file=>{const item=read(file);verifyBinding(item.arguments);verifyBinding(item.output);item.inputImages.forEach(verifyBinding);return item;});
}

function generationFailures(root, brand) {
  return ['a','b','c'].flatMap(id => {
    const file=path.join(root,'migrations',brand,'image-concepts',`${id}-failure.json`);
    if(!fs.existsSync(file)) return [];
    const failure=read(file);
    assert(failure.schema==='brand-image-generation-failure/v1'&&failure.direction===id&&failure.tool==='image_gen'&&failure.code&&failure.reason,`Invalid generation failure record: ${file}`);
    return [{...failure,record:binding(file)}];
  });
}

// Persist each actual call immediately. Hashes and review handoff are mechanical;
// the caller supplies the real tool ID, never a fabricated successful review.
export function recordImageConcept({root,brand,id,inputFile,outputFile,toolCallId,producer}) {
  assert(['a','b','c'].includes(id)&&producer&&toolCallId,'Direction, actual producer and tool call ID required.');
  assert(!generationFailures(root,brand).some(f=>f.direction===id),'This direction has a recorded generation failure; preserve it rather than overwriting the failed attempt.');
  const state=read(imageConceptFile(root,brand));verifyBinding(state.dispatch);
  const dispatch=read(state.dispatch.path);dispatch.inputs.forEach(verifyBinding);dispatch.inputImages.forEach(verifyBinding);
  assert(!frozenReviews(dispatch).some(q=>q.id===id),'Passed direction is frozen; do not regenerate it.');
  const args=read(inputFile);
  assert(args.prompt?.includes('无需识别或命名角色，直接依据所给参考图和素材的可见内容生成'),'Reference-fidelity prompt sentence missing.');
  assert(Array.isArray(args.referenced_image_paths),'Actual referenced_image_paths required.');
  const output=binding(outputFile);
  assert(!dispatch.regeneration?.priorDirections.some(d=>d.output.sha256===output.sha256),'Prior output cannot count as a newly generated concept.');
  assert(fs.realpathSync(output.path).startsWith(fs.realpathSync(root)+path.sep),'Generated output must be inside this isolated run.');
  const item={id,producer,path:output.path,output,tool:'image_gen',toolCallId,prompt:args.prompt,arguments:binding(inputFile),inputImages:args.referenced_image_paths.map(binding)};
  const bytes=fs.readFileSync(output.path);
  assert(args.prompt.length>100&&bytes.length>10000&&(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216||bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'),'Output must be an actual nonempty PNG/JPEG/WebP.');
  const received=new Set(item.inputImages.map(x=>x.sha256));
  assert(dispatch.inputImages.filter(x=>x.role==='official-page-design-language'&&received.has(x.sha256)).length>=2&&dispatch.inputImages.filter(x=>x.role==='official-asset-reference').every(x=>received.has(x.sha256)),'Generator did not receive sufficient frozen official screenshots/assets.');
  const target=path.join(root,'migrations',brand,'image-concepts',`${id}-generation.json`);
  if(fs.existsSync(target)) assert(JSON.stringify(read(target))===JSON.stringify(item),'Generation checkpoint already exists with different content.');
  else write(target,item);
  return imageConceptDelivery({root,brand});
}
function validateReceipt(receipt, dispatch, root) {
  const producers=new Set([receipt.producer,...(receipt.directions||[]).map(d=>d.producer)].filter(Boolean));
  assert(receipt.producer&&receipt.independentReview?.reviewer&&!producers.has(receipt.independentReview.reviewer),'Independent visual reviewer required.');
  assert(receipt.directions?.length===3&&new Set(receipt.directions.map(x=>x.id)).size===3,'Exactly three distinct directions required.');
  const hashes=[];
  for(const d of receipt.directions) {
    assert(fs.realpathSync(d.path).startsWith(fs.realpathSync(root)+path.sep),'Generated output must be inside this isolated run.');
    assert(['a','b','c'].includes(d.id)&&d.tool==='image_gen'&&d.toolCallId&&d.prompt?.length>100,'Actual ImageGen call and complete prompt required for each direction.');
    assert(d.prompt.includes('无需识别或命名角色，直接依据所给参考图和素材的可见内容生成'),'Reference-fidelity prompt sentence missing.');
    const bytes=fs.readFileSync(d.path);
    assert(bytes.length>10000&&(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216||bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'),'Output must be an actual nonempty PNG/JPEG/WebP, not HTML or a receipt.');
    const digest=hash(d.path);hashes.push(digest);
    const frozen=frozenReviews(dispatch).find(q=>q.id===d.id);
    if(frozen) assert(frozen.sha256===digest,'Frozen output changed.');
    else assert(!dispatch.regeneration?.priorDirections.some(p=>p.output.sha256===digest),'Prior output cannot count as a newly generated concept.');
    assert(d.inputImages?.length>=2,'Actual image inputs required.');
    d.inputImages.forEach(verifyBinding);
    const received=new Set(d.inputImages.map(x=>x.sha256));
    assert(dispatch.inputImages.filter(x=>x.role==='official-page-design-language'&&received.has(x.sha256)).length>=2&&dispatch.inputImages.filter(x=>x.role==='official-asset-reference').every(x=>received.has(x.sha256)),'Generator did not receive sufficient frozen official screenshots/assets.');
    const qa=receipt.independentReview.directions?.find(x=>x.id===d.id);
    assert(qa?.sha256===digest&&qa.completeScreen===true&&qa.brandFaithful===true&&qa.hostTaskPreserved===true,'Independent review must bind and approve each actual complete screen.');
  }
  assert(new Set(hashes).size===3,'Three copies of the same image are not three concepts.');
  assert(receipt.independentReview.verdict==='pass'&&receipt.independentReview.distinctCompositions===true&&receipt.independentReview.notes,'Independent review of visual differences required.');
}

function verifyReassessment(receipt, failedFile) {
  const review=receipt.independentReview;
  if(!fs.existsSync(failedFile)) {
    assert(!review.supersedesFailedReview,'Cannot supersede a failed review that does not exist.');
    return;
  }
  const prior=review.supersedesFailedReview;
  assert(prior&&typeof review.reassessmentReason==='string'&&review.reassessmentReason.trim(),'An explicit failed-review binding and reassessmentReason are required; preserve the prior FAIL.');
  verifyBinding(prior);
  assert(fs.realpathSync(prior.path)===fs.realpathSync(failedFile),'Reassessment must bind this run’s recorded failed review.');
  const failed=read(failedFile);
  assert(failed.verdict==='fail'&&failed.directions?.length===3,'Invalid prior failed review.');
  assert(receipt.directions.every(d=>failed.directions.some(q=>q.id===d.id&&q.sha256===hash(d.path))),'Reassessment must review the same images as the failed review.');
}

export function recordImageConcepts({root,brand,receiptFile,reviewFile}) {
  assert(generationFailures(root,brand).length===0,'Recorded generation failures prevent completed delivery.');
  const file=imageConceptFile(root,brand),state=read(file);verifyBinding(state.dispatch);
  const dispatch=read(state.dispatch.path);dispatch.inputs.forEach(verifyBinding);dispatch.inputImages.forEach(verifyBinding);
  let receipt;
  if(reviewFile) {
    const directions=checkpoints(root,brand);
    assert(directions.length===3,'Three generation checkpoints required.');
    receipt={producer:directions[0].producer,directions,independentReview:mergeRepairReview(read(reviewFile),dispatch)};
    if(receipt.independentReview.verdict==='fail') {
      const review=receipt.independentReview;
      assert(review.reviewer&&!directions.some(d=>d.producer===review.reviewer)&&review.notes,'Independent failure findings required.');
      assert(directions.every(d=>review.directions?.some(q=>q.id===d.id&&q.sha256===d.output.sha256)),'Failed review must bind actual outputs.');
      const failedFile=path.join(path.dirname(file),'image-concepts-failed-review.json');
      if(fs.existsSync(failedFile)) assert(JSON.stringify(read(failedFile))===JSON.stringify(review),'Recorded failed review is immutable. Keep the new failed report at its submitted path; the original FAIL remains blocked.');
      else write(failedFile,review);
      return imageConceptDelivery({root,brand});
    }
  } else {
    assert(!dispatch.regeneration?.repair,'Repair requires checkpointed outputs and a changed-direction review.');
    receipt=read(receiptFile);
  }
  validateReceipt(receipt,dispatch,root);
  verifyReassessment(receipt,path.join(path.dirname(file),'image-concepts-failed-review.json'));
  const target=path.join(path.dirname(file),'image-concepts-receipt.json');
  if(fs.existsSync(target)) assert(JSON.stringify(read(target))===JSON.stringify(receipt),'Recorded receipt is immutable.');
  else write(target,receipt);
  // State is derived from the immutable dispatch/receipt; delivery rechecks current bytes.
  return imageConceptDelivery({root,brand});
}

export function imageConceptDelivery({root,brand}) {
  const file=imageConceptFile(root,brand),state=read(file);verifyBinding(state.dispatch);
  const dispatch=read(state.dispatch.path);dispatch.inputs.forEach(verifyBinding);dispatch.inputImages.forEach(verifyBinding);
  const frozen=frozenReviews(dispatch);
  for(const q of frozen) assert(checkpoints(root,brand).find(d=>d.id===q.id)?.output.sha256===q.sha256,'Frozen output changed.');
  const completed=checkpoints(root,brand);
  const preview=completed.length===3?{previewAvailable:true,previewStatus:'pending',images:completed.map(d=>({id:d.id,...d.output})).sort((a,b)=>a.id.localeCompare(b.id)),comparisonPreview:{path:`/__brand_comparison__?brand=${encodeURIComponent(brand)}`,medium:'full-image'},interactive:false,limitations:[],presentationRequirements:[]}:{};
  const failures=generationFailures(root,brand);
  if(failures.length) return {...state,...preview,previewStatus:'failed',ok:false,status:'blocked',userGoalCompleted:false,generationFailures:failures,completedImages:checkpoints(root,brand).map(d=>({id:d.id,...d.output})),nextAction:'Preserve completed images and recorded tool failures. No automatic regeneration or prompt rewriting; this attempt is incomplete.'};
  const failedFile=path.join(path.dirname(file),'image-concepts-failed-review.json');
  const receiptFile=path.join(path.dirname(file),'image-concepts-receipt.json');
  if(fs.existsSync(failedFile)&&(!fs.existsSync(receiptFile)||!read(receiptFile).independentReview?.supersedesFailedReview)) return {...state,...preview,previewStatus:'failed',ok:false,status:'blocked',userGoalCompleted:false,failedReview:read(failedFile),reviewNotes:read(failedFile).notes,limitations:read(failedFile).limitations||[],presentationRequirements:read(failedFile).presentationRequirements||[],completedImages:checkpoints(root,brand).map(d=>({id:d.id,...d.output})),nextAction:'Independent review failed. Preserve this attempt; do not regenerate or declare completion automatically. A justified independent reassessment of these same images may explicitly bind supersedesFailedReview {path,sha256} and explain reassessmentReason in a new report; record it using record-image-concepts --review without overwriting the old report.'};
  if(!fs.existsSync(receiptFile)) {
    const missing=dispatch.directions.filter(d=>!completed.some(c=>c.id===d.id));
    const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
    const reviewFile=path.join(path.dirname(file),'image-concepts-review.json');
    return {...state,...preview,ok:true,status:missing.length?'dispatch-ready':'review-ready',dispatchFile:state.dispatch.path,
      completedImages:completed.map(d=>({id:d.id,...d.output})),
      dispatchRequest:missing.length?{...dispatch,directions:missing,checkpointCommand:[process.execPath,entry,'record-image-concept','--artifact-root',root,'--brand',brand,'--direction','<a|b|c>','--input','<saved exact tool args JSON>','--output','<actual image in run>','--tool-call-id','<actual tool ID>','--producer','<actual producer identity>']}:undefined,
      reviewRequest:missing.length?undefined:{images:completed.filter(d=>!frozen.some(q=>q.id===d.id)).map(d=>({id:d.id,...d.output})),frozenImages:completed.filter(d=>frozen.some(q=>q.id===d.id)).map(d=>({id:d.id,...d.output})),reviewScope:frozen.length?'Review changed images fully for business, brand and readability. Frozen images are comparison context only; do not repeat their individual review. Confirm distinctCompositions across the final trio. Submit direction findings for changed IDs only. Prior limitations remain.':undefined,inputs:dispatch.inputs,inputImages:dispatch.inputImages,regeneration:dispatch.regeneration?{feedback:dispatch.regeneration.feedback,priorDirections:dispatch.regeneration.priorDirections.map(d=>({id:d.id,output:d.output,role:'comparison-only-not-brand-evidence'}))}:undefined,producers:[...new Set(completed.map(d=>d.producer))],
        conceptScope:dispatch.conceptScope||conceptScope,
        inputPolicy:'Use only this reviewRequest, its shared conceptScope and bound images/source files, not full Skill, historical chat, production prompts or unrelated reports. Read necessary host imports/data to verify navigation, exact labels, states, routes and actions; reject invented capabilities or missing essential business. Inspect official reference images, applicable brand rules and trio differences. Omit redundant history, not evidence.',
        instructions:'View all three originals, official references and bound host facts. Check the same viewport and business content, no imported reference-site capabilities, recognizable brand language, readability, and materially different dominant regions/information order/reading paths rather than just reordered cards. If regeneration is present, compare priorDirections as previous proposals, not brand evidence; report how this batch addresses feedback and differs from the previous batch. Judge this image-concept selection stage, not implementation certification: localized color-role, spacing, font or raster deviations that do not materially impair brand recognition, business meaning, reading or direction selection should be stated in limitations and may pass. brandFaithful means recognizable and applicable at this stage, not every token or semantic role is pixel-exact. Missing or misleading business, materially drifted brand identity, unreadable core content or indistinguishable directions still fail. Explain the actual impact; a P-number alone neither blocks nor permits delivery. Do not erase binding source rules: disclose deviations and required implementation corrections. Write only the independent review JSON with concrete findings. Do not reconstruct generation records, generate images or modify the host. Preserve prior failed reports; a justified independent reassessment must explicitly bind supersedesFailedReview and explain reassessmentReason, never silently replace FAIL.',
        ...(dispatch.regeneration?.repair?{instructions:'Review changed images fully against the same frozen business and brand inputs. Missing or misleading business, unreadable core content and material brand drift still fail. At concept-selection stage, localized visual/color-role deviations without material impact on brand recognition, business, reading or direction selection may pass with explicit limitations; a P-number alone does not decide. Frozen images are comparison context only: reuse their hash-bound approvals, do not repeat individual QA. Confirm final trio distinctness. Submit only changed IDs. Do not generate images or alter the host.'}:{}),
        reviewFile,reviewShape:{reviewer:'actual independent identity',verdict:'pass or fail',directions:completed.filter(d=>!frozen.some(q=>q.id===d.id)).map(d=>({id:d.id,sha256:d.output.sha256,completeScreen:null,brandFaithful:null,hostTaskPreserved:null})),distinctCompositions:null,notes:'actual observed findings',limitations:[],presentationRequirements:[]},
        recordCommand:[process.execPath,entry,'record-image-concepts','--artifact-root',root,'--brand',brand,'--review',reviewFile]},
      nextAction:missing.length?'Generate only missing directions; checkpoint each actual call immediately with record-image-concept. Do not regenerate checkpointed images.':'Open standard comparisonPreview now as PENDING; execute only reviewRequest independently and record-image-concepts --review. Same URL refreshes to final result. Do not build custom comparison pages or claim completion before QA. No additional generation.'};
  }
  const receipt=read(receiptFile);validateReceipt(receipt,dispatch,root);verifyReassessment(receipt,failedFile);
  return {...state,previewAvailable:true,previewStatus:'approved',ok:true,status:'ready-for-user-review',userGoalCompleted:true,fullWorkflowPass:false,interactive:false,hostImplementationComplete:false,images:[...receipt.directions].sort((a,b)=>a.id.localeCompare(b.id)).map(d=>({id:d.id,...binding(d.path)})),comparisonPreview:{path:`/__brand_comparison__?brand=${encodeURIComponent(brand)}`,medium:'full-image'},reviewNotes:receipt.independentReview.notes,presentationRequirements:receipt.independentReview.presentationRequirements||[],limitations:receipt.independentReview.limitations||[],receiptFile,nextAction:'Open comparisonPreview using serve-design-host-h5.mjs with this artifact root. Show all three original images equally with review limitations; await user selection. This gallery is not a host H5 implementation.'};
}
