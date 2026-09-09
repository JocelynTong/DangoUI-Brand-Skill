import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5174'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/09/revision2')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const surfaces = [
  { id: 'desktop-1440x900', width: 1440, height: 900, proof: 'desktop' },
  { id: 'mobile-390x844', width: 390, height: 844, proof: null },
]
const results = []

for (const surface of surfaces) {
  const page = await browser.newPage({ viewport: { width: surface.width, height: surface.height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  const query = new URLSearchParams({ qa: 'attempt09-r2' })
  if (surface.proof) query.set('proof', surface.proof)
  const route = `${baseUrl}/?${query}#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`
  await page.goto(route, { waitUntil: 'networkidle' })
  const section = page.locator('[data-schema-section-id="home-product-bands"]')
  await section.waitFor()
  const inspect = () => section.evaluate(node => {
    const rect = element => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom } }
    const style = element => { const s=getComputedStyle(element); return { fontFamily:s.fontFamily, fontSize:s.fontSize, fontWeight:s.fontWeight, lineHeight:s.lineHeight, letterSpacing:s.letterSpacing, color:s.color, backgroundColor:s.backgroundColor, opacity:s.opacity, transform:s.transform } }
    const screen = node.closest('.phone-screen')
    return {
      section: rect(node),
      screen: rect(screen),
      backgroundImage: getComputedStyle(node).backgroundImage,
      entryState: node.dataset.entryState,
      copy: { rect: rect(node.querySelector('.pokemon-tcgl__copy')), style: style(node.querySelector('.pokemon-tcgl__copy')) },
      scene: rect(node.querySelector('.pokemon-tcgl__scene')),
      h2: { rect: rect(node.querySelector('h2')), style: style(node.querySelector('h2')) },
      body: { rect: rect(node.querySelector('p')), style: style(node.querySelector('p')) },
      cta: { rect: rect(node.querySelector('.pokemon-tcgl__cta')), style: style(node.querySelector('.pokemon-tcgl__cta')), href: node.querySelector('.pokemon-tcgl__cta').href },
      assets: [...node.querySelectorAll('.pokemon-tcgl__asset')].map(image => ({ className:image.className, src:image.getAttribute('src'), rect:rect(image), natural:[image.naturalWidth,image.naturalHeight] })),
      sectionHorizontalOverflow: node.scrollWidth > node.clientWidth,
      documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hero: rect(document.querySelector('[data-schema-section-id="home-campaign-stage"]')),
      news: rect(document.querySelector('[data-schema-section-id="home-news-grid"]')),
    }
  })
  const settled = await inspect()
  await section.screenshot({ path: path.join(captureDir, `${surface.id}-settled.png`) })
  await section.locator('.pokemon-tcgl__cta').hover()
  await page.waitForTimeout(240)
  const hover = await inspect()
  await section.screenshot({ path: path.join(captureDir, `${surface.id}-hover.png`) })
  results.push({ surface, route, settled, hover, consoleErrors: errors })
  await page.close()
}

const [desktop, mobile] = results
const familyIncludes = (value, family) => value.toLowerCase().includes(family.toLowerCase())
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance
const checks = {
  independentDesktopSurface: near(desktop.settled.screen.width, 1440) && near(desktop.settled.section.width, 1440) && near(desktop.settled.section.height, 624),
  desktopComposition: near(desktop.settled.copy.rect.x - desktop.settled.section.x, 12) && near(desktop.settled.copy.rect.width, 696) && desktop.settled.scene.x > desktop.settled.copy.rect.x,
  independentMobileSurface: near(mobile.settled.screen.width, 390) && near(mobile.settled.section.width, 390) && near(mobile.settled.section.height, 644.625),
  mobileComposition: near(mobile.settled.scene.width, 374) && near(mobile.settled.copy.rect.width, 390) && mobile.settled.scene.y < mobile.settled.copy.rect.y,
  desktopTypography: familyIncludes(desktop.settled.h2.style.fontFamily,'Kanit') && desktop.settled.h2.style.fontSize==='40px' && desktop.settled.h2.style.lineHeight==='44px' && familyIncludes(desktop.settled.body.style.fontFamily,'PT Sans') && desktop.settled.body.style.fontSize==='18px' && desktop.settled.body.style.lineHeight==='28.8px' && desktop.settled.cta.style.fontSize==='20px' && desktop.settled.cta.style.lineHeight==='24px',
  mobileTypography: familyIncludes(mobile.settled.h2.style.fontFamily,'Kanit') && mobile.settled.h2.style.fontSize==='28px' && mobile.settled.h2.style.lineHeight==='30.8px' && familyIncludes(mobile.settled.body.style.fontFamily,'PT Sans') && mobile.settled.body.style.fontSize==='18px' && mobile.settled.body.style.lineHeight==='28.8px' && mobile.settled.cta.style.fontSize==='18px' && mobile.settled.cta.style.lineHeight==='22.5px',
  fiveIndependentAssets: desktop.settled.assets.length===5 && mobile.settled.assets.length===5 && desktop.settled.assets.every(asset => asset.natural[0]>0 && asset.natural[1]>0),
  backgroundAndSeamAsset: desktop.settled.backgroundImage.includes('tcgl-background.jpg') && mobile.settled.backgroundImage.includes('tcgl-background.jpg'),
  ctaTargetAndHover: desktop.settled.cta.href.endsWith('/en-us/tcgl/') && desktop.settled.cta.style.color==='rgb(0, 0, 0)' && desktop.hover.cta.style.color==='rgb(226, 186, 101)' && mobile.hover.cta.style.color==='rgb(226, 186, 101)',
  settledAuthorityOnly: desktop.settled.entryState==='settled' && mobile.settled.entryState==='settled',
  noOverflow: !desktop.settled.sectionHorizontalOverflow && !mobile.settled.sectionHorizontalOverflow && !desktop.settled.documentHorizontalOverflow && !mobile.settled.documentHorizontalOverflow,
  heroNewsRegression: desktop.settled.hero.height===450 && mobile.settled.hero.height===416 && desktop.settled.news.height>0 && mobile.settled.news.height>0,
  consoleClean: results.every(result => result.consoleErrors.length===0),
}
const output = { schema:'brand-browser-probes/v1', brand:'pokemon-tcg-official', attempt:'09-revision2', scope:'home-product-bands', results, checks, implementationChecksPass:Object.values(checks).every(Boolean), motionDisposition:'unresolved candidate; omitted from implementation and scoring', visualVerdict:'not-assigned-by-implementation-agent' }
fs.writeFileSync(path.join(outputDir,'browser-probes.json'), `${JSON.stringify(output,null,2)}\n`)
await browser.close()
if (!output.implementationChecksPass) process.exitCode=1
