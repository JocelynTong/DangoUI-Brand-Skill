import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {manage} from './brand-artifacts.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'brand-artifact-test-'));
try {
 const a=manage('init',{root,host:'/test/host'}),b=manage('init',{root,host:'/test/host'});
 assert.notEqual(a.buildDirectory,b.buildDirectory);
 assert.throws(()=>manage('quarantine',{root,id:a.id}),/Active/);
 fs.writeFileSync(path.join(a.buildDirectory,'proof.txt'),'unchanged');
 manage('finish',{root,id:a.id});manage('quarantine',{root,id:a.id});
 assert.equal(manage('list',{root}).length,1);
 const restored=manage('restore',{root,id:a.id});assert.equal(fs.readFileSync(path.join(restored.directory,'build/proof.txt'),'utf8'),'unchanged');
 manage('protect',{root,id:a.id,reason:'Selected concept evidence'});
 assert.throws(()=>manage('quarantine',{root,id:a.id}),/protected/);
 assert.throws(()=>manage('finish',{root,id:'../outside'}),/Invalid/);
 fs.symlinkSync('/tmp',path.join(root,'runs','symlink'));assert.throws(()=>manage('finish',{root,id:'symlink'}),/Symlink/);
 console.log('PASS isolated runs, active/protected guard, restore bytes, traversal and symlink rejection');
}finally{fs.rmSync(root,{recursive:true,force:true});}
