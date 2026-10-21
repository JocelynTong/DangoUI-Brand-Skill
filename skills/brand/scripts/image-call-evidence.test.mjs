import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {literalArguments,readImageCall,verifyImageCall,requireRuntimeEvidence,findCurrentThreadImageCall,pendingImageCalls,runtimeEntries,frozenImageCall,nativeImageOutputEvidence} from './image-call-evidence.mjs';

test('inline native emission accepts literals without executing computed programs',()=>{
  assert.deepEqual(literalArguments('generatedImage(await tools.image_gen__imagegen({prompt:"hello",referenced_image_paths:["/a.png"]}));'),{prompt:'hello',referenced_image_paths:['/a.png']});
  for(const source of ['if(true) generatedImage(await tools.image_gen__imagegen({prompt:"x"}));','generatedImage(await tools.image_gen__imagegen(args));','generatedImage(await tools.image_gen__imagegen({prompt:"x"})); other();']) assert.throws(()=>literalArguments(source));
});
import {spawnSync} from 'node:child_process';

test('native output evidence verifies bytes without claiming computed arguments',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-image-evidence-')),old=process.env.CODEX_HOME;
  t.after(()=>{fs.rmSync(dir,{recursive:true,force:true});if(old)process.env.CODEX_HOME=old;else delete process.env.CODEX_HOME;});
  process.env.CODEX_HOME=dir;
  fs.mkdirSync(path.join(dir,'sessions'));
  const file=path.join(dir,'sessions','test.jsonl'),out=path.join(dir,'out.png'),bytes=Buffer.from('unit image bytes');
  fs.writeFileSync(out,bytes);
  const event={type:'event_msg',payload:{type:'item_completed',item:{kind:'image_gen.generation',status:'completed',id:'native-one',result:bytes.toString('base64'),failure:null}}};
  const write=items=>fs.writeFileSync(file,items.map(JSON.stringify).join('\n')+'\n');
  write([event]);
  const evidence=nativeImageOutputEvidence(file,out);
  assert.equal(evidence.automaticArgumentsVerified,false);
  assert.equal(evidence.generationId,'native-one');
  write([{...event,payload:{...event.payload,item:{...event.payload.item,result:'different',savedPath:out}}}]);
  assert.throws(()=>nativeImageOutputEvidence(file,out),/exactly one/);
  write([{...event,payload:{...event.payload,item:{...event.payload.item,status:'failed'}}}]);
  assert.throws(()=>nativeImageOutputEvidence(file,out),/exactly one/);
  write([event,event]);assert.throws(()=>nativeImageOutputEvidence(file,out),/exactly one/);
  write([event]);fs.writeFileSync(out,'tampered');
  assert.throws(()=>nativeImageOutputEvidence(file,out),/exactly one/);
  const external=path.join(dir,'recreated.jsonl');fs.copyFileSync(file,external);
  assert.throws(()=>nativeImageOutputEvidence(external,out),/runtime session store/);
});

test('frozen transport passes exact full data without model transcription and stops on tamper',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'frozen-transport-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'args.json'),args={prompt:'full input '.repeat(3000),referenced_image_paths:['/reference.jpg'],transparent_background:false};
  fs.writeFileSync(file,JSON.stringify(args));
  const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const source=frozenImageCall(file,hash,'checkpoint-fixture');
  assert(source.length<2000);assert.deepEqual(literalArguments(source),args);
  assert.deepEqual(literalArguments(source+'\n'),args);
  assert.deepEqual(literalArguments(source+'\r\n\t '),args);
  assert.throws(()=>literalArguments(source+'\nargs.prompt="changed";'),/wrapper changed/);
  assert.throws(()=>literalArguments(source.replace('imagegen(args)','imagegen({...args,prompt:"changed"})')),/wrapper changed/);
  let calls=0;
  const run=new Function('tools','generatedImage','return (async()=>{'+source+'})()');
  const tools={exec_command:async config=>config.cmd==='checkpoint-fixture'?{session_id:1,output:'{"status":"armed"}'}:(()=>{const r=spawnSync(config.cmd,{shell:true,encoding:'utf8'});return {exit_code:r.status,output:r.stdout};})(),image_gen__imagegen:async actual=>{calls++;assert.deepEqual(actual,args);return {};}};
  await run(tools,()=>{});assert.equal(calls,1);
  fs.appendFileSync(file,' ');
  assert.throws(()=>literalArguments(source),/file changed/);
  await assert.rejects(run(tools,()=>{}),/failed verification/);assert.equal(calls,1);
});

