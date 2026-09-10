# 映射判定规则

本文档只回答一件事：当 `$brand` 已经拿到品牌证据、Echo/Figma token 和 dangoui schema 后，如何客观判断映射关系。

不在这里解释资产架构；资产架构见 `brand-dtcg-migration-asset-standard.md`。
不在这里规定输出文档格式；输出格式见 `output-template.md`。

## 目录

- `1. 先证明链路`：组件样式问题先追 token chain。
- `2. Color 三层判断`：一级色板、二级语义、三级组件别名。
- `3. Asset Inventory`：图片、字体、视频、frame、selected-bg 等资产角色。
- `4. 非 Color Token`：spacing、radius、shadow、divider/frame 等非颜色值。
- `5. Component Pattern`：品牌组件模式到 Echo / dangoui 的映射。
- `6. Existing Migration Assets 应用规则`：已有 `migrations/{brand}` 如何应用。
- `7. Style Pack 应用链路校验`：evidence 到 computed style 的完整校验。
- `8. 风格原子表达规则`：风格 tabs 如何给运营和 AI 看懂。
- `9. 废弃层`：`--du-c-*` 只作旧链路证据。

## 1. 先证明链路

### 1.0 Demo 证明边界

learn-brand Demo 是学习能力测试，不是官网镜像、宿主成果或品牌素材模板。映射开始前把页面分为：

- `reference calibration`：允许 Researcher / Interpreter 用来提取证据、校准规则和回归结构。
- `held-out generative challenge`：在 brand intent、approved patterns 和约束冻结后才交给 Demo / Blind QA，用来检验规则是否可生成。

同一页面不得跨组复用。Reference 上高度还原只能得到 Evidence / Structure Proof；只有 held-out 页面仍满足品牌结构、且所有显著模式可追溯，才能得到 Generative Proof。Logo、品牌色、官方壁纸、截图 crop 和固定模板换皮均不能替代三证。

映射和 QA 需要为每个高显著度模式保留 `proofType`、`evidenceRefs`、`sourceRegion`、`demoRegion`、`calibrationOrHeldOut`。缺失或角色语义扩张时进入内部 blocker，不交给用户发现。

任何设计语言判断，先追踪真实输出，再做语义判断。源码、目录、文件名、品牌印象都只能作为辅助线索，不能替代最终渲染证据。

### Computed-first 证据链

顺序固定为：

```text
真实页面 / demo / 宿主页面
→ DOM 节点和可见区域
→ computed style / currentSrc / loaded font / animation state
→ matched CSS rule / inline style / token / @font-face / asset URL
→ 设计语言角色判断
→ dangoui token / style-only recipe / asset / 未承接
```

各维度必须按输出侧溯源：

- Color：先读关键节点 computed `color / background / border / box-shadow / text-shadow`，再追 CSS rule、变量和图片/媒体色。图片色只能证明氛围，不能直接变成 UI token。
- Font：先读 computed `font-family`，再追 matched selector 和 `@font-face src`。不要因为本地目录没有字体文件就判定“无字体包”；也不要只写了 `@font-face` 就判定已承接，必须看目标节点 computed font-family。
- Radius：先读 computed `border-radius` 的最终像素值，再追来源 rule。Taro/rem/rpx/postcss 转换后低于可见阈值的圆角不算有效。
- Border / Divider / Frame：先读 computed `border-*`、`outline`、`box-shadow inset`、伪元素尺寸和背景，再追来源 rule / border-image / mask / frame asset。
- Shadow：先读 computed `box-shadow / filter / text-shadow`，再判断是否来自源站证据；无证据 shadow 必须降级。
- Motion：先读 computed `animation / transition / transform` 和触发态，再追 CSS keyframes 或 JS 状态；看不到动效不能只凭 CSS 文件存在判定通过。
- Asset：先读 DOM `img.currentSrc`、CSS `background-image / mask / border-image`、视频 poster/source，再追 resolved URL、尺寸、用途和许可状态。

如果 computed 输出和源码文件冲突，以 computed 输出为准；然后反查源码为什么没有生效。只有当浏览器/截图不可用时，才用 CSS/HTML/asset inventory 作为临时草稿证据，并在 `needsReview` 写明缺少 computed 验证。

### Computed-first 替换链

拿到 computed 值以后，不能直接把它推广成全局品牌 token。必须先把该值绑定到真实 UI 角色，再决定替换范围。

顺序固定为：

```text
computed property/value
→ matched source rule / inline style / variable
→ UI role
→ dangoui token / style-only recipe / local doc variable / semantic token
→ replacement selector scope
→ 再读 computed 验证
```

UI role 至少区分：

- `control`：Button、FAB、Switch、Input、Search、Tag、Tabs 选中态等可点击/可输入控件。
- `content-surface`：业务卡片、Group、Panel、Feed item、商品卡、详情内容块。
- `media-surface`：Hero、图片容器、视频容器、角色/商品大图。
- `doc-surface`：demo 站说明卡、代码块、证据卡、示例分组、可编辑属性说明区。
- `text-on-dark`：深色/复杂背景上的标题、导航、主视觉文案。
- `text-on-light`：浅色卡片/页面上的正文、说明、表单文本。
- `decorative-frame`：撕纸、角线、边框贴图、纹理、背景光效。
- `business-semantic`：价格、库存、成功/失败、游戏属性、稀有度等业务含义色。

替换规则：

- `control` 的圆角、阴影、边框不能传给 `doc-surface` 或 `content-surface`。例如按钮 computed `border-radius: 999px` 只能证明控件药丸，不证明代码块、示例分组、业务卡片也要药丸。
- `content-surface / media-surface` 的圆角、边框、阴影不能传给 `doc-surface`。demo 说明容器只用于阅读，应使用独立的文档变量或 baseline 样式，不承接品牌业务卡片的强风格。
- 文本颜色必须按 `text-on-dark / text-on-light` 分开替换。深色背景上的标题不能直接使用浅色卡片里的正文色；浅色卡片正文也不能直接使用深色背景上的高亮色。
- 为了提高可读性，优先替换文字 token 或局部 text-shadow；不要默认新增大面积遮罩、额外卡片或背景面板。只有源站 computed style 或 asset 证据存在类似容器时，才允许新增容器背景。
- `business-semantic` 不直接并入 primary / secondary。可以生成品牌化实验映射，但必须保留语义链路并进入运营可调整项或 `needsReview`。

记录格式建议：

```json
{
  "selector": ".example",
  "property": "border-radius",
  "computedValue": "999px",
  "source": ".du-button",
  "role": "control",
  "replacement": "--style-control-radius",
  "antiScopes": ["doc-surface", "content-surface"]
}
```

如果一个 replacement 没有 role 和 antiScopes，就不能算完成映射。

组件样式问题再追踪真实 token chain。

顺序固定为：

