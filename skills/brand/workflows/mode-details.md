# 按模式加载的执行细则

仅用于当前模式；选图单页的直接入口见 ../SKILL.md。以下规则由原入口迁移，命令仍以 skill 根目录解析。

## 安装后与首次使用初始化

三图结果交付时，按 [request intake 的结果引导](../workflows/request-intake.md#三图结果后的用户引导) 给用户简短的选图或换批语句；不要只丢预览链接。用户明确要求“再来三个”时走 `regenerate-image-concepts` 新隔离批次，不用 `continue` 重画旧图，不自动转代码。

首次安装、更新或用户问“怎么用”时，复用本会话信息并执行：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs init --host <宿主目录>
```

该命令只读检查宿主并返回缺失信息；不联网、不启动、不修改宿主。已由当前项目或用户确认的宿主传 `--host-confirmed`，明确页面才传 `--page`。品牌已选而未指定页面时，默认读取宿主首页，说明范围后进入三张完整效果图生成，不再把页面或任务当必填问题。用户指定页面优先；路由确实无法判断才询问。当前明确的仅检查/暂停指令仍优先，init 本身不代表生图授权。

初始化时给出最短用法：在宿主会话用 `$brand <官网或具体品牌库页面链接>` 先生成三张完整效果图；已有本轮图片时，用 `$brand 我选本轮 A，请做成隔离的可操作页面` 进入下文选图落地，不重开三图。提供公共 Variant 库链接。安装或更新核对时，报告本次实际加载目录及可读取的包完整性标识；没有版本依据就明确未知，不把维护仓库版本冒充安装版本。公开版统一用 `$brand`，不要求用户记候选别名或运行目录；升级不授权自动修改原项目。

完整效果图失败时保留图片目标，不默认推荐 H5；按 [失败引导](../workflows/request-intake.md#完整效果图生成失败时) 报告已有结果与真实阻碍。H5 修复不能代替未完成的三张图片交付。

## 选择模式

- `learn-brand`：学习品牌并产出 Evidence、Intent、Brand MOD、DangoUI mapping 与品牌学习 Demo；默认不改宿主。
- `design-host`：读取已学习品牌和真实宿主，默认 `--concept-medium full-image`，用官网设计语言、实际截图及素材生成三张完整 ImageGen 界面效果图。整图统一设计 Expressive 与 Productive 的视觉关系，不先画背景再拼面板；此时不生成 H5、不声称组件已调用。只有用户明确要求交互 H5 时用 `--concept-medium interactive-h5`，再以官网设计系统实现 Productive；不得修改宿主源码。
- `apply-host`：实施 design-host 已冻结的唯一方向，或用户明确认可的单模块组件；保护业务内容、数据、路由、交互和组件 API。单模块采用下述限域交接；整页设计输入无效时退回 design-host，品牌证据缺失时退回 learn-brand。

用户明确要求从已有资产检验一个尚未批准的模块时，优先使用 [限域组件任务](../references/approved-component-handoff.md#普通输入自动准备) 的 `--module-task`：只给现有品牌包、宿主、任务与目标路径，入口列出原包候选，由执行 Agent 选择后自动准备隔离副本与交接输入，普通用户不填写 manifest 或 recipe ID。已有准确 manifest 才用 `--component-task`。先选材、判断兼容性，再在独立宿主副本中试装；不要求预制目标平台组件，不转为整页三方案。试装授权不是设计批准，原宿主只读，独立运行 QA 后再交用户判断。

除上述明确选图单页路径外，运行前读取 [request intake](../workflows/request-intake.md)，只按当前轮用户意图冻结 `request-kind`。首屏三方案固定走 `host-concepts → design-host`；缺品牌参考就问，不猜历史品牌，也不降级到 `learn-brand`。同一入口承载 Expressive 探索和 Productive 实现，不另建绕过交付检查的试验路线。原始 `run` 必须显式传 `--request-kind`，入口会在联网和写文件前拒绝错路由。

唯一对外入口是 `run-brand-workflow.mjs`；`brand-subagent-workflow.mjs` 仅推进内部状态机，其他脚本不得拼成替代路线：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs run --request-kind <brand-learning|host-concepts|host-implementation> --mode <learn-brand|design-host|apply-host> ...
node <skill目录>/scripts/brand-subagent-workflow.mjs <prepare|next> --brand <brand> --root <隔离运行目录>
```

角色只使用 `next` 的 dispatch packet、hashed inputs 和当前岗位 reference；不得通读 contract、所有角色文档或大型 DangoUI 数据。

## learn-brand

职责链：`Evidence → Interpreter → Demo → independent Visual QA`。首次使用 fresh `initial-blind`；局部修复优先由原独立 QA 做 `regression-review`，实质改向、QA 参与制作或明显漏检才要求 `fresh-blind`。具体身份、证据与范围契约见 [QA review modes](../roles/blind-qa-tpp.md#复核模式)。Dembrandt 是 Evidence 的候选发现工具，不是独立角色或事实来源。完整规则读 [learn-brand workflow](../workflows/learn-brand.md)，当前角色再读取 dispatch 指定的岗位契约。

review-mode 的 prepare/next/record 工程接入目前仅限 learn-brand，入口与最小命令见 [learn-brand QA 准备](../workflows/learn-brand.md#qa-复核包准备)。design-host/apply-host 仍用各阶段现有独立 review 入口；通用复核政策不代表这些阶段已接入原 QA 复验，禁止用 learn-brand helper 强行调用。

来源 URL 的 HTTP/HTML/CSS 抽取只用于候选发现，不能独立成为视觉 Evidence。唯一总入口必须自动执行浏览器原生观察，不要求用户额外传 `--force-browser`。对带非循环开场媒体、图片主导或固定视口 Swiper/Fullpage 的官网，分别保存 opening peak 与 settled page frames，按控制器 active 状态而不是 `scrollHeight` 判断覆盖；开场未结束、控制器未触发或正式内容未出现时返回 `NEEDS_EVIDENCE`，不得交给 Interpreter。

Evidence 还必须盘点页面实际渲染的官方身份素材，不能只收首页 Hero、Logo 和卡牌而漏掉其他区块的透明角色、产品 cutout 或组合资产。为每项记录原始尺寸、透明通道、适用场景和可安全展示的最大尺寸；Brand MOD 必须保留设计阶段可能需要的合格身份资产，不能因 Demo 当时未使用而静默丢弃。

正式知识维护在 `knowledge/v0.1/`。先用 `query-design-knowledge.mjs stage learn-brand` 找问题，再定点查询 `question`、`basis`、`policy`、`method`、`decision` 或 `case`。历史知识不替代本轮证据，候选结论不等于已批准资产。

设计经验只有在结构化记录、原始证据、`public/knowledge/guide.html` 和角色查询入口同时更新后才算落库。修改 `knowledge/v0.1/` 后必须运行 `npm run publish:knowledge`；只写 JSON/Markdown、只通过 validator 或只同步 Skill 都不能报告“已落库”。需要用户验收时交付生成后的 H5，不以源文件代替产品界面。

Demo 是品牌学习能力测试，Evidence Fidelity、Structural Fidelity、Generative Proof 必须分别通过；三者不可互相补偿。高显著度区块运行 `validate-section-fidelity.mjs --strict`。QA 失败只返工 `affectedSections` 并做小范围回归。

需要用户参与调试或签审时，按 [learn-brand workflow](../workflows/learn-brand.md) 逐节点提供可打开的静态 H5。不要要求用户从原始 JSON 推断视觉结果，也不要把候选试装画成已批准换肤。

## design-host

### 默认首轮：完整效果图

外层完成本轮意图和隔离输入准备后，通过公共 `handoff-image-batch --artifact-root <运行目录> --brand <品牌>` 交出整轮执行责任，实际调用其 `launch` 启动一个不继承历史的短上下文执行者。不是只派生图者：它负责生产、独立 QA 接力和交付。外层不再逐阶段派发、轮询状态或重复读取输入，只消费最终完成消息。运行时无空闲完成通知能力时如实说明，保留标准比较页，不承诺自动通知、不持续轮询兜底。此路径不用于修改已选图落地授权；仅复核旧三图时加 `--verify-existing`，禁止生图且不改旧回执。执行者具体动作见返回的 executorReference。

新的完整图运行先执行入口返回的 `preparationRequest`：由执行者观察宿主并准备共同底稿，用 `record-image-preparation` 绑定真实截图、必要源码及本地完整底稿；`--prompt-brief` 另存仅含可投递业务与视觉摘要的文本。记录命令自动返回设计派发，独立 QA 复用同一绑定输入；无法观察时记录实际原因，旧运行保持兼容。

每张图片完成 checkpoint 后立即打开公共 `delivery.comparisonPreview` 标准比较页，明确本轮数量和未审核状态，不等三图齐全才展示。blocked 方向如实显示，不隐藏成功图；三图齐全再派发独立 QA。用户说“继续生成”即新一轮三个全新方案，走 `regenerate-image-concepts`，不要求旧轮三齐，也不是补缺失方向。旧轮原件和成功图保留可选，不计入新轮数量；每轮各方向一次调用，结束后由用户决定再生成、选已有图落地或暂停，不自动无限重试、不自动转 H5。图片选择不抹除失败或待确认项，也不授权整体换肤。标准页复用现有比较入口，不手写展厅。QA 只接收本轮 `reviewRequest` 与必要绑定原件，不传全文历史、全 Skill 或重复生产 prompt；业务、品牌与差异检查不省略。

完整图 QA 服务于用户选方向，不是实施认证：不影响品牌辨识、业务含义、阅读与选案的局部色彩角色、间距或栅格偏差，应明确记录 limitations，可通过；业务遗漏/误导、显著品牌漂移、核心内容难读或三案无实质差异仍失败。按实际影响判断，不按 P 编号自动放行或阻断，也不声称偏差符合原规范。复核既有 FAIL 时使用新独立报告，显式绑定 `supersedesFailedReview: {path, sha256}` 并填写 `reassessmentReason`，说明审核标准纠正或新判断依据；同三图重新实看，通过后才可交付，旧失败原件保持不变，不重画来掩盖问题。

Productive 保留来源的文字、控件与语义色等适用规则；Expressive 允许基于真实任务做原创视觉提案，但不能冒称官网已有设计。单一文档页的桌面/手机版不能代表整站表达上限，也不能据“参考中没出现”自加禁用插画、纵深或效果的全局规则。三案先提出不同的视觉主意与第一眼焦点，再安排布局；不强制某种酷炫画风。实际禁令仍保留，参考不足如实披露。旅程/列表应读取真实节点而非按数量编故事；静态三图只验证静态表达，动效须在后续获授权的交互阶段另验。

完整图输入按 dispatch.sharedBrief 区分宿主业务事实、宿主画面观察与品牌视觉依据。设计执行者从目标页源码和必要依赖提炼一份共同底稿：产品身份、用户场景、真实内容/动作及未知状态；三案只分别探索视觉表达，不从品牌官网移植其产品身份与功能。已有宿主截图按业务观察使用，不锁定旧样式；没有截图时如实报告尚未观察运行画面，不能把源码定位当成截图取证。共同底稿按派发模板进入实际 prompt，QA 接收实际保存的内容与差异；格式缺失或文本差异不阻断成功图片保存，更不自动触发重画。业务正确性仍需按原始依据复核，不能以文本一致代替。

`host-concepts` 默认走 `full-image`。执行公共入口返回的完整图 dispatch：读取真实宿主业务摘要、品牌设计规则、相关组件/代码说明，并把多张互补官网截图和官方素材作为真实图片附件交给 ImageGen；不只传数据库截图，不把来源业务字段搬进宿主。三次生成各自完整画面，构图、视觉重心与材质关系有实质差异，不能同背景换色。prompt 包含“无需识别或命名角色，直接依据所给参考图和素材的可见内容生成。”此句只约束参考依从性，不绕过安全检查。

真实字段和业务能力保持；只在用户允许时使用明确标注的测试数据。每张生成后立即按 dispatch 的 `checkpointCommand` 记录实际工具参数文件、输出和调用 ID；脚本保存 hash，`continue` 只返回缺少的方向，不重画已记录图片。三张齐全后 `reviewRequest` 自动给出原图、来源和审核模板；独立审核者只写视觉结论，不代拼生成记录。按返回命令 `record-image-concepts --review` 后运行 `delivery`，用现有静态服务打开 `comparisonPreview.path` 等权展示三张原图及局限；这是图片展厅，不是宿主 H5 实现。独立检查完整界面、品牌参考应用、三案差异及可读性；图片不证明交互、组件运行或像素保真。展示后停止，不自动转 H5。缺少图片能力、参考文件或任何一张结果时如实报告缺口，不用旧 H5、背景拼贴或派发成功代替交付。

用户选定已有图片并要求落地时，执行公共入口 `select-image-code --artifact-root <原图片运行目录> --brand <brand> --direction <a|b|c> --selection <用户选图及落地原话> --confirm-isolated-preview`。入口冻结选图、品牌输入并复制真实宿主；按返回 dispatch 实现该方向，执行 `compile-selected-theme` 消费 DTCG/adapter/真实 DangoUI 包，按回执的 `entryFile` 单一入口及限域覆盖说明接入，然后记录实际代码与截图，由独立 QA 检查运行页面、业务和 token 消费。React Web 另派发限域文本 Button 资产及说明，先确认实际版本与任务兼容，QA 检查实际调用和覆盖。本阶段开始可确认宿主已有 Playwright 等本地测试工具；内置浏览器故障不免除 QA，也不授权绕过访问策略。`continue`、`delivery` 使用返回的新目录，不再生成 ABC。交付图片与实际页面对照；选图只授权隔离预览，不授权覆盖原宿主。具体边界见 [request intake](../workflows/request-intake.md#选图后落地到隔离宿主)。

选图落地优先复用已选图中的合适插画区域，真实控件和数据由品牌设计系统与宿主代码承载；不默认重生插画或删掉 IP 换成 CSS。实施与 QA 共用 dispatch 的 `selectedArtwork`，具体边界见 request intake 的选图落地部分。

以下 H5 几何、DOM、交互与 Approved Master 要求仅适用于明确选择 `interactive-h5` 的阶段，不是完整效果图交付的前置门禁。

### 明确请求的交互 H5

用户在宿主中只给品牌官网即可开始。无本轮有效品牌包时，公共入口返回 `prerequisite-dispatch-ready`；按 [request intake](../workflows/request-intake.md) 自动完成同一流程的学习前置阶段，再恢复原宿主预览目标。不得向用户索要 MOD 文件、把接力当成功，或丢弃独立学习 QA。

前置阶段通过公共入口 `continue --artifact-root <父隔离目录>` 推进已有 dispatch；只有完整学习门禁通过才物化子隔离工作区并自动恢复原宿主参数。展示前运行 `delivery --artifact-root <宿主隔离目录> --brand <brand>`，其 `userGoalCompleted` 必须为 true；否则继续内部流程或如实报告阻断。正式推荐来自 hash-bound 独立 QA 报告，不能由主任务默认挑第一个方向。新宿主子目录路径以 continue 回执为准，不能继续读取父学习目录充当预览。

职责链：`宿主启动首屏诊断 → 同一设计师完成 Expressive 探索与 Productive 实现 → 三组可交互隔离 H5 → independent visual/interaction QA → explicit user selection`。明确要求 ImageGen 时，生成发生在设计阶段，不等待 QA 批准缺口；未要求时由任务需要决定是否生图。已有 H5 的局部增强仍使用缺口、几何冻结和 integration QA。第一次试风格只读真实启动页，不以全项目扫描拖延；`design-host/fast` 由 prepare 确定性提取首屏事实，standard/certification 或 H5 批准后的全项目判断才派发 Host Strategist。三案使用真实冻结记录或明确 schema/loading 状态；允许业务不变地重组页面和组件，旧页面没有 Hero 不代表新设计不能有表达区。

试验隔离、时效与有界调用见 [request intake](../workflows/request-intake.md)。预算不能省略明确要求的 ImageGen、三方向或独立 QA；生成失败如实报告，不能把无图回退标为已满足 Expressive 要求。

fast run 同时治理文本上下文：运行时能返回真实 token 时，40k–60k 为软目标、80k 为硬停止线；拿不到真实 token 时必须明确写 `unavailable`，只用 unique input bytes、duplicate input bytes、additional read bytes 做诊断代理，禁止把字节估算冒充真实 token。每个 dispatch 只携带本岗位紧凑包；重复输入占比超过 20% 先去重再进入昂贵工具。时间或 token 预算只能裁掉可选探索和重复读取，不能裁掉真实宿主事实、品牌依据、独立 QA 或真实数据约束。

用户只提供宿主与品牌参考。preflight 自动解析启动首屏；fast prepare 用 `derive-host-startup-baseline.mjs` 提取 Productive floor、业务字段、扫描行为和现有展示事实，standard/certification 再由 Host Strategist 补充判断。现有布局是观察，不是新布局禁令；缺少真实对象只限制对象展示，不禁止基于品牌来源的 Expressive 探索。启动页缺失、hash 不符或 baseline 校验失败时禁止进入视觉生成。

fast 确定性诊断或 Host Strategist 必须从启动页源码与可用渲染证据自动冻结 `hostContentContract`：真实业务对象、字段、来源定位、原始尺寸、当前显示尺寸、最低可读尺寸和可用于场景的状态；同时冻结 `resultHierarchyContract`。只有源码、真实数据或交互状态明确证明精选、排行、推荐、选中等不同角色时，重复结果才允许差异化；没有证据时默认 `peer`，Productive 与 Expressive 都不得为了视觉焦点创造一大两小或隐含推荐。设计师只能引用冻结事实，不能自报或猜测；没有合格对象时自动采用 Productive UI，不向用户索要对象清单、尺寸、结果层级或融合方案。

`readiness=ready` 的宿主对象必须绑定启动页源码 hash 和 `host-startup-measurements/v1` 渲染测量回执；无法取得 intrinsic/current size 或回执 hash 时只能写 `unresolved`。确定性诊断或 Host Strategist 完成后都运行 `validate-host-startup-baseline.mjs --file <baseline> --startup-page <startup-page> --root <隔离运行目录>`。concept brief 还必须逐方向声明对 `informationDistributionContract` 的保持关系；validator 会计算计划尺寸比例并拒绝宿主禁用的产品隐喻，不能靠 `preserveAspectRatio: true` 或设计师自述通过。

品牌官网命中 Registry 只表示发现了一个可复用候选，不能静默代替本轮品牌学习。使用者必须明确选择重新学习/更新，或用 `--reuse-style-pack` 接受该已审核包；直接提供本地 `--style-pack` / `--mod-file` 也视为明确选择。复用包安装到隔离工作区时必须带齐 Brand MOD 所声明的 hash-bound runtime assets；任一被本轮 H5 或局部 ImageGen 引用的 `localPath` 悬空或 hash 不符时阻断。没有合格官方身份素材不阻断设计系统 H5，但禁止 ImageGen 伪造身份主体，并在缺口判断中记录只能使用中性局部资产或无图回退。

生图前同时校验身份素材的合成适配性：透明/遮罩能力、原始像素尺寸、计划展示尺寸、预期透视与光照是否能在不改绘身份主体的前提下完成。素材只能靠明显贴片、相框或过度放大才能进入原创环境时，返回 `BRAND_IDENTITY_ASSET_INADEQUATE` 并说明缺少的资产规格；不得先生成通用背景再用 CSS 阴影掩盖割裂。

开始前按需读取 [Host Strategist](../roles/host-strategist.md)、[Brand Application Designer](../roles/brand-application-designer.md)、[Host Brand Composition Grammar](../references/host-brand-composition-grammar.md)、[Visual Program](../references/visual-program.md) 与 [Expressive moments playbook](../references/expressive-moments-playbook.md)。

### 图片能力声明

每次实际生图均按 Designer 岗位的「实际生成输入记录」保存原始工具参数及素材用途；读过品牌文件不等于生成器收到这些内容。用户明确要求单独测试 Hero 等局部时，按指定范围做隔离诊断，不能把局部试验标成完整 design-host 通过，也不能默默丢弃当前已确认的品牌输入。

用户明确要求 ImageGen 探索时，在设计阶段检查当前任务是否暴露内建 `image_gen`；未要求的局部增强可在 QA 定位缺口后检查。不得靠环境变量或猜测。

- 完整效果图阶段有内建 `image_gen` 即直接使用派发包生成，不运行 H5 时代的 `declare-capability` 命令；默认内建模型可生成正式图片候选，不要求或猜测其底层模型名。失败记录的文件位置、JSON 模板与后续命令直接使用派发包 `failureRecording`，不要为记录失败翻查脚本源码。
- 完整效果图阶段没有内建工具时直接说明不可用、保留已有图，不调用能力声明命令、不自动转 H5。外部 CLI/API 不是自动替代品，只有用户明确批准后才能另行使用。

仅在已批准 H5 的局部资产增强阶段，使用该阶段派发的能力声明入口报告 available/unavailable；未声明时，`next` 返回 `IMAGE_GENERATION_CAPABILITY_UNDECLARED` 并保持可重试。明确不可用时保留已经通过 QA 的无图 H5，并把缺口标成未增强，不得编造图片产物。不要手写 capability JSON；这不是完整效果图阶段的前置步骤。

通用公式为 `ImageGen Expressive + 品牌设计系统 Productive + 设计专家决策知识`。明确要求的 Expressive 探索须绑定官网参考、素材和三个不同的构图意图，生成后再组合 H5，不冻结未获批准的旧布局。Productive 的文字、业务数据、表单、搜索和交互由代码承载；数据库等局部模块的风格不能因功能匹配而升级为整站设计语言。生图前冻结适用知识输入，保存实际 prompt、实际参考图和生成结果，具体见 Designer 岗位。只有已批准 H5 的局部增强才冻结 selector、DOM、字体度量和容器几何，并运行 `validate-expressive-geometry-lock.mjs`。两种情形均保留来源身份边界、真实数据、可读性及独立审核；图片不能冒充可交互页面。

三组 H5 从一开始就使用真实宿主内容、视口与冻结品牌包，但不启动或修改宿主 runtime；动态数据没有冻结真实记录时使用明确的 schema/加载状态，不能编造业务数据。ImageGen 资产只是 H5 中可替换的局部视觉层，不能替代 H5、文字、真实对象或交互验收；若回填需要透视对象、遮挡或环境光，读取 [expressive reconstruction](../references/expressive-reconstruction.md) 并只对该局部建立可检查的几何、前景、接触阴影与环境光关系。

启动页诊断还必须自动冻结 `navigationShellContract`。每组 H5 都要逐项呈现真实宿主的品牌切换、主 Tab、账户入口等必需 shell 项，并在 H5 内决定其 `native-preserved | custom-contained | custom-immersive` 处理及场景连续性。缺任一项、未声明连续/明确分区，或需要 apply-host 临场新增全宽遮罩、渐变带、模糊层才能容纳导航时，不得进入用户选择或 Approved Master；应只返工 navigation shell，不重做已经通过的列表和数据区域。

生产者提交前必须逐案在冻结视口渲染，并分别遮住品牌名与 Logo 检查首屏：每一案都要由贯穿构图与真实任务区的来源机制建立品牌辨识度；只有一个小角色、角标或贴片的通用白色工具页直接判为整案失败，不能留给 ImageGen 或独立 QA 补救。生产者与独立 QA 统一通过 Skill 静态服务的 viewport harness，在同源 iframe 内按精确 `390×844 CSS px` 检查；外层浏览器尺寸、缩放和 DPR/物理像素等价不能替代 CSS 视口。多模块宿主页还必须在该 iframe 文档中证明 `scrollHeight > clientHeight`、滚动位置确实变化并能恢复，禁止为塞进一屏而缩放或裁掉真实列表。渲染使用当前环境已有的浏览器自动化能力，不在阶段末尾探测 Chromium、Playwright、Puppeteer 等未声明本地运行时。独立 QA 直接使用内置浏览器，不尝试带请求头策略的外部浏览器；时间预算必须覆盖本地服务启动、三案交互、几何测量与 receipt 记录，dispatch 必须直接给出完整记录命令，不能让角色临场反查 CLI。

来源素材的用途必须机械绑定：真实 DOM 的 `assetRef`、`assetPlacement` 与 `assetSalience` marker 是渲染事实，metadata 应带同值；metadata 漏值但 DOM 只有一个无歧义组合时由 Finalizer 确定性补全，不要求角色重复手抄。Finalizer 对照 Brand MOD 的 `role` 与 `targetScope`；只有身份、Hero 或环境类素材能成为 primary / identity-hero，说明图、研究图、组件示意和反馈动效只能留在其支持性范围。DOM 缺失、多个 marker 冲突或用途不匹配时在独立 QA 前阻断。

机制引用优先使用冻结设计系统的完整 id；角色省略命名空间但存在唯一后缀匹配时，Finalizer 可规范为完整 id（如 `expressiveBudget` → `layoutRules.expressiveBudget`）。出现多个候选或完全不存在时仍按未知引用阻断，不能借规范化发明设计系统能力。

design-host 的三份 H5 固定写入隔离运行目录的 `migrations/<brand>/h5-directions/`，契约写入 `migrations/<brand>/`，receipt 写入其 `receipts/`；`public/`、宿主源码和任意自选输出目录都不是生产路径。调度包必须直接给出这些位置，不能让角色临场决定。

每个阶段按 `design-host-route.json` 顺序门禁。首次没有已批准方向时生成三组 H5；一旦用户在后续迭代中明确认可某个准确 H5，该文件必须立即通过 `promote-approved-h5-master.mjs` 升级为唯一 `approved-master.json`，不得只把经验写入知识库、仍把文件留作普通 trial。已有 Approved Master 时不得重新开启无关 ABC；后续候选必须声明父 Master hash，只有明确告知会替换现有 Master并取得用户批准后才能升级。三组 H5、独立 H5 QA、缺口决策、必要时的局部资产回填与独立 integration QA、用户选择缺一项都不能跳到下一阶段。机器通过只表示可以进入人工审美复核，且必须指出至少一条它愿意推荐给人的方向；这仍不等于用户喜欢。用户认为全部不合格时运行 `reject-concepts --reason <原因>`，保存失败样本并终止，不自动返工。用户确认 H5 前不得全项目扫描或实施宿主。

## apply-host

用户已认可准确组件、仅要求实施一个模块时，使用本入口的 [已认可单模块交接](../references/approved-component-handoff.md)：`run --request-kind host-implementation --mode apply-host --component-handoff <manifest>`。编排者根据真实批准准备输入，交付准确实现与使用约束；先判断运行平台，Web 组件不能因同为 Vue 就直接用于 Taro。此范围不重做整页方案，也不改变整页/来源学习的批准状态；实施者仅接线，独立运行检查后才能报告该模块完成。以下整页职责链适用于未采用此明确单模块范围的任务。

职责链：`宿主全页面扫描 → Host Strategist 逐页判断 → Host Implementation → Smoke QA → awaiting-user`。只有用户确认隔离 H5 后才进入本阶段；此时自动扫描全部路由和页面、形成完整 Productive baseline，再按冻结方向换肤。当前岗位按需读取 [Host Implementation](../roles/host-implementation-agent.md)、[Host Visual QA](../roles/host-visual-qa.md)、[theme load order](../references/host-theme-load-order.md) 与 [Runtime Gate](../references/mapping-rules.md#公开宿主的-dangoui-runtime-gate)。

实施前验证最终方向、pre-edit baseline、`design-host-route.json` 和主题加载顺序。存在 `approved-master.json` 时它是唯一实现权威：apply-host 必须读取其中准确 H5 与 QA hash，不得回退到更早的 ABC、聊天摘要或旧 `selectedOptionId`；`design-direction.json.previewArtifact` 与 Master hash 不一致时直接阻断。实施后用 structural diff、真实渲染、computed style 与业务行为证明没有破坏宿主。缺少真实 runtime 证据时最高只能报告 `PARTIAL_STYLE_ONLY` / `conservative-application`。

apply-host 不拥有导航视觉补设计权。Approved Master 必须包含 hash 绑定的 `navigationShellContract`、真实 shell 项和连续性处理；缺失时返回 design-host，禁止为保留真实导航而自行增加未获批的全宽表面。

fast 档也先全扫并实施所有 APPLY 页，再做代表性 Smoke QA；它不等于全宿主认证。用户 `approve` 且 hash 未变化时可复用结果；`revise` 重新实施，`standard` 或 `certify` 追加更深 QA。

`previewQA` 必须使用阶段专属的 `host-preview-smoke/v1` 契约，检查冻结实施范围、真实运行、已选方向保持和代表性返回路径；不继承完整认证的三证明、全页数值评分或重新品牌学习要求。限制须明确报告，关键证据缺失和已知范围内回归仍阻断。预览通过只到 `awaiting-user`，不能自动算用户批准或完整认证。修正已失败的预览契约时通过有界公共续跑保留旧记录、冻结输入和实施成果，再派发新的独立 QA，不重开 ABC、不重捕原始基线。
