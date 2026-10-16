# 对话意图与首轮预览协议

## 冻结当前轮意图

当前请求优先，并承接本会话尚未取消的明确目标、选图和授权。其他会话的维护安排不等于本会话收到的用户指令；历史产物、旧 migration 或碰巧存在的品牌目录也不能替用户决定动作。

先判请求，再读取对应状态：明确重新生成三案就新建隔离批次；明确选 C 并要求单页落地就使用准确图片原轮次的 select-image-code，不问重新生成还是继续单页。当前短句可承接本会话已明确而未取消的任务；不能只因出现历史单页就改道。只有品牌链接且无未完成明确任务时，默认三图探索，不增加固定二选一。只有多个 C 无法辨认时才给相应缩略图/链接问选哪张；目标页或实施授权确实缺失时仅询问该缺口。选择新探索不替换旧 Master，单页通过不授权整体换肤。

品牌和宿主已经明确的新三图请求，未指定页面时默认宿主首页：只读启动入口/路由并沿用其真实业务，不把“哪个页面或任务”列为必填追问。init 使用已确认宿主的 `--host-confirmed`；返回的 `target` 是待从源码解析的首页范围，不是猜定的文件路径。说明“先用首页生成三个完整效果图，成功一张先展示，不改项目代码”后继续正常入口。明确指定页面或明确续修旧 H5 时保留其范围；无法确定启动页时才针对歧义询问。仅检查、不生图或暂停等明确限制仍优先。

必要澄清只问具体缺口，不附路由说明、授权清单、版本校验或“回归通过”报告。用户只确认单页时，简短确认已认可该页、尚不扩展其他页面即可；不要求连带授权整体换肤。简短不等于隐藏真实失败或缺图，影响用户决策的限制仍如实说明。

- “先看看能换成什么样”“首屏 3 个 Demo”“先确认风格”固定为 `host-concepts → design-host`。
- 只有用户明确要求建立、更新或重新认证可复用品牌包，才把独立交付目标设为 `brand-learning → learn-brand`；宿主预览内部需要品牌学习时，按下面的接力保留 `host-concepts` 父目标。
- 只有用户已确认 H5 并要求修改真实宿主，才使用 `host-implementation → apply-host`。

新的 `host-concepts → design-host` 默认 `--concept-medium full-image`：先由 ImageGen 生成三张完整界面效果图，不是三张背景再拼代码面板。实际图片输入包含互补官网截图和官方素材；设计师同时读取品牌规则、组件说明及宿主业务摘要。保持同一业务任务，允许重组页面与组件；测试数据仅在用户允许时使用并标注。记录实际 prompt、附件及三个生成结果，按 dispatch 的 `record-image-concepts` 命令提交，再由 `delivery` 返回可展示结果。三图齐全并完成独立视觉检查后停止等待用户选方向；图片不代表 runtime、DTCG 或组件已执行。

只有用户明确要求交互 H5 时传 `--concept-medium interactive-h5`。该阶段要求 ImageGen 做 Expressive 时再加 `--require-imagegen-expressive`，冻结 `goal.expressiveProduction.required=true`，设计阶段生成表达资产并与品牌 Productive 代码组合。不能把完整效果图目标自动升级为 H5，也不能以旧的 H5-only 要求拦截完整效果图交付。

新 `run design-host` 不依据旧 `execution-manifest.json` 推断介质。若返回 `IMAGE_CONCEPTS_FRESH_RUN_REQUIRED`，由编排者为新图片请求准备独立运行目录及完整品牌/宿主输入，保留旧目录，不为消除错误改传 H5 或擅自选旧 A。用户明确续修旧 H5 时仍走原轮次的 continuation/retry 入口；仅有旧 H5 而没有可选生图原件时，不能把 H5 截图冒充已生成图片或自动试装。

用户已认可准确组件且只要求实施该模块时，同属 `host-implementation → apply-host`，使用 [限域组件交接](../references/approved-component-handoff.md)；不把模块批准提升为整页批准，不要求重做三方向。平台不兼容时明确需要适配，不能用 Vue 框架相同推断运行环境相同。

尚未认可准确组件、但已明确授权沿用现有品牌与宿主开展单模块隔离选材/适配试验时，使用 `host-concepts → design-host --module-task <任务>`，输入品牌包根、宿主与准确模块路径，执行 Agent 从返回索引选 recipe，入口自动准备隔离副本和 hash-bound 交接（详见同一参考的“普通输入自动准备”）。不让普通用户填写内部 manifest；已有准确 manifest 可兼容 `--component-task`。品牌候选不得伪装成 approved kit；不扩建 Demo、不重跑无关整页方案，也不重判来源学习认证。

