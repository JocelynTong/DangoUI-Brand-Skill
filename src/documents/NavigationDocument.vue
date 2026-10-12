<template>
  <DocumentLayout title="NavigationBar · 导航栏" description="页面标题与左右操作区域。这里展示组件本身，不改变站点的导航结构。">
    <section class="component-document-canvas">
      <p class="component-document-caption">调整标题和对齐方式，查看真实组件效果。</p>
      <label class="component-document-control">标题 <input v-model="title" maxlength="24" aria-label="导航示例标题" /></label>
      <label class="component-document-control"><input v-model="center" type="checkbox" /> 标题居中</label>
      <DuNavigationBar :back="false" :share="false" :center="center" color="site">
        <template #left><button type="button" @click="status = '已触发返回示例（不会离开文档）'">返回</button></template>
        {{ title || '页面标题' }}
        <template #right><button type="button" @click="status = '已触发更多示例'">更多</button></template>
      </DuNavigationBar>
      <p role="status">{{ status }}</p>
    </section>
    <details class="document-disclosure"><summary>查看代码与开发说明</summary><section class="component-document-usage"><pre><code>&lt;DuNavigationBar :back="false" :share="false" center color="site"&gt;
  页面标题
  &lt;template #right&gt;右侧操作&lt;/template&gt;
&lt;/DuNavigationBar&gt;</code></pre><p>默认插槽放标题，left / right 插槽放操作。site 是本示例通过 CSS 变量接入的站点颜色，不是组件内置主题；返回按钮仅展示反馈。</p></section></details>
    <template #evidence>使用当前 dangoui 包的 DuNavigationBar。此页验证 Web 标题、居中与插槽，不包含小程序返回、原生分享、状态栏或滚动透明效果的验收。</template>
  </DocumentLayout>
</template>
<script setup>
import { ref } from 'vue';
import { DuNavigationBar } from 'dangoui';
import DocumentLayout from './DocumentLayout.vue';
const title = ref('页面标题'), center = ref(true), status = ref('点击左右操作查看反馈。');
</script>
