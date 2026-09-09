#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const base = process.argv[2] || 'http://127.0.0.1:5179'
const root = process.cwd()
const migrationRoot = path.join(root, 'migrations/onepiece-cardgame')
const outDir = path.join(migrationRoot, 'mapping-runtime')
const captureDir = path.join(outDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(migrationRoot, file), 'utf8'))
const profile = readJson('brand-profile.dtcg.json')
const adapter = readJson('dangoui-adapter.json')
const flattenDtcg = (node, parts = [], out = []) => {
  if (!node || typeof node !== 'object') return out
  if ('$value' in node && '$type' in node) {
    out.push({ sourceToken: parts.join('.'), type: node.$type, value: node.$value, extensions: node.$extensions || {} })
    return out
  }
  for (const [key, value] of Object.entries(node)) if (!key.startsWith('$')) flattenDtcg(value, [...parts, key], out)
  return out
}

const leaves = flattenDtcg(profile)
const expectedMappings = leaves.map((leaf) => ({
  ...leaf,
  targetToken: leaf.extensions['echo.brand.target'],
  mapping: adapter.tokenMappings.find((candidate) => candidate.sourceToken === leaf.sourceToken),
}))
const contractErrors = expectedMappings.flatMap((entry) => {
  const errors = []
  if (!entry.targetToken) errors.push(`${entry.sourceToken}: missing echo.brand.target`)
  if (!entry.mapping) errors.push(`${entry.sourceToken}: missing adapter mapping`)
  else {
    if (entry.mapping.targetToken !== entry.targetToken) errors.push(`${entry.sourceToken}: adapter target mismatch`)
    if (!Array.isArray(entry.mapping.consumerLocations) || entry.mapping.consumerLocations.length === 0) errors.push(`${entry.sourceToken}: no consumer locations`)
  }
  return errors
})

const routes = [
  ['home', 'onepiece-cardgame-home'], ['news', 'onepiece-cardgame-news'],
  ['products', 'onepiece-cardgame-products'], ['events', 'onepiece-cardgame-events'],
  ['held-out', 'onepiece-cardgame-editorial-held-out'],
]
const surfaces = [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const pages = []
const consoleMessages = []
const attachConsoleGuards = (page, scope) => {
  page.on('pageerror', (error) => consoleMessages.push({ scope, type: 'pageerror', text: error.message }))
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) consoleMessages.push({ scope, type: message.type(), text: message.text() })
  })
}

