# 对话意图与首轮预览协议

## 冻结当前轮意图

只使用当前会话、当前轮用户明确给出的目标与品牌参考。历史会话、旧 migration、示例、Variant 库和仓库中碰巧存在的品牌目录不能补全本轮输入。

- “先看看能换成什么样”“首屏 3 个 Demo”“先确认风格”固定为 `host-concepts → design-host`。
- 只有用户明确要求建立、更新或重新认证可复用品牌包，才把独立交付目标设为 `brand-learning → learn-brand`；宿主预览内部需要品牌学习时，按下面的接力保留 `host-concepts` 父目标。
- 只有用户已确认 H5 并要求修改真实宿主，才使用 `host-implementation → apply-host`。

用户已认可准确组件且只要求实施该模块时，同属 `host-implementation → apply-host`，使用 [限域组件交接](../references/approved-component-handoff.md)；不把模块批准提升为整页批准，不要求重做三方向。平台不兼容时明确需要适配，不能用 Vue 框架相同推断运行环境相同。

尚未认可准确组件、但已明确授权沿用现有品牌与宿主开展单模块隔离选材/适配试验时，使用 `host-concepts → design-host --module-task <任务>`，输入品牌包根、宿主与准确模块路径，执行 Agent 从返回索引选 recipe，入口自动准备隔离副本和 hash-bound 交接（详见同一参考的“普通输入自动准备”）。不让普通用户填写内部 manifest；已有准确 manifest 可兼容 `--component-task`。品牌候选不得伪装成 approved kit；不扩建 Demo、不重跑无关整页方案，也不重判来源学习认证。

缺少品牌官网、截图、设计文件或已学习 style pack 时，只问这一项并停止。`design-host` 不得把用户目标降级为只交付品牌学习结果，也不得旁路学习验收；官网已提供时允许下面的内部学习接力。原始 `run` 必须显式传 `--request-kind`；入口会在 Registry 查询和写文件前核对它与 mode。

官网已提供但尚无品牌包，不属于缺用户输入。`design-host run` 返回 `prerequisite-dispatch-ready` 与 `source-prerequisite.json`；编排者自动执行其中同一公共入口的 learning.args，完成现有学习角色与独立 QA 后，用其有效 MOD 恢复原 host-concepts。父目标、宿主、隔离目录不变；这不是改成只交品牌 Demo，也不能把 dispatch 当学习成功。`--source-prerequisite` 仅让该学习阶段继续独立学习当前来源，不静默采用 Registry 候选。失败保留接力记录与具体缺口，不要求用户找内部文件，不自动无限重试。缺口涉及真实用户选择时才询问。

官网命中 Registry 时默认只返回候选，不安装也不进入生图。只有用户明确同意复用并传 `--reuse-style-pack`，或者当前轮直接提供本地 `--style-pack` / `--mod-file`，才消费已有包；否则先独立执行 `brand-learning → learn-brand`。Registry 包中的学习证据留在隔离工作区，只有 Brand MOD 声明且 hash 完整的 runtime assets 能作为设计输入，不能整包写入宿主。

品牌库链接识别兼容 `#/variants/<id>/...` 和 `#/brand/<id>/...`，仅接受配置的品牌库域名与站点路径。将其解析为品牌包选择，不把展示站当来源官网重新学习；包缺失或不可用时报告故障，不以抓取展示站替代。

## 隔离首轮试验

## 内部判断与用户验收分离

用户明确指出历史准确版本作为视觉对照时，先用公共 `recover-reference --artifact-root <当前隔离目录> --brand <当前brand> --source-root <历史目录> --source-master <原master相对路径> --source-master-sha256 <原SHA256> --reason <当前确认依据> --confirm-reference-only` 恢复。它保存原 H5、运行资产及原批准范围，在 `prior-direction-index.json.recoveredReferences` 追加 hash-bound 输入，不修改旧 FAIL、Goal 或源码。下一次设计前必须核对这些输入，不能只检查当前 run 的失败 ABC。

`reference-only` 只授权比较及找退化点，不能当作新的 Approved Master、品牌资产 grant 或宿主实施许可；原有 `trial-implementation-only` / `aestheticApproval:pending` 不得丢失。历史记录与远程封面不是本轮 fresh API 数据。恢复后优先验证受影响的局部状态，不因此重开无关 ABC。正式晋级仍需准确用户选择与当前独立 QA。

