import { createApp, defineComponent, h } from 'vue'
import 'dangoui/style.css'
import '../../src/dangoui-theme.local.css'
import './preview.css'
import './keyframes.css'
import App from './App.vue'

const app = createApp(App)
app.component('scroll-view', defineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => h('div', attrs, slots.default?.()) } }))
app.mount('#app')
