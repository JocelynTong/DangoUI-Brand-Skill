import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { evaluateSourceContinuation, evaluatePreviewContinuation, materializeHostContinuation, evaluateHostDelivery, evaluateLearningDispatch, evaluateHostContinuation, evaluateHostDispatch, normalizeHostRecommendation } from './parent-delivery-gate.mjs';
import { createSourceLearningGoal } from './source-learning-goal.mjs';
import { createBrandTestDirectory } from './brand-test-directory.mjs';
import { createLearningFidelityTestFixture } from './learning-fidelity-test-fixture.mjs';

function directHostFixture(t, mode) {
  const owned = createBrandTestDirectory('direct-host-continuation');
  t.after(() => owned.cleanup());
  const root = path.join(owned.directory, 'run/build'), brand = 'direct-host';
  const host = path.join(owned.directory, 'host');
  fs.mkdirSync(host, { recursive: true });
  const prefix = `migrations/${brand}/`;
  const save = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); return { path: name, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }; };
  const goal = save(`${prefix}goal-contract.json`, { sealed: true, brand, mode, hostTarget: host, requestKind: mode === 'apply-host' ? 'host-implementation' : 'host-concepts' });
  save('../run.json', { schema: 'brand-artifact-run/v1', status: 'active', host });
  const stage = mode === 'apply-host' ? 'hostStrategy' : 'startupPageStrategy';
  const manifest = { brand, mode, runId: 'direct-run', status: 'running', goalPath: goal.path, goalSha256: goal.sha256, executionProfile: 'standard', currentStageId: `${stage}-1`, stages: [{ id: `${stage}-1`, stage, role: 'hostStrategist', attempt: 1, status: 'pending' }] };
  for (const name of mode === 'apply-host' ? ['host-page-inventory.json', 'apply-host-preflight.json', 'design-direction.json'] : ['host-startup-page.json', 'design-host-preflight.json', 'scaffolds/host-startup-baseline.template.json', 'scaffolds/fast-host-brief.template.json']) save(`${prefix}${name}`, {});
  const flush = () => save(`${prefix}execution-manifest.json`, manifest);
  flush();
  const entry = process.env.BRAND_TEST_ENTRY || path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
  const call = (args = []) => {
    const response = spawnSync(process.execPath, [entry, 'continue', '--artifact-root', root, ...args], { encoding: 'utf8', timeout: 30000 });
    assert.ok(response.stdout.trim(), response.stderr);
    return { code: response.status, value: JSON.parse(response.stdout), stderr: response.stderr };
  };
  return { root, brand, prefix, goal, save, manifest, flush, call };
}

for (const mode of ['design-host', 'apply-host']) {
  test(`direct ${mode} public continue dispatches pending once and reuses the bound dispatch read-only`, t => {
    const f = directHostFixture(t, mode);
    assert.equal(evaluateHostContinuation({ root: f.root }).nextAction, 'continue-host-stage');
    const first = f.call();
    assert.equal(first.code, 0, JSON.stringify(first));
    assert.equal(first.value.brand, f.brand);
    assert.ok(first.value.dispatchRequest.dispatchId);
    const bytes = fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json'));
    for (const args of [[], ['--brand', f.brand]]) {
      const reused = f.call(args);
      assert.equal(reused.code, 0, JSON.stringify(reused));
      assert.equal(reused.value.reusedDispatch, true);
      assert.deepEqual(reused.value.dispatchRequest, first.value.dispatchRequest);
      assert.equal(reused.value.userGoalCompleted, false);
      assert.equal(reused.value.fullWorkflowPass, false);
      assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json')), bytes);
    }
    assert.equal(fs.existsSync(path.join(f.root, 'source-prerequisite.json')), false);
    const input = first.value.dispatchRequest.requiredInputs.find(ref => ref.path !== f.goal.path);
    f.save(input.path, { changed: true });
    const stale = f.call();
    assert.equal(stale.code, 1);
    assert.ok(stale.value.errors.includes('HOST_DISPATCH_BINDING_INVALID'));
    assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json')), bytes);
  });

  test(`direct ${mode} reports the blocked owner repeatedly without reopening its failed attempt`, t => {
    const f = directHostFixture(t, mode);
    const stage = f.manifest.stages[0];
    Object.assign(stage, { status: 'failed', verdict: 'needs-evidence', dispatchId: 'failed-dispatch', agentExecutionId: '/root/host-strategy', blockingFindings: [{ code: 'HOST_DATA_UNRESOLVED' }] });
    const receipt = f.save(`${f.prefix}receipts/failed.json`, { ...stage, stageId: stage.id, goalSha256: f.goal.sha256, failureOwnerRole: stage.role });
    Object.assign(stage, { receiptPath: receipt.path, receiptSha256: receipt.sha256 });
    f.manifest.status = 'blocked'; f.manifest.currentStageId = null; f.flush();
    const bytes = fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json'));
    for (let n = 0; n < 2; n++) {
      const blocked = f.call();
      assert.equal(blocked.code, 1);
      assert.equal(blocked.value.blockingStage, stage.id);
      assert.equal(blocked.value.blockingFindings[0].code, 'HOST_DATA_UNRESOLVED');
      assert.equal(blocked.value.automaticRetryAllowed, false);
      assert.ok(!blocked.value.errors.includes('SOURCE_PREREQUISITE_INVALID'));
      assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json')), bytes);
    }
  });
}

