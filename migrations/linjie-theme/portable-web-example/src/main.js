import {createApp,h} from 'vue';
import 'dangoui/theme.css';
import 'dangoui/style.css';
import {LinjieCoreTrial} from '../migrations/linjie-theme/runtime/linjie-components.mjs';
import './preview.css';
createApp({render:()=>h('main',[
 h('h1','临界 · 独立 Web 品牌包试用'),
 h('p','消费公开安装产物 · Vue Web / DangoUI 3.6.16 · 局部试用，未认证完整临界品牌或小程序接入'),
 h('div',{class:'previews'},['light','dark'].map(theme=>h('section',{'data-preview-theme':theme},[h('h2',theme==='light'?'Light 浅色':'Dark 暗色'),h(LinjieCoreTrial,{theme})])))
])}).mount('#app');
