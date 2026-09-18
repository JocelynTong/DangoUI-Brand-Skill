---
name: brand
description: 从品牌官网、活动页、DESIGN.md、截图、Figma 或 DTCG 学习可迁移视觉语言，生成 DangoUI 品牌资产，或把已验证 style pack 应用到真实宿主。用户提到品牌学习、视觉迁移、换肤、style pack、DangoUI 映射或基于参考站改造页面时使用；不用于没有品牌来源的普通 UI 调整。
---

# Brand

把来源品牌转换成可追溯、可复用、可落地的 DangoUI 视觉资产。先选模式，再只读取当前节点需要的契约；不要全文读取 `workflow-contract.json`、大型 DangoUI JSON 或历史完整说明。

## 先选择模式

- `learn-brand`：学习品牌并产出 Evidence、Intent、Brand MOD、DangoUI mapping 与品牌学习 Demo；默认不改宿主。
- `design-host`：读取已学习品牌和真实宿主，生成 2–3 个宿主内视觉方向并等待用户选择；不得修改、编译或注入宿主源码。
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

Demo 是 brand-learning-capability-test，必须分别通过 Evidence Fidelity、Structural Fidelity、Generative Proof；三证不可互相补偿。高显著度区块必须通过 `validate-section-fidelity.mjs --strict`。QA 失败只返工 `affectedSections` 并做小范围 regression，不得默认全站重采。

## design-host

职责链：`Host Strategist → Brand Application Designer → user selection → freeze baselines`。当前岗位只读：

- [Host Strategist](roles/host-strategist.md)
- [Brand Application Designer](roles/brand-application-designer.md)
- 构图时读取 [Host Brand Composition Grammar](references/host-brand-composition-grammar.md)

fast 档默认只生成 2–3 个隔离的静态 H5 方向。H5 使用真实宿主内容、路由、视口和冻结品牌包，但不启动或修改宿主 runtime。不要先调用图片生成模型制作方向图；只有用户明确要求位图提案，或静态 HTML/CSS 无法表达必要品牌画面时才生成图片。需要在对话中展示时，可对同一 H5 做一次确定性截图；截图只是展示副产物，不是第二套设计。

每个方向必须绑定真实宿主 baseline、Brand MOD hash、来源 token、asset 与 composition；保留 navigation、primary task、business switch 和 business content；与其他方向在视觉中心、行动位置、内容进入方式和结果容器中至少三项不同；通过来源、语义颜色、移动端视口、品牌系统闭环和 visual-retention Gate。

用户明确选择前停止；不得实施、构建宿主或创建 runtime 试装。

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

运行与改动范围相称的 validator/test。维护源目录是 `skills/brand/`；修改后运行 `npm run sync:skills` 同步 `.claude/skills/brand/`。最终对业务用户优先报告真实宿主预览地址、所选方向、默认入口验证和业务是否保留；内部 token 表与审计文件只在追问或阻塞时展开。
