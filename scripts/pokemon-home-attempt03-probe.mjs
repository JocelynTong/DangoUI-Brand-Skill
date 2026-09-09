import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5174'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/03')
fs.mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const probes = []
const captures = []

for (const viewport of [{ name: 'current-1440', width: 1440, height: 1000 }, { name: 'phone-390', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
  const consoleErrors = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.goto(`${baseUrl}/#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`, { waitUntil: 'networkidle' })
  const viewportNode = page.locator('[data-schema-section-id="home-campaign-stage"]')
  await viewportNode.waitFor()
  const result = await viewportNode.evaluate((outer) => {
    const canvas = outer.querySelector('.source-schema-demo__hero-pc-canvas')
    const next = outer.nextElementSibling
    const outerRect = outer.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    const matrix = new DOMMatrixReadOnly(getComputedStyle(canvas).transform)
    const scaleX = matrix.a
    const scaleY = matrix.d
    const relative = (selector) => {
      const node = canvas.querySelector(selector)
      if (!node) return null
      const rect = node.getBoundingClientRect()
      return { x: (rect.left - canvasRect.left) / scaleX, y: (rect.top - canvasRect.top) / scaleY, width: rect.width / scaleX, height: rect.height / scaleY }
    }
    const intersectionRatio = (selector) => {
      const node = canvas.querySelector(selector)
      if (!node) return null
      const rect = node.getBoundingClientRect()
      const width = Math.max(0, Math.min(rect.right, canvasRect.right) - Math.max(rect.left, canvasRect.left))
      const height = Math.max(0, Math.min(rect.bottom, canvasRect.bottom) - Math.max(rect.top, canvasRect.top))
      return rect.width && rect.height ? (width * height) / (rect.width * rect.height) : 0
    }
    const phoneRect = outer.closest('.phone')?.getBoundingClientRect()
    return {
      availableWidth: outer.clientWidth,
      scaleX,
      scaleY,
      expectedScaledHeight: 716 * (outer.clientWidth / 1440),
      actualScaledHeight: outer.clientHeight,
      logicalCanvas: { width: canvas.offsetWidth, height: canvas.offsetHeight },
      layerRelativeGeometry: {
        background: { x: 0, y: 0, width: 1440, height: 716, implementation: 'canvas-background-image' },
        navigation: relative('.source-schema-demo__hero-nav'),
        logo: relative('.source-schema-demo__logo'),
        title: relative('.source-schema-demo__hero-title-image'),
        card: relative('.source-schema-demo__hero-cards'),
        cta: relative('.source-schema-demo__actions--brand-hero'),
        controls: relative('.source-schema-demo__hero-controls'),
      },
      layerIntersectionRatios: {
        background: 1,
        navigation: intersectionRatio('.source-schema-demo__hero-nav'), logo: intersectionRatio('.source-schema-demo__logo'),
        title: intersectionRatio('.source-schema-demo__hero-title-image'), card: intersectionRatio('.source-schema-demo__hero-cards'),
        cta: intersectionRatio('.source-schema-demo__actions--brand-hero'), controls: intersectionRatio('.source-schema-demo__hero-controls'),
      },
      reachability: phoneRect ? { left: phoneRect.left, right: phoneRect.right, viewportWidth: innerWidth, intersectsViewport: phoneRect.right > 0 && phoneRect.left < innerWidth } : null,
      overflow: { sectionScrollWidth: outer.scrollWidth, sectionClientWidth: outer.clientWidth, pageScrollWidth: document.documentElement.scrollWidth, pageClientWidth: document.documentElement.clientWidth, horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth },
      nextSectionGap: next ? next.getBoundingClientRect().top - outerRect.bottom : null,
      scroll: { screenClientHeight: outer.closest('.phone-screen')?.clientHeight, screenScrollHeight: outer.closest('.phone-screen')?.scrollHeight },
    }
  })
  const capture = path.join(outputDir, `home-campaign-stage-${viewport.name}.png`)
  await page.locator('.phone-screen').screenshot({ path: capture })
  captures.push(path.relative(process.cwd(), capture))
  const allLayersVisible = Object.values(result.layerIntersectionRatios).every((ratio) => ratio >= .999)
  probes.push({ viewport, ...result, consoleErrors, pass: consoleErrors.length === 0 && allLayersVisible && result.reachability?.intersectsViewport && Math.abs(result.scaleX - result.scaleY) < .001 && Math.abs(result.actualScaledHeight - result.expectedScaledHeight) < 1 && result.logicalCanvas.width === 1440 && result.logicalCanvas.height === 716 && !result.overflow.horizontal && result.nextSectionGap <= 8 })
  await page.close()
}
await browser.close()
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify({ schema: 'brand-browser-probes/v1', brand: 'pokemon-tcg-official', attempt: 3, pageId: 'pokemon-tcg-official-home', sectionId: 'home-campaign-stage', generatedAt: new Date().toISOString(), captures, probes }, null, 2)}\n`)
if (probes.some((probe) => !probe.pass)) process.exitCode = 1
