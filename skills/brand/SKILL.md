---
name: brand
description: 从品牌官网、活动页、DESIGN.md、截图、Figma 或 DTCG 学习可迁移视觉语言，生成 DangoUI 品牌资产，或把已验证 style pack 应用到真实宿主。用户提到品牌学习、视觉迁移、换肤、style pack、DangoUI 映射或基于参考站改造页面时使用；不用于没有品牌来源的普通 UI 调整。
---

# Brand

把来源品牌转换成可追溯、可复用、可落地的 DangoUI 视觉资产。先选模式，再只读取当前节点需要的契约；不要全文读取 `workflow-contract.json`、大型 DangoUI JSON 或历史完整说明。

## 安装后与首次使用初始化

首次安装、更新完成、检测到已安装且版本一致，以及用户问“接下来怎么用”时，都进入同一初始化入口。若当前会话已经明确提供宿主、品牌参考与目标页面，复用这些信息，不重复问；不得沿用其他会话的方向。

先定位本 skill 安装目录，用其绝对路径执行：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs init --host <宿主目录>
```

这一步只读检查宿主并返回缺失信息，不安装依赖、不联网、不启动预览、不改宿主。`--host-confirmed` 仅在用户已明确指定目录时传入；`--reference`、`--page` 仅传当前会话用户已提供的值。不要将 skill 安装目录当作宿主，也不要扫描个人目录猜测。

面向用户：简短确认安装结果和识别的宿主，只询问缺失的最少必要信息，并展示 init 返回的 `welcome` 与自然语言示例。信息齐全后进入方案流程，仍须用户选定方向才实施。用户明确只安装时，说明下一步后停止。

## 选择模式

- `learn-brand`：学习品牌并产出 Evidence、Intent、Brand MOD、DangoUI mapping 与品牌学习 Demo；默认不改宿主。
- `design-host`：读取已学习品牌和真实宿主，先生成图片方向供用户选择，再重建所选方向的隔离 H5；不得修改宿主源码。
- `apply-host`：只实施 design-host 已冻结的唯一方向，保护业务内容、数据、路由、交互和组件 API；设计输入无效时退回 design-host，品牌证据缺失时退回 learn-brand。

统一入口：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs run --mode <learn-brand|design-host|apply-host> ...
node <skill目录>/scripts/brand-subagent-workflow.mjs prepare --brand <brand> --root <宿主目录>
node <skill目录>/scripts/brand-subagent-workflow.mjs next --brand <brand> --root <宿主目录>
```

`workflow-contract.json` 由脚本消费。角色只使用 `next` 生成的 dispatch packet、其中列出的 hashed inputs，以及当前岗位 reference。禁止为了了解全貌而读取整份 contract、所有角色文档或大型 DangoUI 数据文件。

## learn-brand

职责链：`Evidence → Interpreter → Demo → fresh Visual QA`。Dembrandt 是 Evidence 的候选发现工具，不是独立角色或事实来源。完整规则读 [learn-brand workflow](workflows/learn-brand.md)，当前角色再读取 dispatch 指定的岗位契约。

正式知识维护在 `knowledge/v0.1/`。先用 `query-design-knowledge.mjs stage learn-brand` 找问题，再定点查询 `question`、`basis`、`policy`、`method`、`decision` 或 `case`。历史知识不替代本轮证据，候选结论不等于已批准资产。

Demo 是品牌学习能力测试，Evidence Fidelity、Structural Fidelity、Generative Proof 必须分别通过；三者不可互相补偿。高显著度区块运行 `validate-section-fidelity.mjs --strict`。QA 失败只返工 `affectedSections` 并做小范围回归。

需要用户参与调试或签审时，按 [learn-brand workflow](workflows/learn-brand.md) 逐节点提供可打开的静态 H5。不要要求用户从原始 JSON 推断视觉结果，也不要把候选试装画成已批准换肤。

## design-host

职责链：`Host Strategist → Demo image producer → independent image QA → explicit user selection → H5 reconstruction → independent H5 QA → final selection`。

开始前按需读取 [Host Strategist](roles/host-strategist.md)、[Brand Application Designer](roles/brand-application-designer.md)、[Host Brand Composition Grammar](references/host-brand-composition-grammar.md)、[Visual Program](references/visual-program.md) 与 [Expressive moments playbook](references/expressive-moments-playbook.md)。

### 图片能力声明

`prepare` 后、第一次 `next` 前，检查当前任务是否暴露内建 `image_gen`，不得靠环境变量或猜测。

- 有内建 `image_gen` 时运行 `declare-capability --image-generation available`；默认内建模型可直接生成正式图片候选，不要求或猜测其底层模型名。
- 没有时传 `unavailable`。外部 CLI/API 不是自动替代品，只有用户明确批准后才能另行使用。

