import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectBrandUsage} from './collect-brand-usage.mjs';
import {coordinationReply,validateControlAudit,compactImageConceptResult} from './full-image-concepts.mjs';
test('checkpoint does not create a second production dispatcher',()=>{
 const r=compactImageConceptResult({dispatch:{path:'/isolated/dispatch.json'},dispatchRequest:{directions:[{id:'a'}]}});
 assert.equal(r.producerLaunch,undefined);
 assert.equal(r.dispatchFile,'/isolated/dispatch.json');
 assert.equal(r.dispatchRequest,undefined);
});
test('unchanged status does not replay production or QA inputs',()=>{
 const r={status:'pending-review',reviewRequest:{inputs:['complete unchanged data'],images:['a','b','c']}};
 const first=coordinationReply(r);const again=coordinationReply(r,first.revision);
 assert.equal(again.unchanged,true);assert.equal(again.reviewRequest,undefined);
 assert.deepEqual(first.reviewRequest,r.reviewRequest);
 assert.equal(coordinationReply({...r,status:'ready'},first.revision).unchanged,undefined);
});
test('usage rejects accidental multiple-turn ranges',()=>{
 const rows=[{type:'session_meta',payload:{id:'t'}},...['old','new'].map(turn_id=>({type:'event_msg',payload:{type:'task_started',turn_id}}))];
 assert.throws(()=>collectBrandUsage(rows.map(JSON.stringify).join('\n'),{thread:'t',round:'r',category:'trial',startLine:2,endLine:3}),/multiple turns/);
});
test('QA cannot pass an undisclosed invented control; expressive decoration remains permitted',()=>{
 const r={directions:[{controlAudit:{scanEvidence:'Full screen, header and content',controls:[{label:'Theme switch',location:'header',status:'unsupported',implementationAction:'Omit in implementation'}]}}],limitations:[]};
 assert.throws(()=>validateControlAudit(r),/disclosed/);
 r.limitations=['Theme switch has no host basis; visual direction remains selectable.'];validateControlAudit(r);
 r.directions[0].controlAudit.controls.push({label:'Book illustration',location:'hero',status:'decoration',reason:'No actionable affordance or new workflow'});validateControlAudit(r);
 assert.throws(()=>validateControlAudit({directions:[{}]}),/audit/);
});
