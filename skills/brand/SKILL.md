---
name: brand
description: 将品牌网站、DESIGN.md、截图或 Figma/DTCG 资产迁移到 Echo / dangoui。用于统计高频视觉值和组件模式，保持 dangoui 命名不变，生成 token/component mapping，并应用到 demo 验证。
---

# Brand Skill

## 适用平台与维护

这个 skill 同时面向 Codex 和 Claude：

- Codex：使用仓库中的 `skills/brand/` 作为分发包或安装来源。
- Claude Code：使用仓库中的 `.claude/skills/brand/` 项目 skill 镜像。
- Claude.ai 自定义 skill：打包 `skills/brand/` 目录上传。
- 维护以 `skills/brand/` 为源目录；改完运行 `npm run sync:skills`，确保 `.claude/skills/brand/` 与源目录一致。

## 目标

把上游品牌 URL、DESIGN.md、截图或 Figma/DTCG 资产转成可审查、可迁移、可落地的 Echo / dangoui 资产。

## /brand 的两条工作流

`/brand` 只有两条主路，先分清，再执行。

### 1. 品牌学习（`learn-brand`）

适用场景：用户给的是品牌官网、活动页、截图、Figma、DTCG 或 demo 参考站，目标是先学会“这个品牌的视觉语言是什么”，并把它沉淀成可复用的品牌 MOD / style pack / demo 预览。

固定链路：

`/brand <品牌来源>` → 抽取器（如 dembrandt）→ 我们自己的证据校正与规则补强 → DTCG 标准层 → dangoui 映射层 → demo 预览 / `brand-mod.json`

这一条路默认**不改宿主业务项目**，重点是：

- 学会品牌视觉语言，而不是改业务功能。
- 产出可复用的 `migrations/{brand}/brand-mod.json`、证据文件、adapter、demo preset。
- 把“这个网站为什么长这样”沉淀成后续任何项目都能消费的风格资产。

learn-brand 的 Demo 正式定义为 **brand-learning-capability-test（品牌学习能力测试）**。它要证明证据支持的视觉规律能够重新生成不同信息结构，而不是制作 website mirror、执行 host apply，或用 Logo、品牌色和官方大图拼成 branded asset template。Demo 必须同时提交三类互不抵消的证明：

- `Evidence Fidelity`：每个高显著度决定都能追溯到具体官网证据和使用语义。
- `Structural Fidelity`：决定品牌辨识度的构图、层级、密度、色彩角色、图形和交互关系被保留。
- `Generative Proof`：使用同一组已学规律，在改变内容或结构后仍能生成属于同一视觉系统的页面；官网镜像、整图复用或仅换资产不能充当证明。

任何一证失败都必须返工，不能被综合分或另外两证的高分抵消。机器产物为 `generative-proof.json` 和 fidelity report 中的三证状态。

Learn-brand 支持两个执行档位，机器规则以 `workflow-contract.json.executionProfiles` 为准：`fast` 用于 15–20 分钟方向验证，不得宣称完整学习；`full` 是默认 30–45 分钟标准流程。`full` 超过 60 分钟停止扩展可选范围，超过 75 分钟仍缺必需产物则 BLOCKED，不能无界探索或降低质量阈值。

高显著度页面在全页 Blind QA 前必须生成 `section-fidelity-manifest.json` 并运行：

```bash
node skills/brand/scripts/validate-section-fidelity.mjs --brand <brand> --strict
```

该 Gate 检查同视口 source/demo 截图、结构层、阅读顺序、响应式、资产 provenance 与交互状态变化；条目数量、DOM 数量和 build pass 不能代替区块结构验收。

### 2. 宿主设计（`design-host`，代码落地阶段为 `apply-host`）

适用场景：用户已经在某个千岛项目、业务项目或本地宿主项目里安装了 `/brand`，现在要把某个已有品牌视觉语言真正落到这个宿主里看结果。

固定链路：

`Design Brief` → 设计调研 → 设计方向 → 设计产出 → 设计评审 → `apply-host` → 开发验收

这一条路重点是：

- 决定“这个视觉语言怎么落到当前宿主项目里”。
- 保留宿主原业务内容、数据、逻辑、组件 API，只改视觉语言。
- 最终验收地址必须是宿主项目自己的地址，不是 demo 站地址。

`design-host` 是面向用户和设计组织的完整 Pipeline 名；现有脚本继续使用 `apply-host` 表示其中已经批准后的实现阶段，以保持命令兼容。不得因为进入 `apply-host` 就跳过 Brief、设计方向和设计评审。

apply-host 交接以机器 Gate 为准：先按 [host theme load-order contract](references/host-theme-load-order.md) 建立单一全局主题入口并运行 `validate-host-theme-order.mjs`，再以真实宿主 desktop/mobile 证明 cascade winner。随后必须生成只读的 `brand-distinctiveness-assessment.json`：同视口对照 source/host，遮蔽品牌名、Logo 和显式品牌文字后做 blind recognition，并分别评 visual mass / asset / composition / type / motion。高承载页至少需要 3 个跨 3 个维度、各占视口至少 5% 的可见证据 signal；字体、小 Logo、微图标和 archive 气质不算强表达。先运行 `validate-brand-distinctiveness.mjs`，再把结果传给 `validate-host-apply-gate.mjs --distinctiveness`。Visual QA 只读，FAIL 退回 Evidence、Interpreter/Design Director 或 Host Implementation 的真实 owner，修复后 fresh QA。技术 Gate 或业务安全通过不能补偿视觉辨识度 FAIL；最终必须分列 `workflowCompletion`、`businessSafety`、`visualDistinctiveness`，禁止用单一 overall 百分比误导。没有真实 DangoUI runtime/component consumer 时最高只能报 `PARTIAL_STYLE_ONLY` / `conservative-application`。细则见 `workflow-contract.json` 与角色契约。

## Role Contract 路由

维护或执行 learn-brand 角色时，按当前节点完整读取对应契约，不要只依赖本文件的摘要：

- 通用节点模型：[roles/role-contract-template.md](roles/role-contract-template.md)
- Evidence：[roles/evidence-agent.md](roles/evidence-agent.md)
- Brand Interpreter：[roles/brand-interpreter.md](roles/brand-interpreter.md)
- 顶层 Design Director / Orchestrator：[roles/design-director.md](roles/design-director.md)
- Demo Designer：[roles/demo-designer.md](roles/demo-designer.md)
- Blind QA / TPP：[roles/blind-qa-tpp.md](roles/blind-qa-tpp.md)
- Learn-brand 自测流程：[workflows/learn-brand.md](workflows/learn-brand.md)

Evidence 节点的机器放行命令为：

```bash
node skills/brand/scripts/brand-guard.mjs evidence-visibility-gate --brand <brand> --strict
```

该 Gate 必须先于 Interpreter。它验证 screenshot-first、可见 Region、真实状态和 computed property；只有 CSS、变量名、类名或第三方抽取结果不能放行。

Evidence Agent 是该节点的结果 owner；Dembrandt 只是它内部的 candidate extractor，不新增角色、不单独 handoff，也不拥有 PASS/FAIL 权。Evidence 必须从冻结 Goal 生成证据问题，再运行抽取器帮助排序候选，最后用真实渲染证据为相关 seed 写 `validated / rejected / unresolved / out-of-scope` disposition。存在第三方 seed 却没有 disposition 时，strict gate 不得交给 Interpreter。

## /brand 总入口（必经）

无论是品牌学习还是宿主换肤，`/brand` 真正开始执行前都必须先走统一入口，而不是一上来散着跑各个 guard。

统一入口职责只有三件事：

1. 先判断当前请求到底是 `learn-brand` 还是 `apply-host`
2. 读取对应 workflow contract，检查这次是不是走错路
3. 先跑 TPP gate，blocking 没清掉就立刻停下

固定入口：

```bash
node skills/brand/scripts/run-brand-workflow.mjs run ...
```

如果当前运行环境是 Claude 项目 skill 镜像，则使用：

```bash
node .claude/skills/brand/scripts/run-brand-workflow.mjs run ...
```

默认约定：

