# Attempt 11 Brand Interpreter — Pokémon Championship Series

## 结论

**PASS**。官网首页的 Pokémon Championship Series 区块已经被解释成可下发的 section-local 视觉规则；没有把单区块状态扩成全局品牌规则，也没有从官方图片补取未观察的配色。下游可消费 `brand-intent.json` 中的 approved patterns、composition contracts、tokens、recipes 与资产规则。

## 视觉意图

该区块不是“蓝色 Pokémon 风格卡片”，而是一个由两部分等权组成的赛事入口：白色页面画布上的克制说明区，与完整的官方正方形赛事图像。赛事身份主要由准确的官方图像承担；区块外部 UI 只使用已观察的白、近黑与 CTA hover 金色。

桌面 1440 端点为 1440×720 的 50/50 结构：内容在左，官方图像在右。区块、row、两列及内容盒均透明，白色属于页面 canvas，不能给左右列另加白底。移动 390 端点改成 image-first block：390×390 图像在前，374×439.172 内容在后，阅读顺序为图像 → 标题 → 正文 → Learn more。

## CTA 状态

- Default：近黑底、白字/白箭头。
- Hover：金色 `#E2BA65` 从中心横向铺满，文字与箭头转近黑；`0.2s ease-in-out` 只来自冻结 CSS 规则，不是从连续帧推算。
- Focus：继续保持近黑底，并显示 outline。390 端点冻结为 `rgb(0,95,204) auto 1px`；禁止把 focus 做成金色 hover。
- Activated：跳转并落到 `https://championships.pokemon.com/en-us/`。

这些颜色只服务于该 CTA recipe。hover 金不能扩成 section 背景、标题强调或全局 primary；focus 蓝不能扩成装饰色或品牌色。

## 官方资产规则

Source calibration 必须使用冻结的 Championship Series 正方形图像：

- 1x：`championships.jpg`，696×696，SHA-256 `0f7fb0ab417f1b2076343573a676b71629722e30e252147f11f4ef3966eb918d`
- 2x：`championships-2x.jpg`，1392×1392，SHA-256 `862a5f138e77cb6e0a8fdb44538a19d9ddfa3d60328b2113b6ae48f8000895db`

390px 实况中 `src` 声明 1x，但浏览器 `currentSrc` 选中 2x；实现与 QA 必须同时记录 `src`、`srcset`、live `currentSrc`，不能只看 `src`。不得换成另一张官方图，不得裁掉已冻结的 1:1 构图，不得把 Evidence 截图或截图 crop 当 runtime asset，也不得从图像蓝色、橙色等像素提取 UI token。

## 响应式与生成边界

冻结事实只有 1440 与 390 两个端点，未冻结精确 breakpoint。任何中间断点都只能标为实现决策，不能冒充官网事实。官网自身的 desktop-to-mobile reflow 也不能算 held-out generative proof。

独立 fictional fixture 可以改变虚构内容或内部安排，但必须继续保持：一个正方形 principal-media role、透明节点覆盖白色 canvas、heading/body/single-CTA 层级，以及 default 黑 / hover 金 / focus 黑加 outline 的状态分离。不同官方 Pokémon 图不能被当作已批准的 held-out 资产。

## 未决项

- 桌面 heading、paragraph、CTA 的精确子元素 bbox 未独立冻结；只批准桌面内容盒与可见层级。
- 精确响应式切换 breakpoint 未冻结。
- 桌面 focus endpoint 已有截图，但 outline 的精确 computed 值只在 390 端点独立记录。
- Dembrandt 本轮不可用，不能声称相似度分数或阈值结果。

以上均为非阻塞项；不得在实现中补写成官网事实。
