# Pokémon TCG 首页 Hero — Evidence correction

结论：**PASS**。官网的手机 Hero 不是桌面 Hero 等比缩小，而是明确的 **art-directed responsive composition**。

## 已核验事实

| 检查项 | 结论 | 官网证据 |
| --- | --- | --- |
| 响应资源切换 | PASS（纠正旧表述） | `picture > source media="(min-width: 64em)"`。DPR 1 桌面实际 `currentSrc` 为 `booster-art-1-large-up.jpg`；390px 为 `booster-art-1.jpg`。`large-up-2x.jpg` 只是桌面 2x 候选，本轮没有加载它。 |
| Hero 几何 | PASS | 桌面 `.featured-switcher` = `1440 × 710.242px`；390px = `390 × 1182.656px`。宽度缩至 27.08%，高度反而增至 166.52%，排除统一等比缩放。 |
| 背景裁切 | PASS | 手机背景盒 `429 × 682px`，x=`-19.5px`；computed `object-fit: cover`、`object-position: 50% 100%`，并换成 1024×760 的手机候选。 |
| Logo / card / CTA / controls 独立重排 | PASS | 它们是独立 DOM 元素。手机端 CTA 位于 y=`1133.156px`；左右按钮分别固定在 x=`0/334px`；桌面宽文本 carousel control 在手机端尺寸为 `0 × 0`。截图显示纵向阅读顺序。 |

## 可肉眼复核

- 桌面：`output/visual-qa/pokemon-tcg-official-home-hero/evidence/source/desktop/frames/desktop-default.png`
- 390px：`output/visual-qa/pokemon-tcg-official-home-hero/evidence/source/mobile-390/frames/mobile-default.png`

> 上述截图是本地 QA 产物，未纳入版本库；路径仅用于追溯当次验证。

桌面是一块约 710px 高的横向舞台：Logo/CTA 在左，角色居中，卡片在右，底部是横向文字控制。手机则变成约 1183px 高的纵向舞台：背景被重新裁切，Logo、卡片和 CTA 分段向下排，左右箭头承担切换。因此后续方向不能再使用“整块桌面 Hero 等比缩小”作为官网还原策略。

## Evidence 边界

- 本轮只读官网和既有 source capture / asset inventory，没有查看或修改 Demo 实现。
- 已证明 1x 桌面与 1x 手机的实际 `currentSrc`。若必须声明高 DPR 桌面实际加载 `large-up-2x.jpg`，需要另做 DPR 2 浏览器观测；当前只能把它记录为 `srcset` 候选。
- 本轮不判断 Demo 应如何实现；响应策略决策属于 Design Director，具体实现属于 Demo Agent。
