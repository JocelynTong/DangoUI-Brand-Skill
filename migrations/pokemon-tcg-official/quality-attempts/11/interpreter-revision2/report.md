# Attempt 11 Interpreter Revision 2

## 结论

**PASS**。Blind QA r2 的最早失败点已在 Brand Interpreter 层补齐。本次只修订 Pokémon Championship Series section 的桌面排版语义与 CTA 构造事实；390px 已批准规则及其余 patterns 保持不变，未读取或修改 Demo、Direction。

## 新增的桌面 source-CSS 事实

桌面 1440 source-calibration endpoint 的角色尺寸冻结为：

- h2：Kanit 700 italic uppercase，`48px`，`line-height: 1.1`。
- body：PT Sans 400，`18px / 28.8px`。
- CTA：PT Sans 700 italic，`18px / 22.5px`。

准确来源是冻结的 `../evidence/captures/assets/global.css` 第 6 行：

- h2：`@media only screen and (min-width:64em) { h2,.h2 { font-size:calc(48rem / var(--font-base)) } }`，并由 heading 共用规则提供 Kanit / 700 / italic / 1.1。
- body：`:root --font-base:18`、`html font-size:calc(var(--font-base) * 1px)` 与 `p,.p { font-size:inherit }`。
- CTA：`.button { font-size:calc(18rem / var(--font-base)); font-family:var(--font-body); font-weight:var(--font-bold); font-style:italic; line-height:1.25 }`。

冻结桌面可见端点为 `../evidence/captures/desktop/championship-series-settled-region-1440x720.png`。这些是 type-role 与 CSS value 事实，不是 h2、paragraph、CTA 的矩形事实。

## CTA 构造事实

- `2px` inset frame：`.button__bg::after { box-shadow: inset 0 0 0 2px var(--button-bg) }`。
- Frozen shadow：`.button { box-shadow: 0 16px 24px -16px rgba(0,0,0,0.35) }`。
- 状态规则不变：default 黑底；hover 金色铺满；focus 黑底并保留可见 outline。

frame 与 shadow 是该 CTA recipe 的强制组成，不能省略或换成“近似”阴影，也不能扩成全局按钮规则。

## 保持不变

- 390px h2 `32/32.5`、body `18/28.8`、CTA `18/22.5`。
- 390px h2/body/CTA 的 section-local y：`414 / 519.5 / 737.078`。
- 1440 split、390 image-first stack、透明节点与白色 canvas ownership。
- 390px `src` 指向 1x、live `currentSrc` 选中 2x 的资产事实。
- CTA default / hover / focus / destination 状态边界。
- 其他 approved patterns 的 scope、用途、禁用范围与变换边界。

## 仍未决但不阻塞

- 桌面 h2、paragraph、CTA 的精确 bounding boxes。已知 source-CSS 字号不等于已知 bbox。
- 精确响应式 layout breakpoint。
- 桌面 focus outline 的精确 computed 值；390 已冻结。
- Dembrandt score。

下游必须消费桌面 `48/18/18`、390 原冻结规则、CTA 2px inset frame 与 frozen shadow；不得把上述 unresolved 项补写成官网事实。
