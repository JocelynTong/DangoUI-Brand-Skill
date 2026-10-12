import assert from 'node:assert/strict';
import './test-release-checklist.mjs';
import { readFileSync } from 'node:fs';
import { buildColorStructure } from '../src/documents/color-model.mjs';
import { canonicalDocumentHash } from '../src/documents/routes.mjs';
import { typographyGroups, buildTypographyGroups } from '../src/documents/typography-model.mjs';
const catalog = JSON.parse(readFileSync(new URL('../data/dangoui.design-system.json', import.meta.url)));
const before = JSON.stringify(catalog);
const rows = buildColorStructure(catalog);
assert.deepEqual(rows.map(row => row.variant), ['paletteRows', 'semanticTextRows', 'componentAliasRows']);
assert.equal(rows[0].items.length, 13);
assert.equal(rows[1].items.length, 14);
assert.equal(rows[2].items.length, 61);
assert.equal(JSON.stringify(catalog), before);
assert.deepEqual(buildColorStructure(catalog), rows);
for (const old of ['#/brand/dango/style/button', '#/brand/dango/components/button', '#/variants/dango/foundations/button', '#/variants/dango/components']) {
  assert.equal(canonicalDocumentHash(old), '#/variants/dango/components/button');
  assert.equal(canonicalDocumentHash(old, '?inspectorEmbed=1'), old);
}
assert.equal(canonicalDocumentHash('#/brand/dango/style/color'), '#/variants/dango/foundations/color');
assert.equal(canonicalDocumentHash('#/variants/dango/dango-button'), '#/variants/dango/components/button');
assert.equal(canonicalDocumentHash('#/variants/dango/dango-introduction'), '#/variants/dango/dango-introduction');
assert.equal(canonicalDocumentHash('#/brand/dango/style/typography'), '#/variants/dango/foundations/typography');
assert.deepEqual(typographyGroups.map(group => group.items.length), [8, 8, 8]);
assert.deepEqual(typographyGroups.map(group => group.items[0].weight), [700, 500, 400]);
assert.deepEqual(typographyGroups[0].items.map(item => [item.size, item.lineHeight]), [[32,40],[28,36],[24,32],[20,28],[18,26],[16,24],[14,22],[12,18]]);
assert.deepEqual(buildTypographyGroups(), typographyGroups);
for (const name of ['navigation-bar', 'switch']) {
  assert.equal(canonicalDocumentHash(`#/brand/dango/components/${name}`), `#/variants/dango/components/${name}`);
  assert.equal(canonicalDocumentHash(`#/brand/dango/components/${name}`, '?inspectorEmbed=1'), `#/brand/dango/components/${name}`);
}
for (const file of ['ColorDocument.vue', 'ButtonDocument.vue', 'TypographyDocument.vue', 'NavigationDocument.vue', 'SwitchDocument.vue', 'DocumentLayout.vue']) {
  assert.doesNotMatch(readFileSync(new URL(`../src/documents/${file}`, import.meta.url), 'utf8'), /App\.vue|iframe|phone-screen/);
}
for (const file of ['ButtonExamples.vue', 'SwitchDocument.vue', 'ColorDocument.vue', 'NavigationDocument.vue', 'ReleaseChecklist.vue']) {
  const source = readFileSync(new URL(`../src/documents/${file}`, import.meta.url), 'utf8');
  assert.match(source, /<details class="document-disclosure">/);
  assert.doesNotMatch(source, /<details[^>]*class="document-disclosure"[^>]*\bopen\b/);
}
console.log('Document model, immutable source, aliases, progressive disclosure and inspector independence passed.');
