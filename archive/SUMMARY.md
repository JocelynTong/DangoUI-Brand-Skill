# VibeCoding 设计系统工坊 · 对话摘要

> 2026-06-04 Jocelyn 与 Claude 关于 VibeCoding 边缘页面生产级 Schema 架构的讨论

---

## 1. 三种设计系统文件对比

| 文件 | 格式 | 语义层 | 代码生成 | 版本化 diff | 适用场景 |
| --- | --- | --- | --- | --- | --- |
| DESIGN-apple.md | MD + YAML frontmatter | ✅ 完整 prose | ❌ 无 | ❌ 整段覆盖 | 品牌设计规范（人读） |
| DESIGN-figma.md | MD + YAML frontmatter | ✅ 完整 prose | ❌ 无 | ❌ 整段覆盖 | 品牌设计规范（人读） |
| 千岛.tokens.json | W3C Design Tokens JSON | ❌ 只有 value | ⚠️ Token 层可 | ✅ Git 友好 | Figma 变量导出（机读） |

### DESIGN-apple/figma.md 的优势
- 人类可读性极佳，设计师/PM 可直接参与评审
- 品牌决策记录完整，颜色选用理由、字体策略、间距哲学
- 组件行为描述完整（Do's/Don'ts、响应式断点、已知 Gaps）

### 核心劣势（面向 200W DAU 生产级 App）

**1. 硬编码值，无法驱动代码生成**
```yaml
# DESIGN-figma — padding 硬编码
button-primary:
  padding: 10px 20px   # 硬编码 px，不是 token 引用
```
风险：App 里 30 个页面各自硬编码，上线后间距对不齐。

**2. 没有 component API schema**
```yaml
# 这段是视觉规格，不是数据 schema
button-primary:
  backgroundColor: "{colors.primary}"
  # ❌ 没有 props 接口定义
  # ❌ 没有 variant 定义
  # ❌ 没有状态机
```
风险：vibe coding 生成的按钮没有 `variant`/`loading`/`disabled` 开关。

**3. 变更追踪困难**
- 设计师改了一个色值，Git 显示整段文件重写
- 无法过滤只看颜色类改动
- 无法关联 commit → PR → 设计通知

**4. 字体 token 丢失 line-height**
```yaml
# fontSize + fontWeight 有，但 lineHeight 在 prose 里才提
display-xl:
  fontSize: 86px
  fontWeight: 340
  # lineHeight: 1.00 ← 只在 prose 里
```
风险：vibe coding 如果只拷贝 size+weight，会丢失 line-height。

---

## 2. Figma API 的能力边界

```
Figma Variables API
  ↓ 纯 value + variableId
千岛.tokens.json（纯数据，无语义）
  ↓ 你自己补充 $description / $usage_rule
echo-design-system 语义化 schema（02 components/*.json）
  ↓ AI 读取 + 生成代码
符合生产规范的页面
```

**Figma 原生缺失的字段**：

| 字段 | Figma API 是否返回 |
| --- | --- |
| `$description` — token 用途 | ✅ tokens.json 有 |
| `$usage_rule` — 使用/禁用场景 | ❌ 不返回 |
| Component props interface | ❌ 不返回 |
| Variants 定义 | ❌ 不返回 |
| Accessibility 语义 | ❌ 不返回 |

**结论**：Figma 是设计工具，不是设计系统管理系统。语义层（description/usage_rule/component interface）必须在自己系统里维护。

---

## 3. 架构全景：上游开放 + 下游稳定

