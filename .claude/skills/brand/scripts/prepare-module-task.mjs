import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { componentTask } from './component-task.mjs';
import { moduleConfigLiterals } from './module-config-literals.mjs';

const fail = message => { throw new Error(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const inside = (root, file) => file !== root && !path.relative(root, file).startsWith('..') && !path.isAbsolute(path.relative(root, file));
const safe = value => typeof value === 'string' && value && !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').some(x => !x || x === '.' || x === '..');
const sensitive = value => value.split('/').some(x => (x.startsWith('.') && !['.brand-components', '.brand-trials'].includes(x)) || /^(qdmp\.json|node_modules|dist|application_default_credentials\.json|.*\.(?:pem|key|p12))$/i.test(x));
function read(root, relative) {
  if (!safe(relative) || sensitive(relative)) fail(`MODULE_PREP_PATH_FORBIDDEN:${relative}`);
  const absolute = path.join(root, relative);
  for (let current = absolute; current !== root; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) fail(`MODULE_PREP_SYMLINK:${relative}`);
  }
  if (!inside(root, fs.realpathSync(absolute)) || !fs.statSync(absolute).isFile()) fail(`MODULE_PREP_NOT_FILE:${relative}`);
  return fs.readFileSync(absolute);
}
function root(value) {
  if (!value || !path.isAbsolute(value)) fail('MODULE_PREP_ABSOLUTE_ROOT_REQUIRED');
  const result = fs.realpathSync(value);
  if (!fs.statSync(result).isDirectory()) fail('MODULE_PREP_DIRECTORY_REQUIRED');
  return result;
}
function emptyOutput(value, inputs) {
  if (!value || !path.isAbsolute(value)) fail('MODULE_PREP_ABSOLUTE_OUTPUT_REQUIRED');
  const output = path.resolve(value);
  if (fs.lstatSync(output, { throwIfNoEntry: false })) fail('MODULE_PREP_OUTPUT_EXISTS');
  const parent = root(path.dirname(output));
  if (parent !== path.dirname(output)) fail('MODULE_PREP_OUTPUT_SYMLINK');
  if (inputs.some(input => input === output || inside(input, output) || inside(output, input))) fail('MODULE_PREP_OUTPUT_NOT_ISOLATED');
  return output;
}

// Two normal-entry calls: list real recipe metadata, then bind only the selected dependency closure.
// No task-specific ID, CSS, host component, network call or configuration execution lives here.
export function prepareModuleTask(options) {
  const brandRoot = root(options.brandRoot || path.dirname(options.modFile || ''));
  const modPath = options.modFile ? path.relative(brandRoot, path.resolve(options.modFile)) : 'brand-mod.json';
  const modBytes = read(brandRoot, modPath), mod = JSON.parse(modBytes);
  const modDir = path.dirname(modPath);
  const evidencePath = path.join(modDir, 'brand-evidence.json');
  const evidenceBytes = read(brandRoot, evidencePath), evidence = JSON.parse(evidenceBytes);
  const brandId = mod.manifest?.id;
  if (!brandId || evidence.brand !== brandId || !Array.isArray(mod.componentVariants) || !Array.isArray(evidence.claims)) fail('MODULE_PREP_PACKAGE_UNSUPPORTED');
  const variants = mod.componentVariants.filter(x => x.component === 'local-style-recipe');
  if (!variants.length || new Set(variants.map(x => x.id)).size !== variants.length) fail('MODULE_PREP_RECIPES_INVALID');
  if (!options.task?.trim() || !safe(options.target) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.moduleId || '')) fail('MODULE_PREP_TASK_REQUIRED');
  const hostRoot = root(options.hostRoot);
  read(hostRoot, options.target);
  const selectedIds = options.recipes ? options.recipes.split(',') : [];
  if (!selectedIds.length) return {
    ok: true, status: 'awaiting-recipe-selection', scope: 'single-module', approval: 'pending', fullWorkflowPass: false, userGoalCompleted: false,
    task: options.task, target: options.target, packageSha256: hash(modBytes),
    sourceScope: mod.manifest.scope, sourceLimitations: mod.limitations,
    candidates: variants.map(({ id, status, scope, for: uses, notFor, recipe, allowedTransformations }) => ({ id, sourceStatus: status, scope, for: uses, notFor, recipe, allowedTransformations, dependencyStatus: 'not-checked-until-selected', installableComponent: false })),
    next: 'The executing agent (not the user) selects relevant recipe IDs from this index, then repeats this same public command with --recipes <comma-separated IDs>. Supply --trial-authorization with the actual user-authorized scope and --artifact-root <new isolated directory>. Do not hand-write a manifest or use old experiment files.',
  };
  if (new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !variants.some(x => x.id === id))) fail('MODULE_PREP_UNKNOWN_RECIPE');
  if (!options.authorization?.trim()) fail('MODULE_PREP_TRIAL_AUTHORIZATION_REQUIRED');
  const selected = selectedIds.map(id => variants.find(x => x.id === id));
  if (selected.some(x => x.status !== 'approved' || !x.recipe || !Array.isArray(x.evidenceRefs) || !x.evidenceRefs.length)) fail('MODULE_PREP_RECIPE_NOT_SUPPORTED');
  const tokens = Object.fromEntries(Object.entries(mod.tokens?.styleOnly || {}).filter(([, value]) => selectedIds.includes(value.recipeId)));
  const dtcg = Object.fromEntries(Object.entries(mod.tokens?.dtcg?.styleOnly || {}).filter(([, value]) => selectedIds.includes(value.$extensions?.['echo.brand.recipeId'])));
  const refs = [...new Set([...selected, ...Object.values(tokens)].flatMap(x => x.evidenceRefs || []).concat(Object.values(dtcg).flatMap(x => x.$extensions?.['echo.brand.evidenceRefs'] || [])))];
  const claims = refs.map(id => {
    const matches = evidence.claims.filter(x => x.id === id);
    if (matches.length !== 1 || matches[0].status !== 'observed') fail(`MODULE_PREP_EVIDENCE_UNAVAILABLE:${id}`);
    return matches[0];
  });
  for (const claim of claims) {
    if (!Object.hasOwn(claim, 'capture') && !Object.hasOwn(claim, 'sourceCapture')) fail('MODULE_PREP_CAPTURE_REQUIRED');
    for (const key of ['capture', 'sourceCapture', 'beforeCapture', 'afterCapture']) {
      if (!Object.hasOwn(claim, key)) continue;
      const binding = claim[key];
      if (!binding || typeof binding !== 'object' || Array.isArray(binding) || !safe(binding.path) || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) fail(`MODULE_PREP_CAPTURE_BINDING_REQUIRED:${claim.id}:${key}`);
    }
    if (Object.hasOwn(claim, 'beforeCapture') !== Object.hasOwn(claim, 'afterCapture')) fail(`MODULE_PREP_CAPTURE_PAIR_REQUIRED:${claim.id}`);
  }
  const sourceFiles = new Map();
  const prefix = `migrations/${brandId}/`;
  function dependency(binding) {
    if (!safe(binding.path) || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) fail('MODULE_PREP_DEPENDENCY_BINDING_REQUIRED');
    // Existing MOD paths may be project-relative while the supplied root is the package folder.
    const relative = fs.existsSync(path.join(brandRoot, binding.path)) ? binding.path : binding.path.startsWith(prefix) ? path.join(modDir, binding.path.slice(prefix.length)) : binding.path;
    const bytes = read(brandRoot, relative);
    if (hash(bytes) !== binding.sha256) fail(`MODULE_PREP_DEPENDENCY_HASH:${binding.path}`);
    sourceFiles.set(relative, bytes);
    return { path: relative, sha256: binding.sha256 };
  }
  function bindTree(value) {
    if (Array.isArray(value)) return value.map(bindTree);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.path === 'string') return { ...value, ...dependency(value) };
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, bindTree(child)]));
  }
  const scopedClaims = bindTree(claims), scopedRecipes = bindTree(selected), scopedTokens = bindTree(tokens), scopedDtcg = bindTree(dtcg);
  const configCandidates = ['config/index.js', 'config/index.ts', 'config/index.mjs'].filter(x => fs.existsSync(path.join(hostRoot, x)));
  if (configCandidates.length !== 1) fail('MODULE_PREP_CONFIG_AMBIGUOUS');
  const configFile = configCandidates[0], config = read(hostRoot, configFile).toString();
  const { sourceRoot, framework } = moduleConfigLiterals(config);
  if (!safe(sourceRoot)) fail('MODULE_PREP_SOURCE_ROOT_UNSUPPORTED');
  const pkg = JSON.parse(read(hostRoot, 'package.json'));
  const deps = { ...pkg.devDependencies, ...pkg.dependencies };
  if (framework !== 'vue3' || !/^[~^]?3\./.test(deps.vue || '') || ['vue', '@tarojs/taro', '@tarojs/components', '@tarojs/plugin-framework-vue3'].some(x => typeof deps[x] !== 'string' || !deps[x]) || deps['@tarojs/plugin-framework-react']) fail('MODULE_PREP_TARO_VUE3_REQUIRED');
  if (!['weapp', 'h5'].includes(options.buildTarget || 'weapp')) fail('MODULE_PREP_BUILD_TARGET_UNSUPPORTED');
  if (!options.target.startsWith(`${sourceRoot}/`) || !options.target.endsWith('.vue') || options.target.includes('/.brand-')) fail('MODULE_PREP_TARGET_INVALID');
  if (fs.lstatSync(path.join(hostRoot, sourceRoot, '.brand-trials', options.moduleId), { throwIfNoEntry: false })) fail('MODULE_PREP_CANDIDATE_OUTPUT_EXISTS');
  const hostFiles = new Map();
  function walk(relative) {
    for (const item of fs.readdirSync(path.join(hostRoot, relative), { withFileTypes: true })) {
      const name = path.join(relative, item.name);
      if (sensitive(name)) continue;
      if (item.isSymbolicLink()) fail(`MODULE_PREP_HOST_SYMLINK:${name}`);
      if (item.isDirectory()) walk(name);
      else if (item.isFile()) hostFiles.set(name, read(hostRoot, name));
    }
  }
  walk(sourceRoot); walk('config');
  for (const name of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.json', 'babel.config.js', 'project.config.json', 'README.md', 'DESIGN.md', 'AGENTS.md']) {
    if (fs.existsSync(path.join(hostRoot, name))) hostFiles.set(name, read(hostRoot, name));
  }
  if (!hostFiles.has('package.json')) fail('MODULE_PREP_PACKAGE_JSON_REQUIRED');
  const output = emptyOutput(options.artifactRoot, [brandRoot, hostRoot]);
  // All reads and selected evidence validation precede writes. Newly created output is never reused.
  fs.mkdirSync(output);
  const write = (relative, bytes) => { const dest = path.join(output, relative); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes, { flag: 'wx' }); };
  for (const [name, bytes] of hostFiles) write(`host/${name}`, bytes);
  for (const [name, bytes] of sourceFiles) write(`brand/${name}`, bytes);
  const scoped = { schema: 'selected-brand-recipes/v1', source: { modPath: path.join(brandRoot, modPath), modSha256: hash(modBytes), evidencePath: path.join(brandRoot, evidencePath), evidenceSha256: hash(evidenceBytes) }, manifest: mod.manifest, limitations: mod.limitations, recipes: scopedRecipes, styleOnly: scopedTokens, dtcg: { styleOnly: scopedDtcg }, claims: scopedClaims,
    restrictions: ['Source-scoped recipe is not host approval or a prebuilt component.', 'Evidence screenshots are review-only; never embed in runtime.', 'Only included recipes/tokens/evidence are available. Global semantic roles are not authorized. Other assets, layout contracts, fonts and demo code are not authorized inputs.', 'Keep host data, state values, event behavior, APIs, routes and unrelated UI unchanged; explicitly adapt platform presentation only.'] };
  write('brand/selected-recipes.json', JSON.stringify(scoped, null, 2));
  const bind = (name, bytes) => ({ path: name, sha256: hash(bytes) });
  const scopedBinding = bind('selected-recipes.json', fs.readFileSync(path.join(output, 'brand/selected-recipes.json')));
  const protectedFiles = [...hostFiles].filter(([name]) => name !== options.target).map(([name, bytes]) => bind(name, bytes));
  const manifest = { schema: 'component-selection-task/v1', scope: 'single-module', approval: 'pending', authorization: { scope: 'isolated-trial-only', statement: options.authorization }, module: { id: options.moduleId, description: options.task },
    brand: { id: brandId, root: path.join(output, 'brand'), candidates: [{ id: 'selected-source-recipes', runtime: 'browser-dom', framework: 'html', files: [scopedBinding, ...[...sourceFiles].map(([name, bytes]) => bind(name, bytes))], usage: scopedBinding, capability: scopedBinding }] },
    host: { root: hostRoot, trialRoot: path.join(output, 'host'), sourceRoot, target: options.target, sha256: hash(hostFiles.get(options.target)), configFile, buildTarget: options.buildTarget || 'weapp', protectedFiles, acceptedComponents: protectedFiles.filter(x => x.path.includes('/.brand-components/')) },
    protectedBehavior: ['Preserve all existing business data, record order/count, state values and event semantics; source visual rules do not authorize business changes.', 'Only the described module presentation in the target file may change. Preserve other brands, unrelated target-file sections and all protected source files.', 'Original host stays read-only. No authentication changes, write operations or dependency installation are authorized by dispatch.'] };
  write('task.json', JSON.stringify(manifest, null, 2));
  const result = componentTask({ manifestPath: path.join(output, 'task.json') });
  result.preparation = { artifactRoot: output, manifest: path.join(output, 'task.json'), selectedRecipeIds: selectedIds, sourceScope: mod.manifest.scope, credentialExclusionPolicy: 'Skip all hidden path segments except .brand-components/.brand-trials, qdmp.json, application_default_credentials.json and pem/key/p12 files. This filename policy is not a secret-content scan and does not certify arbitrary source files as credential-free.', dependenciesCopied: false, configurationExecuted: false, unrelatedEvidenceValidated: false, completeBrandCertification: false };
  write('dispatch.json', JSON.stringify(result, null, 2));
  return result;
}
