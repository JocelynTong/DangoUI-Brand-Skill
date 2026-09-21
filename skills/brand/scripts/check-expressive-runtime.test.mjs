import assert from 'node:assert/strict';
import {checkRuntime} from './check-expressive-runtime.mjs';
const contract={expectedSlots:5,minSceneWidth:300,minResultsVisible:200,reducedMotion:true};
const good={slotCount:5,brokenImages:0,horizontalOverflow:false,sceneWidth:375,resultsVisible:230,runningAnimations:0};
assert.equal(checkRuntime(good,contract).ok,true);
for(const [field,value,code] of [['slotCount',0,'SLOT_COUNT'],['brokenImages',1,'BROKEN_IMAGE'],['horizontalOverflow',true,'HORIZONTAL_OVERFLOW'],['sceneWidth',100,'SCENE_WIDTH'],['resultsVisible',20,'RESULTS_BUDGET'],['runningAnimations',1,'REDUCED_MOTION']])assert.ok(checkRuntime({...good,[field]:value},contract).errors.includes(code),code);
assert.equal(checkRuntime({},contract).ok,false);
console.log('runtime floor: valid fixture accepted; 6 fault classes and missing evidence rejected');
