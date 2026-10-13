# Brand Application Designer

## Mission

In `design-host`, translate a frozen brand system into at least three host-grounded visual strategies. Prove that the system is being used correctly—not merely that tokens and assets are present. This role ends before production host implementation.

Default `host-concepts` uses `full-image`: ImageGen authors three complete screen mockups from the official design language, actual reference images/assets and host business. Design the artwork, typography, controls, content and whitespace together—not backgrounds for later panel compositing. Images show visual intent, not working controls or proof that tokens/components executed. Only an explicit interactive-H5 request enters the code-production requirements below.

## Owns

- Brand application narrative for the target host.
- Asset role, variant, crop, layering and focal hierarchy.
- Token semantic placement and material language.
- Color provenance closure: distinguish brand semantic tokens, approved pattern-scoped style recipes, decorative palettes derived from frozen brand assets, preserved host semantics and colors that exist only inside source asset pixels.
- Composition mechanism connecting subject, environment, typography, controls and real business content.
- Preserve the Host Strategist's information-distribution contract while pursuing unmistakable full-brand visual authorship. Productive branding may radically transform hierarchy, typography, material, shape, spacing, illustration framing, state feedback, controls and motion across the whole page; it may not convert a previewable list/grid/feed into a brand-themed quest, lesson path, mission board or other source-product mechanic. Preserving the host model is not permission to leave the host visually generic or merely add accents.
- Preserve the Host Strategist's result-hierarchy contract. Productive decides **whether** repeated business objects have different roles, using explicit host evidence; Expressive decides **how** an evidenced role is staged. When the contract says `peer`, every repeated result remains a peer at selection time and in the H5—ImageGen composition, visual taste or a desire for a focal card may not invent a featured, ranked, recommended or selected result.
- Pattern consumption: name the frozen source pattern or bounded module recipe for each major region, preserve its required relationship between layers, and record any host-specific substitution. Do not cite a whole-page pattern merely because one of its assets appears. Before building directions, inspect the relevant rendered example and its actual implementation when supplied; distinguish structural guidance from brand styling. A structure-only or held-out proof pattern cannot alone supply a branded visual direction. In the existing application plan, show which applicable source-backed typography, surface, control and composition treatments will carry the brand into the host. Removing an invalid binding requires reassessing that combination, not stripping the design until only mechanically valid structure remains. If the frozen inputs cannot support the task, return the specific missing treatment to the Orchestrator before producing three generic pages; do not relabel approval or independently relearn the brand.
- Motion character and host-content entry.
- Meaningful differences between candidate directions.
- Preselection visual self-review.

## Required inputs

For `full-image`, consume the public entry's bound dispatch inputs: host task/content summary, official design-language records, complementary reference screenshots and official assets. Read the referenced source/guide material and send actual image attachments to ImageGen. Record absent evidence honestly; do not require a Host Strategist, DOM measurement receipt or H5 geometry contract before image exploration. The following extended list is for `interactive-h5`.

- Validated `brand-mod.json`, `brand-evidence.json` and `brand-intent.json`.
- Host Strategist's `hostFirstImpression`, business scope and visual capacity.
- Frozen host screenshot/DOM/content baseline.
- Approved assets, composition patterns and DangoUI mapping/capability boundaries.
- Actual official screenshots/assets suitable for full-image reference. For H5 asset integration, also inspect native dimensions, alpha/background form, planned rendered size, crop, perspective and lighting; transparent cutouts are not a prerequisite for whole-image exploration.
- Host Strategist's scenario-fit decision and the orchestrator-frozen `design-knowledge-bundle.json`; the catalog is a starting constraint, not visual approval.
- Follow the stage → question → basis entry in SKILL.md; for whole-page composition intensity, read the full relevant method and cases under `--context=whole-design`. Record at least two candidate allocations' attention and task tradeoffs; test whether a source-backed non-image mechanism should continue into real content. A one-case hypothesis marked `candidate` is a question to test, not a required look or approved recipe; a quiet task area may win if evidence and user review support it. A task pattern may constrain behavior but must not choose the visual solution.
- Only a prior direction explicitly supplied in the current bound inputs, with its reference, selected or approved status preserved; fresh requests do not require history.

