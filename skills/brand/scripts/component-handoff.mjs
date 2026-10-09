import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { installComponentKits } from './install-component-kit.mjs';
import { lexicalTokens, moduleConfigLiterals } from './module-config-literals.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const validHash = value => /^[a-f0-9]{64}$/.test(value || '');
function staticImports(code) {
  const tokens = lexicalTokens(code);
  const imports = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== 'word' || tokens[i].value !== 'import' || tokens[i - 1]?.value === '.') continue;
    if (tokens[i + 1]?.kind === 'string') { imports.push(tokens[i + 1].value); continue; }
    if (['(', '.'].includes(tokens[i + 1]?.value)) continue;
    for (let j = i + 1; j < tokens.length && tokens[j].value !== ';'; j++) {
      if (tokens[j].kind === 'word' && tokens[j].value === 'from' && tokens[j + 1]?.kind === 'string') { imports.push(tokens[j + 1].value); break; }
    }
  }
  return imports;
}
function targetScript(text, target) {
  if (!target.endsWith('.vue')) return text;
  const scripts = [...text.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if (!scripts.length || scripts.some(match => /\bsrc\s*=/.test(match[1]))) fail('MODULE_VUE_INLINE_SCRIPT_REQUIRED');
  return scripts.map(match => match[2]).join('\n;\n');
}
function relative(value) {
  if (typeof value !== 'string' || path.isAbsolute(value) || value.includes('\\') || value.split('/').some(x => !x || x === '.' || x === '..')) fail('MODULE_PATH_UNSAFE');
  return value;
}
function safe(root, value, mustExist = true) {
  const file = path.join(root, relative(value));
  let cursor = root;
  for (const part of value.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('MODULE_SYMLINK_UNSAFE');
  }
  if (mustExist && (!fs.existsSync(file) || !fs.statSync(file).isFile())) fail('MODULE_FILE_MISSING');
  return file;
}
function bound(root, item) {
  const file = safe(root, item.path);
  if (!validHash(item.sha256) || hash(fs.readFileSync(file)) !== item.sha256) fail(`MODULE_HASH_MISMATCH:${item.path}`);
  return file;
}
function platform(root) {
  const pkg = JSON.parse(fs.readFileSync(safe(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (Object.keys(deps).some(key => key.startsWith('@tarojs/'))) return 'taro';
  if (/^[~^]?3\./.test(deps.vue || '') && (deps.vite || deps['@vue/cli-service'])) return 'vue3-browser';
  return 'unknown';
}

// Deliberately narrow: inspect literal declarations without executing host config.
// Dynamic/overridden effective config still requires the downstream build check.
function taroInstallation(root, host, kit) {
  const config = host.taro;
  if (!config || !kit.entry.endsWith('.vue') || !host.target.endsWith('.vue')) fail('MODULE_TARO_SFC_REQUIRED');
  if (!Array.isArray(kit.targets) || !kit.targets.length || kit.targets.some(x => !/^[a-z][a-z0-9-]*$/.test(x)) || !kit.targets.includes(config.buildTarget)) fail('MODULE_TARO_TARGET_MISMATCH');
  const required = ['vue', '@tarojs/taro', '@tarojs/components', '@tarojs/plugin-framework-vue3'];
  const pkg = JSON.parse(fs.readFileSync(safe(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!Array.isArray(kit.dependencies) || required.some(x => !kit.dependencies.includes(x)) || kit.dependencies.some(x => typeof x !== 'string' || !Object.hasOwn(deps, x)) || !/^[~^]?3\./.test(deps.vue || '') || deps['@tarojs/plugin-framework-react']) fail('MODULE_TARO_DEPENDENCIES_UNSUPPORTED');
  relative(config.sourceRoot);
  const configFile = safe(root, config.configFile);
  if (!host.protectedFiles.some(x => x.path === config.configFile)) fail('MODULE_TARO_CONFIG_PROTECTION_REQUIRED');
  const literals = moduleConfigLiterals(fs.readFileSync(configFile, 'utf8'));
  for (const [key, expected] of [['sourceRoot', config.sourceRoot], ['framework', 'vue3']]) {
    if (literals[key] !== expected) fail('MODULE_TARO_LITERAL_CONFIG_REQUIRED');
  }
  const sourceDir = safe(root, config.sourceRoot, false);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory() || !host.target.startsWith(`${config.sourceRoot}/`)) fail('MODULE_TARO_SOURCE_ROOT_INVALID');
  return `${config.sourceRoot}/.brand-components/${kit.id}`;
}

// Internal helper for the public apply-host entry; not a parallel command.
export function componentHandoff({ manifestPath, command = 'run', dryRun = false }) {
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes);
  const { kit, approval, host } = manifest;
  if (manifest.schema !== 'approved-component-handoff/v1' || manifest.scope !== 'single-module' || !kit || !host) fail('MODULE_HANDOFF_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(kit.id || '') || !['browser-dom', 'taro'].includes(kit.runtime) || kit.framework !== 'vue3') fail('MODULE_KIT_PLATFORM_UNSUPPORTED');
  if (!Array.isArray(kit.files) || !kit.files.length || new Set(kit.files.map(x => x.path)).size !== kit.files.length || !kit.usage?.trim()) fail('MODULE_KIT_INVALID');
  const files = new Set(kit.files.map(x => relative(x.path)));
  for (const file of kit.files) if (!/\.(?:mjs|js|css|json|png|jpe?g|webp|svg|woff2?|ttf)$/.test(file.path) && !(kit.runtime === 'taro' && file.path.endsWith('.vue'))) fail('COMPONENT_KIT_FILE_TYPE_INVALID');
  const inlineSfc = kit.runtime === 'taro' && kit.entry?.endsWith('.vue') && kit.stylesheet === undefined;
  if (!files.has(kit.entry) || (!inlineSfc && !files.has(kit.stylesheet)) || [...files].some(file => ['handoff-receipt.json', 'target-baseline.txt'].includes(file.split('/')[0]))) fail('MODULE_KIT_ENTRY_INVALID');
  if (approval?.kitSha256 !== hash(JSON.stringify(kit)) || !approval.statement?.trim()) fail('MODULE_APPROVAL_INVALID');
  if (!path.isAbsolute(manifest.sourceRoot || '') || !path.isAbsolute(host.root || '')) fail('MODULE_ROOT_ABSOLUTE_REQUIRED');
  const source = fs.realpathSync(manifest.sourceRoot), root = fs.realpathSync(host.root);
  for (const file of kit.files) bound(source, file);
  const target = safe(root, host.target);
  if (host.target.split('/').includes('.brand-components')) fail('MODULE_TARGET_UNSAFE');
  if (!validHash(host.sha256) || !Array.isArray(host.protectedFiles) || !host.protectedFiles.length || !Array.isArray(manifest.protectedBehavior) || !manifest.protectedBehavior.length) fail('MODULE_PROTECTION_REQUIRED');
  if (!host.protectedFiles.some(file => file.path === 'package.json')) fail('MODULE_PACKAGE_PROTECTION_REQUIRED');
  for (const file of host.protectedFiles) {
    if (file.path === host.target || file.path.split('/').includes('.brand-components')) fail('MODULE_PROTECTED_PATH_INVALID');
    bound(root, file);
  }
  const detected = platform(root);
  const base = { scope: 'single-module', fullWorkflowPass: false, userGoalCompleted: false, hostPlatform: detected };
  if ((detected === 'taro') !== (kit.runtime === 'taro') && detected !== 'unknown') return { ...base, ok: false, status: 'needs-adaptation', reason: 'kit runtime does not match host platform; no host writes performed' };
  if (detected === 'unknown') fail('MODULE_HOST_PLATFORM_UNKNOWN');
  const installRelative = kit.runtime === 'taro' ? taroInstallation(root, host, kit) : `.brand-components/${kit.id}`;
  const destination = safe(root, installRelative, false);
  const receiptPath = safe(root, `${installRelative}/handoff-receipt.json`, false);
  const baselinePath = safe(root, `${installRelative}/target-baseline.txt`, false);
  const manifestHash = hash(bytes);
  let receipt;
  if (fs.existsSync(receiptPath)) {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    if (receipt.schema !== 'component-implementation-receipt/v1' || receipt.fullWorkflowPass !== false || receipt.kitSha256 !== approval.kitSha256 || receipt.manifestSha256 !== manifestHash || receipt.hostRoot !== root || receipt.target !== host.target || receipt.baselineSha256 !== host.sha256) fail('MODULE_EXISTING_HANDOFF_CONFLICT');
    if (!fs.existsSync(baselinePath) || hash(fs.readFileSync(baselinePath)) !== host.sha256) fail('MODULE_BASELINE_DRIFT');
    for (const file of kit.files) bound(destination, file);
  } else {
    if (command === 'status') fail('MODULE_HANDOFF_NOT_STARTED');
    bound(root, { path: host.target, sha256: host.sha256 });
    // A partial/foreign installation is not silently adopted or overwritten.
    if (fs.existsSync(destination)) fail('MODULE_DESTINATION_EXISTS');
  }
  const importPath = file => {
    const rel = path.relative(path.dirname(target), path.join(destination, file)).split(path.sep).join('/');
    return rel.startsWith('.') ? rel : `./${rel}`;
  };
  const dispatch = {
    role: 'host-implementation', target, baseline: baselinePath,
    component: { runtime: kit.runtime, framework: kit.framework, targets: kit.targets, dependencies: kit.dependencies, entry: path.join(destination, kit.entry), stylesheet: kit.stylesheet ? path.join(destination, kit.stylesheet) : null, entryImport: importPath(kit.entry), stylesheetImport: kit.stylesheet ? importPath(kit.stylesheet) : null, usage: kit.usage },
    runtimeCheck: kit.runtime === 'taro' ? { ...host.taro, configEvaluation: 'literal-declarations-only', required: 'Confirm effective sourceRoot/framework and dependency versions, compile the declared build target, then independently check rendering and interactions in that runtime.' } : { required: 'Independently check browser rendering and interactions.' },
    allowedChanges: [host.target],
    constraints: ['Only replace module presentation with the approved component; bind existing data and event handler.', 'Do not change business records, fetch/API logic, routes, state or event semantics.', 'Do not modify installed kit or protected files. Do not rebuild component markup or override approved styles.'],
    protectedBehavior: manifest.protectedBehavior,
    next: `node '${fileURLToPath(new URL('./run-brand-workflow.mjs', import.meta.url)).replaceAll("'", "'\\''")}' status --component-handoff '${path.resolve(manifestPath).replaceAll("'", "'\\''")}'`,
  };
  if (command === 'status') {
    const text = fs.readFileSync(target, 'utf8');
    // Static presence is only an implementation signal, never runtime/behavior QA.
    const imports = staticImports(targetScript(text, target)).filter(specifier => specifier.startsWith('./') || specifier.startsWith('../')).map(specifier => path.resolve(path.dirname(target), specifier));
    if (!imports.includes(path.join(destination, kit.entry)) || (kit.stylesheet && !imports.includes(path.join(destination, kit.stylesheet)))) fail('MODULE_IMPORTS_MISSING');
    return { ...base, ok: true, status: 'implementation-linked-awaiting-independent-qa', implementationSha256: hash(text), receipt: receiptPath, dispatch, limitations: ['Static imports do not prove rendering, actual use, business preservation or visual fidelity. Independent browser and source-diff review required.'] };
  }
  if (!receipt && !dryRun) {
    // File/hash/type validation is completed before creating the destination.
    fs.mkdirSync(destination, { recursive: true });
    installComponentKits({ sourceRoot: source, destinationRoot: destination, kits: [kit] });
    fs.writeFileSync(baselinePath, fs.readFileSync(target), { flag: 'wx' });
    receipt = { schema: 'component-implementation-receipt/v1', manifestSha256: manifestHash, hostRoot: root, target: host.target, baselineSha256: host.sha256, kitSha256: approval.kitSha256, fullWorkflowPass: false };
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  }
  return { ...base, ok: true, status: dryRun ? 'validated-no-writes' : 'awaiting-implementation', repeatedRun: Boolean(receipt && fs.readFileSync(target) && hash(fs.readFileSync(target)) !== host.sha256), receipt: receiptPath, dispatch };
}