test('direct host continuation refuses ambiguous identity, changed Goal and changed dispatch', t => {
  const f = directHostFixture(t, 'apply-host');
  f.save('migrations/other/execution-manifest.json', { ...f.manifest, brand: 'other' });
  assert.ok(evaluateHostContinuation({ root: f.root }).errors.includes('HOST_CONTINUATION_BRAND_AMBIGUOUS'));
  assert.equal(evaluateHostContinuation({ root: f.root, brand: f.brand }).status, 'pending');
  assert.equal(evaluateHostContinuation({ root: f.root, brand: 'missing' }).status, 'blocked');
  const first = f.call(['--brand', f.brand]);
  assert.equal(first.code, 0, JSON.stringify(first));
  f.save(first.value.dispatchFile, { ...first.value.dispatchRequest, role: 'hostImplementationAgent' });
  assert.ok(evaluateHostContinuation({ root: f.root, brand: f.brand }).errors.includes('HOST_DISPATCH_BINDING_INVALID'));
  f.save(f.goal.path, { sealed: true, mode: 'apply-host' });
  assert.ok(evaluateHostContinuation({ root: f.root, brand: f.brand }).errors.includes('HOST_CONTINUATION_GOAL_INVALID'));
});

test('host pending dispatch reports its actual next blocker without a source failure', () => {
  const result = evaluateHostDispatch({ status: 'pending', currentStageId: 'expressiveAssetGeneration-1', userGoalCompleted: false }, { exitCode: 1, dispatch: null, stderr: 'IMAGE_GENERATION_CAPABILITY_UNDECLARED: declare the actual capability' });
  assert.equal(result.blockingCode, 'IMAGE_GENERATION_CAPABILITY_UNDECLARED');
  assert.equal(result.blockingStage, 'expressiveAssetGeneration-1');
  assert.equal(result.userGoalCompleted, false);
});

test('public continuation cannot present a failed prerequisite as a ready dispatch', () => {
  const pending = { ok: true, status: 'pending', errors: [], parentRequestKind: 'host-concepts', userGoalCompleted: false, hostMutationAllowed: false };
  for (const outcome of [
    { exitCode: 1, dispatch: { ok: false, blockingCode: 'PUBLIC_REGISTRY_UNAVAILABLE' } },
    { exitCode: 1, dispatch: { ok: false, step: 'extract-third-party', blockingResult: { blockingCode: 'EXTRACTOR_RUNTIME_UNAVAILABLE' } } },
    { exitCode: null, dispatch: null },
    { exitCode: 0, dispatch: { ok: false } },
  ]) {
    const result = evaluateLearningDispatch(pending, outcome);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'blocked');
    assert.equal(result.userGoalCompleted, false);
    assert.equal(result.hostMutationAllowed, false);
    assert.equal(result.fullWorkflowPass, false);
    assert.ok(result.errors.length);
  }
  const ready = evaluateLearningDispatch(pending, { exitCode: 0, dispatch: { ok: true, status: 'dispatched' } });
  assert.equal(ready.status, 'pending');
  assert.equal(ready.userGoalCompleted, false);
  assert.equal(ready.dispatch.status, 'dispatched');
});

