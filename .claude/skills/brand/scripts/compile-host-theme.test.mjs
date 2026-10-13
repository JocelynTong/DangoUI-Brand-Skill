import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { compileHostTheme } from './compile-host-theme.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-theme-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const modFile = path.join(root, 'mod.json'), adapterFile = path.join(root, 'adapter.json'), dangouiRoot = path.join(root, 'dangoui'), outputDir = path.join(root, 'output');
  fs.mkdirSync(dangouiRoot);
  fs.writeFileSync(path.join(dangouiRoot, 'package.json'), JSON.stringify({ name: 'dangoui', version: '1.0.0', exports: { './theme.css': './theme.css', './style.css': './style.css' } }));
  fs.writeFileSync(path.join(dangouiRoot, 'theme.css'), ':root { --du-primary: #000000; }');
  fs.writeFileSync(path.join(dangouiRoot, 'style.css'), '.du-button {color:var(--du-primary)}');
  const mod = { tokens: { dtcg: { colors: { $type: 'color', base: { $value: '#ffffff' }, action: { $value: '{colors.base}', $extensions: { 'echo.brand.target': '--du-primary', 'echo.brand.channel': 'mapped' } } }, size: { $type: 'dimension', $value: { value: 4, unit: 'px' }, $extensions: { 'echo.brand.target': '--style-radius', 'echo.brand.channel': 'styleOnly' } } } } };
  const adapter = { catalog: { version: '1.0.0' }, tokenMappings: [{ sourceToken: 'colors.action', sourceValue: '#FFFFFF', targetToken: '--du-primary', targetExists: true, mappingType: 'mapped' }, { sourceToken: 'size', sourceValue: '4px', targetToken: '--style-radius', targetExists: false, mappingType: 'style-only' }] };
  function run() { fs.writeFileSync(modFile, JSON.stringify(mod)); fs.writeFileSync(adapterFile, JSON.stringify(adapter)); return compileHostTheme({ modFile, adapterFile, dangouiRoot, outputDir }); }
  return { mod, adapter, run, outputDir, dangouiRoot };
}