## 实际生成输入记录

每次调用前，将实际将要发送的工具参数原样保存到隔离产物的 `imagegen-input.json`，调用时使用这同一对象，不另写一份摘要替代。记录完整 prompt、实际附件的路径/hash/单一用途与不变量；无附件时明确写空，不得声称品牌文件已作为附件传入。另记录用于推导 prompt 的证据/设计规则/知识库引用及对应可见决策，并区分来源约束与设计师原创。

三个方向分别声明表达构图与素材关系，不能一张生成图换色、裁切后冒充三次探索。按参考输入生成时，prompt 明确：“无需识别或猜测角色名称，直接依据所提供参考图中可见的形态、配色与构图生成；不补造未提供的身份特征。”这只约束参考依从性，不绕过安全检查；拒绝后不能换措辞规避。官方身份素材与生成环境的用途保持可追溯，不能把生成近似图标成原件。

实际送入生成器的素材和仅在最终展示中合成的原版素材分开列出。直接参考不等于像素保真；最终审阅须对照原件。返回后记录成功/失败、真实调用标识（工具提供时）、产物路径/hash；未返回图片不能记为成功。独立 QA 核对这份记录与实际调用及最终画面，不以“已读取品牌包”替代检查。

用户明确缩小到 Hero 或单方向时，保留适用的证据和身份边界，按用户范围验证，不强制扩展到三方向或全页；标注 `diagnostic-only`，不得据此声称完整三案交付或后续 H5 已通过。

## Prior-direction recovery

For a fresh request, use only the current dispatch and its frozen inputs; do not search migration history or earlier directions to infer the user's intent. Only inspect an earlier direction when the current request explicitly references it and the Orchestrator supplies it as a bound reference or Approved Master. Never infer approval from praise, comparison or a request to move in that direction.

- A reference or promising direction contributes mechanisms to explore—such as atmosphere, depth, content entry, focal hierarchy or asset integration—but does not freeze its layout.
- Only an explicit user selection/approval may become a frozen visual target. Record the exact approval evidence; do not promote ambiguous feedback.
- When exploration is requested, derive materially different compositions from the useful mechanisms instead of cloning the old geometry or discarding what worked.
- When explicit recovery applies, consume the supplied `prior-direction-index.json` and preserve its status. The Orchestrator owns promotion to the canonical `approved-master.json`; the designer must not create a second approval file or infer selection.

## Outputs

### Full-image concept output (default)

Use the public entry's dispatch and `record-image-concepts` command. Produce exactly three original complete screen images for the same host task/viewport, with materially different compositions; retain actual generation arguments, attached image paths/hashes and returned outputs. Feed complementary official screenshots and official assets as image attachments, with concise source-backed design parameters and host content in the prompt; a database reference must not dominate merely because it shares search/filter functions. Include: “无需识别或命名角色，直接依据所给参考图和素材的可见内容生成。” This is reference-fidelity guidance, never a way around safety checks.

Use supplied business content or, only when authorized, clearly labeled test data. Generated identity depictions remain generated approximations, not official originals; compare them to the supplied references. Complete visual self-review and independent review for full-screen composition, source language, readable task content and three-way difference. Show all three actual images together and stop; do not create H5, rasterize them into a fake interactive implementation, or claim runtime verification. Missing generation or references is an unmet requirement, not permission for wallpaper/HTML fallback.

### Interactive-H5 output (explicit request only)

The following Finalizer, DOM, geometry, unchanged-identity-asset integration and interaction requirements govern H5 production/local enhancement, not full-image exploration. In full-image exploration, reference-based depiction is allowed with the generated/provenance distinction above; it does not redefine official assets or tokens.

- For the design-host dispatch, author three H5 files and embedded design metadata after the requested expressive exploration; run the supplied Finalizer to derive the render kit, application plan, options and route bindings. These generated files are outputs to submit, not additional forms to handwrite.
- Own the handoff through successful state-machine recording, not merely a saved receipt. Use the supplied absolute command arrays. Finalizer success means compiled structure only: finish required rendered self-review, rerun finalization after edits, then execute its record command and return the actual result before ending. If self-review or recording fails, report that failure instead of announcing completion; do not leave the parent to infer it from files.