function fixture(t, { root: suppliedRoot, host = '/tmp/host-source' } = {}) {
  const owned = suppliedRoot ? null : createBrandTestDirectory('parent-gate');
  const root = suppliedRoot || owned.directory;
  fs.mkdirSync(root, { recursive: true });
  if (owned) t.after(() => owned.cleanup());
  const brand = 'onepiece-cardgame';
  const prefix = `migrations/${brand}/`;
  const save = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value)); return ref(name); };
  const ref = (name) => ({ path: name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex') });
  const sourceUrl = 'https://asia-en.onepiece-cardgame.com/';
  const parentArgs = ['run', '--request-kind', 'host-concepts', '--mode', 'design-host', '--concept-medium', 'interactive-h5', '--brand', brand, '--profile', 'fast', '--host-target', host, '--source-url', sourceUrl, '--artifact-root', root, '--platform', 'h5'];
  save('source-prerequisite.json', { schema: 'brand-source-prerequisite/v1', parentRequestKind: 'host-concepts', sourceUrl, brand, hostTarget: host, artifactRoot: root, requestedProfile: 'fast', hostMutationAllowed: false, parentArgs, learning: { entry: '/skill/run-brand-workflow.mjs', args: ['run'] }, resume: { requestKind: 'host-concepts', mode: 'design-host' } });
  const screenshot = save(`${prefix}captures/source.png`, 'source pixels');
  const goal = save(`${prefix}goal-contract.json`, createSourceLearningGoal({ root, brand, sourceUrl, profile: 'fast', handoffFile: path.join(root, 'source-prerequisite.json'), sourceScreenshot: screenshot.path }));
  const dimensions = ['color', 'typography', 'radius', 'spacing', 'shadow', 'action-color'];
  const evidence = save(`${prefix}brand-evidence.json`, { claims: dimensions.map((id) => ({ id, status: 'observed', salience: 'high' })), dimensionCoverage: Object.fromEntries(dimensions.map((id) => [id, { status: 'observed', claimIds: [id], sourceCount: 1 }])) });
  const intent = save(`${prefix}brand-intent.json`, { mappingCoverage: Object.fromEntries(dimensions.map((id) => [id, { status: 'mapped', evidenceRefs: [id], sourceCount: 1, targetToken: `--du-${id}`, reason: 'Scoped current source', priorityReason: 'Task critical' }])) });
  const mod = JSON.parse(fs.readFileSync('public/brand-registry/v0.1/brands/onepiece-cardgame/0.1.0/brand-mod.json', 'utf8'));
  mod.assets = mod.assets.map((asset, index) => { const assetPath = `public/assets/fixture-${index}.txt`; const item = save(assetPath, `asset ${index}`); return { ...asset, localPath: assetPath, sourceSha256: item.sha256 }; });
  const modRef = save(`${prefix}brand-mod.json`, mod);
  const demo = save(`${prefix}demo.html`, '<html>Learning demo</html>');
  const quality=createLearningFidelityTestFixture({root,brand,goal:JSON.parse(fs.readFileSync(path.join(root,goal.path))),goalRef:goal,save});
  const fidelity=quality.fidelityRef;
  const manifest = { mode: 'learn-brand', status: 'complete', goalSha256: goal.sha256, stages: [] };
  function stage(name, role, outputs, inputs = [goal]) {
    const id = `${name}-1`;
    const entry = { id, stage: name, role, dispatchId: `dispatch-${id}`, status: 'complete', verdict: 'pass', agentExecutionId: `/root/${name}`, outputHashes: outputs };
    const receipt = save(`${prefix}receipts/${id}.json`, { ...entry, stageId: id, goalSha256: manifest.goalSha256, inputs, outputs });
    entry.receiptPath = receipt.path; entry.receiptSha256 = receipt.sha256;
    manifest.stages.push(entry);
    return entry;
  }
  stage('evidence', 'brandResearcher', [evidence]);
  stage('interpreter', 'designTranslator', [intent, modRef], [goal, evidence]);
  stage('demo', 'demoImplementationAgent', [demo], [goal, modRef]);
  stage('visualQA', 'visualQA', [quality.assessmentRef,fidelity], [goal, modRef, demo,quality.qaInputRef]);
  const flush = () => save(`${prefix}execution-manifest.json`, manifest);
  flush();
  return { root, brand, prefix, save, ref, flush, manifest, stage, mod, modRef, goal,quality };
}

test('learning completion resumes original host arguments and is never user delivery', (t) => {
  const f = fixture(t);
  const gate = evaluateSourceContinuation({ root: f.root });
  assert.equal(gate.status, 'resume-ready', JSON.stringify(gate));
  assert.equal(gate.userGoalCompleted, false);
  assert.ok(gate.resume.args.includes('--platform'));
  assert.equal(gate.resume.args.includes('--source-url'), false);
  assert.equal(gate.resume.artifactRoot, path.join(f.root, 'host-preview', 'build'));
  const oldManifest = fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json'));
  assert.equal(materializeHostContinuation({ root: f.root }).status, 'resume-ready');
  assert.equal(materializeHostContinuation({ root: f.root }).status, 'resume-ready');
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json')), oldManifest);
  assert.ok(fs.existsSync(path.join(gate.resume.artifactRoot, 'source-continuation.json')));
  assert.ok(fs.existsSync(path.join(gate.resume.artifactRoot, f.mod.assets[0].localPath)));
});

function v2ReviewAliasFixture(t) {
  const f=fixture(t),qa=f.manifest.stages.find(stage=>stage.stage==='visualQA'),reviewId='bound-review',now=new Date().toISOString();
  const archive=f.save(`${f.prefix}qa-reviews/${reviewId}/archive.json`,{archivedOutputs:[]});
  const capture=f.save(`${f.prefix}qa-reviews/${reviewId}/new.png`,fs.readFileSync(path.join(f.root,f.quality.assessment.pages[0].demoScreenshot.path)));
  const input={...f.quality.qaInput,schema:'brand-qa-review-input/v2',reviewId,reviewMode:'initial-blind',stageId:qa.id,preparedAt:now,goalBinding:f.goal,priorArchive:archive,forbiddenInputsAbsent:{...f.quality.qaInput.forbiddenInputsAbsent,priorInputs:true}};
  const canonical=f.save(`${f.prefix}qa-input-manifest.json`,input),alias=f.save(`${f.prefix}qa-reviews/${reviewId}/input.json`,input);
  const interactions=f.save(`${f.prefix}qa-reviews/${reviewId}/interactions.json`,{reviewId,qaExecutionId:input.qaExecutionId,newObservation:true,browser:{captureEvidence:[capture]}});
  const assessment={...f.quality.assessment,reviewId,reviewMode:'initial-blind',actualInteractionEvidence:interactions,captureEvidence:[{...capture,reviewId,capturedAt:now}],pages:f.quality.assessment.pages.map(page=>({...page,demoScreenshot:capture,evidenceRefs:[capture.path]}))};
  const assessmentRef=f.save(`${f.prefix}visual-qa-assessment.json`,assessment);
  const run=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/validate-brand-fidelity.mjs'),'--root',f.root,'--brand',f.brand],{encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const report=f.save(`${f.prefix}fidelity-report.json`,JSON.parse(run.stdout)),receipt=JSON.parse(fs.readFileSync(path.join(f.root,qa.receiptPath)));
  receipt.inputs=receipt.inputs.map(ref=>ref.path===canonical.path?alias:ref);receipt.outputs=[assessmentRef,report,interactions];
  Object.assign(qa,{qaReview:alias,reviewId,receiptSha256:f.save(qa.receiptPath,receipt).sha256,outputHashes:receipt.outputs});f.flush();
  return {...f,qa,alias,canonical,receipt};
}
test('source continuation accepts only the actual same-byte v2 review alias consumed by QA',t=>{
  const f=v2ReviewAliasFixture(t);assert.equal(evaluateSourceContinuation({root:f.root}).status,'resume-ready');
});
for(const mutation of ['different-hash','arbitrary-path','tampered-alias','wrong-review'])test('source continuation rejects v2 alias '+mutation,t=>{
  const f=v2ReviewAliasFixture(t);
  if(mutation==='different-hash')f.qa.qaReview={...f.alias,sha256:'0'.repeat(64)};
  if(mutation==='wrong-review')f.qa.reviewId='other-review';
  if(mutation==='tampered-alias')fs.appendFileSync(path.join(f.root,f.alias.path),' ');
  if(mutation==='arbitrary-path') {
    const other=f.save(`${f.prefix}unbound-copy.json`,fs.readFileSync(path.join(f.root,f.alias.path)));
    f.receipt.inputs=f.receipt.inputs.map(ref=>ref.path===f.alias.path?other:ref);
    f.qa.receiptSha256=f.save(f.qa.receiptPath,f.receipt).sha256;
  }
  f.flush();const gate=evaluateSourceContinuation({root:f.root});assert.equal(gate.status,'blocked');assert(gate.errors.includes('SOURCE_LEARNING_QA_CONSUMER_BINDING_INVALID'),JSON.stringify(gate));
});

test('legacy QA without completionContract cannot launder handwritten or stale three-proof PASS at final continuation',t=>{
  const f=fixture(t),qa=f.manifest.stages.find(stage=>stage.stage==='visualQA');
  const reseal=(report,assessment=null)=>{
    const reportRef=f.save(`${f.prefix}fidelity-report.json`,report),receipt=JSON.parse(fs.readFileSync(path.join(f.root,qa.receiptPath)));
    receipt.outputs=receipt.outputs.map(ref=>ref.path===reportRef.path?reportRef:ref);
    if(assessment){const assessmentRef=f.save(`${f.prefix}visual-qa-assessment.json`,assessment);receipt.outputs=receipt.outputs.map(ref=>ref.path===assessmentRef.path?assessmentRef:ref);}
    const ref=f.save(qa.receiptPath,receipt);qa.receiptSha256=ref.sha256;qa.outputHashes=receipt.outputs;f.flush();
  };
  assert.equal(f.quality.qaInput.completionContract,undefined);
  assert.equal(evaluateSourceContinuation({root:f.root}).status,'resume-ready');
  const forged={status:'fidelity-pass',proofs:{evidenceFidelity:'pass',structuralFidelity:'pass',generativeProof:'pass'}};
  reseal(forged);let gate=evaluateSourceContinuation({root:f.root});assert.equal(gate.status,'blocked');assert(gate.errors.includes('SOURCE_LEARNING_FIDELITY_RECORDED_RESULT_MISMATCH'));
  const assessment=structuredClone(f.quality.assessment);assessment.pages[0].dimensions.composition.observations=[];
  reseal(f.quality.report,assessment);gate=evaluateSourceContinuation({root:f.root});assert.equal(gate.status,'blocked');assert(gate.errors.includes('SOURCE_LEARNING_FIDELITY_REVALIDATION_FAILED'));
  reseal({...f.quality.report,inputHashes:{...f.quality.report.inputHashes,assessment:'0'.repeat(64)}},f.quality.assessment);
  gate=evaluateSourceContinuation({root:f.root});assert.equal(gate.status,'blocked');assert(gate.errors.includes('SOURCE_LEARNING_FIDELITY_RECORDED_RESULT_MISMATCH'));
  reseal(f.quality.report,f.quality.assessment);fs.renameSync(path.join(f.root,f.prefix,'visual-pattern-inventory.json'),path.join(f.root,f.prefix,'inventory-preserved.json'));
  gate=evaluateSourceContinuation({root:f.root});assert.equal(gate.status,'blocked');assert(gate.errors.includes('SOURCE_LEARNING_FIDELITY_REVALIDATION_FAILED'));
});

test('pending learning does not resume and learning failure remains concrete', (t) => {
  const f = fixture(t);
  f.manifest.status = 'running'; f.flush();
  assert.equal(evaluateSourceContinuation({ root: f.root }).status, 'pending');
  f.manifest.status = 'blocked'; f.flush();
  assert.equal(evaluateSourceContinuation({ root: f.root }).status, 'blocked');
});

function previewFixture(t, options) {
  const f = fixture(t, options);
  f.save(`${f.prefix}brand-profile.dtcg.json`, f.mod.tokens.dtcg);
  f.manifest.status = 'blocked';
  f.manifest.stages.push({ id: 'visualQA-2', role: 'visualQA', stage: 'visualQA', status: 'failed', agentExecutionId: '/root/qa-two', blockingFindings: [{ code: 'SOURCE_MOBILE_GEOMETRY' }] });
  f.flush();
  const dimensions = ['sourceBrand', 'brandMod', 'tokens', 'runtimeAssets', 'hostTransfer', 'scopeExclusions'];
  f.preview = { schema: 'brand-preview-readiness/v1', scope: 'macro-host-journey', verdict: 'ready-for-preview', learningComplete: false, hostMutationAllowed: false,
    userAuthorization: { scope: 'macro-host-journey', statement: 'First test the big steps; details later.' }, reviewerExecutionId: '/root/independent-preview-reviewer',
    parentHandoff: f.ref('source-prerequisite.json'), learningManifest: f.ref(`${f.prefix}execution-manifest.json`),
    inputs: ['brand-evidence.json', 'brand-intent.json', 'brand-mod.json', 'brand-profile.dtcg.json'].map((name) => f.ref(`${f.prefix}${name}`)).concat(f.mod.assets.map((asset) => f.ref(asset.localPath))),
    dimensions: Object.fromEntries(dimensions.map((key) => [key, { status: 'pass', observations: 'Observed source mechanisms support this isolated trial.' }])),
    allowedUse: { scope: 'isolated-host-preview-trial', supportedIds: ['layoutRules'], excludedUses: ['source-learning-certification', 'host-source-implementation', 'global-certified-brand-system'] },
    unresolvedExclusions: ['Exact source mobile geometry remains failed.'] };
  f.sealPreview = () => ({ root: f.root, continuationScope: 'macro-host-journey', previewReadinessSha256: f.save(`${f.prefix}preview-readiness.json`, f.preview).sha256 });
  f.options = f.sealPreview();
  return f;
}

test('explicit scoped review resumes a trial while preserving strict FAIL and immutable learning records', (t) => {
  const f = previewFixture(t);
  const frozen = ['goal-contract.json', 'execution-manifest.json', 'fidelity-report.json'].map((name) => [name, fs.readFileSync(path.join(f.root, f.prefix, name))]);
  assert.equal(evaluateSourceContinuation(f.options).status, 'blocked');
  const evaluated = evaluatePreviewContinuation(f.options);
  assert.equal(evaluated.status, 'resume-ready', JSON.stringify(evaluated));
  assert.equal(evaluated.learningComplete, false);
  assert.equal(evaluated.sourceLearningStatus, 'blocked');
  const installed = materializeHostContinuation(f.options);
  assert.equal(installed.status, 'resume-ready', JSON.stringify(installed));
  assert.equal(installed.resume.artifactRoot, path.join(f.root, 'host-preview-macro/build'));
  assert.equal(materializeHostContinuation(f.options).status, 'resume-ready');
  for (const [name, bytes] of frozen) assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, name)), bytes);
  assert.equal(evaluateSourceContinuation(f.options).status, 'blocked');
});

