<template>
  <DocumentLayout :title="title" :description="description">
    <p v-if="loading" role="status">正在载入品牌示例…</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
    <template v-else>
      <div v-if="target === 'inspector'" class="dango-catalog-grid"><a v-for="item in pokemonCompositions" :key="item.id" class="dango-catalog-entry" :href="`#/variants/pokemon-tcg-official/components/${item.id}`"><strong>{{ item.label }}</strong><span>{{ item.description }} →</span></a></div>
      <template v-else>
        <p class="pk-note">品牌示例保留素材配色；本站说明跟随浅色／暗色。以下组合只演示排版，不提供查询、播放或详情服务。</p>
        <section v-if="['overview','color'].includes(target)" class="pk-palette" aria-label="颜色用途"><article v-for="color in colors" :key="color.value"><i :style="{background:color.value}"></i><h3>{{ color.label }}</h3><code>{{ color.value }}</code></article></section>
        <figure v-if="['overview','campaign'].includes(target)" class="pk-stage"><img class="pk-background" :src="samples.campaign?.background" alt="品牌舞台背景" /><img class="pk-card" :src="samples.campaign?.product?.src" :alt="samples.campaign?.product?.alt" /><figcaption>舞台背景与卡面分层 · 静态展示</figcaption></figure>
        <section v-if="target === 'typography'" class="pk-reading"><small>POKÉMON TRADING CARD GAME</small><h3>认识你的卡牌</h3><p>先看标题，再看卡面，最后阅读规则与说明。</p><small>Card Name · Hit Points · Attacks</small></section>
        <section v-if="target === 'query-layout'" class="pk-reading"><h3>查询字段示意</h3><label v-for="label in ['卡牌名称','卡牌文本','进化来源']" :key="label">{{ label }}<input disabled placeholder="静态字段 · 不可输入" /></label><p>操作区：搜索 / 重置 / 高级筛选（仅展示）</p></section>
        <section v-if="target === 'query-layout'"><h3>能量类型</h3><div class="pk-types"><span v-for="type in samples.types" :key="type">{{ type }}</span></div></section>
        <section v-if="target === 'story-card'" class="pk-stories"><article v-for="story in samples.stories" :key="story.title"><img :src="story.src" :alt="story.title" /><h3>{{ story.title }}</h3><p>静态资讯示例 · 不跳转详情</p></article></section>
        <section v-if="['asset','radius'].includes(target)" class="pk-cards"><figure v-for="card in samples.cards.slice(0,4)" :key="card.src"><img :src="card.src" :alt="card.alt" /><figcaption>{{ card.alt }}</figcaption></figure></section>
        <section v-if="target === 'card-anatomy'" class="pk-anatomy"><img :src="samples.anatomy?.assets?.cards?.[0]?.src" :alt="samples.anatomy?.assets?.cards?.[0]?.alt" /><div><article v-for="item in samples.anatomy?.content?.items" :key="item.title"><h3>{{ item.title }}</h3><p>{{ item.description }}</p></article></div></section>
        <section v-if="target === 'divider'" class="pk-reading"><article v-for="item in samples.anatomy?.content?.items" :key="item.title" class="pk-row"><h3>{{ item.title }}</h3><p>{{ item.description }}</p></article></section>
        <section v-if="target === 'layout'" class="pk-layout"><article v-for="(text,index) in ['舞台：先呈现一个重点','查询：字段与条件分组','讲解：卡面与说明并列']" :key="text"><small>0{{ index+1 }}</small><h3>{{ text }}</h3><p>结构示意，具体尺寸由页面与内容决定。</p></article></section>
        <section v-if="target === 'icon'" class="pk-reading" aria-label="图标资料边界"><h3>品牌图标集尚未整理</h3><p>现有查询预览使用能量类型文字，不等于已提供对应的图标资源。此处不使用其他图形冒充官方能量图标。</p><p>如需图标，仍需确认素材来源、授权与文字标签对应关系；当前可用的是查询页中的文字分类示例。</p><a href="#/variants/pokemon-tcg-official/components/query-layout">查看文字分类示例 →</a></section>
        <section v-if="target === 'spacing'" class="pk-reading" aria-label="间距示意"><h3>同组靠近，组间留白</h3><p>示意值仅用于本站文档，不是已验证的品牌 Token。</p><div style="padding:20px;border:1px dashed currentColor"><strong>第一组标题</strong><p style="margin:8px 0 0">组内间距示意：8px</p><div style="height:32px;border-left:2px dashed currentColor;margin:8px 0"></div><strong>下一组内容</strong><p>组间留白示意：32px；容器内边距示意：20px。</p></div></section>
        <section v-if="target === 'shadow'" class="pk-reading" aria-label="阴影使用边界"><h3>本示例不添加投影</h3><div style="padding:24px;border:1px solid currentColor;box-shadow:none">边界清楚即可，不以投影暗示卡片可点击。</div><p>这是本站示例的处理方式；尚未整理出可复用的品牌阴影参数，不应视为全站禁用阴影的官方规范。</p></section>
        <section v-if="target === 'motion'" class="pk-reading"><h3>静态展示边界</h3><p>首页舞台、查询区、卡面讲解与策略练习只供阅读。不新增自动轮播、动画或展开功能。</p></section>
      </template>
      <details class="document-disclosure"><summary>查看使用说明与实现边界</summary><p>品牌组合来自当前 demo 预览数据，尚非可安装的独立组件。真实数据、查询、路由、媒体播放及平台适配仍由项目负责。</p><p>通用基础组件保留原有示例能力，不代表已经完成 Pokémon 专属适配。素材使用权需另行确认。</p></details>
    </template>
    <template #evidence>以现有 Pokémon demo 为准；不修改品牌学习数据、发布产物或宿主。这里迁移的是展示与阅读方式。</template>
  </DocumentLayout>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import DocumentLayout from './DocumentLayout.vue';
