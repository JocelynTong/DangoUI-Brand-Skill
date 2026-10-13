import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse, compileScript } from '@vue/compiler-sfc';

// Default to the checked-out files; optionally verify only the staged snapshot.
const readSource = file => process.env.POKEMON_TEST_INDEX === '1'
  ? execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' })
  : readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = readSource('src/App.vue');
const dataFile = 'public/brand-previews/pokemon-tcg-official.json';
const data = JSON.parse(readSource(dataFile));
const sections = Object.fromEntries(data.pages.flatMap(page => page.sections.map(section => [section.id, section])));
const ids = ['home-campaign-stage', 'home-news-grid', 'learn-card-breakdown', 'learn-field-of-play', 'held-out-deck-briefing'];

test('Pokémon preview sections explicitly declare their static boundaries', () => {
  for (const id of ids) {
    assert.equal(sections[id].content.interactionMode, 'static-evidence-only', id);
    if (id === 'home-campaign-stage') assert.equal(sections[id].content.actions[0].disabled, true);
    else if (id !== 'home-news-grid') assert.equal(sections[id].content.reversibleDetails, false, id);
  }
});

test('hero gates menu, card flip and slide selection, without broadening autoplay', () => {
  const hero = source.slice(source.indexOf('const SchemaBrandHeroSection'), source.indexOf('const SchemaMegaEvolveSection'));
  for (const handler of ['toggleFeaturedCard', 'toggleFeaturedCardFromKeyboard']) assert.ok(hero.includes(`staticOnly ? undefined : ${handler}`));
  assert.match(hero, /onClick: staticOnly \? undefined : \(\) => \{ mobileMenuOpen/);
  assert.match(hero, /onClick: staticOnly \? undefined : \(\) => \{ activeVariant/);
  assert.match(hero, /if \(!isPokemonOfficialHomeHero\) startCycle\(\)/);
});

test('news disables CTAs and all pagination controls; learn uses static body before details', () => {
  for (const cls of ['pokemon-news__cta', 'pokemon-news__more']) assert.match(source, new RegExp(`disabled: staticOnly, class: "${cls}"`));
  assert.match(source, /disabled: staticOnly \|\| newsPage.value === 0/);
  assert.match(source, /disabled: staticOnly \|\| newsPage.value === pageCount - 1/);
  assert.match(source, /onClick: staticOnly \? undefined : \(\) => changeNewsPage\(index\)/);
  assert.match(source, /staticOnly\s*\? \[h\("div", \{ class: "pokemon-learn__static-summary"/);
  assert.match(source, /: content.reversibleDetails === true/);
});

test('Vue implementation compiles', () => {
  assert.ok(compileScript(parse(source).descriptor, { id: 'pokemon-static-minimal' }).content);
});

test('existing query sections retain static mode', () => {
  for (const id of ['card-database-search-shell', 'card-database-search-guidance', 'held-out-deck-query']) {
    assert.equal(sections[id].content.interactionMode, 'static-evidence-only', id);
  }
});