test('scoped trial denies missing, stale, self review and escaped hash references', (t) => {
  const f = previewFixture(t);
  assert.equal(evaluatePreviewContinuation({ ...f.options, previewReadinessSha256: null }).status, 'blocked');
  f.preview.reviewerExecutionId = '/root/interpreter';
  assert.ok(evaluatePreviewContinuation(f.sealPreview()).errors.includes('PREVIEW_INDEPENDENT_REVIEW_REQUIRED'));
  f.preview.reviewerExecutionId = '/root/independent-preview-reviewer';
  f.preview.inputs.push({ path: '../escape.json', sha256: 'a'.repeat(64) });
  assert.ok(evaluatePreviewContinuation(f.sealPreview()).errors.includes('PREVIEW_INPUT_HASH_INVALID'));
  f.preview.inputs.pop();
  const valid = f.sealPreview();
  f.save(`${f.prefix}brand-profile.dtcg.json`, {});
  assert.ok(evaluatePreviewContinuation(valid).errors.includes('PREVIEW_INPUT_HASH_INVALID'));
  f.manifest.status = 'failed'; f.flush();
  assert.ok(evaluatePreviewContinuation(valid).errors.includes('PREVIEW_PARENT_BINDING_INVALID'));
});

test('public continue requires scope and an exact reviewed receipt hash', (t) => {
  const f = previewFixture(t);
  const entry = process.env.BRAND_TEST_ENTRY || path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
  for (const extra of [[], ['--continuation-scope', 'macro-host-journey'], ['--continuation-scope', 'unknown', '--preview-readiness-sha256', f.options.previewReadinessSha256]]) {
    const call = spawnSync(process.execPath, [entry, 'continue', '--artifact-root', f.root, ...extra], { encoding: 'utf8' });
    assert.equal(call.status, 1, call.stdout);
    assert.equal(JSON.parse(call.stdout).status, 'blocked');
  }
});

