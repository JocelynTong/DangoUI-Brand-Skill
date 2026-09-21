import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {validateHostExpression as check} from './validate-host-expression.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'expression-test-'));const file=path.join(root,'plan.json');
try{fs.mkdirSync(path.join(root,'knowledge/v0.1'),{recursive:true});fs.writeFileSync(path.join(root,'knowledge/v0.1/index.json'),JSON.stringify({questions:[{id:'allocation'}]}));
const asset=(name,text)=>{fs.writeFileSync(path.join(root,name),text);return {path:name,sha256:crypto.createHash('sha256').update(text).digest('hex')}};
const base=asset('host.txt','fixture'),brand=asset('brand.txt','fixture-brand');const region={id:'search',technique:'none',reason:'high frequency search',primaryTaskProtection:'results first',knowledge:[{questionId:'allocation',disposition:'adapt',contextDifference:'tool not campaign',reason:'no hero needed'}]};
const plan={schema:'host-expression-plan/v1',hostTask:'test fixture',hostBaseline:base,brandInput:brand,regions:[region]};const run=()=>{fs.writeFileSync(file,JSON.stringify(plan));return check(root,file)};
assert.equal(check(root,file).ok,false);assert.equal(run().ok,true);
region.technique='generated';assert.equal(run().ok,false);
region.brief={brandConstraints:['layered'],freedom:['lighting'],dynamicContent:'cards',viewportBudget:'one third results'};region.reconstructionRisk='low';region.concept=asset('concept.txt','concept fixture');region.h5=asset('trial.html','<main>fixture</main>');
const evidence=asset('review.txt','TEST FIXTURE, NOT REAL VISUAL APPROVAL');const proof={h5Sha256:region.h5.sha256,conceptSha256:region.concept.sha256,runtime:{ok:true,command:'fixture-test',evidence:[evidence]},visual:{status:'accepted',reviewer:'test-fixture',limitations:'fixture only',evidence}};
region.proof=asset('proof.json',JSON.stringify(proof));assert.equal(run().ok,true);
fs.appendFileSync(path.join(root,'trial.html'),'changed');assert.ok(run().errors.includes('H5_STALE'));fs.writeFileSync(path.join(root,'trial.html'),'<main>fixture</main>');
proof.visual.status='rejected';region.proof=asset('proof.json',JSON.stringify(proof));assert.ok(run().errors.includes('VISUAL_REVIEW_REQUIRED'));
region.technique='none';region.knowledge[0].questionId='missing';assert.ok(run().errors.includes('KNOWLEDGE_DECISION'));
console.log('PASS: no-image branch, generated branch, missing proof, stale H5, rejected visual review, unresolved question');
}finally{fs.rmSync(root,{recursive:true,force:true})}