- 只有品牌来源、没有宿主目标时，入口自动分流到 `learn-brand`
- 只要传了 `--host-target`、`--plan-file`，或上下文明确是在当前项目里换肤，入口自动分流到 `apply-host`
- 不允许跳过总入口直接宣称“开始 brand learning / apply”
- 后面的 `brand-guard.mjs validate-intent / tpp-test / coverage-gate / asset-usage-gate` 等细项，是第二层 guard，不是第一层入口

这一步的意义不是多一层流程，而是把“md 里的原则”变成 AI 每次都必须先过的一道硬门。

## vNext 目标导向分工

`/brand` 不是单个全能 agent 从头猜到尾，而是一条目标导向的角色工作流。机器可读版本以 `workflow-contract.json` 为准；`SKILL.md` 只保留入口、边界和执行原则。

默认角色：

- `Router`：先判断 `learn-brand` / `apply-host` / `retro` / `maintain`，阻止走错路。
- `Brand Researcher`：只负责抓证据，包括 dembrandt/第三方种子、真实 DOM、computed style、资源、action 节点和导航。
- `Design Translator`：把证据翻译成品牌意图，说明颜色、资产、动效、布局分别代表什么，适合哪里，不适合哪里。
- `Design Director / Orchestrator`：顶层负责 Agent；冻结目标、拆解和派发任务、主持设计方向、路由失败并作最终审美签字。它不是 learn-brand 的串行 subagent。
- `Dangoui Mapper`：只把已解释的品牌意图映射到 DangoUI token/component/props/slots/style-only recipe，不新造未支持 API。
- `Host Strategist`：在宿主项目里判断页面业务目标、视觉承载力、Atomic Design 层级、asset/motion/showcase 落点和过度应用风险。
- `Demo Implementation Agent`：只为 learn-brand 构建品牌学习能力测试，产出 pattern inventory、可复现截图和 generative proof；不修改宿主项目。
- `Host Implementation Agent`：只在 apply-host 中消费已经验证的 MOD、brand intent 和 host strategy，保留宿主路由、内容、数据、组件 API 和核心交互。
- `Visual QA`：从用户看到的页面验收视觉还原、可读性、滚动、动效中间态、资产加载和“是否生硬”。标准 learn-brand Demo 的每个 phone page 都必须保留 `phone` + `phone-screen` mockup shell；目标或源证据呈现长页/多模块时，页面至少有两个 schema sections，并由浏览器实际证明 `phone-screen.scrollHeight > clientHeight`、`scrollTop` 可改变且能恢复。缺失时使用明确 blocker code：`MOCKUP_SHELL_MISSING`、`MULTI_MODULE_PAGE_SECTIONS_MISSING`、`PAGE_NOT_SCROLLABLE`、`PAGE_SCROLL_NOT_RESTORED`。
- `Methodology Keeper`：把反复出现的问题沉淀成脚本、contract、reference、migration 或 run log；单品牌事故先做 rule candidate，不直接升级全局 blocking。

对应产物：

- `brand-evidence.json`：事实证据，避免凭印象判断。
- `brand-intent.json`：设计意图和使用/禁用场景，避免“抓到了但不会用”。
- `host-opportunity-map.json` 或 `intent-plan.json`：宿主页面落点判断，避免强视觉乱塞效率页。
- `visual-qa-report.json`：渲染后的设计审查，避免“build 过了但体验不对”。
- `retro-learnings.json` / run log：本轮教训和下一次可复用位置。

声明 vNext 流程完成前，运行 `node skills/brand/scripts/brand-guard.mjs handoff-artifact-gate --mode <learn-brand|apply-host> --brand <brand> --strict`。它检查这些角色产物是否有可用结构和具体内容，不能只靠 `SKILL.md` 文字说明放行。

外部开源项目（例如 gstack）只能作为**可选组织增强**：可借鉴它的 router、角色分工、review、QA 和 retro 方法；不能替代 `/brand` 自己的 TPP、computed-first、DTCG、selector-map、coverage、asset-usage、visual-placement 和 P0 acceptance 硬 gate。每次引入外部 goodcase 前，先按 `workflow-contract.json.externalGoodcaseAdoption` 判定：保留、迭代、废弃或 optional hook。

### 真实 Subagent 执行（MVP 必经）

`workflow-contract.json.roles` 是 subagent 的可执行岗位契约，不是角色介绍。`learn-brand` 必须由顶层 `Design Director / Orchestrator` 组织四个独立执行上下文：`Brand Researcher → Design Translator → Demo Implementation Agent → Visual QA`。顶层负责人在 Interpreter 通过后亲自形成并批准 `design-direction.json`，通过方向门后才派发 Demo。`Host Implementation Agent` 只属于 `apply-host`，不能用宿主适配结果反证品牌已经学会。

每个 subagent 只有在 `workflow-contract.json.roleCapabilityModel.requiredDimensions` 全部存在时才可派发；dispatch packet 固定携带冻结目标 hash、required/forbidden 输入、交付物、验收标准、失败路由与 cross-checker。Producer 自检不能替代 Consumer Gate 或 fresh QA。

- 开始前创建并冻结 `migrations/{brand}/goal-contract.json`；进入 Evidence 后不得修改目标、阈值、`mustPreserve` 或 `mustNotReplace`。
- 使用 `node skills/brand/scripts/brand-subagent-workflow.mjs prepare --brand <brand>` 创建本轮 execution manifest；使用 `next` 获取当前角色的 dispatch packet。外层总 Agent 必须把这个 packet 交给真实 subagent，脚本本身不伪装成 agent 调度器。
- 每个 subagent 只获得 role contract 允许的输入。完成后由总 Agent写 receipt，再用 `record --receipt <file>` 校验真实 agent execution id、目标 hash、输入/输出 hash 和顺序。
- Implementation 开始前必须生成 `design-direction.json` 并运行 `node skills/brand/scripts/validate-design-direction.mjs --brand <brand>`。未批准的方向、未声明的高显著度元素响应策略、缺失 proof surface 或把可读性排在协议之后都不得进入实现。
- Visual QA 必须是新的独立 subagent，不继承实现上下文；禁止接收实现理由、旧 verdict、目标话术或把 build/browser pass 当视觉还原证据。
- QA 只能写 `visual-qa-assessment.json`；不得写 `visual-quality-ready`。最终 verdict 由 `validate-brand-fidelity.mjs` 按冻结 rubric 计算。
- Demo Implementation Agent 在交给 QA 前必须生成 `visual-pattern-inventory.json`，列出页面里每个高显著度模式（标题栏、整段底色、Hero 构图、大边框、装饰纹理、强动效等）的 demo region、approved pattern id、evidence refs 和官网 source region，并完成自检。颜色 token 只能用于 `brand-intent` 声明的角色；例如“黄色用于 active”不能扩张成黄色 section chrome。缺任一项即 `UNSUPPORTED_VISUAL_PATTERN`，不得交给 QA。
- 官网截图及其 crop 只允许作为 QA evidence，不能复制进 Demo runtime 或冒充 composition asset。高显著度 runtime asset 必须在 pattern inventory 记录原站 `sourceUrl`、文件 `sourceSha256`、业务 `role` 和 `sourceKind`；默认只接受原站独立资产、DOM/CSS 重建或独立生成资产。若资产与 source screenshot 同 hash，或属于 screenshot/reference-derived full-frame raster，机器必须报 `SCREENSHOT_AS_IMPLEMENTATION` / `EVIDENCE_LEAKAGE`。只有冻结目标明确为 `screenshot-recreation` 且显式授权时例外。
- `mustPreserve` 涉及构图时，Interpreter 必须先在 approved pattern 冻结 source asset identity/variant 和关键结构层；Implementation 必须逐层映射并记录 source/demo region、裁切和宽高比翻译。另一张官方资产、整页区域或“品牌感很像”都不能替代 Hero 构图证据。
- Visual QA 必须逐项核对 pattern inventory，而不能只凭整体气质或综合分判断。任何无证据的高显著度模式、或 token role 扩张，都是不可被其他高分抵消的 blocking finding；receipt 用 `failureOwnerRole` 把问题退给 Evidence、Interpreter 或 Demo 的实际责任角色。
- Visual QA 不得只检查 Hero 或 schema/DOM 数量：必须逐页检查 mockup shell；对长页/多模块页记录两个以上 sections 与可逆滚动探针（scrollHeight、clientHeight、before/after/restored scrollTop）。上述 blocker 不能由其他页面或三证分数抵消。
- Demo Implementation Agent 在 QA 前必须生成 `generative-proof.json`，列出不变量规则、主动改变的内容或结构、允许变化的原因和证明截图。直接复制官网构图、贴整张截图、只换 Logo/颜色/官方资产都不算 Generative Proof。
- Visual QA 必须分别给出 Evidence Fidelity、Structural Fidelity、Generative Proof 的 PASS/FAIL；三证互不补偿。
- QA FAIL 时只把冻结目标和 blocking findings 退回 Demo；最多两次 Demo 尝试，每次必须重新截图并创建新的 QA subagent。耗尽后停止并向用户报告，不降低阈值。
- 只有 protocol、handoff、Evidence Fidelity、Structural Fidelity 与 Generative Proof 全部通过，Orchestrator 才能 finalize 并声明品牌学习完成。

