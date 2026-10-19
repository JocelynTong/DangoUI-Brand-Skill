import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Explicit learning delivery wins over filename heuristics. Declared missing
// originals are errors, never a reason to silently select different pictures.
export function declaredImageReferences(mod, root) {
  if(mod.imageReferences === undefined)return null;
  const items=mod.imageReferences;
  if(!Array.isArray(items)||!items.length||items.length>5)throw Error('Brand imageReferences must contain 1–5 declared originals.');
  const base=fs.realpathSync(root),seen=new Set();
  const result=items.map(item=>{
    if(!item||typeof item.path!=='string'||!['official-page-design-language','official-asset-reference'].includes(item.role))throw Error('Invalid brand image reference.');
    const file=path.resolve(root,item.path),real=fs.realpathSync(file);
    if(!real.startsWith(base+path.sep)||seen.has(real))throw Error('Brand image reference escapes root or is duplicated.');
    seen.add(real);
    const digest=crypto.createHash('sha256').update(fs.readFileSync(real)).digest('hex');
    if(digest!==item.sha256)throw Error('Brand image reference hash mismatch.');
    let sourceOriginal;
    if(item.sourceOriginal!==undefined){
      const original=item.sourceOriginal;
      if(!original||typeof original.path!=='string'||!/^[a-f0-9]{64}$/.test(original.sha256||''))throw Error('Invalid brand image source original binding.');
      const sourceFile=path.resolve(root,original.path);
      if(!fs.existsSync(sourceFile))throw Error('Brand image source original is missing: '+original.path);
      const sourceReal=fs.realpathSync(sourceFile);
      if(!sourceReal.startsWith(base+path.sep)||!fs.statSync(sourceReal).isFile())throw Error('Brand image source original escapes root or is not a file.');
      const sourceDigest=crypto.createHash('sha256').update(fs.readFileSync(sourceReal)).digest('hex');
      if(sourceDigest!==original.sha256)throw Error('Brand image source original hash mismatch.');
      // Provenance remains separate from the selected image list: validating a
      // larger original does not authorize attaching it to generation.
      sourceOriginal={...original,path:sourceFile,sha256:sourceDigest};
    }
    return {path:file,sha256:digest,role:item.role,scope:item.scope,completePage:item.completePage===true,...(sourceOriginal?{sourceOriginal}:{})};
  });
  if(!result.some(item=>item.role==='official-page-design-language'&&item.completePage))throw Error('Declared references require a complete-page overview.');
  return result;
}