test('public scoped continuation binds the grant into specialist inputs and rejects its removal at delivery', (t) => {
  const owned = createBrandTestDirectory('public-scoped-continuation');
  t.after(() => owned.cleanup());
  const host = path.join(owned.directory, 'host');
  fs.mkdirSync(path.join(host, 'src/pages/home'), { recursive: true });
  fs.writeFileSync(path.join(host, 'package.json'), JSON.stringify({ name: 'qa-host', dependencies: { dangoui: '3.6.16', '@tarojs/taro': '4.2.0' } }));
  fs.writeFileSync(path.join(host, 'src/app.config.ts'), "export default {pages:['pages/home/index']};");
  fs.writeFileSync(path.join(host, 'src/pages/home/index.vue'), '<template><view><input placeholder="搜索商品"/><button>搜索</button><view>结果加载中</view></view></template>');
  const f = previewFixture(t, { root: path.join(owned.directory, 'run/build'), host });
  fs.writeFileSync(path.join(owned.directory, 'run/run.json'), JSON.stringify({ schema: 'brand-artifact-run/v1', id: 'scope-test', status: 'active', host }));
  const entry = process.env.BRAND_TEST_ENTRY || path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
  const call = spawnSync(process.execPath, [entry, 'continue', '--artifact-root', f.root, '--continuation-scope', 'macro-host-journey', '--preview-readiness-sha256', f.options.previewReadinessSha256], { encoding: 'utf8', timeout: 30000 });
  assert.equal(call.status, 0, call.stdout + call.stderr);
  const output = JSON.parse(call.stdout);
  assert.equal(output.status, 'host-resumed');
  assert.equal(output.learningComplete, false);
  const dispatch = JSON.parse(fs.readFileSync(path.join(output.resume.artifactRoot, output.dispatch.dispatchFile)));
  assert.ok(dispatch.requiredInputs.some((ref) => ref.path === 'source-continuation.json'));
  assert.ok(dispatch.requiredInputs.some((ref) => ref.path === `${f.prefix}preview-readiness.json`));
  const child = output.resume.artifactRoot;
  fs.unlinkSync(path.join(child, f.prefix, 'preview-readiness.json'));
  assert.ok(evaluateHostDelivery({ root: child, brand: f.brand }).errors.includes('HOST_PREVIEW_SCOPE_BINDING_INVALID'));
  assert.equal(evaluateSourceContinuation({ root: f.root }).status, 'blocked');
});

test('current blocker excludes superseded historical failures without erasing history', (t) => {
  const f = fixture(t);
  const historical = { id: 'evidence-old', stage: 'evidence', status: 'failed', blockingFindings: [{ code: 'OLD_CAPTURE_GAP' }] };
  f.manifest.stages.unshift(historical);
  f.manifest.stages.push({ id: 'visualQA-current', stage: 'visualQA', status: 'failed', blockingFindings: [{ code: 'CURRENT_STRUCTURE_GAP' }] });
  f.manifest.status = 'blocked';
  f.flush();
  const gate = evaluateSourceContinuation({ root: f.root });
  assert.equal(gate.blockingStageId, 'visualQA-current');
  assert.deepEqual(gate.blockingFindings, [{ code: 'CURRENT_STRUCTURE_GAP' }]);
  assert.ok(f.manifest.stages.includes(historical));
  f.manifest.stages.pop();
  f.manifest.status = 'timed-out';
  f.flush();
  assert.deepEqual(evaluateSourceContinuation({ root: f.root }).blockingFindings, []);
});