### 用户反馈触发的强制复盘闭环

用户指出任何视觉不符时，不能只解释、改报告或等待用户再次提醒。该反馈自动视为上一轮自检漏检，并立即触发 `workflow-contract.json.incidentClosureProtocol`：

1. 写 `quality-attempts/{attempt}/incident-retro.json`，明确 observed mismatch、漏检角色、旧 gate 为什么放行、官网 evidence refs。
2. 把规则落到可执行位置：Evidence / brand intent / Implementation self-check / Visual QA / validator；不能只追加 Markdown 提醒。
3. 按根因退回实际 owner：缺证据回 Researcher，错误泛化回 Translator，实现偏离回 Implementation，QA 漏检同时修 QA gate。
4. 自动重做受影响页面、重新截图，并换一个新的 Blind Visual QA subagent；旧 QA verdict 不得复用。
5. 重新运行 machine fidelity gate。只有新实现和新 QA 都通过才向用户说“做好了，请验收”；否则继续内部修正或明确报告 blocking，不能把发现问题的责任交还给用户。

这个闭环适用于后续每一条用户视觉反馈，不需要用户重复要求“复盘、自查、重做”。

最小命令：

```bash
node skills/brand/scripts/brand-subagent-workflow.mjs prepare --brand <brand>
node skills/brand/scripts/brand-subagent-workflow.mjs next --brand <brand>
node skills/brand/scripts/brand-subagent-workflow.mjs record --brand <brand> --receipt <receipt.json>
node skills/brand/scripts/validate-brand-fidelity.mjs --brand <brand> --write
node skills/brand/scripts/brand-subagent-workflow.mjs finalize --brand <brand>
```

### 边界

- `/brand` 负责：学习品牌视觉语言、沉淀 MOD / style pack、把视觉语言映射到 dangoui、以及在宿主项目里做换肤验证。
- `/qdmp` 负责：项目初始化、业务功能开发、页面/接口/交互实现。
- 两者可以配合，但不互为前置依赖；`/brand` 不能默认把自己绑死在 `/qdmp` 上。

核心原则：

- 保持 Echo / dangoui 的 token 名、组件名、props、slots 稳定。
- `/brand` 输入中的 brand key 永远只是风格来源标识，不是路由名、页面名、组件名或业务内容生成指令。任何品牌、任何网站、任何 demo/registry URL 都遵守这一条；除非用户明确要求 preview，否则 brand key 不能自动变成 `/brandKey`、`BrandKeyPage.vue`、`BrandKeyComponent` 或新业务页面。
- 品牌网站的 schema key、CSS 变量名、自然语言总结不能直接变成 dangoui token。
- 先用 2-3 个真实不同的 demo 页面做视觉方向预审，再沉淀长期资产。
- 每次映射都必须有证据、状态和落地位置。
- `brand-mod.json` 是 `/brand` 面向后续消费者的主产物：它把 manifest、tokens、componentVariants、slots、assets、layoutRules、platformOverrides 和 verification 收敛成一个独立换肤协议。MOD 指模块化品牌视觉包，不是游戏品类限定；`/qdmp` 只是可能的消费者之一，不是 `/brand` 的前置依赖。
- `brand-mod.json` 的 token 层采用“双轨制”：`tokens.dtcg` 是标准表达层，`tokens.mapped` / `tokens.styleOnly` 是兼容镜像层。DTCG 只负责 token contract，不替代 assets、layoutRules、componentVariants、slots。
- 单个品牌踩出的坑不能直接升级成全局硬规则；先写入 `verification.ruleCandidates`，说明 observedIn、abstractMechanism、appliesWhen、evidenceRequired、scriptCheck 和 promotion。`promotion.level = candidate-warning` 只提醒和记录，`blocking` 才能中断执行；只有当机制被至少两个不同品牌验证，或属于 inspector/rollback 这类平台通用机制时，才升级为 blocking guard。
- 生成或更新 `migrations/<brand>/brand-mod.json` 后，运行 `node .claude/skills/brand/scripts/brand-guard.mjs rule-candidate-gate --brand <brand>`。blocking 必须修复；candidate-warning 只进入本次最终说明和下一品牌学习清单，不能被当成已经证明的全局规则。
- 生成或更新 `migrations/<brand>/brand-mod.json` 后，还要运行 `node scripts/normalize-brand-mod-dtcg.mjs migrations/<brand>/brand-mod.json --write`，再运行 `node scripts/validate-brand-mod.mjs migrations/<brand>/brand-mod.json`。normalize 负责把 legacy mirrors 同步成 `tokens.dtcg`，validate 负责检查 DTCG 覆盖完整且扩展字段齐全。
- 任何设计语言证据都先从最终渲染结果开始：真实 DOM / computed style / loaded asset / 截图区域；再反查 CSS rule、inline style、token、`@font-face`、图片/视频/动效来源；最后才决定 token、style-only recipe、asset 或未承接。不要只从源码文件、文件名、本地资产目录或品牌印象推断。
- 当前 dangoui 不支持的能力，不伪装成正式 `--du-*`。
- 用户手动校正过的效果属于高优先级证据；后续改内容或补页面时不能静默丢失。
- 面向运营/vibecoder 的主调用方式是一句话：`/brand <URL>`。不要要求用户先理解 assetRoot、mapping 文件或内部模式名。

## Reference 路由

按任务读取，不要一次性加载全部细节：

- `references/brand-dtcg-migration-asset-standard.md`：长期资产架构、`style.json`、Figma REST-like document 与 DTCG tokens。
- `references/mapping-rules.md`：颜色、资产、组件、Frame/Divider、Radius/Shadow、style pack 应用链路和风格原子表达规则。
- `references/host-visual-opportunity-map.md`：宿主页面截图统计、页面分型、视觉承载力和可落地层级判断。
- `references/atomic-acceptance-rubric.md`：Atomic Design 分层、P0/P1/P2 验收口径和对外解释。
- `references/output-template.md`：迁移文件、README、最终交付格式。
- `references/dangoui.design-system.json`：当前 demo 的 dangoui token/component 快照；正式项目迁移后以宿主项目真实 dangoui 源码为准。

如果宿主项目另有最新 dangoui schema、Echo/Figma DTCG 文件或本地组件源码，优先使用宿主项目真实文件，本 skill 内置快照只当 fallback。

## 路由判断

先判断用户是在“维护 skill”还是“使用 skill”。

### A. Maintain Skill

执行规则：

- 触发：更新、优化、同步、发布 skill；刷新 schema / reference / script；修改 `skills/brand/` 或同步脚本。
- 只维护源目录 `skills/brand/`，不要手动编辑 `.claude/skills/brand/`。
- 新增 md 前必须询问用户；优先复用已有 references。
- 借鉴外部开源项目或 goodcase 前，先盘点现有 md 规则和脚本能力，并把处理结论分成：`retain`、`iterate`、`deprecate`、`optionalHook`。能保留脚本 gate 的不要用自然语言规则替代；能合并到 `workflow-contract.json` 的不要散落在 `SKILL.md`。
- 改完运行 `npm run sync:skills`。
- 验证 `diff -qr skills/brand .claude/skills/brand` 无差异。
- 能构建时运行 `npm run build`。
- 只有用户要求时才 commit / push。

### B. Learn Brand Style (`learn-brand`)

