<template>
  <App v-if="isInspector" />
  <main v-else class="variant-library">
    <header class="vl-header"><a href="#/variants" class="vl-wordmark">DangoUI <span>Variant 库</span></a><span class="vl-header-note">品牌视觉 × 场景表达</span><a href="#/brand/dango/style/color" class="vl-inspector">风格与组件 ↗</a></header>
    <div v-if="loading" class="vl-message" role="status">正在载入品牌…</div>
    <div v-else-if="error" class="vl-message" role="alert">{{ error }} <button @click="load">重试</button></div>
    <template v-else-if="!selected">
      <section class="vl-intro"><p class="vl-eyebrow">FIND YOUR EXPRESSION</p><h1>先被一种风格打动。<br><span>再看看，它能做什么。</span></h1><p>从品牌出发，探索视觉场景、交互与可迁移的设计语言。</p></section>
      <section class="vl-grid" aria-label="品牌 Variant 列表">
        <a v-for="brand in brands" :key="brand.id" :href="`#/variants/${brand.id}`" class="vl-card" :class="`vl-card--${brand.id}`">
          <div class="vl-cover"><img v-if="brand.cover" :src="brand.cover" :alt="`${brand.displayName} 品牌素材`" @error="hideBroken($event, brand.id)"/><div v-else class="vl-typographic">Dango<span>Design → Build</span></div><span v-if="failedCovers[brand.id]" class="vl-media-fallback">{{ brand.displayName }}<small>远程封面暂未载入</small></span><div class="vl-cover-shade"></div><span class="vl-cover-label">{{ brand.hook }}</span></div>
          <div class="vl-card-body"><div class="vl-card-heading"><h2>{{ brand.displayName }}</h2><span>↗</span></div><p>{{ brand.description }}</p><div class="vl-card-meta"><span>{{ brand.scenes.length }} 个演示场景</span><span>{{ brand.publicationStatus === 'draft' ? '学习中' : '预览' }}</span></div></div>
        </a>
      </section><p class="vl-footnote">品牌入口使用现有素材与运行时。场景记录保留来源与验证边界；预览不等于真实宿主已适配。</p>
    </template>
    <template v-else>
      <a class="vl-back" href="#/variants">← 全部品牌</a>
      <section class="vl-brand-heading"><div><p class="vl-eyebrow">{{ selected.sourceHost }}</p><h1>{{ selected.displayName }}</h1><p>{{ selected.description }}</p></div><a :href="selected.sourceUrl" target="_blank" rel="noopener noreferrer">品牌来源 ↗</a></section>
      <div class="vl-detail-grid"><section class="vl-preview-column"><div class="vl-scenes" aria-label="品牌演示场景"><button v-for="scene in selected.scenes" :key="scene.id" :aria-pressed="activeScene.id === scene.id" @click="chooseScene(scene.id)">{{ scene.label }}</button></div><div class="vl-preview-stage"><iframe :key="previewUrl" :src="previewUrl" :title="`${selected.displayName} · ${activeScene.label}`"></iframe></div><div class="vl-preview-caption"><span>{{ ['pattern','experience'].includes(activeScene.kind) ? '新场景提案 · 本地示例 · 待视觉认可' : activeScene.kind === 'transfer' ? '既有迁移练习 · 示例内容' : '既有来源演示 · 非新 pattern 验收' }}</span><a :href="inspectorUrl" target="_blank" rel="noopener">{{ ['pattern','experience'].includes(activeScene.kind) ? '独立打开 ↗' : '完整检查器 ↗' }}</a></div></section>
      <aside class="vl-notes"><section><p class="vl-eyebrow">IN THIS SCENE</p><h2>{{ activeScene.label }}</h2><p>{{ activeScene.note }}</p></section><section><h3>这次看什么</h3><p>{{ selected.expression }}</p></section><section><h3>{{ activeScene.kind === 'experience' ? '体验怎么展开' : '场景与 pattern 的关系' }}</h3><p>{{ activeScene.pattern }}</p><p class="vl-small">{{ ['pattern','experience'].includes(activeScene.kind) ? activeScene.kind === 'experience' ? '以卡背悬念、翻面节奏、卡面聚光构成一次体验。原创视觉提案，尚待审美验证。' : '新场景以任务为结构、品牌为视觉表达。此版本是本地交互提案，尚非生产资料库。' : '来源演示保留作次级参考，不代表新场景适配。' }}</p></section><section><h3>带着你的想法使用</h3><p>告诉 skill 你想做什么，让它参考这个品牌，判断哪些表达适合你的任务。</p><button class="vl-copy" @click="copyPrompt">{{ copied ? '已复制使用描述' : '复制使用描述' }}</button><textarea v-if="copyFallback" readonly aria-label="使用描述" :value="prompt"></textarea><p class="vl-small" role="status">{{ copyError }}</p></section><details class="vl-evidence"><summary>来源与验证范围</summary><p>{{ selected.publicationStatus === 'draft' ? '此品牌原始资料仍为草稿，视觉验证待完成。' : '沿用原库已记录的学习状态；本次不重新宣称品牌验证通过。' }}</p><p>当前是 Web 品牌库预览，未证明 Taro、真机或任意宿主自动适配。品牌素材的可用范围按原资产声明处理。</p><a :href="selected.path" target="_blank" rel="noopener">查看原始品牌记录 ↗</a></details></aside></div>
    </template>
  </main>
