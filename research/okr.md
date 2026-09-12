# Brand Skill MVP OKR 与完成进度

> 更新时间：2026-09-12

> 统计原则：只认仓库产物、机器校验、真实构建或运行证据；草稿不计完成，H5 PASS 不外推为小程序或原生端 PASS。

## 总体判断

项目已经从“研究如何抽取品牌风格”推进到“具备公开 Web MVP 和真实宿主 H5 试点”。现在不应该继续横向堆品牌数量，下一阶段应集中验证两件事：首次使用者是否能低门槛成功，以及 Taro/小程序链路是否能在开发者工具和真机真正运行。

| Objective | 当前判断 | 完成度口径 |
| --- | --- | --- |
| O1 公开 Web MVP | 完成 | 7/7 个 KR 完成；公开站已部署并开放访问 |
| O2 品牌学习方法与资产沉淀 | 部分完成 | 2 个公开验证样本，5 个 Brand MOD；旧黄金样本仍有缺口 |
| O3 真实宿主与跨端验证 | 部分完成 | H5 已验证、微信构建已通过、开发者工具和真机待验证 |
| O4 外部可用性验证 | 未开始 | 尚未完成 5–10 人、约 10 页受控内测 |

## O1：发布可公开复用的 Web MVP

目标：任何使用者无需账号即可查询、预览和复用已审核品牌规则；相同官网不重复学习。

| KR | 状态 | 证据 / 说明 |
| --- | --- | --- |
| KR1.1 建立免登录只读 Registry | ✅ 完成 | `public/brand-registry/v0.1/index.json` |
| KR1.2 用规范化来源 URL 去重 | ✅ 完成 | `by-source.json`；相同来源只对应一个 brand id |
| KR1.3 品牌资产版本化 | ✅ 完成 | manifest 使用 `{brand}/{version}` 路径，当前版本 `0.1.0` |
| KR1.4 声明发布、平台与素材复用状态 | ✅ 完成 | `publicationStatus`、`platformSupport`、`reusePolicy` |
| KR1.5 公共协议和生成校验 | ✅ 完成 | Registry v0.2 schema、构建脚本、preview validator |
| KR1.6 首批公开样本 | ✅ 完成 | ONE PIECE、Pokémon；Web 均为 `verified` |
| KR1.7 公网部署和真实外部访问 | ✅ 完成 | `https://jocelyntong.github.io/Dangoui-Design-System-Skill/` 已通过 GitHub Pages 发布并完成外部访问验证 |

O1 结论：Web MVP 已达到当前放行标准。产品形态不需要先做账号系统，继续采用“公开读取 + PR 审核写入”，把注意力留给品牌学习质量与复用率。

## O2：证明 Brand Skill 学到的是可迁移视觉语言

目标：交付证据、结构和生成能力，而不是官网截图、Logo 换色或通用模板。

| KR | 状态 | 证据 / 缺口 |
| --- | --- | --- |
| KR2.1 Brand MOD v0.1 协议 | ✅ 完成 | `schemas/brand-mod.v0.1.schema.json` 和 `validate:brand-mod` |
| KR2.2 至少 2 个公开三证通过样本 | ✅ 完成 | ONE PIECE、Pokémon fidelity report 与公开 manifest |
| KR2.3 品牌规则映射到 DangoUI | ✅ 完成 | 公开样本包含 adapter 与 component mapping |
| KR2.4 同品牌 2–3 个视觉方向选择 | ✅ 完成 | Wild Design contract、validator 与 ONE PIECE 试点产物 |
| KR2.5 旧黄金样本统一到完整协议 | 🟡 部分完成 | HPMA、1999、Dango 有 Brand MOD；CZN 缺 Brand MOD；RoCom 当前仓库无样本 |
| KR2.6 首次用户只输入 `/brand <URL>` 可完成流程 | 🟡 待外测 | Registry-first resolver、自动安装和回归测试已完成；缺真实首次用户成功率 |

当前资产基线：

| Brand | Brand MOD | 完整核心产物 | 公开 Registry | 判断 |
| --- | --- | --- | --- | --- |
| ONE PIECE CARD GAME | 有 | 有 | 有 | 当前最完整黄金样本 |
| Pokémon TCG Official | 有 | 有 | 有 | 公开 Web 样本 |
| Dango | 有 | 大部分有 | 无 | 内部/草稿样本 |
| HPMA | 有 | 缺 brand intent / fidelity report | 无 | 待补齐 |
| 1999 | 有 | 缺 brand intent / style / fidelity report | 无 | 待补齐 |
| CZN | 无 | 有部分 evidence/style/mapping | 无 | 尚未完成 |
| RoCom | 无 | 当前仓库不存在 | 无 | 从当前 OKR 移除，不计进度 |

O2 下一门槛：先补齐或明确淘汰 HPMA、1999、CZN，再增加新品牌。任何公开晋级都必须通过 Evidence Fidelity、Structural Fidelity 和 Generative Proof。

## O3：验证真实宿主与跨端承接路径

