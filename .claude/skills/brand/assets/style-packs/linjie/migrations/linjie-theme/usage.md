# 临界 Web 试用包 0.1.0-trial.2

这是设计师对照验收用的局部试用包。使用真实 DangoUI 3.6.16 的 DuButton、DuNavigationBar、DuForm、DuFormItem、DuInput。并非小程序自动换肤，也未认证所有临界组件。

## 运行

在 Vue 3 / Vite Web 宿主安装 `vue@^3.5.35`、`dangoui@3.6.16`。由应用入口只加载一次 DangoUI 基础样式；已有主题应用不要重复加载并覆盖主题。

```js
import 'dangoui/theme.css';
import 'dangoui/style.css';
import { LinjieCoreTrial } from './runtime/linjie-components.mjs';
// render with h(LinjieCoreTrial, { theme: 'light' }) or theme: 'dark'
```

组件自己加载 `.linjie-trial-theme` 局部 CSS；不会写入全局 :root 或替换宿主已有主题。移动端浏览器尺寸仍是 Web，不能当作小程序运行证据。

## 明天怎么试

1. 同时查看 Light / Dark 来源变量截图及真实组件样例。
2. 修改标题，清空后提交应提示输入；输入后提交只更新本地反馈。
3. 取消恢复初始值；点击加载中、已禁用按钮不增加提交次数。
4. 暗黑背景、文字、分割线及紫色按钮逐项与 source-20261026 证据核对。
5. 记录“来源视觉不一致”“组件功能缺失”“宿主接入问题”，不要把三者混为换肤失败。

清空操作使用额外真实 DuButton；DuInput 内置清除图标使用 touchstart，不宣称桌面 click 已兼容。禁用输入不是只读输入。校验提示是样例业务逻辑，不是 FormItem 原生 error API。返回仅反馈事件，不跳转路由；提交没有网络请求。

## 来源与边界

trial-source-audit.json 记录 2026-10-26 Figma Desktop 本地缓存中的 Tokens-LJ 11 条变量、两模式 22 个值。531 是集合显示数量，未全量提取。截图只展示部分行，配套 AX 文本记录解析值。当前云端最新状态未确认。历史 QD 绑定实例不因本包存在而自动通过。

brand-profile.dtcg.json → runtime/linjie-tokens.css 与 brand-mod.json 同一生成源；dangoui-adapter.json 记录局部 style token 消费位置。全局 semantic role 明确拒绝晋升，运行样例的 --du-* 是局部兼容别名。48px 按钮高度来自 Button 主组件属性面板 Large(48)（button-component-set 截图与 AX），但未完成逐状态 Figma 像素复核；排版间距是试用页展示布局而非品牌规范。

## 可复用与研发接力

用公开 `--mod-file` 安装入口消费 brand-mod.json 的 componentKits；保持 migrations/linjie-theme 路径树以兼容项目相对包引用。宿主研发先确认是否 Vue Web、DangoUI 版本及 CSS 入口，再确认路由、真实表单校验和提交 API。小程序或其他组件框架需要单独适配及真机验收。品牌包不拥有业务接口，也不替换生产功能。

维护者重建：仅在具备完整私有来源工作区（含 captures）的情况下运行 `node migrations/linjie-theme/build-trial-package.mjs`。安装 skill 的消费者无需重建；公开分发不含私有 captures，不能在安装包中运行此命令。生成只更新候选物料及文件哈希，不会写已验证状态。独立 QA 结果应单独保存，不篡改历史 receipt。

Web 兼容补丁：DangoUI 3.6.16 对原生输入空串会回退读取 `event.detail.value`。试用容器捕获空值 input 事件，补上该字段，仍由真实 DuInput 发出更新；请单独验收全选删除至空及重新输入。此适配未修改 node_modules，也不代表上游已修复。


## 0.1.0-trial.2：现有小程序的限域参考（2026-10-27）

本次增量补充来源事实和适配边界，不新增 Web runtime 实现，也不代表小程序组件库。由 `/brand` 现有 module-task 候选入口读取本 guide，保持宿主组件、数据与交互。精确来源为 Figma 文件 `rWa4hTLYc3DU3vRogRcvcF`，Button definition `139837:430870`；来源来自本地缓存，云端新鲜度未确认。下列 AX 已由来源审查重算 hash，尚未在本轮重开全部截图独立认证；原始私有 AX/PNG 不随 skill 分发，文件名与 hash 仅用于追溯，不能声称使用者已取得截图。

### Primary Solid 按钮尺寸：按准确子变体使用

