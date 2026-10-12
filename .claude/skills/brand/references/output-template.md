# 输出模板

本文档只回答一件事：`$brand` 完成分析后，应该产出哪些文件、每个文件写什么。

不在这里解释映射规则；映射规则见 `mapping-rules.md`。
不在这里解释长期资产架构；资产架构见 `brand-dtcg-migration-asset-standard.md`。

## 目录

- `1. 推荐目录`：`migrations/{brand}/` 文件结构。
- `2. JSON 文件职责`：各 JSON 负责什么。
- `3. README 结构`：人工可读迁移说明。
- `13. Existing Migration Assets 应用记录`：复用 style pack 时的交付记录。

## 1. 推荐目录

```text
migrations/{brand}/
  goal-contract.json
  preview-gate.json
  brand-evidence.json
  brand-profile.dtcg.json
  echo-mapping.json
  dangoui-adapter.json
  uno-adapter.json
  component-mapping.json
  README.md
```

learn-brand 的 Demo 是学习能力测试，不是官网镜像、品牌素材模板或宿主 apply 成果。交付说明必须分别报告 `Evidence Proof / Structure Proof / Generative Proof`；任一项 blocked 时，不能用综合观感或 build pass 宣称完成。

apply-host 另需 `brand-distinctiveness-assessment.json`，包含同视口 source/host 截图对、遮蔽品牌名/Logo/显式文字后的 blind recognition、visual mass / asset / composition / type / motion 五维评分、可见 signal 的 viewportAreaRatio 和 Evidence refs。最终状态必须分列：

```json
{"workflowCompletion":"PASS|BLOCKED","businessSafety":"PASS|FAIL","visualDistinctiveness":"PASS|FAIL"}
```

禁止输出把三者混合的 `overallScore` / `overallPercent`。技术或业务 Gate 通过不补偿 `visualDistinctiveness: FAIL`。

## 2. JSON 文件职责

### `preview-gate.json`

保存正式迁移前的视觉方向预审结果：

- 2-3 个 preview demo 的方向说明。
- 每个方向的气质、信息密度、色彩假设、组件模式假设和核心页面。
- 如果是 2-3 个 demo 页面，记录每页的真实页面结构、独有内容、独有组件模式和验证信号。
- 用户选择、合并、否定或继续探索的决定。
- 被否定方向的原因。
- 进入正式 DTCG / Echo / dangoui 迁移的决策。

preview demo 的临时 class、裸 CSS value 和页面变量只能作为探索证据，不能直接成为正式 token。

页面应分成两组，不能混为“2-3 个看起来不同的 demo”：

- `reference calibration`：参与证据抽取、规则解释和构图校准的官网页面，用于证明 evidence 与 structure。
- `held-out generative challenge`：在规则冻结后才进入实现与 Blind QA 的新页面类型或新内容集，用于证明规则可生成，而不是记住 reference。

同一个页面不能同时充当 calibration 和 held-out。直接复制 source screenshot、裁切官网长图或仅更换官方壁纸，均不能计入 Generative Proof。

### 学习 Demo 的接力格式

生成者直接使用以下紧凑契约，不读取 validator/test 源码反推格式。Region 为实际截图归一化 `[x,y,width,height]`，hash 来自实际文件，不预填 PASS。

