# DangoUI Brand Skill

把你喜欢的品牌视觉，变成一套能解释、能复用、能检查，也能安全应用到产品里的设计语言。

你可以给它一个想模仿的品牌网址、截图、Figma、`DESIGN.md` 或现有项目。它不会只抄颜色、贴 Logo，也不会把官网生硬搬进业务页面，而是先回答三个问题：

1. 这个品牌为什么看起来像它自己？
2. 哪些视觉规律可以迁移，哪些只适合原场景？
3. 怎样证明结果真的学会了品牌，同时没有破坏原产品？

> 当前阶段：公开 Web MVP / controlled alpha。Web 流程已经形成闭环，适合在测试项目或独立分支体验；微信开发者工具、移动端真机和更多真实业务仍在验证中。

[查看公共 Demo](https://jocelyntong.github.io/DangoUI-Brand-Skill/) · [查看互动流程图](https://jocelyntong.github.io/DangoUI-Brand-Skill/brand-retro-flow.html)

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

只想看效果，直接打开[公共 Demo](https://jocelyntong.github.io/DangoUI-Brand-Skill/)。

已经安装 Skill 时，直接说一句：

```text
/brand + 想模仿的品牌网址 / 截图 / Figma / DESIGN.md / 现有项目
```

例如，只学习一个品牌：

```text
/brand 学习 https://asia-en.onepiece-cardgame.com/ 的视觉语言，先给我 2–3 个方向。
```

把它应用到现有项目：

```text
/brand 把 https://asia-en.onepiece-cardgame.com/ 的视觉语言应用到当前项目，
保留原有内容、数据、路由和核心交互，先给我 2–3 个方向。
```

Codex 中也可以显式写成 `$brand`。自然语言同样有效，不需要记内部模式名或提供配置文件路径。

## 使用时会发生什么

### 只给品牌参考：学习品牌

系统会先收集真实页面、样式、资产和动效证据，再解释这些元素为什么成立、适合用在哪里。随后用同一套规则生成不同信息结构的页面，验证学到的是视觉语言，而不是某一张页面模板。

这一过程不会默认修改你的业务项目。你最终会看到：

- 品牌视觉证据和来源；
- 颜色、排版、构图、资产与动效的使用解释；
- 2–3 个可讨论的视觉方向；
- 多页面 Demo；
- 哪些能力已经证明、哪些仍未证明的验收结论。

### 明确要改现有项目：应用品牌

系统会先读取项目的业务内容、路由、结构和回退点，然后给出 2–3 个轻量方向。方向确认后才修改真实页面。

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
rsync -a --delete skills/brand/ "${CODEX_HOME:-$HOME/.codex}/skills/brand/"
```

### Claude Code

```bash
mkdir -p .claude/skills
rsync -a --delete /path/to/dangoui-brand-skill/skills/brand/ .claude/skills/brand/
```

安装或更新后，重新打开任务或会话。

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

```bash
npm run sync:skills
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
src/                    Vue Demo 站
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
