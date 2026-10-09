import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const list = value => Array.isArray(value) ? value : [];
const reject = code => { throw new Error(`HOST_PREVIEW_QA_RETRY_${code}`); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function verify(root, binding) {
  if (!binding?.path || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) reject('BINDING_INVALID');
  const file = path.resolve(root, binding.path);
  if (sha(file) !== binding.sha256) reject(`HASH_CHANGED: ${binding.path}`);
  return file;
}

// Archive writes are confined to the isolated run. Existing files are never
// overwritten, including after a partially completed archival operation.
function safeRunFile(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`)) reject('ARCHIVE_PATH_OUTSIDE_RUN');
  for (let current = file; current !== path.dirname(root); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) reject('ARCHIVE_SYMLINK_FORBIDDEN');
    if (current === root) break;
  }
  return file;
}

function dedupe(bindings) {
  const result = new Map();
  for (const binding of bindings) {
    if (result.has(binding.path) && result.get(binding.path).sha256 !== binding.sha256) reject('FROZEN_BINDING_CONFLICT');
    result.set(binding.path, binding);
  }
  return [...result.values()];
}

export function assertFreshHostPreviewQaReviewer(manifest, current, agentExecutionId) {
  if (!String(agentExecutionId || '').startsWith('/root/') || agentExecutionId === '/root') reject('REAL_REVIEWER_REQUIRED');
  const excluded = list(current?.retryInput?.excludedReviewerExecutionIds);
  const producers = list(manifest.stages).filter(s => s.stage === 'hostImplementation').map(s => s.agentExecutionId);
  if ([...excluded, ...producers].includes(agentExecutionId)) reject('FRESH_INDEPENDENT_REVIEWER_REQUIRED');
}

export function validateHostPreviewQaRetries(root, manifest) {
  root = path.resolve(root);
  for (const retry of list(manifest.hostPreviewQaRetries)) {
    const archive = read(verify(root, retry.archive));
    if (archive.schema !== 'brand-host-preview-qa-attempt-archive/v1') reject('ARCHIVE_SCHEMA_INVALID');
    const prior = manifest.stages.find(stage => stage.id === retry.priorStageId);
    if (JSON.stringify(prior) !== JSON.stringify(archive.stage)) reject('FAILED_HISTORY_CHANGED');
    for (const binding of list(archive.archivedOutputs)) verify(root, binding);
    for (const binding of list(archive.frozenInputs)) verify(root, binding);
    verify(root, { path: prior?.receiptPath, sha256: prior?.receiptSha256 });
    verify(root, { path: prior?.dispatchPath, sha256: prior?.dispatchSha256 });
    const required = [...list(prior?.outputHashes), { path: prior?.receiptPath, sha256: prior?.receiptSha256 }, { path: prior?.dispatchPath, sha256: prior?.dispatchSha256 }, { path: manifest.goalPath, sha256: manifest.goalSha256 }];
    for (const binding of required) {
      if (!archive.archivedOutputs.some(item => item.originalPath === binding.path && item.sha256 === binding.sha256)) reject('ARCHIVE_BINDING_MISSING');
    }
  }
}

// The caller validates the current design/pre-edit/post-edit authority first,
// then persists the returned manifest using its existing state-machine writer.
// This helper never edits the host, old receipt, old dispatch or old outputs.
export function retryHostPreviewQa({ root, brand, manifest, continueExisting, reason, verifyFrozenBindings }) {
  root = path.resolve(root);
  if (continueExisting !== true || !String(reason || '').trim()) reject('AUTHORIZATION_REQUIRED');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(brand || '') || manifest.brand !== brand) reject('BRAND_MISMATCH');
  validateHostPreviewQaRetries(root, manifest);
  const latest = manifest.stages.at(-1);
  if (manifest.mode !== 'apply-host' || manifest.status !== 'blocked' || manifest.currentStageId || latest?.stage !== 'previewQA' || latest.role !== 'visualQA' || latest.status !== 'failed' || latest.verdict !== 'needs-evidence') reject('INVALID_STATE');
  if (!/^[a-zA-Z0-9_-]+$/.test(latest.id)) reject('STAGE_ID_INVALID');
  const goal = read(verify(root, { path: manifest.goalPath, sha256: manifest.goalSha256 }));
  if (goal.sealed !== true || goal.mode !== 'apply-host' || goal.goalId !== manifest.goalId) reject('GOAL_MISMATCH');
  const declaredLimit = goal.thresholds?.maxAttempts ?? 2;
  if (!Number.isInteger(declaredLimit) || declaredLimit < 1) reject('GOAL_BUDGET_INVALID');
  const maximumAttempts = Math.min(2, declaredLimit);
  const previousAttempts = manifest.stages.filter(s => s.stage === 'previewQA');
  if (previousAttempts.length >= maximumAttempts || Number(latest.attempt || 1) >= maximumAttempts) reject('BUDGET_EXHAUSTED');
  const receiptBinding = { path: latest.receiptPath, sha256: latest.receiptSha256 };
  const dispatchBinding = { path: latest.dispatchPath, sha256: latest.dispatchSha256 };
  const receipt = read(verify(root, receiptBinding));
  const dispatch = read(verify(root, dispatchBinding));
  if (receipt.stageId !== latest.id || receipt.role !== latest.role || receipt.verdict !== latest.verdict || receipt.goalSha256 !== manifest.goalSha256 || receipt.dispatchId !== latest.dispatchId || dispatch.dispatchId !== latest.dispatchId || receipt.agentExecutionId !== latest.agentExecutionId || JSON.stringify(list(receipt.outputs)) !== JSON.stringify(list(latest.outputHashes))) reject('RECEIPT_MISMATCH');
  if (!list(receipt.blockingFindings).length) reject('BLOCKING_FINDING_REQUIRED');
  for (const binding of list(dispatch.requiredInputs)) {
    if (!list(receipt.inputs).some(item => item.path === binding.path && item.sha256 === binding.sha256)) reject('RECEIPT_FROZEN_INPUT_MISSING');
  }
  const implementation = [...manifest.stages].reverse().find(s => s.stage === 'hostImplementation');
  if (!implementation || implementation.status !== 'complete' || implementation.verdict !== 'pass') reject('IMPLEMENTATION_PASS_REQUIRED');
  const frozenInputs = dedupe([
    ...list(dispatch.requiredInputs), ...list(implementation.outputHashes),
    { path: manifest.goalPath, sha256: manifest.goalSha256 },
    ...(goal.approvedMaster ? [goal.approvedMaster] : []),
    ...Object.values(manifest.selectedH5PosteditBinding || {}).filter(b => b?.path && b?.sha256),
  ]);
  for (const binding of frozenInputs) verify(root, binding);
  if (typeof verifyFrozenBindings !== 'function') reject('AUTHORITY_VALIDATOR_REQUIRED');
  if (verifyFrozenBindings({ manifest, latest, receipt, implementation, goal }) === false) reject('AUTHORITY_INVALID');
  const manifestPath = `migrations/${brand}/execution-manifest.json`;
  const manifestFile = safeRunFile(root, manifestPath);
  if (JSON.stringify(read(manifestFile)) !== JSON.stringify(manifest)) reject('MANIFEST_STALE');
  const bindings = dedupe([...frozenInputs, ...list(latest.outputHashes), receiptBinding, dispatchBinding, { path: manifestPath, sha256: sha(manifestFile) }]);
  const archiveRelative = `migrations/${brand}/attempts/${latest.id}/archive.json`;
  const archiveFile = safeRunFile(root, archiveRelative);
  if (fs.existsSync(path.dirname(archiveFile))) reject('ARCHIVE_ALREADY_EXISTS');
  // Validate every source before performing the first write.
  for (const binding of bindings) {
    safeRunFile(root, binding.path);
    if (!fs.lstatSync(verify(root, binding)).isFile()) reject('ARCHIVE_FILE_REQUIRED');
  }
  const archivedOutputs = bindings.map(binding => {
    const source = path.resolve(root, binding.path);
    const relativeSource = path.relative(root, source);
    if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) reject('ARCHIVE_SOURCE_OUTSIDE_RUN');
    const targetRelative = `migrations/${brand}/attempts/${latest.id}/workspace/${relativeSource}`;
    const target = safeRunFile(root, targetRelative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    return { originalPath: binding.path, path: targetRelative, sha256: binding.sha256 };
  });
  fs.mkdirSync(path.dirname(archiveFile), { recursive: true });
  fs.writeFileSync(archiveFile, `${JSON.stringify({ schema: 'brand-host-preview-qa-attempt-archive/v1', stage: latest, archivedOutputs, frozenInputs }, null, 2)}\n`, { flag: 'wx' });
  const archive = { path: archiveRelative, sha256: sha(archiveFile) };
  const next = structuredClone(manifest);
  const attempt = Number(latest.attempt || 1) + 1;
  let id = `previewQA-${attempt}`;
  while (next.stages.some(s => s.id === id)) id = `previewQA-${attempt}-${crypto.randomUUID().slice(0, 8)}`;
  const stage = { id, stage: 'previewQA', role: 'visualQA', attempt, maxAttempts: maximumAttempts, status: 'pending', retryInput: {
    priorStageId: latest.id, failedAttemptArchive: archive, reason: String(reason).trim(), frozenInputs,
    excludedReviewerExecutionIds: [...new Set(next.stages.map(s => s.agentExecutionId).filter(Boolean))],
    requirement: 'Review only the unchanged approved host and completed implementation using the corrected previewQA acceptance contract. Preserve prior verdicts and authority. Fresh independent QA is required; no design, implementation, brand-learning certification or public-distribution expansion.',
  } };
  next.hostPreviewQaRetries ||= [];
  next.hostPreviewQaRetries.push({ priorStageId: latest.id, replacementStageId: id, archive, authorizedAt: new Date().toISOString(), authorization: 'explicit-continue-existing', reason: stage.retryInput.reason, additionalAttempts: 1 });
  next.stages.push(stage);
  next.status = 'running';
  next.currentStageId = id;
  return { manifest: next, stage, archive, maximumAttempts, fullWorkflowPass: false };
}
