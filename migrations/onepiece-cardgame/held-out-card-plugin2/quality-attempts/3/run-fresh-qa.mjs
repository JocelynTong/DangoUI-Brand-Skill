import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/'
const routes = [
  { id: 'plaza', path: 'pages/plaza/index' },
  { id: 'build', path: 'pages/build/index' },
  { id: 'mine', path: 'pages/mine/index' },
  { id: 'event', path: 'pages/event/index?id=0' },
  { id: 'round', path: 'pages/round/index?event=0&round=1' },
  { id: 'detail', path: 'pages/detail/index?id=0' },
]
const viewports = [
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'desktop-1280x720', width: 1280, height: 720 },
]

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})

const renderResults = []
for (const viewport of viewports) {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const network = []
    page.on('request', request => network.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      isNavigation: request.isNavigationRequest(),
    }))
    const response = await page.goto(base + route.path, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(300)
    const probe = await page.evaluate(() => {
      const isVisible = el => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const controls = [...document.querySelectorAll('[role="button"],[role="tab"]')].filter(isVisible)
      const controlDetail = controls.map((el, index) => {
        const rect = el.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const hit = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight ? document.elementFromPoint(x, y) : null
        el.focus({ preventScroll: true })
        const style = getComputedStyle(el)
        return {
          index,
          role: el.getAttribute('role'),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
          className: String(el.className || ''),
          tabindex: el.getAttribute('tabindex'),
          ariaSelected: el.getAttribute('aria-selected'),
          ariaPressed: el.getAttribute('aria-pressed'),
          ariaExpanded: el.getAttribute('aria-expanded'),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          centerHitOwner: !hit || hit === el || el.contains(hit),
          centerHitTag: hit?.tagName || null,
          focused: document.activeElement === el,
          focusStyle: {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            outlineColor: style.outlineColor,
            boxShadow: style.boxShadow,
          },
        }
      })
      const animated = [...document.querySelectorAll('*')].map(el => {
        const style = getComputedStyle(el)
        return {
          tag: el.tagName,
          className: String(el.className || ''),
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
          transitionDelay: style.transitionDelay,
        }
      }).filter(x =>
        x.animationName !== 'none' ||
        x.animationDuration.split(',').some(v => v.trim() !== '0s') ||
        x.transitionDuration.split(',').some(v => v.trim() !== '0s') ||
        x.transitionDelay.split(',').some(v => v.trim() !== '0s')
      )
      const root = document.documentElement
      const bodyStyle = getComputedStyle(document.body)
      return {
        url: location.href,
        title: document.title,
        rootClass: root.className,
        bodyText: document.body.innerText.slice(0, 2400),
        viewport: { width: innerWidth, height: innerHeight },
        geometry: {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
          overflowX: root.scrollWidth > root.clientWidth,
        },
        bodyStyle: { fontFamily: bodyStyle.fontFamily, color: bodyStyle.color, background: bodyStyle.backgroundColor },
        controls: controlDetail,
        controlSummary: {
          count: controlDetail.length,
          missingTabindex: controlDetail.filter(x => x.tabindex !== '0').length,
          tabsMissingSelected: controlDetail.filter(x => x.role === 'tab' && x.ariaSelected === null).length,
          sub44: controlDetail.filter(x => x.rect.width < 44 || x.rect.height < 44).length,
          centerHitFailures: controlDetail.filter(x => !x.centerHitOwner && x.rect.y >= 0 && x.rect.y <= innerHeight).length,
          focusFailures: controlDetail.filter(x => !x.focused).length,
          invisibleFocus: controlDetail.filter(x => x.focusStyle.outlineStyle === 'none' && x.focusStyle.boxShadow === 'none').length,
        },
        reducedMotion: { offenderCount: animated.length, offenders: animated.slice(0, 100) },
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
      }
    })
    const safe = `${viewport.id}-${route.id}`
    await page.screenshot({ path: path.join(out, `${safe}.png`), fullPage: true })
    renderResults.push({
      viewport,
      route,
      status: response?.status() || null,
      network,
      externalWrites: network.filter(x => !['GET', 'HEAD', 'OPTIONS'].includes(x.method) && !x.url.startsWith('http://127.0.0.1:10092/')),
      anyWrites: network.filter(x => !['GET', 'HEAD', 'OPTIONS'].includes(x.method)),
      probe,
      screenshot: `${safe}.png`,
    })
    await context.close()
  }
}

