# DangoUI：冻结学习原件的设计说明

## 文档身份与证据边界

这是由现有学习原件整理的衍生文档，仅对应公开目录 `public/brand-registry/v0.1/brands/dango/0.2.0/` 的五份 JSON。它不是 Google/Stitch 运行产物，不代表重新采集、完整品牌学会或当前宿主验证。本轮没有访问来源站、生成图片或复测交互；下文“原件记录的观察”只转述有 `capture`、`sourceRegion` 和 DOM/computed 数据对应的历史 evidence claim。数值来自 JSON 中保存的测量，不能声称仅凭截图精确测得。

来源 JSON key：`brand-mod.json#/manifest`；`brand-intent.json#/interpretationBoundary`；`brand-evidence.json#/claims`。路径、原始字节 SHA-256 与本说明引用的 JSON Pointer 见同目录 `sources.json`。

适用范围：原件内部品牌 ID 为 `dango-v2`，manifest 版本为 `0.2.0-draft`，scope 为 documentation learning test；公开目录名 `0.2.0` 不改变该限制。未知：当前站点、当前组件版本及任一真实业务宿主是否仍匹配。`evidence-pass-for-frozen-scope`、`approved-for-direction`、`native-runtime-consumed` 等均为原件历史状态，尤其旧 source-runtime/consumer/computedVerification 声明不能作为当前宿主已经接入或通过验证的凭证。

## 色彩语义

|角色|原件值|映射与边界|
|---|---|---|
|文档页面画布|`#ffffff`|`--du-bg-2`；不推及媒体表面|
|文档模块表面|`#ffffff`|`--du-bg-1`；不承担导航选中态|
|文档主文本|`#000000`|`--du-text-1`；不推及深色媒体背景|
|安静分隔线|`#0000001f`|`--du-border-1`；不是焦点环|
|normal Primary 填充|`#7C66FF`，白字|`--du-primary-solid-bg`；只限该主按钮样本|
|当前页导航文字|`#5854FF`|style-only `--style-docs-navigation-current`；背景 `rgba(88,84,255,0.08)`|

原件记录的观察：`dango-v2-active-navigation` 对应 introduction 桌面截图的当前页行；`dango-v2-primary-button` 对应 default 按钮截图。两种紫色承担不同局部状态，不能互换或扩大为全局强调色、大片底色或 section chrome。前三种中性色与分隔线在这里按原件 token/adapter 合约列出，不另称本轮截图观察。边框原件同时保存 `#0000001f` 与 computedVerification `rgba(0,0,0,0.12)`；不把两种精度记录擅自改成新的 token。

来源 JSON key：`brand-mod.json#/tokens/dtcg`、`#/semanticRoles`；`dangoui-adapter.json#/tokenMappings/0` 至 `#/tokenMappings/5`；`brand-evidence.json#/claims/2`、`#/claims/5`；`brand-intent.json#/patterns/2`。

适用范围：浅色文档壳与已取样状态。未知：完整色阶、暗色模式、成功/警告/错误语义及其他按钮变体；不得从颜色表补出这些规则。DTCG 在原件中声明为 reusable token 的规范来源，mapped/styleOnly 为兼容镜像。

## 字体与内容层级

原件记录的观察：introduction 的 H1 为 `36px / 700`，H2 为 `24px / 600`。阅读顺序为标题、解释性正文、平面技术流程块、结构化列表和后续章节。原件将该组合解释为依靠字号、字重、间距和安静表面建立层级；这属于原件解释，不是新增视觉观察。

来源 JSON key：`brand-evidence.json#/claims/3`（`capture`、`visibleDom`、`computed`、`supportingComputed`）；`brand-intent.json#/patterns/1`、`#/styleRecipeDetails/1`、`#/unresolvedClaims/0`。

适用范围：文档阅读栏、概念介绍和技术说明，可替换内容并保留层级。未知：可复用的全局 font-family、完整字号梯度、正文行高/字重以及不同语种字体策略。不要把 H1 bounding box 高度当作已确证的 line-height，也不要补写品牌字体名称。

## 布局、间距、圆角和按钮尺寸

原件记录的观察：1440×900 桌面文档具有 56px 顶栏，左导航 200px、阅读区域 1060px、右侧大纲 180px；390×844 样本中两侧栏消失，主栏宽 390px。原件也记录了移动端标题被固定顶栏局部遮挡；该问题不是应复刻的设计规则。

