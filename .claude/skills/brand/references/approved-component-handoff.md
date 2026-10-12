# 已认可单模块的实施交接

这是现有 `apply-host` 的显式单模块输入，不是整页设计/品牌学习门禁的替代。仅当用户已认可准确组件并要求实施该模块时使用；编排者准备 manifest，普通用户不填写内部 JSON。

```sh
node <skill>/scripts/run-brand-workflow.mjs run --request-kind host-implementation --mode apply-host --component-handoff <absolute-manifest.json>
node <skill>/scripts/run-brand-workflow.mjs status --component-handoff <absolute-manifest.json>
```

manifest schema 为 `approved-component-handoff/v1`，包含：

- `scope: "single-module"`。
- `sourceRoot`：准确组件文件根目录绝对路径。
- `kit`：`id`（安全小写连字符标识）、`framework: "vue3"`、`runtime: "browser-dom" | "taro"`、`entry`、`stylesheet`、`files: [{path, sha256}]`、`usage`。所有文件为受限相对路径；usage 必须包含数据接口、事件和必要使用说明。Web 保持现有 entry 与外部 stylesheet；Taro 必须为已批准的 `.vue` SFC，内置 style 时可省略 stylesheet。
- `approval: {kitSha256, statement}`：kitSha256 是 `sha256(JSON.stringify(kit))`，statement 引用真实用户认可及范围；哈希只绑定准确版本，不自动证明审批真实性，编排者不得代写虚假批准。
- `host: {root, target, sha256, protectedFiles: [{path, sha256}]}`：宿主绝对根、唯一可编辑文件及原始哈希；受保护文件必须含 package.json，并应覆盖业务记录、数据请求、路由、状态、事件处理所在文件。
- `protectedBehavior: [string]`：本模块须保留的具体业务行为。

run 验证批准、文件哈希和平台，将准确 Web 组件安装在宿主 `.brand-components/<id>/`；Taro 组件安装在已核实的 `<host.taro.sourceRoot>/.brand-components/<id>/`，使 SFC 进入宿主编译范围。冻结目标原件，返回实施 dispatch；不会编辑目标源码。实施者只按 dispatch 绑定原有数据与事件，不重画组件、不增加覆盖样式。跨平台只报告需要适配；检测到 Taro 依赖优先于 Vue，未知环境拒绝直接复用。不会自动把 Web kit 转译为 Taro；Taro React 不支持。修改库或扩大目标范围须重新确认，不能重跑洗掉原始基线。

Taro 增量字段：

```json
{
  "kit": {
    "runtime": "taro",
    "framework": "vue3",
    "entry": "Item.vue",
    "targets": ["weapp"],
    "dependencies": ["vue", "@tarojs/taro", "@tarojs/components", "@tarojs/plugin-framework-vue3"]
  },
  "host": {
    "taro": { "sourceRoot": "src", "configFile": "config/index.js", "buildTarget": "weapp" }
  }
}
```

此片段是增量，仍须填写完整 manifest 的文件 hash、批准和保护字段。`targets` 明确组件获准使用的平台，必须包含宿主 `buildTarget`；`dependencies` 至少包含上列四项，全部须存在于宿主 package.json。入口只校验 Vue 3 声明及依赖存在，不解析 semver 兼容性、不安装依赖；usage 要说明实际验证过的 Taro/依赖版本、尺寸配置及平台限制，真实编译 QA 再确认兼容性。

`configFile` 必须被 protectedFiles hash 保护，且包含唯一字面量 `sourceRoot` 和 `framework: 'vue3'`；不执行配置。支持安全相对路径的自定义 sourceRoot，目标必须是其内 `.vue` 文件。动态值、多个候选声明或无法确认的配置拒绝自动安装。编排者须确认环境合并等不会覆盖这两个值，并将影响它们的配置文件列入 protectedFiles；本入口的字面量检查不等于求值完整 Taro 配置。dispatch 会透明返回 runtime、framework、targets、dependencies、导入路径、可改目标、保护行为和 `runtimeCheck.configEvaluation: 'literal-declarations-only'`；下游须先确认实际生效配置，再在声明平台编译、接线并做独立运行检查。

