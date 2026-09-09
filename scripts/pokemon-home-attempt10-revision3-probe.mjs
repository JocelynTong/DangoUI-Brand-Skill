import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/10/demo-revision3')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const surfaces = [
  { id: 'desktop-1440', width: 1440, height: 900, proof: 'desktop' },
  { id: 'mobile-390', width: 390, height: 844 },
]

const inspectSection = (locator) => locator.evaluate((node) => {
  const rect = (element) => {
    const value = element.getBoundingClientRect()
    return { x: value.x, y: value.y, right: value.right, bottom: value.bottom, width: value.width, height: value.height }
  }
  const relative = (element) => {
    const section = rect(node)
    const value = rect(element)
    return { x: value.x - section.x, y: value.y - section.y, width: value.width, height: value.height }
  }
  const background = node.querySelector('.pokemon-pocket__background')
  const image = background.querySelector('img')
  const source = background.querySelector('source')
  const asset = node.querySelector('.pokemon-pocket__asset-field')
  const copy = node.querySelector('.pokemon-pocket__copy')
  const composite = node.querySelector('.pokemon-pocket__composite')
  const fixture = node.querySelector('.pokemon-pocket__fixture-art')
  const label = node.querySelector('.pokemon-pocket__fixture-label')
  const cta = node.querySelector('.pokemon-pocket__cta')
  const h2 = node.querySelector('h2')
  const body = node.querySelector('.pokemon-pocket__copy p')
  const ctaStyle = getComputedStyle(cta)
  return {
    proofRole: node.dataset.proofRole,
    section: rect(node),
    background: { rect: relative(background), currentSrc: image.currentSrc, desktopSrc: image.getAttribute('src'), mobileSrc: source.getAttribute('srcset'), objectPosition: getComputedStyle(image).objectPosition },
    assetField: relative(asset),
    copy: { rect: relative(copy), backgroundColor: getComputedStyle(copy).backgroundColor },
    composite: composite ? { rect: relative(composite), natural: [composite.naturalWidth, composite.naturalHeight] } : null,
    fixtureArt: fixture ? { rect: relative(fixture), text: fixture.textContent.trim() } : null,
    fixtureLabel: label ? { rect: relative(label), text: label.textContent.trim() } : null,
    h2: { text: h2.textContent.trim(), fontFamily: getComputedStyle(h2).fontFamily, fontSize: getComputedStyle(h2).fontSize, fontStyle: getComputedStyle(h2).fontStyle, lineHeight: getComputedStyle(h2).lineHeight },
    body: { text: body.textContent.trim(), fontFamily: getComputedStyle(body).fontFamily, fontSize: getComputedStyle(body).fontSize, lineHeight: getComputedStyle(body).lineHeight },
    cta: { rect: relative(cta), href: cta.getAttribute('href'), color: ctaStyle.color, backgroundColor: ctaStyle.backgroundColor },
    overflow: { sectionHorizontal: node.scrollWidth > node.clientWidth, documentHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth },
  }
})

const calibration = []
const heldOut = []

for (const surface of surfaces) {
  const page = await browser.newPage({ viewport: { width: surface.width, height: surface.height }, deviceScaleFactor: 1 })
  const errors = []
  const warnings = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
    if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const query = new URLSearchParams({ qa: 'attempt10-revision3' })
  if (surface.proof) query.set('proof', surface.proof)

  await page.goto(`${baseUrl}/?${query}#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`, { waitUntil: 'networkidle' })
  const pocket = page.locator('[data-schema-section-id="home-editorial-grid"]')
  await pocket.waitFor()
  const settled = await inspectSection(pocket)
  await pocket.screenshot({ path: path.join(captureDir, `calibration-${surface.id}-settled.png`) })
  await pocket.locator('.pokemon-pocket__cta').hover()
  await page.waitForTimeout(120)
  const hover = await inspectSection(pocket)
  await pocket.screenshot({ path: path.join(captureDir, `calibration-${surface.id}-hover.png`) })
  const regression = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect()
      return value ? { width: value.width, height: value.height } : null
    }
    return { hero: rect('[data-schema-section-id="home-campaign-stage"]'), news: rect('[data-schema-section-id="home-news-grid"]'), tcgl: rect('[data-schema-section-id="home-product-bands"]') }
  })
  calibration.push({ surface, settled, hover, regression, console: { errors, warnings } })

  await page.goto(`${baseUrl}/?${query}#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-pocket-fixture`, { waitUntil: 'networkidle' })
  const fixture = page.locator('[data-schema-section-id="held-out-pocket-family"]')
  await fixture.waitFor()
  const fixtureSettled = await inspectSection(fixture)
  await fixture.screenshot({ path: path.join(captureDir, `held-out-${surface.id}-settled.png`) })
  await fixture.locator('.pokemon-pocket__cta').hover()
  await page.waitForTimeout(120)
  const fixtureHover = await inspectSection(fixture)
  await fixture.screenshot({ path: path.join(captureDir, `held-out-${surface.id}-hover.png`) })
  heldOut.push({ surface, settled: fixtureSettled, hover: fixtureHover, console: { errors, warnings } })
  await page.close()
}

