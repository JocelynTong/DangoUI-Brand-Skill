import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onepieceCompositions, onepieceFoundations, onepieceSamples } from '../src/documents/onepiece-document-model.mjs';
import { componentNames, componentSlug, foundationNames } from '../src/documents/dango-catalog.mjs';
import { canonicalDocumentHash } from '../src/documents/routes.mjs';
const preview = JSON.parse(readFileSync(new URL('../public/brand-previews/onepiece-cardgame.json', import.meta.url)));
const before = JSON.stringify(preview);
const samples = onepieceSamples(preview);
for (const key of ['products', 'news', 'events', 'filters']) assert.ok(samples[key].length > 0, key);
assert.ok(samples.hero.assets.background);
assert.equal(JSON.stringify(preview), before);
assert.deepEqual(onepieceSamples({}), { products: [], news: [], events: [], filters: [], hero: undefined });
assert.equal(onepieceCompositions.length, 5);
assert.equal(new Set(onepieceCompositions.map(item => item.id)).size, 5);
for (const { id } of foundationNames) {
  assert.ok(onepieceFoundations[id]);
  assert.equal(canonicalDocumentHash(`#/brand/onepiece-cardgame/style/${id}`), `#/variants/onepiece-cardgame/foundations/${id}`);
}
for (const name of componentNames) {
  const old = `#/brand/onepiece-cardgame/components/${componentSlug(name)}`;
  assert.equal(canonicalDocumentHash(old), `#/variants/onepiece-cardgame/components/${componentSlug(name)}`);
  for (const query of ['?variantEmbed=1', '?inspectorEmbed=1']) assert.equal(canonicalDocumentHash(old, query), old);
}
assert.equal(canonicalDocumentHash('#/variants/onepiece-cardgame/design-system'), '#/variants/onepiece-cardgame/foundations/overview');
assert.equal(canonicalDocumentHash('#/variants/onepiece-cardgame/components'), '#/variants/onepiece-cardgame/components/inspector');
const library = readFileSync(new URL('../src/VariantLibrary.vue', import.meta.url), 'utf8');
assert.match(library, /onepiece-cardgame-news','资讯动态'/);
assert.match(library, /<OnepieceNewsGuide/);
const document = readFileSync(new URL('../src/documents/OnepieceDocument.vue', import.meta.url), 'utf8');
assert.doesNotMatch(document, /<iframe|phone-screen/);
assert.match(document, /<CatalogSection/);
assert.match(document, /<details class="document-disclosure">/);
console.log('One Piece: 5 compositions, 10 foundations, 42 component aliases, immutable preview data and News integration passed.');
