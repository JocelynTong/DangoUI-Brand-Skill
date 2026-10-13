<template>
  <DocumentLayout :title="title" :description="description">
    <p v-if="loading" role="status">正在载入品牌示例…</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
    <template v-else>
      <div v-if="target === 'inspector'" class="dango-catalog-grid"><a v-for="item in cznCompositions" :key="item.id" class="dango-catalog-entry" :href="`#/variants/czn/components/${item.id}`"><strong>{{ item.label }}</strong><span>{{ item.description }} →</span></a></div>
      <template v-else>
        <p class="cz-note">品牌画面保留暗色配色；本站说明跟随浅色／暗色。以下为静态展示，交互请查看页面示例。</p>
        <section v-if="['overview','color'].includes(target)" class="cz-palette" aria-label="颜色用途"><article v-for="color in colors" :key="color.value"><i :style="{background:color.value}"></i><h3>{{ color.label }}</h3><code>{{ color.value }}</code></article></section>
        <figure v-if="['overview','media-stage'].includes(target)" class="cz-stage"><img :src="samples.home?.assets?.poster" alt="CZN 首页媒体封面" /><figcaption>媒体舞台 · 静态封面，不播放视频</figcaption></figure>
        <section v-if="target === 'typography'" class="cz-specimen"><small>CHARACTER / PROFILE</small><h3 class="cz-title">阿拉贝拉</h3><p>角色身份是标题，状态说明是正文，英文标识用于辅助定位。</p></section>
        <section v-if="['character-profile','asset','radius'].includes(target)" class="cz-profile"><img :src="samples.characters[0]?.poster" :alt="samples.characters[0]?.name" /><div><article v-for="item in samples.characters" :key="item.name"><h3>{{ item.name }}</h3><small>{{ item.voice }}</small><p>{{ item.description }}</p></article><p class="cz-note">同一角色的两个演示状态，共用媒体，不代表两位角色。</p></div></section>
        <section v-if="['skill-list','icon'].includes(target)" class="cz-skills"><article v-for="skill in samples.characters[0]?.skills" :key="skill.name"><img :src="skill.src" :alt="skill.name" /><h3>{{ skill.name }}</h3><p>仅展示 · 无详情操作</p></article></section>
        <section v-if="['archive-timeline','divider','shadow'].includes(target)" class="cz-archive"><p>虚构信号档案 · 非官方内容</p><article v-for="(item,index) in samples.archives" :key="item.title"><small>{{ String(index+1).padStart(2,'0') }} / {{ String(samples.archives.length).padStart(2,'0') }}</small><h3>{{ item.title }}</h3><p>{{ item.description }}</p></article></section>
        <section v-if="['layout','spacing'].includes(target)" class="cz-layout"><article v-for="text in ['背景与主体分层','身份与状态说明','技能与序号定位']" :key="text"><h3>{{ text }}</h3><p>结构示意：手机下顺序阅读，宽屏下并列安排。</p></article></section>
        <section v-if="target === 'motion'" class="cz-specimen"><h3>媒体与切换的边界</h3><p>首页视频受网络和自动播放策略影响；角色支持两个状态，玩法支持五项内容，信号档案支持三项循环切换。文档本身不播放视频、不新增交互。</p></section>
      </template>
      <details class="document-disclosure"><summary>查看使用说明与实现边界</summary><p>品牌组合是 demo 片段，尚非可安装组件。通用基础组件不代表完整 CZN 品牌适配；真实数据、详情、下载、音频和平台适配由项目负责。</p><p>外链素材的可用性与使用权需另行确认。本次迁移不等于原品牌学习 QA、断网或视频失败兜底已全部通过。</p></details>
    </template>
    <template #evidence>使用现有 CZN 预览数据与素材，不修改品牌学习结果、宿主或发布工具。</template>
  </DocumentLayout>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import DocumentLayout from './DocumentLayout.vue';
import { cznCompositions, cznFoundations, cznSamples } from './czn-document-model.mjs';
const props = defineProps({section:String,target:String});
const samples=ref(cznSamples({})),loading=ref(true),error=ref('');
const entry=computed(()=>cznCompositions.find(item=>item.id===props.target));
const title=computed(()=>props.section==='components'?entry.value?.label||'品牌组合':cznFoundations[props.target]?.[0]||'视觉总览');
const description=computed(()=>props.section==='components'?entry.value?.description||'先看品牌组合，再查看原有基础组件。':cznFoundations[props.target]?.[1]);
const colors=[{value:'#080609',label:'深色舞台'},{value:'#140b10',label:'次级背景'},{value:'#f4f1ed',label:'主要文字'},{value:'#ff5514',label:'局部导航标记'}];
async function load(){loading.value=true;error.value='';try{const response=await fetch('/brand-previews/czn.json');if(!response.ok)throw Error();samples.value=cznSamples(await response.json());}catch{error.value='品牌示例读取失败。';}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.cz-note{color:var(--site-muted);font-size:14px;line-height:1.8}h3{font-size:18px;line-height:1.5}p{line-height:1.8}.cz-palette{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;margin:24px 0}.cz-palette i{display:block;height:110px;border:1px solid var(--site-border)}.cz-stage{margin:28px 0;background:#080609;color:#f4f1ed}.cz-stage img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.cz-stage figcaption{padding:16px;font-size:13px}.cz-specimen{padding:28px;background:#080609;color:#f4f1ed;margin:24px 0}.cz-title{font-size:40px}.cz-profile{display:grid;grid-template-columns:1fr 1fr;gap:28px}.cz-profile>img{width:100%;max-height:460px;object-fit:contain;background:#080609}.cz-profile article+article{border-top:1px solid var(--site-border)}.cz-skills{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.cz-skills img{width:100%;height:110px;object-fit:contain;background:#140b10}.cz-skills p{font-size:13px;color:var(--site-muted)}.cz-archive article{padding:16px 0;border-top:1px solid var(--site-border)}.cz-archive small{color:var(--site-muted)}.cz-layout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cz-layout article{border:1px solid var(--site-border);padding:20px}@media(max-width:600px){.cz-palette,.cz-skills{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.cz-profile,.cz-layout{grid-template-columns:1fr}.cz-specimen{padding:20px}.cz-title{font-size:32px}}
</style>