async function detailToggle(viewport, mechanism) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const page = await context.newPage()
  const writes = []
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push({ method: request.method(), url: request.url() })
  })
  await page.goto(base + 'pages/detail/index?id=0', { waitUntil: 'networkidle' })
  const toggle = page.getByRole('button', { name: /展开|收起/ }).first()
  const snapshot = async label => ({
    label,
    text: (await toggle.textContent())?.trim(),
    ariaExpanded: await toggle.getAttribute('aria-expanded'),
    rect: await toggle.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }),
    centerHitOwner: await toggle.evaluate(el => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h === el || el.contains(h) }),
    bodyText: (await page.locator('body').innerText()).slice(0, 1400),
    scrollY: await page.evaluate(() => scrollY),
  })
  const before = await snapshot('before')
  if (mechanism === 'pointer') await toggle.click({ position: { x: before.rect.width / 2, y: before.rect.height / 2 } })
  else { await toggle.focus(); await toggle.press(mechanism) }
  await page.waitForTimeout(100)
  const expanded = await snapshot('expanded')
  if (mechanism === 'pointer') await toggle.click({ position: { x: expanded.rect.width / 2, y: expanded.rect.height / 2 } })
  else { await toggle.focus(); await toggle.press(mechanism) }
  await page.waitForTimeout(100)
  const collapsed = await snapshot('collapsed')
  await context.close()
  return { viewport, mechanism, before, expanded, collapsed, writes }
}

const detailParity = []
for (const viewport of viewports) {
  for (const mechanism of ['pointer', 'Enter', 'Space']) detailParity.push(await detailToggle(viewport, mechanism))
}

const journeyContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
const journeyPage = await journeyContext.newPage()
await journeyPage.goto(base + 'pages/plaza/index', { waitUntil: 'networkidle' })
const journey = []
const journeyState = async phase => journey.push(await journeyPage.evaluate(phase => ({ phase, url: location.href, rootClass: document.documentElement.className, bodyText: document.body.innerText.slice(0, 500) }), phase))
await journeyState('plaza-cold')
const eventTab = journeyPage.getByRole('tab', { name: /^赛事$/ }).first()
await eventTab.focus(); await eventTab.press('Enter'); await journeyPage.waitForTimeout(250)
await journeyState('event-warm')
await journeyPage.reload({ waitUntil: 'networkidle' }); await journeyState('event-cold-reload')
await journeyPage.goBack({ waitUntil: 'networkidle' }).catch(() => {}); await journeyPage.waitForTimeout(200); await journeyState('back-restored')
await journeyContext.close()

const visualContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const visualPage = await visualContext.newPage()
await visualPage.goto(base + 'pages/event/index?id=0', { waitUntil: 'networkidle' })
const eventTitle = await visualPage.evaluate(() => {
  const candidates = [...document.querySelectorAll('*')].filter(el => (el.textContent || '').trim() === 'Pitch Black 赛季挑战')
  const el = candidates.at(-1)
  if (!el) return null
  const r = el.getBoundingClientRect(), s = getComputedStyle(el)
  return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, whiteSpace: s.whiteSpace, overflow: s.overflow, textOverflow: s.textOverflow, fontSize: s.fontSize, lineHeight: s.lineHeight }
})
await visualPage.goto(base + 'pages/round/index?event=0&round=1', { waitUntil: 'networkidle' })
const roundContrast = await visualPage.evaluate(() => {
  const parse = value => { const m = value.match(/[\d.]+/g)?.map(Number); return m ? m.slice(0, 3) : null }
  const luminance = rgb => { const a = rgb.map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2] }
  const ratio = (a, b) => { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) }
  const rows = [...document.querySelectorAll('.deck-card, .rank-row, [class*="rank"]')].filter(el => el.getBoundingClientRect().width > 0).slice(0, 12)
  return rows.map(el => {
    const s = getComputedStyle(el), color = parse(s.color), background = parse(s.backgroundColor)
    const r = el.getBoundingClientRect()
    return { className: String(el.className || ''), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 140), color: s.color, background: s.backgroundColor, ratio: color && background ? ratio(color, background) : null, rect: { width: r.width, height: r.height } }
  })
})
await visualContext.close()

await browser.close()

const artifact = {
  schema: 'brand-heldout-fresh-browser-probes/v3',
  generatedAt: new Date().toISOString(),
  fresh: true,
  base,
  renderResults,
  detailParity,
  journey,
  eventTitle,
  roundContrast,
}
await fs.writeFile(path.join(out, 'browser-probes.json'), JSON.stringify(artifact, null, 2) + '\n')