缺少品牌官网、截图、设计文件或已学习 style pack 时，只问这一项并停止。`design-host` 不得把用户目标降级为只交付品牌学习结果，也不得旁路学习验收；官网已提供时允许下面的内部学习接力。原始 `run` 必须显式传 `--request-kind`；入口会在 Registry 查询和写文件前核对它与 mode。

官网已提供但尚无品牌包，不属于缺用户输入。`design-host run` 返回 `prerequisite-dispatch-ready` 与 `source-prerequisite.json`；编排者自动执行其中同一公共入口的 learning.args，完成现有学习角色与独立 QA 后，用其有效 MOD 恢复原 host-concepts。父目标、宿主、隔离目录不变；这不是改成只交品牌 Demo，也不能把 dispatch 当学习成功。`--source-prerequisite` 仅让该学习阶段继续独立学习当前来源，不静默采用 Registry 候选。失败保留接力记录与具体缺口，不要求用户找内部文件，不自动无限重试。缺口涉及真实用户选择时才询问。

先区分链接类型：用户在宿主任务中直接给出本项目品牌库的 `#/variants/<id>/...`（新版）及 `#/brand/<id>/...` 页面，视为选择该已发布包，公共入口自动解析复用；不能把品牌库外壳当官网重新学习。包缺失、网络不可达或 hash 不符时报告准确故障，不回退抓取品牌库 UI。普通官网命中 Registry 仍只是候选，只有明确同意复用并传 `--reuse-style-pack`，或提供本地 `--style-pack` / `--mod-file` 才消费。Registry 学习证据留在隔离工作区，只有 MOD 声明且 hash 完整的 runtime assets 可进入宿主。

## 完整效果图生成失败时

本轮各方向均已尝试结束且有失败时，公共入口返回 `awaiting-user-choice`；仍有未执行方向时返回 `dispatch-ready`，继续当前轮已授权的合规方向，不重复询问。立即打开标准 `comparisonPreview`：0 张如实显示无图；1–2 张展示实际成功图，blocked 方向保留真实错误。轮次结束后询问“继续生成新一轮三份、选本轮或历史已有图落地单页、暂停”。已有图选定且明确要求落地，使用该图原轮次的 `select-image-code`；选择不把三图目标或旧失败改为 PASS。0 张时仍可选择当前会话明确已有的历史图；没有就如实说明，不假造图片或扫描其他项目。

用户说“继续生成”即授权新一轮三个全新完整方案，使用 `regenerate-image-concepts --artifact-root <旧目录> --brand <brand> --confirm-new-batch --feedback <用户原话及新方向依据>`，不传 `--missing-only`。旧轮不必三图齐全；旧图、原调用与失败记录保持不变，新轮不继承旧 checkpoint 或 PASS。每个新方向调用一次，成功一张立即记录并展示一张，某个方向 blocked 不阻止其他合规方向完成；本轮结束再次交给用户选择，不自动开下一轮。安全拒绝不能当网络故障重试，须核对原因并独立判断新设计合规，不能换词规避；用户授权不是安全批准。只有用户明确说“仅补缺失方向”才使用兼容的 `--missing-only --recovery-kind <technical-correction|new-design>`。

失败不改变 `full-image` 目标。先告知本轮实际已保存几张、失败方向、工具返回的错误及未知原因；保留已有图片、实际工具输入与报错，不擅自重跑整套。用户明确要求的新一轮与自动重试分开记录。使用 delivery 的 `failureGuidance` 汇报，不把派发成功、已有 H5 或历史图计为本轮三张图片交付。

不要仅因生图失败主动推荐 H5，也不把“转 H5”放在默认恢复选项里。网络/输入故障先核对原件，明确可纠正原因后按授权恢复；安全拒绝不自动重试、不换词规避、不猜测具体触发原因。用户主动询问可交互替代时，才解释 H5 是改变交付目标、不能保证相同视觉效果，并取得知情的明确选择；这不禁止用户原本就要求 H5。

简短说明示例：“本轮已保存 X/3 张，Y 受阻（原因按工具记录）。[查看结果及已有方案]。你可以说‘再来三个新方向’，或‘选历史第 N 轮 C，落地单页’，也可以暂停。”仅列真实存在的可选图；没有历史图就不提供虚构选项。记录中有 userChoices 不等于用户看到：最终回复必须包含可打开结果和适用选择，标准比较页也展示这些选项。历史轮次已经转 H5 的，接手续修时先说明转换记录和图片目标仍未完成，不能默默将其沿用为图片任务的完成路径。

## 隔离首轮试验

完整图的 `continue/delivery/status` 默认精简重复 dispatch（诊断原始返回才用 `--full`），完整输入仍在 `dispatchFile`。编排者直接运行 `coordinationCommands.preview`，复用同一服务并打开返回的比较路径，不翻服务源码。独立 QA 实看图片后，编排者依据其事实结论交付，不再并行重复读取三图做第二次 QA；具体矛盾或缺证才定点核实。QA 一次读取本轮三图、必要官方参考和绑定宿主事实，逐案报告业务缺失/虚构能力、品牌辨识、可读性与差异；未确认业务保持待确认，不能因省 token 放行。现有 failed 回执不因精简而改判。

