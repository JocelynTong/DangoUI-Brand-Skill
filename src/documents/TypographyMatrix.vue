<template>
<div class="style-typography-matrix">
                        <section
                          v-for="group in typographyGroups"
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
</template>
<script setup>
import { typographyGroups } from './typography-model.mjs';
</script>
