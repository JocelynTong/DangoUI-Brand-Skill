# DangoUI Brand Skill

把品牌官网、活动页、截图、Figma、`DESIGN.md` 或 DTCG 资产，转换成可解释、可复用、可验证的品牌视觉语言，并安全应用到现有产品页面。

这个项目不是网页镜像工具，也不只是换一组颜色。它关注完整链路：

```text
品牌来源
  → 证据与设计意图
  → Brand MOD / style pack
  → DangoUI token、组件语义与视觉 recipe
  → 品牌学习 Demo 或真实业务项目
  → 构建、视觉、交互与回退验证
```

> 当前阶段：公开 Web MVP / controlled alpha。适合在测试项目或独立分支体验；微信小程序和原生移动端尚未完成生产验证。

公开 Demo：[https://jocelyntong.github.io/Dangoui-Design-System-Skill/](https://jocelyntong.github.io/Dangoui-Design-System-Skill/)

## 一分钟开始

只看效果：打开公共 Demo，不需要登录。

已经安装 Skill：直接说一句，不需要选择模式或提供内部文件路径。

```text
$brand https://asia-en.onepiece-cardgame.com/
```

已收录官网会直接复用公共 Brand MOD；未收录官网才进入新的品牌学习。要应用到当前项目，只需补充目标：

```text
$brand 把 https://asia-en.onepiece-cardgame.com/ 应用到当前项目，保留原业务内容。
```

Claude Code 中将 `$brand` 写成 `/brand`。

## 适合谁

- 想从品牌参考快速得到可审查设计方向的运营、产品和 vibecoder。
- 想把已确认视觉语言应用到现有页面的设计师和开发者。
- 想沉淀可被不同项目重复消费的品牌规则与设计系统团队。

## 两种使用方式

### 学习品牌

只提供品牌来源时，Skill 会进入 `learn-brand`：提取证据、解释设计意图、生成 Brand MOD，并用多个页面验证它是否真的学会了这套视觉语言。

```text
$brand 学习 https://example.com 的品牌视觉语言，先给我 2–3 个方向。
```

### 应用到现有项目

明确要求修改当前项目时，Skill 会进入 `apply-host`：保留原有内容、数据、路由和核心交互，先提供视觉方向，确认后再修改真实页面，并在动手前建立回退点。

```text
$brand 把 https://example.com 的视觉语言应用到当前项目，保留业务内容，先给我 2–3 个方向。
```

Claude Code 中将 `$brand` 写成 `/brand`。

## 当前已经做到什么

| 能力 | 当前状态 |
| --- | --- |
| 品牌证据、意图、MOD 和 DangoUI 映射 | 已实现并有机器校验 |
| 多页面品牌学习 Demo | Web 已验证 2 个公开样本 |
| 公共品牌 Registry | v0.1 已实现，免登录只读、来源 URL 去重、版本化分发 |
| 真实业务项目换肤 | 已完成 ONE PIECE × 卡组工具 H5 试点 |
| Taro 微信小程序 | 构建通过，开发者工具与真机运行待验证 |
| iOS / Android / Flutter / 鸿蒙 | 尚未验证 |
| 外部用户试用 | 尚未完成 5–10 人受控内测 |

详细进度、证据和下一阶段门槛见 [research/okr.md](research/okr.md)。

## 公共品牌库

相同官网不应由每位使用者重复学习。Skill 会先根据规范化后的来源 URL 查询公共 Registry；命中时复用已有版本，未命中时才重新采集。

```text
/brand-registry/v0.1/index.json
/brand-registry/v0.1/by-source.json
/brand-registry/v0.1/brands/{brand}/{version}/manifest.json
```

当前公开样本：

- ONE PIECE CARD GAME `0.1.0`
- Pokémon TCG Official `0.1.0`

机器查询入口：

- [品牌索引](https://jocelyntong.github.io/Dangoui-Design-System-Skill/brand-registry/v0.1/index.json)
- [来源 URL 索引](https://jocelyntong.github.io/Dangoui-Design-System-Skill/brand-registry/v0.1/by-source.json)

需要确认某个官网是否已收录时，可运行：

```bash
npm run brand:resolve -- --source-url https://asia-en.onepiece-cardgame.com/
```

MVP 不建设账号、计费和在线编辑后台。公开读取不需要登录；新增或更新资产通过受控 Pull Request 审核。规则与元数据可以公开复用，官网原始素材仍按 manifest 中的授权状态逐项判断。

## 共建一个品牌

不需要等待独立账号系统。先提交 [品牌收录申请](https://github.com/JocelynTong/Dangoui-Design-System-Skill/issues/new?template=brand-submission.yml)，提供官网来源、希望验证的平台和素材授权情况。维护者完成证据、三证与安全检查后，再通过 Pull Request 将版本加入公共 Registry。

收录门槛：

- 来源可追溯，规范化 URL 不与现有品牌重复。
- Evidence Fidelity、Structural Fidelity、Generative Proof 分别通过。
- Brand MOD、DangoUI mapping、Demo 和机器校验产物齐全。
- 不包含私有链接、本机路径、密钥或未经确认可分发的官网原始素材。
- 更新已有品牌时递增版本，不覆盖已公开版本。

## 参加 MVP 试用

试用者只需要带一个可公开说明的测试页面，按“一分钟开始”调用 Skill，然后提交 [MVP 试用反馈](https://github.com/JocelynTong/Dangoui-Design-System-Skill/issues/new?template=mvp-trial.yml)。反馈表会统一记录首次成功耗时、Registry 是否命中、业务是否回归以及回退结果；不要上传公司私有代码、截图、日志或访问凭证。

## 5 分钟启动 Demo

只想体验时可直接打开[公共 Demo](https://jocelyntong.github.io/Dangoui-Design-System-Skill/)。需要本地开发时再执行以下步骤。

需要 Node.js 20.19+（或 22.12+）、npm 和 [Git LFS](https://git-lfs.com/)。

```bash
git lfs install
git clone https://github.com/JocelynTong/Dangoui-Design-System-Skill.git
cd Dangoui-Design-System-Skill
npm ci
npm run dev -- --port 5174
```

打开终端输出的本地地址。Demo 中每个品牌、页面、风格分类和组件都有稳定深链：

```text
/#/brand/{brand}/pages/{pageId}
/#/brand/{brand}/style/{styleCategory}
/#/brand/{brand}/components/{componentName}
```

## 只安装 Skill

如果不需要 Demo 和大型品牌素材，可使用 sparse clone：

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/JocelynTong/Dangoui-Design-System-Skill.git \
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

在目标项目根目录执行：

```bash
mkdir -p .claude/skills
rsync -a --delete /path/to/dangoui-brand-skill/skills/brand/ .claude/skills/brand/
```

安装或更新后重新打开任务/会话。

## 一次品牌学习会产出什么

```text
migrations/{brand}/brand-mod.json
migrations/{brand}/brand-evidence.json
migrations/{brand}/brand-intent.json
migrations/{brand}/style.json
migrations/{brand}/dangoui-adapter.json
migrations/{brand}/component-mapping.json
migrations/{brand}/fidelity-report.json
```

正式通过需要三项证明同时成立：

- Evidence Fidelity：关键设计决定能追溯到真实来源。
- Structural Fidelity：构图、层级、密度和浏览节奏没有被通用模板抹平。
- Generative Proof：规则能生成新页面，而不是复制官网截图或只替换 Logo。

Demo 验证品牌学习能力；真实业务交付必须在宿主项目自身的页面和地址完成。

## 平台路线

| 阶段 | 范围 | 放行条件 |
| --- | --- | --- |
| 0.1 | Web Demo + 公共 Registry | 版本、来源去重、发布状态、三证和构建校验通过 |
| 0.2 | Taro H5 受控试点 | 5–10 位开发者、累计约 10 个真实页面；记录安装、视觉、业务和回退结果 |
| 0.3 | 微信/千岛小程序 | 开发者工具、Android、iOS 真机分别通过；建立组件兼容矩阵 |
| 后续 | iOS / Android / Flutter / 鸿蒙 | 为各运行时实现并验证 adapter，不以 H5 结果外推 |

## 仓库结构

```text
skills/brand/           Brand Skill 维护源与公开分发包
.claude/skills/brand/   Claude Code 镜像，由同步脚本生成
migrations/             品牌 MOD、证据、验证与试点记录
public/brand-previews/  Demo 运行时品牌数据
public/brand-registry/  版本化公共 Registry 产物
schemas/                Brand MOD 与 Registry 协议
src/                    Vue Demo 站
scripts/                构建、同步和质量校验
research/okr.md         当前目标、完成度与下一阶段门槛
```

只维护 `skills/brand/`，不要手工同步 `.claude/skills/brand/`。

## 维护与发布

```bash
npm run sync:skills
npm run build:brand-registry
npm run validate:brand
npm run test:brand-wild-design
npm run package:brand-skill
npm run validate:brand-skill-release
npm run build
```

公共 Registry 的源协议是 `public/brand-previews/registry.json`，生成产物不要手工修改。

## 常见问题

### 图片只有一小段文本

这是 Git LFS 指针。执行：

```bash
git lfs install
git lfs pull
```

### 官网无法自动抓取

可以改用 2–3 张核心页面截图、Figma、HTML、`DESIGN.md` 或 DTCG。Skill 会先查询本地和公共 Registry，不会默认要求使用者粘贴 CSS。

### 如何回退宿主修改

让 Skill 执行 `$brand rollback`（Claude Code 使用 `/brand rollback`）。回退前会先展示 dry-run；非 Git 项目使用文件备份清单。

### 是否已经支持微信小程序或原生 App

目前只能确认 Web 和特定 Taro H5 试点结果。微信构建已跑通，但开发者工具和真机仍待验证；其他平台尚不能声明支持。

## 项目边界

- 不替代官网素材授权判断。
- 不把品牌 key 自动变成业务路由或新业务页面。
- 不修改宿主业务数据、字段和核心逻辑来换取视觉效果。
- 不用构建成功替代浏览器、开发者工具或真机验收。
- 不把某个平台的 PASS 外推到其他平台。

当前许可证见 [package.json](package.json)。品牌来源内容和素材仍受各自权利方条款约束。
