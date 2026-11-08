<script setup>
import { computed, ref } from 'vue';

const props = defineProps({ section: { type: Object, required: true } });
const selected = ref('');
const plans = computed(() => props.section.content.plans.filter(plan =>
  !selected.value || plan.conditions.includes(selected.value)
));
</script>

<template>
  <section class="pokemon-db deck-lab" :data-schema-section-id="section.id">
    <h2>{{ section.content.title }}</h2>
    <div class="deck-lab-filters" role="group" aria-label="策略条件">
      <button type="button" :aria-pressed="!selected" @click="selected = ''">全部</button>
      <button v-for="condition in section.content.energyTypes" :key="condition" type="button"
        :aria-pressed="selected === condition" @click="selected = selected === condition ? '' : condition">
        {{ condition }}
      </button>
    </div>
    <p aria-live="polite">{{ plans.length ? plans.length + ' 条策略' : '当前样本没有匹配的策略' }}</p>
    <div class="deck-lab-results">
      <article v-for="plan in plans" :key="plan.title">
        <img :src="section.assets.cards[plan.card].src" :alt="section.assets.cards[plan.card].alt">
        <div><h3>{{ plan.title }}</h3><p>{{ plan.description }}</p></div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.deck-lab h2 { margin:0 0 16px; }
.deck-lab-filters { display:flex; flex-wrap:wrap; gap:8px; }
.deck-lab-filters button { padding:8px 14px; border:1px solid #757575; border-radius:5px; color:#242424; background:white; cursor:pointer; }
.deck-lab-filters button[aria-pressed=true] { background:#252525; color:white; }
.deck-lab-results { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr)); gap:18px; }
.deck-lab-results article { display:flex; align-items:center; gap:16px; background:white; padding:16px; }
.deck-lab-results img { width:37%; max-width:170px; height:auto; }
.deck-lab-results h3 { margin:0; }
.deck-lab-results p { margin:8px 0 0; line-height:1.55; }
</style>