统计必须包含主会话协调、设计执行者和独立 QA 的不重叠 turn，分别列缓存、非缓存输入和输出。复核已有图的实验只与同一批原图的复核阶段比较，生图次数为零、首图/三图生成耗时为不适用；不能以此声称整轮生图降耗。维护代码与实验准备单列，不计为用户运行。

生产候选和输入准备好后才启动执行者，不让生产者等待维护修复。一次读取必要原件，形成共同业务/品牌底稿并同时准备三案 prompt；原截图、素材、DTCG、映射和业务事实不因减 token 删除。工具按支持的完成等待获取结果，避免秒级轮询；成功后在同一编排步骤保存图片并 checkpoint，立即展示，禁止输出图片 base64。`record-image-concept`、`continue`、`delivery` 可加 `--compact` 避免反复返回未变化的完整 dispatch；原输入和完整 prompt 仍在绑定的 dispatchFile 中，首次必须读取，缺失事实定点查询。每次 checkpoint 已返回最新状态，不再为了相同状态额外调用 continue/delivery。

独立图片 QA 使用新的精简上下文，不复用维护/代码审查会话；只接收 reviewRequest、实际三图与必要品牌/业务原件，业务疑点才读取准确源码片段，不重复扫描整个宿主。检查不延迟已有图展示，不自动重画。普通运行只报告新结果或阻碍，不为确认收到、重复状态来回唤醒执行者。用量统计在阶段结束由编排者一次采集，不让生产者寻找自己的日志；同口径比较累计 token、非缓存/缓存输入、输出和实际耗时，不把低缓存 token 数等同于低费用。

每轮开始记录运行目录与本轮生产/复核执行者的准确会话、turn（或明确日志行区间），结束时分别汇报输入、缓存输入、输出与总 token，以及生图调用次数、成功数和耗时。运行时提供实际 usage 时使用原值；本地 Codex 明确日志可用时可用 `node <skill目录>/scripts/collect-brand-usage.mjs --session <准确JSONL> --thread <id> --turn <id> --round <运行id> --category trial` 只读采集。不要让用户找日志；无法准确关联或无使用量时写 `unavailable`，不拿字符数估算。缓存输入与推理输出是子集，不重复加总；子代理分别统计且只合并不重叠范围。ImageGen 未返回 usage 时单列未知，不把调用它的 Agent token 冒充图像模型费用；维护修复用 `development` 单列，不混入用户试跑。原日志留在本地，报告不复制聊天正文、凭证或其他项目内容；统计缺失不阻塞图片展示。

完整效果图使用入口返回的隔离输出和命令；A/B/C 同场景、同尺寸、等权展示，推荐不能遮蔽其他方案。官网图片以真实附件传入而非只写路径到 prompt。三案独立构图，不用换色或裁切冒充三次探索。用户选择图片只确认视觉方向，不是 Approved H5 Master 或宿主实施授权。

## 选图后落地到隔离宿主

### 三图结果后的用户引导

首张 checkpoint 保存后即打开标准 `delivery.comparisonPreview`，如实标注数量及未审核状态；0 张失败时也可打开无图状态说明。三图齐全才派发 `reviewRequest` 及其必要绑定输入。不要手写对照页，也不给 QA 全文会话/全 Skill/旧生产 prompt；真实业务、品牌与差异检查保留。生成中和待审页每 15 秒在可见时刷新，同 URL 展示结果。待审/失败不等于批准或完成，缺图不伪装完整比较，哈希损坏仍拒绝展示。

三图已通过独立检查、交付给用户时，简短说明：“可以选 A/B/C；如果都不满意，也可以直接说‘保留品牌和业务，再探索三个不同方案’，有偏好可顺便说，不必填写设计说明。”只选方向不自动转代码；用户明确要求可操作页面后才进入下述选图落地。

用户明确要求“再来三个”时，由编排者执行 `regenerate-image-concepts --artifact-root <上一批目录> --brand <brand> --feedback <用户原话> --confirm-new-batch`。入口验证原输入哈希并返回新的 `artifactRoot`，只复用品牌原件和宿主输入，不携带旧生成/审核状态；后续 checkpoint、continue、review、delivery 全部使用新目录。读取 dispatch.regeneration 中反馈及旧方案，避免重复视觉主意；旧图不是官方参考，不能作为新图提交。三图完成且独立检查后，使用新 delivery 比较入口，并保留上一批入口供回看。没有具体偏好也能按“不满意”探索，不要求用户重开会话或填写契约。

