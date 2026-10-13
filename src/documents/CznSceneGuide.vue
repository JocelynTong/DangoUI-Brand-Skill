<template><div aria-label="CZN 页面使用说明"><section><h3>这页怎么用</h3><p>{{ gameplay?'依次查看五项玩法媒体，观察标题、图像与序号的同步关系。':'观察媒体背景、标识和下载区域的层次；这不是可下载游戏的页面。' }}</p></section><section><h3>可以操作到哪一步</h3><p>{{ gameplay?'上一项／下一项可以循环切换五项内容。顶部导航和序号只展示，不打开玩法详情。':'视频可能自动静音播放，取决于网络和浏览器策略。顶部导航、二维码和下载区域只展示，不提供跳转或下载。' }}</p></section><section><h3>用于真实项目</h3><p>当前仍是 demo 页面片段，不是独立组件。真实内容、媒体授权、加载失败处理和业务入口由项目负责。</p><a href="#/variants/czn/components/media-stage">查看媒体舞台示例 →</a></section></div></template>
<script setup>
import { computed } from 'vue';
const props=defineProps({scene:String});
const gameplay=computed(()=>props.scene==='czn-gameplay');
</script>
