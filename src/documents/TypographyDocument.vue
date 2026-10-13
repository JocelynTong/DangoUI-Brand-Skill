<template>
  <DocumentLayout title="Typography · 字体" description="H 标题、B 强调正文、N 普通正文。这里展示现有字号规范，不把品牌字体资产当成通用 Token。">
    <section class="typography-reading">
      <h3>先看看阅读效果</h3>
      <label>示例文字 <input v-model="sample" maxlength="120" aria-label="字体示例文字" /></label>
      <p v-for="item in readingStyles" :key="item.title" :style="{ fontSize: item.size + 'px', lineHeight: item.lineHeight + 'px', fontWeight: item.weight }">{{ item.title }} · {{ sample || '从规则到真实界面' }}</p>
    </section>
    <section class="typography-scale">
      <h3>字号与字重对照</h3>
      <p class="typography-caption">H / B / N 分别使用 700、500、400 字重；同级字号与行高一致。数字表示字号 / 行高，单位 px。</p>
      <TypographyMatrix />
    </section>
    <template #evidence>复用原检查器的 H/B/N 规范：8 档字号与行高、3 档字重。当前使用系统字体回退，不新增字体下载，也不宣称字体族已接入完整 Token 流程。</template>
  </DocumentLayout>
</template>
<script setup>
import { ref } from 'vue';
import DocumentLayout from './DocumentLayout.vue';
import TypographyMatrix from './TypographyMatrix.vue';
import { typographyGroups } from './typography-model.mjs';
const sample = ref('从规则到真实界面 / Design to build');
const readingStyles = [typographyGroups[0].items[2], typographyGroups[1].items[5], typographyGroups[2].items[6]];
</script>
