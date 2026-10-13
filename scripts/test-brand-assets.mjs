import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const roots = ['public/assets/brand-assets/pokemon-tcg-official', 'public/assets/brand-assets/onepiece-cardgame'];
const files = execFileSync('git', ['ls-files', '-z', '--', ...roots], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];
for (const path of files) {
  const url = new URL(`../${path}`, import.meta.url);
  if (!existsSync(url)) { failures.push(`Missing: ${path}`); continue; }
  const size = statSync(url).size;
  if (!size) failures.push(`Empty: ${path}`);
  if (size < 1024 && readFileSync(url, 'utf8').startsWith('version https://git-lfs.github.com/spec/v1')) failures.push(`Unhydrated LFS pointer: ${path}`);
}
assert.ok(files.length > 0, 'No tracked brand assets found');
assert.deepEqual(failures, [], 'Restore missing assets or run git lfs checkout/pull for the affected paths.');
console.log(`Brand assets: ${files.length} tracked files present, nonempty and hydrated (Pokémon / ONE PIECE).`);
