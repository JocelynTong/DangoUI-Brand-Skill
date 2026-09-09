# Learn-brand Pipeline

Learn-brand 是品牌学习能力的 self-testing pipeline，不是网站镜像项目。它模仿专业研发团队的 shift-left、自测、Presubmit、独立 Review 和回归闭环。

## 节点顺序

顶层 `Design Director / Orchestrator` 组织：

`Evidence → Brand Interpreter → Demo Designer → Blind QA / TPP`

Design Director 不占用一个串行 subagent 节点；它贯穿全程，并在 Interpreter 与 Demo 之间完成自己的设计方向决策和 Gate。

执行前选择档位：

- `fast`：15–20 分钟方向验证，只覆盖核心视口、核心资产/交互和两个代表性结构；不得宣称完整学习。
- `full`：30–45 分钟标准学习，覆盖冻结页面、关键响应式、动效、资产、Generative Proof 与 Blind QA。

`full` 到 60 分钟停止扩展可选范围；到 75 分钟仍不能形成必需产物时必须 BLOCKED 并报告最慢节点。时间预算用于停止无界探索，不降低质量阈值。

每个节点统一执行：

`Required Inputs → Role Work → Self-check → Deliverables → Consumer Gate → PASS / REWORK / NEEDS_EVIDENCE / BLOCKED`

## 四级质量体系

1. **L1 节点自检**：Producer 在交付前检查自己的产物。
2. **L2 Consumer Contract**：下游拥有拒收不完整输入的权利。
3. **L3 Pipeline Integration**：追踪 `Screenshot → Claim → Pattern → Demo selector/state` 是否失真。
4. **L4 Blind QA**：独立上下文从真实页面验收三证，不接收实现理由。

## Shift-left 原则

- 可见事实在 Evidence 节点失败，不允许带到 Interpreter。
- 语义范围在 Interpreter 节点失败，不允许交给 Demo。
- 顶层 Design Director 必须在派发 Demo 前批准第一眼焦点、视觉优先级、元素级响应策略与 proof surface。`responsive: true`、整页统一缩放或实现者临场选择适配方式均不构成批准。
- Demo 在交给 QA 前必须完成真实浏览器自测。
- Evidence、Interpreter 与 Design Direction 尚未通过时，产物只能留在 migration workspace；不得写入公开 preview registry，也不得在参考站伪装成已学会的品牌。注册展示是 Demo Gate 之后的发布动作，不是 Evidence collector 的副作用。
- QA 发现问题时必须路由到 `earliestFailureNode`，不能默认只修最终页面。
- 高显著度页面必须先拆成 section micro-gates；条目数量、DOM 数量和 build pass 都不能代替区块结构与交互验收。
- 重试默认复用已哈希的 URL、视口、截图、资产和交互轨迹，只重抓失败区块与必要回归。
- `brand=dango` 只表示 DangoUI 是当前被学习的品牌，不代表进入 DangoUI 宿主换肤。只提供 `source-url` 时必须保持 `learn-brand`；没有显式 `host-target`，不得创建 Host Adapter 页面、修改宿主组件或把其他品牌迁移到 DangoUI。

## Design Director 设计方向门

顶层 Design Director 对“具体怎么设计”和如何组织团队负责，不替代 Interpreter 的品牌语义，也不替代 QA 的独立验收。派发 Implementation 前必须通过：

```bash
node skills/brand/scripts/validate-design-direction.mjs --brand <brand>
```

视觉决策顺序固定为：内容可见/可读 → 背景与高显著度资产 → 核心构图 → 交互语义 → 响应式几何 → 协议完整性。浅底浅字、背景缺失或主要内容不可见是即时 blocker，不能被 build、SHA 或 JSON 完整性抵消。

每个高显著度元素选择一种明确策略：`uniform-scale`、`art-directed-crop`、`responsive-reflow`、`independent-scale`、`structural-substitution`、`motion-degradation`。同一 section 可以组合多种策略；当“PC 等比缩小”和“手机艺术指导式重构”等选择会显著改变用户看到的结果时，必须在实现前核对，不能事后通过 CSS 猜测。

Proof surface 必须把 desktop canvas、mobile canvas、inspector 和 source comparison 分开。侧栏、mockup 外壳或页面滚动位置不得让 QA 把“预览不可达”误判成品牌构图问题。

