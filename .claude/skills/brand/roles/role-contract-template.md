# Brand Role Contract Template

每个 Pipeline 节点都必须使用这份模板。Role Markdown 是岗位执行契约，不是招聘介绍；机器可判定的要求同时落入 `workflow-contract.json` 或脚本 Gate。

每个角色必须完整声明：`goal / owns / inputs.required / inputs.allowed / inputs.forbidden / tasks / outputs / requirements / decisionRights / mustNot / passCriteria / failCriteria / handoff / retry`。缺字段的角色视为不可独立派发，不得靠 Orchestrator 临场补全。

## 角色使命

用一句话说明该角色为谁解决什么问题。不得用“协助整体任务”这类不可验收描述。

## 成功目标

列出该角色能够独立负责的结果。目标必须能由下游消费者或 Gate 验证。

## 工作范畴

列出该角色必须完成的工作，以及它拥有最终决定权的事项。

## 输入要求

- `required`：缺少时不得开始。
- `allowed`：允许参考，但不能取代 required 输入。
- `forbidden`：为防止确认偏差而不得接收的内容。

## 工作步骤

描述必要的判断顺序。只固定会影响正确性的顺序，其余实现方式由角色自行选择。

## 必须产出

列出文件、字段、截图、状态记录或决策。每项产出都应有明确消费者。

## 节点自检

角色交付前必须主动执行。自检失败时不得把不完整产物交给下游。

## 职责边界

明确 `mustNot`、无权决定的事项，以及何时必须请求上游补证据或升级给 Orchestrator。

## 下游接收条件

从消费者视角定义什么输入才可接收。Producer 自称完成不构成交接成功。

## 失败与返工

- `PASS`：满足交接条件。
- `REWORK`：输入充分，但本节点产物不合格，退回本节点。
- `NEEDS_EVIDENCE`：上游事实不足，退回 Evidence。
- `BLOCKED`：缺少用户选择、权限或关键外部状态，升级给 Orchestrator。

每个失败必须记录 `earliestFailureNode`、`failureOwnerRole`、证据和应新增的回归检查。

## 派发包与交叉验收

每个 dispatch packet 固定包含冻结目标 hash、角色、required/forbidden 输入、交付物、验收标准、失败路由和 cross-checker。Producer 自检只属于 L1；必须由下游 Consumer Gate 或 fresh QA 完成交叉验收。任何 journey、page、component family 或 state 的局部 PASS 都只能关闭对应 scope，不能自动升级成 full pipeline / full host PASS。
