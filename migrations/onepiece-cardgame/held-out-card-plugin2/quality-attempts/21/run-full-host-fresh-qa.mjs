import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
await fs.mkdir(out, { recursive: true })
const origin = 'http://127.0.0.1:10092'
const routes = {
  plaza: '/#/pages/plaza/index',
  event: '/#/pages/event/index?id=0',
  detail: '/#/pages/detail/index?id=0',
  build: '/#/pages/build/index',
  mine: '/#/pages/mine/index',
  round: '/#/pages/round/index?event=0&round=0',
}
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const isWrite = request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method())

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})

async function freshContext(viewport = viewports[0]) {
  return browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'light' })
}

async function goto(page, suffix) {
  await page.goto(origin + suffix, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(120)
}

const renders = []
for (const [route, suffix] of Object.entries(routes)) {
  for (const viewport of viewports) {
    const context = await freshContext(viewport)
    const page = await context.newPage()
    const requests = []
    page.on('request', request => requests.push(request))
    await goto(page, suffix)
    const visual = await page.evaluate(() => {
      const all = [...document.querySelectorAll('*')]
      const visible = element => {
        const s = getComputedStyle(element)
        const r = element.getBoundingClientRect()
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
      }
      const root = [...document.body.children].find(visible) || document.body
      const controls = all.filter(e => visible(e) && ['button', 'tab'].includes(e.getAttribute('role')))
      const textNodes = all.filter(e => visible(e) && e.children.length === 0 && (e.textContent || '').trim().length > 0)
      const fixed = all.filter(e => visible(e) && ['fixed', 'sticky'].includes(getComputedStyle(e).position))
      const clippedText = textNodes.filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
      const radiusPills = all.filter(e => visible(e) && parseFloat(getComputedStyle(e).borderRadius) >= 999)
      const fontSizes = [...new Set(textNodes.map(e => Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10))].sort((a, b) => a - b)
      const rootStyle = getComputedStyle(root)
      const backgrounds = [...new Set(all.filter(visible).map(e => getComputedStyle(e).backgroundColor).filter(v => v !== 'rgba(0, 0, 0, 0)'))]
      return {
        title: document.title,
        bodyTextHead: document.body.innerText.trim().slice(0, 500),
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
          overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        },
        root: { className: root.className, backgroundColor: rootStyle.backgroundColor, color: rootStyle.color },
        fontSizes,
        backgrounds,
        clippedText: clippedText.slice(0, 20).map(e => ({ text: e.textContent.trim().slice(0, 80), className: e.className, clientWidth: e.clientWidth, scrollWidth: e.scrollWidth, clientHeight: e.clientHeight, scrollHeight: e.scrollHeight })),
        controlCount: controls.length,
        undersizedControls: controls.filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44 }).map(e => ({ text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 60), className: e.className, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })),
        nonFocusableControls: controls.filter(e => e.getAttribute('tabindex') !== '0').map(e => ({ text: (e.textContent || '').trim().slice(0, 60), className: e.className, tabindex: e.getAttribute('tabindex') })),
        activeMotion: all.filter(e => visible(e)).filter(e => {
          const s = getComputedStyle(e)
          return s.animationName !== 'none' || s.transitionDuration.split(',').some(v => parseFloat(v) > 0)
        }).slice(0, 20).map(e => ({ className: e.className, animationName: getComputedStyle(e).animationName, transitionDuration: getComputedStyle(e).transitionDuration })),
        fixedOrSticky: fixed.map(e => ({ className: e.className, text: (e.textContent || '').trim().slice(0, 80), top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, height: e.getBoundingClientRect().height })),
        extremeBlankBlocks: all.filter(e => visible(e)).filter(e => {
          const r = e.getBoundingClientRect(); const text = (e.innerText || '').trim(); const imgs = e.querySelectorAll('img,image').length
          return r.height > innerHeight * 0.45 && text.length < 4 && imgs === 0
        }).slice(0, 10).map(e => ({ className: e.className, height: e.getBoundingClientRect().height })),
        pillCount: radiusPills.length,
        heroClassCount: all.filter(e => visible(e) && /(^|\s|-)hero($|\s|-)/i.test(String(e.className))).length,
        duplicateTabLabels: Object.entries(controls.filter(e => e.getAttribute('role') === 'tab').reduce((m, e) => { const t = (e.textContent || '').trim(); m[t] = (m[t] || 0) + 1; return m }, {})).filter(([, n]) => n > 1),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
    })
    const name = `fresh-${viewport.width}x${viewport.height}-${route}.png`
    const png = await page.screenshot({ path: path.join(out, name), fullPage: true })
    renders.push({ route, viewport, url: page.url(), screenshot: name, screenshotSha256: sha(png), visual, networkWrites: requests.filter(isWrite).map(r => ({ method: r.method(), url: r.url() })) })
    await context.close()
  }
}