目标：Brand MOD 能接入真实业务页面，同时保护业务语义、支持回退，并对每个平台独立验收。

| KR | 状态 | 证据 / 说明 |
| --- | --- | --- |
| KR3.1 真实业务项目 H5 apply | ✅ 完成 | ONE PIECE × `card-plugin2.0` 六路由试点与 held-out QA 记录 |
| KR3.2 真实 DangoUI H5 runtime 消费 | ✅ 完成 | token closure、runtime 实验与构建证据 |
| KR3.3 视觉方向选择后再实现 | ✅ 完成 | plaza 和 event Wild Design 决策、锁定与 fresh QA |
| KR3.4 业务结构、默认入口与回退保护 | 🟡 部分完成 | 有 baseline、structural manifest 和隔离检查；仍需外部试点重复验证 |
| KR3.5 Taro 微信构建 | ✅ 完成 | `miniapp-mvp/readiness.json`：weapp build PASS |
| KR3.6 微信/千岛开发者工具运行 | ⏳ 待完成 | 当前为 `PENDING_DEVELOPER_TOOL` |
| KR3.7 Android / iOS 真机 | ⏳ 待完成 | 当前均为 `PENDING` |
| KR3.8 qdmp 测试环境上传 | ⛔ 阻塞 | 缺本地 `qdmp.json` 与账号登录；密钥不得提交仓库 |
| KR3.9 Flutter / 鸿蒙 adapter | ⏳ 未开始 | 等 Web/Taro 协议稳定后再启动 |

已确认的边界：

- DangoUI 语义复用、编译进入产物、目标端真实运行是三层不同结论。
- 当前 Taro + Dimina 直接渲染 DangoUI Vue 组件曾出现空白，因此小程序 MVP 使用“DangoUI 语义契约 + 宿主节点 adapter”，不能宣称原组件跨端直出。
- 小程序构建通过不等于可发布；开发者工具、Android、iOS、主题切换、交互状态与回退需要分别签字。

## O4：完成受控外部 MVP 验证

目标：证明非维护者也能以低门槛完成安装、品牌复用和真实页面应用。

| KR | 目标 | 当前状态 |
| --- | --- | --- |
| KR4.1 试点用户 | 5–10 位 Taro/小程序开发者 | 0，未开始 |
| KR4.2 真实页面 | 累计约 10 页，覆盖高/低视觉承载页面 | 维护者试点已有，外部样本 0 |
| KR4.3 安装成功率 | ≥80% 无维护者手动修复完成安装 | 待测 |
| KR4.4 Registry 复用率 | 已收录官网请求应 100% 命中复用 | 机器回归已通过，待外部样本统计 |
| KR4.5 业务安全 | 核心数据、路由、提交语义无回归 | 待测 |
| KR4.6 回退成功率 | 100% 可恢复到应用前状态 | 待测 |
| KR4.7 能力缺口闭环 | 每个 gap 有 MOD / DangoUI / 平台 / 宿主归属 | 工具已具备，待真实试点统计 |

O4 放行条件：达到上述样本量并完成两周复盘后，才考虑扩大开放；在此之前不投入账号、计费、市场和复杂协作后台。

## 下一阶段 Todo

按优先级执行：

1. 由项目负责人招募首批 5 位试点开发者，每人带 1 个真实页面；先以 Taro H5 为稳定验收面。
2. 收集安装成功率、Registry 命中率、视觉方向选择、业务回归、回退和 capability gap。
3. 用一个测试小程序完成 qdmp 登录、测试上传和开发者工具验收；密钥只保存在本地。
4. 在 Android、iOS 分别完成 ONE PIECE event 页的渲染、交互、状态与回退检查。
5. 补齐或淘汰 HPMA、1999、CZN 的旧 migration，避免“目录存在”被误认为“已完成”。
6. 达到 10 页后复盘是否进入微信小程序扩大测试；原生端继续保持未验证状态。

## 明确不做

当前阶段不做：

- 用户账号、组织权限、计费和在线编辑后台。
- 为追求数字而批量增加 10–100 个低质量 Brand MOD。
- 未经审核分发官网原始素材。
- 把 H5、微信构建或单一设备结果外推为全平台支持。
- 自动上传内部代码、截图、绝对路径或能力缺口数据。

## 成功标准

公开 MVP 真正成功，不是页面数量最多，而是以下闭环能够被非维护者重复完成：

```text
一句 /brand <URL>
  → 命中公共资产或创建受审草稿
  → 选择可理解的视觉方向
  → 应用到真实业务页面
  → Web / 目标端独立验收
  → 不满意可以完整回退
  → 可复用结论进入 Registry
```

## 文件责任

- 对外入口与安装：`README.md`
- 当前目标和进度：`research/okr.md`
- 单品牌事实与验证：`migrations/{brand}/`
- 公共消费协议：`public/brand-registry/`、`schemas/`
- 可复用流程和机器规则：`skills/brand/`
- 历史产品/技术讨论：`docs/`