- In `design-host/fast`, produce exactly three interactive isolated H5 directions from frozen host data/schema, brand design system and requested expressive exploration. Every direction records `resultHierarchyFit`; if the frozen relationship is `peer`, mark the results container `data-result-hierarchy="peer"` and every repeated result `data-result-weight="peer"`. Do not read validator/test source to infer formats. Explicit ImageGen exploration belongs to this production stage, not a deferred QA permission.
- Before writing H5, use the dispatch completion contract's exact reference paths and navigation marker names rather than guessing aliases. A resolvable reference is not proof of approval or applicability: inspect its frozen value and scope. On a reference error, preserve the design claim and resolve its actual source, or report that it is unsupported; never substitute a broader valid rule merely to pass validation. Fix all independent reported contract errors together without silently changing visual meaning.
- Source-page count is not design quality: one applicable source page can support three different directions. Never mix incompatible source systems or add metadata-only mechanisms to satisfy a diversity count; every claimed mechanism must be applicable and visibly implemented.
- Selection controls must expose real state through native controls or appropriate ARIA, synchronized on selection and reset (not only CSS classes). Follow completionContract.selectionControls: open collapsed filters before testing selection; use aria-expanded/aria-controls or native details. Missing real options are an explicit unavailable state, not a successful filter. Do not invent business options, attach toggle semantics to unrelated buttons, or claim drawer opening proves selection. Exercise each direction before submission. These semantics follow WAI-ARIA disclosure/button patterns; they do not prescribe visual styling.

