import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const names=['brand-mod.json','brand-intent.json','brand-evidence.json','component-mapping.json','dangoui-adapter.json'];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const fail=message=>{throw Error(message);};

// Validate the actual recorded tool prompt, not a producer's later explanation.
// This gate does not delete checkpoints or suppress their unverified previews.
export function verifyLearnedPrompt(prompt,bound) {
  if(!bound)return;
  const bytes=fs.readFileSync(bound.path);
  if(sha(bytes)!==bound.sha256)fail('LEARNED_INPUT_BINDING_CHANGED');
  const packet=JSON.parse(bytes);
  const block=`<learned-brand-input>\n${packet.promptText}\n</learned-brand-input>`;
  if(!prompt.includes(block))fail('LEARNED_INPUT_NOT_USED: actual tool prompt differs from frozen brand input; preserve preview, do not certify input fidelity.');
}

// Learning-side compilation only. No website fetch, inference or host input.
// The complete source documents remain bound; this never upgrades their status.
export function compileLearnedBrandInput(directory) {
  const dir=fs.realpathSync(directory);
  const sources=names.map(name=>{
    const file=path.join(dir,name);
    if(!fs.existsSync(file))fail(`LEARNING_SOURCE_MISSING: ${name}`);
    if(!fs.realpathSync(file).startsWith(dir+path.sep))fail(`LEARNING_SOURCE_OUTSIDE_PACKAGE: ${name}`);
    return {path:name,sha256:sha(fs.readFileSync(file))};
  });
  const mod=read(path.join(dir,'brand-mod.json')),intent=read(path.join(dir,'brand-intent.json'));
  if(!mod.manifest?.version||!mod.tokens?.dtcg)fail('LEARNING_VERSION_AND_DTCG_REQUIRED');
  for(const group of [...(mod.componentSources||[]),...(mod.componentKits||[])])for(const ref of group.files||[]) {
    const relative=ref.path.replace(/^migrations\/[^/]+\//,'');
    const file=path.resolve(dir,relative);
    if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||!fs.realpathSync(file).startsWith(dir+path.sep))fail('COMPONENT_SOURCE_OUTSIDE_OR_MISSING');
    if(!ref.sha256||sha(fs.readFileSync(file))!==ref.sha256)fail('COMPONENT_SOURCE_HASH_MISMATCH');
    if(!sources.some(x=>x.path===relative))sources.push({path:relative,sha256:ref.sha256});
  }
  // On case-insensitive hosts existsSync would falsely bind the same guide twice.
  const directoryNames=new Set(fs.readdirSync(dir));
  const guides=['DESIGN.md','design.md'].filter(name=>directoryNames.has(name));
  for(const name of guides){
    if(!fs.realpathSync(path.join(dir,name)).startsWith(dir+path.sep))fail('LEARNING_GUIDE_OUTSIDE_PACKAGE');
    sources.push({path:name,sha256:sha(fs.readFileSync(path.join(dir,name)))});
  }
  const guideSources=path.join(dir,'DESIGN.sources.json');
  if(fs.existsSync(guideSources)) {
    if(!fs.realpathSync(guideSources).startsWith(dir+path.sep))fail('LEARNING_GUIDE_SOURCES_OUTSIDE_PACKAGE');
    const provenance=read(guideSources);
    for(const ref of provenance.sources||[]) {
      const name=path.basename(ref.path);
      if(!sources.some(source=>source.path===name&&source.sha256===ref.sha256))fail(`LEARNING_GUIDE_SOURCE_MISMATCH: ${name}`);
    }
    sources.push({path:'DESIGN.sources.json',sha256:sha(fs.readFileSync(guideSources))});
  }
  // Retain all intent fields, including exceptions and unresolved claims. Do not
  // turn a compact projection into a new interpretation of approved learning.
  const visual={scope:mod.manifest.scope,intent,dtcg:mod.tokens.dtcg};
  const promptText=JSON.stringify(visual);
  return {schema:'learned-brand-input/v1',brand:mod.manifest.brand,version:mod.manifest.version,
    sources,sourceDigest:sha(JSON.stringify(sources)),promptText,promptSha256:sha(promptText),
    promptScope:'Existing learned intent and DTCG, unchanged; mapping and evidence originals remain source inputs for designer and QA. This is not a new learning approval.',
    gaps:[...(!guides.length?[{code:'DESIGN_MD_NOT_BOUND',owner:'learn-brand'}]:[]),
      ...(!mod.componentKits?.length?[{code:mod.componentSources?.length?'COMPONENT_RUNTIME_NOT_CERTIFIED':'COMPONENT_IMPLEMENTATION_NOT_DECLARED',owner:'learn-brand',impact:mod.componentSources?.length?'Original component sources are bound; framework adaptation and runtime use remain unverified.':'Mapping is available; executable component reuse is not certified by this packet.'}]:[])],
    learningStatus:intent.status||'unknown',hostIndependent:true};
}

export function writeLearnedBrandInput(directory,{supersede=false}={}) {
  const packet=compileLearnedBrandInput(directory),file=path.join(directory,'learned-brand-input.json');
  const changed=fs.existsSync(file)&&JSON.stringify(read(file))!==JSON.stringify(packet);
  if(changed) {
    const prior=read(file),archive=path.join(directory,'learning-revisions',prior.sourceDigest,'learned-brand-input.json');
    if(!supersede||!fs.existsSync(archive)||JSON.stringify(read(archive))!==JSON.stringify(prior))fail('LEARNED_INPUT_CHANGED: publish a new learning revision; do not overwrite without preserved source originals.');
  }
  const revision=path.join(directory,'learning-revisions',packet.sourceDigest);
  fs.mkdirSync(revision,{recursive:true});
  for(const source of packet.sources) {
    const target=path.join(revision,source.path),bytes=fs.readFileSync(path.join(directory,source.path));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    if(fs.existsSync(target)) {if(sha(fs.readFileSync(target))!==source.sha256)fail('LEARNING_REVISION_CORRUPTED');}
    else fs.writeFileSync(target,bytes,{flag:'wx'});
  }
  const snapshot=path.join(revision,'learned-brand-input.json'),bytes=JSON.stringify(packet,null,2)+'\n';
  if(!fs.existsSync(snapshot))fs.writeFileSync(snapshot,bytes,{flag:'wx'});
  else if(fs.readFileSync(snapshot,'utf8')!==bytes)fail('LEARNING_REVISION_CORRUPTED');
  if(fs.existsSync(file)){
    if(changed) {
      const temporary=file+'.'+crypto.randomUUID()+'.tmp';
      fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,file);
    }
  }else fs.writeFileSync(file,bytes,{flag:'wx'});
  return {path:file,sha256:sha(fs.readFileSync(file)),...packet};
}

export function consumeLearnedBrandInput(directory) {
  const file=path.join(directory,'learned-brand-input.json');
  if(!fs.existsSync(file))return null;
  const stored=read(file),current=compileLearnedBrandInput(directory);
  if(JSON.stringify(stored)!==JSON.stringify(current))fail('LEARNED_INPUT_STALE: return changed brand sources to learn-brand; do not reinterpret in design-host.');
  return {path:file,sha256:sha(fs.readFileSync(file)),...stored};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv[2])fail('Usage: learned-brand-input.mjs <learning output directory>');
  const result=writeLearnedBrandInput(process.argv[2]);
  console.log(JSON.stringify({path:result.path,sha256:result.sha256,brand:result.brand,version:result.version,promptCharacters:result.promptText.length,gaps:result.gaps}));
}
