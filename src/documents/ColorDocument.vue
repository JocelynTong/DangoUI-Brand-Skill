<template>
  <DocumentLayout title="Color · 颜色" description="浏览品牌的基础色彩，点击色块即可复制。色值保持不变；色块中的棋盘底表示透明度。">
    <p v-if="loading" role="status">正在读取颜色规范…</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
    <template v-else>
      <section class="reference-palette" aria-label="基础色阶">
        <section v-for="family in palettes" :key="family.family" class="reference-palette-family">
          <header><h3>{{ familyNames[family.family] || family.family }} <small>{{ family.family }}</small></h3><span>{{ family.family === 'purple' ? '品牌紫 · 从浅色到深色' : ['neutral', 'white'].includes(family.family) ? '透明度色阶 · 棋盘底用于观察透明度' : '基础色阶 · 从浅色到深色' }}</span></header>
          <div class="reference-palette-scale">
            <button v-for="step in family.steps" :key="step.name" type="button" :aria-label="`复制 ${step.name} ${step.value}`" :class="{ 'is-copied': copied === step.value }" @click="copyColor(step.value)">
              <i :style="{ '--swatch': step.swatch }"></i>
              <span>{{ step.label }}</span><code>{{ step.displayValue }}</code>
            </button>
          </div>
        </section>
      </section>
      <details class="document-disclosure"><summary>查看颜色用途与组件映射</summary>
        <ColorInventory :rows="rows.filter(group => group.variant !== 'paletteRows')" :copied-color-value="copied" @copy="copyColor" />
      </details>
    </template>
    <p class="document-copy-status" role="status">{{ status }}</p>
    <label v-if="fallback">手动复制色值 <input readonly :value="fallback" @focus="$event.target.select()" /></label>
    <template #evidence>数据来自项目的 dangoui.design-system.json 快照；色板、语义解析和组件映射与旧检查器共用同一模型，不代表已完成其他品牌或平台适配。</template>
  </DocumentLayout>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue';
import DocumentLayout from './DocumentLayout.vue';
import ColorInventory from './ColorInventory.vue';
import { buildColorStructure } from './color-model.mjs';
import catalogUrl from '../../data/dangoui.design-system.json?url';
const rows = ref([]), loading = ref(true), error = ref(''), copied = ref(''), status = ref(''), fallback = ref('');
const familyNames = { purple: '紫色', purplegray: '紫灰', neutral: '中性黑', white: '中性白', blue: '蓝色', red: '红色', green: '绿色', orange: '橙色', yellow: '黄色', tendershoots: '嫩芽绿', turquoise: '绿松石', grape: '葡萄紫', zimablue: '青蓝' };
const palettes = computed(() => {
  const items = rows.value.find(group => group.variant === 'paletteRows')?.items || [];
  const rank = family => family === 'purple' ? 0 : ['purplegray', 'neutral', 'white'].includes(family) ? 2 : 1;
  return [...items].sort((a, b) => rank(a.family) - rank(b.family));
});
async function load() {
  loading.value = true; error.value = '';
  try {
    const response = await fetch(catalogUrl);
    if (!response.ok) throw new Error();
    rows.value = buildColorStructure(await response.json());
  } catch { error.value = '颜色规范读取失败。'; }
  finally { loading.value = false; }
}
async function copyColor(value) {
  fallback.value = ''; copied.value = '';
  try { await navigator.clipboard.writeText(value); copied.value = value; status.value = `已复制 ${value}`; }
  catch { fallback.value = value; status.value = '剪贴板不可用，请手动复制。'; }
}
onMounted(load);
</script>