CLI `continue` 是内部读取/续接当前批次的命令，不等于用户说的“继续生成”；用户这句话走上述新三案换批。宿主或冻结输入变化时先更新输入。独立 QA 的客观局部纠错仍可用一次 `regenerate-image-concepts --failed-only --confirm-new-batch --artifact-root <失败批次> --brand <brand> --feedback <QA纠正事项>`，仅改失败方向、保留其余图及审核；这不是用户的创意换批。纠错再次失败不自动开新轮；只有用户再次明确要求才探索新三案。旧 FAIL、业务门槛与宿主不变，不自动转 H5。

用户已经选择图片并要求实现时，沿用该图片运行的 `select-image-code`，不要重新调用三案 `run`。编排者把选择原话传入 `--selection`，确认 `--direction` 和 `--confirm-isolated-preview`；普通用户不编写 manifest。入口冻结单页 `targetPage` 的源码/hash/路由，返回新隔离目录与真实宿主副本，不复制历史手工 Demo。`conceptReviewNotes` 的待确认项必须随图交接，不以图中的筛选词替代真实业务。旧失败审核保留，选图不能把旧图、来源学习或全流程改成 PASS。

执行者读取返回的准确图片、品牌 DTCG/adapter、组件原件与宿主源码。调用同一公共入口的 `compile-selected-theme --artifact-root <新目录> --dangoui-root <实际已安装包>`，只在宿主全局入口导入回执的 `entryFile` 一次；它已固定真实库样式 → 品牌主题的顺序，不再分别导入两个子文件或重复加载库 CSS。按 `integration.mappedVariables` 定点检查主题根和实际消费者的声明，仅移除或重接遮蔽本轮生成值的陈旧品牌覆盖；保留业务样式及有意的模式/状态覆盖，并验证对应分支。不要用 `!important` 强压主题，仍须真实运行检查 computed winner 与 token 扰动/恢复。兼容组件复用，不兼容平台明确适配；不能把只复用 CSS 说成组件 API 复用，也不能把截图铺底说成代码。安装只发生在副本，禁止通过 node_modules 链接写入原项目。

选中图同时是视觉目标和可复用的生成插画来源。实施与 QA 收到同一 `selectedArtwork`：优先复用合适的插画区域，以原图字节和响应式图片定位保留主体，不默认重新生图、删除 IP 或用 CSS 重画替代。根据每张原图实际尺寸确定展示范围，窄屏也不得露出图中的假搜索框、导航或列表。真实控件和业务数据用代码及品牌设计系统实现；插画内烘焙文字如实披露为像素。生成插画标为 `generated-proposal`，不能成为官方品牌证据，但不因此禁止用于已授权的隔离页面。无法合理分离时说明局限，先问用户再改变表达或新增生成。沿用 `reused/adapted/limitations` 记录原图 hash、运行资产、展示范围和实际引用，不新增审批文件；QA 核实插画保留、无假控件、响应式与真实设计系统消费。

React Web dispatch 的 `reusableComponents` 提供候选 [文本 Button](../assets/react-web-button/usage.md) 的准确路径、hash 和适用说明，实现与 QA 共享同一冻结输入。它源自 dangoui 3.6.16，依赖真实库 CSS 与主题；执行者先确认实际安装版本兼容，再按本品牌与任务需要复用。Taro、Vue、React Native 不派发该资产，其他尺寸/变体/图标不因存在 props 而获认证。不附赠手工页面或历史 QA。

Taro 选图入口同时冻结 `nativeRuntime` 的[纯安全区几何 helper 与接入说明](../assets/taro-native-navigation/usage.md)，供实现和独立 QA 共享。先追踪宿主 navStyle、inline height/padding、状态栏和胶囊的实际所有权，避免与已选图 header 双重叠加。复用既有计算或限域接入 helper，保持原图与单页边界。QA 的 nativeRuntime 检查必须有真实小程序模拟器/开发工具或真机证据；H5、proxy 和编译通过不能替代。缺原生运行条件应报告阻断，不宣称原生验收通过。其他框架不派发这一输入。

声称组件适配时，以实际版本组件源码的 DOM、类名、尺寸、状态与事件约定为依据，只适配本任务需要的范围。在现有 reused/adapted/limitations 中记录实际 import 与调用位置、改动和未覆盖范围。用真实原组件与宿主实际调用的适配器做同主题状态对照，并检查宿主 CSS 的最终覆盖；仅加载库 CSS 或主色变量生效不能证明组件适配。差异（含可访问性增强）明确列出，原组件未提供的行为不能伪称复用。一个代表组件验证后收口，不自动扩建跨框架库，未覆盖组件如实标为 token-only/未适配。

本选图代码阶段开始时即可确认并记录宿主已安装的 Playwright 等本地运行验收工具及版本。内置浏览器故障不自动免除 QA；可用本轮已确认且获准使用的本地工具完成实际检查，无可用工具时报告真实阻断。不得借工具切换绕过浏览器/网络访问策略、请求头限制或沙箱权限；历史测试结果不替代本轮验收。