```text
DOM class
→ dangoui 组件样式消费的 token
→ dangoui 组件别名映射
→ Figma / Echo alias 链
→ 当前 adapter 是否覆盖到这一层
```

禁止从命名直觉直接下结论，例如：

```text
看到 primary 按钮，就推断它使用 --du-primary-color。
```

Button outline 示例：

```text
DOM: du-button--outline + du-c-primary-bt
dangoui style: border: 1px solid var(--du-bt-border)
dangoui alias: bt-border -> primary-border
Figma alias: primary/bt/border -> {primary.border} -> {primary.5}
```

因此描边问题应检查 `--du-bt-border` / `--du-primary-border`，不是直接跳到 `--du-primary-color`。

## 2. Color 三层判断

### 一级色板层

只描述颜色本身，不赋予 UI 语义。

一级色板必须先从源资产做全量抽取，不是 Top N 高频表，也不是最终 token mapping 的反推结果。所有从 CSS token、CSS declaration、截图采样、图片资产、已有 design token 中进入本次口径的颜色都要先列出，并按频次从高到低排序；存在于 token / 候选映射但证据未命中的颜色保留为 `0 次`。频次、占比和上下文用于排序与解释映射决策，不能替代完整色板。

判断维度：

- 色相：红、橙、黄、绿、青、蓝、紫、中性色。
- 明度：高明度、中明度、低明度。
- 饱和度：高饱和、低饱和、近灰。
- 冷暖：偏冷、偏暖、中性。
- 频率：大面积、高频、低频但稳定。

Color 输出至少拆成两组：

- `colorInventory`：完整颜色清单，按 count 降序记录 raw value、归一化 value、count、percent、来源、上下文、是否 UI color / media color / asset color；无证据命中的候选色 count 记 `0`。
- `rankedColorEvidence`：高频或关键颜色证据，记录 count、percent、target mapping、理由。
- `dangoColorStructure`：默认 DangoUI baseline 不做频次统计；一级基础色板可以平铺展示全部无业务语义色阶，二级语义 token 和三级组件别名展示典型引用关系即可。一级基础色板以 `dangoui-design-token` / `uno-preset-echo` 的 primitive colors 为准，包括 `neutral / purplegray / purple / grape / blue / zimablue / turquoise / green / yellow / orange / red / pink / tendershoots / white` 等色系；废弃 `--du-c-*` 不能作为一级色板；`trade`、`vip`、`default` 属于二级/语义层，不进一级色板。当前 demo 快照中 `--du-primary-*`、`--du-secondary-*`、`--du-trans-black-*` 等只能作为历史/生成别名辅助说明，不能取代一级色板主名。二级写成 `--du-primary-color = var(--du-purple-5)`，三级写成 `--du-bt-color = var(--du-default-color)`。

不要在一级色板层命名为 `primary`、`secondary`、`success`、`warning`、`error`、`trade`。

### 二级语义层

根据真实使用位置分配到 App 角色：

- 中性基础：`--du-bg-*`、`--du-text-*`、`--du-icon-*`、`--du-border-*`、`--du-white-*`、`--du-default-*`、`--du-trans-black-*`。
- 品牌语义：`--du-primary-*`、`--du-secondary-*`，只承接主要行动入口或稳定品牌强调。
- 业务语义：`--du-trade-*`，只承接交易、购买、价格、促销等业务行动色。
- 基础语义：`--du-error-*`、`--du-success-*`、`--du-warning-*`、`--du-mask-*` 等明确状态色。
- Disabled / Disabledtemp：保留 dangoui 现有 `disabledtemp` 命名。

不要把插画、摄影、装饰渐变色塞进 `primary / success / warning / error`。

## 3. Asset Inventory

图片资产必须独立于 color / radius / divider 统计。PNG、JPG、WebP、SVG、GIF、Lottie、字体包和视频帧都先进入 `assetInventory`，再决定是否参与 Image / Icon / CSS / Frame 落地。

每条 asset 至少记录：

- `assetPath` 或 `url`：本地路径或源站 URL；没有文件时写 candidate，不编造。
- `rawSrc / resolvedUrl`：DOM `<img src>` 的原始路径和解析后 URL；例如 `./img/role/false.webp` 不能只记录成图片采样色。
- `format / dimensions / alpha`：文件格式、尺寸、透明通道。
- `role`：`hero-kv / background / selected-bg / frame / asset-frame / texture / icon / brand-mark / illustration / divider / campaign-asset`。
- `contexts`：页面、DOM/CSS selector、状态、截图区域或文件来源。
- `targetScope`：目标页面、组件、selector 或状态。
- `implementation`：`Image slot / icon slot / CSS background / mask / border-image / pseudo-element / 9-slice / ReviewQueue`。
- `placement`：repeat、size、position、inset、opacity、blend、state。
- `antiScopes`：证据区、mapping 区、频次区、DangoUI baseline 等排除区域。

### 3.1 Rendered Asset Crawl

资产证据必须从浏览器最终渲染链路开始抓，不能只扫本地目录、文件名或截图印象。无现成 style pack 的官网 URL 必须生成 `rendered-asset-inventory.json`，再决定 demo 页面和 style pack 怎么承接。

脚本入口：

```bash
node .claude/skills/brand/scripts/brand-guard.mjs collect-rendered-assets \
  --brand <brand> \
  --source-url <url> \
  --html-file <rendered.html> \
  --css-files <page.css,theme.css> \
  --computed-file <computed.json>
```

必须抓取：

- DOM 图片：`img.currentSrc / img.src / source[srcset] / video[poster] / svg image[href]`。
- CSS 图片：`background / background-image / mask / -webkit-mask / border-image / filter / clip-path` 中的 `url(...)`。
- 伪元素：`::before / ::after` 的 `content / width / height / position / z-index / pointer-events / background / mask / border-image`。
- 字体：目标节点 computed `font-family` 对应的 `@font-face src`。
- 网络资源：`performance.getEntriesByType("resource")` 中真实加载的 image、font、css、video。

每条 rendered asset 必须带：

- `sourceType`：`dom-image / dom-srcset / css-rule / computed-style / font-face / network-resource`。
- `selector / pseudo / property`：证明它从哪个节点、哪个伪元素、哪个 CSS 属性来。
- `geometry`：能拿到时记录 `width / height / position / z-index / pointer-events / background-size / object-fit / border-radius`。
- `roleGuess`：`hero-kv / campaign-asset / content-image / illustration / background / decorative-layer / asset-frame / font / icon / brand-mark`。
- `implementationHint`：落到 `Image slot / CSS background / pseudo-element / border-image / @font-face / ReviewQueue`。

共性判断：

