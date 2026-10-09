import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exportPublicKnowledge, nonPublicReferences } from './public-knowledge-export.mjs';

test('redacts non-public URLs, preserves conclusions and labels missing evidence', () => {
  const record = { id: 'case', status: 'candidate', url: 'http://127.0.0.1:1234/private-route', notes: ['ref https://dumpling.echo.tech/tabs'], official: 'https://example.com/reference' };
  const source = JSON.stringify(record);
  const result = exportPublicKnowledge(source, '.json');
  const output = JSON.parse(result.text);
  assert.equal(result.omittedReferences, 2);
  assert.equal(output.id, record.id);
  assert.equal(output.status, 'candidate');
  assert.equal(output.official, record.official);
  assert.equal(output.publicExport.nonPublicReferencesOmitted, 2);
  assert.deepEqual(nonPublicReferences(result.text), []);
  assert.equal(record.url, 'http://127.0.0.1:1234/private-route');
  assert.equal(exportPublicKnowledge('{"id":"public"}', '.json').text, '{"id":"public"}');
});

test('detects loopback, private networks and internal domains without matching public URLs', () => {
  for (const url of ['http://localhost:123/', 'HTTP://localhost:3000/evidence', 'http://localhost.:3000/evidence', 'http://[::ffff:127.0.0.1]:3000/evidence', 'http://127.1/', 'http://10.2.3.4/', 'http://172.16.1.1/', 'http://192.168.1.1/', 'http://[::1]/', 'http://[fd00::1]/', 'https://x.echo.tech/a', 'http://machine.local/']) {
    assert.equal(nonPublicReferences(url).length, 1, url);
  }
  for (const url of ['https://example.com/', 'https://echo.tech.example.com/', 'http://172.32.1.1/']) assert.equal(nonPublicReferences(url).length, 0, url);
});

test('JSON escaped URLs are decoded before counting or redacting', () => {
  const input = JSON.stringify({ url: 'https://dumpling.echo.tech/bar/tabs' }).replaceAll('/', '\\/');
  assert.equal(nonPublicReferences(input, '.json').length, 1);
  const output = exportPublicKnowledge(input, '.json');
  assert.equal(output.omittedReferences, 1);
  assert.deepEqual(nonPublicReferences(output.text, '.json'), []);
  assert.equal(JSON.parse(output.text).url, '[non-public reference omitted]');
});

test('package redacts only its copy; validator rejects a reintroduced private record', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-public-export-test-'));
  const scripts = path.dirname(fileURLToPath(import.meta.url));
  const write = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); };
  const run = name => spawnSync(process.execPath, [path.join(scripts, name)], { cwd: root, encoding: 'utf8' });
  try {
    write('skills/brand/SKILL.md', '# fixture\n');
    write('skills/brand/agents/openai.yaml', 'interface: {}\n');
    write('skills/brand/workflow-contract.json', {});
    write('skills/brand/references/components.json', {});
    write('knowledge/v0.1/index.json', { cases: [{ id: 'case', path: 'knowledge/v0.1/cases/case.json' }] });
    write('knowledge/v0.1/cases/case.json', { id: 'case', url: 'http://localhost:1234/private' });
    write('public/knowledge/v0.1/index.json', { componentSource: 'skills/brand/references/components.json', brandRecipes: [] });
    const before = fs.readFileSync(path.join(root, 'knowledge/v0.1/cases/case.json'), 'utf8');
    const packaged = run('package-public-skill.mjs');
    assert.equal(packaged.status, 0, packaged.stderr);
    const release = path.join(root, 'output/brand-skill-release');
    const manifest = JSON.parse(fs.readFileSync(path.join(release, 'manifest.json')));
    assert.equal(manifest.publicExport.length, 1);
    assert.equal(fs.readFileSync(path.join(root, 'knowledge/v0.1/cases/case.json'), 'utf8'), before);
    const valid = run('validate-public-skill-release.mjs');
    assert.equal(valid.status, 0, valid.stderr);
    write('output/brand-skill-release/brand/knowledge-runtime/knowledge/v0.1/cases/leak.json', { url: 'https://private.echo.tech/path' });
    const rejected = run('validate-public-skill-release.mjs');
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /non-public-knowledge-reference/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
