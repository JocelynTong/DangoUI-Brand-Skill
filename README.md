# Dangoui Design System Skill

这个仓库提供一个可给 Codex 和 Claude 共用的 `brand` skill，用来把品牌网站、DESIGN.md、截图或 Figma/DTCG 资产迁移到 Echo / dangoui 的 token、component mapping 和 demo 视觉验证。

安装到业务项目后，用户入口是：

```text
/brand <品牌官网 URL 或 demo 站 URL>
```

## 入口

- Codex 分发包：`skills/brand/`
- Claude Code 项目 skill：`.claude/skills/brand/`
- Claude.ai 自定义 skill 上传包：打包 `skills/brand/`

## 快速安装到任意测试项目

在“要被换肤的业务项目”根目录执行下面这段。它会安装最新版 `brand` skill，并复制本仓库已经沉淀的 style packs 与本地资产：

```bash
mkdir -p .claude/skills migrations public/assets
rm -rf .claude/skills/brand
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/.claude/skills/brand .claude/skills/brand
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/migrations/. migrations/
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/public/assets/. public/assets/
```

安装后，在 Claude Code 里直接用：

```text
/brand <品牌官网 URL 或 demo 站 URL>
```

例子：

```text
/brand http://127.0.0.1:5174/#/brand/re1999/pages/re1999-home
/brand http://127.0.0.1:5174/#/brand/hpma/pages/hpma-home
/brand http://127.0.0.1:5174/#/brand/spotify/pages/distribution
```

预期行为：

- demo URL 只作为风格来源，不会自动新建 `/{brand}` 路由或 `BrandPage.vue`。
- 默认把风格套到当前业务项目默认入口，例如 `/` 或 `/#/`。
- 保留原业务内容、数据、文案和逻辑，只迁移视觉语言。
- 执行前自动创建 rollback checkpoint；需要回退时用 `/brand rollback`。
- 如果误生成未请求的 preview route/page，skill 会在 checkpoint 保护下自动清理。

确认安装成功：

```bash
test -f .claude/skills/brand/SKILL.md && echo "brand skill installed"
test -f .claude/skills/brand/scripts/brand-guard.mjs && echo "brand guard installed"
```

更新到最新版本时，在业务项目里重新执行同一段安装命令即可。

## 同步

维护源目录：

```bash
skills/brand/
```

改完同步 Claude Code 镜像：

```bash
npm run sync:skills
```

不要手动维护两份 skill。`.claude/skills/brand/` 是 Claude Code 镜像，由同步脚本生成。

## 怎么用

### 维护这个 Skill

在这个仓库里使用，目标是更新工具本身。

示例：

```text
帮我更新 brand skill，让它支持从截图里提取颜色频次，并同步 Claude 版本，然后 push。
```

会改动：

```text
skills/brand/
.claude/skills/brand/
scripts/
references/
README.md
```

推荐流程：

```bash
npm run sync:skills
diff -qr skills/brand .claude/skills/brand
npm run build
git add --all
git commit -m "Update brand skill"
git push
```

### 在业务项目里应用品牌风格

在开发者自己的项目里使用，目标是把某个品牌风格应用到当前项目或 demo。

示例：

```text
用 brand skill，把 https://example.com 的品牌风格迁移到当前项目，先给我 3 个 demo 方向。
```

典型输出在宿主项目里：

```text
migrations/{brand}/
src/styles/brand-theme.css
src/pages/BrandPreview.vue
```

在业务项目里使用 `/brand <URL>` 时，不需要选择模式。skill 会自己判断是否已有 style pack：有就复用并应用到当前项目，没有就先学习再生成可预览页面。只有当你明确说“更新/维护 brand skill 本身”时，才回到本仓库改 skill。

## 使用场景

- 为其他项目先生成 2-3 个 demo 视觉方向，让用户选择风格。
- 统计品牌高频颜色、圆角、间距、阴影和组件模式。
- 生成 `migrations/{brand}/` 下的 DTCG、Echo mapping、dangoui adapter、component mapping 和 README。
- 把已确认方向应用到 demo，同时区分正式 `--du-*` token 和 `demoOnlyVisualControls`。

## Demo 的目标：品牌学习能力测试

