import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { manage } from './brand-artifacts.mjs';
import { readImageCall, verifyImageCall, requireRuntimeEvidence, literalArguments, findCurrentThreadImageCall } from './image-call-evidence.mjs';
import { declaredImageReferences } from './brand-image-references.mjs';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {flag:'wx'});
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const binding = file => ({path:path.resolve(file), sha256:hash(file)});
export const imageConceptFile = (root, brand) => path.join(root,'migrations',brand,'image-concepts.json');
// Presentation only: validate and persist the complete result before compacting.
// Original inputs and prompts stay available through the bound dispatch file.
export function compactImageConceptResult(result) {
  if(result.executableCall) {
    const {toolArguments,...compact}=result;
    return compact;
  }
  const {dispatchRequest, unverifiedPreviews, ...rest}=result;
  // The reviewer reads the complete packet once. Do not make its coordinator
  // ingest and re-serialize the same evidence on every checkpoint/status reply.
  const review=rest.reviewRequest;
  if(review?.reviewFile && Array.isArray(review.images)) {
    const bytes=Buffer.from(`${JSON.stringify(review,null,2)}\n`);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    const dir=path.join(os.tmpdir(),'brand-image-review-inputs');
    const file=path.join(dir,`${digest}.json`);
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    assert(!fs.lstatSync(dir).isSymbolicLink(),'Review packet directory must not be a symlink.');
    try { fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600}); }
    catch(error) { if(error.code!=='EEXIST') throw error; }
    assert(!fs.lstatSync(file).isSymbolicLink() && hash(file)===digest,'Frozen review packet changed; refusing stale or altered review input.');
    delete rest.reviewRequest;
    rest.reviewRequestFile={path:file,sha256:digest};
    rest.reviewDispatch={role:'independent-image-review',input:rest.reviewRequestFile,
      instruction:'Read this complete packet once and perform its independent review. Do not ask the coordinator to copy its contents. This is a pending request, not a QA pass.',
      recordCommand:[...review.recordCommand.filter(arg=>arg!=='--compact'),'--compact']};
  }
  return {...rest,...(unverifiedPreviews?{unverifiedPreviews:unverifiedPreviews.map(item=>({
    id:item.id,output:item.output,argumentsStatus:item.argumentsStatus,
    imagegenAttribution:item.imagegenAttribution,selectionAvailable:false,
    argumentError:item.argumentError,
    evidence:{callId:item.provenance.callId,logPath:item.provenance.logPath,
      eventSha256:item.provenance.eventSha256,status:item.provenance.status}
  }))}:{}),...(dispatchRequest?{
    dispatchFile:result.dispatchFile||result.dispatch?.path,
    pendingDirectionIds:dispatchRequest.directions.map(d=>d.id),
    sharedDesignBriefLocation:'Read the complete sharedDesignBrief from dispatchFile once in the executor, not in the coordinator.',
    checkpointCommand:dispatchRequest.checkpointCommand && [...dispatchRequest.checkpointCommand.filter(arg=>arg!=='--compact'),'--compact'],
    failureRecording:dispatchRequest.failureRecording,
    readDispatch:'Use the bound dispatch file for full inputs; do not reread unchanged inputs already consumed in this round.'
  }:{})};
}

// A repeated status observation must not replay the same input/review packet.
// The complete packet remains in the immutable files; this is not input pruning.
export function coordinationReply(result, since) {
  const compact=compactImageConceptResult(result);
  const revision=crypto.createHash('sha256').update(JSON.stringify(compact)).digest('hex');
  if (since===revision) return {status:result.status,unchanged:true,revision};
  const command=result.coordinationCommands?.delivery;
  return {...compact,revision,...(Array.isArray(command)?{nextStatusCommand:[...command,'--since',revision]}:{})};
}

function coordinationCommands(root, brand) {
  const scripts=path.dirname(fileURLToPath(import.meta.url));
  return {
    preview:[process.execPath,path.join(scripts,'serve-design-host-h5.mjs'),'--root',root,'--port','0'],
    delivery:[process.execPath,path.join(scripts,'run-brand-workflow.mjs'),'delivery','--artifact-root',root,'--brand',brand,'--compact'],
    policy:'Reuse the running preview server for this root. Its startup output supplies the URL; append comparisonPreview.path. Do not inspect server source or build another gallery. Pass reviewRequest once to an independent reviewer; the coordinator consumes its findings, not a duplicate visual review. Unresolved business findings remain explicit, never pass by default.'
  };
}
const conceptScope = {
  expressive:'Original task-appropriate Expressive subjects, imagery and depth are permitted proposals, not claims of official source assets. A plain documentation reference is not a brand-wide ban on illustration or depth. Distinguish actual source prohibitions from absence in one screenshot.',
  productive:'Keep applicable source typography, controls, semantic roles and readable task surfaces. Evaluate deviations at concept-selection impact, not runtime or pixel certification; disclose harmless localized departures.',
  business:'Use current bound host source and necessary imports/data plus explicit user facts. Verify labels, navigation, actions, actual availability conditions and internally consistent counts/states. For resource/help sections, state the actual visible labels and whether the section is collapsed; a section heading alone does not authorize invented child links. Use this same concrete business content for all three prompts, leaving composition and imagery free. Do not infer sequential locks, ranking or new abilities from a visual metaphor or old review. Unknown facts remain unknown.'
};

