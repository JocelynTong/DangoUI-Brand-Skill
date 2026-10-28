import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.dirname(new URL(import.meta.url).pathname);
const read=p=>fs.readFileSync(root+'/'+p);
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const mod=JSON.parse(read('brand-mod.json'));
for(const file of mod.componentKits.flatMap(k=>k.files)){
 if(path.isAbsolute(file.path)||file.path.split('/').includes('..'))throw Error('Unsafe path '+file.path);
 if(hash(file.path)!==file.sha256)throw Error('Hash mismatch '+file.path);
}
for(const asset of JSON.parse(read('assets.json')))if(hash(asset.path)!==asset.sha256)throw Error('Asset mismatch '+asset.path);
const css=read('theme.css').toString();
const tokens=JSON.parse(read('tokens.dtcg.json'));
for(const token of Object.values(tokens))if(!css.includes(token.$extensions['echo.brand.target']+':'))throw Error('Missing CSS target');
for(const m of read('demo.html').toString().matchAll(/(?:src|href)="([^"]+)"/g))if(!m[1].startsWith('#')&&!fs.existsSync(root+'/'+m[1]))throw Error('Missing demo file '+m[1]);
console.log('PASS: component manifest, asset hashes, token targets and demo references. This does not certify brand fidelity or runtime behavior.');
