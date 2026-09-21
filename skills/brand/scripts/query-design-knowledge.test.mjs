import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
const script=new URL('./query-design-knowledge.mjs',import.meta.url).pathname;
const query=(...args)=>JSON.parse(execFileSync(process.execPath,[script,...args],{encoding:'utf8'}));
for(const stage of ['learn-brand','design-host','apply-host','repair','acceptance']){
 const results=query('stage',stage);assert(results.length>0);
 for(const q of results){const detail=query('question',q.id);for(const rule of detail.hypothesisRefs)query('rule',rule);for(const c of detail.caseRefs)query('case',c);}
}
assert(query('stage','apply-host').some(q=>q.id==='scene-occlusion'));
assert(!query('stage','learn-brand').some(q=>q.id==='scene-occlusion'));
assert.notEqual(spawnSync(process.execPath,[script,'stage','unknown']).status,0);
assert.equal(query('rule','scene-occlusion').status,'candidate');
console.log('PASS: stage routing, dependency resolution, invalid stage rejection, candidate preserved');
const merged=query('basis','host-expressive-allocation');
assert.equal(merged.question,'expressive-productive-allocation-question');
assert.equal(merged.status,'candidate');
assert(!query('stage','design-host').some(q=>q.id==='host-expressive-allocation'));
assert(query('stage','learn-brand').some(q=>q.id==='cross-page-token-promotion-question'));
for(const stage of ['learn-brand','design-host','apply-host','repair','acceptance']){
 for(const q of query('stage',stage)){
  const basis=query('basis',q.id);assert(basis.items.length>0);assert.equal(basis.question,q.id);
  for(const ref of basis.sourceRefs)query(ref.kind,ref.id);
  for(const note of basis.caseNotes||[])query('case',note.caseId);
 }
}
console.log('PASS: focused basis, merged alias, stage coverage and source references');
for(const reason of ['whole-design','cross-question','conflict','insufficient','novel-context']){
 const r=query('basis','host-generation-choice','--context='+reason);
 assert.equal(r.reading.level,'full');assert(r.fullSources.length);assert(r.fullSources.every(s=>s.humanGuide.length));assert(r.fullCases.length);
}
assert.equal(query('basis','scene-continuity').reading.level,'focused');
assert.equal(query('basis','host-expressive-allocation','--context=whole-design').question,'expressive-productive-allocation-question');
assert.notEqual(spawnSync(process.execPath,[script,'basis','scene-continuity','--context=typo']).status,0);
console.log('PASS: full-source escalation, default focused path, merged escalation and invalid context');