- DOM/currentSrc 图片默认是内容资源位，优先用 `Image` 或 `<img>` 承接，并保持真实宽高比：`width: 100%; height: auto; object-fit: contain`。只有 computed style 明确 `object-fit: cover`、固定裁切或容器 mask 时，才允许裁切。
- DOM/currentSrc 图片的圆角、边框、阴影必须来自该图片或父容器 computed style；不能继承通用 card/control radius。
- `content: ""`、`position: absolute`、`pointer-events: none` 的 `::before/::after background url(...)` 通常是 `decorative-layer / module-bg / asset-frame`，不是内容 Image，也不是普通 border token。
- `mask / border-image / frame` 资源优先归为 `asset-frame`，替代父容器边界；不要把它简化成 `--du-border-*`。
- 资源位图片不等于边框。边框/角线/撕纸/云朵边缘必须单独作为 frame/decorative-layer 记录；资源图本身继续按 Image 比例展示。

映射判定：

- `brand-mark / illustration`：优先映射到 `Image`、组件 slot 或媒体层；没有组件承接时进入 `demoOnlyVisualControls.assetRecipes`。
- `hero-kv`：只用于沉浸式 Hero/header 主视觉；优先选择首屏/KV/移动端 KV，普通 `texture/background` 不能替代主图，除非没有更强素材。
- `hero-cta-cluster`：首屏下载、注册、预约、二维码、平台入口等转化资产要作为一组承接，通常是 `Image + Button` 组合；不要降级成一个普通按钮，也不要把官网业务内容搬到无关页面。
- `section-edge`：撕纸、云边、波浪、斜切、断裂边缘属于页面分段装饰层，落到 `pseudo-element / mask / background layer`；不要映射成普通 `--du-border-*`。
- `campaign-asset`：运营贴片、下载入口、活动角标、兑换码等默认不进入全局风格迁移；只有目标页面就是运营活动/下载转化页时才应用。
- DOM inline `<img src>` 里的角色图、人物图、物件图和状态图要进入 `illustration / role-art / object-art`，并保留原始相对路径与解析后路径。
- `selected-bg`：必须落到 selected / active selector，不能用无依据 shadow、outline 替代。
- `background / texture`：作为 page/panel/card/media CSS background；必须记录 repeat、size、position、blend/opacity。
- `asset-frame`：通常替代父容器 border；需要 9-slice、border-image 或 parent background edge layer。
- `icon`：只有项目存在相应 icon name、icon slot 或图片 icon API 才能标 `mapped/composed`；否则是 `style-only` 或 `ask-user`。

禁止把图片资产直接命名成 `--du-*`。可以从图片采样提取媒体色，但媒体色只解释氛围；除非 UI 也有独立 CSS/token 证据，否则不能直接映射成 DangoUI color token。

### 3.2 Asset Usage Gate

Rendered asset 抓到以后，还要检查“用在哪一层”。这一步必须脚本化，不能只靠规则提醒。

脚本入口：

```bash
node .claude/skills/brand/scripts/brand-guard.mjs asset-usage-gate \
  --brand <brand> \
  --files <App.vue,styles.css>
```

脚本必须检查：

- `asset-placement`：每个图片、frame、texture、section-edge 要落到正确层级：`page background -> section edge -> hero/media asset -> content card -> control`。`section-edge / decorative-layer` 不得被缩成普通 Card 内的小装饰，除非 computed 证明它本来就是内嵌装饰。
- `decorative-mount`：云朵、撕纸、圆点、打孔边、角线、frame 这类 `::before/::after` 只能挂到 evidence `targetScope` 指定的容器。不能批量挂到普通 `Card / List / Grid / Title / Tabs / Button / Form`。
- `image-usage`：DOM/currentSrc 图片不能重复平铺来假装列表；不能固定高度裁切；不能默认 `cover`。默认保持真实宽高比，缺少多张图例时要继续采集，而不是复制同一张图。
- `inspector-overlay`：demo inspector 的 hover/selected 高亮不能变成视觉证据。真实 `Hero / Image / Swiper / Asset` 节点选中时，outline 应外扩，不能贴着图片边缘像图片自带边框；主视觉资产 hover/selected 不能被通用透明度规则压暗。

如果 gate 报 warning，demo 仍可临时预览，但最终只能说 `conservative-application`。如果 gate 报 blocking，不能宣称 style pack 可用。

### 三级组件别名层

三级组件 token 默认继承或派生自二级语义层。

示例：

```text
--du-bt-*
--du-in-*
--du-checkbox-*
--du-radio-*
--du-switch-*
--du-*-tag-*
```

规则：

- 不优先用组件别名 token 做品牌迁移入口。
- 但解释组件样式时，必须按组件别名链路追踪。
- 不自动覆盖 tag、badge、pill、label 等组件专属视觉；需要特殊覆盖时列入 `ask-user`。

## 4. 非 Color Token

如果 Echo/Figma primitives 已有对应 token，优先承接到 primitives。

当前已知：

```text
Radius/Large = 16
Radius/Medium = 12
Radius/Normal = 8
Radius/Small = 4
Radius/Mini = 2

Spacing/Large = 16
Spacing/Medium = 12
Spacing/Normal = 8
Spacing/Small = 4
Spacing/Mini = 2
```

规则：

- 品牌原始值能准确匹配 primitives：`mapped`。
- 可用最近 primitives 表达但不完全匹配：`fallback`。
- Echo/Figma 有 token，但 dangoui 未同步：dangoui adapter 标为 `style-only`。
- Echo/Figma 和 dangoui 都没有：`missing`。
- 需要用户判断是否新增 token：`ask-user`。
- 不允许只因为值能贴近 Echo/Figma primitives，就把 DangoUI adapter 写成 `mapped`。DangoUI adapter 必须先证明当前 `data/dangoui.design-system.json` 或宿主项目源码里存在对应 `--du-*` token、组件 prop、slot 或 class。
- 当前 demo 快照中未发现通用 `spacing`、`radius`、`shadow`、`motion` token；除 `--du-empty-padding` 等组件专用 token 或 `Divider`、`Snackbar`、`Transition` 等真实组件能力外，一律标为 `style-only` 或 `missing`，不能写成 `--du-spacing-*`、`--du-radius-*`、`--du-shadow-*`、`--du-motion-*`。

### Radius / Border / Shadow 分层

圆角、边框、divider/frame、阴影不能互相代偿，也不能从控件习惯泛化到页面容器。

Radius 判断：

- `frame/card/media radius` 和 `control radius` 分开记录。
- `doc/code/example radius` 也要单独记录；demo 站说明卡、代码块、证据卡、示例分组不是品牌控件，也不是业务卡片。
- 图片边框、官网装饰框、卡牌外壳若是直角，frame/card/media radius 记为 `0px`。
- 一旦 frame/card/media radius 由风格化边界确定，普通 border 卡片、普通面板、列表容器也要继承同一容器 radius；不能只让特殊装饰框直角，普通 Card 仍保留通用圆角。
- button、input、tag 出现 `5px / 8px / 999px` 只能证明 control radius，不能推导 card/media 也是圆角。
- button、input、tag 出现 `5px / 8px / 999px` 也不能推导 demo 说明卡、代码块、示例分组是同样圆角；这些属于 `doc-surface`，应使用文档阅读半径。
- 通用 demo 容器样式造成的圆角不是品牌证据；必须用 computed style 和来源证据交叉确认。
- Radius 与 Divider / Frame 必须联动判断：如果站点的识别点来自直角线框、角线、档案框、斜切框或图片边框资产，Card / media / frame 容器的 radius 要服从该边界语言。不能一边保留通用圆角，一边套线性 divider/frame。
- 特殊 frame 不应默认做成“普通外框 + 内部 inset 角线”。优先让父容器自身的 border/background/border-image 承担 frame；只有素材证据明确存在内框时，才使用 inset 伪元素。

