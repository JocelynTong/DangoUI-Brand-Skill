import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {coordinationReply} from './full-image-concepts.mjs';

// Cache only delivery payloads, never validation results. Each public entry still
// verifies originals before calling this function. No writes to the run itself.
export function imageCoordinationReply(result,{root,brand,scope=process.env.CODEX_THREAD_ID||'local',cacheRoot=path.join(os.tmpdir(),'brand-coordination-replies')}={}) {
  const reply=coordinationReply(result);
  const key=crypto.createHash('sha256').update(JSON.stringify([path.resolve(root),brand,scope])).digest('hex');
  fs.mkdirSync(cacheRoot,{recursive:true,mode:0o700});
  const packet=path.join(cacheRoot,`${key}-${reply.revision}.json`);
  let repeated=false;
  try {fs.writeFileSync(packet,JSON.stringify(reply),{flag:'wx',mode:0o600});}
  catch(e) {
    if(e.code!=='EEXIST')throw e;
    if(fs.lstatSync(packet).isSymbolicLink()||fs.readFileSync(packet,'utf8')!==JSON.stringify(reply))throw Error('Coordination packet cache changed.');
    repeated=true;
  }
  if(!repeated)return {...reply,packetFile:packet};
  return {status:result.status,unchanged:true,revision:reply.revision,packetFile:packet,
    userGoalCompleted:result.userGoalCompleted===true,comparisonPreview:result.comparisonPreview,
    nextAction:'No new result. Keep the existing worker; do not redispatch, reread the packet or poll again. Use its completion event. If recovering a genuinely lost context, read packetFile once. Explicit delivery or --full remains available.'};
}
