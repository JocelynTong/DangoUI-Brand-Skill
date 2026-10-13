<template>
  <DocumentLayout :title="title" description="先看用途，再打开示例。所有组件都在同一套目录里，不再进入另一层检查器。">
    <p class="dango-catalog-note">示例保留现有能力：真实组件可以试用；组合样式和静态示意不代表已有业务功能。代码与属性说明收在详情里。</p>
    <section class="dango-catalog-group"><h3>基础操作</h3><a class="dango-catalog-entry" :href="`#/variants/${brand}/components/button`"><strong>按钮</strong><span>提交、确认与主要行动 →</span></a></section>
    <section v-for="group in componentCategorySpecs" :key="group.id" class="dango-catalog-group">
      <h3>{{ group.label }}</h3><p>{{ group.description }}</p>
      <div class="dango-catalog-grid"><a v-for="name in group.components" :key="name" class="dango-catalog-entry" :href="`#/variants/${brand}/components/${componentSlug(name)}`"><strong>{{ componentLabels[name] }}</strong><span>{{ name }} →</span></a></div>
    </section>
    <template #evidence>目录覆盖原检查器的四组组件及按钮文档。迁移的是本站的展示与浏览方式，不修改组件包，也不新增宿主能力。</template>
  </DocumentLayout>
</template>
<script setup>
defineProps({ brand: { type: String, default: 'dango' }, title: { type: String, default: '组件一览' } });
import DocumentLayout from './DocumentLayout.vue';
import { componentCategorySpecs, componentLabels, componentSlug } from './dango-catalog.mjs';
</script>