实际页面运行后，使用 dispatch 的 `prepare-selected-code-comparison` 命令生成标准选图/页面对照，不手写展厅。传入真实 localhost 页面 URL，使用返回的 comparisonFile 与服务命令；旧输出不可覆盖。实施提交可携带已验证的 `verifiedRuntimeTools`（name、version、绝对 path、verified），自动交给 QA 复核可用性，不作为独立验收证明。宿主编码、构建和业务检查仍由对应执行者完成。

Taro 原生运行使用同一命令的 `--native-preview <JSON文件>`，不传 `--preview-url`。输入 `{distPath: 隔离host内真实dist绝对路径, route: 冻结目标路由, screenshot: artifactRoot内且host外的实际原生截图绝对路径}`。入口输出明确标注静态证据的“选图 ↔ 原生截图”比较页，并返回含截图 hash 和 dist 清单的 `nativePreview`；正式提交携带返回的 `nativePreview` 与 `comparisonFile`，省略 `previewUrl`。QA/delivery 继续携带同一原生入口，真实操作在开发工具或真机中完成；dist/截图漂移要求新证据，静态比较页不证明交互或原生通过。

完成构建、实际截图及可操作的图/页面对照后，执行返回的 `record-selected-code`。将完整 `reviewRequest` 交给不同执行者，实际打开页面验证视觉、业务、窄屏布局、changedFiles/singlePageScope 和 token 改变→渲染改变→恢复。`record-selected-code-review` 后用 `delivery` 展示结果；派发或文件齐全不算完成。失败保留记录并限域修复，不重画效果图。通过的 `confirmationStatus=awaiting-user-single-page-confirmation` 仅表示单页可验收，`userSinglePageConfirmed=false`、`wholeHostAuthorized=false`；未测路由、后端和跨平台能力明确列出。

提交后发现局部缺陷时，执行状态返回的 `revisionCommand`（`revise-selected-code --artifact-root <当前目录> --reason <具体缺陷>`），再修改当前隔离副本、构建并重新记录。旧提交和审核原件不覆盖，新修订必须绑定新的实际截图并重新独立 QA；不重新选图、不重新复制原宿主、不借用旧 PASS。若已先改代码，`continue` 会返回同一恢复命令而不是无路可走的 hash 错误。冻结品牌、选图或原宿主变化仍是输入问题，不能用修订绕过。仅对明确缺陷做一轮限域修复；再次失败且没有新的纠正依据时如实报告，不自动循环。

原宿主始终只读。本阶段只实现所选真实单页及必要直接依赖，不扫描或换肤其他页面。独立运行 QA 后展示“选中效果图 ↔ 实际可操作页面”，只问是否确认该单页；不满意且要求修订时局部修复，明确重新探索则走新三案。用户说“确认单页”只表达该页认可，保留原话与准确版本，不冒充脚本已有确认写入能力，也不把 wholeHostAuthorized 改为 true。之后只有用户另外明确要求整体换肤，才核对范围并走实施交接；不能把“确认单页，并授权整体换肤”作为必答口令或继续使用的条件。本入口不自动安装到原项目、不推送、不更新已发布 Skill；全项目最终验收不能由单页通过代替。

## 交互 H5 与宿主实施的内部判断、用户验收

以下 H5 恢复、Master、交互 QA、DOM 与实施协议只适用于 `interactive-h5` 或 `apply-host`，完整效果图不执行这些后续环节。

用户明确指出历史准确版本作为视觉对照时，先用公共 `recover-reference --artifact-root <当前隔离目录> --brand <当前brand> --source-root <历史目录> --source-master <原master相对路径> --source-master-sha256 <原SHA256> --reason <当前确认依据> --confirm-reference-only` 恢复。它保存原 H5、运行资产及原批准范围，在 `prior-direction-index.json.recoveredReferences` 追加 hash-bound 输入，不修改旧 FAIL、Goal 或源码。下一次设计前必须核对这些输入，不能只检查当前 run 的失败 ABC。

`reference-only` 只授权比较及找退化点，不能当作新的 Approved Master、品牌资产 grant 或宿主实施许可；原有 `trial-implementation-only` / `aestheticApproval:pending` 不得丢失。历史记录与远程封面不是本轮 fresh API 数据。恢复后优先验证受影响的局部状态，不因此重开无关 ABC。正式晋级仍需准确用户选择与当前独立 QA。

