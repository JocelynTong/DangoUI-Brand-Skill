import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5179'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/10/demo')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const surfaces = [
  { id:'desktop-1440-settled', width:1440, height:900, proof:'desktop' },
  { id:'mobile-390-settled', width:390, height:844, proof:null },
]
const results = []
const rect = element => { const r=element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom } }

for (const surface of surfaces) {
  const page = await browser.newPage({ viewport:{ width:surface.width, height:surface.height }, deviceScaleFactor:1 })
  const errors=[]
  page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(err.message))
  const query = new URLSearchParams({ qa:'attempt10' }); if (surface.proof) query.set('proof',surface.proof)
  const route = `${baseUrl}/?${query}#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`
  await page.goto(route,{ waitUntil:'networkidle' })
  const section=page.locator('[data-schema-section-id="home-editorial-grid"]'); await section.waitFor()
  const inspect=()=>section.evaluate(node=>{
    const r=element=>{const x=element.getBoundingClientRect();return{x:x.x,y:x.y,width:x.width,height:x.height,right:x.right,bottom:x.bottom}}
    const st=element=>{const s=getComputedStyle(element);return{fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,fontStyle:s.fontStyle,lineHeight:s.lineHeight,color:s.color,backgroundColor:s.backgroundColor}}
    const picture=node.querySelector('.pokemon-pocket__background img')
    const source=node.querySelector('.pokemon-pocket__background source')
    return {section:r(node),screen:r(node.closest('.phone-screen')),assetField:r(node.querySelector('.pokemon-pocket__asset-field')),copy:r(node.querySelector('.pokemon-pocket__copy')),composite:{rect:r(node.querySelector('.pokemon-pocket__composite')),src:node.querySelector('.pokemon-pocket__composite').getAttribute('src'),natural:[node.querySelector('.pokemon-pocket__composite').naturalWidth,node.querySelector('.pokemon-pocket__composite').naturalHeight]},background:{currentSrc:picture.currentSrc,desktopSrc:picture.getAttribute('src'),mobileSrc:source.getAttribute('srcset')},h2:{rect:r(node.querySelector('h2')),style:st(node.querySelector('h2'))},body:{rect:r(node.querySelector('p')),style:st(node.querySelector('p'))},cta:{rect:r(node.querySelector('.pokemon-pocket__cta')),style:st(node.querySelector('.pokemon-pocket__cta')),href:node.querySelector('.pokemon-pocket__cta').href},motionFidelity:node.dataset.motionFidelity,sectionHorizontalOverflow:node.scrollWidth>node.clientWidth,documentHorizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,hero:r(document.querySelector('[data-schema-section-id="home-campaign-stage"]')),news:r(document.querySelector('[data-schema-section-id="home-news-grid"]')),tcgl:r(document.querySelector('[data-schema-section-id="home-product-bands"]'))}
  })
  const settled=await inspect(); await section.screenshot({path:path.join(captureDir,`${surface.id}.png`)})
  await section.locator('.pokemon-pocket__cta').hover(); await page.waitForTimeout(120)
  const hover=await inspect(); await section.screenshot({path:path.join(captureDir,`${surface.id.replace('-settled','-hover')}.png`)})
  results.push({surface,route,settled,hover,consoleErrors:errors}); await page.close()
}

const [desktop,mobile]=results
const near=(a,b,t=1)=>Math.abs(a-b)<=t
const checks={
  independentDesktopSurface:near(desktop.settled.screen.width,1440)&&near(desktop.settled.section.width,1440),
  desktopGeometry:near(desktop.settled.section.height,476.195)&&near(desktop.settled.assetField.width,720)&&near(desktop.settled.copy.width,720),
  independentMobileSurface:near(mobile.settled.screen.width,390)&&near(mobile.settled.section.width,390),
  mobileGeometry:near(mobile.settled.section.height,743.023)&&near(mobile.settled.assetField.height,334.23)&&near(mobile.settled.copy.height,408.793)&&near(mobile.settled.composite.rect.width,370)&&near(mobile.settled.composite.rect.height,226.44),
  responsiveAssets:desktop.settled.background.currentSrc.includes('pocket-background.jpg')&&mobile.settled.background.currentSrc.includes('pocket-header-bg-small.jpg')&&desktop.settled.composite.src.includes('logo-cards.png'),
  typography:desktop.settled.h2.style.fontSize==='40px'&&desktop.settled.h2.style.lineHeight==='44px'&&mobile.settled.h2.style.fontSize==='28px'&&mobile.settled.h2.style.lineHeight==='30.8px'&&mobile.settled.body.style.fontSize==='18px'&&mobile.settled.body.style.lineHeight==='28.8px',
  cta:near(desktop.settled.cta.rect.height,56)&&near(mobile.settled.cta.rect.height,51.297)&&desktop.settled.cta.style.color==='rgb(0, 0, 0)'&&desktop.hover.cta.style.color==='rgb(226, 186, 101)'&&mobile.hover.cta.style.color==='rgb(226, 186, 101)'&&desktop.settled.cta.href==='https://tcgpocket.pokemon.com/en-us',
  motionTruthful:results.every(x=>x.settled.motionFidelity==='unresolved-unscored'),
  noOverflow:results.every(x=>!x.settled.sectionHorizontalOverflow&&!x.settled.documentHorizontalOverflow),
  priorSectionsUnchanged:near(desktop.settled.hero.height,450)&&near(mobile.settled.hero.height,416)&&desktop.settled.news.height>0&&mobile.settled.news.height>0&&desktop.settled.tcgl.height>0&&mobile.settled.tcgl.height>0,
  consoleClean:results.every(x=>x.consoleErrors.length===0),
}
const output={schema:'brand-browser-probes/v1',brand:'pokemon-tcg-official',attempt:10,scope:'home-editorial-grid',results,checks,implementationChecksPass:Object.values(checks).every(Boolean),motionDisposition:'unresolved/unscored; omitted from implementation',visualVerdict:'not-assigned-by-implementation-agent'}
fs.writeFileSync(path.join(outputDir,'browser-probes.json'),`${JSON.stringify(output,null,2)}\n`)
await browser.close()
if(!output.implementationChecksPass)process.exitCode=1