test('compiles alias/inherited type/dimension and copies actual CSS without claiming runtime', t => {
  const f = fixture(t), r = f.run();
  assert.equal(r.mappedCount, 1); assert.equal(r.styleOnlyCount, 1); assert.equal(r.runtimeVerified, false);
  assert.match(fs.readFileSync(r.themeFile, 'utf8'), /--du-primary: #ffffff/);
  assert.match(fs.readFileSync(r.themeFile, 'utf8'), /--style-radius: 4px/);
  assert.match(fs.readFileSync(r.runtimeStyleFile, 'utf8'), /\.du-button/);
  const proof = JSON.parse(fs.readFileSync(r.proofFile));
  assert.equal(proof.status, 'compiled-not-runtime-verified');
  assert.equal(proof.sources.modSha256.length, 64);
  assert.ok(!fs.readFileSync(r.themeFile, 'utf8').includes(f.outputDir));
});
test('legacy mirror adapter source resolves by unique canonical target', t => {
  const f = fixture(t); f.adapter.tokenMappings[0].sourceToken = 'old.source'; assert.equal(f.run().mappedCount, 1);
});
test('single entry orders actual runtime before mapped overrides and binds all CSS bytes', t => {
  const f = fixture(t), r = f.run();
  const imports = [...fs.readFileSync(r.entryFile, 'utf8').matchAll(/@import "([^"]+)";/g)]
    .map(m => path.resolve(path.dirname(r.entryFile), m[1]));
  assert.deepEqual(imports, [r.runtimeStyleFile, r.themeFile]);
  const css = imports.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(css.indexOf('--du-primary: #000000') < css.indexOf('--du-primary: #ffffff'));
  assert.deepEqual(r.integration.mappedVariables, ['--du-primary', '--style-radius']);
  assert.equal(r.integration.entryFile, r.entryFile);
  const proof = JSON.parse(fs.readFileSync(r.proofFile));
  for (const output of Object.values(proof.outputs)) {
    assert.equal(output.sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(f.outputDir, output.file))).digest('hex'));
  }
  // A token edit updates the existing imported theme, without hand-editing the entry.
  const entry = fs.readFileSync(r.entryFile, 'utf8');
  f.mod.tokens.dtcg.colors.base.$value = '#123456';
  f.adapter.tokenMappings[0].sourceValue = '#123456';
  const changed = f.run();
  assert.equal(fs.readFileSync(changed.entryFile, 'utf8'), entry);
  assert.match(fs.readFileSync(imports[1], 'utf8'), /--du-primary: #123456/);
});
for (const [name, mutate, pattern] of [
  ['unknown target', f => { f.adapter.tokenMappings[0].targetToken = '--du-made-up'; delete f.mod.tokens.dtcg.colors.action.$extensions; }, /unknown\/unproven/],
  ['value drift', f => { f.adapter.tokenMappings[0].sourceValue = '#123456'; }, /value drift/],
  ['duplicate adapter', f => f.adapter.tokenMappings.push(f.adapter.tokenMappings[0]), /duplicate adapter/],
  ['missing mapping', f => f.adapter.tokenMappings.pop(), /missing adapter/],
  ['alias cycle', f => { f.mod.tokens.dtcg.colors.base.$value = '{colors.action}'; }, /alias cycle/],
  ['missing alias', f => { f.mod.tokens.dtcg.colors.base.$value = '{not.exists}'; }, /missing alias/],
  ['target conflict', f => { f.mod.tokens.dtcg.colors.action.$extensions['echo.brand.target'] = '--du-other'; }, /source target conflict/],
  ['style only impersonation', f => { f.adapter.tokenMappings[1].targetExists = true; }, /style-only boundary/],
  ['unsafe CSS', f => { f.mod.tokens.dtcg.colors.base.$value = '#fff; color:red'; }, /unsafe/],
  ['version mismatch', f => { f.adapter.catalog.version = '2.0.0'; }, /version mismatch/],
]) test(`rejects ${name} before output`, t => { const f = fixture(t); mutate(f); assert.throws(f.run, pattern); assert.equal(fs.existsSync(f.outputDir), false); });

test('supports srgb DTCG color object', t => { const f = fixture(t); const color = { colorSpace: 'srgb', components: [1, 0, 0], alpha: 0.5 }; f.mod.tokens.dtcg.colors.base.$value = color; f.adapter.tokenMappings[0].sourceValue = color; assert.match(fs.readFileSync(f.run().themeFile, 'utf8'), /color\(srgb 1 0 0 \/ 0.5\)/); });
test('descriptive composition is disclosed, never emitted as CSS', t => { const f = fixture(t); f.mod.tokens.dtcg.layout = { $type: 'string', $value: 'left navigation + main', $extensions: { 'echo.brand.target': '--style-layout' } }; const r = f.run(); assert.equal(JSON.parse(fs.readFileSync(r.proofFile)).unresolved.length, 1); assert.doesNotMatch(fs.readFileSync(r.themeFile, 'utf8'), /--style-layout/); });
test('retains original HTTPS CSS resource and discloses network dependency', t => { const f = fixture(t); fs.appendFileSync(path.join(f.dangouiRoot, 'style.css'), '@font-face {src:url("https://example.com/font.woff2")}'); const r = f.run(); assert.deepEqual(JSON.parse(fs.readFileSync(r.proofFile)).externalResources, ['https://example.com/font.woff2']); });
test('rejects broken relative package resources', t => { const f = fixture(t); fs.appendFileSync(path.join(f.dangouiRoot, 'style.css'), '@font-face {src:url("./font.woff2")}'); assert.throws(f.run, /unresolved relative/); });
test('preserves data URL with parentheses verbatim', t => { const f = fixture(t); const data = '.icon{background:url("data:image/svg+xml,<svg transform=\'rotate(30)\'></svg>")}'; fs.appendFileSync(path.join(f.dangouiRoot, 'style.css'), data); assert.ok(fs.readFileSync(f.run().runtimeStyleFile, 'utf8').includes(data)); });
