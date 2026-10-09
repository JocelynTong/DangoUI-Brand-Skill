import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { moduleConfigLiterals } from './module-config-literals.mjs';

const fail = code => { throw new Error(code); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('../') && relative !== '..' && !path.isAbsolute(relative);
};
function relative(value) {
  if (!text(value) || path.isAbsolute(value) || value.includes('\\') || value.split('/').some(x => !x || x === '.' || x === '..')) fail('MODULE_TASK_PATH_UNSAFE');
  return value;
}
function directory(value) {
  if (!text(value) || !path.isAbsolute(value)) fail('MODULE_TASK_ABSOLUTE_ROOT_REQUIRED');
  const resolved = fs.realpathSync(value);
  if (!fs.statSync(resolved).isDirectory()) fail('MODULE_TASK_DIRECTORY_REQUIRED');
  return resolved;
}
function file(root, binding) {
  if (!binding || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) fail('MODULE_TASK_HASH_REQUIRED');
  const absolute = path.join(root, relative(binding.path));
  if (!inside(root, fs.realpathSync(absolute)) || !fs.statSync(absolute).isFile()) fail('MODULE_TASK_SYMLINK_ESCAPE');
  if (hash(fs.readFileSync(absolute)) !== binding.sha256) fail(`MODULE_TASK_HASH_MISMATCH:${binding.path}`);
  return { ...binding, absolute };
}
function bindings(root, values) {
  if (!Array.isArray(values) || new Set(values.map(x => x.path)).size !== values.length) fail('MODULE_TASK_FILES_INVALID');
  return values.map(value => file(root, value));
}

