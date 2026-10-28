# 第五人格 · 盛夏花园候选品牌包

版本 0.1.0；基于既有本地 Demo 提取，供 Web 场景复用。不是官方品牌规范或完整认证包。

## 接入

同一项目安装 Vue 3 与 DangoUI 3.6.16。将本目录复制到项目，按顺序导入：

```js
import 'dangoui/theme.css';
import 'dangoui/style.css';
import './identity-v-garden/theme.css';
import './identity-v-garden/recipes.css';
import { GardenButton } from './identity-v-garden/index.js';
```

```vue
<section class="iv-garden">
  <div class="iv-panel">
    <GardenButton @click="open">开启来信</GardenButton>
    <GardenButton variant="outline">查看详情</GardenButton>
  </div>
</section>
```

GardenButton 是 DangoUI Button 的薄适配，转发原组件属性及事件；variant 支持 primary / outline。不承诺替代所有 Button 类型。原生页面可直接给 button 添加 iv-action / iv-outline。iv-tabs 配方只负责视觉，使用者须实现 aria-selected、方向键与面板绑定；完整实现见 demo.html。

CSS 必须放在 DangoUI 样式之后。范围限定在 .iv-garden 与显式配方类，无 :root 或全局语义覆盖。嵌入宿主时不要导入 demo-layout.css（它仅用于完整示范页）。assets 仅示范页需要，普通按钮/面板无需图片。直接替换 theme.css 中 --iv-* 可调整视觉值；tokens.dtcg.json 是对应的候选设计 Token。

## 依据与限制

- 已观察：归档首页中的官方主视觉、艺术字、导航装饰；导航局部文字色 #763241 / #ffefe9。此观察不代表品牌全局 action/text token。
- Demo 推演：渐变按钮、面板、间距、圆角、动效、章节组合、系统字体、移动端重排。所有 Token 的来源分类写在 $extensions 内。
- 接入补充：禁用态透明度与 aria-disabled；不是官网采样值。
- 未验证：官网其他栏目、官方移动端与字体、真实业务流程、其他 DangoUI 组件、加载/临时禁用等完整状态矩阵、小程序平台、完整可访问性与生产认证。

该包不覆盖成功/失败/警告/交易语义色，不改变宿主路由与数据。仅 Button 接入真实 DangoUI；面板和 Tab 是 CSS recipe，不能称作 DangoUI Card/Tabs 映射。完整 Demo 仍为原生 HTML。

官方图片保留原始内容和比例，仅作本地历史素材展示；活动文案不代表当前有效，版权归原权利人，公开分发授权尚未核实。assets.json 包含来源 URL、尺寸与 SHA256。不能以旧素材推断当前活动。

## 文件

- theme.css / recipes.css / index.js：运行时包。
- tokens.dtcg.json / style.json：候选 Token、兼容镜像及来源范围。
- dangoui-adapter.json：组件接口与验证状态。
- brand-mod.json：带文件 hash 的本地组件包清单。
- demo.html：移植后的完整本地 Demo；preview.html：真实 DangoUI 按钮接入样例（需 Vite）。
- evidence/：既有证据摘要与原 Demo 快照，仅用于追溯，禁止作为运行时截图模板。

原始完整品牌学习流程仍未通过；Evidence 为首页局部，Structure 与 Generative Proof 未认证。当前交付目标仅为可复用的 Demo 候选包。验证结果见 validation.json / independent-review.json。

2026-10-28 修正：原包缺少公共 `/brand` 入口的 manifest.scope 与 kit runtime/status 元数据，原来的运行预览不能证明可经入口安装。现已补齐候选元数据，以原包直接验证公共入口；仍仅到 awaiting-adaptation，不是宿主换肤完成。independent-review.json 是修正前的历史运行报告，绑定旧 manifest，不能替代当前包验收；本次复核另见 repair-review.json。kit 的 candidate-awaiting-independent-qa 保留完整宿主试装尚未验收的含义。

运行 `node verify.mjs` 可复查文件 hash、素材、Token 目标和 Demo 引用。runtime-preview/preview.html 是已构建的组件预览，在本地静态服务中即可打开，无需再次构建。它仅证明本仓库依赖下的运行；新项目安装、其他版本与生产环境须另验。
