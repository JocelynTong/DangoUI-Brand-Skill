# HPMA 迁移说明

来源：`https://www.harrypottermagicawakened.com/cn/index.html`

## 0. Preview Gate

> 目的：先确认视觉方向，再进入正式 DTCG / Echo / dangoui 迁移。

| 方向 | 核心页面 | 气质 | 信息密度 | 组件模式假设 | 决策 | 原因 |
| --- | --- | --- | --- | --- | --- | --- |
| `preview-a` | 首页、资讯、魔咒图鉴 | 羊皮纸、古铜、魔法书桌 | 中 | `ornate-top-nav`、`download-panel`、`spell-card-grid` | selected | 最贴近官网 UI，且能守住媒体资产边界 |
| `preview-b` | 战斗/活动 | 暗黑决斗 HUD | 高 | `hud-card`、`spell-action-button` | rejected | 容易把魔法蓝光和战斗特效误写成 token |
| `preview-c` | 视听/壁纸 | 手绘魔法世界 | 中低 | `media-thumbnail-grid`、`wallpaper-grid` | merged | 只作为媒体组件证据，不作为 token 源 |

## 1. 品牌风格摘要

HPMA 官网是深棕魔法书桌和羊皮纸阅读感的组合：页面结构由顶部导航、下载入口、新闻轮播、游戏特色、魔咒/伙伴和视听中心组成。可迁移的 UI 特征是棕黑背景、羊皮纸文字、古铜/金色边界和棕金行动入口；不可直接迁移为 token 的是霍格沃茨场景图、角色卡、魔法蓝光、华丽卡框和壁纸色彩。

第二轮校准补充了三个素材特征：官网 CSS 明确包含 `uifont_cn_title` 和 `navfont` 字体包；icon 大多是图片资产而不是图标字体；站点边框主要依赖 `media_border*.png`、`top_nav_h_2890ecd.png` 这类装饰图。因此 demo 可以用字体包和 CSS 角花模拟，但这些仍然属于 `demoOnlyVisualControls` / asset layer，不进入正式 `--du-*`。

## 2. 高频视觉值统计

> 统计口径：官网主 CSS 中的 UI hex 色值引用，共 115 次；图片采样另列为媒体资产口径。
>
> 占比公式：该视觉值出现次数 / 本次统计中所有视觉值出现次数总和。

| 类型 | 原始值 | 次数 | 占比 | 证据 | 角色判断 | 承接 |
| --- | --- | ---: | ---: | --- | --- | --- |
| color | `#6a3611` | 12 | 10.4% | CSS 高频古铜棕 | 强调/边界 | `--du-primary-border` |
| color | `#ffffff / #fefefe` | 13 | 11.3% | logo、反相文字、输入文字 | 亮前景 | `--du-text-1` / `--du-white-*` |
| color | `#696a75` | 8 | 7.0% | placeholder、弱信息 | 次级文字 | `--du-text-3` |
| color | `#523c2e` | 7 | 6.1% | 面板/输入背景 | 深棕表面 | `--du-bg-1` |
| color | `#e9d9c5` | 6 | 5.2% | 羊皮纸文字 | 高亮文字 | `--du-text-1` |
| color | `#c8b08b` | 4 | 3.5% | 媒体链接、金色标签 | 弱金色文字 | `--du-text-3` |
| media | 手绘场景 / 角色 / 魔法蓝光 | 6 张样图 | 图片采样 | 特色图、角色卡、壁纸 | 媒体资产 | `demoOnlyVisualControls` |
| typography | `uifont_cn_title` / `navfont` | 2 | 字体资产 | CSS `@font-face` | 标题/导航字体 | `demoOnlyVisualControls` |
| asset | `media_border*` / `top_nav_h` / button png | 6+ | 图片资产 | 缩略图框、导航高亮、下载按钮 | 边框/icon 系统 | `demoOnlyVisualControls` |
| divider/frame | antique gold hairline + corner-line frame | 6 | frame evidence | media borders、top nav highlight、thumbnail dividers | 装饰分割线/框体 recipe | `demoOnlyVisualControls.--style-divider-color` |

## 3. 高频组件模式统计

