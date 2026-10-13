<template>
  <DocumentLayout title="Switch · 开关" description="用于立即生效的设置。试着切换通知，看看开启、关闭和不可用时的区别。">
    <section class="switch-document-demo">
      <div class="component-document-control"><span>接收通知</span><DuSwitch v-model:on="enabled" role="switch" aria-label="接收通知" :aria-checked="enabled" tabindex="0" @keydown.space.prevent="enabled = !enabled" @keydown.enter.prevent="enabled = !enabled" /></div>
      <p role="status">当前状态：{{ enabled ? '开启' : '关闭' }}</p>
      <div class="component-document-control"><span>禁用 · 关闭</span><DuSwitch :on="false" disabled role="switch" aria-label="禁用关闭示例" aria-checked="false" aria-disabled="true" /></div>
      <div class="component-document-control"><span>禁用 · 开启</span><DuSwitch :on="true" disabled role="switch" aria-label="禁用开启示例" aria-checked="true" aria-disabled="true" /></div>
    </section>
    <p class="typography-caption">开启后立即生效，不需要再点保存。标注「禁用」的开关不可修改；示例保留组件原始配色。</p>
    <details class="document-disclosure"><summary>查看代码与开发说明</summary><section class="component-document-usage"><pre><code>&lt;DuSwitch v-model:on="enabled" /&gt;
&lt;DuSwitch :on="true" disabled /&gt;</code></pre><p>使用 on / update:on，而不是 modelValue。disabled 保留当前状态并阻止切换。</p></section></details>
    <template #evidence>使用当前 dangoui 包的 DuSwitch。组件根元素是 div；本页额外补充键盘操作与 ARIA 语义，这些不是组件包已内置的能力。未验证小程序触感反馈。</template>
  </DocumentLayout>
</template>
<script setup>
import { ref } from 'vue';
import { DuSwitch } from 'dangoui';
import DocumentLayout from './DocumentLayout.vue';
const enabled = ref(false);
</script>