| Size / Disable | child node | 观察到的高度（设计 px） | 原始 AX 文件（full-learning-20261026） | SHA-256 |
| --- | --- | --- | --- | --- |
| Large / False | `139837:430856` | 48 | `button-state-280.txt` | `a900009c27eefce46d814b3bf1ad967e7473f19242a63432303082cd17dd31bd` |
| Medium / False | `139837:430844` | 36 | `button-state-232.txt` | `a48d04057ec681f26c3d5bfe66fd9f380797780431d4a65482538ca369396c8d` |
| Small / False | `139837:430867` | 28 | `button-state-136.txt` | `1182a93731ad48f4a76db6b221b4876ab65b4cc3027f8179b357308fd82cfacc` |
| Large / True | `139837:431113` | 48 | `button-state-279.txt` | `0cafcc33cbde96b37b8e9258d4d9716229319d178f0e3e06bd1c184bdaea6989` |
| Medium / True | `139837:431121` | 36 | `button-state-231.txt` | `9832383187c0ea86636f9c9342044e127e4ecc53485539335ce9b7dcf625dee9` |
| Small / True | `139837:431137` | 28 | `button-state-135.txt` | `53b5f56ac498082a8c3bee1534ac0dc7e7789e941ee9ccbff380a932013c4f37` |

高度依据是选中 child 的 Vertical resizing 与 Size 轴一致，不是只从组件命名猜测。只适用于上述 Primary / Solid 子变体；对宿主先确认按钮角色和当前单位，不能所有按钮统一48，也不能把尺寸事实当圆角、字体或全部状态证明。

在375 CSS px设计画布中，48/36/28设计px分别对应96/72/56rpx。雪菲报告已有Medium72rpx、Small56rpx，数值已对应来源高度，**保持即可，不为换肤重改**。Taro designWidth750下不得把设计48直接写成48rpx；如果使用编译前px，依据宿主designWidth/deviceRatio核对产物，不能套用另一个工程换算。截图的85%预览倍率不改变设计尺寸，物理截图像素不直接当CSS px。

### 禁用与加载

上述 Disable=True child 观察到了白色文字 `component/button/primary/solidDisabledtempColor`；包中另已有主禁用背景紫色24%及文字模式变量。但变量表不等于该child内部背景绑定已确认：**不得宣称禁用配色逐层已认证，不通过统一opacity猜测状态**。保留宿主disabled/loading的事件拦截、业务语义和当前未匹配视觉。Loading不在此次Button已观察轴中；ShareSheet_Loading不是按钮loading依据。

### 字体、弹层与其他组件的范围边界

- White Solid Medium：parent `139837:430764`，nested instance `139837:407874`，Text层路径观察Heavy/H6、PingFang SC Medium、14/22、字距0%。White Solid Small：parent `139837:430756`，instance `139837:407882`，Heavy/H7、12/18、字距0px。Trade Solid Large：parent `141937:605532`，instance `141937:605533`，Heavy/H5、16/24、字距1%。这些只属具名White/Trade样本，独立text node/styleId尚未解决，**不可推广为Primary按钮字体**。Primary字体本轮保持宿主值。
- Dialog definition `141259:593297`，middle child `141259:593309`有311×331、Radius/Large16、bg/3事实；plain child `141259:593298`标题HeavyH5 16/24，内部动作记录**Large40**。该Large40来自原始截图中带「千岛」标记的内嵌组件观察，**不是已确认的临界按钮规范，不能据此把报名确认按钮改40**；这里只作为不能统一套尺寸的风险证据。Dialog内部Large40不等于上述Button Large48；中置Dialog不能套到底部报名sheet。宿主报名弹层未完成语义匹配，保持其当前布局和样式。
- Tabs Basic definition `139689:2616507`，Normal非Ghost selected `139689:2616526` / unselected `139689:2616536`有text/1与text/3观察。但投票页紫色下划线尚未匹配此类型，indicator与字体未完整确认，不强制替换。
- 投票卡片、通用圆角、间距、阴影、brand-soft及所有深色状态仍未建立本页准确映射。不得将Dialog radius16推广为全局规则，不从其他颜色变体补Primary值。未匹配区域保持宿主可用样式并列出缺口。

### 增量验收

同一页当前版本建立新baseline与回退点，只改有来源且匹配的规则；保留原有橙色榜单主题与业务。核对源码/产物尺寸、前后同视口截图、按钮状态、Tabs切换、报名弹层开关及滚动/返回。来源事实整理通过不代表雪菲页独立视觉通过；真实报名、投票、发帖、真机、深色未经实测不得标通过。没有用户报告的截图及宿主工程时，不签署宿主语义匹配或视觉结论。

此guide由制作源 `migrations/linjie-theme/usage.md` 维护；现有 `build-trial-package.mjs` 从它读取并生成kit文件hash，不生成或覆盖guide正文。分发时保持该文件字节并更新manifest对应hash，不手改产物后用旧guide重建。