import { pokemonCompositions, pokemonFoundations, pokemonSamples } from './pokemon-document-model.mjs';
const props = defineProps({ section: String, target: String });
const samples = ref(pokemonSamples({})), loading = ref(true), error = ref('');
const entry = computed(() => pokemonCompositions.find(item => item.id === props.target));
const title = computed(() => props.section === 'components' ? entry.value?.label || '品牌组合' : pokemonFoundations[props.target]?.[0] || '视觉总览');
const description = computed(() => props.section === 'components' ? entry.value?.description || '先看页面中的品牌组合，再查看原有基础组件。' : pokemonFoundations[props.target]?.[1]);
const colors = [{value:'#202020',label:'阅读与主要信息'},{value:'#ffffff',label:'局部阅读底面'},{value:'#f3f3f3',label:'辅助背景'}];
async function load(){loading.value=true;error.value='';try{const response=await fetch('/brand-previews/pokemon-tcg-official.json');if(!response.ok)throw Error();samples.value=pokemonSamples(await response.json());}catch{error.value='品牌示例读取失败。';}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.pk-note{color:var(--site-muted);font-size:14px;line-height:1.8}.pk-palette,.pk-layout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:24px 0}.pk-palette i{display:block;height:110px;border:1px solid var(--site-border)}h3{font-size:18px;line-height:1.5}p{line-height:1.8}.pk-stage{position:relative;display:grid;place-items:center;margin:28px 0;background:#202020;overflow:hidden;min-height:300px}.pk-background{position:absolute;width:100%;height:100%;object-fit:cover;opacity:.65}.pk-card{position:relative;height:270px;max-width:70%;object-fit:contain;padding:24px}.pk-stage figcaption{position:relative;background:#202020;color:#fff;padding:12px;width:100%;text-align:center;font-size:13px}.pk-reading{padding:24px;border:1px solid var(--site-border);margin:24px 0}.pk-reading label{display:block;margin:16px 0}.pk-reading input{display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:12px;border:1px solid var(--site-border);background:var(--site-bg);color:var(--site-muted)}.pk-types{display:flex;gap:8px;flex-wrap:wrap}.pk-types span{padding:8px 12px;border:1px solid var(--site-border);font-size:13px}.pk-stories{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.pk-stories img{width:100%;aspect-ratio:16/9;object-fit:contain}.pk-stories p,.pk-layout p{font-size:13px;color:var(--site-muted)}.pk-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.pk-cards figure{margin:0}.pk-cards img{width:100%;height:280px;object-fit:contain}.pk-cards figcaption{font-size:13px;margin-top:12px;text-align:center}.pk-anatomy{display:grid;grid-template-columns:1fr 1fr;gap:28px}.pk-anatomy>img{width:100%;max-height:440px;object-fit:contain}.pk-row+.pk-row,.pk-anatomy article+article{border-top:1px solid var(--site-border)}.pk-layout article{padding:20px;border:1px solid var(--site-border)}@media(max-width:600px){.pk-palette{gap:12px}.pk-palette h3{font-size:14px}.pk-palette code{font-size:12px}.pk-layout,.pk-stories,.pk-anatomy{grid-template-columns:1fr}.pk-cards{gap:12px}.pk-cards img{height:210px}.pk-reading{padding:16px}}
</style>
