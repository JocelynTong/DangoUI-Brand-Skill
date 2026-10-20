import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');

// Learning-side source packaging, never invoked during design-host inference.
// Only use an isolated, unpublished learning revision. No package code executes.
export function prepareLearningOriginals(directory,packageDirectory) {
  const dir=fs.realpathSync(directory),pkg=fs.realpathSync(packageDirectory),modFile=path.join(dir,'brand-mod.json');
  if(fs.existsSync(path.join(dir,'learned-brand-input.json')))throw Error('Prepare a new isolated learning revision before attaching originals.');
  const mod=read(modFile),manifest=read(path.join(pkg,'package.json'));
  const guideSourceFile=path.join(dir,'DESIGN.sources.json');
  const guideSources=fs.existsSync(guideSourceFile)?read(guideSourceFile):null;
  for(const source of guideSources?.sources||[])if(sha(fs.readFileSync(path.join(dir,path.basename(source.path))))!==source.sha256)throw Error('Existing guide source changed before component attachment');
  if(manifest.name!=='dangoui'||!manifest.version)throw Error('Expected a versioned DangoUI source package');
  const queue=['src/button/Button.vue','src/button/style.scss','src/search/Search.vue','src/search/Search.scss','dist/theme.css','dist/style.css','package.json','LICENSE'];
  const seen=new Set(),external=new Set();
  const resolve=relative=>{
    const options=[relative,...['.vue','.ts','.js','.mjs','.json','.scss','.css'].map(ext=>relative+ext),'index.ts'].map(x=>x==='index.ts'?path.join(relative,x):x);
    const found=options.find(x=>fs.existsSync(path.join(pkg,x))&&fs.statSync(path.join(pkg,x)).isFile());
    if(!found)throw Error(`Missing component dependency: ${relative}`);
    const real=fs.realpathSync(path.join(pkg,found));if(!real.startsWith(pkg+path.sep))throw Error('Component dependency escaped package');
    return path.relative(pkg,real);
  };
  const files=[];
  while(queue.length) {
    const relative=resolve(queue.shift());if(seen.has(relative))continue;seen.add(relative);
    const bytes=fs.readFileSync(path.join(pkg,relative));
    const targetRelative=path.posix.join('component-originals/dangoui',relative.split(path.sep).join('/'));
    const target=path.join(dir,targetRelative);fs.mkdirSync(path.dirname(target),{recursive:true});
    if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==sha(bytes))throw Error('Existing component original differs');
    fs.writeFileSync(target,bytes);
    files.push({path:`migrations/${path.basename(dir)}/${targetRelative}`,sha256:sha(bytes)});
    if(/\.(vue|ts|js|mjs|scss)$/.test(relative)) {
      const text=bytes.toString('utf8');
      const refs=[...text.matchAll(/(?:from\s+|\bimport\s+|@use\s+|@import\s+)["']([^"']+)["']/g),...text.matchAll(/<style\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]);
      for(const ref of refs)if(ref.startsWith('.'))queue.push(path.normalize(path.join(path.dirname(relative),ref)));else external.add(ref);
    }
  }
  const id=`dangoui-button-search-${manifest.version}`;
  if(mod.componentSources?.some(source=>source.id===id))throw Error('Component source group already exists; do not overwrite its provenance.');
  mod.componentSources=[...(mod.componentSources||[]),{id,package:'dangoui',version:manifest.version,scope:'Original Button/Search and local import dependencies for source inspection. Vue dependency; not a standalone runtime kit, React/Taro port or host approval.',externalDependencies:[...external].sort(),files:files.sort((a,b)=>a.path.localeCompare(b.path))}];
  write(modFile,mod);
  const names=['brand-mod.json','brand-intent.json','brand-evidence.json','component-mapping.json','dangoui-adapter.json'];
  const sources=names.map(name=>({path:name,sha256:sha(fs.readFileSync(path.join(dir,name)))}));
  if(guideSources)write(guideSourceFile,{...guideSources,componentAttachment:'Only componentSources attached to MOD; visual data and original scope unchanged.',sources:guideSources.sources.map(source=>({...source,preComponentAttachmentSha256:source.sha256,sha256:sources.find(x=>x.path===path.basename(source.path))?.sha256||source.sha256}))});
  const intent=read(path.join(dir,'brand-intent.json'));
  const sections={Scope:mod.manifest?.scope,'Identity and expressive':{imageIdentityPolicy:intent.imageIdentityPolicy,brandThesis:intent.brandThesis,invariants:intent.invariants,assetUsage:intent.assetUsage},Typography:intent.typography,'Color roles':intent.colorRoles,'Motion and interaction':intent.motionAndInteraction,'Unresolved and evidence boundary':{status:intent.status,evidenceBoundary:intent.evidenceBoundary,unresolvedClaims:intent.unresolvedClaims},'DTCG original values':mod.tokens?.dtcg,'Semantic roles':mod.semanticRoles,'Scoped recipes':mod.styleRecipes,'DangoUI mapping':read(path.join(dir,'component-mapping.json')),'DangoUI adapter':read(path.join(dir,'dangoui-adapter.json')),'Original components':mod.componentSources};
  const guide=`# ${mod.manifest?.displayName||mod.manifest?.brand} — ${mod.manifest.version}\n\nVersion-matched mechanical guide of the bound learning files. No new website observation, Google/Stitch run, scope expansion or approval. Source values, exceptions and unresolved claims are authoritative; original files remain available. Component source availability does not certify runtime behavior or cross-framework compatibility.\n\n`+Object.entries(sections).filter(([,v])=>v!==undefined).map(([name,value])=>`## ${name}\n\n\`\`\`json\n${JSON.stringify(value,null,2)}\n\`\`\`\n`).join('\n');
  // Existing guide is an input, not disposable; callers choose whether missing.
  if(!fs.readdirSync(dir).some(name=>name==='DESIGN.md'||name==='design.md')) {
    fs.writeFileSync(path.join(dir,'DESIGN.md'),guide,{flag:'wx'});
    write(path.join(dir,'DESIGN.sources.json'),{method:'mechanical learning-data projection; no new semantic conclusions',version:mod.manifest.version,sources});
  }
  return {version:mod.manifest.version,componentFiles:files.length,externalDependencies:[...external].sort()};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareLearningOriginals(process.argv[2],process.argv[3])));
