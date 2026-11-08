<script setup>
import { computed, ref } from 'vue';
const props = defineProps({ section: { type: Object, required: true } });
const selected = ref(0);
const items = computed(() => props.section.content.items);
const current = computed(() => items.value[selected.value]);
const picture = computed(() => props.section.assets.cards[current.value.image]);
function bounds([x, y, width, height]) {
  return { left:x+'%', top:y+'%', width:width+'%', height:height+'%' };
}
</script>
<template>
  <section class="pokemon-learn" :class="'schema-recipe--' + section.recipe" :data-schema-section-id="section.id">
    <header><span>{{ section.content.kicker }}</span><h2>{{ section.content.title }}</h2></header>
    <div class="lesson-layout">
      <div class="lesson-picture">
        <img :src="picture.src" :alt="picture.alt">
        <button v-for="(part, index) in items" :key="part.title" type="button"
          :style="bounds(part.region)" :aria-label="part.title" :aria-pressed="selected === index"
          @click="selected = index"></button>
      </div>
      <div>
        <div class="lesson-options" role="group" :aria-label="section.content.title">
          <button v-for="(part, index) in items" :key="part.title" type="button"
            :aria-pressed="selected === index" @click="selected = index">{{ part.title }}</button>
        </div>
        <p aria-live="polite">{{ current.description }}</p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.lesson-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); align-items:center; gap:32px; margin-top:24px; }
.lesson-picture { position:relative; width:min(100%,320px); justify-self:center; }
.lesson-picture img { display:block; width:100%; height:auto; }
.lesson-picture button { position:absolute; background:transparent; border:0; padding:0; cursor:pointer; border-radius:4px; }
.lesson-picture button:is(:hover,:focus-visible,[aria-pressed=true]) { outline:3px solid #161619; box-shadow:inset 0 0 0 2px white; }
.lesson-options { display:flex; flex-wrap:wrap; gap:8px; }
.lesson-options button { background:transparent; color:inherit; border:1px solid currentColor; border-radius:6px; padding:8px 14px; cursor:pointer; }
.lesson-options button[aria-pressed=true] { background:white; color:#171717; border-color:#171717; box-shadow:0 2px 0 #171717; }
.lesson-layout p { line-height:1.65; }
@container pokemon-current-demo (max-width:699px) {
  .lesson-layout { grid-template-columns:minmax(0,1fr); gap:16px; }
  .lesson-picture { max-width:250px; }
}
</style>