async function journey(name, start, steps) {
  const context = await freshContext({ width: 390, height: 844 })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push(request))
  await goto(page, start)
  const log = [{ action: 'start', url: page.url() }]
  for (const step of steps) {
    const locator = page.locator(step.selector).first()
    const count = await locator.count()
    if (!count) { log.push({ action: step.action, status: 'MISSING', selector: step.selector, url: page.url() }); break }
    if (step.mode === 'pointer') await locator.click()
    else { await locator.focus(); await page.keyboard.press(step.mode) }
    await page.waitForTimeout(220)
    log.push({ action: step.action, mode: step.mode, status: 'DONE', selector: step.selector, url: page.url(), visibleText: (await page.locator('body').innerText()).slice(0, 160) })
  }
  const result = { name, log, finalUrl: page.url(), networkWrites: requests.filter(isWrite).map(r => ({ method: r.method(), url: r.url() })) }
  await context.close()
  return result
}

const journeys = []
journeys.push(await journey('plaza-to-detail-pointer', routes.plaza, [{ action: 'open first deck', mode: 'pointer', selector: '.plaza .deck-card[role="button"]' }]))
journeys.push(await journey('plaza-to-detail-enter', routes.plaza, [{ action: 'open first deck', mode: 'Enter', selector: '.plaza .deck-card[role="button"]' }]))
journeys.push(await journey('plaza-to-detail-space', routes.plaza, [{ action: 'open first deck', mode: 'Space', selector: '.plaza .deck-card[role="button"]' }]))
journeys.push(await journey('plaza-to-build-via-mine', routes.plaza, [
  { action: 'open mine', mode: 'pointer', selector: '.mine-entry[role="button"]' },
  { action: 'create deck', mode: 'pointer', selector: '.newbtn[role="button"]' },
]))
journeys.push(await journey('event-to-round-to-detail', routes.event, [
  { action: 'open round', mode: 'pointer', selector: '.more[role="button"]' },
  { action: 'open ranked deck', mode: 'pointer', selector: '.round-page .deck-card[role="button"]' },
]))

for (const mode of ['pointer', 'Enter', 'Space']) {
  journeys.push(await journey(`mine-tabs-${mode.toLowerCase()}`, routes.mine, [
    { action: 'select draft tab', mode, selector: '.mtab[role="tab"]:nth-child(2)' },
    { action: 'select published tab', mode, selector: '.mtab[role="tab"]:nth-child(3)' },
    { action: 'select hidden tab', mode, selector: '.mtab[role="tab"]:nth-child(4)' },
    { action: 'return draft tab', mode, selector: '.mtab[role="tab"]:nth-child(2)' },
  ]))
}
journeys.push(await journey('mine-edit', routes.mine, [
  { action: 'select draft tab', mode: 'pointer', selector: '.mtab[role="tab"]:nth-child(2)' },
  { action: 'edit draft', mode: 'pointer', selector: '.smallbtn.edit[role="button"]' },
]))
journeys.push(await journey('mine-delete-confirm-cancel', routes.mine, [
  { action: 'select draft tab', mode: 'pointer', selector: '.mtab[role="tab"]:nth-child(2)' },
  { action: 'open delete confirmation', mode: 'pointer', selector: '.smallbtn.danger[role="button"]' },
  { action: 'cancel delete', mode: 'pointer', selector: '.confirmcancel[role="button"]' },
]))

const focusChecks = []
for (const [route, suffix] of Object.entries(routes)) {
  const context = await freshContext()
  const page = await context.newPage()
  await goto(page, suffix)
  const control = page.locator('[role="button"],[role="tab"]').first()
  if (await control.count()) {
    await control.focus()
    focusChecks.push({ route, ...(await control.evaluate(e => { const s = getComputedStyle(e); return { retained: document.activeElement === e, className: e.className, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow } })) })
  } else focusChecks.push({ route, missing: true })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'fresh-browser-probes.json'), JSON.stringify({ schema: 'heldout-full-host-fresh-integration-qa/v1', attempt: 21, generatedAt: new Date().toISOString(), qaRole: 'fresh-independent-full-host-visual-qa', readOnly: true, origin, routes, viewports, renders, journeys, focusChecks }, null, 2) + '\n')