用户明确认可一个准确 H5 并授权本地宿主实施时，可通过公共 `freeze-selected-h5 --artifact-root <原隔离build> --brand <brand> --artifact <相对H5路径> --artifact-sha256 <SHA256> --approval <相对用户确认JSON> --approval-sha256 <SHA256> --qa <相对独立实施输入QA> --qa-sha256 <SHA256> --host-target <原绝对宿主>` 冻结独立实施交接，不因历史 ABC 失败重开无关探索。用户确认须绑定准确 H5 与宿主；`selected-h5-implementation-input-qa/v1` 必须由不同生产者与审核者完成，声明 `local-host-implementation-only`，绑定 H5、确认、品牌三证、导航 baseline、宿主源码/路由配置/样式、生成素材和全部必要本地依赖。品牌证据/intent 引用的截图也须明确列入审核 inputs；动态业务封面/头像须列入 `runtimeDependencies`，仅允许指定 host-input raster 目录和 `host-business-content` role。未审核依赖不能由冻结器自动补齐。

入口一次写入 `selected-h5-handoffs/<binding-id>/build`，返回现有 `host-implementation → apply-host` 参数（含复制 MOD 的绝对 `--mod-file`）。准确选择的 local Master 与独立 review 仅用于此实施输入门禁，不更改旧 Goal、探索 route、FAIL、receipt、preview-readiness 或学习认证。来源学习/完整 ABC 成功和公开分发仍未获授权；全宿主 disposition、pre-edit baseline、组件运行门禁及修改后的真实 native runtime QA 均不可由该输入 QA 替代。review 的 apply/keep 文本只是约束，实施路径以独立绑定的 host.route/source 为准。

`handoff-frozen` 的 `dispatchReady:false` 不能当作实施开始或流程 PASS。先执行返回的 public run 完成真实 TPP/action evidence 输入检查；缺件按准确报告交给责任角色，不能写空证据或关闭 gate。其后编排者按标准流程独立封存新 apply-host Goal（不复制旧 design-host Goal），通过现有 `brand-subagent-workflow.mjs prepare --brand <brand> --root <新build>` 与 `next` 派发 Host Strategist。新运行须保留原宿主与 local-only 范围；Host Strategy 尚未完成时不得开始 Host Implementation，也不得将输入 review 称为 native 验收。

已正式记录 `fail` / `needs-evidence` 的 blocked apply-host Host Strategy，仅在明确继续现有任务时由编排者执行公共 `retry-host-strategy --artifact-root <当前隔离build> --brand <brand> --continue-existing --reason <责任节点与准确纠正原因>`。最多两次策略尝试（不超过原 Goal maxAttempts），旧 stage、receipt、outputs 按原 hash 存档不改写；新真实 dispatch 继续只读诊断，不授权编辑或新品牌规则。`host-productive-baseline.json.targetPageId` 必须是准确的 `host-page-inventory.json.pages[].id`，每个 page 判断覆盖一次。结构冻结器实际消费 `targets[].route/sourceFile/baselineFile`，不会消费额外 `file` 字段；sourceFile 与 baselineFile 用绝对路径，前者指向原宿主 Vue、后者指向隔离新 baseline，不能将宿主相对 sourceFile 错当 build 相对路径。原记录若误归因保留原字节，新 dispatch reason 明确纠正即可。

已 hash-bound 原始 source/style 快照的 local-only apply-host 实施阶段失败后，可明确执行 `retry-host-implementation --artifact-root <当前隔离build> --brand <brand> --continue-existing --reason <仍属原任务的纠正范围>`，最多两次且不超过原 Goal maxAttempts。入口使用准确旧失败 stage 的显式 post-edit 上下文验证 Master/QA/原始快照、未变 appConfig 和当前真实结构 AST；不假造 currentStage、不重捕 baseline。旧 stage/dispatch/receipt/outputs 全部原字节归档；当前合法样式的续接检查点仅用于下一次 dispatch 前确认状态未漂移，不替代原始输入或构成新的批准。新 dispatch 继续 pin 同一原始快照/bundle，native runtime 与独立 QA 未完成仍不得 PASS。

