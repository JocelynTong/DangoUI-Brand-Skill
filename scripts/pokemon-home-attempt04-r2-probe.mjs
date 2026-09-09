import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5180'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/04/demo-r2')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const results = []

for (const surface of [{ name: 'mobile-390', width: 390, height: 844 }, { name: 'outer-1440-phone-347', width: 1440, height: 1000 }]) {
  const page = await browser.newPage({ viewport: { width: surface.width, height: surface.height } })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${baseUrl}/#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`, { waitUntil: 'networkidle' })
  const hero = page.locator('[data-schema-section-id="home-campaign-stage"]')
  const screen = page.locator('.phone-screen')
  await hero.waitFor()
  const inspect = () => hero.evaluate(node => {
    const visible = selector => {
      const element = node.querySelector(selector)
      if (!element) return false
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0
    }
    const controls = [...node.querySelectorAll('.source-schema-demo__hero-controls button')]
    const cta = node.querySelector('.source-schema-demo__actions--brand-hero button, .source-schema-demo__actions--brand-hero a')
    const ctaStyle = getComputedStyle(cta)
    const controlStyles = controls.map(control => {
      const rect = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      return { width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor, border: style.border, radius: style.borderRadius, ariaLabel: control.getAttribute('aria-label') }
    })
    return {
      activeIndex: controls.findIndex(control => control.classList.contains('is-active')),
      layers: {
        navigation: visible('.source-schema-demo__hero-nav'), campaignArt: visible('.source-schema-demo__hero-responsive-bg img'),
        campaignLogo: visible('.source-schema-demo__hero-title-image'), featuredCard: visible('.source-schema-demo__card-art'),
        cta: visible('.source-schema-demo__actions--brand-hero'), carouselControls: visible('.source-schema-demo__hero-controls'),
      },
      hero: { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight },
      cta: { height: cta.getBoundingClientRect().height, border: ctaStyle.border, radius: ctaStyle.borderRadius, label: cta.textContent },
      controls: controlStyles,
    }
  })
  const states = []
  states.push(await inspect())
  await hero.screenshot({ path: path.join(captureDir, `${surface.name}-state-0.png`) })
  await hero.locator('.source-schema-demo__hero-controls button').nth(1).click()
  states.push(await inspect())
  await hero.screenshot({ path: path.join(captureDir, `${surface.name}-state-1.png`) })
  await hero.locator('.source-schema-demo__hero-controls button').nth(0).click()
  states.push(await inspect())
  const screenMetrics = await screen.evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }))
  const pass = errors.length === 0 && states.map(s => s.activeIndex).join(',') === '0,1,0'
    && states.every(s => Object.values(s.layers).every(Boolean) && s.hero.scrollWidth <= s.hero.clientWidth && s.cta.height >= 44
      && s.cta.border.includes('rgb(202, 167, 74)') && Number.parseFloat(s.cta.radius) > 0
      && s.controls.every(control => control.width >= 44 && control.height >= 44 && control.color !== 'rgba(0, 0, 0, 0)'))
  results.push({ surface, states, screen: screenMetrics, errors, pass })
  await page.close()
}

await browser.close()
const output = { schema: 'brand-demo-self-test/v1', brand: 'pokemon-tcg-official', attempt: '04-demo-r2', generatedAt: new Date().toISOString(), results, pass: results.every(result => result.pass) }
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
if (!output.pass) process.exitCode = 1