用户明确认可一个准确 H5 并授权本地宿主实施时，可通过公共 `freeze-selected-h5 --artifact-root <原隔离build> --brand <brand> --artifact <相对H5路径> --artifact-sha256 <SHA256> --approval <相对用户确认JSON> --approval-sha256 <SHA256> --qa <相对独立实施输入QA> --qa-sha256 <SHA256> --host-target <原绝对宿主>` 冻结独立实施交接，不因历史 ABC 失败重开无关探索。用户确认须绑定准确 H5 与宿主；`selected-h5-implementation-input-qa/v1` 必须由不同生产者与审核者完成，声明 `local-host-implementation-only`，绑定 H5、确认、品牌三证、导航 baseline、宿主源码/路由配置/样式、生成素材和全部必要本地依赖。品牌证据/intent 引用的截图也须明确列入审核 inputs；动态业务封面/头像须列入 `runtimeDependencies`，仅允许指定 host-input raster 目录和 `host-business-content` role。未审核依赖不能由冻结器自动补齐。

入口一次写入 `selected-h5-handoffs/<binding-id>/build`，返回现有 `host-implementation → apply-host` 参数（含复制 MOD 的绝对 `--mod-file`）。准确选择的 local Master 与独立 review 仅用于此实施输入门禁，不更改旧 Goal、探索 route、FAIL、receipt、preview-readiness 或学习认证。来源学习/完整 ABC 成功和公开分发仍未获授权；全宿主 disposition、pre-edit baseline、组件运行门禁及修改后的真实 native runtime QA 均不可由该输入 QA 替代。review 的 apply/keep 文本只是约束，实施路径以独立绑定的 host.route/source 为准。

`handoff-frozen` 的 `dispatchReady:false` 不能当作实施开始或流程 PASS。先执行返回的 public run 完成真实 TPP/action evidence 输入检查；缺件按准确报告交给责任角色，不能写空证据或关闭 gate。其后编排者按标准流程独立封存新 apply-host Goal（不复制旧 design-host Goal），通过现有 `brand-subagent-workflow.mjs prepare --brand <brand> --root <新build>` 与 `next` 派发 Host Strategist。新运行须保留原宿主与 local-only 范围；Host Strategy 尚未完成时不得开始 Host Implementation，也不得将输入 review 称为 native 验收。

已正式记录 `fail` / `needs-evidence` 的 blocked apply-host Host Strategy，仅在明确继续现有任务时由编排者执行公共 `retry-host-strategy --artifact-root <当前隔离build> --brand <brand> --continue-existing --reason <责任节点与准确纠正原因>`。最多两次策略尝试（不超过原 Goal maxAttempts），旧 stage、receipt、outputs 按原 hash 存档不改写；新真实 dispatch 继续只读诊断，不授权编辑或新品牌规则。`host-productive-baseline.json.targetPageId` 必须是准确的 `host-page-inventory.json.pages[].id`，每个 page 判断覆盖一次。结构冻结器实际消费 `targets[].route/sourceFile/baselineFile`，不会消费额外 `file` 字段；sourceFile 与 baselineFile 用绝对路径，前者指向原宿主 Vue、后者指向隔离新 baseline，不能将宿主相对 sourceFile 错当 build 相对路径。原记录若误归因保留原字节，新 dispatch reason 明确纠正即可。

已 hash-bound 原始 source/style 快照的 local-only apply-host 实施阶段失败后，可明确执行 `retry-host-implementation --artifact-root <当前隔离build> --brand <brand> --continue-existing --reason <仍属原任务的纠正范围>`，最多两次且不超过原 Goal maxAttempts。入口使用准确旧失败 stage 的显式 post-edit 上下文验证 Master/QA/原始快照、未变 appConfig 和当前真实结构 AST；不假造 currentStage、不重捕 baseline。旧 stage/dispatch/receipt/outputs 全部原字节归档；当前合法样式的续接检查点仅用于下一次 dispatch 前确认状态未漂移，不替代原始输入或构成新的批准。新 dispatch 继续 pin 同一原始快照/bundle，native runtime 与独立 QA 未完成仍不得 PASS。

apply-host 的 `previewQA` 只使用 `host-preview-smoke/v1` 检查准确实施、实际运行、受保护业务、受影响导航/素材/状态及明确限制；不继承后续完整认证或来源学习的验收清单。预览 `needs-evidence` 后，明确继续同一任务时才执行公共 `retry-host-preview-qa --artifact-root <当前隔离build> --brand <brand> --continue-existing --reason <准确纠正原因>`。最多两次且不超过原 Goal maxAttempts；归档旧失败字节、保持同一 Master/Goal/实施输出，使用准确已完成实施阶段的只读 post-edit 上下文，不重捕 baseline 或假造 currentStage。新审核者与实施者及旧审核者不同，报告用版本化路径，必须绑定当前活源/构建 hash 和新实际观察；未观察行为写限制，不能由编排者补造 PASS。

