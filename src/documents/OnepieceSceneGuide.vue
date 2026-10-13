<template><div aria-label="航海王页面使用说明"><section><h3>这页怎么用</h3><p>{{ guide.usage }}</p></section><section><h3>可以操作到哪一步</h3><p>{{ guide.boundary }}</p></section><section><h3>用于真实项目</h3><p>{{ guide.reuse }}</p><p>当前是 demo 页面编排，不是可安装的完整页面组件；真实数据、详情与业务操作由项目提供。</p></section></div></template>
<script setup>
import { computed } from 'vue';
const props=defineProps({scene:String});
const guides={
  'onepiece-cardgame-home':{usage:'先看主视觉，再看商品、资讯与活动的主次顺序。',boundary:'商品与活动入口打开本站示例，不进入具体详情；没有对应页面的内容仅展示。外部资源链接会离开本站。',reuse:'参考主视觉、商品网格与内容区块的排列；保留项目已有的导航与详情路由。'},
  'onepiece-cardgame-events':{usage:'比较不同活动的图片、标题与介绍如何组成连续列表。',boundary:'可以滚动和打开独立预览。卡片及 TRY PLAYING 等行动文字仅展示，不报名、不查询、不打开活动详情。',reuse:'参考活动卡片的信息层级，真实活动数据、报名与状态由项目接入。'},
  'onepiece-cardgame-editorial-held-out':{usage:'观察编辑式标题、图片与文章摘要如何延续品牌表达；航海手记为原创虚构练习，不是官方资讯。',boundary:'可以滚动和打开独立预览。内容仅作编排示例，不提供真实文章详情、订阅或实时资讯服务。',reuse:'参考图文节奏与文章层级，不把虚构内容作为业务数据；真实文章、分类和详情路由由项目提供。'},
};
const guide=computed(()=>guides[props.scene]);
</script>
