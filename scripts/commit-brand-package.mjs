import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function inventory(root,prefix='') {
  return fs.readdirSync(path.join(root,prefix)).sort().flatMap(name=>{
    const relative=path.join(prefix,name),file=path.join(root,relative),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink())throw Error('PACKAGE_SYMLINK_NOT_ALLOWED');
    return stat.isDirectory()?inventory(root,relative):[[relative,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]];
  });
}

// Build in a sibling staging directory; a rejected revision never touches
// an already distributed version. Identical rebuilds are safe no-ops.
export function commitBrandPackage(staging,target) {
  if(fs.existsSync(target)) {
    if(JSON.stringify(inventory(staging))!==JSON.stringify(inventory(target)))throw Error('PUBLISHED_VERSION_CHANGED: choose a new version; existing package retained unchanged.');
    return;
  }
  fs.renameSync(staging,target);
}