await browser.close()

const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance
const [desktop, mobile] = calibration
const [heldDesktop, heldMobile] = heldOut
const checks = {
  desktopFullBackground: near(desktop.settled.section.width, 1440) && near(desktop.settled.section.height, 476.195)
    && near(desktop.settled.background.rect.width, 1440) && near(desktop.settled.background.rect.height, 476.195),
  desktopInsetPanel: near(desktop.settled.assetField.width, 720) && near(desktop.settled.copy.rect.x, 720)
    && near(desktop.settled.copy.rect.y, 59.85) && near(desktop.settled.copy.rect.width, 720)
    && near(desktop.settled.copy.rect.height, 356.5)
    && near(desktop.settled.section.height - desktop.settled.copy.rect.y - desktop.settled.copy.rect.height, 59.85),
  mobileLayering: near(mobile.settled.background.rect.width, 390) && near(mobile.settled.background.rect.height, 743.023)
    && near(mobile.settled.assetField.width, 390) && near(mobile.settled.assetField.height, 334.23)
    && near(mobile.settled.copy.rect.x, 0) && near(mobile.settled.copy.rect.y, 334.23)
    && near(mobile.settled.copy.rect.width, 390) && near(mobile.settled.copy.rect.height, 408.793),
  responsiveAliases: desktop.settled.background.currentSrc.includes('pocket-background.jpg')
    && mobile.settled.background.currentSrc.includes('pocket-header-bg-small.jpg'),
  calibrationCta: desktop.settled.cta.href === 'https://tcgpocket.pokemon.com/en-us'
    && desktop.settled.cta.color === 'rgb(0, 0, 0)' && desktop.hover.cta.color === 'rgb(226, 186, 101)'
    && mobile.hover.cta.color === 'rgb(226, 186, 101)',
  heldOutDirectAndLabelled: heldOut.every(({ settled }) => settled.proofRole === 'generative-held-out-fictional'
    && settled.fixtureLabel?.text.includes('FICTIONAL') && settled.fixtureLabel?.text.includes('NOT AN OFFICIAL PRODUCT')
    && settled.fixtureArt && !settled.composite),
  heldOutArrangementChanged: heldDesktop.settled.copy.rect.x === 0 && near(heldDesktop.settled.assetField.x, 720)
    && near(heldMobile.settled.assetField.y, 0) && near(heldMobile.settled.copy.rect.y, 334.23),
  heldOutPreservesFamily: heldOut.every(({ settled, hover }) => settled.background.rect.width === settled.section.width
    && settled.copy.backgroundColor === 'rgb(0, 0, 0)'
    && settled.h2.fontFamily.includes('Kanit Official') && settled.body.fontFamily.includes('PT Sans Official')
    && settled.cta.backgroundColor === 'rgb(255, 255, 255)' && hover.cta.color === 'rgb(226, 186, 101)'),
  noOverflow: [...calibration, ...heldOut].every(({ settled }) => !settled.overflow.sectionHorizontal && !settled.overflow.documentHorizontal),
  priorSectionsUnchanged: near(desktop.regression.hero.height, 450) && near(mobile.regression.hero.height, 416)
    && desktop.regression.news?.height > 0 && mobile.regression.news?.height > 0
    && desktop.regression.tcgl?.height > 0 && mobile.regression.tcgl?.height > 0,
  consoleClean: [...calibration, ...heldOut].every(({ console }) => console.errors.length === 0 && console.warnings.length === 0),
}

const output = {
  schema: 'brand-browser-probes/v1',
  brand: 'pokemon-tcg-official',
  attempt: '10-demo-revision3',
  scope: 'home-editorial-grid plus directly-reachable fictional Pocket-family fixture',
  calibration,
  heldOut,
  checks,
  implementationChecksPass: Object.values(checks).every(Boolean),
  motionDisposition: 'unresolved/unscored; omitted',
  visualVerdict: 'not-assigned-by-implementation-agent',
}
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
if (!output.implementationChecksPass) process.exitCode = 1
