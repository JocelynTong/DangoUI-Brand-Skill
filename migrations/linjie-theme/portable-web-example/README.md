# 临界品牌包：独立 Web 消费复现

这是阶段 1 的 Vue Web 试用脚手架，使用已安装的 `LinjieCoreTrial`，不是完整临界组件库，也不是小程序接入证明。此目录只保存轻量源码与依赖锁；不要直接在这里启动，先通过公开安装入口准备仓库外的独立目录。

检出 `codex/linjie-portable-web-trial` 试用分支并记录 `git rev-parse HEAD` 后，从仓库根目录执行（需 Node.js 20.19+ 或 22.12+ 及 npm；建议 Node.js 22.12+）：

```sh
node migrations/linjie-theme/portable-web-example/prepare.mjs ../linjie-portable-web
cd ../linjie-portable-web
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run dev
```

打开 http://127.0.0.1:5197/ 。若端口已占用，停止自己的旧预览，或执行 `npm run dev -- --port 5198` 并使用终端给出的地址。目录必须是新的或空的，且在制作仓库外；脚本不会覆盖既有工程。

`prepare.mjs` 以自身位置解析仓库，调用现有公开 `run-brand-workflow.mjs install-web-trial --mod-file … --destination-root … --brand linjie`，保留 `public-install-receipt.json`，再复制本目录已测试的消费页源码与 lock。入口导入安装目录中的 `migrations/linjie-theme/runtime/linjie-components.mjs`；不引用制作仓库源码、不链接其 node_modules。安装成功只表示文件和哈希校验通过，仍需真实运行与交互测试。

检查 Light / Dark、空输入校验、填写后提交反馈、取消重置、禁用及加载按钮、390px 窄屏和控制台错误。数据只是本地演示，不调用真实后端。截图/录屏与结果由测试者补充；未测、阻塞和失败分别记录，不默认 PASS。

## 阶段 2：菲菲在真实小程序验证

菲菲作为种子用户 3 号，在自己的电脑拉取最新 GitHub 代码，并确定实际小程序工程及目标页面后再测试。这里的 Web 安装入口不能直接安装到小程序，也没有把现有宿主假定为 DangoUI。先填写 [反馈清单](./FEIFEI-FEEDBACK.md) 的框架、组件来源与运行环境；不兼容时记录真实错误和所需适配，不绕过平台检查。

阶段 2 等待外部实测结果。阶段 3 未授权；没有生产、后端接口或业务行为完成承诺。

公开准备命令使用同级 `runtime-only-distribution/brand-mod.json`。该分发包仅携带原四个哈希绑定文件；来源证据以未随包提供的引用及哈希追溯，保留 Figma 链接和节点文字。没有截图不代表来源验收通过；原完整品牌包未被修改。

本次已验证范围和未解决项见 [VALIDATION.md](./VALIDATION.md)。
