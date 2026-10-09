#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-manifest-set-'));
const script = new URL('./validate-host-structural-diff.mjs', import.meta.url).pathname;
const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const write = (name, value) => {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};
const original = '<template><view><button @tap="save">Save</button></view></template><script setup>function save(){}</script>';
const a = write('a/index.vue', original), b = write('b/index.vue', original);
const snapshots = new Map();
for (const file of [a, b]) {
  const snapshot = `${file}.baseline.json`;
  const result = run(['snapshot', '--file', file, '--out', snapshot]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  snapshots.set(file, snapshot);
}
const originalHashes = [...snapshots.values()].map(file => fs.readFileSync(file, 'utf8'));
const empty = { schema: 'brand-host-structural-manifest/v1', decorativeNodes: [] };
const decorated = { ...empty, decorativeNodes: [{ currentNodeId: 'n1', interactive: false, reason: 'Approved ornament', evidenceRef: 'approved-master#ornament' }] };
const set = files => ({ schema: 'brand-host-structural-manifest-set/v1', files });
const valid = set([{ sourceFile: a, manifest: decorated }, { sourceFile: b, manifest: empty }]);
const bundle = write('bundle.json', { schema: 'brand-host-preedit-baseline-bundle/v1', entries: [a, b].map(sourceFile => ({ sourceFile })) });
write('a/index.vue', original.replace('<view>', '<view><text class="ornament">*</text>'));
write('b/index.vue', original.replace('<view>', '<view class="theme">'));
let checks = 0;
function check(name, input, file = a, code = null, options = {}) {
  const manifest = write(`manifest-${checks++}.json`, input);
  const args = ['validate', '--baseline', options.baseline || snapshots.get(file), '--current', file, '--manifest', manifest];
  if (options.bundle !== false) args.push('--bundle', bundle);
  const result = run(args);
  if (code) {
    assert.notEqual(result.status, 0, `${name}: unexpectedly passed`);
    assert.match(result.stdout + result.stderr, new RegExp(code), name);
  } else assert.equal(result.status, 0, `${name}: ${result.stdout}${result.stderr}`);
}

check('same node id is decorative only in A', valid);
check('B keeps its n1 business control', valid, b);
check('legacy v1 remains accepted', decorated);
check('legacy empty v1 remains accepted', empty, b);
check('missing current has no fallback', set([{ sourceFile: b, manifest: empty }]), a, 'MANIFEST_SOURCE_MISSING', { bundle: false });
check('complete bundle required even for a covered current source', set([valid.files[0]]), a, 'MANIFEST_SOURCE_MISSING');
check('unapproved extra source rejected', set([...valid.files, { sourceFile: path.join(dir, 'c/index.vue'), manifest: empty }]), a, 'MANIFEST_SOURCE_UNAPPROVED');
check('duplicate source rejected', set([...valid.files, valid.files[0]]), a, 'MANIFEST_SOURCE_DUPLICATED');
check('same basename never matches', set([{ sourceFile: b, manifest: decorated }]), a, 'MANIFEST_SOURCE_MISSING', { bundle: false });
check('relative source rejected', set([{ sourceFile: 'a/index.vue', manifest: decorated }]), a, 'MANIFEST_SOURCE_PATH_INVALID');
check('non-normalized alias rejected', set([{ sourceFile: `${dir}/a/../a/index.vue`, manifest: decorated }]), a, 'MANIFEST_SOURCE_PATH_INVALID');
check('global grants cannot leak into files', { ...valid, decorativeNodes: decorated.decorativeNodes }, a, 'MANIFEST_SET_FIELD_INVALID');
check('nested set is not an inline v1', set([{ sourceFile: a, manifest: valid }]), a, 'MANIFEST_SOURCE_ENTRY_INVALID');
check('external unbound manifest is not supported', set([{ sourceFile: a, manifestPath: 'other.json' }]), a, 'MANIFEST_SOURCE_ENTRY_INVALID');
check('empty set rejected', set([]), a, 'MANIFEST_SOURCE_ENTRIES_MISSING');
check('cross-source baseline rejected', valid, a, 'MANIFEST_BASELINE_SOURCE_MISMATCH', { baseline: snapshots.get(b) });
write('b/index.vue', original.replace('@tap="save"', '@tap="remove"'));
check('B handler mutation remains blocked despite A decoration grant', valid, b, 'EVENT_HANDLER_CHANGED');
write('b/index.vue', original.replace('function save(){}', 'function save(){fetch("/changed")}'));
check('B business code mutation still blocked', valid, b, 'BUSINESS_SCRIPT_CHANGED');
assert.deepEqual([...snapshots.values()].map(file => fs.readFileSync(file, 'utf8')), originalHashes, 'validation never refreshes baselines');
console.log(`host structural manifest sets: PASS (${checks} checks)`);
