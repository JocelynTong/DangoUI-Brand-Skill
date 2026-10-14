#!/usr/bin/env node
// Read-only gate used by the public workflow entry; this is not a second runner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateDesignHostRoute } from './validate-design-host-route.mjs';
import { validateSourceLearningGoal } from './source-learning-goal.mjs';
import { validateHostPreviewSmoke } from './host-preview-smoke.mjs';
import { validateHostPreviewQaRetries } from './host-preview-qa-retry.mjs';
import { readCanonicalLearningProof } from './learning-proof-contract.mjs';
import { revalidateLearningFidelity } from './revalidate-learning-fidelity.mjs';

const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const hash = (file) => { try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; } };
const inside = (root, file) => { const relative = path.relative(path.resolve(root), file); return relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative); };
function bound(root, ref) {
  if (!ref?.path || !/^[a-f0-9]{64}$/i.test(ref.sha256 || '')) return false;
  try { const file = fs.realpathSync(path.resolve(root, ref.path)); return inside(fs.realpathSync(root), file) && hash(file) === ref.sha256; } catch { return false; }
}
const result = (status, errors = [], extra = {}) => ({ schema: 'brand-parent-delivery/v1', ok: status !== 'blocked', status, userGoalCompleted: false, hostMutationAllowed: false, errors: [...new Set(errors)], ...extra });
const latest = (manifest, name) => [...(manifest?.stages || [])].reverse().find((stage) => stage.stage === name);

// Direct host runs have no source-learning handoff. Resolve only their existing
// ledger; this gate never prepares a new workflow or retries a failed stage.
export function evaluateHostContinuation({ root, brand } = {}) {
  root = path.resolve(root || process.cwd());
  if (!brand) {
    let candidates = [];
    try { candidates = fs.readdirSync(path.join(root, 'migrations')).filter(name => fs.existsSync(path.join(root, 'migrations', name, 'execution-manifest.json'))); } catch {}
    if (candidates.length !== 1) return result('blocked', [candidates.length ? 'HOST_CONTINUATION_BRAND_AMBIGUOUS' : 'HOST_CONTINUATION_MANIFEST_REQUIRED']);
    [brand] = candidates;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(brand)) return result('blocked', ['HOST_CONTINUATION_BRAND_INVALID']);
  const migration = path.join(root, 'migrations', brand);
  const manifestFile = path.join(migration, 'execution-manifest.json');
  const manifest = read(manifestFile);
  if (!manifest || !bound(root, { path: manifestFile, sha256: hash(manifestFile) }) || manifest.brand !== brand || !['design-host', 'apply-host'].includes(manifest.mode) || !Array.isArray(manifest.stages)) return result('blocked', ['HOST_CONTINUATION_MANIFEST_INVALID']);
  const goalRef = { path: manifest.goalPath, sha256: manifest.goalSha256 };
  const goal = bound(root, goalRef) ? read(path.resolve(root, goalRef.path)) : null;
  const requestKind = manifest.mode === 'design-host' ? 'host-concepts' : 'host-implementation';
  if (!goal || path.resolve(root, goalRef.path) !== path.join(migration, 'goal-contract.json') || goal.sealed !== true || goal.brand !== brand || goal.mode !== manifest.mode || goal.requestKind !== requestKind || !path.isAbsolute(goal.hostTarget || '')) return result('blocked', ['HOST_CONTINUATION_GOAL_INVALID']);
  const context = { brand, mode: manifest.mode, hostTarget: goal.hostTarget, currentStageId: manifest.currentStageId, fullWorkflowPass: false };
  const delivery = evaluateHostDelivery({ root, brand });
  if (delivery.status !== 'pending') {
    const failed = [...manifest.stages].reverse().find(stage => stage.status === 'failed');
    return { ...context, ...delivery, ...(delivery.status === 'blocked' ? { blockingStage: delivery.blockingStage || failed?.id || manifest.currentStageId || null, blockingFindings: delivery.blockingFindings || failed?.blockingFindings || [], automaticRetryAllowed: false } : {}) };
  }
  const stage = manifest.stages.find(item => item.id === manifest.currentStageId);
  if (manifest.status !== 'running' || !stage || !['pending', 'dispatched'].includes(stage.status)) return result('blocked', ['HOST_CONTINUATION_STAGE_NOT_DISPATCHABLE'], { ...context, blockingStage: stage?.id || null });
  if (stage.status === 'pending') return { ...delivery, ...context, nextAction: 'continue-host-stage' };
  if (manifest.mode === 'design-host' && manifest.executionProfile === 'fast' && manifest.deadlineAt && Date.now() > Date.parse(manifest.deadlineAt)) return result('blocked', ['DESIGN_HOST_FAST_SAFETY_LIMIT_EXCEEDED'], { ...context, blockingStage: stage.id, automaticRetryAllowed: false });
  const dispatchRef = { path: stage.dispatchPath, sha256: stage.dispatchSha256 };
  const packet = bound(root, dispatchRef) ? read(path.resolve(root, dispatchRef.path)) : null;
  if (!packet || packet.schema !== 'brand-subagent-dispatch/v1' || packet.dispatchId !== stage.dispatchId || packet.stageId !== stage.id || packet.stage !== stage.stage || packet.role !== stage.role || packet.runId !== manifest.runId || packet.goalSha256 !== manifest.goalSha256 || !Array.isArray(packet.requiredInputs) || !packet.requiredInputs.some(input => input.path === goalRef.path && input.sha256 === goalRef.sha256) || packet.requiredInputs.some(input => !bound(root, input))) return result('blocked', ['HOST_DISPATCH_BINDING_INVALID'], { ...context, blockingStage: stage.id });
  return result('pending', [], { ...context, dispatchRequest: packet, dispatchFile: stage.dispatchPath, reusedDispatch: true, orchestratorAction: 'execute-or-wait-existing-specialist', nextAction: 'Use the existing dispatchId only if execution has not started; otherwise wait for its agent and record the receipt. Do not redispatch or recollect source.' });
}

export function evaluateHostDispatch(evaluated, { exitCode, dispatch, stderr = '' }) {
  if (exitCode !== 0 || !dispatch || dispatch.ok === false) {
    const code = dispatch?.blockingCode || dispatch?.blockingResult?.blockingCode || stderr.match(/\b[A-Z][A-Z0-9_]{5,}\b/)?.[0] || 'HOST_STAGE_DISPATCH_FAILED';
    return result('blocked', [code], { ...evaluated, ok: false, status: 'blocked', errors: [code], blockingCode: code, blockingStage: evaluated.currentStageId, dispatch, stderr, nextAction: 'Resolve the reported blocker in this existing host stage; no automatic retry or source collection is authorized.' });
  }
  return { ...evaluated, dispatch, dispatchRequest: dispatch.dispatchRequest, dispatchFile: dispatch.dispatchFile, orchestratorAction: 'execute-specialist', nextAction: 'Execute this specialist dispatch once, record its receipt, then continue the existing host workflow.' };
}

