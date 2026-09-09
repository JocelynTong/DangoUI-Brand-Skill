import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/plaza/index'
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})

const viewports = [
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'user-536x864', width: 536, height: 864 },
  { id: 'desktop-1280x720', width: 1280, height: 720 },
]

const renders = []
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', req => requests.push({ method: req.method(), url: req.url() }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(250)
  const probe = await page.evaluate(() => {
    const rect = el => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
    }
    const panels = [...document.querySelectorAll('.filter-panel')]
    const panel = panels[0]
    const rows = [...panel.querySelectorAll('.filterline')]
    const lastChip = [...panel.querySelectorAll('.filterline.second .chip')].at(-1)
    const search = document.querySelector('input')
    const firstCard = document.querySelector('.deck-card[role="button"]')
    const style = el => {
      const s = getComputedStyle(el)
      return { overflow: s.overflow, overflowX: s.overflowX, overflowY: s.overflowY, whiteSpace: s.whiteSpace, height: s.height, maxHeight: s.maxHeight }
    }
    const lastRect = rect(lastChip), panelRect = rect(panel)
    const chipRects = [...panel.querySelectorAll('.chip')].map(el => ({ text: el.textContent.trim(), ...rect(el) }))
    const rowLineCounts = rows.map(row => new Set([...row.querySelectorAll('.chip')].map(el => Math.round(el.getBoundingClientRect().top))).size)
    const clippedChips = chipRects.filter(r => r.left < panelRect.left || r.right > panelRect.right || r.top < panelRect.top || r.bottom > panelRect.bottom)
    return {
      document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth },
      panel: { ...rect(panel), scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, style: style(panel) },
      rows: rows.map(row => ({ ...rect(row), scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, scrollHeight: row.scrollHeight, clientHeight: row.clientHeight, style: style(row) })),
      scrollViews: [...panel.querySelectorAll('.filter-scroll')].map(el => ({ ...rect(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, style: style(el) })),
      lastChip: { text: lastChip.textContent.trim(), ...lastRect, fullyInsidePanel: lastRect.left >= panelRect.left && lastRect.right <= panelRect.right && lastRect.top >= panelRect.top && lastRect.bottom <= panelRect.bottom },
      chipCount: chipRects.length,
      clippedChips,
      rowLineCounts,
      panelViewportRatio: panelRect.height / innerHeight,
      search: search ? { ...rect(search), visible: rect(search).bottom > 0 && rect(search).top < innerHeight, tabIndex: search.tabIndex } : null,
      firstCard: firstCard ? { ...rect(firstCard), visible: rect(firstCard).bottom > 0 && rect(firstCard).top < innerHeight, tabIndex: firstCard.tabIndex } : null,
      direction: {
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        panelRadius: getComputedStyle(panel).borderRadius,
        chipRadii: [...panel.querySelectorAll('.chip')].map(el => getComputedStyle(el).borderRadius),
      },
    }
  })
  const screenshot = `${viewport.id}-plaza-filter-fresh.png`
  await page.screenshot({ path: path.join(out, screenshot), fullPage: true })
  renders.push({ viewport, probe, screenshot, writes: requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)) })
  await context.close()
}

async function activate(label, mechanism, row) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', req => requests.push({ method: req.method(), url: req.url() }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const button = page.locator(row === 'category' ? '.filterline:not(.second) .chip' : '.filterline.second .chip', { hasText: label }).last()
  const before = await button.evaluate(el => ({ ariaPressed: el.getAttribute('aria-pressed'), className: String(el.className), activeText: [...el.closest('.filterchips').querySelectorAll('[aria-pressed="true"]')].map(x => x.textContent.trim()) }))
  await button.focus()
  if (mechanism === 'pointer') await button.click()
  else await button.press(mechanism)
  await page.waitForTimeout(180)
  const after = await button.evaluate(el => ({ ariaPressed: el.getAttribute('aria-pressed'), className: String(el.className), activeText: [...el.closest('.filterchips').querySelectorAll('[aria-pressed="true"]')].map(x => x.textContent.trim()), focused: document.activeElement === el }))
  const reachability = await page.evaluate(() => {
    const search = document.querySelector('input')
    const firstCard = document.querySelector('.deck-card[role="button"]')
    return { searchTabIndex: search?.tabIndex, firstCardTabIndex: firstCard?.tabIndex, firstCardExists: Boolean(firstCard) }
  })
  await context.close()
  return { row, label, mechanism, before, after, changed: JSON.stringify(before) !== JSON.stringify(after), reachability, writes: requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)) }
}

const interactions = []
for (const mechanism of ['pointer', 'Enter', 'Space']) {
  interactions.push(await activate('全部', mechanism, 'category'))
  interactions.push(await activate('太阳&月亮-2.0', mechanism, 'environment'))
}

const regressionRoutes = ['build', 'mine', 'event', 'round', 'detail']
const regression = []
for (const route of regressionRoutes) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const suffix = route === 'event' ? '?id=0' : route === 'round' ? '?event=0&round=1' : route === 'detail' ? '?id=0' : ''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`, { waitUntil: 'networkidle', timeout: 30000 })
  const buffer = await page.screenshot({ fullPage: true })
  regression.push({ route, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), documentOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) })
  await context.close()
}

await browser.close()
const result = { schema: 'heldout-plaza-filter-fresh-qa/v1', generatedAt: new Date().toISOString(), fresh: true, base, renders, interactions, regression }
await fs.writeFile(path.join(out, 'browser-probes.json'), JSON.stringify(result, null, 2) + '\n')
