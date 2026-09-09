import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const base=process.argv[2]||'http://127.0.0.1:5177', out=path.resolve('migrations/pokemon-tcg-official/quality-attempts/10/demo-revision7'), captures=path.join(out,'captures')
fs.mkdirSync(captures,{recursive:true});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const route=id=>`#/brand/pokemon-tcg-official/pages/${id}`
const cases=[
  {id:'normal-home',pageId:'pokemon-tcg-official-home',viewport:{width:1200,height:940},query:'?qa=attempt10-revision7'},
  {id:'normal-pocket-fixture',pageId:'pokemon-tcg-official-pocket-fixture',viewport:{width:1200,height:940},query:'?qa=attempt10-revision7'},
  {id:'normal-deck-lab',pageId:'pokemon-tcg-official-held-out',viewport:{width:1200,height:940},query:'?qa=attempt10-revision7'},
  {id:'proof-desktop',pageId:'pokemon-tcg-official-home',viewport:{width:1440,height:900},query:'?qa=attempt10-revision7&proof=desktop'},
  {id:'proof-mobile',pageId:'pokemon-tcg-official-home',viewport:{width:390,height:844},query:'?qa=attempt10-revision7&proof=mobile'},
]
const results=[]
const inspect=()=>{const phone=document.querySelector('.phone.template-phone'),screen=phone.querySelector('.phone-screen'),indicator=phone.querySelector('.mock-home-indicator--outer'),contents=screen.querySelector('.contents'),last=contents.lastElementChild,r=e=>{const x=e.getBoundingClientRect();return{x:x.x,y:x.y,width:x.width,height:x.height,right:x.right,bottom:x.bottom}},is=getComputedStyle(indicator),cs=getComputedStyle(contents);return{phone:r(phone),screen:r(screen),indicator:r(indicator),indicatorStyle:{position:is.position,display:is.display,backgroundImage:is.backgroundImage,backgroundColor:is.backgroundColor},scroll:{top:screen.scrollTop,clientHeight:screen.clientHeight,scrollHeight:screen.scrollHeight},contents:{paddingBottom:cs.paddingBottom},lastContent:r(last)}}
for(const test of cases){const page=await browser.newPage({viewport:test.viewport,deviceScaleFactor:1}),errors=[],warnings=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/${test.query}${route(test.pageId)}`,{waitUntil:'networkidle'});await page.locator('.mock-home-indicator--outer').waitFor({state:'attached'});const initial=await page.evaluate(inspect);await page.screenshot({path:path.join(captures,`${test.id}-before.png`),fullPage:false});let scrolled=null,restored=null,bottom=null
  if(test.id.startsWith('normal-')){await page.evaluate(()=>{document.querySelector('.phone-screen').scrollTop=240});scrolled=await page.evaluate(inspect);await page.screenshot({path:path.join(captures,`${test.id}-scroll.png`),fullPage:false});await page.evaluate(()=>{document.querySelector('.phone-screen').scrollTop=0});restored=await page.evaluate(inspect);await page.evaluate(()=>{const s=document.querySelector('.phone-screen');s.scrollTop=s.scrollHeight});bottom=await page.evaluate(inspect)}
  results.push({...test,initial,scrolled,restored,bottom,console:{errors,warnings}});await page.close()}
await browser.close()
const normal=results.filter(r=>r.id.startsWith('normal-')),proof=results.filter(r=>r.id.startsWith('proof-')),same=(a,b)=>['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.5)
const checks={
  indicatorOverlay:normal.every(r=>r.initial.indicatorStyle.position==='absolute'&&r.initial.indicator.height>0&&r.initial.indicatorStyle.backgroundImage.includes('linear-gradient')),
  noLayoutFooter:normal.every(r=>r.initial.phone.bottom-r.initial.screen.bottom<10&&r.initial.indicator.bottom<=r.initial.phone.bottom&&r.initial.indicator.y<r.initial.screen.bottom),
  scrollChangesAndRestores:normal.every(r=>r.scrolled.scroll.top>0&&r.restored.scroll.top===0),
  shellGeometryStable:normal.every(r=>same(r.initial.phone,r.scrolled.phone)&&same(r.initial.screen,r.scrolled.screen)&&same(r.initial.indicator,r.scrolled.indicator)&&same(r.initial.phone,r.restored.phone)&&same(r.initial.indicator,r.restored.indicator)),
  safeInsetAndReachableBottom:normal.every(r=>parseFloat(r.initial.contents.paddingBottom)>=30&&r.bottom.lastContent.bottom<=r.bottom.indicator.y+.5),
  explicitProofHasNoIndicator:proof.every(r=>r.initial.indicatorStyle.display==='none'&&r.initial.indicator.width===0&&r.initial.indicator.height===0),
  proofSurfacesRemainFullBleed:results.find(r=>r.id==='proof-desktop').initial.screen.width===1440&&results.find(r=>r.id==='proof-mobile').initial.screen.width===390,
  consoleClean:results.every(r=>!r.console.errors.length&&!r.console.warnings.length),
}
const payload={schema:'brand-browser-probes/v1',brand:'pokemon-tcg-official',attempt:'10-demo-revision7',scope:'phone chassis home-indicator overlay and scroll stability only',results,checks,implementationChecksPass:Object.values(checks).every(Boolean),visualVerdict:'not-assigned-by-implementation-agent'};fs.writeFileSync(path.join(out,'browser-probes.json'),`${JSON.stringify(payload,null,2)}\n`);if(!payload.implementationChecksPass)process.exitCode=1
