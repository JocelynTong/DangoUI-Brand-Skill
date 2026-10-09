import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { componentTask } from './component-task.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'component-task-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const brandRoot = path.join(dir, 'brand'), root = path.join(dir, 'host'), trialRoot = path.join(dir, 'trial');
  fs.mkdirSync(brandRoot); fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  for (const [name, content] of Object.entries({ 'recipe.html': '<button>View</button>', 'usage.md': 'Existing view and change event.', 'capability.md': 'Presentation toggle only.' })) fs.writeFileSync(path.join(brandRoot, name), content);
  const deps = { vue: '^3.5.0', '@tarojs/taro': '4.2.0', '@tarojs/components': '4.2.0', '@tarojs/plugin-framework-vue3': '4.2.0' };
  for (const [name, content] of Object.entries({ 'package.json': JSON.stringify({ dependencies: deps }), 'config.js': "export default {sourceRoot:'src',framework:'vue3'}", 'src/page.vue': '<template><view>real data</view></template>', 'src/accepted.vue': '<template><view>Accepted</view></template>' })) fs.writeFileSync(path.join(root, name), content);
  fs.cpSync(root, trialRoot, { recursive: true });
  const binding = (base, name) => ({ path: name, sha256: hash(fs.readFileSync(path.join(base, name))) });
  const manifest = { schema: 'component-selection-task/v1', scope: 'single-module', authorization: { scope: 'isolated-trial-only', statement: 'Test existing module selection in isolated host.' }, approval: 'pending', module: { id: 'view-toggle', description: 'Existing card/text view toggle' }, brand: { id: 'brand', root: brandRoot, candidates: [{ id: 'toggle', runtime: 'browser-dom', framework: 'html', files: [binding(brandRoot, 'recipe.html')], usage: binding(brandRoot, 'usage.md'), capability: binding(brandRoot, 'capability.md') }] }, host: { root, trialRoot, sourceRoot: 'src', target: 'src/page.vue', sha256: binding(root, 'src/page.vue').sha256, configFile: 'config.js', buildTarget: 'weapp', protectedFiles: ['package.json', 'config.js'].map(x => binding(root, x)), acceptedComponents: [binding(root, 'src/accepted.vue')] }, protectedBehavior: ['Preserve current mode state and change event'] };
  const manifestPath = path.join(dir, 'task.json');
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest)); save();
  return { dir, root, trialRoot, brandRoot, manifest, manifestPath, save, run: () => componentTask({ manifestPath }) };
}
function snapshot(root) {
  return fs.readdirSync(root, { recursive: true }).sort().filter(x => fs.statSync(path.join(root, x)).isFile()).map(x => [x, hash(fs.readFileSync(path.join(root, x)))]);
}
test('public candidate entry returns usable HTML adaptation inputs without writes or approval', t => {
  const f = fixture(t), before = snapshot(f.dir);
  const result = spawnSync(process.execPath, ['skills/brand/scripts/run-brand-workflow.mjs', 'run', '--request-kind', 'host-concepts', '--mode', 'design-host', '--component-task', f.manifestPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const actual = JSON.parse(result.stdout);
  assert.equal(actual.status, 'awaiting-adaptation'); assert.equal(actual.approval, 'pending');
  assert.equal(actual.fullWorkflowPass, false); assert.equal(actual.userGoalCompleted, false);
  const candidate = actual.dispatch.brand.candidates[0];
  assert.equal(candidate.referenceOnly, true); assert.equal(candidate.directInstallationAllowed, false);
  assert.equal(fs.readFileSync(candidate.files[0].absolute, 'utf8'), '<button>View</button>');
  assert.deepEqual(actual.dispatch.allowedChanges, [path.join(f.trialRoot, 'src/page.vue')]);
  assert.equal(actual.dispatch.allowedNewFilesUnder, path.join(f.trialRoot, 'src/.brand-trials/view-toggle'));
  const protection = actual.dispatch.host.protectionManifest;
  assert.equal(hash(fs.readFileSync(protection.absolute)), protection.sha256);
  assert.equal(protection.acceptedComponents.count, 1);
  assert.equal(protection.acceptedComponents.sha256, hash(JSON.stringify(f.manifest.host.acceptedComponents)));
  assert.equal(actual.dispatch.host.protectedFiles, undefined);
  assert.deepEqual(snapshot(f.dir), before);
});
test('component approval is not a trial authorization', t => {
  const f = fixture(t); f.manifest.approval = { statement: 'approved', kitSha256: 'a'.repeat(64) }; f.save();
  assert.throws(f.run, /AUTHORIZATION_INVALID/);
});
test('config literals ignore comments and strings and reject expressions without writes', t => {
  const f = fixture(t);
  const setConfig = config => {
    for (const base of [f.root, f.trialRoot]) fs.writeFileSync(path.join(base, 'config.js'), config);
    f.manifest.host.protectedFiles.find(x => x.path === 'config.js').sha256 = hash(config);
    f.save();
  };
  setConfig(`/* sourceRoot: 'old', framework: 'react' */
const note = "sourceRoot: 'other', framework: 'react'";
export default {sourceRoot: 'src', framework: 'vue3'};`);
  assert.equal(f.run().status, 'awaiting-adaptation');
  for (const config of [
    "export default {sourceRoot: 'src' + suffix, framework: 'vue3'}",
    "export default {sourceRoot: 'src', framework: 'vue3' + suffix}",
    "// framework: 'vue3'\nexport default {sourceRoot: 'src'}",
    "const note = \"sourceRoot: 'src'\"; export default {framework: 'vue3'}",
    "export default {sourceRoot: 'src', framework: `vue3`}",
    "export default {sourceRoot: 'src', sourceRoot: other, framework: 'vue3'}",
  ]) {
    setConfig(config);
    const before = snapshot(f.dir);
    assert.throws(f.run, /CONFIG_UNSUPPORTED/);
    assert.deepEqual(snapshot(f.dir), before);
  }
});
test('original root, nested roots and hardlinked target cannot be trial host', t => {
  const f = fixture(t); f.manifest.host.trialRoot = f.root; f.save(); assert.throws(f.run, /TRIAL_NOT_ISOLATED/);
  const nested = path.join(f.root, 'trial'); fs.mkdirSync(nested); f.manifest.host.trialRoot = nested; f.save(); assert.throws(f.run, /TRIAL_NOT_ISOLATED/);
  f.manifest.host.trialRoot = f.trialRoot; f.save(); fs.unlinkSync(path.join(f.trialRoot, 'src/page.vue')); fs.linkSync(path.join(f.root, 'src/page.vue'), path.join(f.trialRoot, 'src/page.vue')); assert.throws(f.run, /TARGET_ALIASED/);
});
test('traversal and candidate symlink escape are rejected', t => {
  const f = fixture(t); f.manifest.host.target = '../outside.vue'; f.save(); assert.throws(f.run, /PATH_UNSAFE/);
  f.manifest.host.target = 'src/page.vue'; f.save(); fs.unlinkSync(path.join(f.brandRoot, 'recipe.html')); fs.symlinkSync(path.join(f.root, 'src/page.vue'), path.join(f.brandRoot, 'recipe.html')); assert.throws(f.run, /SYMLINK_ESCAPE/);
});
test('source, trial baseline and accepted component drift are rejected', t => {
  const f = fixture(t); const source = path.join(f.brandRoot, 'recipe.html'), original = fs.readFileSync(source); fs.appendFileSync(source, 'drift'); assert.throws(f.run, /HASH_MISMATCH/); fs.writeFileSync(source, original);
  const target = path.join(f.trialRoot, 'src/page.vue'), targetOriginal = fs.readFileSync(target); fs.appendFileSync(target, 'drift'); assert.throws(f.run, /HASH_MISMATCH/); fs.writeFileSync(target, targetOriginal);
  fs.appendFileSync(path.join(f.trialRoot, 'src/accepted.vue'), 'drift'); assert.throws(f.run, /HASH_MISMATCH/);
});
test('public trial refuses apply-host/direct-install route and mixing approved handoff', t => {
  const f = fixture(t), before = snapshot(f.dir);
  for (const args of [['--request-kind', 'host-implementation', '--mode', 'apply-host'], ['--request-kind', 'host-concepts', '--mode', 'design-host', '--component-handoff', f.manifestPath]]) {
    const result = spawnSync(process.execPath, ['skills/brand/scripts/run-brand-workflow.mjs', 'run', '--component-task', f.manifestPath, ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
  }
  assert.deepEqual(snapshot(f.dir), before);
});
test('trial output cannot overwrite existing path or escape by symlink', t => {
  const f = fixture(t), parent = path.join(f.trialRoot, 'src/.brand-trials');
  fs.symlinkSync(f.brandRoot, parent); assert.throws(f.run, /OUTPUT_UNSAFE/);
  fs.unlinkSync(parent); fs.mkdirSync(path.join(parent, 'view-toggle'), { recursive: true }); assert.throws(f.run, /OUTPUT_EXISTS/);
});
test('dangling output and ancestor symlinks block dispatch without writes', t => {
  const f = fixture(t), parent = path.join(f.trialRoot, 'src/.brand-trials');
  const missing = path.join(f.dir, 'missing');
  fs.symlinkSync(missing, parent);
  assert.throws(f.run, /OUTPUT_UNSAFE/);
  assert.equal(fs.lstatSync(parent).isSymbolicLink(), true);
  assert.equal(fs.existsSync(missing), false);
  fs.unlinkSync(parent); fs.mkdirSync(parent);
  const output = path.join(parent, 'view-toggle');
  fs.symlinkSync(missing, output);
  assert.throws(f.run, /OUTPUT_EXISTS/);
  assert.equal(fs.lstatSync(output).isSymbolicLink(), true);
  assert.equal(fs.existsSync(missing), false);
});
