---
name: brand
description: 从品牌官网、活动页、DESIGN.md、截图、Figma 或 DTCG 学习可迁移视觉语言，生成 DangoUI 品牌资产，或把已验证 style pack 应用到真实宿主。用户提到品牌学习、视觉迁移、换肤、style pack、DangoUI 映射或基于参考站改造页面时使用；不用于没有品牌来源的普通 UI 调整。
---

# Brand

把来源品牌转换成可追溯、可复用、可落地的 DangoUI 视觉资产。先选模式，再只读取当前节点需要的契约；不要全文读取 `workflow-contract.json`、大型 DangoUI JSON 或历史完整说明。

## 安装后与首次使用初始化

首次安装、更新完成、检测到已安装且版本一致，以及用户问“接下来怎么用”时，都进入同一初始化入口。不要仅回复安装成功或让用户再输入 `$brand`。若当前会话已经明确提供宿主、品牌参考与目标页面，复用这些信息，不重复问；不得沿用其他会话的方向。

先定位本 skill 安装目录，用其绝对路径执行：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs init --host <宿主目录>
```

这一步只读检查 package.json 并返回 missing 问题，不安装依赖、不联网、不启动预览、不改宿主。`--host-confirmed` 仅在用户已明确指定该目录时传入；`--reference`、`--page` 仅传当前会话用户已提供的值。不要将安装目录当作宿主；目录未知时先询问用户，不扫描个人目录猜测。非 Node 项目也可继续人工只读确认，脚本无法识别不等于不支持。

面向用户：简短确认安装结果和识别的宿主；合并询问 missing 中的最少必要信息；给出返回的自然语言 example。首次安装与版本一致分支必须给相同的下一步。信息齐全后进入正常方案流程，仍须用户选定方向才实施。用户只要求安装并明确不要继续时，简述下一步后停止，不自动初始化。

## 先选择模式

- `learn-brand`：学习品牌并产出 Evidence、Intent、Brand MOD、DangoUI mapping 与品牌学习 Demo；默认不改宿主。
- `design-host`：读取已学习品牌和真实宿主，生成至少 3 个完整宿主内视觉方向并等待用户选择；不得修改、编译或注入宿主源码。
- `apply-host`：只实施 design-host 已冻结的唯一方向，保护业务内容、数据、路由、交互和组件 API；设计输入无效时退回 design-host，品牌证据缺失时退回 learn-brand。

统一入口：

```bash
node skills/brand/scripts/run-brand-workflow.mjs run --mode <learn-brand|design-host|apply-host> ...
node skills/brand/scripts/brand-subagent-workflow.mjs prepare --brand <brand>
node skills/brand/scripts/brand-subagent-workflow.mjs next --brand <brand>
```

`workflow-contract.json` 由脚本消费。角色只使用 `next` 生成的 dispatch packet、其中列出的 hashed inputs，以及当前岗位 reference。禁止为了“了解全貌”读取整份 contract、所有角色文档或三个大型 DangoUI 数据文件。

## learn-brand

固定职责链：`Evidence → Interpreter → Demo → fresh Visual QA`。Dembrandt 是 Evidence 的候选发现工具，不是独立角色或事实来源。完整执行规则读 [learn-brand workflow](workflows/learn-brand.md)；当前角色再读取 dispatch 指定的岗位契约。

通用取证、设计资产晋级和知识沉淀判断维护在正式 `knowledge/v0.1/`；统一按下文“阶段 → 问题 → 判断依据”检索。历史知识不替代本轮 Evidence，候选结论不等于已批准资产。
判定品牌主色或 CTA 与 primary action 的关系时，另查 `policy primary-color-and-cta`：首页/官方身份入口优先作为品牌身份来源，再与独立核心页面对照；CTA 只比同职责行动。单页色值不能晋级全局，CTA 与品牌主色是否同值必须分别举证。

Demo 是 brand-learning-capability-test，必须分别通过 Evidence Fidelity、Structural Fidelity、Generative Proof；三证不可互相补偿。高显著度区块必须通过 `validate-section-fidelity.mjs --strict`。QA 失败只返工 `affectedSections` 并做小范围 regression，不得默认全站重采。
若需要用户参与调试或签审，按 [learn-brand workflow](workflows/learn-brand.md) 逐节点交可打开的静态 H5：来源可见样本、语义判断、实际映射、前后运行态和 QA 结论分别可视化；每步都有来源、状态和能否交给下游的明确结论。不可要求用户从原始 JSON 推断视觉结果，也不可把候选试装画成已批准换肤。

## design-host

职责链：`Host Strategist → Brand Application Designer → user selection → freeze baselines`。当前岗位只读：

- [Host Strategist](roles/host-strategist.md)
- [Brand Application Designer](roles/brand-application-designer.md)
- 构图时读取 [Host Brand Composition Grammar](references/host-brand-composition-grammar.md)
- 分配视觉强度、场景层级和动效意图时读取 [Visual Program](references/visual-program.md)；fast 至少渲染 3 个场景图、内容入口与结果容器均有实质差异的候选。
- 对 expressive/productive 的取舍与可执行门槛，读取 [Expressive moments playbook](references/expressive-moments-playbook.md)；机器通过仅表示可交用户审美复核。

知识按需查询，不把判断正文复制进角色 JD，也不固定先查表达取舍。需要任务上下文时查 `pattern <id>`，需要机器绑定时查 `scenario <id>` 或 `component <name>`。组件以 DangoUI 现有设计系统为准；若目标明确使用场景试点，在冻结 goal 中填写 `knowledgeScenarioId: "search-filter-results"` 并验证真实区域与 token 映射，其他宿主不强制套用该场景。

引用来源品牌的 token、素材、组件或构图前，查询 `method design-asset-adoption` 和相关 `decision <id>`；只消费范围匹配的已批准记录。[设计资产决策库](../../public/knowledge/decisions.html) 与任务 Pattern 库分开，候选或 blocked 记录不得冒充已批准食材。

design-host 至少生成 3 个隔离的完整静态 H5 方向和结构化 JSON；需要生图的 expressive 分支可生成方向参考图和实现素材，并交动态 H5 试片验证；图片不能替代完整 H5 方向。H5 使用真实宿主内容、路由、视口和冻结品牌包，但不启动或修改宿主 runtime；在对话中直接展示 H5 文件链接。动态 API 内容没有冻结真实记录时只能显示明确的 schema/加载占位，不能编造商品、卡组名称或数据。品牌素材可以嵌入 H5，不能把整页方向改为图片。

每个方向必须绑定真实宿主 baseline、Brand MOD hash、来源 token、asset 与 composition；保留 navigation、primary task、business switch 和 business content；与其他方向在视觉中心、行动位置、内容进入方式和结果容器中至少三项不同；通过来源、语义颜色、移动端视口、品牌系统闭环和 visual-retention Gate。

用户明确选择前停止；不得实施、构建宿主或创建 runtime 试装。

运行前校验安装包完整性；任一脚本与同步清单 hash 不一致时以 `BRAND_SKILL_MIXED_VERSION` 阻断。候选同主素材、策略距离不足或排名完全失去区分度时不得进入 shortlist。静态 H5 产出后必须运行 expressive H5 validator，由独立 Visual QA 通过本地 127.0.0.1 静态文件服务在目标视口打开复核、不保存截图；`file:` 链接被浏览器拒绝时不能直接跳过 QA。fast 从 prepare 起超过五分钟即停止并报告超时。QA 协议通过不等于 expressive 审美通过。

## apply-host

职责链：`Host Implementation → Smoke QA → awaiting-user`。当前岗位只读：

- [Host Implementation](roles/host-implementation-agent.md)
- [Host Visual QA](roles/host-visual-qa.md)
- 涉及主题 cascade 时读 [theme load order](references/host-theme-load-order.md)
- 需要真实 DangoUI runtime 时只读 [Runtime Gate](references/mapping-rules.md#公开宿主的-dangoui-runtime-gate)

fast 档只实施首屏并做 Smoke QA。用户 `approve` 且冻结输入、实现输出和 Smoke QA 输出 hash 均未变化时，直接复用 Smoke QA 完成 fast preview，不再派发第二次完整 QA。`revise` 重新实施；`standard` 或 `certify` 才运行 affected-scope / release-level 独立 Visual QA。

实施前必须验证 design direction、pre-edit baseline 和主题加载顺序。实施后用 structural diff、真实渲染、computed style 和业务行为证明没有改坏宿主。缺少真实 runtime 证据时最高只能报告 `PARTIAL_STYLE_ONLY` / `conservative-application`。

## 共同硬边界

- 来源截图只能用于 Evidence/QA，不能复制进 runtime 冒充实现资产。
- `generated-proposal` 不能定义品牌身份；只有 `evidence-source` 和明确批准的 `derived-approved` 可进入正式方向。
- 品牌素材像素颜色不能自动提升为按钮、状态、文本或导航语义色。
- Producer 自检不能替代 Consumer Gate；实现者不能担任自己的 fresh QA。
- 用户指出视觉不符时，定位最早责任节点并只重做受影响范围；没有新证据或 fresh QA 不得关闭问题。
- 凡向用户交付视觉、token 映射或宿主换肤的验收结论，必须同时给可直接打开的前后对比静态 H5：相同任务、视口和内容，并列标明旧状态、新状态、唯一实质改动、来源与批准边界。用 `validate-visual-acceptance.mjs <manifest.json>` 校验 H5 两侧确实存在并标明边界，再做浏览器目视 QA。即使结论是 BLOCKED，也要展示已发生的视觉变化或明确标示没有可批准的新状态；不得只交 JSON 状态或截屏，也不得把模拟画面冒充真实宿主。
- 宿主源码修改前后必须有不可变 baseline 和结构差异验证；未批准的业务逻辑、路由、API、状态、事件与组件 API 改动一律阻断。

## 按需资料

- Token、组件、资产与 style-only 映射：[mapping rules](references/mapping-rules.md)
- DTCG 产物结构：[migration asset standard](references/brand-dtcg-migration-asset-standard.md)
- 输出字段模板：[output template](references/output-template.md)
- 原子验收口径：[atomic acceptance rubric](references/atomic-acceptance-rubric.md)
- 历史完整说明：[legacy full guidance](references/legacy-full-guidance.md)，仅在维护审计或定位旧规则来源时读取，运行 pipeline 不得默认加载。

大型 JSON 由 validator 或查询脚本读取。只有当前任务需要核对具体 token/component 且 dispatch 未提供答案时，才定点查询对应 key；不要把完整文件送入模型上下文。

定点读取用 `query-brand-context.mjs get/search`；输出有长度上限并同时报告原文件与返回片段字节数。只读 validator 会按“脚本 + 参数 + 输入文件 hash”复用结果；输入变化自动失效。Visual QA 失败必须返回 `deltaScope`，后续只携带受影响输入和小范围回归项。每次 dispatch/receipt 的输入、输出与额外读取字节数记录在 `workflow-telemetry.json`，作为 token 用量的可审计代理指标。

## 完成与同步

试跑构建与预览使用独立产物目录，按 [产物生命周期](references/artifact-lifecycle.md) 初始化、保护证据、结束及隔离；不往宿主持续堆积中间构建。

运行与改动范围相称的 validator/test。维护源目录是 `skills/brand/`；修改后运行 `npm run sync:skills` 同步 `.claude/skills/brand/`。最终对业务用户优先报告真实宿主预览地址、所选方向、默认入口验证和业务是否保留；内部 token 表与审计文件只在追问或阻塞时展开。

## 宿主 expressive 交接门
宿主分析完成后按 [host-expression handoff](references/host-expression-handoff.md) 生成区域表达计划。design-host 提交候选和 apply-host 实施前，入口强制验证计划、正式知识引用和文件 hash；generated 分支必须先交动态 H5 试片与运行/视觉证据。none/existing 不强制生图。此门只证明交接一致性，不自动作审美判断。

## 强决策检索入口
在来源取证、视觉依据选择、方向冻结、拆层实施、视觉修复和最终验收时，执行 `node skills/brand/scripts/query-design-knowledge.mjs stage <learn-brand|design-host|apply-host|repair|acceptance>` 浏览匹配阶段的问题；根据任务选择 `question <id>` 明确边界，再用 `basis <question-id>` 读取针对性依据和案例摘要。专项问题可先读摘要；整页方案、跨问题依赖、依据冲突、摘要不足、新宿主或新交互条件出现时，必须回读完整方法与相关案例。用 `basis <question-id> --context=<whole-design|cross-question|conflict|insufficient|novel-context>` 直接取得完整来源，可用逗号组合；这不等于禁止直接查询 `method` / `rule` / `case`。记录回读触发条件、已读来源和影响判断的前提/例外；脚本返回原文不等于 agent 已理解。旧问题 ID 的 basis 查询会转到合并后的问题。未匹配时记录空缺，不硬套。记录 questionId、adopt/adapt/reject、情境差异、理由和证据；新纠正回写案例，不把多版或多个方案计作独立案例，不编造当时理由，候选不自动晋级。

## 宿主协作架构
宿主分析、视觉设计、宿主实现、独立验收为四个平级专业角色。design-host / apply-host 是阶段，不是管理层；router / designDirectorOrchestrator 仅承担路由、派发、冻结和回退，不增加一层专业审批。生图、拆层和脚本属于方法/工具，不创建下级角色。交接和失败归属见 `references/host-collaboration.json`，dispatch 携带同一契约。