Border 判断：

- 先判断来源：真实 CSS `border`、图片 border asset、伪元素角线、内框、外框。
- 替换品牌边框时，优先替换目标容器本身的 border；不要默认在容器内部再画一层框。
- 如果用伪元素表达装饰边框，必须标明它模拟的是外沿角线、内框还是 asset fallback。
- 边框选择器必须限定到 demo/组件目标，避免证据面板、频次表、mapping 区被误套。

Divider / Frame 判断：

- 每个参考站都要提取 `Divider`、`Frame`、`Selection divider` 三类；没有特殊框也要记录 `none / plain Divider`。
- 普通分割线可以映射到 `--du-border-*`；装饰框、斜切框、角线、图片边框必须进入 `demoOnlyVisualControls` 的 Frame style-only CSS。
- Frame style-only CSS 至少包含：目标作用域、线色/线宽、真实容器 border、角线或图片 asset fallback、radius、反例排除区域。
- Card 如果是该站点的主要内容容器，也要进入 Frame / Divider 判断；不要只处理 Hero/media，留下 Card 使用通用外框或通用圆角。

Shadow 判断：

- 阴影和发光只有在源站 CSS、图片采样或明确视觉证据存在时才保留。
- 选中态、hover 态、active 态不能为了“更明显”自行加 shadow。
- 没有依据的 shadow 要删除或标为 `style-only / ask-user`。

### Text / Readability 分层

文字映射不能只问“哪个颜色频率最高”或“哪个是品牌主色”，必须先看文字所在背景的 computed style。

判断步骤：

1. 读取文字节点 computed `color / text-shadow / font-weight / font-family`。
2. 读取最近可见背景的 computed `background / background-color / background-image / opacity`。
3. 判断角色：`text-on-dark`、`text-on-light`、`muted-on-light`、`muted-on-dark`、`code-text`、`control-text`。
4. 决定 token：深色背景标题优先使用高对比 text token；浅色卡片正文使用正文 text token；弱说明使用 muted token；代码块使用 doc/code token。
5. 再读 computed 验证，不允许标题和正文因为同一个品牌色而在真实背景上不可读。

修复可读性时不要默认新增整块遮罩或新卡片。优先级：

```text
调整 text token / local text variable
→ 调整 font-weight / text-shadow
→ 调整局部背景透明度
→ 只有有源站证据时，才新增整块遮罩或面板
```

DTCG 表达：

- CSS 距离类值使用 `$type: "dimension"`，例如 `{ "value": 16, "unit": "px" }`。
- 如果 Figma 当前导出为 `$type: "number"`，在 `$extensions.currentSourceType` 记录原始来源。
- 缺失 shadow 不输出空 `$value`，只记录缺口、原始值和未来候选。

## 5. Component Pattern

组件迁移不是按名字匹配，而是按品牌组件模式映射。

每个组件模式至少记录：

- `brandPattern`
- `status`
- `echoComponentCandidate`
- `dangouiComponent` 或 `dangouiComponents`
- `props`
- `slots`
- `usesTokens`
- `unsupported`
- `tokenChain`

状态定义：

- `mapped`：单个 dangoui 组件和现有 props/slots 能准确承接。
- `composed`：需要多个 dangoui 组件组合。
- `fallback`：可近似承接，但缺少部分 variant、slot 或状态。
- `style-only`：结构可承接，但品牌特征只能靠页面样式表现。
- `missing`：dangoui 没有对应组件或核心能力。
- `ask-user`：是否新增组件、variant、slot 或组件专属 token 需要确认。

规则：

- 不发明 dangoui 组件名。
- 不把页面组合误判为组件库新增需求；先记录为 `composed`。
- 涉及新增组件、variant、slot、组件专属 token 时，列入 `ask-user`。
- 弹层、toast、tooltip、upload、calendar 等依赖触发态的组件，可在 demo 占位，但 component mapping 必须记录真实状态。
- 页面 demo 不是 component mapping 本身；如果做 2-3 个页面验证，每页必须有真实不同的结构和内容模式，不能只替换页面标题或复用同一通用 feed。

## 6. Existing Migration Assets 应用规则

当宿主项目已有 `migrations/{brand}` 或公开 demo/registry 站点返回的 style pack 时，优先应用资产，不重新学习品牌。

资产查找顺序：

1. 宿主项目 `migrations/{brand}/`
2. 公开 demo/registry 站点返回的 `{brand}` style pack
3. 如果两者都不存在，回到素材学习流程：`$brand <URL>`

应用顺序：

1. `{assetRoot}/brand-evidence.json`：确认原始证据、频次、上下文和用户校准过的判断。
2. `{assetRoot}/dangoui-adapter.json`：提取可进入 `--du-*` 的 tokens，以及只能进 `demoOnlyVisualControls` 的内容。
3. `{assetRoot}/component-mapping.json`：决定页面结构和 dangoui 组件组合。
4. `{assetRoot}/preview-gate.json`：决定应该应用到哪些核心页面或 preview 页面。
5. `{assetRoot}/echo-mapping.json` / `brand-profile.dtcg.json`：确认 fallback、style-only、missing、ask-user。

落地约束：

- `mapped` token 可以进入主题变量或 token override。
- `fallback` token 可以使用最近值，但必须保留注释或 adapter 记录。
- `style-only` 只进页面样式层、主题 class、asset 或 demo visual control。
- `missing` 和 `ask-user` 不要强行实现成假 token。
- 如果迁移资产和宿主项目现有设计系统冲突，先保留宿主项目 API 和命名，再用局部 theme class 承接品牌表现。
- 如果 `dangoui-adapter.json` 暴露 `--style-border-frame`、`--style-divider-color`、`*Frame.applyRecipe` 或类似 Frame / Divider style-only 配置，必须落地为 CSS。只初始化 `--du-border-1` 或 Divider 颜色会丢失装饰框。
- Frame / Divider style-only CSS 至少包含：目标作用域、真实容器 border、贴边角线或 asset fallback、radius、反例排除区域。

### DangoUI 映射完整性 Gate

映射完成不等于 JSON 文件存在。标准链路必须能从 `brand-profile.dtcg.json` 追到 `dangoui-adapter.json`、`component-mapping.json` 和 `mapping-runtime-proof.json`；正式放行还要有独立 Mapping QA。运行：