普通用户不操作角色状态机、QA 条件或生图门禁。外层编排必须将内部学习接力推进回原 `host-concepts`，学习页面只能作为调试证据，不能作为用户交付。首次三案通过交付检查后，打开公共入口返回的统一比较页：A/B/C 按稳定顺序等权展示，使用同一宿主任务、内容来源和冻结视口；本段仅对 interactive-h5 要求每案可操作（完整图仅为静态预览），窄屏仍在同一页面中比较，不缩小内部视口冒充响应式。单案打开仅是辅助，不把推荐与其他方案分开交付。推荐及理由可作文字参考，不默认选中或触发批准；用户在对话中明确选择准确方向后才冻结 Master。无需重写三案或建立额外选案服务。用户说不满意时将日常语言反馈定位到责任节点；未通过内部 QA 的页面不得冒充可验收方案。

角色分工并非每个检查都新增 subagent：事实提取与 hash/结构检查交给脚本，设计交给生产角色，视觉与业务验收交给另一个执行者。独立任务按需并行，上下游依据未通过时不提前执行下游。任何内部节点 PASS 都不等于最终目标完成。

三案交付使用 `delivery.comparisonPreview.path`，拼接当前 `serve-design-host-h5.mjs --root <当前宿主buildDirectory>` 服务的 baseUrl 后打开；比较路由复验同一交付门禁并直接嵌入原三案，不复制改稿。已有 Approved Master、单模块或实施验收沿用各自入口，不强制生成三案。用户选择继续通过现有对话与批准流程处理，比较页不承担写入批准或实施的职责。

学习前置、宿主预览和真实宿主实施分别保留不可变 Goal/receipt。续接宿主使用子隔离目录，不能覆盖学习 manifest，也不能丢失父宿主路径、品牌来源、profile 和原始参数。只有完整学习 QA 与有效 MOD/资产后才能续接；用户认可准确 H5 后才进入 apply-host。

用户明确要求先测试大步骤、稍后处理来源几何细节时，可申请 `macro-host-journey` 隔离预览范围。它必须由不同于所有生产者的执行者先独立审核来源品牌、MOD、tokens、runtime assets、宿主迁移与范围排除，保存一次写入的 `migrations/<brand>/preview-readiness.json`（`brand-preview-readiness/v1`）。回执绑定父 handoff、学习 manifest、全部品牌输入与声明素材 hash，并逐项声明可用 MOD id、未解决缺口和禁止用途。公共入口仅以 `continue --artifact-root <父buildDirectory> --continuation-scope macro-host-journey --preview-readiness-sha256 <回执SHA256>` 续接到独立 `host-preview-macro/build`；无显式范围与有效独立回执仍执行完整学习门禁。此范围的 `learningComplete:false`、原来源 FAIL、Goal、manifest 与 QA 都保持原样，不能称学习认证通过，也不授权修改宿主。三组真实宿主 H5、独立宿主 QA、Expressive 缺口判断和用户选择仍按原流程执行。

### 隔离目录初始化

`continue` 返回 `dispatchRequest` 后，编排者必须实际派发对应 subagent；已启动则等待该执行者并记录 receipt，再继续。`continue` 是取任务/推进状态，不会代替角色执行。重复调用会返回同一份经校验的已派发任务，不得重复启动角色或重采来源。内部文件冲突由维护者处理，不能用“请回复继续”当恢复方案。

交接以角色完成必需自检并返回实际 `record` 结果为准，不以 receipt 文件出现或 Finalizer 编译通过为准。角色直接执行 dispatch / Finalizer 提供的绝对命令数组，编排者核对记录后使用 `receiptContract.orchestratorContinueCommand` 推进；不要临场猜测内部 `--root` 与公共入口 `--artifact-root`。仍在自检的角色不能因产物已落盘就被中断或由父任务代记 PASS。总安全 deadline 和真实故障仍按原停止规则处理，不能为等交接重置窗口。

URL 前置返回后，由编排者执行 `run-brand-workflow.mjs continue --artifact-root <父buildDirectory>` 并按返回的真实 dispatch 派发角色。学习完成后同一命令验证三证、角色独立性、MOD 和素材 hash，保留父记录，在 `host-preview/build` 创建子运行并恢复原请求。每次准备向用户展示时执行 `run-brand-workflow.mjs delivery --artifact-root <当前宿主buildDirectory> --brand <brand>`。design-host 只有 `userGoalCompleted:true` 可报告概念预览交付；apply-host 的 `ready-for-user-review` / `previewReady:true` 仅表示准确真实宿主可提交用户验收，必须保留 `userGoalCompleted:false`、`fullWorkflowPass:false`、来源学习/全宿主未认证和行为限制，不宣称整个 skill 完成。`pending` / `blocked` / `resume-ready` / `host-resumed` 都不是用户结果完成。

先执行：

```bash
node <skill目录>/scripts/run-brand-workflow.mjs artifacts init --host <绝对宿主路径>
```

