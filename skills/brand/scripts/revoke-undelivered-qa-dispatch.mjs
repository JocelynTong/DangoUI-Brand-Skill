#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyReviewBinding} from './qa-review-contract.mjs';
const assert=(ok,code)=>{if(!ok)throw Error(code);},read=file=>JSON.parse(fs.readFileSync(file)),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function validateQaDispatchRevocations(root,manifest) {
 for(const ledger of manifest.qaDispatchRevocations||[]){const record=read(verifyReviewBinding(root,ledger.record));const {record:binding,...expected}=ledger;assert(JSON.stringify(record)===JSON.stringify(expected),'QA_REVOCATION_LEDGER_CHANGED');verifyReviewBinding(root,record.attestation);for(const ref of record.archivedOutputs)verifyReviewBinding(root,ref);}
}
export function revokeUndeliveredQaDispatch({root,brand,attestation,attestationSha256}) {
 assert(/^[a-z0-9][a-z0-9_-]*$/i.test(brand||''),'QA_REVOCATION_BRAND_REQUIRED');
 root=path.resolve(root);const migration=path.join(root,'migrations',brand),manifestFile=path.join(migration,'execution-manifest.json'),manifest=read(manifestFile),stage=manifest.stages.find(item=>item.id===manifest.currentStageId);
 validateQaDispatchRevocations(root,manifest);
 assert(manifest.mode==='learn-brand'&&manifest.status==='running'&&stage?.role==='visualQA'&&stage.status==='dispatched','QA_REVOCATION_UNDELIVERED_DISPATCH_REQUIRED');
 assert(!stage.agentExecutionId&&!stage.receiptPath&&!stage.receiptSha256&&!fs.existsSync(path.join(migration,'receipts',stage.id+'.json')),'QA_REVOCATION_EXECUTION_OR_RECEIPT_EXISTS');
 assert(attestation&&attestationSha256,'QA_REVOCATION_ATTESTATION_HASH_REQUIRED');
 const attestationRef={path:attestation,sha256:attestationSha256},attestationFile=verifyReviewBinding(root,attestationRef);
 assert(attestationFile.startsWith(migration+path.sep),'QA_REVOCATION_ATTESTATION_OUTSIDE_MIGRATION');
 const approval=read(attestationFile),dispatchFile=path.resolve(root,stage.dispatchPath||'');
 assert(dispatchFile.startsWith(migration+path.sep),'QA_REVOCATION_DISPATCH_OUTSIDE_MIGRATION');
 const dispatchRef={path:stage.dispatchPath,sha256:approval.dispatchSha256},dispatch=read(verifyReviewBinding(root,dispatchRef));
 assert(approval.schema==='brand-qa-dispatch-revocation/v1'&&approval.ownerRole==='designDirectorOrchestrator'&&String(approval.attestedBy||'').trim()&&approval.delivered===false&&approval.executed===false&&String(approval.reason||'').trim(),'QA_REVOCATION_DIRECTOR_ATTESTATION_REQUIRED');
 assert(approval.stageId===stage.id&&approval.dispatchId===stage.dispatchId&&dispatch.stageId===stage.id&&dispatch.dispatchId===stage.dispatchId&&dispatch.role==='visualQA','QA_REVOCATION_STALE_DISPATCH');
 verifyReviewBinding(root,{path:manifest.goalPath||`migrations/${brand}/goal-contract.json`,sha256:manifest.goalSha256});
 assert(dispatch.goalSha256===manifest.goalSha256,'QA_REVOCATION_GOAL_MISMATCH');
 const revokeId=crypto.randomUUID(),directory=path.join(migration,'qa-dispatch-revocations',revokeId);fs.mkdirSync(directory,{recursive:true});
 const archived=[];for(const original of [manifestFile,dispatchFile,attestationFile]){const target=path.join(directory,path.basename(original));fs.copyFileSync(original,target,fs.constants.COPYFILE_EXCL);archived.push({originalPath:path.relative(root,original),path:path.relative(root,target),sha256:hash(target)});}
 const ledger={schema:'brand-qa-dispatch-revocation-record/v1',revokeId,stageId:stage.id,dispatchId:stage.dispatchId,priorStatus:'dispatched',status:'revoked-undelivered',attestation:attestationRef,archivedOutputs:archived,reason:approval.reason,revokedAt:new Date().toISOString()};
 const recordFile=path.join(directory,'revocation.json');fs.writeFileSync(recordFile,JSON.stringify(ledger,null,2)+'\n',{flag:'wx'});
 manifest.qaDispatchRevocations ||= [];manifest.qaDispatchRevocations.push({...ledger,record:{path:path.relative(root,recordFile),sha256:hash(recordFile)}});
 stage.status='pending';delete stage.dispatchId;delete stage.dispatchPath;delete stage.startedAt;manifest.updatedAt=ledger.revokedAt;
 fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');return {ok:true,status:'pending',stageId:stage.id,revokeId,record:{path:path.relative(root,recordFile),sha256:hash(recordFile)},message:'Only the attested undelivered dispatch was revoked; prepare QA explicitly before dispatch.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),opt=name=>args[args.indexOf(name)+1];try{console.log(JSON.stringify(revokeUndeliveredQaDispatch({root:args.includes('--root')?opt('--root'):process.cwd(),brand:opt('--brand'),attestation:opt('--attestation'),attestationSha256:opt('--attestation-sha256')}),null,2));}catch(error){console.error(error.message);process.exitCode=2;}}
