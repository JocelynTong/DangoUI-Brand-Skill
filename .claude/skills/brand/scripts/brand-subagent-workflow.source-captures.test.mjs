import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { resolveEvidenceReference } from './evidence-file-references.mjs';

const source = fs.readFileSync(new URL('./brand-subagent-workflow.mjs', import.meta.url), 'utf8');
const functions = ['h5ProducerSourceCaptures', 'frozenH5QaSourceInputs', 'hashedPath', 'verifyHashedPath', 'sha256File', 'readJsonRequired', 'relative', 'array', 'dispatchInputs'].map(name => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}).join('\n');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'producer-source-captures-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const brand = 'fixture', migrationDir = path.join(root, 'migrations', brand);
  fs.mkdirSync(migrationDir, {recursive: true});
  const save = (name, value) => {
    const file = path.join(migrationDir, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return {path: path.relative(root, file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
  };
  const ctx = {fs, path, crypto, root, brand, migrationDir, resolveEvidenceReference,
    fail(message) { throw new Error(message); },
    latestInputsByPath(items) { return [...new Map(items.map(item => [item.path, item])).values()]; },
  };
  for (const [key, name] of Object.entries({goalFile:'goal-contract.json', hostStartupPageFile:'host-startup-page.json', hostStartupBaselineFile:'host-startup-baseline.json', designKnowledgeBundleFile:'design-knowledge-bundle.json', brandRenderKitFile:'brand-render-kit.json'})) {
    ctx[key] = path.join(migrationDir, name); save(name, {});
  }
  for (const name of ['brand-evidence.json', 'brand-intent.json', 'brand-mod.json', 'fast-host-brief.json']) save(name, {});
  vm.runInNewContext(functions, ctx);
  return {...ctx, save};
}

test('producer dispatch receives deduplicated declared images, claim mapping and explicit gaps only', t => {
  const f = fixture(t), image = f.save('evidence/frame.png', 'image');
  f.save('evidence/unreferenced.png', 'historical');
  f.save('brand-evidence.json', {claims: [
    {id:'a', capture:'evidence/frame.png'}, {id:'b', capture:image},
    {id:'missing', capture:'evidence/missing.png'}, {id:'no-capture'},
  ]});
  const handoff = f.h5ProducerSourceCaptures();
  assert.equal(handoff.captures.length, 1);
  assert.equal(handoff.captures[0].sha256, image.sha256);
  assert.deepEqual([...handoff.captures[0].claimIds], ['a', 'b']);
  assert.deepEqual(handoff.missing.map(item => item.reason).join(','), 'capture-file-missing,capture-not-declared');
  const inputs = f.dispatchInputs({mode:'design-host'}, {stage:'h5DirectionGeneration'});
  assert.deepEqual(JSON.parse(JSON.stringify(inputs.filter(item => item.path.endsWith('.png')))), [image]);
});

test('producer rejects explicit hash mismatch and escaping paths or symlinks', t => {
  const f = fixture(t), image = f.save('frame.png', 'image');
  for (const capture of [{...image, sha256:'wrong'}, '../'.repeat(8) + 'escape.png', '/tmp/escape.png']) {
    f.save('brand-evidence.json', {claims:[{id:'bad', capture}]});
    assert.throws(() => f.h5ProducerSourceCaptures(), /H5_SOURCE_CAPTURE_(HASH_MISMATCH|INVALID)/);
  }
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-capture-'));
  t.after(() => fs.rmSync(outside, {recursive:true, force:true}));
  fs.writeFileSync(path.join(outside, 'frame.png'), 'outside');
  fs.symlinkSync(outside, path.join(f.migrationDir, 'escape'));
  for (const reference of ['escape/frame.png', 'escape/missing.png']) {
    f.save('brand-evidence.json', {claims:[{id:'bad', capture:reference}]});
    assert.throws(() => f.h5ProducerSourceCaptures(), /H5_SOURCE_CAPTURE_INVALID/);
  }
});

test('original scroll sequences deliver every frame rather than only the cover', t => {
  const f = fixture(t);
  const first = f.save('frames/000.png', 'first');
  const last = f.save('frames/010.png', 'last');
  f.save('brand-evidence.json', {claims:[{id:'sequence',capture:{path:first.path,frames:[first,last]}}]});
  assert.deepEqual(JSON.parse(JSON.stringify(f.h5ProducerSourceCaptures().captures.map(({path,sha256})=>({path,sha256})))), [first,last]);
  f.save('brand-evidence.json', {claims:[{id:'sequence',capture:{path:first.path,frames:[first,{...last,sha256:'wrong'}]}}]});
  assert.throws(()=>f.h5ProducerSourceCaptures(), /H5_SOURCE_CAPTURE_HASH_MISMATCH/);
});

test('QA retains producer capture hashes and legacy selected-source behavior', t => {
  const f = fixture(t), image = f.save('frame.png', 'original');
  const evidence = f.save('brand-evidence.json', {claims:[{id:'a', capture:'frame.png'}]});
  const kit = f.save('brand-render-kit.json', {expressive:{mechanisms:[{evidenceRef:'a'}]}});
  const sources = [evidence, f.save('brand-mod.json', {}), f.save('brand-intent.json', {})];
  const manifest = (inputs) => {
    const receipt = f.save('receipt.json', {inputs, outputs:[kit]});
    return {stages:[{stage:'h5DirectionGeneration', status:'complete', receiptPath:receipt.path, receiptSha256:receipt.sha256}]};
  };
  const bound = manifest([...sources, image]);
  assert.equal(f.frozenH5QaSourceInputs(bound).at(-1).sha256, image.sha256);
  f.save('frame.png', 'changed');
  assert.throws(() => f.frozenH5QaSourceInputs(bound), /Receipt hash mismatch/);
  const legacy = manifest(sources);
  assert.notEqual(f.frozenH5QaSourceInputs(legacy).at(-1).sha256, image.sha256);
  fs.unlinkSync(path.join(f.migrationDir, 'frame.png'));
  assert.throws(() => f.frozenH5QaSourceInputs(legacy), /H5_QA_SOURCE_CAPTURE_INVALID/);
});