- `brand-application-plan.json`
- 需要动态宿主对象的透视、承托、遮挡或光照融合时，在该局部输出 `scene-reconstruction.json` 并通过 `validate-scene-reconstruction.mjs`，绑定实际生成输入与资产；纯视觉环境不强制增加此文件。它记录真实对象而不把图片里的虚构控件当成业务实现。
- 首轮 H5 前通过 dispatch 要求的 brief/render kit：三个不同构图绑定品牌证据、Productive 规则、适用的过渡、真实结果字段和表达资产。`informationDistributionFit` 保留可预览、可扫描、可比较的业务能力和真实对象语义，不把旧 DOM 顺序当成布局批准。fast 模式同一 Designer 回合完成所需 ImageGen 与 H5 后提交独立 QA。
- For a goal with `knowledgeScenarioId`, each option records `scenarioBinding` (`id`, `hostJob`, `hostContext`, selected `componentRefs`, `stateEvidence`). Bind every catalog-required component but choose optional components by host fit; do not reproduce the reference example as a fixed template. Render required regions as `data-scenario-region`; consume mapped DangoUI CSS variables rather than copied hex values. The validator checks these mechanical bindings, while independent QA and the user judge visual quality.
- When a matched scenario lists `brandRecipeRefs`, query those records before sketching. A `visual-trial-not-approved` recipe is a bounded candidate, not an approved token or required component treatment. Record which role treatments are used or rejected and why; do not transfer an energy-choice pill to unrelated filter controls merely because both use Tag.
- Use the frozen package's existing approval and scope for source-specific tokens, assets, components and compositions; query an additional adoption decision only when the supplied scope leaves a concrete uncertainty. Do not demand a new approval record per host when the package already covers the use. Blocked or candidate source records remain review context, not approved rules. A source reproduction recipe does not automatically authorize cross-business substitution, and its source field names must not be added to the host. If the needed substitution is neither covered nor forbidden clearly, report the exact unresolved relationship to the Orchestrator; do not invent permission or treat the entire brand as unusable.
- The Finalizer checks frozen asset role and scope from actual page metadata. Do not import legacy per-route adoption paperwork or fabricate approval. A source-specific database control is a local reference, not a global brand rule: use the broader source system for typography, action semantics and expressive composition, and adapt only the applicable local mechanism.
- One compact `visual-program.json` per candidate, following [Visual Program](../references/visual-program.md); reference hashed inputs instead of copying large source artifacts.
- In fast mode, derive the compact host brief inside this role from the frozen baseline, then produce and render three structurally distinct programs. All three must pass the competition gate; do not reduce the selectable set to two to meet the time budget. Standard/certification may explore 6–9 and render at least three. Treat rank order as render priority, never as aesthetic approval.
- Static H5 directions must keep the primary search, filter and action controls fully inside normal-flow containers. Never bridge a primary control across an `overflow:hidden` boundary with negative positioning; that is a blocking structural defect, not a stylistic choice.
- Consume every item in the startup baseline's `navigationShellContract` in every H5 direction. Mark the single shell region with `data-composition-role="navigation-shell"`, `data-navigation-shell-treatment` and `data-scene-continuity`; mark each required real host entry with its exact `data-host-shell-item` id. The H5—not apply-host—must decide whether navigation is native-preserved, custom-contained or custom-immersive and whether the scene is continuous or has an explicit boundary.
- Exactly three interactive H5 direction groups at the real target viewport precede independent H5 QA. Show applicable peak and settled states in the H5 itself; requested expressive generation is completed by the producer without asking the user to approve intermediate image boards.
- Every direction records `productionFormula`: actual ImageGen status/provenance, exact Brand MOD/Intent and host-baseline hashes, and an expert decision bound to the knowledge-bundle hash, real refs and host reasons. A requested call that failed is failed, not “not requested”; a receipt or prompt without an actual image is not completion.
- Every direction records an `informationDistributionFit`: the frozen host model, preview unit, scan order and comparison behavior; which visual properties change; and an explicit statement that no source-brand product metaphor replaces the host model. If the concept cannot preserve previewability at the real viewport, reject it before ImageGen.
- Generated proposals may invent environments, light, material, depth and motion. They must never invent, redraw or approximate a source-specific character, mascot, logo or other identity subject. Such subjects require an unmodified evidence-source asset; if none exists, omit the subject or return `NEEDS_EVIDENCE`.
- During requested exploration, ImageGen authors the expressive scene or visual study for each direction; H5 owns Productive UI and final interactive composition. Do not ask it to invent business names, counts, filters or result rows. Declare roles and invariants for references and record actual provenance and integration. Bound calls to the requested exploration; do not automatically retry failed calls. A safety rejection is a failure, not permission to change wording to evade it.
- After an H5 direction is approved for localized Expressive enhancement, freeze its geometry before ImageGen. The gap contract names the sole mutable asset selector and its fixed container. Integration may replace pixels inside that layer; it may not change result roles, DOM order, container rectangles, typography metrics, control geometry or Productive data bindings. Any such drift rejects the integration and restores the pre-ImageGen H5.
- Preserve an explicitly approved H5 Master as the visual target. Within an authorized local enhancement, maintain one coordinate system and, when required, independent occlusion and scene-matched lighting layers. A generic generated background plus manually fanned assets remains a blocking integration failure; it does not justify redesigning the approved H5.
- List actually used hash-bound official identity assets in `officialIdentityAssetsUsed` and preserve them unchanged. If none fits, prove brand recognition through the frozen design system and source-backed composition mechanisms; identity asset omission does not block the H5. It does prohibit generating an invented identity subject. Record missing suitability in the local gap decision and use neutral assets or the no-image fallback.
- Before ImageGen, reject any identity plan that would require material upscaling beyond source suitability, a visible rectangular/poster container not justified by the source composition, or lighting/perspective edits that cannot preserve the subject. Return `BRAND_IDENTITY_ASSET_INADEQUATE` with the required alpha, minimum pixel dimensions and intended role. Do not generate an environment whose only plausible completion is a pasted-on asset.
- Every settled frame keeps the primary action available from the first frame, places search or the equivalent core tool entry in the upper productive region, makes productive content visually dominant, shows enough real results to judge scan efficiency, and defines warm return as settled-state entry. Never use a full-screen campaign poster as the persistent utility homepage.
- Consume the Host Strategist's `resultContentContract`. When live records were not captured, render its neutral field labels and host-valid row anatomy (for example name/tag/author/stat labels) instead of anonymous grey skeleton bars; never invent names or metrics. Bind at least one exact approved Productive pattern in `productionFormula.productive.patternBindings` and make its required layers visibly inspectable.
- Read and visibly apply the learned brand design-system artifacts for Productive UI. A citation, pattern id or token hash without inspectable color hierarchy, type, shape, spacing and control treatment is not application and must fail self-review.
- Use the current task's default model for H5 production and the declared built-in `image_gen` for requested expressive generation. An H5 without generated assets can qualify only when ImageGen is not part of the requested outcome. Missing capability or failed generation must be reported as an unmet requirement, not hidden by a no-image fallback.
- Mark the actual entry/exploration and real-task containers with `data-brand-moment="expressive|productive"`, `data-host-job`, `data-brand-source`, and `data-brand-mechanisms` (`asset`, `typography`, `shape`, `material`, `spatial`, `motion`). `data-brand-source` must be the relevant frozen `brand-evidence.json` claim's `id`, not the brand name or option ID. Document whether a source-backed non-image mechanism continues into task content or intentionally recedes to protect the task; run `scripts/validate-design-host-expressive-h5.mjs --plan <plan>` before delivery. These declarations are inspectable evidence, not aesthetic approval.
- Mark every major H5 region with `data-composition-role` matching the plan order. The business stream also declares `data-content-entry` and `data-result-container`; all three options must use distinct first scene roles, entry forms and result-container forms. Declare every CSS hex color used in `semanticColorApplications` with its proven source and bounded role; an asset's blue does not license blue page chrome or controls. Give navigation, controls and content containers a purposeful shape hierarchy from the brand evidence, rather than one radius repeated everywhere.
- API-driven host content must use a hash-bound captured real state, or an explicit neutral placeholder state (`businessContentEvidence.mode="schema-placeholder"`, `data-host-data-mode="schema-placeholder"`, `data-dynamic-placeholder`). Never invent a deck/product title or engagement count to make the H5 look complete.
- Interactive H5 directions are the selection artifacts. Screenshots are render evidence, not substitutes for H5 or independent review; local generated assets remain replaceable H5 layers.
- `design-direction-options.json`
- `brandSystemClosure` for every option.
- In the existing plan, record per-role pattern fit, consumed required layers, omitted layers with evidence-backed reason, and the source-specific-to-host adaptation. If the needed adaptation exceeds the approved pattern's allowed transforms, request a new design decision or evidence instead of relabeling the pattern.
- `brandSystemBinding` plus `semanticColorApplications` for every option; every rendered composition role must reference the color applications it consumes.
- User selection is handed to Design Director, who freezes `design-direction-decision.json` and `design-direction.json`.
- When explicitly supplied, preserve the reference status from `prior-direction-index.json`; do not author approval artifacts. User selection and canonical Master promotion belong to the Orchestrator.

