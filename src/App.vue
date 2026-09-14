<template>
  <main class="shell" :class="[`theme-${selectedStyleId}`, { 'theme-dango': selectedStyleId === 'dango' }]" :style="themeVars">
    <aside class="panel" aria-label="Visual inspector">
      <div class="style-rail">
        <p class="section-heading"><strong>参考站</strong></p>
        <div class="style-switcher compact" aria-label="brand style presets">
          <button
            v-for="preset in stylePresets"
            :key="preset.id"
            class="style-button"
            :class="{ active: selectedStyleId === preset.id }"
            :title="preset.label"
            type="button"
            @click="selectStyle(preset.id)"
          >
            <img class="site-icon" :src="preset.icon" :alt="`${preset.label} icon`" width="16" height="16" />
            <span>{{ preset.label }}</span>
          </button>
        </div>
      </div>

      <div class="side-rail">
        <nav class="inspector-tabs" aria-label="inspector sections">
          <button type="button" :class="{ active: selectedInspectorTab === 'style' }" @click="showStyleMenu">风格</button>
          <button type="button" :class="{ active: selectedInspectorTab === 'components' }" @click="showComponentMenu">组件</button>
          <button type="button" :class="{ active: selectedInspectorTab === 'pages' }" @click="showPageMenu">页面</button>
        </nav>

        <details
          v-if="selectedInspectorTab === 'pages'"
          open
          aria-label="brand learning proof status"
          style="margin: 10px 8px; padding: 10px; border: 1px solid rgba(127,127,127,.28); border-radius: 10px; background: rgba(127,127,127,.06); font-size: 11px; line-height: 1.45;"
        >
          <summary style="cursor: pointer; font-weight: 700;">Demo 学习证明 · {{ selectedLearningProof.overall }}</summary>
          <p style="margin: 7px 0; opacity: .76;">不是官网镜像、宿主成果或品牌素材模板。</p>
          <div style="display: flex; flex-wrap: wrap; gap: 5px;">
            <span
              v-for="proof in selectedLearningProof.proofs"
              :key="proof.id"
              :title="proof.note"
              :style="{
                padding: '3px 6px',
                borderRadius: '999px',
                border: '1px solid currentColor',
                opacity: proof.state === 'pass' ? 1 : .68,
                color: proof.state === 'pass' ? '#18794e' : proof.state === 'blocked' ? '#b42318' : 'inherit',
              }"
            >
              {{ proof.label }} · {{ proof.status }}
            </span>
          </div>
          <div v-if="selectedLearningProof.blockers.length" style="margin-top: 8px; color: #b42318;">
            <strong>内部 blocker</strong>
            <ul style="margin: 4px 0 0; padding-left: 16px;">
              <li v-for="blocker in selectedLearningProof.blockers" :key="blocker">{{ blocker }}</li>
            </ul>
          </div>
          <p style="margin: 8px 0 0; opacity: .72;">宿主 apply：{{ selectedLearningProof.hostApply }}</p>
          <div v-if="selectedStyle.registry" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(127,127,127,.22); opacity: .78;">
            <div>公共资产 {{ selectedStyle.registry.version }} · {{ publicationStatusLabel(selectedStyle.registry.publicationStatus) }}</div>
            <div style="margin-top: 3px;">Web {{ platformSupportLabel(selectedStyle.registry.platformSupport.web) }} · Taro H5 {{ platformSupportLabel(selectedStyle.registry.platformSupport.taroH5) }} · 小程序 {{ platformSupportLabel(selectedStyle.registry.platformSupport.weapp) }}</div>
          </div>
        </details>

        <template v-if="selectedInspectorTab === 'style'">
          <div class="token-category-list rail-list" aria-label="token categories">
            <div
              v-for="category in styleCategories"
              :key="category.id"
              class="token-category"
              :class="[
                `token-category--${styleCategorySupportKind(category)}`,
                { active: selectedWorkspaceMode === 'style' && selectedStyleCategoryId === category.id },
              ]"
            >
              <button class="node-button token-category-button" type="button" @click="selectStyleCategory(category.id)">
                <strong>{{ category.label }} <em>{{ category.zh }}</em><span>{{ styleCategorySupportLabel(category) }}</span></strong>
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="selectedInspectorTab === 'pages'">
          <div class="page-list rail-list" aria-label="demo pages">
            <div
              v-for="template in currentPageTabs"
              :key="template.id"
              class="page-node"
              :class="{ active: isTemplateTabActive(template) }"
            >
              <button class="node-button" type="button" @click="selectTemplateTab(template)">
                <strong>
                  <b>
                    {{ templatePageTitle(template) }}
                    <span :class="`page-kind-tag page-kind-tag--${templateKindClass(template)}`">{{ templateKindLabel(template) }}</span>
                  </b>
                  <em>{{ templateDescription(template) }}</em>
                </strong>
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <nav class="side-tabs workflow-tabs component-category-tabs" aria-label="component categories">
            <button
              v-for="category in componentCategorySpecs"
              :key="category.id"
              type="button"
              :class="{ active: selectedComponentCategoryId === category.id }"
              @click="selectComponentCategory(category.id)"
            >
              {{ category.label }}
            </button>
          </nav>
          <div class="component-list rail-list">
            <div
              v-for="item in componentPanelItems"
              :key="item.id"
              class="component"
              :class="[
                `component--${componentSupportKind(item.name)}`,
                { active: selectedComponent === item.name, missing: isMissing(item.name) },
              ]"
              :data-instance-id="item.id"
            >
              <button
                class="node-button"
                type="button"
                @click="selectCatalogComponent(item.name)"
              >
                <strong>
                  {{ item.label }} <em>{{ componentChineseName(item.name) }}</em>
                  <span>{{ componentSupportLabel(item.name) }}</span>
                </strong>
              </button>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <section class="workspace">
      <div class="demo-stage">
        <article class="component-showcase" aria-label="dangoui component showcase">
          <section class="template-preview">
            <div
              class="phone template-phone"
              :class="{
                'template-phone--source-desktop': isDesktopHeroProofSurface || (selectedTemplateShell.device === 'desktop' && (selectedStyle.normalPreviewDevice !== 'phone' || isExplicitProofSurface)),
                'template-phone--source-mobile-proof': isMobileProofSurface,
                'template-phone--proof-mode': isExplicitProofSurface,
                'template-phone--bottom-actions': showDemoBottomActions,
              }"
              ref="phoneRef"
              :style="{ ...mockupScaleVars, ...phoneBrandVars }"
              @wheel="handleMockupWheel"
            >
              <div
                class="phone-screen"
                :class="{
'phone-screen--home': isHomeTemplate && selectedInspectorTab === 'pages',
                  'phone-screen--display': isDisplayTemplate && selectedWorkspaceMode !== 'style',
                  'phone-screen--publish': activeSide === 'publish' && selectedInspectorTab === 'pages',
                  [`layout-recipe--${selectedTemplateLayoutRecipe}`]: Boolean(selectedTemplateLayoutRecipe),
                  'phone-screen--bottom-actions': showDemoBottomActions,
                  'phone-screen--no-bottom-actions': !showDemoBottomActions,
                  'phone-screen--has-selection': Boolean(selectedInstanceId),
                  'has-group': isPublishTemplate,
                }"
                @click="restoreMockupSelection"
                @mouseover="prepareMockupHoverLabel"
                @mouseleave="clearMockupHoverLabel"
              >
                <div
                  v-if="showPreviewNavigationBar || showPreviewStatusBar"
                  class="click-target"
                  :class="{ selected: selectedInstanceId === pageNodeId('NavigationBar') }"
                  :data-node-id="pageNodeId('NavigationBar')"
                  tabindex="0"
                  @click.capture="handleNavigationBarCapture"
                  @click="selectInstance(pageNodeId('NavigationBar'), $event)"
                  @keydown.enter.prevent="selectInstance(pageNodeId('NavigationBar'), $event)"
                >
                  <span class="tag">NavigationBar</span>
                  <div v-if="showPreviewStatusBar" class="mock-statusbar" :class="mockStatusbarClass" aria-hidden="true">
                    <span class="mock-statusbar-time">9:41</span>
                    <span class="mock-statusbar-camera"></span>
                    <span class="mock-statusbar-icons">
                      <i class="mock-statusbar-signal"><b></b><b></b><b></b><b></b></i>
                      <i class="mock-statusbar-wifi"></i>
                      <i class="mock-statusbar-battery"><b></b></i>
                    </span>
                  </div>
                  <DuNavigationBar v-if="showPreviewNavigationBar" platform="miniprogram" color="default" :back="showNavigationBack" :share="false">
                    <template v-if="showNavigationLogo" #left>
                      <div class="nav-logo-mark" aria-label="brand logo">
                        <span>{{ navigationLogoText }}</span>
                      </div>
                    </template>
                    <div class="nav-content">
                      <strong class="nav-title">{{ navigationTitle }}</strong>
                      <div
                        v-if="showNavigationSearch"
                        class="nav-searchbar-target"
                        :class="{ selected: selectedInstanceId === pageNodeId('Search') }"
                        :data-node-id="pageNodeId('Search')"
                        @click.stop="selectInstance(pageNodeId('Search'))"
                      >
                        <span class="tag">Search</span>
                        <DuSearch readonly :placeholder="[navigationSearchPlaceholder]">
                          <template #right>
                            <span class="nav-search-recognition">
                              <DuDivider />
                              <DuIcon :icon="iconScanning" />
                              <b>识物</b>
                            </span>
                          </template>
                        </DuSearch>
                      </div>
                    </div>
                    <template v-if="showNavigationActions" #right>
                      <div class="nav-icon-actions">
                        <DuIconButton
                          class="click-target nav-iconbutton-target"
                          :class="{ selected: selectedInstanceId === pageNodeId('IconButton') }"
                          :data-node-id="pageNodeId('IconButton')"
                          size="small"
                          :icon="iconRefresh"
                          @click.stop="selectInstance(pageNodeId('IconButton'), $event)"
                        />
                      </div>
                    </template>
                  </DuNavigationBar>
                </div>
                <div
                  class="contents template-contents"
                  :class="{
                    'style-phone-contents': selectedWorkspaceMode === 'style',
                  'component-phone-contents': selectedInspectorTab === 'components',
                  }"
                >
                  <template v-if="selectedWorkspaceMode === 'style'">
                    <section class="style-mockup-page" aria-label="style preview page">
                      <h2>{{ selectedStyleCategory?.label }} <span>{{ selectedStyleCategory?.zh }}</span></h2>
                      <p>{{ currentStyleCategoryDescription }}</p>
                    </section>

                    <section
                      ref="styleEvidenceRef"
                      class="style-evidence-mockup-card"
                      :class="{ 'style-evidence-mockup-card--pulse': styleCategoryPulse }"
                      aria-label="style evidence"
                    >
                      <div class="style-preview-heading">
                        <span>项目结构与映射</span>
                      </div>
                      <div v-if="currentStyleCapabilityNote" class="style-capability-note">
                        <strong>{{ currentStyleCapabilityNote.title }}</strong>
                        <span>{{ currentStyleCapabilityNote.body }}</span>
                      </div>
                      <section
                        class="computed-evidence-chain"
                        :data-evidence-state="currentEvidenceChainState"
                        aria-label="computed-first evidence chain"
                      >
                        <header>
                          <strong>证据搜寻</strong>
                          <span>{{ currentEvidenceChainSummary }}</span>
                        </header>
                        <ol>
                          <li v-for="row in currentEvidenceChainRows" :key="row.step">
                            <b>{{ row.step }}</b>
                            <span>
                              <strong>{{ row.title }}</strong>
                              <em>{{ row.value }}</em>
                              <small>{{ row.note }}</small>
                            </span>
                          </li>
                        </ol>
                      </section>
                      <div v-if="selectedStyleCategoryId === 'color'" class="palette-stack">
                        <section class="palette-list" aria-label="project color inventory and mapping">
                          <p v-if="selectedStyle.id !== 'dango'" class="style-evidence-note">保持 DangoUI 一级/二级/三级色彩结构，高频品牌色只覆盖最相似的 token，并用「覆盖」标记显示原值到新值的变化。「推测」一整块色阶剩余的颜色，完全和 DangoUI 相同就用「命中」。</p>
                          <div class="color-hierarchy-panel" aria-label="DangoUI color token hierarchy">
                            <div class="color-hierarchy-grid">
                              <div
                                v-for="group in dangoColorStructureRows"
                                :key="group.title"
                                class="color-hierarchy-group"
                              >
                                <span>{{ group.title }}</span>
                                <p>{{ group.description }}</p>
                                <div
                                  v-if="group.variant === 'paletteRows'"
                                  class="palette-scale-list"
                                  :class="{ 'has-overrides': group.hasOverrides }"
                                >
                                  <div v-for="row in group.items" :key="row.family" class="palette-scale-row" :class="`palette-scale-row--${row.family}`">
                                    <strong>{{ row.family }}</strong>
                                    <div class="palette-scale-swatches">
                                      <button
                                        v-for="step in row.steps"
                                        :key="`${row.family}-swatch-${step.name}`"
                                        type="button"
                                        :class="{ copied: copiedColorValue === step.value, overridden: step.isOverridden, inferred: step.isInferred }"
                                        :aria-label="`复制 ${step.name} ${step.value}`"
                                        :style="{ background: step.swatch, color: step.textColor }"
                                        @click.stop="copyPaletteColor(step.value)"
                                      >
                                        {{ step.label }}
                                      </button>
                                    </div>
                                    <div class="palette-scale-labels">
                                      <span v-for="step in row.steps" :key="`${row.family}-label-${step.name}`">
                                        <em>{{ step.isOverridden ? step.baseDisplayValue : step.displayValue }}</em>
                                        <strong v-if="step.isOverridden">{{ step.displayValue }}</strong>
                                        <b v-if="step.isOverridden">{{ step.overrideKind }}</b>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div v-else-if="group.variant === 'semanticTextRows'" class="semantic-palette-list">
                                  <details
                                    v-for="row in group.items"
                                    :key="row.family"
                                    class="semantic-palette-row"
                                    :open="row.family === 'primary'"
                                  >
                                    <summary class="semantic-palette-heading">
                                      <strong>{{ row.family }}</strong>
                                      <small>{{ row.category }}</small>
                                    </summary>
                                    <p>{{ row.scaleText }}</p>
                                    <div class="semantic-mapping-list">
                                      <button
                                        v-for="mapping in row.mappings"
                                        :key="`${row.family}-mapping-${mapping.name}`"
                                        type="button"
                                        :class="{ copied: copiedColorValue === mapping.value, overridden: mapping.isOverridden }"
                                        :data-hover-label="`${mapping.name} ${mapping.expression}`"
                                        :style="{ '--alias-swatch': mapping.swatch, '--alias-text': readableTextColor(mapping.swatch, 0.58) }"
                                        @click.stop="copyPaletteColor(mapping.value)"
                                      >
                                        <i></i>
                                        <span>{{ mapping.name }}</span>
                                        <em>{{ mapping.expression }}</em>
                                        <small v-if="mapping.isOverridden">{{ mapping.overrideKind }}</small>
                                      </button>
                                    </div>
                                  </details>
                                </div>
                                <div v-else-if="group.variant === 'componentAliasRows'" class="component-alias-list">
                                  <details
                                    v-for="row in group.items"
                                    :key="row.component"
                                    class="component-alias-row"
                                    :open="row.expanded"
                                  >
                                    <summary class="component-alias-heading">
                                      <span>{{ row.component }}</span>
                                      <small>{{ row.summary }}</small>
                                    </summary>
                                    <div v-if="row.variantGroups" class="component-variant-list">
                                      <details
                                        v-for="variant in row.variantGroups"
                                        :key="`${row.component}-${variant.name}`"
                                        class="component-variant-row"
                                        :open="variant.name === 'primary'"
                                      >
                                        <summary class="component-variant-heading">
                                          <strong>{{ variant.name }}</strong>
                                          <small>{{ variant.summary }}</small>
                                        </summary>
                                        <div class="semantic-mapping-list">
                                          <button
                                            v-for="mapping in variant.mappings"
                                            :key="`${row.component}-${variant.name}-mapping-${mapping.name}-${mapping.expression}`"
                                            type="button"
                                            :class="{ copied: copiedColorValue === mapping.value, overridden: mapping.isOverridden }"
                                            :data-hover-label="mapping.expression"
                                            :style="{ '--alias-swatch': mapping.swatch }"
                                            @click.stop="copyPaletteColor(mapping.hexValue)"
                                          >
                                            <i></i>
                                            <span>{{ mapping.name }}</span>
                                            <em>{{ mapping.expression }}</em>
                                            <small v-if="mapping.isOverridden">{{ mapping.overrideKind }}</small>
                                          </button>
                                        </div>
                                      </details>
                                    </div>
                                    <div v-else class="semantic-mapping-list">
                                      <button
                                        v-for="mapping in row.mappings"
                                        :key="`${row.component}-mapping-${mapping.name}`"
                                        type="button"
                                        :class="{ copied: copiedColorValue === mapping.value, overridden: mapping.isOverridden }"
                                        :data-hover-label="mapping.expression"
                                        :style="{ '--alias-swatch': mapping.swatch }"
                                        @click.stop="copyPaletteColor(mapping.hexValue)"
                                      >
                                        <i></i>
                                        <span>{{ mapping.name }}</span>
                                        <em>{{ mapping.expression }}</em>
                                        <small v-if="mapping.isOverridden">{{ mapping.overrideKind }}</small>
                                      </button>
                                    </div>
                                    <p v-if="!row.variantGroups && !row.mappings.length" class="component-alias-empty">该组件在当前快照中只有尺寸、资源、文案或旧层变量等非色彩 token，不进入色彩链路表。</p>
                                  </details>
                                </div>
                                <div v-else class="color-chain-list">
                                  <b v-for="(item, itemIndex) in group.items" :key="`${group.title}-${item.name || itemIndex}`">
                                    <i :style="{ background: item.swatch }"></i>
                                    <span>
                                      <strong>{{ item.name }}</strong>
                                      <em>{{ item.value }}</em>
                                      <small v-if="item.chain">{{ item.chain }}</small>
                                    </span>
                                  </b>
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'layout' && selectedStyleRecipeRows.length" class="style-layout-list">
                        <details
                          v-for="(item, index) in selectedStyleRecipeRows"
                          :key="`style-layout-${item.title}`"
                          class="style-layout-card"
                          :open="index === 0"
                        >
                          <summary class="style-layout-heading">
                            <b aria-hidden="true">›</b>
                            <span>{{ item.value }}</span>
                            <small>{{ item.source }} · {{ styleRecipeStatusLabel(item.status, selectedStyleCategoryId, item) }}</small>
                          </summary>
                          <div class="style-layout-content">
                            <div class="style-layout-visual" :class="`style-layout-visual--${kebabName(item.title)}`">
                              <template v-if="item.title === 'two-column'">
                                <span class="layout-masonry-column">
                                  <span class="layout-block layout-block--a"></span>
                                  <span class="layout-block layout-block--d"></span>
                                  <span class="layout-block layout-block--e"></span>
                                </span>
                                <span class="layout-masonry-column">
                                  <span class="layout-block layout-block--b"></span>
                                  <span class="layout-block layout-block--c"></span>
                                  <span class="layout-block layout-block--f"></span>
                                </span>
                              </template>
                              <template v-else-if="['white-base-gray-card', 'gray-base-white-card', 'gray-base-full-bleed'].includes(item.title)">
                                <span class="layout-block layout-block--a"></span>
                                <span class="layout-block layout-block--b"></span>
                                <span class="layout-block layout-block--c"></span>
                                <span class="layout-block layout-block--d"></span>
                                <span class="layout-block layout-block--e"></span>
                                <span class="layout-block layout-block--f"></span>
                              </template>
                              <template v-else>
                                <span class="layout-block layout-block--a"></span>
                                <span class="layout-block layout-block--b"></span>
                                <span class="layout-block layout-block--c"></span>
                                <span class="layout-block layout-block--d"></span>
                                <span class="layout-block layout-block--e"></span>
                                <span class="layout-block layout-block--f"></span>
                              </template>
                            </div>
                            <p><strong>说明</strong><em>{{ item.note }}</em></p>
                          </div>
                        </details>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'spacing' && spacingScaleRows.length" class="style-spacing-list">
                        <details
                          v-for="(item, index) in spacingScaleRows"
                          :key="`style-spacing-${item.title}`"
                          class="style-spacing-card"
                          :class="item.kind ? `style-inventory-row--${item.kind}` : ''"
                          :open="index === 0"
                        >
                          <summary class="style-spacing-heading">
                            <b aria-hidden="true">›</b>
                            <span>{{ item.title }}</span>
                            <small v-if="!item.operatorLabel">{{ item.value }} · {{ item.source }}</small>
                          </summary>
                          <div class="style-spacing-content">
                            <div class="style-spacing-visual" :data-size-label="item.value" :style="{ '--spacing-demo-size': `${item.size}px`, '--spacing-demo-width': `${item.width}px` }">
                              <i></i>
                              <span class="style-spacing-gutter" :data-size-label="item.value"></span>
                              <i></i>
                              <span class="style-spacing-gutter" :data-size-label="item.value"></span>
                              <i></i>
                            </div>
                            <template v-if="item.operatorLabel">
                              <p><strong>一句话</strong><em>{{ item.operatorLabel }}</em></p>
                              <p><strong>适合用在</strong><em>{{ item.usage || item.target }}</em></p>
                              <p><strong>不要这样用</strong><em>{{ item.anti }}</em></p>
                              <p class="style-inventory-affiliation"><strong>归属</strong><em>{{ item.affiliation }}</em></p>
                            </template>
                            <template v-else>
                              <p><strong>说明</strong><em>{{ item.note }}</em></p>
                              <p><strong>未来 token</strong><em>{{ item.target }}</em></p>
                            </template>
                          </div>
                        </details>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'radius' && radiusScaleRows.length" class="style-radius-list">
                        <details
                          v-for="(item, index) in radiusScaleRows"
                          :key="`style-radius-${item.title}`"
                          class="style-radius-card"
                          :class="item.kind ? `style-inventory-row--${item.kind}` : ''"
                          :open="index === 0"
                        >
                          <summary class="style-radius-heading">
                            <b aria-hidden="true">›</b>
                            <span>{{ item.title }}</span>
                            <small>{{ item.value }} · {{ item.source }}</small>
                          </summary>
                          <div class="style-radius-content">
                            <div class="style-radius-visual" :data-radius-label="item.value" :style="{ '--radius-demo-value': item.radius }">
                              <i :data-radius-label="item.value"></i>
                            </div>
                            <template v-if="item.operatorLabel">
                              <p><strong>一句话</strong><em>{{ item.operatorLabel }}</em></p>
                              <p><strong>适合用在</strong><em>{{ item.usage || item.target }}</em></p>
                              <p><strong>不要这样用</strong><em>{{ item.anti }}</em></p>
                              <p class="style-inventory-affiliation"><strong>归属</strong><em>{{ item.affiliation }}</em></p>
                            </template>
                            <template v-else>
                              <p><strong>说明</strong><em>{{ item.note }}</em></p>
                              <p><strong>未来 token</strong><em>{{ item.target }}</em></p>
                            </template>
                          </div>
                        </details>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'shadow' && selectedStyleRecipeRows.length" class="style-shadow-list">
                        <details
                          v-for="(item, index) in selectedStyleRecipeRows"
                          :key="`style-shadow-${item.title}`"
                          class="style-shadow-card"
                          :class="item.kind ? `style-inventory-row--${item.kind}` : ''"
                          :open="index === 0"
                        >
                          <summary class="style-shadow-heading">
                            <b aria-hidden="true">›</b>
                            <span>{{ item.title }}</span>
                            <small v-if="!item.operatorLabel">{{ item.value }} · {{ item.source }}</small>
                          </summary>
                          <div class="style-shadow-content">
                            <div class="style-shadow-visual" :class="`style-shadow-visual--${styleRecipeClassName(item.title)}`">
                              <i></i>
                            </div>
                            <template v-if="item.operatorLabel">
                              <p><strong>一句话</strong><em>{{ item.operatorLabel }}</em></p>
                              <p><strong>适合用在</strong><em>{{ item.usage || item.target }}</em></p>
                              <p><strong>不要这样用</strong><em>{{ item.anti }}</em></p>
                              <p class="style-inventory-affiliation"><strong>归属</strong><em>{{ item.affiliation }}</em></p>
                            </template>
                            <template v-else>
                              <p><strong>说明</strong><em>{{ item.note }}</em></p>
                              <p><strong>未来 token</strong><em>{{ item.target }}</em></p>
                            </template>
                          </div>
                        </details>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'typography'" class="style-typography-matrix">
                        <section
                          v-for="group in typographyMatrixGroups"
                          :key="`type-matrix-${group.id}`"
                          class="style-typography-group"
                        >
                          <header>
                            <strong>{{ group.id }}</strong>
                            <span>{{ group.label }}</span>
                          </header>
                          <div>
                            <b
                              v-for="item in group.items"
                              :key="`type-matrix-${item.title}`"
                              :style="{ fontSize: `${item.size}px`, lineHeight: `${item.lineHeight}px`, fontWeight: item.weight }"
                            >
                              <span>{{ item.title }}</span>
                              <em>{{ item.size }}/{{ item.lineHeight }}</em>
                            </b>
                          </div>
                        </section>
                        <p class="style-typography-note">
                          <strong>说明</strong>
                          <em>H/B/N 是 baseline 字号结构：H 用于标题和强强调，B 用于正文强调和组件标题，N 用于正文、说明和辅助文本。品牌字体包只在有明确证据时进入页面样式，不直接替代 DangoUI 结构。</em>
                        </p>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'icon'" class="style-icon-library">
                        <section v-if="selectedStyle.id !== 'dango' && selectedStyleRecipeRows.length" class="style-brand-atom-list">
                          <details
                            v-for="(item, index) in selectedStyleRecipeRows"
                            :key="`style-icon-atom-${item.title}`"
                            class="style-inventory-row"
                            :class="item.kind ? `style-inventory-row--${item.kind}` : ''"
                            :open="index === 0"
                          >
                            <summary class="style-inventory-heading">
                              <span>{{ item.title }}</span>
                            </summary>
                            <div class="style-inventory-body">
                              <div
                                class="style-recipe-visual style-recipe-visual--icon"
                                :style="recipeSwatchStyle(item)"
                              >
                                <i aria-hidden="true"></i>
                                <i aria-hidden="true"></i>
                                <i aria-hidden="true"></i>
                                <span>{{ recipeSwatchText(item) }}</span>
                              </div>
                              <div class="style-inventory-meta style-inventory-meta--operator">
                                <p><strong>一句话</strong><em>{{ item.operatorLabel || item.title }}</em></p>
                                <p><strong>适合用在</strong><em>{{ item.usage || item.target }}</em></p>
                                <p><strong>不要这样用</strong><em>{{ item.anti || "不要把品牌图片资产硬塞进 DangoUI icon 枚举。" }}</em></p>
                                <p class="style-inventory-affiliation"><strong>归属</strong><em>{{ item.affiliation || `${item.source} · ${styleRecipeStatusLabel(item.status, selectedStyleCategoryId, item)}` }}</em></p>
                              </div>
                            </div>
                          </details>
                        </section>
                        <section class="style-icon-usage">
                          <header>
                            <strong>Icon 怎么用</strong>
                            <span>只展示组件库枚举和调用方式，缺失图标再进入 Asset / ReviewQueue。</span>
                          </header>
                          <code>import { iconCamera } from "dangoui-icon-config"</code>
                          <code>&lt;DuIcon :icon="iconCamera" /&gt;</code>
                          <code>&lt;DuActionButton :name="iconRefresh" /&gt;</code>
                          <code>&lt;DuButton text="发布" :icon="iconPlusHeavy" icon-position="left" /&gt;</code>
                        </section>
                        <section class="style-icon-enum">
                          <header>
                            <strong>Icon 枚举</strong>
                            <span>{{ iconLibraryRows.length }} icons from dangoui-icon-config</span>
                          </header>
                          <div>
                            <button
                              v-for="item in iconLibraryRows"
                              :key="item.exportName"
                              type="button"
                              :title="`${item.exportName} · ${item.name}`"
                            >
                              <DuIcon :icon="item.icon" :size="22" />
                              <span>{{ item.name }}</span>
                              <small>{{ item.exportName }}</small>
                            </button>
                          </div>
                        </section>
                      </div>
                      <div v-else-if="selectedStyleCategoryId === 'button'" class="style-button-library">
                        <section v-if="selectedStyle.id !== 'dango' && selectedStyleRecipeRows.length" class="style-brand-atom-list">
                          <details
                            v-for="(item, index) in selectedStyleRecipeRows"
                            :key="`style-button-atom-${item.title}`"
                            class="style-inventory-row"
                            :class="item.kind ? `style-inventory-row--${item.kind}` : ''"
                            :open="index === 0"
                          >
                            <summary class="style-inventory-heading">
                              <span>{{ item.title }}</span>
                            </summary>
                            <div class="style-inventory-body">
                              <div
                                class="style-recipe-visual style-recipe-visual--button"
                                :class="[
                                  `style-recipe-visual--${item.visualKey || kebabName(item.title)}`,
                                  { 'is-recipe-active': isStyleRecipeActive(item) },
                                ]"
                                :style="recipeSwatchStyle(item)"
                                role="button"
                                tabindex="0"
                                @click="activateStyleRecipe(item)"
                                @keydown.enter.prevent="activateStyleRecipe(item)"
                                @keydown.space.prevent="activateStyleRecipe(item)"
                              >
                                <button type="button" tabindex="-1" aria-hidden="true">{{ recipeSwatchText(item) }}</button>
                              </div>
                              <div class="style-inventory-meta style-inventory-meta--operator">
                                <p><strong>一句话</strong><em>{{ item.operatorLabel || item.title }}</em></p>
                                <p><strong>适合用在</strong><em>{{ item.usage || item.target }}</em></p>
                                <p><strong>不要这样用</strong><em>{{ item.anti || "不要把品牌按钮误做成无证据的图片按钮或重阴影按钮。" }}</em></p>
                                <p class="style-inventory-affiliation"><strong>归属</strong><em>{{ item.affiliation || `${item.source} · ${styleRecipeStatusLabel(item.status, selectedStyleCategoryId, item)}` }}</em></p>
                              </div>
                            </div>
                          </details>
                        </section>
                        <section class="style-button-usage">
                          <header>
                            <strong>Button 怎么用</strong>
                            <span>只展示 DangoUI 已有按钮组件和真实 props；FAB 当前仍是待新增能力，不混进 DuButton API。</span>
                          </header>
                          <code>import { DuButton, DuIconButton, DuActionButton } from "dangoui"</code>
                          <code>&lt;DuButton text="提交" type="primary" size="normal" /&gt;</code>
                          <code>&lt;DuButton text="柔和" type="secondary" /&gt; &lt;!-- soft 视觉态 --&gt;</code>
                          <code>&lt;DuButton text="查看更多" type="outline" :icon="iconPlusHeavy" icon-size="16px" icon-position="left" /&gt;</code>
                          <code>&lt;DuIconButton :icon="iconCamera" size="normal" /&gt;</code>
                          <code>&lt;DuActionButton :name="iconRefresh" /&gt;</code>
                        </section>
                        <section class="style-button-showcase">
                          <header>
                            <strong>Button 形态</strong>
                            <span>真实组件预览：type、size、icon、arrowRight、disabled、loading、full。</span>
                          </header>
                          <div class="style-button-demo-group">
                            <strong>type</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="主要按钮" type="primary" />
                              <DuButton text="柔和按钮" type="secondary" />
                              <DuButton text="描边按钮" type="outline" />
                              <DuButton text="文字按钮" type="text" />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>size</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="mini" size="mini" />
                              <DuButton text="small" size="small" />
                              <DuButton text="normal" size="normal" />
                              <DuButton text="medium" size="medium" />
                              <DuButton text="large" size="large" />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>icon / arrow</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="发布" type="primary" :icon="iconPlusHeavy" icon-size="16px" icon-position="left" />
                              <DuButton text="继续" type="outline" arrow-right />
                              <DuIconButton :icon="iconCamera" size="large" />
                              <DuActionButton :name="iconRefresh" />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>state</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="禁用" type="primary" disabled />
                              <DuButton text="临时禁用" type="outline" disabled disabled-type="temp" />
                              <DuButton text="加载中" type="primary" loading />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>full</strong>
                            <DuButton text="通栏主按钮" type="primary" full />
                          </div>
                        </section>
                      </div>
                      <div v-else-if="selectedStyleRecipeRows.length" class="style-inventory-list">
                        <details
                          v-for="(item, index) in selectedStyleRecipeRows"
                          :key="`style-inventory-${selectedStyleCategoryId}-${item.title}`"
                          class="style-inventory-row"
                          :class="item.kind ? `style-inventory-row--${item.kind}` : ''"
                          :open="index === 0"
                        >
                          <summary class="style-inventory-heading">
                            <span>{{ item.title }}</span>
                            <small v-if="selectedStyleCategoryId === 'asset'">{{ item.role || "页面资产" }}</small>
                            <small v-else-if="selectedStyleCategoryId !== 'divider'">{{ item.source }} · {{ styleRecipeStatusLabel(item.status, selectedStyleCategoryId, item) }}</small>
                          </summary>
                          <div class="style-inventory-body">
                            <div
                              class="style-recipe-visual"
                              :class="[
                                `style-recipe-visual--${selectedStyleCategoryId}`,
                                `style-recipe-visual--${item.visualKey || kebabName(item.title)}`,
                                { 'is-recipe-active': isStyleRecipeActive(item) },
                                { 'is-recipe-interactive': isInteractiveStyleRecipe(item) },
                              ]"
                              :style="recipeSwatchStyle(item)"
                              :role="isInteractiveStyleRecipe(item) ? 'button' : undefined"
                              :tabindex="isInteractiveStyleRecipe(item) ? 0 : undefined"
                              @click="isInteractiveStyleRecipe(item) && activateStyleRecipe(item)"
                              @keydown.enter.prevent="isInteractiveStyleRecipe(item) && activateStyleRecipe(item)"
                              @keydown.space.prevent="isInteractiveStyleRecipe(item) && activateStyleRecipe(item)"
                            >
                              <template v-if="selectedStyleCategoryId === 'typography'">
                                <strong>Aa</strong>
                                <span>{{ item.title }}</span>
                                <small>{{ item.value }}</small>
                              </template>
                              <template v-else-if="selectedStyleCategoryId === 'icon'">
                                <i aria-hidden="true"></i>
                                <i aria-hidden="true"></i>
                                <i aria-hidden="true"></i>
                                <span>{{ recipeSwatchText(item) }}</span>
                              </template>
                              <template v-else-if="selectedStyleCategoryId === 'button'">
                                <button type="button" aria-hidden="true">{{ recipeSwatchText(item) }}</button>
                                <small>{{ item.value }}</small>
                              </template>
                              <template v-else-if="selectedStyleCategoryId === 'asset'">
                                <i aria-hidden="true"></i>
                                <span>{{ recipeSwatchText(item) }}</span>
                                <small>{{ item.role || item.title }}</small>
                              </template>
                              <template v-else-if="selectedStyleCategoryId === 'divider'">
                                <i aria-hidden="true"></i>
                              </template>
                              <template v-else-if="selectedStyleCategoryId === 'motion'">
                                <i aria-hidden="true"></i>
                              </template>
                              <template v-else>
                                <span>{{ recipeSwatchText(item) }}</span>
                              </template>
                            </div>
                              <div v-if="item.operatorLabel" class="style-inventory-meta style-inventory-meta--operator">
                                <p><strong>{{ selectedStyleCategoryId === 'asset' ? '它是什么' : '一句话' }}</strong><em>{{ item.operatorLabel || item.title }}</em></p>
                                <p v-if="item.value && selectedStyleCategoryId !== 'asset'"><strong>精确值</strong><em>{{ item.value }}</em></p>
                                <p><strong>{{ selectedStyleCategoryId === 'asset' ? '适合放哪里' : '适合用在' }}</strong><em>{{ item.usage || item.target }}</em></p>
                              <p><strong>{{ selectedStyleCategoryId === 'asset' ? '别这样用' : '不要这样用' }}</strong><em>{{ item.anti || "不要把它理解成普通卡片阴影或随手加一层内框。" }}</em></p>
                              <p class="style-inventory-affiliation"><strong>{{ selectedStyleCategoryId === 'asset' ? '落地方式' : '归属' }}</strong><em>{{ selectedStyleCategoryId === 'asset' ? (item.placement || item.affiliation || "页面资产样式") : (item.affiliation || `${item.source} · ${styleRecipeStatusLabel(item.status, selectedStyleCategoryId, item)}`) }}</em></p>
                            </div>
                            <div v-else class="style-inventory-meta">
                              <p><strong>value</strong><em>{{ item.value }}</em></p>
                              <p><strong>mapping</strong><em>{{ item.target }}</em></p>
                              <p><strong>evidence</strong><em>{{ item.note }}</em></p>
                            </div>
                          </div>
                        </details>
                      </div>
                      <div v-else class="recipe-placeholder">
                        <span>{{ selectedStyleCategory ? styleCategorySupportLabel(selectedStyleCategory) : '' }}</span>
                        <strong>{{ selectedStyleCategory?.nextStep }}</strong>
                        <p>{{ selectedStyleCategory?.scope }}</p>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="selectedInspectorTab === 'components'">
                    <section class="style-mockup-page component-mockup-page" aria-label="component preview page">
                      <h2>{{ componentDisplayName(selectedComponent) || activeComponentCategory.label }} <span>{{ componentChineseName(selectedComponent) }}</span></h2>
                      <p class="component-title-description">
                        <span>{{ componentUserActionDescription }}</span>
                        <span>{{ componentAvailabilityDescription }}</span>
                      </p>
                    </section>

                    <section class="style-evidence-mockup-card component-evidence-mockup-card" aria-label="component evidence">
                      <div v-if="selectedComponentCategoryId === 'bar'" class="component-doc-section component-preview-section">
                        <strong>示例</strong>
                        <div class="bar-component-preview" :class="`bar-component-preview--${kebabName(selectedComponent)}`">
                          <div v-if="selectedComponent === 'NavigationBar'" :key="navigationExampleRenderKey" class="navigation-doc-examples">
                            <div class="navigation-doc-demo-row">
                              <DuNavigationBar :back="navExampleShowBack" :share="navExampleShowRight" :color="navigationExampleBaseColor" @share="handleNavigationExampleShare">
                                <template v-if="navigationAreaLeft && navigationSlotLeft" #left>
                                  <DuActionButton :name="iconRoom" />
                                </template>
                                <template v-if="navigationAreaLeft && navigationSlotScopedLeft" #scoped-left="{ opacity }">
                                  <span class="navigation-slot-chip">L {{ opacity.toFixed(1) }}</span>
                                </template>
                                <span v-if="navigationAreaDefault && navigationSlotDefault && navExampleShowTitle">标题</span>
                                <div v-if="navigationAreaDefault && navigationSlotDefault && navExampleShowSearch" class="navigation-doc-search-slot">
                                  <DuSearch bg="white" :placeholder="navigationExamplePlaceholders" readonly>
                                    <template #right>
                                      <DuIcon v-if="navExampleShowRight" :icon="iconCamera" />
                                      <DuDivider v-if="navExampleShowRight && navExampleShowRefresh" />
                                      <DuIcon :icon="iconScanning" />
                                    </template>
                                  </DuSearch>
                                </div>
                                <template v-if="navigationAreaDefault && navigationSlotScopedDefault" #scoped-default="{ opacity }">
                                  <span class="navigation-slot-chip">D {{ opacity.toFixed(1) }}</span>
                                </template>
                                <template v-if="navigationAreaRight && navigationSlotRight && navExampleShowRefresh" #right>
                                  <DuActionButton :name="iconRefresh" />
                                </template>
                                <template v-if="navigationAreaRight && navigationSlotScopedRight" #scoped-right="{ opacity }">
                                  <span class="navigation-slot-chip">R {{ opacity.toFixed(1) }}</span>
                                </template>
                              </DuNavigationBar>
                            </div>
                          </div>
                          <div v-else-if="selectedComponent === 'Search'" class="navigation-doc-search-examples">
                            <DuSearch
                              :key="`search-example-${componentExampleState.searchPlaceholder}`"
                              bg="white"
                              :class="{ 'component-example-disabled': componentExampleState.disabled }"
                              :clearable="!componentExampleState.disabled"
                              :placeholder="searchExamplePlaceholder"
                              value=""
                            >
                              <template v-if="componentExampleState.showIcon" #right>
                                <DuIcon :icon="iconCamera" />
                                <DuDivider />
                                <DuIcon :icon="iconScanning" />
                              </template>
                            </DuSearch>
                          </div>
                          <div v-else-if="selectedComponent === 'Tabs'" class="navigation-doc-tabs-examples">
                            <DuTabs
                              :type="componentExampleState.tabsType"
                              size="normal"
                              :value="componentExampleState.tabsValue"
                              @update:value="componentExampleState.tabsValue = $event"
                            >
                              <DuTab name="recommend">推荐</DuTab>
                              <DuTab name="latest">最新</DuTab>
                              <DuTab name="hot">热门</DuTab>
                            </DuTabs>
                          </div>
                          <div v-else-if="selectedComponent === 'SegmentControl'" class="mock-segment-control">
                            <button type="button" class="active">全部</button>
                            <button type="button">已上线</button>
                            <button type="button">待配置</button>
                          </div>
                          <div v-else-if="selectedComponent === 'TabBar'" class="mock-tabbar demo-bottom-tabbar">
                            <button class="active" type="button"><span>首页</span></button>
                            <button type="button"><span>发现</span></button>
                            <button type="button"><span>我的</span></button>
                          </div>
                          <div v-else-if="selectedComponent === 'BottomBar'" class="mock-bottom-bar">
                            <button class="mock-bottom-mini-action" type="button"><DuIcon :icon="iconCollectNormal" /><span>测试</span></button>
                            <DuButton text="按钮" type="outline" />
                            <DuButton text="按钮" type="primary" />
                          </div>
                          <div v-else-if="selectedComponent === 'Menu'" class="mock-menu-list">
                            <button type="button" class="active">内容配置</button>
                            <button type="button">投放设置</button>
                            <button type="button">数据复盘</button>
                          </div>
                        </div>
                      </div>

                      <div v-else-if="selectedComponentCategoryId === 'output'" class="component-doc-section component-preview-section">
                        <strong>示例</strong>
                        <div class="output-component-preview" :class="`output-component-preview--${kebabName(selectedComponent)}`">
                          <div v-if="selectedComponent === 'Badge'" class="component-example-inline">
                            <DuBadge :value="componentExampleState.active ? 8 : 0" color="primary" always-show>
                              <span class="badge-anchor">消息</span>
                            </DuBadge>
                            <DuBadge dot color="error" always-show>
                              <span class="badge-anchor">未读</span>
                            </DuBadge>
                            <DuBadge v-if="componentExampleState.showLabel" :value="128" :max="99" color="warning">
                              <span class="badge-anchor">库存</span>
                            </DuBadge>
                          </div>
                          <div v-else-if="selectedComponent === 'Tag'" class="tag-row">
                            <DuTag color="primary" bg="soft" :bordered="componentExampleState.bordered" :round="componentExampleState.rounded" :closeable="componentExampleState.showClose">限时活动</DuTag>
                          </div>
                          <div v-else-if="selectedComponent === 'Empty'" class="component-empty-example">
                            <DuEmpty :image="componentExampleState.showMedia ? imagePreviewSrc : ''" text="暂无可展示内容" :button-text="componentExampleState.showAction ? '去创建' : ''" />
                          </div>
                          <div v-else-if="selectedComponent === 'Image'" class="component-image-examples">
                            <DuImage :src="imagePreviewSrc" width="100%" height="112px" mode="aspectFill" :radius="componentExampleState.imageRadius" />
                            <DuImage v-if="componentExampleState.showMedia" :src="imagePreviewSrc" width="88px" height="88px" mode="aspectFit" :radius="Math.max(0, componentExampleState.imageRadius - 2)" />
                          </div>
                          <div v-else-if="selectedComponent === 'Avatar'" class="component-avatar-examples">
                            <div class="mock-avatar-row">
                              <DuAvatar type="primary" size="large" :bordered="componentExampleState.bordered">DU</DuAvatar>
                              <div><strong>运营账号</strong><span>内容负责人</span></div>
                            </div>
                          </div>
                          <div v-else-if="selectedComponent === 'Time'" class="mock-time-row">
                            <strong>{{ componentExampleState.showLabel ? '2026.06.29' : '20:00' }}</strong><p v-if="componentExampleState.showHelper">Showcase 开始 · 20:00</p>
                          </div>
                          <div v-else-if="selectedComponent === 'PriceStatistic'" class="mock-stat-grid">
                            <b><small v-if="componentExampleState.showLabel">PRICE</small>¥256</b><b><small v-if="componentExampleState.showLabel">SCORE</small>{{ componentExampleState.active ? 98 : 76 }}</b><b><small v-if="componentExampleState.showLabel">RANK</small>Top 5</b>
                          </div>
                          <DuSwiper v-else-if="selectedComponent === 'Swipe' || selectedComponent === 'Swiper'" class="component-swiper-example" :autoplay="componentExampleState.active" indicator-type="bar">
                            <DuSwiperItem>
                              <div class="component-swiper-slide"><strong>主推资源位</strong><p>活动 Banner</p></div>
                            </DuSwiperItem>
                            <DuSwiperItem v-if="componentExampleState.showMedia">
                              <div class="component-swiper-slide"><strong>媒体内容</strong><p>截图 / PV</p></div>
                            </DuSwiperItem>
                          </DuSwiper>
                        </div>
                      </div>

                      <div v-else-if="selectedComponentCategoryId === 'input'" class="component-doc-section component-preview-section">
                        <strong>示例</strong>
                        <div class="input-component-preview" :class="`input-component-preview--${kebabName(selectedComponent)}`">
                          <DuFormItem v-if="selectedComponent === 'FormItem'" :label="componentExampleState.showLabel ? '活动标题' : ''" :required="componentExampleState.active" :tips="componentExampleState.showHelper ? '用于说明字段要求、校验和辅助提示。' : ''">
                            <DuInput value="夏日市集报名" :bordered="componentExampleState.bordered" :disabled="componentExampleState.disabled" />
                          </DuFormItem>
                          <DuInput
                            v-else-if="selectedComponent === 'Input'"
                            value="夏日市集报名"
                            :prefix="componentExampleState.showLabel ? '标题' : ''"
                            :bordered="componentExampleState.bordered"
                            allow-clear
                            :disabled="componentExampleState.disabled"
                          />
                          <div v-else-if="selectedComponent === 'Textarea'" class="component-example-stack component-textarea-examples">
                            <DuTextarea value="默认背景态：适合表单里的长说明、备注、正文。" :show-count="componentExampleState.showCount" :maxlength="componentExampleState.textareaMaxlength" />
                            <DuTextarea value="带边框态：适合独立模块里强调输入区域。" :bordered="componentExampleState.bordered" :show-count="componentExampleState.showCount" :maxlength="componentExampleState.textareaMaxlength" />
                          </div>
                          <div v-else-if="selectedComponent === 'Radio'" class="mock-choice-stack">
                            <DuRadio :checked="componentExampleState.active" :disabled="componentExampleState.disabled" label="公开发布" @update:checked="setComponentExampleValue('active', $event)" />
                          </div>
                          <div v-else-if="selectedComponent === 'Checkbox'" class="mock-choice-stack">
                            <DuCheckbox :checked="componentExampleState.active" :disabled="componentExampleState.disabled" label="同步到首页" @update:checked="setComponentExampleValue('active', $event)" />
                          </div>
                          <div v-else-if="selectedComponent === 'Switch'" class="mock-switch-row">
                            <span>上线后自动推送</span>
                            <DuSwitch :key="`switch-example-${componentExampleState.active}-${componentExampleState.disabled}`" :on="componentExampleState.active" :disabled="componentExampleState.disabled" @update:on="setComponentExampleValue('active', $event)" />
                          </div>
                          <DuInputNumber v-else-if="selectedComponent === 'Stepper'" :value="componentExampleState.stepperValue" :min="0" :max="99" :disabled="componentExampleState.disabled" @update:value="setComponentExampleValue('stepperValue', $event)" />
                          <DuUpload
                            v-else-if="selectedComponent === 'Upload'"
                            :value="componentExampleState.showMedia ? uploadExampleFiles : []"
                            upload-text="上传封面"
                            :badge="componentExampleState.showLabel ? '封面' : ''"
                            :max-count="3"
                            :disabled="componentExampleState.disabled"
                          />
                          <div v-else-if="selectedComponent === 'Tips'" class="mock-tips-card">
                            <strong v-if="componentExampleState.showLabel">字段辅助提示</strong>
                            <p v-if="componentExampleState.showHelper">用于解释输入规则、风险或下一步动作，不替代错误反馈。</p>
                          </div>
                          <DuForm v-else-if="selectedComponent === 'Group'" class="mock-form-group" layout="vertical" label-size="72px" :class="{ 'mock-form-group--plain': !componentExampleState.bordered }">
                            <DuFormItem :label="componentExampleState.showLabel ? '标题' : ''"><DuInput value="同一组相关字段" bordered /></DuFormItem>
                            <DuFormItem :label="componentExampleState.showLabel ? '开关' : ''"><DuSwitch :on="true" /></DuFormItem>
                          </DuForm>
                          <div v-else-if="selectedComponent === 'DateTimePicker'" class="component-example-stack">
                            <DuButton text="选择日期时间" type="primary" size="normal" @click="openComponentExamplePopup('datetime-picker')" />
                            <small v-if="componentExampleState.showHelper" class="component-example-helper">点按钮弹出 DuCalendar;showTimePicker 由控制面板勾选控制;确认后会回填到下方"当前值"。</small>
                            <strong class="component-example-value">当前值:{{ componentExampleState.calendarSelectedDate || "未设置" }}{{ componentExampleState.calendarShowTimePicker ? " " + (componentExampleState.calendarSelectedTime || "00:00") : "" }}</strong>
                          </div>
                          <DuRate
                            v-else-if="selectedComponent === 'Rate'"
                            :value="componentExampleState.rateValue"
                            :icon="iconRateFilled"
                            size="medium"
                            color="primary"
                            :disabled="componentExampleState.disabled"
                            @update:value="setComponentExampleValue('rateValue', $event)"
                          />
                          <DuCascader
                            v-else-if="selectedComponent === 'Cascader'"
                            :title="componentExampleState.showLabel ? '投放范围' : '请选择'"
                            :options="cascaderExampleOptions"
                            :value="['east', 'shanghai', 'pudong']"
                            show-search
                          >
                            <template #default="{ open }">
                              <button v-if="componentExampleState.showAction" class="mock-picker-trigger" type="button" @click="open">
                                <span>{{ componentExampleState.showLabel ? '投放范围' : '请选择' }}</span>
                                <strong>华东 / 上海 / 浦东</strong>
                              </button>
                            </template>
                          </DuCascader>
                          <DuSelect v-else-if="selectedComponent === 'Select'" :title="componentExampleState.showHelper ? '发布类型' : '请选择'" :options="brandPublishOptions" value="notice">
                            <template #default="{ open }">
                              <button class="mock-picker-trigger" type="button" @click="open">
                                <span>{{ componentExampleState.showLabel ? '发布类型' : '请选择' }}</span>
                                <strong>公告</strong>
                              </button>
                            </template>
                          </DuSelect>
                        </div>
                      </div>

                      <div v-else-if="selectedComponentCategoryId === 'feedback'" class="component-doc-section component-preview-section">
                        <strong>示例</strong>
                        <div class="feedback-component-preview" :class="`feedback-component-preview--${kebabName(selectedComponent)}`">
                          <div v-if="selectedComponent === 'NoticeBar'" class="component-example-stack">
                            <DuNoticeBar
                              :type="componentExampleState.noticeType"
                              :color="componentExampleState.noticeColor"
                              text="重要配置即将生效，请检查发布范围。"
                              :link-text="componentExampleState.showAction ? '知道了' : ''"
                              :closeable="componentExampleState.showClose"
                            />
                          </div>
                          <div v-else-if="selectedComponent === 'Snackbar'" class="component-example-stack">
                            <DuSnackbar
                              :show="true"
                              :show-close="componentExampleState.showClose"
                              :left-icon="componentExampleState.showIcon ? 'success' : ''"
                              :duration="0"
                              :show-action-btn="componentExampleState.showAction"
                              :button-props="{ text: '查看', color: componentExampleState.snackbarButtonColor, type: 'primary', size: 'mini', arrowRight: false }"
                            >
                              发布成功
                            </DuSnackbar>
                          </div>
                          <div v-else-if="selectedComponent === 'Toast'" class="mock-toast-bubble">{{ componentExampleState.showIcon ? '✓ ' : '' }}{{ componentExampleState.active ? '发布成功' : '待触发' }}</div>
                          <div v-else-if="selectedComponent === 'Dialog'" class="mock-dialog-card">
                            <strong>确认提交？</strong>
                            <p v-if="componentExampleState.showHelper">这类反馈会打断用户，需要明确确认/取消。</p>
                            <div v-if="componentExampleState.showAction"><button type="button">取消</button><button type="button">确认</button></div>
                          </div>
                          <div v-else-if="selectedComponent === 'Popup'" class="mock-popup-phone">
                            <div class="mock-popup-page">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                            <div class="mock-popup-mask"></div>
                            <div class="mock-popup-sheet">
                              <i aria-hidden="true"></i>
                              <strong>筛选条件</strong>
                              <p>Popup 在屏幕内弹出，底部弹层需要避让 Home Indicator。</p>
                              <div class="mock-popup-options">
                                <button type="button">30%</button>
                                <button type="button" class="active">60%</button>
                                <button type="button">88%</button>
                              </div>
                              <DuButton v-if="componentExampleState.showAction" size="small" type="primary">确认</DuButton>
                            </div>
                            <b class="mock-popup-home-indicator" aria-hidden="true"></b>
                          </div>
                          <div v-else-if="selectedComponent === 'ShareSheet'" class="mock-share-sheet">
                            <button v-if="componentExampleState.showAction" type="button">{{ componentExampleState.showIcon ? '↗ ' : '' }}微信</button>
                            <button v-if="componentExampleState.showAction" type="button">{{ componentExampleState.showIcon ? '↗ ' : '' }}朋友圈</button>
                            <button v-if="componentExampleState.showAction" type="button">{{ componentExampleState.showIcon ? '↗ ' : '' }}复制链接</button>
                          </div>
                          <div v-else-if="selectedComponent === 'ResultPage'" class="mock-result-page compact-result">
                            <i></i><strong>{{ componentExampleState.active ? '提交成功' : '提交失败' }}</strong><p v-if="componentExampleState.showAction">结果页用于承接流程完成后的下一步。</p>
                          </div>
                          <div v-else-if="selectedComponent === 'Spin'" class="mock-spin-inline">
                            <i v-if="componentExampleState.active"></i><span v-if="componentExampleState.showLabel">加载中</span>
                          </div>
                          <DuSkeleton v-else-if="selectedComponent === 'Skeleton'" :loading="componentExampleState.active">
                            <template #template>
                              <div class="skeleton-demo">
                                <DuSkeletonRectangle width="100%" :aspect-ratio="4" />
                                <DuSkeletonParagraph row-width="100%" />
                                <DuSkeletonAvatar />
                              </div>
                            </template>
                          </DuSkeleton>
                        </div>
                      </div>

                      <div class="component-doc-section">
                        <strong>可编辑属性</strong>
                        <div v-if="selectedComponent === 'NavigationBar'" class="component-editable-controls">
                          <div class="component-editable-group">
                            <label>
                              <span>left 区域</span>
                              <DuSwitch :on="navigationAreaLeft" @update:on="navigationAreaLeft = $event" />
                            </label>
                            <div v-if="navigationAreaLeft" class="component-editable-children">
                              <label>
                                <span>back prop：返回按钮</span>
                                <DuSwitch :on="navExampleShowBack" @update:on="navExampleShowBack = $event" />
                              </label>
                              <label>
                                <span>left slot：首页按钮</span>
                                <DuSwitch :on="navigationSlotLeft" @update:on="navigationSlotLeft = $event" />
                              </label>
                              <label>
                                <span>scoped-left：opacity 内容</span>
                                <DuSwitch :on="navigationSlotScopedLeft" @update:on="navigationSlotScopedLeft = $event" />
                              </label>
                            </div>
                          </div>
                          <div class="component-editable-group">
                            <label>
                              <span>default 区域</span>
                              <DuSwitch :on="navigationAreaDefault" @update:on="navigationAreaDefault = $event" />
                            </label>
                            <div v-if="navigationAreaDefault" class="component-editable-children">
                              <label>
                                <span>default slot：标题</span>
                                <DuSwitch :on="navExampleShowTitle" @update:on="navExampleShowTitle = $event" />
                              </label>
                              <label>
                                <span>default slot：Search</span>
                                <DuSwitch :on="navExampleShowSearch" @update:on="navExampleShowSearch = $event" />
                              </label>
                              <label>
                                <span>scoped-default：opacity 内容</span>
                                <DuSwitch :on="navigationSlotScopedDefault" @update:on="navigationSlotScopedDefault = $event" />
                              </label>
                            </div>
                          </div>
                          <div class="component-editable-group">
                            <label>
                              <span>right 区域</span>
                              <DuSwitch :on="navigationAreaRight" @update:on="navigationAreaRight = $event" />
                            </label>
                            <div v-if="navigationAreaRight" class="component-editable-children">
                              <label>
                                <span>right slot：刷新按钮</span>
                                <DuSwitch :on="navExampleShowRefresh" @update:on="navExampleShowRefresh = $event" />
                              </label>
                              <label>
                                <span>scoped-right：opacity 内容</span>
                                <DuSwitch :on="navigationSlotScopedRight" @update:on="navigationSlotScopedRight = $event" />
                              </label>
                              <label>
                                <span>share prop：分享入口</span>
                                <DuSwitch :on="navExampleShowRight" @update:on="navExampleShowRight = $event" />
                              </label>
                            </div>
                          </div>
                          <div class="component-editable-group">
                            <label>
                              <span>
                                <b>color prop：背景色</b>
                                <em>string；默认 default，按 DangoUI 色板名切换。</em>
                              </span>
                              <div class="component-editable-dropdown" @click.stop>
                                <button class="component-editable-select-button" type="button" @click="toggleEditableSelect('navigation-color')">
                                  {{ editableOptionLabel(navigationColorOptions, navExampleColor) }}
                                </button>
                                <div v-if="openEditableSelectKey === 'navigation-color'" class="component-editable-menu">
                                  <button
                                    v-for="option in navigationColorOptions"
                                    :key="option.value"
                                    type="button"
                                    :class="{ active: option.value === navExampleColor }"
                                    @click="setNavigationExampleColor(option.value)"
                                  >
                                    {{ option.label }}
                                  </button>
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>
                        <div v-else-if="componentEditableGroups.length" class="component-editable-controls">
                          <div v-for="group in componentEditableGroups" :key="group.title" class="component-editable-group">
                            <strong class="component-editable-group-title">{{ group.title }}</strong>
                            <div class="component-editable-children">
                              <label v-for="item in group.items" :key="item.key">
                                <span>
                                  <b>{{ item.label }}</b>
                                  <em v-if="item.hint">{{ item.hint }}</em>
                                </span>
                                <DuSwitch
                                  v-if="item.control === 'switch'"
                                  :on="componentExampleState[item.key]"
                                  @update:on="componentExampleState[item.key] = $event"
                                />
                                <div
                                  v-else-if="item.control === 'select'"
                                  class="component-editable-dropdown"
                                  @click.stop
                                >
                                  <button class="component-editable-select-button" type="button" @click="toggleEditableSelect(`component-${item.key}`)">
                                    {{ editableOptionLabel(item.options, componentExampleState[item.key]) }}
                                  </button>
                                  <div v-if="openEditableSelectKey === `component-${item.key}`" class="component-editable-menu">
                                    <button
                                      v-for="option in item.options"
                                      :key="option.value"
                                      type="button"
                                      :class="{ active: option.value === componentExampleState[item.key] }"
                                      @click="setComponentExampleValue(item.key, option.value)"
                                    >
                                      {{ option.label }}
                                    </button>
                                  </div>
                                </div>
                                <input
                                  v-else-if="item.control === 'number'"
                                  :value="componentExampleState[item.key]"
                                  class="component-editable-input"
                                  type="number"
                                  :min="item.min"
                                  :max="item.max"
                                  :step="item.step || 1"
                                  @input="setComponentExampleValue(item.key, Number($event.target.value))"
                                >
                              </label>
                            </div>
                          </div>
                        </div>
                        <div v-else class="component-editable-map">
                          <span v-for="field in editableFields" :key="field">
                            <b>{{ field }}</b>
                            <em>{{ editableFieldHint(field) }}</em>
                          </span>
                        </div>
                      </div>

                      <details class="component-doc-section component-code-details">
                        <summary>代码 / Schema</summary>
                        <p v-if="!selectedTokens.length">当前组件没有在 DangoUI catalog 暴露专属 token；通常通过语义色、局部 CSS 或业务适配控制。</p>
                        <div v-else class="token-grid component-token-grid">
                          <button
                            v-for="token in visibleTokens"
                            :key="`component-page-${token.name}`"
                            class="token"
                            :class="{ active: selectedTokenName === token.name }"
                            type="button"
                            @click="selectToken(token.name)"
                          >
                            <i class="swatch" :style="{ background: token.value }"></i>
                            <span><strong>{{ token.name }}</strong><span>{{ token.usage }}</span></span>
                            <span>{{ token.value }}</span>
                          </button>
                        </div>
                        <button v-if="selectedTokens.length > tokenPreviewLimit" class="collapse-button component-collapse-button" type="button" @click="tokensExpanded = !tokensExpanded">
                          {{ tokensExpanded ? "收起 tokens" : `展开全部 ${selectedTokens.length} 个 tokens` }}
                        </button>
                        <pre class="component-schema-preview">{{ schemaPreview }}</pre>
                      </details>
                    </section>
                  </template>

                  <template v-else-if="isSourceSchemaTemplate">
                    <section
                      class="source-schema-demo"
                      :class="[
                        `source-schema-demo--${runtimePreviewPageKind}`,
                        `source-schema-demo--${selectedStyleId}`,
                        { 'source-schema-demo--dango': selectedStyleId === 'dango' },
                      ]"
                      aria-label="source-derived brand preview"
                      :data-page-id="selectedTemplate.id"
                    >
                      <component
                        v-for="(section, sectionIndex) in runtimeSchemaSections"
                        :is="sectionRendererRegistry[section.type] || UnsupportedSchemaSection"
                        :key="schemaSectionKey(section, sectionIndex)"
                        :section="section"
                        :section-index="sectionIndex"
                      />
                    </section>
                  </template>

                  <template v-else-if="isRuntimePreviewTemplate">
                    <section class="runtime-brand-preview" :class="`runtime-brand-preview--${runtimePreviewPageKind}`" aria-label="runtime brand preview">
                      <div
                        v-if="runtimePreviewPageKind === 'home' || runtimePreviewPageKind === 'campaign'"
                        class="click-target runtime-brand-hero"
                        :class="{ selected: selectedInstanceId === pageNodeId('HeroHeader') }"
                        :data-node-id="pageNodeId('HeroHeader')"
                        @click="selectInstance(pageNodeId('HeroHeader'), $event)"
                      >
                        <span class="tag">HeroHeader · Image</span>
                        <picture v-if="runtimePreviewAssets.heroBgSp || runtimePreviewAssets.heroBgPc" class="runtime-brand-hero__picture">
                          <source v-if="runtimePreviewAssets.heroBgPc" media="(min-width: 520px)" :srcset="runtimePreviewAssets.heroBgPc" />
                          <img :src="runtimePreviewAssets.heroBgSp || runtimePreviewAssets.heroBgPc" :alt="`${selectedStyle.label} hero`" />
                        </picture>
                        <div class="runtime-brand-hero__copy">
                          <img
                            v-if="runtimePreviewAssets.loading"
                            class="runtime-brand-hero__sprite"
                            :src="runtimePreviewAssets.loading"
                            :alt="`${selectedStyle.label} loading accent`"
                          />
                          <img
                            v-if="runtimePreviewAssets.heroLogo"
                            class="runtime-brand-hero__logo"
                            :src="runtimePreviewAssets.heroLogo"
                            :alt="`${selectedStyle.label} logo`"
                          />
                          <strong>{{ selectedStyle.hero }}</strong>
                          <p>{{ selectedStyle.notice }}</p>
                        </div>
                      </div>

                      <div
                        v-if="runtimePreviewPageKind !== 'publish'"
                        class="click-target runtime-brand-filter"
                        :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }"
                        :data-node-id="pageNodeId('Tabs')"
                        @click="selectInstance(pageNodeId('Tabs'), $event)"
                      >
                        <span class="tag">Tabs · Tag</span>
                        <img
                          v-if="runtimePreviewAssets.themeBadge"
                          class="runtime-brand-filter__badge"
                          :src="runtimePreviewAssets.themeBadge"
                          :alt="selectedStyle.sectionTitle"
                        />
                        <img
                          v-if="runtimePreviewAssets.tabPikachu"
                          class="runtime-brand-filter__mascot"
                          :src="runtimePreviewAssets.tabPikachu"
                          :alt="`${selectedStyle.label} tab accent`"
                        />
                        <div class="runtime-brand-filter__chips">
                          <button
                            v-for="item in runtimePreviewPalette"
                            :key="item.label"
                            type="button"
                            :style="{ '--runtime-category-color': item.color }"
                          >
                            {{ item.label }}
                          </button>
                        </div>
                      </div>

                      <div
                        v-if="runtimePreviewPageKind !== 'publish'"
                        class="click-target runtime-brand-card-grid"
                        :class="{ selected: selectedInstanceId === pageNodeId('Card') }"
                        :data-node-id="pageNodeId('Card')"
                        @click="selectInstance(pageNodeId('Card'), $event)"
                      >
                        <span class="tag">Card · Image</span>
                        <article
                          v-for="card in runtimePreviewCards"
                          :key="card.title"
                          :style="{ '--runtime-category-color': card.color || 'var(--du-primary-color)' }"
                        >
                          <div class="runtime-brand-card__media">
                            <img v-if="card.image" :src="card.image" :alt="card.title" />
                          </div>
                          <span>{{ card.tag }}</span>
                          <strong>{{ card.title }}</strong>
                          <p>{{ card.copy }}</p>
                        </article>
                      </div>

                      <div v-if="runtimePreviewPageKind === 'publish'" class="click-target runtime-brand-publish" :data-node-id="pageNodeId('Input')" @click="selectInstance(pageNodeId('Input'), $event)">
                        <span class="tag">Input · Textarea · Select · Switch · BottomBar</span>
                        <strong>发布卡牌收藏</strong>
                        <label>标题<input value="稀有卡牌收藏记录" /></label>
                        <label>分类<select><option>卡牌图鉴</option><option>收藏资讯</option></select></label>
                        <label>说明<textarea>补充卡牌状态、来源与交换说明。</textarea></label>
                        <label class="runtime-brand-publish__switch"><input type="checkbox" checked /> 允许交换意向</label>
                        <button type="button">发布收藏</button>
                      </div>

                      <div
                        v-if="runtimePreviewAssets.logoBanner"
                        class="click-target runtime-brand-banner"
                        :class="{ selected: selectedInstanceId === pageNodeId('Image') }"
                        :data-node-id="pageNodeId('Image')"
                        @click="selectInstance(pageNodeId('Image'), $event)"
                      >
                        <span class="tag">Image · Banner</span>
                        <img :src="runtimePreviewAssets.logoBanner" :alt="`${selectedStyle.label} banner`" />
                        <p>资产位用 Image/currentSrc 承接，保持原图比例，不裁成普通背景。</p>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="selectedTemplateId === 're1999-home'">
                    <div class="click-target re1999-hero" :class="{ selected: selectedInstanceId === pageNodeId('HeroHeader') }" :data-node-id="pageNodeId('HeroHeader')" @click="selectInstance(pageNodeId('HeroHeader'), $event)">
                      <span class="tag">HeroHeader · 图片层 Image</span>
                      <div class="re1999-hero-copy">
                        <p>THE STORM IS COMING</p>
                        <img class="re1999-hero-title" src="/assets/re1999-logo.png" alt="重返未来：1999" />
                        <span>{{ selectedStyle.notice }}</span>
                      </div>
                    </div>
                    <div class="click-target re1999-home-distribution" :class="{ selected: selectedInstanceId === pageNodeId('Button') }" :data-node-id="pageNodeId('Button')" @click="selectInstance(pageNodeId('Button'), $event)">
                      <span class="tag">Button</span>
                      <button type="button" :class="{ active: re1999HomePanel === 'news' }" @click.stop="openRe1999HomePanel('news')">
                        <strong>NEWS</strong>
                        <span>暴雨情报</span>
                      </button>
                      <button type="button" :class="{ active: re1999HomePanel === 'archive' }" @click.stop="openRe1999HomePanel('archive')">
                        <strong>ARCHIVE</strong>
                        <span>神秘学家档案</span>
                      </button>
                      <button type="button" :class="{ active: re1999HomePanel === 'media' }" @click.stop="openRe1999HomePanel('media')">
                        <strong>MEDIA</strong>
                        <span>影像资料</span>
                      </button>
                    </div>
                    <div class="click-target re1999-home-gallery" :class="[{ selected: selectedInstanceId === pageNodeId('Image') }, `re1999-home-gallery--${re1999HomePanel}`]" :data-node-id="pageNodeId('Image')" data-style-hover-label="风格 - Divider - 首页图片面板边界，可用于分发入口 / 专题卡片" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <i></i>
                      <div>
                        <p>{{ re1999HomePanels[re1999HomePanel].galleryKicker }}</p>
                        <strong>{{ re1999HomePanels[re1999HomePanel].galleryTitle }}</strong>
                        <span>{{ re1999HomePanels[re1999HomePanel].galleryBody }}</span>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 're1999-news'">
                    <div class="click-target re1999-news-feature" :class="{ selected: selectedInstanceId === pageNodeId('Swiper') }" :data-node-id="pageNodeId('Swiper')" data-style-hover-label="风格 - Divider - 资讯主图 Frame，可用于公告大图 / 运营专题头图" @click="selectInstance(pageNodeId('Swiper'), $event)">
                      <span class="tag">Swiper</span>
                      <div class="re1999-news-poster" aria-hidden="true">
                        <img src="/assets/brand-assets/re1999/img/News.png" alt="NEWS" />
                        <strong>暴雨情报记录</strong>
                      </div>
                    </div>
                    <div class="click-target re1999-news-tabs" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <DuTabs :value="re1999NewsTab" type="tag" size="normal" @update:value="re1999NewsTab = $event">
                        <DuTab name="news">最新</DuTab>
                        <DuTab name="notice">公告</DuTab>
                        <DuTab name="event">活动</DuTab>
                        <DuTab name="media">新闻</DuTab>
                      </DuTabs>
                    </div>
                    <div class="click-target re1999-news-list" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" data-style-hover-label="风格 - Divider - 档案列表分割线，可用于资讯列表 / 时间线列表" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <article>
                        <time>06.11</time>
                        <div>
                          <strong>{{ re1999NewsCopy[re1999NewsTab].items[0].title }}</strong>
                          <p>{{ re1999NewsCopy[re1999NewsTab].items[0].body }}</p>
                        </div>
                      </article>
                      <article>
                        <time>06.04</time>
                        <div>
                          <strong>{{ re1999NewsCopy[re1999NewsTab].items[1].title }}</strong>
                          <p>{{ re1999NewsCopy[re1999NewsTab].items[1].body }}</p>
                        </div>
                      </article>
                      <article>
                        <time>05.30</time>
                        <div>
                          <strong>{{ re1999NewsCopy[re1999NewsTab].items[2].title }}</strong>
                          <p>{{ re1999NewsCopy[re1999NewsTab].items[2].body }}</p>
                        </div>
                      </article>
                    </div>
                    <div class="click-target re1999-news-actions" :class="{ selected: selectedInstanceId === pageNodeId('Tag') }" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                      <span class="tag">Tag</span>
                      <div class="tag-row">
                        <DuTag :color="re1999NewsTag === 'notice' ? 'primary' : 'default'" round @click="re1999NewsTag = 'notice'">公告</DuTag>
                        <DuTag :color="re1999NewsTag === 'role' ? 'primary' : 'default'" round @click="re1999NewsTag = 'role'">角色</DuTag>
                        <DuTag :color="re1999NewsTag === 'event' ? 'primary' : 'default'" round @click="re1999NewsTag = 'event'">活动</DuTag>
                      </div>
                      <p class="demo-interaction-feedback">{{ re1999NewsTagCopy[re1999NewsTag] }}</p>
                      <DuButton text="查看更多 NEWS" type="outline" :data-node-id="pageNodeId('Button')" @click.stop="selectInstance(pageNodeId('Button'), $event)" />
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 're1999-media'">
                    <div class="click-target re1999-media-hero" :class="{ selected: selectedInstanceId === pageNodeId('Swiper') }" :data-node-id="pageNodeId('Swiper')" data-style-hover-label="风格 - Divider - 媒体容器角线 Frame，可用于 Swiper / PV / 大图展示区" @click="selectInstance(pageNodeId('Swiper'), $event)">
                      <span class="tag">Swiper</span>
                      <div class="re1999-media-title">
                        <p>MEDIA ROOM</p>
                        <strong>暴雨影像资料室</strong>
                        <span>集中展示 PV、壁纸、访谈与图库，让风格化图片资产成为页面主体。</span>
                      </div>
                    </div>
                    <div class="click-target re1999-media-tabs" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <DuTabs :value="re1999MediaTab" type="tag" size="normal" @update:value="re1999MediaTab = $event">
                        <DuTab name="pv">PV</DuTab>
                        <DuTab name="gallery">图库</DuTab>
                        <DuTab name="interview">访谈</DuTab>
                      </DuTabs>
                    </div>
                    <div class="click-target re1999-media-grid" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" data-style-hover-label="风格 - Divider - 图库角线 Frame，可用于图片墙 / 卡片网格容器" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <article class="featured">
                        <i></i>
                        <div>
                          <p>{{ re1999MediaCopy[re1999MediaTab].kicker }}</p>
                          <strong>{{ re1999MediaCopy[re1999MediaTab].title }}</strong>
                        </div>
                      </article>
                      <article>
                        <i></i>
                        <strong>{{ re1999MediaCopy[re1999MediaTab].items[0] }}</strong>
                      </article>
                      <article>
                        <i></i>
                        <strong>{{ re1999MediaCopy[re1999MediaTab].items[1] }}</strong>
                      </article>
                    </div>
                    <div class="click-target re1999-media-notes" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" data-style-hover-label="风格 - Divider - 档案说明面板边界，可用于 Card / Group / 说明容器" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <div>
                        <p>ASSET NOTES</p>
                        <strong>{{ re1999MediaCopy[re1999MediaTab].noteTitle }}</strong>
                        <span>{{ re1999MediaCopy[re1999MediaTab].noteBody }}</span>
                      </div>
                      <div class="tag-row">
                        <DuTag color="primary" round>{{ re1999MediaCopy[re1999MediaTab].tags[0] }}</DuTag>
                        <DuTag color="default" round>{{ re1999MediaCopy[re1999MediaTab].tags[1] }}</DuTag>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 're1999-archive'">
                    <div class="click-target re1999-character-panel" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" data-style-hover-label="风格 - Divider - 角色档案外框，可用于人物档案 / 商品详情主面板" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image · 角色档案面板</span>
                      <div class="re1999-character-copy">
                        <p>ARCANIST FILE</p>
                        <strong>维尔汀</strong>
                        <span>时代的旁观者与记录者，档案页承接角色身份、阵营和叙事摘要。</span>
                        <div class="re1999-character-meta" aria-label="角色档案信息">
                          <small>No. 1999</small>
                          <small>6★ Arcanist</small>
                          <small>Timekeeper</small>
                        </div>
                        <div class="re1999-case-stamp" aria-label="暴雨档案时间戳">
                          <b>STORM ARCHIVE</b>
                          <span>1999.12.31 / 23:59</span>
                        </div>
                      </div>
                    </div>
                    <div class="click-target re1999-file-grid" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" data-style-hover-label="风格 - Divider - 档案卡片边界，可用于内容卡 / 商品卡 / 信息组" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <article>
                        <b>时代</b>
                        <small>20 世纪末 / 伦敦</small>
                      </article>
                      <article>
                        <b>身份</b>
                        <small>Timekeeper</small>
                      </article>
                      <article>
                        <b>介质</b>
                        <small>档案 / 影像 / 访谈</small>
                      </article>
                      <article>
                        <b>状态</b>
                        <small>暴雨观测中</small>
                      </article>
                    </div>
                    <div class="click-target re1999-archive-tabs" :class="{ selected: selectedInstanceId === pageNodeId('Badge') }" :data-node-id="pageNodeId('Badge')" @click="selectInstance(pageNodeId('Badge'), $event)">
                      <span class="tag">Badge</span>
                      <DuBadge value="6★" color="primary" always-show>
                        <span class="badge-anchor">档案等级</span>
                      </DuBadge>
                      <DuTabs :value="re1999ArchiveTab" type="tag" size="normal" :data-node-id="pageNodeId('Tabs')" @update:value="re1999ArchiveTab = $event" @click.stop="selectInstance(pageNodeId('Tabs'), $event)">
                        <DuTab name="profile">档案</DuTab>
                        <DuTab name="story">故事</DuTab>
                      </DuTabs>
                      <p class="demo-interaction-feedback">{{ re1999ArchiveTab === 'profile' ? '展示角色身份、星级与档案摘要。' : '切换到故事线索、访谈片段与暴雨记录。' }}</p>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 're1999-publish'">
                    <div class="form-demo re1999-publish-form">
                      <div class="publish-template-tip">
                        <strong>TIPS</strong>
                        <span>发布内容会进入首页分发侧，优先补全标题、正文和封面。</span>
                      </div>
                      <section class="group publish-editor-card">
                        <div class="click-target publish-cover-upload" :class="{ selected: selectedInstanceId === pageNodeId('Upload') }" :data-node-id="pageNodeId('Upload')" @click="selectInstance(pageNodeId('Upload'), $event)">
                          <span class="tag">Upload</span>
                          <DuUpload :value="[]" upload-text="添加封面" />
                        </div>
                        <div class="click-target publish-title-field" :class="{ selected: selectedInstanceId === pageNodeId('Input') }" :data-node-id="pageNodeId('Input')" @click="selectInstance(pageNodeId('Input'), $event)">
                          <span class="tag">Input</span>
                          <DuInput value="暴雨情报更新" placeholder="填写清晰的标题" allow-clear />
                        </div>
                        <div class="click-target publish-body-field" :class="{ selected: selectedInstanceId === pageNodeId('Textarea') }" :data-node-id="pageNodeId('Textarea')" @click="selectInstance(pageNodeId('Textarea'), $event)">
                          <span class="tag">Textarea</span>
                          <DuTextarea value="填写公告正文、活动说明或档案摘要。发布侧只换 token，不强行套展示侧纹理。" show-count :maxlength="120" />
                        </div>
                        <div class="publish-editor-meta">
                          <div class="click-target control-grid control-grid--inline-short" :class="{ selected: selectedInstanceId === pageNodeId('Radio') }" :data-node-id="pageNodeId('Radio')" @click="selectInstance(pageNodeId('Radio'), $event)">
                            <span class="tag">Radio</span>
                            <DuRadio checked label="公开" /><DuRadio label="草稿" />
                          </div>
                          <DuTag color="primary" round>AI 智能排版</DuTag>
                        </div>
                      </section>
                      <section class="group publish-form-card">
                        <div class="click-target publish-list-row" :class="{ selected: selectedInstanceId === pageNodeId('Select') }" :data-node-id="pageNodeId('Select')" @pointerdown.capture="syncMockupPopupBounds('Select')" @click="selectInstance(pageNodeId('Select'), $event)">
                          <span class="tag">Select</span>
                          <span>*情报类型</span>
                          <DuSelect title="请选择类型" :options="re1999PublishOptions" :value="publishSelectValue" :popup-style="mockupSelectPopupStyle" @update:value="publishSelectValue = $event" />
                        </div>
                        <div class="click-target publish-list-row re1999-publish-switch" :class="{ selected: selectedInstanceId === pageNodeId('Switch') }" :data-node-id="pageNodeId('Switch')" @click="selectInstance(pageNodeId('Switch'), $event)">
                          <span class="tag">Switch</span>
                          <span>同步到官网首页分发侧</span>
                          <DuSwitch :on="publishSyncOn" @update:on="publishSyncOn = $event" @click.stop />
                        </div>
                        <div
                          class="click-target publish-list-row"
                          :class="{ selected: selectedInstanceId === pageNodeId('DateTimePicker') }"
                          :data-node-id="pageNodeId('DateTimePicker')"
                          @pointerdown.capture="syncMockupPopupBounds('DateTimePicker')"
                          @click="selectInstance(pageNodeId('DateTimePicker'), $event); calendarDateTimeVisible = true"
                        >
                          <span class="tag">DateTimePicker · Calendar showTimePicker</span>
                          <span>定时发布</span>
                          <strong>{{ calendarDateTimeText }}</strong>
                        </div>
                        <DuCalendar
                          v-model:visible="calendarDateTimeVisible"
                          title="定时发布"
                          type="single"
                          :selected-date="calendarSelectedDate"
                          show-time-picker
                          :time-step="5"
                          @confirm="handleCalendarDateTimeConfirm"
                        />
                      </section>
                      <div class="click-target mock-bottom-actionbar mock-bottom-actionbar--publish" :class="{ selected: selectedInstanceId === pageNodeId('BottomBar') }" :data-node-id="pageNodeId('BottomBar')" @click="selectInstance(pageNodeId('BottomBar'), $event)">
                        <span class="tag">BottomBar</span>
                        <DuButton text="保存草稿" type="outline" />
                        <DuButton text="提交发布" type="primary" />
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'czn-publish' || selectedTemplateId === 'hpma-publish'">
                    <div class="form-demo brand-publish-form">
                      <div class="publish-template-tip">
                        <strong>TIPS</strong>
                        <span>{{ currentBrandPublishCopy.switchLabel }}，发布前先补齐标题、正文和封面。</span>
                      </div>
                      <section class="group publish-editor-card">
                        <div class="click-target publish-cover-upload" :class="{ selected: selectedInstanceId === pageNodeId('Upload') }" :data-node-id="pageNodeId('Upload')" @click="selectInstance(pageNodeId('Upload'), $event)">
                          <span class="tag">Upload</span>
                          <DuUpload :value="[]" upload-text="添加封面" />
                        </div>
                        <div class="click-target publish-title-field" :class="{ selected: selectedInstanceId === pageNodeId('Input') }" :data-node-id="pageNodeId('Input')" @click="selectInstance(pageNodeId('Input'), $event)">
                          <span class="tag">Input</span>
                          <DuInput :value="currentBrandPublishCopy.inputValue" placeholder="填写清晰的标题" allow-clear />
                        </div>
                        <div class="click-target publish-body-field" :class="{ selected: selectedInstanceId === pageNodeId('Textarea') }" :data-node-id="pageNodeId('Textarea')" @click="selectInstance(pageNodeId('Textarea'), $event)">
                          <span class="tag">Textarea</span>
                          <DuTextarea :value="currentBrandPublishCopy.textareaValue" show-count :maxlength="120" />
                        </div>
                        <div class="publish-editor-meta">
                          <div class="click-target control-grid control-grid--inline-short" :class="{ selected: selectedInstanceId === pageNodeId('Radio') }" :data-node-id="pageNodeId('Radio')" @click="selectInstance(pageNodeId('Radio'), $event)">
                            <span class="tag">Radio</span>
                            <DuRadio checked label="公开" /><DuRadio label="草稿" />
                          </div>
                          <DuTag color="primary" round>AI 智能排版</DuTag>
                        </div>
                      </section>
                      <section class="group publish-form-card">
                        <div class="click-target publish-list-row" :class="{ selected: selectedInstanceId === pageNodeId('Select') }" :data-node-id="pageNodeId('Select')" @pointerdown.capture="syncMockupPopupBounds('Select')" @click="selectInstance(pageNodeId('Select'), $event)">
                          <span class="tag">Select</span>
                          <span>*发布类型</span>
                          <DuSelect title="请选择类型" :options="brandPublishOptions" :value="publishSelectValue" :popup-style="mockupSelectPopupStyle" @update:value="publishSelectValue = $event" />
                        </div>
                        <div class="click-target publish-list-row brand-publish-switch" :class="{ selected: selectedInstanceId === pageNodeId('Switch') }" :data-node-id="pageNodeId('Switch')" @click="selectInstance(pageNodeId('Switch'), $event)">
                          <span class="tag">Switch</span>
                          <span>{{ currentBrandPublishCopy.switchLabel }}</span>
                          <DuSwitch :on="publishSyncOn" @update:on="publishSyncOn = $event" @click.stop />
                        </div>
                        <div
                          class="click-target publish-list-row"
                          :class="{ selected: selectedInstanceId === pageNodeId('DateTimePicker') }"
                          :data-node-id="pageNodeId('DateTimePicker')"
                          @pointerdown.capture="syncMockupPopupBounds('DateTimePicker')"
                          @click="selectInstance(pageNodeId('DateTimePicker'), $event); calendarDateTimeVisible = true"
                        >
                          <span class="tag">DateTimePicker · Calendar showTimePicker</span>
                          <span>定时发布</span>
                          <strong>{{ calendarDateTimeText }}</strong>
                        </div>
                        <DuCalendar
                          v-model:visible="calendarDateTimeVisible"
                          title="定时发布"
                          type="single"
                          :selected-date="calendarSelectedDate"
                          show-time-picker
                          :time-step="5"
                          @confirm="handleCalendarDateTimeConfirm"
                        />
                      </section>
                      <div class="click-target mock-bottom-actionbar mock-bottom-actionbar--publish" :class="{ selected: selectedInstanceId === pageNodeId('BottomBar') }" :data-node-id="pageNodeId('BottomBar')" @click="selectInstance(pageNodeId('BottomBar'), $event)">
                        <span class="tag">BottomBar</span>
                        <DuButton text="保存草稿" type="outline" />
                        <DuButton text="提交发布" type="primary" />
                      </div>
                    </div>
                  </template>

                  

                  

                  

                  

                  

                  

                  <template v-else-if="selectedTemplateId === 'hpma-home'">
                    <div class="click-target hpma-hero" :class="{ selected: selectedInstanceId === pageNodeId('HeroHeader') }" :data-node-id="pageNodeId('HeroHeader')" @click="selectInstance(pageNodeId('HeroHeader'), $event)">
                      <span class="tag">HeroHeader · 图片层 Image</span>
                      <img class="hpma-hero-slogan" src="/assets/hpma-slogan.png" alt="欢迎回到霍格沃茨" />
                      <span>{{ selectedStyle.notice }}</span>
                    </div>
                    <div class="click-target hpma-home-distribution" :class="{ selected: selectedInstanceId === pageNodeId('Button') }" :data-node-id="pageNodeId('Button')" @click="selectInstance(pageNodeId('Button'), $event)">
                      <span class="tag">Button</span>
                      <button type="button" :class="{ active: hpmaHomePanel === 'news' }" @click.stop="openHpmaHomePanel('news')">
                        <span>NEWS</span>
                        <small>资讯活动</small>
                      </button>
                      <button type="button" :class="{ active: hpmaHomePanel === 'cards' }" @click.stop="openHpmaHomePanel('cards')">
                        <span>SPELL</span>
                        <small>魔咒伙伴</small>
                      </button>
                      <button type="button" :class="{ active: hpmaHomePanel === 'media' }" @click.stop="openHpmaHomePanel('media')">
                        <span>MEDIA</span>
                        <small>视听中心</small>
                      </button>
                    </div>
                    <div class="click-target hpma-home-gallery" :class="[{ selected: selectedInstanceId === pageNodeId('Image') }, `hpma-home-gallery--${hpmaHomePanel}`]" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <i></i>
                      <div>
                        <small>{{ hpmaHomePanels[hpmaHomePanel].galleryKicker }}</small>
                        <strong>{{ hpmaHomePanels[hpmaHomePanel].galleryTitle }}</strong>
                        <p>{{ hpmaHomePanels[hpmaHomePanel].galleryBody }}</p>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'hpma-news'">
                    <div class="click-target hpma-news-feature" :class="{ selected: selectedInstanceId === pageNodeId('Swiper') }" :data-node-id="pageNodeId('Swiper')" @click="selectInstance(pageNodeId('Swiper'), $event)">
                      <span class="tag">Swiper</span>
                      <div class="hpma-news-poster" aria-hidden="true">
                        <span>SEASON</span>
                        <strong>魔法觉醒赛季更新</strong>
                      </div>
                      <p>轮播位保留暗场大图、金线框和活动标题，适合接真实运营 banner。</p>
                    </div>
                    <div class="click-target hpma-news-tabs" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <DuTabs :value="hpmaNewsTab" type="tag" size="normal" @update:value="hpmaNewsTab = $event">
                        <DuTab name="event">活动</DuTab>
                        <DuTab name="news">新闻</DuTab>
                        <DuTab name="notice">公告</DuTab>
                      </DuTabs>
                    </div>
                    <div class="click-target hpma-news-list" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <article>
                        <time>06.12</time>
                        <div>
                          <strong>{{ hpmaNewsCopy[hpmaNewsTab].items[0].title }}</strong>
                          <p>{{ hpmaNewsCopy[hpmaNewsTab].items[0].body }}</p>
                        </div>
                      </article>
                      <article>
                        <time>06.08</time>
                        <div>
                          <strong>{{ hpmaNewsCopy[hpmaNewsTab].items[1].title }}</strong>
                          <p>{{ hpmaNewsCopy[hpmaNewsTab].items[1].body }}</p>
                        </div>
                      </article>
                    </div>
                    <div class="click-target hpma-news-actions" :class="{ selected: selectedInstanceId === pageNodeId('Tag') }" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                      <span class="tag">Tag</span>
                      <div class="tag-row">
                        <DuTag :color="hpmaNewsTag === 'event' ? 'primary' : 'default'" round @click="hpmaNewsTag = 'event'">限时活动</DuTag>
                        <DuTag :color="hpmaNewsTag === 'season' ? 'primary' : 'default'" round @click="hpmaNewsTag = 'season'">赛季情报</DuTag>
                      </div>
                      <p class="demo-interaction-feedback">{{ hpmaNewsTag === 'event' ? '当前筛选限时活动，列表保留活动入口。' : '当前筛选赛季情报，列表切换到更新与卡牌说明。' }}</p>
                      <DuButton text="查看更多资讯" type="outline" />
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'hpma-cards'">
                    <div class="click-target hpma-card-media" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <i class="hpma-card-asset" aria-hidden="true"></i>
                      <div class="hpma-spell-orbit" aria-hidden="true">
                        <i></i><i></i><i></i>
                      </div>
                      <strong>魔咒图鉴</strong>
                      <p>图鉴页用卡面、轨迹光效和稀有度标签区别于首页/资讯页。</p>
                    </div>
                    <div class="click-target hpma-spell-grid" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <article>
                        <b>Expelliarmus</b>
                        <small>魔咒</small>
                      </article>
                      <article>
                        <b>Golden Snitch</b>
                        <small>召唤</small>
                      </article>
                    </div>
                    <div class="click-target hpma-rarity-row" :class="{ selected: selectedInstanceId === pageNodeId('Badge') }" :data-node-id="pageNodeId('Badge')" @click="selectInstance(pageNodeId('Badge'), $event)">
                      <span class="tag">Badge</span>
                      <DuBadge value="LEGEND" color="primary" always-show>
                        <span class="badge-anchor">稀有度</span>
                      </DuBadge>
                      <DuTabs :value="hpmaCardTab" type="tag" size="normal" :data-node-id="pageNodeId('Tabs')" @update:value="hpmaCardTab = $event" @click.stop="selectInstance(pageNodeId('Tabs'), $event)">
                        <DuTab name="spell">魔咒</DuTab>
                        <DuTab name="partner">伙伴</DuTab>
                      </DuTabs>
                      <p class="demo-interaction-feedback">{{ hpmaCardTab === 'spell' ? '当前查看魔咒卡牌。' : '当前查看伙伴卡牌。' }}</p>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'hpma-media'">
                    <div class="click-target hpma-media-hero" :class="{ selected: selectedInstanceId === pageNodeId('Swiper') }" :data-node-id="pageNodeId('Swiper')" @click="selectInstance(pageNodeId('Swiper'), $event)">
                      <span class="tag">Swiper</span>
                      <i class="hpma-media-play" aria-hidden="true"></i>
                      <p>{{ hpmaMediaCopy[hpmaMediaTab].kicker }}</p>
                      <strong>{{ hpmaMediaCopy[hpmaMediaTab].title }}</strong>
                    </div>
                    <div class="click-target hpma-media-tabs" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <DuTabs :value="hpmaMediaTab" type="tag" size="normal" @update:value="hpmaMediaTab = $event">
                        <DuTab name="video">影像</DuTab>
                        <DuTab name="wallpaper">壁纸</DuTab>
                        <DuTab name="feature">专题</DuTab>
                      </DuTabs>
                    </div>
                    <div class="click-target hpma-media-grid" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <article v-for="item in hpmaMediaCopy[hpmaMediaTab].items" :key="item">
                        <i></i>
                        <strong>{{ item }}</strong>
                      </article>
                    </div>
                    <div class="click-target hpma-media-notes" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <strong>{{ hpmaMediaCopy[hpmaMediaTab].noteTitle }}</strong>
                      <p>{{ hpmaMediaCopy[hpmaMediaTab].noteBody }}</p>
                      <div class="tag-row">
                        <DuTag v-for="tag in hpmaMediaCopy[hpmaMediaTab].tags" :key="tag" color="primary" round>{{ tag }}</DuTag>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'czn-home'">
                    <div class="click-target czn-hero" :class="{ selected: selectedInstanceId === pageNodeId('HeroHeader') }" :data-node-id="pageNodeId('HeroHeader')" @click="selectInstance(pageNodeId('HeroHeader'), $event)">
                      <span class="tag">HeroHeader · 图片层 Image</span>
                      <p>CHAOS ZERO NIGHTMARE</p>
                      <img class="czn-hero-slogan" src="/assets/czn-sm-add-slogan.png" alt="卡厄思梦境现已正式上线" />
                      <span>{{ selectedStyle.notice }}</span>
                    </div>
                    <div class="click-target czn-home-distribution" :class="{ selected: selectedInstanceId === pageNodeId('Button') }" :data-node-id="pageNodeId('Button')" @click="selectInstance(pageNodeId('Button'), $event)">
                      <span class="tag">Button</span>
                      <button type="button" :class="{ active: cznHomePanel === 'forward' }" @click.stop="openCznHomePanel('forward')">
                        <span>FORWARD</span>
                        <small>前瞻情报</small>
                      </button>
                      <button type="button" :class="{ active: cznHomePanel === 'character' }" @click.stop="openCznHomePanel('character')">
                        <span>CHARACTER</span>
                        <small>角色档案</small>
                      </button>
                      <button type="button" :class="{ active: cznHomePanel === 'media' }" @click.stop="openCznHomePanel('media')">
                        <span>VISUAL</span>
                        <small>图像资料</small>
                      </button>
                    </div>
                    <div class="click-target czn-home-gallery" :class="[{ selected: selectedInstanceId === pageNodeId('Image') }, `czn-home-gallery--${cznHomePanel}`]" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <i></i>
                      <div>
                        <small>{{ cznHomePanels[cznHomePanel].galleryKicker }}</small>
                        <strong>{{ cznHomePanels[cznHomePanel].galleryTitle }}</strong>
                        <p>{{ cznHomePanels[cznHomePanel].galleryBody }}</p>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'czn-forward'">
                    <div class="click-target czn-forward-card" :class="{ selected: selectedInstanceId === pageNodeId('Swiper') }" :data-node-id="pageNodeId('Swiper')" @click="selectInstance(pageNodeId('Swiper'), $event)">
                      <span class="tag">Swiper</span>
                      <div class="czn-swiper-frame" aria-hidden="true">
                        <div class="czn-swiper-window">
                          <div class="czn-swiper-track">
                            <div class="czn-slide is-prev">
                              <img src="/assets/czn-forward-img1.jpg" alt="" />
                            </div>
                            <div class="czn-slide is-active">
                              <img src="/assets/czn-forward-img1.jpg" alt="" />
                              <div class="czn-forward-txtbox">
                                <strong>全新角色</strong>
                                <p>全新东方气质主战员「绯」及辅战员「芮香」，抢先登场</p>
                              </div>
                            </div>
                            <div class="czn-slide is-next">
                              <img src="/assets/czn-forward-img1.jpg" alt="" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <strong>前瞻情报一览</strong>
                      <p>源站 forward_swiper 使用 forward_mask 裁切图片，底部文案盒使用 forward_txt_bg，不是普通卡片边框。</p>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Tag') }" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                      <span class="tag">Tag</span>
                      <div class="tag-row">
                        <DuTag color="primary" round>全新角色</DuTag>
                        <DuTag color="primary" round>公测内容</DuTag>
                        <DuTag color="default" round>限时活动</DuTag>
                      </div>
                    </div>
                    <div class="click-target czn-forward-info-card" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <strong>全新角色</strong>
                      <p>全新东方气质主战员「绯」及辅战员「芮香」，抢先登场</p>
                      <small>forward_txt_bg.png / source caption card</small>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Button') }" :data-node-id="pageNodeId('Button')" @click="selectInstance(pageNodeId('Button'), $event)">
                      <span class="tag">Button</span>
                      <DuButton text="查看详情 MORE" type="primary" />
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'czn-media'">
                    <div class="click-target czn-media-hero" :class="{ selected: selectedInstanceId === pageNodeId('Swiper') }" :data-node-id="pageNodeId('Swiper')" @click="selectInstance(pageNodeId('Swiper'), $event)">
                      <span class="tag">Swiper</span>
                      <p>{{ cznMediaCopy[cznMediaTab].kicker }}</p>
                      <strong>{{ cznMediaCopy[cznMediaTab].title }}</strong>
                    </div>
                    <div class="click-target czn-media-tabs" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <DuTabs :value="cznMediaTab" type="tag" size="normal" @update:value="cznMediaTab = $event">
                        <DuTab name="pv">PV</DuTab>
                        <DuTab name="screenshots">截图</DuTab>
                        <DuTab name="interview">访谈</DuTab>
                      </DuTabs>
                    </div>
                    <div class="click-target czn-media-grid" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <article v-for="item in cznMediaCopy[cznMediaTab].items" :key="item">
                        <i></i>
                        <strong>{{ item }}</strong>
                      </article>
                    </div>
                    <div class="click-target czn-media-notes" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <strong>{{ cznMediaCopy[cznMediaTab].noteTitle }}</strong>
                      <p>{{ cznMediaCopy[cznMediaTab].noteBody }}</p>
                      <div class="tag-row">
                        <DuTag v-for="tag in cznMediaCopy[cznMediaTab].tags" :key="tag" color="primary" round>{{ tag }}</DuTag>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="selectedTemplateId === 'czn-character'">
                    <div class="click-target czn-character-panel" :class="{ selected: selectedInstanceId === pageNodeId('CharacterPanel') }" :data-node-id="pageNodeId('CharacterPanel')" @click="selectInstance(pageNodeId('CharacterPanel'), $event)">
                      <span class="tag">CharacterPanel</span>
                      <div class="czn-character-visual" aria-hidden="true">
                        <video src="/assets/czn-renoa-creazy-loop.mp4" poster="/assets/czn-renoa-creazy-rc.jpg" autoplay muted loop playsinline></video>
                      </div>
                      <div class="czn-character-copy">
                        <p>RENOA</p>
                        <strong>蕾诺娅</strong>
                        <span>黑玫瑰诗人。不会凋零的黑玫瑰，即将绽放。</span>
                        <div class="czn-character-stats" aria-label="角色详情">
                          <small>MAIN AGENT</small>
                          <small>BLACK ROSE</small>
                          <small>ASSAULT</small>
                        </div>
                      </div>
                      <div class="button-row">
                        <DuButton text="查看档案" type="primary" />
                      </div>
                    </div>
                    <div class="click-target display-summary czn-avatar-row" :class="{ selected: selectedInstanceId === pageNodeId('Avatar') }" :data-node-id="pageNodeId('Avatar')" @click="selectInstance(pageNodeId('Avatar'), $event)">
                      <span class="tag">Avatar</span>
                      <span class="czn-character-avatar" aria-hidden="true"></span>
                      <div>
                        <strong>角色档案</strong>
                        <p>头像、角色名和状态适合后续接入真实角色数据。</p>
                      </div>
                    </div>
                    <div class="click-target czn-character-voice-card" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <small>CHARACTER VOICE</small>
                      <strong>角色语音与技能卡</strong>
                      <p>角色页内容块直接承接黑紫角色舞台，不再在 click-target 里套一层默认 DuCard。</p>
                      <i class="czn-character-skill" aria-hidden="true"></i>
                      <div class="tag-row">
                        <DuTag color="primary" round>技能卡</DuTag>
                        <DuTag color="default" round>支援</DuTag>
                      </div>
                    </div>
                    <div class="click-target czn-character-tags" :class="{ selected: selectedInstanceId === pageNodeId('Tag') }" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                      <span class="tag">Tag</span>
                      <div class="tag-row">
                        <DuTag color="primary" round>危险人物</DuTag>
                        <DuTag color="default" round>黑玫瑰</DuTag>
                      </div>
                    </div>
                  </template>

                  

                  

                  

                  <template v-else-if="selectedTemplate?.side === 'distribution'">
                    <div class="click-target mock-hero-header" :class="{ selected: selectedInstanceId === pageNodeId('HeroHeader') }" :data-node-id="pageNodeId('HeroHeader')" @click="selectInstance(pageNodeId('HeroHeader'), $event)">
                      <span class="tag">HeroHeader · 图片层 Image</span>
                      <small>CAMPAIGN LAUNCH</small>
                      <strong>夏日市集限时开启</strong>
                      <p>一屏讲清主题、利益点和下一步动作，适合活动首页、品牌专题和内容集合页。</p>
                    </div>
                    <div class="click-target mock-grid" :class="{ selected: selectedInstanceId === pageNodeId('Grid') }" :data-node-id="pageNodeId('Grid')" @click="selectInstance(pageNodeId('Grid'), $event)">
                      <span class="tag">Grid</span>
                      <i v-for="item in ['看资料', '逛社区', '买二手', '抽一手']" :key="`dist-grid-${item}`">{{ item }}</i>
                    </div>
                    <div class="click-target mock-list" :class="{ selected: selectedInstanceId === pageNodeId('List') }" :data-node-id="pageNodeId('List')" @click="selectInstance(pageNodeId('List'), $event)">
                      <span class="tag">List</span>
                      <p v-for="item in distributionListRows" :key="`dist-list-${item.title}`">
                        <i aria-hidden="true"></i>
                        <span><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></span>
                        <em>{{ item.meta }}</em>
                        <b aria-hidden="true">›</b>
                      </p>
                    </div>
                    <div class="click-target mock-spu-rail" :class="{ selected: selectedInstanceId === pageNodeId('Group') }" :data-node-id="pageNodeId('Group')" @click="selectInstance(pageNodeId('Group'), $event)">
                      <span class="tag">Group</span>
                      <div class="mock-spu-rail-title">
                        <strong>主推商品</strong>
                        <small>SPU 横滑</small>
                      </div>
                      <div class="mock-spu-strip">
                        <article
                          v-for="item in spuPreviewItems"
                          :key="`dango-spu-${item.name}`"
                          class="click-target mock-spu-card"
                          :class="{ selected: selectedInstanceId === pageNodeId('SPU') }"
                          :data-node-id="pageNodeId('SPU')"
                          @click="selectInstance(pageNodeId('SPU'), $event)"
                        >
                          <div class="mock-spu-cover" aria-hidden="true"></div>
                          <div class="mock-spu-info">
                            <strong>{{ item.name }}</strong>
                          </div>
                        </article>
                      </div>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <div class="mock-tabs-scene">
                        <DuTabs value="hot" size="large">
                          <DuTab name="hot">热门</DuTab>
                          <DuTab name="new">上新</DuTab>
                          <DuTab name="ops">攻略</DuTab>
                        </DuTabs>
                      </div>
                    </div>
                    <div class="click-target mock-feed-flow" :class="{ selected: selectedInstanceId === pageNodeId('Feed') }" :data-node-id="pageNodeId('Feed')" @click="selectInstance(pageNodeId('Feed'), $event)">
                      <span class="tag">Feed</span>
                      <div v-for="(column, columnIndex) in feedPreviewColumns" :key="`dango-feed-column-${columnIndex}`" class="mock-feed-column">
                        <article
                          v-for="item in column"
                          :key="`dango-feed-${item.title}`"
                          class="mock-feed-card"
                          :class="[`mock-feed-card--${item.type}`, { 'click-target': item.type === 'swipe', selected: item.type === 'swipe' && selectedInstanceId === pageNodeId('Swipe') }]"
                          :data-node-id="item.type === 'swipe' ? pageNodeId('Swipe') : undefined"
                          @click="item.type === 'swipe' ? selectInstance(pageNodeId('Swipe'), $event) : undefined"
                        >
                          <div class="mock-feed-cover" aria-hidden="true">
                            <div v-if="item.type === 'swipe'" class="mock-feed-swipe-dots" aria-hidden="true">
                              <i></i><i></i><i></i>
                            </div>
                            <div v-else class="click-target mock-feed-tag" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                              <DuTag :color="item.tagColor || 'default'" size="small">{{ item.tag }}</DuTag>
                            </div>
                          </div>
                          <template v-if="item.type !== 'swipe'">
                            <strong>{{ item.title }}</strong>
                            <div class="mock-feed-meta">
                              <span><DuAvatar size="small" />{{ item.author }}</span>
                              <em><DuIcon :icon="iconCommunityLikeNormal" />{{ item.likes }}</em>
                            </div>
                          </template>
                        </article>
                      </div>
                    </div>
                  </template>
                  
                  <template v-else-if="selectedTemplate?.side === 'display'">
                    <template v-if="selectedTemplateId === 'post-detail'">
                      <div class="click-target post-author-row" :class="{ selected: selectedInstanceId === pageNodeId('Avatar') }" :data-node-id="pageNodeId('Avatar')" @click="selectInstance(pageNodeId('Avatar'), $event)">
                        <span class="tag">Avatar</span>
                        <DuAvatar type="primary" size="small" bordered>DU</DuAvatar>
                        <div>
                          <strong>岛友 Jocelyn</strong>
                          <p>今天 15:52 · 上海</p>
                        </div>
                        <DuButton size="small" type="primary" text="关注" />
                      </div>
                      <div class="click-target post-detail-image" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                        <span class="tag">Image</span>
                        <DuImage :src="imagePreviewSrc" width="100%" height="100%" mode="aspectFill" radius="12" />
                      </div>
                      <div class="post-detail-copy">
                        <strong>周末市集开箱记录</strong>
                        <p>今天终于拿到心心念念的挂件，实物颜色比预览图更软一点。摊位旁边还有交换区，可以顺手看大家的开箱和搭配。</p>
                        <small>共 128 条评论 · 2 小时前</small>
                      </div>
                      <div class="post-comment-preview">
                        <div><DuAvatar size="small" /> <p><strong>小岛居民</strong><span>这个配色好适合夏天，求摊位位置。</span></p></div>
                        <div><DuAvatar size="small" /> <p><strong>鱼丸</strong><span>图 2 的挂绳也是现场买的吗？</span></p></div>
                      </div>
                      <div class="click-target mock-bottom-actionbar mock-bottom-actionbar--post" :class="{ selected: selectedInstanceId === pageNodeId('BottomBar') }" :data-node-id="pageNodeId('BottomBar')" @click="selectInstance(pageNodeId('BottomBar'), $event)">
                        <span class="tag">BottomBar</span>
                        <DuInput class="mock-bottom-actionbar-input" placeholder="说点什么..." />
                        <button class="mock-bottom-icon-action" type="button"><DuIcon :icon="iconCommunityLikeNormal" /><span>256</span></button>
                        <button class="mock-bottom-icon-action" type="button"><DuIcon :icon="iconCollectNormal" /><span>88</span></button>
                        <button class="mock-bottom-icon-action" type="button"><DuIcon :icon="iconComment" /><span>128</span></button>
                      </div>
                    </template>
                    <template v-else-if="selectedTemplateId === 'product-detail'">
                      <div class="click-target product-hero-image" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                        <span class="tag">Image</span>
                        <DuImage :src="imagePreviewSrc" width="100%" height="100%" mode="aspectFill" radius="0" />
                        <span class="product-image-count">1/5</span>
                      </div>
                      <div class="click-target product-price-panel" :class="{ selected: selectedInstanceId === pageNodeId('PriceStatistic') }" :data-node-id="pageNodeId('PriceStatistic')" @click="selectInstance(pageNodeId('PriceStatistic'), $event)">
                        <span class="tag">PriceStatistic</span>
                        <strong><small>¥</small>256</strong>
                        <em>券后预估 ¥239</em>
                      </div>
                      <div class="product-title-block">
                        <strong>Labubu 搪胶挂件 周末限定款</strong>
                        <p>现货速发，支持同城自提；商品图、价格、服务承诺和购买行动组成商品详情页主体。</p>
                      </div>
                      <div class="click-target product-service-list" :class="{ selected: selectedInstanceId === pageNodeId('List') }" :data-node-id="pageNodeId('List')" @click="selectInstance(pageNodeId('List'), $event)">
                        <span class="tag">List</span>
                        <p><span>优惠</span><strong>满 199 减 20 · 新人券可叠加</strong><b>›</b></p>
                        <p><span>配送</span><strong>上海 24 小时内发货</strong><b>›</b></p>
                        <p><span>保障</span><strong>七天无理由 · 假一赔三</strong><b>›</b></p>
                        <p><span>规格</span><strong>默认款 / 透明挂绳</strong><b>›</b></p>
                      </div>
                      <div class="product-shop-row">
                        <DuAvatar size="small" bordered>岛</DuAvatar>
                        <div><strong>千岛潮玩市集</strong><p>4.9 分 · 已售 2.3k</p></div>
                        <DuButton size="small" type="outline" text="进店" />
                      </div>
                      <div class="click-target mock-bottom-actionbar mock-bottom-actionbar--commerce" :class="{ selected: selectedInstanceId === pageNodeId('BottomBar') }" :data-node-id="pageNodeId('BottomBar')" @click="selectInstance(pageNodeId('BottomBar'), $event)">
                        <span class="tag">BottomBar</span>
                        <button class="mock-bottom-mini-action" type="button"><DuIcon :icon="iconCollectNormal" /><span>收藏</span></button>
                        <button class="mock-bottom-mini-action" type="button"><DuIcon :icon="iconRoom" /><span>店铺</span></button>
                        <DuButton text="加入购物车" type="outline" color="primary" />
                        <DuButton text="立即购买" type="primary" />
                      </div>
                    </template>
                    <template v-else-if="selectedTemplateId === 'order-detail'">
                      <div class="order-status-card">
                        <div>
                          <small>订单状态</small>
                          <strong>待发货</strong>
                          <p>商家正在备货，预计今天 20:00 前揽收。</p>
                        </div>
                      </div>
                      <div class="click-target order-steps-card" :class="{ selected: selectedInstanceId === pageNodeId('Steps') }" :data-node-id="pageNodeId('Steps')" @click="selectInstance(pageNodeId('Steps'), $event)">
                        <span class="tag">Steps</span>
                        <DuSteps :active-index="1" status="process" color="primary" :steps="[{ title: '已付款' }, { title: '待发货' }, { title: '运输中' }, { title: '已完成' }]" />
                      </div>
                      <div class="order-address-card">
                        <strong>收货地址</strong>
                        <p>Jocelyn 138****9527</p>
                        <span>上海市徐汇区漕河泾街道 88 号</span>
                      </div>
                      <div class="click-target order-product-card" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                        <span class="tag">Image</span>
                        <DuImage :src="imagePreviewSrc" width="72px" height="96px" mode="aspectFill" radius="8" />
                        <div>
                          <strong>Labubu 搪胶挂件 周末限定款</strong>
                          <p>默认款 / 透明挂绳</p>
                          <span>¥256 × 1</span>
                        </div>
                      </div>
                      <div class="click-target order-fee-list" :class="{ selected: selectedInstanceId === pageNodeId('List') }" :data-node-id="pageNodeId('List')" @click="selectInstance(pageNodeId('List'), $event)">
                        <span class="tag">List</span>
                        <p><span>商品金额</span><strong>¥256.00</strong></p>
                        <p><span>优惠抵扣</span><strong>-¥20.00</strong></p>
                        <p><span>运费</span><strong>¥0.00</strong></p>
                      </div>
                      <div class="click-target mock-time-row order-time-row" :class="{ selected: selectedInstanceId === pageNodeId('Time') }" :data-node-id="pageNodeId('Time')" @click="selectInstance(pageNodeId('Time'), $event)">
                        <span class="tag">Time</span>
                        <strong>2026.06.19</strong><p>付款时间 · 15:52</p>
                      </div>
                      <div class="click-target order-total-row" :class="{ selected: selectedInstanceId === pageNodeId('PriceStatistic') }" :data-node-id="pageNodeId('PriceStatistic')" @click="selectInstance(pageNodeId('PriceStatistic'), $event)">
                        <span class="tag">PriceStatistic</span>
                        <span>实付款</span><strong>¥236.00</strong>
                      </div>
                      <div class="click-target mock-bottom-actionbar mock-bottom-actionbar--order" :class="{ selected: selectedInstanceId === pageNodeId('BottomBar') }" :data-node-id="pageNodeId('BottomBar')" @click="selectInstance(pageNodeId('BottomBar'), $event)">
                        <span class="tag">BottomBar</span>
                        <div class="mock-bottom-actionbar-summary">
                          <small>实付款</small>
                          <strong>¥236.00</strong>
                        </div>
                        <DuButton text="联系商家" type="outline" />
                        <DuButton text="提醒发货" type="primary" />
                      </div>
                    </template>
                    <template v-else>
                    <div class="click-target display-hero-image" :class="{ selected: selectedInstanceId === pageNodeId('Image') }" :data-node-id="pageNodeId('Image')" @click="selectInstance(pageNodeId('Image'), $event)">
                      <span class="tag">Image</span>
                      <DuImage :src="imagePreviewSrc" width="100%" height="100%" mode="aspectFill" radius="0" />
                    </div>
                    <div class="click-target display-summary" :class="{ selected: selectedInstanceId === pageNodeId('Avatar') }" :data-node-id="pageNodeId('Avatar')" @click="selectInstance(pageNodeId('Avatar'), $event)">
                      <span class="tag">Avatar</span>
                      <DuAvatar type="primary" size="medium" bordered>DU</DuAvatar>
                      <div>
                        <strong>服务器返回的用户信息</strong>
                        <p>昵称、状态、数量和图片资源都属于展示侧。</p>
                        <DuButton
                          class="display-popup-trigger click-target"
                          text="查看资料"
                          size="small"
                          type="outline"
                          :data-node-id="pageNodeId('Popup')"
                          @pointerdown.capture="syncMockupPopupBounds('Popup')"
                          @click.stop="openDisplayPopup"
                        />
                      </div>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Badge') }" :data-node-id="pageNodeId('Badge')" @click="selectInstance(pageNodeId('Badge'), $event)">
                      <span class="tag">Badge</span>
                      <DuBadge value="12" color="primary" always-show>
                        <span class="badge-anchor">更新</span>
                      </DuBadge>
                    </div>
                    <DuPopup
                      title="资料详情"
                      type="bottom"
                      :visible="displayPopupVisible"
                      :ext-style="mockupDisplayPopupStyle"
                      :mask-style="mockupPopupMaskStyle"
                      @update:visible="displayPopupVisible = $event"
                      @close="displayPopupVisible = false"
                    >
                      <div class="display-popup-content click-target" :data-node-id="pageNodeId('Popup')">
                        <span class="tag">Popup</span>
                        <DuImage :src="imagePreviewSrc" width="100%" height="132px" mode="aspectFill" radius="12" />
                        <strong>图片详情 / 服务器资料</strong>
                        <p>Popup 承接临时展开的详情内容，不占用展示侧主页面常驻空间。</p>
                        <div class="display-popup-meta">
                          <span>更新状态</span><b>已同步</b>
                          <span>资料数量</span><b>12</b>
                        </div>
                      </div>
                    </DuPopup>
                    <div class="click-target mock-list" :class="{ selected: selectedInstanceId === pageNodeId('List') }" :data-node-id="pageNodeId('List')" @click="selectInstance(pageNodeId('List'), $event)">
                      <span class="tag">List</span>
                      <p v-for="item in displayListRows" :key="`display-list-${item.title}`">
                        <i aria-hidden="true"></i>
                        <span><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></span>
                        <em>{{ item.meta }}</em>
                        <b aria-hidden="true">›</b>
                      </p>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Steps') }" :data-node-id="pageNodeId('Steps')" @click="selectInstance(pageNodeId('Steps'), $event)">
                      <span class="tag">Steps</span>
                      <DuSteps :active-index="1" status="process" color="primary" :steps="[{ title: '提交' }, { title: '审核' }, { title: '完成' }]" />
                    </div>
                    <div class="click-target mock-time-row" :class="{ selected: selectedInstanceId === pageNodeId('Time') }" :data-node-id="pageNodeId('Time')" @click="selectInstance(pageNodeId('Time'), $event)">
                      <span class="tag">Time</span>
                      <strong>2026.06.15</strong><p>最近同步 · 12:30</p>
                    </div>
                    <div class="click-target mock-stat-grid" :class="{ selected: selectedInstanceId === pageNodeId('PriceStatistic') }" :data-node-id="pageNodeId('PriceStatistic')" @click="selectInstance(pageNodeId('PriceStatistic'), $event)">
                      <span class="tag">PriceStatistic</span>
                      <b><small>VALUE</small>¥256</b><b><small>SCORE</small>98</b><b><small>RANK</small>Top 5</b>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Rate') }" :data-node-id="pageNodeId('Rate')" @click="selectInstance(pageNodeId('Rate'), $event)">
                      <span class="tag">Rate</span>
                      <DuRate :default-value="4" :icon="iconRateFilled" size="medium" color="primary" />
                    </div>
                    <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Card') }" :data-node-id="pageNodeId('Card')" @click="selectInstance(pageNodeId('Card'), $event)">
                      <span class="tag">Card</span>
                      <strong>数据分组</strong><p>用页面 section/Card 组合承接。</p>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                      <span class="tag">Tabs</span>
                      <DuTabs value="detail" type="tag" size="normal"><DuTab name="detail">详情</DuTab><DuTab name="media">媒体</DuTab><DuTab name="record">记录</DuTab></DuTabs>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Button') }" :data-node-id="pageNodeId('Button')" @click="selectInstance(pageNodeId('Button'), $event)">
                      <span class="tag">Button</span>
                      <div class="button-row"><DuButton text="查看详情" type="primary" /><DuButton text="收藏" type="outline" /></div>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Tag') }" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                      <span class="tag">Tag</span>
                      <div class="tag-row"><DuTag color="primary" round>活跃</DuTag><DuTag color="default" round>服务端状态</DuTag></div>
                    </div>
                    </template>
                  </template>
                  <template v-else-if="selectedTemplate?.side === 'publish'">
                    <div class="form-demo generic-publish-form">
                      <div class="publish-template-tip">
                        <strong>TIPS</strong>
                        <span>先写清标题和亮点，再设置报名、同步和发布时间。</span>
                      </div>
                      <section class="group publish-editor-card">
                        <div class="click-target publish-cover-upload" :class="{ selected: selectedInstanceId === pageNodeId('Upload') }" :data-node-id="pageNodeId('Upload')" @click="selectInstance(pageNodeId('Upload'), $event)">
                          <span class="tag">Upload</span>
                          <DuUpload :value="[]" upload-text="添加封面" />
                        </div>
                        <div class="click-target publish-title-field" :class="{ selected: selectedInstanceId === pageNodeId('Input') }" :data-node-id="pageNodeId('Input')" @click="selectInstance(pageNodeId('Input'), $event)">
                          <span class="tag">Input</span>
                          <DuInput value="周末市集" placeholder="填写清晰的活动标题" allow-clear />
                        </div>
                        <div class="click-target publish-body-field" :class="{ selected: selectedInstanceId === pageNodeId('Textarea') }" :data-node-id="pageNodeId('Textarea')" @click="selectInstance(pageNodeId('Textarea'), $event)">
                          <span class="tag">Textarea</span>
                          <DuTextarea value="描述活动亮点、内容、人群和注意事项，帮助用户快速判断要不要参加。" show-count :maxlength="120" />
                        </div>
                        <div class="publish-editor-meta">
                          <div class="click-target control-grid control-grid--inline-short" :class="{ selected: selectedInstanceId === pageNodeId('Radio') }" :data-node-id="pageNodeId('Radio')" @click="selectInstance(pageNodeId('Radio'), $event)">
                            <span class="tag">Radio</span>
                            <DuRadio checked label="公开" /><DuRadio label="仅团队" />
                          </div>
                          <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Tag') }" :data-node-id="pageNodeId('Tag')" @click="selectInstance(pageNodeId('Tag'), $event)">
                            <span class="tag">Tag</span>
                            <DuTag color="primary" round>AI 智能排版</DuTag>
                          </div>
                        </div>
                      </section>
                      <section class="publish-mode-card">
                        <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Tabs') }" :data-node-id="pageNodeId('Tabs')" @click="selectInstance(pageNodeId('Tabs'), $event)">
                          <span class="tag">Tabs</span>
                          <DuTabs value="single" type="tag" size="large"><DuTab name="single">单次活动</DuTab><DuTab name="series">多场次活动</DuTab></DuTabs>
                        </div>
                      </section>
                      <DuForm class="group publish-form-card" layout="horizontal" label-size="88px">
                        <DuFormItem label="活动分类" required>
                          <div class="click-target publish-field-control" :class="{ selected: selectedInstanceId === pageNodeId('Select') }" :data-node-id="pageNodeId('Select')" @pointerdown.capture="syncMockupPopupBounds('Select')" @click="selectInstance(pageNodeId('Select'), $event)">
                          <span class="tag">Select</span>
                          <DuSelect title="请选择活动类型" :options="selectOptions" :value="genericSelectValue" :popup-style="mockupSelectPopupStyle" @update:value="genericSelectValue = $event" />
                          </div>
                        </DuFormItem>
                        <DuFormItem label="活动人数" required>
                          <div class="click-target publish-field-control" :class="{ selected: selectedInstanceId === pageNodeId('Stepper') }" :data-node-id="pageNodeId('Stepper')" @click="selectInstance(pageNodeId('Stepper'), $event)">
                          <span class="tag">Stepper · InputNumber</span>
                          <DuInputNumber :value="3" :min="1" :max="99" />
                          </div>
                        </DuFormItem>
                        <DuFormItem label="活动地点">
                          <div class="click-target publish-field-control publish-field-value" :class="{ selected: selectedInstanceId === pageNodeId('Cascader') }" :data-node-id="pageNodeId('Cascader')" @pointerdown.capture="syncMockupPopupBounds('Cascader')" @click="selectInstance(pageNodeId('Cascader'), $event)">
                          <span class="tag">Cascader</span>
                          <DuCascader title="活动地点" :options="cascaderExampleOptions" :value="['east', 'shanghai', 'pudong']" show-search :popup-style="mockupSelectPopupStyle" />
                          </div>
                        </DuFormItem>
                        <DuFormItem label="报名截止">
                          <div
                            class="click-target publish-field-control publish-field-value"
                            :class="{ selected: selectedInstanceId === pageNodeId('DateTimePicker') }"
                            :data-node-id="pageNodeId('DateTimePicker')"
                            @pointerdown.capture="syncMockupPopupBounds('DateTimePicker')"
                            @click="selectInstance(pageNodeId('DateTimePicker'), $event); calendarDateTimeVisible = true"
                          >
                          <span class="tag">DateTimePicker · Calendar showTimePicker</span>
                          <strong>{{ calendarDateTimeText }}</strong>
                          </div>
                          <DuCalendar
                            v-model:visible="calendarDateTimeVisible"
                            title="报名截止"
                            type="single"
                            :selected-date="calendarSelectedDate"
                            show-time-picker
                            :time-step="5"
                            @confirm="handleCalendarDateTimeConfirm"
                          />
                        </DuFormItem>
                        <DuFormItem label="首页同步">
                          <div class="click-target publish-field-control" :class="{ selected: selectedInstanceId === pageNodeId('Switch') }" :data-node-id="pageNodeId('Switch')" @click="selectInstance(pageNodeId('Switch'), $event)">
                          <span class="tag">Switch</span>
                          <DuSwitch :on="publishSyncOn" @update:on="publishSyncOn = $event" @click.stop />
                          </div>
                        </DuFormItem>
                        <DuFormItem label="更多设置">
                          <div class="click-target control-grid publish-option-grid" :class="{ selected: selectedInstanceId === pageNodeId('Checkbox') }" :data-node-id="pageNodeId('Checkbox')" @click="selectInstance(pageNodeId('Checkbox'), $event)">
                          <span class="tag">Checkbox</span>
                          <DuCheckbox :checked="publishWaitlistOn" label="候补" @update:checked="publishWaitlistOn = $event" @click.stop />
                          <DuCheckbox :checked="publishLimitOn" label="限购" @update:checked="publishLimitOn = $event" @click.stop />
                          </div>
                        </DuFormItem>
                        <DuFormItem label="推荐强度">
                          <div class="click-target publish-field-control" :class="{ selected: selectedInstanceId === pageNodeId('Rate') }" :data-node-id="pageNodeId('Rate')" @click="selectInstance(pageNodeId('Rate'), $event)">
                          <span class="tag">Rate</span>
                          <DuRate :default-value="3" :icon="iconRateFilled" size="medium" color="primary" />
                          </div>
                        </DuFormItem>
                      </DuForm>
                      <div class="click-target publish-list-row publish-tips-row" :class="{ selected: selectedInstanceId === pageNodeId('Tips') }" :data-node-id="pageNodeId('Tips')" @click="selectInstance(pageNodeId('Tips'), $event)">
                        <span class="tag">Tips</span>
                        <span>TIPS：开启候补后，活动结束前不建议取消。</span>
                      </div>
                      <div class="click-target mock-bottom-actionbar mock-bottom-actionbar--publish" :class="{ selected: selectedInstanceId === pageNodeId('BottomBar') }" :data-node-id="pageNodeId('BottomBar')" @click="selectInstance(pageNodeId('BottomBar'), $event)">
                        <span class="tag">BottomBar</span>
                        <DuButton text="存草稿" type="outline" />
                        <DuButton text="发布活动" type="primary" />
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('NoticeBar') }" :data-node-id="pageNodeId('NoticeBar')" @click="selectInstance(pageNodeId('NoticeBar'), $event)">
                      <span class="tag">NoticeBar</span>
                      <DuNoticeBar text="非模态轻反馈：页面内提示，不打断用户操作。" link-text="知道了" />
                    </div>
                    <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Snackbar') }" :data-node-id="pageNodeId('Snackbar')" @click="selectInstance(pageNodeId('Snackbar'), $event)">
                      <span class="tag">Snackbar</span>
                      <strong>非模态轻反馈：短提示</strong>
                      <p>DuSnackbar 可承接，但需要由动作触发，默认不常驻。</p>
                    </div>
                    <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Toast') }" :data-node-id="pageNodeId('Toast')" @click="selectInstance(pageNodeId('Toast'), $event)">
                      <span class="tag">Toast</span>
                      <strong>ToastProvider / useToast</strong>
                      <p>当前 DangoUI 提供 ToastProvider 和 useToast，不是独立可见组件。</p>
                    </div>
                    <div class="feedback-stack">
                      <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Dialog') }" :data-node-id="pageNodeId('Dialog')" @click="selectInstance(pageNodeId('Dialog'), $event)">
                        <span class="tag">Dialog</span>
                        <strong>模态重反馈：需要用户决策</strong>
                        <p>确认、删除、付款等高风险动作再使用。</p>
                      </div>
                      <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Popup') }" :data-node-id="pageNodeId('Popup')" @click="selectInstance(pageNodeId('Popup'), $event)">
                        <span class="tag">Popup</span>
                        <strong>模态中反馈：承载临时内容</strong>
                        <p>适合筛选、说明、二次操作等底部或居中浮层。</p>
                      </div>
                    </div>
                    <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Dropdown') }" :data-node-id="pageNodeId('Dropdown')" @click="selectInstance(pageNodeId('Dropdown'), $event)">
                      <span class="tag">Dropdown</span>
                      <strong>筛选下拉面板</strong><p>DuDropdown 可承接，需要展开态；静态页仅表达入口。</p>
                    </div>
                    <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('Popover') }" :data-node-id="pageNodeId('Popover')" @click="selectInstance(pageNodeId('Popover'), $event)">
                      <span class="tag">Popover</span>
                      <strong>轻量浮层说明</strong><p>DangoUI 暂无 Popover，通常由 Tooltip / Popup / 业务组件承接。</p>
                    </div>
                    <div class="click-target placeholder-card" :class="{ selected: selectedInstanceId === pageNodeId('ShareSheet') }" :data-node-id="pageNodeId('ShareSheet')" @click="selectInstance(pageNodeId('ShareSheet'), $event)">
                      <span class="tag">ShareSheet</span>
                      <strong>分享面板</strong><p>可由 DuActionSheet grid/list 组合承接，分享渠道由业务注入。</p>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Empty') }" :data-node-id="pageNodeId('Empty')" @click="selectInstance(pageNodeId('Empty'), $event)">
                      <span class="tag">Empty</span>
                      <DuEmpty text="非模态中反馈：占据局部页面，给出下一步动作。" button-text="去创建" />
                    </div>
                    <div class="click-target mock-result-page" :class="{ selected: selectedInstanceId === pageNodeId('ResultPage') }" :data-node-id="pageNodeId('ResultPage')" @click="selectInstance(pageNodeId('ResultPage'), $event)">
                      <span class="tag">ResultPage</span>
                      <strong>提交成功</strong><p>结果页是业务页面模板；DangoUI 可用 Empty / Button / Icon 组合。</p>
                      <DuButton text="返回首页" type="primary" />
                    </div>
                    <div class="click-target placeholder-card mock-spin" :class="{ selected: selectedInstanceId === pageNodeId('Spin') }" :data-node-id="pageNodeId('Spin')" @click="selectInstance(pageNodeId('Spin'), $event)">
                      <span class="tag">Spin</span>
                      <i></i><strong>加载中</strong><p>DangoUI 当前未导出 Spin 组件。</p>
                    </div>
                    <div class="click-target" :class="{ selected: selectedInstanceId === pageNodeId('Skeleton') }" :data-node-id="pageNodeId('Skeleton')" @click="selectInstance(pageNodeId('Skeleton'), $event)">
                      <span class="tag">Skeleton</span>
                      <DuSkeleton loading>
                        <template #template>
                          <div class="skeleton-demo">
                            <div></div>
                            <div></div>
                            <div></div>
                          </div>
                        </template>
                      </DuSkeleton>
                    </div>
                  </template>

                  <section v-if="snapshotComponents.length" class="component-supplement-section" aria-label="组件快照">
                    <div class="component-supplement-grid">
                      <div
                        v-for="name in snapshotComponents"
                        :key="`snapshot-${selectedTemplateId}-${name}`"
                        role="button"
                        tabindex="0"
                        class="click-target supplement-component-card"
                        :class="[`supplement-component-card--${kebabName(name)}`, { selected: selectedInstanceId === pageNodeId(name) }]"
                        :data-node-id="pageNodeId(name)"
                        @click="selectInstance(pageNodeId(name))"
                        @keydown.enter.prevent="selectInstance(pageNodeId(name))"
                      >
                        <span class="tag">{{ name }}</span>
                        <div class="supplement-component-preview">
                          <DuRate v-if="name === 'Rate'" :default-value="4" :icon="iconRateFilled" size="medium" color="primary" />
                          <div v-else-if="name === 'Button'" class="button-row">
                            <DuButton :text="activeSide === 'distribution' ? '立即预约' : '主要行动'" type="primary" />
                            <DuButton :text="activeSide === 'distribution' ? '查看详情' : '次要'" type="outline" />
                          </div>
                          <div v-else-if="name === 'Tag' && activeSide === 'distribution'" class="mock-tag-scene compact">
                            <strong>周末补给包</strong>
                            <div class="tag-row">
                              <DuTag color="primary">限时</DuTag>
                              <DuTag color="default">主推</DuTag>
                              <DuTag color="success">上新</DuTag>
                            </div>
                          </div>
                          <div v-else-if="name === 'Tag'" class="tag-row">
                            <DuTag color="primary">Primary</DuTag>
                            <DuTag color="default">Default</DuTag>
                          </div>
                          <div v-else-if="name === 'Tabs' && activeSide === 'distribution'" class="mock-tabs-scene compact">
                            <DuTabs value="a" size="large">
                              <DuTab name="a">热门</DuTab>
                              <DuTab name="b">上新</DuTab>
                              <DuTab name="c">攻略</DuTab>
                            </DuTabs>
                          </div>
                          <DuTabs v-else-if="name === 'Tabs'" value="a" size="normal">
                            <DuTab name="a">选项一</DuTab>
                            <DuTab name="b">选项二</DuTab>
                          </DuTabs>
                          <div v-else-if="name === 'TabBar'" class="mock-tabbar">
                            <button class="active" type="button">首页</button>
                            <button type="button">发现</button>
                            <button type="button">我的</button>
                          </div>
                          <div v-else-if="name === 'SegmentControl'" class="mock-segment-control">
                            <button type="button" class="active">全部</button>
                            <button type="button">活动</button>
                            <button type="button">攻略</button>
                          </div>
                          <div v-else-if="name === 'BottomBar'" class="mock-bottom-bar">
                            <button class="mock-bottom-mini-action" type="button"><DuIcon :icon="iconCollectNormal" /><span>测试</span></button>
                            <DuButton text="按钮" type="outline" />
                            <DuButton text="按钮" type="primary" />
                          </div>
                          <div v-else-if="name === 'Menu'" class="mock-menu-list">
                            <button type="button" class="active">内容配置</button>
                            <button type="button">数据复盘</button>
                          </div>
                          <DuSearch v-else-if="name === 'Search'" readonly :placeholder="[activeSide === 'distribution' ? '搜索活动、商品、攻略' : '搜索内容、活动、商品']" />
                          <DuImage v-else-if="name === 'Image'" :src="imagePreviewSrc" width="100%" height="72px" mode="aspectFill" radius="8" />
                          <DuCard v-else-if="name === 'Card'" :title="activeSide === 'distribution' ? '限量补给包上新' : '内容卡片'" guide-text="" size="large">
                            <p class="card-copy">{{ activeSide === 'distribution' ? '封面、标题、标签、摘要和按钮组成一条可分发内容。' : '标题、摘要、图片或行动入口的内容承载容器。' }}</p>
                          </DuCard>
                          <DuBadge v-else-if="name === 'Badge'" value="8" color="primary" always-show>
                            <span class="badge-anchor">消息</span>
                          </DuBadge>
                          <DuAvatar v-else-if="name === 'Avatar'" type="primary" size="large" bordered>DU</DuAvatar>
                          <div v-else-if="name === 'Swipe'" class="mock-feed-card mock-feed-card--swipe">
                            <div class="mock-feed-cover" aria-hidden="true">
                              <div class="mock-feed-swipe-dots" aria-hidden="true">
                                <i></i><i></i><i></i>
                              </div>
                            </div>
                          </div>
                          <div v-else-if="name === 'Swiper'" class="mock-swiper supplement-swiper">
                            <div>
                              <strong>{{ activeSide === 'distribution' ? '今日主推资源位' : '轮播' }}</strong>
                              <p v-if="activeSide === 'distribution'">多张 Banner 承接福利、上新、攻略和预约入口。</p>
                            </div>
                          </div>
                          <div v-else-if="name === 'Grid'" class="mock-grid">
                            <i v-for="item in (activeSide === 'distribution' ? ['看资料', '逛社区', '买二手', '抽一手'] : ['入口一', '入口二', '入口三', '入口四'])" :key="`snapshot-grid-${item}`">{{ item }}</i>
                          </div>
                          <div v-else-if="name === 'List'" class="mock-list">
                            <p v-for="item in currentListRows" :key="`snapshot-list-${selectedTemplateId}-${item.title}`">
                              <i aria-hidden="true"></i>
                              <span><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></span>
                              <em>{{ item.meta }}</em>
                              <b aria-hidden="true">›</b>
                            </p>
                          </div>
                          <div v-else-if="name === 'Time'" class="mock-time-row">
                            <strong>{{ activeSide === 'distribution' ? '06.17' : '2026.06.15' }}</strong>
                            <p>{{ activeSide === 'distribution' ? '20:00 开抢 · 距结束 48h' : '最近同步 · 12:30' }}</p>
                          </div>
                          <div v-else-if="name === 'PriceStatistic'" class="mock-stat-grid">
                            <b><small>PRICE</small>¥128</b><b><small>{{ activeSide === 'distribution' ? '已预约' : 'VALUE' }}</small>{{ activeSide === 'distribution' ? '12.6w' : '98' }}</b><b><small>{{ activeSide === 'distribution' ? '热度' : 'RANK' }}</small>{{ activeSide === 'distribution' ? '98' : 'Top 5' }}</b>
                          </div>
                          <div v-else-if="name === 'Feed' || name === 'FeedSpuTag'" class="mock-feed-flow">
                            <div v-for="(column, columnIndex) in feedPreviewColumns" :key="`snapshot-feed-column-${activeSide}-${columnIndex}`" class="mock-feed-column">
                              <article v-for="item in column" :key="`snapshot-feed-${activeSide}-${item.title}`" class="mock-feed-card" :class="`mock-feed-card--${item.type}`">
                                <div class="mock-feed-cover" aria-hidden="true">
                                  <div v-if="item.type === 'swipe'" class="mock-feed-swipe-dots" aria-hidden="true">
                                    <i></i><i></i><i></i>
                                  </div>
                                  <div v-else class="mock-feed-tag">
                                    <DuTag :color="item.tagColor || 'default'" size="small">{{ activeSide === 'distribution' ? item.tag : '标签' }}</DuTag>
                                  </div>
                                </div>
                                <template v-if="item.type !== 'swipe'">
                                  <strong>{{ activeSide === 'distribution' ? item.title : 'Feed 双列内容流' }}</strong>
                                  <div class="mock-feed-meta">
                                    <span><DuAvatar size="small" />{{ activeSide === 'distribution' ? item.author : '内容作者' }}</span>
                                    <em><DuIcon :icon="iconCommunityLikeNormal" />{{ item.likes }}</em>
                                  </div>
                                </template>
                              </article>
                            </div>
                          </div>
                          <div v-else-if="name === 'SPU' || name === 'SpuTag'" class="mock-spu-rail">
                            <div class="mock-spu-rail-title">
                              <strong>{{ activeSide === 'distribution' ? '主推商品' : 'SPU 横滑' }}</strong>
                              <small>SPU</small>
                            </div>
                            <div class="mock-spu-strip">
                              <article v-for="item in spuPreviewItems" :key="`snapshot-spu-${activeSide}-${item.name}`" class="mock-spu-card">
                                <div class="mock-spu-cover" aria-hidden="true"></div>
                                <div class="mock-spu-info">
                                  <strong>{{ activeSide === 'distribution' ? item.name : '商品模型' }}</strong>
                                </div>
                              </article>
                            </div>
                          </div>
                          <button v-else-if="name === 'FAB'" class="demo-publish-fab supplement-fab" type="button" aria-label="快捷创建">
                            <DuIcon :icon="iconPlusHeavy" :size="18" />
                          </button>
                          <DuSteps v-else-if="name === 'Steps'" :active-index="1" status="process" color="primary" :steps="[{ title: '提交' }, { title: '审核' }, { title: '完成' }]" />
                          <DuNoticeBar v-else-if="name === 'NoticeBar'" text="这是一条 NoticeBar 提示。" />
                          <DuSnackbar v-else-if="name === 'Snackbar'" :show="true" :show-action-btn="false" :show-close="false" :duration="0">已保存</DuSnackbar>
                          <DuEmpty v-else-if="name === 'Empty'" text="暂无内容" />
                          <DuSkeleton v-else-if="name === 'Skeleton'" loading>
                            <template #template>
                              <div class="skeleton-demo"><div></div><div></div><div></div></div>
                            </template>
                          </DuSkeleton>
                          <DuInput v-else-if="name === 'Input'" value="输入内容" bordered />
                          <DuTextarea v-else-if="name === 'Textarea'" value="多行输入内容" bordered />
                          <DuRadio v-else-if="name === 'Radio'" checked label="选项" />
                          <DuCheckbox v-else-if="name === 'Checkbox'" checked label="复选项" />
                          <DuSwitch v-else-if="name === 'Switch'" :on="true" />
                          <DuInputNumber v-else-if="name === 'Stepper'" :value="3" :min="1" :max="99" />
                          <div v-else-if="name === 'DateTimePicker'" class="mock-datetime-picker">
                            <strong>2026-06-08</strong>
                            <span>20:00</span>
                            <small>Calendar + showTimePicker</small>
                          </div>
                          <div v-else-if="name === 'Cascader'" class="mock-datetime-picker">
                            <strong>华东 / 上海</strong>
                            <span>›</span>
                            <small>Cascader 多级选择</small>
                          </div>
                          <DuSelect v-else-if="name === 'Select'" title="选择器" :options="selectOptions" value="option-a" />
                          <DuUpload v-else-if="name === 'Upload'" :value="[]" upload-text="上传" />
                          <div v-else-if="name === 'Tips'" class="mock-tips-card">
                            <strong>字段辅助提示</strong>
                            <p>解释规则、风险或下一步动作。</p>
                          </div>
                          <DuFormItem v-else-if="name === 'FormItem'" label="字段" required show-border>
                            <DuInput value="表单项" bordered />
                          </DuFormItem>
                          <DuForm v-else-if="name === 'Group'" class="mock-form-group" layout="vertical" label-size="72px">
                            <DuFormItem label="基础信息" show-border>
                              <DuInput value="同一组相关字段" bordered />
                            </DuFormItem>
                            <DuFormItem label="发布设置" show-border>
                              <DuSwitch :on="true" />
                            </DuFormItem>
                          </DuForm>
                          <div v-else-if="name === 'Dialog'" class="placeholder-card supplement-dialog"><strong>Dialog</strong><p>确认 / 取消</p></div>
                          <div v-else-if="name === 'Popup'" class="placeholder-card supplement-popup"><strong>Popup</strong><p>底部弹层</p></div>
                          <div v-else-if="name === 'Dropdown'" class="placeholder-card supplement-dropdown"><strong>筛选</strong><p>Dropdown</p></div>
                          <div v-else-if="name === 'Toast'" class="placeholder-card supplement-toast"><strong>Toast</strong><p>useToast 触发</p></div>
                          <div v-else-if="name === 'ShareSheet'" class="placeholder-card supplement-share"><strong>ShareSheet</strong><p>ActionSheet 适配</p></div>
                          <div v-else-if="name === 'ResultPage'" class="mock-result-page compact-result"><strong>提交成功</strong><p>完成后给出下一步。</p></div>
                          <div v-else-if="name === 'Spin'" class="mock-spin-inline"><i></i><span>加载中</span></div>
                          <i v-else aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
                <nav
                  v-if="showDemoBottomActions"
                  class="click-target demo-bottom-tabbar"
                  :class="{ selected: selectedInstanceId === pageNodeId('TabBar') }"
                  :data-node-id="pageNodeId('TabBar')"
                  aria-label="demo inspector switcher"
                >
                  <span class="tag">TabBar</span>
                  <button type="button" :class="{ active: selectedInspectorTab === 'style' }" @click.stop="showStyleMenu">
                    <span>风格</span>
                  </button>
                  <button type="button" :class="{ active: selectedInspectorTab === 'components' }" @click.stop="showComponentMenu">
                    <span>组件</span>
                  </button>
                  <button type="button" :class="{ active: selectedInspectorTab === 'pages' }" @click.stop="showPageMenu">
                    <span>页面</span>
                  </button>
                </nav>
                <button
                  v-if="showPublishFab"
                  class="click-target demo-publish-fab"
                  :class="{ active: selectedTemplateId === publishTemplateId, selected: selectedInstanceId === pageNodeId('FAB') }"
                  type="button"
                  :data-node-id="pageNodeId('FAB')"
                  aria-label="打开发布侧"
                  @click="openPublishSide"
                >
                  <span class="tag">FAB</span>
                  <DuIcon :icon="iconPlusHeavy" :size="20" />
                </button>
                <DuSnackbar
                  v-if="snackbarMessage"
                  :show="true"
                  :show-action-btn="false"
                  :show-close="false"
                  :duration="0"
                  :ext-class="['mockup-copy-snackbar', { 'mockup-copy-snackbar--open': snackbarOpen }]"
                  role="status"
                  aria-live="polite"
                >
                  {{ snackbarMessage }}
                </DuSnackbar>
              </div>
              <div class="mock-home-indicator mock-home-indicator--outer" aria-hidden="true"><span></span></div>
              <div
                v-if="mockupHoverLabel"
                class="mockup-hover-label"
                :style="mockupHoverStyle"
                aria-hidden="true"
              >
                {{ mockupHoverLabel }}
              </div>
            </div>
          </section>
        <!-- DateTimePicker showcase popup:点 DuButton 触发,作为浮层挂到 article 末尾 -->
        <div v-if="componentExamplePopup === 'datetime-picker'" class="component-example-popup-layer">
          <DuCalendar
            :visible="true"
            title="选择日期时间"
            type="single"
            :selected-date="componentExampleState.calendarSelectedDate"
            :selected-time="componentExampleState.calendarSelectedTime"
            :show-time-picker="componentExampleState.calendarShowTimePicker"
            :time-step="5"
            @close="closeComponentExamplePopup"
            @cancel="closeComponentExamplePopup"
            @confirm="(payload) => { setComponentExampleValue('calendarSelectedDate', payload?.date || null); setComponentExampleValue('calendarSelectedTime', payload?.time || null); closeComponentExamplePopup(); }"
          />
        </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import dayjs from "dayjs";
import {
  DuActionButton,
  DuAvatar,
  DuAvatarGroup,
  DuBadge,
  DuButton,
  DuCard,
  DuCalendar,
  DuCascader,
  DuCheckbox,
  DuDivider,
  DuEmpty,
  DuForm,
  DuFormItem,
  DuIcon,
  DuIconButton,
  DuImage,
  DuInput,
  DuInputNumber,
  DuNavigationBar,
  DuNoticeBar,
  DuPopup,
  DuRadio,
  DuRate,
  DuSearch,
  DuSelect,
  DuSnackbar,
  DuSkeleton,
  DuSkeletonAvatar,
  DuSkeletonParagraph,
  DuSkeletonRectangle,
  DuSteps,
  DuSwitch,
  DuSwiper,
  DuSwiperItem,
  DuTab,
  DuTabs,
  DuTag,
  DuTextarea,
  DuUpload,
} from "dangoui";
import {
  iconCamera,
  iconCollectNormal,
  iconComment,
  iconCommunityLikeNormal,
  iconPlusHeavy,
  iconRateFilled,
  iconRefresh,
  iconRoom,
  iconScanning,
  iconShare,
} from "dangoui-icon-config";
import * as DangoIconConfig from "dangoui-icon-config";

const docsBaseUrl = "https://dumpling.echo.tech";
const introductionUrl = `${docsBaseUrl}/get-started/introduction`;
const tokenDocsUrl = `${docsBaseUrl}/guide/theme`;
const tokenPreviewLimit = 5;
const selectedStyleId = ref("dango");
const publishSyncOn = ref(true);
const publishWaitlistOn = ref(true);
const publishLimitOn = ref(false);
const publishSelectValue = ref("notice");
const genericSelectValue = ref("option-a");
const calendarDateTimeVisible = ref(false);
const calendarSelectedDate = ref(dayjs("2026-06-29 20:00"));
const calendarDateTimeText = computed(() => calendarSelectedDate.value.format("YYYY-MM-DD HH:mm"));
function handleCalendarDateTimeConfirm(payload) {
  calendarSelectedDate.value = payload.date || payload.value || calendarSelectedDate.value;
  calendarDateTimeVisible.value = false;
}
const starterTemplates = [
  {
    side: "分发侧",
    name: "内容分发模板",
    goal: "把服务端内容按推荐、搜索、分类和运营位送到用户面前，适合首页、活动列表、商品流和内容 feed。",
    parts: "NavigationBar / HeroHeader / Swiper / TabBar / Grid / List / FeedSPU / FAB",
  },
  {
    side: "展示侧",
    name: "数据展示模板",
    goal: "承接服务器数据输出，把用户、状态、图片、指标、进度和空结果展示清楚。",
    parts: "NavigationBar / Image / Badge / Avatar / Swiper / Grid / Steps / SPU / Rate",
  },
  {
    side: "发布侧",
    name: "数据发布模板",
    goal: "承接用户输入并提交到服务器，适合报名、资料编辑、配置发布和内容创建。",
    parts: "FormItem / Input / Textarea / Radio / Checkbox / Switch / Upload / Picker",
  },
  {
    side: "通用反馈",
    name: "轻量到重量反馈模板",
    goal: "按打扰程度组织反馈：轻量提示常驻，中量状态占位，重量弹层需要用户决策。",
    parts: "NoticeBar / Snackbar / Toast / Dialog / Popup / Dropdown / Empty / Skeleton",
  },
];
const activeDocs = [
  {
    kind: "资产架构",
    title: "长期资产怎么存",
    file: "brand-dtcg-migration-asset-standard.md",
  },
  {
    kind: "执行流程",
    title: "Codex 什么时候做什么",
    file: "skills/brand/SKILL.md",
  },
  {
    kind: "判定规则",
    title: "如何避免 AI 主观漂移",
    file: "mapping-rules.md",
  },
  {
    kind: "输出格式",
    title: "交付给设计/研发/产品看什么",
    file: "output-template.md",
  },
];
const workflowSteps = ["看 docs 入口", "选模板", "查组件", "追 token chain", "生成 adapter", "demo 验证"];
const baseStylePresets = [
  {
    id: "dango",
    label: "DangoUI",
    icon: "/assets/site-icons/dango.ico",
    source: "dumpling.echo.tech / 初始化状态",
    hero: "DangoUI",
    notice: "未应用品牌迁移的 DangoUI baseline：组件结构、默认 token 和普通边界保持原样，用来判断后续风格化覆盖了什么。",
    evidenceNote: "这是 baseline，不来自外部品牌采样；直接展示 token 结构，不做频次统计，用于对照 Button、Card、Divider、Tabs 等组件在未风格化时的默认语义和可编辑面。",
    sectionTitle: "Default Components",
    tabs: ["组件", "Token", "状态"],
    cards: [
      { title: "原始组件语义", copy: "先识别 dangoui 组件本身：Card 承载内容、Divider 组织层级、Button 表达行动，不急着加入品牌纹理。" },
      { title: "未覆盖状态", copy: "圆角、弱文字、--du-border-1 和主色都保持初始化 token，作为对比迁移后变化的参照物。" },
    ],
    tokens: [
      { name: "--du-bg-2", value: "#f7f7f9" },
      { name: "--du-bg-1", value: "#ffffff" },
      { name: "--du-text-1", value: "#000000e0" },
      { name: "--du-text-2", value: "#000000a6" },
      { name: "--du-text-3", value: "#00000066" },
      { name: "--du-border-1", value: "#0000001f" },
      { name: "--du-primary-color", value: "#7c66ff" },
      { name: "--du-primary-border", value: "#7c66ff" },
      { name: "--du-primary-outline-color", value: "#7c66ff" },
      { name: "--du-primary-soft-bg", value: "#f2f0ff" },
      { name: "--du-primary-solid-bg", value: "#7c66ff" },
    ],
    style: {
      cardRadius: "8px",
      controlRadius: "8px",
      pageSpacing: "16px",
      cardShadow: "0 1px 2px rgba(17,17,20,.06)",
      media: "linear-gradient(135deg,#ffffff,#f7f7f9 56%,#f2f0ff)",
    },
    signals: [
      { raw: "#ffffff", count: 1, percent: "baseline", target: "--du-bg-1", value: "默认组件表面" },
      { raw: "#f7f7f9", count: 1, percent: "baseline", target: "--du-bg-2", value: "默认页面背景" },
      { raw: "#000000e0", count: 1, percent: "baseline", target: "--du-text-1", value: "默认主文本" },
      { raw: "#00000066", count: 1, percent: "baseline", target: "--du-text-3", value: "浅底弱文本；深色品牌迁移时必须被主题弱文本覆盖" },
      { raw: "#0000001f", count: 1, percent: "baseline", target: "--du-border-1", value: "默认 Divider / Card boundary" },
      { raw: "#7c66ff", count: 1, percent: "baseline", target: "--du-primary-color", value: "默认 primary action" },
    ],
  },
  {
    id: "czn",
    label: "CZN",
    icon: "/assets/site-icons/czn.ico",
    source: "czn.qq.com / 待截图校准",
    hero: "Combat Zone",
    notice: "沉浸式游戏工具风格：橙色主行动、黑紫角色页、白灰资讯区和 HUD 式斜切边界。",
    evidenceNote: "依据官网 CSS / 素材校准：导航激活、下载按钮和 forward 轮播描边使用 #ff5514；forward 文案卡使用图片背景 + 橙标题 + 白正文；角色页大面积黑紫/深红。",
    sectionTitle: "Game Toolkit",
    tabs: ["任务", "战绩", "装备"],
    cards: [
      { title: "战术面板", copy: "保持 dangoui 组件结构，换成深色底、亮橙行动入口和高对比信息层级。" },
      { title: "沉浸式工具", copy: "霓虹媒体面、HUD 边界和状态标签作为 demo 视觉控制，不伪装成正式 token。" },
    ],
    tokens: [
      { name: "--du-bg-2", value: "#0b0710" },
      { name: "--du-bg-1", value: "#17111f" },
      { name: "--du-text-1", value: "#fff7f0" },
      { name: "--du-text-3", value: "#a79daa" },
      { name: "--du-border-1", value: "#3a2b3f" },
      { name: "--du-primary-color", value: "#ff5514" },
      { name: "--du-primary-border", value: "#ff5514" },
      { name: "--du-primary-outline-color", value: "#ff5514" },
      { name: "--du-primary-soft-bg", value: "#32180f" },
      { name: "--du-primary-solid-bg", value: "#ff5514" },
      { name: "--du-default-6", value: "#a79daa" },
      { name: "--du-default-8", value: "#fff7f0" },
    ],
    style: {
      cardRadius: "10px",
      controlRadius: "0px",
      pageSpacing: "16px",
      cardShadow: "0 20px 50px rgba(0,0,0,.45), 0 0 28px rgba(32,216,255,.16)",
      media: "linear-gradient(135deg, transparent 0 18%, rgba(255,90,31,.92) 18% 20%, transparent 20% 58%, rgba(255,255,255,.28) 58% 59%, transparent 59%), radial-gradient(circle at 24% 18%, rgba(255,90,31,.95), transparent 25%), radial-gradient(circle at 76% 68%, rgba(151,71,255,.78), transparent 30%), repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 14px), linear-gradient(135deg,#12070b,#251038 48%,#5a0f1d)",
    },
    signals: [
      { raw: "#ff5514", count: 6, percent: "约 30%", target: "--du-primary-color", value: "首页导航、官网按钮、下载 CTA、轮播描边" },
      { raw: "#0b0710", count: 4, percent: "约 20%", target: "--du-bg-2", value: "角色页黑紫沉浸底" },
      { raw: "#17111f", count: 4, percent: "约 20%", target: "--du-bg-1", value: "HUD / 卡片表面" },
      { raw: "#fff7f0", count: 3, percent: "约 15%", target: "--du-text-1", value: "大标题、按钮文字、高对比文本" },
      { raw: "#a79daa", count: 3, percent: "约 15%", target: "--du-text-3", value: "导航副文案、角色说明、弱信息" },
    ],
  },
  {
    id: "hpma",
    label: "HPMA",
    icon: "/assets/site-icons/hpma.ico",
    source: "官网 HTML/CSS + 截图采样",
    hero: "Magic Awakened",
    notice: "棕黑羊皮纸、古铜金边、白金标题和手绘魔法场景被拆成 dangoui token 与 demo-only 媒体资产两层。",
    evidenceNote: "频次来自官网主 CSS 的 UI 色值引用，共 115 次；另用官网分享图、游戏特色图、角色卡和壁纸做图片采样，只作为媒体资产口径。金棕 CTA、羊皮纸文字和深棕面板进入 dangoui token；学院场景、角色插画、魔法蓝光和华丽边框留在 demoOnlyVisualControls。",
    sectionTitle: "Wizarding Desk",
    tabs: ["录取", "课程", "卡牌"],
    cards: [
      { title: "入学信面板", copy: "用 Card 承接羊皮纸式内容面板，文字和边界使用棕金 token，装饰纹理只作为 demo 背景。" },
      { title: "魔咒卡组", copy: "媒体图、卡牌框、魔法光效和角色插画属于品牌资产层，不写入正式 dangoui token。" },
    ],
    tokens: [
      { name: "--du-bg-2", value: "#221b15" },
      { name: "--du-bg-1", value: "#493832" },
      { name: "--du-text-1", value: "#f4eedc" },
      { name: "--du-text-2", value: "#e9d9c5" },
      { name: "--du-text-3", value: "#c8b08b" },
      { name: "--du-border-1", value: "#8e6140" },
      { name: "--du-primary-color", value: "#996540" },
      { name: "--du-primary-border", value: "#8e6140" },
      { name: "--du-primary-outline-color", value: "#c8b08b" },
      { name: "--du-primary-soft-bg", value: "#2f241b" },
      { name: "--du-primary-solid-bg", value: "#996540" },
      { name: "--du-default-6", value: "#c8b08b" },
      { name: "--du-default-8", value: "#f4eedc" },
    ],
    style: {
      cardRadius: "0px",
      controlRadius: "0px",
      pageSpacing: "16px",
      cardShadow: "0 20px 48px rgba(0,0,0,.42), inset 0 0 0 1px rgba(200,176,139,.22)",
      media: "radial-gradient(circle at 72% 24%, rgba(96,172,190,.78), transparent 13%), radial-gradient(circle at 32% 36%, rgba(239,204,92,.72), transparent 15%), linear-gradient(135deg, rgba(20,19,16,.92), rgba(73,56,50,.92) 46%, rgba(153,101,64,.82)), repeating-linear-gradient(45deg, rgba(244,238,220,.14) 0 1px, transparent 1px 18px)",
      fontDisplay: "uifont_cn_title",
      fontNav: "navfont",
      iconSystem: "image-asset buttons + diamond bullets",
      borderFrame: "ornate gold corner frame / media_border asset",
    },
    signals: [
      { raw: "#6a3611", count: 12, percent: "10.4%", target: "--du-primary-border", value: "官网 CSS 高频古铜棕，承接边界/强调" },
      { raw: "#ffffff / #fefefe", count: 13, percent: "11.3%", target: "--du-text-1 / --du-white-*", value: "Logo、亮标题、反相文字" },
      { raw: "#696a75", count: 8, percent: "7%", target: "--du-text-3", value: "输入 placeholder / 弱信息" },
      { raw: "#523c2e", count: 7, percent: "6.1%", target: "--du-bg-1", value: "深棕面板/弹层表面" },
      { raw: "#e9d9c5", count: 6, percent: "5.2%", target: "--du-text-1", value: "羊皮纸高亮文字" },
      { raw: "#c8b08b", count: 4, percent: "3.5%", target: "--du-text-3", value: "金色标签、媒体导航文字" },
      { raw: "手绘场景/角色/魔法蓝光", count: 6, percent: "图片采样", target: "demoOnlyVisualControls", value: "霍格沃茨街景、角色卡、飞贼、光效" },
      { raw: "uifont_cn_title / navfont", count: 2, percent: "字体资产", target: "demoOnlyVisualControls", value: "官网字体包，用于标题和导航，不进入 dangoui token" },
      { raw: "media_border / top_nav_h / button png", count: 6, percent: "图片资产", target: "demoOnlyVisualControls", value: "装饰边框、导航高亮、按钮/icon 图片" },
    ],
  },
  {
    id: "re1999",
    label: "1999",
    icon: "/assets/site-icons/re1999.ico",
    source: "re.bluepoch.com/home / HTML + CSS",
    hero: "Reverse:1999",
    notice: "20 世纪复古神秘学 RPG 官网风格：黑底、暖纸、古铜橙、衬线标题、档案式资讯框和角色文件感。",
    evidenceNote: "频次来自官网 CSS 色值引用口径；#B55829 是最高频强调色，#BBA893/#E9DCCD 承接复古纸面文字，#131818/#000000 承接深色站点底。",
    sectionTitle: "Arcane Archive",
    tabs: ["首页", "资讯", "档案"],
    cards: [
      { title: "暴雨档案", copy: "NavigationBar、Card、Tag 和 Button 保持 dangoui 结构，外层换成复古档案站的深色纸面与古铜边界。" },
      { title: "角色文件", copy: "角色介绍、资讯轮播和下载面板分别作为三个样板页，不把插画资产误写成正式 token。" },
    ],
    tokens: [
      { name: "--du-bg-2", value: "#000000" },
      { name: "--du-bg-1", value: "#131818" },
      { name: "--du-text-1", value: "#E9DCCD" },
      { name: "--du-text-2", value: "#BBA893" },
      { name: "--du-text-3", value: "#BBA893" },
      { name: "--du-border-1", value: "#45392F" },
      { name: "--du-primary-color", value: "#B55829" },
      { name: "--du-primary-border", value: "#B55829" },
      { name: "--du-primary-outline-color", value: "#db6f39" },
      { name: "--du-primary-soft-bg", value: "#2a160f" },
      { name: "--du-primary-solid-bg", value: "#B55829" },
      { name: "--du-default-6", value: "#BBA893" },
      { name: "--du-default-8", value: "#E9DCCD" },
    ],
    style: {
      cardRadius: "0px",
      controlRadius: "0px",
      pageSpacing: "16px",
      cardShadow: "none",
      media: "radial-gradient(circle at 72% 28%, rgba(219,111,57,.34), transparent 18%), radial-gradient(circle at 30% 18%, rgba(187,168,147,.18), transparent 22%), repeating-linear-gradient(90deg, rgba(233,220,205,.05) 0 1px, transparent 1px 18px), linear-gradient(135deg,#090909,#131818 52%,#45392f)",
    },
    signals: [
      { raw: "#B55829", count: 10, percent: "约 23%", target: "--du-primary-color / --du-primary-border", value: "导航激活、分隔线、资讯标签、框体强调" },
      { raw: "#BBA893", count: 6, percent: "约 14%", target: "--du-text-2 / --du-text-3", value: "导航弱文字、正文说明、角色副文案" },
      { raw: "#000000", count: 4, percent: "约 9%", target: "--du-bg-2", value: "站点深色底和大面积黑场" },
      { raw: "#db6f39", count: 3, percent: "约 7%", target: "--du-primary-outline-color", value: "高亮橙、hover/active 辅助强调" },
      { raw: "#E9DCCD", count: 2, percent: "约 5%", target: "--du-text-1", value: "暗底标题、主导航文本" },
      { raw: "#45392F", count: 2, percent: "约 5%", target: "--du-border-1", value: "资讯列表边界、档案框线" },
      { raw: "SourceHanSerifCN / cn", count: 2, percent: "字体资产", target: "demoOnlyVisualControls", value: "复古衬线标题与无衬线正文，不写入 dangoui token" },
      { raw: "paper / role / first visual assets", count: 5, percent: "图片资产", target: "demoOnlyVisualControls", value: "档案纸张、角色图和首屏插画只作为页面 CSS" },
    ],
  },
];
const runtimeBrandPreviews = ref([]);
const runtimeStyleRecipeDetails = ref({});
const runtimeDemoPagesByStyle = ref({});

const stylePresets = computed(() => {
  const seen = new Set();
  return [...runtimeBrandPreviews.value, ...baseStylePresets]
    .filter((preset) => {
      if (!preset?.id || seen.has(preset.id)) return false;
      seen.add(preset.id);
      return true;
    });
});
const componentDocs = {
  Avatar: `${docsBaseUrl}/data-display/avatar`,
  Badge: `${docsBaseUrl}/data-display/badge`,
  NavigationBar: `${docsBaseUrl}/navigation/navigation-bar`,
  Card: `${docsBaseUrl}/data-display/card`,
  Checkbox: `${docsBaseUrl}/form/checkbox`,
  Divider: `${docsBaseUrl}/data-display/divider`,
  Empty: `${docsBaseUrl}/feedback/empty`,
  Input: `${docsBaseUrl}/form/input`,
  NoticeBar: `${docsBaseUrl}/feedback/notice-bar`,
  Radio: `${docsBaseUrl}/form/radio`,
  Rate: `${docsBaseUrl}/form/rate`,
  Search: `${docsBaseUrl}/form/search`,
  Stepper: `${docsBaseUrl}/form/input-number`,
  Skeleton: `${docsBaseUrl}/feedback/skeleton`,
  Popup: `${docsBaseUrl}/feedback/popup`,
  Upload: `${docsBaseUrl}/form/upload`,
  Steps: `${docsBaseUrl}/data-display/steps`,
  Tabs: `${docsBaseUrl}/data-display/tabs`,
  Tab: `${docsBaseUrl}/data-display/tabs`,
  Tag: `${docsBaseUrl}/data-display/tag`,
  Textarea: `${docsBaseUrl}/form/textarea`,
  Button: `${docsBaseUrl}/general/button`,
  Switch: `${docsBaseUrl}/form/switch`,
};
const feedPreviewItems = [
  {
    type: "swipe",
    title: "今日主推资源位",
    author: "运营精选",
    likes: 256,
    estimatedHeight: 236,
  },
  {
    type: "image",
    title: "周末开箱：把新入手的挂件塞进行李牌",
    tag: "开箱",
    tagColor: "primary",
    spu: "Labubu 搪胶挂件",
    rating: 4.5,
    author: "岛民 Jocelyn",
    likes: 128,
    price: "¥128",
    estimatedHeight: 210,
  },
  {
    type: "video",
    title: "拆盒现场：这一套隐藏款值得蹲吗",
    tag: "视频",
    tagColor: "secondary",
    spu: "Skullpanda 手办",
    rating: 4,
    author: "小岛收藏家",
    likes: 86,
    price: "¥299",
    estimatedHeight: 258,
  },
  {
    type: "text",
    title: "给新手的入坑清单：预算、尺寸和保养",
    tag: "攻略",
    tagColor: "success",
    spu: "入门收藏套装",
    rating: 5,
    author: "运营精选",
    likes: 342,
    price: "¥68",
    estimatedHeight: 194,
  },
  {
    type: "image-alt",
    title: "同城交换记录：把重复款换成心愿款",
    tag: "交换",
    tagColor: "default",
    spu: "心愿交换卡",
    rating: 4.5,
    author: "换物小队",
    likes: 57,
    price: "¥0",
    estimatedHeight: 224,
  },
  {
    type: "image",
    title: "夏日市集摊位实拍：这组透明收纳盒很适合出摊",
    tag: "晒单",
    tagColor: "primary",
    author: "市集观察员",
    likes: 76,
    estimatedHeight: 204,
  },
  {
    type: "text",
    title: "活动前一天检查表：物料、价格牌、备货和群公告",
    tag: "清单",
    tagColor: "success",
    author: "运营精选",
    likes: 214,
    estimatedHeight: 182,
  },
  {
    type: "video",
    title: "二手区一分钟巡场：热门款价格变化很明显",
    tag: "二手",
    tagColor: "secondary",
    author: "买手阿岛",
    likes: 93,
    estimatedHeight: 252,
  },
  {
    type: "image-alt",
    title: "抽一手现场：隐藏款被抽中的那个瞬间",
    tag: "活动",
    tagColor: "default",
    author: "活动小助手",
    likes: 168,
    estimatedHeight: 218,
  },
];
const feedPreviewColumns = computed(() => {
  const columns = [[], []];
  const heights = [0, 0];

  feedPreviewItems.forEach((item) => {
    const targetIndex = heights[0] <= heights[1] ? 0 : 1;
    columns[targetIndex].push(item);
    heights[targetIndex] += item.estimatedHeight;
  });

  return columns;
});
const spuPreviewItems = [
  { tag: "潮玩挂件", name: "Labubu 搪胶挂件", rating: 9.0, desc: "224万 想要" },
  { tag: "手办", name: "Skullpanda 午夜剧场", rating: 8.6, desc: "98万 想要" },
  { tag: "盲盒", name: "Molly 周年限定款", rating: 9.2, desc: "312万 想要" },
  { tag: "配件", name: "收藏展示盒", rating: 8.0, desc: "56万 想要" },
  { tag: "徽章", name: "星星徽章套装", rating: 8.8, desc: "73万 想要" },
  { tag: "娃包", name: "透明随身娃包", rating: 8.4, desc: "41万 想要" },
  { tag: "挂绳", name: "彩虹编织挂绳", rating: 8.2, desc: "28万 想要" },
];
const editableByComponent = {
  Avatar: ["头像内容", "类型", "尺寸", "边框", "角标"],
  Badge: ["数值", "颜色", "红点", "最大值"],
  NavigationBar: ["标题", "返回按钮", "右侧动作", "背景", "固定/透明状态"],
  Card: ["图片", "标题", "标签", "摘要", "圆角", "阴影"],
  Checkbox: ["选中状态", "形状", "文案", "颜色", "禁用状态"],
  Divider: ["方向", "长度", "颜色", "文案"],
  Empty: ["空状态文案", "按钮文案", "插图", "动作"],
  Input: ["值", "占位文案", "前缀", "后缀", "边框"],
  Radio: ["选中状态", "文案", "颜色", "禁用状态"],
  Rate: ["分值", "数量", "尺寸", "颜色", "半选"],
  Search: ["占位文案", "只读/输入态", "背景", "右侧动作"],
  IconButton: ["图标", "点击热区", "右侧动作"],
  Skeleton: ["加载态", "骨架结构", "尺寸"],
  Spin: ["加载状态", "尺寸", "文案", "局部/全局范围"],
  Steps: ["步骤列表", "当前步骤", "状态", "颜色"],
  NoticeBar: ["提示文案", "链接文案", "色彩", "关闭按钮"],
  Tabs: ["标签项", "激活项", "样式类型", "激活色"],
  Tag: ["文案", "状态色", "圆角", "边框"],
  Button: ["按钮文案", "类型", "尺寸", "全宽", "禁用/加载状态"],
  Switch: ["开关状态", "颜色", "禁用状态"],
  Textarea: ["值", "占位文案", "字数统计", "边框"],
  DateTimePicker: ["日期", "时间", "最小/最大值", "确认文案"],
  FAB: ["位置", "图标", "前景色", "阴影", "显隐侧"],
  Feed: ["双列内容流", "封面", "标题", "作者互动"],
  FormItem: ["标签", "必填", "提示", "字段插槽", "底线"],
  Grid: ["列数", "图标/图片", "文案", "间距"],
  Group: ["标题", "分组说明", "字段列表", "间距"],
  HeroHeader: ["主视觉", "标题", "副标题", "行动入口", "安全区"],
  List: ["行内容", "右侧动作", "分隔线", "状态"],
  Popover: ["触发点", "浮层内容", "方向", "关闭方式"],
  PriceStatistic: ["价格", "指标", "单位", "趋势"],
  Popup: ["打开状态", "位置", "遮罩", "关闭方式"],
  ResultPage: ["结果状态", "主文案", "辅助文案", "下一步动作"],
  ShareSheet: ["渠道", "布局", "取消动作", "业务回调"],
  SPU: ["商品模型", "状态标签", "业务字段"],
  Stepper: ["数值", "最小/最大值", "步进", "禁用态"],
  SegmentControl: ["选中项", "分段项", "尺寸", "激活色"],
  Swipe: ["3:4 图片", "当前项", "滑动坑位", "指示器"],
  Swiper: ["图片列表", "当前项", "自动播放", "指示器"],
  Time: ["日期", "时间", "倒计时", "时区"],
  Tips: ["提示内容", "触发方式", "语气", "位置"],
  Toast: ["文案", "类型", "时长", "触发动作"],
  Upload: ["文件类型", "数量限制", "上传状态", "回调"],
  DownloadPanel: ["下载入口", "平台", "二维码", "福利信息"],
  QRCode: ["二维码", "说明文案", "下载动作"],
  CharacterPanel: ["角色名", "角色立绘", "语音", "档案卡片"],
  TabBar: ["选中项", "图标", "文字", "激活色", "底部分隔线"],
  BottomBar: ["固定位置", "安全区", "操作按钮", "背景"],
  Menu: ["菜单项", "层级", "选中项", "展开状态"],
};
const friendlyDescriptions = {
  Avatar: "头像组件，用来展示用户、团队或身份标识。",
  Badge: "徽标组件，用来显示数量、红点或状态提醒。",
  NavigationBar: "页面顶部导航，负责标题、返回/分享等顶部动作。",
  Search: "搜索入口，让用户按关键词查找活动、内容或配置项。",
  NoticeBar: "页面公告条，用来提示运营状态、风险或待处理事项。",
  Tabs: "内容分组切换，用来在热门、最新、运营推荐等列表间切换。",
  Tag: "状态或分类标签，用短文案标记主推、已配置、待审核等状态。",
  Card: "内容承载容器，适合放图片、标题、摘要和操作信息。",
  Button: "主要操作入口，例如发布、保存、确认。",
  Checkbox: "多选控件，用来表达多个可同时启用的选项。",
  Divider: "分割线组件，用来组织区域和视觉层级。",
  Empty: "空状态组件，用来表达暂无内容或未命中结果。",
  Input: "单行输入控件，用来输入名称、关键词或配置值。",
  Radio: "单选控件，用来表达互斥选项。",
  Rate: "评分控件，用来展示满意度或反馈分数。",
  Skeleton: "骨架屏组件，用来表达加载中的内容结构。",
  Spin: "加载指示器，用于局部等待或轻量异步状态。",
  Steps: "步骤组件，用来展示流程阶段和当前进度。",
  Switch: "开关设置，用来表达启用/关闭一类配置。",
  Swiper: "轮播组件，用来展示多张图片、运营 Banner 或可横滑内容。",
  Textarea: "多行文本输入控件，用来输入描述、说明或备注。",
  DateTimePicker: "日期时间选择器，用来输入预约、发布、截止等时间字段；当前由 DangoUI Calendar 的 showTimePicker 模式承接。",
  Group: "表单分组，用来把一组相关输入项组织在同一语义区域。",
  Popup: "弹层组件，用来承载需要临时浮出的内容或操作。底部弹层按内容量选择 30% / 60% / 88% 三档高度：轻选择用 30%，层级选择/筛选用 60%，重内容详情用 88%。",
  Upload: "上传组件，用来把图片、文件或素材提交到服务器。",
  DownloadPanel: "下载入口面板，聚合 PC、移动端、二维码和平台下载动作。",
  QRCode: "扫码下载模块，用来承接移动端下载或预约转换。",
  CharacterPanel: "角色详情面板，展示角色名、语音、立绘、技能卡片和查看更多动作。",
  FAB: "悬浮动作入口，当前作为 app shell 自定义样式处理，DangoUI 暂无独立 FAB。",
  IconButton: "只放图标的轻量动作入口，常放在 NavigationBar 右侧承接刷新、扫码、更多等操作。",
  Feed: "Feed 是内容流场景：多张内容卡双列排列，卡内只承接封面、标题、作者和互动数据。",
  FormItem: "表单字段行组件，用来承接标签、必填、提示和输入插槽。",
  Grid: "宫格入口通常是业务布局，当前由页面 CSS 或业务组件承接。",
  HeroHeader: "首屏主视觉包裹组件，图片层可由 DuImage 承接，但安全区、内容层、遮罩和行动区仍需要 HeroHeader 规范。",
  List: "列表是基础业务布局，DangoUI 当前没有独立 List 组件。",
  Popover: "轻量浮层说明，DangoUI 当前没有独立 Popover，可由 Tooltip/Popup 或业务组件替代。",
  PriceStatistic: "价格和指标统计属于业务展示组件，DangoUI 当前没有直接组件。",
  ResultPage: "结果页属于页面模板，可由 Empty、Icon、Button 等组合。",
  ShareSheet: "分享面板可由 ActionSheet 承接，分享渠道和回调属于业务。",
  SPU: "SPU 是商品模型组件，常以横滑商品卡承接商品图、名称、评分、状态和业务字段。",
  Swipe: "Swipe 是 Feed 首坑的 3:4 图片滑动资源位，用 DangoUI Swiper 能力承接，但在业务场景里不脱离内容流。",
  Stepper: "Stepper 是业务叫法，生产代码用 DangoUI 的 DuInputNumber 承接；后续清单里归为命名/文档口径待更新，不是组件待新增。",
  SegmentControl: "分段控制器需要 DangoUI 新增正式组件或命名规范。",
  Time: "时间/倒计时展示属于业务格式化组件，DangoUI 当前没有独立 Time。",
  Tips: "字段提示可由 FormItem tips 或 Tooltip 承接，独立 Tips 仍是缺口。",
  Toast: "DangoUI 提供 ToastProvider/useToast，但不是独立可见组件。",
  TabBar: "页面底部一级导航。当前 dangoui 没有内置 TabBar，需要后续补 schema。",
  BottomBar: "底部操作栏需要 DangoUI 新增正式组件或命名规范。",
  Menu: "菜单组件需要 DangoUI 新增正式组件或命名规范。",
};
const distributionFriendlyDescriptions = {
  NavigationBar: "用户进页面先看这里：告诉他当前在哪一页、能不能返回、能不能搜索。活动页、专题页、内容流都需要一个稳定顶部。",
  Search: "当内容、商品、活动入口变多时，用搜索帮用户直接找目标；运营也能把搜索词当成用户需求信号。",
  HeroHeader: "分发侧最像海报的首屏：用一张主视觉、一句卖点和一个行动入口，把用户立刻带进活动或内容主题。",
  Image: "图片不是装饰位，而是内容证据：展示商品封面、活动主图、角色图或专题视觉，让用户先被画面吸引。",
  Swiper: "轮播适合承接多张主推 Banner：首屏资源位、活动合集、版本更新、专题入口都可以放这里。",
  TabBar: "底部一级入口，让用户在首页、发现、我的这类高频页面间切换；它是 app shell，不是内容卡片。",
  Grid: "宫格是快捷入口区：把活动、商品、任务、资讯这些高频动作排成一眼能扫完的入口。",
  List: "列表适合承接持续更新的信息流：公告、攻略、资源位、推荐内容，重点是标题清楚、右侧状态明确。",
  Card: "卡片负责把一条运营内容包装完整：封面、标题、摘要、标签和行动按钮都能放进来。",
  Time: "时间让用户知道活动节奏：什么时候开始、什么时候截止、还剩多久，适合限时活动和预约节点。",
  PriceStatistic: "价格和指标用于刺激决策：价格、热度、折扣、库存、参与人数，都能帮助用户判断值不值得点。",
  Feed: "Feed 是双列内容流：适合首页持续分发帖子、攻略、开箱和内容推荐，不直接混入商品卡结构。",
  Rate: "评分在分发侧更像信任背书：告诉用户这个内容、商品或活动口碑如何，降低点击前的不确定。",
  FAB: "右下角悬浮的快速发布/创建入口，只在需要用户随时发起动作时出现，不要当普通内容块解释。",
  Tabs: "Tabs 用来给同一块内容分频道：推荐、最新、活动、攻略、热门，让用户不用离开页面就能换视角。",
  Button: "按钮是运营转化的最后一步：立即报名、查看详情、领取福利、去购买，文案要直接说清动作。",
  Tag: "标签帮用户快速扫重点：限时、主推、上新、已结束、热卖，把内容状态压缩成几个字。",
};
const displayFriendlyDescriptions = {
  NavigationBar: "展示侧的导航负责告诉用户正在看哪个对象，也提供返回上一层的路径，不承担首页导流。",
  Image: "图片在展示侧是对象本身的证据：商品图、角色图、媒体图、截图或档案图，帮助用户确认看到的是什么。",
  Avatar: "头像用来说明对象背后的身份：用户、作者、角色、团队或账号，让信息不只是冷冰冰的文字。",
  Badge: "徽标用于补充对象状态或数量：等级、未读数、星级、更新数，让关键信息一眼被看见。",
  Swiper: "展示侧的轮播不是资源位导流，而是同一个对象的多图/多视频浏览，比如图库、截图、PV、角色动作。",
  Popup: "Popup 用来展开当前对象的更多细节，例如图片大图、资料说明、筛选条件或临时操作。",
  List: "展示侧列表负责把对象的属性、记录或明细排清楚，例如资料项、订单明细、成就记录、服务状态。",
  Steps: "步骤条让用户知道当前对象处在哪个流程阶段，例如提交、审核、完成，适合进度和履约状态。",
  Time: "时间在展示侧用于说明对象的时间信息：创建、更新、同步、开始、结束或最近一次状态变化。",
  PriceStatistic: "价格和指标在展示侧用于解释对象价值：价格、评分、排名、库存、参与人数或核心数据。",
  Rate: "评分是对象口碑或质量信号，适合商品、内容、服务、活动反馈，不负责导流，只帮助判断。",
  Card: "展示侧 Card 是信息分组，把对象的参数、摘要、说明、媒体或状态整理成可读模块。",
  Tabs: "展示侧 Tabs 用来切对象的不同维度：详情、媒体、记录、评论，而不是切换资源频道。",
  Tag: "展示侧 Tag 标记对象属性：状态、分类、等级、身份、服务端结果，帮助用户理解对象。",
  Button: "展示侧 Button 是对当前对象执行动作：查看详情、收藏、分享、联系、继续处理。",
};
const componentChineseNames = {
  Avatar: "头像",
  Badge: "徽标",
  Button: "按钮",
  Card: "内容卡片",
  Checkbox: "复选框",
  Cascader: "级联选择",
  Dialog: "弹窗",
  Dropdown: "下拉筛选",
  Empty: "空状态",
  FAB: "悬浮按钮",
  Feed: "内容流",
  FormItem: "表单项",
  Grid: "宫格",
  HeroHeader: "首屏头图",
  Image: "图片",
  IconButton: "图标按钮",
  Input: "输入框",
  List: "列表",
  NavigationBar: "顶部导航",
  NoticeBar: "公告条",
  Popover: "气泡浮层",
  PriceStatistic: "价格指标",
  Rate: "评分",
  Radio: "单选框",
  ResultPage: "结果页",
  Search: "搜索",
  Select: "选择器",
  ShareSheet: "分享面板",
  Skeleton: "骨架屏",
  SPU: "商品",
  Swipe: "滑动资源位",
  Spin: "加载",
  Snackbar: "轻提示",
  SegmentControl: "分段控制",
  Stepper: "步进器 / InputNumber",
  Steps: "步骤条",
  Switch: "开关",
  Swiper: "轮播",
  TabBar: "底部导航栏",
  BottomBar: "底部操作栏",
  Tabs: "标签切换",
  Tag: "标签",
  Textarea: "多行输入",
  Time: "时间",
  Tips: "提示",
  Toast: "吐司",
  DateTimePicker: "日期时间",
  Group: "分组",
  Popup: "弹层",
  Upload: "上传",
  Menu: "菜单",
  DownloadPanel: "下载面板",
  QRCode: "二维码",
  CharacterPanel: "角色详情",
};

const componentDisplayNames = {
  NavigationBar: "Navigation Bar",
  Search: "Search",
  IconButton: "IconButton",
  Feed: "Feed",
  SPU: "SPU",
  Swipe: "Swipe",
  Tabs: "Tabs",
  SegmentControl: "SegmentControl",
  TabBar: "Tab Bar",
  BottomBar: "Bottom Bar",
  Menu: "Menu",
  PriceStatistic: "Price and Statistic",
  Swiper: "Swipe",
  Snackbar: "SnackBar",
  ShareSheet: "Sharesheet",
  ResultPage: "Result Page",
};

const componentSupportMap = {
  NavigationBar: "DangoUI",
  Search: "DangoUI",
  Card: "DangoUI",
  Image: "DangoUI",
  IconButton: "DangoUI",
  Badge: "DangoUI",
  Avatar: "DangoUI",
  Swiper: "DangoUI",
  Popup: "DangoUI",
  Steps: "DangoUI",
  Rate: "DangoUI",
  FormItem: "DangoUI",
  Input: "DangoUI",
  Textarea: "DangoUI",
  Radio: "DangoUI",
  Checkbox: "DangoUI",
  Switch: "DangoUI",
  Upload: "DangoUI",
  Stepper: "DangoUI 待更新",
  Cascader: "DangoUI",
  Select: "DangoUI",
  NoticeBar: "DangoUI",
  Snackbar: "DangoUI",
  Dialog: "DangoUI",
  Dropdown: "DangoUI",
  Empty: "DangoUI",
  Skeleton: "DangoUI",
  Tabs: "DangoUI",
  Button: "DangoUI",
  Tag: "DangoUI",
  Toast: "DangoUI 待更新",
  ShareSheet: "DangoUI 待更新",
  Tips: "DangoUI 待新增",
  SegmentControl: "DangoUI 待新增",
  HeroHeader: "DangoUI 待新增",
  Grid: "DangoUI 待新增",
  List: "DangoUI 待新增",
  Time: "DangoUI 待新增",
  PriceStatistic: "业务组件",
  Feed: "业务组件",
  SPU: "业务组件",
  Swipe: "DangoUI",
  FeedSpuTag: "业务组件",
  SpuTag: "业务组件",
  Group: "DangoUI",
  ResultPage: "DangoUI 待更新",
  FAB: "DangoUI 待新增",
  TabBar: "DangoUI 待新增",
  BottomBar: "DangoUI 待新增",
  Menu: "DangoUI 待新增",
  DateTimePicker: "DangoUI 待更新",
  Popover: "缺口",
  Spin: "缺口",
};

const catalog = ref({ source: {}, tokens: [], components: [], missingComponents: [] });
const selectedInstanceId = ref("");
const selectedComponent = ref("");
const selectedComponentCategoryId = ref("bar");
const selectedTokenName = ref("");
const tokensExpanded = ref(false);
const selectedTemplateId = ref("home");
const templateHistory = ref([]);
const selectedInspectorTab = ref("pages");
const selectedWorkspaceMode = ref("components");
const selectedStyleCategoryId = ref("");
const phoneRef = ref(null);
let isApplyingRoute = false;
const mockupScale = ref(1);
const mockupHoverLabel = ref("");
const mockupHoverStyle = ref({});
const activeStyleRecipeKey = ref("");
const styleEvidenceRef = ref(null);
const styleCategoryPulse = ref(false);
let phoneResizeObserver = null;
const re1999NewsTab = ref("news");
const re1999NewsTag = ref("notice");
const re1999ArchiveTab = ref("profile");
const re1999HomePanel = ref("news");
const re1999MediaTab = ref("pv");



const hpmaHomePanel = ref("news");
const hpmaNewsTab = ref("event");
const hpmaNewsTag = ref("event");
const hpmaCardTab = ref("spell");
const hpmaMediaTab = ref("video");
const cznHomePanel = ref("forward");
const cznMediaTab = ref("pv");
const copiedColorValue = ref("");
const snackbarMessage = ref("");
const snackbarOpen = ref(false);
const openEditableSelectKey = ref("");
const navExampleShowBack = ref(true);
const navExampleShowTitle = ref(true);
const navExampleShowSearch = ref(true);
const navExampleShowRight = ref(true);
const navExampleShowRefresh = ref(true);
const navExampleColor = ref("default");
const navigationColorOptions = [
  { label: "default", value: "default" },
  { label: "primary", value: "primary" },
  { label: "secondary", value: "secondary" },
  { label: "white", value: "white" },
];
const navigationAreaLeft = ref(true);
const navigationAreaDefault = ref(true);
const navigationAreaRight = ref(true);
const navigationSlotLeft = ref(true);
const navigationSlotScopedLeft = ref(false);
const navigationSlotDefault = ref(true);
const navigationSlotScopedDefault = ref(true);
const navigationSlotRight = ref(true);
const navigationSlotScopedRight = ref(false);
const navigationExampleTab = ref("discovery");
const navigationExamplePlaceholders = ["Molly", "Labubu", "Skullpanda"];
const searchExampleValue = ref("Labubu");
const tabsExampleDefault = ref("discovery");
const tabsExampleTag = ref("recommend");
const tabsExampleText = ref("all");
const componentExampleState = ref({
  active: true,
  disabled: false,
  bordered: true,
  rounded: true,
  searchPlaceholder: "rolling",
  tabsType: "default",
  tabsValue: "recommend",
  imageRadius: 10,
  textareaMaxlength: 80,
  stepperValue: 3,
  rateValue: 4,
  noticeType: "secondary",
  noticeColor: "primary",
  snackbarButtonColor: "white",
  showLabel: true,
  showHelper: true,
  showAction: true,
  showIcon: true,
  showMedia: true,
  showCount: true,
  showClose: true,
  calendarShowTimePicker: true,
  calendarSelectedDate: null,
  calendarSelectedTime: null,
});
let componentExamplePopup = ref(null);
const displayPopupVisible = ref(false);
let snackbarTimer = null;
let snackbarCloseTimer = null;

const re1999NewsCopy = {
  news: {
    items: [
      { title: "《重返未来：1999》版本更新公告", body: "维护完成后，司辰可前往领取补偿邮件。" },
      { title: "神秘学家征集概率说明", body: "限定征集、角色档案与活动说明同步更新。" },
      { title: "「暴雨」档案馆资料增补", body: "新增角色故事、影像资料和特别访谈。" },
    ],
  },
  notice: {
    items: [
      { title: "停服维护与资源更新说明", body: "维护期间暂不可登录，补偿将在开服后发放。" },
      { title: "客户端资源修复公告", body: "修复部分界面贴图、音频与档案页显示问题。" },
      { title: "账号安全提醒", body: "请通过官方渠道下载并绑定有效联系方式。" },
    ],
  },
  event: {
    items: [
      { title: "限时活动「旧雨新知」开启", body: "完成调查任务可获得活动代币与养成材料。" },
      { title: "角色试用关卡开放", body: "新增神秘学家试用与活动剧情挑战。" },
      { title: "签到奖励阶段更新", body: "连续登录可领取纯雨滴和启寤材料。" },
    ],
  },
  media: {
    items: [
      { title: "版本 PV 正式公开", body: "穿过暴雨之后，新的时代影像正在展开。" },
      { title: "开发组访谈：档案与叙事", body: "制作组分享角色文本、影像资料与时代设定。" },
      { title: "官方壁纸资源追加", body: "移动端与桌面端壁纸已加入资料库。" },
    ],
  },
};

const re1999HomePanels = {
  news: {
    kicker: "FEATURED RECORD",
    title: "暴雨档案馆开放",
    body: "首页直接露出资讯、角色和世界观内容，让访客先进入叙事，再选择下一步。",
    primaryTag: "版本情报",
    secondaryTag: "角色档案",
    galleryKicker: "VISUAL INDEX",
    galleryTitle: "时代影像",
    galleryBody: "用插画资产承担首页展示侧，而不是下载入口。",
  },
  archive: {
    kicker: "ARCANIST FILE",
    title: "神秘学家资料入库",
    body: "角色入口承接身份、星级、阵营和访谈摘要，让首页具备档案分发能力。",
    primaryTag: "角色文件",
    secondaryTag: "阵营记录",
    galleryKicker: "CASE PREVIEW",
    galleryTitle: "维尔汀档案",
    galleryBody: "角色立绘与纸面资料作为展示侧资产，适合继续进入档案页。",
  },
  media: {
    kicker: "MEDIA ROOM",
    title: "影像资料公开",
    body: "媒体入口展示 PV、壁纸、访谈与图库资源，保留官网的电影感和美术叙事。",
    primaryTag: "版本 PV",
    secondaryTag: "图库壁纸",
    galleryKicker: "GALLERY",
    galleryTitle: "暴雨影像集",
    galleryBody: "把插画、剧照和装饰资产放进首页展示侧，强化可浏览的媒体区。",
  },
};

const re1999MediaCopy = {
  pv: {
    kicker: "VERSION PV",
    title: "暴雨将至",
    items: ["版本预告影像", "主视觉分镜"],
    noteTitle: "PV 承接方式",
    noteBody: "用大画面、暗场渐变和古铜角线承接视频封面，不把视频区域降级成普通卡片。",
    tags: ["PV 封面", "电影感"],
  },
  gallery: {
    kicker: "GALLERY",
    title: "时代切片",
    items: ["角色壁纸", "场景美术"],
    noteTitle: "图库承接方式",
    noteBody: "图库页重点保留横向大图、缩略图节奏和纸面档案信息，不只展示图片路径。",
    tags: ["图库", "壁纸"],
  },
  interview: {
    kicker: "INTERVIEW",
    title: "档案访谈",
    items: ["制作组访谈", "神秘学家记录"],
    noteTitle: "访谈承接方式",
    noteBody: "访谈内容以档案条目、时间戳和影像缩略图组合呈现，和 NEWS 列表拉开差异。",
    tags: ["访谈", "档案"],
  },
};

const re1999NewsTagCopy = {
  notice: "筛选公告：列表更偏维护、版本说明和系统通知。",
  role: "筛选角色：列表更偏神秘学家档案、征集与试用。",
  event: "筛选活动：列表更偏任务、签到和限时奖励。",
};







const hpmaNewsCopy = {
  event: {
    items: [
      { title: "禁林调查限时开启", body: "羊皮纸列表用于承接资讯摘要、日期和跳转入口。" },
      { title: "舞会邀请函已送达", body: "完成课堂与舞会任务可领取赛季奖励。" },
    ],
  },
  news: {
    items: [
      { title: "魔法觉醒赛季更新", body: "新增伙伴卡、课堂玩法与社团活动内容。" },
      { title: "伙伴卡平衡性调整", body: "细金线分隔比普通卡片边框更贴近官网资讯区。" },
    ],
  },
  notice: {
    items: [
      { title: "学院活动维护公告", body: "维护完成后将通过邮件发放补偿奖励。" },
      { title: "资源包下载提示", body: "建议在稳定网络下更新最新魔法资源。" },
    ],
  },
};

const hpmaHomePanels = {
  news: {
    kicker: "OWL POST",
    title: "魔法资讯活动",
    body: "资讯入口承接公告、活动和赛季更新，用羊皮纸列表与金线分隔表现官网信息流。",
    primaryTag: "资讯",
    secondaryTag: "活动",
    galleryKicker: "NOTICE BOARD",
    galleryTitle: "公告栏",
    galleryBody: "公告入口应进入资讯页，不停留在首页内部预览。",
  },
  cards: {
    kicker: "SPELL BOOK",
    title: "魔咒&伙伴介绍",
    body: "源站第四项是魔咒&伙伴介绍，书页、卡牌弹层和点击提示比普通列表更重要。",
    primaryTag: "魔咒卡",
    secondaryTag: "伙伴卡",
    galleryKicker: "CARD INDEX",
    galleryTitle: "书页卡片",
    galleryBody: "这里的装饰来自 book/pop_card 一类图片，不用通用角线替代。",
  },
  media: {
    kicker: "MEDIA CENTER",
    title: "魔法媒体资料",
    body: "媒体入口承接 PV、壁纸和专题资料，用暗场大图与金线角标保留影像区识别。",
    primaryTag: "PV",
    secondaryTag: "壁纸",
    galleryKicker: "GALLERY FRAME",
    galleryTitle: "视听中心",
    galleryBody: "大图需要使用对应画框/裁切，不把边框泛化给所有卡片。",
  },
};

const hpmaMediaCopy = {
  video: {
    kicker: "TRAILER",
    title: "赛季预告影像",
    items: ["禁林调查 PV", "学院舞会预告"],
    noteTitle: "视频封面",
    noteBody: "保持暗场大图、金线角标和羊皮纸标题，避免变成普通图片卡。",
    tags: ["PV", "赛季"],
  },
  wallpaper: {
    kicker: "WALLPAPER",
    title: "学院壁纸",
    items: ["宿舍壁纸", "伙伴插画"],
    noteTitle: "图库承接",
    noteBody: "壁纸区更适合横向缩略图和学院标签，突出可收藏的素材属性。",
    tags: ["壁纸", "插画"],
  },
  feature: {
    kicker: "FEATURE",
    title: "魔法专题",
    items: ["魔咒课堂", "伙伴访谈"],
    noteTitle: "专题承接",
    noteBody: "专题页用卷轴式说明和小图标串联内容，比单一卡片更贴近官网专题。",
    tags: ["专题", "课堂"],
  },
};

const cznHomePanels = {
  forward: {
    kicker: "INTELLIGENCE",
    title: "前瞻情报一览",
    body: "这组入口来自 CZN 当前参考站内容证据；换站时必须重新采集导航和模块，不复用固定栏目。",
    primaryTag: "情报",
    secondaryTag: "活动",
    galleryKicker: "FEATURED",
    galleryTitle: "前瞻情报",
    galleryBody: "大图轮播和斜切信息框承担官网展示侧，而不是保留下载卡。",
  },
  character: {
    kicker: "AGENT FILE",
    title: "作战员档案",
    body: "角色入口承接立绘、身份、技能和语音资料，是 CZN 风格最核心的视觉资产。",
    primaryTag: "角色",
    secondaryTag: "技能",
    galleryKicker: "RENOA",
    galleryTitle: "黑玫瑰档案",
    galleryBody: "紫黑底、角色剪影和橙色斜切框形成可迁移的档案页模式。",
  },
  media: {
    kicker: "VISUAL FILE",
    title: "影像资料库",
    body: "媒体入口只有在源站存在 PV、截图、壁纸或图库证据时才成立；这里用于承接 CZN 的图像资料。",
    primaryTag: "PV",
    secondaryTag: "图库",
    galleryKicker: "SCREENSHOT",
    galleryTitle: "梦境切片",
    galleryBody: "用高对比图像、斜切遮罩和亮橙描边保留官网素材感。",
  },
};

const cznMediaCopy = {
  pv: {
    kicker: "TRAILER",
    title: "卡厄思梦境 PV",
    items: ["正式上线 PV", "公测前瞻"],
    noteTitle: "PV 承接",
    noteBody: "视频封面保留强角色图、斜切遮罩和橙色焦点线，避免退化为普通轮播。",
    tags: ["PV", "公测"],
  },
  screenshots: {
    kicker: "SCREENSHOTS",
    title: "战斗与场景截图",
    items: ["梦境场景", "战斗界面"],
    noteTitle: "截图承接",
    noteBody: "截图页适合白灰信息底和高饱和内容图，突出真实游戏画面。",
    tags: ["截图", "战斗"],
  },
  interview: {
    kicker: "ARCHIVE",
    title: "角色访谈资料",
    items: ["作战员访谈", "世界观设定"],
    noteTitle: "访谈承接",
    noteBody: "访谈内容应结合角色头像、台词和橙色标签，不只用纯文字列表。",
    tags: ["访谈", "设定"],
  },
};

const styleCategories = [
  {
    id: "color",
    label: "Color",
    zh: "颜色",
    meta: "dangoui token",
  },
  {
    id: "typography",
    label: "Typography",
    zh: "字体",
    meta: "待更新",
    description: "展示 H/B/N 字号层级、字重/行高、字体族和字距规则；先看 DangoUI baseline，再判断品牌字体资产是否只进入页面样式。",
    status: "待提取",
    nextStep: "优先确认标题、正文、辅助文字和品牌字体资产各自承接位置。",
    scope: "Typography 不只是一张字体表；要说明字号、字重、行高、字体族和品牌字体包如何落到组件或页面 CSS。",
  },
  {
    id: "icon",
    label: "Icon",
    zh: "图标",
    meta: "待更新",
    description: "展示 dangoui-icon-config 里的 icon 枚举，以及 DuIcon、DuActionButton、Button slot 的调用方式。",
    status: "待提取",
    nextStep: "优先从 icon 枚举里找可用图标；找不到再记录为待新增 icon 或品牌 asset。",
    scope: "Icon 页只回答两个问题：库里有哪些 icon、代码里怎么用；不新造 icon name，不把品牌图片混进 icon 枚举。",
  },
  {
    id: "button",
    label: "Button",
    zh: "按钮",
    meta: "待更新",
    description: "展示 DangoUI 已有 Button、IconButton、ActionButton 的真实形态和调用方式；FAB 单独标记为待新增能力。",
    status: "待提取",
    nextStep: "优先使用 DuButton props；图标按钮用 DuIconButton / DuActionButton；悬浮发布入口进入 FAB 待新增。",
    scope: "Button 页只回答两个问题：组件库里有哪些按钮形态、代码里怎么用；不把 FAB 当成 DuButton 的一个 type。",
  },
  {
    id: "asset",
    label: "Asset",
    zh: "图片资产",
    meta: "待更新",
    description: "展示图片、字体、纹理、选中态、装饰层和 frame 资产的角色；资产不写成 --du-* token，只说明 Image/slot/CSS/ReviewQueue 如何承接。",
    status: "待提取",
    nextStep: "先记录 asset role、尺寸、透明度、复用状态和目标 selector，再决定 Image/slot、CSS background、mask、border-image 或 ReviewQueue。",
    scope: "Asset 是风格证据层；能用 DangoUI Image/icon slot 承接的走组件，不能承接的走页面资产样式或 ReviewQueue。",
  },
  {
    id: "divider",
    label: "Divider",
    zh: "分割线",
    meta: "token",
    description: "展示 Divider、Frame、Selection 三类边界语言；普通线走 border token，装饰框和图片边框保持 style-only 或 asset。",
    status: "待提取",
    nextStep: "先区分普通 Divider、卡片边界、选中底线、角线/图片 Frame。",
    scope: "Divider 不是所有边框；特殊装饰线、斜切框、图片边框不能硬写成 --du-border-*。",
  },
  {
    id: "layout",
    label: "Layout",
    zh: "布局",
    meta: "DangoUI 待更新",
    description: "展示可复用 PageLayout recipe：先看页面是通栏、卡片、贪心双列还是灰白底，再用 bg token、Spacing、Radius、Shadow 和安全区排出真实页面结构。",
    status: "DangoUI 待更新",
    nextStep: "等待 DangoUI 研发补 Layout recipe / class preset；当前 demo 用页面 CSS 表达。",
    scope: "Layout 不是单个业务组件；先识别布局 recipe，再判断内部使用 Image、List、Group、BottomBar 等组件。通栏、卡片、双列、灰白底必须直接展示视觉形态。",
  },
  {
    id: "spacing",
    label: "Spacing",
    zh: "间距",
    meta: "DangoUI 待新增",
    description: "当前 DangoUI schema 没有通用 spacing token；这里用网格和测量线表达组件之间、网格之间、内部 padding 与安全区的距离关系。",
    status: "DangoUI 待新增",
    nextStep: "先确认项目源码里实际使用的 padding/gap/margin，再标记 page CSS、component CSS 或 missing；未来由 spacing token scale 接管。",
    scope: "不能写成 --du-spacing-*；页面通栏/卡片归 Layout，Spacing 只负责测量距离，不用色块或斜线表达。",
  },
  {
    id: "radius",
    label: "Radius",
    zh: "圆角",
    meta: "DangoUI 待新增",
    description: "当前 DangoUI schema 没有通用 radius token；用单个大容器表达每档圆角，并区分 frame/card/media/control/pill/circle。",
    status: "DangoUI 待新增",
    nextStep: "先补 Radius token scale 和风格化边框反向约束规则。",
    scope: "不能写成 --du-radius-*；直角、圆角、胶囊和圆形要分开记录。紫色描边只标圆角区域，control radius 不能反推容器 radius。",
  },
  {
    id: "shadow",
    label: "Shadow",
    zh: "阴影",
    meta: "DangoUI 待新增",
    description: "当前 DangoUI schema 没有通用 shadow token；用单个容器表达 none / elevation / inset line / brand glow 的差异。",
    status: "DangoUI 待新增",
    nextStep: "先补 Shadow token scale、InsetLine recipe 和 Glow effect recipe。",
    scope: "不能写成 --du-shadow-*；没有来源证据时保持 none，不为选中态补阴影；inset line 是边界语言，glow 是氛围 effect。",
  },
  {
    id: "motion",
    label: "Motion",
    zh: "动效",
    meta: "待更新",
    description: "展示 press、tab switch、snackbar、hover 和品牌氛围动效；轻交互优先走组件 props 或 CSS，复杂动效进入 ReviewQueue。",
    status: "待提取",
    nextStep: "先确认点击反馈、切换节奏、反馈出现位置和品牌背景/素材动效是否可被复用。",
    scope: "Motion 不补无依据 shadow；只记录真实交互节奏、反馈位置和需要资产/脚本承接的动效。",
  },
];

const styleRecipeDetails = {
  dango: {
    typography: [
      { title: "Display", value: "20-24px / 760", note: "默认组件标题保持系统字体和清晰层级，不引入品牌字体或装饰字形。" },
      { title: "Body", value: "13-14px / 500", note: "正文使用通用 UI 阅读节奏，适合表单、卡片和列表说明。" },
      { title: "Caption", value: "10-12px / 600", note: "辅助文字使用默认弱文本 token，浅底可读；深色品牌迁移时必须改由主题弱文本承接。" },
    ],
    icon: [
      { title: "System icon", value: "DuIcon / 18-22px", note: "返回、搜索、刷新、相机、扫描等通用动作优先使用 DangoUI 已有 icon name 和 size，不新造图标名。" },
      { title: "Button icon", value: "Button slot / icon prop", note: "按钮里的图标先走 Button/Icon/slot 组合；图标位置、尺寸和颜色跟随按钮语义。" },
      { title: "State icon", value: "semantic icon", note: "成功、警告、错误、空状态等图标跟随语义色板，不能脱离 token 单独漂色。" },
      { title: "Brand symbol", value: "asset / logo", note: "品牌 logo、游戏官网装饰图标、特殊符号属于 Asset，不写成 DangoUI icon name。" },
    ],
    button: [
      { title: "Button", value: "primary / outline / text", note: "普通行动入口优先使用 DangoUI Button 的 color、type、size、disabled、loading，再由主题 token 改视觉。" },
      { title: "IconButton", value: "Button + Icon", note: "只有图标的按钮先按 Button + DuIcon / slot 组合表达；如果参考站有图片态 icon，需要记录 asset 和 state。" },
      { title: "FAB", value: "floating action", note: "右下角发布、创建、快捷操作属于 FAB；当前为待新增能力，demo 先用页面 CSS 表达位置、尺寸、主色和前景色。" },
      { title: "State", value: "hover / active / disabled", note: "状态先看组件 prop 和 token；没有来源证据时不为了明显而额外加 shadow 或装饰。" },
    ],
    asset: [
      { title: "Image asset", value: "Image / media", note: "普通封面、商品图、角色图优先用 DangoUI Image 或组件 slot 承接，不抽象成颜色 token。" },
      { title: "Background texture", value: "CSS background", note: "页面底图、纹理和氛围图记录 repeat、size、position、opacity，只作用到目标页面或容器。" },
      { title: "Selected asset", value: "active state", note: "选中态图片必须绑定具体 selected/active selector，不能用 shadow、outline 或普通背景替代。" },
      { title: "Frame asset", value: "border-image / 9-slice", note: "图片边框、角花、卡牌框通常替代普通 border，进入 style-only Frame 或 ReviewQueue。" },
    ],
    layout: [
      { title: "full-bleed", value: "通栏", note: "页面底用 bg-2，content 用 bg-1 拉通屏宽，块与块之间默认 8px 露出底色；content 不加 border、不加圆角，适合订单状态、步骤、时间、地址、费用等信息块。" },
      { title: "card-list", value: "卡片", note: "页面底用 bg-2，卡片用 bg-1；卡片 radius 和 shadow 只引用 Radius / Shadow recipe，不在页面里单独写魔法值，适合商品、帖子、列表分组。" },
      { title: "two-column", value: "贪心双列", note: "双列不是普通 grid，而是瀑布流/贪心算法：新内容放进当前更短的一列，卡片比例保持 4:3 到 3:4，不加补位块。" },
      { title: "white-base-gray-card", value: "白底灰卡", note: "白色页面底上放灰色弱卡片，适合轻量选择区或底部弹层内容；如果模拟 Popup 底部区域，必须预留 HomeIndicator。" },
      { title: "gray-base-white-card", value: "灰底白卡", note: "灰色页面底上放白色主内容卡，适合表单、发布器、设置页；内部间距走 Spacing，圆角走 Radius。" },
      { title: "gray-base-full-bleed", value: "灰底拉通式", note: "灰色页面底上用白色 content 拉通屏宽，content 之间 8px 分隔；这是通栏信息页的初始化，不是 Card 外框。" },
    ],
    spacing: [
      { title: "Spacing/Mini", value: "2px", note: "极小贴合间距，用于图标与文字、计数和细小状态之间；demo 用测量线表达真实距离，不用色块。" },
      { title: "Spacing/Small", value: "4px", note: "弱文本、辅助信息、标签内部的紧凑间距；适合组件内部的小关系，不应该散落成临时 CSS。" },
      { title: "Spacing/Normal", value: "8px", note: "默认相邻元素、模块 gap、Feed 双列 gutter 和 content gap；是 DangoUI baseline 的基础节奏。" },
      { title: "Spacing/SafeX-Home", value: "10px", note: "首页、卡片型页面左右安全边距；它属于页面 Layout 的边缘距离，不等同普通组件 gap。" },
      { title: "Spacing/Medium", value: "12px", note: "卡片内部 padding、表单行内部信息密度和内容块内部间距；适合常规操作密度。" },
      { title: "Spacing/SafeX-Display", value: "15px", note: "展示侧、通栏页面左右安全边距；Image/Hero 可通栏抵消，文案和操作仍回到该安全边距。" },
      { title: "Spacing/Large", value: "16px", note: "段落、表单组、较大内容块之间的留白；当页面显得拥挤时优先调到这档，而不是随手写 18/20px。" },
      { title: "Spacing/HomeIndicator", value: "34px", note: "底部 TabBar、BottomBar、Popup 必须避让的系统手势区；它是系统安全区，不写进普通卡片或列表 gap。" },
    ],
    divider: [
      { title: "Divider", value: "#0000001f / 1px", note: "默认 Divider 与普通卡片边界来自 --du-border-1；列表分割线、表格线、弱边界都先走 border token。" },
      { title: "Frame", value: "none / component border", note: "DangoUI baseline 初始化没有装饰框、角线或图片边框；出现特殊框时进入 style-only Frame / Asset。" },
      { title: "Selection", value: "#7c66ff active indicator", note: "选中态由 primary token、Tabs indicator 或 Button state 表达，不引入无证据 shadow、纹理或特殊 Frame CSS。" },
    ],
    radius: [
      { title: "Radius/None", value: "0px", note: "通栏 content、直角 frame、风格化线框或斜切资产保持 0px；容器圆角不能被 Button/Input 的 control radius 反向污染。" },
      { title: "Radius/Small", value: "4px", note: "小型控件、微型状态或轻提示使用；demo 用一个大容器只描圆角区域，便于看清 token 差异。" },
      { title: "Radius/Normal", value: "8px", note: "常规 Button、Input、Search、Image、小卡片的默认候选；进入生产后应由基础 radius token 承接。" },
      { title: "Radius/Medium", value: "12px", note: "详情内容块、媒体容器和普通卡片的容器感更强；品牌迁移时必须先看 frame / border 证据。" },
      { title: "Radius/Large", value: "16px", note: "大弹层、页面级容器或运营卡片使用；不要因为一个大卡片圆角就把所有控件都改成 16px。" },
      { title: "Radius/Pill", value: "999px", note: "Tag、胶囊 Button、Switch 轨道和大圆角行动入口；它是形状语义，不是卡片圆角。" },
      { title: "Radius/Circle", value: "50%", note: "Avatar、Radio/Checkbox 控制点、圆形 IconButton；圆形语义独立于 frame/card/media radius。" },
    ],
    shadow: [
      { title: "Shadow/None", value: "none", note: "默认组件不自动加阴影；选中态、hover、active 不能为了明显而补 shadow。" },
      { title: "Shadow/Low", value: "0 1px 3px rgba(0,0,0,.08)", note: "轻浮层、轻卡片、TabBar/FAB 的最弱层级；demo 用同一个容器展示，避免误以为是卡片数量。" },
      { title: "Shadow/Medium", value: "0 8px 24px rgba(0,0,0,.12)", note: "Popover、Popup 上方浮层或重点悬浮操作才使用；必须有层级证据，不作为普通卡片默认值。" },
      { title: "Shadow/InsetLine", value: "inset 0 0 0 1px rgba(0,0,0,.08)", note: "这是内边界线，不是真投影；用于表达容器内沿、替代 border 或补充 Frame 语言。" },
      { title: "Shadow/Glow", value: "brand glow", note: "游戏官网、剧本杀、活动页常见氛围光效；归 effect recipe，不进入普通 elevation scale，也不替代真实边框。" },
    ],
    motion: [
      {
        title: "Press",
        kind: "token",
        visualKey: "press",
        operatorLabel: "按下去要有轻微反馈：让用户知道刚才那一下点到了",
        value: "120-180ms",
        usage: "按钮、卡片、列表项、可点击入口。",
        anti: "不要用厚阴影或大幅位移制造夸张点击感。",
        note: "按钮、卡片、列表项点击反馈保持轻量；优先用组件交互或 CSS transition，不额外制造重动效。",
      },
      {
        title: "Tab switch",
        kind: "token",
        visualKey: "tab-switch",
        operatorLabel: "切换时只让选中态移动：让用户看清是同一组内容在切换",
        value: "150-220ms",
        usage: "Tabs、SegmentControl、顶部分类切换。",
        anti: "不要整页乱飞；切换动效不能掩盖页面结构复用问题。",
        note: "Tabs / SegmentControl 切换只移动选中状态和内容，不用动画掩盖页面结构复用问题。",
      },
      {
        title: "Feedback",
        kind: "mapped",
        visualKey: "feedback",
        operatorLabel: "操作成功要给轻反馈：复制、保存、提交后在屏幕内告诉用户结果",
        value: "Snackbar / Toast",
        usage: "复制成功、保存成功、提交成功、失败提醒。",
        anti: "不要跳到屏幕外，也不要用页面大弹窗替代轻反馈。",
        note: "复制、保存、提交等轻反馈在 mockup 屏幕内出现；反馈位置和时长应跟组件语义一致。",
      },
      {
        title: "Atmosphere",
        kind: "style",
        visualKey: "background-drift",
        operatorLabel: "氛围可以慢慢动：只让背景、光效或素材层动，内容本身保持稳定",
        value: "background motion",
        usage: "Hero、品牌背景、游戏/活动页主视觉。",
        anti: "不要让表单、列表、普通文字一起动。",
        note: "品牌背景漂移、粒子、光效等属于页面氛围 motion；必须有素材或源站动效证据，再进入 demo-only / ReviewQueue。",
      },
    ],
  },
  czn: {
    typography: [
      { title: "Display", value: "24-28px / 850", note: "用于角色名、官网首屏标题，保持高对比和游戏宣发气势。" },
      { title: "Body", value: "12-13px / 650", note: "正文偏紧凑，服务资讯流和角色说明，避免大段文字削弱沉浸感。" },
      { title: "Caption", value: "10-11px / 700", note: "状态、标签、HUD 信息可略加粗，形成工具面板感。" },
    ],
    spacing: [
      { title: "Page", value: "16px", note: "页面内距保持中等密度，适合游戏内容卡和下载入口并排出现。" },
      { title: "Card gap", value: "10-14px", note: "卡片之间不宜过松，保留活动页的资讯密度。" },
      { title: "CTA", value: "8-12px", note: "按钮、二维码、下载块之间用紧凑间距强化行动入口。" },
    ],
    divider: [
      { title: "Divider", value: "rgba(255,90,31,.38) / 1px", note: "资讯区和导航分隔使用橙色低透明 Divider，映射到 --du-border-1 / --du-primary-border。" },
      { title: "Frame", value: "angled HUD frame", note: "卡片边界是斜切线框，不是普通 Divider；需要页面 Frame CSS。" },
      { title: "Selection", value: "orange active underline", note: "选中态用底线和斜切边界，不额外加无依据阴影。" },
    ],
    radius: [
      { title: "HUD / Media frame", value: "0px + slanted mask", note: "风格化媒体框和角色舞台不继承普通 card 圆角；斜切由 mask / frame CSS 承接。" },
      { title: "Plain panel", value: "0px", note: "普通信息容器保持硬朗直角，不为复用 card 组件额外加圆角。" },
      { title: "Control", value: "6px", note: "按钮和输入类控件更硬朗，强调游戏工具属性。" },
    ],
    asset: [
      { title: "首页主视觉背景", kind: "style", visualKey: "hero-image", affiliation: "CZN 风格化样式 · 首页背景资产", operatorLabel: "首页主视觉背景：先用真实官网背景撑住第一眼", value: "index-bg.jpg", assetPath: "/assets/czn-index-bg.jpg", usage: "首页 Hero、分发侧首屏、游戏宣发落地页。", anti: "不要用纯黑渐变或通用暗色卡片替代首页背景。", note: "CZN 首页首屏依赖 index_bg 一类大图背景，和 1999 的复古纹理不是同一种资产。", role: "illustration-background", scope: "home hero background", placement: "background-image / cover", fallback: "dark purple-blue gradient" },
      { title: "Slogan 与贴纸", kind: "style", visualKey: "brand-mark", affiliation: "CZN 风格化样式 · 品牌叠层资产", operatorLabel: "Slogan 与贴纸：品牌语气来自叠在画面上的图形", value: "sm-add-slogan.png / tiezhi-kol.png", assetPath: "/assets/czn-sm-add-slogan.png", usage: "首页 Hero、活动封面、宣发图层。", anti: "不要把 slogan 改成普通文本，也不要到处重复贴纸。", note: "sm_add_slogan 和贴纸属于 CZN 首页识别层，适合少量叠在主视觉上。", role: "decorative-layer", scope: "hero overlay / campaign mark", placement: "absolute image layer", fallback: "text slogan" },
      { title: "斜切情报卡片", kind: "style", visualKey: "mask-card", affiliation: "CZN 风格化样式 · mask / clipped card", operatorLabel: "斜切情报卡片：卡片边界靠 mask 裁切，不靠圆角", value: "forward-mask.png + forward-img1.jpg + forward-txt-bg.png", assetPath: "/assets/czn-forward-img1.jpg", usage: "前瞻情报、活动轮播、资讯大卡。", anti: "不要把它做成普通圆角 Card；右上和左下的斜切是识别点。", note: "forward_img1、forward_mask 和 forward_txt_bg 共同形成情报卡片，不是单张普通图片。", role: "mask-card", scope: "forward intelligence card / swiper", placement: "Image + mask-image + text bg", fallback: "rect image card" },
      { title: "下载入口图片", kind: "style", visualKey: "download-action", affiliation: "CZN 风格化样式 · CTA asset", operatorLabel: "下载入口图片：PC下载和配置入口是图片按钮", value: "index-pc-main-down.png / index-ck-pz.png", assetPath: "/assets/czn-index-pc-main-down.png", usage: "官网首页下载入口、配置查看入口。", anti: "不要塞进 Hero 文案区；它是独立 CTA 区块。", note: "下载和配置入口来自官网图片按钮，必要时用 Image + Button 组合承接。", role: "decorative-cta", scope: "download CTA", placement: "image button / slot", fallback: "DuButton primary" },
      { title: "角色视频舞台", kind: "style", visualKey: "video-stage", affiliation: "CZN 风格化样式 · Video / character stage", operatorLabel: "角色视频舞台：角色页优先保留动态角色素材", value: "renoa-creazy-loop.mp4 + poster rc.jpg", assetPath: "/assets/czn-renoa-creazy-rc.jpg", usage: "角色档案、展示侧角色页、角色主面板。", anti: "不要用静态头像替代角色视频；除非运行环境不能播放。", note: "CZN 角色详情依赖 loop 视频和 poster；这是和 1999 静态角色图不同的资产类型。", role: "video", scope: "character panel media", placement: "video / poster", fallback: "poster image" },
      { title: "角色前后景层", kind: "style", visualKey: "role-layer", affiliation: "CZN 风格化样式 · character layered asset", operatorLabel: "角色前后景层：角色不是单图，是前景/后景叠层", value: "renoa-bg-front.png + renoa-bg-back.png + character-bg.jpg", assetPath: "/assets/czn-renoa-creazy-bg-front.png", usage: "角色卡、技能卡、角色展示背景。", anti: "不要只贴一张人物图；前后景层会决定空间感。", note: "角色前后景、角色背景和 box 图层共同营造黑紫舞台感。", role: "decorative-layer", scope: "character stage layers", placement: "absolute layers / contain", fallback: "poster image" },
      { title: "头像与技能图", kind: "style", visualKey: "character-icon", affiliation: "CZN 风格化样式 · character asset", operatorLabel: "头像与技能图：用于角色数据块，不是页面背景", value: "character-renoa.png / character-box.png / skill-1.png", assetPath: "/assets/czn-renoa-skill-1.png", usage: "角色头像、技能卡、语音/技能信息块。", anti: "不要把技能图当页面纹理；它只服务角色内容。", note: "角色头像盒、人物图和技能图属于角色数据展示资产，适合放在 Avatar/Card/Image slot。", role: "character-asset", scope: "avatar / skill card", placement: "Image slot / background contain", fallback: "DuAvatar + text" },
      { title: "情报缩略图裁切", kind: "style", visualKey: "image-mask", affiliation: "CZN 风格化样式 · image mask", operatorLabel: "情报缩略图裁切：小图也要保留斜切轮廓", value: "intelligence-mask.png", assetPath: "/assets/czn-intelligence-mask.png", usage: "媒体资料、图像列表、首页展示侧图片。", anti: "不要所有图片都套普通 8px 圆角；CZN 的图片边界更硬朗。", note: "intelligence-mask 用于较小展示图，和 forward-mask 的大卡片裁切分工不同。", role: "mask", scope: "gallery thumbnail image", placement: "mask-image", fallback: "rect image" },
    ],
  },
  hpma: {
    typography: [
      { title: "Display", value: "26-32px / 850", note: "标题需要像入学通知书和游戏 logo 一样有强仪式感，适合 serif/装饰字形方向。" },
      { title: "Body", value: "13-15px / 560", note: "正文承接官网说明、新闻列表和卡牌信息，偏羊皮纸阅读感。" },
      { title: "Label", value: "12-14px / 700", note: "导航、卡牌名和按钮文字用金棕色强化魔法书签感。" },
    ],
    spacing: [
      { title: "Page", value: "16px", note: "信息密度中等，既能承接官网新闻，也保留沉浸式视觉空间。" },
      { title: "Media gap", value: "12-16px", note: "媒体卡、壁纸和视频缩略图之间保持清晰网格，不把插画色混进 token。" },
      { title: "CTA", value: "10-14px", note: "下载、预约、查看更多等行动入口靠近内容面板，保持游戏站节奏。" },
    ],
    divider: [
      { title: "Divider", value: "rgba(200,176,139,.72) / 1px", note: "普通分割线使用古铜金 Divider，可映射到 --du-border-1。" },
      { title: "Frame", value: "ornate corner frame / 22px", note: "媒体框和卡牌框需要贴边角线 CSS；只设置 border 色不算完成。" },
      { title: "Scope", value: "demo/page frames only", note: "装饰框只能套到目标页面框体、媒体壳、卡牌壳；证据区和 mapping 区必须排除。" },
    ],
    radius: [
      { title: "Card", value: "0px", note: "官网装饰框和媒体框更接近直角，主要识别来自边框、纹理和手绘资产。" },
      { title: "Control", value: "5px", note: "输入框 CSS 出现 5px；当前 DangoUI schema 没有通用 radius token，只能先落到 control CSS。" },
      { title: "Media", value: "0-8px", note: "特色图和壁纸更多依赖装饰边框，圆角不是主要 token 特征。" },
    ],
  },
  re1999: {
    typography: [
      { title: "Display", value: "24-30px / serif", note: "标题与章节名保留复古档案感，来自官网 SourceHanSerifCN 倾向。" },
      { title: "Body", value: "12-14px / 520", note: "说明文字使用暖灰棕，降低暗底上的现代 UI 感。" },
      { title: "Label", value: "10-12px / 700", note: "NEWS、ARCNIST FILE、日期和分类标签用古铜色强调。" },
    ],
    icon: [
      {
        title: "品牌图形资产",
        kind: "style",
        affiliation: "1999 风格化样式 · Asset",
        operatorLabel: "品牌图形资产：logo、角色标题、状态图不要当成通用 icon",
        value: "logo / role title / selected state png",
        usage: "NavigationBar 水印、角色标题、分享/hover 状态、页面装饰图层。",
        anti: "不要给 DangoUI icon 枚举硬造名字；找不到组件库图标时进入 Asset。",
        note: "1999 的 logo、角色标题和 selected icon pair 都来自图片资产，不属于 DuIcon 枚举。",
      },
      {
        title: "通用动作图标",
        kind: "token",
        affiliation: "1999 token 覆盖 · DuIcon 继承文字/主色",
        operatorLabel: "通用动作图标：仍用 DangoUI icon，但颜色跟随 1999 token",
        value: "DuIcon + --du-text-* / --du-primary-*",
        usage: "返回、搜索、关闭、刷新、更多这类 App 通用动作。",
        anti: "不要因为是游戏风格就把所有通用 icon 换成图片。",
        note: "通用动作图标保留组件库枚举，只继承主题文字色和主色。",
      },
    ],
    button: [
      {
        title: "古铜主按钮",
        visualKey: "primary-action",
        kind: "token",
        affiliation: "1999 token 覆盖 · DuButton primary",
        operatorLabel: "古铜主按钮：主行动入口换成 1999 古铜色",
        value: "#B55829 / primary button",
        usage: "查看更多、提交、确认、进入详情等主行动。",
        anti: "不要为了复古感额外加厚阴影；按钮边界和颜色已经足够表达层级。",
        note: "DuButton 仍可承接主按钮结构，颜色来自 --du-primary-solid-bg / --du-primary-border 覆盖。",
      },
      {
        title: "暗色描边按钮",
        visualKey: "outline-action",
        kind: "token",
        affiliation: "1999 token 覆盖 · DuButton outline",
        operatorLabel: "暗色描边按钮：次级行动像档案操作入口",
        value: "#45392F border + dark surface",
        usage: "保存草稿、查看更多、切换入口、弱行动按钮。",
        anti: "不要套媒体角线框；普通按钮不是装饰 Frame。",
        note: "Outline 按钮用深色表面、古铜边界和暖纸文字表达，不进入 style-only Frame。",
      },
      {
        title: "胶囊入口",
        visualKey: "pill-action",
        kind: "token",
        affiliation: "1999 token 覆盖 · control radius",
        operatorLabel: "胶囊入口：按钮/标签可以圆，但卡片不能跟着圆",
        value: "42px control radius",
        usage: "官网首页分发入口、标签、轻量切换按钮。",
        anti: "不要把按钮胶囊圆角反推给 Card / Media / Frame。",
        note: "1999 里 control radius 与档案面板直角并存，二者不能互相污染。",
      },
    ],
    spacing: [
      {
        title: "页面内距",
        kind: "token",
        affiliation: "1999 token 覆盖 · page spacing",
        operatorLabel: "页面内距：暗色页面保持中等密度",
        value: "16px",
        usage: "首页、资讯页、档案页的主体内容边距。",
        anti: "不要像营销官网一样拉太开；1999 更像紧凑档案资料页。",
        note: "移动端样板页保持中等密度，承接官网首页、资讯和档案三个信息层。",
      },
      {
        title: "档案块间距",
        kind: "token",
        affiliation: "1999 token 覆盖 · content gap",
        operatorLabel: "档案块间距：内容块靠近但不贴死",
        value: "10-14px",
        usage: "资讯列表、档案卡片、媒体说明面板之间。",
        anti: "不要让块与块距离过大；会丢掉资料室的紧凑阅读节奏。",
        note: "资讯列表和档案卡片之间保持紧凑的阅读节奏。",
      },
      {
        title: "行动入口间距",
        kind: "token",
        affiliation: "1999 token 覆盖 · CTA gap",
        operatorLabel: "行动入口间距：按钮靠近对应内容",
        value: "8-12px",
        usage: "查看更多、下载、预约、标签与按钮之间。",
        anti: "不要把按钮单独漂到很远的位置；它应该贴近当前内容块。",
        note: "下载、预约、查看更多靠近内容块，避免像普通品牌官网一样过松。",
      },
    ],
    divider: [
      {
        title: "普通分割线",
        visualKey: "plain-divider",
        kind: "token",
        affiliation: "1999 token 覆盖 · --du-border-1",
        operatorLabel: "普通分割线：只分隔信息，不抢视觉",
        value: "#45392F / 1px",
        example: "列表之间",
        usage: "资讯列表、时间线、信息组、表单行之间的弱分隔。",
        anti: "不要拿它做大卡片外框；大容器应该用下面的 Frame。",
        note: "普通分割线来自资讯列表和暗色面板边界，映射到 --du-border-1；适合列表行、时间线、信息组之间的弱分隔。",
      },
      {
        title: "暗色容器边框",
        visualKey: "panel-boundary",
        kind: "token",
        affiliation: "1999 token 覆盖 · --du-bg-1 + --du-border-1",
        operatorLabel: "暗色容器边框：给一整块内容收边",
        value: "#45392F / inset 1px",
        example: "信息面板",
        usage: "Card / Group / 商品卡 / 档案摘要这类父容器。",
        anti: "不要在容器里面再套一层新边框；它应该直接成为父容器边界。",
        note: "暗色档案面板的贴边内描线，用来替代普通卡片 border；适合 Card / Group / 商品卡父容器。",
      },
      {
        title: "媒体角线框",
        visualKey: "media-corner-frame",
        kind: "style",
        affiliation: "1999 风格化样式 · style-only Frame",
        operatorLabel: "媒体角线框：让大图/PV 像资料室展柜",
        value: "#B55829 + warm paper corner lines",
        example: "暴雨影像资料室",
        usage: "Swiper、PV、大图展示区、专题头图、角色媒体容器。",
        anti: "不要只写 1px solid；角线、内描线、直角和背景层要一起出现。",
        note: "暴雨影像资料室这种媒体容器用多层 background 画角线，不等同普通 border；适合 Swiper、PV、大图展示区。",
      },
      {
        title: "角色档案外框",
        visualKey: "archive-panel-frame",
        kind: "style",
        affiliation: "1999 风格化样式 · style-only Frame",
        operatorLabel: "角色档案外框：给人物主面板加左上/右下角线",
        value: "#B55829 / top-left + bottom-right corner lines",
        example: "角色档案",
        usage: "人物档案、角色主面板、详情页主视觉信息区。",
        anti: "不要做成四角完整花框；当前证据是左上和右下角线，不是通用 card 边框。",
        note: "角色档案面板使用古铜左上/右下角线、直角 radius 和图片背景；普通小卡片只是细边框与左侧强调线。",
      },
      {
        title: "档案小卡边界",
        visualKey: "archive-card-edge",
        kind: "style",
        affiliation: "1999 风格化样式 · style-only Frame",
        operatorLabel: "档案小卡边界：细边框加左侧强调线",
        value: "#B55829 / thin border + left accent",
        example: "档案信息卡",
        usage: "角色信息、时代/身份/阵营这类小信息卡。",
        anti: "不要套成媒体角线框；小卡片证据是细边框和左侧强调线。",
        note: "re1999-file-grid article 使用细边框、左侧强调线和暗色底，不是四角完整角线框。",
      },
    ],
    asset: [
      { title: "页面氛围纹理", kind: "style", visualKey: "texture", affiliation: "1999 风格化样式 · 背景资产", operatorLabel: "页面氛围纹理：让页面不是一块纯黑底", value: "BG2.png / BG.png / BGM.png", assetPath: "/assets/brand-assets/re1999/img/BG2.png", usage: "首页、档案页、媒体页的页面底和大面积背景。", anti: "不要把纹理当成颜色 token；也不要用纯黑或渐变替代。", note: "源站存在 PC 背景 BG/BG2 与移动端 BGM；demo 以 BG2 作为代表，其他作为同类候选。", role: "texture", scope: "page background", placement: "background-image / cover", fallback: "dark gradient + line texture" },
      { title: "主视觉场景图", kind: "style", visualKey: "hero-image", affiliation: "1999 风格化样式 · Image / media", operatorLabel: "主视觉场景图：承担首页和展示页的第一眼气质", value: "01.jpg / kv/m.jpg / gallery/01.png / backstory/p1.png", assetPath: "/assets/brand-assets/re1999/img/gallery/01.png", usage: "Hero、影像资料、故事/档案展示区。", anti: "不要把所有大图都降级成 texture；场景图是内容主视觉。", note: "场景图与纹理分开：纹理负责底色气氛，场景图负责内容和叙事。", role: "illustration-background", scope: "hero media / showcase image", placement: "Image / background-image", fallback: "texture background" },
      { title: "角色媒体组合", kind: "style", visualKey: "role-media", affiliation: "1999 风格化样式 · Image slot + 装饰层", operatorLabel: "角色媒体组合：人物图、背板和轨道层要一起出现", value: "role/1.png + role/1bg.png + role/false.webp", assetPath: "/assets/brand-assets/re1999/img/role/1.png", usage: "角色档案、人物详情、角色主面板。", anti: "不要只放角色头像，也不要只用灰色占位。", note: "角色主图是内容，role/false.webp 是叠加装饰层，role/1bg.png 是背板；三者职责不同。", role: "role-art", scope: "character media panel", placement: "Image slot + absolute layers", fallback: "character thumbnail" },
      { title: "标题与 Logo 图层", kind: "style", visualKey: "brand-mark", affiliation: "1999 风格化样式 · 品牌识别资产", operatorLabel: "标题与 Logo 图层：关键标题可以用图片保持识别度", value: "re1999-logo.png / News.png / first/1.png + first/2.png", assetPath: "/assets/re1999-logo.png", usage: "导航水印、Hero 标题、资讯标题、章节标题装饰。", anti: "不要把所有标题都做成图片；只在源站有图层证据时使用。", note: "Logo、NEWS 标题图和首屏小图层都属于品牌识别，不写成 DangoUI icon name。", role: "brand-mark", scope: "navigation / hero / section title", placement: "inline image / background contain", fallback: "serif text title + copper divider" },
      { title: "选中态图片", kind: "style", visualKey: "state-asset", affiliation: "1999 风格化样式 · 状态资产", operatorLabel: "选中态图片：hover/active 先找图片对", value: "icon/b.png + icon/bc.png / backstory/1_1.png", assetPath: "/assets/brand-assets/re1999/img/icon/bc.png", usage: "分享按钮、分页、社交入口、特殊选中态。", anti: "不要用厚阴影或普通 outline 代替有证据的状态图片。", note: "源站有 b.png 到 bc.png 的 hover 图片对，也有 backstory hover mark；这类应绑定 selected/hover selector。", role: "selected-bg", scope: "selected / hover state", placement: "state-scoped background-image", fallback: "copper active line" },
      { title: "图片 CTA", kind: "style", visualKey: "cta-asset", affiliation: "1999 风格化样式 · CTA asset", operatorLabel: "图片 CTA：有些按钮不是普通 DuButton 能直接还原", value: "more.png", assetPath: "/assets/brand-assets/re1999/img/more.png", usage: "查看更多、活动入口、资讯跳转按钮。", anti: "不要强行套普通按钮样式；需要时用 Image + Button 组合。", note: "more.png 是 CSS background for more/see-more；按钮能力不足时进入 style-only 或 ReviewQueue。", role: "decorative-cta", scope: "news more button / CTA", placement: "CSS background-image", fallback: "DuButton outline" },
      { title: "字体包", kind: "style", visualKey: "font-pack", affiliation: "1999 风格化样式 · @font-face", operatorLabel: "字体包：复古档案感主要靠字体撑住", value: "Serif.ttf / Sans.ttf / Didot.ttf", assetPath: "/assets/brand-assets/re1999/font/Serif.ttf", usage: "Hero 标题、档案标题、正文说明、英文数字 display。", anti: "不要只靠系统字体猜；缺字体包会明显丢风格。", note: "Serif 用于标题，Sans 用于正文，Didot 用于英文/数字 display；都属于 font asset，不是 color token。", role: "font", scope: "theme typography", placement: "@font-face / font-family", fallback: "Georgia / Songti SC / system sans-serif" },
      { title: "弹层纹理", kind: "style", visualKey: "panel-texture", affiliation: "1999 风格化样式 · 弹层资产", operatorLabel: "弹层纹理：只用于活动弹层或局部面板", value: "login/loginBg.png", assetPath: "/assets/brand-assets/re1999/img/login/loginBg.png", usage: "登录/预约弹层、活动面板、局部 campaign card。", anti: "不要泛化成全站背景；它是局部面板资产。", note: "loginBg.png 是预约/登录弹层背景，尺寸和语境都更适合弹层或活动卡。", role: "texture", scope: "modal / campaign panel", placement: "panel background-image", fallback: "dark panel CSS" },
    ],
    radius: [
      {
        title: "容器直角",
        kind: "token",
        affiliation: "1999 token 覆盖 · frame/card radius",
        operatorLabel: "容器直角：档案框和普通卡片不要保留圆角",
        value: "0px",
        usage: "Card / Group / 媒体容器 / 档案面板的父容器。",
        anti: "不要把 DangoUI 默认卡片圆角带进来；也不要被按钮胶囊圆角反向污染。",
        note: "普通 Card / frame 容器跟随档案式直角线框；radius 与 Divider / Frame 联动，不保留通用圆角。",
      },
      {
        title: "胶囊控件",
        kind: "token",
        affiliation: "1999 token 覆盖 · control radius",
        operatorLabel: "胶囊控件：按钮和标签可以圆一点",
        value: "42px",
        usage: "导航分发入口、标签、弱切换、行动按钮。",
        anti: "不要把控件圆角复制到 Card / Image / Frame 容器。",
        note: "标签/按钮有明显 pill 倾向，和档案框形成对比。",
      },
      {
        title: "大媒体壳特殊圆角",
        kind: "style",
        affiliation: "1999 风格化样式 · media shell",
        operatorLabel: "大媒体壳特殊圆角：只给特定大图区域",
        value: "top-right 50-100px",
        usage: "故事图、大媒体壳、官网特定图片区域。",
        anti: "不要泛化到普通卡片；没有页面证据就保持直角。",
        note: "源站 news-left / backstory-left 有右上角大圆角；只作用在大媒体壳或故事图区域，不能泛化到普通卡片。",
      },
      {
        title: "普通媒体直角",
        kind: "token",
        affiliation: "1999 token 覆盖 · media radius",
        operatorLabel: "普通媒体直角：图片和视频容器先保持硬朗",
        value: "0px",
        usage: "普通 Image、Swiper、封面图、角色媒体容器。",
        anti: "不要默认套 8/12px 圆角；特殊圆角必须由具体页面壳证据驱动。",
        note: "普通媒体/组件封面保持直角；特殊圆角必须由具体页面壳证据驱动。",
      },
    ],
    shadow: [
      {
        title: "普通容器无厚阴影",
        kind: "token",
        affiliation: "1999 token 覆盖 · --style-card-shadow: none",
        operatorLabel: "普通容器无厚阴影：边界感交给线框、角线和纹理",
        value: "none",
        usage: "Card / Group / 档案信息卡 / 普通媒体容器。",
        anti: "不要用通用 card shadow 模拟复古高级感；会变成普通后台卡片。",
        note: "1999 普通容器的层级由边框、角线、暗色表面和纹理承担。",
      },
      {
        title: "氛围投影只给舞台",
        kind: "style",
        affiliation: "1999 风格化样式 · page/hero effect",
        operatorLabel: "氛围投影只给舞台：大主视觉可以有暗场压光",
        value: "hero / phone shell only",
        usage: "Hero、设备外壳、沉浸式媒体舞台。",
        anti: "不要扩散到每张 Card、Button、List 行。",
        note: "大背景和设备外壳可以保留氛围投影，普通内容块保持扁平。",
      },
    ],
    motion: [
      {
        title: "背景轻微漂移",
        kind: "style",
        visualKey: "background-drift",
        affiliation: "1999 风格化样式 · background motion",
        operatorLabel: "背景轻微漂移：让画面有一点呼吸感，自动播放，不需要用户点击",
        value: "4.2s ease-in-out infinite alternate",
        usage: "首页 Hero、角色档案主面板、媒体舞台背景。",
        anti: "不要让表单、列表、普通卡片一起动；动效只给氛围层。",
        note: "背景/角色图层可以轻微自动漂移，组件本身仍保持稳定可读。",
      },
      {
        title: "内容入场克制",
        kind: "style",
        visualKey: "panel-enter",
        affiliation: "1999 风格化样式 · panel enter",
        operatorLabel: "内容入场克制：打开页面时轻轻浮入一下，出现后保持稳定",
        value: "2.4s ease-in-out infinite",
        usage: "角色档案面板、媒体主视觉、页面首屏主内容。",
        anti: "不要给每个小组件都加动画；会影响运营页的可控性。",
        note: "当前 demo 的 re1999PanelEnter / role float 只服务核心视觉。",
      },
    ],
  },
};

const fallbackStyleRecipeDetails = {
  typography: [
    ...[
      ["H", 700, "标题/强强调"],
      ["B", 500, "正文强调/组件标题"],
      ["N", 400, "正文/说明/辅助"],
    ].flatMap(([prefix, weight, usage]) =>
      [
        [1, 32, 40],
        [2, 28, 36],
        [3, 24, 32],
        [4, 20, 28],
        [5, 18, 26],
        [6, 16, 24],
        [7, 14, 22],
        [8, 12, 18],
      ].map(([level, size, lineHeight]) => ({
        title: `${prefix}${level}`,
        value: `${size}px / ${weight} / ${lineHeight}px`,
        note: `${usage}，按 H/B/N typography scale 表达；落到 DangoUI 时由组件源码或页面 CSS 承接。`,
      })),
    ),
    { title: "Font family", value: "system-ui / brand font asset", note: "字体族单独记录；DangoUI 当前快照没有全局 font-family token，品牌字体包进入 demoOnlyVisualControls。" },
    { title: "Letter spacing", value: "0 by default", note: "普通 UI 文本不加负字距；品牌标题若有字距证据单独记录。" },
  ],
  icon: [
    { title: "System icon", value: "stroke / 20px", note: "优先使用 dangoui Icon 已有 name、size 和 color，不从品牌图里新造 icon name。" },
    { title: "Brand symbol", value: "asset / logo", note: "品牌符号、logo、游戏装饰图标属于资产层；只记录来源和使用范围。" },
    { title: "Button icon", value: "left/right slot", note: "按钮图标先映射 DuButton icon / iconPosition；缺失图标进入 ask-user。" },
    { title: "State icon", value: "feedback/status", note: "成功、警告、错误图标必须跟语义色板一致，不单独漂移颜色。" },
  ],
  button: [
    { title: "Button", value: "normal / primary / outline / text", note: "普通行动入口优先继承 DangoUI Button 的 type、size、disabled、loading 和语义色；品牌只覆盖 token、边框、圆角或轻动效。" },
    { title: "IconButton", value: "icon-only / slot button", note: "只放图标的行动入口先用 Button + Icon/slot 组合表达；如果参考站使用图片态 icon，需要记录 assetPath 和 selected/hover 状态。" },
    { title: "FAB", value: "floating action button", note: "右下角发布、创建、快捷操作属于 FAB；当前 DangoUI 待新增，demo 先用页面 CSS 表达位置、尺寸、主色和前景色。" },
  ],
  asset: [
    { title: "Background image", value: "png/webp/svg background", note: "页面底图、纹理和装饰背景先记录 assetPath、repeat、size、position，再落 CSS background。" },
    { title: "Selected background", value: "active/selected asset", note: "选中态图片要绑定具体 state selector；不能用 shadow 或 outline 代替有证据的 selected-bg。" },
    { title: "Frame image", value: "border-image / 9-slice", note: "边框图、角花、卡牌框属于 asset-frame，通常替代普通 border。" },
    { title: "Illustration", value: "Image slot / media layer", note: "角色图、物件图和场景图优先作为 Image/slot 或 media layer，不进入 UI token。" },
  ],
  layout: [
    { title: "full-bleed", value: "通栏", note: "页面底 bg-2，content bg-1 拉通屏宽，块间 8px；content 无 border/radius，内部 padding 使用页面安全边距。" },
    { title: "card-list", value: "卡片", note: "页面底 bg-2，卡片 bg-1，卡片 radius 取 radius token；适合列表、商品信息和内容分组。" },
    { title: "two-column", value: "双列", note: "双列是贪心算法布局：新 item 放入当前更短的一列，item 使用 4:3 到 3:4 的真实卡片比例；适合 Feed、资源坑位和瀑布流。" },
    { title: "white-base-gray-card", value: "白底灰卡", note: "页面底 bg-1，弱分组卡片 bg-2；底部类 popup 布局必须预留 home indicator 安全区。" },
    { title: "gray-base-white-card", value: "灰底白卡", note: "页面底 bg-2，主内容卡 bg-1；底部类 popup 布局必须预留 home indicator 安全区。" },
    { title: "gray-base-full-bleed", value: "灰底拉通式", note: "页面底 bg-2，content bg-1 拉通屏宽；适合订单状态、Steps、时间、地址、费用等通栏信息块。" },
  ],
  shadow: [
    { title: "Elevation", value: "surface shadow", note: "只有真实卡片层级或浮层证据明确时才迁移；否则保持 none。" },
    { title: "Inner line", value: "inset border", note: "很多暗色面板的层级来自 inset 线框，不应误判成 shadow token。" },
    { title: "Glow", value: "brand glow", note: "霓虹、魔法光、游戏氛围光属于页面氛围样式，不能写成正式 dangoui shadow。" },
  ],
  motion: [
    { title: "Press", value: "120-180ms", note: "按钮/卡片点击反馈保持轻量，不为选中态擅自加 shadow。" },
    { title: "Tab switch", value: "150-220ms", note: "tab 切换表达 active indicator，不改变页面结构或复用同一套内容。" },
    { title: "Snackbar", value: "bottom feedback", note: "复制、保存等轻反馈使用 mockup 屏幕内 snackbar，避免全局 toast 干扰。" },
  ],
};

const imagePreviewSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' rx='24' fill='%23f5f5f5'/%3E%3Ccircle cx='92' cy='76' r='44' fill='%23874fff' fill-opacity='.82'/%3E%3Ccircle cx='160' cy='92' r='48' fill='%2300b6ff' fill-opacity='.72'/%3E%3Ccircle cx='224' cy='82' r='38' fill='%23ff7237' fill-opacity='.78'/%3E%3C/svg%3E";
const uploadExampleFiles = [
  {
    uid: "cover-1",
    thumbUrl: imagePreviewSrc,
    status: "done",
  },
];
const cascaderExampleOptions = [
  {
    label: "华东",
    value: "east",
    children: [
      {
        label: "上海",
        value: "shanghai",
        children: [
          { label: "浦东", value: "pudong" },
          { label: "黄浦", value: "huangpu" },
        ],
      },
    ],
  },
  {
    label: "华南",
    value: "south",
    children: [
      {
        label: "广州",
        value: "guangzhou",
        children: [{ label: "天河", value: "tianhe" }],
      },
    ],
  },
];
const selectOptions = [
  { label: "方案 A", value: "option-a" },
  { label: "方案 B", value: "option-b" },
  { label: "方案 C", value: "option-c" },
];
const re1999PublishOptions = [
  { label: "公告", value: "notice" },
  { label: "活动", value: "event" },
  { label: "角色档案", value: "archive" },
];
const brandPublishOptions = [
  { label: "公告", value: "notice" },
  { label: "活动", value: "event" },
  { label: "媒体", value: "media" },
];
const brandPublishCopy = {
  czn: {
    title: "保留 DangoUI 发布链路，只继承 CZN token",
    body: "发布侧不默认套斜切 HUD、角色动效或下载入口皮肤；只有主 CTA 使用品牌橙。",
    groupTitle: "前瞻内容发布",
    groupBody: "面向运营录入标题、摘要、栏目和上线状态，优先保证可读性和可提交。",
    inputValue: "前瞻情报更新",
    textareaValue: "填写活动摘要、角色说明或媒体素材描述。发布侧默认不启用展示侧 mask。",
    switchLabel: "同步到首页分发侧",
  },
  hpma: {
    title: "保留 DangoUI 发布链路，只继承 HPMA token",
    body: "发布侧不默认套羊皮纸大框、金色角线或魔法光效；只保留字体色、按钮色和弱边界。",
    groupTitle: "魔法资讯发布",
    groupBody: "面向运营录入公告、活动和媒体资料，优先保证表单效率。",
    inputValue: "学院活动公告",
    textareaValue: "填写活动说明、赛季公告或媒体摘要。发布侧默认不启用展示侧装饰框。",
    switchLabel: "同步到首页分发侧",
  },
};
const avatarImages = [imagePreviewSrc, imagePreviewSrc, imagePreviewSrc, imagePreviewSrc];
const defaultPlaceholderReason = "该组件依赖弹层、上下文、运行时 API 或特定父子结构，当前静态目录先保留入口，避免误以为 dangoui 没有这个组件。";
const placeholderReasons = {
  ActionButton: "需要稳定的 icon/name 配置和具体业务动作，静态页先不硬造图标。",
  ActionSheet: "动作面板需要通过点击唤起弹层；静态目录保留入口，避免默认遮挡页面。",
  Calendar: "日历适合弹层或完整选择流程，静态铺开会吞掉大量视口，先保留入口。",
  Cascader: "级联选择依赖选项数据和弹层交互，当前只记录组件存在。",
  CheckboxGroup: "组合容器需要表达一组绑定关系，已用 Checkbox 展示视觉基础。",
  CheckboxIcon: "这是 Checkbox 的内部图标组件，通常不作为运营可点选模块单独出现。",
  Dialog: "确认弹窗需要由动作触发，默认打开会打断组件目录浏览。",
  Dropdown: "下拉筛选依赖选项组和展开态，静态页先保留入口。",
  Form: "表单容器主要负责校验和布局，视觉效果由 Input、Select、Checkbox 等子组件承接。",
  FormField: "表单字段上下文组件，通常由 Form/FormItem 调用，不单独静态展示。",
  FormItem: "表单行布局组件，视觉基础已在 Input/Select 等控件里展示。",
  Icon: "需要明确 icon 字库 name；当前 demo 先不假设业务图标。",
  IconButton: "依赖明确 icon name 和动作语义，静态页先保留入口。",
  NavigationBarRight: "NavigationBar 的右侧插槽/子结构，已在 NavigationBar 示例中体现。",
  Picker: "选择器需要打开态和滚动选择交互，静态页先保留入口。",
  PickerView: "滚动选择视图更适合在选择器内部展示，当前不单独铺开。",
  Popup: "底部/居中弹层需要触发态，默认显示会覆盖组件目录。",
  RadioGroup: "组合容器需要表达互斥绑定关系，已用 Radio 展示视觉基础。",
  RadioIcon: "这是 Radio 的内部图标组件，通常不作为独立运营模块。",
  RootPortal: "这是挂载容器能力，不是可见组件。",
  SearchRight: "Search 的右侧动作插槽/子结构，已在 Search 示例中体现。",
  Snackbar: "轻提示条通常由动作触发，不适合默认常驻。",
  StepCheck: "Steps 的内部检查态元素，已由 Steps 组件承接。",
  Sticky: "吸顶需要滚动容器和临界状态，静态目录只保留入口。",
  Swiper: "轮播需要尺寸、图片资源和滑动运行态，当前先记录组件存在。",
  SwiperItem: "Swiper 子项必须放在 Swiper 内部使用，不单独静态展示。",
  Tab: "Tab 必须作为 Tabs 子组件使用，已在 Tabs 示例中展示。",
  TabPane: "TabPane 依赖 Tabs 上下文，当前目录只记录组件存在。",
  TabsRight: "Tabs 的右侧扩展区域，已由 Tabs 组件承接。",
  TagsPanel: "标签面板通常需要可选列表和展开/收起交互，当前先保留入口。",
  Theme: "主题提供器不直接产出可见 UI，风格切换已通过 token value 演示。",
  ToastProvider: "Toast 上下文提供器不直接产出可见 UI，需要动作触发 toast。",
  Tooltip: "悬浮提示依赖 hover/focus 触发，静态目录先不默认打开。",
  Transition: "过渡组件需要进入/离开状态，静态页无法单独表达稳定视觉。",
  Upload: "上传依赖文件选择和权限能力，当前先保留入口。",
};
const sideComponentSpecs = [
  {
    id: "distribution",
    tab: "分发侧",
    name: "分发侧：内容送达",
    pageName: "分发侧",
    description: "面向首页、活动页、内容流和搜索分发，重点回答“用户下一步去哪”。",
    components: ["NavigationBar", "IconButton", "Search", "HeroHeader", "TabBar", "Grid", "List", "Tabs", "Swipe", "Feed", "Group", "SPU", "FAB"],
  },
  {
    id: "display",
    tab: "展示侧",
    description: "面向详情、媒体、档案和状态展示，重点回答“用户现在看的这个是什么”。",
    name: "展示侧：服务器数据输出",
    pageName: "展示侧",
    components: ["NavigationBar", "Image", "Avatar", "Badge", "Popup", "List", "Steps", "Time", "PriceStatistic", "Rate", "Card", "Tabs", "Tag", "Button"],
  },
  {
    id: "publish",
    tab: "发布侧",
    name: "发布侧：用户数据输入",
    pageName: "发布侧",
    description: "面向创建、编辑、报名和配置发布，把用户输入校验后提交给服务器。",
    components: ["NavigationBar", "FormItem", "Input", "Textarea", "Radio", "Checkbox", "Switch", "Upload", "Stepper", "DateTimePicker", "Cascader", "Select", "Rate", "Tips", "Tabs", "Button", "Tag"],
  },
  {
    id: "feedback",
    tab: "反馈",
    name: "反馈：从轻到重",
    pageName: "操作反馈中心",
    description: "从轻量信息提示到重量决策弹层，帮助开发者判断什么时候该打扰用户。",
    components: ["NavigationBar", "NoticeBar", "Snackbar", "Toast", "Dialog", "Popup", "Dropdown", "Popover", "ShareSheet", "Empty", "ResultPage", "Spin", "Skeleton"],
  },
];
const componentCategorySpecs = [
  {
    id: "bar",
    label: "导航",
    description: "页面骨架、路径切换、入口分发和底部操作。",
    components: ["NavigationBar", "IconButton", "Search", "Tabs", "SegmentControl", "TabBar", "BottomBar", "Menu"],
  },
  {
    id: "output",
    label: "数据输出",
    description: "把内容、媒体、状态和商品信息展示给用户。",
    components: ["Badge", "Tag", "Empty", "Image", "Avatar", "Time", "PriceStatistic", "Swipe", "Feed", "SPU"],
  },
  {
    id: "input",
    label: "数据输入",
    description: "收集用户填写、选择、上传和提交的数据。",
    components: ["FormItem", "Input", "Textarea", "Radio", "Checkbox", "Switch", "Stepper", "Upload", "Tips", "Group", "DateTimePicker", "Rate", "Cascader", "Select"],
  },
  {
    id: "feedback",
    label: "反馈",
    description: "用户操作后的提示、弹层、空态、加载和状态反馈。",
    components: ["NoticeBar", "Snackbar", "Toast", "Dialog", "Popup", "ShareSheet", "ResultPage", "Spin", "Skeleton"],
  },
];
const distributionListRows = [
  { title: "周末限时活动", desc: "报名、任务和奖励入口集中展示", meta: "48h" },
  { title: "主推商品合集", desc: "SPU、价格、标签和行动按钮组合", meta: "¥128" },
  { title: "版本资讯更新", desc: "公告、攻略和内容流持续分发", meta: "NEW" },
];
const displayListRows = [
  { title: "图鉴资料", desc: "图片、角色、物品和详情数据", meta: "36" },
  { title: "成就记录", desc: "用户状态、进度和历史记录", meta: "82%" },
  { title: "服务状态", desc: "同步时间、审核状态和数据结果", meta: "OK" },
];
const productDetailRows = [
  { title: "商品状态", desc: "服务器返回的商品可售状态", meta: "现货" },
  { title: "发售时间", desc: "活动、补货和开售节奏", meta: "06.29" },
  { title: "商品规格", desc: "尺寸、材质和包装信息", meta: "常规" },
];
const orderDetailRows = [
  { title: "订单编号", desc: "用于售后、客服和物流查询", meta: "240619" },
  { title: "收货方式", desc: "快递配送 / 门店自提等履约方式", meta: "快递" },
  { title: "物流信息", desc: "发货后同步承运商与运单状态", meta: "待揽收" },
];
const publishListRows = [
  { title: "基础信息", desc: "标题、描述、分类和可见范围", meta: "必填" },
  { title: "素材上传", desc: "封面、图片、视频和附件", meta: "3/9" },
  { title: "发布设置", desc: "时间、开关、审核与提交动作", meta: "草稿" },
];
const categorySpecs = sideComponentSpecs;
const staticallyRenderedComponents = new Set([
  "Avatar",
  "AvatarGroup",
  "Badge",
  "Button",
  "Card",
  "Checkbox",
  "Divider",
  "Empty",
  "Image",
  "IconButton",
  "Input",
  "InputNumber",
  "FAB",
  "Feed",
  "FeedSpuTag",
  "FormItem",
  "Grid",
  "Group",
  "HeroHeader",
  "NavigationBar",
  "NoticeBar",
  "PriceStatistic",
  "ResultPage",
  "Radio",
  "Rate",
  "Search",
  "Select",
  "SPU",
  "SpuTag",
  "Skeleton",
  "SkeletonAvatar",
  "SkeletonParagraph",
  "SkeletonRectangle",
  "Spin",
  "Stepper",
  "Steps",
  "Swipe",
  "Switch",
  "Tabs",
  "TabBar",
  "Tag",
  "Textarea",
  "Time",
  "Tips",
  "Toast",
  "Upload",
]);

function kebabName(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function styleRecipeClassName(name) {
  return kebabName(String(name)).replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function styleRecipeKey(item) {
  return `${selectedStyle.value.id}:${selectedStyleCategoryId.value}:${item.visualKey || item.title}`;
}

function isStyleRecipeActive(item) {
  return activeStyleRecipeKey.value === styleRecipeKey(item);
}

function isInteractiveStyleRecipe(item) {
  if (selectedStyleCategoryId.value === "button") return true;
  if (selectedStyleCategoryId.value !== "motion") return false;
  return /press|tap|click|hover|feedback|snackbar|toast|点击|悬浮|按压|反馈/i.test(`${item.title} ${item.value} ${item.note}`);
}

function activateStyleRecipe(item) {
  const key = styleRecipeKey(item);
  activeStyleRecipeKey.value = activeStyleRecipeKey.value === key ? "" : key;
}

function pageNodeId(name, templateId = selectedTemplateId.value) {
  return `node-${templateId}-${kebabName(name)}`;
}

const componentGroups = categorySpecs.map((group, groupIndex) => ({
  ...group,
  items: group.components.map((name) => ({
    id: `node-${groupIndex}-${kebabName(name)}`,
    name,
    label: name,
    rendered: staticallyRenderedComponents.has(name),
    reason: placeholderReasons[name] || defaultPlaceholderReason,
  })),
}));
const templatePages = [
  {
    id: "distribution",
    side: "distribution",
    tab: "分发侧",
    name: "首页",
    description: "DangoUI baseline 首页：导航、搜索、入口、SPU 横滑和内容流承接分发。",
    layoutRecipe: "card-list",
    components: sideComponentSpecs.find((spec) => spec.id === "distribution")?.components || [],
  },
  {
    id: "post-detail",
    side: "display",
    tab: "展示侧",
    name: "帖子详情",
    description: "展示图文内容、作者信息、互动状态和详情弹层。",
    layoutRecipe: "full-bleed",
    components: ["NavigationBar", "Avatar", "Image", "BottomBar"],
  },
  {
    id: "product-detail",
    side: "display",
    tab: "展示侧",
    name: "商品详情",
    description: "展示商品图片、价格指标、状态标签、详情列表和购买行动。",
    layoutRecipe: "full-bleed",
    components: ["NavigationBar", "Image", "PriceStatistic", "List", "Avatar", "BottomBar"],
  },
  {
    id: "order-detail",
    side: "display",
    tab: "展示侧",
    name: "订单详情",
    description: "展示订单状态、流程进度、时间、明细列表和后续操作。",
    layoutRecipe: "gray-base-full-bleed",
    components: ["NavigationBar", "Steps", "Image", "List", "Time", "PriceStatistic", "BottomBar"],
  },
  {
    id: "publish",
    side: "publish",
    tab: "发布侧",
    name: "帖子发布",
    description: "帖子发布表单：封面、标题、正文、分类、设置和提交动作。",
    layoutRecipe: "gray-base-white-card",
    components: sideComponentSpecs.find((spec) => spec.id === "publish")?.components || [],
  },
];
const fallbackTemplatePages = templatePages;
const cznTemplatePages = [
  {
    id: "czn-home",
    side: "distribution",
    tab: "官网首页",
    name: "首页",
    description: "对应 CZN 首页首屏：大主视觉、内容分发和展示侧图片，不用说明型 Card 填充首页。",
    components: ["NavigationBar", "HeroHeader", "Button", "Image"],
  },
  {
    id: "czn-forward",
    side: "distribution",
    tab: "前瞻情报",
    name: "前瞻情报",
    description: "对应 CZN 公测内容区：白灰资讯底、橙色轮播描边、内容卡和状态标签。",
    components: ["NavigationBar", "Swiper", "Tag", "Card", "Button"],
  },
  {
    id: "czn-character",
    side: "display",
    tab: "角色档案",
    name: "角色档案",
    description: "对应 CZN 角色页：黑紫沉浸底、角色档案、语音面板和技能卡片。",
    components: ["NavigationBar", "CharacterPanel", "Avatar", "Card", "Tag"],
  },
  {
    id: "czn-media",
    side: "display",
    tab: "影像资料",
    name: "影像资料",
    description: "对应 CZN 媒体页：PV 封面、截图图库、访谈资料和斜切素材框。",
    components: ["NavigationBar", "Swiper", "Tabs", "Image", "Card", "Tag"],
  },
  {
    id: "czn-publish",
    side: "publish",
    tab: "发布器",
    name: "发布器",
    description: "发布侧：表单、选择、开关和提交动作只继承 CZN token，默认不套展示侧 HUD/mask。",
    components: ["NavigationBar", "Card", "Input", "Textarea", "Select", "Switch", "Button"],
  },
];
const hpmaTemplatePages = [
  {
    id: "hpma-home",
    side: "distribution",
    tab: "官网首页",
    name: "首页",
    description: "对应官网首页：顶部导航、入学主视觉、内容分发和媒体预览，不用说明型 Card 填充首页。",
    components: ["NavigationBar", "HeroHeader", "Button", "Image"],
  },
  {
    id: "hpma-news",
    side: "distribution",
    tab: "资讯公告",
    name: "资讯公告",
    description: "对应官网新闻与活动轮播：羊皮纸列表、金棕标签、媒体缩略图和查看更多。",
    components: ["NavigationBar", "Swiper", "Tabs", "Card", "Tag", "Button"],
  },
  {
    id: "hpma-cards",
    side: "display",
    tab: "卡牌图鉴",
    name: "卡牌图鉴",
    description: "对应魔咒&伙伴介绍和壁纸图库：卡牌框、角色媒体、图鉴网格和装饰边界。",
    components: ["NavigationBar", "Search", "Image", "Card", "Badge", "Tabs"],
  },
  {
    id: "hpma-media",
    side: "display",
    tab: "影像资料",
    name: "影像资料",
    description: "对应 HPMA 媒体页：PV 封面、壁纸图库、专题资料和羊皮纸说明。",
    components: ["NavigationBar", "Swiper", "Tabs", "Image", "Card", "Tag"],
  },
  {
    id: "hpma-publish",
    side: "publish",
    tab: "发布器",
    name: "发布器",
    description: "发布侧：表单、选择、开关和提交动作只继承 HPMA token，默认不套展示侧羊皮纸框。",
    components: ["NavigationBar", "Card", "Input", "Textarea", "Select", "Switch", "Button"],
  },
];
const re1999TemplatePages = [
  {
    id: "re1999-home",
    side: "distribution",
    tab: "官网首页",
    name: "首页",
    description: "对应官网首页：复古黑底、主视觉、资讯分发和视觉内容露出，不用说明型 Card 填充首页。",
    components: ["NavigationBar", "HeroHeader", "Button", "Image"],
  },
  {
    id: "re1999-news",
    side: "distribution",
    tab: "资讯公告",
    name: "资讯公告",
    description: "分发侧：NEWS 区、分类 tabs、日期列表和查看更多，使用中等风格化。",
    components: ["NavigationBar", "Swiper", "Tabs", "Card", "Tag", "Button"],
  },
  {
    id: "re1999-media",
    side: "display",
    tab: "影像资料",
    name: "影像资料",
    description: "展示侧：媒体大图、图库缩略图和影像资料，允许强纹理、资产和档案边框。",
    components: ["NavigationBar", "Swiper", "Tabs", "Image", "Card", "Tag"],
  },
  {
    id: "re1999-archive",
    side: "display",
    tab: "角色档案",
    name: "角色档案",
    description: "展示侧：角色文件、纸面档案和角色图层，优先使用资产与风格化框体。",
    components: ["NavigationBar", "Image", "Card", "Badge", "Tabs"],
  },
  {
    id: "re1999-publish",
    side: "publish",
    tab: "发布器",
    name: "发布器",
    description: "发布侧：表单、选择、开关和提交动作只继承 1999 token，默认不套展示侧装饰。",
    components: ["NavigationBar", "Card", "Input", "Textarea", "Select", "Switch", "Button"],
  },
];


const demoPagesByStyle = {
  czn: cznTemplatePages,
  hpma: hpmaTemplatePages,
  re1999: re1999TemplatePages,
};
const allDemoPagesByStyle = computed(() => ({
  ...demoPagesByStyle,
  ...runtimeDemoPagesByStyle.value,
}));
const scenarioTabs = [
  { id: "distribution", kind: "数据输出" },
  { id: "display", kind: "数据输出" },
  { id: "publish", kind: "数据输入" },
];
const currentDemoPages = computed(() => allDemoPagesByStyle.value[selectedStyleId.value] || []);
const currentTemplatePages = computed(() => [...templatePages, ...currentDemoPages.value]);
const selectedTemplate = computed(() => currentTemplatePages.value.find((template) => template.id === selectedTemplateId.value) || currentTemplatePages.value[0]);
const currentScenarioTabs = computed(() => {
  if (!currentDemoPages.value.length) return [];
  return scenarioTabs
    .map((scenario) => {
      const pages = scenario.id === "feedback"
        ? templatePages.filter((template) => template.id === "feedback")
        : currentDemoPages.value.filter((template) => template.side === scenario.id);
      if (!pages.length) return null;
      const sideSpec = sideComponentSpecs.find((spec) => spec.id === scenario.id);
      return {
        id: `${selectedStyleId.value}-${scenario.id}`,
        side: scenario.id,
        tab: pages.length === 1 ? pages[0].name : pages.map((page) => page.tab).join(" / "),
        name: pages.length === 1 ? pages[0].name : pages.map((page) => page.name).join(" / "),
        kind: scenario.kind,
        description: sideSpec?.description || pages.map((page) => page.description).filter(Boolean).join(" / "),
        renderId: pages[0].id,
        sourceIds: pages.map((page) => page.id),
        components: [...new Set(pages.flatMap((page) => page.components))],
      };
    })
    .filter(Boolean);
});
const currentPageTabs = computed(() => {
  const pages = currentDemoPages.value.length ? [...currentDemoPages.value] : [...fallbackTemplatePages];
  const visiblePages = pages.filter(
    (page) => page.nav !== false && page.secondary !== true && page.evidenceOnly !== true,
  );
  return [...(visiblePages.length ? visiblePages : pages)].sort((a, b) => pageDemoRank(a) - pageDemoRank(b));
});
const activeScenarioTab = computed(() =>
  currentScenarioTabs.value.find((tab) => tab.sourceIds.includes(selectedTemplateId.value)),
);
const publishTemplateId = computed(() =>
  currentDemoPages.value.find((template) => template.side === "publish")?.id || fallbackTemplatePages.find((page) => page.id === "publish")?.id || "",
);
const activeSide = computed(() => activeScenarioTab.value?.side || selectedTemplate.value?.side || "");
const activeSideSpec = computed(() => sideComponentSpecs.find((spec) => spec.id === activeSide.value));
const selectedTemplateLayoutRecipe = computed(() => selectedTemplate.value?.layoutRecipe || "");
const isDistributionTemplate = computed(() => activeSide.value === "distribution");
const isDisplayTemplate = computed(() => activeSide.value === "display");
const selectedTemplateShell = computed(() => {
  const shell = selectedTemplate.value?.shell;
  return shell && typeof shell === "object" && !Array.isArray(shell) ? shell : {};
});
const isExplicitProofSurface = computed(() =>
  ["1", "desktop", "mobile"].includes(new URLSearchParams(window.location.search).get("proof")),
);
const isDesktopHeroProofSurface = computed(() =>
  (selectedTemplate.value?.id === "pokemon-tcg-official-home" || selectedStyleId.value === "dango")
    && new URLSearchParams(window.location.search).get("proof") === "desktop",
);
const isMobileProofSurface = computed(() =>
  (selectedTemplate.value?.id === "pokemon-tcg-official-home" || selectedStyleId.value === "dango")
    && new URLSearchParams(window.location.search).get("proof") === "mobile",
);
const selectedTemplateHasSchemaSections = computed(() =>
  Array.isArray(selectedTemplate.value?.sections) && selectedTemplate.value.sections.length > 0,
);
const isRuntimePagePreview = computed(() => selectedInspectorTab.value === "pages" && isRuntimePreviewTemplate.value);
const shellBoolean = (field, fallback) => {
  if (!isRuntimePagePreview.value) return fallback;
  if (selectedTemplateHasSchemaSections.value) return selectedTemplateShell.value[field] === true;
  return Object.prototype.hasOwnProperty.call(selectedTemplateShell.value, field)
    ? selectedTemplateShell.value[field] === true
    : fallback;
};
const showPreviewNavigationBar = computed(() => shellBoolean("navigationBar", true));
const showPreviewStatusBar = computed(() => shellBoolean("statusBar", true));
const showDemoBottomActions = computed(() => shellBoolean("bottomActions", isDistributionTemplate.value));
const showPublishFab = computed(() => shellBoolean("fab", selectedInspectorTab.value === "pages" && isDistributionTemplate.value));
const isPublishTemplate = computed(() => selectedTemplate.value?.side === "publish");
const isHomeTemplate = computed(() => {
  const homeId = currentDemoPages.value[0]?.id || templatePages[0]?.id;
  return selectedTemplateId.value === homeId;
});
const showNavigationBack = computed(() => selectedInspectorTab.value === "pages" && !isHomeTemplate.value);
const showNavigationLogo = computed(() => selectedInspectorTab.value === "pages" && isHomeTemplate.value);
const showNavigationActions = computed(() => selectedInspectorTab.value === "pages");
const navigationLogoText = computed(() => {
  const source = selectedStyle.value?.label || "DU";
  if (/Dango/i.test(source)) return "DU";
  if (/1999/.test(source)) return "99";
  if (/HPMA/i.test(source)) return "HP";
  if (/CZN/i.test(source)) return "CZ";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
});
const navigationTitle = computed(() => {
  if (selectedInspectorTab.value === "style") return "风格";
  if (selectedInspectorTab.value === "components") return activeComponentCategory.value.label;
  if (selectedInspectorTab.value === "pages" && isHomeTemplate.value) return "";
  if (selectedInspectorTab.value === "pages") return selectedTemplate.value.name || selectedTemplate.value.tab;
  if (activeScenarioTab.value?.tab) return activeScenarioTab.value.tab;
  return selectedTemplate.value.name || selectedTemplate.value.tab;
});
const showNavigationSearch = computed(() =>
  selectedInspectorTab.value === "pages" && pageInstances.value.some((instance) => instance.name === "Search"),
);
const navigationExampleBaseColor = computed(() => navExampleColor.value);
const navigationExampleRenderKey = computed(() => `navigation-example-${navExampleColor.value}`);
const searchExamplePlaceholder = computed(() => {
  const placeholders = {
    rolling: navigationExamplePlaceholders,
    single: "搜索活动、商品、攻略",
    empty: "",
  };
  return placeholders[componentExampleState.value.searchPlaceholder] ?? "";
});
const navigationSearchPlaceholder = computed(() => {
  const placeholders = {
    hpma: "搜索魔咒、伙伴、回响",
    czn: "搜索角色、情报、影像",
    re1999: "搜索档案、暴雨、角色",
    dango: "搜索组件、token、文档",
  };
  return placeholders[selectedStyleId.value] || "搜索内容";
});
const pageInstances = computed(() => {
  const scenario = selectedInspectorTab.value === "pages" ? null : activeScenarioTab.value;
  const sourcePages = scenario
    ? currentTemplatePages.value.filter((template) => scenario.sourceIds.includes(template.id))
    : [selectedTemplate.value];
  const componentNames = scenario?.components || selectedTemplate.value.components;
  return componentNames.map((name) => {
    const source = selectedTemplate.value.components.includes(name)
      ? selectedTemplate.value
      : sourcePages.find((template) => template.components.includes(name)) || selectedTemplate.value;
    return {
      id: pageNodeId(name, source.id),
      templateId: source.id,
      name,
      label: name,
      rendered: staticallyRenderedComponents.has(name),
      reason: placeholderReasons[name] || defaultPlaceholderReason,
    };
  });
});
const activeComponentCategory = computed(() =>
  componentCategorySpecs.find((category) => category.id === selectedComponentCategoryId.value) || componentCategorySpecs[0],
);
const componentPanelItems = computed(() =>
  activeComponentCategory.value.components.map((name) => ({
    id: `component-${activeComponentCategory.value.id}-${kebabName(name)}`,
    name,
    label: componentDisplayName(name),
    rendered: staticallyRenderedComponents.has(name),
    reason: placeholderReasons[name] || defaultPlaceholderReason,
  })),
);
const snapshotComponents = computed(() => {
  if (selectedInspectorTab.value !== "pages") return [];
  return [];
});
const currentListRows = computed(() => {
  if (activeSide.value === "display") return displayListRows;
  if (activeSide.value === "publish") return publishListRows;
  return distributionListRows;
});

const componentsByName = computed(() =>
  Object.fromEntries(catalog.value.components.map((component) => [component.name, component])),
);
const missingByName = computed(() =>
  Object.fromEntries((catalog.value.missingComponents || []).map((component) => [component.name, component])),
);
const uniqueComponentCount = computed(() => new Set(pageInstances.value.map((item) => item.name)).size);
const selectedStyle = computed(() => stylePresets.value.find((preset) => preset.id === selectedStyleId.value) || stylePresets.value[0]);
const selectedLearningProof = computed(() => {
  const style = selectedStyle.value || {};
  const report = style.learningProof || {};
  const isRuntime = Boolean(style.runtimePreview);
  const status = report.status || (isRuntime ? "unreported" : "reference-pack");
  const declaredPass = ["fidelity-pass", "learning-pass", "pass"].includes(status);
  const evidenceStatus = report.evidenceStatus || (style.evidenceNote ? "已校准" : "未报告");
  const structureStatus = report.structureStatus || (declaredPass ? "通过" : isRuntime ? "待独立 QA" : "参考样本");
  const generativeStatus = report.generativeStatus || "缺 held-out challenge";
  const generativePass = ["pass", "通过", "已通过"].includes(generativeStatus);
  const generativePending = /待.*(复验|QA|proof)/i.test(generativeStatus);
  const blockers = Array.isArray(report.blockers) ? [...report.blockers] : [];
  if (isRuntime && !declaredPass) blockers.unshift(`当前机器状态：${status}`);
  if (!generativePass && !generativePending) blockers.push("尚未用冻结规则通过 held-out generative challenge");
  return {
    overall: declaredPass && generativePass && blockers.length === 0 ? "可验收" : generativePending ? "待独立复验" : "未完成",
    proofs: [
      { id: "evidence", label: "Evidence", status: evidenceStatus, state: evidenceStatus === "未报告" ? "blocked" : "pass", note: "显著设计决定可追溯到源站证据。" },
      { id: "structure", label: "Structure", status: structureStatus, state: structureStatus === "通过" ? "pass" : "pending", note: "构图、层级、密度和节奏保留决定性特征。" },
      { id: "generative", label: "Generative", status: generativeStatus, state: generativePass ? "pass" : generativePending ? "pending" : "blocked", note: "冻结规则在未参与校准的新页面上仍成立。" },
    ],
    blockers: [...new Set(blockers)],
    hostApply: report.businessApply ? "已独立执行" : "未执行（不计入 Demo 三证）",
  };
});
const runtimePreviewAssets = computed(() => selectedStyle.value?.assets || {});
const runtimePreviewPalette = computed(() =>
  Array.isArray(selectedStyle.value?.categoryPalette) ? selectedStyle.value.categoryPalette : [],
);
const runtimePreviewCards = computed(() => (Array.isArray(selectedStyle.value?.cards) ? selectedStyle.value.cards : []));
const runtimePreviewPageKind = computed(() => selectedTemplate.value?.kind || "home");
const runtimeSchemaSections = computed(() =>
  Array.isArray(selectedTemplate.value?.sections) ? selectedTemplate.value.sections : [],
);
const isSourceSchemaTemplate = computed(() => isRuntimePreviewTemplate.value && runtimeSchemaSections.value.length > 0);
const schemaSectionKey = (section, index) => `${section?.id || section?.type || "section"}-${index}`;
const schemaSectionTypeName = (section, fallback = "section") => {
  const raw = String(section?.type || section?.id || fallback);
  return raw
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
};
const schemaContent = (section) => (section?.content && typeof section.content === "object" ? section.content : {});
const schemaAssets = (section) => (section?.assets && typeof section.assets === "object" ? section.assets : {});
const schemaText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const text = value.find((item) => typeof item === "string" && item.trim());
      if (text) return text;
    }
  }
  return "";
};
const schemaAssetSrc = (value) => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return value.src || value.front || value.image || value.logo || value.background || value.backgroundImage || value.url || "";
};
const normalizeSchemaAssetList = (items = []) =>
  (Array.isArray(items) ? items : [items])
    .map((item) => {
      const src = schemaAssetSrc(item);
      if (!src) return null;
      return typeof item === "string"
        ? { src, front: src, alt: selectedStyle.value?.label || "asset" }
        : { ...item, src, front: item.front || src, alt: item.alt || item.title || selectedStyle.value?.label || "asset" };
    })
    .filter(Boolean);
const schemaAssetList = (section, key) => normalizeSchemaAssetList(schemaAssets(section)[key]);
const schemaAsset = (section, ...keys) => {
  const assets = schemaAssets(section);
  for (const key of keys) {
    const src = schemaAssetSrc(assets[key]);
    if (src) return src;
  }
  return "";
};
const schemaItems = (section) => {
  const content = schemaContent(section);
  const items = content.items || content.links || content.tabs;
  return Array.isArray(items) ? items : [];
};
const schemaPlaceholderActionLabels = new Set(["action", "actions", "button", "cta"]);
const normalizeSchemaActionLabel = (label) => {
  const normalized = typeof label === "string" ? label.trim() : "";
  if (!normalized) return "";
  const compact = normalized.replace(/\s+/g, "");
  const lowerCompact = compact.toLowerCase();
  if (schemaPlaceholderActionLabels.has(normalized.toLowerCase()) || schemaPlaceholderActionLabels.has(lowerCompact)) return "";
  if (/^(action|actions|button|cta){2,}$/i.test(lowerCompact)) return "";
  return normalized;
};
const schemaActionLabel = (action) => {
  if (typeof action === "string") return normalizeSchemaActionLabel(action);
  if (!action || typeof action !== "object") return "";
  return normalizeSchemaActionLabel(schemaText(action.label, action.text, action.title, action.name));
};
const normalizeSchemaAction = (action) => {
  const label = schemaActionLabel(action);
  if (!label) return null;
  return typeof action === "object" && action !== null ? { ...action, label } : { label };
};
const schemaActions = (section) => {
  const content = schemaContent(section);
  if (Array.isArray(content.actions)) {
    return content.actions.map(normalizeSchemaAction).filter(Boolean);
  }
  if (Array.isArray(content.items)) {
    return content.items.map(normalizeSchemaAction).filter(Boolean);
  }
  if (content.cta && typeof content.cta === "object") {
    const action = normalizeSchemaAction(content.cta);
    return action ? [action] : [];
  }
  if (typeof content.cta === "string") {
    const label = normalizeSchemaActionLabel(content.cta);
    return label ? [{ label }] : [];
  }
  if (typeof content.label === "string") {
    const label = normalizeSchemaActionLabel(content.label);
    return label ? [{ label }] : [];
  }
  return [];
};
const recipeClass = (section) => (section?.recipe ? `schema-recipe--${section.recipe}` : "");
const renderMissing = (label) => h("div", { class: "source-schema-demo__missing" }, `${label} missing`);
const renderImage = (asset, className) =>
  asset?.src ? h("img", { class: className, src: asset.src, alt: asset.alt || asset.title || selectedStyle.value?.label || "asset" }) : renderMissing("asset");
const renderActionButton = (action, className = "source-schema-demo__cta") => {
  const label = schemaActionLabel(action);
  if (!label) return null;
  const href = action?.href || action?.url;
  return href
    ? h("a", { class: className, href, target: action?.target || undefined, rel: action?.target === "_blank" ? "noreferrer" : undefined }, label)
    : h("button", { type: "button", class: className, disabled: action?.disabled === true, "aria-disabled": action?.disabled === true ? "true" : undefined }, label);
};
const renderSchemaSection = (section, className, children, attrs = {}) =>
  h(
    "section",
    {
      ...attrs,
      class: [className, recipeClass(section), attrs.class].filter(Boolean),
      "data-schema-section-id": section?.id || "",
      "data-schema-section-type": section?.type || "",
      "data-schema-recipe": section?.recipe || "",
      "data-schema-component": section?.component || "",
    },
    children,
  );

const UnsupportedSchemaSection = defineComponent({
  name: "UnsupportedSchemaSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () =>
      h("section", { class: "source-schema-demo__unsupported" }, [
        h("strong", "Unsupported section"),
        h("code", props.section?.type || "<missing>"),
      ]);
  },
});

const SchemaBrandHeroSection = defineComponent({
  name: "SchemaBrandHeroSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    const scaleViewport = ref(null);
    const scale = ref(1);
    let scaleObserver = null;
    const initialControls = Array.isArray(schemaContent(props.section).controls) ? schemaContent(props.section).controls : [];
    const declaredActiveIndex = initialControls.indexOf(schemaContent(props.section).activeControl);
    const activeVariant = ref(declaredActiveIndex >= 0 ? declaredActiveIndex : 0);
    const featuredCardFlipped = ref(false);
    const mobileMenuOpen = ref(false);
    const toggleFeaturedCard = (event) => {
      event?.stopPropagation?.();
      featuredCardFlipped.value = !featuredCardFlipped.value;
    };
    const toggleFeaturedCardFromKeyboard = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleFeaturedCard(event);
    };
    const autoplaying = ref(true);
    let cycleTimer = null;
    const startCycle = () => {
      if (cycleTimer || !autoplaying.value) return;
      cycleTimer = window.setInterval(() => {
        const variants = schemaContent(props.section).variants || [];
        if (variants.length) activeVariant.value = (activeVariant.value + 1) % variants.length;
      }, 5000);
    };
    const stopCycle = () => {
      if (cycleTimer) window.clearInterval(cycleTimer);
      cycleTimer = null;
    };
    onMounted(() => {
      const isPokemonOfficialHomeHero = props.section?.id === "home-campaign-stage" && props.section?.recipe === "pokemon-home-stage";
      if (!isPokemonOfficialHomeHero) startCycle();
      scaleObserver = new ResizeObserver(([entry]) => { scale.value = entry.contentRect.width / 1440; });
      if (scaleViewport.value) scaleObserver.observe(scaleViewport.value);
    });
    onBeforeUnmount(() => { stopCycle(); scaleObserver?.disconnect(); });
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const variants = Array.isArray(content.variants) ? content.variants : [];
      const variant = variants[activeVariant.value] || {};
      const isPokemonOfficialHomeHero = section?.id === "home-campaign-stage" && section?.recipe === "pokemon-home-stage";
      const approvedCampaignVariant = isPokemonOfficialHomeHero ? (variants[0] || {}) : {};
      const logo = schemaAsset(section, "logo");
      const titleImage = variant.titleImage || (!isPokemonOfficialHomeHero ? approvedCampaignVariant.titleImage : null) || schemaAsset(section, "title", "titleImage");
      const background = variant.background || schemaAsset(section, "background", "backgroundImage");
      const cards = variant.product
        ? normalizeSchemaAssetList([variant.product])
        : !isPokemonOfficialHomeHero && approvedCampaignVariant.product
          ? normalizeSchemaAssetList([approvedCampaignVariant.product])
          : schemaAssetList(section, "cards");
      const responsiveBackground = background && typeof background === "object"
        ? background
        : isPokemonOfficialHomeHero
          ? { desktop: background, mobile: background }
          : null;
      const backgroundSrc = responsiveBackground ? schemaAssetSrc(responsiveBackground) : background;
      const actions = Array.isArray(variant.actions)
        ? variant.actions.map(normalizeSchemaAction).filter(Boolean)
        : schemaActions(section);
      const navigation = Array.isArray(content.navigation) ? content.navigation.filter(Boolean) : [];
      const controls = Array.isArray(content.controls) ? content.controls.filter(Boolean) : [];
      const assetOnly = content.assetOnly === true;
      const actionButtons = actions.map((action) => renderActionButton(action)).filter(Boolean);
      const heroChildren = [
        navigation.length ? h("nav", { class: "source-schema-demo__hero-nav", "aria-label": "Campaign navigation" }, [
          ...navigation.map((item) => h("span", { class: item === content.activeNavigation ? "is-active" : "" }, item)),
          isPokemonOfficialHomeHero ? h("button", {
            type: "button",
            class: "source-schema-demo__mobile-menu-trigger",
            "aria-label": mobileMenuOpen.value ? "Close campaign navigation" : "Open campaign navigation",
            "aria-expanded": mobileMenuOpen.value ? "true" : "false",
            onClick: () => { mobileMenuOpen.value = !mobileMenuOpen.value; },
          }, [
            h("span", { class: "source-schema-demo__mobile-menu-label" }, "MENU"),
            h("span", { class: "source-schema-demo__mobile-menu-icon", "aria-hidden": "true" }, [h("i"), h("i"), h("i")]),
          ]) : null,
        ]) : null,
        isPokemonOfficialHomeHero && mobileMenuOpen.value ? h("div", { class: "source-schema-demo__mobile-menu-panel" }, navigation.map((item) => h("button", {
          type: "button",
          class: item === content.activeNavigation ? "is-active" : "",
          onClick: () => { mobileMenuOpen.value = false; },
        }, item))) : null,
        assetOnly ? null : h("span", { class: "tag" }, section.component ? `${section.component} · schema` : "Section · schema"),
        !assetOnly && logo ? h("img", { class: "source-schema-demo__logo", src: logo, alt: `${selectedStyle.value?.label || "brand"} logo` }) : null,
        !assetOnly && (variant.eyebrow || content.eyebrow) ? h("span", { class: "source-schema-demo__hero-eyebrow" }, variant.eyebrow || content.eyebrow) : null,
        !assetOnly && titleImage ? h("img", { key: `title-image-${activeVariant.value}`, class: "source-schema-demo__hero-title-image source-schema-demo__campaign-swap", src: titleImage, alt: content.titleImageAlt || content.title || "Campaign title" }) : null,
        assetOnly || (content.hideTextTitle === true && !variant.showTextTitle) ? null : h("strong", { key: `title-text-${activeVariant.value}`, class: "source-schema-demo__hero-heldout-title source-schema-demo__campaign-swap" }, schemaText(variant.title, content.title, content.headline, selectedStyle.value?.hero, selectedStyle.value?.label)),
        isPokemonOfficialHomeHero && variant.proofRole === "generative-held-out" ? h("span", { class: "source-schema-demo__hero-proof-label source-schema-demo__campaign-swap" }, "GENERATIVE DEMO · NOT AN OFFICIAL CAMPAIGN") : null,
        assetOnly || content.hideDescription === true || isPokemonOfficialHomeHero ? null : h("p", schemaText(variant.description, content.description, content.body, selectedStyle.value?.notice)),
        !assetOnly && (variant.meta || content.meta) ? h("span", { class: "source-schema-demo__hero-meta" }, variant.meta || content.meta) : null,
        cards.length
          ? h("div", { class: "source-schema-demo__hero-cards" }, isPokemonOfficialHomeHero
            ? [h("button", {
                key: `featured-card-${activeVariant.value}`,
                type: "button",
                class: ["pokemon-featured-card", "source-schema-demo__campaign-swap", featuredCardFlipped.value ? "is-flipped" : ""],
                "aria-label": featuredCardFlipped.value ? "Show featured Pokémon card front" : "Show featured Pokémon card back",
                "aria-pressed": featuredCardFlipped.value ? "true" : "false",
                onClick: toggleFeaturedCard,
                onKeydown: toggleFeaturedCardFromKeyboard,
              }, [
                h("span", { class: "pokemon-featured-card__inner" }, [
                  h("img", {
                    class: "pokemon-featured-card__face pokemon-featured-card__face--front",
                    src: cards[0]?.src,
                    alt: cards[0]?.alt || "Featured Pokémon card front",
                  }),
                  h("img", {
                    class: "pokemon-featured-card__face pokemon-featured-card__face--back",
                    src: "/assets/brand-assets/pokemon-tcg-official/tcg-card-back.jpg",
                    alt: "Pokémon card back",
                  }),
                ]),
              ])]
            : cards.slice(0, 3).map((asset) => renderImage(asset, "source-schema-demo__card-art")))
          : null,
        !assetOnly && actionButtons.length ? h("div", { class: "source-schema-demo__actions source-schema-demo__actions--brand-hero" }, actionButtons) : null,
        controls.length ? h("div", { class: "source-schema-demo__hero-controls", "aria-label": "Campaign slides" }, [
          ...controls.map((item, index) => h("button", { type: "button", class: index === activeVariant.value ? "is-active" : "", "aria-label": `Show campaign ${item}`, onClick: () => { activeVariant.value = index; } }, item)),
          content.playControl === true ? h("button", { type: "button", class: "source-schema-demo__hero-play", "aria-label": autoplaying.value ? "Pause campaign carousel" : "Play campaign carousel", onClick: () => { autoplaying.value = !autoplaying.value; autoplaying.value ? startCycle() : stopCycle(); } }, autoplaying.value ? "Ⅱ" : "▶") : null,
        ]) : null,
        responsiveBackground ? h("picture", { key: `background-${activeVariant.value}`, class: "source-schema-demo__hero-responsive-bg source-schema-demo__campaign-swap", "aria-hidden": "true" }, [
          responsiveBackground.desktop ? h("source", { media: "(min-width: 520px)", srcset: responsiveBackground.desktop }) : null,
          h("img", { src: responsiveBackground.mobile || responsiveBackground.desktop || backgroundSrc, alt: "" }),
        ]) : null,
      ];
      const heroAttrs = {
        class: [assetOnly ? "source-schema-demo__hero--asset-only" : "", isPokemonOfficialHomeHero ? "source-schema-demo__hero--compact-interactive" : "", variants.length ? `source-schema-demo__hero--variant-${activeVariant.value + 1}` : ""],
        ...(backgroundSrc && !responsiveBackground ? { style: { "--schema-hero-bg": `url("${backgroundSrc}")` } } : {}),
      };
      return renderSchemaSection(section, "click-target source-schema-demo__hero", heroChildren, heroAttrs);
    };
  },
});

const SchemaActionClusterSection = defineComponent({
  name: "SchemaActionClusterSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const actions = schemaActions(props.section);
      const actionButtons = actions.map((action) => renderActionButton(action)).filter(Boolean);
      const assets = props.section?.assets || {};
      const decorativeLayer = (key, className, alt) => assets[key]
        ? h("img", { src: assets[key], class: className, alt, "aria-hidden": "true" })
        : null;
      return (
      renderSchemaSection(
        props.section,
        `click-target source-schema-demo__actions source-schema-demo__actions--${schemaSectionTypeName(props.section, "action-cluster")}`,
        [
          decorativeLayer("divider", "source-schema-demo__frame-divider", ""),
          decorativeLayer("frameLeft", "source-schema-demo__frame-wave source-schema-demo__frame-wave--left", ""),
          decorativeLayer("frameRight", "source-schema-demo__frame-wave source-schema-demo__frame-wave--right", ""),
          decorativeLayer("corner", "source-schema-demo__frame-corner", ""),
          assets.cardArt ? h("img", { src: assets.cardArt, class: "source-schema-demo__frame-card-art", alt: assets.cardArtAlt || "Featured card" }) : null,
          ...(actionButtons.length ? actionButtons : [renderMissing("actions")]),
        ],
      )
      );
    };
  },
});

const SchemaAssetStripSection = defineComponent({
  name: "SchemaAssetStripSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const cards = schemaAssetList(section, "cards");
      const visibleCards = cards.slice(0, Number.isFinite(Number(section.limit)) ? Number(section.limit) : 3);
      return renderSchemaSection(
        section,
        `click-target source-schema-demo__card-strip source-schema-demo__card-strip--${section.type || "asset-strip"}`,
        [
        h("span", { class: "tag" }, `${section.component || "Image"} · schema asset`),
          visibleCards.length
            ? h(
                "div",
                { class: "source-schema-demo__card-strip-track" },
                visibleCards.map((asset) => renderImage(asset, "source-schema-demo__strip-card-art")),
              )
            : renderMissing("cards"),
        ],
      );
    };
  },
});

const SchemaTabsSection = defineComponent({
  name: "SchemaTabsSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    const pressedIndex = ref(-1);
    let feedbackTimer = null;
    const restoreFeedback = () => {
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
      pressedIndex.value = -1;
    };
    const settleFeedback = () => {
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(restoreFeedback, 650);
    };
    onBeforeUnmount(restoreFeedback);
    return () => {
      const items = schemaItems(props.section);
      const hasDeclaredActiveItem = items.some((item) => item && typeof item === "object" && item.active === true);
      const visualFeedbackOnly = props.section?.interaction?.type === "text-color-feedback-only";
      const staticLabels = props.section?.interaction?.type === "static-labels";
      return renderSchemaSection(
        props.section,
        "click-target source-schema-demo__tabs",
        [
          schemaContent(props.section).title ? h("h1", { class: "source-schema-demo__tabs-title" }, schemaContent(props.section).title) : null,
          ...items.map((item, index) =>
          h("button", {
            type: "button",
            class: [
              !visualFeedbackOnly && !staticLabels && (item?.active || (!hasDeclaredActiveItem && index === 0)) ? "active" : "",
              visualFeedbackOnly && pressedIndex.value === index ? "is-feedback" : "",
            ],
            "aria-disabled": staticLabels ? "true" : undefined,
            tabindex: staticLabels ? "-1" : undefined,
            onPointerdown: visualFeedbackOnly ? () => { pressedIndex.value = index; } : undefined,
            onPointerup: visualFeedbackOnly ? settleFeedback : undefined,
            onPointercancel: visualFeedbackOnly ? restoreFeedback : undefined,
            onPointerleave: visualFeedbackOnly ? restoreFeedback : undefined,
            onBlur: visualFeedbackOnly ? restoreFeedback : undefined,
          }, item?.label || item?.text || item?.title || String(item)),
          ),
        ],
        {
          "data-interaction-boundary": visualFeedbackOnly
            ? "text-color-only-no-filter"
            : staticLabels ? "static-labels-no-selection" : undefined,
        },
      );
    };
  },
});

const SchemaFlipCardGallerySection = defineComponent({
  name: "SchemaFlipCardGallerySection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const cards = schemaAssetList(section, "cards");
      const cardBack = schemaAsset(section, "cardBack");
      return renderSchemaSection(section, "click-target source-schema-demo__gallery", [
        h("span", { class: "tag" }, "Card · flip schema"),
        cards.length
          ? cards.map((asset) =>
              h("article", { class: "source-schema-demo__card", tabindex: section?.interaction?.type === "static-card-grid" ? "-1" : "0" }, [
                h("div", { class: "source-schema-demo__card-transformer" }, [
                  renderImage(asset, "source-schema-demo__card-front"),
                  cardBack
                    ? h("img", { class: "source-schema-demo__card-back", src: cardBack, alt: "card back" })
                    : null,
                  h("span", { class: "source-schema-demo__shine", "aria-hidden": "true" }),
                ]),
              ]),
            )
          : renderMissing("cards"),
      ], {
        "data-interaction-boundary": section?.interaction?.type === "static-card-grid" ? "static-card-grid-no-flip" : undefined,
      });
    };
  },
});

const SchemaMegaEvolveSection = defineComponent({
  name: "SchemaMegaEvolveSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const cards = schemaAssetList(section, "cards");
      return renderSchemaSection(section, "source-schema-demo__mega", [
        h("strong", schemaText(content.title, "Mega Evolve")),
        h("p", schemaText(content.description, content.body)),
        h("div", { class: "source-schema-demo__mega-cards" }, cards.length ? cards.map((asset) => renderImage(asset, "source-schema-demo__card-art")) : renderMissing("cards")),
      ]);
    };
  },
});

const SchemaContentCardsSection = defineComponent({
  name: "SchemaContentCardsSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const cards = schemaAssetList(section, "cards");
      const products = schemaAssetList(section, "products");
      const assets = products.length ? products : cards;
      const filters = Array.isArray(content.filters) ? content.filters : [];
      const sectionType = schemaSectionTypeName(section, "content-cards");
      const assetKind = products.length ? "products" : "card-assets";
      const sectionClass = [
        "click-target source-schema-demo__content-cards",
        `source-schema-demo__content-cards--${sectionType}`,
        `source-schema-demo__content-cards--${assetKind}`,
      ].join(" ");
      const gridClass = [
        "source-schema-demo__product-grid",
        `source-schema-demo__product-grid--${sectionType}`,
        `source-schema-demo__product-grid--${assetKind}`,
      ].join(" ");
      const cardClass = [
        "source-schema-demo__product-card",
        `source-schema-demo__product-card--${sectionType}`,
        `source-schema-demo__product-card--${assetKind}`,
      ].join(" ");
      const imageClass = [
        "source-schema-demo__product-art",
        `source-schema-demo__product-art--${sectionType}`,
        `source-schema-demo__product-art--${assetKind}`,
      ].join(" ");
      return renderSchemaSection(section, sectionClass, [
        h("span", { class: "tag" }, `${section.component || "Card"} · schema`),
        h("strong", schemaText(content.title, section.type)),
        h("p", schemaText(content.description, content.body)),
        filters.length
          ? h("div", { class: "source-schema-demo__catalog-filters" }, filters.map((item, index) =>
              h("button", { type: "button", class: index === 0 || item?.active ? "active" : "" }, item?.label || String(item)),
            ))
          : null,
        h("div", { class: gridClass }, assets.length ? assets.map((asset) =>
          h("article", { class: cardClass }, [
            renderImage(asset, imageClass),
            asset.category || asset.code
              ? h("div", { class: "source-schema-demo__product-meta" }, [
                  asset.category ? h("span", asset.category) : null,
                  asset.code ? h("small", asset.code) : null,
                ])
              : null,
            h("strong", asset.title || asset.alt || "Asset"),
            asset.release ? h("small", { class: "source-schema-demo__product-release" }, asset.release) : null,
            asset.cta ? h("span", asset.cta) : null,
          ]),
        ) : renderMissing("assets")),
      ]);
    };
  },
});

const SchemaHomeWelcomeSection = defineComponent({
  name: "SchemaHomeWelcomeSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const background = schemaAsset(section, "background", "backgroundImage");
      const actions = schemaActions(section).map((action) => renderActionButton(action)).filter(Boolean);
      return renderSchemaSection(section, "click-target source-schema-demo__home-welcome", [
        h("div", { class: "opcg-welcome__cards", "aria-hidden": "true" }, Array.from({ length: 11 }, (_, index) => h("span", { class: `opcg-welcome__card opcg-welcome__card--${index + 1}` }, [
          h("img", { src: "/assets/brand-assets/onepiece-cardgame/source/welcome-card01.webp", alt: "" }),
        ]))),
        h("div", { class: "opcg-welcome__inner" }, [
        h("span", { class: "source-schema-demo__module-kicker" }, schemaText(content.kicker, "WELCOME")),
        h("strong", schemaText(content.title, "BEGIN YOUR ADVENTURE")),
        h("p", schemaText(content.description, content.body)),
        actions.length ? h("div", { class: "source-schema-demo__actions source-schema-demo__actions--home-welcome" }, actions) : null,
        ]),
      ], background ? { style: { "--schema-welcome-bg": `url("${background}")` } } : {});
    };
  },
});

const SchemaHomeEditorialListSection = defineComponent({
  name: "SchemaHomeEditorialListSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    const arrivalIndex = ref(0);
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const cards = section.id === "home-footer"
        ? (Array.isArray(section.assets?.cards) ? section.assets.cards : [])
        : schemaAssetList(section, "cards");
      const actions = schemaActions(section).map((action) => renderActionButton(action)).filter(Boolean);
      const hrefSets = {
        "home-new-arrival": ["/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/", "/products/decks/"],
        "home-events": ["/events/championship-26-27.html", "/events/", "/events/", "/events/", "/events/", "/events/"],
        "home-recommend": ["/events/championship-26-27.html", "/feature/deck/", "https://tutorial.onepiece-cardgame.com/en", "https://app.onepiece-cardgame.com/en/", "/events/friendship-meetup-st31-36.html"],
        "home-videos": ["https://www.youtube-nocookie.com/embed/9ZcW4RZKf4U", "https://www.youtube-nocookie.com/embed/oS7G8bVQn8A", "https://www.youtube-nocookie.com/embed/2YvQ4w0P2kI", "https://www.youtube-nocookie.com/embed/e3n7h1S9Y7Q", "https://www.youtube-nocookie.com/embed/5dVw8wZQ3uE"],
      };
      const sectionHrefs = hrefSets[section.id] || [];
      const linkedCard = (asset, index, className = "source-schema-demo__home-editorial-item") => h("a", {
        class: className,
        href: sectionHrefs[index] || asset.href || "/",
        target: /^https:\/\//.test(sectionHrefs[index] || "") ? "_blank" : undefined,
        rel: /^https:\/\//.test(sectionHrefs[index] || "") ? "noreferrer" : undefined,
      }, [
        renderImage(asset, "source-schema-demo__home-editorial-image"),
        h("div", [
          h("span", asset.category || "NEWS"),
          h("strong", asset.title || asset.alt || "Official update"),
          asset.release ? h("small", asset.release) : null,
        ]),
      ]);

      if (["home-new-arrival", "home-events", "home-recommend", "home-videos", "home-footer"].includes(section.id)) {
        const cardsForContract = [...cards];
        while (section.id === "home-events" && cardsForContract.length < 6) cardsForContract.push(cards[cardsForContract.length % cards.length]);
        while (["home-recommend", "home-videos"].includes(section.id) && cardsForContract.length < 5) cardsForContract.push(cards[cardsForContract.length % cards.length]);
        while (section.id === "home-new-arrival" && cardsForContract.length < 10) cardsForContract.push(cards[cardsForContract.length % cards.length]);
        if (section.id === "home-footer") {
          const nav = ["For Beginners", "Cards", "Rules", "Events", "Products", "News"];
          return renderSchemaSection(section, "click-target source-schema-demo__home-editorial opcg-footer", [
            h("div", { class: "opcg-footer__banners" }, [h("strong", "OFFICIAL ONE PIECE CARD GAME"), h("span", "Set sail with your crew")]),
            h("nav", { class: "opcg-footer__nav", "aria-label": "Footer navigation" }, nav.map((label, index) => h("div", { class: "opcg-footer__nav-row" }, [
              h("a", { href: index === 0 ? "/beginners/" : `/${label.toLowerCase()}/` }, label),
              h("button", { type: "button", "aria-label": `Show ${label} links` }, "+"),
            ]))),
            h("div", { class: "opcg-footer__actions" }, [
              h("a", { href: "https://sec.carddass.com/en/contact/" }, "CONTACT"),
              h("button", { id: "ot-sdk-btn", type: "button" }, "COOKIE SETTINGS"),
              h("a", { href: "/", class: "opcg-footer__home" }, [h("img", { src: "/assets/brand-assets/onepiece-cardgame/source/logo-op.png", alt: "ONE PIECE CARD GAME home" })]),
              h("a", { href: "https://www.bandai.co.jp/en/site/privacy/" }, "PRIVACY POLICY"),
              h("a", { href: "https://www.onepiece-cardgame.com/global/" }, "GLOBAL ENTRANCE"),
            ]),
            h("small", { class: "opcg-footer__legal" }, "© Eiichiro Oda/Shueisha, Toei Animation · ©BANDAI"),
          ]);
        }
        return renderSchemaSection(section, `click-target source-schema-demo__home-editorial opcg-${section.id.replace("home-", "")}`, [
          h("header", { class: "source-schema-demo__module-heading" }, [
            h("span", schemaText(content.kicker, section.id.replace("home-", "").toUpperCase())),
            h("h2", { class: "source-schema-demo__display-title" }, schemaText(content.title, content.kicker)),
          ]),
          h("div", {
            class: "source-schema-demo__home-editorial-list",
            role: "list",
            ...(section.id === "home-new-arrival" ? {
              "aria-label": `${arrivalIndex.value + 1} / ${cardsForContract.length}`,
              style: { transform: `translateX(${-181.998 * arrivalIndex.value}px)` },
            } : {}),
          }, cardsForContract.map((asset, index) => linkedCard(asset, index))),
          section.id === "home-new-arrival" ? h("div", { class: "opcg-arrival-controls" }, [
            h("button", {
              type: "button", "aria-label": "Previous products", disabled: arrivalIndex.value === 0,
              "aria-disabled": arrivalIndex.value === 0 ? "true" : "false", tabindex: arrivalIndex.value === 0 ? -1 : 0,
              onClick: () => { if (arrivalIndex.value > 0) arrivalIndex.value -= 1; },
            }, "←"),
            h("button", {
              type: "button", "aria-label": "Next products", disabled: arrivalIndex.value >= cardsForContract.length - 1,
              "aria-disabled": arrivalIndex.value >= cardsForContract.length - 1 ? "true" : "false", tabindex: arrivalIndex.value >= cardsForContract.length - 1 ? -1 : 0,
              onClick: () => { if (arrivalIndex.value < cardsForContract.length - 1) arrivalIndex.value += 1; },
            }, "→"),
          ]) : null,
          section.id === "home-events" ? h("a", { class: "source-schema-demo__cta opcg-events__all", href: "/events/" }, "VIEW ALL EVENTS") : null,
          section.id === "home-videos" ? h("a", { class: "source-schema-demo__cta opcg-videos__channel", href: "https://www.youtube.com/channel/UCMhxrrst-3oDFY2oWJGd29Q", target: "_blank", rel: "noreferrer" }, "OFFICIAL YouTube CHANNEL") : null,
        ]);
      }
      return renderSchemaSection(section, "click-target source-schema-demo__home-editorial", [
        h("header", { class: "source-schema-demo__module-heading" }, [
          h("span", schemaText(content.kicker, "NEWS")),
          h("h2", { class: "source-schema-demo__display-title" }, schemaText(content.title, "LATEST NEWS")),
        ]),
        h("div", { class: "source-schema-demo__home-editorial-list" }, cards.map((asset, index) => linkedCard(asset, index))),
        actions.length ? h("div", { class: "source-schema-demo__actions source-schema-demo__actions--home-editorial" }, actions) : null,
      ]);
    };
  },
});

const SchemaHomeFooterIllustrationSection = defineComponent({
  name: "SchemaHomeFooterIllustrationSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    const root = ref(null);
    const isIn = ref(false);
    const loopsPaused = ref(false);
    let observer = null;

    onMounted(() => {
      observer = new IntersectionObserver((entries) => {
        if (!isIn.value && entries.some((entry) => entry.isIntersecting)) {
          isIn.value = true;
          observer?.disconnect();
        }
      }, { threshold: 0.08 });
      if (root.value) observer.observe(root.value);
    });
    onBeforeUnmount(() => observer?.disconnect());

    return () => {
      const section = props.section;
      const assets = section.assets || {};
      const layer = (key, className, alt) => assets[key]
        ? h("img", { src: assets[key], class: className, alt, loading: "eager" })
        : null;
      return renderSchemaSection(section, `click-target source-schema-demo__footer-illustration footerIllust fadein${isIn.value ? " is-in" : ""}${loopsPaused.value ? " loops-paused" : ""}`, [
        h("div", { ref: root, class: "source-schema-demo__footer-observer", "aria-hidden": "true" }),
        h("div", { class: "source-schema-demo__footer-bg footerIllustItem footerIllustBg", "aria-hidden": "true" }, [
          h("div", {
            class: "source-schema-demo__footer-wave footerIllustBgItem showItem",
            style: assets.backgroundWave ? { backgroundImage: `url(${assets.backgroundWave})` } : null,
          }),
        ]),
        h("div", { class: "source-schema-demo__footer-character-wrap footerIllustItem footerIllustChara" }, [
          layer("character", "source-schema-demo__footer-character", "Monkey D. Luffy footer illustration"),
        ]),
        h("div", { class: "source-schema-demo__footer-card-stage footerIllustItem footerIllustCard" }, [
          h("div", { class: "source-schema-demo__footer-card-composite-wrap footerIllustCardItem inItem" }, [
            layer("cardComposite", "source-schema-demo__footer-card-composite", "ONE PIECE CARD GAME card composition"),
          ]),
          h("ul", { class: "source-schema-demo__footer-show-cards footerIllustCardItem showItem", "aria-label": "Featured cards" }, [
            h("li", { class: "cardItem card01" }, [layer("card01", "source-schema-demo__footer-card source-schema-demo__footer-card--01", "Featured card 01")]),
            h("li", { class: "cardItem card02" }, [layer("card02", "source-schema-demo__footer-card source-schema-demo__footer-card--02", "Featured card 02")]),
            h("li", { class: "cardItem card03" }, [layer("card03", "source-schema-demo__footer-card source-schema-demo__footer-card--03", "Featured card 03")]),
          ]),
        ]),
        h("div", { class: "source-schema-demo__footer-text footerIllustItem footerIllustTxt" }, [
          h("div", { class: "catch" }, [layer("catch", "source-schema-demo__footer-catch", "Set sail")]),
          h("div", { class: "logo" }, [layer("logo", "source-schema-demo__footer-logo", "ONE PIECE CARD GAME")]),
        ]),
        h("div", { class: "source-schema-demo__footer-control autoBtnCol" }, [
          h(DuButton, {
            type: "text",
            size: "mini",
            text: loopsPaused.value ? "▶" : "Ⅱ",
            extClass: "autoBtn js-bgAnimeBtn onepiece-footer-motion-control",
            class: `autoBtn js-bgAnimeBtn${loopsPaused.value ? " is-pause" : ""}`,
            "aria-label": loopsPaused.value ? "Resume footer card animation" : "Pause footer card animation",
            "aria-pressed": loopsPaused.value ? "true" : "false",
            onClick: (event) => { event.stopPropagation(); loopsPaused.value = !loopsPaused.value; },
          }),
        ]),
      ]);
    };
  },
});

const SchemaChecklistSection = defineComponent({
  name: "SchemaChecklistSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const items = Array.isArray(content.items) ? content.items : [];
      const actions = schemaActions(section);
      const actionButtons = actions.map((action) => renderActionButton(action)).filter(Boolean);
      return renderSchemaSection(section, "click-target source-schema-demo__checklist", [
        h("span", { class: "tag" }, `${section.component || "Card"} · schema`),
        h("strong", schemaText(content.title, "Checklist")),
        h("p", schemaText(content.description, content.body, content.summary)),
        items.length ? h("ul", items.map((item) => h("li", item?.label || item?.text || item?.title || String(item)))) : null,
        actionButtons.length ? h("div", { class: "source-schema-demo__actions source-schema-demo__actions--checklist-download" }, actionButtons) : null,
      ]);
    };
  },
});

const SchemaEventEditorialBoardSection = defineComponent({
  name: "SchemaEventEditorialBoardSection",
  props: {
    section: { type: Object, required: true },
  },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const events = Array.isArray(content.events) ? content.events : [];
      const schedule = Array.isArray(content.schedule) ? content.schedule : events;
      const recommendations = Array.isArray(content.recommendations) ? content.recommendations : events;
      const action = normalizeSchemaAction(content.action || content.cta);
      return renderSchemaSection(section, "click-target source-schema-demo__event-editorial-board", [
        h("header", { class: "source-schema-demo__event-board-heading" }, [
          h("strong", schemaText(content.title, "EVENTS")),
          h("span", schemaText(content.kicker, "CURRENT CREW CALLS")),
        ]),
        h("div", { class: "source-schema-demo__event-board-main" }, [
          h("section", { class: "source-schema-demo__event-rail", "aria-label": "Current fictional events" }, [
            h("div", { class: "source-schema-demo__event-rail-label" }, [
              h("strong", "CURRENT"),
              h("span", "EVENTS"),
            ]),
            h("div", { class: "source-schema-demo__event-rail-items" }, events.map((event) =>
              h("article", { class: "source-schema-demo__event-rail-item" }, [
                event.poster ? h("img", { src: event.poster, alt: event.title || "fictional event poster" }) : renderMissing("poster"),
                h("div", [
                  h("time", event.date || ""),
                  h("strong", event.title || "Fictional crew event"),
                  h("span", event.venue || ""),
                ]),
              ]),
            )),
          ]),
          h("aside", { class: "source-schema-demo__event-schedule", "aria-label": "Fictional event schedule" }, [
            h("div", { class: "source-schema-demo__event-schedule-heading" }, [
              h("strong", schemaText(content.scheduleTitle, "SCHEDULE")),
              h("span", schemaText(content.scheduleNote, "SEPTEMBER")),
            ]),
            h("ol", schedule.map((item) =>
              h("li", [
                h("time", item.date || ""),
                h("strong", item.title || "Fictional event"),
                h("span", item.time || item.venue || ""),
              ]),
            )),
            h("p", schemaText(content.scheduleFooter, "Fictional schedule · original test fixture")),
          ]),
        ]),
        h("section", { class: "source-schema-demo__event-wanted", "aria-label": "Fictional event recommendations" }, [
          h("div", { class: "source-schema-demo__event-wanted-heading" }, [
            h("strong", schemaText(content.recommendationTitle, "RECOMMEND")),
            h("span", "WANTED"),
          ]),
          h("div", { class: "source-schema-demo__event-wanted-strip" }, recommendations.slice(0, 3).map((event) =>
            h("figure", { class: "source-schema-demo__event-wanted-poster" }, [
              event.poster ? h("img", { src: event.poster, alt: `${event.title || "Fictional event"} recommendation poster` }) : renderMissing("poster"),
              h("figcaption", event.title || "Fictional event"),
            ]),
          )),
        ]),
        action ? h("div", { class: "source-schema-demo__event-board-action" }, [
          renderActionButton(action, "source-schema-demo__cta source-schema-demo__event-board-utility"),
        ]) : null,
      ]);
    };
  },
});

const SchemaOnePieceNewsFeatureSection = defineComponent({
  name: "SchemaOnePieceNewsFeatureSection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const cards = schemaAssetList(section, "cards");
      const lead = cards[0];
      const recommended = cards.slice(1);
      return renderSchemaSection(section, "click-target opcg-news-feature", [
        h("article", { class: "opcg-news-feature__lead" }, [
          h("div", { class: "opcg-news-feature__rail", "aria-hidden": "true" }, "NEWS"),
          h("div", { class: "opcg-news-feature__lead-body" }, [
            h("b", "LATEST NEWS"),
            lead ? renderImage(lead, "opcg-news-feature__lead-image") : renderMissing("lead"),
            h("div", { class: "opcg-news-feature__lead-copy" }, [
              h("small", lead?.category || "PRODUCTS"),
              h("h1", lead?.title || content.title || "LATEST INFORMATION"),
              h("p", lead?.description || content.description || "Latest ONE PIECE CARD GAME information."),
            ]),
          ]),
        ]),
        h("aside", { class: "opcg-news-feature__aside" }, [
          h("h2", "IMPORTANT NOTICE"),
          h("div", { class: "opcg-news-feature__notices" }, (content.notices || []).map((notice) => h("article", [
            h("time", notice.date), h("strong", notice.title),
          ]))),
          h("h2", "RECOMMENDED"),
          h("div", { class: "opcg-news-feature__recommended" }, recommended.map((card) => h("article", [
            renderImage(card, "opcg-news-feature__thumb"),
            h("small", `${card.release || ""} · ${card.category || "NEWS"}`),
            h("strong", card.title || "Official update"),
          ]))),
        ]),
      ]);
    };
  },
});

const SchemaOnePieceEventDiscoverySection = defineComponent({
  name: "SchemaOnePieceEventDiscoverySection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const cards = schemaAssetList(section, "cards");
      return renderSchemaSection(section, `click-target opcg-event-discovery opcg-event-discovery--${section.id}`, [
        h("header", { class: "opcg-event-discovery__heading" }, [
          content.kicker ? h("span", content.kicker) : null,
          h("h2", content.title),
          content.description ? h("p", content.description) : null,
        ]),
        h("div", { class: "opcg-event-discovery__grid" }, cards.map((card, index) => h("article", { class: index === 0 ? "is-primary" : "" }, [
          renderImage(card, "opcg-event-discovery__image"),
          h("div", { class: "opcg-event-discovery__copy" }, [
            card.category ? h("small", card.category) : null,
            h("strong", card.title || "Find an event"),
            card.description ? h("p", card.description) : null,
            card.cta ? h("span", card.cta) : null,
          ]),
        ]))),
      ]);
    };
  },
});

const SchemaPokemonDatabaseSection = defineComponent({
  name: "SchemaPokemonDatabaseSection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    const query = ref("");
    const searched = ref(false);
    const selectedEnergy = ref("");
    const advanced = ref(false);
    const advancedPhase = ref("closed");
    let advancedTimer = null;
    const submit = () => { if (query.value.trim()) searched.value = true; };
    const reset = () => { query.value = ""; searched.value = false; selectedEnergy.value = ""; };
    const toggleAdvanced = () => {
      if (advanced.value) {
        advanced.value = false;
        advancedPhase.value = "closed";
        if (advancedTimer) window.clearTimeout(advancedTimer);
        return;
      }
      advanced.value = true;
      advancedPhase.value = "triggered";
      advancedTimer = window.setTimeout(() => { advancedPhase.value = "settled"; }, 420);
    };
    onBeforeUnmount(() => { if (advancedTimer) window.clearTimeout(advancedTimer); });
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const cards = schemaAssetList(section, "cards");
      const energy = Array.isArray(content.energyTypes) ? content.energyTypes : [];
      return renderSchemaSection(section, "pokemon-db", [
        h("header", { class: "pokemon-db__title-plate" }, [
          h("img", { src: "/assets/brand-assets/pokemon-tcg-official/tcg-logo.png", alt: "Pokémon Trading Card Game" }),
          h("h1", schemaText(content.title, "Pokémon TCG Card Database")),
        ]),
        h("form", { class: "pokemon-db__search", onSubmit: (event) => { event.preventDefault(); submit(); } }, [
          h("div", { class: "pokemon-db__field-grid" }, [
            h("label", [h("span", "Card Name"), h("input", { id: "pokemon-card-name", value: query.value, placeholder: "Enter a card name", onInput: (event) => { query.value = event.target.value; searched.value = false; } })]),
            h("label", [h("span", "Card Text"), h("input", { placeholder: "Search card text" })]),
            h("label", [h("span", "Evolves From"), h("input", { placeholder: "Enter a Pokémon name" })]),
          ]),
          h("fieldset", { class: "pokemon-db__energy" }, [h("legend", "Energy Type"), ...energy.map((item) => h("button", {
            type: "button",
            class: selectedEnergy.value === item ? "is-selected" : "",
            "aria-pressed": selectedEnergy.value === item ? "true" : "false",
            onClick: () => { selectedEnergy.value = selectedEnergy.value === item ? "" : item; },
          }, item))]),
          h("div", { class: "pokemon-db__actions" }, [
            h("button", { type: "button", class: "pokemon-db__reset", onClick: reset }, "Reset"),
            h(DuButton, { type: "primary", size: "normal", text: "Search", class: "pokemon-db__submit" }),
          ]),
          h("button", { type: "button", class: "pokemon-db__advanced-toggle", "aria-expanded": advanced.value ? "true" : "false", onClick: toggleAdvanced }, advanced.value ? "Hide Advanced Search" : "Show Advanced Search"),
          h("div", { class: ["pokemon-db__advanced", advanced.value ? "is-open" : ""], "data-height-state": advancedPhase.value === "triggered" ? "triggered-724px" : advancedPhase.value === "settled" ? "settled-1206.73px" : "0px" }, advanced.value ? [
            h("section", [h("h2", "Card Type"), h("div", ["Pokémon", "Trainer", "Energy"].map((item) => h("label", [h("input", { type: "checkbox" }), item])))]),
            h("section", [h("h2", "Rarity"), h("div", ["Common", "Uncommon", "Rare", "Double Rare"].map((item) => h("label", [h("input", { type: "checkbox" }), item])))]),
            h("section", [h("h2", "Expansion"), h("select", [h("option", "All Expansions")])]),
            h("div", { class: "pokemon-db__actions" }, [h("button", { type: "button", class: "pokemon-db__reset" }, "Reset"), h("button", { type: "button", class: "pokemon-db__submit", onClick: submit }, "Search")]),
          ] : []),
        ]),
        searched.value ? h("section", { class: "pokemon-db__results", "aria-live": "polite" }, [
          h("header", [h("h2", "Search Results"), h("select", [h("option", "Sort by: Number")])]),
          h("p", { class: "pokemon-db__page-count" }, "1/12"),
          h("div", { class: "pokemon-db__card-grid" }, cards.map((asset) => renderImage(asset, "pokemon-db__card"))),
          h("nav", { class: "pokemon-db__pagination", "aria-label": "Results pages" }, [h("button", { type: "button" }, "Previous"), h("strong", "1"), h("button", { type: "button" }, "Next")]),
        ]) : h("p", { class: "pokemon-db__empty" }, "Enter a card name to search the official card database."),
      ], { "data-search-state": searched.value ? "results" : query.value ? "pikachu-entered" : "empty" });
    };
  },
});

const SchemaPokemonLearnSection = defineComponent({
  name: "SchemaPokemonLearnSection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    const openIndex = ref(0);
    const tcglRoot = ref(null);
    const tcglEntryState = ref("settled");
    const newsRoot = ref(null);
    const newsPage = ref(0);
    const newsOutgoingPage = ref(null);
    const newsDirection = ref(1);
    const newsCompact = ref(false);
    const pocketFixtureReviewed = ref(false);
    const championshipFixtureReviewed = ref(false);
    let newsResizeObserver = null;
    let newsTransitionTimer = null;
    let newsScrollRestoreTimer = null;
    let newsScrollContainer = null;
    let newsScrollSettleTimer = null;
    let newsLastStableScrollTop = 0;
    const rememberNewsScroll = () => {
      if (newsScrollSettleTimer) window.clearTimeout(newsScrollSettleTimer);
      newsScrollSettleTimer = window.setTimeout(() => {
        newsLastStableScrollTop = newsScrollContainer?.scrollTop || 0;
      }, 120);
    };
    const newsPageSize = () => newsCompact.value ? 1 : 2;
    const newsPages = () => Math.max(1, Math.ceil((schemaContent(props.section).stories || []).length / newsPageSize()));
    const changeNewsPage = (nextPage) => {
      const pageCount = newsPages();
      const target = Math.max(0, Math.min(pageCount - 1, nextPage));
      if (target === newsPage.value || newsOutgoingPage.value !== null) return;
      const scrollContainer = newsRoot.value?.closest?.(".phone-screen");
      const stableScrollTop = Number.isFinite(newsLastStableScrollTop) ? newsLastStableScrollTop : scrollContainer?.scrollTop;
      const restoreReadingPosition = () => {
        if (scrollContainer && Number.isFinite(stableScrollTop)) scrollContainer.scrollTop = stableScrollTop;
      };
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        || new URLSearchParams(window.location.search).get("reducedMotion") === "1";
      newsDirection.value = target > newsPage.value ? 1 : -1;
      if (reduceMotion) {
        newsPage.value = target;
        nextTick(restoreReadingPosition);
        return;
      }
      newsOutgoingPage.value = newsPage.value;
      newsPage.value = target;
      nextTick(() => {
        restoreReadingPosition();
        window.requestAnimationFrame(restoreReadingPosition);
      });
      newsTransitionTimer = window.setTimeout(() => {
        newsOutgoingPage.value = null;
        nextTick(restoreReadingPosition);
      }, 420);
      newsScrollRestoreTimer = window.setTimeout(restoreReadingPosition, 460);
    };
    onMounted(() => {
      if (props.section?.id !== "home-news-grid") return;
      newsResizeObserver = new ResizeObserver(([entry]) => {
        const wasCompact = newsCompact.value;
        newsCompact.value = entry.contentRect.width < 700;
        if (wasCompact !== newsCompact.value) {
          newsPage.value = 0;
          newsOutgoingPage.value = null;
          if (newsTransitionTimer) window.clearTimeout(newsTransitionTimer);
        }
      });
      if (newsRoot.value) newsResizeObserver.observe(newsRoot.value);
      newsScrollContainer = newsRoot.value?.closest?.(".phone-screen");
      if (newsScrollContainer) {
        newsLastStableScrollTop = newsScrollContainer.scrollTop;
        newsScrollContainer.addEventListener("scroll", rememberNewsScroll, { passive: true });
      }
    });
    onBeforeUnmount(() => {
      newsResizeObserver?.disconnect();
      if (newsTransitionTimer) window.clearTimeout(newsTransitionTimer);
      if (newsScrollRestoreTimer) window.clearTimeout(newsScrollRestoreTimer);
      if (newsScrollSettleTimer) window.clearTimeout(newsScrollSettleTimer);
      newsScrollContainer?.removeEventListener("scroll", rememberNewsScroll);
    });
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const items = Array.isArray(content.items) ? content.items : [];
      const cards = schemaAssetList(section, "cards");
      const hero = schemaAsset(section, "hero", "image", "video");
      const stories = Array.isArray(content.stories) ? content.stories : [];
      if (section?.id === "home-product-bands" && section?.recipe === "pokemon-product-band") {
        const asset = (key, fallback) => section.assets?.[key]?.src || section.assets?.[key] || fallback;
        const destination = content.href || "https://tcg.pokemon.com/en-us/tcgl/";
        return renderSchemaSection(section, "pokemon-tcgl", [
          h("div", { class: "pokemon-tcgl__scene", "aria-label": "Pokémon TCG Live on desktop and mobile" }, [
            h("img", { class: "pokemon-tcgl__asset pokemon-tcgl__laptop", src: asset("laptop", "/assets/brand-assets/pokemon-tcg-official/laptop.png"), alt: "Pokémon TCG Live laptop" }),
            h("img", { class: "pokemon-tcgl__asset pokemon-tcgl__pikachu", src: asset("pikachu", "/assets/brand-assets/pokemon-tcg-official/pikachu.png"), alt: "Pikachu" }),
            h("img", { class: "pokemon-tcgl__asset pokemon-tcgl__phone", src: asset("phone", "/assets/brand-assets/pokemon-tcg-official/phone.png"), alt: "Pokémon TCG Live phone" }),
            h("img", { class: "pokemon-tcgl__asset pokemon-tcgl__avatar pokemon-tcgl__avatar--one", src: asset("avatar1", "/assets/brand-assets/pokemon-tcg-official/avatar-1.png"), alt: "Pokémon TCG Live avatar" }),
            h("img", { class: "pokemon-tcgl__asset pokemon-tcgl__avatar pokemon-tcgl__avatar--two", src: asset("avatar2", "/assets/brand-assets/pokemon-tcg-official/avatar-2.png"), alt: "Pokémon TCG Live avatar" }),
          ]),
          h("div", { class: "pokemon-tcgl__copy" }, [
            h("h2", schemaText(content.title, "Pokémon TCG Live")),
            h("p", schemaText(content.description, "Experience the fun and strategy of the Pokémon Trading Card Game in a new way.")),
            h("a", { class: "pokemon-tcgl__cta", href: destination, onClick: (event) => { if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") event.preventDefault(); } }, [
              h("span", schemaText(content.cta, "Learn More")), h("b", { "aria-hidden": "true" }, "›"),
            ]),
          ]),
        ], { ref: tcglRoot, "data-entry-state": tcglEntryState.value, "data-cta-target": destination });
      }
      if (section?.recipe === "pokemon-tcg-pocket") {
        const asset = (key, fallback) => section.assets?.[key]?.src || section.assets?.[key] || fallback;
        const destination = content.href || "https://tcgpocket.pokemon.com/en-us";
        const fictionalFixture = content.fictional === true;
        return renderSchemaSection(section, fictionalFixture ? "pokemon-pocket pokemon-pocket--held-out" : "pokemon-pocket", [
          h("picture", { class: "pokemon-pocket__background", "aria-hidden": "true" }, [
            h("source", { media: "(max-width: 519px)", srcset: asset("mobileBackground", "/assets/brand-assets/pokemon-tcg-official/pocket-header-bg-small.jpg") }),
            h("img", { src: asset("desktopBackground", "/assets/brand-assets/pokemon-tcg-official/pocket-background.jpg"), alt: "" }),
          ]),
          fictionalFixture ? h("p", { class: "pokemon-pocket__fixture-label" }, content.fixtureLabel || "GENERATIVE FIXTURE · FICTIONAL · NOT AN OFFICIAL PRODUCT") : null,
          h("div", { class: "pokemon-pocket__asset-field" }, [
            fictionalFixture
              ? h("div", { class: "pokemon-pocket__fixture-art", "aria-label": "Fictional Pocket Deck Studio concept" }, [
                  h("span", { class: "pokemon-pocket__fixture-disc" }, "P"),
                  h("strong", "POCKET DECK STUDIO"),
                  h("span", "CONCEPT 01"),
                ])
              : h("img", { class: "pokemon-pocket__composite", src: asset("composite", "/assets/brand-assets/pokemon-tcg-official/logo-cards.png"), alt: "Pokémon Trading Card Game Pocket logo and featured digital cards" }),
          ]),
          h("div", { class: "pokemon-pocket__copy" }, [
            h("h2", schemaText(content.title, "POKÉMON TRADING CARD GAME POCKET")),
            h("p", schemaText(content.description, "Experience the fun of collecting Pokémon TCG cards with Pokémon Trading Card Game Pocket.")),
            fictionalFixture
              ? h("button", {
                  class: "pokemon-pocket__cta",
                  type: "button",
                  "aria-pressed": pocketFixtureReviewed.value ? "true" : "false",
                  onClick: () => { pocketFixtureReviewed.value = !pocketFixtureReviewed.value; },
                }, [
                  h("span", schemaText(content.cta, "Review the Concept")),
                  h("b", { "aria-hidden": "true" }, "›"),
                ])
              : h("a", { class: "pokemon-pocket__cta", href: destination, target: "_blank", rel: "noreferrer" }, [
                  h("span", schemaText(content.cta, "Play Now")),
                  h("b", { "aria-hidden": "true" }, "›"),
                ]),
            fictionalFixture ? h("p", { class: "pokemon-pocket__fixture-status", "aria-live": "polite" }, pocketFixtureReviewed.value
              ? "Concept review noted locally. This fictional fixture route remains open."
              : "Concept review is ready.") : null,
          ]),
        ], { "data-motion-fidelity": "unresolved-unscored", "data-cta-target": fictionalFixture ? "local-state" : destination, "data-proof-role": fictionalFixture ? "generative-held-out-fictional" : "source-calibration" });
      }
      if (section?.recipe === "pokemon-championship-series") {
        const asset = (key, fallback) => section.assets?.[key]?.src || section.assets?.[key] || fallback;
        const destination = content.href || "https://championships.pokemon.com/en-us/";
        const fictionalFixture = content.fictional === true;
        const ctaChildren = [h("span", schemaText(content.cta, fictionalFixture ? "Review the Program" : "Learn more")), h("b", { "aria-hidden": "true" }, "›")];
        return renderSchemaSection(section, fictionalFixture ? "pokemon-championship pokemon-championship--held-out" : "pokemon-championship", [
          h("div", { class: "pokemon-championship__media" }, [
            fictionalFixture
              ? h("div", { class: "pokemon-championship__fixture-art", "aria-label": "Original fictional arena-program visual" }, [
                  h("span", { class: "pokemon-championship__fixture-orbit", "aria-hidden": "true" }),
                  h("strong", "ARENA 04"),
                  h("small", "FIELD PROGRAM"),
                ])
              : h("img", {
                  src: asset("image", "/assets/brand-assets/pokemon-tcg-official/championships.jpg"),
                  srcset: `${asset("image", "/assets/brand-assets/pokemon-tcg-official/championships.jpg")} 1x, ${asset("image2x", "/assets/brand-assets/pokemon-tcg-official/championships-2x.jpg")} 2x`,
                  alt: "Pokémon International Championships players and trophy",
                }),
          ]),
          h("div", { class: "pokemon-championship__copy" }, [
            fictionalFixture ? h("p", { class: "pokemon-championship__fixture-label" }, content.fixtureLabel || "GENERATIVE FIXTURE · FICTIONAL · NOT A POKÉMON EVENT") : null,
            h("h2", schemaText(content.title, "POKÉMON CHAMPIONSHIP SERIES")),
            h("p", schemaText(content.description, "The Pokémon Championship Series is a competitive circuit of tournaments where Trainers from around the world gather to test their skills. Check out the Championship Series website to stay up to date on upcoming tournaments and tune in to watch the amazing battles online.")),
            fictionalFixture
              ? h("button", {
                  type: "button",
                  class: "pokemon-championship__cta",
                  onClick: () => { championshipFixtureReviewed.value = true; },
                }, ctaChildren)
              : h("a", { class: "pokemon-championship__cta", href: destination, target: "_blank", rel: "noreferrer" }, ctaChildren),
            fictionalFixture ? h("p", { class: "pokemon-championship__fixture-status", "aria-live": "polite" }, championshipFixtureReviewed.value ? "Fictional program review noted locally." : "Fictional program review is ready.") : null,
          ]),
        ], {
          "data-cta-target": fictionalFixture ? "local-state" : destination,
          "data-proof-role": fictionalFixture ? "generative-held-out-fictional" : "source-calibration",
        });
      }
      if (section?.recipe === "pokemon-play-pokemon-successor") {
        const image = section.assets?.image?.src || section.assets?.image || "/assets/brand-assets/pokemon-tcg-official/play-pokemon.jpg";
        return renderSchemaSection(section, "pokemon-play-successor", [
          h("img", { src: image, alt: "Play! Pokémon organized play" }),
          h("h2", schemaText(content.title, "Play! Pokémon")),
        ], { "data-boundary-role": "championship-successor" });
      }
      if (section?.id === "home-news-grid" && section?.recipe === "pokemon-home-news" && stories.length) {
        const heldOutProof = content.heldOutProof;
        const showHeldOutProof = new URLSearchParams(window.location.search).get("proof") === "heldout-news";
        const reducedMotionProof = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
          || new URLSearchParams(window.location.search).get("reducedMotion") === "1";
        const pageSize = newsPageSize();
        const pageCount = Math.max(1, Math.ceil(stories.length / pageSize));
        const pageStories = (page) => stories.slice(page * pageSize, page * pageSize + pageSize);
        const renderStory = (story) => h("article", { class: "pokemon-news__story", "data-story-src": story.sourceUrl || story.src }, [
          h("img", { class: "pokemon-news__image", src: story.src, alt: "" }),
          h("h3", story.title),
          h("button", { type: "button", class: "pokemon-news__cta" }, [h("span", story.cta || "Learn More"), h("b", { "aria-hidden": "true" }, "›")]),
        ]);
        const renderPage = (page, role) => h("div", {
          key: `${role}-${page}-${pageSize}`,
          class: ["pokemon-news__page", `is-${role}`, newsDirection.value > 0 ? "is-forward" : "is-backward"],
          "data-news-page": page,
        }, pageStories(page).map(renderStory));
        return renderSchemaSection(section, "pokemon-news", [
          h("header", { class: "pokemon-news__header" }, [
            h("h2", content.kicker || "WHAT'S NEW!"),
            h("button", { type: "button", class: "pokemon-news__more" }, [content.moreLabel || "See More News", h("span", { "aria-hidden": "true" }, "›")]),
          ]),
          h("div", { class: "pokemon-news__viewport", "aria-live": "polite" }, [
            newsOutgoingPage.value !== null ? renderPage(newsOutgoingPage.value, "outgoing") : null,
            renderPage(newsPage.value, newsOutgoingPage.value !== null ? "incoming" : "settled"),
          ]),
          h("div", { class: "pokemon-news__controls", "aria-label": "News carousel" }, [
            h("button", { type: "button", class: "pokemon-news__arrow pokemon-news__arrow--previous", disabled: newsPage.value === 0, "aria-label": "Previous news page", onMousedown: (event) => event.preventDefault(), onClick: () => changeNewsPage(newsPage.value - 1) }, "‹"),
            h("div", { class: "pokemon-news__dots" }, Array.from({ length: pageCount }, (_, index) => h("button", { type: "button", class: index === newsPage.value ? "is-active" : "", "aria-label": `Show news page ${index + 1}`, "aria-current": index === newsPage.value ? "true" : undefined, onMousedown: (event) => event.preventDefault(), onClick: () => changeNewsPage(index) }, h("span")))),
            h("button", { type: "button", class: "pokemon-news__arrow pokemon-news__arrow--next", disabled: newsPage.value === pageCount - 1, "aria-label": "Next news page", onMousedown: (event) => event.preventDefault(), onClick: () => changeNewsPage(newsPage.value + 1) }, "›"),
          ]),
          h("div", { class: "pokemon-news__source-seam", "aria-hidden": "true" }),
          showHeldOutProof && heldOutProof ? h("aside", { class: "pokemon-news__heldout", "aria-label": "Non-official generative proof fixture" }, [
            h("strong", "GENERATIVE PROOF · NON-OFFICIAL FIXTURE"),
            h("article", { class: "pokemon-news__story" }, [
              h("img", { class: "pokemon-news__image", src: heldOutProof.src, alt: "Abstract independent deck lab fixture" }),
              h("h3", heldOutProof.title),
              h("button", { type: "button", class: "pokemon-news__cta" }, [h("span", heldOutProof.cta), h("b", { "aria-hidden": "true" }, "›")]),
            ]),
          ]) : null,
        ], { ref: newsRoot, "data-page-count": pageCount, "data-active-page": newsPage.value, "data-transitioning": newsOutgoingPage.value !== null ? "true" : "false", "data-reduced-motion": reducedMotionProof ? "true" : "false" });
      }
      return renderSchemaSection(section, `pokemon-learn pokemon-learn--${schemaSectionTypeName(section)}`, [
        h("header", [h("span", content.kicker || "LEARN TO PLAY"), h("h2", schemaText(content.title, section.id)), content.description ? h("p", content.description) : null]),
        hero ? h("img", { class: "pokemon-learn__lead", src: hero, alt: content.title || "Pokémon TCG lesson" }) : null,
        items.length ? h("div", { class: "pokemon-learn__lessons" }, items.map((item, index) => h("article", { class: index === openIndex.value ? "is-open" : "" }, [
          h("button", { type: "button", "aria-expanded": index === openIndex.value ? "true" : "false", onClick: () => { openIndex.value = index; } }, [h("strong", item.title || item.label), h("span", index === openIndex.value ? "−" : "+")]),
          index === openIndex.value ? h("p", item.description || item.body || "Learn how this part of the game works.") : null,
          index === openIndex.value && cards[index % cards.length] ? renderImage(cards[index % cards.length], "pokemon-learn__diagram") : null,
        ]))) : null,
        !items.length && cards.length ? h("div", { class: "pokemon-learn__resource-grid" }, cards.map((asset) => h("article", [renderImage(asset, "pokemon-learn__resource"), h("strong", asset.title || asset.alt)]))) : null,
      ]);
    };
  },
});

const dangoDocsNavigationGroups = [
  { label: "GET STARTED", items: ["介绍", "安装", "快速开始"] },
  { label: "STYLE", items: ["Color 颜色", "Typography 字体", "Button 按钮"] },
  { label: "DELIVERY", items: ["发布检查", "迁移规范"] },
];

const dangoDocsHeader = () => h("header", { class: "dango-docs__utility-header" }, [
  h("div", { class: "dango-docs__identity", "aria-label": "Dango UI" }, [
    h("strong", "Dango UI"),
    h("small", "Beta"),
  ]),
  h("div", { class: "dango-docs__search", "aria-label": "Search documentation" }, [
    h("span", { "aria-hidden": "true" }, "⌕"),
    h("span", "搜索组件、token、文档"),
    h("kbd", "⌘ K"),
  ]),
  h("div", { class: "dango-docs__utilities", "aria-label": "Documentation utilities" }, [
    h("span", "设计系统"),
    h("span", "组件库"),
    h("span", "◐"),
  ]),
]);

const dangoDocsSidebar = (currentNav) => h("aside", { class: "dango-docs__sidebar", "aria-label": "Documentation navigation" },
  dangoDocsNavigationGroups.map((group) => h("section", { class: "dango-docs__nav-group" }, [
    h("strong", group.label),
    ...group.items.map((item) => h("span", {
      class: item === currentNav ? "is-current" : "",
      "aria-current": item === currentNav ? "page" : undefined,
    }, item)),
  ])),
);

const dangoDocsOutline = (content) => h("aside", { class: "dango-docs__outline", "aria-label": "On this page" }, [
  h("strong", "本页内容"),
  h("span", content.title || "概览"),
  h("span", content.exampleLabel ? "组件示例" : "结构说明"),
  h("span", "相关规范"),
]);

const dangoButtonSpecimen = (specimen, activated) => {
  const spec = typeof specimen === "string" ? { label: specimen } : specimen;
  const isPrimaryReference = (spec.type || "primary") === "primary" && (spec.size || "normal") === "normal" && !spec.disabled;
  return h(DuButton, {
  type: spec.type || "primary",
  size: spec.size || "normal",
  text: spec.label || "主要按钮",
  disabled: Boolean(spec.disabled),
  loading: Boolean(spec.loading),
  extClass: isPrimaryReference ? "dango-docs__primary" : "dango-docs__specimen",
  "data-action-state": activated.value ? "activated-focus-retained" : "default",
  onClick: () => { activated.value = true; },
  onBlur: () => { activated.value = false; },
});
};

const dangoPrimaryButton = (label, activated) => dangoButtonSpecimen({ label }, activated);

const dangoDocsModel = (items = []) => h("div", { class: "dango-docs__model", "aria-label": "System model" },
  items.map((item, index) => h("article", { class: "dango-docs__model-item" }, [
    h("span", item.index || String(index + 1).padStart(2, "0")),
    h("div", [h("strong", item.title), h("p", item.copy)]),
  ])),
);

const dangoTechnicalFlow = (lines = []) => h("pre", { class: "dango-docs__technical-flow", "aria-label": "Technical flow model" }, [
  h("code", lines.join("\n")),
]);

const dangoExampleModule = (module, activated) => h("section", { class: "dango-docs__reference-module" }, [
  h("h3", module.title),
  h("div", { class: "dango-docs__example-table" }, [
    h("div", { class: "dango-docs__example-preview" }, [
      ...(module.specimens || module.labels || ["主要按钮"]).map((specimen) => dangoButtonSpecimen(specimen, activated)),
    ]),
    h("pre", { class: "dango-docs__example-code" }, [h("code", module.code)]),
  ]),
]);

const dangoReferenceTable = (title, rows = []) => h("section", { class: "dango-docs__reference-table" }, [
  h("h3", title),
  h("div", { class: "dango-docs__table" }, [
    h("div", { class: "dango-docs__table-row dango-docs__table-head" }, [h("strong", "名称"), h("strong", "类型 / 默认值"), h("strong", "说明")]),
    ...rows.map((row) => h("div", { class: "dango-docs__table-row" }, [h("code", row.name), h("code", row.value), h("span", row.description)])),
  ]),
]);

const SchemaDangoDocsPageSection = defineComponent({
  name: "SchemaDangoDocsPageSection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    const activated = ref(false);
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const articleChildren = [
        h("span", { class: "dango-docs__eyebrow" }, content.page === "release" ? "DELIVERY" : content.page === "button" ? "COMPONENT" : "GET STARTED"),
        h("h1", content.title),
        h("div", { class: "dango-docs__title-rule", "aria-hidden": "true" }),
        h("p", { class: "dango-docs__lead" }, content.lead),
        h("p", { class: "dango-docs__body" }, content.description),
      ];
      if (Array.isArray(content.model) && content.model.length) {
        articleChildren.push(h("h2", content.page === "release" ? "交付前的三层检查" : "从基础规则到业务表达"));
        if (Array.isArray(content.technicalFlow)) articleChildren.push(dangoTechnicalFlow(content.technicalFlow));
        else articleChildren.push(dangoDocsModel(content.model));
        if (Array.isArray(content.layerNotes)) articleChildren.push(h("div", { class: "dango-docs__layer-notes" }, content.layerNotes.map((item) => h("p", [h("strong", item.title), " — ", item.copy]))));
      }
      if (content.importCode) articleChildren.push(h("pre", { class: "dango-docs__import" }, [h("code", content.importCode)]));
      if (Array.isArray(content.modules)) {
        articleChildren.push(h("h2", "示例"));
        articleChildren.push(...content.modules.map((module) => dangoExampleModule(module, activated)));
      }
      if (content.exampleLabel) {
        articleChildren.push(h("h2", "基础用法"));
        articleChildren.push(h("div", { class: "dango-docs__example-table" }, [
          h("div", { class: "dango-docs__example-preview" }, [dangoPrimaryButton(content.exampleLabel, activated)]),
          h("pre", { class: "dango-docs__example-code" }, [h("code", content.code || "<DuButton type=\"primary\" />")]),
        ]));
      }
      return renderSchemaSection(section, "dango-docs", [
        dangoDocsHeader(),
        h("div", { class: "dango-docs__layout" }, [
          dangoDocsSidebar(content.currentNav),
          h("main", { class: "dango-docs__article" }, articleChildren),
          dangoDocsOutline(content),
        ]),
      ], { "data-dango-page": content.page || "documentation" });
    };
  },
});

const SchemaDangoDocsContinuationSection = defineComponent({
  name: "SchemaDangoDocsContinuationSection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    const activated = ref(false);
    return () => {
      const section = props.section;
      const content = schemaContent(section);
      const items = Array.isArray(content.items) ? content.items : [];
      const referenceBlocks = [];
      if (Array.isArray(content.apiRows)) referenceBlocks.push(dangoReferenceTable("API · 属性", content.apiRows));
      if (Array.isArray(content.eventRows)) referenceBlocks.push(dangoReferenceTable("事件", content.eventRows));
      if (Array.isArray(content.themeRows)) referenceBlocks.push(dangoReferenceTable("主题变量", content.themeRows));
      return renderSchemaSection(section, "dango-docs-continuation", [
        h("div", { class: "dango-docs-continuation__main" }, [
          h("h2", content.title),
          h("p", content.description),
          items.length ? h("ul", items.map((item) => h("li", [h("span", { "aria-hidden": "true" }, "✓"), h("span", item)]))) : null,
          content.exampleLabel ? h("div", { class: "dango-docs-continuation__action" }, [
            dangoPrimaryButton(content.exampleLabel, activated),
            h("small", activated.value ? "检查已运行；按钮保持焦点样式。" : "点击后可通过移出焦点恢复默认状态。"),
          ]) : null,
          ...referenceBlocks,
        ]),
      ]);
    };
  },
});

const SchemaCznCurrentSection = defineComponent({
  name: "SchemaCznCurrentSection",
  props: { section: { type: Object, required: true } },
  setup(props) {
    const active = ref(0);
    const advance = (delta) => { const n = Math.max(1, props.section.content?.items?.length || 1); active.value = (active.value + delta + n) % n; };
    const nav = (content, assets) => h("nav", { class: "czn-current-nav" }, [h("img", { class: "czn-current-nav__logo", src: assets.logo, alt: "Chaos Zero Nightmare" }), ...content.navigation.map((item) => h("span", { class: item.id === content.activeNavigation ? "is-current" : "" }, [h("b", item.zh), h("small", item.en)]))]);
    const controls = (assets) => h("div", { class: "czn-current-controls" }, [-1, 1].map((delta) => h("button", { type: "button", "aria-label": delta < 0 ? "Previous" : "Next", onClick: () => advance(delta) }, h("img", { src: assets.arrow, alt: "", class: delta > 0 ? "is-next" : "" }))));
    return () => {
      const content = props.section.content; const assets = props.section.assets; const item = content.items[active.value];
      if (props.section.type === "czn-current-home") return renderSchemaSection(props.section, "czn-current czn-current-home", [h("video", { class: "czn-current-home__media", src: assets.video, poster: assets.poster, autoplay: true, muted: true, loop: true, playsinline: true }), h("div", { class: "czn-current-home__shade" }), nav(content, assets), h("img", { class: "czn-current-home__slogan", src: assets.slogan, alt: "CZN campaign slogan" }), h("section", { class: "czn-current-download" }, [h("img", { class: "czn-current-download__frame", src: assets.downloadFrame, alt: "" }), h("img", { class: "czn-current-download__qr", src: assets.qr, alt: "Download QR" }), h("div", [h("strong", "立即下载"), h("small", "DOWNLOAD NOW"), h("button", { type: "button", onClick: () => advance(1) }, active.value ? "恢复下载面板" : "展开平台列表")])])]);
      if (props.section.type === "czn-current-gameplay") return renderSchemaSection(props.section, "czn-current czn-current-gameplay", [h("img", { class: "czn-current-gameplay__bg", src: assets.background, alt: "" }), nav(content, assets), h("header", [h("small", "玩法介绍 / GAMEPLAY"), h("h2", item.title)]), h("figure", { class: "czn-current-gameplay__media" }, [h("img", { src: item.src, alt: item.title }), h("figcaption", item.description)]), controls(assets), h("ol", { class: "czn-current-timeline" }, content.items.map((_, i) => h("li", { class: i === active.value ? "is-current" : "" }, `${String(i + 1).padStart(2, "0")}/05`)))]);
      if (props.section.type === "czn-current-heldout") return renderSchemaSection(props.section, "czn-current czn-current-heldout", [nav(content, assets), h("strong", { class: "czn-current-heldout__disclosure" }, "FICTIONAL HELD-OUT / 非官方页面"), h("header", { class: "czn-current-heldout__heading" }, [h("small", "ABYSSAL SIGNAL ARCHIVE"), h("h2", item.title)]), h("figure", { class: "czn-current-heldout__media" }, [h("div", { class: "czn-current-heldout__signal" }, [h("i"), h("i"), h("i")]), h("figcaption", item.description)]), controls(assets), h("ol", { class: "czn-current-timeline" }, Array.from({ length: 5 }, (_, i) => h("li", { class: i === active.value ? "is-current" : "" }, `${String(i + 1).padStart(2, "0")}/05`)))]);
      return renderSchemaSection(props.section, "czn-current czn-current-character", [nav(content, assets), h("div", { class: "czn-current-portraits" }, content.rail.map((portrait, i) => h("button", { type: "button", class: i % content.items.length === active.value ? "is-current" : "", onClick: () => active.value = i % content.items.length }, h("img", { src: portrait.src, alt: portrait.name })))), h("img", { key: `${item.poster}-fallback`, class: "czn-current-character__subject czn-current-character__subject--fallback", src: item.poster, alt: item.name }), h("video", { key: item.video, class: "czn-current-character__subject czn-current-character__subject--motion", src: item.video, poster: item.poster, autoplay: true, muted: true, loop: true, playsinline: true, preload: "auto" }), h("section", { class: "czn-current-character__identity" }, [h("small", "角色档案 / CHARACTER"), h("h2", item.name), h("b", `CV / ${item.voice}`), h("p", item.description)]), h("div", { class: "czn-current-skills" }, item.skills.map((skill) => h("article", [h("img", { src: skill.src, alt: "" }), h("strong", skill.name)]))), controls(assets)]);
    };
  },
});

const sectionRendererRegistry = {
  "czn-current-home": SchemaCznCurrentSection,
  "czn-current-gameplay": SchemaCznCurrentSection,
  "czn-current-character": SchemaCznCurrentSection,
  "czn-current-heldout": SchemaCznCurrentSection,
  "brand-hero": SchemaBrandHeroSection,
  "action-cluster": SchemaActionClusterSection,
  "featured-card-strip": SchemaAssetStripSection,
  "filter-tabs": SchemaTabsSection,
  "anchor-navigation": SchemaTabsSection,
  "flip-card-gallery": SchemaFlipCardGallerySection,
  "center-cta": SchemaActionClusterSection,
  "mega-evolve-dual-card": SchemaMegaEvolveSection,
  "expansion-highlights": SchemaContentCardsSection,
  "product-gallery": SchemaContentCardsSection,
  "home-welcome": SchemaHomeWelcomeSection,
  "home-editorial-list": SchemaHomeEditorialListSection,
  "home-footer-illustration": SchemaHomeFooterIllustrationSection,
  "retailer-cta": SchemaActionClusterSection,
  "checklist-download": SchemaChecklistSection,
  "event-editorial-board": SchemaEventEditorialBoardSection,
  "onepiece-news-feature": SchemaOnePieceNewsFeatureSection,
  "onepiece-event-discovery": SchemaOnePieceEventDiscoverySection,
  "database-card-strip": SchemaAssetStripSection,
  "database-cta": SchemaActionClusterSection,
  "pokemon-database": SchemaPokemonDatabaseSection,
  "pokemon-learn-section": SchemaPokemonLearnSection,
  "dango-docs-page": SchemaDangoDocsPageSection,
  "dango-docs-continuation": SchemaDangoDocsContinuationSection,
  "dango-button-contract": SchemaDangoDocsContinuationSection,
  "dango-release-checklist": SchemaDangoDocsContinuationSection,
};
const isRuntimePreviewTemplate = computed(() =>
  Boolean(selectedStyle.value?.runtimePreview && (selectedTemplate.value?.id === selectedStyle.value.id || selectedTemplate.value?.id?.startsWith(`${selectedStyle.value.id}-`))),
);
const currentBrandPublishCopy = computed(() =>
  brandPublishCopy[selectedStyleId.value] || brandPublishCopy.czn,
);
const darkStatusbarStyleIds = new Set(["czn", "hpma", "re1999"]);
const isDarkStatusbarGhost = computed(() => darkStatusbarStyleIds.has(selectedStyleId.value));
const mockStatusbarClass = computed(() =>
  isDarkStatusbarGhost.value ? "mock-statusbar--ghost-dark" : "mock-statusbar--ghost-light",
);
const mockStatusbarMode = computed(() => ({
  color: isDarkStatusbarGhost.value ? "#ffffff" : "#111111",
  shadow: isDarkStatusbarGhost.value ? "0 1px 8px rgba(0, 0, 0, 0.42)" : "none",
}));
const selectedStyleCategory = computed(() =>
  styleCategories.find((category) => category.id === selectedStyleCategoryId.value),
);
const currentStyleCategoryDescription = computed(() =>
  selectedStyleCategoryId.value === "color" ? selectedStyle.value.evidenceNote : selectedStyleCategory.value?.description || "",
);
const currentStyleCapabilityNote = computed(() => {
  const notes = {
    typography: {
      title: "DangoUI baseline recipe",
      body: "Typography 先看 H/B/N scale，再看 Display/Body/Caption 的实际使用；品牌字体只在有字体包或明确证据时进入页面样式。",
    },
    icon: {
      title: "DangoUI baseline recipe",
      body: "Icon 只看 dangoui-icon-config 枚举和调用方式；品牌符号、图片装饰和缺失图标不混入 icon 表，分别进入 Asset 或待新增清单。",
    },
    button: {
      title: "Action schema",
      body: "Button 先看 DuButton / DuIconButton / DuActionButton 的真实 API；FAB 是待新增页面级悬浮行动，不塞进 DuButton type。",
    },
    asset: {
      title: "Asset usage guide",
      body: "Asset 不是让你看文件名，而是告诉你哪些图、视频、字体或裁切素材必须保留：先看它适合放在哪个页面区域，再决定用 Image、背景图、mask、视频或 slot 承接。",
    },
    divider: {
      title: "DangoUI baseline recipe",
      body: "Divider 先区分普通分割线、容器边界、选中线和装饰 Frame；普通线走 border token，特殊框进入 style-only / Asset。",
    },
    layout: {
      title: "DangoUI baseline recipe",
      body: "Layout 先判断通栏、卡片、贪心双列或灰白底关系，再把 bg、Spacing、Radius、Shadow 和安全区组合成页面初始化规则。",
    },
    spacing: {
      title: "DangoUI baseline recipe",
      body: "Spacing 用测量线表达距离关系：组件间 gap、网格 gutter、内部 padding 与系统安全区分开记录，未来由 spacing token scale 接管。",
    },
    radius: {
      title: "DangoUI baseline recipe",
      body: "Radius 用单容器表达每档圆角：frame/card/media/control/pill/circle 分开，风格化边框可反向约束容器圆角。",
    },
    shadow: {
      title: "DangoUI baseline recipe",
      body: "Shadow 用单容器表达 none、elevation、inset line 与 brand glow；没有证据时保持 none，不为选中态补阴影。",
    },
    motion: {
      title: "DangoUI schema",
      body: "有 Snackbar / Transition 组件能力，但未发现 --du-motion-* token；动效参数走组件 props 或交互 CSS。",
    },
  };
  return notes[selectedStyleCategoryId.value] || null;
});
const computedEvidenceEntries = {};
const evidenceRolesByCategory = {
  color: ["hero", "cta-active", "surface", "navigation"],
  typography: ["hero"],
  icon: ["navigation", "cta-active"],
  button: ["cta-active"],
  asset: ["hero", "torn-paper-edge", "surface"],
  divider: ["torn-paper-edge", "frame", "surface"],
  layout: ["surface", "frame"],
  spacing: ["surface"],
  radius: ["surface", "cta-active"],
  shadow: ["frame", "surface", "hero"],
  motion: ["hero"],
};
const evidenceFallbackByCategory = {
  color: {
    look: "先看页面最终颜色占比和关键组件颜色",
    computed: "读取 color / backgroundColor / borderColor / boxShadow",
    source: "反查 CSS token、inline style、截图采样和 asset 降权结果",
  },
  typography: {
    look: "先看标题、导航、按钮最终字体",
    computed: "读取 computed font-family / font-weight / line-height",
    source: "反查 @font-face、远程字体 URL、本地字体包和 fallback",
  },
  icon: {
    look: "先看图标是否来自组件库、图片资产还是状态图",
    computed: "读取实际 svg/icon class/currentColor 或 background-image",
    source: "反查 dangoui-icon-config、Image 资产或 selected state asset",
  },
  button: {
    look: "先看主行动按钮和悬浮行动最终形态",
    computed: "读取 background、border、radius、shadow、font 和 active state",
    source: "反查 DuButton API、component class、style-only CTA recipe",
  },
  asset: {
    look: "先看页面真正加载了什么图片、背景、字体和视频",
    computed: "读取 img currentSrc、background-image、mask、border-image、font-family",
    source: "反查 asset inventory，区分官方内容资产和抽象风格资产",
  },
  divider: {
    look: "先看它是普通线、选中线、容器边界还是装饰框",
    computed: "读取 borderColor、box-shadow、pseudo-element 和 background-image",
    source: "普通线进 --du-border-*；Frame/纹理进 style-only recipe",
  },
  layout: {
    look: "先看页面是通栏、卡片、贪心双列还是灰白底关系",
    computed: "读取背景层、内容面、gap、safe-area、BottomBar 覆盖关系",
    source: "反查 layout recipe、bg token、Spacing、Radius、Shadow",
  },
  spacing: {
    look: "先看组件之间、网格之间和内容内距",
    computed: "读取 gap、padding、margin、safe-area",
    source: "映射到未来 spacing token 或页面 recipe",
  },
  radius: {
    look: "先看容器、媒体、控件、pill 是否是同一类圆角",
    computed: "读取 border-radius 和真实容器边界",
    source: "映射到 radius recipe；不要把 control radius 泛化到 card/frame",
  },
  shadow: {
    look: "先看最终是否真的有阴影、内线或氛围光",
    computed: "读取 box-shadow/filter/drop-shadow",
    source: "无证据保持 none；glow 进入 effect recipe，不当 elevation",
  },
  motion: {
    look: "先看动效是自动播放、hover、tap 还是状态切换",
    computed: "读取 transition、animation、transform 和触发方式",
    source: "组件 props 或 interaction CSS；无 --du-motion-* 时不伪造 token",
  },
};
function evidenceEntriesForCategory(styleId, categoryId) {
  const roles = evidenceRolesByCategory[categoryId] || [];
  const entries = computedEvidenceEntries[styleId] || [];
  return entries.filter((entry) => roles.includes(entry.role));
}
function evidencePrimaryEntry(styleId, categoryId) {
  return evidenceEntriesForCategory(styleId, categoryId)[0] || null;
}
function styleSignalForCategory(categoryId) {
  const signals = selectedStyle.value.signals || [];
  if (categoryId === "typography") return signals.find((signal) => /font|字体|MIANFEIZITI|Serif|Sans|Didot/i.test(`${signal.raw} ${signal.value} ${signal.target}`));
  if (categoryId === "asset") return signals.find((signal) => /asset|图片|logo|bg|font|frame|edge|素材|video|png|jpg|webp/i.test(`${signal.raw} ${signal.value} ${signal.target}`));
  if (categoryId === "button") return signals.find((signal) => /cta|button|行动|按钮|primary|download|预约|下载/i.test(`${signal.raw} ${signal.value} ${signal.target}`));
  if (categoryId === "divider") return signals.find((signal) => /border|frame|divider|边框|边界|线|edge/i.test(`${signal.raw} ${signal.value} ${signal.target}`));
  if (categoryId === "shadow") return selectedStyle.value.style?.cardShadow ? { raw: selectedStyle.value.style.cardShadow, target: "Shadow / effect recipe", value: "卡片、舞台或无阴影策略" } : null;
  return signals.find((signal) => isColorSignal(signal.raw)) || signals[0];
}
function styleRecipeForCategory(categoryId) {
  const rows = selectedStyleRecipeRows.value || [];
  return rows[0] || null;
}
function computedValueSummary(entry, categoryId) {
  if (!entry?.styles) return "";
  const styles = entry.styles;
  if (categoryId === "typography") return styles.fontFamily || styles.color || "";
  if (categoryId === "asset") return styles.backgroundImage || styles.fontFamily || "";
  if (categoryId === "button") return [styles.backgroundColor, styles.borderColor, styles.backgroundImage].filter(Boolean).join(" / ");
  if (categoryId === "divider") return [styles.borderColor, styles.backgroundImage, styles.boxShadow].filter(Boolean).join(" / ");
  if (categoryId === "shadow") return styles.boxShadow || "none";
  if (categoryId === "motion") return styles.animation || styles.transition || "当前 demo 无 motion computed，保留为待验证";
  return [styles.color, styles.backgroundColor, styles.borderColor].filter(Boolean).join(" / ");
}
const currentEvidenceChainSummary = computed(() => {
  const entryCount = evidenceEntriesForCategory(selectedStyle.value.id, selectedStyleCategoryId.value).length;
  if (entryCount) return `${selectedStyle.value.label} 已接入 ${entryCount} 条 computed 证据，先看最终效果再回填 token / recipe。`;
  return `${selectedStyle.value.label} 当前用 signals / recipe 做草稿证据，后续要补 computed diff。`;
});
const currentEvidenceChainState = computed(() => {
  const entryCount = evidenceEntriesForCategory(selectedStyle.value.id, selectedStyleCategoryId.value).length;
  return entryCount ? "computed" : "draft";
});
const currentEvidenceChainRows = computed(() => {
  const categoryId = selectedStyleCategoryId.value;
  const fallback = evidenceFallbackByCategory[categoryId] || evidenceFallbackByCategory.color;
  const entry = evidencePrimaryEntry(selectedStyle.value.id, categoryId);
  const signal = styleSignalForCategory(categoryId);
  const recipe = styleRecipeForCategory(categoryId);
  const computedValue = computedValueSummary(entry, categoryId);
  const sourceValue = entry
    ? `${entry.selector} · ${entry.role}`
    : signal
      ? `${signal.raw} · ${signal.percent || signal.count || "signal"}`
      : selectedStyle.value.source;
  const targetValue = recipe?.target || signal?.target || "dangoui token / style-only recipe / ReviewQueue";
  return [
    {
      step: "1",
      title: "看最终效果",
      value: entry ? `${entry.selector} 这个真实节点` : fallback.look,
      note: "不要先从文件名、品牌印象或局部截图下结论。",
    },
    {
      step: "2",
      title: "读 computed",
      value: computedValue || fallback.computed,
      note: entry ? "这是浏览器最终算出来的值。" : "当前缺 computed 时只能算草稿证据。",
    },
    {
      step: "3",
      title: "反查来源",
      value: sourceValue,
      note: fallback.source,
    },
    {
      step: "4",
      title: "落地方案",
      value: targetValue,
      note: recipe?.note || signal?.value || "能进 DangoUI token 就进 token；不能承接就进入 style-only 或待确认。",
    },
  ];
});
const recipeSwatchClass = computed(() => `recipe-swatch-${selectedStyleCategoryId.value}`);

function motionRecipeKey(item) {
  const title = String(item.title || "").toLowerCase();
  if (/press|按压|点击/.test(title)) return "press";
  if (/tab|switch|segment|切换/.test(title)) return "tab-switch";
  if (/snackbar|toast|feedback|反馈/.test(title)) return "feedback";
  if (/atmosphere|背景|drift|氛围/.test(title)) return item.visualKey === "background-drift" && title.includes("atmosphere") ? "atmosphere" : title;
  return title;
}

function shouldAppendBrandMotionRecipe(item) {
  const key = motionRecipeKey(item);
  if (["press", "tab-switch", "feedback"].includes(key)) return false;
  return Boolean(item.visualKey || item.operatorLabel || item.kind === "style");
}

function mergedMotionRecipeRows(categoryRows) {
  const baseRows = styleRecipeDetails.dango?.motion || fallbackStyleRecipeDetails.motion || [];
  const merged = new Map(baseRows.map((item) => [motionRecipeKey(item), item]));
  categoryRows.forEach((item) => {
    if (!shouldAppendBrandMotionRecipe(item)) return;
    const key = motionRecipeKey(item);
    if (key === "atmosphere" && merged.has("atmosphere")) {
      merged.set(key, { ...merged.get(key), ...item });
      return;
    }
    merged.set(key, item);
  });
  return [...merged.values()];
}

const selectedStyleRecipeRows = computed(() => {
  const recipe = {
    ...styleRecipeDetails,
    ...runtimeStyleRecipeDetails.value,
  }[selectedStyle.value.id];
  const categoryRows = recipe?.[selectedStyleCategoryId.value] || [];
  const fallbackRows = fallbackStyleRecipeDetails[selectedStyleCategoryId.value] || [];
  const rows = selectedStyleCategoryId.value === "motion"
    ? selectedStyle.value.id === "dango"
      ? categoryRows
      : mergedMotionRecipeRows(categoryRows)
    : selectedStyleCategoryId.value === "typography"
    ? selectedStyle.value.id === "dango"
      ? [...fallbackRows, ...categoryRows]
      : [...fallbackRows, ...categoryRows.map((item) => ({ ...item, title: `Brand ${item.title}` }))]
    : categoryRows.length
      ? categoryRows
      : fallbackRows;
  const usesBrandRows = selectedStyle.value.id !== "dango" && selectedStyleCategoryId.value !== "motion" && categoryRows.length > 0;
  return rows.map((item, index) => {
    const normalized = {
      ...item,
      source: item.source || styleInventorySource(selectedStyleCategoryId.value, item, index),
      target: item.target || styleRecipeMappingTarget(selectedStyleCategoryId.value, item),
      status: item.status || styleRecipeStatus(selectedStyleCategoryId.value, item),
    };
    return usesBrandRows ? decorateStyleRecipeItem(normalized, selectedStyleCategoryId.value, selectedStyle.value.label) : normalized;
  });
});

function decorateStyleRecipeItem(item, category, brandLabel) {
  if (item.operatorLabel) return item;
  const text = `${item.title || ""} ${item.value || ""} ${item.note || ""}`;
  const isStyleOnly = /frame|角线|asset|texture|background|font|motion|glow|ornate|HUD|mask|image|图片|纹理|字体|动效|装饰|斜切|主视觉/i.test(text);
  const kind = item.kind || (isStyleOnly ? "style" : "token");
  const categoryLabelMap = {
    typography: "字体",
    icon: "图标",
    button: "按钮",
    asset: "资产",
    divider: "边界",
    layout: "布局",
    spacing: "间距",
    radius: "圆角",
    shadow: "阴影",
    motion: "动效",
  };
  const categoryLabel = categoryLabelMap[category] || "风格";
  const firstSentence = String(item.note || "").split(/[；。]/).filter(Boolean)[0] || `${brandLabel} 的 ${categoryLabel}规则`;
  const affiliation = item.affiliation || `${brandLabel} ${kind === "style" ? "风格化样式" : "token 覆盖"} · ${kind === "style" ? "style-only" : item.target || item.source}`;
  const antiByCategory = {
    typography: "不要只靠系统字体猜风格；有字体包证据时必须保留字体资产。",
    icon: "不要把品牌图片资产硬塞进 DangoUI icon 枚举。",
    button: "不要为了品牌感随手加重阴影、图片边框或不存在的 Button API。",
    asset: "不要把图片、纹理、字体资产写成 --du-* color token。",
    divider: "不要把风格化边框简化成普通 1px border，也不要无依据加内框。",
    spacing: "不要把页面节奏写成零散魔法值；要说明它服务哪个页面关系。",
    radius: "不要把 control 圆角泛化到 card/media/frame 容器。",
    shadow: "不要为了明显而补 shadow；没有证据就保持 none。",
    motion: "不要给所有小组件加动画；动效只服务有证据的氛围层或状态。",
  };
  const usageByCategory = {
    typography: "标题、正文、标签、导航等对应文字层级。",
    icon: "通用动作图标、品牌符号或状态图标。",
    button: "主行动、次行动、分发入口、悬浮入口。",
    asset: "页面背景、主视觉、装饰层、状态图、字体包。",
    divider: "列表分割、容器边界、媒体框、选中边界或装饰框。",
    spacing: "页面内距、内容块间距、组件内部间距和行动入口间距。",
    radius: "Card / media / frame / control / pill 等不同形状语义。",
    shadow: "浮层、舞台、卡片或无阴影策略。",
    motion: "Hero、背景氛围、核心面板入场或状态反馈。",
  };
  return {
    ...item,
    kind,
    affiliation,
    operatorLabel: `${item.title}：${firstSentence}`,
    usage: item.usage || usageByCategory[category] || item.target,
    anti: item.anti || antiByCategory[category] || "不要把无证据的视觉习惯伪装成品牌规则。",
  };
}
const typographyMatrixGroups = computed(() => {
  const labels = {
    H: "标题 / 强强调",
    B: "正文强调 / 组件标题",
    N: "正文 / 说明 / 辅助",
  };
  const rows = (fallbackStyleRecipeDetails.typography || [])
    .filter((item) => /^[HBN][1-8]$/.test(item.title))
    .map((item) => {
      const parts = String(item.value).split("/").map((part) => firstNumber(part, 0));
      return {
        ...item,
        family: item.title[0],
        size: parts[0] || 12,
        weight: parts[1] || 400,
        lineHeight: parts[2] || parts[0] || 18,
      };
    });
  return ["H", "B", "N"].map((id) => ({
    id,
    label: labels[id],
    items: rows.filter((item) => item.family === id),
  }));
});
function iconExportToName(exportName) {
  return String(exportName)
    .replace(/^icon/, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}
const iconLibraryRows = computed(() =>
  Object.entries(DangoIconConfig)
    .filter(([exportName, icon]) => exportName.startsWith("icon") && icon && typeof icon === "object" && "_" in icon)
    .map(([exportName, icon]) => ({
      exportName,
      name: iconExportToName(exportName),
      icon,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);
const spacingScaleRows = computed(() =>
  selectedStyleRecipeRows.value.map((item) => {
    const size = firstNumber(item.value, 8);
    return {
      ...item,
      title: item.title,
      label: recipeSwatchText(item),
      size: Math.min(size, 34),
      width: Math.max(8, Math.min(size * 2.5, 72)),
      source: item.source,
      target: item.target,
      value: item.value,
      note: item.note,
    };
  }),
);
const radiusScaleRows = computed(() =>
  selectedStyleRecipeRows.value.map((item) => {
    const isCircle = String(item.value).includes("%");
    const isPill = String(item.value).includes("999");
    const size = isPill ? 48 : Math.min(firstNumber(item.value, 8), 28);
    return {
      ...item,
      title: item.title,
      label: recipeSwatchText(item),
      radius: isCircle ? "50%" : isPill ? "999px" : `${size}px`,
      source: item.source,
      target: item.target,
      value: item.value,
      note: item.note,
    };
  }),
);
const dividerScaleRows = computed(() =>
  selectedStyleRecipeRows.value.map((item) => {
    const text = `${item.title} ${item.value}`.toLowerCase();
    const kind = text.includes("selection") || text.includes("underline")
      ? "selection"
      : text.includes("frame") || text.includes("hud") || text.includes("ornate") || text.includes("card") || text.includes("panel")
        ? "frame"
        : "divider";
    return {
      ...item,
      kind,
    };
  }),
);
const selectedStyleTokenMap = computed(() => {
  const tokenMap = Object.fromEntries(selectedStyle.value.tokens.map((token) => [token.name, token.value]));
  const semanticRoles = selectedStyle.value.semanticRoles || {};
  const semanticPrimaryFill = semanticRoles["action.primary.fill"]?.value;
  const semanticActiveFill = semanticRoles["action.active.fill"]?.value;
  const semanticNeutralSurface = semanticRoles["action.neutral.surface"]?.value;
  const semanticTextBorder = semanticRoles["action.text.border"]?.value;
  return {
    ...tokenMap,
    "--du-primary-color": semanticActiveFill || tokenMap["--du-primary-color"],
    "--du-primary-border": semanticTextBorder || tokenMap["--du-primary-border"] || semanticActiveFill || tokenMap["--du-primary-color"],
    "--du-primary-outline-color":
      semanticTextBorder ||
      tokenMap["--du-primary-outline-color"] ||
      tokenMap["--du-primary-border"] ||
      semanticActiveFill ||
      tokenMap["--du-primary-color"],
    "--du-primary-soft-bg":
      semanticNeutralSurface ||
      tokenMap["--du-primary-soft-bg"] ||
      semanticPrimaryFill ||
      tokenMap["--du-bg-1"],
    "--du-primary-solid-bg": semanticActiveFill || tokenMap["--du-primary-solid-bg"] || tokenMap["--du-primary-color"],
  };
});
const dangoColorStructureRows = computed(() => {
  const baseTokenMap = Object.fromEntries(catalog.value.tokens.map((token) => [token.name, token.value]));
  const overrideTokenMap = selectedStyle.value.id === "dango" ? {} : selectedStyleTokenMap.value;
  const tokenMap = {
    ...baseTokenMap,
    ...overrideTokenMap,
  };
  const overriddenTokenNames = new Set(Object.keys(overrideTokenMap));
  const firstColor = (value) => extractColorValues(value)[0] || "transparent";
  const dangoPrimitivePalettes = {
    neutral: ["#0000000a", "#00000014", "#0000001f", "#00000029", "#0000003d", "#00000066", "#000000a3", "#000000e0", "#000000"],
    white: ["#ffffff0a", "#ffffff14", "#ffffff1f", "#ffffff29", "#ffffff3d", "#ffffff66", "#ffffffa3", "#ffffffe0", "#ffffff"],
    purple: ["#f2f0ff", "#d9d2ff", "#c7b8ff", "#958dff", "#7c66ff", "#5c4cd9", "#4036b3", "#28238c", "#1a1866"],
    purplegray: ["#f7f7f9", "#ededf2", "#e1e1e5", "#d4d0da", "#bab5c4", "#918b9f", "#625e76", "#383950", "#2b263b"],
    red: ["#ffebe9", "#ffd1cf", "#ffabab", "#ff8380", "#f96464", "#d94a4e", "#b3343c", "#8c222c", "#661722"],
    orange: ["#fff0e6", "#ffdfca", "#ffc299", "#ffa15a", "#fc7e22", "#d65d11", "#b04105", "#8a2c00", "#631c00"],
    yellow: ["#fffde6", "#fff9ca", "#ffe885", "#fad728", "#edbf00", "#c79800", "#a17600", "#7a5600", "#543800"],
    tendershoots: ["#fbffe5", "#f4fec3", "#e4f689", "#cdee2b", "#b2d600", "#99b800", "#7f9900", "#667a00", "#4c5c00"],
    green: ["#e2f7e3", "#c9f2ca", "#9de09d", "#7ad37f", "#52ba5c", "#379e45", "#247842", "#145221", "#0f3d19"],
    turquoise: ["#e2f7f3", "#cdf9eb", "#9dedd9", "#77e5d2", "#36ccb6", "#17ad9b", "#14877e", "#076059", "#053b3a"],
    zimablue: ["#dff7f7", "#cbf7f7", "#9df2f4", "#62deef", "#28bee0", "#009bbf", "#087599", "#005273", "#00344d"],
    blue: ["#e4ebf9", "#cce0ff", "#a6caff", "#8fb7ff", "#6c9aff", "#5077d9", "#3957b3", "#263c8c", "#1b2866"],
    grape: ["#f1e6ff", "#ebd4ff", "#d6b3ff", "#b688ff", "#ad69f7", "#8a4fd1", "#6838ab", "#4a2585", "#32195e"],
  };
  const primitiveColorRefs = Object.entries(dangoPrimitivePalettes).flatMap(([family, values]) =>
    values.map((value, index) => ({
      ref: `${family}-${index + 1}`,
      family,
      step: index + 1,
      value: formatHexColor(value).toLowerCase(),
    })),
  );
  const primitiveRefForValue = (value) =>
    primitiveColorRefs.find((item) => item.value === formatHexColor(value).toLowerCase())?.ref || "";
  const rgbDistance = (a, b) => {
    const colorA = parseHexColor(a);
    const colorB = parseHexColor(b);
    if (!colorA || !colorB) return Number.MAX_SAFE_INTEGER;
    return Math.hypot(colorA.r - colorB.r, colorA.g - colorB.g, colorA.b - colorB.b, (colorA.a - colorB.a) * 255);
  };
  const colorStats = (value) => {
    const color = parseHexColor(value);
    if (!color) return null;
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    let hue = 0;
    if (delta) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { hue, saturation, lightness, luminance, alpha: color.a };
  };
  const closestStepInFamily = (family, activeColor) => {
    const values = dangoPrimitivePalettes[family] || [];
    const stats = colorStats(activeColor);
    if (family === "neutral" && stats?.alpha > 0.95) {
      return Math.min(9, Math.max(1, Math.round((1 - stats.luminance) * 7) + 2));
    }
    if (family === "white" && stats?.alpha > 0.95) {
      return Math.min(9, Math.max(1, Math.round(stats.luminance * 7) + 2));
    }
    return values.reduce((best, value, index) => {
      const distance = rgbDistance(activeColor, value);
      if (!best || distance < best.distance) return { step: index + 1, distance };
      return best;
    }, null)?.step || 1;
  };
  const chromaticFamilyForHue = (hue) => {
    if (hue < 12 || hue >= 345) return "red";
    if (hue < 45) return "orange";
    if (hue < 72) return "yellow";
    if (hue < 95) return "tendershoots";
    if (hue < 155) return "green";
    if (hue < 185) return "turquoise";
    if (hue < 205) return "zimablue";
    if (hue < 255) return "blue";
    if (hue < 292) return "grape";
    return "purple";
  };
  const semanticFamilyHint = (tokenName, stats) => {
    if (stats?.luminance >= 0.92 && stats?.saturation <= 0.12) return "white";
    if (stats?.luminance <= 0.12 && stats?.saturation <= 0.45) return "neutral";
    if (stats?.saturation <= 0.08) {
      return stats.luminance > 0.72 ? "white" : "neutral";
    }
    return "";
  };
  const primitiveRefForBrandColor = (tokenName, activeColor) => {
    const stats = colorStats(activeColor);
    if (!stats) return "";
    const family = semanticFamilyHint(tokenName, stats) || chromaticFamilyForHue(stats.hue);
    const step = closestStepInFamily(family, activeColor);
    return `${family}-${step}`;
  };
  const primitiveOverridePriority = (name) => {
    if (name.endsWith("-color") || name.endsWith("-solid-bg")) return 0;
    if (name.endsWith("-border")) return 1;
    if (name.endsWith("-outline-color")) return 2;
    if (name.endsWith("-soft-bg")) return 3;
    return 4;
  };
  const primitiveOverrideMap = Object.entries(overrideTokenMap).reduce((map, [tokenName, activeValue]) => {
    const baseColor = firstColor(baseTokenMap[tokenName]);
    const activeColor = firstColor(activeValue);
    const primitiveRef = primitiveRefForBrandColor(tokenName, activeColor);
    if (!primitiveRef || !activeColor || formatHexColor(baseColor) === formatHexColor(activeColor)) return map;
    const current = map.get(primitiveRef);
    const item = {
      tokenName,
      baseColor,
      activeColor,
    };
    if (!current) {
      map.set(primitiveRef, {
        ...item,
        sourceTokens: [tokenName],
      });
      return map;
    }
    if (formatHexColor(current.activeColor) === formatHexColor(activeColor)) {
      if (!current.sourceTokens.includes(tokenName)) current.sourceTokens.push(tokenName);
      return map;
    }
    if (primitiveOverridePriority(tokenName) < primitiveOverridePriority(current.tokenName)) {
      map.set(primitiveRef, {
        ...item,
        sourceTokens: [tokenName],
      });
    }
    return map;
  }, new Map());
  const primitiveAnchorsByFamily = Array.from(primitiveOverrideMap.entries()).reduce((map, [primitiveRef, item]) => {
    const match = primitiveRef.match(/^(.+)-(\d)$/);
    if (!match) return map;
    const family = match[1];
    const anchors = map.get(family) || [];
    anchors.push({
      step: Number(match[2]),
      activeColor: item.activeColor,
    });
    map.set(family, anchors.sort((a, b) => a.step - b.step));
    return map;
  }, new Map());
  const mixColor = (fromValue, toValue, progress) => {
    const from = parseHexColor(fromValue);
    const to = parseHexColor(toValue);
    if (!from || !to) return "";
    const channel = (start, end) => Math.min(255, Math.max(0, Math.round(start + (end - start) * progress)));
    return `#${[channel(from.r, to.r), channel(from.g, to.g), channel(from.b, to.b)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  };
  const inferredPrimitiveColor = (family, step) => {
    const inferableFamilies = new Set(["neutral", "white", "red", "orange", "yellow", "tendershoots", "green", "turquoise", "zimablue", "blue", "grape", "purple"]);
    if (!inferableFamilies.has(family)) return "";
    const anchors = primitiveAnchorsByFamily.get(family) || [];
    if (!anchors.length || anchors.some((anchor) => anchor.step === step)) return "";
    if (anchors.length === 1) {
      const anchor = anchors[0];
      if (step < anchor.step) {
        const progress = step / anchor.step;
        return mixColor("#FFFFFF", anchor.activeColor, progress);
      }
      const progress = (step - anchor.step) / (10 - anchor.step);
      return mixColor(anchor.activeColor, "#000000", progress);
    }
    const lower = [...anchors].reverse().find((anchor) => anchor.step < step);
    const upper = anchors.find((anchor) => anchor.step > step);
    if (lower && upper) {
      const progress = (step - lower.step) / (upper.step - lower.step);
      return mixColor(lower.activeColor, upper.activeColor, progress);
    }
    if (!lower && upper) {
      const progress = step / upper.step;
      return mixColor("#FFFFFF", upper.activeColor, progress);
    }
    const progress = (step - lower.step) / (10 - lower.step);
    return mixColor(lower.activeColor, "#000000", progress);
  };
  const paletteRows = Object.entries(dangoPrimitivePalettes).map(([family, values]) => {
    const steps = values.map((value, index) => {
      const step = index + 1;
      const tokenName = `--du-${family}-${step}`;
      const primitiveRef = `${family}-${step}`;
      const inferredOverride = primitiveOverrideMap.get(primitiveRef);
      const inferredColor = inferredPrimitiveColor(family, step);
      const activeValue = tokenMap[tokenName] || inferredOverride?.activeColor || inferredColor || value;
      const activeColor = firstColor(activeValue) || firstColor(value);
      const hasPrimitiveSignal = Boolean(inferredOverride);
      const isExactMatch = formatHexColor(activeColor) === formatHexColor(value);
      const isInferred = Boolean(inferredColor) && !hasPrimitiveSignal && !overriddenTokenNames.has(tokenName);
      const isOverridden = isInferred || ((overriddenTokenNames.has(tokenName) || hasPrimitiveSignal) && (hasPrimitiveSignal || !isExactMatch));
      return {
        name: `${family}-${step}`,
        label: String(step),
        value: activeColor,
        baseValue: value,
        displayValue: formatHexColor(activeColor),
        baseDisplayValue: formatHexColor(value),
        swatch: firstColor(activeColor),
        textColor: readableTextColor(activeColor, 0.42),
        isOverridden,
        isInferred,
        overrideKind: isInferred ? "推测" : isExactMatch ? "命中" : "覆盖",
        overrideSource: inferredOverride?.sourceTokens.join(" / ") || tokenName,
      };
    });
    return {
      family,
      steps,
      hasOverrides: steps.some((step) => step.isOverridden),
    };
  });
  const brandPrimitiveValueMap = paletteRows.reduce((map, row) => {
    row.steps.forEach((step) => {
      map.set(`${row.family}-${step.label}`, {
        value: step.value,
        swatch: step.swatch,
        displayValue: step.displayValue,
        baseDisplayValue: step.baseDisplayValue,
        isOverridden: step.isOverridden,
        isInferred: step.isInferred,
        overrideKind: step.overrideKind,
      });
    });
    return map;
  }, new Map());
  const primitiveForBaseToken = (name) => {
    const baseColor = firstColor(baseTokenMap[name]);
    const primitiveRef = baseColor ? primitiveRefForValue(baseColor) : "";
    return brandPrimitiveValueMap.get(primitiveRef)
      ? { ref: primitiveRef, ...brandPrimitiveValueMap.get(primitiveRef) }
      : null;
  };
  const semanticBrandFamilyMap = (() => {
    const directRefs = Array.from(primitiveOverrideMap.entries()).map(([ref, item]) => ({
      ref,
      family: ref.replace(/-\d$/, ""),
      tokenName: item.tokenName,
    }));
    const familyForPrefix = (prefix) => {
      const matches = directRefs.filter((item) => item.tokenName.startsWith(`--du-${prefix}-`));
      if (!matches.length) return "";
      const counts = matches.reduce((map, item) => {
        map.set(item.family, (map.get(item.family) || 0) + 1);
        return map;
      }, new Map());
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    };
    return {
      primary: familyForPrefix("primary"),
      secondary: familyForPrefix("secondary"),
      trade: familyForPrefix("trade"),
      success: familyForPrefix("success"),
      warning: familyForPrefix("warning"),
      error: familyForPrefix("error"),
    };
  })();
  const semanticPrefixFromName = (name) =>
    ["primary", "secondary", "trade", "success", "warning", "error"].find((prefix) => name.startsWith(`--du-${prefix}-`)) || "";
  const semanticResolvedColor = (name, activeValue = tokenMap[name]) => {
    const directOverride = tokenOverrideInfo(name, activeValue);
    if (directOverride.isOverridden) {
      const primitiveRef = primitiveRefForBrandColor(name, directOverride.overrideDisplayValue) || "unknown";
      return {
        value: directOverride.overrideDisplayValue,
        swatch: directOverride.overrideDisplayValue,
        baseDisplayValue: directOverride.baseDisplayValue,
        expression: `${primitiveRef} · ${directOverride.overrideDisplayValue}`,
        isOverridden: true,
        overrideKind: "覆盖",
      };
    }
    const semanticPrefix = semanticPrefixFromName(name);
    const semanticBrandFamily = semanticBrandFamilyMap[semanticPrefix];
    const basePrimitiveRef = primitiveForBaseToken(name)?.ref || "";
    const basePrimitiveFamily = basePrimitiveRef.replace(/-\d$/, "");
    const baseStep = basePrimitiveRef.match(/-(\d)$/)?.[1] || "";
    const canAdoptSemanticFamily = semanticBrandFamily && baseStep && !["neutral", "white", "purplegray"].includes(basePrimitiveFamily);
    const semanticFamilyValue = canAdoptSemanticFamily ? brandPrimitiveValueMap.get(`${semanticBrandFamily}-${baseStep}`) : null;
    if (semanticFamilyValue?.isOverridden) {
      return {
        value: semanticFamilyValue.displayValue,
        swatch: semanticFamilyValue.displayValue,
        baseDisplayValue: semanticFamilyValue.baseDisplayValue,
        expression: `${semanticBrandFamily}-${baseStep} · ${semanticFamilyValue.displayValue}`,
        isOverridden: true,
        isInferred: semanticFamilyValue.isInferred,
        overrideKind: semanticFamilyValue.overrideKind,
      };
    }
    const primitive = primitiveForBaseToken(name);
    if (primitive?.isOverridden) {
      return {
        value: primitive.displayValue,
        swatch: primitive.displayValue,
        baseDisplayValue: primitive.baseDisplayValue,
        expression: `${primitive.ref} · ${primitive.displayValue}`,
        isOverridden: true,
        isInferred: primitive.isInferred,
        overrideKind: primitive.overrideKind,
      };
    }
    const color = firstColor(activeValue);
    const primitiveRef = primitiveRefForValue(color) || "unknown";
    const hexValue = formatHexColor(color);
    return {
      value: hexValue,
      swatch: firstColor(hexValue),
      baseDisplayValue: hexValue,
      expression: `${primitiveRef} -> ${hexValue}`,
      isOverridden: false,
      overrideKind: "",
    };
  };
  const tokenRefFromValue = (value) => String(value).match(/var\((--[^)]+)\)/)?.[1] || "";
  const resolveTokenValue = (value, seen = []) => {
    const ref = tokenRefFromValue(value);
    if (!ref || seen.includes(ref) || !tokenMap[ref]) return { value, refs: [] };
    const resolved = resolveTokenValue(tokenMap[ref], [...seen, ref]);
    return { value: resolved.value, refs: [ref, ...resolved.refs] };
  };
  const tokenOverrideInfo = (name, activeValue = tokenMap[name]) => {
    const activeColor = firstColor(activeValue);
    const baseColor = firstColor(baseTokenMap[name]);
    const isOverridden = selectedStyle.value.id !== "dango" && overriddenTokenNames.has(name) && activeColor && baseColor && formatHexColor(activeColor) !== formatHexColor(baseColor);
    return {
      isOverridden,
      baseColor,
      baseDisplayValue: baseColor ? formatHexColor(baseColor) : "",
      overrideDisplayValue: activeColor ? formatHexColor(activeColor) : "",
    };
  };
  const mappingExpression = (name, primitiveRef, hexValue, prefixParts = []) => {
    const overrideInfo = tokenOverrideInfo(name, tokenMap[name]);
    if (overrideInfo.isOverridden) {
      return [...prefixParts, `DangoUI ${overrideInfo.baseDisplayValue} -> ${selectedStyle.value.label} ${overrideInfo.overrideDisplayValue}`].filter(Boolean).join(" -> ");
    }
    return [...prefixParts, primitiveRef || "unknown", hexValue].filter(Boolean).join(" -> ");
  };
  const componentAlias = (name, displayName = name.replace("--du-", ""), rawOverride = null, context = "", optionalRef = "") => {
    const rawValue = rawOverride ?? tokenMap[name] ?? "";
    const resolved = resolveTokenValue(rawValue);
    const colorValue = firstColor(resolved.value) || firstColor(rawValue);
    if (!colorValue) return null;
    const overrideInfo = tokenOverrideInfo(name, rawValue);
    const refResolvedInfo = resolved.refs.map((ref) => ({ ref, resolved: semanticResolvedColor(ref, tokenMap[ref]) })).find((item) => item.resolved.isOverridden);
    const directResolvedInfo = semanticResolvedColor(name, rawValue);
    const finalResolved = overrideInfo.isOverridden ? directResolvedInfo : refResolvedInfo?.resolved || null;
    const hexValue = finalResolved?.value || formatHexColor(colorValue);
    const primitiveRef = finalResolved?.expression?.split(" · ")[0] || primitiveRefForValue(hexValue) || "unknown";
    const slotLabel = optionalRef?.split(" -> ")[0] || displayName.replace(/^--du-/, "");
    const expression = `${slotLabel} · ${primitiveRef} · ${hexValue}`;
    return {
      name,
      label: displayName,
      value: rawValue,
      hexValue,
      swatch: firstColor(hexValue),
      expression,
      isOverridden: Boolean(finalResolved?.isOverridden),
      isInferred: Boolean(finalResolved?.isInferred),
      overrideKind: finalResolved?.overrideKind || "",
    };
  };
  const sortByOrder = (items, order) => {
    const orderMap = new Map(order.map(([suffix], index) => [suffix, index]));
    return [...items].sort((a, b) => {
      const aIndex = orderMap.has(a.suffix) ? orderMap.get(a.suffix) : Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.has(b.suffix) ? orderMap.get(b.suffix) : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || a.suffix.localeCompare(b.suffix);
    });
  };
  const componentAliasOrder = [
    ["solid-color", "solidColor"],
    ["solid-bg", "solidBg"],
    ["color", "color"],
    ["soft-bg", "softBg"],
    ["outline-color", "outlineColor"],
    ["border", "border"],
    ["text-color", "textColor"],
    ["solid-disabledtemp-color", "solidDisabledtempColor"],
    ["solid-disabledtemp-bg", "solidDisabledtempBg"],
    ["disabledtemp-color", "disabledtempColor"],
    ["soft-disabledtemp-bg", "softDisabledtempBg"],
    ["outline-disabledtemp-color", "outlineDisabledtempColor"],
    ["disabledtemp-border", "disabledtempBorder"],
    ["text-disabledtemp-color", "textDisabledtempColor"],
  ];
  const componentAliasOrderIndex = (item) => {
    const haystack = `${item.displayName || ""} ${item.tokenName || ""} ${item.suffix || ""}`;
    const index = componentAliasOrder.findIndex(([suffix]) => haystack.endsWith(suffix) || haystack.includes(`-${suffix}`));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const buttonVariantNames = ["primary", "secondary", "trade", "success", "warning", "error", "default", "white", "trans-black", "vip"];
  const buttonVariantTokens = buttonVariantNames.flatMap((variant) =>
    sortByOrder(
      componentAliasOrder
        .map(([suffix, displayName]) => ({
          variant,
          suffix,
          displayName,
          tokenName: `--du-bt-${suffix}`,
          semanticName: `--du-${variant}-${suffix}`,
        }))
        .filter((item) => tokenMap[item.semanticName]),
      componentAliasOrder,
    ),
  );
  const buttonVariantGroups = buttonVariantNames
    .map((variant) => {
      const mappings = sortByOrder(
        buttonVariantTokens.filter((item) => item.variant === variant),
        componentAliasOrder,
      )
        .map((item) => componentAlias(
          item.tokenName,
          item.tokenName,
          `var(${item.semanticName})`,
          "",
          `${item.suffix} -> ${item.variant}-${item.suffix}`,
        ))
        .filter(Boolean);
      return {
        name: variant,
        summary: `du-c-${variant}-bt：bt-* 槽位赋值到 ${variant}-*`,
        mappings,
      };
    })
    .filter((group) => group.mappings.length);
  const componentTokenGroups = [
    {
      component: "Button",
      source: "源码逻辑：每个 du-c-{color}-bt 分别把 bt-* 槽位赋值到 {color}-*",
      variantGroups: buttonVariantGroups,
      tokens: [],
    },
    ...catalog.value.components
      .filter((componentItem) => componentItem.name !== "Button" && componentItem.tokens)
      .map((componentItem) => ({
        component: componentItem.name,
        source: "catalog component.tokens 全量",
        tokens: Object.entries(componentItem.tokens)
          .map(([displayName, tokenName]) => ({
            tokenName,
            displayName,
          }))
          .sort((a, b) => componentAliasOrderIndex(a) - componentAliasOrderIndex(b) || a.displayName.localeCompare(b.displayName)),
      })),
  ];
  const componentAliasGroups = componentTokenGroups
    .map((spec) => {
      const seen = new Set();
      const mappings = spec.tokens
        .filter(({ tokenName, rawOverride }) => {
          const key = `${tokenName}:${rawOverride || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return Boolean(tokenMap[tokenName]);
        })
        .map(({ tokenName, displayName, rawOverride, context, optionalRef }) => componentAlias(tokenName, displayName, rawOverride, context, optionalRef))
        .filter(Boolean);
      return {
        component: spec.component,
        expanded: spec.component === "Button",
        variantGroups: spec.variantGroups,
        summary: spec.variantGroups
          ? `${spec.variantGroups.length} 个颜色变体 · ${spec.source}`
          : mappings.length
          ? `${mappings.length} 个颜色别名 · ${spec.source}`
          : `无颜色别名 · ${spec.source}`,
        mappings,
      };
    })
    .filter((group) => group.component === "Button" || group.summary);
  const neutralSemanticDescription = "占整个 app 用色的 60%，文字、图标、边框、分割线、阴影的常用色";
  const semanticFamilies = [
    { family: "text", prefix: "text", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "disabled"] },
    { family: "icon", prefix: "icon", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "disabled"] },
    { family: "border", prefix: "border", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3"] },
    { family: "bg", prefix: "bg", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "4"] },
    { family: "mask", prefix: "mask", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "4", "hover", "active"] },
    { family: "primary", prefix: "primary", category: "品牌语义色", source: "品牌主色，用于主按钮、主行动入口和关键高亮。" },
    { family: "secondary", prefix: "secondary", category: "品牌语义色", source: "品牌辅助色，用于次级行动、辅助强调和品牌延展。" },
    { family: "trade", prefix: "trade", category: "品牌语义色", source: "交易/业务强调色，用于价格、交易动作和强业务状态。" },
    { family: "success", prefix: "success", category: "通用语义色", source: "成功状态色，用于完成、通过、正向反馈。" },
    { family: "warning", prefix: "warning", category: "通用语义色", source: "警告状态色，用于提醒、风险提示和待处理状态。" },
    { family: "error", prefix: "error", category: "通用语义色", source: "错误状态色，用于失败、危险、破坏性提示。" },
    { family: "default", prefix: "default", category: "通用语义色", source: "默认操作色，用于未指定品牌或状态语义的组件默认态。" },
    { family: "white", prefix: "white", category: "通用语义色", source: "反相语义色，用于深色底上的文字、图标和组件状态。" },
    { family: "transblack", prefix: "trans-black", category: "通用语义色", source: "透明黑语义色，用于遮罩、浮层、压暗和叠加状态。" },
  ];
  const semanticRows = semanticFamilies.map(({ family, prefix, category, source, order }) => {
    const tokenPrefix = `--du-${prefix}-`;
    const familyTokens = Object.entries(tokenMap)
      .filter(([name]) => name.startsWith(tokenPrefix))
      .filter(([name]) => !name.includes("-bt-") && !name.includes("-tag-") && !name.endsWith("-channel"));
    const directToken = (suffix) => {
      const name = `${tokenPrefix}${suffix}`;
      const resolved = semanticResolvedColor(name, tokenMap[name]);
      return {
        name,
        label: suffix,
        value: resolved.value,
        displayValue: resolved.value,
        baseDisplayValue: resolved.baseDisplayValue,
        swatch: resolved.swatch,
        textColor: readableTextColor(resolved.swatch, 0.42),
        isOverridden: resolved.isOverridden,
        isInferred: resolved.isInferred,
        overrideKind: resolved.overrideKind,
        expression: resolved.expression,
      };
    };
    const steps = Array.from({ length: 9 }, (_, index) => directToken(String(index + 1))).filter((item) => item.value);
    const aliases = familyTokens
      .filter(([name]) => order || !/^--du-[a-z-]+-\d$/.test(name))
      .map(([name, value]) => {
        const resolved = semanticResolvedColor(name, value);
        const label = name.replace(tokenPrefix, "");
        return {
          name,
          label,
          value: resolved.value,
          displayValue: resolved.value,
          baseDisplayValue: resolved.baseDisplayValue,
          swatch: resolved.swatch,
          expression: resolved.expression,
          isOverridden: resolved.isOverridden,
          isInferred: resolved.isInferred,
          overrideKind: resolved.overrideKind,
        };
      });
    const mappedAliasNames = order
      ? order.map((label) => [label, label])
      : [
      ["solid-color", "solidColor"],
      ["solid-bg", "solidBg"],
      ["color", "color"],
      ["soft-bg", "softBg"],
      ["outline-color", "outlineColor"],
      ["border", "border"],
      ["text-color", "textColor"],
      ["solid-disabledtemp-color", "solidDisabledtempColor"],
      ["solid-disabledtemp-bg", "solidDisabledtempBg"],
      ["disabledtemp-color", "disabledtempColor"],
      ["soft-disabledtemp-bg", "softDisabledtempBg"],
      ["outline-disabledtemp-color", "outlineDisabledtempColor"],
      ["disabledtemp-border", "disabledtempBorder"],
      ["text-disabledtemp-color", "textDisabledtempColor"],
    ];
    const mappings = mappedAliasNames
      .map(([label, displayName]) => {
        const item = aliases.find((aliasItem) => aliasItem.label === label);
        return item ? { ...item, displayName } : null;
      })
      .filter(Boolean)
      .map((item) => ({
        name: item.name,
        label: item.displayName,
        value: item.value,
        swatch: item.swatch,
        primitiveRef: primitiveRefForValue(item.value) || "unknown",
        hexValue: formatHexColor(item.value),
        expression: item.expression,
        isOverridden: item.isOverridden,
        isInferred: item.isInferred,
        overrideKind: item.overrideKind,
      }));
    return {
      family,
      category,
      scaleText: source,
      mappings,
    };
  });
  const alias = (name, value, swatchSource = value) => ({
    name,
    value,
    swatch: firstColor(swatchSource),
    chain: "",
  });
  const semantic = (name, ref, swatchSource = tokenMap[name]) => ({
    name,
    value: `var(${ref})`,
    swatch: firstColor(swatchSource),
    chain: "",
  });
  const component = (name) => {
    const value = tokenMap[name] || "";
    const ref = String(value).match(/var\((--[^)]+)\)/)?.[1] || "";
    return {
      name,
      value: ref ? `var(${ref})` : value,
      swatch: firstColor(tokenMap[ref] || value),
      chain: "",
    };
  };
  return [
    {
      title: "一级：基础色板",
      description: "只表达颜色家族和色阶，不带业务语义。",
      variant: "paletteRows",
      items: paletteRows,
      hasOverrides: paletteRows.some((row) => row.hasOverrides),
    },
    {
      title: "二级：语义色板",
      description: "引用一级基础色板，中性色:品牌语义色:通用语义色=6:3:1，中性色包括 White/Transblack/Default，品牌语义色包括 Primary/Secondary/Trade，通用语义色包括 Success/Warning/Error。",
      variant: "semanticTextRows",
      items: semanticRows,
    },
    {
      title: "三级：组件别名",
      description: "组件别名层引用二级语义色板；当前快照 61 个组件，其中 39 个有 token map，32 个能解析到颜色链路。",
      variant: "componentAliasRows",
      items: componentAliasGroups,
    },
  ];
});
const catalogColorInventoryRows = computed(() => {
  const rows = new Map();
  catalog.value.tokens.forEach((token) => {
    extractColorValues(token.value).forEach((color) => {
      const key = color.toLowerCase();
      const row = rows.get(key) || {
        raw: color,
        count: 0,
        percent: "token refs",
        targetNames: [],
        value: "dangoui 初始化 token 色值",
        swatch: color,
        sortCount: 0,
      };
      row.count += 1;
      row.sortCount = row.count;
      if (row.targetNames.length < 8) row.targetNames.push(token.name);
      rows.set(key, row);
    });
  });
  return Array.from(rows.values()).map((row) => ({
    ...row,
    target: row.targetNames.join(" / "),
  }));
});
const selectedColorInventoryRows = computed(() => {
  if (selectedStyle.value.id === "dango" && catalogColorInventoryRows.value.length) {
    return catalogColorInventoryRows.value.sort((a, b) => b.sortCount - a.sortCount || a.raw.localeCompare(b.raw));
  }

  const rows = new Map();
  const addCandidate = ({ raw, count = 0, percent = "0%", target, value, swatch, source }) => {
    extractColorValues(raw).forEach((color) => {
      const key = color.toLowerCase();
      const row = rows.get(key) || {
        raw: color,
        count: 0,
        percent,
        targetNames: [],
        value,
        swatch: swatch || color,
        sortCount: 0,
        sources: [],
      };
      row.count += count;
      row.sortCount = row.count;
      if (count > 0) {
        row.percent = percent;
        row.value = value;
      }
      if (target && row.targetNames.length < 8) row.targetNames.push(target);
      if (source && row.sources.length < 4) row.sources.push(source);
      rows.set(key, row);
    });
  };

  selectedStyle.value.tokens.filter((token) => isColorSignal(token.value)).forEach((token) => {
    addCandidate({
      raw: token.value,
      target: token.name,
      value: "项目 token 中存在的候选映射色",
      source: "token",
    });
  });
  selectedStyle.value.signals.forEach((signal) => {
    const count = typeof signal.count === "number" ? signal.count : 0;
    addCandidate({
      raw: signal.raw,
      count,
      percent: signal.percent === "baseline" ? "0%" : signal.percent,
      target: signal.target,
      value: signal.value,
      swatch: signalSwatch(signal),
      source: "evidence",
    });
  });
  Object.values(selectedStyle.value.style || {}).forEach((value) => {
    addCandidate({
      raw: value,
      target: "demoOnlyVisualControls",
      value: "页面 CSS 中出现的候选颜色",
      source: "style",
    });
  });
  const sourceRank = (row) => {
    const source = row.sources[0] || "";
    if (source === "token") return 0;
    if (source === "evidence") return 1;
    if (source === "style") return 2;
    return 3;
  };
  return Array.from(rows.values()).map((row) => ({
    ...row,
    target: row.targetNames.join(" / "),
    source: row.sources.join(" / ") || row.targetNames[0] || "project",
  })).sort((a, b) => sourceRank(a) - sourceRank(b) || a.target.localeCompare(b.target) || a.raw.localeCompare(b.raw));
});
const themeVars = computed(() => ({
  "--du-bg-2": "#f7f7f9",
  "--du-bg-1": "#ffffff",
  "--du-c-bg-2": "#f7f7f9",
  "--du-text-1": "#000000e0",
  "--du-text-2": "#000000a6",
  "--du-text-3": "#00000066",
  "--du-default-6": "#00000066",
  "--du-default-8": "#000000e0",
  "--du-border-1": "#0000001f",
  "--du-border-2": "#0000001f",
  "--du-primary-color": "#7c66ff",
  "--du-primary-border": "#7c66ff",
  "--du-primary-outline-color": "#7c66ff",
  "--du-primary-soft-bg": "#f2f0ff",
  "--du-primary-solid-bg": "#7c66ff",
  "--du-c-bg-2-channel": rgbChannel("#f7f7f9"),
  "--du-primary-solid-bg-channel": rgbChannel("#7c66ff"),
  "--du-secondary-solid-bg-channel": rgbChannel("#7c66ff"),
  "--du-icon-1": "#000000e0",
  "--du-icon-2": "#000000a6",
  "--du-icon-3": "#00000066",
  "--style-page-bg": "#f7f7f9",
  "--style-card-bg": "#ffffff",
  "--style-text": "#000000e0",
  "--style-muted": "#00000066",
  "--style-accent": "#7c66ff",
  "--style-accent-soft": "#f2f0ff",
  "--style-card-radius-base": "8px",
  "--style-control-radius-base": "8px",
  "--style-page-spacing-base": "16px",
  "--style-card-radius": "8px",
  "--style-control-radius": "8px",
  "--style-page-spacing": "16px",
  "--style-card-shadow": "0 1px 2px rgba(17,17,20,.06)",
  "--style-media": "linear-gradient(135deg,#ffffff,#f7f7f9 56%,#f2f0ff)",
  "--mock-fab-foreground": readableSolidTextColor("#7c66ff"),
  "--mock-statusbar-color": mockStatusbarMode.value.color,
  "--mock-statusbar-shadow": mockStatusbarMode.value.shadow,
}));
const mockupScaleVars = computed(() => ({
  "--mockup-scale": mockupScale.value.toFixed(4),
}));

const phoneBrandVars = computed(() => ({
  "--du-bg-2": selectedStyleTokenMap.value["--du-bg-2"],
  "--du-bg-1": selectedStyleTokenMap.value["--du-bg-1"],
  "--du-c-bg-2": selectedStyleTokenMap.value["--du-bg-2"],
  "--du-text-1": selectedStyleTokenMap.value["--du-text-1"],
  "--du-text-2": selectedStyleTokenMap.value["--du-text-2"],
  "--du-text-3": selectedStyleTokenMap.value["--du-text-3"],
  "--du-default-6": selectedStyleTokenMap.value["--du-default-6"] || "#00000066",
  "--du-default-8": selectedStyleTokenMap.value["--du-default-8"] || selectedStyleTokenMap.value["--du-text-1"] || "#000000e0",
  "--du-border-1": selectedStyleTokenMap.value["--du-border-1"],
  "--du-border-2": selectedStyleTokenMap.value["--du-border-2"] || selectedStyleTokenMap.value["--du-border-1"],
  "--du-primary-color": selectedStyleTokenMap.value["--du-primary-color"],
  "--du-primary-border": selectedStyleTokenMap.value["--du-primary-border"],
  "--du-primary-outline-color": selectedStyleTokenMap.value["--du-primary-outline-color"],
  "--du-primary-soft-bg": selectedStyleTokenMap.value["--du-primary-soft-bg"],
  "--du-primary-solid-bg": selectedStyleTokenMap.value["--du-primary-solid-bg"],
  "--du-color-main": selectedStyleTokenMap.value["--du-primary-color"] || selectedStyleTokenMap.value["--du-primary-solid-bg"] || "#7c66ff",
  "--du-c-bg-2-channel": rgbChannel(selectedStyleTokenMap.value["--du-bg-2"] || "#f7f7f9"),
  "--du-primary-solid-bg-channel": rgbChannel(
    selectedStyleTokenMap.value["--du-primary-solid-bg"] || selectedStyleTokenMap.value["--du-primary-color"] || "#7c66ff",
  ),
  "--du-secondary-solid-bg-channel": rgbChannel(
    selectedStyleTokenMap.value["--du-secondary-solid-bg"] ||
      selectedStyleTokenMap.value["--du-secondary-color"] ||
      selectedStyleTokenMap.value["--du-primary-solid-bg"] ||
      selectedStyleTokenMap.value["--du-primary-color"] ||
      "#7c66ff",
  ),
  "--style-page-bg": selectedStyleTokenMap.value["--du-bg-2"],
  "--style-card-bg": selectedStyleTokenMap.value["--du-bg-1"],
  "--style-text": selectedStyleTokenMap.value["--du-text-1"],
  "--style-muted": selectedStyleTokenMap.value["--du-text-3"],
  "--style-accent": selectedStyleTokenMap.value["--du-primary-color"],
  "--style-accent-soft": selectedStyleTokenMap.value["--du-primary-soft-bg"],
  "--style-card-radius-base": selectedStyle.value.style.cardRadius,
  "--style-control-radius-base": selectedStyle.value.style.controlRadius,
  "--style-page-spacing-base": selectedStyle.value.style.pageSpacing,
  "--style-card-radius": selectedStyle.value.style.cardRadius,
  "--style-control-radius": selectedStyle.value.style.controlRadius,
  "--style-page-spacing": selectedStyle.value.style.pageSpacing,
  "--style-card-shadow": selectedStyle.value.style.cardShadow,
  "--style-media": selectedStyle.value.style.media,
  "--style-font-body": selectedStyle.value.style.fontBody,
  "--style-font-display": selectedStyle.value.style.fontDisplay,
  "--mock-fab-foreground": readableSolidTextColor(
    selectedStyleTokenMap.value["--du-primary-solid-bg"] || selectedStyleTokenMap.value["--du-primary-color"] || "#7c66ff",
  ),
}));

const mockupSelectPopupStyle = computed(() => ({
  "--mockup-select-popup": "1",
  left: "var(--mockup-popup-left, 0px)",
  right: "auto",
  bottom: "var(--mockup-popup-bottom, 0px)",
  width: "var(--mockup-popup-width, 100vw)",
  "max-height": "min(320px, calc(var(--mockup-popup-height, 100vh) - 96px))",
  "padding-bottom": "var(--mockup-popup-home-indicator, 34px)",
  "border-radius": "var(--publish-card-radius, 16px) var(--publish-card-radius, 16px) var(--mockup-popup-radius, 32px) var(--mockup-popup-radius, 32px)",
}));
const mockupDisplayPopupStyle = computed(() => ({
  left: "var(--mockup-popup-left, 0px)",
  right: "auto",
  bottom: "var(--mockup-popup-bottom, 0px)",
  width: "var(--mockup-popup-width, 100vw)",
  height: "calc(var(--mockup-popup-height, 100vh) * 0.6)",
  "max-height": "calc(var(--mockup-popup-height, 100vh) - 96px)",
  "padding-bottom": "var(--mockup-popup-home-indicator, 34px)",
  "border-radius": "18px 18px var(--mockup-popup-radius, 32px) var(--mockup-popup-radius, 32px)",
  overflow: "hidden",
}));
const mockupPopupMaskStyle = computed(() => ({
  left: "var(--mockup-popup-left, 0px)",
  top: "var(--mockup-popup-top, 0px)",
  right: "var(--mockup-popup-right, 0px)",
  bottom: "var(--mockup-popup-bottom, 0px)",
  "border-radius": "var(--mockup-popup-radius, 32px)",
}));
const styleJson = computed(() =>
  JSON.stringify(
    {
      source: selectedStyle.value.label,
      docsEntry: introductionUrl,
      activeDocs: activeDocs.map((doc) => doc.file),
      supportingFiles: {
        archive: "历史上下文，不参与规则判断",
        references: "demo-only token snapshot，正式 dangoui 项目中废弃",
        migrations: "案例产物，不反向定义规则",
      },
      lockedSchema: "dangoui-existing-css-token-names-and-components",
      starterTemplates,
      workflow: workflowSteps,
      extractedSignals: selectedStyle.value.signals,
      dangouiTokens: selectedStyle.value.tokens.reduce((acc, token) => {
        acc[token.name] = token.value;
        return acc;
      }, {}),
      demoOnlyVisualControls: selectedStyle.value.style,
    },
    null,
    2,
  ),
);
const selectedMeta = computed(() => componentMeta(selectedComponent.value));
const selectedMissing = computed(() => missingMeta(selectedComponent.value));
const selectedTokens = computed(() => {
  if (!selectedMeta.value) return [];
  return Object.values(selectedMeta.value.tokens || {}).map(getToken);
});
const visibleTokens = computed(() =>
  tokensExpanded.value ? selectedTokens.value : selectedTokens.value.slice(0, tokenPreviewLimit),
);
const humanDescription = computed(() => {
  if (selectedInspectorTab.value === "components") {
    if (friendlyDescriptions[selectedComponent.value]) return friendlyDescriptions[selectedComponent.value];
    if (selectedComponentCategoryId.value === "output") {
      return displayFriendlyDescriptions[selectedComponent.value] || distributionFriendlyDescriptions[selectedComponent.value] || selectedMeta.value?.description || selectedMissing.value?.reason || "这个组件用于把信息清楚地展示给用户。";
    }
    return selectedMeta.value?.description || selectedMissing.value?.reason || "这个模块还没有匹配到设计系统组件。";
  }
  if (activeSide.value === "distribution" && distributionFriendlyDescriptions[selectedComponent.value]) {
    return distributionFriendlyDescriptions[selectedComponent.value];
  }
  if (activeSide.value === "display" && displayFriendlyDescriptions[selectedComponent.value]) {
    return displayFriendlyDescriptions[selectedComponent.value];
  }
  if (friendlyDescriptions[selectedComponent.value]) return friendlyDescriptions[selectedComponent.value];
  if (selectedMeta.value) return selectedMeta.value.description;
  if (selectedMissing.value) {
    return "这是页面底部导航。当前 dangoui catalog 还没有这个组件，所以只能识别位置，不能按 dangoui schema 精准改。";
  }
  return "这个模块还没有匹配到设计系统组件。";
});
const componentUseCaseDescription = computed(() => {
  const categoryDescriptions = {
    bar: "用于让用户知道自己在哪里、还能去哪里，以及下一步能执行什么主要动作。",
    output: "用于把内容、媒体、商品、状态或结果以可浏览、可比较、可点击的方式展示出来。",
    input: "用于收集用户填写、选择、上传和确认的信息，并把它们组织成可提交的数据。",
    feedback: "用于在用户操作后给出轻重不同的反馈，避免用户不知道系统是否响应。",
  };
  return categoryDescriptions[selectedComponentCategoryId.value] || activeComponentCategory.value.description;
});
const componentActionDescriptions = {
  NavigationBar: "用户能通过它确认当前页面、返回上一层、发起搜索或触发右侧动作。",
  Search: "用户能通过它直接找到内容、商品、活动或配置项。",
  Tabs: "用户能通过它在同一块内容里切换不同频道或维度。",
  Button: "用户能通过它完成报名、发布、保存、确认等明确动作。",
  Tag: "用户能通过它快速识别内容状态、分类和运营重点。",
  Image: "用户能通过它确认封面、商品图、角色图或媒体素材。",
  FormItem: "用户能通过它理解字段名称、必填规则、提示和校验状态。",
  Input: "用户能通过它填写名称、关键词或单行配置。",
  Textarea: "用户能通过它填写正文、说明和运营备注。",
  Switch: "用户能通过它开启或关闭某项配置。",
  NoticeBar: "用户能通过它看到页面内持续提示、风险提醒或运营公告。",
  Snackbar: "用户能通过它知道刚刚的操作是否成功。",
  Dialog: "用户能通过它确认高风险动作或做二次决策。",
};
const componentUserActionDescription = computed(() => {
  return componentActionDescriptions[selectedComponent.value] || humanDescription.value || componentUseCaseDescription.value;
});
const componentAvailabilityDescription = computed(() => {
  const name = selectedComponent.value;
  const label = componentSupportLabel(name);
  const kind = componentSupportKind(name);
  if (kind === "dangoui") return `DangoUI 已有：可以直接用组件库能力承接，再按参考站 token 调整视觉。`;
  if (kind === "business") return `待更新：当前先用业务组件或组合样式表达，并统一继承 Layout / Spacing / Radius / Shadow 初始化规则；后续需要补齐组件 API / schema。`;
  if (kind === "gap") return `待新增：demo 先表达真实场景和期望形态，并统一继承 Layout / Spacing / Radius / Shadow 初始化规则；后续进入 DangoUI 生产组件或 token recipe。`;
  return `${label}：当前先按 demo 场景表达，后续再归入 DangoUI 或业务组件。`;
});
const componentEditableModel = {
  Search: [
    { title: "slots", items: [["showIcon", "right slot：图标操作", "slot right；可放 Icon / Divider / Button。"]] },
    {
      title: "props",
      items: [
        {
          key: "searchPlaceholder",
          label: "placeholder：占位提示文案",
          hint: "string | string[]；默认空字符串，数组时会滚动切换。",
          control: "select",
          options: [
            { label: "滚动占位", value: "rolling" },
            { label: "单条文案", value: "single" },
            { label: "空值", value: "empty" },
          ],
        },
      ],
    },
    { title: "业务组合能力", items: [["disabled", "置灰态", "Search 源码没有 disabled prop；这里表达只读入口在业务中不可点的状态。"]] },
  ],
  Tabs: [
    { title: "slots", items: [["showLabel", "default slot：Tab 文案", "slot default；每个 DuTab 的显示内容。"]] },
    {
      title: "props",
      items: [
        {
          key: "tabsValue",
          label: "value：选中项",
          hint: "string；必须匹配 DuTab 的 name。",
          control: "select",
          options: [
            { label: "推荐", value: "recommend" },
            { label: "最新", value: "latest" },
            { label: "热门", value: "hot" },
          ],
        },
        {
          key: "tabsType",
          label: "type：形态",
          hint: "'default' | 'tag' | 'text'；默认 default。",
          control: "select",
          options: [
            { label: "default", value: "default" },
            { label: "tag", value: "tag" },
            { label: "text", value: "text" },
          ],
        },
      ],
    },
  ],
  SegmentControl: [{ title: "props", items: [["active", "选中项"], ["disabled", "禁用态"]] }],
  TabBar: [
    { title: "slots", items: [["showIcon", "item icon"]] },
    { title: "props", items: [["active", "active tab"]] },
  ],
  BottomBar: [
    { title: "slots", items: [["showAction", "操作按钮"]] },
    { title: "props", items: [["disabled", "禁用态"]] },
  ],
  Menu: [
    { title: "slots", items: [["showIcon", "菜单图标"]] },
    { title: "props", items: [["active", "选中项"]] },
  ],
  Badge: [
    { title: "slots", items: [["showLabel", "default slot：承载内容", "slot default；红点/数字挂载的目标内容。"]] },
    { title: "props", items: [["active", "value / dot 状态", "string | number；0 或空值默认隐藏，alwaysShow 可强制显示。"]] },
  ],
  Tag: [
    { title: "slots", items: [["showClose", "closeable：关闭入口", "boolean；显示关闭图标并触发 close 事件。"]] },
    { title: "props", items: [["bordered", "bordered", "boolean；是否显示边框。"], ["rounded", "round", "boolean；是否使用圆角胶囊形态。"]] },
  ],
  Empty: [
    { title: "slots", items: [["showAction", "buttonText 动作"]] },
    { title: "props", items: [["showMedia", "image 类型"]] },
  ],
  Image: [{ title: "props", items: [{ key: "imageRadius", label: "radius：图片圆角", hint: "number | string；默认不设置。", control: "number", min: 0, max: 40 }, ["showMedia", "src / mode", "src 为图片地址；mode 为 'aspectFit' | 'aspectFill' | 'widthFix'。"]] }],
  Avatar: [
    { title: "props", items: [["bordered", "bordered", "boolean；是否展示头像外边框。"]] },
  ],
  Time: [{ title: "业务组合能力", items: [["showLabel", "时间标题"], ["showHelper", "辅助说明"]] }],
  PriceStatistic: [{ title: "业务组合能力", items: [["showLabel", "指标标签"], ["active", "强调状态"]] }],
  Swiper: [
    { title: "slots", items: [["showMedia", "SwiperItem 内容"]] },
    { title: "props", items: [["active", "autoplay"]] },
  ],
  FormItem: [
    { title: "slots", items: [["showLabel", "label 区域", "label prop 渲染字段名；默认 slot 承载表单控件。"], ["showHelper", "tips 区域", "tips prop；字段说明/校验提示。"]] },
    { title: "props", items: [["bordered", "内部控件边框", "这里联动内部 DuInput 的 bordered。"], ["active", "required", "boolean；字段是否必填。"]] },
  ],
  Input: [
    { title: "slots", items: [["showLabel", "prefix 文案", "prefix prop；输入内容前的标签。"]] },
    { title: "props", items: [["bordered", "bordered", "boolean；外边框样式。"], ["disabled", "disabled", "boolean；禁用输入。"]] },
  ],
  Textarea: [{ title: "props", items: [["bordered", "bordered", "boolean；外边框样式。"], ["showCount", "show-count", "boolean；显示当前字数/maxlength。"], { key: "textareaMaxlength", label: "maxlength：最大字数", hint: "number；默认 -1 表示不限制。", control: "number", min: -1, max: 200 }] }],
  Radio: [{ title: "props", items: [["active", "checked", "boolean；当前项是否选中。"], ["disabled", "disabled", "boolean；禁用选择。"]] }],
  Checkbox: [{ title: "props", items: [["active", "checked", "boolean；当前项是否选中。"], ["disabled", "disabled", "boolean；禁用选择。"]] }],
  Switch: [{ title: "props", items: [["active", "on", "boolean；开关开/关。"], ["disabled", "disabled", "boolean；禁用操作。"]] }],
  Stepper: [{ title: "props", items: [{ key: "stepperValue", label: "value：当前数值", hint: "number；默认 0。", control: "number", min: 0, max: 99 }, ["disabled", "disabled", "boolean；禁用加减。"]] }],
  Upload: [
    { title: "slots", items: [["showMedia", "已上传媒体"]] },
    { title: "props", items: [["showLabel", "badge"], ["disabled", "disabled"]] },
  ],
  Tips: [{ title: "业务组合能力", items: [["showLabel", "提示标题"], ["showHelper", "提示正文"]] }],
  Group: [
    { title: "slots", items: [["showLabel", "字段内容"]] },
    { title: "props", items: [["bordered", "分组边界"]] },
  ],
  DateTimePicker: [
    { title: "slots", items: [["showLabel", "字段名", "DuCalendar title / 外部 label 槽位"], ["showHelper", "辅助说明", "提示用户时间字段的取值范围与默认值"]] },
    {
      title: "props",
      items: [
        {
          key: "calendarShowTimePicker",
          label: "showTimePicker:是否含时间",
          hint: "boolean;true 时 DuCalendar 启用时间选择,半小时内 step=5。",
          control: "switch",
        },
      ],
    },
  ],
  Rate: [{ title: "props", items: [{ key: "rateValue", label: "value：评分值", hint: "number；用来表达当前评分。", control: "number", min: 0, max: 5 }, ["disabled", "只读/禁用"]] }],
  Cascader: [
    { title: "slots", items: [["showAction", "trigger slot"]] },
    { title: "props", items: [["showLabel", "title"]] },
  ],
  Select: [
    { title: "slots", items: [["showLabel", "trigger slot 文案", "default slot；非 FormItem 环境必须提供触发器。"]] },
    { title: "props", items: [["showHelper", "title / placeholder", "title prop；弹层标题或未选占位。"]] },
  ],
  NoticeBar: [
    { title: "slots", items: [["showAction", "linkText 动作", "linkText/linkIcon；右侧链接动作。"]] },
    {
      title: "props",
      items: [
        {
          key: "noticeType",
          label: "type：公告条形态",
          hint: "'primary' | 'secondary'；默认 secondary。",
          control: "select",
          options: [
            { label: "secondary", value: "secondary" },
            { label: "primary", value: "primary" },
          ],
        },
        {
          key: "noticeColor",
          label: "color：色彩",
          hint: "string；使用 DangoUI 色板名。",
          control: "select",
          options: [
            { label: "primary", value: "primary" },
            { label: "warning", value: "warning" },
            { label: "success", value: "success" },
            { label: "error", value: "error" },
            { label: "default", value: "default" },
          ],
        },
        ["showClose", "closeable", "boolean；是否显示关闭入口。"],
      ],
    },
  ],
  Snackbar: [
    { title: "slots", items: [["showIcon", "leftIcon", "string；左侧图标名。"], ["showAction", "action button", "buttonProps；右侧操作按钮配置。"]] },
    {
      title: "props",
      items: [
        ["showClose", "showClose", "boolean；是否显示关闭按钮。"],
        {
          key: "snackbarButtonColor",
          label: "buttonProps.color：动作按钮色彩",
          hint: "string；Snackbar 自身无顶层 color，颜色通过右侧动作按钮配置。",
          control: "select",
          options: [
            { label: "white", value: "white" },
            { label: "primary", value: "primary" },
            { label: "secondary", value: "secondary" },
            { label: "default", value: "default" },
          ],
        },
      ],
    },
  ],
  Toast: [{ title: "props", items: [["active", "显示状态"], ["showIcon", "图标"]] }],
  Dialog: [
    { title: "slots", items: [["showAction", "底部按钮"], ["showHelper", "正文说明"]] },
  ],
  Popup: [
    { title: "slots", items: [["showAction", "内容动作"]] },
    { title: "props", items: [["showClose", "closable"]] },
  ],
  ShareSheet: [
    { title: "slots", items: [["showIcon", "渠道图标"], ["showAction", "渠道动作"]] },
  ],
  ResultPage: [{ title: "slots", items: [["active", "结果状态"], ["showAction", "后续动作"]] }],
  Spin: [{ title: "props", items: [["active", "loading"], ["showLabel", "加载文案"]] }],
  Skeleton: [
    { title: "slots", items: [["showMedia", "template 内容"]] },
    { title: "props", items: [["active", "loading"]] },
  ],
};
const componentSwitchLabels = {
  active: "选中 / 激活态",
  disabled: "禁用态",
  bordered: "边框",
  rounded: "圆角",
  showLabel: "标题 / 标签",
  showHelper: "辅助说明",
  showAction: "操作入口",
  showIcon: "图标",
  showMedia: "媒体 / 图片",
  showCount: "字数统计",
  showClose: "关闭入口",
};
function normalizeEditableItem(item) {
  if (Array.isArray(item)) {
    const [key, label, hint] = item;
    return {
      key,
      label: label || componentSwitchLabels[key] || key,
      hint: hint || "boolean；按默认值初始化，开关控制 true / false。",
      control: "switch",
    };
  }
  return {
    control: item.control || "switch",
    options: item.options || [],
    step: item.step || 1,
    ...item,
    label: item.label || componentSwitchLabels[item.key] || item.key,
    hint: item.hint || (item.control === "number" ? "number；填写数值。" : item.control === "select" ? "string；从可用值中选择。" : "boolean；按默认值初始化，开关控制 true / false。"),
  };
}
function openComponentExamplePopup(name) {
  componentExamplePopup.value = name;
  nextTick(() => syncMockupPopupBounds("DateTimePicker"));
}
function closeComponentExamplePopup() {
  componentExamplePopup.value = null;
}
function openDisplayPopup(event) {
  if (event) {
    event.stopPropagation();
  }
  syncMockupPopupBounds("Popup");
  displayPopupVisible.value = true;
}
function setComponentExampleValue(key, value) {
  componentExampleState.value = {
    ...componentExampleState.value,
    [key]: value,
  };
  openEditableSelectKey.value = "";
}
function toggleEditableSelect(key) {
  openEditableSelectKey.value = openEditableSelectKey.value === key ? "" : key;
}
function setNavigationExampleColor(value) {
  navExampleColor.value = value;
  openEditableSelectKey.value = "";
}
function editableOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}
const componentEditableGroups = computed(() => {
  const fallback = [
    { title: "props", items: [["active", "状态"], ["disabled", "禁用态"], ["bordered", "边框"]] },
    { title: "业务组合能力", items: [["showAction", "操作入口"]] },
  ];
  return (componentEditableModel[selectedComponent.value] || fallback).map((group) => ({
    title: group.title,
    items: group.items.map(normalizeEditableItem),
  }));
});
const editableFields = computed(() => editableByComponent[selectedComponent.value] || ["颜色", "文字", "状态", "间距"]);
const schemaPreview = computed(() => {
  if (selectedTokenName.value) {
    return JSON.stringify(
      {
        token: getToken(selectedTokenName.value),
        usedBy: selectedComponent.value,
        docs: tokenDocsUrl,
      },
      null,
      2,
    );
  }
  return JSON.stringify(selectedMeta.value || selectedMissing.value || {}, null, 2);
});

function componentMeta(name) {
  return componentsByName.value[name];
}

function displayDescription(name) {
  return friendlyDescriptions[name] || componentMeta(name)?.description || missingMeta(name)?.reason || "未在 dangoui catalog 中找到。";
}

function componentChineseName(name) {
  return componentChineseNames[name] || "组件";
}

function componentDisplayName(name) {
  return componentDisplayNames[name] || name || "";
}

function editableFieldHint(field) {
  const hints = {
    标题: "导航栏中间的页面标题",
    返回按钮: "左侧返回入口",
    右侧动作: "右侧分享、更多或确认动作",
    背景: "导航栏底色或透明状态",
    "固定/透明状态": "是否吸顶、是否覆盖在主视觉上",
    占位文案: "输入前给用户看的提示文字",
    只读: "是否允许用户直接输入",
    输入态: "聚焦、输入中、清除按钮状态",
    文案: "组件展示给用户看的文字",
    类型: "primary、default、success 等语义类型",
    尺寸: "normal、large 或组件尺寸",
    颜色: "语义色或品牌色映射",
    选中项: "当前 active 的 tab、分段或选项",
    图标: "左侧、右侧或 icon-only 图标",
    安全区: "底部 home indicator / 顶部状态栏预留",
  };
  return hints[field] || `对应组件里的 ${field} 区域`;
}

function componentSupportLabel(name) {
  const kind = componentSupportKind(name);
  const support = componentSupportMap[name] || "";
  if (support.includes("·")) return support;
  const labels = {
    dangoui: "DangoUI",
    adapter: "DangoUI",
    business: "待更新",
    shell: "DangoUI 待更新",
    gap: "待新增",
  };
  return labels[kind] || support || componentMeta(name)?.className || missingMeta(name)?.status || "unknown";
}

function componentSupportKind(name) {
  const support = componentSupportMap[name] || "";
  if (support === "DangoUI 待更新") return "business";
  if (support === "DangoUI 待新增") return "gap";
  if (support.startsWith("DangoUI")) return "dangoui";
  if (support === "业务组件") return "business";
  if (support === "Shell" || support === "组合") return "shell";
  if (support.includes("缺口")) return "gap";
  if (componentMeta(name)) return "dangoui";
  return "gap";
}

const styleCategorySupportMap = {
  color: "DangoUI",
  typography: "DangoUI",
  icon: "DangoUI",
  button: "DangoUI 待更新",
  asset: "DangoUI 待更新",
  divider: "DangoUI",
  layout: "DangoUI 待更新",
  spacing: "DangoUI 待新增",
  radius: "DangoUI 待新增",
  shadow: "DangoUI 待新增",
  motion: "DangoUI 待更新",
};

function styleCategorySupportKind(category) {
  const support = styleCategorySupportMap[category?.id] || category?.status || category?.meta || "";
  if (support === "DangoUI 待更新") return "business";
  if (support === "DangoUI 待新增") return "gap";
  if (support.startsWith("DangoUI") || support === "token" || support === "dangoui token") return "dangoui";
  return "business";
}

function styleCategorySupportLabel(category) {
  const kind = styleCategorySupportKind(category);
  const labels = {
    dangoui: "DangoUI",
    business: "待更新",
    gap: "待新增",
  };
  return labels[kind] || "待更新";
}

function styleRecipeStatusLabel(status, categoryId, item = {}) {
  const text = `${item.title || ""} ${item.value || ""} ${item.note || ""}`;
  if (["spacing", "radius", "shadow"].includes(categoryId)) return "待新增";
  if (categoryId === "typography") {
    if (/^[HBN][1-8]$/.test(item.title || "")) return "DangoUI";
    if (/Button|Tab|Title|Body|Caption|Micro|Line height|Font weight/i.test(text)) return "DangoUI";
    return "待更新";
  }
  if (categoryId === "icon") return status === "mapped" ? "DangoUI" : "待更新";
  if (categoryId === "button") {
    if (/FAB/i.test(text) || status === "missing") return "待新增";
    if (/IconButton/i.test(text) || status === "composed") return "DangoUI 组合";
    return status === "mapped" ? "DangoUI" : "待更新";
  }
  if (categoryId === "divider") return status === "mapped" ? "DangoUI" : "待更新";
  if (categoryId === "motion") return /Snackbar|Transition/i.test(text) || status === "mapped" ? "DangoUI" : "待更新";
  if (categoryId === "asset") return status === "composed" ? "DangoUI" : "待更新";
  if (status === "mapped" || status === "composed") return "DangoUI";
  if (status === "missing") return "待新增";
  return "待更新";
}

function supplementDescription(name) {
  const support = componentSupportLabel(name);
  const description = displayDescription(name);
  if (support === "DangoUI 待更新") return `${description} Showcase 前先作为业务 mock 或适配态补齐，不在此阶段定架构。`;
  if (support === "DangoUI 待新增") return `${description} 当前 DangoUI 尚未提供正式组件或 token，需要后续补充。`;
  return description;
}

function missingMeta(name) {
  return missingByName.value[name];
}

function isMissing(name) {
  return Boolean(missingMeta(name));
}

function isColorSignal(value) {
  return extractColorValues(value).length > 0;
}

function signalSwatch(signal) {
  const firstColor = extractColorValues(signal.raw)[0];
  if (firstColor) return firstColor;
  if (String(signal.raw).includes("/")) {
    return `linear-gradient(135deg, ${String(signal.raw).split("/").map((item) => item.trim()).join(", ")})`;
  }
  if (String(signal.raw).includes("palette")) return selectedStyle.value.style.media;
  return "linear-gradient(135deg, #f6f5f4, #e6e6e6)";
}

function parseHexColor(value) {
  const hex = String(value).trim().replace("#", "");
  if (!/^[0-9a-f]{3,8}$/i.test(hex)) return null;
  const normalized = hex.length === 3 || hex.length === 4
    ? hex.split("").map((char) => char + char).join("")
    : hex;
  const hasAlpha = normalized.length === 8;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
    a: hasAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1,
  };
}

function rgbChannel(value) {
  const color = parseHexColor(value);
  if (!color) return "0, 0, 0";
  return `${color.r}, ${color.g}, ${color.b}`;
}

function formatHexColor(value) {
  const raw = String(value).trim();
  const match = raw.match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return raw;
  const hex = match[1];
  const normalized = hex.length === 3 || hex.length === 4
    ? hex.split("").map((char) => char + char).join("")
    : hex;
  return `#${normalized.toUpperCase()}`;
}

function readableTextColor(value, opacity = 0.8) {
  const color = parseHexColor(value);
  if (!color) return "var(--style-text)";
  const r = color.r * color.a + 255 * (1 - color.a);
  const g = color.g * color.a + 255 * (1 - color.a);
  const b = color.b * color.a + 255 * (1 - color.a);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.48 ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
}

function readableSolidTextColor(value) {
  const color = parseHexColor(value);
  if (!color) return "#fff";
  const r = color.r * color.a + 255 * (1 - color.a);
  const g = color.g * color.a + 255 * (1 - color.a);
  const b = color.b * color.a + 255 * (1 - color.a);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.48 ? "#fff" : "#111";
}

function legacyCopyText(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyPaletteColor(value) {
  let copied = legacyCopyText(value);
  if (!copied && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      copied = false;
    }
  }
  copiedColorValue.value = value;
  showCopySnackbar(value);
  window.setTimeout(() => {
    if (copiedColorValue.value === value) copiedColorValue.value = "";
  }, 900);
}

function showCopySnackbar(value) {
  window.clearTimeout(snackbarTimer);
  window.clearTimeout(snackbarCloseTimer);
  snackbarMessage.value = `已复制 ${value}`;
  snackbarOpen.value = false;
  window.setTimeout(() => {
    snackbarOpen.value = true;
  }, 20);
  snackbarTimer = window.setTimeout(() => {
    snackbarOpen.value = false;
    snackbarCloseTimer = window.setTimeout(() => {
      snackbarMessage.value = "";
    }, 250);
  }, 2000);
}

function extractColorValues(value) {
  return Array.from(String(value).matchAll(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/gi), (match) => match[0]);
}

function firstNumber(value, fallback) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function closestPrimitive(value, type) {
  const primitives = [
    { label: `${type}/Mini`, value: 2 },
    { label: `${type}/Small`, value: 4 },
    { label: `${type}/Normal`, value: 8 },
    { label: `${type}/Medium`, value: 12 },
    { label: `${type}/Large`, value: 16 },
  ];
  const number = firstNumber(value, 8);
  const exact = primitives.find((item) => item.value === number);
  if (exact) return { ...exact, status: "mapped" };
  const nearest = primitives.reduce((best, item) =>
    Math.abs(item.value - number) < Math.abs(best.value - number) ? item : best,
  primitives[0]);
  return { ...nearest, status: "fallback" };
}

function styleRecipeMappingTarget(category, item) {
  if (category === "typography") {
    if (/^[HBN][1-8]$/.test(item.title)) return "Echo typography scale · DangoUI no global typography token";
    if (/Button/i.test(item.title)) return "Button style.scss size classes · component source";
    if (/Tab/i.test(item.title)) return "Tabs / Tab style.scss · component source";
    if (/Title|Body|Caption|Micro|Line height|Font weight/i.test(item.title)) return "DangoUI component CSS · no global typography token";
    if (/Font family|Brand/i.test(item.title)) return "demoOnlyVisualControls / brand font asset";
    return "DangoUI component CSS / 页面文字样式";
  }
  if (category === "icon") {
    if (/brand|asset|logo/i.test(`${item.title} ${item.value}`)) return "demoOnlyVisualControls / asset reference";
    if (/button/i.test(item.title)) return "DuButton icon / iconPosition · ask-user when icon name is missing";
    return "DuIcon name / color inherits semantic token";
  }
  if (category === "button") {
    if (/IconButton/i.test(item.title)) return "DuButton + DuIcon / icon slot · state asset when needed";
    if (/FAB/i.test(item.title)) return "DangoUI 待新增 · floating action CSS / future DuFab";
    return "DuButton props + semantic color token";
  }
  if (category === "asset") {
    const text = `${item.title} ${item.value} ${item.role || ""}`;
    if (/logo|brand-mark|illustration/i.test(text)) return "DangoUI Image / slot when structure needs it · otherwise 页面资产样式";
    if (/selected|active/i.test(text)) return "state selector CSS background · selected/active only";
    if (/frame|border-image|9-slice/i.test(text)) return "页面 Frame 资产 · border-image/background";
    if (/texture|background/i.test(text)) return "page/panel CSS background asset";
    return "页面资产样式";
  }
  if (category === "layout") {
    return "template CSS / component composition · 页面布局样式";
  }
  if (category === "spacing") {
    if (/Empty/i.test(item.title)) return "--du-empty-padding · Empty component only";
    const tokenName = item.title.startsWith("Spacing/")
      ? item.title
      : `Spacing/${item.title.replace(/\s+/g, "")}`;
    return `future spacing token · ${tokenName} = ${item.value}`;
  }
  if (category === "divider") {
    if (/shadow/i.test(`${item.title} ${item.value}`)) {
      return "边界策略：禁用通用 shadow，改由 Frame/Divider 承担";
    }
    if (/frame|boundary|角线|ornate|HUD|panel|card|media/i.test(`${item.title} ${item.value}`)) {
      return "style-only Frame recipe + --du-border-* 颜色";
    }
    return "--du-border-1 / --du-primary-border";
  }
  if (category === "radius") {
    const tokenName = item.title.startsWith("Radius/")
      ? item.title
      : `Radius/${item.title.replace(/\s+/g, "")}`;
    return `future radius token / recipe · ${tokenName} = ${item.value}`;
  }
  if (category === "shadow") {
    const tokenName = item.title.startsWith("Shadow/")
      ? item.title
      : `Shadow/${item.title.replace(/\s+/g, "")}`;
    if (/glow|氛围光|magic|neon/i.test(`${item.title} ${item.value} ${item.note}`)) return `future effect recipe · ${tokenName}`;
    if (/inner|inset|line/i.test(`${item.title} ${item.value} ${item.note}`)) return `future boundary recipe · ${tokenName} = ${item.value}`;
    return `future shadow token · ${tokenName} = ${item.value}`;
  }
  if (category === "motion") {
    if (/snackbar/i.test(`${item.title} ${item.value}`)) return "DuSnackbar props · no motion token";
    if (/tab|switch|transition/i.test(`${item.title} ${item.value}`)) return "Transition / component state CSS · no motion token";
    return "interaction CSS · no --du-motion-*";
  }
  return selectedStyleCategory.value?.meta || "页面样式";
}

function styleInventorySource(category, item, index) {
  const text = `${item.title} ${item.value} ${item.note}`;
  if (category === "typography") {
    if (/^[HBN][1-8]$/.test(item.title)) return "H/B/N typography scale";
    if (/Font family|Brand/i.test(item.title)) return "font asset / CSS";
    if (/Letter spacing|Line height|Font weight/i.test(item.title)) return "component CSS";
    return "DangoUI component CSS";
  }
  if (category === "icon") {
    if (/brand|asset|logo/i.test(text)) return "asset reference";
    if (/button/i.test(text)) return "DuButton icon prop";
    return "DuIcon / semantic color";
  }
  if (category === "button") {
    if (/FAB/i.test(item.title)) return "floating action / page CSS";
    if (/IconButton/i.test(item.title)) return "Button + Icon composition";
    return "DangoUI Button";
  }
  if (category === "asset") {
    if (/logo|brand-mark/i.test(text)) return "local image asset";
    if (/selected|active/i.test(text)) return "state asset";
    if (/frame|border-image|9-slice/i.test(text)) return "asset frame";
    if (/texture|background/i.test(text)) return "background asset";
    return "asset inventory";
  }
  if (category === "divider") {
    if (/shadow/i.test(text)) return "Shadow anti-rule";
    if (/frame|boundary|角线|ornate|HUD|panel|card|media/i.test(text)) return "Frame CSS / --du-border-*";
    if (/selection|underline|active/i.test(text)) return "active indicator CSS";
    return "Divider.vue / --du-border-1";
  }
  if (category === "layout") {
    if (/Page shell/i.test(item.title)) return "mockup viewport";
    if (/Media/i.test(item.title)) return "media template CSS";
    return "page template";
  }
  if (category === "spacing") {
    if (/Empty/i.test(item.title)) return "Empty component token";
    if (/SafeX/i.test(item.title)) return "PageLayout safe-area";
    if (/HomeIndicator/i.test(item.title)) return "system safe-area";
    return "Spacing token scale";
  }
  if (category === "radius") {
    if (/None/i.test(item.title)) return "Frame boundary recipe";
    if (/Pill|Circle/i.test(item.title)) return "Shape token scale";
    return "Radius token scale";
  }
  if (category === "shadow") {
    if (/none/i.test(text)) return "Default none";
    if (/inset|border|line/i.test(text)) return "Boundary recipe";
    if (/glow|氛围光|magic|neon/i.test(text)) return "Effect recipe";
    return "Shadow token scale";
  }
  if (category === "motion") {
    if (/Snackbar/i.test(item.title)) return "DuSnackbar";
    return "interaction CSS";
  }
  return `project item ${index + 1}`;
}

function styleRecipeStatus(category, item) {
  const text = `${item.title} ${item.value} ${item.note}`;
  if (category === "typography") {
    if (/^[HBN][1-8]$/.test(item.title)) return "fallback";
    if (/Button|Tab|Title|Body|Caption|Micro|Line height|Font weight/i.test(item.title)) return "mapped";
    if (/Font family|Brand/i.test(item.title)) return "style-only";
    return "fallback";
  }
  if (category === "icon") return /missing|缺失|ask-user/i.test(text) ? "ask-user" : /asset|logo|brand/i.test(text) ? "style-only" : "mapped";
  if (category === "button") {
    if (/FAB/i.test(item.title)) return "missing";
    if (/IconButton/i.test(item.title)) return "composed";
    return "mapped";
  }
  if (category === "asset") {
    if (/candidate|缺失|ReviewQueue|ask-user/i.test(text)) return "ask-user";
    if (/Image slot|DangoUI Image/i.test(text)) return "composed";
    return "style-only";
  }
  if (category === "layout") return "style-only";
  if (category === "spacing") return /Empty/i.test(item.title) ? "mapped" : "style-only";
  if (category === "divider") return /frame|boundary|角线|ornate|HUD|panel|card|media|shadow/i.test(text) ? "style-only" : "mapped";
  if (category === "radius") return "style-only";
  if (category === "shadow") return "style-only";
  if (category === "motion") return /Snackbar/i.test(text) ? "mapped" : "style-only";
  return "style-only";
}

function recipeSwatchText(item) {
  if (selectedStyleCategoryId.value === "typography") return "Aa";
  if (selectedStyleCategoryId.value === "icon") return item.title.includes("Brand") ? "logo" : "icon";
  if (selectedStyleCategoryId.value === "button") {
    if (/IconButton|FAB/i.test(item.title)) return "+";
    if (/outline|描边/i.test(item.title)) return "描边";
    if (/secondary|soft|柔和/i.test(item.title)) return "柔和";
    if (/text|文字/i.test(item.title)) return "文字";
    return "主按钮";
  }
  if (selectedStyleCategoryId.value === "asset") {
    if (/font/i.test(item.role || item.title)) return "Aa";
    if (/logo/i.test(item.title)) return "png";
    if (/selected/i.test(item.title)) return "state";
    if (/cta/i.test(item.role || item.title)) return "cta";
    if (/decorative|orbital/i.test(item.role || item.title)) return "decor";
    if (/frame/i.test(item.title)) return "frame";
    if (/texture|background/i.test(item.title)) return "bg";
    return "asset";
  }
  if (selectedStyleCategoryId.value === "layout") return item.value;
  if (selectedStyleCategoryId.value === "spacing") return `${firstNumber(item.value, 8)}px`;
  if (selectedStyleCategoryId.value === "divider") {
    if (/selection/i.test(item.title)) return "active";
    if (/shadow/i.test(item.title)) return "none";
    if (/frame|boundary|panel|card|media/i.test(`${item.title} ${item.value}`)) return "frame";
    return "1px";
  }
  if (selectedStyleCategoryId.value === "radius") {
    if (String(item.value).includes("999")) return "pill";
    if (String(item.value).includes("%")) return item.value;
    return `${firstNumber(item.value, 8)}px`;
  }
  if (selectedStyleCategoryId.value === "shadow") return item.title.includes("Glow") ? "glow" : "layer";
  if (selectedStyleCategoryId.value === "motion") {
    if (/背景|drift/i.test(`${item.title} ${item.value}`)) return "drift";
    if (/入场|enter/i.test(`${item.title} ${item.value}`)) return "enter";
    if (/Snackbar|Toast|Feedback/i.test(`${item.title} ${item.value}`)) return "bar";
    return "motion";
  }
  return item.value;
}

function recipeSwatchStyle(item) {
  const category = selectedStyleCategoryId.value;
  if (category === "typography") {
    const [sizePart, weightPart] = String(item.value).split("/");
    const lineHeightPart = String(item.value).split("/")[2];
    return {
      fontSize: `${Math.min(firstNumber(sizePart, 14), 22)}px`,
      fontWeight: String(firstNumber(weightPart, 700)),
      lineHeight: lineHeightPart ? `${Math.min(firstNumber(lineHeightPart, 22), 28)}px` : undefined,
    };
  }
  if (category === "spacing") {
    const gap = Math.min(firstNumber(item.value, 8), 24);
    return {
      "--recipe-gap": `${gap}px`,
    };
  }
  if (category === "radius") {
    const radius = item.value.includes("999") ? 999 : firstNumber(item.value, 8);
    return {
      "--recipe-radius": radius === 999 ? "999px" : `${Math.min(radius, 28)}px`,
    };
  }
  if (category === "divider") {
    const text = `${item.title} ${item.value}`.toLowerCase();
    return {
      "--recipe-divider": selectedStyleTokenMap.value["--du-border-1"] || selectedStyleTokenMap.value["--du-primary-border"] || "#d9d9d9",
      "--recipe-divider-accent": selectedStyleTokenMap.value["--du-primary-border"] || selectedStyleTokenMap.value["--du-primary-color"] || "#8e6140",
      "--recipe-frame-opacity": /frame|boundary|panel|card|media/.test(text) ? 1 : 0,
    };
  }
  if (category === "asset") {
    const isFontAsset = /font/i.test(`${item.role || ""} ${item.title}`);
    return {
      "--recipe-asset-image": isFontAsset ? "none" : item.assetPath ? `url("${item.assetPath}")` : item.value.includes("/assets/") ? `url("${item.value.split(" · ")[0]}")` : "none",
      "--recipe-asset-accent": selectedStyleTokenMap.value["--du-primary-border"] || selectedStyleTokenMap.value["--du-primary-color"] || "#8e6140",
      "--recipe-asset-bg": selectedStyleTokenMap.value["--du-bg-1"] || selectedStyleTokenMap.value["--du-bg-2"] || "#131818",
    };
  }
  if (category === "button") {
    const isFab = /FAB/i.test(item.title);
    const isIconButton = /IconButton/i.test(item.title);
    const isPill = /pill|胶囊/i.test(`${item.title} ${item.value} ${item.note}`);
    const bg = selectedStyleTokenMap.value["--du-primary-solid-bg"] || selectedStyleTokenMap.value["--du-primary-color"] || selectedStyle.value.style.accent;
    const border = selectedStyleTokenMap.value["--du-primary-border"] || selectedStyleTokenMap.value["--du-border-1"] || bg;
    const surface = selectedStyleTokenMap.value["--du-bg-1"] || selectedStyle.value.style.surface || "transparent";
    const text = selectedStyleTokenMap.value["--du-text-1"] || readableSolidTextColor(surface);
    return {
      "--recipe-button-radius": isFab || isIconButton || isPill ? "999px" : "var(--style-control-radius)",
      "--recipe-button-width": isFab ? "46px" : isIconButton ? "34px" : "74px",
      "--recipe-button-height": isFab ? "46px" : isIconButton ? "34px" : "32px",
      "--recipe-button-bg": bg,
      "--recipe-button-surface": surface,
      "--recipe-button-border": border,
      "--recipe-button-text": text,
      "--recipe-button-fg": readableSolidTextColor(bg),
      "--recipe-button-shadow": "none",
      "--recipe-button-outline-bg": surface,
      "--recipe-button-outline-fg": text,
    };
  }
  if (category === "motion") {
    return {
      "--recipe-motion-bg": selectedStyleTokenMap.value["--du-bg-1"] || selectedStyle.value.style.surface || "#131818",
      "--recipe-motion-accent": selectedStyleTokenMap.value["--du-primary-color"] || selectedStyle.value.style.accent || "#b55829",
      "--recipe-motion-line": selectedStyleTokenMap.value["--du-border-1"] || selectedStyleTokenMap.value["--du-primary-border"] || "#45392f",
      "--recipe-motion-text": selectedStyleTokenMap.value["--du-text-1"] || "#e9dccd",
    };
  }
  if (category === "layout") {
    const title = String(item.title || "");
    const bg1 = selectedStyleTokenMap.value["--du-bg-1"] || "#ffffff";
    const bg2 = selectedStyleTokenMap.value["--du-bg-2"] || "#f7f7f9";
    const line = "color-mix(in srgb, var(--du-default-8) 9%, transparent)";
    const card = title.includes("white-base-gray-card") ? bg2 : bg1;
    const page = title.includes("white-base-gray-card") ? bg1 : bg2;
    const radius = title.includes("full-bleed") || title.includes("gray-base-full-bleed") ? "0px" : "8px";
    let layoutBg = "";
    if (title.includes("two-column")) {
      layoutBg = `linear-gradient(${card}, ${card}) 8px 8px / calc(50% - 12px) 64px no-repeat, linear-gradient(${card}, ${card}) calc(50% + 4px) 8px / calc(50% - 12px) 86px no-repeat`;
    } else if (title.includes("full-bleed")) {
      layoutBg = `linear-gradient(${card}, ${card}) 0 8px / 100% 13px no-repeat, linear-gradient(${card}, ${card}) 0 29px / 100% 22px no-repeat`;
    } else {
      layoutBg = `linear-gradient(${card}, ${card}) 8px 8px / calc(100% - 16px) 18px no-repeat, linear-gradient(${card}, ${card}) 8px 34px / calc(100% - 16px) 18px no-repeat`;
    }
    return {
      "--recipe-layout-page": page,
      "--recipe-layout-card": card,
      "--recipe-layout-line": line,
      "--recipe-layout-radius": radius,
      background: `${layoutBg}, ${page}`,
    };
  }
  if (category === "shadow") {
    return {
      "--recipe-shadow": item.title.includes("Glow")
        ? `0 0 24px ${selectedStyleTokenMap.value["--du-primary-color"] || "rgba(0,0,0,.18)"}`
        : selectedStyle.value.style.cardShadow,
    };
  }
  return {};
}

function componentDocsUrl(name) {
  return componentDocs[name] || docsBaseUrl;
}

function tokenPreview(name) {
  const meta = componentMeta(name);
  return meta ? Object.values(meta.tokens || {}).slice(0, tokenPreviewLimit) : [];
}

function extraTokenCount(name) {
  const meta = componentMeta(name);
  const count = meta ? Object.values(meta.tokens || {}).length : 0;
  return Math.max(0, count - tokenPreviewLimit);
}

function normalizeTokenName(token) {
  return String(token || "").replace(/^var\((--du-[^)]+)\)$/, "$1");
}

function getToken(tokenName) {
  const normalized = normalizeTokenName(tokenName);
  return (
    catalog.value.tokens.find((token) => token.name === normalized) || {
      name: normalized,
      value: "见组件绑定",
      usage: "组件局部 token 或派生变量",
    }
  );
}

function clearDemoSelection() {
  selectedInstanceId.value = "";
  selectedComponent.value = "";
  selectedTokenName.value = "";
  tokensExpanded.value = false;
}

function clearCanvasSelection() {
  selectedInstanceId.value = "";
  selectedTokenName.value = "";
  tokensExpanded.value = false;
}

function componentCategoryForName(name) {
  return componentCategorySpecs.find((category) => category.components.includes(name))?.id || selectedComponentCategoryId.value;
}

function defaultComponentForCategory(categoryId = selectedComponentCategoryId.value) {
  const category = componentCategorySpecs.find((item) => item.id === categoryId) || componentCategorySpecs[0];
  return category.components[0] || "";
}

function selectComponentCategory(categoryId) {
  selectedComponentCategoryId.value = categoryId;
  selectedInspectorTab.value = "components";
  selectedWorkspaceMode.value = "components";
  clearCanvasSelection();
  selectedComponent.value = defaultComponentForCategory(categoryId);
}

function selectCatalogComponent(name) {
  selectedComponentCategoryId.value = componentCategoryForName(name);
  selectedInspectorTab.value = "components";
  selectedWorkspaceMode.value = "components";
  clearCanvasSelection();
  selectedComponent.value = name;
}

const defaultSelectionExclusions = new Set(["NavigationBar", "NavigationBarRight", "SearchRight"]);

function defaultInstanceForCurrentTemplate() {
  const template = selectedTemplate.value;
  const componentName = template.components.find((name) => !defaultSelectionExclusions.has(name)) || template.components[0];
  if (!componentName) return null;
  const instanceId = pageNodeId(componentName, template.id);
  return (
    pageInstances.value.find((instance) => instance.id === instanceId) ||
    pageInstances.value.find((instance) => instance.templateId === template.id && instance.name === componentName) ||
    pageInstances.value.find((instance) => instance.name === componentName) ||
    null
  );
}

function selectDefaultInstanceForCurrentTemplate(options = {}) {
  const { scroll = true } = options;
  const instance = defaultInstanceForCurrentTemplate();
  if (!instance) {
    clearDemoSelection();
    return;
  }
  selectedInspectorTab.value = "components";
  selectedWorkspaceMode.value = "components";
  selectedComponent.value = instance.name;
  selectedComponentCategoryId.value = componentCategoryForName(instance.name);
  selectedInstanceId.value = instance.id;
  selectedTokenName.value = "";
  tokensExpanded.value = false;
  if (scroll) {
    nextTick(() => {
      scrollInspectorToSelectedInstance();
      scrollDemoToSelectedNode();
    });
  }
}

function setSelectedTemplate(templateId, options = {}) {
  const { record = true } = options;
  if (!templateId || templateId === selectedTemplateId.value) return;
  if (record) {
    templateHistory.value = [...templateHistory.value.slice(-8), selectedTemplateId.value];
  }
  selectedTemplateId.value = templateId;
}

function scrollInspectorToSelectedInstance() {
  document
    .querySelector(`[data-instance-id="${selectedInstanceId.value}"]`)
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function scrollDemoToSelectedNode() {
  const node =
    document.querySelector(`.nav-searchbar-target[data-node-id="${selectedInstanceId.value}"]`) ||
    document.querySelector(`.template-feed > [data-node-id="${selectedInstanceId.value}"]`) ||
    document.querySelector(`.template-feed [data-node-id="${selectedInstanceId.value}"]:not(.supplement-component-card)`) ||
    document.querySelector(`.phone-screen > [data-node-id="${selectedInstanceId.value}"]`) ||
    document.querySelector(`.supplement-component-card[data-node-id="${selectedInstanceId.value}"]`) ||
    document.querySelector(`[data-node-id="${selectedInstanceId.value}"]`);
  if (!node) return;
  node.scrollIntoView({ block: "center", behavior: "auto" });
}

function hoverLabelForNodeId(nodeId) {
  const instance = pageInstances.value.find((item) => item.id === nodeId);
  const hoverCategoryOverrides = {
    Button: "数据输入",
    Card: "数据输出",
    CharacterPanel: "数据输出",
    FAB: "导航",
    Feed: "数据输出",
    FeedSpuTag: "数据输出",
    Grid: "数据输出",
    Group: "数据输出",
    HeroHeader: "数据输出",
    List: "数据输出",
    SPU: "数据输出",
    Steps: "数据输出",
    Swipe: "数据输出",
  };
  const knownComponents = [...new Set([...componentCategorySpecs.flatMap((spec) => spec.components), ...Object.keys(hoverCategoryOverrides)])].sort((a, b) => kebabName(b).length - kebabName(a).length);
  const matchedName = knownComponents.find((componentName) => nodeId?.endsWith(`-${kebabName(componentName)}`));
  const name = instance?.name || matchedName || nodeId?.split("-").pop() || "";
  const category = componentCategorySpecs.find((spec) => spec.components.includes(name));
  const categoryLabel = category?.label || hoverCategoryOverrides[name] || "组件";
  return `组件 - ${categoryLabel} - ${componentDisplayName(name) || name}`;
}

function prepareMockupHoverLabel(event) {
  const target = event.target?.closest?.(".click-target[data-node-id], .nav-searchbar-target[data-node-id]");
  const screen = event.currentTarget;
  if (!target || !screen?.getBoundingClientRect) {
    clearMockupHoverLabel();
    return;
  }
  const label = target.dataset.styleHoverLabel || hoverLabelForNodeId(target.dataset.nodeId);
  const screenRect = screen.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const labelHeight = 32 * mockupScale.value;
  const gap = 8 * mockupScale.value;
  const inset = 12 * mockupScale.value;
  let top = targetRect.top - screenRect.top - labelHeight - gap;
  if (top < inset) {
    top = targetRect.bottom - screenRect.top + gap;
  }
  top = Math.max(inset, Math.min(top, screenRect.height - labelHeight - inset));
  mockupHoverLabel.value = label;
  mockupHoverStyle.value = {
    top: `${top}px`,
    right: `${inset}px`,
    left: "auto",
  };
  target.dataset.hoverLabel = label;
  target.removeAttribute("title");
}

function clearMockupHoverLabel() {
  mockupHoverLabel.value = "";
  mockupHoverStyle.value = {};
}

function prepareMockupPopupHoverLabel(event) {
  const popup = event.target?.closest?.(".du-popup__content");
  if (!popup || document.documentElement.dataset.mockupPopup !== "select") return;
  let componentName = document.documentElement.dataset.mockupPopupComponent || "Popup";
  let hoverTarget = popup;
  const selectOption = event.target?.closest?.(".du-select__option");
  if (selectOption?.querySelector?.(".du-radio")) {
    componentName = "Radio";
    hoverTarget = selectOption;
  } else if (selectOption?.querySelector?.(".du-checkbox")) {
    componentName = "Checkbox";
    hoverTarget = selectOption;
  } else if (event.target?.closest?.(".du-radio")) {
    componentName = "Radio";
    hoverTarget = event.target.closest(".du-radio");
  } else if (event.target?.closest?.(".du-checkbox")) {
    componentName = "Checkbox";
    hoverTarget = event.target.closest(".du-checkbox");
  } else if (event.target?.closest?.(".du-cascader__search, .du-select__search, .du-search")) {
    componentName = "Search";
    hoverTarget = event.target.closest(".du-cascader__search, .du-select__search, .du-search");
  } else if (event.target?.closest?.(".du-tabs")) {
    componentName = "Tabs";
    hoverTarget = event.target.closest(".du-tabs");
  } else if (event.target?.closest?.(".du-cascader__option")) {
    componentName = "Cascader";
    hoverTarget = event.target.closest(".du-cascader__option");
  } else if (event.target?.closest?.(".du-select__options")) {
    componentName = "Select";
    hoverTarget = event.target.closest(".du-select__options");
  } else if (event.target?.closest?.(".du-cascader__options")) {
    componentName = "Cascader";
    hoverTarget = event.target.closest(".du-cascader__options");
  }
  const label = `组件 - ${componentCategorySpecs.find((spec) => spec.components.includes(componentName))?.label || "组件"} - ${componentDisplayName(componentName) || componentName}`;
  const screen = phoneRef.value?.querySelector?.(".phone-screen");
  const screenRect = screen?.getBoundingClientRect?.();
  const targetRect = hoverTarget.getBoundingClientRect?.();
  if (!screenRect || !targetRect) return;
  const labelHeight = 32 * mockupScale.value;
  const gap = 8 * mockupScale.value;
  const inset = 12 * mockupScale.value;
  let top = targetRect.top - screenRect.top - labelHeight - gap;
  if (top < inset) {
    top = targetRect.bottom - screenRect.top + gap;
  }
  top = Math.max(inset, Math.min(top, screenRect.height - labelHeight - inset));
  mockupHoverLabel.value = label;
  mockupHoverStyle.value = {
    top: `${top}px`,
    right: `${inset}px`,
    left: "auto",
  };
  popup.removeAttribute("data-hover-label");
}

function clearMockupPopupHoverLabel(event) {
  const popup = event.target?.closest?.(".du-popup__content");
  if (!popup) return;
  popup.removeAttribute("data-hover-label");
  clearMockupHoverLabel();
}

function syncMockupHoverLabels() {
  document.querySelectorAll(".phone-screen [data-node-id]").forEach((target) => {
    const label = target.dataset.styleHoverLabel || hoverLabelForNodeId(target.dataset.nodeId);
    target.dataset.hoverLabel = label;
    target.removeAttribute("title");
  });
}

function selectInstance(instanceId, event) {
  if (event) {
    event.stopPropagation();
  }
  clearDemoSelection();
}

function restoreMockupSelection(event) {
  clearCanvasSelection();
}

function handleMockupWheel(event) {
  if (!isSourceSchemaTemplate.value) return;
  const screen = phoneRef.value?.querySelector?.(".phone-screen");
  if (!screen || screen.scrollHeight <= screen.clientHeight) return;
  event.preventDefault();
  event.stopPropagation();
  screen.scrollTop += event.deltaY;
}

function restorePhoneScreenScroll() {
  nextTick(() => {
    const screen = phoneRef.value?.querySelector?.(".phone-screen");
    if (!screen) return;
    screen.scrollTop = 0;
    screen.scrollLeft = 0;
  });
}

function selectTemplate(templateId, options = {}) {
  const { inspectorTab = "components" } = options;
  selectedInspectorTab.value = inspectorTab;
  selectedWorkspaceMode.value = inspectorTab === "style" ? "style" : inspectorTab;
  setSelectedTemplate(templateId);
  clearDemoSelection();
}

function isTemplateTabActive(template) {
  return template.sourceIds ? template.sourceIds.includes(selectedTemplateId.value) : selectedTemplateId.value === template.id;
}

function pageDemoRank(template) {
  if (template.side === "publish") return 99;
  if (template.side === "distribution") return 0;
  if (template.side === "display") return 3;
  const text = `${template.tab || ""} ${template.name || ""} ${template.id || ""}`;
  if (/首页|home/i.test(text)) return 0;
  if (/资讯|公告|前瞻|forward|news/i.test(text)) return 1;
  if (/角色|档案|卡牌|archive|character|cards/i.test(text)) return 2;
  if (/影像|媒体|图库|media/i.test(text)) return 3;
  if (/发布|publish|发布器/i.test(text)) return 99;
  return 9;
}

function uniqueComponents(items) {
  return [...new Set(items.filter(Boolean))];
}

function pageCoverageComponents(template = selectedTemplate.value) {
  const text = `${template?.tab || ""} ${template?.name || ""} ${template?.id || ""}`;
  const base = template?.components || [];
  if (/首页|home/i.test(text)) {
    return uniqueComponents([
      ...base,
      "Search",
      "Tabs",
      "SegmentControl",
      "TabBar",
      "BottomBar",
      "Menu",
      "Grid",
      "List",
      "Card",
      "Button",
      "FAB",
    ]);
  }
  if (/资讯|公告|前瞻|forward|news/i.test(text)) {
    return uniqueComponents([
      ...base,
      "NoticeBar",
      "Badge",
      "Tag",
      "Empty",
      "Image",
      "Avatar",
      "Time",
      "PriceStatistic",
      "Swiper",
      "List",
      "Card",
      "Tabs",
      "Button",
    ]);
  }
  if (/角色|档案|卡牌|archive|character|cards/i.test(text)) {
    return uniqueComponents([
      ...base,
      "Image",
      "Avatar",
      "Badge",
      "Tag",
      "Rate",
      "Time",
      "PriceStatistic",
      "Tabs",
      "Card",
      "Popup",
    ]);
  }
  if (/影像|媒体|图库|media/i.test(text)) {
    return uniqueComponents([
      ...base,
      "Swiper",
      "Image",
      "Tabs",
      "Tag",
      "Badge",
      "Empty",
      "Skeleton",
      "Spin",
    ]);
  }
  if (/发布|publish|发布器/i.test(text)) {
    return uniqueComponents([
      ...base,
      "FormItem",
      "Input",
      "Textarea",
      "Radio",
      "Checkbox",
      "Switch",
      "Stepper",
      "Upload",
      "Tips",
      "Group",
      "DateTimePicker",
      "Rate",
      "Cascader",
      "Select",
      "Button",
      "Snackbar",
      "Toast",
      "Dialog",
      "Popup",
      "ShareSheet",
      "ResultPage",
    ]);
  }
  return uniqueComponents(base);
}

function selectTemplateTab(template) {
  selectTemplate(template.renderId || template.id, { inspectorTab: "pages" });
}

function templatePageTitle(template) {
  const title = `${template.name || ""} ${template.tab || ""} ${template.id || ""}`;
  if (/首页|home/i.test(title)) return "首页";
  if (template.sourceIds?.length) return template.tab || template.name;
  return template.name || template.tab;
}

function templateKindLabel(template) {
  if (template.kind) return template.kind;
  const sideKindMap = {
    distribution: "数据输出",
    display: "数据输出",
    publish: "数据输入",
    feedback: "反馈",
  };
  return sideKindMap[template.side] || "BAR";
}

function templateKindClass(template) {
  const kind = templateKindLabel(template);
  if (kind === "数据输出") return "output";
  if (kind === "数据输入") return "input";
  if (kind === "反馈") return "feedback";
  return "bar";
}

function templateDescription(template) {
  if (template.description) return template.description;
  if (template.sourceIds?.length) {
    const names = template.sourceIds
      .map((id) => currentTemplatePages.value.find((item) => item.id === id)?.tab)
      .filter(Boolean);
    return names.length ? names.join(" / ") : "当前参考站页面";
  }
  return "当前参考站页面";
}

function openRe1999HomePanel(panel) {
  re1999HomePanel.value = panel;
  const routes = {
    news: "re1999-news",
    archive: "re1999-archive",
    media: "re1999-media",
  };
  if (routes[panel]) selectTemplate(routes[panel], { inspectorTab: "pages" });
}



function openHpmaHomePanel(panel) {
  hpmaHomePanel.value = panel;
  const routes = {
    news: "hpma-news",
    cards: "hpma-cards",
    media: "hpma-media",
  };
  if (routes[panel]) selectTemplate(routes[panel], { inspectorTab: "pages" });
}

function openCznHomePanel(panel) {
  cznHomePanel.value = panel;
  const routes = {
    forward: "czn-forward",
    character: "czn-character",
    media: "czn-media",
  };
  if (routes[panel]) selectTemplate(routes[panel], { inspectorTab: "pages" });
}

function openPublishSide() {
  selectTemplate(publishTemplateId.value, { inspectorTab: "pages" });
}

function handleNavigationExampleShare() {
  console.log("[demo] share");
}

function selectStyle(styleId) {
  selectedStyleId.value = styleId;
  if (selectedInspectorTab.value === "style") {
    selectedWorkspaceMode.value = "style";
    selectedStyleCategoryId.value = "color";
  } else {
    selectedInspectorTab.value = "pages";
    selectedWorkspaceMode.value = "pages";
    selectedStyleCategoryId.value = "";
  }
  templateHistory.value = [];
  setSelectedTemplate(allDemoPagesByStyle.value[styleId]?.[0]?.id || "distribution", { record: false });
  clearDemoSelection();
}

function handleNavigationBarCapture(event) {
  if (!event.target?.closest?.(".du-navigation-bar__back")) return;
  event.preventDefault();
  event.stopPropagation();
  navigateBackInDemo();
}

function navigateBackInDemo() {
  const validIds = new Set(currentTemplatePages.value.map((template) => template.id));
  while (templateHistory.value.length) {
    const targetId = templateHistory.value.pop();
    if (targetId && targetId !== selectedTemplateId.value && validIds.has(targetId)) {
      setSelectedTemplate(targetId, { record: false });
      clearDemoSelection();
      return;
    }
  }
  const fallbackId = currentDemoPages.value[0]?.id || templatePages[0]?.id;
  if (fallbackId && fallbackId !== selectedTemplateId.value) {
    setSelectedTemplate(fallbackId, { record: false });
    clearDemoSelection();
  }
}

function showStyleMenu() {
  selectedInspectorTab.value = "style";
  selectedWorkspaceMode.value = "style";
  selectedStyleCategoryId.value = selectedStyleCategoryId.value || "color";
  clearDemoSelection();
}

function showPageMenu() {
  selectedInspectorTab.value = "pages";
  selectedWorkspaceMode.value = "pages";
  selectedStyleCategoryId.value = "";
  clearDemoSelection();
}

function showComponentMenu() {
  selectedInspectorTab.value = "components";
  selectedWorkspaceMode.value = "components";
  clearCanvasSelection();
  if (!selectedComponent.value) {
    selectedComponent.value = defaultComponentForCategory();
  }
  selectedComponentCategoryId.value = componentCategoryForName(selectedComponent.value);
}

function selectStyleCategory(categoryId) {
  selectedStyleCategoryId.value = categoryId;
  selectedWorkspaceMode.value = "style";
  selectedInspectorTab.value = "style";
  activeStyleRecipeKey.value = "";
  styleCategoryPulse.value = false;
  nextTick(() => {
    styleCategoryPulse.value = true;
    window.setTimeout(() => {
      styleCategoryPulse.value = false;
    }, 520);
    styleEvidenceRef.value?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    if (categoryId === "button" && selectedStyleRecipeRows.value[0]) {
      activeStyleRecipeKey.value = styleRecipeKey(selectedStyleRecipeRows.value[0]);
    }
  });
}

function selectToken(tokenName) {
  selectedTokenName.value = normalizeTokenName(tokenName);
  tokensExpanded.value = true;
}

function validStyleId(styleId) {
  return stylePresets.value.some((preset) => preset.id === styleId);
}

function validStyleCategoryId(categoryId) {
  return styleCategories.some((category) => category.id === categoryId);
}

function componentFromRouteSegment(segment = "") {
  const normalized = decodeURIComponent(segment);
  return componentCategorySpecs
    .flatMap((category) => category.components)
    .find((name) => kebabName(name) === normalized || name === normalized);
}

function defaultTemplateForStyle(styleId = selectedStyleId.value) {
  return allDemoPagesByStyle.value[styleId]?.[0]?.id || templatePages[0]?.id || "distribution";
}

function templateExistsForCurrentStyle(templateId) {
  const scopedPages = currentDemoPages.value.length ? currentDemoPages.value : currentTemplatePages.value;
  return scopedPages.some((template) => template.id === templateId);
}

function routeForCurrentState() {
  const styleId = selectedStyleId.value;
  if (selectedInspectorTab.value === "style") {
    return `#/brand/${styleId}/style/${selectedStyleCategoryId.value || "color"}`;
  }
  if (selectedInspectorTab.value === "components") {
    const componentName = selectedComponent.value || defaultComponentForCategory();
    return `#/brand/${styleId}/components/${kebabName(componentName)}`;
  }
  return `#/brand/${styleId}/pages/${selectedTemplateId.value || defaultTemplateForStyle(styleId)}`;
}

function syncRouteToLocation() {
  if (isApplyingRoute || typeof window === "undefined") return;
  const route = routeForCurrentState();
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = `${window.location.pathname}${window.location.search}${route}`;
  if (current === next) return;
  window.history.replaceState({}, "", next);
}

function applyRouteFromLocation() {
  if (typeof window === "undefined") return;
  const rawHash = window.location.hash.replace(/^#\/?/, "");
  const segments = rawHash.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (segments[0] !== "brand") return;

  const styleId = validStyleId(segments[1]) ? segments[1] : selectedStyleId.value;
  const mode = segments[2] || "pages";
  const target = segments[3] || "";

  isApplyingRoute = true;
  selectedStyleId.value = styleId;
  templateHistory.value = [];

  if (mode === "style") {
    selectedInspectorTab.value = "style";
    selectedWorkspaceMode.value = "style";
    selectedStyleCategoryId.value = validStyleCategoryId(target) ? target : "color";
    const fallbackTemplateId = defaultTemplateForStyle(styleId);
    if (fallbackTemplateId && !templateExistsForCurrentStyle(selectedTemplateId.value)) {
      selectedTemplateId.value = fallbackTemplateId;
    }
  } else if (mode === "components") {
    const componentName = componentFromRouteSegment(target) || defaultComponentForCategory();
    const isExplicitStyleCategory = !componentFromRouteSegment(target) && validStyleCategoryId(target);
    if (isExplicitStyleCategory) {
      selectedInspectorTab.value = "style";
      selectedWorkspaceMode.value = "style";
      selectedStyleCategoryId.value = target;
    } else {
      selectedInspectorTab.value = "components";
      selectedWorkspaceMode.value = "components";
      selectedStyleCategoryId.value = "";
      selectedComponent.value = componentName;
      selectedComponentCategoryId.value = componentCategoryForName(componentName);
    }
    const fallbackTemplateId = defaultTemplateForStyle(styleId);
    if (fallbackTemplateId && !templateExistsForCurrentStyle(selectedTemplateId.value)) {
      selectedTemplateId.value = fallbackTemplateId;
    }
  } else {
    selectedInspectorTab.value = "pages";
    selectedWorkspaceMode.value = "pages";
    selectedStyleCategoryId.value = "";
    const templateId = templateExistsForCurrentStyle(target) ? target : defaultTemplateForStyle(styleId);
    if (templateId) {
      selectedTemplateId.value = templateId;
    }
  }

  clearDemoSelection();
  isApplyingRoute = false;
  syncRouteToLocation();
}

function updateMockupScale() {
  const width = phoneRef.value?.getBoundingClientRect?.().width;
  if (!width) return;
  mockupScale.value = Math.min(1, Math.max(0.52, width / 395));
  syncMockupPopupBounds();
}

function syncMockupPopupBounds(componentName = "") {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const screen = phoneRef.value?.querySelector?.(".phone-screen") || phoneRef.value;
  const rect = screen?.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) return;
  const phoneStyle = window.getComputedStyle(phoneRef.value);
  const frameRadius = parseFloat(phoneStyle.getPropertyValue("--mockup-frame-radius-scaled")) || 42 * mockupScale.value;
  const frameBorder = parseFloat(phoneStyle.getPropertyValue("--mockup-frame-border-scaled")) || 10 * mockupScale.value;
  const homeIndicatorHeight = parseFloat(phoneStyle.getPropertyValue("--mockup-home-indicator-height")) || 34 * mockupScale.value;
  const screenRadius = Math.max(0, frameRadius - frameBorder);
  const root = document.documentElement;
  root.style.setProperty("--mockup-popup-left", `${rect.left}px`);
  root.style.setProperty("--mockup-popup-top", `${rect.top}px`);
  root.style.setProperty("--mockup-popup-right", `${Math.max(0, window.innerWidth - rect.right)}px`);
  root.style.setProperty("--mockup-popup-width", `${rect.width}px`);
  root.style.setProperty("--mockup-popup-height", `${rect.height}px`);
  root.style.setProperty("--mockup-popup-bottom", `${Math.max(0, window.innerHeight - rect.bottom)}px`);
  root.style.setProperty("--mockup-popup-radius", `${screenRadius}px`);
  root.style.setProperty("--mockup-popup-home-indicator", `${homeIndicatorHeight}px`);
  const popupSizeRatioMap = {
    Select: 0.3,
    DateTimePicker: 0.88,
    Cascader: 0.6,
    Popup: 0.88,
  };
  root.style.setProperty("--mockup-popup-size-ratio", `${popupSizeRatioMap[componentName] || 0.6}`);
  root.dataset.mockupPopup = "select";
  if (componentName) {
    root.dataset.mockupPopupComponent = componentName;
  }
}

async function loadRuntimeBrandPreviews() {
  if (typeof fetch === "undefined") return;
  try {
    const response = await fetch("/brand-previews/registry.json", { cache: "no-store" });
    if (!response.ok) return;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return;
    const registry = await response.json();
    const entries = Array.isArray(registry.brands) ? [...registry.brands] : [];
    // Dango is intentionally loaded as an implementation draft while it remains
    // outside the public registry. Blind QA decides whether it may be registered.
    if (!entries.some((entry) => entry?.id === "dango")) {
      entries.unshift({ id: "dango", path: "/brand-previews/dango.json", draftOnly: true });
    }
    // Versioned relearn candidates are runtime-only drafts. They intentionally
    // stay outside the public registry until fresh QA and release gates pass.
    if (!entries.some((entry) => entry?.id === "dango")) {
      entries.unshift({ id: "dango", path: "/brand-previews/dango.json", draftOnly: true });
    }
    const previews = [];
    const recipes = {};
    const pagesByStyle = {};

    for (const entry of entries) {
      const previewPath = entry.path || `/brand-previews/${entry.id}.json`;
      const previewResponse = await fetch(previewPath, { cache: "no-store" });
      const previewContentType = previewResponse.headers.get("content-type") || "";
      if (!previewResponse.ok || !previewContentType.includes("application/json")) continue;
      const preview = await previewResponse.json();
      if (!preview?.preset?.id) continue;
      const id = preview.preset.id;
      previews.push(normalizeRuntimePreset(preview.preset, preview, entry));
      recipes[id] = normalizeRuntimeRecipe(preview.styleRecipeDetails);
      pagesByStyle[id] = normalizeRuntimePages(id, preview.pages);
    }

    runtimeBrandPreviews.value = previews;
    runtimeStyleRecipeDetails.value = recipes;
    runtimeDemoPagesByStyle.value = pagesByStyle;
  } catch (error) {
    console.warn("[brand-preview] registry load skipped", error);
  }
}

function normalizeRuntimePreset(preset, preview = {}, registryEntry = {}) {
  const tokens = Array.isArray(preset.tokens) ? preset.tokens : [];
  const tokenMap = Object.fromEntries(tokens.map((token) => [token.name, token.value]));
  const semanticRoles = preset.semanticRoles || {};
  const semanticPrimaryFill = semanticRoles["action.primary.fill"]?.value;
  const semanticActiveFill = semanticRoles["action.active.fill"]?.value;
  const semanticNeutralSurface = semanticRoles["action.neutral.surface"]?.value;
  const semanticTextBorder = semanticRoles["action.text.border"]?.value;
  const fallbackPrimary = semanticActiveFill || tokenMap["--du-primary-color"] || "#7c66ff";
  const fallbackBg = tokenMap["--du-bg-2"] || "#f7f7f9";
  const fallbackCardBg = tokenMap["--du-bg-1"] || "#ffffff";
  const fallbackPrimaryBorder = semanticTextBorder || tokenMap["--du-primary-border"] || fallbackPrimary;
  const fallbackPrimarySoftBg = semanticNeutralSurface || tokenMap["--du-primary-soft-bg"] || semanticPrimaryFill || fallbackCardBg;
  return {
    ...preset,
    label: preset.label || preset.id,
    icon: preset.icon || "/favicon.svg",
    source: preset.source || preview.sourceUrl || "runtime brand preview",
    hero: preset.hero || preset.label || preset.id,
    notice: preset.notice || "由 /brand 官网 URL 生成的临时标准 demo 预览，等待人工验收后沉淀为维护版 style pack。",
    evidenceNote: preset.evidenceNote || "临时预览先展示风格能力结构；细节证据需要继续补 CSS、截图、资产和 computed diff。",
    sectionTitle: preset.sectionTitle || "Runtime Preview",
    tabs: preset.tabs || ["首页", "展示", "发布"],
    cards: preset.cards || [
      { title: "风格能力预览", copy: "先看颜色、字体、圆角、边框、阴影、资产和状态是否形成完整视觉语言。" },
      { title: "业务应用前置", copy: "标准 demo 通过后，再把同一套 token / recipe 应用到业务项目默认入口。" },
    ],
    tokens: tokens.length ? tokens : [
      { name: "--du-bg-2", value: fallbackBg },
      { name: "--du-bg-1", value: fallbackCardBg },
      { name: "--du-primary-color", value: fallbackPrimary },
      { name: "--du-primary-border", value: fallbackPrimaryBorder },
      { name: "--du-primary-soft-bg", value: fallbackPrimarySoftBg },
      { name: "--du-primary-solid-bg", value: fallbackPrimary },
    ],
    style: {
      cardRadius: "12px",
      controlRadius: "999px",
      pageSpacing: "16px",
      cardShadow: "none",
      media: `linear-gradient(135deg, ${fallbackBg}, ${fallbackCardBg} 52%, ${fallbackPrimary})`,
      ...(preset.style || {}),
    },
    signals: Array.isArray(preset.signals) ? preset.signals : [],
    learningProof: {
      status: preview.status || "unreported",
      standardDemo: Boolean(preview.standardDemo),
      businessApply: Boolean(preview.businessApply),
      blockers: Array.isArray(preview.mustVerifyBeforeApply) ? preview.mustVerifyBeforeApply : [],
      ...(preview.learningProof || {}),
    },
    registry: registryEntry.publicationStatus ? {
      version: registryEntry.version,
      publicationStatus: registryEntry.publicationStatus,
      platformSupport: registryEntry.platformSupport || {},
      reusePolicy: registryEntry.reusePolicy || {},
    } : null,
    runtimePreview: true,
  };
}

function publicationStatusLabel(status) {
  return ({ draft: "草稿", "public-preview": "公开预览", published: "已发布", retired: "已归档" })[status] || status || "未登记";
}

function platformSupportLabel(status) {
  return ({ verified: "已验证", planned: "下一阶段", unverified: "未验证", unsupported: "不支持" })[status] || "未声明";
}

function normalizeRuntimeRecipe(recipe = {}) {
  const normalized = {};
  styleCategories.forEach((category) => {
    const rows = recipe?.[category.id];
    if (Array.isArray(rows) && rows.length) normalized[category.id] = rows;
  });
  return normalized;
}

function normalizeRuntimePages(styleId, pages = []) {
  const input = Array.isArray(pages) && pages.length ? pages : [];
  const normalized = input.map((page, index) => {
    const sectionComponents = Array.isArray(page.sections)
      ? page.sections
          .map((section) => section?.component)
          .filter((component) => typeof component === "string" && component.trim())
      : [];
    return {
      ...page,
      id: page.id || `${styleId}-${index === 0 ? "home" : `page-${index + 1}`}`,
      side: page.side || (index === 0 ? "distribution" : index === input.length - 1 ? "publish" : "display"),
      tab: page.tab || page.name || "页面",
      name: page.name || page.tab || "页面",
      description: page.description || "标准 demo 预览页：用真实页面结构承接风格能力，不等同业务项目临时 preview。",
      kind: page.kind,
      layoutRecipe: page.layoutRecipe || "",
      shell: page.shell && typeof page.shell === "object" ? page.shell : {},
      sections: Array.isArray(page.sections) ? page.sections : [],
      components: Array.isArray(page.components) && page.components.length ? page.components : [...new Set(sectionComponents)],
    };
  });
  if (normalized.length) return normalized;
  return [
    { id: `${styleId}-home`, side: "distribution", tab: "首页", name: "首页", description: "官网/品牌首页预览：检查首屏、分发入口和主行动。", components: ["NavigationBar", "HeroHeader", "Grid", "Tabs", "Feed", "Button"] },
    { id: `${styleId}-news`, side: "distribution", tab: "资讯公告", name: "资讯公告", description: "资讯/活动列表预览：检查 Tabs、列表、标签和 CTA。", components: ["NavigationBar", "Swiper", "Tabs", "Card", "Tag", "Button"] },
    { id: `${styleId}-media`, side: "display", tab: "影像资料", name: "影像资料", description: "媒体展示预览：检查 Image、Swiper、资产层和展示框体。", components: ["NavigationBar", "Image", "Swiper", "Card", "Tag"] },
    { id: `${styleId}-detail`, side: "display", tab: "详情页", name: "详情页", description: "对象详情预览：检查图片、属性、指标、列表和底部操作。", components: ["NavigationBar", "Image", "Avatar", "List", "PriceStatistic", "BottomBar"] },
    { id: `${styleId}-publish`, side: "publish", tab: "发布侧", name: "发布侧", description: "发布表单预览：检查 Input、Textarea、Upload、Select、Switch 和 BottomBar。", components: ["NavigationBar", "Input", "Textarea", "Upload", "Select", "Switch", "Button", "BottomBar"] },
  ];
}

onMounted(async () => {
  await loadRuntimeBrandPreviews();
  applyRouteFromLocation();
  const response = await fetch("/data/dangoui.design-system.json");
  catalog.value = await response.json();
  await nextTick();
  updateMockupScale();
  if (typeof ResizeObserver !== "undefined" && phoneRef.value) {
    phoneResizeObserver = new ResizeObserver(updateMockupScale);
    phoneResizeObserver.observe(phoneRef.value);
  } else {
    window.addEventListener("resize", updateMockupScale);
  }
  syncMockupHoverLabels();
  syncMockupPopupBounds();
  document.addEventListener("mouseover", prepareMockupPopupHoverLabel);
  document.addEventListener("mouseout", clearMockupPopupHoverLabel);
  window.addEventListener("hashchange", applyRouteFromLocation);
});

onBeforeUnmount(() => {
  phoneResizeObserver?.disconnect?.();
  phoneResizeObserver = null;
  window.removeEventListener("resize", updateMockupScale);
  document.removeEventListener("mouseover", prepareMockupPopupHoverLabel);
  document.removeEventListener("mouseout", clearMockupPopupHoverLabel);
  window.removeEventListener("hashchange", applyRouteFromLocation);
});

watch([selectedTemplateId, selectedInspectorTab, selectedStyleId, selectedStyleCategoryId, selectedComponent], () => {
  syncRouteToLocation();
  nextTick(syncMockupHoverLabels);
});

watch([selectedStyleId, selectedTemplateId], restorePhoneScreenScroll);
</script>
