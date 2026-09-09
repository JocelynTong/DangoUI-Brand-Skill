# Attempt 10 Evidence — Pokémon TCG Pocket

## 结论

TCG Live 后的第一个完整高显著度区块是 **Pokémon Trading Card Game Pocket**，对应 `article.tcg-pocket`。它不是 Championship Series；后者在此 ARTICLE 完整结束后才开始，未纳入本轮。

Evidence 状态为 **PASS_WITH_WARNINGS**：区块身份、桌面与手机构图、响应式重排、文字、CTA、资产身份均已冻结；入场动效只确认了隐藏端点与最终端点，没有拿到可信的连续中间帧，因此 duration / easing / stagger 保持 `UNRESOLVED`。

## Screenshot-first 发现

- Desktop 1440：476.2px 高通栏区块，左右各 720px。左边是浅蓝 Pocket 品牌背景和一张独立的 `logo-cards.png` 组合资产；右边是纯黑内容区，顺序为标题、段落、白色 CTA。
- Mobile 390：变为上下堆叠，资产区先出现，黑色内容面板随后出现；不是把 PC 版整体等比缩小。
- 手机使用独立背景 `header_bg-small.jpg`，不是桌面 `background.jpg` 的随意裁切。
- 没有 kicker、第二按钮、卡片轮播或额外装饰标题。

## 冻结尺寸

| 项目 | Desktop 1440 | Mobile 390 |
| --- | --- | --- |
| Section | 1440 × 476.195 | 390 × 743.023 |
| Asset | 700 × 428.4 | 370 × 226.44 |
| Copy panel | 720 × 357，黑色 | 390 × 408.79，黑色 |
| H2 | Kanit italic 700，40/44 | Kanit italic 700，28/30.8，两行 |
| Body | PT Sans 18/28.8 | PT Sans 18/28.8 |
| CTA | 56px 高，20/24 | 51.297px 高，18/22.5 |

## 资产

1. `https://tcg.pokemon.com/assets/img/home/tcg-pocket/background.jpg` — desktop full-bleed 背景。
2. `https://tcg.pokemon.com/assets/img/home/tcg-pocket/header_bg-small.jpg` — mobile 专用背景。
3. `https://tcg.pokemon.com/assets/img/home/tcg-pocket/en-us/logo-cards.png` — 独立透明的 Logo + 卡牌组合资产。

## CTA

`Play Now` 指向 `https://tcgpocket.pokemon.com/en-us`。默认前景为黑色，hover 后文字和箭头变为金色 `rgb(226, 186, 101)`；白色 `.button__bg` 不变。

## Motion 边界

DOM/computed 观察到：资产从 `opacity:0 + translateY(-214.199px)` 开始，标题和段落从右侧隐藏，最终均为 `opacity:1 + identity transform`。但本次 viewport controller 没有稳定输出可验证的中间帧，所以后续 Interpreter / Demo 不得自行宣称精确复刻时长、缓动或 stagger。

## 证据注意事项

- canonical mobile 截图已重新从英文 `en-us` DOM 捕获。
- 手机截图左上角小红色中文浮层来自浏览器扩展，不属于官网，严禁复刻。
- `captures/tcg-pocket-mobile-390-settled-browser-translated.png` 仅保留为诊断记录，不可用于英文 copy fidelity。

## Handoff

可交给 Brand Interpreter。Interpreter 应把本区块定义为“数字产品跨站推广带”：保留通栏边界、桌面 50/50 与手机纵向重排、响应式背景身份、黑白对比和 CTA hover；动效 timing 继续标为 unresolved。
