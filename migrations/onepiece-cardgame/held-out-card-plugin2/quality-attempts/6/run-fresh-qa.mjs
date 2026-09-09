import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/plaza/index'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox'] })
const viewports = [
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mid-536x864', width: 536, height: 864 },
  { id: 'desktop-1280x720', width: 1280, height: 720 },
]

const renders = []
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', req => requests.push({ method: req.method(), url: req.url() }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const probe = await page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height } }
    const panel = document.querySelector('.filter-panel')
    const env = document.querySelector('.filterline.second .filter-scroll')
    const envChips = [...document.querySelectorAll('.filterline.second .chip')]
    const categoryChips = [...document.querySelectorAll('.filterline:not(.second) .chip')]
    const er = rect(env)
    const visible = envChips.map(el => ({ text:el.textContent.trim(), ...rect(el) })).filter(r => r.right > er.left && r.left < er.right && r.bottom > er.top && r.top < er.bottom)
    const partial = visible.filter(r => r.left < er.left - .5 || r.right > er.right + .5 || r.top < er.top - .5 || r.bottom > er.bottom + .5)
    const uniqueRows = els => new Set(els.map(el => Math.round(el.getBoundingClientRect().top))).size
    const search = document.querySelector('input')
    const season = document.querySelector('.season-banner,[class*="season"]')
    const firstCard = document.querySelector('.deck-card[role="button"]')
    const firstTitle = firstCard?.querySelector('.deck-title,[class*="title"]') || firstCard
    const withinFold = el => { if (!el) return false; const r=el.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && r.bottom > 0 }
    const rail = getComputedStyle(env, '::after')
    const scrollbar = getComputedStyle(env, '::-webkit-scrollbar')
    return {
      document:{ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth) },
      panel:{ ...rect(panel), viewportRatio:rect(panel).height/innerHeight },
      environment:{ ...er, scrollWidth:env.scrollWidth, clientWidth:env.clientWidth, scrollLeft:env.scrollLeft, rowCount:uniqueRows(envChips), optionCount:envChips.length, visibleCount:visible.length, partial },
      category:{ optionCount:categoryChips.length, rowCount:uniqueRows(categoryChips) },
      affordance:{ rail:{content:rail.content,backgroundColor:rail.backgroundColor,width:rail.width,display:rail.display}, scrollbar:{height:scrollbar.height,backgroundColor:scrollbar.backgroundColor} },
      fold:{search:withinFold(search),season:withinFold(season),firstCard:withinFold(firstCard),firstTitle:withinFold(firstTitle), firstCardTop:firstCard ? rect(firstCard).top : null},
      direction:{bodyBackground:getComputedStyle(document.body).backgroundColor,panelRadius:getComputedStyle(panel).borderRadius,chipRadii:envChips.slice(0,4).map(el=>getComputedStyle(el).borderRadius)},
    }
  })
  const file = `${viewport.id}-plaza-filter-fresh.png`
  await page.screenshot({ path:path.join(out,file), fullPage:true })
  renders.push({ viewport, screenshot:file, probe, writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method)) })
  await context.close()
}

async function activate(label, mechanism) {
  const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' })
  const page = await context.newPage(); const requests=[]
  page.on('request',req=>requests.push({method:req.method(),url:req.url()}))
  await page.goto(base,{waitUntil:'networkidle',timeout:30000})
  const chip=page.locator('.filterline.second .chip',{hasText:label}).last()
  const before=await chip.evaluate(el=>({ariaPressed:el.getAttribute('aria-pressed'),active:[...el.parentElement.querySelectorAll('[aria-pressed="true"]')].map(x=>x.textContent.trim())}))
  await chip.focus()
  if(mechanism==='pointer') await chip.click(); else await chip.press(mechanism)
  const after=await chip.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.filter-scroll').getBoundingClientRect();return {ariaPressed:el.getAttribute('aria-pressed'),active:[...el.parentElement.querySelectorAll('[aria-pressed="true"]')].map(x=>x.textContent.trim()),focused:document.activeElement===el,fullyVisible:r.left>=p.left-.5&&r.right<=p.right+.5&&r.top>=p.top-.5&&r.bottom<=p.bottom+.5,scrollLeft:el.closest('.filter-scroll').scrollLeft}})
  await context.close(); return {label,mechanism,before,after,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))}
}

const interactions=[]
for(const mechanism of ['pointer','Enter','Space']) interactions.push(await activate('太阳&月亮-2.0',mechanism))

const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
const page = await context.newPage(); await page.goto(base,{waitUntil:'networkidle',timeout:30000})
const reachability=[]
const chips=await page.locator('.filterline.second .chip').all()
for(let i=0;i<chips.length;i++){
  await chips[i].focus()
  reachability.push(await chips[i].evaluate((el,i)=>{const r=el.getBoundingClientRect(),s=el.closest('.filter-scroll'),p=s.getBoundingClientRect();return {index:i,text:el.textContent.trim(),ariaPressed:el.getAttribute('aria-pressed'),tabIndex:el.tabIndex,fullyVisible:r.left>=p.left-.5&&r.right<=p.right+.5&&r.top>=p.top-.5&&r.bottom<=p.bottom+.5,scrollLeft:s.scrollLeft}},i))
}
const env=page.locator('.filterline.second .filter-scroll')
await env.evaluate(el=>{el.scrollLeft=0})
const box=await env.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,before:el.scrollLeft}})
await page.mouse.move(box.x,box.y); await page.mouse.wheel(600,0)
const trackpad=await env.evaluate(el=>({after:el.scrollLeft,moved:el.scrollLeft>0}))
await context.close()

const attempt4=path.resolve(out,'../4')
const regression=[]
for(const route of ['build','mine','event','round','detail']){
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await c.newPage()
  const suffix=route==='event'?'?id=0':route==='round'?'?event=0&round=1':route==='detail'?'?id=0':''
  await p.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const png=await p.screenshot({fullPage:true}); const sha256=crypto.createHash('sha256').update(png).digest('hex')
  const old=path.join(attempt4,`mobile-390x844-${route}-fresh.png`); let oldSha256=null; try{oldSha256=crypto.createHash('sha256').update(await fs.readFile(old)).digest('hex')}catch{}
  regression.push({route,sha256,attempt4Sha256:oldSha256,exactMatch:sha256===oldSha256,documentOverflow:await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))})
  await c.close()
}
await browser.close()
const result={schema:'heldout-plaza-filter-fresh-qa/v2',attempt:6,generatedAt:new Date().toISOString(),fresh:true,readOnly:true,base,renders,interactions,allEnvironmentOptionsReachability:reachability,trackpadHorizontalScroll:trackpad,regression}
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify(result,null,2)+'\n')
