import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
const source = readFileSync(new URL('../src/VariantLibrary.vue', import.meta.url), 'utf8');
test('invalid library scenes are guarded before fallback rendering', () => {
  assert.ok(source.indexOf('v-else-if="invalidScene"') < source.indexOf('v-else-if="!selected"'));
  assert.match(source, /!selected.value.scenes.some/);
  assert.match(source, /场景不存在/);
});
test('standalone navigation is excluded from embedded frames and drops embed query', () => {
  assert.match(source, /window.self === window.top/);
  assert.match(source, /location.pathname\}#\/variants/);
  assert.match(source, /← 返回说明页/);
  assert.match(source, /previewScene.value\?\.label.*独立预览/);
});
test('updated Vue script compiles', () => {
  const { descriptor } = parse(source);
  assert.ok(compileScript(descriptor, { id: 'share-access' }).content);
});
