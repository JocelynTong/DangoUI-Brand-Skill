import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
const out=path.dirname(new URL(import.meta.url).pathname)
const origin='http://127.0.0.1:10092/'
const roundUrl=(event=0,round=0)=>`${origin}#/pages/round/index?event=${event}&round=${round}`
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const renders=[]
for(const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'})
  const page=await context.newPage(),requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(roundUrl(),{waitUntil:'networkidle'})
  const probe=await page.evaluate(()=>{
    const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)]
    const rect=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
    const measure=e=>({text:e.textContent.trim(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,clipped:e.scrollWidth>e.clientWidth+1})
    const controls=qa('.round-page [role="button"]').map(rect)
    return{masthead:rect(q('.softcard')),firstRow:rect(q('.rank-row')),rows:qa('.rank-row').length,goldText:q('.rank.gold')?.textContent.trim(),emptyText:q('.empty-deck .muted-name')?.textContent.trim(),status:q('.stbadge')?.textContent.trim(),texts:qa('.event-name,.round-title,.round-meta,.dname,.line-tag,.au,.stat').map(measure),overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),minControlWidth:Math.min(...controls.map(r=>r.width)),minControlHeight:Math.min(...controls.map(r=>r.height)),undersized:controls.filter(r=>r.width<44||r.height<44).length,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}
  })
  await page.screenshot({path:path.join(out,`selfcheck-${viewport.width}x${viewport.height}-round.png`),fullPage:true})
  const navigation={}
  for(const mode of ['pointer','Enter','Space']){const navPage=await context.newPage();await navPage.goto(roundUrl(),{waitUntil:'networkidle'});const deck=navPage.locator('.deck-card[role="button"]').first();if(mode==='pointer')await deck.click();else{await deck.focus();await navPage.keyboard.press(mode)}await navPage.waitForTimeout(300);navigation[mode]=/pages\/detail\/index/.test(navPage.url());await navPage.close()}
  const statuses=[]
  for(const [event,round] of [[0,0],[2,0],[1,0]]){const statusPage=await context.newPage();await statusPage.goto(roundUrl(event,round),{waitUntil:'networkidle'});statuses.push(await statusPage.evaluate(()=>({event:document.querySelector('.event-name')?.textContent.trim(),status:document.querySelector('.stbadge')?.textContent.trim(),rows:document.querySelectorAll('.rank-row').length,overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)})));await statusPage.close()}
  renders.push({viewport,probe,navigation,statuses,externalWrites:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}
const otherRoutes=[]
for(const name of ['plaza','build','detail','event','mine']){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),suffix=name==='detail'||name==='event'?'?id=0':'';await page.goto(`${origin}#/pages/${name}/index${suffix}`,{waitUntil:'networkidle'});const png=await page.screenshot({fullPage:true});otherRoutes.push({route:name,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))});await context.close()}
await browser.close()
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-round-minimal-experiment-selfcheck/v1',attempt:20,generatedAt:new Date().toISOString(),readOnly:true,renders,otherRoutes},null,2)+'\n')