status 只检查已冻结输入、安装文件、受保护文件和真实相对静态 import（Taro 内置 style 的 SFC 仅要求 entry import），结果最多 `implementation-linked-awaiting-independent-qa`。它不证明组件被渲染、业务保持或视觉一致；独立执行者还须审查目标源差异，在实际运行页观察认可设计、数据、宽度与业务交互。Taro 平台须在声明目标的真实 runtime 检查，Web 浏览器截图不代替小程序验证。`fullWorkflowPass` 和 `userGoalCompleted` 始终为 false，单模块成功不得升级为整个品牌/全宿主认证。

## 候选模块隔离试验

### 普通输入自动准备

已有学习包的单模块任务优先走此入口，不写内部 manifest，不依赖旧聊天或实验目录。当前支持包中 `componentVariants[].component=local-style-recipe`，其 `evidenceRefs` 关联同目录 `brand-evidence.json.claims`，以及 `tokens.styleOnly[].recipeId`。不声称任意品牌格式、组件库或整页自动选型已经支持。

品牌身份兼容 `manifest.id` 与已发布 MOD 的 `manifest.brand`；同时存在时必须一致，并匹配 evidence.brand。该兼容不转换设计内容：只有组合描述而没有 local-style-recipe 时返回 `MODULE_PREP_RECIPES_REQUIRED`，由学习侧补齐有依据的局部配方，不能重标旧状态或让实施者临场猜样式。

```sh
node <skill>/scripts/run-brand-workflow.mjs run --request-kind host-concepts --mode design-host \
  --brand-root <原品牌包绝对目录> --host-target <原宿主绝对目录> \
  --module-task '<本轮准确单模块任务与须保留行为>' --module-id <安全小写任务ID> \
  --module-target <宿主相对Vue文件>
```

第一调用只读返回现有候选的适用范围、限制和描述，不校验无关历史截图，候选依赖状态明确为 `not-checked-until-selected`，不能称已可用。执行 Agent 自己根据任务选材，不把 recipe ID 选择推给用户。随后重复同一命令并增加：

```sh
--recipes <执行Agent所选逗号分隔ID> \
--trial-authorization '<用户真实授权的隔离试装范围，不可捏造批准>' \
--artifact-root <父目录已存在且叶目录尚不存在的隔离绝对路径>
```

可以改用 `--mod-file <绝对MOD路径>`，默认以其所在目录为品牌根；显式 brand-root 时 MOD 必须在其内。项目根相对的 `migrations/<brand-id>/...` 与包根相对依赖均支持。不会执行配置、联网补录、安装依赖、修改原宿主。只复制宿主 sourceRoot、config 和固定构建配置/锁文件，跳过所有隐藏路径段（仅 `.brand-components` / `.brand-trials` 合法源码目录例外）、`qdmp.json`、node_modules、dist、`application_default_credentials.json` 与 pem/key/p12 文件；源码中的符号链接拒绝复制。回执透明声明这只是文件名排除策略，不是秘密内容扫描，不能保证任意普通源码文件不含凭据。依赖安装、认证/平台配置仍须遵守宿主权限。

自动生成 `task.json`、`dispatch.json`、`brand/selected-recipes.json` 与 `host/` 副本，继续调用原 `component-task` 校验。切片保留真实来源 manifest/scope/limitations、所选 recipes 与关联 styleOnly token、claims 与其中全部 path+hash 依赖（包括 before/after capture）；每个 claim 必须有合法 capture 或 sourceCapture，出现的 capture 字段不能为空或缺 path/hash，before/after 必须成对。任一选中证据缺失/漂移即在写入前阻断，不以“局部任务”跳过。其它 recipes 不被判为可用。截图只能审核，不能进入运行组件；未包含的 demo/字体/图片/布局契约不是可自由引用资产。现阶段是来源 recipe 薄适配，不是自动转译已有 Vue 库或自动执行设计。

目标仅限 Taro Vue3 `.vue`、唯一字面量 sourceRoot/framework，默认 weapp，可显式 `--build-target h5`。新副本不含 node_modules/凭据，真实运行检查仍须在已有合法环境完成。根目录存在的 README、DESIGN、AGENTS 随副本保留并受 hash 保护；不要求项目预先拥有这些文件。原宿主全部复制源码（除目标）自动 hash 保护，`.brand-components` 同时作为已接受组件保护；目标文件内仅任务范围可改，语义保护仍需独立 diff/运行 QA。输出为 pending 试装 dispatch，不能报告整页旧路径已修复、整个 Skill 已通过或用户已批准。