- `visual-pattern-inventory.json`：`schema: brand-visual-pattern-inventory/v1`、冻结 `goalSha256`、正整数 `attempt`、`pages[]`；每页含 `demoPageId` 与 `patterns[]`。`attempt` 是质量审查轮次：首次为 1，已有 QA 失败后返工进入下一轮；QA 开始前的机械补字段不另增质量轮次。它不是 workflow stage/receipt 的重试编号，后续 QA manifest 与 assessment 使用同一质量轮次；新产物显式填写，不依赖首次兼容默认值。
- 每个高显著度 Pattern：`id/approvedPatternId/salience: high`、`evidenceRefs[]`（`evidenceId/sourcePageId/sourceRegion`）、`demoRegion`、字符串 `selfCheck`（自检完整通过为 `pass`；否则 `fail` 或 `unresolved`，细节另放 `selfCheckDetails`，不把对象塞入该字段）。使用资产时记录 `assets[]` 的 `path/identity/provenance`；provenance 必须有 `sourceUrl/sourceSha256/role/sourceKind`，sourceKind 取 `original-site-asset | dom-css-reconstruction | generated-independent-asset`，不能只有清单而无运行时用途。
- 构图 Pattern 再含 `preserves[]` 对应 Goal requirement id 与 `compositionSupport`：`sourceAsset/demoAsset` 的 `identity/variant`、`layers[]` 的 `id/role/sourceRegion/demoRegion`。同一原图与变体沿用已批准的准确 identity/variant 值，不分别改写成两段自然语言；适配说明另记。各层必须与已批准规则中的 requiredLayers 一致，不能用整页 Region 充当全部层。
- `generative-proof.json`：`schema: brand-generative-proof/v1`、`goalSha256`、`challenge`（`id/heldOut: true/sourceContentIndependent: true/contentChange`，不映射来源页）、`frozenRules[]`（`recipeId/frozenBeforeChallenge`）、`output`（`demoPageId/screenshot: {path,sha256}`）及 `checks`（`brandCueSubstitution: false/structureRulesApplied[]`）。至少复用两条有依据的规则。
- 必须另保存实际规则冻结文件与之后选定 challenge 的时间/hash 绑定；`frozenBeforeChallenge: true` 不能代替先后发生的证据。旧页面未具备此前提时，应先冻结规则、再做新的 held-out 试验，不补造历史顺序。
- 独立 QA 自己填写每个高显著度 Pattern、构图层和 frozen recipe 的复核结论；生成者不能替 QA 签字。
- QA 的 `mustNotReplace[]` 每项明确填写布尔 `violated`；`status: pass` 不代替 `violated: false`。正式 receipt 记录后不再覆盖其绑定产物，记账错误用独立 erratum 说明，不把真实 FAIL 改成 PASS。

必须避免的 preview 记录：

- 只列 `components` 数组但没有真实渲染分支或页面路由。
- 3 个 tab 共享同一套主体内容，仅替换标题/描述。
- 把用户否定过的样式继续记录为 accepted。

### `brand-evidence.json`

只保存原始统计证据：

- UI color 高频值。
- radius / spacing / shadow / motion 等非 color 值。
- component pattern 高频模式。
- assetInventory：PNG/JPG/WebP/SVG/GIF/Lottie/字体包等资产，记录 assetPath/url、format、dimensions、alpha、role、contexts、targetScope、implementation、placement、state、antiScopes。
- 每项必须有统计口径、次数、占比、上下文。
- 边框、圆角、阴影要拆开记录；圆角还要拆成 frame/card/media 与 control。
- 如果存在 frame / asset frame / texture frame，必须记录 Decorative Boundary Inventory：容器、边界类型、实现方式、radius、asset、是否替代父容器 border。

### `brand-profile.dtcg.json`

保存 DTCG 风格 token 资产：

- token 使用 `$type`、`$value`、`$description`、`$extensions`。
- component 不是 DTCG token，只能作为 group metadata 摘要或引用 `component-mapping.json`。
- fallback、style-only、missing、ask-user 写入 `$extensions.com.echo.brandMigration`。

### `primary-role-frequency-review.json`

新案例使用 `schema: brand-primary-role-frequency-review/v2`；v1 仅兼容历史案例，不复制其品牌特定字段。

