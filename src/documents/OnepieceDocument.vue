<template>
  <DocumentLayout :title="title" :description="description">
    <p v-if="loading" role="status">正在载入品牌示例…</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
    <template v-else>
      <template v-if="section === 'components' && target === 'inspector'">
        <p class="op-document-note">品牌组合与基础组件分开阅读。下列示例使用现有页面数据，不提供真实查询、购买、报名或新闻详情。</p>
        <div class="dango-catalog-grid"><a v-for="item in onepieceCompositions" :key="item.id" class="dango-catalog-entry" :href="`#/variants/onepiece-cardgame/components/${item.id}`"><strong>{{ item.label }}</strong><span>{{ item.description }} →</span></a></div>
      </template>
      <template v-else>
        <p v-if="section === 'components'" class="op-document-note">静态编排示例 · 保留品牌画面的原始配色，不代表组件支持完整暗色或业务操作。</p>
        <section v-if="['overview','color'].includes(target)" class="op-palette" aria-label="品牌颜色用途">
          <article v-for="color in colors" :key="color.value"><i :style="{background:color.value}"></i><h3>{{ color.label }}</h3><code>{{ color.value }}</code><p>{{ color.note }}</p></article>
        </section>
        <section v-if="['overview','typography'].includes(target)" class="op-specimen op-type">
          <small>ONE PIECE CARD GAME</small><h3>SET SAIL.</h3><p>让标题建立方向，让内容保持清楚。</p><span>ST-36 · STARTER DECK</span>
        </section>
        <p v-if="target === 'typography'" class="op-document-note">示例使用当前系统字体。未把来源站字体下载或授权视为已完成；此处表达层级，不承诺字体复刻。</p>
        <CatalogSection v-if="['catalog','overview'].includes(target)" class="op-product-example" title="PRODUCTS" :items="samples.products.slice(0,4)" :filters="['ALL','BOOSTERS','DECKS']" appearance="onepiece" />
        <section v-if="['news-card','event-card','asset'].includes(target)" class="op-media-grid">
          <article v-for="item in mediaItems" :key="item.title" class="op-specimen op-media-card"><img :src="item.src" :alt="item.title" /><small>{{ item.category }} <span>{{ item.release }}</span></small><h3>{{ item.title }}</h3><p v-if="item.description">{{ item.description }}</p></article>
        </section>
        <figure v-if="target === 'hero'" class="op-specimen op-hero"><img :src="samples.hero?.assets?.background" :alt="samples.hero?.content?.title" /><figcaption><small>{{ samples.hero?.content?.meta }}</small><h3>{{ samples.hero?.content?.title }}</h3><p>独立图片与文字组成，不使用整页截图。</p></figcaption></figure>
        <section v-if="target === 'pagination'" class="op-specimen"><p>分类示意 · 不执行筛选</p><div class="op-static-controls"><span v-for="(item,index) in samples.filters" :key="item" :class="{selected:index===0}">{{ typeof item === 'string' ? item : item.label }}</span></div><p>页码示意 · 不执行翻页</p><div class="op-static-controls" aria-label="静态页码"><span>‹</span><span class="selected">1</span><span>2</span><span>3</span><span>›</span></div></section>
        <section v-if="target === 'divider'" class="op-specimen op-lines"><p>NEWS <small>细线分隔连续阅读</small></p><hr /><p>DECKS <small>ST-36</small></p><hr class="strong" /><p>Yellow Eustass Kid</p></section>
        <section v-if="target === 'layout'" class="op-layout-grid"><article v-for="mode in ['主视觉','资讯列表','商品双列']" :key="mode" class="op-specimen"><h3>{{ mode }}</h3><div :class="['op-layout',{'two':mode==='商品双列','rows':mode==='资讯列表'}]"><span v-for="n in (mode==='主视觉'?1:4)" :key="n">{{ mode==='商品双列'?'商品':mode==='资讯列表'?'图文条目':'活动画面' }}</span></div><p>{{ mode==='主视觉'?'先看一个重点':mode==='资讯列表'?'按顺序连续阅读':'并列比较图片与编号' }}</p></article></section>
        <section v-if="target === 'radius'" class="op-specimen op-shape"><div><strong>PRODUCTS</strong><p>直角图片 · 清晰边界 · 无额外投影</p></div><p>特殊装饰只服务对应模块，不套用到所有容器。</p></section>
        <section v-if="target === 'icon'" class="op-specimen" aria-label="方向符号示意"><h3>方向与外链符号</h3><p>‹ 上一项　／　› 下一项　／　↗ 外部链接</p><p>仅展示符号与文字的对应关系，不可点击。当前未整理独立品牌图标集；这些是本站通用符号，不是官方图标资产。</p></section>
        <section v-if="target === 'spacing'" class="op-specimen" aria-label="间距示意"><h3>同组靠近，组间留白</h3><p>示意值仅用于本站文档，不是已验证的品牌 Token。</p><div style="padding:20px;border:1px dashed currentColor"><strong>第一组标题</strong><p style="margin:8px 0 0">组内间距示意：8px</p><div style="height:32px;border-left:2px dashed currentColor;margin:8px 0"></div><strong>下一组内容</strong><p>组间留白示意：32px；容器内边距示意：20px。</p></div></section>
        <section v-if="target === 'shadow'" class="op-specimen" aria-label="阴影使用边界"><h3>本示例不添加投影</h3><div style="padding:24px;border:1px solid currentColor;box-shadow:none">边界清楚即可，不以投影暗示卡片可点击。</div><p>这是本站示例的处理方式；尚未整理出可复用的品牌阴影参数，不应视为全站禁用阴影的官方规范。</p></section>
        <section v-if="target === 'motion'" class="op-motion"><button @click="feedback = '已触发本地反馈；不会导航或提交。'">体验轻量反馈 →</button><p role="status">{{ feedback }}</p><p>这是本站操作示意，不是官方动效参数；减少动态效果偏好下不播放过渡。</p></section>
        <details class="document-disclosure"><summary>查看使用说明与实现边界</summary><p>{{ section === 'components' ? '保持数据与视觉分离。商品目录复用本站 CatalogSection；其他品牌组合为 demo 展示片段，不宣称独立组件已发布。' : '依据项目已有航海王预览与可见布局整理。色彩用途以当前素材与黑白目录为准，不把旧草稿里的红色或黄色映射推广成全局行动规范。' }}</p><p>本站文档跟随浅色／暗色；标为品牌示例的画面保留来源配色。所有素材的使用权、真实业务接入与平台适配需另行确认。</p></details>
      </template>
    </template>
    <template #evidence>使用现有 onepiece-cardgame 预览数据；没有修改品牌素材、发布产物或宿主。这里只迁移 demo 展示方式。</template>
  </DocumentLayout>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import DocumentLayout from './DocumentLayout.vue';
