<template>
  <DocumentLayout title="让结构清晰可读" description="DangoUI 设计语言 · 从基础规则到组件，再到完整页面。">
    <section class="dango-intro-lead"><p>一致，不是每个页面长得一样。</p><h3>让重要的内容<br />先被看见。</h3><p>用清晰的层级、克制的色彩与明确的操作反馈，让用户知道自己在哪、能做什么、操作后发生了什么。</p></section>
    <div class="dango-catalog-grid">
      <a class="dango-catalog-entry" href="#/variants/dango/foundations/color"><strong>01 · 设计规范</strong><span>颜色、字体、图标、布局与细节 →</span></a>
      <a class="dango-catalog-entry" href="#/variants/dango/components/inspector"><strong>02 · 组件示例</strong><span>按用途查看形态与交互 →</span></a>
      <a class="dango-catalog-entry" href="#/variants/dango/dango-release-checklist"><strong>03 · 页面组合</strong><span>在发布清单中体验组件配合 →</span></a>
    </div>
    <section class="dango-catalog-group"><h3>阅读这套示例</h3><p>先看效果，再试操作，最后按需展开代码。规范中的布局、间距、圆角等演示保留原有规则，不把示意值包装成组件库已支持的 Token。</p></section>
    <template #evidence>基于本站现有 DangoUI 规范与示例整理。这里只展示 Web 效果，不代表小程序、宿主接入或真实发布已经验证。</template>
  </DocumentLayout>
</template>
<script setup>
import DocumentLayout from './DocumentLayout.vue';
</script>
