import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { prepareModuleTask } from './prepare-module-task.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'module-prep-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const brandRoot = path.join(dir, 'brand'), hostRoot = path.join(dir, 'host');
  const write = (base, file, value) => { fs.mkdirSync(path.dirname(path.join(base, file)), { recursive: true }); fs.writeFileSync(path.join(base, file), typeof value === 'string' ? value : JSON.stringify(value)); };
  const shot = { path: 'migrations/example/after.jpg', sha256: hash('after') };
  const mod = { manifest: { id: 'example', scope: { completeBrandCertification: false } }, limitations: ['desktop only'], componentVariants: [{ id: 'toggle', component: 'local-style-recipe', status: 'approved', recipe: 'Rounded selector', evidenceRefs: ['state'], for: ['view selector'], notFor: ['global actions'] }, { id: 'unused', component: 'local-style-recipe', status: 'approved', recipe: 'other', evidenceRefs: ['missing'] }], tokens: { styleOnly: { color: { value: '#fff', recipeId: 'toggle', evidenceRefs: ['state'] } } } };
  const evidence = { brand: 'example', claims: [{ id: 'state', status: 'observed', capture: shot, afterCapture: shot, beforeCapture: { path: 'migrations/example/before.jpg', sha256: hash('before') } }, { id: 'missing', status: 'observed', capture: { path: 'missing.jpg', sha256: 'a'.repeat(64) } }] };
  write(brandRoot, 'brand-mod.json', mod); write(brandRoot, 'brand-evidence.json', evidence); write(brandRoot, 'before.jpg', 'before'); write(brandRoot, 'after.jpg', 'after');
  write(hostRoot, 'package.json', { dependencies: { vue: '^3.5.0', '@tarojs/taro': '4.2.0', '@tarojs/components': '4.2.0', '@tarojs/plugin-framework-vue3': '4.2.0' } });
  write(hostRoot, 'config/index.js', "export default {sourceRoot:'src',framework:'vue3'}");
  write(hostRoot, 'src/page.vue', '<template><view>business</view></template>'); write(hostRoot, 'src/.brand-components/old/Item.vue', 'accepted');
  write(hostRoot, '.env', 'must not read or copy'); write(hostRoot, 'qdmp.json', 'must not read or copy');
  const opts = { brandRoot, hostRoot, target: 'src/page.vue', task: 'Adapt only existing toggle', moduleId: 'toggle', recipes: 'toggle', authorization: 'Explicit isolated test', artifactRoot: path.join(dir, 'output') };
  return { dir, brandRoot, hostRoot, opts, mod, evidence, write, run: () => prepareModuleTask(opts) };
}
test('metadata discovery needs no recipe knowledge or writes', t => {
  const f = fixture(t); delete f.opts.recipes;
  const r = f.run(); assert.equal(r.status, 'awaiting-recipe-selection'); assert.equal(r.candidates.length, 2); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
  assert.ok(r.candidates.every(x => x.dependencyStatus === 'not-checked-until-selected'));
});
test('dispatch carries protected host guides and declared build context without executing it', t => {
  const f = fixture(t);
  f.write(f.hostRoot, 'README.md', 'Existing host build guide');
  const pkg = JSON.parse(fs.readFileSync(path.join(f.hostRoot, 'package.json')));
  pkg.scripts = { build: 'taro build --type weapp', upload: 'must not run' };
  f.write(f.hostRoot, 'package.json', pkg);
  const result = f.run(), execution = result.dispatch.execution;
  assert.deepEqual(execution.build.declaredScripts, { build: 'taro build --type weapp' });
  assert.equal(execution.build.cwd, path.join(f.opts.artifactRoot, 'host'));
  assert.equal(execution.hostGuides.length, 1);
  assert.equal(execution.hostGuides[0].sha256, hash('Existing host build guide'));
  assert.equal(fs.readFileSync(execution.hostGuides[0].absolute, 'utf8'), 'Existing host build guide');
  assert.equal(execution.dependencies.copied, false);
  assert.equal(execution.dependencies.existingHostDirectory, null);
  assert.match(execution.authorization, /preparation-only/);
  assert.match(execution.review, /Build alone is not runtime evidence/);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.opts.artifactRoot, 'task.json')));
  assert.ok(manifest.host.protectedFiles.some(x => x.path === 'README.md'));
  assert.equal(result.userGoalCompleted, false);
});
test('selected closure survives unrelated missing historical evidence and preserves limits', t => {
  const f = fixture(t), result = f.run();
  assert.equal(result.status, 'awaiting-adaptation'); assert.equal(result.userGoalCompleted, false);
  const selected = JSON.parse(fs.readFileSync(path.join(f.opts.artifactRoot, 'brand/selected-recipes.json')));
  assert.equal(selected.recipes.length, 1); assert.equal(selected.claims.length, 1); assert.equal(selected.styleOnly.color.value, '#fff');
  assert.deepEqual(selected.manifest.scope, f.mod.manifest.scope); assert.deepEqual(selected.limitations, ['desktop only']);
  assert.equal(fs.existsSync(path.join(f.opts.artifactRoot, 'host/.env')), false); assert.equal(fs.existsSync(path.join(f.opts.artifactRoot, 'host/qdmp.json')), false);
  assert.equal(result.dispatch.host.protectionManifest.acceptedComponents.count, 1);
  assert.equal(fs.readFileSync(path.join(f.hostRoot, 'src/page.vue'), 'utf8'), '<template><view>business</view></template>');
});
test('missing or drifted selected before/after evidence fails before output', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.brandRoot, 'before.jpg'));
  assert.throws(f.run); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
  f.write(f.brandRoot, 'before.jpg', 'drift'); assert.throws(f.run, /DEPENDENCY_HASH/); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
});
test('unselected source is not treated as approved usable material', t => {
  const f = fixture(t); f.opts.recipes = 'unused'; assert.throws(f.run); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
});
test('authorization, unknown recipe and original/nested output fail closed', t => {
  const f = fixture(t); f.opts.authorization = ''; assert.throws(f.run, /AUTHORIZATION/);
  f.opts.authorization = 'real'; f.opts.recipes = 'unknown'; assert.throws(f.run, /UNKNOWN_RECIPE/);
  f.opts.recipes = 'toggle'; f.opts.artifactRoot = path.join(f.hostRoot, 'trial'); assert.throws(f.run, /NOT_ISOLATED/);
  f.opts.artifactRoot = f.hostRoot; assert.throws(f.run, /OUTPUT_EXISTS/);
});
test('symlink source/host and dangling output never bypass checks', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.brandRoot, 'before.jpg')); fs.symlinkSync(path.join(f.brandRoot, 'after.jpg'), path.join(f.brandRoot, 'before.jpg'));
  assert.throws(f.run, /SYMLINK/); fs.unlinkSync(path.join(f.brandRoot, 'before.jpg')); f.write(f.brandRoot, 'before.jpg', 'before');
  fs.symlinkSync('/nonexistent', f.opts.artifactRoot); assert.throws(f.run, /OUTPUT_EXISTS/); fs.unlinkSync(f.opts.artifactRoot);
  fs.symlinkSync(path.join(f.brandRoot, 'before.jpg'), path.join(f.hostRoot, 'src/link')); assert.throws(f.run, /HOST_SYMLINK/);
});
test('public entry prepares ordinary inputs without manual manifest and rejects route mixing', t => {
  const f = fixture(t);
  const args = ['skills/brand/scripts/run-brand-workflow.mjs', 'run', '--request-kind', 'host-concepts', '--mode', 'design-host', '--brand-root', f.brandRoot, '--host-target', f.hostRoot, '--module-task', f.opts.task, '--module-id', f.opts.moduleId, '--module-target', f.opts.target];
  const discover = spawnSync(process.execPath, args, { encoding: 'utf8' }); assert.equal(discover.status, 0, discover.stdout); assert.equal(JSON.parse(discover.stdout).status, 'awaiting-recipe-selection');
  const mixed = spawnSync(process.execPath, [...args, '--component-task', '/not-used'], { encoding: 'utf8' }); assert.notEqual(mixed.status, 0); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
  const prepared = spawnSync(process.execPath, [...args, '--recipes', 'toggle', '--trial-authorization', f.opts.authorization, '--artifact-root', f.opts.artifactRoot], { encoding: 'utf8' }); assert.equal(prepared.status, 0, prepared.stdout); assert.equal(JSON.parse(prepared.stdout).status, 'awaiting-adaptation');
});
test('unsupported runtime/config/build target fails without leaving output', t => {
  const f = fixture(t); f.opts.buildTarget = 'unknown'; assert.throws(f.run, /BUILD_TARGET/); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
  f.opts.buildTarget = 'weapp'; f.write(f.hostRoot, 'config/index.js', "export default {sourceRoot:'src',framework:'react'}"); assert.throws(f.run, /TARO_VUE3/); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
});
test('config comments and string contents do not become declarations', t => {
  const f = fixture(t);
  f.write(f.hostRoot, 'config/index.js', `// sourceRoot: 'old', framework: 'react'
const note = "sourceRoot: 'other', framework: 'react'";
/* sourceRoot: 'legacy' */
export default { sourceRoot: 'src', framework: 'vue3' };`);
  assert.equal(f.run().status, 'awaiting-adaptation');
});
test('nonliteral and duplicate config values fail before preparation writes', t => {
  const f = fixture(t);
  for (const config of [
    "export default {sourceRoot: 'src' + suffix, framework: 'vue3'}",
    "export default {sourceRoot: 'src', framework: 'vue3' + suffix}",
    "// sourceRoot: 'src'\nexport default {framework: 'vue3'}",
    "const note = \"sourceRoot: 'src'\"; export default {framework: 'vue3'}",
    "export default {sourceRoot: `src`, framework: 'vue3'}",
    "export default {sourceRoot: 'src', sourceRoot: other, framework: 'vue3'}",
  ]) {
    f.write(f.hostRoot, 'config/index.js', config);
    assert.throws(f.run, /SOURCE_ROOT_UNSUPPORTED|TARO_VUE3_REQUIRED/);
    assert.equal(fs.existsSync(f.opts.artifactRoot), false);
  }
});
test('empty, null, non-object and incomplete capture bindings block before writes', t => {
  const f = fixture(t);
  for (const key of ['capture', 'sourceCapture', 'beforeCapture', 'afterCapture']) {
    for (const bad of [{}, null, [], 'shot', { path: 'before.jpg' }, { sha256: hash('before') }]) {
      const e = structuredClone(f.evidence); e.claims[0][key] = bad; f.write(f.brandRoot, 'brand-evidence.json', e);
      assert.throws(f.run, /CAPTURE_BINDING_REQUIRED/); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
    }
  }
  const e = structuredClone(f.evidence); delete e.claims[0].afterCapture; f.write(f.brandRoot, 'brand-evidence.json', e);
  assert.throws(f.run, /CAPTURE_PAIR_REQUIRED/); assert.equal(fs.existsSync(f.opts.artifactRoot), false);
});
test('hidden authentication trees are skipped while accepted brand sources remain protected', t => {
  const f = fixture(t);
  f.write(f.hostRoot, 'config/.config/gcloud/application_default_credentials.json', 'SYNTHETIC-NOT-A-REAL-CREDENTIAL');
  f.write(f.hostRoot, 'src/.custom-auth/data.json', 'SYNTHETIC-NOT-A-REAL-CREDENTIAL');
  const r = f.run();
  assert.equal(fs.existsSync(path.join(f.opts.artifactRoot, 'host/config/.config')), false);
  assert.equal(fs.existsSync(path.join(f.opts.artifactRoot, 'host/src/.custom-auth')), false);
  assert.equal(fs.existsSync(path.join(f.opts.artifactRoot, 'host/src/.brand-components/old/Item.vue')), true);
  assert.equal(r.preparation.credentialsCopied, undefined); assert.match(r.preparation.credentialExclusionPolicy, /not a secret-content scan/);
});