test('frozen learning Goal rejects changed parent host parameters', (t) => {
  const f = fixture(t);
  const handoff = JSON.parse(fs.readFileSync(path.join(f.root, 'source-prerequisite.json')));
  handoff.parentArgs[handoff.parentArgs.indexOf('--profile') + 1] = 'standard';
  f.save('source-prerequisite.json', handoff);
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('SOURCE_PARENT_ARGUMENTS_INVALID'));
});

test('public continue resumes host dispatch without changing host or learning records', (t) => {
  const owned = createBrandTestDirectory('public-continuation');
  const container = owned.directory;
  t.after(() => owned.cleanup());
  const host = path.join(container, 'host');
  fs.mkdirSync(path.join(host, 'src/pages/home'), { recursive: true });
  fs.writeFileSync(path.join(host, 'package.json'), JSON.stringify({ name: 'qa-host', dependencies: { dangoui: '3.6.16', '@tarojs/taro': '4.2.0' } }));
  fs.writeFileSync(path.join(host, 'src/app.config.ts'), "export default {pages:['pages/home/index']};");
  const page = path.join(host, 'src/pages/home/index.vue');
  fs.writeFileSync(page, '<template><view><input placeholder="搜索商品"/><button>搜索</button><view>结果加载中</view></view></template>');
  const f = fixture(t, { root: path.join(container, 'run/build'), host });
  fs.writeFileSync(path.join(container, 'run/run.json'), JSON.stringify({ schema: 'brand-artifact-run/v1', id: 'public-test', status: 'active', host }));
  const goalBytes = fs.readFileSync(path.join(f.root, f.prefix, 'goal-contract.json'));
  const manifestBytes = fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json'));
  const hostBytes = fs.readFileSync(page);
  const entry = process.env.BRAND_TEST_ENTRY || path.resolve('skills/brand/scripts/run-brand-workflow.mjs');
  const call = (command, extra = []) => {
    const run = spawnSync(process.execPath, [entry, command, '--artifact-root', f.root, '--brand', f.brand, ...extra], { encoding: 'utf8', timeout: 30000 });
    return { code: run.status, value: JSON.parse(run.stdout), stderr: run.stderr };
  };
  const learningDelivery = call('delivery');
  assert.equal(learningDelivery.value.status, 'resume-ready');
  assert.equal(learningDelivery.value.userGoalCompleted, false);
  const resumed = call('continue');
  assert.equal(resumed.code, 0, JSON.stringify(resumed));
  assert.equal(resumed.value.status, 'host-resumed');
  assert.equal(resumed.value.dispatch.status, 'dispatch-ready');
  assert.equal(resumed.value.dispatch.workflow, 'design-host');
  assert.equal(resumed.value.userGoalCompleted, false);
  assert.equal(resumed.value.resume.args[resumed.value.resume.args.indexOf('--host-target') + 1], host);
  assert.equal(resumed.value.resume.args[resumed.value.resume.args.indexOf('--platform') + 1], 'h5');
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, 'goal-contract.json')), goalBytes);
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.prefix, 'execution-manifest.json')), manifestBytes);
  assert.deepEqual(fs.readFileSync(page), hostBytes);
  assert.ok(fs.existsSync(path.join(f.root, 'host-preview/run.json')));
  assert.ok(fs.existsSync(path.join(f.root, 'host-preview/build/source-continuation.json')));
});

test('continuation rejects symlink destinations even when they point back into the learning tree', (t) => {
  const f = fixture(t);
  fs.symlinkSync(path.join(f.root, 'migrations'), path.join(f.root, 'host-preview'));
  const gate = materializeHostContinuation({ root: f.root });
  assert.equal(gate.status, 'blocked');
  assert.ok(gate.errors.includes('HOST_CONTINUATION_SYMLINK_ESCAPE'));
  assert.equal(fs.existsSync(path.join(f.root, 'migrations', 'build')), false);
});

test('tampered QA, same execution, bad MOD, stale goal and assets block continuation', (t) => {
  const f = fixture(t);
  const qa = f.manifest.stages.at(-1);
  const originalReceipt = fs.readFileSync(path.join(f.root, qa.receiptPath));
  f.save(qa.receiptPath, { verdict: 'pass' });
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('STAGE_RECEIPT_HASH_INVALID'));
  fs.writeFileSync(path.join(f.root, qa.receiptPath), originalReceipt);
  qa.agentExecutionId = f.manifest.stages.at(-2).agentExecutionId; f.flush();
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('SOURCE_LEARNING_QA_NOT_INDEPENDENT'));
  qa.agentExecutionId = '/root/visualQA'; f.flush();
  f.save(f.mod.assets[0].localPath, 'changed');
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('SOURCE_RUNTIME_ASSET_HASH_INVALID'));
  f.save(`${f.prefix}brand-mod.json`, { ...f.mod, schema: 'wrong' });
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('SOURCE_MOD_VALIDATION_FAILED'));
  f.save(`${f.prefix}goal-contract.json`, {});
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('SOURCE_LEARNING_GOAL_INVALID'));
});

test('a learning manifest and H5 filename never satisfy host delivery', (t) => {
  const f = fixture(t);
  assert.ok(evaluateHostDelivery(f).errors.includes('HOST_PREVIEW_MODE_REQUIRED'));
  f.manifest.mode = 'design-host'; f.manifest.status = 'awaiting-concept-direction'; f.flush();
  assert.equal(evaluateHostDelivery(f).status, 'blocked');
});

