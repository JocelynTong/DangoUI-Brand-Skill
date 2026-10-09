import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// A preview checks the frozen implementation, not a new brand-learning claim.
// Certification remains the separate visualQA stage after an explicit decision.
export const previewSmokeReportPath = (brand, stageId) => `migrations/${brand}/preview-smoke-report${stageId === 'previewQA-1' ? '' : `.${stageId}`}.json`;

export function hostPreviewSmokeContract(stageId = 'previewQA-1') {
  return {
    goal: 'Independently check the real host against the approved direction and frozen change scope, then report readiness for user review with explicit limitations.',
    acceptanceScope: 'implementation-preview-only',
    acceptanceContractVersion: 'host-preview-smoke/v1',
    roleReference: 'roles/host-visual-qa.md#implementation-preview-smoke',
    reportFieldContract: {
      schema: 'host-preview-smoke/v1', acceptanceScope: 'implementation-preview-only',
      hashReferenceArrays: ['implementationBindings', 'evidenceRefs', 'runtimeBindings'],
      hashReferenceFields: ['path', 'sha256'],
      implementationBindingsSource: 'all outputHashes of the exact latest completed hostImplementation stage; verify bytes, do not adopt its verdict',
      observationFields: ['id', 'runtime', 'target', 'method', 'observed'],
      checkFields: ['id', 'status', 'observationIds'],
      arrayFields: ['limitations', 'blockingFindings'],
      forbiddenCertificationClaims: { wholeHostCertified: false, sourceLearningCertified: false, userApproval: 'pending' },
    },
    tasks: [
      'Verify frozen Goal, approved direction, implementation outputs and protected source bindings.',
      'Observe the actual delivered runtime; inspect representative APPLY pages and the affected high-salience regions. Build or CSS presence is not rendered evidence.',
      'Compare the selected target and actual host for implementation drift within the approved scope; do not reopen design exploration or recertify source learning.',
      'Check affected asset proportions, navigation/menu layering, readable data/empty states and a reversible representative journey. Report unobserved branches and tool limitations explicitly.',
      'Write preview-smoke-report.json with scope, evidence refs, observations, checks and limitations; record immediately. Do not invent scores or unavailable screenshot files.',
    ],
    requirements: [
      'Reviewer execution differs from the host implementation execution and all earlier QA attempts being repaired.',
      'A pass means ready for user review only, never whole-host, source-learning, generative or release certification.',
      'Business preservation, selected-direction preservation and runtime load each require specific independently checked facts and evidence references.',
      'For native shell repairs observe both closed and expanded menus, scene continuity through the safe area, readable options, dismissal and restored controls when applicable.',
      'Every known regression inside the frozen scope blocks readiness. Unknown behavior is a limitation, not a fabricated success or failure; critical missing evidence yields needs-evidence.',
      'Fresh runtime observations must bind the exact current source/build; do not accept an earlier verdict or implementation rationale as evidence.',
      'Include runtimeBindings with live host-relative file paths and independently recomputed SHA-256 values for the source/build files supporting the observed runtime; missing bindings or changed bytes block readiness.',
      'Report workflow completion, business safety and visual preservation separately; full rubric, masked recognition, source/demo three-proof and cross-device certification belong to later certification, not this preview verdict.',
    ],
    inputs: {
      allowed: ['approved target artifacts', 'actual runtime captures and observations', 'protected source/build/asset hashes', 'scoped structural diff'],
      forbidden: ['desired verdict', 'previous QA verdict as proof', 'implementation rationale as visual evidence', 'build pass as fidelity evidence'],
    },
    outputs: [`preview-smoke-report${stageId === 'previewQA-1' ? '' : `.${stageId}`}.json`],
    passCriteria: ['Real runtime observed and bound to current implementation', 'Approved scope and direction preserved with no observed blocking regression', 'Protected business source verified and representative journey restored', 'Limitations explicit and user review boundary retained'],
    failCriteria: ['RUNTIME_NOT_OBSERVED', 'IMPLEMENTATION_DRIFT', 'PROTECTED_BUSINESS_CHANGED', 'ASSET_GEOMETRY_REGRESSION', 'NAVIGATION_STATE_REGRESSION', 'CRITICAL_PREVIEW_EVIDENCE_MISSING', 'QA_NOT_INDEPENDENT'],
    mustNot: ['modify production code or frozen Goal', 'approve the preview on behalf of the user', 'reopen ABC or brand learning', 'invent measurements, scores, screenshot paths or hashes', 'claim full-host or release certification'],
  };
}