未声明时 `next` 返回 `IMAGE_GENERATION_CAPABILITY_UNDECLARED` 并保持可重试；明确不可用才以 `IMAGE_GENERATION_CAPABILITY_REQUIRED` 阻断。不要手写 capability JSON。

图片阶段使用当前任务默认模型，由独立视觉任务产生至少 3 个明显不同的完整方向，记录真实 image tool call、producer 与文件 hash。图片 QA 必须由不同执行者逐张打开，对构图、品牌忠实度、视觉完成度与宿主主任务清晰度全部给出 `qualityVerdict=pass`。用户明确选择图片方向前，不得生成 H5、修改宿主或自行代选。

用户选择后只重建获选方向的隔离 H5。H5 使用真实宿主内容、视口与冻结品牌包，但不启动或修改宿主 runtime；动态数据没有冻结真实记录时使用明确的 schema/加载占位，不能编造业务数据。图片不能替代 H5 验收。

每个阶段按 `design-host-route.json` 顺序门禁。图片、H5、QA 或用户选择缺一项都不能跳到下一阶段。机器通过只表示可以进入人工审美复核。用户最终确认前停止；不得实施或构建宿主。

## apply-host

职责链：`Host Implementation → Smoke QA → awaiting-user`。当前岗位按需读取 [Host Implementation](roles/host-implementation-agent.md)、[Host Visual QA](roles/host-visual-qa.md)、[theme load order](references/host-theme-load-order.md) 与 [Runtime Gate](references/mapping-rules.md#公开宿主的-dangoui-runtime-gate)。

实施前验证最终方向、pre-edit baseline、`design-host-route.json` 和主题加载顺序。实施后用 structural diff、真实渲染、computed style 与业务行为证明没有破坏宿主。缺少真实 runtime 证据时最高只能报告 `PARTIAL_STYLE_ONLY` / `conservative-application`。

fast 档只实施首屏并做 Smoke QA。用户 `approve` 且冻结输入、实现输出和 Smoke QA 输出 hash 均未变化时可复用结果；`revise` 重新实施，`standard` 或 `certify` 运行 affected-scope / release-level 独立 Visual QA。

## 共同硬边界

- 来源截图只能用于 Evidence/QA，不能复制进 runtime 冒充实现资产。
- `generated-proposal` 不能定义品牌身份；只有 `evidence-source` 和明确批准的 `derived-approved` 可进入正式方向。
- 品牌素材像素颜色不能自动提升为按钮、状态、文本或导航语义色。
- Producer 自检不能替代独立 QA；实现者不能担任自己的 fresh QA。
- 用户指出视觉不符时，定位最早责任节点并只重做受影响范围；没有新证据或 fresh QA 不得关闭问题。
- 宿主源码修改前后必须有不可变 baseline 和结构差异验证；未批准的业务逻辑、路由、API、状态、事件与组件 API 改动一律阻断。
- 对外视觉验收必须给可直接打开的前后对比 H5，标明相同任务、视口、内容、唯一实质改动、来源和批准边界；用 `validate-visual-acceptance.mjs` 校验。

## 按需资料

- Token、组件、资产与 style-only 映射：[mapping rules](references/mapping-rules.md)
- DTCG 结构：[migration asset standard](references/brand-dtcg-migration-asset-standard.md)
- 输出字段：[output template](references/output-template.md)
- 原子验收：[atomic acceptance rubric](references/atomic-acceptance-rubric.md)
- 产物隔离与清理：[artifact lifecycle](references/artifact-lifecycle.md)
- 历史完整说明：[legacy full guidance](references/legacy-full-guidance.md)，仅在维护审计或定位旧规则来源时读取。

大型 JSON 由 validator 或查询脚本读取。只有 dispatch 无法回答当前决策时，才用 `query-brand-context.mjs get/search` 定点读取对应 key。

## 完成与同步

运行与改动范围相称的 validator/test。维护源是 `skills/brand/`；修改后执行 `npm run sync:skills -- --repo-only` 同步 `.claude/skills/brand/`。需要更新本机 Codex 安装副本时才运行不带 `--repo-only` 的同步命令。

最终优先报告真实宿主预览地址、所选方向、默认入口验证和业务是否保留；内部 token 表与审计文件只在追问或阻塞时展开。

首次安装、更新、版本一致和“怎么用”都展示 init 的 `welcome`，并提供 [DangoUI Variant 库](https://jocelyntong.github.io/DangoUI-Brand-Skill/#/variants)。Variant 是视觉选择入口，不是 Registry；预览不等于宿主适配验收。
