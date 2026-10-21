import fs from 'node:fs';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const frozenReader=fileURLToPath(new URL('./read-image-arguments.mjs',import.meta.url));
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
export function frozenImageCall(file,sha256,checkpointCommand,reader=frozenReader,executable=process.execPath) {
  const config={cmd:[executable,reader,file,sha256].map(quote).join(' '),max_output_tokens:64000};
  return '// @exec: {"yield_time_ms": 120000}\n'+
    '// frozen-image-arguments: '+JSON.stringify({file,sha256,checkpointCommand})+'\n'+
    'const input = await tools.exec_command('+JSON.stringify(config)+');\n'+
    'if (input.exit_code !== 0) throw new Error("Frozen input failed verification; no generation attempted.");\n'+
    'const args = JSON.parse(input.output);\n'+imageCheckpointPrefix(checkpointCommand)+
    'const result = await tools.image_gen__imagegen(args);\ngeneratedImage(result);';
}

// Parse data literals only. Never execute code recovered from a conversation.
export function imageCheckpointPrefix(command) {
  return `const checkpoint = await tools.exec_command(${JSON.stringify({cmd:command,yield_time_ms:1000,max_output_tokens:1000})});\nif (!checkpoint.session_id || !checkpoint.output.split("\\n").some(line => { try { return JSON.parse(line).status === "armed"; } catch { return false; } })) throw new Error("Image checkpoint worker did not arm; no generation attempted.");\n`;
}