import CatalogSection from '../uikit/CatalogSection.mjs';
import '../uikit/catalog-section.css';
import '../uikit/catalog.css';
import { onepieceCompositions, onepieceFoundations, onepieceSamples } from './onepiece-document-model.mjs';
const props = defineProps({ section: String, target: String });
const samples = ref({products:[],news:[],events:[],filters:[]}), loading = ref(true), error = ref(''), feedback = ref('点击按钮查看反馈。');
const entry = computed(() => props.section === 'components' ? onepieceCompositions.find(item=>item.id===props.target) : null);
const title = computed(() => props.section === 'components' ? entry.value?.label || '品牌组合' : onepieceFoundations[props.target]?.[0] || '视觉总览');
const description = computed(() => props.section === 'components' ? entry.value?.description || '从真实页面里的视觉组合开始，再查看基础组件示例。' : onepieceFoundations[props.target]?.[1]);
const mediaItems = computed(() => (props.target === 'event-card' ? samples.value.events : samples.value.news).slice(0,3));
const colors = [{value:'#111111',label:'阅读与分类',note:'标题、编号与当前分类。'},{value:'#ffffff',label:'商品底面',note:'保持包装图与信息清晰。'},{value:'#6f6457',label:'辅助信息',note:'现有预览中的次要文字。'},{value:'#fff507',label:'局部黄色',note:'仅限有来源的提示与活动素材。'}];
async function load(){loading.value=true;error.value='';try{const response=await fetch('/brand-previews/onepiece-cardgame.json');if(!response.ok)throw Error();samples.value=onepieceSamples(await response.json());}catch{error.value='品牌示例读取失败。';}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.op-document-note{color:var(--site-muted);font-size:14px;line-height:1.8}.op-palette{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;margin:28px 0}.op-palette i{display:block;height:110px;border:1px solid var(--site-border)}.op-palette h3{font-size:16px}.op-palette p{font-size:13px;line-height:1.7;color:var(--site-muted)}.op-specimen{background:#fff;color:#111;padding:24px;margin:24px 0;border:1px solid var(--site-border)}.op-type h3{font-size:clamp(36px,6vw,64px);line-height:1;margin:24px 0;letter-spacing:-.05em}.op-type small,.op-type span{font-size:12px}.op-media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.op-media-card{margin:0;padding:0 0 20px}.op-media-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:contain;background:#f3f3f3}.op-media-card :is(h3,p,small){margin:16px 18px;display:block}.op-media-card h3{font-size:20px;line-height:1.4}.op-media-card small{font-size:11px}.op-media-card small span{display:block;margin-top:8px}.op-media-card p{font-size:14px;line-height:1.7}.op-hero{padding:0}.op-hero img{display:block;width:100%;max-height:420px;object-fit:contain;background:#111}.op-hero figcaption{padding:24px}.op-static-controls{display:flex;flex-wrap:wrap;gap:8px}.op-static-controls span{padding:12px;border:1px solid #111;font-size:12px}.op-static-controls .selected{background:#111;color:#fff}.op-lines hr{border:0;border-top:1px solid #aaa}.op-lines hr.strong{border-top:3px solid #111}.op-lines small{float:right}.op-layout-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.op-layout{display:grid;gap:8px}.op-layout span{display:grid;place-items:center;min-height:100px;background:#e9e9e9;font-size:12px}.op-layout.two{grid-template-columns:1fr 1fr}.op-layout.rows span{min-height:32px}.op-layout-grid h3{font-size:18px}.op-layout-grid p{font-size:13px}.op-shape>div{padding:36px 20px;border:2px solid #111}.op-motion button{background:var(--site-text);color:var(--site-bg);padding:16px 24px;border:0;cursor:pointer}.op-motion p{font-size:14px;line-height:1.8}.op-product-example{max-width:560px;margin:32px 0}.op-product-example :deep(.tag){display:none}.op-product-example :deep(>strong){font-size:28px}.op-product-example :deep(.catalog-grid){color:#111}.op-product-example :deep(.source-schema-demo__product-art){aspect-ratio:1.4}.op-motion button:active{opacity:.7}@media(max-width:600px){.op-palette{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.op-media-grid,.op-layout-grid{grid-template-columns:1fr}.op-specimen{padding:16px}.op-media-card,.op-hero{padding:0}.op-type h3{font-size:40px}}
</style>
