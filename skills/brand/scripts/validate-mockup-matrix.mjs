#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const root = path.resolve(opt("--root", process.cwd()));
const brand = opt("--brand");
const input = opt("--file", brand ? path.join(root, "migrations", brand, "mockup-state-matrix.json") : "");
const strict = args.includes("--strict");

if (!input) exitFail("Provide --file or --brand.");
if (!fs.existsSync(input)) exitFail(`Mockup matrix not found: ${input}`);

let report;
try { report = JSON.parse(fs.readFileSync(input, "utf8")); }
catch (error) { exitFail(`Invalid JSON: ${error.message}`); }

const pageTypes = ["brand", "style", "component"];
const bottomStates = ["tabbar", "no-tabbar"];
const modes = ["normal", "proof=1", "proof=desktop", "proof=mobile"];
const observations = Array.isArray(report.observations) ? report.observations : [];
const blocking = [];
const warnings = [];
const keyOf = (item) => `${item.pageType}|${item.bottomChrome}|${item.mode}`;
const byKey = new Map(observations.map((item) => [keyOf(item), item]));
const block = (code, key, message) => blocking.push({ code, key, message });

for (const pageType of pageTypes) {
  for (const bottomChrome of bottomStates) {
    for (const mode of modes) {
      const key = `${pageType}|${bottomChrome}|${mode}`;
      const item = byKey.get(key);
      if (!item) {
        block("MOCKUP_MATRIX_CASE_MISSING", key, "Required page/chrome/proof state was not observed.");
        continue;
      }
      if (!item.viewport || !Number(item.viewport.width) || !Number(item.viewport.height)) {
        block("MOCKUP_VIEWPORT_MISSING", key, "Observation must freeze viewport width and height.");
      }
      if (mode !== "normal") {
        if (item.indicator?.hidden !== true) block("MOCKUP_PROOF_INDICATOR_VISIBLE", key, "Proof mode must hide the home indicator.");
        continue;
      }
      if (item.indicator?.hidden === true) block("MOCKUP_INDICATOR_MISSING", key, "Normal mode must render the home indicator.");
      if (item.indicator?.parentRole !== "phone") block("MOCKUP_INDICATOR_PARENT", key, "Indicator must be a direct phone-shell system layer.");
      if (!['absolute', 'fixed'].includes(item.indicator?.position)) block("MOCKUP_INDICATOR_POSITION", key, "Indicator must not participate in content flow.");
      if (bottomChrome === "tabbar" && item.indicator?.backgroundSemantics !== "matches-tabbar") {
        block("MOCKUP_INDICATOR_TABBAR_SURFACE", key, "With a TabBar, indicator surface must continue the TabBar background.");
      }
      if (bottomChrome === "no-tabbar" && item.indicator?.backgroundSemantics !== "transparent") {
        block("MOCKUP_INDICATOR_STANDALONE_SURFACE", key, "Without a TabBar, indicator must be transparent and not form a footer.");
      }
      if (item.geometry?.screenWidthAligned !== true) block("MOCKUP_SCREEN_WIDTH_MISALIGNED", key, "Phone and screen widths are not aligned.");
      if (item.geometry?.screenRadiusAligned !== true) block("MOCKUP_SCREEN_RADIUS_MISALIGNED", key, "Screen bottom radius does not follow the phone shell radius.");
      if (item.geometry?.bottomChromeRadiusAligned !== true) block("MOCKUP_BOTTOM_RADIUS_MISALIGNED", key, "Bottom chrome corners do not align with the clipped mockup corners.");
      const scroll = item.scroll || {};
      if (!(Number(scroll.scrollHeight) > Number(scroll.clientHeight))) block("PAGE_NOT_SCROLLABLE", key, "Normal mockup observation must exercise a scrollable fixture.");
      if (!(Number(scroll.afterScrollTop) > Number(scroll.beforeScrollTop))) block("PAGE_SCROLL_UNCHANGED", key, "Scroll probe did not move the screen.");
      if (Number(scroll.restoredScrollTop) !== Number(scroll.beforeScrollTop)) block("PAGE_SCROLL_NOT_RESTORED", key, "Scroll probe was not restored.");
      if (Number(scroll.indicatorRectDeltaPx) > 1) block("MOCKUP_INDICATOR_SCROLL_DRIFT", key, "Indicator moved with page content.");
    }
  }
}

for (const item of observations) {
  if (!pageTypes.includes(item.pageType) || !bottomStates.includes(item.bottomChrome) || !modes.includes(item.mode)) {
    warnings.push({ code: "MOCKUP_MATRIX_UNKNOWN_CASE", key: keyOf(item) });
  }
}

const result = {
  ok: blocking.length === 0,
  type: "mockup-state-matrix-gate",
  contractVersion: 1,
  input: path.resolve(input),
  expectedCases: pageTypes.length * bottomStates.length * modes.length,
  observedCases: observations.length,
  blocking,
  warnings,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(blocking.length ? (strict ? 2 : 3) : 0);

function exitFail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
