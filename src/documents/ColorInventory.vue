<template>
<div class="color-hierarchy-panel" aria-label="DangoUI color token hierarchy">
                            <div class="color-hierarchy-grid">
                              <div
                                v-for="group in rows"
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
                                        :style="{ '--swatch-color': step.swatch, backgroundColor: step.swatch, color: step.textColor }"
                                        @click.stop="$emit('copy', step.value)"
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
                                        @click.stop="$emit('copy', mapping.value)"
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
                                            @click.stop="$emit('copy', mapping.hexValue)"
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
                                        @click.stop="$emit('copy', mapping.hexValue)"
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
</template>
<script setup>
import { readableTextColor } from './color-model.mjs';
defineProps({ rows: { type: Array, required: true }, copiedColorValue: { type: String, default: '' } });
defineEmits(['copy']);
</script>