for (const [short, id] of routes) {
  for (const [surface, viewport] of surfaces) {
    const page = await browser.newPage({ viewport })
    attachConsoleGuards(page, `${id}/${surface}`)
    await page.goto(`${base}/?qa=onepiece-mapping-runtime#/brand/onepiece-cardgame/pages/${id}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.theme-onepiece-cardgame .source-schema-demo')
    const state = await page.evaluate(({ mappings }) => {
      const demo = document.querySelector('.theme-onepiece-cardgame .source-schema-demo')
      const screen = document.querySelector('.phone-screen')
      const hero = demo.querySelector('.source-schema-demo__hero')
      const primaryRegion = hero || demo.querySelector('h1, h2, [class*="heading"], strong')
      const sections = [...demo.querySelectorAll(':scope > section, :scope > article')]
      const brokenImages = [...demo.querySelectorAll('img')].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src)
      return {
        hero: hero ? { width: hero.getBoundingClientRect().width, height: hero.getBoundingClientRect().height } : null,
        primaryRegion: primaryRegion ? { tag: primaryRegion.tagName, className: typeof primaryRegion.className === 'string' ? primaryRegion.className : '', width: primaryRegion.getBoundingClientRect().width, height: primaryRegion.getBoundingClientRect().height } : null,
        sectionCount: sections.length,
        imageCount: demo.querySelectorAll('img').length,
        scroll: screen ? { target: 'phone-screen', clientHeight: screen.clientHeight, scrollHeight: screen.scrollHeight, before: screen.scrollTop } : null,
        horizontalOverflow: Boolean(screen && screen.scrollWidth > screen.clientWidth + 1),
        brokenImages,
        observations: mappings.map((entry) => ({
          sourceToken: entry.sourceToken, targetToken: entry.targetToken, type: entry.type, expected: entry.value,
          consumers: (entry.selectors || []).flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => {
            const style = getComputedStyle(node)
            return { selector, tag: node.tagName, className: typeof node.className === 'string' ? node.className : '', resolvedCustomProperty: style.getPropertyValue(entry.targetToken).trim(), computed: { color: style.color, backgroundColor: style.backgroundColor, fontFamily: style.fontFamily, borderRadius: style.borderRadius, transitionDuration: style.transitionDuration } }
          })),
        })),
      }
    }, { mappings: expectedMappings.map((entry) => ({ sourceToken: entry.sourceToken, targetToken: entry.targetToken, type: entry.type, value: entry.value, selectors: entry.mapping?.consumerLocations || [] })) })
    if (surface === 'phone') {
      state.scroll = await page.evaluate(() => {
        const screen = document.querySelector('.phone-screen')
        const documentScroller = document.scrollingElement
        const target = screen && screen.scrollHeight > screen.clientHeight ? screen : documentScroller
        if (!target) return null
        const before = target.scrollTop
        const scrollable = target.scrollHeight > target.clientHeight
        target.scrollTop = scrollable ? Math.min(280, target.scrollHeight - target.clientHeight) : 0
        const after = target.scrollTop
        target.scrollTop = before
        return { target: target === screen ? 'phone-screen' : 'document', clientHeight: target.clientHeight, scrollHeight: target.scrollHeight, before, after, restored: target.scrollTop, scrollable }
      })
    }
    const screenshot = path.join(captureDir, `${short}-${surface}.png`)
    await page.screenshot({ path: screenshot })
    pages.push({ pageId: id, surface, viewport, screenshot: path.relative(root, screenshot), ...state })
    await page.close()
  }
}

const normalizeColor = (value) => {
  const match = String(value).trim().match(/^#([0-9a-f]{6})$/i)
  if (!match) return String(value).trim().toLowerCase()
  const hex = match[1]
  return `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`
}
const consumerMatches = (entry, consumer) => {
  if (entry.type === 'color') return [consumer.computed.color, consumer.computed.backgroundColor].includes(normalizeColor(entry.value))
  if (entry.type === 'fontFamily') return consumer.computed.fontFamily.toLowerCase().includes(String(Array.isArray(entry.value) ? entry.value[0] : entry.value).replace(/["']/g, '').toLowerCase())
  if (entry.type === 'dimension') return consumer.computed.borderRadius.split(' ').includes(String(entry.value))
  if (entry.type === 'duration') return consumer.computed.transitionDuration.split(',').map((value) => value.trim()).includes(`${Number.parseFloat(entry.value) / 1000}s`)
  return false
}
const tokenCoverage = expectedMappings.map((entry) => {
  const consumers = pages.flatMap((page) => page.observations.find((observation) => observation.sourceToken === entry.sourceToken)?.consumers || [])
  const matchedConsumers = consumers.filter((consumer) => consumerMatches(entry, consumer))
  return { sourceToken: entry.sourceToken, targetToken: entry.targetToken, expected: entry.value, type: entry.type, declaredStatus: entry.mapping?.status || null, selectors: entry.mapping?.consumerLocations || [], observedConsumerCount: consumers.length, matchedConsumerCount: matchedConsumers.length, consumed: matchedConsumers.length > 0, sample: matchedConsumers[0] || consumers[0] || null }
})

const home = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
attachConsoleGuards(home, 'onepiece-cardgame-home/button-state')
await home.goto(`${base}/?qa=onepiece-mapping-runtime#/brand/onepiece-cardgame/pages/onepiece-cardgame-home`, { waitUntil: 'networkidle' })
const button = home.locator('.onepiece-footer-motion-control.du-button')
const nativeButton = await button.count() ? await button.evaluate((node) => ({ tag: node.tagName, className: node.className, text: node.textContent.trim(), ariaPressed: node.getAttribute('aria-pressed'), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, borderRadius: getComputedStyle(node).borderRadius })) : null
if (nativeButton) {
  await button.hover()
  nativeButton.hover = await button.evaluate((node) => ({ color: getComputedStyle(node).color, backgroundColor: getComputedStyle(node).backgroundColor }))
  await button.focus()
  nativeButton.focus = await button.evaluate((node) => ({ focused: document.activeElement === node, outline: getComputedStyle(node).outline }))
  await button.click()
  nativeButton.afterClick = await button.evaluate((node) => ({ text: node.textContent.trim(), ariaPressed: node.getAttribute('aria-pressed') }))
}
await home.close()

const foreign = []
for (const [brand, pageId] of [['dango','dango-introduction-calibration'],['pokemon-tcg-official','pokemon-tcg-official-home']]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  attachConsoleGuards(page, `${brand}/isolation`)
  await page.goto(`${base}/?qa=onepiece-isolation#/brand/${brand}/pages/${pageId}`, { waitUntil: 'networkidle' })
  foreign.push(await page.evaluate((brand) => {
    const node = document.querySelector('.source-schema-demo')
    const style = node ? getComputedStyle(node) : null
    return { brand, onepieceAncestor: Boolean(node?.closest('.theme-onepiece-cardgame')), onepieceThemeNodes: document.querySelectorAll('.theme-onepiece-cardgame').length, computedFontFamily: style?.fontFamily || '' }
  }, brand))
  await page.close()
}
await browser.close()

const consumed = tokenCoverage.filter((entry) => entry.consumed)
const pending = tokenCoverage.filter((entry) => !entry.consumed).map((entry) => ({ token: entry.targetToken, sourceToken: entry.sourceToken, reason: entry.observedConsumerCount === 0 ? 'No declared consumer selector matched a rendered node.' : 'Rendered consumers did not compute the canonical DTCG value in the property implied by its token type.' }))
const phonePages = pages.filter((page) => page.surface === 'phone')
const checks = {
  contractComplete: contractErrors.length === 0,
  tenScreenshots: pages.length === routes.length * surfaces.length,
  primaryRegionsPresent: routes.every(([, id]) => pages.some((page) => page.pageId === id && page.surface === 'desktop' && page.primaryRegion?.width > 0 && page.primaryRegion?.height > 0)),
  sectionsPresent: pages.every((page) => page.sectionCount >= 2),
  phoneScrollTargetsInspected: phonePages.length === routes.length && phonePages.every((page) => page.scroll?.target && Number.isFinite(page.scroll.before)),
  phoneScrollablePagesReversible: phonePages.some((page) => page.scroll?.scrollable) && phonePages.filter((page) => page.scroll?.scrollable).every((page) => page.scroll.after > page.scroll.before && page.scroll.restored === page.scroll.before),
  assetsLoaded: pages.every((page) => page.imageCount > 0 && page.brokenImages.length === 0),
  noHorizontalOverflow: pages.every((page) => !page.horizontalOverflow),
  allCanonicalTokensConsumed: tokenCoverage.length > 0 && consumed.length === tokenCoverage.length,
  nativeDuButtonStates: nativeButton?.tag === 'BUTTON' && nativeButton.className.includes('du-button') && nativeButton.focus?.focused && nativeButton.afterClick?.ariaPressed === 'true' && nativeButton.afterClick?.text === '▶',
  foreignThemesClean: foreign.every((item) => !item.onepieceAncestor && item.onepieceThemeNodes === 0 && !item.computedFontFamily.includes('OPCG')),
  consoleClean: consoleMessages.length === 0,
}
const report = { schema: 'onepiece-dangoui-mapping-runtime-probe/v2', generatedAt: new Date().toISOString(), base, sourceArtifacts: ['migrations/onepiece-cardgame/brand-profile.dtcg.json', 'migrations/onepiece-cardgame/dangoui-adapter.json'], verdict: Object.values(checks).every(Boolean) ? 'pass' : 'fail', status: 'PENDING_INDEPENDENT_QA', summary: { dtcgTargets: tokenCoverage.length, consumed: consumed.length, pending: pending.length, nativeComponentTypes: 1, nativeComponentInstances: nativeButton ? 1 : 0, unexpectedConsoleMessages: consoleMessages.length }, pending, contractErrors, checks, tokenCoverage, nativeButton, pages, foreign, consoleMessages }
fs.writeFileSync(path.join(outDir, 'runtime-probe.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ verdict: report.verdict, status: report.status, summary: report.summary, checks, contractErrors, consoleMessages }, null, 2))
process.exit(report.verdict === 'pass' ? 0 : 3)
