import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = process.cwd()
const out = path.join(root, 'migrations/onepiece-cardgame/quality-attempts/13/revision-2')
const captures = path.join(out, 'captures')
fs.mkdirSync(captures, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.goto(`${process.env.ATTEMPT13_BASE_URL || 'http://127.0.0.1:5173'}/#/brand/onepiece-cardgame/pages/onepiece-cardgame-home`, { waitUntil: 'networkidle' })
const section = page.locator('[data-schema-section-id="home-events"]')
await section.waitFor({ state: 'attached' })
await section.scrollIntoViewIfNeeded()
const screenshotPath = path.join(captures, 'events-390x844.png')
await section.screenshot({ path: screenshotPath })
const events = await page.evaluate(() => [...document.querySelectorAll('[data-schema-section-id="home-events"] img')].map((img, index) => {
  const rect = img.getBoundingClientRect()
  const style = getComputedStyle(img)
  return { item:index + 1, src:new URL(img.currentSrc).pathname, naturalWidth:img.naturalWidth, naturalHeight:img.naturalHeight, computedWidth:rect.width, computedHeight:rect.height, objectFit:style.objectFit, objectPosition:style.objectPosition }
}))
const sectionProbe = await page.evaluate(() => {
  const root = document.querySelector('[data-schema-section-id="home-events"]')
  const list = root.querySelector('.source-schema-demo__home-editorial-list')
  const first = root.querySelector('.source-schema-demo__home-editorial-item')
  return { background:getComputedStyle(root).backgroundColor, listBorder:getComputedStyle(list).border, firstItemPosition:getComputedStyle(first).position, firstImageLeft:getComputedStyle(first.querySelector('img')).left }
})
const bytes = fs.readFileSync(screenshotPath)
const probe = { schema:'attempt13-revision2-events-probe/v1', viewport:{width:390,height:844}, events, section:sectionProbe, screenshot:{path:'quality-attempts/13/revision-2/captures/events-390x844.png',sha256:crypto.createHash('sha256').update(bytes).digest('hex')}, verdictBoundary:'implementation probe only; independent QA not run' }
fs.writeFileSync(path.join(out, 'probe.json'), `${JSON.stringify(probe, null, 2)}\n`)
console.log(JSON.stringify(probe, null, 2))
await browser.close()
