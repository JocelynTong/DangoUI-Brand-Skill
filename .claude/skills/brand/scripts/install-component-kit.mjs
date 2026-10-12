import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Explicit, hash-bound runtime files only. Historical evidence is not a code dependency.
export function installComponentKits({ sourceRoot, destinationRoot, kits = [] }) {
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
    const inlineSfc = kit.runtime === 'taro' && kit.framework === 'vue3' && kit.entry?.endsWith('.vue') && kit.stylesheet === undefined;
    if (!declared.has(kit.entry) || (!inlineSfc && !declared.has(kit.stylesheet))) throw new Error('COMPONENT_KIT_ENTRY_UNDECLARED');
    if (kit.designGuide !== undefined && (!declared.has(kit.designGuide) || !kit.designGuide.endsWith('.md'))) throw new Error('COMPONENT_KIT_GUIDE_UNDECLARED');
    for (const file of kit.files) {
      if (typeof file.path !== 'string' || path.isAbsolute(file.path) || file.path.includes('\\') || file.path.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('COMPONENT_KIT_PATH_INVALID');
      if (!/\.(?:mjs|js|css|json|png|jpe?g|webp|svg|woff2?|ttf)$/.test(file.path) && file.path !== kit.designGuide && !(kit.runtime === 'taro' && kit.framework === 'vue3' && file.path.endsWith('.vue'))) throw new Error('COMPONENT_KIT_FILE_TYPE_INVALID');
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
  }
  // Validate every declaration before writing any runtime file. Never execute copied code.
  for (const [to, bytes] of pending) {
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
    runtime: kit.runtime, peerDependencies: kit.peerDependencies,
    entry: kit.entry, stylesheet: kit.stylesheet, designGuide: kit.designGuide,
    usage: kit.usage, scope: kit.scope,
    files: kit.files.map(({path, sha256}) => ({path, sha256})),
  }));
}
