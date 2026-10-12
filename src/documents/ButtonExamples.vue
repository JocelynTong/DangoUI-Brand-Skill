<template>
<div class="button-examples">
                        <section class="style-button-showcase">
                          <header>
                            <strong>不同场景下的按钮</strong>
                            <span>突出主要操作，弱化次要操作；以下保留组件原始配色。</span>
                          </header>
                          <div class="style-button-demo-group">
                            <strong>操作层级</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="主要按钮" type="primary" />
                              <DuButton text="柔和按钮" type="secondary" />
                              <DuButton text="描边按钮" type="outline" />
                              <DuButton text="文字按钮" type="text" />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>尺寸</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="mini" size="mini" />
                              <DuButton text="small" size="small" />
                              <DuButton text="normal" size="normal" />
                              <DuButton text="medium" size="medium" />
                              <DuButton text="large" size="large" />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>图标与方向提示</strong>
                            <div class="style-button-demo-row">
                              <DuButton text="发布" type="primary" :icon="iconPlusHeavy" icon-size="16px" icon-position="left" />
                              <DuButton text="继续" type="outline" arrow-right />
                              <DuIconButton :icon="iconCamera" size="large" />
                              <DuActionButton :name="iconRefresh" />
                            </div>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>不可用与处理中</strong>
                            <fieldset class="style-button-demo-row" disabled aria-label="禁用与加载状态示例" style="border:0;margin:0;min-width:0">
                              <DuButton text="禁用" type="primary" disabled />
                              <DuButton text="临时禁用" type="outline" disabled disabled-type="temp" />
                              <DuButton text="加载中" type="primary" loading />
                            </fieldset>
                          </div>
                          <div class="style-button-demo-group">
                            <strong>通栏操作</strong>
                            <div class="style-button-demo-row"><DuButton text="通栏主按钮" type="primary" full /></div>
                          </div>
                        </section>
<details class="document-disclosure"><summary>查看代码与开发说明</summary>
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
</details>
</div>
</template>
<script setup>
import { DuButton, DuIconButton, DuActionButton } from 'dangoui';
import { iconPlusHeavy, iconCamera, iconRefresh } from 'dangoui-icon-config';
</script>
