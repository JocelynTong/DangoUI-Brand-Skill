# Attempt 11 Evidence — Pokémon Championship Series

## Verdict

**PASS**。目标 section 的身份、桌面/移动端结构、官方 1x/2x 资产、移动端排版、桌面与 390px CTA 状态链、真实跳转和双端滚动恢复均已冻结。Dembrandt 本轮不可用，没有生成分数；本轮由截图优先观察加 DOM/computed-style 反查完成客观闭环，不把 Dembrandt 设为阻塞项。

## 已冻结的 section

Pocket 之后第一个完整高显著区块是 **POKÉMON CHAMPIONSHIP SERIES**，下一段是 **Play! Pokémon**。身份与边界由 [桌面完整 section](captures/desktop/championship-series-settled-region-1440x720.png) 和 [移动端完整 section](captures/mobile/championship-series-settled-region-390x829-scale50.png) 共同确认。

所有结构尺寸都采用 section-local 坐标。来源页面的 absolute pageY 会漂移，只能作为非结构上下文，未被写成实现不变量。

## 结构与层级

桌面 1440：article 为 1440×720；row 是 `display:flex` + `row-reverse`。右侧图像列为 local `[720,0,720,720]`，左侧内容列为 `[0,0,720,720]`。内容盒为 `[12,171.211,696,377.578]`，其中 local y 由 `(720 - 377.578) / 2` 得到。article、row、两列和内容盒的已观察背景均透明，也未观察到 pseudo fill；可见白色来自 page canvas。

移动端 390：article 为 390×829.1719，row 改为 `block`。图像先出现，local `[0,0,390,390]`；内容随后为 `[8,390,374,439.172]`。背景仍透明，阅读顺序为图像 → 标题 → 正文 → Learn more。

## 资产与排版

桌面官方 2x 图像是 1392×1392 JPEG，SHA-256 为 `862a5f138e77cb6e0a8fdb44538a19d9ddfa3d60328b2113b6ae48f8000895db`。声明的 1x 图像是 696×696，SHA-256 为 `0f7fb0ab417f1b2076343573a676b71629722e30e252147f11f4ef3966eb918d`。一次重要纠错是：390px live DOM 的 `src` 指向 1x，但浏览器实际 `currentSrc` 选择 2x；今后响应式资产必须记录 `src + srcset + currentSrc`，不能只凭 `src` 判断实际加载资源。

移动端标题为 Kanit 700、32/32.5；正文为 PT Sans 400、18/28.8；CTA 为 PT Sans 700、18/22.5。完整尺寸与间距见 [source-observation-manifest.json](source-observation-manifest.json) 和 [section-fidelity-source.json](section-fidelity-source.json)。桌面 typography 的精确 bbox 没有独立冻结，保持 unresolved。

## 交互与滚动

桌面已冻结 default、hover transition、hover settled、focus 和 destination；390px 也独立冻结 default、hover settled、keyboard focus 与 destination。移动端默认黑底时伪元素 `scaleX(0)`，hover 后金色伪元素变为 `scaleX(1)`；focus 保持黑底并出现可见 outline。CTA 真实跳转到 `https://championships.pokemon.com/en-us/`。归档 CSS 声明 `transform 0.2s ease-in-out`；截图本身没有时间戳，因此不从帧序列另行推导时长。

桌面和移动端都有 before、target、restored 端点。它们只证明页面滚动可逆与上下文连续，不把 absolute pageY 当作固定几何。逐状态结论见 [interaction-state-matrix.json](interaction-state-matrix.json)。

## 非阻塞未决项

- 桌面排版元素的精确 bbox；移动端排版和桌面区块结构已足以约束本轮实现。
- Dembrandt：工具不可用，未评分；不替代截图优先的人眼事实与 DOM/computed-style 反查。

Evidence → Interpreter/Design Direction/Demo 的实现门禁现已打开。全部截图与资产 hash 见 [rendered-asset-inventory.json](rendered-asset-inventory.json)。
