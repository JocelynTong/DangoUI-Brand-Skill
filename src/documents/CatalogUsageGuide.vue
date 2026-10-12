<template>
  <div class="catalog-usage" aria-label="卡组浏览使用说明">
    <section>
      <h3>这页怎么用</h3>
      <p>观察商品图片、分类、编号和名称的排列方式，适合用作双列商品目录的展示参考。</p>
      <dl class="catalog-reading">
        <div><dt>图片</dt><dd>先看包装与配色，快速辨认商品。</dd></div>
        <div><dt>标题</dt><dd>名称与补充说明分层，便于连续浏览。</dd></div>
        <div><dt>编号</dt><dd>与分类并排，方便区分同系列商品。</dd></div>
      </dl>
      <p><a href="#/variants/onepiece-cardgame/design-system">查看品牌颜色与排版 →</a></p>
    </section>
    <section>
      <h3>可以操作到哪一步</h3>
      <ul>
        <li><strong>可以：</strong>在手机屏幕内滚动查看商品，或打开独立预览。</li>
        <li><strong>仅展示：</strong>分类和页码不会筛选、翻页；商品卡片不会打开详情，卡片上的行动文案也不是操作按钮。</li>
        <li><strong>示例数据：</strong>不是实时商品、库存或交易服务。</li>
      </ul>
    </section>
    <section>
      <h3>用于真实项目</h3>
      <p>优先复用<strong>商品网格</strong>，保留你项目已有的搜索、分类与分页。业务先得到结果列表，再交给网格展示，不需要重写卡片布局。</p>
      <details>
        <summary>开发接入：文件、数据与状态</summary>
        <p class="vl-small">标题与静态分类外壳属于 CatalogSection；商品网格是 CatalogProductGrid。不要用静态分类外壳替换已有的可用筛选器。</p>
        <p>当前是仓库内的 Vue 3 Web 实现，并非已发布的通用组件包。复用以下模块与同目录样式依赖：</p>
        <pre><code>{{ example }}</code></pre>
        <p>复制文件时，一并带上 catalog.css 引用的 catalog-tokens.css。items 接收 src、alt、title、category、code、release、cta 字段；图片地址由项目提供。</p>
        <ul>
          <li>正常／筛选后：传入结果数组，组件保留输入顺序。</li>
          <li>空结果：传入 []，用 emptyText 指定提示。</li>
          <li>加载、请求失败、重试、详情跳转和分页：由业务页面实现，网格不提供这些行为。</li>
          <li>未传图片地址会显示占位文字；图片加载失败没有自动兜底。</li>
        </ul>
      </details>
      <details>
        <summary>样式与适配边界</summary>
        <p>当前固定双列、图片区域高 122px。背景与图片圆角接入目录 Token，字体、文字颜色和其他尺寸仍有固定值。手机框随站点主题变化，不代表屏幕内组件已支持完整暗色主题。</p>
        <p>不包含 Taro／小程序适配，也不保证任意页面宽度均已验收。品牌图片的使用权需另行确认。</p>
      </details>
    </section>
  </div>
</template>
<script setup>
const example = `import CatalogProductGrid from './src/uikit/CatalogProductGrid.mjs';
import './src/uikit/catalog.css';

// 放入 Vue 页面的 template；hostResults 是业务计算后的结果。
<CatalogProductGrid
  :items="hostResults"
  appearance="onepiece"
  empty-text="没有匹配结果"
/>`;
</script>
<style scoped>
.catalog-reading { margin:20px 0; }
.catalog-reading div { display:grid; grid-template-columns:36px minmax(0,1fr); gap:12px; padding:10px 0; border-top:1px solid var(--site-border); font-size:13px; line-height:1.7; }
.catalog-reading dt { color:var(--site-text); font-weight:600; }
.catalog-reading dd { margin:0; color:var(--site-muted); }
.catalog-usage ul { padding-left:18px; margin:12px 0; font-size:14px; line-height:1.85; color:var(--site-muted); }
.catalog-usage li + li { margin-top:8px; }
.catalog-usage strong { color:var(--site-text); }
.catalog-usage a { color:var(--site-accent); text-decoration:underline; text-underline-offset:3px; }
.catalog-usage details { padding:12px 0; border-top:1px solid var(--site-border); }
.catalog-usage summary { cursor:pointer; font-size:13px; line-height:1.7; }
.catalog-usage pre { white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; line-height:1.7; color:var(--site-text); }
</style>
