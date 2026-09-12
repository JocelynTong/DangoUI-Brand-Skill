# DangoUI 更新清单

> 用于记录 demo / skill 验证过程中发现的 DangoUI 生产代码库后续需要新增、更新或统一口径的事项。

## 分类口径

- 待新增：当前 DangoUI 没有稳定组件、token 或 schema，需要补生产能力。
- 待更新：DangoUI 已有可承接能力，但命名、文档、API、示例或导出形态需要统一。
- 业务组件沉淀：当前更像业务模型，不一定进入 DangoUI 基础组件库，但需要明确可由哪些 DangoUI 原子组件组合。
- Token 基础能力：不是单个组件，而是影响所有风格迁移和生产代码落地的基础 token。

## 待新增

| 项目 | 类型 | 当前 demo 表达 | 需要 DangoUI 补什么 |
| --- | --- | --- | --- |
| PageLayout / Layout | 布局规范 / Token recipe | 通栏、卡片、双列、白底灰卡、灰底白卡、灰底拉通式 | 新增可复用页面布局 recipe，明确 bg、safe-area、gap、radius、content block、BottomBar/NavigationBar 占位规则 |
| HeroHeader | 组件 | 首屏主视觉、状态栏安全区、导航栏下方内容层、图片层/纹理层 | 新增首屏头图组件或页面模板规范，明确 Image、NavigationBar、安全区、遮罩、CTA 的组合 API |
| Grid | 组件 | 分发侧宫格入口 | 新增宫格入口组件，支持列数、图标/图片、标题、副标题、间距 |
| List | 组件 | 信息行、右侧箭头、状态说明 | 新增 List / ListItem，支持左侧图标、主副文案、右侧动作、分割线 |
| Time | 组件 | 时间展示、截止时间、倒计时 | 新增时间展示组件或格式化规范 |
| FAB | 组件 | 右下角发布/创建入口 | 新增 Floating Action Button，支持安全区、图标、主色、显隐场景 |
| TabBar | 组件 | 底部一级导航 | 新增底部导航组件，支持 home indicator、安全区、选中态 |
| BottomBar | 组件 | 底部固定操作栏 | 新增底部操作栏，支持主次按钮、安全区、通栏布局 |
| Menu | 组件 | 左侧/页面菜单 | 新增菜单组件，支持层级、选中、展开 |
| SegmentControl | 组件 | 分段控制 | 新增分段控制组件，区别于 Tabs |
| Tips | 组件 | 字段提示/辅助说明 | 新增轻量提示组件，或明确由 FormItem tips / Tooltip / NoticeBar 承接 |
| Spacing | Token / Recipe | token scale、safe-area、gap、padding、system inset | 新增 spacing token 结构和命名; demo「风格 / Spacing」作为当前视觉说明 |
| Radius | Token / Recipe | none、small、normal、medium、large、pill、circle | 新增 radius token 结构，并支持被风格化边框 / frame recipe 反向约束；demo「风格 / Radius」作为当前视觉说明 |
| Shadow | Token / Effect recipe | none、low、medium、inset line、brand glow | 新增 shadow token 结构和 effect recipe；demo「风格 / Shadow」区分 elevation、边界线和氛围光 |

## 待更新

| 项目 | 类型 | 当前 DangoUI 承接 | 需要更新的口径 |
| --- | --- | --- | --- |
| Stepper | 命名 / 文档 / API | `DuInputNumber` | demo 和运营叫 Stepper，但生产代码是 InputNumber；文档需要明确 Stepper = InputNumber 场景名，避免误判为待新增 |
| DateTimePicker | 命名 / 文档 / API | `DuCalendar showTimePicker` | 当前没有独立 DateTimePicker；需要文档说明日期时间选择由 Calendar + showTimePicker 承接，或决定是否新增别名组件 |
| Toast | 文档 / 示例 | `ToastProvider` / `useToast` | 当前不是独立可见组件；需要补面向运营和示例站的展示口径 |
| ShareSheet | 文档 / API | 可能由 ActionSheet / Popup 承接 | 需要确认生产库真实组件名、导出和示例 |
| ResultPage | 页面模板 | Empty / Icon / Button 组合 | 需要明确是否作为页面模板收敛，还是保持组合能力 |
| IconButton | 组合能力 | Button + Icon / slot | 需要在 Button 文档中补 icon-only、slot button、图片态 icon 的示例 |
| NavigationBar + Search | 组合能力 | `DuNavigationBar` + `DuSearch` | 文档需强调 slots -> props -> events -> 业务组合能力，尤其 left/default/right slot 的真实用法 |
| Popup | 文档 / 规则 | `DuPopup` | 文档需补 30% / 60% / 88% 高度建议、home indicator、安全区和 mockup 内裁切规则 |
| Cascader | 文档 / 组合 | `DuCascader` 内含 Search / Tabs / option row | 文档需说明内部组件关系，hover/检查时如何归因 |
| Select | 文档 / 组合 | `DuSelect` 内含 Radio 样式选项 | 文档需说明 option 行和 Radio 的关系，避免误以为 Select 弹层无子组件 |

