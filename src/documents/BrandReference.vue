<script setup>
import { ref } from 'vue';
defineProps({ brand: String, page: Object, topic: String, coverage: String });
const category = ref('新闻');
const labels = { verified:'已验证', observed:'已观察', scoped:'限域使用', partial:'部分验证', pending:'待确认', rework:'待修正', missing:'待补' };
</script>
<template>
  <article class="reference">
    <h2>{{ page.label }}</h2>
    <div v-if="page.colors" class="swatches">
      <section v-for="color in page.colors" :key="color.label">
        <i :style="{ background:color.value }"></i><h3>{{ color.label }}</h3>
        <code>{{ color.value }}</code><p>{{ color.scope }}</p><small>{{ labels[color.status] }}</small>
      </section>
    </div>
    <section v-for="row in page.rows" :key="row.title" class="rule">
      <small>{{ labels[row.status] }}</small><h3>{{ row.title }}</h3><p>{{ row.text }}</p>
    </section>
    <div v-if="brand === 'duolingo-official' && ['button','input','card'].includes(topic)" class="du-specimen">
      <template v-if="topic === 'button'"><button>继续</button><button class="secondary">稍后处理</button></template>
      <label v-else-if="topic === 'input'">任务名称<input value="内容审核"></label>
      <article v-else><small>待处理任务</small><h3>品牌规范复核</h3><p>今天 14:30 提交</p></article>
    </div>
    <div v-if="brand === 're1999' && topic === 'button'" class="r99-specimen">
      <button v-for="name in ['新闻','公告','活动']" :key="name" :class="{active:category===name}" :aria-pressed="category===name" @click="category=name">{{ name }}</button>
    </div>
    <details><summary>适用范围</summary><p>{{ coverage }}</p></details>
  </article>
</template>
<style scoped>
.reference { color:var(--site-text); padding:12px 0 32px; }
.reference h2 { margin:0 0 24px; font-size:28px; }
.reference h3 { margin:10px 0; font-size:17px; }
.reference p { line-height:1.65; margin:8px 0; }
.reference small,.reference details { color:var(--site-muted); }
.reference details { margin-top:24px; }
.swatches { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr)); gap:22px; }
.swatches i { display:block;height:82px;border:1px solid var(--site-border);border-radius:8px; }
.rule {padding:12px 0;border-bottom:1px solid var(--site-border);}
.du-specimen { display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:24px; background:#f7f7f7; color:#3c3c3c; }
.r99-specimen { display:flex; flex-wrap:wrap; gap:24px; padding:24px; background:#090a0a; }
.du-specimen button{min-width:150px;padding:14px 24px;border:0;border-radius:12px;background:#58cc02;color:#fff;font-weight:800;box-shadow:0 4px 0 #58a700}
.du-specimen button.secondary{background:#fff;color:#3c3c3c;border:2px solid #e5e5e5;box-shadow:0 2px 0 #e5e5e5}
.du-specimen label{display:grid;gap:8px;font-weight:700}
.du-specimen input{height:48px;min-width:260px;padding:8px 14px;border:2px solid #e5e5e5;border-radius:12px;background:#fff;font-size:17px}
.du-specimen article{max-width:420px;padding:18px 18px 28px;border:2px solid #e5e5e5;border-radius:16px;background:#fff;box-shadow:0 4px 0 #e5e5e5}
.du-specimen article h3{margin:8px 0}
.du-specimen article p{line-height:1.6;color:#777}
.r99-specimen button{border:0;border-bottom:1px solid #e9dccd;background:transparent;color:#e9dccd;padding:10px 2px;font-family:Georgia,serif}
.r99-specimen button.active{border-color:#b55829;color:#b55829}
</style>
