import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedRevisionScope} from './selected-image-code.mjs';
test('revision compares against last submission, not original host',()=>{
 const prior={sourceFiles:[{path:'page.tsx',sha256:'a'},{path:'theme.css',sha256:'b'}]};
 const next={sourceFiles:[{path:'page.tsx',sha256:'a'},{path:'theme.css',sha256:'c'}]};
 const scope=selectedRevisionScope(prior,next,{checks:{business:true,tokenRuntime:false,responsive:null}});
 assert.deepEqual(scope.changedSinceReview,['theme.css']);
 assert.deepEqual(scope.failedOrUnverifiedChecks,['visual','tokenRuntime','responsive']);
 assert.deepEqual(scope.priorPassedChecks,['business']);assert.equal(scope.automaticPass,false);
});
test('added and removed business files cannot disappear from revision scope',()=>{
 const scope=selectedRevisionScope({sourceFiles:[{path:'old.ts',sha256:'a'}]},{sourceFiles:[{path:'new.ts',sha256:'b'}]},{checks:{business:false}});
 assert.deepEqual(scope.changedSinceReview,['old.ts','new.ts']);assert.equal(scope.automaticPass,false);
});
test('applicable native and single-page checks remain unknown when absent from prior review',()=>{
 const scope=selectedRevisionScope({sourceFiles:[]},{sourceFiles:[]},{checks:{visual:true,business:true,tokenRuntime:true,responsive:true}},['singlePageScope','nativeRuntime']);
 assert.deepEqual(scope.failedOrUnverifiedChecks,['singlePageScope','nativeRuntime']);
});