export function evaluateLearningDispatch(evaluated, { exitCode, dispatch, stderr = '' }) {
  const failed = exitCode !== 0 || !dispatch || dispatch.ok === false;
  if (failed) {
    const code = dispatch?.blockingCode || dispatch?.blockingResult?.blockingCode || 'SOURCE_PREREQUISITE_EXECUTION_FAILED';
    return result('blocked', [code], {
      ...evaluated, ok: false, status: 'blocked', errors: [code],
      dispatch, stderr, fullWorkflowPass: false, userGoalCompleted: false,
      blockingStage: dispatch?.step || 'source-prerequisite', blockingCode: code,
      nextAction: 'Resolve the reported prerequisite failure in the existing isolated run; no executable specialist dispatch or host Demo is ready.',
    });
  }
  const packet = dispatch.dispatchRequest || dispatch.dispatch?.dispatchRequest;
  return { ...evaluated, dispatch, ...(packet ? { dispatchRequest: packet, orchestratorAction: 'execute-specialist' } : {}), stderr, fullWorkflowPass: false, nextAction: 'Execute the specialist dispatch with a real subagent (or wait for its existing execution), record its receipt, then continue. Calling continue alone does not execute the role. Do not ask the user to drive this internal handoff.' };
}

// Recheck the recorded receipt and all frozen inputs/outputs. A manifest label alone
// cannot prove QA was independent or that its rendered artifact remains current.
function stageReceipt(root, manifest, stage, errors) {
  if (!stage || stage.status !== 'complete' || stage.verdict !== 'pass') { errors.push('PASSING_STAGE_RECEIPT_REQUIRED'); return null; }
  if (!bound(root, { path: stage.receiptPath, sha256: stage.receiptSha256 })) { errors.push('STAGE_RECEIPT_HASH_INVALID'); return null; }
  const receipt = read(path.resolve(root, stage.receiptPath));
  if (receipt?.verdict !== 'pass' || receipt.stageId !== stage.id || receipt.role !== stage.role || receipt.dispatchId !== stage.dispatchId || receipt.goalSha256 !== manifest.goalSha256 || receipt.agentExecutionId !== stage.agentExecutionId || !String(receipt.agentExecutionId || '').startsWith('/root/')) errors.push('STAGE_RECEIPT_BINDING_INVALID');
  const owners = new Map();
  for (const recorded of manifest.stages || []) if (recorded.status === 'complete') for (const ref of recorded.outputHashes || []) owners.set(path.resolve(root, ref.path), { stageId: recorded.id, ref });
  const outputPaths = new Set((receipt?.outputs || []).map((ref) => path.resolve(root, ref.path)));
  const currentRefs = [
    ...(receipt?.outputs || []).filter((ref) => !owners.has(path.resolve(root, ref.path)) || owners.get(path.resolve(root, ref.path)).stageId === stage.id),
    ...(receipt?.inputs || []).filter((ref) => !outputPaths.has(path.resolve(root, ref.path))),
  ];
  if (!receipt?.outputs?.length || !receipt?.inputs?.length || currentRefs.some((ref) => !bound(root, ref))) errors.push('STAGE_ARTIFACT_HASH_INVALID');
  return receipt;
}