## Evidence 内部协作模型

Dembrandt 不是第五个 learn-brand 角色，也不单独向 Interpreter 交付。它是 Evidence Agent 的候选发现工具：

`Goal questions → Dembrandt seeds → rendered observation → seed disposition → observed Claims → Goal coverage`

- Evidence Agent 对最终证据负责；“抽取成功”不等于 Evidence PASS。
- Dembrandt 可以缩小颜色、字体、组件状态、圆角、阴影和 motion 的搜索范围，但不能决定品牌语义或可见显著度。
- 与 Goal 或高显著度页面相关的 seed 必须被标为 `validated / rejected / unresolved / out-of-scope`。
- `validated` 必须引用 observed Claim；`unresolved` 若影响 `mustPreserve`，必须返回 `NEEDS_EVIDENCE`。
- 页面证据与 seed 冲突时以可复现的渲染证据为准。
- Interpreter 正式提升颜色、字体、阴影、动效等语义时写入 `brand-intent.json.semanticClaims`；每项必须是 `validated`，并回指同时具有可见截图 Region、DOM selector、computed property/value、page 和 state 的 observed Claim。全站色频、聚合 palette、CSS 变量名和 Dembrandt semantic/accent seed 都只能产生 candidate，不能独立放行。

## Corrective / Preventive Closure

用户或 QA 发现问题后必须同时完成：

- `Corrective Action`：修复当前 Case。
- `Preventive Action`：将同类错误加入节点自检、Consumer Gate 或机器 Validator。

没有新截图、全新 Blind QA 和回归 Gate，不得关闭问题。

### 问题作用域门

Design Director 在路由修复前必须先判定：

- `brand-content`：品牌证据、语义、资产或页面构图问题，只回归本品牌相关 section。
- `shared-demo-platform`：phone shell、indicator、滚动、响应式 proof surface 等问题，必须至少回归两个品牌。
- `inspector-tooling`：参考站 rail、页面列表、状态说明等用户可见工具问题，必须在所有 registry entries 上验证。
- `host-product`：宿主业务内容、效率或交互问题，只能进入 design-host/apply-host，不得倒灌为品牌事实。

当旧实验被判定为不合格并会污染新增学习时，应从 registry、migration、preview、专属资产与采集输出中退役；删除前先反查有效品牌依赖并迁移仍需资产。

共享 mockup 改动必须产出 `mockup-state-matrix.json`，覆盖 `brand/style/component × tabbar/no-tabbar × normal/proof=1/proof=desktop/proof=mobile` 的 24 个状态，并运行：

```bash
node skills/brand/scripts/validate-mockup-matrix.mjs --brand <brand> --strict
```

正常模式检查 indicator 的直属 owner、脱离内容流、与 TabBar 连续或无 TabBar 时透明、screen/phone 宽度与圆角对齐、底部 Chrome 圆角、滚动位移/恢复和 indicator 稳定；proof 模式必须隐藏 indicator。不得用单个品牌页面代替这个平台回归矩阵。

旧学习项目退役时不得删除 run log。Methodology Keeper 应追加 tombstone：

```bash
node skills/brand/scripts/brand-guard.mjs tombstone-run --brand <brand> --disposition retired --reason "<原因>" --scope all
```

`retired` 表示项目退出；`invalidated` 表示 QA 推翻该次结论；`superseded` 表示由新 run 替代。`summarize-runs` 与 `issue-retro` 只统计未被 tombstone 的有效 run，同时保留原始历史供审计。

## ONE PIECE 黄色事故回归样例

原始 CSS 中 `#FFF507` 仅用于顶部菜单 `is-open` 的文字/图标状态。以下任一行为必须阻断：

- 没有状态截图就将 CSS 颜色记为 observed。
- 将 `color` 错记为 `backgroundColor`。
- 将 `is-open` 改写为 `active/current`。
- 将局部 Header 状态提升为全局 active token。
- 将黄色扩张为 Tabs、Section Title 或大面积 Chrome。

这个 Case 是 `screenshot-first / property-accuracy / state-semantics / role-expansion` 四类机制的回归样例，不是所有品牌禁用黄色的全局规则。
