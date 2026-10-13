import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { canonicalDocumentHash, invalidFoundationHash } from '../src/documents/routes.mjs';
import { foundationNames } from '../src/documents/dango-catalog.mjs';
for (const brand of ['dango','onepiece-cardgame','pokemon-tcg-official','czn']) {
  const base=`#/variants/${brand}/foundations`;
  assert.equal(invalidFoundationHash(base),false);
  for(const {id} of foundationNames)assert.equal(invalidFoundationHash(`${base}/${id}`),false);
  assert.equal(invalidFoundationHash(`${base}/not-a-document`),true);
  assert.equal(invalidFoundationHash(`${base}/color/extra`),true);
  assert.equal(invalidFoundationHash(`${base}/overview`),brand==='dango');
  assert.equal(invalidFoundationHash(canonicalDocumentHash(base)),false);
}
assert.equal(invalidFoundationHash('#/variants/czn/czn-home'),false);
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
for(const file of ['OnepieceDocument.vue','PokemonDocument.vue','CznDocument.vue','OnepieceSceneGuide.vue']){
  const source=read(`../src/documents/${file}`),parsed=parse(source);
  assert.deepEqual(parsed.errors,[]);
  assert.deepEqual(compileTemplate({source:parsed.descriptor.template.content,filename:file,id:file}).errors,[]);
  if(file!=='OnepieceSceneGuide.vue'){
    assert.match(source,/aria-label="间距示意"/);
    assert.match(source,/aria-label="阴影使用边界"/);
    assert.doesNotMatch(source,/\['layout','spacing'\]|\['divider','shadow'\]|\['radius','shadow'\]/);
  }
}
assert.doesNotMatch(read('../src/documents/OnepieceDocument.vue'),/\['icon','pagination'\]/);
assert.doesNotMatch(read('../src/documents/PokemonDocument.vue'),/\['query-layout','icon'\]/);
const guide=read('../src/documents/OnepieceSceneGuide.vue');
for(const scene of ['home','events','editorial-held-out'])assert.ok(guide.includes(`onepiece-cardgame-${scene}`));
for(const title of ['这页怎么用','可以操作到哪一步','用于真实项目'])assert.ok(guide.includes(title));
const library=read('../src/VariantLibrary.vue');
assert.match(library,/v-else-if="invalidFoundation"/);
assert.match(library,/返回设计规范/);
assert.match(library,/'onepiece-cardgame-editorial-held-out':/);
console.log('Demo consistency: foundation validation, distinct examples, page guides and templates passed.');
