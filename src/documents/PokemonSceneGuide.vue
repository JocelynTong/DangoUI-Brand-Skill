<template>
  <div aria-label="Pokémon 页面使用说明"><section><h3>这页怎么用</h3><p>{{ guide.usage }}</p></section><section><h3>可以操作到哪一步</h3><p>{{ guide.boundary }}</p></section><section><h3>用于真实项目</h3><p>{{ guide.reuse }}</p><a :href="`#/variants/pokemon-tcg-official/components/${guide.component}`">查看相关品牌组合 →</a></section></div>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ scene: String });
const guides = {
  'pokemon-tcg-official-home': {usage:'观察品牌背景、卡面与资讯卡片的主次关系。这里不是实时新闻首页。',boundary:'可以滚动和打开独立预览；导航、轮播指示与行动文字为静态展示，不跳转详情。',reuse:'参考媒体分层与资讯编排。真实内容与路由由项目提供，不把 demo 当成已发布的页面组件。',component:'campaign'},
  'pokemon-tcg-official-learn': {usage:'先看完整卡面，再阅读卡牌结构与场地说明。',boundary:'当前供静态阅读；视频缩略图不播放，标注不展开，资源图不提供下载。',reuse:'图片与解释文字分开维护。真实教学内容、视频与资源入口需另行接入。',component:'card-anatomy'},
  'pokemon-tcg-official-held-out': {usage:'观察同一品牌语言如何组织策略说明。这是虚构 Deck Lab，不是官方产品。',boundary:'只可滚动阅读与打开独立预览。不会搜索、生成策略、保存或调整真实卡组。',reuse:'仅参考舞台、查询布局和说明层级；不携带可用组卡逻辑，也不接入宿主。',component:'query-layout'},
};
const guide = computed(() => guides[props.scene]);
</script>
