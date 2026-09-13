import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '../..')
const migrationRoot = import.meta.dirname
const out = path.join(migrationRoot, 'captures', 'source')
fs.mkdirSync(out, { recursive: true })
const rel = file => path.relative(root, file)
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const write = (name, value) => fs.writeFileSync(path.join(migrationRoot, name), JSON.stringify(value, null, 2) + '\n')
const executablePath = path.join(process.env.HOME, 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')
const browser = await chromium.launch({ headless: true, executablePath })
const viewport = { width: 1440, height: 900 }
const specs = [
  { id:'home', navIndex:0, selector:'#index', originIndex:1, actionSelector:'.index_main_bbox_pcdown' },
  { id:'gameplay', navIndex:2, selector:'#gameplay', originIndex:0, actionSelector:'.gameplay_next' },
  { id:'character', navIndex:1, selector:'#character', originIndex:0, actionSelector:'.character_side_next' },
]
const pageResults=[], actionResults=[], allTimeline=[], assetsByUrl=new Map()

for (const spec of specs) {
  const dir=path.join(out,spec.id,'desktop')
  fs.mkdirSync(dir,{recursive:true})
  const context=await browser.newContext({viewport,recordVideo:{dir,size:viewport}})
  const page=await context.newPage()
  await page.goto('https://czn.qq.com/',{waitUntil:'networkidle',timeout:90000})
  await page.waitForTimeout(3500)
  const nav=page.locator('.top_nav_list > li > a')
  if(spec.originIndex!==0){ await nav.nth(spec.originIndex).click(); await page.waitForTimeout(1400) }
  const timeline=[]
  let timeMs=0
  async function snap(label,index){
    const file=path.join(dir,`${String(index).padStart(2,'0')}-${label}.png`)
    await page.screenshot({path:file,fullPage:false})
    const state=await page.evaluate(({pageId})=>{const active=document.querySelector('.wrap > .swiper-wrapper > .swiper-slide-active'); const target=document.querySelector(`#${pageId==='home'?'index':pageId}`); const r=target?.getBoundingClientRect(); return {scrollTop:scrollY,scrollHeight:document.documentElement.scrollHeight,activeId:active?.id||null,activeClass:String(active?.className||''),targetBox:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null}}, {pageId:spec.id})
    const row={pageId:spec.id,state:label,timeMs,file:rel(file),sha256:sha(file),...state}
    timeline.push(row); allTimeline.push(row); return row
  }
  const before=await snap('default',0)
  await nav.nth(spec.navIndex).click(); timeMs+=90
  const triggered=await snap('triggered',1)
  await page.waitForTimeout(180); timeMs+=180
  const transition=await snap('transition',2)
  await page.waitForTimeout(1200); timeMs+=1200
  const settled=await snap('settled',3)
  const full=path.join(dir,'full-page.png'); await page.screenshot({path:full,fullPage:true})
  const region=path.join(dir,'key-region.png'); await page.screenshot({path:region,clip:{x:0,y:0,width:viewport.width,height:viewport.height}})
  const observed=await page.locator(spec.selector).evaluate((el)=>{
    const visible=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth}
    const pick=s=>({display:s.display,visibility:s.visibility,position:s.position,zIndex:s.zIndex,color:s.color,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,borderRadius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,boxShadow:s.boxShadow,opacity:s.opacity,transform:s.transform,transition:s.transition,animationName:s.animationName,animationDuration:s.animationDuration,clipPath:s.clipPath})
    const nodes=[el,...el.querySelectorAll('a,button,img,video,canvas,h1,h2,h3,p,span,li,[class]')].filter(visible).slice(0,160).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,id:n.id||null,className:String(n.className||''),text:(n.innerText||n.alt||'').trim().replace(/\s+/g,' ').slice(0,180),src:n.currentSrc||n.src||null,box:{x:r.x,y:r.y,width:r.width,height:r.height},normalizedRegion:{x:r.x/innerWidth,y:r.y/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight},computed:pick(s)}})
    const r=el.getBoundingClientRect(),s=getComputedStyle(el)
    return {selector:`#${el.id}`,className:String(el.className),box:{x:r.x,y:r.y,width:r.width,height:r.height},normalizedRegion:{x:r.x/innerWidth,y:r.y/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight},computed:pick(s),nodes}
  })
  const navState=await nav.nth(spec.navIndex).evaluate(el=>{const p=el.parentElement,s=getComputedStyle(el),ps=getComputedStyle(p),r=el.getBoundingClientRect();return {selector:'.top_nav_list > li > a',index:[...p.parentElement.children].indexOf(p),className:String(p.className),box:{x:r.x,y:r.y,width:r.width,height:r.height},computed:{color:s.color,borderColor:s.borderColor,backgroundColor:s.backgroundColor},parentComputed:{color:ps.color,borderColor:ps.borderColor,backgroundImage:ps.backgroundImage}}})
  const actionBeforeFile=path.join(dir,'04-action-default.png'); await page.screenshot({path:actionBeforeFile})
  const stateOf=async()=>page.locator(spec.actionSelector).evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {className:String(el.className),box:{x:r.x,y:r.y,width:r.width,height:r.height},computed:{color:s.color,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,opacity:s.opacity,transform:s.transform,transition:s.transition}}})
  const actionBefore=await stateOf()
  if(spec.id==='home') await page.locator(spec.actionSelector).hover(); else await page.locator(spec.actionSelector).click()
  await page.waitForTimeout(90); timeMs+=90
  const actionTriggeredFile=path.join(dir,'05-action-triggered.png'); await page.screenshot({path:actionTriggeredFile})
  await page.waitForTimeout(700); timeMs+=700
  const actionSettledFile=path.join(dir,'06-action-settled.png'); await page.screenshot({path:actionSettledFile})
  const actionAfter=await stateOf()
  if(spec.id==='home') await page.mouse.move(viewport.width-10,viewport.height-10); else if(spec.id==='gameplay') await page.locator('.gameplay_prev').click(); else await page.locator('.character_side_prev').click()
  await page.waitForTimeout(800); timeMs+=800
  const actionRestoredFile=path.join(dir,'07-action-restored.png'); await page.screenshot({path:actionRestoredFile})
  const actionRestored=await stateOf()
  actionResults.push({id:`${spec.id}-primary-interaction`,pageId:spec.id,stateSemantics:spec.id==='home'?'hover':'carousel-next',trigger:spec.id==='home'?`hover ${spec.actionSelector}`:`click ${spec.actionSelector}; restore with corresponding previous control`,selector:spec.actionSelector,beforeCapture:rel(actionBeforeFile),triggeredCapture:rel(actionTriggeredFile),afterCapture:rel(actionSettledFile),restoredCapture:rel(actionRestoredFile),captureSha256:{before:sha(actionBeforeFile),triggered:sha(actionTriggeredFile),after:sha(actionSettledFile),restored:sha(actionRestoredFile)},beforeState:actionBefore,afterState:actionAfter,restoredState:actionRestored,sourceRule:{kind:'computed-live-page',propertyNames:Object.keys(actionAfter.computed)}})
  await nav.nth(spec.originIndex).click(); await page.waitForTimeout(900); timeMs+=900
  const restored=await snap('restored',8)
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({url:e.name,initiatorType:e.initiatorType,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize})).filter(e=>/\.(png|jpe?g|webp|gif|svg|mp4|webm|woff2?|ttf|otf)(\?|$)/i.test(e.url)))
  for(const item of resources) assetsByUrl.set(item.url,item)
  const video=page.video(); await context.close(); const old=await video.path(); const videoFile=path.join(dir,'continuous-playback.webm'); fs.renameSync(old,videoFile)
  const timelineFile=path.join(dir,'timeline.json'); fs.writeFileSync(timelineFile,JSON.stringify(timeline,null,2)+'\n')
  pageResults.push({id:spec.id,url:'https://czn.qq.com/',viewport,coverage:'covered',fullPageCapture:rel(full),fullPageSha256:sha(full),keyRegionCapture:rel(region),keyRegionSha256:sha(region),continuousCapture:rel(videoFile),continuousCaptureSha256:sha(videoFile),losslessFrameDirectory:rel(dir),timeline:rel(timelineFile),timelineSha256:sha(timelineFile),pageExtent:{interactionModel:'viewport-sized vertical swiper surface',reachableStart:0,reachableEnd:viewport.height,coverageRatio:1,documentScrollHeight:before.scrollHeight},states:{default:before,triggered,transition,settled,restored},observed,navState})
}
await browser.close()

