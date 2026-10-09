# Learn-brand Pipeline

Learn-brand 是品牌学习能力的 self-testing pipeline，不是网站镜像项目。它模仿专业研发团队的 shift-left、自测、Presubmit、独立 Review 和回归闭环。

安装后的入口自动复用现有 Skill runtime；缺少 Dembrandt / Playwright 模块时，使用随 Skill 发布的 `runtime/package-lock.json` 在本轮隔离产物的 `output/.brand-runtime/<lock hash>/` 初始化精确依赖。初始化禁用 npm 安装脚本、可选 AI runtime 和浏览器下载，不修改宿主、已安装 Skill 或其完整性清单；Evidence collector 复用同一运行目录。首次初始化需要访问锁文件中的 npm registry，失败返回 `EXTRACTOR_RUNTIME_BOOTSTRAP_FAILED` 并保留错误详情，可由相同公共入口续跑。模块可加载仅证明工具可运行，真实浏览器观察与学习门禁仍须单独通过。

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

当调试需要用户参与判断时，每个节点还必须交可直接打开的静态 H5 可视化结果，而不是只给 JSON、计数或 PASS/BLOCKED：Evidence 展示可见来源样本与缺口；Interpreter 展示同职责比较、候选/驳回与适用范围；DangoUI mapping 展示实际 token 值及未映射空位；Demo/宿主展示同任务同内容的前后运行态；QA 展示独立验收和阻断点。每步标明「看见了什么 → 作了什么判断 → 下游能否接收」，附来源记录；缺少获批输出时可视化呈现空位或安全回退，不得补造成功画面。候选试装和正式获批版本必须在视觉上明确区分。

## 四级质量体系