apply-host 的 `previewQA` 只使用 `host-preview-smoke/v1` 检查准确实施、实际运行、受保护业务、受影响导航/素材/状态及明确限制；不继承后续完整认证或来源学习的验收清单。预览 `needs-evidence` 后，明确继续同一任务时才执行公共 `retry-host-preview-qa --artifact-root <当前隔离build> --brand <brand> --continue-existing --reason <准确纠正原因>`。最多两次且不超过原 Goal maxAttempts；归档旧失败字节、保持同一 Master/Goal/实施输出，使用准确已完成实施阶段的只读 post-edit 上下文，不重捕 baseline 或假造 currentStage。新审核者与实施者及旧审核者不同，报告用版本化路径，必须绑定当前活源/构建 hash 和新实际观察；未观察行为写限制，不能由编排者补造 PASS。

普通用户不操作角色状态机、QA 条件或生图门禁。外层编排必须将内部学习接力推进回原 `host-concepts`，学习页面只能作为调试证据，不能作为用户交付。默认展示独立 QA 推荐的一个宿主 H5，并提供可选备选；不要求用户先回答专业评审问卷。用户说不满意时将日常语言反馈定位到责任节点；未通过内部 QA 的页面不得交给用户找错。

角色分工并非每个检查都新增 subagent：事实提取与 hash/结构检查交给脚本，设计交给生产角色，视觉与业务验收交给另一个执行者。独立任务按需并行，上下游依据未通过时不提前执行下游。任何内部节点 PASS 都不等于最终目标完成。

学习前置、宿主预览和真实宿主实施分别保留不可变 Goal/receipt。续接宿主使用子隔离目录，不能覆盖学习 manifest，也不能丢失父宿主路径、品牌来源、profile 和原始参数。只有完整学习 QA 与有效 MOD/资产后才能续接；用户认可准确 H5 后才进入 apply-host。

用户明确要求先测试大步骤、稍后处理来源几何细节时，可申请 `macro-host-journey` 隔离预览范围。它必须由不同于所有生产者的执行者先独立审核来源品牌、MOD、tokens、runtime assets、宿主迁移与范围排除，保存一次写入的 `migrations/<brand>/preview-readiness.json`（`brand-preview-readiness/v1`）。回执绑定父 handoff、学习 manifest、全部品牌输入与声明素材 hash，并逐项声明可用 MOD id、未解决缺口和禁止用途。公共入口仅以 `continue --artifact-root <父buildDirectory> --continuation-scope macro-host-journey --preview-readiness-sha256 <回执SHA256>` 续接到独立 `host-preview-macro/build`；无显式范围与有效独立回执仍执行完整学习门禁。此范围的 `learningComplete:false`、原来源 FAIL、Goal、manifest 与 QA 都保持原样，不能称学习认证通过，也不授权修改宿主。三组真实宿主 H5、独立宿主 QA、Expressive 缺口判断和用户选择仍按原流程执行。

### 隔离目录初始化

URL 前置返回后，由编排者执行 `run-brand-workflow.mjs continue --artifact-root <父buildDirectory>` 并按返回的真实 dispatch 派发角色。学习完成后同一命令验证三证、角色独立性、MOD 和素材 hash，保留父记录，在 `host-preview/build` 创建子运行并恢复原请求。每次准备向用户展示时执行 `run-brand-workflow.mjs delivery --artifact-root <当前宿主buildDirectory> --brand <brand>`。design-host 只有 `userGoalCompleted:true` 可报告概念预览交付；apply-host 的 `ready-for-user-review` / `previewReady:true` 仅表示准确真实宿主可提交用户验收，必须保留 `userGoalCompleted:false`、`fullWorkflowPass:false`、来源学习/全宿主未认证和行为限制，不宣称整个 skill 完成。`pending` / `blocked` / `resume-ready` / `host-resumed` 都不是用户结果完成。

