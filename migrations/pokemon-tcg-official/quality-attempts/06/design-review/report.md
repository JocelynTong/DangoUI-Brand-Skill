# Attempt 06 — Design Director Hero Review

## Verdict

**FAIL / BLOCKED：Compact Hero 的尺寸与核心构图已经成立，但轮播仍是假交互，移动导航与官网证据仍有明显结构偏差。**

本轮只审查 `pokemon-tcg-official` Home compact Hero，没有修改实现。判断依据包括：

- 官网移动端截图 `captures/source/home/mobile-390/frames/000.png`
- 官网轮播 action evidence：`action-evidence/home-carousel-{default,triggered,settled}.png`
- 当前 Demo `http://127.0.0.1:5177/#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`
- 当前 390×844 实机 DOM / computed geometry 与交互探针
- Attempt 05 compact Hero 截图与 QA 报告

## 设计负责人结论

### 已经成立的部分

- 第一眼层级基本成立：官方黑色导航、动态背景、Campaign Logo、立体卡牌和金边 CTA 能形成 Pokémon campaign 的识别度。
- Hero 在当前手机 proof surface 中约 `416px` 高，满足“最多约半屏”的方向；下一 Section 在首屏内露出。
- Logo、Campaign Logo、卡牌与 CTA 没有互相覆盖。
- 卡牌翻转是可见、可逆且不引起布局跳动的有效交互，可保留。
- 背景裁切把 Pikachu 保留在视觉中心，紧凑化没有破坏主角色识别。

### 必须返工的部分

#### P0 — `CAROUSEL_CONTENT_STATE_NOT_DISTINCT`

**可见证据**

- 点击 `Show campaign 2` 后 active class 从第一个 control 移到第二个 control。
- 但 Hero 背景、`Logo-30th.png`、`2M6P_EN_23.png`、CTA 文案及卡牌构图全部不变。
- 等待 700ms 后仍无视觉 transition；用户只能看到约 `24×6px` 的短条状态变化。

这不是一个成立的轮播。上一轮 QA 的“`0 → 1 → 0` 且非空”只验证了状态变量，不足以证明用户可见的 campaign change。

**最早责任节点**：`Brand Researcher / Evidence`。现有证据只证明官网存在轮播控制和按压反馈，没有冻结第二套可用 campaign 的背景、标题资产、前景主体、CTA 和状态变化。若无法获得第二套官方证据，Design Director 必须明确批准一套 `held-out fictional campaign`，并标注为生成性证明，禁止伪称官方内容。

**后续责任节点**：`Demo Implementation Agent`。必须让 slide 1/2 至少在背景、Campaign Logo/标题、前景主体或卡牌、CTA 中的多个高显著度元素真正变化，并提供 default / transition / settled 三帧。不能只换 index、色条或 class。

**推荐修法**

1. Evidence 先补一套有 provenance 的第二 campaign；若官网证据不可得，则由 Director 批准一套明显不同的 held-out campaign。
2. 每一 slide 使用独立数据对象，冻结 `background`, `campaignMark`, `featuredSubject/card`, `cta`, `accessibleLabel`, `provenance`。
3. 使用短促 cross-fade / directional slide，过渡中不能出现空白；reduced-motion 下直接切换。
4. QA 用截图 hash、关键 asset src 和可见文本同时验证差异，不能只看 active index。

#### P1 — `MOBILE_NAV_SOURCE_STRUCTURE_DRIFT`

**可见证据**

- 官网移动证据是一个完整的约 `56px` 黑色 cap：左侧品牌 Logo，右侧 `MENU` 与独立三横 hamburger，留白充足。
- 当前本地窄屏实测导航约 `38px` 高；Logo 约 `70×25px`，导航显得过薄、贴边且更像缩小版工具条。
- 当前 hamburger 使用文本 glyph `☰`，线条、间距和对齐无法稳定复现官网三条横线图形。
- 旧 Attempt 05 截图仍曾显示桌面链接挤进手机导航，说明该区域缺少以官网 mobile header 为独立 recipe 的稳定实现。

**最早责任节点**：`Brand Interpreter / Design Director`。响应式方向只冻结了“避免重叠”，没有把官网 mobile cap 的高度、左右结构、Logo 尺寸、MENU/hamburger 关系定义成必须保留的高显著度模式。

**后续责任节点**：`Demo Implementation Agent`。

**推荐修法**

