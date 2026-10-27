import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { lexicalTokens } from './module-config-literals.mjs';

// Explicit, hash-bound runtime files only. Historical evidence is not a code dependency.
export function installComponentKits({ sourceRoot, destinationRoot, kits = [], validateOnly = false }) {
  const inside = (root, target) => {
    const rel = path.relative(root, target);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  const source = fs.realpathSync(sourceRoot);
  const destination = fs.realpathSync(destinationRoot);
  const pending = new Map();
  for (const kit of kits) {
    if (!kit.id || !Array.isArray(kit.files) || !kit.files.length) throw new Error('COMPONENT_KIT_INVALID');
    const declared = new Set(kit.files.map(file => file.path));
    const vueSfc = ['taro', 'browser-dom'].includes(kit.runtime) && kit.framework === 'vue3';
    const inlineSfc = vueSfc && kit.entry?.endsWith('.vue') && kit.stylesheet === undefined;
    if (!declared.has(kit.entry) || (!inlineSfc && !declared.has(kit.stylesheet))) throw new Error('COMPONENT_KIT_ENTRY_UNDECLARED');
    if (kit.designGuide !== undefined && (!declared.has(kit.designGuide) || !kit.designGuide.endsWith('.md'))) throw new Error('COMPONENT_KIT_GUIDE_UNDECLARED');
    for (const file of kit.files) {
      if (typeof file.path !== 'string' || path.isAbsolute(file.path) || file.path.includes('\\') || file.path.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('COMPONENT_KIT_PATH_INVALID');
      if (!/\.(?:mjs|js|css|json|png|jpe?g|webp|svg|woff2?|ttf)$/.test(file.path) && file.path !== kit.designGuide && !(vueSfc && file.path.endsWith('.vue'))) throw new Error('COMPONENT_KIT_FILE_TYPE_INVALID');
      const from = path.resolve(source, file.path), to = path.resolve(destination, file.path);
      if (!inside(source, from) || !inside(destination, to) || !fs.existsSync(from) || !inside(source, fs.realpathSync(from)) || !fs.statSync(from).isFile()) throw new Error(`COMPONENT_KIT_FILE_MISSING_OR_UNSAFE:${file.path}`);
      let parent = path.dirname(to);
      while (!fs.existsSync(parent)) parent = path.dirname(parent);
      const realParent = fs.realpathSync(parent);
      if (realParent !== destination && !inside(destination, realParent)) throw new Error('COMPONENT_KIT_DESTINATION_UNSAFE');
      if (fs.existsSync(to) && fs.lstatSync(to).isSymbolicLink()) throw new Error('COMPONENT_KIT_DESTINATION_UNSAFE');
      const bytes = fs.readFileSync(from);
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (hash !== file.sha256) throw new Error(`COMPONENT_KIT_HASH_MISMATCH:${file.path}`);
      if (pending.has(to) && !pending.get(to).equals(bytes)) throw new Error('COMPONENT_KIT_CONFLICT');
      if (fs.existsSync(to) && !fs.readFileSync(to).equals(bytes)) throw new Error(`COMPONENT_KIT_DESTINATION_CONFLICT:${file.path}`);
      pending.set(to, bytes);
    }
    validateStaticDependencies(kit, source);
  }
  // Validate every declaration before writing any runtime file. Never execute copied code.
  for (const [to, bytes] of validateOnly ? [] : pending) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (!fs.existsSync(to)) fs.writeFileSync(to, bytes, { flag: 'wx' });
  }
  return { kits: kits.map(kit => kit.id), copiedOrVerifiedFiles: pending.size };
}

// Validate installed bytes before describing them to a consumer. Same-root
// validation writes nothing: every declared file must already exist unchanged.
export function componentKitHandoff({ root, kits = [] }) {
  installComponentKits({sourceRoot: root, destinationRoot: root, kits});
  return kits.map(kit => ({
    id: kit.id, status: kit.status || 'unspecified', framework: kit.framework,
    runtime: kit.runtime, peerDependencies: kit.peerDependencies, dependencies: kit.dependencies,
    targets: kit.targets, verifiedTargets: kit.verifiedTargets,
    entry: kit.entry, stylesheet: kit.stylesheet, designGuide: kit.designGuide,
    usage: kit.usage, scope: kit.scope,
    files: kit.files.map(({path, sha256}) => ({path, sha256})),
  }));
}

// Only statically named imports are checked here; this is packaging validation,
// not code execution or a claim that the declared framework/platform was tested.
function validateStaticDependencies(kit, source) {
  const declared = new Set(kit.files.map(file => file.path));
  const dependencies = new Set([
    ...Object.keys(kit.peerDependencies || {}),
    ...(Array.isArray(kit.dependencies) ? kit.dependencies : Object.keys(kit.dependencies || {})),
  ]);
  for (const {path: file} of kit.files) {
    if (!/\.(?:m?js|vue|css)$/.test(file)) continue;
    const text = fs.readFileSync(path.resolve(source, file), 'utf8');
    const refs = [];
    if (!file.endsWith('.css')) {
      const script = file.endsWith('.vue') ? [...text.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match=>match[1]).join('\n;\n') : text;
      const tokens = lexicalTokens(script);
      for (let i=0;i<tokens.length;i++) {
        if (tokens[i].kind !== 'word' || !['import','export','require'].includes(tokens[i].value) || tokens[i-1]?.value === '.') continue;
        if (tokens[i].value === 'import' && tokens[i+1]?.kind === 'string') refs.push({value:tokens[i+1].value,module:true});
        else if (tokens[i+1]?.value === '(' && tokens[i+2]?.kind === 'string' && tokens[i+3]?.value === ')') refs.push({value:tokens[i+2].value,module:true});
        else if (['import','export'].includes(tokens[i].value) && tokens[i+1]?.value !== '.') {
          for (let j=i+1;j<tokens.length && tokens[j].value !== ';';j++) {
            if (tokens[j].kind === 'word' && tokens[j].value === 'from' && tokens[j+1]?.kind === 'string') {refs.push({value:tokens[j+1].value,module:true}); break;}
          }
        }
      }
      if (file.endsWith('.vue')) for (const match of text.matchAll(/<(?:script|style)\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/g)) refs.push({value:match[1], module:true});
    }
    if (/\.(?:vue|css)$/.test(file)) {
      const css = (file.endsWith('.vue') ? [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match=>match[1]).join('\n') : text).replace(/\/\*[\s\S]*?\*\//g,'');
      for (const match of css.matchAll(/\burl\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)) refs.push({value:match[1] || match[2], module:false});
    }
    for (const {value, module} of refs) {
      if (/^(?:data:|https?:|#)/.test(value)) continue;
      const clean = value.split(/[?#]/)[0];
      if (clean.startsWith('/') || clean.includes('\\')) throw new Error(`COMPONENT_KIT_NONPORTABLE_REFERENCE:${file}:${value}`);
      if (module && !clean.startsWith('.')) {
        const name = clean.startsWith('@') ? clean.split('/').slice(0,2).join('/') : clean.split('/')[0];
        if (!dependencies.has(name)) throw new Error(`COMPONENT_KIT_DEPENDENCY_UNDECLARED:${file}:${name}`);
        continue;
      }
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
      const candidates = [resolved, ...['.mjs','.js','.vue','.json','/index.mjs','/index.js'].map(ext => resolved+ext)];
      if (!candidates.some(ref => declared.has(ref))) throw new Error(`COMPONENT_KIT_IMPORT_UNDECLARED:${file}:${value}`);
    }
  }
}