```bash
node skills/brand/scripts/validate-dangoui-mapping.mjs --brand <brand> --strict
```

这个 Gate 只固化平台级完整性，不固化任何单品牌视觉结论。它检查：DTCG 与 adapter target 不漂移；mapped token 确实指向已有 `--du-*`，style-only 不冒充 DangoUI；每项有 evidence、allowed role 和 runtime consumer；native component 有真实源码/API/selector 证明；composition 不伪装成组件；runtime proof 无 pending；独立 Mapping QA 无 blocker。颜色值、构图、页面类型等仍由各品牌冻结证据和 Visual QA 决定。

### 公开宿主的 DangoUI Runtime Gate

需要把“映射”升级为真实 DangoUI 组件消费时，先运行 `prepare` 获取与宿主锁文件一致的安装命令；只有用户已授权修改依赖时才加 `--install`：

```bash
node skills/brand/scripts/dangoui-runtime-gate.mjs prepare --root <host> --version <exact-version> --platform h5
```

实现、构建和浏览器验证后运行：

```bash
node skills/brand/scripts/dangoui-runtime-gate.mjs verify --root <host> --version <exact-version> --platform h5 --components DuInput,DuTextarea,DuButton --source <consumer-files> --style-entry <global-entry> --evidence <fresh-runtime-evidence.json>
```

公开分发必须使用宿主自己的包管理器、锁文件和 registry 配置；不得写入 `file:/Users/...` 等本机路径，也不得把本地 DangoUI 源码当成宿主已安装的证明。声明版本、锁文件命中版本、`node_modules/dangoui/package.json` 实际版本和安装包导出 API 必须一致。runtime evidence 至少包含同一平台的 `renderedConsumer`、`bundleContainsDangoui`、`businessParity` 三项 PASS。当前公共契约只验证 H5；小程序或其他平台没有独立证明时必须报 `DANGOUI_PLATFORM_UNVERIFIED`，不能从 H5 外推。

状态口径固定为：无真实 runtime consumer 是 `PARTIAL_STYLE_ONLY`；仅 H5 通过上述 Gate 是 `PASS_REAL_COMPONENT_CONSUMER_H5_ONLY`；不得省略平台后缀宣称全平台接入。

## 7. Style Pack 应用链路校验

应用已有 style pack 时，不能只生成主题变量或 migration 报告。必须建立并验证完整链路：

```text
evidence
→ adapter token / recipe
→ generated CSS / asset
→ consuming selector / component
→ computed style
```

### 7.0.0 宿主风格诊断

应用 style pack 前必须先建立宿主项目快照。这个诊断是 skill 内部迁移依据，不是让运营理解或手动选择。

必须扫描并记录：

- 项目框架、路由模式、默认入口、默认 TabBar / 首页 route。
- 页面文件和样式入口：`router`、`app`、layout、page、component、global style。
- 宿主真实 DOM/class 体系：页面根 class、业务组件 class、DangoUI 组件 class、scoped style 选择器。
- 现有 DangoUI 使用：组件名、props、slots、状态类、是否消费 `--du-*`。
- 现有视觉生产者：`--du-*`、`--style-*`、主题 class、utility class。
- 硬编码视觉值：hex/rgb/hsl、`background`、`border`、`border-radius`、`box-shadow`、`font-family`、`animation/transition/transform`、图片 URL。
- 当前业务内容边界：文案、字段、列表数据、图片语义、点击/提交/跳转。

诊断产物至少包含三张内部表：

```text
routeBinding: 默认入口 / route / page file / style file / app shell
selectorInventory: 宿主真实 class / component / file / visual role
hardcodedVisuals: file / selector / property / value / replacement token or recipe
```

没有完成宿主诊断，不能直接把 style pack 写入宿主项目。否则会出现 token 定义存在、CSS selector 不命中、硬编码旧样式覆盖主题变量的问题。

### 7.0 宿主内容保护

应用 style pack 是“给当前业务页面换皮”，不是“把参考站内容搬进项目”。默认保留宿主项目的页面路由、业务文案、字段、按钮含义、数据列表、图片语义、表单顺序和原有点击/跳转/提交交互。

参考站 demo 页面只提供视觉证据和组件组合参考，不提供可复制的业务内容。除非用户明确要求生成营销页或示例页，不得把参考站的角色名、剧情、栏目名、品牌口号、活动文案写进宿主项目。

如果确实需要新建 preview route，它必须优先复用宿主已有页面、组件、mock 数据和真实文案，作为“换肤副本”。不得为了展示风格而新造与宿主业务无关的内容。

风格迁移必须遵循 demo 站对应风格原子的视觉事实：结构、资产、组件语义、状态、触发方式和适用位置都要对齐 demo。不能为了凑效果自造新的视觉符号、图标、文案、装饰或交互。如果宿主项目缺少对应 asset、icon、slot、state 或组件能力，保留宿主业务语义，并把缺口写入 ReviewQueue / 未承接。

### 7.0.1 宿主组件结构保护

应用 style pack 时，组件结构优先级固定为：

```text
宿主项目现有组件/API/DOM
  ↓
当前 DangoUI 正式组件、props、slots、状态类
  ↓
DangoUI 组件组合 composed
  ↓
style-only 装饰层 / asset layer
  ↓
ReviewQueue / 未承接
```

已有 DangoUI 或业务组件不能被手写替代结构覆盖。禁止为了快速接近参考站效果，重新写一套 `.tabs button`、`.card`、`.tabbar`、emoji 图标、临时 SVG、临时装饰线来替代原组件。必须先保留原组件语义和交互，再用 token、局部 selector、slot 内容、asset layer 或 style-only recipe 承接品牌风格。

判断标准：

- `Tabs` 仍然是内容频道 / 维度切换；应该复用 `DuTabs / DuTab` 或宿主 Tabs API。不要把 `TabBar` 的底部导航样式套到 Tabs。
- `TabBar` 只表示底部一级导航；可以迁移底部壳、HomeIndicator 避让、active 线和 hover/press，但不能替代页面内 Tabs。
- `BottomBar` 表示页面核心操作区；不要和 TabBar 混用。
- `Button / IconButton / FAB` 各自保留组件语义；不能用图片、emoji 或纯 div 假装按钮状态。
- `Card / Group / Panel` 的风格化 frame 只能作用到被证据标记为重点容器的位置；普通列表、Tabs 容器、按钮区不默认套 ornate frame。
- `Image / Asset / Frame` 可以组合，但不能把业务内容卡片变成参考站内容卡片。

如果必须新建 preview route 来验证换肤，preview 也必须遵守同一优先级：用宿主业务内容和 DangoUI 组件结构验证，不写与 demo 站组件页不一致的临时 mock 组件。若只是为了说明某个 style-only 能力，可以新增最小样例，但该样例不计入“已应用到业务项目”的验收。

