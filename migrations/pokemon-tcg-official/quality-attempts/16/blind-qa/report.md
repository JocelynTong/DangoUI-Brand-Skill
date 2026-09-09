# Pokémon TCG Official — Attempt 16 Blind Visual QA

Verdict: **REWORK**.

Evidence Fidelity: **FAIL**  
Structural Fidelity: **FAIL**  
Generative Proof: **FAIL**

三证互不补偿。交互与 build 的通过不能抵消以下 blocker。

## 主要 blocker

1. Card Database 可读性失败：`card-database-search-shell` 的标题为白底白字（约 1.0:1），Energy pills 为浅灰底白字（约 1.17:1）。责任：`demoImplementationAgent`。
2. Learn 可读性失败：`learn-card-breakdown` 的标题、accordion 与正文为黄底白字（约 1.51:1）。责任：`demoImplementationAgent`。
3. Held-out 可读性失败：`held-out-deck-steps` 的 accordion 与正文为米白底白字（约 1.16:1）。责任：`demoImplementationAgent`。
4. 响应式内部超宽：371px phone-screen 下 Home `381>371`、Database `383>371`、Learn `431>371`；外层被裁切，因此 `document.scrollWidth` 看似正常。责任：`demoImplementationAgent`。
5. v2 目标绑定不一致：冻结目标是 `goal-contract-v2.json` / `73aecf...`，但 `design-direction.json` 仍绑定旧 `goal-contract.json` / `b515...`，strict fidelity 也以 v1 为 canonical。责任：`designDirector`。
6. strict evidence gate 失败：仍要求旧 page id `cards`，且第三方 seeds 没有 disposition。责任：`brandResearcher`。
7. Held-out 使用 `bounded-long-form-sections`，但批准模式中不存在这个 pattern id。责任：`designTranslator`。
8. `mockup-state-matrix.json` 缺失，strict mockup gate 退出 2。责任：`demoImplementationAgent`。

## 已通过的局部检查

- 四页都存在真实 `.phone` + `.phone-screen`，均可滚动并恢复到 `scrollTop=0`。
- Home carousel 可从 campaign 1 切到 campaign 2 并恢复。
- Card Database 可输入 Pikachu、显示 4 张结果、Reset 恢复空态；advanced 可展开到 724px 并收回到 0px。
- 390×844（371px phone-screen）与 371px host（353px phone-screen）均为一列结果，无 document-level 横向滚动。
- Learn 与 held-out accordion 均为独占切换并可恢复默认项。
- section fidelity strict gate 与 build 通过；build 仅有大 chunk warning。

## Gate 结果

- Evidence visibility strict: FAIL
- Design direction strict: PASS（但盲验另发现 stale v1 binding）
- Section fidelity strict: PASS
- Mockup strict: FAIL（matrix missing）
- Fidelity strict: FAIL / protocol-blocked（v1 canonical）
- Handoff strict: FAIL
- `npm run build`: PASS

完整 selector、坐标、scrollWidth/clientWidth、状态值和截图索引见 `probes.json` 与 `visual-qa-assessment.json`。