test('static call parser reads actual multiline prompts and attachments without executing code',()=>{
  assert.deepEqual(literalArguments('const r=await tools.image_gen__imagegen({prompt:`one\ntwo`,referenced_image_paths:["/a.png"],transparent_background:false});generatedImage(r);'),{prompt:'one\ntwo',referenced_image_paths:['/a.png'],transparent_background:false});
  for(const expr of ['args','{prompt:process.exit()}','{prompt:`${secret}`}','{prompt:"x",prompt:"y"}']) assert.throws(()=>literalArguments(`tools.image_gen__imagegen(${expr})`));
  for(const source of ['// tools.image_gen__imagegen({prompt:"fake"})','if(false) await tools.image_gen__imagegen({prompt:"fake"})']) assert.throws(()=>literalArguments(source));
  assert.equal(literalArguments('const r = await tools.image_gen__imagegen({prompt:`a\r\nb`});generatedImage(r);').prompt,'a\nb');
});

test('frozen evidence survives relocation only with identical original helper bytes',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'frozen-relocation-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const args={prompt:'unchanged original',referenced_image_paths:[]};
  const file=path.join(dir,'args.json'),reader=path.join(dir,'read-image-arguments.mjs');
  fs.writeFileSync(file,JSON.stringify(args));
  fs.copyFileSync(new URL('./read-image-arguments.mjs',import.meta.url),reader);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const source=frozenImageCall(file,digest,'fixture',reader);
  assert.deepEqual(literalArguments(source+'\n'),args);
  fs.appendFileSync(reader,'// different helper');
  assert.throws(()=>literalArguments(source),/wrapper changed/);
});

test('current-thread discovery follows yielded output, excludes other threads and rejects absent, ambiguous or mismatched evidence',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'image-auto-evidence-')),priorHome=process.env.CODEX_HOME,priorThread=process.env.CODEX_THREAD_ID;
  t.after(()=>{fs.rmSync(dir,{recursive:true,force:true});if(priorHome)process.env.CODEX_HOME=priorHome;else delete process.env.CODEX_HOME;if(priorThread)process.env.CODEX_THREAD_ID=priorThread;else delete process.env.CODEX_THREAD_ID;});
  process.env.CODEX_HOME=dir;const thread=crypto.randomUUID();process.env.CODEX_THREAD_ID=thread;
  const sessions=path.join(dir,'sessions','2026','10','18');fs.mkdirSync(sessions,{recursive:true});
  const output=path.join(dir,'output.png');fs.writeFileSync(output,'synthetic bytes for evidence-only unit test');
  const bytes=fs.readFileSync(output).toString('base64');
  const events=id=>[
    {type:'response_item',timestamp:'2026-10-18T12:00:00Z',payload:{type:'custom_tool_call',name:'exec',call_id:id,input:'const r=await tools.image_gen__imagegen({prompt:"literal"});generatedImage(r);'}},
    {type:'response_item',payload:{type:'custom_tool_call_output',call_id:id,output:`Script running with cell ID cell-${id}`}},
    {type:'response_item',timestamp:'2026-10-18T12:01:00Z',payload:{type:'function_call',name:'wait',call_id:`wait-${id}`,arguments:JSON.stringify({cell_id:`cell-${id}`})}},
    {type:'response_item',payload:{type:'function_call_output',call_id:`wait-${id}`,output:[{image_url:`data:image/png;base64,${bytes}`}]}}
  ];
  const write=(name,meta,items)=>{const file=path.join(sessions,`rollout-${name}.jsonl`);fs.writeFileSync(file,[{type:'session_meta',payload:{id:meta}},...items].map(JSON.stringify).join('\n')+'\n');return file;};
  write(crypto.randomUUID(),'another-thread',events('other'));
  assert.throws(()=>findCurrentThreadImageCall(output),/matched 0/);
  const file=write(thread,thread,events('actual'));
  assert.deepEqual(findCurrentThreadImageCall(output),{callLog:fs.realpathSync(file),callId:'actual'});
  assert.equal(requireRuntimeEvidence(readImageCall(file,'actual'),output).status,'verified-against-tool-call');
  const view=events('view-image');view[0].payload.input='const r = await tools.view_image({path:"saved.png"}); image(r.image_url);';
  write(thread,thread,[...events('actual'),...view]);
  fs.appendFileSync(file,'{"type":"response_item","payload":');
  assert.equal(findCurrentThreadImageCall(output).callId,'actual','Ignore ordinary image viewing and only the unfinished trailing event.');
  assert.equal(readImageCall(file,'actual').args.prompt,'literal');
  fs.appendFileSync(file,'\n');
  assert.throws(()=>findCurrentThreadImageCall(output),SyntaxError,'A complete malformed line cannot be ignored.');
  write(thread,thread,events('actual'));fs.appendFileSync(file,'{broken}\n{}\n');
  assert.throws(()=>findCurrentThreadImageCall(output),SyntaxError,'Middle corruption cannot be ignored.');
  write(thread,thread,[...events('actual'),...events('duplicate-output')]);
  assert.throws(()=>findCurrentThreadImageCall(output),/matched 2/);
  write(thread,'wrong-thread',events('actual'));
  assert.throws(()=>findCurrentThreadImageCall(output),/metadata does not match/);
  write(thread,thread,events('actual'));fs.writeFileSync(output,'different output');
  assert.throws(()=>findCurrentThreadImageCall(output),/matched 0/);
  fs.writeFileSync(output,Buffer.from(bytes,'base64'));
  fs.unlinkSync(file);
  const batch=events('parallel');
  batch[0].payload.input='await Promise.all(load("plans").map(async args=>{const r=await tools.image_gen__imagegen(args);generatedImage(r);}));';
  batch[1].payload.output=[{type:'input_text',text:'Script running with cell ID cell-parallel\nOutput:\n'}];
  const segment=write(`${thread}_${crypto.randomUUID()}`,thread,batch);
  assert.deepEqual(findCurrentThreadImageCall(output),{callLog:fs.realpathSync(segment),callId:'parallel'});
  assert.throws(()=>readImageCall(segment,'parallel'),/direct awaited/);
  const recovered=readImageCall(segment,'parallel',{allowUnverifiedArguments:true});
  assert.equal(recovered.args,undefined);
  assert.equal(requireRuntimeEvidence(recovered,output).status,'output-verified-arguments-unverified');
  write(`${thread}-wrong-suffix`,thread,events('ignored'));
  assert.equal(findCurrentThreadImageCall(output).callId,'parallel');
  delete process.env.CODEX_THREAD_ID;
  assert.throws(()=>findCurrentThreadImageCall(output),/CODEX_THREAD_ID/);
});
test('changed prompt, extra metadata, changed references and fabricated IDs cannot pass',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'image-call-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.jsonl');const args={prompt:'actual prompt',referenced_image_paths:['/original.png'],transparent_background:false};
  fs.writeFileSync(file,JSON.stringify({type:'response_item',timestamp:'2026-10-17T12:00:00Z',payload:{type:'custom_tool_call',name:'exec',call_id:'real',input:`const r=await tools.image_gen__imagegen(${JSON.stringify(args)}); generatedImage(r);`}})+'\n');
  assert.deepEqual(readImageCall(file,'real').args,args);
  assert.equal(verifyImageCall(file,'real',args).evidence.status,'matched-call-record');
  for(const changed of [{...args,prompt:'added requirement '+args.prompt},{...args,reference_fidelity_sentence:'added'},{...args,referenced_image_paths:['/different.png']}]) assert.throws(()=>verifyImageCall(file,'real',changed),/MISMATCH/);
  assert.throws(()=>readImageCall(file,'invented'),/not uniquely/);
  assert.throws(()=>requireRuntimeEvidence(readImageCall(file,'real'),file),/runtime session store/);
});