输入来自 demo 页面 URL 时，先抽取该页面所有可见风格原子和页面壳消费点，作为应用检查表：

- 页面壳：NavigationBar、TabBar、BottomBar、FAB、HomeIndicator。
- 内容组件：Tabs、Button、Tag、Card/Group、Image、Swiper、List、Form control。
- 风格能力：Color、Typography、Icon、Divider、Frame、Radius、Shadow、Asset、Motion。

页面壳不进入参考站品牌采样统计，但只要 demo 站已经对页面壳做了主题化表达，应用到宿主项目时也必须作为消费点迁移。宿主存在同类组件时要对齐 demo 的视觉状态；宿主不存在或组件 API 不支持时写入未承接，不能静默保留默认样式。

### 7.0.2 初始状态验收

用户验收首先看“打开项目后的第一眼”，不是迁移报告。应用 style pack 后必须验证初始状态：

- 打开最终预览 URL 的根地址或默认路由，例如 `http://localhost:<port>/`、`/#/pages/home/index`、默认 TabBar 选中页。
- 记录默认首页、默认 TabBar 选中项、首屏 Hero / feed / card / list / button 的 computed style。
- 首屏背景、文字、主按钮、普通卡片/重点卡片、NavigationBar / TabBar 至少各有一个真实消费点命中品牌 token 或 style-only recipe。
- 如果只改了二级页面、隐藏页面、手动跳转页面，默认入口仍是原始样式，则不能写“已换肤页面/路由”或“构建成功”作为完成。
- 如果列出多个已换肤路由，必须逐一打开这些路由并验证至少一个可见节点的 computed style；未打开验证的路由只能写入“待验证”。

常见失败：

- 只 import `src/styles/{brand}-theme.css`，但页面根节点没有 `.g-theme-{brand}` 或对应作用域。
- 只改 `app.config.js` 的 NavigationBar / TabBar 颜色，页面内容仍用旧 SCSS 写死色值。
- 只替换 `--du-*`，但宿主组件没有消费这些变量。
- style-only frame / asset / motion 写在 CSS 里，但没有任何首屏 selector 命中。
- dev server 根地址打开的是旧页面，换肤页藏在另一个 route。
- 新建 `/{brand}`、`*-showcase` 或隐藏 preview 页面可见，但用户原本的默认首页、默认 TabBar 页和原路由仍保持旧样式。

默认入口修复顺序：

1. 优先给原页面根节点、原页面样式文件、原 layout / app shell 增加品牌作用域或 token 覆盖。
2. 如果必须新建换肤副本，调整路由、TabBar 或默认跳转，让用户打开项目根地址即可看到换肤版。
3. 如果因风险不能改默认入口，最终回答必须写“预览阻塞 / 仅 preview route 已换肤”，不能写“默认首页已换肤”。

新建页面只用于可回滚 preview，不是默认交付策略。验收以用户打开业务项目第一眼为准。

### 7.0.3 Git checkpoint 与 `/brand rollback`

应用 style pack 的默认目标是原页面、原路由、原 TabBar 默认入口。回退能力不默认进入业务 UI，而是由 skill 在代码层创建版本锚点。

命令语义：

```text
/brand <style-url>
  -> 默认创建 rollback checkpoint commit
  -> 应用风格到原页面

/brand rollback
  -> 回到最近一次 /brand 前的 checkpoint

/brand commit --rollback
  -> 只创建 checkpoint，不应用风格
```

`<style-url>` 是风格来源 URL，不是回退 URL。回退目标始终是“执行 `/brand` 前的原始版本”。Showcase 阶段只支持最近一次 checkpoint，不做多版本历史管理。

#### Git 仓库主路径

如果宿主项目是 git 仓库，改动任何业务代码前必须先创建 checkpoint commit。

执行顺序：

1. 读取当前 branch、HEAD commit、dirty file list。
2. 如果 working tree 有未提交改动，先把当前状态作为 checkpoint commit；这是用户执行 `/brand` 前的原始版本。
3. 写入 `migrations/_brand-rollbacks/latest.json` 和带时间戳的历史 manifest。
4. 再开始应用 style pack。

checkpoint commit 示例：

```bash
git add -A
git commit -m "chore(brand): checkpoint before applying re1999"
```

manifest 至少包含：

```json
{
  "type": "git-checkpoint",
  "brand": "re1999",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "branch": "main",
  "checkpointCommit": "abc1234",
  "command": "/brand http://127.0.0.1:5174/#/brand/re1999/pages/re1999-home",
  "rollbackCommand": "/brand rollback"
}
```

如果 working tree 是干净的，也要记录当前 HEAD 作为 checkpoint；可选择创建一个空 checkpoint commit：

```bash
git commit --allow-empty -m "chore(brand): checkpoint before applying re1999"
```

是否使用空 commit 取决于宿主项目习惯；无论是否空 commit，都必须有可读 manifest 指向可回退 commit。

#### `/brand rollback`

`/brand rollback` 读取 `migrations/_brand-rollbacks/latest.json`，回到最近一次 checkpoint。

回退前必须：

- 展示 checkpoint commit、当前 branch、将被回退的文件范围。
- 如果当前 working tree 有用户在换肤后新增的未提交改动，先提示风险；不能静默丢弃。

回退方式以宿主项目安全为准：

- 确认要回到 checkpoint：`git reset --hard <checkpointCommit>`。
- 需要保留当前换肤结果做对照：先创建临时 branch，再 reset。
- 不允许 reset 时，输出明确命令给 vibecoder 手动执行。

回退完成后必须重新启动或复用 dev server，确认默认入口回到 checkpoint 状态。

#### `/brand commit --rollback`

该命令只创建 checkpoint，不应用任何风格。

适用场景：

- 用户准备做大改，想先手动打点。
- 当前项目即将交给 Claude/Codex 执行多步风格实验。

执行后只输出 checkpoint commit 和 rollback manifest 路径，不改页面。

#### 非 Git fallback

如果宿主项目不是 git 仓库，才使用文件级备份：

- 写入 `migrations/_brand-rollbacks/latest.json`。
- 复制将要改动的文件到 `migrations/_brand-rollbacks/files/<timestamp>/`。
- 记录 file hash、原路径、备份路径和恢复命令。

非 git fallback 只作为兜底；GitHub/GitLab 项目默认走 commit checkpoint。

### 7.1 生产者扫描

先收集 style pack 和宿主项目里的所有视觉生产者：

- `--du-*`
- `--style-*`
- DTCG token
- `demoOnlyVisualControls`
- `assetRecipes`
- `@font-face`
- 图片、视频、字体资产
- motion recipe
- Frame / Divider recipe

CSS 中出现的 `--style-*color*`、`--style-*shadow*`、`--style-*radius*`、`--style-*border*`、`--style-*frame*`、`--style-*bg*`、`--style-*font*`、`--style-*motion*`、`--style-*asset*` 若不在 evidence / adapter 中，默认视为宿主或 agent 自行添加，必须删除、回退或加入 ReviewQueue。

