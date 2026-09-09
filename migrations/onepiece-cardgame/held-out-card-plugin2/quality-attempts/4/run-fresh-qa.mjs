import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/'
const viewports = [
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'desktop-1280x720', width: 1280, height: 720 },
]
const routes = [
  { id: 'plaza', path: 'pages/plaza/index' },
  { id: 'build', path: 'pages/build/index' },
  { id: 'mine', path: 'pages/mine/index' },
  { id: 'event', path: 'pages/event/index?id=0' },
  { id: 'round', path: 'pages/round/index?event=0&round=1' },
  { id: 'detail', path: 'pages/detail/index?id=0' },
]
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})

const sha256 = async file => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
const renders = []
for (const viewport of viewports) {
  for (const route of routes) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const requests = []
    page.on('request', req => requests.push({ method: req.method(), url: req.url(), type: req.resourceType() }))
    const response = await page.goto(base + route.path, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(350)
    const probe = await page.evaluate(() => {
      const visible = el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'
      }
      const els = [...document.querySelectorAll('*')].filter(visible)
      const viewportArea = innerWidth * innerHeight
      const colorBuckets = new Map()
      let coloredArea = 0
      for (const el of els) {
        const r = el.getBoundingClientRect()
        const x1 = Math.max(0, r.left), y1 = Math.max(0, r.top), x2 = Math.min(innerWidth, r.right), y2 = Math.min(innerHeight, r.bottom)
        if (x2 <= x1 || y2 <= y1) continue
        const area = (x2 - x1) * (y2 - y1)
        const bg = getComputedStyle(el).backgroundColor
        if (!bg || bg === 'rgba(0, 0, 0, 0)') continue
        colorBuckets.set(bg, (colorBuckets.get(bg) || 0) + area)
        coloredArea += area
      }
      const controls = [...document.querySelectorAll('[role="button"],[role="tab"],button,input')].filter(visible)
      const controlDetails = controls.map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el)
        return {
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 90),
          radius: s.borderRadius,
          background: s.backgroundColor,
          color: s.color,
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        }
      })
      const pillCount = controlDetails.filter(x => {
        const value = parseFloat(x.radius)
        return Number.isFinite(value) && value >= Math.min(x.rect.height / 2 - 2, 18)
      }).length
      const rounded12Plus = controlDetails.filter(x => parseFloat(x.radius) >= 12).length
      const headings = els.filter(el => /^H[1-6]$/.test(el.tagName) || /title|heading|headline/i.test(String(el.className || ''))).slice(0, 30).map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el)
        return { text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100), fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, rect: { x: r.x, y: r.y, width: r.width, height: r.height } }
      })
      const text = document.body.innerText
      const firstContent = els.find(el => /喷火龙|皮卡丘|妙蛙花/.test(el.textContent || '') && (el.textContent || '').trim().length < 180)
      const firstRect = firstContent?.getBoundingClientRect()
      const search = document.querySelector('input')
      const searchRect = search?.getBoundingClientRect()
      return {
        url: location.href,
        bodyText: text.slice(0, 2200),
        geometry: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight },
        colorBuckets: [...colorBuckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([color, area]) => ({ color, accumulatedElementArea: area, viewportRatio: area / viewportArea })),
        coloredAreaRatio: coloredArea / viewportArea,
        controls: controlDetails,
        controlSummary: { count: controlDetails.length, pillCount, rounded12Plus },
        headings,
        search: searchRect ? { visible: searchRect.top < innerHeight && searchRect.bottom > 0, rect: { x: searchRect.x, y: searchRect.y, width: searchRect.width, height: searchRect.height }, placeholder: search?.getAttribute('placeholder') } : null,
        taxonomyPresent: /推荐|热门|最新|全部|卡组/.test(text),
        firstContent: firstRect ? { visible: firstRect.top < innerHeight && firstRect.bottom > 0, top: firstRect.top, text: (firstContent.textContent || '').trim().slice(0, 120) } : null,
      }
    })
    const file = path.join(out, `${viewport.id}-${route.id}-fresh.png`)
    await page.screenshot({ path: file, fullPage: true })
    renders.push({ viewport, route, status: response?.status(), requests, writes: requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)), probe, screenshot: path.basename(file), sha256: await sha256(file) })
    await context.close()
  }
}

async function plazaInteraction(mechanism) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const requests = []
  page.on('request', req => requests.push({ method: req.method(), url: req.url(), type: req.resourceType() }))
  await page.goto(base + 'pages/plaza/index', { waitUntil: 'networkidle' })
  const initial = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 1200), storage: { local: { ...localStorage }, session: { ...sessionStorage } }, scrollY }))
  const eventTab = page.getByRole('tab', { name: /^赛事$/ }).first()
  await eventTab.focus()
  if (mechanism === 'pointer') await eventTab.click()
  else await eventTab.press(mechanism)
  await page.waitForTimeout(250)
  const afterEvent = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 1200), storage: { local: { ...localStorage }, session: { ...sessionStorage } }, scrollY }))
  await page.goto(base + 'pages/plaza/index', { waitUntil: 'networkidle' })
  const deckTab = page.getByRole('tab', { name: /卡组广场/ }).first()
  await deckTab.focus()
  if (mechanism === 'pointer') await deckTab.click()
  else await deckTab.press(mechanism)
  await page.waitForTimeout(180)
  const input = page.locator('input').first()
  await input.fill('喷火龙')
  await page.waitForTimeout(180)
  const afterSearch = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 1200), inputValue: document.querySelector('input')?.value, storage: { local: { ...localStorage }, session: { ...sessionStorage } }, scrollY }))
  const cards = page.locator('[role="button"]').filter({ hasText: /喷火龙|卡组/ })
  const cardCount = await cards.count()
  let cardNavigation = null
  if (cardCount) {
    const candidate = cards.last()
    const before = page.url()
    await candidate.focus()
    if (mechanism === 'pointer') await candidate.click()
    else await candidate.press(mechanism)
    await page.waitForTimeout(220)
    cardNavigation = { before, after: page.url(), changed: page.url() !== before }
  }
  const finalStorage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  await context.close()
  return { mechanism, initial, afterEvent, afterSearch, cardCount, cardNavigation, requests, writes: requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)), finalStorage }
}

const interactions = []
for (const mechanism of ['pointer', 'Enter', 'Space']) interactions.push(await plazaInteraction(mechanism))

await browser.close()
await fs.writeFile(path.join(out, 'fresh-browser-probes.json'), JSON.stringify({ schema: 'heldout-plaza-minimal-fresh-qa/v1', generatedAt: new Date().toISOString(), fresh: true, base, renders, interactions }, null, 2) + '\n')
