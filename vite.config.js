import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const useLocalDangoui = process.env.DANGOUI_LOCAL === "1";
const localDangouiRoot = fileURLToPath(
  new URL("../dangoui-feat-update/packages/dangoui/", import.meta.url),
);

export default defineConfig({
  // DangoUI ships cross-platform Vue SFCs whose web build intentionally keeps
  // the mini-program `scroll-view` host element (for example Tabs.vue). Tell
  // Vue's SFC compiler that it is a platform custom element so it is rendered
  // by the browser instead of being resolved as an application component.
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "scroll-view",
        },
      },
    }),
  ],
  resolve: {
    alias: useLocalDangoui
      ? [
          { find: "dangoui/style.css", replacement: `${localDangouiRoot}dist/style.css` },
          { find: /^dangoui$/, replacement: `${localDangouiRoot}dist/index.mjs` },
        ]
      : [],
  },
  define: {
    __WEB__: true,
    __UNI_PLATFORM__: JSON.stringify("h5"),
  },
});
