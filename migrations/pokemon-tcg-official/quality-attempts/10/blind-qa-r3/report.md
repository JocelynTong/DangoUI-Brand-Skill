# Attempt 10 · Pocket revision3 · Blind QA r3

## Verdict

**REWORK**

Pocket 的视觉学习结果已经通过：Evidence Fidelity、Structural Fidelity、Generative Proof 三证均为 PASS。整体不能放行的原因不是视觉还原，而是 held-out 页的一个真实交互缺陷，以及下一轮 Blind QA 输入包还不够“盲”。

## 视觉结论

- Desktop：真实页面测得区块 `1440 × 476.1875`；浅色背景覆盖整段，左右内容逻辑为 `720 / 720`；右侧黑面板 `720 × 356.5`，顶部与底部各露出约 `59.84px` 背景。通过。
- Mobile：真实页面测得区块 `390 × 743.015625`；上部资产区约 `334.23px`，下部通栏黑面板约 `408.79px`。通过。
- 响应式资产：desktop/mobile 使用两个官方 URL alias，本地两份文件 SHA256 都是 `4fb7e2a72c046448d58d2d1bc6f0a9e5f61b9693ddcec5d117b59f881ec25976`。没有把它误判为两张不同视觉图。通过。
- Logo / type / official CTA：`logo-cards.png` 为独立透明资产；Kanit italic 与 PT Sans 的字号、行高符合冻结证据；Play Now 指向真实外链，白底黑字在 hover 变为金色并可恢复。通过。
- 滚动：Home 的 `.phone-screen` 为 `2547 / 821`，滚动 `0 → 1725.5 → 0`；held-out 为 `1255 / 821`，滚动 `0 → 433 → 0`。通过。
- Motion：继续保持 `UNRESOLVED / UNSCORED`，没有补写中间帧、时长、easing 或 stagger。

## Generative Proof

独立 fixture 清楚标注 `GENERATIVE FIXTURE · FICTIONAL · NOT AN OFFICIAL PRODUCT`，内容改成虚构的 Pocket Deck Studio；desktop 把 copy 移到左半、DOM/CSS concept tile 放右半；mobile 仍保持 asset-first / copy-second；没有使用官网截图或官方 `logo-cards` composite。Generative Proof 通过。

## Blocking finding

`HELD_OUT_CTA_BREAKS_SPA_ROUTE`

“Review the Concept” 是一个启用的 `<a>`，但 `href="#fictional-pocket-concept"` 在页面中没有对应 target：

- 点击前：`?proof=desktop#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-pocket-fixture`
- 点击后：`?proof=desktop#fictional-pocket-concept`
- `document.getElementById("fictional-pocket-concept") === null`
- 刷新后 held-out fixture 不再存在

最早失败节点：**Demo Implementation**；owner：`demoImplementationAgent`。只需要把它改成真正 inert 的控件，或改成不会破坏 SPA route 的有效目标，并重新证明 click + reload recovery；无需重做 Evidence / Interpreter / Pocket 几何。

## Blind QA 协议缺口

Attempt10 没有提供 hash-bound `qa-input-manifest.json`，同时 `demo-revision3/provenance.json` 内含旧 QA blocker code。当前结论没有读取 r1/r2 报告，也没有使用这些旧 code 作为判断依据，但下一轮应由 Design Director / Orchestrator 清洁输入包后再派全新 QA。

## 回归检查

- Hero：desktop `1440 × 450`、mobile `390 × 416`；carousel 与卡面翻转均有真实状态变化并恢复。
- News：desktop `1440 × 719.796875`、mobile `390 × 633.1953125`；轮播可切换并恢复 page 1。
- TCG Live：desktop `1440 × 624`、mobile `390 × 644.625`；5 张关键资产 natural size 非零，真实 Learn More href 保留。
- 无横向 overflow，浏览器 console 无 error / warning。

## Gate 结果

- `validate-design-direction`: PASS
- `validate-section-fidelity --strict`: PASS
- `asset-usage-gate`: PASS
- `validate:brand-preview`: PASS（只有仓库既有 warning）
- `npm run build`: PASS（只有 chunk size warning）

## Captures

- `captures/demo-calibration-desktop-1440.png`
- `captures/demo-calibration-desktop-1440-hover.png`
- `captures/demo-calibration-mobile-390.png`
- `captures/demo-calibration-mobile-390-hover.png`
- `captures/demo-heldout-desktop-1440.png`
- `captures/demo-heldout-desktop-1440-hover.png`
- `captures/demo-heldout-mobile-390.png`
- `captures/demo-heldout-mobile-390-hover.png`
- `captures/demo-regression-mobile-top-390.png`
- `captures/demo-regression-mobile-tcgl-390.png`