## 业务组件沉淀

| 项目 | 当前判断 | 可用 DangoUI 原子能力 | 后续建议 |
| --- | --- | --- | --- |
| PriceStatistic | 业务展示组件 | Text / Tag / Card / Icon | 暂不进基础组件库，先沉淀为业务组件或模板 |
| Feed / SPU / Tag | 内容流和商品模型 | Image / Tag / Button / Card(Group) | 从业务仓库找真实组件；DangoUI 保持原子能力 |
| CharacterPanel | 游戏/内容档案面板 | Image / Tag / Button / Card(Group) | 不作为通用基础组件，沉淀为风格化业务模板 |
| DownloadPanel | 官网下载入口 | Button / Image / QRCode 组合 | 作为业务模板，不强行基础化 |
| QRCode | 业务展示能力 | Image / Text / Button | 看业务使用频率决定是否进入组件库 |

## Token 基础能力

| 项目 | 当前问题 | 后续 DangoUI 需要支持 |
| --- | --- | --- |
| 一级色板覆盖 | 参考站高频色需要映射到 DangoUI 一级色板，不是简单频次列表 | 支持原值、覆盖值、命中、推测的表达和导出 |
| 二级语义色板 | 二级色板要保留引用的一级色板名，再展示最终十六进制 | 输出格式统一为 `semantic-token · palette-token · #hex` |
| 三级组件色板 | 组件 token 要能追到二级语义色板和最终色值 | 输出格式统一为 `--du-xxx-token · semantic-token · palette-token · #hex` |
| 风格化边框 | 游戏站/剧本杀站常用 PNG、mask、角线替代普通 border | token / recipe 需要能记录“风格化边框替代普通 border” |
| Radius 与 Divider 联动 | 风格化边框会反向决定全站圆角 | radius token 需要跟 divider / border recipe 一起判断 |
| 素材资产 | 纹理、边框、字体、插画、选中态、装饰层需要本地存储 | style.json 需要同时保留原始 URL 和本地 asset path |

## Showcase 前优先级

1. 先保证已有 DangoUI 组件的命名和示例不误导：Stepper/InputNumber、DateTimePicker/Calendar、NavigationBar/Search。
2. 再补会影响 demo 可信度的新增项：HeroHeader、TabBar、FAB、Spacing、Radius、Shadow。
3. 业务组件暂不强行进入 DangoUI，先在 demo 里标清“业务组件沉淀”。

## 2026-06-17 增量

> 本节为继续维护区域:在调试 demo / 参考站过程中发现的事实型问题(非清单上的初始条目)。
> 维护原则:不与既有条目重复;若属于既有条目,标注"已合并到 X"并删除本节条目。

### 新增 · 跨组件展示规则(2026-06-15 决定 + 06-17 落地)

- [ ] **展示规则 1**:一组件 = 一独立 click-target(避免"补充组件"那种说明卡)
- [ ] **展示规则 2**:DangoUI 真实组件优先渲染(Rate/Button/Tabs/Tag 不能变成说明卡)
- [ ] **展示规则 3**:业务组件才 mock(其他一律走真实 dangoui)
- [ ] **展示规则 4**:不出现"补充组件"视觉语言
- [ ] **展示规则 5**:不额外包展示框
- [ ] **展示规则 6**:高度和间距稳定,矮组件不堆叠
- [ ] **展示规则 7**:左侧菜单 ↔ 右侧预览一一对应
- [ ] 落地状态:规则 2、3 部分应用;其余待 06-19 集中 review

### 新增 · Demo 初始化布局规则(2026-06-19 校准)

> 目标:运营/开发打开任意参考站或 DangoUI baseline 时,页面一开始就像真实小程序页面,不是组件堆叠清单。以下规则优先于品牌站临时 pageSpacing,除非源站有明确反证。

- [x] **Spacing token / recipe 候选(等待 DangoUI 研发更新)**:
  - checklist 只保留方向;详细 token 值、视觉示例、用途和表达规则在 demo「DangoUI baseline / 风格 / Spacing」里查看。
  - Spacing 应输出 token scale / class preset,不要继续散落成页面 CSS 魔法数字。