1. **L1 节点自检**：Producer 在交付前检查自己的产物。
2. **L2 Consumer Contract**：下游拥有拒收不完整输入的权利。
3. **L3 Pipeline Integration**：追踪 `Screenshot → Claim → Pattern → Demo selector/state` 是否失真。
4. **L4 Independent QA**：首次 fresh 盲审从真实页面验收三证，不接收实现理由或旧 verdict；后续按 [复核模式](../roles/blind-qa-tpp.md#复核模式) 做独立回归或 fresh 盲审。

## Shift-left 原则

- 可见事实在 Evidence 节点失败，不允许带到 Interpreter。
- 语义范围在 Interpreter 节点失败，不允许交给 Demo。
- 顶层 Design Director 必须在派发 Demo 前批准第一眼焦点、视觉优先级、元素级响应策略与 proof surface。`responsive: true`、整页统一缩放或实现者临场选择适配方式均不构成批准。
- Demo 在交给 QA 前必须完成真实浏览器自测。
- Evidence、Interpreter 与 Design Direction 尚未通过时，产物只能留在 migration workspace；不得写入公开 preview registry，也不得在参考站伪装成已学会的品牌。注册展示是 Demo Gate 之后的发布动作，不是 Evidence collector 的副作用。
- Evidence PASS 的交接必须运行 `validate-learn-brand-handoff.mjs --stage evidence`，逐维交代来源 Claim 数量与未解决项；Interpreter PASS 必须运行同脚本的 `--stage interpreter`，逐维写映射目标、来源引用和优先级理由。默认核对 color、typography、radius、spacing、shadow、action-color；冻结 Goal 可用 `evidencePolicy.requiredVisualDimensions` 明确调整。历史收据不因新脚本自动改写，但不得再拿旧 PASS 宣称当前链路闭环。
- 若 Interpreter 把 `color` 或 `action-color` token 宣称为全局，`crossPageReview` 必须引用 `primary-color-and-cta` 策略，分别标明品牌身份色与主行动色的关系，并记录跨页同职责按钮的默认、悬停、焦点状态。首页活动按钮、数据库搜索按钮不可仅因都叫 CTA 就视为同职责；证据不足时保留宿主原有语义 token，交接为 BLOCKED，不猜一个全局色值。
- 对品牌 primary 的争议，Evidence 必须交逐页可见控件/状态频次及排除项；Interpreter 再按身份来源、同职责复现、视觉显著度、任务相关性和频次排序。只阻断橘色却露出 DangoUI 默认紫色并不能算品牌学习 Demo；可提出证据明确标注的局部候选 H5 与默认态并排供人验收，但未经状态/QA 不得晋级全局或正式宿主。
- 数量决定取证和复核顺序，不自动产生语义 token。交接优先看 Goal 关联与可见显著度，再看 observed Claim 数量；高频素材色不可覆盖低频但任务关键的动作状态。缺一维或只映射四个颜色都不得以完整通过交接。
- 多个 core 来源页面存在时，拟交付为 token 的映射必须按知识库 `cross-page-token-promotion` 记录逐页同角色比对；全局 token 遇到未观察页面或未解决冲突即阻断。Evidence 与 Interpreter 只按需读取方法和相关判例，具体品牌值不得写进方法或角色 JD。
- QA 发现问题时必须路由到 `earliestFailureNode`，不能默认只修最终页面。
- 面向用户的验收必须附同一任务的前后可视化 H5；局部 token 决策修正也要并排展示旧应用效果和改后运行态，并把官网观察、未批准试验与真实 DangoUI/宿主状态分别标清。阻断不等于可以只给错误码；若尚无可批准的改后品牌画面，展示安全回退并明确“非换肤通过”。
- 高显著度页面必须先拆成 section micro-gates；条目数量、DOM 数量和 build pass 都不能代替区块结构与交互验收。
- 重试默认复用已哈希的 URL、视口、截图、资产和交互轨迹，只重抓失败区块与必要回归。
- `brand=dango` 只表示 DangoUI 是当前被学习的品牌，不代表进入 DangoUI 宿主换肤。只提供 `source-url` 时必须保持 `learn-brand`；没有显式 `host-target`，不得创建 Host Adapter 页面、修改宿主组件或把其他品牌迁移到 DangoUI。

## Design Director 设计方向门

顶层 Design Director 对“具体怎么设计”和如何组织团队负责，不替代 Interpreter 的品牌语义，也不替代 QA 的独立验收。派发 Implementation 前必须通过：

```bash
node skills/brand/scripts/validate-design-direction.mjs --brand <brand>
```

正式学习 Demo 派发还会加 `--require-learning-proof`：`design-direction.json.generativePlan` 必须有 `status: approved`、具名 `reviewer`、最窄 `scope`、`variationKind: structure`、`variedStructure`、`proofArtifactPlan`、`invariantPatternIds`，以及逐项引用当前获批 Pattern 的 `allowedTransformationRefs: [{ patternId, transformation }]`。变化引用必须属于这些 Pattern 的 `allowedTransformations`；有计划不等于生成效果通过，仍由 fresh QA 验证。只有来源校准、组件状态检查或文案/资产替换时在 Director 层停止正式派发，允许交付明确标注的局部诊断，但不消耗正式 Demo 重试来重复发现已知缺口。不得为过门禁而临场扩大 Pattern 的用途。

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

### 浏览器原生来源观察

新原生输入可在 `visualAuthority: "viewport-sequence/v1"` 下附带 `interactionEvidence: {schema:"interaction-evidence/v1", scopeReason:"本次任务需要什么", required:[{id:"准确交互ID", proof:"states", reason:"需验证切换与恢复"}]}`。编排者在首次冻结 Goal 前填写，入口同步生成 `requiredInteractionIds`；不得修改旧 sealed Goal 或用此字段解除旧 FAIL。

`states` 只证明真实操作后的状态，要求同页 hash-bound 时间轴中按序 `default/triggered/settled/restored` 原始图片；不强制交互录像，也不证明时长、缓动或过渡轨迹。`motion` 仍要求连续录像和上述状态帧。纯静态任务可声明 `required:[]` 并解释范围，但不能删除仍在 `mustPreserve` 中的交互要求。范围由编排者从任务判定、Evidence 与独立 QA 核对，不要求用户填表；不能因为采集失败才把 motion 改为 states。

未纳入本次必需能力的交互保留 unresolved/out-of-scope，不宣称 covered，不因此要求整站补录。实际要迁移的能力缺证据则退回 learn-brand 的对应局部；design-host 不自行发明品牌规则。页面连续覆盖、视觉维度、学习三证与独立 QA 保持原要求。motion Claim 必须用 `interactionId` 绑定通过录像验证的交互，语义提升也必须引用这类 Claim；状态证据不能晋级动效规则。此改动仅是证据粒度分离，不是完整 capability pack 或跨宿主兼容认证。

这类新 Goal 的局部绘制属性补采保存在同页 `supplementalTimelines:[{path,sha256}]`，不混入原始连续扫页。补充文件使用 `source-local-observation/v1`，含同页 `sourcePageId/url`、实际 `meta.viewport` 和 `frames[{capture,observation}]`；两项均绑定原件 SHA，observation 为浏览器原始测量 JSON，含准确 `url/viewport/capturedAt`。它只补同页静态 Claim，不替代完整覆盖或动效证明。伪元素本体与绘制边界、浏览器缩放和采集时点分别记录，不能伪造尺寸或把 CSS 声明当 computed 值。

新运行可在原生输入包明确声明 `visualAuthority: "viewport-sequence/v1"`，并提供 `viewport-screenshot`；入口将第一张真实视口图作为来源参考，在新 Goal 冻结 `fullPageRole: "overview-only"`。此模式下，全页图仍留档用于导航概览，但不能支撑颜色、字体、几何或状态 Claim；逐屏原件、连续录屏及真实交互记录共同作为事实来源。普通长页必须无间隔漏屏，控制器页必须覆盖声明的全部状态；Claim 必须绑定同页时间轴内的哈希截图。全页拼图的 sticky/字体拼接失真须标注，但不单独否决已经完整的真实视口证据；真实帧内容缺失仍阻断。只有新 Goal 可选择此职责分工，旧 sealed Goal、FAIL 和收据不改写。

宿主学习前置可由编排者用 `continue --artifact-root <原build> --browser-capture <原生采集包JSON>` 提交当前环境浏览器的原始记录，无需另启 CLI 浏览器。包为 `brand-native-source-input/v1`，含准确 `brand/sourceUrl/collector/capturedAt`、`status: raw-unreviewed`、明确 `limitations` 及相对包目录的 `files[{path,sha256,role}]`；至少有真实 `full-page-screenshot` 和 `browser-observation`。入口校验并隔离冻结全部文件，把它们作为 hashed inputs 交给原 Evidence 角色；不伪造 Dembrandt 结果，不写 Evidence PASS，不变更 Goal、后续门禁或宿主。仅接受尚未冻结 Goal 的同一前置运行；缺录屏、状态、字体等仍由 Evidence 如实拒收。此参数由编排者准备，不要求用户填写。

- `source-url` 进入 learn-brand 后由唯一总入口自动强制浏览器原生观察；HTTP/HTML/CSS 只保留为 seed，不需要用户知道 `--force-browser`。
- 普通长页按原生滚轮、稳定视口帧和页面末端验收；固定视口 Swiper/Fullpage 按大尺寸 controller 的 active state 变化验收，不能因 `scrollHeight === viewportHeight` 判定完成。
- 来源已观察到非绑定 Cookie 提示且遮挡内容时，现有采集器可传 `--cookie-reject-selector <准确拒绝按钮selector>`；只点击可见且文案明确为拒绝的按钮，保存前后 PNG 与 `consentAction`。不隐藏 DOM、不写 consent cookie，不匹配或不消失就失败；默认不执行该动作。
- 可见的非循环 autoplay 媒体视为 opening peak：先单独存档，再等待其结束和正式内容稳定后开始 settled 证据帧。等待预算耗尽时记录 `OPENING_MEDIA_NOT_SETTLED` 并返回 `NEEDS_EVIDENCE`。
- 图片主导页面以可见图片、视频、Canvas、SVG、背景图与 DOM 文本共同判定是否为空白；不能只用文本数量，也不能用整个文档中尚未进入视口的懒加载图片阻断当前帧。
- 原生观察必须同时产出 hash-bound opening frame、settled frames、continuous WebM、full-page raster、timeline 与 controller state。后续角色只消费通过 Evidence Gate 的统一 Manifest，不区分采集执行器。
- 第一次原生观察成功时，采集器必须同步归档本次页面实际加载的有界图片/媒体响应本体，并记录来源 URL、MIME、字节数、SHA-256 与本地路径；只有 URL、没有可复读本体的 network 清单不算完整素材证据。后续角色优先消费这份 hash-bound 本地归档，避免源站随后因防爬、鉴权、下线或链接过期而要求用户人工补图。
- 实际可见的 inline SVG 同步保存完整 DOM 原件、引用依赖与 selector/区块/视口帧绑定；computed 样式观察副本与原件分开，不将某个动画时刻冒充完整 Lottie 动画。重复 selector 只保存首观察帧，超限或依赖不完整须明确记录；向量 viewBox 不是像素展示上限，透明性与身份用途仍需角色核验。修复时可按冻结 raw capture 的视口和原生滚动位置补采到新目录，不重抓已充分的整页证据。Evidence 重试先归档旧输出及 receipt/dispatch，再追加新阶段，不能用覆盖旧文件抹掉失败历史。

## Corrective / Preventive Closure

已记录的局部 QA PASS 若被最终消费者拒收，不能手改旧 verdict 来解锁返工。用户已授权继续同一案例时，通过公共 `resume-learning-closure --artifact-root <原build> --brand <brand> --continue-existing --reason <准确原因>` 进行一次有界恢复；可先 `--dry-run`。入口只读重算实际拒收，归档原输出及收据，再派发缺件所属角色。Interpreter 缺 MOD 时先补解释交接，随后重新完成 Demo 与独立 QA；旧记录、Goal 和阈值保持原样。

自动重试预算用尽后停止；只有用户明确要求继续同一 case，编排者才可调用 `resume-evidence --continue-existing` 授权一次新 Evidence dispatch。续跑保存原 Goal hash、失败记录和额外一次授权，不修改质量阈值，也不自动续批后续重试。时间轴仅使用真实采样时间；旧帧无时间戳时标 unavailable，不能用固定间隔伪造录屏定位。

Interpreter 若以 `needs-evidence` 拒收并明确将失败归属 `brandResearcher`，同一命令可退回 Evidence；原 Evidence PASS 保留不改，续跑包携带当前消费者的阻断项与局部范围，不沿用旧失败。设计审批或解释问题不能借此触发重采。

Director 在 Demo 尚未派发时发现已记录的 Interpreter PASS 漏项，可用 `resume-interpreter --rejection <hash-bound 拒收记录>` 做一次有界 consumer repair。拒收绑定当前 Goal、Interpreter receipt 与全部真实输入输出，明确解释层缺口和局部回归；原 PASS/receipt 保留，追加 supersession 接力记录。不能以此更改 Goal、反复返工或绕过已经开始的下游；已通过的 Evidence 不重采。

独立 QA 已失败并使 learn-brand BLOCKED，且当前失败明确属于 `designTranslator` / Interpreter 时，可用 `resume-interpreter` 回到解释层；预算用尽时必须有用户继续同一 case 的明确授权并加 `--continue-existing`。只接受最新真实 QA receipt、原 Goal 与当前冻结输入的 hash 绑定，同一 QA receipt 最多开启一次修复。保留原收据和已通过 Evidence；实现责任 findings 留作 deferred，不进入 Interpreter packet。解释层只读取冻结来源事实与当前局部 corrective questions，不接收旧 QA verdict、QA 报告或实现理由；这些观察仍待来源核实，冲突不能当成指定样式结论。修复后重走 Demo 与独立复核；解释修复实质改变 approved rules 时必须 `fresh-blind`，只补契约定位且规则未变时可由原独立 QA `regression-review`，不能改阈值或补造 PASS。

Demo 或 Visual QA 的当前 `needs-evidence` 中也可明确指出 Researcher 所属缺口。混合责任拒收只将具名 Evidence findings 交给 Researcher，其余设计问题保留为 `deferredBlockingFindings`；不能以一个字体缺口授权重抓整个设计。续跑仍遵守同一预算与显式继续授权。

通用采集器保存原生 PNG 帧，以及同一页面会话的 `control-state-evidence.json`。默认只对至多三个首屏控件做被动 hover/focus 采样，不点击、提交或导航；这不是完整交互认证。角色核验真实 pseudo-state、截图、computed 值、动画是否仍运行后再判断覆盖，不能把定时样本名当作已证明的 transition/settled。素材 `specs` 与逐帧 `visiblePlacements` 是尺寸、透明性和可见位置事实；未知保持 unknown，文件名与规格不授权身份用途。补采放进新的有界目录，保留旧收据与原件，不把 JPEG 转 PNG 冒充新的无损来源。

用户或 QA 发现问题后必须同时完成：

- `Corrective Action`：修复当前 Case。
- `Preventive Action`：将同类错误加入节点自检、Consumer Gate 或机器 Validator。

没有实际新截图/操作、当前 hash-bound 独立 review 和必要回归 Gate，不得关闭问题。局部修复优先由原独立 QA 做 `regression-review`；方向、Goal、approved rules 实质改变，QA 参与制作或明显漏检才进入 `fresh-blind`。每次 reviewId 独立，原收据保留，旧 PASS 不继承；三证、阈值、scope 和共享平台回归不因模式或预算变化而降低。

### 容量与性能边界

优先复用适合的原独立 QA 做局部复验，以及已完成的普通专业角色；独立性与必要上下文隔离优先于角色复用。只有环境提供真实 close 接口时才释放 agent；interrupt 只是中断，不能清空上下文或释放容量。必要 fresh QA 无可用容量时保存紧凑、hash-bound 交接，记录一次实际容量错误并等待能力恢复；不反复尝试 spawn、不降级为制作方自审，也不要求用户填写专业契约。正常 workflow 恢复继续原任务，不创建用户新 chat。预算裁减重复读取与可选探索，保留实际渲染、操作、受影响相邻区和已过关键交互回归。

### QA 复核包准备

当前工程接入仅为 learn-brand 的 prepare/next/record。`prepare-qa-review.mjs` 生成 `schema: brand-qa-review-input/v2` 的实际冻结包；它记录 `reviewMode/reviewId/qaExecutionId`，回归绑定使用 `priorReviewReceipt`、`frozenInputs`、`currentDemoOutputs`、`affected`、`regressionScope`。前次 failure 从绑定收据读取；本次新截图写入 assessment 的 `captureEvidence`，实际操作证据仍使用现有 assessment 结构，不能把未输出的附加字段当成硬门禁。

```bash
node skills/brand/scripts/prepare-qa-review.mjs --brand <brand> --root <run-root> --review-mode initial-blind --qa-execution-id <fresh-agent-id>
node skills/brand/scripts/prepare-qa-review.mjs --brand <brand> --root <run-root> --review-mode regression-review --qa-execution-id <original-qa-id> --prior-receipt <receipt-path> --affected <section-a,section-b> --regression-scope <nearby-section,critical-interaction>
```

需要 fresh 复核时使用 `--review-mode fresh-blind` 和实际 fresh agent id。仅在尚未 dispatch 时可加 `--replace-prepared` 机械更换待验包，并保留旧 input；已 dispatch/record 的包与收据不可覆盖。准备成功后才运行现有 `next`、`record`；已采用 v2 的 run 缺当前复核包时 `next` 返回 `QA_REVIEW_PREPARATION_REQUIRED`，不能退回旧盲审。若误生成的包尚未送出/执行，Director 可用 `revoke-undelivered-qa-dispatch.mjs --root <run-root> --brand <brand> --attestation <path> --attestation-sha256 <sha>` 显式撤销；声明必须绑定具名责任人、当前 stage/dispatch/hash 和 delivered/executed=false，原包保全。已送出、已执行或已有收据绝不适用。design-host/apply-host 尚未接入此 helper，仍使用原阶段独立 review 入口；不得把 learn-brand 复验能力冒充这些阶段已支持的行为。

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