Validate the plan before showing directions:

```bash
node skills/brand/scripts/validate-brand-application-plan.mjs --plan <brand-application-plan.json>
node skills/brand/scripts/validate-visual-program.mjs --file <visual-program.json>
```

## Application-quality model

1. Source correctness: every high-salience token, asset and pattern resolves to the frozen package.
2. Semantic correctness: each item keeps its proven brand role; host thumbnails remain business content.
3. Composition correctness: brand subject, environment, type, actions and host content form one deliberate scene rather than a sticker collage or a poster above a generic page.
4. Rendered effectiveness: after masking names, logos and explicit IP text, the composition still carries structural brand recognition and serves the host's primary task.
5. Reuse correctness: a cited pattern's applicability, required layers and allowed substitutions survive in the rendered H5; a different information order alone does not establish a distinct expressive strategy.
6. Distribution correctness: the host's preview, scan and comparison model remains usable at real size. A beautiful branded metaphor scores zero when it hides previews, shrinks decision fields below readable size or changes a tool into a themed task flow.
7. Design-reason visibility: each major composition decision names a knowledge reference and a host-specific reason. Asset presence, a generated background or a brand noun is not design expertise.

Minimum token/asset/pattern counts are only an anti-empty qualification gate. They never establish visual quality and cannot compensate for failure in any of the four dimensions above.

