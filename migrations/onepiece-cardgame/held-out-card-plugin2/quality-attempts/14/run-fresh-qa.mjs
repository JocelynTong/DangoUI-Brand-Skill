import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/detail/index?id=0'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox'] })
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const renders = []

const visible = el => { const r=el?.getBoundingClientRect(); return !!r && r.width>0 && r.height>0 }
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage(); const requests=[]; const failed=[]
  page.on('request', r => requests.push({ method:r.method(), url:r.url() }))
  page.on('requestfailed', r => failed.push({ url:r.url(), error:r.failure()?.errorText||null }))
  await page.goto(base, { waitUntil:'networkidle', timeout:30000 })
  const probe = await page.evaluate(() => {
    const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)]
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}}
    const item=e=>e?{text:e.textContent.trim(),rect:rect(e),radius:getComputedStyle(e).borderRadius,border:getComputedStyle(e).border,background:getComputedStyle(e).backgroundColor,clipped:e.scrollWidth>e.clientWidth+.5||e.scrollHeight>e.clientHeight+.5}:null
    const focus=qa('[role="button"],[role="tab"],[tabindex="0"]')
    return {
      document:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),scrollHeight:document.documentElement.scrollHeight},
      regions:{page:item(q('.detail')),identity:item(q('.dhead')),cover:item(q('.dcover')),title:item(q('.dtitle')),author:item(q('.dauthor')),description:item(q('.descwrap')),stats:item(q('.statcard')),switcher:item(q('.secnav')),content:item(q('.grid')),actions:item(q('.dbottom'))},
      text:{title:q('.dtitle')?.textContent.trim(),author:q('.dau')?.textContent.trim(),environment:q('.tag-env')?.textContent.trim(),updated:q('.ddot')?.textContent.trim(),description:q('.ddesc')?.textContent.trim(),stats:qa('.stat-col').map(e=>e.textContent.trim()),tabs:qa('.tb').map(e=>({text:e.textContent.trim(),selected:e.getAttribute('aria-selected')})),counts:{cards:qa('.gcard').length,txtRows:qa('.txt-row').length}},
      focusTargets:focus.map(e=>{const r=rect(e);return {text:e.textContent.trim(),role:e.getAttribute('role'),tabIndex:e.tabIndex,width:r.width,height:r.height,meets44:r.width>=44&&r.height>=44}}),
      clipped:qa('.dtitle,.tag-env,.tag-camp,.dau,.ddot,.ddesc,.stat-v,.stat-l,.stat-price,.tb-t,.dc-total,.dc-by-i,.dbtn-t').filter(e=>e.scrollWidth>e.clientWidth+.5||e.scrollHeight>e.clientHeight+.5).map(e=>({class:String(e.className),text:e.textContent.trim(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})),
      visibleAnimations:qa('*').filter(e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return s.animationName!=='none'&&s.animationDuration!=='0s'&&r.width>0&&r.height>0}).map(e=>({class:String(e.className),animation:getComputedStyle(e).animation})).slice(0,20),
      editVisible:qa('*').some(e=>/编辑/.test(e.textContent||'')&&visible(e))
    }
  })
  const screenshot=`fresh-${viewport.width}x${viewport.height}-detail.png`
  await page.screenshot({ path:path.join(out,screenshot), fullPage:true })
  renders.push({viewport,screenshot,probe,failed,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}

async function isolated(kind, selector, assertion) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await context.newPage(); const requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(base,{waitUntil:'networkidle',timeout:30000})
  const el=page.locator(selector).first(); await el.scrollIntoViewIfNeeded(); await el.focus()
  const before=await el.evaluate(e=>({text:e.textContent.trim(),role:e.getAttribute('role'),tabIndex:e.tabIndex,focused:document.activeElement===e,ariaPressed:e.getAttribute('aria-pressed'),ariaSelected:e.getAttribute('aria-selected'),ariaExpanded:e.getAttribute('aria-expanded')}))
  if(kind==='pointer') await el.click(); else await el.press(kind)
  await page.waitForTimeout(180)
  const after={url:page.url(),body:await page.locator('body').innerText(),viewer:await page.locator('.cv.on').count(),selectedText:await page.locator('.tb[aria-selected="true"]').innerText().catch(()=>null),pressed:await el.getAttribute('aria-pressed').catch(()=>null),expanded:await el.getAttribute('aria-expanded').catch(()=>null)}
  const pass=assertion(after,before)
  const writes=requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))
  await context.close(); return {kind,selector,before,after,pass,writes}
}

const interactions=[]
for(const kind of ['pointer','Enter','Space']) interactions.push(await isolated(kind,'.desc-toggle-inline',(a,b)=>a.expanded!==b.ariaExpanded))
for(const kind of ['pointer','Enter','Space']) interactions.push(await isolated(kind,'.dbtn-fav',(a,b)=>a.pressed!==b.ariaPressed))
for(const kind of ['pointer','Enter','Space']) interactions.push(await isolated(kind,'.dbtn-copy',a=>a.url.includes('/pages/build/index')))
for(const kind of ['pointer','Enter','Space']) interactions.push(await isolated(kind,'.buybtn',a=>a.body.includes('去购买 ｜ 跳转卡组 SPU')))
for(const kind of ['pointer','Enter','Space']) interactions.push(await isolated(kind,'.tb:nth-child(2)',a=>a.selectedText.includes('文字')&&a.body.includes('宝可梦')))
for(const kind of ['pointer','Enter','Space']) interactions.push(await isolated(kind,'.gcard',a=>a.viewer===1))

const regression=[]
for(const route of ['plaza','build','mine','event','round']) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  const page=await context.newPage(); const requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  const suffix=route==='round'?'?event=0&round=1':''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const png=await page.screenshot({fullPage:true}); const sha256=crypto.createHash('sha256').update(png).digest('hex')
  const probe=await page.evaluate(()=>({overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),title:document.title,bodyText:document.body.innerText.slice(0,160)}))
  regression.push({route,sha256,...probe,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}

await browser.close()
const output={schema:'heldout-detail-minimal-fresh-qa/v1',attempt:14,generatedAt:new Date().toISOString(),fresh:true,readOnly:true,base,renders,interactions,writes:[...renders.flatMap(x=>x.writes),...interactions.flatMap(x=>x.writes),...regression.flatMap(x=>x.writes)],regression}
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify(output,null,2)+'\n')