执行规则：

- 触发：`/brand <URL>`、截图 / DESIGN.md / Figma / DTCG 输入，目标是先学习品牌并沉淀可复用资产。
- 进入 learn-brand 后，第一步不是直接跑零散 guard，而是先执行统一入口：`node skills/brand/scripts/run-brand-workflow.mjs run --mode learn-brand --brand <brand> --source-url <URL>`；若在 Claude 项目镜像中执行，则改用 `.claude/skills/brand/scripts/run-brand-workflow.mjs`。
- 不修改 skill 仓库，除非用户明确要求维护 skill 本身。
- 输入是 URL 时直接抓取 CSS、DOM、截图和可用媒体资产；不要要求用户手写风格描述。
- 生成或更新 `migrations/{brand}/`，先沉淀 `brand-mod.json`、证据、adapter、demo preset 与标准 demo 预览。
- learn-brand 默认交付物是品牌 MOD / style pack / demo 预览；不能默认把 brand learning 直接执行成宿主项目换肤。
- 如果后续还要把该品牌落到真实宿主项目，再切到 C 路径执行。
- 如果输入是 demo 站 URL，例如 `/#/brand/{brand}/pages/{pageId}`，它只能作为风格来源和 style pack 定位依据；`brand` 不是新路由名，`pageId` 不是新页面目标。默认目标是当前业务项目的默认入口/根路由/当前用户正在验收的业务页面。最终预览地址必须来自当前业务项目的 dev server / route，不能原样返回 demo 站 URL。
- 换肤默认保护宿主业务内容：保留原页面路由、数据、文案、信息层级和业务交互，只迁移色彩、字体、边框、圆角、阴影、资产层、动效和组件状态。除非用户明确要求重写内容，不得把参考站文案、角色、栏目或剧情搬进宿主项目。
- 换肤默认保护宿主组件结构：宿主已有 DangoUI / 业务组件时，必须复用原组件、props、slots、DOM/API 和交互；不得为了“看起来像参考站”手写替代组件结构。品牌风格只能覆盖 token、状态样式、资产层和有证据的 style-only recipe。
- 主题 CSS / token 文件只是中间产物；必须被宿主项目页面实际引用，并能在宿主项目 dev server 里看到变化。
- 运行宿主项目构建/测试，并用浏览器验证可见 demo；只启动 dev server 不等于构建通过。
- 完成时给出宿主项目预览地址和已换肤页面入口。
- 若输入是品牌官网且没有现成 style pack / demo 站资产，不能直接在业务项目里临时捏品牌 preview route。先把官网证据注册到标准 demo 预览：生成 `migrations/{brand}/...`、`public/brand-previews/{brand}.json` 和 registry，让 demo 站出现完整的参考站 / 风格 / 组件 / 页面结构。标准 demo/registry 是“风格能力验收”，业务项目只负责最终 apply 或明确允许后的实验预览。没有标准 demo gate 通过时，不碰业务项目，除非用户明确说“可以在当前项目中实验”。
- 标准 demo registry 是机器协议，不是报告文本：`public/brand-previews/registry.json` 必须使用 `brands[].id/path/migrationRoot/standardDemo/businessApply`，preview JSON 的 `brand/preset.id/pages/styleRecipeDetails/assets` 必须能被 demo 运行时消费。写入后运行 demo 仓库的 `npm run validate:brand-preview`；失败时先修协议，不要声称 demo 已接入。协议通过只代表“能渲染”，不代表“像官网”。
- 标准 demo 还必须过 visual quality gate：运行 `npm run validate:brand-quality -- --brand <brand>` 生成 `migrations/{brand}/visual-quality-report.json`。如果输出是 `draft-visual-preview`，最终只能说“草稿预览/待校准”，并列出主色、Hero、资产、动效、截图或 computed 缺口；只有 `npm run validate:brand-quality:strict -- --brand <brand>` 通过，才可称为“视觉质量已验收”。
- Browser/schema gate 只能证明“页面真实渲染并且协议没断”，不能证明“学会了官网”。标准 demo 要达到 `visual-quality-ready`，必须有 `migrations/{brand}/visual-comparison-report.json` 对照至少两个官网截图/页面 crop 与 demo 页面，记录 matchedPatterns、gaps、assetAuthenticity 和 nextFix；如果 demo 使用未证明来自官网的本地占位资产，只能保持 `draft-visual-preview`。

### C. Apply Existing Style Pack (`apply-host`)

触发：应用已有 `migrations/{brand}`、本地 style pack、公开 demo/registry URL，或“不要口头描述，直接把某风格套到当前宿主项目里”。

资产查找顺序：

1. 宿主项目 `migrations/{brand}/`
2. 宿主项目同级或用户提供的本地 style pack
3. 公开 demo/registry 站点返回的 `{brand}` style pack
4. 都不存在时，回到 B 路径重新学习素材

必须读取：

- `{assetRoot}/style.json`，如存在，作为机器读取主入口；`document` 遵循 Figma REST-like 节点树，`tokens` 遵循 DTCG。
- `{assetRoot}/brand-evidence.json`
- `{assetRoot}/echo-mapping.json`
- `{assetRoot}/dangoui-adapter.json`
- `{assetRoot}/component-mapping.json`
- `{assetRoot}/preview-gate.json`
- 如存在，读取 `{assetRoot}/README.md`、`brand-profile.dtcg.json`、`uno-adapter.json`

执行规则：

