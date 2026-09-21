#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function manage(command,{root=path.join(os.tmpdir(),'brand-workflow-artifacts'),id,host,reason}={}) {
 fs.mkdirSync(root,{recursive:true}); root=fs.realpathSync(root);
 const read=(dir)=>JSON.parse(fs.readFileSync(path.join(dir,'run.json'),'utf8'));
 const write=(dir,data)=>fs.writeFileSync(path.join(dir,'run.json'),JSON.stringify(data,null,2)+'\n');
 const locate=(base,key)=>{if(!/^[a-zA-Z0-9_-]+$/.test(key||''))throw Error('Invalid run ID');const p=path.join(root,base,key);if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Symlink run rejected');return p;};
 if(command==='init') {
  if(!host)throw Error('host required');
  const key=crypto.randomUUID(),dir=locate('runs',key);fs.mkdirSync(path.join(dir,'build'),{recursive:true});
  const record={schema:'brand-artifact-run/v1',id:key,host:path.resolve(host),createdAt:new Date().toISOString(),status:'active',protected:false,reason:null};write(dir,record);return {...record,directory:dir,buildDirectory:path.join(dir,'build')};
 }
 if(command==='list') {const base=path.join(root,'runs');return fs.existsSync(base)?fs.readdirSync(base).map(key=>read(locate('runs',key))):[];}
 const quarantine=command==='restore';const dir=locate(quarantine?'quarantine':'runs',id);const record=read(dir);if(record.id!==id)throw Error('Run ID mismatch');
 if(command==='protect'){if(!reason)throw Error('Protection reason required');record.protected=true;record.reason=reason;write(dir,record);return record;}
 if(command==='finish'){record.status='finished';record.finishedAt=new Date().toISOString();write(dir,record);return record;}
 if(command==='quarantine'){
  if(record.protected||record.status!=='finished')throw Error('Active or protected run cannot be quarantined');
  const target=locate('quarantine',id);if(fs.existsSync(target))throw Error('Destination exists');fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(dir,target);return {...record,directory:target,recoverable:true};
 }
 if(command==='restore') {const target=locate('runs',id);if(fs.existsSync(target))throw Error('Destination exists');fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(dir,target);return {...record,directory:target};}
 throw Error('Unknown command');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {const [command,...args]=process.argv.slice(2);const opts={};for(let i=0;i<args.length;i+=2){if(!['--root','--id','--host','--reason'].includes(args[i])||!args[i+1])throw Error('Invalid options');opts[args[i].slice(2)]=args[i+1];}console.log(JSON.stringify(manage(command,opts),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