- 顶层：`brand`、`producer`、`status: candidate-not-approved | approved`、`policyRef: primary-color-and-cta`、`methodRef: cross-page-token-promotion`。
- `sources[]`：唯一 `pageId/url`、`sourcePriority`、`evidenceRef`；引用一律为 `{path, sha256}`。
- 每页 `census`：`observedControls`、`countedControls`、`aggregateOnlyControls`，以及嵌套的 `census.exclusions[] / census.unknowns[]`；各项为 `{role, count, reason}`，无记录时保留空数组。观察总数 = 已计数 + 排除 + 未确认；未逐项举证数量 = 已计数 − 独立控件记录数。
- 每页 `styles[]` 按 `{role, treatment, background, foreground, count}` 分组，不限定颜色或源码选择器。逐控件证据嵌套在各分组的 `styles[].observations[]`，不放在 page 顶层；每项保留 `id/selector/paintSelector/textSelector/region/state/evidenceRef`。`region` 为像素 `{x,y,width,height}`，统计代表控件的 `state` 为 `default`。v2 使用 `sources[]`，无需另建 `pages[]` 或 `pageCount`。
- `frequencyTotals`：上述三计数加 `excludedControls/unknownControls`，以及按同一分组键累加的 `byRoleAndTreatment[]`。次数只描述采样，不产生批准。
- `sampling`：`unit/paintLayerMethod/scope`；`identityObservation.role` 分清身份与行动池。
- `interpreterDecision`：`brandIdentityDecision/primaryActionDecision/interfacePaletteDecision`、`exceptions[]`、`mappingCandidates[]`、`approvalBoundary`。映射候选为 `{role,targetToken,scope,rationale}`，没有依据时为空；边界包含 `currentScope/notApproved[]/missingInThisCase[]`。
- `unresolved[]` 保留未解决问题。单页局部候选合法，但必须声明未批准范围和缺口，不填造独立页面或状态。

`approved` 专指全局 token 晋级，另需 `promotions[]`：每项保存分组键、`scope: global`、`targetToken/rationale/sourceUrls`、`conflictDisposition: no-unresolved-conflict`、空 `unresolved[]`。同职责至少两独立 URL，并覆盖已统计的全部同职责页面。`stateEvidence[]` 每页提供 default/hover/focus 的 `url/observationId/selector/state/role/treatment/background/foreground/region/evidenceRef/contrastPassed`；真实状态可以变色。`visualQA` 保存 `approved/reviewer/evidenceRef`，审阅人不同于 producer。局部构图或组件的批准另记其专项范围，不能冒充全局 token 晋级。

运行 `validate-primary-role-frequency-review.mjs <file>` 校验结构；hash 格式通过不代替来源文件复读和独立视觉检查。

### `echo-mapping.json`

保存品牌意图到 Echo/Figma 的承接：

- color 到语义 token。
- radius / spacing 到 primitives。
- shadow / motion / typography 的缺口或未来候选。
- component 到 Echo/Figma 组件候选。

### `dangoui-adapter.json`

保存当前代码落地关系：

- 已有 `--du-*` 如何赋值。
- 当前只能通过 `--style-*` 表现的内容。
- 未来可能迁移到的 `--du-*` 候选。
- 当前 dangoui 组件、props、slots 的承接状态。
- `demoOnlyVisualControls` 要记录用户校准过的字体、icon、边框、圆角、阴影及其作用域。
- `demoOnlyVisualControls` 中的 Frame / Divider style-only 内容必须说明是父容器边界、border-image、背景角线、asset fallback 还是明确证据支持的内框。
- `demoOnlyVisualControls.assetRecipes` 要记录图片资产 role、assetPath、targetScope、state、CSS placement、fallback 和 antiScopes；不能只写“使用图片风格化”。

### `uno-adapter.json`

保存 Echo / dangoui 到 UnoCSS 渲染层的适配关系：

- `uno-preset-echo` 如何暴露 token utility。
- 页面布局、间距、排版等 utility 使用规则。
- 哪些 preview demo class 只是临时表现。
- 哪些 `--style-*` 仍是 `style-only` 或 `fallback`。
- 是否需要更新 `uno.config.ts`、文档站示例或 preset。

不要把 `tailwind.config.js` 作为 Echo / dangoui 工作流的默认 token 输出。外部 Tailwind 项目只能作为兼容产物单独标记。

### `component-mapping.json`

