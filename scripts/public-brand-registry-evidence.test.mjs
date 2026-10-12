import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { materializeLearningDelivery } from './brand-learning-delivery.mjs';
import { collectSystemReferenceCatalog } from '../skills/brand/scripts/finalize-h5-direction-stage.mjs';
import { resolvePublicStylePack } from '../skills/brand/scripts/resolve-public-style-pack.mjs';

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
test('learned recipe measurements, scope and DTCG survive publication and installation', async t => {
  const f = fixture(t);
  f.write('migrations/fixture/brand-evidence.json', { claims: [{ id: 'radius', computed: { property: 'border-radius', value: '16px' }, capture: { path: 'migrations/fixture/evidence/source.jpg' } }] });
  f.write('migrations/fixture/evidence/source.jpg', 'frozen jpg bytes');
  f.write('migrations/fixture/brand-intent.json', { styleRecipeDetails: [{ id: 'campaign', scope: 'Home only', statesApproved: ['default'], statesBlocked: ['hover'], evidenceRefs: ['radius'] }] });
  f.write('migrations/fixture/brand-profile.dtcg.json', { mapped: {} });
  assert.equal(f.run('build-public-brand-registry.mjs').status, 0);
  assert.equal(f.run('validate-public-brand-registry-assets.mjs').status, 0);
  const base = path.join(f.root, path.dirname(f.manifest));
  const intent = JSON.parse(fs.readFileSync(path.join(base, 'brand-intent.json')));
  const mod = JSON.parse(fs.readFileSync(path.join(base, 'brand-mod.json')));
  const profile = JSON.parse(fs.readFileSync(path.join(base, 'brand-profile.dtcg.json')));
  assert.deepEqual(profile.$extensions['echo.brand.scopedRecipes'], intent.styleRecipeDetails);
  assert.deepEqual(mod.styleRecipes, intent.styleRecipeDetails);
  const received = collectSystemReferenceCatalog(intent, mod).find(item => item.refs.includes('campaign'));
  assert.equal(received.scope, 'Home only');
  assert.deepEqual(received.statesBlocked, ['hover']);
  assert.equal(received.sourceMeasurements[0].value, '16px');
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.manifest)));
  assert.ok(manifest.artifacts['brand-profile.dtcg']);
  assert.ok(manifest.evidenceAssets.some(item => item.installPath.endsWith('source.jpg')));
  const installed = await resolvePublicStylePack({ sourceUrl: 'https://example.com/', root: f.root, install: true });
  assert.equal(installed.matched, true);
  const receivedIntent = JSON.parse(fs.readFileSync(path.join(f.root, 'migrations/fixture/brand-intent.json')));
  assert.deepEqual(receivedIntent, intent);
  assert.equal(fs.readFileSync(path.join(f.root, 'migrations/fixture/evidence/source.jpg'), 'utf8'), 'frozen jpg bytes');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, 'migrations/fixture/brand-profile.dtcg.json'))), profile);
});
test('materialization does not mutate sources, invent tokens or approve missing states', () => {
  const source = { 'brand-evidence.json': { claims: [] }, 'brand-intent.json': { styleRecipeDetails: [{ id: 'unmeasured', evidenceRefs: ['absent'], statesBlocked: ['focus'] }] }, 'brand-mod.json': { tokens: { mapped: {} } }, 'dangoui-adapter.json': {} };
  const before = structuredClone(source);
  const output = materializeLearningDelivery(source);
  assert.deepEqual(source, before);
  assert.deepEqual(output['brand-mod.json'].tokens.mapped, {});
  assert.deepEqual(output['brand-intent.json'].styleRecipeDetails[0].sourceMeasurements, []);
  assert.equal(output['dangoui-adapter.json'].scopedRecipes[0].runtimeStatus, 'not-verified');
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

test('scoped rebuild ignores broken other brands and preserves their registry entries', t => {
  const f = fixture(t);
  const file = path.join(f.root, 'public/brand-previews/registry.json');
  const source = JSON.parse(fs.readFileSync(file));
  source.brands.push({id:'broken',publicationStatus:'public-preview',migrationRoot:'missing'});
  f.write('public/brand-previews/registry.json', source);
  const other = {id:'broken',version:'old',manifest:'/unchanged.json'};
  f.write('public/brand-registry/v0.1/index.json', {brands:[other]});
  f.write('public/brand-registry/v0.1/by-source.json', {sources:{'https://other.example/':'broken'}});
  const result = spawnSync(process.execPath, [path.join(scripts, 'build-public-brand-registry.mjs'), '--brand', 'fixture'], {cwd:f.root,encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root,'public/brand-registry/v0.1/index.json'))).brands.find(b=>b.id==='broken'),other);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,'public/brand-registry/v0.1/by-source.json'))).sources['https://other.example/'],'broken');
});
test('evidence symlink cannot escape the migration package', t => {
  const f = fixture(t);
  f.write('outside.png', 'outside');
  fs.symlinkSync(path.join(f.root, 'outside.png'), path.join(f.root, 'migrations/fixture/evidence/link.png'));
  f.write('migrations/fixture/brand-intent.json', { source: 'evidence/link.png' });
  assert.notEqual(f.run('build-public-brand-registry.mjs').status, 0);
});
