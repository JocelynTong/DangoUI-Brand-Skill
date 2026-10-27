import { defineComponent, h, ref } from 'vue';
import { DuButton, DuForm, DuFormItem, DuInput, DuNavigationBar } from 'dangoui';
import './linjie-theme.css';

export const trialMetadata = Object.freeze({
  brand: 'linjie', packageVersion: '0.1.0-trial.1', dangouiVersion: '3.6.16',
  runtime: 'browser-dom', framework: 'vue3', status: 'candidate-awaiting-independent-qa',
  productionCertified: false,
  states: ['button-default', 'button-loading', 'button-disabled', 'input-edit', 'input-clear', 'input-disabled', 'local-submit', 'cancel-reset'],
  unsupported: ['mini-program runtime', 'native app runtime', 'backend submission', 'navigation routing', 'FormItem native error API', 'Input read-only API', 'all Figma variants'],
});

// This demonstration intentionally owns no requests, navigation or business data.
// Integrators reuse the source components, passing their existing values/events.
export const LinjieCoreTrial = defineComponent({
  name: 'LinjieCoreTrial',
  props: { theme: { type: String, default: 'light', validator: v => ['light', 'dark'].includes(v) } },
  setup(props) {
    const initial = '一次真实的组件映射';
    const title = ref(initial);
    const feedback = ref('尚未提交 · 仅本地交互，不发送请求');
    const count = ref(0);
    const submit = () => {
      if (!title.value.trim()) { feedback.value = '请输入标题后再提交'; return; }
      count.value += 1;
      feedback.value = `本地提交 ${count.value} 次：${title.value}`;
    };
    const reset = () => { title.value = initial; count.value = 0; feedback.value = '已取消并恢复初始内容'; };
    return () => h('section', {
      class: 'linjie-trial-theme', 'data-theme': props.theme, 'data-testid': 'linjie-core-trial',
      // DangoUI 3.6.16 expects uni-style detail.value for empty native input.
      // Supply that event field locally; the real DuInput still owns its emitter.
      onInputCapture: event => {
        if (event.target?.tagName === 'INPUT' && event.target.value === '' && (typeof event.detail !== 'object' || event.detail === null)) {
          Object.defineProperty(event, 'detail', { value: { value: '' }, configurable: true });
        }
      },
      'aria-label': `临界 ${props.theme === 'dark' ? '暗色' : '浅色'}真实组件试用`,
    }, [
      h('p', { class: 'linjie-trial-kicker' }, `${props.theme.toUpperCase()} · DANGOUI ${trialMetadata.dangouiVersion}`),
      h(DuNavigationBar, { fixed: false, back: false, center: true, alwaysShowContent: true, color: 'var(--du-bg-1)', 'data-testid': 'navigation' }, {
        default: () => '创建投票',
        left: () => h(DuButton, { type: 'text', size: 'small', text: '返回', onClick: () => { feedback.value = '返回事件已触发 · 演示页不跳转'; }, 'data-testid': 'back' }),
      }),
      h('div', { class: 'linjie-trial-body' }, [
        h('p', { class: 'linjie-trial-note' }, '组件运行样例；临界视觉规则仍须按来源对照验收。'),
        h(DuForm, { layout: 'vertical', 'data-testid': 'form' }, { default: () => [
          h(DuFormItem, { label: '投票标题', required: true, tips: '最多 20 字；编辑后点击提交', layout: 'vertical', 'data-testid': 'form-item' }, { default: () => h(DuInput, {
            value: title.value, maxlength: 20, placeholder: '输入投票标题', allowClear: false,
            'aria-label': '投票标题', 'data-testid': 'title-input', onInput: value => { title.value = value; },
          }) }),
          h(DuButton, { type: 'text', size: 'small', text: '清空标题', onClick: () => { title.value = ''; feedback.value = '已清空；提交将显示本地校验提示'; }, 'data-testid': 'clear' }),
          h(DuFormItem, { label: '禁用输入', tips: 'disabled 展示；不代表 Figma Read Only 已实现', layout: 'vertical', 'data-testid': 'disabled-form-item' }, { default: () => h(DuInput, {
            value: '已锁定内容', disabled: true, allowClear: false, 'aria-label': '禁用输入', 'data-testid': 'disabled-input',
          }) }),
        ] }),
        h('div', { class: 'linjie-trial-actions' }, [
          h(DuButton, { type: 'outline', size: 'large', text: '取消', onClick: reset, 'data-testid': 'cancel' }),
          h(DuButton, { type: 'primary', size: 'large', text: '提交', onClick: submit, 'data-testid': 'submit' }),
        ]),
        h('output', { class: 'linjie-trial-feedback', 'aria-live': 'polite', 'data-testid': 'feedback' }, feedback.value),
        h('p', { class: 'linjie-trial-state-label' }, '状态样例 · 点击不应增加提交次数'),
        h('div', { class: 'linjie-trial-actions' }, [
          h(DuButton, { type: 'primary', size: 'large', loading: true, text: '加载中', onClick: submit, 'aria-disabled': 'true', 'data-testid': 'loading-button' }),
          h(DuButton, { type: 'primary', size: 'large', disabled: true, disabledType: 'temp', text: '已禁用', onClick: submit, 'aria-disabled': 'true', 'data-testid': 'disabled-button' }),
        ]),
        h('p', { class: 'linjie-trial-note' }, '清空采用 DuButton 兼容鼠标与触摸；未宣称验证 DuInput 的触摸清除图标。'),
      ]),
    ]);
  },
});
