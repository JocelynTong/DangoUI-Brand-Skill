# Pokémon TCG Official — Pocket Brand Interpretation

## Verdict

`PASS_WITH_CONSTRAINTS`，可交给 Design Director 决策。本轮只读取了 Attempt 10 Evidence；没有读取 Demo、实现理由或旧 QA 结论。

Evidence 足够冻结区块边界、桌面/手机构图、响应式资产身份、文案层级、CTA 状态和外链语义。入场动效只看到 hidden 与 settled 两个端点，没有可信中间帧，因此不能宣称学会了完整动效。

## 最窄视觉意图

这是一个 **Pocket 数字产品的跨站推广带**，不是全站通用模板：

- Desktop 用 50/50 横向构图，让左侧产品识别资产与右侧解释/行动获得同等空间。
- Mobile 不缩小 PC 布局，而是换成专用 `header_bg-small.jpg`，并重排为 asset-first / copy-second。
- `logo-cards.png` 是一张独立透明的 Logo＋卡牌组合资产，是主要识别物；它不是区块截图，也不应被拆成臆造的可交互卡牌。
- 黑色面板只承担本区块的标题、正文与唯一 CTA，对浅蓝资产场形成清晰的阅读终点。
- CTA 是前往独立 Pocket 官网的外链，不是站内跳转或无行为的展示按钮。

## 构图与响应式合同

Desktop 1440：区块约 `1440×476.195`，左右各 `720px`。左边是 Pocket 资产场，右边是纯黑 copy panel，阅读顺序为标题、段落、Play Now。

Mobile 390：区块约 `390×743.023`。上方 `334.23px` 资产场使用手机专用背景，下方 `408.79px` 黑色面板全宽承载文案与 CTA。资产约 `370×226.44`，左右各留 `10px`。

这只是 Pocket section 的响应式翻译，禁止泛化为：

- 全站所有推广区都做 Desktop 50/50；
- 所有手机区块都 asset-first / copy-second；
- 所有手机背景都必须换专用图；
- 所有内容面板都使用全宽黑底。

## 资产职责

| 资产 | 职责 | 禁止扩张 |
| --- | --- | --- |
| `background.jpg` | Pocket desktop 资产场背景 | 全站背景、mobile fallback |
| `header_bg-small.jpg` | Pocket mobile 专用资产场背景 | 全站 mobile header 或通用 breakpoint 规则 |
| `en-us/logo-cards.png` | Pocket Logo＋卡牌的主要透明组合资产 | 官网截图替代物、通用装饰、臆造的独立交互卡牌 |

## 字体与 CTA

- H2：Kanit italic 700；Desktop `40/44`，Mobile `28/30.8`，手机自然换成两行。
- Body：PT Sans `18/28.8`，保持居中。
- CTA：PT Sans italic 700；Desktop `20/24`、约 56px 高，Mobile `18/22.5`、约 `174.086×51.297`。
- CTA 静止态为白底黑字/箭头；hover 只把前景改为金色 `rgb(226,186,101)`，白底不变。
- CTA 目标为 `https://tcgpocket.pokemon.com/en-us`，必须保留真实外链语义。

这些字号、字体职责、白色 CTA 与金色 hover 都是 section-local，不构成全站 typography 或 interaction token。

## Motion 边界

可以确认的只有：

- hidden：资产 `opacity:0 + translateY(-214.199px)`；标题/正文 `opacity:0 + translateX(328px)`；CTA `opacity:0 + translateX(94.98px)`；
- settled：所有相关层 `opacity:1` 且 transform 为 identity。

不可确认、必须继续标记为 `UNRESOLVED`：

- 中间帧；
- duration；
- easing；
- stagger；
- 各层先后顺序。

下游不能据两个端点插值并宣称“精确还原”。Design Director 可以选择不实现该 reveal；也可以批准一个明确不参与 fidelity 评分的非精确过渡，但不能把它写成官网已学规律。

## 污染与 mustNotInvent

手机截图左上角的小红色中文浮层来自浏览器扩展，不属于官网。它必须进入 `mustNotInvent`，不得成为装饰、badge、状态或品牌红色依据。

同样不得新增 kicker、第二 CTA、轮播、卡牌 tilt/flip、圆角外壳，或把后续 Championship Series 内容并入 Pocket section。

## Design Director handoff

可以进入方向评审，但方向必须冻结：

1. 1440 和 390 两个 proof surface；
2. Desktop 50/50 asset-left/copy-right；
3. Mobile 专用背景及 asset-first/copy-second；
4. 三个独立 source asset identity；
5. Kanit/PT Sans 层级与单一真实外链 CTA；
6. 黑到金的 CTA 前景 hover；
7. 精确 motion 持续 `UNRESOLVED`；
8. 红色浏览器浮层和所有全站泛化均明确拒绝。

机器可读结果见 `brand-intent.json` 与 `pattern-inventory.json`。
