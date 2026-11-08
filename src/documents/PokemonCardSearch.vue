<script setup>
import { computed, reactive, ref } from 'vue';

const props = defineProps({ cards: Array, energyTypes: Array, title: String });
const blank = () => ({ name: '', text: '', evolves: '' });
const fields = reactive(blank());
const applied = ref(blank());
const energy = ref('');
const includes = (value, query) => value.toLowerCase().includes(query.trim().toLowerCase());
const results = computed(() => props.cards.filter(card =>
  includes(card.title + ' ' + card.number, applied.value.name) &&
  includes(card.text, applied.value.text) &&
  includes(card.evolvesFrom || '', applied.value.evolves) &&
  (!energy.value || card.energy === energy.value)
));
function search() { applied.value = { ...fields }; }
function reset() {
  Object.assign(fields, blank());
  energy.value = '';
  search();
}
</script>
<template>
  <header class="pokemon-db__title-plate">
    <img src="/assets/brand-assets/pokemon-tcg-official/tcg-logo.png" alt="Pokémon Trading Card Game">
    <h1>{{ title }}</h1>
  </header>
  <form class="pokemon-db__search" @submit.prevent="search">
    <div class="pokemon-db__field-grid">
      <label><span>Card Name</span><input v-model="fields.name" type="search" placeholder="卡名或编号"></label>
      <label><span>Card Text</span><input v-model="fields.text" type="search" placeholder="卡面文字"></label>
      <label><span>Evolves From</span><input v-model="fields.evolves" type="search" placeholder="进化来源"></label>
    </div>
    <fieldset class="pokemon-db__energy"><legend>Energy Type</legend>
      <button v-for="type in energyTypes" :key="type" type="button" :class="{ 'is-selected': energy === type }" :aria-pressed="energy === type" @click="energy = energy === type ? '' : type">{{ type }}</button>
    </fieldset>
    <div class="pokemon-db__actions">
      <button type="button" class="pokemon-db__reset" @click="reset">Reset</button>
      <button class="pokemon-db__submit" type="submit">Search</button>
    </div>
  </form>
  <section class="local-card-results">
    <h2 aria-live="polite">本地卡牌 · {{ results.length }} 张</h2>
    <div v-if="results.length" class="local-card-grid">
      <figure v-for="card in results" :key="card.number">
        <img :src="card.src" :alt="card.title"><figcaption>{{ card.title }} · {{ card.number }}</figcaption>
      </figure>
    </div>
    <p v-else>没有匹配的卡牌</p>
  </section>
</template>
<style scoped>
.local-card-results { padding:24px; background:white; color:#242424; }
.local-card-results h2 { margin:0 0 16px; font-size:20px; }
.local-card-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; }
.local-card-grid figure { margin:0; }
.local-card-grid img { width:100%; height:auto; display:block; }
.local-card-grid figcaption { margin-top:6px; font-weight:600; }
@container pokemon-current-demo (max-width: 519px) {
  .local-card-results { padding:16px; }
  .local-card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
}
</style>
