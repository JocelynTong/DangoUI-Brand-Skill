# CZN 迁移说明

来源：`https://czn.qq.com/` 与用户提供的 4 张截图。

## 0. Preview Gate

| 方向 | 核心页面 | 气质 | 信息密度 | 组件模式假设 | 决策 | 原因 |
| --- | --- | --- | --- | --- | --- | --- |
| `preview-a` | 游戏工具页 | 冷蓝科幻 HUD | 中高 | `dark-hud-card`、`blue-cta` | rejected | 与截图中高频橙色主行动不一致 |
| `preview-b` | 官网首页、角色页、公测内容页 | 橙色主行动、黑紫沉浸、斜切 HUD | 高 | `immersive-hero-visual`、`orange-primary-cta`、`slanted-hud-card` | selected | 更符合截图证据 |

## 1. 品牌风格摘要

CZN 的视觉不是极简品牌站，而是游戏内容站 / 工具站：首屏依赖大面积角色图、强烈橙色 CTA、黑紫角色展示页和斜切 HUD 线框。公测内容区又切到白灰底，但仍保留橙色描边、几何装饰和高信息密度。

## 2. 高频视觉值统计

> 统计口径：用户提供截图中的 UI color，包括导航、按钮、下载入口、卡片边框、标题、正文、背景和 HUD 装饰。
>
> 占比公式：该视觉值出现次数 / 本次截图抽样中所有 UI color 出现次数总和。

| 类型 | 原始值 | 次数 | 占比 | 证据 | 角色判断 | 承接 |
| --- | --- | ---: | ---: | --- | --- | --- |
| color | `#ff5514` | 6 | 30% | 导航激活、官网按钮、下载 CTA、轮播边框 | 主行动 / 品牌强调 | `--du-primary-color` |
| color | `#0b0710` | 4 | 20% | 角色页黑紫背景 | 沉浸式页面底 | `--du-bg-2` |
| color | `#17111f` | 4 | 20% | 暗色 HUD 面板 | 卡片/容器表面 | `--du-bg-1` |
| color | `#fff7f0` | 3 | 15% | 大标题、按钮文字 | 暗底一级文字 | `--du-text-1` |
| color | `#a79daa` | 3 | 15% | 导航副文案、角色说明 | 暗底二级文字 | `--du-text-3` |

## 3. 高频组件模式统计

| 组件模式 | 次数 | 占比 | 证据 | Echo/Figma 候选 | Dangoui 落地 | 状态 |
| --- | ---: | ---: | --- | --- | --- | --- |
| `immersive-hero-visual` | 3 | 23.1% | 首页、角色页 | `HeroStage` | `NavigationBar + Image + Card` | `style-only` |
| `orange-primary-cta` | 3 | 23.1% | 官网按钮、下载、更多 | `Button/Primary` | `DuButton` / `DuTag` | `mapped` |
| `slanted-hud-card` | 3 | 23.1% | 内容轮播、角色卡、下载区 | `Card/GameHud` | `DuCard + Image + Tag` | `style-only` |
| `character-selector` | 2 | 15.4% | 角色页左侧缩略图 | `Tabs/VerticalMedia` | 当前 demo 占位 | `missing` |
| `light-gray-news-section` | 2 | 15.4% | 公测内容区 | `Section/NewsCarousel` | 当前 demo 占位 | `style-only` |

## 4. Token Mapping

Color 进入 dangoui 现有 `--du-*`。斜切边框、角色图、能量光效、视差和全屏插画不进入 color token，暂放 `--style-media` 与 component pattern。

## 5. Component Mapping

当前 demo 主要验证 CZN 风格是否能落到千岛小程序样板间。真实 CZN 的全屏角色 stage、斜切 HUD 框、角色缩略图选择器需要正式组件或页面组合，不应该硬塞成基础 token。

## 6. 客观 Token Chain

按钮描边类样式仍按 dangoui 真实链路判断：

```text
DOM class / dangoui component
→ dangoui component token
→ dangoui alias
→ Echo/Figma alias
→ adapter
```

## 7. 承接缺口

- 斜切 HUD 边框：`style-only`
- 全屏角色图与视差：`style-only`
- 角色缩略图选择器：`missing / composed`
- 白灰公测区的信息卡片：`style-only`

## 8. 机器可读资产

- `style.json`：主入口。`document` 使用 Figma REST-like 节点树表达首页、公测内容、角色详情结构；`tokens` 使用 DTCG 表达颜色和 HUD radius；`assets` 记录本地 mask 与缺失角色图；`brandMetadata` 记录 DangoUI / Vue / UnoCSS 转译目标。
- `preview-gate.json`
- `brand-evidence.json`
- `brand-profile.dtcg.json`
- `echo-mapping.json`
- `dangoui-adapter.json`
- `uno-adapter.json`
- `component-mapping.json`

## 9. UnoCSS 渲染适配

当前 demo 未接入正式 UnoCSS preset。未来进入正式项目时，UnoCSS 只消费 Echo/dangoui token utility；`hud-frame`、`immersive-media`、`character-stage` 这类 preview class 不能直接成为正式设计系统命名。

## 10. Demo 应用说明

Demo 已新增 `CZN` style preset，并默认选中。color value 进入 dangoui `--du-*`；角色/能量/斜切质感通过 `--style-media` 表现。
