<template>
  <App v-if="isInspector" />
  <main v-else class="variant-library" :class="{ 'vl-editorial': !!selected }">
    <header class="vl-header"><a href="#/variants" class="vl-wordmark">DangoUI <span>品牌库</span></a><SiteThemeControl /></header>
    <div v-if="loading" class="vl-message" role="status">正在载入品牌…</div>
    <div v-else-if="error" class="vl-message" role="alert">{{ error }} <button @click="load">重试</button></div>
    <template v-else-if="!selected">
      <section class="vl-intro"><h1>品牌库</h1><p>选择品牌，查看设计系统与页面示例。</p></section>
      <section class="vl-grid" aria-label="品牌 Variant 列表">
        <a v-for="brand in brands" :key="brand.id" :href="`#/variants/${brand.id}`" class="vl-card" :class="`vl-card--${brand.id}`">
          <div class="vl-cover"><img v-if="brand.cover" :src="brand.cover" :alt="`${brand.displayName} 品牌素材`" @error="hideBroken($event, brand.id)"/><div v-else class="vl-typographic">Dango<span>Design → Build</span></div><span v-if="failedCovers[brand.id]" class="vl-media-fallback">{{ brand.displayName }}<small>远程封面暂未载入</small></span><div class="vl-cover-shade"></div><span class="vl-cover-label">{{ brand.hook }}</span></div>
          <div class="vl-card-body"><div class="vl-card-heading"><h2>{{ brand.displayName }}</h2><span>↗</span></div><p>{{ brand.description }}</p><div class="vl-card-meta"><span>{{ brand.scenes.length }} 个演示场景</span><span>{{ brand.publicationStatus === 'draft' ? '学习中' : '预览' }}</span></div></div>
        </a>
      </section><p class="vl-footnote">Web 预览 · 适配与验证范围见各品牌说明。</p>
    </template>
    <template v-else>
      <a class="vl-back" href="#/variants">← 全部品牌</a>
      <section class="vl-brand-heading"><div><h1>{{ selected.displayName }}</h1><p>{{ selected.description }}</p></div><div class="vl-brand-tools"><a :href="selected.sourceUrl">品牌来源 ↗</a></div></section>
      <nav class="vl-primary-nav" aria-label="内容分类" @click="closeMenu">
        <a :href="`#/variants/${selected.id}/${selected.scenes[0].id}`" :aria-current="section === 'pages' ? 'page' : undefined">页面示例</a>
        <a :href="`#/variants/${selected.id}/foundations`" :aria-current="section === 'foundations' ? 'page' : undefined">设计规范</a>
        <a :href="`#/variants/${selected.id}/components`" :aria-current="section === 'components' ? 'page' : undefined">组件</a>
      </nav>
      <div class="vl-workspace">
      <aside class="vl-navigation">
        <button class="vl-menu-toggle" :aria-expanded="menuOpen" aria-controls="brand-directory" @click="menuOpen = !menuOpen">目录 · {{ directoryLabel }} <span>{{ menuOpen ? '−' : '+' }}</span></button>
        <nav id="brand-directory" class="vl-document-nav" :class="{ 'is-open': menuOpen }" aria-label="品牌目录" @click="closeMenu">
          <template v-if="section === 'pages'">
          <a v-for="scene in selected.scenes" :key="scene.id" :href="`#/variants/${selected.id}/${scene.id}`" :aria-current="section === 'pages' && activeScene.id === scene.id ? 'page' : undefined">{{ scene.label }}</a>
          </template>
          <template v-else-if="section === 'foundations'">
          <template v-if="selected.id === 'dango'">
            <a href="#/variants/dango/foundations/color" :aria-current="inlineDocument === 'color' ? 'page' : undefined">颜色</a>
            <a href="#/variants/dango/foundations/typography" :aria-current="inlineDocument === 'typography' ? 'page' : undefined">字体</a>
          </template>
          <a v-else :href="`#/variants/${selected.id}/foundations`" :aria-current="section === 'foundations' && !isDesignSystem ? 'page' : undefined">基础规范</a>
          <a v-if="selected.id === 'onepiece-cardgame'" :href="`#/variants/${selected.id}/design-system`" :aria-current="isDesignSystem ? 'page' : undefined">视觉总览</a>
          </template>
          <template v-else>
          <a v-if="selected.id === 'dango'" href="#/variants/dango/components/button" :aria-current="inlineDocument === 'button' ? 'page' : undefined">按钮</a>
          <template v-if="selected.id === 'dango'">
            <a href="#/variants/dango/components/navigation-bar" :aria-current="inlineDocument === 'navigation-bar' ? 'page' : undefined">导航栏</a>
            <a href="#/variants/dango/components/switch" :aria-current="inlineDocument === 'switch' ? 'page' : undefined">开关</a>
          </template>
          <a :href="`#/variants/${selected.id}/components/inspector`" :aria-current="section === 'components' && !inlineDocument ? 'page' : undefined">组件检查器</a>
          </template>
        </nav>
      </aside>
      <div class="vl-workspace-content">
      <section v-if="section !== 'pages' && !isDesignSystem" class="vl-system" :aria-label="section === 'components' ? '组件文档' : '设计规范'">
        <div v-if="!inlineDocument" class="vl-system-toolbar"><span>{{ section === 'components' ? '组件用法、状态与实现 · 当前品牌' : '颜色、字体与基础规则 · 当前品牌' }}</span><a v-if="selected.id === 'dango' && section === 'components'" :href="`#/variants/dango/components/${routePath.endsWith('/button') ? 'navigation-bar' : 'button'}`">{{ routePath.endsWith('/button') ? '全部组件 →' : '按钮文档试点 →' }}</a><a v-if="selected.id === 'onepiece-cardgame' && section === 'foundations'" :href="`#/variants/${selected.id}/design-system`">视觉总览试点 →</a></div>
        <div v-if="inlineDocument" class="vl-document">
          <ColorDocument v-if="inlineDocument === 'color'" />
          <TypographyDocument v-else-if="inlineDocument === 'typography'" />
          <NavigationDocument v-else-if="inlineDocument === 'navigation-bar'" />
          <SwitchDocument v-else-if="inlineDocument === 'switch'" />
          <ButtonDocument v-else />
        </div>
        <iframe v-else :key="inspectorContentUrl" :src="inspectorContentUrl" :title="`${selected.displayName} · ${section === 'components' ? '组件' : '设计规范'}`"></iframe>
      </section>
      <section v-else-if="isDesignSystem" class="vl-system" aria-label="航海王设计系统">
        <div class="vl-system-toolbar"><a :href="`#/variants/${selected.id}/foundations`">← 规范明细</a><span>视觉总览试点 · 非完整组件文档</span><a :href="designSystemUrl" target="_blank" rel="noopener">独立窗口 ↗</a></div>
        <iframe :src="designSystemUrl" title="航海王设计系统 · 可交互展示"></iframe>
      </section>
      <ReleaseChecklist v-else-if="selected.id === 'dango' && activeScene.id === 'dango-release-checklist'" />
      <div v-else class="vl-detail-grid">
        <section class="vl-preview-column" aria-label="场景预览">
          <div class="vl-preview-toolbar"><div><strong>{{ activeScene.label }}</strong><span>{{ sceneStatus }}</span></div><a :href="previewUrl" target="_blank" rel="noopener">独立预览 ↗</a></div>
          <p v-if="isCatalogScene" class="vl-small" role="note">静态目录示例 · 可滚动浏览，分类、页码与卡片不执行业务操作。</p>
          <div class="vl-preview-stage"><iframe :key="framedPreviewUrl" :src="framedPreviewUrl" :title="`${selected.displayName} · ${activeScene.label}`"></iframe></div>
        </section>
        <aside class="vl-notes">
          <CatalogUsageGuide v-if="isCatalogScene" />
          <SceneUsageGuide v-else-if="hasSceneUsageGuide" :key="activeScene.id" :scene="activeScene.id" />
          <section v-else><h3>场景说明</h3><p>{{ activeScene.note }}</p></section>
          <section><h3>用于我的项目</h3><button class="vl-copy" @click="copyPrompt">{{ copied ? '已复制使用描述' : '复制使用描述' }}</button><textarea v-if="copyFallback" readonly aria-label="使用描述" :value="prompt"></textarea><p class="vl-small" role="status">{{ copyError }}</p></section>
          <details class="vl-evidence"><summary>来源与验证范围</summary><p>{{ selected.publicationStatus === 'draft' ? '此品牌原始资料仍为草稿，视觉验证待完成。' : '沿用原库已记录的学习状态；本次不重新宣称品牌验证通过。' }}</p><p>当前是 Web 品牌库预览，未证明 Taro、真机或任意宿主自动适配。品牌素材的可用范围按原资产声明处理。</p><a :href="selected.path">查看原始品牌记录 ↗</a></details>
        </aside>
      </div>
      </div>
      </div>
    </template>
  </main>