### `mapping-runtime-proof.json`

记录 mapping 的真实消费证据，而不是“计划应用”：每条 proof 至少包含 route、selector、expected token/component/recipe、computed 或 actual runtime、evidence refs 与非 pending status。正式交付把独立结论保存为品牌根目录的 canonical `mapping-qa-report.json`，详细输入与 computed report 可放在独立运行目录；然后运行 `validate-dangoui-mapping.mjs --brand <brand> --strict`。

保存组件模式映射：

- `brandPattern`
- `echoComponentCandidate`
- `dangouiComponents`
- `props`
- `slots`
- `usesTokens`
- `unsupported`
- `tokenChain`
- `status`

## 3. README 结构

```md
# {Brand} 迁移说明

来源：`{来源路径或 URL}`

## 0. Preview Gate

> 目的：先确认视觉方向，再进入正式 DTCG / Echo / dangoui 迁移。

| 方向 | 核心页面 | 气质 | 信息密度 | 组件模式假设 | 决策 | 原因 |
| --- | --- | --- | --- | --- | --- | --- |
| `preview-a` | 首页、详情页 | 清爽克制 | 中 | `media-card`、`primary-cta` | selected | 更符合目标用户 |

## 1. 品牌风格摘要

用中文总结品牌气质、页面结构、识别手段、行动入口、页面节奏和可做 / 不可做。

## 2. 高频视觉值统计

> 统计口径：{UI color / radius / spacing / shadow / motion 等}
>
> 占比公式：该视觉值出现次数 / 本次统计中所有视觉值出现次数总和。

| 类型 | 原始值 | 次数 | 占比 | 证据 | 角色判断 | 承接 |
| --- | --- | ---: | ---: | --- | --- | --- |
| color | `#ffffff` | 42 | 38% | 首屏、卡片、导航 | 中性表面 | `--du-bg-1` |

## 3. 高频组件模式统计

> 统计口径：{组件模式统计范围}
>
> 占比公式：该组件模式出现次数 / 本次统计中所有组件模式出现次数总和。

| 组件模式 | 次数 | 占比 | 证据 | Echo/Figma 候选 | Dangoui 落地 | 状态 |
| --- | ---: | ---: | --- | --- | --- | --- |
| `media-led-card` | 9 | 36% | 首页 feed | `Card` | `DuCard + DuTag` | `composed` |

## 4. Token Mapping

说明 color、radius、spacing、shadow 等如何承接。

## 5. Decorative Boundary Inventory

> 目的：判断风格化边框是否替代父容器 border，以及 radius / divider / background / shadow / asset 是否联动。

| Container | Type | Implementation | Radius | Asset | 承接 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `Hero panel` | `frame` | parent `background` edge lines | `0px` | none | `style-only Frame CSS` | frame 替代父容器 border |
| `Card list` | `frame` | parent `background` edge lines | `0px` | none | `style-only Frame CSS` | Card 跟随站点边界语言 |
| `Video thumbnail` | `asset frame` | `border-image` / PNG | follows asset | `media_border.png` | `style-only asset` | 不能只映射到 `--du-border-1` |
| `List divider` | `divider` | `border-bottom` | n/a | none | `--du-border-1` | 普通分割线 |

必须说明：

- `frame / asset frame / texture frame` 是否替代父容器 border。
- 是否存在真实内外双层框证据；没有证据时不要使用 inset 伪元素内框。
- Card / Media / Hero / Panel 是否全部检查过。
- Radius 是否跟 frame 几何一致。
- 哪些区域是反例，不能被 frame 污染。

## 6. Asset Inventory

> 目的：保证 PNG / WebP / SVG 等资产不会在抽色后丢失，尤其是背景图、选中背景、装饰图、frame 图和 texture。