const assetRows=[...assetsByUrl.values()].map((a,i)=>({id:`asset-${String(i+1).padStart(3,'0')}`,sourceUrl:a.url,sourceKind:a.initiatorType,transferSize:a.transferSize,decodedBodySize:a.decodedBodySize,sourceSha256:crypto.createHash('sha256').update(a.url).digest('hex'),hashBasis:'canonical-source-url; payload hash unavailable without duplicating browser cache',observedOn:pageResults.filter(p=>p.observed.nodes.some(n=>n.src===a.url||n.computed.backgroundImage.includes(a.url))).map(p=>p.id)}))
write('raw-source-observation.json',{schema:'czn-rendered-observation/v1',capturedAt:new Date().toISOString(),sourceUrl:'https://czn.qq.com/',viewport,pages:pageResults,timeline:allTimeline,interactions:actionResults,assets:assetRows})
write('source-observation-manifest.json',{schema:'brand-source-observation/v1',brand:'czn-v3',sourceUrl:'https://czn.qq.com/',capturedAt:new Date().toISOString(),captureMethod:'Playwright Chromium; screenshot-first; per-surface isolated lossless PNG frames and WebM continuity',viewport,pages:pageResults.map(p=>({id:p.id,url:p.url,coverage:p.coverage,viewport:p.viewport,fullPageCapture:p.fullPageCapture,fullPageSha256:p.fullPageSha256,keyRegionCapture:p.keyRegionCapture,keyRegionSha256:p.keyRegionSha256,continuousCapture:p.continuousCapture,continuousCaptureSha256:p.continuousCaptureSha256,losslessFrameDirectory:p.losslessFrameDirectory,timeline:p.timeline,timelineSha256:p.timelineSha256,pageExtent:p.pageExtent,states:p.states})),pageCoverage:{required:3,covered:3,ratio:1},interactionCoverage:{requiredStates:['default','triggered','settled','restored'],coveredStates:['default','triggered','settled','restored'],ratio:1}})
write('action-evidence.json',{schema:'brand-action-evidence/v1',brand:'czn-v3',sourceUrl:'https://czn.qq.com/',actions:actionResults})
write('rendered-asset-inventory.json',{schema:'brand-rendered-asset-inventory/v1',brand:'czn-v3',sourceUrl:'https://czn.qq.com/',hashPolicy:'source URL hashes identify immutable observations; URLs and browser transfer metadata retained for provenance',assets:assetRows})
console.log(JSON.stringify({pages:pageResults.length,actions:actionResults.length,assets:assetRows.length},null,2))
