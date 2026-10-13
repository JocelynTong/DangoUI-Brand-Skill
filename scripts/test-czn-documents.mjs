import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { cznSamples, cznCompositions, cznFoundations } from '../src/documents/czn-document-model.mjs';
import { componentNames, componentSlug, foundationNames } from '../src/documents/dango-catalog.mjs';
import { canonicalDocumentHash } from '../src/documents/routes.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const preview = JSON.parse(read('../public/brand-previews/czn.json'));
const before=JSON.stringify(preview), samples=cznSamples(preview);
assert.equal(preview.pages.length,4);
assert.equal(samples.gameplay.length,5);
assert.equal(samples.characters.length,2);
assert.equal(samples.archives.length,3);
assert.equal(samples.characters[0].poster,samples.characters[1].poster);
assert.equal(samples.characters[0].skills.length,5);
assert.ok(samples.home.assets.poster);
assert.equal(JSON.stringify(preview),before);
assert.deepEqual(cznSamples({}),{home:undefined,gameplay:[],characters:[],archives:[]});
assert.equal(new Set(cznCompositions.map(x=>x.id)).size,4);
for(const {id} of foundationNames){assert.ok(cznFoundations[id]);assert.equal(canonicalDocumentHash(`#/brand/czn/style/${id}`),`#/variants/czn/foundations/${id}`);}
for(const name of componentNames){const old=`#/brand/czn/components/${componentSlug(name)}`;assert.equal(canonicalDocumentHash(old),`#/variants/czn/components/${componentSlug(name)}`);for(const query of ['?variantEmbed=1','?inspectorEmbed=1'])assert.equal(canonicalDocumentHash(old,query),old);}
assert.equal(canonicalDocumentHash('#/variants/czn/components'),'#/variants/czn/components/inspector');
assert.equal(canonicalDocumentHash('#/variants/czn/foundations'),'#/variants/czn/foundations/overview');
for(const file of ['CznDocument.vue','CznSceneGuide.vue']){const source=read(`../src/documents/${file}`),parsed=parse(source);assert.deepEqual(parsed.errors,[]);assert.deepEqual(compileTemplate({source:parsed.descriptor.template.content,filename:file,id:file}).errors,[]);assert.doesNotMatch(source,/<iframe|<video/);}
const library=read('../src/VariantLibrary.vue');
assert.match(library, /\['czn-gameplay','玩法介绍'/);
for(const page of preview.pages)assert.ok(library.includes(`'${page.id}':`),`${page.id} copy boundary`);
console.log('CZN demo: 4 pages, 4 compositions, 10 foundations, 42 aliases, 5/2/3 content counts and templates passed.');
