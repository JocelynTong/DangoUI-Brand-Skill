import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5178'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/04/demo')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const probes = []

for (const viewport of [{ name: 'desktop-1440', width: 1440, height: 1000 }, { name: 'mobile-390', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  const proofQuery = viewport.width === 390 ? '' : '?proof=desktop'
  await page.goto(`${baseUrl}/${proofQuery}#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`, { waitUntil: 'networkidle' })

  const hero = page.locator('[data-schema-section-id="home-campaign-stage"]')
  await hero.waitFor()
  const defaultCapture = path.join(captureDir, `${viewport.name}-hero-default.png`)
  await hero.screenshot({ path: defaultCapture })
  const phoneScreen = page.locator('.phone-screen')
  await phoneScreen.screenshot({ path: path.join(captureDir, `${viewport.name}-viewport-top.png`) })
  if (viewport.width === 390) {
    await phoneScreen.evaluate((node) => { node.scrollTop = 520 })
    await page.waitForTimeout(100)
    await phoneScreen.screenshot({ path: path.join(captureDir, 'mobile-390-viewport-middle.png') })
    await phoneScreen.evaluate((node) => { node.scrollTop = 900 })
    await page.waitForTimeout(100)
    await phoneScreen.screenshot({ path: path.join(captureDir, 'mobile-390-viewport-bottom.png') })
    await phoneScreen.evaluate((node) => { node.scrollTop = 0 })
  }

  const before = await hero.evaluate((node) => ({
    active: [...node.querySelectorAll('.source-schema-demo__hero-controls button')].findIndex((button) => button.classList.contains('is-active')),
    card: node.querySelector('.source-schema-demo__card-art')?.getAttribute('src'),
  }))
  await hero.locator('.source-schema-demo__hero-controls button').nth(1).evaluate((button) => button.click())
  await page.waitForTimeout(250)
  const changed = await hero.evaluate((node) => ({
    active: [...node.querySelectorAll('.source-schema-demo__hero-controls button')].findIndex((button) => button.classList.contains('is-active')),
    card: node.querySelector('.source-schema-demo__card-art')?.getAttribute('src'),
  }))
  await hero.locator('.source-schema-demo__hero-controls button').nth(0).evaluate((button) => button.click())
  await page.waitForTimeout(700)
  const restored = await hero.evaluate((node) => ({
    active: [...node.querySelectorAll('.source-schema-demo__hero-controls button')].findIndex((button) => button.classList.contains('is-active')),
    card: node.querySelector('.source-schema-demo__card-art')?.getAttribute('src'),
  }))

  const metrics = await hero.evaluate((node) => {
    const box = (selector) => {
      const element = node.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, display: style.display, visibility: style.visibility, opacity: style.opacity }
    }
    const visible = (selector) => { const value = box(selector); return Boolean(value && value.width > 0 && value.height > 0 && value.display !== 'none' && value.visibility !== 'hidden' && Number(value.opacity) !== 0) }
    const rect = node.getBoundingClientRect()
    const cta = node.querySelector('.source-schema-demo__actions--brand-hero button, .source-schema-demo__actions--brand-hero a')?.getBoundingClientRect()
    const next = node.nextElementSibling?.getBoundingClientRect()
    const screen = node.closest('.phone-screen')
    return {
      hero: { width: rect.width, height: rect.height },
      layers: {
        navigation: visible('.source-schema-demo__hero-nav'),
        campaignArt: visible('.source-schema-demo__hero-responsive-bg img'),
        campaignLogo: visible('.source-schema-demo__hero-title-image'),
        featuredCard: visible('.source-schema-demo__card-art'),
        cta: visible('.source-schema-demo__actions--brand-hero'),
        carouselControls: visible('.source-schema-demo__hero-controls'),
      },
      layerBoxes: {
        campaignLogo: box('.source-schema-demo__hero-title-image'),
        featuredCard: box('.source-schema-demo__card-art'),
        controls: box('.source-schema-demo__hero-controls'),
      },
      cta: cta ? { width: cta.width, height: cta.height } : null,
      overflow: {
        documentHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        heroHorizontal: node.scrollWidth > node.clientWidth,
      },
      nextSection: next ? { gap: next.top - rect.bottom, reachableWithinScreenScroll: next.top <= rect.top + screen.scrollHeight } : null,
      screen: { clientHeight: screen.clientHeight, scrollHeight: screen.scrollHeight },
      mobileBackgroundSrc: node.querySelector('.source-schema-demo__hero-responsive-bg img')?.getAttribute('src'),
    }
  })
  const reversible = changed.active === 1 && changed.card !== before.card && restored.active === before.active && restored.card === before.card
  const allLayersVisible = Object.values(metrics.layers).every(Boolean)
  const mobile = viewport.width === 390
  const pass = errors.length === 0 && allLayersVisible && !metrics.overflow.documentHorizontal && reversible
    && (!mobile || (metrics.hero.height >= 900 && metrics.hero.height <= 1280 && metrics.cta?.height >= 44 && metrics.mobileBackgroundSrc?.endsWith('/booster-art-1.jpg') && metrics.nextSection?.gap <= 1))
  probes.push({ viewport, metrics, carousel: { before, changed, restored, reversible }, errors, pass })
  await page.close()
}

await browser.close()
const output = { schema: 'brand-browser-probes/v1', brand: 'pokemon-tcg-official', attempt: 4, scope: 'home-campaign-stage', generatedAt: new Date().toISOString(), probes }
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
if (probes.some((probe) => !probe.pass)) process.exitCode = 1