test('bounded worker discovery excludes prior calls, rejects changed arguments and observes terminal outputs with cached unchanged logs',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'image-worker-unit-')),oldHome=process.env.CODEX_HOME,oldThread=process.env.CODEX_THREAD_ID;
  t.after(()=>{fs.rmSync(dir,{recursive:true,force:true});if(oldHome)process.env.CODEX_HOME=oldHome;else delete process.env.CODEX_HOME;if(oldThread)process.env.CODEX_THREAD_ID=oldThread;else delete process.env.CODEX_THREAD_ID;});
  const thread=crypto.randomUUID();process.env.CODEX_HOME=dir;process.env.CODEX_THREAD_ID=thread;
  fs.mkdirSync(path.join(dir,'sessions'));
  const file=path.join(dir,'sessions',`rollout-${thread}.jsonl`),args={prompt:'unit fixture',referenced_image_paths:['/fixture.png']};
  const append=x=>fs.appendFileSync(file,JSON.stringify(x)+'\n');
  append({type:'session_meta',payload:{id:thread}});
  const call=id=>({type:'response_item',payload:{type:'custom_tool_call',name:'exec',call_id:id,input:`const r=await tools.image_gen__imagegen(${JSON.stringify(args)});generatedImage(r);`}});
  append(call('old'));
  assert.equal(pendingImageCalls(args,new Set(['old'])).length,0);
  const first=runtimeEntries(file);assert.equal(runtimeEntries(file),first,'Unchanged stat reuses parsed entries');
  append(call('new'));
  assert.notEqual(runtimeEntries(file),first,'Append invalidates the cache');
  assert.equal(pendingImageCalls({...args,prompt:'modified'},new Set(['old'])).length,0);
  assert.equal(pendingImageCalls(args,new Set(['old']))[0].terminalWithoutImage,false);
  append({type:'response_item',payload:{type:'custom_tool_call_output',call_id:'new',output:'Error: moderation_blocked. Unit fixture refusal.'}});
  const match=pendingImageCalls(args,new Set(['old']));assert.equal(match.length,1);assert.equal(match[0].terminalWithoutImage,true);assert.match(match[0].outputTexts[0],/Unit fixture refusal/);
  append(call('duplicate'));assert.equal(pendingImageCalls(args,new Set(['old'])).length,2);
});
