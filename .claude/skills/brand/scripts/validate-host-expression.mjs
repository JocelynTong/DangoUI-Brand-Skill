import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function validateHostExpression(root,file){
 const errors=[];const fail=x=>errors.push(x);
 if(!fs.existsSync(file))return {ok:false,errors:['HOST_EXPRESSION_PLAN_REQUIRED']};
 let m;try{m=JSON.parse(fs.readFileSync(file))}catch{return {ok:false,errors:['HOST_EXPRESSION_PLAN_INVALID_JSON']}}
 const bundled=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../knowledge-runtime/knowledge/v0.1/index.json');
 const indexFile=fs.existsSync(bundled)?bundled:path.join(root,'knowledge/v0.1/index.json');
 if(!fs.existsSync(indexFile))return {ok:false,errors:['DECISION_LIBRARY_MISSING']};
 const index=JSON.parse(fs.readFileSync(indexFile));
 const questions=new Set(index.questions.map(q=>q.id));
 function artifact(a,label){if(!a?.path||!a?.sha256){fail(label+'_MISSING');return;}const p=path.resolve(root,a.path);if(!p.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){fail(label+'_FILE');return;}if(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==a.sha256)fail(label+'_STALE');return p;}
 if(m.schema!=='host-expression-plan/v1'||!m.hostTask||!Array.isArray(m.regions)||!m.regions.length)fail('PLAN_SCHEMA');
 artifact(m.hostBaseline,'HOST_BASELINE');artifact(m.brandInput,'BRAND_INPUT');
 const ids=new Set();for(const r of m.regions||[]){if(!r.id||ids.has(r.id))fail('REGION_ID');ids.add(r.id);
 if(!r.reason||!r.primaryTaskProtection||!['none','existing','generated'].includes(r.technique))fail('REGION_DECISION');
 if(!r.knowledge?.length||r.knowledge.some(k=>!questions.has(k.questionId)||!['adopt','adapt','reject'].includes(k.disposition)||!k.contextDifference||!k.reason))fail('KNOWLEDGE_DECISION');
 if(r.technique!=='generated')continue;
 if(!r.brief?.brandConstraints?.length||!r.brief?.freedom?.length||!r.brief?.dynamicContent||!r.brief?.viewportBudget)fail('GENERATION_BRIEF');
 if(!['low','medium','high'].includes(r.reconstructionRisk)||r.reconstructionRisk==='high'&&!r.riskAcceptanceReason)fail('RECONSTRUCTION_RISK');
 artifact(r.concept,'CONCEPT');artifact(r.h5,'H5');
 const proof=artifact(r.proof,'PROOF');if(proof){let p;try{p=JSON.parse(fs.readFileSync(proof))}catch{fail('PROOF_JSON');continue;}
 if(p.h5Sha256!==r.h5?.sha256||p.conceptSha256!==r.concept?.sha256)fail('PROOF_INPUT_MISMATCH');
 if(p.runtime?.ok!==true||!p.runtime?.command||!p.runtime?.evidence?.length)fail('RUNTIME_PROOF');
 for(const a of p.runtime?.evidence||[])artifact(a,'RUNTIME_EVIDENCE');
 if(p.visual?.status!=='accepted'||!p.visual?.reviewer||!p.visual?.limitations)fail('VISUAL_REVIEW_REQUIRED');
 artifact(p.visual?.evidence,'VISUAL_EVIDENCE');
 }
 }
 return {ok:!errors.length,errors,scope:'artifact/decision consistency; not automated aesthetic judgment'};
}