把返回的 `buildDirectory` 作为 `--artifact-root`，并传绝对 `--host-target`。概念图、migration、临时 Registry、skill link 与预览都写入隔离目录；宿主在用户批准 H5 前保持只读。

## 交互 H5 首轮时效协议

从 workflow `prepare` 到三组可交互隔离 H5 通过一次紧凑独立 QA，以 5 分钟为首次可判断结果目标和进度检查点，不再把它作为砍掉专业角色的硬截止。fast 流程保留 20 分钟安全上限，防止工具或角色无限挂起。

- 每个 dispatch 携带 `previewTargetAt`、绝对安全 `deadlineAt`、剩余毫秒和停止动作。
- 外层编排最多每 60 秒检查一次状态；超过 5 分钟时报告最慢节点和已有产物，但继续等待当前必需角色。
- `design-host/fast` 的启动页事实由 prepare 阶段确定性提取并校验，不为源码中可机械推导的事实启动 Host Strategist；standard/certification 与批准后的全项目扫描仍由真实 Host Strategist subagent 完成。Brand Application Designer 与独立 Visual QA 必须由不同真实 subagent 完成；主任务只负责路由、冻结输入、状态记录和汇总。
- fast prepare 后由同一个设计师回合完成三方向表达探索与 H5，不为 brief 单独派发角色。明确要求时实际调用 ImageGen，三案分别记录 `metadata.expressiveGeneration` 的 `toolCallId`、完整 `prompt`、`inputImages[{path,sha256}]`、`asset{path,sha256}` 与 `visualDirection`，Finalizer 绑定 route/receipt。实际调用、图片与页面可见应用须一致，不以占位字段或相同图片换色满足三个方向。
- 到 20 分钟安全上限才立即中断当前角色并报告已有产物与缺口；不启动无界自动返工。
- fast run 的真实文本 token 软目标为 40k–60k，硬上限为 80k；仅在运行时返回真实 token usage 时执行该上限。无法取得时记录 `unavailable`，以 unique/duplicate/additional-read bytes 诊断，不能换算后冒充真实 token。
- 重复输入字节占比超过 20% 时，下一次昂贵工具调用前必须先收窄 dispatch；不得通过删除宿主事实、品牌证据或独立 QA 来达成预算。
- 安全上限后只有用户明确要求继续时，才可为仍处于 dispatched 的同一阶段开启新的有界窗口；它保留 dispatch、输入 hash 和既有产物，不得借此改写 verdict 或跳过 receipt/QA。
- 已记录 FAIL 的 H5 生产阶段只有在用户明确要求继续该预览后，才通过公共入口 `retry-h5 --artifact-root <当前宿主buildDirectory> --brand <brand> --continue-existing` 开启一次新尝试与新的 20 分钟窗口。入口先验证隔离目录与原范围授权，再将旧 stage、receipt、dispatch 和所有已提交 output 的字节保存到 hash-bound `attempts/<旧stageId>/`；旧 verdict 和 outputHashes 不改写，后续命令逐项验证归档。新 dispatch 仍绑定原 Goal 与 preview-readiness，不扩大品牌语义用途，也不跳过生产者渲染或独立 H5 QA。
- 用户明确要求在原 macro 试验中接入新增独立来源审核时，retry 可额外传 `--transfer-review <绝对审核JSON> --transfer-review-sha256 <SHA256>`。审核须为 `source-system-transfer/v1`，候选规则与排除项、来源 packet/观察/截图 hash、独立审核者均有效；入口复制到当前 attempt 的一次写入目录，不修改原 MOD、Goal、readiness 或失败记录。只允许当前隔离试验采用明确 permitted 的候选规则，不能提升为 reusable Pattern、全局 token、学习认证或宿主实施许可。每案 H5 metadata 的 `transferRuleApplications` 必须绑定准确 ruleId、ruleScope、region、存在的 selector、review hash、evidenceRefs 和 hostReason；仅参考规则声明 `usage:reference-only`，条件素材规则还须使用原 grant 允许的独立 hash 资产。Finalizer 校验并写入每案输出；独立 H5 QA 继续按真实渲染核对范围、实际应用和全部排除项。
- 首次交付前做紧凑独立 H5 QA，同时核对业务、Productive 来源应用和 Expressive 实际输入/产物及三案视觉差异。用户要求 ImageGen 而未调用、未返回资产或未实际使用时不得通过。没有该要求时才可直接交付合格无图 H5；局部增强仍先定位范围并冻结已有 H5 几何。
- ImageGen 按方向或明确局部缺口有界调用，不自动重试，不换词规避安全拒绝。失败保留已有文件并标明未满足项；不得把无图回退称为已完成用户要求。
- 用户认为三案都不值得继续时，用 `reject-concepts --reason <原因>` 记录为有效的 `rejected-all` 结果并终止，不自动返工。
- 三组 H5 交付后停止等待。用户确认 H5 前不做全项目扫描或宿主实施。