export function literalArguments(source) {
  const bindingLine=source.split('\n')[1];
  if(bindingLine?.startsWith('// frozen-image-arguments: ')) {
    const b=JSON.parse(bindingLine.slice('// frozen-image-arguments: '.length));
    // A terminal newline is transport formatting, not a change to data flow.
    // Do not normalize inside the program (including strings) or accept code.
    const normalized=source.replace(/[\t\r\n ]+$/,'');
    let expected=frozenImageCall(b.file,b.sha256,b.checkpointCommand);
    if(normalized!==expected) {
      // An installed verifier may read a call made by a previous installation.
      // Accept only the same wrapper and byte-identical helper/executable;
      // never execute a historical command or trust its filename alone.
      try {
        const line=source.split('\n')[2],prefix='const input = await tools.exec_command(';
        const config=JSON.parse(line.slice(prefix.length,-2));
        const tokens=config.cmd.match(/'[^']*'/g);
        if(!line.startsWith(prefix)||tokens?.length!==4||tokens.join(' ')!==config.cmd)throw Error('Invalid command');
        const [executable,reader,file,digest]=tokens.map(token=>token.slice(1,-1));
        const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        if(file!==b.file||digest!==b.sha256||sha(reader)!==sha(frozenReader)||sha(executable)!==sha(process.execPath))throw Error('Changed helper');
        expected=frozenImageCall(b.file,b.sha256,b.checkpointCommand,reader,executable);
      } catch { throw new Error('Frozen call wrapper changed; cannot verify data flow.'); }
    }
    if(normalized!==expected) throw new Error('Frozen call wrapper changed; cannot verify data flow.');
    const bytes=fs.readFileSync(b.file);
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==b.sha256) throw new Error('Frozen argument file changed.');
    return JSON.parse(bytes);
  }
  const marker = /tools\.image_gen__imagegen\s*\(/g;
  const hits = [...source.matchAll(marker)];
  if (hits.length !== 1) throw new Error('Expected exactly one literal ImageGen call; provide a direct literal call, not computed arguments.');
  let prefix=source.slice(0,hits[0].index).replace(/^\s*\/\/ @exec:[^\n]*\n/,'');
  if(prefix.startsWith('const checkpoint = await tools.exec_command(')) {
    const line=prefix.slice(0,prefix.indexOf('\n'));
    let config;try {config=JSON.parse(line.slice('const checkpoint = await tools.exec_command('.length,-2));}catch {throw new Error('Invalid fixed checkpoint prefix.');}
    const expected=imageCheckpointPrefix(config.cmd);
    if(typeof config.cmd!=='string'||!prefix.startsWith(expected)) throw new Error('Only the fixed checkpoint arm prefix is auditable.');
    prefix=prefix.slice(expected.length);
  }
  const assignment=prefix.match(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s*$/);
  const inline=/^\s*generatedImage\(\s*await\s*$/.test(prefix);
  if(!assignment&&!inline) throw new Error('Only a direct awaited ImageGen call is auditable; no branches or comments.');
  let i = hits[0].index + hits[0][0].length;
  const ws = () => { while (/\s/.test(source[i] || '') && i < source.length) i++; };
  function value() {
    ws(); const c = source[i++];
    if (c === '"' || c === "'" || c === '`') {
      let out = '';
      while (i < source.length) {
        const ch = source[i++];
        if (ch === c) return out;
        if (c === '`' && ch === '$' && source[i] === '{') throw new Error('Computed template input cannot be verified.');
        if (ch !== '\\') { if(c==='`'&&ch==='\r'){if(source[i]==='\n')i++;out+='\n';}else out += ch; continue; }
        const esc = source[i++];
        if ('\\\'"`$'.includes(esc)) out += esc;
        else if ('nrtbf'.includes(esc)) out += JSON.parse('"\\' + esc + '"');
        else if (esc === 'u') { const hex = source.slice(i,i+4); if (!/^[0-9a-f]{4}$/i.test(hex)) throw new Error('Invalid escape'); out += String.fromCharCode(parseInt(hex,16)); i+=4; }
        else throw new Error('Unsupported escape in ImageGen evidence.');
      }
      throw new Error('Unterminated string');
    }
    if (c === '{' || c === '[') {
      const obj = c === '{', end = obj ? '}' : ']', result = obj ? {} : [];
      ws();
      while (source[i] !== end) {
        if (i >= source.length) throw new Error('Unterminated literal');
        let key;
        if (obj) {
          if (source[i] === '"' || source[i] === "'") key = value();
          else { const m = source.slice(i).match(/^[A-Za-z_$][\w$]*/); if (!m) throw new Error('Nonliteral key'); key=m[0]; i+=key.length; }
          if (['__proto__','constructor','prototype'].includes(key) || Object.hasOwn(result,key)) throw new Error('Unsafe or duplicate key');
          ws(); if (source[i++] !== ':') throw new Error('Expected colon');
        }
        const v=value(); if(obj) result[key]=v; else result.push(v);
        ws(); if(source[i]===end) break;
        if(source[i++]!==',') throw new Error('Nonliteral argument'); ws();
      }
      i++; return result;
    }
    i--; const m=source.slice(i).match(/^(true|false|null|-?\d+(?:\.\d+)?)/);
    if(!m) throw new Error('Computed ImageGen arguments are not auditable; no execution attempted.');
    i+=m[0].length; return JSON.parse(m[0]);
  }
  const result=value(); ws(); if(source[i]!==')') throw new Error('Unexpected call expression');
  const tail=source.slice(i+1).replace(/\s/g,'');
  if(tail!==(inline?');':`;generatedImage(${assignment[1]});`)) throw new Error('Expected direct generatedImage result emission only.');
  return result;
}

const runtimeCache=new Map();
export function runtimeEntries(logFile) {
  const stat=fs.statSync(logFile),signature=`${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  const cached=runtimeCache.get(logFile);
  if(cached?.signature===signature) return cached.entries;
  const text=fs.readFileSync(logFile,'utf8'),lines=text.split('\n'),entries=[];
  for(let i=0;i<lines.length;i++) {
    if(!lines[i].trim()) continue;
    try { entries.push(JSON.parse(lines[i])); }
    catch(error) {
      // Active runtime logs may be mid-append. Ignore only an unfinished final
      // line; a complete malformed line or earlier corruption is an error.
      if(i===lines.length-1&&!text.endsWith('\n')) break;
      throw error;
    }
  }
  runtimeCache.set(logFile,{signature,entries});
  return entries;
}

export function readImageCall(logFile, callId, {allowUnverifiedArguments=false}={}) {
  if(!logFile || !callId) throw new Error('Actual tool call log and call ID required; do not recreate or amend arguments after generation.');
  const events=runtimeEntries(logFile).filter(e=>e.type==='response_item');
  return imageCallFromEvents(events,logFile,callId,{allowUnverifiedArguments});
}

function imageCallFromEvents(events,logFile,callId,{allowUnverifiedArguments=false,includeOutputImages=false}={}) {
  const matches=events.filter(e=>[e.payload?.call_id,e.payload?.id].includes(callId));
  const calls=matches.filter(e=>['function_call','custom_tool_call'].includes(e.payload.type));
  if(calls.length!==1) throw new Error('Actual tool call not uniquely found in log.');
  const event=calls[0], p=event.payload;
  let args,argumentError;
  if(/(?:^|__)imagegen$/.test(p.name)) args=typeof p.arguments==='string'?JSON.parse(p.arguments):p.arguments;
  else if(['exec','functions.exec'].includes(p.name)) {
    const source=p.input || p.arguments;
    try { args=literalArguments(source); }
    catch(error) {
      // Only the runtime output is recoverable here. The wrapper's semantics
      // and ImageGen attribution remain unverified. Never execute recovered
      // code, resolve store/load or substitute planned arguments.
      if(!allowUnverifiedArguments) throw error;
      argumentError=error.message;
    }
  }
  else throw new Error('Not an ImageGen call.');
  const outputs=events.filter(e=>e.payload.call_id===p.call_id && e.payload.type.endsWith('_output'));
  // A yielded exec returns its image through a wait on the same cell.
  const cell=outputs.flatMap(e=>typeof e.payload.output==='string'?[e.payload.output]:Array.isArray(e.payload.output)?e.payload.output.filter(b=>['input_text','text'].includes(b.type)).map(b=>b.text||''):[]).join('\n').match(/Script running with cell ID ([\w-]+)/)?.[1];
  if(cell) for(const e of events) {
    if(e.timestamp<event.timestamp||!['wait','functions.wait'].includes(e.payload.name))continue;
    let a;try{a=JSON.parse(e.payload.arguments);}catch{continue;}
    if(String(a.cell_id)===cell) outputs.push(...events.filter(o=>o.payload.call_id===e.payload.call_id&&o.payload.type.endsWith('_output')));
  }
  const outputHashes=outputs.flatMap(e=>Array.isArray(e.payload.output)?e.payload.output:[]).flatMap(b=>{
    const url=b.image_url?.url||b.image_url;
    return typeof url==='string'&&/^data:image\/[^;]+;base64,/.test(url)?[crypto.createHash('sha256').update(Buffer.from(url.split(',')[1],'base64')).digest('hex')]:[];
  });
  const outputImages=includeOutputImages?outputs.flatMap(e=>Array.isArray(e.payload.output)?e.payload.output:[]).flatMap(b=>{const url=b.image_url?.url||b.image_url;return typeof url==='string'&&/^data:image\/[^;]+;base64,/.test(url)?[url]:[];}):undefined;
  const outputTexts=outputs.flatMap(e=>typeof e.payload.output==='string'?[e.payload.output]:Array.isArray(e.payload.output)?e.payload.output.filter(b=>['input_text','text'].includes(b.type)).map(b=>b.text||''):[]);
  const terminalWithoutImage=outputHashes.length===0&&outputTexts.some(text=>/moderation_blocked|Script completed|Error:|Error executing|Error invoking|Script failed|Script terminated/.test(text));
  return {args,...(includeOutputImages?{outputImages,outputTexts,terminalWithoutImage,rawCall:p.input||p.arguments}:{}),...(argumentError?{argumentError,rawCall:p.input||p.arguments}:{}), evidence:{callId:p.call_id,timestamp:event.timestamp,logPath:fs.realpathSync(logFile),eventSha256:crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex'),outputHashes,status:'matched-call-record'}};
}

export function currentThreadImageLogs() {
  const thread=process.env.CODEX_THREAD_ID;
  if(!thread||!/^[a-f0-9-]{16,}$/i.test(thread)) throw new Error('Current CODEX_THREAD_ID is missing or invalid; provide explicit call-log and call-id.');
  const sessions=fs.realpathSync(path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'));
  const files=[];
  function walk(dir) {
    for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
      const file=path.join(dir,item.name);
      if(item.isDirectory()) walk(file);
      // Desktop continuation segments retain the thread ID before a segment UUID.
      // Metadata below remains authoritative; similarly prefixed threads do not match.
      else if(item.isFile()&&new RegExp(`-${thread}(?:_[a-f0-9-]{36})?\\.jsonl$`,'i').test(item.name)) files.push(file);
    }
  }
  walk(sessions);
  for(const file of files) if(!runtimeEntries(file).some(e=>e.type==='session_meta'&&e.payload?.id===thread)) throw new Error('Current-thread runtime log metadata does not match CODEX_THREAD_ID.');
  return files;
}

export function pendingImageCalls(expected, excludedCallIds, {checkpointPrefix}={}) {
  const matches=[];
  for(const file of currentThreadImageLogs()) {
    const events=runtimeEntries(file).filter(e=>e.type==='response_item');
    for(const event of events.filter(e=>['function_call','custom_tool_call'].includes(e.payload?.type))) {
      const p=event.payload,id=p.call_id||p.id;
      if(excludedCallIds.has(id)||!(/(?:^|__)imagegen$/.test(p.name)||['exec','functions.exec'].includes(p.name)&&/tools\.image_gen__imagegen\s*\(/.test(p.input||p.arguments||''))) continue;
      const actual=imageCallFromEvents(events,file,id,{includeOutputImages:true,allowUnverifiedArguments:true});
      if(checkpointPrefix ? actual.rawCall?.includes(checkpointPrefix) : actual.args&&isDeepStrictEqual(actual.args,expected)) matches.push(actual);
    }
  }
  return matches;
}

export function findCurrentThreadImageCall(outputFile) {
  const files=currentThreadImageLogs();
  const digest=crypto.createHash('sha256').update(fs.readFileSync(outputFile)).digest('hex'),matches=[];
  for(const file of files) {
    const entries=runtimeEntries(file);
    const events=entries.filter(e=>e.type==='response_item');
    const ids=[...new Set(events.filter(e=>['function_call','custom_tool_call'].includes(e.payload?.type)&&(/(?:^|__)imagegen$/.test(e.payload.name)||['exec','functions.exec'].includes(e.payload.name)&&/tools\.image_gen__imagegen\s*\(/.test(e.payload.input||e.payload.arguments||''))).map(e=>e.payload.call_id||e.payload.id))];
    for(const id of ids) {
      const actual=imageCallFromEvents(events,file,id,{allowUnverifiedArguments:true});
      if(actual.evidence.outputHashes.includes(digest)) matches.push({callLog:file,callId:id});
    }
  }
  if(matches.length!==1) throw new Error(`Current-thread output matched ${matches.length} runtime calls; require exactly one. Provide explicit evidence if discovery is unavailable or ambiguous.`);
  return matches[0];
}

export function requireRuntimeEvidence(actual, outputFile) {
  const sessions=fs.realpathSync(path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'));
  if(!actual.evidence.logPath.startsWith(sessions+path.sep)) throw new Error('Evidence must come from the local runtime session store, not a recreated JSONL.');
  const digest=crypto.createHash('sha256').update(fs.readFileSync(outputFile)).digest('hex');
  if(!actual.evidence.outputHashes.includes(digest)) throw new Error('Output is not bound to the actual tool result; preserve it as unverified.');
  return {...actual.evidence,status:actual.argumentError?'output-verified-arguments-unverified':'verified-against-tool-call'};
}

// Prove output attribution independently of argument reconstruction. Native
// completion records carry the generated bytes, including delayed exec emission.
// Never use savedPath or a prepared arguments file as proof of a tool result.
export function nativeImageOutputEvidence(logFile, outputFile) {
  const sessions=fs.realpathSync(path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'));
  const real=fs.realpathSync(logFile);
  if(!real.startsWith(sessions+path.sep)) throw Error('Native evidence must come from the runtime session store.');
  const digest=crypto.createHash('sha256').update(fs.readFileSync(outputFile)).digest('hex');
  const matches=runtimeEntries(real).filter(e=>{
    const item=e.type==='event_msg'&&e.payload?.type==='item_completed'&&e.payload.item;
    if(item?.kind!=='image_gen.generation'||item.status!=='completed'||item.failure||typeof item.result!=='string')return false;
    const value=item.result.replace(/^data:image\/[^;]+;base64,/,'');
    return crypto.createHash('sha256').update(Buffer.from(value,'base64')).digest('hex')===digest;
  });
  if(matches.length!==1)throw Error('Expected exactly one native completed ImageGen output matching selected bytes.');
  const event=matches[0];
  return {status:'native-image-output-verified',automaticArgumentsVerified:false,logPath:real,
    eventSha256:crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex'),
    generationId:event.payload.item.id,outputSha256:digest,
    limitation:'Native generated image bytes are verified; original call arguments remain unverified. Selection does not certify the generation prompt or brand-learning evidence.'};
}

export function verifyImageCall(logFile, callId, submitted) {
  const actual=readImageCall(logFile,callId);
  if(!isDeepStrictEqual(actual.args,submitted)) throw new Error('IMAGE_CALL_ARGUMENT_MISMATCH: saved arguments differ from the actual ImageGen call; preserve original output and report the discrepancy, never patch records to pass.');
  return actual;
}