test('approved Master delivery preserves the single approved artifact', (t) => {
  const f = fixture(t);
  f.manifest.mode = 'design-host';
  f.goal = f.save(`${f.prefix}goal-contract.json`, { sealed: true, mode: 'design-host', requestKind: 'host-concepts' });
  f.manifest.goalSha256 = f.goal.sha256;
  const artifact = f.save(`${f.prefix}approved.html`, '<html>Approved host preview</html>');
  const qa = f.save(`${f.prefix}approved-qa.json`, { status: 'pass' });
  f.stage('designVisualQA', 'visualQA', [qa], [f.goal, artifact]); f.flush();
  f.save(`${f.prefix}approved-master.json`, { schema: 'brand-approved-master/v1', status: 'approved', approvalSource: 'explicit-user', artifact, qa });
  const delivery = evaluateHostDelivery(f);
  assert.equal(delivery.status, 'delivered', JSON.stringify(delivery));
  assert.equal(delivery.recommendedArtifacts.length, 1);
  assert.equal(delivery.comparisonPreview, undefined);
  assert.equal(delivery.hostMutationAllowed, false);
  const unreviewed = f.save(`${f.prefix}never-reviewed.html`, '<html>Never reviewed</html>');
  const master = { schema: 'brand-approved-master/v1', status: 'approved', approvalSource: 'explicit-user', artifact: unreviewed, qa };
  f.save(`${f.prefix}approved-master.json`, master);
  assert.ok(evaluateHostDelivery(f).errors.includes('APPROVED_MASTER_QA_ARTIFACT_UNBOUND'));
  f.save(artifact.path, 'changed');
  assert.equal(evaluateHostDelivery(f).status, 'blocked');
});

test('an unreviewed post-QA output cannot launder a changed QA input', (t) => {
  const f = fixture(t);
  const changed = f.save(`${f.prefix}demo.html`, 'Changed after QA');
  f.manifest.stages.push({ stage: 'post-qa', id: 'post-qa-1', status: 'complete', outputHashes: [changed] });
  f.flush();
  assert.ok(evaluateSourceContinuation({ root: f.root }).errors.includes('STAGE_ARTIFACT_HASH_INVALID'));
});

test('recommendation reader accepts equivalent forms without guessing or mutating QA', () => {
  const flat = { recommendedDirectionIds: ['b'], recommendationReason: 'Useful comparison' };
  const nested = { recommendation: { directionId: 'b', reason: 'Useful comparison' } };
  for (const value of [flat, nested, {...flat, ...nested}]) {
    const before = JSON.stringify(value);
    assert.deepEqual(normalizeHostRecommendation(value), {ids:['b'],reason:'Useful comparison'});
    assert.equal(JSON.stringify(value), before);
  }
  for (const value of [{}, {recommendedDirectionIds:'b',recommendationReason:'reason'},
    {recommendedDirectionIds:['b','b'],recommendationReason:'reason'},
    {recommendation:{directionId:'b',reason:' '}},
    {...flat,recommendation:{directionId:'a',reason:'Useful comparison'}},
    {...flat,recommendation:{directionId:'b',reason:'Different reason'}},
    {...nested,recommendedDirectionIds:[]}, {recommendation:null}]) {
    assert.equal(normalizeHostRecommendation(value), null);
  }
});

