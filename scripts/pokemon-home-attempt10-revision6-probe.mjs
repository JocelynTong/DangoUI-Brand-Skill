import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl=process.argv[2]||'http://127.0.0.1:5177'
const out=path.resolve('migrations/pokemon-tcg-official/quality-attempts/10/demo-revision6'), captures=path.join(out,'captures')
fs.mkdirSync(captures,{recursive:true})
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const route=id=>`#/brand/pokemon-tcg-official/pages/${id}`
const cases=[
  {id:'normal-home',pageId:'pokemon-tcg-official-home',viewport:{width:1200,height:900},query:'?qa=attempt10-revision6',section:'home-campaign-stage'},
  {id:'normal-pocket-fixture',pageId:'pokemon-tcg-official-pocket-fixture',viewport:{width:1200,height:900},query:'?qa=attempt10-revision6',section:'held-out-pocket-family'},
  {id:'proof-desktop-pocket',pageId:'pokemon-tcg-official-pocket-fixture',viewport:{width:1440,height:900},query:'?qa=attempt10-revision6&proof=desktop',section:'held-out-pocket-family'},
  {id:'proof-mobile-pocket',pageId:'pokemon-tcg-official-pocket-fixture',viewport:{width:390,height:844},query:'?qa=attempt10-revision6&proof=mobile',section:'held-out-pocket-family'},
]
const results=[]
for(const test of cases){
  const page=await browser.newPage({viewport:test.viewport,deviceScaleFactor:1}); const errors=[],warnings=[]
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${baseUrl}/${test.query}${route(test.pageId)}`,{waitUntil:'networkidle'})
  const section=page.locator(`[data-schema-section-id="${test.section}"]`); await section.waitFor()
  const before=await page.evaluate(sectionId=>{const phone=document.querySelector('.phone.template-phone'),screen=phone.querySelector('.phone-screen'),content=screen.querySelector('.contents'),section=document.querySelector(`[data-schema-section-id="${sectionId}"]`),fs=getComputedStyle(phone),ss=getComputedStyle(screen),pseudo=getComputedStyle(phone,'::before'),r=e=>{const x=e.getBoundingClientRect();return{x:x.x,y:x.y,width:x.width,height:x.height,right:x.right,bottom:x.bottom}};return{url:location.href,phoneClass:phone.className,proofRole:section.dataset.proofRole||null,phone:r(phone),screen:r(screen),content:r(content),section:r(section),frame:{borderTopWidth:fs.borderTopWidth,borderRadius:fs.borderRadius,backgroundColor:fs.backgroundColor,pseudoContent:pseudo.content,pseudoShadow:pseudo.boxShadow},screenStyle:{borderRadius:ss.borderRadius,clipPath:ss.clipPath,overflowY:ss.overflowY,overflowX:ss.overflowX},scroll:{top:screen.scrollTop,clientHeight:screen.clientHeight,scrollHeight:screen.scrollHeight}}},test.section)
  await page.screenshot({path:path.join(captures,`${test.id}.png`),fullPage:false})
  let afterScroll=null
  if(test.id==='normal-home'){afterScroll=await page.evaluate(()=>{const s=document.querySelector('.phone-screen');s.scrollTop=240;return{top:s.scrollTop,clientHeight:s.clientHeight,scrollHeight:s.scrollHeight}})}
  results.push({...test,before,afterScroll,console:{errors,warnings}});await page.close()
}
await browser.close()
const by=id=>results.find(r=>r.id===id),normal=results.filter(r=>r.id.startsWith('normal-')),desktop=by('proof-desktop-pocket'),mobile=by('proof-mobile-pocket')
const checks={
  normalFrameVisible:normal.every(r=>parseFloat(r.before.frame.borderTopWidth)>0&&parseFloat(r.before.frame.borderRadius)>0&&r.before.frame.pseudoContent!=='none'&&r.before.frame.pseudoShadow!=='none'),
  normalScreenRoundedAndScrollable:normal.every(r=>parseFloat(r.before.screenStyle.borderRadius)>0&&r.before.screenStyle.clipPath!=='none'&&r.before.screenStyle.overflowY==='auto')&&by('normal-home').afterScroll.top>0,
  proofRoleDoesNotRemoveShell:by('normal-pocket-fixture').before.proofRole==='generative-held-out-fictional'&&parseFloat(by('normal-pocket-fixture').before.frame.borderTopWidth)>0,
  desktopExplicitNoShell:desktop.before.phoneClass.includes('template-phone--source-desktop')&&desktop.before.phone.width===1440&&parseFloat(desktop.before.frame.borderTopWidth)===0&&parseFloat(desktop.before.frame.borderRadius)===0,
  mobileExplicitNoShell:mobile.before.phoneClass.includes('template-phone--source-mobile-proof')&&mobile.before.phone.width===390&&mobile.before.phone.height===844&&parseFloat(mobile.before.frame.borderTopWidth)===0&&parseFloat(mobile.before.frame.borderRadius)===0,
  proofFullBleed:Math.abs(desktop.before.section.x)<.5&&desktop.before.section.width===1440&&Math.abs(mobile.before.section.x)<.5&&mobile.before.section.width===390,
  normalContentUsesScreen:normal.every(r=>Math.abs(r.before.section.x-r.before.screen.x)<.5&&Math.abs(r.before.section.width-r.before.screen.width)<.5),
  consoleClean:results.every(r=>!r.console.errors.length&&!r.console.warnings.length),
}
const payload={schema:'brand-browser-probes/v1',brand:'pokemon-tcg-official',attempt:'10-demo-revision6',scope:'normal mockup shell versus explicit desktop/mobile calibration modes',results,checks,implementationChecksPass:Object.values(checks).every(Boolean),visualVerdict:'not-assigned-by-implementation-agent'}
fs.writeFileSync(path.join(out,'browser-probes.json'),`${JSON.stringify(payload,null,2)}\n`);if(!payload.implementationChecksPass)process.exitCode=1