```
┌─────────────────────────────────────────────────────────────────┐
│                         UPSTREAM · 开放学习层                   │
│                     （视觉风格 · 品牌意图 · 设计知识）             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN-apple.md                              │
│                    DESIGN-figma.md                              │
│                    + 任意品牌文档 / Figma 文件                    │
│                                                                  │
│  内容：颜色 · 字体 · 间距 · 圆角 · 组件变体 · Do's/Don'ts         │
│  格式：Markdown + YAML frontmatter                               │
│  作用：VibeCoding AI 学习"这个品牌长什么样"                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ AI 学习提取
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Design Intent Extraction                      │
│                                                                  │
│  输入：DESIGN-*.md / Figma 截图                                  │
│  输出：结构化的 Design Pattern 片段                               │
│                                                                  │
│  例：Apple 的 color-block-section 模式                           │
│      { surface: "block-lime", padding: 48px, rounded: 24px }     │
└────────────────────────────┬────────────────────────────────────┘
                             │ Pattern + Brand Context
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VibeCoding 生成器                              │
│                                                                  │
│  输入：PM 自然语言需求 + Design Pattern 上下文                    │
│  输出：HTML 页面骨架（原型）                                       │
│                                                                  │
│  关键：生成的代码里，CSS 变量引用上游 Pattern                     │
│       ——不是硬编码 hex，而是 var(--brand-block-lime)             │
└────────────────────────────┬────────────────────────────────────┘
                             │ 人工验收 / 设计校准
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BRIDGE · 转换层                           │
│                                                                  │
│  figma-to-code 提取 Figma 结构                                   │
│       ↓                                                         │
│  Design Pattern → 映射到 Dangoui Token                           │
│       ↓                                                         │
│  生成 Dangoui 组件调用代码                                        │
│       ↓                                                         │
│  校验：引用的 token 是否在 dangoui 库中存在？                     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOWNSTREAM · 稳定生产层                     │
│                                                                  │
│  dangoui 组件库（已实现的生产代码）                                │
│  各端翻译：Flutter / iOS / Android / HarmonyOS                  │
└─────────────────────────────────────────────────────────────────┘

关键约束：
1. 上游 Pattern 必须引用 token 名，不是裸 hex 值
2. 下游 dangoui 的 token 命名要覆盖上游 Pattern 场景
3. Bridge 层做单向校验，不做翻译
```

---

## 4. 痛点与解决方案

### 痛点 1：词汇鸿沟
> 独立开发者不知道有个东西叫 NavigationBar，但 vibe coding 时需要用它来描述。

**解**：docs 站（Universal Design System 工坊）提供可查询的组件词汇表。

### 痛点 2：项目初始化门槛
> 开发者需要预置模板（tokens.json骨架 + component.vue骨架 + component.md骨架），让 AI 知道往哪里填。

**解**：Skill `/init-project` 初始化项目，预置空模板。

### 痛点 3：学习视觉风格后填入预定义结构
> 开发者让 AI 学习 Apple/Figma 的视觉风格，结果是散乱的代码片段，无法沉淀为可复用的设计系统。

**解**：
- Skill `/learn-visual-style` 提取视觉特征
- 强制填入预置模板（tokens.json / component.vue / component.md）
- 不允许新建 arbitrary key，只能在预定义 category 内填 value

### 痛点 4：文档可读性
> 设计系统文档只有开发者能读，PM/运营看不懂，沟通成本高。

**解**：docs 站 Token 面板 + 组件 Playground 可视化，让非开发者也能理解数据结构。

---