- 将 mobile header 做成独立 recipe，而不是桌面导航的压缩态：`height: 56px`，Logo 左对齐，右侧 `MENU + CSS/SVG hamburger`。
- hamburger 使用三条独立线，约 24px 宽，并保留 44px 最小交互命中区。
- 桌面链接在 compact 模式必须 `display:none` 且退出 hit testing；同时验证 351/390/430 三档。

#### P1 — `CAROUSEL_CONTROL_HIT_TARGET_TOO_SMALL`

**可见证据**

- 当前两个 slide control 的可见与实际测量尺寸均约 `24×6px`。
- 它们虽然能点击，但远低于移动端舒适命中区，两个控制之间也只有约 8px 间距。

**最早责任节点**：`Demo Implementation Agent`。

**推荐修法**：保留 24×6 的视觉短条，但用伪元素或透明 padding 将实际按钮扩展到至少 `44×44px`；不得让扩展命中区覆盖卡牌或 CTA。

#### P1 — `CAROUSEL_TRANSITION_PROOF_MISSING`

**可见证据**

- 官网 action evidence 记录了 next arrow 的 pressed/highlight 状态，但现有证据没有证明 source 内容切换过程。
- 当前 Demo 点击后等待 700ms，所有高显著度资产与文本仍相同，也没有可观察的 opacity/transform 变化。

**最早责任节点**：`Brand Researcher / Evidence`。

**推荐修法**：为 source 与 demo 都记录 `default → triggered → mid-transition → settled → restored`。若官网 carousel 不再提供第二 slide，报告必须明确其历史/当前证据边界，Demo 的第二状态只能作为 held-out，不得贴 official 标签。

### 非阻断改进

#### P2 — `HERO_TO_NEXT_SECTION_SEAM_ABRUPT`

Hero 末尾黑色背景直接切入白色 News Section，虽然满足“露出下一 Section”，但接缝比官网的黑色 carousel label/control rail 更突然。可增加一个很短的黑色 bottom rail 或保留更明确的 carousel footer 来完成视觉收口，前提是不突破半屏边界。

**最早责任节点**：`Design Director`；实现 owner 为 `Demo Implementation Agent`。

#### P2 — `CAMPAIGN_COPY_AND_ASSET_PROVENANCE_NEEDS_VISIBLE_LABEL`

当前 `DISCOVER THE CELEBRATION` 与官方 30th 资产可被理解为 source-derived adaptation；一旦补第二套生成性 campaign，Inspector/QA 必须直接显示 `official source` 或 `held-out fictional`，避免视觉上混淆出处。

**最早责任节点**：`Design Director / Methodology Keeper`。

## 完整 Hero 检查表

| 检查项 | 结果 | 优先级 | 结论 |
|---|---|---:|---|
| 第一眼层级 | PASS | — | 背景、Campaign Mark、卡牌、CTA 的主次清楚 |
| 移动导航 | FAIL | P1 | 结构方向接近，但 56px cap、hamburger 与留白未还原 |
| 背景裁切 | PASS | — | Pikachu 主体完整，紧凑裁切有效 |
| 品牌 Logo | PASS with warning | P2 | 可见但随过薄导航被压缩 |
| Campaign Logo | PASS | — | 清晰且不与 CTA/卡牌重叠 |
| Flip card | PASS | — | 可逆、稳定，是有效的品牌交互 |
| CTA | PASS | — | 约 44px 高，金边与箭头可读 |
| Carousel 内容状态 | FAIL | P0 | 只变 index，不换 campaign 内容 |
| Carousel 过渡 | FAIL | P1 | 没有用户可感知的内容 transition |
| Carousel 命中区 | FAIL | P1 | 约 24×6px |
| 半屏边界 | PASS | — | Hero 约 416px |
| 下一 Section 露出 | PASS | — | 首屏能够看到 News 起点 |
| Section 接缝 | WARN | P2 | 黑到白的收口略生硬 |
| 可读性 | PASS | — | 关键 Logo、卡牌、CTA 均可辨认 |

## 路由与放行条件

本轮不能由 Design Director 签字通过。按最早失败节点处理：

1. **Evidence**：补齐或明确否定第二套官方 campaign 证据；产出可用资产/状态和 provenance。
2. **Design Director**：若官方第二状态不可得，批准一套 held-out campaign，并明确允许变化和不可伪称官方。
3. **Implementation**：实现真正不同的两套 slide、过渡、44px 命中区和 56px mobile nav cap。
4. **新 Blind QA**：独立验证两套 slide 的视觉差异、过渡中间态、恢复态、导航三档宽度及卡牌翻转无回归。

只有用户不再需要猜测“轮播到底有没有动”，并且导航第一眼与官网移动 cap 对得上，Hero 才能进入下一 Section。