- [x] **Radius token / recipe 候选(等待 DangoUI 研发更新)**:
  - checklist 只保留方向;详细 token 值、视觉示例、用途和表达规则在 demo「DangoUI baseline / 风格 / Radius」里查看。
- [x] **Shadow token / effect recipe 候选(等待 DangoUI 研发更新)**:
  - checklist 只保留方向;详细 token 值、视觉示例、用途和表达规则在 demo「DangoUI baseline / 风格 / Shadow」里查看。
- [x] **通栏与 hero**:
  - HeroHeader / 首屏图等通栏模块可以用负 margin 抵消页面安全边距,但内部文案 padding 必须继续使用当前页面安全边距。
  - 通栏模块不额外包卡片框;真实内容区才决定是否需要卡片底。
- [ ] **Layout recipe 候选(等待 DangoUI 研发更新)**:
  - checklist 只保留方向;详细 recipe、token 组合、视觉示例和表达规则在 demo「DangoUI baseline / 风格 / Layout」里查看。
  - Layout 不等同业务组件;它应该输出 token recipe / class preset,供页面、Group、List、Form、BottomBar 等组件组合复用。
- [x] **待新增 / 待更新组件默认继承规则**:
  - 组件场景可以是业务组合;具体如何继承 Layout / Spacing / Radius / Shadow,以 demo「DangoUI baseline / 风格」为准。
  - 需要进入 DangoUI 生产库的差异继续记录在本 checklist。
- [x] **DangoUI 基础组件展示**:
  - Tabs / Tag / Grid 这类基础组件不再额外包一层带 border/background/padding 的说明卡。
  - 组件如果需要说明,说明文案应跟随组件自然排布,不能把组件变成“示意卡片”。
- [x] **业务组件沉淀**:
  - Feed 与 SPU 是两个场景,不能混在一个卡片内。
  - Feed 是内容流,用贪心双列流表达;卡片只承接封面、标题、作者和互动数据。
  - Swipe 是 Feed 首坑的运营资源位,不作为首页独立模块脱离内容流。
  - SPU 是商品承接,用横滑 rail 表达一组竖向 SPU item;SPU cover normal 尺寸按 `81px × 108px`。
  - SPU 横滑 rail 自身需要左右内 padding,默认左 `10px`,右侧额外留露边空间,让横滑语义可见。

### 新增 · DangoUI API 行为缺口

- [ ] **DuSwitch/Checkbox/Radio 在 showcase 中无 click 响应**:原因是 demo 绑定时只用 `:on`/`:checked` 但缺 `@update:on`/`:update:checked` 处理器;
      但同样的 props 在生产表单中是可以响应的,这是 demo 自身写法,不是 dangoui 缺陷。
      06-17 已在 DangoUI-Brand-Skill/src/App.vue line 521/524/528 补齐事件绑定。
- [ ] **DateTimePicker 没有独立 DangoUI 组件**:目前 demo 全部用 `DuCalendar + showTimePicker` 承接;这一条和"待更新"表里的 DateTimePicker 条目重复,**已合并到待更新**。
- [ ] **Cascader + show-search 时 search input 无背景**:这是 dangoui 内部 Search 组件在 Cascader 容器内未继承通用 card bg 导致的;
      06-17 已在 DangoUI-Brand-Skill/src/styles.css line 2988+ 加 demo 侧覆盖(.du-cascader__search .du-search bg + border)。
      后续:dangoui 生产代码需在 `src/cascader/` 内部 Search 容器补默认 background,或加 `context` prop。
- [ ] **Popup/Cascader/Select 内 Radio 无 hover 提示**:dangoui 内部 Radio 在 popup 弹层里没有 hover 视觉;
      06-17 已在 DangoUI-Brand-Skill/src/styles.css line 3010+ 加 demo 侧覆盖(.du-popup__content .du-radio:hover)。
      后续:dangoui Radio 自身加 hover state,或在 Popup 内容容器加默认 cursor 与 bg。
- [ ] **Tabs type="tag" 默认居中**:`<DuTabs type="tag">` 时 `.du-tabs--tag .du-tabs__list` 用 justify-content:center;
      demo 中"单次活动 / 多场次活动"因此被居中,语义不合。
      06-17 已在 styles.css line 3032+ 加 demo 侧覆盖。
      后续:dangoui 决定是否 type="tag" 不应居中,或者补一个 `align` prop(`'start' | 'center'`)。