// Public run dispatch only: no source installation, host edit, approval, or ledger mutation.
export function componentTask({ manifestPath }) {
  const bytes = fs.readFileSync(manifestPath);
  const task = JSON.parse(bytes);
  if (task.schema !== 'component-selection-task/v1' || task.scope !== 'single-module') fail('MODULE_TASK_SCOPE_INVALID');
  if (task.approval !== 'pending' || task.authorization?.scope !== 'isolated-trial-only' || !text(task.authorization.statement)) fail('MODULE_TASK_AUTHORIZATION_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(task.module?.id || '') || !text(task.module.description)) fail('MODULE_TASK_MODULE_REQUIRED');
  if (!Array.isArray(task.protectedBehavior) || !task.protectedBehavior.length || task.protectedBehavior.some(x => !text(x))) fail('MODULE_TASK_BEHAVIOR_REQUIRED');
  const { brand, host } = task;
  if (!brand || !host || !text(brand.id)) fail('MODULE_TASK_INPUTS_REQUIRED');
  const brandRoot = directory(brand.root), root = directory(host.root), trialRoot = directory(host.trialRoot);
  if (root === trialRoot || inside(root, trialRoot) || inside(trialRoot, root)) fail('MODULE_TASK_TRIAL_NOT_ISOLATED');
  if (brandRoot === trialRoot || inside(brandRoot, trialRoot) || inside(trialRoot, brandRoot)) fail('MODULE_TASK_SOURCE_NOT_ISOLATED');
  const sourceRoot = relative(host.sourceRoot), target = relative(host.target);
  if (!target.startsWith(`${sourceRoot}/`) || !target.endsWith('.vue') || target.split('/').includes('.brand-components')) fail('MODULE_TASK_TARGET_INVALID');
  if (!['weapp', 'h5'].includes(host.buildTarget)) fail('MODULE_TASK_BUILD_TARGET_UNSUPPORTED');
  const outputRelative = `${sourceRoot}/.brand-trials/${task.module.id}`;
  if (fs.lstatSync(path.join(trialRoot, outputRelative), { throwIfNoEntry: false })) fail('MODULE_TASK_OUTPUT_EXISTS');
  let outputParent = path.dirname(path.join(trialRoot, outputRelative));
  while (!fs.lstatSync(outputParent, { throwIfNoEntry: false })) outputParent = path.dirname(outputParent);
  if (fs.lstatSync(outputParent).isSymbolicLink()) fail('MODULE_TASK_OUTPUT_UNSAFE');
  if (!inside(trialRoot, fs.realpathSync(outputParent))) fail('MODULE_TASK_OUTPUT_UNSAFE');
  const originalTarget = file(root, { path: target, sha256: host.sha256 });
  const trialTarget = file(trialRoot, { path: target, sha256: host.sha256 });
  if (fs.realpathSync(originalTarget.absolute) === fs.realpathSync(trialTarget.absolute)) fail('MODULE_TASK_TARGET_ALIASED');
  const originalStat = fs.statSync(originalTarget.absolute), trialStat = fs.statSync(trialTarget.absolute);
  if (originalStat.dev === trialStat.dev && originalStat.ino === trialStat.ino) fail('MODULE_TASK_TARGET_ALIASED');
  const protectedFiles = bindings(root, host.protectedFiles);
  if (!protectedFiles.some(x => x.path === 'package.json') || !protectedFiles.some(x => x.path === host.configFile) || protectedFiles.some(x => x.path === target)) fail('MODULE_TASK_PROTECTION_REQUIRED');
  const acceptedComponents = bindings(root, host.acceptedComponents);
  if (acceptedComponents.some(x => x.path === target)) fail('MODULE_TASK_ACCEPTED_TARGET_FORBIDDEN');
  bindings(trialRoot, host.protectedFiles);
  bindings(trialRoot, host.acceptedComponents);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.devDependencies, ...pkg.dependencies };
  const required = ['vue', '@tarojs/taro', '@tarojs/components', '@tarojs/plugin-framework-vue3'];
  if (required.some(x => !text(deps[x])) || !/^[~^]?3\./.test(deps.vue) || deps['@tarojs/plugin-framework-react']) fail('MODULE_TASK_TARO_VUE3_REQUIRED');
  const config = fs.readFileSync(file(root, protectedFiles.find(x => x.path === host.configFile)).absolute, 'utf8');
  const literals = moduleConfigLiterals(config);
  if (literals.sourceRoot !== sourceRoot || literals.framework !== 'vue3') fail('MODULE_TASK_CONFIG_UNSUPPORTED');
  if (!Array.isArray(brand.candidates) || !brand.candidates.length || new Set(brand.candidates.map(x => x.id)).size !== brand.candidates.length) fail('MODULE_TASK_CANDIDATES_REQUIRED');
  const candidates = brand.candidates.map(candidate => {
    if (!text(candidate.id) || !['vue3', 'html'].includes(candidate.framework) || !['browser-dom', 'taro'].includes(candidate.runtime) || (candidate.runtime === 'taro' && candidate.framework !== 'vue3')) fail('MODULE_TASK_CANDIDATE_PLATFORM_UNSUPPORTED');
    const files = bindings(brandRoot, candidate.files);
    if (!files.length) fail('MODULE_TASK_CANDIDATE_FILES_REQUIRED');
    const usage = file(brandRoot, candidate.usage), capability = file(brandRoot, candidate.capability);
    if (!text(fs.readFileSync(usage.absolute, 'utf8')) || !text(fs.readFileSync(capability.absolute, 'utf8'))) fail('MODULE_TASK_CANDIDATE_DOCS_EMPTY');
    return { id: candidate.id, runtime: candidate.runtime, framework: candidate.framework, files, usage, capability,
      adaptationRequired: candidate.runtime !== 'taro', referenceOnly: candidate.framework === 'html', directInstallationAllowed: false };
  });
  return {
    ok: true, scope: 'single-module', status: candidates.some(x => x.adaptationRequired) ? 'awaiting-adaptation' : 'awaiting-isolated-trial',
    approval: 'pending', fullWorkflowPass: false, userGoalCompleted: false,
    manifestSha256: hash(bytes),
    dispatch: {
      role: 'component-selection-adaptation', module: task.module, authorization: task.authorization,
      brand: { id: brand.id, root: brandRoot, candidates },
      host: { root, trialRoot, sourceRoot, originalTarget, trialTarget,
        protectionManifest: { absolute: path.resolve(manifestPath), sha256: hash(bytes),
          protectedFiles: { pointer: '/host/protectedFiles', count: protectedFiles.length, sha256: hash(JSON.stringify(host.protectedFiles)) },
          acceptedComponents: { pointer: '/host/acceptedComponents', count: acceptedComponents.length, sha256: hash(JSON.stringify(host.acceptedComponents)) },
          verifiedRoots: [root, trialRoot], instruction: 'Mechanically verify these manifest bindings in both roots; do not load every protected source into model context.' } },
      allowedChanges: [trialTarget.absolute],
      allowedNewFilesUnder: path.join(trialRoot, outputRelative),
      candidateOutputDirectory: path.join(trialRoot, outputRelative),
      protectedBehavior: task.protectedBehavior,
      platform: { runtime: 'taro', framework: 'vue3', buildTarget: host.buildTarget, configFile: host.configFile,
        dependencyVersions: Object.fromEntries(required.map(key => [key, deps[key]])), configEvaluation: 'literal-declarations-only' },
      constraints: [
        'Select an existing candidate using its actual usage/capability and the target module; record selection and rejected alternatives before adaptation.',
        'Adapt only the selected presentation into the isolated Taro host. Bind existing data and events; preserve unrelated modules and accepted components.',
        'Candidate output may only be added beneath candidateOutputDirectory; do not overwrite pre-existing files or use symlinks to escape the trial host.',
        'Do not edit original host, brand sources, protected files, business logic, routes, API, state, or event semantics. Do not add dependencies or expand the demo.',
        'Browser-DOM candidates require actual Taro adaptation; same Vue framework does not permit direct installation. No platform translation is performed by this entry.',
        'Check effective merged Taro configuration and compile the declared target. A different executor must review source differences and actual rendering/interactions; H5 does not prove weapp runtime.',
        'Report candidate provenance, adapter files, usage limits and missing runtime evidence. Keep aesthetic approval pending; do not create approved manifests or change historical certification.',
      ],
      requiredOutputs: ['Selection rationale and source hashes', 'Isolated adapter and original-to-trial diff', 'Build result and independent runtime/visual review with limitations'],
      execution: {
        owner: 'Calling agent orchestrates the existing producer and a different reviewer; dispatch is an intermediate result, not the user deliverable.',
        authorization: 'Continue implementation, build and local review only within the actual authorization statement. A preparation-only request must stop at preparation; do not infer broader authority.',
        hostGuides: protectedFiles.filter(binding => ['AGENTS.md', 'DESIGN.md', 'README.md'].includes(binding.path)).map(binding => file(trialRoot, binding)),
        build: { cwd: trialRoot, target: host.buildTarget, declaredScripts: Object.fromEntries(Object.entries(pkg.scripts || {}).filter(([name]) => /^build(?::|$)/.test(name))), instruction: 'Inspect the declared script and effective config before running. Compile only the selected target locally; no upload or deployment. If a required project file is missing, report that exact dependency instead of inventing it.' },
        dependencies: { copied: false, existingHostDirectory: fs.existsSync(path.join(root, 'node_modules')) ? path.join(root, 'node_modules') : null,
          instruction: 'Use an already available compatible host dependency environment when permitted. Reuse is not a clean-install proof; do not mutate shared dependencies. Installing packages or copying credentials is not authorized by this packet. Report missing environment requirements explicitly.' },
        review: 'After production, a different executor checks the original target against its frozen hash, both roots against protectedFiles/acceptedComponents, the target diff, brand inputs and actual rendering/interactions on the declared platform. Build alone is not runtime evidence. Keep observed facts, untested behavior and existing failures separate.',
        delivery: 'Return the runnable trial path, exact changed files, build/runtime/design findings and limitations. Do not stop at input preparation unless requested or blocked. Independent review can make this module ready for user review, but cannot grant aesthetic approval, original-host mutation, full-brand certification or fullWorkflowPass.',
      },
    },
  };
}
