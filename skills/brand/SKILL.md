---
name: brand
description: 从品牌官网、活动页、DESIGN.md、截图、Figma 或 DTCG 学习可迁移视觉语言，生成 DangoUI 品牌资产，或把已验证 style pack 应用到真实宿主。用户提到品牌学习、视觉迁移、换肤、style pack、DangoUI 映射或基于参考站改造页面时使用；不用于没有品牌来源的普通 UI 调整。
---

# Brand

把来源品牌转换成可追溯、可复用的 DangoUI 视觉资产。只按当前轮明确输入选模式；历史会话、旧产物和仓库品牌目录都不是本轮意图。只读当前节点需要的契约；不要全文读取大型 JSON 或历史说明。

## 用户结果与内部组织

在真实宿主会话中，用户只给品牌网址时，默认目标是 `host-concepts`：先由 ImageGen 生成三张完整宿主换肤效果图，用户选方向并明确要求后才转可交互 H5；认可 H5 并授权后才修改宿主。没有宿主上下文且明确学习品牌时才独立交付 learn-brand。学习成果、映射审计和 QA 页面是内部产物，不得顶替宿主预览。

本项目品牌库 `#/brand/<id>/...` 链接是“选用已发布品牌包”，不是待学习官网；入口自动解析复用。普通官网的候选复用仍需明确选择。返回角色 dispatch 后实际执行该角色，不能反复调用 `continue` 代替执行；具体恢复行为见 request intake。

Design Director / Orchestrator 保留父目标与成本边界，专业角色按紧凑输入生产，另一个执行者做独立 QA；可机械验证的事实不增加专业角色，独立工作可并行，有依赖的角色不能提前猜测上游。用户不负责填写专业契约、识别最早责任节点或决定是否调用 ImageGen。

