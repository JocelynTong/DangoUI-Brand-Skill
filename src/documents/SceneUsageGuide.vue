<template>
  <div class="scene-usage" :aria-label="`${guide.name}使用说明`">
    <section><h3>这页怎么用</h3><p>{{ guide.usage }}</p></section>
    <section>
      <h3>可以操作到哪一步</h3>
      <ul><li v-for="item in guide.boundaries" :key="item">{{ item }}</li></ul>
    </section>
    <section>
      <h3>用于真实项目</h3>
      <p>{{ guide.reuse }}</p>
      <p class="vl-small">当前是页面内的 Vue Web 演示实现，尚未抽成可直接安装的独立组件，不提供现成业务能力。</p>
      <details>
        <summary>开发接入：实现位置与业务责任</summary>
        <p>{{ guide.implementation }}</p>
        <p>{{ guide.integration }}</p>
      </details>
      <details>
        <summary>样式与适配边界</summary>
        <p>{{ guide.styles }}</p>
        <p>手机框跟随站点外观，不代表屏幕内页面已完整适配暗色。未提供 Taro／小程序适配，也未验证任意宿主宽度；品牌图片、视频与字体的使用权需另行确认。</p>
      </details>
    </section>
  </div>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ scene: { type: String, required: true } });
const guides = {
  'pokemon-tcg-official-card-database': {
    name: '卡牌查询',
    usage: '观察名称、卡牌文本、进化来源和能量类型如何组织成查询区。适合参考检索表单的信息层级，不是可用的卡牌搜索服务。',
    boundaries: ['可以：在手机屏幕内滚动阅读，或打开独立预览。', '仅展示：输入框、能量类型、搜索、重置和高级筛选均不可操作。', '数据边界：未连接官方卡牌数据库，不提供真实搜索结果。'],
    reuse: '可参考字段分组、筛选区和操作区的布局。接入已有项目时保留真实搜索、筛选与结果列表，不要用这份静态演示替换可用的业务表单。',
    implementation: '实现位于 src/App.vue 的 SchemaPokemonDatabaseSection；查询说明由 SchemaChecklistSection 渲染。配置位于 public/brand-previews/pokemon-tcg-official.json 的 card-database-search-shell 与 card-database-search-guidance。两者均使用 static-evidence-only 静态模式。',
    integration: '真实接入需由业务提供查询接口、字段校验、筛选条件、结果排序与分页，以及加载、空结果、失败和重试状态。关闭静态模式不会自动接入真实服务；演示内已有的结果分支也不等于完整搜索功能。',
    styles: '样式涉及 src/brands/pokemon-tcg-official-current.css 与 src/styles.css，并依赖品牌主题和页面容器；不能只复制一个函数就视为完成接入。',
  },
  'czn-character': {
    name: '角色档案',
    usage: '观察角色媒体、身份介绍与技能展示如何分层排列，以及切换时资料如何同步。适合用作角色或人物详情的展示参考。',
    boundaries: ['可以：用上一项／下一项箭头或头像入口切换演示状态，或打开独立预览。', '示例范围：实际只有“阿拉贝拉”和“阿拉贝拉 · 战斗姿态”两个状态，使用相同角色媒体；5 个头像入口循环映射到这两个状态，不代表 5 份角色档案。', '仅展示：手机屏幕内的顶部导航、CV 文字和技能图标不提供跳转、语音播放或技能详情。'],
    reuse: '可参考媒体舞台、角色资料和技能列表的分层方式，以及本地状态切换逻辑。它不是独立的角色资料组件，也不是完整角色库。',
    implementation: '实现位于 src/App.vue 的 SchemaCznCurrentSection（czn-current-character 分支）；配置位于 public/brand-previews/czn.json 的 czn-character。items 提供 name、voice、video、poster、description、skills；rail 提供头像入口。',
    integration: '真实接入需让头像与角色 ID 一一对应，替换当前按索引循环映射的演示逻辑；业务负责角色数据、选中状态、媒体加载失败处理，以及需要的详情路由、语音和技能操作。当前没有数据请求、空列表或请求失败的完整处理。',
    styles: '样式主要位于 src/styles.css 的 czn-current-character 等规则，依赖 CZN 主题容器及图片、视频资源；外链媒体加载受网络与浏览器播放策略影响。',
  },
  'czn-held-out': {
    name: '信号档案',
    usage: '观察档案标题、描述、抽象信号图形与序号的组织方式。这是非官方的虚构迁移练习，不是真实信号监测或档案服务。',
    boundaries: ['可以：用上一项／下一项箭头循环查看 3 条示例档案，序号随当前项更新，也可打开独立预览。', '仅展示：侧边序号和手机屏幕内的顶部导航不可点击跳转；信号图形不是实时数据。', '示例范围：VOID ECHO 01–03 为虚构内容，切换改变标题、描述和当前序号，不代表加载了不同的实时信号。'],
    reuse: '可参考“当前档案 + 序号指示 + 前后切换”的信息组织与本地循环逻辑。当前仍与 CZN 页面渲染器耦合，尚未提供独立档案组件。',
    implementation: '实现位于 src/App.vue 的 SchemaCznCurrentSection（czn-current-heldout 分支）；配置位于 public/brand-previews/czn.json 的 czn-held-out。items 提供 title 与 description，序号数量来自 items.length；信号图形由页面样式绘制。',
    integration: '真实接入需由业务提供档案 ID、内容来源与数据获取，处理加载、空列表、失败和重试；如需直达某条档案、详情路由或实时信号，都需另行实现。不要把当前循环浏览当作服务端分页。',
    styles: '样式主要位于 src/styles.css 的 czn-current-heldout 与 czn-current-timeline 等规则，依赖 CZN 主题容器；图形属于装饰层，不能直接作为业务数据可视化。',
  },
};
const guide = computed(() => guides[props.scene]);
</script>
<style scoped>
.scene-usage ul { padding-left:18px; margin:12px 0; font-size:14px; line-height:1.85; color:var(--site-muted); }
.scene-usage li + li { margin-top:8px; }
.scene-usage details { padding:12px 0; border-top:1px solid var(--site-border); }
.scene-usage summary { cursor:pointer; font-size:13px; line-height:1.7; }
.scene-usage details p { overflow-wrap:anywhere; }
</style>
