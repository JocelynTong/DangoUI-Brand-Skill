import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const bind = path => ({ path, sha256: sha256(path) });
const outputs = [
  'migrations/hpma-v2/brand-evidence.json',
  'migrations/hpma-v2/source-observation-manifest.json',
  'migrations/hpma-v2/rendered-asset-inventory.json',
  'migrations/hpma-v2/action-evidence.json',
  'migrations/hpma-v2/action-evidence-v02.json',
  'migrations/hpma-v2/third-party-evidence.dembrandt.json',
  'migrations/hpma-v2/section-fidelity-manifest.json',
  'migrations/hpma-v2/evidence-question-matrix.json',
  'output/extractor-benchmark/hpma-v2/dembrandt/result.json',
  'output/extractor-benchmark/hpma-v2/source-captures/capture-manifest.json'
];
const receipt = {
  schema: 'brand-subagent-receipt/v1',
  dispatchId: '67ba3386-2623-4f9b-ab1e-e93281936543',
  runId: 'c1308641-955b-45ab-b505-bf161fed9a01',
  stageId: 'evidence-1', stage: 'evidence', role: 'brandResearcher', attempt: 1,
  goalId: 'hpma-full-revalidation-v2', agentExecutionId: '/root/hpma_v2_evidence',
  goalSha256: '0a4777ec0c4a18a47d803755a65b235c4b6188fbf30c71698a37aeea4adede95',
  completedAt: new Date().toISOString(),
  inputs: [bind('migrations/hpma-v2/goal-contract.json'), bind('migrations/hpma-v2/dispatch/evidence-1.json')],
  outputs: outputs.map(bind), verdict: 'needs-evidence', failureOwnerRole: 'brandResearcher',
  blockingFindings: [
    { code: 'NEWS_VISIBLE_STATE_UNAVAILABLE', failureOwnerRole: 'brandResearcher', message: 'The goal-critical NEWS state could not be reproduced as a distinct rendered surface; .newsBig_box remained zero-width/off-canvas and the retained screenshot is HOME, not NEWS.' },
    { code: 'INTERACTION_VISUAL_DELTA_NOT_OBSERVED', failureOwnerRole: 'brandResearcher', message: 'The category trigger produced no verified computed or pixel delta across before/transition/settled/restored captures.' },
    { code: 'ASSET_PROVENANCE_HASH_UNAVAILABLE', failureOwnerRole: 'brandResearcher', message: 'High-salience pixels are captured, but independent loaded-asset source URLs and binary hashes were not exported, so runtime reuse is not authorized.' }
  ],
  warnings: [
    'The unified entry matched the reviewed hpma v1 pack, but the sealed goal requires legacy-pack-full-revalidation; no v1 Demo or QA was used as observed evidence.',
    'The official surface uses a fixed-height internal presentation with only a 30px document scroll range; the timeline records the actual reachable end rather than inventing a long page.'
  ],
  checks: { goalHashUnchanged: sha256('migrations/hpma-v2/goal-contract.json') === '0a4777ec0c4a18a47d803755a65b235c4b6188fbf30c71698a37aeea4adede95' ? 'pass' : 'fail', evidenceVisibilityStrict: 'fail', evidenceVisibilityBlockingIds: ['observation-consumer-ready'], requiredPageCoverage: '2 covered / 1 explicitly unavailable', mustPreserveTraceability: '1 proved / 2 unresolved', thirdPartySeedDispositions: '6/6', observedClaimCount: 4, interpreterDispatchAllowed: false }
};
fs.mkdirSync(path.join(root,'migrations/hpma-v2/receipts'),{recursive:true});
fs.writeFileSync(path.join(root,'migrations/hpma-v2/receipts/evidence-1.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({ok:true,receipt:'migrations/hpma-v2/receipts/evidence-1.json'},null,2));
