import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
export function selectedPosteditContext(root, brand, options = {}) {
  if (!options.phase || options.phase === "original") return {};
  if (options.phase !== "postedit") throw new Error("SELECTED_H5_HOST_PHASE_INVALID");
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"migrations",brand,"execution-manifest.json"))), current=manifest.stages.find(item=>item.id===manifest.currentStageId), stage=manifest.stages.find(item=>item.id===(options.completedStageId || options.priorStageId || manifest.currentStageId));
  if (options.completedStageId && options.priorStageId) throw new Error("SELECTED_H5_POSTEDIT_CONTEXT_AMBIGUOUS");
  const completed = options.completedStageId && stage?.status === "complete" && stage.verdict === "pass"
    && [...manifest.stages].reverse().find(item => item.stage === "hostImplementation")?.id === stage.id
    && ["running", "blocked", "awaiting-user", "passed", "complete"].includes(manifest.status);
  const prior = options.priorStageId && stage?.status==="failed" && ["fail","needs-evidence"].includes(stage.verdict) && ((manifest.status==="blocked" && !manifest.currentStageId && manifest.stages.at(-1)?.id===stage.id) || (manifest.status==="running" && current?.status==="pending" && current?.retryInput?.priorStageId===stage.id));
  if (manifest.mode!=="apply-host" || stage?.stage!=="hostImplementation" || !(completed || prior || (!options.priorStageId && !options.completedStageId && stage.status==="dispatched"))) throw new Error("SELECTED_H5_POSTEDIT_STAGE_INVALID");
  if (completed) {
    if (hash(path.resolve(root,stage.receiptPath)) !== stage.receiptSha256) throw new Error("SELECTED_H5_POSTEDIT_COMPLETED_RECEIPT_CHANGED");
    const receipt=JSON.parse(fs.readFileSync(path.resolve(root,stage.receiptPath)));
    if (receipt.stageId !== stage.id || receipt.verdict !== "pass" || receipt.goalSha256 !== manifest.goalSha256 || receipt.dispatchId !== stage.dispatchId || JSON.stringify(receipt.outputs) !== JSON.stringify(stage.outputHashes)) throw new Error("SELECTED_H5_POSTEDIT_COMPLETED_RECEIPT_INVALID");
    for (const ref of stage.outputHashes || []) if (hash(path.resolve(root,ref.path)) !== ref.sha256) throw new Error("SELECTED_H5_POSTEDIT_COMPLETED_OUTPUT_CHANGED");
  }
  if (prior && hash(path.resolve(root,stage.receiptPath))!==stage.receiptSha256) throw new Error("SELECTED_H5_POSTEDIT_PRIOR_RECEIPT_CHANGED");
  const dispatch=JSON.parse(fs.readFileSync(path.resolve(root,stage.dispatchPath)));
  if (hash(path.resolve(root,stage.dispatchPath))!==stage.dispatchSha256) throw new Error("SELECTED_H5_POSTEDIT_DISPATCH_CHANGED");
  for (const ref of [options.originalSnapshot,options.preeditBundle]) {
    const found=dispatch.requiredInputs.find(item=>item.path===ref?.path && item.sha256===ref?.sha256);
    if (!found || !manifest.selectedH5PosteditBinding || !Object.values(manifest.selectedH5PosteditBinding).some(item=>item.path===ref.path && item.sha256===ref.sha256)) throw new Error("SELECTED_H5_POSTEDIT_DISPATCH_PIN_REQUIRED");
  }
  return options;
}
export function selectedPosteditCliOptions(args) {
  const value=flag=>{const i=args.indexOf(flag);return i<0?"":args[i+1]};
  if (!value("--validation-phase")) return {};
  return {phase:value("--validation-phase"),...(value("--prior-stage-id") ? {priorStageId:value("--prior-stage-id")} : {}),...(value("--completed-stage-id") ? {completedStageId:value("--completed-stage-id")} : {}),originalSnapshot:{path:value("--original-snapshot"),sha256:value("--original-snapshot-sha256")},preeditBundle:{path:value("--preedit-bundle"),sha256:value("--preedit-bundle-sha256")}};
}