- [ ] **DateTimePicker DuCalendar popup escape mockup 区域**:在 demo mockup 环境(phone frame 缩放)下,点击 DateTimePicker 触发 DuCalendar popup 时:
      popup 用 `position: fixed; width: 100vw` 全屏渲染,不受 mockup 约束;字体大小/容器宽度没有随 mockup 缩放。
      根本原因:`DuPopup` CSS 用 `position: fixed; width: 100vw; height: 100vh`,渲染到 document.body 外层,demo 侧 CSS override 从外部兜不住。
      建议修复(dangoui 侧):`DuPopup` 支持定位相关 CSS 覆盖,或提供 `container` prop 让 popup 渲染到指定父容器,或在 `DuCalendar`/`DuDateTimePicker` 提供 `popupPosition: 'viewport' | 'inline'` 选项。
      推测以下组件有相同问题:`DuSelect`、`DuCascader`、`DuActionSheet`、`DuDialog`。


### 新增 · 浏览器默认样式 demo 侧处理

- [ ] **全局 reset 加强**:已加 `button { background: transparent; border: 0; padding: 0; cursor: pointer; }`、
      `input[type="search"]::-webkit-search-cancel-button { display: none; }`、
      `input[type="number"]::-webkit-outer-spin-button { display: none; }`、
      `input:-webkit-autofill` 覆盖(06-17 styles.css line 75+)。
      生产库内若有同样的原生表单 reset 需求,建议直接由 dangoui 内部样式统一收口。

### 新增 · UX 决策(非 bug)

- [ ] **点击页面空白处回到默认页**:`phone-screen` 容器上有 `@click="restoreMockupSelection"`,这是 demo 故意行为(取消选中)。
      如果后续要改成"仅在显式 reset 按钮触发",改一行即可。

### 设计 Token 体系规范(2026-06-17 立)

> 核心原则:**尽可能从 dangoui 标准 token 取,不自定。移动端页面底 = bg-2;通栏 content = bg-1;卡片/局部分组再按场景决定是否使用 bg-1/bg-2。**

#### 三层视觉(基于 dangoui bg token 体系)

```
最底层   body/页面       var(--du-bg-2)  #f7f7f9  浅灰
通栏     content block   var(--du-bg-1)  #ffffff  白
卡片基类 .group          按场景使用 bg-1/bg-2,不得无依据套壳
主题卡   .re1999-hero 等  主题渐变 bg 覆盖 .group
```

#### 已落地(2026-06-17,共 142 处直接引用 + 删 9 个 :root alias)

