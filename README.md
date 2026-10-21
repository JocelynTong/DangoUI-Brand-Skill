# DangoUI Brand Skill

把你喜欢的品牌视觉，变成一套能解释、能复用、能检查，也能安全应用到产品里的设计语言。

你可以给它一个想模仿的品牌网址、截图、Figma、`DESIGN.md` 或现有项目。它不会只抄颜色、贴 Logo，也不会把官网生硬搬进业务页面，而是先回答三个问题：

1. 这个品牌为什么看起来像它自己？
2. 哪些视觉规律可以迁移，哪些只适合原场景？
3. 怎样证明结果真的学会了品牌，同时没有破坏原产品？

> 当前阶段：公开 MVP / controlled alpha。已发布的 `mvp-2026-10-13` 保留为三张完整效果图的固定版本；本分支整合选图后的隔离代码预览，仍须按实际任务验收，不代表生产或跨项目认证。微信开发者工具、移动端真机和更多真实业务仍在验证中。

[查看公共 Variant 库](https://jocelyntong.github.io/DangoUI-Brand-Skill/) · [查看互动复盘流程图](https://jocelyntong.github.io/DangoUI-Brand-Skill/brand-retro-flow.html)

## 先用一句话理解

过去，做一次品牌化页面通常需要一个人同时研究官网、总结风格、设计页面、写代码和自查。上下文一长，很容易漏掉动效、资产用途、业务边界或真实页面验收。

Brand Skill 把这件事改成一条有分工、有产物、有验收、有返工路线的流程：

```text
品牌来源
  → 找到真实视觉证据
  → 解释品牌语言和适用场景
  → 映射为可复用设计能力
  → 生成不同结构的 Demo，或应用到现有项目
  → 检查视觉、交互、业务和回退
  → 通过后再交付；不通过就回到责任阶段修正
```

互动流程图中的红框代表历史上真正卡住过的节点。点击红框，可以查看问题发生时间、解决时间、当时卡在哪里以及后来如何解决。

## 谁可以用

- **运营、市场、品牌爱好者**：给一个喜欢的品牌参考，快速看到可讨论的视觉方向。
- **产品经理**：判断品牌感适合放在哪些页面，不让强视觉伤害信息效率。
- **设计师**：把“感觉像”变成有证据、有适用边界的视觉语言。
- **开发者和 vibecoder**：把已经确认的方向落到真实页面，同时保留路由、数据和核心交互。
- **设计系统团队**：把一次成功沉淀为后续项目可重复使用的 Brand MOD、组件映射和质量门槛。

不需要先理解 DTCG、Registry、Gate 或内部文件结构。日常使用只需要说明参考来源和目标。

## 一分钟开始

只想看效果，直接打开[公共 Variant 库](https://jocelyntong.github.io/DangoUI-Brand-Skill/)。

已经安装 Skill 时，直接说一句：

```text
/brand + 想模仿的品牌网址 / 截图 / Figma / DESIGN.md / 现有项目
```

例如，只学习一个品牌：

```text
/brand 学习 https://asia-en.onepiece-cardgame.com/ 的视觉语言，形成可复用品牌包和学习 Demo。
```

把它应用到现有项目：

```text
/brand 把 https://asia-en.onepiece-cardgame.com/ 的视觉语言应用到当前项目，
保留原有内容、数据、路由和核心交互，先给我三张完整效果图。
```

Codex 中也可以显式写成 `$brand`。自然语言同样有效，不需要记内部模式名或提供配置文件路径。

从公共库选品牌时，复制具体品牌页面链接（例如 `https://jocelyntong.github.io/DangoUI-Brand-Skill/#/variants/dango`），在要换肤的项目会话里发送：

```text
$brand 使用这个品牌库链接，为当前项目生成三个差异化完整效果图，先不要改代码：〈品牌页面链接〉
```

选好后在同一会话继续：

```text
$brand 我选本轮完整效果图 A，请做成可操作页面，只修改隔离副本，不改原项目、不发布。
```

等待图片与实际页面的同视口对照及独立验收，再决定是否合入原项目。公开 main 使用 `$brand`，不需要维护者的临时路径或 `$brand-preview` 候选别名。

已有满意图片时，更新 Skill 后可直接在原项目会话中指定那张图，继续隔离单页，不必重新生图；若历史中有多个同名方案，只需补充对应缩略图或原结果链接。单页确认不等于整体换肤授权。Taro 小程序须在对应开发者工具或真机中验收状态栏、胶囊和真实品牌切换，不能用 H5 或代理预览代替原生通过；交付的图片／原生截图对照是静态证据，实际操作仍在开发者工具中完成。

三图都不满意时，可在原会话说：“保留品牌和业务，再探索三个不同方案。”Skill 会复用经校验的输入，在新隔离批次生成三图，保留旧图供对照；有偏好可补充，不必重新解释整个项目。每批仍需生成和独立检查，不保证一次满意；不会自动转代码或修改业务项目。宿主输入已变化时会先处理更新，避免沿用旧业务事实。

## 使用时会发生什么

### 没有宿主且明确学习品牌

系统会先收集真实页面、样式、资产和动效证据，再解释这些元素为什么成立、适合用在哪里。随后用同一套规则生成不同信息结构的页面，验证学到的是视觉语言，而不是某一张页面模板。

这一过程不会默认修改你的业务项目。你最终会看到：

- 品牌视觉证据和来源；
- 颜色、排版、构图、资产与动效的使用解释；
- 多页面 Demo；
- 哪些能力已经证明、哪些仍未证明的验收结论。

### 明确要改现有项目：应用品牌

在现有项目中只给品牌参考，默认先读取真实业务并生成三张完整 ImageGen 效果图，同场景、同视口、等权展示，经独立视觉检查后等待选择。图片不证明交互、组件调用或代码实现；明确要求交互 H5 时仍可走原有 H5 流程。

选定图片并要求落地后，先复制真实宿主，只实现一个隔离单页：直接复用选中图中合适的插画区域，真实控件与数据消费品牌 DTCG、adapter 和实际 DangoUI 样式。兼容组件复用，不兼容平台明确适配，不把加载 CSS 说成调用了组件。独立检查后展示效果图与实际页面对照，等你确认单页并明确授权，才考虑整体换肤。局部问题在当前隔离运行里修订，保留旧记录，不要求重新选图；单页通过不代表生产或跨项目认证。

可以直接说：`$brand 我选本轮 C，请保留插画，做成隔离的可操作单页，先别整体换肤。`

应用过程遵守三条底线：

- 不为了视觉效果改掉业务事实、数据或核心逻辑；
- 不把适合官网的强视觉硬塞进搜索、列表、编辑和交易等效率页面；
- 修改前建立回退点，最终在宿主项目自己的页面上验收。

## 怎么判断“真的学会了”

页面能打开、代码能构建，只代表程序跑了，不代表品牌学会了。

一次品牌学习必须同时通过三项互不抵消的证明：

| 要证明什么 | 人话解释 |
| --- | --- |
| Evidence Fidelity | 重要视觉决定确实来自参考来源，不靠想象补全 |
| Structural Fidelity | 构图、层级、密度和浏览节奏没有被通用模板抹平 |
| Generative Proof | 同一套规律能生成新页面，不是复制截图或只换 Logo |

任何一项失败都会回到对应阶段返工。真实项目还要额外检查业务安全、滚动、交互、资产加载、响应式和回退是否有效。

## 当前进展

| 能力 | 今天可以诚实地说什么 |
| --- | --- |
| 品牌证据、语义解释与可复用规则 | 已实现，并有机器检查 |
| 多页面品牌学习 Demo | Web 已有公开样本和真实页面验收 |
| 公共品牌库 | v0.1 已上线，相同官网可先复用已有版本 |
| 三张完整宿主效果图 | MVP 默认交付，图片独立审核与等权比较；不代表运行实现 |
| 选图后隔离代码预览 | main 小范围试用；React Web 单页已验证真实映射和限域 Button 适配，其他任务仍须独立验收 |
| 真实业务项目换肤 | 已完成有限 H5 试点 |
| QA / TPP 失败回退 | Web 已能定位责任阶段、返工并重新验收 |
| 多角色工作流 | 已有职责、产物和 Gate；尚不能宣称所有角色都稳定自动并行 |
| Taro 微信小程序 | 构建通过，开发者工具和真机待验证 |
| iOS / Android / Flutter / 鸿蒙 | 尚未验证，不能从 Web 结果外推 |

当前公开样本：ONE PIECE CARD GAME `0.1.0`、Pokémon TCG Official `0.1.0`。

## 公共品牌库是什么

公共品牌库（Registry）可以理解为“已经审核过的品牌能力目录”。同一个官网不需要每个人从头学习：命中已有版本时直接复用；没有收录时，才开始新的证据采集和学习。

公共读取免登录。规则和元数据可以复用，但官网图片、字体和视频等原始素材仍要按各自授权判断，收录不等于自动获得商用许可。

- [查看品牌索引](https://jocelyntong.github.io/DangoUI-Brand-Skill/brand-registry/v0.1/index.json)
- [查看来源网址索引](https://jocelyntong.github.io/DangoUI-Brand-Skill/brand-registry/v0.1/by-source.json)
- [申请收录一个品牌](https://github.com/JocelynTong/DangoUI-Brand-Skill/issues/new?template=brand-submission.yml)
- [提交公开 MVP 试用反馈](https://github.com/JocelynTong/DangoUI-Brand-Skill/issues/new?template=mvp-trial.yml)

## 开始本地体验

环境要求：Node.js 20.19+（或 22.12+）、npm 和 [Git LFS](https://git-lfs.com/)。

```bash
git lfs install
git clone https://github.com/JocelynTong/DangoUI-Brand-Skill.git
cd DangoUI-Brand-Skill
npm ci
npm run dev -- --port 5174
```

Demo 深链：

```text
/#/brand/{brand}/pages/{pageId}
/#/brand/{brand}/style/{styleCategory}
/#/brand/{brand}/components/{componentName}
```

## 只安装 Skill

如果不需要 Demo 和大型品牌素材，可以只下载 Skill：

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/JocelynTong/DangoUI-Brand-Skill.git \
  dangoui-brand-skill
cd dangoui-brand-skill
git sparse-checkout set skills/brand
```

### Codex

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
rsync -ac --delete skills/brand/ "${CODEX_HOME:-$HOME/.codex}/skills/brand/"
```

### Claude Code

```bash
mkdir -p .claude/skills
rsync -ac --delete /path/to/dangoui-brand-skill/skills/brand/ .claude/skills/brand/
```

更新已有安装时，在上述专用下载仓库中运行 `git pull --ff-only origin main`，再执行对应平台的复制命令；仅拉取仓库不会更新已经安装的 Skill。复制会覆盖安装目录，个人改动应先备份；不要在业务项目里执行该 pull 命令。

`-c` 按文件内容校验，避免同大小、同时间的旧文件被跳过。复制目标仅限 Skill 安装目录，不要指向业务项目或结果目录；更新不删除或迁移旧图、单页和运行记录。

图片预览可选、高清达标和单页验收分别报告。移动端宽度 1080、桌面宽度 1920 是高清交付目标，不是内置 ImageGen 的尺寸保证；当前内置工具未暴露尺寸参数，最大分辨率未知。低于目标的原图仍可选方向并继续隔离单页，但高清交付标为未完成；不自动放大、重画或切换 API，业务问题和参数未核实状态仍保留。

本次选图续接修复支持在明确选定同一张图后直接续接已有单页，不重新实施或重复 QA。原生生图记录能核实图片来源但不能还原调用参数时，会保留“参数未核实”的限制，不冒充完整审核通过；缺失原件不能靠更新恢复。保留旧项目，在更新后的会话中使用 `$brand` 并说明“选之前的 B，继续隔离单页，不重新生图”（替换为实际选案）；多个同名批次时补充原结果链接或缩略图即可。不会自动整体换肤。

安装或更新后，重新打开任务或会话，并确认选择的是 `brand`。让助手报告实际加载的 Skill 路径及包完整性标识；不要仅凭“已安装”判断本轮已用新版。固定旧版试用仍可使用 `mvp-2026-10-13` 标签，但它不包含 main 后续修复。

## 给开发者：产物与边界

一次品牌学习的核心产物位于 `migrations/{brand}/`：

```text
brand-evidence.json       真实来源证据
brand-intent.json         品牌意图、使用与禁用场景
brand-mod.json            可供其他项目消费的品牌视觉包
component-mapping.json    DangoUI 组件映射
dangoui-adapter.json      运行时适配规则
fidelity-report.json      三项证明与验收结论
source-manifest.json      历次学习来源和状态
```

`Brand MOD` 是模块化品牌视觉包，不是游戏 MOD。它不仅包含颜色 Token，也包含组件变体、资产、布局规则、插槽、平台覆盖和验证状态。

边界：

- Brand Skill 负责学习品牌、解释视觉语言、映射 DangoUI，以及在宿主项目中做换肤验证。
- 宿主项目继续拥有业务内容、数据、路由、组件 API 和核心交互。
- DangoUI 提供统一能力；平台 adapter 处理不同运行时差异。
- 当前 DangoUI 不支持的能力会被记录为缺口，不会伪装成正式 API。
- Demo 用于证明品牌学习；真实业务交付必须在宿主自己的页面和地址完成。

## 给维护者：更新、验证与发布

已有 Demo 的更新不是一次空白学习。更新入口会先继承 `source-manifest.json` 中的历史来源，再追加本次来源；旧来源静默丢失时会阻断。

```bash
node skills/brand/scripts/run-brand-workflow.mjs update \
  --brand onepiece-cardgame \
  --source-url "https://asia-en.onepiece-cardgame.com/news/"
```

需要用最新版流程重新验证旧品牌包时，使用 `--force-relearn` 和新的版本化工作区，例如 `hpma-v2`。新版本全部通过前，不覆盖原目录，也不进入公共品牌库。

维护源只有 `skills/brand/`；`.claude/skills/brand/` 由同步脚本生成。

每次改变入口或交付能力，同时核对本 README 的安装/更新/示例与 `SKILL.md` 初始化引导；发布后核对远端 main 的实际 Skill 文件及包完整性。试跑宿主、截图和临时目录不进入发布。保留固定 MVP 标签，不用移动旧标签代替新版本。

```bash
npm run sync:skills -- --repo-only
npm run build:brand-registry
npm run validate:brand
npm run test:brand-trial
npm run test:brand-wild-design
npm run package:brand-skill
npm run validate:brand-skill-release
npm run build
```

主要目录：

```text
skills/brand/           Brand Skill 维护源与公开分发包
.claude/skills/brand/   Claude Code 镜像
migrations/             品牌 MOD、证据和验证记录
public/brand-previews/  Demo 运行时品牌数据
public/brand-registry/  公共品牌库生成产物
schemas/                Brand MOD 与 Registry 协议
src/                    Vue Variant 库
scripts/                构建、同步和质量检查
```

## 试用与隐私

公开 GitHub 通道只接受可公开的 Web 或 Taro H5 测试材料。不要提交私有代码、截图、日志、内网地址、凭证、个人信息或未确认授权的素材。

公司内部试点记录保存在宿主项目本地 `.brand-trials/`，默认不会上传：

```bash
npm run brand:trial:init -- --channel internal --id <试点编号> --platform taro-h5
npm run validate:brand-trial -- --record .brand-trials/<试点编号>.json
```

若要把内部结论贡献到公共仓库，只发布经过审阅和授权的脱敏摘要；原始记录始终留在内部。

## 常见问题

### 我不会设计或写代码，也能用吗？

可以。给出品牌参考并说明想做什么即可。系统负责把证据、方向和限制说清楚；涉及真实项目修改时，仍建议由项目负责人确认方向和验收结果。

### 它会直接复制官网吗？

不会。官网可以作为学习证据，但复制整张截图、照搬页面或只替换 Logo 不能通过品牌学习验收。

### 官网无法自动抓取怎么办？

可以改用 2–3 张核心页面截图、Figma、HTML 或 `DESIGN.md`。系统不会默认要求你粘贴 CSS。

### 如何回退项目修改？

让 Skill 执行 `$brand rollback`，Claude Code 使用 `/brand rollback`。执行前会展示 dry-run；非 Git 项目使用文件备份清单。

### 图片为什么只有一小段文本？

这是 Git LFS 指针。运行：

```bash
git lfs install
git lfs pull
```

### 已经支持微信小程序或原生 App 吗？

还不能这样宣称。目前可以确认 Web 和有限 Taro H5 试点；微信构建已通过，但开发者工具和真机仍待验证，其他平台也尚未完成生产验收。

## 许可证与素材权利

项目许可证见 [package.json](package.json)。品牌来源内容、字体、图片、视频和其他素材仍受各自权利方条款约束；技术上可提取或展示，不代表可以自由分发或商用。
