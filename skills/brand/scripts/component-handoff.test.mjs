import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { componentHandoff } from './component-handoff.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
function fixture(t, deps = { vue: '^3.5.0', vite: '^7.0.0' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-handoff-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'kit'), root = path.join(dir, 'host');
  fs.mkdirSync(source); fs.mkdirSync(root); fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(source, 'item.mjs'), 'export default {};');
  fs.writeFileSync(path.join(source, 'item.css'), '.item { color: blue }');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: deps }));
  fs.writeFileSync(path.join(root, 'src/main.mjs'), 'const original = true;');
  fs.writeFileSync(path.join(root, 'src/data.mjs'), 'export const records = [];');
  const binding = (base, file) => ({ path: file, sha256: hash(fs.readFileSync(path.join(base, file))) });
  const kit = { id: 'catalog-item', runtime: 'browser-dom', framework: 'vue3', entry: 'item.mjs', stylesheet: 'item.css', files: ['item.mjs', 'item.css'].map(file => binding(source, file)), usage: 'Import component and bind existing item and open event.' };
  const manifest = { schema: 'approved-component-handoff/v1', scope: 'single-module', sourceRoot: source, kit, approval: { kitSha256: hash(JSON.stringify(kit)), statement: 'User approved this component.' }, host: { root, target: 'src/main.mjs', sha256: binding(root, 'src/main.mjs').sha256, protectedFiles: ['package.json', 'src/data.mjs'].map(file => binding(root, file)) }, protectedBehavior: ['Preserve records and existing open event.'] };
  const manifestPath = path.join(dir, 'handoff.json');
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest)); save();
  const run = command => componentHandoff({ manifestPath, command });
  const implement = () => fs.writeFileSync(path.join(root, 'src/main.mjs'), "import Item from '../.brand-components/catalog-item/item.mjs';\nimport '../.brand-components/catalog-item/item.css';\nconsole.log(Item);");
  return { dir, root, source, manifest, manifestPath, save, run, implement };
}
test('public entry installs approved Web kit; status is not workflow completion; rerun preserves baseline', t => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, ['skills/brand/scripts/run-brand-workflow.mjs', 'run', '--request-kind', 'host-implementation', '--mode', 'apply-host', '--component-handoff', f.manifestPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(JSON.parse(result.stdout).status, 'awaiting-implementation');
  const baseline = fs.readFileSync(path.join(f.root, '.brand-components/catalog-item/target-baseline.txt'));
  f.implement();
  const status = f.run('status'); assert.equal(status.fullWorkflowPass, false); assert.equal(status.status, 'implementation-linked-awaiting-independent-qa');
  f.run('run'); assert.deepEqual(fs.readFileSync(path.join(f.root, '.brand-components/catalog-item/target-baseline.txt')), baseline);
});
test('Taro takes priority over Vue and causes no installation', t => {
  const f = fixture(t, { vue: '^3.5.0', vite: '^7.0.0', '@tarojs/taro': '4.2.0' });
  assert.equal(f.run('run').status, 'needs-adaptation'); assert.equal(fs.existsSync(path.join(f.root, '.brand-components')), false);
});
test('unknown platform rejected without writes', t => {
  const f = fixture(t, { vue: '^3.5.0' }); assert.throws(() => f.run('run'), /PLATFORM_UNKNOWN/);
  assert.equal(fs.existsSync(path.join(f.root, '.brand-components')), false);
});
test('source hash drift and approval drift rejected', t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.source, 'item.css'), 'bad'); assert.throws(() => f.run('run'), /HASH_MISMATCH/);
  f.manifest.approval.kitSha256 = '0'.repeat(64); f.save(); assert.throws(() => f.run('run'), /APPROVAL_INVALID/);
  assert.equal(fs.existsSync(path.join(f.root, '.brand-components')), false);
});
test('unsafe target traversal and symlink destination rejected', t => {
  const f = fixture(t); f.manifest.host.target = '../escape'; f.save(); assert.throws(() => f.run('run'), /PATH_UNSAFE/);
  f.manifest.host.target = 'src/main.mjs'; f.save(); fs.symlinkSync(f.source, path.join(f.root, '.brand-components')); assert.throws(() => f.run('run'), /SYMLINK_UNSAFE/);
});
test('existing destination rejected rather than overwritten', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.root, '.brand-components/catalog-item'), { recursive: true }); assert.throws(() => f.run('run'), /DESTINATION_EXISTS/);
});
test('protected file, installed kit, receipt and baseline drift are rejected', t => {
  const f = fixture(t); f.run('run'); f.implement();
  const data = path.join(f.root, 'src/data.mjs'), old = fs.readFileSync(data); fs.appendFileSync(data, 'bad'); assert.throws(() => f.run('status'), /HASH_MISMATCH/); fs.writeFileSync(data, old);
  const kit = path.join(f.root, '.brand-components/catalog-item/item.css'), kitOld = fs.readFileSync(kit); fs.appendFileSync(kit, 'bad'); assert.throws(() => f.run('status'), /HASH_MISMATCH/); fs.writeFileSync(kit, kitOld);
  const receipt = path.join(f.root, '.brand-components/catalog-item/handoff-receipt.json'), receiptOld = fs.readFileSync(receipt); const json = JSON.parse(receiptOld); json.baselineSha256 = '0'.repeat(64); fs.writeFileSync(receipt, JSON.stringify(json)); assert.throws(() => f.run('status'), /HANDOFF_CONFLICT/); fs.writeFileSync(receipt, receiptOld);
  fs.appendFileSync(path.join(f.root, '.brand-components/catalog-item/target-baseline.txt'), 'bad'); assert.throws(() => f.run('run'), /BASELINE_DRIFT/);
});
test('fake import in comments or string is not accepted', t => {
  const f = fixture(t); f.run('run');
  for (const code of ["/* import Item from '../.brand-components/catalog-item/item.mjs';\nimport '../.brand-components/catalog-item/item.css'; */", "const fake = `import Item from '../.brand-components/catalog-item/item.mjs';\nimport '../.brand-components/catalog-item/item.css';`;"]) {
    fs.writeFileSync(path.join(f.root, 'src/main.mjs'), code); assert.throws(() => f.run('status'), /IMPORTS_MISSING/);
  }
});
test('dry run validates without creating files', t => { const f = fixture(t); assert.equal(componentHandoff({ manifestPath: f.manifestPath, dryRun: true }).status, 'validated-no-writes'); assert.equal(fs.existsSync(path.join(f.root, '.brand-components')), false); });
test('dry run rejects unsupported file types before writes', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.source, 'notes.txt'), 'not runtime');
  f.manifest.kit.files.push({ path: 'notes.txt', sha256: hash('not runtime') }); f.manifest.approval.kitSha256 = hash(JSON.stringify(f.manifest.kit)); f.save();
  assert.throws(() => componentHandoff({ manifestPath: f.manifestPath, dryRun: true }), /FILE_TYPE_INVALID/);
  assert.equal(fs.existsSync(path.join(f.root, '.brand-components')), false);
});
test('Vue SFC checks script imports without treating template apostrophes as JavaScript', t => {
  const f = fixture(t); fs.renameSync(path.join(f.root, 'src/main.mjs'), path.join(f.root, 'src/Main.vue'));
  f.manifest.host.target = 'src/Main.vue'; f.save(); f.run('run');
  fs.writeFileSync(path.join(f.root, 'src/Main.vue'), `<template><div>Let's go <Item /></div></template>\n<script setup>\nimport Item from '../.brand-components/catalog-item/item.mjs';\nimport '../.brand-components/catalog-item/item.css';\n</script>\n<style>.label::after { content: "That's all"; }</style>`);
  assert.equal(f.run('status').status, 'implementation-linked-awaiting-independent-qa');
});