- 以 `{assetRoot}` 的 JSON 作为事实来源；不要凭品牌名或审美直觉改样式。
- 进入 apply-host 后，第一步也必须先执行统一入口：`node skills/brand/scripts/run-brand-workflow.mjs run --mode apply-host --brand <brand> --source-url <URL> --host-target <target> --plan-file <plan>`；若在 Claude 项目镜像中执行，则改用 `.claude/skills/brand/scripts/run-brand-workflow.mjs`。
- `dangoui-adapter.tokens` 里的现有 `--du-*` 可以进入主题 token；`demoOnlyVisualControls` 只能进入页面样式层、主题 class、asset 或 ReviewQueue。
- `component-mapping.json` 决定组件组合方式；不要把页面组合误判为需要新增 dangoui 组件。
- 应用前必须诊断宿主：默认入口、目标文件、样式入口、组件类名、DangoUI API、硬编码视觉值、当前 token 消费点。
- 修改每个 Vue SFC 前必须按 `references/host-structural-diff-contract.md` 生成不可变 baseline snapshot；实现后用 manifest 运行 `validate-host-structural-diff.mjs`。class/style hook 可通过，业务 script、route/API、data/state、组件 API、条件渲染、循环数据源与未批准 primitive substitution 必须阻断；装饰节点必须显式声明为无交互并关联证据。事件默认同样阻断；唯一例外是 Design Director 在实现前显式批准的 `accessibilityAugmentations`，它只允许既有 interactive/`@tap` 节点新增受限 role/tabindex/ARIA 语义，并让 Enter/Space keydown 原样委托到同一既有 tap outcome，不能新增业务 handler 或改写原事件。
- 必须生成并消费 `migrations/{brand}/selector-map.json`：CSS selector 必须命中宿主真实 DOM，不能把 demo class 当宿主 targetScope。
- 必须落到宿主真实页面/路由/组件或明确允许的业务 preview；只新增 theme CSS、只 import 主题、只列 token 状态都不算完成。
- 必须做 `evidence -> adapter token/recipe -> generated CSS -> consuming selector/component -> computed style` 链路校验；详见 `references/mapping-rules.md`。
- 必须做 coverage gate：color、font、radius、border、shadow、frame-or-asset、active-state 至少检查一遍，并按结果降级最终话术。
- 标准 demo gate 和业务 apply 分开：标准 demo/registry 负责风格能力验收，业务项目只负责最终 apply 或用户明确允许的临时业务预览。
- 主题 CSS 必须处在能影响目标页面的作用域和加载顺序；Vue scoped、CSS Modules、Taro page chunk、Tailwind、inline style 等特殊覆盖规则按 `references/mapping-rules.md` 处理。
- 宿主视觉债务必须 token 化或进入 review：硬编码色、字体、圆角、边框、阴影、动效、inline style、`:style`、Tailwind arbitrary class、旧主题变量和主题耦合 class 都要扫描。
- 自动处理的视觉项沉淀为运营可理解的“可调整项”；业务语义色表或库存/价格/状态/属性色进入 `needsReview`，必要时给出品牌化映射实验。
- 资产证据不能只写进 migration：抽象纹理、背景、frame、mask、边框、光效、占位媒体层应进入 style-only asset/recipe；未承接时 coverage 降级。
- 宿主换肤的视觉落地必须按 Atomic Design 分层判断：`atoms` 负责颜色、字体、圆角、边框、阴影、纹理、透明度；`molecules` 负责按钮、Tab、筛选、输入、标签、卡片基础态和交互状态；`organisms` 负责 Header、搜索筛选区、详情弹窗、卡组卡片、赛事列表、发布器表单块等业务模块；`templates` 负责页面骨架、区块顺序、滚动容器和导航位置；`pages` 负责带真实业务内容和品牌资产的最终实例。`brand assets` 和 `showcase moment` 是跨层能力，不再作为同级四层：资产可以挂到任意层，Hero、翻转、shine、大媒体和沉浸式模块通常只能进入 `organisms/templates/pages`。工具页、列表页、表单页默认 `efficiency-first`，只有在 `visualPlacementPolicy.pagePlacements[].showcasePlacement.businessPurpose` 说明业务目的时，才能注入 showcase；否则降级为 `atoms/molecules`，必要时只做少量 `organisms`。
- 宿主换肤改代码前必须先生成视觉机会判断：页面类型、业务目标、视觉承载力、allowedLayers、assetSlots、motionSlots、showcaseFit、overApplyRisk 和 recommendation。细则见 `references/host-visual-opportunity-map.md`。如果所有目标页都是低承载，不能为了展示能力硬塞强视觉；应保守完成 P0，并额外给出活动页/专题页 mock 作为产品讨论材料。
- 默认在宿主 git 仓库改动前创建 rollback checkpoint commit；`/brand rollback` 回到最近一次 `/brand` 前的 checkpoint。
- 必须启动或复用宿主项目 dev server，给出当前业务项目预览地址；不要把 demo 站 URL 当成业务项目验收地址。
- 必须验证默认初始状态：根地址、默认首页、默认 TabBar 选中页、首屏可见区域都要实际套用主题。
- 默认入口读取 app/page 配置，不能靠文件名猜；默认先 in-place 换肤已有入口和已有页面，不因 brand key 新建路由。
- 只有用户明确允许时才创建业务 preview route；若误生成未请求 preview artifacts，checkpoint 保护下自动清理并重建验证。
- 迁移组件状态时按 demo 站同类风格原子和同类 DangoUI 组件对齐，缺能力写未承接，不自造替代组件。
- 预览地址必须来自宿主项目实际 dev server 日志或浏览器验证；构建/启动未得到成功或明确失败前，不能写“构建成功”。
- 启动预览要解析实际 host/port；DNS 不可解析自动 fallback，端口冲突用实际端口；报告区分本次新增问题和宿主既有噪音。
- CSS / asset / font / Taro / Vite 细节按 `scan-css` 与 `mapping-rules.md` 处理：二进制不能 `@import`、CSS import 顺序要合法、Taro/Vite 可改 JS 入口导入、字体路径和 computed font 必须验证。
- 用户执行中补充反馈时先记录并继续执行；除非明确停止、回滚或改变目标。
- 每次 `/brand` 结束记录 run log：项目完整记录 + 全局脱敏摘要；不做静默网络上传。

执行 guard：

- 这一组 `brand-guard.mjs` 都属于第二层 guard。第一层入口必须先走 `/brand 总入口（必经）` 里的 `run-brand-workflow.mjs`，让脚本先判定当前是 `learn-brand` 还是 `apply-host`，再决定后面要跑哪些 guard。

