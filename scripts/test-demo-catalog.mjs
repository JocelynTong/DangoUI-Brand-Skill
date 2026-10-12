import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Grid from '../src/uikit/CatalogProductGrid.mjs';
import CatalogSection from '../src/uikit/CatalogSection.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const preview = JSON.parse(read('../public/brand-previews/onepiece-cardgame.json'));
const items = preview.pages.find(p => p.id === 'onepiece-cardgame-products').sections.find(s => s.id === 'product-grid').assets.products;
const render = props => renderToString(createSSRApp({ render: () => h(Grid, props) }));

test('renders existing records in order without mutating business input', async () => {
  const before = JSON.stringify(items);
  const output = await render({ items });
  assert.equal((output.match(/<article /g) || []).length, items.length);
  let cursor = -1;
  for (const item of items) {
    const next = output.indexOf(`<strong>${item.title}</strong>`);
    assert.ok(next > cursor);
    cursor = next;
    assert.ok(output.includes(`src="${item.src}"`));
  }
  assert.equal(JSON.stringify(items), before);
});

test('accepts a consumer subset and an explicit empty state', async () => {
  assert.equal(((await render({ items: items.slice(0, 1) })).match(/<article /g) || []).length, 1);
  const empty = await render({ items: [], emptyText: '没有匹配结果' });
  assert.ok(empty.includes('没有匹配结果'));
  assert.ok(!empty.includes('<article'));
});

test('preserves card-assets classes and escapes text', async () => {
  const output = await render({ items: [{ title: '<script>bad</script>' }], sectionType: 'content-cards', assetKind: 'card-assets' });
  assert.ok(output.includes('source-schema-demo__product-art') === false);
  assert.ok(output.includes('source-schema-demo__product-card--card-assets'));
  assert.ok(output.includes('&lt;script&gt;bad&lt;/script&gt;'));
});

test('demo imports the shared catalog implementation', () => {
  assert.match(read('../src/App.vue'), /import CatalogSection from "\.\/uikit\/CatalogSection.mjs"/);
  assert.match(read('../src/uikit/CatalogSection.mjs'), /import CatalogProductGrid from '\.\/CatalogProductGrid.mjs'/);
});

test('section preserves content, categories, schema attributes and record order', async () => {
  const props = { title: 'Products', description: '8 official products', filters: ['ALL', { label: 'DECKS' }], items, appearance: 'onepiece', 'data-schema-section-id': 'product-grid' };
  const before = JSON.stringify(props);
  const html = await renderToString(createSSRApp({ render: () => h(CatalogSection, props) }));
  assert.match(html, /data-schema-section-id="product-grid"/);
  assert.match(html, /<strong>Products<\/strong><p>8 official products<\/p>/);
  assert.match(html, /class="active">ALL<\/button>/);
  assert.equal((html.match(/<article /g) || []).length, items.length);
  assert.equal(JSON.stringify(props), before);
});
