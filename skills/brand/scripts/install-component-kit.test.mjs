import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { installComponentKits, componentKitHandoff } from './install-component-kit.mjs';
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
test('explicit design guide is installed and handed off with code without promoting status', () => {
  const input=setup(), kit=input.kits[0];
  fs.writeFileSync(path.join(input.sourceRoot,'DESIGN.md'),'# Search\nReference only, no source approval.');
  kit.designGuide='DESIGN.md'; kit.status='local-component-trial';
  kit.files.push({path:'DESIGN.md',sha256:createHash('sha256').update(fs.readFileSync(path.join(input.sourceRoot,'DESIGN.md'))).digest('hex')});
  installComponentKits(input);
  const before=kit.files.map(f=>fs.readFileSync(path.join(input.destinationRoot,f.path)));
  const result=componentKitHandoff({root:input.destinationRoot,kits:input.kits});
  assert.equal(result[0].designGuide,'DESIGN.md');
  assert.equal(result[0].status,'local-component-trial');
  assert.deepEqual(result[0].files,kit.files);
  assert.deepEqual(kit.files.map(f=>fs.readFileSync(path.join(input.destinationRoot,f.path))),before);
  fs.writeFileSync(path.join(input.destinationRoot,'DESIGN.md'),'changed');
  assert.throws(()=>componentKitHandoff({root:input.destinationRoot,kits:input.kits}),/HASH_MISMATCH/);
});
test('guide must be explicitly declared; arbitrary markdown is not installed', () => {
  const input=setup(); input.kits[0].designGuide='missing.md';
  assert.throws(()=>installComponentKits(input),/GUIDE_UNDECLARED/);
  delete input.kits[0].designGuide;
  input.kits[0].files.push({path:'unrelated.md',sha256:'bad'});
  assert.throws(()=>installComponentKits(input),/FILE_TYPE_INVALID/);
  assert.deepEqual(fs.readdirSync(input.destinationRoot),[]);
});
test('missing static imports and undeclared package dependencies fail before copying', () => {
  const input=setup(), kit=input.kits[0];
  const update = text => { fs.writeFileSync(path.join(input.sourceRoot,'entry.mjs'),text); kit.files[0].sha256=createHash('sha256').update(text).digest('hex'); };
  update("import './omitted.css'; export default 1;");
  assert.throws(()=>installComponentKits(input),/IMPORT_UNDECLARED/);
  assert.deepEqual(fs.readdirSync(input.destinationRoot),[]);
  update("import { h } from 'vue'; import { DuButton } from 'dangoui'; export default h(DuButton);");
  assert.throws(()=>installComponentKits(input),/DEPENDENCY_UNDECLARED/);
  kit.peerDependencies={vue:'^3.5.0',dangoui:'3.6.16'};
  assert.equal(installComponentKits({...input,validateOnly:true}).copiedOrVerifiedFiles,2);
  assert.deepEqual(fs.readdirSync(input.destinationRoot),[]);
  installComponentKits(input);
});
test('CSS dependencies must ship with the kit, including nested imports', () => {
  const input=setup(), kit=input.kits[0];
  const css="@import './tokens.css'; .kit { background: url('./asset.svg'); }";
  fs.writeFileSync(path.join(input.sourceRoot,'style.css'),css);
  kit.files[1].sha256=createHash('sha256').update(css).digest('hex');
  assert.throws(()=>installComponentKits(input),/IMPORT_UNDECLARED/);
  for (const [name,body] of [['tokens.css',':root{}'],['asset.svg','<svg/>']]) {
    fs.writeFileSync(path.join(input.sourceRoot,name),body);
    kit.files.push({path:name,sha256:createHash('sha256').update(body).digest('hex')});
  }
  assert.equal(installComponentKits(input).copiedOrVerifiedFiles,4);
});
test('Web Vue SFC can be packaged without implying target verification', () => {
  const input=setup(), kit=input.kits[0];
  const code='<template><button>Trial</button></template><style scoped>button{color:inherit}</style>';
  fs.writeFileSync(path.join(input.sourceRoot,'Trial.vue'),code);
  kit.entry='Trial.vue'; delete kit.stylesheet;
  kit.framework='vue3'; kit.runtime='browser-dom'; kit.targets=['web']; kit.verifiedTargets=[];
  kit.files=[{path:'Trial.vue',sha256:createHash('sha256').update(code).digest('hex')}];
  installComponentKits(input);
  const [handoff]=componentKitHandoff({root:input.destinationRoot,kits:input.kits});
  assert.deepEqual(handoff.targets,['web']); assert.deepEqual(handoff.verifiedTargets,[]);
  assert.equal(handoff.status,'unspecified');
});
