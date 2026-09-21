/** Measured runtime floor; deliberately makes no aesthetic verdict. */
export async function measureRuntime(page, {scene, slots, results, viewportHeight}) {
  return page.evaluate(({scene,slots,results,viewportHeight})=>{
    const box=document.querySelector(scene)?.getBoundingClientRect();
    const list=document.querySelector(results)?.getBoundingClientRect();
    const cards=[...document.querySelectorAll(slots)];
    return {slotCount:cards.length, brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
      sceneWidth:box?.width||0, resultsVisible:list?Math.max(0,Math.min(viewportHeight,list.bottom)-Math.max(0,list.top)):0,
      runningAnimations:document.getAnimations().filter(a=>a.playState==='running').length};
  },{scene,slots,results,viewportHeight});
}
export function checkRuntime(snapshot,{expectedSlots,minSceneWidth=1,minResultsVisible=0,reducedMotion=false}={}){
  const errors=[];
  if(!Number.isInteger(expectedSlots)||expectedSlots<1)errors.push('INVALID_SLOT_CONTRACT');
  if(snapshot.slotCount!==expectedSlots)errors.push('SLOT_COUNT');
  if(snapshot.brokenImages!==0)errors.push('BROKEN_IMAGE');
  if(snapshot.horizontalOverflow!==false)errors.push('HORIZONTAL_OVERFLOW');
  if(!Number.isFinite(snapshot.sceneWidth)||snapshot.sceneWidth<minSceneWidth)errors.push('SCENE_WIDTH');
  if(!Number.isFinite(snapshot.resultsVisible)||snapshot.resultsVisible<minResultsVisible)errors.push('RESULTS_BUDGET');
  if(reducedMotion&&snapshot.runningAnimations!==0)errors.push('REDUCED_MOTION');
  return {ok:errors.length===0,errors,scope:'runtime floor only; visual fidelity unassessed'};
}