normal Primary 样本 bounding box 为 `77.15625 × 32px`，圆角 `4px`；当前页导航样本圆角 `8px`、bounding box 为 `175 × 32.5px`。这些是具体样本几何量，不是所有按钮固定宽度、所有导航行固定高度或全局圆角尺度。仅 `32px` 高和 `4px` 圆角进入原件的 Primary style-only 映射。

来源 JSON key：`brand-evidence.json#/claims/0`、`#/claims/1`、`#/claims/2`、`#/claims/5`；`brand-intent.json#/patterns/0`、`#/antiPatterns/5`；`brand-mod.json#/tokens/styleOnly`；`dangoui-adapter.json#/tokenMappings/6`、`#/tokenMappings/7`。

适用范围：已取样文档壳的桌面到移动阅读重排，以及 normal Primary。未知：通用 spacing scale、按钮 padding/gap、断点阈值、中间宽度行为、完整尺寸体系及全局圆角。截图坐标和栏宽不能直接提升成通用间距 token。`brand-mod.json#/platformOverrides/web` 的 container-query reflow 是原件实现声明，不是本轮运行确认。

## 导航与按钮状态

|状态|原件记录|限制|
|---|---|---|
|导航 current-page|紫色文字、浅紫底、8px 圆角|来源是 `a[aria-current="page"]`；不能推出 hover 或其他导航状态|
|Primary default|紫色填充、白字、32px 高、4px 圆角|normal Primary 样本|
|Primary hover|default、25ms 过渡与180ms稳定 hover 的历史裁图记录为像素一致，填充不变|仅说明该采样中未观察到变化，不是全站无 hover|
|Primary focus|填充不变，`1px auto` 外框，`rgb(0,95,204)`|原件称浏览器可见外框；不是品牌蓝色语义|
|Primary activated|点击后稳定状态与 focus 裁图一致|不是 pointer-down/pressed 瞬间的证据|

来源 JSON key：`brand-evidence.json#/claims/2`、`#/claims/5` 至 `#/claims/8`；`brand-intent.json#/interactionRecipes/0`、`#/antiPatterns/2`。

适用范围：该 normal Primary 的 default/hover/focus/点击稳定后状态；原件允许平台等效且独立可见的焦点指示。未知：disabled、loading、pressed 瞬间、触摸、其他浏览器及全部变体。不补写缩放、位移、阴影或新 hover 颜色。

## 组件映射与 expressive 边界

|原件 pattern|已有映射|适用范围|
|---|---|---|
|`dango-primary-button-state-contract`|`DuButton`，`type="primary"`、`size="normal"`、`extClass="dango-docs__primary"`|只限 normal Primary；旧 runtime selector 为 `button.du-button.dango-docs__primary`|
|`dango-docs-shell-responsive`|style-only composition|导航—阅读—大纲的桌面结构与移动单栏，没有整壳 catalog 组件|
|`dango-editorial-technical-hierarchy`|style-only composition|标题—正文—技术流程—后续章节，技术流程不冒充 Card|
|`dango-purple-state-roles`|style-only 当前导航|旧 selector `.dango-docs__nav-group > span.is-current`；不外扩紫色语义|

原件 adapter 指向 `dangoui` `3.6.16`。上述 native/runtime-consumed 状态是原件记录，没有在本轮安装、导入或调用组件。语义 DOM/CSS 独立重建属于原件允许的转换；来源截图只可作为证据，不可放进 runtime 冒充实现。

已观察到的品牌表现证据仅覆盖文档构图、内容替换、章节增减和响应式重排；这不是宿主原创 expressive 的创意上限。原件未证明 hero、活动视觉、插画、品牌背景或运动资产属于官方品牌语言；全局阴影体系、图像/动效语言仍 unresolved。宿主可以探索与任务相符的原创插画、材质、空间和构图，须标为生成提案，遵守真实业务和有证据的品牌约束，不冒称官方资产或反写品牌规则。不得据字体图标清单猜测可见资产，也不得凭空宣称官方身份 IP 或吉祥物。原件对 highCarrier 的三维大面积信号组合仍标为 unresolved；不能通过放大紫色小控件补足官方学习证据。

来源 JSON key：`component-mapping.json#/mappings`；`dangoui-adapter.json#/catalog`、`#/tokenMappings`；`brand-intent.json#/assetRoleBoundaries`、`#/distinctivenessSignalContract`、`#/unresolvedClaims`、`#/antiPatterns`；`brand-mod.json#/assets`、`#/manifest/scope`。

适用范围：冻结文档学习成果的阅读与后续适配参考，不授权宿主应用。未知：真实宿主兼容性、当前版本组件 API、业务保留、运行 token 消费与视觉 QA。本说明不填补这些证据缺口，也不改变发布包。
