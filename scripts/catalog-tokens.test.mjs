import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const outputs = ['catalog.tokens.json', 'catalog-tokens.css'];
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-token-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const folder of ['scripts', 'src/uikit', 'migrations/onepiece-cardgame']) fs.mkdirSync(path.join(dir, folder), { recursive: true });
  for (const file of ['scripts/build-catalog-tokens.mjs', 'migrations/onepiece-cardgame/brand-mod.json', ...outputs.map(f => 'src/uikit/' + f)]) fs.copyFileSync(path.join(root, file), path.join(dir, file));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'));
  const run = (...args) => spawnSync(process.execPath, [path.join(dir, 'scripts/build-catalog-tokens.mjs'), ...args], { encoding: 'utf8', timeout: 30000, cwd: dir });
  const read = file => fs.readFileSync(path.join(dir, 'src/uikit', file), 'utf8');
  const source = path.join(dir, 'migrations/onepiece-cardgame/brand-mod.json');
  const change = (color, radius) => {
    const data = JSON.parse(fs.readFileSync(source));
    data.tokens.dtcg.mapped['du-bg-1'].$value = color;
    data.tokens.dtcg.styleOnly['style-card-radius'].$value = radius;
    fs.writeFileSync(source, JSON.stringify(data));
  };
  return { dir, run, read, change, source };
}
const passes = result => assert.equal(result.status, 0, result.stdout + result.stderr);

test('current generated outputs match and check mode does not write', t => {
  const f = fixture(t);
  const before = outputs.map(file => [f.read(file), fs.statSync(path.join(f.dir, 'src/uikit', file)).mtimeMs]);
  passes(f.run('--check'));
  assert.deepEqual(outputs.map(file => [f.read(file), fs.statSync(path.join(f.dir, 'src/uikit', file)).mtimeMs]), before);
});

test('generation converts both source tokens, preserves metadata and stays scoped', t => {
  const f = fixture(t);
  f.change('#123456', '7.5px');
  const source = fs.readFileSync(f.source, 'utf8');
  passes(f.run());
  const data = JSON.parse(f.read(outputs[0]));
  assert.deepEqual(Object.keys(data.catalog).sort(), ['mediaRadius', 'surface']);
  assert.deepEqual(data.catalog.surface.$value, { colorSpace: 'srgb', components: [18 / 255, 52 / 255, 86 / 255], alpha: 1 });
  assert.deepEqual(data.catalog.mediaRadius.$value, { value: 7.5, unit: 'px' });
  assert.deepEqual(data.catalog.surface.$extensions, JSON.parse(source).tokens.dtcg.mapped['du-bg-1'].$extensions);
  assert.equal(data.$extensions['com.dangoui.delivery'].brandCertification, 'not-certified');
  assert.match(f.read(outputs[1]), /^\.catalog-grid\[data-appearance="onepiece"\] \{/);
  assert.match(f.read(outputs[1]), /--kit-catalog-surface: #123456;/);
  assert.match(f.read(outputs[1]), /--kit-catalog-media-radius: 7.5px;/);
  assert.equal(fs.readFileSync(f.source, 'utf8'), source);
  const once = outputs.map(f.read);
  passes(f.run());
  assert.deepEqual(outputs.map(f.read), once);
  passes(f.run('--check'));
});

for (const file of outputs) test(`check rejects stale ${file} without repairing it`, t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.dir, 'src/uikit', file), '\n');
  const before = outputs.map(f.read);
  const result = f.run('--check');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Stale/);
  assert.deepEqual(outputs.map(f.read), before);
});

for (const [color, radius] of [['red', '0px'], ['#ffffff', '1rem']]) test(`unsupported source values fail without overwriting outputs: ${color}, ${radius}`, t => {
  const f = fixture(t);
  const before = outputs.map(f.read);
  f.change(color, radius);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported legacy value/);
  assert.deepEqual(outputs.map(f.read), before);
});
