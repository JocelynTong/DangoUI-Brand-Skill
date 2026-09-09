import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/event/index?id=0'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox'] })
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const renders = []

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  const failed = []
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
  page.on('requestfailed', request => failed.push({ url: request.url(), error: request.failure()?.errorText || null }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const probe = await page.evaluate(() => {
    const q = selector => document.querySelector(selector)
    const qa = selector => [...document.querySelectorAll(selector)]
    const rect = element => { const r = element.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height } }
    const item = element => element ? { text:element.textContent.trim(), rect:rect(element), clipped:element.scrollWidth>element.clientWidth+.5 || element.scrollHeight>element.clientHeight+.5 } : null
    const head=q('.event-head'), title=q('.event-title'), badge=q('.stbadge'), metrics=q('.info-grid'), firstRound=q('.roundcard'), topDeck=q('.topdeck'), more=q('.more')
    const backgroundImage = getComputedStyle(head).backgroundImage
    return {
      document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),scrollHeight:document.documentElement.scrollHeight},
      regions:{head:item(head),title:item(title),badge:item(badge),metrics:item(metrics),firstRound:item(firstRound),topDeck:item(topDeck),more:item(more)},
      counts:{roundCards:qa('.roundcard').length,topDecks:qa('.topdeck').length,roundActions:qa('.more').length,metrics:qa('.info-cell').length},
      fold:{headComplete:rect(head).bottom<=innerHeight,firstRoundVisible:rect(firstRound).top<innerHeight,topDeckVisible:rect(topDeck).top<innerHeight,roundActionVisible:rect(more).top<innerHeight},
      text:{title:title?.textContent.trim(),status:badge?.textContent.trim(),metrics:qa('.info-cell').map(e=>e.textContent.trim()),firstRound:firstRound?.textContent.trim(),topDeck:topDeck?.textContent.trim()},
      media:{backgroundImage,logoLoaded:backgroundImage.includes('me05-logo-2x.png'),darkraiLoaded:backgroundImage.includes('KD5B_EN_116.png')},
      clippedText:qa('.event-title,.stbadge,.info-v,.info-l,.round-title,.round-meta,.top-name,.top-author,.line-tag,.more').filter(el=>el.scrollWidth>el.clientWidth+.5||el.scrollHeight>el.clientHeight+.5).map(el=>({text:el.textContent.trim(),class:String(el.className),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth})),
      visibleAnimations:qa('*').filter(el=>{const s=getComputedStyle(el);return s.animationName!=='none'&&s.animationDuration!=='0s'&&rect(el).width>0&&rect(el).height>0}).map(el=>({class:String(el.className),animation:getComputedStyle(el).animation})).slice(0,20)
    }
  })
  const screenshot=`fresh-${viewport.width}x${viewport.height}-event.png`
  await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  renders.push({viewport,screenshot,probe,failed,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method)),assetRequests:requests.filter(r=>/me05-logo-2x|KD5B_EN_116/.test(r.url))})
  await context.close()
}

async function activation(selector, kind, expectedPath) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await context.newPage(); const requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(base,{waitUntil:'networkidle',timeout:30000})
  const element=page.locator(selector).first(); await element.scrollIntoViewIfNeeded(); await element.focus()
  const semantics=await element.evaluate(node=>({role:node.getAttribute('role'),tabIndex:node.tabIndex,focused:document.activeElement===node,ariaLabel:node.getAttribute('aria-label'),text:node.textContent.trim()}))
  const before=page.url()
  if(kind==='pointer') await element.click(); else await element.press(kind)
  await page.waitForTimeout(350)
  const after=page.url()
  await page.goBack({waitUntil:'networkidle'}).catch(()=>{}); await page.waitForTimeout(200)
  const back=page.url(); await page.reload({waitUntil:'networkidle'}); const reload=page.url()
  const writes=requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))
  await context.close()
  return {selector,kind,semantics,before,after,matched:after.includes(expectedPath),back,reload,backRestored:back===before,reloadStable:reload===before,writes}
}

const interactions=[]
for(const kind of ['pointer','Enter','Space']) interactions.push(await activation('.more',kind,'/pages/round/index'))
for(const kind of ['pointer','Enter','Space']) interactions.push(await activation('.topdeck',kind,'/pages/detail/index'))

const prior=JSON.parse(await fs.readFile(path.resolve(out,'../12/browser-probes.json'),'utf8'))
const priorHashes=Object.fromEntries((prior.regression||[]).map(x=>[x.route,x.sha256]))
const regression=[]
for(const route of ['plaza','build','mine','round','detail']) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await context.newPage(); const requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  const suffix=route==='round'?'?event=0&round=1':route==='detail'?'?id=0':''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const png=await page.screenshot({fullPage:true}); const sha256=crypto.createHash('sha256').update(png).digest('hex')
  const overflowPx=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))
  regression.push({route,sha256,priorSha256:priorHashes[route]||null,materiallyIdentical:priorHashes[route]===sha256,overflowPx,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}

await browser.close()
const output={schema:'heldout-event-provenance-fresh-qa/v1',attempt:13,generatedAt:new Date().toISOString(),fresh:true,readOnly:true,base,renders,interactions,writes:[...renders.flatMap(x=>x.writes),...interactions.flatMap(x=>x.writes),...regression.flatMap(x=>x.writes)],regression}
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify(output,null,2)+'\n')
