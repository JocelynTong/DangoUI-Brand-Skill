import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import postcss from 'postcss';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/VariantLibrary.vue');
const appSource = read('../src/App.vue');
const homeLinkBody = appSource.match(/const homePreviewLink = \(path\) => \{[\s\S]*?\n\};/)[0];
const homeLink = new Function('location', homeLinkBody + '; return homePreviewLink;')({ pathname: '/demo/' });
assert.deepEqual(homeLink('/beginners/'), {});
assert.deepEqual(homeLink(undefined), {});
for (const [path, scene] of [['/products/decks/', 'products'], ['/events/championship-26-27.html', 'events'], ['/', 'home']]) {
  assert.deepEqual(homeLink(path), { href: '/demo/#/variants/onepiece-cardgame/onepiece-cardgame-' + scene, target: '_top' });
}
const copyBoundaries = new Function(source.match(/const sceneCopyBoundaries = \{[\s\S]*?\n\};/)[0] + '; return sceneCopyBoundaries;')();
for (const scene of ['pokemon-tcg-official-card-database', 'czn-character', 'czn-held-out']) assert.ok(copyBoundaries[scene].includes('尚非独立组件'));
assert.ok(copyBoundaries['onepiece-cardgame-events'].includes('不提供报名'));
assert.match(source, /使用边界：.*sceneCopyBoundaries\[activeScene.value.id\]/);
const { descriptor, errors } = parse(source);
assert.deepEqual(errors, []);
assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: 'VariantLibrary.vue', id: 'navigation-test' }).errors, []);
const guide = read('../src/documents/CatalogUsageGuide.vue');
const sceneGuide = read('../src/documents/SceneUsageGuide.vue');
const parsedSceneGuide = parse(sceneGuide);
assert.deepEqual(parsedSceneGuide.errors, []);
assert.deepEqual(compileTemplate({ source: parsedSceneGuide.descriptor.template.content, filename: 'SceneUsageGuide.vue', id: 'scene-guide-test' }).errors, []);
assert.match(source, /<SceneUsageGuide v-else-if="hasSceneUsageGuide" :key="activeScene.id"/);
assert.doesNotMatch(sceneGuide, /<details\s+open|<pre|<button|<iframe/);
for (const term of ['pokemon-tcg-official-card-database', 'czn-character', 'czn-held-out', '两个头像入口', '一一对应', '3 条示例档案', '未连接官方卡牌数据库', '尚未抽成', 'Taro']) assert.ok(sceneGuide.includes(term));
const parsedGuide = parse(guide);
assert.deepEqual(parsedGuide.errors, []);
assert.deepEqual(compileTemplate({ source: parsedGuide.descriptor.template.content, filename: 'CatalogUsageGuide.vue', id: 'catalog-guide-test' }).errors, []);
assert.match(source, /<CatalogUsageGuide v-else-if="isCatalogScene"/);
assert.match(source, /静态目录示例/);
assert.match(source, /组件复用范围：/);
assert.doesNotMatch(guide, /<details\s+open|localhost|127\.0\.0\.1/);
for (const term of ['分类和页码不会筛选、翻页', 'CatalogProductGrid', 'CatalogSection', 'emptyText', 'catalog-tokens.css', 'Taro']) assert.ok(guide.includes(term));
assert.equal((source.match(/aria-label="内容分类"/g) || []).length, 1);
assert.equal((source.match(/aria-label="品牌目录"/g) || []).length, 1);
const newWindowLinks = [...source.matchAll(/<a\b[^>]*target="_blank"[^>]*>([^<]*)<\/a>/g)];
assert.equal(newWindowLinks.length, 2);
assert.ok(newWindowLinks.every(([, label]) => /独立预览|独立窗口/.test(label)), 'Only explicit independent previews may open new tabs');
assert.ok(source.indexOf('class="vl-brand-heading"') < source.indexOf('class="vl-primary-nav"'));
assert.match(source, /<template v-if="section === 'pages'">/);
assert.match(source, /<template v-else-if="section === 'foundations'">/);
assert.match(source, /:aria-expanded="menuOpen" aria-controls="brand-directory"/);
assert.match(source, /menuOpen\.value = false/);
assert.match(source, /nextTick\(\(\) => window\.scrollTo\(0, 0\)\)/);

const css = postcss.parse(read('../src/design-document.css'));
const declarations = selector => {
  const result = {};
  css.walkRules(selector, rule => {
    if (rule.parent.type === 'root') rule.walkDecls(d => { result[d.prop] = d.value; });
  });
  return result;
};
assert.equal(declarations('.vl-primary-nav').position, 'sticky');
assert.equal(declarations('.vl-primary-nav').top, '0');
assert.equal(declarations('.vl-navigation').position, 'sticky');
assert.equal(declarations('.vl-navigation')['overflow-y'], 'auto');
assert.equal(declarations('.vl-navigation')['overscroll-behavior'], 'contain');
const libraryCss = read('../src/variant-library.css');
assert.match(source, /:src="framedPreviewUrl"/);
assert.match(source, /:href="previewUrl" target="_blank"/);
assert.match(source, /variantEmbed=1&previewFrame=phone/);
assert.match(read('../src/main.js'), /get\("previewFrame"\) === "phone"/);
const phoneCss = postcss.parse(read('../src/preview-phone.css'));
phoneCss.walkRules(rule => assert.ok(rule.selectors.every(selector => selector.startsWith('body.site-preview-phone')), 'Phone frame overrides must not affect standalone pages'));
const phoneFrame = {};
phoneCss.walkRules('body.site-preview-phone .shell .phone.template-phone', rule => rule.walkDecls(d => { phoneFrame[d.prop] = d.value; }));
assert.equal(phoneFrame['aspect-ratio'], '395 / 832');
assert.equal(phoneFrame.border, 'var(--mockup-frame-border-scaled) solid var(--site-border)');
// The embedded phone owns its frame; the host must not add nested shells.
postcss.parse(libraryCss).walkRules(rule => {
  if (!['.vl-preview-stage', '.vl-preview-stage iframe'].includes(rule.selector)) return;
  rule.walkDecls(decl => {
    if (['border', 'border-radius', 'box-shadow', 'padding'].includes(decl.prop)) {
      assert.ok(['0', 'none'].includes(decl.value), `Redundant preview frame: ${decl.prop}`);
    }
    if (decl.prop === 'background') assert.equal(decl.value, 'transparent');
  });
});
assert.match(libraryCss, /body:has\(\.variant-library\)[^{]*\{[^}]*overflow:visible/);
assert.doesNotMatch(libraryCss, /\.vl-(view-tabs|scenes|scene-group|preview-caption)(?![\w-])/);
console.log('Navigation template, hierarchy, scroll reset and sticky CSS contracts passed.');
