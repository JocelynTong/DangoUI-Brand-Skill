import fs from 'node:fs';
import path from 'node:path';
import { installComponentKits } from './install-component-kit.mjs';

const inside = (root, file) => { const rel = path.relative(root, file); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

// Used by the existing public --mod-file route. Supports a standalone package
// directory and the historical <root>/migrations/<brand>/ layout.
export function installLocalStylePack({ modFile, destinationRoot, destinationMigration, brand }) {
  const sourceMod = path.resolve(modFile);
  if (!fs.existsSync(sourceMod) || !fs.statSync(sourceMod).isFile()) throw new Error('LOCAL_STYLE_PACK_MOD_MISSING');
  const sourceMigration = fs.realpathSync(path.dirname(sourceMod));
  const mod = read(sourceMod);
  const identity = mod.manifest?.brand || mod.manifest?.id;
  if (identity && identity !== brand) throw new Error('LOCAL_STYLE_PACK_BRAND_MISMATCH');
  if (mod.manifest?.brand && mod.manifest?.id && mod.manifest.brand !== mod.manifest.id) throw new Error('LOCAL_STYLE_PACK_BRAND_MISMATCH');
  const kits = mod.componentKits || [];
  const kitPaths = kits.flatMap(kit => (kit.files || []).map(file => file.path));
  const localLayout = kitPaths.length > 0 && kitPaths.every(file => typeof file === 'string' && fs.existsSync(path.resolve(sourceMigration, file)));
  const sourceRoot = localLayout || path.basename(path.dirname(sourceMigration)) !== 'migrations'
    ? sourceMigration : path.resolve(sourceMigration, '..', '..');
  const destination = fs.realpathSync(destinationRoot);
  const migrationRelative = path.relative(path.resolve(destinationRoot), path.resolve(destinationMigration));
  const migration = path.resolve(destination, migrationRelative);
  if (!inside(destination, migration)) throw new Error('LOCAL_STYLE_PACK_DESTINATION_UNSAFE');
  installComponentKits({sourceRoot, destinationRoot:destination, kits, validateOnly:true});
  const pending = new Map();
  const queue = (from, to, boundary) => {
    if (!inside(boundary, fs.realpathSync(from)) || !inside(destination, to)) throw new Error('LOCAL_STYLE_PACK_PATH_UNSAFE');
    let parent = path.dirname(to);
    while (!fs.existsSync(parent)) parent = path.dirname(parent);
    if (!inside(destination, fs.realpathSync(parent)) || (fs.existsSync(to) && fs.lstatSync(to).isSymbolicLink())) throw new Error('LOCAL_STYLE_PACK_DESTINATION_UNSAFE');
    const bytes = fs.readFileSync(from);
    if ((pending.has(to) && !pending.get(to).equals(bytes)) || (fs.existsSync(to) && !fs.readFileSync(to).equals(bytes))) throw new Error(`LOCAL_STYLE_PACK_DESTINATION_CONFLICT:${path.relative(destination,to)}`);
    pending.set(to, bytes);
  };
  const names = ['brand-mod.json','brand-profile.dtcg.json','brand-evidence.json','brand-intent.json','approved-visual-patterns.json','component-mapping.json','dangoui-adapter.json'];
  const references = new Set();
  for (const name of names) {
    const file = name === 'brand-mod.json' ? sourceMod : path.join(sourceMigration,name);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    queue(file, path.join(migration,name), sourceMigration);
    collectReferences(read(file), references);
  }
  for (const reference of references) {
    if (/^(?:https?:|data:)/.test(reference)) continue;
    if (path.isAbsolute(reference) || reference.includes('\\')) throw new Error(`LOCAL_STYLE_PACK_NONPORTABLE_REFERENCE:${reference}`);
    const normalized = reference.replace(/^\.\//,'');
    const candidates = [
      {from:path.resolve(sourceRoot,normalized),to:path.resolve(destination,normalized),boundary:sourceRoot},
      {from:path.resolve(sourceMigration,normalized),to:path.resolve(migration,normalized),boundary:sourceMigration},
    ];
    const match = candidates.find(item => inside(item.boundary,item.from) && fs.existsSync(item.from) && fs.statSync(item.from).isFile());
    if (!match) throw new Error(`LOCAL_STYLE_PACK_REFERENCE_MISSING:${reference}`);
    queue(match.from, match.to, match.boundary);
  }
  // All package inputs and existing destination bytes are checked before copy.
  const kitResult = installComponentKits({sourceRoot,destinationRoot:destination,kits});
  for (const [to,bytes] of pending) {
    fs.mkdirSync(path.dirname(to), {recursive:true});
    if (!fs.existsSync(to)) fs.writeFileSync(to,bytes,{flag:'wx'});
  }
  return {status:'installed-awaiting-runtime-validation', sourceRoot, ...kitResult, artifacts: [...pending.keys()].map(file=>path.relative(destination,file)), runtimeVerified:false, learningComplete:false};
}

function collectReferences(value, found) {
  if (typeof value === 'string') {
    const clean = value.split('#')[0];
    if (/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(clean)) found.add(clean);
  } else if (Array.isArray(value)) value.forEach(item=>collectReferences(item,found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item=>collectReferences(item,found));
}