- 应用风格前，在宿主项目运行 `node .claude/skills/brand/scripts/brand-guard.mjs resolve-demo`，从全局配置 `~/.codex/brand-skill/config.json`、环境变量或参数判断标准 demo/registry 是否可用。无标准 demo/registry 且无现成 style pack 时，先运行 `draft-style-pack` 写临时草稿；不要默认创建业务 preview route。
- 应用风格前，在宿主项目运行 `node .claude/skills/brand/scripts/brand-guard.mjs checkpoint --brand <brand> --source-url <URL> --command "/brand <URL>"`；若当前 skill 不在 `.claude` 路径，使用实际安装路径。默认自动做，不要求用户加参数。
- 改代码前先写一个很短的执行计划，推荐 JSON：`{"sourceUrl":"...","targetRoute":"/","preserveBusinessContent":true,"createNewBrandRoute":false}`；自然语言计划也可以，但必须包含 source URL 是风格来源、宿主已有目标页面/路由、保留原业务内容/数据/逻辑、不会新建品牌路由/页面。然后运行 `node .claude/skills/brand/scripts/brand-guard.mjs validate-intent --source-url <URL> --plan-file <plan>`。如果用户明确要求新建 preview 页面，才可加 `--allow-preview`。该 guard 未通过时不能编辑业务代码。
- 确定目标文件前运行 `node .claude/skills/brand/scripts/brand-guard.mjs detect-entry`。Taro 项目必须使用输出的 `files` 作为默认入口文件；不要直接假设 `pages/index/index.vue` 是首页。
- 如果发现已生成未请求的品牌 preview artifacts，先运行 `node .claude/skills/brand/scripts/brand-guard.mjs cleanup-preview --brand <brand>` 查看 dry-run；确认只包含品牌 preview 文件/路由后，在 checkpoint 之后运行 `cleanup-preview --brand <brand> --execute` 自动删除，再继续 in-place 应用。
- 对无现成 style pack 的官网 URL，先运行 `node .claude/skills/brand/scripts/brand-guard.mjs resolve-demo`。若能定位本地标准 demo 根目录，进入该 demo 根目录运行 `register-demo-preview --brand <brand> --source-url <URL>`，生成 `migrations/{brand}/style-pack-draft.json`、`public/brand-previews/{brand}.json` 和 `public/brand-previews/registry.json`；随后运行 `demo-gate --brand <brand> --demo-root <demoRoot>` 验证参考站、风格、组件、页面结构。若暂时没有本地/在线标准 demo，才运行 `draft-style-pack` 生成临时草稿；此时不碰业务项目，除非用户明确允许“在当前项目中实验”。
- 如果使用第三方抽取器（例如 dembrandt / extract-design-system），必须先运行 `node .claude/skills/brand/scripts/brand-guard.mjs import-dembrandt --brand <brand> --input <extractor-result.json> --source-url <URL>`，把结果写成 `migrations/{brand}/third-party-evidence.dembrandt.json`。第三方结果只能作为 raw computed evidence 候选：可喂给颜色、按钮、圆角、阴影、字体的初始判断，但不能直接覆盖 `style.json`、`dangoui-adapter.json`、demo preset 或业务代码；随后仍必须跑 `score-action-evidence`、`collect-rendered-assets`、`asset-usage-gate`、`coverage-gate`、`demo-gate`，并以 Brand guard 输出作为最终映射依据。
- 在 learn-brand 路径里，`import-dembrandt`、DTCG normalize/validate、`collect-site-evidence` / `score-action-evidence` 完成后，必须立刻通过总入口运行 `node skills/brand/scripts/run-brand-workflow.mjs tpp --mode learn-brand --brand <brand> --source-url <URL>`，或执行 `npm run validate:brand:tpp -- --mode learn-brand --brand <brand> --source-url <URL>`。TPP test 是“第三方抽取 -> DTCG 标准层 -> 我们自己的证据 -> dangoui 映射 / demo”之间的总闸门：它专门检查是否把分类色误提成主色、是否缺 CTA / active 客观证据、是否把规则只写在 md 没落到结构或脚本里。只要 `--du-primary-color` 不是由 action evidence 里的 CTA / active 颜色证明出来，就必须 blocking，不能继续生成 demo preset、dangoui adapter、theme token 或业务 apply 结果。
- 标准 demo 预览写入后，在 demo 根目录运行 `npm run validate:brand-preview`；如果 demo 仓库同时有 `validate:brand`，优先运行它。该 gate 必须在最终给出 demo 预览地址前通过。随后运行 `npm run validate:brand-quality -- --brand <brand>`；报告里若出现主色来自分类色、CTA 未作为主色证据、Hero/图片/字体/动效缺 rendered evidence、资产丰富但页面表达过少等 warning，预览等级必须降为 `draft-visual-preview`，并先修 demo 或明确告诉用户还没到可 apply 的质量。
- 对无现成 style pack 的官网 URL，在写 `dangoui-adapter.json`、demo preset 或任何主基调 token 前，必须先运行 `node .claude/skills/brand/scripts/brand-guard.mjs collect-site-evidence --brand <brand> --source-url <URL>`，再运行 `validate-tone --brand <brand>`。还必须运行 `collect-rendered-assets --brand <brand> --source-url <URL> --html-file <rendered/html> --css-files <css> --computed-file <computed-json>` 生成 `rendered-asset-inventory.json`，把 DOM `img/currentSrc/srcset/poster`、CSS `background/mask/border-image`、`::before/::after`、字体和网络资源统一归类。`site-evidence.json` 是主基调判断门票；`rendered-asset-inventory.json` 是 Hero/Image/Frame/Asset/Font 判断门票。脚本会按 CSS token、HTML inline style、角色权重和图片/asset 降权输出 `dominantToneDecision`。如果浏览器/截图环境可用，必须先把 NavigationBar、Hero、CTA、Card、Tag/Tabs、BottomBar 等关键节点的 computed style 存成 JSON，再用 `collect-site-evidence --computed-file <file>` 合并证据，并用 `validate-tone --require-computed` 复核。所有设计语言维度都按 computed-first 溯源：颜色看 computed color/background/border/shadow；字体看 computed `font-family` 再反查 `@font-face src`；圆角/边框/阴影看最终像素和来源 rule；动效看 computed animation/transition/transform；图片和 frame 看实际加载的 `img/currentSrc/background-image/mask/border-image`。未通过 `validate-tone`、缺少关键 computed 证据或缺少 rendered asset inventory 时，只能生成草稿和待确认项，不能凭截图局部色、品牌名、文件目录、本地资产缺失或用户一句反馈直接覆盖 adapter/demo token 结论。
- 写入或应用 replacement 后，运行 `node .claude/skills/brand/scripts/brand-guard.mjs validate-role-replacements --brand <brand> --css-files <theme/demo css files>`。该 guard 强制每条 computed replacement 有 `role / replacement / antiScopes`，并扫描 CSS 中明显的角色泄漏：例如文档说明卡、代码块、示例分组不能使用 control radius；大范围 `.phone span/p/small` 文字覆盖会产生 warning，必须人工确认是否按 `text-on-dark / text-on-light` 分层。guard blocking 未清零前不能声称完成迁移。
- 确定宿主目标页面后，运行 `node .claude/skills/brand/scripts/brand-guard.mjs scan-host-debt --brand <brand> --files <target files>`；若未传 `--files`，脚本会使用 `detect-entry` 的默认入口。输出中的 `autoFix` 必须自动处理，不询问运营；`visualDebt` 是本次 token/recipe 替换清单；`tokenizationPlan` 是必须消费的源码视觉值 token 化计划，并按 `fixStrategy` 执行：`tokenize-inline` 改静态 inline 值，`tokenize-dynamic` 保留条件但替换视觉字面量，`extract-class` 给复杂 gradient/border 加语义 class 并移到 CSS/recipe，`preserve-semantic` 进入业务语义确认；`needsReview` 只用于业务语义风险，例如状态色/价格色/库存色/游戏属性色，优先保留语义并映射到 semantic token；只有 `blocking` 才能暂停执行。该扫描必须识别 Tailwind arbitrary class，例如 `bg-[#f0ebe0]`、`text-[#333]`、`bg-white`，`:style` / inline style 视觉锁，以及 `TYPE_HEX` / `colorMap` / `typeColor` / `statusColorMap` 这类业务语义色表；发现 `inline-style-visual-lock` 时必须改源码绑定值，不能只写 theme CSS。扫描结果里的 `operatorAdjustmentGuide.autoApplied` 是已自动更改、但运营可能想微调的通用视觉项；最终回复必须用白话说明这些“可调整项”以及用户可以怎么要求改方向。`operatorAdjustmentGuide.needsOperatorDecision` 才是需要确认或保留的业务语义风险。
- 对每个目标页面运行 `node .claude/skills/brand/scripts/brand-guard.mjs create-selector-map --brand <brand> --files <target files>`；若未传 `--files`，脚本会使用默认入口。生成或更新 `migrations/{brand}/selector-map.json`。Theme CSS 必须优先使用其中的 `.theme-{brand} .<hostClass>` selector。若走 preview，确认 apply 时也必须用同一张 selector-map 合并回原页面。
- Host Strategist 在派发 Host Implementation 前必须生成 `migrations/<brand>/host-coverage-matrix.json`，逐格覆盖 `route × branch × state × component-family × viewport`，并记录默认入口、父子路由、真实交互节点、中文字体和业务语义色边界。实现和 fresh QA 后运行 `node skills/brand/scripts/validate-host-coverage-matrix.mjs --matrix migrations/<brand>/host-coverage-matrix.json`；只要存在缺格、父入口漏项、组件 sibling variant 漏项、触控目标过小或全宿主 scope 不完整，就不能宣称 full-host PASS。
- 生成/改动 CSS 后运行 `node .claude/skills/brand/scripts/brand-guard.mjs scan-css --root .`；有 blocking 时必须修复后再 build。
- 应用后运行 `node .claude/skills/brand/scripts/brand-guard.mjs coverage-gate --brand <brand> --files <target files/theme files> --evidence-file migrations/<brand>/site-evidence.json`，把输出的 `coverageLevel` 用在最终话术和 `validate-final --coverage-level`。coverage gate 必须读取 computed evidence 和 `preview-gate.json` 的 `assetRoleCoverage`：发现 CTA、导航、Hero、卡片、frame 等核心角色仍有 baseline/默认色，或强 IP/官网缺少 Menu、入口、角色、CTA 状态、frame 等高频资产角色时，输出 mismatch / missing 并降级覆盖等级。coverageLevel 低时必须降级说法，不能写“完整套用风格”。
- 应用后运行 `node .claude/skills/brand/scripts/brand-guard.mjs asset-usage-gate --brand <brand> --files <target files/theme files>`。该 gate 检查资产层级、装饰挂载、图片比例/重复和 inspector 高亮是否误导；有 blocking 时必须修复，有 warning 时只能按保守应用口径表达。
- 若宿主页面注入了 Hero、翻转、shine、强动效、大品牌图、沉浸式模块等 showcase 能力，还必须在 intent plan / brand-mod 中声明 `visualPlacementPolicy`，并运行 `node .claude/skills/brand/scripts/brand-guard.mjs visual-placement-gate --brand <brand> --plan-file migrations/<brand>/intent-plan.json`。该 gate 检查页面类型、视觉承载力、Atomic Design 允许层级、asset slot、motion slot、showcase slot、业务目的、首屏占用约束和 `notFor` 边界；通过只代表“使用理由清楚”，不代表视觉质量已经验收。
- 最终验收 P0 / MVP 是否可交代时，运行 `node .claude/skills/brand/scripts/brand-guard.mjs p0-acceptance --mode apply-host --brand <brand> --host-target <target> --plan-file <plan> --preview-url <host preview url> --files <target files/theme files>`。该 gate 汇总 TPP 语义、sourceRole、宿主目标、静态/真实 dev 预览、coverage 口径、Atomic Design 落地层和资产误挂风险，输出 `PASS / PARTIAL / FAIL`。只要输入来源仍是 `demo-style-source`、只有静态 HTML 预览、或 coverage 与实际 gate warning 不一致，就不能宣称 P0 complete；必须降级为 `conservative-application` 或继续修 blocking。P0/P1/P2 话术见 `references/atomic-acceptance-rubric.md`。
- 启动 dev server 后，把 server 日志传给 `node .claude/skills/brand/scripts/brand-guard.mjs parse-dev-server --log <logfile>`，最终输出使用脚本解析出的 actualUrl。
- 对 Taro H5 / 小程序项目，apply 后必须用浏览器或渲染快照验证实际 DOM selector 命中；可保存 DOM 到 `rendered.html` 后运行 `node .claude/skills/brand/scripts/brand-guard.mjs verify-dom --brand <brand> --html rendered.html`。如果 `.theme-{brand}` 不在真实 DOM 中，改用 `.taro_page`、`taro-view-core` 或实际渲染 class 作为主题作用域，不要只相信 Vue 源码里有 class。浏览器可用时还要记录旧值到新值的 computed diff，至少看 font-family、border-radius、border-color、box-shadow、background-image、active tab state。
- 最终回复前运行 `node .claude/skills/brand/scripts/brand-guard.mjs validate-final --file <draft> --brand-label <demo/registry 中展示的品牌名或风格名> --source-url <URL> --coverage-level <coverageLevel>`。缺业务预览 URL 是硬失败，必须继续执行；已有业务预览 URL 但缺风格名或默认入口验证时，先把 URL 给用户可见，再修正最终话术，不能用内部 token 表替代结果。最终 URL 不能是输入 demo URL 的原路径；不能把 demo/registry 页面当作业务成果。
- 最终回复前或紧随其后运行 `node .claude/skills/brand/scripts/brand-guard.mjs record-run --brand <brand> --source-url <URL> --coverage-level <coverageLevel> --missing <comma dims> --target-route <route> --preview-url <url> --default-url <url> --style-pack <true|false> --generated-preview <true|false>`。这条记录不阻塞预览交付；失败时只把记录失败写进技术备注，不影响用户看结果。
- 共享 phone shell、TabBar 或 home indicator 改动后，生成 `migrations/<brand>/mockup-state-matrix.json` 并运行 `node skills/brand/scripts/validate-mockup-matrix.mjs --brand <brand> --strict`。矩阵固定覆盖 `brand/style/component × tabbar/no-tabbar × normal/proof=1/proof=desktop/proof=mobile`；正常模式检查 indicator owner/position/background semantics、screen 宽度/圆角、底部 Chrome 圆角、滚动稳定与恢复，proof 模式必须隐藏 indicator。不得硬编码品牌。
- 删除、不再认可或由新版替代学习项目时，不删除 run log。运行 `node skills/brand/scripts/brand-guard.mjs tombstone-run --brand <brand> --disposition <retired|invalidated|superseded> --reason "<原因>" --scope all`；也可用 `--run-id <id>` 精确标记单次运行。`summarize-runs` 和 `issue-retro` 自动排除被标记的旧 run，但保留审计历史。
- 用户执行 `/brand rollback` 时，先运行 `node .claude/skills/brand/scripts/brand-guard.mjs rollback` 查看 dry-run，再经确认后运行 `rollback --execute`。