function taroFixture(t, sourceRoot = 'client') {
  const f = fixture(t, { vue: '^3.5.0', '@tarojs/taro': '4.2.0', '@tarojs/components': '4.2.0', '@tarojs/plugin-framework-vue3': '4.2.0' });
  fs.mkdirSync(path.join(f.root, sourceRoot), { recursive: true });
  fs.mkdirSync(path.join(f.root, 'config'));
  fs.writeFileSync(path.join(f.root, 'config/index.js'), `export default { sourceRoot: '${sourceRoot}', framework: 'vue3' };`);
  const original = '<template><view>Original</view></template><script setup>const item = {};</script>';
  fs.writeFileSync(path.join(f.root, sourceRoot, 'Page.vue'), original);
  const sfc = '<template><view>{{ item.name }}</view></template><script setup>defineProps({item:Object});</script><style scoped>view{color:blue}</style>';
  fs.writeFileSync(path.join(f.source, 'Item.vue'), sfc);
  f.manifest.kit = { id: 'catalog-item', runtime: 'taro', framework: 'vue3', entry: 'Item.vue', targets: ['weapp'], dependencies: ['vue', '@tarojs/taro', '@tarojs/components', '@tarojs/plugin-framework-vue3'], files: [{ path: 'Item.vue', sha256: hash(sfc) }], usage: 'Taro 4 / Vue 3; bind original item and event; weapp only.' };
  f.manifest.host.target = `${sourceRoot}/Page.vue`;
  f.manifest.host.sha256 = hash(original);
  f.manifest.host.taro = { sourceRoot, configFile: 'config/index.js', buildTarget: 'weapp' };
  f.manifest.host.protectedFiles.push({ path: 'config/index.js', sha256: hash(fs.readFileSync(path.join(f.root, 'config/index.js'))) });
  f.save = () => { f.manifest.approval.kitSha256 = hash(JSON.stringify(f.manifest.kit)); fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest)); };
  f.save();
  f.destination = path.join(f.root, sourceRoot, '.brand-components/catalog-item');
  f.implement = () => fs.writeFileSync(path.join(f.root, sourceRoot, 'Page.vue'), `<template><Item :item="item" /></template><script setup>import Item from './.brand-components/catalog-item/Item.vue';const item = {};</script>`);
  return f;
}
test('approved Taro SFC installs within configured custom sourceRoot; inline styles need no import; public status remains static', t => {
  const f = taroFixture(t);
  const result = spawnSync(process.execPath, ['skills/brand/scripts/run-brand-workflow.mjs', 'run', '--request-kind', 'host-implementation', '--mode', 'apply-host', '--component-handoff', f.manifestPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const dispatch = JSON.parse(result.stdout).dispatch;
  assert.equal(dispatch.component.entry, fs.realpathSync(path.join(f.destination, 'Item.vue')));
  assert.equal(dispatch.component.stylesheetImport, null);
  assert.deepEqual(dispatch.component.targets, ['weapp']);
  assert.equal(dispatch.runtimeCheck.configEvaluation, 'literal-declarations-only');
  assert.throws(() => f.run('status'), /IMPORTS_MISSING/);
  f.implement();
  const status = f.run('status');
  assert.equal(status.status, 'implementation-linked-awaiting-independent-qa');
  assert.equal(status.fullWorkflowPass, false); assert.equal(status.userGoalCompleted, false);
  const baseline = fs.readFileSync(path.join(f.destination, 'target-baseline.txt'));
  f.run('run'); assert.deepEqual(fs.readFileSync(path.join(f.destination, 'target-baseline.txt')), baseline);
  fs.appendFileSync(path.join(f.destination, 'Item.vue'), 'drift');
  assert.throws(() => f.run('run'), /HASH_MISMATCH/);
});
test('Taro target mismatch, unsafe sourceRoot and unsupported React fail without writes', t => {
  const f = taroFixture(t);
  f.manifest.host.taro.buildTarget = 'h5'; f.save(); assert.throws(() => f.run('run'), /TARGET_MISMATCH/);
  f.manifest.host.taro.buildTarget = 'weapp'; f.manifest.host.taro.sourceRoot = '../escape'; f.save(); assert.throws(() => f.run('run'), /PATH_UNSAFE/);
  f.manifest.host.taro.sourceRoot = 'client'; f.manifest.kit.framework = 'react'; f.save(); assert.throws(() => f.run('run'), /PLATFORM_UNSUPPORTED/);
  assert.equal(fs.existsSync(f.destination), false);
});
test('Taro kit rejects Web host and foreign destination without writes or overwrite', t => {
  const f = taroFixture(t);
  const pkg = path.join(f.root, 'package.json'), old = fs.readFileSync(pkg);
  fs.writeFileSync(pkg, JSON.stringify({ dependencies: { vue: '^3.5.0', vite: '^7.0.0' } }));
  f.manifest.host.protectedFiles[0].sha256 = hash(fs.readFileSync(pkg)); f.save();
  assert.equal(f.run('run').status, 'needs-adaptation'); assert.equal(fs.existsSync(f.destination), false);
  fs.writeFileSync(pkg, old); f.manifest.host.protectedFiles[0].sha256 = hash(old); f.save();
  fs.mkdirSync(f.destination, { recursive: true }); fs.writeFileSync(path.join(f.destination, 'Item.vue'), 'user content');
  assert.throws(() => f.run('run'), /DESTINATION_EXISTS/);
  assert.equal(fs.readFileSync(path.join(f.destination, 'Item.vue'), 'utf8'), 'user content');
});
test('Taro configuration must be protected and its literal sourceRoot must match', t => {
  const f = taroFixture(t); f.manifest.host.taro.sourceRoot = 'src'; f.save(); assert.throws(() => f.run('run'), /LITERAL_CONFIG_REQUIRED/);
  f.manifest.host.taro.sourceRoot = 'client'; f.manifest.host.protectedFiles.pop(); f.save(); assert.throws(() => f.run('run'), /CONFIG_PROTECTION_REQUIRED/);
  assert.equal(fs.existsSync(f.destination), false);
});
test('Taro config ignores comment/string contents and refuses concatenated or dynamic declarations', t => {
  const f = taroFixture(t);
  const setConfig = config => {
    fs.writeFileSync(path.join(f.root, 'config/index.js'), config);
    f.manifest.host.protectedFiles.find(x => x.path === 'config/index.js').sha256 = hash(config);
    f.save();
  };
  for (const config of [
    "export default {sourceRoot: 'client' + suffix, framework: 'vue3'}",
    "export default {sourceRoot: 'client', framework: 'vue3' + suffix}",
    "// sourceRoot: 'client'\nexport default {framework: 'vue3'}",
    "const note = \"sourceRoot: 'client'\"; export default {framework: 'vue3'}",
    "export default {sourceRoot: `client`, framework: 'vue3'}",
    "export default {sourceRoot: 'client', sourceRoot: other, framework: 'vue3'}",
  ]) {
    setConfig(config);
    assert.throws(() => f.run('run'), /LITERAL_CONFIG_REQUIRED/);
    assert.equal(fs.existsSync(f.destination), false);
  }
  setConfig(`/* sourceRoot: 'old', framework: 'react' */
const note = "sourceRoot: 'other', framework: 'react'";
export default {sourceRoot: 'client', framework: 'vue3'};`);
  assert.equal(f.run('run').ok, true);
});

for (const reserved of ['target-baseline.txt', 'handoff-receipt.json']) {
  test(`reserved receipt/baseline directory ${reserved} is rejected before any host writes`, t => {
    const f = taroFixture(t);
    fs.mkdirSync(path.join(f.source, reserved));
    fs.writeFileSync(path.join(f.source, reserved, 'foo.js'), 'export default 1;');
    f.manifest.kit.files.push({ path: `${reserved}/foo.js`, sha256: hash('export default 1;') });
    f.save();
    assert.throws(() => f.run('run'), /MODULE_KIT_ENTRY_INVALID/);
    assert.equal(fs.existsSync(path.dirname(f.destination)), false);
    assert.equal(hash(fs.readFileSync(path.join(f.root, f.manifest.host.target))), f.manifest.host.sha256);
  });
}