| Asset | Role | Source | Target Scope | State | Implementation | Fallback | 承接 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/assets/re1999-logo.png` | `brand-mark` | local png 333x132 RGBA | nav logo / watermark | default | CSS background-image | serif title | `style-only asset recipe` |
| `selected-bg.png` | `selected-bg` | source css/img | selected card / active tab | selected | state background | active line | `style-only state asset` |
| `media_border.png` | `asset-frame` | source image | media/card frame | default | border-image / edge background | CSS frame | `style-only Frame asset` |
| `paper-texture.webp` | `texture` | source image | page/panel bg | default | repeat overlay | gradient texture | `style-only texture` |

必须说明：

- 资产是 background、selected-bg、frame、texture、icon、brand-mark、illustration 还是 divider。
- 能否由 DangoUI `Image`、icon slot、Button icon 或组件 slot 承接。
- 如果不能承接，进入 `demoOnlyVisualControls.assetRecipes`，并写清 CSS placement。
- selected/active 资产必须绑定状态 selector，不能用无依据 shadow 或 outline 替代。
- 不得套用资产的 antiScopes。

## 7. Component Mapping

说明品牌组件模式如何落到 Echo/Figma 和 dangoui。

## 8. 客观 Token Chain

当涉及组件样式问题，列出真实链路：

```text
DOM class
→ dangoui style token
→ dangoui alias
→ Figma / Echo alias
→ adapter
```

## 9. 承接缺口

分为：

- token 缺口。
- component 缺口。
- props / slots / variant 缺口。
- style-only 内容。

## 10. 机器可读资产

列出本次产出的 JSON 文件。

## 11. UnoCSS 渲染适配

说明哪些 utility 来自 `uno-preset-echo`，哪些只是 demo 布局，哪些 `--style-*` 属于 `style-only` 或 `fallback`。不要把 Tailwind 配置列为默认产物。

## 12. Demo 应用说明

说明哪些值进入 `--du-*`，哪些值只是 `--style-*`，哪些组件是真实渲染、组合或占位。

追加 Demo QA：

- 2-3 个 demo 页面各自的关键文案、组件结构和截图/DOM 验证信号。
- 已校准效果的回归清单：字体包、icon/asset、边框、圆角、阴影、选中态。
- 正例：目标 demo 元素确实应用品牌样式。
- 反例：证据区、mapping 区、频次表等非目标容器没有被误套。

追加三证结论：

| Proof | 输入 | 必须证明 | Blocking 示例 | 结论 |
| --- | --- | --- | --- | --- |
| Evidence | DOM / computed / asset / motion / source region | 高显著度模式有来源且语义未扩张 | `UNSUPPORTED_VISUAL_PATTERN` | pass / blocked |
| Structure | reference 与 demo 对照 | 构图、层级、密度、节奏保留决定性特征 | Hero 只换官方壁纸 | pass / blocked |
| Generative | 冻结规则 + held-out challenge | 新内容仍可生成同品牌页面 | 截图复用、固定模板换素材 | pass / blocked |

宿主项目的 URL、业务保真、承载力与效率验收单列在 `apply-host` 交付中，不写进 learn-brand Demo 的通过结论。
- 若用伪元素表达边框，说明是贴边外沿还是内框；默认不接受“容器里又套一层框”作为替代。
- 若使用风格化 Frame，优先说明它如何替代父容器 border；只有源站证据明确存在内框时才接受 inset 伪元素。

## 13. Existing Migration Assets 应用记录

当本次任务是应用已有 `migrations/{brand}` 时，README 或交付说明必须列出：

| 项 | 内容 |
| --- | --- |
| 使用的 migration | `migrations/{brand}` 或公开 demo/registry style pack |
| assetRoot | `{实际读取的资产目录}` |
| 读取的资产 | `brand-evidence.json`、`dangoui-adapter.json`、`component-mapping.json` 等 |
| 应用到的页面/模块 | `{页面或组件路径}` |
| 进入 `--du-*` 的值 | `{token list}` |
| 进入 style-only 的值 | `{字体、asset、边框、圆角、阴影等}` |
| 未实现缺口 | `{missing / ask-user}` |
| 验证 | `{build/test/browser checks}` |
```