问题复盘自动化：

- 当用户说“学习下 brand skill 执行过程中遇到问题”“复盘这轮 /brand 问题”“记录这次 brand skill 的坑”“把刚刚的问题喂给 skill 修复”等同义表达时，必须进入复盘流程；无论问题来自当前 demo、宿主项目、其他项目、截图批注、粘贴文本或对话描述，都按同一流程处理。
- 第一步先运行 `node .claude/skills/brand/scripts/brand-guard.mjs issue-retro --scope all --limit 12`；如果当前仓库没有 `.claude` 路径，使用实际 skill 路径，或在 demo 仓库运行 `npm run brand:retro -- --scope all --limit 12`。该命令负责汇总项目内和全局最新 run log，找出高频缺口、覆盖等级和可能的脚本落点。
- 第二步把 `issue-retro` 输出与当前对话、浏览器批注、截图、粘贴文本合并，输出四块白话内容：`最新问题`、`复盘原因`、`解决方案`、`落地点`。落地点必须区分脚本、规则、demo 数据、单品牌 migration、宿主项目；不能只写“已记录”。
- 第三步必须问用户“这些复盘和落地方向 OK 吗？”；用户确认前不能修改 skill、脚本、demo、migration 或宿主项目。
- 用户确认后才落地。能脚本化的问题优先改 guard / extractor / validator / workflow；只有抽象判断、话术和操作顺序才写 `SKILL.md` 或 `references/*.md`；单品牌素材或页面问题才写 `migrations/{brand}/...`。落地后运行对应验证命令，并在需要时运行 `npm run sync:skills` 同步安装版 skill。

最终输出口径：

- 面向运营/vibecoder 时，默认只输出当前业务项目预览 URL、已应用的风格名/方向、原业务内容是否保留、默认入口是否验证。不要默认输出 token 表、adapter 表、文件清单或内部术语。
- 最终话术必须带覆盖等级：`complete-style-preview` 可说完整风格预览；`conservative-application` 只能说保守应用；`color-layer-application` 只能说颜色层应用。不要在覆盖不足时写“已完整套用”。
- 如果 `scan-host-debt` 返回 `operatorAdjustmentGuide.autoApplied`，最终回复增加一行“可调整项”：用运营能懂的话按类别说明哪些视觉已自动改过，以及用户可以怎么要求继续调整。它可以覆盖颜色、字体、圆角、阴影、边框、动效、布局节奏、按钮/卡片/筛选/选中态等，不局限于某个组件场景。这不是确认阻塞，不要暂停执行。
- 风格名/方向优先使用 demo/registry/style pack 中的展示名或用户输入中的品牌名，例如 `1999`、`HPMA`、`CZN`；不要把 1999 这类已命名风格泛化成“复古档案风格”一类二次命名。
- 技术细节只在用户追问、验证失败或需要人工补资产时展开。

维护者汇总：

- 项目内汇总：`node .claude/skills/brand/scripts/brand-guard.mjs summarize-runs --scope project`
- 全局脱敏汇总：`node ~/.codex/skills/brand/scripts/brand-guard.mjs summarize-runs --scope global`
- 问题复盘待确认：`node ~/.codex/skills/brand/scripts/brand-guard.mjs issue-retro --scope all --limit 12`
- 汇总用于判断哪些 source host 高频出现、哪些 coverage 维度常缺、哪些品牌值得沉淀为维护版 style pack。

## WebFetch / Sandbox Fallback

当 URL 无法被 WebFetch、浏览器、网络或沙箱完整抓取时，不要立刻要求运营贴 CSS 或手写风格描述。降级顺序：

1. 判断输入类型：品牌官网 URL、公开 demo/registry URL、本地 demo URL、截图、Figma/DTCG 文件或普通自然语言。
2. 如果输入是 demo/registry URL，优先从 path、query、metadata 或 registry API 解析 `brandKey/sourceUrl/stylePackUrl`；不要把 demo 站自身当品牌官网重新学习。
3. 如果输入是品牌官网 URL，先根据 URL、页面标题、registry 索引或 `migrations/*/style.json.source` 推断 brand key。
4. 在当前业务项目查找匹配的 `migrations/{brand}/style.json`。
5. 查找已安装全量本地 style packs，例如 `migrations/*/style.json` 和 `public/assets/`。
6. 查公开 registry，例如 `GET /api/brand-migrations?source={encodedUrl}` 或 `GET /api/brand-migrations/{brand}`。
7. 只有 style pack 不存在、registry 不存在、URL 也无法采集，才请求替代素材。

请求替代素材时保持低门槛：优先 2-3 张核心页面截图，其次 HTML/CSS/network assets，再其次 Figma 链接或 DTCG/tokens JSON。不要把“请粘贴 CSS 文件内容”作为默认第一选择。

## 安装到其他业务项目

推荐安装“skill + 全量本地 style packs”，不要只安装某一个品牌：

```bash
mkdir -p .claude/skills migrations public/assets
rm -rf .claude/skills/brand
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/.claude/skills/brand .claude/skills/brand
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/migrations/. migrations/
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/public/assets/. public/assets/
```

安装完成后，用简短提示告诉用户：

```text
已安装 brand skill。你现在可以用：
/brand <品牌官网 URL 或 demo 站 URL>

它会自动判断是否复用本地/registry style pack；没有可复用资产时，会采集 URL 或让你补截图/Figma/HTML 等素材。常见用途：学习一个网站风格、生成 2-3 个预览页面、把已沉淀风格应用到当前项目。
```

## Public Demo / Registry