总 Agent 默认兼任技术负责人：维护或修复本项目时，读取 [技术负责人职责](roles/design-director.md#技术负责人职责)，先用实际执行证据定位问题、反驳拟议修法，再比较复用、薄适配与自研的总成本；新增依赖、组件基础设施或工作流也遵循该职责。已有有效选型直接沿用，仅在需求或兼容性变化时重评；不为普通改动增加调研、角色、报告或门禁。

首次三方向交付默认提供一个统一选案视图：A/B/C 使用同一业务场景与视口，完整、等权展示三张 ImageGen 效果图，明确它们不是可交互实现，由用户自行选择。独立 QA 的推荐只作说明，不隐藏其他方向、不按推荐重排或默认选中，不用三个分散链接替代比较入口；具体交付见 request intake。推荐不等于用户认可，也不授权宿主修改。已有准确 Approved Master 就继续该版本，不能借修流程重开 ABC。

受控种子试用沿用现有模式，不另建工作流或降低历史 Goal。开工前确认一个核心任务、隔离副本、可执行回退点及维护者支持；试用范围优先已验证模块。任务成功、可参与试用、生产认证分别报告。非关键精修可列待办；业务破坏、核心任务不可用、数据/授权风险和无法安全回退仍阻断。未知原因不能称宿主既有问题，冻结要求不能事后静默降级。失败时用现有 delivery/status 给出具体卡点、责任方和恢复条件，保留产物后结束本次尝试；不自动反复重抓来源、重跑整套或要求用户不断回复“继续”。仅在新证据或明确纠正动作已具备且授权范围内续跑失败阶段。

三个层次不可互相补偿：角色组织保证接力；独立 QA 保证业务、数据、渲染与交付目标正确；Expressive 在品牌设计系统 Productive 与真实任务约束下提高表现力。按需查询知识库 `user-goal-role-qa-expression-question`，其候选状态不能冒充跨品牌验证。

## 安装后与首次使用初始化

首次安装、更新或用户问“怎么用”时，复用本会话信息并执行：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs init --host <宿主目录>
```

该命令只读检查宿主并返回缺失信息；不联网、不启动、不修改宿主。仅传当前会话明确输入，简短展示 `welcome`，只问最少缺口。

## 选择模式

- `learn-brand`：学习品牌并产出 Evidence、Intent、Brand MOD、DangoUI mapping 与品牌学习 Demo；默认不改宿主。
- `design-host`：读取已学习品牌和真实宿主，默认 `--concept-medium full-image`，用官网设计语言、实际截图及素材生成三张完整 ImageGen 界面效果图。整图统一设计 Expressive 与 Productive 的视觉关系，不先画背景再拼面板；此时不生成 H5、不声称组件已调用。只有用户明确要求交互 H5 时用 `--concept-medium interactive-h5`，再以官网设计系统实现 Productive；不得修改宿主源码。
- `apply-host`：实施 design-host 已冻结的唯一方向，或用户明确认可的单模块组件；保护业务内容、数据、路由、交互和组件 API。单模块采用下述限域交接；整页设计输入无效时退回 design-host，品牌证据缺失时退回 learn-brand。

用户明确要求从已有资产检验一个尚未批准的模块时，优先使用 [限域组件任务](references/approved-component-handoff.md#普通输入自动准备) 的 `--module-task`：只给现有品牌包、宿主、任务与目标路径，入口列出原包候选，由执行 Agent 选择后自动准备隔离副本与交接输入，普通用户不填写 manifest 或 recipe ID。已有准确 manifest 才用 `--component-task`。先选材、判断兼容性，再在独立宿主副本中试装；不要求预制目标平台组件，不转为整页三方案。试装授权不是设计批准，原宿主只读，独立运行 QA 后再交用户判断。

运行前读取 [request intake](workflows/request-intake.md)，只按当前轮用户意图冻结 `request-kind`。首屏三方案固定走 `host-concepts → design-host`；缺品牌参考就问，不猜历史品牌，也不降级到 `learn-brand`。同一入口承载 Expressive 探索和 Productive 实现，不另建绕过交付检查的试验路线。原始 `run` 必须显式传 `--request-kind`，入口会在联网和写文件前拒绝错路由。

唯一对外入口是 `run-brand-workflow.mjs`；`brand-subagent-workflow.mjs` 仅推进内部状态机，其他脚本不得拼成替代路线：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs run --request-kind <brand-learning|host-concepts|host-implementation> --mode <learn-brand|design-host|apply-host> ...
node <skill目录>/scripts/brand-subagent-workflow.mjs <prepare|next> --brand <brand> --root <隔离运行目录>
```

角色只使用 `next` 的 dispatch packet、hashed inputs 和当前岗位 reference；不得通读 contract、所有角色文档或大型 DangoUI 数据。

## learn-brand

职责链：`Evidence → Interpreter → Demo → independent Visual QA`。首次使用 fresh `initial-blind`；局部修复优先由原独立 QA 做 `regression-review`，实质改向、QA 参与制作或明显漏检才要求 `fresh-blind`。具体身份、证据与范围契约见 [QA review modes](roles/blind-qa-tpp.md#复核模式)。Dembrandt 是 Evidence 的候选发现工具，不是独立角色或事实来源。完整规则读 [learn-brand workflow](workflows/learn-brand.md)，当前角色再读取 dispatch 指定的岗位契约。

review-mode 的 prepare/next/record 工程接入目前仅限 learn-brand，入口与最小命令见 [learn-brand QA 准备](workflows/learn-brand.md#qa-复核包准备)。design-host/apply-host 仍用各阶段现有独立 review 入口；通用复核政策不代表这些阶段已接入原 QA 复验，禁止用 learn-brand helper 强行调用。

来源 URL 的 HTTP/HTML/CSS 抽取只用于候选发现，不能独立成为视觉 Evidence。唯一总入口必须自动执行浏览器原生观察，不要求用户额外传 `--force-browser`。对带非循环开场媒体、图片主导或固定视口 Swiper/Fullpage 的官网，分别保存 opening peak 与 settled page frames，按控制器 active 状态而不是 `scrollHeight` 判断覆盖；开场未结束、控制器未触发或正式内容未出现时返回 `NEEDS_EVIDENCE`，不得交给 Interpreter。

Evidence 还必须盘点页面实际渲染的官方身份素材，不能只收首页 Hero、Logo 和卡牌而漏掉其他区块的透明角色、产品 cutout 或组合资产。为每项记录原始尺寸、透明通道、适用场景和可安全展示的最大尺寸；Brand MOD 必须保留设计阶段可能需要的合格身份资产，不能因 Demo 当时未使用而静默丢弃。

正式知识维护在 `knowledge/v0.1/`。先用 `query-design-knowledge.mjs stage learn-brand` 找问题，再定点查询 `question`、`basis`、`policy`、`method`、`decision` 或 `case`。历史知识不替代本轮证据，候选结论不等于已批准资产。

设计经验只有在结构化记录、原始证据、`public/knowledge/guide.html` 和角色查询入口同时更新后才算落库。修改 `knowledge/v0.1/` 后必须运行 `npm run publish:knowledge`；只写 JSON/Markdown、只通过 validator 或只同步 Skill 都不能报告“已落库”。需要用户验收时交付生成后的 H5，不以源文件代替产品界面。

Demo 是品牌学习能力测试，Evidence Fidelity、Structural Fidelity、Generative Proof 必须分别通过；三者不可互相补偿。高显著度区块运行 `validate-section-fidelity.mjs --strict`。QA 失败只返工 `affectedSections` 并做小范围回归。

需要用户参与调试或签审时，按 [learn-brand workflow](workflows/learn-brand.md) 逐节点提供可打开的静态 H5。不要要求用户从原始 JSON 推断视觉结果，也不要把候选试装画成已批准换肤。

## design-host

### 默认首轮：完整效果图

`host-concepts` 默认走 `full-image`。执行公共入口返回的完整图 dispatch：读取真实宿主业务摘要、品牌设计规则、相关组件/代码说明，并把多张互补官网截图和官方素材作为真实图片附件交给 ImageGen；不只传数据库截图，不把来源业务字段搬进宿主。三次生成各自完整画面，构图、视觉重心与材质关系有实质差异，不能同背景换色。prompt 包含“无需识别或命名角色，直接依据所给参考图和素材的可见内容生成。”此句只约束参考依从性，不绕过安全检查。

真实字段和业务能力保持；只在用户允许时使用明确标注的测试数据。每张生成后立即按 dispatch 的 `checkpointCommand` 记录实际工具参数文件、输出和调用 ID；脚本保存 hash，`continue` 只返回缺少的方向，不重画已记录图片。三张齐全后 `reviewRequest` 自动给出原图、来源和审核模板；独立审核者只写视觉结论，不代拼生成记录。按返回命令 `record-image-concepts --review` 后运行 `delivery`，用现有静态服务打开 `comparisonPreview.path` 等权展示三张原图及局限；这是图片展厅，不是宿主 H5 实现。独立检查完整界面、品牌参考应用、三案差异及可读性；图片不证明交互、组件运行或像素保真。展示后停止，不自动转 H5。缺少图片能力、参考文件或任何一张结果时如实报告缺口，不用旧 H5、背景拼贴或派发成功代替交付。

以下 H5 几何、DOM、交互与 Approved Master 要求仅适用于明确选择 `interactive-h5` 的阶段，不是完整效果图交付的前置门禁。

### 明确请求的交互 H5

用户在宿主中只给品牌官网即可开始。无本轮有效品牌包时，公共入口返回 `prerequisite-dispatch-ready`；按 [request intake](workflows/request-intake.md) 自动完成同一流程的学习前置阶段，再恢复原宿主预览目标。不得向用户索要 MOD 文件、把接力当成功，或丢弃独立学习 QA。

前置阶段通过公共入口 `continue --artifact-root <父隔离目录>` 推进已有 dispatch；只有完整学习门禁通过才物化子隔离工作区并自动恢复原宿主参数。展示前运行 `delivery --artifact-root <宿主隔离目录> --brand <brand>`，其 `userGoalCompleted` 必须为 true；否则继续内部流程或如实报告阻断。正式推荐来自 hash-bound 独立 QA 报告，不能由主任务默认挑第一个方向。新宿主子目录路径以 continue 回执为准，不能继续读取父学习目录充当预览。

职责链：`宿主启动首屏诊断 → 同一设计师完成 Expressive 探索与 Productive 实现 → 三组可交互隔离 H5 → independent visual/interaction QA → explicit user selection`。明确要求 ImageGen 时，生成发生在设计阶段，不等待 QA 批准缺口；未要求时由任务需要决定是否生图。已有 H5 的局部增强仍使用缺口、几何冻结和 integration QA。第一次试风格只读真实启动页，不以全项目扫描拖延；`design-host/fast` 由 prepare 确定性提取首屏事实，standard/certification 或 H5 批准后的全项目判断才派发 Host Strategist。三案使用真实冻结记录或明确 schema/loading 状态；允许业务不变地重组页面和组件，旧页面没有 Hero 不代表新设计不能有表达区。

试验隔离、时效与有界调用见 [request intake](workflows/request-intake.md)。预算不能省略明确要求的 ImageGen、三方向或独立 QA；生成失败如实报告，不能把无图回退标为已满足 Expressive 要求。

fast run 同时治理文本上下文：运行时能返回真实 token 时，40k–60k 为软目标、80k 为硬停止线；拿不到真实 token 时必须明确写 `unavailable`，只用 unique input bytes、duplicate input bytes、additional read bytes 做诊断代理，禁止把字节估算冒充真实 token。每个 dispatch 只携带本岗位紧凑包；重复输入占比超过 20% 先去重再进入昂贵工具。时间或 token 预算只能裁掉可选探索和重复读取，不能裁掉真实宿主事实、品牌依据、独立 QA 或真实数据约束。

用户只提供宿主与品牌参考。preflight 自动解析启动首屏；fast prepare 用 `derive-host-startup-baseline.mjs` 提取 Productive floor、业务字段、扫描行为和现有展示事实，standard/certification 再由 Host Strategist 补充判断。现有布局是观察，不是新布局禁令；缺少真实对象只限制对象展示，不禁止基于品牌来源的 Expressive 探索。启动页缺失、hash 不符或 baseline 校验失败时禁止进入视觉生成。

fast 确定性诊断或 Host Strategist 必须从启动页源码与可用渲染证据自动冻结 `hostContentContract`：真实业务对象、字段、来源定位、原始尺寸、当前显示尺寸、最低可读尺寸和可用于场景的状态；同时冻结 `resultHierarchyContract`。只有源码、真实数据或交互状态明确证明精选、排行、推荐、选中等不同角色时，重复结果才允许差异化；没有证据时默认 `peer`，Productive 与 Expressive 都不得为了视觉焦点创造一大两小或隐含推荐。设计师只能引用冻结事实，不能自报或猜测；没有合格对象时自动采用 Productive UI，不向用户索要对象清单、尺寸、结果层级或融合方案。

`readiness=ready` 的宿主对象必须绑定启动页源码 hash 和 `host-startup-measurements/v1` 渲染测量回执；无法取得 intrinsic/current size 或回执 hash 时只能写 `unresolved`。确定性诊断或 Host Strategist 完成后都运行 `validate-host-startup-baseline.mjs --file <baseline> --startup-page <startup-page> --root <隔离运行目录>`。concept brief 还必须逐方向声明对 `informationDistributionContract` 的保持关系；validator 会计算计划尺寸比例并拒绝宿主禁用的产品隐喻，不能靠 `preserveAspectRatio: true` 或设计师自述通过。

品牌官网命中 Registry 只表示发现了一个可复用候选，不能静默代替本轮品牌学习。使用者必须明确选择重新学习/更新，或用 `--reuse-style-pack` 接受该已审核包；直接提供本地 `--style-pack` / `--mod-file` 也视为明确选择。复用包安装到隔离工作区时必须带齐 Brand MOD 所声明的 hash-bound runtime assets；任一被本轮 H5 或局部 ImageGen 引用的 `localPath` 悬空或 hash 不符时阻断。没有合格官方身份素材不阻断设计系统 H5，但禁止 ImageGen 伪造身份主体，并在缺口判断中记录只能使用中性局部资产或无图回退。

生图前同时校验身份素材的合成适配性：透明/遮罩能力、原始像素尺寸、计划展示尺寸、预期透视与光照是否能在不改绘身份主体的前提下完成。素材只能靠明显贴片、相框或过度放大才能进入原创环境时，返回 `BRAND_IDENTITY_ASSET_INADEQUATE` 并说明缺少的资产规格；不得先生成通用背景再用 CSS 阴影掩盖割裂。

开始前按需读取 [Host Strategist](roles/host-strategist.md)、[Brand Application Designer](roles/brand-application-designer.md)、[Host Brand Composition Grammar](references/host-brand-composition-grammar.md)、[Visual Program](references/visual-program.md) 与 [Expressive moments playbook](references/expressive-moments-playbook.md)。

### 图片能力声明

每次实际生图均按 Designer 岗位的「实际生成输入记录」保存原始工具参数及素材用途；读过品牌文件不等于生成器收到这些内容。用户明确要求单独测试 Hero 等局部时，按指定范围做隔离诊断，不能把局部试验标成完整 design-host 通过，也不能默默丢弃当前已确认的品牌输入。

用户明确要求 ImageGen 探索时，在设计阶段检查当前任务是否暴露内建 `image_gen`；未要求的局部增强可在 QA 定位缺口后检查。不得靠环境变量或猜测。

- 有内建 `image_gen` 时运行 `declare-capability --image-generation available`；默认内建模型可直接生成正式图片候选，不要求或猜测其底层模型名。
- 没有时传 `unavailable`。外部 CLI/API 不是自动替代品，只有用户明确批准后才能另行使用。

进入局部资产阶段但未声明时，`next` 返回 `IMAGE_GENERATION_CAPABILITY_UNDECLARED` 并保持可重试；明确不可用时保留已经通过 QA 的无图 H5，并把缺口标成未增强，不得编造图片产物。不要手写 capability JSON。

通用公式为 `ImageGen Expressive + 品牌设计系统 Productive + 设计专家决策知识`。明确要求的 Expressive 探索须绑定官网参考、素材和三个不同的构图意图，生成后再组合 H5，不冻结未获批准的旧布局。Productive 的文字、业务数据、表单、搜索和交互由代码承载；数据库等局部模块的风格不能因功能匹配而升级为整站设计语言。生图前冻结适用知识输入，保存实际 prompt、实际参考图和生成结果，具体见 Designer 岗位。只有已批准 H5 的局部增强才冻结 selector、DOM、字体度量和容器几何，并运行 `validate-expressive-geometry-lock.mjs`。两种情形均保留来源身份边界、真实数据、可读性及独立审核；图片不能冒充可交互页面。

三组 H5 从一开始就使用真实宿主内容、视口与冻结品牌包，但不启动或修改宿主 runtime；动态数据没有冻结真实记录时使用明确的 schema/加载状态，不能编造业务数据。ImageGen 资产只是 H5 中可替换的局部视觉层，不能替代 H5、文字、真实对象或交互验收；若回填需要透视对象、遮挡或环境光，读取 [expressive reconstruction](references/expressive-reconstruction.md) 并只对该局部建立可检查的几何、前景、接触阴影与环境光关系。

启动页诊断还必须自动冻结 `navigationShellContract`。每组 H5 都要逐项呈现真实宿主的品牌切换、主 Tab、账户入口等必需 shell 项，并在 H5 内决定其 `native-preserved | custom-contained | custom-immersive` 处理及场景连续性。缺任一项、未声明连续/明确分区，或需要 apply-host 临场新增全宽遮罩、渐变带、模糊层才能容纳导航时，不得进入用户选择或 Approved Master；应只返工 navigation shell，不重做已经通过的列表和数据区域。

生产者提交前必须逐案在冻结视口渲染，并分别遮住品牌名与 Logo 检查首屏：每一案都要由贯穿构图与真实任务区的来源机制建立品牌辨识度；只有一个小角色、角标或贴片的通用白色工具页直接判为整案失败，不能留给 ImageGen 或独立 QA 补救。生产者与独立 QA 统一通过 Skill 静态服务的 viewport harness，在同源 iframe 内按精确 `390×844 CSS px` 检查；外层浏览器尺寸、缩放和 DPR/物理像素等价不能替代 CSS 视口。多模块宿主页还必须在该 iframe 文档中证明 `scrollHeight > clientHeight`、滚动位置确实变化并能恢复，禁止为塞进一屏而缩放或裁掉真实列表。渲染使用当前环境已有的浏览器自动化能力，不在阶段末尾探测 Chromium、Playwright、Puppeteer 等未声明本地运行时。独立 QA 直接使用内置浏览器，不尝试带请求头策略的外部浏览器；时间预算必须覆盖本地服务启动、三案交互、几何测量与 receipt 记录，dispatch 必须直接给出完整记录命令，不能让角色临场反查 CLI。

来源素材的用途必须机械绑定：真实 DOM 的 `assetRef`、`assetPlacement` 与 `assetSalience` marker 是渲染事实，metadata 应带同值；metadata 漏值但 DOM 只有一个无歧义组合时由 Finalizer 确定性补全，不要求角色重复手抄。Finalizer 对照 Brand MOD 的 `role` 与 `targetScope`；只有身份、Hero 或环境类素材能成为 primary / identity-hero，说明图、研究图、组件示意和反馈动效只能留在其支持性范围。DOM 缺失、多个 marker 冲突或用途不匹配时在独立 QA 前阻断。

机制引用优先使用冻结设计系统的完整 id；角色省略命名空间但存在唯一后缀匹配时，Finalizer 可规范为完整 id（如 `expressiveBudget` → `layoutRules.expressiveBudget`）。出现多个候选或完全不存在时仍按未知引用阻断，不能借规范化发明设计系统能力。

design-host 的三份 H5 固定写入隔离运行目录的 `migrations/<brand>/h5-directions/`，契约写入 `migrations/<brand>/`，receipt 写入其 `receipts/`；`public/`、宿主源码和任意自选输出目录都不是生产路径。调度包必须直接给出这些位置，不能让角色临场决定。

每个阶段按 `design-host-route.json` 顺序门禁。首次没有已批准方向时生成三组 H5；一旦用户在后续迭代中明确认可某个准确 H5，该文件必须立即通过 `promote-approved-h5-master.mjs` 升级为唯一 `approved-master.json`，不得只把经验写入知识库、仍把文件留作普通 trial。已有 Approved Master 时不得重新开启无关 ABC；后续候选必须声明父 Master hash，只有明确告知会替换现有 Master并取得用户批准后才能升级。三组 H5、独立 H5 QA、缺口决策、必要时的局部资产回填与独立 integration QA、用户选择缺一项都不能跳到下一阶段。机器通过只表示可以进入人工审美复核，且必须指出至少一条它愿意推荐给人的方向；这仍不等于用户喜欢。用户认为全部不合格时运行 `reject-concepts --reason <原因>`，保存失败样本并终止，不自动返工。用户确认 H5 前不得全项目扫描或实施宿主。

## apply-host

用户已认可准确组件、仅要求实施一个模块时，使用本入口的 [已认可单模块交接](references/approved-component-handoff.md)：`run --request-kind host-implementation --mode apply-host --component-handoff <manifest>`。编排者根据真实批准准备输入，交付准确实现与使用约束；先判断运行平台，Web 组件不能因同为 Vue 就直接用于 Taro。此范围不重做整页方案，也不改变整页/来源学习的批准状态；实施者仅接线，独立运行检查后才能报告该模块完成。以下整页职责链适用于未采用此明确单模块范围的任务。

职责链：`宿主全页面扫描 → Host Strategist 逐页判断 → Host Implementation → Smoke QA → awaiting-user`。只有用户确认隔离 H5 后才进入本阶段；此时自动扫描全部路由和页面、形成完整 Productive baseline，再按冻结方向换肤。当前岗位按需读取 [Host Implementation](roles/host-implementation-agent.md)、[Host Visual QA](roles/host-visual-qa.md)、[theme load order](references/host-theme-load-order.md) 与 [Runtime Gate](references/mapping-rules.md#公开宿主的-dangoui-runtime-gate)。

实施前验证最终方向、pre-edit baseline、`design-host-route.json` 和主题加载顺序。存在 `approved-master.json` 时它是唯一实现权威：apply-host 必须读取其中准确 H5 与 QA hash，不得回退到更早的 ABC、聊天摘要或旧 `selectedOptionId`；`design-direction.json.previewArtifact` 与 Master hash 不一致时直接阻断。实施后用 structural diff、真实渲染、computed style 与业务行为证明没有破坏宿主。缺少真实 runtime 证据时最高只能报告 `PARTIAL_STYLE_ONLY` / `conservative-application`。

apply-host 不拥有导航视觉补设计权。Approved Master 必须包含 hash 绑定的 `navigationShellContract`、真实 shell 项和连续性处理；缺失时返回 design-host，禁止为保留真实导航而自行增加未获批的全宽表面。

fast 档也先全扫并实施所有 APPLY 页，再做代表性 Smoke QA；它不等于全宿主认证。用户 `approve` 且 hash 未变化时可复用结果；`revise` 重新实施，`standard` 或 `certify` 追加更深 QA。

`previewQA` 必须使用阶段专属的 `host-preview-smoke/v1` 契约，检查冻结实施范围、真实运行、已选方向保持和代表性返回路径；不继承完整认证的三证明、全页数值评分或重新品牌学习要求。限制须明确报告，关键证据缺失和已知范围内回归仍阻断。预览通过只到 `awaiting-user`，不能自动算用户批准或完整认证。修正已失败的预览契约时通过有界公共续跑保留旧记录、冻结输入和实施成果，再派发新的独立 QA，不重开 ABC、不重捕原始基线。

## 共同硬边界

- 来源截图可用于 Evidence/QA 与 ImageGen 参考输入，不能复制进 runtime 冒充实现资产。
- `generated-proposal` 不能定义品牌身份；只有 `evidence-source` 和明确批准的 `derived-approved` 可进入正式方向。
- 品牌素材像素颜色不能自动提升为按钮、状态、文本或导航语义色。
- Producer 自检不能替代独立 QA；实现者不能担任自己的 QA，包括局部回归复验。
- 用户指出视觉不符时，定位最早责任节点并只重做受影响范围；关闭问题必须有实际新截图/操作证据与按 review mode 完成的独立复核，不沿用旧 PASS。
- 宿主源码修改前后必须有不可变 baseline 和结构差异验证；未批准的业务逻辑、路由、API、状态、事件与组件 API 改动一律阻断。
- 对外视觉验收按目标介质交付：完整效果图直接展示三张原图并标注图像预览；H5/实施验收给可直接打开的前后对比，标明相同任务、视口、内容、改动、来源和批准边界，并用 `validate-visual-acceptance.mjs` 校验。不能为展示图片擅自转成宿主 H5。

## 按需资料

显式本地 `--mod-file` 可携带可选 `componentKits`：每项声明 `id`、`entry`、`stylesheet`、`files[{path,sha256}]`，并说明框架依赖、用法和适用范围。可选 `designGuide` 指向同一 files 清单内的 Markdown，解释来源组合、代码使用及适配边界；不强制文件名，也不替代品牌证据或批准。文件路径相对品牌包所在项目根目录；入口在隔离安装时校验并复制声明文件，不执行代码、不覆盖不同内容。组件必须包含所需相对导入与素材，缺件或 hash 不符先修包；组件更新时同步清单。正式 H5 生产与独立 QA 派发均携带这些文件的准确路径/hash及原有状态，消费者判断兼容性后复用或明确适配。此能力不代表 Registry 分发、实际组件调用、品牌认证或宿主实施已通过；既有来源证据门禁保持不变。

- Token、组件、资产与 style-only 映射：[mapping rules](references/mapping-rules.md)
- DTCG 结构：[migration asset standard](references/brand-dtcg-migration-asset-standard.md)
- 输出字段：[output template](references/output-template.md)
- 原子验收：[atomic acceptance rubric](references/atomic-acceptance-rubric.md)
- 产物隔离与清理：[artifact lifecycle](references/artifact-lifecycle.md)

大型 JSON 由 validator 或查询脚本读取。只有 dispatch 无法回答当前决策时，才用 `query-brand-context.mjs get/search` 定点读取对应 key。

快速 `design-host` 的预算用于阻止无效工作，不用于降低正确性：入口直接生成并校验 baseline/brief，不编译或启动宿主；没有可信渲染回执时把不可测对象标为 `unresolved`，继续使用真实宿主 schema/loading state。H5 生产者直接使用 dispatch 给出的完成输入，不读取 validator/test 源码反推格式。新派发的阶段目标只作效率预警，record 自动记录耗时与 `budgetResult`，不要求角色手写超时结论；完整质量结果与耗时分别报告。总运行 deadline 仍停止失控执行，未完成检查不能算通过。旧派发中已冻结的有限阶段硬上限仍执行，不改写历史。时间压力只能削减可选润色，不能削减真实宿主数据、三方向、品牌设计系统绑定、知识库理由或独立 QA。未通过 QA 的局部文件不得交给用户验收。

## 完成与同步

运行相称的 validator/test。维护源是 `skills/brand/`；改后执行 `npm run sync:skills -- --repo-only`，需更新本机副本时才运行完整同步。最终优先报告预览地址、方向、入口验证与业务保留状态；内部审计仅在追问或阻塞时展开。初始化时提供 [DangoUI Variant 库](https://jocelyntong.github.io/DangoUI-Brand-Skill/#/variants)；Variant 预览不是宿主验收。
