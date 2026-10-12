export function parseHexColor(value) {
  const hex = String(value).trim().replace("#", "");
  if (!/^[0-9a-f]{3,8}$/i.test(hex)) return null;
  const normalized = hex.length === 3 || hex.length === 4
    ? hex.split("").map((char) => char + char).join("")
    : hex;
  const hasAlpha = normalized.length === 8;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
    a: hasAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1,
  };
}

export function formatHexColor(value) {
  const raw = String(value).trim();
  const match = raw.match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return raw;
  const hex = match[1];
  const normalized = hex.length === 3 || hex.length === 4
    ? hex.split("").map((char) => char + char).join("")
    : hex;
  return `#${normalized.toUpperCase()}`;
}

export function readableTextColor(value, opacity = 0.8) {
  const color = parseHexColor(value);
  if (!color) return "var(--style-text)";
  const r = color.r * color.a + 255 * (1 - color.a);
  const g = color.g * color.a + 255 * (1 - color.a);
  const b = color.b * color.a + 255 * (1 - color.a);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.48 ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
}

export function extractColorValues(value) {
  return Array.from(String(value).matchAll(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/gi), (match) => match[0]);
}


export function buildColorStructure(catalog, selectedStyle = { id: 'dango', label: 'DangoUI' }, selectedStyleTokenMap = {}) {
  const baseTokenMap = Object.fromEntries(catalog.tokens.map((token) => [token.name, token.value]));
  const overrideTokenMap = selectedStyle.id === "dango" ? {} : selectedStyleTokenMap;
  const tokenMap = {
    ...baseTokenMap,
    ...overrideTokenMap,
  };
  const overriddenTokenNames = new Set(Object.keys(overrideTokenMap));
  const firstColor = (value) => extractColorValues(value)[0] || "transparent";
  const dangoPrimitivePalettes = {
    neutral: ["#0000000a", "#00000014", "#0000001f", "#00000029", "#0000003d", "#00000066", "#000000a3", "#000000e0", "#000000"],
    white: ["#ffffff0a", "#ffffff14", "#ffffff1f", "#ffffff29", "#ffffff3d", "#ffffff66", "#ffffffa3", "#ffffffe0", "#ffffff"],
    purple: ["#f2f0ff", "#d9d2ff", "#c7b8ff", "#958dff", "#7c66ff", "#5c4cd9", "#4036b3", "#28238c", "#1a1866"],
    purplegray: ["#f7f7f9", "#ededf2", "#e1e1e5", "#d4d0da", "#bab5c4", "#918b9f", "#625e76", "#383950", "#2b263b"],
    red: ["#ffebe9", "#ffd1cf", "#ffabab", "#ff8380", "#f96464", "#d94a4e", "#b3343c", "#8c222c", "#661722"],
    orange: ["#fff0e6", "#ffdfca", "#ffc299", "#ffa15a", "#fc7e22", "#d65d11", "#b04105", "#8a2c00", "#631c00"],
    yellow: ["#fffde6", "#fff9ca", "#ffe885", "#fad728", "#edbf00", "#c79800", "#a17600", "#7a5600", "#543800"],
    tendershoots: ["#fbffe5", "#f4fec3", "#e4f689", "#cdee2b", "#b2d600", "#99b800", "#7f9900", "#667a00", "#4c5c00"],
    green: ["#e2f7e3", "#c9f2ca", "#9de09d", "#7ad37f", "#52ba5c", "#379e45", "#247842", "#145221", "#0f3d19"],
    turquoise: ["#e2f7f3", "#cdf9eb", "#9dedd9", "#77e5d2", "#36ccb6", "#17ad9b", "#14877e", "#076059", "#053b3a"],
    zimablue: ["#dff7f7", "#cbf7f7", "#9df2f4", "#62deef", "#28bee0", "#009bbf", "#087599", "#005273", "#00344d"],
    blue: ["#e4ebf9", "#cce0ff", "#a6caff", "#8fb7ff", "#6c9aff", "#5077d9", "#3957b3", "#263c8c", "#1b2866"],
    grape: ["#f1e6ff", "#ebd4ff", "#d6b3ff", "#b688ff", "#ad69f7", "#8a4fd1", "#6838ab", "#4a2585", "#32195e"],
  };
  const primitiveColorRefs = Object.entries(dangoPrimitivePalettes).flatMap(([family, values]) =>
    values.map((value, index) => ({
      ref: `${family}-${index + 1}`,
      family,
      step: index + 1,
      value: formatHexColor(value).toLowerCase(),
    })),
  );
  const primitiveRefForValue = (value) =>
    primitiveColorRefs.find((item) => item.value === formatHexColor(value).toLowerCase())?.ref || "";
  const rgbDistance = (a, b) => {
    const colorA = parseHexColor(a);
    const colorB = parseHexColor(b);
    if (!colorA || !colorB) return Number.MAX_SAFE_INTEGER;
    return Math.hypot(colorA.r - colorB.r, colorA.g - colorB.g, colorA.b - colorB.b, (colorA.a - colorB.a) * 255);
  };
  const colorStats = (value) => {
    const color = parseHexColor(value);
    if (!color) return null;
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    let hue = 0;
    if (delta) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { hue, saturation, lightness, luminance, alpha: color.a };
  };
  const closestStepInFamily = (family, activeColor) => {
    const values = dangoPrimitivePalettes[family] || [];
    const stats = colorStats(activeColor);
    if (family === "neutral" && stats?.alpha > 0.95) {
      return Math.min(9, Math.max(1, Math.round((1 - stats.luminance) * 7) + 2));
    }
    if (family === "white" && stats?.alpha > 0.95) {
      return Math.min(9, Math.max(1, Math.round(stats.luminance * 7) + 2));
    }
    return values.reduce((best, value, index) => {
      const distance = rgbDistance(activeColor, value);
      if (!best || distance < best.distance) return { step: index + 1, distance };
      return best;
    }, null)?.step || 1;
  };
  const chromaticFamilyForHue = (hue) => {
    if (hue < 12 || hue >= 345) return "red";
    if (hue < 45) return "orange";
    if (hue < 72) return "yellow";
    if (hue < 95) return "tendershoots";
    if (hue < 155) return "green";
    if (hue < 185) return "turquoise";
    if (hue < 205) return "zimablue";
    if (hue < 255) return "blue";
    if (hue < 292) return "grape";
    return "purple";
  };
  const semanticFamilyHint = (tokenName, stats) => {
    if (stats?.luminance >= 0.92 && stats?.saturation <= 0.12) return "white";
    if (stats?.luminance <= 0.12 && stats?.saturation <= 0.45) return "neutral";
    if (stats?.saturation <= 0.08) {
      return stats.luminance > 0.72 ? "white" : "neutral";
    }
    return "";
  };
  const primitiveRefForBrandColor = (tokenName, activeColor) => {
    const stats = colorStats(activeColor);
    if (!stats) return "";
    const family = semanticFamilyHint(tokenName, stats) || chromaticFamilyForHue(stats.hue);
    const step = closestStepInFamily(family, activeColor);
    return `${family}-${step}`;
  };
  const primitiveOverridePriority = (name) => {
    if (name.endsWith("-color") || name.endsWith("-solid-bg")) return 0;
    if (name.endsWith("-border")) return 1;
    if (name.endsWith("-outline-color")) return 2;
    if (name.endsWith("-soft-bg")) return 3;
    return 4;
  };
  const primitiveOverrideMap = Object.entries(overrideTokenMap).reduce((map, [tokenName, activeValue]) => {
    const baseColor = firstColor(baseTokenMap[tokenName]);
    const activeColor = firstColor(activeValue);
    const primitiveRef = primitiveRefForBrandColor(tokenName, activeColor);
    if (!primitiveRef || !activeColor || formatHexColor(baseColor) === formatHexColor(activeColor)) return map;
    const current = map.get(primitiveRef);
    const item = {
      tokenName,
      baseColor,
      activeColor,
    };
    if (!current) {
      map.set(primitiveRef, {
        ...item,
        sourceTokens: [tokenName],
      });
      return map;
    }
    if (formatHexColor(current.activeColor) === formatHexColor(activeColor)) {
      if (!current.sourceTokens.includes(tokenName)) current.sourceTokens.push(tokenName);
      return map;
    }
    if (primitiveOverridePriority(tokenName) < primitiveOverridePriority(current.tokenName)) {
      map.set(primitiveRef, {
        ...item,
        sourceTokens: [tokenName],
      });
    }
    return map;
  }, new Map());
  const primitiveAnchorsByFamily = Array.from(primitiveOverrideMap.entries()).reduce((map, [primitiveRef, item]) => {
    const match = primitiveRef.match(/^(.+)-(\d)$/);
    if (!match) return map;
    const family = match[1];
    const anchors = map.get(family) || [];
    anchors.push({
      step: Number(match[2]),
      activeColor: item.activeColor,
    });
    map.set(family, anchors.sort((a, b) => a.step - b.step));
    return map;
  }, new Map());
  const mixColor = (fromValue, toValue, progress) => {
    const from = parseHexColor(fromValue);
    const to = parseHexColor(toValue);
    if (!from || !to) return "";
    const channel = (start, end) => Math.min(255, Math.max(0, Math.round(start + (end - start) * progress)));
    return `#${[channel(from.r, to.r), channel(from.g, to.g), channel(from.b, to.b)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  };
  const inferredPrimitiveColor = (family, step) => {
    const inferableFamilies = new Set(["neutral", "white", "red", "orange", "yellow", "tendershoots", "green", "turquoise", "zimablue", "blue", "grape", "purple"]);
    if (!inferableFamilies.has(family)) return "";
    const anchors = primitiveAnchorsByFamily.get(family) || [];
    if (!anchors.length || anchors.some((anchor) => anchor.step === step)) return "";
    if (anchors.length === 1) {
      const anchor = anchors[0];
      if (step < anchor.step) {
        const progress = step / anchor.step;
        return mixColor("#FFFFFF", anchor.activeColor, progress);
      }
      const progress = (step - anchor.step) / (10 - anchor.step);
      return mixColor(anchor.activeColor, "#000000", progress);
    }
    const lower = [...anchors].reverse().find((anchor) => anchor.step < step);
    const upper = anchors.find((anchor) => anchor.step > step);
    if (lower && upper) {
      const progress = (step - lower.step) / (upper.step - lower.step);
      return mixColor(lower.activeColor, upper.activeColor, progress);
    }
    if (!lower && upper) {
      const progress = step / upper.step;
      return mixColor("#FFFFFF", upper.activeColor, progress);
    }
    const progress = (step - lower.step) / (10 - lower.step);
    return mixColor(lower.activeColor, "#000000", progress);
  };
  const paletteRows = Object.entries(dangoPrimitivePalettes).map(([family, values]) => {
    const steps = values.map((value, index) => {
      const step = index + 1;
      const tokenName = `--du-${family}-${step}`;
      const primitiveRef = `${family}-${step}`;
      const inferredOverride = primitiveOverrideMap.get(primitiveRef);
      const inferredColor = inferredPrimitiveColor(family, step);
      const activeValue = tokenMap[tokenName] || inferredOverride?.activeColor || inferredColor || value;
      const activeColor = firstColor(activeValue) || firstColor(value);
      const hasPrimitiveSignal = Boolean(inferredOverride);
      const isExactMatch = formatHexColor(activeColor) === formatHexColor(value);
      const isInferred = Boolean(inferredColor) && !hasPrimitiveSignal && !overriddenTokenNames.has(tokenName);
      const isOverridden = isInferred || ((overriddenTokenNames.has(tokenName) || hasPrimitiveSignal) && (hasPrimitiveSignal || !isExactMatch));
      return {
        name: `${family}-${step}`,
        label: String(step),
        value: activeColor,
        baseValue: value,
        displayValue: formatHexColor(activeColor),
        baseDisplayValue: formatHexColor(value),
        swatch: firstColor(activeColor),
        textColor: readableTextColor(activeColor, 0.42),
        isOverridden,
        isInferred,
        overrideKind: isInferred ? "推测" : isExactMatch ? "命中" : "覆盖",
        overrideSource: inferredOverride?.sourceTokens.join(" / ") || tokenName,
      };
    });
    return {
      family,
      steps,
      hasOverrides: steps.some((step) => step.isOverridden),
    };
  });
  const brandPrimitiveValueMap = paletteRows.reduce((map, row) => {
    row.steps.forEach((step) => {
      map.set(`${row.family}-${step.label}`, {
        value: step.value,
        swatch: step.swatch,
        displayValue: step.displayValue,
        baseDisplayValue: step.baseDisplayValue,
        isOverridden: step.isOverridden,
        isInferred: step.isInferred,
        overrideKind: step.overrideKind,
      });
    });
    return map;
  }, new Map());
  const primitiveForBaseToken = (name) => {
    const baseColor = firstColor(baseTokenMap[name]);
    const primitiveRef = baseColor ? primitiveRefForValue(baseColor) : "";
    return brandPrimitiveValueMap.get(primitiveRef)
      ? { ref: primitiveRef, ...brandPrimitiveValueMap.get(primitiveRef) }
      : null;
  };
  const semanticBrandFamilyMap = (() => {
    const directRefs = Array.from(primitiveOverrideMap.entries()).map(([ref, item]) => ({
      ref,
      family: ref.replace(/-\d$/, ""),
      tokenName: item.tokenName,
    }));
    const familyForPrefix = (prefix) => {
      const matches = directRefs.filter((item) => item.tokenName.startsWith(`--du-${prefix}-`));
      if (!matches.length) return "";
      const counts = matches.reduce((map, item) => {
        map.set(item.family, (map.get(item.family) || 0) + 1);
        return map;
      }, new Map());
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    };
    return {
      primary: familyForPrefix("primary"),
      secondary: familyForPrefix("secondary"),
      trade: familyForPrefix("trade"),
      success: familyForPrefix("success"),
      warning: familyForPrefix("warning"),
      error: familyForPrefix("error"),
    };
  })();
  const semanticPrefixFromName = (name) =>
    ["primary", "secondary", "trade", "success", "warning", "error"].find((prefix) => name.startsWith(`--du-${prefix}-`)) || "";
  const semanticResolvedColor = (name, activeValue = tokenMap[name]) => {
    const directOverride = tokenOverrideInfo(name, activeValue);
    if (directOverride.isOverridden) {
      const primitiveRef = primitiveRefForBrandColor(name, directOverride.overrideDisplayValue) || "unknown";
      return {
        value: directOverride.overrideDisplayValue,
        swatch: directOverride.overrideDisplayValue,
        baseDisplayValue: directOverride.baseDisplayValue,
        expression: `${primitiveRef} · ${directOverride.overrideDisplayValue}`,
        isOverridden: true,
        overrideKind: "覆盖",
      };
    }
    const semanticPrefix = semanticPrefixFromName(name);
    const semanticBrandFamily = semanticBrandFamilyMap[semanticPrefix];
    const basePrimitiveRef = primitiveForBaseToken(name)?.ref || "";
    const basePrimitiveFamily = basePrimitiveRef.replace(/-\d$/, "");
    const baseStep = basePrimitiveRef.match(/-(\d)$/)?.[1] || "";
    const canAdoptSemanticFamily = semanticBrandFamily && baseStep && !["neutral", "white", "purplegray"].includes(basePrimitiveFamily);
    const semanticFamilyValue = canAdoptSemanticFamily ? brandPrimitiveValueMap.get(`${semanticBrandFamily}-${baseStep}`) : null;
    if (semanticFamilyValue?.isOverridden) {
      return {
        value: semanticFamilyValue.displayValue,
        swatch: semanticFamilyValue.displayValue,
        baseDisplayValue: semanticFamilyValue.baseDisplayValue,
        expression: `${semanticBrandFamily}-${baseStep} · ${semanticFamilyValue.displayValue}`,
        isOverridden: true,
        isInferred: semanticFamilyValue.isInferred,
        overrideKind: semanticFamilyValue.overrideKind,
      };
    }
    const primitive = primitiveForBaseToken(name);
    if (primitive?.isOverridden) {
      return {
        value: primitive.displayValue,
        swatch: primitive.displayValue,
        baseDisplayValue: primitive.baseDisplayValue,
        expression: `${primitive.ref} · ${primitive.displayValue}`,
        isOverridden: true,
        isInferred: primitive.isInferred,
        overrideKind: primitive.overrideKind,
      };
    }
    const color = firstColor(activeValue);
    const primitiveRef = primitiveRefForValue(color) || "unknown";
    const hexValue = formatHexColor(color);
    return {
      value: hexValue,
      swatch: firstColor(hexValue),
      baseDisplayValue: hexValue,
      expression: `${primitiveRef} -> ${hexValue}`,
      isOverridden: false,
      overrideKind: "",
    };
  };
  const tokenRefFromValue = (value) => String(value).match(/var\((--[^)]+)\)/)?.[1] || "";
  const resolveTokenValue = (value, seen = []) => {
    const ref = tokenRefFromValue(value);
    if (!ref || seen.includes(ref) || !tokenMap[ref]) return { value, refs: [] };
    const resolved = resolveTokenValue(tokenMap[ref], [...seen, ref]);
    return { value: resolved.value, refs: [ref, ...resolved.refs] };
  };
  const tokenOverrideInfo = (name, activeValue = tokenMap[name]) => {
    const activeColor = firstColor(activeValue);
    const baseColor = firstColor(baseTokenMap[name]);
    const isOverridden = selectedStyle.id !== "dango" && overriddenTokenNames.has(name) && activeColor && baseColor && formatHexColor(activeColor) !== formatHexColor(baseColor);
    return {
      isOverridden,
      baseColor,
      baseDisplayValue: baseColor ? formatHexColor(baseColor) : "",
      overrideDisplayValue: activeColor ? formatHexColor(activeColor) : "",
    };
  };
  const mappingExpression = (name, primitiveRef, hexValue, prefixParts = []) => {
    const overrideInfo = tokenOverrideInfo(name, tokenMap[name]);
    if (overrideInfo.isOverridden) {
      return [...prefixParts, `DangoUI ${overrideInfo.baseDisplayValue} -> ${selectedStyle.label} ${overrideInfo.overrideDisplayValue}`].filter(Boolean).join(" -> ");
    }
    return [...prefixParts, primitiveRef || "unknown", hexValue].filter(Boolean).join(" -> ");
  };
  const componentAlias = (name, displayName = name.replace("--du-", ""), rawOverride = null, context = "", optionalRef = "") => {
    const rawValue = rawOverride ?? tokenMap[name] ?? "";
    const resolved = resolveTokenValue(rawValue);
    const colorValue = firstColor(resolved.value) || firstColor(rawValue);
    if (!colorValue) return null;
    const overrideInfo = tokenOverrideInfo(name, rawValue);
    const refResolvedInfo = resolved.refs.map((ref) => ({ ref, resolved: semanticResolvedColor(ref, tokenMap[ref]) })).find((item) => item.resolved.isOverridden);
    const directResolvedInfo = semanticResolvedColor(name, rawValue);
    const finalResolved = overrideInfo.isOverridden ? directResolvedInfo : refResolvedInfo?.resolved || null;
    const hexValue = finalResolved?.value || formatHexColor(colorValue);
    const primitiveRef = finalResolved?.expression?.split(" · ")[0] || primitiveRefForValue(hexValue) || "unknown";
    const slotLabel = optionalRef?.split(" -> ")[0] || displayName.replace(/^--du-/, "");
    const expression = `${slotLabel} · ${primitiveRef} · ${hexValue}`;
    return {
      name,
      label: displayName,
      value: rawValue,
      hexValue,
      swatch: firstColor(hexValue),
      expression,
      isOverridden: Boolean(finalResolved?.isOverridden),
      isInferred: Boolean(finalResolved?.isInferred),
      overrideKind: finalResolved?.overrideKind || "",
    };
  };
  const sortByOrder = (items, order) => {
    const orderMap = new Map(order.map(([suffix], index) => [suffix, index]));
    return [...items].sort((a, b) => {
      const aIndex = orderMap.has(a.suffix) ? orderMap.get(a.suffix) : Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.has(b.suffix) ? orderMap.get(b.suffix) : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || a.suffix.localeCompare(b.suffix);
    });
  };
  const componentAliasOrder = [
    ["solid-color", "solidColor"],
    ["solid-bg", "solidBg"],
    ["color", "color"],
    ["soft-bg", "softBg"],
    ["outline-color", "outlineColor"],
    ["border", "border"],
    ["text-color", "textColor"],
    ["solid-disabledtemp-color", "solidDisabledtempColor"],
    ["solid-disabledtemp-bg", "solidDisabledtempBg"],
    ["disabledtemp-color", "disabledtempColor"],
    ["soft-disabledtemp-bg", "softDisabledtempBg"],
    ["outline-disabledtemp-color", "outlineDisabledtempColor"],
    ["disabledtemp-border", "disabledtempBorder"],
    ["text-disabledtemp-color", "textDisabledtempColor"],
  ];
  const componentAliasOrderIndex = (item) => {
    const haystack = `${item.displayName || ""} ${item.tokenName || ""} ${item.suffix || ""}`;
    const index = componentAliasOrder.findIndex(([suffix]) => haystack.endsWith(suffix) || haystack.includes(`-${suffix}`));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const buttonVariantNames = ["primary", "secondary", "trade", "success", "warning", "error", "default", "white", "trans-black", "vip"];
  const buttonVariantTokens = buttonVariantNames.flatMap((variant) =>
    sortByOrder(
      componentAliasOrder
        .map(([suffix, displayName]) => ({
          variant,
          suffix,
          displayName,
          tokenName: `--du-bt-${suffix}`,
          semanticName: `--du-${variant}-${suffix}`,
        }))
        .filter((item) => tokenMap[item.semanticName]),
      componentAliasOrder,
    ),
  );
  const buttonVariantGroups = buttonVariantNames
    .map((variant) => {
      const mappings = sortByOrder(
        buttonVariantTokens.filter((item) => item.variant === variant),
        componentAliasOrder,
      )
        .map((item) => componentAlias(
          item.tokenName,
          item.tokenName,
          `var(${item.semanticName})`,
          "",
          `${item.suffix} -> ${item.variant}-${item.suffix}`,
        ))
        .filter(Boolean);
      return {
        name: variant,
        summary: `du-c-${variant}-bt：bt-* 槽位赋值到 ${variant}-*`,
        mappings,
      };
    })
    .filter((group) => group.mappings.length);
  const componentTokenGroups = [
    {
      component: "Button",
      source: "源码逻辑：每个 du-c-{color}-bt 分别把 bt-* 槽位赋值到 {color}-*",
      variantGroups: buttonVariantGroups,
      tokens: [],
    },
    ...catalog.components
      .filter((componentItem) => componentItem.name !== "Button" && componentItem.tokens)
      .map((componentItem) => ({
        component: componentItem.name,
        source: "catalog component.tokens 全量",
        tokens: Object.entries(componentItem.tokens)
          .map(([displayName, tokenName]) => ({
            tokenName,
            displayName,
          }))
          .sort((a, b) => componentAliasOrderIndex(a) - componentAliasOrderIndex(b) || a.displayName.localeCompare(b.displayName)),
      })),
  ];
  const componentAliasGroups = componentTokenGroups
    .map((spec) => {
      const seen = new Set();
      const mappings = spec.tokens
        .filter(({ tokenName, rawOverride }) => {
          const key = `${tokenName}:${rawOverride || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return Boolean(tokenMap[tokenName]);
        })
        .map(({ tokenName, displayName, rawOverride, context, optionalRef }) => componentAlias(tokenName, displayName, rawOverride, context, optionalRef))
        .filter(Boolean);
      return {
        component: spec.component,
        expanded: spec.component === "Button",
        variantGroups: spec.variantGroups,
        summary: spec.variantGroups
          ? `${spec.variantGroups.length} 个颜色变体 · ${spec.source}`
          : mappings.length
          ? `${mappings.length} 个颜色别名 · ${spec.source}`
          : `无颜色别名 · ${spec.source}`,
        mappings,
      };
    })
    .filter((group) => group.component === "Button" || group.summary);
  const neutralSemanticDescription = "占整个 app 用色的 60%，文字、图标、边框、分割线、阴影的常用色";
  const semanticFamilies = [
    { family: "text", prefix: "text", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "disabled"] },
    { family: "icon", prefix: "icon", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "disabled"] },
    { family: "border", prefix: "border", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3"] },
    { family: "bg", prefix: "bg", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "4"] },
    { family: "mask", prefix: "mask", category: "中性语义色", source: neutralSemanticDescription, order: ["1", "2", "3", "4", "hover", "active"] },
    { family: "primary", prefix: "primary", category: "品牌语义色", source: "品牌主色，用于主按钮、主行动入口和关键高亮。" },
    { family: "secondary", prefix: "secondary", category: "品牌语义色", source: "品牌辅助色，用于次级行动、辅助强调和品牌延展。" },
    { family: "trade", prefix: "trade", category: "品牌语义色", source: "交易/业务强调色，用于价格、交易动作和强业务状态。" },
    { family: "success", prefix: "success", category: "通用语义色", source: "成功状态色，用于完成、通过、正向反馈。" },
    { family: "warning", prefix: "warning", category: "通用语义色", source: "警告状态色，用于提醒、风险提示和待处理状态。" },
    { family: "error", prefix: "error", category: "通用语义色", source: "错误状态色，用于失败、危险、破坏性提示。" },
    { family: "default", prefix: "default", category: "通用语义色", source: "默认操作色，用于未指定品牌或状态语义的组件默认态。" },
    { family: "white", prefix: "white", category: "通用语义色", source: "反相语义色，用于深色底上的文字、图标和组件状态。" },
    { family: "transblack", prefix: "trans-black", category: "通用语义色", source: "透明黑语义色，用于遮罩、浮层、压暗和叠加状态。" },
  ];
  const semanticRows = semanticFamilies.map(({ family, prefix, category, source, order }) => {
    const tokenPrefix = `--du-${prefix}-`;
    const familyTokens = Object.entries(tokenMap)
      .filter(([name]) => name.startsWith(tokenPrefix))
      .filter(([name]) => !name.includes("-bt-") && !name.includes("-tag-") && !name.endsWith("-channel"));
    const directToken = (suffix) => {
      const name = `${tokenPrefix}${suffix}`;
      const resolved = semanticResolvedColor(name, tokenMap[name]);
      return {
        name,
        label: suffix,
        value: resolved.value,
        displayValue: resolved.value,
        baseDisplayValue: resolved.baseDisplayValue,
        swatch: resolved.swatch,
        textColor: readableTextColor(resolved.swatch, 0.42),
        isOverridden: resolved.isOverridden,
        isInferred: resolved.isInferred,
        overrideKind: resolved.overrideKind,
        expression: resolved.expression,
      };
    };
    const steps = Array.from({ length: 9 }, (_, index) => directToken(String(index + 1))).filter((item) => item.value);
    const aliases = familyTokens
      .filter(([name]) => order || !/^--du-[a-z-]+-\d$/.test(name))
      .map(([name, value]) => {
        const resolved = semanticResolvedColor(name, value);
        const label = name.replace(tokenPrefix, "");
        return {
          name,
          label,
          value: resolved.value,
          displayValue: resolved.value,
          baseDisplayValue: resolved.baseDisplayValue,
          swatch: resolved.swatch,
          expression: resolved.expression,
          isOverridden: resolved.isOverridden,
          isInferred: resolved.isInferred,
          overrideKind: resolved.overrideKind,
        };
      });
    const mappedAliasNames = order
      ? order.map((label) => [label, label])
      : [
      ["solid-color", "solidColor"],
      ["solid-bg", "solidBg"],
      ["color", "color"],
      ["soft-bg", "softBg"],
      ["outline-color", "outlineColor"],
      ["border", "border"],
      ["text-color", "textColor"],
      ["solid-disabledtemp-color", "solidDisabledtempColor"],
      ["solid-disabledtemp-bg", "solidDisabledtempBg"],
      ["disabledtemp-color", "disabledtempColor"],
      ["soft-disabledtemp-bg", "softDisabledtempBg"],
      ["outline-disabledtemp-color", "outlineDisabledtempColor"],
      ["disabledtemp-border", "disabledtempBorder"],
      ["text-disabledtemp-color", "textDisabledtempColor"],
    ];
    const mappings = mappedAliasNames
      .map(([label, displayName]) => {
        const item = aliases.find((aliasItem) => aliasItem.label === label);
        return item ? { ...item, displayName } : null;
      })
      .filter(Boolean)
      .map((item) => ({
        name: item.name,
        label: item.displayName,
        value: item.value,
        swatch: item.swatch,
        primitiveRef: primitiveRefForValue(item.value) || "unknown",
        hexValue: formatHexColor(item.value),
        expression: item.expression,
        isOverridden: item.isOverridden,
        isInferred: item.isInferred,
        overrideKind: item.overrideKind,
      }));
    return {
      family,
      category,
      scaleText: source,
      mappings,
    };
  });
  const alias = (name, value, swatchSource = value) => ({
    name,
    value,
    swatch: firstColor(swatchSource),
    chain: "",
  });
  const semantic = (name, ref, swatchSource = tokenMap[name]) => ({
    name,
    value: `var(${ref})`,
    swatch: firstColor(swatchSource),
    chain: "",
  });
  const component = (name) => {
    const value = tokenMap[name] || "";
    const ref = String(value).match(/var\((--[^)]+)\)/)?.[1] || "";
    return {
      name,
      value: ref ? `var(${ref})` : value,
      swatch: firstColor(tokenMap[ref] || value),
      chain: "",
    };
  };
  return [
    {
      title: "一级：基础色板",
      description: "只表达颜色家族和色阶，不带业务语义。",
      variant: "paletteRows",
      items: paletteRows,
      hasOverrides: paletteRows.some((row) => row.hasOverrides),
    },
    {
      title: "二级：语义色板",
      description: "引用一级基础色板，中性色:品牌语义色:通用语义色=6:3:1，中性色包括 White/Transblack/Default，品牌语义色包括 Primary/Secondary/Trade，通用语义色包括 Success/Warning/Error。",
      variant: "semanticTextRows",
      items: semanticRows,
    },
    {
      title: "三级：组件别名",
      description: "组件别名层引用二级语义色板；当前快照 61 个组件，其中 39 个有 token map，32 个能解析到颜色链路。",
      variant: "componentAliasRows",
      items: componentAliasGroups,
    },
  ];
}