function references(value, found = new Set()) {
  if (typeof value === 'string' && /\.(png|jpe?g|webp)$/i.test(value)) found.add(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(v => references(v, found));
  return [...found];
}

function hostObservations(value, root, inherited={}) {
  if(typeof value==='string'&&/\.(png|jpe?g|webp)$/i.test(value)) {
    const file=path.resolve(root,value);
    assert(fs.existsSync(file)&&fs.statSync(file).isFile(),`Declared host observation is missing: ${file}`);
    return [{...inherited,...binding(file),role:'host-business-observation',observationScope:'historical-observation',currency:'not-revalidated'}];
  }
  if(!value||typeof value!=='object') return [];
  if(Array.isArray(value)) return value.flatMap(v=>hostObservations(v,root,inherited));
  const metadata={...inherited,...Object.fromEntries(['capturedAt','scene','scenario','source','sourceUrl','route','viewport','state','observedState'].filter(key=>value[key]!==undefined).map(key=>[key,value[key]]))};
  const fileKey=['path','localPath','screenshot'].find(key=>typeof value[key]==='string'&&/\.(png|jpe?g|webp)$/i.test(value[key]));
  if(fileKey) {
    const observations=hostObservations(value[fileKey],root,metadata);
    if(Object.hasOwn(value,'sha256')) assert(observations[0].sha256===value.sha256,`Declared host observation hash mismatch: ${observations[0].path}`);
    return observations;
  }
  return Object.entries(value).filter(([key])=>!Object.hasOwn(metadata,key)&&key!=='sha256').flatMap(([,v])=>hostObservations(v,root,metadata));
}

export function prepareImageConcepts({root, brand, hostTarget, sampleData=false, regeneration, preparationRequired=true, controlAuditRequired=false}) {
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
  // Only brand documents can confer brand-reference provenance. Host captures
  // are observation evidence, even when their filename contains `screenshots`.
  const brandInputs=inputs.filter(x=>x.path!==source&&path.basename(x.path)!=='host-startup-page.json');
  const hostImages=hostObservations(startup.visualEvidence,root);
  for(const item of hostImages) if(!inputs.some(x=>x.path===item.path)) inputs.push(binding(item.path));
  const candidates=[...new Set(brandInputs.filter(x=>x.path.endsWith('.json')).flatMap(x=>references(read(x.path))))]
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
  dispatch.controlAuditRequired=controlAuditRequired;
  const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
  dispatch.commands={record:[process.execPath,entry,'record-image-concepts','--artifact-root',root,'--brand',brand,'--receipt',path.join(dir,'image-concepts-submission.json')],delivery:[process.execPath,entry,'delivery','--artifact-root',root,'--brand',brand],continue:[process.execPath,entry,'continue','--artifact-root',root,'--brand',brand]};
  dispatch.designSystemInputs={dtcg:{path:path.join(dir,'brand-mod.json'),jsonPointer:'/tokens/dtcg'},mapping:inputs.filter(x=>/component-mapping|dangoui-adapter/.test(x.path)),componentSources:inputs.filter(x=>/\.(vue|css|mjs|md)$/.test(x.path)&&x.path!==source),note:'Read the embedded DTCG and actual declared component sources. This image phase visualizes those constraints; it does not claim runtime component reuse.'};
  if(regeneration) {
    dispatch.regeneration=regeneration;
    dispatch.producerInstructions+=regeneration.recovery
      ? ' This is an explicitly authorized recovery attempt. Preserve checkpointed images; generate ONLY missing directions returned by delivery. Apply regeneration.feedback and recovery.kind. Technical recovery requires a concrete correction. For a safety refusal, independently assess the genuinely new design for compliance before calling; user consent or a new-design flag is not safety approval. Never reword refused content to evade safeguards. Stop after one attempt per missing direction; preserve failures and ask again if incomplete. Prior images are comparison context, not official evidence. The eventual trio needs independent review.'
      : ' This is an explicitly requested NEW batch, including when the previous batch was incomplete or blocked. Generate three NEW complete images; never copy old outputs or checkpoints. Apply regeneration.feedback and inspect priorDirections only to avoid repeating visual ideas, never as official references. Preserve host facts and brand constraints. Checkpoint and immediately show each success in the standard comparison preview. Attempt each direction once; a failed direction is terminal in this batch and must be reported without retry. Continue the other pending compliant directions already authorized in this batch. No automatic retry or H5 fallback. User authorization is not safety approval: independently assess a genuinely new compliant design, never reword refused content to evade safeguards. Preserve prior failures; this batch needs its own independent review.';
  }
  dispatch.conceptScope=conceptScope;
  dispatch.sharedBrief={
    hostBusiness:{inputs:[binding(path.join(dir,'host-startup-page.json')),binding(source)],route:startup.route||null,purpose:'Read the target source and only necessary imports/data to establish concrete business facts. Source analysis is not runtime observation.'},
    hostVisualEvidence:{status:hostImages.length?'available':'not-observed',images:hostImages,purpose:'Inspect available host captures for visible business content and state. Existing colors, spacing, layout and visual hierarchy are not the redesign target.',limitations:hostImages.length?['Historical captures have not been revalidated. Matching entry source does not prove unchanged dependencies, runtime state or current appearance.']:['No host screenshot is bound; runtime appearance and state have not been observed.']},
    brandVisual:{inputs:brandInputs,images:inputImages,designSystemInputs:dispatch.designSystemInputs,purpose:'Full brand design data remains available to designer and QA. Distill applicable visual rules for ImageGen; original Expressive proposals remain allowed.'},
    promptContract:{start:'<shared-design-brief>',end:'</shared-design-brief>',purpose:'Before generating, prepare one concrete brief with host purpose, role/state, exact visible labels/actions, data and availability conditions, viewport, applicable brand rules and unresolved facts. Reuse it in the three actual prompts, with each direction’s original visual idea outside it. These optional delimiters help carry the actual brief to independent QA; missing or differing text is reported for review and never prevents saving a successful image. Send only task-relevant visible facts and distilled design rules to ImageGen, never raw source files, credentials or unrelated project data.'}
  };
  dispatch.preparationRequired=preparationRequired;
  dispatch.producerInstructions+=' Use sharedBrief to keep host facts, host observations and brand visual inputs separate. Prepare its common brief once before the three calls and preserve the business facts across directions. Host captures are for the designer’s business observation, not official brand attachments or a requirement to keep old styling.';
  dispatch.executionGuidance={
    entry:'This is the full-image stage. Do not call declare-capability or use H5 capability declarations. Use only the commands in this dispatch.',
    preparation:'Read each necessary bound input once. Distill one shared business/brand brief and prepare three complete prompts together; preserve all source references and design inputs. No whole-repository scans.',
    tools:'Use supported completion waits instead of rapid polling. Never print image base64. As each tool completes, save its real output and checkpoint in the same orchestration step; show the standard preview immediately. --compact on checkpoint/continue/delivery avoids repeating dispatch prompts without changing saved evidence.',
    coordination:'Start production only when candidate and inputs are ready. Do not keep a producer active waiting for maintenance. Report new visible results or blockers, not acknowledgements or repeated unchanged status.',
    review:'Use a fresh independent reviewer with reviewRequest and necessary bound originals only, not a reused maintenance conversation. Inspect the three images, shared business facts and brand references; query precise source sections only for unresolved facts. Preserve findings without automatic redraw.'
  };
  dispatch.failureRecording={
    files:Object.fromEntries(['a','b','c'].map(id=>[id,path.join(dir,'image-concepts',`${id}-failure.json`)])),
    template:{schema:'brand-image-generation-failure/v1',direction:'<failed direction: a|b|c>',tool:'image_gen',code:'<actual tool error code>',reason:'<verbatim actual tool error message>'},
    instructions:'Save the exact tool arguments/result first. Create the failed direction file once using this schema; never overwrite a saved image or earlier failure. If the tool gives no specific cause, do not infer copyright or another cause. A refusal is terminal for this direction in this batch: no automatic retry. Continue other authorized pending directions and show the standard preview, including the failed slot. No source-code lookup or H5 fallback is needed.',
    afterWrite:[...dispatch.commands.delivery,'--compact']
  };
  const dispatchFile=path.join(dir,'image-concepts-dispatch.json');write(dispatchFile,dispatch);
  write(file,{schema:'brand-full-image-concepts/v1',brand,hostTarget,medium:'full-image',dispatch:binding(dispatchFile),status:'dispatch-ready',userGoalCompleted:false,hostFilesModified:false,...(regeneration?{parentRun:regeneration.parentRun,feedback:regeneration.feedback}: {})});
  return imageConceptDelivery({root,brand});
}

// Fork inputs, not workflow state. A new user request is distinct from resuming
// missing images or retrying a failed checkpoint in the old immutable batch.
export function regenerateImageConcepts({root,brand,feedback,confirmed=false,failedOnly=false,missingOnly=false,recoveryKind=''}) {
  assert(confirmed&&typeof feedback==='string'&&feedback.trim(),'Explicit new-batch request and user feedback required.');
  assert(/^[a-z0-9][a-z0-9-]*$/.test(brand||''),'Invalid brand.');
  root=fs.realpathSync(root);
  const parentFile=imageConceptFile(root,brand),state=read(parentFile);
  verifyBinding(state.dispatch);
  const dispatch=read(state.dispatch.path);
  [...dispatch.inputs,...dispatch.inputImages].forEach(verifyBinding);
  const prior=checkpoints(root,brand);
  if(missingOnly||failedOnly) assert(unverifiedPreviews(root,brand).length===0,'Preserve unverified previews; do not treat them as missing images for recovery.');
  assert(!(missingOnly&&failedOnly),'Missing-image recovery and QA correction are different operations.');
  const failures=generationFailures(root,brand);
  if(missingOnly) {
    assert(prior.length<3,'No missing images; use explicit new-batch generation instead.');
    assert(['technical-correction','new-design'].includes(recoveryKind),'A concrete technical correction or genuinely new design is required.');
    if(failures.some(f=>/moderation|safety|policy|refus/i.test(f.code+' '+f.reason))) assert(recoveryKind==='new-design','Safety refusal cannot be retried as a technical error. Assess a genuinely new compliant design; do not evade safeguards.');
  } else if(failedOnly) assert(prior.length===3,'QA correction requires three existing images.');
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
  const regeneration={parentRun:root,parentDispatch:state.dispatch,parentState:binding(parentFile),failures:failures.map(f=>f.record),automaticRetry:false,feedback:feedback.trim(),priorDirections:prior.map(d=>({id:d.id,output:d.output,prompt:d.prompt,role:'previous-proposal-not-brand-evidence'}))};
  if(missingOnly) {
    regeneration.recovery={kind:recoveryKind,failures:failures.map(f=>f.record),preservedIds:prior.map(d=>d.id),automaticRetry:false};
    for(const d of prior) {
      const dir=path.join(out,'migrations',brand,'image-concepts');fs.mkdirSync(dir,{recursive:true});
      const output=path.join(dir,`${d.id}.png`),args=path.join(dir,`${d.id}-preserved-args.json`);
      fs.copyFileSync(d.output.path,output);fs.copyFileSync(d.arguments.path,args);
      write(path.join(dir,`${d.id}-generation.json`),{...d,path:output,output:binding(output),arguments:binding(args)});
    }
  }
  if(repair) {
    regeneration.repair=repair;
    for(const d of prior.filter(d=>repair.frozenIds.includes(d.id))) {
      const dir=path.join(out,'migrations',brand,'image-concepts');fs.mkdirSync(dir,{recursive:true});
      const output=path.join(dir,`${d.id}.png`),args=path.join(dir,`${d.id}-frozen-args.json`);
      fs.copyFileSync(d.output.path,output);fs.copyFileSync(d.arguments.path,args);
      write(path.join(dir,`${d.id}-generation.json`),{...d,path:output,output:binding(output),arguments:binding(args)});
    }
  }
  return {artifactRoot:out,...prepareImageConcepts({root:out,brand,hostTarget:state.hostTarget,sampleData:dispatch.sampleData,regeneration,preparationRequired:dispatch.preparationRequired===true,controlAuditRequired:dispatch.controlAuditRequired===true})};
}

const preparationFile=(root,brand)=>path.join(root,'migrations',brand,'host-preparation.json');
function preparationRequest(root,brand,dispatch) {
  const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
  return {role:'image-concept-input-preparation',inputs:dispatch.inputs,inputImages:dispatch.inputImages,sharedBrief:dispatch.sharedBrief,
    instructions:'The executing agent prepares inputs; do not ask the user to write metadata. Read the target page and necessary business imports. Observe the real target scene using the available browser/runtime and save its actual screenshot. If unavailable, record the concrete reason with --not-observed; do not invent a capture. Write one shared Markdown brief with host product identity, task, role/scenario, exact visible content and actions, state/availability and unknowns, viewport, source locators, applicable brand design rules and original Expressive opportunities. Keep sampled Productive controls separate from whole-screen art direction: a plain reference or a control color role does not prohibit original illustration, depth or background composition. Explain any genuine source restriction and its applicable scope. The host capture observes content and state, not a style lock. Keep full source/design originals local for designer and QA; only distilled visible facts and visual rules go to ImageGen.',
    briefPath:path.join(root,'migrations',brand,'host-preparation-draft.md'),
    recordCommand:[process.execPath,entry,'record-image-preparation','--artifact-root',root,'--brand',brand,'--brief','<shared Markdown context brief>','--prompt-brief','<tool-facing shared business and visual summary>','--screenshot','<actual host capture>','--source-url','<observed page URL>','--scene','<observed scenario>','--observer','<actual executor>'],
    options:{promptBrief:'Use --prompt-brief <text file> for the shared ImageGen-facing text: only relevant visible business facts and distilled visual rules. Keep local URLs, source paths, provenance and workflow instructions in the full local --brief. Only prompt-brief is inserted into generation scaffolds; without it, the designer must distill the same frozen local brief before generating.',screenshot:'Repeat --screenshot for complementary actual host captures from the same observed scene.',sourceFile:'Repeat --source-file <necessary host dependency> to bind source evidence used for business facts.',capturedAt:'Optional --captured-at <actual capture time>; omission means capture time unknown, not now.',unavailable:'Replace --screenshot/--source-url with --not-observed <actual reason>. Keep --brief, --scene and --observer.'}};
}

function preparedDispatch(dispatch,root,brand) {
  const file=preparationFile(root,brand);
  if(!dispatch.preparationRequired||!fs.existsSync(file)) return dispatch;
  const preparation=read(file),preparedInput=binding(file);
  assert(preparation.schema==='brand-image-preparation/v1','Invalid host preparation record.');
  verifyBinding(preparation.dispatch);
  assert(preparation.dispatch.sha256===hash(path.join(root,'migrations',brand,'image-concepts-dispatch.json')),'Preparation belongs to another dispatch.');
  const observationImages=preparation.observation.images||[];
  const extra=[preparation.brief,...(preparation.promptText?[preparation.promptText]:[]),...preparation.sources,...observationImages];
  extra.forEach(verifyBinding);
  // Bind the exact same originals for both consumers. A source/capture change
  // cannot silently become a refreshed observation on continue or delivery.
  return {...dispatch,inputs:[...dispatch.inputs,preparedInput,...extra],preparedInput,
    sharedBrief:{...dispatch.sharedBrief,prepared:{...preparedInput,brief:preparation.brief,promptText:preparation.promptText||null,promptTextStatus:preparation.promptText?'prepared':'not-prepared',sources:preparation.sources,observation:preparation.observation,preparedAfterGeneration:preparation.preparedAfterGeneration},
      hostVisualEvidence:{...dispatch.sharedBrief.hostVisualEvidence,status:preparation.observation.status,images:observationImages.length?observationImages.map(image=>({...image,role:'host-business-observation'})):dispatch.sharedBrief.hostVisualEvidence.images,observation:preparation.observation,
        limitations:observationImages.length?[preparation.observation.scope]:[preparation.observation.reason||'Runtime appearance and state have not been observed.',...(dispatch.sharedBrief.hostVisualEvidence.images.length?['Earlier bound captures are historical context, not an observation of this scene.']:[])]}},
    directions:dispatch.directions.map(d=>({...d,prompt:preparation.promptText?`${d.prompt}\n<shared-design-brief>\n${fs.readFileSync(preparation.promptText.path,'utf8').trim()}\n</shared-design-brief>`:d.prompt})),
    producerInstructions:dispatch.producerInstructions+' Read sharedBrief.prepared: it binds the shared business/design brief, actual observation and necessary source evidence also sent to QA. The full brief is local context, never a raw tool payload. Only its separately prepared promptText, when present, is inserted into each scaffold; otherwise distill one tool-safe business/visual summary from the frozen brief before the calls. Keep business identity and facts while developing each visual proposal.'};
}

export function recordImagePreparation({root,brand,briefFile,promptFile,screenshotFile,screenshotFiles=[],sourceUrl='',scene,observer,capturedAt=null,notObserved='',sourceFiles=[]}) {
  const state=read(imageConceptFile(root,brand));verifyBinding(state.dispatch);
  const dispatch=read(state.dispatch.path);
  assert(dispatch.preparationRequired===true,'This historical run has no preparation step; preserve it and prepare a new run.');
  [...dispatch.inputs,...dispatch.inputImages].forEach(verifyBinding);
  assert(briefFile&&fs.readFileSync(briefFile,'utf8').trim()&&scene?.trim()&&observer?.trim(),'A concrete shared brief, scene and actual observer are required.');
  if(promptFile) assert(fs.readFileSync(promptFile,'utf8').trim(),'The tool-facing shared brief cannot be empty.');
  const screenshots=screenshotFiles.length?screenshotFiles:screenshotFile?[screenshotFile]:[];
  assert(Boolean(screenshots.length)!==Boolean(notObserved),'Provide an actual screenshot or an explicit not-observed reason.');
  for(const screenshot of screenshots) {
    assert(sourceUrl&&/^https?:\/\//.test(sourceUrl),'Observed page URL required with screenshot.');
    const bytes=fs.readFileSync(screenshot);
    assert(bytes.length>8&&(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216||bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'),'Host observation must be an actual PNG/JPEG/WebP screenshot.');
  }
  if(capturedAt) assert(Number.isFinite(Date.parse(capturedAt)),'Invalid actual capture time.');
  const startup=read(dispatch.sharedBrief.hostBusiness.inputs[0].path),host=fs.realpathSync(path.resolve(root,startup.hostRoot));
  const sources=[...new Set([path.resolve(host,startup.sourceFile),...sourceFiles.map(p=>path.resolve(host,p))])].map(file=>{
    assert(fs.realpathSync(file).startsWith(host+path.sep),'Business source evidence must belong to this host.');
    return binding(file);
  });
  const request={briefSha256:hash(briefFile),promptSha256:promptFile?hash(promptFile):null,screenshotSha256:screenshots.map(hash),sourceUrl,scene,observer,capturedAt,notObserved,sources};
  const file=preparationFile(root,brand);
  if(fs.existsSync(file)) {
    assert(JSON.stringify(read(file).request)===JSON.stringify(request),'Recorded preparation is immutable; use the same input or a new isolated run.');
    return imageConceptDelivery({root,brand});
  }
  const dir=path.join(root,'migrations',brand,'host-preparation');fs.mkdirSync(dir,{recursive:true});
  const freeze=(input,name)=>{const output=path.join(dir,name);fs.copyFileSync(input,output,fs.constants.COPYFILE_EXCL);return binding(output);};
  const brief=freeze(briefFile,'shared-brief.md');
  const promptText=promptFile?freeze(promptFile,'prompt-brief.txt'):null;
  const images=screenshots.map((screenshot,i)=>freeze(screenshot,`host-${i+1}${path.extname(screenshot)||'.png'}`));
  const observation={status:images.length?'observed':'not-observed',images,sourceUrl:sourceUrl||null,scene,observer,capturedAt,recordedAt:new Date().toISOString(),reason:notObserved||null,scope:'Recorded scene only; matching entry source does not prove other dependencies or runtime states unchanged.',use:'Business observation only; existing styling is not the redesign target.'};
  write(file,{schema:'brand-image-preparation/v1',dispatch:state.dispatch,request,brief,promptText,sources,observation,preparedAfterGeneration:checkpoints(root,brand).length>0});
  write(path.join(dir,'producer-dispatch.json'),preparedDispatch(dispatch,root,brand));
  return imageConceptDelivery({root,brand});
}

// Traverse only immutable parent bindings, never a caller-supplied filesystem path.
export function imageConceptHistory({root,brand}) {
  const history=[],seen=new Set([fs.realpathSync(root)]);
  let state=read(imageConceptFile(root,brand));
  for (;;) {
    verifyBinding(state.dispatch);
    const r=read(state.dispatch.path).regeneration;
    if(!r) return history;
    assert(history.length<64,'Image history exceeds supported depth.');
    verifyBinding(r.parentState);verifyBinding(r.parentDispatch);
    const parentRoot=fs.realpathSync(r.parentRun);
    assert(!seen.has(parentRoot),'Cyclic image history.');seen.add(parentRoot);
    assert(fs.realpathSync(r.parentState.path)===fs.realpathSync(imageConceptFile(parentRoot,brand)),'Parent state does not match image run.');
    const parent=read(r.parentState.path);
    assert(parent.dispatch.path===r.parentDispatch.path&&parent.dispatch.sha256===r.parentDispatch.sha256,'Parent dispatch binding changed.');
    const failures=r.failures||r.recovery?.failures||[];failures.forEach(verifyBinding);
    const images=(r.priorDirections||[]).map(d=>{
      assert(['a','b','c'].includes(d.id),'Invalid historical direction.');verifyBinding(d.output);
      assert(fs.realpathSync(d.output.path).startsWith(parentRoot+path.sep),'Historical image outside bound run.');
      return {id:d.id,...d.output};
    });
    assert(new Set(images.map(d=>d.id)).size===images.length,'Duplicate historical directions.');
    history.push({artifactRoot:parentRoot,images,completedCount:images.length,failures,comparisonPreview:{path:`/__brand_comparison__?brand=${encodeURIComponent(brand)}&history=${history.length+1}`}});
    state=parent;
  }
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
function sharedPromptBrief(prompt,dispatch) {
  if(!dispatch.sharedBrief?.promptContract) return null; // Existing runs retain their contract.
  const {start,end}=dispatch.sharedBrief.promptContract;
  const parts=String(prompt||'').split(start);
  if(parts.length!==2||parts[1].split(end).length!==2) return null;
  const text=parts[1].split(end)[0].trim();
  return text||null;
}
function commonBrief(completed,dispatch) {
  if(!dispatch.sharedBrief?.promptContract) return null;
  const directions=completed.map(d=>({id:d.id,text:sharedPromptBrief(d.prompt,dispatch),arguments:d.arguments}));
  const texts=directions.map(d=>d.text).filter(Boolean);
  const missingDirectionIds=directions.filter(d=>!d.text).map(d=>d.id);
  return {status:new Set(texts).size>1?'inconsistent':texts.length&&!missingDirectionIds.length?'observed':'missing',
    text:new Set(texts).size===1?texts[0]:null,directions,missingDirectionIds,
    differingDirectionIds:new Set(texts).size>1?directions.filter(d=>d.text&&d.text!==texts[0]).map(d=>d.id):[],
    reviewMeaning:'Text presence and differences are observations, not business verdicts. Check actual images against host facts; absent delimiters or wording changes alone do not fail QA.'};
}
function checkpoints(root, brand) {
  return ['a','b','c'].map(id=>path.join(root,'migrations',brand,'image-concepts',`${id}-generation.json`))
    .filter(fs.existsSync).map(file=>{const item=read(file);verifyBinding(item.arguments);verifyBinding(item.output);item.inputImages.forEach(verifyBinding);if(item.preparedInput)verifyBinding(item.preparedInput);
      assert(item.prompt===read(item.arguments.path).prompt,'Checkpoint prompt differs from bound actual arguments.');
      return item;});
}

export function unverifiedPreviews(root,brand,directions=['a','b','c']) {
  return directions.flatMap(id=>{
    const file=path.join(root,'migrations',brand,'image-concepts',`${id}-unverified-preview.json`);
    if(!fs.existsSync(file)) return [];
    const item=read(file);verifyBinding(item.output);
    const actual=readImageCall(item.provenance.logPath,item.provenance.callId,{allowUnverifiedArguments:true});
    assert(actual.evidence.eventSha256===item.provenance.eventSha256&&(actual.argumentError?actual.rawCall===item.rawCall:isDeepStrictEqual(literalArguments(item.rawCall),actual.args)),'Unverified preview call evidence changed.');
    requireRuntimeEvidence(actual,item.output.path);
    // Preserve the original failure receipt. A corrected verifier may recover
    // only the same immutable call/output, never a replacement generation.
    const recovered=path.join(root,'migrations',brand,'image-concepts',`${id}-generation.json`);
    if(!actual.argumentError&&fs.existsSync(recovered)) {
      const saved=read(recovered);
      assert(saved.output.sha256===item.output.sha256&&saved.provenance.eventSha256===item.provenance.eventSha256&&saved.provenance.callId===item.provenance.callId,'Recovered preview differs from original evidence.');
      verifyImageCall(item.provenance.logPath,item.provenance.callId,read(saved.arguments.path));
      return [];
    }
    return [item];
  });
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
// the real tool ID comes from runtime evidence, never from a fabricated review.
export function recordImageConcept({root,brand,id,inputFile,outputFile,toolCallId,producer,callLog,callId}) {
  assert(['a','b','c'].includes(id)&&producer,'Direction and actual producer required.');
  assert(!generationFailures(root,brand).some(f=>f.direction===id),'This direction has a recorded generation failure; preserve it rather than overwriting the failed attempt.');
  const state=read(imageConceptFile(root,brand));verifyBinding(state.dispatch);
  const dispatch=preparedDispatch(read(state.dispatch.path),root,brand);dispatch.inputs.forEach(verifyBinding);dispatch.inputImages.forEach(verifyBinding);
  assert(!frozenReviews(dispatch).some(q=>q.id===id),'Passed direction is frozen; do not regenerate it.');
  assert(Boolean(callLog)===Boolean(callId),'Actual tool call log and call ID must be provided together.');
  if(!callLog) ({callLog,callId}=findCurrentThreadImageCall(outputFile));
  const actual=readImageCall(callLog,callId,{allowUnverifiedArguments:true});
  if(actual.argumentError) {
    const provenance=requireRuntimeEvidence(actual,outputFile),output=binding(outputFile);
    assert(fs.realpathSync(output.path).startsWith(fs.realpathSync(root)+path.sep),'Generated output must be inside this isolated run.');
    assert(!checkpoints(root,brand).some(x=>x.id===id||x.provenance?.callId===callId),'Existing verified direction/call cannot be replaced by an unverified preview.');
    // A concurrent exec wrapper may emit several distinct outputs. These are
    // display-only previews, not verified ImageGen calls or selectable directions.
    assert(!unverifiedPreviews(root,brand).some(x=>x.id!==id&&x.output.sha256===output.sha256),'One output cannot count as multiple previews.');
    assert(!imageConceptHistory({root,brand}).some(h=>h.images.some(d=>d.sha256===output.sha256)),'Prior output cannot count as a new preview.');
    const item={id,producer,output,provenance,rawCall:actual.rawCall,argumentError:actual.argumentError,argumentsStatus:'unverified',imagegenAttribution:'unverified',selectionAvailable:false};
    const target=path.join(root,'migrations',brand,'image-concepts',`${id}-unverified-preview.json`);
    if(fs.existsSync(target)) assert(isDeepStrictEqual(read(target),item),'Unverified preview is immutable.');
    else write(target,item);
    return imageConceptDelivery({root,brand});
  }
  if(inputFile) verifyImageCall(callLog,callId,read(inputFile));
  const priorPreview=unverifiedPreviews(root,brand).find(x=>x.id===id);
  if(priorPreview) assert(priorPreview.provenance.callId===callId&&priorPreview.provenance.eventSha256===actual.evidence.eventSha256&&priorPreview.output.sha256===hash(outputFile),'Unverified preview is preserved; only its identical runtime evidence may be recovered.');
  const args=actual?.args || read(inputFile);
  assert(typeof args.prompt==='string','Actual prompt required.');
  const provenance=requireRuntimeEvidence(actual,outputFile);
  toolCallId=provenance.callId;
  const promptDiagnostics=args.prompt.includes('无需识别或命名角色，直接依据所给参考图和素材的可见内容生成')?[]:['reference-fidelity-sentence-missing-in-actual-call'];
  const plannedFile=path.join(root,'migrations',brand,'image-concepts',`${id}-planned-arguments.json`);
  const plannedInput=fs.existsSync(plannedFile)
    ? {status:isDeepStrictEqual(read(plannedFile),args)?'matched':'differs',arguments:binding(plannedFile)}
    : {status:'unavailable',reason:'No frozen planned arguments exist; actual tool arguments remain authoritative.'};
  if(plannedInput.status==='differs') promptDiagnostics.push('planned-input-differs-from-actual-call');
  const commonFile=dispatch.sharedBrief?.prepared?.promptText;
  if(dispatch.sharedInputRequired&&commonFile) {
    verifyBinding(commonFile);
    const common=fs.readFileSync(commonFile.path,'utf8').trim();
    if(!args.prompt.includes(`<shared-design-brief>\n${common}\n</shared-design-brief>`)) promptDiagnostics.push('shared-business-input-changed-or-missing-in-actual-call');
  }
  if(!inputFile) {
    inputFile=path.join(root,'migrations',brand,'image-concepts',`${id}-actual-arguments.json`);
    if(fs.existsSync(inputFile)) assert(JSON.stringify(read(inputFile))===JSON.stringify(args),'Frozen actual arguments differ.');
    else write(inputFile,args);
  }
  assert(Array.isArray(args.referenced_image_paths),'Actual referenced_image_paths required.');
  const output=binding(outputFile);
  assert(!imageConceptHistory({root,brand}).some(h=>h.images.some(d=>d.sha256===output.sha256)),'Prior output cannot count as a newly generated concept.');
  assert(!checkpoints(root,brand).some(x=>x.id!==id&&x.provenance?.callId===toolCallId),'One tool call cannot count as multiple directions.');
  assert(fs.realpathSync(output.path).startsWith(fs.realpathSync(root)+path.sep),'Generated output must be inside this isolated run.');
  const item={id,producer,path:output.path,output,tool:'image_gen',toolCallId,prompt:args.prompt,provenance,promptDiagnostics,plannedInput,arguments:binding(inputFile),inputImages:args.referenced_image_paths.map(binding),...(dispatch.preparedInput?{preparedInput:dispatch.preparedInput}:{})};
  const bytes=fs.readFileSync(output.path);
  assert(args.prompt.length>100&&bytes.length>10000&&(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216||bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'),'Output must be an actual nonempty PNG/JPEG/WebP.');
  verifyReceivedImageReferences(dispatch,item.inputImages,root);
  const target=path.join(root,'migrations',brand,'image-concepts',`${id}-generation.json`);
  if(fs.existsSync(target)) assert(JSON.stringify(read(target))===JSON.stringify(item),'Generation checkpoint already exists with different content.');
  else write(target,item);
  return imageConceptDelivery({root,brand});
}
function verifyReceivedImageReferences(dispatch, receivedInputs, root) {
  const modBinding=dispatch.inputs.find(x=>path.basename(x.path)==='brand-mod.json');
  assert(modBinding,'Frozen brand MOD required for image references.');
  verifyBinding(modBinding);
  const declared=declaredImageReferences(read(modBinding.path),root);
  if(declared) assert(isDeepStrictEqual(declared,dispatch.inputImages),'Frozen image references differ from the bound brand declaration.');
  else assert(dispatch.inputImages.filter(x=>x.role==='official-page-design-language').length>=2,'Legacy image references require two official page screenshots.');
  const received=new Set(receivedInputs.map(x=>x.sha256));
  assert(dispatch.inputImages.every(x=>received.has(x.sha256)),'Generator did not receive sufficient frozen official screenshots/assets.');
}

function validateReceipt(receipt, dispatch, root, newSubmission=false) {
  const producers=new Set([receipt.producer,...(receipt.directions||[]).map(d=>d.producer)].filter(Boolean));
  assert(receipt.producer&&receipt.independentReview?.reviewer&&!producers.has(receipt.independentReview.reviewer),'Independent visual reviewer required.');
  const failures=generationFailures(root,dispatch.brand);
  const expected=['a','b','c'].filter(id=>!failures.some(f=>f.direction===id));
  assert(expected.length>0&&receipt.directions?.length===expected.length&&new Set(receipt.directions.map(x=>x.id)).size===expected.length&&receipt.directions.every(d=>expected.includes(d.id)),'Exactly the successful directions required; pending or failed slots cannot be reviewed.');
  assert(receipt.independentReview.directions?.length===expected.length&&new Set(receipt.independentReview.directions.map(d=>d.id)).size===expected.length&&receipt.independentReview.directions.every(d=>expected.includes(d.id)),'Review must cover exactly the successful direction IDs.');
  const hashes=[];
  for(const d of receipt.directions) {
    assert(fs.realpathSync(d.path).startsWith(fs.realpathSync(root)+path.sep),'Generated output must be inside this isolated run.');
    assert(['a','b','c'].includes(d.id)&&d.tool==='image_gen'&&d.toolCallId&&d.prompt?.length>100,'Actual ImageGen call and complete prompt required for each direction.');
    const preserved=dispatch.regeneration?.recovery?.preservedIds.includes(d.id);
    const prior=dispatch.regeneration?.priorDirections.find(p=>p.id===d.id);
    // A preserved historical call must retain its exact prompt, not be rewritten
    // retrospectively to satisfy a newer template. Newly generated calls stay strict.
    const unchangedHistoricalCall=preserved&&d.prompt===prior?.prompt&&hash(d.path)===prior?.output.sha256;
    if((newSubmission||dispatch.actualCallEvidenceRequired)&&!unchangedHistoricalCall) {
      const recorded=checkpoints(root,dispatch.brand).find(x=>x.id===d.id);
      assert(recorded?.provenance?.status==='verified-against-tool-call'&&recorded.prompt===d.prompt&&recorded.output.sha256===hash(d.path)&&recorded.toolCallId===d.toolCallId,'Receipt must match verified actual tool checkpoint.');
      const actual=verifyImageCall(recorded.provenance.logPath,recorded.provenance.callId,read(recorded.arguments.path));
      requireRuntimeEvidence(actual,recorded.path);
      assert(actual.evidence.callId===d.toolCallId,'Receipt call ID differs from actual tool call.');
      assert(JSON.stringify(d.inputImages)===JSON.stringify(actual.args.referenced_image_paths.map(binding)),'Receipt references differ from actual tool call.');
    }
    const bytes=fs.readFileSync(d.path);
    assert(bytes.length>10000&&(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216||bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'),'Output must be an actual nonempty PNG/JPEG/WebP, not HTML or a receipt.');
    const digest=hash(d.path);hashes.push(digest);
    const frozen=frozenReviews(dispatch).find(q=>q.id===d.id);
    if(frozen) assert(frozen.sha256===digest,'Frozen output changed.');
    else if(dispatch.regeneration?.recovery?.preservedIds.includes(d.id)) assert(dispatch.regeneration.priorDirections.find(p=>p.id===d.id)?.output.sha256===digest,'Preserved recovery image changed.');
    else assert(!imageConceptHistory({root,brand:dispatch.brand}).some(h=>h.images.some(p=>p.sha256===digest)),'Prior output cannot count as a newly generated concept.');
    assert(d.inputImages?.length>=1,'Actual image inputs required.');
    d.inputImages.forEach(verifyBinding);
    verifyReceivedImageReferences(dispatch,d.inputImages,root);
    const qa=receipt.independentReview.directions?.find(x=>x.id===d.id);
    assert(qa?.sha256===digest&&qa.completeScreen===true&&qa.brandFaithful===true&&qa.hostTaskPreserved===true,'Independent review must bind and approve each actual complete screen.');
  }
  assert(new Set(hashes).size===expected.length,'Copies of the same image are not distinct concepts.');
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
  assert(failed.verdict==='fail'&&failed.directions?.length===receipt.directions.length,'Invalid prior failed review.');
  assert(receipt.directions.every(d=>failed.directions.some(q=>q.id===d.id&&q.sha256===hash(d.path))),'Reassessment must review the same images as the failed review.');
}

export function validateControlAudit(review) {
  for (const direction of review.directions || []) {
    const audit=direction.controlAudit;
    assert(audit && typeof audit.scanEvidence==='string' && audit.scanEvidence.trim() && Array.isArray(audit.controls), 'Visible-control audit with actual scan evidence required.');
    for (const control of audit.controls) {
      assert(control.label && control.location && ['supported','unsupported','uncertain','decoration'].includes(control.status), 'Control label, location and evidence status required.');
      if (control.status==='supported') assert(control.sourceEvidence, 'Supported control needs a host source citation.');
      if (control.status==='decoration') assert(control.reason, 'Decoration needs a visual reason, not an assumed capability.');
      if (['unsupported','uncertain'].includes(control.status)) {
        assert(control.implementationAction && review.limitations?.some(x=>typeof x==='string'&&x.includes(control.label)), 'Unsupported control must be disclosed with an implementation action; never silently pass.');
      }
    }
  }
}

export function recordImageConcepts({root,brand,receiptFile,reviewFile}) {
  assert(unverifiedPreviews(root,brand).length===0,'Unverified argument previews cannot pass formal review or completed delivery.');
  const file=imageConceptFile(root,brand),state=read(file);verifyBinding(state.dispatch);
  const dispatch=preparedDispatch(read(state.dispatch.path),root,brand);dispatch.inputs.forEach(verifyBinding);dispatch.inputImages.forEach(verifyBinding);
  let receipt;
  if(reviewFile) {
    const directions=checkpoints(root,brand);
    const failures=generationFailures(root,brand);
    assert(directions.length>0&&['a','b','c'].every(id=>directions.some(d=>d.id===id)||failures.some(f=>f.direction===id)),'All directions must be terminal and at least one successful checkpoint is required before review.');
    receipt={producer:directions[0].producer,directions,independentReview:mergeRepairReview(read(reviewFile),dispatch)};
    assert(receipt.independentReview.directions?.length===directions.length&&new Set(receipt.independentReview.directions.map(d=>d.id)).size===directions.length&&receipt.independentReview.directions.every(q=>directions.some(d=>q.id===d.id&&q.sha256===d.output.sha256)),'Review must cover exactly the successful direction IDs and actual output hashes.');
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
  if(dispatch.controlAuditRequired) validateControlAudit(receipt.independentReview);
  validateReceipt(receipt,dispatch,root,true);
  verifyReassessment(receipt,path.join(path.dirname(file),'image-concepts-failed-review.json'));
  const target=path.join(path.dirname(file),'image-concepts-receipt.json');
  if(fs.existsSync(target)) assert(JSON.stringify(read(target))===JSON.stringify(receipt),'Recorded receipt is immutable.');
  else write(target,receipt);
  // State is derived from the immutable dispatch/receipt; delivery rechecks current bytes.
  return imageConceptDelivery({root,brand});
}

export function imageConceptDelivery({root,brand}) {
  const file=imageConceptFile(root,brand),state=read(file);verifyBinding(state.dispatch);
  const dispatch=preparedDispatch(read(state.dispatch.path),root,brand);dispatch.inputs.forEach(verifyBinding);dispatch.inputImages.forEach(verifyBinding);
  state.sampleData=dispatch.sampleData===true;
  state.history=imageConceptHistory({root,brand});
  const frozen=frozenReviews(dispatch);
  for(const q of frozen) assert(checkpoints(root,brand).find(d=>d.id===q.id)?.output.sha256===q.sha256,'Frozen output changed.');
  const completed=checkpoints(root,brand);
  if(dispatch.preparationRequired&&!dispatch.preparedInput) return {...state,ok:true,status:'preparation-required',userGoalCompleted:false,preparationRequest:preparationRequest(root,brand,dispatch),completedImages:completed.map(d=>({id:d.id,...d.output})),nextAction:'Execute preparationRequest in this run, then record-image-preparation. The command returns the generation dispatch automatically; no ImageGen call until these inputs are prepared.'};
  const dispatchFile=dispatch.preparedInput?path.join(path.dirname(file),'host-preparation','producer-dispatch.json'):state.dispatch.path;
  if(dispatch.preparedInput) assert(JSON.stringify(read(dispatchFile))===JSON.stringify(dispatch),'Prepared producer dispatch changed.');
  const sharedDesignBrief=commonBrief(completed,dispatch);
  if(dispatch.regeneration?.recovery) {
    const recovery=dispatch.regeneration.recovery;
    verifyBinding(dispatch.regeneration.parentDispatch);
    verifyBinding(dispatch.regeneration.parentState);
    recovery.failures.forEach(verifyBinding);
    for(const id of recovery.preservedIds) {
      const original=dispatch.regeneration.priorDirections.find(d=>d.id===id);
      verifyBinding(original.output);
      assert(completed.find(d=>d.id===id)?.output.sha256===original.output.sha256,'Preserved recovery image changed.');
    }
  }
  const preview={coordinationCommands:coordinationCommands(root,brand),previewAvailable:true,previewStatus:completed.length===3?'pending':'partial',images:completed.map(d=>({id:d.id,...d.output})).sort((a,b)=>a.id.localeCompare(b.id)),comparisonPreview:{path:`/__brand_comparison__?brand=${encodeURIComponent(brand)}`,medium:'full-image'},interactive:false,limitations:[],presentationRequirements:[]};
  const unverified=unverifiedPreviews(root,brand);
  if(unverified.length) {
    const failures=generationFailures(root,brand);
    const pending=dispatch.directions.filter(d=>!completed.some(x=>x.id===d.id)&&!unverified.some(x=>x.id===d.id)&&!failures.some(x=>x.direction===d.id));
    const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
    return {...state,...preview,dispatchFile,ok:true,status:pending.length?'dispatch-ready':'arguments-unverified',previewStatus:'unverified',userGoalCompleted:false,selectionAvailable:false,
    images:[...preview.images,...unverified.map(d=>({id:d.id,...d.output,argumentsStatus:'unverified'}))].sort((a,b)=>a.id.localeCompare(b.id)),
    unverifiedPreviews:unverified,generationFailures:failures,directionStates:['a','b','c'].map(id=>({id,status:unverified.some(d=>d.id===id)?'unverified':completed.some(d=>d.id===id)?'saved':failures.some(d=>d.direction===id)?'blocked':'pending'})),
    dispatchRequest:pending.length?{...dispatch,directions:pending,checkpointCommand:[process.execPath,entry,'record-image-concept','--artifact-root',root,'--brand',brand,'--direction','<a|b|c>','--output','<actual image in run>','--producer','<actual producer identity>']}:undefined,
    limitations:['图片与运行时工具输出一致，但部分调用的 ImageGen 来源及实际参数未核实。仅供预览，不能通过正式审核或选图落地。',...completed.filter(d=>d.plannedInput?.status==='differs').map(d=>'方案 '+d.id.toUpperCase()+' 实际输入与确认稿不一致；原图与真实调用已保留，不计入有效输入对照。')],
    nextAction:pending.length?'Show the standard comparison preview and execute only the pending authorized directions once. Preserve unverified previews; never regenerate those directions or reconstruct their arguments. Formal review and selection remain blocked.':'Show the standard comparison preview. Preserve original images and call evidence. Do not regenerate unverified directions, reconstruct arguments or claim verified QA/selection.'};
  }
  if(dispatch.preparedInput&&completed.length===0) preview.preparationReviewRequest={status:'pending-no-images',scope:'input-preparation-only',reviewed:false,preparedInput:dispatch.preparedInput,inputs:dispatch.inputs,inputImages:dispatch.inputImages,sharedBrief:dispatch.sharedBrief,conceptScope:dispatch.conceptScope,instructions:'These are the same frozen preparation originals supplied to the designer. Inspect business/source correspondence, observation provenance and applicable brand-rule scope if input review is requested. No generated images exist; this packet is not visual QA, a review result or approval to claim a completed concept. Original Expressive proposals are allowed; plain documentation samples do not impose a whole-screen illustration/depth ban.'};
  const failures=generationFailures(root,brand);
  preview.directionStates=['a','b','c'].map(id=>({id,status:completed.some(d=>d.id===id)?'saved':failures.some(f=>f.direction===id)?'blocked':'pending'}));
  const pending=dispatch.directions.filter(d=>!completed.some(c=>c.id===d.id)&&!failures.some(f=>f.direction===d.id));
  const pendingEntry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
  const failureDelivery=failures.length?{...state,...preview,previewStatus:'partial-blocked',ok:true,status:pending.length?'dispatch-ready':'awaiting-user-choice',userGoalCompleted:false,generationFailures:failures,completedImages:preview.images,
    dispatchFile,
    dispatchRequest:pending.length?{...dispatch,sharedDesignBrief,directions:pending,producerInstructions:dispatch.producerInstructions+' Recorded failed directions are terminal: do not retry them. Execute only the pending directions in this packet once, after independently checking compliance. Preserve and show all successes and failures.',checkpointCommand:[process.execPath,pendingEntry,'record-image-concept','--artifact-root',root,'--brand',brand,'--direction','<a|b|c>','--output','<actual image in run>','--producer','<actual producer identity>']}:undefined,
    selectionAvailable:completed.length>0||(state.history||[]).some(h=>h.images?.length>0),
    userChoices:{selectableDirections:completed.map(d=>d.id),historicalRuns:state.history,continueGeneration:{command:'regenerate-image-concepts',requiredFlags:['--confirm-new-batch','--feedback'],scope:'three-new-directions',requiresExplicitUserRequest:true},pause:true},
    failureGuidance:{requestedMedium:'full-image',completedCount:completed.length,requiredCount:3,automaticRetry:false,defaultMediumFallback:null,userMessage:`本轮已保存 ${completed.length}/3 张，生成受阻，尚未完成三图审核。继续生成会开启全新三方案；本轮和历史成功图仍可选择，也可以暂停。没有成功图的轮次不提供虚构选择。`,mediumChange:'No automatic H5 fallback. User choice does not approve image quality or whole-host implementation.'},
    nextAction:pending.length?'Show comparisonPreview with actual successes and failures now, then execute only dispatchRequest pending compliant directions already authorized in this batch, once each. A recorded failed direction is terminal and must not be retried. Do not start a new batch or ask for redundant authorization to finish the other pending directions. No H5 fallback and no completed-delivery claim.':'Show comparisonPreview now with current direction states, saved images and bound history links. Continue generation means an explicitly authorized NEW batch of three via regenerate-image-concepts --confirm-new-batch --feedback <user request and genuinely new design>. Keep old successes selectable in their original runs and preserve failures. Only an explicit request to fill missing directions uses --missing-only and --recovery-kind. Safety refusals are not permission to retry refused content or evade safeguards. No automatic retry or H5 fallback. Never claim completion for this blocked batch.'}:null;
  if(failureDelivery&&(pending.length||!completed.length)) return failureDelivery;
  // Terminal partial batches use the same evidence/review contract as a trio.
  // Failures remain visible; reviewing saved outputs never completes the trio.
  if(failureDelivery) Object.assign(preview,failureDelivery,{previewStatus:'partial-pending'});
  const failedFile=path.join(path.dirname(file),'image-concepts-failed-review.json');
  const receiptFile=path.join(path.dirname(file),'image-concepts-receipt.json');
  if(fs.existsSync(failedFile)&&(!fs.existsSync(receiptFile)||!read(receiptFile).independentReview?.supersedesFailedReview)) return {...state,...preview,previewStatus:'failed',ok:false,status:'blocked',userGoalCompleted:false,failedReview:read(failedFile),reviewNotes:read(failedFile).notes,limitations:read(failedFile).limitations||[],presentationRequirements:read(failedFile).presentationRequirements||[],completedImages:checkpoints(root,brand).map(d=>({id:d.id,...d.output})),nextAction:'Independent review failed. Preserve this attempt; do not regenerate or declare completion automatically. A justified independent reassessment of these same images may explicitly bind supersedesFailedReview {path,sha256} and explain reassessmentReason in a new report; record it using record-image-concepts --review without overwriting the old report.'};
  if(!fs.existsSync(receiptFile)) {
    const missing=pending;
    const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'run-brand-workflow.mjs');
    const reviewFile=path.join(path.dirname(file),'image-concepts-review.json');
    return {...state,...preview,ok:true,status:missing.length?'dispatch-ready':'review-ready',dispatchFile,
      completedImages:completed.map(d=>({id:d.id,...d.output})),
      dispatchRequest:missing.length?{...dispatch,sharedDesignBrief,directions:missing,checkpointCommand:[process.execPath,entry,'record-image-concept','--artifact-root',root,'--brand',brand,'--direction','<a|b|c>','--output','<actual image in run>','--producer','<actual producer identity>']}:undefined,
      reviewRequest:missing.length?undefined:{images:completed.filter(d=>!frozen.some(q=>q.id===d.id)).map(d=>({id:d.id,...d.output})),frozenImages:completed.filter(d=>frozen.some(q=>q.id===d.id)).map(d=>({id:d.id,...d.output})),reviewScope:frozen.length?'Review changed images fully for business, brand and readability. Frozen images are comparison context only; do not repeat their individual review. Confirm distinctCompositions across the final trio. Submit direction findings for changed IDs only. Prior limitations remain.':undefined,inputs:dispatch.inputs,inputImages:dispatch.inputImages,regeneration:dispatch.regeneration?{feedback:dispatch.regeneration.feedback,priorDirections:dispatch.regeneration.priorDirections.map(d=>({id:d.id,output:d.output,role:'comparison-only-not-brand-evidence'}))}:undefined,producers:[...new Set(completed.map(d=>d.producer))],
        sharedBrief:dispatch.sharedBrief,
        ...(failures.length?{generationFailures:failures,reviewScope:'Review every successful original listed in images, using the same business, brand, readability and evidence gates. Failed slots have no image and must not appear in direction findings. Compare distinctness among available images (one image has no pair to compare). This review cannot complete the requested three-image batch.'}:{}),
        callEvidence:completed.map(d=>({id:d.id,provenance:d.provenance||{status:'legacy-unverified'},promptDiagnostics:d.promptDiagnostics||[],plannedInput:d.plannedInput||{status:'unavailable',reason:'Legacy checkpoint did not record a planned-input comparison.'}})),
        preparedInput:dispatch.preparedInput,
        sharedDesignBrief,
        conceptScope:dispatch.conceptScope||conceptScope,
        sampleData:dispatch.sampleData===true,
        inputPolicy:'Use only this reviewRequest, its shared conceptScope and bound images/source files, not full Skill, historical chat, production prompts or unrelated reports. View each current image and necessary official reference once; reread only to resolve a concrete uncertainty. Read the bound startup source, then necessary imports/data to verify navigation, exact labels, states, routes and actions. Reject invented capabilities or missing essential business, but do not infer an interactive capability from decoration alone. Original illustration, depth and expressive composition are permitted proposals; absence from official references is not a failure reason. A rejection must identify a real conflict with an applicable brand rule, material identity drift, or incorrect host identity, content or capabilities. Inspect applicable brand rules and trio differences. Query precise design-system keys when needed, not entire implementation kits for an image-only review. Unknown business facts stay explicit; do not guess pass or fail. Omit redundant history, not evidence. Return findings and receipt once; the coordinator must not duplicate this visual review.',
        instructions:'View all three originals, official references and bound host facts. Check the same viewport and business content, no imported reference-site capabilities, recognizable brand language, readability, and materially different dominant regions/information order/reading paths rather than just reordered cards. If regeneration is present, compare priorDirections as previous proposals, not brand evidence; report how this batch addresses feedback and differs from the previous batch. Judge this image-concept selection stage, not implementation certification: localized color-role, spacing, font or raster deviations that do not materially impair brand recognition, business meaning, reading or direction selection should be stated in limitations and may pass. brandFaithful means recognizable and applicable at this stage, not every token or semantic role is pixel-exact. Missing or misleading business, materially drifted brand identity, unreadable core content or indistinguishable directions still fail. Explain the actual impact; a P-number alone neither blocks nor permits delivery. Do not erase binding source rules: disclose deviations and required implementation corrections. Write only the independent review JSON with concrete findings. Do not reconstruct generation records, generate images or modify the host. Preserve prior failed reports; a justified independent reassessment must explicitly bind supersedesFailedReview and explain reassessmentReason, never silently replace FAIL.',
        ...(dispatch.regeneration?.repair?{instructions:'Review changed images fully against the same frozen business and brand inputs. Missing or misleading business, unreadable core content and material brand drift still fail. At concept-selection stage, localized visual/color-role deviations without material impact on brand recognition, business, reading or direction selection may pass with explicit limitations; a P-number alone does not decide. Frozen images are comparison context only: reuse their hash-bound approvals, do not repeat individual QA. Confirm final trio distinctness. Submit only changed IDs. Do not generate images or alter the host.'}:{}),
        controlAuditRequired:dispatch.controlAuditRequired===true,
        ...(failures.length?{instructions:'View every supplied successful original and bound official references/host facts. Use conceptScope, inputPolicy and controlAuditContract unchanged: check business content, brand recognition, readability and distinct compositions among available images; missing or misleading business still fails. Failed generation slots have no image and must not be included in review directions. For one image, distinctCompositions means no duplicate pair exists, not that a trio was compared. Localized nonmaterial visual deviations may pass only with limitations and required implementation corrections. Submit exactly the successful IDs and hashes. A pass approves only these images at concept-selection scope, never the three-image goal or implementation. Preserve FAIL; reassessment must bind supersedesFailedReview and explain reassessmentReason. Do not generate images or modify the host.'}:{}),
        controlAuditContract:{scope:'Inspect all visually actionable controls, including header icon buttons, against the bound host facts. Check required people/context content as well. Do not mistake expressive decoration for capability. Disclose unsupported controls without redrawing concepts; distinguish selectable direction from faithful implementation.',perDirection:{controlAudit:{scanEvidence:'Actual inspected regions',controls:[{label:'visible control meaning',location:'image region',status:'supported|unsupported|uncertain|decoration',sourceEvidence:'bound host evidence for supported controls',reason:'visual basis if decoration',implementationAction:'omit or confirm unsupported capability at implementation'}]}}},
        reviewFile,reviewShape:{reviewer:'actual independent identity',verdict:'pass or fail',directions:completed.filter(d=>!frozen.some(q=>q.id===d.id)).map(d=>({id:d.id,sha256:d.output.sha256,completeScreen:null,brandFaithful:null,hostTaskPreserved:null})),distinctCompositions:null,notes:'actual observed findings',limitations:[],presentationRequirements:[]},
        recordCommand:[process.execPath,entry,'record-image-concepts','--artifact-root',root,'--brand',brand,'--review',reviewFile]},
      nextAction:missing.length?'Execute this authorized batch only: generate pending directions once; checkpoint and show comparisonPreview immediately after each success. Do not regenerate checkpointed images or automatically retry failures. A later user request to continue generation opens a NEW three-image batch.':'Open standard comparisonPreview now as PENDING; execute only reviewRequest independently and record-image-concepts --review. Same URL refreshes to final result. Do not build custom comparison pages or claim completion before QA. No additional generation.'};
  }
  const receipt=read(receiptFile);validateReceipt(receipt,dispatch,root);verifyReassessment(receipt,failedFile);
  if(failureDelivery) return {...failureDelivery,previewStatus:'partial-approved',reviewNotes:receipt.independentReview.notes,presentationRequirements:receipt.independentReview.presentationRequirements||[],limitations:receipt.independentReview.limitations||[],receiptFile,failureGuidance:{...failureDelivery.failureGuidance,userMessage:`本轮已保存 ${completed.length}/3 张，已有图已通过独立审核；生成受阻的方向仍保留，三图目标未完成。`}};
  return {...state,previewAvailable:true,previewStatus:'approved',ok:true,status:'ready-for-user-review',userGoalCompleted:true,fullWorkflowPass:false,interactive:false,hostImplementationComplete:false,images:[...receipt.directions].sort((a,b)=>a.id.localeCompare(b.id)).map(d=>({id:d.id,...binding(d.path)})),comparisonPreview:{path:`/__brand_comparison__?brand=${encodeURIComponent(brand)}`,medium:'full-image'},reviewNotes:receipt.independentReview.notes,presentationRequirements:receipt.independentReview.presentationRequirements||[],limitations:receipt.independentReview.limitations||[],receiptFile,nextAction:'Open comparisonPreview using serve-design-host-h5.mjs with this artifact root. Show all three original images equally with review limitations; await user selection. This gallery is not a host H5 implementation.'};
}
