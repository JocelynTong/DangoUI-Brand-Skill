<template>
  <label class="site-theme-control">外观
    <select aria-label="站点外观" :value="preference" @change="setTheme">
      <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">暗黑</option>
    </select>
  </label>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
const preference = ref(window.siteTheme.get());
const sync = () => { preference.value = window.siteTheme.get(); };
const setTheme = event => window.siteTheme.set(event.target.value);
onMounted(() => window.addEventListener('site-theme-change', sync));
onBeforeUnmount(() => window.removeEventListener('site-theme-change', sync));
</script>
