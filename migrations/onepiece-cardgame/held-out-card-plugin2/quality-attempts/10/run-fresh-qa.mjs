import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/plaza/index'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox'] })
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const renders = []

const css = (el) => {
  const s = getComputedStyle(el)
  return { display: s.display, visibility: s.visibility, opacity: s.opacity, pointerEvents: s.pointerEvents, cursor: s.cursor, color: s.color, backgroundColor: s.backgroundColor, border: s.border, borderRadius: s.borderRadius, boxShadow: s.boxShadow, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, padding: s.padding }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const probe = await page.evaluate((cssSource) => {
    const css = eval(`(${cssSource})`)
    const q = selector => document.querySelector(selector)
    const qa = selector => [...document.querySelectorAll(selector)]
    const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height } }
    const regions = { head:q('.ghead'), nav:q('.tabs-row'), search:q('.search'), input:q('input'), panel:q('.filter-panel'), campaign:q('.pitch-season-strip'), card:q('.deck-card'), env:q('.filterline.second .filter-scroll') }
    const capsule = q('.system-capsule'), switchEl = q('.miniapp-switch'), arrow = q('.switch-arrow'), ballC = q('.ball-c')
    return {
      document:{ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth) },
      regions:Object.fromEntries(Object.entries(regions).map(([key,el]) => [key, el ? { rect:rect(el), css:css(el) } : null])),
      masthead:{
        capsule:{ present:!!capsule, ariaHidden:capsule?.getAttribute('aria-hidden'), rect:capsule?rect(capsule):null, css:capsule?css(capsule):null },
        miniappTitle:{ role:switchEl?.getAttribute('role'), tabIndex:switchEl?.tabIndex, ariaLabel:switchEl?.getAttribute('aria-label'), ariaExpanded:switchEl?.getAttribute('aria-expanded'), rect:switchEl?rect(switchEl):null, css:switchEl?css(switchEl):null },
        arrow:{ present:!!arrow, text:arrow?.textContent, rect:arrow?rect(arrow):null, css:arrow?css(arrow):null },
        innerC:{ present:!!ballC, rect:ballC?rect(ballC):null, css:ballC?css(ballC):null },
        focusableDescendants:qa('.ghead button,.ghead a,.ghead input,.ghead select,.ghead textarea,.ghead [tabindex="0"],[role="button"],[role="link"],[role="switch"]').filter(el => el.closest('.ghead')).length
      },
      counts:{ filterButtons:qa('.filterline .chip[role="button"]').length, environmentButtons:qa('.filterline.second .chip[role="button"]').length, cards:qa('.deck-card[role="button"]').length, tabs:qa('[role="tab"]').length, searchInputs:qa('.search input').length },
      fold:{ campaign:rect(regions.campaign).top<innerHeight, firstCard:rect(regions.card).top<innerHeight }
    }
  }, css.toString())
  const title = page.locator('.miniapp-switch')
  const beforeHover = await title.evaluate(el => ({ color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor, border:getComputedStyle(el).border, boxShadow:getComputedStyle(el).boxShadow, transform:getComputedStyle(el).transform }))
  await title.hover({ force:true }); await page.waitForTimeout(120)
  const afterHover = await title.evaluate(el => ({ color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor, border:getComputedStyle(el).border, boxShadow:getComputedStyle(el).boxShadow, transform:getComputedStyle(el).transform }))
  probe.masthead.hoverVisualDelta = { before:beforeHover, after:afterHover, unchanged:JSON.stringify(beforeHover)===JSON.stringify(afterHover) }
  const screenshot = `fresh-${viewport.width}x${viewport.height}-plaza.png`
  await page.screenshot({ path:path.join(out,screenshot), fullPage:true })
  renders.push({ viewport, screenshot, probe, writes:requests.filter(r => !['GET','HEAD','OPTIONS'].includes(r.method)) })
  await context.close()
}

const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' })
const page = await context.newPage(); const requests=[]; page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
await page.goto(base,{waitUntil:'networkidle',timeout:30000})
const envs=page.locator('.filterline.second .chip'); const reachability=[]
for(let i=0;i<await envs.count();i++){const e=envs.nth(i);await e.focus();reachability.push(await e.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.filter-scroll').getBoundingClientRect();return{text:el.textContent.trim(),role:el.getAttribute('role'),tabIndex:el.tabIndex,pressed:el.getAttribute('aria-pressed'),focused:document.activeElement===el,fullyVisible:r.left>=p.left-.5&&r.right<=p.right+.5&&r.top>=p.top-.5&&r.bottom<=p.bottom+.5}}))}
async function activate(kind,sel){await page.goto(base,{waitUntil:'networkidle'});const e=page.locator(sel).first();await e.focus();const before=await e.getAttribute('aria-pressed')??await e.getAttribute('aria-selected');if(kind==='pointer')await e.click();else await e.press(kind);return{kind,before,after:await e.getAttribute('aria-pressed')??await e.getAttribute('aria-selected'),url:page.url()}}
const interactions=[]; for(const kind of ['pointer','Enter','Space']) interactions.push(await activate(kind,'.filterline.second .chip:last-child'))
await page.goto(base,{waitUntil:'networkidle'}); await page.locator('input').fill('耿鬼'); const search={value:await page.locator('input').inputValue(),visibleCards:await page.locator('.deck-card').count()}
const tab=[]; for(const kind of ['pointer','Enter','Space']) tab.push(await activate(kind,'.pt:nth-child(2)'))
await page.goto(base,{waitUntil:'networkidle'}); const before=page.url(); await page.locator('.deck-card').first().click(); await page.waitForTimeout(300); const cardNavigation={before,after:page.url(),changed:page.url()!==before}
await context.close()

const regression=[]; const oldDir=path.resolve(out,'../9')
for(const route of ['build','mine','event','round','detail']){const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();const suffix=route==='event'?'?id=0':route==='round'?'?event=0&round=1':route==='detail'?'?id=0':'';await p.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000});const png=await p.screenshot({fullPage:true});const sha=crypto.createHash('sha256').update(png).digest('hex');regression.push({route,sha256:sha,overflowPx:await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))});await c.close()}
await browser.close()
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-plaza-standard-sample-fresh-qa/v1',attempt:10,generatedAt:new Date().toISOString(),fresh:true,readOnly:true,base,renders,reachability,interactions,search,tab,cardNavigation,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method)),regression},null,2)+'\n')
