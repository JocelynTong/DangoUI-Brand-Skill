// Browser-side bounded sampling. Geometry/CSS visibility is not paint-occlusion
// certification; screenshots remain authoritative. Never invent text for images.
export function installRenderedSurfaceSampler() {
  window.__brandRenderedSurface = () => {
    const box = (rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    const selectorFor = (element) => {
      const parts = [];
      for (let current = element; current; current = current.parentElement) {
        const tag = current.tagName.toLowerCase();
        if (current.id) { parts.unshift(`${tag}#${CSS.escape(current.id)}`); break; }
        const siblings = current.parentElement ? [...current.parentElement.children].filter(item => item.tagName === current.tagName) : [current];
        parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
      }
      return parts.join(" > ");
    };
    const observedSections = new Set();
    const sectionFor = (element) => {
      let section = element.closest("section,article,header,footer,[role='region']");
      if (!section) for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.querySelector("h1,h2,h3,h4,h5,h6") && parent.getBoundingClientRect().width >= innerWidth * .25) { section = parent; break; }
      }
      section ||= element.closest("main > *,body > *") || document.body;
      observedSections.add(section);
      return section;
    };
    const computedFor = (element) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(["display", "position", "color", "backgroundColor", "backgroundImage", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "borderRadius", "borderColor", "borderWidth", "boxShadow", "padding", "gap", "gridTemplateColumns", "alignItems", "justifyContent", "opacity", "transform", "fill", "stroke"].map(key => [key, style[key]]));
    };
    const samples = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let visited = 0;
    let node;
    while ((node = walker.nextNode()) && visited++ < 10000 && samples.length < 96) {
      const parent = node.parentElement;
      const text = (node.nodeValue || "").replace(/\s+/g, " ").trim();
      if (!parent || !text || parent.closest("script,style,noscript,template")) continue;
      const visibility = window.__brandEffectiveVisibility(parent);
      if (!visibility.visible) continue;
      const colour = getComputedStyle(parent).color;
      if (colour === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(colour)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const clip = visibility.effectiveRect;
      const rects = [...range.getClientRects()].filter((rect) =>
        rect.width > 0 && rect.height > 0 && rect.right > clip.x &&
        rect.left < clip.x + clip.width && rect.bottom > clip.y && rect.top < clip.y + clip.height);
      if (!rects.length) continue;
      const rect = range.getBoundingClientRect();
      const selector = selectorFor(parent);
      const key = `${selector}:${text}:${rect.x}:${rect.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      samples.push({ text, selector, visible: true, boundingBox: box(rect), sectionSelector: selectorFor(sectionFor(parent)), computedStyle: computedFor(parent) });
    }
    const visible = (element) => {
      const result = window.__brandEffectiveVisibility(element);
      return result.visible && result.effectiveRect.width >= 24 && result.effectiveRect.height >= 24;
    };
    const mediaCandidates = [...document.querySelectorAll("img,video,canvas,svg")];
    const media = mediaCandidates.slice(0, 10000).filter(visible);
    // Include document/body backgrounds, not just descendants of body. A plain
    // background colour is not media. Limit traversal without fabricating counts.
    const backgrounds = [...document.querySelectorAll("html,body,body *")].slice(0, 10000)
      .filter((element) => visible(element) && getComputedStyle(element).backgroundImage !== "none").slice(0, 40);
    const mediaNodes = [...new Set([...media, ...backgrounds])];
    const visibleMediaSamples = mediaNodes.slice(0, 48).map(element => {
      const tag = element.tagName.toLowerCase();
      const visibility = window.__brandEffectiveVisibility(element);
      const sources = [];
      const addSource = (kind, rawUrl) => {
        if (!rawUrl) return;
        try { sources.push({ kind, url: new URL(rawUrl, document.baseURI).href }); } catch {}
      };
      if (tag === "img" || tag === "video") addSource("currentSrc", element.currentSrc || element.getAttribute("src"));
      if (tag === "video") addSource("poster", element.getAttribute("poster"));
      if (tag === "svg") for (const ref of [...element.querySelectorAll("image,use")].slice(0, 16)) addSource(ref.tagName.toLowerCase(), ref.getAttribute("href") || ref.getAttribute("xlink:href"));
      for (const match of [...getComputedStyle(element).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)].slice(0, 16)) addSource("css-background", match[1]);
      return { selector: selectorFor(element), tagName: tag, sectionSelector: selectorFor(sectionFor(element)), boundingBox: box(element.getBoundingClientRect()), effectiveRect: visibility.effectiveRect,
        computedStyle: computedFor(element), provenance: { sources, sourceReferencesTruncated: tag === "svg" && element.querySelectorAll("image,use").length > 16,
          ...(tag === "svg" ? { inlineSvg: true, viewBox: element.getAttribute("viewBox"), widthAttribute: element.getAttribute("width"), heightAttribute: element.getAttribute("height") } : {}),
          ...(tag === "img" ? { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, complete: element.complete } : {}) } };
    });
    const sectionCandidates = [...document.querySelectorAll("section,article,header,footer,[role='region'],main > *,body > *")];
    const sectionNodes = [...new Set([...observedSections, ...sectionCandidates.slice(0, 10000)].filter(visible)
      .filter(element => element.getBoundingClientRect().width >= innerWidth * .25))];
    const visibleSectionSamples = sectionNodes.slice(0, 32).map(element => ({ selector: selectorFor(element), tagName: element.tagName.toLowerCase(), boundingBox: box(element.getBoundingClientRect()),
      effectiveRect: window.__brandEffectiveVisibility(element).effectiveRect, computedStyle: computedFor(element) }));
    return { visibleTextSamples: samples, visualMediaCount: mediaNodes.length, visibleMediaSamples, visibleSectionSamples,
      surfaceSampling: { method: "visible-dom-geometry-computed-style", maxVisitedNodes: 10000, maxMediaSamples: 48, maxSectionSamples: 32,
        mediaTruncated: mediaCandidates.length > 10000 || mediaNodes.length > 48, sectionsTruncated: sectionCandidates.length > 10000 || sectionNodes.length > 32,
        boundary: "Rendered DOM facts and resource references only; no identity-purpose, asset approval or paint-occlusion certification." },
      textSampling: { method: "visible-text-nodes", maxVisitedNodes: 10000, maxSamples: 96,
        truncated: visited >= 10000 || samples.length >= 96 } };
  };
}
