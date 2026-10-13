import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectImageReferences, collectPngReferences } from '../skills/brand/scripts/evidence-file-references.mjs';

test('image references cover frozen formats without changing legacy PNG semantics', () => {
  const value = { identity: ['label.png'], nested: { identity: { path: 'real.jpeg#frame' } }, captures: ['a.PNG#x', 'b.jpg', 'ignored.webp'] };
  const images = new Set();
  collectImageReferences(value, images);
  assert.deepEqual([...images].sort(), ['a.PNG', 'b.jpg', 'real.jpeg']);
  const pngs = new Set();
  collectPngReferences(value, pngs);
  assert.deepEqual([...pngs].sort(), ['a.PNG', 'label.png']);
});

for (const failure of ['artifact tamper', 'missing artifact hash', 'missing runtime array', 'invalid runtime array']) {
  test(`validator rejects ${failure}`, t => {
    const f = fixture(t);
    assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.manifest)));
    if (failure === 'artifact tamper') f.write(`${path.dirname(f.manifest)}/brand-mod.json`, { changed: true });
    if (failure === 'missing artifact hash') delete manifest.artifactHashes['brand-mod'];
    if (failure === 'missing runtime array') delete manifest.runtimeAssets;
    if (failure === 'invalid runtime array') manifest.runtimeAssets = {};
    f.write(f.manifest, manifest);
    const result = f.run('validate-public-brand-registry-assets.mjs');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /sha256 mismatch|artifact hash missing|runtimeAssets must be an array/);
  });
}

for (const failure of ['LFS evidence', 'duplicate source', 'invalid JSON', 'internal reference']) {
  test(`${failure} leaves all existing output bytes untouched`, t => {
    const f = fixture(t);
    assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
    const output = path.join(f.root, 'public/brand-registry');
    const snapshot = () => Object.fromEntries(fs.readdirSync(output, { recursive: true }).filter(p => fs.statSync(path.join(output, p)).isFile()).map(p => [p, fs.readFileSync(path.join(output, p)).toString('base64')]));
    const before = snapshot();
    if (failure === 'LFS evidence') f.write('migrations/fixture/evidence/source.png', 'version https://git-lfs.github.com/spec/v1\noid sha256:123\nsize 123\n');
    if (failure === 'invalid JSON') f.write('migrations/fixture/brand-mod.json', '{');
    if (failure === 'internal reference') f.write('migrations/fixture/brand-mod.json', { url: 'http://localhost/private' });
    if (failure === 'duplicate source') {
      const source = JSON.parse(fs.readFileSync(path.join(f.root, 'public/brand-previews/registry.json')));
      source.brands.push({ ...source.brands[0], id: 'second' });
      f.write('public/brand-previews/registry.json', source);
    }
    assert.notEqual(f.run('build-public-brand-registry.mjs').status, 0);
    assert.deepEqual(snapshot(), before);
  });
}

const scripts = path.dirname(fileURLToPath(import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-evidence-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('public/brand-previews/registry.json', { brands: [{
    id: 'fixture', version: '1', publicationStatus: 'public-preview',
    migrationRoot: 'migrations/fixture', sourceUrl: 'https://example.com/',
    artifactFiles: ['brand-mod.json', 'brand-evidence.json', 'brand-intent.json'],
  }] });
  write('migrations/fixture/brand-mod.json', {});
  write('migrations/fixture/brand-evidence.json', { capture: 'migrations/fixture/evidence/source.png#frame' });
  write('migrations/fixture/brand-intent.json', {});
  write('migrations/fixture/evidence/source.png', 'fixture image bytes');
  const run = name => spawnSync(process.execPath, [path.join(scripts, name)], { cwd: root, encoding: 'utf8' });
  return { root, write, run, manifest: 'public/brand-registry/v0.1/brands/fixture/1/manifest.json' };
}
test('complete evidence is packaged with hash and passes consumer validation', t => {
  const f = fixture(t);
  assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
  assert.equal(f.run('validate-public-brand-registry-assets.mjs').status, 0);
});
test('remote source URLs and runtime metadata are not local evidence dependencies', t => {
  const f = fixture(t);
  f.write('migrations/fixture/brand-mod.json', { assets: [{ url: 'https://example.com/logo.png' }] });
  f.write('migrations/fixture/brand-intent.json', { sourceUrl: 'https://example.com/reference.png' });
  assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
  assert.equal(f.run('validate-public-brand-registry-assets.mjs').status, 0);
});
test('missing input fails before replacing any existing output', t => {
  const f = fixture(t);
  f.write(f.manifest, 'previous published bytes');
  f.write('migrations/fixture/brand-intent.json', { source: 'output/history/missing.png' });
  const result = f.run('build-public-brand-registry.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PUBLIC_REGISTRY_EVIDENCE_INCOMPLETE/);
  assert.equal(fs.readFileSync(path.join(f.root, f.manifest), 'utf8'), 'previous published bytes');
  assert.equal(fs.existsSync(path.join(f.root, 'public/brand-registry/v0.1/brands/fixture/1/brand-mod.json')), false);
});
test('validator detects omitted dependency even when every manifest file exists', t => {
  const f = fixture(t);
  assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.manifest), 'utf8'));
  manifest.evidenceAssets = [];
  f.write(f.manifest, manifest);
  const result = f.run('validate-public-brand-registry-assets.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /referenced evidence not packaged/);
});
test('validator detects changed evidence bytes', t => {
  const f = fixture(t);
  assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
  f.write('public/brand-registry/v0.1/brands/fixture/1/evidence/evidence/source.png', 'changed');
  assert.match(f.run('validate-public-brand-registry-assets.mjs').stderr, /sha256 mismatch/);
});
test('empty evidence cannot be published', t => {
  const f = fixture(t);
  f.write('migrations/fixture/evidence/source.png', '');
  assert.notEqual(f.run('build-public-brand-registry.mjs').status, 0);
});

test('evidence symlink cannot escape the migration package', t => {
  const f = fixture(t);
  f.write('outside.png', 'outside');
  fs.symlinkSync(path.join(f.root, 'outside.png'), path.join(f.root, 'migrations/fixture/evidence/link.png'));
  f.write('migrations/fixture/brand-intent.json', { source: 'evidence/link.png' });
  assert.notEqual(f.run('build-public-brand-registry.mjs').status, 0);
});
