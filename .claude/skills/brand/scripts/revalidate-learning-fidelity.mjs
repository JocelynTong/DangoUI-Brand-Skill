import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {readCanonicalLearningProof} from './learning-proof-contract.mjs';

// Read-only: rederive the verdict from frozen inputs, including old QA packets
// that predate completionContract. No stored PASS label is an attestation.
export function revalidateLearningFidelity({root,brand,goalFile,recordedReport=null}={}) {
  const args=['--root',root,'--brand',brand];
  if(goalFile) args.push('--goal-file',goalFile);
  const flags={qaInputManifest:'--qa-input-file',assessment:'--assessment-file',visualPatternInventory:'--inventory-file',generativeProof:'--generative-proof-file'};
  for(const [key,flag] of Object.entries(flags)) if(recordedReport?.inputPaths?.[key]) args.push(flag,recordedReport.inputPaths[key]);
  const run=spawnSync(process.execPath,[fileURLToPath(new URL('./validate-brand-fidelity.mjs',import.meta.url)),...args],{cwd:path.resolve(root),encoding:'utf8'});
  let report=null;try{report=JSON.parse(run.stdout);}catch{}
  const errors=[];
  if(run.status!==0||!readCanonicalLearningProof(report).threeProofsPassed)errors.push('LEARNING_FIDELITY_REVALIDATION_FAILED');
  if(recordedReport){
    const sameHashes=['goal','qaInputManifest','assessment','visualPatternInventory','generativeProof'].every(key=>report?.inputHashes?.[key] && recordedReport.inputHashes?.[key]===report.inputHashes[key]);
    const sameProofs=JSON.stringify(readCanonicalLearningProof(recordedReport).proofStatus)===JSON.stringify(readCanonicalLearningProof(report).proofStatus);
    const sameScores=recordedReport.overallScore===report?.overallScore && JSON.stringify(recordedReport.thresholds)===JSON.stringify(report?.thresholds) && JSON.stringify(recordedReport.pageResults)===JSON.stringify(report?.pageResults);
    if(!sameHashes||!sameProofs||!sameScores||recordedReport.status!==report?.status||recordedReport.goalSha256!==report?.goalSha256||recordedReport.attempt!==report?.attempt)errors.push('LEARNING_FIDELITY_RECORDED_RESULT_MISMATCH');
  }
  return {ok:errors.length===0,errors,report,exitCode:run.status,stderr:run.stderr||''};
}
