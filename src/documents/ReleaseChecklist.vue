<template>
  <article class="release-example">
    <DuNavigationBar :back="false" :share="false" center color="site">
      发布清单
      <template #left><a href="#/variants/dango/dango-introduction">返回</a></template>
      <template #right><span class="release-example-muted">演示</span></template>
    </DuNavigationBar>
    <header class="release-example-heading"><p class="release-example-muted">DESIGN → BUILD</p><h2>准备好交付了吗？</h2><p>把视觉、交互与适配检查放在一起，完成后生成本次检查摘要。</p></header>
    <section aria-label="检查进度"><div class="release-example-progress"><strong>已完成 {{ completed }} / {{ checks.length }}</strong><span>{{ completed === checks.length ? '可以生成摘要' : '逐项检查后勾选' }}</span></div><progress :value="completed" :max="checks.length" aria-label="检查完成进度" /></section>
    <fieldset class="release-example-list"><legend>交付前检查</legend><label v-for="item in checks" :key="item.id"><input v-model="item.done" type="checkbox" /><span><strong>{{ item.title }}</strong><small>{{ item.note }}</small></span></label></fieldset>
    <section class="release-example-reminder"><div><h3>离开前提醒</h3><p>演示设置，仅在当前页面会话中保留，不发送通知。</p></div><DuSwitch v-model:on="remind" role="switch" aria-label="离开前提醒" :aria-checked="remind" tabindex="0" @keydown.space.prevent="remind = !remind" @keydown.enter.prevent="remind = !remind" /></section>
    <div class="release-example-actions"><DuButton text="生成检查摘要" @click="summarize" /><DuButton text="重新检查" type="outline" @click="reset" /></div>
    <p role="status" class="release-example-feedback">{{ message }}</p>
    <details class="document-disclosure"><summary>示例范围与使用的组件</summary><p>使用真实 DuNavigationBar、DuButton、DuSwitch 与原生复选框。页面文字、间距和背景使用现有站点主题；组件保留自身配色。本页没有发布接口、消息服务或持久化存储。</p><p>这是 Web 组合验证，不代表小程序适配或所有组件的原生暗色能力已验证。</p></details>
  </article>
</template>
<script setup>
import { computed, ref } from 'vue';
import { DuNavigationBar, DuButton, DuSwitch } from 'dangoui';
const checks = ref([
  { id:'visual', title:'视觉一致', note:'确认颜色、字号与按钮层级遵循同一套规范。', done:false },
  { id:'interaction', title:'交互完整', note:'检查主要操作、键盘访问与反馈文案。', done:false },
  { id:'responsive', title:'适配通过', note:'检查窄屏布局和浅色、暗色下的阅读效果。', done:false },
]);
const remind = ref(true), message = ref('演示页面：不会执行真实发布。');
const completed = computed(() => checks.value.filter(item => item.done).length);
function summarize() { message.value = completed.value === checks.value.length ? `检查摘要：3 项已完成；离开前提醒${remind.value ? '开启' : '关闭'}。未执行发布。` : `还有 ${checks.value.length - completed.value} 项未完成：${checks.value.filter(item => !item.done).map(item => item.title).join('、')}。`; }
function reset() { checks.value.forEach(item => item.done = false); message.value = '已重置检查项。提醒设置保持不变。'; }
</script>
<style scoped>
.release-example { max-width:800px; color:var(--site-text); --du-c-site-navigation-bar-bg:var(--site-bg); --du-c-site-navigation-bar-text:var(--site-text); --du-c-site-navigation-bar-border:var(--site-border); }
.release-example-heading { padding:32px 0 24px; }
.release-example-heading h2 { margin:8px 0 12px; font-size:28px; line-height:1.4; }
.release-example p { font-size:14px; line-height:1.8; }
.release-example-muted,.release-example-heading p,.release-example-reminder p { color:var(--site-muted); }
.release-example a { color:var(--site-accent); }
.release-example-progress { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
.release-example progress { width:100%; height:6px; margin:16px 0 28px; accent-color:var(--site-accent); }
.release-example-list { border:0; padding:0; margin:0; min-width:0; }
.release-example-list legend { font-size:18px; font-weight:600; margin-bottom:8px; }
.release-example-list label { display:flex; gap:14px; align-items:flex-start; padding:20px 0; border-bottom:1px solid var(--site-border); cursor:pointer; }
.release-example-list input { margin-top:4px; accent-color:var(--site-accent); width:18px; height:18px; flex-shrink:0; }
.release-example-list strong { font-size:16px; }
.release-example-list small { display:block; margin-top:6px; color:var(--site-muted); font-size:13px; line-height:1.7; }
.release-example-reminder { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:24px 0; }
.release-example-reminder h3 { margin:0; font-size:16px; }
.release-example-reminder p { margin:6px 0 0; font-size:13px; }
.release-example-actions { display:flex; gap:12px; flex-wrap:wrap; }
.release-example-feedback { min-height:26px; color:var(--site-muted); }
</style>
