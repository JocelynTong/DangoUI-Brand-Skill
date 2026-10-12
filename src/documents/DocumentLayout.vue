<template>
  <article class="design-document">
    <header class="style-mockup-page"><h2>{{ title }}</h2><p>{{ description }}</p></header>
    <slot />
    <details class="document-evidence"><summary>来源与适配范围</summary><slot name="evidence" /></details>
  </article>
</template>
<script setup>
defineProps({ title: String, description: String });
</script>
