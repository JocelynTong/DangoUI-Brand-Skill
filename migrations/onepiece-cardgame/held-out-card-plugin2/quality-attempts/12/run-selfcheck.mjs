import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/event/index?id=0'
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--no-sandbox'] })
const renders = []
for (const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]) {
  const context = await browser.newContext({ viewport, reducedMotion:'reduce' })
  const page = await context.newPage()
  const requests = [], failed = []
  page.on('request', request => requests.push({method:request.method(),url:request.url()}))
  page.on('requestfailed', request => failed.push({url:request.url(),error:request.failure()?.errorText}))
  await page.goto(base, {waitUntil:'networkidle',timeout:30000})
  const probe = await page.evaluate(() => {
    const q=s=>document.querySelector(s), rect=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
    const head=q('.event-head'), title=q('.event-title'), round=q('.roundcard'), topDeck=q('.topdeck'), after=getComputedStyle(head,'::after')
    return {head:rect(head),title:{text:title.textContent.trim(),rect:rect(title),overflow:getComputedStyle(title).overflow},round:rect(round),topDeck:rect(topDeck),fold:{round:rect(round).top<innerHeight,topDeck:rect(topDeck).top<innerHeight},media:{backgroundImage:getComputedStyle(head).backgroundImage,backgroundSize:getComputedStyle(head).backgroundSize,backgroundPosition:getComputedStyle(head).backgroundPosition,archiveLabel:after.content},overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),motion:{root:getComputedStyle(q('.event-page')).animationName,round:getComputedStyle(round).transitionDuration}}
  })
  const screenshot=`selfcheck-${viewport.width}x${viewport.height}-event.png`
  await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  renders.push({viewport,screenshot,probe,failed,writes:requests.filter(request=>!['GET','HEAD','OPTIONS'].includes(request.method))})
  await context.close()
}

const otherRoutes=[]
for(const route of ['plaza','build','mine','round','detail']){
  const suffix=route==='round'?'?event=0&round=1':route==='detail'?'?id=0':''
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage()
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const png=await page.screenshot({fullPage:true})
  otherRoutes.push({route,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))})
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-event-identity-media-selfcheck/v1',attempt:12,generatedAt:new Date().toISOString(),readOnly:true,renders,otherRoutes},null,2)+'\n')