export function evaluateSourceContinuation({ root, handoffFile = 'source-prerequisite.json', originalArgs = null, hostArtifactRoot = null, validateMod = null } = {}) {
  root = path.resolve(root || process.cwd());
  const handoff = read(path.resolve(root, handoffFile));
  if (handoff?.schema !== 'brand-source-prerequisite/v1' || handoff.parentRequestKind !== 'host-concepts' || path.resolve(handoff.artifactRoot || '') !== root || handoff.hostMutationAllowed !== false || !handoff.brand || !handoff.hostTarget || handoff.resume?.requestKind !== 'host-concepts' || handoff.resume?.mode !== 'design-host') return result('blocked', ['SOURCE_PREREQUISITE_INVALID']);
  const argument = (args, flag) => args?.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const parentArgs = handoff.parentArgs;
  if (parentArgs && (parentArgs[0] !== 'run' || argument(parentArgs, '--request-kind') !== 'host-concepts' || (argument(parentArgs, '--mode') && argument(parentArgs, '--mode') !== 'design-host') || (argument(parentArgs, '--host-target') || argument(parentArgs, '--host-target-or-plan')) !== handoff.hostTarget || (argument(parentArgs, '--profile') || 'fast') !== handoff.requestedProfile || (argument(parentArgs, '--brand') && argument(parentArgs, '--brand') !== handoff.brand) || argument(parentArgs, '--source-url') !== handoff.sourceUrl || argument(parentArgs, '--artifact-root') !== root)) return result('blocked', ['SOURCE_PARENT_ARGUMENTS_INVALID']);
  if (originalArgs && JSON.stringify(originalArgs) !== JSON.stringify(parentArgs)) return result('blocked', ['SOURCE_PARENT_ARGUMENTS_INVALID']);
  if (!path.isAbsolute(handoff.hostTarget) || !/^[a-zA-Z0-9_-]+$/.test(handoff.brand) || !['fast', 'standard', 'certification'].includes(handoff.requestedProfile)) return result('blocked', ['SOURCE_PREREQUISITE_INVALID']);
  const migration = path.join(root, 'migrations', handoff.brand);
  const manifest = read(path.join(migration, 'execution-manifest.json'));
  if (!manifest) return result('pending', [], { nextAction: 'execute-learning-dispatch', learning: handoff.learning, parentRequestKind: 'host-concepts' });
  if (manifest.mode !== 'learn-brand') return result('blocked', ['SOURCE_LEARNING_MANIFEST_INVALID']);
  if (['blocked', 'timed-out', 'failed'].includes(manifest.status)) {
    // Historical failed receipts stay in the ledger, but a later passing repair
    // supersedes their findings. Report the terminal failure, not every failure
    // that this run ever encountered.
    const seenOwners = new Set();
    const terminalFailure = [...(manifest.stages || [])].reverse().find((stage) => {
      const owner = stage.stage || stage.role || stage.id;
      if (seenOwners.has(owner)) return false;
      seenOwners.add(owner);
      return stage.status === 'failed';
    });
    return result('blocked', ['SOURCE_LEARNING_BLOCKED'], { blockingStageId: terminalFailure?.id || null, blockingFindings: terminalFailure?.blockingFindings || [] });
  }
  if (!['passed', 'complete'].includes(manifest.status)) {
    const stage = manifest.stages?.find(item => item.id === manifest.currentStageId);
    if (stage?.status === 'dispatched') {
      const ref = { path: stage.dispatchPath, sha256: stage.dispatchSha256 };
      const packet = bound(root, ref) ? read(path.resolve(root, ref.path)) : null;
      if (!packet || packet.dispatchId !== stage.dispatchId || packet.stageId !== stage.id || packet.role !== stage.role || packet.runId !== manifest.runId || packet.goalSha256 !== manifest.goalSha256 || !bound(root, { path: manifest.goalPath, sha256: manifest.goalSha256 }) || !Array.isArray(packet.requiredInputs) || packet.requiredInputs.some(input => !bound(root, input))) return result('blocked', ['SOURCE_DISPATCH_BINDING_INVALID']);
      return result('pending', [], { currentStageId: stage.id, dispatchRequest: packet, dispatchFile: stage.dispatchPath, reusedDispatch: true, orchestratorAction: 'execute-or-wait-existing-specialist', fullWorkflowPass: false, nextAction: 'Use this existing dispatchId: execute it only if not already started; otherwise wait for that agent and record its receipt. Do not recollect source, create another dispatch, or ask the user to reply continue.' });
    }
    return result('pending', [], { nextAction: 'continue-learning', currentStageId: manifest.currentStageId });
  }
  const errors = [];
  const goalFile = path.join(migration, 'goal-contract.json');
  const goal = read(goalFile);
  if (hash(goalFile) !== manifest.goalSha256 || goal?.mode !== 'learn-brand' || goal?.parentRequestKind !== 'host-concepts' || goal?.sourceUrl !== handoff.sourceUrl || goal?.sealed !== true || goal?.brand !== handoff.brand) errors.push('SOURCE_LEARNING_GOAL_INVALID');
  if (validateSourceLearningGoal(goal, { root, brand: handoff.brand, sourceUrl: handoff.sourceUrl, handoffFile: path.resolve(root, handoffFile) }).length) errors.push('SOURCE_LEARNING_GOAL_INCOMPLETE');
  for (const name of ['evidence', 'interpreter']) {
    stageReceipt(root, manifest, latest(manifest, name), errors);
    const validated = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-learn-brand-handoff.mjs', import.meta.url)), '--root', root, '--brand', handoff.brand, '--stage', name, '--goal-file', goalFile], { encoding: 'utf8' });
    if (validated.status !== 0) errors.push(`SOURCE_${name.toUpperCase()}_HANDOFF_INVALID`);
  }
  const producer = latest(manifest, 'demo');
  const qa = latest(manifest, 'visualQA');
  stageReceipt(root, manifest, producer, errors);
  const qaReceipt = stageReceipt(root, manifest, qa, errors);
  if (!producer?.agentExecutionId || qa?.agentExecutionId === producer.agentExecutionId) errors.push('SOURCE_LEARNING_QA_NOT_INDEPENDENT');
  const fidelityFile = path.join(migration, 'fidelity-report.json');
  const fidelity = read(fidelityFile);
  if (!readCanonicalLearningProof(fidelity).threeProofsPassed) errors.push('SOURCE_LEARNING_THREE_PROOFS_REQUIRED');
  const freshFidelity = revalidateLearningFidelity({root,brand:handoff.brand,goalFile,recordedReport:fidelity});
  if (!freshFidelity.ok) errors.push(...freshFidelity.errors.map(code=>`SOURCE_${code}`));
  const assessmentPath = fidelity?.inputPaths?.assessment || `migrations/${handoff.brand}/visual-qa-assessment.json`;
  const qaInputPath = fidelity?.inputPaths?.qaInputManifest || `migrations/${handoff.brand}/qa-input-manifest.json`;
  const assessment = read(path.resolve(root,assessmentPath));
  const qaInput = read(path.resolve(root,qaInputPath));
  const qaInputHash = freshFidelity.report?.inputHashes?.qaInputManifest;
  const directQaInput = qaReceipt?.inputs?.some(ref=>ref.path===qaInputPath && ref.sha256===qaInputHash);
  // v2 dispatch consumes the immutable review copy; fidelity may consume its
  // canonical same-byte projection. Accept only this stage-bound alias.
  const reviewAlias = qa?.qaReview;
  const boundReviewAlias = qaInput?.schema==='brand-qa-review-input/v2'
    && qaInput.goalSha256===manifest.goalSha256 && qaInput.stageId===qa?.id
    && qaInput.reviewId===qa?.reviewId && assessment?.reviewId===qaInput.reviewId
    && qaInput.qaExecutionId===qa?.agentExecutionId
    && reviewAlias?.sha256===qaInputHash && bound(root,reviewAlias)
    && bound(root,{path:qaInputPath,sha256:qaInputHash})
    && qaReceipt?.inputs?.some(ref=>ref.path===reviewAlias.path && ref.sha256===reviewAlias.sha256);
  if (!qaReceipt?.outputs?.some(ref=>ref.path===assessmentPath && ref.sha256===freshFidelity.report?.inputHashes?.assessment)
      || !(directQaInput || boundReviewAlias)
      || assessment?.qaExecutionId!==qa?.agentExecutionId || qaInput?.qaExecutionId!==qa?.agentExecutionId
      || qaInput?.implementationExecutionId!==producer?.agentExecutionId) errors.push('SOURCE_LEARNING_QA_CONSUMER_BINDING_INVALID');
  if (!qaReceipt?.outputs?.some((ref) => path.resolve(root, ref.path) === fidelityFile)) errors.push('SOURCE_LEARNING_FIDELITY_RECEIPT_REQUIRED');
  const modFile = path.join(migration, 'brand-mod.json');
  const mod = read(modFile);
  if (!mod?.manifest || !mod?.tokens?.dtcg || !Array.isArray(mod?.assets) || (mod.manifest.brand && mod.manifest.brand !== handoff.brand)) errors.push('SOURCE_MOD_INVALID');
  const modStage = [...manifest.stages].reverse().find((s) => s.status === 'complete' && s.outputHashes?.some((ref) => path.resolve(root, ref.path) === modFile && bound(root, ref)));
  if (!modStage) errors.push('SOURCE_MOD_UNBOUND');
  else if (modStage !== producer && modStage !== qa) stageReceipt(root, manifest, modStage, errors);
  const validation = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-brand-mod.mjs', import.meta.url)), modFile], { cwd: root, encoding: 'utf8' });
  if (validation.status !== 0 || (validateMod && !validateMod(modFile, mod))) errors.push('SOURCE_MOD_VALIDATION_FAILED');
  const assets = (mod?.assets || []).filter((asset) => asset.localPath).map((asset) => ({ id: asset.id, path: asset.localPath, sha256: asset.sha256 || asset.sourceSha256 }));
  if (assets.some((ref) => !bound(root, ref))) errors.push('SOURCE_RUNTIME_ASSET_HASH_INVALID');
  if (errors.length) return result('blocked', errors);
  // Preserve the learning goal/manifest. A child run consumes absolute MOD input
  // and receives only its declared runtime assets, never a whole learning tree.
  const child = path.resolve(hostArtifactRoot || path.join(root, 'host-preview', 'build'));
  const host = path.resolve(handoff.hostTarget);
  if (child === root || path.dirname(child) === root || !inside(root, child) || child === host || child.startsWith(`${host}${path.sep}`)) return result('blocked', ['HOST_CONTINUATION_ISOLATION_INVALID']);
  const savedArgs = originalArgs || handoff.parentArgs || handoff.originalArgs || handoff.resume?.args;
  const args = savedArgs ? savedArgs.filter(arg => arg !== '--learn-source') : ['run', '--request-kind', 'host-concepts', '--mode', 'design-host', '--profile', handoff.requestedProfile, '--brand', handoff.brand, '--host-target', handoff.hostTarget];
  for (const flag of ['--source-url', '--mod-file', '--style-pack', '--root', '--artifact-root']) {
    let index; while ((index = args.indexOf(flag)) >= 0) args.splice(index, 2);
  }
  args.push('--mod-file', modFile, '--artifact-root', child);
  return result('resume-ready', [], { parentRequestKind: 'host-concepts', parentArtifactRoot: root, learningComplete: true, requiredRuntimeAssets: assets, resume: { entry: handoff.learning.entry, args, artifactRoot: child, modFile }, nextAction: 'resume-parent-host-preview' });
}

