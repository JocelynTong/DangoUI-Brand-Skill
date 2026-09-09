import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out=path.dirname(new URL(import.meta.url).pathname), base='http://127.0.0.1:10092/#/pages/event/index?id=0'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const renders=[]
for(const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),requests=[],failed=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}))
  await page.goto(base,{waitUntil:'networkidle',timeout:30000})
  const probe=await page.evaluate(()=>{const q=s=>document.querySelector(s),rect=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const h=q('.event-head'),r=q('.roundcard'),t=q('.topdeck');return{backgroundImage:getComputedStyle(h).backgroundImage,head:rect(h),round:rect(r),topDeck:rect(t),fold:{round:rect(r).top<innerHeight,topDeck:rect(t).top<innerHeight},title:q('.event-title').textContent.trim(),overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)}})
  const screenshot=`selfcheck-${viewport.width}x${viewport.height}-event.png`;await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  renders.push({viewport,screenshot,probe,failed,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))});await context.close()
}
const otherRoutes=[]
for(const route of ['plaza','build','mine','round','detail']){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),suffix=route==='round'?'?event=0&round=1':route==='detail'?'?id=0':'';await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000});const png=await page.screenshot({fullPage:true});otherRoutes.push({route,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))});await context.close()}
await browser.close();await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-event-provenance-closure-selfcheck/v1',attempt:13,generatedAt:new Date().toISOString(),readOnly:true,renders,otherRoutes},null,2)+'\n')
