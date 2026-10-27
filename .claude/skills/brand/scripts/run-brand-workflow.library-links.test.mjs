import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const entry = process.env.BRAND_WORKFLOW_TEST_ENTRY || fileURLToPath(new URL('./run-brand-workflow.mjs', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-entry-test-'));
const host = path.join(temp, 'host');
fs.mkdirSync(host);
fs.writeFileSync(path.join(host, 'sentinel.txt'), 'unchanged');
const base = 'https://jocelyntong.github.io/DangoUI-Brand-Skill/';
let count = 0;
function json(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); }
function run(source, { mode = 'design-host', extra = [], present = false } = {}) {
  const root = path.join(temp, String(++count), 'build');
  const registry = path.join(root, 'public/brand-registry/v0.1');
  json(path.join(registry, 'index.json'), { brands: [] });
  json(path.join(registry, 'by-source.json'), { sources: {} });
  json(path.join(path.dirname(root), 'run.json'), { schema: 'brand-artifact-run/v1', status: 'active', id: String(count), host });
  if (present) json(path.join(root, 'migrations/dango/brand-mod.json'), { manifest: { brand: 'dango' } });
  // With a local package, omit the empty registry so the resolver uses that package.
  if (present) fs.rmSync(registry, { recursive: true });
  const result = spawnSync(process.execPath, [entry, 'run', '--request-kind', mode === 'learn-brand' ? 'brand-learning' : 'host-concepts', '--mode', mode, '--artifact-root', root, '--host-target', host, '--source-url', source, ...extra], { encoding: 'utf8', timeout: 10000, cwd: temp });
  assert.equal(result.error, undefined, String(result.error));
  const output = JSON.parse(result.stdout || assert.fail(result.stderr));
  return { result, output, root };
}
try {
  for (const route of ['brand/dango/pages/home', 'variants/dango/dango-introduction']) {
    const url = `${base}#/${route}`;
    const missing = run(url);
    assert.notEqual(missing.result.status, 0);
    assert.equal(missing.output.blockingCode, 'SELECTED_STYLE_PACK_NOT_FOUND');
    assert.equal(fs.existsSync(path.join(missing.root, 'source-prerequisite.json')), false);
    const found = run(url, { mode: 'learn-brand', present: true });
    assert.equal(found.result.status, 0, found.result.stderr);
    assert.equal(found.output.workflow, 'reuse-existing-style-pack');
    assert.equal(found.output.brand, 'dango');
    const selected = run(url, { present: true });
    assert.equal(fs.existsSync(path.join(selected.root, 'source-prerequisite.json')), false);
    assert.notEqual(selected.output.blockingCode, 'LOCAL_STYLE_PACK_MOD_MISSING');
    assert.notEqual(selected.output.blockingCode, 'STYLE_PACK_REUSE_APPROVAL_REQUIRED');
    // The intentionally incomplete fixture reaches the existing safety gate,
    // rather than starting learning or losing the resolved package path.
    assert.equal(selected.output.blockingCode, 'DESIGN_HOST_PREFLIGHT_BLOCKED', JSON.stringify(selected.output));
    assert.equal(selected.output.brand, 'dango');
    const conflict = run(url, { extra: ['--brand', 'czn'] });
    assert.equal(conflict.output.blockingCode, 'STYLE_PACK_SELECTION_CONFLICT');
    for (const flag of ['--force-relearn', '--update-existing', '--source-prerequisite']) {
      assert.equal(run(url, { mode: 'learn-brand', extra: [flag] }).output.blockingCode, 'LIBRARY_LINK_NOT_LEARNING_SOURCE');
    }
  }
  for (const url of ['https://example.com/', 'https://example.com/#/variants/dango', 'https://jocelyntong.github.io/other/#/brand/dango']) {
    const ordinary = run(url);
    assert.equal(ordinary.output.step, 'brand-source-learning');
    assert.equal(fs.existsSync(path.join(ordinary.root, 'source-prerequisite.json')), true);
  }
  assert.deepEqual(fs.readdirSync(host), ['sentinel.txt']);
  assert.equal(fs.readFileSync(path.join(host, 'sentinel.txt'), 'utf8'), 'unchanged');
  console.log('LIBRARY_ENTRY_ROUTING_TEST_PASS');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
