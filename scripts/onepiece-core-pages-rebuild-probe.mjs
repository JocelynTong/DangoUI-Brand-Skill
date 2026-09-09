import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = process.cwd()
const base = process.env.ONEPIECE_BASE_URL || 'http://127.0.0.1:5181'
const out = path.join(root, 'migrations/onepiece-cardgame/core-pages-rebuild')
const captures = path.join(out, 'captures')
fs.mkdirSync(captures, { recursive: true })
const ids = ['home', 'news', 'products', 'events', 'editorial-held-out']
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true })
const report = { schema:'onepiece-core-pages-rebuild-probe/v1', base, generatedAt:new Date().toISOString(), pages:{}, verdictBoundary:'implementation self-test only; independent visual QA not run' }
for (const id of ids) {
  report.pages[id] = {}
  for (const mode of [{name:'desktop',width:1280,height:720},{name:'phone',width:390,height:844}]) {
    const page = await browser.newPage({ viewport:{width:mode.width,height:mode.height}, deviceScaleFactor:1 })
    const errors=[]
    page.on('console', msg => { if(msg.type()==='error') errors.push(msg.text()) })
    await page.goto(`${base}/#/brand/onepiece-cardgame/pages/onepiece-cardgame-${id}`, {waitUntil:'networkidle'})
    const screen = page.locator('.phone-screen').first()
    await screen.waitFor({state:'visible'})
    const probe = await screen.evaluate(async el => {
      const imgs=[...el.querySelectorAll('img')]
      const before=el.scrollTop
      el.scrollTop=Math.min(360,el.scrollHeight-el.clientHeight)
      await new Promise(r=>setTimeout(r,120))
      const after=el.scrollTop
      el.scrollTop=before
      await new Promise(r=>setTimeout(r,80))
      const screenScrollable=el.scrollHeight>el.clientHeight
      let windowScroll=null
      if(!screenScrollable){
        const windowBefore=window.scrollY
        window.scrollTo(0,Math.min(360,document.documentElement.scrollHeight-window.innerHeight))
        await new Promise(r=>setTimeout(r,120))
        const windowAfter=window.scrollY
        window.scrollTo(0,windowBefore)
        await new Promise(r=>setTimeout(r,80))
        windowScroll={before:windowBefore,after:windowAfter,restored:window.scrollY,scrollHeight:document.documentElement.scrollHeight,clientHeight:window.innerHeight}
      }
      return {sections:el.querySelectorAll('[data-schema-section-id]').length,scrollOwner:screenScrollable?'phone-screen':'window',scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,before,after,restored:el.scrollTop,windowScroll,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,images:imgs.length,brokenImages:imgs.filter(img=>!img.complete||img.naturalWidth===0).length}
    })
    if (id === 'home') {
      probe.initialHero = await screen.locator('[data-schema-section-id="home-hero"]').evaluate(el => ({
        activeControl: el.querySelector('.source-schema-demo__hero-controls button.is-active')?.textContent?.trim() || '',
        title: el.querySelector('.source-schema-demo__hero-heldout-title')?.textContent?.trim() || '',
        backgroundImage: getComputedStyle(el).backgroundImage,
        productSrc: el.querySelector('.source-schema-demo__hero-cards img')?.getAttribute('src') || '',
        titleImageSrc: el.querySelector('.source-schema-demo__hero-title-image')?.getAttribute('src') || null,
      }))
    }
    if (id === 'news') {
      probe.newsLead = await screen.locator('[data-schema-section-id="news-feature"]').evaluate(el => ({
        title: el.querySelector('.opcg-news-feature__lead-copy h1')?.textContent?.trim() || '',
        imageSrc: el.querySelector('.opcg-news-feature__lead-image')?.getAttribute('src') || '',
        fictionalLeadPresent: /A NEW VOYAGE BEGINS/i.test(el.textContent || ''),
      }))
    }
    if (id === 'products') {
      probe.catalog = await screen.evaluate(el => ({
        productCells: el.querySelectorAll('.source-schema-demo__product-grid article').length,
        filters: el.querySelectorAll('.source-schema-demo__catalog-filters button').length,
        paginationVisible: Boolean(el.querySelector('[data-schema-section-id="product-pagination"]')),
      }))
    }
    const initial=`${id}-${mode.name}-initial.png`
    await page.screenshot({path:path.join(captures,initial),fullPage:false})
    await screen.evaluate(el=>{if(el.scrollHeight>el.clientHeight)el.scrollTop=Math.min(520,el.scrollHeight-el.clientHeight);else window.scrollTo(0,Math.min(520,document.documentElement.scrollHeight-window.innerHeight))})
    await page.waitForTimeout(120)
    const scrolled=`${id}-${mode.name}-scrolled.png`
    await page.screenshot({path:path.join(captures,scrolled),fullPage:false})
    const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(captures,file))).digest('hex')
    report.pages[id][mode.name]={...probe,errors, captures:[{path:`core-pages-rebuild/captures/${initial}`,sha256:hash(initial)},{path:`core-pages-rebuild/captures/${scrolled}`,sha256:hash(scrolled)}]}
    await page.close()
  }
}
await browser.close()
fs.writeFileSync(path.join(out,'browser-probe.json'),`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify(report,null,2))