## 5. Universal Docs 站 · 四项核心功能

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNIVERSAL DOCS 站                          │
│               通用设计系统数据结构可视化工坊                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  功能 1 · 不知道怎么说 → 查                                     │
│                                                                  │
│  左侧：Token 面板（颜色/字体/间距/圆角 可视化）                    │
│  右侧：组件列表 + 使用场景说明                                    │
│                                                                  │
│  例：搜「导航栏」→ 显示 NavigationBar 组件                       │
│      搜「状态栏」→ StatusBar + HomeIndicator                      │
│      搜「输入框」→ InputFrame / InputLine / InputSelect          │
│                                                                  │
│  目的：词汇补全，让开发者学会正确的设计系统术语                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  功能 2 · 不知道这是什么 → 点                                   │
│                                                                  │
│  Interactive Demo                                                │
│  ├── 渲染好的完整页面（Islands/Feed/任意）                        │
│  ├── 鼠标悬停模块 → 高亮 → 显示组件名标签                         │
│  └── 点击模块 → 侧边栏弹出：                                     │
│       ├── 组件名：NavigationBar                                  │
│       ├── 变体：Terminal=App, Ghost=False                        │
│       ├── 引用 tokens：bg/1, text/1                              │
│       ├── 关联文件：component.vue + component.md                 │
│       └── 操作按钮：「我要改这个」                                │
│                                                                  │
│  目的：通过交互识别组件，消除「不知道这东西叫什么」的障碍            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  功能 3 · 自然语言修改 → 结构化代码                              │
│                                                                  │
│  开发者点「我要改这个 NavigationBar」                            │
│                                                                  │
│  读取：                                                          │
│  ├── component.md（description/usage/do's）                      │
│  ├── tokens.json（全局可用的 token）                             │
│  └── component.vue（当前变体结构）                               │
│                                                                  │
│  开发者说：「把背景改成渐变色，文字改成白色」                      │
│                                                                  │
│  AI 生成：                                                       │
│  ├── 符合 schema 的 component.json 变更                         │
│  ├── 符合 schema 的 tokens.json 变更（如需新增 token）           │
│  └── 更新后的 component.md（自动补充 modification record）        │
│                                                                  │
│  输出预览：实际渲染效果 vs 代码变更 diff                          │
│  开发者确认 → 写入文件                                           │
│                                                                  │
│  目的：AI 修改 = 总是符合数据结构规范，不会生成脏代码              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  功能 4 · 学习闭环                                               │
│                                                                  │
│  每次自然语言修改成功 → 自动更新 component.md 的 usage 示例      │
│  未来的 AI 或开发者查 docs站时，看到的是真实修改记录的沉淀        │
│                                                                  │
│  例：NavigationBar 页面记录                                      │
│  - 「改背景渐变」成功 → 加一条 usage：「渐变背景用此组件」         │
│  - 「幽灵态导航栏」成功 → 加一条 usage：「全屏视频页用 Ghost 模式」 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 关键技术支撑

**预置模板约束**（保证结构统一）：

```
tokens.json 预置 key：
  colors.* / typography.* / spacing.* / rounded.*
  → 开发者只能填 value，不能新建 category

component.vue 预置字段：
  name / description / variants / props / tokens
  → 开发者只能按字段填写，不允许自由发挥

component.md 预置 section：
  ## Description / ## Usage / ## Variants / ## Do's/Don'ts
  → 强制格式，方便 AI 解析
```

**Demo 可点击机制**：
- component.json 里预埋 click target 映射
- 哪些区域对应哪些组件，定义在 schema 里

**AI 约束机制**：
- 不允许生成 schema 外的 arbitrary 字段
- AI 修改 = 总是符合数据结构规范

---

## 7. 最终目标

```
开发者不知道怎么说 → 查 docs 站（像查 MDN 一样）
开发者不知道这叫什么组件 → 点 demo 识别组件
开发者要改什么 → 自然语言描述 → AI 按 schema 生成代码

文档站价值：
- 开发者：词汇补全 + 自然语言修改
- PM / 运营：可视化面板理解设计系统，方便和开发沟通
- AI：component.md 足够结构化，能读懂 usage rules

最终：开发者从「不知道怎么说 → 学会说 → AI 按规范改」
      全程不需要懂代码结构，只需要会用自然语言
```

---

## 8. 给 Codex 的 Demo 任务

请基于以上架构，跑一个最小可用的 demo：

1. **docs 站基础结构**：一个展示 Token 面板 + 组件列表的静态页面
2. **Interactive Demo**：渲染一个含 NavigationBar + TabBar + FeedCard 的模拟页面
3. **点击识别**：悬停模块时高亮并显示组件名标签
4. **侧边栏**：点击模块后弹出 component.json 内容预览（name / variants / tokens）
5. **自然语言模拟**：输入框输入「把背景改成 #f5f5f7」，展示预期输出的 component.json diff

参考技术栈：Vue 3 + UnoCSS + Vite，纯前端无需后端。