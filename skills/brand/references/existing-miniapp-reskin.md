# 已有小程序中的品牌换肤

## 设计师的正常输入

“/brand 把当前小程序换成临界风格，保留现有功能。”即为换肤试用授权。由 Agent 做下面的准备、实施和调试，不要求设计师输入命令、recipe ID、manifest 或先跑独立 Web 工程。页面不明确时优先当前页面/已有启动页；整项目请求分批处理，明确覆盖范围，不偷偷缩成按钮演示。

## 找到项目与品牌

读取当前项目说明与构建配置；项目根有 frontend 时检查它。确定 Taro/原生/uni-app、Vue/React、sourceRoot、当前页、构建脚本、组件来源及原有调试器。读取项目已有 AGENTS/DESIGN/README，不执行配置来猜平台。当前机械隔离入口支持 Taro Vue3；其他平台如实说明未覆盖并按其已有工程方式适配，不能强行拷贝 Vue Web 组件。

临界随 skill 更新提供：`<skill>/assets/style-packs/linjie/brand-mod.json`。它是候选局部视觉参考，含明暗颜色、Primary Solid 48/36/28 按钮子变体尺寸事实及来源边界，未包含全部组件状态和来源截图。读取 manifest、componentVariants、tokens、kit.designGuide 和其声明文件；尺寸、字体与状态只应用于 guide 明确匹配的变体，White/Trade 字体不推广为 Primary，Dialog 内 Large40 不替代通用按钮48，未匹配的 Tabs/卡片/底部 sheet 保留宿主值，不将未附证据改写为 observed/approved。禁止从品牌名自行猜值、套用 Web DangoUI 默认尺寸、把未知状态涂成紫色。缺少精确规则的项目保持宿主可用样式并列为未覆盖。

## 沿用公共入口与隔离试装

执行 Agent 根据真实上下文填写命令（不是给设计师的作业）：

```sh
node <skill>/scripts/run-brand-workflow.mjs run \
  --request-kind host-concepts --mode design-host \
  --brand-root <skill>/assets/style-packs/linjie \
  --host-target <真实前端根目录> --module-target <当前页面.vue> \
  --module-id linjie-page --module-task '<真实换肤范围和必须保持的行为>' \
  --candidate-kit linjie-core-web-trial \
  --trial-authorization '<本轮用户的真实换肤授权>' \
  --artifact-root <仓库外尚不存在的隔离目录> --build-target weapp
```

返回 dispatch 后继续执行，不把准备成功当换肤完成。该路径读取候选 kit 作为 reference-only，保留全部候选与证据状态；不会把 Web 组件直接装到小程序。原有 approved recipe 路径的证据检查不变。所需额外构建输入用已有 --host-support-files 精确补入，不带凭据、不上传代码。

## 真正修改当前页面

优先映射宿主已有 token 和样式入口，保留原组件与事件、路由、接口、权限、数据。没有 DangoUI 也可以在当前组件的局部样式中适配，不迁移整库、不替换业务为演示。查看原生 button、loading/disabled、表单错误、滚动/安全区、导航壳；特别检查宿主原主题的 border、min-height、box-shadow、focus/hover 和原生导航配置是否残留；主色变了但旧品牌描边仍在，不能通过。颜色、尺寸、圆角、字号、间距分别核对来源，未知的明确列为未验证。

在隔离副本改已授权目标，可新增组件限定在 dispatch 允许目录。平台样式使用实际 class 与 page/页面根作用域，不复制 DOM 选择器、:root 或浏览器专属组件。先看设计宽度与单位换算，例如 375 设计宽度下源 48 设计像素不能写成 48rpx；真实编译/测量确认。不要更改业务语义来迎合规范示例。

增量更新以宿主当前版本为新 baseline；已有 72/56rpx 中小按钮在 375 画布对应36/28设计px时保持，不为展示改动而重写。不得恢复上轮备份覆盖用户后续业务或样式修改。保持原目标不可变备份及受保护文件哈希。编译读宿主现有脚本；沿用已安装依赖时说明是依赖复用验证，不冒充新机安装。复用原调试工具打开隔离副本的实际小程序产物，不要求用户开 Web demo。必要的账号/后端沿用宿主正常环境，不复制密钥，不伪造业务数据通过。隔离产物如缺 appId，核对隔离产物 project.config.json 的 appid 与宿主既有真实应用标识一致（仅产物配置，不改冻结源码），再在原开发者工具绑定，仅本地调试；不使用虚构 appId、不上传发布、不改变权限，无法获得合法绑定时如实报告运行未验证。

## 验证、交付、回写

独立检查：目标页 template/script 与事件数据未被越权改动、非目标文件哈希一致、实际 weapp 构建、调试器中的前后外观及输入/取消/提交/跳转/滚动和原有异常状态。不能只用静态测试、构建或 H5 截图证明小程序运行。涉及真实写操作时用已授权测试环境，否则明确未测。

用户已要求换肤，不需重复索要实施许可。隔离版通过后，可将已验证的目标改动回写当前项目：回写前重核原文件哈希，若项目期间发生变化则重新合并并验证，禁止覆盖新修改；保留准确备份和本次 diff。无完整运行证据时保留候选副本、告诉用户具体未测项，不默默宣称当前项目已换肤完成。

交付给设计师：原有调试入口、改了哪些页面、哪些状态没测、如何恢复，以及一句反馈提示“发截图 + 操作步骤 + 预期效果”。工程细节由 Agent 处理。不要要求安装独立 Web 示例，不把 candidate 标为正式品牌认证。
