import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { installComponentKits } from './install-component-kit.mjs';
const setup = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'component-kit-test-'));
  const sourceRoot = path.join(root, 'source'), destinationRoot = path.join(root, 'destination');
  fs.mkdirSync(sourceRoot); fs.mkdirSync(destinationRoot);
  fs.writeFileSync(path.join(sourceRoot, 'entry.mjs'), 'export default 1;');
  fs.writeFileSync(path.join(sourceRoot, 'style.css'), '.kit{}');
  const files = ['entry.mjs', 'style.css'].map(p => ({path:p,sha256:createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,p))).digest('hex')}));
  return {sourceRoot,destinationRoot,kits:[{id:'test',entry:'entry.mjs',stylesheet:'style.css',files}]};
};
test('copies declared files only and safely repeats', () => {
  const input=setup(); fs.writeFileSync(path.join(input.sourceRoot,'history.png'),'not runtime');
  assert.equal(installComponentKits(input).copiedOrVerifiedFiles,2);
  assert.deepEqual(fs.readdirSync(input.destinationRoot).sort(),['entry.mjs','style.css']);
  assert.equal(installComponentKits(input).copiedOrVerifiedFiles,2);
});
test('hash mismatch writes no runtime files', () => {
  const input=setup(); input.kits[0].files[1].sha256='bad';
  assert.throws(()=>installComponentKits(input),/HASH_MISMATCH/);
  assert.deepEqual(fs.readdirSync(input.destinationRoot),[]);
});
test('legacy packs without kits remain a no-op; missing declared files block', () => {
  const input=setup();
  assert.equal(installComponentKits({...input,kits:[]}).copiedOrVerifiedFiles,0);
  input.kits[0].files.push({path:'missing.css',sha256:'bad'});
  assert.throws(()=>installComponentKits(input),/MISSING_OR_UNSAFE/);
  assert.deepEqual(fs.readdirSync(input.destinationRoot),[]);
});
test('rejects traversal and undeclared entry', () => {
  const input=setup(); input.kits[0].files.push({path:'../escape.js',sha256:'bad'});
  assert.throws(()=>installComponentKits(input),/PATH_INVALID/);
  input.kits[0].entry='missing.mjs';
  assert.throws(()=>installComponentKits(input),/ENTRY_UNDECLARED/);
});
test('does not overwrite destination changes or follow source symlink outside root', () => {
  const input=setup(); fs.writeFileSync(path.join(input.destinationRoot,'entry.mjs'),'user changes');
  assert.throws(()=>installComponentKits(input),/DESTINATION_CONFLICT/);
  const second=setup(); fs.symlinkSync(path.join(input.sourceRoot,'entry.mjs'),path.join(second.sourceRoot,'outside.mjs'));
  second.kits[0].files.push({path:'outside.mjs',sha256:input.kits[0].files[0].sha256});
  assert.throws(()=>installComponentKits(second),/MISSING_OR_UNSAFE/);
});
