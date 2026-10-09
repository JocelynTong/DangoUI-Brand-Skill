import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const INLINE_SVG_LIMITS = Object.freeze({ maxAssets: 16, maxAssetBytes: 1024 * 1024, maxTotalBytes: 8 * 1024 * 1024, maxNodes: 20000 });

// Executed in the source page, not against reconstructed or previously saved DOM.
export function observeVisibleInlineSvgs({ remainingAssets = 16, maxAssetBytes = 1024 * 1024, maxNodes = 20000, excludedSelectors = [], remainingTotalBytes = 8 * 1024 * 1024 } = {}) {
  const visibilityFor = window.__brandEffectiveVisibility;
  if (typeof visibilityFor !== "function") throw new Error("INLINE_SVG_VISIBILITY_OBSERVER_REQUIRED");
  const selectorFor = element => {
    const parts = [];
    for (let current = element; current; current = current.parentElement) {
      const tag = current.tagName.toLowerCase();
      if (current.id && document.querySelectorAll(`#${CSS.escape(current.id)}`).length === 1) { parts.unshift(`${tag}#${CSS.escape(current.id)}`); break; }
      const siblings = current.parentElement ? [...current.parentElement.children].filter(item => item.tagName === current.tagName) : [current];
      parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
    }
    return parts.join(" > ");
  };
  const rectFor = rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    const properties = ["color", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "clip-path", "clip-rule", "mask", "filter", "opacity", "display", "visibility", "transform", "transform-origin", "transform-box", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "dominant-baseline", "stop-color", "stop-opacity", "paint-order", "vector-effect", "mix-blend-mode", "d", "width", "height"];
  const items = [], skipped = [];
  let visibleCandidates = 0, previouslyCapturedCount = 0, candidateBytes = 0;
  const excluded = new Set(excludedSelectors);
  const candidates = [...document.querySelectorAll("svg")];
  for (const svg of candidates.slice(0, 10000)) {
    if (svg.parentElement?.closest("svg")) continue;
    const visibility = visibilityFor(svg);
    if (!visibility.visible || visibility.effectiveRect.width < 24 || visibility.effectiveRect.height < 24) continue;
    visibleCandidates += 1;
    const selector = selectorFor(svg);
    if (excluded.has(selector)) { previouslyCapturedCount += 1; continue; }
    if (items.length >= Math.min(16, remainingAssets)) continue;
    const descendants = [...svg.querySelectorAll("*")];
    if (descendants.length + 1 > maxNodes) { skipped.push({ selector, reason: "SVG_NODE_LIMIT", nodeCount: descendants.length + 1 }); continue; }
    const original = new XMLSerializer().serializeToString(svg);
    const originalBytes = new TextEncoder().encode(original).byteLength;
    if (originalBytes > maxAssetBytes) { skipped.push({ selector, reason: "SVG_ASSET_BYTE_LIMIT", bytes: originalBytes }); continue; }
    const nodes = [svg, ...descendants];
    const clone = nodes.length <= 2048 ? svg.cloneNode(true) : null;
    const copies = clone ? [clone, ...clone.querySelectorAll("*")] : [];
    let observationOmittedReason = clone ? null : "COMPUTED_OBSERVATION_NODE_BUDGET";
    const dependencies = [], unresolved = new Set();
    // This is a deliberately narrow property observation, not proof that all
    // page styles, ancestors, pseudo-elements and fonts have been embedded.
    unresolved.add("PAGE_CSS_DEPENDENCY_CLOSURE_UNVERIFIED");
    const ids = new Set(nodes.map(node => node.id).filter(Boolean));
    const seen = new Set();
    const inspectReference = (raw, kind) => {
      if (!raw || seen.has(`${kind}:${raw}`)) return;
      seen.add(`${kind}:${raw}`);
      if (dependencies.length >= 256) { unresolved.add("REFERENCE_LIMIT"); return; }
      if (/^data:/i.test(raw)) { dependencies.push({ kind, status: "embedded-data", byteLength: new TextEncoder().encode(raw).byteLength }); return; }
      let url;
      try { url = new URL(raw, document.baseURI); } catch { unresolved.add("INVALID_REFERENCE"); return; }
      const sameDocument = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;
      if (raw.startsWith("#") || sameDocument && url.hash) {
        let id;
        try { id = decodeURIComponent(url.hash.slice(1)); } catch { unresolved.add("INVALID_FRAGMENT_REFERENCE"); return; }
        const status = ids.has(id) ? "contained" : document.getElementById(id) ? "page-local-outside-svg" : "missing";
        dependencies.push({ kind, url: url.href, fragmentId: id, status });
        if (status !== "contained") unresolved.add(status === "missing" ? "MISSING_LOCAL_REFERENCE" : "PAGE_LOCAL_DEFS_NOT_CONTAINED");
      } else {
        dependencies.push({ kind, url: url.href, status: "external-unbound" });
        unresolved.add("EXTERNAL_DEPENDENCY_UNBOUND");
      }
    };
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index], copy = copies[index], style = copy ? getComputedStyle(node) : null;
      for (const attribute of node.attributes) {
        if (["href", "xlink:href"].includes(attribute.name)) inspectReference(attribute.value, "dom-href");
        for (const match of attribute.value.matchAll(/url\(\s*["']?(.*?)["']?\s*\)/g)) inspectReference(match[1], `attribute:${attribute.name}`);
      }
      for (const property of properties) {
        if (!copy) break;
        const value = style.getPropertyValue(property);
        if (!value) continue;
        copy.style.setProperty(property, value, "important");
        for (const match of value.matchAll(/url\(\s*["']?(.*?)["']?\s*\)/g)) inspectReference(match[1], `computed:${property}`);
      }
      // This derivative records observed CSS values; it is not a source original.
      copy?.style.setProperty("animation", "none", "important");
      copy?.style.setProperty("transition", "none", "important");
    }
    if (svg.querySelector("text,textPath")) unresolved.add("FONT_DEPENDENCIES_NOT_EMBEDDED");
    if (svg.querySelector("foreignObject")) unresolved.add("FOREIGN_OBJECT_DEPENDENCIES_UNRESOLVED");
    if (svg.querySelector("animate,animateTransform,animateMotion,set")) unresolved.add("SMIL_ANIMATED_ATTRIBUTES_UNRESOLVED");
    if (svg.querySelector("script") || nodes.some(node => [...node.attributes].some(attribute => /^on/i.test(attribute.name)))) unresolved.add("ACTIVE_CONTENT_PRESENT");
    let observation = clone ? new XMLSerializer().serializeToString(clone) : null;
    if (observation && new TextEncoder().encode(observation).byteLength > maxAssetBytes) { observation = null; observationOmittedReason = "COMPUTED_OBSERVATION_BYTE_BUDGET"; }
    const section = svg.closest("section,article,header,footer,[role='region']") || (() => {
      for (let parent = svg.parentElement; parent && parent !== document.body; parent = parent.parentElement) if (parent.querySelector("h1,h2,h3,h4,h5,h6") && parent.getBoundingClientRect().width >= innerWidth * .25) return parent;
      return svg.closest("main > *,body > *") || document.body;
    })();
    const item = { original, observation, observationOmittedReason, sourceUrl: location.href, selector, sectionSelector: selectorFor(section), viewBox: svg.getAttribute("viewBox"), widthAttribute: svg.getAttribute("width"), heightAttribute: svg.getAttribute("height"),
      boundingBox: rectFor(svg.getBoundingClientRect()), effectiveRect: visibility.effectiveRect, scroll: { x: scrollX, y: scrollY }, viewport: { width: innerWidth, height: innerHeight },
      observedAt: new Date().toISOString(), performanceTimeMs: performance.now(), dependencies, unresolvedReasons: [...unresolved],
      selfContained: unresolved.size === 0, computedStyleProperties: properties, nodeCount: nodes.length };
    let bytes = originalBytes + new TextEncoder().encode(observation || "").byteLength;
    if (candidateBytes + bytes > remainingTotalBytes && observation) { item.observation = null; item.observationOmittedReason = "COMPUTED_OBSERVATION_TOTAL_BUDGET"; bytes = originalBytes; }
    if (candidateBytes + bytes > remainingTotalBytes) { skipped.push({ selector, reason: "SVG_TOTAL_BYTE_LIMIT", bytes }); continue; }
    items.push(item); candidateBytes += bytes;
  }
  return { items, skipped: skipped.slice(0, 32), visibleCandidates, previouslyCapturedCount, truncated: candidates.length > 10000 || visibleCandidates > items.length + skipped.length + previouslyCapturedCount };
}

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

// One recorder per collection round shares the limits across all viewport frames.
export function createInlineSvgEvidenceArchive({ outputDir, limits = {} } = {}) {
  const budget = Object.fromEntries(Object.entries(INLINE_SVG_LIMITS).map(([key, cap]) => [key, Math.max(0, Math.min(cap, limits[key] ?? cap))]));
  fs.mkdirSync(outputDir, { recursive: true });
  const directory = fs.mkdtempSync(path.join(path.resolve(outputDir), "inline-svg-evidence-"));
  const assets = [], skipped = [];
  let totalBytes = 0;
  return {
    directory,
    async capture(page, { frameIndex = null, screenshotPath = null } = {}) {
      const observed = await page.evaluate(observeVisibleInlineSvgs, { remainingAssets: budget.maxAssets - assets.length, maxAssetBytes: budget.maxAssetBytes, maxNodes: budget.maxNodes, excludedSelectors: assets.map(item => item.selector), remainingTotalBytes: budget.maxTotalBytes - totalBytes });
      const placements = [];
      skipped.push(...observed.skipped.map(item => ({ ...item, frameIndex })));
      for (const item of observed.items) {
        const { original, observation: observedCopy, ...facts } = item;
        let observation = observedCopy;
        const sourceSha256 = sha256(original), observationSha256 = observation ? sha256(observation) : null;
        const metadata = { schema: "inline-svg-rendered-evidence/v1", ...facts, frameIndex, screenshotPath, sourceSha256, observationSha256,
          temporalScope: "first-observed-animation-frame-for-selector-only", completeAnimation: false, originalKind: "unmodified-dom-serialization", observationKind: "computed-style-derivative-not-original",
          approvedRuntimeAsset: false, identityPurpose: "unassigned", specs: { intrinsicPixelSize: null, alphaChannel: "unknown", transparency: "unknown", maxSafeDisplaySize: null },
          boundary: "Source composition and current DOM/CSS observation only. SVG viewBox is a coordinate extent, not a pixel display limit; no runtime or identity approval." };
        let metadataText = JSON.stringify(metadata, null, 2) + "\n";
        let bytes = Buffer.byteLength(original) + Buffer.byteLength(observation || "") + Buffer.byteLength(metadataText);
        if (observation && totalBytes + bytes > budget.maxTotalBytes) {
          observation = null;
          metadata.observationSha256 = null;
          metadata.observationOmittedReason = "COMPUTED_OBSERVATION_TOTAL_BUDGET";
          metadataText = JSON.stringify(metadata, null, 2) + "\n";
          bytes = Buffer.byteLength(original) + Buffer.byteLength(metadataText);
        }
        const reason = assets.length >= budget.maxAssets ? "SVG_ASSET_COUNT_LIMIT" : Buffer.byteLength(original) > budget.maxAssetBytes ? "SVG_ASSET_BYTE_LIMIT" : totalBytes + bytes > budget.maxTotalBytes ? "SVG_TOTAL_BYTE_LIMIT" : "";
        if (reason) { skipped.push({ frameIndex, selector: facts.selector, reason, bytes }); continue; }
        const assetDir = path.join(directory, String(assets.length).padStart(2, "0"));
        fs.mkdirSync(assetDir);
        const originalPath = path.join(assetDir, "original.svg"), observationPath = observation ? path.join(assetDir, "computed-observation.svg") : null, metadataPath = path.join(assetDir, "observation.json");
        fs.writeFileSync(originalPath, original, { flag: "wx" });
        if (observation) fs.writeFileSync(observationPath, observation, { flag: "wx" });
        fs.writeFileSync(metadataPath, metadataText, { flag: "wx" });
        const bindingSha256 = sha256(metadataText);
        const receipt = { ...metadata, originalPath, observationPath, metadataPath, bindingSha256, bytes, status: facts.selfContained ? "observed-source-contained" : "unresolved" };
        assets.push(receipt); placements.push(receipt); totalBytes += bytes;
      }
      return { placements, truncated: observed.truncated, visibleCandidates: observed.visibleCandidates, previouslyCapturedCount: observed.previouslyCapturedCount };
    },
    summary() { return { schema: "inline-svg-evidence-archive/v1", directory, limits: budget, firstFramePerSelectorOnly: true, assetCount: assets.length, totalBytes, assets: [...assets], skipped: skipped.slice(0, 64) }; },
  };
}
