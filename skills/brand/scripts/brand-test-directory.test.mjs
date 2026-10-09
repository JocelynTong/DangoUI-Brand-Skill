import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createBrandTestDirectory } from './brand-test-directory.mjs';

test('cleanup owns exactly its created directory, not its parent or sibling', () => {
  const first = createBrandTestDirectory('cleanup');
  const sibling = createBrandTestDirectory('sibling');
  try {
    fs.writeFileSync(path.join(first.directory, 'proof.json'), '{}');
    assert.throws(() => { first.directory = path.dirname(first.directory); }, TypeError);
    assert.equal(first.cleanup(), true);
    assert.equal(fs.existsSync(sibling.directory), true);
    assert.equal(fs.existsSync(path.dirname(sibling.directory)), true);
    assert.equal(first.cleanup(), false);
  } finally { first.cleanup(); sibling.cleanup(); }
});

test('cleanup rejects a symlink replacing its created directory', () => {
  const owned = createBrandTestDirectory('identity');
  const sibling = createBrandTestDirectory('identity-sibling');
  const renamed = `${owned.directory}-saved`;
  try {
    fs.renameSync(owned.directory, renamed);
    fs.symlinkSync(sibling.directory, owned.directory);
    assert.throws(() => owned.cleanup(), /TEST_DIRECTORY_IDENTITY_CHANGED/);
    assert.ok(fs.existsSync(sibling.directory));
  } finally {
    fs.unlinkSync(owned.directory);
    fs.renameSync(renamed, owned.directory);
    owned.cleanup(); sibling.cleanup();
  }
});