</template>
<script setup>
import {computed,defineAsyncComponent,nextTick,onMounted,onBeforeUnmount,ref,watch} from 'vue';
import ColorDocument from './documents/ColorDocument.vue';
import ButtonDocument from './documents/ButtonDocument.vue';
import TypographyDocument from './documents/TypographyDocument.vue';
import NavigationDocument from './documents/NavigationDocument.vue';
import SwitchDocument from './documents/SwitchDocument.vue';
import ReleaseChecklist from './documents/ReleaseChecklist.vue';
import CatalogUsageGuide from './documents/CatalogUsageGuide.vue';
import SceneUsageGuide from './documents/SceneUsageGuide.vue';
import { canonicalDocumentHash } from './documents/routes.mjs';
const App = defineAsyncComponent(() => import('./App.vue'));
import SiteThemeControl from './SiteThemeControl.vue';
import './variant-library.css';
const isCatalogScene = computed(() => selected.value?.id === 'onepiece-cardgame' && activeScene.value?.id === 'onepiece-cardgame-products');
const hasSceneUsageGuide = computed(() => ['pokemon-tcg-official-card-database', 'czn-character', 'czn-held-out'].includes(activeScene.value?.id));
const menuOpen = ref(false);
function closeMenu(event) { if (event.target.closest('a')) menuOpen.value = false; }
const hash=ref(location.hash),brands=ref([]),loading=ref(true),error=ref(''),copied=ref(false),copyFallback=ref(false),copyError=ref(''),failedCovers=ref({});
const routePath=computed(()=>hash.value.slice(1).split('?')[0]);
const isInspector=computed(()=>routePath.value.startsWith('/brand/'));
const meta={
 'pokemon-tcg-official':{cover:'/assets/brand-assets/pokemon-tcg-official/booster-art-1.jpg',hook:'卡牌、舞台与探索',description:'从品牌舞台进入卡牌世界，再把视觉收进检索与内容层级。',expression:'舞台式主视觉与卡面层次，切换到查询时如何保持清晰的信息入口。',scenes:[['pokemon-tcg-official-home','品牌舞台','source','现有品牌主视觉演示。先感受素材、层次与场景氛围。','品牌表达入口；不是小程序初始化页面。'],['pokemon-tcg-official-card-database','卡牌查询','source','搜索与分类如何进入同一品牌的资料查询页面。','搜索、筛选、结果展示；当前沿用来源查询演示。'],['pokemon-tcg-official-held-out','策略实验室','transfer','既有虚构 Deck Lab，将查询与策略说明组织到新内容中。','查询 + 说明的迁移练习，不是真实卡组数据。'],['pokemon-tcg-official-learn','内容讲解','source','用分段说明与卡牌标注解释玩法。','分步阅读与内容展开。']]},
 'onepiece-cardgame':{cover:'/assets/brand-assets/onepiece-cardgame/source/hero-current-st36.webp',hook:'强对比，出航的节奏',description:'鲜明的图文对比、卡牌视觉与编辑式内容编排。',expression:'品牌图像与黑白控制的对比，如何切换到产品、活动与编辑内容。',scenes:[['onepiece-cardgame-home','品牌舞台','source','已有品牌主页表达，观察图像与内容节奏。','品牌入口演示。'],['onepiece-cardgame-products','卡组浏览','source','分类浏览与产品信息层级。','分类 + 内容卡片。'],['onepiece-cardgame-events','活动发现','source','活动视觉与参与入口的组织。','活动列表与行动入口。'],['onepiece-cardgame-editorial-held-out','航海手记','transfer','既有原创虚构内容练习，展示编辑语言的迁移。','分类 + 编辑式内容编排。']]},
 'czn':{cover:'https://game.gtimg.cn/images/czn/cp/a20250820xnz/20260617/xh_bg.jpg',hook:'暗色场景，角色登场',description:'以大幅媒体、角色层次与空间感承载沉浸表达。',expression:'角色与背景的分层、媒体舞台与时间线。原库 QA 尚待完成。',scenes:[['czn-home','品牌舞台','source','原库媒体首页，先观察视觉表现。','品牌舞台，待完成验证。'],['czn-character','角色档案','source','角色切换与身份信息的关系。','对象切换 + 资料展示。'],['czn-held-out','信号档案','transfer','原库虚构档案迁移练习。','档案切换，待完成验证。']]},
 'dango':{hook:'让结构清晰可读',description:'克制的文档层级、组件表达与清晰的行动反馈。',expression:'文档层级与组件状态如何在新任务里延续。',scenes:[['dango-introduction','设计语言','source','既有设计系统介绍页。','信息层级与说明。'],['dango-button','组件交互','source','直接操作已有按钮与状态示例。','基础交互与反馈。'],['dango-release-checklist','发布清单','transfer','既有新内容练习，观察规则的复用。','清单式任务表达。']]}
};
const selected=computed(()=>brands.value.find(b=>b.id===routePath.value.split('/')[2]));
const section=computed(()=>{
  const part=routePath.value.split('/')[3];
  return part==='components' ? 'components' : !part || ['foundations','design-system'].includes(part) ? 'foundations' : 'pages';
});
const isDesignSystem=computed(()=>selected.value?.id==='onepiece-cardgame' && routePath.value.split('/')[3]==='design-system');
const inlineDocument=computed(()=>{
  if(selected.value?.id !== 'dango') return '';
  const target=routePath.value.split('/')[4];
  if(section.value==='foundations' && target==='typography') return 'typography';
  if(section.value==='foundations' && !isDesignSystem.value && (!target || target==='color')) return 'color';
  return section.value==='components' && ['button', 'navigation-bar', 'switch'].includes(target) ? target : '';
});
const inspectorContentUrl=computed(()=>selected.value?`${location.pathname}?inspectorEmbed=1#/brand/${selected.value.id}/${section.value === 'components' ? 'components/navigation-bar' : `style/${routePath.value.split('/')[4] || 'color'}`}`:'');
const designSystemUrl=new URL('design-system.html',location.href.split('#')[0]).href;
const activeScene=computed(()=>selected.value?.scenes.find(s=>s.id===routePath.value.split('/')[3])||selected.value?.scenes[0]);
const sceneStatus=computed(()=>activeScene.value?.kind === 'transfer' ? '迁移练习 · 示例内容' : '来源参考');
const directoryLabel = computed(() => section.value === 'pages' ? `页面示例 · ${activeScene.value?.label}` : section.value === 'components' ? `组件 · ${({ button: '按钮', 'navigation-bar': '导航栏', switch: '开关' }[inlineDocument.value] || '检查器')}` : `设计规范 · ${isDesignSystem.value ? '视觉总览' : inlineDocument.value === 'typography' ? '字体' : inlineDocument.value === 'color' ? '颜色' : '基础规范'}`);
const previewUrl=computed(()=>selected.value?`${location.pathname}?variantEmbed=1#/brand/${selected.value.id}/pages/${activeScene.value.id}`:'');
const framedPreviewUrl=computed(()=>previewUrl.value.replace('?variantEmbed=1', '?variantEmbed=1&previewFrame=phone'));
const prompt=computed(()=>`请使用 brand skill，为我的项目参考「${selected.value?.displayName}」的视觉语言。我的需求是：[填写你想做的工具与核心操作]。当前参考场景：${activeScene.value?.label}。场景链接：${location.origin}${location.pathname}#/variants/${selected.value?.id}/${activeScene.value?.id}。这是参考 Demo，预览不等于宿主适配或视觉验收通过。请先判断哪些视觉表达适合我的任务，保留真实数据与交互，先给我方案选择。品牌来源：${selected.value?.sourceUrl}` + (isCatalogScene.value ? "\n组件复用范围：优先复用 src/uikit/CatalogProductGrid.mjs、catalog.css 及其 catalog-tokens.css 依赖。保留宿主搜索、筛选、分页、请求与详情路由；将结果数组传入网格。CatalogSection 的分类仅为静态展示。当前仅 Vue Web，不代表 Taro 或完整暗色适配。" : ""));
function changed() {
  const previousPath = routePath.value;
  const canonical = canonicalDocumentHash(location.hash, location.search);
  if (canonical !== location.hash) history.replaceState(null, '', `${location.pathname}${location.search}${canonical}`);
  hash.value = canonical;
  copied.value = false; copyFallback.value = false; copyError.value = ''; menuOpen.value = false;
  if (previousPath === routePath.value) return;
  nextTick(() => window.scrollTo(0, 0));
}
watch(()=>[routePath.value,selected.value?.displayName,activeScene.value?.label],()=>{
  const title=isInspector.value ? '检查器' : selected.value ? `${selected.value.displayName} · ${section.value === 'foundations' ? '设计规范' : section.value === 'components' ? '组件' : activeScene.value.label}` : '品牌场景';
  document.title=`${title} · DangoUI 品牌库`;
},{immediate:true});
function hideBroken(e,id){e.target.style.display='none';failedCovers.value[id]=true;}
async function copyPrompt(){try{await navigator.clipboard.writeText(prompt.value);copied.value=true;}catch{copyFallback.value=true;copyError.value='剪贴板不可用，可从下方选中复制。';}}
async function load(){loading.value=true;error.value='';try{const r=await fetch('/brand-previews/registry.json');if(!r.ok)throw Error();const d=await r.json();brands.value=['pokemon-tcg-official','onepiece-cardgame','czn','dango'].map(id=>{const b=d.brands.find(b=>b.id===id),m=meta[id];return b?{...b,...m,scenes:m.scenes.filter(scene=>scene[0]!=='dango-button' && ['source','transfer'].includes(scene[2])).map(([id,label,kind,note,pattern])=>({id,label,kind,note,pattern}))}:null}).filter(Boolean);}catch{error.value='品牌列表读取失败。';}finally{loading.value=false;}}
onMounted(()=>{window.addEventListener('hashchange',changed);changed();load();});onBeforeUnmount(()=>window.removeEventListener('hashchange',changed));
</script>