##### Phase 1 · 立规范
- [x] **删 :root --bg 自定 token**(跟 --du-bg-* 重复)
- [x] **body background: var(--bg) → var(--du-bg-1)**
- [x] **.group background: var(--style-card-bg, #ffffff) → var(--du-bg-2)**(后续用 var(--du-bg-2) 直接)
- [x] **.contents 不设 bg(继承 body bg-1)**
- [x] **.group 卡片基类建立 + 6 处 publish card 加 class="group"**

##### Phase 2 · :root 自定 token 映射到 dangoui
- [x] **8 个 :root alias 删除**(--bg/--panel/--panel-soft/--text/--muted/--line/--accent/--accent-soft/--orange)
- [x] 78 处 var(--X) → var(--du-*) 直接引用(panel/text/muted/line/accent/accent-soft/orange/bg)

##### Phase 3 · --style-card-bg 彻底 token 化
- [x] **55 处 var(--style-card-bg) → var(--du-bg-2)**(卡片底色)
- [x] **1 处 autofill inset → var(--du-bg-1)**(input 底色用白)

##### Phase 4 · Mockup scale 简化
- [x] **3 个 derived calc 删**(--style-card-radius / --style-control-radius / --style-page-spacing)
- [x] **64 处改用 base**(--style-card-radius-base / --style-control-radius-base / --style-page-spacing-base)
- [x] 因为 --mockup-scale 写死 1,calc 永远是 no-op,简化后语义清晰

##### Phase 5 · 激活 dead variable
- [x] **--style-card-shadow 定义**:0 1px 3px rgba(0, 0, 0, 0.08)(10 处 box-shadow 激活，临时:待迁移到 Shadow token / recipe)
- [x] **--style-media 定义**:transparent(5 处 background 激活,等价 dead 状态)

#### Commit 链(06-17 token 化完整历史)

| commit | 说明 | 影响 |
|---|---|---|
| `71fb53b` | 06-17 立 token 体系规范 | 立原则 + 6 处 .group |
| `18ed0b5` | :root 自定 8 token 映射到 dangoui | 9 个 :root 改动 |
| `7981616` | 56 处 var(--style-card-bg) → --du-bg-2 | 删 :root alias + 56 处迁移 |
| `88f0353` | 78 处 var(--bg/panel/text/...) → --du-* | 删 8 个 :root 旧 alias |
| `2247c2e` | 简化 mockup scale | 删 3 derived + 64 处改 base |
| `1627ff9` | 激活 2 个 dead variable | 10 box-shadow + 5 bg 激活 |

#### :root 最终状态(06-17 收尾,6 类自定 token)

```css
:root {
  --shadow: 0 18px 60px ...;             /* 临时:待迁移到 Shadow token / effect recipe */
  --style-card-radius-base: 12px;       /* 临时:待迁移到 Radius token / recipe */
  --style-control-radius-base: 8px;     /* 临时:待迁移到 Radius token / recipe */
  --style-page-spacing-base: 12px;      /* 临时:待迁移到 Spacing token / recipe */
  --style-card-shadow: 0 1px 3px ...;  /* 临时:待迁移到 Shadow token / recipe */
  --style-media: transparent;            /* 自定:媒体层底色(06-17 激活) */
  --mockup-radius / --mockup-screen-*   /* mockup 内部 */
  --mock-type-*                          /* mockup 内部 */
}
```

dangoui 100% 接管色板/bg/border,自定 6 类都是 dangoui 没对应(mockup 几何 / 自定阴影 / 自定 media)


#### 触发场景

- 新增元素需要 bg/color/border 时:先查 dangoui 现有 token(`--du-bg-*` / `--du-text-*` / `--du-border-*`)
- 只有 dangoui 没有覆盖到的语义,才新建 `--style-*` 自定 token
- 主题切换(dark/mp)时,token 自动反转,不需要单独改 demo

### E 进度 · 6.29 Showcase 三大品牌样例(2026-06-17 启动)

- [x] **CZN: 建 assetInventory**(对齐 1999 格式)
      提交:`feat(czn): add assetInventory 段对齐 1999 格式 (18 items: 14 style-only / 3 asset-only / 1 missing)`
      详情:`migrations/czn/brand-evidence.json` 补了 `statistics.assetInventory` 段,18 个 items
      - **14 style-only**:已在 demo 引用 + 在 style.json 声明
      - **3 asset-only**:`czn-index-ck-pz.png` / `czn-index-pc-main-down.png` / `czn-tiezhi-kol.png` 磁盘有但 demo 还没用
      - **1 missing**:`czn-character-art` 需从用户截图导出
      - style.json 与 public/assets/ 之间有 13 个 undeclared 资产已盘清
- [ ] **CZN: 应用至少一个真实图片或 mask asset 到 demo**
      可选:`czn-tiezhi-kol.png` (texture) / `czn-index-ck-pz.png` (asset-frame) / `czn-index-pc-main-down.png` (asset-frame)
- [ ] **CZN: 对 2-3 页做截图 / DOM 回归**
- [ ] **HPMA: 将 assetInventory 升级到和 1999 同一结构**(HPMA 的 brand-evidence.json 也缺该段)
- [ ] **HPMA: 验证 font package / icon asset / media border 是否都能被 Claude 复用**
- [ ] **HPMA: 对 2-3 页做截图 / DOM 回归**
- [ ] **1999: 验证 selected-bg 如何从源站局部 hover 图标映射到通用选中态**
- [ ] **1999: 补 texture / paper / noise 真实资产或确认 fallback**
- [ ] **1999: 对 2-3 页做截图 / DOM 回归**

### 新增 · 待和用户确认

- [ ] **"3 侧 + 1 反馈" 的具体拆法**:memory.md 与 06-15 TODO 都没明确写出。当前假设:
      风格学习侧 / 迁移工作台侧 / 证据验证侧 + ReviewQueue 反馈。需要用户确认。
- [ ] **🟡 冻住 · 29 号后再决定**:本地 dangoui 源码 `~/Downloads/dangoui-feat-update/packages/dangoui/` 是否需要接入 demo(vite alias 指向 src)。
      当前 demo 仍用 `node_modules/dangoui@3.6.16`(npm 版本)。
      本地 fork 的 JocelynTong/dangoui 与 npm 同版本号,本地源 src/ 比 dist/ 多出 action-sheet/avatar/badge/button/calendar 等。
      现阶段专注完善 demo 参考站,不碰本地源码;29 号后决定是本地接 demo 还是直接交付研发做。