若已读的宿主构建配置或脚本依赖固定清单外的现有文件，执行 Agent 可用 `--host-support-files <逗号分隔的宿主相对文件路径>` 明确补入；这些文件同样只读复制并进入 protectedFiles，不扩大可编辑范围。不接受目录、符号链接、目标源码、越界或上述敏感路径；不会执行文件或自动安装依赖。文件名排除仍不等于内容保密审查，执行者须确认所选文件确为必要构建/测试输入，不让用户填写清单。

### 准备后继续交付

`dispatch.execution` 给出宿主说明、原有构建脚本、依赖环境候选与独立复核职责。准备只是中间节点：用户已授权隔离实现时，编排者继续派发生产、在许可环境中编译并由另一执行者检查真实运行，最后交付可运行副本与明确限制，不要求用户反复说“继续”。用户只要求准备输入时才停在此处；后续新增授权不能改写旧 task，应保留原件并明确续接范围。

依赖复用属于环境准备，不是品牌设计能力；允许使用现有依赖时须检查兼容性并禁止写入共享依赖，不声称证明了全新安装。读取宿主 build 脚本及配置后再执行，不猜构建目录，不上传。配置引用了复制范围外的文件、环境或凭据时，报告准确缺件，不静默扩大复制范围。运行 QA 可由编排者或独立审核者实际操作，记录谁做了什么；实施者不能自批。交付分列源码/构建、原生运行、设计保持、未测项，不套用只检查背景变化的 Web 证明替代原生组件检查，也不得将不适用的 validator 标 PASS。

用户明确授权从已有品牌资产选择并适配一个现有模块、尚未认可准确组件时，走公共 `run --request-kind host-concepts --mode design-host --component-task <absolute-manifest.json>`。本入口只读必要文件并返回生产者 dispatch，不安装、不修改宿主、不消费全品牌历史证据、不改变原认证。无需预制 Taro 组件，也不走 approved handoff。

编排者准备 `component-selection-task/v1`：`scope: "single-module"`、`authorization: {scope: "isolated-trial-only", statement: <真实试验授权>}`、`approval: "pending"`、`module: {id, description}`、`protectedBehavior: [string]`。

- `brand: {id, root, candidates}`；root 为现有资产绝对根。候选为 `{id, runtime, framework, files: [{path, sha256}], usage: {path, sha256}, capability: {path, sha256}}`。usage/capability 是现有使用与能力说明文件；相对路径及 hash 绑定准确候选，编排者不得提前替生产者选定适配结果。接受 `browser-dom/vue3`、`browser-dom/html` 和 `taro/vue3`；HTML 是 reference-only，Web 必须适配。
- `host: {root, trialRoot, sourceRoot, target, sha256, configFile, buildTarget, protectedFiles, acceptedComponents}`。原宿主与已准备的试装副本为不同且互不嵌套的绝对目录。target 是 sourceRoot 下准确 `.vue`，两个副本必须匹配原始 sha256；protectedFiles 和 acceptedComponents 均为 `{path, sha256}` 数组，两侧都核验，前者至少保护 package.json 和 configFile，后者列出现有已接受组件，不能遗漏已接入成果。当前只支持 Taro Vue3 的 weapp/h5，configFile 仅静态核对 sourceRoot/framework，不求值环境合并。

dispatch 给出全部候选绝对路径/hash、目标、保护行为及平台限制。生产者先基于能力与真实宿主选择并解释候选，再薄适配；只可改副本 target，并新增 `<trialRoot>/<sourceRoot>/.brand-trials/<module.id>/` 内单组件文件，不能扩大页面或改受保护业务。该目录必须尚不存在。真实目标编译及另一执行者的源码/运行/视觉复核仍必需；H5 不证明 weapp。入口最多返回 `awaiting-adaptation` / `awaiting-isolated-trial`，始终 pending approval、`fullWorkflowPass:false`、`userGoalCompleted:false`；准确产物获得真实认可后才可准备上面的批准交接。本轮没有 status 或自动晋级。