### 7.1.1 二进制资产引用

二进制资产是 asset，不是 CSS 文件。生成 theme CSS、页面 SCSS 或全局样式时，禁止用 `@import` 加载这些文件：

```text
.ttf / .otf / .woff / .woff2
.png / .jpg / .jpeg / .webp / .gif / .svg
.mp4 / .webm / .mov
```

正确落地方式：

- 字体：`@font-face { font-family: "..."; src: url("/assets/.../font.ttf") format("truetype"); }`
- 图片纹理：`background-image: url("/assets/.../texture.png")`
- 图片边框：`border-image`、`mask`、`::before/::after`、9-slice 或 asset layer
- 内容图片：`img src` / Image 组件 slot
- 视频：`video src` / Video 组件 slot
- SVG icon：优先走 DangoUI Icon / IconButton；确实是品牌资产时作为 Image / mask / background asset

`assetRecipes.role === "font"` 或 adapter 里写有 `@font-face` 证据时，必须生成 `@font-face`，不能改写成 `@import url(font.ttf)`。`@import` 只允许引入 CSS 文件。

生成 CSS 后必须做静态扫描：

```text
@import ... .ttf|.otf|.woff|.woff2|.png|.jpg|.jpeg|.webp|.gif|.svg|.mp4|.webm|.mov
```

命中即视为构建阻塞，必须在运行 build 前修复。不要把 dev server 可启动当成通过；Vite / PostCSS / Taro build 会把错误的二进制 `@import` 当文本解析。

### 7.2 消费者扫描

再扫描宿主项目中所有消费点：

- CSS / SCSS / Vue / React / Taro / JSX / TSX / 小程序文件中的 `var(--du-*)`、`var(--style-*)`
- 直接声明的 `color`、`background`、`background-image`、`border`、`border-radius`、`box-shadow`、`filter`
- `font-*`、`animation`、`transition`、`transform`、`mask`
- `img/src`、`svg/fill/stroke`
- Uno / Tailwind 类：`text-*`、`bg-*`、`border-*`、`rounded-*`、`shadow-*`、`animate-*`

如果消费者没有接到变量、被旧样式覆盖，或者 computed style 与 style pack 不一致，优先在 `.g-theme-{brand}`、页面根 class 或 preview 根 class 下覆盖真实 declaration。不要只改 root variable 后等待 HMR、scoped style、CSS Modules、Taro chunk 或小程序编译自动传导。

初始状态消费者必须单独列出来：`app/root`、默认首页 page root、默认 TabBar page、首屏内容容器、首屏主按钮、首屏重点卡片/列表项。它们全部缺失时，说明 style pack 没有应用到用户会看到的页面。

### 7.2.0 样式作用域与加载顺序

theme CSS 必须处在能影响目标页面的作用域里。不能只确认文件被 import，还要确认它没有被框架局部样式机制隔离或覆盖。

常见框架规则：

- Vue：主题文件优先放在 `main.ts`、`app.scss`、全局 `<style>` 或页面非 scoped `<style>`；不要放进 `<style scoped>` 后假设全局生效。
- Vue scoped：`@import` 进 `<style scoped>` 后，选择器可能被编译成 `[data-v-*]` 作用域；页面自己的 scoped 规则也可能在后面覆盖 theme。
- CSS Modules：theme selector 不能依赖被 hash 的局部类名；需要绑定模块导出的真实 class，或在全局层写品牌作用域。
- Taro / 小程序：page chunk、app style、component style 的加载顺序不同；必须在真实 H5/小程序预览里看 computed style 来源。
- Uno / Tailwind：utility class 可能比 theme 更晚注入或更高优先级；必须在品牌作用域下覆盖真实 declaration。

修复顺序：

1. 优先把 theme 变量和基础消费规则放到全局样式入口。
2. 页面级覆盖放到非 scoped style，或使用框架支持的全局选择器语法，例如 Vue `:global(...)`。
3. 只在必要时给页面根节点加 `.g-theme-{brand}` / `.theme-{brand}` 作用域。
4. 如果必须在 scoped style 内写品牌样式，selector 必须命中编译后的真实 DOM，且通过 computed style 验证来源。
5. 不用 `!important` 作为默认解决方案；只有宿主强约束无法移除时才局部使用，并写入 ReviewQueue。

### 7.2.1 Selector 对齐表

style pack 里的 selector 不能直接假设宿主项目存在。`demoOnlyVisualControls.targetScope`、demo selector、adapter selector 和宿主 selector 必须建立显式对齐表：

```text
adapter/demo selector
→ visual role
→ target route/page
→ host component
→ host selector/class/slot
→ status: matched / remapped / missing / review
```

规则：

- `matched`：宿主 DOM 真实存在该 selector，可直接消费。
- `remapped`：demo selector 不存在，但找到了等价宿主组件/class，生成 CSS 时必须改写成宿主 selector。
- `missing`：宿主没有对应组件或容器，不能静默生成无效 CSS；写入未承接或新增最小 preview。
- `review`：可能命中但语义不确定，不能自动覆盖业务内容。

CSS 生成必须使用 `host selector/class/slot`，不是使用 adapter 原始 demo selector。比如 `.ink-card` 只代表“重点内容卡片”这个 visual role；如果宿主真实类名是 `.re1999-card`，生成 CSS 必须命中 `.re1999-card` 或其品牌作用域组合。

每条生成 CSS 规则都必须反向验证：

```text
generated selector -> querySelector/querySelectorAll count > 0 -> computed style from generated declaration
```

`querySelectorAll` 为 0 的规则不能算完成；要么重映射 selector，要么删除无效规则并写入未承接。

### 7.2.2 硬编码视觉值替换

宿主 scoped style、CSS Modules、utility class 或组件内联样式中的硬编码视觉值优先级通常高于主题变量。应用 style pack 时必须处理硬编码。

替换策略：

- 颜色：替换为 `var(--du-*)` 或品牌作用域下的 `--style-*`，并保留语义链路。
- 圆角：容器 radius 用 frame/card/media 判断；控件 radius 单独处理。
- 阴影：无证据 shadow 覆盖为 `none`；有证据 shadow 才写 recipe。
- 边框 / Frame：普通 border 可改 token；风格化 frame 必须作用到真实父容器边界。
- 字体：硬编码 `font-family` 必须接入已声明的 `@font-face` 或品牌字体 fallback。
- 动效：旧动效不能无依据保留；目标 motion recipe 必须命中真实对象。

硬编码替换必须优先保持宿主业务语义，不为了套风格改文案、结构或数据。

无法自动替换时，最终输出必须列出：

```text
file / selector / property / current value / expected token or recipe / reason
```

### 7.3 视觉层覆盖范围

链路校验覆盖所有视觉层，不只 shadow：

