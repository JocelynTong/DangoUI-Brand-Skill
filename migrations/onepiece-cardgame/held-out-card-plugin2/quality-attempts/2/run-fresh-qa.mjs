import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/'
const routes = ['pages/plaza/index','pages/build/index','pages/mine/index','pages/event/index?id=0','pages/round/index?event=0&round=1','pages/detail/index?id=0']
const viewports = [{name:'mobile-390x844',width:390,height:844},{name:'desktop-1280x720',width:1280,height:720}]
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--no-sandbox']})
const results = []
for (const vp of viewports) {
  for (const route of routes) {
    const context = await browser.newContext({ viewport:{width:vp.width,height:vp.height}, reducedMotion:'reduce' })
    const page = await context.newPage()
    const writes = []
    page.on('request', req => { if (!['GET','HEAD','OPTIONS'].includes(req.method())) writes.push({method:req.method(),url:req.url()}) })
    const url = base + route
    const response = await page.goto(url,{waitUntil:'networkidle',timeout:30000})
    await page.waitForTimeout(250)
    const safe = route.replace(/[?=&/]/g,'-')
    await page.screenshot({path:path.join(out,`${vp.name}-${safe}.png`),fullPage:true})
    const probe = await page.evaluate(() => {
      const root = document.documentElement
      const controls = [...document.querySelectorAll('[role="button"],[role="tab"]')]
      const visible = controls.filter(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden' })
      const detail = visible.map((el,i) => { const r=el.getBoundingClientRect(); return {i,role:el.getAttribute('role'),tabindex:el.getAttribute('tabindex'),ariaSelected:el.getAttribute('aria-selected'),ariaPressed:el.getAttribute('aria-pressed'),ariaExpanded:el.getAttribute('aria-expanded'),text:(el.textContent||'').trim().slice(0,80),w:r.width,h:r.height} })
      const first = visible[0]
      let focus = null
      if(first){first.focus(); const s=getComputedStyle(first); focus={outline:s.outline,outlineWidth:s.outlineWidth,outlineStyle:s.outlineStyle}}
      const animated=[...document.querySelectorAll('*')].filter(el=>{const s=getComputedStyle(el);return s.animationDuration!=='0s'||s.transitionDuration!=='0s'}).slice(0,20).map(el=>({cls:el.className,animation:getComputedStyle(el).animationDuration,transition:getComputedStyle(el).transitionDuration}))
      return {
        title:document.title,url:location.href,rootClass:root.className,text:document.body.innerText.slice(0,1200),
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,
        body:{font:getComputedStyle(document.body).fontFamily,color:getComputedStyle(document.body).color,background:getComputedStyle(document.body).backgroundColor},
        controls:{count:visible.length,missingTabindex:detail.filter(x=>x.tabindex!=='0'),tabsMissingSelected:detail.filter(x=>x.role==='tab'&&x.ariaSelected===null),sub44:detail.filter(x=>x.w<44||x.h<44),detail},focus,animated,
      }
    })
    results.push({viewport:vp,route,url,status:response?.status(),writes,probe})
    await context.close()
  }
}
await fs.writeFile(path.join(out,'browser-probes.partial.json'),JSON.stringify({generatedAt:new Date().toISOString(),fresh:true,results},null,2))

const journeyContext = await browser.newContext({viewport:{width:390,height:844}})
const journeyPage = await journeyContext.newPage()
await journeyPage.goto(base+'pages/event/index?id=0',{waitUntil:'networkidle'})
const before = await journeyPage.evaluate(()=>({url:location.href,root:document.documentElement.className}))
const more = journeyPage.getByRole('button',{name:/查看全部卡组/}).first()
await more.focus(); await more.press('Enter'); await journeyPage.waitForTimeout(300)
const afterEnter = await journeyPage.evaluate(()=>({url:location.href,root:document.documentElement.className}))
await journeyPage.reload({waitUntil:'networkidle'})
const afterColdReload = await journeyPage.evaluate(()=>({url:location.href,root:document.documentElement.className}))
await journeyPage.goBack({waitUntil:'networkidle'}).catch(()=>{})
const afterBack = await journeyPage.evaluate(()=>({url:location.href,root:document.documentElement.className}))
await journeyContext.close()

const visualContext = await browser.newContext({viewport:{width:1280,height:720}})
const visualPage = await visualContext.newPage()
await visualPage.goto(base+'pages/event/index?id=0',{waitUntil:'networkidle'})
const event = await visualPage.evaluate(()=>{const e=document.querySelector('.event-title,.ev-title,.hero-title,h1');if(!e)return null;const s=getComputedStyle(e);return{text:e.textContent.trim(),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,whiteSpace:s.whiteSpace,overflow:s.overflow,textOverflow:s.textOverflow}})
await visualPage.goto(base+'pages/round/index?event=0&round=1',{waitUntil:'networkidle'})
const round = await visualPage.evaluate(()=>{const el=s=>document.querySelector(s);const read=e=>e?{text:e.textContent.trim().slice(0,100),color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor,borderLeft:getComputedStyle(e).borderLeft}:null;return{page:read(document.body),card:read(el('.deck-card')),name:read(el('.deck-card .name,.deck-card .deck-name,.deck-card .title')),meta:read(el('.deck-card .meta,.deck-card .desc'))}})
await visualContext.close()
await browser.close()
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({generatedAt:new Date().toISOString(),fresh:true,results,journey:{before,afterEnter,afterColdReload,afterBack},event,round},null,2))