`learn-brand` 的 Demo 不是官网镜像、宿主项目成果，也不是把 Logo、品牌色和官方素材装进固定模板。它只回答一个问题：**Brand Skill 是否从证据中学会了可迁移的视觉语言，并能用这些规律重新组织页面。**

完成 Demo 必须同时给出三类证明：

- `Evidence Proof`：每个高显著度设计决定都能追溯到源站 DOM、computed style、独立资产、动效或截图区域；没有证据的标题栏、底色、边框和装饰必须阻断。
- `Structure Proof`：构图、信息层级、密度、页面类型和浏览节奏保留了品牌决定性特征，不以“用了官方素材”代替结构还原。
- `Generative Proof`：先用 reference pages 校准规则，再用未参与校准的 `held-out generative challenge` 验证同一规则能生成新的同类页面；不得复制整张官网截图或只替换素材。

Reference page 用于校准和回归，不单独证明泛化。Held-out challenge 在规则冻结后才揭示给实现/验收链路；失败必须回到 Evidence / Interpreter / Demo 的实际责任角色修正，再由新的 Blind QA 复验。

`apply-host` 是独立工作流：它验证视觉语言在真实业务中的可迁移性、效率和边界，不计入 learn-brand Demo 的三证，也不能用 Demo 地址冒充宿主交付。

## Claude 试用话术

给 Claude Code 或 Claude.ai 测试时，不要讲内部实现。让它扮演第一次使用 skill 的运营/vibecoder，直接从一句话开始。URL 可以是任意品牌官网，也可以是未来 demo/registry 站点地址：

```text
/brand <品牌官网 URL 或 demo 站 URL>
```

如果要测试“已有风格包直接复用”，用：

```text
/brand <品牌官网 URL 或 demo 站 URL>，把当前项目套成这个风格，先给 2-3 个预览页面；如果本地或 registry 已有匹配 style pack 就直接复用。
```

验收重点：Claude 不应该要求用户理解 `assetRoot` 或 mapping 文件；它应该自动找已有 migration/style pack，找不到才重新采集 URL，并输出可预览页面、资产分层和 DangoUI 缺口清单。

如果是在另一个本地业务仓库里测试，要先把 skill 和全量本地 style packs 一起装过去。推荐直接使用 README 顶部“快速安装到任意测试项目”的命令。

等价命令如下：

```bash
mkdir -p .claude/skills migrations public/assets
rm -rf .claude/skills/brand
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/.claude/skills/brand .claude/skills/brand
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/migrations/. migrations/
cp -R /Users/jocelyn/Downloads/vibecoding-docs-demo/public/assets/. public/assets/
```

安装完成后，提醒用户：

```text
已安装 brand skill。你现在可以用：
/brand <品牌官网 URL 或 demo 站 URL>

它会自动判断是否复用本地/registry style pack；没有可复用资产时，会采集 URL 或让你补截图/Figma/HTML 等素材。常见用途：学习一个网站风格、生成 2-3 个预览页面、把已沉淀风格应用到当前项目。
```

如果 WebFetch 抓不到官网，Claude 应优先扫描 `migrations/*/style.json` 和 registry，看是否有匹配 style pack，而不是先让用户贴 CSS。

## Demo 唯一地址

Demo 站支持每个参考站、页面和说明项的唯一地址：

```text
/#/brand/{brand}/pages/{pageId}
/#/brand/{brand}/style/{styleCategory}
/#/brand/{brand}/components/{componentName}
```

例子：

```text
http://127.0.0.1:5174/#/brand/hpma/pages/hpma-home
http://127.0.0.1:5174/#/brand/czn/style/color
http://127.0.0.1:5174/#/brand/dango/components/navigation-bar
```

以后公开站点上线后，用户可以直接：

```text
/brand <demo 站某个参考站地址>
```

skill 应从 URL hash 解析 brand/page/style/component，再匹配对应 style pack。

## 当前研究重点

重风格网站先作为黄金样本研究，不急着证明 skill 泛化：

- 1999 / HPMA / CZN 这类游戏站、剧本杀站、IP 活动页。
- 重点追踪 PNG/WebP/SVG 资产、字体包、纹理、装饰边框、选中背景、插画和场景图。
- 阶段看板见 `research/okr.md`。

## 验证

```bash
npm run build
```
