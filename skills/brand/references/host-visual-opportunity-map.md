# Host Visual Opportunity Map

这个模板用于 `/brand apply-host` 前的宿主页面统计。目标不是证明每个页面都能做成 C 端活动页，而是先判断每个真实业务页面的视觉承载力，再决定品牌语言应该落在哪一层。

## 统计口径

按页面而不是按小程序统计。一个小程序至少选 2-3 个代表页面：默认首页、最高频业务页、最适合品牌展示的页面。如果项目有活动页、专题页、详情页、空状态或 onboarding，需要优先纳入，因为它们通常比列表/表单更能承接 C 端视觉。

每个页面至少记录：

| 字段 | 说明 |
| --- | --- |
| appName | 小程序或宿主项目名 |
| route | 页面路由或可识别入口 |
| screenshot | 截图文件或验收链接 |
| businessJob | 用户到这个页面要完成什么事 |
| pageType | `tool-efficiency` / `content-consumption` / `campaign-showcase` / `creator-publish` / `profile-center` / `hybrid` |
| visualCapacity | `low` / `medium` / `high` |
| allowedLayers | 可落地的 Atomic Design 层：`atoms` / `molecules` / `organisms` / `templates` / `pages` |
| brandAssetSlots | 页面里天然可放品牌资产的位置，例如封面、榜单头图、详情大图、活动 banner、空状态 |
| motionSlots | 动效可以服务业务的位置，例如卡片查看、tab 切换、奖励展示、加载反馈 |
| showcaseFit | 是否适合强视觉：`none` / `contained` / `primary` |
| riskIfOverApplied | 强塞视觉会破坏什么，例如效率、可读性、表单完成率、信息密度 |
| recommendation | 建议采用的落地方式 |

## 页面类型

- `tool-efficiency`：计算器、筛选器、管理表单、发布器、后台式列表。默认只允许 `atoms + molecules`，除非有明确活动入口。
- `content-consumption`：资讯、攻略、图鉴、卡组详情、榜单。允许 `atoms + molecules + organisms`，可在头图、卡片、详情弹窗使用资产和轻动效。
- `campaign-showcase`：活动页、专题页、测试页、抽奖页、奖励页。允许 `templates + pages` 层的强视觉，是首选 showcase 承载面。
- `creator-publish`：发布、编辑、上传、配置页。以效率和稳定为主，强视觉只用于状态提示、封面预览或提交成功反馈。
- `profile-center`：我的、收藏、订单、资产页。适合氛围和身份感，但不宜遮挡核心资产/操作。
- `hybrid`：同时承担浏览和操作的页面，需要按区块拆开判断。

## 承载力判断

`low`：

- 首屏以输入、筛选、表单、密集列表或业务状态为主。
- 用户目标是快速完成任务。
- 品牌视觉只能改善质感，不能改变页面结构。
- 推荐 `atoms + molecules`，最多加少量 `organisms` 装饰。

`medium`：

- 页面有卡片、封面、详情、榜单、模块头部或空状态。
- 用户有浏览和停留场景。
- 可以在业务模块里加入品牌资产、边框、纹理、轻动效。
- 推荐 `atoms + molecules + organisms`。

`high`：

- 页面本来就是活动、专题、首屏宣传、奖励、商品陈列或内容展示。
- 强视觉能帮助用户理解活动主题或提升参与欲望。
- 推荐 `templates + pages`，允许 hero、沉浸背景、翻转、shine、自动播放等 showcase。

## Atomic Design 落地层

- `atoms`：颜色、字体、字号、间距、圆角、边框、阴影、纹理、透明度。
- `molecules`：按钮、tab、筛选 chip、输入框、标签、基础卡片、选中态、hover/press。
- `organisms`：搜索筛选区、详情弹窗、卡组卡片、赛事列表、发布器表单块、价格信息区。
- `templates`：页面骨架、区块顺序、滚动容器、导航位置、信息密度。
- `pages`：带真实业务内容和品牌资产的最终页面实例，通常用于活动页、专题页或高承载首屏。

`brand assets` 和 `showcase moment` 不是独立层级，而是可挂载能力：资产可以进入任何层；强动效和沉浸表达通常只能进入 `organisms/templates/pages`。

## 输出示例

```json
{
  "route": "/pages/plaza/index",
  "businessJob": "浏览卡组、筛选内容、进入详情或赛事",
  "pageType": "content-consumption",
  "visualCapacity": "medium",
  "allowedLayers": ["atoms", "molecules", "organisms"],
  "brandAssetSlots": ["season banner", "card image frame", "empty state"],
  "motionSlots": ["card image preview", "selected tab"],
  "showcaseFit": "contained",
  "riskIfOverApplied": "强 hero 会压缩搜索、筛选和卡组浏览效率",
  "recommendation": "保留原业务结构；做黑色纹理舞台、胶囊选中态、卡片 frame 和详情图翻转；如需更强 C 端效果，另建赛季活动页。"
}
```

## 使用规则

`/brand apply-host` 在改宿主代码前必须先产出 visual opportunity map 或等价的 `visualPlacementPolicy`。如果所有目标页都是 `low`，不能为了展示能力硬塞 hero 或复杂动效；应降级为安全换肤，并额外给一个活动页/专题页 mock 作为产品讨论材料。
