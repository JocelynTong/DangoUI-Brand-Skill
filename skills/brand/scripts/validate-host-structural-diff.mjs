#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const argv=process.argv.slice(2), val=f=>{const i=argv.indexOf(f);return i<0?undefined:argv[i+1]}, has=f=>argv.includes(f);
let parseSfc,baseParse,NodeTypes,parseJs;
if(!has("verify-preedit")){
 ({parse:parseSfc}=await import("@vue/compiler-sfc"));
 ({baseParse,NodeTypes}=await import("@vue/compiler-dom"));
 ({parse:parseJs}=await import("@babel/parser"));
}
const die=(code,message,extra={})=>{console.error(JSON.stringify({ok:false,gate:"host-structural-diff/v1",failures:[{code,message,...extra}]},null,2));process.exit(2)};
const readJson=p=>JSON.parse(fs.readFileSync(path.resolve(p),"utf8"));
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const stable=x=>JSON.stringify(x,Object.keys(x||{}).sort());
const cleanAst=x=>{if(Array.isArray(x))return x.map(cleanAst);if(!x||typeof x!=="object")return x;const out={};for(const [k,v] of Object.entries(x)){if(["start","end","loc","extra","errors","comments","tokens"].includes(k))continue;out[k]=cleanAst(v)}return out};
const isCssImport=n=>n.type==="ImportDeclaration"&&/\.(css|scss|sass|less|styl)(\?|$)/.test(n.source?.value||"");
function scriptDigest(code,lang="js") { const ast=parseJs(code||"",{sourceType:"module",plugins:["typescript","jsx","decorators-legacy","topLevelAwait"]});ast.program.body=ast.program.body.filter(n=>!isCssImport(n));return sha(JSON.stringify(cleanAst(ast.program))); }
const expr=d=>d.exp?.content??null;
function templateModel(source){const ast=baseParse(source||"");let seq=0;const nodes=[];function walk(n,parent="root"){if(n.type===NodeTypes.ELEMENT){const id=`n${seq++}`,attrs={},directives={},directiveDetails=[];for(const p of n.props){if(p.type===NodeTypes.ATTRIBUTE)attrs[p.name]=p.value?.content??true;else{const name=`${p.name}${p.arg?.content?`:${p.arg.content}`:""}`,value=expr(p),modifiers=(p.modifiers||[]).map(x=>typeof x==="string"?x:x.content).filter(Boolean);directives[name]=value;directiveDetails.push({name,arg:p.arg?.content||null,modifiers,value})}}const classes=String(attrs.class||"").split(/\s+/).filter(Boolean).sort();delete attrs.class;delete attrs.style;delete directives.bind;delete directives["bind:class"];delete directives["bind:style"];const content=n.children.filter(c=>c.type===NodeTypes.TEXT||c.type===NodeTypes.INTERPOLATION).map(c=>c.type===NodeTypes.TEXT?c.content:`{{${c.content.content}}}`).join("");nodes.push({id,parent,tag:n.tag,tagType:n.tagType,attrs,directives,directiveDetails,content,classes});for(const c of n.children)walk(c,id)}else if(n.children)for(const c of n.children)walk(c,parent)}walk(ast);return nodes}
function snapshot(file){const abs=path.resolve(file),source=fs.readFileSync(abs,"utf8"),{descriptor,errors}=parseSfc(source,{filename:abs});if(errors.length)die("VUE_SFC_PARSE_FAILED",errors.map(String).join("; "),{file:abs});return {schema:"brand-host-structural-snapshot/v1",file:abs,sourceSha256:sha(source),template:templateModel(descriptor.template?.content||""),script:{lang:descriptor.scriptSetup?.lang||descriptor.script?.lang||"js",semanticSha256:scriptDigest([descriptor.script?.content,descriptor.scriptSetup?.content].filter(Boolean).join("\n")),styleImports:[...(descriptor.script?.content||"").matchAll(/import\s+[^'\"]*['\"]([^'\"]+\.(?:css|scss|sass|less|styl)(?:\?[^'\"]*)?)['\"]/g)].map(x=>x[1])},styles:descriptor.styles.map(s=>({scoped:!!s.scoped,module:s.module||false,lang:s.lang||"css",src:s.src||null,contentSha256:sha(s.content)}))};}
function writeJson(file,value){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(path.resolve(file),JSON.stringify(value,null,2)+"\n")}
if(has("prepare-bundle")){
 const targetsPath=val("--targets"),out=val("--out");if(!targetsPath||!out)die("USAGE","prepare-bundle requires --targets and --out");
 const input=readJson(targetsPath),targets=Array.isArray(input)?input:input.targets;if(!Array.isArray(targets)||!targets.length)die("STRUCTURAL_TARGETS_MISSING","Targets must contain at least one route/sourceFile/baselineFile entry.");
 const capturedAt=new Date().toISOString(),entries=[];
 for(const [index,target] of targets.entries()){
  if(!target.route||!target.sourceFile||!target.baselineFile)die("STRUCTURAL_TARGET_INVALID","Every target needs route, sourceFile and baselineFile.",{index});
  const sourceFile=path.resolve(target.sourceFile),baselineFile=path.resolve(target.baselineFile),base=snapshot(sourceFile);writeJson(baselineFile,base);
  entries.push({route:target.route,sourceFile,sourceSha256:base.sourceSha256,baselineFile,baselineSha256:sha(fs.readFileSync(baselineFile)),capturedAt,capturedByRole:"designDirectorOrchestrator"});
 }
 const bundle={schema:"brand-host-preedit-baseline-bundle/v1",capturedAt,capturedByRole:"designDirectorOrchestrator",entries};writeJson(out,bundle);
 console.log(JSON.stringify({ok:true,gate:"host-preedit-baseline/v1",bundle:path.resolve(out),entries:entries.length},null,2));process.exit(0)
}
if(has("verify-preedit")){
 const bundlePath=val("--bundle"),targetsPath=val("--targets"),phase=val("--phase")||"dispatch";if(!bundlePath||!targetsPath||!["dispatch","receipt"].includes(phase))die("USAGE","verify-preedit requires --bundle, --targets and --phase dispatch|receipt");
 const bundle=readJson(bundlePath),failures=[];const fail=(code,message,context={})=>failures.push({code,message,...context});
 if(bundle.schema!=="brand-host-preedit-baseline-bundle/v1")fail("PREEDIT_BASELINE_BUNDLE_INVALID","Bundle schema is invalid.");
 if(bundle.capturedByRole!=="designDirectorOrchestrator")fail("PREEDIT_BASELINE_OWNER_INVALID","Only the orchestrator may prepare the pre-edit bundle; producer-authored baselines are invalid.");
 if(!bundle.capturedAt||Number.isNaN(Date.parse(bundle.capturedAt)))fail("PREEDIT_BASELINE_TIMESTAMP_MISSING","Bundle needs a valid capturedAt timestamp.");
 const entries=Array.isArray(bundle.entries)?bundle.entries:[];if(!entries.length)fail("PREEDIT_BASELINE_TARGET_MISSING","Bundle has no route targets.");
 const targetInput=readJson(targetsPath),approvedTargets=Array.isArray(targetInput)?targetInput:targetInput.targets;
 const approvedKeys=new Set((approvedTargets||[]).map(x=>`${x.route}\u0000${path.resolve(x.sourceFile||"")}`));
 const bundleKeys=new Set(entries.map(x=>`${x.route}\u0000${path.resolve(x.sourceFile||"")}`));
 for(const key of approvedKeys)if(!bundleKeys.has(key))fail("PREEDIT_BASELINE_TARGET_MISSING","An approved route/source target is missing from the baseline bundle.",{target:key.replace("\u0000"," :: ")});
 for(const key of bundleKeys)if(!approvedKeys.has(key))fail("PREEDIT_BASELINE_TARGET_UNAPPROVED","The baseline bundle contains a route/source target absent from the approved target list.",{target:key.replace("\u0000"," :: ")});
 for(const [index,entry] of entries.entries()){
  const ctx={index,route:entry.route||null};for(const field of ["route","sourceFile","sourceSha256","baselineFile","baselineSha256","capturedAt"]){if(!entry[field])fail("PREEDIT_BASELINE_METADATA_MISSING",`Entry is missing ${field}.`,ctx)}
  if(entry.capturedByRole!=="designDirectorOrchestrator")fail("PREEDIT_BASELINE_OWNER_INVALID","Entry was not captured by the orchestrator.",ctx);
  if(entry.baselineFile&&fs.existsSync(entry.baselineFile)){
   const baselineRaw=fs.readFileSync(entry.baselineFile);if(sha(baselineRaw)!==entry.baselineSha256)fail("PREEDIT_BASELINE_ARTIFACT_CHANGED","Baseline artifact hash no longer matches the frozen bundle.",ctx);
   try{const base=JSON.parse(baselineRaw);if(base.file!==path.resolve(entry.sourceFile)||base.sourceSha256!==entry.sourceSha256)fail("PREEDIT_BASELINE_SOURCE_MISMATCH","Baseline source path/hash does not match its bundle entry.",ctx)}catch{fail("PREEDIT_BASELINE_ARTIFACT_INVALID","Baseline artifact is invalid JSON.",ctx)}
  }else fail("PREEDIT_BASELINE_ARTIFACT_MISSING","Baseline artifact is missing.",ctx);
  if(phase==="dispatch"&&entry.sourceFile&&fs.existsSync(entry.sourceFile)&&sha(fs.readFileSync(entry.sourceFile))!==entry.sourceSha256)fail("SOURCE_EDITED_BEFORE_DISPATCH","Source changed after baseline capture and before Implementation dispatch; recapture is forbidden because pre-edit provenance is lost.",ctx);
  else if(entry.sourceFile&&!fs.existsSync(entry.sourceFile))fail("PREEDIT_SOURCE_FILE_MISSING","Source file is missing.",ctx);
 }
 console.log(JSON.stringify({ok:failures.length===0,gate:"host-preedit-baseline/v1",phase,bundle:path.resolve(bundlePath),targets:path.resolve(targetsPath),entries:entries.length,failures},null,2));process.exit(failures.length?2:0)
}
if(has("snapshot")){const file=val("--file"),out=val("--out");if(!file||!out)die("USAGE","snapshot requires --file and --out");fs.writeFileSync(path.resolve(out),JSON.stringify(snapshot(file),null,2)+"\n");console.log(JSON.stringify({ok:true,gate:"host-structural-diff/v1",snapshot:path.resolve(out)},null,2));process.exit(0)}
const baselinePath=val("--baseline"),currentFile=val("--current"),manifestPath=val("--manifest");if(!baselinePath||!currentFile||!manifestPath)die("USAGE","validate requires --baseline, --current and --manifest");
const before=readJson(baselinePath),after=snapshot(currentFile),manifest=readJson(manifestPath),failures=[];const fail=(code,message,context={})=>failures.push({code,message,...context});
if(manifest.schema!=="brand-host-structural-manifest/v1")fail("MANIFEST_SCHEMA_INVALID","Manifest schema must be brand-host-structural-manifest/v1.");
if(before.script?.semanticSha256!==after.script.semanticSha256)fail("BUSINESS_SCRIPT_CHANGED","Non-style script AST changed; routes, APIs, handlers, data/state and component APIs are outside apply-host style-only scope.");
const allowedImports=new Set(manifest.allowedStyleImports||[]);for(const x of after.script.styleImports.filter(x=>!before.script.styleImports.includes(x)))if(!allowedImports.has(x))fail("STYLE_IMPORT_NOT_APPROVED",`Style import ${x} is not approved.`,{import:x});
const b=before.template||[],raw=after.template||[],decor=new Map((manifest.decorativeNodes||[]).map(x=>[x.currentNodeId,x])),subs=new Map((manifest.primitiveSubstitutions||[]).map(x=>[x.baselineNodeId,x])),a11yInput=manifest.accessibilityAugmentations??[],a11yEntries=Array.isArray(a11yInput)?a11yInput:[],a11y=new Map(a11yEntries.map(x=>[x.baselineNodeId,x]));
const staticA11y=new Set(["role","tabindex","aria-label","aria-selected","aria-disabled","aria-pressed","aria-expanded","aria-current","aria-checked","aria-controls","aria-describedby","aria-labelledby"]);
const bindingA11y=new Set(["aria-label","aria-selected","aria-disabled","aria-pressed","aria-expanded","aria-current","aria-checked","aria-controls","aria-describedby","aria-labelledby"]);
const intrinsicInteractive=new Set(["button","a","input","select","textarea","summary"]);
if(!Array.isArray(a11yInput))fail("ACCESSIBILITY_AUGMENTATION_MANIFEST_INVALID","accessibilityAugmentations must be an array.");
else{
 const seen=new Set();for(const entry of a11yEntries){if(!entry?.baselineNodeId||!b.some(x=>x.id===entry.baselineNodeId))fail("ACCESSIBILITY_TARGET_NOT_FOUND","Accessibility augmentation baselineNodeId must resolve to a frozen baseline node.",{baselineNodeId:entry?.baselineNodeId||null});else if(seen.has(entry.baselineNodeId))fail("ACCESSIBILITY_TARGET_DUPLICATED","A baseline node may have only one accessibility augmentation entry.",{baselineNodeId:entry.baselineNodeId});else seen.add(entry.baselineNodeId)}
}
function approvedA11y(x,y){
 const spec=a11y.get(x.id);if(!spec)return {attrs:false,directives:false};
 const context={baselineNodeId:x.id,currentNodeId:y.id};
 if(spec.approved!==true||!spec.reason||!spec.approvalRef){fail("ACCESSIBILITY_AUGMENTATION_NOT_APPROVED","Accessibility augmentation requires approved:true, reason and approvalRef.",context);return {attrs:false,directives:false}}
 const wasInteractive=intrinsicInteractive.has(x.tag)||Object.prototype.hasOwnProperty.call(x.directives||{},"on:tap");
 if(!wasInteractive){fail("ACCESSIBILITY_TARGET_NOT_INTERACTIVE","Accessibility semantics may only augment an existing interactive element or node with @tap.",context);return {attrs:false,directives:false}}
 const declaredAttrs=spec.addedAttributes||{},declaredBindings=spec.addedBindings||{};
 for(const [key,value] of Object.entries(declaredAttrs)){
  if(!staticA11y.has(key))fail("ACCESSIBILITY_ATTRIBUTE_NOT_ALLOWED",`Accessibility augmentation cannot add static attribute ${key}.`,context);
  if(Object.prototype.hasOwnProperty.call(x.attrs||{},key))fail("ACCESSIBILITY_ATTRIBUTE_NOT_ADDITIVE",`Accessibility augmentation cannot change existing attribute ${key}.`,context);
  if(y.attrs?.[key]!==value)fail("ACCESSIBILITY_ATTRIBUTE_DECLARATION_MISMATCH",`Declared static attribute ${key} does not match current template.`,{...context,declared:value,current:y.attrs?.[key]});
 }
 for(const [key,value] of Object.entries(declaredBindings)){
  if(!bindingA11y.has(key))fail("ACCESSIBILITY_BINDING_NOT_ALLOWED",`Accessibility augmentation cannot add binding :${key}.`,context);
  const directive=`bind:${key}`;
  if(Object.prototype.hasOwnProperty.call(x.directives||{},directive))fail("ACCESSIBILITY_BINDING_NOT_ADDITIVE",`Accessibility augmentation cannot change existing binding :${key}.`,context);
  if(y.directives?.[directive]!==value)fail("ACCESSIBILITY_BINDING_DECLARATION_MISMATCH",`Declared binding :${key} does not match current template.`,{...context,declared:value,current:y.directives?.[directive]});
 }
 const attrDiff=[...new Set([...Object.keys(x.attrs||{}),...Object.keys(y.attrs||{})])].filter(k=>x.attrs?.[k]!==y.attrs?.[k]);
 const bindingDiff=[...new Set([...Object.keys(x.directives||{}),...Object.keys(y.directives||{})])].filter(k=>k.startsWith("bind:")&&x.directives?.[k]!==y.directives?.[k]);
 const attrsOk=attrDiff.every(k=>Object.prototype.hasOwnProperty.call(declaredAttrs,k))&&bindingDiff.every(k=>Object.prototype.hasOwnProperty.call(declaredBindings,k.slice(5)));
 const delegation=spec.keydownDelegation;
 let directivesOk=false;
 if(delegation){
  const tap=x.directives?.["on:tap"];
  if(!tap||y.directives?.["on:tap"]!==tap)fail("ACCESSIBILITY_TAP_OUTCOME_MISSING","Keyboard delegation requires an unchanged existing @tap outcome.",context);
  if(delegation.sameOutcomeAs!=="tap")fail("ACCESSIBILITY_KEYDOWN_DELEGATION_INVALID","keydownDelegation.sameOutcomeAs must be tap.",context);
  const expected=(delegation.keys||[]).map(k=>String(k).toLowerCase()).sort();
  if(stable(expected)!==stable(["enter","space"]))fail("ACCESSIBILITY_KEY_SET_INVALID","Keyboard delegation must explicitly cover exactly Enter and Space.",context);
  const details=(y.directiveDetails||[]).filter(d=>d.name==="on:keydown");
  const seen=[];
  for(const d of details){const key=d.modifiers.find(m=>m==="enter"||m==="space"),extras=d.modifiers.filter(m=>m!==key);if(!key||extras.some(m=>m!=="prevent")||d.value!==tap)fail("ACCESSIBILITY_KEYDOWN_HANDLER_INVALID","Only Enter/Space keydown handlers with the exact existing @tap outcome are allowed; the optional prevent modifier is the only extra modifier.",{...context,modifiers:d.modifiers,handler:d.value,tapOutcome:tap});else seen.push(key)}
  if(details.length!==2||seen.length!==2||stable([...new Set(seen)].sort())!==stable(["enter","space"]))fail("ACCESSIBILITY_KEYDOWN_COVERAGE_INVALID","Approved keyboard delegation must implement both Enter and Space exactly once.",context);
  const directiveDiff=[...new Set([...Object.keys(x.directives||{}),...Object.keys(y.directives||{})])].filter(k=>x.directives?.[k]!==y.directives?.[k]&&!k.startsWith("bind:"));
  directivesOk=directiveDiff.length===1&&directiveDiff[0]==="on:keydown";
 }else directivesOk=false;
 return {attrs:attrsOk,directives:directivesOk};
}
const excluded=new Set();for(const [id,d] of decor){const n=raw.find(x=>x.id===id);if(!n||!d.reason||d.interactive!==false||!d.evidenceRef){fail("DECORATIVE_NODE_MANIFEST_INVALID","Decorative node entry must resolve and declare interactive:false, reason and evidenceRef.",{currentNodeId:id});continue}excluded.add(id);let changed=true;while(changed){changed=false;for(const x of raw)if(excluded.has(x.parent)&&!excluded.has(x.id)){excluded.add(x.id);changed=true}}}const a=raw.filter(x=>!excluded.has(x.id));
const max=Math.max(b.length,a.length);for(let i=0;i<max;i++){const x=b[i],y=a[i];if(!x&&y){fail("UNAPPROVED_TEMPLATE_NODE_ADDED","Added template node requires a non-interactive decorativeNodes manifest entry with reason and evidenceRef.",{currentNodeId:y.id,tag:y.tag});continue}if(x&&!y){fail("TEMPLATE_NODE_REMOVED","Host template node was removed.",{baselineNodeId:x.id,tag:x.tag});continue}if(x.tag!==y.tag||x.tagType!==y.tagType){const s=subs.get(x.id);if(!s||s.from!==x.tag||s.to!==y.tag||s.approved!==true||!s.reason||!s.approvalRef)fail("COMPONENT_PRIMITIVE_SUBSTITUTION_UNAPPROVED",`Template primitive ${x.tag} -> ${y.tag} needs explicit approval.`,{baselineNodeId:x.id,currentNodeId:y.id});}
 const a11yApproval=approvedA11y(x,y);
 if(stable(x.attrs)!==stable(y.attrs)&&!a11yApproval.attrs)fail("TEMPLATE_STATIC_CONTENT_OR_API_CHANGED","Non-class/style attributes or static content changed.",{baselineNodeId:x.id,before:x.attrs,after:y.attrs});
 if(x.content!==y.content)fail("TEMPLATE_CONTENT_CHANGED","Static text or interpolation content changed.",{baselineNodeId:x.id,before:x.content,after:y.content});
 if(stable(x.directives)!==stable(y.directives)){for(const key of new Set([...Object.keys(x.directives),...Object.keys(y.directives)])){if(x.directives[key]===y.directives[key])continue;if(key.startsWith("bind:")&&a11yApproval.attrs)continue;if(key==="on:keydown"&&a11yApproval.directives)continue;const code=key==="for"?"LOOP_DATA_SOURCE_CHANGED":key==="if"||key==="else-if"||key==="show"?"CONDITIONAL_RENDERING_CHANGED":key.startsWith("on:")||key==="on"?"EVENT_HANDLER_CHANGED":"COMPONENT_BINDING_API_CHANGED";fail(code,`Template directive ${key} changed.`,{baselineNodeId:x.id,before:x.directives[key],after:y.directives[key]})}}
}
console.log(JSON.stringify({ok:failures.length===0,gate:"host-structural-diff/v1",baseline:path.resolve(baselinePath),current:path.resolve(currentFile),failures},null,2));process.exit(failures.length?1:0);
