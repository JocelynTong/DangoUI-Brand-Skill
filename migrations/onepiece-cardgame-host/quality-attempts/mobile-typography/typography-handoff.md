# ONE PIECE host mobile typography handoff

Status: **BLOCKED — specification only; production has not been changed.**

## Design decision

ONE PIECE's learned typography is a role system, not a global font replacement. Keep the official Latin faces only where their glyph coverage and source role are both valid. Chinese business UI uses a deliberate system CJK stack; brand character comes from hierarchy, rules, composition and approved Latin accents, not synthetic-heavy Chinese.

### Font stacks

```css
--op-font-cjk-ui: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
--op-font-latin-body: "OnePiece Host Poppins", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
--op-font-latin-display: "OnePiece Host Alfa Slab One", "Arial Black", sans-serif;
--op-font-latin-meta: "OnePiece Host Oswald", "Arial Narrow", sans-serif;
```

Mixed-script labels must lead with `--op-font-cjk-ui`; do not put Oswald/Alfa first and rely on per-glyph fallback. Separate Latin eyebrow/index into its own element when the expressive face is important.

## Mobile role matrix

| Role | Examples | Family | Weight | Size | Line height | Tracking |
|---|---|---|---:|---:|---:|---:|
| Latin display | `SPRITE INDEX`, short English-only section title | Alfa Slab One | 400 | 22–24px | 1.05–1.1 | 0 |
| Latin metadata | `NO.290`, dates, short indexes | Oswald | 700 | 10–14px | 1.2 | 0.04–0.08em |
| Chinese page title | 发布阵容、精灵详情主标题 | CJK UI stack | 600 | 22–24px | 1.3 | 0 |
| Primary Chinese tab | 精灵、培养、信息、技能 | CJK UI stack | inactive 500 / active 600 | 15–16px | 1.35 | 0 |
| Filter/control | 属性、形态、赛季、新增筛选 | CJK UI stack | 500 | 14px | 1.4 | 0 |
| List title | 水灵、小灵菇、阵容名 | CJK UI stack | 600 | 16px | 1.4 | 0 |
| Field label | 阵容名称、模式、成员配置 | CJK UI stack | 500 | 14px | 1.4 | 0 |
| Control value/input | 用户输入和已选值 | CJK UI stack | 400 | 15–16px | 1.45 | 0 |
| Body/help | 描述、说明、空态、错误原因 | CJK UI stack | 400 | 14px | 1.55–1.65 | 0 |
| Badge/microcopy | NEW、可选、类型标记 | CJK UI stack for Chinese; Oswald only if Latin-only | 500–600 | 10–12px | 1.3 | 0–0.02em |
| Primary action | 发布阵容 | CJK UI stack | 600 | 16px | 1.25 | 0 |

Chinese `700+` is reserved for rare, visually verified display emphasis; it is forbidden as the default for tabs, list rows, filters, field labels and paragraphs. Avoid synthetic `650`, `800` and `900` unless the selected CJK font demonstrably contains that weight.

## Required corrections by page

### `sprite-list`

- Tabs `精灵/技能/道具/阵容/属性` and subtabs `精灵/培养`: CJK UI 500/600, 15–16px, line-height 1.35, no tracking.
- Toolbar filters and count: CJK UI 500/400, 14px, line-height 1.4.
- Sprite names: CJK UI 600 at 16px/1.4. Keep Oswald only on the separate numeric index.
- `SPRITE INDEX` may retain Alfa Slab One 400; the adjacent Chinese helper must be a separate CJK node.
- Remove English-display stacks from selectors that can receive Chinese data.

### `sprite-detail`

- Chinese sprite name and content title: CJK UI 600, 22–24px/1.3.
- Primary and secondary tabs: CJK UI 500/600, 15–16px/1.35; no Oswald on the Chinese text.
- Attribute labels and prose: 14px, 400–500, line-height at least 1.5 for paragraphs.
- Preserve Oswald only for separate `NO.`/stat-number metadata, never the combined Chinese label.

### `team-create`

- Current physical sizes (title 24px, fields 14–16px, button 16px) are broadly suitable; correct the family/weight hierarchy rather than enlarging everything.
- Page title 600; group title 600; field label 500; controls/body 400; publish button 600.
- Replace generic inherited `font-bold` where it affects Chinese slots, labels and button text.

## Fresh QA gate

At both 390px and 421px, capture these representative nodes and record the browser-computed `font-family`, `font-weight`, `font-size`, `line-height`, and `letter-spacing`:

1. `sprite-list`: `SPRITE INDEX`, `精灵` top tab, `精灵` subtab, `属性` filter, first sprite name, numeric index.
2. `sprite-detail`: sprite name, primary tab, secondary tab, body paragraph, stat number.
3. `team-create`: page title, field label, control value, helper copy, member name, publish button.

Blocking failures:

- Chinese node computed family begins with Alfa Slab One or Oswald.
- Chinese tabs/list/filter/body compute to weight 700 or greater without an explicit approved exception.
- Chinese tracking exceeds 0.02em.
- Body/helper line-height is below 1.5; tab/list line-height below 1.3.
- Font resource load failure, mixed-script clipping, one-pixel stroke breakup, or obvious synthetic bold in screenshots.
- Only one viewport is checked or the implementation agent reuses its own QA verdict.

Required proof bundle: paired 390/421 screenshots, computed-style JSON, `document.fonts.check` results for the three Latin faces, and a fresh independent Visual QA assessment. Until all are present, the typography result remains **not passed**.