- Color：品牌色变量必须被真实 `color / background / border-color / fill / stroke` 消费；旧色或旧 utility 覆盖时要在品牌作用域下替换。
- Radius：frame/card/media radius 必须服从边界语言；旧 `rounded-*` 或组件默认圆角冲突时要覆盖真实声明。
- Shadow：没有强 shadow 证据时，旧 `box-shadow`、`filter: drop-shadow`、`shadow-*` 必须降级为 `none` 或 brand recipe 指定弱阴影。
- Border / Divider / Frame：普通 border 可映射 `--du-border-*`；风格化 frame/asset frame 必须落到父容器真实边界，不能只改变量或在内部新增一层线。
- Background / Texture / Asset：texture、背景图、选中态、角色图、装饰层必须落到真实 selector、slot 或 asset URL。
- Typography：`@font-face` 存在但页面仍用宿主默认字体，不算完成。
- Motion：motion recipe 必须落到真实对象的 `animation / transition / transform`；没有动效证据时，宿主旧动效不能无依据保留。
- Content：视觉迁移不能改掉宿主业务内容；如果 selector 命中后发现组件文字、slot、数据源或路由被替换为参考站内容，必须回退内容，只保留视觉层改动。

### 7.4 Frame recipe 成功标准

Frame recipe 不是普通 `border` 的同义词。只给现有组件补 `border: var(--style-frame-border)` 只能算 plain border fallback，不能证明风格化边框已应用。

若 evidence / adapter 标记为 `frame / asset-frame / texture-frame`，必须生成并应用完整 frame recipe：

- 目标 selector
- 父容器边界
- radius 联动
- edge / corner / pseudo 或 border-image 实现
- background / texture 联动
- antiScopes
- fallback
- computed-style 验证

Frame recipe 必须应用到宿主项目的真实业务容器，例如现有 Card / Group / Panel / Media / Hero / 商品卡 / 内容面板。允许新增最小样例用于解释“卡片外框 / 图片展示区可以怎么用”，但样例不计入验收完成。

如果输入来自 demo / registry URL，必须把源 demo 中对应 frame selector 的结构性样式作为参照，至少对比：

- `background-image / background-size / background-position` 的多层边框写法
- `border / outline / box-shadow inset`
- `::before / ::after` 角线或装饰层
- `border-image / mask`
- `radius`
- `shadow / no-shadow`
- `overflow`

宿主项目目标容器必须复现同类 recipe；只落成普通 `1px solid` 或 `0.5px solid` 不算完成风格化边框。

### 7.5 单位与可见性校验

不能只看源码是否写了 `1px`、`var(--style-frame-border)` 或某个 token。必须读取浏览器/模拟器里的 computed style。

对 border、divider、frame、inset line、hairline、radius、spacing、font-size 等会被 Taro、postcss-pxtransform、rem/rpx、小程序编译链转换的属性，必须确认最终像素值和视觉效果仍符合 evidence / adapter。

如果 evidence / adapter 要求可见父容器边界，但 computed `border-width`、`outline-width`、`box-shadow inset spread`、伪元素尺寸等低于 1 CSS px 或肉眼不可见，不能判定通过。修复时优先使用 token 颜色，例如 `var(--du-border-1)` 或 adapter 指定变量；不要因为单位转换问题直接硬编码品牌十六进制。只有宿主编译链无法解析变量时才允许局部硬编码，并写入 ReviewQueue。

### 7.6 Shadow 特例

如果 `brand-evidence.json` 或 `dangoui-adapter.json` 出现 `do not add generic shadow`、`do not replace with generic shadow`、`没有证据的 shadow` 等含义，且 adapter 没有明确 shadow token / recipe，则 `--style-card-shadow`、`--style-panel-shadow`、`--style-media-shadow` 等必须写为 `none`。

如果宿主样式写了 `box-shadow: var(--style-card-shadow)`、`box-shadow: var(--style-panel-shadow)` 或类似 shadow 变量，而 evidence / adapter 判定 shadow 为 `none`，必须把对应声明在品牌作用域下改成或覆盖为 `box-shadow: none`。不要只修改变量定义后等待 HMR、chunk 或编译产物自动生效。

## 8. 风格原子表达规则

风格 tabs 是给运营和 AI agent 点名使用的风格部件说明书，不是设计师 token 表。每个原子先回答“这是什么、能用在哪、不要怎么用”，再用弱化归属说明它是 token 覆盖、style-only Frame/Asset/Motion，还是 DangoUI baseline。

### 8.1 是否能成为原子

只有源站或 demo 页面里确实出现并可定位到选择器、资产、组件或状态的样式，才能放进风格 tabs 的可用原子卡。没有明确落点的选中线、阴影、动效或装饰只能进入候选或反规则，不得和真实可用原子同级展示。

反规则不伪装成原子样式。例如：

- “不用厚阴影”属于 Shadow 策略。
- “不要保留圆角”属于 Radius / Frame 联动规则。
- “不要内部套边框”属于 Frame recipe 反例。

### 8.2 展示字段

每个风格原子的展示字段固定为：

- 中文标题
- 纯视觉示意
- 一句话
- 适合用在
- 不要这样用
- 归属

视觉示意只展示形态，不放解释文字；解释文字放在下方。归属用于说明承接方式，而不是简单写 DangoUI / 非 DangoUI。

归属分类建议：

- `{brand} token 覆盖 · --du-*`
- `{brand} 风格化样式 · style-only Frame/Asset/Motion`
- `DangoUI baseline`

品牌页里不要把 token 覆盖误写成 DangoUI 原生样式。标题、归属和展开箭头使用同一分类色，帮助快速区分 token 覆盖与风格化样式；不要用颜色暗示错误归属。

### 8.3 页面示例和 hover

如果某个风格原子已经在 demo 页面中使用，页面元素 hover 要提示它的用途，例如：

```text
组件 - 数据输出 - Image
风格 - Divider - 媒体角线框
风格 - Asset - 页面底纹
```

hover 只负责说明当前元素是什么和用了什么风格能力，不触发跳转到组件页。真实页面点击行为应优先保持业务场景逻辑。

宿主项目中的 hover / 标注 / preview helper 不能改变真实业务内容；它们只能作为检查层或演示层存在，关闭检查层后页面应回到业务项目原本的信息和交互。

### 8.4 运营话术

对非设计专业运营，优先用页面位置解释 style-only 能力：

- 卡片外框：适合商品卡、活动卡、角色档案卡、内容面板。
- 页面底纹：适合首页背景、详情页背景、专题页背景。
- 图片展示区：适合封面图、角色图、视频图、商品主图。
- 选中状态：适合 Tab、分类按钮、卡片选中态。
- 主视觉动效：适合首页大图、背景、角色展示。

## 9. 废弃层

`--du-c-*` 视为旧层，不作为品牌迁移目标。

如果真实 DOM class 仍出现 `du-c-*`，只把它作为组件别名链路证据，不把它作为新品牌迁移的输出 token。