公开 demo 站不是口头风格说明；它应该托管 `migrations/{brand}/style.json`、`brand-evidence.json`、`dangoui-adapter.json`、`component-mapping.json`、`preview-gate.json`。推荐 API：`GET /api/brand-migrations/{brand}` 和 `GET /api/brand-migrations?source={encodedUrl}`。

Demo 站必须给每个参考站和页面稳定 URL：

```text
/#/brand/{brand}/pages/{pageId}
/#/brand/{brand}/style/{styleCategory}
/#/brand/{brand}/components/{componentName}
```

当用户输入 demo 站 URL 时，先从 hash path 解析 brand/page/style/component，再查 `migrations/{brand}/style.json` 或 registry；不要重新学习 demo 站外壳本身。

如果 agent 正在业务项目中执行，demo 站 URL 的含义是“把这个风格套到本项目”，不是“打开 demo 站检查”。输出中的 `预览地址` 必须是业务项目地址；demo URL 只能出现在 `来源风格` 字段。

## Claude Roleplay Validation

当用户要求“给 Claude 试用”“让 Claude 扮演运营/vibecoder 验证 skill 是否好用”时，按真实使用者验证，不按维护者视角解释内部文件。测试入口只允许是一句话：`/brand <品牌 URL>`，或在已有 style pack 的业务项目里用 `/brand <任意品牌官网 URL 或 demo 站 URL>` 触发自动复用。

验收问题：

- 用户是否只用一句 `/brand <URL>` 就能开始？
- Agent 是否自动找 URL、style pack 或 migration，而不是询问内部实现细节？
- 预览是否是 2-3 个真实页面，而不是同一页面换文案或组件摊平？
- 是否复用了真实 assets，并说明哪些是 DangoUI token、哪些是 `style-only`？
- 是否输出缺口清单，方便后续更新 DangoUI 或业务组件？
- 是否构建通过，并给出宿主项目预览地址完成浏览器可见验证？

## 工作流

### 1. Preview Gate

先生成 2-3 个真实不同的 demo 方向或页面：页面结构、内容模式和组件组合都要不同，不能只换文案或摊平组件。强风格网站必须从源站导航、首屏 CTA、二屏模块、资讯/角色/商品/世界观/媒体入口和真实资产中选页面；Hero、Frame、Asset、Motion 等表达细则见 `references/mapping-rules.md` 和 demo 站对应风格原子。

最小 learn-brand 执行链固定为：

1. `/brand <URL>`
2. 先走统一入口：`node skills/brand/scripts/run-brand-workflow.mjs run --mode learn-brand --brand <brand> --source-url <URL>`，或 `npm run brand:learn -- --brand <brand> --source-url <URL>`
3. 统一入口内部先跑：`import-dembrandt`（或其他第三方抽取结果写入 raw evidence）前置后的 TPP gate 所需检查
4. 再补齐 DTCG normalize / validate、`collect-site-evidence`、`score-action-evidence`、`collect-rendered-assets`
5. `tpp-test`
6. 通过后才允许继续写 `brand-mod.json`、`dangoui-adapter.json`、demo preview 和后续 apply

如果 `tpp-test` 没过，AI 不能以“md 里已经写了原则”为由继续往下走，必须先修 blocking 或明确把结果降级成草稿。
同时 `tpp-test` 现在会检查自己是不是由 `run-brand-workflow.mjs` 触发；直接绕过总入口去跑 `brand-guard.mjs tpp-test`，会被判定为 `missing-total-entry`。

每页记录：`sourceNavigation`、`selectedPagesReason`、`scenarioRole`、`interactiveStates`、`assetRoles`、`antiPatterns`。

### 2. 品牌证据统计

统计前声明口径：UI 颜色、非 UI token、媒体资产、图片资产、组件模式分开统计。占比只在同一口径内计算。图片资产单独进 `assetInventory`。Color 输出分为 `完整色板` 和 `高频映射证据`；DangoUI baseline 只展示一级/二级/三级关系，不做频次统计。细则见 `references/mapping-rules.md`。

### 3. 资产分层

把信息拆成 BrandEvidence、BrandIntent、EchoMapping、DangouiAdapter、ReviewQueue。`style.json` 是长期机器主入口：`document` 用 Figma REST-like 节点树，`tokens` 用 DTCG 结构。详细契约见 `references/brand-dtcg-migration-asset-standard.md`。

### 4. 装饰边界识别

映射前先判断边界类型：plain border、divider、frame、asset frame、texture frame。普通边界可进入 `--du-border-*` / Divider；frame、asset、texture 进入 style-only recipe / asset / ReviewQueue。必须联动检查 radius、background、shadow、asset，不要把装饰框当普通 border。

### 5. 映射判定

使用 `references/mapping-rules.md`。摘要：一级色板只描述颜色；二级色板映射 App 用色角色；三级组件别名继承或派生自二级；非 color token 优先映射 Echo/Figma primitives；DangoUI adapter 必须证明真实 `--du-*`、prop、slot 或 class 存在；style-only 不能伪装成正式 token。禁止新造 token、使用废弃 `--du-c-*`、从语义直觉跳到组件样式结论。

### 6. 承接状态

每个 token 和 component 映射都标记状态：`mapped`、`fallback`、`style-only`、`missing`、`ask-user`。demo 中未同步能力放在 `demoOnlyVisualControls`，不要放进 `dangouiTokens`。

### 7. 生成输出

使用 `references/output-template.md`。必须回答：高频值、次数、占比、映射理由、组件映射、demo-only 内容、承接状态和真实 token chain。可用脚本：`skills/brand/scripts/create-dangoui-mapping-doc.mjs` 或项目本地同名脚本；脚本生成后必须复核。

### 8. 应用到 Demo 或宿主项目

保持 dangoui token 名称不变，只替换 value；不支持的风格特征用 demo 专用视觉控制或 placeholder 表达；运行构建并用浏览器验证。宿主项目应用时保护原业务内容、原组件结构、默认入口首屏和构建完整性；新增页面或 class 必须继承已校准效果。设备外壳不是品牌内容。Frame / Divider 不全局套用，只给有证据的重点容器。Layout / Spacing / Radius / Shadow / 风格原子表达以 demo 站 description 和 `references/mapping-rules.md` 为准。

## 最终回答格式

执行模式默认只保留：

```text
当前项目预览地址：（必须是已验证可访问的业务项目 URL）
风格方向：（一句运营能懂的话，说明这次换成什么感觉）
默认入口首屏验证：（根地址 / 默认首页 / 默认 TabBar 页是否已换肤）
已换肤页面/路由：
实际改动文件：
已应用的风格能力：
可选应用建议：
未承接/待确认：
```

如果还没有启动成功或没有验证可访问 URL，不要填写 demo 站地址；写“预览阻塞”并说明失败命令、退出码或日志。

预览成功后的首屏回复优先给运营可读信息：业务项目 URL + 风格方向一句话 + 默认入口是否已换肤。token、DangoUI、selector、adapter、computed style 等技术细节只放在简短附录或未承接里，不要作为主输出。

当 style pack 含有 `style-only` 能力时，把术语翻译成运营能理解的页面位置，例如卡片外框、页面底纹、图片展示区、选中状态、主视觉动效。

不要把 token 表、迁移资产读取结果、审计报告、计划说明当成交付物；这些只能作为内部依据或最终简短附录。最终必须说明原业务内容是否保留，若有任何内容、字段、路由或交互被改动，必须列入“未承接/待确认”并说明原因。

## 验收清单

- 正文中文。
- 统计口径明确。
- 高频表有原始值、次数、占比、证据、角色判断、映射目标。
- 上游 schema key 没混成 dangoui token。
- 没新造非 dangoui token 名。
- 没把废弃 `--du-c-*` 当迁移目标。
- token 和 component 都有承接状态。
- 组件样式解释有真实 token chain。
- `dangouiTokens` 和 `demoOnlyVisualControls` 分离。
- 2-3 个 demo 页面不是同一套通用内容；切换后结构和关键内容可验证不同。
- 用户已校准的字体、icon、边框、圆角、阴影没有在后续内容改造中丢失。
- 边框不是误加内框；圆角不是由通用容器样式或控件习惯误推导。
- 构建通过并完成浏览器验证。
