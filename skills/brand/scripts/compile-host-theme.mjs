import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(`HOST_THEME_INVALID: ${message}`); };
const read = file => fs.readFileSync(file, 'utf8');

// This is a compiler, not a runtime or visual verdict. It intentionally does not
// import the package's JS (React hosts may reuse CSS but not Vue components).
export function compileHostTheme({ modFile, adapterFile, dangouiRoot, outputDir }) {
  const modText = read(modFile), adapterText = read(adapterFile);
  const mod = JSON.parse(modText), adapter = JSON.parse(adapterText);
  if (!mod.tokens?.dtcg) fail('canonical tokens.dtcg missing');
  if (!Array.isArray(adapter.tokenMappings) || !adapter.tokenMappings.length) fail('adapter tokenMappings missing');
  const packageText = read(path.join(dangouiRoot, 'package.json'));
  const pkg = JSON.parse(packageText);
  if (pkg.name !== 'dangoui' || !pkg.version) fail('installed package is not dangoui');
  if (adapter.catalog?.version && adapter.catalog.version !== pkg.version) fail('adapter/package version mismatch');
  const externalResources = new Set();
  const packageCss = ['./theme.css', './style.css'].map(key => {
    const relative = pkg.exports?.[key];
    if (typeof relative !== 'string' || !relative.startsWith('./')) fail(`missing CSS export ${key}`);
    const file = fs.realpathSync(path.resolve(dangouiRoot, relative));
    const root = fs.realpathSync(dangouiRoot);
    if (!file.startsWith(root + path.sep)) fail('package CSS escapes package');
    const css = read(file);
    // Keep runtime CSS portable. External asset copying needs a separate asset
    // handoff; this compiler must not silently emit broken relative URLs.
    if (/@import\b/i.test(css)) fail('package CSS has unresolved imports');
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
      const url = (match[1] ?? match[2] ?? match[3]).trim();
      if (/^data:/i.test(url)) continue;
      if (/^https:\/\//i.test(url)) externalResources.add(url);
      else fail('package CSS has unresolved relative/local resources');
    }
    return { file: relative, css, sha256: hash(css) };
  });
  const declarations = new Set([...packageCss.map(x => x.css).join('\n').matchAll(/(--du-[a-zA-Z0-9_-]+)\s*:/g)].map(m => m[1]));
  const leaves = new Map();
  function walk(node, trail = [], inheritedType) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if ('$value' in node) { leaves.set(trail.join('.'), { ...node, $type: node.$type || inheritedType }); return; }
    for (const [key, value] of Object.entries(node)) if (!key.startsWith('$')) walk(value, [...trail, key], node.$type || inheritedType);
  }
  walk(mod.tokens.dtcg);
  const limitations = new Set(), unresolved = [], rows = [], seen = new Set();
  function resolve(tokenPath, stack = []) {
    if (stack.includes(tokenPath)) fail(`alias cycle: ${[...stack, tokenPath].join(' -> ')}`);
    const token = leaves.get(tokenPath);
    if (!token) fail(`missing alias/source ${tokenPath}`);
    const alias = typeof token.$value === 'string' && token.$value.match(/^\{([^{}]+)\}$/);
    return alias ? resolve(alias[1], [...stack, tokenPath]) : { value: token.$value, type: token.$type };
  }
  function cssValue(value, type) {
    if (type === 'dimension' && value && typeof value === 'object') {
      if (!Number.isFinite(value.value) || !['px', 'rem'].includes(value.unit)) fail('invalid dimension object');
      return `${value.value}${value.unit}`;
    }
    if (type === 'color' && value && typeof value === 'object') {
      if (value.colorSpace !== 'srgb' || !Array.isArray(value.components) || value.components.length !== 3 || value.components.some(x => !Number.isFinite(x) || x < 0 || x > 1) || !Number.isFinite(value.alpha ?? 1) || (value.alpha ?? 1) < 0 || (value.alpha ?? 1) > 1) fail('unsupported DTCG color object (expected srgb)');
      return `color(srgb ${value.components.join(' ')} / ${value.alpha ?? 1})`;
    }
    if (typeof value === 'number' && Number.isFinite(value) && ['number', 'fontWeight'].includes(type)) return String(value);
    if (type === 'string' && typeof value === 'string') {
      const httpsAsset = value.match(/^url\((https:\/\/[^\s"'();{}<>\\]+)\)$/i);
      if (httpsAsset) {
        const parsed = new URL(httpsAsset[1]);
        if (parsed.protocol !== 'https:') fail('unsafe or unsupported string value');
        limitations.add('HTTPS asset string preserved as a scoped style-only token; runtime availability must be checked in the host.');
        return `url("${parsed.href}")`;
      }
    }
    if (typeof value !== 'string' || /[;{}\n\r<>]|\/\*|url\(|var\(/i.test(value)) fail(`unsafe or unsupported ${type} value`);
    if (type === 'color') {
      if (!/^(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|(?:rgb|rgba|hsl|hsla|color)\([\d\s.,%/+a-z-]+\)|transparent|currentColor)$/i.test(value)) fail('invalid legacy color');
      limitations.add('Legacy string color values preserved; not normalized into DTCG color objects.');
    } else if (type === 'dimension') {
      if (!/^-?(?:\d+\.?\d*|\.\d+)(px|rem)$/.test(value)) fail('invalid legacy dimension');
      limitations.add('Legacy dimension strings preserved; prefer DTCG dimension objects.');
    } else if (!['fontFamily', 'fontWeight', 'number'].includes(type)) fail(`unsupported CSS token type ${type}`);
    return value;
  }
  const targetLeaves = new Map();
  for (const [key, token] of leaves) {
    const target = token.$extensions?.['echo.brand.target'];
    if (!target) continue;
    if (targetLeaves.has(target)) fail(`duplicate DTCG target ${target}`);
    targetLeaves.set(target, key);
  }
  for (const mapping of adapter.tokenMappings) {
    const target = mapping.targetToken;
    if (!/^--(?:du|style)-[a-zA-Z0-9_-]+$/.test(target || '')) fail(`invalid target ${target}`);
    if (seen.has(target)) fail(`duplicate adapter target ${target}`);
    seen.add(target);
    const direct = leaves.has(mapping.sourceToken) ? mapping.sourceToken : null;
    const tokenPath = direct || targetLeaves.get(target);
    if (!tokenPath) fail(`missing DTCG source for ${target}`);
    const token = leaves.get(tokenPath), ext = token.$extensions || {};
    if (ext['echo.brand.target'] && ext['echo.brand.target'] !== target) fail(`source target conflict ${target}`);
    const { value, type } = resolve(tokenPath);
    const compiledValue = cssValue(value, type);
    if (!Object.hasOwn(mapping, 'sourceValue') || cssValue(mapping.sourceValue, type).toLowerCase() !== compiledValue.toLowerCase()) fail(`adapter value drift ${target}`);
    const styleOnly = mapping.mappingType === 'style-only';
    if (styleOnly) {
      if (!target.startsWith('--style-') || mapping.targetExists !== false || (ext['echo.brand.channel'] && ext['echo.brand.channel'] !== 'styleOnly')) fail(`style-only boundary conflict ${target}`);
    } else if (!['mapped', 'identity'].includes(mapping.mappingType) || !target.startsWith('--du-') || mapping.targetExists !== true || !declarations.has(target) || (ext['echo.brand.channel'] && ext['echo.brand.channel'] !== 'mapped')) fail(`unknown/unproven DangoUI target ${target}`);
    rows.push({ dtcgPath: tokenPath, adapterSource: mapping.sourceToken, target, value: compiledValue, channel: styleOnly ? 'style-only' : 'mapped', allowedRoles: mapping.allowedRoles || [], forbiddenRoles: mapping.forbiddenRoles || [], evidenceRefs: mapping.evidenceRefs || [] });
  }
  for (const [target, key] of targetLeaves) {
    if (seen.has(target)) continue;
    if (leaves.get(key).$type === 'string') unresolved.push({ dtcgPath: key, target, reason: 'Descriptive composition token, not a CSS value; requires design implementation.' });
    else fail(`missing adapter mapping for ${key}`);
  }
  if (!rows.some(row => row.channel === 'mapped')) fail('no DangoUI mappings compiled');
  const theme = `/* Generated from frozen DTCG + adapter; load after DangoUI CSS.\n * Variables are not runtime consumption proof. */\n:root {\n${rows.map(row => `  ${row.target}: ${row.value};`).join('\n')}\n}\n`;
  const runtime = packageCss.map(x => `/* dangoui ${pkg.version} ${x.file} */\n${x.css}`).join('\n');
  const entry = '/* Import this file once from the host global entry. */\n@import "./dangoui-runtime.css";\n@import "./brand-theme.css";\n';
  const proof = { schema: 'host-theme-compilation/v1', status: 'compiled-not-runtime-verified', sources: { modSha256: hash(modText), adapterSha256: hash(adapterText), packageSha256: hash(packageText), dangoui: { name: pkg.name, version: pkg.version, css: packageCss.map(({ file, sha256 }) => ({ file, sha256 })) } }, outputs: { theme: { file: 'brand-theme.css', sha256: hash(theme) }, runtimeStyle: { file: 'dangoui-runtime.css', sha256: hash(runtime) } }, mappings: rows, unresolved, externalResources: [...externalResources], limitations: [...limitations, ...(externalResources.size ? ['Original package CSS retains HTTPS resources; availability/font loading must be checked in the host.'] : []), 'CSS reuse does not prove native component reuse or platform compatibility.', 'Consumer selectors, computed cascade, interaction parity and causal token-change checks remain required.'], runtimeVerified: false };
  proof.outputs.entry = { file: 'brand-entry.css', sha256: hash(entry) };
  const entryFile = path.join(outputDir, 'brand-entry.css');
  const integration = {
    entryFile,
    mappedVariables: rows.map(row => row.target),
    instructions: 'Import entryFile exactly once from the host application/global stylesheet entry; it loads library runtime before brand theme. Do not separately import its two child stylesheets or repeat library CSS later. Inspect existing declarations of mappedVariables on the themed root and consumers: remove or reconnect only stale brand overrides that mask these generated values. Preserve business styles and intentional mode/state overrides, and verify those branches. Do not force the theme with !important. Verify actual computed winners and token change → rendered change → restore in the running host; compilation alone is not runtime proof.',
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const themeFile = path.join(outputDir, 'brand-theme.css'), runtimeStyleFile = path.join(outputDir, 'dangoui-runtime.css'), proofFile = path.join(outputDir, 'theme-compilation.json');
  fs.writeFileSync(themeFile, theme); fs.writeFileSync(runtimeStyleFile, runtime); fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2) + '\n');
  fs.writeFileSync(entryFile, entry);
  return { themeFile, runtimeStyleFile, proofFile, entryFile, integration, mappedCount: rows.filter(r => r.channel === 'mapped').length, styleOnlyCount: rows.filter(r => r.channel === 'style-only').length, runtimeVerified: false };
}
