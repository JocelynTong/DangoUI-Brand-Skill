import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {imageCoordinationReply} from './image-coordination-reply.mjs';
test('normal repeat suppresses packet without caller tracking a revision; recovery retains full inputs',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brand-reply-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const options={root:dir,brand:'dango',scope:'test',cacheRoot:path.join(dir,'cache')};
 const result={status:'review-ready',reviewRequest:{inputs:['complete DTCG','component mapping','design.md'],images:['a','b','c']}};
 const first=imageCoordinationReply(result,options),second=imageCoordinationReply(result,options);
 assert.equal(first.unchanged,undefined);assert.equal(second.unchanged,true);
 assert.equal(second.reviewRequest,undefined);assert.deepEqual(JSON.parse(fs.readFileSync(second.packetFile)).reviewRequest,result.reviewRequest);
 assert.equal(imageCoordinationReply({...result,status:'ready-for-user-review'},options).unchanged,undefined);
 assert.equal(imageCoordinationReply(result,{...options,scope:'fresh-caller'}).unchanged,undefined);
});
