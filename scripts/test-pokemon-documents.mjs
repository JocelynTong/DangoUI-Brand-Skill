import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { pokemonSamples, pokemonCompositions, pokemonFoundations } from '../src/documents/pokemon-document-model.mjs';
import { componentNames, componentSlug, foundationNames } from '../src/documents/dango-catalog.mjs';
import { canonicalDocumentHash } from '../src/documents/routes.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const preview = JSON.parse(read('../public/brand-previews/pokemon-tcg-official.json'));
const before = JSON.stringify(preview), samples = pokemonSamples(preview);
assert.equal(preview.pages.length, 4);
assert.equal(samples.cards.length, 4);
assert.equal(samples.stories.length, 3);
assert.equal(samples.types.length, 11);
assert.ok(samples.campaign.product.src);
assert.equal(samples.anatomy.content.interactionMode, 'static-evidence-only');
assert.equal(JSON.stringify(preview), before);
assert.deepEqual(pokemonSamples({}), {campaign:undefined, stories:[],types:[],cards:[],anatomy:undefined});
assert.equal(new Set(pokemonCompositions.map(x=>x.id)).size, 4);
for(const {id} of foundationNames){assert.ok(pokemonFoundations[id]);assert.equal(canonicalDocumentHash(`#/brand/pokemon-tcg-official/style/${id}`),`#/variants/pokemon-tcg-official/foundations/${id}`);}
for(const name of componentNames){const old=`#/brand/pokemon-tcg-official/components/${componentSlug(name)}`;assert.equal(canonicalDocumentHash(old),`#/variants/pokemon-tcg-official/components/${componentSlug(name)}`);for(const query of ['?variantEmbed=1','?inspectorEmbed=1'])assert.equal(canonicalDocumentHash(old,query),old);}
assert.equal(canonicalDocumentHash('#/variants/pokemon-tcg-official/components'),'#/variants/pokemon-tcg-official/components/inspector');
assert.equal(canonicalDocumentHash('#/variants/pokemon-tcg-official/foundations'),'#/variants/pokemon-tcg-official/foundations/overview');
for(const file of ['PokemonDocument.vue','PokemonSceneGuide.vue']){const source=read(`../src/documents/${file}`), parsed=parse(source);assert.deepEqual(parsed.errors,[]);assert.deepEqual(compileTemplate({source:parsed.descriptor.template.content,filename:file,id:file}).errors,[]);assert.doesNotMatch(source,/<iframe/);}
const library=read('../src/VariantLibrary.vue');
for(const page of preview.pages) assert.ok(library.includes(`'${page.id}':`), `${page.id} copy boundary`);
assert.match(read('../src/documents/PokemonDocument.vue'), /input disabled/);
assert.doesNotMatch(library, /分步阅读与内容展开/);
console.log('Pokémon demo: 4 pages, 4 compositions, 10 foundations, 42 aliases, immutable data and template checks passed.');