// A separately reviewed, explicitly authorized trial never changes the learning
// ledger or claims that the strict source-fidelity gate passed.
export function evaluatePreviewContinuation({ root, continuationScope, previewReadinessSha256 } = {}) {
  root = path.resolve(root || process.cwd());
  if (continuationScope !== 'macro-host-journey') return result('blocked', ['PREVIEW_SCOPE_INVALID']);
  const handoff = read(path.join(root, 'source-prerequisite.json'));
  // Reuse the strict gate's immutable request checks without accepting its QA verdict.
  const strict = evaluateSourceContinuation({ root });
  if (strict.errors.some((error) => ['SOURCE_PREREQUISITE_INVALID', 'SOURCE_PARENT_ARGUMENTS_INVALID', 'SOURCE_LEARNING_MANIFEST_INVALID'].includes(error)) || !handoff) return strict;
  if (!Array.isArray(handoff.parentArgs)) return result('blocked', ['SOURCE_PARENT_ARGUMENTS_INVALID']);
  const prefix = `migrations/${handoff.brand}/`;
  const receiptPath = `${prefix}preview-readiness.json`;
  const receiptRef = { path: receiptPath, sha256: previewReadinessSha256 };
  if (!bound(root, receiptRef)) return result('blocked', ['PREVIEW_READINESS_HASH_INVALID']);
  const receipt = read(path.join(root, receiptPath));
  const manifestPath = `${prefix}execution-manifest.json`;
  const manifest = read(path.join(root, manifestPath));
  const modPath = `${prefix}brand-mod.json`;
  const mod = read(path.join(root, modPath));
  const errors = [];
  if (receipt?.schema !== 'brand-preview-readiness/v1' || receipt.scope !== continuationScope || receipt.verdict !== 'ready-for-preview' || receipt.learningComplete !== false || receipt.hostMutationAllowed !== false) errors.push('PREVIEW_READINESS_SCOPE_INVALID');
  if (!String(receipt?.userAuthorization?.scope || '').trim() || !String(receipt?.userAuthorization?.statement || '').trim()) errors.push('PREVIEW_USER_AUTHORIZATION_REQUIRED');
  if (receipt?.parentHandoff?.path !== 'source-prerequisite.json' || !bound(root, receipt.parentHandoff) || receipt?.learningManifest?.path !== manifestPath || !bound(root, receipt.learningManifest)) errors.push('PREVIEW_PARENT_BINDING_INVALID');
  const producers = (manifest?.stages || []).filter((stage) => stage.role !== 'visualQA').map((stage) => stage.agentExecutionId).filter(Boolean);
  if (!String(receipt?.reviewerExecutionId || '').startsWith('/root/') || !producers.length || producers.includes(receipt.reviewerExecutionId)) errors.push('PREVIEW_INDEPENDENT_REVIEW_REQUIRED');
  const goal = read(path.join(root, prefix, 'goal-contract.json'));
  if (!manifest || manifest.mode !== 'learn-brand' || hash(path.join(root, prefix, 'goal-contract.json')) !== manifest.goalSha256 || validateSourceLearningGoal(goal, { root, brand: handoff.brand, sourceUrl: handoff.sourceUrl, handoffFile: path.join(root, 'source-prerequisite.json') }).length) errors.push('PREVIEW_LEARNING_GOAL_INVALID');
  for (const name of ['evidence', 'interpreter']) stageReceipt(root, manifest, latest(manifest, name), errors);
  const assets = (mod?.assets || []).filter((asset) => asset.localPath).map((asset) => ({ id: asset.id, path: asset.localPath, sha256: asset.sha256 || asset.sourceSha256 }));
  const required = ['brand-evidence.json', 'brand-intent.json', 'brand-mod.json', ...(fs.existsSync(path.join(root, prefix, 'brand-profile.dtcg.json')) ? ['brand-profile.dtcg.json'] : [])].map((name) => `${prefix}${name}`);
  const inputs = receipt?.inputs;
  if (!Array.isArray(inputs) || inputs.some((ref) => !bound(root, ref)) || [...required, ...assets.map((ref) => ref.path)].some((file) => !inputs?.some((ref) => ref.path === file && bound(root, ref)))) errors.push('PREVIEW_INPUT_HASH_INVALID');
  if (assets.some((ref) => !bound(root, ref))) errors.push('SOURCE_RUNTIME_ASSET_HASH_INVALID');
  const validation = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-brand-mod.mjs', import.meta.url)), path.join(root, modPath)], { cwd: root, encoding: 'utf8' });
  if (validation.status !== 0) errors.push('SOURCE_MOD_VALIDATION_FAILED');
  const dimensions = ['sourceBrand', 'brandMod', 'tokens', 'runtimeAssets', 'hostTransfer', 'scopeExclusions'];
  if (dimensions.some((key) => receipt?.dimensions?.[key]?.status !== 'pass' || !String(receipt?.dimensions?.[key]?.observations || '').trim())) errors.push('PREVIEW_DIMENSIONS_REQUIRED');
  const use = receipt?.allowedUse;
  const exclusions = ['source-learning-certification', 'host-source-implementation', 'global-certified-brand-system'];
  const resolves = (id) => typeof id === 'string' && id.split('.').every((key) => key && !['__proto__', 'prototype', 'constructor'].includes(key)) && id.split('.').reduce((value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined, mod) !== undefined;
  if (use?.scope !== 'isolated-host-preview-trial' || !Array.isArray(use.supportedIds) || !use.supportedIds.length || use.supportedIds.some((id) => !resolves(id)) || exclusions.some((item) => !use?.excludedUses?.includes(item))) errors.push('PREVIEW_ALLOWED_USE_INVALID');
  if (!Array.isArray(receipt?.unresolvedExclusions) || !receipt.unresolvedExclusions.length || receipt.unresolvedExclusions.some((item) => !String(item || '').trim())) errors.push('PREVIEW_UNRESOLVED_EXCLUSIONS_REQUIRED');
  if (errors.length) return result('blocked', errors);
  const child = path.join(root, 'host-preview-macro', 'build');
  const host = path.resolve(handoff.hostTarget);
  if (child === host || child.startsWith(`${host}${path.sep}`)) return result('blocked', ['HOST_CONTINUATION_ISOLATION_INVALID']);
  const args = handoff.parentArgs.filter(arg => arg !== '--learn-source');
  for (const flag of ['--source-url', '--mod-file', '--style-pack', '--root', '--artifact-root']) { let index; while ((index = args.indexOf(flag)) >= 0) args.splice(index, 2); }
  args.push('--mod-file', path.join(root, modPath), '--artifact-root', child);
  return result('resume-ready', [], { parentRequestKind: 'host-concepts', parentArtifactRoot: root, learningComplete: false, fullWorkflowPass: false, partialBrandValidation: receipt, previewReadiness: receiptRef, sourceLearningStatus: strict.status, sourceLearningErrors: strict.errors, requiredRuntimeAssets: assets, resume: { entry: handoff.learning.entry, args, artifactRoot: child, modFile: path.join(root, modPath) }, nextAction: 'resume-scoped-host-preview' });
}

export function materializeHostContinuation(options = {}) {
  const evaluated = options.continuationScope ? evaluatePreviewContinuation(options) : evaluateSourceContinuation(options);
  if (evaluated.status !== 'resume-ready') return evaluated;
  const parent = evaluated.parentArtifactRoot;
  const child = evaluated.resume.artifactRoot;
  // Resolve an existing ancestor before writing to reject symlink escapes.
  let ancestor = child;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  for (let current = ancestor; current !== parent && current.startsWith(`${parent}${path.sep}`); current = path.dirname(current)) if (fs.lstatSync(current).isSymbolicLink()) return result('blocked', ['HOST_CONTINUATION_SYMLINK_ESCAPE']);
  if (fs.realpathSync(ancestor) !== fs.realpathSync(parent) && !inside(fs.realpathSync(parent), fs.realpathSync(ancestor))) return result('blocked', ['HOST_CONTINUATION_SYMLINK_ESCAPE']);
  const handoff = read(path.resolve(parent, options.handoffFile || 'source-prerequisite.json'));
  const prefix = `migrations/${handoff.brand}/`;
  const files = [
    ...(evaluated.previewReadiness ? [evaluated.previewReadiness] : []),
    { path: `${prefix}brand-mod.json`, sha256: hash(evaluated.resume.modFile) },
    ...['brand-evidence.json', 'brand-intent.json', 'brand-profile.dtcg.json', 'approved-visual-patterns.json', 'dangoui-adapter.json', 'component-mapping.json'].filter((name) => fs.existsSync(path.join(parent, prefix, name))).map((name) => ({ path: `${prefix}${name}`, sha256: hash(path.join(parent, prefix, name)) })),
    ...evaluated.requiredRuntimeAssets,
  ];
  const receipt = { schema: 'brand-source-continuation/v1', parentArtifactRoot: parent, parentHandoff: { path: options.handoffFile || 'source-prerequisite.json', sha256: hash(path.resolve(parent, options.handoffFile || 'source-prerequisite.json')) }, hostArtifactRoot: child, hostMutationAllowed: false, inputs: files, resume: evaluated.resume, ...(evaluated.previewReadiness ? { learningComplete: false, continuationScope: options.continuationScope, previewReadiness: evaluated.previewReadiness, partialBrandValidation: evaluated.partialBrandValidation, sourceLearningStatus: evaluated.sourceLearningStatus, sourceLearningErrors: evaluated.sourceLearningErrors } : {}) };
  const receiptFile = path.join(child, 'source-continuation.json');
  const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
  if (fs.existsSync(receiptFile) && fs.readFileSync(receiptFile, 'utf8') !== bytes) return result('blocked', ['HOST_CONTINUATION_RECEIPT_CONFLICT']);
  const runFile = path.join(path.dirname(child), 'run.json');
  const run = { schema: 'brand-artifact-run/v1', id: `source-continuation-${receipt.parentHandoff.sha256.slice(0, 16)}`, host: path.resolve(handoff.hostTarget), status: 'active', protected: false, reason: evaluated.previewReadiness ? 'Resume a user-authorized isolated host trial after independent preview-readiness review; source learning remains incomplete.' : 'Resume the parent host preview after independent learning QA.', parentArtifactRoot: parent, parentHandoffSha256: receipt.parentHandoff.sha256 };
  if (fs.existsSync(runFile)) {
    const recorded = read(runFile);
    if (recorded?.schema !== run.schema || recorded.status !== 'active' || recorded.host !== run.host || recorded.parentHandoffSha256 !== run.parentHandoffSha256) return result('blocked', ['HOST_CONTINUATION_RUN_CONFLICT']);
  }
  // Preflight every destination before touching anything; an existing child run is
  // immutable except for byte-identical input installation.
  for (const ref of files) {
    const target = path.resolve(child, ref.path);
    if (!target.startsWith(`${child}${path.sep}`) || !bound(parent, ref)) return result('blocked', ['HOST_CONTINUATION_INPUT_INVALID']);
    let existing = target;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    for (let current = existing; current !== parent && current.startsWith(`${parent}${path.sep}`); current = path.dirname(current)) if (fs.lstatSync(current).isSymbolicLink()) return result('blocked', ['HOST_CONTINUATION_SYMLINK_ESCAPE']);
    const real = fs.realpathSync(existing);
    if (real !== fs.realpathSync(parent) && !inside(fs.realpathSync(parent), real)) return result('blocked', ['HOST_CONTINUATION_SYMLINK_ESCAPE']);
    if (fs.existsSync(target) && hash(target) !== ref.sha256) return result('blocked', ['HOST_CONTINUATION_INPUT_CONFLICT']);
  }
  for (const ref of files) {
    const target = path.resolve(child, ref.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.copyFileSync(path.resolve(parent, ref.path), target, fs.constants.COPYFILE_EXCL);
  }
  if (!fs.existsSync(receiptFile)) fs.writeFileSync(receiptFile, bytes, { flag: 'wx' });
  if (!fs.existsSync(runFile)) fs.writeFileSync(runFile, `${JSON.stringify(run, null, 2)}\n`, { flag: 'wx' });
  return { ...evaluated, continuationReceipt: receiptFile };
}

export function validatePreviewGrant(root, binding = null) {
  const continuation = read(path.join(root, 'source-continuation.json'));
  if (!binding && continuation?.continuationScope !== 'macro-host-journey') return null;
  if (!binding || !bound(root, binding.continuation) || !bound(root, binding.readiness)) return { error: 'HOST_PREVIEW_SCOPE_BINDING_INVALID' };
  const receipt = read(path.resolve(root, binding.readiness.path));
  const parent = continuation?.parentArtifactRoot;
  if (continuation?.continuationScope !== 'macro-host-journey' || continuation.learningComplete !== false || continuation.previewReadiness?.sha256 !== binding.readiness.sha256 || JSON.stringify(continuation.partialBrandValidation) !== JSON.stringify(receipt) || !path.isAbsolute(parent || '') || !bound(parent, receipt?.parentHandoff) || !bound(parent, receipt?.learningManifest) || receipt?.inputs?.some((ref) => !bound(parent, ref)) || continuation?.inputs?.some((ref) => !bound(root, ref))) return { error: 'HOST_PREVIEW_SCOPE_BINDING_INVALID' };
  return { continuationScope: 'macro-host-journey', learningComplete: false, fullWorkflowPass: false, partialBrandValidation: { schema: receipt.schema, scope: receipt.scope, reviewerExecutionId: receipt.reviewerExecutionId, allowedUse: receipt.allowedUse, unresolvedExclusions: receipt.unresolvedExclusions, receipt: binding.readiness }, sourceLearningStatus: continuation.sourceLearningStatus, sourceLearningErrors: continuation.sourceLearningErrors };
}

export function evaluateHostDelivery({ root, brand } = {}) {
  root = path.resolve(root || process.cwd());
  if (brand && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(brand)) return result('blocked', ['HOST_BRAND_INVALID']);
  const migration = path.join(root, 'migrations', brand || '');
  const manifest = read(path.join(migration, 'execution-manifest.json'));
  if (!manifest) return result('pending', [], { nextAction: 'continue-host-preview' });
  const partial = validatePreviewGrant(root, manifest.previewContinuation);
  if (partial?.error) return result('blocked', [partial.error]);
  if (manifest.mode === 'apply-host') return evaluateImplementationPreview(root, brand, manifest, partial);
  if (manifest.mode !== 'design-host') return result('blocked', ['HOST_PREVIEW_MODE_REQUIRED']);
  const hostGoal = read(path.join(migration, 'goal-contract.json'));
  if (hostGoal?.mode !== 'design-host' || hostGoal?.requestKind !== 'host-concepts' || hostGoal?.sealed !== true) return result('blocked', ['HOST_PREVIEW_GOAL_INVALID']);
  const pendingQa = (manifest.stages || []).at(-1);
  const mechanical = read(path.join(migration, 'design-host-h5-mechanical-qa.json'));
  // A receipt-backed repair supersedes its archived failed mechanical report.
  // Let next regenerate the report before QA; this is pending, never a PASS.
  const producer = (manifest.stages || []).at(-2);
  const repair = (manifest.h5Retries || []).find(item => item.kind === 'pre-qa-mechanical-repair' && item.replacementStageId === producer?.id);
  const archive = repair && bound(root, repair.archive) ? read(path.resolve(root, repair.archive.path)) : null;
  const mechanicalPath = path.relative(root, path.join(migration, 'design-host-h5-mechanical-qa.json'));
  if (manifest.status === 'running' && !manifest.mechanicalFailure && pendingQa?.stage === 'designVisualQA' && pendingQa.status === 'pending' && !pendingQa.dispatchPath && manifest.currentStageId === pendingQa.id && producer?.status === 'complete' && producer.verdict === 'pass' && producer.retryInput?.priorStageId === repair?.priorStageId && bound(root, {path:producer.receiptPath,sha256:producer.receiptSha256}) && (producer.outputHashes || []).length > 0 && producer.outputHashes.every(ref => bound(root,ref)) && archive?.archivedOutputs?.some(ref => ref.originalPath === mechanicalPath && mechanical && ref.sha256 === hash(path.join(root,mechanicalPath)) && bound(root,ref))) {
    return result('pending', [], {currentStageId:manifest.currentStageId,nextAction:'continue-host-preview'});
  }
  if (pendingQa?.stage === 'designVisualQA' && pendingQa.status === 'pending' && manifest.currentStageId === pendingQa.id && mechanical?.verdict === 'fail') {
    const routeFile = path.join(migration, 'design-host-route.json');
    const directions = read(routeFile)?.h5Directions?.directions || [];
    if (mechanical.schema !== 'design-host-h5-mechanical-qa/v1' || mechanical.brand !== brand || mechanical.route?.path !== path.relative(root, routeFile) || !bound(root, mechanical.route) || mechanical.directions?.length !== 3 || new Set(mechanical.directions.map(item => item.directionId)).size !== 3 || directions.length !== 3 || mechanical.directions.some(item => !bound(root, item.artifact) || !directions.some(direction => direction.id === item.directionId && direction.artifact?.path === item.artifact?.path && direction.artifact?.sha256 === item.artifact?.sha256))) return result('blocked', ['H5_MECHANICAL_QA_BINDING_INVALID'], { nextAction: 'inspect-mechanical-report-bindings' });
    return result('blocked', ['H5_MECHANICAL_QA_FAILED'], { currentStageId: manifest.currentStageId, blockingFindings: mechanical.blockingFindings || [], nextAction: 'repair-mechanical-audit-or-retry-h5', mechanicalReport: { path: path.relative(root, path.join(migration, 'design-host-h5-mechanical-qa.json')), sha256: hash(path.join(migration, 'design-host-h5-mechanical-qa.json')) } });
  }
  if (['blocked', 'timed-out', 'failed'].includes(manifest.status)) return result('blocked', ['HOST_PREVIEW_BLOCKED']);
  const master = read(path.join(migration, 'approved-master.json'));
  // A valid explicit Master remains the authority; this gate never creates ABC.
  if (master) {
    const errors = [];
    if (master.schema !== 'brand-approved-master/v1' || master.approvalSource !== 'explicit-user' || master.status !== 'approved' || !/\.html?$/i.test(master.artifact?.path || '') || !bound(root, master.artifact) || !bound(root, master.qa)) errors.push('APPROVED_MASTER_INVALID');
    if (hash(path.join(migration, 'goal-contract.json')) !== manifest.goalSha256) errors.push('HOST_GOAL_HASH_INVALID');
    const qa = read(path.resolve(root, master.qa?.path || '.'));
    const qaStage = [...(manifest.stages || [])].reverse().find((s) => s.role === 'visualQA' && s.outputHashes?.some((ref) => ref.path === master.qa?.path));
    const qaReceipt = stageReceipt(root, manifest, qaStage, errors);
    if (!qaReceipt?.inputs?.some((ref) => path.resolve(root, ref.path) === path.resolve(root, master.artifact?.path || '.') && ref.sha256 === master.artifact?.sha256 && bound(root, ref))) errors.push('APPROVED_MASTER_QA_ARTIFACT_UNBOUND');
    const producerIds = manifest.stages?.filter((s) => s.role === 'brandApplicationDesigner').map((s) => s.agentExecutionId) || [];
    if (!qaStage?.agentExecutionId || producerIds.includes(qaStage.agentExecutionId) || !['pass', 'approved', 'eligible-for-human-review'].includes(qa?.verdict || qa?.status)) errors.push('APPROVED_MASTER_INDEPENDENT_QA_REQUIRED');
    if (errors.length) return result('blocked', errors);
    return result('delivered', [], { ...partial, userGoalCompleted: true, approvedMaster: true, previewArtifacts: [master.artifact], recommendedArtifacts: [master.artifact], nextAction: 'await-user-host-implementation-request' });
  }
  if (!['awaiting-concept-direction', 'awaiting-user-direction', 'complete'].includes(manifest.status)) return result('pending', [], { currentStageId: manifest.currentStageId, nextAction: 'continue-host-preview' });
  const errors = [];
  const route = read(path.join(migration, 'design-host-route.json'));
  if (route?.sequence !== 'h5-design-system-first') return result('blocked', ['HOST_H5_FIRST_REQUIRED']);
  const bundleRef = route?.knowledgeDecision;
  const bundle = read(path.resolve(root, bundleRef?.path || '.'));
  const validated = validateDesignHostRoute(route, 'before-final-selection', { workspaceRoot: root, bundle, bundleSha256: bundleRef?.path ? hash(path.resolve(root, bundleRef.path)) : null });
  if (!validated.ok) return result('blocked', validated.errors);
  errors.push(...validated.errors);
  if (route?.sequence !== 'h5-design-system-first') errors.push('HOST_H5_FIRST_REQUIRED');
  if (hash(path.join(migration, 'goal-contract.json')) !== manifest.goalSha256) errors.push('HOST_GOAL_HASH_INVALID');
  stageReceipt(root, manifest, latest(manifest, 'h5DirectionGeneration') || latest(manifest, 'conceptGeneration'), errors);
  const qaStage = latest(manifest, 'designVisualQA');
  const qaReceipt = stageReceipt(root, manifest, qaStage, errors);
  if (qaStage?.agentExecutionId !== route?.h5QA?.reviewerExecutionId || qaStage?.agentExecutionId === route?.h5Directions?.producerExecutionId) errors.push('HOST_QA_RECEIPT_ROUTE_MISMATCH');
  const integrationRequired = route?.expressiveGapDecision?.status === 'required';
  const integrationStage = integrationRequired ? latest(manifest, 'expressiveVisualQA') : null;
  const integrationReceipt = integrationRequired ? stageReceipt(root, manifest, integrationStage, errors) : null;
  if (integrationRequired && integrationStage?.agentExecutionId !== route?.expressiveIntegrationQA?.reviewerExecutionId) errors.push('HOST_INTEGRATION_QA_RECEIPT_ROUTE_MISMATCH');
  const auditFile = path.join(migration, 'design-host-h5-audit.json');
  const audit = read(auditFile);
  if (audit?.status !== 'eligible-for-human-review' || !qaReceipt?.outputs?.some((ref) => path.resolve(root, ref.path) === auditFile)) errors.push('HOST_RENDERED_QA_AUDIT_REQUIRED');
  const reportFile = path.join(migration, 'design-host-visual-qa.json');
  const report = read(reportFile);
  const reportBound = qaReceipt?.outputs?.some((ref) => path.resolve(root, ref.path) === reportFile && bound(root, ref));
  const recommendation = reportBound ? normalizeHostRecommendation(report) : null;
  if (!recommendation) errors.push('HOST_RECOMMENDATION_REPORT_REQUIRED');
  const recommended = recommendation?.ids || [];
  const directions = route?.h5Directions?.directions || [];
  if (!recommended.length || recommended.some((id) => !directions.some((d) => d.id === id))) errors.push('HOST_RECOMMENDATION_REQUIRED');
  if (directions.some((d) => !/\.html?$/i.test(d.artifact?.path || '') || !bound(root, d.artifact))) errors.push('HOST_OPENABLE_H5_REQUIRED');
  if (directions.some((d) => !qaReceipt?.inputs?.some((ref) => path.resolve(root, ref.path) === path.resolve(root, d.artifact.path) && ref.sha256 === d.artifact.sha256))) errors.push('HOST_QA_H5_INPUT_UNBOUND');
  const previews = directions.map((d) => ({ id: d.id, ...(integrationRequired ? d.integratedArtifact || d.artifact : d.artifact) }));
  if (previews.some((ref) => !bound(root, ref) || !/\.html?$/i.test(ref.path || '') || !(integrationReceipt || qaReceipt)?.inputs?.some((input) => path.resolve(root, input.path) === path.resolve(root, ref.path) && input.sha256 === ref.sha256))) errors.push('HOST_FINAL_QA_H5_INPUT_UNBOUND');
  if (errors.length) return result('blocked', errors);
  return result('delivered', [], { ...partial, userGoalCompleted: true, previewArtifacts: previews, recommendedArtifacts: previews.filter((d) => recommended.includes(d.id)), recommendationReason: recommendation.reason, comparisonPreview: { path: `/__brand_comparison__?brand=${encodeURIComponent(brand)}`, viewport: { width: 390, height: 844 }, directionIds: previews.map(d => d.id), selection: 'explicit-user-in-conversation', defaultSelection: null }, nextAction: 'show-comparison-h5-and-await-user-selection' });
}

// Read-only compatibility at the consumer boundary. Never infer a recommendation
// from route metadata or chat, and never choose between conflicting QA fields.
export function normalizeHostRecommendation(report) {
  if (!report || typeof report !== 'object') return null;
  const hasFlat = Object.hasOwn(report, 'recommendedDirectionIds') || Object.hasOwn(report, 'recommendationReason');
  const hasNested = Object.hasOwn(report, 'recommendation');
  const valid = value => Array.isArray(value.ids) && value.ids.length > 0
    && value.ids.every(id => typeof id === 'string' && id.trim() === id && id.length > 0)
    && new Set(value.ids).size === value.ids.length
    && typeof value.reason === 'string' && value.reason.trim().length > 0;
  const flat = { ids: report.recommendedDirectionIds, reason: report.recommendationReason };
  const nested = { ids: [report.recommendation?.directionId], reason: report.recommendation?.reason };
  if ((!hasFlat && !hasNested) || (hasFlat && !valid(flat)) || (hasNested && !valid(nested))) return null;
  if (hasFlat && hasNested && (JSON.stringify([...flat.ids].sort()) !== JSON.stringify([...nested.ids].sort()) || flat.reason.trim() !== nested.reason.trim())) return null;
  const selected = hasFlat ? flat : nested;
  return { ids: [...selected.ids], reason: selected.reason.trim() };
}

// Implementation preview is a review handoff, not source-learning or release
// certification. Keep the design-host delivery contract unchanged.
function evaluateImplementationPreview(root, brand, manifest, partial) {
  const errors = [];
  const goal = read(path.resolve(root, manifest.goalPath || ''));
  if (goal?.mode !== 'apply-host' || goal?.requestKind !== 'host-implementation' || goal?.sealed !== true || hash(path.resolve(root, manifest.goalPath || '')) !== manifest.goalSha256) return result('blocked', ['HOST_IMPLEMENTATION_GOAL_INVALID']);
  if (goal.approvedMaster && !bound(root, goal.approvedMaster)) return result('blocked', ['HOST_IMPLEMENTATION_MASTER_CHANGED']);
  if (['blocked', 'failed', 'timed-out'].includes(manifest.status)) {
    // End this attempt visibly; a failed trial is not an invitation to retry forever.
    // Report only a receipt bound to the recorded stage, never infer release readiness.
    const failed = [...(manifest.stages || [])].reverse().find(stage => stage.status === 'failed');
    const receipt = failed && bound(root, { path: failed.receiptPath, sha256: failed.receiptSha256 })
      ? read(path.resolve(root, failed.receiptPath)) : null;
    const matched = Boolean(receipt && ['fail', 'needs-evidence'].includes(receipt.verdict)
      && receipt.verdict === failed.verdict && receipt.stageId === failed.id
      && receipt.goalSha256 === manifest.goalSha256 && receipt.dispatchId === failed.dispatchId
      && receipt.role === failed.role && receipt.agentExecutionId === failed.agentExecutionId);
    return result('blocked', ['HOST_IMPLEMENTATION_PREVIEW_BLOCKED'], {
      attemptStopped: true, automaticRetryAllowed: false, fullWorkflowPass: false,
      nextAction: 'report-blocker-and-stop', blockingStage: failed?.id || manifest.currentStageId || null,
      failureReceiptBound: matched,
      failureOwnerRole: matched ? receipt.failureOwnerRole || failed.role : null,
      blockingFindings: matched && Array.isArray(receipt.blockingFindings) ? receipt.blockingFindings : [],
    });
  }
  const qaStage = latest(manifest, 'previewQA');
  if (qaStage?.status !== 'complete' || qaStage?.verdict !== 'pass') return result('pending', [], { currentStageId: manifest.currentStageId, nextAction: 'continue-implementation-preview-qa' });
  const implementation = latest(manifest, 'hostImplementation');
  stageReceipt(root, manifest, implementation, errors);
  const receipt = stageReceipt(root, manifest, qaStage, errors);
  let report;
  try {
    validateHostPreviewQaRetries(root, manifest);
    if (receipt) report = validateHostPreviewSmoke({ root, brand, receipt, manifest });
  } catch (error) { errors.push(error.message); }
  if (errors.length || !report) return result('blocked', errors.length ? errors : ['HOST_PREVIEW_SMOKE_REPORT_REQUIRED']);
  const approved = manifest.status === 'passed' && manifest.deliveryLevel === 'fast-preview-approved'
    && manifest.previewDecision?.status === 'approve' && manifest.previewDecision?.source === 'explicit-user'
    && manifest.qaReuse?.sourceStageId === qaStage.id;
  return result(approved ? 'preview-approved' : 'ready-for-user-review', [], {
    ...partial, previewReady: true, userApprovalRequired: !approved,
    userApprovalRecorded: approved, scopedPreviewAccepted: approved,
    fullWorkflowPass: false, sourceLearningCertified: false,
    wholeHostCertified: false, hostTarget: goal.hostTarget,
    previewReport: { path: receipt.outputs.find(ref => ref.path.includes('preview-smoke-report')).path },
    runtimeTargets: [...new Set(report.observations.filter(item => ['native', 'browser'].includes(item.runtime)).map(item => item.target))],
    limitations: report.limitations, nextAction: approved ? 'scoped-preview-accepted-no-certification-implied' : 'show-actual-host-and-await-user-review',
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const output = args[0] === 'continuation' ? evaluateSourceContinuation({ root: opt('--root') }) : evaluateHostDelivery({ root: opt('--root'), brand: opt('--brand') });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.status === 'blocked' ? 1 : 0;
}
