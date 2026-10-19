import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {imageConceptDelivery,imageConceptFile,compactImageConceptResult} from './full-image-concepts.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const binding=p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});

export function prepareImageBatchHandoff({root,brand,verifyExisting=false}) {
  const delivery=imageConceptDelivery({root,brand}); // Validate originals before dispatch.
  const state=read(imageConceptFile(root,brand));
  const prepared=path.join(root,'migrations',brand,'host-preparation','producer-dispatch.json');
  const dispatchFile=fs.existsSync(prepared)?prepared:state.dispatch.path;
  const dispatch=read(dispatchFile);
  if(verifyExisting&&delivery.images?.length!==3)throw Error('Existing-image verification requires three saved originals.');
  const scripts=path.dirname(fileURLToPath(import.meta.url));
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'brand-image-batch-'));
  const packet={schema:'brand-image-batch/v1',mode:verifyExisting?'verify-existing':'continue-authorized-batch',root,brand,
    owner:'short-context-batch-executor',allowGeneration:!verifyExisting,allowHostEdits:false,
    dispatch:binding(dispatchFile),delivery:compactImageConceptResult(delivery),reviewInputs:{images:delivery.images||delivery.completedImages||[],inputs:dispatch.inputs,inputImages:dispatch.inputImages,sharedBrief:dispatch.sharedBrief,preparedInput:dispatch.preparedInput,conceptScope:dispatch.conceptScope},
    entry:path.join(scripts,'run-brand-workflow.mjs'),resultDirectory:directory,
    executorReference:path.resolve(scripts,'../workflows/image-batch-executor.md')};
  const packetFile=path.join(directory,'task.json');fs.writeFileSync(packetFile,JSON.stringify(packet,null,2),{flag:'wx',mode:0o600});
  return {packet:binding(packetFile),mode:packet.mode,
    launch:{task_name:'brand_batch',fork_turns:'none',message:`Execute the Brand batch at ${packetFile}. Read its executorReference and packet once. This packet is the complete authorization scope; do not inherit or inspect maintenance history. Own all remaining work and independent QA through delivery. Return one final result, not stage-by-stage coordination messages.`},
    outerAction:'Launch exactly this fresh batch executor once. Do not also launch a producer or QA, list agents, poll continue/status, or inspect input files. Consume its final result event. If completion events cannot be delivered while idle, disclose that limitation and keep the standard preview available; do not promise background chat notification.'};
}
