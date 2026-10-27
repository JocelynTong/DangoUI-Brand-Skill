# 临界 Web 试用包 0.1.0-trial.1

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

重建：`node migrations/linjie-theme/build-trial-package.mjs`。生成只更新候选物料及文件哈希，不会写已验证状态。独立 QA 结果应单独保存，不篡改历史 receipt。

Web 兼容补丁：DangoUI 3.6.16 对原生输入空串会回退读取 `event.detail.value`。试用容器捕获空值 input 事件，补上该字段，仍由真实 DuInput 发出更新；请单独验收全选删除至空及重新输入。此适配未修改 node_modules，也不代表上游已修复。