</template>
<script setup>
import {computed,onMounted,onBeforeUnmount,ref} from 'vue';
import App from './App.vue';
import './variant-library.css';
const hash=ref(location.hash),brands=ref([]),loading=ref(true),error=ref(''),copied=ref(false),copyFallback=ref(false),copyError=ref(''),failedCovers=ref({});
const isInspector=computed(()=>hash.value.startsWith('#/brand/'));
const meta={
 'pokemon-tcg-official':{cover:'/assets/brand-assets/pokemon-tcg-official/booster-art-1.jpg',hook:'卡牌、舞台与探索',description:'从品牌舞台进入卡牌世界，再把视觉收进检索与内容层级。',expression:'舞台式主视觉与卡面层次，切换到查询时如何保持清晰的信息入口。',scenes:[['pokemon-home','牌组广场','experience','紧凑的玩家牌组舞台，紧接搜索、分类与结果区。发布入口悬浮于页面右下角。','精选牌组 → 查看构筑；搜索与分类 → 结果。发布入口可填写名称并预览，尚未接入真实投稿与牌组接口。'],['pokemon-reveal','卡牌揭晓','experience','选择一张卡背，亲手揭晓卡面，再细看内容。这个作品围绕一个具体时刻设计，不要求先匹配通用 pattern。','选卡 → 揭晓 → 细看。固定示例、无随机奖励。图鉴查询放在常用场景作为应用参考。'],['pokemon-atlas','图鉴探索','pattern','搜索、属性筛选与卡牌详情组成完整任务；点选卡牌后进入聚光舞台，可翻面与重播登场。','搜索 + 筛选 + 列表 → 详情。独立于官网结构的新交互提案，3 张本地素材示例。'],['pokemon-tcg-official-home','品牌舞台','source','现有品牌主视觉演示。先感受素材、层次与场景氛围。','品牌表达入口；不是小程序初始化页面。'],['pokemon-tcg-official-card-database','卡牌查询','source','搜索与分类如何进入同一品牌的资料查询页面。','搜索、筛选、结果展示；当前沿用来源查询演示。'],['pokemon-tcg-official-held-out','策略实验室','transfer','既有虚构 Deck Lab，将查询与策略说明组织到新内容中。','查询 + 说明的迁移练习，不是真实卡组数据。'],['pokemon-tcg-official-learn','内容讲解','source','用分段说明与卡牌标注解释玩法。','分步阅读与内容展开。']]},
 'onepiece-cardgame':{cover:'/assets/brand-assets/onepiece-cardgame/source/hero-current-st36.webp',hook:'强对比，出航的节奏',description:'鲜明的图文对比、卡牌视觉与编辑式内容编排。',expression:'品牌图像与黑白控制的对比，如何切换到产品、活动与编辑内容。',scenes:[['onepiece-cardgame-home','品牌舞台','source','已有品牌主页表达，观察图像与内容节奏。','品牌入口演示。'],['onepiece-cardgame-products','卡组浏览','source','分类浏览与产品信息层级。','分类 + 内容卡片。'],['onepiece-cardgame-events','活动发现','source','活动视觉与参与入口的组织。','活动列表与行动入口。'],['onepiece-cardgame-editorial-held-out','航海手记','transfer','既有原创虚构内容练习，展示编辑语言的迁移。','分类 + 编辑式内容编排。']]},
 'czn':{cover:'https://game.gtimg.cn/images/czn/cp/a20250820xnz/20260617/xh_bg.jpg',hook:'暗色场景，角色登场',description:'以大幅媒体、角色层次与空间感承载沉浸表达。',expression:'角色与背景的分层、媒体舞台与时间线。原库 QA 尚待完成。',scenes:[['czn-home','品牌舞台','source','原库媒体首页，先观察视觉表现。','品牌舞台，待完成验证。'],['czn-character','角色档案','source','角色切换与身份信息的关系。','对象切换 + 资料展示。'],['czn-held-out','信号档案','transfer','原库虚构档案迁移练习。','档案切换，待完成验证。']]},
 'dango':{hook:'让结构清晰可读',description:'克制的文档层级、组件表达与清晰的行动反馈。',expression:'文档层级与组件状态如何在新任务里延续。',scenes:[['dango-introduction','设计语言','source','既有设计系统介绍页。','信息层级与说明。'],['dango-button','组件交互','source','直接操作已有按钮与状态示例。','基础交互与反馈。'],['dango-release-checklist','发布清单','transfer','既有新内容练习，观察规则的复用。','清单式任务表达。']]}
};
const selected=computed(()=>brands.value.find(b=>b.id===hash.value.split('/')[2]));
const activeScene=computed(()=>selected.value?.scenes.find(s=>s.id===hash.value.split('/')[3])||selected.value?.scenes[0]);
const inspectorUrl=computed(()=>activeScene.value?.id==='pokemon-home'?`${location.pathname}?previewRevision=motion-8#/experience/pokemon-home`:activeScene.value?.id==='pokemon-reveal'?`${location.pathname}#/experience/pokemon-reveal`:activeScene.value?.id==='pokemon-atlas'?`${location.pathname}#/experience/pokemon-atlas`:selected.value?`${location.pathname}#/brand/${selected.value.id}/pages/${activeScene.value.id}`:'');
const previewUrl=computed(()=>activeScene.value?.id==='pokemon-home'?`${location.pathname}?previewRevision=motion-8#/experience/pokemon-home`:activeScene.value?.id==='pokemon-reveal'?`${location.pathname}#/experience/pokemon-reveal`:activeScene.value?.id==='pokemon-atlas'?`${location.pathname}#/experience/pokemon-atlas`:selected.value?`${location.pathname}?variantEmbed=1#/brand/${selected.value.id}/pages/${activeScene.value.id}`:'');
const prompt=computed(()=>` $brand 为我的项目参考「${selected.value?.displayName}」的视觉语言。我的需求是：[填写你想做的工具与核心操作]。当前参考场景：${activeScene.value?.label}。请先判断哪些视觉表达适合我的任务，保留真实数据与交互，不把官网直接缩成小程序。来源：${selected.value?.sourceUrl}。场景链接：${location.href}`);
function chooseScene(id){location.hash=`/variants/${selected.value.id}/${id}`;}
function changed(){hash.value=location.hash;copied.value=false;copyFallback.value=false;copyError.value='';document.title=isInspector.value?'DangoUI Variant · 检查器':'DangoUI Variant 库';}
function hideBroken(e,id){e.target.style.display='none';failedCovers.value[id]=true;}
async function copyPrompt(){try{await navigator.clipboard.writeText(prompt.value);copied.value=true;}catch{copyFallback.value=true;copyError.value='剪贴板不可用，可从下方选中复制。';}}
async function load(){loading.value=true;error.value='';try{const r=await fetch(`${import.meta.env.BASE_URL}brand-previews/registry.json`);if(!r.ok)throw Error();const d=await r.json();brands.value=['pokemon-tcg-official','onepiece-cardgame','czn','dango'].map(id=>{const b=d.brands.find(b=>b.id===id),m=meta[id];return b?{...b,...m,cover:m.cover?.startsWith('/') ? import.meta.env.BASE_URL + m.cover.slice(1) : m.cover,path:b.path?.startsWith('/') ? import.meta.env.BASE_URL + b.path.slice(1) : b.path,scenes:m.scenes.filter(scene=>['source','transfer'].includes(scene[2])).map(([id,label,kind,note,pattern])=>({id,label,kind,note,pattern}))}:null}).filter(Boolean);}catch{error.value='品牌列表读取失败。';}finally{loading.value=false;}}
onMounted(()=>{window.addEventListener('hashchange',changed);changed();load();});onBeforeUnmount(()=>window.removeEventListener('hashchange',changed));
</script>
