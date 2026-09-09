# Attempt 13 — proof indicator implementation probe

只处理 `PROOF_MODE_HOME_INDICATOR_VISIBLE`。

- 根因：旧规则只通过 Pokémon 首页专属的 `template-phone--source-desktop` / `template-phone--source-mobile-proof` 隐藏 indicator，`proof=1` 以及跨品牌、风格、组件 proof 页面没有统一状态。
- 修复：将 `proof=1|desktop|mobile` 映射为品牌无关的 `template-phone--proof-mode`，并复用同一条 `display:none` 规则。
- 正常页面：4 个目标页面均保留一个 absolute、透明的 outer indicator。
- Proof 页面：3 种 proof 查询 × 4 个目标页面均得到 `display:none` 和 `0×0` rect。
- 构建：通过。
- 未修改：橙色产物、页面结构及其他视觉。

本文件只记录 Implementation 自测，不给出 QA verdict。
