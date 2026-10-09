import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { retryHostPreviewQa, validateHostPreviewQaRetries, assertFreshHostPreviewQaReviewer } from './host-preview-qa-retry.mjs';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const roots = [];
function fixture(maxAttempts = 2) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-preview-qa-retry-'));
  roots.push(root);
  const prefix = 'migrations/fixture/';
  const write = (name, data) => {
    const relative = prefix + name;
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    return { path: relative, sha256: hash(file) };
  };
  const master = write('approved-master.json', { authority: 'unchanged' });
  const goal = write('goal-contract.json', { goalId: 'goal', mode: 'apply-host', sealed: true, thresholds: { maxAttempts }, approvedMaster: master });
  const output = write('implementation.json', { result: 'complete' });
  const qa = write('preview-smoke-report.json', { verdict: 'needs-evidence' });
  const dispatch = write('dispatch/previewQA-1.json', { dispatchId: 'dispatch', requiredInputs: [goal, output] });
  const receipt = write('receipts/previewQA-1.json', { dispatchId: 'dispatch', stageId: 'previewQA-1', role: 'visualQA', agentExecutionId: '/root/old_qa', goalSha256: goal.sha256, verdict: 'needs-evidence', inputs: [goal, output], outputs: [qa], blockingFindings: [{ code: 'PREVIEW_QA_SCOPE_CONTRACT_CONFLICT' }] });
  const manifest = { brand: 'fixture', mode: 'apply-host', goalId: 'goal', goalPath: goal.path, goalSha256: goal.sha256, status: 'blocked', currentStageId: null, stages: [
    { id: 'hostImplementation-1', stage: 'hostImplementation', status: 'complete', verdict: 'pass', agentExecutionId: '/root/producer', outputHashes: [output] },
    { id: 'previewQA-1', stage: 'previewQA', role: 'visualQA', status: 'failed', attempt: 1, verdict: 'needs-evidence', dispatchId: 'dispatch', dispatchPath: dispatch.path, dispatchSha256: dispatch.sha256, receiptPath: receipt.path, receiptSha256: receipt.sha256, agentExecutionId: '/root/old_qa', outputHashes: [qa] },
  ] };
  write('execution-manifest.json', manifest);
  return { root, manifest, write, output, qa, options: { root, brand: 'fixture', manifest, continueExisting: true, reason: 'Correct preview scope contract; same approved host', verifyFrozenBindings: () => true } };
}

try {
  const f = fixture();
  const originalStage = JSON.stringify(f.manifest.stages.at(-1));
  const originalGoal = fs.readFileSync(path.join(f.root, f.manifest.goalPath));
  const result = retryHostPreviewQa(f.options);
  assert.equal(result.stage.id, 'previewQA-2');
  assert.equal(result.maximumAttempts, 2);
  assert.equal(result.fullWorkflowPass, false);
  assert.equal(result.manifest.status, 'running');
  assert.equal(JSON.stringify(result.manifest.stages.at(-2)), originalStage);
  assert.equal(f.manifest.status, 'blocked', 'helper returns a new manifest without altering caller state');
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.manifest.goalPath)), originalGoal);
  validateHostPreviewQaRetries(f.root, result.manifest);
  assertFreshHostPreviewQaReviewer(result.manifest, result.stage, '/root/fresh_qa');
  for (const id of ['/root/producer', '/root/old_qa', '/root']) assert.throws(() => assertFreshHostPreviewQaReviewer(result.manifest, result.stage, id), /REVIEWER_REQUIRED/);
  // QA can write a new verdict at its standard path; old output bytes remain
  // independently validated from the archive rather than being rewritten.
  f.write('preview-smoke-report.json', { verdict: 'pass' });
  validateHostPreviewQaRetries(f.root, result.manifest);
  result.manifest.stages[1].verdict = 'pass';
  assert.throws(() => validateHostPreviewQaRetries(f.root, result.manifest), /FAILED_HISTORY_CHANGED/);
  result.manifest.stages[1].verdict = 'needs-evidence';
  fs.writeFileSync(path.join(f.root, f.output.path), 'implementation drift');
  assert.throws(() => validateHostPreviewQaRetries(f.root, result.manifest), /HASH_CHANGED/);

  for (const patch of [{ continueExisting: false }, { reason: '  ' }, { verifyFrozenBindings: null }, { verifyFrozenBindings: () => false }]) {
    const x = fixture();
    assert.throws(() => retryHostPreviewQa({ ...x.options, ...patch }), /AUTHORIZATION_REQUIRED|AUTHORITY/);
    assert.equal(fs.existsSync(path.join(x.root, 'migrations/fixture/attempts')), false);
  }
  const budget = fixture(1);
  assert.throws(() => retryHostPreviewQa(budget.options), /BUDGET_EXHAUSTED/);
  const drift = fixture();
  fs.writeFileSync(path.join(drift.root, drift.output.path), 'changed');
  assert.throws(() => retryHostPreviewQa(drift.options), /HASH_CHANGED/);
  const tampered = fixture();
  tampered.manifest.stages.at(-1).receiptSha256 = '0'.repeat(64);
  assert.throws(() => retryHostPreviewQa(tampered.options), /HASH_CHANGED/);
  const passed = fixture();
  passed.manifest.stages.at(-1).verdict = 'pass';
  assert.throws(() => retryHostPreviewQa(passed.options), /INVALID_STATE/);
  const exhausted = fixture();
  exhausted.manifest.stages.at(-1).attempt = 2;
  assert.throws(() => retryHostPreviewQa(exhausted.options), /BUDGET_EXHAUSTED/);
  const archiveDrift = fixture();
  const archived = retryHostPreviewQa(archiveDrift.options);
  const content = JSON.parse(fs.readFileSync(path.join(archiveDrift.root, archived.archive.path)));
  fs.writeFileSync(path.join(archiveDrift.root, content.archivedOutputs[0].path), 'tampered archive bytes');
  assert.throws(() => validateHostPreviewQaRetries(archiveDrift.root, archived.manifest), /HASH_CHANGED/);
  const oldReceiptDrift = fixture();
  const oldReceiptResult = retryHostPreviewQa(oldReceiptDrift.options);
  fs.writeFileSync(path.join(oldReceiptDrift.root, oldReceiptDrift.manifest.stages.at(-1).receiptPath), 'old verdict rewritten');
  assert.throws(() => validateHostPreviewQaRetries(oldReceiptDrift.root, oldReceiptResult.manifest), /HASH_CHANGED/);
  const symlink = fixture();
  const target = path.join(symlink.root, symlink.qa.path);
  fs.renameSync(target, target + '.original');
  fs.symlinkSync(target + '.original', target);
  assert.throws(() => retryHostPreviewQa(symlink.options), /SYMLINK_FORBIDDEN/);
  assert.equal(fs.existsSync(path.join(symlink.root, 'migrations/fixture/attempts')), false);
  console.log('host preview QA bounded retry regressions passed');
} finally {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
}