先执行：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs artifacts init --host <绝对宿主路径>
```

把返回的 `buildDirectory` 作为 `--artifact-root`，并传绝对 `--host-target`。概念图、migration、临时 Registry、skill link 与预览都写入隔离目录；宿主在用户批准 H5 前保持只读。

## 首轮时效协议

从 workflow `prepare` 到三组可交互隔离 H5 通过一次紧凑独立 QA，以 5 分钟为首次可判断结果目标和进度检查点，不再把它作为砍掉专业角色的硬截止。fast 流程保留 20 分钟安全上限，防止工具或角色无限挂起。

- 每个 dispatch 携带 `previewTargetAt`、绝对安全 `deadlineAt`、剩余毫秒和停止动作。
- 外层编排最多每 60 秒检查一次状态；超过 5 分钟时报告最慢节点和已有产物，但继续等待当前必需角色。
- `design-host/fast` 的启动页事实由 prepare 阶段确定性提取并校验，不为源码中可机械推导的事实启动 Host Strategist；standard/certification 与批准后的全项目扫描仍由真实 Host Strategist subagent 完成。Brand Application Designer 与独立 Visual QA 必须由不同真实 subagent 完成；主任务只负责路由、冻结输入、状态记录和汇总。
- fast prepare 后只派发一次 H5 Direction Producer：同一个设计师回合写 `brand-render-kit.json` 并生成三组真正不同但保持宿主信息分发模型的可交互隔离 H5，不再为 brief 单独启动和回收一次 subagent。H5 必须先使用真实宿主数据、品牌设计系统与知识库决策；ImageGen 此时保持未调用。
- 到 20 分钟安全上限才立即中断当前角色并报告已有产物与缺口；不启动无界自动返工。
- fast run 的真实文本 token 软目标为 40k–60k，硬上限为 80k；仅在运行时返回真实 token usage 时执行该上限。无法取得时记录 `unavailable`，以 unique/duplicate/additional-read bytes 诊断，不能换算后冒充真实 token。
- 重复输入字节占比超过 20% 时，下一次昂贵工具调用前必须先收窄 dispatch；不得通过删除宿主事实、品牌证据或独立 QA 来达成预算。
- 安全上限后只有用户明确要求继续时，才可为仍处于 dispatched 的同一阶段开启新的有界窗口；它保留 dispatch、输入 hash 和既有产物，不得借此改写 verdict 或跳过 receipt/QA。
- 已记录 FAIL 的 H5 生产阶段只有在用户明确要求继续该预览后，才通过公共入口 `retry-h5 --artifact-root <当前宿主buildDirectory> --brand <brand> --continue-existing` 开启一次新尝试与新的 20 分钟窗口。入口先验证隔离目录与原范围授权，再将旧 stage、receipt、dispatch 和所有已提交 output 的字节保存到 hash-bound `attempts/<旧stageId>/`；旧 verdict 和 outputHashes 不改写，后续命令逐项验证归档。新 dispatch 仍绑定原 Goal 与 preview-readiness，不扩大品牌语义用途，也不跳过生产者渲染或独立 H5 QA。
- 用户明确要求在原 macro 试验中接入新增独立来源审核时，retry 可额外传 `--transfer-review <绝对审核JSON> --transfer-review-sha256 <SHA256>`。审核须为 `source-system-transfer/v1`，候选规则与排除项、来源 packet/观察/截图 hash、独立审核者均有效；入口复制到当前 attempt 的一次写入目录，不修改原 MOD、Goal、readiness 或失败记录。只允许当前隔离试验采用明确 permitted 的候选规则，不能提升为 reusable Pattern、全局 token、学习认证或宿主实施许可。每案 H5 metadata 的 `transferRuleApplications` 必须绑定准确 ruleId、ruleScope、region、存在的 selector、review hash、evidenceRefs 和 hostReason；仅参考规则声明 `usage:reference-only`，条件素材规则还须使用原 grant 允许的独立 hash 资产。Finalizer 校验并写入每案输出；独立 H5 QA 继续按真实渲染核对范围、实际应用和全部排除项。
- 用户第一次看到 H5 前只允许一次紧凑独立 H5 QA。QA 同时给出 Expressive 缺口决策：没有具体缺口就直接交付；有缺口时必须冻结方向、区域、业务目的、目标尺寸、现有不足、预期提升和无图回退，才允许局部 ImageGen。
- 局部资产按缺口并发，首轮每个缺口最多一次调用、自动重试为 0；失败保留已通过的无图 H5，不改词绕过或无限返工。回填后由不同执行者做一次 integration QA。
- 用户认为三案都不值得继续时，用 `reject-concepts --reason <原因>` 记录为有效的 `rejected-all` 结果并终止，不自动返工。
- 三组 H5 交付后停止等待。用户确认 H5 前不做全项目扫描或宿主实施。
