import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildLearningQaOutputContract, validateLearningQaAssessment } from './learn-brand-qa-output-contract.mjs';

export const reviewModes = ['initial-blind', 'fresh-blind', 'regression-review'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const arr = value => Array.isArray(value) ? value : [];
const isFrozenRule=ref=>/approved|brand-intent|design-direction|frozen.*rule|learning-trial/i.test(ref.path);
function effectiveProducerRules(root,manifest,stage,seen=new Set()) {
  assert(!seen.has(stage.id),'QA_REVIEW_PRODUCER_INPUT_CYCLE');seen.add(stage.id);
  const receipt=read(verifyReviewBinding(root,{path:stage.receiptPath,sha256:stage.receiptSha256})),direct=arr(receipt.inputs).filter(isFrozenRule);
  const previous=manifest.stages.slice(0,manifest.stages.indexOf(stage)).filter(item=>item.role!=='visualQA'&&item.receiptPath);
  const inherited=arr(receipt.inputs).flatMap(ref=>{
    // The consumed rule version is a leaf of the current design contract.
    // Its interpreter may have consumed an older version to produce this one.
    if (isFrozenRule(ref)) return [];
    const producer=[...previous].reverse().find(item=>arr(item.outputHashes).some(output=>output.path===ref.path&&output.sha256===ref.sha256));
    return producer?effectiveProducerRules(root,manifest,producer,new Set(seen)):[];
  });
  const directPaths = new Set(direct.map(ref=>ref.path));
  return [...new Map([...direct,...inherited.filter(ref=>!directPaths.has(ref.path))].map(ref=>[`${ref.path}@${ref.sha256}`,ref])).values()];
}
function isRenderedImage(target) {
  const bytes=fs.readFileSync(target),extension=path.extname(target).toLowerCase();
  if(extension==='.png')return bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0;
  if(extension==='.jpg'||extension==='.jpeg') {
    if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return false;
    for(let offset=2;offset+3<bytes.length;) {
      if(bytes[offset++]!==0xff)return false;
      while(bytes[offset]===0xff)offset++;
      const marker=bytes[offset++];
      if(marker===0xd9||marker===0xda)break;
      if(offset+2>bytes.length)return false;
      const size=bytes.readUInt16BE(offset);
      if(size<2||offset+size>bytes.length)return false;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return size>=7&&bytes.readUInt16BE(offset+3)>0&&bytes.readUInt16BE(offset+5)>0;
      offset+=size;
    }
    return false;
  }
  if(extension==='.webp')return bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16))&&bytes.readUInt32LE(16)>0;
  return false;
}
// QA reads rendering inputs and source facts, never the producer's work log.
export function isQaArtifact(name) {
  if (/(?:^|\/)(?:attempts|qa-reviews|receipts|dispatch)(?:\/|$)|self[-_]?test|repair|preservation|archive|rationale|handoff|assessment|verdict|conversation/i.test(name)) return false;
  if (/\.(?:html?|css|png|jpe?g|webp|svg|woff2?)$/i.test(name)) return true;
  return /(?:^|\/)(?:visual-pattern-inventory|generative-proof|(?:demo-)?screenshot-manifest|brand-intent|approved-visual-patterns|inline-svg-evidence|source-observation-manifest|brand-evidence|frozen-approved-learning-trial|held-out-challenge|source-runtime-inspection(?:-\d+)?|[^/]*source[^/]*evidence)\.json$/i.test(name);
}
function referencedQaFacts(root, docs) {
  const refs = new Map();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.path && /^[a-f0-9]{64}$/.test(value.sha256 || '') && isQaArtifact(value.path)) {
      verifyReviewBinding(root,value); refs.set(value.path,{path:value.path,sha256:value.sha256,kind:value.path.startsWith('output/')?'source-fact':'render-artifact'});
    }
    for (const nested of Object.values(value)) if (typeof nested === 'object') walk(nested);
  }
  for (const doc of docs) walk(doc);
  return [...refs.values()];
}
function priorCapturePaths(root, outputs, assessment) {
  const paths=new Set();
  const image=name=>typeof name === 'string' && /\.(?:png|jpe?g|webp)$/i.test(name);
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key,nested] of Object.entries(value)) {
      if (['path','screenshot','screenshotPath','capturePath'].includes(key) && image(nested)) paths.add(nested);
      if (typeof nested === 'object') walk(nested);
    }
  }
  walk(assessment);
  for (const ref of outputs) {
    if (image(ref.path)) paths.add(ref.path);
    if (image(ref.originalPath)) paths.add(ref.originalPath);
    if (/interaction|capture|visual-qa-assessment/i.test(ref.originalPath || ref.path) && /\.json$/i.test(ref.path)) walk(read(verifyReviewBinding(root,ref)));
  }
  return [...paths];
}
function file(root, relative) {
  const target = path.resolve(root, relative || '');
  assert(target.startsWith(path.resolve(root) + path.sep), 'QA_REVIEW_PATH_OUTSIDE_ROOT');
  for (let at = target; at !== path.resolve(root); at = path.dirname(at)) assert(!fs.lstatSync(at).isSymbolicLink(), 'QA_REVIEW_SYMLINK');
  return target;
}
export function verifyReviewBinding(root, binding) {
  assert(binding?.path && /^[a-f0-9]{64}$/.test(binding.sha256 || ''), 'QA_REVIEW_BINDING_REQUIRED');
  const target = file(root, binding.path);
  assert(hash(target) === binding.sha256, `QA_REVIEW_HASH_MISMATCH:${binding.path}`);
  return target;
}
function binding(root, target) { return { path: path.relative(root, target), sha256: hash(target) }; }
function preserved(root, migration, stage, ref, manifest = null) {
  const original = path.resolve(root, ref.path);
  if (fs.existsSync(original) && hash(original) === ref.sha256) return ref;
  for (const name of ['archive.json', 'producer-preservation-archive.json']) {
    const archive = path.join(migration, 'attempts', stage.id, name);
    if (!fs.existsSync(archive)) continue;
    const copy = arr(read(archive).archivedOutputs).find(item => item.originalPath === ref.path && item.sha256 === ref.sha256);
    if (copy) { verifyReviewBinding(root, copy); return { path: copy.path, sha256: copy.sha256, originalPath:ref.path }; }
  }
  manifest ||= read(path.join(migration,'execution-manifest.json'));
  for (const repair of arr(manifest.learningClosureRepairs)) {
    const rejection=read(verifyReviewBinding(root,repair.rejection));
    assert(repair.goalSha256===manifest.goalSha256 && rejection.schema==='brand-learning-closure-rejection/v1' && rejection.goalSha256===manifest.goalSha256,'QA_REVIEW_CLOSURE_GOAL_BINDING');
    const archivedStage=arr(rejection.stages).find(item=>item.id===stage.id);
    if (!archivedStage) continue;
    assert(JSON.stringify(archivedStage)===JSON.stringify(stage),'QA_REVIEW_CLOSURE_STAGE_BINDING');
    const receipt=read(verifyReviewBinding(root,{path:stage.receiptPath,sha256:stage.receiptSha256}));
    assert(receipt.goalSha256===manifest.goalSha256 && receipt.stageId===stage.id,'QA_REVIEW_CLOSURE_RECEIPT_BINDING');
    // QA inputs may name Interpreter-owned or Demo-owned outputs. The shared
    // closure snapshot stores those producers' exact bytes, not duplicate QA
    // input copies; match the receipt's old path/hash without changing history.
    const known=[...arr(receipt.inputs),...arr(receipt.outputs),...arr(stage.outputHashes),...(stage.qaReview?[stage.qaReview]:[])].some(item=>item.path===ref.path&&item.sha256===ref.sha256);
    if (!known) continue;
    const copy=arr(rejection.archivedOutputs).find(item=>item.originalPath===ref.path&&item.sha256===ref.sha256);
    if (copy) {verifyReviewBinding(root,copy);return {path:copy.path,sha256:copy.sha256,originalPath:ref.path};}
  }
  throw new Error(`QA_REVIEW_PRIOR_BYTES_UNAVAILABLE:${ref.path}`);
}
export function prepareQaReview({ root, brand, reviewMode, qaExecutionId, priorReceipt, affected = [], regressionScope = [], capacityErrorFile, replacePrepared = false }) {
  root = path.resolve(root);
  const migration = file(root, `migrations/${brand}`), manifestFile = path.join(migration, 'execution-manifest.json');
  const manifest = read(manifestFile), current = manifest.stages.find(stage => stage.id === manifest.currentStageId);
  assert(manifest.mode === 'learn-brand' && current?.role === 'visualQA' && current.status === 'pending', 'QA_REVIEW_PENDING_LEARN_QA_REQUIRED');
  // Remember the first v2 attempt before later validation can reject it. An
  // untouched legacy run may still use v1; a rejected v2 attempt cannot.
  if (current.qaReviewProtocol !== 'brand-qa-review-input/v2') {
    current.qaReviewProtocol = 'brand-qa-review-input/v2';
    current.qaReviewProtocolAdoptedAt = new Date().toISOString();
    fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  }
  assert(!current.qaReview || replacePrepared, 'QA_REVIEW_ALREADY_PREPARED');
  assert(!replacePrepared || current.qaReview, 'QA_REVIEW_REPLACEMENT_REQUIRES_PREPARED');
  let replacedReview = null, replacedHandoff = null, replacedArchive = null;
  const revokedInputViolations=[];
  if (current.qaReview) {
    const oldReview=read(verifyReviewBinding(root,current.qaReview));
    assert(oldReview.reviewId === current.reviewId && oldReview.stageId === current.id && oldReview.reviewMode === current.reviewMode && oldReview.qaExecutionId === current.qaExecutionId, 'QA_REVIEW_REPLACEMENT_BINDING_INVALID');
    validateQaReview(root,oldReview,null,{revokingPrepared:true,revokedInputViolations});
    assert(hash(path.join(migration,'qa-input-manifest.json')) === current.qaReview.sha256, 'QA_REVIEW_REPLACEMENT_CANONICAL_CHANGED');
    replacedReview={...current.qaReview,reviewId:oldReview.reviewId};
    replacedArchive=read(verifyReviewBinding(root,oldReview.priorArchive));
    replacedHandoff=current.qaReviewHandoff;
    const handoff=read(verifyReviewBinding(root,replacedHandoff));
    assert(handoff.reviewId === oldReview.reviewId && ['ready','waiting-capacity','reuse-original-qa'].includes(handoff.state), 'QA_REVIEW_REPLACEMENT_HANDOFF_INVALID');
    if (handoff.capacityError) verifyReviewBinding(root,handoff.capacityError);
  }
  const resolvePrior = (stage, ref) => {
    const copy=arr(replacedArchive?.archivedOutputs).find(item=>item.originalPath===ref.path && item.sha256===ref.sha256);
    if (copy) { verifyReviewBinding(root,copy); return {path:copy.path,sha256:copy.sha256,originalPath:ref.path}; }
    return preserved(root,migration,stage,ref,manifest);
  };
  const priorBytesUnavailable = error => error instanceof Error && error.message.startsWith('QA_REVIEW_PRIOR_BYTES_UNAVAILABLE:');
  const resolvePriorQaInput = (qaStage, ref) => {
    try { return resolvePrior(qaStage,ref); }
    catch (error) {
      // A QA receipt records producer inputs but does not necessarily own their
      // preservation copy. Only fall back after an actual absence, and only to
      // an earlier Demo whose hash-bound receipt names this exact path/hash.
      // Hash, closure-binding, or archive-integrity failures must stay fatal.
      if (!priorBytesUnavailable(error)) throw error;
      const earlier=manifest.stages.slice(0,manifest.stages.indexOf(qaStage));
      const demos=[...earlier].reverse().filter(stage=>stage.stage==='demo' && stage.receiptPath && stage.receiptSha256).filter(stage=>{
        const receipt=read(verifyReviewBinding(root,{path:stage.receiptPath,sha256:stage.receiptSha256}));
        assert(receipt.stageId===stage.id && receipt.goalSha256===manifest.goalSha256,'QA_REVIEW_PRIOR_DEMO_RECEIPT_BINDING');
        return [...arr(receipt.inputs),...arr(receipt.outputs)].some(item=>item.path===ref.path && item.sha256===ref.sha256);
      });
      for (const demoStage of demos) {
        try { return resolvePrior(demoStage,ref); }
        catch (demoError) { if (!priorBytesUnavailable(demoError)) throw demoError; }
      }
      throw error;
    }
  };
  assert(reviewModes.includes(reviewMode), 'QA_REVIEW_MODE_REQUIRED');
  assert(String(qaExecutionId).startsWith('/root/') && qaExecutionId !== '/root', 'QA_REVIEW_AGENT_REQUIRED');
  const goal = { path: manifest.goalPath || `migrations/${brand}/goal-contract.json`, sha256: manifest.goalSha256 };
  verifyReviewBinding(root, goal);
  const demo = [...manifest.stages].reverse().find(stage => stage.stage === 'demo' && stage.status === 'complete');
  assert(demo?.receiptPath && demo.agentExecutionId !== qaExecutionId, 'QA_REVIEW_PRODUCER_SELF_REVIEW');
  assert(!manifest.stages.some(stage => stage.role !== 'visualQA' && stage.agentExecutionId === qaExecutionId), 'QA_REVIEW_PRODUCER_SELF_REVIEW');
  const demoReceiptRef = { path: demo.receiptPath, sha256: demo.receiptSha256 };
  const demoReceipt = read(verifyReviewBinding(root, demoReceiptRef));
  assert(demoReceipt.stageId === demo.id && demoReceipt.verdict === 'pass' && demoReceipt.goalSha256 === goal.sha256, 'QA_REVIEW_CURRENT_DEMO_INVALID');
  assert(JSON.stringify(demoReceipt.outputs) === JSON.stringify(demo.outputHashes), 'QA_REVIEW_DEMO_OUTPUT_BINDING');
  for (const output of arr(demo.outputHashes)) {
    if (replacedReview && /qa-input-manifest\.json$/.test(output.path)) {
      const copy=arr(replacedArchive.archivedOutputs).find(ref=>ref.originalPath===output.path && ref.sha256===output.sha256);
      if (copy) verifyReviewBinding(root,copy); else preserved(root,migration,demo,output);
      continue;
    }
    verifyReviewBinding(root, output);
  }
  const priorStages = manifest.stages.filter(stage => stage.role === 'visualQA' && stage.receiptPath);
  const prior = priorStages.at(-1);
  let priorReviewReceipt = null, priorInputs = [], priorOutputs = [], unavailablePriorInputs = [], frozenInputs = [], sourceInputs = [], priorAssessment = null;
  if (reviewMode === 'initial-blind') assert(!priorStages.length, 'QA_REVIEW_INITIAL_HAS_PRIOR_REVIEW');
  if (reviewMode === 'fresh-blind') assert(priorStages.every(stage => stage.agentExecutionId !== qaExecutionId), 'QA_REVIEW_FRESH_AGENT_ALREADY_EXPOSED');
  if (reviewMode === 'fresh-blind' && prior) {
    const receipt = read(verifyReviewBinding(root,{path:prior.receiptPath,sha256:prior.receiptSha256}));
    assert(receipt.stageId===prior.id && receipt.role==='visualQA' && receipt.goalSha256===goal.sha256 && receipt.verdict===prior.verdict && JSON.stringify(arr(receipt.outputs))===JSON.stringify(arr(prior.outputHashes)),'QA_REVIEW_PRIOR_RECEIPT_INVALID');
    const dispatch=read(prior.dispatchSha256?verifyReviewBinding(root,{path:prior.dispatchPath,sha256:prior.dispatchSha256}):file(root,prior.dispatchPath));
    assert(dispatch.dispatchId===receipt.dispatchId && dispatch.stageId===prior.id && dispatch.goalSha256===goal.sha256,'QA_REVIEW_PRIOR_DISPATCH_INVALID');
    for (const ref of arr(dispatch.requiredInputs)) assert(arr(receipt.inputs).some(item=>item.path===ref.path&&item.sha256===ref.sha256),'QA_REVIEW_PRIOR_INPUT_BINDING');
    priorOutputs = arr(receipt.outputs).map(ref => resolvePrior(prior,ref));
    for (const ref of arr(receipt.inputs)) {
      try { priorInputs.push(resolvePriorQaInput(prior,ref)); }
      catch (error) {
        if (!priorBytesUnavailable(error)) throw error;
        unavailablePriorInputs.push({path:ref.path,sha256:ref.sha256,reason:'historical-bytes-not-preserved-before-same-path-producer-rewrite'});
      }
    }
  }
  if (reviewMode === 'regression-review') {
    assert(prior && prior.status === 'failed' && ['fail', 'needs-evidence'].includes(prior.verdict), 'QA_REVIEW_PRIOR_FAILURE_REQUIRED');
    assert(priorReceipt === prior.receiptPath, 'QA_REVIEW_LATEST_PRIOR_RECEIPT_REQUIRED');
    assert(prior.agentExecutionId === qaExecutionId && affected.length && regressionScope.length, 'QA_REVIEW_ORIGINAL_AGENT_AND_SCOPE_REQUIRED');
    priorReviewReceipt = { path: prior.receiptPath, sha256: prior.receiptSha256 };
    const receipt = read(verifyReviewBinding(root, priorReviewReceipt));
    assert(receipt.agentExecutionId === qaExecutionId && receipt.role === 'visualQA' && receipt.stageId === prior.id && receipt.verdict === prior.verdict && receipt.goalSha256 === goal.sha256, 'QA_REVIEW_PRIOR_RECEIPT_INVALID');
    assert(arr(receipt.deltaScope?.affectedSections).every(section=>affected.includes(section)) && arr(receipt.deltaScope?.regressionSections).every(section=>regressionScope.includes(section)), 'QA_REVIEW_PRIOR_SCOPE_OMITTED');
    assert(JSON.stringify(receipt.outputs) === JSON.stringify(prior.outputHashes), 'QA_REVIEW_PRIOR_OUTPUT_BINDING');
    const dispatch = read(file(root, prior.dispatchPath));
    assert(dispatch.dispatchId === receipt.dispatchId, 'QA_REVIEW_PRIOR_DISPATCH_INVALID');
    for (const ref of arr(dispatch.requiredInputs)) assert(arr(receipt.inputs).some(item => item.path === ref.path && item.sha256 === ref.sha256), 'QA_REVIEW_PRIOR_INPUT_BINDING');
    const oldDemo = [...manifest.stages.slice(0, manifest.stages.indexOf(prior))].reverse().find(stage => stage.stage === 'demo' && stage.receiptPath);
    assert(oldDemo && oldDemo.agentExecutionId !== qaExecutionId, 'QA_REVIEW_PRIOR_PRODUCER_SELF_REVIEW');
    priorInputs = arr(receipt.inputs).map(ref => resolvePriorQaInput(prior,ref));
    priorOutputs = arr(receipt.outputs).map(ref => resolvePrior(prior,ref));
    let oldManifestRef = prior.qaReview ? resolvePrior(prior,prior.qaReview) : null;
    if (!oldManifestRef) oldManifestRef = priorOutputs.find(ref => /qa-input-manifest\.json$/.test(ref.path)) || priorInputs.find(ref => /qa-input-manifest\.json$/.test(ref.path));
    if (!oldManifestRef) oldManifestRef = priorInputs.find(ref => {
      if (!/\.json$/i.test(ref.path)) return false;
      // Inspect a bounded schema header, not giant source/brand JSON bodies.
      const target=verifyReviewBinding(root,ref),handle=fs.openSync(target,'r'),header=Buffer.alloc(4096);
      let length;try {length=fs.readSync(handle,header,0,header.length,0);}finally{fs.closeSync(handle);}
      return /"schema"\s*:\s*"(?:brand-qa-review-input\/v2|brand-blind-qa-input\/v1)"/.test(header.subarray(0,length).toString('utf8'));
    });
    assert(oldManifestRef, 'QA_REVIEW_PRIOR_MANIFEST_REQUIRED');
    const oldManifest = read(verifyReviewBinding(root, oldManifestRef));
    assert(oldManifest.qaExecutionId === qaExecutionId && oldManifest.implementationExecutionId !== qaExecutionId, 'QA_REVIEW_PRIOR_INDEPENDENCE_INVALID');
    const oldDemoReceipt = read(verifyReviewBinding(root, {path: oldDemo.receiptPath, sha256: oldDemo.receiptSha256}));
    const oldDemoPaths = new Set(arr(oldDemoReceipt.outputs).map(ref => ref.path));
    sourceInputs = arr(oldManifest.allowedInputs).filter(ref => !oldDemoPaths.has(ref.path) && isQaArtifact(ref.path) && !/(?:visual-pattern-inventory|generative-proof|screenshot-manifest)\.json$/.test(ref.path));
    for (const ref of sourceInputs) verifyReviewBinding(root,ref);
    frozenInputs = [...arr(oldManifest.frozenInputs), ...arr(oldDemoReceipt.inputs).filter(isFrozenRule)];
    assert(frozenInputs.length, 'QA_REVIEW_FROZEN_RULE_BINDING_REQUIRED');
    for (const ref of frozenInputs) verifyReviewBinding(root, ref);
    const ruleSet=refs=>[...new Set(refs.filter(isFrozenRule).map(ref=>ref.path+'@'+ref.sha256))].sort();
    assert(JSON.stringify(ruleSet(frozenInputs))===JSON.stringify(ruleSet(effectiveProducerRules(root,manifest,demo))),'QA_REVIEW_CURRENT_PRODUCER_RULES_CHANGED_REQUIRES_FRESH');
    const assessmentRef = priorOutputs.find(ref => /visual-qa-assessment\.json$/.test(ref.path));
    assert(assessmentRef, 'QA_REVIEW_PRIOR_ASSESSMENT_REQUIRED');
    priorAssessment = read(verifyReviewBinding(root, assessmentRef));
    assert(priorAssessment.reviewerRecommendation !== 'pass', 'QA_REVIEW_OLD_PASS_FORBIDDEN');
  }
  const reviewId = crypto.randomUUID(), archiveDir = path.join(migration, 'qa-reviews', reviewId);
  const copies = [];
  const priorCurrentManifest = arr(demo.outputHashes).filter(ref => /qa-input-manifest\.json$/.test(ref.path)).map(ref=> {
    if (!replacedReview) return ref;
    return arr(replacedArchive.archivedOutputs).find(copy=>copy.originalPath===ref.path && copy.sha256===ref.sha256) || preserved(root,migration,demo,ref);
  });
  for (const ref of [...priorInputs, ...priorOutputs, ...priorCurrentManifest, ...(replacedReview?[replacedReview,replacedHandoff]:[])]) {
    const target = path.join(archiveDir, 'prior', ref.path);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    if (!fs.existsSync(target)) fs.copyFileSync(verifyReviewBinding(root, ref), target, fs.constants.COPYFILE_EXCL);
    copies.push({...binding(root, target), originalPath: ref.originalPath || ref.path});
  }
  fs.mkdirSync(archiveDir, {recursive: true});
  const archiveFile = path.join(archiveDir, 'archive.json');
  fs.writeFileSync(archiveFile, JSON.stringify({schema:'brand-qa-review-archive/v1', priorReviewReceipt, replacedReview, unavailablePriorInputs, archivedOutputs:copies}, null, 2) + '\n', {flag:'wx'});
  const goalData = read(verifyReviewBinding(root,goal));
  const sourceCaptures = arr(goalData.referencePages).map(page => page.screenshot).filter(Boolean).map(name => binding(root,file(root,name)));
  if (reviewMode !== 'regression-review') {
    frozenInputs = effectiveProducerRules(root,manifest,demo);
    // An in-place repair consumes the old page and emits a new version at the
    // same path. The old input remains in history, not in the current QA packet.
    // Frozen rules must still be verified even if a producer rewrites them.
    const currentOutputPaths = new Set(arr(demo.outputHashes).map(ref => ref.path));
    sourceInputs = arr(demoReceipt.inputs).filter(ref => isQaArtifact(ref.path) && (!currentOutputPaths.has(ref.path) || isFrozenRule(ref)) && !/(?:visual-pattern-inventory|generative-proof|screenshot-manifest)\.json$/.test(ref.path));
    for (const ref of sourceInputs) verifyReviewBinding(root,ref);
  }
  for (const ref of frozenInputs) verifyReviewBinding(root,ref);
  const renderInputs = arr(demo.outputHashes).filter(ref => isQaArtifact(ref.path));
  const documents = renderInputs.filter(ref=>/(?:visual-pattern-inventory|screenshot-manifest)\.json$/.test(ref.path)).map(ref=>read(verifyReviewBinding(root,ref)));
  const inputs = [...new Map([...renderInputs, ...sourceInputs, ...sourceCaptures, ...referencedQaFacts(root,documents), goal].map(ref=>[ref.path,ref])).values()];
  const review = {schema:'brand-qa-review-input/v2', reviewMode, reviewId, qaExecutionId, implementationExecutionId:demo.agentExecutionId, goalBinding:goal, goalSha256:goal.sha256, stageId:current.id, preparedAt:new Date().toISOString(), currentDemoReceipt:demoReceiptRef, currentDemoOutputs:demo.outputHashes, priorReviewReceipt, priorArchive:binding(root, archiveFile), unavailablePriorInputs, frozenInputs, affected, regressionScope, allowedInputs:inputs, forbiddenInputsAbsent:{implementationRationale:true, priorVerdict:reviewMode !== 'regression-review', priorInputs:reviewMode !== 'regression-review', buildPassAsVisualEvidence:true, mainConversation:true}, priorCapturePaths:priorCapturePaths(root,priorOutputs,priorAssessment)};
  const inventory = documents.find(document => document.schema === 'brand-visual-pattern-inventory/v1');
  const completionContract = buildLearningQaOutputContract(goalData, inventory);
  if (completionContract) {
    assert(inventory?.schema === 'brand-visual-pattern-inventory/v1', 'QA_REVIEW_PATTERN_ATTEMPT_REQUIRED');
    if (Object.hasOwn(inventory, 'attempt')) {
      assert(Number.isInteger(inventory.attempt) && inventory.attempt > 0, 'QA_REVIEW_PATTERN_ATTEMPT_REQUIRED');
      review.attempt = inventory.attempt;
      review.attemptSource = { kind: 'inventory' };
    } else {
      // Quality attempts and workflow retries are different counters. Only the
      // untouched first producer can corroborate the existing quality default.
      const producers = manifest.stages.filter(stage => stage.stage === 'demo');
      assert(reviewMode === 'initial-blind' && producers.length === 1 && demo.attempt === 1, 'QA_REVIEW_PATTERN_ATTEMPT_REQUIRED');
      if (Object.hasOwn(demoReceipt, 'attempt')) assert(demoReceipt.attempt === 1, 'QA_REVIEW_PATTERN_ATTEMPT_CONFLICT');
      review.attempt = 1;
      review.attemptSource = { kind: 'initial-quality-default', stageId: demo.id, producerAttempt: demo.attempt, receipt: demoReceiptRef };
      completionContract.qualityAttempt = 'assessment.attempt must match qa-input-manifest.attempt (quality default 1, corroborated by the first producer). Omitted inventory.attempt retains its declared default; do not modify frozen inventory.';
    }
    review.completionContract = completionContract;
  }
  if (reviewMode === 'regression-review') review.allowedInputs.push({...priorReviewReceipt, kind:'prior-review-receipt'}, ...copies.filter(ref => /visual-qa-assessment\.json$/.test(ref.path)).map(ref => ({...ref,kind:'prior-verdict'})));
  const error = capacityErrorFile ? binding(root, file(root, capacityErrorFile)) : null;
  if (error) assert(/agent thread limit reached|capacity|resource.*limit/i.test(fs.readFileSync(verifyReviewBinding(root,error),'utf8')), 'QA_REVIEW_CAPACITY_ERROR_REQUIRED');
  const handoff = {schema:'brand-qa-review-handoff/v1', reviewId, reviewMode, qaExecutionId, state:reviewMode === 'regression-review' ? 'reuse-original-qa' : error ? 'waiting-capacity' : 'ready', capacityError:error, spawnAttempted:false};
  const reviewFile = path.join(archiveDir, 'input.json');
  fs.writeFileSync(reviewFile, JSON.stringify(review,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(migration,'qa-input-manifest.json'),JSON.stringify(review,null,2)+'\n');
  const handoffFile=path.join(migration,'qa-review-handoff.json');
  fs.writeFileSync(handoffFile,JSON.stringify(handoff,null,2)+'\n');
  current.qaReview = binding(root,reviewFile);
  current.qaReviewHandoff = binding(root,handoffFile);
  if (replacedReview) {
    current.qaReviewReplacements ||= [];
    current.qaReviewReplacements.push({priorReview:replacedReview,priorHandoff:replacedHandoff,replacementReviewId:reviewId,archive:binding(root,archiveFile),authorizedBy:'explicit-replace-prepared',replacedAt:new Date().toISOString(),...(revokedInputViolations.length?{priorInvalidReason:'QA_REVIEW_FORBIDDEN_INPUT',revokedInputViolations}: {})});
  }
  current.reviewMode = reviewMode; current.reviewId = reviewId; current.qaExecutionId = qaExecutionId;
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  return {review, handoff};
}
export function validateQaReview(root, review, assessment, {revokingPrepared=false,revokedInputViolations=[],receiptVerdict=null,receiptOutputs=[]}={}) {
  if (review?.schema === 'brand-blind-qa-input/v1') return {reviewMode:'initial-blind'};
  assert(review?.schema === 'brand-qa-review-input/v2' && reviewModes.includes(review.reviewMode) && review.reviewId, 'QA_REVIEW_CONTRACT_INVALID');
  assert(review.qaExecutionId !== review.implementationExecutionId, 'QA_REVIEW_PRODUCER_SELF_REVIEW');
  for (const ref of [...arr(review.frozenInputs), ...arr(review.currentDemoOutputs).filter(ref => !/qa-input-manifest\.json$/.test(ref.path)), ...arr(review.allowedInputs), review.goalBinding, review.currentDemoReceipt, review.priorArchive].filter(Boolean)) verifyReviewBinding(root,ref);
  assert(review.goalBinding?.sha256 === review.goalSha256, 'QA_REVIEW_GOAL_BINDING');
  for (const input of arr(review.allowedInputs)) {
    const priorAllowed=review.reviewMode === 'regression-review' && ['prior-review-receipt','prior-verdict'].includes(input.kind);
    const isGoal=input.path === review.goalBinding.path;
    const valid=(priorAllowed || isGoal || isQaArtifact(input.path)) && !/rationale|implementation-handoff|conversation/i.test(input.kind || '');
    if (!valid && revokingPrepared && /\.(?:cjs|mjs|js)$|self[-_]?test|repair|producer-preservation-archive/i.test(input.path) && !/rationale|conversation/i.test(`${input.kind || ''} ${input.path}`)) {
      revokedInputViolations.push({path:input.path,sha256:input.sha256,code:'QA_REVIEW_FORBIDDEN_INPUT'});
    } else assert(valid,'QA_REVIEW_FORBIDDEN_INPUT');
  }
  const archive = read(verifyReviewBinding(root,review.priorArchive));
  for (const ref of arr(archive.archivedOutputs)) verifyReviewBinding(root,ref);
  assert(JSON.stringify(arr(archive.unavailablePriorInputs))===JSON.stringify(arr(review.unavailablePriorInputs)),'QA_REVIEW_UNAVAILABLE_PRIOR_INPUT_BINDING');
  const unavailableKeys=new Set();
  for (const ref of arr(review.unavailablePriorInputs)) {
    assert(review.reviewMode==='fresh-blind' && ref?.path && /^[a-f0-9]{64}$/.test(ref.sha256||'') && ref.reason==='historical-bytes-not-preserved-before-same-path-producer-rewrite','QA_REVIEW_UNAVAILABLE_PRIOR_INPUT_INVALID');
    const key=`${ref.path}@${ref.sha256}`;assert(!unavailableKeys.has(key),'QA_REVIEW_UNAVAILABLE_PRIOR_INPUT_INVALID');unavailableKeys.add(key);
    assert(![...arr(review.allowedInputs),...arr(review.frozenInputs)].some(item=>item.path===ref.path&&item.sha256===ref.sha256),'QA_REVIEW_UNAVAILABLE_PRIOR_INPUT_EXPOSED');
  }
  if (review.priorReviewReceipt) verifyReviewBinding(root,review.priorReviewReceipt);
  if (review.reviewMode === 'regression-review') {
    assert(review.priorReviewReceipt && arr(review.affected).length && arr(review.regressionScope).length && arr(review.frozenInputs).length, 'QA_REVIEW_REGRESSION_SCOPE_REQUIRED');
    const prior = read(verifyReviewBinding(root,review.priorReviewReceipt));
    assert(prior.agentExecutionId === review.qaExecutionId && prior.goalSha256 === review.goalSha256 && ['fail','needs-evidence'].includes(prior.verdict), 'QA_REVIEW_PRIOR_FAILURE_REQUIRED');
    assert(arr(prior.deltaScope?.affectedSections).every(section=>review.affected.includes(section)) && arr(prior.deltaScope?.regressionSections).every(section=>review.regressionScope.includes(section)), 'QA_REVIEW_PRIOR_SCOPE_OMITTED');
  }
  for (const key of ['implementationRationale','buildPassAsVisualEvidence','mainConversation']) assert(review.forbiddenInputsAbsent?.[key] === true, 'QA_REVIEW_FORBIDDEN_INPUT');
  if (review.reviewMode !== 'regression-review') assert(review.forbiddenInputsAbsent?.priorVerdict === true && !review.priorReviewReceipt, 'QA_REVIEW_FRESH_PRIOR_VERDICT');
  if (review.reviewMode !== 'regression-review') assert(review.forbiddenInputsAbsent?.priorInputs === true, 'QA_REVIEW_FRESH_PRIOR_INPUT');
  if (assessment) {
    assert(assessment.reviewId === review.reviewId && assessment.reviewMode === review.reviewMode && assessment.qaExecutionId === review.qaExecutionId, 'QA_REVIEW_ASSESSMENT_IDENTITY');
    const captures = arr(assessment.captureEvidence);
    assert(captures.length, 'QA_REVIEW_NEW_CAPTURE_REQUIRED');
    const oldPaths = new Set(arr(review.priorCapturePaths));
    const producerPaths = new Set(arr(review.currentDemoOutputs).map(ref=>ref.path));
    const capturePaths=new Set();
    for (const ref of captures) {
      const target=verifyReviewBinding(root,ref);
      assert(isRenderedImage(target), 'QA_REVIEW_CAPTURE_IMAGE_REQUIRED');
      assert(!oldPaths.has(ref.path) && !producerPaths.has(ref.path) && !ref.path.includes('/prior/') && ref.reviewId === review.reviewId && Number.isFinite(Date.parse(ref.capturedAt)) && Date.parse(ref.capturedAt) >= Date.parse(review.preparedAt), 'QA_REVIEW_INHERITED_CAPTURE_FORBIDDEN');
      capturePaths.add(ref.path);
    }
    if(receiptVerdict==='pass'||assessment.reviewerRecommendation==='pass') {
      validateLearningQaAssessment(assessment, review.completionContract);
      assert(arr(assessment.pages).length, 'QA_REVIEW_PASSED_PAGES_REQUIRED');
      for(const page of assessment.pages) {
        const refs=arr(page.evidenceRefs).map(ref=>typeof ref==='string'?ref:ref?.path);
        assert(refs.length&&refs.some(ref=>capturePaths.has(ref)), 'QA_REVIEW_PAGE_CURRENT_CAPTURE_REQUIRED');
        if(page.demoScreenshot)assert(capturePaths.has(typeof page.demoScreenshot==='string'?page.demoScreenshot:page.demoScreenshot.path),'QA_REVIEW_PAGE_CURRENT_CAPTURE_REQUIRED');
      }
      if(review.reviewMode==='regression-review') {
        const scope=assessment.reviewScope;
        assert(arr(review.affected).every(section=>arr(scope?.affected).includes(section))&&arr(review.regressionScope).every(section=>arr(scope?.regressionScope).includes(section)),'QA_REVIEW_SCOPE_INCOMPLETE');
        for(const section of review.regressionScope) {
          const result=arr(assessment.regressionResults).find(item=>item.section===section);
          assert(result&&['pass','pass-within-frozen-static-trial'].includes(result.verdict)&&arr(result.evidenceRefs).some(ref=>capturePaths.has(typeof ref==='string'?ref:ref?.path)),'QA_REVIEW_REGRESSION_RESULT_NOT_PASSING');
        }
        const prior=read(verifyReviewBinding(root,review.priorReviewReceipt));
        for(const finding of arr(prior.blockingFindings)) {
          const id=typeof finding==='string'?finding:finding.id||finding.code;
          if(!id)continue;
          const result=arr(assessment.priorFailureResolution).find(item=>item.id===id);
          assert(result?.verdict==='resolved'&&arr(result.evidenceRefs).some(ref=>capturePaths.has(typeof ref==='string'?ref:ref?.path)),'QA_REVIEW_PRIOR_FAILURE_UNRESOLVED');
        }
      }
      const interaction=assessment.actualInteractionEvidence;
      assert(interaction?.path&&/\.json$/i.test(interaction.path),'QA_REVIEW_INTERACTION_EVIDENCE_REQUIRED');
      const receiptRef=arr(receiptOutputs).find(ref=>ref.path===interaction.path);
      if(receiptVerdict==='pass')assert(receiptRef,'QA_REVIEW_INTERACTION_RECEIPT_OUTPUT_REQUIRED');
      const interactionRef=receiptRef||{path:interaction.path,sha256:interaction.sha256};
      const record=read(verifyReviewBinding(root,interactionRef));
      assert(record.reviewId===review.reviewId&&record.qaExecutionId===review.qaExecutionId&&record.newObservation===true&&arr(record.browser?.captureEvidence).some(ref=>capturePaths.has(typeof ref==='string'?ref:ref?.path)),'QA_REVIEW_INTERACTION_IDENTITY_INVALID');
    }
  }
  return review;
}
