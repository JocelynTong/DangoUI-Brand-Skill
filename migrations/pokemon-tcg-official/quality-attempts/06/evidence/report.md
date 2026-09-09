# Attempt 06 — Pokémon TCG Hero/Header Source Evidence

## Verdict

`NEEDS_EVIDENCE_FOR_SECOND_OFFICIAL`

当前官网首页只证明了 **1 套官方 Campaign：Pokémon TCG: 30th Celebration**。DOM 中确实存在 `Pikachu / Mew ex / Pikachu ex / Mewtwo ex` 四个选择项，但它们的 `data-card-id` 表明这是同一 Campaign 内的卡片状态，不是四套独立 Campaign。

因此下游不能把“第二个 dot / 第二个 index”解释成第二套官方 Campaign，也不能自行编造官网第二套内容。若需要验证生成能力，只能由 Design Director 明确批准一个 **held-out generative state**，并在页面和产物中标注“非官方 Campaign / 仅用于生成能力验证”。

## Screenshot-first 观察

- 手机视口：`390 × 844`。
- 源站导航：黑色顶栏，高 `56px`。
- 左侧 Logo：约 `77.98 × 39.93px`，距左 `23px`。
- 右侧是一个真实 `Menu` button，约 `66 × 56px`；文字旁不是字符 `☰`，而是独立 `24 × 11px` 三横线结构。
- 三横线由 `.main-nav__toggler-icon::before`、内部 `span`、`::after` 组成，每条 `24 × 1px`，垂直位置约为 `0 / 5 / 10px`。
- 首屏可见的是单一 30th Celebration 背景、单一 Campaign Logo 与单一 expansion CTA。

同视口截图：

- [初始态](captures/source-mobile-initial-top.png)
- [点击 Next 后回到相同 scrollTop 的状态](captures/source-mobile-after-next-top.png)

## DOM / 代码反查后的边界

Hero 的 Campaign 身份没有发生分裂：

- Heading：`Pokémon TCG: 30th Celebration`
- Background：`booster-art-1.jpg`
- Logo：`Logo-30th.png`
- CTA destination：`/expansions/30th-celebration/`

四个 DOM 选项为：

| index | label | card id | Evidence interpretation |
| --- | --- | --- | --- |
| 0 | Pikachu | `2M6P_EN_23` | 同一 Campaign 的卡片状态 |
| 1 | Mew ex | `2M6P_EN_158` | 同一 Campaign 的卡片状态 |
| 2 | Pikachu ex | `2M6P_EN_53` | 同一 Campaign 的卡片状态 |
| 3 | Mewtwo ex | `2M6P_EN_157` | 同一 Campaign 的卡片状态 |

本轮对可见 `Next` 进行了真实触发，但 settled state 仍为 `Pikachu`，高显著性资产身份也未改变。因此本 Evidence 节点把“切换动效是否在当前源站可靠工作”标为 `unresolved`，不会仅凭 DOM 中存在四个节点就宣称动效已观察到。

## 给下游的明确输入

1. 官方 Source Fidelity：只能以 30th Celebration 这一套 Campaign 为准。
2. 若 Demo 保留 carousel，至少要做到用户可见的高显著性内容变化；只改变 dot、index 或 class 不算轮播。
3. 第二套若无新增官方证据，必须是 Design Director 批准的 held-out generative state，并清楚标注非官方。
4. 导航按 `56px 黑色 cap + 约 78×40 Logo + MENU + 独立三横线` 实现；不能用字符 `☰` 代替结构。

