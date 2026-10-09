import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Synthetic but fully hash-bound validator inputs; never writes real run data.
export function createLearningFidelityTestFixture({root,brand,goal,goalRef,save}) {
  const prefix=`migrations/${brand}/`,sourcePage=goal.referencePages.find(page=>page.core!==false),demoPage=goal.demoPages.find(page=>page.mapsToSourcePageId===sourcePage.id),heldOutPage=goal.demoPages.find(page=>page.proofRole==='generative-held-out');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9oCBcAAAAASUVORK5CYII=','base64');
  const source=save(sourcePage.screenshot,png),demo=save(demoPage.screenshot,Buffer.concat([png,Buffer.from('demo')])),heldOut=save(heldOutPage.screenshot,Buffer.concat([png,Buffer.from('held-out')]));
  const asset=save(`${prefix}original-asset.png`,Buffer.concat([png,Buffer.from('official original')]));
  const layers=[{id:'frame',role:'frame',sourceRegion:[0,0,1,0.4],demoRegion:[0,0,1,0.4]},{id:'foreground',role:'foreground',sourceRegion:[0.1,0.5,0.8,0.3],demoRegion:[0.1,0.5,0.8,0.3]}],identity={identity:'campaign',variant:'original'};
  save(`${prefix}approved-visual-patterns.json`,{patterns:[{id:'approved-frame',compositionContract:{sourceAsset:identity,requiredLayers:layers}}]});
  const inventory={schema:'brand-visual-pattern-inventory/v1',goalSha256:goalRef.sha256,attempt:1,pages:[{demoPageId:demoPage.id,patterns:[{id:'hero',salience:'high',approvedPatternId:'approved-frame',demoRegion:[0,0,1,1],evidenceRefs:[{evidenceId:'source-frame',sourcePageId:sourcePage.id,sourceRegion:[0,0,1,1]}],selfCheck:'pass',asset:asset.path,assetProvenance:{sourceUrl:'https://example.com/original.png',sourceSha256:asset.sha256,role:'campaign',sourceKind:'original-site-asset'},preserves:goal.mustPreserve.map(item=>item.id),compositionSupport:{sourceAsset:identity,demoAsset:identity,layers}}]}]};
  const inventoryRef=save(`${prefix}visual-pattern-inventory.json`,inventory);
  const generative={schema:'brand-generative-proof/v1',goalSha256:goalRef.sha256,challenge:{id:'held-out',heldOut:true,sourceContentIndependent:true,contentChange:'New independent content'},frozenRules:[{recipeId:'framing',frozenBeforeChallenge:true},{recipeId:'hierarchy',frozenBeforeChallenge:true}],output:{demoPageId:heldOutPage.id,screenshot:heldOut},checks:{brandCueSubstitution:false,structureRulesApplied:['framing','hierarchy']}};
  const generativeRef=save(`${prefix}generative-proof.json`,generative);
  const qaInput={schema:'brand-blind-qa-input/v1',goalSha256:goalRef.sha256,attempt:1,qaExecutionId:'/root/visualQA',implementationExecutionId:'/root/demo',forbiddenInputsAbsent:{implementationRationale:true,priorVerdict:true,buildPassAsVisualEvidence:true,mainConversation:true},allowedInputs:[{...inventoryRef,kind:'visual-pattern-inventory'},{...generativeRef,kind:'generative-proof'},{...source,kind:'source-screenshot'}]};
  const qaInputRef=save(`${prefix}qa-input-manifest.json`,qaInput);
  const dimensions=Object.fromEntries(['composition','assetAuthenticity','colorRoles','informationDensity','typographyGraphics','motionSemantics','brandRecognition'].map(key=>[key,{rating:4,observations:[{sourceRegion:[0,0,1,1],demoRegion:[0,0,1,1],finding:'Observed matching source mechanism'}]}]));
  const assessment={schema:'brand-visual-qa-assessment/v2',goalSha256:goalRef.sha256,attempt:1,qaExecutionId:'/root/visualQA',reviewerRecommendation:'pass',pages:[{sourcePageId:sourcePage.id,demoPageId:demoPage.id,sourceScreenshot:source,demoScreenshot:demo,dimensions,mustPreserve:goal.mustPreserve.map(item=>({id:item.id,status:'pass'})),mustNotReplace:goal.mustNotReplace.map(item=>({id:item.id,violated:false})),visualPatterns:[{id:'hero',status:'supported',sourceRegion:[0,0,1,1],demoRegion:[0,0,1,1],finding:'Official composition matched',compositionLayers:layers.map(layer=>({id:layer.id,status:'matched',finding:'Bounded layer matches source'}))}]}],generativeProofReview:{status:'pass',ruleChecks:[{recipeId:'framing',status:'reused',finding:'Framing reused'},{recipeId:'hierarchy',status:'reused',finding:'Hierarchy reused'}]}};
  const assessmentRef=save(`${prefix}visual-qa-assessment.json`,assessment);
  const run=spawnSync(process.execPath,[path.resolve('skills/brand/scripts/validate-brand-fidelity.mjs'),'--root',root,'--brand',brand],{encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const report=JSON.parse(run.stdout),fidelityRef=save(`${prefix}fidelity-report.json`,report);
  return {report,assessment,assessmentRef,qaInput,qaInputRef,inventory,inventoryRef,generative,generativeRef,fidelityRef};
}
