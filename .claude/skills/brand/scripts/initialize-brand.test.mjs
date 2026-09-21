import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {initializeBrand} from './initialize-brand.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'brand-init-'));
fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'fixture',dependencies:{'@tarojs/taro':'4',vue:'3'}}));
for(const installStatus of ['installed','updated','already-current']) test(`${installStatus} collects missing inputs without writing`,()=>{
 const before=fs.readdirSync(root);const pkg=fs.readFileSync(path.join(root,'package.json'),'utf8');
 const result=initializeBrand({host:root,hostConfirmed:true,installStatus});
 assert.deepEqual(result.missing.map(x=>x.field),['reference','page']);
 assert.equal(result.readOnly,true);assert.deepEqual(fs.readdirSync(root),before);assert.equal(fs.readFileSync(path.join(root,'package.json'),'utf8'),pkg);
});
test('complete inputs route to planning, not implementation',()=>assert.equal(initializeBrand({host:root,hostConfirmed:true,reference:'https://example.com',page:'home'}).status,'ready-for-planning'));
test('unconfirmed directory is asked about',()=>assert.equal(initializeBrand({host:root}).missing[0].field,'host'));
test('missing directory is handled without creating it',()=>{const target=path.join(root,'absent');assert.equal(initializeBrand({host:target,hostConfirmed:true}).missing[0].field,'host');assert.equal(fs.existsSync(target),false)});
test('workflow init uses executable entry',()=>{const r=spawnSync(process.execPath,['skills/brand/scripts/run-brand-workflow.mjs','init','--host',root,'--host-confirmed'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'needs-input')});
for(const installStatus of ['installed','updated','already-current','unknown']) test(`${installStatus} user reply exposes library and supported syntax`,()=>{
 const r=initializeBrand({host:root,hostConfirmed:true,installStatus});
 assert.match(r.welcome,/https:\/\/jocelyntong.github.io\/DangoUI-Brand-Skill\/#\/variants/);
 assert.match(r.welcome,/先选品牌，再切换场景/);assert.match(r.welcome,/复制使用描述/);
 assert.match(r.welcome,/\$brand/);assert.match(r.welcome,/\/brand/);assert.match(r.welcome,/自带官网/);
 assert.doesNotMatch(r.welcome,/要使用的项目目录/);
});
test('complete inputs retain discovery without asking again',()=>{
 const r=initializeBrand({host:root,hostConfirmed:true,reference:'https://example.com',page:'home'});
 assert.equal(r.missing.length,0);assert.match(r.welcome,/#\/variants/);
});
