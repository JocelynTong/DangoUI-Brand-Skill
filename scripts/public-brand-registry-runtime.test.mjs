import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-runtime-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  const assetBytes = Buffer.from([0, 255, 13, 10, 128, 3]);
  const asset = { id: 'official-logo', localPath: 'public/assets/fixture/logo.webp', sourceSha256: digest(assetBytes), role: 'identity', targetScope: 'header', provenance: 'evidence-source' };
  const mod = { assets: [asset, { id: 'remote-only', url: 'https://example.com/remote.png' }] };
  write('public/brand-previews/registry.json', { brands: [{ id: 'fixture', version: '1', publicationStatus: 'public-preview', migrationRoot: 'migrations/source', sourceUrl: 'https://example.com/', artifactFiles: ['brand-mod.json', 'brand-evidence.json', 'brand-intent.json'] }] });
  write('migrations/source/brand-evidence.json', {});
  write('migrations/source/brand-intent.json', {});
  write('migrations/source/brand-mod.json', mod);
  write(asset.localPath, assetBytes);
  write('public/assets/fixture/unused.webp', 'do not ship');
  const run = (name = 'build-public-brand-registry.mjs') => spawnSync(process.execPath, [path.join(scripts, name)], { cwd: root, encoding: 'utf8' });
  const packageRoot = 'public/brand-registry/v0.1/brands/fixture/1';
  return { root, write, run, packageRoot, asset, assetBytes, mod };
}

test('packages only declared runtime bytes with stable identity semantics and verified hashes', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.packageRoot, 'manifest.json')));
  assert.equal(manifest.runtimeAssets.length, 1);
  const runtime = manifest.runtimeAssets[0];
  assert.equal(runtime.id, f.asset.id);
  assert.equal(runtime.installPath, f.asset.localPath);
  assert.equal(runtime.sha256, f.asset.sourceSha256);
  const bytes = fs.readFileSync(path.join(f.root, 'public', runtime.path));
  assert.deepEqual(bytes, f.assetBytes);
  assert.equal(digest(bytes), runtime.sha256);
  const packagedMod = JSON.parse(fs.readFileSync(path.join(f.root, f.packageRoot, 'brand-mod.json')));
  assert.deepEqual(packagedMod, f.mod);
  assert.deepEqual(fs.readdirSync(path.join(f.root, f.packageRoot, 'runtime/public/assets/fixture')), ['logo.webp']);
  const validation = f.run('validate-public-brand-registry-assets.mjs');
  assert.equal(validation.status, 0, validation.stderr);
});

for (const failure of ['missing', 'wrong hash', 'missing hash', 'empty', 'traversal', 'symlink escape']) {
  test(`${failure} runtime asset fails before replacing existing outputs`, t => {
    const f = fixture(t);
    f.write(`${f.packageRoot}/manifest.json`, 'previous manifest');
    f.write(`${f.packageRoot}/brand-mod.json`, 'previous MOD');
    f.write(`${f.packageRoot}/runtime/public/assets/fixture/logo.webp`, 'previous runtime');
    if (failure === 'missing') fs.unlinkSync(path.join(f.root, f.asset.localPath));
    if (failure === 'wrong hash') f.asset.sourceSha256 = '0'.repeat(64);
    if (failure === 'missing hash') delete f.asset.sourceSha256;
    if (failure === 'empty') f.write(f.asset.localPath, '');
    if (failure === 'traversal') f.asset.localPath = '../escape.webp';
    if (failure === 'symlink escape') {
      fs.unlinkSync(path.join(f.root, f.asset.localPath));
      fs.symlinkSync(fileURLToPath(import.meta.url), path.join(f.root, f.asset.localPath));
    }
    f.write('migrations/source/brand-mod.json', f.mod);
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PUBLIC_REGISTRY_RUNTIME_ASSETS_INCOMPLETE/);
    assert.equal(fs.readFileSync(path.join(f.root, f.packageRoot, 'manifest.json'), 'utf8'), 'previous manifest');
    assert.equal(fs.readFileSync(path.join(f.root, f.packageRoot, 'brand-mod.json'), 'utf8'), 'previous MOD');
    assert.equal(fs.readFileSync(path.join(f.root, f.packageRoot, 'runtime/public/assets/fixture/logo.webp'), 'utf8'), 'previous runtime');
  });
}

test('migration-based runtime installPath follows published MOD rewriting', t => {
  const f = fixture(t);
  f.asset.localPath = 'migrations/source/assets/logo.webp';
  f.write(f.asset.localPath, f.assetBytes);
  f.write('migrations/source/brand-mod.json', f.mod);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.packageRoot, 'manifest.json')));
  assert.equal(manifest.runtimeAssets[0].installPath, 'migrations/fixture/assets/logo.webp');
  const validation = f.run('validate-public-brand-registry-assets.mjs');
  assert.equal(validation.status, 0, validation.stderr);
});

test('later brand failure leaves earlier published brand untouched', t => {
  const f = fixture(t);
  const registryFile = path.join(f.root, 'public/brand-previews/registry.json');
  const registry = JSON.parse(fs.readFileSync(registryFile));
  registry.brands.push({ ...registry.brands[0], id: 'broken', migrationRoot: 'migrations/broken', sourceUrl: 'https://broken.example.com/' });
  f.write('public/brand-previews/registry.json', registry);
  f.write('migrations/broken/brand-mod.json', { assets: [{ localPath: 'public/assets/missing.webp', sourceSha256: '0'.repeat(64) }] });
  f.write('migrations/broken/brand-evidence.json', {});
  f.write('migrations/broken/brand-intent.json', {});
  f.write(`${f.packageRoot}/manifest.json`, 'previous first brand');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PUBLIC_REGISTRY_RUNTIME_ASSETS_INCOMPLETE/);
  assert.equal(fs.readFileSync(path.join(f.root, f.packageRoot, 'manifest.json'), 'utf8'), 'previous first brand');
  assert.equal(fs.existsSync(path.join(f.root, f.packageRoot, 'brand-mod.json')), false);
});
