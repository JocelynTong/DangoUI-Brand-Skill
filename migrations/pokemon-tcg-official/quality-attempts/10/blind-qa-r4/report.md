# Attempt 10 · Blind QA r4

## 结论

**REWORK**。Evidence Fidelity 通过；Structural Fidelity 与 Generative Proof 因一个不可被其他通过项抵消的 blocker 未通过。

## 唯一 blocker

held-out 页面把已冻结的 CTA 字体角色弄丢了：

- 官网校准页 CTA：`PT Sans Official / PT Sans`、`20px`、italic `700`。
- held-out CTA 实测：`Oxanium / Arial Narrow`、`12px`、italic `700`。
- 这直接违反 `PAT-POCKET-06`，也使 `generative-proof.json` 声明的 “PT Sans body/action roles” 不成立。
- 最早失败节点：`Demo Implementation`。
- 返工边界：只修 held-out CTA 的字体族和字号；不得改 Goal、Evidence、Intent、构图、交互或 motion 口径。修后必须换一个新的 Blind QA 上下文复验。

## 已通过

- Pocket 桌面：1440×476.19 全宽浅色背景；720/720 内容列；右黑面板 720×356.5，上下各露出约 59.84px 背景。
- Pocket 移动：390×743.02，334.22px 资产区在上，408.79px 黑色文案区在下，无横向溢出。
- 响应式背景 URL 角色存在，但两文件均为 720×464 且 SHA-256 完全相同；未错误记为可见换图能力。
- 官网 `logo-cards.png` 正确加载；校准页 Kanit/PT Sans 层级正确。
- 官网 CTA 白底黑字，hover 仅前景变为 `rgb(226, 186, 101)`，移出后恢复；外链实际打开 Pokémon TCG Pocket。
- held-out 明确标记 `FICTIONAL · NOT AN OFFICIAL PRODUCT`，桌面主动交换左右子区，使用独立 DOM/CSS concept tile，不复用官网截图。
- held-out CTA 点击前后 URL 不变，`aria-pressed` 从 false 变 true，`aria-live` 显示本地状态；刷新后仍停留 fixture 且状态恢复。
- 真实坐标点击证明 phone-screen 的 `scrollTop` 点击前后均为 0；未发生意外位移。
- 首页可逆滚动通过；held-out phone 包含两个 section，`scrollHeight 1255 > clientHeight 821`，可滚到 433 并恢复 0。
- Hero、News、TCG Live 回归通过；控制台无 error/warning。
- `validate-design-direction`、`validate-section-fidelity --strict`、`npm run build` 均通过。

## 三证

| 证明 | 结论 | 原因 |
| --- | --- | --- |
| Evidence Fidelity | PASS | 来源事实、资产、几何和交互均可追溯；alias 同字节口径正确。 |
| Structural Fidelity | FAIL | held-out 高显著度 CTA 字体角色偏离。 |
| Generative Proof | FAIL | 变化本身有效，但未保留声明的不变量 “PT Sans action role”。 |

Motion 的中间帧、时长、缓动、stagger 和 sequence 继续保持 **UNRESOLVED / UNSCORED**。