export function validateHostPreviewSmoke({ root, brand, receipt, manifest }) {
  const reportRef = (receipt.outputs || []).find(ref => ref.path === previewSmokeReportPath(brand, receipt.stageId));
  if (!reportRef) throw new Error('HOST_PREVIEW_SMOKE_REPORT_REQUIRED');
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = read(path.resolve(root, reportRef.path));
  if (report.schema !== 'host-preview-smoke/v1' || report.acceptanceScope !== 'implementation-preview-only' || report.verdict !== 'pass') throw new Error('HOST_PREVIEW_SMOKE_SCOPE_INVALID');
  if (report.reviewerExecutionId !== receipt.agentExecutionId || report.goalSha256 !== manifest.goalSha256) throw new Error('HOST_PREVIEW_SMOKE_REVIEW_BINDING_INVALID');
  if (report.wholeHostCertified !== false || report.sourceLearningCertified !== false || report.userApproval !== 'pending') throw new Error('HOST_PREVIEW_SMOKE_CERTIFICATION_CLAIM_FORBIDDEN');
  if (!Array.isArray(report.limitations) || !Array.isArray(report.observations) || !report.observations.length || !Array.isArray(report.evidenceRefs) || !report.evidenceRefs.length) throw new Error('HOST_PREVIEW_SMOKE_EVIDENCE_REQUIRED');
  const implementation = [...manifest.stages].reverse().find(stage => stage.stage === 'hostImplementation' && stage.status === 'complete');
  if (!implementation || implementation.agentExecutionId === receipt.agentExecutionId) throw new Error('HOST_PREVIEW_SMOKE_NOT_INDEPENDENT');
  const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const expected = implementation.outputHashes || [];
  if (!expected.every(ref => report.implementationBindings?.some(binding => binding.path === ref.path && binding.sha256 === ref.sha256))) throw new Error('HOST_PREVIEW_SMOKE_IMPLEMENTATION_BINDING_REQUIRED');
  for (const ref of [...expected, ...report.evidenceRefs]) {
    const file = path.resolve(root, ref.path || '');
    const relative = fs.existsSync(file) ? path.relative(fs.realpathSync(root), fs.realpathSync(file)) : '..';
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !ref.sha256 || !fs.existsSync(file) || sha(file) !== ref.sha256) throw new Error('HOST_PREVIEW_SMOKE_EVIDENCE_DRIFT');
  }
  const goal = read(path.resolve(root, manifest.goalPath));
  const hostRoot = path.resolve(goal.hostTarget || '');
  if (!goal.hostTarget || !report.runtimeBindings?.length) throw new Error('HOST_PREVIEW_SMOKE_LIVE_BINDINGS_REQUIRED');
  for (const ref of report.runtimeBindings) {
    const file = path.resolve(hostRoot, ref.path || '');
    const relative = fs.existsSync(file) ? path.relative(fs.realpathSync(hostRoot), fs.realpathSync(file)) : '..';
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.existsSync(file) || sha(file) !== ref.sha256) throw new Error('HOST_PREVIEW_SMOKE_RUNTIME_DRIFT');
  }
  const observations = new Map(report.observations.map(observation => [observation.id, observation]));
  for (const id of ['runtime-load', 'selected-direction', 'business-preservation', 'state-restoration']) {
    const check = report.checks?.find(item => item.id === id);
    if (check?.status !== 'pass' || !check.observationIds?.length || !check.observationIds.every(key => observations.has(key))) throw new Error(`HOST_PREVIEW_SMOKE_CHECK_REQUIRED: ${id}`);
  }
  if (!report.observations.some(item => ['native', 'browser'].includes(item.runtime) && item.target && item.method && item.observed)) throw new Error('HOST_PREVIEW_SMOKE_RUNTIME_OBSERVATION_REQUIRED');
  if (report.blockingFindings?.length) throw new Error('HOST_PREVIEW_SMOKE_BLOCKING_FINDINGS_PRESENT');
  return report;
}
