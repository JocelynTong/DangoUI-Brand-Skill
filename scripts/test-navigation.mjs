import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import postcss from 'postcss';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/VariantLibrary.vue');
const { descriptor, errors } = parse(source);
assert.deepEqual(errors, []);
assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: 'VariantLibrary.vue', id: 'navigation-test' }).errors, []);
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