for (const representation of ['flat','nested']) test(`real H5 route delivers an equal interactive comparison with ${representation} recommendation; requests recheck QA without writes`, async (t) => {
  const f = fixture(t);
  // This fixture now models a direct host run, not its learning prerequisite.
  fs.unlinkSync(path.join(f.root, 'source-prerequisite.json'));
  f.manifest.mode = 'design-host'; f.manifest.status = 'awaiting-concept-direction';
  f.goal = f.save(`${f.prefix}goal-contract.json`, { sealed: true, mode: 'design-host', requestKind: 'host-concepts' });
  f.manifest.goalSha256 = f.goal.sha256;
  const questionIds = ['expressive-productive-allocation-question', 'host-generation-choice', 'host-generation-brief', 'host-reconstruction-risk', 'host-content-scene-integration', 'visual-authority'];
  const bundle = f.save(`${f.prefix}design-knowledge-bundle.json`, { schema: 'design-knowledge-bundle/v1', stage: 'design-host', generatedBy: 'query-design-knowledge.mjs', hostContext: { baselineSha256: 'b'.repeat(64), primaryTask: 'search', primaryAction: 'search', productiveFloor: {}, hostContentContract: { userInputRequired: false }, expressiveOpportunity: {}, resultHierarchyContract: { defaultRelationship: 'peer', differentiationAllowed: false, evidence: [], forbiddenWithoutEvidence: [] } }, questions: questionIds.map((id) => ({ id, items: ['basis'] })), entries: questionIds.map((id) => ({ ref: `question:${id}`, kind: 'question', id })) });
  const directions = ['a', 'b', 'c'].map((id) => ({ id, artifact: f.save(`${f.prefix}h5-directions/${id}.html`, `<html>${id}</html>`), realDataBinding: { inventedDataForbidden: true }, brandDesignSystemSha256: f.modRef.sha256, knowledgeBundleSha256: bundle.sha256, resultHierarchyFit: { relationship: 'peer', preservesHostHierarchy: true, unsupportedDifferentiationForbidden: true, resultSpecificEmphasis: 'none', evidenceRefs: [] } }));
  const producer = f.stage('h5DirectionGeneration', 'brandApplicationDesigner', directions.map((d) => d.artifact), [f.goal, f.modRef]);
  const audit = f.save(`${f.prefix}design-host-h5-audit.json`, { status: 'eligible-for-human-review' });
  const reason = 'Direction b preserves comparison. <script>alert("unsafe")</script>';
  const report = f.save(`${f.prefix}design-host-visual-qa.json`, { status: 'pass', ...(representation === 'flat' ? {recommendedDirectionIds:['b'],recommendationReason:reason} : {recommendation:{directionId:'b',reason}}) });
  const qa = f.stage('designVisualQA', 'visualQA', [audit, report], [f.goal, ...directions.map((d) => d.artifact)]);
  f.save(`${f.prefix}design-host-route.json`, { schema: 'design-host-route/v3', sequence: 'h5-design-system-first', knowledgeDecision: { status: 'ready', ...bundle, hostStartupBaselineSha256: 'b'.repeat(64) }, h5Directions: { status: 'ready', producerExecutionId: producer.agentExecutionId, directions }, h5QA: { status: 'pass', reviewerExecutionId: qa.agentExecutionId, resultHierarchyGeometry: { status: 'pass', directions: directions.map((d) => ({ id: d.id, relationship: 'peer', measuredItemCount: 3, maxWidthRatio: 1, maxHeightRatio: 1, computedProminenceEqual: true })) } }, expressiveGapDecision: { status: 'not-required', gaps: [] } });
  f.flush();
  const gate = evaluateHostDelivery(f);
  assert.equal(gate.status, 'delivered', JSON.stringify(gate));
  assert.equal(gate.recommendedArtifacts[0].id, 'b');
  assert.equal(gate.hostMutationAllowed, false);
  assert.equal(gate.comparisonPreview.defaultSelection, null);
  assert.deepEqual(gate.comparisonPreview.directionIds, ['a', 'b', 'c']);
  assert.equal(gate.nextAction, 'show-comparison-h5-and-await-user-selection');
  // Valid hash bindings must not rescue an invalid recommendation. These are
  // fresh test receipts, not mutations of recorded user QA artifacts.
  const originalReport = JSON.parse(fs.readFileSync(path.join(f.root, report.path)));
  const originalReceipt = JSON.parse(fs.readFileSync(path.join(f.root, qa.receiptPath)));
  const bindReport = value => {
    const ref = f.save(report.path, value);
    const receipt = { ...originalReceipt, outputs: originalReceipt.outputs.map(item => item.path === report.path ? ref : item) };
    qa.outputHashes = receipt.outputs;
    qa.receiptSha256 = f.save(qa.receiptPath, receipt).sha256;
    f.flush();
  };
  for (const invalid of [
    { recommendation: { directionId: 'unknown', reason } },
    { recommendedDirectionIds: ['unknown'], recommendationReason: reason },
    { recommendedDirectionIds: ['b'], recommendationReason: reason, recommendation: { directionId: 'a', reason } },
    { recommendation: { directionId: 'b', reason: '' } },
    {},
  ]) {
    bindReport({ status: 'pass', ...invalid });
    const rejected = evaluateHostDelivery(f);
    assert.equal(rejected.status, 'blocked');
    assert(rejected.errors.some(error => error.startsWith('HOST_RECOMMENDATION')));
    assert.equal(rejected.comparisonPreview, undefined);
  }
  bindReport(originalReport);
  assert.equal(evaluateHostDelivery(f).status, 'delivered');
  const snapshot = () => fs.readdirSync(f.root, { recursive: true }).filter(name => fs.statSync(path.join(f.root, name)).isFile()).sort().map(name => [name, fs.readFileSync(path.join(f.root, name)).toString('base64')]);
  const before = snapshot();
  const response = spawnSync(process.execPath, [process.env.BRAND_TEST_ENTRY || path.resolve('skills/brand/scripts/run-brand-workflow.mjs'), 'delivery', '--artifact-root', f.root, '--brand', f.brand], { encoding: 'utf8' });
  assert.equal(response.status, 0, response.stderr || response.stdout);
  assert.deepEqual(JSON.parse(response.stdout).comparisonPreview, gate.comparisonPreview);
  assert.deepEqual(snapshot(), before);
  const server = spawn(process.execPath, [path.resolve('skills/brand/scripts/serve-design-host-h5.mjs'), '--root', f.root, '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => server.kill());
  const baseUrl = await new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => reject(new Error('static server startup timeout')), 10000);
    server.stderr.on('data', chunk => { stderr += chunk; });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`static server exited ${code}: ${stderr}`)); });
    server.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('\n')) { clearTimeout(timeout); resolve(JSON.parse(stdout.trim()).baseUrl); } });
  });
  const preview = await fetch(new URL(gate.comparisonPreview.path, baseUrl));
  assert.equal(preview.status, 200);
  const html = await preview.text();
  assert.equal((html.match(/<iframe /g) || []).length, 3);
  assert.equal((html.match(/width="390" height="844"/g) || []).length, 3);
  assert.ok(html.indexOf('方案 A') < html.indexOf('方案 B') && html.indexOf('方案 B') < html.indexOf('方案 C'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>') && !html.includes('<button') && !html.includes('checked'));
  for (const [, src] of html.matchAll(/<iframe[^>]+src="([^"]+)"/g)) assert.equal((await fetch(new URL(src, baseUrl))).status, 200);
  const viewport = await fetch(new URL(`/__brand_viewport__?path=${encodeURIComponent(directions[0].artifact.path)}&width=390&height=844`, baseUrl));
  assert.equal(viewport.status, 200);
  assert.ok((await viewport.text()).includes('id="device"'));
  for (const badBrand of ['../outside', '/tmp', '<script>']) assert.equal((await fetch(new URL(`/__brand_comparison__?brand=${encodeURIComponent(badBrand)}`, baseUrl))).status, 400);
  assert.equal((await fetch(new URL('/__brand_viewport__?path=%25', baseUrl))).status, 404);
  assert.deepEqual(snapshot(), before);
  f.save(report.path, { status: 'pass', recommendedDirectionIds: ['a'], recommendationReason: 'Tampered recommendation' });
  assert.equal(evaluateHostDelivery(f).status, 'blocked');
  assert.equal((await fetch(new URL(gate.comparisonPreview.path, baseUrl))).status, 409);
  const outside = path.resolve('skills/brand/scripts/parent-delivery-gate.test.mjs');
  fs.symlinkSync(outside, path.join(f.root, 'escape.html'));
  assert.equal((await fetch(new URL('/__brand_viewport__?path=escape.html', baseUrl))).status, 404);
  assert.equal((await fetch(new URL('/escape.html', baseUrl))).status, 404);
});
