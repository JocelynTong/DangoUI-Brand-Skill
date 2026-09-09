# Atomic Acceptance Rubric

这个验收口径用于解释 `/brand` 的完成度，避免把“能跑通”“学会品牌”和“宿主可用”混成同一件事。

## Learn-brand：三证先于 Atomic Apply

Atomic Design 的 P0/P1/P2 主要验收 `apply-host`。在进入宿主应用前，learn-brand Demo 必须先通过三证：

- `Evidence Proof`：高显著度模式均有可定位证据，且 token/asset/motion 没有跨语义扩张。
- `Structure Proof`：reference calibration 页面保留决定性的构图、层级、密度和浏览节奏。
- `Generative Proof`：规则冻结后，在 held-out challenge 上生成新的同类页面；禁止官网截图作为 runtime、固定模板换 Logo/颜色或只换官方素材。

Reference calibration 负责“校准得对”，held-out challenge 负责“没有背答案”。三证任一 blocked，learn-brand 都未完成，不能进入“已学会”表述。宿主 apply 独立启动、独立验收，不用宿主页面反向掩盖 Demo 学习失败。

## 分层定义

- `atoms`：最小视觉变量。颜色、字体、字号、圆角、边框、阴影、间距、背景纹理、透明度。
- `molecules`：由 atoms 组成的基础控件。按钮、tab、筛选 chip、输入框、标签、卡片基础态、选中态、hover/press。
- `organisms`：由 molecules 组成的业务模块。Header、搜索筛选区、卡组卡片、详情弹窗、赛事列表、价格信息区、发布器表单块。
- `templates`：页面骨架和区块编排。首页、详情页、广场页、我的页、活动页、发布页的布局结构、滚动容器、导航位置。
- `pages`：带真实业务内容、品牌资产和状态的最终页面实例。

`brand assets` 是跨层能力，不是单独层级：logo、卡背、角色、产品图、纹理、角框、光效可按证据挂到不同层。`showcase moment` 也是跨层能力，通常只允许出现在 `organisms/templates/pages`，例如 hero、卡片翻转、shine、大媒体和沉浸式模块。

## P0: Safe Brand Application

P0 证明品牌语言可以安全进入宿主项目。

必须满足：

- 宿主原路由、数据、文案、业务逻辑和核心交互保留。
- 至少覆盖 `atoms + molecules`：颜色、字体/字重、圆角、边框/阴影、按钮/tab/筛选/选中态。
- 目标页面的真实 dev 预览可访问，不只提供静态截图或 demo 站。
- computed style 能证明关键 selector 生效。
- 没有把不适合的强视觉塞进工具页、表单页或密集列表页。

P0 可以说：

> 已完成保守但可运行的业务换肤，证明品牌视觉能安全覆盖宿主核心页面。

P0 不能说：

> 已完整还原官网视觉，或已经具备 C 端强视觉体验。

## P1: Expressive Brand Moment

P1 证明品牌语言不仅能安全覆盖，还能在合适业务位置产生 C 端感知。

必须满足：

- 至少一个 `medium/high` 承载页面或区块使用了 `organisms/templates/pages` 层表达。
- 强视觉有业务目的，例如活动参与、奖励展示、卡片查看、专题介绍、品牌入口。
- 使用真实品牌资产或从 evidence 抽象出的纹理、frame、动效，不靠随手装饰。
- 动效必须有 interaction contract：触发、起点、终点、中间态、关闭/回退、滚动/滑动行为。
- 浏览器验收能看到该强视觉没有破坏可读性和核心任务。

P1 可以说：

> 已找到一个合适的强视觉落点，能向产品/开发展示该品牌在业务中的 C 端表达方式。

## P2: Reusable Skill Capability

P2 证明这次不是一次手搓，而是沉淀成下一次可复用的能力。

必须满足：

- 页面分型、承载力、allowedLayers、showcaseFit 和风险说明写入 `visualPlacementPolicy` 或等价结构。
- 关键映射来自 evidence -> token/recipe -> selector/component -> computed style 链路。
- 新增能力有 gate 或脚本检查，而不是只写在 Markdown。
- 对不适合强视觉的页面能自动降级并说明原因。
- 对缺少高承载页面的项目，能生成活动页/专题页 mock 供产品讨论，而不是污染现有业务页。

P2 可以说：

> 这次应用经验已经变成 skill 可复用规则，后续品牌和宿主项目能按同一套判断继续跑。

## 对外解释

推荐用三句话表达：

1. `/brand` 先用 Evidence / Structure / Generative 三证证明学会品牌视觉语言，而不是复刻截图或套素材模板。
2. 学习通过后，`apply-host` 再按 Atomic Design 和页面承载力独立映射；工具效率页安全换肤，活动/专题/详情页才承接强视觉。
3. 宿主验收分 P0/P1/P2：先证明能安全跑通，再证明有 C 端表达，最后沉淀成可复用能力。