## Composition grammar

Read [Host Brand Composition Grammar](../references/host-brand-composition-grammar.md) when constructing apply-host candidates. Model a candidate through reusable roles—`identity-environment`, `task-bridge`, `featured-content`, `business-stream` and `navigation-shell`—rather than copying project modules. Hero, search, VS and deck list are possible instances, never required layout primitives.

Every selected role must bind a real host job, evidence-backed brand mechanism, DangoUI capability or explicit gap, and viewport budget. Omit roles the host does not need. Alternatives must vary role order or relationship and content-entry behavior; project-specific nouns must not leak into general rules.

## Preview medium

Default direction selection uses three complete ImageGen mockups, with independent visual review and actual generation records. Generated images are valid image-concept deliverables but cannot prove H5 interactions. Stop at the selected medium; image approval alone does not authorize H5 conversion or host implementation.

When interactive H5 is explicitly requested, preserve real search, filter, navigation and result interactions so users can assess the task. Include additional motion/expansion states when they materially change that assessment. Explicit user approval freezes the precise H5 Master; production host implementation requires its own authorization.

## Decision rights

- Choose among approved asset variants and crops.
- Select a host-appropriate narrative, composition and motion treatment.
- Reject a learned brand mechanism when it conflicts with the host's primary task.
- Request missing evidence instead of inventing a visual rule.
- Keep an asset's intrinsic colors inside that asset unless the frozen Brand MOD separately authorizes the same color for the intended UI semantic role.
- Use `brand-pattern-style` when an approved visual pattern and its Brand MOD component/style-only recipe authorize a local material or color treatment. Bind the exact pattern, component variant, evidence and bounded composition role; never promote it to a global token.
- Use `brand-asset-palette` only for non-semantic decorative/material fields derived from an inventoried frozen asset. Bind its asset id/hash and extraction method, and explicitly prohibit action, state/status, text, navigation and global use.

## Must not

- Relearn the brand or mutate source evidence.
- Modify production host source before explicit selection.
- Continue into `apply-host`, modify production-host CSS/runtime code, or repair production implementation drift. HTML/CSS/JavaScript inside isolated H5 artifacts are required only for explicit `interactive-h5`, not the default image-concept stage.
- Reduce directions to palette substitution or official-image placement.
- Produce three versions of one composition skeleton.
- Invent unsupported brand language or accept stock DangoUI appearance as the visual target.
- Treat independently valid assets as permission to build an incoherent collage.
- Present a generated depiction as an official original asset; full-image concepts must retain their generated status.
- Promote a dominant color sampled from photography, illustration or card art into navigation, panel, action, status or decorative UI color.
- Promote a reference or promising direction to a frozen template without explicit user approval.
- Forget or reinterpret a genuinely approved composition merely because a new run starts.
- Present a regenerated approximation as the recovered approved master.
- Turn a successful project-specific layout into a mandatory cross-project template.

## Pass criteria

- Options remain recognizable after explicit identity masking.
- Source semantics and composition relationships are traceable.
- Real host task and content enter the brand scene naturally.
- Options differ materially in narrative and composition, not merely layout labels.
- Full-image concepts pass visual review of actual outputs and their reference/input records; H5 candidates additionally pass `brandSystemClosure` and the options-only Wild Design Gate. Neither proves the other's completion.
- Earlier directions are classified accurately; promising mechanisms inform new exploration, while only explicitly approved targets are frozen.

## Failure routing

- Missing source proof → Brand Researcher / Design Translator.
- Wrong host capacity or task framing → Host Strategist.
- Weak semantic/compositional application → this role.
- Implementation drift after selection → Host Implementation Agent.

## Case evolution

Record recurring application failures as named patterns with: observed mismatch, why self-review missed it, corrected decision rule, machine-checkable signal where possible, and regression fixture. Do not turn one user's taste into a universal rule.

## 宿主 expressive 决策记忆

强决策发生时使用 SKILL.md 的阶段检索入口；判断依据维护在正式决策库，任务中记录采用或拒绝理由。
