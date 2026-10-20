import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectNativeBinding} from './native-binding.mjs';
test('QD binding preflight distinguishes export omission, placeholder and valid appId without leaking secrets',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'binding-unit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({devDependencies:{'taro-plugin-qd':'1'}}));
 assert.equal(inspectNativeBinding(root).ready,false);
 fs.writeFileSync(path.join(root,'qdmp.json'),JSON.stringify({appId:'从平台获取'}));
 assert.equal(inspectNativeBinding(root).ready,false);
 fs.writeFileSync(path.join(root,'qdmp.json'),JSON.stringify({appId:'echoTest123',appSecret:'never-return-this'}));
 const result=inspectNativeBinding(root);assert.equal(result.ready,true);assert.equal(result.runtimeVerified,false);
 assert.ok(!JSON.stringify(result).includes('never-return-this'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{react:'19'}}));
 assert.equal(inspectNativeBinding(root).required,false);
});
