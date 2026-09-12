import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '../..')
const out = path.join(import.meta.dirname, 'captures', 'source')
fs.mkdirSync(out, { recursive: true })
const executablePath = path.join(process.env.HOME, 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell')
const browser = await chromium.launch({ headless: true, executablePath })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } })
const page = await context.newPage()
await page.goto('https://re.bluepoch.com/home/', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

const pages = [
  { id: 'home', nav: '#banner0', slide: '#slide1' },
  { id: 'news', nav: '#banner1', slide: '#slide2' },
  { id: 'character-gallery', nav: '#banner2', slide: '#slide3' },
]

const timeline = []
const observations = []
const interactions = []
let t = 0
async function snap(pageId, label, index) {
  const dir = path.join(out, pageId, 'desktop')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${String(index).padStart(2, '0')}-${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  const state = await page.evaluate(() => {
    const active = document.querySelector('.allSwiper > .swiper-wrapper > .swiper-slide-active')
    const r = active?.getBoundingClientRect()
    return { scrollTop: scrollY, scrollHeight: document.documentElement.scrollHeight, activeId: active?.id || null, activeClass: active?.className || null, activeBox: r ? { x:r.x,y:r.y,width:r.width,height:r.height } : null }
  })
  timeline.push({ pageId, label, timeMs: t, file: path.relative(root, file), ...state })
  return file
}

let video
for (let i = 0; i < pages.length; i++) {
  const spec = pages[i]
  const before = await snap(spec.id, 'default', 0)
  await page.locator(spec.nav).click()
  t += 120
  const transition = await snap(spec.id, 'transition', 1)
  await page.waitForTimeout(900)
  t += 900
  const settled = await snap(spec.id, 'settled', 2)
  const dir = path.join(out, spec.id, 'desktop')
  const full = path.join(dir, 'full-page.png')
  await page.screenshot({ path: full, fullPage: true })
  const observed = await page.locator(spec.slide).evaluate((el) => {
    const css = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const nodes = [...el.querySelectorAll('img,video,[class]')].filter(n => {
      const nr=n.getBoundingClientRect(), ns=getComputedStyle(n)
      return nr.width>0 && nr.height>0 && ns.display!=='none' && ns.visibility!=='hidden' && Number(ns.opacity)>0
    }).slice(0,80).map(n => {
      const nr=n.getBoundingClientRect(), ns=getComputedStyle(n)
      return { tag:n.tagName, id:n.id, className:String(n.className||''), src:n.currentSrc||n.src||null, text:(n.innerText||'').trim().slice(0,160), box:{x:nr.x,y:nr.y,width:nr.width,height:nr.height}, computed:{display:ns.display,position:ns.position,color:ns.color,backgroundColor:ns.backgroundColor,backgroundImage:ns.backgroundImage,fontFamily:ns.fontFamily,fontSize:ns.fontSize,fontWeight:ns.fontWeight,borderRadius:ns.borderRadius,borderColor:ns.borderColor,opacity:ns.opacity,transform:ns.transform} }
    })
    return { selector:`#${el.id}`, className:el.className, box:{x:r.x,y:r.y,width:r.width,height:r.height}, computed:{display:css.display,backgroundColor:css.backgroundColor,backgroundImage:css.backgroundImage,color:css.color,fontFamily:css.fontFamily}, nodes }
  })
  observations.push({ id: spec.id, url: page.url(), before:path.relative(root,before), transition:path.relative(root,transition), settled:path.relative(root,settled), fullPage:path.relative(root,full), observed })
  if (spec.id === 'news') {
    const idir=path.join(out,'interactions','news-filter'); fs.mkdirSync(idir,{recursive:true})
    const beforeI=path.join(idir,'00-default.png'); await page.screenshot({path:beforeI})
    const beforeState=await page.locator('#news1').evaluate(el=>({className:el.className,computed:{color:getComputedStyle(el).color,borderColor:getComputedStyle(el).borderColor}}))
    await page.locator('#news1').click(); await page.waitForTimeout(120)
    const transitionI=path.join(idir,'01-transition.png'); await page.screenshot({path:transitionI})
    await page.waitForTimeout(700)
    const afterI=path.join(idir,'02-settled.png'); await page.screenshot({path:afterI})
    const afterState=await page.locator('#news1').evaluate(el=>({className:el.className,computed:{color:getComputedStyle(el).color,borderColor:getComputedStyle(el).borderColor}}))
    await page.locator('#news0').click(); await page.waitForTimeout(700)
    const restoredI=path.join(idir,'03-restored.png'); await page.screenshot({path:restoredI})
    const restoredState=await page.locator('#news1').evaluate(el=>({className:el.className,computed:{color:getComputedStyle(el).color,borderColor:getComputedStyle(el).borderColor}}))
    interactions.push({id:'news-filter',trigger:'click #news1, then click #news0 to restore',before:path.relative(root,beforeI),transition:path.relative(root,transitionI),after:path.relative(root,afterI),restored:path.relative(root,restoredI),beforeState,afterState,restoredState})
  }
  await page.locator('#banner0').click()
  await page.waitForTimeout(700)
  t += 700
  await snap(spec.id, 'restored', 3)
}

const assets = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({url:e.name, initiatorType:e.initiatorType, transferSize:e.transferSize, decodedBodySize:e.decodedBodySize})).filter(e => /\.(png|jpe?g|webp|gif|svg|mp4|webm|woff2?|ttf|otf)(\?|$)/i.test(e.url)))
fs.writeFileSync(path.join(out, 'raw-observation.json'), JSON.stringify({capturedAt:new Date().toISOString(), viewport:{width:1280,height:720}, pages:observations, timeline, interactions, assets}, null, 2))
video = page.video()
await context.close()
const videoPath = await video.path()
fs.renameSync(videoPath, path.join(out, 'continuous-playback.webm'))
await browser.close()
for (const p of fs.readdirSync(out, { recursive: true }).filter(p => typeof p === 'string')) {
  const f=path.join(out,p); if (fs.statSync(f).isFile()) console.log(`${path.relative(root,f)} ${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}`)
}