> 统计口径：官网 HTML 和页面区块中的组件模式，共 18 次。

| 组件模式 | 次数 | 占比 | 证据 | Echo/Figma 候选 | Dangoui 落地 | 状态 |
| --- | ---: | ---: | --- | --- | --- | --- |
| `feature-split-scene` | 5 | 27.8% | 游戏特色 page1-page5 | `Image + Card` | `Image + Card` | `style-only` |
| `news-carousel-with-list` | 4 | 22.2% | newsBig swiper、news tabs | `Swiper + Tabs + Card` | `Swiper + Tabs + Card + Tag` | `composed` |
| `ornate-top-nav` | 3 | 16.7% | 顶部导航、logo、submenu | `NavigationBar + Tabs` | `NavigationBar + Tabs` | `composed` |
| `media-thumbnail-grid` | 3 | 16.7% | 视频/壁纸缩略图 | `Image + Card` | `Image + Card` | `composed` |
| `download-panel` | 2 | 11.1% | QR、下载入口 | `Card + Button + Image` | `Card + Button + Image` | `composed` |
| `spell-character-card` | 1 | 5.6% | 魔咒&伙伴介绍 | `Card + Image + Badge` | `Card + Image + Badge` | `fallback` |

## 4. Token Mapping

正式 `--du-*` 只承接 UI 层：深棕页面底、深棕面板、羊皮纸文字、古铜边界和棕金行动入口。魔法蓝光、角色图、壁纸天色和华丽卡框全部留在 `demoOnlyVisualControls`。

## 5. Component Mapping

导航、下载、新闻、媒体网格都以 dangoui 组件组合承接。`spell-character-card` 只能 fallback，因为它需要卡牌稀有度框、角色裁切规则和魔法光效，当前 dangoui 没有正式组件 API。

## 6. 客观 Token Chain

```text
demo hpma nav/card class
→ dangoui NavigationBar / Tabs / Card / Button / Image
→ --du-bg-2 / --du-bg-1 / --du-text-* / --du-primary-*
→ HPMA adapter mapped values
→ ornate frame / media art remains style-only
```

## 7. 承接缺口

- token 缺口：ornate frame、magic glow、media shadow、font token、icon asset mapping。
- component 缺口：spell card shell、rarity frame、media thumbnail border asset。
- props / slots / variant 缺口：center logo nav、official download panel、gallery/video overlay。
- style-only 内容：角色图、场景图、蓝色魔法光、金色装饰框。

HPMA 的特殊边框不能只靠 `--du-border-1` 初始化。应用到业务项目时必须同时初始化 style-only Frame CSS：设置 `--hpma-frame`、`--hpma-frame-soft`、`--hpma-gold-bright`、`--style-divider-color`、`--style-frame-corner-size`，并让贴边角线替代目标框体的普通父容器 border。不要默认做成“普通外框 + 内部 inset 装饰框”；除非源站证据明确存在内外双层框。不要把这套角线套到证据区、mapping 区或频次表。

## 8. 机器可读资产

- `style.json`：主入口。`document` 使用 Figma REST-like 节点树表达首页、资讯、魔咒卡牌结构；`tokens` 使用 DTCG 表达颜色、圆角；`assets` 记录字体、media border 等素材状态；`brandMetadata` 记录 DangoUI / Vue / UnoCSS 转译目标。
- `preview-gate.json`
- `brand-evidence.json`
- `brand-profile.dtcg.json`
- `echo-mapping.json`
- `dangoui-adapter.json`
- `component-mapping.json`
- `uno-adapter.json`

## 9. UnoCSS 渲染适配

正式项目中通过 `uno-preset-echo` 消费 Echo/dangoui token utility。当前 Vue demo 仍是 CSS variables，因此 `hpma-ornate-frame`、`hpma-magic-glow`、`hpma-parchment-texture` 只作为 demo class，不进入正式 token 命名。

## 10. Demo 应用说明

Demo 增加 `HPMA` preset 和三个品牌页：官网首页、资讯/活动、魔咒卡牌。正式 token 写入 `dangouiTokens`，未同步能力写入 `demoOnlyVisualControls`。
