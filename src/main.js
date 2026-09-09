import { createApp, defineComponent, h } from "vue";
import "./dangoui-theme.local.css";
import "dangoui/style.css";
import "./styles.css";
import App from "./App.vue";

const app = createApp(App);

// dangoui@3.6.16 is a cross-platform package. Its precompiled web bundle keeps
// the mini-program `scroll-view` component in Tabs, so Vue cannot apply this
// project's SFC compilerOptions to that already-compiled dependency. Register
// the web semantic equivalent explicitly: a normal scrolling container whose
// layout/overflow remains owned by DangoUI's `.du-tabs__scroll` CSS.
app.component(
  "scroll-view",
  defineComponent({
    name: "DangoWebScrollView",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h("div", attrs, slots.default?.());
    },
  }),
);

app.mount("#app");
