# 宿主 expressive 交接

run-brand-workflow 在 design-host 提交 --application-plan 和 apply-host 实施前读取 migrations/<brand>/host-expression-plan.json（可用 --expression-plan 指定）。初始宿主分析不要求已有计划。

schema: host-expression-plan/v1；hostTask 为真实任务；hostBaseline 与 brandInput 为 {path,sha256}，路径相对项目根。regions 每项包含 id、technique（none/existing/generated）、reason、primaryTaskProtection、knowledge（questionId/disposition adopt|adapt|reject/contextDifference/reason）。检索问题必须在正式知识库存在。

generated 区域额外需要 brief（brandConstraints 数组、freedom 数组、dynamicContent、viewportBudget）、reconstructionRisk low|medium|high（high 需 riskAcceptanceReason）、concept、h5、proof。后三者均为文件路径和 sha256。

proof 文件包含 conceptSha256、h5Sha256、runtime {ok,command,evidence:[{path,sha256}]} 与 visual {status:accepted,reviewer,limitations,evidence:{path,sha256}}。拒绝的视觉结果不可进实施。散列只能防过期，不能保证记录诚实或画面美观；运行证明与审美证据必须来自真实检查，不能手填 fixture 冒充。

这是新增的必需交接，旧计划需补充，不静默绕过。生成调用和 H5 制作仍由执行 agent 使用工具完成，入口脚本不会自己生图。机器门不保证区域判断或审美；缺失则明确停止。

验证：node skills/brand/scripts/validate-host-expression.test.mjs。

## 组件与动效迁移补充

选定方案包含交互组件或动效时，在 application plan 的 `componentMotionExpectations` 中冻结 `components`（id、role、states）和 `motions`（id、trigger、durationMs、iterations、reducedMotion）。无动效写空数组，不凭静态截图推断。实际浏览器观察写入 receipt 的 `componentMotionObservations`；组件 states 逐项记录 pass，动效记录对应参数与 observedInBrowser。`validate-host-apply-gate.mjs` 对已声明的期望强制校验，未测不能补写为 pass。旧计划未声明时保持兼容，不表示旧计划已完成该检查。此检查证明交接完整性，不证明审美或来源正确。
