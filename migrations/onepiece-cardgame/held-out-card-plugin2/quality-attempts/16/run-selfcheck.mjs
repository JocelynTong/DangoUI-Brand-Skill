import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/build/index'
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const renders = []
const rect = e => e && (() => { const r = e.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height } })()

for (const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]) {
  const context = await browser.newContext({ viewport, reducedMotion:'reduce' })
  const page = await context.newPage()
  const writes = []
  page.on('request', r => { if (!['GET','HEAD','OPTIONS'].includes(r.method())) writes.push({method:r.method(),url:r.url()}) })
  await page.goto(base, { waitUntil:'networkidle', timeout:30000 })
  const defaultProbe = await page.evaluate(() => {
    const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)]
    const rr=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
    const interactive=qa('.build [role="button"],.build [role="tab"]:not(.pg-hidden)').filter(e=>getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none').map(e=>({cls:e.className,rect:rr(e)}))
    return {
      header:rr(q('.dkhead')), search:rr(q('.b-search')), view:rr(q('.viewtoggle')),
      filterRows:qa('.filter-row').map(rr), firstCard:rr(q('.lrow,.pgcard')), tray:rr(q('.tray')),
      overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
      minInteractiveHeight:Math.min(...interactive.map(x=>x.rect.height)),
      undersized:interactive.filter(x=>x.rect.width<44||x.rect.height<44).slice(0,20)
    }
  })
  await page.screenshot({path:path.join(out,`selfcheck-${viewport.width}x${viewport.height}-build-default.png`)})
  await page.locator('.filter-more').click()
  const expanded = await page.evaluate(() => ({rows:document.querySelectorAll('.filter-row').length,overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)}))
  await page.locator('.viewtoggle').click()
  await page.screenshot({path:path.join(out,`selfcheck-${viewport.width}x${viewport.height}-build-grid.png`)})
  await page.locator('.pubbtn').first().click()
  const sheetProbe = await page.evaluate(() => {
    const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)], rr=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
    return {sheet:rr(q('.sheet')),fields:qa('.envselect,.sheet-input,.sheet-area').map(rr),actions:qa('.sheet-draft,.sheet-publish,.sheet-close').map(rr),coverChoices:qa('.cover-choice').map(rr),overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)}
  })
  await page.screenshot({path:path.join(out,`selfcheck-${viewport.width}x${viewport.height}-build-sheet.png`)})
  await page.locator('.sheet-publish').click()
  const invalidState = await page.evaluate(() => ({sheetStillOpen:document.querySelector('.sheet')?.classList.contains('on'),toastText:document.body.innerText.includes('请选择封面')||document.body.innerText.includes('请输入卡组名')||document.body.innerText.includes('卡组')}))
  renders.push({viewport,defaultProbe,expanded,sheetProbe,invalidState,writes})
  await context.close()
}

const otherRoutes=[]
for(const route of ['plaza','detail','mine','event','round']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),suffix=route==='detail'||route==='event'?'?id=0':route==='round'?'?event=0&round=1':''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const png=await page.screenshot({fullPage:true})
  otherRoutes.push({route,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))})
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-build-minimal-experiment-selfcheck/v1',attempt:16,generatedAt:new Date().toISOString(),readOnly:true,renders,otherRoutes},null,2)+'\n')
