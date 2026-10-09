import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { ensureExtractorRuntime } from "./ensure-extractor-runtime.mjs";

export async function resolveBrowserRuntime({ runtimeRoot = process.env.BRAND_RUNTIME_ROOT || "", workspaceRoot = process.cwd(), skillUrl = import.meta.url, artifactRoot = "" } = {}) {
  const anchors = [...new Set([
    ...(runtimeRoot ? [path.join(path.resolve(runtimeRoot), "package.json")] : []),
    skillUrl,
    path.join(path.resolve(workspaceRoot), "package.json"),
  ])];
  const failures = [];
  for (const anchor of anchors) {
    const require = createRequire(anchor);
    for (const dependency of ["playwright-core", "dembrandt"]) {
      try {
        // Reuse installed dependencies; Dembrandt may own nested Playwright.
        const modulePath = dependency === "playwright-core"
          ? require.resolve("playwright-core")
          : createRequire(require.resolve("dembrandt")).resolve("playwright-core");
        const loaded = await import(pathToFileURL(modulePath).href);
        const chromium = loaded.chromium || loaded.default?.chromium;
        if (!chromium?.launch) throw new Error("Resolved package has no chromium launch API");
        return { chromium, modulePath, provenance: { anchor: String(anchor), dependency } };
      } catch (error) { failures.push({ anchor: String(anchor), dependency, code: error.code || "RUNTIME_LOAD_FAILED" }); }
    }
  }
  if (artifactRoot) {
    const runtime = ensureExtractorRuntime({ artifactRoot, skillUrl });
    const loaded = await import(pathToFileURL(runtime.browserModulePath).href);
    const chromium = loaded.chromium || loaded.default?.chromium;
    if (!chromium?.launch) throw new Error("Resolved package has no chromium launch API");
    return { chromium, modulePath: runtime.browserModulePath, provenance: { anchor: path.join(runtime.runtimeRoot, "package.json"), dependency: "playwright-core", bootstrapped: runtime.bootstrapped } };
  }
  throw Object.assign(new Error("The declared skill/workspace runtime must provide playwright-core (directly or through installed dembrandt); no dependency or browser installation was attempted."), { code: "BROWSER_RUNTIME_UNAVAILABLE", failures });
}
